// core/ui-kit.js — shared frontend helpers for framework apps.
// Import as a module, or copy the functions you need.

// JSON API wrapper. Throws on HTTP error with the server's message.
export async function api(path, method, body) {
  const r = await fetch('/api' + path, {
    method: method || 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch (e) { /* non-JSON */ }
  if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
  return j;
}

// GitHub login boot. Expects #loginBtn and #whoami in the page.
// onUser(user|null) is called once the state is known.
export async function initAuth(onUser) {
  const btn = document.querySelector('#loginBtn');
  const who = document.querySelector('#whoami');
  let cfg = { enabled: false };
  let me = null;
  try { cfg = await api('/oauth/config'); } catch (e) { /* offline */ }
  try { me = await api('/me'); } catch (e) { /* not logged in */ }
  if (me && who) {
    who.textContent = me.username;
    who.classList.remove('hidden');
    if (btn) btn.classList.add('hidden');
  } else if (cfg.enabled && btn) {
    btn.classList.remove('hidden');
    btn.onclick = () => { location.href = '/api/oauth/start'; };
    if (new URLSearchParams(location.search).get('oauth') === 'error') {
      const err = document.querySelector('#authError');
      if (err) err.classList.remove('hidden');
    }
  }
  if (onUser) onUser(me);
  return me;
}

// Debounce helper (e.g. for search inputs or sync pushes).
export function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Format an ISO timestamp in the viewer's locale, short form.
export function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Escape HTML in interpolated strings.
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
