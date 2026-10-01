/*
 * DreamLand - shared engine core.
 *
 * Everything in this factory is self-contained so that it can be stringified
 * and booted inside a Web Worker (terrain generation + chunk meshing) as well
 * as on the main thread. Do not reference outer globals from inside it.
 */
function DL_SHARED_FACTORY() {
  'use strict';
  const S = {};
  const CH = 128;            // world height
  const SEA = 63;            // highest water block of the ocean
  S.CH = CH;
  S.SEA = SEA;

  /* ------------------------------------------------------------------ */
  /* Texture tiles (terrain atlas, 16x16 grid of 16px tiles)             */
  /* ------------------------------------------------------------------ */
  const TILE_NAMES = [
    'grass_top', 'grass_side', 'dirt', 'stone', 'cobblestone', 'planks', 'bedrock', 'sand',
    'gravel', 'log_side', 'log_top', 'leaves', 'leaves_opaque', 'sponge', 'glass', 'wool',
    'gold_ore', 'iron_ore', 'coal_ore', 'diamond_ore', 'redstone_ore', 'gold_block', 'iron_block', 'diamond_block',
    'bricks', 'mossy_cobblestone', 'obsidian', 'slab_side', 'slab_top', 'tnt_side', 'tnt_top', 'tnt_bottom',
    'bookshelf', 'dandelion', 'rose', 'brown_mushroom', 'red_mushroom', 'sapling', 'reeds', 'torch',
    'fire', 'spawner', 'chest_top', 'chest_side', 'chest_front', 'crafting_table_top', 'crafting_table_side', 'crafting_table_front',
    'furnace_side', 'furnace_top', 'furnace_front', 'furnace_front_lit', 'wheat_0', 'wheat_1', 'wheat_2', 'wheat_3',
    'wheat_4', 'wheat_5', 'wheat_6', 'wheat_7', 'farmland_dry', 'farmland_wet', 'door_top', 'door_bottom',
    'ladder', 'snow', 'grass_side_snow', 'ice', 'cactus_side', 'cactus_top', 'cactus_bottom', 'clay',
    'pumpkin_top', 'pumpkin_side', 'pumpkin_face', 'jack_o_lantern_face', 'water', 'water_flow', 'lava', 'lava_flow',
    'destroy_0', 'destroy_1', 'destroy_2', 'destroy_3', 'destroy_4', 'destroy_5', 'destroy_6', 'destroy_7',
    'destroy_8', 'destroy_9', 'white', 'fire_2',
    // overworld structures
    'sandstone_top', 'sandstone_side', 'sandstone_bottom', 'chiseled_sandstone', 'cobweb', 'rail', 'stone_bricks', 'mossy_stone_bricks',
    'cracked_stone_bricks', 'iron_bars', 'dark_planks', 'dark_log_side', 'dark_log_top', 'prismarine', 'prismarine_bricks', 'dark_prismarine',
    'sea_lantern', 'hay_side', 'hay_top', 'terracotta', 'emerald_ore', 'emerald_block', 'dirt_path_top', 'dirt_path_side',
    'bone_block_side', 'bone_block_top', 'cauldron_side', 'cauldron_top', 'cauldron_inner',
    // nether
    'netherrack', 'soul_sand', 'glowstone', 'nether_portal', 'nether_bricks', 'nether_wart_0', 'nether_wart_1', 'nether_wart_2',
    'quartz_ore', 'magma', 'blackstone', 'blackstone_top', 'polished_blackstone_bricks', 'gilded_blackstone', 'crying_obsidian',
    // end
    'end_stone', 'end_portal', 'end_frame_side', 'end_frame_top', 'end_frame_eye', 'dragon_egg', 'purpur_block', 'purpur_pillar_side',
    'purpur_pillar_top', 'end_stone_bricks', 'end_rod', 'chorus_plant', 'chorus_flower',
    // aether
    'aether_grass_top', 'aether_grass_side', 'aether_dirt', 'holystone', 'mossy_holystone', 'holystone_bricks', 'quicksoil', 'icestone',
    'ambrosium_ore', 'zanite_ore', 'gravitite_ore', 'skyroot_log_side', 'skyroot_log_top', 'skyroot_planks', 'skyroot_leaves', 'golden_oak_log_side',
    'golden_oak_leaves', 'aercloud', 'blue_aercloud', 'aether_portal', 'purple_flower', 'white_flower', 'zanite_block'
  ];
  const T = {};
  for (let i = 0; i < TILE_NAMES.length; i++) T[TILE_NAMES[i]] = i;
  S.TILE_NAMES = TILE_NAMES;
  S.T = T;

  /* ------------------------------------------------------------------ */
  /* Blocks                                                             */
  /* ------------------------------------------------------------------ */
  const R = {
    NONE: 0, CUBE: 1, CROSS: 2, TORCH: 3, LIQUID: 4, SLAB: 5, STAIRS: 6, CACTUS: 7,
    SNOW: 8, FARMLAND: 9, LADDER: 10, FENCE: 11, DOOR: 12, CROPS: 13, FIRE: 14, SHAPE: 15, PORTAL: 16
  };
  S.R = R;

  const RENDER = new Uint8Array(256);
  const OPAQUE = new Uint8Array(256);     // full opaque cube: culls faces, casts AO
  const SOLID = new Uint8Array(256);      // has collision
  const LAYER = new Uint8Array(256);      // 0 = opaque/cutout, 1 = translucent
  const LOPAC = new Uint8Array(256);      // light opacity 0..15
  const LEMIT = new Uint8Array(256);      // light emission 0..15
  const SELFCULL = new Uint8Array(256);   // hides faces against same block
  const REPLACE = new Uint8Array(256);    // can be replaced when placing
  const LIQUID = new Uint8Array(256);
  const TEX = new Int16Array(256 * 6);    // per-face default tile
  const blocks = new Array(256).fill(null);
  const B = {};

  function def(id, name, o) {
    const d = Object.assign({
      id, name, render: R.CUBE, opaque: true, solid: true, layer: 0,
      lightOpacity: undefined, emit: 0, hardness: 1, tool: null, tier: 0,
      sound: 'stone', selfCull: false, replaceable: false, liquid: false,
      drop: undefined, dropCount: 1, slip: 0.6, flammable: false, cutout: false
    }, o);
    if (d.render !== R.CUBE) d.opaque = o.opaque === true;
    if (d.lightOpacity === undefined) d.lightOpacity = d.opaque ? 15 : 0;
    if (d.drop === undefined) d.drop = id;
    const t = d.tex;
    let faces;
    if (typeof t === 'string') faces = [t, t, t, t, t, t];
    else if (t) {
      const side = t.side || t.all;
      faces = [t.bottom || t.all || side, t.top || t.all || side, t.north || side, t.south || side, t.west || side, t.east || side];
    } else faces = ['white', 'white', 'white', 'white', 'white', 'white'];
    for (let f = 0; f < 6; f++) {
      if (T[faces[f]] === undefined) throw new Error('missing tile ' + faces[f]);
      TEX[id * 6 + f] = T[faces[f]];
    }
    d.icon = T[faces[2]];
    blocks[id] = d;
    B[name] = id;
    RENDER[id] = d.render;
    OPAQUE[id] = d.opaque ? 1 : 0;
    SOLID[id] = d.solid ? 1 : 0;
    LAYER[id] = d.layer;
    LOPAC[id] = d.lightOpacity;
    LEMIT[id] = d.emit;
    SELFCULL[id] = d.selfCull ? 1 : 0;
    REPLACE[id] = d.replaceable ? 1 : 0;
    LIQUID[id] = d.liquid ? 1 : 0;
    return d;
  }

  def(0, 'air', { render: R.NONE, solid: false, opaque: false, replaceable: true, hardness: 0, drop: 0 });
  def(1, 'stone', { tex: 'stone', hardness: 1.5, tool: 'pickaxe', drop: 4 });
  def(2, 'grass', { tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: 0.6, tool: 'shovel', sound: 'grass', drop: 3 });
  def(3, 'dirt', { tex: 'dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel' });
  def(4, 'cobblestone', { tex: 'cobblestone', hardness: 2, tool: 'pickaxe' });
  def(5, 'planks', { tex: 'planks', hardness: 2, tool: 'axe', sound: 'wood', flammable: true });
  def(6, 'sapling', { tex: 'sapling', render: R.CROSS, solid: false, hardness: 0, sound: 'grass', cutout: true, flammable: true });
  def(7, 'bedrock', { tex: 'bedrock', hardness: -1 });
  def(8, 'water', { tex: { all: 'water', side: 'water_flow' }, render: R.LIQUID, solid: false, layer: 1, lightOpacity: 3, selfCull: true, replaceable: true, liquid: true, hardness: 100, drop: 0 });
  def(10, 'lava', { tex: { all: 'lava', side: 'lava_flow' }, render: R.LIQUID, solid: false, lightOpacity: 15, emit: 15, selfCull: true, replaceable: true, liquid: true, hardness: 100, drop: 0 });
  def(12, 'sand', { tex: 'sand', hardness: 0.5, tool: 'shovel', sound: 'sand' });
  def(13, 'gravel', { tex: 'gravel', hardness: 0.6, tool: 'shovel', sound: 'gravel' });
  def(14, 'gold_ore', { tex: 'gold_ore', hardness: 3, tool: 'pickaxe', tier: 3 });
  def(15, 'iron_ore', { tex: 'iron_ore', hardness: 3, tool: 'pickaxe', tier: 2 });
  def(16, 'coal_ore', { tex: 'coal_ore', hardness: 3, tool: 'pickaxe', tier: 1 });
  def(17, 'log', { tex: { top: 'log_top', bottom: 'log_top', side: 'log_side' }, hardness: 2, tool: 'axe', sound: 'wood', flammable: true });
  def(18, 'leaves', { tex: 'leaves', render: R.CUBE, hardness: 0.2, sound: 'grass', lightOpacity: 1, cutout: true, flammable: true });
  def(19, 'sponge', { tex: 'sponge', hardness: 0.6, sound: 'grass' });
  def(20, 'glass', { tex: 'glass', render: R.CUBE, hardness: 0.3, sound: 'glass', lightOpacity: 0, selfCull: true, cutout: true, drop: 0 });
  def(35, 'wool', { tex: 'wool', hardness: 0.8, sound: 'cloth', flammable: true });
  def(37, 'dandelion', { tex: 'dandelion', render: R.CROSS, solid: false, hardness: 0, sound: 'grass', cutout: true });
  def(38, 'rose', { tex: 'rose', render: R.CROSS, solid: false, hardness: 0, sound: 'grass', cutout: true });
  def(39, 'brown_mushroom', { tex: 'brown_mushroom', render: R.CROSS, solid: false, hardness: 0, sound: 'grass', emit: 1, cutout: true });
  def(40, 'red_mushroom', { tex: 'red_mushroom', render: R.CROSS, solid: false, hardness: 0, sound: 'grass', cutout: true });
  def(41, 'gold_block', { tex: 'gold_block', hardness: 3, tool: 'pickaxe', tier: 3, sound: 'metal' });
  def(42, 'iron_block', { tex: 'iron_block', hardness: 5, tool: 'pickaxe', tier: 2, sound: 'metal' });
  def(43, 'double_slab', { tex: { top: 'slab_top', bottom: 'slab_top', side: 'slab_side' }, hardness: 2, tool: 'pickaxe', drop: 44, dropCount: 2 });
  def(44, 'slab', { tex: { top: 'slab_top', bottom: 'slab_top', side: 'slab_side' }, render: R.SLAB, hardness: 2, tool: 'pickaxe' });
  def(45, 'bricks', { tex: 'bricks', hardness: 2, tool: 'pickaxe' });
  def(46, 'tnt', { tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hardness: 0, sound: 'grass', flammable: true });
  def(47, 'bookshelf', { tex: { top: 'planks', bottom: 'planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe', sound: 'wood', drop: 0, flammable: true });
  def(48, 'mossy_cobblestone', { tex: 'mossy_cobblestone', hardness: 2, tool: 'pickaxe' });
  def(49, 'obsidian', { tex: 'obsidian', hardness: 10, tool: 'pickaxe', tier: 4 });
  def(50, 'torch', { tex: 'torch', render: R.TORCH, solid: false, hardness: 0, emit: 14, sound: 'wood', cutout: true });
  def(51, 'fire', { tex: 'fire', render: R.FIRE, solid: false, hardness: 0, emit: 15, replaceable: true, drop: 0, cutout: true });
  def(52, 'spawner', { tex: 'spawner', render: R.CUBE, hardness: 5, tool: 'pickaxe', lightOpacity: 0, drop: 0, cutout: true, sound: 'metal' });
  def(53, 'wood_stairs', { tex: 'planks', render: R.STAIRS, hardness: 2, tool: 'axe', sound: 'wood', flammable: true });
  def(54, 'chest', { tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side' }, hardness: 2.5, tool: 'axe', sound: 'wood' });
  def(56, 'diamond_ore', { tex: 'diamond_ore', hardness: 3, tool: 'pickaxe', tier: 3 });
  def(57, 'diamond_block', { tex: 'diamond_block', hardness: 5, tool: 'pickaxe', tier: 3, sound: 'metal' });
  def(58, 'crafting_table', { tex: { top: 'crafting_table_top', bottom: 'planks', side: 'crafting_table_side', north: 'crafting_table_front', south: 'crafting_table_front' }, hardness: 2.5, tool: 'axe', sound: 'wood' });
  def(59, 'wheat', { tex: 'wheat_7', render: R.CROPS, solid: false, hardness: 0, sound: 'grass', cutout: true, drop: 0 });
  def(60, 'farmland', { tex: { top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, render: R.FARMLAND, hardness: 0.6, tool: 'shovel', sound: 'gravel', lightOpacity: 15, drop: 3 });
  def(61, 'furnace', { tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side' }, hardness: 3.5, tool: 'pickaxe' });
  def(62, 'lit_furnace', { tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side' }, hardness: 3.5, tool: 'pickaxe', emit: 13, drop: 61 });
  def(64, 'wooden_door', { tex: 'door_bottom', render: R.DOOR, hardness: 3, tool: 'axe', sound: 'wood', cutout: true, drop: 0 });
  def(65, 'ladder', { tex: 'ladder', render: R.LADDER, solid: false, hardness: 0.4, tool: 'axe', sound: 'wood', cutout: true });
  def(67, 'cobble_stairs', { tex: 'cobblestone', render: R.STAIRS, hardness: 2, tool: 'pickaxe' });
  def(73, 'redstone_ore', { tex: 'redstone_ore', hardness: 3, tool: 'pickaxe', tier: 3 });
  def(78, 'snow_layer', { tex: 'snow', render: R.SNOW, solid: false, hardness: 0.1, tool: 'shovel', sound: 'cloth', replaceable: true });
  def(79, 'ice', { tex: 'ice', render: R.CUBE, layer: 1, lightOpacity: 3, hardness: 0.5, sound: 'glass', selfCull: true, drop: 0, slip: 0.98 });
  def(80, 'snow_block', { tex: 'snow', hardness: 0.2, tool: 'shovel', sound: 'cloth' });
  def(81, 'cactus', { tex: { top: 'cactus_top', bottom: 'cactus_bottom', side: 'cactus_side' }, render: R.CACTUS, hardness: 0.4, sound: 'cloth', cutout: true });
  def(82, 'clay', { tex: 'clay', hardness: 0.6, tool: 'shovel', sound: 'gravel' });
  def(83, 'reeds', { tex: 'reeds', render: R.CROSS, solid: false, hardness: 0, sound: 'grass', cutout: true });
  def(85, 'fence', { tex: 'planks', render: R.FENCE, hardness: 2, tool: 'axe', sound: 'wood', flammable: true });
  def(86, 'pumpkin', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side' }, hardness: 1, tool: 'axe', sound: 'wood' });
  def(91, 'jack_o_lantern', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side' }, hardness: 1, tool: 'axe', sound: 'wood', emit: 15 });

  /* ---- structure blocks ---- */
  const PK = (o) => Object.assign({ hardness: 1.5, tool: 'pickaxe' }, o);
  def(24, 'sandstone', PK({ tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' }, hardness: 0.8 }));
  def(95, 'chiseled_sandstone', PK({ tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'chiseled_sandstone' }, hardness: 0.8 }));
  def(128, 'sandstone_stairs', PK({ tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' }, render: R.STAIRS, hardness: 0.8 }));
  def(30, 'cobweb', { tex: 'cobweb', render: R.CROSS, solid: false, hardness: 4, cutout: true, sound: 'cloth', drop: 287 });
  def(66, 'rail', { tex: 'rail', render: R.SHAPE, solid: false, hardness: 0.7, cutout: true, sound: 'metal' });
  def(98, 'stone_bricks', PK({ tex: 'stone_bricks' }));
  def(92, 'mossy_stone_bricks', PK({ tex: 'mossy_stone_bricks' }));
  def(93, 'cracked_stone_bricks', PK({ tex: 'cracked_stone_bricks' }));
  def(109, 'stone_brick_stairs', PK({ tex: 'stone_bricks', render: R.STAIRS }));
  def(101, 'iron_bars', PK({ tex: 'iron_bars', render: R.SHAPE, hardness: 5, cutout: true, sound: 'metal' }));
  def(97, 'dark_planks', { tex: 'dark_planks', hardness: 2, tool: 'axe', sound: 'wood', flammable: true });
  def(99, 'dark_log', { tex: { top: 'dark_log_top', bottom: 'dark_log_top', side: 'dark_log_side' }, hardness: 2, tool: 'axe', sound: 'wood', flammable: true });
  def(168, 'prismarine', PK({ tex: 'prismarine' }));
  def(102, 'prismarine_bricks', PK({ tex: 'prismarine_bricks' }));
  def(103, 'dark_prismarine', PK({ tex: 'dark_prismarine' }));
  def(169, 'sea_lantern', { tex: 'sea_lantern', hardness: 0.3, emit: 15, sound: 'glass' });
  def(170, 'hay_bale', { tex: { top: 'hay_top', bottom: 'hay_top', side: 'hay_side' }, hardness: 0.5, sound: 'grass' });
  def(172, 'terracotta', PK({ tex: 'terracotta', hardness: 1.25 }));
  def(129, 'emerald_ore', PK({ tex: 'emerald_ore', hardness: 3, tier: 3, drop: 388 }));
  def(133, 'emerald_block', PK({ tex: 'emerald_block', hardness: 5, tier: 3, sound: 'metal' }));
  def(208, 'dirt_path', { tex: { top: 'dirt_path_top', bottom: 'dirt', side: 'dirt_path_side' }, render: R.SHAPE, hardness: 0.65, tool: 'shovel', sound: 'gravel', lightOpacity: 15, drop: 3 });
  def(216, 'bone_block', PK({ tex: { top: 'bone_block_top', bottom: 'bone_block_top', side: 'bone_block_side' }, hardness: 2 }));
  def(118, 'cauldron', PK({ tex: { top: 'cauldron_top', bottom: 'cauldron_inner', side: 'cauldron_side' }, render: R.SHAPE, hardness: 2, sound: 'metal' }));
  /* ---- nether ---- */
  def(87, 'netherrack', PK({ tex: 'netherrack', hardness: 0.4 }));
  def(88, 'soul_sand', { tex: 'soul_sand', hardness: 0.5, tool: 'shovel', sound: 'sand' });
  def(89, 'glowstone', { tex: 'glowstone', hardness: 0.3, emit: 15, sound: 'glass', drop: 348, dropCount: 3 });
  def(90, 'nether_portal', { tex: 'nether_portal', render: R.PORTAL, solid: false, layer: 1, emit: 11, hardness: -1, drop: 0, sound: 'glass' });
  def(112, 'nether_bricks', PK({ tex: 'nether_bricks', hardness: 2 }));
  def(113, 'nether_brick_fence', PK({ tex: 'nether_bricks', render: R.FENCE, hardness: 2 }));
  def(114, 'nether_brick_stairs', PK({ tex: 'nether_bricks', render: R.STAIRS, hardness: 2 }));
  def(115, 'nether_wart', { tex: 'nether_wart_2', render: R.CROPS, solid: false, hardness: 0, sound: 'grass', cutout: true, drop: 0 });
  def(153, 'quartz_ore', PK({ tex: 'quartz_ore', hardness: 3, tier: 1, drop: 406 }));
  def(213, 'magma_block', PK({ tex: 'magma', hardness: 0.5, emit: 3 }));
  def(104, 'blackstone', PK({ tex: { top: 'blackstone_top', bottom: 'blackstone_top', side: 'blackstone' } }));
  def(105, 'polished_blackstone_bricks', PK({ tex: 'polished_blackstone_bricks' }));
  def(106, 'gilded_blackstone', PK({ tex: 'gilded_blackstone' }));
  def(107, 'crying_obsidian', PK({ tex: 'crying_obsidian', hardness: 10, tier: 4, emit: 10 }));
  /* ---- end ---- */
  def(121, 'end_stone', PK({ tex: 'end_stone', hardness: 3 }));
  def(119, 'end_portal', { tex: 'end_portal', render: R.SHAPE, solid: false, emit: 15, hardness: -1, drop: 0 });
  def(120, 'end_portal_frame', { tex: { top: 'end_frame_top', bottom: 'end_stone', side: 'end_frame_side' }, render: R.SHAPE, hardness: -1, emit: 1, drop: 0 });
  def(122, 'dragon_egg', { tex: 'dragon_egg', render: R.SHAPE, hardness: 3, emit: 1 });
  def(201, 'purpur_block', PK({ tex: 'purpur_block' }));
  def(202, 'purpur_pillar', PK({ tex: { top: 'purpur_pillar_top', bottom: 'purpur_pillar_top', side: 'purpur_pillar_side' } }));
  def(203, 'purpur_stairs', PK({ tex: 'purpur_block', render: R.STAIRS }));
  def(206, 'end_stone_bricks', PK({ tex: 'end_stone_bricks', hardness: 3 }));
  def(198, 'end_rod', { tex: 'end_rod', render: R.SHAPE, hardness: 0, emit: 14, cutout: true, sound: 'wood' });
  def(199, 'chorus_plant', { tex: 'chorus_plant', render: R.SHAPE, hardness: 0.4, tool: 'axe', sound: 'wood', drop: 432 });
  def(200, 'chorus_flower', { tex: 'chorus_flower', hardness: 0.4, tool: 'axe', sound: 'wood' });
  /* ---- aether ---- */
  def(220, 'aether_grass', { tex: { top: 'aether_grass_top', bottom: 'aether_dirt', side: 'aether_grass_side' }, hardness: 0.6, tool: 'shovel', sound: 'grass', drop: 221 });
  def(221, 'aether_dirt', { tex: 'aether_dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel' });
  def(222, 'holystone', PK({ tex: 'holystone', hardness: 1 }));
  def(223, 'mossy_holystone', PK({ tex: 'mossy_holystone', hardness: 1 }));
  def(224, 'holystone_bricks', PK({ tex: 'holystone_bricks', hardness: 1.5 }));
  def(225, 'quicksoil', { tex: 'quicksoil', hardness: 0.5, tool: 'shovel', sound: 'sand', slip: 1.03 });
  def(226, 'icestone', PK({ tex: 'icestone', hardness: 1, sound: 'glass' }));
  def(227, 'ambrosium_ore', PK({ tex: 'ambrosium_ore', hardness: 2, drop: 440, emit: 4 }));
  def(228, 'zanite_ore', PK({ tex: 'zanite_ore', hardness: 3, tier: 1, drop: 441 }));
  def(229, 'gravitite_ore', PK({ tex: 'gravitite_ore', hardness: 5, tier: 3 }));
  def(230, 'skyroot_log', { tex: { top: 'skyroot_log_top', bottom: 'skyroot_log_top', side: 'skyroot_log_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
  def(231, 'skyroot_planks', { tex: 'skyroot_planks', hardness: 2, tool: 'axe', sound: 'wood' });
  def(232, 'skyroot_leaves', { tex: 'skyroot_leaves', hardness: 0.2, sound: 'grass', lightOpacity: 1, cutout: true, drop: 0 });
  def(233, 'golden_oak_log', { tex: { top: 'skyroot_log_top', bottom: 'skyroot_log_top', side: 'golden_oak_log_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
  def(234, 'golden_oak_leaves', { tex: 'golden_oak_leaves', hardness: 0.2, sound: 'grass', lightOpacity: 1, cutout: true, drop: 0, emit: 2 });
  def(235, 'aercloud', { tex: 'aercloud', solid: false, layer: 1, lightOpacity: 1, selfCull: true, hardness: 0.2, sound: 'cloth', opaque: false });
  def(236, 'blue_aercloud', { tex: 'blue_aercloud', solid: false, layer: 1, lightOpacity: 1, selfCull: true, hardness: 0.2, sound: 'cloth', opaque: false });
  def(237, 'aether_portal', { tex: 'aether_portal', render: R.PORTAL, solid: false, layer: 1, emit: 11, hardness: -1, drop: 0, sound: 'glass' });
  def(238, 'purple_flower', { tex: 'purple_flower', render: R.CROSS, solid: false, hardness: 0, sound: 'grass', cutout: true });
  def(239, 'white_flower', { tex: 'white_flower', render: R.CROSS, solid: false, hardness: 0, sound: 'grass', cutout: true });
  def(240, 'zanite_block', PK({ tex: 'zanite_block', hardness: 3, sound: 'metal' }));
  // non-cube "opaque" flags for clouds (def() forces opaque for cubes)
  OPAQUE[235] = OPAQUE[236] = 0; blocks[235].opaque = blocks[236].opaque = false;
  // Cubes you can see through must not hide their neighbours' faces (no X-ray).
  for (let id = 1; id < 256; id++) {
    const d = blocks[id];
    if (d && d.render === R.CUBE && (d.cutout || d.layer === 1)) { d.opaque = false; OPAQUE[id] = 0; }
  }
  const LEAVES = new Uint8Array(256);
  LEAVES[B.leaves] = LEAVES[B.skyroot_leaves] = LEAVES[B.golden_oak_leaves] = 1;
  S.LEAVES = LEAVES;

  /** Box lists (1/16 units) for SHAPE blocks. */
  function shapeBoxes(id, meta) {
    switch (id) {
      case 66: return [[0, 0, 0, 16, 1, 16]];
      case 101: return [[7, 0, 0, 9, 16, 16], [0, 0, 7, 16, 16, 9]];
      case 208: return [[0, 0, 0, 16, 15, 16]];
      case 118: return [[0, 3, 0, 16, 16, 2], [0, 3, 14, 16, 16, 16], [0, 3, 2, 2, 16, 14], [14, 3, 2, 16, 16, 14], [2, 3, 2, 14, 4, 14],
        [0, 0, 0, 4, 3, 4], [12, 0, 0, 16, 3, 4], [0, 0, 12, 4, 3, 16], [12, 0, 12, 16, 3, 16]];
      case 119: return [[0, 11, 0, 16, 12, 16]];
      case 120: return (meta & 4) ? [[0, 0, 0, 16, 13, 16], [4, 13, 4, 12, 16, 12]] : [[0, 0, 0, 16, 13, 16]];
      case 122: return [[6, 15, 6, 10, 16, 10], [5, 14, 5, 11, 15, 11], [4, 12, 4, 12, 14, 12], [3, 3, 3, 13, 12, 13], [4, 1, 4, 12, 3, 12], [5, 0, 5, 11, 1, 11]];
      case 198: return [[7, 1, 7, 9, 16, 9], [6, 0, 6, 10, 1, 10]];
      case 199: return [[4, 0, 4, 12, 16, 12], [2, 5, 2, 14, 11, 14]];
    }
    return [[0, 0, 0, 16, 16, 16]];
  }
  S.shapeBoxes = shapeBoxes;

  S.blocks = blocks; S.B = B;
  S.RENDER = RENDER; S.OPAQUE = OPAQUE; S.SOLID = SOLID; S.LAYER = LAYER;
  S.LOPAC = LOPAC; S.LEMIT = LEMIT; S.REPLACE = REPLACE; S.LIQUID = LIQUID; S.TEX = TEX;

  const FRONT_BLOCKS = new Uint8Array(256);
  FRONT_BLOCKS[B.furnace] = T.furnace_front;
  FRONT_BLOCKS[B.lit_furnace] = T.furnace_front_lit;
  FRONT_BLOCKS[B.pumpkin] = T.pumpkin_face;
  FRONT_BLOCKS[B.jack_o_lantern] = T.jack_o_lantern_face;
  FRONT_BLOCKS[B.chest] = T.chest_front;
  S.FRONT_BLOCKS = FRONT_BLOCKS;

  /** Tile for a block face taking metadata / neighbour context into account. */
  function tileFor(id, face, meta, above) {
    const fb = FRONT_BLOCKS[id];
    if (fb && face >= 2) {
      // meta 0..3 = front facing north/south/west/east -> face index 2..5
      if (face === 2 + (meta & 3)) return fb;
    }
    if (id === B.grass && face >= 2 && (above === B.snow_layer || above === B.snow_block)) return T.grass_side_snow;
    if (id === B.grass && face === 1 && (above === B.snow_layer || above === B.snow_block)) return T.snow;
    if (id === B.wheat) return T.wheat_0 + Math.min(7, meta & 7);
    if (id === B.farmland && face === 1) return meta > 0 ? T.farmland_wet : T.farmland_dry;
    if (id === B.end_portal_frame && face === 1 && (meta & 4)) return T.end_frame_eye;
    if (id === B.nether_wart) return T.nether_wart_0 + [0, 1, 1, 2][Math.min(3, meta & 3)];
    if (id === B.wooden_door) return (meta & 8) ? T.door_top : T.door_bottom;
    return TEX[id * 6 + face];
  }
  S.tileFor = tileFor;

  /* ------------------------------------------------------------------ */
  /* Random numbers                                                     */
  /* ------------------------------------------------------------------ */
  function RNG(seed) { this.s = (seed | 0) || 0x9E3779B9; }
  RNG.prototype.setSeed = function (seed) { this.s = (seed | 0) || 0x9E3779B9; };
  RNG.prototype.next = function () {
    let t = (this.s = (this.s + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.nextInt = function (n) { return n <= 0 ? 0 : Math.floor(this.next() * n); };
  RNG.prototype.nextFloat = RNG.prototype.next;
  RNG.prototype.nextBool = function () { return this.next() < 0.5; };
  RNG.prototype.nextGaussian = function () {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  S.RNG = RNG;

  function hash2(seed, x, z) {
    let h = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) | 0;
  }
  function hash3(seed, x, y, z) { return hash2(hash2(seed, x, z), y, 0x5bd1e995); }
  S.hash2 = hash2;
  S.hash3 = hash3;

  /* ------------------------------------------------------------------ */
  /* Improved Perlin noise                                              */
  /* ------------------------------------------------------------------ */
  function Perlin(rng) {
    this.ox = rng.next() * 256;
    this.oy = rng.next() * 256;
    this.oz = rng.next() * 256;
    const p = new Uint8Array(512);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 256; i++) p[i + 256] = p[i];
    this.p = p;
  }
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(t, a, b) { return a + t * (b - a); }
  function grad(h, x, y, z) {
    switch (h & 15) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x + z; case 5: return -x + z; case 6: return x - z; case 7: return -x - z;
      case 8: return y + z; case 9: return -y + z; case 10: return y - z; case 11: return -y - z;
      case 12: return y + x; case 13: return -y + z; case 14: return y - x; default: return -y - z;
    }
  }
  Perlin.prototype.noise = function (x, y, z) {
    x += this.ox; y += this.oy; z += this.oz;
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    const u = fade(x), v = fade(y), w = fade(z);
    const p = this.p;
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const Bq = p[X + 1] + Y, BA = p[Bq] + Z, BB = p[Bq + 1] + Z;
    return lerp(w,
      lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
        lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
      lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
        lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
  };
  function Octaves(rng, n) {
    this.gens = [];
    for (let i = 0; i < n; i++) this.gens.push(new Perlin(rng));
    let a = 1, tot = 0;
    for (let i = 0; i < n; i++) { tot += a; a *= 0.5; }
    this.norm = 1 / tot;
  }
  Octaves.prototype.sample = function (x, y, z) {
    let s = 0, f = 1, a = 1;
    const g = this.gens;
    for (let i = 0; i < g.length; i++) {
      s += g[i].noise(x * f, y * f, z * f) * a;
      f *= 2; a *= 0.5;
    }
    return s * this.norm;
  };
  Octaves.prototype.sample2 = function (x, z) { return this.sample(x, 0.5, z); };
  S.Perlin = Perlin;
  S.Octaves = Octaves;

  /* ------------------------------------------------------------------ */
  /* Terrain generator                                                  */
  /* ------------------------------------------------------------------ */
  const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, TUNDRA: 3, SEASONAL: 4 };
  S.BIOME = BIOME;
  S.BIOME_NAMES = ['Plains', 'Forest', 'Desert', 'Tundra', 'Seasonal Forest'];

  function Generator(seed, dim) {
    this.seed = seed | 0;
    this.dim = dim | 0;
    const rng = new RNG(seed);
    this.low = new Octaves(rng, 6);
    this.high = new Octaves(rng, 6);
    this.sel = new Octaves(rng, 4);
    this.cont = new Octaves(rng, 5);
    this.rough = new Octaves(rng, 4);
    this.beach = new Octaves(rng, 4);
    this.depth = new Octaves(rng, 4);
    this.temp = new Octaves(rng, 4);
    this.humid = new Octaves(rng, 4);
    this.rng = new RNG(0);
    this.tempGrid = new Float32Array(25);
    this.humidGrid = new Float32Array(25);
    const r2 = new RNG((seed ^ 0x5eed0d1) + this.dim * 7919);
    this.d1 = new Octaves(r2, 5); this.d2 = new Octaves(r2, 4); this.d3 = new Octaves(r2, 4); this.d4 = new Octaves(r2, 3);
  }
  S.Generator = Generator;

  function classifyBiome(t, h) {
    if (t < 0.08) return BIOME.TUNDRA;
    if (t > 0.78 && h < 0.4) return BIOME.DESERT;
    if (h > 0.62) return BIOME.FOREST;
    if (h > 0.5 && t > 0.45) return BIOME.SEASONAL;
    return BIOME.PLAINS;
  }
  Generator.prototype.biomeFromGrid = function (x, z) {
    const gx = x >> 2, gz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
    const tg = this.tempGrid, hg = this.humidGrid;
    const i00 = gx * 5 + gz, i10 = i00 + 5, i01 = i00 + 1, i11 = i00 + 6;
    const t = (tg[i00] * (1 - fx) + tg[i10] * fx) * (1 - fz) + (tg[i01] * (1 - fx) + tg[i11] * fx) * fz;
    const h = (hg[i00] * (1 - fx) + hg[i10] * fx) * (1 - fz) + (hg[i01] * (1 - fx) + hg[i11] * fx) * fz;
    return classifyBiome(t, h);
  };

  Generator.prototype.biomeAt = function (wx, wz) {
    const t = this.temp.sample2(wx / 520, wz / 520) * 2.6 + 0.5;
    const h = this.humid.sample2(wx / 430, wz / 430) * 2.6 + 0.5;
    return classifyBiome(t, h);
  };

  Generator.prototype.generate = function (cx, cz, noCaves) {
    if (this.dim === 1) return this.genNether(cx, cz);
    if (this.dim === 2) return this.genEnd(cx, cz);
    if (this.dim === 3) return this.genAether(cx, cz);
    const blocks = new Uint8Array(16 * 16 * CH);
    const meta = new Uint8Array(16 * 16 * CH);
    const biomes = new Uint8Array(256);
    const NX = 5, NY = 17, NZ = 5;
    const dens = new Float32Array(NX * NY * NZ);
    const bx = cx * 16, bz = cz * 16;

    const tg = this.tempGrid, hg = this.humidGrid;
    for (let gx = 0; gx < NX; gx++) {
      for (let gz = 0; gz < NZ; gz++) {
        const wx = bx + gx * 4, wz = bz + gz * 4;
        tg[gx * NZ + gz] = this.temp.sample2(wx / 520, wz / 520) * 2.6 + 0.5;
        hg[gx * NZ + gz] = this.humid.sample2(wx / 430, wz / 430) * 2.6 + 0.5;
        const c = this.cont.sample2(wx / 340, wz / 340) * 3.2;
        let r = this.rough.sample2(wx / 210, wz / 210) * 3.6 + 0.3;
        r = r < 0 ? 0 : r > 1 ? 1 : r;
        r = r * r * (3 - 2 * r);
        let h = 69 + c * 10;
        if (c > 0.3) h += (c - 0.3) * 30;
        if (c < -0.5) h += (c + 0.5) * 16;
        const amp = 0.5 + r * 1.0;
        const squash = 6 + r * 18;
        for (let gy = 0; gy < NY; gy++) {
          const wy = gy * 8;
          const lo = this.low.sample(wx / 85, wy / 60, wz / 85);
          const hi = this.high.sample(wx / 85, wy / 60, wz / 85);
          let s = this.sel.sample(wx / 60, wy / 30, wz / 60) * 6 + 0.5;
          s = s < 0 ? 0 : s > 1 ? 1 : s;
          let d = (lo + (hi - lo) * s) * 3 * amp + (h - wy) / squash;
          if (wy < 6) d += (6 - wy) * 0.6;
          if (wy > 110) d -= (wy - 110) * 0.35;
          dens[(gx * NZ + gz) * NY + gy] = d;
        }
      }
    }
    // trilinear interpolation into blocks
    for (let gx = 0; gx < 4; gx++) {
      for (let gz = 0; gz < 4; gz++) {
        for (let gy = 0; gy < 16; gy++) {
          const d000 = dens[(gx * NZ + gz) * NY + gy];
          const d001 = dens[(gx * NZ + gz + 1) * NY + gy];
          const d100 = dens[((gx + 1) * NZ + gz) * NY + gy];
          const d101 = dens[((gx + 1) * NZ + gz + 1) * NY + gy];
          const d010 = dens[(gx * NZ + gz) * NY + gy + 1];
          const d011 = dens[(gx * NZ + gz + 1) * NY + gy + 1];
          const d110 = dens[((gx + 1) * NZ + gz) * NY + gy + 1];
          const d111 = dens[((gx + 1) * NZ + gz + 1) * NY + gy + 1];
          for (let ly = 0; ly < 8; ly++) {
            const ty = ly / 8;
            const y = gy * 8 + ly;
            const e00 = d000 + (d010 - d000) * ty, e01 = d001 + (d011 - d001) * ty;
            const e10 = d100 + (d110 - d100) * ty, e11 = d101 + (d111 - d101) * ty;
            for (let lx = 0; lx < 4; lx++) {
              const tx = lx / 4;
              const f0 = e00 + (e10 - e00) * tx, f1 = e01 + (e11 - e01) * tx;
              const x = gx * 4 + lx;
              for (let lz = 0; lz < 4; lz++) {
                const v = f0 + (f1 - f0) * (lz / 4);
                const z = gz * 4 + lz;
                const idx = (y << 8) | (z << 4) | x;
                if (v > 0) blocks[idx] = 1;
                else if (y <= SEA) blocks[idx] = 8;
              }
            }
          }
        }
      }
    }

    // biomes & surface
    const rng = this.rng;
    rng.setSeed(hash2(this.seed, cx, cz));
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const wx = bx + x, wz = bz + z;
        const biome = this.biomeFromGrid(x, z);
        biomes[(z << 4) | x] = biome;
        const bn = this.beach.sample2(wx / 48, wz / 48) * 3;
        const sandy = bn + rng.next() * 0.2 > 0.0;
        const gravelly = this.beach.sample(wz / 40, 7.7, wx / 40) * 3 + rng.next() * 0.2 > 0.6;
        const depth = Math.floor(this.depth.sample2(wx / 20, wz / 20) * 7 + 3 + rng.next() * 0.9);
        let topB = biome === BIOME.DESERT ? B.sand : B.grass;
        let fillB = biome === BIOME.DESERT ? B.sand : B.dirt;
        let run = -1, curFill = fillB;
        for (let y = CH - 1; y >= 0; y--) {
          const idx = (y << 8) | (z << 4) | x;
          if (y < 5 && y <= rng.nextInt(5)) { blocks[idx] = B.bedrock; continue; }
          const b = blocks[idx];
          if (b === 0) { run = -1; continue; }
          if (b !== 1) continue;
          if (run === -1) {
            let top = topB, fill = fillB;
            if (depth <= 0) { top = 0; fill = 1; }
            else if (y >= SEA - 4 && y <= SEA + 1) {
              if (gravelly) { top = B.gravel; fill = B.gravel; }
              if (sandy) { top = B.sand; fill = B.sand; }
            }
            if (y < SEA && top === 0) top = B.water;
            run = depth;
            curFill = fill;
            if (y >= SEA) blocks[idx] = top || 0;
            else blocks[idx] = (fill === B.grass ? B.dirt : fill);
            if (blocks[idx] === B.grass && y < SEA) blocks[idx] = B.dirt;
          } else if (run > 0) {
            run--;
            blocks[idx] = curFill;
          }
        }
      }
    }
    if (!noCaves) this.carveCaves(cx, cz, blocks);
    return { blocks, meta, biomes };
  };

  /* Shared 3D density helper: fills blocks from density fn sampled on a 4x8x4 grid */
  Generator.prototype.densityFill = function (cx, cz, fn, place) {
    const NX = 5, NY = 17, NZ = 5, bx = cx * 16, bz = cz * 16;
    const dens = new Float32Array(NX * NY * NZ);
    for (let gx = 0; gx < NX; gx++) for (let gz = 0; gz < NZ; gz++) for (let gy = 0; gy < NY; gy++)
      dens[(gx * NZ + gz) * NY + gy] = fn(bx + gx * 4, gy * 8, bz + gz * 4);
    for (let gx = 0; gx < 4; gx++) for (let gz = 0; gz < 4; gz++) for (let gy = 0; gy < 16; gy++) {
      const i = (gx * NZ + gz) * NY + gy;
      const d000 = dens[i], d001 = dens[i + NY], d100 = dens[i + NZ * NY], d101 = dens[i + NZ * NY + NY];
      const d010 = dens[i + 1], d011 = dens[i + NY + 1], d110 = dens[i + NZ * NY + 1], d111 = dens[i + NZ * NY + NY + 1];
      for (let ly = 0; ly < 8; ly++) {
        const ty = ly / 8, y = gy * 8 + ly;
        const e00 = d000 + (d010 - d000) * ty, e01 = d001 + (d011 - d001) * ty, e10 = d100 + (d110 - d100) * ty, e11 = d101 + (d111 - d101) * ty;
        for (let lx = 0; lx < 4; lx++) {
          const tx = lx / 4, f0 = e00 + (e10 - e00) * tx, f1 = e01 + (e11 - e01) * tx;
          for (let lz = 0; lz < 4; lz++) place(gx * 4 + lx, y, gz * 4 + lz, f0 + (f1 - f0) * (lz / 4));
        }
      }
    }
  };

  Generator.prototype.genNether = function (cx, cz) {
    const blocks = new Uint8Array(16 * 16 * CH), meta = new Uint8Array(16 * 16 * CH), biomes = new Uint8Array(256);
    this.densityFill(cx, cz, (x, y, z) => {
      const n = this.d1.sample(x / 70, y / 38, z / 70) * 3 + this.d2.sample(x / 22, y / 14, z / 22) * 1.2;
      return n + Math.max(0, (28 - y) / 7) + Math.max(0, (y - 98) / 7) - 0.3;
    }, (x, y, z, v) => {
      const i = (y << 8) | (z << 4) | x;
      if (v > 0) blocks[i] = B.netherrack; else if (y <= 31) blocks[i] = B.lava;
    });
    const rng = this.rng;
    rng.setSeed(hash2(this.seed ^ 0x4e7, cx, cz));
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      const wx = cx * 16 + x, wz = cz * 16 + z;
      const soul = this.d3.sample2(wx / 40, wz / 40) * 3 > 0.25;
      const grav = this.d4.sample2(wz / 30, wx / 30) * 3 > 0.45;
      for (let y = 0; y < CH; y++) {
        const i = (y << 8) | (z << 4) | x;
        if ((y < 5 && y <= rng.nextInt(5)) || (y > 122 && y >= 127 - rng.nextInt(5))) { blocks[i] = B.bedrock; continue; }
        if (blocks[i] === B.netherrack && y > 30 && y < 72 && blocks[i + 256] === 0) {
          if (soul) { for (let k = 0; k < 3 && y - k > 0; k++) if (blocks[i - k * 256] === B.netherrack) blocks[i - k * 256] = B.soul_sand; }
          else if (grav && y < 40) { for (let k = 0; k < 2; k++) if (blocks[i - k * 256] === B.netherrack) blocks[i - k * 256] = B.gravel; }
        }
      }
    }
    return { blocks, meta, biomes };
  };

  Generator.prototype.genEnd = function (cx, cz) {
    const blocks = new Uint8Array(16 * 16 * CH), meta = new Uint8Array(16 * 16 * CH), biomes = new Uint8Array(256);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      const wx = cx * 16 + x, wz = cz * 16 + z;
      const r = Math.hypot(wx, wz);
      let top = -1, bot = 0;
      if (r < 100) {
        const t = 1 - r / 100;
        top = 56 + t * 8 + this.d2.sample2(wx / 30, wz / 30) * 6;
        bot = 56 - Math.sqrt(t) * 36 - this.d3.sample2(wx / 20, wz / 20) * 10;
      } else if (r > 300) {
        const n = this.d1.sample2(wx / 150, wz / 150) * 3.2 + this.d4.sample2(wx / 40, wz / 40) * 0.8 - 0.5;
        if (n > 0) { top = 58 + Math.min(n, 1) * 8 + this.d2.sample2(wx / 25, wz / 25) * 3; bot = top - Math.min(n, 1.4) * 26 - 2; biomes[(z << 4) | x] = 1; }
      }
      for (let y = Math.max(1, Math.floor(bot)); y <= top && y < CH; y++) blocks[(y << 8) | (z << 4) | x] = B.end_stone;
    }
    return { blocks, meta, biomes };
  };

  Generator.prototype.genAether = function (cx, cz) {
    const blocks = new Uint8Array(16 * 16 * CH), meta = new Uint8Array(16 * 16 * CH), biomes = new Uint8Array(256);
    this.densityFill(cx, cz, (x, y, z) => {
      const n = this.d1.sample(x / 90, y / 40, z / 90) * 3 + this.d2.sample(x / 28, y / 18, z / 28) * 0.9;
      const b = (y - 74) / 30;
      return n - 0.35 - b * b * 1.6;
    }, (x, y, z, v) => { if (v > 0 && y > 20 && y < 120) blocks[(y << 8) | (z << 4) | x] = B.holystone; });
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      let run = -1;
      for (let y = CH - 1; y >= 0; y--) {
        const i = (y << 8) | (z << 4) | x;
        if (blocks[i] === 0) { run = -1; continue; }
        if (run === -1) { blocks[i] = B.aether_grass; run = 3; }
        else if (run > 0) { blocks[i] = B.aether_dirt; run--; }
      }
    }
    return { blocks, meta, biomes };
  };

  /** Top solid y per column (terrain only, used to place structures). */
  Generator.prototype.heightMap = function (cx, cz) {
    const r = this.generate(cx, cz, true);
    const h = new Uint8Array(256), top = new Uint8Array(256);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      let y = CH - 1;
      while (y > 0 && (r.blocks[(y << 8) | (z << 4) | x] === 0 || r.blocks[(y << 8) | (z << 4) | x] === B.water || r.blocks[(y << 8) | (z << 4) | x] === B.lava)) y--;
      h[(z << 4) | x] = y;
      let w = CH - 1;
      while (w > 0 && r.blocks[(w << 8) | (z << 4) | x] === 0) w--;
      top[(z << 4) | x] = w;
    }
    return { h, top, biomes: r.biomes };
  };

  /* Worm caves (after the classic cave carver) */
  Generator.prototype.carveCaves = function (cx, cz, blocks) {
    const range = 8;
    const rng = new RNG(0);
    for (let x = cx - range; x <= cx + range; x++) {
      for (let z = cz - range; z <= cz + range; z++) {
        rng.setSeed(hash2(this.seed ^ 0x2F6E2B1, x, z));
        let n = rng.nextInt(rng.nextInt(rng.nextInt(40) + 1) + 1);
        if (rng.nextInt(15) !== 0) n = 0;
        for (let i = 0; i < n; i++) {
          const sx = x * 16 + rng.nextInt(16);
          const sy = rng.nextInt(rng.nextInt(120) + 8);
          const sz = z * 16 + rng.nextInt(16);
          let nodes = 1;
          if (rng.nextInt(4) === 0) {
            this.tunnel(rng.nextInt(0x7fffffff), cx, cz, blocks, sx, sy, sz, 1 + rng.next() * 6, 0, 0, -1, -1, 0.5);
            nodes += rng.nextInt(4);
          }
          for (let j = 0; j < nodes; j++) {
            const yaw = rng.next() * Math.PI * 2;
            const pitch = (rng.next() - 0.5) * 2 / 8;
            const width = rng.next() * 2 + rng.next();
            this.tunnel(rng.nextInt(0x7fffffff), cx, cz, blocks, sx, sy, sz, width, yaw, pitch, 0, 0, 1);
          }
        }
      }
    }
  };

  Generator.prototype.tunnel = function (seed, cx, cz, blocks, x, y, z, width, yaw, pitch, step, maxSteps, hRatio) {
    const ccx = cx * 16 + 8, ccz = cz * 16 + 8;
    let dYaw = 0, dPitch = 0;
    const rng = new RNG(seed);
    if (maxSteps <= 0) {
      const r = 8 * 16 - 16;
      maxSteps = r - rng.nextInt(r / 4 | 0);
    }
    let room = false;
    if (step === -1) { step = maxSteps / 2 | 0; room = true; }
    const branch = rng.nextInt(maxSteps / 2 | 0) + (maxSteps / 4 | 0);
    const steep = rng.nextInt(6) === 0;
    for (; step < maxSteps; step++) {
      const rh = 1.5 + Math.sin(step * Math.PI / maxSteps) * width;
      const rv = rh * hRatio;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      x += Math.cos(yaw) * cp; y += sp; z += Math.sin(yaw) * cp;
      pitch *= steep ? 0.92 : 0.7;
      pitch += dPitch * 0.1; yaw += dYaw * 0.1;
      dPitch *= 0.9; dYaw *= 0.75;
      dPitch += (rng.next() - rng.next()) * rng.next() * 2;
      dYaw += (rng.next() - rng.next()) * rng.next() * 4;
      if (!room && step === branch && width > 1) {
        this.tunnel(rng.nextInt(0x7fffffff), cx, cz, blocks, x, y, z, rng.next() * 0.5 + 0.5, yaw - Math.PI / 2, pitch / 3, step, maxSteps, 1);
        this.tunnel(rng.nextInt(0x7fffffff), cx, cz, blocks, x, y, z, rng.next() * 0.5 + 0.5, yaw + Math.PI / 2, pitch / 3, step, maxSteps, 1);
        return;
      }
      if (!room && rng.nextInt(4) === 0) continue;
      const ddx = x - ccx, ddz = z - ccz;
      const rem = maxSteps - step;
      const maxD = width + 2 + 16;
      if (ddx * ddx + ddz * ddz - rem * rem > maxD * maxD) return;
      if (x < ccx - 16 - rh * 2 || z < ccz - 16 - rh * 2 || x > ccx + 16 + rh * 2 || z > ccz + 16 + rh * 2) continue;
      let x0 = Math.floor(x - rh) - cx * 16 - 1, x1 = Math.floor(x + rh) - cx * 16 + 1;
      let y0 = Math.floor(y - rv) - 1, y1 = Math.floor(y + rv) + 1;
      let z0 = Math.floor(z - rh) - cz * 16 - 1, z1 = Math.floor(z + rh) - cz * 16 + 1;
      if (x0 < 0) x0 = 0; if (x1 > 16) x1 = 16;
      if (y0 < 1) y0 = 1; if (y1 > 120) y1 = 120;
      if (z0 < 0) z0 = 0; if (z1 > 16) z1 = 16;
      let water = false;
      for (let xx = x0; !water && xx < x1; xx++) {
        for (let zz = z0; !water && zz < z1; zz++) {
          for (let yy = y1 + 1; !water && yy >= y0 - 1; yy--) {
            if (yy < 0 || yy >= CH) continue;
            const b = blocks[(yy << 8) | (zz << 4) | xx];
            if (b === B.water) water = true;
            if (yy !== y0 - 1 && xx !== x0 && xx !== x1 - 1 && zz !== z0 && zz !== z1 - 1) yy = y0;
          }
        }
      }
      if (!water) {
        for (let xx = x0; xx < x1; xx++) {
          const fx = ((xx + cx * 16) + 0.5 - x) / rh;
          for (let zz = z0; zz < z1; zz++) {
            const fz = ((zz + cz * 16) + 0.5 - z) / rh;
            if (fx * fx + fz * fz >= 1) continue;
            let grassHit = false;
            for (let yy = y1 - 1; yy >= y0; yy--) {
              const fy = (yy + 0.5 - y) / rv;
              if (fy > -0.7 && fx * fx + fy * fy + fz * fz < 1) {
                const idx = (yy << 8) | (zz << 4) | xx;
                const b = blocks[idx];
                if (b === B.grass) grassHit = true;
                if (b === B.stone || b === B.dirt || b === B.grass || (b === B.sand && yy < SEA - 6) || (b === B.gravel && yy < SEA - 6)) {
                  if (yy < 10) blocks[idx] = B.lava;
                  else {
                    blocks[idx] = 0;
                    if (grassHit && yy > 0 && blocks[idx - 256] === B.dirt) blocks[idx - 256] = B.grass;
                  }
                }
              }
            }
          }
        }
        if (room) break;
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Mesher                                                             */
  /* ------------------------------------------------------------------ */
  // Vertex layout (16 bytes): int16 x,y,z,pad (1/256 block) | uint16 u,v | u8 sky, block, shade, flags
  function VBuf(cap) { this.alloc(cap || 1024); this.n = 0; }
  VBuf.prototype.alloc = function (cap) {
    const buf = new ArrayBuffer(cap * 16);
    if (this.buf) new Uint8Array(buf).set(new Uint8Array(this.buf, 0, this.n * 16));
    this.buf = buf; this.cap = cap;
    this.i16 = new Int16Array(buf); this.u16 = new Uint16Array(buf); this.u8 = new Uint8Array(buf);
  };
  VBuf.prototype.v = function (x, y, z, u, v, sky, blk, shade, flags) {
    if (this.n >= this.cap) this.alloc(this.cap * 2);
    const o = this.n << 3;
    this.i16[o] = Math.round(x * 256); this.i16[o + 1] = Math.round(y * 256); this.i16[o + 2] = Math.round(z * 256);
    this.u16[o + 4] = (u * 65535 + 0.5) | 0; this.u16[o + 5] = (v * 65535 + 0.5) | 0;
    const b = (this.n << 4) + 12;
    this.u8[b] = sky; this.u8[b + 1] = blk; this.u8[b + 2] = shade; this.u8[b + 3] = flags;
    this.n++;
  };
  VBuf.prototype.result = function () { return this.buf.slice(0, this.n * 16); };
  S.VBuf = VBuf;

  // face: 0 bottom(-y) 1 top(+y) 2 north(-z) 3 south(+z) 4 west(-x) 5 east(+x)
  const FACE_VERTS = [
    [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
    [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
    [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
    [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]
  ];
  const FACE_UV = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const FACE_DIR = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  const FACE_SHADE = [0.5, 1.0, 0.8, 0.8, 0.6, 0.6];
  const AO_CURVE = [0.5, 0.68, 0.84, 1.0];
  S.FACE_VERTS = FACE_VERTS; S.FACE_DIR = FACE_DIR; S.FACE_SHADE = FACE_SHADE; S.FACE_UV = FACE_UV;

  const P = 18, P2 = 324;
  const DOFF = [-P2, P2, -P, P, -1, 1];
  // For smooth lighting: per face, per vertex, the two tangent neighbour offsets.
  const SIDE1 = new Int32Array(24), SIDE2 = new Int32Array(24);
  (function () {
    const axisOff = [1, P2, P]; // x, y, z strides in padded array
    for (let f = 0; f < 6; f++) {
      const d = FACE_DIR[f];
      const normalAxis = d[0] !== 0 ? 0 : d[1] !== 0 ? 1 : 2;
      const tangents = [0, 1, 2].filter(a => a !== normalAxis);
      for (let v = 0; v < 4; v++) {
        const c = FACE_VERTS[f][v];
        SIDE1[f * 4 + v] = (c[tangents[0]] ? 1 : -1) * axisOff[tangents[0]];
        SIDE2[f * 4 + v] = (c[tangents[1]] ? 1 : -1) * axisOff[tangents[1]];
      }
    }
  })();

  function uvOf(tile, u, v) {
    // returns [U, V] in atlas space with tiny inset to avoid bleeding
    const tx = tile & 15, ty = tile >> 4;
    const e = 0.00004;
    const uu = u < 0.001 ? e : u > 0.999 ? 1 - e : u;
    const vv = v < 0.001 ? e : v > 0.999 ? 1 - e : v;
    return [(tx + uu) / 16, (ty + vv) / 16];
  }

  function Mesher() {
    this.solid = new VBuf(4096);
    this.trans = new VBuf(1024);
    this.opq = new Uint8Array(256);
  }

  /**
   * Mesh one 16^3 section from padded 18^3 arrays.
   * job = {blocks, meta, light, fancy, smooth}
   */
  Mesher.prototype.mesh = function (job) {
    const bl = job.blocks, me = job.meta, li = job.light;
    const fancy = !!job.fancy, smooth = !!job.smooth;
    const opq = this.opq;
    opq.set(OPAQUE);
    // fast graphics: leaves are drawn solid, so they may hide what is behind them
    if (!fancy) for (let id = 0; id < 256; id++) if (LEAVES[id]) opq[id] = 1;
    this.solid.n = 0; this.trans.n = 0;
    this.bl = bl; this.me = me; this.li = li; this.fancy = fancy; this.smooth = smooth;
    for (let y = 0; y < 16; y++) {
      for (let z = 0; z < 16; z++) {
        let i = (y + 1) * P2 + (z + 1) * P + 1;
        for (let x = 0; x < 16; x++, i++) {
          const id = bl[i];
          if (id === 0) continue;
          switch (RENDER[id]) {
            case R.CUBE: this.cube(i, id, x, y, z); break;
            case R.CROSS: this.cross(i, id, x, y, z, 0.45); break;
            case R.TORCH: this.torch(i, id, x, y, z); break;
            case R.LIQUID: this.liquid(i, id, x, y, z); break;
            case R.SLAB: this.box(i, id, x, y, z, 0, 0, 0, 16, 8, 16); break;
            case R.SNOW: this.box(i, id, x, y, z, 0, 0, 0, 16, 2, 16); break;
            case R.FARMLAND: this.box(i, id, x, y, z, 0, 0, 0, 16, 15, 16); break;
            case R.STAIRS: this.stairs(i, id, x, y, z); break;
            case R.CACTUS: this.cactus(i, id, x, y, z); break;
            case R.LADDER: this.ladder(i, id, x, y, z); break;
            case R.FENCE: this.fence(i, id, x, y, z); break;
            case R.DOOR: this.door(i, id, x, y, z); break;
            case R.CROPS: this.crops(i, id, x, y, z); break;
            case R.FIRE: this.fire(i, id, x, y, z); break;
            case R.SHAPE: { const bx = shapeBoxes(id, this.me[i]); for (const b of bx) this.box(i, id, x, y, z, b[0], b[1], b[2], b[3], b[4], b[5]); break; }
            case R.PORTAL: if (this.me[i] & 1) this.box(i, id, x, y, z, 6, 0, 0, 10, 16, 16); else this.box(i, id, x, y, z, 0, 0, 6, 16, 16, 10); break;
          }
        }
      }
    }
    return { solid: this.solid.result(), solidCount: this.solid.n, trans: this.trans.result(), transCount: this.trans.n };
  };

  Mesher.prototype.cube = function (i, id, x, y, z) {
    const bl = this.bl, li = this.li, opq = this.opq;
    const out = LAYER[id] === 1 ? this.trans : this.solid;
    const leaf = LEAVES[id] === 1;
    const self = SELFCULL[id] || (leaf && !this.fancy);
    const meta = this.me[i];
    const above = bl[i + P2];
    const flags = leaf ? (this.fancy ? 1 : 3) : 0;
    for (let f = 0; f < 6; f++) {
      const ni = i + DOFF[f];
      const n = bl[ni];
      if (opq[n]) continue;
      if (self && n === id) continue;
      if (id === B.ice && n === B.water) continue;
      const tile = tileFor(id, f, meta, above);
      this.cubeFace(out, i, ni, f, x, y, z, tile, flags);
    }
  };

  Mesher.prototype.cubeFace = function (out, i, ni, f, x, y, z, tile, flags) {
    const li = this.li, bl = this.bl, opq = this.opq;
    const fv = FACE_VERTS[f];
    const shade = FACE_SHADE[f];
    const sk = [0, 0, 0, 0], bk = [0, 0, 0, 0], sh = [0, 0, 0, 0];
    if (this.smooth) {
      const nL = li[ni];
      for (let v = 0; v < 4; v++) {
        const a = ni + SIDE1[f * 4 + v], b = ni + SIDE2[f * 4 + v], c = a + SIDE2[f * 4 + v];
        const oa = opq[bl[a]], ob = opq[bl[b]], oc = opq[bl[c]];
        let s = nL >> 4, k = nL & 15, cnt = 1;
        if (!oa) { s += li[a] >> 4; k += li[a] & 15; cnt++; }
        if (!ob) { s += li[b] >> 4; k += li[b] & 15; cnt++; }
        if (!oc && !(oa && ob)) { s += li[c] >> 4; k += li[c] & 15; cnt++; }
        const ao = (oa && ob) ? 0 : 3 - (oa + ob + oc);
        sk[v] = s / cnt; bk[v] = k / cnt; sh[v] = shade * AO_CURVE[ao];
      }
    } else {
      const nL = li[ni];
      const s = nL >> 4, k = nL & 15;
      for (let v = 0; v < 4; v++) { sk[v] = s; bk[v] = k; sh[v] = shade; }
    }
    // choose diagonal
    const b0 = sh[0] * (Math.max(sk[0], bk[0]) + 1), b1 = sh[1] * (Math.max(sk[1], bk[1]) + 1);
    const b2 = sh[2] * (Math.max(sk[2], bk[2]) + 1), b3 = sh[3] * (Math.max(sk[3], bk[3]) + 1);
    const start = (b0 + b2 < b1 + b3) ? 1 : 0;
    const tx = tile & 15, ty = tile >> 4;
    for (let k = 0; k < 4; k++) {
      const v = (k + start) & 3;
      const c = fv[v], uv = FACE_UV[v];
      const e = 0.00004;
      out.v(x + c[0], y + c[1], z + c[2],
        (tx + (uv[0] ? 1 - e : e)) / 16, (ty + (uv[1] ? 1 - e : e)) / 16,
        (sk[v] * 17 + 0.5) | 0, (bk[v] * 17 + 0.5) | 0, (sh[v] * 255 + 0.5) | 0, flags);
    }
  };

  // Generic axis aligned box in 1/16 units with flat lighting.
  Mesher.prototype.box = function (i, id, x, y, z, x0, y0, z0, x1, y1, z1, texOverride, outOverride, noCull) {
    const bl = this.bl, li = this.li, opq = this.opq, meta = this.me[i];
    const out = outOverride || (LAYER[id] === 1 ? this.trans : this.solid);
    const above = bl[i + P2];
    const mn = [x0 / 16, y0 / 16, z0 / 16], mx = [x1 / 16, y1 / 16, z1 / 16];
    for (let f = 0; f < 6; f++) {
      const onEdge = (f === 0 && y0 === 0) || (f === 1 && y1 === 16) || (f === 2 && z0 === 0) ||
        (f === 3 && z1 === 16) || (f === 4 && x0 === 0) || (f === 5 && x1 === 16);
      const ni = i + DOFF[f];
      if (onEdge && !noCull && opq[bl[ni]]) continue;
      if (onEdge && !noCull && bl[ni] === id && (RENDER[id] === R.SNOW || RENDER[id] === R.PORTAL || RENDER[id] === R.SHAPE)) continue;
      const lv = (onEdge || LOPAC[id] >= 15) ? li[ni] : li[i];
      const tile = texOverride !== undefined ? (typeof texOverride === 'number' ? texOverride : texOverride[f]) : tileFor(id, f, meta, above);
      this.quadBox(out, f, x, y, z, mn, mx, tile, lv >> 4, lv & 15, FACE_SHADE[f], 0);
    }
  };

  Mesher.prototype.quadBox = function (out, f, x, y, z, mn, mx, tile, s, k, shade, flags, uvRot) {
    const fv = FACE_VERTS[f];
    const tx = tile & 15, ty = tile >> 4;
    const e = 0.00004;
    for (let v = 0; v < 4; v++) {
      const c = fv[v];
      const px = c[0] ? mx[0] : mn[0], py = c[1] ? mx[1] : mn[1], pz = c[2] ? mx[2] : mn[2];
      let u, w;
      switch (f) {
        case 0: u = px; w = 1 - pz; break;
        case 1: u = px; w = pz; break;
        case 2: u = 1 - px; w = 1 - py; break;
        case 3: u = px; w = 1 - py; break;
        case 4: u = pz; w = 1 - py; break;
        default: u = 1 - pz; w = 1 - py; break;
      }
      if (uvRot) { const t = u; u = 1 - w; w = t; }
      u = u < e ? e : u > 1 - e ? 1 - e : u;
      w = w < e ? e : w > 1 - e ? 1 - e : w;
      out.v(x + px, y + py, z + pz, (tx + u) / 16, (ty + w) / 16,
        (s * 17 + 0.5) | 0, (k * 17 + 0.5) | 0, (shade * 255 + 0.5) | 0, flags);
    }
  };

  // Emit a double sided quad given 4 corner points (BL, BR, TR, TL) + tile.
  Mesher.prototype.quad2 = function (out, pts, tile, s, k, shade, flags, u0, v0, u1, v1, oneSided) {
    const tx = tile & 15, ty = tile >> 4;
    u0 = u0 === undefined ? 0 : u0; v0 = v0 === undefined ? 0 : v0;
    u1 = u1 === undefined ? 1 : u1; v1 = v1 === undefined ? 1 : v1;
    const e = 0.00004;
    const uvs = [[u0 + e, v1 - e], [u1 - e, v1 - e], [u1 - e, v0 + e], [u0 + e, v0 + e]];
    const S_ = (s * 17 + 0.5) | 0, K_ = (k * 17 + 0.5) | 0, H_ = (shade * 255 + 0.5) | 0;
    for (let v = 0; v < 4; v++) {
      const p = pts[v];
      out.v(p[0], p[1], p[2], (tx + uvs[v][0]) / 16, (ty + uvs[v][1]) / 16, S_, K_, H_, flags);
    }
    if (oneSided) return;
    for (let v = 0; v < 4; v++) {
      const vv = [1, 0, 3, 2][v];
      const p = pts[vv];
      out.v(p[0], p[1], p[2], (tx + uvs[vv][0]) / 16, (ty + uvs[vv][1]) / 16, S_, K_, H_, flags);
    }
  };

  Mesher.prototype.cross = function (i, id, x, y, z, r) {
    const lv = this.li[i];
    const tile = tileFor(id, 2, this.me[i], 0);
    const a = 0.5 - r, b = 0.5 + r;
    const out = this.solid;
    const flag = (id === B.sapling || id === B.dandelion || id === B.rose) ? 2 : 0;
    this.quad2(out, [[x + a, y, z + a], [x + b, y, z + b], [x + b, y + 1, z + b], [x + a, y + 1, z + a]], tile, lv >> 4, lv & 15, 1, flag);
    this.quad2(out, [[x + a, y, z + b], [x + b, y, z + a], [x + b, y + 1, z + a], [x + a, y + 1, z + b]], tile, lv >> 4, lv & 15, 1, flag);
  };

  Mesher.prototype.crops = function (i, id, x, y, z) {
    const lv = this.li[i];
    const tile = tileFor(id, 2, this.me[i], 0);
    const out = this.solid;
    const y0 = y - 1 / 16, y1 = y + 15 / 16;
    for (const o of [4 / 16, 12 / 16]) {
      this.quad2(out, [[x + o, y0, z], [x + o, y0, z + 1], [x + o, y1, z + 1], [x + o, y1, z]], tile, lv >> 4, lv & 15, 1, 0);
      this.quad2(out, [[x, y0, z + o], [x + 1, y0, z + o], [x + 1, y1, z + o], [x, y1, z + o]], tile, lv >> 4, lv & 15, 1, 0);
    }
  };

  Mesher.prototype.fire = function (i, id, x, y, z) {
    const lv = this.li[i];
    const out = this.solid;
    const tiles = [T.fire, T.fire_2];
    const s = lv >> 4, k = 15;
    const h = 1.4;
    // cross planes
    this.quad2(out, [[x + 0.2, y, z], [x + 0.2, y, z + 1], [x + 0.5, y + h, z + 1], [x + 0.5, y + h, z]], tiles[0], s, k, 1, 0);
    this.quad2(out, [[x + 0.8, y, z + 1], [x + 0.8, y, z], [x + 0.5, y + h, z], [x + 0.5, y + h, z + 1]], tiles[1], s, k, 1, 0);
    this.quad2(out, [[x, y, z + 0.2], [x + 1, y, z + 0.2], [x + 1, y + h, z + 0.5], [x, y + h, z + 0.5]], tiles[1], s, k, 1, 0);
    this.quad2(out, [[x + 1, y, z + 0.8], [x, y, z + 0.8], [x, y + h, z + 0.5], [x + 1, y + h, z + 0.5]], tiles[0], s, k, 1, 0);
  };

  Mesher.prototype.torch = function (i, id, x, y, z) {
    const lv = this.li[i];
    const meta = this.me[i];
    const tile = T.torch;
    const out = this.solid;
    let ox = 0, oy = 0, oz = 0, dx = 0, dz = 0;
    // meta: 0 floor, 1 wall at north(-z), 2 south, 3 west(-x), 4 east
    if (meta === 1) { oz = -0.1; oy = 0.2; dz = -0.4; }
    else if (meta === 2) { oz = 0.1; oy = 0.2; dz = 0.4; }
    else if (meta === 3) { ox = -0.1; oy = 0.2; dx = -0.4; }
    else if (meta === 4) { ox = 0.1; oy = 0.2; dx = 0.4; }
    const cx = x + 0.5 + ox, cz = z + 0.5 + oz, by = y + oy;
    const w = 1 / 16;
    const s = lv >> 4, k = lv & 15;
    // top vertices at y+1 (texture covers whole 16px tile), bottom shifted by dx,dz
    const q = (x0, z0, x1, z1, bx0, bz0, bx1, bz1) => [[bx0, by, bz0], [bx1, by, bz1], [x1, by + 1, z1], [x0, by + 1, z0]];
    // west-facing plane at x = cx - w
    this.quad2(out, q(cx - w, cz - 0.5, cx - w, cz + 0.5, cx - w + dx, cz - 0.5 + dz, cx - w + dx, cz + 0.5 + dz), tile, s, k, 0.8, 0, 0, 0, 1, 1, false);
    this.quad2(out, q(cx + w, cz + 0.5, cx + w, cz - 0.5, cx + w + dx, cz + 0.5 + dz, cx + w + dx, cz - 0.5 + dz), tile, s, k, 0.8, 0, 0, 0, 1, 1, false);
    this.quad2(out, q(cx + 0.5, cz - w, cx - 0.5, cz - w, cx + 0.5 + dx, cz - w + dz, cx - 0.5 + dx, cz - w + dz), tile, s, k, 0.9, 0, 0, 0, 1, 1, false);
    this.quad2(out, q(cx - 0.5, cz + w, cx + 0.5, cz + w, cx - 0.5 + dx, cz + w + dz, cx + 0.5 + dx, cz + w + dz), tile, s, k, 0.9, 0, 0, 0, 1, 1, false);
    // top cap (texture pixels 7..9 x 6..8)
    const ty = by + 10 / 16;
    const tdx = dx * (6 / 16), tdz = dz * (6 / 16);
    const tx0 = cx - w + tdx, tx1 = cx + w + tdx, tz0 = cz - w + tdz, tz1 = cz + w + tdz;
    this.quad2(out, [[tx0, ty, tz1], [tx1, ty, tz1], [tx1, ty, tz0], [tx0, ty, tz0]], tile, s, k, 1, 0, 7 / 16, 6 / 16, 9 / 16, 8 / 16, true);
  };

  Mesher.prototype.ladder = function (i, id, x, y, z) {
    const lv = this.li[i], meta = this.me[i];
    const out = this.solid, t = T.ladder, e = 1 / 16;
    const s = lv >> 4, k = lv & 15;
    let pts;
    // meta: wall the ladder is attached to: 0 north(-z) 1 south 2 west 3 east
    if (meta === 0) pts = [[x + 1, y, z + e], [x, y, z + e], [x, y + 1, z + e], [x + 1, y + 1, z + e]];
    else if (meta === 1) pts = [[x, y, z + 1 - e], [x + 1, y, z + 1 - e], [x + 1, y + 1, z + 1 - e], [x, y + 1, z + 1 - e]];
    else if (meta === 2) pts = [[x + e, y, z], [x + e, y, z + 1], [x + e, y + 1, z + 1], [x + e, y + 1, z]];
    else pts = [[x + 1 - e, y, z + 1], [x + 1 - e, y, z], [x + 1 - e, y + 1, z], [x + 1 - e, y + 1, z + 1]];
    this.quad2(out, pts, t, s, k, 0.8, 0);
  };

  Mesher.prototype.cactus = function (i, id, x, y, z) {
    const bl = this.bl, li = this.li, opq = this.opq;
    const out = this.solid;
    const lv = li[i];
    const e = 1 / 16;
    for (let f = 0; f < 6; f++) {
      const ni = i + DOFF[f];
      if (f < 2 && (opq[bl[ni]] || bl[ni] === id)) continue;
      const l = f < 2 ? li[ni] : lv;
      const tile = TEX[id * 6 + f];
      let mn = [0, 0, 0], mx = [1, 1, 1];
      if (f === 2) { mn = [0, 0, e]; mx = [1, 1, e]; }
      if (f === 3) { mn = [0, 0, 1 - e]; mx = [1, 1, 1 - e]; }
      if (f === 4) { mn = [e, 0, 0]; mx = [e, 1, 1]; }
      if (f === 5) { mn = [1 - e, 0, 0]; mx = [1 - e, 1, 1]; }
      this.quadBox(out, f, x, y, z, mn, mx, tile, l >> 4, l & 15, FACE_SHADE[f], 0);
    }
  };

  Mesher.prototype.stairs = function (i, id, x, y, z) {
    const meta = this.me[i] & 3;
    this.box(i, id, x, y, z, 0, 0, 0, 16, 8, 16);
    // upper half on side the stairs face (0 north,1 south,2 west,3 east)
    if (meta === 0) this.box(i, id, x, y, z, 0, 8, 0, 16, 16, 8);
    else if (meta === 1) this.box(i, id, x, y, z, 0, 8, 8, 16, 16, 16);
    else if (meta === 2) this.box(i, id, x, y, z, 0, 8, 0, 8, 16, 16);
    else this.box(i, id, x, y, z, 8, 8, 0, 16, 16, 16);
  };

  function fenceConnects(n) { return n === B.fence || n === B.nether_brick_fence || (OPAQUE[n] && SOLID[n]); }
  S.fenceConnects = fenceConnects;

  Mesher.prototype.fence = function (i, id, x, y, z) {
    const bl = this.bl;
    this.box(i, id, x, y, z, 6, 0, 6, 10, 16, 10);
    const n = bl[i - P], s = bl[i + P], w = bl[i - 1], e = bl[i + 1];
    for (const [y0, y1] of [[12, 15], [6, 9]]) {
      if (fenceConnects(n)) this.box(i, id, x, y, z, 7, y0, 0, 9, y1, 6, undefined, undefined, true);
      if (fenceConnects(s)) this.box(i, id, x, y, z, 7, y0, 10, 9, y1, 16, undefined, undefined, true);
      if (fenceConnects(w)) this.box(i, id, x, y, z, 0, y0, 7, 6, y1, 9, undefined, undefined, true);
      if (fenceConnects(e)) this.box(i, id, x, y, z, 10, y0, 7, 16, y1, 9, undefined, undefined, true);
    }
  };

  function doorBox(meta) {
    // returns [x0,z0,x1,z1] in 1/16 units
    let side = meta & 3; // side the closed panel sits on: 0 north,1 south,2 west,3 east
    if (meta & 4) side = [3, 2, 0, 1][side];
    switch (side) {
      case 0: return [0, 0, 16, 3];
      case 1: return [0, 13, 16, 16];
      case 2: return [0, 0, 3, 16];
      default: return [13, 0, 16, 16];
    }
  }
  S.doorBox = doorBox;

  Mesher.prototype.door = function (i, id, x, y, z) {
    const meta = this.me[i];
    const b = doorBox(meta);
    const t = (meta & 8) ? T.door_top : T.door_bottom;
    this.box(i, id, x, y, z, b[0], 0, b[1], b[2], 16, b[3], t);
  };

  function fluidPercent(meta) { if (meta >= 8) meta = 0; return (meta + 1) / 9; }
  Mesher.prototype.fluidCornerHeight = function (i, id) {
    // i is the padded index of the cell at the -x,-z of the corner's 4 cells
    const bl = this.bl, me = this.me;
    let tot = 0, cnt = 0;
    const cells = [i, i - 1, i - P, i - P - 1];
    for (let c = 0; c < 4; c++) {
      const j = cells[c];
      if (bl[j + P2] === id) return 1;
      const b = bl[j];
      if (b === id) {
        const m = me[j];
        if (m >= 8 || m === 0) { tot += fluidPercent(m) * 10; cnt += 10; }
        tot += fluidPercent(m); cnt++;
      } else if (!SOLID[b]) { tot += 1; cnt++; }
    }
    return cnt ? 1 - tot / cnt : 1;
  };

  Mesher.prototype.liquid = function (i, id, x, y, z) {
    const bl = this.bl, li = this.li, opq = this.opq;
    const out = id === B.water ? this.trans : this.solid;
    const lava = id === B.lava;
    const above = bl[i + P2];
    // corner heights: (x,z), (x+1,z), (x+1,z+1), (x,z+1)
    const h00 = this.fluidCornerHeight(i, id);
    const h10 = this.fluidCornerHeight(i + 1, id);
    const h11 = this.fluidCornerHeight(i + 1 + P, id);
    const h01 = this.fluidCornerHeight(i + P, id);
    const flowing = this.me[i] !== 0;
    const topTile = flowing ? (lava ? T.lava_flow : T.water_flow) : (lava ? T.lava : T.water);
    const sideTile = lava ? T.lava_flow : T.water_flow;
    const flags = lava ? 4 : 3;
    const lvOf = (j) => { const l = li[j]; return lava ? [l >> 4, 15] : [l >> 4, l & 15]; };
    const e = 0.001;
    if (above !== id) {
      const L = lvOf(i + P2);
      const L2 = lvOf(i);
      const s = Math.max(L[0], L2[0]), k = Math.max(L[1], L2[1]);
      const pts = [[x, y + h01 - e, z + 1], [x + 1, y + h11 - e, z + 1], [x + 1, y + h10 - e, z], [x, y + h00 - e, z]];
      this.quad2(out, pts, topTile, s, k, 1, flags, 0, 0, 1, 1, true);
      // underside of the surface (seen from below water)
      const pts2 = [[x + 1, y + h11 - e, z + 1], [x, y + h01 - e, z + 1], [x, y + h00 - e, z], [x + 1, y + h10 - e, z]];
      this.quad2(out, pts2, topTile, s, k, 0.9, flags, 0, 0, 1, 1, true);
    }
    const below = bl[i - P2];
    if (below !== id && !opq[below]) {
      const L = lvOf(i - P2);
      this.quad2(out, [[x, y + e, z], [x + 1, y + e, z], [x + 1, y + e, z + 1], [x, y + e, z + 1]], topTile, L[0], L[1], 0.5, flags, 0, 0, 1, 1, true);
    }
    // sides: north(-z) uses h10,h00 ; south h01,h11 ; west h00,h01 ; east h11,h10
    const sides = [
      [2, -P, [[x + 1, y, z], [x, y, z]], [h10, h00]],
      [3, P, [[x, y, z + 1], [x + 1, y, z + 1]], [h01, h11]],
      [4, -1, [[x, y, z], [x, y, z + 1]], [h00, h01]],
      [5, 1, [[x + 1, y, z + 1], [x + 1, y, z]], [h11, h10]]
    ];
    for (const sd of sides) {
      const n = bl[i + sd[1]];
      if (n === id || opq[n]) continue;
      if (id === B.water && n === B.ice) continue;
      const L = lvOf(i + sd[1]);
      const a = sd[2][0], b = sd[2][1];
      const ha = sd[3][0], hb = sd[3][1];
      const pts = [[a[0], a[1], a[2]], [b[0], b[1], b[2]], [b[0], y + hb, b[2]], [a[0], y + ha, a[2]]];
      const tx = sideTile & 15, ty = sideTile >> 4;
      const S_ = (L[0] * 17) | 0, K_ = (L[1] * 17) | 0, H_ = (FACE_SHADE[sd[0]] * 255) | 0;
      const uvs = [[0.001, 0.999], [0.999, 0.999], [0.999, 1 - hb * 0.998], [0.001, 1 - ha * 0.998]];
      for (let v = 0; v < 4; v++) out.v(pts[v][0], pts[v][1], pts[v][2], (tx + uvs[v][0]) / 16, (ty + uvs[v][1]) / 16, S_, K_, H_, flags);
      // back face so it is visible from inside
      for (const v of [1, 0, 3, 2]) out.v(pts[v][0], pts[v][1], pts[v][2], (tx + uvs[v][0]) / 16, (ty + uvs[v][1]) / 16, S_, K_, H_, flags);
    }
  };

  S.Mesher = Mesher;

  return S;
}

/* Worker entry point (stringified into a blob worker). */
function DL_WORKER_MAIN(S) {
  let gen = null;
  const mesher = new S.Mesher();
  self.onmessage = function (e) {
    const m = e.data;
    if (m.t === 'init') {
      gen = new S.Generator(m.seed, m.dim);
    } else if (m.t === 'gen') {
      const r = gen.generate(m.cx, m.cz);
      self.postMessage({ t: 'gen', cx: m.cx, cz: m.cz, blocks: r.blocks, meta: r.meta, biomes: r.biomes, seed: m.seed },
        [r.blocks.buffer, r.meta.buffer, r.biomes.buffer]);
    } else if (m.t === 'mesh') {
      const r = mesher.mesh(m);
      self.postMessage({ t: 'mesh', key: m.key, ver: m.ver, solid: r.solid, solidCount: r.solidCount, trans: r.trans, transCount: r.transCount },
        [r.solid, r.trans]);
    }
  };
}
