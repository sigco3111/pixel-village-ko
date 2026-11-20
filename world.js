// The village, built by code: rock stacks rising from the sea, terraces on them at seven heights, houses, stairs cut
// between the terraces, two rope bridges over the gap, a windmill on the highest crag of the left stack, falling water.
// Everything is made of flat faces whose pictures come from textures.js at one size of pixel, so it all reads as drawn.
import * as THREE from './lib/three.module.js';
import { D, rng, WALL } from './textures.js';

const V = (x, y, z) => [x, y, z];
// The village can build itself before the eye: every piece is told when it comes (in seconds) and what point it grows from, and the materials grow it.
// A piece's tag is [x, y, z, when]; when is negative for one that only rises (from the height y), positive for one that swells out from the point.
export const BUILD = { value: 1e3 };
const grown = (mat) => { mat.onBeforeCompile = (sh) => { sh.uniforms.uBuild = BUILD; sh.vertexShader = 'attribute vec4 grow; uniform float uBuild;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  { float gs = clamp((uBuild - abs(grow.w)) / 0.7, 0.0, 1.0) - 1.0; bool unborn = gs <= -1.0; gs = 1.0 + 2.5 * gs * gs * gs + 1.5 * gs * gs; if (unborn) transformed = grow.xyz; else if (grow.w < 0.0) transformed.y = grow.y + (transformed.y - grow.y) * gs; else transformed = grow.xyz + (transformed - grow.xyz) * gs; }`); }; return mat; };
export class Mesher {
  constructor(tex) { this.tex = tex; this.b = {}; this.m = null; this.tag = [0, -3, 0, -0.05]; }
  buf(k) { return (this.b[k] ??= { pos: [], uv: [], nrm: [], grow: [] }); }
  P(p) { if (!this.m) return p; const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(this.m); return [v.x, v.y, v.z]; }
  size(k) { return this.tex[k].userData.size; }
  auto(k, a, b, c) {                                    // where no place on the picture is given, a face takes it from where it is in the world, so pictures run on across faces
    const [tw, th] = this.size(k), ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = Math.abs(uy * vz - uz * vy), ny = Math.abs(uz * vx - ux * vz), nz = Math.abs(ux * vy - uy * vx);
    const f = ny >= nx && ny >= nz ? (p) => [p[0] * D / tw, -p[2] * D / th] : nx >= nz ? (p) => [p[2] * D / tw, p[1] * D / th] : (p) => [p[0] * D / tw, p[1] * D / th];
    return [f(a), f(b), f(c)];
  }
  tri(k, a, b, c, ua, ub, uc, na, nb, nc) { a = this.P(a); b = this.P(b); c = this.P(c); if (!ua) [ua, ub, uc] = this.auto(k, a, b, c); const B = this.buf(k); B.pos.push(...a, ...b, ...c); B.uv.push(...ua, ...ub, ...uc); B.grow.push(...this.tag, ...this.tag, ...this.tag);
    if (!na) { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z); na = nb = nc = l > 1e-9 ? [x / l, y / l, z / l] : [0, 1, 0]; }      // a flat face, unless it is told which way each corner faces
    B.nrm.push(...na, ...nb, ...nc); }
  quad(k, a, b, c, d, uv) { if (uv) { const [u0, v0, u1, v1] = uv; this.tri(k, a, b, c, [u0, v0], [u1, v0], [u1, v1]); this.tri(k, a, c, d, [u0, v0], [u1, v1], [u0, v1]); } else { this.tri(k, a, b, c); this.tri(k, a, c, d); } }
  prism(k, pts, y0, y1, top = k) {                      // an outline pushed up from y0 to y1: its sides, and its top if wanted
    const [tw, th] = this.size(k); let u = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      this.quad(k, V(p[0], y0, p[1]), V(q[0], y0, q[1]), V(q[0], y1, q[1]), V(p[0], y1, p[1]), [u * D / tw, y0 * D / th, (u + L) * D / tw, y1 * D / th]); u += L; }
    if (top) { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; this.tri(top, V(cx, y1, cz), V(p[0], y1, p[1]), V(q[0], y1, q[1])); } }
  }
  box(k, c, ux, uz, y0, y1, top = k) { const p = [[c[0] - ux[0] - uz[0], c[1] - ux[1] - uz[1]], [c[0] + ux[0] - uz[0], c[1] + ux[1] - uz[1]], [c[0] + ux[0] + uz[0], c[1] + ux[1] + uz[1]], [c[0] - ux[0] + uz[0], c[1] - ux[1] + uz[1]]]; this.prism(k, p, y0, y1, top); }
  cone(k, cx, cz, r0, r1, y0, y1, n = 8, top = null) {   // a round tower narrowing (or widening) upward
    const [tw, th] = this.size(k); for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, u0 = i / n * 6.2832 * r0 * D / tw, u1 = (i + 1) / n * 6.2832 * r0 * D / tw;
      this.quad(k, V(cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0), V(cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0), V(cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1), V(cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1), [u0, y0 * D / th, u1, y1 * D / th]);
      if (top) this.tri(top, V(cx, y1, cz), V(cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1), V(cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1)); }
  }
  seg(k, p, q, r) {                                     // a thin square bar from one place to another: ropes, rails, poles
    const d = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]), a = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 * d.length() ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).setLength(r), b = new THREE.Vector3().crossVectors(d, a).setLength(r);
    const c = (s, t, e) => [e[0] + a.x * s + b.x * t, e[1] + a.y * s + b.y * t, e[2] + a.z * s + b.z * t], ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < 4; i++) { const [s0, t0] = ring[i], [s1, t1] = ring[(i + 1) % 4]; this.quad(k, c(s0, t0, p), c(s1, t1, p), c(s1, t1, q), c(s0, t0, q)); }
  }
  lump(k, c, s, seed, squash = 0.8) {                    // a boulder or a bush: a rough ball, rounded, so the light turns over it
    const r = rng(seed), n = 9, rows = 5, pt = (i, j) => { if (j === 0) return V(c[0], c[1] - s * squash * 0.6, c[2]); if (j === rows) return V(c[0], c[1] + s * squash, c[2]);
      const a = (i % n) / n * 6.2832 + j * 0.4, e = (j / rows - 0.5) * 3.1416, k2 = this._lr[(j * n + (i % n))]; return V(c[0] + Math.cos(a) * Math.cos(e) * s * k2, c[1] + Math.sin(e) * s * squash * k2, c[2] + Math.sin(a) * Math.cos(e) * s * k2); };
    this._lr = Array.from({ length: n * (rows + 1) }, () => 0.72 + r() * 0.5);
    const [tw, th] = this.size(k), ang = (p) => Math.atan2(p[2] - c[2], p[0] - c[0]), pole = (p) => Math.abs(p[0] - c[0]) < 1e-6 && Math.abs(p[2] - c[2]) < 1e-6;
    const nr = (p) => { const x = p[0] - c[0], y = (p[1] - c[1]) / (squash * squash), z = p[2] - c[2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    const T = (a, b, d) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2], out = (uy * vz - uz * vy) * ((a[0] + b[0] + d[0]) / 3 - c[0]) + (uz * vx - ux * vz) * ((a[1] + b[1] + d[1]) / 3 - c[1]) + (ux * vy - uy * vx) * ((a[2] + b[2] + d[2]) / 3 - c[2]);
      if (out < 0) [b, d] = [d, b];
      const np = [a, b, d].filter((p) => !pole(p)), a0 = ang(np[0]), rel = (p) => { let x = ang(p) - a0; if (x > Math.PI) x -= 6.2832; if (x < -Math.PI) x += 6.2832; return x; }, mean = np.reduce((t, p) => t + rel(p), 0) / np.length;
      const cap = [a, b, d].some((p) => pole(p) && p[1] > c[1]), un = cap ? (p) => [p[0] * D / tw, -p[2] * D / th] : (p) => [(a0 + (pole(p) ? mean : rel(p))) * s * D / tw, p[1] * D / th];                   // its picture wraps round it in one piece
      this.tri(k, a, b, d, un(a), un(b), un(d), nr(a), nr(b), nr(d)); };
    for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) { const a = pt(i, j), b = pt(i + 1, j), c2 = pt(i + 1, j + 1), d = pt(i, j + 1); if (j > 0) T(a, b, c2); if (j < rows - 1) T(a, c2, d); }
  }
  meshes(mats) { const out = []; for (const [k, B] of Object.entries(this.b)) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nrm, 3)); g.setAttribute('grow', new THREE.Float32BufferAttribute(B.grow, 4));
      const m = new THREE.Mesh(g, mats[k]); m.castShadow = !mats[k].userData.noCast; m.receiveShadow = true; m.name = k; out.push(m); } return out; }
}

const blob = (c, r, seed, n = 18, rough = 0.16) => { const R = rng(seed); return Array.from({ length: n }, (_, i) => { const a = i / n * 6.2832, k = 1 + (R() - 0.5) * rough * 2; return [c[0] + Math.cos(a) * r[0] * k, c[1] + Math.sin(a) * r[1] * k]; }); };
const scaled = (pts, c, s) => pts.map((p) => [c[0] + (p[0] - c[0]) * s, c[1] + (p[1] - c[1]) * s]);
const inPoly = (pts, x, z) => { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };

const h3 = (x, y, z, s) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x, y, z, s) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = (t) => t * t * (3 - 2 * t), u = f(x - xi), v = f(y - yi), w = f(z - zi), L = (a, b, t) => a + (b - a) * t;      // smooth noise through space
  return L(L(L(h3(xi, yi, zi, s), h3(xi + 1, yi, zi, s), u), L(h3(xi, yi + 1, zi, s), h3(xi + 1, yi + 1, zi, s), u), v), L(L(h3(xi, yi, zi + 1, s), h3(xi + 1, yi, zi + 1, s), u), L(h3(xi, yi + 1, zi + 1, s), h3(xi + 1, yi + 1, zi + 1, s), u), v), w); };
