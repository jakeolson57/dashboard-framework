// core/server.js — tiny app framework for zero-dependency Node dashboards.
// Usage:
//
//   import { createApp } from './core/server.js';
//   const app = createApp({ root: ROOT });
//   app.get('/api/things/:id', async (req, res, url, params) => { ... });
//   app.post('/api/things', async (req, res, url) => {
//     const body = await app.readJsonBody(req);
//   });
//   app.listen(8474, () => console.log('up'));
//
// Routes are matched in registration order. `:name` segments become params.
// Unmatched GET/HEAD requests fall through to the static file server, which
// serves the repo root with the trackers' blocklist (dotfiles, server.js,
// *.db*, *.secret, tests/, scripts/, node_modules/ are never served).

import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, extname, basename, sep } from 'node:path';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const MAX_BODY = 1024 * 1024; // 1 MB

export function createApp({ root, staticDir = '.', maxBody = MAX_BODY } = {}) {
  const STATIC_ROOT = join(root, staticDir);
  const routes = [];

  function addRoute(method, pattern, handler) {
    const segs = pattern.split('/').filter(Boolean);
    routes.push({ method, segs, handler, pattern });
  }

  function matchRoute(method, pathname) {
    const pSegs = pathname.split('/').filter(Boolean);
    for (const r of routes) {
      if (r.method !== method) continue;
      if (r.segs.length !== pSegs.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < r.segs.length; i++) {
        if (r.segs[i].startsWith(':')) params[r.segs[i].slice(1)] = decodeURIComponent(pSegs[i]);
        else if (r.segs[i] !== pSegs[i]) { ok = false; break; }
      }
      if (ok) return { handler: r.handler, params };
    }
    return null;
  }

  function json(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  }

  function err(res, status, message) {
    return json(res, status, { error: message });
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > maxBody) {
          reject(new Error('body too large'));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch {
          reject(new Error('invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  function isStaticBlocked(rel) {
    const segs = rel.split('/');
    if (segs.some((s) => s.startsWith('.') && s.length > 0)) return true;
    if (basename(rel) === 'server.js') return true;
    if (/\.db(-journal|-wal|-shm)?$/.test(rel)) return true;
    if (/\.secret$/.test(rel)) return true;
    if (rel === 'tests' || rel.startsWith('tests/')) return true;
    if (rel === 'scripts' || rel.startsWith('scripts/')) return true;
    if (rel === 'node_modules' || rel.startsWith('node_modules/')) return true;
    return false;
  }

  function notFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }

  function serveStatic(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(res);
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      return notFound(res);
    }
    if (pathname === '/') pathname = '/index.html';
    const rel = normalize(pathname).replace(/^[/\\]+/, '').replace(/\\/g, '/');
    const abs = join(STATIC_ROOT, rel);
    if (rel === '' || isStaticBlocked(rel) || (abs !== STATIC_ROOT && !abs.startsWith(STATIC_ROOT + sep))) {
      return notFound(res);
    }
    let st;
    try {
      st = statSync(abs);
    } catch {
      st = null;
    }
    if (!st || !st.isFile()) return notFound(res);
    const type = CONTENT_TYPES[extname(abs).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size });
    if (req.method === 'GET') res.end(readFileSync(abs));
    else res.end();
  }

  const server = createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://x');
    } catch {
      return err(res, 400, 'Bad request');
    }
    try {
      const hit = matchRoute(req.method, url.pathname);
      if (hit) {
        await hit.handler(req, res, url, hit.params, { json, err, readJsonBody });
        return;
      }
      return serveStatic(req, res);
    } catch (e) {
      console.log(`[http] ${req.method} ${url.pathname}: ${e.message}`);
      return err(res, 500, 'Internal error');
    }
  });

  return {
    get: (pattern, handler) => addRoute('GET', pattern, handler),
    post: (pattern, handler) => addRoute('POST', pattern, handler),
    put: (pattern, handler) => addRoute('PUT', pattern, handler),
    del: (pattern, handler) => addRoute('DELETE', pattern, handler),
    json,
    err,
    readJsonBody,
    listen: (port, cb) => server.listen(port, cb),
    server,
  };
}
