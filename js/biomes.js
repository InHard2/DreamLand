/*
 * DreamLand - decorating the modern biomes: birch, spruce, pine, acacia,
 * jungle, dark oak, pale oak, mangrove and cherry trees, huge mushrooms,
 * flowers and grass, ice spikes, icebergs, bamboo, lily pads, boulders and
 * the three cave biomes (lush caves, dripstone caves and the deep dark).
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, BI = S.BIOME, CH = S.CH, SEA = S.SEA;
  const W = DL.World.prototype;
  const SOLID = S.SOLID, OPAQUE = S.OPAQUE, LEAVES = S.LEAVES, SOIL = S.SOIL, R = S.R;

  /* the new woods craft like oak */
  const I = DL.Items;
  for (const n of ['birch', 'spruce', 'acacia', 'jungle', 'mangrove', 'cherry', 'pale_oak', 'dark']) {
    const P = n === 'dark' ? 'dark_planks' : n + '_planks', L = n === 'dark' ? 'dark_log' : n + '_log';
    if (!I.byName[P] || !I.byName[L]) continue;
    I._shapeless([L], P, 4);
    I._shaped(['#', '#'], { '#': P }, 'stick', 4);
    I._shaped(['##', '##'], { '#': P }, 'crafting_table');
    I._shaped(['###', '# #', '###'], { '#': P }, 'chest');
    I._shaped(['X X', ' X '], { X: P }, 'bowl', 4);
    I._shaped(['#  ', '## ', '###'], { '#': P }, 'wood_stairs', 4);
    for (const [pat, t] of [[['XXX', ' # ', ' # '], 'pickaxe'], [['XX', 'X#', ' #'], 'axe'], [['X', '#', '#'], 'shovel'], [['X', 'X', '#'], 'sword'], [['XX', ' #', ' #'], 'hoe']]) I._shaped(pat, { X: P, '#': 'stick' }, 'wood_' + t);
    I.byName[P].fuel = I.byName[L].fuel = 300;
    I._smelt[I.byName[L].id] = 263;
  }
  I._shapeless(['bamboo', 'bamboo'], 'stick', 1);
  I._shaped(['##', '##'], { '#': 'mud' }, 'dirt', 4);

  W.biomeAtCol = function (x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    return c && c.biomes ? c.biomes[((z & 15) << 4) | (x & 15)] : 0;
  };

  /* ------------------------------------------------------------ */
  /* What grows where                                             */
  /* ------------------------------------------------------------ */
  const INFO = [];
  const NONE = { flowers: [], flowerN: 0, grass: 0 };
  const d = (k, o) => { INFO[BI[k]] = Object.assign({ trees: 0, kinds: ['oak'], grass: 6, fern: 0, flowers: [B.dandelion, B.rose], flowerN: 1 }, o); };
  const MEADOW_FLOWERS = [B.allium, B.cornflower, B.dandelion, B.lily_of_the_valley, B.orange_tulip, B.pink_tulip];
  d('PLAINS', { trees: 0.25, kinds: ['oak', 'oak', 'big_oak'], grass: 26, flowers: [B.dandelion, B.rose, B.orange_tulip, B.pink_tulip, B.cornflower], flowerN: 3 });
  d('SUNFLOWER_PLAINS', { trees: 0.15, grass: 26, flowers: [B.sunflower, B.sunflower, B.sunflower, B.dandelion], flowerN: 12 });
  d('FOREST', { trees: 9, kinds: ['oak', 'oak', 'oak', 'birch', 'big_oak'], grass: 8, flowers: [B.dandelion, B.rose, B.lily_of_the_valley], flowerN: 2 });
  d('SEASONAL', { trees: 5, kinds: ['oak', 'big_oak', 'birch'], grass: 10, flowerN: 2 });
  d('FLOWER_FOREST', { trees: 4, kinds: ['oak', 'birch'], grass: 6, flowers: [B.dandelion, B.rose, B.allium, B.orange_tulip, B.pink_tulip, B.cornflower, B.lily_of_the_valley], flowerN: 16 });
  d('BIRCH_FOREST', { trees: 9, kinds: ['birch'], grass: 8, flowerN: 2 });
  d('OLD_GROWTH_BIRCH', { trees: 9, kinds: ['tall_birch', 'tall_birch', 'birch'], grass: 8, flowerN: 2 });
  d('DARK_FOREST', { trees: 15, kinds: ['dark_oak', 'dark_oak', 'dark_oak', 'dark_oak', 'huge_red', 'huge_brown', 'oak'], grass: 3, flowerN: 1, mush: 2 });
  d('PALE_GARDEN', Object.assign({ trees: 13, kinds: ['pale_oak'] }, NONE, { grass: 1 }));
  d('SWAMP', { trees: 2, kinds: ['swamp_oak'], grass: 6, flowers: [B.cornflower], flowerN: 1, lily: 7, mush: 2 });
  d('MANGROVE_SWAMP', Object.assign({ trees: 9, kinds: ['mangrove'] }, NONE, { grass: 2, lily: 4 }));
  d('TAIGA', Object.assign({ trees: 9, kinds: ['spruce', 'spruce', 'pine'] }, NONE, { grass: 3, fern: 8 }));
  d('SNOWY_TAIGA', Object.assign({ trees: 7, kinds: ['spruce', 'pine'] }, NONE, { grass: 1, fern: 2 }));
  d('OLD_GROWTH_TAIGA', Object.assign({ trees: 11, kinds: ['mega_spruce', 'mega_spruce', 'spruce'] }, NONE, { grass: 3, fern: 10, mush: 3, boulders: 1 }));
  d('GROVE', Object.assign({ trees: 5, kinds: ['spruce', 'pine'] }, NONE));
  d('TUNDRA', Object.assign({ trees: 0.25, kinds: ['spruce'] }, NONE, { grass: 1 }));
  d('ICE_SPIKES', Object.assign({ spikes: 1 }, NONE));
  for (const k of ['SNOWY_SLOPES', 'FROZEN_PEAKS', 'JAGGED_PEAKS', 'STONY_PEAKS', 'BEACH', 'SNOWY_BEACH', 'STONY_SHORE', 'RIVER', 'FROZEN_RIVER', 'OCEAN', 'DEEP_OCEAN', 'WARM_OCEAN']) d(k, Object.assign({}, NONE));
  d('FROZEN_OCEAN', Object.assign({ icebergs: 1 }, NONE));
  d('MEADOW', { trees: 0.2, kinds: ['oak', 'birch'], grass: 32, flowers: MEADOW_FLOWERS, flowerN: 10 });
  d('CHERRY_GROVE', { trees: 4, kinds: ['cherry'], grass: 10, flowers: [B.pink_tulip, B.allium], flowerN: 2, petals: 7 });
  d('SAVANNA', Object.assign({ trees: 1.2, kinds: ['acacia', 'acacia', 'oak'] }, NONE, { grass: 28 }));
  d('SAVANNA_PLATEAU', Object.assign({ trees: 1.6, kinds: ['acacia', 'acacia', 'oak'] }, NONE, { grass: 28 }));
  d('WINDSWEPT_HILLS', { trees: 0.5, kinds: ['spruce', 'oak'], grass: 4, flowerN: 1 });
  d('WINDSWEPT_FOREST', { trees: 6, kinds: ['spruce', 'oak', 'spruce'], grass: 4, flowerN: 1 });
  d('JUNGLE', { trees: 18, kinds: ['jungle', 'jungle', 'mega_jungle', 'jungle_bush', 'jungle_bush', 'jungle_bush'], grass: 20, fern: 5, flowerN: 1, bamboo: 1 });
  d('SPARSE_JUNGLE', { trees: 3, kinds: ['jungle', 'jungle_bush'], grass: 18, fern: 2, flowerN: 1 });
  d('BAMBOO_JUNGLE', { trees: 5, kinds: ['jungle', 'mega_jungle', 'jungle_bush'], grass: 14, fern: 4, flowerN: 1, bamboo: 14 });
  d('DESERT', Object.assign({ dead: 2, cactus: 10 }, NONE));
  d('BADLANDS', Object.assign({ dead: 4, cactus: 5 }, NONE));
  d('ERODED_BADLANDS', Object.assign({ dead: 4, cactus: 5 }, NONE));
  d('WOODED_BADLANDS', Object.assign({ trees: 4, kinds: ['oak'], dead: 2 }, NONE, { grass: 4 }));
  d('MUSHROOM_FIELDS', Object.assign({ trees: 1.2, kinds: ['huge_red', 'huge_brown'], mush: 4 }, NONE));
  S.BIOME_INFO = INFO;
  const info = (b) => INFO[b] || INFO[0];

  /* ------------------------------------------------------------ */
  /* Small helpers                                                */
  /* ------------------------------------------------------------ */
  const free = (b) => b === 0 || b === B.snow_layer || S.REPLACE[b] || S.RENDER[b] === R.CROSS || LEAVES[b];
  function leaf(w, x, y, z, id) { const b = w.getBlock(x, y, z); if (b === 0 || b === B.snow_layer || S.REPLACE[b] || S.RENDER[b] === R.CROSS) w.popSet(x, y, z, id, 0); }
  function wood(w, x, y, z, id) { const b = w.getBlock(x, y, z); if (free(b) || b === B.water) w.popSet(x, y, z, id, 0); }
  function trunkFree(w, x, y, z, h, size) {
    if (y < 2 || y + h + 3 >= CH) return false;
    for (let yy = y; yy < y + h; yy++) for (let dx = 0; dx < size; dx++) for (let dz = 0; dz < size; dz++) if (!free(w.getBlock(x + dx, yy, z + dz))) return false;
    return true;
  }
  function onSoil(w, x, y, z, size) {
    for (let dx = 0; dx < (size || 1); dx++) for (let dz = 0; dz < (size || 1); dz++) if (!SOIL[w.getBlock(x + dx, y - 1, z + dz)]) return false;
    return true;
  }
  function dirtUnder(w, x, y, z, size) { for (let dx = 0; dx < (size || 1); dx++) for (let dz = 0; dz < (size || 1); dz++) if (w.getBlock(x + dx, y - 1, z + dz) === B.grass) w.popSet(x + dx, y - 1, z + dz, B.dirt, 0); }
  function blob(w, cx, cy, cz, rx, ry, id, r, holes) {
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) for (let dz = -rx; dz <= rx; dz++) {
      const q = (dx * dx + dz * dz) / (rx * rx + 0.5) + (dy * dy) / (ry * ry + 0.5);
      if (q > 1 || (holes && q > 0.7 && r.next() < holes)) continue;
      leaf(w, cx + dx, cy + dy, cz + dz, id);
    }
  }
  function disk(w, cx, y, cz, rad, id, r, cut) {
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (dx * dx + dz * dz > rad * rad + (cut ? 0 : rad)) continue;
      if (cut && Math.abs(dx) === rad && Math.abs(dz) === rad) continue;
      if (r && Math.abs(dx) === rad && Math.abs(dz) === rad && r.next() < 0.5) continue;
      leaf(w, cx + dx, y, cz + dz, id);
    }
  }

  /* ------------------------------------------------------------ */
  /* Trees                                                        */
  /* ------------------------------------------------------------ */
  const TREES = {};
  TREES.oak = (w, r, x, y, z) => w.genTree(r, x, y, z);
  TREES.big_oak = (w, r, x, y, z) => w.genBigTree(r, x, y, z);
  function birch(w, r, x, y, z, tall) {
    const h = tall ? 10 + r.nextInt(5) : 5 + r.nextInt(3);
    if (!onSoil(w, x, y, z) || !trunkFree(w, x, y, z, h, 1)) return false;
    dirtUnder(w, x, y, z);
    for (let yy = y + h - 3; yy <= y + h; yy++) { const k = y + h - yy; disk(w, x, yy, z, k <= 1 ? 1 : 2, B.birch_leaves, r, true); }
    for (let yy = 0; yy < h; yy++) wood(w, x, y + yy, z, B.birch_log);
    return true;
  }
  TREES.birch = (w, r, x, y, z) => birch(w, r, x, y, z, false);
  TREES.tall_birch = (w, r, x, y, z) => birch(w, r, x, y, z, true);
  TREES.swamp_oak = (w, r, x, y, z) => {
    const h = 5 + r.nextInt(3);
    if (!onSoil(w, x, y, z) || !trunkFree(w, x, y, z, h, 1)) return false;
    dirtUnder(w, x, y, z);
    for (let yy = y + h - 3; yy <= y + h; yy++) disk(w, x, yy, z, yy >= y + h - 1 ? 2 : 3, B.leaves, r, false);
    for (let yy = 0; yy < h; yy++) wood(w, x, y + yy, z, B.log);
    return true;
  };
  function spruce(w, r, x, y, z, pine) {
    const h = pine ? 9 + r.nextInt(5) : 7 + r.nextInt(4);
    if (!onSoil(w, x, y, z) || !trunkFree(w, x, y, z, h, 1)) return false;
    dirtUnder(w, x, y, z);
    const top = y + h, start = pine ? y + Math.floor(h * 0.6) : y + 2;
    leaf(w, x, top + 1, z, B.spruce_leaves);
    for (let yy = top; yy >= start; yy--) {
      const k = top - yy;
      const rad = pine ? (k % 2 ? 1 : 0) + (k > 3 ? 1 : 0) : Math.min(3, (k % 2 === 0 ? 1 : 0) + Math.floor(k / 2.5));
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > rad + (rad > 1 ? 1 : 0)) continue;
        leaf(w, x + dx, yy, z + dz, B.spruce_leaves);
      }
    }
    for (let yy = 0; yy <= h; yy++) wood(w, x, y + yy, z, B.spruce_log);
    return true;
  }
  TREES.spruce = (w, r, x, y, z) => spruce(w, r, x, y, z, false);
  TREES.pine = (w, r, x, y, z) => spruce(w, r, x, y, z, true);
  TREES.mega_spruce = (w, r, x, y, z) => {
    const h = 16 + r.nextInt(9);
    if (!onSoil(w, x, y, z, 2) || !trunkFree(w, x, y, z, h, 2)) return spruce(w, r, x, y, z, false);
    dirtUnder(w, x, y, z, 2);
    const top = y + h;
    for (let yy = top; yy >= y + Math.floor(h * 0.45); yy--) {
      const k = top - yy, rad = Math.min(4, 1 + Math.floor(k / 3) - (k % 3 === 2 ? 1 : 0));
      for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
        const ex = dx <= 0 ? -dx : dx - 1, ez = dz <= 0 ? -dz : dz - 1;
        if (ex * ex + ez * ez > rad * rad + 1) continue;
        leaf(w, x + dx, yy, z + dz, B.spruce_leaves);
      }
    }
    leaf(w, x, top + 1, z, B.spruce_leaves); leaf(w, x + 1, top + 1, z + 1, B.spruce_leaves);
    for (let yy = 0; yy < h; yy++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) wood(w, x + dx, y + yy, z + dz, B.spruce_log);
    for (let dx = -3; dx <= 4; dx++) for (let dz = -3; dz <= 4; dz++) {
      if (r.next() < 0.45) continue;
      const gy = w.topSolidY(x + dx, z + dz) - 1;
      if (Math.abs(gy - (y - 1)) < 3 && (w.getBlock(x + dx, gy, z + dz) === B.grass || w.getBlock(x + dx, gy, z + dz) === B.dirt)) w.popSet(x + dx, gy, z + dz, B.podzol, 0);
    }
    return true;
  };
  TREES.acacia = (w, r, x, y, z) => {
    const h = 5 + r.nextInt(3);
    if (!onSoil(w, x, y, z) || !trunkFree(w, x, y, z, 3, 1)) return false;
    dirtUnder(w, x, y, z);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const crown = (cx, cy, cz) => { disk(w, cx, cy, cz, 3, B.acacia_leaves, r, true); disk(w, cx, cy + 1, cz, 2, B.acacia_leaves, null, true); };
    const [ddx, ddz] = dirs[r.nextInt(4)];
    const bendAt = h - 2 - r.nextInt(2);
    let cx = x, cz = z, cy = y;
    for (let k = 0; k < h; k++) {
      cy = y + k;
      if (k >= bendAt) { cx += ddx; cz += ddz; }
      wood(w, cx, cy, cz, B.acacia_log);
    }
    crown(cx, cy + 1, cz);
    if (r.next() < 0.5) {
      const [ex, ez] = dirs[(dirs.findIndex(v => v[0] === ddx && v[1] === ddz) + 1 + r.nextInt(2)) % 4];
      let bx = x, bz = z, by = y + bendAt - 1;
      for (let k = 0; k < 2 + r.nextInt(2); k++) { bx += ex; bz += ez; by++; wood(w, bx, by, bz, B.acacia_log); }
      disk(w, bx, by + 1, bz, 2, B.acacia_leaves, r, true); disk(w, bx, by + 2, bz, 1, B.acacia_leaves, null, false);
    }
    return true;
  };
  TREES.jungle = (w, r, x, y, z) => {
    const h = 6 + r.nextInt(5);
    if (!onSoil(w, x, y, z) || !trunkFree(w, x, y, z, h, 1)) return false;
    dirtUnder(w, x, y, z);
    blob(w, x, y + h, z, 3, 2, B.jungle_leaves, r, 0.4);
    for (let yy = 0; yy < h; yy++) wood(w, x, y + yy, z, B.jungle_log);
    return true;
  };
  TREES.mega_jungle = (w, r, x, y, z) => {
    const h = 15 + r.nextInt(10);
    if (!onSoil(w, x, y, z, 2) || !trunkFree(w, x, y, z, h, 2)) return TREES.jungle(w, r, x, y, z);
    dirtUnder(w, x, y, z, 2);
    blob(w, x, y + h, z, 5, 2, B.jungle_leaves, r, 0.35);
    for (let i = 0; i < 3; i++) {
      const by = y + Math.floor(h * (0.45 + r.next() * 0.35)), a = r.next() * Math.PI * 2, len = 2 + r.nextInt(3);
      let ex = x, ez = z, ey = by;
      for (let k = 1; k <= len; k++) { ex = Math.round(x + 0.5 + Math.cos(a) * k); ez = Math.round(z + 0.5 + Math.sin(a) * k); ey = by + (k >> 1); wood(w, ex, ey, ez, B.jungle_log); }
      blob(w, ex, ey + 1, ez, 2, 1, B.jungle_leaves, r, 0.3);
    }
    for (let yy = 0; yy < h; yy++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) wood(w, x + dx, y + yy, z + dz, B.jungle_log);
    return true;
  };
  TREES.jungle_bush = (w, r, x, y, z) => {
    if (!onSoil(w, x, y, z) || !free(w.getBlock(x, y, z))) return false;
    blob(w, x, y + 1, z, 2, 1, B.jungle_leaves, r, 0.3);
    wood(w, x, y, z, B.jungle_log);
    return true;
  };
  function wideTree(w, r, x, y, z, logId, leafId, pale) {
    const h = 6 + r.nextInt(3) + (pale ? 2 : 0);
    if (!onSoil(w, x, y, z, 2) || !trunkFree(w, x, y, z, h, 2)) return false;
    dirtUnder(w, x, y, z, 2);
    const top = y + h;
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy === 1 ? 2 : dy === -2 ? 3 : 4;
      for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
        const ex = dx <= 0 ? -dx : dx - 1, ez = dz <= 0 ? -dz : dz - 1;
        if (ex * ex + ez * ez > rad * rad + 1 || (ex === rad && ez === rad)) continue;
        leaf(w, x + dx, top + dy, z + dz, leafId);
      }
    }
    for (let yy = 0; yy < h; yy++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) wood(w, x + dx, y + yy, z + dz, logId);
    if (r.next() < 0.6) { const sx = r.nextInt(2) ? -1 : 2, sz = r.nextInt(2); for (let k = 0; k < 2 + r.nextInt(2); k++) wood(w, x + sx, top - 3 + k, z + sz, logId); }
    return true;
  }
  TREES.dark_oak = (w, r, x, y, z) => wideTree(w, r, x, y, z, B.dark_log, B.dark_oak_leaves, false);
  TREES.pale_oak = (w, r, x, y, z) => wideTree(w, r, x, y, z, B.pale_oak_log, B.pale_oak_leaves, true);
  TREES.cherry = (w, r, x, y, z) => {
    const h = 4 + r.nextInt(3);
    if (!onSoil(w, x, y, z) || !trunkFree(w, x, y, z, h, 1)) return false;
    dirtUnder(w, x, y, z);
    for (let yy = 0; yy < h; yy++) wood(w, x, y + yy, z, B.cherry_log);
    const tips = [[x, y + h, z]];
    const nb = 1 + r.nextInt(2);
    for (let i = 0; i < nb; i++) {
      const a = r.next() * Math.PI * 2, len = 3 + r.nextInt(2);
      let ex = x, ez = z, ey = y + h - 2;
      for (let k = 1; k <= len; k++) { ex = Math.round(x + Math.cos(a) * k); ez = Math.round(z + Math.sin(a) * k); ey = y + h - 2 + Math.floor(k * 0.8); wood(w, ex, ey, ez, B.cherry_log); }
      tips.push([ex, ey + 1, ez]);
    }
    for (const [tx, ty, tz] of tips) blob(w, tx, ty, tz, 4, 2, B.cherry_leaves, r, 0.25);
    return true;
  };
  TREES.mangrove = (w, r, x, y, z) => {
    // y is the first free block above the floor (may be under water)
    const floor = y - 1;
    const fb = w.getBlock(x, floor, z);
    if (!SOIL[fb] && fb !== B.mud && fb !== B.sand && fb !== B.clay) return false;
    let base = y; while (w.getBlock(x, base, z) === B.water && base < floor + 5) base++;
    if (base - floor > 4) return false;
    const lift = 2 + r.nextInt(2), h = 6 + r.nextInt(4), t0 = base + lift - 1;
    if (!trunkFree(w, x, t0, z, h, 1)) return false;
    // arching roots down into the mud
    for (const [ddx, ddz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
      if (r.next() < 0.25) continue;
      const reach = 2 + r.nextInt(2);
      for (let k = 1; k <= reach; k++) {
        const rx = x + ddx * k, rz = z + ddz * k, top = t0 - Math.max(0, k - 1);
        for (let yy = top; yy > floor - 1; yy--) {
          const b = w.getBlock(rx, yy, rz);
          if (SOLID[b] && b !== B.mangrove_roots) { if (b === B.dirt || b === B.grass || b === B.sand) w.popSet(rx, yy, rz, B.mud, 0); break; }
          if (k === reach || yy <= top) w.popSet(rx, yy, rz, B.mangrove_roots, 0);
        }
      }
    }
    for (let yy = floor + 1; yy < t0; yy++) w.popSet(x, yy, z, B.mangrove_roots, 0);
    for (let yy = 0; yy < h; yy++) wood(w, x, t0 + yy, z, B.mangrove_log);
    blob(w, x, t0 + h, z, 3, 2, B.mangrove_leaves, r, 0.35);
    return true;
  };
  function hugeMushroom(w, r, x, y, z, red) {
    const h = red ? 5 + r.nextInt(3) : 4 + r.nextInt(3);
    if (!onSoil(w, x, y, z) || !trunkFree(w, x, y, z, h + 1, 1)) return false;
    const cap = red ? B.red_mushroom_block : B.brown_mushroom_block;
    if (red) {
      disk(w, x, y + h, z, 1, cap, null, false);
      for (let yy = y + h - 3; yy < y + h; yy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) < 2 && Math.abs(dz) < 2) continue;
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        leaf(w, x + dx, yy, z + dz, cap);
      }
    } else disk(w, x, y + h, z, 3, cap, null, true);
    for (let yy = 0; yy < h; yy++) wood(w, x, y + yy, z, B.mushroom_stem);
    return true;
  }
  TREES.huge_red = (w, r, x, y, z) => hugeMushroom(w, r, x, y, z, true);
  TREES.huge_brown = (w, r, x, y, z) => hugeMushroom(w, r, x, y, z, false);
  S.TREES = TREES;

  /* ------------------------------------------------------------ */
  /* Features                                                     */
  /* ------------------------------------------------------------ */
  function iceSpike(w, r, x, y, z) {
    const tall = r.next() < 0.12, H = tall ? 24 + r.nextInt(16) : 6 + r.nextInt(10), R0 = tall ? 2 + r.nextInt(2) : 1 + r.nextInt(2);
    for (let k = -3; k < H && y + k < CH - 1; k++) {
      const rad = Math.max(0, Math.round(R0 * (1 - Math.max(0, k) / H) + (k < 2 ? 0.4 : 0)));
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (dx * dx + dz * dz > rad * rad + 0.6) continue;
        const b = w.getBlock(x + dx, y + k, z + dz);
        if (b === 0 || b === B.snow_layer || b === B.snow_block || b === B.dirt || b === B.grass) w.popSet(x + dx, y + k, z + dz, B.packed_ice, 0);
      }
    }
  }
  function iceberg(w, r, x, z) {
    const rad = 3 + r.nextInt(4), up = 2 + r.nextInt(7), down = 3 + r.nextInt(3);
    for (let dy = -down; dy <= up; dy++) {
      const f = dy >= 0 ? 1 - dy / (up + 1) : 1 - (-dy) / (down + 1) * 0.6;
      const rr = rad * f;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (dx * dx + dz * dz > rr * rr + r.next()) continue;
        const yy = SEA + dy, b = w.getBlock(x + dx, yy, z + dz);
        if (b === 0 || b === B.water || b === B.ice) w.popSet(x + dx, yy, z + dz, dy === up || (dy > 0 && r.next() < 0.15) ? B.snow_block : r.next() < 0.1 ? B.blue_ice : B.packed_ice, 0);
      }
    }
  }
  function boulder(w, r, x, y, z) {
    const rad = 1 + r.nextInt(2);
    for (let dx = -rad; dx <= rad; dx++) for (let dy = -rad; dy <= rad; dy++) for (let dz = -rad; dz <= rad; dz++) {
      if (dx * dx + dy * dy + dz * dz > rad * rad + 0.5) continue;
      const b = w.getBlock(x + dx, y + dy, z + dz);
      if (free(b) || SOIL[b]) w.popSet(x + dx, y + dy, z + dz, r.next() < 0.7 ? B.mossy_cobblestone : B.cobblestone, 0);
    }
  }

  /** Scatter little plants around (x, z). */
  function scatter(w, r, x, z, n, pick, ok) {
    for (let i = 0; i < n; i++) {
      const px = x + r.nextInt(8) - r.nextInt(8), pz = z + r.nextInt(8) - r.nextInt(8);
      const py = w.topSolidY(px, pz);
      if (py < 2 || py >= CH - 2) continue;
      if (w.getBlock(px, py, pz) !== 0) continue;
      const below = w.getBlock(px, py - 1, pz);
      if (!(ok ? ok(below) : SOIL[below])) continue;
      w.popSet(px, py, pz, pick(), 0);
    }
  }

  /* ------------------------------------------------------------ */
  /* Surface decoration                                           */
  /* ------------------------------------------------------------ */
  W.decorateBiomes = function (r, c, bx, bz) {
    const at = (x, z) => this.biomeAtCol(x, z);
    const tn = this.gen.cont.gens[0].noise(bx * 0.02, 1.5, bz * 0.02) * 0.5 + 0.5;
    // trees
    for (let i = 0; i < 26; i++) {
      const x = bx + r.nextInt(16) + 8, z = bz + r.nextInt(16) + 8;
      const inf = info(at(x, z));
      if (!inf.trees || r.next() > inf.trees / 26 * (0.6 + tn * 0.8)) continue;
      const kind = inf.kinds[r.nextInt(inf.kinds.length)];
      let y = this.topSolidY(x, z);
      if (kind === 'mangrove') { let fy = y; while (fy > 1 && (this.getBlock(x, fy - 1, z) === B.water || this.getBlock(x, fy - 1, z) === 0)) fy--; y = fy; }
      (TREES[kind] || TREES.oak)(this, r, x, y, z);
    }
    // grass, ferns, flowers, petals
    for (let i = 0; i < 6; i++) {
      const x = bx + r.nextInt(16) + 8, z = bz + r.nextInt(16) + 8, inf = info(at(x, z));
      const n = Math.round((inf.grass + (inf.fern || 0)) * 1.4);
      if (n > 0) scatter(this, r, x, z, n, () => (inf.fern && r.next() * (inf.grass + inf.fern) < inf.fern) ? B.fern : B.short_grass, (b) => SOIL[b] && b !== B.mud);
    }
    for (let i = 0; i < 4; i++) {
      const x = bx + r.nextInt(16) + 8, z = bz + r.nextInt(16) + 8, inf = info(at(x, z));
      if (inf.flowers.length && r.next() < inf.flowerN / 4) scatter(this, r, x, z, 10 + inf.flowerN * 2, () => inf.flowers[r.nextInt(inf.flowers.length)]);
      if (inf.petals && r.next() < 0.8) scatter(this, r, x, z, inf.petals * 4, () => B.pink_petals, (b) => b === B.grass);
      if (inf.dead) scatter(this, r, x, z, inf.dead * 2, () => B.dead_bush, (b) => b === B.sand || b === B.red_sand || b === B.terracotta || S.blocks[b].name.endsWith('_terracotta') || b === B.coarse_dirt);
      if (inf.mush && r.next() < 0.5) scatter(this, r, x, z, inf.mush * 2, () => r.next() < 0.5 ? B.brown_mushroom : B.red_mushroom, (b) => b === B.mycelium || b === B.podzol || SOIL[b]);
      if (inf.boulders && r.next() < 0.25) { const y = this.topSolidY(x, z); if (SOIL[this.getBlock(x, y - 1, z)]) boulder(this, r, x, y, z); }
    }
    // cacti
    {
      const x = bx + r.nextInt(16) + 8, z = bz + r.nextInt(16) + 8, inf = info(at(x, z));
      if (inf.cactus && at(x, z) !== BI.DESERT) for (let i = 0; i < Math.ceil(inf.cactus / 2); i++) this.genCactus(r, x, this.topSolidY(x, z), z);
    }
    // bamboo
    for (let i = 0; i < 4; i++) {
      const x = bx + r.nextInt(16) + 8, z = bz + r.nextInt(16) + 8, inf = info(at(x, z));
      if (!inf.bamboo || r.next() > inf.bamboo / 4) continue;
      for (let k = 0; k < inf.bamboo + 4; k++) {
        const px = x + r.nextInt(6) - r.nextInt(6), pz = z + r.nextInt(6) - r.nextInt(6), py = this.topSolidY(px, pz);
        if (!SOIL[this.getBlock(px, py - 1, pz)] || this.getBlock(px, py, pz) !== 0) continue;
        const h = 6 + r.nextInt(9);
        for (let yy = 0; yy < h && py + yy < CH - 1; yy++) { if (this.getBlock(px, py + yy, pz) !== 0) break; this.popSet(px, py + yy, pz, B.bamboo, 0); }
      }
    }
    // lily pads on still water
    for (let i = 0; i < 3; i++) {
      const x = bx + r.nextInt(16) + 8, z = bz + r.nextInt(16) + 8, inf = info(at(x, z));
      if (!inf.lily) continue;
      for (let k = 0; k < inf.lily * 2; k++) {
        const px = x + r.nextInt(8) - r.nextInt(8), pz = z + r.nextInt(8) - r.nextInt(8);
        if (this.getBlock(px, SEA, pz) === B.water && this.getBlock(px, SEA + 1, pz) === 0) this.popSet(px, SEA + 1, pz, B.lily_pad, 0);
      }
    }
    // ice spikes & icebergs
    {
      const x = bx + r.nextInt(16) + 8, z = bz + r.nextInt(16) + 8, b = at(x, z);
      if (b === BI.ICE_SPIKES) for (let i = 0; i < 1 + r.nextInt(2); i++) { const sx = x + r.nextInt(6) - 3, sz = z + r.nextInt(6) - 3; iceSpike(this, r, sx, this.topSolidY(sx, sz), sz); }
      if (b === BI.FROZEN_OCEAN && r.next() < 0.18) iceberg(this, r, x, z);
    }
  };

  /* ------------------------------------------------------------ */
  /* Cave biomes                                                  */
  /* ------------------------------------------------------------ */
  W.caveBiomeAt = function (x, y, z) {
    if ((this.dim || 0) !== 0 || !this.gen) return -1;
    const g = this.gen;
    if (y < 24 && g.patch.sample(x / 120, 9.5, z / 120) * 2.6 > 0.3) return BI.DEEP_DARK;
    if (y > 64) return -1;
    if (g.weird.sample(x / 160, 4.25, z / 160) * 2.6 > 0.4) return BI.LUSH_CAVES;
    if (g.band.sample(x / 140, 2.75, z / 140) * 2.6 > 0.4) return BI.DRIPSTONE_CAVES;
    return -1;
  };
  W.decorateCaves = function (r, bx, bz) {
    const cx = bx + 16, cz = bz + 16;
    const kinds = new Set();
    for (const y of [12, 40]) { const k = this.caveBiomeAt(cx, y, cz); if (k >= 0) kinds.add(k); }
    if (!kinds.size) return;
    const stoneish = (b) => b === B.stone || b === B.dirt || b === B.gravel || b === B.cobblestone;
    for (let x = bx + 8; x < bx + 24; x++) for (let z = bz + 8; z < bz + 24; z++) {
      const surf = this.topSolidY(x, z) - 8;
      for (let y = 6; y < Math.min(surf, 62); y++) {
        if (this.getBlock(x, y, z) !== 0) continue;
        const below = this.getBlock(x, y - 1, z), above = this.getBlock(x, y + 1, z);
        const k = this.caveBiomeAt(x, y, z);
        if (k < 0) continue;
        if (k === BI.LUSH_CAVES) {
          if (stoneish(below) && r.next() < 0.85) {
            this.popSet(x, y - 1, z, B.moss_block, 0);
            const v = r.next();
            if (v < 0.3) this.popSet(x, y, z, B.short_grass, 0);
            else if (v < 0.36 && this.getBlock(x, y + 1, z) === 0) { this.popSet(x, y, z, r.next() < 0.4 ? B.flowering_azalea_leaves : B.azalea_leaves, 0); }
            else if (v < 0.38) this.popSet(x, y, z, B.lily_of_the_valley, 0);
          }
          if (stoneish(above) && r.next() < 0.45) this.popSet(x, y + 1, z, B.moss_block, 0);
        } else if (k === BI.DRIPSTONE_CAVES) {
          if (stoneish(below)) {
            if (r.next() < 0.45) this.popSet(x, y - 1, z, B.dripstone_block, 0);
            if (r.next() < 0.1) this.popSet(x, y, z, B.pointed_dripstone, 0);
          }
          if (stoneish(above)) {
            if (r.next() < 0.45) this.popSet(x, y + 1, z, B.dripstone_block, 0);
            if (r.next() < 0.12 && this.getBlock(x, y - 1, z) === 0) this.popSet(x, y, z, B.pointed_dripstone, 1);
          }
        } else if (k === BI.DEEP_DARK) {
          if (stoneish(below)) {
            this.popSet(x, y - 1, z, r.next() < 0.7 ? B.sculk : B.deepslate, 0);
            if (r.next() < 0.025) this.popSet(x, y, z, B.sculk_sensor, 0);
          }
          if (stoneish(above) && r.next() < 0.6) this.popSet(x, y + 1, z, r.next() < 0.5 ? B.deepslate : B.sculk, 0);
        }
      }
    }
  };

  /* ------------------------------------------------------------ */
  /* Plants must stand on something                               */
  /* ------------------------------------------------------------ */
  const GROUND_PLANTS = new Set([B.short_grass, B.fern, B.sunflower, B.cornflower, B.allium, B.orange_tulip, B.pink_tulip, B.lily_of_the_valley, B.pink_petals]);
  const canStay = W.canStay;
  W.canStay = function (id, x, y, z, meta) {
    if (GROUND_PLANTS.has(id)) return SOIL[this.getBlock(x, y - 1, z)] === 1;
    if (id === B.dead_bush) { const b = this.getBlock(x, y - 1, z); return SOLID[b] === 1 && OPAQUE[b] === 1; }
    if (id === B.lily_pad) return this.getBlock(x, y - 1, z) === B.water;
    if (id === B.bamboo) { const b = this.getBlock(x, y - 1, z); return b === B.bamboo || SOIL[b] === 1 || b === B.sand || b === B.gravel; }
    if (id === B.pointed_dripstone) return SOLID[this.getBlock(x, y + ((meta || this.getMeta(x, y, z)) & 1 ? 1 : -1), z)] === 1;
    return canStay.call(this, id, x, y, z, meta);
  };
  const neighborChanged = W.neighborChanged;
  W.neighborChanged = function (x, y, z) {
    const id = y >= 0 && y < CH ? this.getBlock(x, y, z) : 0;
    if (id && (GROUND_PLANTS.has(id) || id === B.dead_bush || id === B.lily_pad || id === B.bamboo || id === B.pointed_dripstone)) {
      if (!this.canStay(id, x, y, z)) this.destroyBlock(x, y, z, true);
      return;
    }
    return neighborChanged.call(this, x, y, z);
  };
  const cactusStay = W.canCactusStay;
  W.canCactusStay = function (x, y, z) {
    if (this.getBlock(x, y - 1, z) === B.red_sand) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (SOLID[this.getBlock(x + dx, y, z + dz)]) return false;
      return true;
    }
    return cactusStay.call(this, x, y, z);
  };

  /** The biome name the debug screen shows (cave biomes underground). */
  DL.biomeNameAt = function (w, x, y, z) {
    const c = w.getChunk(x >> 4, z >> 4);
    if (!c || !c.biomes) return '?';
    if ((w.dim || 0) === 0 && w.caveBiomeAt && y < w.topSolidY(x, z) - 10) { const k = w.caveBiomeAt(x, y, z); if (k >= 0) return S.BIOME_NAMES[k]; }
    return S.BIOME_NAMES[c.biomes[((z & 15) << 4) | (x & 15)]] || '?';
  };
})();