// a face of living rock round an outline, from y1 down to y0. It swells into buttresses with deep creases between, juts out in beds, and widens toward its foot;
// the light turns over it, since every corner knows which way it faces. Answers with where any place on it stands.
function rockWall(m, pts, c, y1, y0, seed, { step = 0.45, grow = 0.085, amp = 1, top = null, free = false, clr = [1.7, 1.1] } = {}) {
  const P = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) P.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  const N = P.length, rows = Math.max(2, Math.round((y1 - y0) / step)), [tw, th] = m.size('crag'), U = [0], f = 0.45 / Math.max(step, 0.45);
  const out = P.map((p, i) => { const a = P[(i + N - 1) % N], b = P[(i + 1) % N]; let nx = b[1] - a[1], nz = a[0] - b[0]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; if (nx * (p[0] - c[0]) + nz * (p[1] - c[1]) < 0) { nx = -nx; nz = -nz; } return [nx, nz]; });
  for (let i = 0; i < N; i++) U.push(U[i] + Math.hypot(P[(i + 1) % N][0] - P[i][0], P[(i + 1) % N][1] - P[i][1]));
  const G = []; for (let j = 0; j <= rows; j++) for (let i = 0; i < N; i++) { const p = P[i], y = y1 - (y1 - y0) * j / rows, dep = y1 - y, k = Math.min(1, dep / 0.9);
    const b1 = Math.abs(vn(p[0] * 0.30 * f, y * 0.22 * f, p[1] * 0.30 * f, seed) * 2 - 1), b2 = Math.abs(vn(p[0] * 0.62 * f, y * 0.55 * f, p[1] * 0.62 * f, seed + 5) * 2 - 1), tr = (((y / 2.6 + vn(p[0] * 0.12, 0, p[1] * 0.12, seed + 9) * 1.5) % 1) + 1) % 1;
    let cl = 1; if (!free) for (const br of BRIDGES) for (const e of [br[0], br[1]]) { const ty = T[e[2]].y; if (y < ty - 1.8 || y > ty + 0.5) continue; cl = Math.min(cl, Math.max(0, Math.min(1, (Math.hypot(p[0] - e[0], p[1] - e[1]) - 1.3) / 0.8))); }
    if (!free) for (const [a, b, ya, yb] of SEGS) { if (y > Math.max(ya, yb) + 0.5 || y < Math.min(ya, yb) - 4.5) continue; cl = Math.min(cl, Math.max(0, Math.min(1, (near2(p[0], p[1], a, b) - clr[0]) / clr[1]))); }      // (the rock stands back where a stair runs, so the steps are not swallowed)
    const bulge = k * (Math.sqrt(b1) * 0.95 + Math.sqrt(b2) * 0.32 - 0.5 + 0.42 * (1 - tr) * Math.min(1, tr / 0.12)) * amp, d = (bulge > 0 ? bulge * cl : bulge) + grow * dep * (0.3 + 0.7 * cl); G.push([p[0] + out[i][0] * d, y, p[1] + out[i][1] * d, d]); }
  const at = (i, j) => G[Math.max(0, Math.min(rows, j)) * N + ((i % N) + N) % N];
  const NG = []; for (let j = 0; j <= rows; j++) for (let i = 0; i < N; i++) { const a = at(i - 1, j), b = at(i + 1, j), u = at(i, j - 1), d = at(i, j + 1), tx = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ty = [d[0] - u[0], d[1] - u[1], d[2] - u[2]];
    const n = [tx[1] * ty[2] - tx[2] * ty[1], tx[2] * ty[0] - tx[0] * ty[2], tx[0] * ty[1] - tx[1] * ty[0]], l = Math.hypot(n[0], n[1], n[2]) || 1, s = n[0] * out[i][0] + n[2] * out[i][1] < 0 ? -1 : 1; NG.push([n[0] / l * s, n[1] / l * s, n[2] / l * s]); }
  const nr = (i, j) => NG[j * N + (i % N)], uv = (i, j) => [U[i] * D / tw, (y1 - (y1 - y0) * j / rows) * D / th], v3 = (p) => V(p[0], p[1], p[2]);
  const tri = (i0, j0, i1, j1, i2, j2) => { let a = at(i0, j0), b = at(i1, j1), d = at(i2, j2), ua = uv(i0, j0), ub = uv(i1, j1), ud = uv(i2, j2), na = nr(i0, j0), nb = nr(i1, j1), nd = nr(i2, j2);
    const gx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), gy = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), gz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    if (gx * (na[0] + nb[0] + nd[0]) + gy * (na[1] + nb[1] + nd[1]) + gz * (na[2] + nb[2] + nd[2]) < 0) { [b, d] = [d, b]; [ub, ud] = [ud, ub]; [nb, nd] = [nd, nb]; }
    m.tri('crag', v3(a), v3(b), v3(d), ua, ub, ud, na, nb, nd); };
  for (let j = 0; j < rows; j++) for (let i = 0; i < N; i++) { tri(i, j, i + 1, j, i + 1, j + 1); tri(i, j, i + 1, j + 1, i, j + 1); }
  if (top) for (let i = 0; i < N; i++) { const p = P[i], q = P[(i + 1) % N]; m.tri(top, V(c[0], y1, c[1]), V(p[0], y1, p[1]), V(q[0], y1, q[1])); }
  return { N, rows, at };
}

// ---------------------------------------------------------------- the plan
export const TERRACES = [
  { id: 'L1', c: [-15, 9], r: [6.8, 5.2], y: 5, seed: 1 }, { id: 'L2', c: [-11, 0], r: [6.8, 4.7], y: 9.5, seed: 2 }, { id: 'L3', c: [-9, -9], r: [5.0, 4.2], y: 14.5, seed: 3 },
  { id: 'R1', c: [8, 1], r: [7.2, 5.2], y: 9.5, seed: 4 }, { id: 'R2', c: [8, -9], r: [6.2, 4.7], y: 14, seed: 5 }, { id: 'R3', c: [19, -13], r: [6.8, 4.7], y: 18, seed: 6 }, { id: 'R0', c: [13, 11], r: [6.8, 5.2], y: 5.5, seed: 7 }, { id: 'R4', c: [26.5, -5.5], r: [5.8, 6.2], y: 14, seed: 8 },
];
const T = Object.fromEntries(TERRACES.map((t) => [t.id, t]));
const HOUSES = [
  { on: 'L1', x: -18.4, z: 8.4, w: 4.2, d: 4.0, floors: 1, roof: 'slate', gable: true }, { on: 'L1', x: -14.2, z: 9.4, w: 4.0, d: 3.6, floors: 1, roof: 'slate', rot: 0.08, gable: true },
  { on: 'L2', x: -14.7, z: -0.5, w: 3.6, d: 3.4, floors: 1, roof: 'slate' }, { on: 'L2', x: -10.0, z: -0.6, w: 3.8, d: 4.0, floors: 1, roof: 'slate', gable: true },
  { on: 'R2', x: 6.8, z: -11.3, w: 4.4, d: 3.6, floors: 2, roof: 'slate', gable: true },
  { on: 'R3', x: 16.4, z: -14.0, w: 3.8, d: 3.4, floors: 1, roof: 'thatch', gable: true, crates: false }, { on: 'R3', x: 19.9, z: -12.8, w: 3.0, d: 3.0, floors: 2, roof: 'slate', gable: true },
  { on: 'R1', x: 8.8, z: -0.5, w: 4.6, d: 4.2, floors: 1, roof: 'slate', shop: true, gable: true }, { on: 'R0', x: 17.0, z: 10.9, w: 4.4, d: 3.8, floors: 1, roof: 'slate', rot: -0.1, gable: true }, { on: 'R4', x: 27.4, z: -6.4, w: 4.2, d: 4.2, floors: 2, roof: 'slate', gable: true, rot: -0.15 }, { on: 'L3', x: -6.4, z: -10.6, w: 3.0, d: 3.0, floors: 1, roof: 'thatch', gable: true, crates: false },
];
const STAIRS = [                                         // [x, z, on which terrace] at each end
  [[-9.8, 7.8, 'L1'], [-7.4, 3.0, 'L2']], [[-6.2, -1.0, 'L2'], [-6.3, -7.4, 'L3'], { straight: true, k: [0.88, 0.94, 1.0, 0.82, 1.08] }], [[12.6, -1.8, 'R1'], [11.4, -6.8, 'R2']], [[11.0, -8.4, 'R2'], [15.0, -10.9, 'R3'], { foot: [11.1, -7.6] }], [[10.6, 4.6, 'R1'], [11.6, 10.6, 'R0'], { k: [0.72, 0.78, 0.66, 0.84, 0.9, 1.0] }],
];
const BRIDGES = [[[-5.3, -8.6, 'L3'], [3.1, -9.0, 'R2']], [[-5.7, 2.9, 'L2'], [2.2, 3.3, 'R1']]];
const CAUSEWAYS = [[[13.2, -7.6, 'R2'], [21.6, -5.6, 'R4']]];      // where two terraces of one height are joined by a neck of the rock, with a path along it
export const START = [-6.6, 2.5];
for (const t of TERRACES) { t.outline = blob(t.c, t.r, t.seed * 13); t.walk = scaled(t.outline, t.c, 0.9); }
for (const s of STAIRS) {                                // each stair is fitted to the ground: its head just inside the edge of the higher terrace, its foot on the lower one, and no steeper than a stair should be
  const hiFirst = T[s[0][2]].y > T[s[1][2]].y, up = hiFirst ? s[0] : s[1], dn = hiFirst ? s[1] : s[0], hi = T[up[2]], lo = T[dn[2]], L = Math.hypot(up[0] - dn[0], up[1] - dn[1]), ux = (up[0] - dn[0]) / L, uz = (up[1] - dn[1]) / L, rise = hi.y - lo.y;
  let d = 0; while (d < 8 && inPoly(hi.outline, up[0] - ux * d, up[1] - uz * d)) d += 0.05; const hx = up[0] - ux * (d - 0.1), hz = up[1] - uz * (d - 0.1);
  let run = null; for (const k of s[2]?.k ?? [0.9, 0.84, 0.96, 0.78, 1.02, 1.08, 0.74]) { const fx = hx - ux * rise / k, fz = hz - uz * rise / k; if (inPoly(lo.walk, fx, fz) && inPoly(lo.walk, fx - ux * 0.9, fz - uz * 0.9) && !inPoly(hi.outline, fx, fz) && !HOUSES.some((h) => Math.abs(fx - h.x) < h.w / 2 + 1.7 && Math.abs(fz - h.z) < h.d / 2 + 1.7)) { run = rise / k; break; } }
  up[0] = hx; up[1] = hz; if (run) { dn[0] = hx - ux * run; dn[1] = hz - uz * run; }
}
for (const s of [...BRIDGES, ...CAUSEWAYS]) for (const [e, o] of [[s[0], s[1]], [s[1], s[0]]]) {      // and each bridge's ends are brought to the very edge of the rock, so its posts stand on the rim
  const t = T[e[2]], L = Math.hypot(o[0] - e[0], o[1] - e[1]), ux = (o[0] - e[0]) / L, uz = (o[1] - e[1]) / L; let d = 0;
  if (inPoly(t.outline, e[0], e[1])) { while (d < 8 && inPoly(t.outline, e[0] + ux * d, e[1] + uz * d)) d += 0.05; d += 0.13; } else { while (d > -8 && !inPoly(t.outline, e[0] + ux * d, e[1] + uz * d)) d -= 0.05; d += 0.2; }      // (just clear of the lip: the deck hangs over the gap from its first board, and its posts stand on the ground behind)
  e[0] += ux * d; e[1] += uz * d;
}

