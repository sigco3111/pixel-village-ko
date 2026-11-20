// Run in the page in film mode ("evalfile tools/tick.js"): moves the game on by half a second, a sixtieth at a time.
(() => { for (let i = 0; i < 30; i++) window.__game.tick(1000 / 60); return window.__game.frames; })()
