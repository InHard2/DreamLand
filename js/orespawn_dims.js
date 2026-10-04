/*
 * DreamLand - OreSpawn's six dimensions.
 * Right-click a brown ant for Utopia, a red ant for the Mining Dimension, a rainbow ant for
 * Village Mania, an unstable ant for the Islands, a termite for the Crystal Dimension (you
 * arrive with nothing) and a butterfly for Chaos. Right-click one of the same kind there to
 * come home. The terrain is made in shared.js; this file adds travel, skies, what grows and
 * stands in each world, drifting islands, the royal altars and who lives where.
 * Everything is drawn and built by code; nothing is copied from the mod.
 */
(function () {
  'use strict';
  const DL = window.DL;
  const S = DL.S, B = S.B, CH = S.CH, SEA = S.SEA, I = DL.Items, E = DL.Entities, G = DL.GUI, A = DL.Audio, St = DL.Structures;
  const OS = DL.OreSpawn, OSM = OS && OS.mobs, N = DL.Net, X = DL.Extras, M = DL.Models;
  if (!OS || !OSM) return;
  const GP = DL.Game.prototype, W = DL.World.prototype;
  const SOLID = S.SOLID, LIQUID = S.LIQUID, OPAQUE = S.OPAQUE, LEAVES = S.LEAVES, BI = S.BIOME;
  const MOBS = E.MOBS;
  const rnd = Math.random;
  const isGuest = () => !!(N && N.client);
  const id = (n) => (I.byName[n] ? I.byName[n].id : 0);
  const OD = DL.OreSpawnDims = {};

  /* ------------------------------------------------------------ */
  /* The worlds                                                   */
  /* ------------------------------------------------------------ */
  const UTOPIA = 5, MINING = 6, MANIA = 7, ISLANDS = 8, CRYSTAL = 9, CHAOS = 10;
  const INFO = {
    5: { key: 'utopia', name: 'Utopia', by: 'brown_ant', tip: 'No monsters here: giant trees, fruit and royal altars. Wake a royal at your peril.', ach: ['os_utopia', 'Paradise', 'Ride a brown ant to Utopia'] },
    6: { key: 'mining', name: 'the Mining Dimension', by: 'red_ant', tip: 'Mountains packed with ore, and the dinosaurs that guard it.', ach: ['os_mining', 'Strike the Mother Lode', 'Ride a red ant to the Mining Dimension'] },
    7: { key: 'village_mania', name: 'Village Mania', by: 'rainbow_ant', tip: 'Villages as far as the eye can see.', ach: ['os_mania', 'Neighbours Everywhere', 'Ride a rainbow ant to Village Mania'] },
    8: { key: 'islands', name: 'the Islands', by: 'unstable_ant', tip: 'A low meadow under a sky full of islands. Some of them drift.', ach: ['os_islands', 'Head in the Clouds', 'Ride an unstable ant to the Islands'] },
    9: { key: 'crystal', name: 'the Crystal Dimension', by: 'termite', tip: 'You arrive with nothing. Everything glitters, and a lot of it bites.', ach: ['os_crystal', 'Glass Half Full', 'Ride a termite to the Crystal Dimension'] },
    10: { key: 'chaos', name: 'Chaos', by: 'butterfly', tip: 'A cavern the size of a world, green and full of wings.', ach: ['os_chaos', 'Butterfly Effect', 'Follow a butterfly into Chaos'] }
  };
  OD.INFO = INFO;
  const NAMES = DL.DIM_NAMES || (DL.DIM_NAMES = ['the Overworld', 'the Nether', 'the End', 'the Aether', 'the Sift']);
  for (const d in INFO) NAMES[d] = INFO[d].name;
  const isOS = (d) => d >= UTOPIA && d <= CHAOS;
  OD.isOS = isOS;
  if (X && X.ACH) {
    for (const d in INFO) X.ACH.push([INFO[d].ach[0], INFO[d].ach[1], INFO[d].ach[2], B.ant_hill]);
    X.ACH.push(['os_royal', 'Royal Audience', 'Wake The King or The Queen at a Utopian altar', B.royal_seal]);
  }

  /* ------------------------------------------------------------ */
  /* Blocks: textures, names, drops and recipes                   */
  /* ------------------------------------------------------------ */
  const Tex = DL.Tex, TG = Tex.G, K = Tex.kit;
  const { hex, P, mix, pick, surface, specks, bevel } = K;
  TG.quartz_block = (t) => {
    surface(t, P('#d8d2c8 #e4ded4 #ece8e0 #f4f2ec'), { cells: [8, 4], grain: 0.1 });
    for (let k = 0; k < 4; k++) { const y = 2 + t.ri(12); for (let x = 0; x < 16; x++) if (t.rand() < 0.5) t.set(x, y, hex('#d0c8bc')); }
    bevel(t, hex('#fcfbf8'), hex('#bab2a6'), 0);
  };
  TG.quartz_block_top = (t) => {
    surface(t, P('#dcd6cc #e6e0d6 #eeeae2 #f6f4ee'), { cells: [8, 4], grain: 0.1 });
    for (let i = 2; i < 14; i++) { t.set(i, 2, hex('#c8c0b4')); t.set(i, 13, hex('#c8c0b4')); t.set(2, i, hex('#c8c0b4')); t.set(13, i, hex('#c8c0b4')); }
    bevel(t, hex('#fcfbf8'), hex('#bab2a6'), 0);
  };
  TG.island_block = (t) => {
    surface(t, P('#3a7a6a #4a9a86 #5ab8a0 #7ad8c0'), { cells: [4, 2], grain: 0.3 });
    // a little island floating in the middle, with a glow around it
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, (y - 6) * 1.6);
      if (y >= 5 && y <= 6 && Math.abs(x - 7.5) < 5) t.set(x, y, hex(y === 5 ? '#6ac040' : '#8a6a40'));
      else if (y > 6 && y < 11 && Math.abs(x - 7.5) < 5 - (y - 6) * 1.1) t.set(x, y, hex('#e8e0a8'));
      else if (d < 7 && d > 5.6) t.set(x, y, hex('#c0fff0'));
    }
    specks(t, [[hex('#ffffff'), 0.03]]);
    bevel(t, hex('#a0ffe8'), hex('#1a4a40'), 0);
  };
  const seal = (body, gem) => (t) => {
    surface(t, P('#8a6010 #b88a20 #d8aa30 #f0cc50'), { cells: [4, 2], grain: 0.2 });
    // a crown on a medallion
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 6.2 && d > 5.2) t.set(x, y, hex('#6a4808'));
      else if (d <= 5.2) t.set(x, y, hex(body));
    }
    for (let x = 4; x <= 11; x++) { t.set(x, 10, hex('#ffd848')); t.set(x, 9, hex('#ffd848')); }
    for (const x of [4, 7, 8, 11]) for (let y = 5; y < 9; y++) if (x === 7 || x === 8 ? y > 5 : true) t.set(x, y, hex('#ffd848'));
    t.set(5, 8, hex('#ffd848')); t.set(10, 8, hex('#ffd848'));
    t.set(4, 4, hex(gem)); t.set(11, 4, hex(gem)); t.set(7, 5, hex(gem)); t.set(8, 5, hex(gem));
    bevel(t, hex('#fff0a0'), hex('#4a3008'), 0);
  };
  TG.royal_seal_king = seal('#a01818', '#40e0ff');
  TG.royal_seal_queen = seal('#4a2a9a', '#ff60c0');
  TG.crystal_leaves2 = (t) => {
    const f = K.norm(K.fbm(t, [4, 2], [0.6, 0.4]));
    const pal = P('#2a60c8 #3a7ae0 #4a98f0 #6ab8ff #a0dcff');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = f[y * 16 + x] * 0.55 + t.rand() * 0.45;
      if (v < 0.16) { t.set(x, y, [0, 0, 0], 0); continue; }
      t.set(x, y, pick(pal, (v - 0.16) / 0.84));
    }
    for (let k = 0; k < 6; k++) { const x = t.ri(16), y = t.ri(16); if (t.alpha(x, y)) t.set(x, y, hex('#ffffff')); }
  };
  void mix;
  const disp = (b, name) => { const d = I.get(b); if (d) { d.display = name; d.tab = 'orespawn'; } };
  disp(B.quartz_block, 'Block of Quartz'); disp(B.island_block, 'Island Block'); disp(B.royal_seal, 'Royal Seal'); disp(B.crystal_leaves2, 'Blue Crystal Leaves');
  const shaped = (...a) => { try { I._shaped(...a); } catch (e) { /* missing ingredient */ } };
  shaped(['##', '##'], { '#': 'quartz' }, 'quartz_block');
  // the island block comes from the Islands: or make one from what the floating islands are made of
  shaped(['MEM', 'EDE', 'MEM'], { M: 'mycelium', E: 'end_stone', D: 'diamond' }, 'island_block', 2);
  const blockDrops = I.blockDrops;
  I.blockDrops = function (bid, meta, stack, rng) {
    const r = () => (rng ? rng.next() : rnd());
    if (bid === B.island_block) return [I.stack(B.island_block)];
    if (bid === B.quartz_block) return [I.stack(B.quartz_block)];
    if (bid === B.crystal_leaves2) return r() < 0.05 ? [I.stack(id('crystal_apple'))] : r() < 0.2 ? [I.stack(id('crystal_shards'))] : [];
    if (bid === B.royal_seal) return [];
    return blockDrops.apply(this, arguments);
  };

  /* ------------------------------------------------------------ */
  /* Riding an ant (or a butterfly) between worlds                */
  /* ------------------------------------------------------------ */
  const ANT_KINDS = ['brown_ant', 'brown_ant', 'brown_ant', 'red_ant', 'red_ant', 'rainbow_ant', 'unstable_ant', 'termite'];
  const KIND_INDEX = { brown_ant: 0, red_ant: 3, rainbow_ant: 5, unstable_ant: 6, termite: 7 };
  const dimOf = (m) => (m.def && m.def.ant && m.def.ant.dim) || (m.type === 'butterfly' ? CHAOS : 0);
  function rideTo(m, p, game) {
    const dim = dimOf(m);
    if (!dim || !game) return false;
    // a guest: the host decides where everybody goes
    if (game !== DL.game || p !== game.player) {
      if (game.chatMessage) game.chatMessage('§eIn multiplayer the host takes everyone: ask them to right-click a ' + I._titleCase(m.type).toLowerCase() + '.');
      return true;
    }
    if (isGuest()) { game.chatMessage('§eIn multiplayer the host takes everyone between worlds.'); return true; }
    const w = game.world;
    if (!w || game._traveling) return true;
    const here = w.dim || 0, target = here === dim ? 0 : dim;
    // the Crystal Dimension takes you as you came into the world
    if (target === CRYSTAL && !p.creative) {
      if (p.inv.some(s => s && s.count > 0)) { game.chatMessage('§dThe termite will not carry anything. Empty your inventory to enter the Crystal Dimension.'); A.play('click', null, null, null, 0.4, 0.6); return true; }
      if (p.armor.some(s => s)) { game.chatMessage('§dTake off your armour: the termite carries you as you were born.'); A.play('click', null, null, null, 0.4, 0.6); return true; }
    }
    if (here !== 0 && target !== 0) { game.chatMessage('§eGo home first: this creature only knows the way between ' + NAMES[dim] + ' and the Overworld.'); return true; }
    // friends come along: tamed pets that are not told to sit
    const pets = [];
    for (const e of w.entities) {
      if (e === p || e === m || !e.tamed || e.sitting || e.removed || !(e.health > 0) || !e.def || e.def.boss || e.isPlayer || e.distTo(p) > 24 || pets.length >= 8) continue;
      if (p.vehicle === e) { e.rider = null; p.vehicle = null; }
      e.persistent = true;
      const d = e.serialize && e.serialize();
      if (d) { pets.push(d); e.removed = true; }
    }
    if (p.vehicle) { p.vehicle.rider = null; p.vehicle = null; }
    game.spawnParticles('portal', m.x, m.y + 0.3, m.z, 24, 0.8);
    A.play('teleport', p.x, p.y, p.z, 0.9, 1.3);
    game.travel(target, { type: 'ant', via: m.type, pets, back: target === 0 ? dim : 0 });
    return true;
  }
  OSM.antInteract = rideTo;
  OSM.butterflyInteract = rideTo;
  OD.rideTo = rideTo;

  /** A place to stand near (x, z): from the top down, solid footing with two free blocks above,
   *  and (first choice) firm ground all round, so nobody arrives on the lip of a cliff. */
  const footing = (b) => SOLID[b] && !LIQUID[b] && !LEAVES[b] && b !== B.bedrock && b !== B.cactus && b !== B.lava && b !== B.fire;
  function landing(w, x0, z0, dim) {
    const top = dim === CHAOS ? 120 : CH - 3;
    for (const need of [8, 2]) for (let r = 0; r <= 48; r += 2) for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = x0 + dx, z = z0 + dz;
      if (!w.isReady(x - 1, z - 1) || !w.isReady(x + 1, z + 1)) continue;
      // caverns (Chaos) and the sky islands' meadow below are worth searching further down; elsewhere only the surface counts
      const deep = dim === CHAOS || dim === ISLANDS;
      for (let y = top; y > 2; y--) {
        if (w.getBlock(x, y, z) !== 0 || w.getBlock(x, y + 1, z) !== 0) continue;
        const below = w.getBlock(x, y - 1, z);
        if (below === 0) continue;
        let ground = 0;
        if (footing(below)) for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) if ((ax || az) && footing(w.getBlock(x + ax, y - 1, z + az)) && w.getBlock(x + ax, y, z + az) === 0) ground++;
        if (footing(below) && ground >= need) return [x, y, z];
        if (!deep) break;
      }
    }
    return null;
  }
  OD.landing = landing;
  const FLOOR = { 5: B.grass, 6: B.stone, 7: B.grass, 8: B.grass, 9: B.crystal_stone, 10: B.stone, 0: B.grass };

  /** An ant hill that only ever breeds one kind of ant: the way back. */
  function homeHill(w, x, y, z, kind) {
    const idx = KIND_INDEX[kind];
    if (idx === undefined) return null;
    for (let r = 2; r <= 6; r++) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, hx = Math.floor(x + Math.cos(a) * r), hz = Math.floor(z + Math.sin(a) * r);
      for (let hy = y + 2; hy >= y - 3; hy--) {
        const g = w.getBlock(hx, hy - 1, hz);
        if (w.getBlock(hx, hy, hz) !== 0 || !OPAQUE[g] || g === B.bedrock || g === B.ant_hill) continue;
        w.setBlock(hx, hy - 1, hz, B.ant_hill, 8 | idx, 3);
        return [hx, hy, hz];
      }
    }
    return null;
  }
  OD.homeHill = homeHill;
  // pure ant hills (meta 8 and up) breed only their own kind
  if (DL.RTICK) {
    const hillTick = DL.RTICK[B.ant_hill];
    DL.RTICK[B.ant_hill] = (w, x, y, z, r) => {
      const meta = w.getMeta(x, y, z);
      if (!(meta & 8)) { if (hillTick) hillTick(w, x, y, z, r); return; }
      if (r.nextInt(6) !== 0 || isGuest() || w.getBlock(x, y + 1, z) !== 0) return;
      let near = 0; for (const e of w.entities) if (e.def && e.def.ant && e.dist2(x, y, z) < 64) near++;
      if (near >= 5) return;
      E.spawnMob(w, ANT_KINDS[meta & 7], x + 0.5, y + 1, z + 0.5);
    };
  }

  const arrive = GP.arrive;
  GP.arrive = function (a) {
    if (!a || a.type !== 'ant') return arrive.apply(this, arguments);
    const w = this.world, p = this.player, dim = w.dim || 0;
    const x0 = Math.floor(a.x), z0 = Math.floor(a.z);
    let spot = landing(w, x0, z0, dim);
    if (!spot) {
      const y = dim === CHAOS ? 64 : dim === ISLANDS ? 12 : 80;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        w.setBlock(x0 + dx, y - 1, z0 + dz, FLOOR[dim] || B.stone, 0, 2);
        for (let dy = 0; dy < 3; dy++) w.setBlock(x0 + dx, y + dy, z0 + dz, 0, 0, 2);
      }
      spot = [x0, y, z0];
    }
    p.setPos(spot[0] + 0.5, spot[1], spot[2] + 0.5);
    p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
    // the way back (and the way here again, next time)
    const via = a.via;
    if (via === 'butterfly') {
      if (!isGuest()) for (let i = 0; i < 3; i++) { const b = E.spawnMob(w, 'butterfly', spot[0] + 0.5 + (rnd() - 0.5) * 4, spot[1] + 1.5 + rnd(), spot[2] + 0.5 + (rnd() - 0.5) * 4); if (b) b.persistent = false; }
    } else if (KIND_INDEX[via] !== undefined) {
      let hill = null;
      for (let dx = -12; dx <= 12 && !hill; dx++) for (let dz = -12; dz <= 12 && !hill; dz++) for (let dy = -4; dy <= 4; dy++) {
        const hx = spot[0] + dx, hy = spot[1] + dy, hz = spot[2] + dz;
        if (w.getBlock(hx, hy, hz) === B.ant_hill && (w.getMeta(hx, hy, hz) & 15) === (8 | KIND_INDEX[via])) { hill = [hx, hy + 1, hz]; break; }
      }
      if (!hill) hill = homeHill(w, spot[0], spot[1], spot[2], via);
      if (hill) for (let i = 0; i < (via === 'red_ant' ? 1 : 2); i++) E.spawnMob(w, via, hill[0] + 0.5 + (rnd() - 0.5), hill[1], hill[2] + 0.5 + (rnd() - 0.5));
    }
    // pets arrive where you stand (anywhere else might be inside a wall)
    for (const d of a.pets || []) {
      const e = E.fromSave(w, Object.assign({}, d, { x: spot[0] + 0.5, y: spot[1] + 0.05, z: spot[2] + 0.5 }));
      if (e) { e.persistent = true; e.fallDistance = 0; }
    }
    this.spawnParticles('portal', p.x, p.y + 1, p.z, 30, 1.2);
    if (isOS(dim)) {
      const info = INFO[dim];
      this.chatMessage('§dWelcome to ' + info.name + '! §7' + info.tip);
      const who = info.by === 'butterfly' ? 'butterfly' : I._titleCase(info.by).toLowerCase();
      this.chatMessage('§7Right-click ' + (/^[aeiou]/.test(who) ? 'an ' : 'a ') + who + ' here to go home.');
      if (X && X.grant) X.grant(info.ach[0]);
    } else this.chatMessage('§dBack in ' + NAMES[dim] + '.');
    // friends on Wi-Fi follow the host
    if (N && N.host) N.host.dimensionChanged();
  };

  /* ------------------------------------------------------------ */
  /* Commands                                                     */
  /* ------------------------------------------------------------ */
  const CMD_DIMS = { utopia: 5, mining: 6, mining_dimension: 6, extreme: 6, village_mania: 7, villagemania: 7, villages: 7, mania: 7, islands: 8, island: 8, crystal: 9, crystal_dimension: 9, chaos: 10 };
  const command = GP.command;
  GP.command = function (line) {
    const args = String(line || '').trim().replace(/^\//, '').split(/\s+/);
    const cmd = (args[0] || '').toLowerCase();
    if ((cmd === 'dimension' || cmd === 'dim') && !isGuest()) {
      const d = CMD_DIMS[(args[1] || '').toLowerCase()];
      if (d !== undefined) { this.travel(d, { type: 'ant', via: INFO[d].by, pets: [] }); return; }
    }
    const r = command.apply(this, arguments);
    if (cmd === 'help') this.chatMessage('§eOreSpawn worlds: /dimension <utopia|mining|village_mania|islands|crystal|chaos>, or right-click an ant or a butterfly');
    return r;
  };

  OD.ANT_KINDS = ANT_KINDS;
  OD.KIND_INDEX = KIND_INDEX;
  OD.UTOPIA = UTOPIA; OD.MINING = MINING; OD.MANIA = MANIA; OD.ISLANDS = ISLANDS; OD.CRYSTAL = CRYSTAL; OD.CHAOS = CHAOS;

  /* ------------------------------------------------------------ */
  /* Skies and air                                                */
  /* ------------------------------------------------------------ */
  const RP = DL.Renderer && DL.Renderer.prototype;
  if (RP) {
    const computeSky = RP.computeSky;
    RP.computeSky = function (world, pt) {
      const d = world.dim || 0;
      if (d === CHAOS) { this.skyColor = [0.05, 0.1, 0.08]; this.fogColor = [0.07, 0.13, 0.1]; this.sunrise = null; this.starBright = 0; this.celestial = 0; return; }
      computeSky.apply(this, arguments);
      if (!isOS(d)) return;
      const day = Math.max(0.15, 1 - world.skySubtracted(pt) / 11);
      const tint = (arr, c, k) => arr.map((v, i) => v * (1 - k) + c[i] * k * day);
      if (d === UTOPIA) { this.skyColor = tint(this.skyColor, [0.4, 0.7, 1.0], 0.3); this.fogColor = tint(this.fogColor, [0.86, 0.93, 1.0], 0.15); }
      else if (d === MINING) this.fogColor = tint(this.fogColor, [0.74, 0.7, 0.64], 0.22);
      else if (d === ISLANDS) { this.skyColor = tint(this.skyColor, [0.48, 0.8, 1.0], 0.35); this.fogColor = tint(this.fogColor, [0.9, 0.96, 1.0], 0.25); }
      else if (d === CRYSTAL) { this.skyColor = tint(this.skyColor, [0.7, 0.48, 0.95], 0.5); this.fogColor = tint(this.fogColor, [0.86, 0.72, 0.98], 0.45); this.starBright = Math.max(this.starBright || 0, 0.3); }
    };
    const renderSky = RP.renderSky;
    RP.renderSky = function (world) { if (world.dim === CHAOS) return; return renderSky.apply(this, arguments); };
    const renderClouds = RP.renderClouds;
    RP.renderClouds = function (world) { if (world.dim === CHAOS) return; return renderClouds.apply(this, arguments); };
  }
  // the Crystal Dimension glitters in the air
  const tick = GP.tick;
  GP.tick = function () {
    tick.apply(this, arguments);
    const w = this.world, p = this.player;
    if (!w || !p || !this.inGame || !isOS(w.dim || 0)) return;
    if (w.dim === CRYSTAL && this.tickCount % 3 === 0) {
      const x = p.x + (rnd() - 0.5) * 24, y = p.y + (rnd() - 0.2) * 10, z = p.z + (rnd() - 0.5) * 24;
      if (w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === 0) this.spawnParticles(rnd() < 0.5 ? 'happy' : 'portal', x, y, z, 1, 0);
    }
    if (w.dim === CHAOS && this.tickCount % 4 === 0) {
      const x = p.x + (rnd() - 0.5) * 20, y = p.y + (rnd() - 0.3) * 8, z = p.z + (rnd() - 0.5) * 20;
      if (w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === 0) this.spawnParticles('happy', x, y, z, 1, 0);
    }
  };

  /* ------------------------------------------------------------ */
  /* Things that grow                                             */
  /* ------------------------------------------------------------ */
  const AIRISH = (b) => b === 0 || (!SOLID[b] && !LIQUID[b]) || LEAVES[b];
  /** First air with solid, dry footing, scanning down from y. */
  function floorBelow(w, x, y, z, minY) {
    for (; y > (minY || 2); y--) { const b = w.getBlock(x, y - 1, z); if (w.getBlock(x, y, z) === 0 && SOLID[b] && !LIQUID[b] && !LEAVES[b]) return y; }
    return -1;
  }
  OD.floorBelow = floorBelow;
  function blob(w, cx, cy, cz, rx, ry, rz, id, chance, r) {
    for (let dx = -Math.ceil(rx); dx <= rx; dx++) for (let dy = -Math.ceil(ry); dy <= ry; dy++) for (let dz = -Math.ceil(rz); dz <= rz; dz++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz) > 1) continue;
      if (chance < 1 && r.next() > chance) continue;
      const x = Math.round(cx + dx), y = Math.round(cy + dy), z = Math.round(cz + dz);
      if (w.getBlock(x, y, z) === 0) w.popSet(x, y, z, typeof id === 'function' ? id() : id, 0);
    }
  }
  /** OreSpawn's giant trees: a 2x2 trunk, buttress roots and a crown of leafy clouds. */
  function giantTree(w, r, x, y, z, log, leaves) {
    const below = w.getBlock(x, y - 1, z);
    if (below !== B.grass && below !== B.dirt && below !== B.podzol) return false;
    const h = 16 + r.nextInt(9);
    if (y + h + 6 >= CH) return false;
    for (let yy = -1; yy < h; yy++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (yy < 0 || AIRISH(w.getBlock(x + dx, y + yy, z + dz))) w.popSet(x + dx, y + yy, z + dz, log, 0);
    for (const [dx, dz] of [[-1, 0], [2, 1], [0, -1], [1, 2], [-1, 1], [2, 0], [1, -1], [0, 2]]) {
      const rh = 1 + r.nextInt(3);
      for (let k = -1; k < rh; k++) if (k < 0 || AIRISH(w.getBlock(x + dx, y + k, z + dz))) w.popSet(x + dx, y + k, z + dz, log, 0);
    }
    const n = 4 + r.nextInt(3);
    for (let i = 0; i < n; i++) {
      const by = y + Math.floor(h * (0.5 + r.next() * 0.4)), a = r.next() * Math.PI * 2, len = 3 + r.nextInt(4);
      let ex = x, ey = by, ez = z;
      for (let k = 1; k <= len; k++) {
        ex = Math.round(x + 0.5 + Math.cos(a) * k); ez = Math.round(z + 0.5 + Math.sin(a) * k); ey = by + (k >> 1);
        if (AIRISH(w.getBlock(ex, ey, ez))) w.popSet(ex, ey, ez, log, 0);
      }
      blob(w, ex, ey + 1, ez, 3, 2, 3, leaves, 0.9, r);
    }
    blob(w, x + 0.5, y + h, z + 0.5, 5, 3, 5, leaves, 0.92, r);
    blob(w, x + 0.5, y + h + 3, z + 0.5, 3, 2, 3, leaves, 0.95, r);
    return true;
  }
  /** OreSpawn's scraggly trees: a short trunk that wanders upward, leaves hanging off it. */
  function scraggly(w, r, x, y, z, log, leaves, leaves2) {
    if (!S.SOIL[w.getBlock(x, y - 1, z)]) return false;
    const t = 1 + r.nextInt(3), n = t + 3 + r.nextInt(10);
    for (let k = 0; k < t; k++) if (w.getBlock(x, y + k, z) === 0) w.popSet(x, y + k, z, log, 0);
    const walk = (sx, sy, sz, len, bx, bz) => {
      let cx = sx, cy = sy, cz = sz;
      for (let k = 0; k < len; k++) {
        cx += Math.max(-1, Math.min(1, r.nextInt(2) - r.nextInt(2) + bx)); cz += Math.max(-1, Math.min(1, r.nextInt(2) - r.nextInt(2) + bz)); cy += r.nextInt(3) > 0 ? 1 : 0;
        const b = w.getBlock(cx, cy, cz);
        if (b !== 0 && b !== log && !LEAVES[b]) return;
        w.popSet(cx, cy, cz, log, 0);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (r.nextInt(2) && w.getBlock(cx + dx, cy, cz + dz) === 0) w.popSet(cx + dx, cy, cz + dz, leaves2 && r.nextInt(3) === 0 ? leaves2 : leaves, 0);
        if (r.nextInt(2) && w.getBlock(cx, cy + 1, cz) === 0) w.popSet(cx, cy + 1, cz, leaves, 0);
      }
    };
    walk(x, y + t - 1, z, n - t, 0, 0);
    const br = 1 + r.nextInt(3);
    for (let i = 0; i < br; i++) walk(x, y + t + r.nextInt(Math.max(1, n - t)), z, 3 + r.nextInt(5), r.nextInt(3) - 1, r.nextInt(3) - 1);
    return true;
  }
  /** A crystal tree: round, a tall spire, or scraggly. */
  function crystalTree(w, r, x, y, z, kind) {
    if (w.getBlock(x, y - 1, z) !== B.crystal_grass) return false;
    const L = B.crystal_log, P1 = B.crystal_leaves, P2 = B.crystal_leaves2;
    if (kind === 2) return scraggly(w, r, x, y, z, L, P2, P1);
    const h = kind === 1 ? 8 + r.nextInt(6) : 4 + r.nextInt(3);
    if (y + h + 4 >= CH) return false;
    for (let k = 0; k < h; k++) w.popSet(x, y + k, z, L, 0);
    if (kind === 1) {
      for (let k = 2; k <= h + 2; k++) {
        const rad = Math.max(0, Math.round((h + 2 - k) * 0.38));
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (dx * dx + dz * dz > rad * rad + 0.5 || (k % 2 && Math.abs(dx) + Math.abs(dz) === rad * 2)) continue;
          if (w.getBlock(x + dx, y + k, z + dz) === 0) w.popSet(x + dx, y + k, z + dz, P2, 0);
        }
      }
    } else {
      const leaf = () => (r.nextInt(5) === 0 ? P2 : P1);
      blob(w, x, y + h, z, 2.6, 2.2, 2.6, leaf, 0.95, r);
    }
    return true;
  }
  function hugeMushroom(w, r, x, y, z) {
    const h = 4 + r.nextInt(3), red = r.nextInt(2) === 0;
    for (let k = 0; k < h; k++) w.popSet(x, y + k, z, B.mushroom_stem, 0);
    const cap = red ? B.red_mushroom_block : B.brown_mushroom_block;
    if (red) for (let dy = -2; dy <= 0; dy++) { const rad = dy === 0 ? 1 : 2; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if ((dy === 0 || Math.abs(dx) === rad || Math.abs(dz) === rad) && !(Math.abs(dx) === rad && Math.abs(dz) === rad && dy < 0) && w.getBlock(x + dx, y + h + dy, z + dz) === 0) w.popSet(x + dx, y + h + dy, z + dz, cap, 0); }
    else for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (!(Math.abs(dx) === 3 && Math.abs(dz) === 3) && w.getBlock(x + dx, y + h, z + dz) === 0) w.popSet(x + dx, y + h, z + dz, cap, 0);
  }
  function osOres(w, r, bx, bz, k, host) {
    const list = [[B.ruby_ore, 2, 4, 28, 6], [B.amethyst_ore, 2, 4, 36, 6], [B.uranium_ore, 2, 4, 20, 5], [B.titanium_ore, 2, 4, 20, 5], [B.salt_ore, 3, 30, 50, 8]];
    for (const [ore, n, y0, yr, size] of list) for (let i = 0; i < n * k; i++) w.genMinable(r, bx + r.nextInt(16), y0 + r.nextInt(yr), bz + r.nextInt(16), size, ore, host || B.stone);
  }
  function plantsOn(w, r, x, y, z, ids, soil, n) {
    for (let i = 0; i < (n || 24); i++) {
      const px = x + r.nextInt(7) - r.nextInt(7), pz = z + r.nextInt(7) - r.nextInt(7);
      for (let py = y + 3; py >= y - 3; py--) {
        if (w.getBlock(px, py, pz) !== 0 || w.getBlock(px, py - 1, pz) !== soil) continue;
        w.popSet(px, py, pz, ids[r.nextInt(ids.length)], 0);
        break;
      }
    }
  }
  const CROPS = ['strawberry_crop', 'tomato_crop', 'corn_crop', 'lettuce_crop', 'radish_crop'].map(n => B[n]).filter(Boolean);
  function wildCrop(w, r, x, y, z, crops) {
    const g = w.getBlock(x, y - 1, z);
    if ((g !== B.grass && g !== B.crystal_grass) || w.getBlock(x, y, z) !== 0) return;
    w.popSet(x, y - 1, z, B.farmland, 7); w.popSet(x, y, z, crops[r.nextInt(crops.length)], 6 + r.nextInt(2));
  }
  function hill(w, r, x, y, z, kind) {
    const g = w.getBlock(x, y - 1, z);
    if (!OPAQUE[g] || g === B.bedrock || w.getBlock(x, y, z) !== 0) return;
    w.popSet(x, y - 1, z, B.ant_hill, 8 | KIND_INDEX[kind]);
  }
  function animals(w, r, bx, bz, types, ground, n) {
    const type = types[r.nextInt(types.length)];
    if (!MOBS[type]) return;
    for (let i = 0; i < n; i++) {
      const x = bx + 8 + r.nextInt(16), z = bz + 8 + r.nextInt(16), y = w.topSolidY(x, z);
      if (w.getBlock(x, y - 1, z) !== ground) continue;
      const k = DL.ckey(x >> 4, z >> 4);
      if (!w.pendingAnimals) w.pendingAnimals = new Map();
      if (!w.pendingAnimals.has(k)) w.pendingAnimals.set(k, []);
      w.pendingAnimals.get(k).push({ type, x: x + 0.5, y, z: z + 0.5 });
    }
  }
  const rx = (r, bx) => bx + 8 + r.nextInt(16);

  const POP = {};
  POP[UTOPIA] = (w, c, r, bx, bz) => {
    osOres(w, r, bx, bz, 2);
    // fruit everywhere, and now and then a giant
    if (r.nextInt(40) === 0) { const x = bx + 12 + r.nextInt(8), z = bz + 12 + r.nextInt(8); giantTree(w, r, x, w.topSolidY(x, z), z, r.nextInt(3) ? B.log : B.dark_log, r.nextInt(3) ? B.leaves : B.dark_oak_leaves); }
    const fruit = r.nextInt(3) === 0 ? 1 + r.nextInt(3) : 0;
    for (let i = 0; i < fruit; i++) {
      const x = rx(r, bx), z = rx(r, bz), y = w.topSolidY(x, z);
      if (w.getBlock(x, y - 1, z) !== B.grass) continue;
      const k = r.nextInt(10);
      OS.fruitTree(w, r, x, y, z, k < 6 ? B.apple_leaves : k < 9 ? B.cherry_leaves : B.experience_leaves);
    }
    { const x = rx(r, bx), z = rx(r, bz); plantsOn(w, r, x, w.topSolidY(x, z), z, [B.dandelion, B.rose, B.dandelion, B.rose, B.short_grass].filter(Boolean), B.grass, 20); }
    if (r.nextInt(5) === 0) { const x = rx(r, bx), z = rx(r, bz); wildCrop(w, r, x, w.topSolidY(x, z), z, CROPS); }
    if (r.nextInt(6) === 0) { const x = rx(r, bx), z = rx(r, bz); hill(w, r, x, w.topSolidY(x, z), z, 'brown_ant'); }
    if (r.nextInt(16) === 0) animals(w, r, bx, bz, ['red_cow', 'red_cow', 'gold_cow', 'gazelle', 'enchanted_cow'], B.grass, 1 + r.nextInt(2));
  };
  POP[MINING] = (w, c, r, bx, bz) => {
    osOres(w, r, bx, bz, 3);
    for (let i = 0; i < 4; i++) w.genMinable(r, bx + r.nextInt(16), 20 + r.nextInt(80), bz + r.nextInt(16), 6, B.emerald_ore);
    // ore showing on the cliffs
    for (let i = 0; i < 6; i++) {
      const x = rx(r, bx), z = rx(r, bz), y = w.topSolidY(x, z) - 1 - r.nextInt(3);
      if (w.getBlock(x, y, z) === B.stone) w.popSet(x, y, z, [B.coal_ore, B.iron_ore, B.gold_ore, B.ruby_ore, B.amethyst_ore, B.emerald_ore, B.diamond_ore][r.nextInt(r.nextInt(7) + 1)], 0);
    }
    // boulders
    if (r.nextInt(3) === 0) { const x = rx(r, bx), z = rx(r, bz), y = w.topSolidY(x, z); const mossy = () => (r.nextInt(3) ? B.mossy_cobble : B.cobblestone); blob(w, x, y, z, 1.6 + r.next(), 1.4, 1.6 + r.next(), mossy, 1, r); }
    if (r.nextInt(5) === 0) { const x = rx(r, bx), z = rx(r, bz); hill(w, r, x, w.topSolidY(x, z), z, 'red_ant'); }
    for (let i = 0; i < 2; i++) { const x = rx(r, bx), z = rx(r, bz), y = w.topSolidY(x, z); if (w.getBlock(x, y - 1, z) === B.grass && r.nextInt(3) === 0) w.genTree(r, x, y, z); }
  };
  POP[MANIA] = (w, c, r, bx, bz) => {
    osOres(w, r, bx, bz, 1);
    if (r.nextInt(8) === 0) { const x = rx(r, bx), z = rx(r, bz), y = w.topSolidY(x, z); if (w.getBlock(x, y - 1, z) === B.grass) OS.fruitTree(w, r, x, y, z, B.apple_leaves); }
    if (r.nextInt(6) === 0) { const x = rx(r, bx), z = rx(r, bz); hill(w, r, x, w.topSolidY(x, z), z, 'rainbow_ant'); }
  };
  POP[ISLANDS] = (w, c, r, bx, bz) => {
    // the meadow: scraggly apple trees, tall grass, flowers, unstable ants and island seeds
    const trees = r.nextInt(10) < 6 ? 1 + r.nextInt(r.nextInt(6) + 1) : 0;
    for (let i = 0; i < trees; i++) { const x = bx + 10 + r.nextInt(12), z = bz + 10 + r.nextInt(12), y = floorBelow(w, x, 16, z); if (y > 0) scraggly(w, r, x, y, z, B.log, B.apple_leaves); }
    { const x = rx(r, bx), z = rx(r, bz), y = floorBelow(w, x, 16, z); if (y > 0) plantsOn(w, r, x, y, z, [B.short_grass, B.short_grass, B.short_grass, B.dandelion, B.rose].filter(Boolean), B.grass, 30); }
    if (r.nextInt(5) === 0) { const x = rx(r, bx), z = rx(r, bz), y = floorBelow(w, x, 16, z); if (y > 0) hill(w, r, x, y, z, 'unstable_ant'); }
    if (r.nextInt(10) === 0) { const x = rx(r, bx), z = rx(r, bz), y = floorBelow(w, x, 16, z); if (y > 0 && w.getBlock(x, y - 1, z) === B.grass) w.popSet(x, y, z, B.island_block, 0); }
    if (r.nextInt(4) === 0) { const x = rx(r, bx), z = rx(r, bz), y = floorBelow(w, x, 16, z); if (y > 0) blob(w, x, y, z, 1.2, 1, 1.2, () => (r.nextInt(3) ? B.cobblestone : B.mossy_cobble), 1, r); }
    // the islands above
    for (let i = 0; i < 6; i++) {
      const x = rx(r, bx), z = rx(r, bz), y = w.topSolidY(x, z);
      if (y < 40) continue;
      const g = w.getBlock(x, y - 1, z);
      if (g === B.grass) { if (r.nextInt(3) === 0) (r.nextInt(4) ? w.genTree(r, x, y, z) : OS.fruitTree(w, r, x, y, z, r.nextInt(3) ? B.apple_leaves : B.cherry_leaves)); else plantsOn(w, r, x, y, z, [B.short_grass, B.dandelion, B.rose].filter(Boolean), B.grass, 10); }
      else if (g === B.mycelium) { if (r.nextInt(8) === 0) hugeMushroom(w, r, x, y, z); else if (w.getBlock(x, y, z) === 0) w.popSet(x, y, z, r.nextInt(2) ? B.red_mushroom : B.brown_mushroom, 0); }
    }
    if (r.nextInt(12) === 0) animals(w, r, bx, bz, ['cow', 'sheep', 'pig', 'gazelle', 'ostrich', 'chicken'], B.grass, 2 + r.nextInt(2));
  };
  POP[CRYSTAL] = (w, c, r, bx, bz) => {
    for (let i = 0; i < 6; i++) w.genMinable(r, bx + r.nextInt(16), 4 + r.nextInt(60), bz + r.nextInt(16), 6, B.pink_tourmaline_ore, B.crystal_stone);
    for (let i = 0; i < 6; i++) w.genMinable(r, bx + r.nextInt(16), 4 + r.nextInt(60), bz + r.nextInt(16), 6, B.tigers_eye_ore, B.crystal_stone);
    for (let i = 0; i < 3; i++) w.genMinable(r, bx + r.nextInt(16), 4 + r.nextInt(40), bz + r.nextInt(16), 5, B.amethyst_ore, B.crystal_stone);
    for (let i = 0; i < 8; i++) w.genMinable(r, bx + r.nextInt(16), 10 + r.nextInt(100), bz + r.nextInt(16), 12, B.coal_ore, B.crystal_stone);
    const trees = r.nextInt(4);
    for (let i = 0; i < trees; i++) { const x = rx(r, bx), z = rx(r, bz), k = r.nextInt(20); crystalTree(w, r, x, w.topSolidY(x, z), z, k < 9 ? 0 : k < 16 ? 1 : 2); }
    { const x = rx(r, bx), z = rx(r, bz); plantsOn(w, r, x, w.topSolidY(x, z), z, [B.crystal_flower, B.crystal_flower, B.crystal_torch], B.crystal_grass, r.nextInt(3) ? 10 : 22); }
    if (r.nextInt(6) === 0) { const x = rx(r, bx), z = rx(r, bz); wildCrop(w, r, x, w.topSolidY(x, z), z, [B.rice_crop, B.quinoa_crop].filter(Boolean)); }
    if (r.nextInt(5) === 0) { const x = rx(r, bx), z = rx(r, bz); hill(w, r, x, w.topSolidY(x, z), z, 'termite'); }
    // a crystal chest half-buried in the grass
    if (r.nextInt(14) === 0) {
      const x = rx(r, bx), z = rx(r, bz), y = w.topSolidY(x, z) - 1;
      if (w.getBlock(x, y, z) === B.crystal_grass) {
        w.popSet(x, y, z, B.chest, r.nextInt(4));
        const items = new Array(27).fill(null);
        for (let i = 0, n = 3 + r.nextInt(4); i < n; i++) { const s = St.rollLoot('crystal', r); if (s) items[r.nextInt(27)] = s; }
        w.setTile(x, y, z, { type: 'chest', items });
      }
    }
  };
  POP[CHAOS] = (w, c, r, bx, bz) => {
    // every ore there is
    const ores = [[B.coal_ore, 20, 120, 16], [B.iron_ore, 20, 100, 8], [B.gold_ore, 4, 60, 8], [B.redstone_ore, 8, 40, 7], [B.diamond_ore, 2, 30, 7], [B.emerald_ore, 2, 60, 5]];
    for (const [ore, n, yr, size] of ores) for (let i = 0; i < n; i++) w.genMinable(r, bx + r.nextInt(16), 4 + r.nextInt(yr), bz + r.nextInt(16), size, ore);
    osOres(w, r, bx, bz, 2);
    // floors: trees, grass, flowers, crops, mushrooms in the dark corners
    for (let i = 0; i < 10; i++) {
      const x = rx(r, bx), z = rx(r, bz), y = floorBelow(w, x, 32 + r.nextInt(90), z, 31);
      if (y < 0) continue;
      const g = w.getBlock(x, y - 1, z);
      if (g !== B.grass) { if (r.nextInt(3) === 0 && w.getBlock(x, y, z) === 0) w.popSet(x, y, z, r.nextInt(2) ? B.brown_mushroom : B.red_mushroom, 0); continue; }
      const k = r.nextInt(10);
      if (k < 2) scraggly(w, r, x, y, z, B.log, B.apple_leaves);
      else if (k < 3) OS.fruitTree(w, r, x, y, z, r.nextInt(3) ? B.apple_leaves : B.cherry_leaves);
      else if (k < 4) wildCrop(w, r, x, y, z, CROPS);
      else plantsOn(w, r, x, y, z, [B.short_grass, B.short_grass, B.fern, B.dandelion, B.rose].filter(Boolean), B.grass, 12);
    }
    // glowstone hanging from the roof
    const gc = 4 + r.nextInt(5);
    for (let i = 0; i < gc; i++) {
      const x = rx(r, bx), z = rx(r, bz);
      let y = 36 + r.nextInt(70);
      while (y < 121 && !(w.getBlock(x, y, z) === 0 && w.getBlock(x, y + 1, z) === B.stone)) y++;
      if (y >= 121) continue;
      w.popSet(x, y, z, B.glowstone, 0);
      for (let k = 0; k < 120; k++) {
        const px = x + r.nextInt(5) - r.nextInt(5), py = y - r.nextInt(7), pz = z + r.nextInt(5) - r.nextInt(5);
        if (w.getBlock(px, py, pz) !== 0) continue;
        let nb = 0;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (w.getBlock(px + dx, py + dy, pz + dz) === B.glowstone) nb++;
        if (nb === 1) w.popSet(px, py, pz, B.glowstone, 0);
      }
    }
    for (let i = 0; i < 6; i++) w.genSpring(r, rx(r, bx), 34 + r.nextInt(80), rx(r, bz), B.water);
  };
  const SPAWN_ANIMALS = { 9: [['crystal_cow', 'crystal_cow', 'peacock'], B.crystal_grass] };
  const populateDim = W.populateDim;
  W.populateDim = function (c) {
    const d = this.dim || 0;
    if (!isOS(d)) return populateDim.apply(this, arguments);
    const bx = c.cx * 16, bz = c.cz * 16;
    try {
      if (d === UTOPIA) this.populateOverworld(c, { ores: 1.5, dungeons: false });
      else if (d === MINING) this.populateOverworld(c, { ores: 3 });
      else if (d === MANIA) this.populateOverworld(c, {});
      const r = this.popRng;
      r.setSeed(S.hash2(this.seed ^ 0x05d1a5 ^ (d * 977), c.cx, c.cz));
      this._popOrigin = c;
      POP[d](this, c, r, bx, bz);
      const sa = SPAWN_ANIMALS[d];
      if (sa && r.nextInt(14) === 0) animals(this, r, bx, bz, sa[0], sa[1], 1 + r.nextInt(2));
    } catch (e) { console.warn('OreSpawn populate', d, e); }
    finally { this._popOrigin = null; }
  };
  // nothing natural grows over a village in Village Mania either
  OD.giantTree = giantTree; OD.scraggly = scraggly; OD.crystalTree = crystalTree;

  /* ------------------------------------------------------------ */
  /* Structures                                                   */
  /* ------------------------------------------------------------ */
  const Plan = St.Plan, LOOT = St.LOOT;
  if (LOOT) {
    LOOT.utopia = [['ruby', 1, 3, 6], ['amethyst', 1, 3, 6], ['golden_apple', 1, 1, 3], ['apple', 2, 5, 10], ['cherries', 2, 6, 8], ['peach', 2, 6, 8], ['strawberry', 2, 6, 8], ['experience_sword', 1, 1, 1], ['rose_sword', 1, 1, 1], ['diamond', 1, 2, 4], ['emerald', 1, 3, 4], ['saddle', 1, 1, 3], ['crystal_apple', 1, 1, 2]];
    LOOT.mining = [['diamond', 1, 4, 8], ['emerald', 1, 4, 6], ['ruby', 1, 4, 8], ['amethyst', 1, 4, 8], ['uranium_ingot', 1, 3, 5], ['titanium_ingot', 1, 3, 5], ['iron_ingot', 2, 8, 10], ['gold_ingot', 2, 6, 8], ['lapis_lazuli', 4, 12, 6], ['big_hammer', 1, 1, 1], ['battle_axe', 1, 1, 1], ['trex_tooth', 1, 2, 2], ['ruby_pickaxe', 1, 1, 2], ['amethyst_pickaxe', 1, 1, 1]];
    LOOT.crystal = [['crystal_apple', 1, 3, 8], ['crystal_shards', 2, 8, 10], ['pink_tourmaline_ingot', 1, 4, 8], ['tigers_eye_ingot', 1, 4, 8], ['crystal_planks', 4, 12, 8], ['crystal_stick', 2, 6, 6], ['fairy_sword', 1, 1, 2], ['rat_sword', 1, 1, 2], ['crystal_pickaxe', 1, 1, 3], ['crystal_sword', 1, 1, 2], ['crystal_torch', 2, 6, 5], ['rice', 2, 6, 5]];
    LOOT.islands = [['diamond', 1, 3, 6], ['gold_ingot', 2, 6, 8], ['emerald', 1, 3, 5], ['ender_pearl', 1, 3, 5], ['green_goo', 1, 4, 4], ['ray_gun', 1, 1, 1], ['ultimate_bow', 1, 1, 1], ['peach', 2, 4, 6], ['cherries', 2, 4, 6], ['island_block', 1, 2, 3], ['queen_scale', 1, 2, 1]];
    LOOT.royal = [['royal_guardian_sword', 1, 1, 1], ['diamond', 2, 6, 8], ['gold_block', 1, 3, 6], ['ruby_block', 1, 2, 4], ['golden_apple', 1, 2, 6], ['emerald', 2, 6, 6], ['ultimate_sword', 1, 1, 1]];
  }
  /** A flat-enough site around (x, z) of half-size R: the ground level to build on, or null. */
  function site(ctx, x, z, R, slope, dry) {
    const hs = [];
    let wet = 0;
    for (let dx = -R; dx <= R; dx += Math.max(2, R >> 2)) for (let dz = -R; dz <= R; dz += Math.max(2, R >> 2)) { const h = ctx.h(x + dx, z + dz); hs.push(h); if (h < SEA) wet++; }
    hs.sort((a, b) => a - b);
    if (dry !== false && wet > hs.length * 0.15) return null;
    if (hs[Math.floor(hs.length * 0.9)] - hs[Math.floor(hs.length * 0.1)] > slope) return null;
    return hs[Math.floor(hs.length * 0.6)] + 1;
  }
  /** Level ground: fill below with `base`, clear above, top with `floor`. */
  function pad(pl, ctx, x0, z0, x1, z1, Y, floor, base, clear) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const g = ctx.h(x, z);
      for (let y = Math.min(g, Y - 1); y >= Math.min(g, Y - 1) - 3 && y > 0; y--) if (y < Y - 1) pl.set(x, y, z, base, 0, 1);
      for (let y = g; y < Y - 1; y++) pl.set(x, y, z, base);
      pl.set(x, Y - 1, z, floor);
      for (let y = Y; y < Y + (clear || 8); y++) pl.set(x, y, z, 0);
    }
  }
  const keep = (extra) => Object.assign({ keep: 1 }, extra || {});
  const lit = (pl, x, y, z) => pl.set(x, y, z, B.lantern);

  /* ---- Utopia: the royal temple, where The King or The Queen sleeps ---- */
  function royalTemple(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const R = 20;
    const Y = site(ctx, cx, cz, R + 4, 14);
    if (Y === null || Y + 34 >= CH - 2) return null;
    const pl = new Plan('royal_temple');
    const H = Math.min(28, CH - 6 - Y);
    pad(pl, ctx, cx - R - 3, cz - R - 3, cx + R + 3, cz + R + 3, Y, B.grass, B.dirt, H + 3);
    // the columns: quartz, ringed with gold
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const ox = cx + sx * (R - 3), oz = cz + sz * (R - 3);
      pl.fill(ox - 3, Y, oz - 3, ox + 3, Y, oz + 3, B.quartz_block);
      for (let y = Y + 1; y < Y + H; y++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        pl.set(ox + dx, y, oz + dz, (y - Y) % 7 === 0 ? B.gold_block : B.quartz_block);
      }
      pl.fill(ox - 3, Y + H, oz - 3, ox + 3, Y + H, oz + 3, B.quartz_block);
    }
    // the roof, open in the middle for the royal's wings
    for (let x = cx - R - 1; x <= cx + R + 1; x++) for (let z = cz - R - 1; z <= cz + R + 1; z++) {
      const inner = Math.abs(x - cx) < 9 && Math.abs(z - cz) < 9;
      if (inner) continue;
      pl.set(x, Y + H + 1, z, B.quartz_block);
      const edge = Math.abs(x - cx) === R + 1 || Math.abs(z - cz) === R + 1;
      if (edge && (x + z) % 2 === 0) pl.set(x, Y + H + 2, z, B.quartz_block);
    }
    // the altar: a stepped cross of quartz, rubies at the corners
    const cross = (w1, l1, y) => { pl.fill(cx - w1, y, cz - l1, cx + w1, y, cz + l1, B.quartz_block); pl.fill(cx - l1, y, cz - w1, cx + l1, y, cz + w1, B.quartz_block); };
    cross(3, 10, Y); cross(2, 7, Y + 1); cross(1, 4, Y + 2);
    pl.fill(cx - 1, Y + 3, cz - 1, cx + 1, Y + 3, cz + 1, B.quartz_block);
    for (const [dx, dz] of [[-10, -3], [-10, 3], [10, -3], [10, 3], [-3, -10], [3, -10], [-3, 10], [3, 10]]) pl.set(cx + dx, Y + 1, cz + dz, B.ruby_block);
    const queen = r.next() < 0.5;
    pl.set(cx, Y + 4, cz, B.royal_seal, queen ? 1 : 0);
    pl.seal = [cx, Y + 4, cz, queen ? 1 : 0];
    pl.chest(cx - 2, Y + 3, cz, 'royal', [3, 6], r);
    pl.chest(cx + 2, Y + 3, cz, 'utopia', [4, 7], r);
    // lanterns on posts around the grass
    for (const [dx, dz] of [[-12, 0], [12, 0], [0, -12], [0, 12], [-12, -12], [12, 12], [-12, 12], [12, -12]]) { pl.set(cx + dx, Y, cz + dz, B.fence); pl.set(cx + dx, Y + 1, cz + dz, B.fence); lit(pl, cx + dx, Y + 2, cz + dz); }
    // flower beds
    for (let i = 0; i < 40; i++) { const dx = r.nextInt(2 * R) - R, dz = r.nextInt(2 * R) - R; if (Math.abs(dx) > 11 || Math.abs(dz) > 11) pl.set(cx + dx, Y, cz + dz, r.nextInt(2) ? B.rose : B.dandelion, 0, 3); }
    return pl;
  }

  /* ---- Utopia and the Islands: the ruby dungeon (a ruby obelisk marks the stairs down) ---- */
  function rubyDungeon(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 4, 6);
    if (Y === null) return null;
    const pl = new Plan('ruby_dungeon');
    const D = Y - 14;
    if (D < 6) return null;
    pl.box(cx - 5, D - 1, cz - 5, cx + 5, D + 5, cz + 5, (x, y, z) => ((x + y + z) % 5 === 0 ? B.ruby_ore : (x * 7 + z * 3 + y) % 4 === 0 ? B.mossy_stone_bricks : B.stone_bricks), 0);
    pl.fill(cx - 4, D - 1, cz - 4, cx + 4, D - 1, cz + 4, (x, y, z) => ((x + z) % 2 ? B.ruby_block : B.stone_bricks));
    pl.spawner(cx, D, cz, ctx.dim === ISLANDS ? 'cave_fisher' : 'dungeon_beast');
    pl.chest(cx - 3, D, cz - 3, ctx.dim === ISLANDS ? 'islands' : 'utopia', [4, 8], r);
    pl.chest(cx + 3, D, cz + 3, ctx.dim === ISLANDS ? 'islands' : 'utopia', [4, 8], r);
    lit(pl, cx - 3, D + 3, cz + 3); lit(pl, cx + 3, D + 3, cz - 3);
    // the way down: a ladder shaft into the east wall
    for (let y = D; y < Y + 1; y++) for (let dx = 4; dx <= 6; dx++) for (let dz = -1; dz <= 1; dz++) pl.set(cx + dx, y, cz + dz, dx === 6 && dz === 0 ? B.ladder : 0, dx === 6 && dz === 0 ? 3 : 0);
    for (let y = D; y < Y + 1; y++) { pl.set(cx + 7, y, cz, B.stone_bricks); for (const dz of [-2, 2]) for (let dx = 4; dx <= 6; dx++) pl.set(cx + dx, y, cz + dz, B.stone_bricks, 0, 1); }
    // the obelisk
    for (let k = 0; k < 4; k++) pl.set(cx + 7, Y + k, cz + 2, k === 3 ? B.ruby_block : B.stone_bricks);
    return pl;
  }

  /* ---- the Mining Dimension ---- */
  /** The Basilisk's maze: a roofed stone-brick labyrinth, a lair in the heart of it. */
  function basiliskMaze(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const C = 9, S2 = 4; // 9x9 cells of 4 blocks: 37 wide
    const half = (C * S2) >> 1;
    const Y = site(ctx, cx, cz, half + 2, 18);
    if (Y === null) return null;
    const pl = new Plan('basilisk_maze');
    const x0 = cx - half, z0 = cz - half, H = 5;
    pad(pl, ctx, x0 - 1, z0 - 1, x0 + C * S2 + 1, z0 + C * S2 + 1, Y, B.stone_bricks, B.stone, H + 2);
    const brick = (x, y, z) => { const v = (S.hash2(x * 31 + y, z, 77) >>> 0) % 10; return v < 2 ? B.mossy_stone_bricks : v < 3 ? B.cracked_stone_bricks : B.stone_bricks; };
    // carve a perfect maze (depth-first), then a few loops so it can be escaped
    const open = new Set(), seen = new Set(), stack = [[0, 0]];
    seen.add('0,0');
    while (stack.length) {
      const [a, b] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [a + dx, b + dz]).filter(([u, v]) => u >= 0 && v >= 0 && u < C && v < C && !seen.has(u + ',' + v));
      if (!nb.length) { stack.pop(); continue; }
      const [u, v] = nb[r.nextInt(nb.length)];
      open.add(Math.min(a, u) + ',' + Math.min(b, v) + (a !== u ? 'x' : 'z'));
      seen.add(u + ',' + v); stack.push([u, v]);
    }
    for (let i = 0; i < 8; i++) open.add(r.nextInt(C - 1) + ',' + r.nextInt(C - 1) + (r.nextInt(2) ? 'x' : 'z'));
    const wallAt = (lx, lz) => {
      if (lx <= 0 || lz <= 0 || lx >= C * S2 || lz >= C * S2) return true;
      const ox = lx % S2 === 0, oz = lz % S2 === 0;
      if (ox && oz) return true;
      const a = Math.floor(lx / S2), b = Math.floor(lz / S2);
      if (ox) return !open.has((a - 1) + ',' + b + 'x');
      if (oz) return !open.has(a + ',' + (b - 1) + 'z');
      return false;
    };
    const mid = (C >> 1) * S2;
    for (let lx = 0; lx <= C * S2; lx++) for (let lz = 0; lz <= C * S2; lz++) {
      const x = x0 + lx, z = z0 + lz;
      const lair = Math.abs(lx - mid - S2 / 2) <= S2 && Math.abs(lz - mid - S2 / 2) <= S2;
      const wall = !lair && wallAt(lx, lz);
      for (let y = Y; y < Y + H; y++) pl.set(x, y, z, wall ? brick(x, y, z) : 0);
      // the roof, with a few cracks of light
      pl.set(x, Y + H, z, (S.hash2(x, z, 91) >>> 0) % 23 === 0 ? B.glass : brick(x, Y + H, z));
    }
    // the gate
    for (let y = Y; y < Y + 3; y++) for (let k = 1; k < S2; k++) pl.set(x0 + k, y, z0, 0);
    // the lair
    const lx = x0 + mid + S2 / 2, lz = z0 + mid + S2 / 2;
    pl.fill(lx - 3, Y - 1, lz - 3, lx + 3, Y - 1, lz + 3, B.mossy_cobble);
    pl.chest(lx - 2, Y, lz - 2, 'mining', [4, 8], r); pl.chest(lx + 2, Y, lz + 2, 'mining', [4, 8], r);
    lit(pl, lx, Y + H - 1, lz);
    pl.mob('basilisk', lx + 0.5, Y, lz + 0.5, keep());
    return pl;
  }
  /** Kyuubi's shrine: a nether-brick pagoda over a lava moat. */
  function kyuubiShrine(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 9, 10);
    if (Y === null) return null;
    const pl = new Plan('kyuubi_shrine');
    pad(pl, ctx, cx - 9, cz - 9, cx + 9, cz + 9, Y, B.blackstone, B.stone, 16);
    for (let x = cx - 9; x <= cx + 9; x++) for (let z = cz - 9; z <= cz + 9; z++) {
      const d = Math.max(Math.abs(x - cx), Math.abs(z - cz));
      if (d >= 7 && d <= 8 && !(Math.abs(x - cx) <= 1 && z < cz)) { pl.set(x, Y - 1, z, B.lava); pl.set(x, Y - 2, z, B.blackstone); }
    }
    pl.fill(cx - 1, Y - 1, cz - 9, cx + 1, Y - 1, cz - 6, B.polished_blackstone_bricks);
    // three tiers
    let y = Y;
    for (const [rr, hh] of [[5, 4], [4, 3], [2, 3]]) {
      pl.walls(cx - rr, y, cz - rr, cx + rr, y + hh - 1, cz + rr, (x, yy, z) => (Math.abs(x - cx) === rr && Math.abs(z - cz) === rr ? B.nether_bricks : yy === y + 1 && (x === cx || z === cz) ? 0 : B.nether_bricks));
      pl.fill(cx - rr - 1, y + hh, cz - rr - 1, cx + rr + 1, y + hh, cz + rr + 1, B.nether_bricks);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pl.set(cx + dx * (rr + 1), y + hh + 1, cz + dz * (rr + 1), B.nether_brick_fence);
      y += hh + 1;
    }
    pl.set(cx, Y + 1, cz - 5, 0); pl.set(cx, Y, cz - 5, 0);
    pl.set(cx, y, cz, B.glowstone);
    pl.chest(cx, Y, cz + 3, 'mining', [5, 9], r);
    lit(pl, cx - 3, Y + 2, cz); lit(pl, cx + 3, Y + 2, cz);
    pl.mob('kyuubi', cx + 0.5, Y, cz + 0.5, keep());
    return pl;
  }
  /** A giant hive: honey-coloured walls, wax cells inside, bees at home. */
  function beeHive(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 7, 12);
    if (Y === null) return null;
    const pl = new Plan('bee_hive');
    const RX = 6, RY = 8;
    for (let dx = -RX; dx <= RX; dx++) for (let dz = -RX; dz <= RX; dz++) for (let dy = 0; dy <= RY * 2; dy++) {
      const e = (dx * dx + dz * dz) / (RX * RX) + ((dy - RY) * (dy - RY)) / (RY * RY);
      if (e > 1) continue;
      const shell = e > 0.62;
      const band = dy % 3 === 0;
      pl.set(cx + dx, Y + dy - 1, cz + dz, shell ? (band ? B.yellow_terracotta : B.hay_bale) : (dy % 4 === 0 ? B.hay_bale : 0));
    }
    for (let k = 0; k < 3; k++) { pl.set(cx, Y + k, cz - RX + 1, 0); pl.set(cx, Y + k, cz - RX, 0); }
    pl.chest(cx, Y, cz, 'utopia', [4, 7], r, [I.stack(id('golden_apple') || 322, 1)]);
    for (let i = 0; i < 4; i++) pl.mob('bee', cx + 0.5 + (r.next() - 0.5) * 4, Y + 1, cz + 0.5 + (r.next() - 0.5) * 4, keep());
    return pl;
  }
  /** The alien crash lab: a steel dome full of green goo, aliens inside. */
  function alienLab(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 8, 10);
    if (Y === null) return null;
    const pl = new Plan('alien_lab');
    pad(pl, ctx, cx - 8, cz - 8, cx + 8, cz + 8, Y, B.iron_block, B.stone, 10);
    for (let dx = -7; dx <= 7; dx++) for (let dz = -7; dz <= 7; dz++) for (let dy = 0; dy <= 7; dy++) {
      const d = Math.hypot(dx, dy * 1.05, dz);
      if (d > 7.4) continue;
      pl.set(cx + dx, Y + dy, cz + dz, d > 6.4 ? ((dx + dy + dz) % 3 === 0 ? B.glass : B.iron_block) : 0);
    }
    for (let k = 0; k < 3; k++) for (let w2 = -1; w2 <= 1; w2++) pl.set(cx + w2, Y + k, cz - 7, 0);
    pl.set(cx - 3, Y - 1, cz, B.uranium_block); pl.set(cx + 3, Y - 1, cz, B.uranium_block); pl.set(cx, Y - 1, cz + 3, B.uranium_block);
    pl.spawner(cx, Y, cz + 4, 'alien');
    pl.chest(cx - 4, Y, cz + 2, 'mining', [4, 7], r, [I.stack(id('ray_gun') || 261, 1)]);
    pl.mob('alien', cx + 0.5, Y, cz + 0.5, keep());
    return pl;
  }
  /** The Ender Knight's tower: purpur and end stone in a land of granite. */
  function enderTower(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 4, 8);
    if (Y === null || Y + 26 >= CH) return null;
    const pl = new Plan('ender_tower');
    pad(pl, ctx, cx - 4, cz - 4, cx + 4, cz + 4, Y, B.end_stone_bricks, B.end_stone, 24);
    const H = 20;
    for (let y = Y; y < Y + H; y++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
      if (!edge) { if ((y - Y) % 5 === 4) pl.set(cx + dx, y, cz + dz, B.purpur_block); else pl.set(cx + dx, y, cz + dz, 0); continue; }
      if (Math.abs(dx) === 3 && Math.abs(dz) === 3) pl.set(cx + dx, y, cz + dz, B.purpur_pillar);
      else pl.set(cx + dx, y, cz + dz, (y - Y) % 5 === 2 && (dx === 0 || dz === 0) ? B.glass : B.end_stone_bricks);
    }
    for (let y = Y; y < Y + H; y++) pl.set(cx + 2, y, cz + 2, B.ladder, 3);
    pl.set(cx, Y, cz - 3, 0); pl.set(cx, Y + 1, cz - 3, 0);
    pl.fill(cx - 4, Y + H, cz - 4, cx + 4, Y + H, cz + 4, B.purpur_block);
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) pl.set(cx + dx, Y + H + 1, cz + dz, B.end_rod);
    pl.chest(cx - 1, Y + H - 4, cz - 1, 'end_city', [4, 7], r);
    pl.spawner(cx, Y + 5, cz, 'ender_knight');
    pl.mob('ender_knight', cx + 0.5, Y + H + 1, cz + 0.5, keep());
    return pl;
  }
  /** The Leonopteryx's nest, on the highest peak around. */
  function leonNest(ctx) {
    const { r, x: cx, z: cz } = ctx;
    let bx = cx, bz = cz, by = 0;
    for (let dx = -24; dx <= 24; dx += 4) for (let dz = -24; dz <= 24; dz += 4) { const h = ctx.h(cx + dx, cz + dz); if (h > by) { by = h; bx = cx + dx; bz = cz + dz; } }
    if (by < 92 || by + 8 >= CH) return null;
    const pl = new Plan('leon_nest');
    const Y = by + 1;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 5.4) continue;
      const rim = d > 3.6;
      pl.set(bx + dx, Y - 1, bz + dz, (dx + dz) % 2 ? B.hay_bale : B.log);
      if (rim) for (let k = 0; k < (d > 4.6 ? 2 : 1); k++) pl.set(bx + dx, Y + k, bz + dz, (dx * dz + k) % 3 ? B.log : B.hay_bale);
      else pl.set(bx + dx, Y, bz + dz, 0);
      for (let y = Y - 2; y > Y - 8; y--) pl.set(bx + dx, y, bz + dz, B.stone, 0, 1);
    }
    pl.chest(bx, Y, bz, 'mining', [5, 9], r, [I.stack(id('golden_apple') || 322, 2)]);
    pl.mob('leonopteryx', bx + 0.5, Y + 3, bz + 0.5, keep());
    return pl;
  }
  /** The shadow dungeon: an obsidian vault under the hills, full of ghosts. */
  function shadowDungeon(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const g = ctx.h(cx, cz), D = g - 18;
    if (D < 8) return null;
    const pl = new Plan('shadow_dungeon');
    pl.box(cx - 6, D - 1, cz - 6, cx + 6, D + 5, cz + 6, (x, y, z) => ((x + z + y) % 7 === 0 ? B.crying_obsidian : B.obsidian), 0);
    pl.spawner(cx, D, cz, 'ghost');
    pl.spawner(cx - 4, D, cz + 4, 'ender_reaper');
    pl.chest(cx + 4, D, cz - 4, 'mining', [5, 8], r);
    pl.chest(cx - 4, D, cz - 4, 'mining', [5, 8], r);
    for (let y = D; y <= g + 1; y++) { pl.set(cx + 5, y, cz, B.ladder, 3); pl.set(cx + 6, y, cz, B.obsidian); if (y > D + 5) { pl.set(cx + 4, y, cz, B.obsidian, 0, 1); pl.set(cx + 5, y, cz - 1, B.obsidian, 0, 1); pl.set(cx + 5, y, cz + 1, B.obsidian, 0, 1); } }
    for (const [dx, dz] of [[4, 0], [5, -1], [5, 1], [6, 0]]) pl.set(cx + dx, g + 2, cz + dz, B.obsidian);
    return pl;
  }

  /* ---- Village Mania ---- */
  function damsel(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 4, 4);
    if (Y === null) return null;
    const pl = new Plan('damsel');
    pad(pl, ctx, cx - 4, cz - 4, cx + 4, cz + 4, Y, B.cobblestone, B.dirt, 6);
    pl.walls(cx - 1, Y, cz - 1, cx + 1, Y + 2, cz + 1, B.iron_bars);
    pl.fill(cx - 1, Y + 3, cz - 1, cx + 1, Y + 3, cz + 1, B.slab);
    pl.mob('girlfriend', cx + 0.5, Y, cz + 0.5, keep());
    for (const [dx, dz] of [[-3, 0], [3, 0], [0, 3]]) pl.mob(r.nextInt(2) ? 'spider' : 'red_ant', cx + dx + 0.5, Y, cz + dz + 0.5);
    pl.chest(cx + 3, Y, cz - 3, 'village', [3, 6], r);
    return pl;
  }
  function spiderHangout(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 5, 6);
    if (Y === null) return null;
    const pl = new Plan('spider_hangout');
    pad(pl, ctx, cx - 5, cz - 5, cx + 5, cz + 5, Y, B.mossy_cobble, B.dirt, 7);
    pl.walls(cx - 4, Y, cz - 4, cx + 4, Y + 3, cz + 4, (x, y, z) => ((S.hash2(x, z, y) >>> 0) % 4 === 0 ? 0 : (x + y) % 3 ? B.cobblestone : B.mossy_cobble));
    for (let i = 0; i < 18; i++) pl.set(cx - 3 + r.nextInt(7), Y + r.nextInt(4), cz - 3 + r.nextInt(7), B.cobweb, 0, 3);
    pl.spawner(cx, Y, cz, 'spider');
    pl.chest(cx + 2, Y, cz + 2, 'village', [3, 6], r);
    return pl;
  }
  function redAntHangout(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 4, 5);
    if (Y === null) return null;
    const pl = new Plan('red_ant_hangout');
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 4.3) continue;
      const hgt = Math.max(0, Math.round(2.4 - d * 0.6));
      for (let k = 0; k < hgt; k++) pl.set(cx + dx, Y + k, cz + dz, B.coarse_dirt);
      if (r.nextInt(5) === 0) pl.set(cx + dx, Y - 1 + hgt, cz + dz, B.ant_hill, 8 | KIND_INDEX.red_ant);
    }
    pl.set(cx, Y + 2, cz, B.ant_hill, 8 | KIND_INDEX.red_ant);
    for (let i = 0; i < 5; i++) pl.mob('red_ant', cx + 0.5 + (r.next() - 0.5) * 6, Y + 3, cz + 0.5 + (r.next() - 0.5) * 6);
    return pl;
  }

  /* ---- the Islands: buildings down on the meadow ---- */
  /** The meadow under the islands: the floor height for a footprint, or null where a pond is in the way. */
  function meadow(ctx, x0, z0, x1, z1) {
    const gen = ctx.world.gen;
    let hi = 0, wet = 0, n = 0;
    for (let x = x0; x <= x1; x += 2) for (let z = z0; z <= z1; z += 2) { const g = gen.islandGround(x, z); n++; if (g < 8) wet++; if (g > hi) hi = g; }
    return wet > n * 0.1 ? null : hi + 1;
  }
  function meadowPad(pl, ctx, x0, z0, x1, z1, Y, floor, clear) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      for (let y = 2; y < Y - 1; y++) pl.set(x, y, z, B.dirt, 0, 1);
      pl.set(x, Y - 1, z, floor);
      for (let y = Y; y < Y + (clear || 6); y++) pl.set(x, y, z, 0);
    }
  }
  function islandCastle(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const R = 10, Y = meadow(ctx, cx - R - 2, cz - R - 2, cx + R + 2, cz + R + 2);
    if (Y === null) return null;
    const pl = new Plan('sky_castle');
    meadowPad(pl, ctx, cx - R - 2, cz - R - 2, cx + R + 2, cz + R + 2, Y, B.stone_bricks, 16);
    const brick = (x, y, z) => { const v = (S.hash2(x, z, y) >>> 0) % 9; return v === 0 ? B.mossy_stone_bricks : v === 1 ? B.cracked_stone_bricks : B.stone_bricks; };
    pl.walls(cx - R, Y, cz - R, cx + R, Y + 6, cz + R, brick);
    for (let x = cx - R; x <= cx + R; x += 2) { pl.set(x, Y + 7, cz - R, brick(x, 0, cz)); pl.set(x, Y + 7, cz + R, brick(x, 1, cz)); }
    for (let z = cz - R; z <= cz + R; z += 2) { pl.set(cx - R, Y + 7, z, brick(z, 2, cx)); pl.set(cx + R, Y + 7, z, brick(z, 3, cx)); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = cx + sx * R, tz = cz + sz * R;
      pl.walls(tx - 2, Y, tz - 2, tx + 2, Y + 11, tz + 2, brick);
      pl.fill(tx - 1, Y, tz - 1, tx + 1, Y + 10, tz + 1, 0);
      pl.fill(tx - 2, Y + 12, tz - 2, tx + 2, Y + 12, tz + 2, B.stone_bricks);
      lit(pl, tx, Y + 11, tz);
    }
    // the keep
    pl.walls(cx - 4, Y, cz - 4, cx + 4, Y + 9, cz + 4, brick);
    pl.fill(cx - 4, Y + 10, cz - 4, cx + 4, Y + 10, cz + 4, B.stone_bricks);
    pl.fill(cx - 3, Y + 5, cz - 3, cx + 3, Y + 5, cz + 3, B.dark_planks);
    for (let y = Y; y < Y + 10; y++) pl.set(cx + 3, y, cz + 3, B.ladder, 3);
    for (let y = Y; y < Y + 3; y++) { pl.set(cx, y, cz - 4, 0); for (let k = -1; k <= 1; k++) pl.set(cx + k, y, cz - R, 0); }
    for (const [dx, dz] of [[-2, -6], [2, -6], [-6, 0], [6, 0]]) lit(pl, cx + dx, Y + 3, cz + dz);
    pl.chest(cx - 2, Y + 6, cz + 2, 'islands', [4, 8], r);
    pl.chest(cx, Y, cz + 3, 'islands', [3, 6], r);
    pl.spawner(cx - 2, Y, cz + 2, 'skeleton');
    return pl;
  }
  function enderCastle(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const R = 8, Y = meadow(ctx, cx - R - 1, cz - R - 1, cx + R + 1, cz + R + 1);
    if (Y === null) return null;
    const pl = new Plan('ender_castle');
    meadowPad(pl, ctx, cx - R - 1, cz - R - 1, cx + R + 1, cz + R + 1, Y, B.end_stone_bricks, 22);
    pl.walls(cx - R, Y, cz - R, cx + R, Y + 7, cz + R, (x, y, z) => ((y - Y) % 4 === 3 ? B.purpur_block : B.end_stone_bricks));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = cx + sx * R, tz = cz + sz * R;
      for (let y = Y; y < Y + 14; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) pl.set(tx + dx, y, tz + dz, dx === 0 && dz === 0 ? B.purpur_pillar : B.purpur_block);
      pl.set(tx, Y + 14, tz, B.end_rod);
    }
    pl.fill(cx - R + 1, Y + 7, cz - R + 1, cx + R - 1, Y + 7, cz + R - 1, B.purpur_block);
    pl.walls(cx - 3, Y + 8, cz - 3, cx + 3, Y + 14, cz + 3, B.end_stone_bricks);
    pl.fill(cx - 3, Y + 15, cz - 3, cx + 3, Y + 15, cz + 3, B.purpur_block);
    pl.fill(cx - 2, Y + 8, cz - 2, cx + 2, Y + 14, cz + 2, 0);
    for (let y = Y; y < Y + 3; y++) for (let k = -1; k <= 1; k++) pl.set(cx + k, y, cz - R, 0);
    for (let y = Y; y <= Y + 7; y++) pl.set(cx + R - 1, y, cz + R - 1, B.ladder, 3);
    pl.chest(cx, Y + 8, cz, 'end_city', [5, 9], r);
    pl.spawner(cx, Y, cz, 'ender_knight');
    pl.spawner(cx - 4, Y, cz + 4, 'ender_reaper');
    lit(pl, cx - 4, Y + 4, cz); lit(pl, cx + 4, Y + 4, cz);
    return pl;
  }
  function incaPyramid(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const R = 12, Y = meadow(ctx, cx - R, cz - R, cx + R, cz + R);
    if (Y === null) return null;
    const pl = new Plan('inca_pyramid');
    meadowPad(pl, ctx, cx - R - 1, cz - R - 1, cx + R + 1, cz + R + 1, Y, B.mossy_stone_bricks, 4);
    const stone = (x, y, z) => { const v = (S.hash2(x, y, z) >>> 0) % 7; return v < 2 ? B.mossy_stone_bricks : v < 3 ? B.mossy_cobble : B.stone_bricks; };
    let top = Y;
    for (let k = 0; k <= R - 3; k++) {
      const rr = R - k, y = Y + Math.floor(k * 1.0);
      if (k % 2) continue;
      pl.fill(cx - rr, y, cz - rr, cx + rr, y + 1, cz + rr, stone);
      if (k % 4 === 2) for (let x = cx - rr; x <= cx + rr; x++) { pl.set(x, y + 1, cz - rr, B.gold_block); pl.set(x, y + 1, cz + rr, B.gold_block); }
      top = y + 2;
    }
    // the stair up the north face
    for (let k = 0; k <= R - 3; k++) for (let dx = -1; dx <= 1; dx++) { pl.set(cx + dx, Y + k, cz - R + k, B.stone_brick_stairs, 0); for (let y = Y + k + 1; y < Y + k + 4; y++) pl.set(cx + dx, y, cz - R + k, 0); }
    // the temple on the top
    pl.walls(cx - 2, top, cz - 2, cx + 2, top + 3, cz + 2, B.chiseled_sandstone);
    pl.fill(cx - 3, top + 4, cz - 3, cx + 3, top + 4, cz + 3, B.gold_block);
    pl.fill(cx - 1, top, cz - 1, cx + 1, top + 3, cz + 1, 0);
    pl.set(cx, top, cz - 2, 0); pl.set(cx, top + 1, cz - 2, 0);
    pl.chest(cx, top, cz + 1, 'temple', [4, 8], r);
    pl.chest(cx, top, cz, 'islands', [3, 6], r);
    // a hidden chamber deep inside
    pl.fill(cx - 3, Y, cz - 3, cx + 3, Y + 3, cz + 3, 0);
    pl.spawner(cx, Y, cz, 'velocity_raptor');
    pl.chest(cx + 2, Y, cz + 2, 'temple', [4, 8], r);
    lit(pl, cx - 2, Y + 2, cz - 2);
    return pl;
  }
  function robotLab(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const RX = 9, RZ = 6, Y = meadow(ctx, cx - RX - 1, cz - RZ - 1, cx + RX + 1, cz + RZ + 1);
    if (Y === null) return null;
    const pl = new Plan('robot_lab');
    meadowPad(pl, ctx, cx - RX - 1, cz - RZ - 1, cx + RX + 1, cz + RZ + 1, Y, B.iron_block, 8);
    pl.box(cx - RX, Y - 1, cz - RZ, cx + RX, Y + 5, cz + RZ, (x, y, z) => (y === Y + 2 && (x + z) % 2 === 0 && y < Y + 5 ? B.glass : y === Y + 5 ? B.quartz_block : B.iron_block), 0);
    pl.fill(cx - RX, Y - 1, cz - RZ, cx + RX, Y - 1, cz + RZ, (x, y, z) => ((x + z) % 2 ? B.quartz_block : B.iron_block));
    for (let y = Y; y < Y + 3; y++) { pl.set(cx, y, cz - RZ, 0); pl.set(cx + 1, y, cz - RZ, 0); }
    for (const [dx, dz] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) { pl.set(cx + dx, Y, cz + dz, B.furnace, 1); lit(pl, cx + dx, Y + 4, cz + dz); }
    const robots = ['robo_pounder', 'robo_gunner', 'robo_warrior', 'robo_sniper'].filter(n => MOBS[n]);
    if (robots.length) { pl.spawner(cx - 4, Y, cz, robots[r.nextInt(robots.length)]); pl.mob(robots[r.nextInt(robots.length)], cx + 4.5, Y, cz + 0.5, keep()); }
    pl.chest(cx + 7, Y, cz + 4, 'islands', [4, 8], r, [I.stack(id('ray_gun') || 261, 1)]);
    pl.chest(cx - 7, Y, cz + 4, 'mining', [3, 6], r);
    return pl;
  }
  function greenhouse(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const RX = 7, RZ = 5, Y = meadow(ctx, cx - RX - 1, cz - RZ - 1, cx + RX + 1, cz + RZ + 1);
    if (Y === null) return null;
    const pl = new Plan('greenhouse');
    meadowPad(pl, ctx, cx - RX - 1, cz - RZ - 1, cx + RX + 1, cz + RZ + 1, Y, B.stone_bricks, 7);
    pl.walls(cx - RX, Y, cz - RZ, cx + RX, Y + 4, cz + RZ, (x, y, z) => ((x === cx - RX || x === cx + RX) && (z === cz - RZ || z === cz + RZ) ? B.log : B.glass));
    for (let x = cx - RX; x <= cx + RX; x++) for (let z = cz - RZ; z <= cz + RZ; z++) { const dz = Math.abs(z - cz); pl.set(x, Y + 5 + (dz < 2 ? 1 : 0), z, dz === RZ ? B.log : B.glass); }
    const crops = CROPS.length ? CROPS : [B.wheat];
    for (let x = cx - RX + 1; x < cx + RX; x++) for (let z = cz - RZ + 1; z < cz + RZ; z++) {
      if (z === cz) { pl.set(x, Y - 1, z, B.water); continue; }
      if (x === cx - RX + 1 || x === cx + RX - 1) { pl.set(x, Y - 1, z, B.grass); pl.set(x, Y, z, r.nextInt(2) ? B.rose : B.dandelion); continue; }
      pl.set(x, Y - 1, z, B.farmland, 7); pl.set(x, Y, z, crops[(x + cx) % crops.length], 3 + r.nextInt(5));
    }
    for (let y = Y; y < Y + 2; y++) pl.set(cx, y, cz - RZ, 0);
    pl.set(cx, Y - 1, cz - RZ, B.stone_bricks);
    pl.chest(cx + RX - 1, Y, cz + RZ - 1, 'utopia', [3, 6], r);
    lit(pl, cx, Y + 4, cz);
    return pl;
  }
  function nightmareRookery(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = meadow(ctx, cx - 5, cz - 5, cx + 5, cz + 5);
    if (Y === null) return null;
    const pl = new Plan('nightmare_rookery');
    meadowPad(pl, ctx, cx - 5, cz - 5, cx + 5, cz + 5, Y, B.blackstone, 30);
    const H = 24;
    for (let y = Y; y < Y + H; y++) {
      const rad = 3.6 - (y - Y) / H * 1.2;
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > rad) continue;
        pl.set(cx + dx, y, cz + dz, d > rad - 1 ? ((y + dx) % 5 === 0 ? B.crying_obsidian : (y % 6 === 3 && (dx === 0 || dz === 0)) ? 0 : B.obsidian) : ((y - Y) % 6 === 5 ? B.blackstone : 0));
      }
    }
    for (let y = Y; y < Y + H; y++) { pl.set(cx, y, cz, B.obsidian); pl.set(cx + 1, y, cz, B.ladder, 2); }
    pl.set(cx, Y, cz - 3, 0); pl.set(cx, Y + 1, cz - 3, 0);
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) for (let dy = 0; dy <= 3; dy++) { const d = Math.hypot(dx, dz, dy * 1.6); if (d < 5.2 && d > 3.8 - dy) pl.set(cx + dx, Y + H + dy, cz + dz, B.scary_leaves); }
    pl.chest(cx - 1, Y + H - 1, cz - 1, 'islands', [4, 8], r, [I.stack(id('nightmare_sword') || 276, 1)]);
    pl.spawner(cx, Y + 6, cz, 'terrible_terror');
    pl.mob('ghost', cx + 0.5, Y + 12, cz + 0.5, keep());
    return pl;
  }
  function whiteHouse(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const RX = 12, RZ = 7, Y = meadow(ctx, cx - RX - 4, cz - RZ - 6, cx + RX + 4, cz + RZ + 4);
    if (Y === null) return null;
    const pl = new Plan('white_house');
    meadowPad(pl, ctx, cx - RX - 4, cz - RZ - 8, cx + RX + 4, cz + RZ + 4, Y, B.grass, 14);
    pl.fill(cx - RX, Y - 1, cz - RZ, cx + RX, Y - 1, cz + RZ, B.quartz_block);
    for (const fl of [0, 5]) {
      pl.walls(cx - RX, Y + fl, cz - RZ, cx + RX, Y + fl + 4, cz + RZ, (x, y, z) => ((y - Y) % 5 === 2 && (x + z) % 3 === 0 ? B.glass : B.quartz_block));
      pl.fill(cx - RX + 1, Y + fl + 5, cz - RZ + 1, cx + RX - 1, Y + fl + 5, cz + RZ - 1, B.quartz_block);
    }
    pl.fill(cx - RX, Y + 10, cz - RZ, cx + RX, Y + 10, cz + RZ, B.quartz_block);
    for (let x = cx - RX; x <= cx + RX; x += 2) pl.set(x, Y + 11, cz - RZ, B.quartz_block);
    // the portico: six columns and a pediment
    pl.fill(cx - 6, Y - 1, cz - RZ - 4, cx + 6, Y - 1, cz - RZ - 1, B.quartz_block);
    for (let x = cx - 5; x <= cx + 5; x += 2) for (let y = Y; y < Y + 9; y++) pl.set(x, y, cz - RZ - 3, B.quartz_block);
    for (let k = 0; k < 4; k++) pl.fill(cx - 6 + k, Y + 9 + k, cz - RZ - 4, cx + 6 - k, Y + 9 + k, cz - RZ - 1, B.quartz_block);
    for (let y = Y; y < Y + 3; y++) { pl.set(cx, y, cz - RZ, 0); pl.set(cx + 1, y, cz - RZ, 0); }
    // the flag
    for (let y = Y + 11; y < Y + 18; y++) pl.set(cx, y, cz, B.fence);
    for (let fx = 1; fx <= 5; fx++) for (let fy = 0; fy < 3; fy++) pl.set(cx + fx, Y + 15 + fy, cz, fx <= 2 && fy >= 1 ? B.blue_wool : fy % 2 ? B.wool : B.red_wool);
    // the lawn and the rooms
    for (let x = cx - RX - 3; x <= cx + RX + 3; x++) for (const z of [cz - RZ - 7, cz + RZ + 3]) pl.set(x, Y, z, B.fence);
    for (let y = Y; y < Y + 10; y++) pl.set(cx + RX - 1, y, cz + RZ - 1, B.ladder, 3);
    pl.chest(cx - RX + 2, Y + 6, cz + RZ - 2, 'islands', [4, 8], r);
    pl.chest(cx, Y, cz + RZ - 1, 'village', [3, 6], r);
    pl.set(cx - 4, Y, cz, B.bookshelf); pl.set(cx - 5, Y, cz, B.bookshelf); pl.set(cx + 4, Y, cz, B.crafting_table);
    lit(pl, cx - 6, Y + 3, cz); lit(pl, cx + 6, Y + 3, cz); lit(pl, cx, Y + 8, cz);
    pl.mob(r.nextInt(2) ? 'girlfriend' : 'boyfriend', cx + 0.5, Y, cz + 2.5, keep());
    return pl;
  }
  function giantPumpkin(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const R = 6, Y = meadow(ctx, cx - R, cz - R, cx + R, cz + R);
    if (Y === null) return null;
    const pl = new Plan('giant_pumpkin');
    meadowPad(pl, ctx, cx - R - 1, cz - R - 1, cx + R + 1, cz + R + 1, Y, B.grass, 4);
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) for (let dy = 0; dy <= 2 * R - 2; dy++) {
      const d = Math.hypot(dx, (dy - R + 1) * 1.15, dz);
      if (d > R + 0.3) continue;
      const shell = d > R - 0.9;
      let b = shell ? B.pumpkin : 0;
      // the carved face, glowing
      if (shell && dz < -3 && ((Math.abs(dx) === 2 || Math.abs(dx) === 3) && dy === R + 1 || (Math.abs(dx) <= 3 && dy === R - 3 && dx % 2 === 0) || (dx === 0 && dy === R - 1))) b = B.jack_o_lantern;
      // pumpkins look inward, so only the carved face looks out
      const inward = Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 3 : 2) : (dz < 0 ? 1 : 0);
      pl.set(cx + dx, Y + dy, cz + dz, b, b === B.pumpkin ? inward : 0);
    }
    for (let y = Y; y < Y + 2 * R - 1; y++) pl.set(cx, y, cz, y >= Y + 2 * R - 3 ? B.log : 0);
    pl.set(cx, Y + 2 * R - 1, cz, B.log); pl.set(cx, Y + 2 * R, cz, B.leaves); pl.set(cx + 1, Y + 2 * R - 1, cz, B.leaves);
    for (let y = Y; y < Y + 3; y++) pl.set(cx + R, y, cz, 0), pl.set(cx + R - 1, y, cz, 0);
    pl.fill(cx - 4, Y - 1, cz - 4, cx + 4, Y - 1, cz + 4, B.planks);
    pl.chest(cx - 2, Y, cz + 2, 'islands', [3, 7], r, [I.stack(B.pumpkin, 4)]);
    pl.set(cx + 2, Y, cz + 2, B.crafting_table); lit(pl, cx, Y + 4, cz);
    return pl;
  }
  function rainbow(ctx) {
    const { x: cx, z: cz, r } = ctx;
    const Y = meadow(ctx, cx - 24, cz - 2, cx + 24, cz + 2);
    if (Y === null) return null;
    const pl = new Plan('rainbow');
    const bands = [B.red_wool, B.orange_terracotta, B.yellow_terracotta, B.moss_block, B.blue_wool, B.purpur_block];
    const along = r.nextInt(2);
    for (let a = -24; a <= 24; a++) for (let yy = 0; yy <= 24; yy++) {
      const d = Math.hypot(a, yy);
      if (d < 18 || d >= 24) continue;
      const b = bands[Math.floor((24 - d))];
      for (let t = -1; t <= 1; t++) pl.set(along ? cx + a : cx + t, Y + yy - 1, along ? cz + t : cz + a, b, 0, 3);
    }
    // a pot of gold at one end
    const ex = along ? cx + 21 : cx, ez = along ? cz : cz + 21;
    pl.chest(along ? ex : ex + 2, Y, along ? ez + 2 : ez, 'islands', [3, 5], r, [I.stack(B.gold_block, 3), I.stack(id('gold_ingot') || 266, 16)]);
    return pl;
  }

  /* ---- the Crystal Dimension ---- */
  function crystalTower(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 5, 8);
    if (Y === null || Y + 32 >= CH) return null;
    const pl = new Plan('crystal_battle_tower');
    pad(pl, ctx, cx - 6, cz - 6, cx + 6, cz + 6, Y, B.crystal_stone, B.crystal_stone, 32);
    const F = 5, H = 6;
    for (let f = 0; f < F; f++) {
      const y0 = Y + f * H;
      pl.walls(cx - 4, y0, cz - 4, cx + 4, y0 + H - 1, cz + 4, (x, y, z) => ((Math.abs(x - cx) === 4 && Math.abs(z - cz) === 4) ? B.crystal_log : (y - y0) === 3 && (x === cx || z === cz) ? B.glass : B.crystal_stone));
      pl.fill(cx - 3, y0 + H - 1, cz - 3, cx + 3, y0 + H - 1, cz + 3, B.crystal_planks);
      for (let y = y0; y < y0 + H; y++) pl.set(cx + 3, y, cz + 3, B.ladder, 3);
      pl.set(cx - 3, y0, cz - 3, B.crystal_torch);
      const foe = ['rat', 'urchin', 'rotator', 'dungeon_beast', 'rat'][f];
      if (MOBS[foe] && f < F - 1) pl.spawner(cx, y0, cz, foe);
    }
    for (let x = cx - 5; x <= cx + 5; x++) for (let z = cz - 5; z <= cz + 5; z++) if (Math.abs(x - cx) === 5 || Math.abs(z - cz) === 5) { pl.set(x, Y + F * H - 1, z, B.crystal_stone); if ((x + z) % 2 === 0) pl.set(x, Y + F * H, z, B.crystal_stone); }
    pl.set(cx, Y, cz - 4, 0); pl.set(cx, Y + 1, cz - 4, 0);
    pl.chest(cx - 2, Y + (F - 1) * H, cz + 2, 'crystal', [5, 9], r);
    pl.chest(cx + 2, Y + (F - 1) * H, cz - 2, 'crystal', [5, 9], r);
    pl.set(cx, Y + F * H, cz, B.crystal_torch);
    return pl;
  }
  function rotatorStation(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 5, 10);
    if (Y === null) return null;
    const pl = new Plan('rotator_station');
    const P0 = Y + 6;
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) for (let y = ctx.h(cx + dx, cz + dz); y < P0; y++) pl.set(cx + dx, y, cz + dz, B.crystal_log);
    pl.fill(cx - 5, P0, cz - 5, cx + 5, P0, cz + 5, B.crystal_planks);
    for (let x = cx - 5; x <= cx + 5; x++) for (let z = cz - 5; z <= cz + 5; z++) if (Math.abs(x - cx) === 5 || Math.abs(z - cz) === 5) pl.set(x, P0 + 1, z, B.fence, 7 << 4);
    for (let y = ctx.h(cx - 6, cz) + 1; y <= P0; y++) { if (y < P0) pl.set(cx - 5, y, cz, B.crystal_log); pl.set(cx - 6, y, cz, B.ladder, 3); }
    pl.set(cx - 5, P0 + 1, cz, 0);
    if (MOBS.rotator) { pl.spawner(cx - 2, P0 + 1, cz, 'rotator'); pl.spawner(cx + 2, P0 + 1, cz, 'rotator'); }
    pl.chest(cx, P0 + 1, cz + 3, 'crystal', [4, 8], r);
    pl.set(cx, P0 + 1, cz - 3, B.crystal_torch);
    return pl;
  }
  function crystalHaunted(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 5, 6);
    if (Y === null) return null;
    const pl = new Plan('crystal_haunted_house');
    pad(pl, ctx, cx - 5, cz - 5, cx + 5, cz + 5, Y, B.crystal_planks, B.crystal_stone, 10);
    pl.walls(cx - 4, Y, cz - 4, cx + 4, Y + 4, cz + 4, (x, y, z) => ((Math.abs(x - cx) === 4 && Math.abs(z - cz) === 4) ? B.crystal_log : (S.hash2(x, y, z) >>> 0) % 9 === 0 ? 0 : B.crystal_planks));
    for (let k = 0; k <= 4; k++) pl.fill(cx - 5 + k, Y + 5 + k, cz - 5, cx + 5 - k, Y + 5 + k, cz + 5, B.crystal_planks);
    pl.set(cx, Y, cz - 4, 0); pl.set(cx, Y + 1, cz - 4, 0);
    for (let i = 0; i < 10; i++) pl.set(cx - 3 + r.nextInt(7), Y + r.nextInt(4), cz - 3 + r.nextInt(7), B.cobweb, 0, 3);
    pl.spawner(cx, Y, cz, 'ghost');
    pl.chest(cx + 3, Y, cz + 3, 'crystal', [4, 8], r);
    return pl;
  }
  function fairyTree(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 4, 8);
    if (Y === null || Y + 30 >= CH) return null;
    const pl = new Plan('fairy_tree');
    const H = 18 + r.nextInt(6);
    for (let y = Y - 2; y < Y + H; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!(Math.abs(dx) + Math.abs(dz) === 2 && y > Y + H - 4)) pl.set(cx + dx, y, cz + dz, B.crystal_log);
    // a hollow at the roots with the fairies' hoard
    pl.set(cx, Y, cz - 1, 0); pl.set(cx, Y + 1, cz - 1, 0); pl.set(cx, Y, cz, 0); pl.set(cx, Y + 1, cz, 0);
    pl.chest(cx, Y, cz + 1 - 1, 'crystal', [5, 9], r, [I.stack(id('fairy_sword') || 267, 1)]);
    for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]]) pl.set(cx + dx, Y, cz + dz, B.crystal_log, 0, 1);
    const crown = (ox, oy, oz, rad) => { for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) for (let dy = -2; dy <= 2; dy++) { const d = Math.hypot(dx, dy * 1.6, dz); if (d <= rad && (S.hash2(ox + dx, oy + dy, oz + dz) >>> 0) % 9) pl.set(ox + dx, oy + dy, oz + dz, (dx + dy + dz) % 3 ? B.crystal_leaves : B.crystal_leaves2, 0, 3); } };
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + r.next(), by = Y + Math.floor(H * 0.55) + r.nextInt(4), len = 4 + r.nextInt(3);
      let ex = cx, ez = cz, ey = by;
      for (let k = 1; k <= len; k++) { ex = Math.round(cx + Math.cos(a) * k); ez = Math.round(cz + Math.sin(a) * k); ey = by + (k >> 1); pl.set(ex, ey, ez, B.crystal_log); }
      crown(ex, ey + 1, ez, 3);
    }
    crown(cx, Y + H, cz, 5);
    for (let i = 0; i < 6; i++) pl.set(cx - 5 + r.nextInt(11), Y, cz - 5 + r.nextInt(11), B.crystal_flower, 0, 3);
    for (let i = 0; i < 4; i++) pl.mob('fairy', cx + 0.5 + (r.next() - 0.5) * 6, Y + 3 + r.nextInt(6), cz + 0.5 + (r.next() - 0.5) * 6, keep());
    return pl;
  }
  function urchinPit(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 3, 5);
    if (Y === null) return null;
    const pl = new Plan('urchin_pit');
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
      for (let y = Y - 6; y < Y; y++) pl.set(cx + dx, y, cz + dz, edge || y === Y - 6 ? B.crystal_stone : 0);
    }
    pl.spawner(cx, Y - 5, cz, 'urchin');
    pl.chest(cx + 2, Y - 5, cz + 2, 'crystal', [3, 6], r);
    pl.set(cx - 2, Y - 5, cz - 2, B.crystal_torch);
    return pl;
  }
  function irukandjiPool(ctx) {
    const { r, x: cx, z: cz } = ctx;
    const Y = site(ctx, cx, cz, 5, 4);
    if (Y === null) return null;
    const pl = new Plan('irukandji_pool');
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 5.3) continue;
      const depth = Math.max(1, Math.round(4 - d * 0.6));
      for (let y = Y - depth; y < Y; y++) pl.set(cx + dx, y, cz + dz, B.water);
      pl.set(cx + dx, Y - depth - 1, cz + dz, B.crystal_stone);
      if (d > 4.4) pl.set(cx + dx, Y - 1, cz + dz, B.crystal_stone);
    }
    for (let i = 0; i < 3; i++) pl.mob('irukandji', cx + 0.5 + (r.next() - 0.5) * 3, Y - 2, cz + 0.5 + (r.next() - 0.5) * 3, keep());
    return pl;
  }

  // where each is found: spacing in chunks between possible starts, and how likely each start is
  const T = (name, dim, spacing, sep, radius, chance, salt, build) => St.TYPES.push({ name, dim, spacing, sep, radius, chance, salt, build });
  T('royal_temple', UTOPIA, 40, 10, 2, 0.75, 0x0d501, royalTemple);
  T('ruby_dungeon', UTOPIA, 9, 3, 1, 0.5, 0x0d502, rubyDungeon);
  T('basilisk_maze', MINING, 22, 6, 2, 0.8, 0x0d601, basiliskMaze);
  T('kyuubi_shrine', MINING, 20, 6, 1, 0.7, 0x0d602, kyuubiShrine);
  T('bee_hive', MINING, 14, 4, 1, 0.6, 0x0d603, beeHive);
  T('alien_lab', MINING, 18, 5, 1, 0.7, 0x0d604, alienLab);
  T('ender_tower', MINING, 18, 5, 1, 0.7, 0x0d605, enderTower);
  T('leon_nest', MINING, 16, 4, 2, 0.7, 0x0d606, leonNest);
  T('shadow_dungeon', MINING, 12, 3, 1, 0.6, 0x0d607, shadowDungeon);
  T('damsel', MANIA, 16, 4, 1, 0.6, 0x0d701, damsel);
  T('spider_hangout', MANIA, 14, 4, 1, 0.6, 0x0d702, spiderHangout);
  T('red_ant_hangout', MANIA, 10, 3, 1, 0.6, 0x0d703, redAntHangout);
  T('sky_castle', ISLANDS, 22, 6, 2, 0.8, 0x0d801, islandCastle);
  T('ender_castle', ISLANDS, 26, 6, 2, 0.7, 0x0d802, enderCastle);
  T('inca_pyramid', ISLANDS, 24, 6, 2, 0.8, 0x0d803, incaPyramid);
  T('robot_lab', ISLANDS, 22, 6, 1, 0.7, 0x0d804, robotLab);
  T('greenhouse', ISLANDS, 16, 4, 1, 0.7, 0x0d805, greenhouse);
  T('nightmare_rookery', ISLANDS, 24, 6, 1, 0.7, 0x0d806, nightmareRookery);
  T('white_house', ISLANDS, 30, 8, 2, 0.8, 0x0d807, whiteHouse);
  T('giant_pumpkin', ISLANDS, 16, 4, 1, 0.6, 0x0d808, giantPumpkin);
  T('rainbow', ISLANDS, 20, 5, 2, 0.6, 0x0d809, rainbow);
  T('ruby_dungeon', ISLANDS, 12, 3, 1, 0.5, 0x0d80a, rubyDungeon);
  T('crystal_battle_tower', CRYSTAL, 16, 4, 1, 0.8, 0x0d901, crystalTower);
  T('rotator_station', CRYSTAL, 12, 3, 1, 0.6, 0x0d902, rotatorStation);
  T('crystal_haunted_house', CRYSTAL, 14, 4, 1, 0.6, 0x0d903, crystalHaunted);
  T('fairy_tree', CRYSTAL, 14, 4, 2, 0.7, 0x0d904, fairyTree);
  T('urchin_pit', CRYSTAL, 8, 2, 1, 0.5, 0x0d905, urchinPit);
  T('irukandji_pool', CRYSTAL, 10, 3, 1, 0.5, 0x0d906, irukandjiPool);
  // Village Mania: villages everywhere, close together
  const VT = St.TYPES.find(t => t.name === 'village' && t.dim === 0);
  if (VT) St.TYPES.push(Object.assign({}, VT, { dim: MANIA, spacing: 11, sep: 3, chance: 0.95, salt: 0x0d7f1 }));
  // guardians stay put
  const fromSave = E.fromSave;
  E.fromSave = function (w, d) { const m = fromSave.apply(this, arguments); if (m && d && d.keep) { m.keep = true; m.persistent = true; } return m; };
  const mser = E.Mob.prototype.serialize;
  E.Mob.prototype.serialize = function () { const d = mser.apply(this, arguments); if (d && this.keep) d.keep = 1; return d; };

  /* ------------------------------------------------------------ */
  /* Drifting islands                                             */
  /* ------------------------------------------------------------ */
  // Every drifting island has a core (an island block inside it). The island is whatever is
  // joined to its core, so a house built on one drifts along with it. Islands remember where
  // they started and wander within a few chunks of it.
  function islandList(w) {
    const g = DL.game, m = g && g.meta;
    if (!m) return [];
    if (!m.islands) m.islands = {};
    const k = String(w.dim || 0);
    return m.islands[k] || (m.islands[k] = []);
  }
  OD.islandList = islandList;
  function buildIsland(w, x, y, z, radius, depth, r) {
    // OreSpawn's recipe: a mycelium top with mushrooms, layers of end stone below, diamonds in the end stone
    for (let i = 0; i < depth; i++) {
      const rad = radius / (i + 1), yy = y - i;
      for (let dx = -Math.ceil(rad); dx <= rad; dx++) for (let dz = -Math.ceil(rad); dz <= rad; dz++) {
        if (dx * dx + dz * dz > rad * rad) continue;
        if (w.getBlock(x + dx, yy, z + dz) !== 0) continue;
        if (i === 0) {
          w.setBlock(x + dx, yy, z + dz, r.nextInt(5000) === 0 ? B.lava : B.mycelium, 0, 2);
          if (r.nextInt(20) === 0 && w.getBlock(x + dx, yy + 1, z + dz) === 0) w.setBlock(x + dx, yy + 1, z + dz, r.nextInt(2) ? B.brown_mushroom : B.red_mushroom, 0, 2);
        } else w.setBlock(x + dx, yy, z + dz, r.nextInt(10) === 0 ? B.diamond_ore : B.end_stone, 0, 2);
      }
    }
    const cy = depth > 1 ? y - 1 : y;
    w.setBlock(x, cy, z, B.island_block, 0, 2);
    return [x, cy, z];
  }
  /** Raise a drifting island above (x, y, z): from an island block on the ground, or one just placed. */
  function launchIsland(w, x, y, z, quiet) {
    const r = new S.RNG((S.hash2(w.seed ^ 0x15a, x, z) ^ y) >>> 0);
    const radius = r.nextInt(40) ? 3 + r.nextInt(4) : 6 + r.nextInt(5);
    const depth = radius <= 6 ? 2 + r.nextInt(3) : 3 + r.nextInt(4);
    let top = Math.min(CH - 6, y + 12 + r.nextInt(16));
    // room to float: look for clear air above
    for (let tries = 0; tries < 8; tries++) {
      let clear = true;
      for (let dx = -radius; dx <= radius && clear; dx += 2) for (let dz = -radius; dz <= radius && clear; dz += 2) for (let dy = -depth; dy <= 2; dy++) if (w.getBlock(x + dx, top + dy, z + dz) !== 0) { clear = false; break; }
      if (clear) break;
      top = Math.min(CH - 6, top + 4);
    }
    if (w.getBlock(x, y, z) === B.island_block) w.setBlock(x, y, z, 0, 0, 3);
    const core = buildIsland(w, x, top, z, radius, depth, r);
    islandList(w).push({ x: core[0], y: core[1], z: core[2], hx: x, hz: z, dir: r.next() * Math.PI * 2, spd: 0.012 + r.next() * 0.012, fx: 0, fz: 0 });
    if (w.fx) { w.fx.sound('portal', x + 0.5, top, z + 0.5, 1, 1.4); for (let i = 0; i < 4; i++) w.fx.particles('happy', x + 0.5, y + 1 + i * (top - y) / 4, z + 0.5, 6, 0.6); }
    if (!quiet && DL.game) DL.game.chatMessage('§bAn island rises into the sky!');
  }
  OD.launchIsland = launchIsland;
  function takeTile(w, x, y, z) {
    const c = w.getChunk(x >> 4, z >> 4);
    if (!c || !c.tiles) return null;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15), te = c.tiles.get(i);
    if (!te) return null;
    c.tiles.delete(i); w.furnaces.delete(te); w.spawners.delete(te);
    return te;
  }
  /** Everything joined to the core, or null when the island has run into the land (it is stuck for good). */
  function gatherIsland(w, isl) {
    const out = [], seen = new Set(), q = [[isl.x, isl.y, isl.z]];
    while (q.length) {
      const [x, y, z] = q.pop(), k = x + ',' + y + ',' + z;
      if (seen.has(k)) continue;
      seen.add(k);
      const id = w.getBlock(x, y, z);
      if (!id || (LIQUID[id] && w.getMeta(x, y, z) !== 0)) continue;
      if (id === B.bedrock || Math.abs(x - isl.x) > 16 || Math.abs(z - isl.z) > 16 || Math.abs(y - isl.y) > 12 || out.length > 1600) return null;
      out.push([x, y, z, id, w.getMeta(x, y, z)]);
      q.push([x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]);
    }
    return out;
  }
  function driftStep(w, isl, game) {
    // steer: wander, and turn for home when far from it
    const home = Math.hypot(isl.x - isl.hx, isl.z - isl.hz);
    if (home > 56) isl.dir = Math.atan2(isl.hz - isl.z, isl.hx - isl.x) + (rnd() - 0.5) * 0.6;
    else if (rnd() < 0.01) isl.dir += (rnd() - 0.5) * 2;
    isl.fx += Math.cos(isl.dir) * isl.spd; isl.fz += Math.sin(isl.dir) * isl.spd;
    const sx = Math.trunc(isl.fx), sz = Math.trunc(isl.fz);
    if (!sx && !sz) return true;
    isl.fx -= sx; isl.fz -= sz;
    if (w.getBlock(isl.x, isl.y, isl.z) !== B.island_block) return false;
    const blocks = gatherIsland(w, isl);
    if (!blocks) return false;
    const mine = new Set(blocks.map(b => b[0] + ',' + b[1] + ',' + b[2]));
    for (const [x, y, z] of blocks) {
      const k = (x + sx) + ',' + y + ',' + (z + sz);
      if (mine.has(k)) continue;
      const t = w.getBlock(x + sx, y, z + sz);
      if (t !== 0 && !(S.REPLACE && S.REPLACE[t]) && t !== B.fire) { isl.dir += Math.PI * (0.5 + rnd()); isl.fx = isl.fz = 0; return true; }
      if (!w.isReady(x + sx, z + sz)) return true;
    }
    // riders: anything standing on the island moves with it
    const riders = [];
    for (const e of w.entities) {
      if (e.removed || !e.box) continue;
      const fx = Math.floor(e.x), fy = Math.floor(e.box[1] - 0.05), fz = Math.floor(e.z);
      if (mine.has(fx + ',' + fy + ',' + fz) && e.box[1] - (fy + 1) < 0.6) riders.push(e);
    }
    const tiles = new Map();
    for (const [x, y, z] of blocks) { const te = takeTile(w, x, y, z); if (te) tiles.set((x + sx) + ',' + y + ',' + (z + sz), te); }
    const dest = new Map();
    for (const [x, y, z, id, m] of blocks) dest.set((x + sx) + ',' + y + ',' + (z + sz), [x + sx, y, z + sz, id, m]);
    for (const [x, y, z] of blocks) if (!dest.has(x + ',' + y + ',' + z)) w.setBlock(x, y, z, 0, 0, 2);
    for (const [k, [x, y, z, id, m]] of dest) {
      w.setBlock(x, y, z, id, m, 2);
      const te = tiles.get(k);
      if (te) { te.x = x; te.y = y; te.z = z; w.setTile(x, y, z, te); }
    }
    for (const e of riders) { e.setPos(e.x + sx, e.y, e.z + sz); if (e.prevX !== undefined) { e.prevX += sx; e.prevZ += sz; } }
    isl.x += sx; isl.z += sz;
    void game;
    return 'moved';
  }
  OD.driftStep = driftStep;

  /* ------------------------------------------------------------ */
  /* Royal seals: The King and The Queen wake at their altars     */
  /* ------------------------------------------------------------ */
  function wakeRoyal(w, x, y, z, queen, game) {
    if (w.getBlock(x, y, z) === B.royal_seal) w.setBlock(x, y, z, 0, 0, 3);
    const type = queen ? 'the_queen' : 'the_king';
    if (!MOBS[type]) return;
    const m = E.spawnMob(w, type, x + 0.5, Math.min(CH - 8, y + 12), z + 0.5);
    if (!m) return;
    m.persistent = true; m.keep = true; m.home = [x + 0.5, Math.min(CH - 10, y + 14), z + 0.5];
    if (DL.Extras && DL.Extras.strike && game) DL.Extras.strike(game, x, y + 1, z, true);
    if (w.fx) { w.fx.sound('king_roar', x + 0.5, y + 10, z + 0.5, 3, queen ? 1.15 : 0.9); w.fx.particles('explosion', x + 0.5, y + 6, z + 0.5, 12, 4); }
    if (game) game.chatMessage('§5' + (queen ? 'The Queen' : 'The King') + ' awakens to guard the altar!');
    if (X && X.grant) X.grant('os_royal');
  }
  OD.wakeRoyal = wakeRoyal;

  const afterPlace = GP.afterPlace;
  GP.afterPlace = function (bid, x, y, z) {
    const r = afterPlace.apply(this, arguments);
    const w = this.world;
    if (w && !isGuest() && !w.remote) {
      if (bid === B.island_block) (w._osTimers || (w._osTimers = [])).push({ t: 40, kind: 'island', x, y, z });
      if (bid === B.royal_seal) { (w._osTimers || (w._osTimers = [])).push({ t: 100, kind: 'seal', x, y, z }); this.chatMessage('§5The seal hums... something royal is coming.'); }
    }
    return r;
  };

  const tick2 = GP.tick;
  GP.tick = function () {
    tick2.apply(this, arguments);
    const w = this.world, p = this.player;
    if (!w || !p || !this.inGame || isGuest() || w.remote) return;
    if (G.screen && G.screen.pauses && !(N && N.active && N.active())) return;
    // things placed by hand: island blocks rise, seals wake
    if (w._osTimers && w._osTimers.length) {
      for (const t of w._osTimers) {
        if (--t.t > 0) continue;
        if (t.kind === 'island' && w.getBlock(t.x, t.y, t.z) === B.island_block) launchIsland(w, t.x, t.y, t.z);
        if (t.kind === 'seal' && w.getBlock(t.x, t.y, t.z) === B.royal_seal) wakeRoyal(w, t.x, t.y, t.z, w.getMeta(t.x, t.y, t.z) & 1, this);
      }
      w._osTimers = w._osTimers.filter(t => t.t > 0);
    }
    const dim = w.dim || 0;
    // the Islands: island blocks on the meadow rise when someone comes near
    if (dim === ISLANDS && this.tickCount % 40 === 0) {
      const px = Math.floor(p.x), pz = Math.floor(p.z);
      for (let dx = -28; dx <= 28; dx++) for (let dz = -28; dz <= 28; dz++) {
        const x = px + dx, z = pz + dz;
        if (!w.isReady(x, z)) continue;
        for (let y = 6; y <= 13; y++) if (w.getBlock(x, y, z) === B.island_block && w.getBlock(x, y - 1, z) !== 0) { launchIsland(w, x, y, z, true); dx = dz = 99; break; }
      }
    }
    // drifting islands near anyone
    if (this.tickCount % 5 === 0) {
      const list = islandList(w);
      for (let i = list.length - 1; i >= 0; i--) {
        const isl = list[i];
        if (Math.abs(isl.x - p.x) > 96 || Math.abs(isl.z - p.z) > 96 || !w.isReady(isl.x - 16, isl.z - 16) || !w.isReady(isl.x + 16, isl.z + 16)) continue;
        let ok = true;
        try { ok = driftStep(w, isl, this); } catch (e) { console.warn('island', e); }
        if (!ok) list.splice(i, 1);
        if (ok === 'moved') break; // one island at a time keeps the frame rate smooth
      }
    }
    // royal altars in Utopia
    if (dim === UTOPIA && this.tickCount % 20 === 0) {
      let plans = [];
      try { plans = St.plansFor(w, Math.floor(p.x) >> 4, Math.floor(p.z) >> 4); } catch (e) { plans = []; }
      for (const pl of plans) {
        if (!pl.seal) continue;
        const [sx, sy, sz, q] = pl.seal;
        if (Math.hypot(p.x - sx, p.z - sz) < 18 && Math.abs(p.y - sy) < 24 && w.getBlock(sx, sy, sz) === B.royal_seal && !p.creative) wakeRoyal(w, sx, sy, sz, q, this);
      }
    }
  };

  /* ------------------------------------------------------------ */
  /* Who lives where                                              */
  /* ------------------------------------------------------------ */
  // OreSpawn's cows: the red one drops apples, the gold one golden apples, the enchanted one
  // more of them, and the Crystal Dimension's cow crystal apples
  const COWS = [
    ['red_cow', '#b02018', '#f0c8b8', (l) => [Math.min(255, 70 + l * 1.2), l * 0.22, l * 0.18], [[260, 3]]],
    ['gold_cow', '#d8a020', '#fff0a0', (l) => [Math.min(255, 90 + l * 1.1), Math.min(255, 60 + l * 0.85), l * 0.25], [[322, 1, 0.6], [371, 4]]],
    ['enchanted_cow', '#8040d0', '#ff80ff', (l) => [Math.min(255, 60 + l * 0.9), l * 0.45, Math.min(255, 90 + l * 1.1)], [[322, 2]]],
    ['crystal_cow', '#60c0f0', '#e0b0ff', (l) => [Math.min(255, 80 + l * 0.6), Math.min(255, 110 + l * 0.55), Math.min(255, 150 + l * 0.45)], [['crystal_apple', 2], ['crystal_shards', 3]]]
  ];
  if (MOBS.cow) for (const [n, c1, c2, tint, dr] of COWS) {
    if (MOBS[n]) continue;
    OSM.add(n, Object.assign({}, MOBS.cow, { model: MOBS.cow.model || 'cow', skin: n, drops: OSM.drops(...dr), orespawn: true }), [c1, c2]);
    if (M && M.skinPainters) M.skinPainters[n] = () => {
      const src = M.skins.cow, c = Tex.makeCanvas(src.width, src.height), ctx = c.getContext('2d');
      ctx.drawImage(src, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 10) continue;
        const l = (d[i] + d[i + 1] + d[i + 2]) / 3, t = tint(l);
        if (l > 175) { d[i] = Math.min(255, t[0] * 0.5 + 128); d[i + 1] = Math.min(255, t[1] * 0.5 + 128); d[i + 2] = Math.min(255, t[2] * 0.5 + 128); }
        else { d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2]; }
        // sparkles on the magical ones
        if ((n === 'enchanted_cow' || n === 'crystal_cow') && ((i >> 2) * 2654435761 >>> 0) % 37 === 0) { d[i] = d[i + 1] = d[i + 2] = 255; }
      }
      ctx.putImageData(img, 0, 0);
      return c;
    };
  }
  const SPAWN = {
    5: { day: [['butterfly', 20], ['moth', 3], ['gazelle', 10], ['red_cow', 10], ['gold_cow', 4], ['enchanted_cow', 2], ['chipmunk', 3], ['cockateil', 10], ['girlfriend', 2], ['boyfriend', 2], ['peacock', 3], ['cow', 6], ['pig', 6], ['sheep', 6], ['chicken', 6], ['horse', 2], ['easter_bunny', 1]],
      night: [['moth', 10], ['os_firefly', 15], ['butterfly', 2]], water: [['gold_fish', 6], ['whale', 1], ['flounder', 2]], hostile: null },
    6: { day: [['cliff_racer', 4], ['cockateil', 3], ['dragonfly', 2], ['lizard', 3], ['chipmunk', 2], ['gazelle', 2]], night: [['moth', 4], ['mosquito', 3]], water: [['gold_fish', 4], ['flounder', 2]],
      hostile: [['alosaurus', 8], ['trex', 6], ['nastysaurus', 6], ['pointysaurus', 10], ['alien', 25], ['cave_fisher', 25], ['cryolophosaurus', 20], ['spyro', 5], ['velocity_raptor', 2], ['camarasaurus', 1], ['baryonyx', 2], ['zombie', 15], ['skeleton', 15], ['creeper', 12], ['spider', 12]] },
    7: { day: [['butterfly', 8], ['cockateil', 4], ['chipmunk', 4], ['cow', 8], ['pig', 8], ['sheep', 8], ['chicken', 8], ['horse', 3], ['gazelle', 2], ['easter_bunny', 1]], night: [['moth', 6], ['os_firefly', 6], ['mosquito', 2]], water: [['gold_fish', 5], ['flounder', 3], ['rubber_ducky', 1]],
      hostile: [['zombie', 20], ['skeleton', 20], ['creeper', 20], ['spider', 20], ['rat', 4], ['alien', 1]] },
    8: { day: [['butterfly', 10], ['cockateil', 8], ['moth', 3], ['dragon', 1], ['cliff_racer', 12], ['cloud_shark', 1], ['cow', 4], ['sheep', 4], ['gazelle', 3]], night: [['moth', 8], ['os_firefly', 10]], water: [['gold_fish', 5]],
      hostile: [['creeping_horror', 60], ['terrible_terror', 25]] },
    9: { day: [['crystal_cow', 3], ['fairy', 10], ['peacock', 5], ['mantis', 1], ['butterfly', 8], ['cockateil', 4]], night: [['fairy', 6], ['butterfly', 3]], water: [['irukandji', 3], ['flounder', 2], ['skate', 2]],
      hostile: [['rotator', 4], ['urchin', 15], ['dungeon_beast', 25], ['rat', 40], ['vortex', 0.4]] },
    10: { day: [['butterfly', 20], ['moth', 10], ['cockateil', 10], ['os_firefly', 15], ['cliff_racer', 20], ['cloud_shark', 2], ['fairy', 5], ['baryonyx', 2]], night: null, water: [['gold_fish', 10]],
      hostile: [['lurking_terror', 20], ['terrible_terror', 12], ['creeping_horror', 12], ['pitch_black', 0.3]] }
  };
  OD.SPAWN = SPAWN;
  function pickMob(list) {
    let tot = 0;
    for (const e of list) if (MOBS[e[0]]) tot += e[1];
    let v = rnd() * tot;
    for (const e of list) { if (!MOBS[e[0]]) continue; v -= e[1]; if (v < 0) return e[0]; }
    return null;
  }
  function osDimSpawn(world, player) {
    if (isGuest() || !player || player.health <= 0 || world.totalTicks % 20 !== 0) return;
    const dim = world.dim || 0, T0 = SPAWN[dim];
    if (!T0) return;
    let host = 0, peace = 0, bosses = 0;
    for (const e of world.entities) if (e.living && !e.isPlayer && !e.removed && !e.tamed && e.def) { if (e.def.boss) bosses++; else if (e.hostile) host++; else peace++; }
    const day = dim === CHAOS ? true : world.isDaytime();
    for (let tries = 0; tries < 2; tries++) {
      const a = rnd() * Math.PI * 2, rr = 24 + rnd() * 36;
      const x = Math.floor(player.x + Math.cos(a) * rr), z = Math.floor(player.z + Math.sin(a) * rr);
      if (!world.isReady(x, z)) continue;
      let y = dim === CHAOS ? floorBelow(world, x, Math.min(118, Math.floor(player.y) + 16 - Math.floor(rnd() * 32)), z, 4) : world.topSolidY(x, z);
      if (y < 2) continue;
      const below = world.getBlock(x, y - 1, z), inWater = below === B.water || world.getBlock(x, y, z) === B.water;
      let list, hostile = false;
      if (inWater) list = T0.water;
      else if (T0.hostile && world.difficulty > 0 && rnd() < (day && dim !== CHAOS && dim !== CRYSTAL ? 0.15 : 0.6)) { list = T0.hostile; hostile = true; }
      else list = day ? T0.day : (T0.night || T0.day);
      if (!list) continue;
      const type = pickMob(list), def = type && MOBS[type];
      if (!def) continue;
      if (def.boss && (bosses > 0 || world.difficulty === 0)) continue;
      if (hostile || def.hostile ? host >= 22 : peace >= 22) continue;
      if (def.water) { if (!inWater) continue; y -= 2; if (world.getBlock(x, y, z) !== B.water) continue; }
      else if (inWater) continue;
      // ground monsters want the dark; fliers want room
      if ((hostile || def.hostile) && !def.fly && !E.canMonsterSpawn(world, x, y, z, type)) continue;
      if (def.fly && !def.water) y += 2 + Math.floor(rnd() * 5);
      const n = /ant$|butterfly|moth|firefly|chipmunk|gold_fish|rat|cockateil|fairy/.test(type) ? 1 + Math.floor(rnd() * 3) : 1;
      for (let k = 0; k < n; k++) {
        const m = E.spawnMob(world, type, x + 0.5 + (rnd() - 0.5) * 3, y, z + 0.5 + (rnd() - 0.5) * 3);
        if (m) m.persistent = !!def.boss;
      }
      break;
    }
  }
  const naturalSpawn = E.naturalSpawn;
  E.naturalSpawn = function (world, player) {
    if (!isOS(world.dim || 0)) return naturalSpawn.apply(this, arguments);
    osDimSpawn(world, player);
  };
  // Utopia is at peace
  const canMonsterSpawn = E.canMonsterSpawn;
  E.canMonsterSpawn = function (w) { if ((w.dim || 0) === UTOPIA) return false; return canMonsterSpawn.apply(this, arguments); };
})();
