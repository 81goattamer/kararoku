// カラロクのデータ層。DOMに依存しないので Node からもテストできる。

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'kararoku:data';
export const KEY_MIN = -12;
export const KEY_MAX = 12;

// 初期の完成度。name が null の間は言語に合わせて表示名を切り替える。
export const BUILTIN_LEVELS = {
  perfect: { ja: '完璧', en: 'Perfect' },
  unsure: { ja: '自信がないが歌える', en: 'Can sing, not confident' },
  chorus: { ja: 'サビは完璧', en: 'Chorus is perfect' },
  vague: { ja: 'うろ覚え', en: 'Barely remember' },
};

const NAMED_KINDS = ['artists', 'levels', 'tags', 'devices', 'mylists'];

// 完成度の絞り込みで「未設定」を表す値
export const NO_LEVEL = '__none__';

// 大文字・小文字、全角・半角、スペースの違いを無視して比較するための正規化
export function normalize(s) {
  return String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function levelName(level, lang) {
  if (level.name != null) return level.name;
  return BUILTIN_LEVELS[level.key]?.[lang] ?? BUILTIN_LEVELS[level.key]?.ja ?? '';
}

export function itemName(kind, item, lang) {
  return kind === 'levels' ? levelName(item, lang) : item.name;
}

function namesOf(kind, item) {
  if (kind === 'levels' && item.name == null && BUILTIN_LEVELS[item.key]) {
    return Object.values(BUILTIN_LEVELS[item.key]);
  }
  return [item.name];
}

function sameNamed(kind, a, b) {
  if (kind === 'levels' && a.key && a.key === b.key) return true;
  const na = namesOf(kind, a).map(normalize);
  return namesOf(kind, b).some((x) => na.includes(normalize(x)));
}

export function defaultSettings(lang = 'ja') {
  return {
    lang,
    detailMode: 'popup',
    baseDeviceId: null,
    graph: { mode: 'auto', min: 0, max: 100 },
    lastDeviceId: null,
  };
}

export function defaultState(lang = 'ja') {
  return {
    songs: [],
    records: [],
    artists: [],
    levels: Object.keys(BUILTIN_LEVELS).map((key) => ({ id: uid(), key, name: null })),
    tags: [],
    devices: [],
    mylists: [],
    settings: defaultSettings(lang),
  };
}

export function isValidScore(score) {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
}

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function nowDatetime(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 日時は分単位で扱う（秒以下は切り捨てる）
export function toMinute(s) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(String(s ?? ''));
  return m ? `${m[1]}T${m[2]}` : null;
}

// 読み込んだデータの形を整え、壊れた参照を取り除く
export function sanitize(raw, lang = 'ja') {
  if (!raw || typeof raw !== 'object') throw new Error('invalid');
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v) => (typeof v === 'string' ? v : '');
  const seen = new Set();
  const idOk = (v) => typeof v === 'string' && v !== '' && !seen.has(v) && seen.add(v);

  const s = { songs: [], records: [], artists: [], levels: [], tags: [], devices: [], mylists: [] };

  for (const a of arr(raw.artists)) {
    if (!idOk(a?.id) || !str(a.name).trim()) continue;
    s.artists.push({
      id: a.id,
      name: str(a.name).trim(),
      aliases: arr(a.aliases).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()),
      favorite: !!a.favorite,
    });
  }
  for (const l of arr(raw.levels)) {
    if (!idOk(l?.id)) continue;
    const key = BUILTIN_LEVELS[l.key] ? l.key : null;
    const name = typeof l.name === 'string' && l.name.trim() ? l.name.trim() : null;
    if (!key && !name) continue;
    s.levels.push({ id: l.id, key, name });
  }
  if (s.levels.length === 0) s.levels = defaultState().levels;
  for (const kind of ['tags', 'devices']) {
    for (const t of arr(raw[kind])) {
      if (!idOk(t?.id) || !str(t.name).trim()) continue;
      s[kind].push({ id: t.id, name: str(t.name).trim() });
    }
  }

  const has = (kind, id) => s[kind].some((x) => x.id === id);
  for (const so of arr(raw.songs)) {
    if (!idOk(so?.id) || !str(so.title).trim()) continue;
    if (!has('artists', so.artistId)) continue;
    const key = Number.isInteger(so.key) ? Math.min(KEY_MAX, Math.max(KEY_MIN, so.key)) : 0;
    s.songs.push({
      id: so.id,
      title: str(so.title).trim(),
      artistId: so.artistId,
      levelId: has('levels', so.levelId) ? so.levelId : null,
      tagIds: [...new Set(arr(so.tagIds).filter((t) => has('tags', t)))],
      memo: str(so.memo),
      key,
    });
  }
  for (const r of arr(raw.records)) {
    if (!idOk(r?.id) || !has('songs', r.songId) || !has('devices', r.deviceId)) continue;
    const datetime = toMinute(r.datetime);
    if (!datetime || !isValidScore(r.score)) continue;
    s.records.push({ id: r.id, songId: r.songId, deviceId: r.deviceId, datetime, score: r.score });
  }
  for (const m of arr(raw.mylists)) {
    if (!idOk(m?.id) || !str(m.name).trim()) continue;
    s.mylists.push({
      id: m.id,
      name: str(m.name).trim(),
      songIds: [...new Set(arr(m.songIds).filter((id) => has('songs', id)))],
    });
  }

  const rs = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const def = defaultSettings(lang);
  const g = rs.graph && typeof rs.graph === 'object' ? rs.graph : {};
  const gmin = Number(g.min);
  const gmax = Number(g.max);
  const rangeOk = isValidScore(gmin) && isValidScore(gmax) && gmin < gmax;
  s.settings = {
    lang: rs.lang === 'en' || rs.lang === 'ja' ? rs.lang : def.lang,
    detailMode: rs.detailMode === 'inline' ? 'inline' : 'popup',
    baseDeviceId: has('devices', rs.baseDeviceId) ? rs.baseDeviceId : null,
    graph: {
      mode: g.mode === 'range' && rangeOk ? 'range' : 'auto',
      min: rangeOk ? gmin : def.graph.min,
      max: rangeOk ? gmax : def.graph.max,
    },
    lastDeviceId: has('devices', rs.lastDeviceId) ? rs.lastDeviceId : null,
  };
  return s;
}