// Each stair's way, from the lower ground to the higher: most turn part way up, at a round landing, so they wind as stairs cut on a cliff do. The turn is put to
// whichever side is clear of houses, bridges and the rock above; where neither is, the stair goes straight.
const WAYS = STAIRS.map((s) => {
  const hiFirst = T[s[0][2]].y > T[s[1][2]].y, F = hiFirst ? s[1] : s[0], H = hiFirst ? s[0] : s[1], lo = T[F[2]], hi = T[H[2]], y0 = lo.y, y1 = hi.y, w = 2.3, rho = w * 0.62, n = Math.round((y1 - y0) / 0.3), h = (y1 - y0) / n;
  const dx = H[0] - F[0], dz = H[1] - F[1], D = Math.hypot(dx, dz), px = -dz / D, pz = dx / D, mid = [(F[0] + H[0]) / 2, (F[1] + H[1]) / 2];
  const inHouse = (x, z, pad) => HOUSES.some((q) => Math.abs(x - q.x) < q.w / 2 + pad && Math.abs(z - q.z) < q.d / 2 + pad), nearBridge = (x, z) => BRIDGES.some((b) => b.slice(0, 2).some((e) => Math.hypot(x - e[0], z - e[1]) < 2.6)) || CAUSEWAYS.some((b) => b.slice(0, 2).some((e) => Math.hypot(x - e[0], z - e[1]) < 3.6));
  const other = (x, z) => TERRACES.some((t) => t !== lo && t !== hi && t.y > y0 + 0.5 && inPoly(t.outline, x, z));
  let best = null;
  if (!s[2]?.straight) for (const dl of [2.3, -2.3, 1.9, -1.9, 1.5, -1.5]) { const M = [mid[0] + px * dl, mid[1] + pz * dl]; let ok = !inHouse(M[0], M[1], rho + 0.3) && !nearBridge(M[0], M[1]) && !other(M[0], M[1]);
    for (let k = 0; k < 8 && ok; k++) if (inPoly(hi.outline, M[0] + Math.cos(k * 0.785) * rho, M[1] + Math.sin(k * 0.785) * rho)) ok = false;
    for (let t = 0; t <= 1.001 && ok; t += 0.1) { const a = [F[0] + (M[0] - F[0]) * t, F[1] + (M[1] - F[1]) * t], b = [M[0] + (H[0] - M[0]) * t, M[1] + (H[1] - M[1]) * t]; if (inHouse(a[0], a[1], w / 2 + 0.2) || inHouse(b[0], b[1], w / 2 + 0.2) || inPoly(hi.outline, a[0], a[1]) || (t < 0.85 && inPoly(hi.outline, b[0], b[1])) || other(a[0], a[1]) || other(b[0], b[1])) ok = false; }
    if (!ok) continue; const score = Math.abs(dl) + (inPoly(lo.outline, M[0], M[1]) ? 1.5 : 0) + (M[1] > mid[1] ? 0.3 : 0); if (!best || score > best.score) best = { M, score }; }
  const e = Math.sqrt(rho * rho - w * w / 4);
  // the landing is a round of stone cut straight where each flight joins it, so no step lies under it and none hangs short of it
  const cut = (pts, nx, nz, d) => { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], da = a[0] * nx + a[1] * nz - d, db = b[0] * nx + b[1] * nz - d; if (da <= 0) out.push(a); if ((da < 0) !== (db < 0) && da !== db) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; };
  const mk = (Fp, M) => { const la = Math.hypot(M[0] - Fp[0], M[1] - Fp[1]), lb = Math.hypot(H[0] - M[0], H[1] - M[1]), nA = Math.max(3, Math.min(n - 3, Math.round(n * (la - e) / (la + lb - 2 * e)))), yM = y0 + nA * h;
    let lp = Array.from({ length: 20 }, (_, k) => [M[0] + Math.cos(k * 0.31416 + 0.05) * rho, M[1] + Math.sin(k * 0.31416 + 0.05) * rho]);
    for (const [E, l] of [[Fp, la], [H, lb]]) { const nx = (E[0] - M[0]) / l, nz = (E[1] - M[1]) / l; lp = cut(lp, nx, nz, M[0] * nx + M[1] * nz + e); }
    return { w, rho, lo, hi, landing: { c: M, y: yM, pts: lp }, flights: [{ a: [Fp[0], Fp[1], y0], b: [M[0] - (M[0] - Fp[0]) / la * e, M[1] - (M[1] - Fp[1]) / la * e, yM], n: nA }, { a: [M[0] + (H[0] - M[0]) / lb * e, M[1] + (H[1] - M[1]) / lb * e, yM], b: [H[0], H[1], y1], n: n - nA }] }; };
  // how much of the last flight lies under the ground it climbs to: a stair must stand clear of the terrace above until its top step
  const under = (wy) => { const f = wy.flights[wy.flights.length - 1], L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), u = [(f.b[0] - f.a[0]) / L, (f.b[1] - f.a[1]) / L], o = scaled(hi.outline, hi.c, 1.03); let worst = 0;
    for (let d = 0; d < L - 0.3; d += 0.1) for (const sd of [-1, 1]) if (inPoly(o, f.a[0] + u[0] * d - u[1] * sd * w / 2, f.a[1] + u[1] * d + u[0] * sd * w / 2)) worst = Math.max(worst, L - d); return worst; };
  let way = best ? mk(F, best.M) : { w, rho, lo, hi, flights: [{ a: [F[0], F[1], y0], b: [H[0], H[1], y1], n }], landing: null };
  if (!s[2]?.straight && under(way) > 0.4) {            // it would run in under the edge: bring the upper flight in square to the edge instead, and turn the lower one to suit
    let bd = 1e9, nO = [0, 0]; const o = hi.outline; for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length], ex = b[0] - a[0], ez = b[1] - a[1], t = Math.max(0, Math.min(1, ((H[0] - a[0]) * ex + (H[1] - a[1]) * ez) / (ex * ex + ez * ez))), d = Math.hypot(H[0] - a[0] - ex * t, H[1] - a[1] - ez * t);
      if (d < bd) { bd = d; const l = Math.hypot(ex, ez); let nx = ez / l, nz = -ex / l; if (nx * (H[0] - hi.c[0]) + nz * (H[1] - hi.c[1]) < 0) { nx = -nx; nz = -nz; } nO = [nx, nz]; } }
    let pick = null; for (const tread of [0.36, 0.32, 0.4]) { const nB = Math.round(n / 2), lbd = nB * tread + e, lad = (n - nB) * tread + e;
    for (const tg of [0, 0.5, -0.5, 1.0, -1.0]) { const M = [H[0] + nO[0] * lbd - nO[1] * tg, H[1] + nO[1] * lbd + nO[0] * tg]; if (inHouse(M[0], M[1], rho + 0.3) || nearBridge(M[0], M[1]) || other(M[0], M[1])) continue;
      const base = Math.atan2(lo.c[1] - M[1], lo.c[0] - M[0]);
      for (const da of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.5, -1.5]) { const dir = [Math.cos(base + da), Math.sin(base + da)], Fp = [M[0] + dir[0] * lad, M[1] + dir[1] * lad];
        if (!inPoly(lo.walk, Fp[0], Fp[1]) || !inPoly(lo.walk, Fp[0] + dir[0] * 0.9, Fp[1] + dir[1] * 0.9) || inPoly(hi.outline, Fp[0], Fp[1]) || inHouse(Fp[0], Fp[1], 1.3)) continue;
        let ok = true; for (let t = 0; t <= 1.001 && ok; t += 0.1) { const a = [Fp[0] + (M[0] - Fp[0]) * t, Fp[1] + (M[1] - Fp[1]) * t]; if (inHouse(a[0], a[1], w / 2 + 0.2) || inPoly(hi.outline, a[0], a[1]) || other(a[0], a[1])) ok = false; }
        if (!ok) continue; const cand = mk(Fp, M); if (under(cand) > 0.6) continue;
        const turn = Math.acos(Math.max(-1, Math.min(1, dir[0] * nO[0] + dir[1] * nO[1]))); if (turn > 2.0) continue;
        const score = -Math.abs(turn - 1.1) - 0.15 * Math.hypot(Fp[0] - F[0], Fp[1] - F[1]) - 0.3 * Math.abs(tg) - Math.abs(tread - 0.36) * 4; if (!pick || score > pick.score) pick = { Fp, M, score, cand }; } } }
    if (pick) { way = pick.cand; F[0] = pick.Fp[0]; F[1] = pick.Fp[1]; }
    else {                                                // no room to turn there: one straight flight, square to the edge
      const want = s[2]?.foot, tries = []; if (want) { const l = Math.hypot(want[0] - H[0], want[1] - H[1]); tries.push([[(want[0] - H[0]) / l, (want[1] - H[1]) / l], l, true]); }      // (where the plan says the foot should stand, that is tried first)
      for (const rot of [0, 0.2, -0.2, 0.4, -0.4, 0.6, -0.6]) for (const k of [0.84, 0.9, 0.78, 0.96, 1.02, 0.72]) { const c = Math.cos(rot), sn = Math.sin(rot); tries.push([[nO[0] * c - nO[1] * sn, nO[0] * sn + nO[1] * c], (y1 - y0) / k, false]); }
      search: for (const [dir, run, told] of tries) { const Fp = [H[0] + dir[0] * run, H[1] + dir[1] * run];
        if (!inPoly(lo.walk, Fp[0], Fp[1]) || !inPoly(lo.walk, Fp[0] + dir[0] * 0.9, Fp[1] + dir[1] * 0.9) || inHouse(Fp[0], Fp[1], 1.3) || (!told && nearBridge(Fp[0], Fp[1]))) continue;
        let ok = true; for (let t = 0.1; t <= 0.95 && ok; t += 0.1) { const q = [Fp[0] + (H[0] - Fp[0]) * t, Fp[1] + (H[1] - Fp[1]) * t]; if (inHouse(q[0], q[1], w / 2 + 0.2) || other(q[0], q[1])) ok = false; }
        const cand = { w, rho, lo, hi, flights: [{ a: [Fp[0], Fp[1], y0], b: [H[0], H[1], y1], n }], landing: null }; if (!ok || under(cand) > 0.4) continue;
        way = cand; F[0] = Fp[0]; F[1] = Fp[1]; break search; } }
  }
  return way;
});
const SEGS = WAYS.flatMap((wy) => wy.flights.map((f) => [f.a, f.b, f.a[2], f.b[2]]));      // every flight, for whatever must keep clear of the stairs

// where a way comes onto a terrace at its edge (a stair's head, a bridge's end): there the cobbles run out through the grass to meet it, as on a trodden path
const GATES = [...WAYS.map((wy) => { const f = wy.flights[wy.flights.length - 1], L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); return { t: wy.hi, o: [f.b[0], f.b[1]], u: [(f.b[0] - f.a[0]) / L, (f.b[1] - f.a[1]) / L], w: wy.w }; }),
  ...BRIDGES.flatMap(([a, b]) => [[a, b], [b, a]].map(([e, o]) => { const L = Math.hypot(o[0] - e[0], o[1] - e[1]); const u = [(e[0] - o[0]) / L, (e[1] - o[1]) / L]; return { t: T[e[2]], o: [e[0] + u[0] * 0.3, e[1] + u[1] * 0.3], u, w: 1.7, bridge: true }; })),
  ...CAUSEWAYS.flatMap(([a, b]) => [[a, b], [b, a]].map(([e, o]) => { const L = Math.hypot(o[0] - e[0], o[1] - e[1]); const u = [(e[0] - o[0]) / L, (e[1] - o[1]) / L]; return { t: T[e[2]], o: [e[0] + u[0] * 0.3, e[1] + u[1] * 0.3], u, w: 1.7 }; }))];
