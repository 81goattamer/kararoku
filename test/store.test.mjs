import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Store, normalize, sortSongs, filterSongs, NO_LEVEL, lastSung, bestScore, levelName, recordsOf,
} from '../js/store.js';

class MemStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.get(k) ?? null; }
  setItem(k, v) { this.m.set(k, v); }
}

function setup() {
  const st = new Store({ storage: new MemStorage() });
  const a = st.addNamed('artists', { name: 'YOASOBI', aliases: ['よあそび'] }).id;
  const dev = st.addNamed('devices', { name: 'DAM' }).id;
  const lv = st.state.levels[0].id;
  return { st, a, dev, lv };
}

test('normalize ignores case, width and spaces', () => {
  assert.equal(normalize('Ｙｏａｓｏｂｉ '), normalize('yoa sobi'));
  assert.equal(normalize('ｱｲﾄﾞﾙ'), normalize('アイドル'));
  assert.notEqual(normalize('あいどる'), normalize('アイドル'));
});

test('song duplicate check by title + artist', () => {
  const { st, a, lv } = setup();
  assert.ok(st.addSong({ title: 'アイドル', artistId: a, levelId: lv }).ok);
  const r = st.addSong({ title: 'ｱｲﾄﾞﾙ ', artistId: a });
  assert.equal(r.error, 'duplicate');
  const b = st.addNamed('artists', { name: 'Other' }).id;
  assert.ok(st.addSong({ title: 'アイドル', artistId: b }).ok);
  const id = st.addSong({ title: '夜に駆ける', artistId: a }).id;
  assert.equal(st.updateSong(id, { title: 'アイドル', artistId: a }).error, 'duplicate');
});

test('level is optional', () => {
  const { st, a } = setup();
  const id = st.addSong({ title: 'x', artistId: a }).id;
  assert.equal(st.get('songs', id).levelId, null);
});

test('named duplicate check, including builtin level names in both languages', () => {
  const { st } = setup();
  assert.equal(st.addNamed('artists', { name: 'ｙｏａｓｏｂｉ' }).error, 'duplicate');
  assert.equal(st.addNamed('levels', { name: 'perfect' }).error, 'duplicate');
  assert.equal(st.addNamed('levels', { name: '完璧' }).error, 'duplicate');
  assert.equal(st.addNamed('devices', { name: 'dam' }).error, 'duplicate');
  st.addNamed('mylists', { name: 'A' });
  assert.equal(st.addNamed('mylists', { name: 'ａ' }).error, 'duplicate');
});

test('builtin level keeps translating until renamed', () => {
  const { st, lv } = setup();
  const l = st.get('levels', lv);
  assert.equal(levelName(l, 'en'), 'Perfect');
  st.updateNamed('levels', lv, { name: '完璧' });
  assert.equal(levelName(l, 'en'), 'Perfect');
  st.updateNamed('levels', lv, { name: 'ばっちり' });
  assert.equal(levelName(l, 'en'), 'ばっちり');
});

test('deleting artist removes songs, records and mylist entries', () => {
  const { st, a, dev } = setup();
  const s = st.addSong({ title: 'x', artistId: a }).id;
  st.addRecord({ songId: s, deviceId: dev, datetime: '2026-01-01T10:00', score: 90 });
  const m = st.addNamed('mylists', { name: 'L' }).id;
  st.addToMylist(m, [s]);
  st.deleteNamed('artists', a);
  assert.equal(st.state.songs.length, 0);
  assert.equal(st.state.records.length, 0);
  assert.deepEqual(st.get('mylists', m).songIds, []);
});

test('deleting level keeps songs with unset level', () => {
  const { st, a, lv } = setup();
  const s = st.addSong({ title: 'x', artistId: a, levelId: lv }).id;
  st.deleteNamed('levels', lv);
  assert.equal(st.get('songs', s).levelId, null);
  assert.equal(filterSongs(st.state, st.state.songs, { levelIds: [NO_LEVEL] }).length, 1);
});

test('deleting device removes only its records and clears base device', () => {
  const { st, a, dev } = setup();
  const s = st.addSong({ title: 'x', artistId: a }).id;
  st.addRecord({ songId: s, deviceId: dev, datetime: '2026-01-01T10:00', score: 90 });
  st.setSettings({ baseDeviceId: dev });
  st.deleteNamed('devices', dev);
  assert.equal(st.state.records.length, 0);
  assert.equal(st.state.songs.length, 1);
  assert.equal(st.state.settings.baseDeviceId, null);
  assert.equal(st.state.settings.lastDeviceId, null);
});

