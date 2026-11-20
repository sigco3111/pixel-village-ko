// Run in the page ("evalfile tools/reach.js"): starting where the wanderer starts and walking as he walks (quarter-metre
// steps in eight directions, the same ground rule), which terraces can be reached, and which stairs and bridges get walked
// from end to end? This is the real test of whether the village can be walked.
(() => {
  const g = window.__game, { TERRACES, STAIRS, BRIDGES } = g.world.plan, step = 0.25, seen = new Map(), key = (x, z, y) => Math.round(x / step) + ',' + Math.round(z / step) + ',' + Math.round(y / 0.5);
  const y0 = g.nav.top(g.me.x, g.me.z) ?? g.me.y, q = [[Math.round(g.me.x / step) * step, Math.round(g.me.z / step) * step, y0]]; seen.set(key(...q[0]), q[0]);
  while (q.length) { const [x, z, y] = q.pop(); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nx = x + dx * step, nz = z + dz * step, ny = g.nav.ground(nx, nz, y); if (ny === null) continue; const k = key(nx, nz, ny); if (!seen.has(k)) { seen.set(k, [nx, nz, ny]); q.push([nx, nz, ny]); } } }
  const pts = [...seen.values()], near = (x, z, y, r = 0.6) => pts.some((p) => Math.hypot(p[0] - x, p[1] - z) < r && Math.abs(p[2] - y) < 0.6), T = Object.fromEntries(TERRACES.map((t) => [t.id, t]));
  const ends = (list, name) => list.map(([a, b], i) => ({ [name]: i, from: a[2], to: b[2], foot: near(a[0], a[1], T[a[2]].y), head: near(b[0], b[1], T[b[2]].y), middle: near((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (T[a[2]].y + T[b[2]].y) / 2, 0.8) || pts.some((p) => Math.hypot(p[0] - (a[0] + b[0]) / 2, p[1] - (a[1] + b[1]) / 2) < 0.6 && Math.abs(p[2] - (T[a[2]].y + T[b[2]].y) / 2) < 1.6) }));
  return { places: pts.length, terraces: Object.fromEntries(TERRACES.map((t) => [t.id, pts.filter((p) => Math.abs(p[2] - t.y) < 0.1 && ((p[0] - t.c[0]) / t.r[0]) ** 2 + ((p[1] - t.c[1]) / t.r[1]) ** 2 < 1).length])), stairs: ends(STAIRS, 'stair').map((s, i) => { const l = g.world.plan.WAYS && g.world.plan.WAYS[i].landings[0]; if (l) s.middle = near(l.c[0], l.c[1], l.y, 0.9); return s; }).filter((s) => !(s.foot && s.head && s.middle)), bridges: ends(BRIDGES, 'bridge').filter((s) => !(s.foot && s.head && s.middle)) };
})()