// ---- 参照系（状態を受け取る純粋関数） ----

export function recordsOf(state, songId) {
  return state.records
    .filter((r) => r.songId === songId)
    .sort((a, b) => (a.datetime < b.datetime ? 1 : a.datetime > b.datetime ? -1 : 0));
}

export function lastSung(state, songId) {
  let last = null;
  for (const r of state.records) if (r.songId === songId && (last === null || r.datetime > last)) last = r.datetime;
  return last;
}

export function bestScores(state, songId) {
  const map = new Map();
  for (const r of state.records) {
    if (r.songId !== songId) continue;
    if (!map.has(r.deviceId) || r.score > map.get(r.deviceId)) map.set(r.deviceId, r.score);
  }
  return map;
}

export function bestScore(state, songId, deviceId) {
  return bestScores(state, songId).get(deviceId) ?? null;
}

export function findDuplicateSong(state, title, artistId, exceptId = null) {
  const n = normalize(title);
  return state.songs.find((s) => s.id !== exceptId && s.artistId === artistId && normalize(s.title) === n) ?? null;
}

export function findByName(state, kind, name, exceptId = null) {
  const probe = { name, key: null };
  return state[kind].find((it) => it.id !== exceptId && sameNamed(kind, it, probe)) ?? null;
}

export function sortedArtists(state, lang) {
  const col = new Intl.Collator(lang);
  return [...state.artists].sort((a, b) => (b.favorite - a.favorite) || col.compare(a.name, b.name));
}

export function artistMatches(artist, q) {
  const n = normalize(q);
  if (!n) return true;
  return [artist.name, ...artist.aliases].some((x) => normalize(x).includes(n));
}

// 検索・絞り込み。tagMode は 'and' | 'or'
export function filterSongs(state, songs, { q = '', tagIds = [], tagMode = 'and', levelIds = [] } = {}) {
  const n = normalize(q);
  const artists = new Map(state.artists.map((a) => [a.id, a]));
  return songs.filter((s) => {
    if (levelIds.length && !levelIds.includes(s.levelId ?? NO_LEVEL)) return false;
    if (tagIds.length) {
      const ok = tagMode === 'or' ? tagIds.some((t) => s.tagIds.includes(t)) : tagIds.every((t) => s.tagIds.includes(t));
      if (!ok) return false;
    }
    if (n) {
      const a = artists.get(s.artistId);
      if (!normalize(s.title).includes(n) && !(a && artistMatches(a, q))) return false;
    }
    return true;
  });
}

