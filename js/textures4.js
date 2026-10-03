/*
 * DreamLand - the "Modern" texture set: block and tool textures redrawn in
 * the style of today's Minecraft (soft shading, beveled stones, staggered
 * planks, ores with highlights, a crafting table that is a real table with
 * the crafting grid on top, a stone furnace with a glowing mouth...).
 * Water, lava, fire and portals keep DreamLand's own animated textures.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, Tex = DL.Tex, G = Tex.G;
  const { valueNoise } = Tex.helpers;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const P = (s) => s.split(' ').map(hex);
  const cl = (v) => v < 0 ? 0 : v > 255 ? 255 : v;
  const mul = (c, f) => [cl(c[0] * f), cl(c[1] * f), cl(c[2] * f)];
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const wrapD = (d) => { d = Math.abs(d) % 16; return d > 8 ? 16 - d : d; };
  const KEEP = new Set(['water', 'water_flow', 'lava', 'lava_flow', 'fire', 'fire_2', 'nether_portal', 'aether_portal', 'end_portal', 'white']);
  // DreamLand's original (classic) painters, so the style can be switched back in Options
  const CLASSIC = Object.assign({}, G), classicTool = Tex.paintTool || null;

  /* ------------------------------------------------------------ */
  /* Toolkit                                                      */
  /* ------------------------------------------------------------ */
  // fractal value noise on the 16x16 torus, 0..1
  function fbm(t, cells, weights) {
    const out = new Float32Array(256);
    let tot = 0;
    cells.forEach((c, i) => {
      const w = weights ? weights[i] : 1 / (i + 1);
      tot += w;
      const n = valueNoise(t, c);
      for (let k = 0; k < 256; k++) out[k] += n[k] * w;
    });
    for (let k = 0; k < 256; k++) out[k] /= tot;
    return out;
  }
  // stretch a field to use the whole 0..1 range
  function norm(f) {
    let lo = 1e9, hi = -1e9;
    for (const v of f) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const k = hi > lo ? 1 / (hi - lo) : 0;
    for (let i = 0; i < f.length; i++) f[i] = (f[i] - lo) * k;
    return f;
  }
  const pick = (pal, v) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))];
  // a noisy natural surface: blotches + grain, mapped on a palette ramp (dark -> light)
  function surface(t, pal, o) {
    o = o || {};
    const f = norm(fbm(t, o.cells || [8, 4, 2], o.weights || [0.5, 0.35, 0.15]));
    const grain = o.grain === undefined ? 0.35 : o.grain;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = f[y * 16 + x] * (1 - grain) + t.rand() * grain;
      t.set(x, y, pick(pal, v));
    }
    return f;
  }
  // scatter little pebbles / specks: [[color, chance], ...]
  function specks(t, list, avoid) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (avoid && avoid(x, y)) continue;
      for (const [c, p] of list) if (t.rand() < p) { t.set(x, y, c); break; }
    }
  }
  // tileable Voronoi "stones" with mortar, bevels and per-stone shades
  function stones(t, o) {
    const g = o.grid || 3, pts = [];
    for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
      const jx = o.jitter === undefined ? 0.6 : o.jitter;
      pts.push({ x: (i + 0.5 + (t.rand() - 0.5) * jx) * 16 / g + (j % 2) * (o.stagger || 0), y: (j + 0.5 + (t.rand() - 0.5) * jx) * 16 / g, k: t.rand() });
    }
    const R = 16 / g / 2;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let d1 = 1e9, d2 = 1e9, best = null;
      for (const p of pts) {
        const dx = wrapD(x + 0.5 - p.x), dy = wrapD(y + 0.5 - p.y);
        const d = Math.sqrt(dx * dx * (o.sx || 1) + dy * dy * (o.sy || 1));
        if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d;
      }
      const edge = d2 - d1;
      if (edge < (o.mortar || 0.9)) { t.set(x, y, pick(o.gap, t.rand())); continue; }
      // light from the top left
      let ddx = x + 0.5 - best.x, ddy = y + 0.5 - best.y;
      if (ddx > 8) ddx -= 16; if (ddx < -8) ddx += 16; if (ddy > 8) ddy -= 16; if (ddy < -8) ddy += 16;
      let v = 0.55 + (best.k - 0.5) * (o.vary === undefined ? 0.5 : o.vary) - (ddx + ddy) / (R * 4.2);
      if (edge < (o.mortar || 0.9) + 1.1) v += (ddx + ddy) > 0 ? -0.22 : 0.18;
      v += (t.rand() - 0.5) * (o.grain === undefined ? 0.25 : o.grain);
      t.set(x, y, pick(o.pal, Math.max(0, Math.min(0.999, v))));
    }
  }
  // ore clusters on top of a base painter: [x, y, shape]
  const ORE_SHAPES = [
    ['.ab.', 'abbc', '.bc.'],
    ['ab.', 'bbc', '.c.'],
    ['.a', 'bc'],
    ['ab', 'bc'],
    ['.ab', 'abc', 'bc.'],
    ['a..', 'bb.', '.bc']
  ];
  function ore(t, base, pal, spots) {
    base(t);
    for (const [x, y, s] of spots) {
      const rows = ORE_SHAPES[s % ORE_SHAPES.length];
      for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
        const ch = rows[j][i];
        if (ch === '.') continue;
        const c = ch === 'a' ? pal[2] : ch === 'b' ? pal[1] : pal[0];
        t.set((x + i) & 15, (y + j) & 15, c);
      }
    }
  }
  // staggered planks: 4 boards, grain streaks, seams
  function planks(t, o) {
    const [dark, mid, light, gap] = [o.dark, o.mid, o.light, o.gap];
    const seams = o.seams || [[0], [8], [4, 12], [10]];
    for (let b = 0; b < 4; b++) {
      for (let y = b * 4; y < b * 4 + 4; y++) for (let x = 0; x < 16; x++) {
        let c;
        if (y === b * 4 + 3) c = gap;
        else if (seams[b].includes(x)) c = gap;
        else {
          const r = t.rand();
          c = y === b * 4 ? (r < 0.7 ? light : mid) : (r < 0.15 ? dark : r < 0.75 ? mid : light);
        }
        t.set(x, y, c);
      }
      // grain streaks
      for (let k = 0; k < 3; k++) {
        const y = b * 4 + 1 + t.ri(2), x0 = t.ri(16), len = 2 + t.ri(4);
        for (let i = 0; i < len; i++) { const x = (x0 + i) & 15; if (!seams[b].includes(x)) t.set(x, y, dark); }
      }
      // a highlight just after each seam
      for (const sx of seams[b]) for (let y = b * 4; y < b * 4 + 3; y++) t.set((sx + 1) & 15, y, mix(light, mid, 0.3));
    }
  }
  // vertical bark
  function bark(t, o) {
    const cols = [];
    for (let x = 0; x < 16; x++) cols.push(t.rand());
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
      const ridge = cols[x] < 0.28 ? 0 : cols[x] > 0.78 ? 2 : 1;
      let c = [o.dark, o.mid, o.light][ridge];
      const r = t.rand();
      if (r < 0.12) c = o.dark; else if (r > 0.94) c = o.light;
      t.set(x, y, c);
    }
    // horizontal cracks
    for (let k = 0; k < (o.cracks || 5); k++) {
      const x = t.ri(16), y = t.ri(16), len = 1 + t.ri(3);
      for (let i = 0; i < len; i++) t.set((x + i) & 15, y, o.crack || mul(o.dark, 0.85));
    }
    if (o.spots) for (let k = 0; k < o.spots; k++) { const x = t.ri(15), y = t.ri(15); t.set(x, y, o.spot); t.set(x + 1, y, o.spot); }
  }
  // log end: bark ring + growth rings
  function rings(t, o) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
      const r = Math.max(dx, dy);
      let c;
      if (r > 6.6) c = t.rand() < 0.3 ? o.barkDark : o.bark;
      else {
        const ring = Math.floor(r + (t.rand() < 0.15 ? 0.5 : 0));
        c = ring % 2 === 0 ? o.light : o.mid;
        if (r < 1.2) c = o.dark;
        if (t.rand() < 0.08) c = mix(c, o.dark, 0.5);
      }
      t.set(x, y, c);
    }
  }
  // beveled block frame: light top-left edges, dark bottom-right
  function bevel(t, lightC, darkC, inset) {
    const i0 = inset || 0, i1 = 15 - (inset || 0);
    for (let k = i0; k <= i1; k++) { t.set(k, i0, lightC); t.set(i0, k, lightC); t.set(k, i1, darkC); t.set(i1, k, darkC); }
  }
  const art = (t, rows, pal, ox, oy) => { t.art(rows, pal, ox || 0, oy || 0); return t; };
  Tex.kit = { hex, P, mix, mul, cl, fbm, norm, pick, surface, specks, stones, ore, planks, bark, rings, bevel, art, stoneBricks };

  /* ------------------------------------------------------------ */
  /* Palettes                                                     */
  /* ------------------------------------------------------------ */
  const STONE = P('#626262 #6d6d6d #767676 #7e7e7e #868686 #8f8f8f');
  const DIRT = P('#5a3c27 #6b4a31 #79563a #866043 #926a4a #9f7654');
  const GRASS = P('#4a8228 #56912f #5f9c35 #69a83c #74b444 #82c04e');
  const SAND = P('#cdbf8c #d6c998 #dbcfa2 #e0d5ab #e7ddb7');
  const OAK = { dark: hex('#7a5f36'), mid: hex('#a2834f'), light: hex('#b8955c'), gap: hex('#5e4824') };

  /* ------------------------------------------------------------ */
  /* Natural blocks                                               */
  /* ------------------------------------------------------------ */
  G.stone = t => {
    surface(t, STONE, { cells: [8, 4, 2], weights: [0.55, 0.3, 0.15], grain: 0.22 });
    // a few soft horizontal streaks
    for (let k = 0; k < 4; k++) { const y = t.ri(16), x0 = t.ri(16), len = 2 + t.ri(4); for (let i = 0; i < len; i++) t.set((x0 + i) & 15, y, STONE[1]); }
  };
  G.dirt = t => {
    surface(t, DIRT.slice(1, 5), { cells: [4, 2], weights: [0.5, 0.5], grain: 0.5 });
    specks(t, [[DIRT[0], 0.05], [DIRT[5], 0.04], [hex('#b08560'), 0.012]]);
  };
  G.grass_top = t => {
    surface(t, GRASS, { cells: [8, 4, 2, 1], weights: [0.3, 0.3, 0.2, 0.2], grain: 0.4 });
    // little blades: a bright pixel over a dark one
    for (let k = 0; k < 14; k++) { const x = t.ri(16), y = t.ri(16); t.set(x, y, GRASS[5]); t.set(x, (y + 1) & 15, GRASS[1]); }
  };
  const grassFringe = (t, colors, deep) => {
    // the overhang: 3 rows of grass with drips down to 5-6
    const drip = [];
    for (let x = 0; x < 16; x++) drip.push(3 + (t.rand() < 0.45 ? 1 : 0) + (t.rand() < (deep || 0.18) ? 1 : 0));
    for (let x = 0; x < 16; x++) {
      if (x > 0 && Math.abs(drip[x] - drip[x - 1]) > 1) drip[x] = drip[x - 1] + Math.sign(drip[x] - drip[x - 1]);
      for (let y = 0; y < drip[x]; y++) t.set(x, y, pick(colors, t.rand() * 0.75 + (y === 0 ? 0.25 : 0)));
      t.set(x, drip[x] - 1, colors[0]);
    }
  };
  G.grass_side = t => { G.dirt(t); grassFringe(t, GRASS); };
  G.grass_side_snow = t => { G.dirt(t); grassFringe(t, P('#c8d8dc #dce8ea #eef6f6 #fafefe'), 0.3); };
  G.snow = t => { surface(t, P('#d8e4e8 #e4eef0 #eef6f7 #f6fbfb #fdffff'), { cells: [4, 2], grain: 0.4 }); };
  G.sand = t => { surface(t, SAND, { cells: [4, 2], grain: 0.55 }); specks(t, [[hex('#c4b37e'), 0.04], [hex('#f0e8c8'), 0.03]]); };
  G.red_sand = t => { surface(t, P('#a5521b #b05a1f #ba6424 #c46c2b #cf7a36'), { cells: [4, 2], grain: 0.55 }); specks(t, [[hex('#8e4515'), 0.04], [hex('#d98a48'), 0.03]]); };
  G.gravel = t => {
    stones(t, { grid: 5, jitter: 0.9, mortar: 0.55, vary: 1.1, grain: 0.3, pal: P('#5f5a58 #6e6866 #7e7977 #8e8987 #a09b98 #b4afac'), gap: P('#4d4948 #575352') });
    specks(t, [[hex('#86796c'), 0.05], [hex('#9a8a7a'), 0.02]]);
  };
  G.clay = t => { surface(t, P('#8f96a8 #979eb0 #a0a6b6 #a8aebe #b2b8c6'), { cells: [4, 2], grain: 0.45 }); };
  G.bedrock = t => {
    stones(t, { grid: 4, jitter: 1, mortar: 0.7, vary: 1.2, grain: 0.5, pal: P('#2a2a2a #3a3a3a #4c4c4c #5e5e5e #727272 #8a8a8a'), gap: P('#1a1a1a #222222') });
  };
  G.obsidian = t => {
    surface(t, P('#0f0b19 #140f22 #1b142d #231a39 #2d2148'), { cells: [4, 2], grain: 0.35 });
    // glassy purple glints
    for (let k = 0; k < 6; k++) { const x = t.ri(15), y = t.ri(15); t.set(x, y, hex('#4c3878')); t.set(x + 1, y + 1, hex('#36285a')); }
    specks(t, [[hex('#6a52a0'), 0.012]]);
  };
  G.cobblestone = t => {
    stones(t, { grid: 3, jitter: 0.75, mortar: 0.95, vary: 0.6, grain: 0.22, pal: P('#5f5f5f #6c6c6c #7a7a7a #888888 #969696 #a6a6a6'), gap: P('#3f3f3f #4a4a4a #525252') });
  };
  G.mossy_cobblestone = t => {
    G.cobblestone(t);
    const f = norm(fbm(t, [8, 4], [0.6, 0.4]));
    const MOSS = P('#3e6324 #4b7a2c #5a8d34 #6aa03e');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (f[y * 16 + x] > 0.55) t.set(x, y, pick(MOSS, t.rand() * 0.6 + (f[y * 16 + x] - 0.55)));
  };
  G.ice = t => {
    surface(t, P('#7da3f0 #88adf4 #92b6f6 #9ec0f8'), { cells: [8, 4], grain: 0.2 });
    // cracks and shine
    const cr = hex('#b9d2ff');
    for (const [x, y, dx, dy, n] of [[2, 3, 1, 1, 5], [9, 1, -1, 1, 4], [11, 9, 1, 1, 4], [4, 11, 1, -1, 3]]) for (let i = 0; i < n; i++) t.set(x + dx * i, y + dy * i, cr);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = t.get(x, y); t.set(x, y, c, 200); }
  };
  G.snow_block = G.snow;

  /* ores */
  const oreSpots = (t) => [[2, 2, 0], [10, 1, 1], [6, 7, 4], [12, 9, 2], [1, 11, 3], [8, 12, 5]];
  const ORES = {
    coal_ore: P('#1a1a1a #2f2f2f #4a4a4a'),
    iron_ore: P('#a9846a #d8af93 #f2d6c0'),
    gold_ore: P('#c49a1c #f5d93c #fffaa0'),
    diamond_ore: P('#14a1a1 #5decf5 #d5fffa'),
    redstone_ore: P('#8e0000 #e01010 #ff8a8a'),
    emerald_ore: P('#007a2a #17dd62 #b3ffd0')
  };
  for (const k in ORES) G[k] = t => { const spots = oreSpots(t); if (k === 'coal_ore') spots.push([4, 4, 2]); ore(t, G.stone, ORES[k], spots); };

  /* metal / gem blocks: beveled plates */
  function metalPlate(t, pal) {
    // pal: [shadow, dark, mid, light, shine]
    surface(t, [pal[1], pal[2], pal[2], pal[3]], { cells: [8, 4], grain: 0.15 });
    bevel(t, pal[4], pal[0], 0);
    bevel(t, pal[3], pal[1], 1);
    for (let k = 2; k < 14; k++) t.set(k, k + 0 === 15 ? 14 : 2, pal[3]);
    // diagonal shine
    for (let i = 0; i < 4; i++) { t.set(3 + i, 7 - i, pal[4]); t.set(9 + i, 12 - i, mix(pal[3], pal[4], 0.5)); }
  }
  G.iron_block = t => metalPlate(t, P('#6e6e6e #b4b4b4 #d0d0d0 #e6e6e6 #ffffff'));
  G.gold_block = t => metalPlate(t, P('#8e6a0c #d9a81e #f5cc33 #fde65a #fffbc8'));
  G.diamond_block = t => metalPlate(t, P('#137d78 #3cc8bf #61dbd5 #93ede7 #e0fffc'));
  G.emerald_block = t => metalPlate(t, P('#06622a #12a648 #1fc760 #48e283 #c8ffdd'));

  /* ------------------------------------------------------------ */
  /* Wood                                                         */
  /* ------------------------------------------------------------ */
  const WOODS = {
    '': { planks: OAK, bark: { dark: hex('#4c3d26'), mid: hex('#6b5530'), light: hex('#7f6640') }, ring: { light: hex('#b8955c'), mid: hex('#9c7c48'), dark: hex('#7a5f36') } },
    birch_: { planks: { dark: hex('#a99668'), mid: hex('#c4b07b'), light: hex('#d7c58f'), gap: hex('#8c7a50') }, bark: { dark: hex('#c9c9c4'), mid: hex('#dcdcd6'), light: hex('#ececea'), spots: 9, spot: hex('#3b3b36'), cracks: 2 }, ring: { light: hex('#d7c58f'), mid: hex('#c4b07b'), dark: hex('#a99668') } },
    spruce_: { planks: { dark: hex('#5a4024'), mid: hex('#735433'), light: hex('#80603a'), gap: hex('#40301a') }, bark: { dark: hex('#2b1d0e'), mid: hex('#3b2a16'), light: hex('#4d3820') }, ring: { light: hex('#80603a'), mid: hex('#6b4e2e'), dark: hex('#523b21') } },
    jungle_: { planks: { dark: hex('#83583a'), mid: hex('#a07350'), light: hex('#b0835c'), gap: hex('#64412a') }, bark: { dark: hex('#3e3112'), mid: hex('#57441a'), light: hex('#6c5622'), spots: 4, spot: hex('#6a7a2a') }, ring: { light: hex('#b0835c'), mid: hex('#9a6c48'), dark: hex('#7a5236') } },
    acacia_: { planks: { dark: hex('#8e4a26'), mid: hex('#ab5c31'), light: hex('#bf6a3a'), gap: hex('#6e3519') }, bark: { dark: hex('#4a4440'), mid: hex('#635c55'), light: hex('#797068') }, ring: { light: hex('#c0703c'), mid: hex('#a85c30'), dark: hex('#8a4a24') } },
    dark_: { planks: { dark: hex('#36230f'), mid: hex('#47301a'), light: hex('#553a20'), gap: hex('#26180a') }, bark: { dark: hex('#24190c'), mid: hex('#3a2a15'), light: hex('#4a3720') }, ring: { light: hex('#553a20'), mid: hex('#463018'), dark: hex('#352310') } },
    mangrove_: { planks: { dark: hex('#5e2a26'), mid: hex('#763631'), light: hex('#86403a'), gap: hex('#46201c') }, bark: { dark: hex('#3a2c1c'), mid: hex('#54402a'), light: hex('#665036') }, ring: { light: hex('#8a453c'), mid: hex('#733630'), dark: hex('#5a2824') } },
    cherry_: { planks: { dark: hex('#c48a82'), mid: hex('#e2b2a8'), light: hex('#eec4ba'), gap: hex('#a26e68') }, bark: { dark: hex('#291b20'), mid: hex('#3a2730'), light: hex('#4d3540') }, ring: { light: hex('#eac0b4'), mid: hex('#d6a49a'), dark: hex('#b8847c') } },
    pale_oak_: { planks: { dark: hex('#c9c2bc'), mid: hex('#ddd7d2'), light: hex('#ebe6e2'), gap: hex('#aaa29b') }, bark: { dark: hex('#6a625c'), mid: hex('#857c75'), light: hex('#9a918a') }, ring: { light: hex('#e8e2dc'), mid: hex('#d6cfc8'), dark: hex('#bcb4ac') } }
  };
  for (const pre in WOODS) {
    const w = WOODS[pre];
    const pl = pre === 'dark_' ? 'dark_planks' : pre + 'planks', ls = pre ? pre + 'log_side' : 'log_side', lt = pre ? pre + 'log_top' : 'log_top';
    if (S.T[pl] !== undefined) G[pl] = t => planks(t, w.planks);
    if (S.T[ls] !== undefined) G[ls] = t => bark(t, w.bark);
    if (S.T[lt] !== undefined) G[lt] = t => rings(t, Object.assign({ bark: w.bark.mid, barkDark: w.bark.dark }, w.ring));
  }

  // leaves: tinted green, with see-through gaps (fancy) or dark gaps (fast)
  function leaves(t, pal, opaque) {
    const f = norm(fbm(t, [4, 2], [0.6, 0.4]));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = f[y * 16 + x] * 0.55 + t.rand() * 0.45;
      if (v < 0.2) { if (opaque) t.set(x, y, mul(pal[0], 0.55)); else t.set(x, y, [0, 0, 0], 0); continue; }
      t.set(x, y, pick(pal, (v - 0.2) / 0.8));
    }
    // leaf highlights
    for (let k = 0; k < 10; k++) { const x = t.ri(16), y = t.ri(16); if (t.alpha(x, y)) t.set(x, y, pal[pal.length - 1]); }
  }
  const LEAF = P('#2f5c18 #3b6d1f #477d26 #548c2e #619b36');
  G.leaves = t => leaves(t, LEAF, false);
  G.leaves_opaque = t => leaves(t, LEAF, true);

  /* ------------------------------------------------------------ */
  /* Building blocks                                              */
  /* ------------------------------------------------------------ */
  G.bricks = t => {
    const BR = P('#7f3d2f #8f4a3a #9d5644 #ab6150 #b86d5a'), MO = P('#8c847e #9a928c #aaa29c');
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let y = row * 4; y < row * 4 + 4; y++) for (let x = 0; x < 16; x++) {
        const bx = ((x + off) % 8);
        const brick = Math.floor((x + off) / 8) + row * 3;
        if (y === row * 4 + 3 || bx === 7) { t.set(x, y, pick(MO, t.rand())); continue; }
        const base = 0.35 + ((brick * 7919) % 5) * 0.08;
        let v = base + (t.rand() - 0.5) * 0.3 + (y === row * 4 ? 0.25 : 0) - (y === row * 4 + 2 ? 0.12 : 0);
        t.set(x, y, pick(BR, Math.max(0, Math.min(0.99, v))));
      }
    }
  };
  function stoneBricks(t, o) {
    const pal = o.pal || P('#5f5f5f #6a6a6a #757575 #7f7f7f #8a8a8a #959595'), gap = o.gap || hex('#4b4b4b');
    surface(t, pal.slice(1, 5), { cells: [4, 2], grain: 0.35 });
    const half = (y0, seams) => {
      for (let x = 0; x < 16; x++) { t.set(x, y0 + 7, gap); }
      for (const s of seams) for (let y = y0; y < y0 + 7; y++) t.set(s, y, gap);
      for (let x = 0; x < 16; x++) { if (!seams.includes(x)) { t.set(x, y0, pal[5]); t.set(x, y0 + 6, pal[1]); } }
      for (const s of seams) for (let y = y0; y < y0 + 7; y++) { t.set((s + 1) & 15, y, pal[5]); t.set((s + 15) & 15, y, pal[1]); }
    };
    half(0, [15]); half(8, [7]);
  }
  G.stone_bricks = t => stoneBricks(t, {});
  G.mossy_stone_bricks = t => {
    stoneBricks(t, {});
    const f = norm(fbm(t, [8, 4], [0.6, 0.4]));
    const MOSS = P('#3e6324 #4b7a2c #5a8d34 #6aa03e');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (f[y * 16 + x] > 0.6) t.set(x, y, pick(MOSS, t.rand()));
  };
  G.cracked_stone_bricks = t => {
    stoneBricks(t, {});
    const C = hex('#3c3c3c');
    for (const [x, y] of [[3, 1], [4, 2], [4, 3], [5, 4], [5, 5], [11, 9], [10, 10], [10, 11], [11, 12], [12, 13], [9, 11], [2, 10], [3, 11]]) t.set(x, y, C);
  };
  G.slab_top = t => { surface(t, P('#8f8f8f #999999 #a2a2a2 #ababab'), { cells: [4], grain: 0.3 }); bevel(t, hex('#b4b4b4'), hex('#7a7a7a'), 0); };
  G.slab_side = t => {
    surface(t, P('#8f8f8f #999999 #a2a2a2 #ababab'), { cells: [4], grain: 0.3 });
    for (let x = 0; x < 16; x++) { t.set(x, 0, hex('#b4b4b4')); t.set(x, 7, hex('#7a7a7a')); t.set(x, 8, hex('#b4b4b4')); t.set(x, 15, hex('#7a7a7a')); }
  };
  G.sandstone_top = t => { surface(t, P('#d4c48c #dccd98 #e2d4a2 #e8dbab'), { cells: [4, 2], grain: 0.4 }); };
  G.sandstone_bottom = t => { G.sandstone_top(t); specks(t, [[hex('#c6b47a'), 0.08]]); };
  G.sandstone_side = t => {
    surface(t, P('#d4c48c #dccd98 #e2d4a2 #e8dbab'), { cells: [4, 2], grain: 0.35 });
    // layered: a smooth cap and banded rock below
    for (let x = 0; x < 16; x++) { t.set(x, 3, hex('#c3b07a')); t.set(x, 4, hex('#eadcae')); t.set(x, 12, hex('#c3b07a')); }
    for (let y = 5; y < 12; y++) for (let x = 0; x < 16; x++) if ((x * 3 + y * 5) % 11 === 0) t.set(x, y, hex('#cbb984'));
  };
  G.chiseled_sandstone = t => {
    G.sandstone_top(t);
    const D = hex('#b8a46c'), L = hex('#eadcae');
    bevel(t, L, D, 0); bevel(t, D, L, 2);
    art(t, ['....DD..DD....', '....DD..DD....', '......DD......', '.....DDDD.....', '.....D..D.....'].map(r => ' ' + r + ' '), { D }, 0, 5);
  };
  G.terracotta = t => surface(t, P('#8a5240 #93583f #985e44 #9e6449'), { cells: [4, 2], grain: 0.3 });

  /* the crafting table: a wooden table, the crafting grid inlaid on top, legs on every side */
  const CT = { k: hex('#3b2a16'), K: hex('#4e3920'), d: hex('#6b4f2b'), m: hex('#9a7646'), l: hex('#b48c55'), L: hex('#c9a46a'), g: hex('#2a1d0f'), s: hex('#1e150b'), i: hex('#9a9a9a'), I: hex('#cfcfcf'), h: hex('#5c4326') };
  G.crafting_table_top = t => {
    planks(t, { dark: hex('#8a6b3d'), mid: hex('#a6824e'), light: hex('#ba955d'), gap: hex('#6f5430') });
    // frame
    for (let k = 0; k < 16; k++) { t.set(k, 0, CT.k); t.set(0, k, CT.k); t.set(k, 15, CT.k); t.set(15, k, CT.k); t.set(k, 1, CT.l); t.set(1, k, CT.l); t.set(k, 14, CT.d); t.set(14, k, CT.d); }
    // the 3x3 crafting grid
    for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) {
      const x0 = 3 + gx * 3 + gx, y0 = 3 + gy * 3 + gy;
      for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) t.set(x, y, (x === x0 || y === y0) ? CT.L : CT.l);
    }
    for (let k = 2; k <= 13; k++) for (const q of [2, 6, 10, 13]) { t.set(q, k, CT.k); t.set(k, q, CT.k); }
  };
  const tableSide = (t, tools) => {
    // tabletop edge
    for (let x = 0; x < 16; x++) { t.set(x, 0, CT.L); t.set(x, 1, x % 5 === 4 ? CT.m : CT.l); t.set(x, 2, CT.m); t.set(x, 3, CT.k); }
    // under the table: deep shadow with a back panel
    for (let y = 4; y < 16; y++) for (let x = 3; x < 13; x++) t.set(x, y, y < 6 ? CT.s : (t.rand() < 0.2 ? CT.K : CT.g));
    // legs
    for (let y = 4; y < 16; y++) for (const [x0] of [[0], [13]]) { t.set(x0, y, CT.l); t.set(x0 + 1, y, CT.m); t.set(x0 + 2, y, CT.d); }
    for (const x0 of [0, 13]) { t.set(x0, 15, CT.d); t.set(x0 + 1, 15, CT.d); t.set(x0 + 2, 15, CT.k); }
    // stretcher between the legs
    for (let x = 3; x < 13; x++) { t.set(x, 11, CT.m); t.set(x, 12, CT.d); }
    if (tools) {
      // a saw and a hammer hanging under the top
      art(t, ['..hh......', '..hh......', '.IIIIi....', '.IiiIi....', '.IiiIi....', '.i..i.....'], CT, 3, 4);
      art(t, ['....h', '...hh', '..IIh', '..Iih', '...ih', '....h'], CT, 7, 4);
      art(t, ['..IIII', '..Iiii', '...hh.', '...hh.', '...hh.'], CT, 6, 4);
    }
  };
  G.crafting_table_side = t => tableSide(t, false);
  G.crafting_table_front = t => {
    tableSide(t, false);
    // hammer
    art(t, ['IIIi', 'Iiii', '.hh.', '.hh.', '.hh.', '.hh.'], CT, 4, 4);
    // saw
    art(t, ['hh....', 'hhIIII', 'h.IiiI', '..Iiii', '..iiii', '...i.i'], CT, 8, 4);
  };

  /* the furnace */
  const FS = P('#5a5a5a #666666 #727272 #7c7c7c #868686 #929292');
  function furnaceBase(t) {
    surface(t, FS.slice(1, 5), { cells: [4, 2], grain: 0.35 });
    bevel(t, FS[5], FS[0], 0);
    bevel(t, FS[4], FS[1], 1);
  }
  G.furnace_side = t => { furnaceBase(t); for (let x = 2; x < 14; x++) { t.set(x, 7, FS[1]); t.set(x, 8, FS[5]); } };
  G.furnace_top = t => { furnaceBase(t); bevel(t, FS[1], FS[5], 4); };
  const furnaceFront = (t, lit) => {
    furnaceBase(t);
    const K = hex('#1b1b1b'), D = hex('#2d2d2d'), I = hex('#454545');
    // vent slot
    for (let x = 3; x < 13; x++) { t.set(x, 3, D); t.set(x, 4, K); t.set(x, 5, FS[5]); }
    // the mouth
    for (let y = 8; y < 14; y++) for (let x = 3; x < 13; x++) t.set(x, y, y === 8 ? D : K);
    for (let x = 3; x < 13; x++) { t.set(x, 7, FS[0]); t.set(x, 14, FS[5]); }
    for (let y = 7; y < 15; y++) { t.set(2, y, FS[0]); t.set(13, y, FS[5]); }
    // grate bars
    for (let x = 4; x < 12; x += 2) for (let y = 9; y < 14; y++) t.set(x, y, lit ? t.get(x, y) : I);
    if (lit) {
      const F = P('#7a1e00 #c43c00 #f06a00 #ff9a1a #ffd24a #fff4b0');
      for (let y = 9; y < 14; y++) for (let x = 3; x < 13; x++) {
        const v = (y - 9) / 4.5 + (t.rand() - 0.5) * 0.35 - Math.abs(x - 7.5) / 14;
        t.set(x, y, pick(F, Math.max(0, Math.min(0.999, v))));
      }
      for (let x = 4; x < 12; x += 2) t.set(x, 9, I);
      for (let x = 3; x < 13; x++) t.set(x, 4, hex('#a8501a'));
    }
  };
  G.furnace_front = t => furnaceFront(t, false);
  G.furnace_front_lit = t => furnaceFront(t, true);

  /* chest (seen as a cube) */
  const CH = { k: hex('#2a1b0c'), d: hex('#5f3d17'), m: hex('#8a5a22'), l: hex('#a8722e'), L: hex('#c08a3e'), i: hex('#8c8c8c'), I: hex('#d4d4d4'), o: hex('#4a4a4a') };
  function chestWood(t) {
    // smooth boards with long grain lines
    for (let y = 0; y < 16; y++) { const rowTone = t.rand() < 0.3 ? CH.l : CH.m; for (let x = 0; x < 16; x++) t.set(x, y, t.rand() < 0.08 ? mix(rowTone, CH.d, 0.5) : rowTone); }
    for (let k = 0; k < 7; k++) { const y = 2 + t.ri(12), x0 = t.ri(12), n = 3 + t.ri(6); for (let i = 0; i < n; i++) t.set((x0 + i) & 15, y, mix(CH.m, CH.d, 0.6)); }
    for (let k = 0; k < 16; k++) { t.set(k, 0, CH.k); t.set(0, k, CH.k); t.set(k, 15, CH.k); t.set(15, k, CH.k); t.set(k, 1, CH.L); t.set(1, k, CH.L); t.set(k, 14, CH.d); t.set(14, k, CH.d); }
  }
  G.chest_top = t => chestWood(t);
  G.chest_side = t => { chestWood(t); for (let x = 1; x < 15; x++) { t.set(x, 5, CH.k); t.set(x, 6, CH.L); } };
  G.chest_front = t => {
    G.chest_side(t);
    art(t, ['.oo.', 'oIIo', 'oIio', 'oiio', '.oo.'], CH, 6, 3);
  };

  /* bookshelf */
  G.bookshelf = t => {
    planks(t, OAK);
    const BOOK = P('#8f1d1d #2e4fa0 #2f7a2c #7a4a1e #6b2f86 #2b2b2b #b88a1c #a33a5e');
    const shelf = (y0) => {
      let x = 1;
      for (let y = y0; y < y0 + 6; y++) for (let xx = 1; xx < 15; xx++) t.set(xx, y, hex('#2a1d10'));
      while (x < 15) {
        const w = t.rand() < 0.3 ? 1 : 2, c = BOOK[t.ri(BOOK.length)], h = 4 + t.ri(3);
        if (t.rand() < 0.12) { x += 1; continue; }
        for (let i = 0; i < w && x + i < 15; i++) for (let y = y0 + 6 - h; y < y0 + 6; y++) {
          let cc = c;
          if (y === y0 + 6 - h) cc = mul(c, 1.35);
          else if (y === y0 + 6 - h + 1 || y === y0 + 4) cc = (i === 0 ? hex('#d8c890') : mul(c, 1.2));
          if (i === w - 1 && w > 1) cc = mul(cc, 0.75);
          t.set(x + i, y, cc);
        }
        x += w;
      }
    };
    shelf(1); shelf(9);
    for (let x = 0; x < 16; x++) { t.set(x, 0, OAK.light); t.set(x, 7, OAK.gap); t.set(x, 8, OAK.light); t.set(x, 15, OAK.gap); }
    for (let y = 0; y < 16; y++) { t.set(0, y, OAK.mid); t.set(15, y, OAK.dark); }
  };

  /* TNT */
  G.tnt_side = t => {
    const R = P('#9a2a10 #b8341a #d1401f #e24f2b'), W = P('#d8d8d8 #ebebeb #f8f8f8');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const stick = x % 4;
      t.set(x, y, stick === 3 ? R[0] : stick === 0 ? R[3] : pick(R, 0.4 + t.rand() * 0.35));
    }
    for (let y = 5; y < 11; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(W, t.rand()));
    for (let x = 0; x < 16; x++) { t.set(x, 4, hex('#6a6a6a')); t.set(x, 11, hex('#6a6a6a')); }
    art(t, ['KKK.K..K.KKK', '.K..KK.K..K.', '.K..K.KK..K.', '.K..K..K..K.'], { K: hex('#1c1c1c') }, 2, 6);
  };
  G.tnt_top = t => {
    const R = P('#9a2a10 #b8341a #d1401f #e24f2b');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = (x % 4) - 1.5, dy = (y % 4) - 1.5, d = Math.hypot(dx, dy);
      t.set(x, y, d > 1.7 ? R[0] : d < 0.8 ? R[3] : R[2]);
    }
    art(t, ['.kk.', 'kKKk', 'kKKk', '.kk.'], { k: hex('#3a3a3a'), K: hex('#141414') }, 6, 6);
    t.set(7, 6, hex('#7a7a7a'));
  };
  G.tnt_bottom = t => { G.tnt_top(t); for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) t.set(x, y, hex('#b8341a')); };

  /* glass: clear with a frame and glare */
  G.glass = t => {
    t.clear();
    const F = hex('#e4f0f2'), D = hex('#9fbfc6'), S2 = hex('#ffffff');
    for (let k = 0; k < 16; k++) { t.set(k, 0, F); t.set(0, k, F); t.set(k, 15, D); t.set(15, k, D); }
    for (let k = 1; k < 15; k++) { if (k < 4 || k > 11) { t.set(k, 1, D, 150); t.set(1, k, D, 150); } }
    for (const [x, y] of [[3, 3], [4, 3], [3, 4], [5, 4], [4, 5], [6, 5], [5, 6], [11, 9], [10, 10], [12, 9]]) t.set(x, y, S2, 210);
  };

  /* sponge, wool */
  G.sponge = t => {
    surface(t, P('#b5a335 #c7b53e #d4c24a #e0cf58'), { cells: [4, 2], grain: 0.3 });
    for (let k = 0; k < 14; k++) { const x = t.ri(15), y = t.ri(15); t.set(x, y, hex('#8e7e22')); if (t.rand() < 0.5) t.set(x + 1, y, hex('#9c8b28')); }
  };
  G.wool = t => {
    surface(t, P('#c9c9c9 #d6d6d6 #e2e2e2 #ececec #f6f6f6'), { cells: [4, 2], grain: 0.4 });
    // knitted fibres
    for (let y = 0; y < 16; y += 2) for (let x = (y / 2) % 2; x < 16; x += 2) t.set(x, y, mul(t.get(x, y), 0.93));
  };

  /* pumpkins */
  const PK = P('#a85b0d #c46e10 #d98118 #e8952a');
  G.pumpkin_side = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const rib = x % 4;
      t.set(x, y, rib === 0 ? PK[0] : rib === 1 ? pick(PK, 0.5 + t.rand() * 0.4) : rib === 2 ? PK[3] : PK[1]);
    }
    for (let x = 0; x < 16; x++) { t.set(x, 0, mul(PK[1], 0.9)); t.set(x, 15, mul(PK[0], 0.9)); }
  };
  G.pumpkin_top = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); t.set(x, y, pick(PK, 0.3 + (d % 3) / 4 + t.rand() * 0.2)); }
    art(t, ['.gg.', 'gGGg', 'gGGg', '.gg.'], { g: hex('#4a6b14'), G: hex('#6a8f22') }, 6, 6);
  };
  const face = (t, lit) => {
    G.pumpkin_side(t);
    const K = lit ? hex('#f7c840') : hex('#2a1606'), Y = lit ? hex('#fff38c') : hex('#3c210a');
    art(t, ['.KK....KK.', 'KYK...KYK.', 'KKK...KKK.', '..........', 'K.KKKKKK.K', 'KKKYKKYKKK', '.KKKKKKKK.', '..KK..KK..'], { K, Y }, 3, 4);
  };
  G.pumpkin_face = t => face(t, false);
  G.jack_o_lantern_face = t => face(t, true);

  /* cactus */
  G.cactus_side = t => {
    t.clear();
    const C = P('#0f5a17 #157320 #1c8a28 #26a032');
    for (let y = 0; y < 16; y++) for (let x = 1; x < 15; x++) t.set(x, y, x === 1 || x === 14 ? C[0] : x % 4 === 1 ? C[3] : pick(C, 0.35 + t.rand() * 0.4));
    for (let y = 1; y < 16; y += 4) { t.set(0, y, hex('#d8d0a0')); t.set(15, y + 2 & 15, hex('#d8d0a0')); t.set(5, y + 1 & 15, hex('#1a2a0c')); t.set(10, y + 3 & 15, hex('#1a2a0c')); }
  };
  G.cactus_top = t => {
    t.clear();
    const C = P('#157320 #1c8a28 #26a032 #30b03c');
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) t.set(x, y, (x === 1 || y === 1 || x === 14 || y === 14) ? C[0] : pick(C, 0.3 + t.rand() * 0.6));
    for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11], [7, 7]]) t.set(x, y, hex('#d8d0a0'));
  };
  G.cactus_bottom = t => { G.cactus_top(t); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.alpha(x, y)) t.shade(x, y, 0.8); };

  /* farmland, path */
  G.farmland_dry = t => {
    surface(t, DIRT.slice(1, 5), { cells: [4, 2], grain: 0.5 });
    // ploughed furrows: a dark groove under a lit ridge, slightly wavy
    for (let r = 0; r < 4; r++) for (let x = 0; x < 16; x++) {
      const y = r * 4 + 2 + ((x + r * 5) % 7 === 0 ? 1 : 0);
      t.set(x, y, DIRT[0]); t.set(x, (y + 1) & 15, DIRT[1]); t.set(x, (y + 15) & 15, DIRT[5]);
    }
  };
  G.farmland_wet = t => { G.farmland_dry(t); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.shade(x, y, 0.58); };

  /* doors and ladders */
  G.door_top = t => {
    planks(t, Object.assign({}, OAK, { seams: [[0, 8], [0, 8], [0, 8], [0, 8]] }));
    const D = OAK.gap, W = hex('#c8dfe6'), W2 = hex('#a0c4ce');
    for (let k = 0; k < 16; k++) { t.set(0, k, D); t.set(15, k, D); t.set(k, 0, D); }
    for (const x0 of [3, 9]) for (let y = 3; y < 11; y++) for (let x = x0; x < x0 + 4; x++) t.set(x, y, (x === x0 || y === 3) ? D : (x + y) % 5 === 0 ? W : W2, 150);
  };
  G.door_bottom = t => {
    planks(t, Object.assign({}, OAK, { seams: [[0, 8], [0, 8], [0, 8], [0, 8]] }));
    const D = OAK.gap;
    for (let k = 0; k < 16; k++) { t.set(0, k, D); t.set(15, k, D); t.set(k, 15, D); }
    for (let y = 3; y < 13; y++) { t.set(3, y, D); t.set(12, y, D); }
    for (let x = 3; x < 13; x++) { t.set(x, 3, D); t.set(x, 12, D); }
    art(t, ['kK', 'KK'], { k: hex('#3a3a3a'), K: hex('#8a8a8a') }, 12, 1);
  };
  G.ladder = t => {
    t.clear();
    for (let y = 0; y < 16; y++) { t.set(1, y, OAK.light); t.set(2, y, OAK.dark); t.set(13, y, OAK.light); t.set(14, y, OAK.dark); }
    for (const y of [2, 6, 10, 14]) for (let x = 3; x < 13; x++) { t.set(x, y, OAK.light); t.set(x, y + 1, OAK.gap); }
  };

  /* plants */
  G.torch = t => {
    t.clear();
    for (let y = 8; y < 16; y++) { t.set(7, y, hex('#7b5a2c')); t.set(8, y, hex('#5a4020')); }
    art(t, ['.yy.', 'yWWy', 'yWWy', '.oo.'], { y: hex('#ffb020'), W: hex('#fff6c0'), o: hex('#c86a10') }, 6, 5);
  };
  G.dandelion = t => {
    t.clear();
    const g = hex('#3f7d1e'), G2 = hex('#5aa02a');
    for (let y = 9; y < 16; y++) t.set(7, y, g);
    art(t, ['...G....', '..GG.G..', '...GGG..'], { G: G2 }, 4, 11);
    art(t, ['..yy..', '.yYYy.', 'yYOOYy', 'yYOOYy', '.yYYy.', '..yy..'], { y: hex('#e8b800'), Y: hex('#ffe23a'), O: hex('#f5a000') }, 5, 3);
  };
  G.rose = t => {
    t.clear();
    const g = hex('#3f7d1e'), G2 = hex('#5aa02a');
    for (let y = 9; y < 16; y++) t.set(7, y, g);
    art(t, ['.G......', 'GGG..GG.', '.GG.GG..'], { G: G2 }, 4, 11);
    art(t, ['.rRRr..', 'rRRRRr.', 'RRkkRRr', 'RRkkRRr', 'rRRRRr.', '.rRRr..'], { r: hex('#a8141c'), R: hex('#e02028'), k: hex('#2a0606') }, 4, 3);
  };
  G.sapling = t => {
    t.clear();
    const s = hex('#6b4a24');
    for (let y = 10; y < 16; y++) t.set(7, y, s);
    const L = { a: hex('#2f6a16'), b: hex('#448c22'), c: hex('#5aa830') };
    art(t, ['....bb....', '..abccb...', '.abbcbba..', 'abcbbacba.', '.abbcbbcb.', '..aabbab..', '...a.ab...', '.....a....'], L, 3, 2);
  };
  G.reeds = t => {
    t.clear();
    const A = hex('#5b8f2a'), B2 = hex('#86bd4a'), C = hex('#3f6a1c'), N = hex('#b9d77a');
    for (const [x, off] of [[3, 0], [8, 5], [12, 2]]) for (let y = 0; y < 16; y++) {
      const seg = (y + off) % 6;
      t.set(x, y, seg === 0 ? N : A); t.set(x + 1, y, seg === 0 ? B2 : C);
      if (seg === 3 && x < 12) t.set(x + 2, y, B2);
    }
  };
  G.brown_mushroom = t => {
    t.clear();
    art(t, ['....bbbb....', '..bBBBBBBb..', '.bBBbBBBBBb.', 'bbbbbbbbbbbb', '.....ss.....', '.....ss.....', '.....sS.....'], { b: hex('#7a5536'), B: hex('#a07650'), s: hex('#d8cdb8'), S: hex('#b8ad98') }, 2, 7);
  };
  G.red_mushroom = t => {
    t.clear();
    art(t, ['...rrrrrr...', '..rRWRRWRr..', '.rRRRRRRRRr.', '.rWRRRRRWRr.', 'rrrrrrrrrrrr', '.....ss.....', '.....ss.....', '.....sS.....'], { r: hex('#a8141c'), R: hex('#e02028'), W: hex('#f4f0e8'), s: hex('#e8e0d0'), S: hex('#c8bfae') }, 2, 6);
  };
  for (let i = 0; i < 8; i++) G['wheat_' + i] = ((st) => t => {
    t.clear();
    const g = st < 7 ? mix(hex('#3f8a1e'), hex('#b8a03a'), st / 7) : hex('#c8a83e'), d = mul(g, 0.75), hd = hex('#d8b850');
    const h = 3 + st * 1.6;
    for (const x of [1, 4, 7, 10, 13]) {
      const top = Math.max(0, Math.floor(16 - h - ((x * 3) % 3)));
      for (let y = top; y < 16; y++) t.set(x + ((y + x) % 4 === 0 ? 1 : 0), y, (y % 3 === 0) ? d : g);
      if (st >= 5) for (let y = top; y < top + 4 && y < 16; y++) { t.set(x, y, hd); t.set(x + 1, y, (y % 2) ? hd : mul(hd, 0.85)); }
    }
  })(i);

  /* misc */
  G.spawner = t => {
    t.clear();
    const B1 = hex('#1e2c38'), B2 = hex('#3a5468'), B3 = hex('#56768a');
    for (let k = 0; k < 16; k++) { t.set(k, 0, B2); t.set(0, k, B2); t.set(k, 15, B1); t.set(15, k, B1); }
    for (let x = 3; x < 16; x += 4) for (let y = 1; y < 15; y++) { t.set(x, y, B2); t.set(x - 1, y, B1); }
    for (let y = 3; y < 16; y += 4) for (let x = 1; x < 15; x++) { t.set(x, y, B3); }
  };
  G.cobweb = t => {
    t.clear();
    const W = hex('#e8e8e8');
    for (let i = 0; i < 16; i++) { t.set(i, i, W, 220); t.set(15 - i, i, W, 220); t.set(7, i, W, 200); t.set(i, 8, W, 200); }
    for (const r of [3, 6]) for (let a = 0; a < 24; a++) { const x = Math.round(7.5 + Math.cos(a / 24 * 6.283) * r), y = Math.round(7.5 + Math.sin(a / 24 * 6.283) * r); t.set(x, y, W, 170); }
  };
  G.hay_side = t => {
    const Y = P('#a8862a #c09c34 #d0ae42 #dcbe54');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) t.set(x, y, pick(Y, ((x * 7) % 5) / 6 + t.rand() * 0.25));
    for (const y of [3, 4, 11, 12]) for (let x = 0; x < 16; x++) t.set(x, y, y % 2 ? hex('#7a2a10') : hex('#a03a18'));
  };
  G.hay_top = t => {
    const Y = P('#a8862a #c09c34 #d0ae42 #dcbe54');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); t.set(x, y, pick(Y, (Math.sin(d * 1.7) + 1) / 2.4 + t.rand() * 0.2)); }
  };
  G.dirt_path_top = t => { surface(t, P('#8a6a3c #957446 #9e7d4f #a98658'), { cells: [4, 2], grain: 0.5 }); };
  G.dirt_path_side = t => { G.dirt(t); for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(P('#8a6a3c #957446 #9e7d4f'), t.rand())); };
  G.bone_block_side = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, pick(P('#c8c2a8 #d6d0b8 #e2dcc6 #ece6d2'), (x % 4 === 0 ? 0.05 : 0.5) + t.rand() * 0.4)); };
  G.bone_block_top = t => {
    G.bone_block_side(t);
    art(t, ['..dddd..', '.d....d.', 'd..dd..d', 'd.d..d.d', 'd.d..d.d', 'd..dd..d', '.d....d.', '..dddd..'], { d: hex('#a8a28a') }, 4, 4);
  };
  G.iron_bars = t => {
    t.clear();
    const A = hex('#6a6a6a'), B2 = hex('#a8a8a8'), C = hex('#d6d6d6');
    for (const x of [1, 6, 9, 14]) for (let y = 0; y < 16; y++) { t.set(x, y, C); t.set(x + 1, y, A); }
    for (const y of [1, 14]) for (let x = 0; x < 16; x++) { t.set(x, y, B2); t.set(x, y + 1, A); }
  };
  G.rail = t => {
    t.clear();
    const W = hex('#6b4f2b'), w2 = hex('#4e3920'), R = hex('#a8a8a8'), R2 = hex('#6e6e6e');
    for (const y of [1, 5, 9, 13]) for (let x = 1; x < 15; x++) { t.set(x, y, W); t.set(x, y + 1, w2); }
    for (let y = 0; y < 16; y++) { t.set(3, y, R); t.set(4, y, R2); t.set(11, y, R); t.set(12, y, R2); }
  };

  /* ------------------------------------------------------------ */
  /* The Nether, the End                                          */
  /* ------------------------------------------------------------ */
  G.netherrack = t => {
    surface(t, P('#4e1a1a #5e2020 #6e2727 #7d2e2e #8c3838'), { cells: [4, 2], grain: 0.4 });
    // the crumbly cracks
    for (let k = 0; k < 9; k++) { const x = t.ri(16), y = t.ri(16); t.set(x, y, hex('#3a1010')); t.set((x + 1) & 15, y, hex('#9a4a4a')); }
  };
  G.glowstone = t => {
    stones(t, { grid: 4, jitter: 0.8, mortar: 0.6, vary: 0.8, grain: 0.3, pal: P('#9a6a2a #b88a3a #d8a84c #f0c868 #ffe08a #fff2c0'), gap: P('#6a4a1c #7a5622') });
  };
  G.soul_sand = t => {
    surface(t, P('#3d2c22 #4a362a #574133 #634b3b'), { cells: [4, 2], grain: 0.45 });
    art(t, ['.kk..kk.', '.kk..kk.', '........', '..kkkk..', '.k....k.'], { k: hex('#241812') }, 4, 4);
  };
  G.nether_bricks = t => {
    const BR = P('#2a1218 #36161e #421b24 #50222c'), MO = hex('#160809');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = Math.floor(y / 4), off = row % 2 ? 2 : 0;
      if (y % 4 === 3 || (x + off) % 8 === 7 || (x + off) % 8 === 3 && row % 2 === 1 && false) { t.set(x, y, MO); continue; }
      t.set(x, y, pick(BR, (y % 4 === 0 ? 0.75 : 0.3) + t.rand() * 0.3));
    }
  };
  G.end_stone = t => {
    surface(t, P('#c8c88e #d4d49a #dcdca4 #e4e4ae'), { cells: [4, 2], grain: 0.4 });
    for (let k = 0; k < 9; k++) { const x = t.ri(15), y = t.ri(15); t.set(x, y, hex('#a8a872')); t.set(x + 1, y + 1, hex('#eeeebc')); }
  };
  G.end_stone_bricks = t => stoneBricks(t, { pal: P('#b8b880 #c8c88e #d4d49a #dcdca4 #e4e4ae #ececba'), gap: hex('#9a9a66') });
  G.purpur_block = t => {
    surface(t, P('#9670a0 #a37cad #ae88b8 #ba94c2'), { cells: [4, 2], grain: 0.3 });
    for (let x = 0; x < 16; x++) { t.set(x, 7, hex('#7d5a88')); t.set(x, 15, hex('#7d5a88')); t.set(x, 8, hex('#c8a4d0')); t.set(x, 0, hex('#c8a4d0')); }
    for (let y = 0; y < 16; y++) { t.set(y < 8 ? 7 : 15, y, hex('#7d5a88')); t.set(y < 8 ? 8 : 0, y, hex('#c8a4d0')); }
  };
  G.quartz_ore = t => ore(t, G.netherrack, P('#b8aca0 #e8e0d6 #ffffff'), [[2, 2, 0], [10, 3, 5], [5, 9, 4], [12, 11, 1], [1, 13, 3]]);

  /* ------------------------------------------------------------ */
  /* Tools: drawn like Minecraft's, handle bottom-left to top-right */
  /* ------------------------------------------------------------ */
  const TOOL_ART = {
    pickaxe: [
      '................',
      '................',
      '..ooooooo.......',
      '.oLLLLLLLoo.....',
      'ommmddddmmLo....',
      '.odoooooodmLo...',
      '..o.....osdLo...',
      '.......oskdmLo..',
      '......oskoomLo..',
      '.....osko.omLo..',
      '....osko..omLo..',
      '...osko...omLo..',
      '..osko....omLo..',
      '.osko....odmLo..',
      'osko......omo...',
      '.oo........o....'
    ],
    axe: [
      '......ooooo.....',
      '.....oLLLLLo....',
      '....oLLLmmmmoo..',
      '....oLLmmmmmsko.',
      '....oLmmmmmsko..',
      '....ommmmmsko...',
      '....ommmmsko....',
      '.....oomsko.....',
      '......osko......',
      '.....osko.......',
      '....osko........',
      '...osko.........',
      '..osko..........',
      '.osko...........',
      'osko............',
      '.oo.............'
    ],
    shovel: [
      '...........oo...',
      '..........oddo..',
      '.........ommddo.',
      '........oLmmmdo.',
      '........oLLmmmo.',
      '........oLLLmo..',
      '........osLLo...',
      '.......oskoo....',
      '......osko......',
      '.....osko.......',
      '....osko........',
      '...osko.........',
      '..osko..........',
      '.osko...........',
      'osko............',
      '.oo.............'
    ],
    sword: [
      '.............oo.',
      '............odmo',
      '...........odmLo',
      '..........odmLo.',
      '.........odmLo..',
      '........odmLo...',
      '.......odmLo....',
      '......odmLo.....',
      '..oo.odmLo......',
      '.oddodmLo.......',
      '..omdmLo........',
      '...osko.........',
      '..oskmdo........',
      '.oskoodo........',
      'osko..o.........',
      '.oo.............'
    ],
    hoe: [
      '....oooooo......',
      '...oLLLLLLo.....',
      '...ommmmmmmo....',
      '....ooooodddo...',
      '........oddo....',
      '.........osko...',
      '........osko....',
      '.......osko.....',
      '......osko......',
      '.....osko.......',
      '....osko........',
      '...osko.........',
      '..osko..........',
      '.osko...........',
      'osko............',
      '.oo.............'
    ]
  };
  const TOOL_MAT = {
    wood: { L: '#c19a5c', m: '#9c7a46', d: '#6e5330', o: '#2e2110' },
    stone: { L: '#a8a8a8', m: '#868686', d: '#5e5e5e', o: '#262626' },
    iron: { L: '#ffffff', m: '#d8d8d8', d: '#a2a2a2', o: '#363636' },
    gold: { L: '#fffcb0', m: '#f8d43a', d: '#c8961a', o: '#4a3200' },
    diamond: { L: '#d6fffa', m: '#4fe0d8', d: '#1e9e9a', o: '#0a3434' },
    zanite: { L: '#e8c8ff', m: '#a060e0', d: '#6a30a8', o: '#2a1040' },
    gravitite: { L: '#ffc8f0', m: '#e060c0', d: '#a02888', o: '#40103a' },
    skyroot: { L: '#e0e0c0', m: '#c4c49a', d: '#9a9a70', o: '#3a3a28' },
    holystone: { L: '#ffffff', m: '#d0d0d0', d: '#a0a0a0', o: '#404040' },
    netherite: { L: '#7a6e74', m: '#4c4448', d: '#322c30', o: '#141012' },
    copper: { L: '#f4b090', m: '#d8784e', d: '#a04a2a', o: '#3a1a0a' },
    echo: { L: '#d6fff6', m: '#2fd6c2', d: '#127e86', o: '#06262c' }
  };
  Tex.TOOL_MAT = TOOL_MAT; // other modules add tool materials: { L, m, d, o }
  const HANDLE = { k: hex('#4a3216'), s: hex('#8a6430') };
  Tex.paintTool = function (t, mat, tool) {
    const m = TOOL_MAT[mat] || TOOL_MAT.iron;
    const pal = { L: hex(m.L), m: hex(m.m), d: hex(m.d), o: hex(m.o), k: HANDLE.k, s: HANDLE.s };
    art(t, TOOL_ART[tool], pal);
    // the handle outline uses the dark wood colour rather than the material's
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (TOOL_ART[tool][y][x] !== 'o') continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (TOOL_ART[tool][y + dy] || '')[x + dx] || '.');
      const handle = nb.some(c => c === 'k' || c === 's') && !nb.some(c => c === 'L' || c === 'm' || c === 'd');
      if (handle) t.set(x, y, hex('#2a1c0a'));
    }
  };

  /* ------------------------------------------------------------ */
  /* Modern / Classic switch                                      */
  /* ------------------------------------------------------------ */
  const MODERN = {}, modernTool = Tex.paintTool;
  for (const k in G) if (G[k] !== CLASSIC[k] && !KEEP.has(k)) MODERN[k] = G[k];
  for (const k of KEEP) if (CLASSIC[k]) G[k] = CLASSIC[k]; // water, lava, fire and portals always stay DreamLand's
  Tex.STYLES = ['modern', 'classic'];
  Tex.applyStyle = function (style) {
    Tex.style = style === 'classic' ? 'classic' : 'modern';
    for (const k in MODERN) G[k] = Tex.style === 'classic' ? CLASSIC[k] : MODERN[k];
    Tex.paintTool = Tex.style === 'classic' ? classicTool : modernTool;
  };
  const build = Tex.build;
  Tex.build = function () {
    const st = DL.game && DL.game.settings;
    Tex.applyStyle(st && st.texStyle);
    return build.apply(this, arguments);
  };
  Tex.applyStyle('modern');
})();
