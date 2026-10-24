import { store, nameById } from './app-store.js';
import { recordsOf, lastSung, bestScores, nowDatetime, isValidScore } from './store.js';
import { t } from './i18n.js';
import {
  h, icon, iconButton, openSheet, confirmDialog, actionMenu, promptSheet, toast, artwork,
  formatScore, formatKey, formatDatetime, formatDate,
} from './ui.js';
import { pickMylist } from './pickers.js';
import { songForm, draftFromSong, songErrorText } from './song-form.js';
import { renderChart } from './chart.js';

// グラフで選んでいる機器（曲ごと）
const chartDevice = new Map();

function initialChartDevice(songId, recs) {
  const base = store.state.settings.baseDeviceId;
  if (base && recs.some((r) => r.deviceId === base)) return base;
  return recs[0]?.deviceId ?? null;
}

export function songDetail(songId, { listId = null } = {}) {
  const s = store.state;
  const song = store.get('songs', songId);
  if (!song) return h('div');
  const recs = recordsOf(s, songId);
  const bests = bestScores(s, songId);
  const last = lastSung(s, songId);

  let dev = chartDevice.get(songId);
  if (!dev || !recs.some((r) => r.deviceId === dev)) dev = initialChartDevice(songId, recs);
  const chartDevices = s.devices.filter((d) => recs.some((r) => r.deviceId === d.id));

  const info = (iconName, label, value) => h('div', { class: 'info-row' },
    h('span', { class: 'info-label' }, icon(iconName, { size: 16 }), label),
    h('span', { class: 'info-value' }, value));

  return h('div', { class: 'detail' },
    h('div', { class: 'detail-head' },
      artwork(store.imageOf(song), 'music', 'detail-art', 32),
      h('div', { class: 'grow' },
        h('div', { class: 'detail-title' }, song.title),
        h('div', { class: 'detail-artist' }, nameById('artists', song.artistId))),
      iconButton('more', t('common.edit'), () => openSongMenu(songId, { listId }))),
    h('div', { class: 'info' },
      info('star', t('field.level'), song.levelId ? nameById('levels', song.levelId) : h('span', { class: 'muted' }, t('common.unset'))),
      info('tag', t('field.tags'), song.tagIds.length
        ? h('span', { class: 'chips' }, song.tagIds.map((id) => h('span', { class: 'chip' }, nameById('tags', id))))
        : h('span', { class: 'muted' }, t('common.none'))),
      info('key', t('field.key'), formatKey(song.key)),
      info('chart', t('field.lastSung'), last ? formatDate(last) : h('span', { class: 'muted' }, t('common.none'))),
      song.memo ? h('div', { class: 'memo' }, icon('note', { size: 16 }), h('p', {}, song.memo)) : null),

    h('div', { class: 'section-head' },
      h('h3', {}, t('detail.best')),
      h('button', { type: 'button', class: 'add-score', onClick: () => openRecordForm({ songId }), 'aria-label': t('record.add') }, icon('plus', { size: 20 }))),
    bests.size
      ? h('div', { class: 'bests' }, s.devices.filter((d) => bests.has(d.id)).map((d) => h('div', { class: 'best' },
        h('span', { class: 'best-device' }, d.name),
        h('span', { class: 'best-score' }, formatScore(bests.get(d.id))))))
      : null,

    h('div', { class: 'section-head' }, h('h3', {}, t('detail.chart'))),
    recs.length
      ? h('div', { class: 'chart-box' },
        chartDevices.length > 1
          ? h('div', { class: 'seg' }, chartDevices.map((d) => h('button', {
            type: 'button',
            class: d.id === dev ? 'on' : '',
            onClick: (e) => {
              chartDevice.set(songId, d.id);
              e.target.closest('.detail').replaceWith(songDetail(songId, { listId }));
            },
          }, d.name)))
          : h('div', { class: 'muted small' }, nameById('devices', dev)),
        renderChart(recs.filter((r) => r.deviceId === dev), s.settings.graph))
      : h('p', { class: 'muted pad center' }, t('detail.noRecords')),

    recs.length ? h('div', { class: 'section-head' }, h('h3', {}, t('detail.history'))) : null,
    recs.length
      ? h('div', { class: 'history' }, recs.map((r) => h('button', {
        type: 'button',
        class: 'history-row',
        onClick: () => openRecordForm({ songId, record: r }),
      },
      h('span', { class: 'grow' }, formatDatetime(r.datetime)),
      h('span', { class: 'muted' }, nameById('devices', r.deviceId)),
      h('span', { class: 'history-score' }, formatScore(r.score)))))
      : null);
}

export function openSongDetail(songId, opts = {}) {
  const sheet = openSheet({
    title: '',
    render: () => {
      if (!store.get('songs', songId)) {
        setTimeout(() => sheet.close());
        return h('div');
      }
      return songDetail(songId, opts);
    },
  });
  return sheet;
}

