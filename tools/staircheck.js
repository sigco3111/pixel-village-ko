// Run in the page ("evalfile tools/staircheck.js"): for each stair, how far its foot and its head stand from the edge of
// the terrace each is on (inside is positive), along the stair's own line. A head far inside its terrace is buried in it;
// a foot outside its terrace hangs in the air.
(() => {
  const g = window.__game, { TERRACES, STAIRS } = g.world.plan, T = Object.fromEntries(TERRACES.map((t) => [t.id, t]));
  const inPoly = (pts, x, z) => { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };
  const depth = (pts, x, z, ux, uz) => { const ins = inPoly(pts, x, z); for (let d = 0; d < 12; d += 0.05) { if (inPoly(pts, x + ux * d * (ins ? 1 : -1), z + uz * d * (ins ? 1 : -1)) !== ins) return +(ins ? d : -d).toFixed(2); } return ins ? 12 : -12; };
  return STAIRS.map(([a, b], i) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    return { stair: i, from: a[2], to: b[2], rise: T[b[2]].y - T[a[2]].y, run: +L.toFixed(1), footInside: depth(T[a[2]].outline, a[0], a[1], ux, uz), headInside: depth(T[b[2]].outline, b[0], b[1], -ux, -uz), footOverUpper: inPoly(T[b[2]].outline, a[0], a[1]), headOverLower: inPoly(T[a[2]].outline, b[0], b[1]) }; });
})()
