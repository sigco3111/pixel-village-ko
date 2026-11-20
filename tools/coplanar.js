// Run in the page ("evalfile tools/coplanar.js"): where do two faces of different materials lie in one plane and overlap?
// Those are the places that flicker as the eye moves. Answers with how many such pairs there are for each pair of
// materials, and one place for each.
(() => {
  const g = window.__game, B = new Map(), out = {}, FLAT = ['verge', 'pave'];      // (cut-out pictures laid flat are checked against themselves too: two of them overlapping in one plane flicker)
  g.world.group.traverse((o) => { if (!o.isMesh || !o.geometry.attributes.position || o.geometry.index || o.material.transparent) return; const p = o.geometry.attributes.position.array, name = o.name || 'x';
    for (let i = 0; i < p.length; i += 9) { const ax = p[i], ay = p[i + 1], az = p[i + 2], ux = p[i + 3] - ax, uy = p[i + 4] - ay, uz = p[i + 5] - az, vx = p[i + 6] - ax, vy = p[i + 7] - ay, vz = p[i + 8] - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 0.02) continue; nx /= l; ny /= l; nz /= l;
      if (nx < -1e-6 || (Math.abs(nx) <= 1e-6 && (ny < -1e-6 || (Math.abs(ny) <= 1e-6 && nz < 0)))) { nx = -nx; ny = -ny; nz = -nz; }
      const d = nx * ax + ny * ay + nz * az, key = Math.round(nx * 200) + ',' + Math.round(ny * 200) + ',' + Math.round(nz * 200) + ',' + Math.round(d * 250);
      const xs = [ax, p[i + 3], p[i + 6]], ys = [ay, p[i + 4], p[i + 7]], zs = [az, p[i + 5], p[i + 8]];
      (B.get(key) ?? B.set(key, []).get(key)).push({ name, lo: [Math.min(...xs), Math.min(...ys), Math.min(...zs)], hi: [Math.max(...xs), Math.max(...ys), Math.max(...zs)], n: [nx, ny, nz], t: [[xs[0], zs[0]], [xs[1], zs[1]], [xs[2], zs[2]]] }); } });
  const inTri = (q, t) => { const s = (a, b) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]), d = [s(t[0], t[1]), s(t[1], t[2]), s(t[2], t[0])], A = Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0])), e = A * 0.04; return d.every((v) => v > e) || d.every((v) => v < -e); }, mid = (t) => [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3];
  for (const list of B.values()) { if (list.length < 2 || list.length > 400) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j]; if (a.name === b.name && !FLAT.includes(a.name)) continue; if (a.name === b.name && (Math.abs(a.n[1]) < 0.99 || !(inTri(mid(a.t), b.t) || inTri(mid(b.t), a.t)))) continue; let big = 0;
      for (let k = 0; k < 3; k++) { const ov = Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]); if (ov < -1e-4) { big = -9; break; } if (ov > 0.04) big++; }
      if (big < 2) continue; const k2 = [a.name, b.name].sort().join(' + '); (out[k2] ??= { pairs: 0, at: a.lo.map((v, q) => +((Math.max(v, b.lo[q]) + Math.min(a.hi[q], b.hi[q])) / 2).toFixed(2)) }).pairs++; } }
  return out;
})()
