/* DreamLand - items, tools, armor, food, crafting recipes and smelting. */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B;
  const I = DL.Items = {};

  const defs = new Array(512).fill(null);
  const byName = {};
  I.defs = defs;
  I.byName = byName;

  function titleCase(s) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

  function def(id, name, o) {
    const d = Object.assign({ id, name, display: titleCase(name), maxStack: 64, isBlock: false }, o || {});
    defs[id] = d;
    byName[name] = d;
    return d;
  }

  // Block items
  const HIDDEN = new Set([0, B.water, B.lava, B.fire, B.wheat, B.wooden_door, B.lit_furnace, B.farmland, B.double_slab]);
  const BLOCK_NAMES = {
    grass: 'Grass Block', planks: 'Wooden Planks', log: 'Wood', leaves: 'Leaves', wool: 'Wool', dandelion: 'Dandelion', rose: 'Rose',
    slab: 'Stone Slab', tnt: 'TNT', mossy_cobblestone: 'Moss Stone', torch: 'Torch', spawner: 'Monster Spawner',
    wood_stairs: 'Wooden Stairs', cobble_stairs: 'Cobblestone Stairs', crafting_table: 'Workbench', snow_layer: 'Snow',
    snow_block: 'Snow Block', reeds: 'Sugar Canes', jack_o_lantern: "Jack 'o' Lantern"
  };
  for (let id = 1; id < 256; id++) {
    const b = S.blocks[id];
    if (!b || HIDDEN.has(id)) continue;
    def(id, b.name, { isBlock: true, block: id, display: BLOCK_NAMES[b.name] || titleCase(b.name), flat: b.render !== S.R.CUBE && b.render !== S.R.SLAB && b.render !== S.R.STAIRS && b.render !== S.R.FENCE && b.render !== S.R.CACTUS && b.render !== S.R.SNOW });
  }

  // Tools
  const MATS = {
    wood: { level: 0, speed: 2, uses: 59, dmg: 0, name: 'Wooden' },
    stone: { level: 1, speed: 4, uses: 131, dmg: 1, name: 'Stone' },
    iron: { level: 2, speed: 6, uses: 250, dmg: 2, name: 'Iron' },
    diamond: { level: 3, speed: 8, uses: 1561, dmg: 3, name: 'Diamond' },
    gold: { level: 0, speed: 12, uses: 32, dmg: 0, name: 'Golden' }
  };
  I.MATS = MATS;
  const TOOL_IDS = {
    iron: { shovel: 256, pickaxe: 257, axe: 258, sword: 267, hoe: 292 },
    wood: { sword: 268, shovel: 269, pickaxe: 270, axe: 271, hoe: 290 },
    stone: { sword: 272, shovel: 273, pickaxe: 274, axe: 275, hoe: 291 },
    diamond: { sword: 276, shovel: 277, pickaxe: 278, axe: 279, hoe: 293 },
    gold: { sword: 283, shovel: 284, pickaxe: 285, axe: 286, hoe: 294 }
  };
  const TOOL_DMG = { sword: 5, axe: 3, pickaxe: 2, shovel: 1, hoe: 1 };
  for (const mat in TOOL_IDS) {
    for (const type in TOOL_IDS[mat]) {
      const m = MATS[mat];
      def(TOOL_IDS[mat][type], mat + '_' + type, {
        display: m.name + ' ' + titleCase(type === 'shovel' ? 'shovel' : type),
        maxStack: 1, tool: { type, level: m.level, speed: m.speed }, maxDamage: m.uses,
        attack: TOOL_DMG[type] + (type === 'sword' ? m.dmg * 2 : type === 'hoe' ? 0 : m.dmg),
        icon: mat + '_' + type, fuel: mat === 'wood' ? 200 : 0
      });
    }
  }

  def(259, 'flint_and_steel', { maxStack: 1, maxDamage: 64, display: 'Flint and Steel' });
  def(260, 'apple', { maxStack: 1, food: 4 });
  def(261, 'bow', { maxStack: 1, maxDamage: 384 });
  def(262, 'arrow');
  def(263, 'coal', { fuel: 1600 });
  def(264, 'diamond');
  def(265, 'iron_ingot', { display: 'Iron Ingot' });
  def(266, 'gold_ingot', { display: 'Gold Ingot' });
  def(280, 'stick', { fuel: 100 });
  def(281, 'bowl', { fuel: 100 });
  def(282, 'mushroom_stew', { maxStack: 1, food: 10, returns: 281, display: 'Mushroom Soup' });
  def(287, 'string');
  def(288, 'feather');
  def(289, 'gunpowder', { display: 'Sulphur' });
  def(295, 'seeds', { places: B.wheat });
  def(296, 'wheat');
  def(297, 'bread', { maxStack: 1, food: 5 });
  const ARMOR_IDS = { leather: 298, iron: 306, diamond: 310, gold: 314 };
  const ARMOR_BASE = [11, 16, 15, 13];
  const ARMOR_MULT = { leather: 5, iron: 15, diamond: 33, gold: 7 };
  const ARMOR_PIECES = ['helmet', 'chestplate', 'leggings', 'boots'];
  const ARMOR_POINTS = [3, 8, 6, 3];
  const ARMOR_NAMES = { leather: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots'] };
  for (const mat in ARMOR_IDS) {
    ARMOR_PIECES.forEach((p, i) => {
      def(ARMOR_IDS[mat] + i, mat + '_' + p, {
        maxStack: 1, armor: { slot: i, points: ARMOR_POINTS[i] }, maxDamage: ARMOR_BASE[i] * ARMOR_MULT[mat],
        icon: mat + '_' + p, display: ARMOR_NAMES[mat] ? ARMOR_NAMES[mat][i] : MATS[mat].name + ' ' + titleCase(p)
      });
    });
  }
  def(318, 'flint');
  def(319, 'porkchop_raw', { maxStack: 1, food: 3, display: 'Raw Porkchop' });
  def(320, 'porkchop_cooked', { maxStack: 1, food: 8, display: 'Cooked Porkchop' });
  def(322, 'golden_apple', { maxStack: 1, food: 20, display: 'Golden Apple' });
  def(324, 'wooden_door', { maxStack: 1, display: 'Wooden Door' });
  def(325, 'bucket', { maxStack: 1 });
  def(326, 'water_bucket', { maxStack: 1, display: 'Water Bucket' });
  def(327, 'lava_bucket', { maxStack: 1, display: 'Lava Bucket', fuel: 20000 });
  def(329, 'saddle', { maxStack: 1 });
  def(331, 'redstone', { display: 'Redstone' });
  def(332, 'snowball', { maxStack: 16 });
  def(334, 'leather');
  def(335, 'milk_bucket', { maxStack: 1, display: 'Milk' });
  def(336, 'brick', { display: 'Clay Brick' });
  def(337, 'clay_ball', { display: 'Clay' });
  def(338, 'reeds', { places: B.reeds, display: 'Sugar Canes' });
  def(339, 'paper');
  def(340, 'book');
  def(344, 'egg', { maxStack: 16 });
  def(349, 'fish_raw', { maxStack: 1, food: 2, display: 'Raw Fish' });
  def(350, 'fish_cooked', { maxStack: 1, food: 5, display: 'Cooked Fish' });
  def(352, 'bone');

  // Fuel for wooden blocks
  for (const n of ['planks', 'log', 'crafting_table', 'chest', 'bookshelf', 'fence', 'wood_stairs']) byName[n].fuel = 300;
  byName.sapling.fuel = 100;

  I.get = id => defs[id];
  I.id = name => byName[name].id;
  I.maxStack = id => defs[id] ? defs[id].maxStack : 64;
  I.name = id => defs[id] ? defs[id].display : '???';

  /* ------------------------------------------------------------ */
  /* Item stacks                                                  */
  /* ------------------------------------------------------------ */
  I.stack = function (id, count, dmg) { return { id, count: count === undefined ? 1 : count, dmg: dmg || 0 }; };
  I.copy = s => s ? { id: s.id, count: s.count, dmg: s.dmg || 0 } : null;
  I.same = (a, b) => a && b && a.id === b.id && (a.dmg || 0) === (b.dmg || 0) && !defs[a.id].maxDamage;

  /* ------------------------------------------------------------ */
  /* Mining                                                       */
  /* ------------------------------------------------------------ */
  I.canHarvest = function (blockId, stack) {
    const b = S.blocks[blockId];
    if (!b) return false;
    if (b.tool === 'pickaxe' || blockId === B.snow_layer || blockId === B.snow_block) {
      const d = stack && defs[stack.id];
      if (!d || !d.tool || d.tool.type !== b.tool) return false;
      return d.tool.level >= Math.max(0, b.tier - 1);
    }
    return true;
  };
  I.digSpeed = function (blockId, stack) {
    const b = S.blocks[blockId];
    const d = stack && defs[stack.id];
    if (d && d.tool && b.tool && d.tool.type === b.tool) return d.tool.speed;
    if (d && d.tool && d.tool.type === 'sword' && blockId === B.leaves) return 1.5;
    return 1;
  };
  /** progress per tick (0..1) */
  I.breakRate = function (blockId, stack, inWater, onGround) {
    const b = S.blocks[blockId];
    if (!b || b.hardness < 0) return 0;
    if (b.hardness === 0) return 1;
    let r = I.digSpeed(blockId, stack) / b.hardness / (I.canHarvest(blockId, stack) ? 30 : 100);
    if (inWater) r /= 5;
    if (!onGround) r /= 5;
    return r;
  };
  I.attackDamage = function (stack) {
    const d = stack && defs[stack.id];
    return d && d.attack ? d.attack : 1;
  };

  /** Items dropped when a block is broken. Returns array of stacks. */
  I.blockDrops = function (blockId, meta, stack, rng) {
    const b = S.blocks[blockId];
    const r = () => rng ? rng.next() : Math.random();
    if (!b) return [];
    if (!I.canHarvest(blockId, stack)) return [];
    switch (blockId) {
      case B.coal_ore: return [I.stack(263)];
      case B.diamond_ore: return [I.stack(264)];
      case B.redstone_ore: return [I.stack(331, 4 + (r() < 0.5 ? 1 : 0))];
      case B.leaves: {
        if (meta & 4) return [];
        const out = [];
        if (r() < 0.05) out.push(I.stack(B.sapling));
        if (r() < 0.005) out.push(I.stack(260));
        return out;
      }
      case B.gravel: return r() < 0.1 ? [I.stack(318)] : [I.stack(B.gravel)];
      case B.clay: return [I.stack(337, 4)];
      case B.snow_block: return [I.stack(332, 4)];
      case B.snow_layer: return [I.stack(332, 1)];
      case B.wheat: {
        const out = [];
        if ((meta & 7) >= 7) out.push(I.stack(296));
        let n = (meta & 7) >= 7 ? 1 + Math.floor(r() * 3) : 0;
        for (let i = 0; i < 3; i++) if (r() <= (meta & 7) / 15) n++;
        if (n) out.push(I.stack(295, Math.min(n, 3)));
        return out;
      }
      case B.wooden_door: return (meta & 8) ? [] : [I.stack(324)];
      case B.reeds: return [I.stack(338)];
      case B.glass: case B.ice: case B.bookshelf: case B.spawner: case B.fire: return [];
      case B.double_slab: return [I.stack(B.slab, 2)];
    }
    if (!b.drop) return [];
    return [I.stack(b.drop, b.dropCount || 1)];
  };

  /* ------------------------------------------------------------ */
  /* Crafting                                                     */
  /* ------------------------------------------------------------ */
  const recipes = [];
  I.recipes = recipes;
  function key(k) { return typeof k === 'number' ? k : byName[k].id; }
  function shaped(pattern, keys, result, count) {
    const map = {};
    for (const c in keys) map[c] = key(keys[c]);
    const h = pattern.length, w = Math.max(...pattern.map(r => r.length));
    const grid = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = pattern[y][x];
      grid.push(ch && ch !== ' ' ? map[ch] : 0);
    }
    recipes.push({ w, h, grid, result: key(result), count: count || 1 });
  }
  function shapeless(ingredients, result, count) {
    recipes.push({ shapeless: ingredients.map(key).sort(), result: key(result), count: count || 1 });
  }

  shapeless(['log'], 'planks', 4);
  shaped(['#', '#'], { '#': 'planks' }, 'stick', 4);
  shaped(['X', '#'], { X: 'coal', '#': 'stick' }, 'torch', 4);
  shaped(['##', '##'], { '#': 'planks' }, 'crafting_table');
  shaped(['###', '# #', '###'], { '#': 'cobblestone' }, 'furnace');
  shaped(['###', '# #', '###'], { '#': 'planks' }, 'chest');
  const toolMats = { wood: 'planks', stone: 'cobblestone', iron: 'iron_ingot', gold: 'gold_ingot', diamond: 'diamond' };
  for (const m in toolMats) {
    const X = toolMats[m];
    shaped(['XXX', ' # ', ' # '], { X, '#': 'stick' }, m + '_pickaxe');
    shaped(['XX', 'X#', ' #'], { X, '#': 'stick' }, m + '_axe');
    shaped(['X', '#', '#'], { X, '#': 'stick' }, m + '_shovel');
    shaped(['X', 'X', '#'], { X, '#': 'stick' }, m + '_sword');
    shaped(['XX', ' #', ' #'], { X, '#': 'stick' }, m + '_hoe');
  }
  const armorMats = { leather: 'leather', iron: 'iron_ingot', gold: 'gold_ingot', diamond: 'diamond' };
  for (const m in armorMats) {
    const X = armorMats[m];
    shaped(['XXX', 'X X'], { X }, m + '_helmet');
    shaped(['X X', 'XXX', 'XXX'], { X }, m + '_chestplate');
    shaped(['XXX', 'X X', 'X X'], { X }, m + '_leggings');
    shaped(['X X', 'X X'], { X }, m + '_boots');
  }
  for (const [blk, ing] of [['iron_block', 'iron_ingot'], ['gold_block', 'gold_ingot'], ['diamond_block', 'diamond']]) {
    shaped(['XXX', 'XXX', 'XXX'], { X: ing }, blk);
    shapeless([blk], ing, 9);
  }
  shaped([' #X', '# X', ' #X'], { '#': 'stick', X: 'string' }, 'bow');
  shaped(['X', '#', 'Y'], { X: 'flint', '#': 'stick', Y: 'feather' }, 'arrow', 4);
  shaped(['XXX'], { X: 'wheat' }, 'bread');
  shaped(['X X', ' X '], { X: 'planks' }, 'bowl', 4);
  shaped(['Y', 'X', '#'], { Y: 'brown_mushroom', X: 'red_mushroom', '#': 'bowl' }, 'mushroom_stew');
  shaped(['Y', 'X', '#'], { Y: 'red_mushroom', X: 'brown_mushroom', '#': 'bowl' }, 'mushroom_stew');
  shaped(['###', '#X#', '###'], { '#': 'gold_block', X: 'apple' }, 'golden_apple');
  shaped(['# #', '###', '# #'], { '#': 'stick' }, 'ladder', 2);
  shaped(['###', '###'], { '#': 'stick' }, 'fence', 2);
  shaped(['#  ', '## ', '###'], { '#': 'planks' }, 'wood_stairs', 4);
  shaped(['#  ', '## ', '###'], { '#': 'cobblestone' }, 'cobble_stairs', 4);
  shaped(['###'], { '#': 'stone' }, 'slab', 3);
  shaped(['##', '##', '##'], { '#': 'planks' }, 'wooden_door');
  shaped(['# #', ' # '], { '#': 'iron_ingot' }, 'bucket');
  shapeless(['iron_ingot', 'flint'], 'flint_and_steel');
  shaped(['X#X', '#X#', 'X#X'], { X: 'gunpowder', '#': 'sand' }, 'tnt');
  shaped(['###', 'XXX', '###'], { '#': 'planks', X: 'book' }, 'bookshelf');
  shaped(['X', 'X', 'X'], { X: 'paper' }, 'book');
  shaped(['XXX'], { X: 'reeds' }, 'paper', 3);
  shaped(['XX', 'XX'], { X: 'snowball' }, 'snow_block');
  shaped(['XX', 'XX'], { X: 'clay_ball' }, 'clay');
  shaped(['XX', 'XX'], { X: 'brick' }, 'bricks');
  shaped(['XX', 'XX'], { X: 'string' }, 'wool');
  shaped(['A', 'B'], { A: 'pumpkin', B: 'torch' }, 'jack_o_lantern');
  shaped(['X X', 'XXX'], { X: 'leather' }, 'saddle');

  /** grid: array of stacks (length w*w). Returns result stack or null. */
  I.matchRecipe = function (grid, size) {
    let minX = size, minY = size, maxX = -1, maxY = -1;
    const ids = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const s = grid[y * size + x];
      if (s) { ids.push(s.id); if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    }
    if (!ids.length) return null;
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const sortedIds = ids.slice().sort((a, b) => a - b);
    for (const r of recipes) {
      if (r.shapeless) {
        if (r.shapeless.length !== sortedIds.length) continue;
        let ok = true;
        const rs = r.shapeless.slice().sort((a, b) => a - b);
        for (let i = 0; i < rs.length; i++) if (rs[i] !== sortedIds[i]) { ok = false; break; }
        if (ok) return I.stack(r.result, r.count);
        continue;
      }
      if (r.w !== w || r.h !== h) continue;
      for (let mirror = 0; mirror < 2; mirror++) {
        let ok = true;
        for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
          const need = r.grid[y * w + (mirror ? w - 1 - x : x)];
          const s = grid[(minY + y) * size + minX + x];
          const have = s ? s.id : 0;
          if (need !== have) ok = false;
        }
        if (ok) return I.stack(r.result, r.count);
      }
    }
    return null;
  };

  /* ------------------------------------------------------------ */
  /* Smelting                                                     */
  /* ------------------------------------------------------------ */
  const smelt = {};
  smelt[B.iron_ore] = 265; smelt[B.gold_ore] = 266; smelt[B.sand] = B.glass; smelt[B.cobblestone] = B.stone;
  smelt[337] = 336; smelt[319] = 320; smelt[349] = 350; smelt[B.diamond_ore] = 264; smelt[B.log] = 263; smelt[B.clay] = B.bricks;
  I._def = def; I._shaped = shaped; I._shapeless = shapeless; I._smelt = smelt; I._titleCase = titleCase;
  I.smeltResult = id => smelt[id] ? I.stack(smelt[id]) : null;
  I.fuelTime = id => (defs[id] && defs[id].fuel) || 0;

  /** Every obtainable item id (for commands). */
  I.all = () => defs.filter(Boolean);
  I.find = function (q) {
    q = String(q).toLowerCase().replace(/^minecraft:/, '');
    if (/^\d+$/.test(q)) return defs[+q] || null;
    return byName[q] || defs.find(d => d && d.display.toLowerCase() === q.replace(/_/g, ' ')) || null;
  };
})();
