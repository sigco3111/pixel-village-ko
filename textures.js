// Every surface's picture, drawn by code a pixel at a time: 32 pixels to a metre everywhere, a handful of tones each,
// light from the upper left, a dark line where two things meet. They are the drawing; the game's sun and sky light them.
import * as THREE from './lib/three.module.js';
export const D = 32;                                    // pixels to a metre
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const pal = (s) => s.split(' ').map(hex);
export function rng(seed) { let s = (Math.imul(seed | 0, 2654435761) >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (x, y, s = 0) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c, a = 255) { const w = this.w, h = this.h; x = ((x % w) + w) % w; y = ((y % h) + h) % h; const i = (y * w + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a; }
  put(x, y, c, a = 255) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.set(x, y, c, a); }      // (no wrapping)
  rect(x, y, w, h, c, a = 255) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, c, a); }
  each(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = fn(x, y); if (c) this.set(x, y, c, c[3] ?? 255); } return this; }
  heights() { if (this.hm) return this.hm; const n = this.w * this.h, o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = (this.d[i * 4] * 0.3 + this.d[i * 4 + 1] * 0.59 + this.d[i * 4 + 2] * 0.11) / 255; return o; }
  normal(k, repeat) {                                   // which way each pixel of the drawing leans, so the game's light can catch its relief (dark is taken as deep, unless the drawing says how high it stands)
    const w = this.w, h = this.h, s = this.heights(), X = (x) => repeat ? ((x % w) + w) % w : clamp(x, 0, w - 1), Y = (y) => repeat ? ((y % h) + h) % h : clamp(y, 0, h - 1), at = (a, x, y) => a[Y(y) * w + X(x)], b = new Float32Array(w * h), d = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b[y * w + x] = (at(s, x, y) * 4 + at(s, x - 1, y) + at(s, x + 1, y) + at(s, x, y - 1) + at(s, x, y + 1)) / 8;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const gx = (at(b, x + 1, y) - at(b, x - 1, y)) * k, gy = (at(b, x, y + 1) - at(b, x, y - 1)) * k, l = Math.hypot(gx, gy, 1), i = ((h - 1 - y) * w + x) * 4; d[i] = (-gx / l * 0.5 + 0.5) * 255; d[i + 1] = (gy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255; }
    const t = new THREE.DataTexture(d, w, h); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.needsUpdate = true; return t;
  }
  tex({ repeat = true, alpha = false, bump = 3 } = {}) {
    const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h; cv.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = alpha ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter; t.generateMipmaps = !alpha;
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.size = [this.w, this.h]; if (!alpha && bump) t.userData.normal = this.normal(bump, repeat); return t;
  }
}

// scattered points, one a cell, that repeat at the picture's edges: for each pixel, how far the nearest and the next are, which it is, and the way from it
function voronoi(w, h, nx, ny, r) {
  const sx = [], sy = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { sx.push((i + 0.15 + 0.7 * r()) * w / nx); sy.push((j + 0.15 + 0.7 * r()) * h / ny); }
  const f1 = new Float32Array(w * h), f2 = new Float32Array(w * h), id = new Int32Array(w * h), dx = new Float32Array(w * h), dy = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ci = Math.floor(x * nx / w), cj = Math.floor(y * ny / h); let a = 1e9, b = 1e9, k = 0, ax = 0, ay = 0;
    for (let oj = -1; oj <= 1; oj++) for (let oi = -1; oi <= 1; oi++) {
      const i = ((ci + oi) % nx + nx) % nx, j = ((cj + oj) % ny + ny) % ny, n = j * nx + i;
      let ex = x + 0.5 - sx[n], ey = y + 0.5 - sy[n]; if (ex > w / 2) ex -= w; if (ex < -w / 2) ex += w; if (ey > h / 2) ey -= h; if (ey < -h / 2) ey += h;
      const dd = Math.hypot(ex, ey); if (dd < a) { b = a; a = dd; k = n; ax = ex; ay = ey; } else if (dd < b) b = dd;
    }
    const q = y * w + x; f1[q] = a; f2[q] = b; id[q] = k; dx[q] = ax; dy[q] = ay;
  }
  return { f1, f2, id, dx, dy };
}
// lumps (boulders, cobbles, clumps of leaves): each its own tone, turning from light at its upper left to dark underneath in several steps, a lit rim above and a
// shadow below, a dark line between
function lumps(w, h, nx, ny, seed, P, { mid = 3, gap = 1.5, vary = 1.0, speck = 0.03, dark = 0, depth = 2.6 } = {}) {
  const r = rng(seed), v = voronoi(w, h, nx, ny, r), base = Array.from({ length: nx * ny }, () => (r() - 0.5) * 2 * vary), R = (w / nx) * 0.5, p = new Pix(w, h), rs = rng(seed + 9), top = P.length - 1;
  return p.each((x, y) => {
    const q = y * w + x, e = v.f2[q] - v.f1[q]; if (e < gap) return P[dark];
    const l = (-v.dx[q] * 0.6 - v.dy[q] * 0.8) / R + (((x + y) & 1) ? 0.07 : -0.07); let t = mid + base[v.id[q]] + l * depth;
    if (e < gap + 2.2) t += l > 0.15 ? 0.9 : -1.2; if (rs() < speck) t += rs() < 0.5 ? 1 : -1;
    return P[clamp(Math.round(t), dark + 1, top)];
  });
}
const crack = (p, r, n, len, lo, hi) => { for (let k = 0; k < n; k++) { let x = Math.floor(r() * p.w), y = Math.floor(r() * p.h); const m = len[0] + Math.floor(r() * len[1]); for (let i = 0; i < m; i++) { p.set(x, y, lo); if (hi) p.set(x, y + 1, hi); x += 1; if (r() < 0.35) y += r() < 0.5 ? 1 : -1; } } };

const ROCK = pal('#1e171d #30252a #453538 #5a4640 #725a4a #8e7258 #ab8e68 #c8ac80');
const STONE = pal('#201c2a #34303e #4a4654 #62606e #7e7c88 #9c9aa4 #bcbac0');
const COBBLE = pal('#262024 #3a3434 #524a46 #6c6258 #887c6c #a49884 #c0b69c');
const SLAB = pal('#28222a #3e3638 #584e4c #746860 #908478 #aca092 #c6bcac');      // worn stair stone, of a kind with the cobbles
const SLATE = pal('#0c0d16 #151724 #1e2132 #2a2e42 #383e56 #4a526e #626c8a');
const TILE = pal('#2e140f #481e16 #66291c #863824 #a44a30 #c46440 #de8658');
const THATCH = pal('#2e2412 #46381e #605028 #7c6834 #968244 #b09c5a #c8b878');
const PLASTER = pal('#7c6c5a #a39278 #c4b596 #dccfae #ebe0c4 #f6efda');
const BEAM = pal('#170e0a #281912 #3a251a #4e3324 #664432 #805a42');
const WOOD = pal('#22160f #382718 #503a24 #6a4e30 #866640 #a28054 #bc9a6e');
const GRASS = pal('#24281a #383c22 #4c502a #646634 #7e7c42 #989454 #b2ac6c');
const DIRT = pal('#2c2019 #433226 #5c4634 #765c42 #907452 #aa8e66');
const LEAF = pal('#121c14 #1c2c1c #2a3e24 #3a542e #506a3a #68844a #88a060');
const GLASS = pal('#0a0f1a #131c2c #1e2c44 #2e4262 #4c6a8c #86a8c4'), LIT = pal('#8a4410 #c26e18 #ee9c2a #ffc452 #ffe08a #fff2c0');
const SHUT = pal('#122a1a #1a4226 #265c34 #387a44 #509858'), FLOWER = pal('#d84a5a #f08a9a #f4d25a #ffffff #c86ad0');

