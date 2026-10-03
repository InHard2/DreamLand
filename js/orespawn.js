/*
 * DreamLand - OreSpawn (the classic mod by TheyCallMeDanger), rebuilt for DreamLand.
 * This file: the ores and gems (ruby, amethyst, uranium, titanium, salt, pink
 * tourmaline, tiger's eye), the Ultimate, Emerald, Ruby, Amethyst and Crystal tools,
 * fourteen sets of armour (with the Royal and Peacock glide), the legendary weapons
 * (Big Bertha, Slice, the Royal Guardian Sword, the Attitude Adjuster, the Queen
 * Scale Battle Axe, the Chainsaw, the Ultimate Bow, the Ray Gun, the Squidzooka,
 * the Thunder Staff...), the crops and the foods (strawberries, corn, tomatoes,
 * lettuce, radishes, rice, quinoa, pizza, BLTs, crabby patties, popcorn...), apple
 * and experience trees, ant hills and all the recipes.
 * Textures are drawn by code; nothing is copied from the mod.
 * Creatures: orespawn_mobs.js. Dimensions: orespawn_dims.js.
 */
(function () {
  'use strict';
  const DL = window.DL;
  const S = DL.S, B = S.B, I = DL.Items, Tex = DL.Tex, G = Tex.G, M = DL.Models, A = DL.Audio, E = DL.Entities, St = DL.Structures;
  const GP = DL.Game.prototype, W = DL.World.prototype;
  const K = Tex.kit;
  const { hex, P, mix, mul, pick, surface, specks, planks, bark, rings, bevel } = K;
  const OS = DL.OreSpawn = { items: {} };
  const def = (id, name, o) => { const d = I._def(id, name, o); OS.items[name] = id; return d; };
  const id = (n) => (I.byName[n] ? I.byName[n].id : 0);
  const titleCase = I._titleCase;

  /* ------------------------------------------------------------ */
  /* Block textures                                               */
  /* ------------------------------------------------------------ */
  const oreSpots = (t) => { const s = []; for (let k = 0; k < 5; k++) s.push([1 + t.ri(12), 1 + t.ri(12), t.ri(6)]); return s; };
  const gemOre = (base, pal, n) => (t) => {
    base(t);
    for (let k = 0; k < (n || 6); k++) {
      const x = 1 + t.ri(13), y = 1 + t.ri(13);
      // a little faceted crystal: dark rim, body, highlight
      t.set(x, y, pal[1]); t.set(x + 1, y, pal[2]); t.set(x, y + 1, pal[0]); t.set(x + 1, y + 1, pal[1]);
      if (t.rand() < 0.5) { t.set(x + 1, y - 1, pal[3]); t.set(x + 2, y, pal[1]); }
    }
  };
  G.ruby_ore = gemOre(G.stone, P('#5a0812 #b0102a #f02848 #ffb0c0'));
  G.amethyst_ore = gemOre(G.stone, P('#3c1460 #7a30b8 #b070f0 #f0d0ff'));
  G.uranium_ore = gemOre(G.stone, P('#1e4a10 #3c9a1c #7af03a #e0ffb0'), 7);
  G.titanium_ore = gemOre(G.stone, P('#3a4048 #8a96a4 #c8d4e0 #ffffff'), 7);
  G.salt_ore = t => { G.stone(t); specks(t, [[hex('#ffffff'), 0.08], [hex('#e8eef4'), 0.06]]); };
  const gemBlock = (pal) => (t) => {
    surface(t, [pal[1], pal[2], pal[2], pal[3]], { cells: [4, 2], grain: 0.15 });
    // cut-gem facets
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (Math.round(d) % 5 === 0) t.set(x, y, pal[x < y ? 1 : 3]);
    }
    bevel(t, pal[4], pal[0], 0);
  };
  G.ruby_block = gemBlock(P('#4a0410 #a01028 #d8203c #f05870 #ffd0d8'));
  G.amethyst_block = gemBlock(P('#2c0c48 #6a2aa0 #9a54d8 #c088f8 #f4e4ff'));
  G.uranium_block = t => {
    surface(t, P('#2a7a10 #3caa18 #5ad428 #8af050'), { cells: [4, 2], grain: 0.2 });
    // the radiation sign
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (d < 1.6 || (d > 2.6 && d < 6 && Math.cos(a * 3 + 1.57) > 0.3)) t.set(x, y, hex('#183008'));
    }
    bevel(t, hex('#c8ff90'), hex('#184a08'), 0);
  };
  G.titanium_block = t => {
    surface(t, P('#8894a0 #a4b0bc #b8c4d0 #ccd6e0'), { cells: [8, 4], grain: 0.12 });
    for (const k of [0, 5, 10, 15]) for (let i = 0; i < 16; i++) { t.set(i, k, hex('#6a7480')); }
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13], [7, 7]]) { t.set(x, y, hex('#ffffff')); t.set(x + 1, y + 1, hex('#5a6470')); }
    bevel(t, hex('#eef4fa'), hex('#4a545e'), 0);
  };
  const CRYST = P('#b8a0e8 #c8b4f0 #d8c8f8 #e8dcff #f6f0ff');
  G.crystal_stone = t => {
    surface(t, CRYST, { cells: [4, 2, 1], weights: [0.4, 0.35, 0.25], grain: 0.25 });
    for (let k = 0; k < 5; k++) { const x = t.ri(14), y = t.ri(14); t.set(x, y, hex('#ffffff')); t.set(x + 1, y + 1, hex('#9a80d0')); }
  };
  const CGRASS = P('#4ad8c8 #5ae4d4 #6aeedd #80f6e8 #a0fff4');
  G.crystal_grass_top = t => { surface(t, CGRASS, { cells: [8, 4, 2], grain: 0.4 }); specks(t, [[hex('#ff9ce0'), 0.02], [hex('#ffffff'), 0.02]]); };
  G.crystal_grass_side = t => {
    G.crystal_stone(t);
    for (let x = 0; x < 16; x++) { const n = 3 + (t.rand() < 0.5 ? 1 : 0) + (t.rand() < 0.2 ? 1 : 0); for (let y = 0; y < n; y++) t.set(x, y, pick(CGRASS, t.rand() * 0.8 + 0.1)); }
  };
  G.crystal_planks = t => planks(t, { dark: hex('#7a9ae0'), mid: hex('#9ab8f4'), light: hex('#bcd4ff'), gap: hex('#5a74b8') });
  G.crystal_log_side = t => bark(t, { dark: hex('#6a58b8'), mid: hex('#8a78d8'), light: hex('#b0a0f4'), cracks: 3 });
  G.crystal_log_top = t => rings(t, { bark: hex('#8a78d8'), barkDark: hex('#6a58b8'), light: hex('#c8e8ff'), mid: hex('#9ac8f8'), dark: hex('#6a98d8') });
  const leafy = (pal, extra) => (t) => {
    const f = K.norm(K.fbm(t, [4, 2], [0.6, 0.4]));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = f[y * 16 + x] * 0.55 + t.rand() * 0.45;
      if (v < 0.16) { t.set(x, y, [0, 0, 0], 0); continue; }
      t.set(x, y, pick(pal, (v - 0.16) / 0.84));
    }
    if (extra) extra(t);
  };
  G.crystal_leaves = leafy(P('#c040a0 #d858b8 #ec74cc #f894dc #ffb8ec'), (t) => { for (let k = 0; k < 6; k++) { const x = t.ri(16), y = t.ri(16); if (t.alpha(x, y)) t.set(x, y, hex('#80f0ff')); } });
  G.apple_leaves = leafy(P('#2a6a18 #347a1e #3e8c24 #4a9c2c #5aae36'), (t) => { for (const [x, y] of [[3, 4], [11, 3], [7, 10], [13, 12], [2, 13]]) { t.set(x, y, hex('#d81818')); t.set(x + 1, y, hex('#f03030')); t.set(x, y + 1, hex('#a00808')); t.set(x + 1, y + 1, hex('#d81818')); t.set(x + 1, y - 1, hex('#4a2a10')); } });
  G.experience_leaves = leafy(P('#3a8a10 #4aa018 #5ab820 #78d030 #a0e848'), (t) => { for (let k = 0; k < 8; k++) { const x = t.ri(15), y = t.ri(15); t.set(x, y, hex('#e8ff40')); t.set(x + 1, y, hex('#a8f028')); } });
  G.scary_leaves = leafy(P('#1a0a0a #2a1010 #3a1414 #4a1a18 #5a2420'), (t) => { for (let k = 0; k < 4; k++) { const x = t.ri(15), y = t.ri(15); t.set(x, y, hex('#ff2020')); } });
  G.crystal_flower = t => { t.clear(); t.art(['................', '.......a........', '......aba.......', '...a..aba..a....', '..aba..a..aba...', '..aba..g..aba...', '...a...g...a....', '...g...g...g....', '....g..g..g.....', '.....g.g.g......', '......ggg.......', '.......g........', '.......g........', '......ggg.......', '................', '................'], { a: hex('#80e8ff'), b: hex('#ffffff'), g: hex('#c070e0') }); };
  G.crystal_torch = t => { t.clear(); t.art(['................', '.......a........', '......aba.......', '......aba...a...', '..a...aba..aba..', '.aba..aba..aba..', '.aba.abbba.aba..', '.abbaabbbaabba..', '.abbbabbbabbba..', '..abbbbbbbbba...', '...cccccccc.....', '...cddddddc.....', '....cccccc......', '................', '................', '................'], { a: hex('#60c8ff'), b: hex('#e0fcff'), c: hex('#8a78d8'), d: hex('#b0a0f4') }); };
  const gemCrystal = (pal) => (t) => {
    G.crystal_stone(t);
    for (let k = 0; k < 5; k++) { const x = 1 + t.ri(12), y = 2 + t.ri(11); for (let j = 0; j < 3; j++) { t.set(x + 1, y - j, pal[j === 2 ? 2 : 1]); t.set(x, y - j + 1, pal[0]); } t.set(x + 1, y - 3, pal[3]); }
  };
  G.pink_tourmaline_ore = gemCrystal(P('#a01060 #e03890 #ff78c0 #ffe0f0'));
  G.tigers_eye_ore = gemCrystal(P('#5a3008 #b07018 #e8b040 #fff0b0'));
  G.pink_tourmaline_block = gemBlock(P('#801048 #c02880 #f050a8 #ff88cc #ffe0f2'));
  G.tigers_eye_block = t => {
    surface(t, P('#6a3a08 #9a5a10 #c8841c #e0a838'), { cells: [8, 4], grain: 0.2 });
    for (let y = 0; y < 16; y++) { const k = Math.sin(y * 0.9) * 2; for (let x = 0; x < 16; x++) if (Math.abs(((x + k + y * 0.3) % 5) - 2.5) < 0.6) t.set(x, y, hex('#f8d870')); }
    bevel(t, hex('#ffe8a0'), hex('#4a2804'), 0);
  };
  G.ant_hill_top = t => {
    surface(t, P('#5a3a1c #6e4826 #84582e #98683a'), { cells: [4, 2], grain: 0.5 });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 2.2) t.set(x, y, hex(d < 1.2 ? '#0e0804' : '#2a1a0c')); }
    for (let k = 0; k < 6; k++) t.set(t.ri(16), t.ri(16), hex('#1a0e06'));
  };
  G.ant_hill_side = t => { surface(t, P('#5a3a1c #6e4826 #84582e #98683a'), { cells: [4, 2], grain: 0.5 }); for (let k = 0; k < 8; k++) t.set(t.ri(16), t.ri(16), hex('#24160a')); };
  G.mobzilla_scale_block = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = y >> 2, ox = (row % 2) * 2, sx = (x + ox) % 4, sy = y % 4;
      t.set(x, y, hex(sy === 3 || sx === 0 ? '#1a2a18' : sy === 0 ? '#5a7a4a' : (t.rand() < 0.2 ? '#2e4426' : '#3e5a34')));
    }
  };
  // crops: four growth stages each
  const cropArt = (stem, fruit, kind) => (k) => (t) => {
    t.clear();
    const S2 = hex(stem), F = hex(fruit), FL = mix(hex(fruit), [255, 255, 255], 0.35);
    const h = [5, 9, 12, 14][k];
    for (const cx of [3, 8, 12]) {
      for (let y = 15; y > 15 - h; y--) t.set(cx + ((15 - y) % 4 === 2 ? 1 : 0), y, S2);
      if (k >= 1) for (let y = 15 - h + 2; y < 15; y += 3) { t.set(cx - 1, y, S2); t.set(cx + 2, y - 1, S2); }
      if (k === 3) {
        if (kind === 'berry') { t.set(cx - 1, 15 - h + 4, F); t.set(cx + 2, 15 - h + 6, F); t.set(cx + 2, 15 - h + 7, FL); }
        else if (kind === 'cob') { for (let y = 15 - h + 2; y < 15 - h + 7; y++) { t.set(cx + 1, y, F); t.set(cx + 2, y, FL); } }
        else if (kind === 'head') { for (let dx = -2; dx <= 2; dx++) for (let dy = 0; dy < 3; dy++) if (Math.abs(dx) + dy < 4) t.set(cx + dx, 15 - dy - 1, dy === 2 ? FL : F); }
        else if (kind === 'root') { t.set(cx, 14, F); t.set(cx + 1, 14, F); t.set(cx, 15, FL); }
        else if (kind === 'grain') { for (let y = 15 - h; y < 15 - h + 4; y++) { t.set(cx, y, F); if (y % 2) t.set(cx + 1, y, FL); } }
      }
    }
  };
  const CROPS = { strawberry: ['#3a8a28', '#e01830', 'berry'], tomato: ['#3a7a20', '#e83018', 'berry'], corn: ['#5a9a2a', '#f0d030', 'cob'], lettuce: ['#5ab030', '#90e050', 'head'],
    radish: ['#4a9a30', '#e04870', 'root'], rice: ['#7ab040', '#f0ecd0', 'grain'], quinoa: ['#8a9a30', '#d87830', 'grain'] };
  for (const n in CROPS) { const f = cropArt(...CROPS[n]); for (let k = 0; k < 4; k++) G[n + '_' + k] = f(k); }

  /* ------------------------------------------------------------ */
  /* Item icons painted by code                                   */
  /* ------------------------------------------------------------ */
  const IP = Tex.ITEM_PAINT;
  const shade = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
  const gemIcon = (c) => (t) => { const b = hex(c); t.art(['................', '................', '.....oooooo.....', '....oLLhhmmo....', '...oLhhmmmmdo...', '..oLhmmmmmmmdo..', '..ommmmmmmmmdo..', '...ommmmmmmdo...', '....ommmmmdo....', '.....ommmdo.....', '......omdo......', '.......oo.......'], { o: shade(b, 0.35), L: [255, 255, 255], h: shade(b, 1.45), m: b, d: shade(b, 0.7) }, 0, 2); };
  const ingotIcon = (c) => (t) => { const b = hex(c); t.art(['................', '......oooooooo..', '....oohhhhhhhho.', '..oohhmmmmmmmdo.', '.ohhmmmmmmmmddo.', '.ommmmmmmmmddo..', '.oddmmmmmmddo...', '..oodddddddo....', '....oooooo......'], { o: shade(b, 0.35), h: shade(b, 1.35), m: b, d: shade(b, 0.7) }, 0, 4); };
  const nuggetIcon = (c) => (t) => { const b = hex(c); t.art(['......oo........', '.....ohmo.......', '....ohmmdo..oo..', '....ommddo.ohmo.', '.....oddo..omdo.', '..oo..oo....oo..', '.ohmo...........', '.omdo...........', '..oo............'], { o: shade(b, 0.35), h: shade(b, 1.4), m: b, d: shade(b, 0.7) }, 0, 4); };
  const scaleIcon = (c) => (t) => { const b = hex(c); t.art(['................', '......oooo......', '....oohhmmoo....', '...ohhmmmmmdo...', '..ohmmmmmmmmdo..', '..ommmhhmmmmdo..', '..ommmmmmmmddo..', '...ommmmmmddo...', '....ommmmddo....', '.....ommddo.....', '......oddo......', '.......oo.......'], { o: shade(b, 0.35), h: shade(b, 1.4), m: b, d: shade(b, 0.7) }, 0, 2); };
  const toothIcon = (c) => (t) => { const b = hex(c); t.art(['................', '...oooo.........', '..ohhmmo........', '..ohmmmdoo......', '...ohmmmddo.....', '....ommmmddo....', '.....ommmmdo....', '......ommmddo...', '.......ommddo...', '........omddo...', '.........oddo...', '..........ooo...'], { o: shade(b, 0.4), h: [255, 255, 255], m: b, d: shade(b, 0.75) }, 0, 2); };
  const stickIcon = (c) => (t) => { const b = hex(c); for (let k = 0; k < 12; k++) { t.set(3 + k, 13 - k, shade(b, 0.4)); t.set(4 + k, 13 - k, b); t.set(4 + k, 12 - k, shade(b, 1.3)); } };
  const blobIcon = (c, hl) => (t) => { const b = hex(c), h = hl ? hex(hl) : shade(b, 1.4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, (y - 8.5) * 1.15); if (d < 5.6) t.set(x, y, d > 4.8 ? shade(b, 0.45) : (x < 7 && y < 8 && d < 3.4 ? h : b)); } };

  /* ------------------------------------------------------------ */
  /* Materials and loot from the creatures                        */
  /* ------------------------------------------------------------ */
  const MAT_ITEMS = [
    [624, 'ruby', 'Ruby', gemIcon('#e8203c')], [625, 'amethyst', 'Amethyst', gemIcon('#a060e8')],
    [626, 'uranium_nugget', 'Uranium Nugget', nuggetIcon('#58d828')], [627, 'uranium_ingot', 'Uranium Ingot', ingotIcon('#58d828')],
    [628, 'titanium_nugget', 'Titanium Nugget', nuggetIcon('#b8c4d0')], [629, 'titanium_ingot', 'Titanium Ingot', ingotIcon('#b8c4d0')],
    [630, 'salt', 'Salt', (t) => { for (let k = 0; k < 22; k++) { const x = 4 + t.ri(8), y = 6 + t.ri(7); t.set(x, y, [250, 250, 250]); t.set(x + 1, y, [210, 218, 226]); } }],
    [631, 'pink_tourmaline_ingot', 'Pink Tourmaline Ingot', ingotIcon('#f050a8')], [632, 'tigers_eye_ingot', "Tiger's Eye Ingot", ingotIcon('#d89830')],
    [633, 'crystal_stick', 'Crystal Sticks', stickIcon('#9ac8f8')], [634, 'crystal_shards', 'Crystal Shards', nuggetIcon('#c8b4f0')],
    [635, 'green_goo', 'Green Goo', blobIcon('#58d830', '#c8ff90')], [636, 'mobzilla_scale', 'Mobzilla Scale', scaleIcon('#3e5a34')],
    [637, 'queen_scale', 'The Queen Scale', scaleIcon('#e070e8')], [638, 'nightmare_scale', 'Nightmare Scale', scaleIcon('#3a1a40')],
    [639, 'moth_scale', 'Moth Scale', scaleIcon('#c8a060')], [640, 'kraken_tooth', 'Kraken Tooth', toothIcon('#e8e0d0')],
    [641, 'trex_tooth', 'T. Rex Tooth', toothIcon('#f0e8d0')], [642, 'worm_tooth', 'Worm Tooth', toothIcon('#e0c8b0')],
    [643, 'caterkiller_jaws', 'CaterKiller Jaws', toothIcon('#5a8a30')], [644, 'sea_viper_tongue', 'Sea Viper Tongue', toothIcon('#e04870')],
    [645, 'vortex_eye', 'Vortex Eye', blobIcon('#7040e0', '#e0d0ff')], [646, 'molenoid_nose', 'Molenoid Nose', blobIcon('#f090a0')],
    [647, 'sea_monster_scale', 'Sea Monster Scale', scaleIcon('#2a7a8a')], [648, 'basilisk_scale', 'Basilisk Scale', scaleIcon('#3a8a28')],
    [649, 'emperor_scorpion_scale', 'Emperor Scorpion Scale', scaleIcon('#2a2a3a')], [650, 'jumpy_bug_scale', 'Jumpy Bug Scale', scaleIcon('#7a5a28')],
    [651, 'water_dragon_scale', 'Water Dragon Scale', scaleIcon('#3070d8')], [653, 'peacock_feather', 'Peacock Feather', (t) => { for (let k = 0; k < 11; k++) t.set(3 + k, 14 - k, [120, 90, 40]); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 10.5, y - 5); if (d < 4) t.set(x, y, d < 1.4 ? [20, 30, 120] : d < 2.4 ? [40, 200, 200] : d < 3.2 ? [200, 160, 40] : [40, 140, 60]); } }],
    [654, 'bertha_handle', 'Big Bertha Handle', stickIcon('#8a6430')], [655, 'bertha_guard', 'Big Bertha Guard', ingotIcon('#e8c040')], [656, 'bertha_blade', 'Big Bertha Blade', toothIcon('#d8e0e8')],
    [657, 'dead_stink_bug', 'Dead Stink Bug', blobIcon('#6a5a28')], [658, 'dead_irukandji', 'Dead Irukandji', blobIcon('#c8e8ff')],
    [659, 'love', 'Love', (t) => t.art(['................', '..oo...oo.......', '.oHHo.oHho......', 'oHHhhohhhho.....', 'oHhhhhhhhho.....', 'ohhhhhhhhdo.....', '.ohhhhhhdo......', '..ohhhhdo.......', '...ohhdo........', '....odo.........', '.....o..........'], { o: [90, 0, 30], H: [255, 200, 220], h: [240, 50, 90], d: [170, 20, 60] }, 3, 3)],
    [660, 'small_rock', 'Small Rock', blobIcon('#8a8a8a')], [661, 'ice_ball', 'Ice Ball', blobIcon('#a0e0ff', '#ffffff')]
  ];
  for (const [i, n, name, paint] of MAT_ITEMS) { def(i, n, { display: name }); IP[n] = paint; }
  I.get(660).throwable = true; I.get(661).throwable = true;

  /* ------------------------------------------------------------ */
  /* Tools                                                        */
  /* ------------------------------------------------------------ */
  Object.assign(Tex.TOOL_MAT, {
    ultimate: { L: '#ffffff', m: '#e8e4ff', d: '#9a8ad8', o: '#2a1a5a' },
    emerald: { L: '#c8ffdd', m: '#1fc760', d: '#0e7a3a', o: '#022a12' },
    ruby: { L: '#ffd0d8', m: '#e8203c', d: '#8a0a1c', o: '#2a0208' },
    amethyst: { L: '#f4e4ff', m: '#a060e8', d: '#5a2a98', o: '#1e0a36' },
    crystal_wood: { L: '#d4e8ff', m: '#9ab8f4', d: '#5a74b8', o: '#1a2448' },
    crystal_stone: { L: '#ffffff', m: '#d0c0f4', d: '#9a80d0', o: '#3a2a60' },
    pink_tourmaline: { L: '#ffe0f2', m: '#f050a8', d: '#a01060', o: '#3a0420' },
    tigers_eye: { L: '#fff0b0', m: '#e0a030', d: '#8a5208', o: '#2a1600' }
  });
  const TOOLS = [
    // name, base id, harvest level, speed, uses, sword damage, name shown, material key for recipes
    ['ultimate', 670, 5, 15, 3000, 40, 'The Ultimate'], ['emerald', 675, 3, 10, 1300, 10, 'Emerald'], ['ruby', 680, 4, 11, 1500, 20, 'Ruby'],
    ['amethyst', 685, 4, 11, 2000, 15, 'Amethyst'], ['crystal_wood', 690, 1, 3, 300, 6, 'Crystal Wood'], ['crystal_stone', 695, 2, 6, 800, 9, 'Crystal Stone'],
    ['pink_tourmaline', 700, 3, 10, 1100, 11, 'Pink Tourmaline'], ['tigers_eye', 705, 3, 12, 1600, 12, "Tiger's Eye"]
  ];
  const TT = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'];
  Tex.extraToolMats = (Tex.extraToolMats || []).concat(TOOLS.map(t => t[0]));
  for (const [mat, base, level, speed, uses, sword, name] of TOOLS) {
    I.MATS[mat] = { level, speed, uses, dmg: Math.round(sword / 4), name };
    TT.forEach((type, i) => def(base + i, mat + '_' + type, {
      display: name + ' ' + titleCase(type), maxStack: 1, tool: { type, level, speed }, maxDamage: uses, icon: mat + '_' + type,
      attack: type === 'sword' ? sword : type === 'axe' ? Math.round(sword * 0.8) : type === 'pickaxe' ? Math.round(sword * 0.55) : Math.round(sword * 0.4)
    }));
  }
  // the Ultimate sword sets things on fire and knocks them flying
  I.get(id('ultimate_sword')).onHit = (e, p) => { e.fire = Math.max(e.fire || 0, 100); knock(e, p, 1.2); };

  /* ------------------------------------------------------------ */
  /* The legendary weapons                                        */
  /* ------------------------------------------------------------ */
  function knock(e, p, k) { const dx = e.x - p.x, dz = e.z - p.z, l = Math.hypot(dx, dz) || 1; e.vx += dx / l * k; e.vz += dz / l * k; e.vy += 0.25 * k; }
  // damage everything in a ring round the player (for the giant blades)
  function sweep(p, r, dmg, skip) {
    for (const e of p.world.entities) {
      if (e === p || e === skip || !e.living || e.removed || e.health <= 0 || e.isPlayer || e.tamed) continue;
      if (e.dist2(p.x, p.y, p.z) > r * r) continue;
      e.damage('player', dmg, p); knock(e, p, 0.6);
    }
    if (p.world.fx) p.world.fx.particles('crit', p.x, p.y + 1, p.z, 16, r * 0.7);
  }
  const bladeIcon = (blade, guard, grip, big) => (t) => {
    const b = hex(blade), g = hex(guard), h = hex(grip), L = shade(b, 1.35), D = shade(b, 0.6);
    const len = big ? 13 : 10, w = big ? 2 : 1;
    for (let k = 0; k < len; k++) { const x = 4 + k, y = 11 - k; for (let j = -w; j <= w; j++) t.set(x + (j > 0 ? j : 0), y + (j < 0 ? -j : 0), j === -w ? L : j === w ? D : b); }
    for (let k = -2; k <= 2; k++) t.set(4 + k, 11 + k, g);
    t.set(3, 12, h); t.set(2, 13, h); t.set(1, 14, shade(h, 0.7));
  };
  const WEAPONS = [
    [740, 'ultimate_bow', 'The Ultimate Bow', { maxDamage: 3000, bow: { power: 3, flame: true, explosive: false, infinite: true } }, (t) => bowIcon(t, '#e8e4ff', '#9a8ad8')],
    [741, 'skate_bow', 'Skate String Bow', { maxDamage: 800, bow: { power: 1.6 } }, (t) => bowIcon(t, '#9ab8f4', '#5a74b8')],
    [742, 'big_bertha', 'Big Bertha', { attack: 500, maxDamage: 9000, sweep: 4.5 }, bladeIcon('#c8d4e0', '#e8c040', '#6a4a20', true)],
    [743, 'slice', 'Slice', { attack: 400, maxDamage: 9000, sweep: 3.5 }, bladeIcon('#ff4040', '#e8c040', '#6a4a20', true)],
    [744, 'royal_guardian_sword', 'Royal Guardian Sword', { attack: 750, maxDamage: 10000, sweep: 5, reach: 3 }, bladeIcon('#ffe060', '#c040e0', '#8a2010', true)],
    [745, 'attitude_adjuster', 'Attitude Adjuster', { attack: 86, maxDamage: 2000, hammer: true }, (t) => hammerIcon(t, '#8a96a4', '#5a3a1c')],
    [746, 'battle_axe', 'Battle Axe', { attack: 50, maxDamage: 1500, sweep: 3 }, (t) => axeIcon(t, '#d0d8e0', '#5a3a1c')],
    [747, 'chainsaw', 'Chainsaw', { attack: 60, maxDamage: 1500, tool: { type: 'axe', level: 5, speed: 30 }, chainsaw: true }, (t) => chainsawIcon(t)],
    [748, 'queen_battle_axe', 'Queen Scale Battle Axe', { attack: 666, maxDamage: 2200, sweep: 4.5 }, (t) => axeIcon(t, '#e070e8', '#3a1a40')],
    [749, 'nightmare_sword', 'Nightmare Sword', { attack: 30, maxDamage: 1800, fire: true }, bladeIcon('#3a1a40', '#c02020', '#1a0a10')],
    [750, 'rose_sword', 'Rose Sword', { attack: 8, maxDamage: 250 }, bladeIcon('#e02040', '#3a8a28', '#2a6a18')],
    [751, 'experience_sword', 'Experience Sword', { attack: 14, maxDamage: 1300, xp: true }, bladeIcon('#c8ff40', '#1fc760', '#6a4a20')],
    [752, 'poison_sword', 'Poison Sword', { attack: 12, maxDamage: 1300, poison: true }, bladeIcon('#6a9a28', '#3a3a20', '#3a2a10')],
    [753, 'rat_sword', 'Rat Sword', { attack: 9, maxDamage: 600 }, bladeIcon('#c0b0a0', '#9ab8f4', '#5a74b8')],
    [754, 'fairy_sword', 'Fairy Sword', { attack: 9, maxDamage: 600, fairy: true }, bladeIcon('#ffc0f0', '#9ab8f4', '#5a74b8')],
    [652, 'mantis_claw', 'Mantis Claw', { attack: 10, maxDamage: 1000 }, toothIcon('#5ab030')],
    [755, 'big_hammer', 'Big Hammer', { attack: 30, maxDamage: 1500, hammer: true }, (t) => hammerIcon(t, '#5a5a6a', '#6a4a20')],
    [756, 'ray_gun', 'A Freakin\' Ray Gun!', { maxDamage: 800, gun: 'ray' }, (t) => gunIcon(t, '#c8d0d8', '#e03030')],
    [757, 'squidzooka', 'SquidZooka!', { maxDamage: 300, gun: 'squid' }, (t) => gunIcon(t, '#4a6aa0', '#2a2a40', true)],
    [758, 'thunder_staff', 'Thunder Staff', { maxDamage: 200, gun: 'thunder' }, (t) => { stickIcon('#8a6430')(t); for (const [x, y] of [[12, 1], [13, 2], [12, 3], [14, 2], [13, 0]]) t.set(x, y, [255, 240, 80]); t.set(13, 2, [255, 255, 255]); }],
    [759, 'irukandji_arrow', 'Irukandji Arrow', { maxStack: 64 }, (t) => { for (let k = 0; k < 10; k++) t.set(3 + k, 12 - k, [140, 110, 70]); t.set(13, 2, [200, 230, 255]); t.set(12, 2, [120, 180, 255]); t.set(13, 3, [120, 180, 255]); t.set(2, 13, [60, 180, 180]); t.set(3, 13, [60, 180, 180]); t.set(2, 12, [60, 180, 180]); }],
    [760, 'creeper_launcher', 'Creeper Launcher', { maxDamage: 100, gun: 'creeper' }, (t) => gunIcon(t, '#3a8a28', '#1a3a10', true)]
  ];
  function bowIcon(t, c, d) { const a = hex(c), b = hex(d); for (let k = 0; k < 12; k++) { const x = 2 + k, y = 2 + Math.round(Math.sin(k / 11 * Math.PI) * -1.5) + k; void y; } t.art(['................', '..........aab...', '........aab..s..', '.......ab....s..', '......ab.....s..', '.....ab......s..', '....ab......s...', '...ab......s....', '..ab......s.....', '..a......s......', '..b.....s.......', '..b....s........', '...b..s.........', '....bs..........', '................'], { a, b, s: [230, 230, 230] }); }
  function hammerIcon(t, head, grip) { const h = hex(head), g = hex(grip); for (let k = 0; k < 9; k++) { t.set(3 + k, 13 - k, g); t.set(4 + k, 13 - k, shade(g, 1.3)); } for (let y = 0; y < 7; y++) for (let x = 8; x < 15; x++) if (Math.abs(x - 11 + y - 3) < 4) t.set(x, y, y === 0 || x === 14 ? shade(h, 0.6) : (x === 8 ? shade(h, 1.3) : h)); }
  function axeIcon(t, head, grip) { const h = hex(head), g = hex(grip); for (let k = 0; k < 12; k++) t.set(2 + k, 14 - k, g); for (let y = 0; y < 9; y++) for (let x = 6; x < 16; x++) { const dx = x - 11, dy = y - 4; if (dx * dx / 22 + dy * dy / 18 < 1 && Math.abs(x + y - 15) > 1) t.set(x, y, (x + y) % 5 === 0 ? shade(h, 1.4) : h); } }
  function gunIcon(t, body, accent, long) { const b = hex(body), a = hex(accent); for (let x = 2; x < (long ? 15 : 13); x++) for (let y = 5; y < 9; y++) t.set(x, y, y === 5 ? shade(b, 1.3) : y === 8 ? shade(b, 0.6) : b); for (let y = 9; y < 14; y++) { t.set(4, y, a); t.set(5, y, shade(a, 0.7)); } t.set(long ? 14 : 12, 6, a); t.set(long ? 14 : 12, 7, a); }
  function chainsawIcon(t) { for (let x = 1; x < 9; x++) for (let y = 7; y < 12; y++) t.set(x, y, x === 1 || y === 7 ? [255, 120, 40] : [220, 80, 20]); for (let x = 8; x < 16; x++) { t.set(x, 8, [200, 200, 210]); t.set(x, 9, [150, 150, 160]); t.set(x, 7, x % 2 ? [60, 60, 70] : [200, 200, 210]); t.set(x, 10, x % 2 ? [200, 200, 210] : [60, 60, 70]); } t.set(3, 12, [40, 40, 40]); t.set(4, 13, [40, 40, 40]); }
  for (const [i, n, name, o, paint] of WEAPONS) { def(i, n, Object.assign({ display: name, maxStack: 1 }, o)); IP[n] = paint; }

  /* ------------------------------------------------------------ */
  /* Armour: fourteen sets                                        */
  /* ------------------------------------------------------------ */
  const ARMOR_SETS = [
    // key, base id, name, durability multiplier, points [helmet, chest, legs, boots], colours (main, dark, light, outline), extras
    ['ultimate', 770, 'Ultimate', 200, [6, 12, 10, 6], ['#e8e4ff', '#9a8ad8', '#ffffff', '#2a1a5a'], { breath: true, feather: true, fireproof: true, toughness: 0.35 }],
    ['emerald', 774, 'Emerald', 60, [3, 8, 6, 3], ['#1fc760', '#0e7a3a', '#c8ffdd', '#022a12'], {}],
    ['ruby', 778, 'Ruby', 90, [4, 9, 8, 4], ['#e8203c', '#8a0a1c', '#ffd0d8', '#2a0208'], { toughness: 0.1 }],
    ['amethyst', 782, 'Amethyst', 100, [4, 8, 7, 3], ['#a060e8', '#5a2a98', '#f4e4ff', '#1e0a36'], { toughness: 0.1 }],
    ['pink_tourmaline', 786, 'Pink Tourmaline', 50, [3, 7, 5, 2], ['#f050a8', '#a01060', '#ffe0f2', '#3a0420'], {}],
    ['tigers_eye', 790, "Tiger's Eye", 80, [4, 8, 7, 4], ['#e0a030', '#8a5208', '#fff0b0', '#2a1600'], { toughness: 0.05 }],
    ['mobzilla', 794, 'Mobzilla Scale', 1000, [7, 13, 11, 7], ['#3e5a34', '#1a2a18', '#7a9a6a', '#0a1208'], { fireproof: true, blastproof: true, feather: true, toughness: 0.45 }],
    ['royal', 798, 'Royal Guardian', 2000, [8, 14, 12, 8], ['#ffd040', '#c02020', '#fff4b0', '#4a1000'], { glide: 0.1, fireproof: true, blastproof: true, toughness: 0.55 }],
    ['queen', 802, 'Queen Scale', 1500, [9, 16, 14, 9], ['#e070e8', '#8a28a0', '#ffd8ff', '#2a0838'], { glide: 0.25, toughness: 0.6 }],
    ['peacock', 806, 'Peacock Feather', 40, [2, 5, 4, 2], ['#28a0a0', '#1a5a7a', '#e0c040', '#0a2a30'], { glide: 0.1, feather: true }],
    ['lava_eel', 810, 'Lava Eel', 40, [2, 7, 5, 2], ['#e05a18', '#8a2a08', '#ffc060', '#2a0a00'], { fireproof: true, lavaswim: true }],
    ['moth_scale', 814, 'Moth Scale', 50, [2, 7, 5, 2], ['#c8a060', '#7a5a28', '#f4e0b0', '#2a1a08'], { fireproof: true, feather: true }],
    ['experience', 818, 'Experience', 70, [5, 9, 7, 4], ['#9ae040', '#4a8a10', '#e8ff90', '#1a3a00'], { breath: true, feather: true }],
    ['lapis', 822, 'Lapis Lazuli', 60, [2, 7, 5, 2], ['#2a4ab8', '#142a7a', '#90a8f8', '#060e30'], { breath: true }]
  ];
  const PIECES = ['helmet', 'chestplate', 'leggings', 'boots'], PBASE = [11, 16, 15, 13];
  Tex.extraArmorMats = Tex.extraArmorMats || [];
  OS.ARMOR = {};
  for (const [key, base, name, dura, pts, cols, extra] of ARMOR_SETS) {
    M.ARMOR_MAT[key] = cols.map(hex);
    Tex.MAT[key] = { m: hex(cols[0]), d: hex(cols[1]), l: hex(cols[2]), o: hex(cols[3]) };
    Tex.extraArmorMats.push(key);
    OS.ARMOR[key] = extra;
    PIECES.forEach((p, i) => def(base + i, key + '_' + p, {
      display: name + ' ' + titleCase(p), maxStack: 1, armor: { slot: i, points: Math.min(pts[i], [4, 9, 7, 4][i]), mat: key, set: key }, maxDamage: PBASE[i] * dura, icon: key + '_' + p
    }));
  }
  // sets that soak up more than the usual armour can, fire, falls, explosions, and let you breathe or glide
  const setOf = (p) => { if (!p.armor) return null; const k = p.armor.map(s => s && I.get(s.id) && I.get(s.id).armor && I.get(s.id).armor.set); return k[0] && k.every(v => v === k[0]) ? k[0] : null; };
  const wears = (p, key) => p.armor && p.armor.some(s => s && I.get(s.id) && I.get(s.id).armor && I.get(s.id).armor.set === key);
  OS.setOf = setOf;
  const pdamage = E.Player.prototype.damage;
  E.Player.prototype.damage = function (src, amount, from) {
    const set = setOf(this), x = set && OS.ARMOR[set];
    if (x) {
      if (x.fireproof && (src === 'fire' || src === 'lava' || src === 'burn' || src === 'ichor')) return false;
      if (x.feather && src === 'fall') amount *= 0.25;
      if (x.blastproof && src === 'explosion') amount *= 0.3;
      if (x.toughness) amount *= 1 - x.toughness;
    }
    return pdamage.call(this, src, amount, from);
  };
  const ptick = E.Player.prototype.tick;
  E.Player.prototype.tick = function () {
    ptick.apply(this, arguments);
    if (!this.armor || this.isRemote) return;
    const set = setOf(this), x = set ? OS.ARMOR[set] : null;
    // gliding boots: Royal, Queen and Peacock (just the boots will do)
    const boots = this.armor[3] && I.get(this.armor[3].id), bootSet = boots && boots.armor && boots.armor.set;
    const glide = bootSet && OS.ARMOR[bootSet] && OS.ARMOR[bootSet].glide;
    if (glide && !this.onGround && !this.flying && !this.inWater && this.vy < -glide && !this.sneaking) { this.vy = -glide; this.fallDistance = 0; }
    if (x && x.breath && this.air !== undefined && this.air < 300 && this.age % 3 === 0) this.air++;
    if (x && x.fireproof && this.fire > 0) this.fire = 0;
  };

  /* ------------------------------------------------------------ */
  /* Foods and crops                                              */
  /* ------------------------------------------------------------ */
  const foodIcon = {
    fruit: (c, leaf) => (t) => { blobIcon(c)(t); t.set(7, 2, hex(leaf || '#3a8a28')); t.set(8, 2, hex(leaf || '#3a8a28')); t.set(8, 1, hex(leaf || '#3a8a28')); },
    berry: (c) => (t) => { t.art(['.......gg.......', '......gggg......', '.....oHhhho.....', '....oHhhyhho....', '....ohhhhyho....', '....ohyhhhho....', '.....ohhhyo.....', '......ohhho.....', '.......oho......', '........o.......'], { g: [60, 150, 40], o: shade(hex(c), 0.45), H: [255, 220, 220], h: hex(c), y: [255, 230, 120] }, 0, 3); },
    cob: (t) => { t.art(['.........gg.....', '........gYYg....', '.......gYyYyg...', '......gYyYyYg...', '.....gYyYyYg....', '....gYyYyYg.....', '...gYyYyYg......', '..ggYyYyg.......', '.ggggYyg........', 'gg..ggg.........'], { g: [90, 160, 50], Y: [250, 220, 60], y: [220, 180, 30] }, 2, 3); },
    leafy: (c) => (t) => { const b = hex(c); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, (y - 9) * 1.2); if (d < 6) t.set(x, y, (Math.abs(x - 7.5) < 0.6 || (x + y) % 4 === 0) ? shade(b, 1.35) : d > 5 ? shade(b, 0.55) : b); } },
    root: (c) => (t) => { t.art(['.....g.g.g......', '......ggg.......', '.......g........', '.....ohhho......', '....oHhhhho.....', '....ohhhhho.....', '....ohhhhho.....', '.....ohhho......', '......ohho......', '.......oho......', '........w.......'], { g: [80, 160, 50], o: shade(hex(c), 0.5), H: [255, 220, 230], h: hex(c), w: [230, 230, 210] }, 0, 2); },
    grain: (c) => (t) => { t.art(['................', '.....oooooo.....', '....oWWWWWWo....', '...oWwwWwwWwo...', '...oooooooooo...', '...obbbbbbbbo...', '....obbbbbbo....', '.....oooooo.....'], { o: [90, 60, 30], W: hex(c), w: shade(hex(c), 0.8), b: [160, 110, 60] }, 0, 5); },
    slice: (c1, c2) => (t) => { t.art(['................', '..oooooooooooo..', '..oCCCCCCCCCCo..', '...oCRCCCRCCo...', '....oCCCRCCo....', '.....oCCCCo.....', '......oCCo......', '.......oo.......'], { o: [120, 70, 30], C: hex(c1), R: hex(c2) }, 0, 4); },
    meat: (raw) => (t) => { t.art(['................', '.......oooo.....', '.....ooMMMMo....', '....oMMmmmMMo...', '...oMmmmmmmmMo..', '..oMmmmmFmmmMo..', '..oMmmmmmmmMo...', '..ooMmmmmmMo....', '.w..ooMMMoo.....', 'ww....ooo.......'], { o: raw ? [120, 30, 30] : [70, 30, 10], M: raw ? [240, 120, 120] : [180, 100, 50], m: raw ? [220, 70, 80] : [140, 70, 30], F: raw ? [255, 220, 220] : [220, 170, 110], w: [240, 240, 230] }, 0, 3); },
    sandwich: (t) => { t.art(['................', '...oooooooooo...', '..oBBBBBBBBBBo..', '..oLLGLLGLLGLo..', '..oRRRRRRRRRRo..', '..oPPPPPPPPPPo..', '..oBBBBBBBBBBo..', '...oooooooooo...'], { o: [110, 70, 30], B: [220, 170, 90], L: [120, 200, 70], G: [80, 160, 40], R: [220, 60, 50], P: [200, 120, 110] }, 0, 4); },
    popcorn: (bag) => (t) => { if (bag) t.art(['................', '....oooooooo....', '....oWWWWWWo....', '....oRWRWRWo....', '....oRWRWRWo....', '....oRWRWRWo....', '....oRWRWRWo....', '.....oooooo.....'], { o: [120, 30, 30], R: [220, 40, 40], W: [255, 255, 255] }, 0, 6); for (let k = 0; k < 9; k++) { const x = 4 + (k * 3) % 8, y = (bag ? 3 : 6) + (k >> 2) * 2; t.set(x, y, [255, 252, 230]); t.set(x + 1, y, [250, 230, 160]); t.set(x, y + 1, [240, 220, 150]); } },
    bar: (c) => (t) => { const b = hex(c); for (let y = 6; y < 11; y++) for (let x = 3; x < 13; x++) t.set(x, y, y === 6 ? shade(b, 1.25) : y === 10 ? shade(b, 0.65) : b); },
    fish: (c) => (t) => { const b = hex(c); t.art(['................', '.....ooooo...o..', '...ooBBBBBo.oBo.', '..oBBbbbbBBoBBo.', '.oKBbbbbbbbBBo..', '..oBBbbbbBBoBBo.', '...ooBBBBBo.oBo.', '.....ooooo...o..'], { o: shade(b, 0.4), B: b, b: shade(b, 1.3), K: [10, 10, 10] }, 0, 4); }
  };
  const FOODS = [
    // id, name, display, hunger, saturation, icon, extra
    [830, 'strawberry', 'Strawberry', 2, 1.2, foodIcon.berry('#e01830'), { places: B.strawberry_crop }],
    [831, 'tomato', 'Tomato', 3, 2.4, foodIcon.fruit('#e83018'), { places: B.tomato_crop }],
    [832, 'corn', 'Corn', 3, 2.4, foodIcon.cob, { places: B.corn_crop }],
    [833, 'lettuce', 'Lettuce', 2, 1.6, foodIcon.leafy('#7ad040'), { places: B.lettuce_crop }],
    [834, 'radish', 'Radish', 2, 1.6, foodIcon.root('#e04870'), { places: B.radish_crop }],
    [835, 'rice', 'Rice', 2, 1.2, foodIcon.grain('#f4f0dc'), { places: B.rice_crop }],
    [836, 'quinoa', 'Quinoa', 2, 1.2, foodIcon.grain('#e0a050'), { places: B.quinoa_crop }],
    [837, 'cherries', 'Cherries', 2, 1.2, foodIcon.berry('#a00820'), {}],
    [838, 'peach', 'Peach', 4, 2.4, foodIcon.fruit('#ffa070'), {}],
    [839, 'crystal_apple', 'Crystal Apple', 6, 9.6, foodIcon.fruit('#b0e8ff', '#c070e0'), { regen: 5 }],
    [840, 'butter', 'Butter', 2, 1.2, foodIcon.bar('#f8e070'), {}],
    [841, 'cheese', 'Cheese', 4, 4.8, foodIcon.bar('#f0c040'), {}],
    [842, 'garden_salad', 'Garden Salad', 8, 9.6, foodIcon.leafy('#5ab030'), { returns: 281 }],
    [843, 'blt', 'BLT Sandwich!', 10, 14, foodIcon.sandwich, {}],
    [844, 'raw_bacon', 'Raw Bacon', 2, 1.2, foodIcon.meat(true), {}],
    [845, 'bacon', 'Bacon!', 6, 9.6, foodIcon.meat(false), {}],
    [846, 'raw_corn_dog', 'Raw Corn Dog', 2, 1.2, foodIcon.bar('#e8c070'), {}],
    [847, 'corn_dog', 'Corn Dog', 8, 12.8, foodIcon.bar('#c88838'), {}],
    [848, 'popcorn', 'Popcorn', 1, 0.6, foodIcon.popcorn(false), {}],
    [849, 'buttered_popcorn', 'Buttered Popcorn', 2, 1.6, foodIcon.popcorn(false), {}],
    [850, 'salted_popcorn', 'Buttered and Salted Popcorn', 3, 2.4, foodIcon.popcorn(false), {}],
    [851, 'popcorn_bag', 'Bag of Popcorn', 12, 14.4, foodIcon.popcorn(true), {}],
    [852, 'raw_crab_meat', 'Raw Crab Meat', 2, 1.2, foodIcon.meat(true), {}],
    [853, 'crab_meat', 'Crab Meat!', 6, 9.6, foodIcon.meat(false), {}],
    [854, 'crabby_patty', 'A Crabby Patty!', 12, 16, foodIcon.sandwich, {}],
    [855, 'raw_peacock', 'Raw Peacock', 2, 1.2, foodIcon.meat(true), {}],
    [856, 'cooked_peacock', 'Cooked Peacock', 7, 10, foodIcon.meat(false), {}],
    [857, 'pizza', 'Pizza!', 10, 14, foodIcon.slice('#f0c040', '#d83020'), {}],
    [858, 'butter_candy', 'Butter Candy!', 3, 3.6, foodIcon.bar('#ffe090'), { speedy: true }],
    [859, 'fire_fish', 'Fire Fish', 4, 4.8, foodIcon.fish('#f05a18'), { fireres: true }],
    [860, 'sun_fish', 'Sun Fish', 4, 4.8, foodIcon.fish('#f0d030'), {}],
    [861, 'lava_eel', 'Lava Eel', 3, 3.6, foodIcon.fish('#c03a08'), { fireres: true }],
    [862, 'green_fish', 'Green Fish', 2, 1.2, foodIcon.fish('#3aa040'), {}],
    [863, 'blue_fish', 'Blue Fish', 2, 1.2, foodIcon.fish('#3a70d8'), {}],
    [864, 'pink_fish', 'Pink Fish', 2, 1.2, foodIcon.fish('#f080b8'), {}]
  ];
  for (const [i, n, name, food, sat, paint, extra] of FOODS) {
    def(i, n, Object.assign({ display: name, maxStack: 64, food }, extra));
    IP[n] = paint;
    if (DL.Food && DL.Food.FOOD) DL.Food.FOOD[n] = [food, sat, extra.regen ? { regen: extra.regen } : null];
  }
  // crop blocks never show up as items
  for (const n in CROPS) { const d = I.get(B[n + '_crop']); if (d) d.hidden = true; }
  const CROP_IDS = new Set(Object.keys(CROPS).map(n => B[n + '_crop']));
  const PRODUCE = {}; for (const n in CROPS) PRODUCE[B[n + '_crop']] = id(n);
  OS.CROP_IDS = CROP_IDS;
  // crops grow like wheat, on farmland
  if (DL.RTICK) {
    for (const c of CROP_IDS) DL.RTICK[c] = DL.RTICK[B.wheat];
    const farm = DL.RTICK[B.farmland];
    DL.RTICK[B.farmland] = (w, x, y, z, r) => { if (CROP_IDS.has(w.getBlock(x, y + 1, z))) { const m = w.getMeta(x, y, z); let wet = false; for (let dx = -4; dx <= 4 && !wet; dx++) for (let dz = -4; dz <= 4 && !wet; dz++) for (let dy = 0; dy <= 1; dy++) if (w.getBlock(x + dx, y + dy, z + dz) === B.water) { wet = true; break; } if (wet && m !== 7) w.setMeta(x, y, z, 7, 0); return; } return farm(w, x, y, z, r); };
  }
  const canStay = W.canStay;
  W.canStay = function (cid, x, y, z, meta) {
    if (CROP_IDS.has(cid)) return this.getBlock(x, y - 1, z) === B.farmland;
    if (cid === B.crystal_flower || cid === B.crystal_torch) { const b = this.getBlock(x, y - 1, z); return b === B.crystal_grass || b === B.crystal_stone || S.SOIL[b] === 1; }
    return canStay.apply(this, arguments);
  };
  const neighborChanged = W.neighborChanged;
  W.neighborChanged = function (x, y, z) {
    const b = y >= 0 && y < S.CH ? this.getBlock(x, y, z) : 0;
    if (b && (CROP_IDS.has(b) || b === B.crystal_flower)) { if (!this.canStay(b, x, y, z)) this.destroyBlock(x, y, z, true); return; }
    return neighborChanged.apply(this, arguments);
  };
  // plant the produce on farmland (instead of eating it)
  const useItem = GP.useItem;
  GP.useItem = function () {
    const p = this.player, t = this.target, held = p && p.held, d = held && I.get(held.id), w = this.world;
    if (d && d.places && CROP_IDS.has(d.places) && t && !t.entity && t.face === 1 && w.getBlock(t.x, t.y, t.z) === B.farmland && w.getBlock(t.x, t.y + 1, t.z) === 0 && (this.usePressed || this._pgUseEdge)) {
      w.setBlock(t.x, t.y + 1, t.z, d.places, 0, 3);
      if (!p.creative) p.consumeHeld(1);
      p.swing(); A.play('grass', t.x + 0.5, t.y + 1, t.z + 0.5, 0.8, 1);
      return;
    }
    return useItem.apply(this, arguments);
  };

  /* ------------------------------------------------------------ */
  /* What blocks drop                                             */
  /* ------------------------------------------------------------ */
  const blockDrops = I.blockDrops;
  I.blockDrops = function (bid, meta, stack, rng) {
    const r = () => (rng ? rng.next() : Math.random());
    if (CROP_IDS.has(bid)) { const ripe = (meta & 7) >= 7; return [I.stack(PRODUCE[bid], ripe ? 2 + Math.floor(r() * 3) : 1)]; }
    if (!I.canHarvest(bid, stack)) return blockDrops.apply(this, arguments);
    switch (bid) {
      case B.ruby_ore: return [I.stack(id('ruby'))];
      case B.amethyst_ore: return [I.stack(id('amethyst'))];
      case B.uranium_ore: return [I.stack(id('uranium_nugget'), 1 + Math.floor(r() * 2))];
      case B.titanium_ore: return [I.stack(id('titanium_nugget'), 1 + Math.floor(r() * 2))];
      case B.salt_ore: return [I.stack(id('salt'), 2 + Math.floor(r() * 3))];
      case B.pink_tourmaline_ore: return [I.stack(id('pink_tourmaline_ingot'))];
      case B.tigers_eye_ore: return [I.stack(id('tigers_eye_ingot'))];
      case B.apple_leaves: { const o = []; if (r() < 0.12) o.push(I.stack(260)); if (r() < 0.04) o.push(I.stack(B.sapling)); return o; }
      case B.experience_leaves: { if (DL.game && DL.game.player && DL.game.player.addXp) DL.game.player.addXp(1 + Math.floor(r() * 3)); return r() < 0.05 ? [I.stack(id('crystal_apple'))] : []; }
      case B.crystal_leaves: return r() < 0.06 ? [I.stack(id('crystal_apple'))] : r() < 0.2 ? [I.stack(id('crystal_shards'))] : [];
      case B.scary_leaves: return [];
      case B.crystal_flower: return [I.stack(B.crystal_flower)];
      case B.ant_hill: return [I.stack(B.dirt)];
    }
    return blockDrops.apply(this, arguments);
  };

  /* ------------------------------------------------------------ */
  /* Recipes and smelting                                         */
  /* ------------------------------------------------------------ */
  // a recipe that names something this world does not have is simply skipped
  const safe = (fn) => function () { try { fn.apply(null, arguments); } catch (e) { /* missing ingredient */ } };
  const shaped = safe(I._shaped), shapeless = safe(I._shapeless);
  const smelt = (from, to) => { if (from && to) I._smelt[from] = to; };
  const block9 = (blk, item) => { shaped(['###', '###', '###'], { '#': item }, blk); shapeless([blk], item, 9); };
  block9('ruby_block', 'ruby'); block9('amethyst_block', 'amethyst'); block9('uranium_block', 'uranium_ingot'); block9('titanium_block', 'titanium_ingot');
  block9('pink_tourmaline_block', 'pink_tourmaline_ingot'); block9('tigers_eye_block', 'tigers_eye_ingot'); block9('mobzilla_scale_block', 'mobzilla_scale');
  shaped(['###', '###', '###'], { '#': 'uranium_nugget' }, 'uranium_ingot'); shapeless(['uranium_ingot'], 'uranium_nugget', 9);
  shaped(['###', '###', '###'], { '#': 'titanium_nugget' }, 'titanium_ingot'); shapeless(['titanium_ingot'], 'titanium_nugget', 9);
  shapeless(['crystal_log'], 'crystal_planks', 4);
  shaped(['#', '#'], { '#': 'crystal_planks' }, 'crystal_stick', 4);
  // tools: the usual shapes, with a gem (or the Ultimate's titanium + uranium)
  const GEM = { emerald: 'emerald', ruby: 'ruby', amethyst: 'amethyst', crystal_wood: 'crystal_planks', crystal_stone: 'crystal_stone', pink_tourmaline: 'pink_tourmaline_ingot', tigers_eye: 'tigers_eye_ingot' };
  for (const mat in GEM) {
    const g = GEM[mat], st = mat.startsWith('crystal') || mat === 'pink_tourmaline' || mat === 'tigers_eye' ? 'crystal_stick' : 'stick';
    shaped(['###', ' S ', ' S '], { '#': g, S: st }, mat + '_pickaxe'); shaped(['##', '#S', ' S'], { '#': g, S: st }, mat + '_axe');
    shaped(['#', 'S', 'S'], { '#': g, S: st }, mat + '_shovel'); shaped(['#', '#', 'S'], { '#': g, S: st }, mat + '_sword'); shaped(['##', ' S', ' S'], { '#': g, S: st }, mat + '_hoe');
  }
  shaped(['T', 'U', 'I'], { T: 'titanium_ingot', U: 'uranium_ingot', I: 'iron_ingot' }, 'ultimate_sword');
  shaped(['TUT', ' U ', ' I '], { T: 'titanium_ingot', U: 'uranium_ingot', I: 'iron_ingot' }, 'ultimate_pickaxe');
  shaped(['U', 'T', 'I'], { T: 'titanium_ingot', U: 'uranium_ingot', I: 'iron_ingot' }, 'ultimate_shovel');
  shaped(['TU', ' I', ' I'], { T: 'titanium_ingot', U: 'uranium_ingot', I: 'iron_ingot' }, 'ultimate_hoe');
  shaped(['TU', 'TI', ' I'], { T: 'titanium_ingot', U: 'uranium_ingot', I: 'iron_ingot' }, 'ultimate_axe');
  shaped([' TS', 'I S', ' US'], { T: 'titanium_ingot', U: 'uranium_ingot', I: 'iron_ingot', S: 'string' }, 'ultimate_bow');
  shaped([' TS', 'T S', ' TS'], { T: 'crystal_stick', S: 'string' }, 'skate_bow');
  // armour
  const ARMOR_GEM = { ultimate: null, emerald: 'emerald', ruby: 'ruby', amethyst: 'amethyst', pink_tourmaline: 'pink_tourmaline_ingot', tigers_eye: 'tigers_eye_ingot', mobzilla: 'mobzilla_scale',
    queen: 'queen_scale', peacock: 'peacock_feather', lava_eel: 'lava_eel', moth_scale: 'moth_scale', experience: 'experience_bottle', lapis: 'lapis_lazuli', royal: null };
  const ASHAPES = [['###', '# #'], ['# #', '###', '###'], ['###', '# #', '# #'], ['# #', '# #']];
  for (const k in ARMOR_GEM) { const g = ARMOR_GEM[k]; if (!g || !I.byName[g]) continue; PIECES.forEach((p, i) => shaped(ASHAPES[i], { '#': g }, k + '_' + p)); }
  PIECES.forEach((p, i) => { shaped(ASHAPES[i].map(r => r.replace(/#/g, 'T')), { T: 'titanium_ingot' }, 'ultimate_' + p); });
  // royal guardian armour: a set of each of the best, fused
  PIECES.forEach((p) => shapeless(['ultimate_' + p, 'mobzilla_' + p, 'queen_' + p, 'gold_block'], 'royal_' + p));
  // weapons
  shaped(['ODO', 'RTR', 'OIO'], { O: 'nightmare_scale', D: 'diamond', R: 'redstone', T: 'titanium_ingot', I: 'iron_ingot' }, 'nightmare_sword');
  shaped(['#', '#', 'S'], { '#': 'rose', S: 'stick' }, 'rose_sword');
  shaped(['EEE', 'ESE', 'EEE'], { E: 'experience_bottle', S: 'emerald_sword' }, 'experience_sword');
  shaped(['EEE', 'ESE', 'EEE'], { E: 'dead_stink_bug', S: 'emerald_sword' }, 'poison_sword');
  shapeless(['ultimate_sword', 'ultimate_sword', 'big_hammer', 'green_goo'], 'attitude_adjuster');
  shapeless(['ultimate_sword', 'ultimate_axe', 'green_goo'], 'battle_axe');
  shaped(['RRR', 'RAR', 'RRR'], { R: 'redstone', A: 'ultimate_axe' }, 'chainsaw');
  shaped(['QIQ', 'QIQ', ' I '], { Q: 'queen_scale', I: 'iron_ingot' }, 'queen_battle_axe');
  shapeless(['bertha_handle', 'bertha_guard', 'bertha_blade'], 'big_bertha');
  shapeless(['ray_gun', 'big_hammer', 'mantis_claw', 'water_dragon_scale', 'green_goo'], 'bertha_handle');
  shapeless(['molenoid_nose', 'sea_monster_scale', 'moth_scale', 'basilisk_scale', 'nightmare_scale', 'emperor_scorpion_scale', 'jumpy_bug_scale'], 'bertha_guard');
  shapeless(['kraken_tooth', 'worm_tooth', 'trex_tooth', 'ultimate_sword', 'caterkiller_jaws', 'sea_viper_tongue', 'vortex_eye'], 'bertha_blade');
  shapeless(['big_bertha', 'iron_ingot'], 'slice');
  shapeless(['big_bertha', 'queen_battle_axe', 'royal_chestplate'], 'royal_guardian_sword');
  shaped(['III', 'IGI', ' I '], { I: 'iron_ingot', G: 'green_goo' }, 'big_hammer');
  shaped(['TUT', 'URU', 'TUT'], { T: 'titanium_ingot', U: 'uranium_ingot', R: 'redstone' }, 'ray_gun');
  shaped(['III', 'SSS', 'III'], { I: 'iron_ingot', S: 'ink_sac' }, 'squidzooka');
  shaped(['  T', ' S ', 'S  '], { T: 'uranium_ingot', S: 'crystal_stick' }, 'thunder_staff');
  shaped(['III', 'GTG', 'III'], { I: 'iron_ingot', G: 'gunpowder', T: 'tnt' }, 'creeper_launcher');
  shapeless(['peacock_feather', 'dead_irukandji', 'crystal_stick'], 'irukandji_arrow', 4);
  // food
  shapeless(['milk_bucket'], 'butter', 3);
  shapeless(['milk_bucket', 'salt'], 'cheese', 3);
  shapeless(['lettuce', 'tomato', 'radish', 'bowl'], 'garden_salad');
  shapeless(['bread', 'bacon', 'lettuce', 'tomato'], 'blt');
  shapeless(['porkchop_raw'], 'raw_bacon', 3);
  shapeless(['porkchop_raw', 'corn', 'stick'], 'raw_corn_dog');
  shapeless(['popcorn', 'butter'], 'buttered_popcorn');
  shapeless(['buttered_popcorn', 'salt'], 'salted_popcorn');
  shapeless(['salted_popcorn', 'salted_popcorn', 'salted_popcorn', 'salted_popcorn', 'paper'], 'popcorn_bag');
  shapeless(['bread', 'crab_meat', 'lettuce', 'cheese'], 'crabby_patty');
  shaped(['TCT', 'BBB'], { T: 'tomato', C: 'cheese', B: 'bread' }, 'pizza', 2);
  shapeless(['butter', 'sugar'], 'butter_candy', 2);
  shapeless(['apple', 'crystal_shards', 'crystal_shards', 'crystal_shards'], 'crystal_apple');
  shapeless(['strawberry'], 'strawberry');
  {
    smelt(B.uranium_ore, id('uranium_nugget')); smelt(B.titanium_ore, id('titanium_nugget')); smelt(B.ruby_ore, id('ruby')); smelt(B.amethyst_ore, id('amethyst'));
    smelt(id('raw_bacon'), id('bacon')); smelt(id('raw_corn_dog'), id('corn_dog')); smelt(id('corn'), id('popcorn')); smelt(id('raw_crab_meat'), id('crab_meat'));
    smelt(id('raw_peacock'), id('cooked_peacock')); smelt(B.crystal_log, 263);
  }

  /* ------------------------------------------------------------ */
  /* Weapons in action                                            */
  /* ------------------------------------------------------------ */
  // reach: the long blades hit from further away
  const reachBonus = GP.reachBonus;
  GP.reachBonus = function () { const h = this.player && this.player.held, d = h && I.get(h.id); return (reachBonus ? reachBonus.call(this) : 0) + (d && d.reach ? d.reach : 0); };
  let inHit = false;
  const mobDamage = E.Mob.prototype.damage;
  E.Mob.prototype.damage = function (src, amount, from) {
    const r = mobDamage.apply(this, arguments);
    if (inHit || src !== 'player' || !from || !from.isPlayer || !r) return r;
    const h = from.held, d = h && I.get(h.id);
    if (!d) return r;
    inHit = true;
    try {
      if (d.onHit) d.onHit(this, from, amount);
      if (d.sweep) sweep(from, d.sweep, amount * 0.5, this);
      if (d.hammer) { this.vy += 0.6 + Math.random() * 0.5; knock(this, from, 0.8); }
      if (d.fire) this.fire = Math.max(this.fire || 0, 100);
      if (d.poison) this.poisoned = Math.max(this.poisoned || 0, 120);
      if (d.xp && this.health <= 0 && from.addXp) from.addXp(4 + Math.floor(Math.random() * 6));
      if (d.fairy && Math.random() < 0.2) { this.vy += 1.2; }
      if (d.attack >= 300) knock(this, from, 1.4);
    } finally { inHit = false; }
    return r;
  };
  // poison ticks
  const mobTick = E.Mob.prototype.tick;
  E.Mob.prototype.tick = function () {
    mobTick.apply(this, arguments);
    if (this.poisoned > 0) { this.poisoned--; if (this.poisoned % 20 === 0 && this.health > 1) { mobDamage.call(this, 'magic', 1, null); if (this.world.fx) this.world.fx.particles('happy', this.x, this.y + this.h, this.z, 2, 0.3); } }
  };
  // guns, staffs and the chainsaw
  OS.fireRay = function (p, w) {
    const d = p.look(), b = new E.Magic(w, p.x + d[0], p.y + p.eye + d[1] * 0.5, p.z + d[2], p, 'ray');
    b.size = 0.3; b.noSave = true; b.icon = id('ruby');
    b.hitEntity = function (e) { if (e === p) return; e.damage('magic', 25, p); e.fire = Math.max(e.fire || 0, 60); if (w.fx) w.fx.particles('crit', this.x, this.y, this.z, 8, 0.3); this.removed = true; };
    b.hitBlock = function () { if (w.fx) w.fx.particles('smoke', this.x, this.y, this.z, 6, 0.3); this.removed = true; };
    b.shoot(d[0], d[1], d[2], 2.4, 0);
    w.entities.push(b);
  };
  const GUN_CD = {};
  const useGun = (g, kind) => {
    const p = g.player, w = g.world, now = performance.now();
    if ((GUN_CD[kind] || 0) > now) return true;
    GUN_CD[kind] = now + (kind === 'ray' ? 160 : kind === 'thunder' ? 900 : 700);
    const d = p.look();
    if (kind === 'ray') { OS.fireRay(p, w); A.play('shoot', p.x, p.y, p.z, 0.8, 2.2); p.vx -= d[0] * 0.15; p.vz -= d[2] * 0.15; }
    else if (kind === 'thunder') {
      const hit = E.raycast(w, p.x, p.y + p.eye, p.z, d[0], d[1], d[2], 60, false);
      const tx = hit ? hit.x + 0.5 : p.x + d[0] * 40, ty = hit ? hit.y + 1 : p.y + d[1] * 40, tz = hit ? hit.z + 0.5 : p.z + d[2] * 40;
      if (DL.Extras && DL.Extras.lightning) DL.Extras.lightning(w, tx, ty, tz, p);
      else { for (const e of w.entities) if (e !== p && e.living && e.dist2(tx, ty, tz) < 9) { e.damage('lightning', 20, p); e.fire = 100; } A.play('thunder', tx, ty, tz, 2, 1); if (w.fx) w.fx.particles('explosion', tx, ty, tz, 6, 1); }
    } else if (kind === 'squid' || kind === 'creeper') {
      const type = kind === 'squid' ? (E.MOBS.attack_squid ? 'attack_squid' : 'squid') : 'creeper';
      const m = E.spawnMob(w, type, p.x + d[0] * 1.5, p.y + p.eye, p.z + d[2] * 1.5);
      if (m) { m.vx = d[0] * 1.6; m.vy = d[1] * 1.6 + 0.2; m.vz = d[2] * 1.6; m.launchedBy = p; if (kind === 'creeper') m.fuse = 30; }
      A.play('fwlaunch', p.x, p.y, p.z, 1, 0.8);
    }
    if (!p.creative) p.damageHeld(1);
    p.swing();
    return true;
  };
  OS.useGun = useGun;
  const useItem2 = GP.useItem;
  GP.useItem = function () {
    const p = this.player, held = p && p.held, d = held && I.get(held.id);
    if (d && d.gun && (this.usePressed || this._pgUseEdge || d.gun === 'ray')) { if (!DL.Net || !DL.Net.client) useGun(this, d.gun); return; }
    return useItem2.apply(this, arguments);
  };
  // the chainsaw fells a whole tree
  const destroyBlock = W.destroyBlock;
  W.destroyBlock = function (x, y, z, drop, tool, byPlayer) {
    const bid = byPlayer && tool ? this.getBlock(x, y, z) : 0;
    const r = destroyBlock.apply(this, arguments);
    const d = bid && I.get(tool.id);
    if (d && d.chainsaw && S.LOGS[bid]) fell(this, x, y + 1, z, 64);
    return r;
  };
  function fell(w, x, y, z, max) {
    const q = [[x, y, z]], seen = new Set();
    while (q.length && max > 0) {
      const [a, b, c] = q.shift(), k = a + ',' + b + ',' + c;
      if (seen.has(k)) continue; seen.add(k);
      if (!S.LOGS[w.getBlock(a, b, c)]) continue;
      w.destroyBlock(a, b, c, true); max--;
      for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1]]) q.push([a + dx, b + dy, c + dz]);
    }
  }
  // bows: the Ultimate Bow shoots flaming arrows hard and never runs out
  OS.bowFor = (stack) => { const d = stack && I.get(stack.id); return d && d.bow ? d.bow : null; };

  /* ------------------------------------------------------------ */
  /* Ores in the Overworld, ant hills, fruit trees                */
  /* ------------------------------------------------------------ */
  const populate = W.populate;
  W.populate = function (c) {
    const res = populate.apply(this, arguments);
    if ((this.dim || 0) !== 0) return res;
    const r = this.popRng;
    r.setSeed(S.hash2(this.seed ^ 0x05e5a01, c.cx, c.cz));
    const bx = c.cx * 16, bz = c.cz * 16;
    this._popOrigin = c;
    try {
      for (let i = 0; i < 2; i++) this.genMinable(r, bx + r.nextInt(16), 4 + r.nextInt(28), bz + r.nextInt(16), 6, B.ruby_ore);
      for (let i = 0; i < 2; i++) this.genMinable(r, bx + r.nextInt(16), 4 + r.nextInt(36), bz + r.nextInt(16), 6, B.amethyst_ore);
      for (let i = 0; i < 2; i++) this.genMinable(r, bx + r.nextInt(16), 4 + r.nextInt(20), bz + r.nextInt(16), 5, B.uranium_ore);
      for (let i = 0; i < 2; i++) this.genMinable(r, bx + r.nextInt(16), 4 + r.nextInt(20), bz + r.nextInt(16), 5, B.titanium_ore);
      for (let i = 0; i < 3; i++) this.genMinable(r, bx + r.nextInt(16), 30 + r.nextInt(50), bz + r.nextInt(16), 8, B.salt_ore);
      // ant hills on grassy ground
      if (r.nextInt(5) === 0) {
        const x = bx + 8 + r.nextInt(16), z = bz + 8 + r.nextInt(16), y = this.topSolidY(x, z);
        const g = this.getBlock(x, y - 1, z);
        if (g === B.grass || g === B.dirt || g === B.podzol || g === B.coarse_dirt || g === B.sand) { this.popSet(x, y - 1, z, B.ant_hill, r.nextInt(5)); this.popSet(x, y, z, 0, 0); }
      }
      // now and then a fruit tree
      if (r.nextInt(14) === 0) {
        const x = bx + 8 + r.nextInt(16), z = bz + 8 + r.nextInt(16), y = this.topSolidY(x, z);
        if (this.getBlock(x, y - 1, z) === B.grass) fruitTree(this, r, x, y, z, r.nextInt(5) === 0 ? B.experience_leaves : B.apple_leaves);
      }
      // wild crops
      if (r.nextInt(10) === 0) {
        const x = bx + 8 + r.nextInt(16), z = bz + 8 + r.nextInt(16), y = this.topSolidY(x, z);
        if (this.getBlock(x, y - 1, z) === B.grass) { const crops = [...CROP_IDS]; this.popSet(x, y - 1, z, B.farmland, 7); this.popSet(x, y, z, crops[r.nextInt(crops.length)], 7); }
      }
    } finally { this._popOrigin = null; }
    return res;
  };
  function fruitTree(w, r, x, y, z, leaves) {
    const h = 4 + r.nextInt(3);
    for (let k = 0; k < h; k++) w.popSet(x, y + k, z, B.log, 0);
    for (let dy = h - 3; dy <= h + 1; dy++) {
      const rad = dy >= h ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy > h - 2 || r.nextInt(2) === 0)) continue;
        if (w.getBlock(x + dx, y + dy, z + dz) === 0) w.popSet(x + dx, y + dy, z + dz, leaves, 0);
      }
    }
  }
  OS.fruitTree = fruitTree;

  /* ------------------------------------------------------------ */
  /* A creative tab of its own                                    */
  /* ------------------------------------------------------------ */
  const OS_BLOCKS = ['ruby_ore', 'amethyst_ore', 'uranium_ore', 'titanium_ore', 'salt_ore', 'ruby_block', 'amethyst_block', 'uranium_block', 'titanium_block', 'crystal_stone', 'crystal_grass',
    'crystal_planks', 'crystal_log', 'crystal_leaves', 'crystal_flower', 'pink_tourmaline_ore', 'tigers_eye_ore', 'pink_tourmaline_block', 'tigers_eye_block', 'apple_leaves', 'experience_leaves',
    'ant_hill', 'scary_leaves', 'crystal_torch', 'mobzilla_scale_block'];
  OS.tagTab = () => {
    for (const n in OS.items) { const d = I.byName[n]; if (d && !d.hidden) d.tab = 'orespawn'; }
    for (const n of OS_BLOCKS) { const d = I.byName[n]; if (d) d.tab = 'orespawn'; }
  };
  OS.tagTab();
  if (DL.Creative && DL.Creative.TABS && !DL.Creative.TABS.some(t => t.id === 'orespawn')) {
    const at = DL.Creative.TABS.findIndex(t => t.id === 'inventory');
    DL.Creative.TABS.splice(at < 0 ? DL.Creative.TABS.length : at, 0, { id: 'orespawn', name: 'OreSpawn', icon: 'ultimate_sword' });
  }

  /* ------------------------------------------------------------ */
  /* Loot in dungeons and temples                                 */
  /* ------------------------------------------------------------ */
  if (St.LOOT) {
    St.LOOT.temple.push(['ruby', 1, 3, 4], ['amethyst', 1, 3, 4], ['uranium_nugget', 2, 6, 3], ['titanium_nugget', 2, 6, 3]);
    St.LOOT.mineshaft.push(['uranium_nugget', 1, 4, 4], ['titanium_nugget', 1, 4, 4], ['salt', 2, 8, 5]);
    St.LOOT.castle_treasure && St.LOOT.castle_treasure.push(['ruby', 2, 6, 6], ['amethyst', 2, 6, 6], ['titanium_ingot', 1, 3, 3], ['uranium_ingot', 1, 3, 3], ['ultimate_sword', 1, 1, 1]);
    St.LOOT.village.push(['strawberry', 1, 4, 5], ['corn', 1, 4, 5], ['tomato', 1, 4, 5], ['cheese', 1, 3, 3], ['butter', 1, 3, 3]);
  }
})();
