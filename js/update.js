import { t } from './i18n.js';
import { h, icon } from './ui.js';

// 更新の知らせ。公開中の version.js を確かめ、今の版と違えば画面の上にバーを出す
const current = self.APP_VERSION;
let bar = null;

async function check() {
  if (bar || location.protocol === 'file:' || !navigator.onLine) return;
  try {
    const res = await fetch(`version.js?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = /APP_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(await res.text())?.[1];
    if (latest && latest !== current) showBar();
  } catch {
    // つながらないときは何もしない
  }
}

function showBar() {
  bar = h('button', { type: 'button', class: 'update-bar', role: 'status', onClick: applyUpdate },
    icon('refresh', { size: 20 }), h('span', { class: 'grow' }, t('update.available')),
    h('span', { class: 'update-go' }, t('update.apply')));
  document.body.append(bar);
}

// 新しい Service Worker を入れてから読み込み直す（入らなくても数秒で読み込み直す）
async function applyUpdate() {
  bar.classList.add('busy');
  bar.disabled = true;
  const reload = () => location.reload();
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
      setTimeout(reload, 4000);
      await reg.update();
      if (!reg.installing && !reg.waiting) reload();
      return;
    }
  } catch {
    // 失敗しても読み込み直す
  }
  reload();
}

export function startUpdateCheck() {
  check();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
}
