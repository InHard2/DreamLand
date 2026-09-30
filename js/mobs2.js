/*
 * DreamLand - new creatures: behaviour, drops, projectiles, the Ender Dragon
 * boss fight and per-dimension natural spawning.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, E = DL.Entities;
  const I = () => DL.Items;
  const MOBS = E.MOBS, Mob = E.Mob;
  const SOLID = S.SOLID, OPAQUE = S.OPAQUE;
  const rnd = Math.random;
  const snd = (m, n, v, p) => { if (m.world.fx) m.world.fx.sound(n, m.x, m.y + m.h / 2, m.z, v || 1, p || (rnd() - rnd()) * 0.2 + 1); };
  const parts = (w, t, x, y, z, n, s) => { if (w.fx) w.fx.particles(t, x, y, z, n, s); };

  /* ------------------------------------------------------------ */
  /* Shared movement helpers                                      */
  /* ------------------------------------------------------------ */
  Mob.prototype.flyTravel = function () {
    const d = this.def;
    if (this.noClip) { this.x += this.vx; this.y += this.vy; this.z += this.vz; this.onGround = false; }
    else this.move(this.vx, this.vy, this.vz);
    const drag = d.drag === undefined ? 0.91 : d.drag;
    this.vx *= drag; this.vy *= drag; this.vz *= drag;
    this.fallDistance = 0;
    this.prevLimbAmount = this.limbSwingAmount;
    let f = Math.hypot(this.x - this.px, this.z - this.pz) * 4;
    if (f > 1) f = 1;
    this.limbSwingAmount += (f - this.limbSwingAmount) * 0.4;
    this.limbSwing += this.limbSwingAmount;
  };
  function steer(m, tx, ty, tz, acc, face) {
    const dx = tx - m.x, dy = ty - m.y, dz = tz - m.z, l = Math.hypot(dx, dy, dz) || 1;
    m.vx += dx / l * acc; m.vy += dy / l * acc; m.vz += dz / l * acc;
    if (face !== false) m.faceTowards(m.x + m.vx, m.z + m.vz, 0.2);
    return l;
  }
  function airAt(w, x, y, z) { const b = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !SOLID[b] && !S.LIQUID[b]; }
  function flyWander(m, range, minY, maxY, water) {
    const w = m.world;
    if (!m.wp || m.dist2(m.wp[0], m.wp[1], m.wp[2]) < 4 || m.collidedH || rnd() < 0.005) {
      for (let i = 0; i < 8; i++) {
        const x = m.x + (rnd() * 2 - 1) * range, z = m.z + (rnd() * 2 - 1) * range;
        let y = m.y + (rnd() * 2 - 1) * range * 0.5;
        y = Math.max(minY, Math.min(maxY, y));
        if (!w.isReady(Math.floor(x), Math.floor(z))) continue;
        const b = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        if (water ? b === B.water : airAt(w, x, y, z)) { m.wp = [x, y, z]; break; }
      }
    }
    if (m.wp) steer(m, m.wp[0], m.wp[1], m.wp[2], m.def.flySpeed || 0.02);
  }
  function lookAt(m, t) {
    const dx = t.x - m.x, dz = t.z - m.z, dy = (t.y + (t.eye || 1)) - (m.y + m.eye);
    m.yaw = Math.atan2(-dx, -dz); m.lookYaw = m.yaw;
    m.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }
  function acquire(m) {
    if (m.target && (m.target.health <= 0 || m.target.removed || m.distTo(m.target) > (m.def.range || 24) * 1.5)) m.target = null;
    if (!m.target || m.age % 20 === 0) { const t = m.findTarget(); if (t) m.target = t; }
    return m.target;
  }
  function teleportRandom(m, range, around) {
    const w = m.world;
    for (let i = 0; i < 24; i++) {
      const c = around || m;
      const x = Math.floor(c.x + (rnd() * 2 - 1) * range), z = Math.floor(c.z + (rnd() * 2 - 1) * range);
      let y = Math.floor(c.y + (rnd() * 2 - 1) * 8);
      if (!w.isReady(x, z)) continue;
      while (y > 1 && !SOLID[w.getBlock(x, y - 1, z)]) y--;
      if (!E.standable(w, x, y, z, Math.ceil(m.h)) || S.LIQUID[w.getBlock(x, y, z)]) continue;
      parts(w, 'portal', m.x, m.y + m.h / 2, m.z, 24, m.w);
      snd(m, 'teleport', 0.8);
      m.setPos(x + 0.5, y, z + 0.5);
      m.path = null;
      parts(w, 'portal', m.x, m.y + m.h / 2, m.z, 24, m.w);
      return true;
    }
    return false;
  }
  E.teleportRandom = teleportRandom;
  function drop(m, id, n) { if (n > 0) m.world.spawnItem(m.x, m.y + 0.5, m.z, I().stack(id, n), true); }
  const hostileNear = (m, r) => {
    let best = null, bd = r;
    for (const e of m.world.entities) {
      if (!(e instanceof Mob) || !e.hostile || e.health <= 0 || e.removed || e.type === 'creeper' && m.type === 'wolf') continue;
      const d = m.distTo(e);
      if (d < bd && m.canSee(e)) { bd = d; best = e; }
    }
    return best;
  };

  // track who the player fights (for tame wolves and golems)
  const mobHurt = Mob.prototype.onHurt;
  Mob.prototype.onHurt = function (src, from) {
    if (from && from.isPlayer) { from.lastAttacked = this; from.lastAttackAge = from.age; }
    return mobHurt.call(this, src, from);
  };
  const P = E.Player.prototype;
  const pHurt = P.onHurt;
  P.onHurt = function (src, from) {
    if (from && from.living && from !== this) { this.lastHurtBy = from; this.lastHurtAge = this.age; }
    return pHurt ? pHurt.call(this, src, from) : undefined;
  };
  const pTick = P.tick;
  P.tick = function () {
    pTick.call(this);
    if (this.levitation > 0) { this.levitation--; this.vy = 0.05; this.fallDistance = 0; }
  };

  /* ------------------------------------------------------------ */
  /* Projectiles                                                  */
  /* ------------------------------------------------------------ */
  const ICONS = { fireball: 385, small_fireball: 385, shulker_bullet: 445, potion: 438, ender_pearl: 368, zephyr_snow: 332, dragon_fireball: 381 };
  const SIZES = { fireball: 1.0, small_fireball: 0.35, shulker_bullet: 0.4, potion: 0.3, ender_pearl: 0.25, zephyr_snow: 0.6, dragon_fireball: 0.9 };
  class Magic extends E.Thrown {
    constructor(world, x, y, z, shooter, kind, target) {
      super(world, x, y, z, shooter, kind);
      this.icon = ICONS[kind]; this.size = SIZES[kind];
      this.gravity = kind === 'potion' ? 0.05 : kind === 'ender_pearl' ? 0.03 : 0;
      this.drag = kind === 'potion' || kind === 'ender_pearl' ? 0.99 : 1;
      this.homing = target || null;
    }
    tick() {
      if (this.kind === 'shulker_bullet' && this.homing && !this.homing.removed) {
        const t = this.homing, sp = 0.35;
        const dx = t.x - this.x, dy = t.y + t.h / 2 - this.y, dz = t.z - this.z, l = Math.hypot(dx, dy, dz) || 1;
        this.vx += (dx / l * sp - this.vx) * 0.1; this.vy += (dy / l * sp - this.vy) * 0.1; this.vz += (dz / l * sp - this.vz) * 0.1;
      }
      if ((this.kind === 'fireball' || this.kind === 'small_fireball' || this.kind === 'dragon_fireball') && this.age % 2 === 0) parts(this.world, 'smoke', this.x, this.y, this.z, 1, 0.1);
      if (this.kind === 'shulker_bullet' && this.age % 3 === 0) parts(this.world, 'portal', this.x, this.y, this.z, 1, 0.1);
      super.tick();
      if (this.age > 300) this.removed = true;
    }
    hitEntity(e) {
      const k = this.kind, w = this.world, src = this.shooter || this;
      if (e === this.shooter) return;
      if (k === 'fireball') { e.damage('fireball', 6, src); this.boom(1); }
      else if (k === 'small_fireball') { if (!e.fireImmune) { e.damage('fireball', 5, src); e.fire = 100; } }
      else if (k === 'shulker_bullet') { e.damage('mob', 4, src); if (e.isPlayer) e.levitation = 200; }
      else if (k === 'zephyr_snow') { e.damage('mob', 1, src); e.vx += this.vx * 1.5; e.vz += this.vz * 1.5; e.vy += 0.5; }
      else if (k === 'dragon_fireball') { this.boom(0); }
      else this.impact2(e);
      if (k !== 'potion' && k !== 'ender_pearl') { parts(w, 'poof', this.x, this.y, this.z, 6, 0.2); this.removed = true; }
      else this.impact2(null);
    }
    hitBlock(hit) {
      const k = this.kind, w = this.world;
      if (k === 'fireball') this.boom(1);
      else if (k === 'dragon_fireball') this.boom(0);
      else if (k === 'small_fireball' && hit) {
        const f = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][hit.face] || [0, 1, 0];
        const x = hit.x + f[0], y = hit.y + f[1], z = hit.z + f[2];
        if (w.getBlock(x, y, z) === 0) w.setBlock(x, y, z, B.fire, 0, 3);
      } else if (k === 'potion' || k === 'ender_pearl') { this.impact2(null); return; }
      parts(w, 'poof', this.x, this.y, this.z, 6, 0.2);
      this.removed = true;
    }
    impact2(direct) {
      const w = this.world;
      if (this.kind === 'potion') {
        for (const e of w.entities) if (e.living && e.health > 0 && e.dist2(this.x, this.y, this.z) < 9) e.damage('magic', e === direct ? 6 : 4, this.shooter || this);
        parts(w, 'portal', this.x, this.y, this.z, 30, 1);
        if (w.fx) w.fx.sound('glass', this.x, this.y, this.z, 1, 1);
      } else if (this.kind === 'ender_pearl') {
        const s = this.shooter;
        if (s && s.health > 0) {
          parts(w, 'portal', s.x, s.y + 1, s.z, 30, 0.6);
          s.setPos(this.x, Math.floor(this.y) + (direct ? 0 : 0.05), this.z);
          s.vx = s.vy = s.vz = 0; s.fallDistance = 0;
          if (!s.creative) s.damage('fall', 5);
          if (w.fx) w.fx.sound('teleport', s.x, s.y, s.z, 1, 1);
          if (rnd() < 0.05 && w.dim !== 3) E.spawnMob(w, 'endermite', s.x, s.y, s.z);
        }
      }
      this.removed = true;
    }
    boom(power) {
      const w = this.world;
      if (power > 0) {
        w.explode(this.x, this.y, this.z, power, this.shooter || this);
        for (let i = 0; i < 6; i++) {
          const x = Math.floor(this.x + (rnd() - 0.5) * 3), y = Math.floor(this.y + (rnd() - 0.5) * 2), z = Math.floor(this.z + (rnd() - 0.5) * 3);
          if (w.getBlock(x, y, z) === 0 && SOLID[w.getBlock(x, y - 1, z)]) w.setBlock(x, y, z, B.fire, 0, 3);
        }
      } else {
        for (const e of w.entities) if (e.living && e.health > 0 && e !== this.shooter && e.dist2(this.x, this.y, this.z) < 16) e.damage('magic', 6, this.shooter || this);
        parts(w, 'portal', this.x, this.y, this.z, 60, 2);
        if (w.fx) w.fx.sound('explode', this.x, this.y, this.z, 1.5, 1.4);
      }
      this.removed = true;
    }
  }
  E.Magic = Magic;
  E.shoot = function (m, kind, t, speed, spread, target) {
    const w = m.world;
    const sx = m.x, sy = m.y + (m.def.fly && m.type === 'ghast' ? m.h * 0.5 : m.eye), sz = m.z;
    const p = new Magic(w, sx, sy, sz, m, kind, target);
    const dx = t.x - sx, dz = t.z - sz, dy = t.y + (t.h || 1) * 0.5 - sy;
    const arc = kind === 'potion' ? Math.hypot(dx, dz) * 0.2 : 0;
    p.shoot(dx, dy + arc, dz, speed, spread);
    if (m.type === 'ghast') { const l = Math.hypot(dx, dy, dz) || 1; p.x += dx / l * 2.5; p.y += dy / l * 2.5; p.z += dz / l * 2.5; p.px = p.x; p.py = p.y; p.pz = p.z; }
    w.entities.push(p);
    return p;
  };

  /** Eye of Ender: floats towards the nearest stronghold, then drops or shatters. */
  class EyeOfEnder extends E.Entity {
    constructor(world, x, y, z, tx, tz) {
      super(world, x, y, z);
      this.type = 'thrown'; this.kind = 'eye'; this.icon = 381; this.size = 0.4;
      this.tx = tx; this.tz = tz; this.w = 0.25; this.h = 0.25;
    }
    tick() {
      this.px = this.x; this.py = this.y; this.pz = this.z;
      this.age++;
      const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz) || 1;
      const sp = 0.25;
      this.x += dx / d * Math.min(sp, d); this.z += dz / d * Math.min(sp, d);
      this.y += d > 12 ? 0.06 : -0.02;
      parts(this.world, 'portal', this.x, this.y, this.z, 1, 0.1);
      if (this.age > 70) {
        this.removed = true;
        if (rnd() < 0.8) this.world.spawnItem(this.x, this.y, this.z, I().stack(381), false);
        else if (this.world.fx) { this.world.fx.sound('glass', this.x, this.y, this.z, 1, 1); parts(this.world, 'portal', this.x, this.y, this.z, 20, 0.4); }
      }
    }
  }
  E.EyeOfEnder = EyeOfEnder;

  /* ------------------------------------------------------------ */
  /* Behaviours                                                   */
  /* ------------------------------------------------------------ */
  function hopTick(m) {
    if (m.onGround && (m.path || m.panic > 0 || m.target) && rnd() < 0.25) { m.vy = 0.36; m.hopping = 6; }
    if (m.def.slowFall && !m.onGround && m.vy < 0) m.vy *= 0.6;
  }
  function slowFall(m) { if (!m.onGround && m.vy < 0) m.vy *= 0.6; }

  // Slimes & magma cubes
  function applySize(m) {
    const s = m.variant || 1;
    m.size = s; m.scale = s; m.w = m.h = 0.51 * s; m.eye = m.h * 0.6;
    m.maxHealth = s * s * (m.def.magma ? 1 : 1); if (m.health > m.maxHealth || !m._sized) m.health = m.maxHealth;
    m._sized = true;
  }
  function slimeAI(m) {
    m.moveForward = 0; m.moveStrafe = 0; m.jumping = false; m.idle++;
    const t = m.world.difficulty > 0 ? acquire(m) : null;
    if (m.squish > 0) m.squish *= 0.6;
    if (m.onGround && !m.wasGround) { m.squish = -0.5; if (m.size > 1) snd(m, 'slime', 0.4 * m.size); }
    m.wasGround = m.onGround;
    if (m.onGround) {
      if (--m.jumpDelay <= 0) {
        m.jumpDelay = 10 + Math.floor(rnd() * 20);
        if (t) { m.jumpDelay = Math.floor(m.jumpDelay / 3); m.faceTowards(t.x, t.z, 6.3); }
        else m.yaw += (rnd() - 0.5) * 1.5;
        m.vy = m.def.magma ? 0.42 + m.size * 0.1 : 0.42;
        m.squish = 1;
        m.hopping = 1;
      }
    } else if (m.hopping) m.moveForward = m.def.magma ? 1.4 : 1;
    if (m.inWater || m.inLava) m.jumping = true;
    if (t) {
      lookAt(m, t);
      if (m.attackTime > 0) m.attackTime--;
      if (m.size > 1 || m.def.magma) {
        const reach = m.w * 0.6 + 0.6;
        if (m.distTo(t) < reach + 0.4 && m.attackTime <= 0 && m.canSee(t)) { m.attackTime = 20; t.damage('mob', m.size + (m.def.magma ? 2 : 0), m); }
      }
    }
  }
  function slimeDeath(m) {
    if (m.size > 1) {
      const n = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const c = E.spawnMob(m.world, m.type, m.x + (rnd() - 0.5) * m.size / 2, m.y + 0.5, m.z + (rnd() - 0.5) * m.size / 2, { v: m.size / 2 });
        c.persistent = false;
      }
    } else if (!m.def.magma) drop(m, 341, Math.floor(rnd() * 3));
    if (m.def.magma && m.size > 1 && rnd() < 0.3) drop(m, 378, 1);
  }

  // Endermen
  function endermanTick(m) {
    const w = m.world, p = w.player;
    if (p && !p.creative && p.health > 0 && !m.provoked && m.age % 5 === 0 && m.distTo(p) < 64) {
      const d = p.look();
      const ex = m.x - p.x, ey = m.y + m.eye - (p.y + p.eye), ez = m.z - p.z, l = Math.hypot(ex, ey, ez);
      if ((d[0] * ex + d[1] * ey + d[2] * ez) / l > 1 - 0.025 / l && m.canSee(p)) {
        m.provoked = true; m.target = p; snd(m, 'enderman', 1.5, 0.6);
        if (m.distTo(p) > 8 && rnd() < 0.5) teleportRandom(m, 4, p);
      }
    }
    if ((m.inWater || (m.fire > 0 && !m.inLava)) && rnd() < 0.2) teleportRandom(m, 16);
    if (m.provoked && m.target && m.distTo(m.target) > 16 && rnd() < 0.02) teleportRandom(m, 6, m.target);
    if (rnd() < 0.2) parts(w, 'portal', m.x + (rnd() - 0.5) * m.w, m.y + rnd() * m.h, m.z + (rnd() - 0.5) * m.w, 1, 0.1);
  }

  // Wolves
  function wolfTarget(m) {
    const p = m.world.player;
    if (m.tamed) {
      if (m.sitting || !p) return null;
      if (p.lastHurtBy && p.age - p.lastHurtAge < 100 && p.lastHurtBy !== m && !p.lastHurtBy.removed && p.lastHurtBy.health > 0) return p.lastHurtBy;
      if (p.lastAttacked && p.age - p.lastAttackAge < 100 && p.lastAttacked !== m && !p.lastAttacked.removed && p.lastAttacked.health > 0 && !p.lastAttacked.tamed) return p.lastAttacked;
      return null;
    }
    if (m.provoked && p && !p.creative && p.health > 0) return p;
    return null;
  }
  function wolfIdle(m) {
    const p = m.world.player;
    if (!m.tamed || !p || m.sitting) return;
    const d = m.distTo(p);
    if (d > 20 && p.onGround) teleportRandom(m, 2, p);
    else if (d > 6 && (!m.path || m.age % 20 === 0)) { m.path = E.findPath(m.world, m, p.x, p.y, p.z, 200, 20); m.pathIdx = 0; }
  }
  // Iron golems attack monsters
  function golemTarget(m) {
    const p = m.world.player;
    if (m.provoked && p && !p.creative && p.health > 0) return p;
    return hostileNear(m, 16);
  }
  function piglinTarget(m) {
    const p = m.world.player;
    if (!p || p.health <= 0 || p.creative || m.world.difficulty === 0) return null;
    const gold = p.armor && p.armor.some(s => s && s.id >= 314 && s.id <= 317);
    if (gold && !m.provoked) return null;
    return m.distTo(p) < 16 && m.canSee(p) ? p : null;
  }
  function pigmanHurt(m, src, from) {
    if (!from || !from.isPlayer) return;
    for (const e of m.world.entities) if (e.type === 'zombie_pigman' && e !== m && e.distTo(m) < 32) { e.provoked = true; e.target = from; }
  }
  function witchAttack(m, t, d, see) {
    if (see && d < 10) {
      m.faceTowards(t.x, t.z, 0.8);
      if (m.attackTime <= 0) { m.attackTime = 60; m.swing(); E.shoot(m, 'potion', t, 0.75, 8); snd(m, 'bow', 0.5, 0.6); }
      if (d < 4) m.moveForward = -0.8;
    }
    if (m.health < m.maxHealth && m.age % 80 === 0) m.heal(4);
  }

  // Flying mobs
  function flyingAI(m) {
    m.moveForward = 0; m.moveStrafe = 0; m.jumping = false; m.idle++;
    const d = m.def;
    const t = (m.hostile && m.world.difficulty > 0) || d.neutral ? acquire(m) : null;
    if (m.attackTime > 0) m.attackTime--;
    if (t) {
      m.idle = 0;
      lookAt(m, t);
      const dist = m.distTo(t), see = m.canSee(t);
      if (d.attackFn) d.attackFn(m, t, dist, see);
      if (d.keep !== undefined) {
        const want = d.keep;
        const ty = t.y + (d.hover || 0);
        if (dist > want + 2) steer(m, t.x, ty, t.z, d.flySpeed || 0.02, false);
        else if (dist < want - 2) steer(m, 2 * m.x - t.x, ty, 2 * m.z - t.z, d.flySpeed || 0.02, false);
        else if (Math.abs(ty - m.y) > 1) m.vy += Math.sign(ty - m.y) * 0.01;
      } else flyWander(m, 16, d.minY || 1, d.maxY || 120, d.water);
    } else {
      m.charge = 0;
      flyWander(m, d.wanderRange || 12, d.minY || 1, d.maxY || 120, d.water);
      m.lookYaw = undefined;
    }
  }
  function ghastAttack(m, t, d, see) {
    if (see && d < 64) {
      m.charge = (m.charge || 0) + 1;
      if (m.charge === 10) snd(m, 'ghast', 3);
      if (m.charge >= 20) { E.shoot(m, 'fireball', t, 0.9, 4); snd(m, 'shoot', 2); m.charge = -40; }
    } else if (m.charge > 0) m.charge--;
  }
  function blazeAttack(m, t, d, see) {
    if (d < 2.2 && see && m.attackTime <= 0) { m.attackTime = 20; t.damage('mob', 6, m); t.fire = 60; }
    if (d < 20 && see) {
      m.charge = (m.charge || 0) + 1;
      if (m.charge === 60) m.burning = 1;
      if (m.charge > 60 && m.charge < 100 && m.charge % 6 === 0) { E.shoot(m, 'small_fireball', t, 0.8, 10); snd(m, 'shoot', 1, 1.6); }
      if (m.charge >= 100) { m.charge = 0; m.burning = 0; }
    }
    if (m.age % 5 === 0) parts(m.world, 'smoke', m.x, m.y + 1, m.z, 1, 0.3);
  }
  function zephyrAttack(m, t, d, see) {
    if (see && d < 40 && m.attackTime <= 0) { m.attackTime = 50; E.shoot(m, 'zephyr_snow', t, 0.9, 2); snd(m, 'shoot', 1, 1.4); }
  }
  function guardianAttack(m, t, d, see) {
    if (see && d < 15) {
      m.charge = (m.charge || 0) + 1;
      if (m.charge % 4 === 0) {
        const k = rnd();
        parts(m.world, 'bubble', m.x + (t.x - m.x) * k, m.y + 0.5 + (t.y + 1 - m.y - 0.5) * k, m.z + (t.z - m.z) * k, 2, 0.05);
      }
      if (m.charge >= 60) { m.charge = 0; t.damage('magic', 6, m); }
    } else m.charge = 0;
  }
  function batAI(m) {
    m.moveForward = 0; m.moveStrafe = 0;
    flyWander(m, 6, 2, 100);
    if (rnd() < 0.02) m.vy += (rnd() - 0.5) * 0.2;
  }

  // Shulkers stay put, peek and fire homing bullets
  function shulkerAI(m) {
    m.moveForward = m.moveStrafe = 0; m.vx = m.vz = 0;
    m.prevPeek = m.peek || 0;
    const t = m.world.difficulty > 0 ? acquire(m) : null;
    let want = 0;
    if (t) { want = 1; lookAt(m, t); if (m.attackTime > 0) m.attackTime--; else if (m.canSee(t)) { m.attackTime = 20 + Math.floor(rnd() * 90); E.shoot(m, 'shulker_bullet', t, 0.25, 0, t); snd(m, 'shoot', 0.6, 1.8); } }
    else if (rnd() < 0.005) m.peekT = 40;
    if (m.peekT > 0) { m.peekT--; want = Math.max(want, 0.4); }
    m.peek = (m.peek || 0) + (want - (m.peek || 0)) * 0.12;
    m.bodyYaw = m.yaw = 0;
  }
  function shulkerHurt(m) { if (m.health > 0 && rnd() < 0.2) teleportRandom(m, 8); }

  // The Aether's Slider: a sliding stone guardian
  function sliderAI(m) {
    m.moveForward = m.moveStrafe = 0;
    if (!m.awake) { m.vx = m.vz = 0; return; }
    const t = acquire(m);
    if (!t) return;
    if (m.slideT > 0) {
      m.slideT--;
      m.vx = m.slide[0] * 0.35; m.vz = m.slide[1] * 0.35;
      if (m.collidedH) { m.slideT = 0; snd(m, 'fallbig', 1, 0.6); m.world.fx && m.world.fx.explosion && null; }
    } else {
      m.vx *= 0.5; m.vz *= 0.5;
      if (--m.slideWait <= 0) {
        m.slideWait = 25;
        const dx = t.x - m.x, dz = t.z - m.z;
        m.slide = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
        m.slideT = 20;
        snd(m, 'stone', 1, 0.5);
      }
    }
    if (m.attackTime > 0) m.attackTime--;
    const b = m.box, pb = t.box;
    if (m.attackTime <= 0 && pb[3] > b[0] - 0.3 && pb[0] < b[3] + 0.3 && pb[5] > b[2] - 0.3 && pb[2] < b[5] + 0.3 && pb[4] > b[1] && pb[1] < b[4]) {
      m.attackTime = 20; t.damage('mob', 6, m); t.vy += 0.4;
    }
  }

  /* ------------------------------------------------------------ */
  /* The Ender Dragon                                             */
  /* ------------------------------------------------------------ */
  function dragonAI(m) {
    const w = m.world, p = w.player;
    w.boss = m;
    m.flapTime = (m.flapTime || 0) + (m.perched ? 0.02 : m.vy > 0 ? 0.16 : 0.1);
    const cy = w.endFountainY || 64;
    if (!m.phase) { m.phase = 'circle'; m.ang = 0; m.phaseT = 300; }
    const alive = p && p.health > 0 && !p.creative;
    // crystals heal
    if (m.age % 10 === 0) {
      let best = null, bd = 32;
      for (const e of w.entities) if (e.type === 'end_crystal' && !e.removed && e.health > 0) { const d = m.distTo(e); if (d < bd) { bd = d; best = e; } }
      m.healer = best;
      if (best && m.health < m.maxHealth) m.health = Math.min(m.maxHealth, m.health + 1);
    }
    let tx, ty, tz, sp = 0.05;
    m.phaseT--;
    m.jawOpen = Math.max(0, (m.jawOpen || 0) - 0.05);
    if (m.phase === 'circle') {
      m.ang += 0.011;
      const R = 48 + Math.sin(m.ang * 2) * 12;
      tx = Math.cos(m.ang) * R; tz = Math.sin(m.ang) * R; ty = cy + 22 + Math.sin(m.ang * 3) * 8;
      if (m.phaseT <= 0) {
        m.phaseT = 200 + Math.floor(rnd() * 300);
        if (alive && m.distTo(p) < 150 && rnd() < 0.55) { m.phase = 'strafe'; m.phaseT = 140; snd(m, 'roar', 4, 1); }
        else if (rnd() < 0.5) { m.phase = 'land'; m.phaseT = 400; }
      }
      if (alive && m.age % 90 === 0 && m.distTo(p) < 64 && rnd() < 0.5) { E.shoot(m, 'dragon_fireball', p, 0.8, 3); m.jawOpen = 1; }
    } else if (m.phase === 'strafe') {
      if (!alive) { m.phase = 'circle'; m.phaseT = 100; }
      else { tx = p.x; ty = p.y + 1; tz = p.z; sp = 0.09; }
      if (m.phaseT <= 0 || (alive && m.distTo(p) < 5)) { m.phase = 'circle'; m.phaseT = 250; m.ang = Math.atan2(m.z, m.x); }
    } else if (m.phase === 'land') {
      tx = 0; ty = cy + 5; tz = 0; sp = 0.04;
      if (Math.hypot(m.x, m.z) < 3 && Math.abs(m.y - ty) < 2.5) { m.phase = 'perch'; m.phaseT = 240; snd(m, 'roar', 4, 0.8); }
      if (m.phaseT <= 0) { m.phase = 'circle'; m.phaseT = 200; }
    } else if (m.phase === 'perch') {
      m.perched = true; m.vx *= 0.5; m.vy *= 0.5; m.vz *= 0.5;
      if (alive) { m.faceTowards(p.x, p.z, 0.05); m.bodyYaw = m.yaw; }
      if (m.phaseT % 40 === 0) {
        m.jawOpen = 1;
        if (alive && m.distTo(p) < 14) p.damage('magic', 3, m);
        parts(w, 'portal', m.x - Math.sin(m.yaw) * 10, m.y + 2, m.z - Math.cos(m.yaw) * 10, 40, 3);
      }
      if (m.phaseT <= 0) { m.perched = false; m.phase = 'circle'; m.phaseT = 300; m.vy = 0.5; snd(m, 'roar', 4, 1.1); }
      return;
    }
    m.perched = false;
    if (tx !== undefined) {
      const dx = tx - m.x, dy = ty - m.y, dz = tz - m.z, l = Math.hypot(dx, dy, dz) || 1;
      const s = Math.min(1.0, l / 8 + 0.3);
      m.vx += (dx / l * s - m.vx) * sp; m.vy += (dy / l * s - m.vy) * sp; m.vz += (dz / l * s - m.vz) * sp;
      const want = Math.atan2(-m.vx, -m.vz);
      m.yaw = DL.wrapAngle(m.yaw + DL.wrapAngle(want - m.yaw) * 0.08);
      m.bodyYaw = m.yaw;
    }
    // body slam
    if (alive && m.attackTime-- <= 0) {
      const b = m.box, pb = p.box;
      if (pb[3] > b[0] && pb[0] < b[3] && pb[4] > b[1] && pb[1] < b[4] + 1 && pb[5] > b[2] && pb[2] < b[5]) {
        m.attackTime = 20; p.damage('mob', 10, m);
        const dx = p.x - m.x, dz = p.z - m.z, l = Math.hypot(dx, dz) || 1;
        p.vx += dx / l * 1.5; p.vz += dz / l * 1.5; p.vy += 0.6;
      }
    }
    if (rnd() < 0.02) snd(m, 'roar', 3, 0.8 + rnd() * 0.4);
  }
  function dragonDeath(m) {
    const w = m.world;
    w.boss = null;
    for (let i = 0; i < 12; i++) parts(w, 'explosion', m.x + (rnd() - 0.5) * 8, m.y + rnd() * 5, m.z + (rnd() - 0.5) * 8, 6, 2);
    if (w.fx) w.fx.sound('explode', m.x, m.y, m.z, 6, 0.5);
    if (w.onDragonDeath) w.onDragonDeath(m);
  }
  function crystalDeath(m) {
    const w = m.world;
    m.removed = true;
    w.explode(m.x, m.y + 1, m.z, 4, m);
    for (const e of w.entities) if (e.type === 'ender_dragon' && e.healer === m && e.health > 0) { e.healer = null; e.damage('explosion', 10, m); }
  }

  /* ------------------------------------------------------------ */
  /* Villager trading, taming                                     */
  /* ------------------------------------------------------------ */
  const TRADES = [
    [{ want: [296, 20], give: [388, 1] }, { want: [388, 1], give: [297, 6] }],
    [{ want: [339, 24], give: [388, 1] }, { want: [388, 1], give: [B.bookshelf, 2] }],
    [{ want: [331, 16], give: [388, 1] }, { want: [388, 3], give: [368, 1] }, { want: [388, 1], give: [348, 4] }],
    [{ want: [265, 4], give: [388, 1] }, { want: [388, 6], give: [278, 1] }, { want: [388, 4], give: [307, 1] }],
    [{ want: [319, 10], give: [388, 1] }, { want: [388, 1], give: [320, 5] }]
  ];
  const PROF = ['Farmer', 'Librarian', 'Cleric', 'Blacksmith', 'Butcher'];
  function countItem(p, id) { let n = 0; for (const s of p.inv) if (s && s.id === id) n += s.count; return n; }
  function takeItem(p, id, n) { for (let i = 0; i < p.inv.length && n > 0; i++) { const s = p.inv[i]; if (s && s.id === id) { const k = Math.min(n, s.count); s.count -= k; n -= k; if (s.count <= 0) p.inv[i] = null; } } }
  function villagerInteract(m, p, game) {
    const trades = TRADES[m.variant || 0];
    m.lookTarget = p; m.lookTimer = 60;
    for (const tr of trades) {
      if (countItem(p, tr.want[0]) >= tr.want[1] && p.held && p.held.id === tr.want[0]) {
        takeItem(p, tr.want[0], tr.want[1]);
        const st = I().stack(tr.give[0], tr.give[1]);
        if (!p.addItem || !p.addItem(st)) m.world.spawnItem(p.x, p.y + 0.5, p.z, st, false);
        snd(m, 'villager', 1, 1.2); parts(m.world, 'happy', m.x, m.y + m.h + 0.2, m.z, 6, 0.4);
        game.chatMessage('§aTraded ' + tr.want[1] + ' ' + I().name(tr.want[0]) + ' for ' + tr.give[1] + ' ' + I().name(tr.give[0]));
        return true;
      }
    }
    m.headShake = 20;
    snd(m, 'villager', 1, 0.9);
    game.chatMessage('§e' + PROF[m.variant || 0] + '§f offers: ' + trades.map(t => t.want[1] + ' ' + I().name(t.want[0]) + ' -> ' + t.give[1] + ' ' + I().name(t.give[0])).join(', ') + ' (hold the payment and use)');
    return true;
  }
  function wolfInteract(m, p, game) {
    const held = p.held;
    if (!m.tamed && held && held.id === 352) {
      if (!p.creative) p.consumeHeld(1);
      if (rnd() < 0.34) { m.tamed = 1; m.provoked = false; m.target = null; m.persistent = true; m.maxHealth = 20; m.health = 20; parts(m.world, 'heart', m.x, m.y + m.h, m.z, 7, 0.5); game.chatMessage('Wolf tamed!'); }
      else parts(m.world, 'smoke', m.x, m.y + m.h, m.z, 7, 0.5);
      return true;
    }
    if (m.tamed) {
      if (held && [319, 320, 367, 411, 412].includes(held.id) && m.health < m.maxHealth) { m.heal(4); if (!p.creative) p.consumeHeld(1); parts(m.world, 'heart', m.x, m.y + m.h, m.z, 3, 0.5); return true; }
      m.sitting = !m.sitting; m.path = null; m.target = null;
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------ */
  /* Definitions                                                  */
  /* ------------------------------------------------------------ */
  const add = (name, o) => { MOBS[name] = Object.assign({ w: 0.6, h: 1.8, hp: 20, speed: 0.7, hostile: false, sound: null, model: name }, o); };
  const pick = (n) => (m) => { if (m.variant === undefined) m.variant = Math.floor(rnd() * n); };
  add('villager', { speed: 0.5, sound: 'villager', init: pick(5), skinFor: e => 'villager_' + (e.variant || 0), interact: villagerInteract, tick: m => { if (m.headShake > 0) m.headShake--; } });
  add('witch', { hostile: true, hp: 26, speed: 0.6, sound: 'villager', skin: 'witch', attackFn: witchAttack, drops: [[331, 2], [348, 2], [289, 1], [352, 1]] });
  add('pillager', { hostile: true, hp: 24, speed: 0.7, attack: 4, ranged: true, held: 261, drops: [[262, 2], [388, 1, 0.3]] });
  add('vindicator', { hostile: true, hp: 24, speed: 0.75, attack: 8, held: 258, drops: [[388, 1, 0.5]] });
  add('iron_golem', { w: 1.4, h: 2.7, hp: 100, speed: 0.5, neutral: true, attack: 12, findTarget: golemTarget, onHit: (m, t) => { t.vy += 0.45; m.attackAnim = 10; }, tick: m => { if (m.attackAnim > 0) m.attackAnim--; }, drops: [[265, 4], [B.rose, 2]] });
  add('wolf', { w: 0.6, h: 0.85, hp: 8, speed: 0.85, neutral: true, attack: 4, sound: 'wolf', skinFor: e => e.tamed ? 'wolf_tame' : e.provoked ? 'wolf_angry' : 'wolf', findTarget: wolfTarget, idle: wolfIdle, interact: wolfInteract, ai: m => { if (m.sitting) { m.moveForward = m.moveStrafe = 0; m.path = null; m.target = null; return; } m.aiTick(); } });
  add('rabbit', { w: 0.4, h: 0.5, hp: 3, speed: 0.9, tick: hopTick, drops: [[411, 1], [415, 1]] });
  add('slime', { w: 1, h: 1, hp: 4, hostile: true, sound: 'slime', ai: slimeAI, init: m => { if (m.variant === undefined) m.variant = [1, 2, 4][Math.floor(rnd() * 3)]; m.jumpDelay = 10; applySize(m); }, onVariant: applySize, onDeath: slimeDeath });
  add('magma_cube', { w: 1, h: 1, hp: 4, hostile: true, sound: 'slime', model: 'slime', skin: 'magma_cube', magma: true, fireImmune: true, ai: slimeAI, init: m => { if (m.variant === undefined) m.variant = [1, 2, 4][Math.floor(rnd() * 3)]; m.jumpDelay = 10; applySize(m); }, onVariant: applySize, onDeath: slimeDeath });
  add('enderman', { h: 2.9, hp: 40, speed: 0.9, neutral: true, attack: 7, sound: 'enderman', tick: endermanTick, onHurt: (m, src) => { if (src === 'arrow' || rnd() < 0.3) teleportRandom(m, 16); }, drops: [[368, 1]] });
  add('bat', { w: 0.5, h: 0.9, hp: 6, fly: true, flySpeed: 0.03, ai: batAI, scale: 0.6, sound: 'bat' });
  add('polar_bear', { w: 1.4, h: 1.4, hp: 30, speed: 0.7, neutral: true, attack: 6, drops: [[349, 2]] });
  add('husk', { hostile: true, attack: 5, speed: 0.5, sound: 'zombie', model: 'zombie', skin: 'husk', drops: [[367, 2]] });
  add('drowned', { hostile: true, attack: 5, speed: 0.5, sound: 'zombie', model: 'zombie', skin: 'drowned', burns: true, drops: [[367, 2]] });
  add('stray', { hostile: true, attack: 4, speed: 0.7, sound: 'skeleton', model: 'skeleton', skin: 'stray', ranged: true, burns: true, held: 261, drops: [[262, 2], [352, 2]] });
  add('zombie_pigman', { neutral: true, attack: 5, speed: 0.6, sound: 'zombie', fireImmune: true, held: 283, onHurt: pigmanHurt, drops: [[367, 1], [371, 1], [266, 1, 0.05]] });
  add('piglin', { hostile: true, attack: 5, speed: 0.7, held: 283, findTarget: piglinTarget, drops: [[371, 2], [266, 1, 0.1]] });
  add('wither_skeleton', { w: 0.7, h: 2.4, hp: 20, hostile: true, attack: 8, speed: 0.75, sound: 'skeleton', fireImmune: true, scale: 1.2, held: 272, onHit: (m, t) => { t.fire = Math.max(t.fire, 40); }, drops: [[263, 1], [352, 2]] });
  add('ghast', { w: 4, h: 4, hp: 10, hostile: true, fly: true, flySpeed: 0.012, fireImmune: true, scale: 4, range: 64, sound: 'ghast', ai: flyingAI, attackFn: ghastAttack, skinFor: e => e.charge > 10 ? 'ghast_fire' : 'ghast', drops: [[370, 1], [289, 2]], minY: 20, maxY: 110, wanderRange: 20 });
  add('blaze', { h: 1.8, hp: 20, hostile: true, fly: true, flySpeed: 0.025, keep: 8, hover: 2, fireImmune: true, sound: 'blaze', ai: flyingAI, attackFn: blazeAttack, drops: [[369, 1]], wanderRange: 6 });
  add('shulker', { w: 1, h: 1, hp: 30, hostile: true, ai: shulkerAI, range: 16, onHurt: shulkerHurt, drops: [[450, 1, 0.5]], init: m => { m.persistent = true; } });
  add('endermite', { w: 0.4, h: 0.3, hp: 8, hostile: true, attack: 2, speed: 0.9, drops: [] });
  add('silverfish', { w: 0.4, h: 0.3, hp: 8, hostile: true, attack: 1, speed: 0.9, model: 'endermite', skin: 'silverfish' });
  add('ender_dragon', { w: 8, h: 4, hp: 200, hostile: true, fly: true, drag: 1, noSave: true, fireImmune: true, scale: 2, boss: 'Ender Dragon', ai: dragonAI, onDeath: dragonDeath, init: m => { m.noClip = true; m.persistent = true; m.eye = 2; } });
  add('end_crystal', { w: 2, h: 2, hp: 1, fly: true, drag: 0, fireImmune: true, ai: m => { m.vx = m.vy = m.vz = 0; m.moveForward = 0; }, onDeath: crystalDeath, init: m => { m.persistent = true; } });
  add('moa', { w: 0.9, h: 2, hp: 20, speed: 0.8, tick: slowFall, skinFor: e => 'moa_' + (e.variant || 0), init: pick(3), drops: [[288, 3]] });
  add('phyg', { w: 0.9, h: 0.9, hp: 10, speed: 0.7, sound: 'pig', tick: slowFall, drops: [[319, 2]] });
  add('flying_cow', { w: 0.9, h: 1.3, hp: 10, speed: 0.7, sound: 'cow', tick: slowFall, drops: [[334, 2]] });
  add('aerbunny', { w: 0.4, h: 0.5, hp: 5, speed: 0.9, model: 'rabbit', skin: 'aerbunny', scale: 1.2, slowFall: true, tick: hopTick, drops: [] });
  add('sheepuff', { w: 0.9, h: 1.3, hp: 8, speed: 0.7, sound: 'sheep', model: 'sheep', skin: 'sheepuff', drops: [[B.wool, 2]] });
  add('zephyr', { w: 2.4, h: 2, hp: 10, hostile: true, fly: true, flySpeed: 0.015, keep: 12, hover: 4, scale: 1.3, range: 40, ai: flyingAI, attackFn: zephyrAttack, minY: 40, maxY: 120, wanderRange: 16 });
  add('slider', { w: 2, h: 2, hp: 120, hostile: true, speed: 0, scale: 2, boss: 'Slider', range: 40, noSave: false, ai: sliderAI, skinFor: e => e.awake ? 'slider_awake' : 'slider',
    onHurt: (m, src, from) => { if (!m.awake) { m.awake = true; m.slideWait = 10; snd(m, 'roar', 2, 1.8); } if (from && from.isPlayer) m.target = from; },
    init: m => { m.persistent = true; m.slideWait = 20; }, tick: m => { if (m.awake) m.world.boss = m; },
    onDeath: m => { m.world.boss = null; drop(m, 451, 4); drop(m, 447, 6); drop(m, 441, 8); drop(m, 440, 6); } });
  add('guardian', { w: 0.85, h: 0.85, hp: 30, hostile: true, fly: true, flySpeed: 0.02, keep: 8, water: true, ai: flyingAI, attackFn: guardianAttack, range: 16, drops: [[B.prismarine, 1], [349, 1]], init: m => { m.waterBreather = true; }, tick: m => { if (!m.inWater) { m.vy -= 0.04; if (m.onGround && rnd() < 0.1) { m.vy = 0.4; m.vx += (rnd() - 0.5) * 0.3; m.vz += (rnd() - 0.5) * 0.3; } } } });
  // keep water mobs in water, flyers out of the ground
  MOBS.drowned.waterOK = true;

  /* ------------------------------------------------------------ */
  /* Natural spawning per dimension                               */
  /* ------------------------------------------------------------ */
  const standable = E.standable;
  function spawnAt(world, type, x, y, z) { const m = E.spawnMob(world, type, x + 0.5, y, z + 0.5); m.persistent = false; return m; }
  function openAir(w, x, y, z, r, h) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let dy = 0; dy < h; dy++) if (SOLID[w.getBlock(x + dx, y + dy, z + dz)] || S.LIQUID[w.getBlock(x + dx, y + dy, z + dz)]) return false;
    return true;
  }
  const OW_HOSTILE = [['zombie', 10], ['skeleton', 10], ['creeper', 10], ['spider', 10], ['enderman', 2], ['witch', 1], ['slime', 2]];
  const NETHER_HOSTILE = [['zombie_pigman', 12], ['ghast', 3], ['magma_cube', 3], ['piglin', 4], ['enderman', 1]];
  function weighted(r, list) { let t = 0; for (const e of list) t += e[1]; let v = r.nextInt(t); for (const e of list) { v -= e[1]; if (v < 0) return e[0]; } return list[0][0]; }
  E.naturalSpawn = function (world, player) {
    if (!player || player.health <= 0) return;
    const dim = world.dim || 0;
    let hostile = 0, passive = 0, bats = 0;
    for (const e of world.entities) if (e instanceof Mob && !e.removed) { if (e.type === 'bat') bats++; else if (e.hostile) hostile++; else passive++; }
    const pcx = Math.floor(player.x / 16), pcz = Math.floor(player.z / 16);
    const r = world.rng;
    const far = (x, y, z) => (x + 0.5 - player.x) ** 2 + (y - player.y) ** 2 + (z + 0.5 - player.z) ** 2 >= 24 * 24;
    if (world.difficulty > 0 && hostile < (dim === 1 ? 40 : 30)) {
      for (let tries = 0; tries < 3; tries++) {
        const cx = pcx + r.nextInt(17) - 8, cz = pcz + r.nextInt(17) - 8;
        const c = world.getChunk(cx, cz);
        if (!c || !c.lit) continue;
        const x = cx * 16 + r.nextInt(16), z = cz * 16 + r.nextInt(16), y = r.nextInt(120) + 1;
        let type;
        const biome = c.biomes ? c.biomes[((z & 15) << 4) | (x & 15)] : 0;
        if (dim === 0) {
          type = weighted(r, OW_HOSTILE);
          if (type === 'zombie' && biome === S.BIOME.DESERT) type = 'husk';
          if (type === 'skeleton' && biome === S.BIOME.TUNDRA) type = 'stray';
          if (type === 'slime' && y > 40) continue;
        } else if (dim === 1) type = weighted(r, NETHER_HOSTILE);
        else if (dim === 2) { if (r.nextInt(4)) continue; type = 'enderman'; }
        else { if (r.nextInt(40)) continue; type = 'zephyr'; }
        const def = MOBS[type];
        let n = 0;
        for (let k = 0; k < 4 && n < (type === 'ghast' ? 1 : 4); k++) {
          const sx = x + r.nextInt(6) - r.nextInt(6), sz = z + r.nextInt(6) - r.nextInt(6);
          if (!world.isReady(sx, sz) || !far(sx, y, sz)) continue;
          if (def.fly) {
            if (!openAir(world, sx, y, sz, type === 'ghast' ? 2 : 1, type === 'ghast' ? 5 : 3)) continue;
            if (dim === 3 && world.getSky(sx, y, sz) < 15) continue;
          } else if (dim === 1 || dim === 2) {
            if (!standable(world, sx, y, sz, Math.ceil(def.h))) continue;
            const below = world.getBlock(sx, y - 1, sz);
            if (!OPAQUE[below] || below === B.bedrock || world.getBlock(sx, y, sz) !== 0) continue;
            if (dim === 1 && type !== 'zombie_pigman' && world.getBlockLight(sx, y, sz) > 11) continue;
          } else if (!E.canMonsterSpawn(world, sx, y, sz, type)) continue;
          if (type === 'spider' && !standable(world, sx + 1, y, sz, 1)) continue;
          spawnAt(world, type, sx, y, sz);
          n++;
        }
      }
    }
    // bats in caves
    if (dim === 0 && bats < 6 && world.totalTicks % 80 === 0) {
      const x = Math.floor(player.x) + r.nextInt(33) - 16, z = Math.floor(player.z) + r.nextInt(33) - 16, y = 8 + r.nextInt(52);
      if (world.isReady(x, z) && world.getBlock(x, y, z) === 0 && world.getBlock(x, y + 1, z) === 0 && world.getSky(x, y, z) === 0 && world.getBlockLight(x, y, z) < 4 && far(x, y, z)) spawnAt(world, 'bat', x, y, z);
    }
    if (passive < 20 && world.totalTicks % 400 === 0 && (dim === 0 || dim === 3)) {
      const cx = pcx + r.nextInt(17) - 8, cz = pcz + r.nextInt(17) - 8;
      const c = world.getChunk(cx, cz);
      if (!c || !c.lit) return;
      const x = cx * 16 + r.nextInt(16), z = cz * 16 + r.nextInt(16);
      const y = world.topSolidY(x, z);
      const ground = dim === 3 ? B.aether_grass : B.grass;
      const g = world.getBlock(x, y - 1, z);
      const biome = c.biomes ? c.biomes[((z & 15) << 4) | (x & 15)] : 0;
      if (g !== ground && !(dim === 0 && (g === B.sand || g === B.snow_layer || g === B.snow_block) && (biome === S.BIOME.DESERT || biome === S.BIOME.TUNDRA))) return;
      if (world.getSky(x, y, z) < 12) return;
      if ((x - player.x) ** 2 + (z - player.z) ** 2 < 24 * 24) return;
      let types;
      if (dim === 3) types = ['moa', 'phyg', 'flying_cow', 'aerbunny', 'sheepuff', 'moa'];
      else if (biome === S.BIOME.DESERT) types = ['rabbit'];
      else if (biome === S.BIOME.TUNDRA) types = ['polar_bear', 'rabbit', 'rabbit'];
      else if (biome === S.BIOME.FOREST) types = ['pig', 'cow', 'sheep', 'chicken', 'wolf', 'wolf'];
      else types = ['pig', 'cow', 'sheep', 'chicken', 'rabbit'];
      const type = types[r.nextInt(types.length)];
      for (let k = 0; k < 3; k++) {
        const sx = x + r.nextInt(5) - 2, sz = z + r.nextInt(5) - 2;
        const sy = world.topSolidY(sx, sz);
        const gb = world.getBlock(sx, sy - 1, sz);
        if ((gb === ground || gb === g) && standable(world, sx, sy, sz, 2)) E.spawnMob(world, type, sx + 0.5, sy, sz + 0.5);
      }
    }
  };
})();
