// Run in the page by shot.mjs ("evalfile tools/walkcheck.js"): can every stair and bridge be walked from end to end, and
// does each lead onto ground at both ends? Answers with what fails.
(() => {
  const g = window.__game, bad = [];
  g.world.nav.ramps.forEach((r, i) => {
    const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1], L = Math.hypot(dx, dz);
    for (let k = 1; k <= 19; k++) { const t = k / 20, tc = Math.max(0, Math.min(1, t)), x = r.a[0] + dx * t, z = r.a[1] + dz * t, y = r.a[2] + (r.b[2] - r.a[2]) * tc - r.sag * 4 * tc * (1 - tc);
      if (g.nav.ground(x, z, y) === null) bad.push({ ramp: i, t: +t.toFixed(2), x: +x.toFixed(1), z: +z.toFixed(1), y: +y.toFixed(1) }); }
  });
  return { ramps: g.world.nav.ramps.length, bad };
})()
