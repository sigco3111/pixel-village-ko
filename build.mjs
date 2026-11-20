// Puts the demo as it is published into dist/ (index.html at the top): node build.mjs
// There is nothing to compile. It copies the page, its modules, three.js, the block helper, the sounds that are here
// (the recordings are not in the repo: MISSING_ASSETS.md) and the licences.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), dist = path.join(here, 'dist');
fs.rmSync(dist, { recursive: true, force: true }); fs.mkdirSync(path.join(dist, 'audio'), { recursive: true });
const put = (from, to = from) => fs.cpSync(path.join(here, from), path.join(dist, to), { recursive: true });
for (const f of ['index.html', 'main.js', 'world.js', 'textures.js', 'lib', 'LICENSES', 'CREDITS.md', 'LICENCE-NOTES.md']) put(f);
put('LICENSE', 'LICENSE.txt');
const sounds = ['music.mp3', 'sea.ogg', 'wind.ogg', 'ground0.ogg', 'ground1.ogg', 'stone0.ogg', 'stone1.ogg', 'wood0.ogg', 'wood1.ogg'], missing = [];
for (const f of sounds) { if (fs.existsSync(path.join(here, 'audio', f))) put('audio/' + f); else missing.push(f); }

let bytes = 0;
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else bytes += fs.statSync(p).size; } };
walk(dist);
console.log(`dist: ${(bytes / 1048576).toFixed(1)} MB` + (missing.length ? `, without ${missing.join(', ')} (MISSING_ASSETS.md)` : ''));
