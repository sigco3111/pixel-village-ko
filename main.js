// The cliff village, live: a real 3D world whose every surface is pixel art, under a low sun. The picture is made in
// steps: the world with its shadows; the light that blooms off what is bright; the sun's rays through the haze; the
// lens, sharp only round the wanderer; then the grade.
import * as THREE from './lib/three.module.js';
import { makeTextures, FOLK, HERO } from './textures.js';
import { buildWorld, makeNav, START, BUILD } from './world.js';
// 독립 실행판. 원본의 Patch 호스트 통신은 사용하지 않습니다.
const patchBlock = () => ({ ready() {} });

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.setPixelRatio(1);
const scene = new THREE.Scene(), tex = makeTextures(), world = buildWorld(tex), nav = makeNav(world.nav);
scene.add(world.group);

// ---------------------------------------------------------------- light
const SUN = new THREE.Vector3(-0.40, 0.10, -0.91).normalize();          // where the sun stands: low, behind the village and to the left
const HAZE = new THREE.Color(0.78, 0.56, 0.44);
scene.fog = new THREE.FogExp2(HAZE, 0.0011);
const KEY = new THREE.Vector3(-0.70, 0.56, 0.40).normalize();          // where the light on the village comes from: the left, a little in front, low
const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.83, 0.60), 4.8); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06;
Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 40, bottom: -40, near: 1, far: 260 }); sun.shadow.camera.updateProjectionMatrix(); scene.add(sun, sun.target);
const sky = new THREE.HemisphereLight(new THREE.Color(0.30, 0.30, 0.86), new THREE.Color(0.30, 0.19, 0.42), 0.34); scene.add(sky);
const rim = new THREE.DirectionalLight(new THREE.Color(1.0, 0.62, 0.32), 1.1); rim.position.set(SUN.x, 0.3, SUN.z); scene.add(rim);      // the sun itself, behind: it edges roofs and rock with gold, and has no shadows

const FS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const dome = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sunDir: { value: SUN }, time: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec3 vDir; uniform vec3 sunDir; uniform float time;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main(){ vec3 d = normalize(vDir); float s = max(dot(d, sunDir), 0.0);
      vec3 col = mix(vec3(1.25, 0.80, 0.46), vec3(0.34, 0.36, 0.66), smoothstep(-0.02, 0.5, d.y));
      col = mix(col, vec3(1.6, 1.0, 0.55), pow(s, 3.0) * 0.7); col += vec3(1.0, 0.75, 0.45) * (pow(s, 24.0) * 1.7 + pow(s, 900.0) * 16.0);
      float az = atan(d.x, -d.z), hh = (0.012 + 0.075 * n(vec2(az * 2.4 + 3.0, 1.0)) + 0.012 * n(vec2(az * 14.0, 5.0))) * smoothstep(0.02, 0.5, az) * (1.0 - smoothstep(1.5, 2.2, az));      // a far headland, to the right of the sun, soft in the haze
      float h2 = (0.004 + 0.03 * n(vec2(az * 3.1 + 9.0, 2.0))) * smoothstep(-1.6, -0.9, az) * (1.0 - smoothstep(-0.75, -0.5, az));
      vec2 q = vec2(az * 6.0 + time * 0.004, d.y * 26.0); float c = smoothstep(0.55, 0.8, n(q) * 0.6 + n(q * 2.3) * 0.4) * smoothstep(0.02, 0.12, d.y) * (1.0 - smoothstep(0.3, 0.6, d.y));      // long bars of cloud, lit from under
      col = mix(col, vec3(1.3, 0.72, 0.5) + vec3(0.9, 0.6, 0.3) * pow(s, 2.0), c * 0.55);
      if (d.y < 0.0) col = vec3(0.78, 0.56, 0.44) * (0.12 + 0.98 * pow(max(dot(normalize(d.xz), normalize(sunDir.xz)), 0.0), 5.0));       // under the horizon: the sea, far off
      float foot = smoothstep(-0.014, -0.002, d.y); col = mix(col, mix(vec3(0.30, 0.25, 0.30), col, 0.45), smoothstep(hh + 0.003, hh - 0.003, d.y) * step(0.0005, hh) * foot); col = mix(col, mix(vec3(0.34, 0.27, 0.30), col, 0.6), smoothstep(h2 + 0.002, h2 - 0.002, d.y) * step(0.0005, h2) * foot);
      gl_FragColor = vec4(col, 1.0); }` }));
dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);

const sea = new THREE.Mesh(new THREE.PlaneGeometry(5200, 5200), new THREE.ShaderMaterial({ fog: false, uniforms: { sunDir: { value: SUN }, time: { value: 0 }, haze: { value: HAZE } },
  vertexShader: `varying vec3 vPos; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `varying vec3 vPos; uniform vec3 sunDir, haze; uniform float time;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec2 p = vPos.xz; vec3 V = normalize(cameraPosition - vPos); vec2 rel = p - cameraPosition.xz; float dist = length(rel);
      float wav = sin(p.x * 0.33 + time * 0.5 + sin(p.y * 0.21) * 2.0) * sin(p.y * 0.47 - time * 0.36);
      vec3 col = mix(vec3(0.006, 0.016, 0.021), vec3(0.016, 0.040, 0.047), 0.5 + 0.5 * wav);
      float toSun = max(dot(normalize(rel), normalize(sunDir.xz)), 0.0);
      col = mix(col, vec3(0.70, 0.42, 0.24), pow(1.0 - max(V.y, 0.0), 16.0) * (0.04 + 0.4 * pow(toSun, 6.0)));
      vec2 sd = normalize(sunDir.xz); float along = dot(rel, sd), perp = abs(dot(rel, vec2(-sd.y, sd.x)));
      float band = exp(-pow(perp / (7.0 + 0.20 * max(along, 0.0)), 2.0)) * smoothstep(0.0, 40.0, along);                  // the sun's road on the water
      band *= 0.45 + 0.55 * smoothstep(-0.2, 0.6, sin(p.y * 0.55 + sin(p.x * 0.23) * 2.2 + time * 0.3));                         // (broken into rows, as the swell lifts it)
      vec2 g = vec2(2.6, 6.0), cell = floor(p * g + vec2(floor(p.y * g.y) * 0.41, 0.0)); float k = h(cell), tw = step(0.5, fract(h(cell + vec2(17.3, 5.1)) + time * (0.9 + 0.9 * h(cell.yx + vec2(3.7, 41.9)))));
      col += vec3(1.0, 0.80, 0.48) * step(1.0 - 0.05 * band, k) * tw * (0.6 + 2.0 * band) * smoothstep(260.0, 60.0, dist) + vec3(1.0, 0.62, 0.32) * band * 0.03;
      col += vec3(0.30, 0.45, 0.55) * step(0.998, k) * tw * 0.2;
      col = mix(col, haze * (0.12 + 0.98 * pow(toSun, 5.0)), 1.0 - exp(-pow(dist * 0.0009, 2.0)));
      gl_FragColor = vec4(col, 1.0); }` }));
