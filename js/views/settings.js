import { store, nameOf, nameById } from '../app-store.js';
import { deletionImpact, sortedArtists, isValidScore } from '../store.js';
import { t, getLang } from '../i18n.js';
import { h, icon, iconButton, openSheet, confirmDialog, promptSheet, toast, formatDatetime, formatScore } from '../ui.js';

const KIND_LABEL = { tags: 'manage.tags', levels: 'manage.levels', devices: 'manage.devices', artists: 'manage.artists' };
const KIND_ICON = { tags: 'tag', levels: 'star', devices: 'device', artists: 'user' };

let graphError = '';

function group(title, ...rows) {
  return h('section', { class: 'group' },
    title ? h('h2', { class: 'group-label' }, title) : null,
    h('div', { class: 'card list' }, rows));
}

function row(iconName, label, control) {
  return h('div', { class: 'set-row' }, h('span', { class: 'set-icon' }, icon(iconName, { size: 18 })), h('span', { class: 'grow' }, label), control);
}

function navRow(iconName, label, value, onClick) {
  return h('button', { type: 'button', class: 'set-row nav', onClick },
    h('span', { class: 'set-icon' }, icon(iconName, { size: 18 })),
    h('span', { class: 'grow' }, label),
    value != null ? h('span', { class: 'muted' }, value) : null,
    icon('chevron', { size: 18 }));
}

function seg(options, value, onPick) {
  return h('div', { class: 'seg small' }, options.map(([v, label]) => h('button', {
    type: 'button',
    class: v === value ? 'on' : '',
    onClick: () => onPick(v),
  }, label)));
}

export function renderSettings(root) {
  const st = store.state.settings;
  const s = store.state;

  const baseSel = h('select', { class: 'select', onChange: (e) => store.setSettings({ baseDeviceId: e.target.value || null }) },
    h('option', { value: '' }, t('common.unset')),
    s.devices.map((d) => h('option', { value: d.id }, d.name)));
  baseSel.value = st.baseDeviceId ?? '';

  const minIn = h('input', { class: 'input num', type: 'number', inputmode: 'decimal', min: 0, max: 100, step: 'any', value: String(st.graph.min) });
  const maxIn = h('input', { class: 'input num', type: 'number', inputmode: 'decimal', min: 0, max: 100, step: 'any', value: String(st.graph.max) });
  const applyRange = () => {
    const min = minIn.value.trim() === '' ? NaN : Number(minIn.value);
    const max = maxIn.value.trim() === '' ? NaN : Number(maxIn.value);
    if (isValidScore(min) && isValidScore(max) && min < max) {
      graphError = '';
      store.setSettings({ graph: { min, max } });
    } else {
      graphError = t('settings.graphInvalid');
      renderSettings(root);
    }
  };
  minIn.addEventListener('change', applyRange);
  maxIn.addEventListener('change', applyRange);

  root.replaceChildren(
    h('header', { class: 'page-head' }, h('h1', {}, t('settings.title'))),
    group(null,
      row('globe', t('settings.lang'), seg([['ja', '日本語'], ['en', 'English']], st.lang, (v) => store.setSettings({ lang: v }))),
      row('eye', t('settings.detailMode'), seg([['popup', t('settings.popup')], ['inline', t('settings.inline')]], st.detailMode, (v) => store.setSettings({ detailMode: v }))),
      row('device', t('settings.baseDevice'), baseSel),
      h('div', { class: 'set-block' },
        row('chart', t('settings.graph'), seg([['auto', t('settings.graphAuto')], ['range', t('settings.graphRange')]], st.graph.mode, (v) => {
          graphError = '';
          store.setSettings({ graph: { mode: v } });
        })),
        st.graph.mode === 'range'
          ? h('div', { class: 'range-row' },
            h('label', {}, t('settings.graphMin'), minIn),
            h('span', {}, '〜'),
            h('label', {}, t('settings.graphMax'), maxIn))
          : null,
        graphError ? h('p', { class: 'error' }, graphError) : null)),
    group(t('settings.lists'),
      ['tags', 'levels', 'devices', 'artists'].map((kind) => navRow(KIND_ICON[kind], t(KIND_LABEL[kind]), s[kind].length, () => openManage(kind)))),
    group(t('settings.backup'),
      navRow('download', t('settings.export'), null, exportBackup),
      navRow('upload', t('settings.import'), null, importBackup)),
    h('p', { class: 'muted small pad' }, t('settings.storageNote')),
    h('p', { class: 'muted small center' }, 'カラロク v1.0'));
}

