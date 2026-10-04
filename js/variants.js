/*
 * DreamLand - every wood and every stone, and beds.
 * Doors, stairs, slabs and fences come in every wood, and stairs and slabs in many
 * stones: each is one block whose material sits in the high bits of its metadata
 * (shared.js), so they cost no block ids. Any planks, logs or cobble-like stone work
 * in the everyday recipes. Beds: wool on planks; sleep through the night, wake where
 * you slept, and don't try it in the Nether.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, I = DL.Items, Tex = DL.Tex, TG = Tex.G, GP = DL.Game.prototype, W = DL.World.prototype;
  const A = DL.Audio, E = DL.Entities, GUI = DL.GUI, N = DL.Net, X = DL.Extras, K = Tex.kit;
  const isGuest = () => !!(N && N.client);
  const title = I._titleCase;
  const hex = K.hex;

  /* ------------------------------------------------------------ */
  /* Doors of every wood: its planks with a frame, panels, windows */
  /* ------------------------------------------------------------ */
  const DOOR_STYLE = { spruce: 3, birch: 0, jungle: 1, acacia: 2, dark: 0, mangrove: 1, cherry: 2, pale_oak: 4, skyroot: 1, crystal: 2, sift: 3 };
  const GLASS = [hex('#d6eaf0'), hex('#a0c4ce')];
  S.WOOD_KEYS.forEach((k, i) => {
    if (!i) return;
    const pl = S.WOOD_KINDS[i], style = DOOR_STYLE[k] || 0;
    const base = (t) => { if (TG[pl]) TG[pl](t); };
    const edge = (t, top) => { for (let j = 0; j < 16; j++) { t.shade(0, j, 0.55); t.shade(15, j, 0.55); t.shade(j, top ? 0 : 15, 0.55); } };
    const win = (t, x, y) => t.set(x, y, (x + y) % 5 === 0 ? GLASS[0] : GLASS[1], 170);
    TG['door_top_' + k] = (t) => {
      base(t); edge(t, true);
      if (style === 0) { for (const x0 of [3, 9]) for (let y = 3; y < 12; y++) for (let x = x0; x < x0 + 4; x++) { if (x === x0 || y === 3 || y === 7 || y === 11) t.shade(x, y, 0.6); else win(t, x, y); } }
      else if (style === 1) { for (let y = 3; y < 12; y++) for (let x = 3; x < 13; x++) { if (x === 3 || x === 12 || y === 3 || y === 11 || x === 8 || y === 7) t.shade(x, y, 0.6); else win(t, x, y); } }
      else if (style === 2) { for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) { const d = Math.abs(x - 7.5) + Math.abs(y - 7.5); if (d < 4.5) win(t, x, y); else if (d < 5.5) t.shade(x, y, 0.6); } }
      else if (style === 3) { for (let x = 3; x < 13; x += 3) for (let y = 2; y < 15; y++) t.shade(x, y, 0.65); for (let x = 5; x < 11; x++) for (let y = 4; y < 7; y++) win(t, x, y); }
      else { for (let y = 3; y < 13; y++) { t.shade(7, y, 0.6); t.shade(8, y, 0.78); } for (let x = 3; x < 13; x++) t.shade(x, 7, 0.6); }
    };
    TG['door_bottom_' + k] = (t) => {
      base(t); edge(t, false);
      for (let y = 3; y < 13; y++) { t.shade(3, y, 0.6); t.shade(12, y, 0.6); }
      for (let x = 3; x < 13; x++) { t.shade(x, 3, 0.6); t.shade(x, 12, 0.6); }
      if (style === 3) for (let x = 6; x < 12; x += 3) for (let y = 4; y < 12; y++) t.shade(x, y, 0.75);
      if (style === 2) for (let k2 = 0; k2 < 8; k2++) { t.shade(4 + k2, 4 + k2, 0.7); t.shade(11 - k2, 4 + k2, 0.7); }
      t.set(12, 1, hex('#3a3a3a')); t.set(13, 1, hex('#9a9a9a')); t.set(12, 2, hex('#9a9a9a')); t.set(13, 2, hex('#6a6a6a'));
    };
  });
  // door items: a little door, in the wood's colours
  const WOOD_TONE = { oak: '#a2834f', spruce: '#735433', birch: '#c4b07b', jungle: '#a07350', acacia: '#ab5c31', dark: '#47301a', mangrove: '#763631', cherry: '#e2b2a8', pale_oak: '#ddd7d2', skyroot: '#8c9cae', crystal: '#9ab8f4', sift: '#b86a54' };
  const shadeC = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
  const doorIcon = (k) => (t) => {
    const m = hex(WOOD_TONE[k]);
    t.art(['....oooooooo....', '....olllllmo....', '....olggggmo....', '....olggggmo....', '....olggggmo....', '....ommmmmmo....', '....olllllmo....', '....olmmmmmo....',
      '....olmmmmho....', '....olmmmmmo....', '....ommmmmmo....', '....olllllmo....', '....olmmmmmo....', '....olmmmmmo....', '....ommmmmmo....', '....oooooooo....'],
    { o: shadeC(m, 0.45), l: shadeC(m, 1.2), m, g: GLASS[1], h: hex('#d8d8d8') });
  };

  /* ------------------------------------------------------------ */
  /* The variant items                                            */
  /* ------------------------------------------------------------ */
  const IDS = []; for (let i = 532; i <= 599; i++) IDS.push(i); for (let i = 710; i <= 739; i++) IDS.push(i);
  let next = 0;
  const VAR_ITEM = {};     // 'block:variant' -> item id
  const BASE_ITEM = { [B.wooden_door]: 324 };
  const itemFor = (block, v) => (v ? VAR_ITEM[block + ':' + v] : BASE_ITEM[block] || block);
  const woodName = (k) => (k === 'dark' ? 'dark_oak' : k);
  const stoneName = (n) => n.replace(/_bricks$/, '_brick').replace(/^bricks$/, 'brick').replace(/_block$/, '');
  const D = (id, name, o) => { const d = I._def(id, name, o); return d; };
  function variantItem(block, v, name, extra) {
    const id = IDS[next++];
    if (id === undefined || I.get(id)) return null;
    const bd = I.get(block);
    const d = D(id, name, Object.assign({ display: title(name), isBlock: true, block, blockMeta: v << 4, flat: bd ? bd.flat : false, variant: v, tab: 'building' }, extra || {}));
    VAR_ITEM[block + ':' + v] = id;
    if (bd && bd.fuel) d.fuel = bd.fuel;
    return d;
  }
  // the oak ones keep their old items; name them after their wood now that there are others
  I.get(B.wood_stairs).display = 'Oak Stairs'; I.get(B.fence).display = 'Oak Fence'; I.get(324).display = 'Oak Door'; I.get(324).maxStack = 64;
  I.get(B.wood_slab).display = 'Oak Slab'; I.get(B.wood_slab).fuel = 150; I.get(B.fence).fuel = 300; I.get(B.wood_stairs).fuel = 300;
  I.get(B.cobble_stairs).display = 'Cobblestone Stairs';
  I.get(B.bed).hidden = true;
  const WK = S.WOOD_KEYS, WP = S.WOOD_KINDS;
  for (let v = 1; v < WK.length; v++) {
    const k = WK[v], n = woodName(k);
    // doors are drawn flat in the hand and the inventory, like Minecraft's
    const id = IDS[next++];
    D(id, n + '_door', { display: title(n) + ' Door', places: B.wooden_door, blockMeta: v << 4, variant: v, tab: 'building', fuel: 200 });
    VAR_ITEM[B.wooden_door + ':' + v] = id;
    Tex.ITEM_PAINT[n + '_door'] = doorIcon(k);
  }
  for (let v = 1; v < WK.length; v++) { const n = woodName(WK[v]); if (n === 'spruce' || n === 'dark_oak') continue; variantItem(B.wood_stairs, v, n + '_stairs', { fuel: 300 }); }
  for (let v = 1; v < WK.length; v++) variantItem(B.wood_slab, v, woodName(WK[v]) + '_slab', { fuel: 150 });
  for (let v = 1; v < WK.length; v++) variantItem(B.fence, v, woodName(WK[v]) + '_fence', { fuel: 300 });
  S.STAIR_STONES.forEach((n, v) => { if (v) variantItem(B.cobble_stairs, v, stoneName(n) + '_stairs'); });
  S.SLAB_STONES.forEach((n, v) => { if (v) variantItem(B.slab, v, stoneName(n) + '_slab'); });
  // spruce and dark oak already had stairs blocks of their own
  VAR_ITEM[B.wood_stairs + ':1'] = B.spruce_stairs; VAR_ITEM[B.wood_stairs + ':5'] = B.dark_stairs;

  /* ------------------------------------------------------------ */
  /* Recipes                                                      */
  /* ------------------------------------------------------------ */
  // these come first, so the wood or stone you use decides what you get
  const first = (fn) => { const n = I.recipes.length; fn(); const added = I.recipes.splice(n); I.recipes.unshift(...added); };
  const nameOf = (id) => I.get(id).name;
  first(() => {
    for (let v = 0; v < WK.length; v++) {
      const P = WP[v];
      if (!I.byName[P]) continue;
      I._shaped(['PP', 'PP', 'PP'], { P }, nameOf(itemFor(B.wooden_door, v)), 3);
      I._shaped(['P  ', 'PP ', 'PPP'], { P }, nameOf(itemFor(B.wood_stairs, v)), 4);
      I._shaped(['PPP'], { P }, nameOf(itemFor(B.wood_slab, v)), 6);
      I._shaped(['P#P', 'P#P'], { P, '#': 'stick' }, nameOf(itemFor(B.fence, v)), 3);
    }
    S.STAIR_STONES.forEach((n, v) => { if (v && I.byName[n]) I._shaped(['S  ', 'SS ', 'SSS'], { S: n }, nameOf(itemFor(B.cobble_stairs, v)), 4); });
    S.SLAB_STONES.forEach((n, v) => { if (v && I.byName[n]) I._shaped(['SSS'], { S: n }, nameOf(itemFor(B.slab, v)), 6); });
  });
  // slabs back into blocks
  for (let v = 0; v < WK.length; v++) if (I.byName[WP[v]]) I._shaped(['S', 'S'], { S: nameOf(itemFor(B.wood_slab, v)) }, WP[v], 1);
  // any planks, any log, cobble-like stone: the generic recipes take them all (mixed, too)
  const CANON = {};
  for (const n of WP) if (I.byName[n]) CANON[I.byName[n].id] = B.planks;
  for (let id = 1; id < 256; id++) if (S.LOGS && S.LOGS[id] && id !== B.log) CANON[id] = B.log;
  for (const n of ['blackstone', 'deepslate', 'mossy_cobblestone']) if (B[n]) CANON[B[n]] = B.cobblestone;
  // wool colours only count as plain wool when nothing else matches (a red bed stays red)
  const CANON2 = Object.assign({}, CANON);
  for (const n of ['red_wool', 'blue_wool']) if (B[n]) CANON2[B[n]] = B.wool;
  const match = I.matchRecipe;
  const swap = (grid, map) => { let changed = false; const g = grid.map(s => { const c = s && map[s.id]; if (c && c !== s.id) { changed = true; return { id: c, count: s.count, dmg: s.dmg }; } return s; }); return changed ? g : null; };
  I.matchRecipe = function (grid, size) {
    const r = match(grid, size);
    if (r) return r;
    // any planks, logs and cobble-like stone first, then wool of any colour too
    const g1 = swap(grid, CANON);
    if (g1) { const r1 = match(g1, size); if (r1) return r1; }
    const g2 = swap(grid, CANON2);
    if (g2) { const r2 = match(g2, size); if (r2) return r2; }
    return null;
  };

  /* ------------------------------------------------------------ */
  /* Placing, breaking and picking variants                       */
  /* ------------------------------------------------------------ */
  const placeBlock = GP.placeBlock;
  GP.placeBlock = function (id, t) {
    const p = this.player, held = p && p.held, d = held && I.get(held.id), w = this.world;
    const vm = d && d.blockMeta ? d.blockMeta : 0;
    // slabs: two of the same kind make a whole block of what they are made of; different kinds sit on top
    if ((id === B.slab || id === B.wood_slab) && t && t.face === 1 && w.getBlock(t.x, t.y, t.z) === id) {
      const have = w.getMeta(t.x, t.y, t.z) & 0xF0;
      if (have === vm) {
        if (!(id === B.slab && !vm)) {
          const full = S.variantSource(id, vm) || (id === B.wood_slab ? B.planks : B.double_slab);
          w.setBlock(t.x, t.y, t.z, full, 0, 3); this.afterPlace(full, t.x, t.y, t.z);
          return;
        }
      } else {
        const y = t.y + 1, cur = w.getBlock(t.x, y, t.z);
        if (y < S.CH && (!cur || S.REPLACE[cur]) && !this.collidesEntity(t.x, y, t.z, id, vm)) { w.setBlock(t.x, y, t.z, id, vm, 3); this.afterPlace(id, t.x, y, t.z); }
        return;
      }
    }
    if (!vm || !S.VAR_SRC[id]) return placeBlock.apply(this, arguments);
    // everything the placement sets of this block carries the material
    const own = Object.prototype.hasOwnProperty.call(w, 'setBlock'), prev = w.setBlock;
    w.setBlock = function (x, y, z, bid, meta, flags) { if (bid === id) meta = ((meta || 0) & 15) | vm; return prev.call(this, x, y, z, bid, meta, flags); };
    try { return placeBlock.apply(this, arguments); } finally { if (own) w.setBlock = prev; else delete w.setBlock; }
  };
  // what a variant block drops is its own item
  const blockDrops = I.blockDrops;
  I.blockDrops = function (bid, meta, stack, rng) {
    let out = blockDrops.apply(this, arguments) || [];
    const v = (meta >> 4) & 15;
    if (bid === B.bed) out = [I.stack(BED_ITEMS[(meta >> 4) & 3] || BED_ITEMS[0], 1)];
    else if (v && S.VAR_SRC[bid]) { const base = BASE_ITEM[bid] || bid, it = VAR_ITEM[bid + ':' + v]; if (it) for (const s of out) if (s.id === base) s.id = it; }
    return out;
  };
  const pickBlock = GP.pickBlock;
  GP.pickBlock = function () {
    const t = this.target, w = this.world, p = this.player;
    if (!t || t.entity) return pickBlock.apply(this, arguments);
    const id = w.getBlock(t.x, t.y, t.z), m = w.getMeta(t.x, t.y, t.z);
    let want = 0;
    if (id === B.bed) want = BED_ITEMS[(m >> 4) & 3];
    else if (S.VAR_SRC[id] && (m >> 4)) want = VAR_ITEM[id + ':' + ((m >> 4) & 15)];
    if (!want) return pickBlock.apply(this, arguments);
    for (let i = 0; i < 9; i++) if (p.inv[i] && p.inv[i].id === want) { this.selectSlot(i); return; }
    for (let i = 9; i < 36; i++) if (p.inv[i] && p.inv[i].id === want) { const t2 = p.inv[p.selected]; p.inv[p.selected] = p.inv[i]; p.inv[i] = t2; this.itemNameTimer = 40; return; }
    if (p.creative) { p.held = I.stack(want, I.maxStack(want)); this.itemNameTimer = 40; }
  };

  /* ------------------------------------------------------------ */
  /* Beds                                                         */
  /* ------------------------------------------------------------ */
  const BED_ITEMS = [355, 356, 357];
  const BED_ART = (c) => (t) => t.art(['................', '................', '................', '................', '................', '.wwwwcccccccccc.', 'wWWwcccccccccccc',
    'wWWwcCCCCCCCCCCc', 'wwwwcccccccccccc', 'pppppppppppppppp', 'pPPPPPPPPPPPPPPp', 'pp............pp', 'pp............pp', '................', '................', '................'],
  { w: hex('#d8d8d8'), W: hex('#ffffff'), c: hex(c), C: shadeC(hex(c), 1.2), p: hex('#7a5f36'), P: hex('#a2834f') });
  [['bed', 'Red Bed', '#b02e26'], ['white_bed', 'White Bed', '#e8e8e8'], ['blue_bed', 'Blue Bed', '#3c44aa']].forEach(([n, display, c], i) => {
    D(BED_ITEMS[i], n, { display, maxStack: 1, tab: 'functional', bedColour: i });
    Tex.ITEM_PAINT[n] = BED_ART(c);
  });
  first(() => {
    I._shaped(['WWW', 'PPP'], { W: 'red_wool', P: 'planks' }, 'bed');
    I._shaped(['WWW', 'PPP'], { W: 'wool', P: 'planks' }, 'white_bed');
    I._shaped(['WWW', 'PPP'], { W: 'blue_wool', P: 'planks' }, 'blue_bed');
  });
  const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  // where the other half of a bed is
  const otherHalf = (x, y, z, m) => { const d = DIRS[m & 3], s = (m & 8) ? -1 : 1; return [x + d[0] * s, y, z + d[1] * s]; };
  function placeBed(g, t, colour) {
    const w = g.world, p = g.player;
    if (t.face !== 1) return;
    const x = t.x, y = t.y + 1, z = t.z, f = g.facing(), d = DIRS[f], hx = x + d[0], hz = z + d[1];
    const free = (a, b, c) => { const k = w.getBlock(a, b, c); return !k || S.REPLACE[k]; };
    if (!free(x, y, z) || !free(hx, y, hz) || !S.SOLID[w.getBlock(hx, y - 1, hz)]) return;
    if (g.collidesEntity(x, y, z, B.bed, f) || g.collidesEntity(hx, y, hz, B.bed, f | 8)) return;
    const m = f | (colour << 4);
    w.setBlock(x, y, z, B.bed, m, 3);
    w.setBlock(hx, y, hz, B.bed, m | 8, 3);
    g.afterPlace(B.bed, x, y, z);
  }
  // breaking either half takes the whole bed
  const destroyBlock = W.destroyBlock;
  W.destroyBlock = function (x, y, z) {
    const id = this.getBlock(x, y, z), m = id === B.bed ? this.getMeta(x, y, z) : 0;
    const r = destroyBlock.apply(this, arguments);
    if (id === B.bed) { const [ox, oy, oz] = otherHalf(x, y, z, m); if (this.getBlock(ox, oy, oz) === B.bed) this.setBlock(ox, oy, oz, 0, 0, 3); }
    return r;
  };

  // sleeping
  const PL = E.Player.prototype;
  function monstersNear(w, x, y, z) {
    for (const e of w.entities) if (e.living && e.hostile && !e.removed && e.health > 0 && !e.tamed && Math.abs(e.x - x) < 8 && Math.abs(e.z - z) < 8 && Math.abs(e.y - y) < 5) return true;
    return false;
  }
  function sleepIn(g, x, y, z) {
    const w = g.world, p = g.player, m = w.getMeta(x, y, z);
    // beds were not made for other worlds (OreSpawn's own worlds excepted: sleep there, but home stays in the Overworld)
    const osWorld = w.dim >= 5 && w.dim <= 10;
    if (w.dim && !osWorld) {
      if (isGuest()) return;
      w.setBlock(x, y, z, 0, 0, 3);
      const [ox, oy, oz] = otherHalf(x, y, z, m); if (w.getBlock(ox, oy, oz) === B.bed) w.setBlock(ox, oy, oz, 0, 0, 3);
      if (w.explode) w.explode(x + 0.5, y + 0.5, z + 0.5, 5, null);
      return;
    }
    // the head half is where you lie
    const hx = (m & 8) ? x : otherHalf(x, y, z, m)[0], hz = (m & 8) ? z : otherHalf(x, y, z, m)[2];
    if (!osWorld) p.spawnPoint = [hx + 0.5, y + 0.6, hz + 0.5, 'bed', hx, y, hz];
    const set = osWorld ? '' : 'Respawn point set. ';
    const thunder = w.weather && w.weather.thunder > 0.5;
    if (w.isDaytime() && !thunder) { g.chatMessage('§7' + set + 'You can only sleep at night or during thunderstorms.'); return; }
    if (Math.hypot(p.x - x - 0.5, p.z - z - 0.5) > 3) { g.chatMessage('§7You may not rest now; the bed is too far away.'); return; }
    if (monstersNear(w, x, y, z)) { g.chatMessage('§7You may not rest now; there are monsters nearby.'); return; }
    if (isGuest()) { g.chatMessage('§7' + set + 'Nights pass when the host sleeps.'); return; }
    p.sleeping = { x: hx, y, z: hz, t: 0, foot: (m & 8) ? otherHalf(x, y, z, m) : [x, y, z], dir: m & 3 };
    p.vehicle = null; p.sitting = null;
    p.yaw = [0, Math.PI, Math.PI / 2, -Math.PI / 2][m & 3] + Math.PI; p.pitch = 0;
    g.chatMessage('§7' + (osWorld ? 'Sleeping... (your home stays in the Overworld)' : 'Respawn point set. Sleeping...'));
  }
  function wake(p, why) {
    const s = p.sleeping;
    if (!s) return;
    p.sleeping = null; p.eye = p.eyeAwake || 1.62;
    p.setPos(s.foot[0] + 0.5, s.y + 0.6, s.foot[2] + 0.5);
    const g = DL.game;
    if (why && g && g.player === p) g.chatMessage(why);
  }
  const ptick = PL.tick;
  PL.tick = function () {
    const s = this.sleeping;
    if (!s) return ptick.apply(this, arguments);
    if (!this.eyeAwake) this.eyeAwake = this.eye;
    this.moveForward = this.moveStrafe = 0; this.jumping = false; this.sprinting = false;
    ptick.apply(this, arguments);
    this.eye = 0.25;
    this.x = s.x + 0.5; this.y = s.y + 0.56; this.z = s.z + 0.5;
    this.vx = this.vy = this.vz = 0; this.fallDistance = 0; this.onGround = true;
  };
  const tick = GP.tick;
  GP.tick = function () {
    tick.apply(this, arguments);
    const p = this.player, w = this.world, s = p && p.sleeping;
    if (!s || !w) return;
    if (w.getBlock(s.x, s.y, s.z) !== B.bed || p.health <= 0) { wake(p); return; }
    if (this.sneakHeld || this.jumpHeld || G.screen && !(G.screen instanceof GUI.ChatScreen)) { wake(p); return; }
    if (monstersNear(w, s.x, s.y, s.z) && s.t > 10) { wake(p, '§7You may not rest now; there are monsters nearby.'); return; }
    if (++s.t >= 100) {
      // morning
      w.time = (Math.floor(w.time / 24000) + 1) * 24000;
      if (X && X.setWeather && w.weather && (w.weather.rain > 0.1 || w.weather.target)) { try { X.setWeather(this, 'clear'); } catch (e) { /* ignore */ } }
      wake(p, '§eGood morning!');
      if (X && X.grant) X.grant('sleep');
    }
  };
  const G = GUI;
  const extras = G.drawHUDExtras;
  G.drawHUDExtras = function (game, Wd, H) {
    const p = game.player, s = p && p.sleeping;
    const r = extras.apply(this, arguments);
    if (s) G.rect(0, 0, Wd, H, 'rgba(8,8,20,' + Math.min(0.92, s.t / 90).toFixed(3) + ')');
    return r;
  };
  // right-click: sleep in a bed, or put one down
  const useItem = GP.useItem;
  GP.useItem = function () {
    const p = this.player, t = this.target, w = this.world, held = p && p.held, d = held && I.get(held.id);
    const edge = this.usePressed || this._pgUseEdge;
    if (t && !t.entity && w.getBlock(t.x, t.y, t.z) === B.bed && !(p.sneaking && held)) { if (edge) { sleepIn(this, t.x, t.y, t.z); p.swing(); } return; }
    if (d && d.bedColour !== undefined && t && !t.entity) { if (edge) placeBed(this, t, d.bedColour); return; }
    return useItem.apply(this, arguments);
  };
  // waking up where you slept, if the bed is still there
  const respawn = GP.respawn;
  GP.respawn = function () {
    const p = this.player, sp = p && p.spawnPoint, w = this.world;
    if (sp && sp[3] === 'bed' && w && !w.dim && w.isReady(sp[4], sp[6]) && w.getBlock(sp[4], sp[5], sp[6]) !== B.bed) {
      p.spawnPoint = null;
      this.chatMessage('§7Your home bed was missing or obstructed.');
    }
    if (p) p.sleeping = null;
    return respawn.apply(this, arguments);
  };
  const hookWorld = GP.hookWorld;
  if (hookWorld) GP.hookWorld = function () { const r = hookWorld.apply(this, arguments); if (this.player && this.player.sleeping) wake(this.player); return r; };
  if (X && X.ACH && !X.ACH.some(a => a[0] === 'sleep')) X.ACH.push(['sleep', 'Sweet Dreams', 'Sleep in a bed until morning', 355]);
})();