sea.rotation.x = -Math.PI / 2; scene.add(sea);

// the sun on the water, far off: points of light that the lens opens into discs
{ const n = 1000, pos = new Float32Array(n * 3), sd = new Float32Array(n), G = (() => { let s = 4242; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(), sx = SUN.x / Math.hypot(SUN.x, SUN.z), sz = SUN.z / Math.hypot(SUN.x, SUN.z);
  for (let i = 0; i < n; i++) { const along = 110 + Math.pow(G(), 1.2) * 760, g = (G() + G() + G() - 1.5) * 1.1, perp = g * (10 + 0.27 * along); pos[i * 3] = -4 + sx * along - sz * perp; pos[i * 3 + 1] = 0.05; pos[i * 3 + 2] = 14 + sz * along + sx * perp; sd[i] = G(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(sd, 1));
  var glints = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { time: { value: 0 }, focus: { value: 40 }, scale: { value: 1 }, tDepth: { value: null }, res: { value: new THREE.Vector2(1, 1) }, near: { value: 2 }, far: { value: 2600 } },
    vertexShader: `attribute float seed; uniform float time, focus, scale; varying float vA; varying float vS; varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z; vD = d; gl_Position = projectionMatrix * mv;
      float r = clamp((d - focus - 9.0) * 0.022, 1.0, 6.5) * (0.55 + 0.75 * seed); gl_PointSize = r * 2.0 * scale; vS = r; float ph = fract(seed * 37.0 + time * (0.25 + 0.5 * fract(seed * 91.0))); vA = smoothstep(0.0, 0.12, ph) * smoothstep(0.55, 0.4, ph) * (0.5 + 0.7 * fract(seed * 17.0)); }`,
    fragmentShader: `varying float vA; varying float vS; varying float vD; uniform sampler2D tDepth; uniform vec2 res; uniform float near, far; void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float q = dot(p, p); if (q > 1.0) discard;
      float zz = texture2D(tDepth, gl_FragCoord.xy / res).r * 2.0 - 1.0; if (2.0 * near * far / (far + near - zz * (far - near)) < vD * 0.7 - 4.0) discard; float e = 0.75 + 0.45 * smoothstep(0.45, 1.0, q); gl_FragColor = vec4(vec3(1.0, 0.78, 0.46) * e * vA * (0.55 + 5.0 / (1.0 + vS * vS * 0.6)), 1.0); }` }));
  glints.frustumCulled = false; var glScene = new THREE.Scene(); glScene.add(glints); }
// mist, in the gap between the stacks and where the water lands
const mist = [], mistMat = (o) => new THREE.SpriteMaterial({ map: tex.soft, color: new THREE.Color(1.3, 0.85, 0.62), opacity: o, depthWrite: false, fog: false, transparent: true });
const R = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
for (let i = 0; i < 34; i++) { const s = new THREE.Sprite(mistMat(0.05 + R() * 0.05)); s.material.color.setRGB(0.80, 0.72, 1.0); s.position.set(-5 + R() * 7, 0.2 + R() * 5.5, -16 + R() * 34); const k = 9 + R() * 12; s.scale.set(k, k * 0.55, 1); s.userData = { x: s.position.x, ph: R() * 6.28, sp: 0.05 + R() * 0.08 }; mist.push(s); scene.add(s); }
const spray = []; for (const f of world.falls) for (let i = 0; i < 11; i++) {      // mist where each fall lands: it rolls out from the foot, rises and thins
  const s = new THREE.Sprite(mistMat(0.2)); s.material.color.setRGB(1.25, 1.2, 1.3); s.renderOrder = 6; scene.add(s); const a = R() * 6.2832, low = i < 8;
  spray.push({ s, o: [f.x + (R() - 0.5) * f.w * 0.8, (low ? f.y0 + 0.2 : f.y0 + (f.y1 - f.y0) * (0.15 + R() * 0.4)) , f.z + (R() - 0.5) * 0.6], dx: Math.cos(a) * 1.2 + f.nx * (low ? 1.6 : 0.5), dz: Math.sin(a) * 1.2 + f.nz * (low ? 1.6 : 0.5), up: low ? 1.0 + R() * 2.2 : -1.0, k: (low ? 0.8 : 0.5) * (0.6 + f.w * 0.3), a: low ? 0.26 : 0.14, sp: 0.16 + R() * 0.12, ph: R() }); }