const atGate = (t, x, z, pad = 0.25) => GATES.some((g) => { if (g.t !== t) return false; const dx = x - g.o[0], dz = z - g.o[1], al = dx * g.u[0] + dz * g.u[1], la = Math.abs(dx * g.u[1] - dz * g.u[0]); return la < g.w / 2 + pad && al > -0.7 && al < 1.5; });
// ---------------------------------------------------------------- the pieces
const lip = (id, deg, k = 1.02) => { const t = T[id], a = deg * Math.PI / 180; return [t.c[0] + Math.cos(a) * t.r[0] * k, t.c[1] + Math.sin(a) * t.r[1] * k]; };
// the body of the rock the terraces stand on: the left stack, and the great wall of the right, rising to a crag at the back [x, z, half-widths, height, seed]
const MASSIFS = [[-12.5, 3, 8.5, 10.5, 4.3, 1], [-10.5, -5.5, 6.8, 7, 9.0, 2], [11, 2, 10.5, 12.5, 4.8, 3], [12, -5, 9.5, 8, 9.0, 4], [15, -11.5, 10.5, 6.5, 13.5, 5], [25, -19, 9, 6.5, 27, 6], [28, -4, 7, 10, 9, 7], [10, -17, 7, 5, 21, 8]];
const MOUT = MASSIFS.map(([x, z, rx, rz, h, sd]) => blob([x, z], [rx, rz], 300 + sd, 20, 0.14));
// falling water [lip x, z, the way it faces, top, foot, width]. The big one lands on a shelf of the rock, runs across it and falls again into the gap; the one off
// the crag comes down by two terraces to the sea.
const fallOut = (drop, t = 1) => 0.25 + 0.16 * drop * t + 0.9 * t * t, footOf = ([x, z, ang, y1, y0]) => [x + Math.sin(ang) * fallOut(y1 - y0), z + Math.cos(ang) * fallOut(y1 - y0)];
const WATER = false;                                     // (the streams and falls are put away for now)
const FALLS = (() => {
  const a = [...lip('R1', 122), 0.35, T.R1.y - 0.1, MASSIFS[2][4] + 0.05, 3.0], fa = footOf(a); let lx = fa[0]; while (inPoly(MOUT[2], lx, fa[1]) && lx > -4) lx -= 0.1;
  const b = [lx + 0.5, fa[1], -Math.PI / 2, MASSIFS[2][4] - 0.05, -0.5, 2.6], c = [22.5, -12.2, 0.15, 26.6, T.R3.y + 0.05, 1.7], d = [...lip('R3', 55), 0.3, T.R3.y - 0.1, T.R4.y + 0.05, 1.5], e = [...lip('R4', 75), 0.2, T.R4.y - 0.1, MASSIFS[6][4] + 0.05, 1.6];
  return { a, b, c, d, e, list: [a, b, c, d, e, [...lip('R0', 62), -0.35, T.R0.y - 0.1, -0.5, 1.5], [...lip('L2', 150), -0.6, T.L2.y - 0.1, MASSIFS[0][4] + 0.05, 1.3]] };
})();
const near2 = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
function rockLump(m, c, s, seed, squash = 0.8, key = 'rock') {          // a boulder in the rock: never through a terrace's floor from below, never where people walk, never across a stair or a bridge
  let y = c[1];
  for (const t of TERRACES) { const e = ((c[0] - t.c[0]) / (t.r[0] + s * 0.8)) ** 2 + ((c[2] - t.c[1]) / (t.r[1] + s * 0.8)) ** 2; if (e > 1) continue;
    if (y <= t.y + 0.3) y = Math.min(y, t.y - 0.1 - s * squash * 1.25);
    else if (y - s * squash * 0.6 < t.y + 2.4 && ((c[0] - t.c[0]) / (t.r[0] * 0.93 + s * 0.6)) ** 2 + ((c[2] - t.c[1]) / (t.r[1] * 0.93 + s * 0.6)) ** 2 < 1) return; }
  for (const [a, b, ya, yb] of [...SEGS, ...[...BRIDGES, ...CAUSEWAYS].map(([a, b]) => [a, b, T[a[2]].y, T[b[2]].y])]) { if (near2(c[0], c[2], a, b) < s + 1.5 && y + s * squash * 1.25 > Math.min(ya, yb) - 0.4 && y - s < Math.max(ya, yb) + 2.4) return; }
  for (const f of WATER ? FALLS.list : []) { const e = footOf(f), nx = Math.sin(f[2]), nz = Math.cos(f[2]); if (near2(c[0], c[2], [f[0], f[1]], [e[0] + nx * 1.2, e[1] + nz * 1.2]) < f[5] * 0.7 + s * 0.9 && y + s > f[4] - 0.3 && y - s < f[3] + 0.3) return; }      // nor in the way of falling water
  m.lump(key, V(c[0], y, c[2]), s, seed, squash);
  if (key === 'rock' && (Math.imul(seed, 2654435761) >>> 0) % 5 === 0) m.lump('grass', V(c[0], y + s * squash * 0.8, c[2]), s * 0.62, seed + 7, 0.3);       // moss on the top of some
}
function cliff(m, t) {
  const R = rng(t.seed * 7 + 3), base = blob(t.c, t.r, t.seed * 13); t.outline = base; t.walk = scaled(base, t.c, 0.9);
  m.prism('grass', scaled(base, t.c, 1.02), t.y - 0.16, t.y, 'grass');      // the turf, hanging a little over the edge
  const g = rockWall(m, base, t.c, t.y - 0.14, -3, t.seed * 31 + 7);
  m.prism('cobble', scaled(base, t.c, 0.955).map((p, k) => [p[0] + Math.sin(k * 2.1) * 0.08, p[1] + Math.cos(k * 1.7) * 0.08]), t.y, t.y + 0.04, 'cobble');
  { const po = scaled(base, t.c, 0.985), pi = scaled(base, t.c, 0.88), [vw] = m.size('verge'), n = po.length, yv = t.y + 0.055; let tot = 0; for (let k = 0; k < n; k++) tot += Math.hypot(po[(k + 1) % n][0] - po[k][0], po[(k + 1) % n][1] - po[k][1]);      // the grass grows in raggedly over the cobbles' edge, but not across a path
    const f = Math.round(tot * D / vw) / tot; let u = 0;
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n, L = Math.hypot(po[k2][0] - po[k][0], po[k2][1] - po[k][1]), np = Math.max(1, Math.round(L / 0.4)), mix = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
      for (let i = 0; i < np; i++) { const a = mix(po[k], po[k2], i / np), b = mix(po[k], po[k2], (i + 1) / np), c = mix(pi[k], pi[k2], (i + 1) / np), d = mix(pi[k], pi[k2], i / np), u1 = u + L / np * f; if (!atGate(t, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) m.quad('verge', V(a[0], yv, a[1]), V(b[0], yv, b[1]), V(c[0], yv, c[1]), V(d[0], yv, d[1]), [u, 0, u1, 1]); u = u1; } } }
  for (let k = 0; k < 7; k++) { const p = g.at(Math.floor(R() * g.N), 2 + Math.floor(R() * (g.rows - 2))); rockLump(m, V(p[0], p[1], p[2]), 0.6 + R() * 1.0, t.seed * 100 + k, 0.78); }      // boulders standing out of the face
  for (let k = 0; k < 7; k++) { let best = null; for (let q = 0; q < 6; q++) { const p = g.at(Math.floor(R() * g.N), 2 + Math.floor(R() * Math.min(g.rows - 2, 16))); if (!best || p[3] > best[3]) best = p; }      // moss where the rock juts
    const dc = Math.hypot(t.c[0] - best[0], t.c[1] - best[2]) || 1; rockLump(m, V(best[0] + (t.c[0] - best[0]) / dc * 0.3, best[1] + 0.15, best[2] + (t.c[1] - best[2]) / dc * 0.3), 0.45 + R() * 0.4, t.seed * 100 + 50 + k, 0.34, 'grass'); }
}
function house(m, h, nav) {
  const gf = !!h.gable, t = T[h.on], y = t.y, w = gf ? h.d : h.w, d = gf ? h.w : h.d, rot = (h.rot ?? 0) - (gf ? Math.PI / 2 : 0), base = 0.5, fh = 3, top = base + fh * h.floors, [tw] = WALL.tile, n = WALL.names.length;
  m.m = new THREE.Matrix4().makeRotationY(rot).setPosition(h.x, y, h.z);
  const uv = (name) => { const i = WALL.names.indexOf(name); return [(i + 0.004) / n, 0, (i + 0.996) / n, 1]; };
  m.box('stone', [0, 0], [w / 2 + 0.08, 0], [0, d / 2 + 0.08], 0, base, 'stone');
  const R = rng(Math.round(h.x * 31 + h.z * 17));
  const wall = (ax, az, bx, bz, kind) => {               // one wall, from its left end to its right as seen from outside, panel by panel
    const front = kind === 'front', L = Math.hypot(bx - ax, bz - az), np = Math.max(1, Math.round(L / 2)), door = front ? Math.floor(np / 2) : -1;
    for (let f = 0; f < h.floors; f++) for (let i = 0; i < np; i++) {
      const x0 = ax + (bx - ax) * i / np, z0 = az + (bz - az) * i / np, x1 = ax + (bx - ax) * (i + 1) / np, z1 = az + (bz - az) * (i + 1) / np, y0 = base + f * fh, y1 = y0 + fh;
      let name = f === 0 && i === door ? 'door' : front ? (h.shop && f === 0 ? 'shop' : 'window') : kind === 'side' && (i + f) % 2 === 0 && R() < 0.75 ? 'window' : R() < 0.45 ? 'brace' : R() < 0.3 ? 'cross' : 'plain';
      const lit = name === 'window' && R() < 0.16; if (lit) name = 'lit';
      m.quad('walls', V(x0, y0, z0), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z0), uv(name));
      if (lit) { const i2 = WALL.names.indexOf('lit'), fx0 = 11 / 32, fx1 = 22 / 32, fy0 = 1 - 20 / 48, fy1 = 1 - 7 / 48; let nx = (z1 - z0) / (L / np), nz = -(x1 - x0) / (L / np); if (nx * (x0 + x1) + nz * (z0 + z1) < 0) { nx = -nx; nz = -nz; }      // a lamp is lit inside: the panes shine by themselves
        const P = (fx, fy) => V(x0 + (x1 - x0) * fx + nx * 0.02, y0 + (y1 - y0) * fy, z0 + (z1 - z0) * fx + nz * 0.02); m.quad('glow', P(fx0, fy0), P(fx1, fy0), P(fx1, fy1), P(fx0, fy1), [(i2 + fx0) / n, fy0, (i2 + fx1) / n, fy1]); }
    }
  };
  wall(-w / 2, d / 2, w / 2, d / 2, gf ? 'side' : 'front'); wall(w / 2, d / 2, w / 2, -d / 2, gf ? 'front' : 'side'); wall(w / 2, -d / 2, -w / 2, -d / 2, gf ? 'side' : 'back'); wall(-w / 2, -d / 2, -w / 2, d / 2, gf ? 'back' : 'side');       // (a house may turn its gable end to the street)
  const rh = d * 0.74, o = 0.42, ey = top - o * rh / (d / 2), key = h.roof, [rw, rhh] = m.size(key), sl = Math.hypot(d / 2 + o, rh + o * rh / (d / 2));       // the roof: two steep slopes, hanging over the walls
  for (const s of [1, -1]) {
    m.quad(key, V(-w / 2 - o, ey, s * (d / 2 + o)), V(w / 2 + o, ey, s * (d / 2 + o)), V(w / 2 + o, top + rh, 0), V(-w / 2 - o, top + rh, 0), [0, 0, (w + 2 * o) * D / rw, sl * D / rhh]);
    const gx = s * w / 2, [gw, gh] = m.size('gablet'), gu = d * D / 2 / gw; m.tri('gablet', V(gx, top, -d / 2), V(gx, top, d / 2), V(gx, top + rh, 0), [0.5 - gu, 0.0], [0.5 + gu, 0.0], [0.5, rh * D / gh]);       // the gable ends, timbered
    m.seg('wood', V(s * (w / 2 + o), ey, d / 2 + o), V(s * (w / 2 + o), top + rh + 0.02, 0), 0.07); m.seg('wood', V(s * (w / 2 + o), ey, -d / 2 - o), V(s * (w / 2 + o), top + rh + 0.02, 0), 0.07);   // barge boards
  }
  m.seg('wood', V(-w / 2 - o, top + rh + 0.04, 0), V(w / 2 + o, top + rh + 0.04, 0), 0.09);
  const cx = (R() - 0.5) * w * 0.5, cz = -d * 0.22; m.box('stone', [cx, cz], [0.32, 0], [0, 0.32], top + rh * 0.3, top + rh + 0.7, 'stone'); h.chimney = new THREE.Vector3(cx, top + rh + 0.8, cz).applyMatrix4(m.m);
  // what stands about its front: a doorstep, a lantern by the door, a box of plants under each window, crates and a sack at one corner
  const F = gf ? (s, o) => [w / 2 + o, -s] : (s, o) => [s, d / 2 + o], A = gf ? [0, 1] : [1, 0], O = gf ? [1, 0] : [0, 1], Lf = gf ? d : w, npf = Math.max(1, Math.round(Lf / 2)), di = Math.floor(npf / 2), sAt = (i) => -Lf / 2 + (i + 0.5) * Lf / npf, ds = sAt(di), sc2 = (v, k) => [v[0] * k, v[1] * k];
  m.box('step', F(ds, 0.5), sc2(A, 0.62), sc2(O, 0.5), 0, 0.27, 'step'); m.box('step', F(ds, 0.24), sc2(A, 0.55), sc2(O, 0.24), 0, 0.53, 'step');
  { const c = F(ds + 0.74, 0.17); m.box('wood', F(ds + 0.74, 0.08), sc2(A, 0.03), sc2(O, 0.1), base + 2.26, base + 2.31, 'wood'); m.box('lamp', c, sc2(A, 0.085), sc2(O, 0.085), base + 1.98, base + 2.24, 'wood'); m.box('wood', c, sc2(A, 0.1), sc2(O, 0.1), base + 1.94, base + 1.98, 'wood'); h.lamp = new THREE.Vector3(c[0], base + 2.1, c[1]).applyMatrix4(m.m); }
  for (let f = 0; f < h.floors; f++) for (let i = 0; i < npf; i++) { if (f > 0 || i === di || h.shop) continue; const c = F(sAt(i), 0.11), y0 = base + f * fh + 1.5; m.box('wood', c, sc2(A, 0.4), sc2(O, 0.11), y0, y0 + 0.2, 'leaf'); m.box('leaf', c, sc2(A, 0.36), sc2(O, 0.08), y0 + 0.2, y0 + 0.3 + R() * 0.12, 'leaf'); }
  if (h.crates !== false) { const sd = di === 0 ? 1 : -1, s0 = sd * (Lf / 2 - 0.5), c = F(s0, 0.42), c2 = F(s0 - sd * 0.62, 0.36), k = 0.3 + R() * 0.06; m.box('wood', c, sc2(A, k), sc2(O, k), 0, k * 2, 'wood'); if (R() < 0.6) m.box('wood', c, [0.16, 0.12], [-0.12, 0.16], k * 2, k * 2 + 0.36, 'wood');
    m.box('sack', c2, sc2(A, 0.24), sc2(O, 0.2), 0, 0.42, 'sack'); if (R() < 0.5) m.box('sack', F(s0 - sd * 0.5, 0.74), sc2(A, 0.2), sc2(O, 0.22), 0, 0.36, 'sack');
    const wp = new THREE.Vector3(...F(s0 - sd * 0.3, 0.5), 0); const v = new THREE.Vector3(wp.x, 0, wp.y).applyMatrix4(m.m); nav.blocks.push({ x: v.x, z: v.z, hw: 0.75, hd: 0.6, rot }); }
  // and the richer parts: real timbers standing proud of the plaster, boards along the eaves, a post at each peak, a dormer in the roof, a balcony on a tall
  // house, a sign by some doors, an awning over a shop's window
  const P3 = (s, o2, yy) => { const [x, z] = F(s, o2); return V(x, yy, z); }, CN = [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]];
  for (const c of CN) m.box('wood', c, [0.09, 0], [0, 0.09], base, top, 'wood');
  for (let f = 0; f <= h.floors; f++) for (let k = 0; k < 4; k++) { const a = CN[k], b = CN[(k + 1) % 4]; const yy = base + f * fh + (f === 0 ? 0.075 : 0); m.seg('wood', V(a[0], yy, a[1]), V(b[0], yy, b[1]), f === 0 ? 0.07 : f === h.floors ? 0.08 : 0.1); }      // (the sill lies on the stone, inside its edge: two faces in one place flicker)
  for (const s of [1, -1]) { m.seg('wood', V(-w / 2 - o, ey - 0.02, s * (d / 2 + o)), V(w / 2 + o, ey - 0.02, s * (d / 2 + o)), 0.07); m.box('wood', [s * (w / 2 + o), 0], [0.06, 0], [0, 0.06], top + rh - 0.15, top + rh + 0.5, 'wood');
    m.seg('wood', V(s * (w / 2 + 0.03), top + rh * 0.36, -d * 0.32), V(s * (w / 2 + 0.03), top + rh * 0.36, d * 0.32), 0.07); }
  m.box('stone', [cx, cz], [0.4, 0], [0, 0.4], top + rh + 0.7, top + rh + 0.82, 'stone');
  if (h.roof === 'slate' && d > 3.3 && R() < 0.75) { const zs = (yy) => (d / 2 + o) * (1 - (yy - ey) / (top + rh - ey)), dx0 = (R() - 0.5) * w * 0.3, yb = ey + (top + rh - ey) * 0.26, hd2 = 0.95, yr = yb + hd2 + 0.5, zf = zs(yb), hwd = 0.55, iW = WALL.names.indexOf('window');
    m.quad('walls', V(dx0 - hwd, yb, zf), V(dx0 + hwd, yb, zf), V(dx0 + hwd, yb + hd2, zf), V(dx0 - hwd, yb + hd2, zf), [(iW + 11 / 64) / n, 1 - 42 / 96, (iW + 53 / 64) / n, 1 - 10 / 96]);
    for (const sd of [-1, 1]) { m.tri('plaster', V(dx0 + sd * hwd, yb, zf), V(dx0 + sd * hwd, yb + hd2, zf), V(dx0 + sd * hwd, yb + hd2, zs(yb + hd2)));
      m.quad(key, V(dx0 + sd * (hwd + 0.14), yb + hd2 - 0.1, zf + 0.14), V(dx0, yr, zf + 0.14), V(dx0, yr, zs(yr)), V(dx0 + sd * (hwd + 0.14), yb + hd2 - 0.1, zs(yb + hd2 - 0.1)));
      m.seg('wood', V(dx0 + sd * (hwd + 0.14), yb + hd2 - 0.1, zf + 0.14), V(dx0, yr + 0.02, zf + 0.14), 0.045); m.box('wood', [dx0 + sd * hwd, zf], [0.05, 0], [0, 0.05], yb, yb + hd2, 'wood'); }
    m.tri('plaster', V(dx0 - hwd, yb + hd2, zf), V(dx0 + hwd, yb + hd2, zf), V(dx0, yr - 0.05, zf)); m.seg('wood', V(dx0 - hwd, yb + hd2, zf + 0.02), V(dx0 + hwd, yb + hd2, zf + 0.02), 0.045); m.seg('wood', V(dx0 - hwd, yb, zf + 0.02), V(dx0 + hwd, yb, zf + 0.02), 0.05); }
  if (h.floors > 1) { const yb = base + fh, hb = Lf / 2 - 0.3, ob = 0.8, nb = Math.max(2, Math.round(hb * 2 / 0.45)); m.box('wood', F(0, ob / 2 + 0.03), sc2(A, hb), sc2(O, ob / 2 - 0.03), yb - 0.13, yb - 0.01, 'wood');
    for (const sd of [-1, 1]) { m.seg('wood', P3(sd * (hb - 0.15), 0.02, yb - 0.8), P3(sd * (hb - 0.15), ob - 0.08, yb - 0.1), 0.05); m.seg('wood', P3(sd * hb, 0.05, yb + 0.85), P3(sd * hb, ob, yb + 0.85), 0.04); m.seg('wood', P3(sd * hb, 0.05, yb + 0.45), P3(sd * hb, ob, yb + 0.45), 0.03); }
    m.seg('wood', P3(-hb, ob, yb + 0.85), P3(hb, ob, yb + 0.85), 0.045); m.seg('wood', P3(-hb, ob, yb + 0.45), P3(hb, ob, yb + 0.45), 0.03);
    for (let i = 0; i <= nb; i++) { const s = -hb + 2 * hb * i / nb; m.seg('wood', P3(s, ob, yb), P3(s, ob, yb + 0.85), i === 0 || i === nb ? 0.05 : 0.025); } }
  if (h.shop || R() < 0.45) { const sS = (ds > 0 ? -1 : 1) * (Lf / 2 - 0.2), ys = base + 2.62, e = h.shop ? 0 : 1 + Math.floor(R() * 3);
    m.seg('wood', P3(sS, 0, ys), P3(sS, 0.62, ys), 0.04); m.seg('wood', P3(sS, 0.03, ys - 0.38), P3(sS, 0.45, ys), 0.03); m.seg('wood', P3(sS - 0.34, 0.6, ys), P3(sS + 0.34, 0.6, ys), 0.035);
    for (const k of [-0.22, 0.22]) m.seg('wood', P3(sS + k, 0.6, ys), P3(sS + k, 0.6, ys - 0.14), 0.015);
    m.quad('signs', P3(sS - 0.3, 0.6, ys - 0.72), P3(sS + 0.3, 0.6, ys - 0.72), P3(sS + 0.3, 0.6, ys - 0.12), P3(sS - 0.3, 0.6, ys - 0.12), [(e + 0.02) / 4, 0.02, (e + 0.98) / 4, 0.98]); }
  if (h.shop) for (let i = 0; i < npf; i++) { if (i === di) continue; const s0 = sAt(i) - Lf / npf / 2 + 0.1, s1 = sAt(i) + Lf / npf / 2 - 0.1, ya = base + 2.7, [aw] = m.size('awning');
    m.quad('awning', P3(s0, 0.95, ya - 0.5), P3(s1, 0.95, ya - 0.5), P3(s1, 0.03, ya), P3(s0, 0.03, ya), [0, 0, (s1 - s0) * D / aw, 1]); m.quad('awning', P3(s0, 0.95, ya - 0.68), P3(s1, 0.95, ya - 0.68), P3(s1, 0.95, ya - 0.5), P3(s0, 0.95, ya - 0.5), [0, 0, (s1 - s0) * D / aw, 0.3]);
    for (const s of [s0, s1]) m.seg('wood', P3(s, 0.93, 0), P3(s, 0.93, ya - 0.5), 0.03); }
  m.m = null; h.peak = y + top + rh;
  nav.blocks.push({ x: h.x, z: h.z, hw: w / 2 + 0.45, hd: d / 2 + 0.45, rot });
}
function stairs(m, wy, nav, si) {                        // steps in one flight or two, a round landing where they turn, living rock under all of it, a stone apron where it meets the ground
  const { w, rho } = wy, b0 = 1.7 + si * 0.12, quadAt = (c, u, hl, hw, y, key) => { const P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([e, g]) => [c[0] + u[0] * hl * e - u[1] * hw * g, c[1] + u[1] * hl * e + u[0] * hw * g]); m.quad(key, V(P[0][0], y, P[0][1]), V(P[1][0], y, P[1][1]), V(P[2][0], y, P[2][1]), V(P[3][0], y, P[3][1])); return P; };
  wy.flights.forEach((f, fi) => { const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], L = Math.hypot(dx, dz), u = [dx / L, dz / L], ya = f.a[2], yb = f.b[2], foot = ya - 0.7;
    for (let i = 0; i < f.n; i++) { m.tag = [0, foot, 0, -(b0 + (fi * 8 + i) * 0.035)]; const t = (i + 0.5) / f.n, c = [f.a[0] + dx * t, f.a[1] + dz * t], yt = ya + (yb - ya) * (i + 1) / f.n + (i === f.n - 1 && fi === wy.flights.length - 1 ? 0.045 : 0), P = quadAt(c, u, L / f.n / 2 + 0.005, w / 2, yt, i === f.n - 1 && fi === wy.flights.length - 1 ? 'cobble' : 'step'); for (let q = 0; q < 4; q++) { const A = P[q], B = P[(q + 1) % 4]; m.quad('crag', V(A[0], foot, A[1]), V(B[0], foot, B[1]), V(B[0], yt, B[1]), V(A[0], yt, A[1])); } }
    const mc = [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2], R4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([e, g]) => [mc[0] + u[0] * (L / 2 + 0.1) * e - u[1] * (w / 2 + 0.1) * g, mc[1] + u[1] * (L / 2 + 0.1) * e + u[0] * (w / 2 + 0.1) * g]);
    m.tag = [0, -3, 0, -b0]; rockWall(m, R4, mc, ya - 0.1, -3, 5200 + si * 37 + fi * 11, { amp: 0.4, grow: 0.06, step: 0.5, free: true });
    nav.ramps.push({ a: f.a, b: f.b, w: w - 0.3, sag: 0, steps: f.n }); });
  if (wy.landing) { const { c, y, pts } = wy.landing; m.tag = [0, -3, 0, -(b0 + 0.2)];
    for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; m.tri('step', V(c[0], y, c[1]), V(p[0], y, p[1]), V(q[0], y, q[1])); }
    rockWall(m, pts, c, y - 0.02, -3, 5300 + si * 41, { amp: 0.45, grow: 0.06, step: 0.5, clr: [1.3, 0.6] });
    nav.polys.push({ pts, y, kind: 'stone' }); nav.pads.push({ c, r: rho + 0.45, y }); }
  const first = wy.flights[0], last = wy.flights[wy.flights.length - 1], dir = (f) => { const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); return [(f.b[0] - f.a[0]) / L, (f.b[1] - f.a[1]) / L]; }, uf = dir(first), ul = dir(last);
}
const hang = (t) => 0.3 * 4 * t * (1 - t) + 0.7 * Math.sin(Math.PI * t) ** 2;      // how a rope bridge hangs: nearly level where it leaves each lip, deepest in the middle
function bridge(m, s, nav, b0 = 2) {
  const [a, b] = s, ya = T[a[2]].y + 0.07, yb = T[b[2]].y + 0.07, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, w = 1.5, sag = 0.75, n = Math.round(L / 0.42);
  const at = (t, up = 0, side = 0) => V(a[0] + dx * t - uz * side, ya + (yb - ya) * t - sag * hang(t) + up, a[1] + dz * t + ux * side);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, p = at(t); m.tag = [p[0], p[1], p[2], b0 + 0.3 + t * 0.6]; m.box('wood', [p[0], p[2]], [ux * 0.17, uz * 0.17], [-uz * w / 2, ux * w / 2], p[1] - 0.09, p[1], 'wood'); }      // (it is laid across board by board)
  for (const sd of [-1, 1]) { for (let i = 0; i < n; i++) { const q0 = at(i / n, 0.5, sd * w / 2); m.tag = [q0[0], q0[1], q0[2], b0 + 0.3 + i / n * 0.6]; m.seg('wood', at(i / n, 1.0, sd * w / 2), at((i + 1) / n, 1.0, sd * w / 2), 0.045); m.seg('wood', at(i / n, -0.1, sd * w / 2), at((i + 1) / n, -0.1, sd * w / 2), 0.04); if (i % 2 === 0) m.seg('wood', at(i / n, -0.1, sd * w / 2), at(i / n, 1.0, sd * w / 2), 0.03); }
    for (const [e, back, y, t] of [[a, -1, ya, 0], [b, 1, yb, 1]]) { const px = e[0] + ux * back * 0.3 - uz * sd * (w / 2 + 0.05), pz = e[1] + uz * back * 0.3 + ux * sd * (w / 2 + 0.05); m.tag = [px, y - 0.55, pz, -b0];      // a post each side at each end, standing on the ground behind the lip, the hand rope made fast to it
      m.cone('wood', px, pz, 0.19, 0.16, y - 0.55, y + 1.3, 8, 'wood'); m.cone('wood', px, pz, 0.21, 0.21, y + 1.02, y + 1.1, 8, 'wood'); m.seg('wood', V(px, y + 1.0, pz), at(t, 1.0, sd * w / 2), 0.045); nav.blocks.push({ x: px, z: pz, hw: 0.2, hd: 0.2, rot: 0 }); } }
  for (const [e, back, y] of [[a, -1, ya], [b, 1, yb]]) { m.tag = [e[0], y, e[1], b0 + 0.1]; m.box('wood', [e[0] + ux * back * 0.1, e[1] + uz * back * 0.1], [ux * 0.18, uz * 0.18], [-uz * (w / 2 + 0.08), ux * (w / 2 + 0.08)], y - 0.14, y + 0.012, 'wood'); }      // a sill beam lying on the lip, which the deck is hung from
  const ramp = { a: [a[0], a[1], ya], b: [b[0], b[1], yb], w: w - 0.3, sag, ext: 1.4 }; nav.ramps.push(ramp); return { a, dx, dz, L, ux, uz, ramp };
}
function windmill(m, x, z, y, nav) {
  m.cone('stone', x, z, 1.75, 1.6, y, y + 1.2, 10); m.cone('stone', x, z, 1.6, 1.1, y + 1.2, y + 7.2, 10);
  m.cone('slate', x, z, 1.45, 0.0, y + 7.2, y + 9.3, 10); m.box('wood', [x, z + 1.55], [0.5, 0], [0, 0.08], y + 0.1, y + 2.0, 'wood');
  nav.blocks.push({ x, z, hw: 1.9, hd: 1.9, rot: 0 });
  // the sails turn on an axle that stands out from the tower, far enough that they clear its foot, and high enough that they pass over a man's hat
  const ax = -Math.sin(0.65), az = Math.cos(0.65), hy = y + 6.5; m.seg('wood', V(x + ax * 0.9, hy, z + az * 0.9), V(x + ax * 2.05, hy, z + az * 2.05), 0.13);
  const hub = new THREE.Group(); hub.position.set(x + ax * 1.95, hy, z + az * 1.95); hub.rotation.y = -0.65; return hub;
}
function flagline(m, p, q, sag, seed) {
  m.tag = [p[0], p[1], p[2], 4.8 + seed * 0.12];
  const n = Math.round(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / 0.55), at = (t) => V(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t - sag * 4 * t * (1 - t), p[2] + (q[2] - p[2]) * t), R = rng(seed);
  for (let i = 0; i < n; i++) { const a = at(i / n), b = at((i + 1) / n); m.seg('wood', a, b, 0.02); if (i % 2 === 0 || i === n - 1) continue; const c = Math.floor(R() * 6), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.55, (a[2] + b[2]) / 2];
    m.quad('flags', V(a[0], a[1] - 0.44, a[2]), V(b[0], b[1] - 0.44, b[2]), b, a, [(c + 0.1) / 6, 0.05, (c + 0.9) / 6, 0.95]); }
}
function clothesline(m, p, q, seed) {
  m.tag = [p[0], p[1] - 2.2, p[2], 5.0];
  const R = rng(seed), L = Math.hypot(q[0] - p[0], q[2] - p[2]), n = Math.max(3, Math.round(L / 0.7)), at = (t) => V(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t - 0.7 * t * (1 - t), p[2] + (q[2] - p[2]) * t);
  for (const e of [p, q]) m.box('wood', [e[0], e[2]], [0.06, 0], [0, 0.06], e[1] - 2.2, e[1] + 0.1, 'wood');
  for (let i = 0; i < n; i++) { m.seg('wood', at(i / n), at((i + 1) / n), 0.02); if (i === 0 || i === n - 1 || R() < 0.2) continue; const c = Math.floor(R() * 4), hg = 0.6 + R() * 0.25, a = at((i + 0.1) / n), b = at((i + 0.9) / n);
    m.quad('cloth', V(a[0], a[1] - hg, a[2]), V(b[0], b[1] - hg, b[2]), b, a, [(c + 0.02) / 4, 0, (c + 0.98) / 4, 1]); }
}
function fence(m, pts) { for (let i = 0; i < pts.length; i++) { const p = pts[i]; m.box('wood', [p[0], p[2]], [0.07, 0], [0, 0.07], p[1], p[1] + 0.95, 'wood'); if (i) { const q = pts[i - 1]; m.seg('wood', V(q[0], q[1] + 0.8, q[2]), V(p[0], p[1] + 0.8, p[2]), 0.04); m.seg('wood', V(q[0], q[1] + 0.45, q[2]), V(p[0], p[1] + 0.45, p[2]), 0.04); } } }

