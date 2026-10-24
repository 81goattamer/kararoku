// 画像（ジャケット・マイリストの写真）の保存先。
// localStorage は容量が小さいので IndexedDB に置き、起動時に全部メモリへ読み込んで同期的に使う。
import { memoryImages } from './store.js';

const DB_NAME = 'kararoku';
const STORE = 'images';
const SIZE = 512;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAll(db) {
  return new Promise((resolve, reject) => {
    const out = new Map();
    const req = db.transaction(STORE).objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve(out);
      out.set(cur.key, cur.value);
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

// IndexedDB が使えない環境（一部のプライベートブラウズなど）ではメモリだけで動く
export async function loadImageRepo() {
  const mem = memoryImages();
  let db = null;
  try {
    db = await openDb();
    for (const [id, data] of await readAll(db)) mem.set(id, data);
  } catch {
    db = null;
  }
  const write = (fn) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE, 'readwrite');
      fn(tx.objectStore(STORE));
      tx.onerror = () => console.error('image save failed', tx.error);
    } catch (e) {
      console.error('image save failed', e);
    }
  };
  return {
    ...mem,
    set(id, data) { mem.set(id, data); write((s) => s.put(data, id)); },
    delete(id) { mem.delete(id); write((s) => s.delete(id)); },
    clear() { mem.clear(); write((s) => s.clear()); },
  };
}

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // 下の Image で読み直す
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 写真を選ばせ、中央を正方形に切り抜いて縮小した JPEG の data URL を渡す。キャンセル時は何もしない
export function pickImage(onPicked, onError) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    try {
      const src = await decode(file);
      const w = src.width;
      const h = src.height;
      const side = Math.min(w, h);
      const out = Math.min(SIZE, side);
      const canvas = document.createElement('canvas');
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, out, out);
      ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out);
      src.close?.();
      onPicked(canvas.toDataURL('image/jpeg', 0.85));
    } catch {
      onError?.();
    }
  });
  document.body.append(input);
  input.click();
}
