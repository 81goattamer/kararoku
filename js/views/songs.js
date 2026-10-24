import { store, nameById } from '../app-store.js';
import { filterSongs, sortSongs, bestScore, DEFAULT_DIR } from '../store.js';
import { t, getLang } from '../i18n.js';
import { h, icon, iconButton, onLongPress, empty, formatScore } from '../ui.js';
import { emptyFilter, cleanFilter, filterBar } from '../filters.js';
import { songDetail, openSongDetail, openSongMenu } from '../detail.js';

const view = { f: emptyFilter(), sort: 'title', dir: 'asc', expanded: null };

// 楽曲の1行。楽曲一覧・マイリスト・シャッフルで共通
export function songRow(song, { onTap, onMenu, extra = null, cls = '' }) {
  const s = store.state;
  const base = s.settings.baseDeviceId;
  const best = base ? bestScore(s, song.id, base) : null;
  const main = h('button', { type: 'button', class: 'song-main', onClick: onTap },
    h('div', { class: 'song-art' }, icon('music', { size: 20 })),
    h('div', { class: 'song-text' },
      h('div', { class: 'song-title' }, song.title),
      h('div', { class: 'song-sub' },
        nameById('artists', song.artistId),
        song.levelId ? h('span', { class: 'level-pill' }, nameById('levels', song.levelId)) : null)),
    best != null ? h('span', { class: 'song-best' }, formatScore(best)) : null);
  if (onMenu) onLongPress(main, onMenu);
  return h('div', { class: `song-row ${cls}`, 'data-id': song.id },
    extra,
    main,
    onMenu ? iconButton('more', t('menu.addToMylist'), onMenu, 'row-more') : null);
}

// 詳細の表示方法（設定）に合わせて開く。インラインのときは expanded を切り替えて再描画する
export function showDetail(songId, state, rerender, opts = {}) {
  if (store.state.settings.detailMode === 'popup') openSongDetail(songId, opts);
  else {
    state.expanded = state.expanded === songId ? null : songId;
    rerender();
  }
}

export function inlineDetail(state, songId, opts = {}) {
  return store.state.settings.detailMode === 'inline' && state.expanded === songId
    ? h('div', { class: 'inline-detail' }, songDetail(songId, opts))
    : null;
}

export function renderSongs(root) {
  const s = store.state;
  cleanFilter(view.f);
  const hasBase = !!s.settings.baseDeviceId;
  if (view.sort === 'best' && !hasBase) {
    view.sort = 'title';
    view.dir = DEFAULT_DIR.title;
  }

  const listBox = h('div', { class: 'song-list' });
  const countEl = h('div', { class: 'count' });
  const fillList = () => {
    const rows = sortSongs(s, filterSongs(s, s.songs, view.f), view.sort, view.dir, getLang());
    countEl.textContent = t('songs.count', { n: rows.length });
    listBox.replaceChildren(...(rows.length
      ? rows.flatMap((song) => [
        songRow(song, {
          onTap: () => showDetail(song.id, view, () => renderSongs(root)),
          onMenu: () => openSongMenu(song.id),
        }),
        inlineDetail(view, song.id),
      ].filter(Boolean))
      : [empty(s.songs.length ? t('songs.noMatch') : t('songs.empty'))]));
  };

  const sorts = ['title', 'artist', 'recent', ...(hasBase ? ['best'] : [])];
  const sortBar = h('div', { class: 'sort-bar' }, sorts.map((key) => h('button', {
    type: 'button',
    class: `sort-chip ${view.sort === key ? 'on' : ''}`,
    onClick: () => {
      if (view.sort === key) view.dir = view.dir === 'asc' ? 'desc' : 'asc';
      else {
        view.sort = key;
        view.dir = DEFAULT_DIR[key];
      }
      renderSongs(root);
    },
  }, t(`sort.${key}`), view.sort === key ? h('span', { class: 'dir' }, view.dir === 'asc' ? '↑' : '↓') : null)));

  root.replaceChildren(
    h('header', { class: 'page-head' }, h('h1', {}, t('songs.title'))),
    h('div', { class: 'sticky-tools' },
      filterBar(view.f, { onSearch: fillList, onChange: () => renderSongs(root) }),
      sortBar),
    countEl,
    listBox);
  fillList();
}
