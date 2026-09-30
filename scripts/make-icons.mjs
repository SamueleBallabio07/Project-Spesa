// Genera le icone PNG dell'app disegnando il carrello (nessuna dipendenza esterna).
// Esecuzione: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

// ---------- geometria del carrello (coordinate normalizzate 0..1) ----------
const HANDLE = [
  [0.11, 0.36], [0.13, 0.25], [0.22, 0.16], [0.34, 0.145], [0.44, 0.19], [0.475, 0.30],
];

const BASKET = {
  tl: [0.455, 0.315],
  tr: [0.945, 0.405],
  br: [0.845, 0.705],
  bl: [0.495, 0.665],
};

const INNER_TS = [0.26, 0.5, 0.74];
const WHEELS = [[0.555, 0.815], [0.785, 0.785]];
const LEGS = [[[0.575, 0.675], [0.555, 0.815]], [[0.80, 0.71], [0.785, 0.785]]];

const COL = {
  bg: [255, 255, 255],
  basketFill: [207, 232, 196],
  stroke: [61, 107, 57],
  metal: [125, 143, 160],
  wheel: [141, 157, 170],
};

const W_HANDLE = 0.036;
const W_STROKE = 0.026;
const W_INNER = 0.023;
const W_LEG = 0.026;

// ---------- utility geometriche ----------
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const distSeg = (p, a, b) => {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = p[0] - a[0], wy = p[1] - a[1];
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const dx = wx - vx * t, dy = wy - vy * t;
  return Math.hypot(dx, dy);
};
const distPoly = (p, pts, closed) => {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(p, pts[i], pts[i + 1]));
  if (closed) d = Math.min(d, distSeg(p, pts[pts.length - 1], pts[0]));
  return d;
};
const inTriangle = (p, a, b, c) => {
  const s = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const d1 = s(a, b, p), d2 = s(b, c, p), d3 = s(c, a, p);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
};
const inQuad = (p, q) => inTriangle(p, q.tl, q.tr, q.br) || inTriangle(p, q.tl, q.br, q.bl);
const inCircle = (p, c, r) => Math.hypot(p[0] - c[0], p[1] - c[1]) <= r;

// ---------- rendering ----------
function sample(x, y) {
  let col = COL.bg;
  if (inQuad([x, y], BASKET)) col = COL.basketFill;

  const quad = [BASKET.tl, BASKET.tr, BASKET.br, BASKET.bl];
  if (inQuad([x, y], BASKET) && distPoly([x, y], quad, true) < W_STROKE / 2) col = COL.stroke;

  if (distPoly([x, y], HANDLE, false) < W_HANDLE / 2) col = COL.metal;

  for (const t of INNER_TS) {
    const top = lerp(BASKET.tl, BASKET.tr, t);
    const bottom = lerp(BASKET.bl, BASKET.br, t);
    if (distSeg([x, y], top, bottom) < W_INNER / 2) col = COL.stroke;
  }

  for (const [a, b] of LEGS) if (distSeg([x, y], a, b) < W_LEG / 2) col = COL.metal;

  for (const c of WHEELS) if (inCircle([x, y], c, 0.058)) col = COL.wheel;

  return col;
}

function render(size) {
  const SS = 3; // supersampling
  const px = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxi + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const c = sample(x, y);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS;
      const i = (py * size + pxi) * 4;
      px[i] = Math.round(r / n);
      px[i + 1] = Math.round(g / n);
      px[i + 2] = Math.round(b / n);
      px[i + 3] = 255;
    }
  }
  return px;
}

// ---------- encoder PNG ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- output ----------
mkdirSync('public/icons', { recursive: true });
const targets = [
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['public/icons/apple-touch-icon.png', 180],
  ['public/favicon.png', 64],
];
for (const [file, size] of targets) {
  writeFileSync(file, encodePng(size, render(size)));
  console.log('creata', file, `${size}x${size}`);
}