function rock() {                                        // cliff faces: as if built of boulders, each rounded, with cracks and a little lichen
  const w = 256, h = 256, p = lumps(w, h, 7, 9, 11, ROCK, { mid: 4, gap: 1.6, vary: 0.8, speck: 0.05, dark: 1, depth: 2.8 }), r = rng(5);
  crack(p, r, 60, [5, 14], ROCK[1], ROCK[6]);
  for (let k = 0; k < 90; k++) { const x = Math.floor(r() * w), y = Math.floor(r() * h), c = r() < 0.5 ? ROCK[7] : [118, 124, 92]; p.set(x, y, c); if (r() < 0.5) p.set(x + 1, y, c); if (r() < 0.3) p.set(x, y + 1, ROCK[2]); }
  return p.tex();
}
function slab() {                                        // cliff faces: the rock in courses of big blocks, each a flat face with a lit upper edge and a shadow under it, fine beds running through, cracks, a little moss
  const w = 256, h = 256, p = new Pix(w, h), r = rng(17), rows = [34, 26, 40, 30, 44, 28, 32, 22], n = rows.length, top = ROCK.length - 1, Y = []; let acc = 0; for (const rh of rows) { Y.push(acc); acc += rh; } Y.push(h);
  const Rw = rows.map(() => { const xs = []; let x = Math.floor(r() * 40); while (x < w) { xs.push(x); x += 44 + Math.floor(r() * 60); } if (w + xs[0] - xs[xs.length - 1] < 30) xs.pop(); return { xs, tone: xs.map(() => (r() - 0.5) * 1.7), ph: r() * 6.28, f: 2 + Math.floor(r() * 3) }; });
  const wobY = (x, k) => Math.round(Math.sin(x / w * 6.2832 * Rw[k % n].f + Rw[k % n].ph) * 2.2 + Math.sin(x / w * 6.2832 * 9 + k) * 1.0);
  const wobX = (dy, k, j) => Math.round(Math.sin(dy * 0.21 + j * 2.1 + k) * 1.6 + dy * (hash(j, k, 3) - 0.5) * 0.35);
  p.each((x, y) => {
    let yy = y; if (yy < Y[0] + wobY(x, 0)) yy += h; let k = n - 1; for (let i = 0; i < n; i++) if (yy >= Y[i] + wobY(x, i) && yy < Y[i + 1] + wobY(x, i + 1)) { k = i; break; }
    const t0 = Y[k] + wobY(x, k), dTop = yy - t0, dBot = Y[k + 1] + wobY(x, k + 1) - 1 - yy, xs = Rw[k].xs, m = xs.length, bx = (j) => (j < m ? xs[j] : xs[0] + w) + wobX(dTop, k, j % m);
    let xx = x; if (xx < bx(0)) xx += w; let j = m - 1; for (let i = 0; i < m; i++) if (xx >= bx(i) && xx < bx(i + 1)) { j = i; break; }
    const dL = xx - bx(j), dR = bx(j + 1) - 1 - xx;
    if (dBot < 2 || dR < 2 || dTop + dL < 2 || dTop + dR < 4 || dBot + dL < 4 || dBot + dR < 5) return ROCK[dBot < 1 || dR < 1 ? 0 : 1];
    if (dTop < 2 && hash(x >> 2, k * 7 + j, 24) < 0.22) return hash(x, y, 25) < 0.5 ? [84, 104, 58] : [112, 132, 72];
    let t = 4 + Rw[k].tone[j] + (hash(x >> 3, y >> 3, 21) - 0.5) * 1.1 + (hash(x, y, 22) - 0.5) * 0.9;
    if (dTop < 1) t += 2.2; else if (dTop < 3) t += 1.1; if (dL < 2) t += 0.8; if (dBot < 6) t -= 1.6 - (dBot - 2) * 0.35; if (dR < 4) t -= 0.8;
    const bed = dTop % 10, on = hash(x >> 2, k * 31 + Math.floor(dTop / 10), 23) < 0.6; if (bed === 7 && on) t -= 1.3; else if (bed === 8 && on) t += 0.6;
    return ROCK[clamp(Math.round(t), 1, top)];
  });
  for (let c = 0; c < 26; c++) { let x = Math.floor(r() * w), y = Math.floor(r() * h); const len = 6 + Math.floor(r() * 16); for (let i = 0; i < len; i++) { p.set(x, y, ROCK[1]); p.set(x + 1, y, ROCK[6]); y += 1; if (r() < 0.4) x += r() < 0.5 ? 1 : -1; } }
  for (let c = 0; c < 70; c++) { const x = Math.floor(r() * w), y = Math.floor(r() * h), col = r() < 0.5 ? ROCK[7] : [118, 124, 92]; p.set(x, y, col); if (r() < 0.5) p.set(x + 1, y, col); }
  return p.tex();
}
function crag() {                                        // living rock: blocks of many sizes split by deep creases, each leaning its own way, fine beds running through, moss on a top here and there
  const w = 256, h = 256, p = new Pix(w, h), r = rng(71), A = voronoi(w, h, 5, 6, r), B = voronoi(w, h, 11, 14, r), fine = Array.from({ length: 30 }, () => r() < 0.55), top = ROCK.length - 1;
  p.hm = new Float32Array(w * h);
  p.each((x, y) => { const q = y * w + x, small = fine[A.id[q]], v = small ? B : A, R = small ? 10 : 24, n = v.id[q] + (small ? 100 : 0), e = v.f2[q] - v.f1[q], g = small ? 1.0 : 1.5;
    if (e < g) { p.hm[q] = 0; return ROCK[e < g * 0.5 ? 1 : 3]; }
    const dome = Math.pow(clamp((e - g) / (R * 0.55), 0, 1), 0.45), lean = (v.dx[q] * (hash(n, 2, 71) - 0.5) + v.dy[q] * (hash(n, 3, 71) - 0.5)) / R;
    p.hm[q] = clamp(0.25 + dome * 0.55 + lean * 0.6 + (hash(x >> 1, y >> 1, 72) - 0.5) * 0.06, 0, 1.3);
    let t = 4.8 + (hash(n, 1, 71) - 0.5) * 1.8 + (hash(x >> 2, y >> 2, 73) - 0.5) * 1.0 + (hash(x, y, 74) - 0.5) * 0.9 - (1 - dome) * 1.1 - v.dy[q] / R * 0.5;
    if ((y + Math.round(Math.sin(x * 0.07 + n) * 2)) % 7 === 0 && hash(x >> 3, y, 75 + n) < 0.55) t -= 1.0;
    if (hash(n, 4, 71) < 0.24 && v.dy[q] < -R * 0.22 && hash(x, y, 76) < 0.55) return hash(x, y, 77) < 0.5 ? [70, 80, 46] : [96, 104, 58];
    return ROCK[clamp(Math.round(t), 1, top)]; });
  crack(p, r, 30, [5, 14], ROCK[1], null);
  return p.tex({ bump: 6.5 });
}
function boulder() { const w = 64, h = 64, r = rng(13), p = new Pix(w, h).each(() => ROCK[r() < 0.07 ? 3 : r() < 0.06 ? 6 : 5]); crack(p, r, 9, [5, 9], ROCK[1], ROCK[6]); return p.tex(); }
function cobble() { const p = lumps(128, 128, 9, 9, 21, COBBLE, { mid: 3.6, gap: 1.4, vary: 1.0, depth: 2.2, speck: 0.04 }), r = rng(22); for (let k = 0; k < 40; k++) { const x = Math.floor(r() * 128), y = Math.floor(r() * 128); p.set(x, y, [70, 92, 52]); p.set(x + 1, y, [92, 116, 62]); } return p.tex(); }   // (moss in the joints)
function blocks(P, seed, mid = 3, w = 128, h = 128, rowH = 16) {  // dressed stone: courses of blocks, mortar between, each lit along its top and left, chipped at a corner here and there
  const p = new Pix(w, h), r = rng(seed), top = P.length - 1;
  for (let y0 = 0; y0 < h; y0 += rowH) {
    let x = Math.floor(r() * 12);
    for (let n = 0; x < w + 12 && n < 40; n++) {
      const bw = 14 + Math.floor(r() * 16), t = mid + Math.round((r() - 0.5) * 1.8), chip = r() < 0.3 ? Math.floor(r() * 4) : -1;
      for (let j = 0; j < rowH; j++) for (let i = 0; i < bw; i++) {
        let c = t; if (j === 0 || i === bw - 1) c = 0; else if (j === 1 || i === 0) c = t + 1; else if (j === rowH - 1 || i === bw - 2) c = t - 1; else if (j === 2 && i < bw * 0.6 && r() < 0.5) c = t + 1; else if (r() < 0.06) c = t + (r() < 0.5 ? 1 : -1);
        const cx = chip === 0 || chip === 2 ? i : bw - 2 - i, cy = chip < 2 ? j - 1 : rowH - 1 - j; if (chip >= 0 && cx >= 0 && cy >= 0 && cx + cy < 3) c = cx + cy === 2 ? t - 1 : 0;
        p.set(x + i, y0 + j, P[clamp(c, 0, top)]);
      }
      if (r() < 0.25) { let cx = x + 3 + Math.floor(r() * (bw - 8)), cy = y0 + 3; for (let i = 0; i < rowH - 6; i++) { p.set(cx, cy + i, P[clamp(t - 2, 0, top)]); if (r() < 0.4) cx += r() < 0.5 ? 1 : -1; } }
      x += bw;
    }
  }
  return p;
}
function slate(P = SLATE, seed = 31, mid = 2.4) {         // roof tiles in rows, each with rounded lower corners and its lower edge in shadow (the foot of the picture is the eave)
  const w = 96, h = 96, p = new Pix(w, h), r = rng(seed), rowH = 8, tw = 8, top = P.length - 1;
  for (let y0 = 0, row = 0; y0 < h; y0 += rowH, row++) for (let x0 = (row % 2) * 4 - 4; x0 < w; x0 += tw) {
    const t = mid + (r() - 0.4) * 2.2, streak = Math.floor(r() * tw), moss = r() < 0.06;
    for (let j = 0; j < rowH; j++) for (let i = 0; i < tw; i++) {
      let c = t; if (j === rowH - 1) c = 0; else if (j === rowH - 2) c = t - 1.2; else if (j === 0) c = t + 1.4; else if (j === 1) c = t + 0.7; if (i === tw - 1) c = Math.min(c, 0.4); else if (i === 0) c += 0.6; else if (i === tw - 2) c -= 0.6;
      if ((i === 0 || i === tw - 2) && j === rowH - 2) c = 0; if (i === streak && j > 2 && j < rowH - 3) c -= 0.7; if (r() < 0.05) c += r() < 0.5 ? 0.9 : -0.9;
      p.set(x0 + i, y0 + j, moss && j < 3 && i > 1 && i < 6 && r() < 0.6 ? [58, 84, 50] : P[clamp(Math.round(c), 0, top)]);
    }
  }
  return p.tex();
}
function thatch() {                                       // straw laid in courses: fine strands, each course's cut edge in shadow
  const w = 96, h = 96, p = new Pix(w, h), band = 24;
  return p.each((x, y) => { const b = y % band, seg = Math.floor((y + hash(x, 0, 41) * 30) / (5 + hash(x, 1, 41) * 9)); let t = 2.6 + hash(x, seg, 41) * 2.4 + (hash(x, y, 42) < 0.1 ? 1 : 0);
    if (b === band - 1) t = 0; else if (b === band - 2) t -= 1.6; else if (b >= band - 5 && hash(x, 7, 43) < 0.5) t -= 1; else if (b < 2) t += 1; return THATCH[clamp(Math.round(t), 0, 6)]; }).tex();
}
function planks(P = WOOD, seed = 51, bw = 12) {           // boards running up the picture, with grain, knots, gaps and nails
  const w = 96, h = 96, p = new Pix(w, h), r = rng(seed), top = P.length - 1;
  for (let x0 = 0, b = 0; x0 < w; x0 += bw, b++) { const t = 3.4 + (r() - 0.5) * 1.6, knot = [2 + Math.floor(r() * (bw - 5)), Math.floor(r() * h)], hasKnot = r() < 0.6;
    for (let y = 0; y < h; y++) for (let i = 0; i < bw; i++) { const seg = Math.floor((y + hash(i, b, seed) * 40) / (8 + hash(i, b + 9, seed) * 20)); let c = t + (hash(i + b * 31, seg, seed) - 0.5) * 1.5;
      if (i === bw - 1) c = 0; else if (i === 0) c = t + 1.2; else if (i === bw - 2) c = t - 1;
      const kd = Math.hypot(i - knot[0], (y - knot[1]) * 0.6); if (hasKnot && kd < 2.6) c = kd < 1.1 ? t - 2.4 : t - 1.2;
      p.set(x0 + i, y, P[clamp(Math.round(c), 0, top)]); }
    for (const y of [5, h - 6]) { p.set(x0 + Math.floor(bw / 2), y, P[0]); p.set(x0 + Math.floor(bw / 2), y - 1, P[top]); } }
  return p.tex();
}
function ground(seed, grassy) {                           // the tops of the terraces: grass in blades with a flower here and there, or trodden earth with stones
  const w = 128, h = 128, r = rng(seed), p = new Pix(w, h), P = grassy ? GRASS : DIRT, v = voronoi(w, h, 7, 7, rng(seed + 1)), b = Array.from({ length: 49 }, () => (r() - 0.5) * 2), top = P.length - 1;
  p.each((x, y) => { const q = y * w + x; let t = (grassy ? 2.6 : 2.4) + b[v.id[q]] * 0.9 + (-v.dy[q] > 3 ? 0.6 : 0) + (hash(x, y, seed) - 0.5) * 1.2; return P[clamp(Math.round(t), 0, top)]; });
  if (grassy) { for (let k = 0; k < 520; k++) { let x = Math.floor(r() * w); const y = Math.floor(r() * h), n = 2 + Math.floor(r() * 4), c = GRASS[4 + Math.floor(r() * 3)]; p.set(x, y + 1, GRASS[0]); for (let j = 0; j < n; j++) { p.set(x, y - j, j === n - 1 ? GRASS[6] : c); if (j === 1 && r() < 0.4) x += r() < 0.5 ? 1 : -1; } }
    for (let k = 0; k < 7; k++) { const x = Math.floor(r() * w), y = Math.floor(r() * h), c = FLOWER[1 + Math.floor(r() * 3)]; p.set(x, y, c); p.set(x + 1, y, c); p.set(x, y + 1, c); p.set(x + 1, y + 1, GRASS[1]); } }
  else for (let k = 0; k < 50; k++) { const x = Math.floor(r() * w), y = Math.floor(r() * h), s = 1 + Math.floor(r() * 2); for (let j = 0; j <= s; j++) for (let i = 0; i <= s + 1; i++) p.set(x + i, y + j, COBBLE[j === 0 ? 5 : i === s + 1 || j === s ? 1 : 3]); }
  return p.tex();
}
function leaves() { const p = lumps(96, 96, 8, 8, 61, LEAF, { mid: 3.4, gap: 1.2, vary: 1.5, speck: 0.07, depth: 2.4 }), r = rng(62); for (let k = 0; k < 70; k++) { const x = Math.floor(r() * 96), y = Math.floor(r() * 96); p.set(x, y, LEAF[6]); p.set(x + 1, y + 1, LEAF[5]); } return p.tex(); }

