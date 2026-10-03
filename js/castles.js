/*
 * DreamLand - giant castles.
 * Rare, huge and different every time: a moat and a drawbridge, a gatehouse with
 * a portcullis, a curtain wall with a walk along the battlements, round corner
 * towers with spiral stairs and pointed roofs, square towers along the walls, a
 * courtyard with barracks, stables, a forge, a chapel, a kitchen, a well, a garden
 * and a training yard, and a great keep in the middle: a great hall with a throne,
 * a library and an armoury, bedchambers, a council room, a rooftop with turrets,
 * and below it a dungeon with cells and a treasure vault.
 * Royal castles are lived in (guards, villagers, horses); ruined ones are broken,
 * mossy and full of cobwebs and monsters; dark castles are haunted.
 */
(function () {
  'use strict';
  const DL = window.DL;
  const S = DL.S, B = S.B, St = DL.Structures, BI = S.BIOME, SEA = S.SEA, CH = S.CH, I = DL.Items;
  const Frame = St.Frame;

  /* ------------------------------------------------------------ */
  /* Loot                                                         */
  /* ------------------------------------------------------------ */
  Object.assign(St.LOOT, {
    castle_armory: [['iron_sword', 1, 1, 8], ['diamond_sword', 1, 1, 2], ['bow', 1, 1, 6], ['arrow', 8, 24, 10], ['iron_helmet', 1, 1, 5], ['iron_chestplate', 1, 1, 5],
      ['iron_leggings', 1, 1, 5], ['iron_boots', 1, 1, 5], ['diamond_chestplate', 1, 1, 1], ['shield', 1, 1, 4], ['iron_horse_armor', 1, 1, 3], ['saddle', 1, 1, 3], ['iron_ingot', 2, 8, 6]],
    castle_treasure: [['gold_ingot', 4, 12, 10], ['gold_block', 1, 3, 5], ['diamond', 2, 6, 6], ['emerald', 3, 9, 6], ['golden_apple', 1, 2, 4], ['diamond_horse_armor', 1, 1, 2],
      ['golden_horse_armor', 1, 1, 3], ['diamond_pickaxe', 1, 1, 2], ['diamond_helmet', 1, 1, 2], ['ender_pearl', 1, 3, 3], ['gold_nugget', 6, 20, 8], ['echo_shard', 1, 3, 2]],
    castle_kitchen: [['bread', 2, 6, 10], ['steak', 1, 5, 8], ['cooked_chicken', 1, 4, 6], ['apple', 2, 6, 8], ['pumpkin_pie', 1, 3, 5], ['cooked_mutton', 1, 4, 5], ['sugar', 2, 6, 4], ['wheat', 4, 12, 6]],
    castle_library: [['book', 2, 6, 10], ['paper', 4, 12, 8], ['bookshelf', 1, 3, 4], ['ender_pearl', 1, 1, 2], ['compass', 1, 1, 3], ['clock', 1, 1, 3], ['map', 1, 1, 2], ['experience_bottle', 1, 4, 3]]
  });

  /* ------------------------------------------------------------ */
  /* Styles                                                       */
  /* ------------------------------------------------------------ */
  const STYLES = {
    stone: { wall: B.stone_bricks, mossy: B.mossy_stone_bricks, cracked: B.cracked_stone_bricks, pillar: B.stone_bricks, base: B.cobblestone, base2: B.mossy_cobblestone, stairs: B.stone_brick_stairs,
      floor: B.dark_planks, beam: B.dark_log, roof: B.dark_stairs, roofFull: B.dark_planks, chairs: B.dark_stairs, banner: [B.red_wool, B.blue_wool], court: B.grass, path: B.dirt_path, moat: B.water },
    blue: { wall: B.stone_bricks, mossy: B.mossy_stone_bricks, cracked: B.cracked_stone_bricks, pillar: B.stone_bricks, base: B.cobblestone, base2: B.mossy_cobblestone, stairs: B.stone_brick_stairs,
      floor: B.spruce_planks, beam: B.spruce_log, roof: B.brick_stairs, roofFull: B.bricks, chairs: B.spruce_stairs, banner: [B.blue_wool, B.wool], court: B.grass, path: B.dirt_path, moat: B.water },
    desert: { wall: B.sandstone, mossy: B.sandstone, cracked: B.sandstone, pillar: B.chiseled_sandstone, base: B.sandstone, base2: B.sandstone, stairs: B.sandstone_stairs,
      floor: B.acacia_planks, beam: B.chiseled_sandstone, roof: B.sandstone_stairs, roofFull: B.yellow_terracotta, chairs: B.wood_stairs, banner: [B.red_wool, B.orange_terracotta], court: B.sand, path: B.sandstone, moat: null },
    snow: { wall: B.stone_bricks, mossy: B.cracked_stone_bricks, cracked: B.cracked_stone_bricks, pillar: B.stone_bricks, base: B.cobblestone, base2: B.stone_bricks, stairs: B.stone_brick_stairs,
      floor: B.spruce_planks, beam: B.spruce_log, roof: B.spruce_stairs, roofFull: B.spruce_planks, chairs: B.spruce_stairs, banner: [B.blue_wool, B.wool], court: B.snow_block, path: B.dirt_path, moat: B.packed_ice, snow: true },
    dark: { wall: B.polished_blackstone_bricks, mossy: B.blackstone, cracked: B.blackstone, pillar: B.polished_blackstone_bricks, base: B.blackstone, base2: B.blackstone, stairs: B.nether_brick_stairs,
      floor: B.dark_planks, beam: B.dark_log, roof: B.nether_brick_stairs, roofFull: B.nether_bricks, chairs: B.dark_stairs, banner: [B.red_wool, B.red_wool], court: B.podzol, path: B.coarse_dirt, moat: B.water, haunted: true }
  };
  function styleFor(b, r) {
    switch (b) {
      case BI.DESERT: case BI.BADLANDS: case BI.SAVANNA: case BI.SAVANNA_PLATEAU: return STYLES.desert;
      case BI.TUNDRA: case BI.SNOWY_TAIGA: case BI.SNOWY_SLOPES: case BI.GROVE: return STYLES.snow;
      case BI.DARK_FOREST: case BI.PALE_GARDEN: return STYLES.dark;
      case BI.PLAINS: case BI.SUNFLOWER_PLAINS: case BI.FOREST: case BI.BIRCH_FOREST: case BI.MEADOW: case BI.FLOWER_FOREST: case BI.SEASONAL:
      case BI.TAIGA: case BI.OLD_GROWTH_TAIGA: case BI.WINDSWEPT_HILLS: case BI.WINDSWEPT_FOREST: case BI.CHERRY_GROVE: case BI.OLD_GROWTH_BIRCH:
        return r.next() < 0.5 ? STYLES.stone : STYLES.blue;
    }
    return null;
  }

  /* ------------------------------------------------------------ */
  /* The castle                                                   */
  /* ------------------------------------------------------------ */
  // Local plan (lx across, lz from the gate to the back, ly up from the courtyard):
  // curtain wall 0..2 and N-3..N-1; keep KX0..KX1 x KZ0..KZ1; the gate at the front middle.
  const RW = 35, N = RW * 2 + 1, MID = RW;
  const HW = 12;                 // curtain wall height (the walk is at ly = HW)
  const MOAT = [4, 8];           // moat between these distances outside the wall
  const KX0 = MID - 12, KX1 = MID + 12, KZ0 = 30, KZ1 = 54, KZM = (KZ0 + KZ1) >> 1;
  const FLOORS = [0, 7, 13, 19], TOP = 25, DUNGEON = -9;

  function castle(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const st = styleFor(ctx.biome(cx, cz), r);
    if (!st) return null;
    // never on top of a village
    if (St.startNear && St.startNear(ctx.world, 'village', cx, cz, 170)) return null;
    // a site: dry, and not a mountain range
    const hs = [];
    let wet = 0;
    for (let dx = -RW - 8; dx <= RW + 8; dx += 6) for (let dz = -RW - 8; dz <= RW + 8; dz += 6) { const h = ctx.h(cx + dx, cz + dz); if (h < SEA) wet++; hs.push(h); }
    hs.sort((a, b) => a - b);
    const lo = hs[Math.floor(hs.length * 0.1)], hi = hs[Math.floor(hs.length * 0.9)];
    if (wet > hs.length * 0.08 || hi - lo > 22) return null;
    const Y = Math.min(CH - 60, Math.max(SEA + 2, hs[Math.floor(hs.length * 0.7)] + 1));
    const kind = st.haunted ? 'haunted' : r.next() < 0.6 ? 'royal' : 'ruined';
    const ruined = kind !== 'royal';
    const pl = new St.Plan('castle');
    const face = r.nextInt(4);
    const F = new Frame(pl, [cx - RW, cz - RW, cx + RW, cz + RW], face, Y);
    const seed = r.nextInt(1 << 30);
    const hsh = (a, b, c) => (S.hash2(seed ^ Math.imul(c + 1, 0x9e3779b1), a, b) >>> 0) & 1023;
    // brick: mostly whole, some mossy, some cracked (more when ruined)
    const brick = (lx, ly, lz) => { const v = hsh(lx, lz, ly); return v < (ruined ? 260 : 50) ? st.mossy : v < (ruined ? 420 : 110) ? st.cracked : st.wall; };
    // ruins lose the tops of their walls in places
    const breach = (lx, lz) => { if (!ruined) return 0; const v = hsh(lx >> 2, lz >> 2, 77); return v < 190 ? 2 + (v % 7) : 0; };
    const wallAt = (lx, ly, lz, top) => { if (ruined && ly > top - breach(lx, lz)) return; F.set(lx, ly, lz, brick(lx, ly, lz)); };
    const inWall = (lx, lz) => lx >= 0 && lz >= 0 && lx < N && lz < N && (lx <= 2 || lx >= N - 3 || lz <= 2 || lz >= N - 3);
    const people = [];
    const claims = pl.claims = new Map();
    const spawner = (lx, ly, lz, mob) => pl.spawner(F.wx(lx, lz), Y + ly, F.wz(lx, lz), mob);

    /* ---- ground: a level platform, a moat, the land eased toward it ---- */
    for (let lx = -MOAT[1] - 12; lx < N + MOAT[1] + 12; lx++) for (let lz = -MOAT[1] - 12; lz < N + MOAT[1] + 12; lz++) {
      const wx = F.wx(lx, lz), wz = F.wz(lx, lz), g = ctx.h(wx, wz);
      const out = Math.max(-lx, lx - (N - 1), -lz, lz - (N - 1), 0);
      claims.set(wx + ',' + wz, Math.min(Y - 1, g));
      if (out > MOAT[1] + 1) { blendTo(pl, ctx, wx, wz, Y - 1, out - MOAT[1] - 1); continue; }
      if (out >= MOAT[0] && out <= MOAT[1] && st.moat) {
        const deep = out === MOAT[0] || out === MOAT[1] ? 2 : 4;
        F.fill(lx, -deep - 4, lz, lx, -deep - 2, lz, st.base, 0, 1);
        F.fill(lx, -deep - 1, lz, lx, -1, lz, st.moat);
        if (g >= Y) F.fill(lx, 0, lz, lx, g - Y + 1, lz, 0);
        continue;
      }
      // the castle's own hill, with a stone rim round the moat
      if (g < Y - 1) F.fill(lx, g - Y, lz, lx, -2, lz, out > 0 ? st.base : B.dirt, 0, 1);
      else if (g >= Y) F.fill(lx, 0, lz, lx, g - Y + 1, lz, 0);
      F.set(lx, -1, lz, out === MOAT[1] + 1 || (out > 0 && out < MOAT[0] && !st.moat) ? st.base2 : out > 0 ? (st.court === B.sand ? B.sand : B.grass) : st.court);
    }

    /* ---- the curtain wall: three thick, a walk on top, merlons outside ---- */
    for (let lx = 0; lx < N; lx++) for (let lz = 0; lz < N; lz++) {
      if (!inWall(lx, lz)) continue;
      F.fill(lx, -9, lz, lx, -2, lz, st.base, 0, 1);
      for (let ly = -1; ly < HW; ly++) wallAt(lx, ly, lz, HW - 1);
      const outer = lx === 0 || lx === N - 1 || lz === 0 || lz === N - 1;
      if (outer && (lx + lz) % 2 === 0) wallAt(lx, HW, lz, HW + 1);
      if (outer && (lx + lz) % 6 === 3) F.set(lx, HW - 3, lz, B.iron_bars);
    }
    // stairs up to the walk on both sides of the courtyard
    for (const lx of [3, N - 4]) for (let i = 0; i < HW; i++) {
      const lz = 14 + i;
      F.fill(lx, -1, lz, lx, i - 1, lz, st.wall);
      F.stairs(lx, i, lz, st.stairs, 1);
      F.fill(lx, i + 1, lz, lx, i + 3, lz, 0);
    }

    /* ---- towers ---- */
    const disc = (dx, dz, rr) => dx * dx + dz * dz <= rr * rr + rr * 0.8;
    const discEdge = (dx, dz, rr) => !disc(dx + 1, dz, rr) || !disc(dx - 1, dz, rr) || !disc(dx, dz + 1, rr) || !disc(dx, dz - 1, rr);
    function spiral(tx, tz, y0, y1) {
      const ring = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      F.fill(tx, y0, tz, tx, y1 + 1, tz, st.pillar);
      for (let ly = y0; ly <= y1; ly++) {
        const i = (ly - y0) % 8, c = ring[i], n = ring[(i + 1) % 8];
        const d = n[0] > c[0] ? 3 : n[0] < c[0] ? 2 : n[1] > c[1] ? 1 : 0;
        F.fill(tx + c[0], ly + 1, tz + c[1], tx + c[0], ly + 3, tz + c[1], 0);
        F.stairs(tx + c[0], ly, tz + c[1], st.stairs, d);
      }
    }
    function coneRoof(tx, tz, y, R) {
      let ly = y;
      for (let rr = R; rr >= 1; rr--, ly++) {
        for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
          if (!disc(dx, dz, rr)) continue;
          if (!discEdge(dx, dz, rr)) { if (rr === R) F.set(tx + dx, ly, tz + dz, st.floor); continue; }
          // the high side points to the middle
          const d = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 2 : 3) : (dz > 0 ? 0 : 1);
          F.stairs(tx + dx, ly, tz + dz, st.roof, d);
          if (st.snow) F.set(tx + dx, ly + 1, tz + dz, B.snow_layer, 0, 3);
        }
      }
      F.set(tx, ly, tz, st.roofFull);
      flag(tx, ly + 1, tz);
    }
    function flag(lx, ly, lz) {
      for (let k = 0; k < 4; k++) F.set(lx, ly + k, lz, B.fence);
      const [a, b] = st.banner;
      F.set(lx + 1, ly + 3, lz, a); F.set(lx + 2, ly + 3, lz, b); F.set(lx + 1, ly + 2, lz, b); F.set(lx + 2, ly + 2, lz, a);
    }
    function roundTower(tx, tz, R, H, cone) {
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
        if (!disc(dx, dz, R)) continue;
        const edge = discEdge(dx, dz, R), lx = tx + dx, lz = tz + dz;
        F.fill(lx, -12, lz, lx, -2, lz, st.base, 0, 1);
        F.set(lx, -1, lz, edge ? brick(lx, -1, lz) : st.floor);
        for (let ly = 0; ly < H; ly++) {
          if (edge) {
            const slit = (dx === 0 || dz === 0) && ly % 6 === 3 && ly > 2;
            if (slit) F.set(lx, ly, lz, B.iron_bars); else wallAt(lx, ly, lz, H - 1);
          } else F.set(lx, ly, lz, ly === HW - 1 || ly === 5 ? st.floor : 0);
        }
        if (!cone) { F.set(lx, H, lz, edge ? brick(lx, H, lz) : st.floor); if (edge && (dx + dz) % 2 === 0) wallAt(lx, H + 1, lz, H + 2); }
      }
      // openings onto the wall walk where the wall meets the tower
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!inWall(tx + dx * (R + 1), tz + dz * (R + 1))) continue;
        for (let k = 1; k <= R; k++) F.fill(tx + dx * k, HW, tz + dz * k, tx + dx * k, HW + 1, tz + dz * k, 0);
      }
      // a door into the courtyard, on the side facing the middle
      const sx = tx < MID ? 1 : -1, sz = tz < MID ? 1 : -1;
      F.fill(tx + sx * 4, 0, tz + sz * 3, tx + sx * 4, 1, tz + sz * 3, 0);
      F.fill(tx + sx * 3, 0, tz + sz * 3, tx + sx * 3, 1, tz + sz * 3, 0);
      spiral(tx, tz, 0, (cone ? H : H) - 1);
      if (cone) coneRoof(tx, tz, H, R + 1);
      else flag(tx + 2, H + 1, tz);
      for (const ly of [2, HW + 1]) { F.set(tx + sx * 3, ly, tz - sz, B.lantern); F.set(tx - sx, ly, tz + sz * 3, B.lantern); }
      if (ruined) { F.set(tx + 2, 7, tz - 2, B.cobweb, 0, 3); F.set(tx - 2, HW + 2, tz + 2, B.cobweb, 0, 3); }
      if (kind === 'haunted' || (ruined && r.next() < 0.5)) spawner(tx - sx * 2, 6, tz - sz * 2, r.next() < 0.5 ? 'skeleton' : 'spider');
    }
    function squareTower(tx, tz, h, H) {
      const inward = tx === 2 ? [1, 0] : tx === N - 3 ? [-1, 0] : [0, -1];
      for (let dx = -h; dx <= h; dx++) for (let dz = -h; dz <= h; dz++) {
        const lx = tx + dx, lz = tz + dz, edge = Math.abs(dx) === h || Math.abs(dz) === h;
        F.fill(lx, -12, lz, lx, -2, lz, st.base, 0, 1);
        F.set(lx, -1, lz, edge ? brick(lx, -1, lz) : st.floor);
        for (let ly = 0; ly < H; ly++) {
          if (edge) { if ((dx === 0 || dz === 0) && ly % 5 === 3 && ly > 2) F.set(lx, ly, lz, B.iron_bars); else wallAt(lx, ly, lz, H - 1); }
          else F.set(lx, ly, lz, ly === HW - 1 ? st.floor : 0);
        }
        F.set(lx, H, lz, edge ? brick(lx, H, lz) : st.floor);
        if (edge && (dx + dz) % 2 === 0) wallAt(lx, H + 1, lz, H + 2);
        if (Math.abs(dx) === h && Math.abs(dz) === h) { wallAt(lx, H + 1, lz, H + 3); wallAt(lx, H + 2, lz, H + 3); F.set(lx, H + 3, lz, B.lantern); }
      }
      // through it along the wall walk, a door to the courtyard, spiral stairs
      const along = inward[0] ? [0, 1] : [1, 0];
      for (let k = -h; k <= h; k++) F.fill(tx + along[0] * k, HW, tz + along[1] * k, tx + along[0] * k, HW + 1, tz + along[1] * k, 0);
      F.fill(tx + inward[0] * h, 0, tz + inward[1] * h, tx + inward[0] * h, 1, tz + inward[1] * h, 0);
      spiral(tx, tz, 0, H - 1);
      F.set(tx + along[0] * 2 + inward[0] * 2, 2, tz + along[1] * 2 + inward[1] * 2, B.lantern);
      flag(tx, H + 2, tz);
      if (!ruined) F.chest(tx - along[0] * 2 - inward[0] * 2, 0, tz - along[1] * 2 - inward[1] * 2, 'castle_armory', [2, 4], r, 0);
      else spawner(tx - along[0] * 2 - inward[0] * 2, 0, tz - along[1] * 2 - inward[1] * 2, 'zombie');
    }
    [[2, 2], [N - 3, 2], [2, N - 3], [N - 3, N - 3]].forEach(([tx, tz], i) => roundTower(tx, tz, 5, 22 + r.nextInt(5), i < 2 || r.next() < 0.6));
    for (const [tx, tz] of [[2, MID], [N - 3, MID], [MID, N - 3]]) squareTower(tx, tz, 3, 17);

    /* ---- the gatehouse, the portcullis and the drawbridge ---- */
    {
      const g0 = MID - 6, g1 = MID + 6, gz0 = -3, gz1 = 5, GH = 18;
      for (let lx = g0; lx <= g1; lx++) for (let lz = gz0; lz <= gz1; lz++) {
        const passage = lx >= MID - 2 && lx <= MID + 2;
        const outer = lx === g0 || lx === g1 || lz === gz0 || lz === gz1;
        const edge = outer || lx === MID - 3 || lx === MID + 3;
        F.fill(lx, -12, lz, lx, -2, lz, st.base, 0, 1);
        for (let ly = -1; ly < GH; ly++) {
          if (passage && ly < 6) { F.set(lx, ly, lz, ly === -1 ? st.path : 0); continue; }
          if (ly === -1 || ly === 6 || ly === HW) { F.set(lx, ly, lz, edge ? brick(lx, ly, lz) : st.floor); continue; }
          F.set(lx, ly, lz, edge ? brick(lx, ly, lz) : 0);
        }
        F.set(lx, GH, lz, outer ? brick(lx, GH, lz) : st.floor);
        if (outer && (lx + lz) % 2 === 0) wallAt(lx, GH + 1, lz, GH + 2);
      }
      // the arch, with the portcullis raised (its spikes showing)
      for (let lx = MID - 2; lx <= MID + 2; lx++) { F.set(lx, 5, gz0, brick(lx, 5, gz0)); F.set(lx, 4, gz0, B.iron_bars); F.set(lx, 5, gz1, brick(lx, 5, gz1)); }
      // murder holes over the passage, windows, lanterns
      for (let lz = gz0 + 2; lz < gz1; lz += 2) F.set(MID, 6, lz, B.iron_bars);
      for (const lx of [MID - 5, MID + 5]) { F.set(lx, 9, gz0, B.iron_bars); F.set(lx, 15, gz0, B.iron_bars); }
      F.set(MID - 3, 3, gz0 - 1, B.lantern, 0, 3); F.set(MID + 3, 3, gz0 - 1, B.lantern, 0, 3);
      F.set(MID, 4, gz1 - 1, B.lantern, 1);
      // ladders inside the side rooms, doors to the courtyard and onto the walk
      for (const lx of [MID - 5, MID + 5]) {
        for (let ly = 0; ly <= GH; ly++) F.ladder(lx, ly, gz1 - 1, 1);
        const dlx = lx + (lx < MID ? 1 : -1);
        F.fill(dlx, 0, gz1, dlx, 1, gz1, 0);
        F.fill(lx, HW + 1, gz1, lx + (lx < MID ? 1 : -1), HW + 2, gz1, 0);
      }
      for (const lx of [g0, g1]) F.fill(lx, HW + 1, 1, lx, HW + 2, 1, 0);
      flag(MID, GH + 1, gz0 + 1);
      // banners either side of the arch
      for (const lx of [MID - 4, MID + 4]) for (let ly = 7; ly < 12; ly++) F.set(lx, ly, gz0, st.banner[ly % 2]);
      // the drawbridge over the moat, with chains, and a road leading in
      for (let lz = gz0 - 1; lz >= -MOAT[1] - 1; lz--) for (let lx = MID - 2; lx <= MID + 2; lx++) {
        const side = lx === MID - 2 || lx === MID + 2;
        F.set(lx, -1, lz, side ? st.beam : st.floor);
        F.fill(lx, 0, lz, lx, 4, lz, 0);
        if (side && lz > -MOAT[1]) F.set(lx, 0, lz, B.fence);
      }
      for (const lx of [MID - 2, MID + 2]) for (let k = 0; k < 4; k++) F.set(lx, 4 - k, gz0 - 1 - k, B.iron_bars);
      for (let lz = -MOAT[1] - 2; lz >= -MOAT[1] - 18; lz--) for (let lx = MID - 1; lx <= MID + 1; lx++) {
        const wx = F.wx(lx, lz), wz = F.wz(lx, lz), g = Math.round(ctx.h(wx, wz) + (Y - 1 - ctx.h(wx, wz)) * Math.max(0, 1 - (-lz - MOAT[1] - 2) / 16));
        pl.set(wx, g, wz, st.path); pl.fill(wx, g + 1, wz, wx, g + 3, wz, 0); pl.fill(wx, g - 4, wz, wx, g - 1, wz, B.dirt, 0, 1);
      }
    }

    /* ---- the courtyard ---- */
    for (let lz = 6; lz < KZ0 - 1; lz++) for (let lx = MID - 1; lx <= MID + 1; lx++) F.set(lx, -1, lz, st.path);
    for (let lx = 6; lx < N - 6; lx++) F.set(lx, -1, KZ0 - 4, st.path);
    // a well
    {
      const wx = MID - 9, wz = 13;
      F.fill(wx - 1, -6, wz - 1, wx + 1, -1, wz + 1, st.base);
      F.fill(wx, -5, wz, wx, -1, wz, B.water);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) F.set(wx + dx, 0, wz + dz, st.base);
      F.set(wx, 0, wz, B.water);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F.fill(wx + dx, 1, wz + dz, wx + dx, 2, wz + dz, B.fence);
      F.fill(wx - 1, 3, wz - 1, wx + 1, 3, wz + 1, st.roofFull); F.set(wx, 4, wz, B.lantern);
    }
    // a training yard: dummies, hay and a weapons rack
    for (let k = 0; k < 6; k++) { const lx = MID + 6 + (k % 3) * 3, lz = 10 + (k >> 1 & ~0) * 0 + (k >= 3 ? 5 : 0); F.set(lx, 0, lz, B.fence); F.set(lx, 1, lz, B.hay_bale); F.set(lx, 2, lz, B.pumpkin, F.dir(0)); }
    for (let lx = MID + 5; lx <= MID + 14; lx++) for (const lz of [8, 17]) F.set(lx, 0, lz, B.fence);
    F.set(MID + 15, 0, 9, B.hay_bale); F.set(MID + 15, 1, 9, B.hay_bale); F.set(MID + 15, 0, 10, B.hay_bale);
    // a garden with flowers and a little tree
    for (let lx = MID - 13; lx <= MID - 5; lx++) for (let lz = 18; lz <= 24; lz++) {
      const edge = lx === MID - 13 || lx === MID - 5 || lz === 18 || lz === 24;
      if (edge) { F.set(lx, -1, lz, st.path); continue; }
      F.set(lx, -1, lz, st.court === B.sand ? B.grass : st.court === B.snow_block ? B.grass : B.grass);
      if (hsh(lx, lz, 5) < 600) F.set(lx, 0, lz, [B.rose, B.dandelion, B.cornflower, B.allium, B.lily_of_the_valley, B.pink_tulip][hsh(lx, lz, 6) % 6], 0, 3);
    }
    for (let ly = 0; ly < 4; ly++) F.set(MID - 9, ly, 21, B.log);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let ly = 3; ly <= 5; ly++) if (Math.abs(dx) + Math.abs(dz) + (ly - 3) < 4 && (dx || dz || ly > 3)) F.set(MID - 9 + dx, ly, 21 + dz, B.leaves, 0, 3);
    // lamp posts round the courtyard
    for (let k = 8; k < N - 8; k += 8) for (const [lx, lz] of [[k, 5], [5, k], [N - 6, k]]) {
      if (lz === 5 && Math.abs(lx - MID) < 8) continue;
      if ((lx === 5 || lx === N - 6) && lz > 10 && lz < 30) continue;
      F.set(lx, 0, lz, B.fence); F.set(lx, 1, lz, B.fence); F.set(lx, 2, lz, B.lantern);
    }

    /* ---- buildings along the walls ---- */
    lean(7, 40, 8, 14, 'barracks');      // left, toward the back
    stables(N - 11, 6, 7, 17);           // right, by the gate
    forge(N - 12, 40, 9, 9);             // right
    lean(N - 12, 51, 9, 11, 'kitchen');  // right, at the back
    chapel(10, 55, 9, 11);               // left, at the back

    function lean(x0, z0, w, d, what) {
      const x1 = x0 + w - 1, z1 = z0 + d - 1, H = 6;
      const outward = x0 < MID ? -1 : 1;   // the roof rises toward the curtain wall
      const roofY = (k) => H + Math.floor(k / 1.5);
      for (let lx = x0; lx <= x1; lx++) for (let lz = z0; lz <= z1; lz++) {
        const edge = lx === x0 || lx === x1 || lz === z0 || lz === z1;
        F.set(lx, -1, lz, st.floor);
        for (let ly = 0; ly < H; ly++) F.set(lx, ly, lz, edge ? (ly === 0 ? st.base : (lx + lz) % 4 === 0 && ly === 2 ? B.glass : brick(lx, ly, lz)) : 0);
      }
      for (let k = 0; k <= w + 1; k++) {
        const lx = outward < 0 ? x1 + 1 - k : x0 - 1 + k;
        for (let lz = z0 - 1; lz <= z1 + 1; lz++) F.stairs(lx, roofY(k), lz, st.roof, outward < 0 ? 2 : 3);
        // fill the gable ends under the slope
        if (lx >= x0 && lx <= x1) for (const lz of [z0, z1]) for (let ly = H; ly < roofY(k); ly++) F.set(lx, ly, lz, brick(lx, ly, lz));
        if (lx >= x0 && lx <= x1) for (let lz = z0 + 1; lz < z1; lz++) for (let ly = H; ly < roofY(k); ly++) F.set(lx, ly, lz, 0);
      }
      const door = outward < 0 ? x1 : x0, dz = z0 + (d >> 1);
      F.door(door, 0, dz, outward < 0 ? 3 : 2);
      if (what === 'barracks') {
        const bx = outward < 0 ? x0 + 1 : x1 - 1;
        for (let lz = z0 + 1; lz < z1 - 1; lz += 3) { F.set(bx, 0, lz, B.red_wool); F.set(bx, 0, lz + 1, B.wool); F.set(bx + (outward < 0 ? 2 : -2), 0, lz, B.barrel); }
        F.chest(x0 + (w >> 1), 0, z1 - 1, 'castle_armory', [3, 6], r, 0);
        F.chest(x0 + (w >> 1), 0, z0 + 1, 'castle_armory', [3, 6], r, 1);
      } else {
        F.facing(x0 + 1, 0, z1 - 1, B.furnace, 0); F.facing(x0 + 2, 0, z1 - 1, B.furnace, 0); F.set(x0 + 3, 0, z1 - 1, B.crafting_table); F.set(x0 + 1, 0, z0 + 1, B.cauldron);
        for (let k = 0; k < 4; k++) F.chest(x1 - 1, 0, z0 + 2 + k, 'castle_kitchen', [2, 5], r, 0, B.barrel);
        F.set(x0 + 4, 0, z0 + 3, B.hay_bale); F.set(x0 + 4, 1, z0 + 3, B.hay_bale);
      }
      for (let lz = z0 + 2; lz < z1; lz += 4) F.set(x0 + (w >> 1), 3, lz, B.lantern);
      if (!ruined) for (let k = 0; k < (what === 'barracks' ? 3 : 1); k++) people.push(['villager', x0 + (w >> 1), z0 + 3 + k * 4, what === 'barracks' ? 3 : 0]);
      else { F.set(x0 + 1, 3, z0 + 1, B.cobweb, 0, 3); F.set(x1 - 1, 4, z1 - 2, B.cobweb, 0, 3); }
    }
    function stables(x0, z0, w, d) {
      const x1 = x0 + w - 1, z1 = z0 + d - 1, H = 5;
      for (let lx = x0; lx <= x1; lx++) for (let lz = z0; lz <= z1; lz++) {
        F.set(lx, -1, lz, B.dirt_path);
        const post = ((lx === x0 || lx === x1) && lz % 4 === 2) || ((lz === z0 || lz === z1) && (lx === x0 || lx === x1));
        for (let ly = 0; ly < H; ly++) F.set(lx, ly, lz, post ? st.beam : lx === x1 ? brick(lx, ly, lz) : 0);
        F.set(lx, H, lz, st.roofFull);
        if (lx === x0) F.stairs(lx - 1, H, lz, st.roof, 3);
      }
      for (let lz = z0 + 1; lz < z1 - 2; lz += 4) {
        for (let lx = x0 + 2; lx < x1; lx++) F.set(lx, 0, lz, B.fence);
        F.set(x1 - 1, 0, lz + 1, B.hay_bale); F.set(x1 - 1, 0, lz + 2, B.cauldron);
        if (!ruined) people.push(['horse', x0 + 3, lz + 2, r.nextInt(7)]);
      }
      F.set(x0 + 1, 3, z0 + 2, B.lantern, 1); F.set(x0 + 1, 3, z1 - 2, B.lantern, 1);
      F.chest(x1 - 1, 0, z1 - 1, 'castle_armory', [1, 3], r, 0, B.barrel, [I.stack(I.byName.saddle.id)]);
    }
    function forge(x0, z0, w, d) {
      const x1 = x0 + w - 1, z1 = z0 + d - 1, H = 5;
      for (let lx = x0; lx <= x1; lx++) for (let lz = z0; lz <= z1; lz++) {
        const edge = lx === x1 || lz === z0 || lz === z1;
        F.set(lx, -1, lz, B.stone_bricks);
        for (let ly = 0; ly < H; ly++) F.set(lx, ly, lz, lx === x0 && (lz === z0 || lz === z1) ? st.pillar : edge ? brick(lx, ly, lz) : 0);
        F.set(lx, H, lz, brick(lx, H, lz));
      }
      F.set(x1 - 1, -1, z0 + 2, B.lava); F.set(x1 - 1, -1, z0 + 3, B.lava); F.set(x1 - 1, 0, z0 + 2, B.iron_bars); F.set(x1 - 1, 0, z0 + 3, B.iron_bars);
      F.facing(x1 - 1, 0, z0 + 5, B.furnace, 2); F.facing(x1 - 1, 1, z0 + 5, B.furnace, 2); F.facing(x1 - 1, 0, z0 + 6, B.furnace, 2);
      F.set(x0 + 3, 0, z0 + 4, B.iron_block); F.set(x0 + 3, 0, z0 + 6, B.cauldron);
      F.chest(x1 - 1, 0, z1 - 1, 'smith', [3, 6], r, 2);
      F.set(x0 + 4, 4, z0 + 4, B.lantern, 1);
      if (!ruined) people.push(['villager', x0 + 2, z0 + 3, 3]);
    }
    function chapel(x0, z0, w, d) {
      const x1 = x0 + w - 1, z1 = z0 + d - 1, H = 7, door = x0 + (w >> 1);
      for (let lx = x0; lx <= x1; lx++) for (let lz = z0; lz <= z1; lz++) {
        const edge = lx === x0 || lx === x1 || lz === z0 || lz === z1;
        F.set(lx, -1, lz, B.stone_bricks);
        for (let ly = 0; ly < H; ly++) F.set(lx, ly, lz, edge ? ((lz - z0) % 3 === 1 && (ly === 2 || ly === 3) && (lx === x0 || lx === x1) ? B.glass : brick(lx, ly, lz)) : 0);
      }
      // a pitched roof along the length, with stone gables
      for (let k = 0; x0 - 1 + k <= x1 + 1 - k; k++) for (let lz = z0 - 1; lz <= z1 + 1; lz++) {
        if (x0 - 1 + k === x1 + 1 - k) { F.set(x0 - 1 + k, H + k, lz, st.roofFull); continue; }
        F.stairs(x0 - 1 + k, H + k, lz, st.roof, 3); F.stairs(x1 + 1 - k, H + k, lz, st.roof, 2);
        if (lz === z0 || lz === z1) for (let lx = x0 + k; lx <= x1 - k; lx++) F.set(lx, H + k, lz, brick(lx, H + k, lz));
      }
      F.set(door, H + 2, z0, B.glass); F.set(door, H + 2, z1, B.glass);
      // a side door toward the keep, pews facing the altar
      F.door(x1, 0, z0 + 2, 3);
      for (let lz = z0 + 2; lz < z1 - 2; lz += 2) for (const lx of [x0 + 1, x0 + 2, x1 - 2, x1 - 1]) if (!(lx === x1 - 1 && lz === z0 + 2)) F.stairs(lx, 0, lz, st.chairs, 0);
      F.set(door, 0, z1 - 1, B.gold_block); F.set(door - 1, 0, z1 - 1, B.lantern); F.set(door + 1, 0, z1 - 1, B.lantern);
      for (let ly = 1; ly < 5; ly++) F.set(door, ly, z1, st.banner[ly % 2]);
      F.chest(door + 2, 0, z1 - 1, 'temple', [2, 4], r, 0);
      for (let lz = z0 + 2; lz < z1; lz += 4) F.set(door, H - 1, lz, B.lantern, 1);
      if (!ruined) people.push(['villager', door, z1 - 3, 2]);
    }

    /* ---- the keep ---- */
    {
      const x0 = KX0, x1 = KX1, z0 = KZ0, z1 = KZ1, mx = MID;
      const inside = (lx, lz) => lx > x0 && lx < x1 && lz > z0 && lz < z1;
      for (let lx = x0 - 1; lx <= x1 + 1; lx++) for (let lz = z0 - 1; lz <= z1 + 1; lz++) {
        const edge = !inside(lx, lz) && lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1;
        F.fill(lx, DUNGEON - 3, lz, lx, DUNGEON - 1, lz, st.base, 0, 1);
        if (!edge && !inside(lx, lz)) { F.set(lx, -1, lz, st.base); continue; } // a stone apron
        for (let ly = DUNGEON; ly <= TOP; ly++) {
          if (!edge) { F.set(lx, ly, lz, ly === DUNGEON ? st.base : ly === -1 ? st.floor : 0); continue; }
          const pil = ((lx - x0) % 4 === 0 && (lz === z0 || lz === z1)) || ((lz - z0) % 4 === 0 && (lx === x0 || lx === x1));
          const win = !pil && ly > 0 && FLOORS.some(f => ly === f + 2 || ly === f + 3) && ((lx - x0) % 4 === 2 || (lz - z0) % 4 === 2);
          if (ly < -1) F.set(lx, ly, lz, st.base);
          else if (win) F.set(lx, ly, lz, kind === 'royal' ? B.glass : ruined && ly > TOP - 8 ? 0 : B.iron_bars);
          else if (pil) F.set(lx, ly, lz, ruined ? brick(lx, ly, lz) : st.pillar);
          else wallAt(lx, ly, lz, TOP);
        }
        if (edge && (lx + lz) % 2 === 0) wallAt(lx, TOP + 1, lz, TOP + 2);
      }
      // the storeys and the roof
      for (const f of FLOORS.slice(1)) F.fill(x0 + 1, f - 1, z0 + 1, x1 - 1, f - 1, z1 - 1, st.floor);
      F.fill(x0 + 1, TOP, z0 + 1, x1 - 1, TOP, z1 - 1, st.floor);
      // the great doors, facing the gate
      for (let lx = mx - 1; lx <= mx + 1; lx++) F.fill(lx, 0, z0, lx, 3, z0, 0);
      F.door(mx - 1, 0, z0, 0); F.door(mx + 1, 0, z0, 0);
      F.set(mx, 3, z0, brick(mx, 3, z0)); F.set(mx, 2, z0 - 1, B.lantern, 0, 3);
      for (const lx of [mx - 3, mx + 3]) { F.set(lx, 0, z0 - 2, st.pillar); F.set(lx, 1, z0 - 2, st.pillar); F.set(lx, 2, z0 - 2, B.lantern); }

      // ground floor: the great hall
      for (let lz = z0 + 1; lz < z1 - 3; lz++) F.set(mx, -1, lz, B.red_wool);
      for (let lz = z0 + 4; lz < z1 - 3; lz += 4) for (const lx of [x0 + 6, x1 - 6]) {
        F.fill(lx, 0, lz, lx, FLOORS[1] - 2, lz, st.pillar);
        F.set(lx + (lx < mx ? 1 : -1), 4, lz, B.lantern);
      }
      for (let lz = z0 + 11; lz < z1 - 5; lz++) for (const lx of [x0 + 3, x1 - 3]) {
        F.set(lx, 0, lz, st.roofFull);
        if (lz % 2 === 0) { F.stairs(lx - 1, 0, lz, st.chairs, 2); F.stairs(lx + 1, 0, lz, st.chairs, 3); }
        if (lz % 4 === 1) F.set(lx, 1, lz, B.lantern);
      }
      // the throne on its dais, banners behind
      F.fill(mx - 3, -1, z1 - 3, mx + 3, -1, z1 - 1, st.pillar);
      F.fill(mx - 2, 0, z1 - 2, mx + 2, 0, z1 - 1, B.red_wool);
      F.stairs(mx, 1, z1 - 1, st.chairs, 1); F.set(mx - 1, 1, z1 - 1, B.gold_block); F.set(mx + 1, 1, z1 - 1, B.gold_block); F.set(mx, 2, z1 - 1, B.gold_block);
      F.stairs(mx, 0, z1 - 3, st.stairs, 1);
      for (const lx of [mx - 3, mx + 3]) for (let ly = 0; ly < 6; ly++) F.set(lx, ly, z1 - 1, st.banner[(ly + (lx > mx ? 1 : 0)) % 2]);
      // the fireplace (a bed of glowing magma under a stone hood)
      F.fill(x0 + 1, 0, KZM - 1, x0 + 1, 5, KZM + 1, st.pillar);
      F.set(x0 + 1, -1, KZM, B.magma_block); F.set(x0 + 1, 0, KZM, 0); F.set(x0 + 1, 1, KZM, 0);
      F.set(x0 + 2, -1, KZM, B.magma_block); F.set(x0 + 2, 0, KZM - 1, st.base); F.set(x0 + 2, 0, KZM + 1, st.base);
      // chandeliers
      for (let lz = z0 + 6; lz < z1 - 4; lz += 6) { F.set(mx, FLOORS[1] - 2, lz, B.fence); F.set(mx, FLOORS[1] - 3, lz, B.lantern, 1); }

      // stairs: a flight from each storey to the next, alternating sides
      for (let f = 0; f < FLOORS.length; f++) {
        const yA = FLOORS[f], yB = f + 1 < FLOORS.length ? FLOORS[f + 1] : TOP + 1, n = yB - yA;
        const sx = f % 2 === 0 ? x0 + 1 : x1 - 1;
        for (let i = 0; i < n; i++) {
          const lz = z0 + 2 + i;
          if (i > 0) F.fill(sx, yA - 1, lz, sx, yA + i - 1, lz, st.wall);
          F.stairs(sx, yA + i, lz, st.stairs, 1);
        }
        // headroom through the floor above
        for (let i = Math.max(0, n - 4); i < n - 1; i++) F.fill(sx, yA + i + 1, z0 + 2 + i, sx, yA + i + 3, z0 + 2 + i, 0);
      }

      // first floor: library (left) and armoury (right)
      const y1 = FLOORS[1];
      for (let lz = z0 + 6; lz < z1 - 2; lz += 3) for (let lx = x0 + 4; lx < mx - 2; lx++) { F.set(lx, y1, lz, B.bookshelf); F.set(lx, y1 + 1, lz, B.bookshelf); }
      for (let lz = z0 + 7; lz < z1 - 2; lz += 6) F.set(x0 + 3, y1 + 2, lz, B.lantern);
      F.chest(mx - 2, y1, z1 - 2, 'castle_library', [3, 6], r, 0);
      F.set(mx - 3, y1, z1 - 2, B.crafting_table);
      for (let lz = z0 + 10; lz < z1 - 2; lz += 2) F.chest(x1 - 2, y1, lz, 'castle_armory', [2, 5], r, 2);
      for (let lx = mx + 3; lx < x1 - 3; lx += 3) { F.set(lx, y1, z0 + 8, B.fence); F.set(lx, y1 + 1, z0 + 8, B.iron_block); F.set(lx, y1, z1 - 4, B.fence); F.set(lx, y1 + 1, z1 - 4, B.iron_block); }
      F.set(mx, y1 + 4, KZM, B.lantern, 1); F.set(mx + 6, y1 + 4, KZM, B.lantern, 1);
      // second floor: bedchambers off a hall, and the lord's room
      const y2 = FLOORS[2];
      for (let k = 0; k < 4; k++) {
        const bz = z0 + 4 + k * 5;
        for (const lx of [x0 + 2, x1 - 3]) {
          const c = k % 2 ? B.blue_wool : B.red_wool;
          F.set(lx, y2, bz, c); F.set(lx + 1, y2, bz, c); F.set(lx, y2, bz + 1, B.wool); F.set(lx + 1, y2, bz + 1, B.wool);
          F.set(lx + (lx < mx ? 2 : -1), y2, bz, B.lantern);
        }
        for (const [a, b] of [[x0 + 1, x0 + 7], [x1 - 7, x1 - 1]]) for (let lx = a; lx <= b; lx++) for (let ly = y2; ly < y2 + 3; ly++) F.set(lx, ly, bz + 3, st.floor);
        F.fill(x0 + 6, y2, bz + 1, x0 + 6, y2 + 1, bz + 1, 0); F.fill(x1 - 6, y2, bz + 1, x1 - 6, y2 + 1, bz + 1, 0);
        F.fill(x0 + 7, y2, bz - 1, x0 + 7, y2 + 2, bz + 3, st.floor); F.fill(x1 - 7, y2, bz - 1, x1 - 7, y2 + 2, bz + 3, st.floor);
        F.fill(x0 + 7, y2, bz + 1, x0 + 7, y2 + 1, bz + 1, 0); F.fill(x1 - 7, y2, bz + 1, x1 - 7, y2 + 1, bz + 1, 0);
      }
      F.set(mx, y2, z1 - 3, B.red_wool); F.set(mx + 1, y2, z1 - 3, B.red_wool); F.set(mx, y2, z1 - 2, B.wool); F.set(mx + 1, y2, z1 - 2, B.wool);
      F.chest(mx - 1, y2, z1 - 2, 'castle_treasure', [3, 6], r, 0);
      F.set(mx + 2, y2, z1 - 2, B.bookshelf); F.set(mx - 2, y2, z1 - 2, B.lantern);
      F.set(mx, y2 + 4, KZM, B.lantern, 1);
      // third floor: a council table under the roof
      const y3 = FLOORS[3];
      for (let lz = z0 + 6; lz < z1 - 6; lz++) { F.set(mx, y3, lz, st.roofFull); if (lz % 2) { F.stairs(mx - 1, y3, lz, st.chairs, 2); F.stairs(mx + 1, y3, lz, st.chairs, 3); } }
      F.set(mx, y3 + 4, KZM, B.lantern, 1);
      for (let lz = z0 + 3; lz < z1; lz += 6) { F.set(x0 + 3, y3 + 2, lz, B.lantern); F.set(x1 - 3, y3 + 2, lz, B.lantern); }
      // corner turrets on the roof, each with a pointed cap, and a great flag
      for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          if (!disc(dx, dz, 2)) continue;
          const edge = discEdge(dx, dz, 2);
          for (let ly = TOP + 1; ly < TOP + 7; ly++) F.set(tx + dx, ly, tz + dz, edge ? brick(tx + dx, ly, tz + dz) : 0);
          F.set(tx + dx, TOP, tz + dz, edge ? brick(tx + dx, TOP, tz + dz) : st.floor);
        }
        coneRoof(tx, tz, TOP + 7, 3);
        const ix = tx === x0 ? 1 : -1, iz = tz === z0 ? 1 : -1;
        F.fill(tx + ix * 2, TOP + 1, tz, tx + ix * 2, TOP + 2, tz, 0); F.fill(tx, TOP + 1, tz + iz * 2, tx, TOP + 2, tz + iz * 2, 0);
        F.set(tx, TOP + 4, tz, B.lantern, 1);
      }
      for (let lz = KZM - 2; lz <= KZM + 2; lz++) for (let lx = mx - 2; lx <= mx + 2; lx++) F.set(lx, TOP + 1, lz, Math.abs(lx - mx) === 2 || Math.abs(lz - KZM) === 2 ? brick(lx, TOP + 1, lz) : st.floor);
      flag(mx, TOP + 2, KZM);

      // the dungeon: cells, a guard room with a spawner, the vault
      const dy = DUNGEON;
      for (let k = 0; k < 4; k++) {
        const cz0 = z0 + 2 + k * 4;
        for (let ly = dy + 1; ly < dy + 5; ly++) {
          for (let lx = x0 + 1; lx <= x0 + 5; lx++) F.set(lx, ly, cz0, st.mossy);
          for (let lz = cz0; lz < cz0 + 4; lz++) F.set(x0 + 6, ly, lz, lz === cz0 + 2 ? B.iron_bars : st.mossy);
        }
        F.set(x0 + 2, dy + 1, cz0 + 2, B.cobweb); F.set(x0 + 4, dy + 1, cz0 + 1, k % 2 ? B.bone_block : B.hay_bale);
        F.set(x0 + 7, dy + 3, cz0 + 2, B.torch, 1 + F.dir(2));
      }
      for (let lx = x0 + 1; lx <= x0 + 6; lx++) for (let ly = dy + 1; ly < dy + 5; ly++) F.set(lx, ly, z0 + 18, st.mossy);
      spawner(mx, dy + 1, z0 + 9, kind === 'haunted' ? 'skeleton' : ruined ? 'zombie' : 'cave_spider');
      F.set(mx + 3, dy + 1, z0 + 9, B.lantern);
      // the vault: gold floor, iron bars, treasure
      const vx0 = x1 - 8, vz0 = z1 - 9;
      for (let lz = vz0; lz < z1; lz++) for (let ly = dy + 1; ly < dy + 6; ly++) F.set(vx0, ly, lz, st.wall);
      for (let lx = vx0; lx < x1; lx++) for (let ly = dy + 1; ly < dy + 6; ly++) F.set(lx, ly, vz0, st.wall);
      F.set(vx0, dy + 1, vz0 + 4, B.iron_bars); F.set(vx0, dy + 2, vz0 + 4, B.iron_bars);
      F.fill(vx0 + 1, dy, vz0 + 1, x1 - 1, dy, z1 - 1, B.gold_block);
      F.chest(x1 - 2, dy + 1, z1 - 2, 'castle_treasure', [5, 9], r, 2);
      F.chest(x1 - 2, dy + 1, z1 - 4, 'castle_treasure', [4, 8], r, 2);
      F.chest(x1 - 4, dy + 1, z1 - 2, 'castle_armory', [3, 6], r, 1);
      F.set(x1 - 5, dy + 1, z1 - 6, B.diamond_block); F.set(x1 - 2, dy + 1, z1 - 7, B.emerald_block);
      F.set(x1 - 4, dy + 4, z1 - 5, B.lantern, 1); F.set(x1 - 4, dy + 5, z1 - 5, st.wall);
      for (let lz = z0 + 3; lz < vz0; lz += 5) F.set(x1 - 2, dy + 1, lz, B.lantern);
      if (ruined) for (let k = 0; k < 16; k++) F.set(x0 + 8 + r.nextInt(x1 - x0 - 16), dy + 1 + r.nextInt(4), z0 + 2 + r.nextInt(z1 - z0 - 12), B.cobweb, 0, 3);
      // the way down: a flight along the right wall from the hall
      for (let i = 0; i < -dy - 1; i++) {
        const lz = z0 + 2 + i;
        F.fill(x1 - 1, -1 - i + 1, lz, x1 - 1, -1 - i + 3, lz, 0);
        F.stairs(x1 - 1, -1 - i, lz, st.stairs, 0);
      }
      // people of the keep
      if (!ruined) people.push(['villager', mx, z1 - 5, 2], ['villager', mx - 4, z0 + 8, 1], ['villager', mx + 4, z0 + 12, 0], ['villager', x0 + 5, z0 + 6, 1, y1], ['villager', mx, z1 - 6, 3, y2]);
    }

    /* ---- ruins: rubble and lurking spawners; royal castles: iron guards ---- */
    if (ruined) {
      for (let k = 0; k < 90; k++) {
        const lx = 4 + r.nextInt(N - 8), lz = 6 + r.nextInt(N - 10);
        if (lx > KX0 - 2 && lx < KX1 + 2 && lz > KZ0 - 2 && lz < KZ1 + 2) continue;
        F.set(lx, 0, lz, [st.base, st.base2, B.gravel, B.cobweb, st.mossy][r.nextInt(5)], 0, 3);
      }
      for (const [lx, lz, m] of [[12, 12, 'zombie'], [N - 14, 30, 'skeleton'], [MID, 62, 'spider']]) spawner(lx, 0, lz, kind === 'haunted' && m === 'zombie' ? 'skeleton' : m);
    } else {
      for (const [lx, lz] of [[MID - 3, 8], [MID + 3, 8], [MID, KZ0 - 6], [14, 30], [N - 15, 30]]) F.mob('iron_golem', lx, 0, lz, { home: F.centre() });
    }
    for (const p of people) F.mob(p[0], p[1], p[4] || 0, p[2], p[0] === 'villager' ? { v: p[3], home: F.centre() } : { v: p[3] });
    pl.castleInfo = { kind, style: Object.keys(STYLES).find(k => STYLES[k] === st), y: Y, face };
    return pl;
  }
  // ease the natural ground toward a level over a few blocks
  function blendTo(pl, ctx, x, z, gy, t) {
    const g = ctx.h(x, z);
    if (g < SEA - 1) return;
    const k = Math.min(1, t / 10), target = Math.round(gy + (g - gy) * k);
    const top = ctx.biome(x, z) === BI.DESERT ? B.sand : B.grass;
    if (g > target) { pl.fill(x, target + 1, z, x, Math.min(g + 10, CH - 1), z, 0); pl.set(x, target, z, top); }
    else if (g < target) { pl.fill(x, g, z, x, target - 1, z, B.dirt); pl.set(x, target, z, top); }
  }

  St.TYPES.push({ name: 'castle', dim: 0, spacing: 40, sep: 10, radius: 4, chance: 0.75, salt: 0x5c2, build: castle });
  St.castle = castle;
  DL.Castles = { STYLES };
})();