// ---------------------------------------------------------------- all of it
export function buildWorld(tex) {
  tex.glow = tex.walls; const m = new Mesher(tex), nav = { polys: [], ramps: [], blocks: [], pads: [] }, R = rng(77), group = new THREE.Group(), anim = [];
  const lam = (k, o = {}) => { const n = tex[k].userData.normal; return grown(n ? new THREE.MeshStandardMaterial({ map: tex[k], normalMap: n, roughness: 0.94, metalness: 0, side: THREE.DoubleSide, ...o }) : new THREE.MeshLambertMaterial({ map: tex[k], side: THREE.DoubleSide, ...o })); };      // (the light catches each drawing's relief)
  const mats = { verge: lam('verge', { alphaTest: 0.5 }), signs: lam('signs', { alphaTest: 0.5 }), awning: lam('awning'), lamp: new THREE.MeshBasicMaterial({ map: tex.lamp, color: new THREE.Color(3.0, 1.9, 0.8) }), sack: lam('sack'), rock: lam('crag'), slab: lam('crag'), crag: lam('crag'), boulder: lam('boulder'), cobble: lam('cobble'), stone: lam('stone'), gablet: lam('gablet'), step: lam('step'), riser: lam('riser'), slate: lam('slate'), tile: lam('tile'), thatch: lam('thatch'), wood: lam('wood'), barrel: lam('barrel'), plaster: lam('plaster'), grass: lam('grass'), dirt: lam('dirt'), leaf: lam('leaf'), walls: lam('walls'), flags: lam('flags', { alphaTest: 0.5 }),
    tuft: lam('tuft', { alphaTest: 0.5 }), cloth: lam('cloth', { alphaTest: 0.5 }), glow: new THREE.MeshBasicMaterial({ map: tex.walls, color: new THREE.Color(1.7, 1.2, 0.72) }) };
  mats.glow.userData.noCast = true; mats.lamp.userData.noCast = true; mats.verge.userData.noCast = true; grown(mats.glow); grown(mats.lamp);
  const byY = [...TERRACES].sort((a, b) => a.y - b.y), byX = [...HOUSES].sort((a, b) => a.x - b.x);      // the order things come in: the low rock first, the houses from the left
  mats.tuft.userData.noCast = true; mats.flags.userData.noCast = false;
  for (const t of TERRACES) { m.tag = [t.c[0], -3, t.c[1], -(0.35 + byY.indexOf(t) * 0.11)]; cliff(m, t); nav.polys.push({ pts: t.walk, y: t.y, id: t.id }); }
  for (const [a, b] of CAUSEWAYS) {                      // a neck of rock from one terrace to the next, turfed, a cobbled path along it with grass at its sides
    const y = T[a[2]].y, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], [vw] = m.size('verge'), P = (al, la, yy) => V(a[0] + u[0] * al - u[1] * la, yy, a[1] + u[1] * al + u[0] * la), R2 = (al, la) => [a[0] + u[0] * al - u[1] * la, a[1] + u[1] * al + u[0] * la];
    m.tag = [(a[0] + b[0]) / 2, -3, (a[1] + b[1]) / 2, -1.2]; const out = [R2(-0.9, -1.5), R2(L + 0.9, -1.5), R2(L + 0.9, 1.5), R2(-0.9, 1.5)];
    rockWall(m, out, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], y - 0.14, -3, 6100, { amp: 0.8, free: true }); m.prism('grass', out, y - 0.16, y, 'grass');
    m.quad('cobble', P(-0.9, -0.85, y + 0.045), P(-0.9, 0.85, y + 0.045), P(L + 0.9, 0.85, y + 0.045), P(L + 0.9, -0.85, y + 0.045));
    for (const sd of [-1, 1]) { m.quad('verge', P(-0.9, sd * 1.09, y + 0.062), P(L + 0.9, sd * 1.09, y + 0.062), P(L + 0.9, sd * 0.69, y + 0.062), P(-0.9, sd * 0.69, y + 0.062), [0, 0, Math.round((L + 1.8) * D / vw), 1]);
      for (let k = 0; k < 5; k++) { const c = P(L * (0.12 + 0.19 * k) + sd * 0.3, sd * (1.15 + (k % 2) * 0.15), y), s = 0.42 + (k * 7 % 5) * 0.06; for (const o of [0.4, 1.97]) { const cx = Math.cos(o + k) * s / 2, cz = Math.sin(o + k) * s / 2; m.quad('tuft', V(c[0] - cx, y, c[2] - cz), V(c[0] + cx, y, c[2] + cz), V(c[0] + cx, y + s, c[2] + cz), V(c[0] - cx, y + s, c[2] - cz), [0, 0, 1, 1]); } } }
    nav.polys.push({ pts: [R2(-1.7, -1.05), R2(L + 1.7, -1.05), R2(L + 1.7, 1.05), R2(-1.7, 1.05)], y, id: 'causeway' }); }
  for (const h of HOUSES) { h.born = 2.5 + byX.indexOf(h) * 0.13; m.tag = [h.x, T[h.on].y, h.z, h.born]; house(m, h, nav); }
  WAYS.forEach((wy, i) => stairs(m, wy, nav, i));
  const spans = BRIDGES.map((b, i) => {                  // the bridges are made apart from the rest, since they give underfoot and swing
    const bm = new Mesher(tex), s = bridge(bm, b, nav, 2.1 + i * 0.25), ms = bm.meshes(mats); group.add(...ms);
    s.parts = ms.map((me) => { const pos = me.geometry.attributes.position, rest = pos.array.slice(), ts = new Float32Array(pos.count); for (let k = 0; k < pos.count; k++) ts[k] = Math.max(0, Math.min(1, ((rest[k * 3] - s.a[0]) * s.dx + (rest[k * 3 + 2] - s.a[1]) * s.dz) / (s.L * s.L))); me.frustumCulled = false; return { pos, rest, ts }; });
    Object.assign(s, { load: 0, vel: 0, at: 0.5, sw: 0, swv: 0, i });
    s.ramp.dip = (t) => s.load * (0.06 + 0.4 * 4 * s.at * (1 - s.at)) * (t < s.at ? t / Math.max(s.at, 0.02) : (1 - t) / Math.max(1 - s.at, 0.02));       // (a weight on a rope bridge pulls it into a V under the feet)
    return s; });
  for (const g of GATES) { m.tag = [g.o[0], g.t.y, g.o[1], 2.0];                              // the path through the grass at each stair's head and bridge's end, grass standing ragged along both its sides and in tufts at its corners
    const y = g.t.y, [vw] = m.size('verge'), len = 1.3, P = (al, la, yy) => V(g.o[0] + g.u[0] * al - g.u[1] * la, yy, g.o[1] + g.u[1] * al + g.u[0] * la), hw = g.w / 2;
    m.quad('cobble', P(-0.05, -hw, y + 0.045), P(-0.05, hw, y + 0.045), P(len, hw, y + 0.045), P(len, -hw, y + 0.045));
    for (const sd of [-1, 1]) { const pm = P(0.6, sd * (hw + 0.04), y); if (GATES.some((g2) => g2 !== g && g2.t === g.t && near2(pm[0], pm[2], g2.o, [g2.o[0] + g2.u[0] * 1.3, g2.o[1] + g2.u[1] * 1.3]) < g2.w / 2 + 0.9)) continue;      // (no grass edge where another path runs alongside)
      m.quad('verge', P(-0.05, sd * (hw + 0.24), y + 0.062), P(len, sd * (hw + 0.24), y + 0.062), P(len, sd * (hw - 0.16), y + 0.062), P(-0.05, sd * (hw - 0.16), y + 0.062), [0, 0, (len + 0.05) * D / vw, 1]);
      for (const [al, s] of [[0.1, 0.62], [0.55, 0.45]]) { const c = P(al, sd * (hw + 0.3), y); for (const o of [0.4, 1.97]) { const cx = Math.cos(o + sd) * s / 2, cz = Math.sin(o + sd) * s / 2; m.quad('tuft', V(c[0] - cx, y, c[2] - cz), V(c[0] + cx, y, c[2] + cz), V(c[0] + cx, y + s, c[2] + cz), V(c[0] - cx, y + s, c[2] - cz), [0, 0, 1, 1]); } }
      if (g.bridge) { const post = P(0, sd * 0.8, y + 0.06), stake = P(1.25, sd * 1.12, y); if (SEGS.some(([a, b]) => near2(stake[0], stake[2], a, b) < 2.4)) continue; m.cone('wood', stake[0], stake[2], 0.09, 0.075, y, y + 0.42, 6, 'wood'); m.seg('wood', V(post[0], y + 1.06, post[2]), V(stake[0], y + 0.36, stake[2]), 0.028); } }      // (a bridge's posts are stayed by ropes to stakes behind them)
  }
  const stepBridges = (me, dt, time) => { for (const s of spans) {
    const t = ((me.x - s.a[0]) * s.dx + (me.z - s.a[1]) * s.dz) / (s.L * s.L), side = Math.abs((me.x - s.a[0]) * s.dz - (me.z - s.a[1]) * s.dx) / s.L, on = t > 0.02 && t < 0.98 && side < 0.8 && Math.abs(me.y - (s.ramp.a[2] + (s.ramp.b[2] - s.ramp.a[2]) * t - s.ramp.sag * hang(t))) < 1.0;
    if (on) s.at += (t - s.at) * Math.min(1, dt * 12);
    const want = on ? 1 + (me.moving ? 0.22 * Math.sin(me.walked / 0.62 * 6.2832) : 0) : 0; s.vel += ((want - s.load) * 70 - s.vel * 6.5) * dt; s.load += s.vel * dt;       // it gives as he steps on, bobs with each step, and springs back
    const sway = (on && me.moving ? 0.06 * Math.sin(me.walked / 1.24 * 6.2832) : 0) + 0.02 * Math.sin(time * 0.9 + s.i * 2); s.swv += ((sway - s.sw) * 40 - s.swv * 4) * dt; s.sw += s.swv * dt;
    for (const p of s.parts) { const A = p.pos.array, R0 = p.rest; for (let k = 0; k < p.ts.length; k++) { const tt = p.ts[k], o = s.sw * Math.sin(Math.PI * tt); A[k * 3] = R0[k * 3] - s.uz * o; A[k * 3 + 1] = R0[k * 3 + 1] - s.ramp.dip(tt); A[k * 3 + 2] = R0[k * 3 + 2] + s.ux * o; } p.pos.needsUpdate = true; } } };
  m.tag = [-9.6, T.L3.y, -10.2, 3.2]; const hub = windmill(m, -9.6, -10.2, T.L3.y, nav);
  // the body of the rock the terraces stand on: the left stack, and the great wall of the right, rising to a crag at the back
  MASSIFS.forEach(([x, z, rx, rz, h, sd], mi) => { m.tag = [x, -3, z, -(0.05 + mi * 0.07)];
    const Q = rng(340 + sd), g = rockWall(m, MOUT[mi], [x, z], h, -3, 900 + sd * 17, { top: 'grass', amp: 1.3 });
    for (let k = 0; k < 10; k++) { const a = Q() * 6.2832, e = Math.sqrt(Q()) * 0.82; rockLump(m, V(x + Math.cos(a) * rx * e, h + 0.05, z + Math.sin(a) * rz * e), 0.35 + Q() * 0.6, 7000 + sd * 30 + k, 0.6); }      // loose rock lying on its top
    for (let k = 0; k < 9; k++) { const p = g.at(Math.floor(Q() * g.N), 1 + Math.floor(Q() * (g.rows - 1))); rockLump(m, V(p[0], p[1], p[2]), 0.7 + Q() * 1.1, 370 + sd * 20 + k, 0.78); }
    for (let k = 0; k < 8; k++) { let best = null; for (let q = 0; q < 6; q++) { const p = g.at(Math.floor(Q() * g.N), 2 + Math.floor(Q() * (g.rows - 2))); if (!best || p[3] > best[3]) best = p; } const dc = Math.hypot(x - best[0], z - best[2]) || 1; rockLump(m, V(best[0] + (x - best[0]) / dc * 0.35, best[1] + 0.15, best[2] + (z - best[2]) / dc * 0.35), 0.5 + Q() * 0.5, 4000 + sd * 50 + k, 0.34, 'grass'); } });
  // sea stacks and far headlands, for the distance
  for (const [x, z, r, h, sd] of [[-52, -50, 4, 10, 1], [-74, -96, 6, 15, 2], [-38, 6, 2.6, 5, 10], [44, -36, 9, 24, 4], [56, -10, 10, 30, 5]]) {
    m.tag = [x, -3, z, -0.05]; rockWall(m, blob([x, z], [r, r * 0.8], 500 + sd, 12, 0.2), [x, z], h, -3, 600 + sd, { top: 'grass', step: 1.3, amp: 1.7 }); }
  // things about the place
  const on = (id, x, z) => T[id].y + 0.04;
  for (const [id, x, z, s] of [['R1', 4.4, -1.6, 1], ['R1', 5.2, -2.2, 1], ['R1', 4.9, -0.7, 0], ['R1', 11.9, 1.4, 1], ['L1', -15.4, 12.2, 1], ['L1', -10.6, 11.6, 0], ['L2', -11.9, 2.9, 1], ['R0', 9.4, 12.4, 1], ['R0', 10.1, 13.1, 0], ['R2', 5.4, -6.6, 1], ['R3', 19.6, -10.9, 0], ['L3', -11.2, -6.8, 1]]) {
    const y = on(id); m.tag = [x, y, z, 4.2 + Math.abs(Math.sin(x * 12.9 + z * 78.2)) * 0.5]; if (s) { m.cone('barrel', x, z, 0.3, 0.36, y, y + 0.4, 8); m.cone('barrel', x, z, 0.36, 0.3, y + 0.4, y + 0.8, 8, 'wood'); } else m.box('wood', [x, z], [0.36, 0.08], [-0.08, 0.36], y, y + 0.7, 'wood'); nav.blocks.push({ x, z, hw: 0.45, hd: 0.45, rot: 0 }); }
  for (const t of TERRACES) {                           // a rail along each terrace's open front, bushes at its back, grass at its edges
    m.tag = [t.c[0], t.y, t.c[1], -4.3]; const pts = scaled(t.outline, t.c, 0.95), n = pts.length, flush = () => { if (run.length > 1 && t.id !== 'L3') fence(m, run); run = []; }; let run = []; for (let i = 2; i <= 7; i++) { const p = pts[i % n]; if ([...SEGS, ...BRIDGES, ...CAUSEWAYS].some(([a, b]) => near2(p[0], p[1], a, b) < 1.9)) flush(); else run.push(V(p[0], t.y, p[1])); } flush();      // (left open where a stair or a bridge comes in)
    for (let k = 0; k < 4; k++) { const a = 3.6 + R() * 2.2, x = t.c[0] + Math.cos(a) * t.r[0] * 0.82, z = t.c[1] + Math.sin(a) * t.r[1] * 0.82; if (SEGS.some(([p, q]) => near2(x, z, p, q) < 2.4) || WAYS.some((wy) => wy.landing && Math.hypot(x - wy.landing.c[0], z - wy.landing.c[1]) < 2.6)) continue; m.tag = [x, t.y, z, 4.35 + k * 0.06]; m.lump('leaf', V(x, t.y + 0.45, z), 0.6 + R() * 0.5, 900 + k + t.seed * 10, 0.85); nav.blocks.push({ x, z, hw: 0.5, hd: 0.5, rot: 0 }); }
    for (let k = 0; k < 18; k++) { const a = R() * 6.2832, e = 0.86 + R() * 0.11, x = t.c[0] + Math.cos(a) * t.r[0] * e, z = t.c[1] + Math.sin(a) * t.r[1] * e, s = 0.45 + R() * 0.3, ang = R() * 3.14; if (SEGS.some(([p, q]) => near2(x, z, p, q) < 1.5)) continue; m.tag = [x, t.y, z, 4.5 + (k * 37 % 18) / 18 * 0.7];
      for (const o of [0, 1.57]) { const cx = Math.cos(ang + o) * s / 2, cz = Math.sin(ang + o) * s / 2; m.quad('tuft', V(x - cx, t.y, z - cz), V(x + cx, t.y, z + cz), V(x + cx, t.y + s, z + cz), V(x - cx, t.y + s, z - cz), [0, 0, 1, 1]); } }
  }
  const peak = (i) => HOUSES[i].peak;
  flagline(m, V(-9.6, T.L3.y + 9.1, -10.2), V(6.8, peak(4) + 0.2, -11.3), 1.6, 1); flagline(m, V(6.8, peak(4) + 0.2, -11.3), V(16.4, peak(5) + 0.2, -14.0), 1.2, 2); flagline(m, V(-18.4, peak(0) + 0.1, 8.4), V(-10.0, peak(3) + 0.1, -0.6), 1.4, 3); flagline(m, V(8.8, peak(7) + 0.1, -0.5), V(17.0, peak(8) + 0.1, 10.9), 1.3, 4);
  clothesline(m, V(22.4, T.R4.y + 2.3, -2.6), V(25.8, T.R4.y + 2.3, -1.2), 11); clothesline(m, V(14.4, T.R0.y + 2.3, 14.1), V(17.8, T.R0.y + 2.3, 13.3), 12);
  const folk = [[-10.9, 2.5, 0], [-12.4, 2.9, 1], [-14.6, 11.6, 2], [-13.6, 12.1, 3], [10.9, 2.7, 4], [7.7, 3.3, 5], [7.9, -7.6, 6], [6.4, -6.2, 7], [19.0, -11.2, 8], [14.2, 12.9, 9], [-8.4, -7.3, 3], [24.2, -3.4, 1]].map(([x, z, i]) => ({ x, z, i }));
  for (const f of folk) nav.blocks.push({ x: f.x, z: f.z, hw: 0.4, hd: 0.4, rot: 0 });
  group.add(...m.meshes(mats));
  // the windmill's sails, turning
  const armMat = new THREE.MeshLambertMaterial({ map: tex.wood }), depthMat = grown(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  const setIntro = (on) => group.traverse((o) => { if (o.isMesh && o.geometry.attributes.grow) o.customDepthMaterial = on ? depthMat : undefined; });      // (while it builds, the shadows must grow with the things that cast them)
  const sailMat = new THREE.MeshLambertMaterial({ map: tex.sail, alphaTest: 0.5, side: THREE.DoubleSide }), sails = new THREE.Group();
  for (let k = 0; k < 4; k++) { const g = new THREE.PlaneGeometry(1.0, 3.6); g.translate(0.5, 2.3, 0); const s = new THREE.Mesh(g, sailMat); s.rotation.z = k * Math.PI / 2; s.castShadow = true; sails.add(s);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.2, 0.1), armMat); arm.position.set(0, 2.1, 0); const ag = new THREE.Group(); ag.rotation.z = k * Math.PI / 2; ag.add(arm); sails.add(ag); }
  hub.add(sails); group.add(hub); anim.push((t) => { sails.rotation.z = t * 0.35; });
  // falling water, and the mist it makes
  const fallMat = new THREE.MeshBasicMaterial({ map: tex.fall, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(1.05, 1.0, 1.0), fog: true }), falls = [];
  const fall2 = tex.fall.clone(); fall2.needsUpdate = true; fall2.repeat.set(0.55, 0.7); fall2.offset.x = 0.22; const fallMat2 = new THREE.MeshBasicMaterial({ map: fall2, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(1.5, 1.4, 1.35), fog: true, opacity: 0.7 });      // a brighter core, falling a little faster
  const veil = tex.fall.clone(); veil.needsUpdate = true; veil.repeat.set(1.7, 0.8); const veilMat = new THREE.MeshBasicMaterial({ map: veil, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(1.1, 1.08, 1.12), fog: true, opacity: 0.5 });      // and a thin veil round it, falling slower
  const fall = (x, z, ang, y1, y0, w) => {               // from a lip at (x, z), facing the way of ang: straight down at first, then out from the rock as it drops, spreading
    const nx = Math.sin(ang), nz = Math.cos(ang), n = 14, C = 7;
    const ribbon = (wide, back, edge) => { const pos = [], uv = [], idx = [], col = [];
      for (let i = 0; i <= n; i++) { const t = i / n, y = y1 - (y1 - y0) * t, out = fallOut(y1 - y0, t) - back, ww = w * wide * (0.7 + 0.9 * t + 0.025 * Math.sin(i * 1.3 + x)) / 2;
        for (let c = 0; c < C; c++) { const sd = c / (C - 1) * 2 - 1, o2 = out + (1 - sd * sd) * w * 0.16 * (0.4 + t); pos.push(x + nx * o2 + nz * sd * ww, y, z + nz * o2 - nx * sd * ww); uv.push((sd + 1) / 2, (y1 - y) * D / 64 * 0.4); col.push(1, 1, 1, (t > 0.78 ? (1 - t) / 0.22 : 1) * (1 - edge * sd * sd)); }      // (rounded across, so it is not a board from the side; thinning toward its edges and to nothing at its foot)
        if (i) for (let c = 0; c < C - 1; c++) { const a = (i - 1) * C + c; idx.push(a, a + 1, a + C + 1, a, a + C + 1, a + C); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); return g; };
    const v = new THREE.Mesh(ribbon(1.7, 0.15, 0.85), veilMat); v.renderOrder = 3; const f = new THREE.Mesh(ribbon(1, 0, 0.35), fallMat); f.renderOrder = 4; const f2 = new THREE.Mesh(ribbon(0.75, -0.12, 0.2), fallMat2); f2.renderOrder = 5; group.add(v, f, f2);
    const out = fallOut(y1 - y0); falls.push({ x: x + nx * out, z: z + nz * out, y0: Math.max(y0, 0), y1, w, nx, nz });
  };
  if (WATER) for (const f of FALLS.list) fall(...f);
  const streamMat = new THREE.MeshBasicMaterial({ map: tex.stream, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(1.0, 1.0, 1.05), fog: true });
  const stream = (pts, w) => {                           // a run of water over the ground to where it falls
    const pos = [], uv = [], col = [], idx = []; let L = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)], dx = q[0] - o[0], dz = q[2] - o[2], l = Math.hypot(dx, dz) || 1; if (i) L += Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]);
      for (const sd of [-1, 1]) { pos.push(p[0] - dz / l * sd * w / 2, p[1], p[2] + dx / l * sd * w / 2); uv.push((sd + 1) / 2, L * D / 64 * 0.4); col.push(1, 1, 1, i === 0 ? 0 : 1); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
    const s = new THREE.Mesh(g, streamMat); s.renderOrder = 2; group.add(s);
  };
  if (WATER) { const y = T.R1.y + 0.07, e = lip('R1', 122, 1.0), fa = footOf(FALLS.a), ys = MASSIFS[2][4] + 0.06, fd = footOf(FALLS.d), y3 = T.R3.y + 0.07, y4 = T.R4.y + 0.07, fc = footOf(FALLS.c), e4 = lip('R4', 75, 1.0);
    stream([V(10.2, y, 3.9), V(8.6, y, 4.6), V(6.6, y, 5.2), V(e[0], y, e[1])], 1.5); stream([V(fa[0] + 0.9, ys, fa[1] + 0.2), V((fa[0] + FALLS.b[0]) / 2, ys, fa[1] + 0.35), V(FALLS.b[0] - 0.2, ys, fa[1])], 2.3);
    stream([V(fc[0] - 0.2, y3, fc[1] - 1.0), V(fc[0], y3, fc[1]), V(FALLS.d[0], y3, FALLS.d[1])], 1.3); stream([V(fd[0], y4, fd[1] - 0.6), V(22.7, y4, -4.4), V(23.5, y4, -1.6), V(26.6, y4, 0.1), V(e4[0], y4, e4[1])], 1.2); }
  anim.push((t) => { tex.fall.offset.y = -t * 0.9; fall2.offset.y = -t * 1.25; tex.stream.offset.y = -t * 0.35; });      // (the picture is slid upward under the water, so the water runs down)
  return { group, nav, anim, falls, mats, houses: HOUSES, folk, stepBridges, hub, setIntro, plan: { TERRACES, STAIRS, BRIDGES, CAUSEWAYS, WAYS: WAYS.map((wy) => ({ w: wy.w, flights: wy.flights.map((f) => [f.a, f.b]), landings: wy.landing ? [{ c: wy.landing.c, y: wy.landing.y, pts: wy.landing.pts }] : [] })) } };
}