for (const f of world.falls) { if (f.y0 > 0.5) continue; const s = new THREE.Mesh(new THREE.PlaneGeometry(f.w * 2.6, f.w * 2.0), new THREE.MeshBasicMaterial({ map: tex.soft, color: new THREE.Color(1.5, 1.45, 1.5), transparent: true, opacity: 0.55, depthWrite: false, fog: false })); s.rotation.x = -Math.PI / 2; s.position.set(f.x, 0.08, f.z); s.renderOrder = 2; scene.add(s); }      // foam where they meet the sea
// ---------------------------------------------------------------- the wanderer
const me = { x: START[0], z: START[1], y: 9.5, dir: 6, walked: 0, moving: false, frame: 4, speed: 0, phase: 0, run: false, hx: 0, hz: 1, sk: 0, half: 0 };
me.y = nav.top(me.x, me.z) ?? 9.5;
const heroTex = tex.hero; heroTex.repeat.set(1 / HERO.cols, 1 / HERO.views);
// he and the people of the village are flat figures that turn to face the eye; the sun lights them and shadows fall on them as on everything else
const spriteN = new THREE.BufferAttribute(new Float32Array(12), 3), SN = KEY.clone().add(new THREE.Vector3(0, 0.3, 0)).normalize();
const figure = (w, h, foot, map, lum = 0.46) => { const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2 - foot, 0); g.setAttribute('normal', spriteN); const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, color: new THREE.Color(lum, lum, lum) })); m.receiveShadow = true; m.renderOrder = 5; scene.add(m); return m; };
const FIG = 1.2, hero = figure(HERO.cw / 32 * HERO.scale, HERO.ch / 32 * HERO.scale, HERO.foot / 32 * HERO.scale, heroTex, 0.40); hero.material.emissive = new THREE.Color(0.30, 0.28, 0.27); hero.material.emissiveMap = heroTex;      // (he never sinks into the murk)
const doorGlow = []; for (const h of world.houses) { if (!h.lamp) continue; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.soft, color: new THREE.Color(1.6, 0.85, 0.3), opacity: 0.5, depthWrite: false, fog: false, transparent: true, blending: THREE.AdditiveBlending })); s.position.copy(h.lamp); s.scale.set(1.5, 1.5, 1); scene.add(s); doorGlow.push({ s, at: h.born + 2.0 }); }      // each door's lantern, glowing
const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.5, 8), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); caster.castShadow = true; scene.add(caster);
const lamp = new THREE.PointLight(new THREE.Color(1.0, 0.62, 0.25), 9, 7, 1.8); scene.add(lamp);
const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.soft, color: new THREE.Color(1.5, 0.9, 0.36), opacity: 0.6, depthWrite: false, fog: false, transparent: true, blending: THREE.AdditiveBlending })); lampGlow.scale.set(1.25, 1.25, 1); lampGlow.renderOrder = 6; scene.add(lampGlow);
// dust kicked up by his feet when he runs
const dust = Array.from({ length: 10 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.puff, color: new THREE.Color(0.86, 0.72, 0.58), transparent: true, opacity: 0, depthWrite: false, fog: true })); s.renderOrder = 4; scene.add(s); return { s, t: 9, k: 1, x: 0, y: 0, z: 0, vx: 0, vz: 0 }; }); let dustI = 0;
const puff = (k = 1, back = 0.25) => { const d = dust[dustI++ % dust.length]; d.t = 0; d.k = k; d.x = me.x - me.hx * back + (Math.random() - 0.5) * 0.2; d.y = me.y + 0.1; d.z = me.z - me.hz * back + (Math.random() - 0.5) * 0.2; d.vx = -me.hx * 0.8; d.vz = -me.hz * 0.8; };
const HV = [[2, 0], [4, 0], [1, 0], [4, 1], [2, 1], [3, 1], [0, 0], [3, 0]];      // which view he shows for each of the eight ways he can head, and whether it is turned over
const folk = world.folk.map((f, k) => { const y = nav.top(f.x, f.z); if (y === null) { console.warn('no ground for one of the folk', f.x, f.z); return null; } const t = tex.folk.clone(); t.needsUpdate = true; t.repeat.set(1 / (FOLK.n * 2), 1);
  const m = figure(FOLK.cw / 32 * FIG, FOLK.ch / 32 * FIG, FOLK.foot / 32 * FIG, t, 0.5); m.position.set(f.x, y, f.z); const c = caster.clone(); c.scale.set(0.95, 0.85, 0.95); c.position.set(f.x, y + 0.64, f.z); scene.add(c); return { m, t, c, k, i: f.i % FOLK.n, ph: k * 1.7 }; }).filter(Boolean);
const gulls = []; for (let i = 0; i < 8; i++) { const t = tex.gull.clone(); t.needsUpdate = true; t.repeat.set(0.5, 1); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, color: new THREE.Color(1.5, 1.3, 1.1), fog: true, side: THREE.DoubleSide })); m.renderOrder = 5; scene.add(m);
  gulls.push(i === 0 ? { m, t, c: [-1.2, 6.5, 5], r: 2.4, sp: 0.5, ph: 0 } : { m, t, c: [-36 + R() * 30, 8 + R() * 13, -24 + R() * 42], r: 5 + R() * 9, sp: (0.22 + R() * 0.25) * (R() < 0.5 ? -1 : 1), ph: R() * 6.28 }); }
