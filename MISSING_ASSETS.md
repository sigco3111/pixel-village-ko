# Recordings that are not in this repo

**In one line:** the demo runs without them, with its music and no other sound. To have the rest, make your own files with the names below.

## What this is about

The published demo plays eight short recordings: the sea, the wind, and two footsteps each on ground, stone and wood. They were cut from the Sonniss GDC Game Audio Bundles. Their licence (https://sonniss.com/gdc-bundle-license/) lets anyone use them in a game, free, with no credit needed, but does not let anyone pass the recordings on as files. So:

- they are **not in this repo**, and `.gitignore` keeps `audio/*.ogg` and `sonniss/` out of it;
- **never commit them** to a repo other people can read, and never upload them anywhere as sounds;
- a game you publish **may** play them. Say in its credits that its sound uses Sonniss recordings, and don't call its sound CC0 or CC BY.

The code does not mind a missing file: `loadSound()` in `main.js` plays what it finds.

## What they are

| File in `audio/` | Heard as | Length |
| --- | --- | --- |
| `sea.ogg` | The sea, far below; louder low down | 60 s loop |
| `wind.ogg` | Wind on the cliffs; louder high up | 58 s loop |
| `ground0.ogg`, `ground1.ogg` | A footstep on earth and cobbles | under half a second |
| `stone0.ogg`, `stone1.ogg` | A footstep on a stone stair | under half a second |
| `wood0.ogg`, `wood1.ogg` | A footstep on a bridge's boards | under half a second |
| `fall.ogg` | Falling water. Only loaded if the village has a waterfall, and this one has none | 32 s loop |

`audio/sources.json` names the recording each was cut from.

## Getting them

- **Your own:** put Ogg Vorbis files with those names in `audio/`. Patch's asset library has CC0 and CC BY sounds that may go in a repo.
- **The same ones:** the bundles are a free download from Sonniss (many gigabytes; ask the person before downloading). With them in a folder, `SONNISS=<that folder> python tools/sounds.py` cuts the same files (it needs ffmpeg and numpy).