// the houses' walls, a panel at a time (2 m wide, 3 m tall, 64 by 96 pixels): plaster in a timber frame, some with a brace, a window or a door
export const WALL = { tile: [64, 96], names: ['plain', 'brace', 'window', 'door', 'cross', 'gable', 'shop', 'lit'] };
function timber(p, r) {                                   // the two ways of drawing a timber: a straight bar with grain, and a brace from one corner to another
  const bar = (x, y, w, h, vert) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const e = vert ? i : j, m = vert ? w : h, a = vert ? j : i, seg = Math.floor((a + hash(e, x + y, 7) * 30) / (7 + hash(e, x, 8) * 14));
    p.put(x + i, y + j, BEAM[e === 0 ? 4 : e === m - 1 ? 0 : e === 1 && m > 3 ? 3 : 1 + Math.round(hash(e + x * 3, seg + y, 9) * 2)]); } };
  const brace = (x0, y0, x1, y1, t = 4) => { const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let k = 0; k <= s; k++) { const x = Math.round(x0 + (x1 - x0) * k / s), y = Math.round(y0 + (y1 - y0) * k / s); for (let i = 0; i < t; i++) p.put(x + i, y, BEAM[i === 0 ? 4 : i === t - 1 ? 0 : 2 + (hash(k >> 3, i, 5) < 0.3 ? -1 : 0)]); p.put(x + t, y, PLASTER[1]); } };
  const peg = (x, y) => { p.put(x, y, BEAM[0]); p.put(x + 1, y, BEAM[0]); p.put(x, y + 1, BEAM[0]); p.put(x + 1, y + 1, BEAM[5]); };
  return { bar, brace, peg };
}
function daub(p, r, x0, y0, w, h) {                       // plaster: blotched, a little grubby near the foot, cracked here and there
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let c = 3.1 + (hash((x0 + x) >> 3, (y0 + y) >> 3, 3) - 0.5) * 1.3 + (hash(x0 + x, y0 + y, 4) - 0.5) * 1.1; if (y > h - 14) c -= (y - (h - 14)) / 14 * 1.3 * hash(x0 + x, y >> 1, 6); p.put(x0 + x, y0 + y, PLASTER[clamp(Math.round(c), 1, 5)]); }
  for (let k = 0; k < 2; k++) { let x = x0 + 8 + Math.floor(r() * (w - 16)), y = y0 + 8 + Math.floor(r() * (h - 30)); for (let i = 0; i < 8 + r() * 10; i++) { p.put(x, y, PLASTER[1]); p.put(x + 1, y, PLASTER[5]); y += 1; if (r() < 0.5) x += r() < 0.5 ? 1 : -1; } }
}
function pane(p, x0, y0, w, h, lit, nx = 2, ny = 3) {     // a window: a dark frame, glass that catches the sky (or a lamp), bars across it
  const G = lit ? LIT : GLASS; p.rect(x0 - 2, y0 - 2, w + 4, h + 4, BEAM[0]); p.rect(x0 - 2, y0 - 3, w + 4, 1, BEAM[4]); p.rect(x0 - 1, y0 - 1, w + 2, h + 2, BEAM[2]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let c; if (lit) { const d = Math.hypot((x - w / 2) / w, (y - h * 0.55) / h); c = d < 0.2 ? 4 : d < 0.36 ? 3 : d < 0.5 ? 2 : 1; if (y > h - 5 && x > 2 && x < w - 3 && (x >> 1) % 3) c = 1; }      // (a lamp's glow, and something on the sill inside)
    else { c = 1 + (x + y < w * 0.75 ? 1 : 0) + (x + y < w * 0.4 ? 1 : 0); const s = x + y; if (s === 9 || s === 10 || s === 14) c = 5; else if (s === 11) c = 4; if (y > h - 4) c = Math.max(0, c - 1); }
    p.put(x0 + x, y0 + y, G[c]); }
  for (let i = 1; i < nx; i++) p.rect(x0 + Math.round(w * i / nx) - 1, y0, 2, h, BEAM[lit ? 1 : 3]); for (let j = 1; j < ny; j++) p.rect(x0, y0 + Math.round(h * j / ny) - 1, w, 2, BEAM[lit ? 1 : 3]);
  for (let i = 1; i < nx; i++) p.rect(x0 + Math.round(w * i / nx) - 1, y0, 1, h, BEAM[lit ? 2 : 4]);
}
function walls() {
  const [tw, th] = WALL.tile, n = WALL.names.length, p = new Pix(tw * n, th), r = rng(71), mid = 46, { bar, brace, peg } = timber(p, r);
  for (let t = 0; t < n; t++) {
    const o = t * tw, name = WALL.names[t], win = name === 'window' || name === 'lit', shop = name === 'shop';
    daub(p, r, o, 0, tw, th);
    for (let y = 6; y < th; y++) { p.put(o + 6, y, PLASTER[1]); p.put(o + 7, y, PLASTER[2]); } for (let x = 6; x < tw; x++) { p.put(o + x, 6, PLASTER[1]); p.put(o + x, 7, PLASTER[2]); }      // the frame's shadow on the plaster
    bar(o, 0, 6, th, true); bar(o + tw - 2, 0, 2, th, true); bar(o, 0, tw, 6, false);                 // the frame: a post at the left, a rail along the top, another half way down
    if (name !== 'door') { bar(o + 6, mid, tw - 8, 4, false); for (let x = 6; x < tw - 2; x++) p.put(o + x, mid + 4, PLASTER[1]); peg(o + 2, mid + 1); }
    peg(o + 2, 2); peg(o + 2, th - 5);
    if (name === 'plain' || name === 'gable' || win) bar(o + 30, mid + 4, 4, th - mid - 4, true);
    if (name === 'plain') bar(o + 30, 6, 4, mid - 6, true);
    if (name === 'brace') { brace(8, th - 3, tw - 8, mid + 6); brace(8, 9, tw - 8, mid - 3); }
    if (name === 'cross') { brace(8, th - 3, tw - 8, mid + 6); brace(8, mid + 6, tw - 8, th - 3); bar(o + 30, 6, 4, mid - 6, true); }
    if (win || shop) {
      const x0 = shop ? 14 : 22, y0 = shop ? 20 : 14, w = shop ? 38 : 22, h = shop ? 22 : 26, lit = name === 'lit';
      pane(p, o + x0, y0, w, h, lit, shop ? 3 : 2, shop ? 2 : 3);
      if (!shop) for (const sx of [x0 - 11, x0 + w + 3]) { p.rect(o + sx, y0 - 2, 8, h + 4, SHUT[2]); p.rect(o + sx, y0 - 2, 1, h + 4, SHUT[4]); p.rect(o + sx + 7, y0 - 2, 1, h + 4, SHUT[0]); p.rect(o + sx, y0 - 2, 8, 1, SHUT[4]); p.rect(o + sx, y0 + h + 1, 8, 1, SHUT[0]);
        for (let y = y0 + 1; y < y0 + h; y += 3) { p.rect(o + sx + 1, y, 6, 1, SHUT[1]); p.rect(o + sx + 1, y + 1, 6, 1, SHUT[3]); } p.put(o + sx + (sx < x0 ? 6 : 1), y0 + 4, BEAM[0]); p.put(o + sx + (sx < x0 ? 6 : 1), y0 + h - 5, BEAM[0]); }      // shutters, slatted, on their hinges
      const by = y0 + h + 2; p.rect(o + x0 - 4, by, w + 8, 6, WOOD[3]); p.rect(o + x0 - 4, by, w + 8, 1, WOOD[5]); p.rect(o + x0 - 4, by + 5, w + 8, 1, WOOD[0]); p.rect(o + x0 + w + 3, by, 1, 6, WOOD[1]); for (let x = x0 - 2; x < x0 + w + 4; x += 6) p.rect(o + x, by + 1, 1, 4, WOOD[2]);      // a box of flowers on the sill
      for (let x = x0 - 4; x < x0 + w + 4; x++) { const hh = 1 + Math.floor(r() * 3); for (let j = 0; j < hh; j++) p.put(o + x, by - 1 - j, LEAF[3 + ((x + j) % 3)]); if (r() < 0.45) { const c = FLOWER[Math.floor(r() * 5)]; p.put(o + x, by - 1 - hh, c); p.put(o + x + 1, by - 1 - hh, c); p.put(o + x, by - 2 - hh, c); } }
      if (shop) { const A = pal('#7a2222 #a83a30 #cc5444 #d8ccb0 #f0e6cc'); for (let x = 6; x < tw - 2; x++) { const st = Math.floor(x / 8) % 2, drop = (x % 8 === 0 || x % 8 === 7) ? 9 : 11; for (let y = 8; y < 8 + drop; y++) p.put(o + x, y, A[st ? (y < 10 ? 4 : y > 15 ? 3 : 4) : (y < 10 ? 2 : y > 15 ? 0 : 1)]); p.put(o + x, 8 + drop, BEAM[0]); }      // a striped awning with a scalloped edge, and crates of goods below
        for (let x = 9; x < tw - 12; x += 13) { p.rect(o + x, mid + 10, 10, 11, WOOD[3]); p.rect(o + x, mid + 10, 10, 1, WOOD[6]); p.rect(o + x + 9, mid + 10, 1, 11, WOOD[1]); p.rect(o + x, mid + 20, 10, 1, WOOD[0]); p.rect(o + x, mid + 15, 10, 1, WOOD[1]); for (let i = 1; i < 9; i += 2) p.put(o + x + i, mid + 9, FLOWER[(x + i) % 3]); } }
    }
    if (name === 'door') {
      const cx = 32, hw = 14, y0 = 28, spring = y0 + hw, inside = (x, y, g = 0) => y < th && (y >= spring ? Math.abs(x - cx + 0.5) < hw + g : Math.hypot(x - cx + 0.5, y - spring) < hw + g);
      bar(o + 6, 14, tw - 8, 4, false);
      for (let y = y0 - 6; y < th; y++) for (let x = cx - hw - 6; x < cx + hw + 6; x++) {
        if (inside(x, y)) { const edge = !inside(x, y, -1.2), board = Math.floor((x - (cx - hw)) / 5), bx = (x - (cx - hw)) % 5, seg = Math.floor((y + hash(board, 0, 2) * 20) / 11); let c = 3.2 + (hash(board, 3, 2) - 0.5) * 1.2 + (hash(bx + board * 7, seg, 2) - 0.5) * 1.2; if (bx === 4) c = 0.6; else if (bx === 0) c += 1;
          p.put(o + x, y, edge ? BEAM[0] : WOOD[clamp(Math.round(c), 0, 6)]); continue; }
        if (inside(x, y, 5)) { const a = y >= spring ? Math.floor(y / 8) : Math.floor((Math.atan2(y - spring, x - cx + 0.5) + Math.PI) / 0.33) + 40, joint = y >= spring ? y % 8 === 0 : Math.abs(((Math.atan2(y - spring, x - cx + 0.5) + Math.PI) / 0.33) % 1) < 0.14, rim = !inside(x, y, 4);
          p.put(o + x, y, STONE[joint ? 1 : rim ? (x < cx ? 5 : 2) : 3 + Math.round(hash(a, 1, 12) * 2)]); }      // dressed stones round the arch
      }
      for (const yy of [spring + 6, th - 16]) { p.rect(o + cx - hw + 2, yy, hw * 2 - 4, 3, BEAM[1]); p.rect(o + cx - hw + 2, yy, hw * 2 - 4, 1, STONE[3]); for (let x = cx - hw + 4; x < cx + hw - 3; x += 6) p.put(o + x, yy + 1, STONE[5]); }      // iron bands, studded
      p.rect(o + cx + hw - 7, spring + 20, 3, 3, pal('#e8c060')[0]); p.put(o + cx + hw - 6, spring + 21, BEAM[0]); p.rect(o + cx + hw - 7, spring + 23, 3, 1, BEAM[0]);
      p.rect(o + cx - hw - 6, th - 4, hw * 2 + 12, 4, STONE[3]); p.rect(o + cx - hw - 6, th - 4, hw * 2 + 12, 1, STONE[5]); p.rect(o + cx - hw - 6, th - 1, hw * 2 + 12, 1, STONE[1]);
    }
  }
  return p.tex({ repeat: false });
}
function gablet() {                                       // the end of a roof: plaster in a frame of struts, with a small window under the ridge (4 m by 3 m)
  const w = 128, h = 96, p = new Pix(w, h), r = rng(75), { bar, brace, peg } = timber(p, r); daub(p, r, 0, 0, w, h);
  bar(0, h - 6, w, 6, false); bar(0, h - 42, w, 4, false); bar(62, 0, 4, h, true); brace(60, h - 8, 24, h - 40); brace(66, h - 8, 102, h - 40); brace(40, h - 44, 61, h - 72); brace(86, h - 44, 65, h - 72);
  for (let y = 0; y < h; y++) p.put(66, y, PLASTER[1]); for (let x = 0; x < w; x++) p.put(x, h - 38, PLASTER[1]);
  pane(p, 55, h - 66, 18, 16, false, 2, 2); peg(63, h - 4); peg(63, h - 41);
  return p.tex({ repeat: false });
}
function flags() { const C = pal('#8e4a40 #a8844a #56687c #66744e #c4b89c #74586e'), s = 16, p = new Pix(s * C.length, s);      // small cloths on a line, each a little folded and frayed
  C.forEach((c, i) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { if (y === s - 1 && (x + i) % 3 === 0) continue; const k = y === 0 ? 0.55 : x === 0 ? 1.18 : x === s - 1 || y >= s - 2 ? 0.7 : (x + (y >> 1)) % 7 < 2 ? 0.86 : x < 4 ? 1.1 : 1; p.put(i * s + x, y, c.map((v) => clamp(v * k, 0, 255))); } }); return p.tex({ repeat: false, alpha: true }); }
