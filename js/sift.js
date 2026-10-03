/*
 * DreamLand - The Sift: the dimension Mojang revealed at Minecraft Live 2026
 * (first seen in Minecraft Dungeons II), built from what was shown: pastel
 * floating islands of red-orange stone over a sea of iridescent ichor, the
 * red sculk of Singer's Meadow, the Carapace's blue walls and giant hollow
 * fossils, the barren gashes of Lullaby Hills, glowing Echo Dens, turquoise
 * flora, souls everywhere, and the Sift Tides (Flow, Thrive, Endure).
 * Get there through a rift: a crying obsidian frame lit with an echo shard.
 * The creatures live in sift_mobs.js.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, Tex = DL.Tex, G = Tex.G, E = DL.Entities, I = DL.Items, A = DL.Audio, In = DL.Input;
  const GUI = DL.GUI, M4 = DL.M4, N = DL.Net;
  const GP = DL.Game.prototype, RP = DL.Renderer.prototype, W = DL.World.prototype;
  const SOLID = S.SOLID, CH = S.CH;
  const K = Tex.kit;
  const { hex, P, mix, mul, pick, surface, specks, planks, bevel, art } = K;
  const rnd = Math.random;
  const SIFT = 4;
  const isGuest = () => !!(N && N.client);
  const Sift = DL.Sift = { SIFT };

  /* ------------------------------------------------------------ */
  /* Textures                                                     */
  /* ------------------------------------------------------------ */
  const STONE = P('#9a3f34 #ac4a3b #bd5642 #cc634b #da7354 #e68863');
  const TURF = P('#2f9a68 #3aa874 #46b882 #55c690 #66d49e #7ae0ae');
  const LULL = P('#4e3c62 #5e4870 #6c5480 #7a6090 #8a70a0 #9a80b0');
  const fringe = (t, pal, deep) => {
    const drip = [];
    for (let x = 0; x < 16; x++) drip.push(3 + (t.rand() < 0.5 ? 1 : 0) + (t.rand() < (deep || 0.2) ? 1 : 0));
    for (let x = 0; x < 16; x++) {
      if (x > 0 && Math.abs(drip[x] - drip[x - 1]) > 1) drip[x] = drip[x - 1] + Math.sign(drip[x] - drip[x - 1]);
      for (let y = 0; y < drip[x]; y++) t.set(x, y, pick(pal, t.rand() * 0.7 + (y === 0 ? 0.3 : 0)));
      t.set(x, drip[x] - 1, pal[0]);
    }
  };
  G.sift_stone = t => {
    surface(t, STONE, { cells: [8, 4, 2], weights: [0.5, 0.3, 0.2], grain: 0.3 });
    // warm orange strata
    for (let k = 0; k < 5; k++) { const y = t.ri(16), x0 = t.ri(16), n = 3 + t.ri(5); for (let i = 0; i < n; i++) t.set((x0 + i) & 15, y, hex(i % 3 ? '#ef9a6a' : '#e0805a')); }
  };
  G.sift_stone_bricks = t => K.stoneBricks(t, { pal: P('#8e3a30 #a44638 #b85342 #c8604a #d87054 #ea8c68'), gap: hex('#5e221c') });
  G.chiseled_sift_stone = t => {
    G.sift_stone_bricks(t);
    bevel(t, hex('#ea8c68'), hex('#6e2a22'), 1);
    art(t, ['....aa....', '...abba...', '..ab..ba..', '.ab.cc.ba.', '..ab..ba..', '...abba...', '....aa....'], { a: hex('#1fa89c'), b: hex('#6ff2e2'), c: hex('#d6fff8') }, 3, 4);
  };
  G.sift_turf_top = t => {
    surface(t, TURF, { cells: [8, 4, 2, 1], weights: [0.3, 0.3, 0.2, 0.2], grain: 0.4 });
    specks(t, [[hex('#ff9ccf'), 0.012], [hex('#c8fff0'), 0.012]]);
  };
  G.sift_turf_side = t => { G.sift_stone(t); fringe(t, TURF); };
  G.lullaby_moss = t => { surface(t, LULL, { cells: [4, 2, 1], weights: [0.4, 0.35, 0.25], grain: 0.45 }); specks(t, [[hex('#c0a8d8'), 0.02]]); };
  G.lullaby_moss_side = t => { G.sift_stone(t); fringe(t, LULL, 0.3); };
  G.red_sculk = t => {
    surface(t, P('#3e0818 #4c0a1e #5e0e28 #741434 #8a1a40'), { cells: [4, 2], grain: 0.35 });
    // glowing veins and soul specks, like sculk but red
    const V = hex('#ff4f8f'), D = hex('#ffb0d0');
    for (const [x0, y0, dx, dy, n] of [[0, 3, 1, 0, 6], [6, 3, 1, 1, 5], [11, 8, 1, 0, 5], [3, 9, 0, 1, 6], [3, 14, 1, 0, 9], [12, 0, 0, 1, 7]]) for (let i = 0; i < n; i++) t.set((x0 + dx * i) & 15, (y0 + dy * i) & 15, V);
    for (const [x, y] of [[2, 1], [9, 5], [14, 12], [6, 11], [12, 4]]) { t.set(x, y, D); t.set(x + 1, y, V); }
  };
  G.carapace_sand = t => { surface(t, P('#cfa49a #d6b0a4 #dfbcb0 #e8c8bc #f0d4c8 #f6e0d6'), { cells: [4, 2], grain: 0.55 }); specks(t, [[hex('#b890c0'), 0.03], [hex('#fff0e8'), 0.03]]); };
  G.carapace_rock = t => {
    surface(t, P('#b07e78 #bc8a82 #c8988c #d4a698'), { cells: [4, 2], grain: 0.3 });
    for (const y of [3, 4, 9, 13]) for (let x = 0; x < 16; x++) t.set(x, y, y % 2 ? hex('#a87088') : hex('#e2b6a8'));
  };
  G.carapace_wall = t => {
    const C = P('#1c3c9a #2650c0 #3468dc #4a84f0 #78acff #b8d8ff');
    const cols = []; for (let x = 0; x < 16; x++) cols.push(t.rand());
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(C, 0.2 + cols[x] * 0.55 + (t.rand() - 0.5) * 0.2 - (y / 40)));
    // glossy facets and cracks
    for (const [x, y, n] of [[2, 1, 5], [9, 4, 7], [13, 0, 4], [5, 9, 6]]) for (let i = 0; i < n; i++) t.set(x, y + i, C[5]);
    for (const [x, y, n] of [[7, 2, 5], [11, 10, 5], [1, 11, 4]]) for (let i = 0; i < n; i++) t.set(x + (i % 2), y + i, C[0]);
    bevel(t, C[4], C[0], 0);
  };
  const BONE = P('#b8a88e #cbbca2 #d8cab0 #e6d9c0 #f2e8d4');
  G.fossil_side = t => {
    surface(t, BONE, { cells: [4, 2], grain: 0.3 });
    for (const y of [2, 7, 12]) for (let x = 0; x < 16; x++) { t.set(x, y, BONE[0]); t.set(x, y + 1, BONE[4]); }
    specks(t, [[hex('#e8a0b0'), 0.02]]);
  };
  G.fossil_top = t => {
    surface(t, BONE, { cells: [4, 2], grain: 0.3 });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 3) t.set(x, y, d < 1.6 ? hex('#d87894') : hex('#f0b0c0'));
      else if (d < 4.2) t.set(x, y, BONE[0]);
      else if (d > 6.5 && d < 7.6) t.set(x, y, BONE[1]);
    }
  };
  G.soul_block = t => {
    const C = P('#0e7b76 #129a92 #1cbcb0 #3ad8c8 #7af0e4 #c8fff8');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); t.set(x, y, pick(C, Math.max(0, 0.95 - d / 11 + (t.rand() - 0.5) * 0.25))); }
    art(t, ['.kk..kk.', '.kk..kk.', '........', '..kkkk..', '...kk...'], { k: hex('#0a5a56') }, 4, 4);
    bevel(t, C[3], C[0], 0);
  };
  G.echo_bulb = t => {
    const C = P('#0f7f86 #1ab8b0 #42e0d2 #a8fff4 #ffffff');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); t.set(x, y, d < 6 ? pick(C, 1 - d / 7) : hex(d < 7 ? '#e0f0ea' : '#c4d8d2')); }
    bevel(t, hex('#f4fffc'), hex('#8aa8a2'), 0);
    for (let k = 0; k < 16; k += 5) { t.set(k, 0, hex('#6a8a84')); t.set(0, k, hex('#6a8a84')); }
  };
  G.sift_log_side = t => {
    K.bark(t, { dark: hex('#9a88a8'), mid: hex('#c8b8d0'), light: hex('#e4d8e8'), cracks: 3 });
    for (const x of [3, 10]) for (let y = 0; y < 16; y++) if ((y + x) % 5 !== 0) t.set(x + ((y >> 2) % 2), y, hex('#40e0d0'));
  };
  G.sift_log_top = t => K.rings(t, { bark: hex('#c8b8d0'), barkDark: hex('#9a88a8'), light: hex('#f4b4d0'), mid: hex('#e090b8'), dark: hex('#b86090') });
  G.sift_planks = t => planks(t, { dark: hex('#a85676'), mid: hex('#c8728e'), light: hex('#dc8ca6'), gap: hex('#7a3452') });
  G.sift_leaves = t => {
    const pal = P('#a8226a #c02c78 #d83c8c #ea56a2 #f478b8 #ff9cce');
    const f = K.norm(K.fbm(t, [4, 2], [0.6, 0.4]));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = f[y * 16 + x] * 0.55 + t.rand() * 0.45;
      if (v < 0.18) { t.set(x, y, [0, 0, 0], 0); continue; }
      t.set(x, y, pick(pal, (v - 0.18) / 0.82));
    }
    for (let k = 0; k < 8; k++) { const x = t.ri(16), y = t.ri(16); if (t.alpha(x, y)) t.set(x, y, hex('#5ff0e0')); }
  };
  const plant = (t, rows, pal) => { t.clear(); art(t, rows, pal); };
  G.tidebloom = t => plant(t, [
    '................', '....aa....aa....', '...abba..abba...', '...abcba.abcb...', '....abba..ab....', '.....aa...a.....',
    '......g...g.....', '......g..g......', '.......gg.......', '.......g........', '...aa..g........', '..abba.g..gg....',
    '..abcbag.g......', '...abbagg.......', '.....g.g........', '.......g........'
  ], { a: hex('#1aa89c'), b: hex('#5ff0e0'), c: hex('#e0fffa'), g: hex('#2f9a68') });
  G.singing_bell = t => plant(t, [
    '................', '.......gg.......', '......g..g......', '.....g....g.....', '....g......g....', '...pp......pp...',
    '..pPPp....pPPp..', '..pPPp....pPPp..', '..pwwp....pwwp..', '...yy......yy...', '.......g........', '.......g...pp...',
    '.......g..pPPp..', '.......g..pwwp..', '.......g...yy...', '.......g........'
  ], { g: hex('#1f8a74'), p: hex('#d8508c'), P: hex('#ff8fc8'), w: hex('#ffd0e8'), y: hex('#7af0e4') });
  G.sift_grass = t => plant(t, [
    '................', '..p..........p..', '..g....p.....g..', '..g....g..p..g..', '.gg....g..g..g..', '.g....gg..g.gg..',
    '.g..p.g...g.g...', '.g..g.g..gg.g...', 'gg..g.g..g..g.p.', 'g...ggg..g.gg.g.', 'g...gg..gg.g..g.', 'g..gg...g..g.gg.',
    'g..g...gg..g.g..', 'gg.g...g..gg.g..', '.g.g..gg..g..g..', '.ggg..g...g..g..'
  ], { g: hex('#46b882'), p: hex('#ff9ccf') });
  G.drift_crystal = t => plant(t, [
    '................', '.......a........', '......abb.......', '......abb...a...', '...a..abb..ab...', '..abb.abbb.abb..',
    '..abb.abbb.abb..', '..abbbabbbbabb..', '...abbabbbbabb..', '...abbbabbbabb..', '....abbabbabb...', '....abbabbabb...',
    '.....cbbbbbc....', '.....cccccc.....', '................', '................'
  ], { a: hex('#ffd0ea'), b: hex('#ff7ac0'), c: hex('#c03a88') });
  // animated: iridescent ichor and the swirling rift
  const hsv = (h, s, v) => { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), u = v * (1 - (1 - f) * s); return [[v, u, p], [q, v, p], [p, v, u], [p, q, v], [u, p, v], [v, p, q]][((i % 6) + 6) % 6].map(c => c * 255); };
  function IchorFX(flow) { this.data = new Uint8ClampedArray(1024); this.t = flow ? 7 : 0; this.flow = flow; this.tick(); }
  IchorFX.prototype.tick = function () {
    this.t++;
    const d = this.data, t = this.t;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const yy = this.flow ? (y - t * 0.5) : y;
      const w = Math.sin((x + t * 0.11) * 0.8) * 0.6 + Math.sin((yy * 0.7 + x * 0.3) * 0.9 + t * 0.05) * 0.7 + Math.sin((x * 0.5 - yy * 0.6) - t * 0.07);
      const h = (((x * 0.02 + yy * 0.035 + w * 0.08 + t * 0.004) % 1) + 1) % 1;
      const v = 0.82 + 0.18 * Math.sin(w * 2.2);
      const c = hsv(h, 0.45 + 0.15 * Math.sin(w), v), o = (y * 16 + x) * 4;
      const sh = w > 1.55 ? 0.6 : 0;
      d[o] = c[0] + (255 - c[0]) * sh; d[o + 1] = c[1] + (255 - c[1]) * sh; d[o + 2] = c[2] + (255 - c[2]) * sh; d[o + 3] = 225;
    }
  };
  function RiftFX() { this.data = new Uint8ClampedArray(1024); this.t = 0; this.tick(); }
  RiftFX.prototype.tick = function () {
    this.t++;
    const d = this.data, t = this.t;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const sw = Math.sin(a * 3 + r * 0.9 - t * 0.18) * 0.5 + 0.5, k = Math.max(0, 1 - r / 11);
      const c = mix(hex('#ff6fb8'), hex('#3ff0dc'), sw);
      const glow = Math.pow(k, 1.5);
      const o = (y * 16 + x) * 4;
      d[o] = Math.min(255, c[0] * (0.45 + glow) + 40 * glow); d[o + 1] = Math.min(255, c[1] * (0.45 + glow) + 40 * glow); d[o + 2] = Math.min(255, c[2] * (0.5 + glow) + 60 * glow);
      d[o + 3] = 190 + 50 * sw;
      if (((x * 7 + y * 13 + (t >> 2)) % 37) === 0) { d[o] = d[o + 1] = d[o + 2] = 255; }
    }
  };
  G.ichor = t => { const f = new IchorFX(false); t.d.set(f.data); };
  G.ichor_flow = t => { const f = new IchorFX(true); t.d.set(f.data); };
  G.sift_rift = t => { const f = new RiftFX(); t.d.set(f.data); };
  Tex.anims.push({ tile: S.T.ichor, fx: new IchorFX(false) }, { tile: S.T.ichor_flow, fx: new IchorFX(true) }, { tile: S.T.sift_rift, fx: new RiftFX() });

  /* ------------------------------------------------------------ */
  /* Items and recipes                                            */
  /* ------------------------------------------------------------ */
  const ECHO = 600, ECHO_BLADE = 601, CROWN = 602, SOUL_ORB = 603, SEED = 604;
  Sift.ECHO = ECHO; Sift.SOUL_ORB = SOUL_ORB; Sift.SEED = SEED; Sift.CROWN = CROWN;
  I._def(ECHO, 'echo_shard', { display: 'Echo Shard', tab: 'ingredients' });
  Tex.ITEM_ART.echo_shard = [['................', '..........aa....', '.........abba...', '........abccb...', '.......abccba...', '......abccbba...', '.....abccbba....', '....abcbbba.....',
    '...abbbbba......', '..abbbba........', '..abbba.........', '...aaa..........'], { a: hex('#0a3c40'), b: hex('#1f9a94'), c: hex('#7af0e4') }, 2];
  Tex.MAT.echo = { o: [6, 38, 44], d: [18, 126, 134], m: [47, 214, 194], l: [214, 255, 246] };
  if (!Tex.extraToolMats) Tex.extraToolMats = [];
  Tex.extraToolMats.push('echo');
  I._def(ECHO_BLADE, 'echo_sword', { display: 'Echo Blade', maxStack: 1, tool: { type: 'sword', level: 3, speed: 9 }, maxDamage: 1800, attack: 12, icon: 'echo_sword', tab: 'combat' });
  I._def(CROWN, 'monarch_crown', { display: "The Monarch's Crown", maxStack: 1, armor: { slot: 0, points: 4, mat: 'gold' }, maxDamage: 600, tab: 'combat' });
  Tex.ITEM_ART.monarch_crown = [['................', '................', '................', '..a....a....a...', '..ab..aba..ab...', '..abbabcbabb....', '..abbbbbbbbb....',
    '..accbcccbccb...', '..abbbbbbbbb....', '...aaaaaaaaa....'].map(r => r.padEnd(16, '.')), { a: hex('#5a1020'), b: hex('#c02848'), c: hex('#5ff0e0') }, 2];
  I._def(SOUL_ORB, 'soul_orb', { display: 'Soul Orb', hidden: true });
  Tex.ITEM_ART.soul_orb = [['................', '................', '................', '......aaaa......', '.....abccba.....', '....abcddcba....', '....acddddca....', '....acddddca....', '....abcddcba....',
    '.....abccba.....', '......aaaa......'], { a: hex('#106860'), b: hex('#20b0a0'), c: hex('#70f0e0'), d: hex('#e8fffc') }, 2];
  I._def(SEED, 'sentinel_seed', { display: 'Sentinel Seed', hidden: true });
  Tex.ITEM_ART.sentinel_seed = [['................', '................', '................', '................', '......aa........', '.....abba.......', '....abccba......', '....abccba......',
    '.....abba.......', '......aa........'], { a: hex('#601838'), b: hex('#d04080'), c: hex('#ffb0d8') }, 3];
  // the existing armour code needs these
  const crownDef = I.get(CROWN);
  if (crownDef && !crownDef.armor.mat) crownDef.armor.mat = 'gold';

  I._shapeless(['sift_log'], 'sift_planks', 4);
  I._shaped(['#', '#'], { '#': 'sift_planks' }, 'stick', 4);
  I._shaped(['##', '##'], { '#': 'sift_stone' }, 'sift_stone_bricks', 4);
  I._shapeless(['sift_stone_bricks', 'echo_shard'], 'chiseled_sift_stone');
  I._shaped([' E ', 'ESE', ' E '], { E: 'echo_shard', S: 'sift_stone' }, 'soul_block');
  I._shapeless(['echo_shard', 'glass'], 'echo_bulb', 2);
  I._shaped(['E', 'E', 'S'], { E: 'echo_shard', S: 'stick' }, 'echo_sword');
  I._shaped(['##', '##'], { '#': 'sift_planks' }, 'crafting_table');
  // echo shards from the Deep Dark (and the red sculk of the Sift)
  const blockDrops = I.blockDrops;
  I.blockDrops = function (blockId, meta, stack, rng) {
    const out = blockDrops.apply(this, arguments) || [];
    const r = rng ? rng.next() : rnd();
    if (blockId === B.sculk_sensor && r < 0.4) out.push(I.stack(ECHO, 1));
    if (blockId === B.sculk && r < 0.04) out.push(I.stack(ECHO, 1));
    if (blockId === B.red_sculk && r < 0.08) out.push(I.stack(ECHO, 1));
    if (blockId === B.soul_block && r < 0.5) out.push(I.stack(ECHO, 1 + Math.floor(r * 4)));
    return out;
  };
  if (DL.Structures && DL.Structures.LOOT) {
    const L = DL.Structures.LOOT;
    L.ruined.push(['echo_shard', 1, 3, 5], ['crying_obsidian', 2, 6, 5]);
    L.bastion.push(['crying_obsidian', 2, 6, 6], ['echo_shard', 1, 2, 3]);
    L.stronghold.push(['echo_shard', 1, 2, 3]);
    L.sift = [['echo_shard', 2, 6, 12], ['soul_block', 1, 2, 4], ['tidebloom', 1, 3, 6], ['crying_obsidian', 2, 4, 4], ['diamond', 1, 3, 3], ['echo_sword', 1, 1, 1], ['steak', 2, 5, 5], ['golden_apple', 1, 1, 2]];
  }

  /* ------------------------------------------------------------ */
  /* Rifts: a crying obsidian frame, lit with an echo shard       */
  /* ------------------------------------------------------------ */
  const faceOff = (f) => [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][f] || [0, 1, 0];
  const useItem = GP.useItem;
  GP.useItem = function () {
    const p = this.player, t = this.target, held = p && p.held, w = this.world;
    if (held && held.id === ECHO && t && !t.entity && w.getBlock(t.x, t.y, t.z) === B.crying_obsidian && (this.usePressed || this._pgUseEdge)) {
      const [dx, dy, dz] = faceOff(t.face);
      if (DL.lightPortal(w, t.x + dx, t.y + dy, t.z + dz, B.sift_rift)) {
        if (!p.creative) p.consumeHeld(1);
        p.swing(); In.haptic('place');
        A.play('teleport', t.x + 0.5, t.y + 1, t.z + 0.5, 1, 0.7);
        this.spawnParticles('soul', t.x + 0.5, t.y + 1.5, t.z + 0.5, 20, 1.5);
        this.chatMessage('§bThe rift opens onto the Sift...');
        if (DL.Extras && DL.Extras.grant) DL.Extras.grant('rift');
        return;
      }
      this.chatMessage('§7Build a frame of crying obsidian (like a Nether portal), then use the echo shard on it.');
      return;
    }
    return useItem.apply(this, arguments);
  };

  /* ------------------------------------------------------------ */
  /* Rifts in the Overworld: one in every 28x28 chunk region      */
  /* ------------------------------------------------------------ */
  const REGION = 28;
  function riftChunk(seed, rx, rz) {
    const h = S.hash2(seed ^ 0x51f7a11, rx, rz) >>> 0;
    return [rx * REGION + 4 + (h % (REGION - 8)), rz * REGION + 4 + ((h >>> 8) % (REGION - 8))];
  }
  Sift.nearestRift = function (seed, x, z) {
    const rx0 = Math.floor(x / 16 / REGION), rz0 = Math.floor(z / 16 / REGION);
    let best = null, bd = 1e18;
    for (let rx = rx0 - 1; rx <= rx0 + 1; rx++) for (let rz = rz0 - 1; rz <= rz0 + 1; rz++) {
      const [cx, cz] = riftChunk(seed, rx, rz), px = cx * 16 + 16, pz = cz * 16 + 16, d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; best = [px, pz, Math.sqrt(d)]; }
    }
    return best;
  };
  const populate = W.populate;
  W.populate = function (c) {
    const r = populate.apply(this, arguments);
    if ((this.dim || 0) === 0) {
      const rx = Math.floor(c.cx / REGION), rz = Math.floor(c.cz / REGION);
      const [cx, cz] = riftChunk(this.seed, rx, rz);
      if (cx === c.cx && cz === c.cz) { this._popOrigin = c; try { buildOverworldRift(this, c); } finally { this._popOrigin = null; } }
    }
    return r;
  };
  function buildOverworldRift(w, c) {
    const x = c.cx * 16 + 16, z = c.cz * 16 + 16;
    let y = w.topSolidY(x, z);
    if (y < 4 || y > CH - 12) return;
    if (S.LIQUID[w.getBlock(x, y - 1, z)]) y++;
    // a ring of the Sift's stone and red sculk spilling into our world
    for (let dx = -5; dx <= 6; dx++) for (let dz = -4; dz <= 4; dz++) {
      const d = Math.hypot(dx - 0.5, dz) + (S.hash2(w.seed, x + dx, z + dz) & 3) * 0.4;
      if (d > 5) continue;
      const gy = w.topSolidY(x + dx, z + dz) - 1;
      if (gy < 1 || Math.abs(gy - (y - 1)) > 3) continue;
      w.popSet(x + dx, gy, z + dz, d < 2.5 ? B.sift_turf : d < 4 ? B.red_sculk : B.sift_stone, 0);
      if (d > 2 && d < 4.5 && (S.hash2(w.seed + 7, x + dx, z + dz) & 7) === 0) w.popSet(x + dx, gy + 1, z + dz, B.tidebloom, 0);
    }
    // the frame (crying obsidian) and the rift inside, along x
    for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 3; dy++) {
      const frame = dx === -1 || dx === 2 || dy === -1 || dy === 3;
      w.popSet(x + dx, y + dy, z, frame ? B.crying_obsidian : B.sift_rift, 0);
    }
    for (let dx = -2; dx <= 3; dx++) for (const dz of [-1, 1]) for (let dy = 0; dy < 3; dy++) if (SOLID[w.getBlock(x + dx, y + dy, z + dz)]) w.popSet(x + dx, y + dy, z + dz, 0, 0);
  }

  /* ------------------------------------------------------------ */
  /* Populating the Sift                                          */
  /* ------------------------------------------------------------ */
  const MONARCH_REGION = 20;
  function hallChunk(seed, rx, rz) {
    const h = S.hash2(seed ^ 0x6e4a7c1, rx, rz) >>> 0;
    return [rx * MONARCH_REGION + 3 + (h % (MONARCH_REGION - 6)), rz * MONARCH_REGION + 3 + ((h >>> 8) % (MONARCH_REGION - 6))];
  }
  Sift.nearestHall = function (seed, x, z) {
    const rx0 = Math.floor(x / 16 / MONARCH_REGION), rz0 = Math.floor(z / 16 / MONARCH_REGION);
    let best = null, bd = 1e18;
    for (let rx = rx0 - 1; rx <= rx0 + 1; rx++) for (let rz = rz0 - 1; rz <= rz0 + 1; rz++) {
      const [cx, cz] = hallChunk(seed, rx, rz), px = cx * 16 + 16, pz = cz * 16 + 16, d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; best = [px, pz, Math.sqrt(d), rx + ',' + rz]; }
    }
    return best;
  };
  const populateDim = W.populateDim;
  W.populateDim = function (c) {
    if (this.dim !== SIFT) return populateDim.apply(this, arguments);
    const r = this.popRng;
    r.setSeed(S.hash2(this.seed ^ 0x5157 ^ 0x1b873593, c.cx, c.cz));
    this._popOrigin = c;
    try { populateSift(this, c, r); } finally { this._popOrigin = null; }
  };
  const surfaceY = (w, x, z) => { for (let y = CH - 2; y > 12; y--) { const b = w.getBlock(x, y, z); if (b && b !== B.ichor && SOLID[b]) return y; } return -1; };
  function populateSift(w, c, r) {
    const bx = c.cx * 16, bz = c.cz * 16;
    const rx = () => bx + 8 + r.nextInt(16), rz = () => bz + 8 + r.nextInt(16);
    const bioAt = (x, z) => w.gen.siftBiome(x, z);
    const set = (x, y, z, id, m) => w.popSet(x, y, z, id, m || 0);
    const bio = bioAt(bx + 16, bz + 16);
    // the Monarch's hall
    const [hx, hz] = hallChunk(w.seed, Math.floor(c.cx / MONARCH_REGION), Math.floor(c.cz / MONARCH_REGION));
    if (hx === c.cx && hz === c.cz) buildHall(w, c, r);
    // flora on the meadows and dens
    const flowers = (n, id, soils) => {
      for (let i = 0; i < n; i++) {
        const x = rx(), z = rz(), y = surfaceY(w, x, z);
        if (y < 0 || !soils.includes(w.getBlock(x, y, z)) || w.getBlock(x, y + 1, z) !== 0) continue;
        set(x, y + 1, z, id);
      }
    };
    if (bio === 0 || bio === 3) {
      const trees = bio === 0 ? 1 + r.nextInt(3) : r.nextInt(2);
      for (let i = 0; i < trees; i++) { const x = rx(), z = rz(), y = surfaceY(w, x, z); if (y > 0 && w.getBlock(x, y, z) === B.sift_turf) siftTree(w, r, x, y + 1, z); }
      flowers(24, B.sift_grass, [B.sift_turf]);
      flowers(6, B.tidebloom, [B.sift_turf]);
      flowers(4, B.singing_bell, [B.sift_turf]);
      // red sculk around singer stones
      if (r.nextInt(2) === 0) {
        const x = rx(), z = rz(), y0 = surfaceY(w, x, z), rr = 2 + r.nextInt(3);
        if (y0 > 0) for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
          if (dx * dx + dz * dz > rr * rr + r.nextInt(3)) continue;
          const y = surfaceY(w, x + dx, z + dz);
          if (y > 0 && Math.abs(y - y0) < 3 && w.getBlock(x + dx, y, z + dz) === B.sift_turf) { set(x + dx, y, z + dz, B.red_sculk); if (w.getBlock(x + dx, y + 1, z + dz) === B.sift_grass) set(x + dx, y + 1, z + dz, 0); }
        }
        if (y0 > 0 && r.nextInt(3) === 0) { for (let k = 1; k <= 3 + r.nextInt(3); k++) set(x, y0 + k, z, B.chiseled_sift_stone); set(x, y0 + 7, z, B.echo_bulb); }
      }
      // ichor pools
      if (r.nextInt(3) === 0) ichorPool(w, r, rx(), rz());
    }
    if (bio === 1) {
      // the Carapace: blue walls...
      if (r.nextInt(2) === 0) {
        const x = rx(), z = rz(), y = surfaceY(w, x, z);
        if (y > 0) {
          const along = r.nextInt(2), len = 4 + r.nextInt(8), h = 3 + r.nextInt(5);
          let ox = 0, oz = 0;
          for (let i = 0; i < len; i++) {
            const wx = x + (along ? i : ox), wz = z + (along ? oz : i), gy = surfaceY(w, wx, wz);
            if (gy < 0) break;
            const hh = h - (i === 0 || i === len - 1 ? 1 : 0) + (r.nextInt(3) === 0 ? 1 : 0);
            for (let k = 0; k < hh; k++) set(wx, gy + 1 + k, wz, B.carapace_wall);
            if (r.nextInt(4) === 0) { if (along) oz += r.nextInt(2) * 2 - 1; else ox += r.nextInt(2) * 2 - 1; }
          }
        }
      }
      // ...and giant hollow fossils
      if (r.nextInt(6) === 0) fossil(w, r, rx(), rz());
      flowers(3, B.drift_crystal, [B.carapace_sand, B.carapace_rock]);
      flowers(5, B.sift_grass, [B.carapace_sand]);
    }
    if (bio === 2) {
      flowers(4, B.drift_crystal, [B.lullaby_moss]);
      flowers(6, B.sift_grass, [B.lullaby_moss]);
      if (r.nextInt(3) === 0) { const x = rx(), z = rz(), y = surfaceY(w, x, z); if (y > 0 && w.getBlock(x, y, z) === B.lullaby_moss) { const h = 3 + r.nextInt(4); for (let k = 1; k <= h; k++) set(x + (k > 3 ? 1 : 0), y + k, z, B.sift_log); } }
      if (r.nextInt(14) === 0) shrine(w, r, rx(), rz());
    }
    if (bio === 3) {
      // echo dens: red sculk carpets, embedded soul blocks and hanging bulbs inside hollow islands
      for (let i = 0; i < 40; i++) {
        const x = rx(), z = rz(), y = 26 + r.nextInt(80);
        if (w.getBlock(x, y, z) !== 0 || w.getSky(x, y, z) > 6) continue;
        const below = w.getBlock(x, y - 1, z), above = w.getBlock(x, y + 1, z);
        if (below === B.sift_stone) set(x, y - 1, z, B.red_sculk);
        else if (above === B.sift_stone && r.nextInt(4) === 0) set(x, y, z, B.echo_bulb);
        if (r.nextInt(10) === 0) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.getBlock(x + dx, y, z + dz) === B.sift_stone) { set(x + dx, y, z + dz, B.soul_block); break; }
      }
      flowers(3, B.tidebloom, [B.red_sculk, B.sift_turf]);
    }
  }
  function siftTree(w, r, x, y, z) {
    const h = 4 + r.nextInt(4);
    if (y + h + 4 >= CH) return;
    // a leaning, curling trunk
    let tx = x, tz = z;
    const lean = [[1, 0], [-1, 0], [0, 1], [0, -1]][r.nextInt(4)];
    for (let k = 0; k < h; k++) {
      if (k > h / 2 && r.nextInt(3) === 0) { tx += lean[0]; tz += lean[1]; }
      if (w.getBlock(tx, y + k, tz) === 0 || w.getBlock(tx, y + k, tz) === B.sift_grass) w.popSet(tx, y + k, tz, B.sift_log, 0);
    }
    // a wide pink canopy, flat on top like a parasol, with glowing drips
    const cy = y + h;
    for (let dy = -1; dy <= 1; dy++) {
      const rad = dy === 1 ? 2 : dy === 0 ? 3 + r.nextInt(2) : 2;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (dx * dx + dz * dz > rad * rad + 1) continue;
        if (w.getBlock(tx + dx, cy + dy, tz + dz) === 0) w.popSet(tx + dx, cy + dy, tz + dz, B.sift_leaves, 0);
      }
    }
    for (let k = 0; k < 4; k++) {
      const dx = r.nextInt(7) - 3, dz = r.nextInt(7) - 3;
      if (w.getBlock(tx + dx, cy - 2, tz + dz) === 0 && w.getBlock(tx + dx, cy - 1, tz + dz) === B.sift_leaves) w.popSet(tx + dx, cy - 2, tz + dz, B.echo_bulb, 0);
    }
  }
  function ichorPool(w, r, x, z) {
    const y = surfaceY(w, x, z);
    if (y < 20) return;
    const rad = 2 + r.nextInt(2);
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (dx * dx + dz * dz > rad * rad) continue;
      if (surfaceY(w, x + dx, z + dz) !== y) return; // only on flat ground
    }
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      const d = dx * dx + dz * dz;
      if (d > rad * rad) continue;
      w.popSet(x + dx, y + 1, z + dz, 0, 0);
      w.popSet(x + dx, y, z + dz, B.ichor, 0);
      if (d < (rad - 1) * (rad - 1)) w.popSet(x + dx, y - 1, z + dz, B.ichor, 0);
    }
    for (let dx = -rad - 1; dx <= rad + 1; dx++) for (let dz = -rad - 1; dz <= rad + 1; dz++) {
      const d = dx * dx + dz * dz;
      if (d > rad * rad && d <= (rad + 1) * (rad + 1) && w.getBlock(x + dx, y, z + dz) === B.sift_turf) w.popSet(x + dx, y, z + dz, B.red_sculk, 0);
    }
  }
  function fossil(w, r, x, z) {
    const y = surfaceY(w, x, z);
    if (y < 20) return;
    const along = r.nextInt(2), len = 10 + r.nextInt(8), rad = 3 + r.nextInt(2), sink = r.nextInt(2);
    for (let i = 0; i < len; i++) {
      const sx = x + (along ? i - (len >> 1) : 0), sz = z + (along ? 0 : i - (len >> 1));
      const gy = y - sink;
      // the spine
      w.popSet(sx, gy + rad, sz, B.fossil_block, 0);
      if (i % 2 === 0) {
        // a rib: half circles on both sides, open underneath
        for (let a = 0; a <= 12; a++) {
          const ang = Math.PI * a / 12, ox = Math.round(Math.cos(ang) * rad), oy = Math.round(Math.sin(ang) * rad);
          const px = along ? sx : sx + ox, pz = along ? sz + ox : sz;
          w.popSet(px, gy + oy, pz, B.fossil_block, 0);
        }
      }
    }
    // a skull at one end
    const ex = x + (along ? (len >> 1) + 1 : 0), ez = z + (along ? 0 : (len >> 1) + 1);
    for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 2; dy++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) + Math.abs(dy - 1) + Math.abs(dz) < 3) w.popSet(ex + dx, y + rad - 1 + dy, ez + dz, (dx === 0 && dz === 0 && dy === 1) ? B.soul_block : B.fossil_block, 0);
  }
  function shrine(w, r, x, z) {
    const y = surfaceY(w, x, z);
    if (y < 20) return;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      w.popSet(x + dx, y, z + dz, Math.abs(dx) === 2 || Math.abs(dz) === 2 ? B.sift_stone_bricks : B.chiseled_sift_stone, 0);
      for (let k = 1; k < 5; k++) w.popSet(x + dx, y + k, z + dz, 0, 0);
    }
    w.popSet(x, y + 1, z, B.soul_block, 0);
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { w.popSet(x + dx, y + 1, z + dz, B.sift_stone_bricks, 0); w.popSet(x + dx, y + 2, z + dz, B.echo_bulb, 0); }
    // a little reward
    w.popSet(x, y + 1, z + 2, 0, 0);
    chest(w, r, x + 1, y + 1, z, 'sift');
  }
  function chest(w, r, x, y, z, table) {
    const o = w._popOrigin, dcx = (x >> 4) - o.cx, dcz = (z >> 4) - o.cz;
    if (dcx < 0 || dcx > 1 || dcz < 0 || dcz > 1) return;
    w.popSet(x, y, z, B.chest, r.nextInt(4));
    const items = new Array(27).fill(null);
    const St = DL.Structures;
    for (let k = 0; k < 7; k++) { const s = St.rollLoot(table, r); if (s) items[r.nextInt(27)] = s; }
    w.setTile(x, y, z, { type: 'chest', items });
  }
  function buildHall(w, c, r) {
    const x = c.cx * 16 + 16, z = c.cz * 16 + 16;
    let y = surfaceY(w, x, z);
    if (y < 24) { y = 70; }
    const R0 = 6;
    // floor platform (it may float on its own)
    for (let dx = -R0; dx <= R0; dx++) for (let dz = -R0; dz <= R0; dz++) {
      w.popSet(x + dx, y, z + dz, (dx + dz) % 4 === 0 ? B.chiseled_sift_stone : B.sift_stone_bricks, 0);
      for (let k = 1; k < 9; k++) w.popSet(x + dx, y + k, z + dz, 0, 0);
      for (let k = 1; k < 4; k++) if (w.getBlock(x + dx, y - k, z + dz) === 0 && Math.abs(dx) + Math.abs(dz) < R0 * 2 - k * 2) w.popSet(x + dx, y - k, z + dz, B.sift_stone, 0);
    }
    // columns, arches and a roof ring
    for (let dx = -R0; dx <= R0; dx += 4) for (const dz of [-R0, R0]) for (let k = 1; k < 8; k++) { w.popSet(x + dx, y + k, z + dz, k === 7 ? B.echo_bulb : B.sift_stone_bricks, 0); w.popSet(x + dz, y + k, z + dx, k === 7 ? B.echo_bulb : B.sift_stone_bricks, 0); }
    for (let d = -R0; d <= R0; d++) for (const e of [-R0, R0]) { w.popSet(x + d, y + 8, z + e, B.sift_stone_bricks, 0); w.popSet(x + e, y + 8, z + d, B.sift_stone_bricks, 0); }
    // the throne of red sculk and souls
    for (let dx = -1; dx <= 1; dx++) { w.popSet(x + dx, y + 1, z - R0 + 1, B.red_sculk, 0); w.popSet(x + dx, y + 1, z - R0 + 2, B.red_sculk, 0); }
    w.popSet(x, y + 2, z - R0 + 1, B.soul_block, 0); w.popSet(x - 1, y + 3, z - R0 + 1, B.soul_block, 0); w.popSet(x + 1, y + 3, z - R0 + 1, B.soul_block, 0); w.popSet(x, y + 4, z - R0 + 1, B.chiseled_sift_stone, 0);
    // carpets of red sculk leading in
    for (let k = -R0 + 3; k <= R0; k++) w.popSet(x, y, z + k, B.red_sculk, 0);
    chest(w, r, x - 3, y + 1, z - R0 + 1, 'sift');
    chest(w, r, x + 3, y + 1, z - R0 + 1, 'sift');
  }

  /* ------------------------------------------------------------ */
  /* Sky, light and ambience                                      */
  /* ------------------------------------------------------------ */
  const skySub = W.skySubtracted;
  W.skySubtracted = function (partial) { if (this.dim === SIFT) return 1.5; return skySub.apply(this, arguments); };
  const computeSky = RP.computeSky;
  RP.computeSky = function (world, pt, lookDir, rd) {
    if (world.dim !== SIFT) return computeSky.apply(this, arguments);
    const t = (world.time + pt) / 2400;
    const k = 0.5 + 0.5 * Math.sin(t);
    const tide = Sift.tide(world);
    const tint = tide === 'Endure' ? [0.75, 0.42, 0.62] : tide === 'Thrive' ? [0.52, 0.95, 0.86] : null;
    let sky = mix([0.96, 0.52, 0.78], [0.32, 0.78, 0.9], k);
    if (tint) sky = mix(sky, tint, 0.35);
    this.skyColor = sky;
    this.fogColor = mix(sky, [0.98, 0.78, 0.9], 0.25);
    this.sunrise = null; this.starBright = 0.35; this.celestial = 0;
  };
  const renderSky = RP.renderSky;
  RP.renderSky = function (world, pt) {
    if (world.dim !== SIFT) return renderSky.apply(this, arguments);
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    M4.multiply(this.mvp, this.proj, this.view);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    this.begin();
    const v = this.starVerts;
    void v;
    // the two pale moons of the Sift
    const moon = (ax, ay, size, c) => {
      const d = 100, cx = Math.cos(ay) * Math.cos(ax) * d, cy = Math.sin(ay) * d, cz = Math.cos(ay) * Math.sin(ax) * d;
      const ux = -Math.sin(ax), uz = Math.cos(ax);
      const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [a, b] of q) this.vtx(cx + ux * a * size, cy + b * size, cz + uz * a * size, 0, 0, c[0], c[1], c[2], 1);
    };
    const tt = (world.time + pt) / 6000;
    moon(tt, 0.7, 9, [0.35, 0.18, 0.28]); moon(tt * 1.7 + 2, 0.45, 5, [0.12, 0.3, 0.28]);
    this.flush('quads', { mvp: this.mvp });
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.enable(gl.CULL_FACE);
  };

  const renderClouds = RP.renderClouds;
  RP.renderClouds = function (world) { if (world.dim === SIFT) return; return renderClouds.apply(this, arguments); };
  const BIOME_NAMES = ["Singer's Meadow", 'The Carapace', 'Lullaby Hills', 'Echo Den'];
  const biomeNameAt = DL.biomeNameAt;
  DL.biomeNameAt = function (w, x, y, z) {
    if (w && w.dim === SIFT && w.gen && w.gen.siftBiome) return BIOME_NAMES[w.gen.siftBiome(x, z)] || 'The Sift';
    return biomeNameAt ? biomeNameAt.apply(this, arguments) : '';
  };

  /* ------------------------------------------------------------ */
  /* The Sift Tides: Flow, Thrive and Endure                      */
  /* ------------------------------------------------------------ */
  const TIDES = ['Flow', 'Thrive', 'Flow', 'Endure'];
  const TIDE_LEN = 6000;
  Sift.tide = function (world) {
    if (!world || world.dim !== SIFT) return null;
    if (world.remoteTide) return world.remoteTide;
    const n = Math.floor((world.totalTicks || 0) / TIDE_LEN);
    return TIDES[(S.hash2(world.seed ^ 0x71de, n, 3) >>> 0) % TIDES.length];
  };
  const TIDE_INFO = { Flow: ['§b', 'The tide flows: all is calm.'], Thrive: ['§a', 'The tide thrives: you heal and work faster.'], Endure: ['§c', 'The tide endures: the Sift\'s creatures grow fierce, and nothing heals by itself.'] };
  // Thrive: faster mining; Endure: no natural healing
  const breakRate = I.breakRate;
  I.breakRate = function () { const r = breakRate.apply(this, arguments); const g = DL.game; return g && g.world && Sift.tide(g.world) === 'Thrive' ? r * 1.35 : r; };

  /* ------------------------------------------------------------ */
  /* Ichor: soul fire and drained souls                           */
  /* ------------------------------------------------------------ */
  function inIchor(e) {
    const w = e.world, b = e.box;
    for (let y = Math.floor(b[1] + 0.05); y <= Math.floor(b[4] - 0.05); y++)
      for (let x = Math.floor(b[0] + 0.05); x <= Math.floor(b[3] - 0.05); x++)
        for (let z = Math.floor(b[2] + 0.05); z <= Math.floor(b[5] - 0.05); z++) if (w.getBlock(x, y, z) === B.ichor) return true;
    return false;
  }
  Sift.inIchor = inIchor;
  function ichorTouch(g, e) {
    const native = e.def && e.def.sift;
    // thick: slows you down, and you can swim up slowly
    e.vx *= 0.55; e.vz *= 0.55; if (e.vy < -0.08) e.vy = -0.08;
    if (e.jumping || (e.isPlayer && g.jumpHeld)) e.vy = Math.min(0.12, e.vy + 0.05);
    e.fallDistance = 0;
    if (native) return;
    e.fire = Math.max(e.fire || 0, 80); e.soulFire = 80;
    if ((e.age || 0) % 10 === 0) e.damage('ichor', 2);
    if (e.isPlayer && e.exhaust) e.exhaust(0.25);
    if ((e.age || 0) % 6 === 0) g.spawnParticles('ichor', e.x, e.y + 0.5, e.z, 3, 0.6);
    if ((e.age || 0) % 25 === 0) A.play('fizz', e.x, e.y, e.z, 0.5, 1.6);
  }
  const tick = GP.tick;
  GP.tick = function () {
    tick.apply(this, arguments);
    const w = this.world, p = this.player;
    if (!this.inGame || !w || !p) return;
    if (GUI.screen && GUI.screen.pauses && !(N && N.active && N.active())) return;
    // your own body (also for guests)
    if (p.health > 0 && inIchor(p)) ichorTouch(this, p);
    if (w.dim !== SIFT) { p.noNaturalRegen = false; return; }
    if (!this._siftWelcomed) { this._siftWelcomed = true; if (DL.Extras && DL.Extras.grant) DL.Extras.grant('sift'); }
    // the host looks after the creatures
    if (!isGuest()) for (const e of w.entities) if (e !== p && e.living && !e.isRemote && e.health > 0 && !e.removed && e.dist2(p.x, p.y, p.z) < 64 * 64 && inIchor(e)) ichorTouch(this, e);
    // tides
    const tide = Sift.tide(w);
    if (tide !== this._tide) {
      if (this._tide !== undefined && tide) { const [c, m] = TIDE_INFO[tide]; this.chatMessage(c + m); A.play('portal', null, null, null, 0.5, tide === 'Endure' ? 0.6 : 1.4); if (GUI.notice) GUI.notice('Sift Tide: ' + tide); }
      this._tide = tide;
    }
    if (tide === 'Thrive' && this.tickCount % 50 === 0 && p.health > 0 && p.health < 20) p.heal(1);
    p.noNaturalRegen = tide === 'Endure';
    // souls drift up everywhere
    if (this.tickCount % 3 === 0) {
      const x = p.x + (rnd() - 0.5) * 24, y = p.y + (rnd() - 0.3) * 12, z = p.z + (rnd() - 0.5) * 24;
      if (w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === 0) this.spawnParticles('soul', x, y, z, 1, 0);
    }
    // the Monarch waits in its hall
    if (!isGuest() && this.tickCount % 40 === 0 && DL.SiftMobs) DL.SiftMobs.hallTick(this, w, p);
  };
  // the tide on the HUD, and a pink haze in the rift
  const extras = GUI.drawHUDExtras;
  GUI.drawHUDExtras = function (game, Wd, H, hy) {
    const w = game.world, p = game.player;
    const tide = Sift.tide(w);
    if (tide && p && !game.hideGui) {
      const c = tide === 'Endure' ? '#FF7090' : tide === 'Thrive' ? '#70FFB0' : '#90E8FF';
      const label = 'Tide: ' + tide, x = 3 + (GUI.safe ? GUI.safe.l : 0), y = 3 + (GUI.safe ? GUI.safe.t : 0) + (game.debug ? 70 : 0);
      GUI.rect(x - 1, y - 1, DL.Font.width(label) + 4, 11, 'rgba(0,0,0,0.35)');
      GUI.text(label, x + 1, y + 1, c);
    }
    if (p && p.soulFire > 0) { p.soulFire--; GUI.rect(0, 0, Wd, H, 'rgba(60,240,220,' + Math.min(0.18, p.soulFire / 400).toFixed(3) + ')'); }
    return extras.apply(this, arguments);
  };
  // /locate rift (Overworld) and /locate monarch (the Sift)
  const command = GP.command;
  GP.command = function (line) {
    const args = line.split(/\s+/), cmd = (args[0] || '').toLowerCase(), what = (args[1] || '').toLowerCase().replace(/^minecraft:/, '');
    const w = this.world, p = this.player;
    if (cmd === 'locate' && (what === 'rift' || what === 'sift_rift') && w) {
      if ((w.dim || 0) !== 0) { this.chatMessage('§cRifts to the Sift are found in the Overworld.'); return; }
      const r = Sift.nearestRift(w.seed, p.x, p.z);
      this.chatMessage('The nearest rift to the Sift is at ' + r[0] + ', ' + r[1] + ' (' + Math.round(r[2]) + ' blocks away)');
      return;
    }
    if (cmd === 'locate' && (what === 'monarch' || what === 'hall' || what === 'monarch_hall') && w) {
      if (w.dim !== SIFT) { this.chatMessage('§cThe Monarch rules in the Sift.'); return; }
      const r = Sift.nearestHall(w.seed, p.x, p.z);
      this.chatMessage("The Monarch's hall is at " + r[0] + ', ' + r[1] + ' (' + Math.round(r[2]) + ' blocks away)');
      return;
    }
    if (cmd === 'tide' && w && w.dim === SIFT) { this.chatMessage('§bThe Sift Tide is ' + Sift.tide(w) + '.'); return; }
    return command.apply(this, arguments);
  };
  // achievements
  if (DL.Extras && DL.Extras.ACH) {
    DL.Extras.ACH.push(['rift', 'Rift Walker', 'Open a rift with an echo shard', ECHO], ['sift', 'Teeming with Souls', 'Enter the Sift', B.tidebloom], ['monarch', 'Long Live the Monarch', 'Defeat the Monarch of the Sift', CROWN]);
  }
})();
