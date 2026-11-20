// Films the village building itself, frame by frame, so every frame is whole and the timing exact:
//   node tools/film.mjs [seconds=9.5] [fps=60] [width=1920] [height=1080]
// It runs the game headless and muted with ?film&intro, moves it on one frame at a time, saves each as a picture in
// out/film/frames, and has ffmpeg join them into out/film/cliff-village-build-up.mp4. There is no sound in it.
import { mkdirSync, rmSync, createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guard } from './no-pointer-lock.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ? pathToFileURL(process.env.PLAYWRIGHT_CORE).href : 'playwright-core');      // (npm install, or PLAYWRIGHT_CORE=<a copy's index.mjs>)
guard(chromium);
const root = resolve(fileURLToPath(import.meta.url), '..', '..'), secs = Number(process.argv[2] ?? 9.5), fps = Number(process.argv[3] ?? 60), vw = Number(process.argv[4] ?? 1920), vh = Number(process.argv[5] ?? 1080);
const dir = join(root, 'out', 'film'), frames = join(dir, 'frames'); rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => { let f = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': types[extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); createReadStream(f).pipe(res); }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/?film&intro`);
await page.waitForFunction(() => window.__game && window.__game.frames >= 1, null, { timeout: 30000 });
const n = Math.round(secs * fps);
for (let i = 0; i < n; i++) { await page.evaluate((ms) => window.__game.tick(ms), 1000 / fps); await page.screenshot({ path: join(frames, 'f' + String(i).padStart(4, '0') + '.png') }); if (i % 60 === 0) console.log('frame', i, 'of', n); }
await browser.close(); server.close();
if (errors.length) console.log('page errors:\n' + errors.join('\n'));
const out = join(dir, 'cliff-village-build-up.mp4');
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(frames, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log(r.status === 0 ? 'made ' + out : 'ffmpeg failed');
