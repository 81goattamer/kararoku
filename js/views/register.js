import { store } from '../app-store.js';
import { isValidScore, nowDatetime } from '../store.js';
import { t } from '../i18n.js';
import { openSheet, toast } from '../ui.js';
import { songForm, emptyRegisterDraft, songErrorText } from '../song-form.js';

// 入力途中の内容は、画面を閉じても残す
const draft = emptyRegisterDraft();

// 楽曲登録画面（楽曲タブの右下の＋ボタンから開く）
export function openRegisterSheet() {
  const form = songForm({
    draft,
    submitLabel: t('common.add'),
    onSubmit: (d) => {
      // 初回の点数は任意。入力したときだけ確かめる
      const text = String(d.score ?? '').trim();
      const score = text === '' ? null : Number(text);
      if (score != null && !isValidScore(score)) return t('record.scoreRange');
      if (score != null && !store.get('devices', d.deviceId)) return t('record.noDevices');
      const res = store.addSong(d);
      if (!res.ok) return songErrorText(res);
      if (score != null) store.addRecord({ songId: res.id, deviceId: d.deviceId, datetime: nowDatetime(), score });
      // アーティストと機器は続けて登録しやすいよう残す
      Object.assign(d, { ...emptyRegisterDraft(), artistId: d.artistId, deviceId: d.deviceId });
      sheet.close();
      toast(t('register.saved'));
      return null;
    },
  });
  const sheet = openSheet({ title: t('register.title'), full: true, render: () => { form.render(); return form.el; } });
  return sheet;
}
