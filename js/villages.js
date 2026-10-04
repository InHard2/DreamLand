/*
 * DreamLand - big villages.
 * A village grows from a plaza (fountain or well, bell, benches, market stalls)
 * along a network of streets that follow the land and bridge rivers. Its lots
 * hold houses of three sizes, farms, animal pens, a stable, a smithy, a library,
 * a church with a bell tower, a tavern, a town hall, gardens and watchtowers,
 * built in the style of the biome (plains, taiga, snowy, desert, savanna,
 * cherry grove, birch / meadow). Some villages are walled towns.
 * Also the new blocks they use: lanterns, bells, barrels, red and blue wool and
 * more stairs.
 */
(function () {
  'use strict';
  const DL = window.DL;
  const S = DL.S, B = S.B, Tex = DL.Tex, G = Tex.G, I = DL.Items, St = DL.Structures, A = DL.Audio, E = DL.Entities;
  const GP = DL.Game.prototype, W = DL.World.prototype;
  const SEA = S.SEA, BI = S.BIOME;
  const K = Tex.kit;
  const { hex, P, mix, mul, pick, surface, planks, bevel } = K;

  /* ------------------------------------------------------------ */
  /* Textures                                                     */
  /* ------------------------------------------------------------ */
  const IRON = P('#26282c #3a3d42 #50545a #6a6f76 #8a9098');
  G.lantern = t => {
    t.clear();
    // chain (used when hanging)
    for (let y = 0; y < 5; y++) { t.set(7, y, IRON[y % 2 ? 1 : 3]); t.set(8, y, IRON[y % 2 ? 3 : 1]); }
    // handle and cap
    t.rect(7, 5, 8, 6, IRON[0]);
    t.rect(6, 7, 9, 8, IRON[2]); t.set(6, 7, IRON[3]); t.set(9, 8, IRON[1]);
    // glass body with a flame inside
    const GLOW = P('#c86a10 #f09a24 #ffc040 #ffe07a #fff6c8');
    for (let y = 9; y < 16; y++) for (let x = 5; x < 11; x++) {
      const edge = x === 5 || x === 10 || y === 9 || y === 15;
      if (edge) { t.set(x, y, IRON[(x + y) % 2 ? 1 : 2]); continue; }
      const d = Math.hypot(x - 7.5, (y - 12) * 0.8);
      t.set(x, y, pick(GLOW, Math.max(0, 1 - d / 3.2 + (t.rand() - 0.5) * 0.15)));
    }
  };
  G.lantern_top = t => {
    t.clear();
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) t.set(x, y, x === 5 || x === 10 || y === 5 || y === 10 ? IRON[1] : IRON[3]);
    t.rect(6, 6, 9, 9, IRON[2]); t.rect(7, 7, 8, 8, IRON[0]);
  };
  const GOLD = P('#7a5208 #a8780e #d4a21e #f2c63c #ffe68a #fff8d0');
  G.bell = t => {
    t.clear();
    // hanger
    for (let y = 0; y < 3; y++) { t.set(7, y, IRON[2]); t.set(8, y, IRON[1]); }
    // crown, body and lip, lit from the left
    const shade = (x, x0, x1, k) => pick(GOLD, Math.max(0, Math.min(0.99, 0.95 - (x - x0) / (x1 - x0 + 1) * 0.75 + k)));
    for (let y = 3; y < 5; y++) for (let x = 6; x < 10; x++) t.set(x, y, shade(x, 6, 9, -0.05));
    for (let y = 5; y < 12; y++) for (let x = 5; x < 11; x++) t.set(x, y, shade(x, 5, 10, (t.rand() - 0.5) * 0.08 - (y === 11 ? 0.15 : 0)));
    for (let y = 12; y < 14; y++) for (let x = 4; x < 12; x++) t.set(x, y, shade(x, 4, 11, y === 13 ? -0.2 : 0.05));
    for (let x = 5; x < 11; x++) t.set(x, 8, GOLD[1]);
  };
  G.bell_top = t => {
    t.clear();
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) { const d = Math.hypot(x - 7.5, y - 7.5); t.set(x, y, pick(GOLD, Math.max(0, 0.9 - d / 7))); }
    t.rect(7, 7, 8, 8, IRON[1]);
  };
  const BARREL = { dark: hex('#4a3016'), mid: hex('#6e4a24'), light: hex('#8a6032'), gap: hex('#33200c') };
  G.barrel_side = t => {
    for (let x = 0; x < 16; x++) {
      const stave = Math.floor(x / 4), edge = x % 4 === 0;
      for (let y = 0; y < 16; y++) {
        const r = t.rand();
        let c = edge ? BARREL.gap : r < 0.15 ? BARREL.dark : r < 0.8 ? BARREL.mid : BARREL.light;
        if (stave % 2 && !edge) c = mul(c, 0.94);
        t.set(x, y, c);
      }
    }
    for (const y of [2, 13]) for (let x = 0; x < 16; x++) { t.set(x, y, IRON[1]); t.set(x, y + 1, IRON[x % 4 === 1 ? 3 : 2]); }
  };
  G.barrel_top = t => {
    planks(t, { dark: BARREL.dark, mid: BARREL.mid, light: BARREL.light, gap: BARREL.gap, seams: [[], [], [], []] });
    for (let k = 0; k < 16; k++) { t.set(k, 0, IRON[2]); t.set(0, k, IRON[2]); t.set(k, 15, IRON[1]); t.set(15, k, IRON[1]); }
    for (let k = 1; k < 15; k++) { t.set(k, 1, BARREL.dark); t.set(1, k, BARREL.dark); t.set(k, 14, BARREL.dark); t.set(14, k, BARREL.dark); }
    t.rect(6, 6, 9, 9, BARREL.gap); t.rect(7, 7, 8, 8, hex('#1c1006'));
  };
  G.barrel_bottom = t => {
    planks(t, { dark: BARREL.dark, mid: BARREL.mid, light: BARREL.light, gap: BARREL.gap, seams: [[], [], [], []] });
    bevel(t, IRON[2], IRON[1], 0);
  };
  const tintWool = (t, pal) => {
    G.wool(t);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = t.get(x, y); t.set(x, y, pick(pal, Math.max(0, (c[0] - 190) / 70))); }
  };
  G.red_wool = t => tintWool(t, P('#7e1a16 #96221c #a82a22 #b8322a #c83c32'));
  G.blue_wool = t => tintWool(t, P('#20286e #283282 #303c96 #3a48a8 #4656ba'));

  /* ------------------------------------------------------------ */
  /* Recipes, barrels and bells                                   */
  /* ------------------------------------------------------------ */
  if (I._shaped) {
    I._shaped(['P  ', 'PP ', 'PPP'], { P: 'spruce_planks' }, 'spruce_stairs', 4);
    I._shaped(['P  ', 'PP ', 'PPP'], { P: 'dark_planks' }, 'dark_stairs', 4);
    I._shaped(['P  ', 'PP ', 'PPP'], { P: 'bricks' }, 'brick_stairs', 4);
    I._shaped(['III', 'ITI', 'III'], { I: 'iron_ingot', T: 'torch' }, 'lantern');
    I._shaped(['PSP', 'P P', 'PSP'], { P: 'planks', S: 'slab' }, 'barrel');
    I._shaped(['GGG', 'GIG', 'G G'], { G: 'gold_ingot', I: 'iron_ingot' }, 'bell');
    I._shapeless(['wool', 'rose'], 'red_wool');
    I._shapeless(['wool', 'cornflower'], 'blue_wool');
  }
  // a barrel is a chest you can stand things on
  const replaced = W.onBlockReplaced;
  W.onBlockReplaced = function (c, i, x, y, z, old, oldMeta, id) {
    replaced.apply(this, arguments);
    if (id === B.barrel && !this.getTile(x, y, z)) this.setTile(x, y, z, { type: 'chest', items: new Array(27).fill(null) });
  };
  A.DESIGNS.bell = (v) => {
    const { gen, env } = A.dsp;
    const f = 620 + v * 40, parts = [[1, 1], [2.02, 0.55], [2.76, 0.42], [4.07, 0.3], [5.4, 0.18], [0.5, 0.35]];
    return gen(2.6, t => { let s = 0; for (const [m, a] of parts) s += Math.sin(t * 2 * Math.PI * f * m) * a * Math.exp(-t * (0.9 + m * 0.5)); return s * env(t, 0.002, 3); });
  };
  A.VARIANTS.bell = 2;
  const useItem = GP.useItem;
  GP.useItem = function () {
    const p = this.player, t = this.target, w = this.world;
    const edge = this.usePressed || this._pgUseEdge;
    if (t && !t.entity && w && edge && (!p.sneaking || !p.held)) {
      const id = w.getBlock(t.x, t.y, t.z);
      if (id === B.barrel) {
        let te = w.getTile(t.x, t.y, t.z);
        if (!te && !w.remote) { te = { type: 'chest', items: new Array(27).fill(null) }; w.setTile(t.x, t.y, t.z, te); }
        if (te) { A.play('chest', t.x + 0.5, t.y + 0.5, t.z + 0.5, 0.5, 0.8); this.setScreen(new DL.GUI.ChestScreen(this, te)); return; }
      }
      if (id === B.bell) {
        A.play('bell', t.x + 0.5, t.y + 0.5, t.z + 0.5, 3, 1);
        p.swing();
        // like Minecraft's bell: monsters nearby glow so you can find them
        const until = performance.now() + 10000;
        for (const e of w.entities) if (e.living && !e.removed && e.def && e.def.hostile && e.dist2(t.x, t.y, t.z) < 48 * 48) e.glowUntil = until;
        return;
      }
    }
    return useItem.apply(this, arguments);
  };

  const RP = DL.Renderer.prototype, drawModel = RP.drawModel;
  RP.drawModel = function (type, e, pt, model, light, opts) {
    if (e && e.glowUntil && e.glowUntil > performance.now()) { light = [15, 15]; opts = Object.assign({}, opts || {}, { tint: [1, 1, 0.7, 0.35] }); }
    return drawModel.call(this, type, e, pt, model, light, opts);
  };

  /* ------------------------------------------------------------ */
  /* A building's own frame                                       */
  /* ------------------------------------------------------------ */
  // world directions: 0 north (-z), 1 south (+z), 2 west (-x), 3 east (+x)
  const DV = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const OPP = [1, 0, 3, 2];
  const dirOf = (x, z) => (x === 0 ? (z < 0 ? 0 : 1) : (x < 0 ? 2 : 3));
  /**
   * Local space of a building: lx runs across the front from left to right, lz runs from the front
   * (the street) to the back, ly up from the floor. Local directions: 0 front, 1 back, 2 left, 3 right.
   */
  class Frame {
    constructor(pl, rect, face, y) {
      this.pl = pl; this.face = face; this.y = y;
      const V = DV[OPP[face]], U = [V[1], -V[0]];
      this.U = U; this.V = V;
      const [x0, z0, x1, z1] = rect;
      this.ox = U[0] > 0 || V[0] > 0 ? x0 : x1;
      this.oz = U[1] > 0 || V[1] > 0 ? z0 : z1;
      this.w = face < 2 ? x1 - x0 + 1 : z1 - z0 + 1;
      this.d = face < 2 ? z1 - z0 + 1 : x1 - x0 + 1;
    }
    wx(lx, lz) { return this.ox + lx * this.U[0] + lz * this.V[0]; }
    wz(lx, lz) { return this.oz + lx * this.U[1] + lz * this.V[1]; }
    dir(ld) { const v = DV[ld]; return dirOf(v[0] * this.U[0] + v[1] * this.V[0], v[0] * this.U[1] + v[1] * this.V[1]); }
    set(lx, ly, lz, id, meta, mode) { this.pl.set(this.wx(lx, lz), this.y + ly, this.wz(lx, lz), id, meta, mode); }
    fill(lx0, ly0, lz0, lx1, ly1, lz1, id, meta, mode) {
      for (let ly = Math.min(ly0, ly1); ly <= Math.max(ly0, ly1); ly++) for (let lx = Math.min(lx0, lx1); lx <= Math.max(lx0, lx1); lx++)
        for (let lz = Math.min(lz0, lz1); lz <= Math.max(lz0, lz1); lz++) this.set(lx, ly, lz, typeof id === 'function' ? id(lx, ly, lz) : id, meta, mode);
    }
    stairs(lx, ly, lz, id, ld) { this.set(lx, ly, lz, id, this.dir(ld)); }
    torch(lx, ly, lz, ld) { this.set(lx, ly, lz, B.torch, 1 + this.dir(ld)); }
    ladder(lx, ly, lz, ld) { this.set(lx, ly, lz, B.ladder, this.dir(ld)); }
    facing(lx, ly, lz, id, ld) { this.set(lx, ly, lz, id, this.dir(ld)); }
    door(lx, ly, lz, ld) { const m = this.dir(ld === undefined ? 0 : ld); this.set(lx, ly, lz, B.wooden_door, m); this.set(lx, ly + 1, lz, B.wooden_door, m | 8); }
    chest(lx, ly, lz, table, rolls, r, ld, block, extra) {
      const x = this.wx(lx, lz), z = this.wz(lx, lz), y = this.y + ly;
      this.pl.chest(x, y, z, table, rolls, r, extra);
      this.pl.set(x, y, z, block || B.chest, block === B.barrel ? 0 : this.dir(ld === undefined ? 0 : ld));
    }
    mob(type, lx, ly, lz, extra) { this.pl.mob(type, this.wx(lx, lz) + 0.5, this.y + ly, this.wz(lx, lz) + 0.5, extra); }
    centre() { return [this.wx((this.w - 1) / 2, (this.d - 1) / 2), this.y, this.wz((this.w - 1) / 2, (this.d - 1) / 2)]; }
  }
  St.Frame = Frame;

  /* ------------------------------------------------------------ */
  /* Village styles                                               */
  /* ------------------------------------------------------------ */
  const STYLES = {
    plains: { wall: B.planks, beam: B.log, base: B.cobblestone, floor: B.planks, stairs: B.wood_stairs, roofFull: B.planks, path: B.dirt_path, plaza: B.cobblestone, roof: 'gable', fence: B.fence, accent: B.wool, flowers: [B.dandelion, B.rose, B.cornflower, B.orange_tulip] },
    taiga: { wall: B.spruce_planks, beam: B.spruce_log, base: B.cobblestone, floor: B.spruce_planks, stairs: B.spruce_stairs, roofFull: B.spruce_planks, path: B.dirt_path, plaza: B.mossy_cobblestone, roof: 'gable', steep: true, fence: B.fence, accent: B.spruce_log, flowers: [B.fern, B.brown_mushroom, B.dandelion] },
    snowy: { wall: B.spruce_planks, beam: B.spruce_log, base: B.stone_bricks, floor: B.spruce_planks, stairs: B.spruce_stairs, roofFull: B.spruce_planks, path: B.dirt_path, plaza: B.stone_bricks, roof: 'gable', steep: true, snow: true, fence: B.fence, accent: B.packed_ice, flowers: [B.fern] },
    desert: { wall: B.sandstone, beam: B.chiseled_sandstone, base: B.sandstone, floor: B.sandstone, stairs: B.sandstone_stairs, roofFull: B.sandstone, path: B.sandstone, plaza: B.chiseled_sandstone, roof: 'flat', fence: B.fence, accent: B.orange_terracotta, trim: B.yellow_terracotta, flowers: [B.dead_bush, B.cactus] },
    savanna: { wall: B.acacia_planks, beam: B.acacia_log, base: B.cobblestone, floor: B.acacia_planks, stairs: B.wood_stairs, roofFull: B.acacia_planks, path: B.dirt_path, plaza: B.red_terracotta, roof: 'flat', fence: B.fence, accent: B.orange_terracotta, trim: B.white_terracotta, flowers: [B.dandelion, B.orange_tulip, B.allium] },
    cherry: { wall: B.cherry_planks, beam: B.cherry_log, base: B.stone_bricks, floor: B.cherry_planks, stairs: B.dark_stairs, roofFull: B.dark_planks, path: B.dirt_path, plaza: B.stone_bricks, roof: 'gable', fence: B.fence, accent: B.white_terracotta, flowers: [B.pink_tulip, B.pink_petals, B.allium, B.lily_of_the_valley] },
    birch: { wall: B.birch_planks, beam: B.birch_log, base: B.cobblestone, floor: B.birch_planks, stairs: B.dark_stairs, roofFull: B.dark_planks, path: B.dirt_path, plaza: B.stone_bricks, roof: 'gable', fence: B.fence, accent: B.white_terracotta, flowers: [B.allium, B.cornflower, B.lily_of_the_valley, B.dandelion] }
  };
  function styleFor(b) {
    switch (b) {
      case BI.DESERT: return STYLES.desert;
      case BI.SAVANNA: case BI.SAVANNA_PLATEAU: return STYLES.savanna;
      case BI.TAIGA: case BI.OLD_GROWTH_TAIGA: return STYLES.taiga;
      case BI.TUNDRA: case BI.SNOWY_TAIGA: case BI.SNOWY_SLOPES: return STYLES.snowy;
      case BI.CHERRY_GROVE: return STYLES.cherry;
      case BI.MEADOW: case BI.BIRCH_FOREST: case BI.FLOWER_FOREST: return STYLES.birch;
      case BI.PLAINS: case BI.SUNFLOWER_PLAINS: case BI.SEASONAL: case BI.FOREST: return STYLES.plains;
    }
    return null;
  }

  /* ------------------------------------------------------------ */
  /* Building parts                                               */
  /* ------------------------------------------------------------ */
  // levelled ground, a foundation, a floor and room to build
  function groundwork(F, st, w, d, up) {
    F.fill(0, -9, 0, w - 1, -2, d - 1, st.base, 0, 1);
    F.fill(0, -1, 0, w - 1, -1, d - 1, st.floor);
    F.fill(0, 0, 0, w - 1, up, d - 1, 0);
  }
  // walls with log corners, a stone footing and windows
  function shell(F, st, w, d, H, o) {
    o = o || {};
    for (let ly = 0; ly < H; ly++) for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) {
      if (lx > 0 && lx < w - 1 && lz > 0 && lz < d - 1) continue;
      const corner = (lx === 0 || lx === w - 1) && (lz === 0 || lz === d - 1);
      F.set(lx, ly, lz, corner ? st.beam : ly === 0 && st.base !== st.wall && !o.noFooting ? st.base : st.wall);
    }
    if (o.band) for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) if ((lx === 0 || lx === w - 1 || lz === 0 || lz === d - 1)) F.set(lx, o.band, lz, st.beam === B.chiseled_sandstone ? st.trim || st.beam : st.beam);
    // windows, two high on tall walls
    const rows = o.windowRows || [1];
    for (const wy of rows) {
      for (let lx = 2; lx < w - 2; lx += 2) { if (!(o.door !== undefined && Math.abs(lx - o.door) < 2)) F.set(lx, wy, 0, B.glass); F.set(lx, wy, d - 1, B.glass); }
      for (let lz = 2; lz < d - 2; lz += 2) { F.set(0, wy, lz, B.glass); F.set(w - 1, wy, lz, B.glass); }
    }
  }
  // a pitched roof of stairs with the gables filled in; the ridge runs along the longer side
  function gableRoof(F, st, w, d, H) {
    const along = d > w; // ridge front-to-back: the slopes face left and right
    const A = along ? w : d, L = along ? d : w;
    // (a, b): a across the slope, b along the ridge
    const at = (a, b) => (along ? [a, b] : [b, a]);
    const put = (a, ly, b, id, meta, mode) => { const [lx, lz] = at(a, b); F.set(lx, ly, lz, id, meta, mode); };
    const up = along ? [3, 2] : [1, 0]; // which way the high side of each slope points
    let k = 0;
    for (; ; k++) {
      const fa = -1 + k, ba = A - k, ly = H + k;
      if (fa > ba) break;
      if (fa === ba) { for (let b = -1; b <= L; b++) { put(fa, ly, b, st.roofFull); if (st.snow) put(fa, ly + 1, b, B.snow_layer, 0, 3); } break; }
      for (let b = -1; b <= L; b++) {
        let [lx, lz] = at(fa, b); F.stairs(lx, ly, lz, st.stairs, up[0]);
        [lx, lz] = at(ba, b); F.stairs(lx, ly, lz, st.stairs, up[1]);
        if (st.snow) { put(fa, ly + 1, b, B.snow_layer, 0, 3); put(ba, ly + 1, b, B.snow_layer, 0, 3); }
      }
      // the gable ends and the attic air (the first row also closes the top of the long walls)
      for (let a = fa + 1; a < ba; a++) {
        put(a, ly, 0, st.wall); put(a, ly, L - 1, st.wall);
        for (let b = 1; b < L - 1; b++) put(a, ly, b, k === 0 && (a === 0 || a === A - 1) ? st.wall : 0);
      }
      if (fa + 1 === ba) { for (let b = -1; b <= L; b++) { put(fa, ly + 1, b, st.roofFull); put(ba, ly + 1, b, st.roofFull); } k++; break; }
    }
    // a little window in each gable
    const gy = H + Math.max(1, Math.floor((A + 2) / 4));
    if (gy < H + k - 1) { put(A >> 1, gy, 0, B.glass); put(A >> 1, gy, L - 1, B.glass); }
    return H + k + 1;
  }
  // flat roof with a trim, a parapet and sometimes a terrace
  function flatRoof(F, st, w, d, H, r) {
    F.fill(0, H, 0, w - 1, H, d - 1, st.roofFull);
    for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) {
      if (lx > 0 && lx < w - 1 && lz > 0 && lz < d - 1) continue;
      F.set(lx, H, lz, st.trim || st.accent);
      if ((lx + lz) % 2 === 0) F.set(lx, H + 1, lz, st.wall);
    }
    if (r.next() < 0.4) { F.set(1, H + 1, 1, st.fence); F.set(1, H + 2, 1, B.lantern); }
    return H + 2;
  }
  function roof(F, st, w, d, H, r) { return st.roof === 'flat' ? flatRoof(F, st, w, d, H, r) : gableRoof(F, st, w, d, H); }
  // the step outside the door and a flower box
  function frontYard(F, st, w, door, r) {
    F.set(door, -1, -1, st.path);
    F.set(door, 0, -1, 0); F.set(door, 1, -1, 0);
    if (r.next() < 0.6) { const fx = door > 1 ? door - 2 : door + 2; if (fx > 0 && fx < w - 1) F.set(fx, 0, -1, st.flowers[r.nextInt(st.flowers.length)], 0, 3); }
  }
  // a table with two chairs (which you can sit on)
  function diningSet(F, st, lx, lz) {
    F.set(lx, 0, lz, st.fence); F.set(lx, 1, lz, B.lantern);
    F.stairs(lx - 1, 0, lz, st.stairs, 2); F.stairs(lx + 1, 0, lz, st.stairs, 3);
  }

  /* ------------------------------------------------------------ */
  /* Buildings: each builds itself in its frame, returns its people */
  /* ------------------------------------------------------------ */
  const KINDS = {
    small: { size: (r) => [5, 5 + r.nextInt(2)], weight: 22, build: smallHouse },
    medium: { size: (r) => [7, 7 + r.nextInt(2) * 2], weight: 16, build: mediumHouse },
    large: { size: () => [9, 9], weight: 7, build: largeHouse },
    farm: { size: (r) => [9 + r.nextInt(2) * 2, 7 + r.nextInt(2) * 2], weight: 14, build: farm },
    pen: { size: () => [9, 9], weight: 6, build: animalPen },
    garden: { size: () => [7, 7], weight: 5, build: garden },
    smithy: { size: () => [9, 7], weight: 4, max: 2, build: smithy },
    butcher: { size: () => [7, 7], weight: 3, max: 1, build: butcher },
    library: { size: () => [9, 9], weight: 3, max: 1, build: library },
    church: { size: () => [7, 13], weight: 3, max: 1, build: church },
    tavern: { size: () => [11, 9], weight: 3, max: 1, build: tavern },
    stable: { size: () => [11, 9], weight: 3, max: 1, build: stable },
    tower: { size: () => [5, 5], weight: 3, max: 3, build: watchtower },
    hall: { size: () => [13, 11], weight: 0, build: townHall }
  };
  const villager = (F, lx, ly, lz, v, r) => F.mob('villager', lx, ly, lz, { v: v === undefined ? r.nextInt(5) : v, home: F.centre() });

  function smallHouse(F, st, r) {
    const w = F.w, d = F.d, door = w >> 1, H = st.roof === 'flat' ? 4 : 3;
    groundwork(F, st, w, d, H + 6);
    shell(F, st, w, d, H, { door });
    F.door(door, 0, 0);
    roof(F, st, w, d, H, r);
    F.torch(1, 2, d - 2, 1);
    const pick3 = r.nextInt(3);
    if (pick3 === 0) F.set(w - 2, 0, d - 2, B.crafting_table);
    else if (pick3 === 1) F.facing(w - 2, 0, d - 2, B.furnace, 0);
    else F.chest(w - 2, 0, d - 2, 'village', [2, 5], r, 0, B.barrel);
    if (r.next() < 0.5) F.chest(1, 0, d - 2, 'village', [2, 4], r, 3);
    frontYard(F, st, w, door, r);
    villager(F, door, 0, 2, undefined, r);
  }
  function mediumHouse(F, st, r) {
    const w = F.w, d = F.d, door = w >> 1, H = 4;
    groundwork(F, st, w, d, H + 7);
    shell(F, st, w, d, H, { door });
    F.door(door, 0, 0);
    roof(F, st, w, d, H, r);
    // kitchen in one back corner, a table in the middle, a bookshelf
    F.facing(1, 0, d - 2, B.furnace, 0); F.set(2, 0, d - 2, B.crafting_table); F.chest(3, 0, d - 2, 'village', [2, 5], r, 0, B.barrel);
    diningSet(F, st, w - 3, d >> 1);
    F.set(w - 2, 0, d - 2, B.bookshelf); F.set(w - 2, 1, d - 2, B.bookshelf);
    F.torch(1, 2, 1, 2); F.torch(w - 2, 2, 1, 3);
    // a window box under the front windows
    for (let lx = 2; lx < w - 2; lx += 2) if (Math.abs(lx - door) >= 2) F.set(lx, 0, -1, st.flowers[r.nextInt(st.flowers.length)], 0, 3);
    frontYard(F, st, w, door, r);
    villager(F, door, 0, 2, undefined, r);
    if (r.next() < 0.5) villager(F, door, 0, d - 3, undefined, r);
  }
  function largeHouse(F, st, r) {
    const w = F.w, d = F.d, door = w >> 1, H = 8;
    groundwork(F, st, w, d, H + 8);
    shell(F, st, w, d, H, { door, windowRows: [1, 5], band: 4 });
    F.door(door, 0, 0);
    // upper floor and a ladder
    F.fill(1, 4, 1, w - 2, 4, d - 2, st.floor);
    for (let ly = 0; ly <= 4; ly++) F.ladder(1, ly, d - 2, 1);
    F.set(1, 4, d - 2, 0);
    roof(F, st, w, d, H, r);
    // ground floor: kitchen and dining
    F.facing(w - 2, 0, d - 2, B.furnace, 0); F.facing(w - 3, 0, d - 2, B.furnace, 0); F.chest(w - 4, 0, d - 2, 'village', [3, 6], r, 0, B.barrel);
    diningSet(F, st, w >> 1, (d >> 1) + 1);
    F.torch(1, 2, 1, 2); F.torch(w - 2, 2, 1, 3);
    // upstairs: bedrooms (wool beds), bookshelves, a chest
    F.set(w - 2, 5, 1, B.red_wool); F.set(w - 2, 5, 2, B.wool); F.set(w - 3, 5, 1, B.blue_wool); F.set(w - 3, 5, 2, B.wool);
    F.set(2, 5, 1, B.bookshelf); F.set(3, 5, 1, B.bookshelf); F.chest(w - 2, 5, d - 2, 'village', [3, 6], r, 0);
    F.torch(w >> 1, 6, d - 2, 1);
    // a balcony over the door
    for (let lx = door - 1; lx <= door + 1; lx++) for (const lz of [-1, -2]) F.set(lx, 4, lz, st.floor);
    for (let lx = door - 2; lx <= door + 2; lx++) F.set(lx, 5, -3, st.fence);
    for (const lx of [door - 2, door + 2]) for (const lz of [-1, -2]) F.set(lx, 5, lz, st.fence);
    for (let lx = door - 2; lx <= door + 2; lx++) F.set(lx, 4, -3, st.floor);
    for (const lx of [door - 2, door + 2]) for (const lz of [-1, -2]) F.set(lx, 4, lz, st.floor);
    F.set(door, 5, 0, 0); F.set(door, 6, 0, 0);
    frontYard(F, st, w, door, r);
    villager(F, door, 0, 2, undefined, r); villager(F, door + 1, 5, 3, undefined, r);
  }
  function farm(F, st, r) {
    const w = F.w, d = F.d;
    F.fill(0, -1, 0, w - 1, -1, d - 1, B.dirt);
    F.fill(0, -6, 0, w - 1, -2, d - 1, B.dirt, 0, 1);
    F.fill(0, 0, 0, w - 1, 4, d - 1, 0);
    const mid = w >> 1;
    for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) {
      const border = lx === 0 || lx === w - 1 || lz === 0 || lz === d - 1;
      if (border) { F.set(lx, -1, lz, st.beam); continue; }
      if (lx === mid) { F.set(lx, -1, lz, B.water); continue; }
      F.set(lx, -1, lz, B.farmland, 7);
      F.set(lx, 0, lz, B.wheat, r.next() < 0.2 ? 7 : 2 + r.nextInt(6));
    }
    // pumpkins in a corner and a scarecrow
    if (r.next() < 0.5) { F.set(1, -1, d - 2, B.grass); F.set(1, 0, d - 2, B.pumpkin, r.nextInt(4)); }
    const sx = w - 2, sz = d - 2;
    F.set(sx, -1, sz, B.grass); F.set(sx, 0, sz, st.fence); F.set(sx, 1, sz, B.hay_bale); F.set(sx, 2, sz, B.pumpkin, F.dir(0));
    F.set(0, 0, 0, st.fence); F.set(0, 1, 0, B.lantern);
    villager(F, mid - 1, 0, -1, 0, r);
  }
  function animalPen(F, st, r) {
    const w = F.w, d = F.d, gate = w >> 1;
    F.fill(0, -1, 0, w - 1, -1, d - 1, B.grass);
    F.fill(0, -6, 0, w - 1, -2, d - 1, B.dirt, 0, 1);
    F.fill(0, 0, 0, w - 1, 4, d - 1, 0);
    for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) if ((lx === 0 || lx === w - 1 || lz === 0 || lz === d - 1) && !(lz === 0 && lx === gate)) F.set(lx, 0, lz, st.fence);
    // the gate: a gap you can close with a fence
    F.set(gate - 1, 1, 0, B.lantern); F.set(gate + 1, 1, 0, B.lantern);
    F.set(1, 0, d - 2, B.hay_bale); F.set(2, 0, d - 2, B.hay_bale); F.set(1, 1, d - 2, B.hay_bale);
    F.set(w - 2, 0, d - 2, B.cauldron);
    const kind = ['cow', 'sheep', 'pig', 'chicken'][r.nextInt(4)];
    const n = kind === 'chicken' ? 5 : 3 + r.nextInt(2);
    for (let i = 0; i < n; i++) F.mob(kind, 2 + r.nextInt(w - 4), 0, 2 + r.nextInt(d - 4));
    if (r.next() < 0.5) F.mob(kind === 'cow' ? 'sheep' : 'cow', w - 3, 0, 3);
  }
  function garden(F, st, r) {
    const w = F.w, d = F.d;
    F.fill(0, -1, 0, w - 1, -1, d - 1, B.grass);
    F.fill(0, -6, 0, w - 1, -2, d - 1, B.dirt, 0, 1);
    F.fill(0, 0, 0, w - 1, 6, d - 1, 0);
    // a path cross, flower beds, a tree, benches and lanterns
    for (let k = 0; k < w; k++) F.set(k, -1, d >> 1, st.path);
    for (let k = 0; k < d; k++) F.set(w >> 1, -1, k, st.path);
    for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) if (lx !== w >> 1 && lz !== d >> 1 && r.next() < 0.55) F.set(lx, 0, lz, st.flowers[r.nextInt(st.flowers.length)]);
    const tx = 1, tz = d - 2;
    for (let ly = 0; ly < 4; ly++) F.set(tx, ly, tz, st.beam);
    for (let lx = -1; lx <= 3; lx++) for (let lz = tz - 2; lz <= tz + 1; lz++) for (let ly = 3; ly <= 5; ly++) if (Math.abs(lx - tx) + Math.abs(lz - tz) + (ly - 3) < 4 && !(lx === tx && lz === tz && ly < 4)) F.set(lx, ly, lz, st === STYLES.cherry ? B.cherry_leaves : st === STYLES.birch ? B.birch_leaves : B.leaves, 0, 3);
    F.stairs((w >> 1) - 1, 0, (d >> 1) - 1, st.stairs, 1); F.stairs((w >> 1) + 1, 0, (d >> 1) + 1, st.stairs, 0);
    F.set(w - 1, 0, 0, st.fence); F.set(w - 1, 1, 0, B.lantern);
  }
  function smithy(F, st, r) {
    const w = F.w, d = F.d, H = 4;
    const stone = { ...st, wall: B.cobblestone, base: B.cobblestone, floor: B.stone_bricks };
    groundwork(F, stone, w, d, H + 6);
    // open front with posts; stone back and sides
    for (let ly = 0; ly < H; ly++) for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) {
      if (lx > 0 && lx < w - 1 && lz > 0 && lz < d - 1) continue;
      if (lz === 0 && lx > 0 && lx < w - 1) continue;
      F.set(lx, ly, lz, (lx === 0 || lx === w - 1) && (lz === 0 || lz === d - 1) ? B.stone_bricks : B.cobblestone);
    }
    for (let lx = 1; lx < w - 1; lx++) F.set(lx, H - 1, 0, st.beam);
    F.set(w >> 1, H - 2, 0, B.lantern, 1);
    roof(F, st, w, d, H, r);
    // forge: lava pit behind iron bars, furnaces, anvil, a chest
    F.set(1, -1, d - 2, B.lava); F.set(2, -1, d - 2, B.lava); F.set(1, 0, d - 2, B.iron_bars); F.set(2, 0, d - 2, B.iron_bars);
    F.facing(3, 0, d - 2, B.furnace, 0); F.facing(4, 0, d - 2, B.furnace, 0); F.facing(4, 1, d - 2, B.furnace, 0);
    F.set(w - 3, 0, 2, B.iron_block); F.set(w - 2, 0, d - 2, B.cauldron);
    F.chest(w - 2, 0, 1, 'smith', [3, 7], r, 2);
    villager(F, w >> 1, 0, 2, 3, r);
  }
  function butcher(F, st, r) {
    const w = F.w, d = F.d, door = w >> 1, H = 4;
    groundwork(F, st, w, d, H + 7);
    shell(F, st, w, d, H, { door });
    F.door(door, 0, 0);
    roof(F, st, w, d, H, r);
    F.facing(1, 0, d - 2, B.furnace, 0); F.set(2, 0, d - 2, B.hay_bale); F.set(w - 2, 0, d - 2, B.hay_bale); F.set(w - 2, 1, d - 2, B.hay_bale);
    F.chest(1, 0, 1, 'village', [2, 4], r, 3, B.barrel);
    F.torch(w - 2, 2, 1, 3);
    frontYard(F, st, w, door, r);
    villager(F, door, 0, 2, 4, r);
  }
  function library(F, st, r) {
    const w = F.w, d = F.d, door = w >> 1, H = 8;
    groundwork(F, st, w, d, H + 8);
    shell(F, st, w, d, H, { door, windowRows: [2, 6], band: 4 });
    F.door(door, 0, 0);
    F.fill(1, 4, 1, w - 2, 4, d - 2, st.floor);
    F.fill(2, 4, 2, w - 3, 4, d - 3, 0); // a gallery around an open middle
    for (let ly = 0; ly <= 4; ly++) F.ladder(1, ly, 1, 2);
    F.set(1, 4, 1, 0);
    // shelves along every wall, both floors
    for (const base of [0, 5]) for (let ly = base; ly < base + 2; ly++) {
      for (let lx = 1; lx < w - 1; lx++) { F.set(lx, ly, d - 2, B.bookshelf); if (base > 0) F.set(lx, ly, 1, B.bookshelf); }
      for (let lz = 2; lz < d - 2; lz++) { F.set(1, ly, lz, B.bookshelf); F.set(w - 2, ly, lz, B.bookshelf); }
    }
    F.set(1, 5, 1, 0); F.set(1, 6, 1, 0);
    // reading tables
    diningSet(F, st, w >> 1, (d >> 1));
    F.chest(w - 3, 5, 2, 'stronghold', [2, 4], r, 1);
    F.set(w >> 1, 7, d >> 1, B.lantern, 1); F.set(w >> 1, 8, d >> 1, st.beam);
    roof(F, st, w, d, H, r);
    frontYard(F, st, w, door, r);
    villager(F, door, 0, 2, 1, r); villager(F, door + 1, 5, d - 3, 1, r);
  }
  function church(F, st, r) {
    const w = F.w, d = F.d, door = w >> 1, H = 6;
    const stone = { ...st, wall: st === STYLES.desert ? B.sandstone : B.cobblestone, base: B.stone_bricks, beam: st === STYLES.desert ? B.chiseled_sandstone : B.stone_bricks };
    groundwork(F, stone, w, d, 22);
    // the nave
    shell(F, stone, w, d, H, { door, windowRows: [2, 3] });
    gableRoof(F, { ...st, wall: stone.wall }, w, d, H);
    // pews facing the altar, the altar, lanterns
    for (let lz = 3; lz < d - 4; lz += 2) { F.stairs(1, 0, lz, st.stairs, 0); F.stairs(2, 0, lz, st.stairs, 0); F.stairs(w - 3, 0, lz, st.stairs, 0); F.stairs(w - 2, 0, lz, st.stairs, 0); }
    F.fill(1, 0, d - 3, w - 2, 0, d - 2, B.stone_bricks); F.set(door, 1, d - 2, B.gold_block); F.set(door - 1, 1, d - 2, B.lantern); F.set(door + 1, 1, d - 2, B.lantern);
    for (let lz = 2; lz < d - 1; lz += 4) { F.set(1, 4, lz, B.lantern, 1); F.set(w - 2, 4, lz, B.lantern, 1); F.set(1, 5, lz, stone.beam); F.set(w - 2, 5, lz, stone.beam); }
    F.chest(w - 2, 1, d - 2, 'temple', [2, 4], r, 0);
    // the bell tower over the door
    const T0 = 1, T1 = w - 2, top = H + 9;
    for (let ly = H; ly < top; ly++) for (let lx = T0; lx <= T1; lx++) for (let lz = 0; lz <= 3; lz++) {
      const edge = lx === T0 || lx === T1 || lz === 0 || lz === 3;
      if (!edge) { F.set(lx, ly, lz, 0); continue; }
      const corner = (lx === T0 || lx === T1) && (lz === 0 || lz === 3);
      const belfry = ly >= top - 4 && ly < top - 1 && !corner;
      F.set(lx, ly, lz, belfry ? 0 : corner ? stone.beam : stone.wall);
    }
    F.fill(T0, top, 0, T1, top, 3, stone.beam);
    for (let k = 0; k < 3; k++) F.fill(T0 + k, top + 1 + k, k, T1 - k, top + 1 + k, 3 - k, stone.wall);
    F.set(door, top + 4, 1, B.gold_block);
    F.fill(T0 + 1, top - 1, 1, T1 - 1, top - 1, 2, stone.beam);
    F.set(door, top - 2, 1, B.bell); F.set(door, top - 2, 2, B.bell);
    // a ladder up the tower and a floor under the bells
    F.fill(T0 + 1, top - 5, 1, T1 - 1, top - 5, 2, st.floor);
    F.fill(T1, 0, 2, T1, H - 1, 2, stone.beam);
    for (let ly = 0; ly <= top - 5; ly++) F.ladder(T1 - 1, ly, 2, 3);
    F.set(T1 - 1, top - 5, 2, 0);
    F.door(door, 0, 0);
    frontYard(F, st, w, door, r);
    villager(F, door, 0, d - 4, 2, r);
  }
  function tavern(F, st, r) {
    const w = F.w, d = F.d, door = w >> 1, H = 8;
    groundwork(F, st, w, d, H + 9);
    shell(F, st, w, d, H, { door, windowRows: [1, 2, 5], band: 4 });
    F.door(door, 0, 0);
    F.fill(1, 4, 1, w - 2, 4, d - 2, st.floor);
    for (let ly = 0; ly <= 4; ly++) F.ladder(w - 2, ly, 1, 3);
    F.set(w - 2, 4, 1, 0);
    // the bar: a counter, barrels, and stools
    for (let lx = 1; lx < w - 3; lx++) { F.set(lx, 0, d - 3, st.roofFull); F.chest(lx, 0, d - 2, 'village', [1, 3], r, 0, B.barrel); if (lx % 2) F.chest(lx, 1, d - 2, 'village', [0, 2], r, 0, B.barrel); }
    for (let lx = 2; lx < w - 3; lx += 2) F.stairs(lx, 0, d - 4, st.stairs, 0);
    diningSet(F, st, 3, 2); diningSet(F, st, w - 4, 3);
    F.set(w >> 1, 3, d >> 1, B.lantern, 1);
    // rooms upstairs
    for (const [lx, c] of [[1, B.red_wool], [4, B.blue_wool], [7, B.red_wool]]) if (lx < w - 2) { F.set(lx, 5, d - 2, c); F.set(lx, 5, d - 3, B.wool); F.set(lx + 1, 5, d - 2, B.lantern); }
    F.torch(w >> 1, 6, 1, 0);
    roof(F, st, w, d, H, r);
    // a sign over the door: a hanging lantern on a beam
    F.set(door, 3, -1, st.beam); F.set(door, 2, -1, B.lantern, 1);
    F.set(door, 0, -1, 0); F.set(door, -1, -1, st.path);
    villager(F, 2, 0, d - 4, 0, r); villager(F, w - 3, 0, 2, undefined, r); villager(F, 4, 5, 3, undefined, r);
  }
  function stable(F, st, r) {
    const w = F.w, d = F.d, H = 4;
    F.fill(0, -9, 0, w - 1, -2, d - 1, st.base, 0, 1);
    F.fill(0, -1, 0, w - 1, -1, d - 1, B.dirt_path);
    F.fill(0, 0, 0, w - 1, H + 7, d - 1, 0);
    // posts, back wall, roof
    for (let lx = 0; lx < w; lx += 2) for (const lz of [0, d - 1]) for (let ly = 0; ly < H; ly++) F.set(lx, ly, lz, st.beam);
    for (let lz = 0; lz < d; lz++) for (let ly = 0; ly < H; ly++) { F.set(0, ly, lz, st.beam); F.set(w - 1, ly, lz, st.beam); }
    for (let lx = 1; lx < w - 1; lx++) for (let ly = 0; ly < H; ly++) if (lx % 2) F.set(lx, ly, d - 1, st.wall);
    gableRoof(F, st, w, d, H);
    // stalls with hay and water
    for (let lx = 2; lx < w - 1; lx += 4) {
      for (let lz = 2; lz < d - 1; lz++) F.set(lx, 0, lz, st.fence);
      F.set(lx - 1, 0, d - 2, B.hay_bale); F.set(lx + 1, 0, d - 2, B.cauldron);
      F.mob('horse', lx + (lx + 1 < w - 1 ? 1 : -1), 0, 3, { v: r.nextInt(7) });
    }
    F.set(1, 2, 1, B.lantern, 1); F.set(w - 2, 2, 1, B.lantern, 1);
    F.chest(w - 2, 0, d - 2, 'village', [1, 3], r, 0, B.barrel, [I.stack(I.byName.saddle.id)]);
    villager(F, w >> 1, 0, 1, 0, r);
  }
  function watchtower(F, st, r) {
    const w = F.w, d = F.d, H = 12;
    const stone = { ...st, wall: st === STYLES.desert ? B.sandstone : B.cobblestone, base: B.cobblestone };
    groundwork(F, stone, w, d, H + 6);
    shell(F, stone, w, d, H, { door: w >> 1, windowRows: [4, 8], noFooting: true });
    F.door(w >> 1, 0, 0);
    for (let ly = 0; ly < H; ly++) F.ladder(w >> 1, ly, d - 2, 1);
    // the lookout: an overhanging platform with railings and lanterns
    F.fill(-1, H, -1, w, H, d, st.floor); F.set(w >> 1, H, d - 2, 0);
    for (let lx = -1; lx <= w; lx++) for (let lz = -1; lz <= d; lz++) if (lx === -1 || lx === w || lz === -1 || lz === d) F.set(lx, H + 1, lz, st.fence);
    for (const [lx, lz] of [[-1, -1], [w, -1], [-1, d], [w, d]]) { F.set(lx, H + 2, lz, st.fence); F.set(lx, H + 3, lz, B.lantern); }
    F.chest(1, H + 1, 1, 'outpost', [2, 4], r, 0);
    F.mob('iron_golem', w >> 1, 0, -2, { home: F.centre() });
  }
  function townHall(F, st, r) {
    const w = F.w, d = F.d, door = w >> 1, H = 9;
    const grand = { ...st, base: B.stone_bricks, beam: st.beam };
    groundwork(F, grand, w, d, H + 10);
    shell(F, grand, w, d, H, { door, windowRows: [2, 3, 6, 7], band: 5 });
    F.door(door, 0, 0); F.door(door - 1, 0, 0);
    F.fill(1, 5, 1, w - 2, 5, d - 2, st.floor);
    F.fill(3, 5, 3, w - 4, 5, d - 4, 0);
    for (let ly = 0; ly <= 5; ly++) F.ladder(1, ly, d - 2, 1);
    F.set(1, 5, d - 2, 0);
    // a hall with a long table, banners and a throne-like chair
    for (let lz = 3; lz < d - 3; lz++) { F.set(door, 0, lz, st.roofFull); if (lz % 2) { F.stairs(door - 1, 0, lz, st.stairs, 2); F.stairs(door + 1, 0, lz, st.stairs, 3); } }
    F.stairs(door, 0, d - 2, st.stairs, 1); F.set(door, 1, d - 2, B.gold_block);
    for (const lx of [2, w - 3]) for (let ly = 1; ly < 4; ly++) F.set(lx, ly, d - 1, ly === 3 ? B.blue_wool : B.red_wool);
    for (let lz = 2; lz < d - 2; lz += 3) { F.set(1, 4, lz, B.lantern); F.set(w - 2, 4, lz, B.lantern); }
    F.chest(w - 2, 6, d - 2, 'village', [4, 8], r, 0);
    F.chest(w - 2, 6, 1, 'smith', [2, 5], r, 0);
    roof(F, st, w, d, H, r);
    // a flag on the front
    const fx = w - 2;
    for (let ly = 0; ly < 7; ly++) F.set(fx, ly, -2, st.fence);
    F.set(fx + 1, 6, -2, B.red_wool, 0, 3); F.set(fx + 2, 6, -2, B.red_wool, 0, 3); F.set(fx + 1, 5, -2, B.blue_wool, 0, 3); F.set(fx + 2, 5, -2, B.blue_wool, 0, 3);
    for (const lx of [door - 3, door + 2]) { F.set(lx, 0, -1, st.fence); F.set(lx, 1, -1, B.lantern); }
    F.set(door - 1, -1, -1, st.path);
    villager(F, door, 0, 2, 2, r); villager(F, door + 2, 6, d - 3, 1, r);
  }

  /* ------------------------------------------------------------ */
  /* The plaza                                                    */
  /* ------------------------------------------------------------ */
  function plaza(pl, ctx, st, cx, cz, y, r, R) {
    // paving, raised a little where the ground dips; the land around slopes gently down (or up) to it
    const RB = R + 6;
    for (let dx = -RB; dx <= RB; dx++) for (let dz = -RB; dz <= RB; dz++) {
      const dist = Math.sqrt(dx * dx + dz * dz), x = cx + dx, z = cz + dz;
      if (dist > RB) continue;
      if (dist <= R + 0.5) {
        pl.fill(x, y - 8, z, x, y - 2, z, st.base, 0, 1);
        pl.set(x, y - 1, z, (Math.abs(dx) + Math.abs(dz)) % 5 === 0 ? st.path : st.plaza);
        pl.fill(x, y, z, x, y + 14, z, 0);
        continue;
      }
      blend(pl, ctx, x, z, y - 1, dist - R);
    }
    if (st === STYLES.desert || r.next() < 0.35) {
      // a well
      pl.fill(cx - 1, y - 6, cz - 1, cx + 1, y - 1, cz + 1, st.base);
      pl.fill(cx, y - 5, cz, cx, y - 1, cz, B.water);
      pl.walls(cx - 1, y, cz - 1, cx + 1, y, cz + 1, st.base); pl.set(cx, y, cz, B.water);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pl.fill(cx + dx, y + 1, cz + dz, cx + dx, y + 2, cz + dz, st.fence);
      pl.fill(cx - 1, y + 3, cz - 1, cx + 1, y + 3, cz + 1, st.base); pl.set(cx, y + 4, cz, B.lantern);
    } else {
      // a fountain: a stone basin of water and a column with a lantern
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const ring = Math.max(Math.abs(dx), Math.abs(dz));
        if (ring === 3) pl.set(cx + dx, y, cz + dz, B.stone_bricks);
        else { pl.set(cx + dx, y - 1, cz + dz, B.water); pl.set(cx + dx, y - 2, cz + dz, B.stone_bricks); }
      }
      pl.fill(cx, y - 1, cz, cx, y + 2, cz, B.stone_bricks); pl.set(cx, y + 3, cz, B.chiseled_sandstone === st.beam ? B.chiseled_sandstone : B.stone_bricks);
      pl.set(cx, y + 4, cz, B.lantern);
    }
    // the bell, on a little frame
    const bx = cx + 5, bz = cz;
    pl.set(bx, y, bz - 1, st.beam); pl.set(bx, y + 1, bz - 1, st.beam); pl.set(bx, y + 2, bz - 1, st.beam);
    pl.set(bx, y, bz + 1, st.beam); pl.set(bx, y + 1, bz + 1, st.beam); pl.set(bx, y + 2, bz + 1, st.beam);
    pl.set(bx, y + 2, bz, st.beam); pl.set(bx, y + 1, bz, B.bell);
    // benches and lamps
    for (const [dx, dz, f] of [[0, -5, 0], [0, 5, 1], [-5, 0, 2]]) { for (const k of [-1, 1]) { const x = cx + dx + (dz ? k : 0), z = cz + dz + (dx ? k : 0); pl.set(x, y, z, st.stairs, f); } }
    for (const [dx, dz] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) { pl.set(cx + dx, y, cz + dz, st.fence); pl.set(cx + dx, y + 1, cz + dz, st.fence); pl.set(cx + dx, y + 2, cz + dz, B.lantern); }
  }
  // ease the natural ground towards a level (gy) over a few blocks (t = distance from the edge)
  function blend(pl, ctx, x, z, gy, t) {
    const g = ctx.h(x, z);
    if (g < SEA - 1) return;
    const k = Math.min(1, t / 6), target = Math.round(gy + (g - gy) * k);
    const top = ctx.top(x, z);
    if (g > target) {
      pl.fill(x, target + 1, z, x, Math.max(g, Math.min(top, g + 10)), z, 0);
      pl.set(x, target, z, ctx.biome(x, z) === BI.DESERT ? B.sand : B.grass);
    } else if (g < target) {
      pl.fill(x, g, z, x, target - 1, z, B.dirt);
      pl.set(x, target, z, ctx.biome(x, z) === BI.DESERT ? B.sand : B.grass);
    }
  }
  // a market stall: four posts, a striped awning, a counter
  function stall(pl, st, x, z, y, face, r) {
    const F = new Frame(pl, [x - 1, z - 1, x + 1, z + 1], face, y);
    F.fill(0, -1, 0, 2, -1, 2, st.plaza);
    for (const [lx, lz] of [[0, 0], [2, 0], [0, 2], [2, 2]]) { F.set(lx, 0, lz, st.fence); F.set(lx, 1, lz, st.fence); }
    const a = r.next() < 0.5 ? B.red_wool : B.blue_wool;
    for (let lx = 0; lx < 3; lx++) for (let lz = 0; lz < 3; lz++) F.set(lx, 2, lz, lx % 2 ? B.wool : a);
    F.set(0, 0, 1, B.barrel); F.set(2, 0, 1, B.hay_bale);
    const goods = [B.pumpkin, B.melon || B.pumpkin, B.hay_bale, B.barrel, B.bookshelf];
    F.set(1, 0, 0, goods[r.nextInt(goods.length)] || B.barrel);
    F.mob('villager', 1, 0, 2, { v: r.nextInt(5), home: [x, y, z] });
  }

  /* ------------------------------------------------------------ */
  /* The village: plaza, streets, lots, maybe a wall              */
  /* ------------------------------------------------------------ */
  const LIMIT = 70; // blocks from the centre (the plan covers +-5 chunks)
  function bigVillage(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const st = styleFor(ctx.biome(cx, cz));
    const g0 = ctx.h(cx, cz);
    if (!st || g0 < SEA || g0 > 110) return null;
    // flat enough for a plaza, and not a lake?
    let lo = 999, hi = -1, wet = 0, n = 0;
    for (let dx = -24; dx <= 24; dx += 6) for (let dz = -24; dz <= 24; dz += 6) {
      const h = ctx.h(cx + dx, cz + dz); n++;
      if (h < SEA - 1) { wet++; continue; }
      if (Math.abs(dx) <= 12 && Math.abs(dz) <= 12) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
    }
    if (hi - lo > 6 || lo < SEA - 1 || wet > n / 4) return null;
    const pl = new Plan('village');
    const y0 = g0 + 1;
    const used = new Map(); // "x,z" -> 'road' | 'lot' | 'plaza'
    // columns the village owns: nothing natural (trees, flowers) may grow there above this height
    const claims = pl.claims = new Map();
    const claim = (x, z, y) => { const k = key(x, z), v = claims.get(k); if (v === undefined || y < v) claims.set(k, y); };
    const key = (x, z) => x + ',' + z;
    const mark = (x0, z0, x1, z1, v) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) used.set(key(x, z), v); };
    const freeRect = (x0, z0, x1, z1, gap) => {
      for (let x = x0 - gap; x <= x1 + gap; x++) for (let z = z0 - gap; z <= z1 + gap; z++) if (used.has(key(x, z))) return false;
      return Math.abs(x0 - cx) < LIMIT && Math.abs(x1 - cx) < LIMIT && Math.abs(z0 - cz) < LIMIT && Math.abs(z1 - cz) < LIMIT;
    };
    const PR = 8;
    plaza(pl, ctx, st, cx, cz, y0, r, PR);
    mark(cx - PR, cz - PR, cx + PR, cz + PR, 'plaza');
    for (let dx = -PR - 6; dx <= PR + 6; dx++) for (let dz = -PR - 6; dz <= PR + 6; dz++) claim(cx + dx, cz + dz, Math.min(y0 - 1, ctx.h(cx + dx, cz + dz)));

    // 1. streets: main streets out of the plaza, side streets off them
    const streets = [];
    function street(sx, sz, dir, len, depth) {
      const [dx, dz] = DV[dir];
      const cells = [];
      let prev = ctx.h(sx, sz), water = 0;
      for (let k = 0; k < len; k++) {
        const x = sx + dx * k, z = sz + dz * k;
        if (Math.abs(x - cx) > LIMIT || Math.abs(z - cz) > LIMIT) break;
        const u = used.get(key(x, z));
        if (k > 1 && u && u !== 'plaza') { if (u === 'road') cells.push({ x, z, y: prev, join: true }); break; }
        let g = ctx.h(x, z);
        const wet = g < SEA - 1;
        if (wet) { water++; if (water > 12) break; g = SEA - 1; } else water = 0;
        if (Math.abs(g - prev) > 2) break;
        cells.push({ x, z, y: g, bridge: wet });
        prev = g;
      }
      if (cells.length < 6) return;
      // a bridge must reach land again
      while (cells.length && cells[cells.length - 1].bridge) cells.pop();
      const s = { dir, cells, depth };
      streets.push(s);
      for (const c of cells) for (let w = -1; w <= 1; w++) { const x = c.x + (dz ? w : 0), z = c.z + (dx ? w : 0); if (used.get(key(x, z)) !== 'plaza') used.set(key(x, z), 'road'); }
      if (depth >= 2) return;
      // side streets
      for (let k = 10 + r.nextInt(6); k < cells.length - 6; k += 13 + r.nextInt(8)) {
        for (const side of [-1, 1]) {
          if (r.next() > (depth === 0 ? 0.7 : 0.4)) continue;
          const nd = dx ? (side > 0 ? 1 : 0) : (side > 0 ? 3 : 2);
          const [ndx, ndz] = DV[nd];
          street(cells[k].x + ndx * 2, cells[k].z + ndz * 2, nd, 16 + r.nextInt(22), depth + 1);
        }
      }
    }
    const mains = [0, 1, 2, 3].filter(() => r.next() < 0.85);
    if (mains.length < 2) mains.push(0, 1);
    for (const d of new Set(mains)) { const [dx, dz] = DV[d]; street(cx + dx * (PR + 1), cz + dz * (PR + 1), d, 34 + r.nextInt(30), 0); }
    if (!streets.length) return null;
    // lay them: path, cleared headroom, bridges with railings, lamps
    for (const s of streets) {
      const [dx, dz] = DV[s.dir];
      s.cells.forEach((c, i) => {
        for (let w = -1; w <= 1; w++) {
          const x = c.x + (dz ? w : 0), z = c.z + (dx ? w : 0);
          if (used.get(key(x, z)) === 'plaza') continue;
          if (c.bridge) {
            pl.set(x, SEA, z, st.floor === B.sandstone ? B.planks : st.floor);
            pl.fill(x, SEA + 1, z, x, SEA + 3, z, 0);
            if (w !== 0) pl.set(x, SEA + 1, z, st.fence);
            if (w !== 0 && i % 4 === 0) { pl.set(x, SEA - 1, z, st.beam); pl.fill(x, SEA - 6, z, x, SEA - 2, z, st.beam, 0, 1); pl.set(x, SEA + 2, z, B.lantern); }
            continue;
          }
          const g = ctx.h(x, z);
          for (let e = -1; e <= 1; e++) claim(x + (dz ? 0 : e), z + (dx ? 0 : e), g);
          pl.set(x, g, z, w === 0 || r.next() < 0.75 ? st.path : st.plaza);
          pl.fill(x, g + 1, z, x, g + 3, z, 0);
          pl.fill(x, g - 3, z, x, g - 1, z, B.dirt, 0, 1);
        }
        // lamp posts along the way
        if (i % 12 === 6 && !c.bridge) {
          const side = (i / 12) % 2 ? 1 : -1, x = c.x + (dz ? side * 2 : 0), z = c.z + (dx ? side * 2 : 0);
          if (!used.has(key(x, z))) { const g = ctx.h(x, z); pl.set(x, g + 1, z, st.fence); pl.set(x, g + 2, z, st.fence); pl.set(x, g + 3, z, B.lantern); used.set(key(x, z), 'lamp'); }
        }
      });
    }

    // 2. lots along the streets; the town hall goes next to the plaza
    const count = {};
    let people = 0;
    const kinds = Object.keys(KINDS).filter(k => KINDS[k].weight > 0);
    const choose = () => {
      let tot = 0; for (const k of kinds) if (!(KINDS[k].max && (count[k] || 0) >= KINDS[k].max)) tot += KINDS[k].weight;
      let v = r.next() * tot;
      for (const k of kinds) { if (KINDS[k].max && (count[k] || 0) >= KINDS[k].max) continue; v -= KINDS[k].weight; if (v < 0) return k; }
      return 'small';
    };
    function tryLot(s, i, side, kind) {
      const c = s.cells[i];
      if (!c || c.bridge) return 0;
      const [dx, dz] = DV[s.dir];
      const [w, d] = KINDS[kind].size(r);
      // normal pointing away from the street, toward the lot
      const nx = dz ? side : 0, nz = dx ? side : 0;
      const near = 3, far = near + d - 1;
      const a0 = -(w >> 1), a1 = a0 + w - 1;
      const xs = [c.x + dx * a0 + nx * near, c.x + dx * a1 + nx * far], zs = [c.z + dz * a0 + nz * near, c.z + dz * a1 + nz * far];
      const rect = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
      if (!freeRect(rect[0], rect[1], rect[2], rect[3], 1)) return 0;
      // the land must be dry and not too steep
      let lo = 999, hi = -1;
      for (let x = rect[0]; x <= rect[2]; x += 2) for (let z = rect[1]; z <= rect[3]; z += 2) { const h = ctx.h(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (lo < SEA - 1 || hi - lo > 6) return 0;
      const face = dirOf(-nx, -nz);
      const fy = ctx.h(c.x + nx * near, c.z + nz * near) + 1;
      const F = new Frame(pl, rect, face, Math.max(fy, lo + 1));
      // level a margin round the lot so it sits in the land instead of in a pit
      for (let x = rect[0] - 3; x <= rect[2] + 3; x++) for (let z = rect[1] - 3; z <= rect[3] + 3; z++) claim(x, z, Math.min(F.y - 1, ctx.h(x, z)));
      for (let x = rect[0] - 3; x <= rect[2] + 3; x++) for (let z = rect[1] - 3; z <= rect[3] + 3; z++) {
        if (x >= rect[0] && x <= rect[2] && z >= rect[1] && z <= rect[3]) continue;
        if (used.has(key(x, z))) continue;
        const t = Math.max(rect[0] - x, x - rect[2], rect[1] - z, z - rect[3]);
        blend(pl, ctx, x, z, F.y - 1, t - 1);
      }
      // a path from the door to the street
      const door = F.w >> 1;
      for (let k = 1; k <= 2; k++) { const x = F.wx(door, -k), z = F.wz(door, -k); const g = ctx.h(x, z); pl.set(x, g, z, st.path); pl.fill(x, g + 1, z, x, g + 2, z, 0); }
      const before = pl.mobs.length;
      KINDS[kind].build(F, st, r);
      for (let m = before; m < pl.mobs.length; m++) if (pl.mobs[m].type === 'villager') people++;
      mark(rect[0], rect[1], rect[2], rect[3], 'lot');
      count[kind] = (count[kind] || 0) + 1;
      return dx ? rect[2] - rect[0] + 1 : rect[3] - rect[1] + 1;
    }
    // town hall first, on the first main street right by the plaza
    const s0 = streets[0];
    if (s0.cells.length > 14) tryLot(s0, 7, 1, 'hall') || tryLot(s0, 7, -1, 'hall');
    for (const s of streets) {
      for (const side of [-1, 1]) {
        let i = 3 + r.nextInt(3);
        while (i < s.cells.length - 2) {
          let kind = choose();
          // watchtowers stand at the ends of the streets
          if (kind === 'tower' && i < s.cells.length - 10) kind = 'small';
          const used0 = tryLot(s, i + 2, side, kind);
          i += used0 ? used0 + 1 + r.nextInt(2) : 3;
        }
      }
    }
    if (people < 3) return null;
    // 3. market stalls around the plaza
    const spots = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => r.next() - 0.5).slice(0, 2 + r.nextInt(3));
    for (const k of spots) {
      const a = (k * 45 + 22.5) * Math.PI / 180, sx = Math.round(cx + Math.cos(a) * (PR - 1)), sz = Math.round(cz + Math.sin(a) * (PR - 1));
      const face = Math.abs(sx - cx) > Math.abs(sz - cz) ? (sx > cx ? 2 : 3) : (sz > cz ? 0 : 1);
      stall(pl, st, sx, sz, y0, face, r);
    }
    // 4. guards
    pl.mob('iron_golem', cx + 0.5, y0, cz + 6.5, { home: [cx, y0, cz] });
    if (people > 14) pl.mob('iron_golem', cx + 0.5, y0, cz - 6.5, { home: [cx, y0, cz] });
    for (let k = 0; k < 2; k++) pl.mob('villager', cx - 6.5, y0, cz + 2.5 - k * 5, { v: r.nextInt(5), home: [cx, y0, cz] });
    // 5. some villages are walled towns
    if (people >= 8 && (st === STYLES.taiga || st === STYLES.snowy || st === STYLES.plains || st === STYLES.desert) && r.next() < 0.35) palisade(pl, ctx, st, used, cx, cz, r);
    pl.villageInfo = { people, kinds: count, style: Object.keys(STYLES).find(k => STYLES[k] === st) };
    return pl;
  }
  // a wall round the whole town with towers at the corners and gates where the streets leave
  function palisade(pl, ctx, st, used, cx, cz, r) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const [k, v] of used) { if (v === 'lamp') continue; const [x, z] = k.split(',').map(Number); x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    x0 -= 3; z0 -= 3; x1 += 3; z1 += 3;
    x0 = Math.max(x0, cx - LIMIT - 4); x1 = Math.min(x1, cx + LIMIT + 4); z0 = Math.max(z0, cz - LIMIT - 4); z1 = Math.min(z1, cz + LIMIT + 4);
    const stone = st === STYLES.desert;
    const wallB = stone ? B.sandstone : st.beam === B.log ? B.log : B.spruce_log;
    const H = stone ? 5 : 4;
    const perimeter = [];
    for (let x = x0; x <= x1; x++) perimeter.push([x, z0], [x, z1]);
    for (let z = z0 + 1; z < z1; z++) perimeter.push([x0, z], [x1, z]);
    for (const [x, z] of perimeter) {
      const g = ctx.h(x, z);
      if (g < SEA - 1) continue;
      const v = used.get(x + ',' + z);
      // gates where a street crosses
      if (v === 'road') { pl.set(x, g + H, z, wallB); pl.set(x, g + H + 1, z, stone ? B.sandstone : st.fence, 0, 3); continue; }
      if (v === 'lot') continue;
      pl.fill(x, g - 2, z, x, g, z, st.base, 0, 1);
      pl.fill(x, g + 1, z, x, g + H, z, wallB);
      if (pl.claims) for (let e = -1; e <= 1; e++) for (let f = -1; f <= 1; f++) { const k = (x + e) + ',' + (z + f), v = pl.claims.get(k); if (v === undefined || g < v) pl.claims.set(k, g); }
      if (stone ? (x + z) % 2 === 0 : true) pl.set(x, g + H + 1, z, stone ? B.sandstone : st.fence);
    }
    // corner towers
    for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      const g = ctx.h(tx, tz);
      if (g < SEA - 1) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { pl.fill(tx + dx, g - 3, tz + dz, tx + dx, g, tz + dz, st.base, 0, 1); pl.fill(tx + dx, g + 1, tz + dz, tx + dx, g + H + 3, tz + dz, stone ? B.chiseled_sandstone : st.beam); }
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { pl.set(tx + dx, g + H + 4, tz + dz, st.floor === B.sandstone ? B.sandstone : st.floor); if (Math.abs(dx) === 2 || Math.abs(dz) === 2) pl.set(tx + dx, g + H + 5, tz + dz, st.fence); }
      pl.set(tx, g + H + 5, tz, B.lantern);
    }
  }

  // nothing natural grows on a village's claimed ground (ores underneath still do)
  // (the Overworld, and OreSpawn's Village Mania)
  const CLAIM_DIMS = { 0: 1, 7: 1 };
  function claimsFor(w, cx, cz) {
    if (!w._claimCache) w._claimCache = new Map();
    const k = cx + ',' + cz;
    let list = w._claimCache.get(k);
    if (list === undefined) {
      list = [];
      try { for (const p of St.plansFor(w, cx, cz)) if (p.claims) list.push(p.claims); } catch (e) { /* no plans */ }
      w._claimCache.set(k, list);
      if (w._claimCache.size > 300) w._claimCache.delete(w._claimCache.keys().next().value);
    }
    return list;
  }
  St.claimAt = function (w, x, z) {
    if (!CLAIM_DIMS[w.dim || 0]) return undefined;
    let best;
    for (const c of claimsFor(w, x >> 4, z >> 4)) { const v = c.get(x + ',' + z); if (v !== undefined && (best === undefined || v < best)) best = v; }
    return best;
  };
  const popSet = W.popSet;
  W.popSet = function (x, y, z, id, meta) {
    if (CLAIM_DIMS[this.dim || 0] && this.gen) {
      const v = St.claimAt(this, x, z);
      if (v !== undefined && y > v) return;
    }
    return popSet.apply(this, arguments);
  };
  /** Is there a start of this structure type within dist blocks of (x, z)? (cheap: no plans are built) */
  St.startNear = function (w, name, x, z, dist) {
    const dim = w.dim || 0;
    for (const T of St.TYPES) {
      if (T.name !== name || T.dim !== dim) continue;
      const sp = T.spacing, g0x = Math.floor((x / 16) / sp), g0z = Math.floor((z / 16) / sp), rr = Math.ceil(dist / 16 / sp) + 1;
      for (let gx = g0x - rr; gx <= g0x + rr; gx++) for (let gz = g0z - rr; gz <= g0z + rr; gz++) {
        const r = new S.RNG(S.hash2(w.seed ^ T.salt, gx, gz));
        if (r.next() > T.chance) continue;
        const sx = (gx * sp + r.nextInt(sp - T.sep)) * 16 + 8, sz = (gz * sp + r.nextInt(sp - T.sep)) * 16 + 8;
        if (Math.hypot(sx - x, sz - z) < dist) return true;
      }
    }
    return false;
  };
  const Plan = St.Plan;
  const T = St.TYPES.find(t => t.name === 'village' && t.dim === 0);
  if (T) Object.assign(T, { spacing: 30, sep: 9, radius: 5, chance: 0.9, salt: 0x5c1, build: bigVillage });
  St.bigVillage = bigVillage;
  DL.Villages = { STYLES, KINDS, Frame, styleFor };
})();
