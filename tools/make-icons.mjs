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

// 0..1 の座標で、音符（♪）までの距離
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.abs(x - cx) - hw + r, dy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
};
// 傾けた楕円（符頭）
function sdEllipse(x, y, cx, cy, rx, ry, deg) {
  const a = (deg * Math.PI) / 180;
  const u = (x - cx) * Math.cos(a) + (y - cy) * Math.sin(a);
  const v = -(x - cx) * Math.sin(a) + (y - cy) * Math.cos(a);
  return (Math.hypot(u / rx, v / ry) - 1) * Math.min(rx, ry);
}
// 旗：3次ベジェ曲線に沿って、先へ行くほど細くなる帯
const FLAG = [[0.538, 0.235], [0.555, 0.36], [0.705, 0.38], [0.665, 0.57]];
const flagPts = Array.from({ length: 80 }, (_, i) => {
  const t = i / 79, m = 1 - t;
  const b = [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t];
  return [b.reduce((s, w, k) => s + w * FLAG[k][0], 0), b.reduce((s, w, k) => s + w * FLAG[k][1], 0), 0.024 - 0.008 * t];
});
function sdFlag(x, y) {
  let d = Infinity;
  for (const [px, py, r] of flagPts) d = Math.min(d, Math.hypot(x - px, y - py) - r);
  return d;
}
function noteDist(x, y) {
  const head = sdEllipse(x, y, 0.43, 0.69, 0.118, 0.085, -25);
  const stem = sdRoundRect(x, y, 0.525, 0.455, 0.022, 0.235, 0.01);
  return Math.min(head, stem, sdFlag(x, y));
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const bg = [0, 0, 0], fg = [48, 209, 88];
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size, y = (py + 0.5) / size;
      const aa = 1.2 / size;
      const w = Math.min(1, Math.max(0, 0.5 - noteDist(x, y) / aa));
      const col = bg.map((v, i) => v + (fg[i] - v) * w);
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