export function openSongMenu(songId, { listId = null } = {}) {
  const song = store.get('songs', songId);
  if (!song) return;
  actionMenu(song.title, [
    { icon: 'list', label: t('menu.addToMylist'), onClick: () => pickMylist(songId) },
    listId && { icon: 'minus', label: t('menu.removeFromList'), onClick: () => store.removeFromMylist(listId, songId) },
    { icon: 'edit', label: t('menu.edit'), onClick: () => openSongEdit(songId) },
    { icon: 'trash', label: t('menu.delete'), danger: true, onClick: () => confirmDeleteSong(songId) },
  ]);
}

export function openSongEdit(songId) {
  const song = store.get('songs', songId);
  if (!song) return;
  const draft = draftFromSong(song);
  const form = songForm({
    draft,
    submitLabel: t('common.save'),
    onSubmit: (d) => {
      const res = store.updateSong(songId, d);
      if (!res.ok) return songErrorText(res);
      sheet.close();
      toast(t('detail.updated'));
      return null;
    },
  });
  const sheet = openSheet({ title: t('detail.editSong'), full: true, render: () => { form.render(); return form.el; } });
}

export async function confirmDeleteSong(songId) {
  const ok = await confirmDialog({ message: t('detail.deleteSong'), okLabel: t('common.delete'), danger: true });
  if (ok) store.deleteSong(songId);
}

// 点数記録の入力。record を渡すと編集
export function openRecordForm({ songId, record = null }) {
  const st = store.state.settings;
  const f = {
    datetime: record?.datetime ?? nowDatetime(),
    deviceId: record?.deviceId ?? null,
    score: record ? String(record.score) : '',
  };
  let error = '';

  const sheet = openSheet({
    title: record ? t('record.edit') : t('record.add'),
    render: () => {
      const devices = store.state.devices;
      if (!devices.some((d) => d.id === f.deviceId)) {
        f.deviceId = devices.some((d) => d.id === st.lastDeviceId) ? st.lastDeviceId : devices[0]?.id ?? null;
      }
      if (!devices.length) {
        return h('div', { class: 'form' },
          h('p', { class: 'notice' }, icon('device', { size: 18 }), t('record.noDevices')),
          h('button', {
            type: 'button',
            class: 'btn primary block',
            onClick: () => promptSheet({
              title: t('record.addDevice'),
              onSubmit: (name) => {
                const r = store.addNamed('devices', { name });
                if (!r.ok) return r.error === 'duplicate' ? t('common.exists') : t('common.required');
                f.deviceId = r.id;
                return null;
              },
            }),
          }, t('record.addDevice')));
      }
      const dt = h('input', { class: 'input', type: 'datetime-local', step: 60, value: f.datetime, onInput: (e) => { f.datetime = e.target.value; } });
      const sel = h('select', { class: 'input', onChange: (e) => { f.deviceId = e.target.value; } },
        devices.map((d) => h('option', { value: d.id }, d.name)));
      sel.value = f.deviceId;
      const score = h('input', {
        class: 'input score-input',
        type: 'number',
        inputmode: 'decimal',
        min: 0,
        max: 100,
        step: 'any',
        value: f.score,
        placeholder: '0–100',
        onInput: (e) => { f.score = e.target.value; },
      });
      if (!record) setTimeout(() => score.focus(), 250);
      return h('div', { class: 'form' },
        h('div', { class: 'field' }, h('div', { class: 'field-label' }, icon('chart', { size: 16 }), t('field.score')), score),
        h('div', { class: 'field' }, h('div', { class: 'field-label' }, icon('device', { size: 16 }), t('field.device')), sel),
        h('div', { class: 'field' }, h('div', { class: 'field-label' }, icon('note', { size: 16 }), t('field.datetime')), dt),
        error ? h('p', { class: 'error' }, error) : null,
        h('button', { type: 'button', class: 'btn primary block', onClick: submit }, t('common.save')),
        record && h('button', {
          type: 'button',
          class: 'btn danger block',
          onClick: async () => {
            if (await confirmDialog({ message: t('detail.deleteRecord'), okLabel: t('common.delete'), danger: true })) {
              store.deleteRecord(record.id);
              sheet.close();
            }
          },
        }, t('common.delete')));
    },
  });

  function submit() {
    const text = f.score.trim();
    const score = text === '' ? NaN : Number(text);
    if (!isValidScore(score)) {
      error = t('record.scoreRange');
      sheet.refresh();
      return;
    }
    const data = { songId, deviceId: f.deviceId, datetime: f.datetime, score };
    const res = record ? store.updateRecord(record.id, data) : store.addRecord(data);
    if (!res.ok) {
      error = res.error === 'score' ? t('record.scoreRange') : t('common.required');
      sheet.refresh();
      return;
    }
    sheet.close();
  }
}
