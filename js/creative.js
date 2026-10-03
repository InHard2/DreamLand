/*
 * DreamLand - modern creative inventory: item tabs above and below the
 * panel (like today's Minecraft), search, the survival inventory, a world
 * & weather tab (time, flying, rain on/off), plus spawn eggs for every mob.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, G = DL.GUI, I = DL.Items, E = DL.Entities, F = DL.Font, In = DL.Input, A = DL.Audio;
  const GP = DL.Game.prototype;

  /* ------------------------------------------------------------ */
  /* Spawn eggs                                                   */
  /* ------------------------------------------------------------ */
  const EGGS = [
    ['pig', '#F0A5A2', '#DB635F'], ['cow', '#443626', '#A1A1A1'], ['sheep', '#E7E7E7', '#FFB5B5'], ['chicken', '#A1A1A1', '#FF0000'],
    ['wolf', '#D7D3D3', '#CEAF96'], ['rabbit', '#995F40', '#734831'], ['polar_bear', '#F2F2F2', '#959590'], ['villager', '#563C33', '#BD8B72'],
    ['iron_golem', '#DBCDC1', '#74A332'], ['bat', '#4C3E30', '#0F0F0F'], ['zombie', '#00AFAF', '#799C65'], ['husk', '#797061', '#E6CC94'],
    ['drowned', '#8FF1D7', '#799C65'], ['skeleton', '#C1C1C1', '#494949'], ['stray', '#617677', '#DDEAEA'], ['creeper', '#0DA70B', '#000000'],
    ['spider', '#342D27', '#A80E0E'], ['slime', '#51A03E', '#7EBF6E'], ['witch', '#340000', '#51A03E'], ['pillager', '#532F36', '#959B9B'],
    ['vindicator', '#959B9B', '#275E61'], ['enderman', '#161616', '#000000'], ['endermite', '#161616', '#6E6E6E'], ['silverfish', '#6E6E6E', '#303030'],
    ['guardian', '#5A8272', '#F17D30'], ['zombie_pigman', '#EA9393', '#4C7129'], ['piglin', '#995F40', '#F9F3A4'], ['magma_cube', '#340000', '#FCFC00'],
    ['ghast', '#F9F9F9', '#BCBCBC'], ['blaze', '#F6B201', '#FFF87E'], ['wither_skeleton', '#141414', '#474D4D'], ['shulker', '#946794', '#4D3852'],
    ['moa', '#5B8FD8', '#F2F2F2'], ['phyg', '#F0A5A2', '#FFFFFF'], ['flying_cow', '#443626', '#FFFFFF'], ['aerbunny', '#FFFFFF', '#F0A5A2'],
    ['sheepuff', '#FFFFFF', '#7FB3E8'], ['zephyr', '#DDE8F2', '#8FB0D0'], ['mooshroom', '#A00F10', '#B7B7B7']
  ];
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const shade = (c, k) => c.map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  const EGG_ROWS = [
    '................',
    '......oooo......',
    '.....obhbbo.....',
    '....obhbbbbo....',
    '....ohbbsbbo....',
    '...obbbbbbbbo...',
    '...obsbbbbsbo...',
    '...obbbbbbbbo...',
    '..obbbbsbbbbbo..',
    '..obbbbbbbsbbo..',
    '..obsbbbbbbbbo..',
    '..obbbbbsbbbdo..',
    '...obbbbbbbdo...',
    '...odbbbbbddo...',
    '....oddddddo....',
    '.....oooooo.....'
  ];
  const EGG_BASE = 470;
  const eggOf = new Map();
  function addEgg(mob, c1, c2, id) {
    if (id > 1023 || I.defs[id]) return;
    const name = mob + '_spawn_egg';
    I._def(id, name, { display: I._titleCase(mob) + ' Spawn Egg', spawnEgg: mob });
    const b = hex(c1), s = hex(c2);
    DL.Tex.ITEM_ART[name] = [EGG_ROWS, { o: shade(b, 0.45), b, h: shade(b, 1.35), d: shade(b, 0.78), s }, 0];
    eggOf.set(id, mob);
  }
  EGGS.forEach(([mob, c1, c2], i) => addEgg(mob, c1, c2, EGG_BASE + i));

  // A mushroom-dotted red cow for the mushroom fields
  if (E.MOBS.cow && !E.MOBS.mooshroom) {
    E.MOBS.mooshroom = Object.assign({}, E.MOBS.cow, { model: E.MOBS.cow.model || 'cow', skin: 'mooshroom' });
    const M = DL.Models;
    if (M && M.skinPainters) {
      M.skinPainters.mooshroom = () => {
        const src = M.skins.cow, c = DL.Tex.makeCanvas(src.width, src.height), ctx = c.getContext('2d');
        ctx.drawImage(src, 0, 0);
        const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 10) continue;
          const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (l > 170) { d[i] = 200; d[i + 1] = 194; d[i + 2] = 190; } else { d[i] = Math.min(255, 80 + l * 1.25); d[i + 1] = l * 0.14; d[i + 2] = l * 0.12; }
        }
        ctx.putImageData(img, 0, 0);
        return c;
      };
    }
  }

  const useItem = GP.useItem;
  GP.useItem = function () {
    const p = this.player, held = p && p.held, mob = held && eggOf.get(held.id);
    if (!mob) return useItem.call(this);
    if (!this.usePressed && !this._pgUseEdge) return;
    const t = this.target, w = this.world;
    if (!t || t.entity) return;
    if (DL.Net && DL.Net.client) { this.chatMessage('§7Only the host can use spawn eggs.'); return; }
    if (!E.MOBS[mob]) return;
    const d = S.FACE_DIR[t.face];
    let x = t.x + d[0], y = t.y + d[1], z = t.z + d[2];
    if (S.SOLID[w.getBlock(x, y, z)]) { x = t.x; y = t.y + 1; z = t.z; }
    const m = E.spawnMob(w, mob, x + 0.5, y, z + 0.5);
    if (m) { m.persistent = true; m.yaw = p.yaw + Math.PI; }
    p.swing();
    In.haptic('place');
    if (!p.creative) p.consumeHeld(1);
  };

  /* ------------------------------------------------------------ */
  /* Tabs                                                         */
  /* ------------------------------------------------------------ */
  const N = (s) => new Set(s.split(' '));
  const REDSTONE = N('tnt rail redstone redstone_ore wooden_door');
  const FUNCTIONAL = N('torch crafting_table furnace chest bookshelf spawner ladder cobweb glowstone sea_lantern end_rod cauldron jack_o_lantern end_portal_frame dragon_egg sponge iron_bars bamboo_mosaic sculk_sensor');
  const COLORED = /wool|terracotta|stained|concrete|glass/;
  const NATURAL_RE = /(_ore|_log|_leaves|grass|dirt|sand$|red_sand|gravel|clay$|^snow|ice$|cactus|reeds|pumpkin$|netherrack|soul_sand|end_stone$|obsidian|magma|mycelium|podzol|moss|mud$|calcite|dripstone|deepslate$|sculk$|holystone$|quicksoil|icestone|aercloud|chorus|bedrock|nether_wart|mushroom|bamboo$|lily_pad|_roots|stone$|blackstone$|hay_bale|bone_block|petals|_vein)/;
  const TOOL_ITEMS = N('flint_and_steel bucket water_bucket lava_bucket milk_bucket saddle ender_pearl eye_of_ender portal_gun grappling_hook firework_rocket elytra bone_meal book compass clock shears fishing_rod');
  const COMBAT_ITEMS = N('bow arrow snowball egg fire_charge splash_potion');
  const TABS = [
    { id: 'building', name: 'Building Blocks', icon: 'bricks' },
    { id: 'colored', name: 'Colored Blocks', icon: 'wool' },
    { id: 'natural', name: 'Natural Blocks', icon: 'grass' },
    { id: 'functional', name: 'Functional Blocks', icon: 'crafting_table' },
    { id: 'redstone', name: 'Redstone Blocks', icon: 'redstone' },
    { id: 'world', name: 'World & Weather', icon: 'water_bucket' },
    { id: 'search', name: 'Search Items', icon: 'compass' },
    { id: 'tools', name: 'Tools & Utilities', icon: 'iron_pickaxe' },
    { id: 'combat', name: 'Combat', icon: 'gold_sword' },
    { id: 'food', name: 'Food & Drinks', icon: 'apple' },
    { id: 'ingredients', name: 'Ingredients', icon: 'iron_ingot' },
    { id: 'eggs', name: 'Spawn Eggs', icon: 'creeper_spawn_egg' },
    { id: 'worldinfo', name: 'Creative Info', icon: 'book', hidden: true },
    { id: 'inventory', name: 'Survival Inventory', icon: 'chest' }
  ];
  function tabOf(d) {
    const n = d.name;
    if (d.tab) return d.tab;
    if (d.isBlock) {
      if (REDSTONE.has(n)) return 'redstone';
      if (FUNCTIONAL.has(n) || S.blocks[d.block].emit >= 12) return 'functional';
      if (COLORED.test(n) && n !== 'terracotta_plain') return 'colored';
      if (S.blocks[d.block].render === S.R.CROSS || NATURAL_RE.test(n)) {
        if (/bricks|polished|chiseled|cut_|smooth|pillar|planks/.test(n)) return 'building';
        return 'natural';
      }
      return 'building';
    }
    if (d.spawnEgg) return 'eggs';
    if (n === 'redstone') return 'redstone';
    if (/sword$/.test(n) || COMBAT_ITEMS.has(n) || (d.armor && n !== 'elytra')) return 'combat';
    if (/(pickaxe|_axe|shovel|hoe)$/.test(n) || TOOL_ITEMS.has(n)) return 'tools';
    if (d.food || /cooked|raw|stew|bread|cake|cookie/.test(n)) return 'food';
    if (n === 'seeds' || n === 'nether_wart' || n === 'reeds') return 'natural';
    if (n === 'wooden_door') return 'redstone';
    return 'ingredients';
  }
  let lists = null;
  function buildLists() {
    lists = {};
    for (const t of TABS) lists[t.id] = [];
    const all = I.defs.filter(d => d && !d.hidden);
    for (const d of all) lists[tabOf(d)].push(d);
    // a few blocks Minecraft shows in two tabs
    for (const d of all) if (d.isBlock && /(_log|^log)$/.test(d.name)) lists.building.push(d);
    for (const d of all) if (d.isBlock && /(^stone|^cobblestone|^bricks)$/.test(d.name)) lists.natural.push(d);
    lists.eggs.sort((a, b) => a.id - b.id);
    lists.all = all;
  }
  const tabIcon = (t) => { const d = I.byName[t.icon]; return d ? { id: d.id, count: 1, dmg: 0 } : null; };

  /* ------------------------------------------------------------ */
  /* The screen                                                   */
  /* ------------------------------------------------------------ */
  const CW = 195, CH = 136, TW = 26, TH = 28, ROWS = 5;
  let lastTab = 'building';
  class CreativeScreen extends G.ContainerScreen {
    constructor(game) {
      super(game);
      if (!lists) buildLists();
      this.pw = CW; this.ph = CH;
      this.tab = lastTab; this.scroll = 0;
      this.search = { type: 'field', x: 0, y: 0, w: 89, h: 12, value: '', max: 30, placeholder: 'Search...' };
      this.items = [];
      this._drag = null;
      this.refilter();
    }
    get dragging() { return this._drag || this._touchScroll || null; }
    set dragging(v) { this._drag = v; }
    get visibleTabs() { return TABS.filter(t => !t.hidden); }
    get maxScroll() { return Math.max(0, Math.ceil(this.items.length / 9) - ROWS); }
    refilter() {
      if (this.tab === 'search') {
        const q = this.search.value.trim().toLowerCase();
        this.items = lists.all.filter(d => !q || (d.display || d.name).toLowerCase().includes(q) || d.name.includes(q.replace(/ /g, '_')));
      } else this.items = lists[this.tab] || [];
      this.scroll = Math.min(this.scroll, this.maxScroll);
    }
    setTab(id) {
      if (this.tab === id) return;
      if (this.activeField) this.deactivateField(this.activeField);
      this.tab = id; lastTab = id; this.scroll = 0;
      this.refilter();
      this.layout();
      A.play('click', null, null, null, 1, 1);
      if (id === 'search' && In.lastDevice === 'kbm') this.activateField(this.search);
    }
    tabRect(i) {
      const top = i < 7, k = top ? i : i - 7;
      return { x: this.px + k * (TW + 2) - (k === 6 ? 1 : 0) + (k === 6 ? 1 : 0), y: top ? this.py - TH + 4 : this.py + CH - 4, w: TW, h: TH, top };
    }
    tabAt(x, y) {
      const tabs = this.visibleTabs;
      for (let i = 0; i < tabs.length; i++) { const r = this.tabRect(i); if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return tabs[i]; }
      return null;
    }
    layout() {
      // room for the tab rows above and below the panel
      this.px = Math.floor((G.W - CW) / 2);
      this.py = Math.max(TH - 2 + G.safe.t, Math.floor((G.H - CH) / 2));
      if (this.py + CH + TH - 4 > G.H) this.py = Math.max(TH - 4, G.H - CH - TH + 4);
      this.slots = [];
      this.buildSlots();
      if (In.lastDevice === 'gamepad' && !this.cursorPos) {
        const s = this.slots.find(s => s.inv && s.index === this.player.selected) || this.slots[0];
        if (s) this.cursorPos = { x: this.px + s.x + 8, y: this.py + s.y + 8 };
      }
      this.widgets = [];
      if (this.tab === 'search') {
        this.search.x = this.px + 82; this.search.y = this.py + 4;
        this.search.onEnter = () => this.deactivateField(this.search);
        this.widgets.push(this.search);
      }
      if (this.tab === 'world') this.worldButtons();
    }
    worldButtons() {
      const g = this.game, w = g.world, p = this.player, X = DL.Extras;
      const x = this.px + 8, y = this.py + 18, bw = 44;
      const guest = !!(DL.Net && DL.Net.client);
      const setTime = (t) => { w.time = Math.floor(w.time / 24000) * 24000 + t; };
      this.btn('Sunrise', x, y, bw, 18, () => setTime(0), { enabled: !guest });
      this.btn('Noon', x + 46, y, bw, 18, () => setTime(6000), { enabled: !guest });
      this.btn('Sunset', x + 92, y, bw, 18, () => setTime(12000), { enabled: !guest });
      this.btn('Night', x + 138, y, bw - 2, 18, () => setTime(18000), { enabled: !guest });
      const tl = () => 'Time: ' + (w.timeFrozen ? 'Frozen' : 'Running');
      const tb = this.btn(tl(), x, y + 22, 88, 18, () => { w.timeFrozen = !w.timeFrozen; tb.label = tl(); }, { enabled: !guest });
      const fl = () => 'Flying: ' + (p.flying ? 'ON' : 'OFF');
      const fb = this.btn(fl(), x + 92, y + 22, 88, 18, () => { p.flying = !p.flying; p.vy = p.flying ? 0.2 : p.vy; fb.label = fl(); });
      const rainOn = () => !(g.meta && g.meta.noRain);
      const rl = () => 'Rain: ' + (rainOn() ? 'ON' : 'OFF');
      const rb = this.btn(rl(), x, y + 44, 88, 18, () => { if (X && X.setRainEnabled) X.setRainEnabled(g, !rainOn()); rb.label = rl(); }, { enabled: !guest && !!X });
      const wt = X && X.weather ? X.weather(g) : null;
      const wl = () => 'Sky: ' + (!wt || !wt.target ? 'Clear' : wt.thunderT ? 'Storm' : 'Rain');
      const wb = this.btn(wl(), x + 92, y + 44, 88, 18, () => {
        if (!X || !wt) return;
        const next = !wt.target ? 'rain' : !wt.thunderT ? 'thunder' : 'clear';
        if (next !== 'clear' && !rainOn()) X.setRainEnabled(g, true);
        X.setWeather(g, next);
        wb.label = wl(); rb.label = rl();
      }, { enabled: !guest && !!X });
      this.worldNote = guest ? 'The host controls the weather' : 'Rain OFF = clear skies forever';
    }
    buildSlots() {
      const p = this.player;
      if (this.tab === 'inventory') {
        // like Minecraft: helmet and chestplate left of you, leggings and boots on the right
        const GHOST = ['leather_helmet', 'leather_chestplate', 'leather_leggings', 'leather_boots'];
        for (let i = 0; i < 4; i++) this.slots.push({
          x: i < 2 ? 54 : 108, y: 7 + (i & 1) * 27, get: () => p.armor[i], set: (s) => { p.armor[i] = s; }, armor: i, armorSlot: true, max: 1,
          accept: (s) => { const d = I.get(s.id); return !!(d && d.armor && d.armor.slot === i); },
          ghost: (x, y) => { const t = DL.Tex.itemTile(GHOST[i]); G.ctx.globalAlpha = 0.25; G.ctx.filter = 'grayscale(1) brightness(0.4)'; DL.Tex.drawItemTile(G.ctx, t, x, y, 16); G.ctx.filter = 'none'; G.ctx.globalAlpha = 1; }
        });
        this.slots.push({ x: 173, y: 112, trash: true, get: () => null, set: () => { } });
        for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) {
          const i = 9 + r * 9 + c;
          this.slots.push({ x: 9 + c * 18, y: 54 + r * 18, get: () => p.inv[i], set: (s) => { p.inv[i] = s; }, inv: true, index: i, main: true });
        }
      } else if (this.tab !== 'world') {
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < 9; c++) {
          const k = r * 9 + c;
          this.slots.push({ x: 9 + c * 18, y: 18 + r * 18, source: true, get: () => { const d = this.items[this.scroll * 9 + k]; return d ? { id: d.id, count: 1, dmg: 0 } : null; }, set: () => { } });
        }
      }
      for (let c = 0; c < 9; c++) this.slots.push({ x: 9 + c * 18, y: 112, get: () => p.inv[c], set: (st) => { p.inv[c] = st; }, inv: true, index: c, hotbar: true });
    }
    clickSlot(s, button, shift) {
      const p = this.player;
      if (s.trash) {
        if (p.cursor) p.cursor = null;
        else if (shift) { for (let i = 0; i < p.inv.length; i++) p.inv[i] = null; }
        return;
      }
      if (s.source) {
        const st = s.get();
        if (p.cursor) { p.cursor = null; return; }
        if (!st) return;
        const n = button === 2 ? 1 : I.maxStack(st.id);
        if (shift) { p.addItem(I.stack(st.id, n)); return; }
        p.cursor = I.stack(st.id, n);
        In.haptic('tick');
        return;
      }
      if (s.armor !== undefined) {
        const c = p.cursor, d = c && I.get(c.id);
        if (c && !(d && d.armor && d.armor.slot === s.armor)) return;
        const old = p.armor[s.armor]; p.armor[s.armor] = c || null; p.cursor = old || null;
        return;
      }
      if (shift && s.get() && this.tab !== 'inventory') { s.set(null); return; }
      super.clickSlot(s, button, shift && this.tab === 'inventory' ? false : false);
    }
    mouseDown(x, y, button, shift) {
      if (this._swiped) { this._swiped = false; return; }
      const touch = In.lastDevice === 'touch';
      if (touch) {
        const [cx, cy, cw, ch] = this.closeRect();
        if (x >= cx && y >= cy && x < cx + cw && y < cy + ch) { A.play('click', null, null, null, 1, 1); this.game.setScreen(null); return; }
      }
      const t = this.tabAt(x, y);
      if (t) { this.setTab(t.id); return; }
      const w = this.widgetAt(x, y);
      if (w && button === 0) {
        if (w.type === 'field') { this.activateField(w); return; }
        if (w.enabled === false) return;
        A.play('click', null, null, null, 1, 1); w.onClick(w); return;
      }
      if (this.activeField) this.deactivateField(this.activeField);
      // scrollbar
      const sx = this.px + 175, sy = this.py + 18;
      if (this.hasGrid() && x >= sx && x < sx + 12 && y >= sy && y < sy + 90) { this._drag = 'bar'; this.dragBar(y); return; }
      const inside = x >= this.px && y >= this.py && x < this.px + this.pw && y < this.py + this.ph;
      if (!inside && !this.slotAt(x, y) && this.player.cursor) { this.player.cursor = null; return; }
      if (!inside && !this.slotAt(x, y) && touch) { this.game.setScreen(null); return; }
      super.mouseDown(x, y, button, shift);
    }
    hasGrid() { return this.tab !== 'inventory' && this.tab !== 'world'; }
    dragBar(y) {
      const ms = this.maxScroll;
      if (!ms) return;
      const f = Math.max(0, Math.min(1, (y - (this.py + 18) - 7) / (90 - 15)));
      this.scroll = Math.round(f * ms);
    }
    mouseMove(x, y) {
      if (this._drag === 'bar') { this.dragBar(y); return; }
      super.mouseMove(x, y);
      const td = this.game.touchDown;
      if (td && this.hasGrid() && In.lastDevice === 'touch') {
        if (!this._touchScroll || this._touchScroll.id !== td.id) this._touchScroll = { id: td.id, y0: td.y, s0: this.scroll, inGrid: td.x >= this.px && td.x < this.px + this.pw && td.y >= this.py + 16 && td.y < this.py + 108 };
        const ts = this._touchScroll;
        if (ts.inGrid && Math.abs(y - ts.y0) > 6) {
          this._swiped = true;
          this.scroll = Math.max(0, Math.min(this.maxScroll, Math.round(ts.s0 - (y - ts.y0) / 18)));
        }
      }
    }
    mouseUp(x, y) { this._drag = null; this._touchScroll = null; super.mouseUp(x, y); }
    textInput(v) {
      if (this.activeField === this.search) { this.search.value = v.slice(0, 30); this.refilter(); return; }
      super.textInput(v);
    }
    wheel(d) { if (this.hasGrid() && !(this.slotAt(G.mouse.x, G.mouse.y) || {}).inv) this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll + d)); else super.wheel(d); }
    padButton(b) {
      const P = In.GPB, tabs = this.visibleTabs;
      const i = tabs.findIndex(t => t.id === this.tab);
      if (b === P.LB) { this.setTab(tabs[(i + tabs.length - 1) % tabs.length].id); return; }
      if (b === P.RB) { this.setTab(tabs[(i + 1) % tabs.length].id); return; }
      if (b === P.UP) { this.wheel(-1); return; }
      if (b === P.DOWN) { this.wheel(1); return; }
      const c = this.cursorPos;
      if (b === P.A && c) {
        const t = this.tabAt(c.x, c.y); if (t) { this.setTab(t.id); return; }
        const w = this.widgetAt(c.x, c.y); if (w && w.enabled !== false && w.onClick) { w.onClick(w); return; }
      }
      super.padButton(b);
    }
    key(code) {
      if (this.activeField) return;
      if (code === 'ArrowUp') this.wheel(-1);
      else if (code === 'ArrowDown') this.wheel(1);
      else if (code === 'Tab') { const tabs = this.visibleTabs, i = tabs.findIndex(t => t.id === this.tab); this.setTab(tabs[(i + 1) % tabs.length].id); }
      else super.key(code);
    }
    drawTab(i, t, mx, my) {
      const r = this.tabRect(i), sel = t.id === this.tab, ctx = G.ctx;
      const y = r.top ? r.y + (sel ? 0 : 2) : r.y - (sel ? 0 : 2), h = r.h - (sel ? 0 : 2);
      ctx.fillStyle = '#000'; ctx.fillRect(r.x + 1, y, r.w - 2, h); ctx.fillRect(r.x, y + 1, r.w, h - 2);
      ctx.fillStyle = sel ? '#C6C6C6' : '#A8A8A8'; ctx.fillRect(r.x + 1, y + 1, r.w - 2, h - 2);
      ctx.fillStyle = sel ? '#FFFFFF' : '#D8D8D8';
      if (r.top) { ctx.fillRect(r.x + 1, y + 1, r.w - 3, 2); ctx.fillRect(r.x + 1, y + 1, 2, h - 2); }
      else { ctx.fillRect(r.x + 1, y + 1, 2, h - 3); }
      ctx.fillStyle = sel ? '#555555' : '#6E6E6E'; ctx.fillRect(r.x + r.w - 3, y + 2, 2, h - 3);
      if (!r.top) ctx.fillRect(r.x + 2, y + h - 3, r.w - 4, 2);
      const icon = tabIcon(t), ix = r.x + 5, iy = r.top ? y + 7 : y + 5;
      if (t.id === 'search') { // magnifying glass
        G.rect(ix + 3, iy + 1, 6, 1, '#303030'); G.rect(ix + 3, iy + 9, 6, 1, '#303030'); G.rect(ix + 1, iy + 3, 1, 5, '#303030'); G.rect(ix + 10, iy + 3, 1, 5, '#303030');
        G.rect(ix + 2, iy + 2, 1, 1, '#303030'); G.rect(ix + 9, iy + 2, 1, 1, '#303030'); G.rect(ix + 2, iy + 8, 1, 1, '#303030'); G.rect(ix + 9, iy + 8, 1, 1, '#303030');
        G.rect(ix + 2, iy + 3, 8, 5, '#A8D8F0'); G.rect(ix + 3, iy + 2, 6, 7, '#A8D8F0'); G.rect(ix + 3, iy + 3, 2, 2, '#FFFFFF');
        for (let k = 0; k < 5; k++) { G.rect(ix + 9 + k, iy + 9 + k, 2, 2, '#6B4A2B'); }
      } else if (icon) G.drawItem(icon, ix, iy, true);
      if (mx >= r.x && my >= r.y && mx < r.x + r.w && my < r.y + r.h && !this.player.cursor) G.tooltip = { text: t.name, x: mx, y: my };
    }
    draw(mx, my) {
      const pad = In.lastDevice === 'gamepad' && this.cursorPos;
      if (pad) { mx = this.cursorPos.x; my = this.cursorPos.y; }
      G.dim();
      const tabs = this.visibleTabs;
      tabs.forEach((t, i) => { if (t.id !== this.tab) this.drawTab(i, t, mx, my); });
      G.panel(this.px, this.py, this.pw, this.ph);
      const si = tabs.findIndex(t => t.id === this.tab);
      if (si >= 0) this.drawTab(si, tabs[si], mx, my);
      const cur = TABS.find(t => t.id === this.tab);
      this.preview = null;
      if (this.tab === 'inventory') {
        // a window the renderer draws your 3D model through (like the survival inventory)
        const bx = this.px + 73, by = this.py + 4;
        G.rect(bx, by, 32, 47, '#000');
        G.ctx.clearRect(bx + 1, by + 1, 30, 45);
        this.preview = [bx + 1, by + 1, 30, 45];
        this.previewLook = [(mx - bx - 16) / 30, (my - by - 14) / 30];
      } else this.drawLabel(cur ? cur.name : '', 8, 6);
      if (this.hasGrid()) {
        const tx = this.px + 175, ty = this.py + 18, th = 90;
        G.rect(tx, ty, 12, th, '#8B8B8B');
        G.rect(tx, ty, 12, 1, '#373737'); G.rect(tx, ty, 1, th, '#373737');
        const ms = this.maxScroll, ky = ty + 1 + (ms ? Math.round(this.scroll / ms * (th - 17)) : 0);
        G.rect(tx + 1, ky, 10, 15, ms ? '#E0E0E0' : '#A0A0A0'); G.rect(tx + 1, ky + 14, 10, 1, '#5A5A5A'); G.rect(tx + 10, ky, 1, 15, '#5A5A5A');
        if (!this.items.length) G.textC(this.tab === 'search' ? 'No items found' : 'Nothing here yet', this.px + 88, this.py + 56, '#555555', false);
      }
      if (this.tab === 'inventory') G.rect(this.px + 172, this.py + 111, 18, 18, '#8B3030');
      if (this.tab === 'world') {
        this.drawLabel(this.worldNote || '', 8, 86);
        this.drawLabel('Hotbar', 8, 101);
      }
      this.drawSlots(mx, my);
      if (this.tab === 'inventory') {
        const tr = [this.px + 173, this.py + 112];
        if (!this.player.cursor) { G.rect(tr[0] + 4, tr[1] + 3, 8, 1, '#EEEEEE'); G.rect(tr[0] + 5, tr[1] + 5, 6, 8, '#EEEEEE'); G.rect(tr[0] + 6, tr[1] + 6, 1, 6, '#8B3030'); G.rect(tr[0] + 9, tr[1] + 6, 1, 6, '#8B3030'); }
        if (mx >= tr[0] && my >= tr[1] && mx < tr[0] + 16 && my < tr[1] + 16) G.tooltip = { text: 'Destroy Item (shift: clear all)', x: mx, y: my };
      }
      this.drawWidgets(mx, my);
      this.drawCursorItem(mx, my);
      this.drawCloseButton(mx, my);
    }
    closeRect() { return [this.px + this.pw - 16, this.py + 3, 13, 12]; }
    drawLabel(t, x, y) { G.text(t, this.px + x, this.py + y, '#404040', false); }
    close() { this.player.cursor = null; if (this.activeField) this.deactivateField(this.activeField); }
  }
  G.CreativeScreen = CreativeScreen;
  DL.Creative = { tabOf, TABS, EGGS, addEgg: (mob, c1, c2, id) => { addEgg(mob, c1, c2, id); lists = null; } };
})();
