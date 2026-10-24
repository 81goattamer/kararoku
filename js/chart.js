// 点数推移の折れ線グラフ（SVG）。records は1台分の記録
const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

function toMs(dt) {
  const [d, tm] = dt.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [hh, mi] = tm.split(':').map(Number);
  return new Date(y, mo - 1, da, hh, mi).getTime();
}

// 縦軸の範囲。auto は記録の範囲に合わせ、1件だけ（同じ点数だけ）のときは ±5
export function yRange(scores, graph) {
  if (graph.mode === 'range') return [graph.min, graph.max];
  let lo = Math.min(...scores);
  let hi = Math.max(...scores);
  if (hi - lo < 1e-9) {
    lo -= 5;
    hi += 5;
  } else {
    const pad = (hi - lo) * 0.1;
    lo -= pad;
    hi += pad;
  }
  lo = Math.max(0, Math.floor(lo));
  hi = Math.min(100, Math.ceil(hi));
  if (hi <= lo) [lo, hi] = hi >= 100 ? [hi - 1, hi] : [lo, lo + 1];
  return [lo, hi];
}

export function renderChart(records, graph) {
  const W = 340;
  const H = 200;
  const L = 36;
  const R = 12;
  const T = 12;
  const B = 28;
  const pts = [...records].sort((a, b) => (a.datetime < b.datetime ? -1 : 1)).map((r) => ({ x: toMs(r.datetime), y: r.score, r }));
  const [lo, hi] = yRange(pts.map((p) => p.y), graph);
  const xs = pts.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const sx = (x) => (x1 === x0 ? L + (W - L - R) / 2 : L + ((x - x0) / (x1 - x0)) * (W - L - R));
  const sy = (y) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = lo + ((hi - lo) * i) / ticks;
    const y = sy(v);
    svg.append(el('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid' }));
    svg.append(el('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', class: 'axis' }, Number.isInteger(v) ? v : v.toFixed(1)));
  }
  const fmt = (ms) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const xTicks = x1 === x0 ? [x0] : [x0, (x0 + x1) / 2, x1];
  xTicks.forEach((x, i) => {
    const anchor = xTicks.length === 1 ? 'middle' : i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle';
    svg.append(el('text', { x: sx(x), y: H - 8, 'text-anchor': anchor, class: 'axis' }, fmt(x)));
  });

  // 範囲を指定したとき、範囲外の点は描かない（線もそこで切る）
  const inRange = (p) => p.y >= lo && p.y <= hi;
  let d = '';
  let pen = false;
  for (const p of pts) {
    if (!inRange(p)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
    pen = true;
  }
  if (d) svg.append(el('path', { d, class: 'line' }));
  for (const p of pts) {
    if (!inRange(p)) continue;
    const c = el('circle', { cx: sx(p.x), cy: sy(p.y), r: 3.5, class: 'dot' });
    c.append(el('title', {}, `${p.r.datetime.replace('T', ' ')}  ${p.y}`));
    svg.append(c);
  }
  return svg;
}