function fall() { const w = 64, h = 128, p = new Pix(w, h);   // falling water: long bright streaks with spray between, broken at its edges
  p.each((x, y) => { const s = hash(x, 0, 81), k = (y + Math.floor(hash(x, 1, 81) * h)) % 64, edge = Math.min(x, w - 1 - x), streak = k < 8 + s * 30, tip = streak && k > 4 + s * 28;
    if (edge < 4 && !(streak && s > 0.6)) return [0, 0, 0, 0]; if (edge < 13 && (!streak || s < 0.25)) return [0, 0, 0, 0];
    if (!streak && hash(x, y, 82) < 0.04) return [255, 255, 255, 235];
    const c = streak ? (tip ? [196, 222, 240] : s > 0.5 ? [250, 252, 255] : [222, 238, 248]) : (s > 0.5 ? [150, 192, 220] : [108, 158, 198]); return [...c, streak ? 245 : 150]; }); return p.tex({ alpha: true }); }
function stream() { const w = 64, h = 64, p = new Pix(w, h);      // running water over the ground: blue, with short bright ripples going its way, ragged at its banks
  p.each((x, y) => { const edge = Math.min(x, w - 1 - x), s = hash(x >> 1, 0, 85), k = (y + Math.floor(hash(x >> 1, 1, 85) * h)) % 32, rip = k < 3 + s * 7 && s > 0.35;
    if (edge < 3 + hash(0, y >> 2, 86) * 5) return [0, 0, 0, 0]; const c = rip ? [228, 236, 240] : edge < 12 ? [72, 96, 116] : (x + (y >> 3)) % 11 < 4 ? [104, 130, 148] : [88, 114, 134]; return [...c, rip ? 240 : 205]; }); return p.tex({ alpha: true }); }
