// core/auth.js — HMAC session cookies + GitHub OAuth ("Log in with GitHub").
// Zero dependencies. Mount the handlers on a framework app:
//
//   const auth = createAuth({ db, secret, cookiePrefix: 'myapp', ... });
//   app.get('/api/oauth/config', auth.oauthConfig);
//   app.get('/api/oauth/start', auth.oauthStart);
//   app.get('/api/oauth/callback', auth.oauthCallback);
//   app.get('/api/me', auth.me);
//   app.get('/api/logout', auth.logout);
//
// In a protected handler: `const uid = auth.requireUser(req, res); if (!uid) return;`

import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

const USERNAME_RE = /^[a-zA-Z0-9_-]{2,24}$/;
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, seconds

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url').toString('utf8');

export function createAuth({
  db,
  secret,
  cookiePrefix,
  clientId = '',
  clientSecret = '',
  callbackUrl = '',
  userAgent = 'dashboard-framework-app',
  sessionMaxAge = SESSION_MAX_AGE,
}) {
  const COOKIE = `${cookiePrefix}_session`;
  const STATE_COOKIE = `${cookiePrefix}_oauth_state`;
  const oauthEnabled = () => Boolean(clientId && clientSecret);

  function signToken(uid, exp) {
    const a = b64u(String(uid));
    const b = b64u(String(exp));
    const sig = createHmac('sha256', secret).update(`${a}.${b}`).digest('base64url');
    return `${a}.${b}.${sig}`;
  }

  function verifyToken(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let uid, exp;
    try {
      uid = Number(unb64u(parts[0]));
      exp = Number(unb64u(parts[1]));
    } catch {
      return null;
    }
    if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(exp)) return null;
    if (exp <= Math.floor(Date.now() / 1000)) return null;
    const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    let sig;
    try {
      sig = Buffer.from(parts[2], 'base64url');
    } catch {
      return null;
    }
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
    return uid;
  }

  function getCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const pair of header.split(';')) {
      const i = pair.indexOf('=');
      if (i < 0) continue;
      if (pair.slice(0, i).trim() === name) return pair.slice(i + 1).trim();
    }
    return null;
  }

  function authUserId(req) {
    return verifyToken(getCookie(req, COOKIE));
  }

  function setSessionCookie(res, userId) {
    const expiry = Math.floor(Date.now() / 1000) + sessionMaxAge;
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${signToken(userId, expiry)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAge}`
    );
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  // Returns the uid, or sends 401 and returns null.
  function requireUser(req, res, json) {
    const uid = authUserId(req);
    if (!uid) {
      json(res, 401, { error: 'Not logged in' });
      return null;
    }
    return uid;
  }

  function findOrCreateUser(gh) {
    let user = db.prepare('SELECT id, username FROM users WHERE github_id = ?').get(gh.id);
    if (user) return user;
    let username = String(gh.login).slice(0, 24);
    if (!USERNAME_RE.test(username) || db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      username =
        (username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18) || 'gh') + '-' + String(gh.id).slice(-4);
    }
    const r = db
      .prepare('INSERT INTO users (username, password_hash, github_id, created_at) VALUES (?, ?, ?, ?)')
      .run(username, 'oauth$none', gh.id, new Date().toISOString());
    return { id: Number(r.lastInsertRowid), username };
  }

  async function oauthConfig(req, res, json) {
    json(res, 200, { enabled: oauthEnabled() });
  }

  async function oauthStart(req, res) {
    if (!oauthEnabled()) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('GitHub login is not configured on this server');
      return;
    }
    const state = randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', `${STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'read:user',
      state,
    });
    res.writeHead(302, { Location: 'https://github.com/login/oauth/authorize?' + params.toString() });
    res.end();
  }

  async function oauthCallback(req, res, url) {
    const fail = () => {
      res.writeHead(302, { Location: '/?oauth=error' });
      res.end();
    };
    if (!oauthEnabled()) return fail();
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const expectedState = getCookie(req, STATE_COOKIE);
    res.setHeader('Set-Cookie', `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    if (!code || !state || !expectedState || state !== expectedState) return fail();
    try {
      const tokRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl }),
      });
      const tok = await tokRes.json();
      if (!tok || !tok.access_token) throw new Error('token exchange failed');
      const meRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: 'Bearer ' + tok.access_token, 'User-Agent': userAgent },
      });
      const gh = await meRes.json();
      if (!gh || !gh.id || !gh.login) throw new Error('could not read GitHub profile');
      const user = findOrCreateUser(gh);
      setSessionCookie(res, user.id);
    } catch (e) {
      console.log(`[auth] oauth failed: ${e.message}`);
      return fail();
    }
    res.writeHead(302, { Location: '/' });
    res.end();
  }

  async function me(req, res, json) {
    const uid = authUserId(req);
    if (!uid) return json(res, 401, { error: 'Not logged in' });
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(uid);
    if (!user) return json(res, 401, { error: 'Not logged in' });
    json(res, 200, { id: user.id, username: user.username });
  }

  async function logout(req, res) {
    clearSessionCookie(res);
    res.writeHead(302, { Location: '/' });
    res.end();
  }

  return {
    oauthEnabled,
    authUserId,
    setSessionCookie,
    clearSessionCookie,
    requireUser,
    oauthConfig,
    oauthStart,
    oauthCallback,
    me,
    logout,
  };
}
