import { store, nameById } from '../app-store.js';
import { filterSongs, sortSongs, shuffle } from '../store.js';
import { t, getLang } from '../i18n.js';
import { h, icon, iconButton, openSheet, confirmDialog, actionMenu, promptSheet, toast, empty } from '../ui.js';
import { emptyFilter, cleanFilter, filterBar, tagChecks, tagModeSwitch, levelChecks } from '../filters.js';
import { openSongMenu } from '../detail.js';
import { songRow, showDetail, inlineDetail } from './songs.js';

// shuffle: { f, order } のときはシャッフル後の一覧を表示する（一時的な表示のみ）
const view = { openId: null, editing: false, shuffle: null, expanded: null };

export function renderMylists(root) {
  const list = view.openId && store.get('mylists', view.openId);
  if (!list) {
    Object.assign(view, { openId: null, editing: false, shuffle: null });
    renderIndex(root);
  } else if (view.shuffle) renderShuffle(root, list);
  else renderList(root, list);
}

function rerender() {
  renderMylists(document.querySelector('#view'));
}

function createList() {
  promptSheet({
    title: t('mylists.create'),
    onSubmit: (name) => {
      const r = store.addNamed('mylists', { name });
      if (!r.ok) return r.error === 'duplicate' ? t('common.exists') : t('common.required');
      return null;
    },
  });
}

function renderIndex(root) {
  const lists = store.state.mylists;
  root.replaceChildren(
    h('header', { class: 'page-head' },
      h('h1', {}, t('mylists.title')),
      iconButton('plus', t('mylists.create'), createList, 'accent')),
    lists.length
      ? h('div', { class: 'card list' }, lists.map((m) => h('button', {
        type: 'button',
        class: 'list-row',
        onClick: () => { Object.assign(view, { openId: m.id, editing: false, shuffle: null, expanded: null }); rerender(); window.scrollTo(0, 0); },
      },
      h('span', { class: 'list-icon' }, icon('list', { size: 20 })),
      h('span', { class: 'grow' }, m.name),
      h('span', { class: 'muted' }, m.songIds.length),
      icon('chevron', { size: 18 }))))
      : empty(t('mylists.empty'), 'list'));
}

function listMenu(list) {
  actionMenu(list.name, [
    {
      icon: 'edit',
      label: t('mylists.rename'),
      onClick: () => promptSheet({
        title: t('mylists.rename'),
        value: list.name,
        onSubmit: (name) => {
          const r = store.updateNamed('mylists', list.id, { name });
          if (!r.ok) return r.error === 'duplicate' ? t('common.exists') : t('common.required');
          return null;
        },
      }),
    },
    {
      icon: 'trash',
      label: t('common.delete'),
      danger: true,
      onClick: async () => {
        if (await confirmDialog({ message: t('mylists.delete'), okLabel: t('common.delete'), danger: true })) {
          store.deleteNamed('mylists', list.id);
        }
      },
    },
  ]);
}

function listHead(title, onBack, right) {
  return h('header', { class: 'page-head' },
    iconButton('back', t('common.back'), onBack),
    h('h1', { class: 'grow ellipsis' }, title),
    right);
}

function renderList(root, list) {
  const songs = list.songIds.map((id) => store.get('songs', id)).filter(Boolean);
  const box = h('div', { class: `song-list ${view.editing ? 'editing' : ''}` });

  for (const song of songs) {
    if (view.editing) {
      box.append(editRow(song, list, box));
      continue;
    }
    const row = songRow(song, {
      onTap: () => showDetail(song.id, view, rerender, { listId: list.id }),
      onMenu: () => openSongMenu(song.id, { listId: list.id }),
    });
    box.append(swipeable(row, () => store.removeFromMylist(list.id, song.id)));
    const d = inlineDetail(view, song.id, { listId: list.id });
    if (d) box.append(d);
  }

  root.replaceChildren(
    listHead(list.name, () => { view.openId = null; rerender(); }, iconButton('more', t('common.edit'), () => listMenu(list))),
    h('div', { class: 'list-tools' },
      h('button', { type: 'button', class: 'btn primary round', disabled: !songs.length, onClick: () => openShuffleSetup(list) },
        icon('shuffle', { size: 18 }), t('mylists.shuffle')),
      h('button', { type: 'button', class: 'btn round', onClick: () => openAddSongs(list) }, icon('plus', { size: 18 }), t('mylists.addSongs')),
      h('span', { class: 'grow' }),
      songs.length ? h('button', { type: 'button', class: 'text-btn', onClick: () => { view.editing = !view.editing; rerender(); } },
        view.editing ? t('common.done') : t('common.edit')) : null),
    songs.length ? box : empty(t('mylists.listEmpty'), 'music'));
}

