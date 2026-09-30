/*
 * DreamLand - dimensions: Nether, the End and the Aether.
 * Feature population for each dimension, portals (building, lighting, travel),
 * the Ender Dragon fight, elytra gliding, per-dimension skies and the boss bar.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, CH = S.CH, M4 = DL.M4;
  const E = DL.Entities, G = DL.GUI, I = DL.Items, A = DL.Audio, In = DL.Input;
  const St = DL.Structures;
  const SOLID = S.SOLID, OPAQUE = S.OPAQUE;
  const W = DL.World.prototype;
  const NAMES = ['the Overworld', 'the Nether', 'the End', 'the Aether'];
  DL.DIM_NAMES = NAMES;

  /* ------------------------------------------------------------ */
  /* Population                                                   */
  /* ------------------------------------------------------------ */
  W.genTreeWith = function (r, x, y, z, log, leaves, soil, big) {
    const h = r.nextInt(3) + (big ? 7 : 4);
    if (y < 1 || y + h + 2 > CH) return false;
    const below = this.getBlock(x, y - 1, z);
    if (below !== soil && below !== B.aether_dirt) return false;
    for (let yy = y; yy <= y + h; yy++) if (this.getBlock(x, yy, z) !== 0) return false;
    const rad0 = big ? 3 : 2;
    for (let yy = y + h - 3; yy <= y + h + 1; yy++) {
      const dy = yy - (y + h);
      const rad = dy >= 0 ? rad0 - 1 : rad0;
      for (let xx = x - rad; xx <= x + rad; xx++) for (let zz = z - rad; zz <= z + rad; zz++) {
        const ax = Math.abs(xx - x), az = Math.abs(zz - z);
        if (ax === rad && az === rad && (r.nextInt(2) === 0 || dy > 0)) continue;
        if (this.getBlock(xx, yy, zz) === 0) this.popSet(xx, yy, zz, leaves, 0);
      }
    }
    for (let yy = 0; yy < h; yy++) this.popSet(x, y + yy, z, log, 0);
    return true;
  };
  W.popPatch = function (r, x, y, z, id, soil, n) {
    for (let i = 0; i < (n || 32); i++) {
      const px = x + r.nextInt(8) - r.nextInt(8), py = y + r.nextInt(4) - r.nextInt(4), pz = z + r.nextInt(8) - r.nextInt(8);
      if (py < 1 || py >= CH - 1) continue;
      if (this.getBlock(px, py, pz) === 0 && this.getBlock(px, py - 1, pz) === soil) this.popSet(px, py, pz, id, 0);
    }
  };
  W.growChorus = function (r, x, y, z, depth) {
    const h = 1 + r.nextInt(depth ? 3 : 5);
    for (let k = 0; k < h; k++) { if (this.getBlock(x, y + k, z) !== 0) return; this.popSet(x, y + k, z, B.chorus_plant, 0); }
    const ty = y + h;
    if (depth < 3 && r.next() < 0.8) {
      let branched = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (r.next() < 0.35 && this.getBlock(x + dx, ty - 1, z + dz) === 0) { this.popSet(x + dx, ty - 1, z + dz, B.chorus_plant, 0); this.growChorus(r, x + dx, ty, z + dz, depth + 1); branched = true; }
      }
      if (!branched && this.getBlock(x, ty, z) === 0) this.popSet(x, ty, z, B.chorus_flower, 0);
    } else if (this.getBlock(x, ty, z) === 0) this.popSet(x, ty, z, B.chorus_flower, 0);
  };
  W.populateDim = function (c) {
    const r = this.popRng;
    r.setSeed(S.hash2(this.seed ^ 0x1b873593 ^ (this.dim * 977), c.cx, c.cz));
    const bx = c.cx * 16, bz = c.cz * 16;
    this._popOrigin = c;
    const rx = () => bx + 8 + r.nextInt(16), rz = () => bz + 8 + r.nextInt(16);
    if (this.dim === 1) {
      for (let i = 0; i < 16; i++) this.genMinable(r, bx + r.nextInt(16), 10 + r.nextInt(108), bz + r.nextInt(16), 13, B.quartz_ore, B.netherrack);
      for (let i = 0; i < 4; i++) this.genMinable(r, bx + r.nextInt(16), 26 + r.nextInt(10), bz + r.nextInt(16), 24, B.magma_block, B.netherrack);
      for (let i = 0; i < 3; i++) this.genMinable(r, bx + r.nextInt(16), 5 + r.nextInt(40), bz + r.nextInt(16), 14, B.soul_sand, B.netherrack);
      // glowstone clusters hanging from the ceilings
      const gc = 2 + r.nextInt(5);
      for (let i = 0; i < gc; i++) {
        const x = rx(), z = rz();
        let y = 40 + r.nextInt(80);
        while (y < 122 && !(this.getBlock(x, y, z) === 0 && this.getBlock(x, y + 1, z) === B.netherrack)) y++;
        if (y >= 122) continue;
        this.popSet(x, y, z, B.glowstone, 0);
        for (let k = 0; k < 220; k++) {
          const px = x + r.nextInt(7) - r.nextInt(7), py = y - r.nextInt(10), pz = z + r.nextInt(7) - r.nextInt(7);
          if (this.getBlock(px, py, pz) !== 0) continue;
          let n = 0;
          for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (this.getBlock(px + dx, py + dy, pz + dz) === B.glowstone) n++;
          if (n === 1) this.popSet(px, py, pz, B.glowstone, 0);
        }
      }
      // fire and mushrooms on netherrack
      const fires = r.nextInt(r.nextInt(10) + 1) + 1;
      for (let i = 0; i < fires; i++) {
        const x = rx(), z = rz(), y = 32 + r.nextInt(80);
        if (this.getBlock(x, y, z) === 0 && this.getBlock(x, y - 1, z) === B.netherrack) this.popSet(x, y, z, B.fire, 0);
      }
      if (r.nextInt(2) === 0) this.genPatch(r, rx(), r.nextInt(128), rz(), B.brown_mushroom);
      if (r.nextInt(2) === 0) this.genPatch(r, rx(), r.nextInt(128), rz(), B.red_mushroom);
      // hidden lava springs
      for (let i = 0; i < 8; i++) {
        const x = rx(), y = 10 + r.nextInt(108), z = rz();
        if (this.getBlock(x, y, z) !== B.netherrack || this.getBlock(x, y + 1, z) !== B.netherrack) continue;
        let air = 0, rock = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const b = this.getBlock(x + dx, y, z + dz); if (b === 0) air++; else if (b === B.netherrack) rock++; }
        if (air === 1 && rock === 3) { this.popSet(x, y, z, B.lava, 0); if (!this.pendingTicks) this.pendingTicks = []; this.pendingTicks.push([x, y, z]); }
      }
    } else if (this.dim === 2) {
      const outer = c.biomes && c.biomes[8 * 16 + 8] === 1;
      if (outer) {
        const n = r.nextInt(5);
        for (let i = 0; i < n; i++) {
          const x = rx(), z = rz(), y = this.topSolidY(x, z);
          if (y > 40 && this.getBlock(x, y - 1, z) === B.end_stone) { this.popSet(x, y - 1, z, B.end_stone, 0); this.growChorus(r, x, y, z, 0); }
        }
      }
    } else if (this.dim === 3) {
      for (let i = 0; i < 18; i++) this.genMinable(r, bx + r.nextInt(16), 25 + r.nextInt(95), bz + r.nextInt(16), 12, B.ambrosium_ore, B.holystone);
      for (let i = 0; i < 12; i++) this.genMinable(r, bx + r.nextInt(16), 25 + r.nextInt(95), bz + r.nextInt(16), 8, B.zanite_ore, B.holystone);
      for (let i = 0; i < 2; i++) this.genMinable(r, bx + r.nextInt(16), 25 + r.nextInt(60), bz + r.nextInt(16), 6, B.gravitite_ore, B.holystone);
      for (let i = 0; i < 8; i++) this.genMinable(r, bx + r.nextInt(16), 25 + r.nextInt(95), bz + r.nextInt(16), 16, B.icestone, B.holystone);
      for (let i = 0; i < 6; i++) this.genMinable(r, bx + r.nextInt(16), 25 + r.nextInt(95), bz + r.nextInt(16), 20, B.mossy_holystone, B.holystone);
      const trees = r.nextInt(4) + (r.nextInt(3) === 0 ? 3 : 0);
      for (let i = 0; i < trees; i++) {
        const x = rx(), z = rz(), y = this.topSolidY(x, z);
        if (r.nextInt(14) === 0) this.genTreeWith(r, x, y, z, B.golden_oak_log, B.golden_oak_leaves, B.aether_grass, true);
        else this.genTreeWith(r, x, y, z, B.skyroot_log, B.skyroot_leaves, B.aether_grass, r.nextInt(4) === 0);
      }
      if (r.nextInt(2) === 0) { const x = rx(), z = rz(); this.popPatch(r, x, this.topSolidY(x, z), z, B.purple_flower, B.aether_grass); }
      if (r.nextInt(2) === 0) { const x = rx(), z = rz(); this.popPatch(r, x, this.topSolidY(x, z), z, B.white_flower, B.aether_grass); }
      // quicksoil beaches on island rims
      for (let i = 0; i < 6; i++) {
        const x = rx(), z = rz(), y = this.topSolidY(x, z) - 1;
        if (y > 20 && this.getBlock(x, y, z) === B.aether_grass && (this.getBlock(x + 3, y, z) === 0 || this.getBlock(x - 3, y, z) === 0)) this.popSet(x, y, z, B.quicksoil, 0);
      }
      // clouds
      if (r.nextInt(3) === 0) {
        const id = r.nextInt(12) === 0 ? B.blue_aercloud : B.aercloud;
        const cx = rx(), cz = rz(), cy = 35 + r.nextInt(80);
        const a = 3 + r.nextInt(4), b = 1 + r.nextInt(2), d = 2 + r.nextInt(4);
        for (let dx = -a; dx <= a; dx++) for (let dy = -b; dy <= b; dy++) for (let dz = -d; dz <= d; dz++) {
          if ((dx * dx) / (a * a) + (dy * dy) / (b * b) + (dz * dz) / (d * d) > 1 + r.next() * 0.3) continue;
          if (this.getBlock(cx + dx, cy + dy, cz + dz) === 0) this.popSet(cx + dx, cy + dy, cz + dz, id, 0);
        }
      }
      // animals
      if (r.nextInt(6) === 0) {
        const types = ['moa', 'phyg', 'flying_cow', 'aerbunny', 'sheepuff'];
        const type = types[r.nextInt(types.length)];
        const n = 2 + r.nextInt(3);
        for (let i = 0; i < n; i++) {
          const x = bx + 8 + r.nextInt(16), z = bz + 8 + r.nextInt(16), y = this.topSolidY(x, z);
          if (this.getBlock(x, y - 1, z) !== B.aether_grass) continue;
          const k = DL.ckey(x >> 4, z >> 4);
          if (!this.pendingAnimals) this.pendingAnimals = new Map();
          if (!this.pendingAnimals.has(k)) this.pendingAnimals.set(k, []);
          this.pendingAnimals.get(k).push({ type, x: x + 0.5, y, z: z + 0.5 });
        }
      }
    }
    this._popOrigin = null;
  };

  /* ------------------------------------------------------------ */
  /* Portal blocks                                                */
  /* ------------------------------------------------------------ */
  const isFrameFor = (portal) => portal === B.nether_portal ? (id) => id === B.obsidian || id === B.crying_obsidian : (id) => id === B.glowstone;
  function portalOK(w, x, y, z, id) {
    const frame = isFrameFor(id);
    const ok = (a, b, c) => { const n = w.getBlock(a, b, c); return n === id || frame(n); };
    const zAxis = w.getMeta(x, y, z) & 1;
    if (!ok(x, y + 1, z) || !ok(x, y - 1, z)) return false;
    return zAxis ? ok(x, y, z + 1) && ok(x, y, z - 1) : ok(x + 1, y, z) && ok(x - 1, y, z);
  }
  const nc = W.neighborChanged;
  W.neighborChanged = function (x, y, z) {
    const id = this.getBlock(x, y, z);
    if ((id === B.nether_portal || id === B.aether_portal) && !portalOK(this, x, y, z, id)) { this.setBlock(x, y, z, 0, 0, 3); return; }
    if (id === B.water && this.dim === 1) { this.setBlock(x, y, z, 0, 0, 3); return; }
    return nc.apply(this, arguments);
  };
  /** Light a portal frame around (x,y,z). Returns true when it lit. */
  function lightPortal(w, x, y, z, portal) {
    const frame = isFrameFor(portal);
    const inside = (a, b, c) => { const id = w.getBlock(a, b, c); return id === 0 || id === B.fire || id === portal || (portal === B.aether_portal && S.LIQUID[id]); };
    if (!inside(x, y, z)) return false;
    for (const axis of [0, 1]) {
      const dx = axis ? 0 : 1, dz = axis ? 1 : 0;
      let by = y; while (by > 1 && inside(x, by - 1, z) && y - by < 21) by--;
      if (!frame(w.getBlock(x, by - 1, z))) continue;
      let lx = x, lz = z, n = 0;
      while (inside(lx - dx, by, lz - dz) && n < 21) { lx -= dx; lz -= dz; n++; }
      if (!frame(w.getBlock(lx - dx, by, lz - dz))) continue;
      let wd = 0; while (inside(lx + dx * wd, by, lz + dz * wd) && wd < 22) wd++;
      if (wd < 2 || wd > 21 || !frame(w.getBlock(lx + dx * wd, by, lz + dz * wd))) continue;
      let h = 0; while (inside(lx, by + h, lz) && h < 22) h++;
      if (h < 3 || h > 21) continue;
      let ok = true;
      for (let i = 0; i < wd && ok; i++) {
        if (!frame(w.getBlock(lx + dx * i, by - 1, lz + dz * i)) || !frame(w.getBlock(lx + dx * i, by + h, lz + dz * i))) ok = false;
        for (let j = 0; j < h && ok; j++) if (!inside(lx + dx * i, by + j, lz + dz * i)) ok = false;
      }
      for (let j = 0; j < h && ok; j++) if (!frame(w.getBlock(lx - dx, by + j, lz - dz)) || !frame(w.getBlock(lx + dx * wd, by + j, lz + dz * wd))) ok = false;
      if (!ok) continue;
      for (let i = 0; i < wd; i++) for (let j = 0; j < h; j++) w.setBlock(lx + dx * i, by + j, lz + dz * i, portal, axis, 2);
      if (w.fx) w.fx.sound('portal', x + 0.5, y + 0.5, z + 0.5, 1, 1);
      return true;
    }
    return false;
  }
  DL.lightPortal = lightPortal;

  /** Build a portal (frame + portal blocks) with its base at (x, y, z), running along x. */
  function buildPortal(w, x, y, z, portal) {
    const frame = portal === B.nether_portal ? B.obsidian : B.glowstone;
    const plat = w.dim === 3 ? B.holystone : w.dim === 1 ? B.obsidian : B.obsidian;
    for (let dx = -1; dx <= 2; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!SOLID[w.getBlock(x + dx, y - 1, z + dz)]) w.setBlock(x + dx, y - 1, z + dz, plat, 0, 2);
      for (let dy = 0; dy < 4; dy++) if (dz !== 0) w.setBlock(x + dx, y + dy, z + dz, 0, 0, 2);
    }
    for (let dy = -1; dy <= 3; dy++) { w.setBlock(x - 1, y + dy, z, frame, 0, 2); w.setBlock(x + 2, y + dy, z, frame, 0, 2); }
    for (const dx of [0, 1]) { w.setBlock(x + dx, y - 1, z, frame, 0, 2); w.setBlock(x + dx, y + 3, z, frame, 0, 2); }
    for (const dx of [0, 1]) for (let dy = 0; dy < 3; dy++) w.setBlock(x + dx, y + dy, z, portal, 0, 2);
  }
  function findPortal(w, x, z, id, r) {
    let best = null, bd = 1e9;
    const x0 = Math.floor(x), z0 = Math.floor(z);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const px = x0 + dx, pz = z0 + dz;
      if (!w.isReady(px, pz)) continue;
      for (let y = 1; y < CH - 1; y++) {
        if (w.getBlock(px, y, pz) !== id || w.getBlock(px, y - 1, pz) === id) continue;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = [px, y, pz]; }
      }
    }
    return best;
  }
  function findSpot(w, x, z, yTop, yBot) {
    for (let r = 0; r <= 8; r += 2) for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const px = Math.floor(x) + dx, pz = Math.floor(z) + dz;
      if (!w.isReady(px, pz)) continue;
      for (let y = yTop; y > yBot; y--) {
        const below = w.getBlock(px, y - 1, pz);
        if (!SOLID[below] || S.LIQUID[below]) continue;
        let free = true;
        for (let k = 0; k < 4 && free; k++) for (const ex of [0, 1]) { const b = w.getBlock(px + ex, y + k, pz); if (SOLID[b] || S.LIQUID[b]) free = false; }
        if (free) return [px, y, pz];
      }
    }
    return null;
  }

  /* ------------------------------------------------------------ */
  /* Game: travel between dimensions                              */
  /* ------------------------------------------------------------ */
  const GP = DL.Game.prototype;

  GP.travel = async function (dim, arrival) {
    if (this._traveling || !this.world) return;
    this._traveling = true;
    const p = this.player, old = this.world;
    const from = old.dim || 0;
    arrival = Object.assign({ type: 'command' }, arrival || {}, { from, dim });
    let tx = p.x, tz = p.z;
    if (arrival.type === 'nether' || (arrival.type === 'command' && (dim === 1 || from === 1))) {
      if (dim === 1 && from !== 1) { tx = p.x / 8; tz = p.z / 8; } else if (from === 1 && dim !== 1) { tx = p.x * 8; tz = p.z * 8; }
    }
    if (dim === 2) { tx = 88.5; tz = 0.5; }
    if (dim === 0 && (arrival.type === 'end' || arrival.type === 'respawn')) { const sp = p.spawnPoint || this.meta.spawn || [0.5, 80, 0.5]; tx = sp[0]; tz = sp[2]; }
    arrival.x = tx; arrival.z = tz;
    const ls = new G.LoadingScreen(this);
    ls.title = arrival.type === 'respawn' ? 'Respawning' : 'Entering ' + NAMES[dim];
    ls.status = 'Building terrain'; ls.progress = 0;
    this.setScreen(ls);
    this.loadingScreen = ls;
    this.inGame = false;
    A.play('portal', null, null, null, 0.6, 1);
    try {
      await this.saveWorld();
      for (const c of old.chunks.values()) this.renderer.freeChunk(c);
      old.destroy();
      const slot = this.meta.slot;
      const wslot = DL.dimSlot(slot, dim);
      const keys = await DL.Storage.chunkKeys(wslot);
      const st = this.settings;
      const world = new DL.World({
        seed: this.meta.seed, slot: wslot, dim, name: this.meta.name, time: old.time, renderDist: G.RENDER_DISTS[st.renderDist].v,
        fancy: st.fancy, smooth: st.smooth, difficulty: st.difficulty, savedKeys: new Set(keys)
      });
      world.baseSlot = slot;
      world.timeFrozen = old.timeFrozen;
      if (dim === 2) St.endFountain(world);
      this.world = world;
      this.meta.dim = dim;
      this.hookWorld(world);
      p.world = world;
      world.player = p;
      world.entities.push(p);
      p.setPos(tx, dim === 2 ? 50 : 100, tz);
      p.vx = p.vy = p.vz = 0; p.fallDistance = 0; p.portalTime = 0; p.portalLock = true; p.gliding = false;
      p.levitation = 0;
      this.loading = { t0: performance.now(), isNew: false, phase: 0 };
      this.pendingArrival = arrival;
      this.renderer.particles.length = 0;
      this.collectAnims.length = 0;
    } catch (e) {
      console.error('travel failed', e);
    }
    this._traveling = false;
  };

  GP.arrive = function (a) {
    const w = this.world, p = this.player;
    const dim = w.dim || 0;
    if (a.type === 'nether' || a.type === 'aether') {
      const id = a.type === 'nether' ? B.nether_portal : B.aether_portal;
      let pos = findPortal(w, a.x, a.z, id, 16);
      if (!pos) {
        let spot;
        if (dim === 1) spot = findSpot(w, a.x, a.z, 100, 32) || [Math.floor(a.x), 70, Math.floor(a.z)];
        else if (dim === 3) { const y = w.topSolidY(Math.floor(a.x), Math.floor(a.z)); spot = y > 20 ? [Math.floor(a.x), y, Math.floor(a.z)] : [Math.floor(a.x), 90, Math.floor(a.z)]; if (y <= 20) for (let dx = -3; dx <= 4; dx++) for (let dz = -3; dz <= 3; dz++) w.setBlock(spot[0] + dx, 89, spot[2] + dz, B.holystone, 0, 2); }
        else { const y = w.topSolidY(Math.floor(a.x), Math.floor(a.z)); spot = [Math.floor(a.x), Math.max(y, S.SEA + 1), Math.floor(a.z)]; }
        buildPortal(w, spot[0], spot[1], spot[2], id);
        pos = spot;
      }
      p.setPos(pos[0] + 0.5, pos[1], pos[2] + 0.5);
    } else if (dim === 2 && a.type !== 'fall') {
      const x = 88, z = 0, top = w.topSolidY(88, 0);
      const y = top > 40 ? top - 1 : 48;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        w.setBlock(x + dx, y, z + dz, B.obsidian, 0, 2);
        for (let dy = 1; dy <= 3; dy++) w.setBlock(x + dx, y + dy, z + dz, 0, 0, 2);
      }
      p.setPos(x + 0.5, y + 1, z + 0.5);
      p.yaw = Math.PI / 2;
    } else if (dim === 0 && (a.type === 'end' || a.type === 'respawn')) {
      const sp = p.spawnPoint || this.meta.spawn || [0.5, 80, 0.5];
      p.setPos(sp[0], sp[1], sp[2]);
    } else if (a.type === 'fall') {
      const y = w.topSolidY(Math.floor(p.x), Math.floor(p.z));
      p.setPos(p.x, Math.max(y, 1) + 0.1, p.z);
    } else {
      // command travel: land somewhere sensible
      if (dim === 1) {
        const s = findSpot(w, p.x, p.z, 100, 32);
        if (s) p.setPos(s[0] + 0.5, s[1], s[2] + 0.5);
        else { const x = Math.floor(p.x), z = Math.floor(p.z); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { w.setBlock(x + dx, 69, z + dz, B.netherrack, 0, 2); for (let dy = 0; dy < 3; dy++) w.setBlock(x + dx, 70 + dy, z + dz, 0, 0, 2); } p.setPos(x + 0.5, 70, z + 0.5); }
      } else if (dim === 3) {
        const x = Math.floor(p.x), z = Math.floor(p.z), y = w.topSolidY(x, z);
        if (y > 20) p.setPos(p.x, y, p.z);
        else { for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) w.setBlock(x + dx, 89, z + dz, B.holystone, 0, 2); p.setPos(x + 0.5, 90, z + 0.5); }
      } else {
        const y = w.topSolidY(Math.floor(p.x), Math.floor(p.z));
        p.setPos(p.x, Math.max(y, 1), p.z);
      }
    }
    p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
    this.chatMessage('§d' + (a.type === 'respawn' ? 'Respawned' : 'Welcome to ' + NAMES[dim]));
  };

  const placeSafely = GP.placeSafely;
  GP.placeSafely = function (p) {
    if (this.pendingArrival) { const a = this.pendingArrival; this.pendingArrival = null; try { this.arrive(a); } catch (e) { console.error(e); } }
    return placeSafely.call(this, p);
  };

  const respawn = GP.respawn;
  GP.respawn = function () {
    if (this.world && this.world.dim) {
      const p = this.player;
      p.health = 20; p.deathTime = 0; p.fire = 0; p.air = 300; p.hurtTime = 0; p.hurtResist = 0;
      p.vx = p.vy = p.vz = 0; p.fallDistance = 0; p.score = 0;
      this.setScreen(null);
      this.travel(0, { type: 'respawn' });
      return;
    }
    return respawn.call(this);
  };

  const hookWorld = GP.hookWorld;
  GP.hookWorld = function (world) {
    hookWorld.call(this, world);
    world.onDragonDeath = () => {
      const first = !this.meta.dragonKilled;
      this.meta.dragonKilled = true;
      St.lightExitPortal(world, first);
      this.player.score += 12000;
      this.chatMessage('§dThe Ender Dragon has been slain! The exit portal has opened.');
      A.play('roar', null, null, null, 1, 0.6);
    };
  };

  /* ------------------------------------------------------------ */
  /* Per-tick: portals, dragon, void, glowing ambience            */
  /* ------------------------------------------------------------ */
  const tick = GP.tick;
  GP.tick = function () {
    const p = this.player, w = this.world;
    // elytra: start gliding with a mid-air jump
    const jumpNow = !G.screen && this.jumpHeld;
    const ely = p.armor && p.armor[1] && I.get(p.armor[1].id) && I.get(p.armor[1].id).elytra;
    if (jumpNow && !this._jumpEdge && ely && !p.onGround && !p.flying && !p.inWater && p.vy < 0 && !p.gliding) { p.gliding = true; In.haptic('tick'); }
    this._jumpEdge = jumpNow;
    if (p.gliding && (p.onGround || p.inWater || !ely || p.flying)) p.gliding = false;
    tick.call(this);
    if (this.world !== w || !this.inGame || this._traveling) return;
    if (G.screen && G.screen.pauses) return;
    if (p.health > 0) {
      // any portal block touching the player's body counts
      let inP = 0, meta = 0;
      const bb = p.box;
      for (let x = Math.floor(bb[0] + 0.05); x <= Math.floor(bb[3] - 0.05) && !inP; x++)
        for (let z = Math.floor(bb[2] + 0.05); z <= Math.floor(bb[5] - 0.05) && !inP; z++)
          for (let y = Math.floor(bb[1]); y <= Math.floor(bb[4] - 0.05) && !inP; y++) {
            const id = w.getBlock(x, y, z);
            if (id === B.nether_portal || id === B.aether_portal || id === B.end_portal) { inP = id; meta = w.getMeta(x, y, z); }
          }
      // after arriving, step out of the portal before it can take you back
      if (!inP) p.portalLock = false;
      const ready = !p.portalLock;
      if (inP === B.end_portal) {
        if (!ready) { /* just arrived */ }
        else if (meta & 1) {
          // End gateway: hop to the outer islands and back
          const out = Math.hypot(p.x, p.z) < 300;
          p.portalLock = true;
          if (out) { p.setPos(0.5, 100, 1000.5); p.pendingGateway = [0, 1000]; }
          else p.setPos(0.5, (w.endFountainY || 64) + 16, 88.5);
          p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
          A.play('teleport', null, null, null, 1, 1);
        } else {
          p.portalTime = 0;
          this.travel(w.dim === 2 ? 0 : 2, { type: 'end' });
          return;
        }
      } else if (inP) {
        if (!ready) p.portalTime = 0;
        else {
          p.portalTime = (p.portalTime || 0) + 1;
          if (p.portalTime === 1) A.play('portal', null, null, null, 0.4, 1);
          if (p.portalTime >= (p.creative ? 2 : 80)) {
            p.portalTime = 0;
            if (inP === B.nether_portal) this.travel(w.dim === 1 ? 0 : 1, { type: 'nether' });
            else this.travel(w.dim === 3 ? 0 : 3, { type: 'aether' });
            return;
          }
        }
      } else if (p.portalTime > 0) p.portalTime = Math.max(0, p.portalTime - 4);
    }
    // land safely after an End gateway hop (and build the way back)
    if (p.pendingGateway && w.isReady(p.pendingGateway[0], p.pendingGateway[1])) {
      const [gx, gz] = p.pendingGateway;
      p.pendingGateway = null;
      let y = w.topSolidY(gx, gz);
      if (y < 30) { y = 90; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) w.setBlock(gx + dx, 89, gz + dz, B.end_stone, 0, 2); }
      p.setPos(gx + 0.5, y, gz + 0.5); p.vy = 0; p.fallDistance = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) w.setBlock(gx + 4 + dx, y + 2 + dy, gz + dz, dx === 0 && dz === 0 ? B.end_portal : B.bedrock, dx === 0 && dz === 0 ? 1 : 0, 2);
    }
    if (p.pendingGateway) { p.vy = 0; p.fallDistance = 0; }
    // fall out of the Aether into the Overworld
    if (w.dim === 3 && p.y < -8 && p.health > 0) { this.travel(0, { type: 'fall' }); return; }
    // the dragon
    if (w.dim === 2 && w.isReady(0, 0) && !w._dragonChecked) {
      w._dragonChecked = true;
      const fy = w.endFountainY || St.endFountain(w);
      if (!this.meta.dragonKilled) {
        const d = E.spawnMob(w, 'ender_dragon', 0.5, fy + 30, 0.5);
        d.persistent = true;
        A.play('roar', null, null, null, 1, 1);
      } else if (w.getBlock(2, fy, 0) !== B.end_portal) St.lightExitPortal(w, false);
    }
    // portal ambience
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(p.x) + w.rng.nextInt(24) - 12, y = Math.floor(p.y) + w.rng.nextInt(16) - 8, z = Math.floor(p.z) + w.rng.nextInt(24) - 12;
      const id = w.getBlock(x, y, z);
      if (id === B.nether_portal || id === B.end_portal || id === B.aether_portal) this.spawnParticles('portal', x + Math.random(), y + Math.random(), z + Math.random(), 1, 0);
      else if (id === B.end_rod && Math.random() < 0.2) this.spawnParticles('happy', x + 0.5, y + 0.7, z + 0.5, 1, 0.2);
    }
  };

  /* ------------------------------------------------------------ */
  /* Item use: portals, eyes, pearls, fire charges, wart          */
  /* ------------------------------------------------------------ */
  function faceOffset(f) { return [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][f] || [0, 1, 0]; }
  const useItem = GP.useItem;
  GP.useItem = function () {
    const p = this.player, w = this.world, t = this.target, held = p.held;
    const id = held ? held.id : 0;
    if (t && !t.entity) {
      const blk = w.getBlock(t.x, t.y, t.z);
      const [dx, dy, dz] = faceOffset(t.face);
      const ax = t.x + dx, ay = t.y + dy, az = t.z + dz;
      if ((id === 259 || id === 385) && (blk === B.obsidian || blk === B.crying_obsidian)) {
        if (lightPortal(w, ax, ay, az, B.nether_portal)) { if (id === 259) p.damageHeld(1); else if (!p.creative) p.consumeHeld(1); p.swing(); In.haptic('place'); return; }
      }
      if (id === 385) {
        if (w.getBlock(ax, ay, az) === 0) { w.setBlock(ax, ay, az, B.fire, 0, 3); A.play('fizz', ax + 0.5, ay + 0.5, az + 0.5, 0.6, 1.2); if (!p.creative) p.consumeHeld(1); p.swing(); }
        return;
      }
      if (id === 326 && blk === B.glowstone) {
        if (lightPortal(w, ax, ay, az, B.aether_portal)) { if (!p.creative) p.held = I.stack(325); p.swing(); In.haptic('place'); A.play('splash', ax, ay, az, 0.5, 1); return; }
      }
      if (id === 326 && w.dim === 1) {
        A.play('fizz', ax + 0.5, ay + 0.5, az + 0.5, 0.8, 2);
        this.spawnParticles('smoke', ax + 0.5, ay + 0.5, az + 0.5, 8, 0.8);
        if (!p.creative) p.held = I.stack(325);
        p.swing();
        return;
      }
      if (id === 381 && blk === B.end_portal_frame) {
        const m = w.getMeta(t.x, t.y, t.z);
        if (!(m & 4)) {
          w.setBlock(t.x, t.y, t.z, B.end_portal_frame, m | 4, 3);
          if (!p.creative) p.consumeHeld(1);
          p.swing(); A.play('teleport', t.x, t.y, t.z, 0.8, 0.7);
          this.spawnParticles('portal', t.x + 0.5, t.y + 1, t.z + 0.5, 12, 0.6);
          if (this.checkEndPortal(t.x, t.y, t.z)) { A.play('portal', t.x, t.y, t.z, 1.5, 0.8); this.chatMessage('§dThe End portal has opened...'); }
        }
        return;
      }
      if (id === 372) {
        if (blk === B.soul_sand && t.face === 1 && w.getBlock(ax, ay, az) === 0) { w.setBlock(ax, ay, az, B.nether_wart, 0, 3); this.afterPlace(B.nether_wart, ax, ay, az); }
        return;
      }
      if (id === 351) {
        if (blk === B.wheat || blk === B.nether_wart) { w.setBlock(t.x, t.y, t.z, blk, blk === B.wheat ? 7 : 3, 3); this.spawnParticles('happy', t.x + 0.5, t.y + 0.5, t.z + 0.5, 8, 0.8); if (!p.creative) p.consumeHeld(1); p.swing(); return; }
        if (blk === B.grass || blk === B.aether_grass) {
          for (let i = 0; i < 24; i++) {
            const x = t.x + Math.floor(Math.random() * 7) - 3, z = t.z + Math.floor(Math.random() * 7) - 3;
            if (w.getBlock(x, t.y, z) === blk && w.getBlock(x, t.y + 1, z) === 0 && Math.random() < 0.5) w.setBlock(x, t.y + 1, z, blk === B.grass ? (Math.random() < 0.5 ? B.dandelion : B.rose) : (Math.random() < 0.5 ? B.purple_flower : B.white_flower), 0, 3);
          }
          this.spawnParticles('happy', t.x + 0.5, t.y + 1.2, t.z + 0.5, 12, 3);
          if (!p.creative) p.consumeHeld(1); p.swing(); return;
        }
      }
    }
    if (!(t && t.entity)) {
      if (id === 368) {
        E.shoot({ world: w, x: p.x, y: p.y, z: p.z, eye: p.eye - 0.1, def: {}, type: 'player' }, 'ender_pearl', { x: p.x + p.look()[0] * 10, y: p.y + p.eye - 1 + p.look()[1] * 10, z: p.z + p.look()[2] * 10, h: 2 }, 1.5, 1).shooter = p;
        A.play('bow', p.x, p.y, p.z, 0.5, 0.4); if (!p.creative) p.consumeHeld(1); p.swing(); return;
      }
      if (id === 381 && (w.dim || 0) === 0) {
        let best = null, bd = 1e9;
        for (const s of St.strongholds(w.seed)) { const d = Math.hypot(s[0] - p.x, s[2] - p.z); if (d < bd) { bd = d; best = s; } }
        if (best) {
          w.entities.push(new E.EyeOfEnder(w, p.x, p.y + p.eye, p.z, best[0] + 0.5, best[2] + 0.5));
          A.play('teleport', p.x, p.y, p.z, 0.6, 0.5);
          if (!p.creative) p.consumeHeld(1); p.swing(); return;
        }
      }
      if (id === 432 && p.health < 20) {
        useItem.call(this);
        E.teleportRandom(p, 8);
        return;
      }
    }
    return useItem.call(this);
  };
  /** When all 12 frames around a 3x3 hole have eyes, fill it with End portal blocks. */
  GP.checkEndPortal = function (x, y, z) {
    const w = this.world;
    for (let cx = x - 2; cx <= x + 2; cx++) for (let cz = z - 2; cz <= z + 2; cz++) {
      let ok = true;
      for (let i = -1; i <= 1 && ok; i++) {
        for (const [fx, fz] of [[cx + i, cz - 2], [cx + i, cz + 2], [cx - 2, cz + i], [cx + 2, cz + i]]) {
          if (w.getBlock(fx, y, fz) !== B.end_portal_frame || !(w.getMeta(fx, y, fz) & 4)) { ok = false; break; }
        }
      }
      if (!ok) continue;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) w.setBlock(cx + i, y, cz + j, B.end_portal, 0, 3);
      return true;
    }
    return false;
  };

  /* ------------------------------------------------------------ */
  /* Elytra gliding                                               */
  /* ------------------------------------------------------------ */
  const P = E.Player.prototype;
  const travel = P.travel;
  P.travel = function (strafe, forward) {
    if (!this.gliding) return travel.call(this, strafe, forward);
    const l = this.look();
    const hl = Math.hypot(l[0], l[2]);
    const hv = Math.hypot(this.vx, this.vz);
    const pitch = Math.asin(Math.max(-1, Math.min(1, l[1])));
    let f = Math.cos(pitch); f = f * f;
    this.vy += -0.08 + f * 0.06;
    if (this.vy < 0 && hl > 0) { const d = this.vy * -0.1 * f; this.vy += d; this.vx += l[0] / hl * d; this.vz += l[2] / hl * d; }
    if (pitch > 0 && hl > 0) { const d = hv * Math.sin(pitch) * 0.04; this.vy += d * 3.2; this.vx -= l[0] / hl * d; this.vz -= l[2] / hl * d; }
    if (hl > 0) { this.vx += (l[0] / hl * hv - this.vx) * 0.1; this.vz += (l[2] / hl * hv - this.vz) * 0.1; }
    this.vx *= 0.99; this.vy *= 0.98; this.vz *= 0.99;
    const before = Math.hypot(this.vx, this.vz);
    this.move(this.vx, this.vy, this.vz);
    this.fallDistance = Math.max(0, -this.vy) * 2;
    if (this.collidedH) { const dmg = Math.floor((before - Math.hypot(this.vx, this.vz)) * 10 - 3); if (dmg > 0) this.damage('fall', dmg); }
    this.prevLimbAmount = this.limbSwingAmount;
    this.limbSwingAmount *= 0.8;
  };

  /* ------------------------------------------------------------ */
  /* Skies                                                        */
  /* ------------------------------------------------------------ */
  const R = DL.Renderer ? DL.Renderer.prototype : null;
  if (R) {
    const computeSky = R.computeSky;
    R.computeSky = function (world, pt, lookDir, rd) {
      if (world.dim === 1) { this.skyColor = [0.2, 0.03, 0.03]; this.fogColor = [0.22, 0.04, 0.03]; this.sunrise = null; this.starBright = 0; this.celestial = 0; return; }
      if (world.dim === 2) { this.skyColor = [0.04, 0.02, 0.06]; this.fogColor = [0.07, 0.05, 0.1]; this.sunrise = null; this.starBright = 0.7; this.celestial = 0; return; }
      computeSky.call(this, world, pt, lookDir, rd);
      if (world.dim === 3) {
        this.skyColor = this.skyColor.map((c, i) => c * 0.8 + [0.55, 0.62, 0.95][i] * 0.2 * Math.max(0.2, 1 - world.skySubtracted(pt) / 11));
        this.fogColor = this.fogColor.map((c, i) => c * 0.85 + [0.8, 0.8, 1.0][i] * 0.15 * Math.max(0.2, 1 - world.skySubtracted(pt) / 11));
      }
    };
    const renderSky = R.renderSky;
    R.renderSky = function (world, pt) {
      if (world.dim === 1) return;
      if (world.dim === 2) {
        const gl = this.gl;
        gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
        M4.multiply(this.mvp, this.proj, this.view);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        this.begin();
        const v = this.starVerts;
        for (let i = 0; i < v.length; i += 3) this.vtx(v[i], v[i + 1], v[i + 2], 0, 0, 0.55, 0.45, 0.7, 1);
        this.flush('quads', { mvp: this.mvp });
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.enable(gl.CULL_FACE);
        return;
      }
      return renderSky.call(this, world, pt);
    };
    const renderClouds = R.renderClouds;
    R.renderClouds = function (world, pt, fancy) {
      if (world.dim === 1 || world.dim === 2) return;
      return renderClouds.call(this, world, pt, fancy);
    };
  }

  /* ------------------------------------------------------------ */
  /* HUD: boss bar, portal haze, dimension in debug              */
  /* ------------------------------------------------------------ */
  const extras = G.drawHUDExtras;
  G.drawHUDExtras = function (game, Wd, H, hy) {
    const p = game.player, w = game.world;
    if (p && p.portalTime > 0) G.rect(0, 0, Wd, H, 'rgba(130,50,220,' + Math.min(0.55, p.portalTime / 80 * 0.55).toFixed(3) + ')');
    const boss = w && w.boss;
    if (boss && !boss.removed && boss.health > 0 && p && p.distTo(boss) < 160) {
      const bw = 182, x = Math.floor((Wd - bw) / 2), y = 14 + (G.safe ? G.safe.t : 0);
      G.textC(boss.def.boss, Wd / 2, y - 10, '#FF66FF');
      G.rect(x - 1, y - 1, bw + 2, 7, '#000000');
      G.rect(x, y, bw, 5, '#4a104a');
      G.rect(x, y, Math.max(0, bw * boss.health / boss.maxHealth), 5, '#e050e0');
      G.rect(x, y, Math.max(0, bw * boss.health / boss.maxHealth), 1, '#ffa0ff');
    }
    return extras.call(this, game, Wd, H, hy);
  };
})();
