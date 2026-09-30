/*
 * DreamLand - procedural pixel art.
 * Generates the terrain atlas, item atlas, GUI icons and animated liquid/fire
 * textures entirely in code (16x16 tiles, Alpha-era palette).
 */
(function () {
  const DL = window.DL;
  const S = DL.S;
  const Tex = DL.Tex = {};

  /* ---------------------------------------------------------------- */
  /* Tile painter                                                     */
  /* ---------------------------------------------------------------- */
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }

  function Tile(name) {
    this.d = new Uint8ClampedArray(16 * 16 * 4);
    this.r = new S.RNG(strHash(name) ^ 0x51ed27);
  }
  Tile.prototype.set = function (x, y, c, a) {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    const o = ((y & 15) * 16 + (x & 15)) * 4;
    this.d[o] = c[0]; this.d[o + 1] = c[1]; this.d[o + 2] = c[2]; this.d[o + 3] = a === undefined ? (c[3] === undefined ? 255 : c[3]) : a;
  };
  Tile.prototype.get = function (x, y) { const o = ((y & 15) * 16 + (x & 15)) * 4; return [this.d[o], this.d[o + 1], this.d[o + 2], this.d[o + 3]]; };
  Tile.prototype.alpha = function (x, y) { return this.d[((y & 15) * 16 + (x & 15)) * 4 + 3]; };
  Tile.prototype.fill = function (c) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) this.set(x, y, c); return this; };
  Tile.prototype.clear = function () { this.d.fill(0); return this; };
  Tile.prototype.copyFrom = function (t) { this.d.set(t.d); return this; };
  Tile.prototype.rand = function () { return this.r.next(); };
  Tile.prototype.ri = function (n) { return this.r.nextInt(n); };
  Tile.prototype.shade = function (x, y, f) {
    const o = ((y & 15) * 16 + (x & 15)) * 4;
    this.d[o] *= f; this.d[o + 1] *= f; this.d[o + 2] *= f;
  };
  Tile.prototype.rect = function (x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c); };
  // Paint pixel art rows using a palette map. '.' = skip, ' ' = skip.
  Tile.prototype.art = function (rows, pal, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (!c) continue;
        if (c === 'clear') { this.set(x + ox, y + oy, [0, 0, 0], 0); continue; }
        this.set(x + ox, y + oy, c);
      }
    }
    return this;
  };
  Tex.Tile = Tile;

  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mul(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
  function jitter(t, c, amt) { const f = 1 + (t.rand() * 2 - 1) * amt; return mul(c, f); }

  // tileable value noise on the 16x16 torus
  function valueNoise(t, cell) {
    const n = 16 / cell;
    const g = [];
    for (let i = 0; i < n * n; i++) g.push(t.rand());
    const out = new Float32Array(256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const gx = x / cell, gy = y / cell;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = g[(y0 % n) * n + (x0 % n)], b = g[(y0 % n) * n + ((x0 + 1) % n)];
      const c = g[((y0 + 1) % n) * n + (x0 % n)], d = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
      out[y * 16 + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Terrain textures                                                 */
  /* ---------------------------------------------------------------- */
  const G = {}; // name -> painter(tile)

  const GRASS = [[86, 150, 48], [98, 164, 55], [76, 136, 42], [110, 176, 62], [66, 122, 36]];
  G.grass_top = t => {
    const n = valueNoise(t, 4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = n[y * 16 + x] * 0.6 + t.rand() * 0.55;
      let c = v < 0.3 ? GRASS[4] : v < 0.5 ? GRASS[2] : v < 0.72 ? GRASS[0] : v < 0.9 ? GRASS[1] : GRASS[3];
      t.set(x, y, c);
    }
  };
  const DIRT = [[134, 96, 67], [121, 85, 58], [150, 108, 75], [100, 71, 48], [163, 122, 88]];
  G.dirt = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = t.rand();
      t.set(x, y, v < 0.45 ? DIRT[0] : v < 0.72 ? DIRT[1] : v < 0.88 ? DIRT[2] : v < 0.96 ? DIRT[3] : DIRT[4]);
    }
    for (let i = 0; i < 5; i++) { const x = t.ri(16), y = t.ri(16); t.set(x, y, DIRT[3]); t.set(x + 1, y, DIRT[1]); }
  };
  G.grass_side = t => {
    G.dirt(t);
    for (let x = 0; x < 16; x++) {
      let d = 2 + (t.rand() < 0.5 ? 1 : 0) + (t.rand() < 0.25 ? 1 : 0);
      if (x > 0 && t.rand() < 0.4) d = Math.max(1, d - 1);
      for (let y = 0; y < d; y++) {
        const v = t.rand();
        t.set(x, y, v < 0.25 ? GRASS[2] : v < 0.7 ? GRASS[0] : GRASS[1]);
      }
      if (t.rand() < 0.35) t.set(x, d, GRASS[4]);
    }
  };
  G.grass_side_snow = t => {
    G.dirt(t);
    for (let x = 0; x < 16; x++) {
      const d = 2 + (t.rand() < 0.55 ? 1 : 0) + (t.rand() < 0.2 ? 1 : 0);
      for (let y = 0; y < d; y++) t.set(x, y, t.rand() < 0.2 ? [222, 236, 240] : [245, 252, 252]);
    }
  };
  G.snow = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = t.rand(); t.set(x, y, v < 0.12 ? [222, 236, 240] : v < 0.2 ? [232, 244, 246] : [248, 254, 254]); } };
  const STONE = [[126, 126, 126], [116, 116, 116], [137, 137, 137], [104, 104, 104], [146, 146, 146]];
  G.stone = t => {
    const n = valueNoise(t, 4), n2 = valueNoise(t, 2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = n[y * 16 + x] * 0.55 + n2[y * 16 + x] * 0.3 + t.rand() * 0.25;
      t.set(x, y, v < 0.32 ? STONE[3] : v < 0.45 ? STONE[1] : v < 0.66 ? STONE[0] : v < 0.8 ? STONE[2] : STONE[4]);
    }
    // a few horizontal streaks
    for (let i = 0; i < 4; i++) { const y = t.ri(16), x = t.ri(16), l = 2 + t.ri(4); for (let k = 0; k < l; k++) t.set(x + k, y, STONE[t.rand() < 0.5 ? 3 : 1]); }
  };
  function voronoiStones(t, base, dark, count, jit) {
    const pts = [];
    for (let i = 0; i < count; i++) pts.push([t.rand() * 16, t.rand() * 16, 0.82 + t.rand() * 0.36]);
    const cellOf = new Int16Array(256), edge = new Uint8Array(256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let d1 = 1e9, d2 = 1e9, c = 0;
      for (let i = 0; i < pts.length; i++) {
        for (let oy = -16; oy <= 16; oy += 16) for (let ox = -16; ox <= 16; ox += 16) {
          const dx = x + 0.5 - pts[i][0] - ox, dy = (y + 0.5 - pts[i][1] - oy) * 1.15;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) { d2 = d1; d1 = d; c = i; } else if (d < d2) d2 = d;
        }
      }
      cellOf[y * 16 + x] = c;
      edge[y * 16 + x] = (d2 - d1) < 1.1 ? 1 : 0;
    }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = y * 16 + x;
      if (edge[i]) { t.set(x, y, jitter(t, dark, 0.08)); continue; }
      let c = mul(base, pts[cellOf[i]][2]);
      if (edge[((y - 1) & 15) * 16 + x] || edge[y * 16 + ((x - 1) & 15)]) c = mul(c, 1.14);
      else if (edge[((y + 1) & 15) * 16 + x] || edge[y * 16 + ((x + 1) & 15)]) c = mul(c, 0.84);
      t.set(x, y, jitter(t, c, jit));
    }
    return { cellOf, edge };
  }
  G.cobblestone = t => { voronoiStones(t, [128, 128, 128], [72, 72, 72], 10, 0.06); };
  G.mossy_cobblestone = t => {
    voronoiStones(t, [128, 128, 128], [72, 72, 72], 10, 0.06);
    const n = valueNoise(t, 4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (n[y * 16 + x] + t.rand() * 0.3 > 0.75) {
        const c = t.get(x, y); const l = (c[0] + c[1] + c[2]) / 3 / 128;
        t.set(x, y, mul([72, 118, 52], l));
      }
    }
  };
  G.planks = t => {
    const base = [160, 130, 78];
    for (let b = 0; b < 4; b++) {
      const off = t.rand() * 10;
      const seam = (b * 7 + 3 + t.ri(3)) % 16;
      for (let yy = 0; yy < 4; yy++) {
        const y = b * 4 + yy;
        for (let x = 0; x < 16; x++) {
          let c = base;
          const g = Math.sin((x + off) * 0.9 + yy * 2.1) + Math.sin((x * 0.37 + off) * 2.3);
          if (g > 1.1) c = mul(base, 0.88); else if (g < -1.2) c = mul(base, 1.07);
          if (yy === 3) c = mul(base, 0.66);
          if (x === seam && yy < 3) c = mul(base, 0.72);
          t.set(x, y, jitter(t, c, 0.03));
        }
      }
      if (t.rand() < 0.7) t.set((seam + 2) % 16, b * 4 + 1, mul(base, 0.6));
    }
  };
  G.bedrock = t => {
    const n = valueNoise(t, 2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = n[y * 16 + x] * 0.6 + t.rand() * 0.4;
      const g = v < 0.25 ? 34 : v < 0.45 ? 64 : v < 0.62 ? 90 : v < 0.8 ? 112 : 140;
      t.set(x, y, [g, g, g]);
    }
  };
  G.sand = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = t.rand();
      t.set(x, y, v < 0.5 ? [219, 211, 160] : v < 0.75 ? [212, 202, 150] : v < 0.92 ? [227, 220, 172] : [196, 186, 134]);
    }
  };
  G.gravel = t => {
    const cols = [[136, 126, 126], [110, 104, 104], [150, 142, 140], [124, 110, 100], [96, 90, 90], [168, 160, 158]];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, cols[0]);
    for (let i = 0; i < 38; i++) {
      const x = t.ri(16), y = t.ri(16), c = cols[t.ri(cols.length)];
      const w = 1 + t.ri(2), h = 1 + t.ri(2);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) t.set((x + xx) & 15, (y + yy) & 15, jitter(t, c, 0.05));
      t.set((x + w) & 15, (y + h) & 15, cols[4]);
    }
  };
  G.log_side = t => {
    const base = [104, 83, 51];
    for (let x = 0; x < 16; x++) {
      const stripe = t.rand();
      for (let y = 0; y < 16; y++) {
        let c = base;
        if (stripe < 0.3) c = mul(base, 0.75);
        else if (stripe > 0.8) c = mul(base, 1.12);
        if (t.rand() < 0.12) c = mul(c, 0.8);
        t.set(x, y, jitter(t, c, 0.04));
      }
    }
    for (let i = 0; i < 6; i++) { const x = t.ri(16), y = t.ri(16); for (let k = 0; k < 3; k++) t.set(x, y + k, mul(base, 0.6)); }
  };
  G.log_top = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
      const r = Math.max(dx, dy) + Math.min(dx, dy) * 0.25;
      let c;
      if (r > 7) c = [104, 83, 51];
      else { const ring = Math.floor(r) % 2; c = ring ? [165, 132, 80] : [184, 150, 94]; if (r < 1) c = [150, 118, 70]; }
      t.set(x, y, jitter(t, c, 0.03));
    }
  };
  const LEAF = [[66, 140, 44], [56, 122, 36], [82, 160, 54], [44, 104, 30], [96, 172, 64]];
  G.leaves = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = t.rand();
      if (v < 0.2) { t.set(x, y, [0, 0, 0], 0); continue; }
      t.set(x, y, v < 0.38 ? LEAF[3] : v < 0.62 ? LEAF[1] : v < 0.85 ? LEAF[0] : v < 0.95 ? LEAF[2] : LEAF[4]);
    }
  };
  G.leaves_opaque = t => {
    G.leaves(t);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.alpha(x, y) === 0) t.set(x, y, [30, 66, 20]);
  };
  G.sponge = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, [196, 192, 74], 0.06));
    for (let i = 0; i < 14; i++) { const x = t.ri(15), y = t.ri(15); t.set(x, y, [150, 146, 44]); if (t.rand() < 0.5) t.set(x + 1, y, [160, 156, 50]); t.set(x, y + 1, [215, 212, 100]); }
  };
  G.glass = t => {
    t.clear();
    const edge = [210, 234, 240], hi = [255, 255, 255];
    for (let i = 0; i < 16; i++) { t.set(i, 0, edge); t.set(i, 15, edge); t.set(0, i, edge); t.set(15, i, edge); }
    t.set(0, 0, hi); t.set(15, 15, [180, 210, 220]);
    const streaks = [[3, 2], [4, 3], [5, 4], [2, 3], [3, 4], [10, 9], [11, 10], [12, 11]];
    for (const [x, y] of streaks) t.set(x, y, [230, 245, 250], 200);
  };
  G.wool = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = ((x + y * 3) % 4 === 0) ? 0.93 : 1;
      t.set(x, y, jitter(t, mul([228, 228, 228], v), 0.03));
    }
  };
  function ore(t, c1, c2, c3, clusters) {
    G.stone(t);
    for (let i = 0; i < clusters; i++) {
      const cx = 2 + t.ri(12), cy = 2 + t.ri(12);
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [2, 1], [1, 2]];
      const n = 3 + t.ri(4);
      for (let k = 0; k < n; k++) {
        const p = pts[k];
        const v = t.rand();
        t.set(cx + p[0], cy + p[1], v < 0.5 ? c1 : v < 0.8 ? c2 : c3);
      }
    }
  }
  G.coal_ore = t => ore(t, [52, 52, 52], [34, 34, 34], [74, 74, 74], 5);
  G.iron_ore = t => ore(t, [216, 175, 147], [176, 138, 112], [228, 196, 172], 4);
  G.gold_ore = t => ore(t, [252, 238, 75], [210, 178, 40], [255, 252, 180], 4);
  G.diamond_ore = t => ore(t, [93, 236, 245], [42, 180, 196], [205, 250, 250], 4);
  G.redstone_ore = t => ore(t, [255, 20, 20], [170, 0, 0], [255, 120, 120], 5);
  function metalBlock(t, base) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = base;
      if (x === 0 || y === 0) c = mul(base, 1.18);
      else if (x === 15 || y === 15) c = mul(base, 0.7);
      else if (x === 1 || y === 1) c = mul(base, 1.08);
      else if (x === 14 || y === 14) c = mul(base, 0.84);
      else if ((x + y) % 7 === 0 && x > 3 && x < 12) c = mul(base, 1.1);
      t.set(x, y, jitter(t, c, 0.02));
    }
  }
  G.iron_block = t => metalBlock(t, [214, 214, 214]);
  G.gold_block = t => metalBlock(t, [250, 212, 64]);
  G.diamond_block = t => metalBlock(t, [110, 224, 218]);
  G.bricks = t => {
    const mortar = [178, 170, 160], brick = [150, 74, 58];
    for (let y = 0; y < 16; y++) {
      const row = y >> 2, off = row % 2 ? 4 : 0;
      for (let x = 0; x < 16; x++) {
        if (y % 4 === 3 || ((x + off) % 8 === 7)) { t.set(x, y, jitter(t, mortar, 0.04)); continue; }
        let c = brick;
        if (y % 4 === 0) c = mul(brick, 1.1);
        t.set(x, y, jitter(t, c, 0.07));
      }
    }
  };
  G.obsidian = t => {
    const n = valueNoise(t, 4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = n[y * 16 + x] + t.rand() * 0.25;
      t.set(x, y, v > 0.95 ? [74, 54, 110] : v > 0.8 ? [46, 32, 70] : v > 0.5 ? [22, 18, 34] : [16, 12, 26]);
    }
  };
  G.slab_top = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = [168, 168, 168];
      if (x === 0 || y === 0) c = [190, 190, 190]; else if (x === 15 || y === 15) c = [120, 120, 120];
      t.set(x, y, jitter(t, c, 0.04));
    }
  };
  G.slab_side = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = [160, 160, 160];
      if (y === 0 || y === 8) c = [188, 188, 188]; else if (y === 7 || y === 15) c = [112, 112, 112];
      t.set(x, y, jitter(t, c, 0.04));
    }
  };
  G.tnt_side = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = [206, 58, 26];
      if (x % 4 === 3) c = [160, 40, 20];
      if (y >= 5 && y <= 10) c = [236, 236, 236];
      t.set(x, y, jitter(t, c, 0.04));
    }
    const k = [30, 30, 30];
    t.art([
      'kkk.k..k.kkk',
      '.k..kk.k..k.',
      '.k..k.kk..k.',
      '.k..k..k..k.'
    ], { k }, 2, 6);
  };
  G.tnt_top = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, [196, 70, 40], 0.06));
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) t.set(x, y, [150, 150, 150]);
    t.rect(7, 7, 8, 8, [40, 40, 40]);
    t.set(7, 6, [80, 80, 80]);
  };
  G.tnt_bottom = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, [170, 60, 36], 0.06)); };
  G.bookshelf = t => {
    G.planks(t);
    const cols = [[160, 40, 40], [40, 60, 160], [50, 130, 50], [140, 110, 40], [110, 50, 120], [60, 60, 60], [180, 150, 90]];
    for (const y0 of [1, 9]) {
      let x = 1;
      while (x < 15) {
        const w = 1 + t.ri(2), h = 5 + t.ri(2);
        const c = cols[t.ri(cols.length)];
        for (let xx = 0; xx < w && x + xx < 15; xx++) for (let yy = 7 - h; yy < 6; yy++) {
          t.set(x + xx, y0 + yy, xx === 0 ? mul(c, 1.15) : c);
        }
        if (w > 1) t.set(x, y0 + 7 - h + 1, [220, 200, 120]);
        x += w;
        if (t.rand() < 0.15) x++;
      }
      for (let xx = 0; xx < 16; xx++) { t.set(xx, y0 + 6, [90, 70, 40]); }
    }
  };
  G.dandelion = t => {
    t.clear();
    t.art([
      '................',
      '................',
      '................',
      '................',
      '......yY........',
      '.....yYYy.......',
      '.....YoYY.......',
      '......yY........',
      '.......g........',
      '.......g..G.....',
      '.......gGG......',
      '....G..g........',
      '.....GGg........',
      '.......g........',
      '.......g........',
      '.......g........'
    ], { y: [230, 210, 30], Y: [255, 240, 70], o: [250, 180, 20], g: [60, 130, 30], G: [80, 160, 40] });
  };
  G.rose = t => {
    t.clear();
    t.art([
      '................',
      '................',
      '................',
      '......rR........',
      '.....rRRr.......',
      '....rRdRRr......',
      '.....rRRr.......',
      '......rr........',
      '.......g........',
      '.......g..G.....',
      '.......gGG......',
      '....G..g........',
      '.....GGg........',
      '.......g........',
      '.......g........',
      '.......g........'
    ], { r: [190, 20, 20], R: [236, 40, 36], d: [130, 10, 10], g: [60, 130, 30], G: [80, 160, 40] });
  };
  G.brown_mushroom = t => {
    t.clear();
    t.art([
      '................', '................', '................', '................',
      '................', '................', '................',
      '......bbbb......',
      '....bBBBBBBb....',
      '...bBBbBBBBBb...',
      '...dddddddddd...',
      '.......ss.......',
      '.......ss.......',
      '.......sS.......',
      '.......sS.......',
      '................'
    ], { b: [140, 104, 76], B: [164, 126, 96], d: [110, 80, 56], s: [220, 214, 200], S: [190, 184, 170] });
  };
  G.red_mushroom = t => {
    t.clear();
    t.art([
      '................', '................', '................', '................',
      '................', '................',
      '......rrrr......',
      '....rRwRRRRr....',
      '...rRRRRRwRRr...',
      '...rwRRRRRRRr...',
      '...dddddddddd...',
      '.......ss.......',
      '.......ss.......',
      '.......sS.......',
      '.......sS.......',
      '................'
    ], { r: [180, 20, 20], R: [226, 32, 30], w: [250, 240, 240], d: [140, 14, 14], s: [220, 214, 200], S: [190, 184, 170] });
  };
  G.sapling = t => {
    t.clear();
    t.art([
      '................',
      '.......G........',
      '.....GgGG.......',
      '....gGGgGG......',
      '...GgLGGgGG.....',
      '....GGgLGg......',
      '...gGGGGgGG.....',
      '....GgGbGG......',
      '.....GGbg.......',
      '.......b........',
      '.......b........',
      '......bb........',
      '.......b........',
      '.......b........',
      '.......b........',
      '.......b........'
    ], { G: [72, 150, 44], g: [50, 112, 30], L: [110, 190, 70], b: [104, 80, 44] });
  };
  G.reeds = t => {
    t.clear();
    const s = [120, 180, 80], d = [80, 140, 50], j = [180, 210, 130];
    for (const x of [3, 8, 12]) {
      for (let y = 0; y < 16; y++) {
        t.set(x, y, (y % 5 === 0) ? j : s);
        t.set(x + 1, y, d);
      }
      t.set(x - 1, (x * 3) % 16, [100, 170, 60]); t.set(x + 2, (x * 5 + 4) % 16, [100, 170, 60]);
    }
  };
  G.torch = t => {
    t.clear();
    for (let y = 8; y < 16; y++) { t.set(7, y, [120, 94, 56]); t.set(8, y, [90, 70, 40]); }
    t.set(7, 6, [255, 255, 180]); t.set(8, 6, [255, 230, 100]);
    t.set(7, 7, [255, 200, 60]); t.set(8, 7, [240, 140, 30]);
    t.set(7, 5, [255, 240, 150], 180); t.set(8, 5, [255, 200, 90], 120);
  };
  G.fire = t => { t.clear(); };
  G.fire_2 = t => { t.clear(); };
  G.spawner = t => {
    t.clear();
    const bar = [36, 44, 56], hi = [70, 86, 104];
    for (let i = 0; i < 16; i++) {
      for (const k of [0, 5, 10, 15]) { t.set(k, i, bar); t.set(i, k, bar); }
    }
    for (let i = 0; i < 16; i += 5) { t.set(i, i, hi); }
    t.set(2, 2, [50, 60, 72]); t.set(12, 7, [50, 60, 72]);
  };
  function woodBox(t, base) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = base;
      if (x === 0 || y === 0 || x === 15 || y === 15) c = mul(base, 0.55);
      else if ((y + (x > 7 ? 2 : 0)) % 5 === 0) c = mul(base, 0.85);
      t.set(x, y, jitter(t, c, 0.04));
    }
  }
  G.chest_top = t => woodBox(t, [168, 120, 56]);
  G.chest_side = t => { woodBox(t, [160, 114, 52]); for (let x = 1; x < 15; x++) t.set(x, 5, [86, 60, 28]); };
  G.chest_front = t => {
    G.chest_side(t);
    t.rect(7, 4, 8, 7, [200, 200, 200]);
    t.set(7, 7, [110, 110, 110]); t.set(8, 7, [110, 110, 110]);
    t.set(7, 4, [240, 240, 240]);
  };
  G.crafting_table_top = t => {
    G.planks(t);
    for (let i = 0; i < 16; i++) { t.set(i, 0, [110, 80, 40]); t.set(i, 15, [110, 80, 40]); t.set(0, i, [110, 80, 40]); t.set(15, i, [110, 80, 40]); }
    for (let i = 1; i < 15; i++) { t.set(i, 5, [120, 90, 50]); t.set(i, 10, [120, 90, 50]); t.set(5, i, [120, 90, 50]); t.set(10, i, [120, 90, 50]); }
    // hammer + saw hints
    t.art(['mmm', '.h.', '.h.'], { m: [150, 150, 160], h: [100, 76, 40] }, 2, 2);
    t.art(['sssss', 'SSSSS'], { s: [190, 190, 200], S: [140, 140, 150] }, 9, 12);
  };
  G.crafting_table_side = t => {
    G.planks(t);
    for (let x = 0; x < 16; x++) { t.set(x, 0, [120, 90, 50]); t.set(x, 1, [140, 104, 60]); }
    t.art([
      '..............',
      '..mmm.........',
      '..mmm....SS...',
      '...h....SSSS..',
      '...h....SSSSS.',
      '...h.....SSSS.',
      '...h......hh..',
      '...h......hh..'
    ], { m: [140, 140, 150], h: [92, 66, 32], S: [180, 180, 190] }, 1, 3);
  };
  G.crafting_table_front = t => {
    G.planks(t);
    for (let x = 0; x < 16; x++) { t.set(x, 0, [120, 90, 50]); t.set(x, 1, [140, 104, 60]); }
    t.art([
      '...........',
      '..sssssss..',
      '..shhhhhs..',
      '.....h.....',
      '.....h.....',
      '..t..h..t..',
      '..t..h..t..',
      '..tt.h.tt..'
    ], { s: [170, 170, 180], h: [92, 66, 32], t: [70, 70, 80] }, 2, 4);
  };
  function smoothStone(t, base) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = base;
      if (x === 0 || y === 0) c = mul(base, 1.12); else if (x === 15 || y === 15) c = mul(base, 0.72);
      t.set(x, y, jitter(t, c, 0.07));
    }
  }
  G.furnace_side = t => smoothStone(t, [120, 120, 120]);
  G.furnace_top = t => smoothStone(t, [132, 132, 132]);
  G.furnace_front = t => {
    smoothStone(t, [120, 120, 120]);
    for (let y = 8; y < 14; y++) for (let x = 3; x < 13; x++) t.set(x, y, y === 8 ? [60, 60, 60] : [26, 26, 26]);
    for (let x = 3; x < 13; x++) t.set(x, 5, [90, 90, 90]);
  };
  G.furnace_front_lit = t => {
    G.furnace_front(t);
    for (let y = 10; y < 14; y++) for (let x = 4; x < 12; x++) {
      const v = t.rand();
      t.set(x, y, y === 13 ? [255, 200, 60] : v < 0.4 ? [255, 120, 20] : v < 0.7 ? [230, 80, 10] : [60, 20, 10]);
    }
  };
  for (let s = 0; s < 8; s++) {
    G['wheat_' + s] = t => {
      t.clear();
      const h = 2 + s * 1.7 | 0;
      const ripe = s / 7;
      const stem = mix([70, 150, 40], [180, 160, 60], ripe * ripe);
      const head = mix([90, 170, 50], [220, 190, 90], ripe);
      for (const x of [1, 4, 7, 10, 13]) {
        const hh = Math.max(1, h - ((x * 7) % 3));
        for (let y = 15; y > 15 - hh; y--) t.set(x + ((y + x) % 3 === 0 ? 1 : 0), y, stem);
        if (s >= 4) for (let y = 15 - hh; y < 15 - hh + 3 && y < 16; y++) { t.set(x, y, head); t.set(x + 1, y, mul(head, 0.85)); }
      }
    };
  }
  G.farmland_dry = t => {
    G.dirt(t);
    for (let y = 0; y < 16; y++) if (y % 4 === 0) for (let x = 0; x < 16; x++) t.set(x, y, mul(t.get(x, y), 0.72));
    for (let x = 0; x < 16; x++) { t.set(x, 0, [96, 68, 46]); t.set(x, 15, [96, 68, 46]); }
    for (let y = 0; y < 16; y++) { t.set(0, y, [96, 68, 46]); t.set(15, y, [96, 68, 46]); }
  };
  G.farmland_wet = t => { G.farmland_dry(t); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.shade(x, y, 0.62); };
  G.door_top = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = [150, 118, 70];
      if (x === 0 || x === 15 || y === 0) c = [104, 78, 44];
      t.set(x, y, jitter(t, c, 0.04));
    }
    for (const [x0, y0] of [[2, 2], [9, 2], [2, 9], [9, 9]]) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) t.set(x0 + x, y0 + y, [0, 0, 0], 0);
    for (let x = 1; x < 15; x++) t.set(x, 15, [120, 92, 52]);
  };
  G.door_bottom = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = [150, 118, 70];
      if (x === 0 || x === 15 || y === 15) c = [104, 78, 44];
      else if (y % 5 === 0) c = [124, 96, 56];
      t.set(x, y, jitter(t, c, 0.04));
    }
    t.set(12, 6, [60, 60, 60]); t.set(12, 7, [200, 200, 200]);
  };
  G.ladder = t => {
    t.clear();
    const r = [120, 92, 52], d = [86, 64, 34];
    for (let y = 0; y < 16; y++) { t.set(2, y, r); t.set(3, y, d); t.set(12, y, r); t.set(13, y, d); }
    for (const y of [1, 5, 9, 13]) { for (let x = 2; x < 14; x++) t.set(x, y, r); for (let x = 4; x < 12; x++) t.set(x, y + 1, d); }
  };
  G.ice = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, jitter(t, [140, 178, 250], 0.04), 170);
    for (const [x, y] of [[3, 3], [4, 4], [5, 5], [10, 2], [11, 3], [9, 10], [10, 11], [2, 12]]) t.set(x, y, [210, 230, 255], 200);
  };
  G.cactus_side = t => {
    t.clear();
    for (let y = 0; y < 16; y++) for (let x = 1; x < 15; x++) {
      let c = [16, 118, 32];
      if (x % 4 === 1) c = [12, 90, 24]; else if (x % 4 === 3) c = [30, 140, 44];
      t.set(x, y, jitter(t, c, 0.05));
    }
    for (let i = 0; i < 8; i++) { t.set(i % 2 ? 0 : 15, t.ri(16), [230, 230, 200]); }
    for (let i = 0; i < 6; i++) t.set(2 + t.ri(12), t.ri(16), [0, 60, 10]);
  };
  G.cactus_top = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
      let c = [20, 124, 36];
      if (dx > 6.5 || dy > 6.5) c = [0, 0, 0];
      else if (Math.max(dx, dy) > 5) c = [12, 96, 26];
      if (c[0] === 0 && c[1] === 0) t.set(x, y, c, 0); else t.set(x, y, jitter(t, c, 0.05));
    }
    t.set(7, 7, [230, 230, 180]); t.set(4, 4, [230, 230, 180]); t.set(11, 11, [230, 230, 180]);
  };
  G.cactus_bottom = t => { G.cactus_top(t); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.alpha(x, y)) t.shade(x, y, 0.8); };
  G.clay = t => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = t.rand(); t.set(x, y, v < 0.7 ? [160, 166, 179] : v < 0.85 ? [150, 156, 170] : [172, 178, 190]); } };
  G.pumpkin_top = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      t.set(x, y, jitter(t, r > 6.5 ? [190, 110, 20] : (r | 0) % 3 === 0 ? [206, 124, 26] : [222, 140, 32], 0.04));
    }
    t.rect(7, 7, 8, 8, [100, 80, 30]);
  };
  G.pumpkin_side = t => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = [222, 138, 30];
      if (x % 5 === 0) c = [186, 104, 18]; else if (x % 5 === 2) c = [236, 156, 44];
      if (y === 0 || y === 15) c = mul(c, 0.8);
      t.set(x, y, jitter(t, c, 0.04));
    }
  };
  function pumpkinFace(t, lit) {
    G.pumpkin_side(t);
    const k = lit ? [255, 220, 80] : [50, 30, 10];
    const k2 = lit ? [255, 180, 40] : [30, 16, 6];
    t.art([
      '................',
      '................',
      '................',
      '...kk......kk...',
      '..kKKk....kKKk..',
      '..kkkk....kkkk..',
      '................',
      '................',
      '..kkk.kkkk.kkk..',
      '..kKKkKKKKkKKk..',
      '...kkkkkkkkkk...',
      '.....k....k.....'
    ], { k, K: k2 }, 0, 1);
  }
  G.pumpkin_face = t => pumpkinFace(t, false);
  G.jack_o_lantern_face = t => pumpkinFace(t, true);
  G.water = t => { t.fill([40, 60, 255, 170]); };
  G.water_flow = t => { t.fill([40, 60, 255, 170]); };
  G.lava = t => { t.fill([220, 90, 10]); };
  G.lava_flow = t => { t.fill([220, 90, 10]); };
  G.white = t => { t.fill([255, 255, 255]); };

  // Crack overlay stages: shared crack paths revealed progressively.
  (function () {
    const r = new S.RNG(1337);
    const paths = [];
    for (let i = 0; i < 9; i++) {
      let x = 7.5, y = 7.5;
      const ang = i / 9 * Math.PI * 2 + r.next() * 0.5;
      const pts = [];
      for (let s = 0; s < 12; s++) {
        x += Math.cos(ang + (r.next() - 0.5) * 1.3) * 0.9;
        y += Math.sin(ang + (r.next() - 0.5) * 1.3) * 0.9;
        pts.push([Math.round(x), Math.round(y)]);
      }
      paths.push(pts);
    }
    for (let s = 0; s < 10; s++) {
      G['destroy_' + s] = t => {
        t.clear();
        const len = 1 + Math.floor((s + 1) * 1.15);
        const count = Math.min(9, 2 + s);
        for (let p = 0; p < count; p++) {
          for (let k = 0; k < len && k < paths[p].length; k++) {
            const [x, y] = paths[p][k];
            t.set(x, y, [40, 40, 40], 255);
            if (s > 5 && k % 3 === 1) t.set(x + 1, y, [70, 70, 70], 255);
          }
        }
        t.set(7, 7, [30, 30, 30], 255); t.set(8, 8, [30, 30, 30], 255);
      };
    }
  })();

  Tex.G = G;
  Tex.helpers = { mix, mul, jitter, valueNoise, voronoiStones, ore, metalBlock, smoothStone, woodBox };

  /* ---------------------------------------------------------------- */
  /* Animated textures (cellular automata)                            */
  /* ---------------------------------------------------------------- */
  function WaterFX(flow) {
    this.red = new Float32Array(256); this.green = new Float32Array(256);
    this.blue = new Float32Array(256); this.alpha = new Float32Array(256);
    this.data = new Uint8ClampedArray(1024);
    this.flow = flow; this.tickCount = 0;
    this.rng = new S.RNG(flow ? 77 : 55);
  }
  WaterFX.prototype.tick = function () {
    const { red, green, blue, alpha } = this;
    this.tickCount++;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      let f = 0;
      if (this.flow) { for (let k = j - 2; k <= j; k++) f += red[(i & 15) + (k & 15) * 16]; }
      else { for (let k = i - 1; k <= i + 1; k++) f += red[(k & 15) + (j & 15) * 16]; }
      green[i + j * 16] = f / (this.flow ? 3.2 : 3.3) + blue[i + j * 16] * 0.8;
    }
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const idx = i + j * 16;
      blue[idx] += alpha[idx] * 0.05;
      if (blue[idx] < 0) blue[idx] = 0;
      alpha[idx] -= this.flow ? 0.3 : 0.1;
      if (this.rng.next() < (this.flow ? 0.2 : 0.05)) alpha[idx] = this.flow ? 0.5 : 0.5;
    }
    const t = green; this.green = red; this.red = t;
    const d = this.data, rr = this.red;
    for (let i = 0; i < 256; i++) {
      let f = rr[i]; f = f > 1 ? 1 : f < 0 ? 0 : f;
      const f2 = f * f;
      d[i * 4] = 32 + f2 * 32; d[i * 4 + 1] = 50 + f2 * 64; d[i * 4 + 2] = 255; d[i * 4 + 3] = 146 + f2 * 50;
    }
    if (this.flow) {
      // shift for flowing look
      const sh = this.tickCount % 16;
      const src = new Uint8ClampedArray(d);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const sy = (y - sh + 16) & 15;
        for (let c = 0; c < 4; c++) d[(y * 16 + x) * 4 + c] = src[(sy * 16 + x) * 4 + c];
      }
    }
  };
  function LavaFX(flow) {
    this.red = new Float32Array(256); this.green = new Float32Array(256);
    this.blue = new Float32Array(256); this.alpha = new Float32Array(256);
    this.data = new Uint8ClampedArray(1024); this.flow = flow; this.tickCount = 0;
    this.rng = new S.RNG(flow ? 99 : 88);
  }
  LavaFX.prototype.tick = function () {
    const { red, green, blue, alpha } = this;
    this.tickCount++;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      let f = 0;
      const l = (Math.sin(j * Math.PI * 2 / 16) * 1.2) | 0;
      const i1 = (Math.sin(i * Math.PI * 2 / 16) * 1.2) | 0;
      for (let k = i - 1; k <= i + 1; k++) for (let m = j - 1; m <= j + 1; m++) f += red[((k + l) & 15) + ((m + i1) & 15) * 16];
      green[i + j * 16] = f / 10 + (blue[(i & 15) + (j & 15) * 16] + blue[((i + 1) & 15) + (j & 15) * 16] +
        blue[((i + 1) & 15) + ((j + 1) & 15) * 16] + blue[(i & 15) + ((j + 1) & 15) * 16]) / 4 * 0.8;
      const idx = i + j * 16;
      blue[idx] += alpha[idx] * 0.01;
      if (blue[idx] < 0) blue[idx] = 0;
      alpha[idx] -= 0.06;
      if (this.rng.next() < 0.005) alpha[idx] = 1.5;
    }
    const t = green; this.green = red; this.red = t;
    const d = this.data, rr = this.red;
    const sh = this.flow ? ((this.tickCount / 3) | 0) % 16 : 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = ((y - sh + 16) & 15) * 16 + x;
      let f = rr[i] * 2; f = f > 1 ? 1 : f < 0 ? 0 : f;
      const o = (y * 16 + x) * 4;
      d[o] = f * 100 + 155; d[o + 1] = f * f * 255; d[o + 2] = f * f * f * f * 128; d[o + 3] = 255;
    }
  };
  function FireFX(variant) {
    this.a = new Float32Array(320); this.b = new Float32Array(320);
    this.data = new Uint8ClampedArray(1024); this.rng = new S.RNG(variant ? 1234 : 4321);
  }
  FireFX.prototype.tick = function () {
    const a = this.a, b = this.b, r = this.rng;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 20; j++) {
      let k = 18;
      let f = a[i + ((j + 1) % 20) * 16] * k;
      for (let l = i - 1; l <= i + 1; l++) for (let m = j; m <= j + 1; m++) {
        if (l >= 0 && m >= 0 && l < 16 && m < 20) f += a[l + m * 16];
        k++;
      }
      b[i + j * 16] = f / (k * 1.06);
      if (j >= 19) b[i + j * 16] = r.next() * r.next() * r.next() * 4 + r.next() * 0.1 + 0.2;
    }
    this.a = b; this.b = a;
    const d = this.data;
    for (let i = 0; i < 256; i++) {
      let f = this.a[i] * 1.8; f = f > 1 ? 1 : f < 0 ? 0 : f;
      d[i * 4] = f * 155 + 100; d[i * 4 + 1] = f * f * 255; d[i * 4 + 2] = Math.pow(f, 10) * 255; d[i * 4 + 3] = f < 0.5 ? 0 : 255;
    }
  };
  Tex.anims = [
    { tile: S.T.water, fx: new WaterFX(false) },
    { tile: S.T.water_flow, fx: new WaterFX(true) },
    { tile: S.T.lava, fx: new LavaFX(false) },
    { tile: S.T.lava_flow, fx: new LavaFX(true) },
    { tile: S.T.fire, fx: new FireFX(0) },
    { tile: S.T.fire_2, fx: new FireFX(1) }
  ];
  for (const a of Tex.anims) for (let i = 0; i < 60; i++) a.fx.tick();
  Tex.tickAnimations = function () { for (const a of Tex.anims) a.fx.tick(); };

  /* ---------------------------------------------------------------- */
  /* Items                                                            */
  /* ---------------------------------------------------------------- */
  const MAT = {
    wood: { o: [40, 30, 14], d: [104, 78, 40], m: [138, 104, 56], l: [170, 132, 76] },
    stone: { o: [40, 40, 40], d: [96, 96, 96], m: [128, 128, 128], l: [160, 160, 160] },
    iron: { o: [50, 50, 50], d: [170, 170, 170], m: [212, 212, 212], l: [245, 245, 245] },
    gold: { o: [70, 50, 0], d: [210, 160, 20], m: [250, 214, 60], l: [255, 250, 160] },
    diamond: { o: [10, 60, 60], d: [30, 170, 160], m: [80, 230, 220], l: [200, 255, 250] },
    leather: { o: [50, 24, 10], d: [110, 60, 30], m: [150, 88, 46], l: [182, 118, 70] }
  };
  const STICK = { s: [104, 78, 40], S: [150, 116, 62], k: [40, 30, 14] };
  function toolPal(mat) { const m = MAT[mat]; return Object.assign({ o: m.o, d: m.d, m: m.m, l: m.l }, STICK); }

  const ART = {};
  ART.pickaxe = [
    '................',
    '....oooooo......',
    '...ollllmmo.....',
    '..olmmmmmmdo....',
    '..oddooooommo...',
    '...oo...okSdmo..',
    '.......okSo.omo.',
    '......okSo...odo',
    '.....okSo....odo',
    '....okSo......oo',
    '...okSo.........',
    '..okSo..........',
    '.okSo...........',
    'okSo............',
    'oko.............',
    '.o..............'
  ];
  ART.axe = [
    '................',
    '.....oo.........',
    '....olmo........',
    '...olmmmoo......',
    '...olmmmdoo.....',
    '...olmmdokSo....',
    '....oddokSo.....',
    '.....ookSo......',
    '.....okSo.......',
    '....okSo........',
    '...okSo.........',
    '..okSo..........',
    '.okSo...........',
    'okSo............',
    'oko.............',
    '.o..............'
  ];
  ART.shovel = [
    '................',
    '..........ooo...',
    '.........olllo..',
    '........olmmmlo.',
    '........ommmmdo.',
    '.........ommddo.',
    '........okoddo..',
    '.......okSooo...',
    '......okSo......',
    '.....okSo.......',
    '....okSo........',
    '...okSo.........',
    '..okSo..........',
    '.okSo...........',
    'oko.............',
    '.o..............'
  ];
  ART.sword = [
    '.............ooo',
    '............olmo',
    '...........olmdo',
    '..........olmdo.',
    '.........olmdo..',
    '........olmdo...',
    '.......olmdo....',
    '......olmdo.....',
    '..oo.olmdo......',
    '..odolmdo.......',
    '...oddmo........',
    '...okdo.........',
    '..okSooo........',
    '.okSo..od.......',
    'okSo............',
    'ooo.............'
  ];
  ART.hoe = [
    '................',
    '.....ooooo......',
    '....olllmdo.....',
    '....oddmmdo.....',
    '.....ooookSo....',
    '........okSo....',
    '.......okSo.....',
    '......okSo......',
    '.....okSo.......',
    '....okSo........',
    '...okSo.........',
    '..okSo..........',
    '.okSo...........',
    'okSo............',
    'oko.............',
    '.o..............'
  ];
  const ITEM_ART = {
    stick: [['.............ok.', '............okS.', '...........okSo.', '..........okSo..', '.........okSo...', '........okSo....', '.......okSo.....', '......okSo......', '.....okSo.......', '....okSo........', '...okSo.........', '..okSo..........', '..oSo...........', '..oo............'], STICK, 1],
    coal: [['................', '................', '.....kkkk.......', '...kkgggkkk.....', '..kggkkgggkk....', '..kgkkkkkggk....', '.kgkkgkkkkgkk...', '.kkkkkkkggkkk...', '.kgkkkkkkkkgk...', '..kkgkkgkkkk....', '..kkkkkkkkk.....', '....kkkkk.......'], { k: [30, 30, 30], g: [70, 70, 70] }, 2],
    diamond: [['................', '................', '....oooooo......', '...oLLlllmo.....', '..oLlllmmmdo....', '.ollllmmmmddo...', '..ommmmmmddo....', '...ommmmddo.....', '....ommddo......', '.....oddo.......', '......oo........'], { o: [10, 60, 60], L: [240, 255, 255], l: [180, 250, 245], m: [80, 230, 220], d: [30, 160, 150] }, 2],
    iron_ingot: [['................', '................', '................', '................', '.....ooooooo....', '....olllllldo...', '...olllllmmddo..', '..ommmmmmmmddo..', '..oddddddddddo..', '...oooooooooo...'], { o: [50, 50, 50], l: [245, 245, 245], m: [212, 212, 212], d: [150, 150, 150] }, 1],
    gold_ingot: [['................', '................', '................', '................', '.....ooooooo....', '....olllllldo...', '...olllllmmddo..', '..ommmmmmmmddo..', '..oddddddddddo..', '...oooooooooo...'], { o: [90, 60, 0], l: [255, 250, 160], m: [250, 214, 60], d: [200, 150, 20] }, 1],
    apple: [['................', '.......k........', '.......kG.......', '......kGG.......', '...rrrkrrr......', '..rRRRrRRRr.....', '.rRwRRRRRRRr....', '.rRRRRRRRRRr....', '.rRRRRRRRRdr....', '.rRRRRRRRRdr....', '..rRRRRRRddr....', '..rdRRRRdddr....', '...rrddddrr.....', '....rr..rr......'], { k: [80, 50, 20], G: [60, 140, 30], r: [110, 10, 10], R: [220, 30, 30], w: [255, 200, 200], d: [170, 20, 20] }, 1],
    golden_apple: [['................', '.......k........', '.......kG.......', '......kGG.......', '...yyykyyy......', '..yYYYyYYYy.....', '.yYwYYYYYYYy....', '.yYYYYYYYYYy....', '.yYYYYYYYYdy....', '.yYYYYYYYYdy....', '..yYYYYYYddy....', '..ydYYYYdddy....', '...yyddddyy.....', '....yy..yy......'], { k: [80, 50, 20], G: [60, 140, 30], y: [140, 100, 0], Y: [255, 220, 60], w: [255, 255, 220], d: [220, 170, 20] }, 1],
    bread: [['................', '................', '................', '.........oooo...', '......oooBBBBo..', '....ooBBbBBbBBo.', '...oBBbBBbBBbBo.', '..oBBBBBBBBBBBo.', '.oBbBBbBBbBBBo..', '.oBBBBBBBBBBo...', '.oddBBBBBBdo....', '..oddddddoo.....', '...ooooo........'], { o: [80, 50, 20], B: [200, 150, 70], b: [160, 110, 40], d: [150, 100, 40] }, 1],
    wheat: [['..........y.....', '.........yYy....', '........yYyY....', '.......yYyYy....', '......yYyYy.....', '.....yYyYy......', '....gYyYy.......', '...g.yYy........', '..g.g...........', '.g.g............', 'g.g.............', '.g..............'], { y: [180, 150, 60], Y: [220, 190, 90], g: [140, 130, 60] }, 2],
    seeds: [['................', '................', '................', '................', '....g.....g.....', '...gG..g..Gg....', '.......gG.......', '..g.........g...', '..Gg..g..g..Gg..', '......Gg.Gg.....', '....g.......g...', '....Gg.....gG...'], { g: [60, 120, 30], G: [110, 170, 70] }, 1],
    porkchop_raw: [['................', '................', '................', '......oooo......', '....ooPPPPoo....', '...oPPpPPPPPo...', '..oPPPPPPpPPPo..', '..oPPwwwPPPPPo..', '..oPwwwwwPPPo...', '...oPwwwPPPo....', '....oPPPPoo.....', '.....oooo.......'], { o: [120, 40, 40], P: [240, 130, 130], p: [210, 100, 100], w: [255, 230, 220] }, 1],
    porkchop_cooked: [['................', '................', '................', '......oooo......', '....ooPPPPoo....', '...oPPpPPPPPo...', '..oPPPPPPpPPPo..', '..oPPwwwPPPPPo..', '..oPwwwwwPPPo...', '...oPwwwPPPo....', '....oPPPPoo.....', '.....oooo.......'], { o: [70, 30, 10], P: [170, 100, 50], p: [130, 70, 30], w: [230, 200, 160] }, 1],
    feather: [['............ww..', '...........wWw..', '..........wWwg...', '.........wWwgw...', '........wWwgw....', '.......wWwgw.....', '......wWwgw......', '.....wWwgw.......', '....wWwgw........', '....wwgw.........', '...wwgw..........', '....g............', '...g.............', '..g..............'], { w: [220, 220, 220], W: [255, 255, 255], g: [150, 150, 150] }, 1],
    gunpowder: [['................', '................', '................', '................', '......gg........', '....ggGgg.......', '...gGgggGgg.....', '..ggkgGggkgg....', '..gGggkgGggGg...', '.gggGggggkggg...', '.ggkgggGgggkgg..', '..ggggggggggg...'], { g: [90, 90, 90], G: [130, 130, 130], k: [50, 50, 50] }, 1],
    string: [['................', '..........ww....', '.........w..w...', '........w....w..', '.......w.....w..', '......w.....w...', '.....w.....w....', '....w......w....', '...w......w.....', '..w......w......', '..w.....w.......', '...w...w........', '....www.........'], { w: [240, 240, 240] }, 1],
    bone: [['................', '............ww..', '...........wWWw.', '............wWw.', '...........wWw..', '..........wWw...', '.........wWw....', '........wWw.....', '.......wWw......', '......wWw.......', '.....wWw........', '..wwwWw.........', '..wWWw..........', '...ww...........'], { w: [200, 200, 180], W: [245, 245, 230] }, 1],
    leather: [['................', '................', '...oooooooooo...', '..oLLllllllllo..', '..olllllllllmo..', '...ollllllllmo..', '...olllllllmmo..', '..olllllllllmo..', '..ollllllllmmo..', '..ommmmmmmmmmo..', '...oooooooooo...'], { o: [60, 30, 10], L: [190, 120, 70], l: [158, 94, 50], m: [120, 70, 34] }, 2],
    flint: [['................', '................', '.......oo.......', '......oggo......', '.....oggGgo.....', '....oggGGggo....', '....oGgggggo....', '...oggggGggo....', '...oggGggggo....', '....ogggggo.....', '.....ooooo......'], { o: [20, 20, 20], g: [70, 70, 76], G: [120, 120, 130] }, 2],
    flint_and_steel: [['................', '..........ooo...', '.........ommmo..', '........omo.omo.', '.......omo...oo.', '..oo...oo.......', '.oggo...........', 'oggGgo..........', 'oGgggo..........', 'oggggo..........', '.oooo...........'], { o: [30, 30, 30], m: [190, 190, 190], g: [70, 70, 76], G: [120, 120, 130] }, 2],
    bow: [['................', '.........ooow...', '.......oobbow...', '......obbo..w...', '.....obo.....w..', '....obo......w..', '...obo.......w..', '...obo......w...', '..obo.......w...', '..obo......w....', '..obo.....w.....', '..obo....w......', '.obo...ww.......', '.oo.www.........', '.www............'], { o: [60, 40, 20], b: [140, 100, 50], w: [220, 220, 220] }, 0],
    arrow: [['................', '............oo..', '...........omlo..', '..........omlo...', '.........ok.o....', '........ok.......', '.......ok........', '......ok........', '.....ok..........', '..w.ok...........', '..wok............', '.wwk.............', 'www..............', '.w...............'], { o: [40, 40, 40], m: [150, 150, 150], l: [210, 210, 210], k: [110, 80, 40], w: [240, 240, 240] }, 1],
    bucket: [['................', '................', '...oooooooooo...', '..ommmmmmmmmdo..', '..oklllllllldo..', '...ommmmmmmdo...', '...ollmmmmmdo...', '...olmmmmmmdo...', '....olmmmmdo....', '....olmmmmdo....', '....oddddddo....', '.....oooooo.....'], { o: [40, 40, 40], m: [200, 200, 200], l: [240, 240, 240], d: [150, 150, 150], k: [60, 60, 60] }, 2],
    water_bucket: [['................', '................', '...oooooooooo...', '..owwWwwwwwwdo..', '..owwwwwWwwwdo..', '...ommmmmmmdo...', '...ollmmmmmdo...', '...olmmmmmmdo...', '....olmmmmdo....', '....olmmmmdo....', '....oddddddo....', '.....oooooo.....'], { o: [40, 40, 40], m: [200, 200, 200], l: [240, 240, 240], d: [150, 150, 150], w: [50, 80, 230], W: [110, 140, 255] }, 2],
    lava_bucket: [['................', '................', '...oooooooooo...', '..owwWwwwwwwdo..', '..owwwwwWwwwdo..', '...ommmmmmmdo...', '...ollmmmmmdo...', '...olmmmmmmdo...', '....olmmmmdo....', '....olmmmmdo....', '....oddddddo....', '.....oooooo.....'], { o: [40, 40, 40], m: [200, 200, 200], l: [240, 240, 240], d: [150, 150, 150], w: [230, 90, 10], W: [255, 200, 60] }, 2],
    milk_bucket: [['................', '................', '...oooooooooo...', '..owwWwwwwwwdo..', '..owwwwwWwwwdo..', '...ommmmmmmdo...', '...ollmmmmmdo...', '...olmmmmmmdo...', '....olmmmmdo....', '....olmmmmdo....', '....oddddddo....', '.....oooooo.....'], { o: [40, 40, 40], m: [200, 200, 200], l: [240, 240, 240], d: [150, 150, 150], w: [245, 245, 245], W: [255, 255, 255] }, 2],
    bowl: [['................', '................', '................', '................', '................', '..oooooooooooo..', '..odddddddddd o.', '..obbbbbbbbbbo..', '...obbbbbbbbo...', '....obbbbbbo....', '.....oooooo.....'], { o: [60, 40, 20], d: [90, 64, 30], b: [140, 100, 50] }, 2],
    mushroom_stew: [['................', '................', '................', '................', '................', '..oooooooooooo..', '..osssSssRsbso..', '..obbbbbbbbbbo..', '...obbbbbbbbo...', '....obbbbbbo....', '.....oooooo.....'], { o: [60, 40, 20], s: [180, 130, 90], S: [220, 180, 140], R: [200, 40, 30], b: [140, 100, 50] }, 2],
    paper: [['................', '................', '..pppppppppppp..', '..pwwwwwwwwwwp..', '..pwgggggggwwp..', '..pwwwwwwwwwwp..', '..pwggggggwwwp..', '..pwwwwwwwwwwp..', '..pwgggggggwwp..', '..pwwwwwwwwwwp..', '..pppppppppppp..'], { p: [200, 200, 190], w: [245, 245, 238], g: [190, 190, 180] }, 2],
    book: [['................', '...oooooooooo...', '..obbbbbbbbbwo..', '..obBBBBBBBbwo..', '..obBBBBBBBbwo..', '..obbbbbbbbbwo..', '..obbbbbbbbbwo..', '..obbbbbbbbbwo..', '..obbbbbbbbbwo..', '..obbbbbbbbbwo..', '..owwwwwwwwwwo..', '...oooooooooo...'], { o: [50, 20, 10], b: [120, 60, 30], B: [160, 90, 50], w: [240, 240, 230] }, 2],
    reeds: [['................', '.....g....g.....', '....gG...gG.....', '.....G....G.....', '.....G...GG.....', '.....G....G.g...', '....GG....Gg....', '.....G....G.....', '.....Gg...G.....', '.....G...GG.....', '.....G....G.....', '....gG....G.....', '.....G....G.....', '................'], { g: [100, 160, 60], G: [140, 200, 90] }, 1],
    clay_ball: [['................', '................', '................', '................', '......oooo......', '.....occcco.....', '....occCccco....', '....ocCcccco....', '....occcccdo....', '.....occddo.....', '......oooo......'], { o: [100, 104, 120], c: [160, 166, 179], C: [200, 205, 215], d: [130, 134, 148] }, 2],
    brick: [['................', '................', '................', '................', '................', '.....oooooooo...', '....obbbbbbbbo..', '...obBBBBBBbbo..', '..obbbbbbbbbo...', '..odddddddddo...', '...ooooooooo....'], { o: [80, 30, 20], b: [170, 80, 60], B: [200, 110, 80], d: [130, 60, 40] }, 2],
    snowball: [['................', '................', '................', '................', '......oooo......', '.....owwWwo.....', '....owwwWWwo....', '....owwwwwwo....', '....owwwwwgo....', '.....owwggo.....', '......oooo......'], { o: [180, 190, 200], w: [240, 250, 250], W: [255, 255, 255], g: [210, 220, 230] }, 2],
    egg: [['................', '................', '.......oo.......', '......owwo......', '.....owwWwo.....', '.....owwwWo.....', '....owwwwwwo....', '....owwwwwwo....', '....owwwwwgo....', '.....owwwgo.....', '......oooo......'], { o: [160, 140, 110], w: [236, 222, 196], W: [255, 250, 240], g: [210, 196, 170] }, 2],
    wooden_door: [['................', '....oooooooo....', '....obbbbbbo....', '....ob.bb.bo....', '....ob.bb.bo....', '....obbbbbbo....', '....ob.bb.bo....', '....obbbbbbo....', '....obbbbbbo....', '....obbbbbko....', '....obbbbbbo....', '....obbbbbbo....', '....obbbbbbo....', '....obbbbbbo....', '....oooooooo....'], { o: [80, 60, 30], b: [150, 118, 70], k: [50, 50, 50] }, 1],
    redstone: [['................', '................', '................', '................', '.......r........', '.....r.Rr.......', '....rRrrRr......', '...rRRrrRRr.....', '....rrRrrr......', '.....rrRr.r.....', '...r..rr........', '................'], { r: [150, 0, 0], R: [255, 30, 30] }, 1],
    fish_raw: [['................', '................', '................', '................', '..........o..oo.', '......oooobo.ob.', '....oobbbbbbobb.', '...obwkbbbbbbbo.', '...obbbbbbbbob..', '....oobbbbbbo.ob', '......ooooo...oo'], { o: [40, 70, 90], b: [110, 160, 190], w: [255, 255, 255], k: [0, 0, 0] }, 2],
    fish_cooked: [['................', '................', '................', '................', '..........o..oo.', '......oooobo.ob.', '....oobbbbbbobb.', '...obwkbbbbbbbo.', '...obbbbbbbbob..', '....oobbbbbbo.ob', '......ooooo...oo'], { o: [70, 40, 20], b: [190, 140, 90], w: [255, 255, 255], k: [0, 0, 0] }, 2],
    saddle: [['................', '................', '................', '....oooooooo....', '...obbbbbbbbo...', '..obbBBBBBBbbo..', '..obbbbbbbbbbo..', '..oooobbbbbooo..', '....oo.bb.oo....', '....mo....om....', '....mo....om....', '....oo....oo....'], { o: [60, 30, 10], b: [150, 88, 46], B: [182, 118, 70], m: [180, 180, 180] }, 1]
  };
  const ARMOR_ART = {
    helmet: ['................', '................', '................', '...oooooooooo...', '..ollllllllmdo..', '..olmmmmmmmmdo..', '..olmooooooodo..', '..omo......omo..', '..odo......odo..', '..ooo......ooo..'],
    chestplate: ['................', '..ooo......ooo..', '.olmdo....olmdo.', '.olmmdooooolmdo.', '.oolmmmmmmmmdoo.', '...olmmmmmmdo...', '...olmmmmmmdo...', '...olmmmmmmdo...', '...olmmmmmmdo...', '...olmmmmmmdo...', '...olmmmmmmdo...', '...oooooooooo...'],
    leggings: ['................', '...oooooooooo...', '...olmmmmmmdo...', '...olmmmmmmdo...', '...olmmoolmdo...', '...olmo..olmo...', '...olmo..olmo...', '...olmo..olmo...', '...olmo..olmo...', '...olmo..olmo...', '...oooo..oooo...'],
    boots: ['................', '................', '................', '................', '................', '...oooo..oooo...', '...olmo..olmo...', '...olmo..olmo...', '..oolmo..olmoo..', '..olmmo..olmmo..', '..oooooo.oooooo.']
  };

  Tex.ITEM_ART = ITEM_ART;
  Tex.MAT = MAT;
  // Item atlas slot assignment
  const ITEM_TILES = {};
  let nextItemTile = 0;
  function itemTile(name) { if (ITEM_TILES[name] === undefined) ITEM_TILES[name] = nextItemTile++; return ITEM_TILES[name]; }
  Tex.itemTile = name => ITEM_TILES[name];

  /* ---------------------------------------------------------------- */
  /* Atlas build                                                      */
  /* ---------------------------------------------------------------- */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  Tex.makeCanvas = makeCanvas;

  Tex.build = function () {
    // terrain
    const terrain = makeCanvas(256, 256);
    const tctx = terrain.getContext('2d');
    const img = tctx.createImageData(256, 256);
    Tex.tileData = {};
    for (let i = 0; i < S.TILE_NAMES.length; i++) {
      const name = S.TILE_NAMES[i];
      const t = new Tile(name);
      if (G[name]) G[name](t);
      const tx = (i & 15) * 16, ty = (i >> 4) * 16;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const s = (y * 16 + x) * 4, d = ((ty + y) * 256 + tx + x) * 4;
        img.data[d] = t.d[s]; img.data[d + 1] = t.d[s + 1]; img.data[d + 2] = t.d[s + 2]; img.data[d + 3] = t.d[s + 3];
      }
      Tex.tileData[name] = t.d;
    }
    // bake initial animation frames
    for (const a of Tex.anims) {
      const tx = (a.tile & 15) * 16, ty = (a.tile >> 4) * 16;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const s = (y * 16 + x) * 4, d = ((ty + y) * 256 + tx + x) * 4;
        for (let c = 0; c < 4; c++) img.data[d + c] = a.fx.data[s + c];
      }
    }
    tctx.putImageData(img, 0, 0);
    Tex.terrain = terrain;

    // items
    const items = makeCanvas(256, 256);
    const ictx = items.getContext('2d');
    const iimg = ictx.createImageData(256, 256);
    const put = (name, t) => {
      const idx = itemTile(name);
      const tx = (idx & 15) * 16, ty = (idx >> 4) * 16;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const s = (y * 16 + x) * 4, d = ((ty + y) * 256 + tx + x) * 4;
        for (let c = 0; c < 4; c++) iimg.data[d + c] = t.d[s + c];
      }
    };
    for (const mat of ['wood', 'stone', 'iron', 'gold', 'diamond'].concat(Tex.extraToolMats || [])) {
      for (const tool of ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']) {
        const t = new Tile(mat + tool); t.clear(); t.art(ART[tool], toolPal(mat)); put(mat + '_' + tool, t);
      }
    }
    for (const name in ITEM_ART) {
      const [rows, pal, oy] = ITEM_ART[name];
      const t = new Tile(name); t.clear(); t.art(rows, pal, 0, oy || 0); put(name, t);
    }
    for (const mat of ['leather', 'iron', 'gold', 'diamond']) {
      for (const piece in ARMOR_ART) {
        const t = new Tile(mat + piece); t.clear();
        const m = MAT[mat];
        t.art(ARMOR_ART[piece], { o: m.o, l: m.l, m: m.m, d: m.d }, 0, 2);
        put(mat + '_' + piece, t);
      }
    }
    ictx.putImageData(iimg, 0, 0);
    Tex.items = items;

    Tex.buildGui();
  };

  /* ---------------------------------------------------------------- */
  /* GUI graphics                                                     */
  /* ---------------------------------------------------------------- */
  function artCanvas(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const col = pal[rows[y][x]];
      if (!col) continue;
      const o = (y * w + x) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = col[3] === undefined ? 255 : col[3];
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  Tex.artCanvas = artCanvas;

  Tex.buildGui = function () {
    const heart = [
      '.kkk.kkk.',
      'kRRRkRRRk',
      'kRWRRRRRk',
      'kRRRRRRRk',
      '.kRRRRRk.',
      '..kRRRk..',
      '...kRk...',
      '....k....',
      '.........'
    ];
    const pal = (fillL, fillR, hi) => ({ k: [20, 20, 20], R: fillL, W: hi || fillL });
    const heartCanvas = (left, right, hi, outline) => {
      const rows = heart.map(r => r.split('').map((ch, x) => ch === 'R' || ch === 'W' ? (x < 4 ? (ch === 'W' ? 'W' : 'L') : (x === 4 ? 'L' : 'Q')) : ch).join(''));
      return artCanvas(rows, { k: outline || [20, 20, 20], L: left, Q: right, W: hi || left });
    };
    const EMPTY = [48, 20, 20], RED = [220, 20, 20], HI = [255, 170, 170];
    Tex.gui = {};
    Tex.gui.heartEmpty = heartCanvas(EMPTY, EMPTY, EMPTY);
    Tex.gui.heartEmptyFlash = heartCanvas(EMPTY, EMPTY, EMPTY, [255, 255, 255]);
    Tex.gui.heartFull = heartCanvas(RED, RED, HI);
    Tex.gui.heartHalf = heartCanvas(RED, EMPTY, HI);
    Tex.gui.heartFullFlash = heartCanvas([255, 120, 120], [255, 120, 120], [255, 230, 230], [255, 255, 255]);
    Tex.gui.heartHalfFlash = heartCanvas([255, 120, 120], EMPTY, [255, 230, 230], [255, 255, 255]);
    const armor = [
      '.kk...kk.',
      'kLLk.kLLk',
      'kLLLkLLLk',
      '.kLLLLLk.',
      '.kLLLLLk.',
      '.kLLLLLk.',
      '.kLLLLLk.',
      '..kkkkk..',
      '.........'
    ];
    const armorCanvas = (l, r) => artCanvas(armor.map(row => row.split('').map((ch, x) => ch === 'L' ? (x <= 4 ? 'A' : 'B') : ch).join('')), { k: [30, 30, 30], A: l, B: r });
    Tex.gui.armorFull = armorCanvas([220, 220, 220], [190, 190, 190]);
    Tex.gui.armorHalf = armorCanvas([220, 220, 220], [60, 60, 60]);
    Tex.gui.armorEmpty = armorCanvas([60, 60, 60], [60, 60, 60]);
    Tex.gui.bubble = artCanvas([
      '..kkkkk..',
      '.kBBBBBk.',
      'kBWWBBBBk',
      'kBWBBBBBk',
      'kBBBBBBBk',
      'kBBBBBBBk',
      '.kBBBBBk.',
      '..kkkkk..',
      '.........'
    ], { k: [20, 50, 160], B: [60, 130, 240], W: [230, 240, 255] });
    Tex.gui.bubblePop = artCanvas([
      '.........',
      '..k...k..',
      '...k.k...',
      '.k.....k.',
      '.........',
      '.k.....k.',
      '...k.k...',
      '..k...k..',
      '.........'
    ], { k: [60, 130, 240] });

    // Buttons 200x20: 0 disabled, 1 normal, 2 hover
    Tex.gui.buttons = [0, 1, 2].map(state => {
      const c = makeCanvas(200, 20), ctx = c.getContext('2d');
      const img = ctx.createImageData(200, 20);
      const r = new S.RNG(42 + state);
      const base = state === 0 ? [44, 44, 44] : state === 1 ? [111, 111, 111] : [126, 136, 191];
      for (let y = 0; y < 20; y++) for (let x = 0; x < 200; x++) {
        let col;
        if (y === 0 || y === 19 || x === 0 || x === 199) col = [0, 0, 0];
        else if (y === 1 || x === 1) col = state === 0 ? [80, 80, 80] : state === 2 ? [188, 198, 255] : [170, 170, 170];
        else if (y >= 17 || x >= 198) col = state === 0 ? [30, 30, 30] : state === 2 ? [90, 98, 150] : [74, 74, 74];
        else { const v = 0.9 + r.next() * 0.2; col = [base[0] * v, base[1] * v, base[2] * v]; }
        const o = (y * 200 + x) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    });

    // Hotbar 182x22 and selection 24x24
    {
      const c = makeCanvas(182, 22), ctx = c.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(1, 1, 180, 20);
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, 0, 182, 1); ctx.fillRect(0, 21, 182, 1); ctx.fillRect(0, 0, 1, 22); ctx.fillRect(181, 0, 1, 22);
      for (let i = 0; i < 9; i++) {
        const x = 1 + i * 20;
        ctx.fillStyle = '#8b8b8b'; ctx.fillRect(x, 1, 20, 1); ctx.fillRect(x, 1, 1, 20);
        ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x, 20, 20, 1); ctx.fillRect(x + 19, 1, 1, 20);
        ctx.fillStyle = 'rgba(100,100,100,0.45)'; ctx.fillRect(x + 1, 2, 18, 18);
      }
      Tex.gui.hotbar = c;
      const s = makeCanvas(24, 24), sc = s.getContext('2d');
      sc.fillStyle = '#000'; sc.fillRect(0, 0, 24, 24); sc.clearRect(3, 3, 18, 18);
      sc.fillStyle = '#ffffff'; sc.fillRect(1, 1, 22, 2); sc.fillRect(1, 1, 2, 22); sc.fillRect(1, 21, 22, 2); sc.fillRect(21, 1, 2, 22);
      sc.fillStyle = '#b8b8b8'; sc.fillRect(1, 21, 22, 1); sc.fillRect(21, 1, 1, 21);
      sc.clearRect(3, 3, 18, 18);
      Tex.gui.hotbarSel = s;
    }

    // Dirt background tile for menus (darkened)
    {
      const c = makeCanvas(16, 16), ctx = c.getContext('2d');
      const img = ctx.createImageData(16, 16);
      img.data.set(Tex.tileData.dirt);
      ctx.putImageData(img, 0, 0);
      Tex.gui.dirt = c;
    }
    // furnace progress sprites
    Tex.gui.flame = artCanvas([
      '......f.......',
      '.....ff.......',
      '.....ffo......',
      '....fffo..f...',
      '....ffoo..ff..',
      '...ffoyof.ff..',
      '..ffoyyofffo..',
      '..foyyyyooffo.',
      '.ffoyywyyooff.',
      '.foyywwwyyof..',
      '.foyywwwyyoff.',
      '..foyywyyoff..',
      '..ffooyooff...',
      '...fffffff....'
    ], { f: [200, 40, 0], o: [255, 120, 0], y: [255, 220, 40], w: [255, 255, 200] });
    Tex.gui.flameEmpty = artCanvas(Array.from({ length: 14 }, (_, y) => '..............'.split('').map((c, x) => (Math.abs(x - 6.5) < 5 - Math.abs(y - 8) * 0.4 && y > 1) ? 'g' : '.').join('')), { g: [120, 120, 120] });
    const arrowRows = [
      '..............aa........',
      '..............aaa.......',
      '..............aaaa......',
      '..............aaaaa.....',
      '..............aaaaaa....',
      '..............aaaaaaa...',
      'aaaaaaaaaaaaaaaaaaaaaa..',
      'aaaaaaaaaaaaaaaaaaaaaaa.',
      'aaaaaaaaaaaaaaaaaaaaaaa.',
      'aaaaaaaaaaaaaaaaaaaaaa..',
      '..............aaaaaaa...',
      '..............aaaaaa....',
      '..............aaaaa.....',
      '..............aaaa......',
      '..............aaa.......',
      '..............aa........'
    ];
    Tex.gui.arrow = artCanvas(arrowRows, { a: [139, 139, 139] });
    Tex.gui.arrowFull = artCanvas(arrowRows, { a: [255, 255, 255] });
  };

  /* ---------------------------------------------------------------- */
  /* Clouds + celestial                                                */
  /* ---------------------------------------------------------------- */
  Tex.buildClouds = function () {
    const W = 256;
    const data = new Uint8Array(W * W);
    const r = new S.RNG(2020);
    const p = new S.Octaves(r, 4);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      // tileable by sampling a torus
      const a = x / W * Math.PI * 2, b = y / W * Math.PI * 2;
      const v = p.sample(Math.cos(a) * 9, Math.sin(a) * 9 + Math.cos(b) * 9, Math.sin(b) * 9);
      data[y * W + x] = v * 3 > 0.35 ? 1 : 0;
    }
    return { size: W, data };
  };
})();
