/*
 * DreamLand - game orchestration: boot, main loop, ticking, interaction,
 * effects, commands and persistence.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, M4 = DL.M4;
  const G = DL.GUI, In = DL.Input, E = DL.Entities, A = DL.Audio;
  const I = DL.Items;

  const IS_MOBILE = In.isTouchDevice && Math.min(screen.width, screen.height) < 820;
  const DEFAULTS = {
    music: 0.6, sound: 1, invertMouse: false, sensitivity: 0.5, renderDist: IS_MOBILE ? 2 : 1, bobbing: true, anaglyph: false,
    limitFps: false, difficulty: 2, fancy: !IS_MOBILE, smooth: true, guiScale: 0, fov: 0.5, gamma: 0.2, clouds: true, showFps: false,
    touchControls: 0, touchSize: 0.5, touchSens: 0.5, padSens: 0.5, padInvert: false, haptics: true, resScale: IS_MOBILE ? 1 : 2, autoJump: true, binds: null
  };
  const RES_SCALES = [0.5, 0.75, 1, 1.5, 2];
  const TICK = 50;
  const REACH = 4.5;

  class Game {
    constructor() {
      this.settings = Object.assign({}, DEFAULTS, DL.Storage.loadSettings() || {});
      if (this.settings.binds) In.binds = Object.assign({}, In.DEFAULT_BINDS, this.settings.binds);
      if (this.settings.padMaps && typeof this.settings.padMaps === 'object') In.padMaps = this.settings.padMaps;
      this.world = null; this.player = null; this.inGame = false;
      this.tickCount = 0; this.acc = 0; this.last = performance.now();
      this.fps = 0; this.frames = 0; this.fpsT = performance.now();
      this.collectAnims = [];
      this.hudRng = new S.RNG(1);
      this.chatHistory = [];
      this.debug = false; this.hideGui = false; this.thirdPerson = 0;
      this.dig = null; this.itemNameTimer = 0; this.saveIndicator = 0;
      this.useTimer = 0; this.breakDelay = 0;
      this.lookDX = 0; this.lookDY = 0;
      this.fogToggle = 0;
      this.shake = 0;
    }

    boot() {
      const glc = document.getElementById('gl'), uic = document.getElementById('ui');
      this.glCanvas = glc; this.uiCanvas = uic;
      DL.Tex.build();
      DL.Font.init();
      DL.Models.buildSkins();
      try {
        this.renderer = new DL.Renderer(glc);
      } catch (e) {
        document.getElementById('fatal').style.display = 'flex';
        document.getElementById('fatal').textContent = 'Sorry! Your browser or device does not support WebGL: ' + e.message;
        throw e;
      }
      this.renderer.loadTextures();
      G.init(uic);
      In.init(glc, uic);
      In.handler = (t, d) => this.onInput(t, d);
      In.gameTouchActive = () => this.inGame && !G.screen && this.touchOn();
      In.touchLayout = () => G.touchLayout(this);
      window.addEventListener('resize', () => this.resize());
      if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.inGame) { this.saveWorld(); if (!G.screen) this.setScreen(new G.PauseScreen(this)); }
      });
      window.addEventListener('pagehide', () => { if (this.inGame) this.saveWorld(); });
      const unlock = () => A.unlock();
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
      window.addEventListener('touchend', unlock, true);
      this.applySettings();
      this.resize();
      this.setScreen(new G.TitleScreen(this));
      document.getElementById('boot').style.display = 'none';
      requestAnimationFrame((t) => this.loop(t));
    }

    touchOn() {
      const s = this.settings.touchControls;
      if (s === 1) return true;
      if (s === 2) return false;
      return In.lastDevice === 'touch' || (In.isTouchDevice && In.lastDevice !== 'gamepad' && In.lastDevice !== 'kbm');
    }

    resize() {
      const vv = window.visualViewport;
      const w = window.innerWidth, h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const res = RES_SCALES[this.settings.resScale] || 1;
      const glScale = Math.min(dpr, 2) * res * (IS_MOBILE ? 0.85 : 1);
      this.renderer.resize(w, h, Math.max(0.25, Math.min(glScale, dpr * 1.5)));
      G.resize(w, h, dpr, this.settings.guiScale);
      void vv;
    }

    applySettings(remesh) {
      const st = this.settings;
      A.volume.sound = st.sound; A.volume.music = st.music;
      A.applyVolume();
      In.hapticsEnabled = st.haptics;
      if (this.world) {
        this.world.difficulty = st.difficulty;
        const rd = G.RENDER_DISTS[st.renderDist].v;
        if (this.world.renderDist !== rd) this.world.setRenderDistance(rd);
        if (remesh || this.world.fancy !== st.fancy || this.world.smooth !== st.smooth) {
          this.world.fancy = st.fancy; this.world.smooth = st.smooth;
          this.world.remeshAll();
        }
      }
      if (this.renderer) this.resize();
    }
    saveSettings() { this.settings.binds = In.binds; this.settings.padMaps = In.padMaps; DL.Storage.saveSettings(this.settings); }

    setScreen(s) {
      const old = G.screen;
      if (old && old.close) old.close();
      G.screen = s;
      if (s) {
        s.open();
        In.releaseLock();
        if (In.lastDevice === 'gamepad' && s.widgets && s.focus < 0) s.focus = s.widgets.findIndex(w => !w.hidden && w.enabled !== false);
      } else if (this.inGame) {
        In.requestLock();
        In.textInput.blur(); In.textInput.style.pointerEvents = 'none';
      }
      In.mouse.left = In.mouse.right = false;
    }

    toggleFullscreen() {
      const d = document, el = d.documentElement;
      try {
        if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
        else (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
      } catch (e) { /* ignore */ }
    }

    /* ---------------------------------------------------------- */
    /* World lifecycle                                            */
    /* ---------------------------------------------------------- */
    async createWorld(slot, name, seed, creative) {
      const meta = { slot, name, seed, time: 0, created: Date.now(), player: null, size: 0, creative: !!creative };
      await DL.Storage.deleteWorld(slot);
      await DL.Storage.putWorld(slot, meta);
      this.startWorld(slot, meta, true);
    }

    async startWorld(slot, meta, isNew) {
      const ls = new G.LoadingScreen(this);
      ls.title = isNew ? 'Generating level' : 'Loading level';
      ls.status = isNew ? 'Building terrain' : 'Loading chunks';
      this.setScreen(ls);
      this.loadingScreen = ls;
      const dim = meta.dim || 0;
      const wslot = DL.dimSlot(slot, dim);
      const keys = isNew ? [] : await DL.Storage.chunkKeys(wslot);
      const st = this.settings;
      const world = new DL.World({
        seed: meta.seed, slot: wslot, dim, name: meta.name, time: meta.time || 0, renderDist: G.RENDER_DISTS[st.renderDist].v,
        fancy: st.fancy, smooth: st.smooth, difficulty: st.difficulty, savedKeys: new Set(keys)
      });
      world.baseSlot = slot;
      if (dim === 2 && DL.Structures) DL.Structures.endFountain(world);
      this.world = world;
      this.meta = meta;
      this.hookWorld(world);
      const p = new E.Player(world, 0.5, 80, 0.5);
      this.player = p;
      world.player = p;
      world.entities.push(p);
      p.creative = !!meta.creative;
      world.timeFrozen = !!meta.timeFrozen;
      if (meta.player) { p.restore(meta.player); if (meta.player.dimSpawn) p.spawnPoint = meta.player.dimSpawn; }
      else {
        const sp = meta.spawn || this.findSpawn(world);
        meta.spawn = sp;
        p.setPos(sp[0], sp[1], sp[2]);
        p.spawnPoint = sp;
        p.yaw = Math.PI * 0.75;
      }
      if (!p.spawnPoint) p.spawnPoint = meta.spawn || [p.x, p.y, p.z];
      this.loading = { t0: performance.now(), isNew, phase: 0 };
      this.prevHealth = p.health;
      this.renderer.particles.length = 0;
      this.collectAnims.length = 0;
    }

    findSpawn(world) {
      const gen = world.gen;
      for (let r = 0; r < 24; r++) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const res = gen.generate(dx, dz);
          const cand = [];
          for (let x = 2; x < 14; x += 3) for (let z = 2; z < 14; z += 3) {
            let y = S.CH - 1;
            while (y > 0 && res.blocks[(y << 8) | (z << 4) | x] === 0) y--;
            const b = res.blocks[(y << 8) | (z << 4) | x];
            if ((b === B.grass || b === B.sand) && y >= S.SEA) cand.push([dx * 16 + x + 0.5, y + 1, dz * 16 + z + 0.5, b === B.grass ? 0 : 1]);
          }
          cand.sort((a, b) => a[3] - b[3]);
          if (cand.length) return cand[0].slice(0, 3);
        }
      }
      return [0.5, 90, 0.5];
    }

    hookWorld(world) {
      const r = this.renderer;
      world.onMeshReady = (s, m) => r.uploadSection(s, m);
      world.onChunkUnload = (c) => {
        r.freeChunk(c);
        for (const e of world.entities) {
          if (e === this.player || e.removed) continue;
          if (Math.floor(e.x / 16) === c.cx && Math.floor(e.z / 16) === c.cz) e.removed = true;
        }
      };
      world.collectChunkEntities = (c) => {
        const out = [];
        for (const e of world.entities) {
          if (e === this.player || e.removed) continue;
          if (Math.floor(e.x / 16) !== c.cx || Math.floor(e.z / 16) !== c.cz) continue;
          const d = e.serialize();
          if (d) out.push(d);
        }
        return out;
      };
      world.onChunkEntities = (c, list) => {
        for (const d of list) {
          if (d.type === 'item' || E.MOBS[d.type]) E.fromSave(world, d);
          else if (d.type && E.MOBS[d.type] === undefined && d.x !== undefined) { /* ignore */ }
        }
      };
      world.onSpawnItem = (x, y, z, stack, scatter) => {
        const e = new E.ItemEntity(world, x, y, z, I.copy(stack));
        if (scatter) {
          const f = 0.7;
          e.setPos(x + (Math.random() - 0.5) * f * 0.6, y + (Math.random() - 0.5) * f * 0.6, z + (Math.random() - 0.5) * f * 0.6);
          e.vx = (Math.random() - 0.5) * 0.2; e.vy = 0.2; e.vz = (Math.random() - 0.5) * 0.2;
        }
        world.entities.push(e);
      };
      world.onPrimeTNT = (x, y, z, fuse) => {
        world.entities.push(new E.PrimedTNT(world, x + 0.5, y, z + 0.5, fuse));
        A.play('fuse', x + 0.5, y + 0.5, z + 0.5, 1, 1);
      };
      world.onFallingBlock = (x, y, z, id) => { world.entities.push(new E.FallingBlock(world, x + 0.5, y, z + 0.5, id)); };
      world.onExplosionEntities = (x, y, z, power, src) => {
        const R = power * 2;
        for (const e of world.entities) {
          if (e.removed || e === src) continue;
          const dx = e.x - x, dy = e.y + (e.h || 0.5) / 2 - y, dz = e.z - z;
          const d = Math.hypot(dx, dy, dz);
          if (d > R || d < 1e-4) continue;
          // exposure: fraction of rays reaching the entity
          let seen = 0, tot = 0;
          const b = e.box || [e.x, e.y, e.z, e.x, e.y, e.z];
          for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) for (let k = 0; k <= 2; k++) {
            tot++;
            const px = b[0] + (b[3] - b[0]) * i / 2, py = b[1] + (b[4] - b[1]) * j / 2, pz = b[2] + (b[5] - b[2]) * k / 2;
            const hit = E.raycast(world, px, py, pz, x - px, y - py, z - pz, 1, false);
            if (!hit || !S.SOLID[hit.id] || !S.OPAQUE[hit.id]) seen++;
          }
          const impact = (1 - d / R) * (seen / tot);
          const kb = impact;
          e.vx += dx / d * kb; e.vy += dy / d * kb; e.vz += dz / d * kb;
          if (e.living) e.damage('explosion', Math.floor((impact * impact + impact) / 2 * 8 * power + 1), src);
          else if (e.type === 'item' && impact > 0.3) e.removed = true;
        }
      };
      world.fx = {
        sound: (n, x, y, z, v, p) => A.play(n, x, y, z, v, p),
        particles: (t, x, y, z, n, spread) => this.spawnParticles(t, x, y, z, n, spread),
        blockBroken: (x, y, z, id, meta) => this.breakEffects(x, y, z, id, meta),
        explosion: (x, y, z, power) => {
          A.play('explode', x, y, z, 4, (1 + (Math.random() - Math.random()) * 0.2) * 0.7);
          this.spawnParticles('explosion', x, y, z, Math.floor(power * 12), power);
          const d = Math.hypot(this.player.x - x, this.player.y - y, this.player.z - z);
          if (d < power * 4) { In.haptic('explode'); this.shake = Math.max(this.shake, (1 - d / (power * 4)) * 10); }
        },
        playerHurt: (p, amt, src) => {
          A.play('hurt', null, null, null, 1, (Math.random() - Math.random()) * 0.2 + 1);
          In.haptic(src === 'fall' ? 'land' : 'hurt');
        },
        playerDied: () => { In.haptic('death'); setTimeout(() => { if (this.inGame) this.setScreen(new G.DeathScreen(this)); }, 800); },
        step: (e, b) => { const snd = this.blockSound(b); A.play(snd, e.x, e.y, e.z, 0.15, 1); },
        splash: (e) => { A.play('splash', e.x, e.y, e.z, 0.6, 1 + (Math.random() - Math.random()) * 0.4); this.spawnParticles('splash', e.x, Math.floor(e.y) + 1, e.z, 12, e.w); this.spawnParticles('bubble', e.x, e.y, e.z, 8, e.w); },
        pickup: (e, p) => {
          A.play('pop', e.x, e.y, e.z, 0.2, ((Math.random() - Math.random()) * 0.7 + 1) * 2);
          this.collectAnims.push({ x: e.x, y: e.y, z: e.z, stack: e.stack ? I.copy(e.stack) : { id: 262, count: 1 }, t: 0, age: e.age || 0, bob: e.bobOffset || 0 });
          In.haptic('pickup');
        },
        toolBreak: (p, s) => { this.spawnParticles('itemcrack', p.x, p.y + p.eye - 0.2, p.z, 6, 0.2, s.id); },
        smoke: (x, y, z, n) => this.spawnParticles('smoke', x + 0.5, y + 1, z + 0.5, n, 0.5)
      };
    }

    blockSound(id) {
      const b = S.blocks[id];
      if (!b) return 'stone';
      const s = b.sound;
      if (s === 'grass') return 'grass';
      if (s === 'wood') return 'wood';
      if (s === 'gravel') return 'gravel';
      if (s === 'sand') return 'sand';
      if (s === 'cloth') return id === B.snow_layer || id === B.snow_block ? 'snow' : 'cloth';
      if (s === 'glass') return 'stone';
      if (s === 'metal') return 'metal';
      return 'stone';
    }

    saveWorld() {
      if (!this.world) return Promise.resolve();
      this.saveIndicator = 40;
      const w = this.world, m = this.meta;
      m.time = w.time;
      m.timeFrozen = !!w.timeFrozen;
      m.creative = !!this.player.creative;
      m.player = this.player.serialize();
      m.size = w.savedKeys.size * 16 * 1024;
      m.lastPlayed = Date.now();
      m.dim = w.dim || 0;
      return Promise.all([w.saveAll(), DL.Storage.putWorld(m.slot, m)]);
    }

    async quitToTitle() {
      const ls = new G.LoadingScreen(this);
      ls.title = 'Saving level'; ls.status = 'Saving chunks'; ls.progress = -1;
      this.setScreen(ls);
      this.inGame = false;
      await this.saveWorld();
      if (this.world) {
        for (const c of this.world.chunks.values()) this.renderer.freeChunk(c);
        this.world.destroy();
      }
      this.world = null; this.player = null; this.loading = null;
      A.stopMusic();
      this.setScreen(new G.TitleScreen(this));
    }

    respawn() {
      const p = this.player, w = this.world;
      p.health = 20; p.deathTime = 0; p.fire = 0; p.air = 300; p.hurtTime = 0; p.hurtResist = 0;
      p.vx = p.vy = p.vz = 0; p.fallDistance = 0; p.score = 0;
      const sp = p.spawnPoint || this.meta.spawn || [0.5, 80, 0.5];
      p.setPos(sp[0], sp[1], sp[2]);
      this.placeSafely(p);
      this.setScreen(null);
      void w;
    }
    placeSafely(p) {
      const w = this.world;
      const x = Math.floor(p.x), z = Math.floor(p.z);
      if (!w.isReady(x, z)) return;
      let y = Math.max(1, Math.floor(p.y));
      const free = (yy) => !S.SOLID[w.getBlock(x, yy, z)] && !S.SOLID[w.getBlock(x, yy + 1, z)];
      let guard = 0;
      while (!free(y) && y < S.CH - 2 && guard++ < 130) y++;
      p.setPos(p.x, y, p.z);
    }

    /* ---------------------------------------------------------- */
    /* Input routing                                              */
    /* ---------------------------------------------------------- */
    onInput(type, d) {
      const scr = G.screen;
      if (type === 'mousemove' || type === 'mousedown' || type === 'mouseup') {
        const [gx, gy] = G.toGui(d.x, d.y);
        G.mouse.x = gx; G.mouse.y = gy;
        if (scr) {
          if (type === 'mousedown') {
            if (d.touch) { this.touchDown = { x: gx, y: gy, t: performance.now(), id: d.id }; return; }
            scr.mouseDown(gx, gy, d.button, d.shift || In.keys.has('ShiftLeft') || In.keys.has('ShiftRight'));
          } else if (type === 'mouseup') {
            if (d.touch && this.touchDown) {
              const td = this.touchDown; this.touchDown = null;
              const long = (d.dt || 0) > 400;
              scr.mouseDown(td.x, td.y, long && scr instanceof G.ContainerScreen ? 2 : 0, false);
              if (scr.mouseUp) scr.mouseUp(gx, gy);
              return;
            }
            if (scr.mouseUp) scr.mouseUp(gx, gy);
          } else if (scr.mouseMove) { if (d.touch && this.touchDown) scr.mouseDown && scr.dragging && scr.mouseMove(gx, gy); else scr.mouseMove(gx, gy); }
          return;
        }
        if (type === 'mousedown' && this.inGame && !d.touch) {
          if (!In.locked && In.lastDevice === 'kbm') { In.requestLock(); return; }
          if (d.button === 0) this.attackPressed = true;
          if (d.button === 2) { this.usePressed = true; this.useTimer = 0; }
          if (d.button === 1) this.pickBlock();
        }
        return;
      }
      if (type === 'wheel') {
        if (scr) { scr.wheel(d.delta); return; }
        if (this.inGame) this.selectSlot((this.player.selected + d.delta + 9) % 9);
        return;
      }
      if (type === 'textinput') { if (scr && scr.textInput) scr.textInput(d.value); return; }
      if (type === 'textkey') { if (scr && scr.textKey) scr.textKey(d.key); return; }
      if (type === 'keydown') {
        if (d.code === 'F11') { this.toggleFullscreen(); return; }
        if (d.code === In.binds.forward && !d.repeat && !scr) { const now = d.t || performance.now(); if (now - (this._fwdTap || 0) < 300) this.sprintTap = true; this._fwdTap = now; }
        if (scr) { scr.key(d.code, d.key); return; }
        if (!this.inGame) return;
        this.gameKey(d.code, d.ctrl);
        return;
      }
      if (type === 'unlock') {
        if (this.inGame && !G.screen && this.player.health > 0 && In.lastDevice === 'kbm') this.setScreen(new G.PauseScreen(this));
        return;
      }
      if (type === 'blur') { if (this.inGame && !G.screen && In.lastDevice !== 'touch') this.setScreen(new G.PauseScreen(this)); return; }
      if (type === 'padbutton') { this.padButton(d.button, d.down); return; }
      if (type === 'touchbutton') { this.touchButton(d.id, d.down); return; }
      if (type === 'touchhotbar') { this.touchHotbar(d); return; }
      if (type === 'devicechange' || type === 'gamepad') {
        if (G.screen && G.screen.layout && d.connected !== false) { if (G.screen.focus < 0 && G.screen.widgets) G.screen.focus = G.screen.widgets.findIndex(w => !w.hidden && w.enabled !== false); }
        if (d.connected) G.notice('Controller connected: ' + (d.id || 'gamepad').replace(/\s*\(.*$/, '').slice(0, 48));
      }
    }

    gameKey(code, ctrl) {
      const B_ = In.binds, p = this.player;
      if (code === 'Escape') { this.setScreen(new G.PauseScreen(this)); return; }
      if (p.health <= 0) return;
      if (code === B_.inventory) { this.openInventory(); return; }
      if (code === B_.chat) { this.setScreen(new G.ChatScreen(this, '')); return; }
      if (code === 'Slash') { this.setScreen(new G.ChatScreen(this, '/')); return; }
      if (code === B_.drop) { this.dropHeld(ctrl); return; }
      if (code === B_.debug) { this.debug = !this.debug; return; }
      if (code === B_.hideGui) { this.hideGui = !this.hideGui; return; }
      if (code === B_.perspective) { this.thirdPerson = (this.thirdPerson + 1) % 3; return; }
      if (code === B_.screenshot) { this.screenshotPending = true; return; }
      if (code === B_.fog) { const st = this.settings; st.renderDist = (st.renderDist + (In.keys.has('ShiftLeft') ? 3 : 1)) % 4; this.applySettings(); this.saveSettings(); this.chatMessage('Render distance: ' + G.RENDER_DISTS[st.renderDist].n); return; }
      if (code.startsWith('Digit')) { const n = parseInt(code.slice(5), 10); if (n >= 1 && n <= 9) this.selectSlot(n - 1); }
    }

    padButton(b, down) {
      const P = In.GPB;
      const scr = G.screen;
      if (!down) { if (b === P.LT) this.padUseHeld = false; return; }
      A.unlock();
      if (scr) {
        if (b === P.START && scr instanceof G.PauseScreen) { this.setScreen(null); return; }
        if (b === P.Y && scr instanceof G.InventoryScreen) { this.setScreen(null); return; }
        if (scr.padButton) scr.padButton(b);
        return;
      }
      if (!this.inGame) return;
      const p = this.player;
      if (b === P.START) { this.setScreen(new G.PauseScreen(this)); return; }
      if (p.health <= 0) return;
      switch (b) {
        case P.Y: this.openInventory(); break;
        case P.B: this.dropHeld(false); break;
        case P.LB: this.selectSlot((p.selected + 8) % 9); break;
        case P.RB: this.selectSlot((p.selected + 1) % 9); break;
        case P.RT: this.attackPressed = true; break;
        case P.LT: this.usePressed = true; this.useTimer = 0; break;
        case P.X: this.usePressed = true; this.useTimer = 0; break;
        case P.RS: this.sneakToggle = !this.sneakToggle; break;
        case P.LS: this.padSprint = !this.padSprint; break;
        case P.UP: this.thirdPerson = (this.thirdPerson + 1) % 3; break;
        case P.DOWN: this.dropHeld(true); break;
        case P.LEFT: this.selectSlot((p.selected + 8) % 9); break;
        case P.RIGHT: this.selectSlot((p.selected + 1) % 9); break;
        case P.BACK: this.setScreen(new G.ChatScreen(this, '')); break;
      }
    }

    touchButton(id, down) {
      if (!down) return;
      switch (id) {
        case 'sneak': this.sneakToggle = !this.sneakToggle; break;
        case 'inventory': this.openInventory(); break;
        case 'pause': this.setScreen(new G.PauseScreen(this)); break;
        case 'chat': this.setScreen(new G.ChatScreen(this, '')); break;
        case 'view': this.thirdPerson = (this.thirdPerson + 1) % 3; break;
      }
    }
    touchHotbar(d) {
      const L = G.touchLayout(this);
      const rel = (d.x - L.hotbar.x) / L.hotbar.w;
      const slot = Math.max(0, Math.min(8, Math.floor(rel * 9)));
      if (d.start) { this.selectSlot(slot); this.hotbarHold = { slot, t: performance.now(), id: d.id, dropped: false }; }
      if (d.end) this.hotbarHold = null;
    }

    selectSlot(n) {
      if (this.player.selected !== n) { this.player.selected = n; this.itemNameTimer = 40; this.resetDig(); In.haptic('tick'); }
    }
    dropHeld(all) {
      const p = this.player, s = p.held;
      if (!s) return;
      const n = all ? s.count : 1;
      p.dropItem(I.stack(s.id, n, s.dmg));
      s.count -= n;
      if (s.count <= 0) p.held = null;
      p.swing();
    }
    openInventory() { this.setScreen(this.player.creative ? new G.CreativeScreen(this) : new G.InventoryScreen(this)); }
    pickBlock() {
      const t = this.target;
      if (!t || t.entity) return;
      let id = t.id;
      if (id === B.lit_furnace) id = B.furnace;
      if (id === B.double_slab) id = B.slab;
      if (id === B.wooden_door) id = 324; if (id === B.wheat) id = 295; if (id === B.reeds) id = 338;
      const p = this.player;
      for (let i = 0; i < 9; i++) if (p.inv[i] && p.inv[i].id === id) { this.selectSlot(i); return; }
      for (let i = 9; i < 36; i++) if (p.inv[i] && p.inv[i].id === id) { const t2 = p.inv[p.selected]; p.inv[p.selected] = p.inv[i]; p.inv[i] = t2; this.itemNameTimer = 40; return; }
      if (p.creative && I.get(id)) { p.held = I.stack(id, I.maxStack(id)); this.itemNameTimer = 40; }
    }

    chatMessage(text) { G.chat.push({ text, t: performance.now() }); if (G.chat.length > 100) G.chat.shift(); }
    chatSubmit(v) {
      this.chatHistory.push(v);
      if (v.startsWith('/')) this.command(v.slice(1));
      else this.chatMessage('<Player> ' + v);
    }

    command(line) {
      const args = line.split(/\s+/);
      const cmd = args.shift().toLowerCase();
      const p = this.player, w = this.world;
      const msg = (m) => this.chatMessage(m);
      switch (cmd) {
        case 'help': msg('§eCommands: /time set <day|night|n>, /give <item> [n], /tp x y z, /seed, /kill, /heal, /summon <mob>, /difficulty <n>, /clear, /spawnpoint, /items, /gamemode, /dimension <overworld|nether|end|aether|sift>, /locate <structure>'); break;
        case 'dimension': case 'dim': {
          const names = { overworld: 0, nether: 1, end: 2, the_end: 2, aether: 3, sift: 4, the_sift: 4 };
          const d = names[(args[0] || '').toLowerCase()];
          if (d === undefined) { msg('§cUsage: /dimension <overworld|nether|end|aether|sift>'); break; }
          this.travel(d, { type: 'command' });
          break;
        }
        case 'locate': {
          const n = (args[0] || '').toLowerCase().replace(/^minecraft:/, '');
          const res = DL.Structures && DL.Structures.locate(w, n, p.x, p.z);
          if (!res) { msg('§cNo ' + n + ' found nearby. Try: ' + DL.Structures.TYPES.filter(t => t.dim === (w.dim || 0)).map(t => t.name).concat(w.dim ? [] : ['stronghold']).join(', ')); break; }
          msg('The nearest ' + n + ' is at ' + Math.round(res[0]) + ', ' + Math.round(res[2]) + ' (' + Math.round(res[3]) + ' blocks away)');
          break;
        }
        case 'time': {
          if (args[0] === 'set') { const v = { day: 1000, noon: 6000, sunset: 12000, night: 13000, midnight: 18000, sunrise: 23000 }[args[1]]; const t = v !== undefined ? v : parseInt(args[1], 10); if (!isNaN(t)) { w.time = Math.floor(w.time / 24000) * 24000 + t; msg('Set the time to ' + t); } }
          else if (args[0] === 'add') { w.time += parseInt(args[1], 10) || 0; msg('Added time'); }
          else msg('Time: ' + (w.time % 24000));
          break;
        }
        case 'give': {
          const d = I.find(args[0] || '');
          if (!d) { msg('§cUnknown item: ' + args[0]); break; }
          const n = Math.max(1, Math.min(640, parseInt(args[1], 10) || 1));
          let left = n;
          while (left > 0) { const k = Math.min(left, d.maxStack); const r = p.addItem(I.stack(d.id, k)); if (r) p.dropItem(r); left -= k; }
          msg('Given ' + n + ' ' + d.display);
          break;
        }
        case 'tp': {
          const x = parseFloat(args[0]), y = parseFloat(args[1]), z = parseFloat(args[2]);
          if ([x, y, z].some(isNaN)) { msg('§cUsage: /tp x y z'); break; }
          p.setPos(x, y, z); p.vy = 0; p.fallDistance = 0; msg('Teleported'); break;
        }
        case 'seed': msg('Seed: ' + w.seed); break;
        case 'kill': p.damage('void', 1000); break;
        case 'heal': p.health = 20; p.fire = 0; p.air = 300; msg('Healed'); break;
        case 'summon': case 'spawn': {
          const t = (args[0] || '').toLowerCase();
          if (!E.MOBS[t]) { msg('§cUnknown mob. Try: ' + Object.keys(E.MOBS).join(', ')); break; }
          const l = p.look();
          const m = E.spawnMob(w, t, p.x + l[0] * 3, p.y + 0.5, p.z + l[2] * 3);
          m.persistent = !m.hostile;
          msg('Summoned ' + t);
          break;
        }
        case 'difficulty': {
          const names = ['peaceful', 'easy', 'normal', 'hard'];
          let v = parseInt(args[0], 10);
          if (isNaN(v)) v = names.indexOf((args[0] || '').toLowerCase());
          if (v >= 0 && v <= 3) { this.settings.difficulty = v; this.applySettings(); this.saveSettings(); msg('Difficulty set to ' + names[v]); }
          break;
        }
        case 'clear': p.inv.fill(null); p.armor.fill(null); msg('Cleared inventory'); break;
        case 'gamemode': {
          const a = (args[0] || '').toLowerCase();
          p.creative = a === 'creative' || a === 'c' || a === '1' ? true : a === 'survival' || a === 's' || a === '0' ? false : !p.creative;
          if (!p.creative) p.flying = false;
          this.meta.creative = p.creative;
          msg('Game mode: ' + (p.creative ? 'Creative' : 'Survival'));
          break;
        }
        case 'spawnpoint': p.spawnPoint = [p.x, p.y, p.z]; msg('Spawn point set'); break;
        case 'items': msg(I.all().filter(d => d.id > 255).map(d => d.name).slice(0, 40).join(', ')); break;
        default: msg('§cUnknown command. Type /help');
      }
    }

    /* ---------------------------------------------------------- */
    /* Main loop                                                  */
    /* ---------------------------------------------------------- */
    loop(now) {
      requestAnimationFrame((t) => this.loop(t));
      if (this.settings.limitFps && now - this.last < 1000 / 42) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.frames++;
      if (now - this.fpsT >= 1000) { this.fps = this.frames; this.frames = 0; this.fpsT = now; if (this.world) this.world.stats.meshJobs = 0; }
      In.pollGamepad();
      In.updateTouch();
      this.frameInput(dt);
      // loading
      if (this.loading && this.world) this.updateLoading(now);
      // ticks
      if (this.inGame) {
        this.acc += dt * 1000;
        let n = 0;
        while (this.acc >= TICK && n < 8) { this.tick(); this.acc -= TICK; n++; }
        if (n >= 8) this.acc = 0;
      }
      const pt = this.inGame ? this.acc / TICK : 1;
      if (this.world) {
        const p = this.player;
        this.world.updateChunks(p.x, p.z, this.loading ? 30 : (IS_MOBILE ? 4 : 7));
      }
      this.render(pt, now, dt);
      A.updateMusic(this.inGame);
    }

    updateLoading(now) {
      const L = this.loading, w = this.world, p = this.player;
      const ls = this.loadingScreen;
      const pr = w.spawnProgress(p.x, p.z, Math.min(3, w.renderDist));
      if (L.phase === 0) {
        ls.progress = pr.gen * 0.5 + pr.ready * 0.5;
        if (pr.ready >= 1 && now - L.t0 > 600) {
          L.phase = 1; L.t1 = now;
          ls.title = L.isNew ? 'Generating level' : 'Loading level';
          ls.status = 'Simulating world for a bit';
          ls.progress = 0;
        }
      } else if (L.phase === 1) {
        ls.progress = Math.min(1, (now - L.t1) / 700);
        if (now - L.t1 > 700) {
          this.loading = null;
          this.placeSafely(p);
          this.inGame = true;
          this.acc = 0;
          this.setScreen(null);
          this.fadeIn = 1;
          if (L.isNew) this.chatMessage('Welcome to §aDreamLand§f! Press ' + (In.lastDevice === 'touch' ? 'the (...) button' : In.lastDevice === 'gamepad' ? 'Y' : In.keyName(In.binds.inventory)) + ' for your inventory. Type /help for commands.');
          this.saveWorld();
        }
      }
    }

    frameInput(dt) {
      if (!this.inGame || !this.player) return;
      const p = this.player;
      const st = this.settings;
      const scr = G.screen;
      // gamepad cursor / nav in screens
      const ax = In.gp.axes;
      if (scr) {
        if (In.lastDevice === 'gamepad') {
          if (scr instanceof G.ContainerScreen) scr.padCursor(ax[0], ax[1], dt);
          else if (scr.stickNav) scr.stickNav(ax[0], ax[1]);
        }
        this.moveF = this.moveS = 0;
        return;
      }
      if (p.health <= 0) return;
      // look
      const f = st.sensitivity * 0.6 + 0.2;
      const k = f * f * f * 8 * 0.15 * Math.PI / 180;
      let dx = In.mouse.dx * k, dy = In.mouse.dy * k;
      In.mouse.dx = In.mouse.dy = 0;
      const T = In.touch;
      const ts = (0.3 + st.touchSens * 1.4) * 0.0045;
      dx += T.lookDX * ts; dy += T.lookDY * ts;
      T.lookDX = T.lookDY = 0;
      const ps = (0.6 + st.padSens * 3.2) * dt;
      const rx = ax[2], ry = ax[3];
      dx += Math.sign(rx) * rx * rx * ps * 1.6; dy += Math.sign(ry) * ry * ry * ps * (st.padInvert ? -1 : 1);
      if (st.invertMouse) dy = -dy;
      p.yaw = DL.wrapAngle(p.yaw - dx);
      p.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, p.pitch - dy));
      // movement
      let mf = 0, ms = 0;
      if (In.down('forward')) mf += 1;
      if (In.down('back')) mf -= 1;
      if (In.down('left')) ms -= 1;
      if (In.down('right')) ms += 1;
      mf += T.move[1]; ms += T.move[0];
      mf -= ax[1]; ms += ax[0];
      const l = Math.hypot(mf, ms);
      if (l > 1) { mf /= l; ms /= l; }
      this.moveF = mf; this.moveS = ms;
      // sprint: double-tap forward, press the sprint key, push the touch stick past its ring, or click the left stick
      const sk = In.down('sprint');
      if (sk && !this._sprKeyWas) this.sprintTap = true;
      this._sprKeyWas = sk;
      if (mf <= 0.5 && !sk) { this.sprintTap = false; this.padSprint = false; }
      this.sprintHeld = sk || this.sprintTap || T.sprint || this.padSprint;
      this.jumpHeld = In.down('jump') || T.jump || In.padDown(In.GPB.A);
      this.sneakHeld = In.down('sneak') || this.sneakToggle;
      this.attackHeld = (In.mouse.left && In.locked) || (In.lastDevice === 'touch' && T.breaking) || In.padValue(In.GPB.RT) > 0.5;
      this.useHeld = (In.mouse.right && In.locked) || In.padValue(In.GPB.LT) > 0.5 || In.padDown(In.GPB.X);
      if (T.tap) { T.tap = false; if (this.target && this.target.entity) this.attackPressed = true; else { this.usePressed = true; this.useTimer = 0; } }
      // hotbar hold to drop (touch)
      if (this.hotbarHold && !this.hotbarHold.dropped && performance.now() - this.hotbarHold.t > 600) {
        this.hotbarHold.dropped = true;
        this.dropHeld(false);
        In.haptic('place', true);
      }
      this.updateTarget();
    }

    updateTarget() {
      const p = this.player, w = this.world;
      const ex = p.x, ey = p.y + p.eye - (p.sneaking ? 0.08 : 0), ez = p.z;
      const d = p.look();
      const reach = this.reachBonus ? REACH + this.reachBonus() : REACH;
      const hit = E.raycast(w, ex, ey, ez, d[0], d[1], d[2], reach, false);
      let best = null, bestT = Math.min(reach - 1, hit ? hit.t : reach - 1);
      for (const e of w.entities) {
        if (e === p || e === p.vehicle || !e.living || e.removed || e.health <= 0) continue;
        const b = e.box;
        const g = 0.1;
        const h = E.rayBox(ex, ey, ez, d[0], d[1], d[2], [b[0] - g, b[1] - g, b[2] - g, b[3] + g, b[4] + g, b[5] + g]);
        if (h && h.t < bestT) { bestT = h.t; best = e; }
      }
      if (best) this.target = { entity: best };
      else this.target = hit;
    }

    /* ---------------------------------------------------------- */
    /* Tick                                                       */
    /* ---------------------------------------------------------- */
    tick() {
      this.tickCount++;
      const w = this.world, p = this.player;
      const scr = G.screen;
      if (scr && scr.pauses && !(DL.Net && DL.Net.active())) return;
      this.prevHealth = p.health > (this.prevHealth || 0) ? p.health : this.prevHealth;
      if (p.hurtResist <= 10) this.prevHealth = p.health;
      // player controls
      p.moveForward = (!scr || scr instanceof G.ChatScreen) ? this.moveF || 0 : 0;
      p.moveStrafe = (!scr || scr instanceof G.ChatScreen) ? this.moveS || 0 : 0;
      p.jumping = !scr && this.jumpHeld;
      // creative: double-tap jump toggles flying
      if (p.creative && p.jumping && !this._jumpWas) {
        if (this.tickCount - (this._lastJumpTap || -99) < 7) { p.flying = !p.flying; this._lastJumpTap = -99; In.haptic('tick'); }
        else this._lastJumpTap = this.tickCount;
      }
      this._jumpWas = p.jumping;
      if (!p.creative) p.flying = false;
      p.sneaking = !scr && this.sneakHeld && !p.inWater;
      const wantSprint = (!scr || scr instanceof G.ChatScreen) && this.sprintHeld && p.moveForward > 0.5 && !p.sneaking && !p.inLava && (p.creative || p.food === undefined || p.food > 6);
      if (wantSprint && !p.sprinting && !p.collidedH) p.sprinting = true;
      else if (p.sprinting && (!wantSprint || (p.collidedH && !p.flying))) p.sprinting = false;
      p.sprintFly = p.sprinting && p.flying;
      // touch auto-jump
      if (this.touchOn() && this.settings.autoJump && p.onGround && p.collidedH && (p.moveForward > 0.3) && !p.sneaking) p._autoJump = 3;
      if (p._autoJump > 0) { p.jumping = true; p._autoJump--; }
      p._pstep = p.stepDist;
      const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16);
      w.tick(pcx, pcz);
      // entities
      const ents = w.entities;
      for (let i = 0; i < ents.length; i++) {
        const e = ents[i];
        if (e.removed) continue;
        const ex = Math.floor(e.x), ez = Math.floor(e.z);
        if (e !== p && !w.isReady(ex, ez)) continue;
        if (e === p && !w.isReady(ex, ez)) { p.px = p.x; p.py = p.y; p.pz = p.z; continue; }
        e.tick();
      }
      let j = 0;
      for (let i = 0; i < ents.length; i++) if (!ents[i].removed) ents[j++] = ents[i];
      ents.length = j;
      if (this.tickCount % 4 === 0) E.naturalSpawn(w, p);
      E.tickSpawners(w, p);
      // interactions
      if (!scr && p.health > 0) this.interact();
      else this.resetDig();
      this.attackPressed = false; this.usePressed = false;
      // misc
      this.renderer.tickParticles(w);
      DL.Tex.tickAnimations();
      this.animDirty = true;
      for (const c of this.collectAnims) c.t++;
      this.collectAnims = this.collectAnims.filter(c => c.t < 3);
      if (this.itemNameTimer > 0) this.itemNameTimer--;
      if (this.saveIndicator > 0) this.saveIndicator--;
      if (this.shake > 0) this.shake *= 0.85;
      if (this.tickCount % 600 === 0) this.saveWorld();
      this.displayTicks();
      A.setListener(p.x, p.y + p.eye, p.z, p.yaw);
      if (p.health <= 0 && !(G.screen instanceof G.DeathScreen) && p.deathTime > 20 && !this._deathShown) { this._deathShown = true; this.setScreen(new G.DeathScreen(this)); }
      if (p.health > 0) this._deathShown = false;
    }

    resetDig() { this.dig = null; }

    interact() {
      const p = this.player, w = this.world;
      const t = this.target;
      if (this.breakDelay > 0) this.breakDelay--;
      // attack
      if (this.attackPressed) {
        p.swing();
        if (t && t.entity) {
          const dmg = I.attackDamage(p.held);
          if (t.entity.damage('player', dmg, p)) {
            In.haptic('hit');
            this.spawnParticles('crit', t.entity.x, t.entity.y + t.entity.h * 0.6, t.entity.z, 4, t.entity.w);
            const d = p.held && I.get(p.held.id);
            if (d && d.tool) p.damageHeld(d.tool.type === 'sword' ? 1 : 2);
          }
        }
      }
      // mining
      if (this.attackHeld && t && !t.entity && this.breakDelay <= 0) {
        const id = w.getBlock(t.x, t.y, t.z);
        if (!id || S.LIQUID[id]) { this.dig = null; }
        else {
          if (!this.dig || this.dig.x !== t.x || this.dig.y !== t.y || this.dig.z !== t.z || this.dig.id !== id) {
            this.dig = { x: t.x, y: t.y, z: t.z, id, progress: 0, sound: 0, face: t.face };
            // punching TNT / hardness 0 break instantly
          }
          const dg = this.dig;
          const rate = p.creative ? 1 : I.breakRate(id, p.held, p.headInWater(), p.onGround || p.inWater && false);
          dg.progress += rate;
          if (this.tickCount % 4 === 0) {
            A.play(this.blockSound(id), t.x + 0.5, t.y + 0.5, t.z + 0.5, 0.25, 0.5);
            this.hitParticles(t.x, t.y, t.z, dg.face, id);
            In.haptic('dig');
          }
          if (this.tickCount % 5 === 0) p.swing();
          if (dg.progress >= 1) {
            const meta = w.getMeta(t.x, t.y, t.z);
            const held = p.held;
            if (id === B.tnt) { w.igniteTNT(t.x, t.y, t.z, 80); }
            else w.destroyBlock(t.x, t.y, t.z, !p.creative, held, true);
            void meta;
            const d = held && I.get(held.id);
            if (d && d.tool && S.blocks[id].hardness > 0) p.damageHeld(1);
            if (d && d.tool && d.tool.type === 'sword' && S.blocks[id].hardness > 0) p.damageHeld(1);
            In.haptic('break');
            this.dig = null;
            this.breakDelay = 5;
          }
        }
      } else if (!this.attackHeld) this.dig = null;
      // use
      if (this.useTimer > 0) this.useTimer--;
      if (this.usePressed || (this.useHeld && this.useTimer <= 0)) {
        this.useTimer = 4;
        this.useItem();
      }
    }

    faceDir(face) { return S.FACE_DIR[face]; }
    facing() {
      const p = this.player;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      if (Math.abs(fx) > Math.abs(fz)) return fx < 0 ? 2 : 3;
      return fz < 0 ? 0 : 1;
    }

    useItem() {
      const p = this.player, w = this.world;
      const t = this.target;
      const held = p.held;
      const d = held ? I.get(held.id) : null;
      // entity interaction
      if (t && t.entity) {
        const e = t.entity;
        if (e.def && e.def.interact && e.def.interact(e, p, this)) { p.swing(); return; }
        if (e.type === 'cow' && held && held.id === 325) { p.held = I.stack(335); p.swing(); A.play('pop', e.x, e.y, e.z, 0.5, 1); return; }
        return;
      }
      if (t && !t.entity) {
        const id = w.getBlock(t.x, t.y, t.z);
        // block interactions
        if (!p.sneaking || !held) {
          if (id === B.crafting_table) { this.setScreen(new G.CraftingScreen(this, t.x, t.y, t.z)); return; }
          if (id === B.chest) {
            const te = w.getTile(t.x, t.y, t.z);
            if (te) {
              if (OPAQUE_ABOVE(w, t.x, t.y, t.z)) return;
              A.play('chest', t.x + 0.5, t.y + 0.5, t.z + 0.5, 0.5, 1);
              this.setScreen(new G.ChestScreen(this, te)); return;
            }
          }
          if (id === B.furnace || id === B.lit_furnace) { const te = w.getTile(t.x, t.y, t.z); if (te) { this.setScreen(new G.FurnaceScreen(this, te)); return; } }
          if (id === B.wooden_door) {
            const m = w.getMeta(t.x, t.y, t.z);
            const by = (m & 8) ? t.y - 1 : t.y;
            const bm = w.getMeta(t.x, by, t.z) ^ 4;
            w.setBlock(t.x, by, t.z, B.wooden_door, bm & 7, 2);
            if (w.getBlock(t.x, by + 1, t.z) === B.wooden_door) w.setBlock(t.x, by + 1, t.z, B.wooden_door, (bm & 7) | 8, 2);
            A.play('door', t.x + 0.5, t.y + 0.5, t.z + 0.5, 1, Math.random() * 0.1 + 0.9);
            p.swing();
            return;
          }
          if (id === B.tnt && held && held.id === 259) { w.igniteTNT(t.x, t.y, t.z, 80); p.damageHeld(1); p.swing(); return; }
        }
        if (held) {
          // items used on blocks
          if (d.tool && d.tool.type === 'hoe') {
            if ((id === B.grass || id === B.dirt) && t.face !== 0 && w.getBlock(t.x, t.y + 1, t.z) === 0) {
              w.setBlock(t.x, t.y, t.z, B.farmland, 0, 3);
              A.play('gravel', t.x + 0.5, t.y + 0.5, t.z + 0.5, 1, 0.8);
              if (id === B.grass && Math.random() < 1 / 8) w.spawnItem(t.x + 0.5, t.y + 1.2, t.z + 0.5, I.stack(295), true);
              p.damageHeld(1); p.swing(); In.haptic('place');
            }
            return;
          }
          if (held.id === 259) {
            const [dx, dy, dz] = this.faceDir(t.face);
            const x = t.x + dx, y = t.y + dy, z = t.z + dz;
            if (w.getBlock(x, y, z) === 0) { w.setBlock(x, y, z, B.fire, 0, 3); A.play('fizz', x + 0.5, y + 0.5, z + 0.5, 0.6, 1.6); }
            p.damageHeld(1); p.swing();
            return;
          }
          if (held.id === 325 || held.id === 326 || held.id === 327) { this.useBucket(); return; }
          if (d.food) { this.eat(); return; }
          if (d.armor) { this.equipArmor(); return; }
          if (held.id === 261) { this.shootBow(); return; }
          if (held.id === 332 || held.id === 344) { this.throwItem(); return; }
          const placeId = d.isBlock ? d.block : d.places || (held.id === 324 ? B.wooden_door : 0);
          if (placeId) this.placeBlock(placeId, t);
        }
        return;
      }
      // no target: use in air
      if (!held) return;
      if (d.food) this.eat();
      else if (held.id === 261) this.shootBow();
      else if (held.id === 332 || held.id === 344) this.throwItem();
      else if (held.id === 325 || held.id === 326 || held.id === 327) this.useBucket();
      else if (d.armor) this.equipArmor();
    }

    placeBlock(id, t) {
      const p = this.player, w = this.world;
      let [dx, dy, dz] = this.faceDir(t.face);
      const clicked = w.getBlock(t.x, t.y, t.z);
      let x = t.x + dx, y = t.y + dy, z = t.z + dz;
      // slab stacking
      if (id === B.slab && clicked === B.slab && t.face === 1) { x = t.x; y = t.y; z = t.z; w.setBlock(x, y, z, B.double_slab, 0, 3); this.afterPlace(B.double_slab, x, y, z); return; }
      if (S.REPLACE[clicked] && clicked !== 0 && !S.LIQUID[clicked] && clicked !== B.fire) { x = t.x; y = t.y; z = t.z; }
      if (y < 0 || y >= S.CH) return;
      const cur = w.getBlock(x, y, z);
      if (cur && !S.REPLACE[cur]) return;
      let meta = 0;
      const f = this.facing();
      if (S.RENDER[id] === S.R.STAIRS) meta = f;
      switch (id) {
        case B.torch: {
          if (t.face === 0) return;
          meta = t.face === 1 ? 0 : [0, 0, 2, 1, 4, 3][t.face];
          if (!w.canStay(B.torch, x, y, z, meta)) { if (t.face !== 1 && w.canStay(B.torch, x, y, z, 0)) meta = 0; else return; }
          break;
        }
        case B.ladder: {
          if (t.face < 2) return;
          meta = [0, 0, 1, 0, 3, 2][t.face];
          if (!w.canStay(B.ladder, x, y, z, meta)) return;
          break;
        }
        case B.wood_stairs: case B.cobble_stairs: meta = f; break;
        case B.furnace: case B.chest: case B.pumpkin: case B.jack_o_lantern: meta = [1, 0, 3, 2][f]; break;
        case B.leaves: meta = 4; break;
        case B.wooden_door: {
          if (t.face !== 1) return;
          if (w.getBlock(x, y + 1, z) !== 0) return;
          if (!S.SOLID[w.getBlock(x, y - 1, z)]) return;
          meta = f;
          if (this.collidesEntity(x, y, z, B.wooden_door, meta) || this.collidesEntity(x, y + 1, z, B.wooden_door, meta | 8)) return;
          w.setBlock(x, y, z, B.wooden_door, meta, 2);
          w.setBlock(x, y + 1, z, B.wooden_door, meta | 8, 3);
          this.afterPlace(B.wooden_door, x, y, z);
          return;
        }
        case B.wheat: if (w.getBlock(x, y - 1, z) !== B.farmland || t.face !== 1) return; break;
        default:
          if (!w.canStay(id, x, y, z, 0)) return;
      }
      if ([B.dandelion, B.rose, B.sapling, B.reeds, B.cactus, B.brown_mushroom, B.red_mushroom, B.snow_layer].includes(id) && !w.canStay(id, x, y, z, 0)) return;
      if (S.SOLID[id] && this.collidesEntity(x, y, z, id, meta)) return;
      w.setBlock(x, y, z, id, meta, 3);
      this.afterPlace(id, x, y, z);
    }
    afterPlace(id, x, y, z) {
      const p = this.player;
      const snd = this.blockSound(id);
      A.play(snd, x + 0.5, y + 0.5, z + 0.5, 1, 0.8);
      if (id === B.sand || id === B.gravel) this.world.neighborChanged(x, y, z);
      if (!p.creative) p.consumeHeld(1);
      p.swing();
      In.haptic('place');
    }
    collidesEntity(x, y, z, id, meta) {
      const w = this.world;
      const prevB = w.getBlock(x, y, z), prevM = w.getMeta(x, y, z);
      const c = w.getChunk(x >> 4, z >> 4);
      if (!c) return true;
      const i = (y << 8) | ((z & 15) << 4) | (x & 15);
      c.blocks[i] = id; c.meta[i] = meta;
      const boxes = [];
      E.collisionBoxes(w, x, y, z, boxes);
      c.blocks[i] = prevB; c.meta[i] = prevM;
      for (const e of w.entities) {
        if (e.removed || (!e.living && e.type !== 'falling' && e.type !== 'tnt')) continue;
        if (e.living && e.health <= 0) continue;
        const b = e.box;
        for (const o of boxes) if (b[3] > o[0] && b[0] < o[3] && b[4] > o[1] && b[1] < o[4] && b[5] > o[2] && b[2] < o[5]) return true;
      }
      return false;
    }

    useBucket() {
      const p = this.player, w = this.world;
      const d = p.look();
      const hit = E.raycast(w, p.x, p.y + p.eye, p.z, d[0], d[1], d[2], REACH, true);
      if (!hit) return;
      const held = p.held;
      if (held.id === 325) {
        const id = w.getBlock(hit.x, hit.y, hit.z);
        if ((id === B.water || id === B.lava) && w.getMeta(hit.x, hit.y, hit.z) === 0) {
          w.setBlock(hit.x, hit.y, hit.z, 0, 0, 3);
          p.held = I.stack(id === B.water ? 326 : 327);
          A.play('splash', hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 0.4, 1.4);
          p.swing(); In.haptic('place');
        }
        return;
      }
      if (held.id === 335) return;
      const liquid = held.id === 326 ? B.water : B.lava;
      let x = hit.x, y = hit.y, z = hit.z;
      const hid = w.getBlock(x, y, z);
      if (!S.LIQUID[hid] || w.getMeta(x, y, z) !== 0) { const [dx, dy, dz] = this.faceDir(hit.face); x += dx; y += dy; z += dz; }
      const cur = w.getBlock(x, y, z);
      if (cur && !S.REPLACE[cur] && S.SOLID[cur]) return;
      if (cur && !S.LIQUID[cur]) w.destroyBlock(x, y, z, true);
      w.setBlock(x, y, z, liquid, 0, 3);
      w.schedule(x, y, z, liquid === B.water ? 5 : 30);
      p.held = I.stack(325);
      A.play('splash', x + 0.5, y + 0.5, z + 0.5, 0.4, 1);
      p.swing(); In.haptic('place');
    }
    eat() {
      const p = this.player, s = p.held, d = I.get(s.id);
      if (p.health >= 20) return;
      p.heal(d.food);
      A.play('eat', p.x, p.y, p.z, 0.5, 1 + (Math.random() - Math.random()) * 0.2);
      this.spawnParticles('itemcrack', p.x - Math.sin(p.yaw) * 0.4, p.y + p.eye - 0.2, p.z - Math.cos(p.yaw) * 0.4, 8, 0.1, s.id);
      if (d.returns) p.held = I.stack(d.returns);
      else p.consumeHeld(1);
      p.swing(); In.haptic('place');
    }
    equipArmor() {
      const p = this.player, s = p.held, d = I.get(s.id);
      const slot = d.armor.slot;
      if (p.armor[slot]) return;
      p.armor[slot] = s; p.held = null;
      A.play('cloth', p.x, p.y, p.z, 0.6, 1);
    }
    shootBow() {
      const p = this.player, w = this.world;
      const slot = p.inv.findIndex(s => s && s.id === 262);
      if (slot < 0) return;
      p.inv[slot].count--; if (p.inv[slot].count <= 0) p.inv[slot] = null;
      const a = new E.Arrow(w, p.x, p.y + p.eye - 0.1, p.z, p);
      const d = p.look();
      a.x += Math.cos(p.yaw) * 0.16; a.z -= Math.sin(p.yaw) * 0.16; a.px = a.x; a.pz = a.z;
      a.shoot(d[0], d[1], d[2], 1.5, 1);
      w.entities.push(a);
      A.play('bow', p.x, p.y, p.z, 1, 1 / (Math.random() * 0.4 + 0.8));
      p.damageHeld(1); p.swing(); In.haptic('bow');
    }
    throwItem() {
      const p = this.player, w = this.world;
      const kind = p.held.id === 344 ? 'egg' : 'snowball';
      const e = new E.Thrown(w, p.x, p.y + p.eye - 0.1, p.z, p, kind);
      const d = p.look();
      e.shoot(d[0], d[1], d[2], 1.5, 1);
      w.entities.push(e);
      A.play('bow', p.x, p.y, p.z, 0.5, 0.4 / (Math.random() * 0.4 + 0.8));
      p.consumeHeld(1); p.swing();
    }

    /* ---------------------------------------------------------- */
    /* Particles & ambient                                        */
    /* ---------------------------------------------------------- */
    breakEffects(x, y, z, id, meta) {
      const r = this.renderer;
      const tile = S.tileFor(id, 2, meta, 0);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
        const px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4, pz = z + (k + 0.5) / 4;
        r.addParticle({
          type: 'block', tex: 'terrain', tile, sub: [Math.floor(Math.random() * 12), Math.floor(Math.random() * 12)],
          x: px, y: py, z: pz, px, py, pz,
          vx: (px - x - 0.5) * 0.1 + (Math.random() * 2 - 1) * 0.04, vy: (py - y - 0.5) * 0.1 + Math.random() * 0.1, vz: (pz - z - 0.5) * 0.1 + (Math.random() * 2 - 1) * 0.04,
          gravity: 0.04, drag: 0.98, life: Math.floor(4 / (Math.random() * 0.9 + 0.1)), age: 0, size: 0.1 * (Math.random() * 0.5 + 0.5) * 2,
          r: 0.6, g: 0.6, b: 0.6, a: 1, collide: true
        });
      }
      A.play(this.blockSound(id), x + 0.5, y + 0.5, z + 0.5, 1, 0.8);
      if (id === B.glass || id === B.ice) A.play('glass', x + 0.5, y + 0.5, z + 0.5, 1, 1);
    }
    hitParticles(x, y, z, face, id) {
      const [dx, dy, dz] = S.FACE_DIR[face];
      const e = 0.1;
      let px = x + Math.random(), py = y + Math.random(), pz = z + Math.random();
      if (dx) px = x + (dx > 0 ? 1 + e : -e);
      if (dy) py = y + (dy > 0 ? 1 + e : -e);
      if (dz) pz = z + (dz > 0 ? 1 + e : -e);
      this.renderer.addParticle({
        type: 'block', tex: 'terrain', tile: S.tileFor(id, 2, this.world.getMeta(x, y, z), 0), sub: [Math.floor(Math.random() * 12), Math.floor(Math.random() * 12)],
        x: px, y: py, z: pz, px, py, pz, vx: (Math.random() - 0.5) * 0.08, vy: Math.random() * 0.1, vz: (Math.random() - 0.5) * 0.08,
        gravity: 0.04, drag: 0.98, life: Math.floor(4 / (Math.random() * 0.9 + 0.1)), age: 0, size: 0.12, r: 0.6, g: 0.6, b: 0.6, a: 1, collide: true
      });
    }
    spawnParticles(type, x, y, z, n, spread, itemId) {
      const r = this.renderer;
      spread = spread || 0;
      for (let i = 0; i < n; i++) {
        const base = { type, x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.5, z: z + (Math.random() - 0.5) * spread, age: 0, a: 1 };
        base.px = base.x; base.py = base.y; base.pz = base.z;
        let p;
        switch (type) {
          case 'smoke': { const g = Math.random() * 0.3; p = { tex: 'particle', cellX: 0, cellY: 0, anim: true, vx: (Math.random() - 0.5) * 0.02, vy: 0.02 + Math.random() * 0.02, vz: (Math.random() - 0.5) * 0.02, gravity: -0.004, drag: 0.96, life: Math.floor(8 / (Math.random() * 0.8 + 0.2)), size: 0.12 + Math.random() * 0.06, r: g, g, b: g, reverse: true }; break; }
          case 'flame': p = { tex: 'particle', cellX: 0, cellY: 3, frame: 0, vx: 0, vy: 0.001, vz: 0, gravity: 0, drag: 0.96, life: Math.floor(8 / (Math.random() * 0.8 + 0.2)) + 4, size: 0.1 + Math.random() * 0.05, r: 1, g: 1, b: 1, fullBright: true }; break;
          case 'explosion': { const c = Math.random() * 0.3 + 0.7; p = { tex: 'particle', cellX: 0, cellY: 0, anim: true, vx: (Math.random() * 2 - 1) * 0.12, vy: (Math.random() * 2 - 1) * 0.12, vz: (Math.random() * 2 - 1) * 0.12, gravity: -0.004, drag: 0.9, life: Math.floor(16 / (Math.random() * 0.8 + 0.2)) + 2, size: (Math.random() * Math.random() * 6 + 1) * 0.25, r: c, g: c, b: c, fullBright: false };
            base.x = x + (Math.random() * 2 - 1) * spread; base.y = y + (Math.random() * 2 - 1) * spread; base.z = z + (Math.random() * 2 - 1) * spread; base.px = base.x; base.py = base.y; base.pz = base.z; break; }
          case 'poof': { const c = Math.random() * 0.3 + 0.7; p = { tex: 'particle', cellX: 0, cellY: 0, anim: true, vx: (Math.random() - 0.5) * 0.08, vy: Math.random() * 0.06, vz: (Math.random() - 0.5) * 0.08, gravity: -0.002, drag: 0.9, life: Math.floor(16 / (Math.random() * 0.8 + 0.2)), size: 0.25 + Math.random() * 0.2, r: c, g: c, b: c }; break; }
          case 'bubble': p = { tex: 'particle', cellX: 0, cellY: 1, frame: 0, vx: (Math.random() * 2 - 1) * 0.02, vy: Math.random() * 0.03, vz: (Math.random() * 2 - 1) * 0.02, gravity: 0, drag: 0.85, life: Math.floor(8 / (Math.random() * 0.8 + 0.2)), size: 0.1 + Math.random() * 0.05, r: 1, g: 1, b: 1 }; break;
          case 'splash': p = { tex: 'particle', cellX: 1 + Math.floor(Math.random() * 3), cellY: 1, frame: 0, vx: (Math.random() * 2 - 1) * 0.1, vy: Math.random() * 0.2 + 0.1, vz: (Math.random() * 2 - 1) * 0.1, gravity: 0.04, drag: 0.98, life: Math.floor(8 / (Math.random() * 0.8 + 0.2)), size: 0.1, r: 1, g: 1, b: 1, collide: true }; break;
          case 'lava': p = { tex: 'particle', cellX: 1, cellY: 3, frame: 0, vx: (Math.random() - 0.5) * 0.08, vy: Math.random() * 0.2 + 0.05, vz: (Math.random() - 0.5) * 0.08, gravity: 0.03, drag: 0.999, life: Math.floor(16 / (Math.random() * 0.8 + 0.2)), size: 0.1 + Math.random() * 0.05, r: 1, g: 1, b: 1, fullBright: true, collide: true }; break;
          case 'portal': { const f = Math.random() * 0.6 + 0.4; p = { tex: 'particle', cellX: 0, cellY: 0, anim: true, vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.3) * 0.08, vz: (Math.random() - 0.5) * 0.08, gravity: 0, drag: 0.92, life: 20 + Math.floor(Math.random() * 20), size: 0.07 + Math.random() * 0.05, r: f * 0.9, g: f * 0.3, b: f, fullBright: true }; break; }
          case 'soul': { const k = Math.random(); p = { tex: 'particle', cellX: 0, cellY: 0, anim: true, vx: (Math.random() - 0.5) * 0.02, vy: 0.012 + Math.random() * 0.02, vz: (Math.random() - 0.5) * 0.02, gravity: -0.0008, drag: 0.98, life: 30 + Math.floor(Math.random() * 30), size: 0.08 + Math.random() * 0.06, r: 0.35 + k * 0.4, g: 0.95, b: 0.9 - k * 0.2, fullBright: true }; break; }
          case 'ichor': { const h = Math.random(); p = { tex: 'particle', cellX: 2, cellY: 3, frame: 0, vx: (Math.random() - 0.5) * 0.05, vy: 0.05 + Math.random() * 0.08, vz: (Math.random() - 0.5) * 0.05, gravity: 0.01, drag: 0.94, life: 14 + Math.floor(Math.random() * 10), size: 0.08, r: 0.6 + 0.4 * Math.sin(h * 6.3), g: 0.6 + 0.4 * Math.sin(h * 6.3 + 2.1), b: 0.6 + 0.4 * Math.sin(h * 6.3 + 4.2), fullBright: true }; break; }
          case 'heart': case 'happy': p = { tex: 'particle', cellX: 2, cellY: 3, frame: 0, vx: (Math.random() - 0.5) * 0.05, vy: 0.05 + Math.random() * 0.05, vz: (Math.random() - 0.5) * 0.05, gravity: 0, drag: 0.9, life: 20, size: 0.12, r: type === 'heart' ? 1 : 0.4, g: type === 'heart' ? 0.3 : 1, b: 0.4, fullBright: true }; break;
          case 'crit': p = { tex: 'particle', cellX: 2, cellY: 3, frame: 0, vx: (Math.random() - 0.5) * 0.3, vy: Math.random() * 0.2, vz: (Math.random() - 0.5) * 0.3, gravity: 0.02, drag: 0.7, life: 8, size: 0.08, r: 1, g: 1, b: 1 }; break;
          case 'itemcrack': case 'egg': case 'snowball': {
            const d = I.get(itemId || (type === 'egg' ? 344 : 332));
            const terrain = d.isBlock;
            p = { tex: terrain ? 'terrain' : 'items', tile: terrain ? S.blocks[d.block].icon : DL.Tex.itemTile(d.icon || d.name), sub: [Math.floor(Math.random() * 12), Math.floor(Math.random() * 12)], vx: (Math.random() - 0.5) * 0.15, vy: Math.random() * 0.15 + 0.05, vz: (Math.random() - 0.5) * 0.15, gravity: 0.04, drag: 0.98, life: Math.floor(4 / (Math.random() * 0.9 + 0.1)), size: 0.12, r: 1, g: 1, b: 1, collide: true };
            break;
          }
          default: continue;
        }
        r.addParticle(Object.assign(base, p));
      }
    }
    displayTicks() {
      const w = this.world, p = this.player;
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
      const rng = w.rng;
      for (let i = 0; i < 400; i++) {
        const x = px + rng.nextInt(16) - rng.nextInt(16), y = py + rng.nextInt(16) - rng.nextInt(16), z = pz + rng.nextInt(16) - rng.nextInt(16);
        const id = w.getBlock(x, y, z);
        if (id === B.torch) {
          const m = w.getMeta(x, y, z);
          let fx = x + 0.5, fy = y + 0.7, fz = z + 0.5;
          const off = [null, [0, 0.27], [0, -0.27], [0.27, 0], [-0.27, 0]][m];
          if (off) { fx -= -off[0]; fz -= -off[1]; fy += 0.22; fx = x + 0.5 + (m === 3 ? -0.27 : m === 4 ? 0.27 : 0); fz = z + 0.5 + (m === 1 ? -0.27 : m === 2 ? 0.27 : 0); }
          this.spawnParticles('smoke', fx, fy, fz, 1, 0);
          this.spawnParticles('flame', fx, fy, fz, 1, 0);
        } else if (id === B.lit_furnace && rng.nextInt(2) === 0) {
          const m = w.getMeta(x, y, z) & 3;
          const d = [[0, -0.52], [0, 0.52], [-0.52, 0], [0.52, 0]][m];
          const fx = x + 0.5 + d[0] + (d[0] === 0 ? (Math.random() - 0.5) * 0.6 : 0), fz = z + 0.5 + d[1] + (d[1] === 0 ? (Math.random() - 0.5) * 0.6 : 0);
          this.spawnParticles('smoke', fx, y + Math.random() * 6 / 16, fz, 1, 0);
          this.spawnParticles('flame', fx, y + Math.random() * 6 / 16, fz, 1, 0);
        } else if (id === B.lava && w.getBlock(x, y + 1, z) === 0 && rng.nextInt(100) === 0) {
          this.spawnParticles('lava', x + Math.random(), y + 1, z + Math.random(), 1, 0);
          A.play('lavapop', x + 0.5, y + 1, z + 0.5, 0.2 + Math.random() * 0.2, 0.9 + Math.random() * 0.15);
        } else if (id === B.fire && rng.nextInt(4) === 0) {
          this.spawnParticles('smoke', x + Math.random(), y + 0.5 + Math.random() * 0.5, z + Math.random(), 1, 0);
        }
      }
      // cave ambience
      if (rng.nextInt(700) === 0) {
        const x = px + rng.nextInt(24) - 12, y = py + rng.nextInt(12) - 6, z = pz + rng.nextInt(24) - 12;
        if (w.getBlock(x, y, z) === 0 && w.getSky(x, y, z) === 0 && w.getBlockLight(x, y, z) === 0 && w.getSky(px, py + 1, pz) < 6) A.play('cave', x + 0.5, y + 0.5, z + 0.5, 0.7, 0.8 + Math.random() * 0.2);
      }
    }

    /* ---------------------------------------------------------- */
    /* Rendering                                                  */
    /* ---------------------------------------------------------- */
    render(pt, now, dt) {
      const r = this.renderer, gl = r.gl;
      const scr = G.screen;
      gl.viewport(0, 0, r.w, r.h);
      if (this.animDirty) { r.updateAnimations(); this.animDirty = false; }
      const showWorld = this.inGame && this.world && (!scr || scr.showWorld);
      if (showWorld) {
        if (this.settings.anaglyph) {
          for (let eye = 0; eye < 2; eye++) {
            gl.colorMask(eye === 0, eye === 1, eye === 1, true);
            this.renderWorld(pt, eye === 0 ? -1 : 1);
          }
          gl.colorMask(true, true, true, true);
        } else this.renderWorld(pt, 0);
      } else {
        r.renderMenuBackground(G.scale * r.w / G.canvas.width, 0);
        if (scr instanceof G.TitleScreen) {
          const k = G.scale * r.w / G.canvas.width;
          const L = scr.logoRect();
          r.renderLogo(Math.round(L.x * k), Math.round(L.y * k), Math.round(L.w * k), Math.round(L.h * k), now);
        }
      }
      // GUI
      G.begin();
      if (showWorld && !this.hideGui && this.player) G.drawHUD(this, pt);
      if (scr) scr.draw(G.mouse.x, G.mouse.y, pt);
      if (G.notices.length) G.drawNotices();
      if (this.fadeIn > 0) { G.rect(0, 0, G.W, G.H, 'rgba(0,0,0,' + Math.min(1, this.fadeIn) + ')'); this.fadeIn -= dt * 2; }
      // player preview in inventory
      if (scr && scr.preview && scr.previewLook) {
        const k = G.scale * r.w / G.canvas.width;
        const [x, y, w, h] = scr.preview;
        r.renderPlayerPreview(this.player, Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k), scr.previewLook[0], scr.previewLook[1]);
      }
      if (this.screenshotPending) { this.screenshotPending = false; this.takeScreenshot(); }
    }

    renderWorld(pt, eye) {
      const r = this.renderer, gl = r.gl, p = this.player, w = this.world, st = this.settings;
      const lerp = (a, b) => a + (b - a) * pt;
      let cx = lerp(p.px, p.x), cy = lerp(p.py, p.y) + p.eye - (p.sneaking ? 0.08 : 0), cz = lerp(p.pz, p.z);
      let yaw = p.yaw, pitch = p.pitch;
      if (p.health <= 0) cy = lerp(p.py, p.y) + 0.2;
      // third person
      if (this.thirdPerson) {
        let dyaw = yaw, dpitch = pitch;
        if (this.thirdPerson === 2) { dyaw = yaw + Math.PI; dpitch = -pitch; }
        const cp = Math.cos(dpitch);
        const bx = Math.sin(dyaw) * cp, by = -Math.sin(dpitch), bz = Math.cos(dyaw) * cp;
        let dist = 4;
        const hit = E.raycast(w, cx, cy, cz, bx, by, bz, 4, false);
        if (hit) dist = Math.max(0.5, hit.t - 0.3);
        cx += bx * dist; cy += by * dist; cz += bz * dist;
        yaw = dyaw; pitch = dpitch;
      }
      if (eye) { cx += Math.cos(yaw) * eye * 0.07; cz -= Math.sin(yaw) * eye * 0.07; }
      const headBlock = w.getBlock(Math.floor(cx), Math.floor(cy), Math.floor(cz));
      let underwater = false;
      if (headBlock === B.water) { const m = w.getMeta(Math.floor(cx), Math.floor(cy), Math.floor(cz)); underwater = cy < Math.floor(cy) + 1 - (m >= 8 ? 0 : (m + 1) / 9) + 0.11; }
      const inLava = headBlock === B.lava;
      const renderDist = w.renderDist;
      const lookDir = p.look();
      r.computeSky(w, pt, lookDir, renderDist);
      r.skySub = w.skySubtracted(pt);
      r.gamma = st.gamma;
      const far = renderDist * 16;
      r.fogStart = far * 0.3; r.fogEnd = far * 0.95; r.fogMode = 0; r.fogDensity = 0;
      if (underwater) { r.fogMode = 1; r.fogDensity = 0.08; r.fogColor = [0.02 + r.fogColor[0] * 0.05, 0.02 + r.fogColor[1] * 0.1, 0.2 * Math.max(0.3, 1 - r.skySub / 11)]; }
      if (inLava) { r.fogMode = 1; r.fogDensity = 2; r.fogColor = [0.6, 0.1, 0]; }
      if (p.y < 16 && !w.dim) { const f = Math.max(0, p.y / 16); r.fogColor = r.fogColor.map(c => c * (0.2 + 0.8 * f)); }
      r.ambient = w.dim === 1 ? 0.12 : w.dim === 2 ? 0.08 : 0;
      if (w.dim === 1 && !inLava) { r.fogStart = Math.min(r.fogStart, 6); r.fogEnd = Math.min(r.fogEnd, 88); }
      if (w.dim === 2 && !underwater) { r.fogStart = Math.max(r.fogStart, far * 0.6); }
      gl.clearColor(r.fogColor[0], r.fogColor[1], r.fogColor[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // camera effects
      let fov = 30 + st.fov * 80;
      this._sprintFov = (this._sprintFov || 1) + ((p.sprinting && p.health > 0 ? 1.13 : 1) - (this._sprintFov || 1)) * 0.2;
      fov *= this._sprintFov;
      if (underwater) fov *= 60 / 70;
      if (p.health <= 0) fov /= (1 - 500 / (p.deathTime + pt + 500)) * 2 + 1;
      let roll = 0;
      const extra = (v) => {
        const ht = p.hurtTime - pt;
        if (p.health <= 0) M4.rotateZ(v, v, (40 - 8000 / (p.deathTime + pt + 200)) * Math.PI / 180);
        if (ht > 0) {
          let f = ht / 10;
          f = Math.sin(f * f * f * f * Math.PI);
          M4.rotateY(v, v, -p.attackedAtYaw);
          M4.rotateZ(v, v, -f * 14 * Math.PI / 180);
          M4.rotateY(v, v, p.attackedAtYaw);
        }
        if (this.shake > 0.05) { M4.rotateZ(v, v, (Math.random() - 0.5) * this.shake * 0.01); }
        if (st.bobbing && !this.thirdPerson) {
          const walked = p.stepDist, prevWalked = p._pstep === undefined ? walked : p._pstep;
          const f1 = -(prevWalked + (walked - prevWalked) * pt);
          const bob = lerp(p.pbob, p.bob), tilt = lerp(p.pcameraTilt, p.cameraTilt);
          M4.translate(v, v, Math.sin(f1 * Math.PI) * bob * 0.5, -Math.abs(Math.cos(f1 * Math.PI) * bob), 0);
          M4.rotateZ(v, v, Math.sin(f1 * Math.PI) * bob * 3 * Math.PI / 180);
          M4.rotateX(v, v, Math.abs(Math.cos(f1 * Math.PI - 0.2) * bob) * 5 * Math.PI / 180);
          M4.rotateX(v, v, tilt * Math.PI / 180);
        }
      };
      r.setupCamera(cx, cy, cz, yaw, pitch, roll, fov, Math.max(256, far * 1.5), extra);
      r.stats.faces = 0;
      if (!underwater && !inLava) r.renderSky(w, pt);
      r.collectVisible(w);
      r.renderChunks(w, false);
      r.renderEntities(this, pt);
      // selection & cracks
      const t = this.target;
      if (t && !t.entity && !this.hideGui && !(G.screen && !(G.screen instanceof G.ChatScreen)) && p.health > 0) {
        if (this.dig && this.dig.progress > 0 && this.dig.x === t.x && this.dig.y === t.y && this.dig.z === t.z) r.renderCrack([t.x, t.y, t.z, t.x + 1, t.y + 1, t.z + 1], Math.floor(this.dig.progress * 10));
        r.renderSelection(t.box);
      }
      r.renderBillboards(w, pt);
      if (st.clouds) r.renderClouds(w, pt, st.fancy);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      r.renderChunks(w, true);
      gl.disable(gl.BLEND);
      // first person hand
      if (!this.thirdPerson && p.health > 0 && !this.hideGui) r.renderHand(this, pt);
      // overlays
      if (headBlock && S.OPAQUE[headBlock] && S.SOLID[headBlock] && !this.thirdPerson) r.overlayTile(S.blocks[headBlock].icon, 0.1, 1);
      if (underwater) r.overlayColor(0.1, 0.2, 0.6, 0.12);
      if (p.fire > 0 && !this.thirdPerson && !p.inWater) {
        const k = r.h / 3;
        gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        r.begin();
        for (const side of [0, 1]) {
          const tile = side ? S.T.fire_2 : S.T.fire;
          const tu = (tile & 15) / 16, tv = (tile >> 4) / S.ATLAS_ROWS;
          const x0 = side ? r.w * 0.6 : -r.w * 0.05, x1 = x0 + r.w * 0.45;
          r.quadV([[x0, r.h, 0], [x1, r.h, 0], [x1, r.h - k * 1.6, 0], [x0, r.h - k * 1.6, 0]], [[tu, tv + 1 / S.ATLAS_ROWS], [tu + 1 / 16, tv + 1 / S.ATLAS_ROWS], [tu + 1 / 16, tv], [tu, tv]], [1, 1, 1, 0.9]);
        }
        const o = r.ortho();
        r.flush('quads', { mvp: o, mv: o, tex: r.terrainTex, alphaTest: 0.1 });
        gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
      }
      if (!this.hideGui && (!G.screen || G.screen instanceof G.ChatScreen) && p.health > 0 && !this.thirdPerson) r.renderCrosshair(G.scale * r.w / G.canvas.width);
    }

    takeScreenshot() {
      try {
        const c = document.createElement('canvas');
        c.width = this.uiCanvas.width; c.height = this.uiCanvas.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(this.glCanvas, 0, 0, c.width, c.height);
        ctx.drawImage(this.uiCanvas, 0, 0);
        const name = 'dreamland-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
        c.toBlob((b) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b); a.download = name; a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        });
        this.chatMessage('Saved screenshot as ' + name);
      } catch (e) { this.chatMessage('§cCould not save screenshot'); }
    }
  }

  function OPAQUE_ABOVE(w, x, y, z) { const b = w.getBlock(x, y + 1, z); return S.OPAQUE[b] && S.SOLID[b]; }

  DL.Game = Game;
})();