// ---- リストの管理 ----

function openManage(kind) {
  let addName = '';
  let msg = '';
  const tryAdd = () => {
    const r = store.addNamed(kind, { name: addName });
    if (r.ok) {
      addName = '';
      msg = '';
    } else {
      msg = r.error === 'duplicate' ? `${t('common.exists')}: ${nameById(kind, r.existingId)}` : t('common.required');
      sheet.refresh();
    }
  };
  const sheet = openSheet({
    title: t(KIND_LABEL[kind]),
    full: true,
    render: () => {
      const items = kind === 'artists' ? sortedArtists(store.state, getLang()) : store.state[kind];
      const input = h('input', {
        class: 'input',
        value: addName,
        placeholder: t('manage.newName'),
        enterkeyhint: 'done',
        onInput: (e) => { addName = e.target.value; },
        onKeydown: (e) => { if (e.key === 'Enter' && !e.isComposing) tryAdd(); },
      });
      return h('div', {},
        h('div', { class: 'add-row' }, input,
          h('button', { type: 'button', class: 'btn primary', onClick: tryAdd, 'aria-label': t('common.add') }, icon('plus', { size: 18 }))),
        msg ? h('p', { class: 'error' }, msg) : null,
        items.length
          ? h('div', { class: 'card list' }, items.map((it) => h('div', { class: 'manage-row' },
            kind === 'artists'
              ? iconButton('star', t('field.favorite'), () => store.updateNamed('artists', it.id, { favorite: !it.favorite }), it.favorite ? 'fav on' : 'fav')
              : null,
            h('button', { type: 'button', class: 'grow manage-name', onClick: () => editItem(kind, it.id) },
              nameOf(kind, it),
              kind === 'artists' && it.aliases.length ? h('small', { class: 'sub' }, it.aliases.join(' / ')) : null),
            iconButton('trash', t('common.delete'), () => confirmDeleteNamed(kind, it.id), 'danger'))))
          : h('p', { class: 'muted pad center' }, t('manage.empty')));
    },
  });
}

function editItem(kind, id) {
  if (kind === 'artists') return editArtist(id);
  const item = store.get(kind, id);
  promptSheet({
    title: t('common.edit'),
    value: nameOf(kind, item),
    onSubmit: (name) => {
      const r = store.updateNamed(kind, id, { name });
      if (!r.ok) return r.error === 'duplicate' ? t('common.exists') : t('common.required');
      return null;
    },
  });
}

