/*
 * DreamLand - extras: weather (rain, snow, thunderstorms and lightning),
 * dynamic light from held items, fireworks (with elytra boosting), a
 * grappling hook, achievements with toasts, shooting stars and auroras.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, E = DL.Entities, G = DL.GUI, I = DL.Items, A = DL.Audio, In = DL.Input, M4 = DL.M4;
  const RP = DL.Renderer.prototype, GP = DL.Game.prototype, W = DL.World.prototype;
  const X = DL.Extras = {};
  const rnd = Math.random;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ------------------------------------------------------------ */
  /* Items                                                        */
  /* ------------------------------------------------------------ */
  const ROCKET = 401, HOOK = 453;
  I._def(ROCKET, 'firework_rocket', { display: 'Firework Rocket' });
  I._def(HOOK, 'grappling_hook', { maxStack: 1, maxDamage: 300, display: 'Grappling Hook' });
  I._shapeless(['paper', 'gunpowder'], 'firework_rocket', 3);
  I._shaped(['  I', ' S#', 'S #'], { I: 'iron_ingot', S: 'stick', '#': 'string' }, 'grappling_hook');
  const ART = DL.Tex.ITEM_ART;
  ART.firework_rocket = [[
    '................',
    '..........yy....',
    '.........yWWy...',
    '........kWWWk...',
    '.......kRRRRk...',
    '......kRrRRk....',
    '.....kRRRrk.....',
    '....kRrRRk......',
    '...kRRRrk.......',
    '....kkkk........',
    '...s............',
    '..s.............',
    '.s..............'
  ], { k: [60, 20, 20], R: [210, 40, 40], r: [240, 120, 90], W: [240, 236, 220], y: [250, 210, 60], s: [120, 100, 70] }, 1];
  ART.grappling_hook = [[
    '...........k.k..',
    '..........kGkGk.',
    '...........kGGk.',
    '..........kGGGGk',
    '.........kGk.kk.',
    '........tt......',
    '.......t........',
    '......t.........',
    '.....tt.........',
    '...ttttt........',
    '..tt...tt.......',
    '..t.....t.......',
    '..tt...tt.......',
    '...ttttt........'
  ], { k: [50, 50, 56], G: [190, 192, 200], t: [150, 112, 70] }, 1];

  /* ------------------------------------------------------------ */
  /* Achievements                                                 */
  /* ------------------------------------------------------------ */
  const ACH = [
    ['inventory', 'Taking Inventory', 'Open your inventory', 340],
    ['wood', 'Getting Wood', 'Punch a tree until a log pops out', B.log],
    ['bench', 'Benchmarking', 'Craft a workbench', B.crafting_table],
    ['pickaxe', 'Time to Mine!', 'Make a pickaxe', 270],
    ['furnace', 'Hot Topic', 'Build a furnace', B.furnace],
    ['iron', 'Acquire Hardware', 'Smelt an iron ingot', 265],
    ['diamond', 'DIAMONDS!', 'Find a diamond', 264],
    ['hunter', 'Monster Hunter', 'Defeat a monster', 267],
    ['leather', 'Cow Tipper', 'Collect some leather', 334],
    ['bread', 'Bake Bread', 'Turn wheat into bread', 297],
    ['village', 'Hello, Neighbour', 'Meet a villager', 388],
    ['trade', 'What a Deal!', 'Trade with a villager', 388],
    ['tame', 'Best Friends Forever', 'Tame a wolf', 352],
    ['nether', 'We Need to Go Deeper', 'Enter the Nether', B.obsidian],
    ['end', 'The End?', 'Enter the End', 381],
    ['dragon', 'Free the End', 'Defeat the Ender Dragon', B.dragon_egg],
    ['aether', 'Into the Heavens', 'Visit the Aether', B.glowstone],
    ['glide', "Sky's the Limit", 'Glide with an elytra', 443],
    ['portal', 'Thinking with Portals', 'Go through a Portal Gun portal', 452],
    ['firework', 'Celebration!', 'Launch a firework rocket', ROCKET],
    ['grapple', 'Spider-Sense', 'Swing with a grappling hook', HOOK],
    ['storm', 'Shocking!', 'See lightning strike nearby', 385],
    ['wish', 'Make a Wish', 'Spot a shooting star', B.glowstone],
    ['aurora', 'Northern Lights', 'See an aurora in the snow', B.ice],
    ['friends', 'Better Together', 'Play with a friend on Wi-Fi', B.cake !== undefined ? B.cake : 297]
  ];
  X.ACH = ACH;
  let unlocked = {};
  try { unlocked = JSON.parse(localStorage.getItem('dreamland.ach') || '{}') || {}; } catch (e) { unlocked = {}; }
  const toasts = [];
  X.grant = function (id) {
    if (unlocked[id]) return;
    const a = ACH.find(x => x[0] === id);
    if (!a) return;
    unlocked[id] = Date.now();
    try { localStorage.setItem('dreamland.ach', JSON.stringify(unlocked)); } catch (e) { /* ignore */ }
    toasts.push({ a, t: performance.now() });
    A.play('ach', null, null, null, 0.7, 1);
    In.haptic('tick');
    const g = DL.game;
    if (g) g.chatMessage('§aAchievement get! §f' + a[1]);
  };
  X.unlocked = () => unlocked;

  /* ------------------------------------------------------------ */
  /* Weather                                                      */
  /* ------------------------------------------------------------ */
  function weatherOf(g) {
    const w = g.world;
    if (!w) return null;
    if (!w.weather) {
      const m = g.meta && g.meta.weather;
      w.weather = { rain: 0, thunder: 0, target: m ? m.target : 0, thunderT: m ? m.thunderT : 0, timer: m ? m.timer : 6000 + Math.floor(rnd() * 18000), flash: 0 };
      w.weather.rain = w.weather.target; w.weather.thunder = w.weather.thunderT;
    }
    return w.weather;
  }
  X.weather = weatherOf;
  const canRain = (w) => (w.dim || 0) === 0;
  const skySub = W.skySubtracted;
  W.skySubtracted = function (pt) {
    let v = skySub.call(this, pt);
    const wt = this.weather;
    if (wt && canRain(this)) v = Math.min(11, v + wt.rain * 3 + wt.thunder * 2.5) - (wt.flash > 0 ? 6 : 0);
    return Math.max(0, v);
  };
  X.setWeather = function (g, kind, ticks) {
    const wt = weatherOf(g);
    wt.target = kind === 'clear' ? 0 : 1;
    wt.thunderT = kind === 'thunder' ? 1 : 0;
    wt.timer = ticks || (kind === 'clear' ? 12000 + Math.floor(rnd() * 24000) : 6000 + Math.floor(rnd() * 9000));
  };
  function biomeAt(w, x, z) {
    const c = w.getChunk(x >> 4, z >> 4);
    return c && c.biomes ? c.biomes[((z & 15) << 4) | (x & 15)] : 0;
  }
  const precip = (w, x, z, y) => { const b = biomeAt(w, x, z); return b === S.BIOME.DESERT ? 0 : (b === S.BIOME.TUNDRA || y > 100) ? 2 : 1; };
  const bolts = [];
  X.strike = function (g, x, y, z, visualOnly) {
    const w = g.world, p = g.player;
    // jagged bolt with a couple of branches
    const segs = [];
    let cx = x + 0.5, cz = z + 0.5, cy = y + 90;
    while (cy > y) {
      const ny = Math.max(y, cy - 3 - rnd() * 4), nx = cx + (rnd() - 0.5) * 3, nz = cz + (rnd() - 0.5) * 3;
      segs.push([cx, cy, cz, nx, ny, nz, 1]);
      if (rnd() < 0.18) { let bx = nx, by = ny, bz = nz; for (let k = 0; k < 3; k++) { const ex = bx + (rnd() - 0.5) * 6, ey = by - 2 - rnd() * 4, ez = bz + (rnd() - 0.5) * 6; segs.push([bx, by, bz, ex, ey, ez, 0.5]); bx = ex; by = ey; bz = ez; } }
      cx = nx; cy = ny; cz = nz;
    }
    segs.push([cx, cy, cz, x + 0.5, y, z + 0.5, 1]);
    bolts.push({ segs, ttl: 7 });
    const wt = weatherOf(g); wt.flash = 3;
    g.renderer.dynFlash = [x + 0.5, y + 1, z + 0.5, 15, 6];
    const d = p ? Math.hypot(p.x - x, p.z - z) : 0;
    setTimeout(() => A.play('thunder', null, null, null, Math.max(0.15, 1.6 - d / 60), 0.8 + rnd() * 0.3), Math.min(3000, d * 25));
    if (d < 24) { X.grant('storm'); g.shake = Math.max(g.shake || 0, 4); In.haptic('explode'); }
    if (DL.Net && DL.Net.host) DL.Net.host.fx({ k: 'l', p: [x, y, z] });
    if (visualOnly) return;
    if (w.difficulty > 0 && w.getBlock(x, y, z) === 0 && S.SOLID[w.getBlock(x, y - 1, z)]) w.setBlock(x, y, z, B.fire, 0, 3);
    for (const e of w.entities.slice()) {
      if (!e.living || e.removed || e.health <= 0) continue;
      if ((e.x - x - 0.5) ** 2 + (e.z - z - 0.5) ** 2 > 9 || Math.abs(e.y - y) > 4) continue;
      if (e.type === 'pig') { e.removed = true; E.spawnMob(w, 'zombie_pigman', e.x, e.y, e.z).persistent = true; continue; }
      if (e.type === 'villager') { e.removed = true; E.spawnMob(w, 'witch', e.x, e.y, e.z).persistent = true; continue; }
      if (e.type === 'creeper') { e.charged = true; continue; }
      e.damage('lightning', 5);
      e.fire = Math.max(e.fire, 160);
    }
  };
  function weatherTick(g) {
    const w = g.world, p = g.player;
    const wt = weatherOf(g);
    if (!wt) return;
    if (wt.flash > 0) wt.flash--;
    const authority = !(DL.Net && DL.Net.client);
    if (authority && --wt.timer <= 0) {
      if (wt.target) X.setWeather(g, 'clear'); else X.setWeather(g, rnd() < 0.35 ? 'thunder' : 'rain');
    }
    const on = canRain(w);
    wt.rain += ((on ? wt.target : 0) - wt.rain) * 0.006;
    wt.thunder += ((on ? wt.thunderT * wt.target : 0) - wt.thunder) * 0.006;
    if (wt.rain < 0.002) wt.rain = 0;
    if (!on || !p || wt.rain < 0.05) return;
    const px = Math.floor(p.x), pz = Math.floor(p.z);
    const kind = precip(w, px, pz, p.y);
    const exposed = w.topSolidY(px, pz) <= Math.floor(p.y + p.eye) + 1;
    // splashes
    if (kind === 1) {
      const n = Math.floor(wt.rain * (g.settings.fancy ? 14 : 6));
      for (let i = 0; i < n; i++) {
        const x = px + Math.floor(rnd() * 21) - 10, z = pz + Math.floor(rnd() * 21) - 10;
        if (!w.isReady(x, z) || precip(w, x, z, p.y) !== 1) continue;
        const y = w.topSolidY(x, z);
        if (Math.abs(y - p.y) > 12) continue;
        g.spawnParticles('splash', x + rnd(), y + 0.1, z + rnd(), 1, 0);
      }
    }
    if (kind && g.tickCount % 32 === 0) A.play('rain', null, null, null, wt.rain * (exposed ? (kind === 2 ? 0.25 : 0.65) : 0.22), kind === 2 ? 0.6 : 1);
    // rain puts out fires and burning things under the open sky
    if (authority && kind === 1 && g.tickCount % 5 === 0) {
      for (let i = 0; i < 20; i++) {
        const x = px + Math.floor(rnd() * 48) - 24, z = pz + Math.floor(rnd() * 48) - 24;
        if (!w.isReady(x, z)) continue;
        const y = w.topSolidY(x, z);
        if (w.getBlock(x, y - 1, z) === B.fire && precip(w, x, z, y) === 1) w.setBlock(x, y - 1, z, 0, 0, 3);
        else if (w.getBlock(x, y, z) === B.fire) w.setBlock(x, y, z, 0, 0, 3);
      }
      for (const e of w.entities) if (e.fire > 0 && e.living && !e.inLava && w.topSolidY(Math.floor(e.x), Math.floor(e.z)) <= Math.floor(e.y + 1)) e.fire = 0;
    }
    // lightning
    if (authority && wt.thunder > 0.5 && rnd() < wt.thunder / 260) {
      for (let k = 0; k < 6; k++) {
        const x = px + Math.floor(rnd() * 97) - 48, z = pz + Math.floor(rnd() * 97) - 48;
        if (!w.isReady(x, z) || precip(w, x, z, p.y) === 0) continue;
        X.strike(g, x, w.topSolidY(x, z), z);
        break;
      }
    }
  }

  /* rain / snow rendering */
  let rainTex = null, snowTex = null;
  function makePrecipTextures(r) {
    const mk = (snow) => {
      const c = DL.Tex.makeCanvas(64, 256), ctx = c.getContext('2d');
      const img = ctx.createImageData(64, 256), d = img.data;
      const rr = new S.RNG(snow ? 77 : 55);
      const dot = (x, y, a) => { x = ((x % 64) + 64) % 64; y = ((y % 256) + 256) % 256; const o = (y * 64 + x) * 4; d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = Math.max(d[o + 3], a); };
      if (snow) {
        for (let i = 0; i < 140; i++) { const x = rr.nextInt(64), y = rr.nextInt(256), s = rr.nextInt(3); for (let dx = 0; dx <= s; dx++) for (let dy = 0; dy <= s; dy++) dot(x + dx, y + dy, 230); }
      } else {
        for (let i = 0; i < 110; i++) { const x = rr.nextInt(64), y = rr.nextInt(256), len = 6 + rr.nextInt(14); for (let k = 0; k < len; k++) dot(x, y + k, 80 + (k / len) * 120); }
      }
      ctx.putImageData(img, 0, 0);
      return r.texture(c, true);
    };
    rainTex = mk(false); snowTex = mk(true);
  }
  RP.renderPrecipitation = function (game, pt) {
    const w = game.world, wt = w && w.weather;
    if (!wt || wt.rain < 0.02 || !canRain(w)) return;
    if (!rainTex) makePrecipTextures(this);
    const gl = this.gl, cam = this.cam;
    const R = game.settings.fancy ? 10 : 6;
    const t = performance.now() / 1000;
    const cx = Math.floor(cam.x), cz = Math.floor(cam.z), cy = cam.y;
    M4.multiply(this.mvp, this.proj, this.view);
    for (const kind of [1, 2]) {
      this.begin();
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
        const x = cx + dx, z = cz + dz;
        if (!w.isReady(x, z)) continue;
        const ground = w.topSolidY(x, z);
        if (precip(w, x, z, ground) !== kind) continue;
        const y0 = Math.max(ground, Math.floor(cy) - R), y1 = Math.floor(cy) + R;
        if (y1 <= y0) continue;
        const dist = Math.hypot(dx, dz);
        const a = wt.rain * Math.max(0, 1 - dist / (R + 1)) * (kind === 2 ? 0.95 : 0.7);
        if (a <= 0.01) continue;
        const ax = x + 0.5 - cam.x, az = z + 0.5 - cam.z;
        const len = Math.hypot(ax, az) || 1;
        const sx = -az / len * 0.5, sz = ax / len * 0.5;
        const seed = ((x * 3121 + z * 45238971) & 0xffff) / 65536;
        const speed = kind === 2 ? 0.35 : 3.2;
        const off = t * speed + seed * 7;
        const drift = kind === 2 ? Math.sin(t * 0.8 + seed * 6) * 0.15 : 0;
        const lightB = Math.max(0.35, 1 - this.skySub / 15);
        const c = [lightB, lightB, lightB * (kind === 2 ? 1 : 1.05), a];
        const vy0 = (y0 + off * 4) / 4, vy1 = (y1 + off * 4) / 4;
        this.quadV([[ax - sx, y0 - cy, az - sz], [ax + sx, y0 - cy, az + sz], [ax + sx, y1 - cy, az + sz], [ax - sx, y1 - cy, az - sz]],
          [[seed + drift, vy0], [seed + 0.25 + drift, vy0], [seed + 0.25 + drift, vy1], [seed + drift, vy1]].map(q => [q[0], -q[1]]), c);
      }
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false); gl.disable(gl.CULL_FACE);
      this.flush('quads', { tex: kind === 2 ? snowTex : rainTex, alphaTest: 0.01, fog: true });
      gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
    }
  };
  RP.renderBolts = function () {
    if (!bolts.length) return;
    const gl = this.gl, cam = this.cam;
    M4.multiply(this.mvp, this.proj, this.view);
    this.begin();
    for (const b of bolts) {
      const a = Math.min(1, b.ttl / 4) * (b.ttl % 2 ? 1 : 0.7);
      for (const s of b.segs) {
        const th = 0.18 * s[6];
        const p0 = [s[0] - cam.x, s[1] - cam.y, s[2] - cam.z], p1 = [s[3] - cam.x, s[4] - cam.y, s[5] - cam.z];
        // camera-facing width
        const mx = (p0[0] + p1[0]) / 2, mz = (p0[2] + p1[2]) / 2, l = Math.hypot(mx, mz) || 1;
        const wx = -mz / l * th, wz = mx / l * th;
        for (const k of [1, 2.6]) {
          const col = k === 1 ? [0.95, 0.97, 1, a] : [0.55, 0.65, 1, a * 0.35];
          this.quadV([[p0[0] - wx * k, p0[1], p0[2] - wz * k], [p0[0] + wx * k, p0[1], p0[2] + wz * k], [p1[0] + wx * k, p1[1], p1[2] + wz * k], [p1[0] - wx * k, p1[1], p1[2] - wz * k]], null, col);
        }
      }
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false); gl.disable(gl.CULL_FACE);
    this.flush('quads', {});
    gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  };

  /* sky: storms darken it, lightning flashes it */
  const computeSky = RP.computeSky;
  RP.computeSky = function (world, pt, lookDir, rd) {
    computeSky.call(this, world, pt, lookDir, rd);
    const wt = world.weather;
    this.rainLevel = wt && canRain(world) ? wt.rain : 0;
    if (!wt || !canRain(world)) return;
    const r = wt.rain, th = wt.thunder;
    const gray = (c) => { const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return c.map(v => lerp(v, l * 0.75, r * 0.7) * (1 - r * 0.25 - th * 0.35)); };
    this.skyColor = gray(this.skyColor); this.fogColor = gray(this.fogColor);
    this.starBright *= 1 - r;
    if (wt.flash > 0) { const f = wt.flash / 3 * 0.7; this.skyColor = this.skyColor.map(v => lerp(v, 0.85, f)); this.fogColor = this.fogColor.map(v => lerp(v, 0.8, f)); }
  };

  /* ------------------------------------------------------------ */
  /* Night sky: shooting stars and auroras                        */
  /* ------------------------------------------------------------ */
  const meteors = [];
  const renderSky = RP.renderSky;
  RP.renderSky = function (world, pt) {
    renderSky.call(this, world, pt);
    const dim = world.dim || 0;
    if (dim !== 0 && dim !== 3) return;
    const sb = this.starBright || 0;
    const g = DL.game;
    if (sb < 0.12 || !g || !g.player) return;
    const gl = this.gl;
    M4.multiply(this.mvp, this.proj, this.view);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    const now = performance.now();
    // shooting stars
    if (rnd() < 0.0025 && meteors.length < 2) {
      const a = rnd() * Math.PI * 2, el = 0.5 + rnd() * 0.6, dir = a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.6);
      meteors.push({ a, el, dir, t0: now, dur: 700 + rnd() * 600 });
      if (sb > 0.3) X.grant('wish');
    }
    this.begin();
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i], k = (now - m.t0) / m.dur;
      if (k >= 1) { meteors.splice(i, 1); continue; }
      const pos = (q) => { const a = m.a + Math.cos(m.dir) * q * 0.9, el = m.el - Math.sin(m.dir) * 0 - q * 0.35; return [Math.cos(a) * Math.cos(el) * 95, Math.sin(el) * 95, Math.sin(a) * Math.cos(el) * 95]; };
      const head = pos(k), tail = pos(Math.max(0, k - 0.18));
      const fade = Math.sin(k * Math.PI) * sb * 1.6;
      const up = [0, 0.35, 0];
      this.quadV([[tail[0], tail[1], tail[2]], [head[0], head[1] - up[1], head[2]], [head[0], head[1] + up[1], head[2]], [tail[0], tail[1] + 0.05, tail[2]]], null, [1, 0.95, 0.85, fade]);
    }
    this.flush('quads', { mvp: this.mvp });
    // aurora over snowy lands
    const p = g.player;
    const tundra = biomeAt(world, Math.floor(p.x), Math.floor(p.z)) === S.BIOME.TUNDRA && dim === 0;
    this._aurora = lerp(this._aurora || 0, tundra && (!world.weather || world.weather.rain < 0.3) ? 1 : 0, 0.02);
    if (this._aurora > 0.02) {
      const t = now / 1000;
      this.begin();
      const N = 48;
      for (let band = 0; band < 3; band++) {
        const base = -Math.PI * 0.85 + band * 0.35, span = Math.PI * 0.9;
        for (let i = 0; i < N; i++) {
          const a0 = base + span * i / N, a1 = base + span * (i + 1) / N;
          const wv = (a) => Math.sin(a * 5 + t * 0.6 + band * 2) * 6 + Math.sin(a * 11 - t * 0.9) * 2.5;
          const r0 = 80 + wv(a0), r1 = 80 + wv(a1);
          const h0 = 22 + band * 6, h1 = h0 + 22 + Math.sin(a0 * 7 + t) * 6;
          const inten = (0.5 + 0.5 * Math.sin(a0 * 9 + t * 1.3 + band)) * this._aurora * sb * 1.4 * (band === 1 ? 1 : 0.7);
          const P = (a, r, h) => [Math.cos(a) * r, h, Math.sin(a) * r];
          const g0 = [0.15, 1, 0.55, inten * 0.55], g1 = [0.65, 0.25, 1, 0];
          this.vtx(...P(a0, r0, h0), 0, 0, ...g0); this.vtx(...P(a1, r1, h0), 0, 0, ...g0);
          this.vtx(...P(a1, r1, h1), 0, 0, ...g1); this.vtx(...P(a0, r0, h1), 0, 0, ...g1);
        }
      }
      this.flush('quads', { mvp: this.mvp });
      if (this._aurora > 0.5 && sb > 0.3) X.grant('aurora');
    }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.enable(gl.CULL_FACE);
  };

  /* ------------------------------------------------------------ */
  /* Fireworks                                                    */
  /* ------------------------------------------------------------ */
  const PALETTE = [[1, 0.2, 0.2], [1, 0.55, 0.1], [1, 0.9, 0.2], [0.4, 1, 0.3], [0.2, 0.9, 1], [0.3, 0.45, 1], [0.75, 0.35, 1], [1, 0.45, 0.8], [1, 1, 1], [1, 0.8, 0.35]];
  const SHAPES = ['ball', 'big', 'star', 'heart', 'creeper', 'ring', 'willow', 'burst', 'smiley'];
  function shapePoints(shape) {
    const pts = [];
    if (shape === 'star') {
      for (let i = 0; i < 10; i++) {
        const a0 = i / 10 * Math.PI * 2 - Math.PI / 2, a1 = (i + 1) / 10 * Math.PI * 2 - Math.PI / 2;
        const r0 = i % 2 ? 0.45 : 1, r1 = (i + 1) % 2 ? 0.45 : 1;
        for (let k = 0; k < 6; k++) { const t = k / 6; pts.push([lerp(Math.cos(a0) * r0, Math.cos(a1) * r1, t), -lerp(Math.sin(a0) * r0, Math.sin(a1) * r1, t)]); }
      }
    } else if (shape === 'heart') {
      for (let i = 0; i < 60; i++) { const t = i / 60 * Math.PI * 2; pts.push([16 * Math.sin(t) ** 3 / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]); }
    } else if (shape === 'creeper') {
      const rows = ['XX....XX', 'XX....XX', '...XX...', '..XXXX..', '..XXXX..', '..X..X..'];
      rows.forEach((r, y) => r.split('').forEach((ch, x) => { if (ch === 'X') pts.push([(x - 3.5) / 4, (2.5 - y) / 4]); }));
    } else if (shape === 'smiley') {
      for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2; pts.push([Math.cos(t), Math.sin(t)]); }
      for (let i = 0; i < 14; i++) { const t = Math.PI * (1.15 + i / 14 * 0.7); pts.push([Math.cos(t) * 0.55, Math.sin(t) * 0.55]); }
      pts.push([-0.35, 0.35], [0.35, 0.35], [-0.35, 0.42], [0.35, 0.42]);
    } else if (shape === 'ring') {
      for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2; pts.push([Math.cos(t), Math.sin(t)]); }
    }
    return pts;
  }
  function burst(g, x, y, z, shape, cols, twinkle) {
    const r = g.renderer, p = g.player;
    const add = (vx, vy, vz, col, life, size, grav, drag) => {
      const jit = 0.8 + rnd() * 0.3;
      r.addParticle({ type: 'fw', tex: 'particle', cellX: 2, cellY: 3, frame: 0, x, y, z, px: x, py: y, pz: z, vx, vy, vz, gravity: grav, drag, life, age: 0, size, r: col[0] * jit, g: col[1] * jit, b: col[2] * jit, a: 1, fullBright: true, fade: true, twinkle });
    };
    const pts = shapePoints(shape);
    if (pts.length) {
      // flat shapes face the player
      const yaw = p ? Math.atan2(p.x - x, p.z - z) : 0;
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      for (const [u, v] of pts) {
        const col = cols[Math.floor(rnd() * cols.length)];
        add(rx * u * 0.42, v * 0.42 + 0.02, rz * u * 0.42, col, 30 + Math.floor(rnd() * 10), 0.5, 0.003, 0.9);
      }
    } else {
      const n = shape === 'big' ? 160 : shape === 'willow' ? 110 : 80;
      const sp = shape === 'big' ? 0.55 : shape === 'burst' ? 0.6 : 0.36;
      for (let i = 0; i < n; i++) {
        const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        const k = shape === 'burst' ? rnd() * sp : sp * (0.85 + rnd() * 0.15);
        const col = cols[Math.floor(rnd() * cols.length)];
        if (shape === 'willow') add(s * Math.cos(th) * k, u * k + 0.1, s * Math.sin(th) * k, [1, 0.8, 0.35], 60 + Math.floor(rnd() * 20), 0.42, 0.012, 0.93);
        else add(s * Math.cos(th) * k, u * k + (shape === 'burst' ? 0.2 : 0), s * Math.sin(th) * k, col, 28 + Math.floor(rnd() * 14), 0.46, 0.004, 0.9);
      }
    }
    r.dynFlash = [x, y, z, 15, 8];
    const d = p ? Math.hypot(p.x - x, p.y - y, p.z - z) : 0;
    A.play('fwblast', x, y, z, 3, shape === 'big' ? 0.7 : 1 + (rnd() - 0.5) * 0.2);
    if (twinkle) setTimeout(() => A.play('fwtwinkle', x, y, z, 2, 1), 600);
    if (d < 6 && p && !p.creative) p.damage('fireworks', 3);
  }
  class Rocket extends E.Entity {
    constructor(world, x, y, z, boostee) {
      super(world, x, y, z);
      this.type = 'thrown'; this.kind = 'rocket'; this.icon = ROCKET; this.size = 0.45;
      this.w = this.h = 0.25;
      this.life = 22 + Math.floor(rnd() * 14);
      this.shape = SHAPES[Math.floor(rnd() * SHAPES.length)];
      const n = 1 + Math.floor(rnd() * 3);
      this.cols = []; for (let i = 0; i < n; i++) this.cols.push(PALETTE[Math.floor(rnd() * PALETTE.length)]);
      this.twinkle = rnd() < 0.4;
      this.vx = (rnd() - 0.5) * 0.02; this.vz = (rnd() - 0.5) * 0.02; this.vy = 0.05;
      this.boostee = boostee || null;
    }
    tick() {
      this.px = this.x; this.py = this.y; this.pz = this.z;
      this.age++;
      const g = DL.game;
      if (this.boostee) {
        const p = this.boostee;
        if (!p.gliding || this.age > 30) { this.removed = true; return; }
        this.x = p.x; this.y = p.y + 0.5; this.z = p.z;
        const l = p.look();
        p.vx += l[0] * 0.1 + (l[0] * 1.5 - p.vx) * 0.5 * 0.2; p.vy += l[1] * 0.1 + (l[1] * 1.5 - p.vy) * 0.5 * 0.2; p.vz += l[2] * 0.1 + (l[2] * 1.5 - p.vz) * 0.5 * 0.2;
        if (g && this.age % 1 === 0) g.renderer.addParticle({ type: 'fw', tex: 'particle', cellX: 2, cellY: 3, frame: 0, x: p.x, y: p.y + 0.3, z: p.z, px: p.x, py: p.y + 0.3, pz: p.z, vx: (rnd() - 0.5) * 0.05, vy: (rnd() - 0.5) * 0.05, vz: (rnd() - 0.5) * 0.05, gravity: 0, drag: 0.9, life: 12, age: 0, size: 0.18, r: 1, g: 0.8, b: 0.4, a: 1, fullBright: true, fade: true });
        return;
      }
      this.vx *= 1.15; this.vz *= 1.15; this.vy += 0.04; if (this.vy > 0.9) this.vy = 0.9;
      this.x += this.vx; this.y += this.vy; this.z += this.vz;
      if (g) g.renderer.addParticle({ type: 'fw', tex: 'particle', cellX: 2, cellY: 3, frame: 0, x: this.x, y: this.y - 0.3, z: this.z, px: this.x, py: this.y - 0.3, pz: this.z, vx: (rnd() - 0.5) * 0.03, vy: -0.05, vz: (rnd() - 0.5) * 0.03, gravity: 0.002, drag: 0.92, life: 10 + Math.floor(rnd() * 6), age: 0, size: 0.14, r: 1, g: 0.85, b: 0.5, a: 1, fullBright: true, fade: true });
      const b = this.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
      if (this.age >= this.life || (S.SOLID[b] && this.age > 3)) { this.removed = true; if (g) burst(g, this.x, this.y, this.z, this.shape, this.cols, this.twinkle); }
    }
  }
  X.Rocket = Rocket;
  X.launch = function (g, x, y, z) {
    const r = new Rocket(g.world, x, y, z);
    g.world.entities.push(r);
    A.play('fwlaunch', x, y, z, 1.5, 1 + (rnd() - 0.5) * 0.2);
    X.grant('firework');
    return r;
  };
  // particles that fade and twinkle
  const tickParticles = RP.tickParticles;
  RP.tickParticles = function (world) {
    tickParticles.call(this, world);
    for (const p of this.particles) {
      if (p.fade) p.a = Math.max(0, 1 - p.age / p.life) * (p.twinkle && p.age > p.life * 0.4 ? (rnd() < 0.5 ? 1 : 0.15) : 1);
    }
  };

  /* ------------------------------------------------------------ */
  /* Grappling hook                                               */
  /* ------------------------------------------------------------ */
  X.hook = null;
  function useHook(g) {
    const p = g.player, w = g.world;
    if (X.hook) { X.hook = null; A.play('grapple', null, null, null, 0.5, 0.7); return; }
    const ex = p.x, ey = p.y + p.eye, ez = p.z, d = p.look();
    const hit = E.raycast(w, ex, ey, ez, d[0], d[1], d[2], 48, false);
    let maxT = hit ? hit.t : 48, best = null;
    for (const e of w.entities) {
      if (!e.living || e === p || e.removed || e.health <= 0) continue;
      const b = e.box;
      const h = E.rayBox(ex, ey, ez, d[0], d[1], d[2], [b[0] - 0.2, b[1] - 0.2, b[2] - 0.2, b[3] + 0.2, b[4] + 0.2, b[5] + 0.2]);
      if (h && h.t < maxT) { maxT = h.t; best = e; }
    }
    p.swing();
    if (best) {
      // yank the creature over
      const dx = p.x - best.x, dz = p.z - best.z, l = Math.hypot(dx, dz) || 1;
      best.vx = (best.vx || 0) + dx / l * Math.min(1.6, l * 0.12); best.vz = (best.vz || 0) + dz / l * Math.min(1.6, l * 0.12); best.vy = (best.vy || 0) + 0.45;
      X.hook = { e: best, t: 0, x: best.x, y: best.y + best.h / 2, z: best.z };
      A.play('grapple', best.x, best.y, best.z, 1, 1.2);
    } else if (hit && !S.LIQUID[hit.id]) {
      X.hook = { x: hit.px, y: hit.py, z: hit.pz, bx: hit.x, by: hit.y, bz: hit.z, t: 0 };
      A.play('grapple', hit.px, hit.py, hit.pz, 1, 1);
      X.grant('grapple');
    } else { A.play('grapple', null, null, null, 0.4, 0.6); return; }
    In.haptic('place');
    if (!p.creative) p.damageHeld(1);
  }
  function hookTick(g) {
    const h = X.hook, p = g.player, w = g.world;
    if (!h) return;
    h.t++;
    if (!p || p.health <= 0 || !p.held || p.held.id !== HOOK || h.t > 260) { X.hook = null; return; }
    if (h.e) {
      if (h.e.removed || h.t > 12) { X.hook = null; return; }
      h.x = h.e.x; h.y = h.e.y + h.e.h / 2; h.z = h.e.z;
      return;
    }
    if (w.getBlock(h.bx, h.by, h.bz) === 0) { X.hook = null; return; }
    if (p.sneaking) { X.hook = null; return; }
    const dx = h.x - p.x, dy = h.y - (p.y + 1.0), dz = h.z - p.z;
    const d = Math.hypot(dx, dy, dz);
    p.fallDistance = 0;
    if (d < 1.4) {
      p.vx *= 0.5; p.vz *= 0.5; p.vy = Math.max(p.vy * 0.5, 0) + 0.08;
      if (g.jumpHeld) { p.vy = 0.65; X.hook = null; }
      return;
    }
    const acc = 0.16;
    p.vx += dx / d * acc; p.vy += dy / d * acc + 0.07; p.vz += dz / d * acc;
    const sp = Math.hypot(p.vx, p.vy, p.vz);
    if (sp > 1.35) { p.vx *= 1.35 / sp; p.vy *= 1.35 / sp; p.vz *= 1.35 / sp; }
  }
  RP.renderRope = function (game, pt) {
    const h = X.hook, p = game.player;
    if (!h || !p) return;
    const gl = this.gl, cam = this.cam;
    M4.multiply(this.mvp, this.proj, this.view);
    const yaw = lerp(p.pyaw, p.yaw, pt);
    // from just under and right of the eye (first person) or the hand
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const hx = lerp(p.px, p.x, pt) + c * 0.32 - s * 0.3, hy = lerp(p.py, p.y, pt) + p.eye - 0.35, hz = lerp(p.pz, p.z, pt) - s * 0.32 - c * 0.3;
    const sag = Math.max(0, 1 - h.t / 6) * 1.5;
    this.begin();
    const N = 16;
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = lerp(hx, h.x, t) - cam.x, y = lerp(hy, h.y, t) - Math.sin(t * Math.PI) * sag - cam.y, z = lerp(hz, h.z, t) - cam.z;
      if (prev) {
        const mx = (x + prev[0]) / 2, mz = (z + prev[2]) / 2, l = Math.hypot(mx, mz) || 1;
        const wx = -mz / l * 0.025, wz = mx / l * 0.025;
        this.quadV([[prev[0] - wx, prev[1], prev[2] - wz], [prev[0] + wx, prev[1], prev[2] + wz], [x + wx, y, z + wz], [x - wx, y, z - wz]], null, [0.42, 0.32, 0.2, 1]);
        this.quadV([[prev[0], prev[1] - 0.025, prev[2]], [prev[0], prev[1] + 0.025, prev[2]], [x, y + 0.025, z], [x, y - 0.025, z]], null, [0.36, 0.27, 0.17, 1]);
      }
      prev = [x, y, z];
    }
    // the hook itself
    const kx = h.x - cam.x, ky = h.y - cam.y, kz = h.z - cam.z, k = 0.12;
    this.quadV([[kx - k, ky - k, kz], [kx + k, ky - k, kz], [kx + k, ky + k, kz], [kx - k, ky + k, kz]], null, [0.75, 0.76, 0.8, 1]);
    this.quadV([[kx, ky - k, kz - k], [kx, ky - k, kz + k], [kx, ky + k, kz + k], [kx, ky + k, kz - k]], null, [0.6, 0.6, 0.66, 1]);
    gl.disable(gl.CULL_FACE);
    this.flush('quads', { fog: true });
    gl.enable(gl.CULL_FACE);
  };

  /* ------------------------------------------------------------ */
  /* Dynamic light from what you hold                             */
  /* ------------------------------------------------------------ */
  const HELD_LIGHT = {};
  for (const [id, l] of [[B.torch, 14], [B.glowstone, 15], [B.jack_o_lantern, 15], [B.sea_lantern, 15], [B.end_rod, 14], [327, 15], [348, 9], [369, 11], [377, 9], [385, 10], [440, 8], [452, 9], [B.lava, 15], [B.magma_block, 7], [B.crying_obsidian, 9], [B.fire, 15], [381, 6], [B.lit_furnace, 12], [B.golden_oak_leaves, 6], [B.ambrosium_ore, 6], [B.blaze_rod, 11]]) if (id !== undefined) HELD_LIGHT[id] = l;
  X.heldLight = (stack) => (stack && HELD_LIGHT[stack.id]) || 0;
  const drawModel = RP.drawModel;
  RP.drawModel = function (type, e, pt, model, light, opts) {
    const dw = this.dynWorld, df = this.dynWorld2;
    if (light && e && (this._handPass ? true : e.x !== undefined)) {
      let lv = light[1];
      if (this._handPass) lv = Math.max(lv, (dw && dw[3]) || 0);
      else {
        if (dw && dw[3] > 0) lv = Math.max(lv, dw[3] - Math.hypot(e.x - dw[0], e.y + 1 - dw[1], e.z - dw[2]));
        if (df && df[3] > 0) lv = Math.max(lv, df[3] - Math.hypot(e.x - df[0], e.y + 1 - df[1], e.z - df[2]) * 0.8);
      }
      if (lv > light[1]) light = [light[0], lv];
    }
    if (e && e.charged && !(opts && opts.tint) && !(e.hurtTime > 0)) {
      opts = Object.assign({}, opts || {}, { tint: [0.45, 0.7, 1, 0.22 + 0.12 * Math.sin(performance.now() / 120)] });
    }
    return drawModel.call(this, type, e, pt, model, light, opts);
  };
  for (const fn of ['drawItemMesh', 'drawBlockMesh']) {
    const orig = RP[fn];
    RP[fn] = function () {
      const args = Array.from(arguments);
      const li = fn === 'drawItemMesh' ? 2 : 3;
      const dw = this.dynWorld;
      if (this._handPass && dw && dw[3] > 0 && args[li]) args[li] = [args[li][0], Math.max(args[li][1], dw[3])];
      return orig.apply(this, args);
    };
  }
  const renderHand = RP.renderHand;
  RP.renderHand = function (game, pt) {
    this._handPass = true;
    try { return renderHand.call(this, game, pt); } finally { this._handPass = false; }
  };

  /* ------------------------------------------------------------ */
  /* Hooks into the game                                          */
  /* ------------------------------------------------------------ */
  const render = GP.render;
  GP.render = function (pt, now, dt) {
    const r = this.renderer, p = this.player;
    if (r && p && this.world) {
      const lv = Math.max(X.heldLight(p.held), p.fire > 0 ? 12 : 0);
      r.dynWorld = lv ? [lerp(p.px, p.x, pt), lerp(p.py, p.y, pt) + 1.2, lerp(p.pz, p.z, pt), lv] : null;
      const f = r.dynFlash;
      if (f && f[4] > 0) r.dynWorld2 = [f[0], f[1], f[2], f[3] * Math.min(1, f[4] / 4)]; else r.dynWorld2 = null;
    } else if (r) { r.dynWorld = r.dynWorld2 = null; }
    return render.call(this, pt, now, dt);
  };
  const renderBillboards = RP.renderBillboards;
  RP.renderBillboards = function (world, pt) {
    const out = renderBillboards.apply(this, arguments);
    const g = DL.game;
    if (g && g.world === world) {
      try { this.renderRope(g, pt); } catch (e) { console.warn('rope', e); }
      try { this.renderPrecipitation(g, pt); } catch (e) { console.warn('rain', e); }
      try { this.renderBolts(); } catch (e) { console.warn('bolts', e); }
    }
    return out;
  };

  const tick = GP.tick;
  GP.tick = function () {
    tick.call(this);
    if (!this.inGame || !this.world || !this.player) return;
    if (G.screen && G.screen.pauses && !(DL.Net && DL.Net.active())) return;
    const r = this.renderer;
    if (r.dynFlash && r.dynFlash[4] > 0) r.dynFlash[4]--;
    for (let i = bolts.length - 1; i >= 0; i--) if (--bolts[i].ttl <= 0) bolts.splice(i, 1);
    weatherTick(this);
    hookTick(this);
    if (this.tickCount % 10 === 0) achTick(this);
  };

  // use: rockets and the hook
  const useItem = GP.useItem;
  GP.useItem = function () {
    const p = this.player, held = p && p.held;
    if (held && held.id === ROCKET) {
      if (!this.usePressed && !this._pgUseEdge) return;
      if (p.gliding) {
        this.world.entities.push(new Rocket(this.world, p.x, p.y, p.z, p));
        A.play('fwlaunch', null, null, null, 1, 1.2);
      } else {
        const t = this.target;
        let x, y, z;
        if (t && !t.entity) { const d = S.FACE_DIR[t.face]; x = t.x + 0.5 + d[0] * 0.6; y = t.y + 0.5 + d[1] * 0.6; z = t.z + 0.5 + d[2] * 0.6; }
        else { const l = p.look(); x = p.x + l[0] * 1.5; y = p.y + p.eye + l[1] * 1.5; z = p.z + l[2] * 1.5; }
        X.launch(this, x, y, z);
      }
      if (!p.creative) p.consumeHeld(1);
      p.swing();
      return;
    }
    if (held && held.id === HOOK) {
      if (!this.usePressed && !this._pgUseEdge) return;
      useHook(this);
      return;
    }
    return useItem.call(this);
  };
  const command = GP.command;
  GP.command = function (line) {
    const args = line.split(/\s+/), cmd = args[0].toLowerCase();
    if (cmd === 'weather' && !(DL.Net && DL.Net.client)) {
      const k = (args[1] || '').toLowerCase();
      if (!['clear', 'rain', 'thunder'].includes(k)) { this.chatMessage('§cUsage: /weather <clear|rain|thunder>'); return; }
      X.setWeather(this, k, args[2] ? Math.max(20, parseInt(args[2], 10) * 20 || 0) : undefined);
      this.chatMessage('Weather set to ' + k);
      return;
    }
    if (cmd === 'fireworks') { const p = this.player; for (let i = 0; i < 8; i++) setTimeout(() => { if (this.world) X.launch(this, p.x + (rnd() - 0.5) * 16, p.y + 1, p.z + (rnd() - 0.5) * 16); }, i * 350); return; }
    if (cmd === 'help') { command.call(this, line); this.chatMessage('§e/weather <clear|rain|thunder>, /fireworks'); return; }
    return command.call(this, line);
  };
  const saveWorld = GP.saveWorld;
  GP.saveWorld = function () {
    const w = this.world;
    if (w && w.weather && this.meta && !w.remote) this.meta.weather = { target: w.weather.target, thunderT: w.weather.thunderT, timer: w.weather.timer };
    return saveWorld.apply(this, arguments);
  };
  const hookWorld = GP.hookWorld;
  GP.hookWorld = function (world) { hookWorld.call(this, world); X.hook = null; };
  // charged creepers blow up much bigger
  const explode = W.explode;
  W.explode = function (x, y, z, power, src) {
    if (src && src.charged && src.type === 'creeper') power *= 2;
    return explode.call(this, x, y, z, power, src);
  };
  // inventory opened, villagers met, trades and taming announced through chat
  const openInventory = GP.openInventory;
  GP.openInventory = function () { X.grant('inventory'); return openInventory.apply(this, arguments); };
  const chatMessage = GP.chatMessage;
  GP.chatMessage = function (text) {
    if (typeof text === 'string') {
      if (text.startsWith('§aTraded')) X.grant('trade');
      if (text === 'Wolf tamed!') X.grant('tame');
    }
    return chatMessage.apply(this, arguments);
  };
  const onDeath = E.Mob.prototype.onDeath;
  E.Mob.prototype.onDeath = function (src, killer) {
    if (killer && DL.game && killer === DL.game.player && this.hostile) X.grant('hunter');
    return onDeath.apply(this, arguments);
  };
  function achTick(g) {
    const p = g.player, w = g.world;
    const has = (id) => p.inv.some(s => s && s.id === id) || (p.cursor && p.cursor.id === id);
    if (has(B.log) || has(B.skyroot_log) || has(B.dark_log)) X.grant('wood');
    if (has(B.crafting_table)) X.grant('bench');
    if ([270, 274, 257, 285, 278, 460, 465].some(has)) X.grant('pickaxe');
    if (has(B.furnace)) X.grant('furnace');
    if (has(265)) X.grant('iron');
    if (has(264)) X.grant('diamond');
    if (has(334)) X.grant('leather');
    if (has(297)) X.grant('bread');
    const dim = w.dim || 0;
    if (dim === 1) X.grant('nether'); else if (dim === 2) X.grant('end'); else if (dim === 3) X.grant('aether');
    if (g.meta && g.meta.dragonKilled) X.grant('dragon');
    if (p.gliding) X.grant('glide');
    if (p._pgCool > 0) X.grant('portal');
    if (DL.Net && ((DL.Net.host && DL.Net.host.conns.size) || DL.Net.client)) X.grant('friends');
    if (g.tickCount % 40 === 0) for (const e of w.entities) if (e.type === 'villager' && Math.abs(e.x - p.x) < 8 && Math.abs(e.z - p.z) < 8) { X.grant('village'); break; }
  }

  /* ------------------------------------------------------------ */
  /* HUD: toasts; pause menu: achievements screen                 */
  /* ------------------------------------------------------------ */
  const extras = G.drawHUDExtras;
  G.drawHUDExtras = function (game, Wd, H, hy) {
    const res = extras.call(this, game, Wd, H, hy);
    const now = performance.now();
    while (toasts.length && now - toasts[0].t > 5200) toasts.shift();
    if (toasts.length) {
      const t = toasts[0], k = (now - t.t) / 1000;
      const slide = k < 0.4 ? 1 - k / 0.4 : k > 4.6 ? (k - 4.6) / 0.6 : 0;
      const w = 160, h = 32, x = Wd - w - 4 - (G.safe ? G.safe.r : 0) + slide * (w + 8), y = 4 + (G.safe ? G.safe.t : 0);
      G.rect(x, y, w, h, '#101016'); G.rect(x + 1, y + 1, w - 2, h - 2, '#2a2a36'); G.rect(x + 2, y + 2, w - 4, h - 4, '#16161e');
      G.drawItem({ id: t.a[3], count: 1 }, x + 8, y + 8, true);
      G.text('Achievement get!', x + 30, y + 7, '#FFFF55');
      G.text(t.a[1], x + 30, y + 18, '#FFFFFF');
    }
    return res;
  };
  class AchScreen extends G.Screen {
    get pauses() { return true; }
    layout() {
      this.widgets = [];
      this.btn('Done', G.W / 2 - 100, G.H - 28, 200, 20, () => this.back());
      if (DL.Input.lastDevice === 'gamepad') this.focus = 0;
    }
    draw(mx, my) {
      G.dim();
      const cols = Math.max(1, Math.min(5, Math.floor((G.W - 20) / 112)));
      const done = ACH.filter(a => unlocked[a[0]]).length;
      G.textC('Achievements (' + done + '/' + ACH.length + ')', G.W / 2, 8, '#FFFFFF');
      const cw = 110, ch = 22, x0 = Math.floor((G.W - cols * cw) / 2), y0 = 22;
      let hover = null;
      ACH.forEach((a, i) => {
        const x = x0 + (i % cols) * cw, y = y0 + Math.floor(i / cols) * (ch + 2);
        if (y + ch > G.H - 32) return;
        const got = !!unlocked[a[0]];
        G.rect(x, y, cw - 4, ch, got ? '#2d4a2d' : '#262626');
        G.rect(x + 1, y + 1, cw - 6, ch - 2, got ? '#3c6a3c' : '#333333');
        if (got) G.drawItem({ id: a[3], count: 1 }, x + 3, y + 3, true);
        else G.text('?', x + 8, y + 7, '#777777');
        G.text(got ? a[1] : '???', x + 22, y + 7, got ? '#FFFFFF' : '#888888');
        if (mx >= x && my >= y && mx < x + cw - 4 && my < y + ch) hover = a;
      });
      if (hover) G.textC(unlocked[hover[0]] ? hover[2] : 'Keep exploring...', G.W / 2, G.H - 42, '#FFFF99');
      this.drawWidgets(mx, my);
    }
  }
  X.AchScreen = AchScreen;
  const pLayout = G.PauseScreen.prototype.layout;
  G.PauseScreen.prototype.layout = function () {
    pLayout.call(this);
    const cx = G.W / 2, y = G.H / 4 + 8;
    const quit = this.widgets.find(w => w.label === 'Save and quit to title' || w.label === 'Disconnect');
    if (quit) quit.y = y + 132;
    this.btn('Achievements (' + ACH.filter(a => unlocked[a[0]]).length + '/' + ACH.length + ')', cx - 100, y + 104, 200, 20, () => this.game.setScreen(new AchScreen(this.game, this)));
  };

  /* lightning seen by Wi-Fi guests */
  X.remoteBolt = function (x, y, z) { const g = DL.game; if (g && g.world) X.strike(g, x, y, z, true); };
})();
