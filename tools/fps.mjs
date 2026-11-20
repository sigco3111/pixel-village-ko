// Measures the frame rate headless: node tools/fps.mjs [query]
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { guard } from './no-pointer-lock.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ? pathToFileURL(process.env.PLAYWRIGHT_CORE).href : 'playwright-core');      // (npm install, or PLAYWRIGHT_CORE=<a copy's index.mjs>)
guard(chromium);
const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => { let f = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': types[extname(f)] ?? 'application/octet-stream' }); createReadStream(f).pipe(res); }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const browser = await chromium.launch({ executablePath: `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu', '--disable-frame-rate-limit', '--disable-gpu-vsync'] });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/${process.argv[2] ?? '?nointro'}`);
await page.waitForFunction(() => window.__game && window.__game.frames > 3, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const out = await page.evaluate(async () => { const g = window.__game, f0 = g.frames, t0 = performance.now(); await new Promise((r) => setTimeout(r, 4000)); const gl = g.renderer.getContext(); let tris = 0; g.scene.traverse((o) => { if (o.isMesh && o.geometry.attributes.position) tris += o.geometry.attributes.position.count / 3; });
  return { fps: Math.round((g.frames - f0) / ((performance.now() - t0) / 1000)), tris: Math.round(tris), gpu: gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) }; });
console.log(JSON.stringify(out)); await browser.close(); server.close();