function editArtist(id) {
  const a = store.get('artists', id);
  const f = { name: a.name, aliases: [...a.aliases], favorite: a.favorite };
  let aliasText = '';
  let err = '';
  const addAlias = () => {
    const v = aliasText.trim();
    if (v && !f.aliases.includes(v)) f.aliases.push(v);
    aliasText = '';
    sheet.refresh();
  };
  const sheet = openSheet({
    title: t('common.edit'),
    render: () => h('div', { class: 'form' },
      h('div', { class: 'field' },
        h('div', { class: 'field-label' }, icon('mic', { size: 16 }), t('field.name')),
        h('input', { class: 'input', value: f.name, onInput: (e) => { f.name = e.target.value; } })),
      h('div', { class: 'field' },
        h('div', { class: 'field-label' }, icon('search', { size: 16 }), t('field.aliases')),
        f.aliases.length ? h('div', { class: 'chips' }, f.aliases.map((al) => h('span', { class: 'chip removable' }, al,
          h('button', { type: 'button', 'aria-label': t('common.delete'), onClick: () => { f.aliases = f.aliases.filter((x) => x !== al); sheet.refresh(); } }, icon('close', { size: 12 }))))) : null,
        h('div', { class: 'add-row' },
          h('input', {
            class: 'input',
            value: aliasText,
            placeholder: t('manage.aliasPlaceholder'),
            onInput: (e) => { aliasText = e.target.value; },
            onKeydown: (e) => { if (e.key === 'Enter' && !e.isComposing) addAlias(); },
          }),
          h('button', { type: 'button', class: 'btn', onClick: addAlias, 'aria-label': t('common.add') }, icon('plus', { size: 18 })))),
      h('label', { class: 'toggle-row' },
        icon('star', { size: 16, fill: f.favorite }),
        h('span', { class: 'grow' }, t('field.favorite')),
        h('input', { type: 'checkbox', class: 'switch', checked: f.favorite, onChange: (e) => { f.favorite = e.target.checked; } })),
      err ? h('p', { class: 'error' }, err) : null,
      h('button', {
        type: 'button',
        class: 'btn primary block',
        onClick: () => {
          if (aliasText.trim()) addAlias();
          const r = store.updateNamed('artists', id, f);
          if (!r.ok) {
            err = r.error === 'duplicate' ? `${t('common.exists')}: ${nameById('artists', r.existingId)}` : t('common.required');
            sheet.refresh();
          } else sheet.close();
        },
      }, t('common.save'))),
  });
}

export async function confirmDeleteNamed(kind, id) {
  const item = store.get(kind, id);
  const impact = deletionImpact(store.state, kind, id);
  const name = nameOf(kind, item);
  const n = (impact.songs ?? impact.records ?? []).length;
  let detail = null;
  if (n && (kind === 'artists' || kind === 'levels')) {
    detail = () => h('ul', { class: 'detail-list' }, impact.songs.map((s) => h('li', {}, s.title, h('small', { class: 'muted' }, ` ${nameById('artists', s.artistId)}`))));
  } else if (n && kind === 'devices') {
    detail = () => h('ul', { class: 'detail-list' }, impact.records.map((r) => h('li', {},
      store.get('songs', r.songId)?.title,
      h('small', { class: 'muted' }, ` ${formatDatetime(r.datetime)}  ${formatScore(r.score)}`))));
  }
  const ok = await confirmDialog({
    message: n ? t(`delete.${kind}`, { name, n }) : t('delete.simple', { name }),
    okLabel: t('common.delete'),
    danger: true,
    detail,
  });
  if (ok) store.deleteNamed(kind, id);
}

// ---- バックアップ ----

function exportBackup() {
  const data = JSON.stringify(store.exportData(), null, 2);
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const name = `kararoku-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(t('backup.exported'));
}

function importBackup() {
  const input = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    let data;
    try {
      data = store.parseBackup(await file.text());
    } catch {
      toast(t('backup.error'));
      return;
    }
    const sheet = openSheet({
      title: t('backup.chooseMode'),
      render: () => h('div', { class: 'menu' },
        h('button', {
          type: 'button',
          class: 'menu-item tall',
          onClick: () => { sheet.close(); store.importMerge(data); toast(t('backup.done')); },
        }, icon('layers'), h('span', {}, h('strong', {}, t('backup.merge')), h('small', {}, t('backup.mergeDesc')))),
        h('button', {
          type: 'button',
          class: 'menu-item tall danger',
          onClick: async () => {
            sheet.close();
            if (await confirmDialog({ message: t('backup.overwriteWarn'), okLabel: t('backup.overwrite'), danger: true })) {
              store.importOverwrite(data);
              toast(t('backup.done'));
            }
          },
        }, icon('download'), h('span', {}, h('strong', {}, t('backup.overwrite')), h('small', {}, t('backup.overwriteDesc'))))),
    });
  });
  document.body.append(input);
  input.click();
}
