import { store, nameById } from './app-store.js';
import { KEY_MIN, KEY_MAX } from './store.js';
import { t } from './i18n.js';
import { h, icon, formatKey } from './ui.js';
import { pickNamed } from './pickers.js';

export function emptyDraft() {
  return { title: '', artistId: null, levelId: null, tagIds: [], memo: '', key: 0 };
}

export function draftFromSong(song) {
  return { title: song.title, artistId: song.artistId, levelId: song.levelId, tagIds: [...song.tagIds], memo: song.memo, key: song.key };
}

// 削除されたアーティストなどへの参照を外す
function cleanDraft(d) {
  if (d.artistId && !store.get('artists', d.artistId)) d.artistId = null;
  if (d.levelId && !store.get('levels', d.levelId)) d.levelId = null;
  d.tagIds = d.tagIds.filter((id) => store.get('tags', id));
}

function field(iconName, label, control, required = false) {
  return h('div', { class: 'field' },
    h('div', { class: 'field-label' }, icon(iconName, { size: 16 }), label, required ? h('span', { class: 'req' }, '*') : null),
    control);
}

function pickerButton(text, placeholder, onClick) {
  return h('button', { type: 'button', class: `picker-btn ${text ? '' : 'placeholder'}`, onClick },
    h('span', { class: 'grow' }, text || placeholder), icon('chevron', { size: 18 }));
}

// draft を直接書き換える。onSubmit がエラー文を返したら表示する
export function songForm({ draft, submitLabel, onSubmit }) {
  const root = h('div', { class: 'form song-form' });
  let error = '';

  const render = () => {
    cleanDraft(draft);
    const title = h('input', {
      class: 'input',
      value: draft.title,
      placeholder: t('field.title'),
      enterkeyhint: 'done',
      onInput: (e) => { draft.title = e.target.value; },
    });
    const memo = h('textarea', {
      class: 'input',
      rows: 3,
      value: draft.memo,
      placeholder: t('register.memoPlaceholder'),
      onInput: (e) => { draft.memo = e.target.value; },
    });
    const tagNames = draft.tagIds.map((id) => nameById('tags', id));
    const stepKey = (d) => {
      draft.key = Math.min(KEY_MAX, Math.max(KEY_MIN, draft.key + d));
      render();
    };
    root.replaceChildren(...[
      field('music', t('field.title'), title, true),
      field('mic', t('field.artist'), pickerButton(nameById('artists', draft.artistId), t('register.chooseArtist'), () => pickNamed({
        kind: 'artists',
        selected: draft.artistId,
        onPick: (id) => { draft.artistId = id; render(); },
      })), true),
      field('star', t('field.level'), pickerButton(draft.levelId ? nameById('levels', draft.levelId) : '', t('common.unset'), () => pickNamed({
        kind: 'levels',
        selected: draft.levelId,
        allowNone: true,
        onPick: (id) => { draft.levelId = id; render(); },
      }))),
      field('tag', t('field.tags'), h('button', {
        type: 'button',
        class: `picker-btn ${tagNames.length ? '' : 'placeholder'}`,
        onClick: () => pickNamed({ kind: 'tags', multi: true, selected: draft.tagIds, onPick: (ids) => { draft.tagIds = ids; render(); } }),
      }, h('span', { class: 'grow chips' }, tagNames.length ? tagNames.map((n) => h('span', { class: 'chip' }, n)) : t('common.none')),
      icon('chevron', { size: 18 }))),
      field('note', t('field.memo'), memo),
      field('key', t('field.key'), h('div', { class: 'stepper' },
        h('button', { type: 'button', class: 'step-btn', disabled: draft.key <= KEY_MIN, onClick: () => stepKey(-1), 'aria-label': '-1' }, icon('minus', { size: 18 })),
        h('span', { class: 'step-value' }, formatKey(draft.key)),
        h('button', { type: 'button', class: 'step-btn', disabled: draft.key >= KEY_MAX, onClick: () => stepKey(1), 'aria-label': '+1' }, icon('plus', { size: 18 })),
        draft.key !== 0 ? h('button', { type: 'button', class: 'text-btn', onClick: () => { draft.key = 0; render(); } }, '0') : null)),
      error ? h('p', { class: 'error' }, error) : null,
      h('button', {
        type: 'button',
        class: 'btn primary block',
        onClick: () => {
          error = onSubmit(draft) ?? '';
          render();
        },
      }, submitLabel)].filter(Boolean));
  };

  render();
  return { el: root, render };
}

export function songErrorText(res) {
  if (res.error === 'duplicate') return t('register.duplicate');
  return t('common.required');
}
