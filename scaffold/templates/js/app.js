import { api, initAuth, esc } from '/core/ui-kit.js';

const out = document.querySelector('#out');

document.querySelector('#pingBtn').onclick = async () => {
  try {
    const r = await api('/ping');
    out.textContent = 'API says: ' + r.pong + ' (framework v' + r.framework + ')';
    document.querySelector('#statusDot').className = 'dot ok';
  } catch (e) {
    out.textContent = 'Ping failed: ' + e.message;
    document.querySelector('#statusDot').className = 'dot danger';
  }
};

document.querySelector('#secretBtn').onclick = async () => {
  try {
    const r = await api('/secret', 'POST', { note: 'hello' });
    out.textContent = 'Logged in as ' + r.user + '; server replied: ' + esc(r.echo);
  } catch (e) {
    out.textContent = 'Needs login: ' + e.message;
  }
};

initAuth((me) => {
  document.querySelector('#fwVersion').textContent =
    document.querySelector('#fwVersion').textContent; // filled below
  fetch('/api/ping').then((r) => r.json()).then((j) => {
    document.querySelector('#fwVersion').textContent = j.framework;
  }).catch(() => {});
});
