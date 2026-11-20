// Run in the page ("evalfile tools/offsetcheck.js"): which way does a picture slide when its offset grows? One white row
// in an 8-row picture on a square; the answer is the row it shows at with no offset and with an offset of +2 rows.
(async () => {
  const THREE = await import('./lib/three.module.js'), r = window.__game.renderer, d = new Uint8Array(8 * 4 * 1); for (let i = 0; i < 8; i++) { const v = i === 4 ? 255 : 0; d.set([v, v, v, 255], i * 4); }
  const t = new THREE.DataTexture(d, 1, 8); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
  const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: t })); sc.add(m);
  const rt = new THREE.WebGLRenderTarget(1, 8), row = () => { r.setRenderTarget(rt); r.render(sc, cam); const px = new Uint8Array(32); r.readRenderTargetPixels(rt, 0, 0, 1, 8, px); r.setRenderTarget(null); let b = -1; for (let i = 0; i < 8; i++) if (px[i * 4] > 128) b = i; return b; };
  const a = row(); t.offset.y = 0.25; const b = row();
  return { rowAtZero: a, rowAtPlusQuarter: b, meaning: b < a ? 'a growing offset slides the picture toward smaller v' : 'a growing offset slides the picture toward larger v' };
})()
