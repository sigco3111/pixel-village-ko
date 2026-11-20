// Run in the page ("evalfile tools/herosheet.js"): the wanderer's drawn sheet, as a data URL, so it can be looked at by itself.
(() => { let c = null; window.__game.scene.traverse((o) => { const i = o.material && o.material.map && o.material.map.image; if (i && i.width === 1008 && i.toDataURL) c = i; }); return c ? c.toDataURL() : null; })()