export const DEFAULT_DIR = { title: 'asc', artist: 'asc', recent: 'desc', best: 'desc' };

// 記録がない曲は向きに関係なく末尾。同じ値の曲は曲名順。
export function sortSongs(state, songs, sort, dir, lang) {
  const col = new Intl.Collator(lang);
  const artists = new Map(state.artists.map((a) => [a.id, a.name]));
  const sign = dir === 'desc' ? -1 : 1;
  const byTitle = (a, b) => col.compare(a.title, b.title);
  let keyOf = null;
  if (sort === 'recent') keyOf = (s) => lastSung(state, s.id);
  if (sort === 'best') keyOf = (s) => bestScore(state, s.id, state.settings.baseDeviceId);
  const keyed = songs.map((s) => ({ s, k: keyOf ? keyOf(s) : null }));
  keyed.sort((x, y) => {
    const a = x.s;
    const b = y.s;
    if (sort === 'title') return sign * byTitle(a, b) || col.compare(artists.get(a.artistId) ?? '', artists.get(b.artistId) ?? '');
    if (sort === 'artist') return sign * col.compare(artists.get(a.artistId) ?? '', artists.get(b.artistId) ?? '') || byTitle(a, b);
    if (x.k === null && y.k === null) return byTitle(a, b);
    if (x.k === null) return 1;
    if (y.k === null) return -1;
    const c = x.k < y.k ? -1 : x.k > y.k ? 1 : 0;
    return sign * c || byTitle(a, b);
  });
  return keyed.map((x) => x.s);
}

// 削除の影響範囲（4.9）。アーティストは楽曲ごと消え、完成度は楽曲が未設定になる
export function deletionImpact(state, kind, id) {
  if (kind === 'artists') return { songs: state.songs.filter((s) => s.artistId === id) };
  if (kind === 'levels') return { songs: state.songs.filter((s) => s.levelId === id) };
  if (kind === 'devices') return { records: state.records.filter((r) => r.deviceId === id) };
  if (kind === 'tags') return { songs: state.songs.filter((s) => s.tagIds.includes(id)) };
  return {};
}

