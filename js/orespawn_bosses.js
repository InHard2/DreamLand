/*
 * DreamLand - OreSpawn's giants, after the classic mod: The King (three heads,
 * fire, ice and lightning), The Queen, Mobzilla, the Kraken, Mothra, Robo-Jeffery,
 * the CaterKiller, the Vortex, the Sea Viper and Pitch Black (the Nightmare), plus
 * The Prince, a dragon you raise from an egg and ride. Every model, skin and sound
 * is made here in code. Their drops finish OreSpawn's best gear (Big Bertha, the
 * Royal Guardian sword and armour).
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, E = DL.Entities, I = DL.Items, M = DL.Models, A = DL.Audio, N = DL.Net, X = DL.Extras;
  const OS = DL.OreSpawn, OSM = OS && OS.mobs;
  if (!OSM) return;
  const MOBS = E.MOBS, D = M.defs, hex = M.hex, AN = M.anims, SP = M.skinPainters, AI = E.AI;
  const { P, chain, paint, add, hurt, players } = OSM;
  const SOLID = S.SOLID, BI = S.BIOME;
  const rnd = Math.random;
  const isGuest = () => !!(N && N.client);
  const id = (n) => (I.byName[n] ? I.byName[n].id : 0);
  const drops = (...list) => list.map(([n, max, ch]) => [typeof n === 'number' ? n : id(n), max || 1, ch]).filter(d => d[0] > 0);
  const snd = (m, k, v, p) => { if (m.world.fx) m.world.fx.sound(k, m.x, m.y + m.h * 0.6, m.z, v || 1, p || 1); };
  const fxAt = (w, k, x, y, z, n, s) => { if (w.fx) w.fx.particles(k, x, y, z, n, s || 0.5); };
  const EY = (c) => ({ W: hex('#ffffff'), K: hex('#101010'), R: hex('#ff2020'), Y: hex('#ffe030'), G: hex('#40ff60'), C: hex('#60e8ff'), P: hex('#e040ff'), E: hex(c || '#ff2020') });
  const sizeOf = (m) => m.scale || m.def.scale || 1;

  /** World position of a point of the model (model pixels, y down, front is -z). */
  function at(m, mx, my, mz) {
    const k = sizeOf(m) / 16, yaw = m.bodyYaw !== undefined ? m.bodyYaw : m.yaw, c = Math.cos(yaw), s = Math.sin(yaw);
    return [m.x + (mx * c + mz * s) * k, m.y + (24 - my) * k, m.z + (-mx * s + mz * c) * k];
  }

  /* ------------------------------------------------------------ */
  /* Projectiles that come out of a mouth, an eye or a claw       */
  /* ------------------------------------------------------------ */
  function launch(m, from, t, o) {
    const w = m.world, kind = o.kind || 'os_boss';
    const b = new E.Magic(w, from[0], from[1], from[2], m, kind);
    if (o.icon) b.icon = o.icon;
    if (o.size) b.size = o.size;
    b.noSave = true;
    if (o.gravity !== undefined) b.gravity = o.gravity;
    const base = b.hitEntity, baseBlock = b.hitBlock;
    // a giant's own body is in the way of its shots: let them pass through
    b.hitEntity = function (e) {
      if (e === m || (e.def && e.def.osBoss && e.type === m.type) || (m.tamed && e === m.owner)) { this.x += this.vx; this.y += this.vy; this.z += this.vz; return; }
      if (o.hit) { o.hit(e, this); this.removed = true; return; }
      base.call(this, e);
    };
    b.hitBlock = function (hit) {
      if (o.block) { o.block(this, hit); this.removed = true; return; }
      baseBlock.call(this, hit);
    };
    if (o.trail) { const tick = b.tick; b.tick = function () { tick.call(this); if (this.age % 2 === 0) fxAt(w, o.trail, this.x, this.y, this.z, 1, 0.1); }; }
    const ty = t.y + (t.h || 1) * 0.5;
    b.shoot(t.x - from[0], ty - from[1], t.z - from[2], o.speed || 1, o.spread === undefined ? 2 : o.spread);
    w.entities.push(b);
    return b;
  }
  const fireball = (m, from, t, big) => launch(m, from, t, { kind: big ? 'fireball' : 'small_fireball', speed: big ? 1.1 : 1.3, spread: big ? 1 : 4 });
  const iceball = (m, from, t) => launch(m, from, t, {
    icon: id('ice_ball'), size: 0.6, speed: 1.2, trail: 'snowball',
    hit: (e, b) => { e.damage('magic', 5, m); if (e.addEffect) e.addEffect('slowness', 120); e.fire = 0; fxAt(m.world, 'snowball', b.x, b.y, b.z, 12, 0.6); },
    block: (b, hit) => { freeze(m.world, Math.floor(b.x), Math.floor(b.y), Math.floor(b.z)); fxAt(m.world, 'snowball', b.x, b.y, b.z, 12, 0.6); }
  });
  const laser = (m, from, t, dmg, blast) => launch(m, from, t, {
    icon: id('ruby'), size: 0.4, speed: 2, spread: 1, trail: 'crit',
    hit: (e, b) => { e.damage('magic', dmg, m); e.fire = Math.max(e.fire || 0, 40); if (blast) boom(m.world, b.x, b.y, b.z, m); },
    block: (b) => { if (blast) boom(m.world, b.x, b.y, b.z, m); else fxAt(m.world, 'smoke', b.x, b.y, b.z, 6, 0.3); }
  });
  // a burst that hurts and throws, but leaves the ground alone
  function boom(w, x, y, z, src, r) {
    r = r || 2.5;
    fxAt(w, 'explosion', x, y, z, 4, r * 0.5);
    if (w.fx) w.fx.sound('explode', x, y, z, 1.2, 1.3);
    for (const e of w.entities) {
      if (!e.living || e === src || e.health <= 0 || (e.def && e.def.osBoss)) continue;
      const d = Math.sqrt(e.dist2(x, y, z));
      if (d > r * 1.5) continue;
      e.damage('explosion', Math.max(1, Math.round(6 * (1 - d / (r * 1.5)))), src);
      const k = 0.5 / (d + 0.5); e.vx += (e.x - x) * k; e.vz += (e.z - z) * k; e.vy += 0.3;
    }
  }
  function freeze(w, x, y, z) {
    if (isGuest()) return;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 1; dy++) {
      if (dx * dx + dz * dz + dy * dy > 5) continue;
      const b = w.getBlock(x + dx, y + dy, z + dz);
      if (b === B.water) w.setBlock(x + dx, y + dy, z + dz, B.ice, 0, 3);
      else if (b === B.fire || b === B.lava && rnd() < 0.5) w.setBlock(x + dx, y + dy, z + dz, b === B.lava ? B.obsidian : 0, 0, 3);
      else if (b === 0 && SOLID[w.getBlock(x + dx, y + dy - 1, z + dz)] && B.snow_layer && rnd() < 0.6) w.setBlock(x + dx, y + dy, z + dz, B.snow_layer, 0, 3);
    }
  }
  // lightning from a clear (or stormy) sky on a target
  function lightning(m, x, z, dmg) {
    const w = m.world, g = DL.game;
    if (isGuest() || !g || g.world !== w) return;
    const y = w.topSolidY(Math.floor(x), Math.floor(z));
    if (X && X.strike) X.strike(g, Math.floor(x), y, Math.floor(z));
    for (const e of w.entities) if (e.living && e !== m && !(e.def && e.def.osBoss) && e.health > 0 && (e.x - x) ** 2 + (e.z - z) ** 2 < 6 && Math.abs(e.y - y) < 5) { e.damage('lightning', dmg || 4, m); e.fire = Math.max(e.fire || 0, 100); }
  }
  // giants walk through forests and houses
  const TOUGH = new Set([B.bedrock, B.obsidian, B.chest, B.furnace, B.lit_furnace, B.mob_spawner, B.portal, B.end_portal, B.end_portal_frame, B.water, B.lava].filter(v => v !== undefined));
  function smash(m, ahead, half, height, maxN, only) {
    if (isGuest()) return 0;
    const w = m.world, yaw = m.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let n = 0;
    for (let dy = 1; dy <= height && n < maxN; dy++) for (let s = -half; s <= half && n < maxN; s++) for (let a = 0; a <= 1 && n < maxN; a++) {
      const x = Math.floor(m.x + fx * (ahead + a) + rx * s), z = Math.floor(m.z + fz * (ahead + a) + rz * s), y = Math.floor(m.y) + dy;
      const b = w.getBlock(x, y, z);
      if (!b || TOUGH.has(b) || w.getTile(x, y, z)) continue;
      const bd = S.blocks[b];
      if (!bd || bd.hardness < 0 || bd.hardness > 3) continue;
      if (only && !only(b)) continue;
      w.destroyBlock(x, y, z, rnd() < 0.15);
      n++;
    }
    return n;
  }
  const isWoody = (b) => !!(S.LEAVES && S.LEAVES[b]) || !!(S.LOGS && S.LOGS[b]) || b === B.vine || b === B.leaves;
  // royalty: The King and The Queen leave alone whoever wears the whole Royal Guardian set
  const royal = (p) => OS.setOf && OS.setOf(p) === 'royal';
  function bossTarget(range, spareRoyals) {
    return (m) => {
      if (m.tamed) { const o = m.owner, t = o && o.lastAttacked; return t && !t.removed && t.health > 0 && t !== m && o.age - (o.lastAttackAge || 0) < 200 ? t : null; }
      if (m.world.difficulty === 0) return null;
      let best = null, bd = range * range;
      for (const p of players(m.world)) {
        if (spareRoyals && royal(p)) continue;
        const d = m.dist2(p.x, p.y, p.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best && m.provokedBy && !m.provokedBy.removed && m.provokedBy.health > 0) best = m.provokedBy;
      return best;
    };
  }
  const shake = (m, k, r) => { const g = DL.game, p = g && g.player; if (p && p.world === m.world && m.distTo(p) < (r || 24)) { g.shake = Math.max(g.shake || 0, k); if (DL.Input) DL.Input.haptic('land'); } };

  /* ============================================================ */
  /* Models                                                       */
  /* ============================================================ */
  /** The royal dragons: a winged body with one or three long necks, legs and a spiked tail. */
  function royalRig(name, heads, o) {
    o = o || {};
    const parts = {
      body: P([0, 4, 0], [[-8, -6, -12, 16, 12, 24], [-6, 5, -10, 12, 3, 14]].concat([0, 1, 2, 3, 4, 5].map(i => [-1, -9, -10 + i * 4, 2, 3, 3]))
        .concat(o.ribs ? [0, 1, 2, 3].map(i => [-8.5, -4, -8 + i * 5, 17, 9, 1.5]) : []).concat(o.cubes ? [[-2, -12, -4, 4, 4, 4], [-2, -12, 4, 4, 4, 4]] : []))
    };
    const NX = heads === 1 ? [0] : [-6, 0, 6];
    NX.forEach((nx, i) => {
      const k = heads === 1 ? 'C' : 'LCR'[i], base = [nx, -2 - (nx === 0 ? 1 : 0), -12];
      for (let s = 0; s < 3; s++) parts['n' + k + s] = P([base[0], base[1], base[2] - 6 * s], [[-2.5 + s * 0.25, -2.5 + s * 0.25, -6.5, 5 - s * 0.5, 5 - s * 0.5, 7]].concat(s === 1 ? [[-0.5, -4.5, -5, 1, 2.5, 3]] : []));
      const hp = [base[0], base[1], base[2] - 18];
      parts['h' + k] = P(hp, [[-3.5, -3.5, -7, 7, 6, 7], [-2.5, -2, -11, 5, 3, 4], [-3, -6.5, -3, 1, 3.5, 1.5], [2, -6.5, -3, 1, 3.5, 1.5], [-4, -5, -1, 8, 2, 4],
        [-2, -3, -11.5, 1, 1, 1], [1, -3, -11.5, 1, 1, 1]]);
      parts['j' + k] = P(hp, [[-2.5, 1.5, -10.5, 5, 1.5, 10], [-2.2, 0.8, -10.2, 0.6, 1, 0.6], [1.6, 0.8, -10.2, 0.6, 1, 0.6], [-2.2, 0.8, -7.5, 0.6, 1, 0.6], [1.6, 0.8, -7.5, 0.6, 1, 0.6]]);
    });
    parts.rw0 = P([-8, -5, -6], [[-18, 0, 0, 18, 1, 16], [-18, -1, -1, 18, 2, 2]]);
    parts.rw1 = P([-26, -5, -6], [[-22, 0, 0, 22, 0.6, 14], [-22, -0.5, -0.5, 22, 1.5, 1.5], [-22, 0, 0, 1, 1, 18]]);
    parts.lw0 = P([8, -5, -6], [[0, 0, 0, 18, 1, 16], [0, -1, -1, 18, 2, 2]]);
    parts.lw1 = P([26, -5, -6], [[0, 0, 0, 22, 0.6, 14], [0, -0.5, -0.5, 22, 1.5, 1.5], [21, 0, 0, 1, 1, 18]]);
    for (let s = 0; s < 6; s++) {
      const wd = 6 - s * 0.8;
      parts['t' + s] = P([0, 0, 12 + 7 * s], [[-wd / 2, -wd / 2, -0.5, wd, wd, 7.5], [-0.5, -wd / 2 - 2, 2, 1, 2, 3]].concat(s === 5 ? [[-4, -0.5, 5, 8, 1, 6], [-1, -0.5, 10, 2, 1, 3]] : []));
    }
    for (const [sd, x] of [['r', -5], ['l', 5]]) parts[sd + 'leg'] = P([x, 8, 4], [[-2.5, 0, -3, 5, 8, 6], [-2, 7, -2, 4, 7, 4], [-3, 13, -5, 6, 2, 8], [-3, 14, -7, 1, 1, 2], [-0.5, 14, -7, 1, 1, 2], [2, 14, -7, 1, 1, 2]]);
    D[name] = { anim: 'os_royal', shadow: 0, noCull: true, parts, os: { heads: NX.map((nx, i) => (heads === 1 ? 'C' : 'LCR'[i])), bases: NX.map((nx) => [nx, -2 - (nx === 0 ? 1 : 0), -12]) } };
  }
  royalRig('os_royal3', 3, {});
  royalRig('os_royal3q', 3, { ribs: true, cubes: true });
  royalRig('os_royal1', 1, {});
  AN.os_royal = ({ name, e, o, limb, amt, headYaw, headPitch, age }) => {
    const md = D[e && e.def && e.def.model || name] || D[name], g = md.os;
    const grounded = e && e.onGround;
    const t = age * (grounded ? 0.05 : 0.11) + (e ? (e.id || 0) : 0);
    const flap = grounded ? 0.08 : (e && e.gliding ? 0.12 : 0.62);
    const a = Math.sin(t) * flap, bob = grounded ? 0 : Math.cos(t) * 1.6;
    const dive = e && e.phase === 'swoop' ? 0.35 : e && e.phase === 'climb' ? -0.25 : 0;
    o.body = [dive, 0, 0, 0, bob, 0];
    const fold = grounded ? 0.9 : 0;
    chain(o, [-8, -5 + bob, -6], [{ n: 'rw0', p: md.parts.rw0.pivot, v: [-18, 0, 0] }, { n: 'rw1', p: md.parts.rw1.pivot, v: [-22, 0, 0] }], [[0, fold * 0.8, 0.1 + a], [0, fold, Math.sin(t - 0.7) * flap * 0.6]]);
    chain(o, [8, -5 + bob, -6], [{ n: 'lw0', p: md.parts.lw0.pivot, v: [18, 0, 0] }, { n: 'lw1', p: md.parts.lw1.pivot, v: [22, 0, 0] }], [[0, -fold * 0.8, -0.1 - a], [0, -fold, -Math.sin(t - 0.7) * flap * 0.6]]);
    const breath = e && e.breath ? e.breath : null;
    g.heads.forEach((k, i) => {
      const side = g.heads.length === 1 ? 0 : i - 1;
      const sway = Math.sin(age * 0.045 + i * 2.1) * 0.18, yaw = side * 0.6 + headYaw * 0.55 + sway;
      const segs = [0, 1, 2].map(s => ({ n: 'n' + k + s, p: md.parts['n' + k + s].pivot, v: [0, 0, -6] }));
      const b = g.bases[i];
      const end = chain(o, [b[0], b[1] + bob, b[2]], segs, [[-0.55 + headPitch * 0.15 - dive * 0.5, yaw * 0.5, 0], [0.12, yaw * 0.3, 0], [0.3 + headPitch * 0.15, yaw * 0.2, 0]]);
      const hp = md.parts['h' + k].pivot;
      const open = Math.max(e && e.attackAnim > 0 ? e.attackAnim / 10 : 0, breath && breath[i] > 0 ? 0.8 : 0, e && e.roar > 0 ? Math.sin(Math.min(1, e.roar / 20) * Math.PI) : 0);
      o['h' + k] = [0.05 + headPitch * 0.5 - open * 0.25, yaw * 1.0, 0, end[0] - hp[0], end[1] - hp[1], end[2] - hp[2]];
      o['j' + k] = [o['h' + k][0] + 0.12 + open * 0.75, o['h' + k][1], 0, o['h' + k][3], o['h' + k][4], o['h' + k][5]];
    });
    const sw = Math.sin(age * 0.07) * 0.15 + (e && e.yawRate ? e.yawRate * 2 : 0);
    chain(o, [0, bob, 12], [0, 1, 2, 3, 4, 5].map(s => ({ n: 't' + s, p: md.parts['t' + s].pivot, v: [0, 0, 7] })), [[-0.08 - dive * 0.3, sw, 0], [0.05, sw, 0], [0.05, sw, 0], [0.04, sw * 1.2, 0], [0.04, sw * 1.2, 0], [0.02, sw, 0]]);
    const step = grounded ? Math.cos(limb * 0.35) * 0.6 * amt : 0;
    o.rleg = [grounded ? step : 0.9, 0, 0, 0, bob, 0]; o.lleg = [grounded ? -step : 0.9, 0, 0, 0, bob, 0];
    return o;
  };

  /** Mobzilla: an upright saurian with three rows of glowing dorsal plates. */
  (function () {
    const plates = (z, ys) => ys.map(([y, h]) => [-0.75, y, z, 1.5, h, 3]).concat(ys.map(([y, h]) => [-3, y + 1, z - 0.5, 1, h - 1.5, 2.5])).concat(ys.map(([y, h]) => [2, y + 1, z - 0.5, 1, h - 1.5, 2.5]));
    const parts = {
      body: P([0, 12, 0], [[-6, -17, -4, 12, 17, 9], [-5, -12, -5.5, 10, 11, 2]].concat(plates(4.5, [[-17, 5], [-12, 5], [-7, 4], [-3, 3]]))),
      head: P([0, -4, -1], [[-3.5, -6, -7, 7, 6, 8], [-2.5, -3.5, -11.5, 5, 3.5, 5], [-2.8, -6.8, -4, 1.2, 1.2, 1.2], [1.6, -6.8, -4, 1.2, 1.2, 1.2]]),
      jaw: P([0, -4, -1], [[-2.5, 0, -11, 5, 2, 10], [-2.2, -0.8, -10.8, 0.6, 1, 0.6], [1.6, -0.8, -10.8, 0.6, 1, 0.6], [-2.2, -0.8, -8, 0.6, 1, 0.6], [1.6, -0.8, -8, 0.6, 1, 0.6]]),
      rarm: P([-6, -9, -2], [[-2.5, -1, -1.5, 3, 7, 3], [-2.5, 5, -3, 3, 3, 3], [-2.6, 7.5, -3.5, 0.8, 1.5, 0.8], [-1, 7.5, -3.5, 0.8, 1.5, 0.8]]),
      larm: P([6, -9, -2], [[-0.5, -1, -1.5, 3, 7, 3], [-0.5, 5, -3, 3, 3, 3], [-0.4, 7.5, -3.5, 0.8, 1.5, 0.8], [1.2, 7.5, -3.5, 0.8, 1.5, 0.8]]),
      rleg: P([-4.5, 11, 1], [[-3, -1, -3, 6, 7, 6], [-2.5, 6, -2, 5, 6, 5], [-3, 12, -5, 6, 1, 8], [-3, 12, -6, 1, 1, 1.5], [-0.5, 12, -6, 1, 1, 1.5], [2, 12, -6, 1, 1, 1.5]]),
      lleg: P([4.5, 11, 1], [[-3, -1, -3, 6, 7, 6], [-2.5, 6, -2, 5, 6, 5], [-3, 12, -5, 6, 1, 8], [-3, 12, -6, 1, 1, 1.5], [-0.5, 12, -6, 1, 1, 1.5], [2, 12, -6, 1, 1, 1.5]])
    };
    for (let s = 0; s < 6; s++) {
      const wd = 7 - s * 1.05;
      parts['t' + s] = P([0, 8, 4 + 7 * s], [[-wd / 2, -wd / 2, -0.5, wd, wd, 7.5], [-0.6, -wd / 2 - 2.6, 1.5, 1.2, 2.6, 3]]);
    }
    D.os_mobzilla = { anim: 'os_mobzilla', shadow: 0.9, noCull: true, parts };
  })();
  AN.os_mobzilla = ({ e, o, limb, amt, headYaw, headPitch, age }) => {
    const st = Math.cos(limb * 0.32) * 0.42 * amt, bob = Math.abs(Math.sin(limb * 0.32)) * amt * 1.2;
    const charge = e && e.charge > 0 ? Math.min(1, e.charge / 30) : 0, roar = e && e.roar > 0 ? Math.sin(Math.min(1, e.roar / 30) * Math.PI) : 0;
    const bite = e && e.attackAnim > 0 ? e.attackAnim / 10 : 0;
    o.body = [0.08 + Math.sin(limb * 0.16) * 0.03 * amt - roar * 0.12, Math.sin(limb * 0.16) * 0.05 * amt, 0, 0, bob, 0];
    o.head = [headPitch * 0.5 - roar * 0.5 - charge * 0.2, headYaw * 0.7, 0, 0, bob, 0];
    o.jaw = [o.head[0] + 0.1 + Math.max(roar, charge, bite) * 0.75, o.head[1], 0, 0, bob, 0];
    o.rarm = [-0.3 - bite * 1.2 + Math.sin(age * 0.07) * 0.08, 0, 0.15, 0, bob, 0]; o.larm = [-0.3 - bite * 0.6 - Math.sin(age * 0.07) * 0.08, 0, -0.15, 0, bob, 0];
    o.rleg = [st, 0, 0]; o.lleg = [-st, 0, 0];
    const sw = Math.sin(age * 0.05 + limb * 0.16) * 0.14;
    chain(o, [0, 8 + bob, 4], [0, 1, 2, 3, 4, 5].map(s => ({ n: 't' + s, p: D.os_mobzilla.parts['t' + s].pivot, v: [0, 0, 7] })), [[-0.42, sw, 0], [-0.22, sw, 0], [-0.1, sw, 0], [0.02, sw * 1.2, 0], [0.04, sw * 1.3, 0], [0.04, sw * 1.3, 0]]);
    return o;
  };

  /** The Kraken: a towering mantle, eight writhing arms and two long clubbed tentacles. */
  (function () {
    const parts = {
      body: P([0, 0, 0], [[-8, -26, -8, 16, 18, 16], [-6, -34, -6, 12, 8, 12], [-3.5, -38, -3.5, 7, 4, 7], [-15, -33, -1, 7, 12, 2], [8, -33, -1, 7, 12, 2]]),
      head: P([0, 0, 0], [[-7, -8, -7, 14, 8, 14], [-8.2, -6, -2, 1.5, 3, 3], [6.7, -6, -2, 1.5, 3, 3]])
    };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = i >= 8 ? 2.5 : 5, n = i >= 8 ? 6 : 4, x = Math.cos(a) * r, z = Math.sin(a) * r;
      for (let k = 0; k < n; k++) {
        const wd = Math.max(1.2, 3.4 - k * 0.5);
        parts['a' + i + '_' + k] = P([x, k * 6, z], [[-wd / 2, -0.5, -wd / 2, wd, 6.5, wd]].concat(k === n - 1 && i >= 8 ? [[-1.8, 3, -1.8, 3.6, 4, 3.6]] : []));
      }
    }
    D.os_kraken = { anim: 'os_kraken', shadow: 0, noCull: true, parts };
  })();
  AN.os_kraken = ({ e, o, age, headPitch }) => {
    const md = D.os_kraken, grab = e && e.attackAnim > 0 ? e.attackAnim / 10 : 0;
    const pulse = Math.sin(age * 0.08);
    o.body = [Math.sin(age * 0.03) * 0.06, 0, Math.cos(age * 0.025) * 0.06, 0, pulse * 0.8, 0];
    o.head = [0, 0, 0, 0, pulse * 0.8, 0];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, n = i >= 8 ? 6 : 4, r = i >= 8 ? 2.5 : 5;
      const segs = []; for (let k = 0; k < n; k++) segs.push({ n: 'a' + i + '_' + k, p: md.parts['a' + i + '_' + k].pivot, v: [0, 6, 0] });
      const out = (i >= 8 ? 0.35 : 0.65) + pulse * 0.12 + (i >= 8 ? grab * 0.9 : 0);
      const bends = segs.map((s, k) => {
        const w = Math.sin(age * 0.11 + i * 1.7 + k * 0.9) * 0.22;
        return [(k === 0 ? Math.sin(a) * out : -Math.sin(a) * 0.12) + w * Math.cos(a), 0, (k === 0 ? -Math.cos(a) * out : Math.cos(a) * 0.12) + w * Math.sin(a)];
      });
      chain(o, [Math.cos(a) * r, pulse * 0.8, Math.sin(a) * r], segs, bends);
    }
    return o;
  };

  /** Robo-Jeffery: a giant robot with cannon fists and a visor. */
  OSM.fam.humanoid('os_jeffery', {
    heavy: true, noCull: true,
    head: [[-5, -9, -5, 10, 9, 10], [-0.6, -14, -0.6, 1.2, 5, 1.2], [-1.5, -15.5, -1.5, 3, 2, 3], [-6, -6, -2, 1, 4, 4], [5, -6, -2, 1, 4, 4]],
    body: [[-8, 0, -4.5, 16, 13, 9], [-6, 1, -5.5, 12, 6, 1], [-3, 13, -3, 6, 3, 6], [-9, -1, -3, 3, 4, 6], [6, -1, -3, 3, 4, 6]],
    rarm: [[-5, -2, -3, 5, 6, 6], [-4.5, 4, -2.5, 4, 7, 5], [-5.5, 11, -3.5, 6, 5, 7], [-4, 14, -5.5, 3, 3, 2]],
    larm: [[0, -2, -3, 5, 6, 6], [0.5, 4, -2.5, 4, 7, 5], [-0.5, 11, -3.5, 6, 5, 7], [1, 14, -5.5, 3, 3, 2]],
    rleg: [[-3, 4, -3, 6, 7, 6], [-2.5, 10, -2.5, 5, 5, 5], [-3.5, 14, -5, 7, 2, 9]], lleg: [[-3, 4, -3, 6, 7, 6], [-2.5, 10, -2.5, 5, 5, 5], [-3.5, 14, -5, 7, 2, 9]]
  });
  // a robot's proportions: short legs under a big chest
  Object.assign(D.os_jeffery.parts.head, { pivot: [0, -5, 0] });
  Object.assign(D.os_jeffery.parts.body, { pivot: [0, -5, 0] });
  Object.assign(D.os_jeffery.parts.rarm, { pivot: [-9, -3, 0] });
  Object.assign(D.os_jeffery.parts.larm, { pivot: [9, -3, 0] });
  D.os_jeffery.parts.rleg = P([-4, 8, 0], [[-3, 0, -3, 6, 7, 6], [-2.5, 6, -2.5, 5, 9, 5], [-3.5, 14, -5, 7, 2, 9]]);
  D.os_jeffery.parts.lleg = P([4, 8, 0], [[-3, 0, -3, 6, 7, 6], [-2.5, 6, -2.5, 5, 9, 5], [-3.5, 14, -5, 7, 2, 9]]);

  /** The CaterKiller: a long armoured caterpillar with tusks that eats trees. */
  OSM.fam.serpent('os_caterkiller', {
    segments: 7, sw: 9, sl: 8, cy: 17, head: [11, 9, 9], wave: 0.18, shadow: 1.2,
    headExtra: [[-6, 0, -12, 2, 2, 5], [4, 0, -12, 2, 2, 5], [-6.5, -1, -14, 1.5, 1.5, 3], [5, -1, -14, 1.5, 1.5, 3], [-3.5, -6.5, -6, 2, 2, 2], [1.5, -6.5, -6, 2, 2, 2]],
    segExtra: (i, w) => [[-w / 2 - 1, w / 2 - 1, 2, 2, 5, 2], [w / 2 - 1, w / 2 - 1, 2, 2, 5, 2], [-w / 2, -w / 2 - 3, 3, 1.5, 3, 1.5], [w / 2 - 1.5, -w / 2 - 3, 3, 1.5, 3, 1.5], [-0.75, -w / 2 - 4, 2, 1.5, 4, 1.5]]
  });

  /** The Vortex: a funnel of spinning rings with an eye in the storm. */
  (function () {
    const parts = { eye: P([0, 0, 0], [[-2.5, -2.5, -2.5, 5, 5, 5]]) };
    for (let k = 0; k < 8; k++) {
      const y = 22 - k * 3.6, s = 2 + k * 1.6, t = 1.4;
      parts['r' + k] = P([0, y, 0], [[-s, -1, -s, 2 * s, 2, t], [-s, -1, s - t, 2 * s, 2, t], [-s, -1, -s + t, t, 2, 2 * s - 2 * t], [s - t, -1, -s + t, t, 2, 2 * s - 2 * t]]);
    }
    parts.eye.pivot = [0, 6, 0]; parts.eye.boxes = [[-2.5, -2.5, -2.5, 5, 5, 5]];
    D.os_vortex = { anim: 'os_vortex', shadow: 0.5, noCull: true, parts };
  })();
  AN.os_vortex = ({ o, age }) => {
    for (let k = 0; k < 8; k++) o['r' + k] = [Math.sin(age * 0.05 + k) * 0.05, age * (0.35 - k * 0.025) + k * 0.6, 0, Math.sin(age * 0.1 + k * 0.8) * (k * 0.35), 0, Math.cos(age * 0.1 + k * 0.8) * (k * 0.35)];
    o.eye = [age * 0.05, age * 0.13, 0, 0, Math.sin(age * 0.06) * 1.5, 0];
    return o;
  };

  /** Mothra: a huge moth with eyespots, and the Sea Viper: a frilled serpent. */
  OSM.fam.flyer('os_mothra', { body: [9, 9, 20], head: [8, 7, 6], wing: [22, 28], hind: [16, 20], antennae: 9, legs: 5, cy: 12, flap: 0.7, flapSpeed: 0.28, wthick: 0.6, shadow: 0,
    headExtra: [[-4.5, -2, -3, 1.5, 3, 3], [3, -2, -3, 1.5, 3, 3]] });
  OSM.fam.serpent('os_sea_viper', { segments: 9, sw: 5, sl: 6, cy: 20, head: [7, 5, 9], wave: 0.4,
    headExtra: [[-6, -4, -3, 2.5, 5, 0.5], [3.5, -4, -3, 2.5, 5, 0.5], [-0.5, -5, -6, 1, 2, 5]], segExtra: (i, w) => [[-0.4, -w / 2 - 2, 1, 0.8, 2, 4]] });
  for (const k of ['os_royal3', 'os_royal3q', 'os_royal1', 'os_mobzilla', 'os_kraken', 'os_jeffery', 'os_caterkiller', 'os_vortex', 'os_mothra', 'os_sea_viper']) if (M.newModels.indexOf(k) < 0) M.newModels.push(k);

  /* ============================================================ */
  /* Skins                                                        */
  /* ============================================================ */
  const scaleRows = (s, parts, dark, mid, light) => { for (const [pn, bis] of parts) for (const bi of bis) s.fill(pn, bi, 'top,left,right,front,back', (x, y) => { const row = y >> 1, sx = (x + (row % 2) * 2) % 4; return sx === 0 || y % 2 === 1 && s.r.next() < 0.3 ? hex(dark) : (s.r.next() < 0.15 ? hex(light) : null); }); };
  const eyesFront = (s, part, rows, pal) => s.art(part, 0, 'front', rows, pal);
  function royalSkin(model, seed, c) {
    return () => paint(model, seed, Object.assign({ _: [c.body, 0.1], belly: c.belly }, c.parts || {}), (s) => {
      const md = D[model];
      for (const k of md.os.heads) {
        eyesFront(s, 'h' + k, ['.......', '.......', '.EE.EE.', '.EK.KE.'], EY(c.eye));
        s.fill('h' + k, 2, 'all', () => hex(c.horn)); s.fill('h' + k, 3, 'all', () => hex(c.horn)); s.fill('h' + k, 4, 'all', () => hex(c.mane));
        for (let b = 1; b < 5; b++) s.fill('j' + k, b, 'all', () => hex('#f4f0e0'));
        s.fill('j' + k, 0, 'bottom', () => hex(c.belly));
      }
      for (const pn of ['rw0', 'rw1', 'lw0', 'lw1']) { s.fill(pn, 0, 'all', (x, y) => (s.r.next() < 0.08 ? hex(c.wingDark) : null)); s.fill(pn, 1, 'all', () => hex(c.bone)); }
      scaleRows(s, [['body', [0]], ['t0', [0]], ['t1', [0]], ['t2', [0]]], c.scaleDark, c.body, c.scaleLight);
      for (let i = 2; i < 8; i++) if (md.parts.body.boxes[i]) s.fill('body', i, 'all', () => hex(c.horn));
      if (c.extra) c.extra(s);
    });
  }
  SP.the_king = royalSkin('os_royal3', 3001, { body: '#b02818', belly: '#f0c860', eye: '#ffe030', horn: '#f4e8c0', mane: '#ffd040', bone: '#601008', wingDark: '#701808', scaleDark: '#701408', scaleLight: '#e05030', parts: { rw0: ['#d84a28', 0.08], rw1: ['#e86030', 0.08], lw0: ['#d84a28', 0.08], lw1: ['#e86030', 0.08] } });
  SP.the_queen = royalSkin('os_royal3q', 3002, { body: '#9a40c8', belly: '#f0a0e8', eye: '#60e8ff', horn: '#ffe0ff', mane: '#ff60c0', bone: '#401060', wingDark: '#6020a0', scaleDark: '#5a1880', scaleLight: '#e070e8', parts: { rw0: ['#c060e0', 0.08], rw1: ['#3070e0', 0.08], lw0: ['#c060e0', 0.08], lw1: ['#3070e0', 0.08] },
    extra: (s) => { s.fill('body', 2 + 6 + 4, 'all', () => hex('#60ffff')); s.fill('body', 2 + 6 + 5, 'all', () => hex('#60ffff')); } });
  SP.pitch_black = royalSkin('os_royal1', 3003, { body: '#16121a', belly: '#3a2a44', eye: '#ff2020', horn: '#8a8090', mane: '#5a1010', bone: '#050408', wingDark: '#2a0a10', scaleDark: '#050408', scaleLight: '#3a3044', parts: { rw0: ['#22182a', 0.08], rw1: ['#2a1a30', 0.08], lw0: ['#22182a', 0.08], lw1: ['#2a1a30', 0.08] } });
  SP.the_prince = royalSkin('os_royal3', 3004, { body: '#e0a020', belly: '#fff0b0', eye: '#40ff60', horn: '#ffffff', mane: '#ff8020', bone: '#8a5008', wingDark: '#b07010', scaleDark: '#a06010', scaleLight: '#ffd060', parts: { rw0: ['#f0c040', 0.08], rw1: ['#ffe080', 0.08], lw0: ['#f0c040', 0.08], lw1: ['#ffe080', 0.08] } });
  const mobzillaSkin = (glow) => () => paint('os_mobzilla', 3010 + (glow ? 1 : 0), { _: ['#3a4a36', 0.1], belly: '#6a6a50', jaw: '#4a4a3e' }, (s) => {
    scaleRows(s, [['body', [0]], ['head', [0, 1]], ['rleg', [0, 1]], ['lleg', [0, 1]], ['t0', [0]], ['t1', [0]], ['t2', [0]], ['t3', [0]]], '#1e2a1c', '#3a4a36', '#5a6a50');
    const pc = glow ? hex('#a0f0ff') : hex('#d8d8c8'), pd = glow ? hex('#40a0ff') : hex('#a0a090');
    for (let b = 2; b < D.os_mobzilla.parts.body.boxes.length; b++) s.fill('body', b, 'all', (x, y) => (y % 2 ? pd : pc));
    for (let t = 0; t < 6; t++) s.fill('t' + t, 1, 'all', (x, y) => (y % 2 ? pd : pc));
    eyesFront(s, 'head', ['.......', '.......', '.Y...Y.', '.......'], EY());
    s.fill('head', 2, 'all', () => hex('#ffe030')); s.fill('head', 3, 'all', () => hex('#ffe030'));
    for (let b = 1; b < 5; b++) s.fill('jaw', b, 'all', () => hex('#f4f0e0'));
    for (const a of ['rarm', 'larm']) { s.fill(a, 2, 'all', () => hex('#e8e0c8')); s.fill(a, 3, 'all', () => hex('#e8e0c8')); }
    for (const l of ['rleg', 'lleg']) for (let b = 3; b < 6; b++) s.fill(l, b, 'all', () => hex('#e8e0c8'));
  });
  SP.mobzilla = mobzillaSkin(false); SP.mobzilla_glow = mobzillaSkin(true);
  SP.kraken = () => paint('os_kraken', 3020, { _: ['#7a2a4a', 0.12], head: ['#8a3456', 0.1] }, (s) => {
    s.fill('head', 1, 'all', () => hex('#ffe030')); s.fill('head', 2, 'all', () => hex('#ffe030'));
    s.art('head', 1, 'left', ['...', '.K.', '...'], EY()); s.art('head', 2, 'right', ['...', '.K.', '...'], EY());
    for (let i = 0; i < 10; i++) for (let k = 0; k < (i >= 8 ? 6 : 4); k++) s.fill('a' + i + '_' + k, 0, 'front,back,left,right', (x, y) => (y % 3 === 1 && x % 2 === 0 ? hex('#f0b0c8') : null));
    s.fill('body', 0, 'all', (x, y) => (s.r.next() < 0.1 ? hex('#4a1028') : null));
  });
  SP.jeffery = () => paint('os_jeffery', 3030, { _: ['#9aa0aa', 0.04], 'body:1': '#3a7ad8', 'body:2': '#5a5a64', 'rarm:3': '#2a2a30', 'larm:3': '#2a2a30', 'head:2': '#ff3030' }, (s) => {
    s.art('head', 0, 'front', ['..........', '..........', '.EEEEEEEE.', '.EEEEEEEE.', '..........', '..........', '..k.k.k...'], { E: hex('#30e0ff'), k: hex('#202024') });
    s.fill('body', 0, 'front', (x, y, w, h) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? hex('#5a5a64') : (x + y) % 6 === 0 ? hex('#c8ccd4') : null));
    s.fill('body', 0, 'back', (x, y) => (y % 4 === 0 ? hex('#5a5a64') : null));
  });
  SP.caterkiller = () => paint('os_caterkiller', 3040, { _: ['#4a7a28', 0.1], jaw: '#2a3a18' }, (s) => {
    for (let i = 0; i < 7; i++) { s.fill('s' + i, 0, 'top,left,right', (x, y) => (y % 4 === 0 ? hex('#2a4a18') : (x + i) % 7 === 0 ? hex('#e0d040') : null)); for (let b = 1; b < 6; b++) s.fill('s' + i, b, 'all', () => hex(b < 3 ? '#3a2a18' : '#e0c040')); }
    eyesFront(s, 'head', ['...........', '...........', '..RR...RR..', '..RR...RR..'], EY());
    for (let b = 1; b < 5; b++) s.fill('head', b, 'all', () => hex('#f0e8d0'));
    s.fill('head', 5, 'all', () => hex('#ff3020')); s.fill('head', 6, 'all', () => hex('#ff3020'));
  });
  SP.vortex = () => paint('os_vortex', 3050, { _: ['#c8b8f0', 0.15], eye: '#5020c0' }, (s) => {
    for (let k = 0; k < 8; k++) for (let b = 0; b < 4; b++) s.fill('r' + k, b, 'all', (x, y) => ((x + y + k) % 5 === 0 ? hex('#ffffff') : (x + k) % 7 === 0 ? hex('#7050d0') : null));
    s.fill('eye', 0, 'all', (x, y) => (x > 1 && x < 4 && y > 1 && y < 4 ? hex('#ffffff') : null));
  });
  SP.mothra = () => paint('os_mothra', 3060, { _: ['#c89a50', 0.1], body: ['#a07838', 0.12], rwing: ['#e8a838', 0.06], lwing: ['#e8a838', 0.06], rhind: ['#d88a28', 0.06], lhind: ['#d88a28', 0.06], ant: '#5a3a18' }, (s) => {
    const spot = (cx, cy, r) => (x, y) => { const d = Math.hypot(x - cx, y - cy); return d < r * 0.35 ? hex('#101010') : d < r * 0.7 ? hex('#3070e0') : d < r ? hex('#f8f0e0') : null; };
    s.fill('rwing', 0, 'top,bottom', spot(12, 15, 6)); s.fill('lwing', 0, 'top,bottom', spot(10, 15, 6));
    s.fill('rhind', 0, 'top,bottom', spot(8, 9, 4)); s.fill('lhind', 0, 'top,bottom', spot(8, 9, 4));
    for (const pn of ['rwing', 'lwing', 'rhind', 'lhind']) s.fill(pn, 0, 'top,bottom', (x, y, w, h) => (x < 2 || x >= w - 2 || y >= h - 2 ? hex('#5a3010') : x % 9 === 0 ? hex('#7a4a18') : null));
    s.fill('body', 0, 'top,left,right', (x, y) => (y % 3 === 0 ? hex('#6a4a20') : null));
    eyesFront(s, 'head', ['.......', '.CC.CC.', '.CC.CC.'], EY());
  });
  SP.sea_viper = () => paint('os_sea_viper', 3070, { _: ['#1a6a5a', 0.1], belly: '#d0e8a0', jaw: '#e04870' }, (s) => {
    for (let i = 0; i < 9; i++) { s.fill('s' + i, 0, 'top,left,right', (x, y) => ((x + y) % 4 === 0 ? hex('#0a3a30') : (x + i) % 5 === 0 ? hex('#e0d040') : null)); s.fill('s' + i, 1, 'all', () => hex('#e04870')); }
    for (let b = 1; b < 4; b++) s.fill('head', b, 'all', () => hex('#e04870'));
    eyesFront(s, 'head', ['.......', '.Y...Y.', '.K...K.'], EY());
  });

  /* ============================================================ */
  /* Behaviour                                                    */
  /* ============================================================ */
  // big flying royals: circle, rain fire and ice, then swoop to bite
  function royalAI(m) {
    const d = m.def;
    m.moveForward = 0; m.moveStrafe = 0; m.jumping = false;
    if (m.attackTime > 0) m.attackTime--;
    if (!m.home) m.home = [m.x, m.y, m.z];
    if (!m.phase) m.phase = 'circle';
    const prevYaw = m.yaw;
    const t = AI.acquire(m);
    m.phaseT = (m.phaseT || 0) + 1;
    if (m.tamed) return princeAI(m);
    const w = m.world;
    if (t) {
      m.idle = 0;
      const dist = m.distTo(t), see = dist < 64;
      if (m.phase === 'swoop') {
        AI.steer(m, t.x, t.y + t.h * 0.5, t.z, d.flySpeed * 2.6, true);
        if (dist < m.w * 0.5 + 3.5) {
          m.attackAnim = 10; m.roar = 20;
          hurt(m, t, d.bite);
          const l = Math.hypot(t.x - m.x, t.z - m.z) || 1; t.vx += (t.x - m.x) / l * 1.2; t.vz += (t.z - m.z) / l * 1.2; t.vy += 0.7;
          snd(m, 'roar', 3, d.pitch || 0.6); shake(m, 6);
          m.phase = 'climb'; m.phaseT = 0;
        }
        if (m.phaseT > 90) { m.phase = 'climb'; m.phaseT = 0; }
      } else if (m.phase === 'climb') {
        AI.steer(m, m.x + m.vx * 12, t.y + d.alt + 6, m.z + m.vz * 12, d.flySpeed * 1.6, true);
        if (m.phaseT > 50) { m.phase = 'circle'; m.phaseT = 0; }
      } else {
        m.orbit = (m.orbit === undefined ? rnd() * 6.28 : m.orbit) + 0.011 * (d.orbitDir || 1);
        const R = d.orbitR || 22, tx = t.x + Math.cos(m.orbit) * R, tz = t.z + Math.sin(m.orbit) * R;
        AI.steer(m, tx, t.y + d.alt, tz, d.flySpeed, true);
        if (d.attackFn) d.attackFn(m, t, dist, see);
        if (m.phaseT > (d.swoopEvery || 260)) { m.phase = 'swoop'; m.phaseT = 0; m.roar = 30; snd(m, d.cry || 'king_roar', 4, d.pitch || 1); }
      }
      m.lookYaw = Math.atan2(-(t.x - m.x), -(t.z - m.z));
      m.pitch = Math.atan2(t.y - m.y, Math.hypot(t.x - m.x, t.z - m.z));
    } else {
      m.phase = 'circle';
      m.orbit = (m.orbit || 0) + 0.006;
      AI.steer(m, m.home[0] + Math.cos(m.orbit) * 32, m.home[1] + 8, m.home[2] + Math.sin(m.orbit) * 32, d.flySpeed * 0.7, true);
      m.lookYaw = undefined;
      if (m.age % 20 === 0 && m.health < m.maxHealth) m.heal(d.regen || 2);
    }
    // stay clear of the ground unless diving
    if (m.phase !== 'swoop' && w.isReady(Math.floor(m.x), Math.floor(m.z))) {
      const top = w.topSolidY(Math.floor(m.x), Math.floor(m.z));
      if (m.y < top + (d.minAlt || 6)) m.vy += 0.04;
    }
    m.yawRate = DL.wrapAngle(m.yaw - prevYaw);
    for (let i = 0; i < 3; i++) if (m.breath && m.breath[i] > 0) m.breath[i]--;
  }
  const headSpot = (m, k) => {
    const md = D[m.def.model], i = md.os.heads.indexOf(k), b = md.os.bases[i] || [0, -3, -12];
    return at(m, b[0] * 1.6, b[1] - 6, b[2] - 26);
  };
  const kingAttack = (m, t, d, see) => {
    if (!see) return;
    if (!m.breath) m.breath = [0, 0, 0];
    m.cd = m.cd || [30, 50, 70];
    for (let i = 0; i < 3; i++) {
      if (--m.cd[i] > 0) continue;
      const k = 'LCR'[i], from = headSpot(m, k);
      m.breath[i] = 12;
      if (i === 0) { for (let n = 0; n < 3; n++) fireball(m, from, t, false); m.cd[i] = 40 + Math.floor(rnd() * 20); snd(m, 'blaze', 2, 0.6); }
      else if (i === 1) { if (rnd() < 0.4) { lightning(m, t.x + (rnd() - 0.5) * 3, t.z + (rnd() - 0.5) * 3, 6); m.cd[i] = 90; } else { fireball(m, from, t, true); m.cd[i] = 70; snd(m, 'ghast', 2, 0.5); } }
      else { iceball(m, from, t); iceball(m, from, t); m.cd[i] = 55 + Math.floor(rnd() * 20); snd(m, 'glass', 1.5, 0.6); }
    }
  };
  const queenAttack = (m, t, d, see) => {
    if (!see) return;
    if (!m.breath) m.breath = [0, 0, 0];
    m.cd = m.cd || [40, 60, 80];
    for (let i = 0; i < 3; i++) {
      if (--m.cd[i] > 0) continue;
      const k = 'LCR'[i], from = headSpot(m, k);
      m.breath[i] = 12;
      if (i === 1 && rnd() < 0.35) {
        // purple power: everyone close is thrown into the air
        for (const e of m.world.entities) if (e.living && e !== m && !(e.def && e.def.osBoss) && e.health > 0 && m.dist2(e.x, e.y, e.z) < 30 * 30 && !(e.isPlayer && royal(e))) { e.damage('magic', 4, m); e.vy += 0.9; if (e.isPlayer) e.levitation = 40; }
        fxAt(m.world, 'portal', m.x, m.y + m.h / 2, m.z, 80, m.w); snd(m, 'teleport', 3, 0.5); m.cd[i] = 140;
      } else if (rnd() < 0.3) { lightning(m, t.x, t.z, 5); m.cd[i] = 80; }
      else { launch(m, from, t, { icon: id('amethyst'), size: 0.6, speed: 1.4, trail: 'portal', hit: (e, b) => { e.damage('magic', 6, m); fxAt(m.world, 'portal', b.x, b.y, b.z, 14, 0.6); }, block: (b) => fxAt(m.world, 'portal', b.x, b.y, b.z, 14, 0.6) }); m.cd[i] = 35 + Math.floor(rnd() * 25); snd(m, 'shoot', 1.5, 0.7); }
    }
  };
  const pitchAttack = (m, t, d, see) => {
    if (!see) return;
    if (!m.breath) m.breath = [0, 0, 0];
    m.cd = m.cd || [40];
    if (--m.cd[0] > 0) return;
    m.breath[0] = 14;
    const from = headSpot(m, 'C');
    if (rnd() < 0.3) { fireball(m, from, t, true); m.cd[0] = 60; } else { for (let n = 0; n < 4; n++) fireball(m, from, t, false); m.cd[0] = 45; }
    snd(m, 'blaze', 2, 0.4);
  };

  // giants on foot: walk at their foe and smash through what is in the way
  function giantAI(m) {
    const d = m.def;
    m.moveForward = 0; m.moveStrafe = 0; m.jumping = false; m.idle++;
    if (m.attackTime > 0) m.attackTime--;
    if (m.charge > 0) m.charge--;
    if (m.tamed) return;
    const t = AI.acquire(m);
    if (t) {
      m.idle = 0;
      const dist = m.distTo(t), see = m.canSee(t) || dist < 24;
      m.faceTowards(t.x, t.z, d.turn || 0.1);
      m.lookYaw = Math.atan2(-(t.x - m.x), -(t.z - m.z));
      m.pitch = Math.atan2(t.y - (m.y + m.eye), Math.hypot(t.x - m.x, t.z - m.z));
      if (dist > m.w * 0.5 + (d.closeIn || 2)) m.moveForward = 1;
      if (d.attackFn) d.attackFn(m, t, dist, see);
    } else {
      if (!m.wp || (m.x - m.wp[0]) ** 2 + (m.z - m.wp[1]) ** 2 < 9 || rnd() < 0.003) m.wp = [m.x + (rnd() * 2 - 1) * 30, m.z + (rnd() * 2 - 1) * 30];
      m.faceTowards(m.wp[0], m.wp[1], 0.04);
      m.moveForward = 0.5; m.lookYaw = undefined;
      if (m.age % 20 === 0 && m.health < m.maxHealth) m.heal(d.regen || 1);
    }
    if (m.collidedH) {
      if (m.onGround || m.inWater) m.jumping = true;
      if (d.smash && m.age % 4 === 0 && (t || d.smashIdle)) smash(m, m.w * 0.5 + 0.5, Math.ceil(m.w * 0.5), Math.ceil(m.h * 0.8), 18, d.smashOnly);
    }
    if (m.inWater) m.vy += 0.03;
  }
  // big feet: anyone near when it lands a step feels it
  function stomp(m, r, dmg) {
    for (const e of m.world.entities) if (e.living && e !== m && !(e.def && e.def.osBoss) && e.health > 0 && e.onGround && m.dist2(e.x, e.y, e.z) < r * r) { e.damage('mob', dmg, m); e.vy += 0.6; }
    fxAt(m.world, 'poof', m.x, m.y + 0.3, m.z, 20, m.w); snd(m, 'stomp', 3, 0.6); shake(m, 5, r * 3);
  }

  const mobzillaAttack = (m, t, d, see) => {
    if (d < m.w * 0.5 + 3.5 && m.attackTime <= 0) { m.attackTime = 30; m.attackAnim = 10; if (hurt(m, t, 18)) { t.vy += 0.9; t.vx += -Math.sin(m.yaw) * 1.4; t.vz += -Math.cos(m.yaw) * 1.4; } snd(m, 'roar', 2.5, 0.45); shake(m, 4); return; }
    if (!see || d > 48) return;
    // atomic breath: the plates glow, then a torrent of fire
    if (m.charge <= 0 && m.attackTime <= 0 && rnd() < 0.02) { m.charge = 50; m.roar = 30; snd(m, 'mobzilla_charge', 3, 1); }
    if (m.charge > 0 && m.charge < 25 && m.charge % 3 === 0) { fireball(m, at(m, 0, -8, -16), t, m.charge % 12 === 0); m.attackTime = 40; }
    if (rnd() < 0.004) lightning(m, t.x, t.z, 6);
  };
  const jefferyAttack = (m, t, d, see) => {
    if (d < m.w * 0.5 + 3 && m.attackTime <= 0) { m.attackTime = 35; m.swing && m.swing(); stomp(m, 6, 10); m.vy = 0.5; return; }
    if (!see || m.attackTime > 0) return;
    m.attackTime = 30; m.aiming = 12;
    laser(m, at(m, -3, -14, -6), t, 7, rnd() < 0.25); laser(m, at(m, 3, -14, -6), t, 7, false);
    snd(m, 'laser_zap', 2, 1);
  };
  const caterAttack = (m, t, d, see) => { if (d < m.w * 0.5 + 2.5 && m.attackTime <= 0 && see) { m.attackTime = 22; m.attackAnim = 10; hurt(m, t, 9); snd(m, 'stomp', 1.5, 1.4); } };
  const krakenAttack = (m, t, d, see) => {
    // its arms hang from where it floats: reach is measured across and down
    if (Math.hypot(t.x - m.x, t.z - m.z) < m.w * 0.5 + 4 && t.y > m.y - 3 && t.y < m.y + m.h * 0.5 && m.attackTime <= 0) {
      m.attackTime = 30; m.attackAnim = 10;
      if (hurt(m, t, 11)) { t.vy += 0.5; t.vx += (m.x - t.x) * 0.08; t.vz += (m.z - t.z) * 0.08; }
      snd(m, 'kraken', 2.5, 0.8);
      return;
    }
    if (see && m.attackTime <= 0 && rnd() < 0.03) { m.attackTime = 60; lightning(m, t.x + (rnd() - 0.5) * 2, t.z + (rnd() - 0.5) * 2, 6); snd(m, 'kraken', 3, 0.6); }
  };
  // the Kraken hangs over the sea and drifts at its prey
  function krakenAI(m) {
    const d = m.def;
    m.moveForward = 0; m.jumping = false;
    if (m.attackTime > 0) m.attackTime--;
    const t = AI.acquire(m), w = m.world;
    const top = w.isReady(Math.floor(m.x), Math.floor(m.z)) ? w.topSolidY(Math.floor(m.x), Math.floor(m.z)) : m.y - 8;
    if (t) {
      const dist = m.distTo(t);
      m.lookYaw = Math.atan2(-(t.x - m.x), -(t.z - m.z));
      AI.steer(m, t.x, Math.max(t.y - 1, top + 1), t.z, Math.hypot(t.x - m.x, t.z - m.z) > 3 ? d.flySpeed : 0.004, true);
      if (d.attackFn) d.attackFn(m, t, dist, m.canSee(t) || dist < 20);
    } else {
      AI.flyWander(m, 24, top + 4, top + 14, false);
      if (m.age % 20 === 0 && m.health < m.maxHealth) m.heal(2);
    }
    if (m.y < top) m.vy += 0.03;
  }
  // the Vortex pulls everything in and throws it up
  function vortexTick(m) {
    if (isGuest()) return;
    const w = m.world;
    if (m.age % 2 === 0) fxAt(w, 'cloud', m.x + (rnd() - 0.5) * m.w * 2, m.y + rnd() * m.h, m.z + (rnd() - 0.5) * m.w * 2, 1, 0.3);
    for (const e of w.entities) {
      if (e === m || e.removed || (e.def && e.def.osBoss) || e.type === 'thrown' || e.noClip) continue;
      const dx = m.x - e.x, dz = m.z - e.z, d2 = dx * dx + dz * dz;
      if (d2 > 144 || Math.abs(e.y - m.y) > 10) continue;
      if (e.isPlayer && e.creative) continue;
      const d = Math.sqrt(d2) || 1, k = 0.035 / Math.max(0.5, d * 0.25);
      e.vx += dx / d * k * 3 + (-dz / d) * k * 2; e.vz += dz / d * k * 3 + (dx / d) * k * 2;
      if (d < 2.2 && e.living && m.attackTime <= 0) { m.attackTime = 15; e.damage('mob', 3, m); e.vy = 1.3; e.vx += (rnd() - 0.5) * 1.5; e.vz += (rnd() - 0.5) * 1.5; snd(m, 'vortex', 1.5, 1.5); }
    }
    if (m.age % 60 === 0) snd(m, 'vortex', 2, 1);
  }
  const vortexAI = (m) => { if (m.attackTime > 0) m.attackTime--; const t = AI.acquire(m); if (t) AI.steer(m, t.x, t.y + 0.5, t.z, m.def.flySpeed, true); else AI.flyWander(m, 14, 1, 120, false); };
  // Mothra: peaceful by day unless you start it; at night it hunts the light
  const mothraFind = (m) => { const day = m.world.isDaytime ? m.world.isDaytime() : true; if (day && !m.provokedBy) return null; return bossTarget(48)(m); };
  const mothraAttack = (m, t, d, see) => {
    if (m.attackTime > 0 || !see) return;
    if (d < 7) { m.attackTime = 30; t.damage('mob', 6, m); const l = d || 1; t.vx += (t.x - m.x) / l * 1.6; t.vz += (t.z - m.z) / l * 1.6; t.vy += 0.6; fxAt(m.world, 'cloud', t.x, t.y + 1, t.z, 16, 1); if (t.addEffect && rnd() < 0.4) t.addEffect('poison', 60); snd(m, 'mothra', 2, 0.8); return; }
    m.attackTime = 26; for (let n = 0; n < 2; n++) fireball(m, at(m, 0, 12, -14), t, false); snd(m, 'blaze', 1.5, 0.8);
  };
  const viperAttack = (m, t, d, see) => { if (m.attackTime <= 0 && d < m.w * 0.5 + 2.5 && see) { m.attackTime = 20; m.attackAnim = 10; if (hurt(m, t, 8) && t.addEffect) t.addEffect('poison', 100); snd(m, 'hiss', 1.5, 0.6); } };

  /* ============================================================ */
  /* The giants                                                   */
  /* ============================================================ */
  const BOSS = { osBoss: true, persistent: true, fireImmune: true };
  const bossInit = (extra) => (m) => { m.persistent = true; if (m.def.noClip) m.noClip = true; m.eye = m.h * 0.8; if (extra) extra(m); };
  const big = (name, o, egg) => add(name, Object.assign({}, BOSS, o, { init: bossInit(o.init) }), egg);

  big('the_king', { w: 7, h: 5, hp: 1500, hostile: true, model: 'os_royal3', scale: 3.4, boss: 'The King', fly: true, alwaysFly: true, noClip: true, flySpeed: 0.05, drag: 0.92, alt: 14, orbitR: 24, swoopEvery: 240, bite: 16, regen: 4, minAlt: 8, renderR: 14,
    ai: royalAI, attackFn: kingAttack, findTarget: bossTarget(96, true), range: 96, cry: 'king_roar', pitch: 0.9, sound: null,
    drops: drops(['royal_helmet', 1], ['royal_chestplate', 1], ['royal_leggings', 1], ['royal_boots', 1], ['royal_guardian_sword', 1], ['diamond_block', 4], ['gold_block', 8], ['golden_apple', 6]) }, ['#b02818', '#ffd040']);
  big('the_queen', { w: 6.5, h: 4.5, hp: 1200, hostile: true, model: 'os_royal3q', skin: 'the_queen', scale: 3.1, boss: 'The Queen', fly: true, alwaysFly: true, noClip: true, flySpeed: 0.05, drag: 0.92, alt: 12, orbitR: 22, orbitDir: -1, swoopEvery: 220, bite: 14, regen: 3, minAlt: 8, renderR: 13,
    ai: royalAI, attackFn: queenAttack, findTarget: bossTarget(96, true), range: 96, cry: 'king_roar', pitch: 1.25, sound: null,
    drops: drops(['queen_scale', 24], ['royal_guardian_sword', 1, 0.5], ['prince_egg', 1], [B.diamond_block || 'diamond_block', 3], ['golden_apple', 4]) }, ['#9a40c8', '#60e8ff']);
  big('pitch_black', { w: 5.5, h: 4, hp: 600, hostile: true, model: 'os_royal1', skin: 'pitch_black', scale: 2.6, boss: 'Pitch Black', fly: true, alwaysFly: true, noClip: true, flySpeed: 0.055, drag: 0.92, alt: 10, orbitR: 18, swoopEvery: 180, bite: 12, regen: 2, minAlt: 6, renderR: 11,
    ai: royalAI, attackFn: pitchAttack, findTarget: bossTarget(80), range: 80, cry: 'king_roar', pitch: 0.6, sound: null,
    tick: (m) => { if (m.world.isDaytime && m.world.isDaytime() && m.world.dim === 0 && !m.target && rnd() < 0.002) { fxAt(m.world, 'smoke', m.x, m.y + 2, m.z, 40, 3); m.removed = true; } },
    drops: drops(['nightmare_scale', 12], ['diamond', 3], [B.obsidian || 'obsidian', 8]) }, ['#16121a', '#ff2020']);
  big('mobzilla', { w: 4, h: 11, hp: 1000, hostile: true, model: 'os_mobzilla', scale: 5.4, boss: 'Mobzilla', speed: 0.55, turn: 0.06, closeIn: 2.5, smash: true, regen: 2, renderR: 8,
    ai: giantAI, attackFn: mobzillaAttack, findTarget: bossTarget(64), range: 64, skinFor: (e) => (e.charge > 0 ? 'mobzilla_glow' : 'mobzilla'), glowIf: (e) => e.charge > 0, sound: 'roar',
    tick: (m) => { if (m.onGround && Math.abs(m.moveForward) > 0.1 && m.age % 22 === 0) { snd(m, 'stomp', 2, 0.5); shake(m, 2, 30); } },
    drops: drops(['mobzilla_scale', 24], ['ultimate_pickaxe', 1, 0.35], ['ultimate_axe', 1, 0.35], ['ultimate_shovel', 1, 0.35], ['ruby_block', 2], ['amethyst_block', 2], ['golden_apple', 4]) }, ['#3a4a36', '#a0f0ff']);
  big('kraken', { w: 5, h: 12, hp: 450, hostile: true, model: 'os_kraken', scale: 3.6, boss: 'The Kraken', fly: true, alwaysFly: true, noClip: true, flySpeed: 0.03, drag: 0.9, renderR: 7, waterBreather: true,
    ai: krakenAI, attackFn: krakenAttack, findTarget: bossTarget(56), range: 56, sound: 'kraken',
    drops: drops(['kraken_tooth', 3], ['ultimate_sword', 1, 0.3], ['ultimate_bow', 1, 0.3], ['golden_apple', 3], [349, 12]) }, ['#7a2a4a', '#ffe030']);
  big('mothra', { w: 4, h: 2.5, hp: 150, hostile: true, neutral: true, model: 'os_mothra', scale: 2.6, boss: 'Mothra', fly: true, alwaysFly: true, noClip: true, flySpeed: 0.04, drag: 0.9, keep: 8, hover: 5, renderR: 8,
    ai: (m) => AI.flyingAI(m), attackFn: mothraAttack, findTarget: mothraFind, range: 48, sound: 'mothra',
    drops: drops(['moth_scale', 12], ['nether_star', 1, 0.1], ['blaze_rod', 4], ['gold_nugget', 9]) }, ['#c89a50', '#3070e0']);
  big('jeffery', { w: 3.6, h: 10, hp: 350, hostile: true, model: 'os_jeffery', scale: 3.6, boss: 'Robo-Jeffery', speed: 0.5, turn: 0.08, closeIn: 2, smash: true, renderR: 6,
    ai: giantAI, attackFn: jefferyAttack, findTarget: bossTarget(56), range: 56, sound: null, tick: (m) => { if (m.aiming > 0) m.aiming--; if (m.onGround && Math.abs(m.moveForward) > 0.1 && m.age % 18 === 0) snd(m, 'stomp', 1.5, 0.8); },
    drops: drops(['ray_gun', 1], ['iron_ingot', 16], ['redstone', 24], ['titanium_ingot', 4], ['uranium_ingot', 4]) }, ['#9aa0aa', '#30e0ff']);
  big('caterkiller', { w: 2.2, h: 2.4, hp: 200, hostile: true, model: 'os_caterkiller', scale: 2.2, boss: 'CaterKiller', speed: 0.6, turn: 0.08, closeIn: 2, smash: true, smashIdle: true, smashOnly: isWoody, regen: 2, renderR: 7,
    ai: giantAI, attackFn: caterAttack, findTarget: bossTarget(28), range: 28, fireImmune: false,
    // it eats the trees around it (and they make it stronger)
    tick: (m) => { if (!isGuest() && m.age % 10 === 0) { const n = smash(m, 1.5, 2, 4, 6, isWoody); if (n) { m.heal(n); fxAt(m.world, 'poof', m.x, m.y + 1.5, m.z, 4, 1); } } },
    drops: drops(['caterkiller_jaws', 1], [B.leaves || 'leaves', 16], ['experience_bottle', 4]) }, ['#4a7a28', '#e0c040']);
  big('vortex', { w: 2.4, h: 4.5, hp: 100, hostile: true, model: 'os_vortex', scale: 1.4, boss: 'The Vortex', fly: true, alwaysFly: true, flySpeed: 0.025, drag: 0.88, renderR: 4,
    ai: vortexAI, tick: vortexTick, findTarget: bossTarget(32), range: 32, spectral: true, glow: () => true,
    drops: drops(['vortex_eye', 1], ['uranium_nugget', 6], ['titanium_nugget', 6], ['tigers_eye_ingot', 2], ['pink_tourmaline_ingot', 2]) }, ['#c8b8f0', '#5020c0']);
  big('sea_viper', Object.assign({}, OSM.SWIM, { w: 1.4, h: 1.4, hp: 120, hostile: true, model: 'os_sea_viper', scale: 2, boss: 'Sea Viper', flySpeed: 0.045, keep: 1.5, renderR: 6, fireImmune: false,
    attackFn: viperAttack, findTarget: bossTarget(28), range: 28, amphibious: true, ai: (m) => { if (m.inWater) AI.flyingAI(m); else { m.moveForward = 0; } },
    drops: drops(['sea_viper_tongue', 1], ['iron_ingot', 6], [349, 8]) }), ['#1a6a5a', '#e04870']);
  // its glowing dorsal plates light Mobzilla up while it charges
  const glowDraw = DL.Renderer.prototype.drawModel;
  DL.Renderer.prototype.drawModel = function (type, e, pt, model, light, opts) {
    if (e && e.def && e.def.glowIf && e.def.glowIf(e)) light = [15, 15];
    return glowDraw.call(this, type, e, pt, model, light, opts);
  };

  /* ------------------------------------------------------------ */
  /* The Prince: hatch it, raise it, ride it                      */
  /* ------------------------------------------------------------ */
  const PRINCE_EGG = 870;
  I._def(PRINCE_EGG, 'prince_egg', { display: 'The Prince Egg', maxStack: 1, tab: 'orespawn' });
  OS.items.prince_egg = PRINCE_EGG;
  DL.Tex.ITEM_PAINT.prince_egg = (t) => t.art(['................', '......oooo......', '.....oyyyyo.....', '....oyYyyyyo....', '...oyYyyprpyo...', '...oyyyprrpyo...', '..oyyyyypyyyyo..', '..oyppyyyyyyyo..', '..oyprpyyyyypo..', '..oyyppyyyyypo..', '..oyyyyyyyppyo..', '...oyyyyyyprpo..', '...oyyyyyyyppo..', '....oyyyyyyyo...', '.....ooooooo....', '................'],
    { o: hex('#5a3008'), y: hex('#f0c040'), Y: hex('#fff0b0'), p: hex('#a040c0'), r: hex('#ff60c0') });
  big('the_prince', { w: 1.2, h: 1.0, hp: 120, model: 'os_royal3', skin: 'the_prince', scale: 0.55, fly: true, alwaysFly: true, flySpeed: 0.04, drag: 0.9, neutral: true, osBoss: false, renderR: 3,
    ai: royalAI, findTarget: (m) => (m.tamed ? bossTarget(24)(m) : null), range: 24, seatY: 2.5, interact: (m, p, g) => princeInteract(m, p, g), sound: null }, ['#e0a020', '#40ff60']);
  MOBS.the_prince.osBoss = false; MOBS.the_prince.boss = undefined;
  const GROW = 24000; // one day per stage: baby, teen, adult
  function princeScale(m) { const s = m.grow >= GROW * 2 ? 1.6 : m.grow >= GROW ? 1.0 : 0.55; m.scale = s; m.w = 1.2 * s / 0.55; m.h = 1.0 * s / 0.55; return s; }
  function princeAI(m) {
    const o = m.owner, w = m.world;
    m.grow = (m.grow || 0) + 1;
    if (m.age % 200 === 0) princeScale(m);
    if (m.rider) return rideFly(m);
    if (!o || o.removed || o.world !== w) { AI.flyWander(m, 10, 1, 120, false); return; }
    if (m.sitting) { m.vx *= 0.5; m.vz *= 0.5; m.vy = (m.onGround ? 0 : -0.05); return; }
    const t = m.target && !m.target.removed && m.target.health > 0 ? m.target : null;
    if (t && m.distTo(t) < 24) {
      AI.steer(m, t.x, t.y + 3, t.z, m.def.flySpeed, true);
      if (m.attackTime <= 0 && m.canSee(t)) { m.attackTime = m.scale >= 1.6 ? 20 : 35; m.breath = [10, 10, 10]; fireball(m, at(m, 0, -6, -30), t, false); snd(m, 'blaze', 1, 1.6); }
      return;
    }
    const d2 = m.dist2(o.x, o.y, o.z);
    if (d2 > 900) { m.setPos(o.x, o.y + 2, o.z); return; }
    if (d2 > 25) AI.steer(m, o.x, o.y + 2.5, o.z, m.def.flySpeed, true);
    else { m.vx *= 0.8; m.vz *= 0.8; m.vy += (o.y + 2.5 - m.y) * 0.01; m.faceTowards(o.x, o.z, 0.1); }
  }
  // flying where the rider looks; jump climbs
  function rideFly(m) {
    const r = m.rider;
    if (r.vehicle !== m || r.removed || r.health <= 0) { m.rider = null; return; }
    const inp = r.rideInput || {}, sp = (inp.sprint ? 0.075 : 0.045);
    m.yaw = r.yaw; m.lookYaw = m.yaw;
    const f = inp.f || 0, pitch = r.pitch || 0;
    m.vx += -Math.sin(m.yaw) * Math.cos(pitch) * f * sp; m.vz += -Math.cos(m.yaw) * Math.cos(pitch) * f * sp;
    m.vy += Math.sin(pitch) * f * sp + (inp.j ? 0.05 : 0);
    m.fallDistance = 0;
  }
  function princeInteract(m, p, g) {
    const h = p.held;
    if (!m.tamed) {
      // a wild prince (from a spawn egg) is won over with meat
      if (!h || !(h.id === 363 || h.id === 364 || h.id === 349 || h.id === 350)) return false;
      if (!p.creative) p.consumeHeld(1);
      m.tamed = 1; m.owner = p; m.persistent = true; m.grow = m.grow || 0; princeScale(m);
      fxAt(m.world, 'heart', m.x, m.y + m.h, m.z, 7);
      if (g && g.chatMessage) g.chatMessage('§6The Prince is yours!');
      return true;
    }
    if (h && (h.id === 363 || h.id === 364 || h.id === 349 || h.id === 350)) { m.heal(10); if (!p.creative) p.consumeHeld(1); fxAt(m.world, 'heart', m.x, m.y + m.h, m.z, 4); m.grow = (m.grow || 0) + 1200; return true; }
    if (m.grow >= GROW * 2 && !p.vehicle && !p.sneaking) { p.sitting = null; p.vehicle = m; m.rider = p; m.sitting = false; if (g && g.chatMessage) g.chatMessage('§6Flying The Prince! Look where to go, jump to climb, sneak to get off.'); return true; }
    m.sitting = !m.sitting;
    if (g && g.chatMessage) g.chatMessage('§6The Prince ' + (m.sitting ? 'waits here.' : 'follows you.') + (m.grow < GROW * 2 ? ' (Feed it meat to grow it up faster.)' : ''));
    return true;
  }
  const useItem = DL.Game.prototype.useItem;
  DL.Game.prototype.useItem = function () {
    const p = this.player, held = p && p.held;
    if (held && held.id === PRINCE_EGG) {
      if (!this.usePressed && !this._pgUseEdge) return;
      if (isGuest()) { this.chatMessage('§7Only the host can hatch The Prince.'); return; }
      const t = this.target, w = this.world;
      if (!t || t.entity) return;
      const m = E.spawnMob(w, 'the_prince', t.x + 0.5, t.y + 1.5, t.z + 0.5);
      if (m) { m.tamed = 1; m.owner = p; m.persistent = true; m.grow = 0; princeScale(m); fxAt(w, 'heart', m.x, m.y + 1, m.z, 8); this.chatMessage('§6The Prince hatched! It will grow up over three days.'); }
      if (!p.creative) p.consumeHeld(1);
      p.swing();
      return;
    }
    return useItem.apply(this, arguments);
  };

  /* ------------------------------------------------------------ */
  /* Boss bars, immunities, saving                                */
  /* ------------------------------------------------------------ */
  const mtick = E.Mob.prototype.tick;
  E.Mob.prototype.tick = function () {
    const r = mtick.apply(this, arguments);
    const d = this.def;
    if (d.osBoss || (d.orespawn && d.boss && !this.tamed)) {
      const w = this.world, p = DL.game && DL.game.player;
      if (this.health > 0 && p && p.world === w && (this.target || this.hurtTime > 0) && this.distTo(p) < 96) {
        const cur = w.boss;
        if (!cur || cur.removed || cur.health <= 0 || cur === this || cur.distTo(p) > this.distTo(p) + 8) w.boss = this;
      }
      if ((this.health <= 0 || this.removed) && w.boss === this) w.boss = null;
    }
    return r;
  };
  const mdamage = E.Mob.prototype.damage;
  E.Mob.prototype.damage = function (src, amount, from) {
    const d = this.def;
    if (d.osBoss && (src === 'fall' || src === 'suffocate' || src === 'inWall' || src === 'drown' || src === 'cactus' || (src === 'lightning' && !(from && from.isPlayer)))) return false;
    if (d.osBoss && from && from.isPlayer && !this.tamed) this.provokedBy = from;
    if (this.type === 'the_prince' && this.tamed && from === this.owner) return false;
    return mdamage.apply(this, arguments);
  };
  const ser = E.Mob.prototype.serialize;
  E.Mob.prototype.serialize = function () {
    const d = ser.apply(this, arguments);
    if (d && this.grow) d.grow = this.grow;
    if (d && this.sitting && this.def.orespawn) d.sitting = 1;
    return d;
  };
  // tamed OreSpawn creatures remember their owner across saves (the world's own player)
  const spawnMob = E.spawnMob;
  E.spawnMob = function (world, type, x, y, z, extra) {
    const m = spawnMob.apply(this, arguments);
    if (m && extra && m.def.orespawn) {
      if (extra.tamed) { m.tamed = extra.tamed; m.owner = (DL.game && DL.game.player) || world.player || null; m.persistent = true; m.hostile = false; }
      if (extra.grow) { m.grow = extra.grow; if (type === 'the_prince') princeScale(m); }
      if (extra.sitting) m.sitting = true;
    }
    return m;
  };
  // death: a long fall, a blast of light and a shower of loot
  const onDeath = (m) => {
    const w = m.world;
    for (let i = 0; i < 6; i++) fxAt(w, 'explosion', m.x + (rnd() - 0.5) * m.w * 2, m.y + rnd() * m.h, m.z + (rnd() - 0.5) * m.w * 2, 2, m.w * 0.5);
    snd(m, 'explode', 3, 0.6);
    if (w.boss === m) w.boss = null;
    const g = DL.game;
    if (g && g.player && g.player.world === w && m.distTo(g.player) < 128) { g.chatMessage('§6' + (m.def.boss || I._titleCase(m.type)) + ' has been defeated!'); if (X && X.grant) X.grant('os_' + m.type); }
  };
  // a giant always drops its trophy: at least one of everything it carries, usually far more
  const bossLoot = (m) => {
    for (const [iid, max, ch] of m.def.bossDrops || []) {
      if (ch !== undefined && rnd() >= ch) continue;
      const n = Math.max(1, Math.ceil(max * (0.5 + rnd() * 0.5))), st = I.maxStack(iid);
      for (let left = n; left > 0; left -= st) m.world.spawnItem(m.x, m.y + Math.min(m.h, 3), m.z, I.stack(iid, Math.min(st, left)), true);
    }
  };
  for (const n of ['the_king', 'the_queen', 'pitch_black', 'mobzilla', 'kraken', 'mothra', 'jeffery', 'caterkiller', 'vortex', 'sea_viper']) {
    const d = MOBS[n], od = d.onDeath;
    d.bossDrops = d.drops; d.drops = null;
    d.onDeath = (m) => { onDeath(m); bossLoot(m); if (od) od(m); };
  }

  /* ------------------------------------------------------------ */
  /* Sounds                                                       */
  /* ------------------------------------------------------------ */
  const dsp = A.dsp;
  if (dsp) {
    const { Biquad, gen, noise } = dsp;
    A.DESIGNS.king_roar = () => { const lp = new Biquad('lp', 900), lp2 = new Biquad('lp', 400); return gen(3.2, (t) => { const env = Math.min(1, t * 3) * Math.exp(-t * 0.9); const f = 60 + Math.sin(t * 5) * 18; return (lp.run(noise() * 0.8 + Math.sin(2 * Math.PI * f * t) * 0.7 + Math.sin(2 * Math.PI * f * 1.33 * t) * 0.5) * 0.7 + lp2.run(Math.sin(2 * Math.PI * f * 0.75 * t + Math.sin(t * 40) * 2)) * 0.6) * env; }); };
    A.DESIGNS.stomp = () => { const lp = new Biquad('lp', 180); return gen(0.9, (t) => lp.run(noise() * 1.2 + Math.sin(2 * Math.PI * 38 * t) * 1.5) * Math.exp(-t * 6)); };
    A.DESIGNS.mobzilla_charge = () => { const bp = new Biquad('bp', 1200); return gen(2.2, (t) => (bp.run(noise()) * 0.6 + Math.sin(2 * Math.PI * (200 + t * 600) * t) * 0.25) * Math.min(1, t * 2) * Math.min(1, (2.2 - t) * 3)); };
    A.DESIGNS.kraken = () => { const lp = new Biquad('lp', 500); return gen(2, (t) => lp.run(noise() * (0.6 + 0.4 * Math.sin(t * 30)) + Math.sin(2 * Math.PI * (45 + Math.sin(t * 9) * 12) * t)) * Math.min(1, t * 5) * Math.exp(-t * 1.4)); };
    A.DESIGNS.mothra = () => { const lp = new Biquad('lp', 350); return gen(1.2, (t) => lp.run(noise()) * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 7)) * Math.min(1, t * 6) * Math.min(1, (1.2 - t) * 4) * 1.4); };
    A.DESIGNS.laser_zap = () => gen(0.4, (t) => Math.sin(2 * Math.PI * (1800 - t * 3500) * t) * Math.exp(-t * 8) * 0.7 + (rnd() - 0.5) * 0.15 * Math.exp(-t * 20));
    A.DESIGNS.vortex = () => { const bp = new Biquad('bp', 600); return gen(2.4, (t) => { bp.f = 400 + Math.sin(t * 3) * 250; return bp.run(noise()) * 1.4 * Math.min(1, t * 2) * Math.min(1, (2.4 - t) * 2); }); };
    A.DESIGNS.hiss = () => { const hp = new Biquad('hp', 2500); return gen(0.8, (t) => hp.run(noise()) * Math.min(1, t * 10) * Math.exp(-t * 3)); };
    for (const k of ['king_roar', 'stomp', 'mobzilla_charge', 'kraken', 'mothra', 'laser_zap', 'vortex', 'hiss']) A.VARIANTS[k] = 2;
  }

  /* ------------------------------------------------------------ */
  /* Where the giants turn up in the Overworld                    */
  /* ------------------------------------------------------------ */
  const OCEAN = new Set([BI.OCEAN, BI.DEEP_OCEAN, BI.WARM_OCEAN, BI.FROZEN_OCEAN].filter(v => v !== undefined));
  const FOREST = new Set([BI.FOREST, BI.BIRCH_FOREST, BI.DARK_FOREST, BI.JUNGLE, BI.OLD_GROWTH_TAIGA, BI.TAIGA, BI.FLOWER_FOREST].filter(v => v !== undefined));
  const PLAINS = new Set([BI.PLAINS, BI.SAVANNA, BI.MEADOW, BI.SUNFLOWER_PLAINS].filter(v => v !== undefined));
  OSM.giantSpawn = function (world, player) {
    if (isGuest() || !player || player.health <= 0 || world.difficulty === 0 || world.totalTicks % 400 !== 0) return;
    for (const e of world.entities) if (e.def && e.def.osBoss && !e.removed && e.distTo(player) < 160) return;
    const day = world.isDaytime ? world.isDaytime() : true;
    const a = rnd() * Math.PI * 2, r = 64 + rnd() * 32;
    const x = Math.floor(player.x + Math.cos(a) * r), z = Math.floor(player.z + Math.sin(a) * r);
    if (!world.isReady(x, z)) return;
    const c = world.getChunk(x >> 4, z >> 4); if (!c || !c.biomes) return;
    const bio = c.biomes[((z & 15) << 4) | (x & 15)], top = world.topSolidY(x, z);
    const water = world.getBlock(x, top - 1, z) === B.water;
    let type = null;
    const roll = rnd();
    if (OCEAN.has(bio) && water) type = roll < 0.06 ? 'mobzilla' : roll < 0.3 ? 'kraken' : roll < 0.75 ? 'sea_viper' : null;
    else if (!day && FOREST.has(bio)) type = roll < 0.25 ? 'mothra' : roll < 0.45 ? 'caterkiller' : null;
    else if (day && FOREST.has(bio)) type = roll < 0.3 ? 'caterkiller' : null;
    else if (!day && PLAINS.has(bio)) type = roll < 0.12 ? 'jeffery' : roll < 0.2 ? 'pitch_black' : null;
    if (!type || rnd() > 0.06) return;
    let y = top;
    if (type === 'sea_viper') { y = top - 3; if (world.getBlock(x, y, z) !== B.water) return; }
    if (type === 'kraken') y = top + 4;
    if (type === 'mothra' || type === 'pitch_black') y = Math.min(120, top + 20);
    const m = E.spawnMob(world, type, x + 0.5, y, z + 0.5);
    if (m && DL.game && DL.game.player === player) DL.game.chatMessage('§5' + (type === 'mobzilla' ? 'The sea boils... Mobzilla rises!' : type === 'pitch_black' ? 'Something huge blots out the stars...' : 'You feel watched... ' + (m.def.boss || I._titleCase(type)) + ' is near.'));
  };
  const naturalSpawn = E.naturalSpawn;
  E.naturalSpawn = function (world, player) {
    const r = naturalSpawn.apply(this, arguments);
    if (!world.dim) OSM.giantSpawn(world, player);
    return r;
  };
  OSM.BOSSES = ['the_king', 'the_queen', 'pitch_black', 'mobzilla', 'kraken', 'mothra', 'jeffery', 'caterkiller', 'vortex', 'sea_viper'];
  OSM.at = at; OSM.launch = launch; OSM.lightning = lightning; OSM.royalAI = royalAI;
})();
