# Licence notes: Pixel village

Code MIT. Checked 2026-11-19.

| Part | Where it came from | Licence | In this repo? |
|---|---|---|---|
| `main.js`, `world.js`, `textures.js`, `index.html` (the village, its pixel textures, the wanderer and townsfolk, the light, the finishing of the picture) | Written by Patch for this block. Every texture and sprite is drawn by this code as the page loads; no picture or model is loaded | MIT; what it draws CC0 1.0 | Yes |
| `build.mjs`, `tools/` | Written by Patch for this block | MIT | Yes |
| `lib/three.module.js`, `lib/three.core.js` | three.js r186, the files from its npm package, unchanged | MIT, `lib/THREE-LICENSE` | Yes |
| `lib/patch-block.js` | Patch's block helper, from patch.gg/patch-block.js | Patch's, shipped with every block | Yes |
| `audio/music.mp3` | "Evening Fall (Harp)" by Kevin MacLeod, incompetech.com (https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100236), the file as in Patch's asset library (`incompetech:evening_fall_harp`), unchanged | CC BY 4.0, `LICENSES/CC-BY-4.0.txt` | Yes, in Git LFS |
| `audio/sea.ogg`, `wind.ogg`, `fall.ogg`, `ground0-1.ogg`, `stone0-1.ogg`, `wood0-1.ogg` | Cut and levelled by `tools/sounds.py` from the Sonniss GDC Game Audio Bundles (the libraries are named in `audio/sources.json`) | Sonniss GDC bundle licence (https://sonniss.com/gdc-bundle-license/): free to use in a game, not to be passed on as files. Not an open licence | **No.** The published demo plays them; `.gitignore` keeps them out. See `MISSING_ASSETS.md` |
| `shots/` | Stills of this demo | CC0 1.0, Patch | Yes, in Git LFS |

The wanderer and the townsfolk are Patch's own designs, drawn by `hero()` and `folk()` in `textures.js`.

Because the published demo plays recordings that are not open, Patch lists this project's art as not openly licensed. That is about those recordings only: everything in this repo is under the licences above.

**Nothing here has no stated source.**
