/*
 * DreamLand - world runtime: chunk pipeline, lighting, population, block
 * updates, fluids, random ticks, explosions and persistence.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, CH = S.CH;
  const LOPAC = S.LOPAC, LEMIT = S.LEMIT, SOLID = S.SOLID, OPAQUE = S.OPAQUE, REPLACE = S.REPLACE;

  function ckey(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }
  DL.ckey = ckey;

  /* ---------------------------------------------------------------- */
  /* Worker pool                                                      */
  /* ---------------------------------------------------------------- */
  function WorkerPool(seed, dim, onMessage) {
    this.workers = [];
    this.busy = [];
    this.onMessage = onMessage;
    this.seed = seed;
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    let src = null;
    try {
      src = URL.createObjectURL(new Blob([
        'var DL_SHARED_FACTORY=' + DL_SHARED_FACTORY.toString() + ';\n',
        '(' + DL_WORKER_MAIN.toString() + ')(DL_SHARED_FACTORY());'
      ], { type: 'application/javascript' }));
      for (let i = 0; i < n; i++) {
        const w = new Worker(src);
        const idx = i;
        w.onmessage = (e) => { this.busy[idx]--; this.onMessage(e.data); };
        w.onerror = (e) => { console.error('worker error', e.message || e); };
        w.postMessage({ t: 'init', seed, dim });
        this.workers.push(w);
        this.busy.push(0);
      }
    } catch (e) {
      console.warn('Workers unavailable, falling back to main thread', e);
      this.workers = [];
    }
    if (!this.workers.length) {
      this.fallbackGen = new S.Generator(seed, dim);
      this.fallbackMesher = new S.Mesher();
      this.fallbackQueue = [];
    }
  }
  WorkerPool.prototype.load = function () {
    let s = 0; for (const b of this.busy) s += b; return s;
  };
  WorkerPool.prototype.capacity = function () { return Math.max(2, this.workers.length * 3); };
  WorkerPool.prototype.submit = function (msg, transfer) {
    if (this.dead) return;
    if (!this.workers.length) {
      this.fallbackQueue.push(msg);
      return;
    }
    let best = 0;
    for (let i = 1; i < this.busy.length; i++) if (this.busy[i] < this.busy[best]) best = i;
    this.busy[best]++;
    this.workers[best].postMessage(msg, transfer || []);
  };
  WorkerPool.prototype.pumpFallback = function (budgetMs) {
    if (this.workers.length || this.dead) return;
    const t0 = performance.now();
    while (this.fallbackQueue.length && performance.now() - t0 < budgetMs) {
      const m = this.fallbackQueue.shift();
      if (m.t === 'gen') {
        const r = this.fallbackGen.generate(m.cx, m.cz);
        this.onMessage({ t: 'gen', cx: m.cx, cz: m.cz, blocks: r.blocks, meta: r.meta, biomes: r.biomes });
      } else if (m.t === 'mesh') {
        const r = this.fallbackMesher.mesh(m);
        this.onMessage({ t: 'mesh', key: m.key, ver: m.ver, solid: r.solid, solidCount: r.solidCount, trans: r.trans, transCount: r.transCount });
      }
    }
  };
  WorkerPool.prototype.terminate = function () { for (const w of this.workers) w.terminate(); this.workers = []; this.dead = true; };

  /* ---------------------------------------------------------------- */
  /* Chunk                                                            */
  /* ---------------------------------------------------------------- */
  function Section(chunk, sy) {
    this.chunk = chunk; this.sy = sy;
    this.dirty = false; this.ver = 0; this.pending = false; this.queued = false;
    this.gl = null; // renderer data
  }
  function Chunk(cx, cz) {
    this.cx = cx; this.cz = cz; this.key = ckey(cx, cz);
    this.blocks = null; this.meta = null; this.light = new Uint8Array(16 * 16 * CH); this.biomes = null;
    this.generated = false; this.populated = false; this.lit = false; this.meshReady = false;
    this.sections = [];
    for (let i = 0; i < CH / 16; i++) this.sections.push(new Section(this, i));
    this.tiles = new Map();
    this.needsSave = false;
    this.savedEntities = null;
    this.loadedFromDisk = false;
  }
  DL.Chunk = Chunk;

  /* ---------------------------------------------------------------- */
  /* Int queue for BFS                                                */
  /* ---------------------------------------------------------------- */
  function IntQueue(cap) { this.a = new Int32Array(cap); this.h = 0; this.t = 0; }
  IntQueue.prototype.push = function (v) {
    if (this.t >= this.a.length) {
      if (this.h > 0) { this.a.copyWithin(0, this.h, this.t); this.t -= this.h; this.h = 0; }
      if (this.t >= this.a.length) { const n = new Int32Array(this.a.length * 2); n.set(this.a); this.a = n; }
    }
    this.a[this.t++] = v;
  };
  IntQueue.prototype.shift = function () { return this.a[this.h++]; };
  IntQueue.prototype.empty = function () { return this.h >= this.t; };
  IntQueue.prototype.clear = function () { this.h = this.t = 0; };

  /* ---------------------------------------------------------------- */
  /* World                                                            */
  /* ---------------------------------------------------------------- */
  function World(opts) {
    this.seed = opts.seed | 0;
    this.slot = opts.slot;
    this.name = opts.name || 'World';
    this.chunks = new Map();
    this.time = opts.time || 0;
    this.totalTicks = 0;
    this.renderDist = opts.renderDist || 8;
    this.fancy = opts.fancy !== false;
    this.smooth = opts.smooth !== false;
    this.difficulty = opts.difficulty === undefined ? 2 : opts.difficulty;
    this.dim = opts.dim || 0;
    this.gen = new S.Generator(this.seed, this.dim);
    this.rng = new S.RNG(this.seed ^ 0x55aa);
    this.popRng = new S.RNG(0);
    this.entities = [];
    this.pendingGen = new Set();
    this.savedKeys = opts.savedKeys || new Set();
    this.checkQueue = new Set();
    this.dirtySections = new Set();
    this.meshResults = [];
    this.genResults = [];
    this.scheduled = [];
    this.scheduledKeys = new Set();
    this.furnaces = new Set();
    this.spawners = new Set();
    this.fx = null; // effect hooks installed by game
    this.lastCenter = null;
    this.wanted = [];
    this.mesher = new S.Mesher();
    this.lq = new IntQueue(1 << 16);
    this.rq = new IntQueue(1 << 16);
    this.stats = { genMs: 0, lightMs: 0, meshJobs: 0, chunkUpdates: 0 };
    this.pool = new WorkerPool(this.seed, this.dim, (m) => {
      if (m.t === 'gen') this.genResults.push(m);
      else if (m.t === 'mesh') this.meshResults.push(m);
    });
    this.spawn = opts.spawn || null;
  }
  DL.World = World;

  World.prototype.destroy = function () { this.pool.terminate(); };

  World.prototype.getChunk = function (cx, cz) {
    const c = this._lc;
    if (c && c.cx === cx && c.cz === cz) return c;
    const r = this.chunks.get(ckey(cx, cz));
    if (r) this._lc = r;
    return r;
  };
  World.prototype.chunkAt = function (x, z) { return this.getChunk(x >> 4, z >> 4); };
  World.prototype.isReady = function (x, z) { const c = this.getChunk(x >> 4, z >> 4); return !!(c && c.lit); };
  World.prototype.getBlock = function (x, y, z) {
    if (y < 0 || y >= CH) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.blocks) return 0;
    return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  };
  World.prototype.getMeta = function (x, y, z) {
    if (y < 0 || y >= CH) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.meta) return 0;
    return c.meta[(y << 8) | ((z & 15) << 4) | (x & 15)];
  };
  World.prototype.getSky = function (x, y, z) {
    if (y >= CH) return 15;
    if (y < 0) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.lit) return 15;
    return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] >> 4;
  };
  World.prototype.getBlockLight = function (x, y, z) {
    if (y < 0 || y >= CH) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.lit) return 0;
    return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] & 15;
  };
  /** Effective light level (0..15) accounting for time of day. */
  World.prototype.getLightLevel = function (x, y, z) {
    return Math.max(this.getSky(x, y, z) - this.skySubtracted(), this.getBlockLight(x, y, z));
  };
  World.prototype.topY = function (x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.blocks) return 0;
    const lx = x & 15, lz = z & 15;
    for (let y = CH - 1; y > 0; y--) if (LOPAC[c.blocks[(y << 8) | (lz << 4) | lx]] > 0 || SOLID[c.blocks[(y << 8) | (lz << 4) | lx]]) return y + 1;
    return 0;
  };
  World.prototype.topSolidY = function (x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.blocks) return 0;
    const lx = x & 15, lz = z & 15;
    for (let y = CH - 1; y > 0; y--) { const b = c.blocks[(y << 8) | (lz << 4) | lx]; if (SOLID[b] || S.LIQUID[b]) return y + 1; }
    return 0;
  };

  /* ---------------------------------------------------------------- */
  /* Time of day                                                      */
  /* ---------------------------------------------------------------- */
  World.prototype.celestialAngle = function (partial) {
    const t = ((this.time % 24000) + (partial || 0)) / 24000 - 0.25;
    let f = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    const f1 = f;
    f = 1 - (Math.cos(f * Math.PI) + 1) / 2;
    return f1 + (f - f1) / 3;
  };
  World.prototype.skySubtracted = function (partial) {
    if (this.dim === 1) return 0;
    if (this.dim === 2) return 3;
    const a = this.celestialAngle(partial);
    let f = 1 - (Math.cos(a * Math.PI * 2) * 2 + 0.5);
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    return f * 11;
  };
  World.prototype.isDaytime = function () { return this.skySubtracted() < 4; };

  /* ---------------------------------------------------------------- */
  /* Block access                                                     */
  /* ---------------------------------------------------------------- */
  World.prototype.setBlockRaw = function (x, y, z, id, meta) {
    if (y < 0 || y >= CH) return;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.blocks) return;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15);
    c.blocks[i] = id; c.meta[i] = meta || 0;
    c.needsSave = true;
  };

  /**
   * Set a block with lighting, re-meshing and neighbour notifications.
   * flags: 1 = notify neighbours, 2 = sync remesh (player edits)
   */
  World.prototype.setBlock = function (x, y, z, id, meta, flags) {
    if (y < 0 || y >= CH) return false;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.blocks) return false;
    meta = meta || 0;
    if (flags === undefined) flags = 1;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15);
    const old = c.blocks[i], oldMeta = c.meta[i];
    if (old === id && oldMeta === meta) return false;
    c.blocks[i] = id; c.meta[i] = meta;
    c.needsSave = true;
    if (old !== id) this.onBlockReplaced(c, i, x, y, z, old, oldMeta, id);
    if (c.lit && (LOPAC[old] !== LOPAC[id] || LEMIT[old] !== LEMIT[id])) this.relight(x, y, z);
    this.markBlockDirty(x, y, z);
    if (flags & 1) this.notifyNeighbors(x, y, z, id);
    if (flags & 2) this.flushNear(x, y, z);
    return true;
  };
  World.prototype.setMeta = function (x, y, z, meta, flags) {
    return this.setBlock(x, y, z, this.getBlock(x, y, z), meta, flags);
  };

  World.prototype.onBlockReplaced = function (c, i, x, y, z, old, oldMeta, id) {
    if (c.tiles.has(i)) {
      const te = c.tiles.get(i);
      c.tiles.delete(i);
      this.furnaces.delete(te); this.spawners.delete(te);
      if (te.items && this.fx) {
        for (const s of te.items) if (s && s.count > 0) this.spawnItem(x + 0.5, y + 0.5, z + 0.5, s, true);
      }
    }
    if (id === B.chest) this.setTile(x, y, z, { type: 'chest', items: new Array(27).fill(null) });
    if (id === B.furnace || id === B.lit_furnace) {
      const prev = this._furnaceCarry;
      const te = prev || { type: 'furnace', items: [null, null, null], burn: 0, burnMax: 0, cook: 0 };
      this._furnaceCarry = null;
      this.setTile(x, y, z, te);
    }
  };

  World.prototype.getTile = function (x, y, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return null;
    return c.tiles.get((y << 8) | ((z & 15) << 4) | (x & 15)) || null;
  };
  World.prototype.setTile = function (x, y, z, te) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return;
    te.x = x; te.y = y; te.z = z;
    c.tiles.set((y << 8) | ((z & 15) << 4) | (x & 15), te);
    if (te.type === 'furnace') this.furnaces.add(te);
    if (te.type === 'spawner') this.spawners.add(te);
    c.needsSave = true;
  };

  World.prototype.markBlockDirty = function (x, y, z) {
    const x0 = (x - 1) >> 4, x1 = (x + 1) >> 4, z0 = (z - 1) >> 4, z1 = (z + 1) >> 4;
    const y0 = Math.max(0, (y - 1) >> 4), y1 = Math.min(CH / 16 - 1, (y + 1) >> 4);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const c = this.getChunk(cx, cz);
      if (!c || !c.meshReady) continue;
      for (let sy = y0; sy <= y1; sy++) this.markSectionDirty(c.sections[sy]);
    }
  };
  World.prototype.markSectionDirty = function (s) {
    s.dirty = true; s.ver++;
    if (!s.queued) { s.queued = true; this.dirtySections.add(s); }
  };

  /* ---------------------------------------------------------------- */
  /* Lighting                                                         */
  /* ---------------------------------------------------------------- */
  // Pack world coords relative to an origin into an int.
  World.prototype._pack = function (x, y, z) { return ((x - this._ox) & 2047) | (y << 11) | (((z - this._oz) & 2047) << 18); };

  World.prototype.lightChunk = function (c) {
    const t0 = performance.now();
    const bl = c.blocks, li = c.light;
    li.fill(0);
    const bx = c.cx * 16, bz = c.cz * 16;
    this._ox = bx - 512; this._oz = bz - 512;
    const skyQ = this.lq; skyQ.clear();
    const blkQ = this.rq; blkQ.clear();
    // sky columns
    const hm = new Uint8Array(256);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let lv = 15, h = 0;
      for (let y = CH - 1; y >= 0; y--) {
        const i = (y << 8) | (z << 4) | x;
        const op = LOPAC[bl[i]];
        if (op) { if (!h) h = y + 1; lv -= op; if (lv <= 0) break; }
        li[i] = lv << 4;
      }
      hm[(z << 4) | x] = h;
    }
    c.heightMap = hm;
    // sky seeds: lit cells next to cells in shadow
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const h = hm[(z << 4) | x];
      let maxN = h;
      if (x > 0) maxN = Math.max(maxN, hm[(z << 4) | (x - 1)]);
      if (x < 15) maxN = Math.max(maxN, hm[(z << 4) | (x + 1)]);
      if (z > 0) maxN = Math.max(maxN, hm[((z - 1) << 4) | x]);
      if (z < 15) maxN = Math.max(maxN, hm[((z + 1) << 4) | x]);
      if (x === 0 || x === 15 || z === 0 || z === 15) maxN = CH - 1;
      for (let y = Math.max(0, h - 16); y <= Math.min(CH - 1, maxN); y++) {
        const i = (y << 8) | (z << 4) | x;
        if ((li[i] >> 4) > 1) skyQ.push(this._pack(bx + x, y, bz + z));
      }
    }
    // block light sources
    for (let i = 0; i < bl.length; i++) {
      const e = LEMIT[bl[i]];
      if (e) {
        li[i] |= e;
        blkQ.push(this._pack(bx + (i & 15), i >> 8, bz + ((i >> 4) & 15)));
      }
    }
    // pull light from lit neighbours across borders
    const nbs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dz] of nbs) {
      const n = this.getChunk(c.cx + dx, c.cz + dz);
      if (!n || !n.lit) continue;
      for (let k = 0; k < 16; k++) {
        const lx = dx === -1 ? 15 : dx === 1 ? 0 : k, lz = dz === -1 ? 15 : dz === 1 ? 0 : k;
        for (let y = 0; y < CH; y++) {
          const L = n.light[(y << 8) | (lz << 4) | lx];
          if (L === 0) continue;
          const wx = (c.cx + dx) * 16 + lx, wz = (c.cz + dz) * 16 + lz;
          if ((L >> 4) > 1) skyQ.push(this._pack(wx, y, wz));
          if ((L & 15) > 1) blkQ.push(this._pack(wx, y, wz));
        }
      }
    }
    c.lit = true;
    this._lighting = c;
    this.propagate(skyQ, true);
    this.propagate(blkQ, false);
    this._lighting = null;
    this.stats.lightMs += performance.now() - t0;
  };

  World.prototype.propagate = function (q, sky) {
    const ox = this._ox, oz = this._oz;
    const DX = [0, 0, 0, 0, -1, 1], DY = [-1, 1, 0, 0, 0, 0], DZ = [0, 0, -1, 1, 0, 0];
    while (!q.empty()) {
      const p = q.shift();
      const x = (p & 2047) + ox, y = (p >> 11) & 127, z = ((p >> 18) & 2047) + oz;
      const c = this.getChunk(x >> 4, z >> 4);
      if (!c || !c.lit) continue;
      const L = c.light[(y << 8) | ((z & 15) << 4) | (x & 15)];
      const lv = sky ? L >> 4 : L & 15;
      if (lv <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const ny = y + DY[d];
        if (ny < 0 || ny >= CH) continue;
        const nx = x + DX[d], nz = z + DZ[d];
        const nc = (nx >> 4) === c.cx && (nz >> 4) === c.cz ? c : this.getChunk(nx >> 4, nz >> 4);
        if (!nc || !nc.lit) continue;
        const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
        const op = LOPAC[nc.blocks[ni]];
        if (op >= 15) continue;
        let nl = lv - (op > 1 ? op : 1);
        if (sky && d === 0 && lv === 15 && op === 0) nl = 15;
        const cur = nc.light[ni];
        const cl = sky ? cur >> 4 : cur & 15;
        if (nl > cl) {
          nc.light[ni] = sky ? (cur & 15) | (nl << 4) : (cur & 0xF0) | nl;
          q.push(((nx - ox) & 2047) | (ny << 11) | (((nz - oz) & 2047) << 18));
          if (nc !== this._lighting && nc.meshReady) this.markBlockDirty(nx, ny, nz);
        }
      }
    }
  };

  /** Recompute light around a changed block (removal + re-propagation). */
  World.prototype.relight = function (x, y, z) {
    this._ox = x - 1024; this._oz = z - 1024;
    this._lighting = null;
    for (let pass = 0; pass < 2; pass++) {
      const sky = pass === 0;
      const rem = this.rq, add = this.lq;
      rem.clear(); add.clear();
      const c = this.getChunk(x >> 4, z >> 4);
      const i0 = (y << 8) | ((z & 15) << 4) | (x & 15);
      const L0 = c.light[i0];
      const old = sky ? L0 >> 4 : L0 & 15;
      c.light[i0] = sky ? (L0 & 15) : (L0 & 0xF0);
      const remLv = [];
      rem.push(this._pack(x, y, z)); remLv.push(old);
      let ri = 0;
      const DX = [0, 0, 0, 0, -1, 1], DY = [-1, 1, 0, 0, 0, 0], DZ = [0, 0, -1, 1, 0, 0];
      while (!rem.empty()) {
        const p = rem.shift(); const lv = remLv[ri++];
        const px = (p & 2047) + this._ox, py = (p >> 11) & 127, pz = ((p >> 18) & 2047) + this._oz;
        for (let d = 0; d < 6; d++) {
          const ny = py + DY[d];
          if (ny < 0 || ny >= CH) continue;
          const nx = px + DX[d], nz = pz + DZ[d];
          const nc = this.getChunk(nx >> 4, nz >> 4);
          if (!nc || !nc.lit) continue;
          const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
          const cur = nc.light[ni];
          const nl = sky ? cur >> 4 : cur & 15;
          if (nl !== 0 && (nl < lv || (sky && d === 0 && lv === 15 && nl === 15))) {
            nc.light[ni] = sky ? (cur & 15) : (cur & 0xF0);
            rem.push(this._pack(nx, ny, nz)); remLv.push(nl);
            if (nc.meshReady) this.markBlockDirty(nx, ny, nz);
          } else if (nl >= lv) {
            add.push(this._pack(nx, ny, nz));
          }
        }
      }
      // sources
      const id = c.blocks[i0];
      if (!sky && LEMIT[id]) { c.light[i0] = (c.light[i0] & 0xF0) | LEMIT[id]; add.push(this._pack(x, y, z)); }
      if (sky && y === CH - 1 && LOPAC[id] < 15) { c.light[i0] = (c.light[i0] & 15) | ((15 - LOPAC[id]) << 4); add.push(this._pack(x, y, z)); }
      const DX2 = [0, 0, 0, 0, -1, 1], DY2 = [-1, 1, 0, 0, 0, 0], DZ2 = [0, 0, -1, 1, 0, 0];
      for (let d = 0; d < 6; d++) {
        const ny = y + DY2[d]; if (ny < 0 || ny >= CH) continue;
        add.push(this._pack(x + DX2[d], ny, z + DZ2[d]));
      }
      this.propagate(add, sky);
    }
    this.markBlockDirty(x, y, z);
  };

  /* ---------------------------------------------------------------- */
  /* Chunk pipeline                                                   */
  /* ---------------------------------------------------------------- */
  World.prototype.setRenderDistance = function (r) { this.renderDist = r; this.lastCenter = null; };

  World.prototype.updateChunks = function (px, pz, budgetMs) {
    const t0 = performance.now();
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    const R = this.renderDist, G = R + (this.remote ? 2 : 4);
    this.pool.pumpFallback(Math.min(8, budgetMs / 2));
    // extra centres keep the world loaded around remote (multiplayer) players
    const centers = [[pcx, pcz, G]].concat(this.extraCenters || []);
    const ckeyStr = R + '|' + centers.map(c => c.join(',')).join(';');
    if (!this.lastCenter || this._centersKey !== ckeyStr) {
      this.lastCenter = [pcx, pcz];
      this._centersKey = ckeyStr;
      const best = new Map();
      for (const [ox, oz, g] of centers) {
        for (let dx = -g; dx <= g; dx++) for (let dz = -g; dz <= g; dz++) {
          const d2 = dx * dx + dz * dz;
          if (d2 > (g + 0.5) * (g + 0.5)) continue;
          const k = ckey(ox + dx, oz + dz);
          const pd = (ox + dx - pcx) ** 2 + (oz + dz - pcz) ** 2;
          const cur = best.get(k);
          if (!cur || cur[2] > pd) best.set(k, [ox + dx, oz + dz, Math.min(pd, d2 + (ox === pcx && oz === pcz ? 0 : 4))]);
        }
      }
      const w = Array.from(best.values());
      w.sort((a, b) => a[2] - b[2]);
      this.wanted = w;
      // unload chunks far from every centre
      for (const c of this.chunks.values()) {
        let keep = false;
        for (const [ox, oz, g] of centers) {
          const dx = c.cx - ox, dz = c.cz - oz, U = g + 2;
          if (dx * dx + dz * dz <= (U + 0.5) * (U + 0.5)) { keep = true; break; }
        }
        if (!keep) this.unloadChunk(c);
      }
      // re-evaluate mesh readiness for chunks in range
      for (const c of this.chunks.values()) if (c.lit && !c.meshReady) this.checkQueue.add(c);
    }
    // request generation / loading
    const cap = this.remote ? 40 : this.pool.capacity();
    for (const [cx, cz] of this.wanted) {
      if (this.pendingGen.size >= cap + 4) break;
      const k = ckey(cx, cz);
      if (this.chunks.has(k) || this.pendingGen.has(k)) continue;
      this.requestChunk(cx, cz, k);
    }
    // integrate generation results
    while (this.genResults.length) {
      const m = this.genResults.shift();
      this.installGenerated(m);
    }
    // advance pipeline
    if (this.checkQueue.size) {
      const list = Array.from(this.checkQueue);
      list.sort((a, b) => ((a.cx - pcx) ** 2 + (a.cz - pcz) ** 2) - ((b.cx - pcx) ** 2 + (b.cz - pcz) ** 2));
      for (const c of list) {
        if (performance.now() - t0 > budgetMs * 0.6) break;
        this.checkQueue.delete(c);
        if (this.chunks.get(c.key) !== c) continue;
        this.advance(c, pcx, pcz);
      }
    }
    // meshing
    this.processMeshing(pcx, pcz, Math.max(1, budgetMs - (performance.now() - t0)));
  };

  World.prototype.requestChunk = function (cx, cz, k) {
    this.pendingGen.add(k);
    const sk = this.slot + ':' + cx + ',' + cz;
    if (this.savedKeys.has(sk)) {
      // a save of this chunk may still be on its way to disk: read after it lands
      const wait = (this._savePending && this._savePending.get(sk)) || Promise.resolve();
      wait.then(() => DL.Storage.getChunk(this.slot, cx, cz)).then(async rec => {
        if (!this.pendingGen.has(k)) return;
        if (!rec) { this.savedKeys.delete(sk); this.pool.submit({ t: 'gen', cx, cz }); return; }
        try {
          const raw = await DL.Storage.decompress(rec);
          this.genResults.push({ t: 'gen', cx, cz, blocks: raw.slice(0, 32768), meta: raw.slice(32768, 65536), biomes: raw.slice(65536, 65792), saved: rec });
        } catch (e) {
          console.warn('corrupt chunk, regenerating', cx, cz, e);
          this.pool.submit({ t: 'gen', cx, cz });
        }
      });
    } else {
      this.pool.submit({ t: 'gen', cx, cz });
    }
  };

  World.prototype.installGenerated = function (m) {
    const k = ckey(m.cx, m.cz);
    if (!this.pendingGen.has(k)) return;
    this.pendingGen.delete(k);
    if (this.chunks.has(k)) return;
    const c = new Chunk(m.cx, m.cz);
    c.blocks = m.blocks; c.meta = m.meta; c.biomes = m.biomes;
    c.generated = true;
    if (m.saved) {
      c.populated = !!m.saved.populated;
      c.loadedFromDisk = true;
      if (m.saved.tiles) for (const te of m.saved.tiles) {
        const copy = JSON.parse(JSON.stringify(te));
        c.tiles.set((copy.y << 8) | ((copy.z & 15) << 4) | (copy.x & 15), copy);
        if (copy.type === 'furnace') this.furnaces.add(copy);
        if (copy.type === 'spawner') this.spawners.add(copy);
      }
      c.savedEntities = m.saved.entities || null;
    }
    this.chunks.set(k, c);
    this._lc = null;
    if (!m.saved && DL.Structures) DL.Structures.apply(this, c);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const n = this.getChunk(c.cx + dx, c.cz + dz);
      if (n) this.checkQueue.add(n);
    }
  };

  World.prototype.advance = function (c, pcx, pcz) {
    const g = (dx, dz) => this.getChunk(c.cx + dx, c.cz + dz);
    if (!c.populated) {
      const a = g(1, 0), b = g(0, 1), d = g(1, 1);
      if (a && b && d) {
        this.populate(c);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const n = g(dx, dz); if (n) this.checkQueue.add(n); }
      }
    }
    if (!c.lit) {
      const p = [g(-1, -1), g(-1, 0), g(0, -1)];
      if (c.populated && p.every(n => n && n.populated)) {
        this.lightChunk(c);
        this.stats.chunkUpdates++;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const n = g(dx, dz); if (n && n !== c) this.checkQueue.add(n); }
        if (c.savedEntities && this.onChunkEntities) { this.onChunkEntities(c, c.savedEntities); c.savedEntities = null; }
        if (this.pendingAnimals && this.pendingAnimals.has(c.key) && this.onChunkEntities) {
          this.onChunkEntities(c, this.pendingAnimals.get(c.key));
          this.pendingAnimals.delete(c.key);
        }
      }
    }
    if (c.lit && !c.meshReady) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      if (dx * dx + dz * dz <= (this.renderDist + 0.5) * (this.renderDist + 0.5)) {
        let ok = true;
        for (let ex = -1; ex <= 1 && ok; ex++) for (let ez = -1; ez <= 1 && ok; ez++) { const n = g(ex, ez); if (!n || !n.lit) ok = false; }
        if (ok) {
          c.meshReady = true;
          for (const s of c.sections) this.markSectionDirty(s);
        }
      }
    }
  };

  World.prototype.unloadChunk = function (c) {
    const ents = this.collectChunkEntities ? this.collectChunkEntities(c) : [];
    if (ents.length) c.needsSave = true;
    if (c.needsSave && c.generated) this.saveChunk(c, ents);
    if (this.onChunkUnload) this.onChunkUnload(c);
    for (const s of c.sections) { this.dirtySections.delete(s); s.queued = false; }
    for (const te of c.tiles.values()) { this.furnaces.delete(te); this.spawners.delete(te); }
    this.chunks.delete(c.key);
    this._lc = null;
  };

  World.prototype.buildMeshJob = function (s) {
    const c = s.chunk;
    const blocks = new Uint8Array(5832), meta = new Uint8Array(5832), light = new Uint8Array(5832);
    const nb = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) nb.push(this.getChunk(c.cx + dx, c.cz + dz));
    const y0 = s.sy * 16 - 1;
    let nonAir = 0;
    for (let py = 0; py < 18; py++) {
      const y = y0 + py;
      const rowBase = py * 324;
      if (y < 0) { blocks.fill(B.bedrock, rowBase, rowBase + 324); continue; }
      if (y >= CH) { light.fill(0xF0, rowBase, rowBase + 324); continue; }
      for (let pz = 0; pz < 18; pz++) {
        const lz = pz - 1;
        const cz = lz < 0 ? 0 : lz > 15 ? 2 : 1;
        const zz = lz & 15;
        for (let px = 0; px < 18; px++) {
          const lx = px - 1;
          const cxi = lx < 0 ? 0 : lx > 15 ? 2 : 1;
          const ch = nb[cz * 3 + cxi];
          const o = rowBase + pz * 18 + px;
          if (!ch || !ch.blocks) { light[o] = 0xF0; continue; }
          const i = (y << 8) | (zz << 4) | (lx & 15);
          const b = ch.blocks[i];
          blocks[o] = b; meta[o] = ch.meta[i]; light[o] = ch.light[i];
          if (b && py > 0 && py < 17 && pz > 0 && pz < 17 && px > 0 && px < 17) nonAir++;
        }
      }
    }
    // padded 18x18 biome map so grass, leaves and water take their biome's colour
    let biomes = null;
    if (!(this.dim || 0) && !(DL.game && DL.game.settings && DL.game.settings.biomeTint === false)) {
      biomes = new Uint8Array(324);
      for (let pz = 0; pz < 18; pz++) for (let px = 0; px < 18; px++) {
        const lx = px - 1, lz = pz - 1, ch = nb[(lz < 0 ? 0 : lz > 15 ? 2 : 1) * 3 + (lx < 0 ? 0 : lx > 15 ? 2 : 1)] || c;
        biomes[pz * 18 + px] = ch.biomes ? ch.biomes[((lz & 15) << 4) | (lx & 15)] : 0;
      }
    }
    return { t: 'mesh', key: 0, ver: s.ver, blocks, meta, light, biomes, fancy: this.fancy, smooth: this.smooth, nonAir };
  };

  World.prototype.processMeshing = function (pcx, pcz, budgetMs) {
    const t0 = performance.now();
    // results
    while (this.meshResults.length) {
      const m = this.meshResults.shift();
      const s = this._jobs && this._jobs.get(m.key);
      if (!s) continue;
      this._jobs.delete(m.key);
      s.pending = false;
      if (this.chunks.get(s.chunk.key) !== s.chunk) continue;
      if (this.onMeshReady) this.onMeshReady(s, m);
      if (s.dirty && !s.queued) { s.queued = true; this.dirtySections.add(s); }
    }
    if (!this.dirtySections.size) return;
    if (!this._jobs) { this._jobs = new Map(); this._jobId = 1; }
    const list = [];
    for (const s of this.dirtySections) {
      if (s.pending) continue;
      const dx = s.chunk.cx - pcx, dz = s.chunk.cz - pcz;
      list.push([s, dx * dx + dz * dz]);
    }
    list.sort((a, b) => a[1] - b[1]);
    const cap = Math.max(8, this.pool.workers.length * 10);
    let inflight = this._jobs.size;
    for (const [s] of list) {
      if (inflight >= cap || performance.now() - t0 > budgetMs) break;
      this.dirtySections.delete(s);
      s.queued = false;
      if (!s.dirty) continue;
      s.dirty = false;
      const job = this.buildMeshJob(s);
      if (job.nonAir === 0) {
        if (this.onMeshReady) this.onMeshReady(s, { solid: null, solidCount: 0, trans: null, transCount: 0 });
        continue;
      }
      const id = this._jobId++;
      job.key = id;
      this._jobs.set(id, s);
      s.pending = true;
      inflight++;
      this.stats.meshJobs++;
      this.pool.submit(job, [job.blocks.buffer, job.meta.buffer, job.light.buffer]);
    }
  };

  /** Synchronously re-mesh the sections around a block (instant feedback for edits). */
  World.prototype.flushNear = function (x, y, z) {
    const x0 = (x - 1) >> 4, x1 = (x + 1) >> 4, z0 = (z - 1) >> 4, z1 = (z + 1) >> 4;
    const y0 = Math.max(0, (y - 1) >> 4), y1 = Math.min(CH / 16 - 1, (y + 1) >> 4);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const c = this.getChunk(cx, cz);
      if (!c || !c.meshReady) continue;
      for (let sy = y0; sy <= y1; sy++) {
        const s = c.sections[sy];
        if (!s.dirty) continue;
        s.dirty = false;
        this.dirtySections.delete(s); s.queued = false;
        const job = this.buildMeshJob(s);
        const r = this.mesher.mesh(job);
        if (this.onMeshReady) this.onMeshReady(s, r);
        if (s.pending) s.staleIgnore = true;
      }
    }
  };

  World.prototype.remeshAll = function () {
    for (const c of this.chunks.values()) if (c.meshReady) for (const s of c.sections) this.markSectionDirty(s);
  };

  /** Progress (0..1) of spawn area readiness. */
  World.prototype.spawnProgress = function (px, pz, radius) {
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    let total = 0, gen = 0, ready = 0;
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
      total++;
      const c = this.getChunk(pcx + dx, pcz + dz);
      if (c && c.generated) gen++;
      if (c && c.meshReady) {
        let ok = true;
        for (const s of c.sections) if (s.dirty || s.pending) { ok = false; break; }
        if (ok) ready++;
      }
    }
    return { gen: gen / total, ready: ready / total };
  };

  /* ---------------------------------------------------------------- */
  /* Population (features)                                            */
  /* ---------------------------------------------------------------- */
  World.prototype.populate = function (c) {
    c.populated = true;
    c.needsSave = true;
    if (this.dim && this.populateDim) { this.populateDim(c); return; }
    this.populateOverworld(c);
  };
  /** The Overworld's features. OreSpawn's Overworld-like worlds reuse them with options:
   *  ores (how many times the usual ore), dungeons (false: none), animals (false: none). */
  World.prototype.populateOverworld = function (c, o) {
    o = o || {};
    const r = this.popRng;
    r.setSeed(S.hash2(this.seed ^ 0x1b873593 ^ (this.dim ? this.dim * 7919 : 0), c.cx, c.cz));
    const bx = c.cx * 16, bz = c.cz * 16;
    this._popOrigin = c;
    const biome = c.biomes ? c.biomes[8 * 16 + 8] : 0;
    const BI = S.BIOME;
    const ore = o.ores || 1;

    if (o.dungeons !== false) for (let i = 0; i < 8; i++) this.genDungeon(r, bx + r.nextInt(16) + 8, r.nextInt(128), bz + r.nextInt(16) + 8);
    for (let i = 0; i < 10; i++) this.genClay(r, bx + r.nextInt(16) + 8, r.nextInt(128), bz + r.nextInt(16) + 8, 32);
    for (let i = 0; i < 20; i++) this.genMinable(r, bx + r.nextInt(16), r.nextInt(128), bz + r.nextInt(16), 32, B.dirt);
    for (let i = 0; i < 10; i++) this.genMinable(r, bx + r.nextInt(16), r.nextInt(128), bz + r.nextInt(16), 32, B.gravel);
    for (let i = 0; i < 20 * ore; i++) this.genMinable(r, bx + r.nextInt(16), r.nextInt(128), bz + r.nextInt(16), 16, B.coal_ore);
    for (let i = 0; i < 20 * ore; i++) this.genMinable(r, bx + r.nextInt(16), r.nextInt(64), bz + r.nextInt(16), 8, B.iron_ore);
    for (let i = 0; i < 2 * ore; i++) this.genMinable(r, bx + r.nextInt(16), r.nextInt(32), bz + r.nextInt(16), 8, B.gold_ore);
    for (let i = 0; i < 8 * ore; i++) this.genMinable(r, bx + r.nextInt(16), r.nextInt(16), bz + r.nextInt(16), 7, B.redstone_ore);
    for (let i = 0; i < 1 * ore; i++) this.genMinable(r, bx + r.nextInt(16), r.nextInt(16), bz + r.nextInt(16), 7, B.diamond_ore);

    if (this.decorateBiomes) this.decorateBiomes(r, c, bx, bz);
    // trees
    const tn = this.gen.cont.gens[0].noise(bx * 0.02, 1.5, bz * 0.02);
    let trees = this.decorateBiomes ? -99 : Math.floor((tn * 0.5 + 0.5) * 5 + r.nextInt(3) - 3);
    if (biome === BI.FOREST) trees += 7;
    else if (biome === BI.SEASONAL) trees += 3;
    else if (biome === BI.TUNDRA) trees += 1;
    else if (biome === BI.DESERT) trees = -20;
    if (r.nextInt(10) === 0) trees++;
    for (let i = 0; i < trees; i++) {
      const x = bx + r.nextInt(16) + 8, z = bz + r.nextInt(16) + 8;
      const y = this.topSolidY(x, z);
      if (r.nextInt(10) === 0 && biome !== BI.TUNDRA) this.genBigTree(r, x, y, z);
      else this.genTree(r, x, y, z);
    }
    // flowers
    if (!this.decorateBiomes) for (let i = 0; i < 2; i++) this.genPatch(r, bx + r.nextInt(16) + 8, r.nextInt(128), bz + r.nextInt(16) + 8, B.dandelion);
    if (!this.decorateBiomes && r.nextInt(2) === 0) this.genPatch(r, bx + r.nextInt(16) + 8, r.nextInt(128), bz + r.nextInt(16) + 8, B.rose);
    if (r.nextInt(4) === 0) this.genPatch(r, bx + r.nextInt(16) + 8, r.nextInt(128), bz + r.nextInt(16) + 8, B.brown_mushroom);
    if (r.nextInt(8) === 0) this.genPatch(r, bx + r.nextInt(16) + 8, r.nextInt(128), bz + r.nextInt(16) + 8, B.red_mushroom);
    for (let i = 0; i < 10; i++) this.genReeds(r, bx + r.nextInt(16) + 8, r.nextInt(128), bz + r.nextInt(16) + 8);
    if (r.nextInt(32) === 0) this.genPumpkins(r, bx + r.nextInt(16) + 8, r.nextInt(128), bz + r.nextInt(16) + 8);
    if (biome === BI.DESERT) for (let i = 0; i < 10; i++) this.genCactus(r, bx + r.nextInt(16) + 8, r.nextInt(128), bz + r.nextInt(16) + 8);
    for (let i = 0; i < 30; i++) this.genSpring(r, bx + r.nextInt(16) + 8, r.nextInt(r.nextInt(120) + 8), bz + r.nextInt(16) + 8, B.water);
    for (let i = 0; i < 12; i++) this.genSpring(r, bx + r.nextInt(16) + 8, r.nextInt(r.nextInt(r.nextInt(112) + 8) + 8), bz + r.nextInt(16) + 8, B.lava);
    if (this.decorateCaves) this.decorateCaves(r, bx, bz);
    // snow & ice
    for (let x = bx + 8; x < bx + 24; x++) for (let z = bz + 8; z < bz + 24; z++) {
      const ch = this.getChunk(x >> 4, z >> 4);
      if (!ch || !ch.biomes || !(S.SNOWY ? S.SNOWY[ch.biomes[((z & 15) << 4) | (x & 15)]] : ch.biomes[((z & 15) << 4) | (x & 15)] === BI.TUNDRA)) continue;
      const y = this.topSolidY(x, z) - 1;
      if (y <= 0 || y >= CH - 1) continue;
      const b = this.getBlock(x, y, z);
      if (b === B.water && this.getMeta(x, y, z) === 0) this.popSet(x, y, z, B.ice, 0);
      else if (SOLID[b] && (OPAQUE[b] || S.LEAVES[b]) && b !== B.ice && this.getBlock(x, y + 1, z) === 0) this.popSet(x, y + 1, z, B.snow_layer, 0);
    }
    // animals
    const cx8 = bx + 8, cz8 = bz + 8;
    if (o.animals !== false && r.nextInt(biome === BI.DESERT ? 40 : 9) === 0) {
      const mush = biome === BI.MUSHROOM_FIELDS;
      const special = DL.biomeAnimals ? DL.biomeAnimals(biome) : null;
      const types = mush ? ['mooshroom'] : special || ['pig', 'pig', 'cow', 'cow', 'sheep', 'sheep', 'chicken', 'chicken'];
      const type = types[r.nextInt(types.length)];
      const n = 2 + r.nextInt(3);
      for (let i = 0; i < n; i++) {
        const x = cx8 + r.nextInt(16), z = cz8 + r.nextInt(16);
        const y = this.topSolidY(x, z);
        const gb = this.getBlock(x, y - 1, z);
        if (gb !== B.grass && !(mush && gb === B.mycelium) && gb !== B.podzol && !(special && DL.biomeAnimalGround.includes(gb))) continue;
        const k = ckey(x >> 4, z >> 4);
        if (!this.pendingAnimals) this.pendingAnimals = new Map();
        if (!this.pendingAnimals.has(k)) this.pendingAnimals.set(k, []);
        this.pendingAnimals.get(k).push({ type, x: x + 0.5, y, z: z + 0.5 });
      }
    }
    this._popOrigin = null;
  };

  World.prototype.popSet = function (x, y, z, id, meta) {
    if (y < 0 || y >= CH) return;
    const o = this._popOrigin;
    const dx = (x >> 4) - o.cx, dz = (z >> 4) - o.cz;
    if (dx < 0 || dx > 1 || dz < 0 || dz > 1) return;
    this.setBlockRaw(x, y, z, id, meta);
  };

  World.prototype.genMinable = function (r, x, y, z, size, id, host) {
    host = host || B.stone;
    const a = r.next() * Math.PI;
    const x0 = x + 8 + Math.sin(a) * size / 8, x1 = x + 8 - Math.sin(a) * size / 8;
    const z0 = z + 8 + Math.cos(a) * size / 8, z1 = z + 8 - Math.cos(a) * size / 8;
    const y0 = y + r.nextInt(3) + 2, y1 = y + r.nextInt(3) + 2;
    for (let i = 0; i <= size; i++) {
      const cx = x0 + (x1 - x0) * i / size, cy = y0 + (y1 - y0) * i / size, cz = z0 + (z1 - z0) * i / size;
      const rr = r.next() * size / 16;
      const rh = (Math.sin(i * Math.PI / size) + 1) * rr + 1;
      const rv = (Math.sin(i * Math.PI / size) + 1) * rr + 1;
      for (let bx = Math.floor(cx - rh / 2); bx <= Math.floor(cx + rh / 2); bx++) {
        const dx = (bx + 0.5 - cx) / (rh / 2);
        if (dx * dx >= 1) continue;
        for (let by = Math.floor(cy - rv / 2); by <= Math.floor(cy + rv / 2); by++) {
          const dy = (by + 0.5 - cy) / (rv / 2);
          if (dx * dx + dy * dy >= 1) continue;
          for (let bz = Math.floor(cz - rh / 2); bz <= Math.floor(cz + rh / 2); bz++) {
            const dz = (bz + 0.5 - cz) / (rh / 2);
            if (dx * dx + dy * dy + dz * dz < 1 && this.getBlock(bx, by, bz) === host) this.popSet(bx, by, bz, id, 0);
          }
        }
      }
    }
  };

  World.prototype.genClay = function (r, x, y, z, size) {
    if (this.getBlock(x, y, z) !== B.water) return;
    const a = r.next() * Math.PI;
    const x0 = x + 8 + Math.sin(a) * size / 8, x1 = x + 8 - Math.sin(a) * size / 8;
    const z0 = z + 8 + Math.cos(a) * size / 8, z1 = z + 8 - Math.cos(a) * size / 8;
    const y0 = y + r.nextInt(3) + 2, y1 = y + r.nextInt(3) + 2;
    for (let i = 0; i <= size; i++) {
      const cx = x0 + (x1 - x0) * i / size - 8, cy = y0 + (y1 - y0) * i / size, cz = z0 + (z1 - z0) * i / size - 8;
      const rr = r.next() * size / 16;
      const rh = (Math.sin(i * Math.PI / size) + 1) * rr + 1;
      for (let bx = Math.floor(cx - rh / 2); bx <= Math.floor(cx + rh / 2); bx++)
        for (let by = Math.floor(cy - rh / 2); by <= Math.floor(cy + rh / 2); by++)
          for (let bz = Math.floor(cz - rh / 2); bz <= Math.floor(cz + rh / 2); bz++) {
            const dx = (bx + 0.5 - cx) / (rh / 2), dy = (by + 0.5 - cy) / (rh / 2), dz = (bz + 0.5 - cz) / (rh / 2);
            if (dx * dx + dy * dy + dz * dz < 1 && this.getBlock(bx, by, bz) === B.sand) this.popSet(bx, by, bz, B.clay, 0);
          }
    }
  };

  World.prototype.genTree = function (r, x, y, z) {
    const h = r.nextInt(3) + 4;
    if (y < 1 || y + h + 1 > CH) return false;
    for (let yy = y; yy <= y + 1 + h; yy++) {
      const rad = yy === y ? 0 : yy >= y + 1 + h - 2 ? 2 : 1;
      for (let xx = x - rad; xx <= x + rad; xx++) for (let zz = z - rad; zz <= z + rad; zz++) {
        const b = this.getBlock(xx, yy, zz);
        if (b !== 0 && b !== B.leaves && b !== B.snow_layer) return false;
      }
    }
    const below = this.getBlock(x, y - 1, z);
    if (below !== B.grass && below !== B.dirt) return false;
    this.popSet(x, y - 1, z, B.dirt, 0);
    for (let yy = y - 3 + h; yy <= y + h; yy++) {
      const dy = yy - (y + h);
      const rad = 1 - ((dy / 2) | 0);
      for (let xx = x - rad; xx <= x + rad; xx++) for (let zz = z - rad; zz <= z + rad; zz++) {
        const ax = Math.abs(xx - x), az = Math.abs(zz - z);
        if (ax === rad && az === rad && (r.nextInt(2) === 0 || dy === 0)) continue;
        const b = this.getBlock(xx, yy, zz);
        if (b === 0 || b === B.leaves || S.REPLACE[b] || S.RENDER[b] === S.R.CROSS) this.popSet(xx, yy, zz, B.leaves, 0);
      }
    }
    for (let yy = 0; yy < h; yy++) {
      const b = this.getBlock(x, y + yy, z);
      if (b === 0 || b === B.leaves || b === B.snow_layer) this.popSet(x, y + yy, z, B.log, 0);
    }
    return true;
  };

  World.prototype.genBigTree = function (r, x, y, z) {
    const below = this.getBlock(x, y - 1, z);
    if (below !== B.grass && below !== B.dirt) return false;
    const h = 8 + r.nextInt(6);
    if (y + h + 4 >= CH) return false;
    for (let yy = y; yy < y + h; yy++) { const b = this.getBlock(x, yy, z); if (b !== 0 && b !== B.leaves) return this.genTree(r, x, y, z); }
    this.popSet(x, y - 1, z, B.dirt, 0);
    const blob = (cx, cy, cz, rad) => {
      for (let dy = 0; dy < 5; dy++) {
        const rr = dy === 0 || dy === 4 ? rad - 1 : rad;
        for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
          if (dx * dx + dz * dz > rr * rr + 1) continue;
          const px = cx + dx, py = cy + dy, pz = cz + dz;
          const b = this.getBlock(px, py, pz);
          if (b === 0 || b === B.snow_layer) this.popSet(px, py, pz, B.leaves, 0);
        }
      }
    };
    const top = y + h;
    const branches = 2 + r.nextInt(3);
    for (let i = 0; i < branches; i++) {
      const by = y + Math.floor(h * (0.45 + r.next() * 0.45));
      const ang = r.next() * Math.PI * 2;
      const len = 2 + r.nextInt(3);
      let ex = x, ez = z, ey = by;
      for (let k = 1; k <= len; k++) {
        ex = Math.round(x + Math.cos(ang) * k); ez = Math.round(z + Math.sin(ang) * k); ey = by + (k >> 1);
        if (this.getBlock(ex, ey, ez) === 0 || this.getBlock(ex, ey, ez) === B.leaves) this.popSet(ex, ey, ez, B.log, 0);
      }
      blob(ex, ey - 1, ez, 2);
    }
    blob(x, top - 2, z, 3);
    for (let yy = y; yy < top; yy++) this.popSet(x, yy, z, B.log, 0);
    return true;
  };

  World.prototype.genPatch = function (r, x, y, z, id) {
    for (let i = 0; i < 64; i++) {
      const px = x + r.nextInt(8) - r.nextInt(8), py = y + r.nextInt(4) - r.nextInt(4), pz = z + r.nextInt(8) - r.nextInt(8);
      if (py < 1 || py >= CH - 1) continue;
      if (this.getBlock(px, py, pz) !== 0) continue;
      const below = this.getBlock(px, py - 1, pz);
      if (id === B.brown_mushroom || id === B.red_mushroom) {
        if (!OPAQUE[below]) continue;
        // needs darkness: approximate by requiring an opaque block above within 12
        let covered = false;
        for (let k = 1; k < 12; k++) if (OPAQUE[this.getBlock(px, py + k, pz)]) { covered = true; break; }
        if (!covered) continue;
      } else if (below !== B.grass && below !== B.dirt) continue;
      this.popSet(px, py, pz, id, 0);
    }
  };

  World.prototype.genReeds = function (r, x, y, z) {
    for (let i = 0; i < 20; i++) {
      const px = x + r.nextInt(4) - r.nextInt(4), pz = z + r.nextInt(4) - r.nextInt(4);
      const py = y;
      if (this.getBlock(px, py, pz) !== 0) continue;
      const below = this.getBlock(px, py - 1, pz);
      if (below !== B.grass && below !== B.dirt && below !== B.sand) continue;
      if (this.getBlock(px - 1, py - 1, pz) !== B.water && this.getBlock(px + 1, py - 1, pz) !== B.water &&
        this.getBlock(px, py - 1, pz - 1) !== B.water && this.getBlock(px, py - 1, pz + 1) !== B.water) continue;
      const h = 2 + r.nextInt(r.nextInt(3) + 1);
      for (let k = 0; k < h; k++) if (this.getBlock(px, py + k, pz) === 0) this.popSet(px, py + k, pz, B.reeds, 0);
    }
  };

  World.prototype.genPumpkins = function (r, x, y, z) {
    for (let i = 0; i < 64; i++) {
      const px = x + r.nextInt(8) - r.nextInt(8), py = y + r.nextInt(4) - r.nextInt(4), pz = z + r.nextInt(8) - r.nextInt(8);
      if (py < 1 || py >= CH) continue;
      if (this.getBlock(px, py, pz) === 0 && this.getBlock(px, py - 1, pz) === B.grass) this.popSet(px, py, pz, B.pumpkin, r.nextInt(4));
    }
  };

  World.prototype.genCactus = function (r, x, y, z) {
    for (let i = 0; i < 10; i++) {
      const px = x + r.nextInt(8) - r.nextInt(8), py = y + r.nextInt(4) - r.nextInt(4), pz = z + r.nextInt(8) - r.nextInt(8);
      if (py < 1 || py >= CH - 3) continue;
      if (this.getBlock(px, py, pz) !== 0) continue;
      const h = 1 + r.nextInt(r.nextInt(3) + 1);
      for (let k = 0; k < h; k++) {
        if (this.canCactusStay(px, py + k, pz)) this.popSet(px, py + k, pz, B.cactus, 0);
      }
    }
  };
  World.prototype.canCactusStay = function (x, y, z) {
    if (SOLID[this.getBlock(x - 1, y, z)] || SOLID[this.getBlock(x + 1, y, z)] || SOLID[this.getBlock(x, y, z - 1)] || SOLID[this.getBlock(x, y, z + 1)]) return false;
    const b = this.getBlock(x, y - 1, z);
    return b === B.cactus || b === B.sand;
  };

  World.prototype.genSpring = function (r, x, y, z, id) {
    if (y < 1 || y >= CH - 1) return;
    if (this.getBlock(x, y + 1, z) !== B.stone || this.getBlock(x, y - 1, z) !== B.stone) return;
    const b = this.getBlock(x, y, z);
    if (b !== 0 && b !== B.stone) return;
    let stone = 0, air = 0;
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const n = this.getBlock(x + dx, y, z + dz);
      if (n === B.stone) stone++; else if (n === 0) air++;
    }
    if (stone === 3 && air === 1) {
      this.popSet(x, y, z, id, 0);
      if (!this.pendingTicks) this.pendingTicks = [];
      this.pendingTicks.push([x, y, z]);
    }
  };

  World.prototype.genDungeon = function (r, x, y, z) {
    const h = 3, rx = r.nextInt(2) + 2, rz = r.nextInt(2) + 2;
    let open = 0;
    if (y < 2 || y + h + 2 >= CH) return false;
    for (let xx = x - rx - 1; xx <= x + rx + 1; xx++) for (let yy = y - 1; yy <= y + h + 1; yy++) for (let zz = z - rz - 1; zz <= z + rz + 1; zz++) {
      const b = this.getBlock(xx, yy, zz);
      const solid = SOLID[b] && !S.LIQUID[b];
      if (yy === y - 1 && !solid) return false;
      if (yy === y + h + 1 && !solid) return false;
      if ((xx === x - rx - 1 || xx === x + rx + 1 || zz === z - rz - 1 || zz === z + rz + 1) && yy === y && b === 0 && this.getBlock(xx, yy + 1, zz) === 0) open++;
      if (S.LIQUID[b]) return false;
    }
    if (open < 1 || open > 5) return false;
    for (let xx = x - rx - 1; xx <= x + rx + 1; xx++) for (let yy = y + h; yy >= y - 1; yy--) for (let zz = z - rz - 1; zz <= z + rz + 1; zz++) {
      if (xx !== x - rx - 1 && yy !== y - 1 && zz !== z - rz - 1 && xx !== x + rx + 1 && yy !== y + h + 1 && zz !== z + rz + 1) {
        this.popSet(xx, yy, zz, 0, 0);
      } else if (yy >= 0 && !SOLID[this.getBlock(xx, yy - 1, zz)]) {
        this.popSet(xx, yy, zz, 0, 0);
      } else if (SOLID[this.getBlock(xx, yy, zz)]) {
        if (yy === y - 1 && r.nextInt(4) !== 0) this.popSet(xx, yy, zz, B.mossy_cobblestone, 0);
        else this.popSet(xx, yy, zz, B.cobblestone, 0);
      }
    }
    // chests
    for (let i = 0; i < 2; i++) {
      for (let t = 0; t < 3; t++) {
        const cx = x + r.nextInt(rx * 2 + 1) - rx, cz = z + r.nextInt(rz * 2 + 1) - rz;
        if (this.getBlock(cx, y, cz) !== 0) continue;
        let walls = 0;
        for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (SOLID[this.getBlock(cx + dx, y, cz + dz)]) walls++;
        if (walls !== 1) continue;
        const o = this._popOrigin;
        const dcx = (cx >> 4) - o.cx, dcz = (cz >> 4) - o.cz;
        if (dcx < 0 || dcx > 1 || dcz < 0 || dcz > 1) continue;
        this.popSet(cx, y, cz, B.chest, r.nextInt(4));
        const items = new Array(27).fill(null);
        for (let k = 0; k < 8; k++) {
          const loot = this.dungeonLoot(r);
          if (loot) items[r.nextInt(27)] = loot;
        }
        this.setTile(cx, y, cz, { type: 'chest', items });
        break;
      }
    }
    this.popSet(x, y, z, B.spawner, 0);
    const mobs = ['skeleton', 'zombie', 'zombie', 'spider'];
    this.setTile(x, y, z, { type: 'spawner', mob: mobs[r.nextInt(4)], delay: 200 });
    return true;
  };
  World.prototype.dungeonLoot = function (r) {
    const I = DL.Items;
    const n = r.nextInt(11);
    switch (n) {
      case 0: return I.stack(329);
      case 1: return I.stack(265, r.nextInt(4) + 1);
      case 2: return I.stack(297);
      case 3: return I.stack(296, r.nextInt(4) + 1);
      case 4: return I.stack(289, r.nextInt(4) + 1);
      case 5: return I.stack(287, r.nextInt(4) + 1);
      case 6: return I.stack(325);
      case 7: return r.nextInt(100) === 0 ? I.stack(322) : null;
      case 8: return r.nextInt(2) === 0 ? I.stack(331, r.nextInt(4) + 1) : null;
      case 9: return I.stack(260);
      default: return I.stack(262, r.nextInt(8) + 2);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Scheduled ticks & neighbour updates                              */
  /* ---------------------------------------------------------------- */
  function posKey(x, y, z) { return ((x + 1048576) * 128 + y) * 2097152 + (z + 1048576); }
  World.prototype.schedule = function (x, y, z, delay) {
    const k = posKey(x, y, z);
    if (this.scheduledKeys.has(k)) return;
    this.scheduledKeys.add(k);
    const h = this.scheduled;
    const item = { x, y, z, t: this.totalTicks + delay, k };
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p].t <= item.t) break;
      h[i] = h[p]; i = p;
    }
    h[i] = item;
  };
  World.prototype._popSched = function () {
    const h = this.scheduled;
    const top = h[0];
    const last = h.pop();
    if (h.length) {
      let i = 0;
      const n = h.length;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        const cand = l < n && h[l].t < last.t ? l : -1;
        if (cand >= 0) m = l;
        if (r < n && h[r].t < (m === i ? last.t : h[l].t)) m = r;
        if (m === i) break;
        h[i] = h[m]; i = m;
      }
      h[i] = last;
    }
    return top;
  };

  World.prototype.notifyNeighbors = function (x, y, z, id) {
    this.neighborChanged(x - 1, y, z); this.neighborChanged(x + 1, y, z);
    this.neighborChanged(x, y - 1, z); this.neighborChanged(x, y + 1, z);
    this.neighborChanged(x, y, z - 1); this.neighborChanged(x, y, z + 1);
    this.neighborChanged(x, y, z);
  };

  World.prototype.canStay = function (id, x, y, z, meta) {
    const below = this.getBlock(x, y - 1, z);
    switch (id) {
      case B.dandelion: case B.rose: case B.sapling:
        return below === B.grass || below === B.dirt || below === B.farmland;
      case B.brown_mushroom: case B.red_mushroom:
        return OPAQUE[below] && this.getLightLevel(x, y, z) < 13;
      case B.wheat: return below === B.farmland;
      case B.reeds:
        if (below === B.reeds) return true;
        if (below !== B.grass && below !== B.dirt && below !== B.sand) return false;
        return this.getBlock(x - 1, y - 1, z) === B.water || this.getBlock(x + 1, y - 1, z) === B.water ||
          this.getBlock(x, y - 1, z - 1) === B.water || this.getBlock(x, y - 1, z + 1) === B.water;
      case B.cactus: return this.canCactusStay(x, y, z);
      case B.snow_layer: return SOLID[below] && OPAQUE[below] || below === B.leaves;
      case B.torch: {
        const m = meta === undefined ? this.getMeta(x, y, z) : meta;
        if (m === 0) return SOLID[below] && (OPAQUE[below] || below === B.fence || below === B.glass);
        const d = [null, [0, -1], [0, 1], [-1, 0], [1, 0]][m];
        return d ? OPAQUE[this.getBlock(x + d[0], y, z + d[1])] === 1 : false;
      }
      case B.ladder: {
        const m = meta === undefined ? this.getMeta(x, y, z) : meta;
        const d = [[0, -1], [0, 1], [-1, 0], [1, 0]][m & 3];
        return OPAQUE[this.getBlock(x + d[0], y, z + d[1])] === 1;
      }
      case B.wooden_door: {
        const m = meta === undefined ? this.getMeta(x, y, z) : meta;
        if (m & 8) return this.getBlock(x, y - 1, z) === B.wooden_door;
        return SOLID[below] && OPAQUE[below] && this.getBlock(x, y + 1, z) === B.wooden_door;
      }
      case B.fire: return true;
    }
    return true;
  };

  World.prototype.neighborChanged = function (x, y, z) {
    if (y < 0 || y >= CH) return;
    const id = this.getBlock(x, y, z);
    if (!id) return;
    switch (id) {
      case B.sand: case B.gravel: {
        const b = this.getBlock(x, y - 1, z);
        if (b === 0 || S.LIQUID[b] || b === B.fire) this.schedule(x, y, z, 3);
        break;
      }
      case B.water: case B.lava:
        this.schedule(x, y, z, id === B.water ? 5 : 30);
        if (id === B.lava) this.checkHarden(x, y, z);
        break;
      case B.farmland:
        if (OPAQUE[this.getBlock(x, y + 1, z)]) this.setBlock(x, y, z, B.dirt, 0);
        break;
      case B.dandelion: case B.rose: case B.sapling: case B.brown_mushroom: case B.red_mushroom: case B.wheat:
      case B.reeds: case B.cactus: case B.snow_layer: case B.torch: case B.ladder: case B.wooden_door:
        if (!this.canStay(id, x, y, z)) this.destroyBlock(x, y, z, true);
        break;
      case B.leaves: {
        const m = this.getMeta(x, y, z);
        if (!(m & 8)) { const c = this.getChunk(x >> 4, z >> 4); c.meta[(y << 8) | ((z & 15) << 4) | (x & 15)] = m | 8; }
        break;
      }
      case B.tnt:
        if (this.getBlock(x + 1, y, z) === B.fire || this.getBlock(x - 1, y, z) === B.fire || this.getBlock(x, y + 1, z) === B.fire ||
          this.getBlock(x, y - 1, z) === B.fire || this.getBlock(x, y, z + 1) === B.fire || this.getBlock(x, y, z - 1) === B.fire) this.igniteTNT(x, y, z, 80);
        break;
    }
  };

  World.prototype.scheduledTick = function (x, y, z) {
    const id = this.getBlock(x, y, z);
    if (id === B.sand || id === B.gravel) {
      const b = this.getBlock(x, y - 1, z);
      if (b === 0 || S.LIQUID[b] || b === B.fire) {
        if (this.onFallingBlock && this.isReady(x, z)) {
          this.setBlock(x, y, z, 0, 0);
          this.onFallingBlock(x, y, z, id);
        }
      }
    } else if (id === B.water || id === B.lava) {
      this.fluidTick(x, y, z, id);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Fluids                                                            */
  /* ---------------------------------------------------------------- */
  World.prototype.fluidLevel = function (x, y, z, id) {
    return this.getBlock(x, y, z) === id ? this.getMeta(x, y, z) : -1;
  };
  World.prototype.blocksFlow = function (b) {
    return b === B.wooden_door || b === B.ladder || b === B.reeds || (SOLID[b] && !S.LIQUID[b]);
  };
  World.prototype.canFlowInto = function (x, y, z, id) {
    if (y < 0 || y >= CH) return false;
    const b = this.getBlock(x, y, z);
    if (b === id) return false;
    if (b === B.lava || b === B.water) return false;
    return !this.blocksFlow(b);
  };
  World.prototype.fluidTick = function (x, y, z, id) {
    if (!this.isReady(x, z)) return;
    const lava = id === B.lava;
    const decay = lava ? 2 : 1;
    const rate = lava ? 30 : 5;
    let meta = this.getMeta(x, y, z);
    if (meta > 0) {
      let minN = -100, sources = 0;
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        let m = this.fluidLevel(x + dx, y, z + dz, id);
        if (m < 0) continue;
        if (m === 0) sources++;
        if (m >= 8) m = 0;
        minN = minN < 0 || m < minN ? m : minN;
      }
      let nl = minN + decay;
      if (nl >= 8 || minN < 0) nl = -1;
      const above = this.fluidLevel(x, y + 1, z, id);
      if (above >= 0) nl = above >= 8 ? above : above + 8;
      if (sources >= 2 && !lava) {
        const b = this.getBlock(x, y - 1, z);
        if (SOLID[b] || (b === id && this.getMeta(x, y - 1, z) === 0)) nl = 0;
      }
      if (nl !== meta) {
        meta = nl;
        if (nl < 0) { this.setBlock(x, y, z, 0, 0); return; }
        this.setBlock(x, y, z, id, nl, 0);
        this.schedule(x, y, z, rate);
        this.notifyNeighbors(x, y, z, id);
      }
    }
    // spread
    if (this.getBlock(x, y - 1, z) === (lava ? B.water : B.lava)) {
      if (lava) { this.setBlock(x, y - 1, z, B.stone, 0); this.fizz(x, y - 1, z); return; }
    }
    if (this.canFlowInto(x, y - 1, z, id)) {
      this.flowInto(x, y - 1, z, id, meta >= 8 ? meta : meta + 8);
    } else if (meta >= 0 && (meta === 0 || this.blocksFlow(this.getBlock(x, y - 1, z)))) {
      const fm = meta >= 8 ? 1 : meta + decay;
      if (fm >= 8) return;
      const dirs = this.flowDirections(x, y, z, id);
      for (let d = 0; d < 4; d++) if (dirs[d]) {
        const [dx, dz] = [[-1, 0], [1, 0], [0, -1], [0, 1]][d];
        this.flowInto(x + dx, y, z + dz, id, fm);
      }
    }
  };
  World.prototype.flowInto = function (x, y, z, id, meta) {
    if (!this.canFlowInto(x, y, z, id)) return;
    const b = this.getBlock(x, y, z);
    if (b) this.destroyBlock(x, y, z, id === B.water);
    this.setBlock(x, y, z, id, meta, 1);
    this.schedule(x, y, z, id === B.lava ? 30 : 5);
  };
  World.prototype.flowCost = function (x, y, z, depth, fromDir, id) {
    let best = 1000;
    for (let d = 0; d < 4; d++) {
      if ((d === 0 && fromDir === 1) || (d === 1 && fromDir === 0) || (d === 2 && fromDir === 3) || (d === 3 && fromDir === 2)) continue;
      const [dx, dz] = [[-1, 0], [1, 0], [0, -1], [0, 1]][d];
      const nx = x + dx, nz = z + dz;
      const b = this.getBlock(nx, y, nz);
      if (this.blocksFlow(b) || (b === id && this.getMeta(nx, y, nz) === 0)) continue;
      if (!this.blocksFlow(this.getBlock(nx, y - 1, nz))) return depth;
      if (depth < 4) { const c = this.flowCost(nx, y, nz, depth + 1, d, id); if (c < best) best = c; }
    }
    return best;
  };
  World.prototype.flowDirections = function (x, y, z, id) {
    const cost = [1000, 1000, 1000, 1000];
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = [[-1, 0], [1, 0], [0, -1], [0, 1]][d];
      const nx = x + dx, nz = z + dz;
      const b = this.getBlock(nx, y, nz);
      if (this.blocksFlow(b) || (b === id && this.getMeta(nx, y, nz) === 0)) continue;
      if (!this.blocksFlow(this.getBlock(nx, y - 1, nz))) cost[d] = 0;
      else cost[d] = this.flowCost(nx, y, nz, 1, d, id);
    }
    const min = Math.min(...cost);
    return cost.map(c => c === min);
  };
  World.prototype.checkHarden = function (x, y, z) {
    if (this.getBlock(x, y, z) !== B.lava) return;
    let water = false;
    for (const [dx, dy, dz] of [[-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]]) if (this.getBlock(x + dx, y + dy, z + dz) === B.water) water = true;
    if (!water) return;
    const m = this.getMeta(x, y, z);
    if (m === 0) this.setBlock(x, y, z, B.obsidian, 0);
    else if (m <= 4) this.setBlock(x, y, z, B.cobblestone, 0);
    else return;
    this.fizz(x, y, z);
  };
  World.prototype.fizz = function (x, y, z) {
    if (this.fx) { this.fx.sound('fizz', x + 0.5, y + 0.5, z + 0.5, 0.5, 2.6); this.fx.smoke(x, y, z, 8); }
  };

  /* ---------------------------------------------------------------- */
  /* Random ticks                                                     */
  /* ---------------------------------------------------------------- */
  World.prototype.randomTicks = function (pcx, pcz) {
    const r = this.rng;
    const R = Math.min(this.renderDist, 7);
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const c = this.getChunk(pcx + dx, pcz + dz);
      if (!c || !c.lit) continue;
      for (let k = 0; k < 20; k++) {
        const v = r.nextInt(32768);
        const id = c.blocks[v];
        if (!id || !RTICK[id]) continue;
        RTICK[id](this, c.cx * 16 + (v & 15), v >> 8, c.cz * 16 + ((v >> 4) & 15), r);
      }
    }
  };
  const RTICK = new Array(256).fill(null);
  RTICK[B.grass] = (w, x, y, z, r) => {
    const above = w.getBlock(x, y + 1, z);
    const la = w.getLightLevel(x, y + 1, z);
    if (la < 4 && LOPAC[above] > 2) { w.setBlock(x, y, z, B.dirt, 0); return; }
    if (la >= 9) {
      const nx = x + r.nextInt(3) - 1, ny = y + r.nextInt(5) - 3, nz = z + r.nextInt(3) - 1;
      if (w.getBlock(nx, ny, nz) === B.dirt && w.getLightLevel(nx, ny + 1, nz) >= 4 && LOPAC[w.getBlock(nx, ny + 1, nz)] <= 2) w.setBlock(nx, ny, nz, B.grass, 0);
    }
  };
  RTICK[B.sapling] = (w, x, y, z, r) => {
    if (w.getLightLevel(x, y + 1, z) >= 9 && r.nextInt(12) === 0) {
      const m = w.getMeta(x, y, z);
      if (m < 3) { w.setMeta(x, y, z, m + 1, 0); return; }
      w.setBlockRaw(x, y, z, 0, 0);
      const ok = r.nextInt(10) === 0 ? w.growTree(x, y, z, true) : w.growTree(x, y, z, false);
      if (!ok) w.setBlockRaw(x, y, z, B.sapling, m);
    }
  };
  DL.RTICK = RTICK;
  RTICK[B.wheat] = (w, x, y, z, r) => {
    if (w.getLightLevel(x, y + 1, z) < 9) return;
    const m = w.getMeta(x, y, z);
    if (m >= 7) return;
    const wet = w.getMeta(x, y - 1, z) > 0;
    if (r.nextInt(wet ? 4 : 10) === 0) w.setMeta(x, y, z, m + 1, 0);
  };
  RTICK[B.farmland] = (w, x, y, z, r) => {
    let water = false;
    for (let dx = -4; dx <= 4 && !water; dx++) for (let dz = -4; dz <= 4 && !water; dz++) for (let dy = 0; dy <= 1; dy++) if (w.getBlock(x + dx, y + dy, z + dz) === B.water) { water = true; break; }
    const m = w.getMeta(x, y, z);
    if (water) { if (m !== 7) w.setMeta(x, y, z, 7, 0); }
    else if (m > 0) w.setMeta(x, y, z, m - 1, 0);
    else if (w.getBlock(x, y + 1, z) !== B.wheat && r.nextInt(4) === 0) w.setBlock(x, y, z, B.dirt, 0);
  };
  RTICK[B.reeds] = (w, x, y, z) => {
    if (w.getBlock(x, y + 1, z) !== 0) return;
    let h = 1;
    while (w.getBlock(x, y - h, z) === B.reeds) h++;
    if (h >= 3) return;
    const m = w.getMeta(x, y, z);
    if (m >= 15) { w.setBlock(x, y + 1, z, B.reeds, 0); w.setMeta(x, y, z, 0, 0); } else w.setMeta(x, y, z, m + 1, 0);
  };
  RTICK[B.cactus] = (w, x, y, z) => {
    if (w.getBlock(x, y + 1, z) !== 0) return;
    let h = 1;
    while (w.getBlock(x, y - h, z) === B.cactus) h++;
    if (h >= 3) return;
    const m = w.getMeta(x, y, z);
    if (m >= 15) { if (w.canCactusStay(x, y + 1, z)) w.setBlock(x, y + 1, z, B.cactus, 0); w.setMeta(x, y, z, 0, 0); } else w.setMeta(x, y, z, m + 1, 0);
  };
  RTICK[B.leaves] = (w, x, y, z, r) => {
    const m = w.getMeta(x, y, z);
    if (!(m & 8) || (m & 4)) return;
    if (w.leafConnected(x, y, z)) { const c = w.getChunk(x >> 4, z >> 4); c.meta[(y << 8) | ((z & 15) << 4) | (x & 15)] = m & ~8; return; }
    w.destroyBlock(x, y, z, true);
  };
  RTICK[B.ice] = (w, x, y, z) => { if (w.getBlockLight(x, y, z) > 11 - LOPAC[B.ice]) w.setBlock(x, y, z, B.water, 0); };
  RTICK[B.snow_layer] = (w, x, y, z) => { if (w.getBlockLight(x, y, z) > 11) w.setBlock(x, y, z, 0, 0); };
  RTICK[B.fire] = (w, x, y, z, r) => w.fireTick(x, y, z, r);
  RTICK[B.lava] = (w, x, y, z, r) => {
    if (r.nextInt(3) !== 0) return;
    const n = r.nextInt(3);
    let px = x, py = y, pz = z;
    for (let i = 0; i < n; i++) {
      px += r.nextInt(3) - 1; py++; pz += r.nextInt(3) - 1;
      const b = w.getBlock(px, py, pz);
      if (b === 0) {
        if (w.isFlammableAround(px, py, pz)) { w.setBlock(px, py, pz, B.fire, 0); return; }
      } else if (SOLID[b]) return;
    }
  };

  World.prototype.leafConnected = function (x, y, z) {
    const seen = new Set();
    const q = [[x, y, z, 0]];
    seen.add(posKey(x, y, z));
    while (q.length) {
      const [px, py, pz, d] = q.shift();
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const nx = px + dx, ny = py + dy, nz = pz + dz;
        const k = posKey(nx, ny, nz);
        if (seen.has(k)) continue;
        seen.add(k);
        const b = this.getBlock(nx, ny, nz);
        if (b === B.log) return true;
        if (b === B.leaves && d < 3) q.push([nx, ny, nz, d + 1]);
      }
    }
    return false;
  };

  World.prototype.growTree = function (x, y, z, big) {
    // run the populator tree code against live blocks, then relight
    const r = new S.RNG(S.hash3(this.seed, x, y, z) ^ this.totalTicks);
    const before = [];
    const self = this;
    const origPop = this.popSet;
    this.popSet = function (px, py, pz, id, meta) { before.push([px, py, pz, id, meta]); };
    const ok = big ? this.genBigTree(r, x, y, z) : this.genTree(r, x, y, z);
    this.popSet = origPop;
    if (!ok) return false;
    for (const [px, py, pz, id, meta] of before) {
      if (!self.isReady(px, pz)) continue;
      self.setBlock(px, py, pz, id, meta, 0);
    }
    return true;
  };

  /* ---------------------------------------------------------------- */
  /* Fire                                                             */
  /* ---------------------------------------------------------------- */
  const FLAMMABLE = { [B.planks]: [5, 20], [B.log]: [5, 5], [B.leaves]: [30, 60], [B.bookshelf]: [30, 20], [B.tnt]: [15, 100], [B.wool]: [30, 60], [B.fence]: [5, 20], [B.wood_stairs]: [5, 20], [B.sapling]: [60, 100] };
  World.prototype.isFlammableAround = function (x, y, z) {
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (FLAMMABLE[this.getBlock(x + dx, y + dy, z + dz)]) return true;
    return false;
  };
  World.prototype.fireTick = function (x, y, z, r) {
    const m = this.getMeta(x, y, z);
    const below = this.getBlock(x, y - 1, z);
    if (!this.isFlammableAround(x, y, z)) {
      if (!SOLID[below] || m > 3) { this.setBlock(x, y, z, 0, 0); return; }
    }
    if (m < 15) this.setMeta(x, y, z, m + 1, 0);
    if (m >= 15 && r.nextInt(4) === 0 && !FLAMMABLE[below]) { this.setBlock(x, y, z, 0, 0); return; }
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const b = this.getBlock(nx, ny, nz);
      const f = FLAMMABLE[b];
      if (f && r.nextInt(300) < f[1]) {
        if (b === B.tnt) this.igniteTNT(nx, ny, nz, 80);
        else if (r.nextInt(m + 10) < 5) this.setBlock(nx, ny, nz, B.fire, 0);
        else this.setBlock(nx, ny, nz, 0, 0);
      }
    }
    for (let i = 0; i < 2; i++) {
      const nx = x + r.nextInt(3) - 1, ny = y + r.nextInt(5) - 1, nz = z + r.nextInt(3) - 1;
      if (this.getBlock(nx, ny, nz) === 0 && this.isFlammableAround(nx, ny, nz) && r.nextInt(100) < 20) this.setBlock(nx, ny, nz, B.fire, 0);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Destroy / explosions                                             */
  /* ---------------------------------------------------------------- */
  World.prototype.spawnItem = function (x, y, z, stack, scatter) {
    if (this.onSpawnItem) this.onSpawnItem(x, y, z, stack, scatter);
  };

  World.prototype.destroyBlock = function (x, y, z, drop, tool, byPlayer) {
    const id = this.getBlock(x, y, z);
    if (!id) return;
    const meta = this.getMeta(x, y, z);
    if (id === B.furnace || id === B.lit_furnace) this._furnaceCarry = null;
    if (id === B.ice && byPlayer) {
      const b = this.getBlock(x, y - 1, z);
      if (SOLID[b] || S.LIQUID[b]) { this.setBlock(x, y, z, B.water, 0, byPlayer ? 3 : 1); return; }
    }
    if ((id === B.log || id === B.leaves)) this.flagLeaves(x, y, z);
    this.setBlock(x, y, z, 0, 0, byPlayer ? 3 : 1);
    if (drop) {
      const drops = DL.Items.blockDrops(id, meta, tool || null, this.rng);
      for (const s of drops) this.spawnItem(x + 0.5, y + 0.5, z + 0.5, s, true);
    }
    if (this.fx) this.fx.blockBroken(x, y, z, id, meta);
  };
  World.prototype.flagLeaves = function (x, y, z) {
    for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
      const px = x + dx, py = y + dy, pz = z + dz;
      if (py < 0 || py >= CH) continue;
      const c = this.getChunk(px >> 4, pz >> 4);
      if (!c || !c.blocks) continue;
      const i = (py << 8) | ((pz & 15) << 4) | (px & 15);
      if (c.blocks[i] === B.leaves) c.meta[i] |= 8;
    }
  };

  World.prototype.igniteTNT = function (x, y, z, fuse) {
    if (this.getBlock(x, y, z) !== B.tnt) return;
    this.setBlock(x, y, z, 0, 0);
    if (this.onPrimeTNT) this.onPrimeTNT(x, y, z, fuse);
  };

  function blastRes(id) {
    if (id === B.bedrock) return 1e6;
    if (id === B.obsidian) return 1200;
    if (id === B.water || id === B.lava) return 60;
    const b = S.blocks[id];
    if (!b) return 0;
    if (b.tool === 'pickaxe') return 6;
    if (id === B.planks || id === B.wood_stairs || id === B.fence || id === B.chest || id === B.crafting_table) return 3;
    return Math.max(0, b.hardness);
  }

  World.prototype.explode = function (x, y, z, power, source) {
    const r = this.rng;
    const hit = new Map();
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) for (let k = 0; k < 16; k++) {
      if (i !== 0 && i !== 15 && j !== 0 && j !== 15 && k !== 0 && k !== 15) continue;
      let dx = i / 15 * 2 - 1, dy = j / 15 * 2 - 1, dz = k / 15 * 2 - 1;
      const l = Math.hypot(dx, dy, dz);
      dx /= l; dy /= l; dz /= l;
      let s = power * (0.7 + r.next() * 0.6);
      let px = x, py = y, pz = z;
      while (s > 0) {
        const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
        const b = this.getBlock(bx, by, bz);
        if (b) s -= (blastRes(b) + 0.3) * 0.3;
        if (s > 0 && b && by >= 0 && by < CH) hit.set(posKey(bx, by, bz), [bx, by, bz, b]);
        px += dx * 0.3; py += dy * 0.3; pz += dz * 0.3;
        s -= 0.225;
      }
    }
    if (this.fx) this.fx.explosion(x, y, z, power);
    const list = Array.from(hit.values());
    for (const [bx, by, bz, b] of list) {
      if (b === B.tnt) { this.setBlock(bx, by, bz, 0, 0); if (this.onPrimeTNT) this.onPrimeTNT(bx, by, bz, 10 + r.nextInt(20)); continue; }
      const meta = this.getMeta(bx, by, bz);
      this.setBlock(bx, by, bz, 0, 0, 0);
      if (r.next() < 0.3) for (const s of DL.Items.blockDrops(b, meta, null, r)) this.spawnItem(bx + 0.5, by + 0.5, bz + 0.5, s, true);
    }
    for (const [bx, by, bz] of list) this.notifyNeighbors(bx, by, bz, 0);
    if (this.onExplosionEntities) this.onExplosionEntities(x, y, z, power, source);
  };

  /* ---------------------------------------------------------------- */
  /* World tick                                                       */
  /* ---------------------------------------------------------------- */
  World.prototype.tick = function (pcx, pcz) {
    if (!this.timeFrozen) this.time++;
    this.totalTicks++;
    if (this.pendingTicks) {
      for (const [x, y, z] of this.pendingTicks) this.schedule(x, y, z, 5);
      this.pendingTicks = null;
    }
    let n = 0;
    while (this.scheduled.length && this.scheduled[0].t <= this.totalTicks && n < 1500) {
      const it = this._popSched();
      this.scheduledKeys.delete(it.k);
      if (!this.isReady(it.x, it.z)) continue;
      this.scheduledTick(it.x, it.y, it.z);
      n++;
    }
    this.randomTicks(pcx, pcz);
    for (const f of Array.from(this.furnaces)) this.tickFurnace(f);
  };

  World.prototype.tickFurnace = function (f) {
    const I = DL.Items;
    const items = f.items;
    const wasBurning = f.burn > 0;
    let changed = false;
    if (f.burn > 0) f.burn--;
    const input = items[0];
    const result = input ? I.smeltResult(input.id) : null;
    const canSmelt = result && (!items[2] || (items[2].id === result.id && items[2].count + result.count <= I.maxStack(result.id)));
    if (f.burn === 0 && canSmelt) {
      const fuel = items[1];
      const t = fuel ? I.fuelTime(fuel.id) : 0;
      if (t > 0) {
        f.burn = f.burnMax = t;
        if (fuel.id === 327) items[1] = I.stack(325);
        else { fuel.count--; if (fuel.count <= 0) items[1] = null; }
        changed = true;
      }
    }
    if (f.burn > 0 && canSmelt) {
      f.cook++;
      if (f.cook >= 200) {
        f.cook = 0;
        if (!items[2]) items[2] = I.copy(result); else items[2].count += result.count;
        input.count--; if (input.count <= 0) items[0] = null;
        changed = true;
      }
    } else f.cook = 0;
    if (wasBurning !== f.burn > 0) {
      const id = this.getBlock(f.x, f.y, f.z);
      if (id === B.furnace || id === B.lit_furnace) {
        const meta = this.getMeta(f.x, f.y, f.z);
        this._furnaceCarry = f;
        const c = this.getChunk(f.x >> 4, f.z >> 4);
        const i = (f.y << 8) | ((f.z & 15) << 4) | (f.x & 15);
        c.tiles.delete(i);
        this.setBlock(f.x, f.y, f.z, f.burn > 0 ? B.lit_furnace : B.furnace, meta);
        if (!c.tiles.has(i)) this.setTile(f.x, f.y, f.z, f);
      }
    }
    if (changed) { const c = this.getChunk(f.x >> 4, f.z >> 4); if (c) c.needsSave = true; }
  };

  /* ---------------------------------------------------------------- */
  /* Persistence                                                      */
  /* ---------------------------------------------------------------- */
  World.prototype.serializeChunk = async function (c, ents) {
    // gather everything synchronously before awaiting (entities may be removed right after)
    const raw = new Uint8Array(65792);
    raw.set(c.blocks, 0); raw.set(c.meta, 32768); raw.set(c.biomes || new Uint8Array(256), 65536);
    const tiles = [];
    for (const te of c.tiles.values()) tiles.push(JSON.parse(JSON.stringify(te)));
    const entities = ents || (this.collectChunkEntities ? this.collectChunkEntities(c) : []);
    const populated = c.populated;
    const comp = await DL.Storage.compress(raw);
    return { raw: comp.raw, data: comp.data, populated, tiles, entities };
  };
  World.prototype.saveChunk = function (c, ents) {
    c.needsSave = false;
    const sk = this.slot + ':' + c.cx + ',' + c.cz;
    this.savedKeys.add(sk);
    // saves finish out of order (compression is async): only the newest one of a chunk is written
    const latest = this._saveLatest || (this._saveLatest = new Map());
    const pending = this._savePending || (this._savePending = new Map());
    const seq = this._saveSeq = (this._saveSeq || 0) + 1;
    latest.set(sk, seq);
    const p = this.serializeChunk(c, ents).then(rec => {
      if (latest.get(sk) === seq) return DL.Storage.putChunk(this.slot, c.cx, c.cz, rec);
    }).catch(e => console.warn('save failed', c.cx, c.cz, e)).then(() => {
      if (latest.get(sk) === seq) { latest.delete(sk); pending.delete(sk); }
    });
    pending.set(sk, p);
    return p;
  };
  /** Serialise every entity once, bucketed by chunk (one consistent snapshot for a whole save). */
  World.prototype.entitiesByChunk = function () {
    const out = new Map();
    if (!this.collectChunkEntities) return out;
    const player = this.game ? this.game.player : null;
    for (const e of this.entities) {
      if (e.removed || e === player || e.isPlayer) continue;
      const d = e.serialize && e.serialize();
      if (!d) continue;
      const k = ckey(Math.floor(e.x / 16), Math.floor(e.z / 16));
      const l = out.get(k);
      if (l) l.push(d); else out.set(k, [d]);
    }
    return out;
  };
  World.prototype.dirtyChunks = function () {
    const byChunk = this.entitiesByChunk(), list = [];
    for (const c of this.chunks.values()) {
      if (!c.generated) continue;
      const ents = byChunk.get(c.key) || [];
      if (!c.lit) { if (c.needsSave) list.push([c, ents]); continue; }
      if (c.needsSave || ents.length) list.push([c, ents]);
    }
    return list;
  };
  /** Save everything now (quitting, leaving the page, changing dimension). */
  World.prototype.saveAll = function () {
    this._saveQueue = null;
    return Promise.all(this.dirtyChunks().map(([c, ents]) => this.saveChunk(c, ents)));
  };
  /** Autosave: snapshot what needs saving now, then copy a few chunks per frame (pumpSaves). */
  World.prototype.autosave = function () {
    this._saveQueue = this.dirtyChunks();
    return this._saveQueue.length;
  };
  World.prototype.pumpSaves = function (budgetMs) {
    const q = this._saveQueue;
    if (!q) return;
    const t0 = performance.now();
    while (q.length && performance.now() - t0 < budgetMs) {
      const [c, ents] = q.pop();
      if (this.chunks.get(c.key) === c) this.saveChunk(c, ents); // unloaded chunks saved themselves
    }
    if (!q.length) this._saveQueue = null;
  };
  World.prototype.saving = function () { return !!(this._saveQueue && this._saveQueue.length) || !!(this._savePending && this._savePending.size); };
  World.prototype.sizeEstimate = function () { return this.savedKeys.size; };
})();
