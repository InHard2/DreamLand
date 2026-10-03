/*
 * DreamLand - resource packs. Load any Minecraft Java Edition resource pack
 * (.zip) from Options > Resource Packs, or drop the file onto the game.
 * Block and item textures are mapped onto DreamLand's tiles (16x up to 64x),
 * grey textures Minecraft colours at runtime (grass, leaves...) are tinted,
 * animated strips play, and the pack is remembered on this device.
 * Packs only change pictures: nothing in them is ever run.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, Tex = DL.Tex, G = DL.GUI, A = DL.Audio;
  const RP = DL.Renderer.prototype;
  const MAX_PACK = 200 * 1024 * 1024, MAX_FILE = 16 * 1024 * 1024, MAX_RES = 64;

  /* ------------------------------------------------------------ */
  /* What each DreamLand texture is called in Minecraft           */
  /* ------------------------------------------------------------ */
  const GRASS = [145, 189, 89], FOLIAGE = [119, 171, 47], WATER = [63, 118, 228];
  // tile: 'name|older_name', or [names, tint]
  const BLOCKS = {
    grass_top: ['grass_block_top|grass_top', GRASS], grass_side: ['grass_block_side|grass_side', 'grassSide'], dirt: 'dirt', stone: 'stone',
    cobblestone: 'cobblestone', planks: 'oak_planks|planks_oak', bedrock: 'bedrock', sand: 'sand', gravel: 'gravel',
    log_side: 'oak_log|log_oak', log_top: 'oak_log_top|log_oak_top', leaves: ['oak_leaves|leaves_oak', FOLIAGE], leaves_opaque: ['oak_leaves|leaves_oak', FOLIAGE, 'opaque'],
    sponge: 'sponge', glass: 'glass', wool: 'white_wool|wool_colored_white', gold_ore: 'gold_ore', iron_ore: 'iron_ore', coal_ore: 'coal_ore',
    diamond_ore: 'diamond_ore', redstone_ore: 'redstone_ore', gold_block: 'gold_block', iron_block: 'iron_block', diamond_block: 'diamond_block',
    bricks: 'bricks|brick', mossy_cobblestone: 'mossy_cobblestone|cobblestone_mossy', obsidian: 'obsidian', slab_side: 'smooth_stone_slab_side|stone_slab_side',
    slab_top: 'smooth_stone|stone_slab_top', tnt_side: 'tnt_side', tnt_top: 'tnt_top', tnt_bottom: 'tnt_bottom', bookshelf: 'bookshelf',
    dandelion: 'dandelion|flower_dandelion', rose: 'poppy|flower_rose', brown_mushroom: 'brown_mushroom|mushroom_brown', red_mushroom: 'red_mushroom|mushroom_red',
    sapling: 'oak_sapling|sapling_oak', reeds: ['sugar_cane|reeds', GRASS], torch: 'torch|torch_on', fire: 'fire_0|fire_layer_0', fire_2: 'fire_1|fire_layer_1', spawner: 'spawner|mob_spawner',
    crafting_table_top: 'crafting_table_top', crafting_table_side: 'crafting_table_side', crafting_table_front: 'crafting_table_front',
    furnace_side: 'furnace_side', furnace_top: 'furnace_top', furnace_front: 'furnace_front|furnace_front_off', furnace_front_lit: 'furnace_front_on',
    farmland_dry: 'farmland|farmland_dry', farmland_wet: 'farmland_moist|farmland_wet', door_top: 'oak_door_top|door_wood_upper', door_bottom: 'oak_door_bottom|door_wood_lower',
    ladder: 'ladder', snow: 'snow', grass_side_snow: 'grass_block_snow|grass_side_snowed', ice: 'ice', cactus_side: 'cactus_side', cactus_top: 'cactus_top',
    cactus_bottom: 'cactus_bottom', clay: 'clay', pumpkin_top: 'pumpkin_top', pumpkin_side: 'pumpkin_side', pumpkin_face: 'carved_pumpkin|pumpkin_face_off',
    jack_o_lantern_face: 'jack_o_lantern|pumpkin_face_on', water: ['water_still', WATER], water_flow: ['water_flow', WATER], lava: 'lava_still', lava_flow: 'lava_flow',
    sandstone_top: 'sandstone_top', sandstone_side: 'sandstone|sandstone_normal', sandstone_bottom: 'sandstone_bottom', chiseled_sandstone: 'chiseled_sandstone|sandstone_carved',
    cobweb: 'cobweb|web', rail: 'rail|rail_normal', stone_bricks: 'stone_bricks|stonebrick', mossy_stone_bricks: 'mossy_stone_bricks|stonebrick_mossy',
    cracked_stone_bricks: 'cracked_stone_bricks|stonebrick_cracked', iron_bars: 'iron_bars', dark_planks: 'dark_oak_planks|planks_big_oak', dark_log_side: 'dark_oak_log|log_big_oak',
    dark_log_top: 'dark_oak_log_top|log_big_oak_top', prismarine: 'prismarine|prismarine_rough', prismarine_bricks: 'prismarine_bricks', dark_prismarine: 'dark_prismarine|prismarine_dark',
    sea_lantern: 'sea_lantern', hay_side: 'hay_block_side', hay_top: 'hay_block_top', terracotta: 'terracotta|hardened_clay', emerald_ore: 'emerald_ore', emerald_block: 'emerald_block',
    dirt_path_top: 'dirt_path_top|grass_path_top', dirt_path_side: 'dirt_path_side|grass_path_side', bone_block_side: 'bone_block_side', bone_block_top: 'bone_block_top',
    cauldron_side: 'cauldron_side', cauldron_top: 'cauldron_top', cauldron_inner: 'cauldron_inner',
    netherrack: 'netherrack', soul_sand: 'soul_sand', glowstone: 'glowstone', nether_portal: 'nether_portal|portal', nether_bricks: 'nether_bricks|nether_brick',
    nether_wart_0: 'nether_wart_stage0|nether_wart_stage_0', nether_wart_1: 'nether_wart_stage1|nether_wart_stage_1', nether_wart_2: 'nether_wart_stage2|nether_wart_stage_2',
    quartz_ore: 'nether_quartz_ore|quartz_ore', magma: 'magma|magma_block', blackstone: 'blackstone', blackstone_top: 'blackstone_top',
    polished_blackstone_bricks: 'polished_blackstone_bricks', gilded_blackstone: 'gilded_blackstone', crying_obsidian: 'crying_obsidian',
    end_stone: 'end_stone', end_frame_side: 'end_portal_frame_side|endframe_side', end_frame_top: 'end_portal_frame_top|endframe_top', end_frame_eye: 'end_portal_frame_eye|endframe_eye',
    dragon_egg: 'dragon_egg', purpur_block: 'purpur_block', purpur_pillar_side: 'purpur_pillar', purpur_pillar_top: 'purpur_pillar_top', end_stone_bricks: 'end_stone_bricks|end_bricks',
    end_rod: 'end_rod', chorus_plant: 'chorus_plant', chorus_flower: 'chorus_flower',
    birch_log_side: 'birch_log|log_birch', birch_log_top: 'birch_log_top|log_birch_top', birch_leaves: ['birch_leaves|leaves_birch', [128, 167, 85]], birch_planks: 'birch_planks|planks_birch',
    spruce_log_side: 'spruce_log|log_spruce', spruce_log_top: 'spruce_log_top|log_spruce_top', spruce_leaves: ['spruce_leaves|leaves_spruce', [97, 153, 97]], spruce_planks: 'spruce_planks|planks_spruce',
    acacia_log_side: 'acacia_log|log_acacia', acacia_log_top: 'acacia_log_top|log_acacia_top', acacia_leaves: ['acacia_leaves|leaves_acacia', FOLIAGE], acacia_planks: 'acacia_planks|planks_acacia',
    jungle_log_side: 'jungle_log|log_jungle', jungle_log_top: 'jungle_log_top|log_jungle_top', jungle_leaves: ['jungle_leaves|leaves_jungle', FOLIAGE], jungle_planks: 'jungle_planks|planks_jungle',
    mangrove_log_side: 'mangrove_log', mangrove_log_top: 'mangrove_log_top', mangrove_leaves: ['mangrove_leaves', [146, 198, 72]], mangrove_roots: 'mangrove_roots_side', mud: 'mud', mangrove_planks: 'mangrove_planks',
    cherry_log_side: 'cherry_log', cherry_log_top: 'cherry_log_top', cherry_leaves: 'cherry_leaves', cherry_planks: 'cherry_planks',
    pale_oak_log_side: 'pale_oak_log', pale_oak_log_top: 'pale_oak_log_top', pale_oak_leaves: 'pale_oak_leaves', pale_oak_planks: 'pale_oak_planks', pale_moss: 'pale_moss_block', red_sand: 'red_sand',
    white_terracotta: 'white_terracotta', orange_terracotta: 'orange_terracotta', yellow_terracotta: 'yellow_terracotta', red_terracotta: 'red_terracotta', brown_terracotta: 'brown_terracotta',
    light_gray_terracotta: 'light_gray_terracotta', short_grass: ['short_grass|grass|tallgrass', GRASS], fern: ['fern', GRASS], dead_bush: 'dead_bush|deadbush', sunflower: 'sunflower_front|double_plant_sunflower_front',
    cornflower: 'cornflower', allium: 'allium|flower_allium', orange_tulip: 'orange_tulip|flower_tulip_orange', pink_tulip: 'pink_tulip|flower_tulip_pink', lily_of_the_valley: 'lily_of_the_valley',
    pink_petals: 'pink_petals', bamboo: 'bamboo_stalk', lily_pad: ['lily_pad|waterlily', [32, 128, 48]], pointed_dripstone: 'pointed_dripstone_up_tip', mycelium_top: 'mycelium_top',
    mycelium_side: 'mycelium_side', podzol_top: 'podzol_top|dirt_podzol_top', podzol_side: 'podzol_side|dirt_podzol_side', coarse_dirt: 'coarse_dirt', moss_block: 'moss_block',
    red_mushroom_block: 'red_mushroom_block|mushroom_block_skin_red', brown_mushroom_block: 'brown_mushroom_block|mushroom_block_skin_brown', mushroom_stem: 'mushroom_stem|mushroom_block_skin_stem',
    packed_ice: 'packed_ice|ice_packed', blue_ice: 'blue_ice', calcite: 'calcite', dripstone_block: 'dripstone_block', deepslate: 'deepslate', deepslate_top: 'deepslate_top',
    sculk: 'sculk', sculk_sensor_top: 'sculk_sensor_top', sculk_sensor_side: 'sculk_sensor_side', azalea_leaves: 'azalea_leaves', flowering_azalea_leaves: 'flowering_azalea_leaves',
    dark_oak_leaves: ['dark_oak_leaves|leaves_big_oak', FOLIAGE]
  };
  for (let i = 0; i < 8; i++) BLOCKS['wheat_' + i] = 'wheat_stage' + i + '|wheat_stage_' + i;
  for (let i = 0; i < 10; i++) BLOCKS['destroy_' + i] = 'destroy_stage_' + i;
  const ITEMS = {
    stick: 'stick', coal: 'coal', diamond: 'diamond', iron_ingot: 'iron_ingot', gold_ingot: 'gold_ingot', apple: 'apple|apple', golden_apple: 'golden_apple|apple_golden',
    bread: 'bread', wheat: 'wheat', seeds: 'wheat_seeds|seeds_wheat', porkchop_raw: 'porkchop|porkchop_raw', porkchop_cooked: 'cooked_porkchop|porkchop_cooked',
    feather: 'feather', gunpowder: 'gunpowder', string: 'string', bone: 'bone', leather: 'leather', flint: 'flint', flint_and_steel: 'flint_and_steel',
    bow: 'bow|bow_standby', arrow: 'arrow', bucket: 'bucket|bucket_empty', water_bucket: 'water_bucket|bucket_water', lava_bucket: 'lava_bucket|bucket_lava', milk_bucket: 'milk_bucket|bucket_milk',
    bowl: 'bowl', mushroom_stew: 'mushroom_stew', paper: 'paper', book: 'book|book_normal', reeds: 'sugar_cane|reeds', clay_ball: 'clay_ball', brick: 'brick', snowball: 'snowball',
    egg: 'egg', wooden_door: 'oak_door|door_wood', redstone: 'redstone|redstone_dust', fish_raw: 'cod|fish_cod_raw', fish_cooked: 'cooked_cod|fish_cod_cooked', saddle: 'saddle',
    rotten_flesh: 'rotten_flesh', ender_pearl: 'ender_pearl', blaze_rod: 'blaze_rod', ghast_tear: 'ghast_tear', gold_nugget: 'gold_nugget', nether_wart: 'nether_wart',
    blaze_powder: 'blaze_powder', magma_cream: 'magma_cream', eye_of_ender: 'ender_eye', fire_charge: 'fire_charge|fireball', emerald: 'emerald', nether_brick: 'nether_brick|netherbrick',
    quartz: 'quartz', raw_rabbit: 'rabbit|rabbit_raw', cooked_rabbit: 'cooked_rabbit|rabbit_cooked', rabbit_hide: 'rabbit_hide', chorus_fruit: 'chorus_fruit',
    popped_chorus_fruit: 'popped_chorus_fruit|chorus_fruit_popped', elytra: 'elytra', shulker_shell: 'shulker_shell', raw_beef: 'beef|beef_raw', steak: 'cooked_beef|beef_cooked',
    raw_chicken: 'chicken|chicken_raw', cooked_chicken: 'cooked_chicken|chicken_cooked', raw_mutton: 'mutton|mutton_raw', cooked_mutton: 'cooked_mutton|mutton_cooked',
    sugar: 'sugar', pumpkin_pie: 'pumpkin_pie', leather_horse_armor: 'leather_horse_armor', iron_horse_armor: 'iron_horse_armor|iron_horse_armor', golden_horse_armor: 'golden_horse_armor|gold_horse_armor',
    diamond_horse_armor: 'diamond_horse_armor', bone_meal: 'bone_meal|dye_powder_white', ink_sac: 'ink_sac|dye_powder_black', slimeball: 'slime_ball', glowstone_dust: 'glowstone_dust',
    shears: 'shears', fishing_rod: 'fishing_rod|fishing_rod_uncast', compass: 'compass_00|compass', clock: 'clock_00|clock', firework_rocket: 'firework_rocket|fireworks'
  };
  const MATS = { wood: 'wooden', stone: 'stone', iron: 'iron', gold: 'golden', diamond: 'diamond' };
  for (const m in MATS) for (const t of ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']) ITEMS[m + '_' + t] = MATS[m] + '_' + t + '|' + (m === 'wood' ? 'wood' : m) + '_' + t;
  for (const m of ['leather', 'iron', 'gold', 'diamond']) for (const p of ['helmet', 'chestplate', 'leggings', 'boots']) ITEMS[m + '_' + p] = m === 'leather' ? [(m + '_' + p), [160, 101, 64]] : ((m === 'gold' ? 'golden' : m) + '_' + p + '|' + m + '_' + p);
  // never replaced while "keep DreamLand's water, lava and portals" is on
  const KEEP = new Set(['water', 'water_flow', 'lava', 'lava_flow', 'nether_portal', 'aether_portal', 'end_portal', 'fire', 'fire_2']);
  // tiles that animate when the pack gives an animation strip
  const ANIMATE = new Set(['water', 'water_flow', 'lava', 'lava_flow', 'nether_portal', 'fire', 'fire_2', 'prismarine', 'sea_lantern', 'magma', 'sculk', 'crying_obsidian']);

  /* ------------------------------------------------------------ */
  /* Reading a .zip (stored and deflated entries)                 */
  /* ------------------------------------------------------------ */
  async function inflate(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer());
  }
  function readZip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('This is not a .zip file');
    const count = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    if (cdOff >= u8.length) throw new Error('The .zip file is damaged');
    const files = new Map(), dec = new TextDecoder();
    let p = cdOff;
    for (let i = 0; i < count && i < 60000 && p + 46 <= u8.length; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen)).replace(/\\/g, '/');
      files.set(name.toLowerCase(), { name, method, csize, usize, lho });
      p += 46 + nlen + elen + clen;
    }
    async function get(path) {
      const f = files.get(path.toLowerCase());
      if (!f || f.usize > MAX_FILE || f.csize > MAX_FILE) return null;
      if (f.lho + 30 > u8.length || dv.getUint32(f.lho, true) !== 0x04034b50) return null;
      const start = f.lho + 30 + dv.getUint16(f.lho + 26, true) + dv.getUint16(f.lho + 28, true);
      const data = u8.subarray(start, start + f.csize);
      if (f.method === 0) return data;
      if (f.method === 8 && typeof DecompressionStream !== 'undefined') { try { return await inflate(data); } catch (e) { return null; } }
      return null;
    }
    return { files, get };
  }
  async function decodePng(bytes) {
    if (!bytes) return null;
    try {
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      if (bmp.width > 4096 || bmp.height > 16384) return null;
      const c = Tex.makeCanvas(bmp.width, bmp.height), x = c.getContext('2d');
      x.drawImage(bmp, 0, 0);
      return { w: bmp.width, h: bmp.height, data: x.getImageData(0, 0, bmp.width, bmp.height).data, canvas: c };
    } catch (e) { return null; }
  }
  // one square frame of an image, resampled to R x R (box filter down, nearest up)
  function frame(img, k, R) {
    const w = img.w, out = new Uint8ClampedArray(R * R * 4), oy = k * w;
    if (w >= R) {
      const s = w / R;
      for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let yy = Math.floor(y * s); yy < Math.floor((y + 1) * s); yy++) for (let xx = Math.floor(x * s); xx < Math.floor((x + 1) * s); xx++) {
          const i = ((oy + yy) * w + xx) * 4, al = img.data[i + 3];
          r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al; n++;
        }
        const o = (y * R + x) * 4;
        if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
        out[o + 3] = a / n;
      }
    } else {
      const s = w / R;
      for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
        const i = ((oy + Math.floor(y * s)) * w + Math.floor(x * s)) * 4, o = (y * R + x) * 4;
        out[o] = img.data[i]; out[o + 1] = img.data[i + 1]; out[o + 2] = img.data[i + 2]; out[o + 3] = img.data[i + 3];
      }
    }
    return out;
  }
  function tint(px, c) { for (let i = 0; i < px.length; i += 4) { px[i] = px[i] * c[0] / 255; px[i + 1] = px[i + 1] * c[1] / 255; px[i + 2] = px[i + 2] * c[2] / 255; } return px; }
  function overlay(base, top) { for (let i = 0; i < base.length; i += 4) { const a = top[i + 3] / 255; if (a > 0) { base[i] = base[i] * (1 - a) + top[i] * a; base[i + 1] = base[i + 1] * (1 - a) + top[i + 1] * a; base[i + 2] = base[i + 2] * (1 - a) + top[i + 2] * a; base[i + 3] = Math.max(base[i + 3], top[i + 3]); } } return base; }
  function opaque(px) { for (let i = 0; i < px.length; i += 4) if (px[i + 3] < 128) { px[i] *= 0.45; px[i + 1] *= 0.45; px[i + 2] *= 0.45; px[i + 3] = 255; } else px[i + 3] = 255; return px; }

  /* ------------------------------------------------------------ */
  /* Loading a pack                                               */
  /* ------------------------------------------------------------ */
  const RP_STATE = DL.ResourcePack = { info: null, busy: false };
  async function loadPack(buf, fileName) {
    if (!buf || buf.byteLength > MAX_PACK) throw new Error('That file is too big for a resource pack');
    const zip = readZip(buf);
    // the pack can sit inside a folder in the zip
    let root = '';
    let best = null;
    for (const k of zip.files.keys()) if (k.endsWith('pack.mcmeta') && (!best || k.length < best.length)) best = k;
    if (best) root = best.slice(0, best.length - 'pack.mcmeta'.length);
    else {
      for (const k of zip.files.keys()) { const i = k.indexOf('assets/minecraft/textures/'); if (i >= 0) { root = k.slice(0, i); break; } }
      if (!root && ![...zip.files.keys()].some(k => k.startsWith('assets/minecraft/textures/'))) throw new Error('No Minecraft textures were found in this .zip');
    }
    let desc = '', format = 0;
    try {
      const meta = JSON.parse(new TextDecoder().decode(await zip.get(root + 'pack.mcmeta')));
      format = (meta && meta.pack && meta.pack.pack_format) | 0;
      const d = meta && meta.pack && meta.pack.description;
      desc = typeof d === 'string' ? d : Array.isArray(d) ? d.map(p => typeof p === 'string' ? p : (p && p.text) || '').join('') : (d && d.text) || '';
    } catch (e) { /* no description */ }
    const icon = await decodePng(await zip.get(root + 'pack.png'));
    const T = root + 'assets/minecraft/textures/';
    async function find(kind, names) {
      for (const n of names.split('|')) for (const dir of kind === 'block' ? ['block/', 'blocks/'] : ['item/', 'items/']) {
        const path = T + dir + n + '.png';
        if (!zip.files.has(path.toLowerCase())) continue;
        const img = await decodePng(await zip.get(path));
        if (!img || img.w < 1 || img.h < img.w) continue;
        let anim = null;
        try { const mm = await zip.get(path + '.mcmeta'); if (mm) anim = (JSON.parse(new TextDecoder().decode(mm)) || {}).animation || null; } catch (e) { anim = null; }
        return { img, anim, path: dir + n };
      }
      return null;
    }
    // read everything first, then pick a resolution
    const blocks = {}, items = {};
    let bRes = 16, iRes = 16;
    for (const tile in BLOCKS) {
      if (S.T[tile] === undefined) continue;
      const spec = BLOCKS[tile], names = Array.isArray(spec) ? spec[0] : spec;
      const f = await find('block', names);
      if (!f) continue;
      blocks[tile] = Object.assign(f, { spec });
      if (!KEEP.has(tile)) bRes = Math.max(bRes, f.img.w);
    }
    for (const it in ITEMS) {
      const spec = ITEMS[it], names = Array.isArray(spec) ? spec[0] : spec;
      const f = await find('item', names);
      if (!f) continue;
      items[it] = Object.assign(f, { spec });
      iRes = Math.max(iRes, f.img.w);
    }
    // chests are entity textures in Minecraft: cut the faces out of entity/chest/normal.png
    const chest = await decodePng(await zip.get(T + 'entity/chest/normal.png'));
    const n = Object.keys(blocks).length + Object.keys(items).length + (chest ? 3 : 0);
    if (!n) throw new Error('No textures DreamLand knows were found in this pack');
    const pow2 = (v) => { let r = 16; while (r < v && r < MAX_RES) r *= 2; return r; };
    return { root, format, name: (fileName || 'Resource pack').replace(/\.zip$/i, '').slice(0, 40), desc: desc.replace(/§./g, '').slice(0, 120), icon, blocks, items, chest, bRes: pow2(bRes), iRes: pow2(iRes), count: n };
  }

  // turns a loaded pack into atlas tiles; keep = leave DreamLand's water, lava and portals alone
  function install(pack, keep) {
    const R = pack.bRes, IR = pack.iRes, tiles = {}, itemTiles = {};
    const d16 = (px, res) => { if (res === 16) return px; const f = frame({ w: res, h: res, data: px }, 0, 16); return f; };
    for (const tile in pack.blocks) {
      if (tile[0] === '_' || (keep && KEEP.has(tile))) continue;
      const b = pack.blocks[tile], spec = b.spec, img = b.img;
      let px = frame(img, 0, R);
      const how = Array.isArray(spec) ? spec[1] : null;
      if (how === 'grassSide') { if (pack.blocks._grassOverlay) px = overlay(px, tint(frame(pack.blocks._grassOverlay.img, 0, R), GRASS)); }
      else if (Array.isArray(how)) tint(px, how);
      if (Array.isArray(spec) && spec[2] === 'opaque') opaque(px);
      tiles[tile] = { data: px, res: R, d16: d16(px, R) };
      // animation strips
      const frames = Math.floor(img.h / img.w);
      if (ANIMATE.has(tile) && frames > 1) {
        const order = b.anim && Array.isArray(b.anim.frames) ? b.anim.frames.map(f => typeof f === 'number' ? f : f && f.index).filter(i => Number.isInteger(i) && i >= 0 && i < frames) : null;
        const list = (order && order.length ? order : [...Array(frames).keys()]).slice(0, 64).map(k => {
          const f = frame(img, k, R);
          if (Array.isArray(how)) tint(f, how);
          return f;
        });
        tiles[tile].anim = { frames: list, res: R, time: Math.max(1, Math.min(40, (b.anim && b.anim.frametime) | 0 || 1)), t: 0 };
      }
    }
    if (pack.chest) {
      const c = pack.chest, sc = c.w / 64, flip = pack.format >= 5;
      const cut = (rects) => {
        const out = new Uint8ClampedArray(R * R * 4);
        for (const [sx, sy, sw, sh, dy, dh] of rects) {
          for (let y = 0; y < R; y++) {
            const fy = y / R * 16; if (fy < dy || fy >= dy + dh) continue;
            for (let x = 0; x < R; x++) {
              let fv = (fy - dy) / dh; if (flip && sh < 14) fv = 1 - fv - 1e-6;
              const u = Math.floor((sx + (x / R) * sw) * sc), v = Math.floor((sy + fv * sh) * sc);
              const i = (v * c.w + u) * 4, o = (y * R + x) * 4;
              out[o] = c.data[i]; out[o + 1] = c.data[i + 1]; out[o + 2] = c.data[i + 2]; out[o + 3] = 255;
            }
          }
        }
        return out;
      };
      const front = cut([[14, 14, 14, 5, 0, 6], [14, 33, 14, 10, 6, 10]]);
      // the latch
      const lt = cut([[1, 1, 2, 4, 0, 16]]);
      for (let y = Math.floor(R * 3 / 16); y < Math.floor(R * 8 / 16); y++) for (let x = Math.floor(R * 7 / 16); x < Math.floor(R * 9 / 16); x++) { const o = (y * R + x) * 4; for (let k = 0; k < 4; k++) front[o + k] = lt[o + k] || front[o + k]; }
      tiles.chest_front = { data: front, res: R, d16: d16(front, R) };
      const side = cut([[0, 14, 14, 5, 0, 6], [0, 33, 14, 10, 6, 10]]);
      tiles.chest_side = { data: side, res: R, d16: d16(side, R) };
      const top = cut([[14, 0, 14, 14, 0, 16]]);
      tiles.chest_top = { data: top, res: R, d16: d16(top, R) };
    }
    for (const it in pack.items) {
      const b = pack.items[it], spec = b.spec;
      const px = frame(b.img, 0, IR);
      if (Array.isArray(spec) && Array.isArray(spec[1])) {
        tint(px, spec[1]);
        // leather armour: Minecraft draws an untinted overlay on top
        if (b.overlay) overlay(px, frame(b.overlay, 0, IR));
      }
      itemTiles[it] = { data: px, res: IR };
    }
    return { tiles, itemTiles, R, IR };
  }
  async function readExtras(pack, buf) {
    // grass side overlay and leather armour overlays (second pass so we know the root)
    const zip = readZip(buf);
    const T = pack.root + 'assets/minecraft/textures/';
    for (const dir of ['block/', 'blocks/']) {
      const o = await decodePng(await zip.get(T + dir + 'grass_block_side_overlay.png')) || await decodePng(await zip.get(T + dir + 'grass_side_overlay.png'));
      if (o) { pack.blocks._grassOverlay = { img: o }; break; }
    }
    for (const it in pack.items) {
      if (!it.startsWith('leather_')) continue;
      for (const dir of ['item/', 'items/']) { const o = await decodePng(await zip.get(T + dir + it + '_overlay.png')); if (o) { pack.items[it].overlay = o; break; } }
    }
  }

  /* applying: rebuild the atlases and hand them to the GPU */
  function apply(pack) {
    const st = DL.game && DL.game.settings;
    const keep = !st || st.packKeep !== false;
    for (const a of Tex.anims) delete a.pack;
    if (pack) {
      const inst = install(pack, keep);
      Tex.RES = inst.R; Tex.IRES = inst.IR;
      Tex.packTile = (name) => inst.tiles[name] || null;
      Tex.packItem = (name) => inst.itemTiles[name] || null;
      for (const a of Tex.anims) { const nm = S.TILE_NAMES[a.tile], t = inst.tiles[nm]; if (t && t.anim) a.pack = t.anim; }
      // animated pack tiles that DreamLand draws still
      for (const nm in inst.tiles) {
        const t = inst.tiles[nm];
        if (!t.anim || Tex.anims.some(a => S.TILE_NAMES[a.tile] === nm)) continue;
        const anim = { tile: S.T[nm], fx: { tick() { anim.pack.t++; }, data: t.data }, pack: t.anim, fromPack: true };
        Tex.anims.push(anim);
      }
      RP_STATE.info = { name: pack.name, desc: pack.desc, icon: pack.icon && pack.icon.canvas, count: pack.count, res: inst.R };
    } else {
      Tex.RES = 16; Tex.IRES = 16; Tex.packTile = null; Tex.packItem = null;
      RP_STATE.info = null;
    }
    for (let i = Tex.anims.length - 1; i >= 0; i--) if (Tex.anims[i].fromPack && !Tex.anims[i].pack) Tex.anims.splice(i, 1);
    // pack animations advance with the others
    for (const a of Tex.anims) if (a.pack && !a.fromPack && !a._wrapped) { const fx = a.fx, tick = fx.tick.bind(fx); fx.tick = () => { tick(); if (a.pack) a.pack.t++; }; a._wrapped = true; }
    Tex.terrain = null;
    Tex.paintTerrain(); Tex.paintItems(); Tex.buildGui();
    if (G.iconCache) G.iconCache.clear();
    if (DL.Wishlist && DL.Wishlist.resetMapColors) DL.Wishlist.resetMapColors();
    if (DL.game && DL.game.renderer) DL.game.renderer.reloadTextures();
  }
  RP.reloadTextures = function () {
    const gl = this.gl;
    if (this.terrainTex) gl.deleteTexture(this.terrainTex);
    if (this.itemsTex) gl.deleteTexture(this.itemsTex);
    this.terrainTex = this.texture(DL.Tex.terrain);
    this.itemsTex = this.texture(DL.Tex.items);
    if (this.dirtTex) gl.deleteTexture(this.dirtTex);
    this.dirtTex = this.texture(DL.Tex.gui.dirt, true);
    this.itemsData = DL.Tex.items.getContext('2d').getImageData(0, 0, DL.Tex.items.width, DL.Tex.items.height).data;
    for (const m of this.itemMeshCache.values()) if (m && m.buf) gl.deleteBuffer(m.buf);
    this.itemMeshCache.clear();
  };

  /* ------------------------------------------------------------ */
  /* Remembering the pack on this device                          */
  /* ------------------------------------------------------------ */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      if (!window.indexedDB) { resolve(null); return; }
      let req;
      try { req = indexedDB.open('dreamland-packs', 1); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('packs')) req.result.createObjectStore('packs'); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null); req.onblocked = () => resolve(null);
    });
    return dbp;
  }
  function store(mode, fn) {
    return db().then(d => new Promise((resolve) => {
      if (!d) { resolve(null); return; }
      let t; try { t = d.transaction('packs', mode); } catch (e) { resolve(null); return; }
      let out = null; const r = fn(t.objectStore('packs'));
      if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => resolve(out); t.onerror = () => resolve(null); t.onabort = () => resolve(null);
    }));
  }
  let current = null; // { pack, buf }
  RP_STATE.load = async function (buf, fileName, save) {
    if (RP_STATE.busy) return;
    RP_STATE.busy = true; RP_STATE.error = null; RP_STATE.status = 'Reading ' + (fileName || 'pack') + '...';
    try {
      const pack = await loadPack(buf, fileName);
      await readExtras(pack, buf);
      current = { pack, buf, fileName };
      apply(pack);
      RP_STATE.status = 'Loaded ' + pack.count + ' textures (' + RP_STATE.info.res + 'x)';
      if (save !== false) await store('readwrite', s => s.put({ name: fileName, data: buf }, 'current'));
      if (G.notice) G.notice('Resource pack: ' + pack.name);
    } catch (e) {
      RP_STATE.error = (e && e.message) || 'Could not read that pack';
      RP_STATE.status = null;
    } finally { RP_STATE.busy = false; }
  };
  RP_STATE.clear = async function () {
    current = null;
    apply(null);
    RP_STATE.status = 'Using DreamLand\'s own textures';
    await store('readwrite', s => s.delete('current'));
  };
  RP_STATE.reapply = function () { apply(current ? current.pack : null); };
  RP_STATE.restore = async function () {
    const rec = await store('readonly', s => s.get('current'));
    if (rec && rec.data) await RP_STATE.load(rec.data, rec.name, false);
  };
  RP_STATE.pick = function () {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.zip,application/zip,application/x-zip-compressed';
    inp.style.display = 'none';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (f) RP_STATE.load(await f.arrayBuffer(), f.name);
    };
    document.body.appendChild(inp);
    inp.click();
  };

  /* drag a .zip onto the game */
  window.addEventListener('dragover', (e) => { if (e.dataTransfer && [...(e.dataTransfer.items || [])].some(i => i.kind === 'file')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('drop', async (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f || !/\.zip$/i.test(f.name)) return;
    e.preventDefault();
    RP_STATE.load(await f.arrayBuffer(), f.name);
  });

  /* restore the saved pack once the game has started */
  const boot = DL.Game.prototype.boot;
  DL.Game.prototype.boot = function () {
    const r = boot.apply(this, arguments);
    RP_STATE.restore().catch(() => {});
    return r;
  };

  /* ------------------------------------------------------------ */
  /* Options > Resource Packs                                     */
  /* ------------------------------------------------------------ */
  class ResourcePackScreen extends G.Screen {
    constructor(game, parent) { super(game, parent); }
    get pauses() { return true; }
    layout() {
      this.widgets = [];
      const st = this.game.settings, cx = G.W / 2;
      const y0 = Math.max(70, G.H / 2 - 40);
      this.btn('Load a pack (.zip)...', cx - 155, y0, 150, 20, () => RP_STATE.pick());
      this.btn('Use DreamLand textures', cx + 5, y0, 150, 20, () => { RP_STATE.clear(); });
      const style = this.btn('', cx - 155, y0 + 24, 150, 20, () => {
        st.texStyle = st.texStyle === 'classic' ? 'modern' : 'classic';
        Tex.applyStyle(st.texStyle); RP_STATE.reapply(); style.label = styleLabel(); this.game.saveSettings();
      });
      const styleLabel = () => 'Built-in style: ' + (st.texStyle === 'classic' ? 'Classic' : 'Modern');
      style.label = styleLabel();
      const keep = this.btn('', cx + 5, y0 + 24, 150, 20, () => {
        st.packKeep = st.packKeep === false; RP_STATE.reapply(); keep.label = keepLabel(); this.game.saveSettings();
      });
      const keepLabel = () => 'Our water & portals: ' + (st.packKeep === false ? 'OFF' : 'ON');
      keep.label = keepLabel();
      this.btn('Done', cx - 100, Math.min(G.H - 24, y0 + 58), 200, 20, () => this.back());
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 0;
    }
    draw(mx, my) {
      if (this.showWorld) G.dim();
      const cx = G.W / 2, y0 = Math.max(70, G.H / 2 - 40);
      G.textC('Resource Packs', cx, Math.max(8, y0 - 62), '#FFFFFF');
      const info = RP_STATE.info;
      const bx = cx - 155, by = y0 - 46;
      G.rect(bx, by, 310, 40, 'rgba(0,0,0,0.5)');
      if (info && info.icon) { G.ctx.imageSmoothingEnabled = false; G.ctx.drawImage(info.icon, bx + 4, by + 4, 32, 32); }
      else DL.Tex.drawTerrainTile(G.ctx, S.T.grass_side, bx + 4, by + 4, 32);
      const name = info ? info.name : 'DreamLand (' + (this.game.settings.texStyle === 'classic' ? 'Classic' : 'Modern') + ')';
      const desc = info ? (info.desc || info.count + ' textures, ' + info.res + 'x') : 'The built-in textures. Load any Minecraft Java pack!';
      G.text(name.slice(0, 44), bx + 42, by + 6, '#FFFFFF');
      G.text(desc.slice(0, 48), bx + 42, by + 17, '#A0A0A0');
      if (desc.length > 48) G.text(desc.slice(48, 96), bx + 42, by + 27, '#A0A0A0');
      const line = RP_STATE.busy ? (RP_STATE.status || 'Loading...') : RP_STATE.error ? '§c' + RP_STATE.error : (RP_STATE.status || 'Tip: you can also drop a pack .zip onto the game');
      G.textC(line.replace(/^§c/, ''), cx, y0 + 46, RP_STATE.error ? '#FF6060' : '#C0C0C0');
      this.drawWidgets(mx, my);
    }
  }
  G.ResourcePackScreen = ResourcePackScreen;
})();