// 左スワイプで「リストから外す」ボタンを出す
function swipeable(row, onRemove) {
  const action = h('button', { type: 'button', class: 'swipe-action', onClick: onRemove }, icon('minus', { size: 18 }), t('menu.removeFromList'));
  const wrap = h('div', { class: 'swipe' }, action, row);
  const W = 120;
  let sx = 0;
  let sy = 0;
  let base = 0;
  let x = 0;
  let mode = null; // null | 'h' | 'v'
  let moved = false;
  const set = (v, anim) => {
    x = v;
    row.style.transition = anim ? 'transform .2s' : 'none';
    row.style.transform = v ? `translateX(${v}px)` : '';
  };
  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    sx = e.clientX;
    sy = e.clientY;
    base = x;
    mode = null;
    moved = false;
  });
  row.addEventListener('pointermove', (e) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (!mode && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (mode === 'h') row.setPointerCapture(e.pointerId);
    }
    if (mode === 'h') {
      moved = true;
      set(Math.max(-W, Math.min(0, base + dx)), false);
    }
  });
  const end = () => {
    if (mode === 'h') set(x < -W / 2 ? -W : 0, true);
    mode = null;
  };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
  row.addEventListener('click', (e) => {
    if (moved || x !== 0) {
      e.stopPropagation();
      e.preventDefault();
      if (!moved) set(0, true);
      moved = false;
    }
  }, true);
  return wrap;
}

