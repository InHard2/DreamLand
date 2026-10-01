/*
 * DreamLand - textures for the modern biomes: new woods and leaves, badlands
 * terracotta, flowers and plants, mushroom blocks, ice, cave blocks and sculk.
 */
(function () {
  const DL = window.DL;
  const Tex = DL.Tex, G = Tex.G;
  const { mul, jitter, valueNoise } = Tex.helpers;
  const C = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  /* ---------------- helpers ---------------- */
  function pickFill(t, pal, w) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let v = t.rand(), acc = 0, c = pal[pal.length - 1];
      for (let i = 0; i < pal.length; i++) { acc += w ? w[i] : 1 / pal.length; if (v < acc) { c = pal[i]; break; } }
      t.set(x, y, c);
    }
  }
  function blotch(t, pal, cell, grain) {
    const n = valueNoise(t, cell === 3 ? 4 : (cell || 4)), g = grain === undefined ? 0.35 : grain;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = Math.max(0, Math.min(0.999, (n[y * 16 + x] || 0) * (1 - g) + t.rand() * g));
      t.set(x, y, pal[Math.floor(v * pal.length)]);
    }
  }
  function logSide(t, base, dark, light) {
    for (let x = 0; x < 16; x++) {
      const st = t.rand();
      for (let y = 0; y < 16; y++) {
        let c = st < 0.3 ? dark : st > 0.8 ? light : base;
        if (t.rand() < 0.1) c = mul(c, 0.85);
        t.set(x, y, jitter(t, c, 0.04));
      }
    }
  }
  function logTop(t, a, b, bark) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
      const r = Math.max(dx, dy) + Math.min(dx, dy) * 0.25;
      t.set(x, y, jitter(t, r > 7 ? bark : (Math.floor(r) % 2 ? a : b), 0.03));
    }
  }
  function leavesT(t, pal, holes) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (t.rand() < holes) { t.set(x, y, [0, 0, 0], 0); continue; }
      t.set(x, y, pal[t.ri(pal.length)]);
    }
  }
  function planksT(t, base) {
    for (let b = 0; b < 4; b++) {
      const off = t.rand() * 10, seam = (b * 7 + 3 + t.ri(3)) % 16;
      for (let yy = 0; yy < 4; yy++) for (let x = 0; x < 16; x++) {
        let c = base;
        const g = Math.sin((x + off) * 0.9 + yy * 2.1) + Math.sin((x * 0.37 + off) * 2.3);
        if (g > 1.1) c = mul(base, 0.88); else if (g < -1.2) c = mul(base, 1.07);
        if (yy === 3) c = mul(base, 0.66);
        if (x === seam && yy < 3) c = mul(base, 0.72);
        t.set(x, b * 4 + yy, jitter(t, c, 0.03));
      }
    }
  }
  function topBand(t, under, pal, deep) {
    under(t);
    for (let x = 0; x < 16; x++) {
      const d = (deep || 2) + (t.rand() < 0.5 ? 1 : 0) + (t.rand() < 0.25 ? 1 : 0);
      for (let y = 0; y < d; y++) t.set(x, y, pal[t.ri(pal.length)]);
    }
  }
  const STEM = [62, 128, 34], STEM2 = [80, 152, 44];
  function plant(t, rows, pal) { t.clear(); t.art(rows, Object.assign({ g: STEM, G: STEM2 }, pal)); }
  function flower(t, petal, petal2, center) {
    plant(t, ['................', '................', '................', '......pP........', '.....pPpP.......', '....PpcpP.......',
      '.....pPpP.......', '......Pp........', '.......g........', '.......g..G.....', '.......gGG......', '....G..g........',
      '.....GGg........', '.......g........', '.......g........', '.......g........'], { p: petal, P: petal2, c: center });
  }
  function tulip(t, a, b) {
    plant(t, ['................', '................', '................', '................', '......a.b.......', '......abab......',
      '......abba......', '......aabb......', '.......ab.......', '.......g........', '...G...g...G....', '...GG..g..GG....',
      '....GG.g.GG.....', '.....GGgGG......', '.......g........', '.......g........'], { a, b });
  }
  const DIRT_FN = (t) => G.dirt(t);

  /* ---------------- woods ---------------- */
  G.birch_log_side = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, t.rand() < 0.15 ? C('#c8c4b4') : C('#dedcd0'), 0.03));
    for (let i = 0; i < 7; i++) { const y = t.ri(16), x = t.ri(14), w = 1 + t.ri(3); for (let k = 0; k < w; k++) t.set(x + k, y, C('#2e2c28')); if (t.rand() < 0.5) t.set(x, y + 1, C('#4a4640')); }
  };
  G.birch_log_top = t => logTop(t, C('#c4a874'), C('#d6bc86'), C('#dedcd0'));
  G.birch_leaves = t => leavesT(t, [C('#6c9840'), C('#80aa4c'), C('#5c8636'), C('#8cb458')], 0.24);
  G.birch_planks = t => planksT(t, C('#c8b07a'));
  G.spruce_log_side = t => logSide(t, C('#4a3420'), C('#362416'), C('#5c4228'));
  G.spruce_log_top = t => logTop(t, C('#6e5030'), C('#7c5c38'), C('#3a2818'));
  G.spruce_leaves = t => leavesT(t, [C('#2c4e34'), C('#345a3c'), C('#24422c'), C('#3c6444')], 0.18);
  G.spruce_planks = t => planksT(t, C('#725432'));
  G.acacia_log_side = t => logSide(t, C('#686258'), C('#544e48'), C('#78726a'));
  G.acacia_log_top = t => logTop(t, C('#ac5c32'), C('#ba683a'), C('#686258'));
  G.acacia_leaves = t => leavesT(t, [C('#6e8c28'), C('#607c22'), C('#7c9832'), C('#88a43a')], 0.22);
  G.acacia_planks = t => planksT(t, C('#a85a32'));
  G.jungle_log_side = t => { logSide(t, C('#564220'), C('#423218'), C('#685428')); for (let i = 0; i < 10; i++) t.set(t.ri(16), t.ri(16), C('#4a5a24')); };
  G.jungle_log_top = t => logTop(t, C('#a07448'), C('#ae8050'), C('#564220'));
  G.jungle_leaves = t => leavesT(t, [C('#30841c'), C('#3c9424'), C('#287418'), C('#48a42c')], 0.16);
  G.jungle_planks = t => planksT(t, C('#a0724c'));
  G.mangrove_log_side = t => logSide(t, C('#543428'), C('#40281e'), C('#644030'));
  G.mangrove_log_top = t => logTop(t, C('#76362e'), C('#843e34'), C('#543428'));
  G.mangrove_leaves = t => leavesT(t, [C('#3c7828'), C('#488830'), C('#326822'), C('#549438')], 0.18);
  G.mangrove_roots = t => {
    t.clear();
    const a = C('#5a402e'), b = C('#46301f');
    for (let i = -16; i < 16; i += 5) for (let k = 0; k < 16; k++) { t.set(k, (k + i + 32) % 16, t.rand() < 0.5 ? a : b); t.set(k, (i - k + 48) % 16, t.rand() < 0.5 ? a : b); }
    for (let y = 0; y < 16; y++) { t.set(7, y, a); t.set(8, y, b); }
  };
  G.mud = t => blotch(t, [C('#363034'), C('#3e383a'), C('#464040'), C('#4c4646')], 4, 0.4);
  G.mangrove_planks = t => planksT(t, C('#76362e'));
  G.cherry_log_side = t => logSide(t, C('#3a2430'), C('#2c1a24'), C('#48303c'));
  G.cherry_log_top = t => logTop(t, C('#d6a098'), C('#e2aea4'), C('#3a2430'));
  G.cherry_leaves = t => leavesT(t, [C('#eea2c4'), C('#f6b8d4'), C('#e28cb4'), C('#facee2')], 0.12);
  G.cherry_planks = t => planksT(t, C('#e2b0a8'));
  G.pale_oak_log_side = t => logSide(t, C('#605c58'), C('#4e4a46'), C('#706c68'));
  G.pale_oak_log_top = t => logTop(t, C('#d4ccc4'), C('#e2dad2'), C('#605c58'));
  G.pale_oak_leaves = t => leavesT(t, [C('#969e92'), C('#a6aca0'), C('#889084'), C('#b2b8ac')], 0.16);
  G.pale_oak_planks = t => planksT(t, C('#e0d8d0'));
  G.pale_moss = t => blotch(t, [C('#6a7262'), C('#767e6c'), C('#848c78'), C('#90987e')], 3, 0.4);
  G.dark_oak_leaves = t => leavesT(t, [C('#2c5c18'), C('#34681e'), C('#265014'), C('#3c7424')], 0.15);
  G.azalea_leaves = t => leavesT(t, [C('#547828'), C('#608630'), C('#486822'), C('#6c9438')], 0.18);
  G.flowering_azalea_leaves = t => { G.azalea_leaves(t); for (let i = 0; i < 9; i++) { const x = t.ri(15), y = t.ri(15); t.set(x, y, C('#d66ebe')); t.set(x + 1, y, C('#e88ad2')); t.set(x, y + 1, C('#c45aaa')); } };

  /* ---------------- ground ---------------- */
  G.red_sand = t => pickFill(t, [C('#be6630'), C('#b25e2c'), C('#c87034'), C('#a65624')], [0.4, 0.3, 0.2, 0.1]);
  const TERRA = { white: '#d2b2a1', orange: '#a15325', yellow: '#ba8523', red: '#8f3d2e', brown: '#4d3323', light_gray: '#876a61' };
  for (const k in TERRA) {
    const base = C(TERRA[k]);
    G[k + '_terracotta'] = t => pickFill(t, [base, mul(base, 0.94), mul(base, 1.05)], [0.55, 0.25, 0.2]);
  }
  G.mycelium_top = t => blotch(t, [C('#605466'), C('#6c5e72'), C('#7a6a7e'), C('#86788a'), C('#94889a')], 3, 0.5);
  G.mycelium_side = t => topBand(t, DIRT_FN, [C('#6c5e72'), C('#7a6a7e'), C('#86788a')]);
  G.podzol_top = t => blotch(t, [C('#4e3412'), C('#5c3e18'), C('#6a4a1e'), C('#7a5626'), C('#5a3a14')], 3, 0.45);
  G.podzol_side = t => topBand(t, DIRT_FN, [C('#5c3e18'), C('#6a4a1e'), C('#7a5626')]);
  G.coarse_dirt = t => { G.dirt(t); for (let i = 0; i < 26; i++) { const x = t.ri(16), y = t.ri(16); t.set(x, y, t.rand() < 0.5 ? C('#5e4a3a') : C('#8a7462')); } };
  G.moss_block = t => blotch(t, [C('#4c6a22'), C('#58782a'), C('#648630'), C('#70943a')], 3, 0.45);
  G.red_mushroom_block = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, C('#b8242a'), 0.06));
    for (const [x, y, r] of [[3, 3, 2], [11, 4, 1.6], [6, 10, 2], [13, 12, 1.5], [1, 13, 1]]) for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) if (xx * xx + yy * yy <= r * r) t.set(x + xx, y + yy, C('#ece6dc'));
  };
  G.brown_mushroom_block = t => blotch(t, [C('#8a6446'), C('#96704e'), C('#a07a56'), C('#7e5a3e')], 4, 0.3);
  G.mushroom_stem = t => { for (let x = 0; x < 16; x++) { const s = t.rand(); for (let y = 0; y < 16; y++) t.set(x, y, jitter(t, s < 0.3 ? C('#c8c0ae') : C('#d8d0c0'), 0.03)); } };
  G.packed_ice = t => {
    pickFill(t, [C('#90b2ec'), C('#9cbcf2'), C('#86a8e2')], [0.5, 0.3, 0.2]);
    for (let i = 0; i < 4; i++) { let x = t.ri(16), y = t.ri(16); for (let k = 0; k < 6; k++) { t.set(x, y, C('#c4dcff')); x += t.ri(3) - 1; y++; } }
  };
  G.blue_ice = t => { pickFill(t, [C('#6a9cec'), C('#5c90e2'), C('#78a8f4')], [0.5, 0.3, 0.2]); for (let i = 0; i < 6; i++) t.set(t.ri(16), t.ri(16), C('#b0d0ff')); };
  G.calcite = t => pickFill(t, [C('#dedfdb'), C('#e8e9e5'), C('#d0d2cd'), C('#f2f2ee')], [0.4, 0.3, 0.2, 0.1]);
  G.dripstone_block = t => { for (let x = 0; x < 16; x++) { const s = t.rand(); for (let y = 0; y < 16; y++) t.set(x, y, jitter(t, s < 0.3 ? C('#7a6050') : s > 0.75 ? C('#9c7c66') : C('#86685a'), 0.05)); } };
  G.pointed_dripstone = t => G.dripstone_block(t);
  G.deepslate = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, (y % 4 === 0 && t.rand() < 0.6) ? C('#3e3e44') : t.rand() < 0.3 ? C('#56565c') : C('#4a4a50'), 0.04));
  };
  G.deepslate_top = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const e = x % 8 === 0 || y % 8 === 0; t.set(x, y, jitter(t, e ? C('#36363c') : C('#4c4c52'), 0.05)); } };
  G.sculk = t => {
    blotch(t, [C('#071a20'), C('#0b242c'), C('#0f2e36'), C('#06141a')], 3, 0.4);
    for (let i = 0; i < 10; i++) t.set(t.ri(16), t.ri(16), t.rand() < 0.5 ? C('#1d8a96') : C('#35c4cc'));
  };
  G.sculk_sensor_top = t => { G.sculk(t); for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) t.set(x, y, (x + y) % 2 ? C('#25a8b4') : C('#0c5660')); };
  G.sculk_sensor_side = t => { G.sculk(t); for (let x = 0; x < 16; x++) { t.set(x, 8, C('#0c5660')); t.set(x, 9, C('#25a8b4')); } };

  /* ---------------- plants ---------------- */
  G.short_grass = t => plant(t, ['................', '................', '................', '................', '..........G.....', '...G......G.....',
    '...G..g...G..G..', '...g..g..Gg..G..', '..Gg..G..gG..g..', '..gG.Gg..gG.Gg..', '..g..gG.Gg..gG..', '.Gg..g..Gg..g...',
    '.g..Gg..g..Gg...', '.g..g..Gg..g....', 'Gg..g..g..Gg....', 'g..Gg..g..g.....']);
  G.fern = t => plant(t, ['................', '................', '.......G........', '......GgG.......', '..G..G.g.G..G...', '...GG..g..GG....',
    '.G..G.Gg.G..G...', '..GG..Gg..GG....', 'G...G..g.G...G..', '.GGG.G.gG.GGG...', '....GGGgGG......', '..GG...g...GG...',
    '.G....Gg.....G..', '.......g........', '.......g........', '.......g........'], { G: [70, 128, 50], g: [56, 108, 40] });
  G.dead_bush = t => plant(t, ['................', '................', '..b.......b.....', '...b..b..b......', '...b...bb...b...', 'b...b..b...b....',
    '.b...b.b..b..b..', '..b...bb.b..b...', '...bb..bb..b....', '.....b.b.bb.....', '......bbb.......', '.......b........',
    '.......b........', '.......b........', '.......B........', '.......B........'], { b: [130, 92, 46], B: [104, 72, 36] });
  G.sunflower = t => plant(t, ['....yYyYy.......', '...YyyYyyY......', '..yYbbbbbYy.....', '..YybBbBbyY.....', '..yYbbBbbYy.....', '..YybBbBbyY.....',
    '..yYbbbbbYy.....', '...YyyYyyY......', '....yYyYy.......', '.......g........', '...GG..g........', '....GG.g..GG....',
    '.....GGgGG......', '.......g........', '.......g........', '.......g........'], { y: [250, 206, 40], Y: [236, 176, 24], b: [92, 56, 22], B: [124, 80, 30] });
  G.cornflower = t => flower(t, [80, 110, 220], [110, 140, 240], [40, 60, 160]);
  G.allium = t => plant(t, ['................', '................', '.....pPpP.......', '....PpPpPp......', '....pPpPpP......', '....PpPpPp......',
    '.....pPpP.......', '.......g........', '.......g........', '.......g........', '...G...g........', '....G..g..G.....',
    '.....G.g.G......', '......Gg........', '.......g........', '.......g........'], { p: [176, 92, 210], P: [204, 128, 232] });
  G.orange_tulip = t => tulip(t, [234, 112, 28], [250, 150, 50]);
  G.pink_tulip = t => tulip(t, [236, 150, 186], [250, 190, 214]);
  G.lily_of_the_valley = t => plant(t, ['................', '................', '................', '.........w......', '....w...wW......', '...wW....g......',
    '....g...g.......', '.....g.g...w....', '......g...wW....', '......g..g......', '......g.g.......', '...G..gg..G.....',
    '....G.g..G......', '.....Gg.G.......', '......gg........', '.......g........'], { w: [244, 244, 236], W: [214, 214, 206] });
  G.pink_petals = t => {
    t.clear();
    for (let i = 0; i < 9; i++) {
      const x = 1 + t.ri(13), y = 1 + t.ri(13);
      t.set(x, y, C('#f2a8cc')); t.set(x + 1, y, C('#f8c4dc')); t.set(x, y + 1, C('#e48cb8')); t.set(x + 1, y + 1, C('#f2a8cc'));
      if (t.rand() < 0.5) t.set(x + 2, y + 1, C('#5a8a30'));
    }
  };
  G.bamboo = t => {
    t.clear();
    for (let y = 0; y < 16; y++) for (let x = 6; x <= 9; x++) t.set(x, y, (y % 6 === 0) ? C('#5c7a1c') : x === 6 ? C('#6e9a26') : x === 9 ? C('#527018') : C('#82ae30'));
  };
  G.lily_pad = t => {
    t.clear();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy);
      if (r > 7.2) continue;
      if (dx > 0 && Math.abs(dy) < dx * 0.35) continue; // the notch
      t.set(x, y, jitter(t, r > 6 ? C('#20601c') : (Math.abs(Math.atan2(dy, dx) * 3 % 1) < 0.15 ? C('#2e7a26') : C('#3a8a2e')), 0.05));
    }
  };
})();