function tuft() { const w = 32, h = 32, p = new Pix(w, h), r = rng(91);      // a tuft of long grass, some of it gone to seed
  for (let k = 0; k < 16; k++) { let x = 4 + Math.floor(r() * 24); const hh = 9 + Math.floor(r() * 20), lean = r() < 0.5 ? -1 : 1, c = GRASS[3 + Math.floor(r() * 3)], seed = r() < 0.3;
    for (let j = 0; j < hh; j++) { p.put(x, h - 1 - j, j > hh - 4 ? GRASS[6] : j < 3 ? GRASS[1] : c); if (j < hh * 0.5) p.put(x + 1, h - 1 - j, GRASS[2]); if (j % 5 === 4 && r() < 0.6) x += lean; }
    if (seed) { const y = h - 1 - hh; p.put(x, y, THATCH[5]); p.put(x, y - 1, THATCH[6]); p.put(x + lean, y - 1, THATCH[4]); p.put(x, y - 2, THATCH[5]); } }
  return p.tex({ repeat: false, alpha: true }); }
function sail() { const w = 32, h = 128, p = new Pix(w, h);      // a sail of the mill: cloth laced to a frame
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const fr = x < 2 || x >= w - 2 || y % 32 < 2 || x === 14 || x === 15, cl = !fr && y > 12; let c = 3.4 + (x < 8 ? 0.8 : x > 24 ? -0.9 : 0) - ((y % 32) > 25 ? 0.9 : 0) + (hash(x >> 1, y >> 2, 95) - 0.5) * 0.9;
    p.put(x, y, fr ? WOOD[x === 14 || y % 32 === 0 || x === 0 ? 4 : 2] : PLASTER[clamp(Math.round(c), 1, 5)], fr || cl ? 255 : 0); }
  return p.tex({ repeat: false, alpha: true }); }
function soft() { const s = 64, p = new Pix(s, s); p.each((x, y) => { const k = clamp(1 - Math.hypot(x - 31.5, y - 31.5) / 31.5, 0, 1); return [255, 255, 255, k * k * 255]; }); const t = p.tex({ repeat: false, alpha: true }); t.magFilter = t.minFilter = THREE.LinearFilter; return t; }
function barrel() {                                       // staves, with two iron hoops
  const w = 96, h = 48, p = new Pix(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = x % 8, b = Math.floor(x / 8); let c = 3.3 + (hash(b, 0, 53) - 0.5) * 1.4 + (hash(i + b * 9, y >> 3, 53) - 0.5); if (i === 7) c = 0.5; else if (i === 0) c += 1; const hoop = (y > 7 && y < 12) || (y > 35 && y < 40);
    p.set(x, y, hoop ? STONE[y === 8 || y === 36 ? 4 : y === 11 || y === 39 ? 0 : 2] : WOOD[clamp(Math.round(c), 0, 6)]); } return p.tex(); }

