// Run in the page ("evalfile tools/climb.js"): walk up the main stair in 2 cm steps and report the biggest jump in height
// between one place and the next. A smooth climb has none bigger than a few centimetres.
(() => { const g = window.__game, out = []; for (const r of g.world.nav.ramps) { if (!r.steps) continue; const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1], L = Math.hypot(dx, dz); let y = r.a[2], worst = 0, ok = true;
    for (let d = -0.9; d <= L + 0.9; d += 0.02) { const ny = g.nav.ground(r.a[0] + dx / L * d, r.a[1] + dz / L * d, y); if (ny === null) { ok = false; continue; } worst = Math.max(worst, Math.abs(ny - y)); y = ny; }
    out.push({ rise: +(r.b[2] - r.a[2]).toFixed(2), worstJumpCm: +(worst * 100).toFixed(1), reachedTop: Math.abs(y - r.b[2]) < 0.1, clear: ok }); } return out; })()
