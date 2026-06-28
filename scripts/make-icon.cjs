#!/usr/bin/env node
/**
 * Sinh media/icon.png (256x256) cho VSCode Marketplace — KHÔNG cần dependency.
 * Thiết kế: nền bo góc gradient "Claude orange" + dấu check trắng đậm (auto-yes)
 * + chấm "pulse" (live usage). Khử răng cưa bằng supersampling 4x.
 *
 *   node scripts/make-icon.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256; // kích thước xuất ra
const SS = 4; // supersampling
const BIG = SIZE * SS;

// ---- helpers hình học ------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp01(t);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Signed distance tới hình chữ nhật bo góc (âm = bên trong).
function sdRoundedRect(px, py, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(px - cx) - (halfW - r);
  const qy = Math.abs(py - cy) - (halfH - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

// blend màu src (có alpha 0..1) lên dst [r,g,b,a]
function over(dst, r, g, b, a) {
  const outA = a + dst[3] * (1 - a);
  if (outA === 0) return [0, 0, 0, 0];
  const mix = (s, d) => (s * a + d * dst[3] * (1 - a)) / outA;
  return [mix(r, dst[0]), mix(g, dst[1]), mix(b, dst[2]), outA];
}

// ---- bảng màu (Claude / Anthropic terracotta) ------------------------------
const TOP = [232, 140, 105]; // #E88C69
const BOT = [193, 92, 60]; //  #C15C3C
const WHITE = [255, 255, 255];

// dấu check (toạ độ trong hệ 256)
const CHK = [
  [70, 138],
  [110, 180],
  [192, 80],
];
const CHK_HALF = 16; // nửa bề rộng nét

// chấm pulse nhỏ góc trên-phải
const DOT = { x: 196, y: 60, r: 13 };

function sampleBig(bx, by) {
  // toạ độ theo hệ 256 (lấy tâm pixel)
  const x = (bx + 0.5) / SS;
  const y = (by + 0.5) / SS;

  let px = [0, 0, 0, 0];

  // nền bo góc
  const sd = sdRoundedRect(x, y, SIZE / 2, SIZE / 2, SIZE / 2, SIZE / 2, 58);
  const bgCov = clamp01(0.5 - sd); // anti-alias mép 1px
  if (bgCov > 0) {
    const t = clamp01(y / SIZE);
    const r = lerp(TOP[0], BOT[0], t);
    const g = lerp(TOP[1], BOT[1], t);
    const b = lerp(TOP[2], BOT[2], t);
    px = over(px, r, g, b, bgCov);
  }

  // bóng đổ nhẹ dưới dấu check
  let dShadow = Infinity;
  for (let i = 0; i < CHK.length - 1; i++) {
    dShadow = Math.min(
      dShadow,
      distToSegment(x, y - 5, CHK[i][0], CHK[i][1], CHK[i + 1][0], CHK[i + 1][1]),
    );
  }
  const shCov = clamp01(CHK_HALF + 1.5 - dShadow) * 0.22;
  if (shCov > 0) px = over(px, 60, 22, 10, shCov);

  // dấu check trắng
  let dChk = Infinity;
  for (let i = 0; i < CHK.length - 1; i++) {
    dChk = Math.min(
      dChk,
      distToSegment(x, y, CHK[i][0], CHK[i][1], CHK[i + 1][0], CHK[i + 1][1]),
    );
  }
  const chkCov = clamp01(CHK_HALF + 0.5 - dChk);
  if (chkCov > 0) px = over(px, WHITE[0], WHITE[1], WHITE[2], chkCov);

  // chấm pulse
  const dDot = Math.hypot(x - DOT.x, y - DOT.y) - DOT.r;
  const dotCov = clamp01(0.5 - dDot);
  if (dotCov > 0) px = over(px, WHITE[0], WHITE[1], WHITE[2], dotCov * 0.92);

  return px;
}

// ---- render + downsample ---------------------------------------------------
const out = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0,
      g = 0,
      b = 0,
      a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const p = sampleBig(x * SS + sx, y * SS + sy);
        // premultiply để downsample đúng ở mép trong suốt
        r += p[0] * p[3];
        g += p[1] * p[3];
        b += p[2] * p[3];
        a += p[3];
      }
    }
    const n = SS * SS;
    const alpha = a / n;
    const idx = (y * SIZE + x) * 4;
    if (alpha === 0) {
      out[idx] = out[idx + 1] = out[idx + 2] = out[idx + 3] = 0;
    } else {
      out[idx] = Math.round(r / a);
      out[idx + 1] = Math.round(g / a);
      out[idx + 2] = Math.round(b / a);
      out[idx + 3] = Math.round(alpha * 255);
    }
  }
}

// ---- mã hoá PNG (RGBA, 8-bit) ----------------------------------------------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// thêm filter byte 0 mỗi hàng
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  out.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const target = path.join(__dirname, '..', 'media', 'icon.png');
fs.writeFileSync(target, png);
console.log(`✓ wrote ${target} (${SIZE}x${SIZE}, ${png.length} bytes)`);
