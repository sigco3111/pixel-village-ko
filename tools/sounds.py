# Makes the village's own sound files from recordings in the Sonniss GDC bundles, in the folder SONNISS names or in
# sonniss/ beside this repo's files (see MISSING_ASSETS.md; games only: these
# are never handed on as loose sounds, never put in a public source repo, never sent to an AI service). Each is cut,
# faded into a loop or a single step, levelled and written as a small .ogg in audio/. The sources are listed in
# audio/sources.json. The music, audio/music.mp3, is in the repo (CC BY 4.0, see CREDITS.md).
#   python tools/sounds.py
import subprocess, os, json, shutil
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); SRC = os.environ.get('SONNISS', os.path.join(HERE, '..', 'sonniss')).replace(os.sep, '/').rstrip('/') + '/'; OUT = os.path.join(HERE, '..', 'audio').replace(os.sep, '/') + '/'; SR = 44100
os.makedirs(OUT, exist_ok=True)
def load(path, start=0.0, dur=None, ch=2):
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(start)] + (['-t', str(dur)] if dur else []) + ['-i', SRC + path, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).reshape(-1, ch).copy()
def save(name, x, q=4):
    x = np.clip(x, -1, 1).astype(np.float32); ch = x.shape[1]
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-i', '-', '-c:a', 'libvorbis', '-q:a', str(q), OUT + name], input=x.tobytes(), check=True)
    print('%-12s %5.1f s  rms %.3f  peak %.2f' % (name, len(x) / SR, float(np.sqrt((x ** 2).mean())), float(np.abs(x).max())))
def rms(x): return float(np.sqrt((x ** 2).mean()) + 1e-9)
def loop(x, seconds, fade=3.0):
    """A stretch that runs into its own start: the last few seconds are laid under the first."""
    L, F = int(seconds * SR), int(fade * SR); y = x[:L + F]; a = np.linspace(0, 1, F)[:, None]; out = y[:L].copy(); out[:F] = y[:F] * np.sqrt(a) + y[L:L + F] * np.sqrt(1 - a); return out
used = {}
def use(key, path): used[key] = path; return path

x = load(use('sea', '2018/Discover Oregon - Ocean and Stream/Ocean Waves 2017 Kauai Night Waves.WAV'), 20, 66)        # the sea, far below
x = loop(x, 60, 5); save('sea.ogg', x * (0.06 / rms(x)), q=3)
x = load(use('fall', '2018/Discover Oregon - Ocean and Stream/Streams 2014 McKenzie 1.wav'), 3, 37)                   # falling water
x = loop(x, 32); save('fall.ogg', x * (0.07 / rms(x)), q=3)
x = load(use('wind', '2018/Discover Oregon - Wind and Storms/Wind Gusts 2016 Lookout Snow - Biggest Gusts Long.wav'), 30, 64)   # wind on the cliffs
x = loop(x, 58, 5); save('wind.ogg', x * (0.035 / rms(x)), q=3)

def step(name, path):                                                                                                    # single footsteps, each kind of ground its own
    s = load(use(name, path), ch=1); s = s[:int(0.5 * SR)].copy(); f = int(0.14 * SR); s[:120] *= np.linspace(0, 1, 120)[:, None]; s[-f:] *= np.linspace(1, 0, f)[:, None]
    save(name + '.ogg', s * (0.5 / max(1e-6, np.abs(s).max())), q=4)
step('ground0', '2016/Levan Nadashvili - Civilian Footsteps/FS Ground Civilian Walk N03.wav'); step('ground1', '2016/Levan Nadashvili - Civilian Footsteps/FS Ground Civilian Walk N05.wav')
step('wood0', '2016/Levan Nadashvili - Civilian Footsteps/FS Wood Civilian Crouch N03.wav'); step('wood1', '2016/Levan Nadashvili - Civilian Footsteps/FS Wood Civilian Crouch N05.wav')
step('stone0', '2016/Levan Nadashvili - Soldier Footsteps/FS Concrete Soldier Crouch N02.wav'); step('stone1', '2016/Levan Nadashvili - Soldier Footsteps/FS Concrete Soldier Crouch N05.wav')

json.dump({'note': 'Sonniss GDC Game Audio Bundle recordings, cut and levelled for this game. Games only; never to be passed on as sounds or put in a public source repo.', 'sources': used}, open(OUT + 'sources.json', 'w'), indent=1)
print('sources.json written')
