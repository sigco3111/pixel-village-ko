// Measures how much the sea shimmers over time, to catch it pulsing:
//   node tools/shimmer.mjs [seconds=24] [picture.png]
// It runs the game headless and muted from the server on port 5545, moves it on in steps of a tenth of a second, and
// reads the brightness of the open water at the left edge of the picture (ten times the mean of 0-255) each time.
// A steady shimmer gives a number that hardly moves; a pulse shows as one swinging between high and low.
import { pathToFileURL } from 'node:url';
import { guard } from './no-pointer-lock.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ? pathToFileURL(process.env.PLAYWRIGHT_CORE).href : 'playwright-core');      // (npm install, or PLAYWRIGHT_CORE=<a copy's index.mjs>)
guard(chromium);
const secs = Number(process.argv[2] ?? 24), shot = process.argv[3];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('page error:', String(e)));
await page.goto('http://127.0.0.1:5545/?film');
await page.waitForFunction(() => window.__game && window.__game.frames >= 1, null, { timeout: 30000 });
const counts = [];
for (let i = 0; i < secs * 10; i++) counts.push(await page.evaluate(() => { const g = window.__game; g.tick(50); g.tick(50); const c = g.renderer.domElement, k = (window.__k ??= Object.assign(document.createElement('canvas'), { width: c.width, height: c.height })), x = k.getContext('2d', { willReadFrequently: true });
  x.drawImage(c, 0, 0); const d = x.getImageData(0, Math.floor(c.height * 0.13), Math.floor(c.width * 0.125), Math.floor(c.height * 0.56)).data; let n = 0; for (let j = 0; j < d.length; j += 4) n += d[j] + d[j + 1] + d[j + 2]; return Math.round(n / d.length * 4 / 3 * 10); }));
if (shot) await page.screenshot({ path: shot });
await browser.close();
for (let s = 0; s < secs; s += 2) { const part = counts.slice(s * 10, s * 10 + 20); console.log(String(s).padStart(2) + '-' + String(s + 2).padStart(2) + ' s  low ' + String(Math.min(...part)).padStart(6) + '  high ' + String(Math.max(...part)).padStart(6) + '   ' + part.map((v) => String(v).padStart(5)).join(' ')); }