// 編集モードの行：つまみをドラッグして並べ替える
function editRow(song, list, box) {
  const grip = h('span', { class: 'grip', 'aria-label': 'drag' }, icon('grip', { size: 20 }));
  const row = h('div', { class: 'song-row edit-row', 'data-id': song.id },
    h('button', { type: 'button', class: 'remove-dot', 'aria-label': t('menu.removeFromList'), onClick: () => store.removeFromMylist(list.id, song.id) }, icon('minus', { size: 14 })),
    h('div', { class: 'song-text grow' },
      h('div', { class: 'song-title' }, song.title),
      h('div', { class: 'song-sub' }, nameById('artists', song.artistId))),
    grip);
  let dragging = false;
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    grip.setPointerCapture(e.pointerId);
    row.classList.add('dragging');
  });
  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const others = [...box.children].filter((c) => c !== row);
    const after = others.find((c) => {
      const r = c.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (after) {
      if (row.nextSibling !== after) box.insertBefore(row, after);
    } else if (box.lastChild !== row) box.append(row);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    row.classList.remove('dragging');
    store.reorderMylist(list.id, [...box.children].map((c) => c.dataset.id));
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  return row;
}

// ---- シャッフル ----

function shuffleTargets(list, f) {
  const songs = list.songIds.map((id) => store.get('songs', id)).filter(Boolean);
  return filterSongs(store.state, songs, f);
}

function openShuffleSetup(list) {
  const f = view.shuffle?.f ?? emptyFilter();
  const sheet = openSheet({
    title: t('mylists.shuffle'),
    render: () => {
      cleanFilter(f);
      const n = shuffleTargets(list, f).length;
      const changed = () => sheet.refresh();
      return h('div', {},
        h('h3', { class: 'group-title' }, icon('star', { size: 16 }), t('field.level')),
        levelChecks(f, changed),
        h('h3', { class: 'group-title' }, icon('tag', { size: 16 }), t('field.tags')),
        f.tagIds.length > 1 ? tagModeSwitch(f, changed) : null,
        tagChecks(f, changed),
        h('div', { class: 'sheet-foot' },
          h('div', { class: 'muted center' }, n ? `${t('mylists.shuffleTarget')}: ${t('songs.count', { n })}` : t('mylists.shuffleNone')),
          h('button', {
            type: 'button',
            class: 'btn primary block',
            disabled: !n,
            onClick: () => {
              sheet.close();
              view.shuffle = { f, order: shuffle(shuffleTargets(list, f).map((s) => s.id)) };
              view.expanded = null;
              rerender();
              window.scrollTo(0, 0);
            },
          }, icon('shuffle', { size: 18 }), t('mylists.shuffleStart'))));
    },
  });
}

function renderShuffle(root, list) {
  const sh = view.shuffle;
  const songs = sh.order.map((id) => store.get('songs', id)).filter((s) => s && list.songIds.includes(s.id));
  const reshuffle = () => {
    sh.order = shuffle(shuffleTargets(list, sh.f).map((s) => s.id));
    view.expanded = null;
    rerender();
  };
  root.replaceChildren(
    listHead(`${t('mylists.shuffle')} · ${list.name}`, () => { view.shuffle = null; rerender(); },
      iconButton('star', t('filter.levels'), () => openShuffleSetup(list))),
    h('div', { class: 'list-tools' },
      h('button', { type: 'button', class: 'btn primary round', onClick: reshuffle }, icon('shuffle', { size: 18 }), t('mylists.reshuffle'))),
    songs.length
      ? h('div', { class: 'song-list numbered' }, songs.flatMap((song, i) => [
        songRow(song, {
          onTap: () => showDetail(song.id, view, rerender, { listId: list.id }),
          extra: h('span', { class: 'num' }, i + 1),
        }),
        inlineDetail(view, song.id, { listId: list.id }),
      ].filter(Boolean)))
      : empty(t('mylists.shuffleNone'), 'shuffle'));
}

// ---- 曲を追加（複数選択） ----

function openAddSongs(list) {
  const f = emptyFilter();
  const picked = new Set();
  let listBox = null;
  const fill = () => {
    const s = store.state;
    const songs = sortSongs(s, filterSongs(s, s.songs, f), 'title', 'asc', getLang());
    const next = h('div', { class: 'pick-list' }, songs.length
      ? songs.map((song) => {
        const already = list.songIds.includes(song.id);
        const on = picked.has(song.id);
        return h('button', {
          type: 'button',
          class: `pick-row ${on ? 'on' : ''}`,
          disabled: already,
          onClick: () => {
            if (on) picked.delete(song.id);
            else picked.add(song.id);
            fill();
            sheet.refreshHead();
          },
        },
        h('span', { class: `check ${on || already ? 'on' : ''}` }, on || already ? icon('check', { size: 14 }) : null),
        h('span', { class: 'grow' }, song.title, h('small', { class: 'sub' }, ` ${nameById('artists', song.artistId)}`)),
        already ? h('small', { class: 'muted' }, t('mylists.already')) : null);
      })
      : h('p', { class: 'muted pad' }, t('songs.noMatch')));
    if (listBox) listBox.replaceWith(next);
    listBox = next;
  };
  const sheet = openSheet({
    title: t('mylists.addSongs'),
    full: true,
    headerRight: () => h('button', {
      type: 'button',
      class: 'text-btn',
      disabled: !picked.size,
      onClick: () => {
        const r = store.addToMylist(list.id, [...picked]);
        sheet.close();
        toast(t('mylists.addedCount', { n: r.added }));
      },
    }, `${t('common.add')}${picked.size ? ` (${picked.size})` : ''}`),
    render: () => {
      cleanFilter(f);
      listBox = null;
      fill();
      return h('div', {}, filterBar(f, { onSearch: fill, onChange: () => sheet.refresh() }), listBox);
    },
  });
}
