/* DreamLand - items, recipes and smelting for the Nether, the End, the Aether and structures. */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, I = DL.Items;
  const def = I._def, shaped = I._shaped, shapeless = I._shapeless, smelt = I._smelt;

  // blocks that exist only as world features
  for (const id of [B.nether_portal, B.aether_portal, B.end_portal, B.nether_wart]) {
    const d = I.defs[id];
    if (d) { delete I.byName[d.name]; I.defs[id] = null; }
  }
  const rename = { dirt_path: 'Dirt Path', end_portal_frame: 'End Portal Frame', sea_lantern: 'Sea Lantern', hay_bale: 'Hay Bale' };
  for (const k in rename) if (I.byName[k]) I.byName[k].display = rename[k];

  def(341, 'slimeball', { display: 'Slimeball' });
  def(348, 'glowstone_dust', { display: 'Glowstone Dust' });
  def(351, 'bone_meal', { display: 'Bone Meal' });
  def(353, 'ink_sac', { display: 'Ink Sac' });
  def(367, 'rotten_flesh', { food: 4, display: 'Rotten Flesh' });
  def(368, 'ender_pearl', { maxStack: 16, display: 'Ender Pearl' });
  def(369, 'blaze_rod', { fuel: 2400, display: 'Blaze Rod' });
  def(370, 'ghast_tear', { display: 'Ghast Tear' });
  def(371, 'gold_nugget', { display: 'Gold Nugget' });
  def(372, 'nether_wart', { places: B.nether_wart, display: 'Nether Wart' });
  def(377, 'blaze_powder', { display: 'Blaze Powder' });
  def(378, 'magma_cream', { display: 'Magma Cream' });
  def(381, 'eye_of_ender', { display: 'Eye of Ender' });
  def(385, 'fire_charge', { display: 'Fire Charge' });
  def(388, 'emerald', { display: 'Emerald' });
  def(405, 'nether_brick', { display: 'Nether Brick' });
  def(406, 'quartz', { display: 'Nether Quartz' });
  def(411, 'raw_rabbit', { maxStack: 1, food: 3, display: 'Raw Rabbit' });
  def(412, 'cooked_rabbit', { maxStack: 1, food: 5, display: 'Cooked Rabbit' });
  def(415, 'rabbit_hide', { display: 'Rabbit Hide' });
  def(432, 'chorus_fruit', { food: 4, display: 'Chorus Fruit', teleports: true });
  def(433, 'popped_chorus_fruit', { display: 'Popped Chorus Fruit' });
  def(438, 'splash_potion', { maxStack: 1, display: 'Splash Potion', hidden: true });
  def(440, 'ambrosium_shard', { food: 4, display: 'Ambrosium Shard', fuel: 800 });
  def(441, 'zanite_gemstone', { display: 'Zanite Gemstone' });
  def(442, 'skyroot_stick', { fuel: 100, display: 'Skyroot Stick' });
  def(443, 'elytra', { maxStack: 1, armor: { slot: 1, points: 0 }, maxDamage: 432, display: 'Elytra', elytra: true });
  def(445, 'shulker_bullet', { display: 'Shulker Bullet', hidden: true });
  def(447, 'golden_amber', { display: 'Golden Amber' });
  def(450, 'shulker_shell', { display: 'Shulker Shell' });
  def(451, 'gravitite_plate', { display: 'Gravitite Plate' });

  // Aether tools
  const TOOL_DMG = { sword: 5, axe: 3, pickaxe: 2, shovel: 1, hoe: 1 };
  const AMATS = {
    zanite: { base: 460, level: 2, speed: 7, uses: 500, dmg: 2, name: 'Zanite', gem: 'zanite_gemstone' },
    gravitite: { base: 465, level: 3, speed: 9, uses: 1800, dmg: 3, name: 'Gravitite', gem: 'gravitite_plate' }
  };
  const TT = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'];
  for (const mat in AMATS) {
    const m = AMATS[mat];
    I.MATS[mat] = { level: m.level, speed: m.speed, uses: m.uses, dmg: m.dmg, name: m.name };
    TT.forEach((type, i) => {
      def(m.base + i, mat + '_' + type, {
        display: m.name + ' ' + I._titleCase(type), maxStack: 1, tool: { type, level: m.level, speed: m.speed }, maxDamage: m.uses,
        attack: TOOL_DMG[type] + (type === 'sword' ? m.dmg * 2 : type === 'hoe' ? 0 : m.dmg), icon: mat + '_' + type
      });
    });
  }

  // extra item art
  const A = DL.Tex.ITEM_ART;
  A.cooked_rabbit = [A.raw_rabbit[0], { o: [90, 40, 20], P: [190, 120, 70], p: [160, 90, 50] }, 3];
  A.gravitite_plate = [['................', '................', '................', '...oooooooooo...', '..oPPWPPPPPPPo..', '..oPWPPPPPPPpo..', '..oPPPPPPPPPpo..', '..oPPPPPPPPppo..', '...oooooooooo...'], { o: [60, 20, 60], P: [220, 110, 220], p: [170, 60, 170], W: [255, 200, 255] }, 4];

  /* ---------------- recipes ---------------- */
  const stairs = ['#  ', '## ', '###'];
  shapeless(['blaze_rod'], 'blaze_powder', 2);
  shapeless(['ender_pearl', 'blaze_powder'], 'eye_of_ender');
  shaped(['##', '##'], { '#': 'glowstone_dust' }, 'glowstone');
  shapeless(['gold_ingot'], 'gold_nugget', 9);
  shaped(['###', '###', '###'], { '#': 'gold_nugget' }, 'gold_ingot');
  shaped(['##', '##'], { '#': 'nether_brick' }, 'nether_bricks');
  shaped(['#X#', '#X#'], { '#': 'nether_bricks', X: 'nether_brick' }, 'nether_brick_fence', 6);
  shaped(stairs, { '#': 'nether_bricks' }, 'nether_brick_stairs', 4);
  shapeless(['bone'], 'bone_meal', 3);
  shaped(['###', '###', '###'], { '#': 'bone_meal' }, 'bone_block');
  shapeless(['bone_block'], 'bone_meal', 9);
  shaped(['##', '##'], { '#': 'stone' }, 'stone_bricks', 4);
  shaped(stairs, { '#': 'stone_bricks' }, 'stone_brick_stairs', 4);
  shapeless(['stone_bricks', 'vine' in I.byName ? 'vine' : 'mossy_cobblestone'], 'mossy_stone_bricks');
  shaped(['##', '##'], { '#': 'sand' }, 'sandstone');
  shaped(['#', '#'], { '#': 'sandstone' }, 'chiseled_sandstone');
  shaped(stairs, { '#': 'sandstone' }, 'sandstone_stairs', 4);
  shaped(['##', '##'], { '#': 'popped_chorus_fruit' }, 'purpur_block', 4);
  shaped(['#', '#'], { '#': 'purpur_block' }, 'purpur_pillar');
  shaped(stairs, { '#': 'purpur_block' }, 'purpur_stairs', 4);
  shaped(['X', '#'], { X: 'blaze_rod', '#': 'popped_chorus_fruit' }, 'end_rod', 4);
  shaped(['##', '##'], { '#': 'end_stone' }, 'end_stone_bricks', 4);
  shaped(['###', '###', '###'], { '#': 'emerald' }, 'emerald_block');
  shapeless(['emerald_block'], 'emerald', 9);
  shaped(['###', '###', '###'], { '#': 'wheat' }, 'hay_bale');
  shapeless(['hay_bale'], 'wheat', 9);
  shapeless(['gunpowder', 'blaze_powder', 'coal'], 'fire_charge', 3);
  shaped(['###', '###'], { '#': 'iron_ingot' }, 'iron_bars', 16);
  shaped(['# #', '# #', '###'], { '#': 'iron_ingot' }, 'cauldron');
  shaped(['X X', 'X#X', 'X X'], { X: 'iron_ingot', '#': 'stick' }, 'rail', 16);
  shapeless(['slimeball', 'blaze_powder'], 'magma_cream');
  shaped(['##', '##'], { '#': 'magma_cream' }, 'magma_block');
  shapeless(['dark_log'], 'dark_planks', 4);
  shaped(['#', '#'], { '#': 'dark_planks' }, 'stick', 4);
  shaped(['##', '##'], { '#': 'dark_planks' }, 'crafting_table');
  shapeless(['skyroot_log'], 'skyroot_planks', 4);
  shapeless(['golden_oak_log'], 'skyroot_planks', 4);
  shaped(['#', '#'], { '#': 'skyroot_planks' }, 'stick', 4);
  shaped(['#', '#'], { '#': 'skyroot_planks' }, 'skyroot_stick', 4);
  shaped(['##', '##'], { '#': 'skyroot_planks' }, 'crafting_table');
  shaped(['###', '# #', '###'], { '#': 'skyroot_planks' }, 'chest');
  shaped(['###', '# #', '###'], { '#': 'holystone' }, 'furnace');
  shaped(['##', '##'], { '#': 'holystone' }, 'holystone_bricks', 4);
  shaped(['###', '###', '###'], { '#': 'zanite_gemstone' }, 'zanite_block');
  shapeless(['zanite_block'], 'zanite_gemstone', 9);
  shaped(['X', '#'], { X: 'ambrosium_shard', '#': 'stick' }, 'torch', 2);
  shaped(['###', '#X#', '###'], { '#': 'glass', X: 'glowstone_dust' }, 'sea_lantern');
  for (const mat in AMATS) {
    for (const stick of ['stick', 'skyroot_stick']) {
      const X = AMATS[mat].gem, k = { X, '#': stick };
      shaped(['XXX', ' # ', ' # '], k, mat + '_pickaxe');
      shaped(['XX', 'X#', ' #'], k, mat + '_axe');
      shaped(['X', '#', '#'], k, mat + '_shovel');
      shaped(['X', 'X', '#'], k, mat + '_sword');
      shaped(['XX', ' #', ' #'], k, mat + '_hoe');
    }
  }

  /* ---------------- smelting ---------------- */
  const id = n => I.byName[n].id;
  smelt[B.netherrack] = id('nether_brick');
  smelt[id('chorus_fruit')] = id('popped_chorus_fruit');
  smelt[id('raw_rabbit')] = id('cooked_rabbit');
  smelt[B.quartz_ore] = id('quartz');
  smelt[B.emerald_ore] = id('emerald');
  smelt[B.zanite_ore] = id('zanite_gemstone');
  smelt[B.gravitite_ore] = id('gravitite_plate');
  smelt[B.stone_bricks] = B.cracked_stone_bricks;
  smelt[B.dark_log] = 263;
  smelt[B.skyroot_log] = 263;
  for (const n of ['dark_planks', 'dark_log', 'skyroot_planks', 'skyroot_log', 'golden_oak_log', 'hay_bale']) if (I.byName[n]) I.byName[n].fuel = 300;

  /* ---------------- drops ---------------- */
  const baseDrops = I.blockDrops;
  I.blockDrops = function (blockId, meta, stack, rng) {
    const r = () => rng ? rng.next() : Math.random();
    switch (blockId) {
      case B.nether_wart: return [I.stack(372, (meta & 3) >= 3 ? 2 + Math.floor(r() * 3) : 1)];
      case B.glowstone: return [I.stack(348, 2 + Math.floor(r() * 3))];
      case B.skyroot_leaves: return r() < 0.03 ? [I.stack(260)] : [];
      case B.golden_oak_leaves: return r() < 0.05 ? [I.stack(260)] : [];
      case B.golden_oak_log: return [I.stack(B.golden_oak_log), I.stack(447, 1 + Math.floor(r() * 2))];
      case B.chorus_plant: return r() < 0.5 ? [I.stack(432)] : [];
      case B.cobweb: return [I.stack(287)];
      case B.dirt_path: return [I.stack(B.dirt)];
    }
    return baseDrops(blockId, meta, stack, rng);
  };
})();