const smoke = []; world.houses.forEach((h, i) => { if (![3, 4, 9].includes(i)) return; for (let k = 0; k < 6; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.puff, color: new THREE.Color(0.85, 0.74, 0.70), transparent: true, depthWrite: false, fog: true })); scene.add(s); smoke.push({ s, o: h.chimney, ph: k / 7 }); } });
// ---------------------------------------------------------------- sound (starts with the first key or click, since a page may not play before one)
const sound = { on: false, muted: false, noMusic: Q.has('nomusic'), ctx: null, stepAt: 0, bufs: null, loaded: false };
// The recordings are fetched and decoded while the page loads, so the first key or click has nothing heavy to do. One that is missing is simply not played: a copy of the source has none of them (MISSING_ASSETS.md).
function loadSound() {
  const AC = new (window.AudioContext || window.webkitAudioContext)(); sound.ctx = AC;
  const master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination); sound.master = master;
  const load = async (n) => { try { const r = await fetch('audio/' + n + '.ogg'); return r.ok ? await AC.decodeAudioData(await r.arrayBuffer()) : null; } catch { return null; } };
  sound.music = new Audio(); sound.music.preload = 'auto'; sound.music.src = 'audio/music.mp3'; sound.music.loop = true; sound.music.volume = 0.3;
  const names = []; // 한국어 공개판: 원본 저장소에 없는 재배포 제한 효과음은 요청하지 않습니다.
  Promise.all(names.map(load)).then((b) => { sound.bufs = Object.fromEntries(names.map((n, k) => [n, b[k]])); sound.loaded = true; if (sound.wanted) playSound(); });
}
function playSound() {
  if (sound.on) return; const AC = sound.ctx, B = sound.bufs, none = { gain: { setTargetAtTime() {} } };
  const loop = (buf, g) => { if (!buf) return none; const s = AC.createBufferSource(); s.buffer = buf; s.loop = true; const gn = AC.createGain(); gn.gain.value = g; s.connect(gn).connect(sound.master); s.start(); return gn; };
  sound.sea = loop(B.sea, 0.5); sound.fall = loop(B.fall, 0); sound.wind = loop(B.wind, 0.4); const two = (n) => [B[n + '0'], B[n + '1']].filter(Boolean); sound.steps = { ground: two('ground'), stone: two('stone'), wood: two('wood') }; sound.on = true;
}
function startSound() {
  if (sound.wanted || !sound.ctx) return; sound.wanted = true; sound.ctx.resume(); sound.music.muted = sound.muted || sound.noMusic; sound.music.play().catch(() => {}); if (sound.loaded) playSound();
}
function soundFrame() {
  if (!sound.on) return; const t = sound.ctx.currentTime, near = (a, b, x) => Math.max(0, Math.min(1, (a - x) / (a - b))); let d = 1e9; for (const f of world.falls) d = Math.min(d, Math.hypot(me.x - f.x, me.z - f.z, (me.y - (f.y0 + f.y1) / 2) * 0.5));
  sound.fall.gain.setTargetAtTime(0.75 * near(16, 3, d) ** 2, t, 0.3); sound.sea.gain.setTargetAtTime(Math.max(0.2, 0.75 - 0.03 * me.y), t, 0.5); sound.wind.gain.setTargetAtTime(0.2 + 0.03 * me.y, t, 0.5);       // (the sea is nearer low down, the wind stronger high up)
  if (me.moving && me.half !== sound.stepAt) { sound.stepAt = me.half; const set = sound.steps[nav.kind] ?? sound.steps.ground; if (!set.length) return; const s = sound.ctx.createBufferSource(), g = sound.ctx.createGain(); s.buffer = set[Math.floor(Math.random() * set.length)]; s.playbackRate.value = 0.88 + Math.random() * 0.24 + (me.run ? 0.1 : 0); g.gain.value = 0.3 + Math.random() * 0.1 + (me.run ? 0.14 : 0); s.connect(g).connect(sound.master); s.start(); }
}
const setMuted = (m) => { sound.muted = m; if (sound.master) sound.master.gain.value = m ? 0 : 0.9; if (sound.music) sound.music.muted = m || sound.noMusic; };
const hint = document.getElementById('hint'); if (Q.has('over') || Q.has('film') || Q.has('clean')) hint.remove();
// The opening: for seven seconds the village builds itself (rock out of the sea, stairs, bridges, houses, their things, the people, the lamps, and last the wanderer) while the eye comes in; then the game is his. Any key or a click skips it.
const INTRO = { on: Q.has('intro') && !Q.has('over'), t: 0, len: 7.0 };      // (not part of the game: only with ?intro, for filming it)
const sstep = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }, pop = (t0, d = 0.5) => { if (!INTRO.on) return 1; const x = Math.min(1, Math.max(0, (INTRO.t - t0) / d)) - 1; return Math.max(0.0001, 1 + 2.7 * x * x * x + 1.7 * x * x); }, since = (t0, d = 0.4) => (INTRO.on ? Math.min(1, Math.max(0, (INTRO.t - t0) / d)) : 1);
if (INTRO.on) { BUILD.value = 0; world.setIntro(true); hint.style.opacity = 0; }
const endIntro = () => { if (!INTRO.on) return; INTRO.on = false; BUILD.value = 1e3; world.setIntro(false); if (hint.isConnected) hint.style.opacity = ''; };
const skipIntro = () => { if (INTRO.on && INTRO.t > 0.4) INTRO.t = Math.max(INTRO.t, INTRO.len - 0.05); };
const keys = new Set(), held = (l) => l.some((k) => keys.has(k));
addEventListener('pointerdown', () => { startSound(); skipIntro(); });
addEventListener('keydown', (e) => { keys.add(e.code); startSound(); skipIntro(); if (e.code.startsWith('Arrow')) e.preventDefault(); if (e.code === 'KeyM' && !e.repeat) setMuted(!sound.muted); if (e.code === 'KeyN' && !e.repeat) { sound.noMusic = !sound.noMusic; setMuted(sound.muted); } }); addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear());

