import { store, nameOf } from './app-store.js';
import { NO_LEVEL } from './store.js';
import { t } from './i18n.js';
import { h, icon, iconButton, openSheet, searchBox } from './ui.js';

export function emptyFilter() {
  return { q: '', tagIds: [], tagMode: 'and', levelIds: [] };
}

// 削除されたタグ・完成度を絞り込みから外す
export function cleanFilter(f) {
  f.tagIds = f.tagIds.filter((id) => store.get('tags', id));
  f.levelIds = f.levelIds.filter((id) => id === NO_LEVEL || store.get('levels', id));
}

function checkRow(label, on, onClick) {
  return h('button', { type: 'button', class: `pick-row ${on ? 'on' : ''}`, onClick },
    h('span', { class: `check ${on ? 'on' : ''}` }, on ? icon('check', { size: 14 }) : null),
    h('span', { class: 'grow' }, label));
}

export function tagModeSwitch(f, onChange) {
  return h('div', { class: 'seg' },
    ['and', 'or'].map((m) => h('button', {
      type: 'button',
      class: f.tagMode === m ? 'on' : '',
      onClick: () => { f.tagMode = m; onChange(); },
    }, `${m.toUpperCase()}  ${t(`filter.${m}`)}`)));
}

export function tagChecks(f, onChange) {
  const tags = store.state.tags;
  if (!tags.length) return h('p', { class: 'muted pad' }, t('manage.empty'));
  return h('div', { class: 'pick-list' }, tags.map((tg) => checkRow(nameOf('tags', tg), f.tagIds.includes(tg.id), () => {
    f.tagIds = f.tagIds.includes(tg.id) ? f.tagIds.filter((x) => x !== tg.id) : [...f.tagIds, tg.id];
    onChange();
  })));
}

export function levelChecks(f, onChange) {
  const items = [...store.state.levels.map((l) => ({ id: l.id, name: nameOf('levels', l) })), { id: NO_LEVEL, name: t('common.unset') }];
  return h('div', { class: 'pick-list' }, items.map((it) => checkRow(it.name, f.levelIds.includes(it.id), () => {
    f.levelIds = f.levelIds.includes(it.id) ? f.levelIds.filter((x) => x !== it.id) : [...f.levelIds, it.id];
    onChange();
  })));
}

function clearButton(onClick) {
  return h('button', { type: 'button', class: 'text-btn', onClick }, t('filter.clear'));
}

export function openTagFilter(f, onChange) {
  const sheet = openSheet({
    title: t('filter.tags'),
    headerRight: () => clearButton(() => { f.tagIds = []; changed(); }),
    render: () => h('div', {}, tagModeSwitch(f, changed), tagChecks(f, changed)),
  });
  function changed() { sheet.refresh(); onChange(); }
}

export function openLevelFilter(f, onChange) {
  const sheet = openSheet({
    title: t('filter.levels'),
    headerRight: () => clearButton(() => { f.levelIds = []; changed(); }),
    render: () => levelChecks(f, changed),
  });
  function changed() { sheet.refresh(); onChange(); }
}

// 検索窓＋🏷＋⭐ のツールバー。検索は入力のたびに onSearch、絞り込みの変更は onChange
export function filterBar(f, { onSearch, onChange }) {
  const badge = (n) => (n ? h('span', { class: 'badge' }, n) : null);
  return h('div', { class: 'filter-bar' },
    searchBox(f.q, t('songs.searchPlaceholder'), (v) => { f.q = v; onSearch(); }),
    h('div', { class: 'filter-btn-wrap' },
      iconButton('tag', t('filter.tags'), () => openTagFilter(f, onChange), f.tagIds.length ? 'active' : ''),
      badge(f.tagIds.length)),
    h('div', { class: 'filter-btn-wrap' },
      iconButton('star', t('filter.levels'), () => openLevelFilter(f, onChange), f.levelIds.length ? 'active' : ''),
      badge(f.levelIds.length)));
}