export function shuffle(items, rand = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- 更新系 ----

export class Store {
  constructor({ storage = null, lang = 'ja' } = {}) {
    this.storage = storage;
    this.lang = lang;
    this.listeners = new Set();
    this.state = this.load();
  }

  load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) return sanitize(JSON.parse(raw).data, this.lang);
    } catch {
      // 壊れていたら初期状態で始める
    }
    return defaultState(this.lang);
  }

  save() {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, data: this.state }));
    for (const fn of this.listeners) fn(this.state);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get(kind, id) {
    return this.state[kind].find((x) => x.id === id) ?? null;
  }

  // ---- 楽曲 ----

  validateSong(f, exceptId = null) {
    if (!String(f.title ?? '').trim()) return { ok: false, error: 'required' };
    if (!this.get('artists', f.artistId)) return { ok: false, error: 'required' };
    const dup = findDuplicateSong(this.state, f.title, f.artistId, exceptId);
    if (dup) return { ok: false, error: 'duplicate', existingId: dup.id };
    return { ok: true };
  }

  songFields(f) {
    const key = Number.isInteger(f.key) ? Math.min(KEY_MAX, Math.max(KEY_MIN, f.key)) : 0;
    return {
      title: String(f.title).trim(),
      artistId: f.artistId,
      levelId: this.get('levels', f.levelId) ? f.levelId : null,
      tagIds: [...new Set((f.tagIds ?? []).filter((t) => this.get('tags', t)))],
      memo: String(f.memo ?? ''),
      key,
    };
  }

  addSong(f) {
    const v = this.validateSong(f);
    if (!v.ok) return v;
    const song = { id: uid(), ...this.songFields(f) };
    this.state.songs.push(song);
    this.save();
    return { ok: true, id: song.id };
  }

  updateSong(id, f) {
    const song = this.get('songs', id);
    if (!song) return { ok: false, error: 'missing' };
    const v = this.validateSong(f, id);
    if (!v.ok) return v;
    Object.assign(song, this.songFields(f));
    this.save();
    return { ok: true, id };
  }

  removeSongs(ids) {
    const set = new Set(ids);
    if (!set.size) return;
    this.state.songs = this.state.songs.filter((s) => !set.has(s.id));
    this.state.records = this.state.records.filter((r) => !set.has(r.songId));
    for (const m of this.state.mylists) m.songIds = m.songIds.filter((id) => !set.has(id));
  }

  deleteSong(id) {
    this.removeSongs([id]);
    this.save();
  }

  // ---- 点数記録 ----

  validateRecord(f) {
    if (!this.get('songs', f.songId) || !this.get('devices', f.deviceId)) return { ok: false, error: 'required' };
    if (!toMinute(f.datetime)) return { ok: false, error: 'datetime' };
    if (!isValidScore(f.score)) return { ok: false, error: 'score' };
    return { ok: true };
  }

  addRecord(f) {
    const v = this.validateRecord(f);
    if (!v.ok) return v;
    const rec = { id: uid(), songId: f.songId, deviceId: f.deviceId, datetime: toMinute(f.datetime), score: f.score };
    this.state.records.push(rec);
    this.state.settings.lastDeviceId = f.deviceId;
    this.save();
    return { ok: true, id: rec.id };
  }

  updateRecord(id, f) {
    const rec = this.get('records', id);
    if (!rec) return { ok: false, error: 'missing' };
    const v = this.validateRecord({ ...f, songId: rec.songId });
    if (!v.ok) return v;
    Object.assign(rec, { deviceId: f.deviceId, datetime: toMinute(f.datetime), score: f.score });
    this.state.settings.lastDeviceId = f.deviceId;
    this.save();
    return { ok: true, id };
  }

  deleteRecord(id) {
    this.state.records = this.state.records.filter((r) => r.id !== id);
    this.save();
  }

  // ---- 名前つきリスト（アーティスト・完成度・タグ・機器・マイリスト） ----

  addNamed(kind, fields) {
    if (!NAMED_KINDS.includes(kind)) throw new Error(kind);
    const name = String(fields.name ?? '').trim();
    if (!name) return { ok: false, error: 'required' };
    const dup = findByName(this.state, kind, name);
    if (dup) return { ok: false, error: 'duplicate', existingId: dup.id };
    const item = { id: uid(), name };
    if (kind === 'artists') Object.assign(item, { aliases: cleanAliases(fields.aliases), favorite: !!fields.favorite });
    if (kind === 'levels') item.key = null;
    if (kind === 'mylists') item.songIds = [];
    this.state[kind].push(item);
    this.save();
    return { ok: true, id: item.id };
  }

  updateNamed(kind, id, fields) {
    const item = this.get(kind, id);
    if (!item) return { ok: false, error: 'missing' };
    if ('name' in fields) {
      const name = String(fields.name ?? '').trim();
      if (!name) return { ok: false, error: 'required' };
      const dup = findByName(this.state, kind, name, id);
      if (dup) return { ok: false, error: 'duplicate', existingId: dup.id };
      // 初期の完成度は、名前が変わったときだけ固定の名前にする
      if (!(kind === 'levels' && item.name == null && namesOf(kind, item).includes(name))) item.name = name;
    }
    if (kind === 'artists') {
      if ('aliases' in fields) item.aliases = cleanAliases(fields.aliases);
      if ('favorite' in fields) item.favorite = !!fields.favorite;
    }
    this.save();
    return { ok: true, id };
  }

  deleteNamed(kind, id) {
    const s = this.state;
    if (kind === 'artists') {
      this.removeSongs(deletionImpact(s, kind, id).songs.map((x) => x.id));
    } else if (kind === 'levels') {
      for (const so of s.songs) if (so.levelId === id) so.levelId = null;
    } else if (kind === 'devices') {
      s.records = s.records.filter((r) => r.deviceId !== id);
      if (s.settings.baseDeviceId === id) s.settings.baseDeviceId = null;
      if (s.settings.lastDeviceId === id) s.settings.lastDeviceId = null;
    } else if (kind === 'tags') {
      for (const so of s.songs) so.tagIds = so.tagIds.filter((t) => t !== id);
    }
    s[kind] = s[kind].filter((x) => x.id !== id);
    this.save();
    return { ok: true };
  }

  // ---- マイリスト ----

  addToMylist(listId, songIds) {
    const list = this.get('mylists', listId);
    if (!list) return { added: 0, already: 0 };
    let added = 0;
    let already = 0;
    for (const id of songIds) {
      if (!this.get('songs', id)) continue;
      if (list.songIds.includes(id)) already++;
      else {
        list.songIds.push(id);
        added++;
      }
    }
    if (added) this.save();
    return { added, already };
  }

  removeFromMylist(listId, songId) {
    const list = this.get('mylists', listId);
    if (!list) return;
    list.songIds = list.songIds.filter((id) => id !== songId);
    this.save();
  }

  reorderMylist(listId, songIds) {
    const list = this.get('mylists', listId);
    if (!list) return;
    const cur = new Set(list.songIds);
    const next = songIds.filter((id) => cur.has(id));
    if (next.length !== list.songIds.length) return;
    list.songIds = next;
    this.save();
  }

  // ---- 設定 ----

  setSettings(patch) {
    const st = this.state.settings;
    if (patch.graph) patch = { ...patch, graph: { ...st.graph, ...patch.graph } };
    Object.assign(st, patch);
    this.save();
  }

  // ---- バックアップ ----

  exportData() {
    return { app: 'kararoku', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: structuredClone(this.state) };
  }

  // 失敗したら例外を投げ、データは何も変えない
  parseBackup(text) {
    const obj = JSON.parse(text);
    if (obj?.app !== 'kararoku' || typeof obj.version !== 'number' || obj.version > SCHEMA_VERSION) throw new Error('format');
    return sanitize(obj.data, this.lang);
  }

  importOverwrite(data) {
    this.state = structuredClone(data);
    this.save();
  }

  importMerge(incoming) {
    const s = this.state;
    const maps = {};
    for (const kind of ['artists', 'levels', 'tags', 'devices']) {
      maps[kind] = new Map();
      for (const item of incoming[kind]) {
        const ex = s[kind].find((e) => sameNamed(kind, e, item));
        if (ex) maps[kind].set(item.id, ex.id);
        else {
          const copy = { ...structuredClone(item), id: uid() };
          s[kind].push(copy);
          maps[kind].set(item.id, copy.id);
        }
      }
    }
    const songMap = new Map();
    for (const so of incoming.songs) {
      const artistId = maps.artists.get(so.artistId);
      const dup = findDuplicateSong(s, so.title, artistId);
      if (dup) {
        songMap.set(so.id, dup.id);
        continue;
      }
      const copy = {
        ...structuredClone(so),
        id: uid(),
        artistId,
        levelId: so.levelId ? maps.levels.get(so.levelId) : null,
        tagIds: so.tagIds.map((t) => maps.tags.get(t)),
      };
      s.songs.push(copy);
      songMap.set(so.id, copy.id);
    }
    for (const r of incoming.records) {
      const songId = songMap.get(r.songId);
      const deviceId = maps.devices.get(r.deviceId);
      const same = s.records.some(
        (x) => x.songId === songId && x.deviceId === deviceId && x.datetime === r.datetime && x.score === r.score,
      );
      if (!same) s.records.push({ id: uid(), songId, deviceId, datetime: r.datetime, score: r.score });
    }
    for (const m of incoming.mylists) {
      const ids = m.songIds.map((id) => songMap.get(id));
      const ex = s.mylists.find((e) => sameNamed('mylists', e, m));
      if (ex) {
        for (const id of ids) if (!ex.songIds.includes(id)) ex.songIds.push(id);
      } else {
        s.mylists.push({ id: uid(), name: m.name, songIds: [...new Set(ids)] });
      }
    }
    this.save();
  }
}

function cleanAliases(list) {
  const out = [];
  for (const a of list ?? []) {
    const t = String(a).trim();
    if (t && !out.some((x) => normalize(x) === normalize(t))) out.push(t);
  }
  return out;
}
