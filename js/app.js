import { store } from './app-store.js';
import { setLang, t } from './i18n.js';
import { h, icon, refreshSheets, closeAllSheets } from './ui.js';
import { renderRegister } from './views/register.js';
import { renderMylists } from './views/mylists.js';
import { renderSongs } from './views/songs.js';
import { renderSettings } from './views/settings.js';

const TABS = [
  { id: 'register', icon: 'plus', render: renderRegister },
  { id: 'mylists', icon: 'list', render: renderMylists },
  { id: 'songs', icon: 'music', render: renderSongs },
  { id: 'settings', icon: 'gear', render: renderSettings },
];

let current = 'songs';
try {
  const saved = sessionStorage.getItem('kararoku:tab');
  if (TABS.some((x) => x.id === saved)) current = saved;
} catch {
  // 保存できない環境では初期タブのまま
}

const viewEl = document.querySelector('#view');
const navEl = document.querySelector('#nav');

function renderNav() {
  navEl.replaceChildren(...TABS.map((tab) => h('button', {
    type: 'button',
    class: `tab ${tab.id === current ? 'on' : ''}`,
    'aria-current': tab.id === current ? 'page' : null,
    onClick: () => {
      if (tab.id === current) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      current = tab.id;
      try { sessionStorage.setItem('kararoku:tab', current); } catch { /* 無視 */ }
      closeAllSheets();
      render();
      window.scrollTo(0, 0);
    },
  }, icon(tab.icon, { size: 24 }), h('span', {}, t(`tab.${tab.id}`)))));
}

function render() {
  setLang(store.state.settings.lang);
  document.title = 'カラロク';
  const y = window.scrollY;
  TABS.find((x) => x.id === current).render(viewEl);
  renderNav();
  window.scrollTo(0, y);
}

// 変更は1回の操作が終わってからまとめて反映する
let pending = false;
store.subscribe(() => {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    render();
    refreshSheets();
  });
});

render();

navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
