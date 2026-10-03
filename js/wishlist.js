/*
 * DreamLand - the "Mob Vote Revenge & Wishlist" update: the mob-vote losers
 * Mojang never added (glare, moobloom, penguin, crab, iceologer) and fireflies,
 * rideable horses with craftable saddles, chairs (sit on stairs), a minimap
 * with coordinates, inventory sorting, death coordinates and falling leaves.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, E = DL.Entities, I = DL.Items, M = DL.Models, G = DL.GUI, A = DL.Audio, In = DL.Input;
  const GP = DL.Game.prototype, RP = DL.Renderer.prototype;
  const MOBS = E.MOBS, D = M.defs, hex = M.hex, Skin = M.Skin, BI = S.BIOME;
  const rnd = Math.random, CH = S.CH;
  const isGuest = () => !!(DL.Net && DL.Net.client);

  /* ------------------------------------------------------------ */
  /* Items                                                        */
  /* ------------------------------------------------------------ */
  const CRAB_CLAW = 302;
  I._def(CRAB_CLAW, 'crab_claw', { display: 'Crab Claw', maxStack: 16, tab: 'tools' });
  DL.Tex.ITEM_ART.crab_claw = [[
    '................', '.....oo.........', '....oRRo........', '...oRrRRo.......', '...oRRRRo..oo...', '....oRRRRooRRo..',
    '.....oRRRRRRrRo.', '......oRRRRRRo..', '.......oRRRRo...', '......oRRRoo....', '.....oRRo.......', '....oRRo........',
    '...oRRo.........', '..oRRo..........', '..ooo...........', '................'
  ], { o: [90, 30, 10], R: [226, 108, 40], r: [255, 176, 96] }, 0];
  // the crab claw anywhere in your hotbar lets you reach 3 blocks further
  GP.reachBonus = function () { const p = this.player; if (!p) return 0; for (let i = 0; i < 9; i++) if (p.inv[i] && p.inv[i].id === CRAB_CLAW) return 3; return 0; };
  // things Mojang should have let us craft
  I._shaped(['LLL', 'LIL'], { L: 'leather', I: 'iron_ingot' }, 'saddle');
  if (I.byName.saddle) I.byName.saddle.tab = 'tools';

  /* ------------------------------------------------------------ */
  /* Models                                                       */
  /* ------------------------------------------------------------ */
  const P = (pivot, boxes, extra) => Object.assign({ pivot, boxes }, extra || {});
  D.penguin = { anim: 'penguin', shadow: 0.35, parts: {
    body: P([0, 24, 0], [[-3, -11, -2.5, 6, 10, 5]]),
    head: P([0, 24, 0], [[-2.5, -15, -2.5, 5, 4, 5], [-1, -13, -4.5, 2, 1, 2]]),
    lwing: P([-3, 13, 0], [[-1, 0, -1.5, 1, 7, 3]]),
    rwing: P([3, 13, 0], [[0, 0, -1.5, 1, 7, 3]]),
    lfoot: P([-1.5, 23, 0], [[-1, 0, -3, 2, 1, 3]]),
    rfoot: P([1.5, 23, 0], [[-1, 0, -3, 2, 1, 3]])
  } };
  // crabs face sideways, so walking "forward" scuttles to the side
  D.crab = { anim: 'crab', shadow: 0.4, parts: {
    body: P([0, 24, 0], [[-3, -6, -4.5, 6, 3, 9]]),
    eyes: P([0, 24, 0], [[-3.5, -8, -2, 1, 2, 1], [-3.5, -8, 1, 1, 2, 1]]),
    bigclaw: P([-3, 20, -3], [[-4, -1.5, -1.5, 4, 3, 3], [-5, -2.5, -1, 1, 2, 2]]),
    smallclaw: P([-3, 20, 3], [[-3, -1, -1, 3, 2, 2]]),
    llegs: P([0, 21, 4.5], [[-2, 0, 0, 1, 3, 1], [0, 0, 0.5, 1, 3, 1], [2, 0, 0, 1, 3, 1]]),
    rlegs: P([0, 21, -4.5], [[-2, 0, -1, 1, 3, 1], [0, 0, -1.5, 1, 3, 1], [2, 0, -1, 1, 3, 1]])
  } };
  D.glare = { anim: 'glare', shadow: 0.4, noCull: true, parts: {
    body: P([0, 16, 0], [[-4, -8, -4, 8, 8, 8]]),
    moss: P([0, 16, 0], [[-4, 0, -4, 8, 3, 8]]),
    bud: P([0, 16, 0], [[-2, -10, -2, 4, 2, 4]])
  } };
  const cow = D.cow.parts;
  D.moobloom = { anim: 'quad', shadow: 0.7, parts: Object.assign(JSON.parse(JSON.stringify(cow)), {
    flowers: P([0, 0, 0], [[-4, -1, -6, 2, 3, 2], [1, -1, -2, 2, 3, 2], [-2, -1, 3, 2, 3, 2], [3, -1, 6, 2, 3, 2]], { follow: 'body' }),
    hflower: P([0, 4, -8], [[-1, -7, -4, 2, 3, 2]], { follow: 'head' })
  }) };
  // proportions and angles of Minecraft's horse
  const horseParts = (saddle) => {
    const p = {
      body: P([0, 11, 5], [[-5, -8, -17, 10, 10, 22, 0.05]]),
      head: P([0, 4, -12], [
        [-2.05, -6, -2, 4, 12, 7],   // neck
        [-3, -11, -2, 6, 5, 7],      // head
        [-2, -11, -7, 4, 5, 5],      // muzzle
        [0.55, -13, 4, 2, 3, 1],     // ears
        [-2.55, -13, 4, 2, 3, 1]
      ]),
      mane: P([0, 4, -12], [[-1, -11, 5.01, 2, 16, 2]]),
      tail: P([0, 4, 11], [[-1.5, 0, 0, 3, 14, 4]]),
      leg1: P([4, 14, 7], [[-3, -1.01, -1, 4, 11, 4]]), leg2: P([-4, 14, 7], [[-1, -1.01, -1, 4, 11, 4]]),
      leg3: P([4, 14, -10], [[-3, -1.01, -1.9, 4, 11, 4]]), leg4: P([-4, 14, -10], [[-1, -1.01, -1.9, 4, 11, 4]])
    };
    if (saddle) p.saddle = P([0, 11, 5], [
      [-5.2, -9, -10, 10.4, 1.2, 9],                       // seat
      [-1.5, -10, -10, 3, 1, 2], [-1.5, -10, -2.5, 3, 1, 1.5], // pommel and cantle
      [5.15, -8, -6, 0.4, 6, 1], [-5.55, -8, -6, 0.4, 6, 1],   // straps
      [5.0, -2.2, -6.5, 1, 1, 2], [-6.0, -2.2, -6.5, 1, 1, 2]  // stirrups
    ], { follow: 'body' });
    return p;
  };
  D.horse = { anim: 'horse', shadow: 0.9, parts: horseParts(false) };
  D.horse_saddled = { anim: 'horse', shadow: 0.9, parts: horseParts(true) };
  M.newModels.push('penguin', 'crab', 'glare', 'moobloom', 'horse', 'horse_saddled');

  /* animations */
  const AN = M.anims;
  AN.penguin = ({ e, o, q, limb, amt, headYaw, headPitch, age }) => {
    const roll = Math.sin(limb * 0.6662) * 0.2 * amt;
    const slide = e.sliding ? -1.35 : 0;
    o.body = [slide, 0, roll]; o.head = [slide + headPitch * 0.3, headYaw * 0.6, roll];
    const flap = e.inWater ? Math.sin(age * 0.6) * 0.8 : 0.15 + Math.abs(roll);
    o.lwing = [slide, 0, flap]; o.rwing = [slide, 0, -flap];
    o.lfoot = [q(0) * 0.5 + slide, 0, 0]; o.rfoot = [q(Math.PI) * 0.5 + slide, 0, 0];
    return o;
  };
  AN.crab = ({ e, o, limb, amt, age }) => {
    const w = Math.sin(limb * 1.6) * 0.5 * amt;
    o.body = [0, 0, 0, 0, Math.abs(Math.sin(limb * 1.6)) * 0.4 * amt, 0]; o.eyes = o.body;
    o.llegs = [w, 0, 0]; o.rlegs = [-w, 0, 0];
    const snap = e.attackTime > 10 ? 0.6 : Math.max(0, Math.sin(age * 0.15)) * 0.15;
    o.bigclaw = [0, snap, 0.1]; o.smallclaw = [0, -snap * 0.6, 0.1];
    return o;
  };
  AN.glare = ({ e, o, age, headYaw }) => {
    const bob = Math.sin(age * 0.08) * 1.2, sway = Math.sin(age * 0.05) * 0.05;
    o.body = [sway, headYaw * 0.4, 0, 0, bob, 0]; o.moss = [sway, headYaw * 0.4, Math.sin(age * 0.2) * 0.04, 0, bob, 0]; o.bud = o.body;
    void e;
    return o;
  };
  AN.horse = ({ e, o, headYaw, headPitch, age, amt, limb }) => {
    o.body = [0, 0, 0];
    const graze = !e.rider && e.grazing > 0 ? Math.min(1, e.grazing / 10) * 1.6 : 0;
    o.head = [0.5236 + graze + headPitch * 0.4 - amt * 0.15, headYaw * 0.6, 0]; o.mane = o.head;
    o.tail = [0.5236 + amt * 0.4 + Math.sin(age * 0.07) * 0.06, Math.sin(age * 0.04) * 0.12, 0];
    const g = e.rider ? 1.3 : 1, sw = (a) => Math.cos(limb * 0.6662 + a) * 1.4 * amt * g;
    o.leg1 = [sw(Math.PI), 0, 0]; o.leg2 = [sw(0), 0, 0]; o.leg3 = [sw(0), 0, 0]; o.leg4 = [sw(Math.PI), 0, 0];
    return o;
  };
  // sitting on horses and chairs: legs forward
  const pose = M.pose;
  M.pose = function (name, e, pt) {
    const o = pose.call(this, name, e, pt);
    if ((name === 'player' || name === 'armor1' || name === 'armor2') && e && (e.vehicle || e.sitting || e.seated)) { o.rleg = [-1.4, 0.3, 0]; o.lleg = [-1.4, -0.3, 0]; }
    return o;
  };

  /* skins */
  const SP = M.skinPainters;
  function paint(model, seed, colors, extra) {
    const s = new Skin(model, seed), mdl = D[model];
    for (const pn in mdl.parts) mdl.parts[pn].boxes.forEach((b, bi) => {
      const c = colors[pn + ':' + bi] !== undefined ? colors[pn + ':' + bi] : colors[pn] !== undefined ? colors[pn] : colors._;
      if (!c) { s.fill(pn, bi, 'all', () => [0, 0, 0, 0]); return; }
      const base = hex(Array.isArray(c) ? c[0] : c), v = Array.isArray(c) && c[1] !== undefined ? c[1] : 0.08;
      for (const f of ['bottom', 'top', 'front', 'back', 'left', 'right']) {
        const k = f === 'top' ? 1.08 : f === 'bottom' ? 0.82 : 1;
        s.fill(pn, bi, f, () => { const j = 1 + (s.r.next() - 0.5) * 2 * v; return [Math.min(255, base[0] * k * j), Math.min(255, base[1] * k * j), Math.min(255, base[2] * k * j)]; });
      }
    });
    if (extra) extra(s);
    return s.done();
  }
  SP.penguin = () => paint('penguin', 71, { _: ['#1c1e26', 0.06], 'head:1': '#f2a020', lfoot: '#f2a020', rfoot: '#f2a020' }, (s) => {
    s.fill('body', 0, 'front', (x, y, w, h) => (x > 0 && x < w - 1 && y > 0) ? [240, 240, 236] : [28, 30, 38]);
    s.art('head', 0, 'front', ['.....', '.W.W.', '.K.K.', '.....'], { W: hex('#f4f4f0'), K: hex('#111111') });
  });
  SP.crab = () => paint('crab', 72, { _: ['#2f6e8e', 0.08], bigclaw: ['#e2742d', 0.06], smallclaw: ['#e2742d', 0.06], eyes: '#e8e0c8', llegs: '#d0602a', rlegs: '#d0602a' }, (s) => {
    s.fill('eyes', 0, 'top', () => [16, 16, 16]); s.fill('eyes', 1, 'top', () => [16, 16, 16]);
    s.fill('body', 0, 'top', (x, y) => ((x + y) % 5 === 0 ? [70, 140, 170] : [47, 110, 142]));
  });
  const glareSkin = (grumpy) => () => paint('glare', 73, { body: ['#4e7a2a', 0.18], moss: ['#3e6a24', 0.12], bud: ['#d86ec0', 0.1] }, (s) => {
    s.fill('moss', 0, 'all', (x, y) => (y + (x * 7 % 3) > 1 && ((x * 5 + y) % 3) ? [0, 0, 0, 0] : [62, 104, 36]));
    s.art('body', 0, 'front', grumpy
      ? ['........', '.R....R.', '..R..R..', '.RR..RR.', '.KK..KK.', '........', '..KKKK..', '.K....K.']
      : ['........', '........', '........', '.WK..KW.', '.KK..KK.', '........', '...KK...', '........'],
    { W: hex('#ffffff'), K: hex('#141414'), R: hex('#c02020') });
  });
  SP.glare = glareSkin(false);
  SP.glare_grumpy = glareSkin(true);
  SP.moobloom = () => paint('moobloom', 74, { _: ['#f2c735', 0.06], flowers: ['#ffe14a', 0.1], hflower: ['#ffe14a', 0.1], 'head:1': '#e8e0c8', 'head:2': '#e8e0c8', 'body:1': '#f0a0a0' }, (s) => {
    const n = new S.Perlin(new S.RNG(55));
    s.fill('body', 0, 'all', (x, y, w, h, f) => n.noise(x / 4, y / 4, f || 0) > 0.15 ? [250, 246, 232] : [242, 199, 53]);
    s.art('head', 0, 'front', ['........', '........', '.WK..KW.', '........', '..pppp..', '..pKKp..'], { W: hex('#ffffff'), K: hex('#141414'), p: hex('#f0b8a0') });
    for (const pn of ['flowers', 'hflower']) D.moobloom.parts[pn].boxes.forEach((b, bi) => s.fill(pn, bi, 'top', () => [120, 80, 20]));
  });
  // white, creamy, chestnut, brown, black, gray and dark brown coats, with markings
  const COATS = [['#e8e4dc', '#c8c0b0'], ['#d8b880', '#f2ead8'], ['#9a5426', '#3a2216'], ['#6e4628', '#241812'], ['#262222', '#121010'], ['#8a8682', '#4a4644'], ['#4a3020', '#1a120c']];
  const coatPaint = (model, i) => () => {
    const [c, hair] = COATS[i], base = hex(c), hr = hex(hair);
    const n = new S.Perlin(new S.RNG(90 + i));
    const shade = (k, j) => [Math.min(255, base[0] * k * j), Math.min(255, base[1] * k * j), Math.min(255, base[2] * k * j)];
    return paint(model, 80 + i, { _: [c, 0.05], mane: [hair, 0.12], tail: [hair, 0.14], saddle: ['#6a3c1c', 0.06], 'saddle:5': '#a8a8b0', 'saddle:6': '#a8a8b0', 'saddle:3': '#3a2414', 'saddle:4': '#3a2414' }, (s) => {
      // soft dapples on the coat
      for (const f of ['top', 'left', 'right', 'back', 'front']) s.fill('body', 0, f, (x, y) => { const v = n.noise(x / 3, y / 3, f.length); return shade(1 + v * 0.12, 1 + (s.r.next() - 0.5) * 0.06); });
      // dark hooves and a lighter muzzle with nostrils
      for (const leg of ['leg1', 'leg2', 'leg3', 'leg4']) s.fill(leg, 0, 'front,back,left,right,bottom', (x, y, w, h) => y >= h - 2 ? [52, 42, 36] : y >= h - 4 && i === 1 ? [240, 234, 220] : null);
      s.fill('head', 2, 'all', () => shade(0.82, 1));
      s.art('head', 2, 'front', ['....', '.K.K', '....'], { K: hex('#1a1210') });
      // eyes on the sides of the head, a white blaze on some coats
      s.art('head', 1, 'left', ['.......', '...WK..'], { W: hex('#f4f4f0'), K: hex('#101010') });
      s.art('head', 1, 'right', ['.......', '..KW...'], { W: hex('#f4f4f0'), K: hex('#101010') });
      if (i === 2 || i === 4 || i === 6) { s.art('head', 1, 'top', ['..W..', '..W..', '.WW..', '..W..', '..W..', '..WW.', '..W..'], { W: hex('#f0ece4') }); s.art('head', 2, 'top', ['.WW.', '.WW.', '.W..', '.W..', '.WW.'], { W: hex('#f0ece4') }); }
      s.fill('head', 3, 'all', () => shade(0.9, 1)); s.fill('head', 4, 'all', () => shade(0.9, 1));
    });
  };
  for (const sad of [false, true]) COATS.forEach((c, i) => { const model = sad ? 'horse_saddled' : 'horse'; SP[model + '_' + i] = coatPaint(model, i); });
  SP.iceologer = () => {
    const s = new Skin('pillager', 75), mdl = D.pillager;
    const col = { head: '#9aa4b0', body: '#7fb3e0', rarm: '#7fb3e0', larm: '#7fb3e0', rleg: '#5a7fa8', lleg: '#5a7fa8' };
    for (const pn in mdl.parts) mdl.parts[pn].boxes.forEach((b, bi) => {
      const base = hex(pn === 'head' && bi === 1 ? '#8a94a0' : col[pn] || '#7fb3e0');
      s.fill(pn, bi, 'all', (x, y) => { const j = 1 + (s.r.next() - 0.5) * 0.16; const trim = pn !== 'head' && (y === 0 || x === 0) ? 1.3 : 1; return [Math.min(255, base[0] * j * trim), Math.min(255, base[1] * j * trim), Math.min(255, base[2] * j * trim)]; });
    });
    s.art('head', 0, 'front', ['........', 'WWWWWWWW', '.BB..BB.', '.cK..Kc.', '........', '...dd...', '..dddd..'], { W: hex('#e8f4ff'), B: hex('#3a3a44'), c: hex('#ffffff'), K: hex('#2a6ad0'), d: hex('#7a828c') });
    return s.done();
  };

  /* ------------------------------------------------------------ */
  /* Mob behaviour                                                */
  /* ------------------------------------------------------------ */
  const add = (name, o) => { MOBS[name] = Object.assign({ w: 0.6, h: 1.8, hp: 20, speed: 0.7, hostile: false, sound: null, model: name }, o); };
  const fxAt = (m, kind, n, s) => { if (m.world.fx) m.world.fx.particles(kind, m.x, m.y + m.h * 0.7, m.z, n || 5, s || 0.4); };
  const sound = (m, name, v, p) => { if (m.world.fx) m.world.fx.sound(name, m.x, m.y, m.z, v || 0.6, p || 1); };
  const ICE = [B.ice, B.packed_ice, B.blue_ice, B.snow_block];

  add('penguin', { w: 0.5, h: 0.8, hp: 8, speed: 0.6, sound: 'chicken', drops: [[349, 1, 0.4], [288, 1, 0.6]], tick: (m) => {
    const under = m.world.getBlock(Math.floor(m.x), Math.floor(m.y - 0.2), Math.floor(m.z));
    m.sliding = m.onGround && ICE.includes(under) && Math.hypot(m.vx, m.vz) > 0.05;
    if (m.inWater) { m.vy += 0.03; m.vx *= 1.12; m.vz *= 1.12; } // penguins are great swimmers
  } });
  add('crab', { w: 0.7, h: 0.45, hp: 8, speed: 0.75, neutral: true, attack: 2, sound: 'slime', drops: [[CRAB_CLAW, 1, 0.5]], init: (m) => { m.persistent = false; } });
  add('moobloom', { w: 0.9, h: 1.3, hp: 10, speed: 0.7, sound: 'cow', model: 'moobloom', skin: 'moobloom', drops: [[334, 1], [B.dandelion, 1]], tick: (m) => {
    // mooblooms leave a trail of buttercups
    if (isGuest() || m.age % 300 !== 7 || rnd() > 0.5) return;
    const w = m.world, x = Math.floor(m.x), y = Math.floor(m.y), z = Math.floor(m.z);
    if (w.getBlock(x, y, z) === 0 && w.getBlock(x, y - 1, z) === B.grass) w.setBlock(x, y, z, rnd() < 0.8 ? B.dandelion : B.sunflower, 0, 3);
  } });
  add('glare', { w: 0.8, h: 0.9, hp: 16, fly: true, flySpeed: 0.02, drag: 0.85, sound: 'bat', skinFor: (e) => e.grumpy ? 'glare_grumpy' : 'glare', drops: [[B.moss_block, 1], [B.azalea_leaves, 1, 0.5]], ai: glareAI });
  function glareAI(m) {
    m.moveForward = m.moveStrafe = 0;
    const w = m.world, g = DL.game;
    const p = g && g.player && g.player.world === w ? g.player : null;
    if (m.age % 20 === 0) {
      const x = Math.floor(m.x), y = Math.floor(m.y), z = Math.floor(m.z);
      const light = Math.max(w.getSky(x, y, z) - (w.skySubtracted ? w.skySubtracted(0) : 0), w.getBlockLight(x, y, z));
      m.grumpy = light <= 7; // too dark: monsters could spawn here
      if (m.grumpy && rnd() < 0.5) fxAt(m, 'smoke', 2, 0.3);
    }
    let tx, ty, tz;
    if (p && m.dist2(p.x, p.y, p.z) < 24 * 24) {
      // float around you, just out of the way
      const a = m.age * 0.01 + (m.id || 0);
      tx = p.x + Math.cos(a) * 3; ty = p.y + 1.8; tz = p.z + Math.sin(a) * 3;
      m.lookYaw = Math.atan2(-(p.x - m.x), -(p.z - m.z));
    } else {
      if (!m.home) m.home = [m.x, m.y, m.z];
      if (!m.wp || rnd() < 0.01) m.wp = [m.home[0] + (rnd() - 0.5) * 12, m.home[1] + (rnd() - 0.5) * 4, m.home[2] + (rnd() - 0.5) * 12];
      [tx, ty, tz] = m.wp;
    }
    const dx = tx - m.x, dy = ty - m.y, dz = tz - m.z, l = Math.hypot(dx, dy, dz);
    if (l > 0.6) { const f = Math.min(0.02, l * 0.01); m.vx += dx / l * f; m.vy += dy / l * f; m.vz += dz / l * f; }
    if (m.lookYaw === undefined) m.faceTowards(m.x + m.vx, m.z + m.vz, 0.2);
  }
  add('iceologer', { hostile: true, hp: 24, speed: 0.65, model: 'pillager', skin: 'iceologer', sound: 'villager', drops: [[B.packed_ice, 1], [388, 1, 0.4]], attackFn: (m, t, d, see) => {
    if (!see || d > 18) return;
    m.faceTowards(t.x, t.z, 0.8);
    if (d < 6) m.moveForward = -0.8; else if (d < 12) m.moveForward = 0;
    if (m.attackTime > 0) return;
    m.attackTime = 70; m.swing();
    // summon a chunk of ice above the target
    const c = new IceChunk(m.world, t.x, t.y + 5, t.z, m);
    m.world.entities.push(c);
    sound(m, 'portal', 0.6, 1.8);
    if (m.world.fx) m.world.fx.particles('portal', t.x, t.y + 5, t.z, 12, 0.6);
  } });
  class IceChunk extends E.FallingBlock {
    constructor(world, x, y, z, owner) { super(world, x, y, z, B.packed_ice); this.owner = owner; this.noSave = true; this.w = 1.4; this.h = 1; this.hang = 18; }
    tick() {
      this.px = this.x; this.py = this.y; this.pz = this.z; this.age++;
      if (this.hang > 0) { this.hang--; return; }
      this.vy -= 0.05; this.y += this.vy;
      const w = this.world, bx = Math.floor(this.x), by = Math.floor(this.y), bz = Math.floor(this.z);
      let hit = S.SOLID[w.getBlock(bx, by, bz)] || this.age > 200;
      for (const e of w.entities) {
        if (!e.living || e === this.owner || e.removed || e.health <= 0) continue;
        if (Math.abs(e.x - this.x) < 1 && Math.abs(e.z - this.z) < 1 && this.y < e.y + e.h && this.y + 1 > e.y) { e.damage('ice', 5, this.owner); e.vx *= 0.2; e.vz *= 0.2; e.slowTicks = 60; hit = true; }
      }
      if (hit) {
        this.removed = true;
        if (w.fx) { w.fx.blockBroken(bx, by + 1, bz, B.packed_ice, 0); w.fx.sound('glass', this.x, this.y, this.z, 1, 0.8); }
      }
    }
  }
  E.IceChunk = IceChunk;

  /* ------------------------------------------------------------ */
  /* Horses (ride with an empty hand, steer with a saddle)        */
  /* ------------------------------------------------------------ */
  add('horse', { w: 1.3, h: 1.6, hp: 22, speed: 0.75, sound: 'cow', drops: [[334, 2]],
    init: (m) => { if (m.variant === undefined) m.variant = Math.floor(rnd() * 7); },
    modelFor: (e) => ((e.variant || 0) & 8) ? 'horse_saddled' : 'horse',
    skinFor: (e) => (((e.variant || 0) & 8) ? 'horse_saddled_' : 'horse_') + (((e.variant || 0) & 7) % 7),
    interact: horseInteract, ai: horseAI });
  const saddled = (m) => ((m.variant || 0) & 8) !== 0;
  function horseInteract(m, p, game) {
    const now = performance.now();
    if ((game._rideCd || 0) > now) return true;
    game._rideCd = now + 350;
    const held = p.held;
    if (held && held.id === 329 && !saddled(m)) {
      m.variant = (m.variant || 0) | 8; m.persistent = true;
      if (!p.creative) p.consumeHeld(1);
      sound(m, 'cloth', 0.8, 1); fxAt(m, 'happy', 6, 0.6);
      game.chatMessage('§eSaddled! Hop on with an empty hand.');
      return true;
    }
    if (held) return false;
    if (p.vehicle || m.rider) return true;
    mount(p, m, game);
    return true;
  }
  function mount(p, m, game) {
    p.sitting = null; p.vehicle = m; m.rider = p; m.persistent = true; m.path = null; m.target = null;
    sound(m, 'cow', 0.6, 1.4);
    game.chatMessage(saddled(m) ? '§7Riding! Sneak to get off.' : '§7Riding bareback: it goes where it likes. Use a saddle to steer. Sneak to get off.');
    if (DL.Extras && DL.Extras.grant) DL.Extras.grant('ride');
  }
  function dismount(p) {
    const m = p.vehicle;
    p.vehicle = null;
    if (!m) return;
    m.rider = null;
    const w = p.world, a = m.yaw + Math.PI / 2;
    for (const k of [a, a + Math.PI, m.yaw]) {
      const x = m.x + Math.cos(k) * 1.4, z = m.z + Math.sin(k) * 1.4, y = Math.floor(m.y + 0.1);
      if (!S.SOLID[w.getBlock(Math.floor(x), y, Math.floor(z))] && !S.SOLID[w.getBlock(Math.floor(x), y + 1, Math.floor(z))]) { p.setPos(x, y, z); return; }
    }
    p.setPos(m.x, m.y + m.h + 0.1, m.z);
  }
  function horseAI(m) {
    const r = m.rider;
    if (r && (r.vehicle !== m || r.removed || r.health <= 0)) m.rider = null;
    m.speedMul = 1;
    if (m.rider && saddled(m)) {
      const inp = m.rider.rideInput || {};
      m.path = null; m.target = null;
      m.yaw = m.rider.yaw; m.lookYaw = m.rider.yaw;
      m.moveForward = inp.f || 0; m.moveStrafe = (inp.s || 0) * 0.4;
      m.speedMul = inp.sprint ? 2.6 : 1.8;
      m.jumping = false;
      if (m.onGround && (inp.j || (m.collidedH && Math.abs(m.moveForward) > 0.1))) { m.vy = inp.j ? 0.7 : 0.45; }
      return;
    }
    if (m.rider) m.speedMul = 1.2;
    if (m.grazing > 0) { m.grazing--; m.moveForward = m.moveStrafe = 0; m.path = null; return; }
    if (!m.rider && !m.path && rnd() < 0.004) { m.grazing = 50 + Math.floor(rnd() * 60); return; }
    m.aiTick();
  }

  /* ------------------------------------------------------------ */
  /* The player: riding and chairs                                */
  /* ------------------------------------------------------------ */
  const PL = E.Player.prototype;
  function seatPos(p) {
    if (p.vehicle) { const m = p.vehicle; return [m.x + Math.sin(m.yaw) * 0.1, m.y + 0.66, m.z + Math.cos(m.yaw) * 0.1]; }
    if (p.sitting) { const s = p.sitting; return [s.x + 0.5, s.y - 0.22, s.z + 0.5]; }
    return null;
  }
  const ptick = PL.tick;
  PL.tick = function () {
    if (!this.vehicle && !this.sitting) return ptick.call(this);
    this.rideInput = { f: this.moveForward, s: this.moveStrafe, j: this.jumping, sprint: this.sprinting };
    this.moveForward = this.moveStrafe = 0; this.jumping = false; this.sprinting = false;
    ptick.call(this);
    const sp = seatPos(this);
    if (sp) { this.x = sp[0]; this.y = sp[1]; this.z = sp[2]; }
    this.vx = this.vy = this.vz = 0; this.fallDistance = 0; this.onGround = true;
  };
  const onDeath = PL.onDeath;
  PL.onDeath = function (src) {
    if (this.vehicle) dismount(this);
    this.sitting = null;
    const g = DL.game;
    if (g && g.player === this) {
      const dims = DL.DIM_NAMES || ['the Overworld', 'the Nether', 'the End', 'the Aether', 'the Sift'];
      g.chatMessage('§cYou died at ' + Math.floor(this.x) + ', ' + Math.floor(this.y) + ', ' + Math.floor(this.z) + ' in ' + (dims[this.world.dim || 0] || 'this world') + '.');
    }
    return onDeath.apply(this, arguments);
  };

  const useItem = GP.useItem;
  GP.useItem = function () {
    const p = this.player, t = this.target;
    const edge = this.usePressed || this._pgUseEdge;
    // chairs: right-click stairs with an empty hand
    if (edge && p && !p.held && !p.sneaking && !p.vehicle && t && !t.entity && S.RENDER[this.world.getBlock(t.x, t.y, t.z)] === S.R.STAIRS
      && !S.SOLID[this.world.getBlock(t.x, t.y + 1, t.z)] && Math.hypot(p.x - t.x - 0.5, p.z - t.z - 0.5) < 3.2) {
      p.sitting = { x: t.x, y: t.y, z: t.z };
      const d = this.world.getMeta(t.x, t.y, t.z) & 3; // face away from the backrest
      p.yaw = [Math.PI, 0, Math.PI / 2, -Math.PI / 2][d];
      p.swing();
      return;
    }
    return useItem.call(this);
  };

  const tick = GP.tick;
  GP.tick = function () {
    tick.apply(this, arguments);
    const p = this.player, w = this.world;
    if (!p || !w) return;
    // get off
    if (p.vehicle && (p.sneaking || p.vehicle.removed || p.vehicle.health <= 0)) dismount(p);
    if (p.sitting) {
      const s = p.sitting;
      if (p.sneaking || this.jumpHeld || S.RENDER[w.getBlock(s.x, s.y, s.z)] !== S.R.STAIRS) { p.sitting = null; p.setPos(s.x + 0.5, s.y + 1, s.z + 0.5); }
    }
    const sp = seatPos(p);
    if (sp) { p.x = sp[0]; p.y = sp[1]; p.z = sp[2]; }
    ambient(this);
    if (this.tickCount % 200 === 13 && !isGuest()) caveSpawns(this);
  };
  const hookWorld = GP.hookWorld;
  if (hookWorld) GP.hookWorld = function () { const r = hookWorld.apply(this, arguments); if (this.player) { this.player.vehicle = null; this.player.sitting = null; } return r; };

  /* ------------------------------------------------------------ */
  /* Where the new creatures live                                 */
  /* ------------------------------------------------------------ */
  const PASSIVE = {};
  for (const b of ['SNOWY_BEACH', 'FROZEN_OCEAN', 'ICE_SPIKES', 'FROZEN_RIVER']) PASSIVE[BI[b]] = ['penguin', 'penguin', 'polar_bear'];
  PASSIVE[BI.TUNDRA] = ['penguin', 'rabbit', 'polar_bear'];
  for (const b of ['MANGROVE_SWAMP', 'BEACH', 'WARM_OCEAN']) PASSIVE[BI[b]] = ['crab', 'crab', 'crab', 'chicken'];
  for (const b of ['FLOWER_FOREST', 'MEADOW', 'SUNFLOWER_PLAINS']) PASSIVE[BI[b]] = ['moobloom', 'moobloom', 'sheep', 'rabbit', 'cow', 'pig'];
  for (const b of ['PLAINS', 'SAVANNA', 'SAVANNA_PLATEAU']) PASSIVE[BI[b]] = ['horse', 'cow', 'cow', 'sheep', 'sheep', 'pig', 'pig', 'chicken', 'chicken'];
  DL.biomeAnimals = (b) => PASSIVE[b] || null;
  DL.biomeAnimalGround = [B.sand, B.mud, B.snow_block, B.snow_layer, B.red_sand, B.gravel];
  DL.mountainHostile = (b) => (b === BI.SNOWY_SLOPES || b === BI.GROVE || b === BI.FROZEN_PEAKS || b === BI.JAGGED_PEAKS) && rnd() < 0.3 ? 'iceologer' : null;
  // glares drift around lush caves
  function caveSpawns(g) {
    const w = g.world, p = g.player;
    if ((w.dim || 0) !== 0 || !w.caveBiomeAt) return;
    const x = Math.floor(p.x) + Math.floor(rnd() * 24) - 12, z = Math.floor(p.z) + Math.floor(rnd() * 24) - 12, y = Math.floor(p.y) + Math.floor(rnd() * 8) - 3;
    if (w.caveBiomeAt(x, y, z) !== BI.LUSH_CAVES || w.getBlock(x, y, z) !== 0 || w.getBlock(x, y + 1, z) !== 0) return;
    let n = 0;
    for (const e of w.entities) if (e.type === 'glare' && Math.abs(e.x - p.x) < 48 && Math.abs(e.z - p.z) < 48) n++;
    if (n < 2) E.spawnMob(w, 'glare', x + 0.5, y, z + 0.5);
  }

  /* ------------------------------------------------------------ */
  /* Fireflies and falling leaves                                 */
  /* ------------------------------------------------------------ */
  const FIREFLY_BIOMES = new Set(['SWAMP', 'MANGROVE_SWAMP', 'FOREST', 'DARK_FOREST', 'MEADOW', 'CHERRY_GROVE', 'FLOWER_FOREST', 'SEASONAL', 'BIRCH_FOREST', 'OLD_GROWTH_BIRCH', 'JUNGLE', 'PALE_GARDEN', 'PLAINS'].map(k => BI[k]));
  let flies = 0, leaves = 0;
  function ambient(g) {
    const r = g.renderer, w = g.world, p = g.player;
    if (!r || !r.addParticle || (w.dim || 0) !== 0) return;
    if (g.tickCount % 20 === 0) { leaves = 0; for (const q of r.particles) if (q.type === 'leaf') leaves++; }
    tickFireflies(w);
    flies = FF.length;
    const px = Math.floor(p.x), pz = Math.floor(p.z);
    // fireflies at night in leafy, watery places
    const night = (w.skySubtracted ? w.skySubtracted(0) : 0) >= 7;
    const raining = DL.Extras && w.weather && w.weather.rain > 0.3;
    if (night && !raining && flies < (g.settings.fancy ? 70 : 30) && FIREFLY_BIOMES.has(w.biomeAtCol ? w.biomeAtCol(px, pz) : 0)) {
      for (let k = 0; k < 2; k++) {
        const x = px + rnd() * 32 - 16, z = pz + rnd() * 32 - 16, top = w.topSolidY(Math.floor(x), Math.floor(z));
        if (!top || Math.abs(top - p.y) > 16 || w.getBlock(Math.floor(x), top, Math.floor(z)) !== 0) continue;
        const y = top + 0.4 + rnd() * 3.5;
        FF.push({ x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0, age: 0, life: 200 + Math.floor(rnd() * 240), phase: rnd() * 6.28, rate: 0.06 + rnd() * 0.06 });
        flies++;
      }
    }
    // leaves drift down from the trees around you
    if (leaves < (g.settings.fancy ? 60 : 20)) {
      for (let k = 0; k < 8; k++) {
        const x = px + Math.floor(rnd() * 21) - 10, z = pz + Math.floor(rnd() * 21) - 10, y = Math.floor(p.y) + Math.floor(rnd() * 16) - 3;
        const id = w.getBlock(x, y, z);
        if (!S.LEAVES[id] || w.getBlock(x, y - 1, z) !== 0 || rnd() > (id === B.cherry_leaves ? 0.6 : 0.12)) continue;
        const tile = S.TEX[id * 6 + 2];
        const tc = S.TINT_KIND[id] === 2 && S.BIOME_COLORS ? (S.BIOME_COLORS[w.biomeAtCol(x, z)] || S.BIOME_COLORS[0])[1] : [1, 1, 1];
        const lx = x + rnd(), ly = y - 0.05, lz = z + rnd();
        r.addParticle({ type: 'leaf', tex: 'terrain', tile, sub: [Math.floor(rnd() * 12), Math.floor(rnd() * 12)], x: lx, y: ly, z: lz, px: lx, py: ly, pz: lz, vx: 0, vy: -0.01, vz: 0, gravity: 0.0012, drag: 0.96, life: 160 + Math.floor(rnd() * 120), age: 0, size: id === B.cherry_leaves ? 0.12 : 0.15, r: Math.min(1, tc[0]), g: Math.min(1, tc[1]), b: Math.min(1, tc[2]), a: 1, collide: true, phase: rnd() * 6.28 });
        leaves++;
      }
    }
  }
  /* Fireflies are two pixels: a dark body and a tail that blinks yellow */
  const FF = [];
  function tickFireflies(w) {
    let j = 0;
    for (let i = 0; i < FF.length; i++) {
      const f = FF[i];
      f.px = f.x; f.py = f.y; f.pz = f.z;
      if (++f.age > f.life) continue;
      f.vx += (rnd() - 0.5) * 0.008; f.vy += (rnd() - 0.5) * 0.006; f.vz += (rnd() - 0.5) * 0.008;
      f.vx *= 0.92; f.vy *= 0.92; f.vz *= 0.92;
      const nx = f.x + f.vx, ny = f.y + f.vy, nz = f.z + f.vz;
      if (S.SOLID[w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) { f.vx = -f.vx; f.vy = Math.abs(f.vy) + 0.01; f.vz = -f.vz; }
      else { f.x = nx; f.y = ny; f.z = nz; }
      FF[j++] = f;
    }
    FF.length = j;
  }
  DL.Wishlist = { fireflies: () => FF, addFirefly: (x, y, z) => FF.push({ x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0, age: 30, life: 600, phase: rnd() * 6.28, rate: 0.06 + rnd() * 0.06 }) };
  Object.assign(DL.Wishlist, { mount, dismount, saddled, seatPos, resetMapColors: () => { colorOf = null; } });
  const PX = 1 / 16;
  RP.renderFireflies = function (world, pt) {
    if (!FF.length || DL.game.world !== world) return;
    const cam = this.cam, v = this.view;
    const rt = [v[0], v[4], v[8]], up = [v[1], v[5], v[9]];
    const sub = this.skySub || 0, h = PX / 2;
    DL.M4.multiply(this.mvp, this.proj, this.view);
    this.begin();
    const quad = (cx, cy, cz, col) => {
      const P = (a, b) => [cx + rt[0] * a + up[0] * b, cy + rt[1] * a + up[1] * b, cz + rt[2] * a + up[2] * b];
      this.quadV([P(-h, -h), P(h, -h), P(h, h), P(-h, h)], null, col);
    };
    for (const f of FF) {
      const x = f.px + (f.x - f.px) * pt - cam.x, y = f.py + (f.y - f.py) * pt - cam.y, z = f.pz + (f.z - f.pz) * pt - cam.z;
      const bx = Math.floor(f.x), by = Math.floor(f.y), bz = Math.floor(f.z);
      const l = Math.max(0, world.getSky(bx, by, bz) - sub, world.getBlockLight(bx, by, bz)) / 15, lit = 0.1 + 0.9 * l * l;
      const s = Math.sin((f.age + pt) * f.rate + f.phase), on = s > 0.3 ? Math.min(1, (s - 0.3) * 4) : 0;
      const fade = Math.min(1, f.age / 20, (f.life - f.age) / 20);
      // facing the same way as you, the body sits left of the glowing tail
      quad(x - rt[0] * h, y - rt[1] * h, z - rt[2] * h, [0.2 * lit, 0.13 * lit, 0.07 * lit, fade]);
      const gr = 0.42 * lit, gg = 0.4 * lit, gb = 0.3 * lit;
      quad(x + rt[0] * h, y + rt[1] * h, z + rt[2] * h, [gr + (1 - gr) * on, gg + (0.95 - gg) * on, gb + (0.25 - gb) * on, fade]);
    }
    const gl = this.gl;
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    this.flush('quads', { fog: true });
    gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
  };
  const renderBillboards = RP.renderBillboards;
  RP.renderBillboards = function (world, pt) {
    const out = renderBillboards.apply(this, arguments);
    try { this.renderFireflies(world, pt); } catch (e) { console.warn('fireflies', e); }
    return out;
  };
  const tickParticles = RP.tickParticles;
  RP.tickParticles = function (world) {
    for (const q of this.particles) {
      if (q.type === 'leaf' && !q.ground) {
        q.vx += Math.sin(q.age * 0.07 + q.phase) * 0.0016; q.vz += Math.cos(q.age * 0.05 + q.phase) * 0.0016;
        if (q.vy < -0.04) q.vy = -0.04;
      } else if (q.type === 'leaf' && q.ground) q.a = Math.max(0, Math.min(1, (q.life - q.age) / 30));
    }
    return tickParticles.call(this, world);
  };

  /* ------------------------------------------------------------ */
  /* Minimap with coordinates (M to toggle)                       */
  /* ------------------------------------------------------------ */
  In.DEFAULT_BINDS.minimap = 'KeyM'; In.BIND_NAMES.minimap = 'Minimap';
  if (!In.binds.minimap) In.binds.minimap = 'KeyM';
  const MAP = 56;
  let mapCanvas = null, mapCtx = null, mapImg = null, mapAt = 0, colorOf = null;
  function blockColors() {
    const out = new Array(256).fill(null), td = DL.Tex.tileData || {};
    for (let id = 1; id < 256; id++) {
      if (!S.blocks[id]) continue;
      const d = td[S.TILE_NAMES[S.TEX[id * 6 + 1]]];
      if (!d) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      if (n) out[id] = [r / n, g / n, b / n];
    }
    return out;
  }
  function buildMap(g) {
    const w = g.world, p = g.player;
    if (!mapCanvas) { mapCanvas = DL.Tex.makeCanvas(MAP, MAP); mapCtx = mapCanvas.getContext('2d'); mapImg = mapCtx.createImageData(MAP, MAP); }
    if (!colorOf) colorOf = blockColors();
    const d = mapImg.data, x0 = Math.floor(p.x) - MAP / 2, z0 = Math.floor(p.z) - MAP / 2, nether = (w.dim || 0) === 1;
    const BC = S.BIOME_COLORS;
    let prevH = null;
    for (let zz = 0; zz < MAP; zz++) {
      const rowH = [];
      for (let xx = 0; xx < MAP; xx++) {
        const x = x0 + xx, z = z0 + zz, o = (zz * MAP + xx) * 4;
        const c = w.getChunk(x >> 4, z >> 4);
        let h = 0, id = 0;
        if (c && c.blocks) {
          if (nether) { for (let y = Math.min(CH - 2, Math.floor(p.y) + 1); y > 0; y--) { const b = c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; if (b && b !== B.fire) { h = y + 1; id = b; break; } } }
          else if (c.heightMap) { h = c.heightMap[((z & 15) << 4) | (x & 15)]; id = h > 0 ? c.blocks[((h - 1) << 8) | ((z & 15) << 4) | (x & 15)] : 0; }
        }
        rowH.push(h);
        const col = id && colorOf[id];
        if (!col) { d[o + 3] = c ? 255 : 0; d[o] = d[o + 1] = d[o + 2] = 20; continue; }
        let r = col[0], gg = col[1], b = col[2];
        const kind = S.TINT_KIND[id];
        if (kind && BC && c.biomes && !w.dim) { const t = (BC[c.biomes[((z & 15) << 4) | (x & 15)]] || BC[0])[kind - 1]; r *= t[0]; gg *= t[1]; b *= t[2]; }
        const hn = prevH ? prevH[xx] : h;
        const k = h > hn ? 1.15 : h < hn ? 0.82 : 1;
        d[o] = Math.min(255, r * k); d[o + 1] = Math.min(255, gg * k); d[o + 2] = Math.min(255, b * k); d[o + 3] = 255;
      }
      prevH = rowH;
    }
    mapCtx.putImageData(mapImg, 0, 0);
  }
  const hudExtras = G.drawHUDExtras;
  G.drawHUDExtras = function (game, Wd, H, hy) {
    const r = hudExtras ? hudExtras.apply(this, arguments) : undefined;
    const p = game.player, w = game.world;
    if (!p || !w || game.hideGui || game.settings.minimap === false || game.debug) return r;
    const now = performance.now();
    if (now - mapAt > 250) { mapAt = now; try { buildMap(game); } catch (e) { /* not ready yet */ } }
    if (!mapCanvas) return r;
    const ctx = G.ctx, x = Wd - MAP - 5 - G.safe.r, y = 5 + G.safe.t;
    G.rect(x - 2, y - 2, MAP + 4, MAP + 4, 'rgba(0,0,0,0.55)');
    ctx.drawImage(mapCanvas, x, y, MAP, MAP);
    // other players
    for (const e of w.entities) {
      if (e === p || e.type !== 'player' || e.removed) continue;
      const ex = Math.round(e.x - p.x + MAP / 2), ez = Math.round(e.z - p.z + MAP / 2);
      if (ex >= 0 && ez >= 0 && ex < MAP && ez < MAP) G.rect(x + ex - 1, y + ez - 1, 3, 3, '#5ac8ff');
    }
    // you: an arrow pointing where you look
    ctx.save();
    ctx.translate(x + MAP / 2, y + MAP / 2);
    ctx.rotate(-p.yaw + Math.PI);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, 3); ctx.lineTo(0, 1.5); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    G.textC('N', x + MAP / 2, y + 1, '#ff6060');
    const bn = DL.biomeNameAt ? DL.biomeNameAt(w, Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) : '';
    const coords = Math.floor(p.x) + ' ' + Math.floor(p.y) + ' ' + Math.floor(p.z);
    G.textC(coords, x + MAP / 2, y + MAP + 4, '#ffffff');
    if (bn && bn !== '?') G.textC(bn.length > 16 ? bn.slice(0, 15) + '.' : bn, x + MAP / 2, y + MAP + 14, '#d0d0d0');
    return r;
  };
  const gameKey = GP.gameKey;
  GP.gameKey = function (code, ctrl) {
    if (code === In.binds.minimap) { this.settings.minimap = this.settings.minimap === false; this.saveSettings && this.saveSettings(); return; }
    return gameKey.call(this, code, ctrl);
  };

  /* ------------------------------------------------------------ */
  /* Sort button for your inventory and chests                    */
  /* ------------------------------------------------------------ */
  function sortRange(arr, from, to) {
    const items = [];
    for (let i = from; i < to; i++) if (arr[i]) { items.push(arr[i]); arr[i] = null; }
    const merged = [];
    for (const st of items) {
      const max = I.maxStack(st.id);
      let left = st.count;
      for (const m of merged) {
        if (left <= 0) break;
        if (m.id === st.id && (m.dmg || 0) === (st.dmg || 0) && m.count < max && max > 1) { const k = Math.min(max - m.count, left); m.count += k; left -= k; }
      }
      if (left > 0) merged.push(Object.assign({}, st, { count: left }));
    }
    merged.sort((a, b) => (I.get(a.id).isBlock === I.get(b.id).isBlock ? 0 : I.get(a.id).isBlock ? -1 : 1) || a.id - b.id || (a.dmg || 0) - (b.dmg || 0) || b.count - a.count);
    merged.forEach((st, i) => { arr[from + i] = st; });
  }
  function sortSpots(scr) {
    const out = [];
    const g = scr.game, p = scr.player;
    if (scr instanceof G.InventoryScreen) out.push({ x: scr.px + scr.pw - 18, y: scr.py + scr.ph - 95, run: () => sortRange(p.inv, 9, 36) });
    else if (scr instanceof G.ChestScreen) {
      out.push({ x: scr.px + scr.pw - 18, y: scr.py + 5, run: () => { if (isGuest()) { g.chatMessage('§7Chests sort on the host.'); return; } sortRange(scr.te.items, 0, scr.te.items.length); scr.dirty(); } });
      out.push({ x: scr.px + scr.pw - 18, y: scr.py + scr.rows * 18 + 19, run: () => sortRange(p.inv, 9, 36) });
    }
    return out;
  }
  const CS = G.ContainerScreen.prototype;
  const csDraw = CS.draw, csDown = CS.mouseDown;
  CS.draw = function (mx, my) {
    csDraw.call(this, mx, my);
    for (const s of sortSpots(this)) {
      const hover = mx >= s.x && my >= s.y && mx < s.x + 12 && my < s.y + 10;
      G.rect(s.x, s.y, 12, 10, '#373737'); G.rect(s.x + 1, s.y + 1, 10, 8, hover ? '#a8a8ff' : '#8b8b8b');
      for (let i = 0; i < 3; i++) G.rect(s.x + 3, s.y + 2 + i * 2, 6 - i * 2 + 2, 1, '#ffffff');
      if (hover) G.tooltip = { text: 'Sort', x: mx, y: my };
    }
    if (G.tooltip && this.drawCursorItem) { /* tooltip drawn by the next frame's cursor pass */ }
  };
  CS.mouseDown = function (x, y, button, shift) {
    for (const s of sortSpots(this)) if (x >= s.x && y >= s.y && x < s.x + 12 && y < s.y + 10) { A.play('click', null, null, null, 1, 1); s.run(); return; }
    return csDown.call(this, x, y, button, shift);
  };

  /* ------------------------------------------------------------ */
  /* Spawn eggs for the newcomers                                 */
  /* ------------------------------------------------------------ */
  if (DL.Creative && DL.Creative.addEgg) {
    [['glare', '#4e7a2a', '#d86ec0'], ['moobloom', '#f2c735', '#fafae8'], ['penguin', '#1c1e26', '#f2a020'], ['crab', '#2f6e8e', '#e2742d'],
      ['iceologer', '#7fb3e0', '#e8f4ff'], ['horse', '#a0582a', '#2a2422']].forEach(([m, a, b], i) => DL.Creative.addEgg(m, a, b, 512 + i));
  }
})();
