# Draws the village's plan from above (north up, the eye looks from the bottom): python tools/map.py <plan.json> <out.png>
import json, sys
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1])); S = 22; ox, oz = 24, 22
P = lambda x, z: ((x + ox) * S, (z + oz) * S)
im = Image.new('RGB', (58 * S, 42 * S), (24, 26, 34)); dr = ImageDraw.Draw(im)
for gx in range(-24, 34, 2): dr.line([P(gx, -22), P(gx, 20)], fill=(40, 42, 52)); dr.text(P(gx, -21.8), str(gx), fill=(120, 120, 130))
for gz in range(-22, 20, 2): dr.line([P(-24, gz), P(34, gz)], fill=(40, 42, 52)); dr.text(P(-23.8, gz), str(gz), fill=(120, 120, 130))
for t in sorted(d['terraces'], key=lambda t: t['y']):
    k = int(60 + t['y'] * 7); dr.polygon([P(*p) for p in t['outline']], fill=(k, k - 10, k - 30), outline=(230, 220, 180)); dr.line([P(*p) for p in t['walk']] + [P(*t['walk'][0])], fill=(110, 150, 110))
    dr.text(P(t['c'][0] - 0.6, t['c'][1] + 2.4), '%s y%.1f' % (t['id'], t['y']), fill=(255, 255, 255))
for b in d['blocks']: dr.rectangle([P(b['x'] - b['hw'], b['z'] - b['hd']), P(b['x'] + b['hw'], b['z'] + b['hd'])], outline=(150, 80, 80))
for h in d['houses']: dr.rectangle([P(h['x'] - h['w'] / 2, h['z'] - h['d'] / 2), P(h['x'] + h['w'] / 2, h['z'] + h['d'] / 2)], fill=(170, 150, 120), outline=(60, 40, 30))
for a, b in d['bridges']: dr.line([P(a[0], a[1]), P(b[0], b[1])], fill=(210, 150, 70), width=6)
for a, b in d.get('causeways') or []: dr.line([P(a[0], a[1]), P(b[0], b[1])], fill=(150, 200, 120), width=int(2.1 * S))
if d.get('ways'):
    for wy in d['ways']:
        for s in wy['flights']: dr.line([P(s[0][0], s[0][1]), P(s[1][0], s[1][1])], fill=(120, 200, 255), width=int(wy['w'] * S))
        for l in wy['landings']: dr.polygon([P(*p) for p in l['pts']], fill=(200, 230, 255))
else:
    for a, b in d['stairs']: dr.line([P(a[0], a[1]), P(b[0], b[1])], fill=(120, 200, 255), width=int(2.6 * S)); dr.ellipse([P(b[0] - 0.3, b[1] - 0.3), P(b[0] + 0.3, b[1] + 0.3)], fill=(255, 255, 255))
for f in d['folk']: dr.ellipse([P(f[0] - 0.25, f[1] - 0.25), P(f[0] + 0.25, f[1] + 0.25)], fill=(240, 120, 200))
dr.ellipse([P(d['start'][0] - 0.3, d['start'][1] - 0.3), P(d['start'][0] + 0.3, d['start'][1] + 0.3)], fill=(255, 60, 60))
im.save(sys.argv[2])
