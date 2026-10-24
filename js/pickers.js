import { store, nameOf } from './app-store.js';
import { sortedArtists, artistMatches } from './store.js';
import { t, getLang } from './i18n.js';
import { h, icon, openSheet, promptSheet, toast, searchBox } from './ui.js';

const KIND_TITLE = {
  artists: 'field.artist',
  levels: 'field.level',
  tags: 'field.tags',
  devices: 'field.device',
};

// リストから選ぶシート。その場で新規追加でき、同じ名前があればそれを選べる。
// multi のときは onPick に id の配列、単一のときは id（未設定は null）を渡す。
export function pickNamed({ kind, multi = false, selected = null, allowNone = false, onPick }) {
  let q = '';
  let addName = '';
  let dupId = null;
  const chosen = new Set(multi ? selected ?? [] : []);
  const searchable = kind === 'artists';

  const choose = (id) => {
    if (multi) {
      if (chosen.has(id)) chosen.delete(id);
      else chosen.add(id);
      sheet.refresh();
    } else {
      sheet.close();
      onPick(id);
    }
  };

  // 追加した項目・既存の項目を選択状態にする（複数選択でも外さない）
  const select = (id) => {
    if (multi) {
      chosen.add(id);
      sheet.refresh();
    } else choose(id);
  };

  const tryAdd = () => {
    const res = store.addNamed(kind, { name: addName });
    if (res.ok) {
      addName = '';
      dupId = null;
      q = '';
      select(res.id);
    } else if (res.error === 'duplicate') {
      dupId = res.existingId;
      sheet.refresh();
    }
  };

  let listBox = null;
  const renderList = () => {
    let items = kind === 'artists' ? sortedArtists(store.state, getLang()) : store.state[kind];
    if (searchable) items = items.filter((a) => artistMatches(a, q));
    const rows = items.map((it) => {
      const on = multi ? chosen.has(it.id) : selected === it.id;
      return h('button', { type: 'button', class: `pick-row ${on ? 'on' : ''}`, onClick: () => choose(it.id) },
        kind === 'artists' && it.favorite ? icon('star', { fill: true, size: 16 }) : null,
        h('span', { class: 'grow' }, nameOf(kind, it),
          kind === 'artists' && it.aliases.length ? h('small', { class: 'sub' }, ` ${it.aliases.join(' / ')}`) : null),
        on ? icon('check', { size: 18 }) : null);
    });
    if (allowNone && !q) {
      rows.unshift(h('button', { type: 'button', class: `pick-row ${selected == null ? 'on' : ''}`, onClick: () => choose(null) },
        h('span', { class: 'grow muted' }, t('common.unset')),
        selected == null ? icon('check', { size: 18 }) : null));
    }
    if (!rows.length) rows.push(h('p', { class: 'muted pad' }, kind === 'artists' && !q ? t('register.noArtists') : t('songs.noMatch')));
    return h('div', { class: 'pick-list' }, rows);
  };

  const sheet = openSheet({
    title: t(KIND_TITLE[kind]),
    full: kind === 'artists',
    headerRight: () => (multi
      ? h('button', { type: 'button', class: 'text-btn', onClick: () => { sheet.close(); onPick([...chosen]); } }, t('common.done'))
      : null),
    render: () => {
      const input = h('input', {
        class: 'input',
        value: addName,
        placeholder: `${t('common.new')}: ${t(KIND_TITLE[kind])}`,
        enterkeyhint: 'done',
        onInput: (e) => { addName = e.target.value; },
        onKeydown: (e) => { if (e.key === 'Enter' && !e.isComposing) tryAdd(); },
      });
      const dup = dupId && store.get(kind, dupId);
      listBox = renderList();
      return h('div', {},
        searchable && searchBox(q, t('common.search'), (v) => {
          q = v;
          const next = renderList();
          listBox.replaceWith(next);
          listBox = next;
        }),
        h('div', { class: 'add-row' },
          input,
          h('button', { type: 'button', class: 'btn primary', onClick: tryAdd, 'aria-label': t('common.add') }, icon('plus', { size: 18 }))),
        dup && h('div', { class: 'dup-box' },
          h('span', {}, `${t('common.exists')}: ${nameOf(kind, dup)}`),
          h('button', { type: 'button', class: 'btn small', onClick: () => { dupId = null; addName = ''; select(dup.id); } }, t('common.useExisting'))),
        listBox);
    },
  });
  return sheet;
}

// 「マイリストに追加」：追加先を選ぶ。その場で新しいリストも作れる
export function pickMylist(songId) {
  const add = (listId) => {
    const r = store.addToMylist(listId, [songId]);
    toast(r.added ? t('mylists.added') : t('mylists.already'));
  };
  const sheet = openSheet({
    title: t('mylists.chooseList'),
    render: () => h('div', { class: 'pick-list' },
      h('button', {
        type: 'button',
        class: 'pick-row accent',
        onClick: () => {
          sheet.close();
          promptSheet({
            title: t('mylists.create'),
            onSubmit: (name) => {
              const r = store.addNamed('mylists', { name });
              if (!r.ok) return r.error === 'duplicate' ? t('common.exists') : t('common.required');
              add(r.id);
              return null;
            },
          });
        },
      }, icon('plus', { size: 18 }), h('span', { class: 'grow' }, t('mylists.create'))),
      store.state.mylists.map((m) => {
        const inList = m.songIds.includes(songId);
        return h('button', {
          type: 'button',
          class: 'pick-row',
          onClick: () => { sheet.close(); add(m.id); },
        }, icon('list', { size: 18 }), h('span', { class: 'grow' }, m.name),
        inList ? h('small', { class: 'muted' }, t('mylists.already')) : null);
      })),
  });
}