// ---------------------------------------------------------------- the eye
const camera = new THREE.PerspectiveCamera(28, 16 / 9, 2, 2600);
const view = { yaw: -0.2, pitch: 0.27, dist: 30, fov: 38, follow: !Q.has('over'), t: new THREE.Vector3(-1.0, 10.8, -1), lift: 1.0 }; if (Q.has('over')) view.dist = 36;
const target = new THREE.Vector3(me.x, me.y + 1, me.z);
function placeCamera(dt) {
  const want = view.follow ? new THREE.Vector3(me.x * 0.7, me.y * 0.5 + 7.2, me.z * 0.7 - 1.5) : view.t; target.lerp(want, dt === 0 ? 1 : 1 - Math.exp(-dt * 2.5));
  const ik = INTRO.on ? 1 - sstep(INTRO.t / (INTRO.len - 0.2)) : 0, yaw = view.yaw - 0.16 * ik, pitch = view.pitch + 0.1 * ik;
  me.sk += ((me.run ? 1 : 0) - me.sk) * (dt ? 1 - Math.exp(-dt * 2.6) : 0); const dist = view.dist + 1.8 * me.sk + 17 * ik;      // (when he runs the eye draws back a little and takes in a little more)
  camera.fov = view.fov + 1.6 * me.sk; camera.position.set(target.x + dist * Math.sin(yaw) * Math.cos(pitch), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(yaw) * Math.cos(pitch)); camera.lookAt(target); camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- the picture, in steps
let W = 2, H = 2, rtScene, rtA, rtB, rtRay, rtAO, rtAO2, rtLit, rtDof, rtGl;
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), post = new THREE.Scene(); post.add(quad); quad.frustumCulled = false;
const pass = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: FS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
const mBright = pass(`varying vec2 vUv; uniform sampler2D t; uniform vec2 px; void main(){ vec3 c = vec3(0.0); for (int i = 0; i < 4; i++) { vec2 o = vec2(float(i / 2) - 0.5, float(i - (i / 2) * 2) - 0.5) * px * 2.0; c += min(max(texture2D(t, vUv + o).rgb - 1.15, 0.0), vec3(2.6)); } gl_FragColor = vec4(c * 0.25, 1.0); }`, { t: { value: null }, px: { value: new THREE.Vector2() } });
const mBlur = pass(`varying vec2 vUv; uniform sampler2D t; uniform vec2 dir; void main(){ vec3 c = vec3(0.0); float w = 0.0; for (int i = -6; i <= 6; i++) { float g = exp(-float(i * i) / 18.0); c += texture2D(t, vUv + dir * float(i)).rgb * g; w += g; } gl_FragColor = vec4(c / w, 1.0); }`, { t: { value: null }, dir: { value: new THREE.Vector2() } });
const mRayMask = pass(`varying vec2 vUv; uniform sampler2D t, d; uniform mat4 invPV; uniform vec3 camPos, fwd; uniform float near, far; uniform vec2 sunUv;      // what the rays come from: the sky, and the sea that shines with it
  void main(){ float z = texture2D(d, vUv).r; vec3 c = min(texture2D(t, vUv).rgb, vec3(3.0)); vec4 f = invPV * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 dir = normalize(f.xyz / f.w - camPos);
    float zz = z * 2.0 - 1.0, dl = 2.0 * near * far / (far + near - zz * (far - near)), sd = dir.y < -0.001 ? camPos.y / -dir.y * dot(dir, fwd) : 1e9; bool sky = z > 0.99999, sea = !sky && dl > sd * 0.97;
    vec2 dv = (vUv - sunUv) * vec2(1.78, 1.0); float nearSun = exp(-dot(dv, dv) * 2.6);                         // (mostly from round the sun, so what stands before it cuts the light into beams)
    gl_FragColor = vec4((sky ? c : sea ? c * 0.5 : vec3(0.0)) * (0.15 + 1.25 * nearSun), 1.0); }`, { sunUv: { value: new THREE.Vector2() }, t: { value: null }, d: { value: null }, invPV: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, fwd: { value: new THREE.Vector3() }, near: { value: 2 }, far: { value: 1200 } });
const mRays = pass(`varying vec2 vUv; uniform sampler2D t; uniform vec2 sunUv; uniform float on; void main(){ vec3 c = vec3(0.0); float w = 1.0, tot = 0.0; for (int i = 0; i < 70; i++) { vec2 u = mix(vUv, sunUv, float(i) / 70.0 * 0.92); c += texture2D(t, clamp(u, 0.0, 1.0)).rgb * w; tot += w; w *= 0.975; } float ds = length((vUv - sunUv) * vec2(1.78, 1.0)); gl_FragColor = vec4(c / tot * on * exp(-ds * 0.9) * (0.4 + 0.6 * smoothstep(0.04, 0.32, ds)), 1.0); }`, { t: { value: null }, sunUv: { value: new THREE.Vector2() }, on: { value: 1 } });
const LIN = `float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }`;
const COC = `float coc(float z, vec2 u){ float a = z - focus, r = a > 0.0 ? clamp((a - 4.0) * 0.26, 0.0, 11.0) : clamp((-a - 3.0) * 0.8, 0.0, 15.0);      // the lens: sharp for a few metres round the wanderer, soft beyond, softer still before
    r = max(r, max(10.0 * smoothstep(0.26, 0.0, u.y) + 4.0 * smoothstep(0.82, 1.0, u.y), 7.0 * smoothstep(0.33, 0.5, abs(u.x - 0.5)))); return r * sc; }`;      // (and soft toward the edges of the picture, as with a tilted lens)
// the dark that gathers where things meet: in creases of the rock, under eaves, at the foot of walls
const mAO = pass(`varying vec2 vUv; uniform sampler2D d; uniform float near, far, tanH, aspect; uniform vec2 px; ${LIN}
  vec3 pos(vec2 u){ float z = lin(texture2D(d, u).r); return vec3((u * 2.0 - 1.0) * vec2(aspect * tanH, tanH) * z, -z); }
  void main(){ vec3 p = pos(vUv); if (-p.z > 500.0) { gl_FragColor = vec4(1.0); return; }
    vec3 x1 = pos(vUv + vec2(px.x, 0.0)), x0 = pos(vUv - vec2(px.x, 0.0)), y1 = pos(vUv + vec2(0.0, px.y)), y0 = pos(vUv - vec2(0.0, px.y));
    vec3 dx = abs(x1.z - p.z) < abs(p.z - x0.z) ? x1 - p : p - x0, dy = abs(y1.z - p.z) < abs(p.z - y0.z) ? y1 - p : p - y0, n = normalize(cross(dx, dy));
    float R = 1.3, ru = R / (-p.z * tanH) * 0.5, ang = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832, occ = 0.0;
    for (int i = 0; i < 14; i++) { float a = ang + float(i) * 2.39996, q = sqrt((float(i) + 0.5) / 14.0); vec2 o = vec2(cos(a), sin(a)) * q * ru; o.x /= aspect; vec3 s = pos(vUv + o) - p; float l = length(s);
      occ += max(dot(n, s) / (l + 1e-4) - 0.14, 0.0) * smoothstep(R * 1.8, R * 0.7, l); }
    gl_FragColor = vec4(vec3(clamp(1.0 - occ / 14.0 * 2.6, 0.0, 1.0)), 1.0); }`, { d: { value: null }, near: { value: 2 }, far: { value: 1200 }, tanH: { value: 0.3 }, aspect: { value: 1.78 }, px: { value: new THREE.Vector2() } });
