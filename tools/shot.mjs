// Runs the village headless and muted, and takes stills: node tools/shot.mjs <out folder> "<steps>"
// steps, separated by ';': wait <s> | shot <name> | hold <key codes,> <s> | put <x> <z> | view <json> | say | eval <js>
import { mkdirSync, createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guard } from './no-pointer-lock.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ? pathToFileURL(process.env.PLAYWRIGHT_CORE).href : 'playwright-core');      // (npm install, or PLAYWRIGHT_CORE=<a copy's index.mjs>)
guard(chromium);
const root = resolve(fileURLToPath(import.meta.url), '..', '..'), out = resolve(process.argv[2] ?? join(root, 'out', 'shots')), steps = (process.argv[3] ?? 'wait 2; shot start').split(';').map((s) => s.trim()).filter(Boolean);
mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => { let f = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': types[extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); createReadStream(f).pipe(res); }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const [vw, vh] = (process.env.VIEW ?? '1920x1080').split('x').map(Number);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 })).newPage();
const errors = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/${process.env.QUERY ?? '?nointro'}`);
try { await page.waitForFunction(() => window.__game && window.__game.frames > 3, null, { timeout: 30000 }); } catch { console.log('the game did not start'); }
for (const s of steps) { const [cmd, ...a] = s.split(/\s+/);
  if (cmd === 'wait') await page.waitForTimeout(Number(a[0]) * 1000);
  else if (cmd === 'hold') { const ks = a[0].split(','); for (const k of ks) await page.keyboard.down(k); await page.waitForTimeout(Number(a[1]) * 1000); for (const k of ks) await page.keyboard.up(k); }
  else if (cmd === 'put') await page.evaluate(([x, z]) => window.__game.put(x, z), [Number(a[0]), Number(a[1])]);
  else if (cmd === 'view') await page.evaluate((j) => { const v = JSON.parse(j), g = window.__game.view; for (const k in v) { if (k === 't') g.t.set(...v.t); else g[k] = v[k]; } }, a.join(' '));
  else if (cmd === 'eval') console.log(JSON.stringify(await page.evaluate(a.join(' '))));
  else if (cmd === 'evalfile') console.log(JSON.stringify(await page.evaluate((await import('node:fs')).readFileSync(join(root, a[0]), 'utf8'))));
  else if (cmd === 'shot') await page.screenshot({ path: join(out, a[0] + '.png') });
  else if (cmd === 'say') console.log(JSON.stringify(await page.evaluate(() => ({ me: window.__game.me, frames: window.__game.frames, tris: window.__game.renderer.info.render.triangles }))));
}
console.log(errors.length ? 'messages:\n' + [...new Set(errors)].slice(0, 14).join('\n') : 'no errors');
await browser.close(); server.close();