test('score validation and best / last sung', () => {
  const { st, a, dev } = setup();
  const s = st.addSong({ title: 'x', artistId: a }).id;
  assert.equal(st.addRecord({ songId: s, deviceId: dev, datetime: '2026-01-01T10:00', score: 100.5 }).error, 'score');
  st.addRecord({ songId: s, deviceId: dev, datetime: '2026-01-01T10:00', score: 88.123 });
  st.addRecord({ songId: s, deviceId: dev, datetime: '2026-02-01T10:00', score: 80 });
  assert.equal(bestScore(st.state, s, dev), 88.123);
  assert.equal(lastSung(st.state, s), '2026-02-01T10:00');
  assert.equal(recordsOf(st.state, s)[0].score, 80);
});

test('mylist rejects duplicates', () => {
  const { st, a } = setup();
  const s = st.addSong({ title: 'x', artistId: a }).id;
  const m = st.addNamed('mylists', { name: 'L' }).id;
  assert.deepEqual(st.addToMylist(m, [s]), { added: 1, already: 0 });
  assert.deepEqual(st.addToMylist(m, [s]), { added: 0, already: 1 });
});

test('sort: songs without records stay last in both directions', () => {
  const { st, a, dev } = setup();
  const s1 = st.addSong({ title: 'a', artistId: a }).id;
  const s2 = st.addSong({ title: 'b', artistId: a }).id;
  const s3 = st.addSong({ title: 'c', artistId: a }).id;
  st.addRecord({ songId: s1, deviceId: dev, datetime: '2026-01-01T10:00', score: 70 });
  st.addRecord({ songId: s3, deviceId: dev, datetime: '2026-03-01T10:00', score: 90 });
  st.setSettings({ baseDeviceId: dev });
  const ids = (sort, dir) => sortSongs(st.state, st.state.songs, sort, dir, 'ja').map((x) => x.id);
  assert.deepEqual(ids('recent', 'desc'), [s3, s1, s2]);
  assert.deepEqual(ids('recent', 'asc'), [s1, s3, s2]);
  assert.deepEqual(ids('best', 'desc'), [s3, s1, s2]);
  assert.deepEqual(ids('best', 'asc'), [s1, s3, s2]);
});

test('filter: search by alias, tags AND/OR', () => {
  const { st, a } = setup();
  const t1 = st.addNamed('tags', { name: 't1' }).id;
  const t2 = st.addNamed('tags', { name: 't2' }).id;
  st.addSong({ title: 'x', artistId: a, tagIds: [t1, t2] });
  st.addSong({ title: 'y', artistId: a, tagIds: [t1] });
  const f = (o) => filterSongs(st.state, st.state.songs, o).length;
  assert.equal(f({ q: 'ヨアソビ' }), 0);
  assert.equal(f({ q: 'よあ' }), 2);
  assert.equal(f({ tagIds: [t1, t2], tagMode: 'and' }), 1);
  assert.equal(f({ tagIds: [t1, t2], tagMode: 'or' }), 2);
});

test('backup round trip: overwrite and merge', () => {
  const { st, a, dev, lv } = setup();
  const s = st.addSong({ title: 'x', artistId: a, levelId: lv }).id;
  st.addRecord({ songId: s, deviceId: dev, datetime: '2026-01-01T10:00', score: 90 });
  const m = st.addNamed('mylists', { name: 'L' }).id;
  st.addToMylist(m, [s]);
  const text = JSON.stringify(st.exportData());

  const other = new Store({ storage: new MemStorage() });
  other.importOverwrite(other.parseBackup(text));
  assert.equal(other.state.songs.length, 1);
  assert.equal(other.state.records.length, 1);

  // 統合: 同じ曲は1曲のまま、同じ記録は1件、新しい記録は追加
  const b = new Store({ storage: new MemStorage() });
  const ba = b.addNamed('artists', { name: 'ｙｏａｓｏｂｉ' }).id;
  const bd = b.addNamed('devices', { name: 'DAM' }).id;
  const bs = b.addSong({ title: 'X', artistId: ba, memo: 'keep' }).id;
  b.addRecord({ songId: bs, deviceId: bd, datetime: '2026-01-01T10:00', score: 90 });
  b.addRecord({ songId: bs, deviceId: bd, datetime: '2026-05-01T10:00', score: 95 });
  const bm = b.addNamed('mylists', { name: 'l' }).id;
  const extra = b.addSong({ title: 'Y', artistId: ba }).id;
  b.addToMylist(bm, [extra]);
  b.importMerge(b.parseBackup(text));
  assert.equal(b.state.artists.length, 1);
  assert.equal(b.state.songs.length, 2);
  assert.equal(b.get('songs', bs).memo, 'keep');
  assert.equal(b.state.records.length, 2);
  assert.equal(b.state.levels.length, 4);
  assert.equal(b.state.mylists.length, 1);
  assert.deepEqual(b.get('mylists', bm).songIds, [extra, bs]);
});

test('broken backup throws and leaves data unchanged', () => {
  const { st } = setup();
  const before = JSON.stringify(st.state);
  assert.throws(() => st.parseBackup('{'));
  assert.throws(() => st.parseBackup('{"app":"other"}'));
  assert.equal(JSON.stringify(st.state), before);
});
