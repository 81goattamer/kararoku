import { t } from './i18n.js';

// 小さなDOM生成ヘルパー
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const ICONS = {
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3',
  note: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8',
  key: 'M12 20V4M5 11l7-7 7 7',
  more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  close: 'M18 6L6 18M6 6l12 12',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 18l6-6-6-6',
  check: 'M20 6L9 17l-5-5',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  shuffle: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  grip: 'M4 9h16M4 15h16',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  minus: 'M5 12h14',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  device: 'M4 4h16v12H4zM8 20h8M12 16v4',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  layers: 'M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
};

export function icon(name, { fill = false, size = 22 } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', fill ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name] ?? '');
  svg.append(path);
  return svg;
}

export function iconButton(name, label, onClick, cls = '') {
  return h('button', { type: 'button', class: `icon-btn ${cls}`, 'aria-label': label, title: label, onClick }, icon(name));
}

// ---- シート（下から出るパネル） ----

const openSheets = [];

// render が渡されたときは、store の変更や refresh() で中身を作り直す
export function openSheet({ title, render, full = false, onClose, headerRight }) {
  const body = h('div', { class: 'sheet-body' });
  const titleEl = h('h2', { class: 'sheet-title' }, title ?? '');
  const right = h('div', { class: 'sheet-head-right' });
  const sheet = h('div', { class: `sheet ${full ? 'full' : ''}`, role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'sheet-head' },
      iconButton('close', t('common.close'), () => api.close()),
      titleEl,
      right),
    body);
  const backdrop = h('div', { class: 'backdrop', onClick: (e) => { if (e.target === backdrop) api.close(); } }, sheet);
  const api = {
    body,
    closed: false,
    setTitle(s) { titleEl.textContent = s; },
    refresh() {
      if (!render || api.closed) return;
      const y = body.scrollTop;
      body.replaceChildren(render(api));
      api.refreshHead();
      body.scrollTop = y;
    },
    refreshHead() {
      right.replaceChildren(headerRight ? headerRight(api) ?? '' : '');
    },
    close() {
      if (api.closed) return;
      api.closed = true;
      openSheets.splice(openSheets.indexOf(api), 1);
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 200);
      onClose?.();
    },
  };
  openSheets.push(api);
  document.body.append(backdrop);
  api.refresh();
  requestAnimationFrame(() => backdrop.classList.add('show'));
  return api;
}

export function refreshSheets() {
  for (const s of [...openSheets]) s.refresh();
}

export function closeAllSheets() {
  for (const s of [...openSheets]) s.close();
}

// 確認ダイアログ。detail を渡すと「詳細」ボタンで一覧を表示する
export function confirmDialog({ message, okLabel = t('common.ok'), danger = false, detail = null }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      sheet.close();
      resolve(v);
    };
    const detailBox = h('div', { class: 'confirm-detail', hidden: true });
    const sheet = openSheet({
      title: '',
      onClose: () => finish(false),
      render: () => h('div', { class: 'confirm' },
        h('p', { class: 'confirm-msg' }, message),
        detail && h('button', {
          type: 'button',
          class: 'link-btn',
          onClick: () => {
            detailBox.hidden = !detailBox.hidden;
            if (!detailBox.hasChildNodes()) detailBox.append(detail());
          },
        }, t('common.details')),
        detailBox,
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn', onClick: () => finish(false) }, t('common.cancel')),
          h('button', { type: 'button', class: `btn ${danger ? 'danger' : 'primary'}`, onClick: () => finish(true) }, okLabel))),
    });
  });
}

// メニュー（…ボタン・長押し）
export function actionMenu(title, items) {
  const sheet = openSheet({
    title,
    render: () => h('div', { class: 'menu' },
      items.filter(Boolean).map((it) => h('button', {
        type: 'button',
        class: `menu-item ${it.danger ? 'danger' : ''}`,
        onClick: () => { sheet.close(); it.onClick(); },
      }, it.icon && icon(it.icon), it.label))),
  });
  return sheet;
}

// 1行入力のシート。onSubmit が文字列を返したらエラーとして表示し、閉じない
export function promptSheet({ title, value = '', placeholder = '', onSubmit }) {
  const input = h('input', { class: 'input', value, placeholder, enterkeyhint: 'done' });
  const err = h('p', { class: 'error', hidden: true });
  const submit = () => {
    const res = onSubmit(input.value);
    if (typeof res === 'string') {
      err.textContent = res;
      err.hidden = false;
    } else sheet.close();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) submit(); });
  const sheet = openSheet({
    title,
    render: () => h('div', { class: 'form' },
      input,
      err,
      h('button', { type: 'button', class: 'btn primary block', onClick: submit }, t('common.save'))),
  });
  setTimeout(() => input.focus(), 250);
  return sheet;
}

let toastTimer = null;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = h('div', { class: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// 長押し。発火したら直後の click を無効にする
export function onLongPress(el, handler) {
  let timer = null;
  let sx = 0;
  let sy = 0;
  let fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', (e) => {
    fired = false;
    sx = e.clientX;
    sy = e.clientY;
    cancel();
    timer = setTimeout(() => { fired = true; navigator.vibrate?.(10); handler(); }, 500);
  });
  el.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) cancel();
  });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('click', (e) => {
    if (fired) {
      e.stopPropagation();
      e.preventDefault();
      fired = false;
    }
  }, true);
}

export function formatScore(n) {
  return n == null ? '—' : String(n);
}

export function formatKey(k) {
  return k > 0 ? `+${k}` : String(k);
}

export function formatDatetime(s) {
  return s ? s.replace('T', ' ').replaceAll('-', '/') : '';
}

export function formatDate(s) {
  return s ? s.slice(0, 10).replaceAll('-', '/') : '';
}

export function empty(text, iconName = 'music') {
  return h('div', { class: 'empty' }, icon(iconName, { size: 40 }), h('p', {}, text));
}

export function searchBox(value, placeholder, onInput) {
  const input = h('input', {
    class: 'search-input',
    type: 'search',
    value,
    placeholder,
    enterkeyhint: 'search',
    onInput: (e) => onInput(e.target.value),
  });
  return h('label', { class: 'search' }, icon('search', { size: 18 }), input);
}
