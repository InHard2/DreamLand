/*
 * DreamLand - GUI: widgets, menu screens, HUD, containers, touch overlay.
 * Everything is drawn on a 2D canvas in "GUI pixels" (scaled, nearest).
 */
(function () {
  const DL = window.DL;
  const F = DL.Font;
  const G = DL.GUI = {};
  const I = () => DL.Items;

  G.init = function (canvas) {
    G.canvas = canvas;
    G.ctx = canvas.getContext('2d');
    G.iconCache = new Map();
    G.mouse = { x: -100, y: -100 };
    G.screen = null;
    G.chat = [];
    G.tooltip = null;
    G.safe = { l: 0, r: 0, t: 0, b: 0 };
  };

  G.resize = function (w, h, dpr, guiScaleSetting) {
    const c = G.canvas;
    c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
    let s = 1;
    const max = guiScaleSetting || 1000;
    while (s < max && c.width / (s + 1) >= 320 && c.height / (s + 1) >= 240) s++;
    if (DL.Input.isTouchDevice && !guiScaleSetting) s = Math.max(1, s);
    G.scale = s; G.dpr = dpr;
    G.W = Math.floor(c.width / s); G.H = Math.floor(c.height / s);
    G.iconCache.clear();
    // safe areas (iOS notch) in GUI px
    const probe = document.getElementById('safeprobe');
    if (probe) {
      const cs = getComputedStyle(probe);
      const px = v => (parseFloat(v) || 0) * dpr / s;
      G.safe = { l: px(cs.paddingLeft), r: px(cs.paddingRight), t: px(cs.paddingTop), b: px(cs.paddingBottom) };
    }
    if (G.screen) G.screen.layout();
  };
  G.toGui = (cx, cy) => [cx * G.dpr / G.scale, cy * G.dpr / G.scale];

  /* ------------------------------------------------------------ */
  /* Drawing primitives                                           */
  /* ------------------------------------------------------------ */
  G.begin = function () {
    const ctx = G.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, G.canvas.width, G.canvas.height);
    ctx.setTransform(G.scale, 0, 0, G.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
  };
  G.rect = function (x, y, w, h, col) { G.ctx.fillStyle = col; G.ctx.fillRect(x, y, w, h); };
  G.gradient = function (x, y, w, h, c1, c2) {
    const g = G.ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    G.ctx.fillStyle = g; G.ctx.fillRect(x, y, w, h);
  };
  G.text = (s, x, y, col, shadow) => F.draw(G.ctx, s, x, y, col, shadow);
  G.textC = (s, x, y, col, shadow) => F.drawCentered(G.ctx, s, x, y, col, shadow);
  G.dim = function () { G.gradient(0, 0, G.W, G.H, 'rgba(16,16,16,0.75)', 'rgba(16,16,16,0.82)'); };

  G.panel = function (x, y, w, h) {
    const ctx = G.ctx;
    ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = '#C6C6C6'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 1, y + 1, w - 3, 2); ctx.fillRect(x + 1, y + 1, 2, h - 3);
    ctx.fillStyle = '#555555'; ctx.fillRect(x + 3, y + h - 3, w - 4, 2); ctx.fillRect(x + w - 3, y + 3, 2, h - 4);
    ctx.fillStyle = '#C6C6C6'; ctx.fillRect(x + w - 3, y + 1, 2, 2); ctx.fillRect(x + 1, y + h - 3, 2, 2);
  };
  G.slot = function (x, y) {
    const ctx = G.ctx;
    ctx.fillStyle = '#373737'; ctx.fillRect(x, y, 17, 1); ctx.fillRect(x, y, 1, 17);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 1, y + 17, 17, 1); ctx.fillRect(x + 17, y + 1, 1, 17);
    ctx.fillStyle = '#8B8B8B'; ctx.fillRect(x + 1, y + 1, 16, 16);
    ctx.fillStyle = '#8B8B8B'; ctx.fillRect(x + 17, y, 1, 1); ctx.fillRect(x, y + 17, 1, 1);
  };
  G.bigSlot = function (x, y) {
    const ctx = G.ctx;
    ctx.fillStyle = '#373737'; ctx.fillRect(x, y, 25, 1); ctx.fillRect(x, y, 1, 25);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 1, y + 25, 25, 1); ctx.fillRect(x + 25, y + 1, 1, 25);
    ctx.fillStyle = '#8B8B8B'; ctx.fillRect(x + 1, y + 1, 24, 24);
  };

  G.button = function (b, mx, my) {
    const ctx = G.ctx;
    const hover = b.enabled !== false && mx >= b.x && my >= b.y && mx < b.x + b.w && my < b.y + b.h;
    const focus = b.focused;
    const state = b.enabled === false ? 0 : (hover || focus) ? 2 : 1;
    const tex = DL.Tex.gui.buttons[state];
    const hw = Math.floor(b.w / 2), hh = b.h;
    ctx.drawImage(tex, 0, 0, hw, Math.min(20, hh), b.x, b.y, hw, Math.min(20, hh));
    ctx.drawImage(tex, 200 - (b.w - hw), 0, b.w - hw, Math.min(20, hh), b.x + hw, b.y, b.w - hw, Math.min(20, hh));
    if (hh > 20) ctx.drawImage(tex, 0, 19, b.w, 1, b.x, b.y + 19, b.w, hh - 20);
    const col = b.enabled === false ? '#A0A0A0' : (hover || focus) ? '#FFFFA0' : '#E0E0E0';
    if (b.icon) b.icon(b.x, b.y, b.w, b.h, col);
    else G.textC(b.label, b.x + b.w / 2, b.y + (b.h - 8) / 2, col);
    return hover;
  };
  G.slider = function (s, mx, my) {
    const ctx = G.ctx;
    const hover = mx >= s.x && my >= s.y && mx < s.x + s.w && my < s.y + s.h;
    const tex0 = DL.Tex.gui.buttons[0];
    const hw = Math.floor(s.w / 2);
    ctx.drawImage(tex0, 0, 0, hw, 20, s.x, s.y, hw, 20);
    ctx.drawImage(tex0, 200 - (s.w - hw), 0, s.w - hw, 20, s.x + hw, s.y, s.w - hw, 20);
    const kx = s.x + Math.round(s.value * (s.w - 8));
    const kt = DL.Tex.gui.buttons[(hover || s.focused) ? 2 : 1];
    ctx.drawImage(kt, 0, 0, 4, 20, kx, s.y, 4, 20);
    ctx.drawImage(kt, 196, 0, 4, 20, kx + 4, s.y, 4, 20);
    G.textC(s.label(), s.x + s.w / 2, s.y + 6, (hover || s.focused) ? '#FFFFA0' : '#E0E0E0');
  };

  /* ------------------------------------------------------------ */
  /* Item icons                                                   */
  /* ------------------------------------------------------------ */
  G.drawItem = function (stack, x, y, noCount) {
    if (!stack) return;
    const d = I().get(stack.id);
    if (!d) return;
    const ctx = G.ctx;
    if (d.isBlock && !d.flat) {
      const icon = G.blockIcon(d.block);
      if (icon) ctx.drawImage(icon, x, y, 16, 16);
    } else {
      const src = d.isBlock ? DL.Tex.terrain : DL.Tex.items;
      const tile = d.isBlock ? DL.S.blocks[d.block].icon : DL.Tex.itemTile(d.icon || d.name);
      ctx.drawImage(src, (tile & 15) * 16, (tile >> 4) * 16, 16, 16, x, y, 16, 16);
    }
    if (d.maxDamage && stack.dmg > 0) {
      const f = 1 - stack.dmg / d.maxDamage;
      const w = Math.round(13 * f);
      const r = Math.round(255 - f * 255), g = Math.round(f * 255);
      G.rect(x + 2, y + 13, 13, 2, '#000');
      G.rect(x + 2, y + 13, 12, 1, `rgb(${r >> 2},${64},0)`);
      G.rect(x + 2, y + 13, w, 1, `rgb(${r},${g},0)`);
    }
    if (!noCount && stack.count > 1) {
      const s = String(stack.count);
      G.text(s, x + 17 - F.width(s), y + 9, '#FFFFFF');
    }
  };
  G.blockIcon = function (id) {
    const key = id + ':' + G.scale;
    let c = G.iconCache.get(key);
    if (c) return c;
    if (!DL.game || !DL.game.renderer) return null;
    c = DL.game.renderer.renderBlockIcon(id, 16 * G.scale);
    G.iconCache.set(key, c);
    return c;
  };

  /* ------------------------------------------------------------ */
  /* Screen base                                                  */
  /* ------------------------------------------------------------ */
  class Screen {
    constructor(game, parent) { this.game = game; this.parent = parent || null; this.widgets = []; this.focus = -1; }
    get pauses() { return true; }
    get showWorld() { return !!this.game.world && this.game.inGame; }
    layout() { }
    open() { this.layout(); }
    close() { }
    back() { this.game.setScreen(this.parent); }
    draw(mx, my) { this.drawWidgets(mx, my); }
    drawWidgets(mx, my) {
      for (let i = 0; i < this.widgets.length; i++) {
        const w = this.widgets[i];
        w.focused = i === this.focus && DL.Input.lastDevice === 'gamepad';
        if (w.hidden) continue;
        if (w.type === 'slider') G.slider(w, mx, my);
        else if (w.type === 'field') this.drawField(w);
        else G.button(w, mx, my);
      }
    }
    drawField(f) {
      G.rect(f.x - 1, f.y - 1, f.w + 2, f.h + 2, f.active ? '#FFFFFF' : '#A0A0A0');
      G.rect(f.x, f.y, f.w, f.h, '#000');
      let v = f.value;
      while (F.width(v) > f.w - 8 && v.length) v = v.slice(1);
      const caret = f.active && (Math.floor(performance.now() / 300) % 2 === 0) ? '_' : '';
      G.text(v + caret, f.x + 4, f.y + (f.h - 8) / 2, '#E0E0E0');
      if (!f.value && !f.active && f.placeholder) G.text(f.placeholder, f.x + 4, f.y + (f.h - 8) / 2, '#707070', false);
    }
    widgetAt(x, y) { return this.widgets.find(w => !w.hidden && x >= w.x && y >= w.y && x < w.x + w.w && y < w.y + w.h); }
    mouseDown(x, y, button) {
      const w = this.widgetAt(x, y);
      if (!w || w.enabled === false || button !== 0) {
        if (!w) this.widgets.forEach(f => { if (f.type === 'field' && f.active) this.deactivateField(f); });
        return;
      }
      if (w.type === 'slider') { this.dragging = w; this.setSlider(w, x); return; }
      if (w.type === 'field') { this.activateField(w); return; }
      DL.Audio.play('click', null, null, null, 1, 1);
      if (w.onClick) w.onClick(w);
    }
    mouseMove(x) { if (this.dragging) this.setSlider(this.dragging, x); }
    mouseUp() { this.dragging = null; }
    setSlider(s, x) {
      s.value = Math.max(0, Math.min(1, (x - s.x - 4) / (s.w - 8)));
      if (s.steps) s.value = Math.round(s.value * s.steps) / s.steps;
      if (s.onChange) s.onChange(s.value);
    }
    activateField(f) {
      this.widgets.forEach(o => { if (o.type === 'field' && o !== f) o.active = false; });
      f.active = true;
      const ti = DL.Input.textInput;
      ti.value = f.value; ti.style.pointerEvents = 'auto';
      ti.focus();
      this.activeField = f;
    }
    deactivateField(f) { f.active = false; DL.Input.textInput.blur(); this.activeField = null; }
    textInput(v) { if (this.activeField) this.activeField.value = v.slice(0, this.activeField.max || 32); }
    textKey(k) {
      if (k === 'Enter' && this.activeField && this.activeField.onEnter) this.activeField.onEnter();
      else if (k === 'Escape' || k === 'Enter') { if (this.activeField) this.deactivateField(this.activeField); }
      else if (k === 'Tab') {
        const fields = this.widgets.filter(w => w.type === 'field');
        const i = fields.indexOf(this.activeField);
        if (fields.length) this.activateField(fields[(i + 1) % fields.length]);
      }
    }
    key(code) { if (code === 'Escape') this.back(); }
    wheel() { }
    navigate(dx, dy) {
      const list = this.widgets.filter(w => !w.hidden && w.enabled !== false);
      if (!list.length) return;
      let cur = this.widgets[this.focus];
      if (!cur || cur.hidden) { this.focus = this.widgets.indexOf(list[0]); return; }
      if (cur.type === 'slider' && dx) {
        cur.value = Math.max(0, Math.min(1, cur.value + dx * (cur.steps ? 1 / cur.steps : 0.05)));
        if (cur.onChange) cur.onChange(cur.value);
        return;
      }
      const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
      let best = null, bd = 1e9;
      for (const w of list) {
        if (w === cur) continue;
        const wx = w.x + w.w / 2, wy = w.y + w.h / 2;
        const ddx = wx - cx, ddy = wy - cy;
        if (dx && Math.sign(ddx) !== dx) continue;
        if (dy && Math.sign(ddy) !== dy) continue;
        if (dx && Math.abs(ddx) < 4) continue;
        if (dy && Math.abs(ddy) < 4) continue;
        const d = dx ? Math.abs(ddx) + Math.abs(ddy) * 2 : Math.abs(ddy) + Math.abs(ddx) * 2;
        if (d < bd) { bd = d; best = w; }
      }
      if (best) { this.focus = this.widgets.indexOf(best); DL.Input.haptic('tick'); }
    }
    padButton(b) {
      const P = DL.Input.GPB;
      if (b === P.UP) this.navigate(0, -1);
      else if (b === P.DOWN) this.navigate(0, 1);
      else if (b === P.LEFT) this.navigate(-1, 0);
      else if (b === P.RIGHT) this.navigate(1, 0);
      else if (b === P.A) {
        const w = this.widgets[this.focus];
        if (w && w.enabled !== false && !w.hidden) {
          if (w.type === 'field') this.activateField(w);
          else if (w.type !== 'slider') { DL.Audio.play('click', null, null, null, 1, 1); DL.Input.haptic('tick'); if (w.onClick) w.onClick(w); }
        } else this.navigate(0, 1);
      } else if (b === P.B) this.back();
    }
    stickNav(ax, ay) {
      const now = performance.now();
      const mag = Math.max(Math.abs(ax), Math.abs(ay));
      if (mag < 0.5) { this._navT = 0; return; }
      if (now < (this._navT || 0)) return;
      this._navT = now + (this._navHeld ? 160 : 320); this._navHeld = true;
      if (Math.abs(ax) > Math.abs(ay)) this.navigate(Math.sign(ax), 0); else this.navigate(0, Math.sign(ay));
    }
    btn(label, x, y, w, h, onClick, extra) { const b = Object.assign({ type: 'button', label, x, y, w, h: h || 20, onClick }, extra || {}); this.widgets.push(b); return b; }
  }
  G.Screen = Screen;

  const OPT_TOGGLE = (v) => v ? 'ON' : 'OFF';

  /* ------------------------------------------------------------ */
  /* Title screen                                                 */
  /* ------------------------------------------------------------ */
  const SPLASHES = [
    'Punch a tree!', 'Now in HTML!', 'Pixel perfect!', 'Handcrafted noise!', 'Works on iOS!', 'Controller supported!',
    'Feel the rumble!', 'Infinite terrain!', 'Mind the creepers!', 'Built with WebGL!', 'Tiny sheep!', 'Indie!', 'Voxels!',
    'Alpha!', 'Dig deeper!', "Don't dig straight down!", 'Look at the stars!', 'Sunrise, sunset!', 'No downloads!',
    '20 ticks per second!', 'Pure JavaScript!', 'Try the furnace!', 'Sheep go baa!', 'Now in 3D!', 'Pickaxe required!',
    'Also try the Nether... someday!', 'Fancy leaves!', 'Smooth lighting!', 'Procedural music!', 'Made of cubes!',
    'Touch me!', 'Oof!', 'Watch out for lava!', 'Bread is great!', '100% procedural!', 'Cellular automata water!'
  ];
  class TitleScreen extends Screen {
    constructor(game) { super(game); this.splash = SPLASHES[Math.floor(Math.random() * SPLASHES.length)]; this.t0 = performance.now(); }
    get pauses() { return false; }
    get showWorld() { return false; }
    layout() {
      this.widgets = [];
      const cx = G.W / 2, y = G.H / 4 + 48;
      this.btn('Singleplayer', cx - 100, y, 200, 20, () => this.game.setScreen(new SelectWorldScreen(this.game, this)));
      this.btn('Multiplayer', cx - 100, y + 24, 200, 20, null, { enabled: false });
      this.btn('Help & Controls', cx - 100, y + 48, 200, 20, () => this.game.setScreen(new HelpScreen(this.game, this)));
      this.btn('Options...', cx - 100, y + 72 + 12, 98, 20, () => this.game.setScreen(new OptionsScreen(this.game, this)));
      this.btn(document.fullscreenElement ? 'Windowed' : 'Fullscreen', cx + 2, y + 72 + 12, 98, 20, (b) => { this.game.toggleFullscreen(); setTimeout(() => this.layout(), 300); },
        { enabled: !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) && !DL.Input.isIOS });
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 0;
    }
    logoRect() {
      const top = 6 + G.safe.t;
      const avail = G.H / 4 + 48 - 6 - top;
      const w = Math.min(G.W - 20, 300, avail / 0.3);
      const h = w * 0.3;
      return { x: G.W / 2 - w / 2, y: top, w, h };
    }
    draw(mx, my) {
      const ctx = G.ctx;
      // splash (bottom-right corner of the logo)
      const L = this.logoRect();
      ctx.save();
      ctx.translate(L.x + L.w * 0.86, L.y + L.h * 0.78);
      ctx.rotate(-20 * Math.PI / 180);
      let s = 1.8 - Math.abs(Math.sin((performance.now() % 1000) / 1000 * Math.PI * 2) * 0.1);
      s = s * 100 / (F.width(this.splash) + 32) * Math.min(1, L.w / 260);
      ctx.scale(s, s);
      F.drawCentered(ctx, this.splash, 0, -8, '#FFFF00');
      ctx.restore();
      G.text('DreamLand Alpha v1.2.6', 2 + G.safe.l, 2 + G.safe.t, '#505050', false);
      G.text('DreamLand Alpha v1.2.6', 2 + G.safe.l, 2 + G.safe.t, '#FFFFFF');
      const c = 'Not affiliated with Mojang. A fan tribute.';
      G.text(c, G.W - F.width(c) - 2 - G.safe.r, G.H - 10 - G.safe.b, '#FFFFFF');
      this.drawWidgets(mx, my);
    }
    key() { }
    back() { }
  }
  G.TitleScreen = TitleScreen;

  /* ------------------------------------------------------------ */
  /* Select / create world                                        */
  /* ------------------------------------------------------------ */
  class SelectWorldScreen extends Screen {
    constructor(game, parent) { super(game, parent); this.worlds = {}; this.deleting = false; this.load(); }
    get pauses() { return false; }
    get showWorld() { return false; }
    async load() {
      const list = await DL.Storage.listWorlds();
      this.worlds = {};
      for (const w of list) if (w && w.slot) this.worlds[w.slot] = w;
      this.layout();
    }
    layout() {
      this.widgets = [];
      const cx = G.W / 2;
      const top = Math.max(30, G.H / 6);
      for (let i = 1; i <= 5; i++) {
        const w = this.worlds[i];
        const label = w ? (w.name || 'World ' + i) + ' (' + ((w.size || 0) / 1024 / 1024 * 0.2 + 0.1).toFixed(1) + ' MB)' : '- empty -';
        this.btn(label, cx - 100, top + (i - 1) * 24, 200, 20, () => {
          if (this.deleting) {
            if (!w) return;
            this.game.setScreen(new ConfirmScreen(this.game, this, 'Are you sure you want to delete this world?', "'" + (w.name || 'World ' + i) + "' will be lost forever!", async (ok) => {
              if (ok) { await DL.Storage.deleteWorld(i); }
              this.deleting = false;
              this.load();
            }));
            return;
          }
          if (w) this.game.startWorld(i, w);
          else this.game.setScreen(new CreateWorldScreen(this.game, this, i));
        }, { enabled: !this.deleting || !!w });
      }
      this.btn(this.deleting ? 'Cancel deletion' : 'Delete world...', cx - 100, top + 5 * 24 + 12, 200, 20, () => { this.deleting = !this.deleting; this.layout(); });
      this.btn('Cancel', cx - 100, top + 6 * 24 + 12, 200, 20, () => this.back());
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 0;
    }
    draw(mx, my) {
      G.textC(this.deleting ? 'Delete world' : 'Select world', G.W / 2, Math.max(30, G.H / 6) - 18, '#FFFFFF');
      this.drawWidgets(mx, my);
    }
  }
  class CreateWorldScreen extends Screen {
    constructor(game, parent, slot) { super(game, parent); this.slot = slot; this.nameVal = 'New World'; this.seedVal = ''; }
    get pauses() { return false; }
    get showWorld() { return false; }
    layout() {
      const cx = G.W / 2, y = G.H / 4;
      const old = this.widgets;
      this.widgets = [];
      this.name = { type: 'field', x: cx - 100, y: y + 12, w: 200, h: 20, value: old.length ? old[0].value : this.nameVal, max: 32 };
      this.seed = { type: 'field', x: cx - 100, y: y + 50, w: 200, h: 20, value: old.length ? old[1].value : this.seedVal, max: 32, placeholder: 'Leave blank for a random seed' };
      this.name.onEnter = () => this.create();
      this.seed.onEnter = () => this.create();
      this.widgets.push(this.name, this.seed);
      this.btn('Create New World', cx - 100, y + 96, 200, 20, () => this.create());
      this.btn('Cancel', cx - 100, y + 120, 200, 20, () => this.back());
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 2;
    }
    create() {
      DL.Input.textInput.blur();
      let seed;
      const s = this.seed.value.trim();
      if (!s) seed = (Math.random() * 0x7fffffff) | 0;
      else if (/^-?\d+$/.test(s)) seed = parseInt(s, 10) | 0;
      else { seed = 0; for (let i = 0; i < s.length; i++) seed = (Math.imul(31, seed) + s.charCodeAt(i)) | 0; }
      this.game.createWorld(this.slot, this.name.value.trim() || 'World ' + this.slot, seed);
    }
    draw(mx, my) {
      const cx = G.W / 2, y = G.H / 4;
      G.textC('Create New World', cx, y - 20, '#FFFFFF');
      G.text('World Name', cx - 100, y, '#A0A0A0');
      G.text('Seed for the World Generator', cx - 100, y + 38, '#A0A0A0');
      this.drawWidgets(mx, my);
    }
  }
  class ConfirmScreen extends Screen {
    constructor(game, parent, l1, l2, cb) { super(game, parent); this.l1 = l1; this.l2 = l2; this.cb = cb; }
    get pauses() { return this.parent ? this.parent.pauses : false; }
    get showWorld() { return this.parent ? this.parent.showWorld : false; }
    layout() {
      this.widgets = [];
      this.btn('Yes', G.W / 2 - 155, G.H / 6 + 96, 150, 20, () => { this.game.setScreen(this.parent); this.cb(true); });
      this.btn('No', G.W / 2 + 5, G.H / 6 + 96, 150, 20, () => { this.game.setScreen(this.parent); this.cb(false); });
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 1;
    }
    draw(mx, my) {
      if (this.showWorld) G.dim();
      G.textC(this.l1, G.W / 2, 70, '#FFFFFF');
      G.textC(this.l2, G.W / 2, 90, '#FFFFFF');
      this.drawWidgets(mx, my);
    }
  }
  G.ConfirmScreen = ConfirmScreen;

  /* ------------------------------------------------------------ */
  /* Options                                                      */
  /* ------------------------------------------------------------ */
  const RENDER_DISTS = [{ n: 'FAR', v: 12 }, { n: 'NORMAL', v: 8 }, { n: 'SHORT', v: 5 }, { n: 'TINY', v: 3 }];
  G.RENDER_DISTS = RENDER_DISTS;
  const DIFFS = ['Peaceful', 'Easy', 'Normal', 'Hard'];
  const GUI_SCALES = ['Auto', 'Small', 'Normal', 'Large'];
  class OptionsScreen extends Screen {
    get pauses() { return true; }
    layout() {
      this.widgets = [];
      const st = this.game.settings;
      const cx = G.W / 2;
      const y0 = Math.max(24, G.H / 6 - 12);
      const col = (i) => cx - 155 + (i % 2) * 160;
      const row = (i) => y0 + 24 * (i >> 1);
      const opts = [
        { slider: true, label: () => 'Music: ' + (st.music ? Math.round(st.music * 100) + '%' : 'OFF'), value: st.music, set: v => { st.music = v; this.game.applySettings(); } },
        { slider: true, label: () => 'Sound: ' + (st.sound ? Math.round(st.sound * 100) + '%' : 'OFF'), value: st.sound, set: v => { st.sound = v; this.game.applySettings(); } },
        { label: () => 'Invert Mouse: ' + OPT_TOGGLE(st.invertMouse), click: () => { st.invertMouse = !st.invertMouse; } },
        { slider: true, label: () => 'Sensitivity: ' + (st.sensitivity === 0 ? '*yawn*' : st.sensitivity === 1 ? 'HYPERSPEED!!!' : Math.round(st.sensitivity * 200) + '%'), value: st.sensitivity, set: v => { st.sensitivity = v; } },
        { label: () => 'Render distance: ' + RENDER_DISTS[st.renderDist].n, click: () => { st.renderDist = (st.renderDist + 1) % 4; this.game.applySettings(); } },
        { label: () => 'View bobbing: ' + OPT_TOGGLE(st.bobbing), click: () => { st.bobbing = !st.bobbing; } },
        { label: () => '3D anaglyph: ' + OPT_TOGGLE(st.anaglyph), click: () => { st.anaglyph = !st.anaglyph; } },
        { label: () => 'Limit framerate: ' + OPT_TOGGLE(st.limitFps), click: () => { st.limitFps = !st.limitFps; } },
        { label: () => 'Difficulty: ' + DIFFS[st.difficulty], click: () => { st.difficulty = (st.difficulty + 1) % 4; this.game.applySettings(); } },
        { label: () => 'Graphics: ' + (st.fancy ? 'FANCY' : 'FAST'), click: () => { st.fancy = !st.fancy; this.game.applySettings(true); } },
        { label: () => 'Smooth Lighting: ' + OPT_TOGGLE(st.smooth), click: () => { st.smooth = !st.smooth; this.game.applySettings(true); } },
        { label: () => 'GUI Scale: ' + GUI_SCALES[st.guiScale], click: () => { st.guiScale = (st.guiScale + 1) % 4; this.game.applySettings(); } },
        { slider: true, label: () => 'FOV: ' + (st.fov === 0.5 ? 'Normal' : st.fov >= 1 ? 'Quake Pro' : Math.round(30 + st.fov * 80)), value: st.fov, set: v => { st.fov = v; } },
        { slider: true, label: () => 'Brightness: ' + (st.gamma === 0 ? 'Moody' : st.gamma === 1 ? 'Bright' : '+' + Math.round(st.gamma * 100) + '%'), value: st.gamma, set: v => { st.gamma = v; } },
        { label: () => 'Clouds: ' + OPT_TOGGLE(st.clouds), click: () => { st.clouds = !st.clouds; } },
        { label: () => 'Show FPS: ' + OPT_TOGGLE(st.showFps), click: () => { st.showFps = !st.showFps; } }
      ];
      opts.forEach((o, i) => {
        if (o.slider) {
          this.widgets.push({ type: 'slider', x: col(i), y: row(i), w: 150, h: 20, value: o.value, label: o.label, onChange: (v) => { o.set(v); this.game.saveSettings(); } });
        } else {
          const b = this.btn('', col(i), row(i), 150, 20, () => { o.click(); b.label = o.label(); this.game.saveSettings(); });
          b.label = o.label();
        }
      });
      const by = row(opts.length) + 4;
      this.btn('Controls...', cx - 155, by, 150, 20, () => this.game.setScreen(new ControlsScreen(this.game, this)));
      this.btn('Touch & Controller...', cx + 5, by, 150, 20, () => this.game.setScreen(new DeviceOptionsScreen(this.game, this)));
      this.btn('Done', cx - 100, Math.min(G.H - 24, by + 28), 200, 20, () => { this.game.saveSettings(); this.back(); });
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 0;
    }
    draw(mx, my) {
      if (this.showWorld) G.dim();
      G.textC('Options', G.W / 2, Math.max(8, G.H / 6 - 32), '#FFFFFF');
      this.drawWidgets(mx, my);
    }
  }
  G.OptionsScreen = OptionsScreen;

  class DeviceOptionsScreen extends Screen {
    layout() {
      this.widgets = [];
      const st = this.game.settings;
      const cx = G.W / 2, y0 = Math.max(30, G.H / 6);
      const TC = ['AUTO', 'ON', 'OFF'];
      const RS = [0.5, 0.75, 1, 1.5, 2];
      const opts = [
        { label: () => 'Touch Controls: ' + TC[st.touchControls], click: () => { st.touchControls = (st.touchControls + 1) % 3; } },
        { slider: true, label: () => 'Touch Button Size: ' + Math.round(50 + st.touchSize * 100) + '%', value: st.touchSize, set: v => { st.touchSize = v; } },
        { slider: true, label: () => 'Touch Look Speed: ' + Math.round(st.touchSens * 200) + '%', value: st.touchSens, set: v => { st.touchSens = v; } },
        { slider: true, label: () => 'Controller Look Speed: ' + Math.round(st.padSens * 200) + '%', value: st.padSens, set: v => { st.padSens = v; } },
        { label: () => 'Controller Invert Y: ' + OPT_TOGGLE(st.padInvert), click: () => { st.padInvert = !st.padInvert; } },
        { label: () => 'Haptics / Rumble: ' + OPT_TOGGLE(st.haptics), click: () => { st.haptics = !st.haptics; this.game.applySettings(); DL.Input.haptic('hit', true); } },
        { label: () => 'Resolution: ' + Math.round(RS[st.resScale] * 100) + '%', click: () => { st.resScale = (st.resScale + 1) % RS.length; this.game.applySettings(); } },
        { label: () => 'Auto-jump (touch): ' + OPT_TOGGLE(st.autoJump), click: () => { st.autoJump = !st.autoJump; } }
      ];
      opts.forEach((o, i) => {
        const x = cx - 155 + (i % 2) * 160, y = y0 + 24 * (i >> 1);
        if (o.slider) this.widgets.push({ type: 'slider', x, y, w: 150, h: 20, value: o.value, label: o.label, onChange: (v) => { o.set(v); this.game.saveSettings(); } });
        else { const b = this.btn(o.label(), x, y, 150, 20, () => { o.click(); b.label = o.label(); this.game.saveSettings(); }); }
      });
      this.btn('Done', cx - 100, y0 + 24 * 4 + 12, 200, 20, () => this.back());
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 0;
    }
    draw(mx, my) {
      if (this.showWorld) G.dim();
      G.textC('Touch & Controller Settings', G.W / 2, Math.max(12, G.H / 6 - 20), '#FFFFFF');
      const pad = DL.Input.gp.connected ? 'Controller: ' + DL.Input.gp.id.slice(0, 48) : 'No controller detected - press any button';
      G.textC(pad, G.W / 2, Math.max(30, G.H / 6) + 24 * 4 + 40, '#A0A0A0');
      this.drawWidgets(mx, my);
    }
  }

  class ControlsScreen extends Screen {
    layout() {
      this.widgets = [];
      const cx = G.W / 2, y0 = Math.max(24, G.H / 6 - 8);
      const acts = Object.keys(DL.Input.DEFAULT_BINDS);
      acts.forEach((a, i) => {
        const x = cx - 155 + (i % 2) * 160, y = y0 + 22 * (i >> 1);
        const b = this.btn('', x + 80, y, 70, 20, () => { this.waiting = a; this.refresh(); });
        b.action = a;
      });
      this.btn('Reset to defaults', cx - 100, y0 + 22 * Math.ceil(acts.length / 2) + 6, 200, 20, () => { DL.Input.binds = Object.assign({}, DL.Input.DEFAULT_BINDS); this.game.settings.binds = DL.Input.binds; this.game.saveSettings(); this.refresh(); });
      this.btn('Done', cx - 100, y0 + 22 * Math.ceil(acts.length / 2) + 30, 200, 20, () => this.back());
      this.refresh();
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 0;
    }
    refresh() { for (const b of this.widgets) if (b.action) b.label = this.waiting === b.action ? '> ??? <' : DL.Input.keyName(DL.Input.binds[b.action]); }
    key(code) {
      if (this.waiting) {
        if (code !== 'Escape') { DL.Input.binds[this.waiting] = code; this.game.settings.binds = DL.Input.binds; this.game.saveSettings(); }
        this.waiting = null; this.refresh(); return;
      }
      super.key(code);
    }
    draw(mx, my) {
      if (this.showWorld) G.dim();
      const y0 = Math.max(24, G.H / 6 - 8);
      G.textC('Controls', G.W / 2, y0 - 16, '#FFFFFF');
      for (const b of this.widgets) if (b.action) G.text(DL.Input.BIND_NAMES[b.action], b.x - 78, b.y + 6, '#FFFFFF');
      this.drawWidgets(mx, my);
    }
  }

  class HelpScreen extends Screen {
    constructor(game, parent) { super(game, parent); this.page = DL.Input.lastDevice === 'touch' ? 1 : DL.Input.lastDevice === 'gamepad' ? 2 : 0; }
    get pauses() { return true; }
    get showWorld() { return this.parent ? this.parent.showWorld : false; }
    layout() {
      this.widgets = [];
      const cx = G.W / 2;
      ['Keyboard', 'Touch', 'Controller'].forEach((n, i) => this.btn(n, cx - 150 + i * 102, 24, 96, 20, () => { this.page = i; }));
      this.btn('Done', cx - 100, G.H - 28, 200, 20, () => this.back());
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 2;
    }
    draw(mx, my) {
      if (this.showWorld) G.dim();
      G.textC('Help & Controls', G.W / 2, 8, '#FFFFFF');
      const B = DL.Input.binds, K = DL.Input.keyName;
      const pages = [
        [`${K(B.forward)}${K(B.left)}${K(B.back)}${K(B.right)} - Move`, `${K(B.jump)} - Jump / swim up`, `${K(B.sneak)} - Sneak (won't fall off edges)`,
          'Mouse - Look around', 'Left click - Break blocks / attack', 'Right click - Place blocks / use items',
          'Middle click - Pick block', `1-9 / Wheel - Select hotbar slot`, `${K(B.inventory)} - Inventory & crafting`, `${K(B.drop)} - Drop item`,
          `${K(B.chat)} - Chat and /commands`, `${K(B.perspective)} - Third person view`, `${K(B.debug)} - Debug info   ${K(B.fog)} - Render distance`,
          `${K(B.screenshot)} - Screenshot   ${K(B.hideGui)} - Hide GUI   F11 - Fullscreen`, 'ESC - Game menu'],
        ['Left stick - Move (drag anywhere on the left side)', 'Drag on the right side - Look around', 'Tap - Place block / use item / attack',
          'Hold still - Break the block under the crosshair', 'Jump button - Jump / swim (double arrow)', 'Sneak button - Toggle sneaking',
          'Tap a hotbar slot - Select it', 'Hold a hotbar slot - Drop that item', 'Inventory button (...) - Crafting and items',
          'In menus: tap = click, hold = right click (split stacks)', 'Pause button (top right) - Game menu', 'Tip: Add to Home Screen for fullscreen on iOS'],
        ['Left stick - Move / move cursor in menus', 'Right stick - Look around', 'A - Jump / confirm', 'B - Drop item / back',
          'X - Use item (alt)   Y - Inventory', 'RT - Break / attack   LT - Place / use', 'LB / RB - Cycle hotbar', 'Right stick click - Sneak toggle',
          'D-pad up - Perspective   D-pad down - Drop stack', 'View button - Chat   Menu button - Pause',
          'In inventory: A pick/place, X place one, Y quick move', 'Rumble & trigger haptics supported (Xbox, DualSense)']
      ];
      const lines = pages[this.page];
      let y = 52;
      for (const l of lines) { G.textC(l, G.W / 2, y, '#E0E0E0'); y += 11; }
      this.drawWidgets(mx, my);
    }
  }
  G.HelpScreen = HelpScreen;

  /* ------------------------------------------------------------ */
  /* Loading                                                      */
  /* ------------------------------------------------------------ */
  class LoadingScreen extends Screen {
    constructor(game) { super(game); this.title = 'Generating level'; this.status = 'Building terrain'; this.progress = 0; }
    get pauses() { return false; }
    get showWorld() { return false; }
    draw() {
      const cx = G.W / 2, cy = G.H / 2;
      G.textC(this.title, cx, cy - 4 - 16, '#FFFFFF');
      G.textC(this.status, cx, cy - 4 + 8, '#FFFFFF');
      if (this.progress >= 0) {
        const x = cx - 50, y = cy + 16;
        G.rect(x, y, 100, 2, '#808080');
        G.rect(x, y, Math.round(100 * Math.min(1, this.progress)), 2, '#80FF80');
      }
    }
    key() { }
    back() { }
    padButton() { }
  }
  G.LoadingScreen = LoadingScreen;

  /* ------------------------------------------------------------ */
  /* Pause & death                                                */
  /* ------------------------------------------------------------ */
  class PauseScreen extends Screen {
    layout() {
      this.widgets = [];
      const cx = G.W / 2, y = G.H / 4 + 8;
      this.btn('Back to game', cx - 100, y + 24, 200, 20, () => this.game.setScreen(null));
      this.btn('Options...', cx - 100, y + 48 + 8, 98, 20, () => this.game.setScreen(new OptionsScreen(this.game, this)));
      this.btn('Help', cx + 2, y + 48 + 8, 98, 20, () => this.game.setScreen(new HelpScreen(this.game, this)));
      this.btn('Save and quit to title', cx - 100, y + 96, 200, 20, () => this.game.quitToTitle());
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 0;
    }
    draw(mx, my) {
      G.dim();
      G.textC('Game menu', G.W / 2, 40, '#FFFFFF');
      if (this.game.saveIndicator > 0) G.text('Saving level..', 8, G.H - 16, '#FFFFFF');
      this.drawWidgets(mx, my);
    }
    key(code) { if (code === 'Escape') this.game.setScreen(null); }
    back() { this.game.setScreen(null); }
  }
  G.PauseScreen = PauseScreen;

  class DeathScreen extends Screen {
    get pauses() { return false; }
    layout() {
      this.widgets = [];
      const cx = G.W / 2;
      this.btn('Respawn', cx - 100, G.H / 4 + 72, 200, 20, () => this.game.respawn());
      this.btn('Title menu', cx - 100, G.H / 4 + 96, 200, 20, () => this.game.quitToTitle());
      this.t0 = performance.now();
      if (this.focus < 0 && DL.Input.lastDevice === 'gamepad') this.focus = 0;
    }
    draw(mx, my) {
      G.gradient(0, 0, G.W, G.H, 'rgba(80,0,0,0.38)', 'rgba(128,48,48,0.63)');
      const ctx = G.ctx;
      ctx.save(); ctx.scale(2, 2);
      F.drawCentered(ctx, 'Game over!', G.W / 4, 30, '#FFFFFF');
      ctx.restore();
      G.textC('Score: §e' + this.game.player.score, G.W / 2, 100, '#FFFFFF');
      const en = performance.now() - this.t0 > 1000;
      for (const w of this.widgets) w.enabled = en;
      this.drawWidgets(mx, my);
    }
    key() { }
    back() { }
  }
  G.DeathScreen = DeathScreen;

  /* ------------------------------------------------------------ */
  /* Chat                                                         */
  /* ------------------------------------------------------------ */
  class ChatScreen extends Screen {
    constructor(game, initial) { super(game); this.value = initial || ''; this.histIdx = -1; }
    get pauses() { return false; }
    open() {
      this.layout();
      const ti = DL.Input.textInput;
      ti.value = this.value; ti.style.pointerEvents = 'auto';
      setTimeout(() => { ti.focus(); ti.setSelectionRange(ti.value.length, ti.value.length); }, 0);
    }
    close() { DL.Input.textInput.blur(); DL.Input.textInput.style.pointerEvents = 'none'; }
    textInput(v) { this.value = v.slice(0, 100); }
    textKey(k) {
      const hist = this.game.chatHistory;
      if (k === 'Enter') { const v = this.value.trim(); this.game.setScreen(null); if (v) this.game.chatSubmit(v); }
      else if (k === 'Escape') this.game.setScreen(null);
      else if (k === 'ArrowUp' && hist.length) { this.histIdx = Math.min(hist.length - 1, this.histIdx + 1); this.value = hist[hist.length - 1 - this.histIdx]; DL.Input.textInput.value = this.value; }
      else if (k === 'ArrowDown' && hist.length) { this.histIdx = Math.max(-1, this.histIdx - 1); this.value = this.histIdx < 0 ? '' : hist[hist.length - 1 - this.histIdx]; DL.Input.textInput.value = this.value; }
    }
    draw() {
      G.rect(2, G.H - 14 - G.safe.b, G.W - 4, 12, 'rgba(0,0,0,0.5)');
      const caret = Math.floor(performance.now() / 300) % 2 === 0 ? '_' : '';
      G.text('> ' + this.value + caret, 4, G.H - 12 - G.safe.b, '#E0E0E0');
    }
    mouseDown() { DL.Input.textInput.focus(); }
    key(code) { if (code === 'Escape') this.game.setScreen(null); }
    padButton(b) { if (b === DL.Input.GPB.B) this.game.setScreen(null); }
  }
  G.ChatScreen = ChatScreen;

  /* ------------------------------------------------------------ */
  /* Containers                                                   */
  /* ------------------------------------------------------------ */
  class ContainerScreen extends Screen {
    constructor(game) {
      super(game);
      this.slots = [];
      this.pw = 176; this.ph = 166;
      this.cursorPos = null;
    }
    get pauses() { return false; }
    get player() { return this.game.player; }
    layout() {
      this.px = Math.floor((G.W - this.pw) / 2); this.py = Math.floor((G.H - this.ph) / 2);
      this.slots = [];
      this.buildSlots();
      if (DL.Input.lastDevice === 'gamepad' && !this.cursorPos) {
        const s = this.slots.find(s => s.inv && s.index === this.player.selected) || this.slots[0];
        this.cursorPos = { x: this.px + s.x + 8, y: this.py + s.y + 8 };
      }
    }
    addInventorySlots(yBase) {
      const p = this.player;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) {
        const i = 9 + r * 9 + c;
        this.slots.push({ x: 8 + c * 18, y: yBase + r * 18, get: () => p.inv[i], set: (s) => { p.inv[i] = s; }, inv: true, index: i, main: true });
      }
      for (let c = 0; c < 9; c++) this.slots.push({ x: 8 + c * 18, y: yBase + 58, get: () => p.inv[c], set: (s) => { p.inv[c] = s; }, inv: true, index: c, hotbar: true });
    }
    slotAt(x, y) {
      for (const s of this.slots) {
        const sx = this.px + s.x, sy = this.py + s.y, sz = s.big ? 24 : 16;
        const o = s.big ? 4 : 0;
        if (x >= sx - 1 - o && y >= sy - 1 - o && x < sx + sz + 1 - o && y < sy + sz + 1 - o) return s;
      }
      return null;
    }
    drawSlots(mx, my) {
      for (const s of this.slots) {
        const sx = this.px + s.x, sy = this.py + s.y;
        if (s.big) G.bigSlot(sx - 5, sy - 5); else G.slot(sx - 1, sy - 1);
        if (!s.get() && s.ghost) s.ghost(sx, sy);
      }
      for (const s of this.slots) {
        const st = s.get();
        if (st) G.drawItem(st, this.px + s.x, this.py + s.y);
      }
      const h = this.slotAt(mx, my);
      if (h) {
        G.rect(this.px + h.x, this.py + h.y, 16, 16, 'rgba(255,255,255,0.5)');
        const st = h.get();
        if (st && !this.player.cursor) G.tooltip = { text: I().name(st.id), x: mx, y: my };
      }
    }
    drawCursorItem(mx, my) {
      const c = this.player.cursor;
      if (c) G.drawItem(c, mx - 8, my - 8);
      if (G.tooltip) {
        const t = G.tooltip;
        const w = F.width(t.text);
        let tx = t.x + 12, ty = t.y - 12;
        if (tx + w + 6 > G.W) tx = t.x - w - 12;
        G.rect(tx - 3, ty - 4, w + 6, 16, 'rgba(16,0,16,0.94)');
        G.rect(tx - 3, ty - 4, w + 6, 1, '#5000FF'); G.rect(tx - 3, ty + 11, w + 6, 1, '#28007F');
        G.text(t.text, tx, ty, '#FFFFFF');
        G.tooltip = null;
      }
      if (DL.Input.lastDevice === 'gamepad' && this.cursorPos) {
        const x = Math.round(this.cursorPos.x), y = Math.round(this.cursorPos.y);
        G.rect(x - 1, y - 5, 2, 10, '#000'); G.rect(x - 5, y - 1, 10, 2, '#000');
        G.rect(x, y - 4, 1, 8, '#FFF'); G.rect(x - 4, y, 8, 1, '#FFF');
      }
    }
    draw(mx, my) {
      if (DL.Input.lastDevice === 'gamepad' && this.cursorPos) { mx = this.cursorPos.x; my = this.cursorPos.y; }
      G.dim();
      this.drawBackground(mx, my);
      this.drawSlots(mx, my);
      this.drawForeground(mx, my);
      this.drawCursorItem(mx, my);
    }
    drawBackground() { }
    drawForeground() { }
    mouseDown(x, y, button, shift) {
      const p = this.player;
      const s = this.slotAt(x, y);
      const inside = x >= this.px && y >= this.py && x < this.px + this.pw && y < this.py + this.ph;
      if (!s) {
        if (!inside && p.cursor) {
          if (button === 0) { p.dropItem(p.cursor); p.cursor = null; }
          else if (button === 2) { p.dropItem(I().stack(p.cursor.id, 1, p.cursor.dmg)); p.cursor.count--; if (p.cursor.count <= 0) p.cursor = null; }
        }
        return;
      }
      this.clickSlot(s, button, shift);
    }
    clickSlot(s, button, shift) {
      const p = this.player;
      const st = s.get();
      if (s.output) {
        if (!st) return;
        if (shift) { this.craftAll(s); return; }
        if (!p.cursor) { p.cursor = I().copy(st); s.take(st); }
        else if (I().same(p.cursor, st) && p.cursor.count + st.count <= I().maxStack(st.id)) { p.cursor.count += st.count; s.take(st); }
        this.onChanged();
        return;
      }
      if (shift) { this.quickMove(s); this.onChanged(); return; }
      const accept = (c) => !s.accept || s.accept(c);
      const max = (id) => Math.min(I().maxStack(id), s.max || 64);
      if (button === 0) {
        if (!p.cursor) { if (st) { p.cursor = st; s.set(null); } }
        else if (!st) { if (accept(p.cursor)) { const n = Math.min(p.cursor.count, max(p.cursor.id)); s.set(I().stack(p.cursor.id, n, p.cursor.dmg)); p.cursor.count -= n; if (p.cursor.count <= 0) p.cursor = null; } }
        else if (I().same(st, p.cursor)) {
          const n = Math.min(p.cursor.count, max(st.id) - st.count);
          st.count += n; p.cursor.count -= n; if (p.cursor.count <= 0) p.cursor = null;
        } else if (accept(p.cursor) && p.cursor.count <= max(p.cursor.id)) { s.set(p.cursor); p.cursor = st; }
      } else if (button === 2) {
        if (!p.cursor) { if (st) { const n = Math.ceil(st.count / 2); p.cursor = I().stack(st.id, n, st.dmg); st.count -= n; if (st.count <= 0) s.set(null); } }
        else if (!st) { if (accept(p.cursor)) { s.set(I().stack(p.cursor.id, 1, p.cursor.dmg)); p.cursor.count--; if (p.cursor.count <= 0) p.cursor = null; } }
        else if (I().same(st, p.cursor)) { if (st.count < max(st.id)) { st.count++; p.cursor.count--; if (p.cursor.count <= 0) p.cursor = null; } }
        else if (accept(p.cursor)) { s.set(p.cursor); p.cursor = st; }
      }
      this.onChanged();
      DL.Input.haptic('tick');
    }
    moveInto(stack, targets) {
      const max = I().maxStack(stack.id);
      for (const t of targets) {
        const ts = t.get();
        if (ts && I().same(ts, stack) && ts.count < max) {
          const n = Math.min(stack.count, max - ts.count);
          ts.count += n; stack.count -= n;
          if (stack.count <= 0) return true;
        }
      }
      for (const t of targets) {
        if (!t.get() && (!t.accept || t.accept(stack))) { t.set(I().copy(stack)); stack.count = 0; return true; }
      }
      return false;
    }
    quickMove(s) {
      const st = s.get();
      if (!st) return;
      let targets;
      if (!s.inv) targets = this.slots.filter(t => t.hotbar).reverse().concat(this.slots.filter(t => t.main).reverse());
      else {
        const cont = this.slots.filter(t => !t.inv && !t.output && !t.noQuick && (!t.accept || t.accept(st)));
        if (cont.length && this.quickToContainer) targets = cont;
        else targets = s.hotbar ? this.slots.filter(t => t.main) : this.slots.filter(t => t.hotbar);
      }
      this.moveInto(st, targets);
      if (st.count <= 0) s.set(null);
    }
    craftAll(s) {
      let guard = 64;
      while (guard-- > 0) {
        const st = s.get();
        if (!st) break;
        const copy = I().copy(st);
        const targets = this.slots.filter(t => t.hotbar).reverse().concat(this.slots.filter(t => t.main).reverse());
        // check space
        const test = targets.map(t => t.get() ? I().copy(t.get()) : null);
        if (!this.canFit(copy, targets)) break;
        this.moveInto(copy, targets);
        s.take(st);
        this.onChanged();
        void test;
      }
    }
    canFit(stack, targets) {
      let n = stack.count;
      const max = I().maxStack(stack.id);
      for (const t of targets) { const ts = t.get(); if (!ts) n -= max; else if (I().same(ts, stack)) n -= max - ts.count; if (n <= 0) return true; }
      return n <= 0;
    }
    onChanged() { }
    key(code) {
      const B = DL.Input.binds;
      if (code === 'Escape' || code === B.inventory) { this.game.setScreen(null); return; }
      const [mx, my] = [G.mouse.x, G.mouse.y];
      const s = this.slotAt(mx, my);
      if (s && code.startsWith('Digit')) {
        const n = parseInt(code.slice(5), 10) - 1;
        if (n >= 0 && n < 9 && !s.output) {
          const p = this.player;
          const a = s.get(), b = p.inv[n];
          if (!b || !s.accept || s.accept(b)) { s.set(b); p.inv[n] = a; this.onChanged(); }
        }
      }
      if (s && code === B.drop && s.get() && !s.output) {
        const st = s.get();
        this.player.dropItem(I().stack(st.id, 1, st.dmg));
        st.count--; if (st.count <= 0) s.set(null);
        this.onChanged();
      }
    }
    close() {
      const p = this.player;
      if (p.cursor) { const left = p.addItem(p.cursor); if (left) p.dropItem(left); p.cursor = null; }
      this.onClose();
    }
    onClose() { }
    returnGrid(grid) {
      const p = this.player;
      for (let i = 0; i < grid.length; i++) if (grid[i]) { const left = p.addItem(grid[i]); if (left) p.dropItem(left); grid[i] = null; }
    }
    padButton(b) {
      const P = DL.Input.GPB;
      const c = this.cursorPos || (this.cursorPos = { x: G.W / 2, y: G.H / 2 });
      if (b === P.A) this.mouseDown(c.x, c.y, 0, false);
      else if (b === P.X) this.mouseDown(c.x, c.y, 2, false);
      else if (b === P.Y) { const s = this.slotAt(c.x, c.y); if (s) this.clickSlot(s, 0, true); }
      else if (b === P.B) this.game.setScreen(null);
      else if (b >= P.UP && b <= P.RIGHT) this.snapCursor(b === P.LEFT ? -1 : b === P.RIGHT ? 1 : 0, b === P.UP ? -1 : b === P.DOWN ? 1 : 0);
      else if (b === P.LB || b === P.RB) {
        const s = this.slotAt(c.x, c.y);
        if (s && s.get()) { const st = s.get(); this.player.dropItem(I().stack(st.id, 1, st.dmg)); st.count--; if (st.count <= 0) s.set(null); this.onChanged(); }
      }
    }
    snapCursor(dx, dy) {
      const c = this.cursorPos;
      let best = null, bd = 1e9;
      for (const s of this.slots) {
        const sx = this.px + s.x + 8, sy = this.py + s.y + 8;
        const ddx = sx - c.x, ddy = sy - c.y;
        if (dx && (Math.sign(ddx) !== dx || Math.abs(ddx) < 4)) continue;
        if (dy && (Math.sign(ddy) !== dy || Math.abs(ddy) < 4)) continue;
        const d = dx ? Math.abs(ddx) + Math.abs(ddy) * 3 : Math.abs(ddy) + Math.abs(ddx) * 3;
        if (d < bd) { bd = d; best = [sx, sy]; }
      }
      if (best) { c.x = best[0]; c.y = best[1]; DL.Input.haptic('tick'); }
    }
    padCursor(ax, ay, dt) {
      if (!this.cursorPos) this.cursorPos = { x: G.W / 2, y: G.H / 2 };
      const c = this.cursorPos;
      const sp = 260 * dt;
      c.x = Math.max(0, Math.min(G.W - 1, c.x + ax * Math.abs(ax) * sp));
      c.y = Math.max(0, Math.min(G.H - 1, c.y + ay * Math.abs(ay) * sp));
      // magnetism when resting
      if (Math.abs(ax) + Math.abs(ay) < 0.05) {
        const s = this.slotAt(c.x, c.y);
        if (s) { const sx = this.px + s.x + 8, sy = this.py + s.y + 8; c.x += (sx - c.x) * 0.25; c.y += (sy - c.y) * 0.25; }
      }
    }
    drawLabel(s, x, y) { G.text(s, this.px + x, this.py + y, '#404040', false); }
  }
  G.ContainerScreen = ContainerScreen;

  function craftingSlots(scr, grid, size, ox, oy, rx, ry) {
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      const i = r * size + c;
      scr.slots.push({ x: ox + c * 18, y: oy + r * 18, get: () => grid[i], set: (s) => { grid[i] = s; scr.updateCraft(); }, craft: true, noQuick: true });
    }
    scr.slots.push({
      x: rx, y: ry, big: true, output: true, get: () => scr.result,
      take: () => {
        for (let i = 0; i < grid.length; i++) if (grid[i]) {
          const d = I().get(grid[i].id);
          if (d.returns === undefined && (grid[i].id === 335 || grid[i].id === 326 || grid[i].id === 327)) grid[i] = I().stack(325);
          else { grid[i].count--; if (grid[i].count <= 0) grid[i] = null; }
        }
        scr.updateCraft();
        DL.Input.haptic('place');
      }
    });
  }

  class InventoryScreen extends ContainerScreen {
    layout() { super.layout(); this.updateCraft(); }
    buildSlots() {
      const p = this.player;
      craftingSlots(this, p.craft, 2, 88, 26, 144, 36);
      for (let i = 0; i < 4; i++) {
        const k = i;
        this.slots.push({
          x: 8, y: 8 + i * 18, get: () => p.armor[k], set: (s) => { p.armor[k] = s; }, max: 1,
          accept: (s) => { const d = I().get(s.id); return d && d.armor && d.armor.slot === k; },
          ghost: (x, y) => { const t = DL.Tex.itemTile(['leather_helmet', 'leather_chestplate', 'leather_leggings', 'leather_boots'][k]); G.ctx.globalAlpha = 0.25; G.ctx.filter = 'grayscale(1) brightness(0.4)'; G.ctx.drawImage(DL.Tex.items, (t & 15) * 16, (t >> 4) * 16, 16, 16, x, y, 16, 16); G.ctx.filter = 'none'; G.ctx.globalAlpha = 1; },
          armorSlot: true
        });
      }
      this.addInventorySlots(84);
      this.quickToContainer = false;
    }
    quickMove(s) {
      const st = s.get();
      if (st && s.inv) {
        const d = I().get(st.id);
        if (d.armor) { const t = this.slots.find(t => t.armorSlot && t.accept(st) && !t.get()); if (t) { t.set(st); s.set(null); return; } }
      }
      super.quickMove(s);
    }
    updateCraft() { this.result = I().matchRecipe(this.player.craft, 2); }
    onClose() { this.returnGrid(this.player.craft); }
    drawBackground(mx, my) {
      G.panel(this.px, this.py, this.pw, this.ph);
      // player preview box
      const bx = this.px + 25, by = this.py + 7;
      G.rect(bx, by, 52, 72, '#000');
      this.preview = [bx + 1, by + 1, 50, 70];
      G.ctx.clearRect(bx + 1, by + 1, 50, 70);
      this.previewLook = [(mx - bx - 26) / 30, (my - by - 20) / 30];
      G.ctx.drawImage(DL.Tex.gui.arrow, this.px + 116, this.py + 36, 16, 12);
      this.drawLabel('Crafting', 86, 16);
    }
  }
  G.InventoryScreen = InventoryScreen;

  class CraftingScreen extends ContainerScreen {
    constructor(game, x, y, z) { super(game); this.grid = new Array(9).fill(null); this.pos = [x, y, z]; }
    layout() { super.layout(); this.updateCraft(); }
    buildSlots() { craftingSlots(this, this.grid, 3, 30, 17, 124, 35); this.addInventorySlots(84); this.quickToContainer = false; }
    updateCraft() { this.result = I().matchRecipe(this.grid, 3); }
    onClose() { this.returnGrid(this.grid); }
    drawBackground() {
      G.panel(this.px, this.py, this.pw, this.ph);
      G.ctx.drawImage(DL.Tex.gui.arrow, this.px + 90, this.py + 35, 22, 15);
      this.drawLabel('Crafting', 28, 6);
      this.drawLabel('Inventory', 8, this.ph - 94);
    }
  }
  G.CraftingScreen = CraftingScreen;

  class ChestScreen extends ContainerScreen {
    constructor(game, te, title) { super(game); this.te = te; this.title = title || 'Chest'; this.rows = Math.ceil(te.items.length / 9); this.ph = 114 + this.rows * 18; }
    buildSlots() {
      const items = this.te.items;
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < 9; c++) {
        const i = r * 9 + c;
        this.slots.push({ x: 8 + c * 18, y: 18 + r * 18, get: () => items[i], set: (s) => { items[i] = s; this.dirty(); } });
      }
      this.addInventorySlots(this.rows * 18 + 31);
      this.quickToContainer = true;
    }
    dirty() { const c = this.game.world.getChunk(this.te.x >> 4, this.te.z >> 4); if (c) c.needsSave = true; }
    onChanged() { this.dirty(); }
    onClose() { DL.Audio.play('chest', this.te.x + 0.5, this.te.y + 0.5, this.te.z + 0.5, 0.5, 0.9); }
    drawBackground() {
      G.panel(this.px, this.py, this.pw, this.ph);
      this.drawLabel(this.title, 8, 6);
      this.drawLabel('Inventory', 8, this.ph - 94);
    }
  }
  G.ChestScreen = ChestScreen;

  class FurnaceScreen extends ContainerScreen {
    constructor(game, te) { super(game); this.te = te; }
    buildSlots() {
      const it = this.te.items;
      this.slots.push({ x: 56, y: 17, get: () => it[0], set: (s) => { it[0] = s; this.dirty(); }, accept: (s) => true, furnaceIn: true });
      this.slots.push({ x: 56, y: 53, get: () => it[1], set: (s) => { it[1] = s; this.dirty(); }, accept: (s) => I().fuelTime(s.id) > 0 });
      this.slots.push({ x: 116, y: 35, big: true, output: true, get: () => it[2], take: (s) => { it[2] = null; this.dirty(); } });
      this.addInventorySlots(84);
      this.quickToContainer = true;
    }
    quickMove(s) {
      const st = s.get();
      if (st && s.inv) {
        const target = I().smeltResult(st.id) ? this.slots[0] : I().fuelTime(st.id) > 0 ? this.slots[1] : null;
        if (target) { this.moveInto(st, [target]); if (st.count <= 0) s.set(null); return; }
        const t2 = s.hotbar ? this.slots.filter(t => t.main) : this.slots.filter(t => t.hotbar);
        this.moveInto(st, t2); if (st.count <= 0) s.set(null);
        return;
      }
      super.quickMove(s);
    }
    craftAll(s) {
      const st = s.get(); if (!st) return;
      const targets = this.slots.filter(t => t.hotbar).reverse().concat(this.slots.filter(t => t.main).reverse());
      this.moveInto(st, targets);
      if (st.count <= 0) s.take();
    }
    dirty() { const c = this.game.world.getChunk(this.te.x >> 4, this.te.z >> 4); if (c) c.needsSave = true; }
    drawBackground() {
      G.panel(this.px, this.py, this.pw, this.ph);
      const te = this.te;
      const fx = this.px + 57, fy = this.py + 37;
      G.ctx.drawImage(DL.Tex.gui.flameEmpty, fx, fy, 14, 14);
      if (te.burn > 0 && te.burnMax > 0) {
        const h = Math.ceil(te.burn / te.burnMax * 13);
        G.ctx.drawImage(DL.Tex.gui.flame, 0, 14 - h, 14, h, fx, fy + 14 - h, 14, h);
      }
      const ax = this.px + 79, ay = this.py + 34;
      G.ctx.drawImage(DL.Tex.gui.arrow, ax, ay, 24, 16);
      const w = Math.floor(te.cook / 200 * 24);
      if (w > 0) G.ctx.drawImage(DL.Tex.gui.arrowFull, 0, 0, w, 16, ax, ay, w, 16);
      this.drawLabel('Furnace', 60, 6);
      this.drawLabel('Inventory', 8, this.ph - 94);
    }
  }
  G.FurnaceScreen = FurnaceScreen;

  /* ------------------------------------------------------------ */
  /* HUD                                                          */
  /* ------------------------------------------------------------ */
  G.drawHUD = function (game, pt) {
    const p = game.player;
    const W = G.W, H = G.H - G.safe.b;
    const ctx = G.ctx;
    const hx = Math.floor(W / 2 - 91), hy = H - 22;
    ctx.drawImage(DL.Tex.gui.hotbar, hx, hy);
    ctx.drawImage(DL.Tex.gui.hotbarSel, hx - 1 + p.selected * 20, hy - 1);
    for (let i = 0; i < 9; i++) {
      const s = p.inv[i];
      if (s) G.drawItem(s, hx + 3 + i * 20, hy + 3);
    }
    // hearts
    const flash = p.hurtResist > 10 && Math.floor(p.hurtResist / 3) % 2 === 1;
    const hp = Math.max(0, p.health), prev = game.prevHealth === undefined ? hp : game.prevHealth;
    const low = hp <= 4;
    const rng = game.hudRng;
    rng.setSeed(game.tickCount * 312871);
    const gy = H - 32;
    for (let i = 0; i < 10; i++) {
      let y = gy;
      if (low) y += rng.nextInt(2);
      const x = hx + i * 8;
      ctx.drawImage(flash ? DL.Tex.gui.heartEmptyFlash : DL.Tex.gui.heartEmpty, x, y);
      if (flash) {
        if (i * 2 + 1 < prev) ctx.drawImage(DL.Tex.gui.heartFullFlash, x, y);
        else if (i * 2 + 1 === prev) ctx.drawImage(DL.Tex.gui.heartHalfFlash, x, y);
      }
      if (i * 2 + 1 < hp) ctx.drawImage(DL.Tex.gui.heartFull, x, y);
      else if (i * 2 + 1 === hp) ctx.drawImage(DL.Tex.gui.heartHalf, x, y);
    }
    // armor
    const armor = p.armorValue();
    if (armor > 0) {
      for (let i = 0; i < 10; i++) {
        const x = hx + 182 - 9 - i * 8;
        const img = i * 2 + 1 < armor ? DL.Tex.gui.armorFull : i * 2 + 1 === armor ? DL.Tex.gui.armorHalf : DL.Tex.gui.armorEmpty;
        ctx.drawImage(img, x, gy);
      }
    }
    // air
    if (p.headInWater() && p.air < 300) {
      const full = Math.ceil((p.air - 2) * 10 / 300), part = Math.ceil(p.air * 10 / 300) - full;
      for (let i = 0; i < full + part; i++) {
        const x = hx + 182 - 9 - i * 8;
        ctx.drawImage(i < full ? DL.Tex.gui.bubble : DL.Tex.gui.bubblePop, x, gy - (armor > 0 ? 10 : 0));
      }
    }
    // held item name popup
    if (game.itemNameTimer > 0 && p.held) {
      const a = Math.min(1, game.itemNameTimer / 10);
      ctx.globalAlpha = a;
      G.textC(I().name(p.held.id), W / 2, hy - 38, '#FFFFFF');
      ctx.globalAlpha = 1;
    }
    // chat
    const now = performance.now();
    const chatOpen = G.screen instanceof ChatScreen;
    let cy = H - 48;
    for (let i = G.chat.length - 1; i >= 0 && i >= G.chat.length - (chatOpen ? 20 : 10); i--) {
      const m = G.chat[i];
      const age = (now - m.t) / 1000;
      let a = chatOpen ? 1 : age < 9 ? 1 : age < 10 ? 10 - age : 0;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      G.rect(2, cy - 1, 320, 9, 'rgba(0,0,0,0.5)');
      G.text(m.text, 4, cy, '#FFFFFF');
      ctx.globalAlpha = 1;
      cy -= 9;
    }
    if (game.settings.showFps && !game.debug) G.text(game.fps + ' fps', 2 + G.safe.l, 2 + G.safe.t, '#FFFFFF');
    if (game.debug) G.drawDebug(game);
    if (game.saveIndicator > 0) G.text('Saving level..', 8 + G.safe.l, G.H - 16 - G.safe.b - 40, '#FFFFFF');
    if (game.touchOn()) G.drawTouch(game);
  };

  G.drawDebug = function (game) {
    const p = game.player, w = game.world, r = game.renderer;
    const face = ['south (+Z)', 'west (-X)', 'north (-Z)', 'east (+X)'];
    const yawDeg = ((-p.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const fi = Math.floor((yawDeg + 180 + 45) / 90) % 4;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const c = w.getChunk(bx >> 4, bz >> 4);
    const biome = c && c.biomes ? DL.S.BIOME_NAMES[c.biomes[((bz & 15) << 4) | (bx & 15)]] : '?';
    const lines = [
      'DreamLand Alpha v1.2.6 (' + game.fps + ' fps, ' + w.stats.meshJobs + ' chunk updates)',
      'C: ' + r.stats.drawn + '/' + r.stats.sections + '. F: ' + Math.round(r.stats.faces) + ', Q: ' + w.dirtySections.size,
      'E: ' + w.entities.filter(e => !e.removed).length + '. P: ' + r.particles.length + '. L: ' + w.chunks.size + ' chunks',
      'Seed: ' + w.seed + '  Biome: ' + biome,
      'x: ' + p.x.toFixed(5), 'y: ' + p.y.toFixed(5), 'z: ' + p.z.toFixed(5),
      'f: ' + fi + ' (' + face[fi] + ')',
      'Light: ' + w.getSky(bx, by, bz) + ' sky, ' + w.getBlockLight(bx, by, bz) + ' block. Time: ' + (w.time % 24000),
      'GL: ' + (r.gl2 ? 'WebGL2' : 'WebGL1') + '  Input: ' + DL.Input.lastDevice
    ];
    let y = 2 + G.safe.t;
    for (const l of lines) { G.text(l, 2 + G.safe.l, y, '#E0E0E0'); y += 10; }
  };

  /* Touch overlay */
  G.touchLayout = function (game) {
    const st = game.settings;
    const k = 0.5 + st.touchSize;
    const W = G.W, H = G.H;
    const sz = Math.round(26 * k);
    const s = G.scale / G.dpr; // gui px -> css px
    const toCss = (r) => ({ id: r.id, x: r.x * s, y: r.y * s, w: r.w * s, h: r.h * s, gx: r.x, gy: r.y, gw: r.w, gh: r.h, icon: r.icon });
    const hx = Math.floor(W / 2 - 91), hy = H - 22 - G.safe.b;
    const rb = W - G.safe.r - 8, bb = H - G.safe.b - 8;
    const buttons = [
      { id: 'jump', x: rb - sz, y: bb - sz - 30, w: sz, h: sz, icon: 'jump' },
      { id: 'sneak', x: rb - sz * 2 - 6, y: bb - sz - 30 + sz * 0.25, w: sz, h: sz, icon: 'sneak' },
      { id: 'inventory', x: hx + 182 + 4, y: hy + 1, w: 20, h: 20, icon: 'dots' },
      { id: 'pause', x: rb - 20, y: 8 + G.safe.t, w: 20, h: 20, icon: 'pause' },
      { id: 'chat', x: rb - 44, y: 8 + G.safe.t, w: 20, h: 20, icon: 'chat' },
      { id: 'view', x: rb - 68, y: 8 + G.safe.t, w: 20, h: 20, icon: 'view' }
    ];
    return {
      buttons: buttons.map(toCss),
      hotbar: toCss({ x: hx, y: hy, w: 182, h: 22 }),
      joyZone: W * 0.42 * s,
      joyRadius: 30 * k * s,
      guiButtons: buttons, k
    };
  };
  G.drawTouch = function (game) {
    const L = G.touchLayout(game);
    const ctx = G.ctx;
    const T = DL.Input.touch;
    for (const b of L.guiButtons) {
      const pressed = (b.id === 'jump' && T.jump) || (b.id === 'sneak' && game.player.sneaking);
      G.rect(b.x, b.y, b.w, b.h, pressed ? 'rgba(160,160,160,0.55)' : 'rgba(40,40,40,0.4)');
      G.rect(b.x, b.y, b.w, 1, 'rgba(255,255,255,0.35)'); G.rect(b.x, b.y, 1, b.h, 'rgba(255,255,255,0.35)');
      G.rect(b.x, b.y + b.h - 1, b.w, 1, 'rgba(0,0,0,0.4)'); G.rect(b.x + b.w - 1, b.y, 1, b.h, 'rgba(0,0,0,0.4)');
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, u = b.w / 26;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      if (b.icon === 'jump') { for (let i = 0; i < 6; i++) ctx.fillRect(cx - i * u * 1.2, cy - 5 * u + i * u * 1.2, i * u * 2.4 + u, u * 1.2); ctx.fillRect(cx - u, cy + 2 * u, 2 * u, 5 * u); }
      else if (b.icon === 'sneak') { for (let i = 0; i < 6; i++) ctx.fillRect(cx - (5 - i) * u * 1.2, cy - 4 * u + i * u * 1.2, (5 - i) * u * 2.4 + u, u * 1.2); ctx.fillRect(cx - 6 * u, cy + 5 * u, 12 * u, 1.5 * u); }
      else if (b.icon === 'dots') { for (let i = -1; i <= 1; i++) ctx.fillRect(cx + i * 5 - 1, cy - 1, 2, 2); }
      else if (b.icon === 'pause') { ctx.fillRect(cx - 4, cy - 5, 3, 10); ctx.fillRect(cx + 1, cy - 5, 3, 10); }
      else if (b.icon === 'chat') { F.drawCentered(ctx, 'T', cx, cy - 4, '#FFFFFF'); }
      else if (b.icon === 'view') { ctx.fillRect(cx - 5, cy - 1, 10, 2); ctx.fillRect(cx - 3, cy - 3, 6, 6); ctx.fillStyle = '#333'; ctx.fillRect(cx - 1, cy - 1, 2, 2); }
    }
    // joystick
    const s = G.dpr / G.scale;
    if (T.joy) {
      const cx = T.joy.cx * s, cy = T.joy.cy * s, r = T.joy.r * s;
      ctx.fillStyle = 'rgba(40,40,40,0.35)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();
      let kx = T.joy.x * s - cx, ky = T.joy.y * s - cy;
      const l = Math.hypot(kx, ky);
      if (l > r) { kx = kx / l * r; ky = ky / l * r; }
      ctx.fillStyle = 'rgba(220,220,220,0.6)';
      ctx.beginPath(); ctx.arc(cx + kx, cy + ky, r * 0.45, 0, Math.PI * 2); ctx.fill();
    } else {
      const r = 30 * L.k;
      const cx = 16 + G.safe.l + r, cy = G.H - G.safe.b - 16 - r - 24;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    if (T.breaking && game.dig) {
      const p = Math.min(1, game.dig.progress);
      const cx = G.W / 2, cy = G.H / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 10, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
    }
  };
})();