const mLit = pass(`varying vec2 vUv; uniform sampler2D t, a; void main(){ float ao = texture2D(a, vUv).r; gl_FragColor = vec4(texture2D(t, vUv).rgb * mix(vec3(0.20, 0.16, 0.30), vec3(1.0), ao), 1.0); }`, { t: { value: null }, a: { value: null } });
// the lens, at half size: each place gathers what is out of focus round it; what is sharp does not spread, and what is near and soft spreads over what lies behind
const mDof = pass(`varying vec2 vUv; uniform sampler2D t, d; uniform vec2 px; uniform float near, far, focus, sc; ${LIN} ${COC}
  void main(){ float z = lin(texture2D(d, vUv).r), r = coc(z, vUv), nr = 0.0;
    for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854 + 0.3; vec2 u = vUv + vec2(cos(a), sin(a)) * (4.0 + 5.0 * float(i - (i / 2) * 2)) * sc * px; float zs = lin(texture2D(d, u).r); if (zs < z - 1.5) nr = max(nr, coc(zs, u)); }
    float re = max(r, nr * 0.8); vec3 c0 = texture2D(t, vUv).rgb, col = vec3(0.0); float tot = 0.0;
    for (int i = 0; i < 40; i++) { float a = float(i) * 2.39996, q = sqrt((float(i) + 0.5) / 40.0) * re; vec2 u = vUv + vec2(cos(a), sin(a)) * q * px; float zs = lin(texture2D(d, u).r), rs = coc(zs, u); if (zs > z) rs = max(rs, r);
      float w = smoothstep(q - 1.5 * sc, q + 0.5 * sc, rs); col += texture2D(t, u).rgb * w; tot += w; }
    gl_FragColor = vec4((col + c0 * (40.0 - tot)) / 40.0, nr * 0.8 > r ? nr * 0.8 : 0.0); }`, { t: { value: null }, d: { value: null }, px: { value: new THREE.Vector2() }, near: { value: 2 }, far: { value: 1200 }, focus: { value: 34 }, sc: { value: 1 } });
const mFinal = pass(`varying vec2 vUv; uniform sampler2D tColor, tDof, tDepth, tBloom, tRays, tGl; uniform float ek, rk; uniform vec2 px; uniform float near, far, focus, time, sc; ${LIN} ${COC}
  vec3 aces(vec3 x){ return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  void main(){
    float r = coc(lin(texture2D(tDepth, vUv).r), vUv); vec4 b = texture2D(tDof, vUv);
    vec3 col = mix(texture2D(tColor, vUv).rgb, b.rgb, smoothstep(0.5 * sc, 2.4 * sc, max(r, b.a)));
    col += texture2D(tGl, vUv).rgb + texture2D(tBloom, vUv).rgb * 0.6 + texture2D(tRays, vUv).rgb * vec3(1.0, 0.76, 0.50) * 0.66 * rk;
    col = aces(col * 0.92 * ek);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, 0.86);                    // the grade: a little colour taken out, so the light's own colour carries the picture;
    col *= mix(vec3(0.84, 0.78, 1.08), vec3(1.07, 1.0, 0.88), smoothstep(0.06, 0.6, l));                 // violet in the darks and gold in the lights;
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.85);                                               // and more snap
    vec2 v = vUv - 0.5; col *= 1.0 - 0.9 * pow(dot(v, v) * 1.9, 1.25);
    gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0); }`, { ek: { value: 1 }, rk: { value: 1 }, tGl: { value: null }, tColor: { value: null }, tDof: { value: null }, tDepth: { value: null }, tBloom: { value: null }, tRays: { value: null }, px: { value: new THREE.Vector2() }, near: { value: 2 }, far: { value: 1200 }, focus: { value: 78 }, time: { value: 0 }, sc: { value: 1 } });
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.max(2, Math.round(innerWidth * dpr)), h = Math.max(2, Math.round(innerHeight * dpr)); if (w === W && h === H) return; W = w; H = h; renderer.setSize(W, H, false); canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  for (const t of [rtScene, rtA, rtB, rtRay, rtAO, rtAO2, rtLit, rtDof]) t?.dispose();
  rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(W, H) });
  const o = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }, q = [Math.ceil(W / 4), Math.ceil(H / 4)];
  rtA = new THREE.WebGLRenderTarget(q[0], q[1], o); rtB = new THREE.WebGLRenderTarget(q[0], q[1], o); rtRay = new THREE.WebGLRenderTarget(q[0], q[1], o); camera.aspect = W / H;
  const hf = [Math.ceil(W / 2), Math.ceil(H / 2)]; rtAO = new THREE.WebGLRenderTarget(hf[0], hf[1], o); rtAO2 = new THREE.WebGLRenderTarget(hf[0], hf[1], o); rtDof = new THREE.WebGLRenderTarget(hf[0], hf[1], o); rtLit = new THREE.WebGLRenderTarget(W, H, o); rtGl?.dispose(); rtGl = new THREE.WebGLRenderTarget(W, H, o);
}
addEventListener('resize', resize); resize();
const run = (mat, to) => { quad.material = mat; renderer.setRenderTarget(to); renderer.render(post, ortho); };

