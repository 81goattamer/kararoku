import { store } from '../app-store.js';
import { t } from '../i18n.js';
import { h, toast } from '../ui.js';
import { songForm, emptyDraft, songErrorText } from '../song-form.js';

// 入力途中の内容は、タブを切り替えても残す
const draft = emptyDraft();

export function renderRegister(root) {
  const form = songForm({
    draft,
    submitLabel: t('common.add'),
    onSubmit: (d) => {
      const res = store.addSong(d);
      if (!res.ok) return songErrorText(res);
      // アーティストは続けて同じ人の曲を登録しやすいよう残す
      Object.assign(d, { ...emptyDraft(), artistId: d.artistId });
      toast(t('register.saved'));
      return null;
    },
  });
  root.replaceChildren(
    h('header', { class: 'page-head' }, h('h1', {}, t('register.title'))),
    h('div', { class: 'card pad-lg' }, form.el));
}
