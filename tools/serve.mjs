// Serves the village on this PC for playing: node tools/serve.mjs  ->  http://localhost:5545
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(import.meta.url), '..', '..'), port = Number(process.env.PORT ?? 5545);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
createServer((req, res) => {
  let f = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404).end('not found'); return; }
  const size = statSync(f).size, range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? ''), head = { 'Content-Type': types[extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  if (range) { const a = Number(range[1]), b = range[2] ? Number(range[2]) : size - 1; res.writeHead(206, { ...head, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 }); createReadStream(f, { start: a, end: b }).pipe(res); }
  else { res.writeHead(200, { ...head, 'Content-Length': size }); createReadStream(f).pipe(res); }
}).listen(port, '127.0.0.1', () => console.log(`cliff village on http://localhost:${port}`));