// the people of the village, drawn small: 32 by 48 pixels each, twice (standing, and a breath later)
export const FOLK = { n: 10, cw: 32, ch: 48, foot: 2 };
function folk() {
  const { n, cw, ch } = FOLK, p = new Pix(cw * n * 2, ch), INK = [34, 22, 32];
  const SKINS = [pal('#9a6244 #c88c64 #e8b48a #f8d8b4 #fde8cc'), pal('#7a4a30 #a06c48 #c08a62 #dcaa80 #ecc49c'), pal('#a8704e #d69c74 #f0c098 #fce0c0 #fff0dc')];
  const HAIR = [pal('#2e1c12 #4a2e1c #6a4428 #8a5e38'), pal('#14121c #262230 #3c3848 #565064'), pal('#7a5a1a #a8822a #d0aa42 #eccc66'), pal('#5e5e66 #86868e #aeaeb4 #d2d2d6'), pal('#5a2210 #86381a #b25426 #d8773a')];
  const CLOTH = [pal('#1e3e2a #2c5c3c #3e7a50 #5a9e6a #7cbc86'), pal('#561c1a #802a26 #a83c32 #cc5a4a #e68270'), pal('#1c2e52 #2a4678 #3c629e #5a84c4 #82a8de'), pal('#56421c #806428 #a68838 #cca852 #e6c878'), pal('#3c2a52 #584078 #765a9c #987cc0 #b8a0d8'), pal('#524c40 #767062 #989080 #bab2a0 #d6cebc'), pal('#16464a #22686c #328a8c #4cacac #76cccc')];
  const HAT = pal('#5e4618 #8a6c28 #b4923c #d8b858 #f0d680'), WHITE = pal('#a89e88 #cfc6b0 #ece4d0 #fbf6ea');
  for (let i = 0; i < n; i++) for (let f = 0; f < 2; f++) {
    const o = (i * 2 + f) * cw, q = rng(500 + i * 7), hair = HAIR[Math.floor(q() * HAIR.length)], top = CLOTH[Math.floor(q() * CLOTH.length)], low = CLOTH[Math.floor(q() * CLOTH.length)], dress = q() < 0.45, hat = q() < 0.3, apron = q() < 0.35, scarf = dress && q() < 0.4, skin = SKINS[Math.floor(q() * SKINS.length)], d = f;
    const px = (x, y, c) => p.put(o + x, y, c), tone = (x, cx, hw, P) => { const k = (x - cx) / hw; return P[k < -0.55 ? P.length - 1 : k < -0.1 ? P.length - 2 : k < 0.5 ? P.length - 3 : P.length - 4]; };
    // legs and shoes, or a skirt to the ankle
    if (dress) { for (let y = 29; y < 44; y++) { const hw = 6 + (y - 29) * 0.3; for (let x = Math.round(16 - hw); x < Math.round(16 + hw); x++) { let c = tone(x, 16, hw, low); if ((x + 100) % 5 === 0 && y > 32) c = low[1]; if (y === 43) c = low[0]; else if (y === 42) c = low[4]; px(x, y, c); } } for (const x of [12, 13, 18, 19]) { px(x, 44, BEAM[1]); px(x, 45, BEAM[0]); } }
    else { for (let y = 33; y < 43; y++) { for (let x = 11; x < 16; x++) px(x, y, tone(x, 13, 3, low)); for (let x = 16; x < 21; x++) px(x, y, tone(x, 19, 3, low)); px(15, y, low[0]); if (y === 38) { px(12, y, low[1]); px(18, y, low[1]); } }
      for (let x = 10; x < 16; x++) { px(x, 43, BEAM[3]); px(x, 44, BEAM[2]); px(x, 45, BEAM[0]); } for (let x = 16; x < 22; x++) { px(x, 43, BEAM[2]); px(x, 44, BEAM[1]); px(x, 45, BEAM[0]); } }
    // the body, an arm at each side, hands
    for (let y = 21 + d; y < (dress ? 31 : 34); y++) { const hw = y < 23 + d ? 6 : 7; for (let x = 16 - hw; x < 16 + hw; x++) px(x, y, tone(x, 16, hw, top)); }
    for (let y = 22 + d; y < 33 + d; y++) for (const [x0, sh] of [[7, 0], [23, 1]]) for (let x = x0; x < x0 + 3; x++) px(x, y, y > 30 + d ? skin[sh ? 1 : 3] : top[sh ? (x === x0 + 2 ? 0 : 1) : (x === x0 ? 4 : 3)]);
    for (let y = 22 + d; y < 30 + d; y++) { px(9, y, top[1]); px(22, y, top[0]); }
    px(15, 21 + d, skin[1]); px(16, 21 + d, skin[1]); for (let x = 13; x < 19; x++) px(x, 22 + d, top[4]);                    // a collar
    if (!dress) { for (let x = 9; x < 23; x++) { px(x, 32, BEAM[2]); px(x, 33, BEAM[0]); } px(15, 32, HAT[3]); px(16, 32, HAT[3]); for (let y = 24 + d; y < 31; y += 3) px(16, y, top[0]); }
    if (apron) { for (let y = 24 + d; y < (dress ? 40 : 34); y++) for (let x = 12; x < 20; x++) px(x, y, WHITE[x === 12 ? 3 : x === 19 ? 0 : (y % 6 === 5 ? 1 : 2)]); px(11, 25 + d, WHITE[1]); px(20, 25 + d, WHITE[1]); }
    // a big head: a face with eyes, cheeks and a mouth
    for (let y = 6 + d; y < 21 + d; y++) for (let x = 7; x < 25; x++) { const ex = (x - 15.5) / 8.4, ey = (y - (13 + d)) / 7.6; if (ex * ex + ey * ey > 1) continue; px(x, y, ex < -0.5 ? skin[4] : ex > 0.62 || ey > 0.72 ? skin[1] : ex > 0.3 ? skin[2] : skin[3]); }
    for (const ex of [11, 18]) { px(ex, 13 + d, INK); px(ex + 1, 13 + d, INK); px(ex, 14 + d, INK); px(ex + 1, 14 + d, INK); px(ex, 15 + d, INK); px(ex + 1, 15 + d, INK); px(ex, 13 + d, [250, 250, 255]); px(ex, 12 + d, hair[0]); px(ex + 1, 12 + d, hair[0]); }
    px(9, 16 + d, [236, 150, 130]); px(10, 16 + d, [236, 150, 130]); px(21, 16 + d, [226, 140, 120]); px(22, 16 + d, [226, 140, 120]); px(15, 18 + d, skin[0]); px(16, 18 + d, skin[0]); px(15, 16 + d, skin[2]);
    // hair (or a kerchief), and for some a straw hat
    const H = scarf ? top.slice(1) : hair;
    for (let y = 3 + d; y < 21 + d; y++) for (let x = 5; x < 27; x++) { const ex = (x - 15.5) / 9.4, ey = (y - (12 + d)) / 8.8; if (ex * ex + ey * ey > 1) continue; const fringe = 10 + d + ((x + i) % 4 === 0 ? 1 : 0) + (Math.abs(x - 15.5) > 6 ? 2 : 0), side = Math.abs(x - 15.5) > 7.2 && y < (dress ? 21 : 15) + d;
      if (y < fringe || side) px(x, y, ex < -0.45 ? H[3] : ex > 0.5 ? H[0] : ey < -0.55 ? H[2] : H[1]); }
    if (dress && !scarf) for (let y = 19 + d; y < 25 + d; y++) { for (const x of [6, 7]) px(x, y, H[2]); for (const x of [24, 25]) px(x, y, H[0]); }
    if (scarf) { for (let x = 13; x < 19; x++) px(x, 21 + d, H[2]); px(15, 22 + d, H[3]); px(16, 23 + d, H[1]); }
    else for (let k = 0; k < 5; k++) px(9 + k * 3, 5 + d + (k % 2), H[3]);
    if (hat) { for (let y = 1 + d; y < 7 + d; y++) for (let x = 9; x < 23; x++) { if (y === 1 + d && (x < 11 || x > 20)) continue; px(x, y, tone(x, 16, 7, HAT)); } for (let x = 9; x < 23; x++) px(x, 6 + d, CLOTH[(i + 1) % CLOTH.length][2]);
      for (let x = 3; x < 29; x++) { px(x, 7 + d, tone(x, 16, 13, HAT)); px(x, 8 + d, x < 6 || x > 25 ? HAT[1] : HAT[x < 14 ? 3 : 2]); } for (let x = 6; x < 26; x++) px(x, 9 + d, HAT[0]); }
  }
  for (let k = 0; k < p.w * p.h; k++) { const d = p.d, i = k * 4, l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] = (l + (d[i] - l) * 0.62) * 0.97; d[i + 1] = (l + (d[i + 1] - l) * 0.62) * 0.93; d[i + 2] = (l + (d[i + 2] - l) * 0.62) * 0.86; }      // country cloth: dyes gone dull, a little sun-browned
  const a = new Uint8Array(p.w * p.h); for (let k = 0; k < a.length; k++) a[k] = p.d[k * 4 + 3];                    // a dark line round each
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { if (a[y * p.w + x]) continue; const on = (xx, yy) => xx >= 0 && yy >= 0 && xx < p.w && yy < p.h && a[yy * p.w + xx]; if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) p.put(x, y, INK); }
  return p.tex({ repeat: false, alpha: true });
}
// The wanderer, a lone swordsman of the road: a wide low straw hat that hides his eyes, a crimson scarf with a long tail, a pale jacket, dark wide trousers
// and arm guards, a sword at his hip, a crooked staff with a lantern hanging from it. Three views (toward the eye, away, sideways facing right), each with four
// steps of a walk and two of standing; a dark line round him, and the sun on his upper left edges.
export const HERO = { cw: 56, ch: 64, foot: 3, walk: 8, idle: 2, run: 8, cols: 18, views: 5, scale: 1.2, stride: 1.7, runStride: 2.7, lantern: [[-19, 35], [19, 35], [18, 35]], lanternRun: [] };
function hero() {
  const { cw, ch } = HERO, p = new Pix(cw * HERO.cols, ch * HERO.views), INK = [22, 14, 20], cx = 28;
  const HATP = pal('#4a3a22 #8a7650 #b8a67a #d8caa0 #efe6c6 #fffbe8'), SKIN = pal('#4e3228 #8e6248 #c89a74 #eecaa4'), RED = pal('#2a0a10 #4c1016 #741a1e #9a2426 #be3430 #dc5444'), GI = pal('#5c5242 #8c8068 #b8ae90 #dcd4b6 #f4eed8'), IND = pal('#0c0d16 #181a28 #262a3c #383c54 #4e5470'), WD = pal('#24140c #4a2a18 #6e4426 #96643a #b88a56'), HAIR = pal('#120e10 #241a1c'), GL = pal('#ffc45e #ffe29a #fff8d8');
  for (let v = 0; v < HERO.views; v++) for (let f = 0; f < HERO.cols; f++) {
    const ox = f * cw, oy = v * ch, run = f >= 10, walk = f < 8 || run, ph = run ? (f - 10) / 8 : f / 8, back = v === 1, side = v === 2, front = v === 0, fd = v === 3, bd = v === 4;
    // (after the eight steps of his walk and the two of standing come eight of a run: a long stride with both feet off the ground between, the body thrown forward, the scarf out straight behind, the staff carried clear of the ground)
    const bob = run ? Math.round(1.5 * Math.cos((ph - 0.19) * 12.566)) : walk ? [0, 1, 0, -1, 0, 1, 0, -1][f] : (f === 9 ? 1 : 0), sw = walk ? Math.sin(ph * 6.2832) * (run ? 1.7 : 1) : (f === 9 ? 0.5 : 0), lsw = run ? Math.round(Math.sin(ph * 12.566 - 0.6) * 1.5) - (front || back ? 0 : 2) : walk ? Math.round(Math.sin(ph * 6.2832 - 0.8) * 1.2) : (f === 9 ? 1 : 0);
    const lean = run ? (side ? 0.17 : fd || bd ? 0.1 : 0) : 0, LX = (y) => Math.round(Math.max(0, 42 - y) * lean);      // (the last two: half toward the eye and to the right, half away and to the right)
    // a leg through one stride: planted, it goes back under him at the pace he walks; lifted, it swings forward quickly at first and slowing, the knee leading, the foot clear of the ground
    const S = run ? 9 : 6, pose = (q) => { q = ((q % 1) + 1) % 1; if (!walk) return { ax: 0, lift: 0, kx: 0 };
      if (run) { if (q < 0.38) { const u = q / 0.38; return { ax: S - 2 * S * u, lift: 0, kx: 1.5 * Math.sin(Math.PI * u) }; } const u = (q - 0.38) / 0.62, e = u * u * (3 - 2 * u); return { ax: -S + 2 * S * e, lift: Math.sin(Math.PI * Math.pow(u, 0.75)) * 6.5, kx: Math.sin(Math.PI * u) * 5.5 }; }
      if (q < 0.5) { const u = q / 0.5; return { ax: S - 2 * S * u, lift: 0, kx: u < 0.3 ? 1 : 0 }; } const u = (q - 0.5) / 0.5, e = u * u * (3 - 2 * u); return { ax: -S + 2 * S * e, lift: Math.sin(Math.PI * u) * 3.2, kx: Math.sin(Math.PI * u) * 3 }; };
    const leg = (x, y, c) => p.put(ox + Math.round(x), oy + Math.round(y), c), px = (x, y, c) => p.put(ox + Math.round(x) + LX(y), oy + Math.round(y) + bob, c);
    const span = (y, x0, x1, P, hi, lo, sd = 0) => { x0 = Math.round(x0); x1 = Math.round(x1); for (let x = x0; x <= x1; x++) { const k = x1 > x0 ? (x - x0) / (x1 - x0) : 0.5, t = hi - k * (hi - lo) * 1.1 + (hash(x, y, 300 + sd + v) - 0.5) * 0.3; px(x, y, P[clamp(Math.round(t), Math.max(0, lo - 1), hi)]); } };
    const line = (x0, y0, x1, y1, fn) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) fn(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), i, n); };
    // the sword's scabbard where it shows behind him, and the scarf's tail where it hangs behind
    if (side) line(cx - 1, 40, cx - 11, 46, (x, y) => { px(x, y - 1, IND[4]); px(x, y, IND[1]); });
    if (fd) line(cx - 4, 42, cx - 9, 46, (x, y) => { px(x, y - 1, IND[4]); px(x, y, IND[1]); });
    if (front) { line(cx + 5, 41, cx + 8, 51, (x, y) => { px(x, y, IND[3]); px(x + 1, y, IND[1]); }); for (let y = 28; y <= 45; y++) { const s = Math.round(sw * (y - 28) / 12); if (y === 45 && (s & 1)) continue; px(cx + 5 + s, y, RED[2]); px(cx + 6 + s, y, RED[1]); if (y < 42) px(cx + 7 + s, y, RED[0]); } }
    if (back || bd) line(cx - 4, 40, cx - 11, 47, (x, y) => { px(x, y - 1, IND[4]); px(x, y, IND[1]); });
    // wide dark trousers, and boots
    if (front || back) for (const [x0, L] of [[cx - 5, 1], [cx, 0]]) { const o = pose(ph + (L ? 0 : 0.5)), foot = 60 - Math.round(o.lift); for (let y = 41; y <= foot - 3; y++) { const fl = y > 50 ? 1 : 0; for (let x = x0 - (L ? fl : 0); x <= x0 + 4 + (L ? 0 : fl); x++) { const k = x - x0; leg(x, y, IND[!L && k === 0 ? 0 : k === 2 && y > 43 ? 1 : L ? (k < 2 ? 3 : 2) : (k < 3 ? 2 : 1)]); } }
      for (let x = x0; x <= x0 + 4; x++) { leg(x, foot - 2, WD[x === x0 ? 2 : 1]); leg(x, foot - 1, WD[1]); leg(x, foot, WD[0]); } }
    else for (const nearLeg of [0, 1]) { const o = pose(ph + (nearLeg ? 0 : 0.5)); if (!side) { o.ax *= 0.55; o.kx *= 0.55; } const ay = 57 - Math.round(o.lift), h0 = side ? cx - 1 : (fd ? [cx + 1, cx - 2] : [cx - 2, cx + 1])[nearLeg];
      for (let y = 41; y <= ay; y++) { const t = (y - 41) / (ay - 41), xc = Math.round(h0 + 2 * t * (1 - t) * (o.ax / 2 + 2 * o.kx) + t * t * o.ax), wide = t > 0.6 ? 1 : 0; for (let x = xc - 2 - wide; x <= xc + 2; x++) { const k = x - (xc - 2); leg(x, y, IND[nearLeg ? (k < 1 ? 3 : k < 3 ? 2 : 1) : (k < 2 ? 1 : 0)]); } }
      const fx = Math.round(h0 + o.ax); for (let x = fx - 2; x <= fx + 3; x++) { leg(x, ay + 1, WD[nearLeg ? 2 : 1]); leg(x, ay + 2, WD[1]); leg(x, ay + 3, WD[0]); } }
    // the jacket, the sash, the scarf round his neck and what it does from there
    const hwT = side ? 3 : fd || bd ? 4 : 5; for (let y = 27; y <= 38; y++) span(y, cx - hwT, cx + hwT - (side ? 0 : 1), GI, 4, 2, 2);
    if (front) { line(cx + 1, 27, cx - 2, 33, (x, y) => px(x, y, GI[1])); for (let y = 26; y <= 36; y++) span(y, cx - 1 + (y - 26) * 0.5, cx + 5, RED, 5, 2, 1); }
    if (fd) for (let y = 26; y <= 36; y++) span(y, cx + 1 + (y - 26) * 0.35, cx + 4, RED, 5, 2, 1);
    if (back || bd) for (let y = 30; y <= 37; y++) px(cx - (bd ? 1 : 0), y, GI[1]);
    for (let x = cx - hwT; x <= cx + hwT - (side ? 0 : 1); x++) { px(x, 38, WD[2]); px(x, 39, WD[1]); px(x, 40, WD[0]); }
    if (side) { for (const y of [38, 39, 40, 41]) px(cx - 4, y, WD[y < 40 ? 3 : 1]); line(cx + 1, 38, cx + 6, 36, (x, y, i) => { px(x, y, i === 0 ? HATP[3] : i % 2 ? IND[4] : GI[3]); px(x, y + 1, IND[0]); }); }
    else if (back || bd) { const b0 = bd ? cx - 3 : cx - 2; for (let x = b0; x <= b0 + 3; x++) { px(x, 38, WD[4]); px(x, 39, WD[3]); } for (const y of [40, 41, 42, 43]) { px(b0, y, WD[2]); px(b0 + 3, y, WD[1]); } }
    else { px(cx - 4, 38, WD[4]); px(cx - 3, 38, WD[4]); for (const y of [40, 41, 42, 43, 44]) px(cx - 4, y, WD[y < 43 ? 2 : 1]); px(cx + (fd ? 4 : 5), 39, HATP[3]); px(cx + (fd ? 4 : 5), 40, HATP[1]); line(cx + (fd ? 5 : 6), 38, cx + 8, 36, (x, y, i) => { px(x, y, i % 2 ? GI[3] : IND[4]); px(x, y + 1, IND[0]); }); }
    for (let y = 23; y <= 27; y++) span(y, cx - (front || back ? 5 : 4) + (y === 23 ? 1 : 0), cx + 4 - (y === 23 ? 1 : 0), RED, 5, 3, 3);
    if (side || fd) { const tn = (side ? 14 : 9) + (run ? 4 : 0); for (let i = 0; i <= tn; i++) { const x = cx - 4 - i, y = 25 + i * (run ? 0.1 : walk ? 0.5 : 0.85) * (side ? 1 : 1.5) + Math.sin(i * 0.7 - ph * 6.2832 * (run ? 2 : 1)) * (i / tn) * (run ? 2.3 : 1.8), th = i < tn * 0.36 ? 4 : i < tn * 0.7 ? 3 : 2; if (i === tn && sw < 0) continue; for (let k = 0; k < th; k++) px(x, y + k, RED[k === 0 ? 5 : k === th - 1 ? 1 : 3]); } px(cx + 3, 28, RED[2]); px(cx + 4, 28, RED[1]); px(cx + 4, 29, RED[1]); }
    if (back || bd) for (let y = 27; y <= 45; y++) { const s = sw * (y - 27) / 12 - (bd ? 2 : 0), n = y > 38 ? (y - 38) * 0.35 : 0; if (y === 45) { px(cx - 2 + s, y, RED[1]); px(cx + s, y, RED[1]); continue; } span(y, cx - 4 + s + n, cx + 2 + s - n * 0.5, RED, 5, 1, 1); }
    // the arm that holds the staff (a dark guard on the forearm), the staff leaning a little, its crook, the lantern
    const dir = side || back || bd ? 1 : -1, slope = side ? (run ? 0.2 : 0.12) : fd || bd ? (run ? 0.14 : 0.09) : 0.07, hx = side ? cx + 9 : back ? cx + 11 : bd ? cx + 10 : fd ? cx - 10 : cx - 12, xs = (y) => Math.round(hx + dir * (36 - y) * slope), sh = side ? cx + 1 : back ? cx + 5 : bd ? cx + 4 : fd ? cx - 5 : cx - 6, el = side ? cx + 4 : back ? cx + 8 : bd ? cx + 7 : fd ? cx - 8 : cx - 9;
    line(sh, 28, el, 32, (x, y) => { px(x, y - 1, GI[3]); px(x, y, GI[2]); px(x, y + 1, GI[1]); }); line(el, 32, hx - dir, 35, (x, y) => { px(x, y - 1, IND[4]); px(x, y, IND[2]); px(x, y + 1, IND[1]); });
    for (let y = 10; y <= (run ? 53 : 61 - bob); y++) { const x = xs(y), band = y % 8 === 3; px(x, y, WD[band ? 1 : 3]); px(x + 1, y, WD[band ? 0 : 1]); }
    const tx = xs(10) + (dir > 0 ? 1 : 0); for (const [ax, ay] of [[1, 9], [2, 8], [3, 8], [4, 8], [5, 9], [5, 10]]) { px(tx + dir * ax, ay, WD[3]); px(tx + dir * ax, ay + 1, WD[1]); }
    for (const y of [34, 35, 36]) { px(xs(y) - 1, y, SKIN[3]); px(xs(y), y, SKIN[3]); px(xs(y) + 1, y, SKIN[2]); px(xs(y) + 2, y, SKIN[y === 36 ? 1 : 2]); }
    { const hang = tx + dir * 5, lc = hang + lsw, x0 = lc - 3, x1 = lc + 3; if (f === 8) HERO.lantern[v] = [lc - cx, 61 - 27]; if (f === 10) HERO.lanternRun[v] = [lc - cx + LX(27) + 2, 61 - 27]; for (let y = 12; y <= 19; y++) px(hang, y, WD[y % 2 ? 0 : 2]);
      for (let x = x0 + 2; x <= x1 - 2; x++) px(x, 20, WD[1]); for (let x = x0 + 1; x <= x1 - 1; x++) px(x, 21, WD[2]); for (let x = x0; x <= x1; x++) { px(x, 22, WD[0]); px(x, 31, WD[0]); } for (let x = x0 + 1; x <= x1 - 1; x++) px(x, 32, WD[1]);
      for (let y = 23; y <= 30; y++) for (let x = x0; x <= x1; x++) px(x, y, x === x0 || x === x1 ? WD[0] : x === lc ? WD[2] : y === 26 ? GL[0] : y >= 29 ? GL[0] : x < lc ? GL[2] : GL[1]); }
    // what shows of his head under the brim: no eyes, only the jaw in the hat's shadow
    if (back || bd) { for (let y = 20; y <= 22; y++) for (let x = cx - 3; x <= cx + 2; x++) px(x, y, HAIR[x < cx ? 1 : 0]); if (bd) { px(cx + 2, 21, SKIN[1]); px(cx + 2, 22, SKIN[2]); px(cx + 3, 22, SKIN[2]); } }
    else if (side || fd) { const hb = fd ? cx - 2 : cx; for (let y = 20; y <= 22; y++) for (let x = cx - 3; x <= cx + 3; x++) px(x, y, x < hb ? HAIR[y === 20 ? 0 : 1] : y === 20 ? SKIN[0] : y === 21 ? (x > cx + 1 ? SKIN[2] : SKIN[1]) : (x > cx ? SKIN[3] : SKIN[2])); if (side) px(cx + 4, 21, SKIN[2]); }
    else { for (let y = 20; y <= 22; y++) for (let x = cx - 4; x <= cx + 3; x++) px(x, y, x === cx - 4 || x === cx + 3 ? HAIR[1] : y === 20 ? SKIN[0] : y === 21 ? SKIN[1] : (x < cx ? SKIN[3] : SKIN[2])); }
    // the hat: a wide low cone of woven straw, its brim down over his eyes
    px(cx - 1, 8, HATP[4]); px(cx, 8, HATP[2]);
    for (let y = 9; y <= 19; y++) { const hw = 1.5 + (y - 9) * 1.4; for (let x = Math.round(cx - hw); x <= Math.round(cx + hw) - 1; x++) { const k = (x - (cx - hw)) / (2 * hw), t = 5.2 - k * 3.3 - (y % 3 === 1 ? 0.55 : 0) + (hash(x, y, 311) - 0.5) * 0.4 - (y === 19 ? 0.8 : 0); px(x, y, HATP[clamp(Math.round(t), 1, 5)]); } }
    for (let x = cx - 13; x <= cx + 12; x++) px(x, 20, x > cx - 5 && x < cx + 4 ? HATP[0] : HATP[1]);
  }
  const a = new Uint8Array(p.w * p.h); for (let k = 0; k < a.length; k++) a[k] = p.d[k * 4 + 3];
  const on = (x, y) => x >= 0 && y >= 0 && x < p.w && y < p.h && a[y * p.w + x];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (a[y * p.w + x]) { if (!on(x - 1, y) || !on(x, y - 1)) { const i = (y * p.w + x) * 4; if (p.d[i] + p.d[i + 1] + p.d[i + 2] > 150) for (let c = 0; c < 3; c++) p.d[i + c] = Math.min(255, p.d[i + c] * 1.2 + 12); } continue; }
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) p.put(x, y, INK);
  }
  return p.tex({ repeat: false, alpha: true });
}
function gull() { const p = new Pix(64, 16), W = [248, 246, 240], G = [156, 162, 178], K = [60, 60, 70];        // a gull, wings up and wings down
  for (let f = 0; f < 2; f++) { for (let x = 0; x < 32; x++) { const k = 1 - Math.abs(x - 15.5) / 15.5, y = f ? 10 - Math.round(4 * k) : 2 + Math.round(7 * k), tip = x < 4 || x > 27; for (let j = 0; j < (tip ? 1 : 2 + (k > 0.6 ? 1 : 0)); j++) p.put(f * 32 + x, y + j, tip ? K : j === 0 ? W : G); }
    for (let x = 13; x < 19; x++) for (let y = 0; y < 3; y++) p.put(f * 32 + x, (f ? 6 : 9) + y, y === 2 ? G : W); p.put(f * 32 + 19, f ? 7 : 10, [232, 170, 60]); }
  return p.tex({ repeat: false, alpha: true }); }