// ---------------------------------------------------------------- each frame
let last = performance.now(), time = 0, frames = 0; const FILM = Q.has('film'); let fake = last;
let shown = true, said = false; const block = patchBlock({ controls: [], presets: [], triggers: [], onVisible(v) { shown = v; } });
function step(dt) {
  if (INTRO.on) { me.moving = false; return; }
  let vx = (held(['KeyD', 'ArrowRight']) ? 1 : 0) - (held(['KeyA', 'ArrowLeft']) ? 1 : 0), vn = (held(['KeyW', 'ArrowUp']) ? 1 : 0) - (held(['KeyS', 'ArrowDown']) ? 1 : 0);
  const n = Math.hypot(vx, vn), want = n > 0.01, sprint = want && held(['ShiftLeft', 'ShiftRight']);
  if (want) { vx /= n; vn /= n; const c = Math.cos(view.yaw), s = Math.sin(view.yaw); me.hx = vx * c - vn * s; me.hz = -vx * s - vn * c; me.dir = ((Math.round(Math.atan2(vn, vx) / (Math.PI / 4)) % 8) + 8) % 8; }       // (the keys go by the screen: up is into the picture)
  // he gathers speed and loses it over a few strides; with Shift he runs, a little slower on steps and bridges than on open ground
  const goal = want ? (sprint ? (nav.kind === 'ground' ? 4.7 : 3.7) : 2.15) : 0; me.speed += (goal - me.speed) * (1 - Math.exp(-dt * (goal > me.speed ? 5.5 : want ? 5 : 10))); if (!want && me.speed < 0.3) me.speed = 0;
  const ran = me.run; me.run = me.speed > (ran ? 2.7 : 3.1); me.moving = me.speed > 0.2;
  if (me.run && !ran) { puff(1.5, 0.1); puff(1.2, 0.35); } if (ran && !me.run && !want && nav.kind !== 'wood') { puff(1.6, -0.3); puff(1.2, -0.1); }      // dust as he breaks into a run, and as he pulls up
  if (!me.moving) return;
  const sp = me.speed * dt, wx = me.hx, wz = me.hz, x0 = me.x, z0 = me.z;
  const tryMove = (x, z) => { const g = nav.ground(x, z, me.y); if (g === null) return false; me.walked += Math.hypot(x - me.x, z - me.z); me.x = x; me.z = z; me.y = g; return true; };
  for (const a of [0, 0.45, -0.45, 0.9, -0.9, 1.3, -1.3, 1.5708, -1.5708]) { const ca = Math.cos(a), sa = Math.sin(a), k = sp * Math.max(ca, 0.6); if (tryMove(me.x + (wx * ca - wz * sa) * k, me.z + (wx * sa + wz * ca) * k)) break; }      // straight if it can; if not, along whatever is in the way
  const d = Math.hypot(me.x - x0, me.z - z0); if (d < sp * 0.3) me.speed = Math.min(me.speed, 1.0);                       // (brought up short against something)
  me.phase += d / (me.run ? HERO.runStride : HERO.stride); const half = Math.floor(me.phase * 2); if (half !== me.half) { me.half = half; if (me.run && nav.kind !== 'wood') puff(0.9 + Math.random() * 0.3); }      // a puff at each footfall of a run
}
function frame(now) {
  if (!shown && !FILM) { last = now; requestAnimationFrame(frame); return; } resize();
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt; if (INTRO.on) { INTRO.t += dt; BUILD.value = INTRO.t; if (INTRO.t >= INTRO.len) endIntro(); } step(dt); world.stepBridges(me, dt, time); { const g = nav.ground(me.x, me.z, me.y); if (g !== null) me.y = g; } placeCamera(frames ? dt : 0);
  me.frame = me.moving ? (me.run ? HERO.walk + HERO.idle : 0) + Math.floor((me.phase % 1) * 8) % 8 : HERO.walk + Math.floor(time / 0.8) % HERO.idle;
  for (const d of dust) { d.t += dt; const u = d.t / 0.6; if (u >= 1) { d.s.material.opacity = 0; continue; } const k = (0.3 + 0.7 * u) * d.k; d.s.position.set(d.x + d.vx * d.t * (1 - u * 0.5), d.y + 0.4 * u, d.z + d.vz * d.t * (1 - u * 0.5)); d.s.scale.set(k, k, 1); d.s.material.opacity = 0.5 * (1 - u) * Math.min(1, u * 10); }
  const [hv, flip] = HV[me.dir]; heroTex.repeat.x = (flip ? -1 : 1) / HERO.cols; heroTex.offset.set((me.frame + flip) / HERO.cols, 1 - (hv + 1) / HERO.views); hero.position.set(me.x, me.y, me.z); hero.rotation.set(0, view.yaw, 0); { const k = pop(5.9); hero.scale.setScalar(k); caster.visible = k > 0.5; world.hub.scale.setScalar(pop(3.7, 0.6)); for (const f of folk) { const q = pop(5.0 + f.k * 0.07); f.m.scale.setScalar(q); f.c.visible = q > 0.5; } for (const g of doorGlow) g.s.material.opacity = 0.5 * since(g.at, 0.35); }      // (he stands upright and turns only to face the eye, so he never leans into a wall behind him)
  { const nl = SN.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -view.yaw); for (let i = 0; i < 4; i++) spriteN.setXYZ(i, nl.x, nl.y, nl.z); spriteN.needsUpdate = true; }
  for (const f of folk) { f.t.offset.x = (f.i * 2 + (Math.floor(time / 0.9 + f.ph) % 2)) / (FOLK.n * 2); f.m.rotation.set(0, view.yaw, 0); }
  for (const g of gulls) { const a = time * g.sp + g.ph; g.m.position.set(g.c[0] + Math.cos(a) * g.r, g.c[1] + Math.sin(a * 2.3) * 0.8, g.c[2] + Math.sin(a) * g.r * 0.6); g.m.quaternion.copy(camera.quaternion); g.t.offset.x = (Math.floor(time * 3 + g.ph) % 2) * 0.5; }
  for (const p of smoke) { const u = (time * 0.09 + p.ph) % 1, k = 0.35 + u * 0.8; p.s.position.set(p.o.x + u * u * 2.6 + Math.sin(u * 9 + p.ph * 20) * 0.15, p.o.y + u * 3.6, p.o.z - u * 0.6); p.s.scale.set(k, k, 1); p.s.material.opacity = 0.34 * (1 - u) * Math.min(1, u * 8) * since(5.0, 1.0); } caster.position.set(me.x, me.y + 0.75, me.z);
  { const [lx, ly] = (me.run && me.moving ? HERO.lanternRun : HERO.lantern)[hv], k = HERO.scale / 32, o = lx * (flip ? -1 : 1) * k, c = Math.cos(view.yaw), s = Math.sin(view.yaw); lampGlow.position.set(me.x + c * o + s * 0.12, me.y + ly * k, me.z - s * o + c * 0.12); lamp.position.set(me.x + c * o + s * 0.4, me.y + ly * k, me.z - s * o + c * 0.4); lampGlow.material.opacity = (0.55 + 0.06 * Math.sin(time * 9.1)) * since(6.1, 0.3); } lamp.intensity = 9 * (1 + 0.06 * Math.sin(time * 9.1) + 0.03 * Math.sin(time * 23.7)) * since(6.1, 0.3);
  for (const f of world.anim) f(time);
  soundFrame(); if (me.walked > 3 && hint.isConnected) hint.style.opacity = 0;
  for (const s of mist) { s.position.x = s.userData.x + Math.sin(time * s.userData.sp + s.userData.ph) * 1.5; }
  for (const q of spray) { const u = (time * q.sp + q.ph) % 1, k = (1.2 + 3.2 * u) * q.k; q.s.position.set(q.o[0] + q.dx * u, q.o[1] + q.up * u, q.o[2] + q.dz * u); q.s.scale.set(k, k * 0.8, 1); q.s.material.opacity = q.a * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.8; }
  dome.position.copy(camera.position); dome.material.uniforms.time.value = time; sea.material.uniforms.time.value = time; glints.material.uniforms.time.value = time; glints.material.uniforms.scale.value = H / 1080;
  sun.target.position.set(0, 8, 0); sun.position.copy(sun.target.position).addScaledVector(KEY, 130);
  renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
  mBright.uniforms.t.value = rtScene.texture; mBright.uniforms.px.value.set(1 / W, 1 / H); run(mBright, rtA);
  for (const k of [1.0 * H / 1080, 2.4 * H / 1080]) { mBlur.uniforms.t.value = rtA.texture; mBlur.uniforms.dir.value.set(k / rtA.width, 0); run(mBlur, rtB); mBlur.uniforms.t.value = rtB.texture; mBlur.uniforms.dir.value.set(0, k / rtA.height); run(mBlur, rtA); }
  const sp = camera.position.clone().addScaledVector(SUN, 800).project(camera); mRayMask.uniforms.sunUv.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
  { const k = mRayMask.uniforms; k.t.value = rtScene.texture; k.d.value = rtScene.depthTexture; k.invPV.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse); k.camPos.value.copy(camera.position); camera.getWorldDirection(k.fwd.value); k.near.value = camera.near; k.far.value = camera.far; } run(mRayMask, rtB);
  mRays.uniforms.t.value = rtB.texture; mRays.uniforms.sunUv.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5); mRays.uniforms.on.value = sp.z < 1 ? 1 : 0; run(mRays, rtRay);
  { const k = mAO.uniforms; k.d.value = rtScene.depthTexture; k.near.value = camera.near; k.far.value = camera.far; k.tanH.value = Math.tan(camera.fov * Math.PI / 360); k.aspect.value = camera.aspect; k.px.value.set(1.5 / W, 1.5 / H); } run(mAO, rtAO);
  mBlur.uniforms.t.value = rtAO.texture; mBlur.uniforms.dir.value.set(0.5 / rtAO.width, 0); run(mBlur, rtAO2); mBlur.uniforms.t.value = rtAO2.texture; mBlur.uniforms.dir.value.set(0, 0.5 / rtAO.height); run(mBlur, rtAO);
  mLit.uniforms.t.value = rtScene.texture; mLit.uniforms.a.value = rtAO.texture; run(mLit, rtLit);
  const focus = view.follow ? new THREE.Vector3(me.x, me.y + 1, me.z).sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())) : view.dist;
  { const k = mDof.uniforms; k.t.value = rtLit.texture; k.d.value = rtScene.depthTexture; k.px.value.set(1 / W, 1 / H); k.near.value = camera.near; k.far.value = camera.far; k.focus.value = focus; k.sc.value = H / 1080; } run(mDof, rtDof);
  { const k = glints.material.uniforms; k.tDepth.value = rtScene.depthTexture; k.res.value.set(W, H); k.near.value = camera.near; k.far.value = camera.far; k.focus.value = focus; } renderer.setRenderTarget(rtGl); renderer.render(glScene, camera);
  const u = mFinal.uniforms; u.ek.value = INTRO.on ? 0.8 + 0.2 * sstep(INTRO.t / 5.6) : 1; u.rk.value = INTRO.on ? sstep((INTRO.t - 1.2) / 3.8) * (1 + 0.9 * Math.sin(Math.PI * Math.min(1, Math.max(0, (INTRO.t - 5.9) / 1.0)))) : 1; u.tGl.value = rtGl.texture; u.tColor.value = rtLit.texture; u.tDof.value = rtDof.texture; u.tDepth.value = rtScene.depthTexture; u.tBloom.value = rtA.texture; u.tRays.value = rtRay.texture; u.px.value.set(1 / W, 1 / H); u.near.value = camera.near; u.far.value = camera.far; u.time.value = time; u.sc.value = H / 1080;
  u.focus.value = focus;
  run(mFinal, null);
  frames++; if (frames === 5) { const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); } if (!said && frames >= 7 && sound.loaded) { said = true; block.ready(); window.__block = { ready: true, block }; } if (!FILM) requestAnimationFrame(frame);
}
window.__game = { me, view, keys, nav, scene, camera, renderer, world, get frames() { return frames; }, tick(ms) { fake += ms; frame(fake); }, put(x, z) { me.x = x; me.z = z; me.y = nav.top(x, z) ?? me.y; target.set(me.x * 0.7, me.y * 0.5 + 7.2, me.z * 0.7 - 1.5); } };
loadSound(); if (FILM) frame(fake); else requestAnimationFrame(frame);
