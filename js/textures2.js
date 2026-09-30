/*
 * DreamLand - textures for the Nether, the End, the Aether and structure blocks,
 * animated portals and the new item sprites.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, Tex = DL.Tex, G = Tex.G;
  const { mix, mul, jitter, valueNoise, voronoiStones, metalBlock, smoothStone } = Tex.helpers;
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
    const n = valueNoise(t, cell || 4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = Math.min(0.999, n[y * 16 + x] * (1 - (grain || 0.35)) + t.rand() * (grain || 0.35));
      t.set(x, y, pal[Math.floor(v * pal.length)]);
    }
  }
  function bricks(t, brick, mortar, bh, bw) {
    bh = bh || 4; bw = bw || 8;
    for (let y = 0; y < 16; y++) {
      const row = Math.floor(y / bh), off = row % 2 ? bw / 2 : 0;
      for (let x = 0; x < 16; x++) {
        if (y % bh === bh - 1 || (x + off) % bw === bw - 1) { t.set(x, y, jitter(t, mortar, 0.05)); continue; }
        let c = brick;
        if (y % bh === 0) c = mul(brick, 1.1);
        t.set(x, y, jitter(t, c, 0.06));
      }
    }
  }
  function speckOre(t, base, cols, clusters) {
    base(t);
    for (let i = 0; i < clusters; i++) {
      const cx = 2 + t.ri(12), cy = 2 + t.ri(12);
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [2, 1]];
      const n = 3 + t.ri(4);
      for (let k = 0; k < n; k++) t.set(cx + pts[k][0], cy + pts[k][1], cols[t.ri(cols.length)]);
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
  function leavesT(t, pal, holes, fill) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (t.rand() < holes) { if (fill) t.set(x, y, fill); else t.set(x, y, [0, 0, 0], 0); continue; }
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
  function grassSide(t, dirt, grass) {
    dirt(t);
    for (let x = 0; x < 16; x++) {
      const d = 2 + (t.rand() < 0.5 ? 1 : 0) + (t.rand() < 0.25 ? 1 : 0);
      for (let y = 0; y < d; y++) t.set(x, y, grass[t.ri(grass.length)]);
    }
  }
  function flower(t, petal, petal2, center) {
    t.clear();
    t.art(['................', '................', '................', '......pP........', '.....pPpP.......', '....PpcpP.......',
      '.....pPpP.......', '......Pp........', '.......g........', '.......g..G.....', '.......gGG......', '....G..g........',
      '.....GGg........', '.......g........', '.......g........', '.......g........'],
    { p: petal, P: petal2, c: center, g: [60, 130, 30], G: [80, 160, 40] });
  }

  /* ---------------- overworld structure blocks ---------------- */
  const SAND = [C('#d8c890'), C('#d0c086'), C('#e0d29c'), C('#c8b77c')];
  G.sandstone_top = t => pickFill(t, SAND, [0.45, 0.25, 0.2, 0.1]);
  G.sandstone_side = t => {
    pickFill(t, SAND, [0.45, 0.25, 0.2, 0.1]);
    for (let x = 0; x < 16; x++) { t.set(x, 0, C('#e6d8a4')); t.set(x, 1, C('#e0d29c')); t.set(x, 11, C('#bfae72')); t.set(x, 15, C('#b8a66a')); }
    for (let i = 0; i < 6; i++) t.set(t.ri(16), 12 + t.ri(3), C('#c4b176'));
  };
  G.sandstone_bottom = t => { pickFill(t, SAND, [0.3, 0.3, 0.1, 0.3]); };
  G.chiseled_sandstone = t => {
    G.sandstone_side(t);
    const d = C('#a89660');
    t.art(['................', '................', '................', '....dddddddd....', '....d......d....', '....d.dddd.d....',
      '....d.d..d.d....', '....d.d..d.d....', '....d.dddd.d....', '....d......d....', '....dddddddd....'], { d });
  };
  G.cobweb = t => {
    t.clear();
    const w = [230, 230, 230];
    for (let i = 0; i < 16; i++) { t.set(i, i, w, 220); t.set(15 - i, i, w, 220); t.set(7, i, w, 180); t.set(i, 8, w, 180); }
    for (const r of [3, 6]) for (let a = 0; a < 24; a++) { const x = Math.round(7.5 + Math.cos(a / 24 * 6.28) * r), y = Math.round(7.5 + Math.sin(a / 24 * 6.28) * r); t.set(x, y, w, 160); }
  };
  G.rail = t => {
    t.clear();
    for (let y = 0; y < 16; y += 4) for (let x = 1; x < 15; x++) { t.set(x, y + 1, [110, 80, 45]); t.set(x, y + 2, [90, 64, 36]); }
    for (let y = 0; y < 16; y++) { t.set(3, y, [170, 170, 175]); t.set(4, y, [120, 120, 125]); t.set(11, y, [170, 170, 175]); t.set(12, y, [120, 120, 125]); }
  };
  const SB = [132, 132, 132];
  G.stone_bricks = t => {
    for (let y = 0; y < 16; y++) {
      const row = y >> 3, off = row ? 4 : 0;
      for (let x = 0; x < 16; x++) {
        const lx = (x + off) % 8, ly = y % 8;
        let c = SB;
        if (ly === 7 || lx === 7) c = [70, 70, 70];
        else if (ly === 0 || lx === 0) c = [160, 160, 160];
        else if (ly === 6 || lx === 6) c = [108, 108, 108];
        t.set(x, y, jitter(t, c, 0.05));
      }
    }
  };
  G.mossy_stone_bricks = t => {
    G.stone_bricks(t);
    const n = valueNoise(t, 4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (n[y * 16 + x] + t.rand() * 0.25 > 0.72) t.set(x, y, jitter(t, [74, 116, 54], 0.12));
  };
  G.cracked_stone_bricks = t => {
    G.stone_bricks(t);
    let x = 3, y = 1;
    for (let i = 0; i < 20; i++) { t.set(x, y, [56, 56, 56]); x += t.ri(3) - 1; y += 1; if (y > 15) { y = 2; x = 10; } }
  };
  G.iron_bars = t => {
    t.clear();
    const m = [170, 172, 176], d = [100, 102, 108];
    for (const bx of [1, 6, 10, 14]) for (let y = 0; y < 16; y++) { t.set(bx, y, m); t.set(bx + 1 > 15 ? bx : bx + 1, y, d); }
    for (const by of [1, 14]) for (let x = 0; x < 16; x++) { t.set(x, by, m); }
  };
  G.dark_planks = t => planksT(t, [74, 48, 24]);
  G.dark_log_side = t => logSide(t, [60, 44, 26], [40, 30, 16], [76, 58, 36]);
  G.dark_log_top = t => logTop(t, [96, 68, 38], [110, 80, 46], [56, 40, 22]);
  G.prismarine = t => blotch(t, [C('#4f8a82'), C('#5e9d93'), C('#6aad9e'), C('#78bba4'), C('#8ecab4')], 4, 0.4);
  G.prismarine_bricks = t => bricks(t, C('#6ab8a8'), C('#3e7a70'), 4, 8);
  G.dark_prismarine = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = C('#335b4c');
      if (x % 8 === 0 || y % 8 === 0) c = C('#1f3e33'); else if (x % 8 === 1 || y % 8 === 1) c = C('#44725f');
      t.set(x, y, jitter(t, c, 0.06));
    }
  };
  G.sea_lantern = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const lx = x % 8, ly = y % 8;
      let c = C('#d8ebe4');
      if (lx === 0 || ly === 0) c = C('#9cc4ba'); else if (lx >= 2 && lx <= 5 && ly >= 2 && ly <= 5) c = C('#f6fffc');
      t.set(x, y, jitter(t, c, 0.03));
    }
  };
  G.hay_side = t => {
    for (let x = 0; x < 16; x++) { const b = t.rand(); for (let y = 0; y < 16; y++) t.set(x, y, jitter(t, b < 0.3 ? C('#b08a22') : b > 0.8 ? C('#e6c24a') : C('#cfa834'), 0.05)); }
    for (const by of [3, 12]) for (let x = 0; x < 16; x++) { t.set(x, by, C('#8e3b1e')); t.set(x, by + 1, C('#6e2c14')); }
  };
  G.hay_top = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const a = Math.atan2(y - 7.5, x - 7.5), r = Math.hypot(x - 7.5, y - 7.5);
      t.set(x, y, jitter(t, Math.sin(a * 3 + r) > 0 ? C('#d8b440') : C('#b8922a'), 0.05));
    }
  };
  G.terracotta = t => pickFill(t, [C('#a2593a'), C('#98522f'), C('#aa6242')], [0.5, 0.3, 0.2]);
  G.emerald_ore = t => { Tex.G.stone(t); speckOre(t, () => { }, [C('#17dd62'), C('#0b8f3c'), C('#b4ffd0')], 3); };
  G.emerald_block = t => metalBlock(t, [60, 204, 110]);
  const PATH = [C('#948044'), C('#8a763e'), C('#9e8a4c'), C('#7c6a36')];
  G.dirt_path_top = t => pickFill(t, PATH, [0.45, 0.25, 0.2, 0.1]);
  G.dirt_path_side = t => { G.dirt(t); for (let x = 0; x < 16; x++) { t.set(x, 0, PATH[0]); t.set(x, 1, PATH[t.ri(4)]); } };
  G.bone_block_side = t => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) t.set(x, y, jitter(t, x % 4 === 0 ? C('#c9c3a8') : C('#e4dfc8'), 0.03)); };
  G.bone_block_top = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      t.set(x, y, jitter(t, r < 2 ? C('#8e8870') : r < 6 && (r | 0) % 2 ? C('#d4ceb6') : C('#e6e1cc'), 0.03));
    }
  };
  G.cauldron_side = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, (x === 0 || y === 0) ? [86, 86, 90] : (x === 15 || y === 15) ? [36, 36, 40] : [58, 58, 62], 0.06)); };
  G.cauldron_top = t => { G.cauldron_side(t); };
  G.cauldron_inner = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, [44, 44, 48], 0.08)); };

  /* ---------------- nether ---------------- */
  const NR = [C('#50201e'), C('#632a28'), C('#6f3634'), C('#7e4442'), C('#8e5250')];
  G.netherrack = t => blotch(t, NR, 4, 0.45);
  G.soul_sand = t => {
    pickFill(t, [C('#54402f'), C('#5e4a38'), C('#4a382a')], [0.5, 0.3, 0.2]);
    for (let i = 0; i < 4; i++) {
      const x = 1 + t.ri(12), y = 1 + t.ri(12);
      t.set(x, y, C('#2a1e16')); t.set(x + 2, y, C('#2a1e16')); t.set(x + 1, y + 2, C('#30221a')); t.set(x, y + 2, C('#3a2a1f')); t.set(x + 2, y + 2, C('#3a2a1f'));
    }
  };
  G.glowstone = t => {
    const pal = [C('#8a5a2c'), C('#c88c46'), C('#e8b45c'), C('#fcd67a'), C('#fff2bc')];
    const { cellOf, edge } = voronoiStones(t, [200, 150, 80], [120, 80, 40], 9, 0.1);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = y * 16 + x;
      t.set(x, y, edge[i] ? pal[t.ri(2)] : pal[2 + ((cellOf[i] * 7 + (t.rand() < 0.2 ? 1 : 0)) % 3)]);
    }
  };
  G.nether_bricks = t => {
    for (let y = 0; y < 16; y++) {
      const off = (y >> 2) % 2 ? 4 : 0;
      for (let x = 0; x < 16; x++) {
        let c = C('#2e1418');
        if (y % 4 === 3 || (x + off) % 8 === 7) c = C('#160a0c');
        else if (y % 4 === 0) c = C('#46222a');
        t.set(x, y, jitter(t, c, 0.08));
      }
    }
  };
  for (let s = 0; s < 3; s++) {
    G['nether_wart_' + s] = t => {
      t.clear();
      const stem = C('#6a1414'), bump = C('#b0202a'), hi = C('#e8484c');
      for (const x of [2, 6, 10, 13]) {
        const h = 3 + s * 3 + (x % 3);
        for (let y = 15; y > 15 - h; y--) t.set(x + ((y + x) % 4 === 0 ? 1 : 0), y, stem);
        const ty = 15 - h;
        if (s > 0) { t.set(x - 1, ty, bump); t.set(x, ty - 1, bump); t.set(x + 1, ty, bump); t.set(x, ty, hi); }
        if (s > 1) { t.set(x - 1, ty - 1, bump); t.set(x + 1, ty - 1, hi); }
      }
    };
  }
  G.quartz_ore = t => speckOre(t, G.netherrack, [C('#f0ebe0'), C('#d8cfc0'), C('#ffffff')], 5);
  G.magma = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const edge = (x % 5 === 0) || ((y + (x > 7 ? 2 : 0)) % 5 === 0);
      t.set(x, y, edge ? jitter(t, C('#f48a1c'), 0.15) : jitter(t, C('#5a200c'), 0.2));
    }
  };
  const BS = [C('#2a242a'), C('#332c33'), C('#3d353c'), C('#231e23')];
  G.blackstone = t => blotch(t, BS, 4, 0.4);
  G.blackstone_top = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); t.set(x, y, jitter(t, (r | 0) % 3 === 0 ? BS[3] : BS[1], 0.1)); } };
  G.polished_blackstone_bricks = t => bricks(t, C('#3a3238'), C('#1a161a'), 8, 8);
  G.gilded_blackstone = t => { G.blackstone(t); for (let i = 0; i < 8; i++) { const x = t.ri(15), y = t.ri(15); t.set(x, y, C('#f6c83a')); t.set(x + 1, y, C('#c8961c')); } };
  G.crying_obsidian = t => {
    G.obsidian(t);
    for (let i = 0; i < 5; i++) { const x = t.ri(16); let y = t.ri(8); for (let k = 0; k < 4 + t.ri(5) && y < 16; k++, y++) t.set(x, y, k === 0 ? C('#e060ff') : C('#8a24d8')); }
  };

  /* ---------------- end ---------------- */
  G.end_stone = t => {
    pickFill(t, [C('#dcdfa4'), C('#d4d69a'), C('#e4e7b0'), C('#c8ca8c')], [0.45, 0.25, 0.2, 0.1]);
    for (let i = 0; i < 6; i++) { const x = t.ri(15), y = t.ri(15); t.set(x, y, C('#b4b67a')); t.set(x + 1, y + 1, C('#eef0c4')); }
  };
  G.end_portal = t => {
    t.fill([6, 10, 16]);
    const cols = [C('#1c7a6a'), C('#2cc6b2'), C('#aaf8ee'), C('#3a4ab8'), C('#ffffff')];
    for (let i = 0; i < 22; i++) t.set(t.ri(16), t.ri(16), cols[t.ri(cols.length)]);
  };
  G.end_frame_side = t => {
    G.end_stone(t);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, y === 3 ? C('#2d5a4e') : C('#3e7466'), 0.08));
  };
  G.end_frame_top = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      t.set(x, y, jitter(t, r < 4 ? C('#1c2e2a') : r < 5 ? C('#2e5248') : C('#4a8474'), 0.06));
    }
  };
  G.end_frame_eye = t => {
    G.end_frame_top(t);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.hypot(x - 7.5, y - 7.5);
      if (r < 3.6) t.set(x, y, r < 1.3 ? C('#0a1a10') : r < 2.4 ? C('#3aa874') : C('#2a7a58'));
    }
    t.set(6, 6, C('#c8ffe0'));
  };
  G.dragon_egg = t => { pickFill(t, [C('#12081a'), C('#1c0e28'), C('#0c0612')], [0.5, 0.3, 0.2]); for (let i = 0; i < 8; i++) t.set(t.ri(16), t.ri(16), C('#6a2a9a')); };
  G.purpur_block = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const lx = x % 8, ly = y % 8;
      let c = C('#a97ea9');
      if (lx === 0 || ly === 0) c = C('#c6a0c6'); else if (lx === 7 || ly === 7) c = C('#7e5a7e');
      t.set(x, y, jitter(t, c, 0.05));
    }
  };
  G.purpur_pillar_side = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, x % 4 === 0 ? C('#8a668a') : x % 4 === 1 ? C('#c09cc0') : C('#aa84aa'), 0.04)); };
  G.purpur_pillar_top = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); t.set(x, y, jitter(t, (r | 0) % 3 === 0 ? C('#8a668a') : C('#b28eb2'), 0.04)); } };
  G.end_stone_bricks = t => bricks(t, C('#e0e2a8'), C('#a8aa74'), 8, 8);
  G.end_rod = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, x % 8 < 1 ? C('#d6c8dc') : C('#fbf6ff')); };
  G.chorus_plant = t => { pickFill(t, [C('#5e3c5c'), C('#6c4a6a'), C('#80607e'), C('#4a2c48')], [0.35, 0.3, 0.2, 0.15]); };
  G.chorus_flower = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.hypot(x - 7.5, y - 7.5);
      t.set(x, y, jitter(t, r < 3 ? C('#e8d8ec') : (Math.floor(Math.atan2(y - 7.5, x - 7.5) * 2.5) % 2 ? C('#b28eb6') : C('#9a749e')), 0.05));
    }
  };

  /* ---------------- aether ---------------- */
  const AG = [C('#8fd88a'), C('#7fcc7c'), C('#a2e69c'), C('#6cbc6c'), C('#b8f0b0')];
  const AD = () => (t) => pickFill(t, [C('#a8a584'), C('#9a9776'), C('#b6b392'), C('#8c8a6c')], [0.45, 0.25, 0.2, 0.1]);
  G.aether_grass_top = t => pickFill(t, AG, [0.35, 0.25, 0.2, 0.12, 0.08]);
  G.aether_dirt = AD();
  G.aether_grass_side = t => grassSide(t, AD(), AG.slice(0, 4));
  const HS = [C('#c4c4c4'), C('#b4b4b4'), C('#d2d2d2'), C('#a8a8a8'), C('#dedede')];
  G.holystone = t => blotch(t, HS, 4, 0.4);
  G.mossy_holystone = t => { G.holystone(t); const n = valueNoise(t, 4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (n[y * 16 + x] + t.rand() * 0.3 > 0.75) t.set(x, y, jitter(t, [90, 170, 140], 0.1)); };
  G.holystone_bricks = t => bricks(t, C('#d0d0d0'), C('#8a8a8a'), 4, 8);
  G.quicksoil = t => { pickFill(t, [C('#e6d690'), C('#dcca80'), C('#f0e2a4')], [0.5, 0.3, 0.2]); for (let i = 0; i < 10; i++) t.set(t.ri(16), t.ri(16), [255, 252, 220]); };
  G.icestone = t => { blotch(t, [C('#a8c4dc'), C('#b8d2e8'), C('#c8def0'), C('#dcecf8')], 4, 0.4); for (let i = 0; i < 6; i++) t.set(t.ri(16), t.ri(16), [255, 255, 255]); };
  G.ambrosium_ore = t => speckOre(t, G.holystone, [C('#fae45a'), C('#f0c830'), C('#fff6b0')], 4);
  G.zanite_ore = t => speckOre(t, G.holystone, [C('#9a50e0'), C('#6e2cb8'), C('#c490ff')], 4);
  G.gravitite_ore = t => speckOre(t, G.holystone, [C('#e060d0'), C('#b03aa6'), C('#ffb0f4')], 3);
  G.skyroot_log_side = t => logSide(t, [128, 128, 108], [100, 100, 84], [150, 150, 128]);
  G.skyroot_log_top = t => logTop(t, [176, 168, 128], [192, 184, 144], [118, 118, 98]);
  G.skyroot_planks = t => planksT(t, [186, 176, 132]);
  G.skyroot_leaves = t => leavesT(t, [C('#5ec48a'), C('#4eb07a'), C('#72d49a'), C('#3e9a68')], 0.2);
  G.golden_oak_log_side = t => { G.skyroot_log_side(t); for (let i = 0; i < 10; i++) { const x = t.ri(16); for (let y = t.ri(10), k = 0; k < 4; k++) t.set(x, y + k, [220, 180, 60]); } };
  G.golden_oak_leaves = t => leavesT(t, [C('#f2d04c'), C('#e2b830'), C('#fae47a'), C('#c89a20')], 0.2);
  G.aercloud = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, [244, 246, 250], 0.03), 205); };
  G.blue_aercloud = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, [140, 200, 255], 0.05), 205); };
  G.purple_flower = t => flower(t, [150, 70, 210], [190, 120, 240], [250, 230, 120]);
  G.white_flower = t => flower(t, [236, 236, 244], [255, 255, 255], [240, 200, 80]);
  G.zanite_block = t => metalBlock(t, [146, 86, 214]);
  G.nether_portal = t => t.fill([120, 40, 200, 180]);
  G.aether_portal = t => t.fill([60, 120, 255, 180]);
  void mix; void smoothStone;

  /* ---------------- animated portals ---------------- */
  function PortalFX(kind) {
    this.frames = [];
    const r = new S.RNG(kind === 'nether' ? 101 : 202);
    for (let i = 0; i < 32; i++) {
      const d = new Uint8ClampedArray(1024);
      for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
        let f = 0;
        for (let k = 0; k < 2; k++) {
          const o = k * 8;
          let fx = (x - o) / 16 * 2, fy = (y - o) / 16 * 2;
          if (fx < -1) fx += 2; if (fx >= 1) fx -= 2; if (fy < -1) fy += 2; if (fy >= 1) fy -= 2;
          const f4 = fx * fx + fy * fy;
          let f5 = Math.atan2(fy, fx) + (i / 32 * Math.PI * 2 - f4 * 10 + k * 2) * (k * 2 - 1);
          f5 = (Math.sin(f5) + 1) / 2 / (f4 + 1);
          f += f5 * 0.5;
        }
        f += r.next() * 0.1;
        const o = (y * 16 + x) * 4;
        if (kind === 'nether') { d[o] = f * f * 200 + 55; d[o + 1] = f * f * f * f * 255; d[o + 2] = f * 100 + 155; d[o + 3] = f * 100 + 155; }
        else { d[o] = f * f * 120 + 40; d[o + 1] = f * f * 160 + 90; d[o + 2] = 255; d[o + 3] = f * 100 + 150; }
      }
      this.frames.push(d);
    }
    this.i = 0; this.data = this.frames[0];
  }
  PortalFX.prototype.tick = function () { this.i = (this.i + 1) % 32; this.data = this.frames[this.i]; };
  Tex.anims.push({ tile: S.T.nether_portal, fx: new PortalFX('nether') }, { tile: S.T.aether_portal, fx: new PortalFX('aether') });

  /* ---------------- items ---------------- */
  const A = Tex.ITEM_ART;
  A.glowstone_dust = [['................', '................', '................', '.....y..........', '....yYy...y.....', '...yYWYy.yYy....', '....yYy...y.....', '.......y........', '......yYy.......', '..y....y...y....', '.yYy......yYy...', '..y........y....'], { y: [200, 150, 60], Y: [250, 210, 110], W: [255, 250, 200] }, 1];
  A.quartz = [['................', '................', '.....ww.........', '....wWWw..ww....', '...wWWWWwwWWw...', '...wWWWWWWWWw...', '....wWWWWWWw....', '...wwWWWWWww....', '..wWWWwwWWWw....', '...wwww..www....'], { w: [210, 200, 190], W: [245, 240, 234] }, 3];
  A.nether_wart = [['................', '................', '......rr........', '.....rRRr.......', '....rRhRRr......', '....rRRRRr......', '.....rRRr.rr....', '....rr.srrRRr...', '...rRRr.sRRRr...', '...rRRr..rr.....', '....rr..........'], { r: [120, 20, 24], R: [180, 34, 40], h: [240, 90, 90], s: [90, 20, 20] }, 3];
  A.blaze_rod = [['..............yo', '.............yYo', '............yYo.', '...........yYo..', '..........yYo...', '.........yYo....', '........yYo.....', '.......yYo......', '......yYo.......', '.....yYo........', '....yYo.........', '...yYo..........', '..yYo...........', '.yYo............', 'yYo.............', 'yo..............'], { y: [250, 210, 60], Y: [255, 250, 180], o: [210, 130, 20] }, 0];
  A.blaze_powder = [['................', '................', '................', '.......o........', '.....o.Yo.o.....', '....oYyyYyo.....', '...oyYyYyYyo....', '...yYyWyyYyo....', '..oyyYyyYyyo....', '...oyYyYyyo.....', '....ooyyoo......'], { y: [240, 170, 40], Y: [255, 230, 110], W: [255, 255, 220], o: [200, 100, 20] }, 3];
  A.ghast_tear = [['................', '................', '.......ww.......', '......wWWw......', '......wWWw......', '.....wWWWWw.....', '....wWWWWWWw....', '....wWWWWWbw....', '....wWWWWbbw....', '.....wWbbbw.....', '......wwww......'], { w: [170, 210, 220], W: [235, 250, 255], b: [140, 190, 210] }, 3];
  A.magma_cream = [['................', '................', '................', '.....oooo.......', '...ooOyyOoo.....', '..oOyyyyyyOo....', '..oyyYYyyyOo....', '..oOyyyyyyOo....', '...ooOyyOoo.....', '.....oooo.......'], { o: [120, 40, 10], O: [200, 80, 20], y: [250, 170, 40], Y: [255, 240, 150] }, 3];
  A.gold_nugget = [['................', '................', '................', '................', '......oo........', '.....oYYo.......', '....oYYyyo.o....', '...oYyyyyooYo...', '...oyyyyyo.oo...', '....ooooo.......'], { o: [150, 100, 10], Y: [255, 245, 160], y: [245, 200, 50] }, 3];
  A.nether_brick = [['................', '................', '................', '................', '.....oooooooo...', '....obbbbbbbbo..', '...obBBBBBBbbo..', '..obbbbbbbbbo...', '..odddddddddo...', '...ooooooooo....'], { o: [20, 8, 10], b: [60, 28, 34], B: [86, 44, 52], d: [40, 18, 22] }, 3];
  A.fire_charge = [['................', '................', '.....oooooo.....', '....oRyRRyRo....', '...oRkyRRkRRo...', '...oyRRkyRRyo...', '...oRkRyRRkRo...', '...oRRyRkRyRo...', '....oRRyRRRo....', '.....oooooo.....'], { o: [40, 20, 10], R: [150, 50, 20], y: [250, 170, 40], k: [30, 20, 20] }, 3];
  A.ender_pearl = [['................', '................', '................', '......oooo......', '....ooGGggoo....', '...oGWGGgggGo...', '...oGGGggGggo...', '...ogGgggggGo...', '...oggGggGggo...', '....oogggGoo....', '......oooo......'], { o: [10, 50, 44], G: [60, 170, 140], g: [30, 110, 96], W: [210, 255, 240] }, 2];
  A.eye_of_ender = [['................', '................', '................', '......oooo......', '....ooGGGGoo....', '...oGGYYYYGGo...', '...oGYYkkYYGo...', '...oGYYkkYYGo...', '...oGGYYYYGGo...', '....ooGGGGoo....', '......oooo......'], { o: [10, 50, 44], G: [60, 170, 140], Y: [120, 220, 110], k: [10, 20, 10] }, 2];
  A.chorus_fruit = [['................', '................', '................', '.....pppp.......', '....pPPpPp......', '...pPpPPpPp.....', '...pPPpPPPp.....', '...ppPPpPpp.....', '....pPpPPp......', '.....pppp.......'], { p: [100, 60, 100], P: [160, 110, 160] }, 3];
  A.popped_chorus_fruit = [['................', '................', '................', '.....pppp.......', '....pPPPPp......', '...pPWPPWPp.....', '...pPPPPPPp.....', '...pPWPPPWp.....', '....pPPPPp......', '.....pppp.......'], { p: [140, 90, 140], P: [200, 160, 200], W: [250, 230, 250] }, 3];
  A.shulker_shell = [['................', '................', '...oooooooooo...', '..oPPPPPPPPPPo..', '..oPpPPPPPPpPo..', '..oPPPPPPPPPPo..', '..oppppppppppo..', '..oPPPPPPPPPPo..', '..oPPPPPPPPPPo..', '...oooooooooo...'], { o: [60, 30, 60], P: [150, 100, 150], p: [100, 60, 100] }, 3];
  A.elytra = [['................', '..oo........oo..', '.oggo......oggo.', '.oGggo....oggGo.', 'oGGggo....oggGGo', 'oGGgggo..ogggGGo', 'oGGggggoogggGGGo', 'oGgggggggggggGGo', 'oggggggoogggggo.', '.oggggo..oggggo.', '..oggo....oggo..', '...oo......oo...'], { o: [40, 40, 50], g: [120, 120, 140], G: [170, 170, 190] }, 2];
  A.emerald = [['................', '.......oo.......', '......oGGo......', '.....oGWggo.....', '....oGWgggGo....', '....oGggggGo....', '....oGgggGgo....', '....oGggggGo....', '.....oGggGo.....', '......oGGo......', '.......oo.......'], { o: [0, 80, 30], G: [40, 200, 100], g: [20, 150, 70], W: [200, 255, 220] }, 2];
  A.bone_meal = [['................', '................', '................', '................', '.....w..........', '....wWw..w......', '...wWWWwwWw.....', '..wWWwWWWWWw....', '..wWWWWWwWWWw...', '...wwWWWWWww....'], { w: [200, 200, 190], W: [245, 245, 238] }, 3];
  A.rotten_flesh = [['................', '................', '................', '......oooo......', '....ooRgRRoo....', '...oRRgggRRRo...', '..oRgRRRgRgRRo..', '..oRRRgRRRRgRo..', '...oRgRRRgRo....', '....oRRgRo......', '.....ooo........'], { o: [70, 30, 20], R: [150, 70, 50], g: [110, 130, 60] }, 2];
  A.ink_sac = [['................', '................', '................', '.....oooo.......', '....oKKKKo......', '...oKkKKKKo.....', '...oKKKKKKo.....', '...oKKKKKko.....', '....oKKKko......', '...oKo..oKo.....', '..oKo....oKo....'], { o: [20, 20, 30], K: [50, 50, 70], k: [90, 90, 120] }, 2];
  A.slimeball = [['................', '................', '................', '.....gggg.......', '....gGGGGg......', '...gGWGGGGg.....', '...gGGGGGGg.....', '...gGGGGGgg.....', '....gGGGgg......', '.....gggg.......'], { g: [70, 150, 60], G: [120, 210, 100], W: [220, 255, 200] }, 3];
  A.rabbit_hide = [['................', '................', '....oooooooo....', '...obBbbbBbbo...', '...obbbbbbbbo...', '....obbBbbbo....', '....obbbbbbo....', '...obbbbbBbbo...', '...obBbbbbbbo...', '....oooooooo....'], { o: [80, 50, 30], b: [180, 140, 100], B: [140, 100, 70] }, 3];
  A.raw_rabbit = [['................', '................', '................', '......oooo......', '....ooPPPPoo....', '...oPPpPPPPPo...', '..oPPPPPPpPPPo..', '..oPPPPPPPPPPo..', '...oPPPPPPPo....', '....oooooo......'], { o: [140, 60, 60], P: [240, 170, 160], p: [220, 140, 130] }, 3];
  A.splash_potion = [['................', '.......oo.......', '......ocko......', '.......oo.......', '......o..o......', '.....oPPPPo.....', '....oPWPPPPo....', '....oPPPPPPo....', '....oPPPPPPo....', '.....oPPPPo.....', '......oooo......'], { o: [60, 60, 80], c: [140, 100, 60], k: [120, 80, 40], P: [120, 40, 200], W: [230, 200, 255] }, 2];
  A.shulker_bullet = [['................', '................', '................', '......oooo......', '.....oWWWWo.....', '....oWYYYYWo....', '....oWYYYYWo....', '.....oWWWWo.....', '......oooo......'], { o: [120, 100, 40], W: [250, 250, 230], Y: [240, 220, 120] }, 4];
  A.ambrosium_shard = [['................', '................', '.......y........', '......yYy.......', '.....yYWYy......', '....yYYYYYy.....', '.....yYYYy......', '......yYy.......', '.......y........'], { y: [220, 180, 30], Y: [255, 235, 100], W: [255, 255, 220] }, 4];
  A.zanite_gemstone = [['................', '................', '......oooo......', '.....oPWPPo.....', '....oPWPPPPo....', '....oPPPPPPo....', '....oPPPPPpo....', '.....oPPPpo.....', '......oppo......', '.......oo.......'], { o: [50, 20, 90], P: [150, 90, 220], p: [100, 50, 170], W: [220, 190, 255] }, 3];
  A.golden_amber = [['................', '................', '................', '......oooo......', '.....oYYyYo.....', '....oYWYYyyo....', '....oYYYYyyo....', '.....oYyyyo.....', '......oooo......'], { o: [150, 90, 10], Y: [250, 200, 60], y: [220, 150, 30], W: [255, 250, 200] }, 4];
  A.skyroot_stick = [A.stick[0], { s: [120, 116, 96], S: [176, 168, 128], k: [70, 68, 56], o: [70, 68, 56] }, 1];
  // zanite tools use the classic tool silhouettes
  Tex.extraToolMats = ['zanite', 'gravitite'];
  Tex.MAT.gravitite = { o: [60, 20, 60], d: [170, 60, 170], m: [220, 110, 220], l: [255, 190, 255] };
  Tex.MAT.zanite = { o: [50, 20, 90], d: [100, 50, 170], m: [150, 90, 220], l: [210, 170, 255] };
})();