function puff() { const s = 48, p = new Pix(s, s), r = rng(77), B = Array.from({ length: 7 }, () => [12 + r() * 24, 14 + r() * 22, 8 + r() * 8]);        // a puff of smoke: a few round lumps, lighter on top
  p.each((x, y) => { let k = 0, lit = 0; for (const [bx, by, br] of B) { const v = 1 - Math.hypot(x - bx, y - by) / br; if (v > k) { k = v; lit = (by - y) / br; } } if (k <= 0) return [0, 0, 0, 0]; const t = lit > 0.35 ? 255 : lit > -0.2 ? 228 : 198; return [t, t, t, k < 0.16 && (x + y) % 2 ? 0 : 255]; }); return p.tex({ repeat: false, alpha: true }); }
function cloth() { const cw = 24, chh = 28, p = new Pix(cw * 4, chh), C = [pal('#a69c86 #c8bfa8 #e4dcc6 #f6f0de'), pal('#22386a #34548e #4a72b2 #6e94d0'), pal('#9c9278 #c2b89c #e0d6bc #f2ead6'), pal('#6a2420 #963630 #bc5044 #d87868')];      // washing: shirts and cloths, pegged
  for (let i = 0; i < 4; i++) { const o = i * cw, c = C[i], shirt = i % 2 === 0;
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) { let on = x >= 4 && x <= 19; if (shirt && y < 10) on = x >= 0 && x <= 23 && !(y > 7 && (x < 3 || x > 20)); if (shirt && y < 3 && x > 9 && x < 14) on = false; if (!shirt && y > chh - 3 && (x >> 1) % 3 === 0) on = false; if (!on) continue;
      let t = x < 7 ? 3 : x > 17 ? 0 : 2; if ((x + (y >> 2)) % 9 < 2) t = Math.max(0, t - 1); if (y === chh - 1) t = 0; if (!shirt && i === 1 && y % 8 > 5) t = 3; p.put(o + x, y, c[t]); }
    for (const x of [5, 18]) { p.put(o + x, 0, WOOD[5]); p.put(o + x, 1, WOOD[3]); p.put(o + x, 2, WOOD[1]); } }
  return p.tex({ repeat: false, alpha: true }); }
