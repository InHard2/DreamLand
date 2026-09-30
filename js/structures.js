/*
 * DreamLand - generated structures for every dimension.
 *
 * Each structure type owns a grid of cells (spacing in chunks). A cell may hold
 * one start; its blueprint is planned lazily from the terrain height map and
 * cached as block operations bucketed per chunk. When a freshly generated chunk
 * is installed, the operations that fall inside it are written, so structures
 * appear seamlessly no matter which chunk loads first.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, CH = S.CH, SEA = S.SEA;
  const SOLID = S.SOLID, LIQUID = S.LIQUID;
  const BI = S.BIOME;
  const St = DL.Structures = {};
  const ck = (cx, cz) => DL.ckey(cx, cz);

  /* ------------------------------------------------------------ */
  /* Blueprint                                                    */
  /* ------------------------------------------------------------ */
  // modes: 0 overwrite, 1 only where not solid (foundations), 3 only into air
  class Plan {
    constructor(name) { this.name = name; this.ops = new Map(); this.tiles = []; this.mobs = []; }
    set(x, y, z, id, meta, mode) {
      x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
      if (y < 1 || y >= CH) return;
      const k = ck(x >> 4, z >> 4);
      let a = this.ops.get(k);
      if (!a) { a = []; this.ops.set(k, a); }
      a.push(x, y, z, id, meta || 0, mode || 0);
    }
    fill(x0, y0, z0, x1, y1, z1, id, meta, mode) {
      const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
      for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) this.set(x, y, z, typeof id === 'function' ? id(x, y, z) : id, meta, mode);
    }
    /** Hollow box: shell of `wall`, inside set to `inside` (null = untouched). */
    box(x0, y0, z0, x1, y1, z1, wall, inside, mode) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const edge = x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1;
        if (edge) this.set(x, y, z, typeof wall === 'function' ? wall(x, y, z) : wall, 0, mode);
        else if (inside !== null && inside !== undefined) this.set(x, y, z, typeof inside === 'function' ? inside(x, y, z) : inside, 0, 0);
      }
    }
    walls(x0, y0, z0, x1, y1, z1, id) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++)
        if (x === x0 || x === x1 || z === z0 || z === z1) this.set(x, y, z, typeof id === 'function' ? id(x, y, z) : id);
    }
    foundation(x0, z0, x1, z1, y, id, depth) { this.fill(x0, y - (depth || 12), z0, x1, y - 1, z1, id, 0, 1); }
    chest(x, y, z, table, rolls, r, extra) {
      this.set(x, y, z, B.chest, r.nextInt(4));
      const items = new Array(27).fill(null);
      const n = rolls[0] + r.nextInt(rolls[1] - rolls[0] + 1);
      for (let i = 0; i < n; i++) { const s = rollLoot(table, r); if (s) items[r.nextInt(27)] = s; }
      if (extra) for (const s of extra) items[r.nextInt(27)] = s;
      this.tiles.push({ x, y, z, te: { type: 'chest', items } });
    }
    spawner(x, y, z, mob) { this.set(x, y, z, B.spawner, 0); this.tiles.push({ x, y, z, te: { type: 'spawner', mob, delay: 200 } }); }
    mob(type, x, y, z, extra) { this.mobs.push(Object.assign({ type, x, y, z }, extra || {})); }
  }
  St.Plan = Plan;

  /* ------------------------------------------------------------ */
  /* Loot                                                         */
  /* ------------------------------------------------------------ */
  const LOOT = {
    village: [['bread', 1, 4, 10], ['apple', 1, 3, 8], ['iron_ingot', 1, 4, 6], ['emerald', 1, 3, 6], ['wheat', 2, 6, 8], ['seeds', 2, 6, 6], ['iron_pickaxe', 1, 1, 2], ['gold_ingot', 1, 2, 3], ['iron_sword', 1, 1, 2]],
    smith: [['iron_ingot', 1, 5, 10], ['gold_ingot', 1, 3, 5], ['diamond', 1, 3, 3], ['iron_pickaxe', 1, 1, 5], ['iron_sword', 1, 1, 5], ['iron_chestplate', 1, 1, 5], ['iron_helmet', 1, 1, 5], ['bread', 1, 3, 15], ['apple', 1, 3, 15], ['obsidian', 3, 7, 5], ['sapling', 3, 7, 5]],
    temple: [['bone', 2, 6, 10], ['rotten_flesh', 2, 6, 10], ['gold_ingot', 2, 5, 8], ['iron_ingot', 1, 5, 8], ['emerald', 1, 3, 5], ['diamond', 1, 3, 3], ['saddle', 1, 1, 4], ['golden_apple', 1, 1, 1], ['gunpowder', 1, 4, 6]],
    mineshaft: [['bread', 1, 3, 10], ['coal', 3, 8, 10], ['iron_ingot', 1, 5, 8], ['gold_ingot', 1, 3, 4], ['redstone', 4, 9, 5], ['diamond', 1, 2, 2], ['rail', 4, 8, 4], ['torch', 4, 12, 8], ['iron_pickaxe', 1, 1, 1]],
    stronghold: [['ender_pearl', 1, 2, 8], ['iron_ingot', 1, 5, 8], ['gold_ingot', 1, 3, 5], ['bread', 1, 3, 8], ['apple', 1, 3, 8], ['iron_sword', 1, 1, 3], ['iron_chestplate', 1, 1, 2], ['diamond', 1, 3, 2], ['book', 1, 3, 6], ['paper', 2, 6, 6], ['eye_of_ender', 1, 1, 2]],
    fortress: [['diamond', 1, 3, 5], ['iron_ingot', 1, 5, 5], ['gold_ingot', 1, 3, 15], ['gold_sword', 1, 1, 5], ['gold_chestplate', 1, 1, 5], ['flint_and_steel', 1, 1, 5], ['nether_wart', 3, 7, 5], ['saddle', 1, 1, 10], ['obsidian', 2, 4, 2]],
    bastion: [['gold_block', 1, 2, 3], ['gold_ingot', 4, 9, 10], ['gold_nugget', 6, 17, 10], ['diamond', 1, 2, 4], ['diamond_sword', 1, 1, 2], ['crying_obsidian', 1, 5, 5], ['magma_cream', 1, 3, 4], ['gold_helmet', 1, 1, 3], ['golden_apple', 1, 1, 2]],
    end_city: [['diamond', 2, 7, 5], ['iron_ingot', 4, 8, 10], ['gold_ingot', 2, 7, 15], ['emerald', 2, 6, 2], ['diamond_sword', 1, 1, 3], ['diamond_pickaxe', 1, 1, 3], ['diamond_chestplate', 1, 1, 3], ['iron_chestplate', 1, 1, 3], ['saddle', 1, 1, 3], ['popped_chorus_fruit', 2, 6, 5]],
    ship: [['gold_ingot', 3, 9, 10], ['iron_ingot', 2, 8, 10], ['emerald', 1, 5, 6], ['diamond', 1, 3, 3], ['bread', 2, 5, 8], ['paper', 2, 8, 6], ['fish_cooked', 1, 3, 6]],
    ruined: [['obsidian', 1, 2, 8], ['flint_and_steel', 1, 1, 4], ['fire_charge', 1, 1, 4], ['gold_nugget', 4, 20, 10], ['golden_apple', 1, 1, 2], ['gold_ingot', 2, 8, 5], ['gold_block', 1, 1, 1], ['gold_pickaxe', 1, 1, 3], ['gold_sword', 1, 1, 3]],
    igloo: [['golden_apple', 1, 1, 2], ['apple', 1, 3, 10], ['coal', 1, 4, 10], ['emerald', 1, 1, 4], ['gold_nugget', 1, 3, 10], ['stone_axe', 1, 1, 4], ['bread', 1, 3, 8]],
    aether: [['zanite_gemstone', 2, 6, 10], ['ambrosium_shard', 2, 8, 10], ['golden_amber', 2, 6, 8], ['zanite_pickaxe', 1, 1, 3], ['zanite_sword', 1, 1, 3], ['gravitite_plate', 1, 2, 2], ['skyroot_planks', 4, 12, 6], ['gravitite_pickaxe', 1, 1, 1]],
    outpost: [['arrow', 2, 7, 10], ['wheat', 3, 5, 8], ['emerald', 1, 1, 3], ['iron_ingot', 1, 3, 5], ['dark_planks', 2, 5, 5], ['bow', 1, 1, 3]],
    buried: [['diamond', 1, 2, 5], ['gold_ingot', 1, 4, 10], ['iron_ingot', 1, 4, 10], ['emerald', 4, 8, 5], ['fish_cooked', 2, 4, 5], ['iron_sword', 1, 1, 2]],
    monument: [['gold_ingot', 2, 6, 10], ['prismarine', 4, 12, 10], ['sea_lantern', 1, 4, 5], ['diamond', 1, 2, 2]]
  };
  function rollLoot(table, r) {
    const T = LOOT[table];
    let tot = 0; for (const e of T) tot += e[3];
    let v = r.nextInt(tot);
    for (const e of T) {
      v -= e[3];
      if (v < 0) {
        const d = DL.Items.byName[e[0]];
        if (!d) return null;
        return DL.Items.stack(d.id, Math.min(d.maxStack, e[1] + r.nextInt(e[2] - e[1] + 1)));
      }
    }
    return null;
  }
  St.rollLoot = rollLoot;

  /* ------------------------------------------------------------ */
  /* Builders: Overworld                                          */
  /* ------------------------------------------------------------ */
  const mix = (r, a, b, p) => () => (r.next() < p ? b : a);

  function lamp(pl, x, y, z) { pl.fill(x, y, z, x, y + 1, z, B.fence); pl.set(x, y + 2, z, B.glowstone); }

  function house(pl, ctx, M, x0, z0, w, d, door, kind) {
    const r = ctx.r;
    const x1 = x0 + w - 1, z1 = z0 + d - 1, mx = (x0 + x1) >> 1, mz = (z0 + z1) >> 1;
    const y = ctx.h(mx, mz) + 1;
    if (y < SEA) return null;
    const H = kind === 'church' ? 4 : 4;
    pl.foundation(x0, z0, x1, z1, y, M.base);
    pl.fill(x0, y - 1, z0, x1, y - 1, z1, M.floor);
    pl.fill(x0, y, z0, x1, y + H + 3, z1, 0);
    if (kind === 'farm') {
      pl.fill(x0, y - 1, z0, x1, y - 1, z1, B.log);
      for (let x = x0 + 1; x < x1; x++) for (let z = z0 + 1; z < z1; z++) {
        if (x === mx) pl.set(x, y - 1, z, B.water);
        else { pl.set(x, y - 1, z, B.farmland, 7); pl.set(x, y, z, B.wheat, 2 + r.nextInt(6)); }
      }
      return y;
    }
    pl.walls(x0, y, z0, x1, y + H - 1, z1, M.wall);
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) pl.fill(cx, y, cz, cx, y + H - 1, cz, M.beam);
    // roof: stepped layers
    for (let k = 0; k <= Math.min(w, d) >> 1; k++) {
      const ry = y + H + k;
      if (x0 + k > x1 - k || z0 + k > z1 - k) break;
      pl.fill(x0 - 1 + k, ry, z0 - 1 + k, x1 + 1 - k, ry, z1 + 1 - k, M.roof);
      if (k > 0) pl.fill(x0 + k, ry - 1, z0 + k, x1 - k, ry - 1, z1 - k, 0);
      if (M.snow) pl.fill(x0 - 1 + k, ry + 1, z0 - 1 + k, x1 + 1 - k, ry + 1, z1 + 1 - k, B.snow_layer, 0, 3);
    }
    pl.fill(x0 + 1, y + H - 1 + 1, z0 + 1, x1 - 1, y + H - 1 + 1, z1 - 1, 0);
    // windows
    if (w > 4) { pl.set(mx, y + 1, z0, B.glass); pl.set(mx, y + 1, z1, B.glass); }
    if (d > 4) { pl.set(x0, y + 1, mz, B.glass); pl.set(x1, y + 1, mz, B.glass); }
    // doorway facing the road
    const dp = door === 0 ? [mx, z0] : door === 1 ? [mx, z1] : door === 2 ? [x0, mz] : [x1, mz];
    pl.set(dp[0], y, dp[1], 0); pl.set(dp[0], y + 1, dp[1], 0);
    pl.set(x0 + 1, y, z0 + 1, B.torch, 0);
    if (kind === 'smith') {
      pl.set(x1 - 1, y, z1 - 1, B.furnace, r.nextInt(4)); pl.set(x1 - 2, y, z1 - 1, B.furnace, r.nextInt(4));
      pl.set(x0 + 1, y - 1, z1 - 1, B.lava); pl.set(x0 + 2, y - 1, z1 - 1, B.lava);
      pl.chest(x1 - 1, y, z0 + 1, 'smith', [3, 7], r);
    } else if (kind === 'library') {
      for (let x = x0 + 1; x < x1; x++) { pl.set(x, y, z1 - 1, B.bookshelf); pl.set(x, y + 1, z1 - 1, B.bookshelf); }
      pl.set(x1 - 1, y, z0 + 1, B.crafting_table);
    } else if (kind === 'church') {
      pl.walls(x0, y + H, z0, x1, y + H + 6, z1, M.base);
      pl.fill(x0 + 1, y + H, z0 + 1, x1 - 1, y + H + 6, z1 - 1, 0);
      pl.fill(x0, y + H + 7, z0, x1, y + H + 7, z1, M.base);
      pl.set(mx, y + H + 4, z0, B.glass); pl.set(mx, y + H + 4, z1, B.glass);
      pl.set(mx, y + H + 8, mz, B.glowstone);
    } else {
      if (r.next() < 0.5) pl.set(x1 - 1, y, z1 - 1, B.crafting_table);
      if (r.next() < 0.4) pl.chest(x1 - 1, y, z0 + 1, 'village', [2, 5], r);
    }
    return y;
  }

  function village(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const b = ctx.biome(cx, cz), g0 = ctx.h(cx, cz);
    if (g0 < SEA || g0 > 100 || b === BI.FOREST) return null;
    const desert = b === BI.DESERT, snowy = b === BI.TUNDRA;
    const M = desert ? { base: B.sandstone, floor: B.sandstone, wall: B.sandstone, beam: B.chiseled_sandstone, roof: B.sandstone, path: B.sandstone }
      : snowy ? { base: B.cobblestone, floor: B.dark_planks, wall: B.dark_planks, beam: B.dark_log, roof: B.dark_planks, path: B.dirt_path, snow: true }
        : { base: B.cobblestone, floor: B.planks, wall: B.planks, beam: B.log, roof: B.planks, path: B.dirt_path };
    const pl = new Plan('village');
    const y = g0 + 1;
    // well
    pl.foundation(cx - 2, cz - 2, cx + 2, cz + 2, y, B.cobblestone);
    pl.fill(cx - 2, y - 1, cz - 2, cx + 2, y + 4, cz + 2, 0);
    pl.fill(cx - 2, y - 1, cz - 2, cx + 2, y - 1, cz + 2, M.base);
    pl.fill(cx - 1, y - 5, cz - 1, cx + 1, y - 1, cz + 1, M.base);
    pl.fill(cx, y - 4, cz, cx, y - 1, cz, B.water);
    pl.walls(cx - 1, y, cz - 1, cx + 1, y, cz + 1, M.base); pl.set(cx, y, cz, B.water);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pl.fill(cx + dx, y + 1, cz + dz, cx + dx, y + 2, cz + dz, B.fence);
    pl.fill(cx - 1, y + 3, cz - 1, cx + 1, y + 3, cz + 1, M.base);
    const rects = [[cx - 3, cz - 3, cx + 3, cz + 3]];
    const free = (a) => rects.every(q => a[2] + 1 < q[0] || a[0] - 1 > q[2] || a[3] + 1 < q[1] || a[1] - 1 > q[3]);
    const KINDS = ['small', 'small', 'small', 'big', 'big', 'farm', 'farm', 'smith', 'library', 'church', 'lamp'];
    let villagers = 0;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of DIRS) {
      const L = 14 + r.nextInt(14);
      for (let k = 3; k <= L; k++) {
        const px = cx + dx * k, pz = cz + dz * k;
        for (let w = -1; w <= 1; w++) {
          const qx = px + (dz ? w : 0), qz = pz + (dx ? w : 0);
          const gy = ctx.h(qx, qz);
          if (gy < SEA - 1) pl.set(qx, SEA, qz, B.planks);
          else { pl.set(qx, gy, qz, M.path); pl.fill(qx, gy + 1, qz, qx, gy + 2, qz, 0); }
        }
        rects.push([px - 1, pz - 1, px + 1, pz + 1]);
        if (k % 9 === 5) {
          for (const side of [-1, 1]) {
            if (r.next() < 0.3) continue;
            const kind = KINDS[r.nextInt(KINDS.length)];
            if (kind === 'lamp') { const lx = px + (dz ? side * 2 : 0), lz = pz + (dx ? side * 2 : 0); lamp(pl, lx, ctx.h(lx, lz) + 1, lz); continue; }
            const [w, d] = kind === 'small' ? [5, 5] : kind === 'farm' ? [7, 9] : kind === 'church' ? [5, 7] : [7, 7];
            // building centre offset from the road
            const off = 2 + ((dx ? d : w) >> 1) + 1;
            const bxc = px + (dz ? side * off : 0), bzc = pz + (dx ? side * off : 0);
            const W = dx ? w : w, D = dx ? d : d;
            const x0 = bxc - (W >> 1), z0 = bzc - (D >> 1);
            const rect = [x0, z0, x0 + W - 1, z0 + D - 1];
            if (!free(rect)) continue;
            const door = dx ? (side > 0 ? 0 : 1) : (side > 0 ? 2 : 3);
            const hy = house(pl, ctx, M, x0, z0, W, D, door, kind);
            if (hy === null) continue;
            rects.push(rect);
            if (kind !== 'farm') { pl.mob('villager', bxc + 0.5, hy, bzc + 0.5, { v: kind === 'smith' ? 3 : kind === 'library' ? 1 : kind === 'church' ? 2 : r.nextInt(5), home: [cx, y, cz] }); villagers++; }
            else { pl.mob('villager', bxc + 0.5, hy, bzc + 0.5, { v: 0, home: [cx, y, cz] }); villagers++; }
          }
        }
      }
    }
    if (villagers < 2) return null;
    pl.mob('iron_golem', cx + 3.5, y, cz + 0.5, { home: [cx, y, cz] });
    for (const [dx, dz] of DIRS) lamp(pl, cx + dx * 3 + dz * 2, ctx.h(cx + dx * 3 + dz * 2, cz + dz * 3 + dx * 2) + 1, cz + dz * 3 + dx * 2);
    return pl;
  }

  function desertTemple(ctx) {
    const { r, x: cx, z: cz } = ctx;
    if (ctx.biome(cx, cz) !== BI.DESERT) return null;
    const y = ctx.h(cx, cz) + 1;
    if (y < SEA) return null;
    const pl = new Plan('desert_temple');
    const SS = B.sandstone, CS = B.chiseled_sandstone, TC = B.terracotta;
    pl.foundation(cx - 10, cz - 10, cx + 10, cz + 10, y, SS, 16);
    pl.box(cx - 10, y - 1, cz - 10, cx + 10, y + 9, cz + 10, SS, 0);
    for (let k = 0; k < 7; k++) pl.fill(cx - 10 + k, y + 9 + k, cz - 10 + k, cx + 10 - k, y + 9 + k, cz + 10 - k, SS);
    // stripes
    for (const yy of [y + 2, y + 6]) pl.walls(cx - 10, yy, cz - 10, cx + 10, yy, cz + 10, (x, _, z) => ((x + z) % 4 === 0 ? CS : TC));
    // towers
    for (const tx of [cx - 8, cx + 8]) {
      pl.box(tx - 2, y - 1, cz - 10, tx + 2, y + 13, cz - 6, SS, 0);
      pl.set(tx, y + 10, cz - 10, TC); pl.set(tx, y + 11, cz - 10, CS);
      pl.fill(tx - 1, y, cz - 6, tx + 1, y + 2, cz - 6, 0);
    }
    // entrance
    pl.fill(cx - 1, y, cz - 10, cx + 1, y + 3, cz - 10, 0);
    // floor mosaic
    pl.fill(cx - 4, y - 1, cz - 4, cx + 4, y - 1, cz + 4, (x, _, z) => ((Math.abs(x - cx) + Math.abs(z - cz)) % 3 === 0 ? TC : SS));
    pl.set(cx, y - 1, cz, CS);
    // treasure room
    pl.box(cx - 4, y - 14, cz - 4, cx + 4, y - 9, cz + 4, SS, 0);
    pl.fill(cx, y - 8, cz, cx, y - 2, cz, 0);
    pl.fill(cx - 1, y - 15, cz - 1, cx + 1, y - 15, cz + 1, B.tnt);
    pl.fill(cx - 4, y - 14, cz - 4, cx + 4, y - 14, cz + 4, (x, _, z) => ((x + z) % 2 ? TC : SS));
    for (const [dx, dz] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) pl.chest(cx + dx, y - 13, cz + dz, 'temple', [4, 8], r);
    return pl;
  }

  function jungleTemple(ctx) {
    const { r, x: cx, z: cz } = ctx;
    if (ctx.biome(cx, cz) !== BI.SEASONAL) return null;
    const y = ctx.h(cx, cz) + 1;
    if (y < SEA) return null;
    const pl = new Plan('jungle_temple');
    const C = mix(r, B.mossy_cobblestone, B.cobblestone, 0.4);
    pl.foundation(cx - 6, cz - 7, cx + 6, cz + 7, y - 4, B.cobblestone);
    pl.box(cx - 6, y - 4, cz - 7, cx + 6, y + 4, cz + 7, C, 0);
    pl.fill(cx - 5, y, cz - 6, cx + 5, y, cz + 6, C);
    pl.box(cx - 4, y + 4, cz - 5, cx + 4, y + 9, cz + 5, C, 0);
    pl.fill(cx - 3, y + 10, cz - 4, cx + 3, y + 10, cz + 4, C);
    pl.fill(cx - 1, y + 1, cz - 7, cx + 1, y + 3, cz - 7, 0);
    pl.fill(cx - 1, y, cz - 2, cx + 1, y, cz, 0);
    for (let k = 0; k < 4; k++) pl.set(cx, y - 1 - k + 0, cz - 2 - k, C);
    pl.chest(cx + 4, y - 3, cz + 5, 'temple', [3, 7], r);
    pl.chest(cx - 4, y + 5, cz + 3, 'temple', [3, 7], r);
    for (let i = 0; i < 6; i++) pl.set(cx - 5 + r.nextInt(11), y + 1, cz - 6 + r.nextInt(13), B.cobweb, 0, 3);
    return pl;
  }

  function witchHut(ctx) {
    const { r, x: cx, z: cz } = ctx;
    if (ctx.biome(cx, cz) !== BI.FOREST) return null;
    const g = ctx.h(cx, cz);
    if (g < SEA - 1) return null;
    const pl = new Plan('witch_hut');
    const y = g + 4;
    for (const [dx, dz] of [[-3, -4], [3, -4], [-3, 4], [3, 4]]) pl.fill(cx + dx, g - 4, cz + dz, cx + dx, y - 1, cz + dz, B.dark_log);
    pl.fill(cx - 3, y - 1, cz - 4, cx + 3, y - 1, cz + 4, B.dark_planks);
    pl.walls(cx - 3, y, cz - 3, cx + 3, y + 2, cz + 4, B.dark_planks);
    pl.fill(cx - 2, y, cz - 2, cx + 2, y + 2, cz + 3, 0);
    pl.fill(cx - 4, y + 3, cz - 5, cx + 4, y + 3, cz + 5, B.dark_log);
    pl.fill(cx - 3, y + 4, cz - 4, cx + 3, y + 4, cz + 4, B.dark_planks);
    pl.set(cx, y, cz - 3, 0); pl.set(cx, y + 1, cz - 3, 0);
    pl.set(cx - 3, y + 1, cz, B.glass); pl.set(cx + 3, y + 1, cz, B.glass);
    pl.set(cx + 2, y, cz + 3, B.cauldron); pl.set(cx - 2, y, cz + 3, B.crafting_table);
    pl.set(cx - 2, y, cz - 2, B.brown_mushroom, 0, 3);
    pl.mob('witch', cx + 0.5, y, cz + 0.5);
    void r;
    return pl;
  }

  function igloo(ctx) {
    const { r, x: cx, z: cz } = ctx;
    if (ctx.biome(cx, cz) !== BI.TUNDRA) return null;
    const y = ctx.h(cx, cz) + 1;
    if (y < SEA) return null;
    const pl = new Plan('igloo');
    pl.foundation(cx - 4, cz - 4, cx + 4, cz + 6, y, B.snow_block, 4);
    pl.fill(cx - 4, y - 1, cz - 4, cx + 4, y - 1, cz + 4, B.snow_block);
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = 0; dy <= 4; dy++) {
      const d = Math.hypot(dx, dy * 1.15, dz);
      if (d <= 4.3 && d > 3.2) pl.set(cx + dx, y + dy, cz + dz, B.snow_block);
      else if (d <= 3.2) pl.set(cx + dx, y + dy, cz + dz, 0);
    }
    pl.fill(cx - 1, y, cz + 4, cx + 1, y + 2, cz + 6, B.snow_block);
    pl.fill(cx, y, cz + 3, cx, y + 1, cz + 6, 0);
    pl.set(cx - 2, y, cz - 2, B.furnace, 0); pl.set(cx + 2, y, cz - 2, B.crafting_table);
    pl.set(cx - 2, y - 1, cz + 1, B.wool); pl.set(cx - 1, y - 1, cz + 1, B.wool);
    pl.set(cx + 2, y, cz + 1, B.torch, 0);
    pl.chest(cx, y, cz - 3, 'igloo', [2, 5], r);
    return pl;
  }

  function outpost(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const b = ctx.biome(cx, cz);
    if (b !== BI.PLAINS && b !== BI.DESERT && b !== BI.TUNDRA) return null;
    const y = ctx.h(cx, cz) + 1;
    if (y < SEA || y > 100) return null;
    const pl = new Plan('outpost');
    pl.foundation(cx - 3, cz - 3, cx + 3, cz + 3, y, B.cobblestone);
    pl.fill(cx - 3, y - 1, cz - 3, cx + 3, y - 1, cz + 3, B.cobblestone);
    pl.walls(cx - 3, y, cz - 3, cx + 3, y + 15, cz + 3, B.dark_planks);
    pl.fill(cx - 2, y, cz - 2, cx + 2, y + 15, cz + 2, 0);
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) pl.fill(cx + dx, y - 1, cz + dz, cx + dx, y + 17, cz + dz, B.dark_log);
    for (const fy of [y + 5, y + 10]) { pl.fill(cx - 2, fy - 1, cz - 2, cx + 2, fy - 1, cz + 2, B.dark_planks); pl.set(cx + 2, fy - 1, cz + 2, 0); pl.set(cx + 1, fy - 1, cz + 2, 0); }
    for (let k = 0; k < 15; k++) { const ang = Math.floor(k / 5) % 2; pl.set(cx + (ang ? 2 : 1), y + k, cz + 2, B.dark_planks); }
    pl.fill(cx - 4, y + 15, cz - 4, cx + 4, y + 15, cz + 4, B.dark_planks);
    pl.walls(cx - 4, y + 16, cz - 4, cx + 4, y + 16, cz + 4, B.fence);
    pl.fill(cx - 4, y + 19, cz - 4, cx + 4, y + 19, cz + 4, B.dark_planks);
    pl.set(cx - 1, y, cz - 3, 0); pl.set(cx - 1, y + 1, cz - 3, 0);
    for (const [wx, wz] of [[0, -3], [0, 3], [-3, 0], [3, 0]]) { pl.set(cx + wx, y + 7, cz + wz, B.fence); pl.set(cx + wx, y + 12, cz + wz, B.fence); }
    pl.chest(cx, y + 16, cz, 'outpost', [3, 6], r);
    for (let i = 0; i < 3; i++) pl.mob('pillager', cx + 0.5 + i - 1, y + 16, cz - 2 + 0.5);
    pl.mob('pillager', cx + 0.5, y, cz + 0.5);
    // caged golem
    const gx = cx + 9, gz = cz + 2, gy = ctx.h(gx, gz) + 1;
    pl.foundation(gx - 2, gz - 2, gx + 2, gz + 2, gy, B.dark_planks, 4);
    pl.fill(gx - 2, gy - 1, gz - 2, gx + 2, gy - 1, gz + 2, B.dark_planks);
    pl.walls(gx - 2, gy, gz - 2, gx + 2, gy + 3, gz + 2, B.iron_bars);
    pl.fill(gx - 1, gy, gz - 1, gx + 1, gy + 3, gz + 1, 0);
    pl.fill(gx - 2, gy + 4, gz - 2, gx + 2, gy + 4, gz + 2, B.dark_planks);
    pl.mob('iron_golem', gx + 0.5, gy, gz + 0.5);
    return pl;
  }

  function mansion(ctx) {
    const { r, x: cx, z: cz } = ctx;
    if (ctx.biome(cx, cz) !== BI.FOREST) return null;
    const y = ctx.h(cx, cz) + 1;
    if (y < SEA || y > 100) return null;
    const pl = new Plan('mansion');
    const X0 = cx - 15, X1 = cx + 15, Z0 = cz - 11, Z1 = cz + 11;
    pl.foundation(X0, Z0, X1, Z1, y, B.cobblestone, 14);
    pl.fill(X0, y - 1, Z0, X1, y - 1, Z1, B.cobblestone);
    pl.fill(X0, y, Z0, X1, y + 14, Z1, 0);
    for (const fy of [y, y + 6]) {
      pl.walls(X0, fy, Z0, X1, fy + 5, Z1, (x, yy, z) => ((x - X0) % 5 === 0 && (z === Z0 || z === Z1)) || ((z - Z0) % 5 === 0 && (x === X0 || x === X1)) ? B.dark_log : yy === fy + 2 && ((x + z) % 3 === 0) ? B.glass : B.dark_planks);
      pl.fill(X0, fy + 5, Z0, X1, fy + 5, Z1, B.dark_planks);
      pl.fill(X0 + 1, fy + 5, Z0 + 1, X0 + 3, fy + 5, Z0 + 3, fy === y ? 0 : B.dark_planks);
      // rooms
      for (let x = X0 + 8; x < X1; x += 8) pl.fill(x, fy, Z0 + 1, x, fy + 4, Z1 - 1, B.planks);
      pl.fill(X0 + 1, fy, cz, X1 - 1, fy + 4, cz, B.planks);
      for (let x = X0 + 4; x < X1; x += 8) { pl.fill(x, fy, cz, x + 1, fy + 2, cz, 0); }
      for (let x = X0 + 8; x < X1; x += 8) { pl.fill(x, fy, Z0 + 4, x, fy + 2, Z0 + 4, 0); pl.fill(x, fy, Z1 - 4, x, fy + 2, Z1 - 4, 0); }
      for (let x = X0 + 4; x < X1; x += 8) for (const z of [Z0 + 3, Z1 - 3]) pl.set(x, fy + 4, z, B.glowstone);
    }
    for (let k = 0; k < 6; k++) pl.set(X0 + 2 + k, y + k, Z0 + 2, B.dark_planks);
    for (let k = 0; k < 12; k++) pl.fill(X0 - 1 + k, y + 12 + k, Z0 - 1 + k, X1 + 1 - k, y + 12 + k, Z1 + 1 - k, k % 3 === 2 ? B.dark_log : B.dark_planks);
    pl.fill(cx - 1, y, Z0, cx + 1, y + 2, Z0, 0);
    for (let i = 0; i < 4; i++) pl.chest(X0 + 3 + i * 8, y + 6 * (i % 2), Z1 - 2, 'temple', [4, 8], r);
    for (let i = 0; i < 4; i++) pl.mob('vindicator', X0 + 4.5 + i * 7, y + 6 * (i % 2), cz + 2.5);
    pl.mob('witch', cx + 0.5, y + 6, Z0 + 3.5);
    return pl;
  }

  function desertWell(ctx) {
    const { x: cx, z: cz } = ctx;
    if (ctx.biome(cx, cz) !== BI.DESERT) return null;
    const y = ctx.h(cx, cz) + 1;
    if (y < SEA) return null;
    const pl = new Plan('desert_well');
    pl.foundation(cx - 2, cz - 2, cx + 2, cz + 2, y, B.sandstone, 4);
    pl.fill(cx - 2, y - 1, cz - 2, cx + 2, y - 1, cz + 2, B.sandstone);
    pl.fill(cx - 1, y, cz - 1, cx + 1, y, cz + 1, B.sandstone);
    pl.set(cx, y, cz, B.water); pl.set(cx, y - 1, cz, B.water);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pl.fill(cx + dx, y + 1, cz + dz, cx + dx, y + 2, cz + dz, B.sandstone);
    pl.fill(cx - 1, y + 3, cz - 1, cx + 1, y + 3, cz + 1, B.slab);
    pl.set(cx, y + 3, cz, B.sandstone);
    return pl;
  }

  function ruinedPortal(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const nether = ctx.dim === 1;
    let y;
    if (nether) { y = 34 + r.nextInt(50); } else { y = ctx.h(cx, cz) + 1; if (y < SEA) return null; }
    const pl = new Plan('ruined_portal');
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
      if (Math.hypot(dx, dz) > 5 - r.next() * 1.5) continue;
      const gy = nether ? y - 1 : ctx.h(cx + dx, cz + dz);
      pl.set(cx + dx, gy, cz + dz, r.next() < 0.15 ? B.magma_block : r.next() < 0.3 ? B.gold_block * 0 + B.netherrack : B.netherrack);
    }
    if (nether) { pl.fill(cx - 3, y - 1, cz - 2, cx + 3, y - 1, cz + 2, B.blackstone); pl.fill(cx - 3, y, cz - 2, cx + 3, y + 6, cz + 2, 0); }
    pl.foundation(cx - 2, cz - 1, cx + 3, cz + 1, y, B.netherrack, 6);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
      const edge = i === 0 || i === 3 || j === 0 || j === 4;
      const x = cx - 1 + i, yy = y + j;
      if (!edge) { pl.set(x, yy, cz, 0); continue; }
      if (r.next() < 0.18) continue;
      pl.set(x, yy, cz, r.next() < 0.25 ? B.crying_obsidian : B.obsidian);
    }
    pl.set(cx + 3, y, cz + 2, B.gold_block);
    pl.chest(cx - 3, y, cz + 2, 'ruined', [4, 8], r);
    return pl;
  }

  function shipwreck(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const g = ctx.h(cx, cz);
    if (ctx.top(cx, cz) < SEA || g > SEA - 5 || g < 20) return null;
    const pl = new Plan('shipwreck');
    const y = g + 1;
    const W = (yy) => (yy <= SEA ? B.water : 0);
    const broken = () => r.next() < 0.15;
    for (let z = -9; z <= 9; z++) {
      const half = Math.abs(z) > 6 ? 1 : 2;
      for (let x = -half; x <= half; x++) if (!broken()) pl.set(cx + x, y, cz + z, B.planks);
      for (let yy = y + 1; yy <= y + 3; yy++) {
        if (!broken()) { pl.set(cx - half - 1, yy, cz + z, B.dark_planks); pl.set(cx + half + 1, yy, cz + z, B.dark_planks); }
        for (let x = -half; x <= half; x++) pl.set(cx + x, yy, cz + z, W(yy));
      }
      if (Math.abs(z) < 7 && !broken()) pl.fill(cx - half, y + 4, cz + z, cx + half, y + 4, cz + z, B.planks);
    }
    pl.fill(cx - 2, y + 5, cz + 4, cx + 2, y + 7, cz + 7, B.dark_planks);
    pl.fill(cx - 1, y + 5, cz + 5, cx + 1, y + 6, cz + 6, W(y + 5));
    pl.fill(cx, y + 5, cz - 1, cx, y + 13, cz - 1, B.log);
    pl.chest(cx, y + 5, cz + 6, 'ship', [4, 8], r);
    pl.chest(cx + 1, y + 1, cz - 6, 'buried', [3, 6], r);
    pl.mob('drowned', cx + 0.5, y + 1, cz + 0.5);
    return pl;
  }

  function monument(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const g = ctx.h(cx, cz);
    if (ctx.top(cx, cz) < SEA || g > SEA - 14) return null;
    const pl = new Plan('monument');
    const y0 = Math.max(10, g - 1), top = SEA - 3;
    const P = mix(r, B.prismarine_bricks, B.prismarine, 0.3);
    pl.foundation(cx - 14, cz - 14, cx + 14, cz + 14, y0, B.prismarine, 8);
    pl.box(cx - 14, y0, cz - 14, cx + 14, top, cz + 14, P, B.water);
    for (const [dx, dz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) pl.fill(cx + dx - 1, y0, cz + dz - 1, cx + dx + 1, top + 2, cz + dz + 1, B.dark_prismarine);
    for (let fy = y0 + 6; fy < top - 2; fy += 6) pl.fill(cx - 13, fy, cz - 13, cx + 13, fy, cz + 13, (x, _, z) => (Math.abs(x - cx) < 4 && Math.abs(z - cz) < 4) ? B.water : ((x + z) % 6 === 0 ? B.sea_lantern : B.prismarine_bricks));
    pl.box(cx - 3, y0 + 1, cz - 3, cx + 3, y0 + 5, cz + 3, B.dark_prismarine, B.water);
    pl.fill(cx - 1, y0 + 2, cz - 1, cx + 1, y0 + 3, cz, B.gold_block);
    pl.fill(cx - 2, y0 + 1, cz - 14, cx + 2, y0 + 5, cz - 14, B.water);
    pl.fill(cx - 1, y0 + 1, cz - 3, cx + 1, y0 + 3, cz - 3, B.water);
    for (let i = -10; i <= 10; i += 5) for (let j = -10; j <= 10; j += 5) pl.set(cx + i, y0 + 1, cz + j, B.sea_lantern);
    pl.fill(cx - 4, top + 1, cz - 4, cx + 4, top + 2, cz + 4, B.dark_prismarine);
    pl.set(cx, top + 3, cz, B.sea_lantern);
    for (let i = 0; i < 5; i++) pl.mob('guardian', cx + (r.next() - 0.5) * 20, y0 + 3 + r.nextInt(10), cz + (r.next() - 0.5) * 20);
    pl.chest(cx + 2, y0 + 1, cz + 2, 'monument', [3, 5], r);
    return pl;
  }

  function mineshaft(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const g = ctx.h(cx, cz);
    const y0 = 16 + r.nextInt(20);
    if (g < y0 + 12) return null;
    const pl = new Plan('mineshaft');
    pl.fill(cx - 3, y0 - 1, cz - 3, cx + 3, y0 - 1, cz + 3, B.dirt, 0, 1);
    pl.fill(cx - 3, y0, cz - 3, cx + 3, y0 + 3, cz + 3, 0);
    let pieces = 0;
    const corridor = (x, y, z, dx, dz, depth) => {
      if (depth > 4 || pieces++ > 26) return;
      const len = 10 + r.nextInt(18);
      for (let k = 0; k < len; k++) {
        const px = x + dx * k, pz = z + dz * k;
        if (Math.abs(px - cx) > 72 || Math.abs(pz - cz) > 72) return;
        for (let w = -1; w <= 1; w++) {
          const qx = px + dz * w, qz = pz + dx * w;
          pl.set(qx, y - 1, qz, B.planks, 0, 1);
          pl.fill(qx, y, qz, qx, y + 2, qz, 0);
        }
        pl.set(px, y, pz, B.rail, 0);
        if (k % 4 === 2) {
          pl.fill(px + dz, y, pz + dx, px + dz, y + 1, pz + dx, B.fence);
          pl.fill(px - dz, y, pz - dx, px - dz, y + 1, pz - dx, B.fence);
          pl.fill(px - dz, y + 2, pz - dx, px + dz, y + 2, pz + dx, B.planks);
          if (r.next() < 0.1) pl.set(px + dz, y + 1, pz + dx, B.torch, 0, 3);
        }
        if (r.next() < 0.06) pl.set(px + dz * (r.next() < 0.5 ? 1 : -1), y + 2, pz + dx * (r.next() < 0.5 ? 1 : -1), B.cobweb);
        if (r.next() < 0.01) pl.chest(px + dz, y, pz + dx, 'mineshaft', [3, 7], r);
        if (r.next() < 0.004) pl.spawner(px - dz, y, pz - dx, 'spider');
      }
      const ex = x + dx * len, ez = z + dz * len;
      const n = 1 + r.nextInt(3);
      for (let i = 0; i < n; i++) {
        const t = r.nextInt(3);
        if (t === 0) corridor(ex, y, ez, dx, dz, depth + 1);
        else if (t === 1) corridor(ex, y, ez, dz, dx, depth + 1);
        else corridor(ex, y, ez, -dz, -dx, depth + 1);
      }
    };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (r.next() < 0.8) corridor(cx + dx * 4, y0, cz + dz * 4, dx, dz, 0);
    return pl;
  }

  function fossil(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const g = ctx.h(cx, cz);
    if (ctx.biome(cx, cz) !== BI.DESERT || g < SEA) return null;
    const pl = new Plan('fossil');
    const y = g - 12 - r.nextInt(8);
    for (let i = -5; i <= 5; i++) {
      pl.set(cx + i, y, cz, B.bone_block);
      if (i % 2 === 0 && Math.abs(i) < 5) for (const s of [-1, 1]) { pl.set(cx + i, y, cz + s, B.bone_block); pl.set(cx + i, y + 1, cz + 2 * s, B.bone_block); pl.set(cx + i, y + 2, cz + 2 * s, B.bone_block); pl.set(cx + i, y + 3, cz + s, B.bone_block); }
    }
    pl.fill(cx + 6, y, cz - 1, cx + 8, y + 2, cz + 1, B.bone_block);
    return pl;
  }

  function buriedTreasure(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const g = ctx.h(cx, cz);
    if (g < SEA - 2 || g > SEA + 1 || ctx.biome(cx, cz) === BI.TUNDRA) return null;
    const pl = new Plan('buried_treasure');
    pl.chest(cx, g - 2, cz, 'buried', [4, 8], r, [DL.Items.stack(388, 2 + r.nextInt(4))]);
    return pl;
  }

  /* ------------------------------------------------------------ */
  /* Stronghold with the End portal room                          */
  /* ------------------------------------------------------------ */
  function stronghold(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const pl = new Plan('stronghold');
    const y = 26;
    const SB = () => { const v = r.next(); return v < 0.2 ? B.mossy_stone_bricks : v < 0.35 ? B.cracked_stone_bricks : B.stone_bricks; };
    const corridor = (x0, z0, x1, z1) => {
      const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
      pl.box(ax - 2, y - 1, az - 2, bx + 2, y + 3, bz + 2, SB, 0);
      for (let x = ax; x <= bx; x += 6) for (let z = az; z <= bz; z += 6) pl.set(x, y + 2, z, B.torch, 0, 0);
    };
    // portal room (x -5..5, z 0..15 relative)
    const X = cx, Z = cz;
    pl.box(X - 5, y - 1, Z, X + 5, y + 7, Z + 15, SB, 0);
    pl.fill(X - 3, y, Z + 5, X + 3, y, Z + 13, SB);
    pl.fill(X - 1, y, Z + 8, X + 1, y, Z + 10, B.lava);
    for (let i = -1; i <= 1; i++) {
      pl.set(X + i, y + 1, Z + 7, B.end_portal_frame, r.next() < 0.1 ? 4 : 0);
      pl.set(X + i, y + 1, Z + 11, B.end_portal_frame, r.next() < 0.1 ? 4 : 0);
      pl.set(X - 2, y + 1, Z + 9 + i, B.end_portal_frame, r.next() < 0.1 ? 4 : 0);
      pl.set(X + 2, y + 1, Z + 9 + i, B.end_portal_frame, r.next() < 0.1 ? 4 : 0);
    }
    pl.fill(X - 1, y + 1, Z + 4, X + 1, y + 1, Z + 4, SB);
    pl.spawner(X, y + 1, Z + 3, 'silverfish');
    for (const [dx, dz] of [[-4, 2], [4, 2], [-4, 13], [4, 13]]) pl.set(X + dx, y, Z + dz, B.torch, 0);
    pl.fill(X - 1, y, Z, X + 1, y + 2, Z, 0);
    // hub
    const hz = Z - 24;
    corridor(X, Z - 1, X, hz + 5);
    pl.box(X - 5, y - 1, hz - 5, X + 5, y + 5, hz + 5, SB, 0);
    pl.fill(X - 1, y, hz - 1, X + 1, y + 4, hz + 1, B.stone_bricks);
    pl.fill(X, y, hz + 5, X, y + 2, hz + 5, 0);
    // library
    corridor(X - 6, hz, X - 22, hz);
    const lx = X - 32;
    pl.box(lx - 7, y - 1, hz - 7, lx + 7, y + 7, hz + 7, SB, 0);
    for (let x = lx - 6; x <= lx + 6; x++) for (const z of [hz - 6, hz + 6]) pl.fill(x, y, z, x, y + 3, z, B.bookshelf);
    for (let z = hz - 3; z <= hz + 3; z += 3) pl.fill(lx - 3, y, z, lx + 3, y + 2, z, B.bookshelf);
    pl.fill(lx + 7, y, hz - 1, lx + 7, y + 2, hz + 1, 0);
    pl.chest(lx - 5, y, hz - 4, 'stronghold', [4, 8], r);
    pl.chest(lx + 5, y, hz + 4, 'stronghold', [3, 6], r, [DL.Items.stack(340, 3)]);
    // store room & prison
    corridor(X + 6, hz, X + 22, hz);
    const sx = X + 28;
    pl.box(sx - 5, y - 1, hz - 5, sx + 5, y + 4, hz + 5, SB, 0);
    pl.fill(sx - 5, y, hz - 1, sx - 5, y + 2, hz + 1, 0);
    pl.chest(sx + 3, y, hz - 3, 'stronghold', [4, 8], r);
    pl.chest(sx + 3, y, hz + 3, 'stronghold', [4, 8], r);
    for (const cz2 of [hz - 3, hz + 3]) { pl.walls(sx - 3, y, cz2 - 1, sx - 1, y + 2, cz2 + 1, B.iron_bars); pl.fill(sx - 2, y, cz2, sx - 2, y + 2, cz2, 0); }
    // fountain + stairway up
    corridor(X, hz - 6, X, hz - 20);
    const fz = hz - 26;
    pl.box(X - 5, y - 1, fz - 5, X + 5, y + 6, fz + 5, SB, 0);
    pl.fill(X - 1, y, fz - 1, X + 1, y, fz + 1, SB);
    pl.fill(X, y, fz, X, y + 3, fz, SB);
    pl.set(X, y + 4, fz, B.water);
    pl.fill(X, y, fz + 5, X, y + 2, fz + 5, 0);
    for (let k = 0; k < 34; k++) {
      const sxz = X + 5 - k % 10 * 0, sy = y + k;
      void sxz;
      const px = X - 4 + (k % 8), pz = fz - 4 + Math.floor(k / 8) % 2 * 8;
      pl.fill(px, sy, pz, px, sy + 3, pz, 0);
      pl.set(px, sy - 1, pz, B.stone_bricks, 0, 1);
    }
    return pl;
  }
  /** Stronghold portal-room centres for a seed (block coordinates). */
  St.strongholds = function (seed) {
    const r = new S.RNG(seed ^ 0x57a0);
    const out = [];
    const base = r.next() * Math.PI * 2;
    for (let i = 0; i < 3; i++) {
      const a = base + i * Math.PI * 2 / 3, d = 560 + r.nextInt(400);
      const x = Math.round(Math.cos(a) * d / 16) * 16 + 8, z = Math.round(Math.sin(a) * d / 16) * 16 + 8;
      out.push([x, 27, z + 9]);
    }
    return out;
  };

  /* ------------------------------------------------------------ */
  /* Builders: Nether                                             */
  /* ------------------------------------------------------------ */
  function fortress(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const pl = new Plan('fortress');
    const y = 64;
    const NB = B.nether_bricks, NF = B.nether_brick_fence;
    const arm = (dx, dz, len) => {
      for (let k = -len; k <= len; k++) {
        const px = cx + dx * k, pz = cz + dz * k;
        for (let w = -2; w <= 2; w++) {
          const qx = px + dz * w, qz = pz + dx * w;
          pl.set(qx, y - 1, qz, NB);
          pl.set(qx, y - 2, qz, NB);
          const enclosed = Math.abs(k) < 14;
          if (Math.abs(w) === 2) {
            if (enclosed) { pl.fill(qx, y, qz, qx, y + 3, qz, k % 3 === 0 ? NF : NB); pl.set(qx, y + 1, qz, k % 3 === 0 ? NF : NB); }
            else pl.set(qx, y, qz, NF);
          } else pl.fill(qx, y, qz, qx, y + 3, qz, 0);
          if (enclosed) pl.set(qx, y + 4, qz, NB);
        }
        if (k % 10 === 0 && Math.abs(k) >= 14) for (const w of [-2, 2]) { const qx = px + dz * w, qz = pz + dx * w; pl.fill(qx, 20, qz, qx, y - 3, qz, NB, 0, 1); }
      }
    };
    arm(1, 0, 40); arm(0, 1, 40);
    // central hall with nether wart garden
    pl.box(cx - 6, y - 1, cz - 6, cx + 6, y + 6, cz + 6, NB, 0);
    for (const [dx, dz] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) pl.fill(cx + dx - (dz ? 1 : 0), y, cz + dz - (dx ? 1 : 0), cx + dx + (dz ? 1 : 0), y + 2, cz + dz + (dx ? 1 : 0), 0);
    for (let x = cx - 4; x <= cx + 4; x++) for (const z of [cz - 4, cz + 4]) { pl.set(x, y - 1, z, B.soul_sand); pl.set(x, y, z, B.nether_wart, 1 + r.nextInt(3)); }
    pl.spawner(cx, y, cz, 'wither_skeleton');
    pl.chest(cx - 5, y, cz - 2, 'fortress', [2, 5], r);
    pl.chest(cx + 5, y, cz + 2, 'fortress', [2, 5], r);
    // blaze spawner platform at the end of the +x arm
    const bx = cx + 44;
    pl.fill(bx - 4, y - 1, cz - 4, bx + 4, y - 1, cz + 4, NB);
    pl.fill(bx - 4, y, cz - 4, bx + 4, y + 4, cz + 4, 0);
    pl.walls(bx - 4, y, cz - 4, bx + 4, y, cz + 4, NF);
    pl.fill(bx - 4, y, cz - 1, bx - 4, y, cz + 1, 0);
    pl.fill(bx - 1, y, cz - 1, bx + 1, y, cz + 1, NB);
    pl.spawner(bx, y + 1, cz, 'blaze');
    pl.fill(bx - 1, 20, cz - 1, bx + 1, y - 2, cz + 1, NB, 0, 1);
    pl.mob('blaze', bx + 2.5, y + 1, cz + 0.5);
    for (let i = 0; i < 3; i++) pl.mob('wither_skeleton', cx + 0.5 + (i - 1) * 8, y, cz + 0.5 + (i % 2 ? 10 : -10));
    pl.chest(cx + 20, y, cz - 1, 'fortress', [2, 5], r);
    return pl;
  }

  function bastion(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const pl = new Plan('bastion');
    const y = 36 + r.nextInt(12);
    const BS = mix(r, B.polished_blackstone_bricks, B.blackstone, 0.35);
    pl.fill(cx - 12, y - 6, cz - 12, cx + 12, y + 20, cz + 12, 0);
    pl.box(cx - 10, y - 1, cz - 10, cx + 10, y + 16, cz + 10, BS, 0);
    pl.fill(cx - 10, 10, cz - 10, cx + 10, y - 2, cz + 10, B.blackstone, 0, 1);
    for (const fy of [y + 5, y + 10]) {
      pl.fill(cx - 9, fy, cz - 9, cx + 9, fy, cz + 9, (x, _, z) => (Math.abs(x - cx) < 3 && Math.abs(z - cz) < 3) ? 0 : BS());
      for (let k = 0; k < 5; k++) pl.set(cx - 9 + k, fy - 5 + k + 1, cz + 8, B.polished_blackstone_bricks);
      pl.fill(cx - 9, fy, cz + 8, cx - 5, fy, cz + 8, 0);
    }
    for (const [dx, dz] of [[-10, 0], [10, 0], [0, -10], [0, 10]]) pl.fill(cx + dx - (dz ? 1 : 0), y, cz + dz - (dx ? 1 : 0), cx + dx + (dz ? 1 : 0), y + 3, cz + dz + (dx ? 1 : 0), 0);
    pl.walls(cx - 10, y + 16, cz - 10, cx + 10, y + 17, cz + 10, B.gilded_blackstone);
    pl.fill(cx - 1, y, cz - 1, cx + 1, y + 1, cz + 1, B.gold_block);
    pl.set(cx, y + 2, cz, B.gold_block);
    for (const [dx, dz] of [[-7, -7], [7, 7]]) { pl.fill(cx + dx - 1, y - 1, cz + dz - 1, cx + dx + 1, y - 1, cz + dz + 1, B.lava); }
    for (let i = 0; i < 10; i++) pl.set(cx - 9 + r.nextInt(19), y + 1 + r.nextInt(15), cz - 10 + (r.next() < 0.5 ? 0 : 20), B.gilded_blackstone);
    pl.chest(cx + 3, y, cz, 'bastion', [5, 9], r);
    pl.chest(cx - 6, y + 6, cz - 6, 'bastion', [4, 8], r);
    pl.chest(cx + 6, y + 11, cz + 6, 'bastion', [4, 8], r);
    for (let i = 0; i < 6; i++) pl.mob('piglin', cx - 6 + r.nextInt(13) + 0.5, y + (i % 3) * 5 + (i % 3 ? 1 : 0), cz - 6 + r.nextInt(13) + 0.5);
    pl.mob('magma_cube', cx + 5.5, y, cz - 5.5, { v: 2 });
    return pl;
  }

  /* ------------------------------------------------------------ */
  /* Builders: the End                                            */
  /* ------------------------------------------------------------ */
  function endCity(ctx) {
    const { r, x: cx, z: cz } = ctx;
    if (Math.hypot(cx, cz) < 400 || ctx.biome(cx, cz) !== 1) return null;
    const g = ctx.h(cx, cz);
    if (g < 45) return null;
    const pl = new Plan('end_city');
    const y = g + 1;
    const PB = B.purpur_block, PP = B.purpur_pillar, ES = B.end_stone_bricks;
    pl.foundation(cx - 5, cz - 5, cx + 5, cz + 5, y, ES, 10);
    // base house
    pl.box(cx - 5, y - 1, cz - 5, cx + 5, y + 5, cz + 5, PB, 0);
    pl.fill(cx - 1, y, cz - 5, cx + 1, y + 2, cz - 5, 0);
    for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) pl.fill(cx + dx, y - 1, cz + dz, cx + dx, y + 6, cz + dz, PP);
    // tower
    const T = 26 + r.nextInt(10);
    pl.box(cx - 3, y + 5, cz - 3, cx + 3, y + T, cz + 3, PB, 0);
    for (let fy = y + 5; fy < y + T; fy += 7) {
      pl.fill(cx - 2, fy, cz - 2, cx + 2, fy, cz + 2, PB);
      pl.set(cx + 2, fy, cz + 2, 0); pl.set(cx + 1, fy, cz + 2, 0);
      for (const [dx, dz] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) pl.set(cx + dx, fy + 3, cz + dz, B.glass);
      for (const [dx, dz] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) pl.set(cx + dx, fy + 4, cz + dz, B.end_rod);
      if (r.next() < 0.6) pl.mob('shulker', cx - 1.5, fy + 1, cz - 1.5);
    }
    for (let k = 0; k < T - 5; k++) pl.set(cx + (k % 4 < 2 ? 2 : 1), y + 5 + k, cz + (k % 4 === 1 || k % 4 === 2 ? 2 : 1), PB, 0, 3);
    pl.fill(cx - 3, y + 6, cz - 3, cx - 3, y + 6, cz - 3, 0);
    // top room
    const ty = y + T;
    pl.box(cx - 6, ty, cz - 6, cx + 6, ty + 6, cz + 6, PB, 0);
    pl.fill(cx - 2, ty, cz - 2, cx + 2, ty, cz + 2, PB);
    pl.set(cx + 2, ty, cz + 2, 0); pl.set(cx + 1, ty, cz + 2, 0);
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) pl.fill(cx + dx, ty, cz + dz, cx + dx, ty + 8, cz + dz, PP);
    pl.fill(cx - 5, ty + 7, cz - 5, cx + 5, ty + 7, cz + 5, PB);
    pl.set(cx, ty + 8, cz, B.end_rod);
    for (const [dx, dz] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) pl.fill(cx + dx - (dz ? 1 : 0), ty + 2, cz + dz - (dx ? 1 : 0), cx + dx + (dz ? 1 : 0), ty + 3, cz + dz + (dx ? 1 : 0), B.glass);
    pl.chest(cx - 4, ty + 1, cz + 4, 'end_city', [4, 8], r);
    pl.chest(cx + 4, ty + 1, cz - 4, 'end_city', [4, 8], r);
    pl.mob('shulker', cx + 3.5, ty + 1, cz + 3.5); pl.mob('shulker', cx - 3.5, ty + 1, cz - 3.5);
    // end ship
    if (r.next() < 0.7) {
      const sx = cx + 26, sy = ty + 6 + r.nextInt(8), sz = cz;
      for (let x = -11; x <= 11; x++) {
        const half = Math.abs(x) > 8 ? 1 : Math.abs(x) > 5 ? 2 : 3;
        pl.fill(sx + x, sy, sz - half + 1, sx + x, sy, sz + half - 1, PB);
        for (let yy = sy + 1; yy <= sy + 3; yy++) { pl.set(sx + x, yy, sz - half, PB); pl.set(sx + x, yy, sz + half, PB); }
        pl.fill(sx + x, sy + 4, sz - half, sx + x, sy + 4, sz + half, x > -9 ? ES : PB);
        pl.fill(sx + x, sy + 1, sz - half + 1, sx + x, sy + 3, sz + half - 1, 0);
      }
      pl.fill(sx - 2, sy + 5, sz, sx - 2, sy + 14, sz, PP);
      pl.set(sx - 2, sy + 15, sz, B.end_rod);
      pl.fill(sx - 6, sy + 12, sz - 3, sx + 2, sy + 12, sz + 3, B.wool);
      pl.fill(sx + 12, sy + 3, sz, sx + 14, sy + 3, sz, PB);
      pl.set(sx + 12, sy + 4, sz, B.end_rod);
      pl.set(sx + 3, sy + 4, sz, 0);
      pl.chest(sx + 5, sy + 1, sz - 1, 'end_city', [4, 8], r, [DL.Items.stack(443)]);
      pl.chest(sx + 5, sy + 1, sz + 1, 'end_city', [4, 8], r);
      pl.set(sx + 8, sy + 1, sz, B.dragon_egg * 0 + B.obsidian);
      pl.mob('shulker', sx - 4.5, sy + 5, sz + 0.5); pl.mob('shulker', sx + 7.5, sy + 1, sz + 0.5);
    }
    return pl;
  }

  /** Fixed End features: obsidian spikes with crystals and the exit fountain. */
  function endCenter(ctx) {
    const pl = new Plan('end_spikes');
    const fy = ctx.world.endFountainY;
    const r = new S.RNG(ctx.world.seed ^ 0xe5d);
    const hs = [76, 79, 82, 85, 88, 91, 94, 97, 100, 103];
    for (let i = hs.length - 1; i > 0; i--) { const j = r.nextInt(i + 1); const t = hs[i]; hs[i] = hs[j]; hs[j] = t; }
    for (let i = 0; i < 10; i++) {
      const a = 2 * (-Math.PI + Math.PI / 10 * i);
      const x = Math.floor(42 * Math.cos(a)), z = Math.floor(42 * Math.sin(a));
      const rad = 2 + (i % 3), top = hs[i];
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (dx * dx + dz * dz <= rad * rad + 1) pl.fill(x + dx, 30, z + dz, x + dx, top, z + dz, B.obsidian);
      pl.set(x, top + 1, z, B.bedrock);
      if (top < 82) { pl.walls(x - 2, top + 1, z - 2, x + 2, top + 4, z + 2, B.iron_bars); pl.fill(x - 2, top + 5, z - 2, x + 2, top + 5, z + 2, B.iron_bars); }
      pl.mob('end_crystal', x + 0.5, top + 2, z + 0.5);
    }
    // exit fountain frame (the portal lights up when the dragon dies)
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 4.3) continue;
      pl.set(dx, fy - 1, dz, B.bedrock);
      if (d > 3.3) pl.set(dx, fy, dz, B.bedrock);
      else pl.set(dx, fy, dz, 0);
    }
    pl.fill(0, fy, 0, 0, fy + 3, 0, B.bedrock);
    return pl;
  }
  St.lightExitPortal = function (world, egg) {
    const fy = world.endFountainY;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      if (Math.hypot(dx, dz) > 3.3 || (dx === 0 && dz === 0)) continue;
      world.setBlock(dx, fy, dz, B.end_portal, 0, 3);
    }
    if (egg && world.getBlock(0, fy + 4, 0) === 0) world.setBlock(0, fy + 4, 0, B.dragon_egg, 0, 3);
    // a gateway to the outer islands
    const gx = 0, gy = fy + 12, gz = 96;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) world.setBlock(gx + dx, gy + dy, gz + dz, (dx === 0 && dz === 0) ? B.end_portal : B.bedrock, dx === 0 && dz === 0 ? 1 : 0, 3);
    world.setBlock(gx, gy - 1, gz, B.bedrock, 0, 3); world.setBlock(gx, gy + 1, gz, B.bedrock, 0, 3);
  };

  /* ------------------------------------------------------------ */
  /* Builders: the Aether                                         */
  /* ------------------------------------------------------------ */
  function bronzeDungeon(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const g = ctx.h(cx, cz);
    if (g < 60) return null;
    const pl = new Plan('bronze_dungeon');
    const y = g - 12;
    const W = mix(r, B.holystone_bricks, B.mossy_holystone, 0.3);
    pl.box(cx - 7, y - 1, cz - 7, cx + 7, y + 8, cz + 7, W, 0);
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) pl.set(cx + dx, y + 7, cz + dz, B.glowstone);
    pl.chest(cx + 5, y, cz + 5, 'aether', [5, 9], r);
    pl.chest(cx - 5, y, cz + 5, 'aether', [3, 6], r);
    pl.mob('slider', cx + 0.5, y, cz + 0.5);
    for (let k = 7; k < 26; k++) pl.fill(cx + k, y, cz, cx + k, y + 2, cz + 1, 0);
    pl.fill(cx + 7, y - 1, cz, cx + 26, y - 1, cz + 1, B.holystone_bricks, 0, 1);
    return pl;
  }
  function silverTemple(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const g = ctx.h(cx, cz);
    if (g < 60) return null;
    const pl = new Plan('silver_temple');
    const y = g + 1;
    pl.foundation(cx - 8, cz - 8, cx + 8, cz + 8, y, B.holystone, 6);
    pl.fill(cx - 8, y - 1, cz - 8, cx + 8, y - 1, cz + 8, B.holystone_bricks);
    pl.fill(cx - 8, y, cz - 8, cx + 8, y + 12, cz + 8, 0);
    for (let x = cx - 8; x <= cx + 8; x += 4) for (const z of [cz - 8, cz + 8]) pl.fill(x, y, z, x, y + 8, z, B.holystone_bricks);
    for (let z = cz - 4; z <= cz + 4; z += 4) for (const x of [cx - 8, cx + 8]) pl.fill(x, y, z, x, y + 8, z, B.holystone_bricks);
    pl.fill(cx - 8, y + 9, cz - 8, cx + 8, y + 9, cz + 8, B.holystone_bricks);
    for (let k = 1; k < 5; k++) pl.fill(cx - 8 + k * 2, y + 9 + k, cz - 8 + k * 2, cx + 8 - k * 2, y + 9 + k, cz + 8 - k * 2, k % 2 ? B.zanite_block * 0 + B.holystone_bricks : B.icestone);
    pl.fill(cx - 2, y, cz - 2, cx + 2, y, cz + 2, B.icestone);
    pl.set(cx, y + 1, cz, B.glowstone);
    pl.chest(cx + 6, y, cz, 'aether', [4, 8], r);
    pl.chest(cx - 6, y, cz, 'aether', [4, 8], r);
    pl.mob('zephyr', cx + 0.5, y + 20, cz + 0.5);
    return pl;
  }

  /* ------------------------------------------------------------ */
  /* Registry                                                     */
  /* ------------------------------------------------------------ */
  const TYPES = [
    { name: 'village', dim: 0, spacing: 22, sep: 6, radius: 3, chance: 0.9, salt: 0x5a1, build: village },
    { name: 'desert_temple', dim: 0, spacing: 20, sep: 6, radius: 1, chance: 1, salt: 0x5a2, build: desertTemple },
    { name: 'jungle_temple', dim: 0, spacing: 20, sep: 6, radius: 1, chance: 1, salt: 0x5a3, build: jungleTemple },
    { name: 'witch_hut', dim: 0, spacing: 18, sep: 6, radius: 1, chance: 1, salt: 0x5a4, build: witchHut },
    { name: 'igloo', dim: 0, spacing: 16, sep: 5, radius: 1, chance: 1, salt: 0x5a5, build: igloo },
    { name: 'outpost', dim: 0, spacing: 26, sep: 8, radius: 1, chance: 0.8, salt: 0x5a6, build: outpost },
    { name: 'mansion', dim: 0, spacing: 48, sep: 12, radius: 2, chance: 1, salt: 0x5a7, build: mansion },
    { name: 'desert_well', dim: 0, spacing: 10, sep: 2, radius: 1, chance: 0.5, salt: 0x5a8, build: desertWell },
    { name: 'ruined_portal', dim: 0, spacing: 20, sep: 6, radius: 1, chance: 1, salt: 0x5a9, build: ruinedPortal },
    { name: 'shipwreck', dim: 0, spacing: 14, sep: 4, radius: 1, chance: 1, salt: 0x5aa, build: shipwreck },
    { name: 'monument', dim: 0, spacing: 26, sep: 6, radius: 2, chance: 1, salt: 0x5ab, build: monument },
    { name: 'mineshaft', dim: 0, spacing: 12, sep: 2, radius: 5, chance: 0.5, salt: 0x5ac, build: mineshaft },
    { name: 'fossil', dim: 0, spacing: 14, sep: 4, radius: 1, chance: 0.5, salt: 0x5ad, build: fossil },
    { name: 'buried_treasure', dim: 0, spacing: 10, sep: 2, radius: 0, chance: 0.4, salt: 0x5ae, build: buriedTreasure },
    { name: 'fortress', dim: 1, spacing: 14, sep: 4, radius: 4, chance: 1, salt: 0x6b1, build: fortress },
    { name: 'bastion', dim: 1, spacing: 18, sep: 5, radius: 1, chance: 1, salt: 0x6b2, build: bastion },
    { name: 'ruined_portal', dim: 1, spacing: 16, sep: 4, radius: 1, chance: 1, salt: 0x6b3, build: ruinedPortal },
    { name: 'end_city', dim: 2, spacing: 12, sep: 4, radius: 3, chance: 1, salt: 0x7c1, build: endCity },
    { name: 'bronze_dungeon', dim: 3, spacing: 10, sep: 3, radius: 2, chance: 0.8, salt: 0x8d1, build: bronzeDungeon },
    { name: 'silver_temple', dim: 3, spacing: 16, sep: 4, radius: 1, chance: 1, salt: 0x8d2, build: silverTemple }
  ];
  St.TYPES = TYPES;

  function ctxFor(world, x, z, seed) {
    const hm = (bx, bz) => {
      const cx = bx >> 4, cz = bz >> 4, k = cx + ',' + cz;
      let m = world._hmCache.get(k);
      if (!m) {
        m = world.gen.heightMap(cx, cz);
        world._hmCache.set(k, m);
        if (world._hmCache.size > 400) world._hmCache.delete(world._hmCache.keys().next().value);
      }
      return m;
    };
    return {
      world, dim: world.dim || 0, x, z, r: new S.RNG(seed),
      h: (bx, bz) => hm(bx, bz).h[((bz & 15) << 4) | (bx & 15)],
      top: (bx, bz) => hm(bx, bz).top[((bz & 15) << 4) | (bx & 15)],
      biome: (bx, bz) => { const b = hm(bx, bz).biomes; return b ? b[((bz & 15) << 4) | (bx & 15)] : 0; }
    };
  }
  function getPlan(world, key, build) {
    if (!world._plans) { world._plans = new Map(); world._hmCache = new Map(); }
    if (world._plans.has(key)) return world._plans.get(key);
    let p = null;
    try { p = build(); } catch (e) { console.warn('structure failed', key, e); p = null; }
    world._plans.set(key, p);
    return p;
  }
  /** Every plan that could touch chunk (cx, cz). */
  St.plansFor = function (world, cx, cz) {
    const out = [];
    const dim = world.dim || 0, seed = world.seed;
    if (!world._plans) { world._plans = new Map(); world._hmCache = new Map(); }
    for (const T of TYPES) {
      if (T.dim !== dim) continue;
      const sp = T.spacing, R = T.radius;
      for (let gx = Math.floor((cx - R) / sp); gx <= Math.floor((cx + R) / sp); gx++) {
        for (let gz = Math.floor((cz - R) / sp); gz <= Math.floor((cz + R) / sp); gz++) {
          const r = new S.RNG(S.hash2(seed ^ T.salt, gx, gz));
          if (r.next() > T.chance) continue;
          const scx = gx * sp + r.nextInt(sp - T.sep), scz = gz * sp + r.nextInt(sp - T.sep);
          if (Math.abs(cx - scx) > R || Math.abs(cz - scz) > R) continue;
          if (dim === 0 && T.name !== 'mineshaft' && Math.abs(scx) < 2 && Math.abs(scz) < 2) continue;
          const key = T.name + dim + ':' + gx + ',' + gz;
          const p = getPlan(world, key, () => T.build(ctxFor(world, scx * 16 + 8, scz * 16 + 8, S.hash2(seed ^ (T.salt * 7), gx, gz))));
          if (p) out.push(p);
        }
      }
    }
    if (dim === 0) {
      St.strongholds(seed).forEach((s, i) => {
        const sx = s[0], sz = s[2] - 9;
        if (Math.abs(cx - (sx >> 4)) > 4 || Math.abs(cz - (sz >> 4)) > 4) return;
        const p = getPlan(world, 'stronghold' + i, () => stronghold(ctxFor(world, sx, sz, seed ^ (0x5f00 + i))));
        if (p) out.push(p);
      });
    }
    if (dim === 2 && Math.abs(cx) <= 4 && Math.abs(cz) <= 4) {
      if (world.endFountainY === undefined) St.endFountain(world);
      const p = getPlan(world, 'end_center', () => endCenter(ctxFor(world, 0, 0, seed)));
      if (p) out.push(p);
    }
    return out;
  };
  St.endFountain = function (world) {
    const hm = world.gen.heightMap(0, 0);
    world.endFountainY = Math.max(50, hm.h[0] + 1);
    return world.endFountainY;
  };

  /** Write the structure pieces that fall inside a freshly generated chunk. */
  St.apply = function (world, c) {
    let plans;
    try { plans = St.plansFor(world, c.cx, c.cz); } catch (e) { console.warn('structures', e); return; }
    for (const pl of plans) {
      const ops = pl.ops.get(c.key);
      if (ops) {
        const bl = c.blocks, me = c.meta;
        for (let i = 0; i < ops.length; i += 6) {
          const x = ops[i], y = ops[i + 1], z = ops[i + 2], id = ops[i + 3], meta = ops[i + 4], mode = ops[i + 5];
          const idx = (y << 8) | ((z & 15) << 4) | (x & 15);
          const cur = bl[idx];
          if (mode === 1 && SOLID[cur] && !LIQUID[cur]) continue;
          if (mode === 3 && cur !== 0) continue;
          bl[idx] = id; me[idx] = meta;
        }
      }
      for (const t of pl.tiles) if ((t.x >> 4) === c.cx && (t.z >> 4) === c.cz) world.setTile(t.x, t.y, t.z, JSON.parse(JSON.stringify(t.te)));
      for (const m of pl.mobs) {
        if ((Math.floor(m.x) >> 4) !== c.cx || (Math.floor(m.z) >> 4) !== c.cz) continue;
        if (!world.pendingAnimals) world.pendingAnimals = new Map();
        if (!world.pendingAnimals.has(c.key)) world.pendingAnimals.set(c.key, []);
        world.pendingAnimals.get(c.key).push(Object.assign({}, m));
      }
    }
  };

  /** Nearest structure start of a type (for /locate). */
  St.locate = function (world, name, x, z) {
    const dim = world.dim || 0;
    if (name === 'stronghold') {
      let best = null;
      for (const s of St.strongholds(world.seed)) { const d = Math.hypot(s[0] - x, s[2] - z); if (!best || d < best[3]) best = [s[0], s[1], s[2], d]; }
      return best;
    }
    const T = TYPES.find(t => t.name === name && t.dim === dim);
    if (!T) return null;
    const pcx = Math.floor(x / 16), pcz = Math.floor(z / 16), sp = T.spacing;
    let best = null;
    for (let ring = 0; ring < 8; ring++) {
      for (let gx = Math.floor(pcx / sp) - ring; gx <= Math.floor(pcx / sp) + ring; gx++) for (let gz = Math.floor(pcz / sp) - ring; gz <= Math.floor(pcz / sp) + ring; gz++) {
        if (Math.max(Math.abs(gx - Math.floor(pcx / sp)), Math.abs(gz - Math.floor(pcz / sp))) !== ring) continue;
        const r = new S.RNG(S.hash2(world.seed ^ T.salt, gx, gz));
        if (r.next() > T.chance) continue;
        const scx = gx * sp + r.nextInt(sp - T.sep), scz = gz * sp + r.nextInt(sp - T.sep);
        const key = T.name + dim + ':' + gx + ',' + gz;
        const p = getPlan(world, key, () => T.build(ctxFor(world, scx * 16 + 8, scz * 16 + 8, S.hash2(world.seed ^ (T.salt * 7), gx, gz))));
        if (!p) continue;
        const d = Math.hypot(scx * 16 + 8 - x, scz * 16 + 8 - z);
        if (!best || d < best[3]) best = [scx * 16 + 8, 0, scz * 16 + 8, d];
      }
      if (best) return best;
    }
    return best;
  };
})();
