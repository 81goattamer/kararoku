// アプリアイコン（PNG）を生成する: node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}

// 0..1 の座標で、マイクの形（白）までの距離
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.abs(x - cx) - hw + r, dy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
};
function micDist(x, y) {
  const head = sdRoundRect(x, y, 0.5, 0.40, 0.12, 0.19, 0.12);
  // U字のスタンド
  const ring = Math.abs(Math.hypot(x - 0.5, y - 0.44) - 0.21) - 0.028;
  const ringCut = y < 0.44 ? 1 : ring;
  const stem = sdRoundRect(x, y, 0.5, 0.715, 0.028, 0.06, 0.02);
  const base = sdRoundRect(x, y, 0.5, 0.78, 0.12, 0.028, 0.028);
  return Math.min(head, ringCut, stem, base);
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c1 = [232, 70, 93], c2 = [255, 154, 98];
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size, y = (py + 0.5) / size;
      const t = Math.min(1, Math.max(0, (x + y) / 2));
      let col = c1.map((v, i) => v + (c2[i] - v) * t);
      const aa = 1.2 / size;
      const d = micDist(x, y);
      const w = Math.min(1, Math.max(0, 0.5 - d / aa));
      col = col.map((v) => v + (255 - v) * w);
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const s of [180, 192, 512]) writeFileSync(new URL(`../icons/icon-${s}.png`, import.meta.url), png(s));