function lamp() { const p = new Pix(8, 8); p.each((x, y) => (x === 0 || x === 7 || y === 0 || y === 7 ? [70, 40, 16] : x === 3 || x === 4 ? [255, 236, 170] : [255, 196, 96])); return p.tex({ bump: 0 }); }      // a lantern's horn panes, lit
function sack() { const p = new Pix(32, 32); p.each((x, y) => { const k = ((x + y) & 1) ? 0.06 : -0.06, t = 0.62 + k + (hash(x >> 2, y >> 2, 96) - 0.5) * 0.16 - (y % 8 === 7 ? 0.2 : 0); return [176 * t, 150 * t, 108 * t].map((v) => clamp(v + 60 * t, 0, 255)); }); return p.tex({ bump: 4 }); }      // sackcloth
function signs() {                                       // boards that hang by a door, each with what is sold or done there: a sack of goods, a mug, a boot, an ear of wheat
  const p = new Pix(64, 16);
  for (let e = 0; e < 4; e++) { const o = e * 16, C = [228, 208, 150], K = (x, y) => p.put(o + x, y, C);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d > 7.6) continue; p.put(o + x, y, d > 6.4 ? BEAM[1] : WOOD[clamp(Math.round(4 - (x + y - 15) * 0.12 + (hash(x, y >> 1, 97 + e) - 0.5)), 2, 5)]); }
    if (e === 0) { for (let y = 6; y <= 10; y++) for (let x = 5; x <= 10; x++) K(x, y); for (let x = 6; x <= 9; x++) K(x, 5); K(7, 4); K(8, 4); }
    if (e === 1) { for (let y = 5; y <= 10; y++) for (let x = 5; x <= 8; x++) K(x, y); K(9, 6); K(10, 7); K(10, 8); K(9, 9); }
    if (e === 2) { for (let y = 4; y <= 9; y++) { K(6, y); K(7, y); } for (let x = 6; x <= 10; x++) { K(x, 10); K(x, 11); } K(8, 9); }
    if (e === 3) { for (let y = 4; y <= 11; y++) K(8, y); for (const [x, y] of [[6, 5], [10, 5], [6, 7], [10, 7], [7, 6], [9, 6], [7, 8], [9, 8], [6, 9], [10, 9]]) K(x, y); } }
  return p.tex({ repeat: false, alpha: true });
}
function awning() { const p = new Pix(32, 32), A = pal('#6e2a26 #8e3a34 #a64a40 #b8ac90 #d2c6a8 #e6dcc0'); p.each((x, y) => { const st = Math.floor(x / 8) % 2, t = (st ? 4 : 1) + (x % 8 === 0 || x % 8 === 7 ? -1 : 0) + (y < 3 ? 1 : y > 27 ? -1 : 0) + (hash(x, y, 98) < 0.06 ? -1 : 0); return A[clamp(t, st ? 3 : 0, st ? 5 : 2)]; }); return p.tex({ bump: 2 }); }      // striped cloth over a shop's window
function verge() {                                        // the grass's ragged edge where it grows in over the cobbles (the foot of the picture is the grass's side)
  const w = 64, h = 32, p = new Pix(w, h);
  for (let x = 0; x < w; x++) { const hg = 8 + Math.floor(hash(x >> 2, 0, 141) * 10 + hash(x, 1, 141) * 7);
    for (let j = 0; j < hg; j++) { const y = h - 1 - j; p.put(x, y, j === hg - 1 ? GRASS[5] : j === hg - 2 ? GRASS[4] : GRASS[clamp(Math.round(2.6 + (hash(x, y, 142) - 0.5) * 2.4), 1, 4)]); }
    if (hash(x, 2, 141) < 0.18) p.put(x, h - 1 - hg - 2, GRASS[4]); }
  return p.tex({ alpha: true });
}
function plaster() { const p = new Pix(128, 128), r = rng(73); daub(p, r, 0, 0, 128, 128); return p.tex(); }

export function makeTextures() {
  return { verge: verge(), hero: hero(), signs: signs(), awning: awning(), lamp: lamp(), sack: sack(), rock: rock(), slab: slab(), crag: crag(), boulder: boulder(), cobble: cobble(), stone: blocks(STONE, 23, 3).tex(), step: blocks(SLAB, 27, 4).tex(), riser: blocks(SLAB, 29, 2).tex(), slate: slate(), tile: slate(TILE, 33, 3), thatch: thatch(), wood: planks(), barrel: barrel(), plaster: plaster(), grass: ground(101, true), dirt: ground(103, false),
    leaf: leaves(), gablet: gablet(), folk: folk(), gull: gull(), puff: puff(), cloth: cloth(), walls: walls(), flags: flags(), fall: fall(), stream: stream(), tuft: tuft(), sail: sail(), soft: soft() };
}