// ---------------------------------------------------------------- where one can walk
export function makeNav(nav) {
  const blocked = (x, z) => nav.blocks.some((b) => { const c = Math.cos(-b.rot), s = Math.sin(-b.rot), dx = x - b.x, dz = z - b.z, lx = dx * c + dz * s, lz = -dx * s + dz * c; return Math.abs(lx) < b.hw && Math.abs(lz) < b.hd; });
  // on a stair he goes up the line of the steps' front edges, so he climbs evenly and his feet never sink into a tread; he rises onto the first step over the last stride before it
  const stairY = (r, t, L) => { const h = (r.b[2] - r.a[2]) / r.steps, d0 = 0.45 / L; if (t <= -d0) return r.a[2]; if (t < 0) { const k = (t + d0) / d0; return r.a[2] + h * k * k * (3 - 2 * k); } return Math.min(r.b[2], r.a[2] + h + (r.b[2] - r.a[2]) * t); };
  const rampAt = (r, x, z) => { const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1], L = Math.hypot(dx, dz), t = ((x - r.a[0]) * dx + (z - r.a[1]) * dz) / (L * L), side = Math.abs((x - r.a[0]) * dz - (z - r.a[1]) * dx) / L, tc = Math.max(0, Math.min(1, t)); return { t, side, L, y: r.steps ? stairY(r, t, L) : r.a[2] + (r.b[2] - r.a[2]) * tc - r.sag * hang(tc) - (r.dip ? r.dip(tc) : 0) }; };      // (on a stair he stands on each step in turn)
  const heights = (x, z) => { const out = [];
    for (const p of nav.polys) if (inPoly(p.pts, x, z)) out.push([p.y, p.kind ?? 'ground']);
    for (const r of nav.ramps) { const q = rampAt(r, x, z); if (q.side < r.w / 2 && q.t > -(r.ext ?? 0.9) / q.L && q.t < 1 + (r.ext ?? 0.9) / q.L) out.push([q.y, r.sag ? 'wood' : 'stone']); }
    return out; };
  const api = { kind: 'ground',                        // (kind: what is underfoot at the last place asked about: ground, stone steps or a wooden bridge)
    ground(x, z, y) { if (blocked(x, z)) return null; let best = null; for (const e of heights(x, z)) if (Math.abs(e[0] - y) < 0.75 && (best === null || e[0] > best[0])) best = e;      // the highest thing within a step's reach: a stair lies on the ground, not under it
      if (best && best[1] === 'ground') for (const r of nav.ramps) { if (r.sag) continue; const q = rampAt(r, x, z); if (q.side < r.w / 2 + 0.45 && q.t > 0.02 && q.t < 0.98 && q.y - best[0] > 0.4) return null; }      // (and a stair's side is a wall: one gets on at its foot or its head)
      if (best && best[1] === 'ground') for (const p of nav.pads) if (Math.hypot(x - p.c[0], z - p.c[1]) < p.r && p.y - best[0] > 0.4) return null;
      if (best) api.kind = best[1]; return best ? best[0] : null; },
    top(x, z) { const h = heights(x, z).map((e) => e[0]); return h.length ? Math.max(...h) : null; } };
  return api;
}
