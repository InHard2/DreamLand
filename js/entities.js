/*
 * DreamLand - entities: physics, player, mobs & AI, pathfinding, items,
 * projectiles, TNT, falling blocks and natural spawning.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, R = S.R;
  const SOLID = S.SOLID, OPAQUE = S.OPAQUE, RENDER = S.RENDER;
  const I = () => DL.Items;
  const E = DL.Entities = {};
  let nextId = 1;

  /* ------------------------------------------------------------ */
  /* Block shapes                                                 */
  /* ------------------------------------------------------------ */
  function collisionBoxes(world, x, y, z, out) {
    const id = world.getBlock(x, y, z);
    if (!id || !SOLID[id]) return;
    const m = world.getMeta(x, y, z);
    switch (RENDER[id]) {
      case R.SLAB: out.push([x, y, z, x + 1, y + 0.5, z + 1]); return;
      case R.FARMLAND: out.push([x, y, z, x + 1, y + 15 / 16, z + 1]); return;
      case R.CACTUS: out.push([x + 1 / 16, y, z + 1 / 16, x + 15 / 16, y + 1, z + 15 / 16]); return;
      case R.STAIRS: {
        out.push([x, y, z, x + 1, y + 0.5, z + 1]);
        const d = m & 3;
        if (d === 0) out.push([x, y + 0.5, z, x + 1, y + 1, z + 0.5]);
        else if (d === 1) out.push([x, y + 0.5, z + 0.5, x + 1, y + 1, z + 1]);
        else if (d === 2) out.push([x, y + 0.5, z, x + 0.5, y + 1, z + 1]);
        else out.push([x + 0.5, y + 0.5, z, x + 1, y + 1, z + 1]);
        return;
      }
      case R.FENCE: {
        const c = S.fenceConnects;
        const x0 = c(world.getBlock(x - 1, y, z)) ? 0 : 0.375, x1 = c(world.getBlock(x + 1, y, z)) ? 1 : 0.625;
        const z0 = c(world.getBlock(x, y, z - 1)) ? 0 : 0.375, z1 = c(world.getBlock(x, y, z + 1)) ? 1 : 0.625;
        out.push([x + x0, y, z + z0, x + x1, y + 1.5, z + z1]);
        return;
      }
      case R.DOOR: {
        const b = S.doorBox(m);
        out.push([x + b[0] / 16, y, z + b[1] / 16, x + b[2] / 16, y + 1, z + b[3] / 16]);
        return;
      }
    }
    out.push([x, y, z, x + 1, y + 1, z + 1]);
  }
  E.collisionBoxes = collisionBoxes;

  function selectionBox(world, x, y, z) {
    const id = world.getBlock(x, y, z);
    if (!id || S.LIQUID[id]) return null;
    const m = world.getMeta(x, y, z);
    switch (RENDER[id]) {
      case R.CROSS: return [x + 0.2, y, z + 0.2, x + 0.8, y + (id === B.reeds ? 1 : 0.6), z + 0.8];
      case R.CROPS: return [x, y, z, x + 1, y + 0.25, z + 1];
      case R.TORCH: {
        const w = 0.15;
        if (m === 0) return [x + 0.5 - w / 1.5, y, z + 0.5 - w / 1.5, x + 0.5 + w / 1.5, y + 0.6, z + 0.5 + w / 1.5];
        const d = [null, [0, -1], [0, 1], [-1, 0], [1, 0]][m] || [0, 0];
        const cx = x + 0.5 + d[0] * 0.35, cz = z + 0.5 + d[1] * 0.35;
        return [cx - w, y + 0.2, cz - w, cx + w, y + 0.8, cz + w];
      }
      case R.SNOW: return [x, y, z, x + 1, y + 0.125, z + 1];
      case R.LADDER: {
        const e = 0.125;
        return [[x, y, z, x + 1, y + 1, z + e], [x, y, z + 1 - e, x + 1, y + 1, z + 1], [x, y, z, x + e, y + 1, z + 1], [x + 1 - e, y, z, x + 1, y + 1, z + 1]][m & 3];
      }
      case R.FIRE: return null;
    }
    const out = [];
    collisionBoxes(world, x, y, z, out);
    if (!out.length) return [x, y, z, x + 1, y + 1, z + 1];
    if (out.length === 1) { const b = out[0]; return [b[0], b[1], b[2], b[3], Math.min(b[4], y + 1), b[5]]; }
    let a = out[0].slice();
    for (const b of out) for (let i = 0; i < 3; i++) { a[i] = Math.min(a[i], b[i]); a[i + 3] = Math.max(a[i + 3], b[i + 3]); }
    return a;
  }
  E.selectionBox = selectionBox;

  function rayBox(ox, oy, oz, dx, dy, dz, b) {
    let tmin = -Infinity, tmax = Infinity, face = -1;
    const o = [ox, oy, oz], d = [dx, dy, dz];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < b[a] || o[a] > b[a + 3]) return null; continue; }
      let t1 = (b[a] - o[a]) / d[a], t2 = (b[a + 3] - o[a]) / d[a];
      let f1 = a === 0 ? 4 : a === 1 ? 0 : 2, f2 = f1 + 1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; const f = f1; f1 = f2; f2 = f; }
      if (t1 > tmin) { tmin = t1; face = f1; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (tmax < 0) return null;
    return { t: Math.max(0, tmin), face };
  }
  E.rayBox = rayBox;

  /** Voxel raycast: returns {x,y,z,face,t,px,py,pz} or null */
  E.raycast = function (world, ox, oy, oz, dx, dy, dz, maxDist, liquids) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = dx > 0 ? (x + 1 - ox) * tdx : (ox - x) * tdx;
    let ty = dy > 0 ? (y + 1 - oy) * tdy : (oy - y) * tdy;
    let tz = dz > 0 ? (z + 1 - oz) * tdz : (oz - z) * tdz;
    for (let i = 0; i < 200; i++) {
      const id = world.getBlock(x, y, z);
      if (id) {
        let box = null;
        if (liquids && S.LIQUID[id]) { if (world.getMeta(x, y, z) === 0) box = [x, y, z, x + 1, y + 1, z + 1]; }
        else box = selectionBox(world, x, y, z);
        if (box) {
          const h = rayBox(ox, oy, oz, dx, dy, dz, box);
          if (h && h.t <= maxDist) return { x, y, z, face: h.face, t: h.t, px: ox + dx * h.t, py: oy + dy * h.t, pz: oz + dz * h.t, box, id };
        }
      }
      if (tx < ty && tx < tz) { if (tx > maxDist) break; x += sx; tx += tdx; }
      else if (ty < tz) { if (ty > maxDist) break; y += sy; ty += tdy; }
      else { if (tz > maxDist) break; z += sz; tz += tdz; }
    }
    return null;
  };

  /* ------------------------------------------------------------ */
  /* Entity base                                                  */
  /* ------------------------------------------------------------ */
  class Entity {
    constructor(world, x, y, z) {
      this.id = nextId++;
      this.world = world;
      this.x = x; this.y = y; this.z = z;
      this.px = x; this.py = y; this.pz = z;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.yaw = 0; this.pitch = 0; this.pyaw = 0; this.ppitch = 0;
      this.w = 0.6; this.h = 1.8;
      this.onGround = false; this.collidedH = false; this.collidedV = false;
      this.inWater = false; this.inLava = false;
      this.fallDistance = 0; this.stepHeight = 0;
      this.dead = false; this.removed = false;
      this.age = 0; this.fire = 0;
      this.noClip = false;
    }
    get box() { const hw = this.w / 2; return [this.x - hw, this.y, this.z - hw, this.x + hw, this.y + this.h, this.z + hw]; }
    distTo(e) { return Math.hypot(e.x - this.x, e.y - this.y, e.z - this.z); }
    dist2(x, y, z) { return (x - this.x) ** 2 + (y - this.y) ** 2 + (z - this.z) ** 2; }
    setPos(x, y, z) { this.x = this.px = x; this.y = this.py = y; this.z = this.pz = z; }

    collectBoxes(b) {
      const out = [];
      const w = this.world;
      const x0 = Math.floor(b[0]), x1 = Math.floor(b[3]), y0 = Math.floor(b[1]) - 1, y1 = Math.floor(b[4]), z0 = Math.floor(b[2]), z1 = Math.floor(b[5]);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        if (!w.isReady(x, z)) { out.push([x, -64, z, x + 1, 256, z + 1]); continue; }
        for (let y = y0; y <= y1; y++) collisionBoxes(w, x, y, z, out);
      }
      return out;
    }

    move(dx, dy, dz) {
      if (this.noClip) { this.x += dx; this.y += dy; this.z += dz; return; }
      const odx = dx, ody = dy, odz = dz;
      if (this.onGround && this.sneaking && this.isPlayer) {
        const step = 0.05;
        const hw = this.w / 2;
        const test = (ddx, ddz) => this.collectBoxes([this.x - hw + ddx, this.y - 1, this.z - hw + ddz, this.x + hw + ddx, this.y, this.z + hw + ddz])
          .some(bb => bb[4] > this.y - 1 && bb[1] < this.y && bb[0] < this.x + hw + ddx && bb[3] > this.x - hw + ddx && bb[2] < this.z + hw + ddz && bb[5] > this.z - hw + ddz);
        while (dx !== 0 && !test(dx, 0)) { if (Math.abs(dx) < step) dx = 0; else dx += dx > 0 ? -step : step; }
        while (dz !== 0 && !test(0, dz)) { if (Math.abs(dz) < step) dz = 0; else dz += dz > 0 ? -step : step; }
      }
      const cdx = dx, cdz = dz;
      let bb = this.box;
      const boxes = this.collectBoxes([Math.min(bb[0], bb[0] + dx), Math.min(bb[1], bb[1] + dy), Math.min(bb[2], bb[2] + dz), Math.max(bb[3], bb[3] + dx), Math.max(bb[4], bb[4] + dy), Math.max(bb[5], bb[5] + dz)]);
      const res = sweep(bb, dx, dy, dz, boxes);
      let [rx, ry, rz] = res;
      // step up
      if (this.stepHeight > 0 && (this.onGround || (ry !== dy && dy < 0)) && (rx !== cdx || rz !== cdz)) {
        const up = this.stepHeight;
        const boxes2 = this.collectBoxes([Math.min(bb[0], bb[0] + cdx), bb[1], Math.min(bb[2], bb[2] + cdz), Math.max(bb[3], bb[3] + cdx), bb[4] + up, Math.max(bb[5], bb[5] + cdz)]);
        const r2 = sweep(bb, cdx, up, cdz, boxes2);
        // move down
        const bb2 = [bb[0] + r2[0], bb[1] + r2[1], bb[2] + r2[2], bb[3] + r2[0], bb[4] + r2[1], bb[5] + r2[2]];
        const r3 = sweep(bb2, 0, -r2[1] + (dy < 0 ? dy : 0), 0, boxes2);
        if (r2[0] * r2[0] + r2[2] * r2[2] > rx * rx + rz * rz) {
          rx = r2[0]; rz = r2[2]; ry = r2[1] + r3[1];
        }
      }
      this.x += rx; this.y += ry; this.z += rz;
      this.collidedH = rx !== cdx || rz !== cdz;
      this.collidedV = ry !== dy;
      this.onGround = ry !== dy && dy < 0;
      if (rx !== cdx) this.vx = 0;
      if (ry !== dy) this.vy = 0;
      if (rz !== cdz) this.vz = 0;
      if (this.onGround) {
        if (this.fallDistance > 0) { this.onLand(this.fallDistance); this.fallDistance = 0; }
      } else if (ry < 0) this.fallDistance -= ry;
      if (odx !== dx || odz !== dz) { /* sneaking edge */ }
    }
    onLand() { }

    updateLiquids() {
      const b = this.box;
      const w = this.world;
      let water = false, lava = false;
      let pushX = 0, pushZ = 0;
      for (let x = Math.floor(b[0] + 0.001); x <= Math.floor(b[3] - 0.001); x++)
        for (let y = Math.floor(b[1] + 0.4); y <= Math.floor(b[4] - 0.4); y++)
          for (let z = Math.floor(b[2] + 0.001); z <= Math.floor(b[5] - 0.001); z++) {
            const id = w.getBlock(x, y, z);
            if (id === B.water || id === B.lava) {
              const m = w.getMeta(x, y, z);
              const top = y + 1 - (m >= 8 ? 0 : (m + 1) / 9);
              if (b[1] + 0.4 < top) { if (id === B.water) water = true; else lava = true; }
              if (m > 0 && m < 8) {
                // push along decreasing level
                for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                  const n = w.getBlock(x + dx, y, z + dz);
                  const nm = n === id ? w.getMeta(x + dx, y, z + dz) : (SOLID[n] ? -1 : 8);
                  if (nm > m && nm < 9) { pushX += dx; pushZ += dz; }
                }
              }
            }
          }
      if (water && (pushX || pushZ)) { const l = Math.hypot(pushX, pushZ); this.vx += pushX / l * 0.014; this.vz += pushZ / l * 0.014; }
      this.inWater = water;
      this.inLava = lava;
      if (water) { this.fallDistance = 0; if (this.fire > 0) this.fire = 0; }
    }
    headInWater() {
      const ey = this.y + (this.eye || this.h * 0.85);
      const x = Math.floor(this.x), y = Math.floor(ey), z = Math.floor(this.z);
      if (this.world.getBlock(x, y, z) !== B.water) return false;
      const m = this.world.getMeta(x, y, z);
      return ey < y + 1 - (m >= 8 ? 0 : (m + 1) / 9) + 0.11;
    }
    brightness() {
      const x = Math.floor(this.x), y = Math.floor(this.y + this.h * 0.66), z = Math.floor(this.z);
      return [this.world.getSky(x, y, z), this.world.getBlockLight(x, y, z)];
    }
    tick() { this.age++; }
    serialize() { return null; }
  }
  E.Entity = Entity;

  function sweep(bb, dx, dy, dz, boxes) {
    // y first
    for (const o of boxes) {
      if (bb[3] > o[0] && bb[0] < o[3] && bb[5] > o[2] && bb[2] < o[5]) {
        if (dy > 0 && bb[4] <= o[1]) { const d = o[1] - bb[4]; if (d < dy) dy = d; }
        else if (dy < 0 && bb[1] >= o[4]) { const d = o[4] - bb[1]; if (d > dy) dy = d; }
      }
    }
    let b = [bb[0], bb[1] + dy, bb[2], bb[3], bb[4] + dy, bb[5]];
    for (const o of boxes) {
      if (b[4] > o[1] && b[1] < o[4] && b[5] > o[2] && b[2] < o[5]) {
        if (dx > 0 && b[3] <= o[0]) { const d = o[0] - b[3]; if (d < dx) dx = d; }
        else if (dx < 0 && b[0] >= o[3]) { const d = o[3] - b[0]; if (d > dx) dx = d; }
      }
    }
    b = [b[0] + dx, b[1], b[2], b[3] + dx, b[4], b[5]];
    for (const o of boxes) {
      if (b[4] > o[1] && b[1] < o[4] && b[3] > o[0] && b[0] < o[3]) {
        if (dz > 0 && b[5] <= o[2]) { const d = o[2] - b[5]; if (d < dz) dz = d; }
        else if (dz < 0 && b[2] >= o[5]) { const d = o[5] - b[2]; if (d > dz) dz = d; }
      }
    }
    return [Math.abs(dx) < 1e-7 ? 0 : dx, Math.abs(dy) < 1e-7 ? 0 : dy, Math.abs(dz) < 1e-7 ? 0 : dz];
  }

  /* ------------------------------------------------------------ */
  /* Living                                                       */
  /* ------------------------------------------------------------ */
  class Living extends Entity {
    constructor(world, x, y, z) {
      super(world, x, y, z);
      this.maxHealth = 20; this.health = 20;
      this.hurtTime = 0; this.hurtResist = 0; this.lastDamage = 0; this.deathTime = 0;
      this.limbSwing = 0; this.limbSwingAmount = 0; this.prevLimbAmount = 0;
      this.bodyYaw = 0; this.pbodyYaw = 0; this.headYaw = 0; this.pheadYaw = 0;
      this.moveForward = 0; this.moveStrafe = 0; this.jumping = false;
      this.stepHeight = 0.5;
      this.air = 300;
      this.swingProgress = 0; this.swingTicks = -1;
      this.attackedAtYaw = 0;
      this.livingSoundTime = 0;
    }
    get living() { return true; }
    isOnLadder() {
      return this.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)) === B.ladder;
    }
    heal(n) { if (this.health > 0) this.health = Math.min(this.maxHealth, this.health + n); }
    damage(src, amount, fromEntity) {
      if (this.health <= 0 || this.dead) return false;
      if (this.invulnerable) return false;
      if (this.hurtResist > 10) {
        if (amount <= this.lastDamage) return false;
        this.applyDamage(amount - this.lastDamage, src);
        this.lastDamage = amount;
      } else {
        this.lastDamage = amount;
        this.hurtResist = 20;
        this.applyDamage(amount, src);
        this.hurtTime = 10;
        this.attackedAtYaw = 0;
        if (fromEntity) {
          const dx = fromEntity.x - this.x, dz = fromEntity.z - this.z;
          this.knockBack(dx, dz);
          this.attackedAtYaw = Math.atan2(dz, dx);
        }
        this.onHurt(src, fromEntity);
      }
      if (this.health <= 0) this.onDeath(src, fromEntity);
      return true;
    }
    applyDamage(a) { this.health -= a; }
    onHurt() { }
    knockBack(dx, dz) {
      const f = Math.hypot(dx, dz) || 1;
      this.vx /= 2; this.vy /= 2; this.vz /= 2;
      this.vx -= dx / f * 0.4; this.vy += 0.4; this.vz -= dz / f * 0.4;
      if (this.vy > 0.4) this.vy = 0.4;
    }
    onDeath(src, killer) { this.deathTime = 0; }
    onLand(dist) {
      const d = Math.ceil(dist - 3);
      if (d > 0 && !this.inWater) {
        this.damage('fall', d);
        const bx = Math.floor(this.x), by = Math.floor(this.y - 0.2), bz = Math.floor(this.z);
        const b = this.world.getBlock(bx, by, bz);
        if (b && this.world.fx) this.world.fx.sound(d > 4 ? 'fallbig' : 'fallsmall', this.x, this.y, this.z, 1, 1);
      }
    }
    swing() { if (this.swingTicks < 0 || this.swingTicks >= 3) { this.swingTicks = 0; } }
    travel(strafe, forward) {
      if (this.inWater) {
        this.moveRelative(strafe, forward, 0.02);
        this.move(this.vx, this.vy, this.vz);
        this.vx *= 0.8; this.vy *= 0.8; this.vz *= 0.8; this.vy -= 0.02;
        if (this.collidedH && this.isOffsetFree(this.vx, this.vy + 0.6 - this.y + this.py, this.vz)) this.vy = 0.3;
      } else if (this.inLava) {
        this.moveRelative(strafe, forward, 0.02);
        this.move(this.vx, this.vy, this.vz);
        this.vx *= 0.5; this.vy *= 0.5; this.vz *= 0.5; this.vy -= 0.02;
        if (this.collidedH && this.isOffsetFree(this.vx, this.vy + 0.6 - this.y + this.py, this.vz)) this.vy = 0.3;
      } else {
        let fr = 0.91;
        if (this.onGround) {
          const b = this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.5), Math.floor(this.z));
          fr = (b && S.blocks[b] ? S.blocks[b].slip : 0.6) * 0.91;
        }
        const acc = this.onGround ? 0.1 * (0.16277136 / (fr * fr * fr)) : 0.02;
        this.moveRelative(strafe, forward, acc * (this.speedMul || 1));
        if (this.onGround) {
          const b = this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.5), Math.floor(this.z));
          fr = (b && S.blocks[b] ? S.blocks[b].slip : 0.6) * 0.91;
        }
        const ladder = this.isOnLadder();
        if (ladder) {
          if (this.vx < -0.15) this.vx = -0.15; if (this.vx > 0.15) this.vx = 0.15;
          if (this.vz < -0.15) this.vz = -0.15; if (this.vz > 0.15) this.vz = 0.15;
          this.fallDistance = 0;
          if (this.vy < -0.15) this.vy = -0.15;
          if (this.sneaking && this.vy < 0) this.vy = 0;
        }
        this.move(this.vx, this.vy, this.vz);
        if (this.collidedH && ladder) this.vy = 0.2;
        this.vy -= 0.08;
        this.vy *= 0.98;
        this.vx *= fr; this.vz *= fr;
      }
      this.prevLimbAmount = this.limbSwingAmount;
      const dx = this.x - this.px, dz = this.z - this.pz;
      let f = Math.hypot(dx, dz) * 4;
      if (f > 1) f = 1;
      this.limbSwingAmount += (f - this.limbSwingAmount) * 0.4;
      this.limbSwing += this.limbSwingAmount;
    }
    isOffsetFree(dx, dy, dz) {
      const b = this.box;
      const bb = [b[0] + dx, b[1] + dy, b[2] + dz, b[3] + dx, b[4] + dy, b[5] + dz];
      const boxes = this.collectBoxes(bb);
      for (const o of boxes) if (bb[3] > o[0] && bb[0] < o[3] && bb[4] > o[1] && bb[1] < o[4] && bb[5] > o[2] && bb[2] < o[5]) return false;
      return true;
    }
    moveRelative(strafe, forward, speed) {
      let d = Math.hypot(strafe, forward);
      if (d < 0.01) return;
      if (d < 1) d = 1;
      d = speed / d;
      strafe *= d; forward *= d;
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      this.vx += strafe * c - forward * s;
      this.vz += -strafe * s - forward * c;
    }
    baseTick() {
      this.px = this.x; this.py = this.y; this.pz = this.z;
      this.pyaw = this.yaw; this.ppitch = this.pitch;
      this.pbodyYaw = this.bodyYaw; this.pheadYaw = this.headYaw;
      this.age++;
      if (this.hurtTime > 0) this.hurtTime--;
      if (this.hurtResist > 0) this.hurtResist--;
      if (this.swingTicks >= 0) { this.swingTicks++; if (this.swingTicks >= 6) this.swingTicks = -1; }
      this.swingProgress = this.swingTicks >= 0 ? this.swingTicks / 6 : 0;
      this.updateLiquids();
      if (this.inLava) { this.damage('lava', 4); this.fire = 600; }
      if (this.fire > 0) {
        if (this.fire % 20 === 0 && !this.fireImmune) this.damage('fire', 1);
        this.fire--;
      }
      const bx = Math.floor(this.x), bz = Math.floor(this.z);
      if (this.world.getBlock(bx, Math.floor(this.y), bz) === B.fire || this.world.getBlock(bx, Math.floor(this.y + 0.5), bz) === B.fire) {
        this.damage('fire', 1);
        if (this.fire < 160) this.fire = 160;
      }
      // cactus
      const b = this.box;
      for (let x = Math.floor(b[0] - 0.05); x <= Math.floor(b[3] + 0.05); x++)
        for (let z = Math.floor(b[2] - 0.05); z <= Math.floor(b[5] + 0.05); z++)
          for (let y = Math.floor(b[1]); y <= Math.floor(b[4]); y++)
            if (this.world.getBlock(x, y, z) === B.cactus) this.damage('cactus', 1);
      // air
      if (this.headInWater() && !this.waterBreather) {
        this.air--;
        if (this.air <= -20) {
          this.air = 0;
          this.damage('drown', 2);
          if (this.world.fx) this.world.fx.particles('bubble', this.x, this.y + this.h * 0.8, this.z, 8, 0.3);
        }
      } else this.air = 300;
      // suffocation
      const hy = Math.floor(this.y + (this.eye || this.h * 0.85));
      const hid = this.world.getBlock(bx, hy, bz);
      if (OPAQUE[hid] && SOLID[hid] && this.health > 0 && this.world.isReady(bx, bz)) this.damage('suffocate', 1);
      if (this.y < -64) this.damage('void', 4);
    }
    updateBodyYaw() {
      const dx = this.x - this.px, dz = this.z - this.pz;
      let target = this.bodyYaw;
      if (dx * dx + dz * dz > 0.0025) target = Math.atan2(-dx, -dz);
      if (this.swingProgress > 0) target = this.yaw;
      let d = DL.wrapAngle(target - this.bodyYaw);
      this.bodyYaw += d * 0.3;
      let hd = DL.wrapAngle(this.yaw - this.bodyYaw);
      const lim = Math.PI * 75 / 180;
      if (hd < -lim) this.bodyYaw = this.yaw + lim;
      if (hd > lim) this.bodyYaw = this.yaw - lim;
      this.bodyYaw = DL.wrapAngle(this.bodyYaw);
      this.headYaw = this.yaw;
    }
  }
  E.Living = Living;

  /* ------------------------------------------------------------ */
  /* Player                                                       */
  /* ------------------------------------------------------------ */
  class Player extends Living {
    constructor(world, x, y, z) {
      super(world, x, y, z);
      this.isPlayer = true;
      this.type = 'player';
      this.w = 0.6; this.h = 1.8; this.eye = 1.62;
      this.inv = new Array(36).fill(null);
      this.armor = new Array(4).fill(null);
      this.craft = new Array(4).fill(null);
      this.cursor = null;
      this.selected = 0;
      this.sneaking = false;
      this.score = 0;
      this.stepDist = 0; this.nextStep = 1;
      this.bob = 0; this.pbob = 0; this.cameraTilt = 0; this.pcameraTilt = 0;
      this.dig = null;
      this.useCooldown = 0;
      this.attackCooldown = 0;
      this.spawnPoint = null;
      this.regenTimer = 0;
      this.equipProgress = 1; this.pequipProgress = 1; this.equippedStack = null;
      this.deathScreen = false;
    }
    get held() { return this.inv[this.selected]; }
    set held(s) { this.inv[this.selected] = s; }
    get heldItem() { return !!this.inv[this.selected]; }
    armorValue() {
      let pts = 0;
      for (let i = 0; i < 4; i++) {
        const s = this.armor[i];
        if (!s) continue;
        const d = I().get(s.id);
        if (!d.armor) continue;
        pts += d.armor.points * (1 - (s.dmg || 0) / d.maxDamage);
      }
      return Math.round(pts);
    }
    damage(src, amount, from) {
      if (this.creative && src !== 'void') return false;
      return super.damage(src, amount, from);
    }
    fly(str, fwd) {
      this.fallDistance = 0;
      this.moveRelative(str, fwd, this.sprintFly ? 0.35 : 0.22);
      if (this.jumping) this.vy = 0.42;
      else if (this.sneaking) this.vy = -0.42;
      else this.vy *= 0.5;
      this.move(this.vx, this.vy, this.vz);
      this.vx *= 0.55; this.vz *= 0.55;
      if (this.onGround && this.sneaking) this.flying = false;
      this.prevLimbAmount = this.limbSwingAmount;
      this.limbSwingAmount *= 0.6;
    }
    applyDamage(a, src) {
      if (src !== 'drown' && src !== 'fire' && src !== 'fall' && src !== 'void' && src !== 'suffocate') {
        const armor = this.armorValue();
        if (armor > 0) {
          const total = a * (25 - armor) + (this.armorCarry || 0);
          a = Math.floor(total / 25);
          this.armorCarry = total % 25;
          for (let i = 0; i < 4; i++) {
            const s = this.armor[i];
            if (!s) continue;
            s.dmg = (s.dmg || 0) + Math.max(1, Math.floor(a / 2) || 1);
            if (s.dmg >= I().get(s.id).maxDamage) { this.armor[i] = null; if (this.world.fx) this.world.fx.sound('break', this.x, this.y, this.z, 1, 1); }
          }
        }
      }
      this.health -= a;
      if (this.world.fx) this.world.fx.playerHurt(this, a, src);
    }
    onDeath(src) {
      this.deathTime = 0;
      this.dropInventory();
      if (this.world.fx) this.world.fx.playerDied(this, src);
    }
    dropInventory() {
      const all = [...this.inv, ...this.armor, ...this.craft, this.cursor];
      for (const s of all) if (s && s.count > 0) this.world.spawnItem(this.x, this.y + 1.2, this.z, s, true);
      this.inv.fill(null); this.armor.fill(null); this.craft.fill(null); this.cursor = null;
    }
    tick() {
      this.baseTick();
      if (this.health <= 0) {
        this.deathTime++;
        this.moveForward = this.moveStrafe = 0;
        this.travel(0, 0);
        return;
      }
      if (this.world.difficulty === 0 && ++this.regenTimer >= 20) { this.regenTimer = 0; this.heal(1); }
      let fwd = this.moveForward, str = this.moveStrafe;
      if (this.sneaking) { fwd *= 0.3; str *= 0.3; }
      if (this.jumping) {
        if (this.inWater || this.inLava) this.vy += 0.04;
        else if (this.onGround && this.jumpCooldown <= 0) { this.vy = 0.42; this.jumpCooldown = 10; }
      } else this.jumpCooldown = 0;
      if (this.jumpCooldown > 0) this.jumpCooldown--;
      if (this.flying) this.fly(str, fwd);
      else this.travel(str * 0.98, fwd * 0.98);
      // view bob
      this.pbob = this.bob; this.pcameraTilt = this.cameraTilt;
      let hs = Math.hypot(this.x - this.px, this.z - this.pz);
      let tilt = Math.atan(-this.vy * 0.2) * 15;
      if (hs > 0.1) hs = 0.1;
      if (!this.onGround || this.health <= 0) hs = 0;
      if (this.onGround || this.health <= 0) tilt = 0;
      this.bob += (hs - this.bob) * 0.4;
      this.cameraTilt += (tilt - this.cameraTilt) * 0.8;
      // footsteps
      if (this.onGround && !this.sneaking) {
        this.stepDist += Math.hypot(this.x - this.px, this.z - this.pz) * 0.6;
        if (this.stepDist > this.nextStep) {
          this.nextStep = this.stepDist + 1;
          const b = this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
          if (b && this.world.fx) this.world.fx.step(this, b);
        }
      }
      if (this.inWater && !this.wasInWater && this.world.fx) this.world.fx.splash(this);
      this.wasInWater = this.inWater;
      this.updateBodyYaw();
      this.headYaw = this.yaw;
      // pick up items
      this.pickupItems();
      // equip animation
      this.pequipProgress = this.equipProgress;
      const held = this.held;
      const same = held === this.equippedStack || (held && this.equippedStack && held.id === this.equippedStack.id);
      const target = same ? 1 : 0;
      const d = Math.max(-0.4, Math.min(0.4, target - this.equipProgress));
      this.equipProgress += d;
      if (this.equipProgress < 0.1) this.equippedStack = held;
      if (this.useCooldown > 0) this.useCooldown--;
      if (this.attackCooldown > 0) this.attackCooldown--;
    }
    pickupItems() {
      const b = this.box;
      const bb = [b[0] - 1, b[1] - 0.5, b[2] - 1, b[3] + 1, b[4] + 0.5, b[5] + 1];
      for (const e of this.world.entities) {
        if (e.removed) continue;
        if (e instanceof ItemEntity) {
          if (e.pickupDelay > 0) continue;
          if (e.x < bb[0] || e.x > bb[3] || e.y < bb[1] || e.y > bb[4] || e.z < bb[2] || e.z > bb[5]) continue;
          const before = e.stack.count;
          const left = this.addItem(e.stack);
          if (left === null || left.count < before) {
            if (this.world.fx) this.world.fx.pickup(e, this);
            if (left === null) { e.removed = true; } else e.stack = left;
          }
        } else if (e instanceof Arrow && e.inGround && e.fromPlayer && e.shake <= 0) {
          if (Math.abs(e.x - this.x) < 1.5 && Math.abs(e.z - this.z) < 1.5 && e.y > b[1] - 1 && e.y < b[4] + 1) {
            if (this.addItem(I().stack(262)) === null) { if (this.world.fx) this.world.fx.pickup(e, this); e.removed = true; }
          }
        }
      }
    }
    /** Adds a stack to the inventory. Returns remainder or null. */
    addItem(stack) {
      let s = I().copy(stack);
      const max = I().maxStack(s.id);
      const order = [];
      for (let i = 0; i < 36; i++) order.push(i);
      for (const i of order) {
        const t = this.inv[i];
        if (t && I().same(t, s) && t.count < max) {
          const n = Math.min(max - t.count, s.count);
          t.count += n; s.count -= n;
          if (s.count <= 0) return null;
        }
      }
      for (const i of order) {
        if (!this.inv[i]) {
          const n = Math.min(max, s.count);
          this.inv[i] = I().stack(s.id, n, s.dmg);
          s.count -= n;
          if (s.count <= 0) return null;
        }
      }
      return s;
    }
    countItem(id) { let n = 0; for (const s of this.inv) if (s && s.id === id) n += s.count; return n; }
    consumeHeld(n) {
      const s = this.held;
      if (!s) return;
      s.count -= n || 1;
      if (s.count <= 0) this.held = null;
    }
    damageHeld(n) {
      if (this.creative) return;
      const s = this.held;
      if (!s) return;
      const d = I().get(s.id);
      if (!d || !d.maxDamage) return;
      s.dmg = (s.dmg || 0) + n;
      if (s.dmg >= d.maxDamage) {
        this.held = null;
        if (this.world.fx) { this.world.fx.sound('break', this.x, this.y, this.z, 0.8, 0.8 + Math.random() * 0.4); this.world.fx.toolBreak(this, s); }
      }
    }
    dropItem(stack, far) {
      const e = new ItemEntity(this.world, this.x, this.y + this.eye - 0.3, this.z, stack);
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw), ps = Math.sin(this.pitch), pc = Math.cos(this.pitch);
      const f = 0.3;
      e.vx = -s * pc * f; e.vz = -c * pc * f; e.vy = ps * f + 0.1;
      const a = Math.random() * Math.PI * 2, r = 0.02 * Math.random();
      e.vx += Math.cos(a) * r; e.vz += Math.sin(a) * r; e.vy += (Math.random() - Math.random()) * 0.1;
      e.pickupDelay = 40;
      this.world.entities.push(e);
    }
    look() {
      const cp = Math.cos(this.pitch);
      return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
    }
    serialize() {
      return {
        x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, health: this.health, air: this.air, flying: !!this.flying,
        inv: this.inv, armor: this.armor, selected: this.selected, score: this.score, spawn: this.spawnPoint, fire: this.fire
      };
    }
    restore(d) {
      this.setPos(d.x, d.y, d.z);
      this.yaw = d.yaw || 0; this.pitch = d.pitch || 0; this.health = d.health === undefined ? 20 : d.health;
      this.inv = (d.inv || []).concat(new Array(36).fill(null)).slice(0, 36);
      this.armor = (d.armor || []).concat(new Array(4).fill(null)).slice(0, 4);
      this.selected = d.selected || 0; this.score = d.score || 0; this.spawnPoint = d.spawn || null;
      this.fire = d.fire || 0;
      this.flying = !!d.flying;
      if (this.health <= 0) this.health = 20;
    }
  }
  E.Player = Player;

  /* ------------------------------------------------------------ */
  /* Item entity                                                  */
  /* ------------------------------------------------------------ */
  class ItemEntity extends Entity {
    constructor(world, x, y, z, stack) {
      super(world, x, y, z);
      this.type = 'item';
      this.stack = stack;
      this.w = 0.25; this.h = 0.25;
      this.pickupDelay = 10;
      this.bobOffset = Math.random() * Math.PI * 2;
      this.rot = Math.random() * Math.PI * 2;
      this.health = 5;
    }
    tick() {
      this.px = this.x; this.py = this.y; this.pz = this.z;
      this.age++;
      if (this.pickupDelay > 0) this.pickupDelay--;
      this.vy -= 0.04;
      const bx = Math.floor(this.x), by = Math.floor(this.y), bz = Math.floor(this.z);
      const inb = this.world.getBlock(bx, by, bz);
      if (inb === B.lava) { this.vy = 0.2; this.vx = (Math.random() - Math.random()) * 0.2; this.vz = (Math.random() - Math.random()) * 0.2; if (this.world.fx) this.world.fx.sound('fizz', this.x, this.y, this.z, 0.4, 2); this.removed = true; return; }
      if (OPAQUE[inb] && SOLID[inb] && this.world.isReady(bx, bz)) this.pushOut(bx, by, bz);
      if (inb === B.water) { this.vy += 0.035; this.vx *= 0.95; this.vz *= 0.95; }
      this.move(this.vx, this.vy, this.vz);
      let fr = 0.98;
      if (this.onGround) {
        fr = 0.588;
        const b = this.world.getBlock(bx, Math.floor(this.y - 0.1), bz);
        if (b && S.blocks[b]) fr = S.blocks[b].slip * 0.98;
      }
      this.vx *= fr; this.vy *= 0.98; this.vz *= fr;
      if (this.onGround) this.vy *= -0.5;
      if (this.age >= 6000) this.removed = true;
      // merge with nearby identical stacks
      if (this.age % 20 === 0) {
        for (const e of this.world.entities) {
          if (e === this || !(e instanceof ItemEntity) || e.removed) continue;
          if (Math.abs(e.x - this.x) > 0.5 || Math.abs(e.y - this.y) > 0.5 || Math.abs(e.z - this.z) > 0.5) continue;
          if (!I().same(e.stack, this.stack)) continue;
          const max = I().maxStack(this.stack.id);
          if (e.stack.count + this.stack.count > max) continue;
          e.stack.count += this.stack.count; e.age = Math.min(e.age, this.age);
          this.removed = true; break;
        }
      }
    }
    pushOut(bx, by, bz) {
      const dirs = [[0, 1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, -1, 0]];
      for (const [dx, dy, dz] of dirs) {
        if (!OPAQUE[this.world.getBlock(bx + dx, by + dy, bz + dz)]) {
          this.vx = dx * 0.1; this.vy = dy * 0.1 + (dy === 0 ? 0.05 : 0); this.vz = dz * 0.1;
          this.x += dx * 0.1; this.y += dy * 0.1; this.z += dz * 0.1;
          return;
        }
      }
    }
    serialize() { return { type: 'item', x: this.x, y: this.y, z: this.z, stack: this.stack, age: this.age }; }
  }
  E.ItemEntity = ItemEntity;

  /* ------------------------------------------------------------ */
  /* Projectiles                                                  */
  /* ------------------------------------------------------------ */
  class Projectile extends Entity {
    constructor(world, x, y, z, shooter) {
      super(world, x, y, z);
      this.shooter = shooter;
      this.w = 0.25; this.h = 0.25;
      this.gravity = 0.03; this.drag = 0.99;
      this.inGround = false;
    }
    shoot(dx, dy, dz, speed, spread) {
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      dx += (Math.random() * 2 - 1) * 0.0075 * spread; dy += (Math.random() * 2 - 1) * 0.0075 * spread; dz += (Math.random() * 2 - 1) * 0.0075 * spread;
      this.vx = dx * speed; this.vy = dy * speed; this.vz = dz * speed;
      this.yaw = Math.atan2(-this.vx, -this.vz);
      this.pitch = Math.atan2(this.vy, Math.hypot(this.vx, this.vz));
      this.pyaw = this.yaw; this.ppitch = this.pitch;
    }
    tick() {
      this.px = this.x; this.py = this.y; this.pz = this.z; this.pyaw = this.yaw; this.ppitch = this.pitch;
      this.age++;
      if (this.inGround) { this.groundTick(); return; }
      const speed = Math.hypot(this.vx, this.vy, this.vz);
      const hit = E.raycast(this.world, this.x, this.y, this.z, this.vx / (speed || 1), this.vy / (speed || 1), this.vz / (speed || 1), speed, false);
      let maxT = hit ? hit.t : speed;
      // entity hit
      let best = null, bestT = maxT;
      for (const e of this.world.entities) {
        if (!e.living || e === this.shooter && this.age < 5 || e.health <= 0 || e.removed) continue;
        const b = e.box;
        const bb = [b[0] - 0.3, b[1] - 0.3, b[2] - 0.3, b[3] + 0.3, b[4] + 0.3, b[5] + 0.3];
        const h = rayBox(this.x, this.y, this.z, this.vx / (speed || 1), this.vy / (speed || 1), this.vz / (speed || 1), bb);
        if (h && h.t <= bestT) { best = e; bestT = h.t; }
      }
      if (best) { this.hitEntity(best); return; }
      if (hit) {
        this.x = hit.px; this.y = hit.py; this.z = hit.pz;
        this.hitBlock(hit);
        return;
      }
      this.x += this.vx; this.y += this.vy; this.z += this.vz;
      this.yaw = Math.atan2(-this.vx, -this.vz);
      this.pitch = Math.atan2(this.vy, Math.hypot(this.vx, this.vz));
      let drag = this.drag;
      if (this.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)) === B.water) {
        drag = 0.8;
        if (this.world.fx && this.age % 3 === 0) this.world.fx.particles('bubble', this.x, this.y, this.z, 2, 0.1);
      }
      this.vx *= drag; this.vy *= drag; this.vz *= drag; this.vy -= this.gravity;
      if (this.age > 1200 || this.y < -10) this.removed = true;
    }
    groundTick() { }
    hitEntity() { this.removed = true; }
    hitBlock() { this.removed = true; }
  }
  class Arrow extends Projectile {
    constructor(world, x, y, z, shooter) {
      super(world, x, y, z, shooter);
      this.type = 'arrow';
      this.gravity = 0.03;
      this.fromPlayer = shooter && shooter.isPlayer;
      this.shake = 0;
      this.groundTime = 0;
    }
    hitEntity(e) {
      const speed = Math.hypot(this.vx, this.vy, this.vz);
      const dmg = Math.ceil(speed * 2);
      if (e.damage('arrow', Math.max(2, dmg), this.shooter || this)) {
        if (this.world.fx) this.world.fx.sound('arrowhit', this.x, this.y, this.z, 1, 1.2 / (Math.random() * 0.2 + 0.9));
        this.removed = true;
      } else {
        this.vx *= -0.1; this.vy *= -0.1; this.vz *= -0.1; this.yaw += Math.PI;
      }
    }
    hitBlock(hit) {
      this.inGround = true; this.vx = this.vy = this.vz = 0; this.shake = 7;
      this.stuck = [hit.x, hit.y, hit.z, hit.id];
      if (this.world.fx) this.world.fx.sound('arrowhit', this.x, this.y, this.z, 1, 1.2 / (Math.random() * 0.2 + 0.9));
    }
    groundTick() {
      if (this.shake > 0) this.shake--;
      const [x, y, z, id] = this.stuck;
      if (this.world.getBlock(x, y, z) !== id) { this.inGround = false; this.vy = -0.05; return; }
      if (++this.groundTime > 1200) this.removed = true;
    }
  }
  E.Arrow = Arrow;
  class Thrown extends Projectile {
    constructor(world, x, y, z, shooter, kind) {
      super(world, x, y, z, shooter);
      this.type = 'thrown'; this.kind = kind;
    }
    hitEntity(e) { e.damage('thrown', 0, this.shooter || this); this.impact(); }
    hitBlock() { this.impact(); }
    impact() {
      if (this.kind === 'egg' && Math.random() < 1 / 8) {
        const n = Math.random() < 1 / 32 ? 4 : 1;
        for (let i = 0; i < n; i++) E.spawnMob(this.world, 'chicken', this.x, this.y, this.z, { baby: true });
      }
      if (this.world.fx) this.world.fx.particles(this.kind === 'egg' ? 'egg' : 'snowball', this.x, this.y, this.z, 8, 0.1);
      this.removed = true;
    }
  }
  E.Thrown = Thrown;

  /* ------------------------------------------------------------ */
  /* Primed TNT & falling blocks                                  */
  /* ------------------------------------------------------------ */
  class PrimedTNT extends Entity {
    constructor(world, x, y, z, fuse) {
      super(world, x, y, z);
      this.type = 'tnt'; this.w = 0.98; this.h = 0.98; this.fuse = fuse;
      const a = Math.random() * Math.PI * 2;
      this.vx = -Math.sin(a) * 0.02; this.vy = 0.2; this.vz = -Math.cos(a) * 0.02;
    }
    tick() {
      this.px = this.x; this.py = this.y; this.pz = this.z;
      this.age++;
      this.vy -= 0.04;
      this.move(this.vx, this.vy, this.vz);
      this.vx *= 0.98; this.vy *= 0.98; this.vz *= 0.98;
      if (this.onGround) { this.vx *= 0.7; this.vz *= 0.7; this.vy *= -0.5; }
      if (this.world.fx && this.age % 2 === 0) this.world.fx.particles('smoke', this.x, this.y + 1.1, this.z, 1, 0);
      if (--this.fuse <= 0) {
        this.removed = true;
        this.world.explode(this.x, this.y + 0.49, this.z, 4, this);
      }
    }
  }
  E.PrimedTNT = PrimedTNT;
  class FallingBlock extends Entity {
    constructor(world, x, y, z, block) {
      super(world, x, y, z);
      this.type = 'falling'; this.block = block; this.w = 0.98; this.h = 0.98;
    }
    tick() {
      this.px = this.x; this.py = this.y; this.pz = this.z;
      this.age++;
      this.vy -= 0.04;
      this.move(this.vx, this.vy, this.vz);
      this.vx *= 0.98; this.vy *= 0.98; this.vz *= 0.98;
      const bx = Math.floor(this.x), by = Math.floor(this.y), bz = Math.floor(this.z);
      if (this.onGround) {
        this.removed = true;
        const cur = this.world.getBlock(bx, by, bz);
        if (cur === 0 || S.REPLACE[cur]) {
          this.world.setBlock(bx, by, bz, this.block, 0, 3);
        } else this.world.spawnItem(this.x, this.y + 0.5, this.z, I().stack(this.block), false);
      } else if (this.age > 100 && (by < 1 || by > 127)) {
        this.removed = true;
        this.world.spawnItem(this.x, this.y + 0.5, this.z, I().stack(this.block), false);
      }
    }
  }
  E.FallingBlock = FallingBlock;

  /* ------------------------------------------------------------ */
  /* Pathfinding (A*)                                             */
  /* ------------------------------------------------------------ */
  function passable(w, x, y, z) {
    const b = w.getBlock(x, y, z);
    if (b === B.lava || b === B.fire || b === B.cactus) return false;
    if (b === B.fence) return false;
    if (b === B.wooden_door) return (w.getMeta(x, y, z) & 4) !== 0 && false;
    return !SOLID[b];
  }
  function standable(w, x, y, z, h) {
    for (let k = 0; k < h; k++) if (!passable(w, x, y + k, z)) return false;
    const below = w.getBlock(x, y - 1, z);
    if (below === B.fence || below === B.cactus || below === B.lava) return false;
    if (SOLID[below]) return true;
    if (w.getBlock(x, y, z) === B.water || below === B.water) return true;
    return false;
  }
  function Heap() { this.a = []; }
  Heap.prototype.push = function (n) {
    const a = this.a; a.push(n); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= n.f) break; a[i] = a[p]; i = p; }
    a[i] = n;
  };
  Heap.prototype.pop = function () {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        let mf = last.f;
        if (l < a.length && a[l].f < mf) { m = l; mf = a[l].f; }
        if (r < a.length && a[r].f < mf) { m = r; }
        if (m === i) break;
        a[i] = a[m]; i = m;
      }
      a[i] = last;
    }
    return top;
  };
  E.findPath = function (w, mob, tx, ty, tz, maxNodes, range) {
    const h = Math.max(1, Math.ceil(mob.h));
    let sx = Math.floor(mob.x), sy = Math.floor(mob.y + 0.001), sz = Math.floor(mob.z);
    if (!standable(w, sx, sy, sz, h)) { if (standable(w, sx, sy + 1, sz, h)) sy++; }
    tx = Math.floor(tx); ty = Math.floor(ty); tz = Math.floor(tz);
    const key = (x, y, z) => ((x - sx + 512) * 1024 + (z - sz + 512)) * 256 + y;
    const nodes = new Map();
    const heap = new Heap();
    const hfn = (x, y, z) => Math.hypot(x - tx, (y - ty) * 1.2, z - tz);
    const start = { x: sx, y: sy, z: sz, g: 0, f: hfn(sx, sy, sz), parent: null, closed: false, h: hfn(sx, sy, sz) };
    nodes.set(key(sx, sy, sz), start);
    heap.push(start);
    let best = start, count = 0;
    while (heap.a.length && count < maxNodes) {
      const n = heap.pop();
      if (n.closed) continue;
      n.closed = true; count++;
      if (n.h < best.h) best = n;
      if (Math.abs(n.x - tx) <= 0 && Math.abs(n.z - tz) <= 0 && Math.abs(n.y - ty) <= 1) { best = n; break; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = n.x + dx, nz = n.z + dz;
        if (Math.abs(nx - sx) > range || Math.abs(nz - sz) > range) continue;
        let ny = null, cost = 1;
        if (standable(w, nx, n.y, nz, h)) ny = n.y;
        else if (standable(w, nx, n.y + 1, nz, h) && passable(w, n.x, n.y + h, n.z)) { ny = n.y + 1; cost = 2; }
        else if (passable(w, nx, n.y, nz)) {
          for (let d = 1; d <= 3; d++) {
            if (!passable(w, nx, n.y - d + h - 1, nz)) break;
            if (standable(w, nx, n.y - d, nz, h)) { ny = n.y - d; cost = 1 + d * 0.5; break; }
          }
        }
        if (ny === null) continue;
        if (w.getBlock(nx, ny, nz) === B.water) cost += mob.avoidWater ? 6 : 1;
        const k = key(nx, ny, nz);
        let m = nodes.get(k);
        const g = n.g + cost;
        if (m && (m.closed || m.g <= g)) continue;
        const hh = hfn(nx, ny, nz);
        if (!m) { m = { x: nx, y: ny, z: nz, closed: false }; nodes.set(k, m); }
        m.g = g; m.h = hh; m.f = g + hh; m.parent = n;
        heap.push(m);
      }
    }
    const path = [];
    for (let n = best; n; n = n.parent) path.unshift(n);
    if (path.length <= 1) return null;
    path.shift();
    return path;
  };

  /* ------------------------------------------------------------ */
  /* Mobs                                                         */
  /* ------------------------------------------------------------ */
  const MOBS = {
    pig: { w: 0.9, h: 0.9, hp: 10, speed: 0.7, hostile: false, sound: 'pig', model: 'pig' },
    cow: { w: 0.9, h: 1.3, hp: 10, speed: 0.7, hostile: false, sound: 'cow', model: 'cow' },
    sheep: { w: 0.9, h: 1.3, hp: 8, speed: 0.7, hostile: false, sound: 'sheep', model: 'sheep' },
    chicken: { w: 0.3, h: 0.7, hp: 4, speed: 0.7, hostile: false, sound: 'chicken', model: 'chicken' },
    zombie: { w: 0.6, h: 1.8, hp: 20, speed: 0.5, hostile: true, attack: 5, sound: 'zombie', model: 'zombie', burns: true },
    skeleton: { w: 0.6, h: 1.8, hp: 20, speed: 0.7, hostile: true, attack: 4, sound: 'skeleton', model: 'skeleton', burns: true, ranged: true },
    creeper: { w: 0.6, h: 1.7, hp: 20, speed: 0.7, hostile: true, sound: null, model: 'creeper' },
    spider: { w: 1.4, h: 0.9, hp: 16, speed: 0.8, hostile: true, attack: 2, sound: 'spider', model: 'spider' }
  };
  E.MOBS = MOBS;

  class Mob extends Living {
    constructor(world, x, y, z, type) {
      super(world, x, y, z);
      const d = MOBS[type];
      this.type = type; this.def = d;
      this.w = d.w; this.h = d.h; this.maxHealth = this.health = d.hp;
      this.speed = d.speed; this.hostile = d.hostile;
      this.path = null; this.pathIdx = 0; this.target = null;
      this.repath = 0; this.attackTime = 0;
      this.lookTarget = null; this.lookTimer = 0;
      this.yaw = Math.random() * Math.PI * 2; this.bodyYaw = this.yaw;
      this.panic = 0; this.stuckTicks = 0;
      this.persistent = !d.hostile;
      this.idle = 0;
      this.avoidWater = !d.hostile;
      this.eye = d.h * 0.85;
      if (type === 'sheep') this.sheared = false;
      if (type === 'chicken') this.eggTime = 6000 + Math.floor(Math.random() * 6000);
      if (type === 'creeper') { this.fuse = 0; this.prevFuse = 0; this.fuseDir = -1; }
      this.fireImmune = !!d.fireImmune;
      if (d.init) d.init(this);
    }
    tick() {
      this.baseTick();
      if (this.health <= 0) {
        this.deathTime++;
        this.moveForward = 0;
        this.travel(0, 0);
        if (this.deathTime >= 20) {
          this.removed = true;
          if (this.world.fx) this.world.fx.particles('poof', this.x, this.y + this.h / 2, this.z, 20, this.w);
        }
        return;
      }
      if (this.def.ai) this.def.ai(this); else this.aiTick();
      if (this.def.fly) { this.flyTravel(); this.updateBodyYaw(); this.headYaw = this.lookYaw !== undefined ? this.lookYaw : this.yaw; if (this.def.tick) this.def.tick(this); this.despawnCheck(); return; }
      if (this.jumping) {
        if (this.inWater || this.inLava) this.vy += 0.04;
        else if (this.onGround) this.vy = 0.42;
      }
      this.travel(this.moveStrafe, this.moveForward * this.speed);
      if (this.type === 'chicken' && !this.onGround && this.vy < 0) this.vy *= 0.6;
      this.updateBodyYaw();
      this.headYaw = this.lookYaw !== undefined ? this.lookYaw : this.yaw;
      // sounds
      if (this.def.sound && Math.random() * 1000 < this.livingSoundTime++) {
        this.livingSoundTime = -80;
        if (this.world.fx) this.world.fx.sound(this.def.sound, this.x, this.y + this.h, this.z, 1, (Math.random() - Math.random()) * 0.2 + 1);
      }
      // sunlight burn
      if (this.def.burns && this.world.dim === 0 && this.world.isDaytime() && !this.inWater) {
        const bx = Math.floor(this.x), by = Math.floor(this.y + this.eye), bz = Math.floor(this.z);
        const bright = this.world.getSky(bx, by, bz) - this.world.skySubtracted();
        if (bright > 12 && Math.random() * 30 < (bright - 12) * 2) this.fire = 300;
      }
      if (this.type === 'chicken' && --this.eggTime <= 0) {
        this.eggTime = 6000 + Math.floor(Math.random() * 6000);
        this.world.spawnItem(this.x, this.y + 0.2, this.z, I().stack(344), false);
        if (this.world.fx) this.world.fx.sound('pop', this.x, this.y, this.z, 1, (Math.random() - Math.random()) * 0.2 + 1);
      }
      if (this.type === 'creeper') this.creeperFuse();
      if (this.def.tick) this.def.tick(this);
      if (this.eatTimer > 0) {
        this.eatTimer--;
        if (this.eatTimer === 4 && this.type === 'sheep') {
          const bx = Math.floor(this.x), by = Math.floor(this.y) - 1, bz = Math.floor(this.z);
          if (this.world.getBlock(bx, by, bz) === B.grass) { this.world.setBlock(bx, by, bz, B.dirt, 0); this.sheared = false; }
        }
      }
      this.despawnCheck();
    }
    despawnCheck() {
      if (this.persistent) return;
      const p = this.world.player;
      if (!p) return;
      const d2 = this.dist2(p.x, p.y, p.z);
      if (d2 > 128 * 128) { this.removed = true; return; }
      if (this.idle > 600 && d2 > 32 * 32 && Math.random() < 1 / 800) this.removed = true;
      if (this.hostile && this.world.difficulty === 0) this.removed = true;
    }
    canSee(e) {
      const ex = this.x, ey = this.y + this.eye, ez = this.z;
      const tx = e.x, ty = e.y + (e.eye || e.h * 0.85), tz = e.z;
      const dx = tx - ex, dy = ty - ey, dz = tz - ez;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.01) return true;
      const steps = Math.ceil(d * 2);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const b = this.world.getBlock(Math.floor(ex + dx * t), Math.floor(ey + dy * t), Math.floor(ez + dz * t));
        if (OPAQUE[b] && SOLID[b]) return false;
      }
      return true;
    }
    faceTowards(x, z, maxTurn) {
      const target = Math.atan2(-(x - this.x), -(z - this.z));
      const d = DL.wrapAngle(target - this.yaw);
      this.yaw = DL.wrapAngle(this.yaw + Math.max(-maxTurn, Math.min(maxTurn, d)));
    }
    findTarget() {
      const p = this.world.player;
      if (this.def.findTarget) return this.def.findTarget(this);
      if (!p || p.health <= 0 || p.creative || this.world.difficulty === 0) return null;
      if (this.def.neutral && !this.provoked) return null;
      if (this.type === 'spider') {
        const bright = this.world.getLightLevel(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z));
        if (bright > 8 && !this.provoked) return null;
      }
      const d = this.distTo(p);
      if (d < 16 && this.canSee(p)) return p;
      return null;
    }
    aiTick() {
      this.moveForward = 0; this.moveStrafe = 0; this.jumping = false;
      this.idle++;
      const w = this.world;
      if (this.hostile || this.def.neutral || this.def.findTarget) {
        if (this.target && (this.target.health <= 0 || this.target.removed || this.distTo(this.target) > 24)) this.target = null;
        if (!this.target || this.age % 20 === 0) { const t = this.findTarget(); if (t) this.target = t; else if (this.type === 'spider' && this.target && !this.provoked) this.target = null; }
      }
      if (this.panic > 0) this.panic--;
      const t = this.target;
      if (t) {
        this.idle = 0;
        const d = this.distTo(t);
        const see = this.canSee(t);
        this.attackBehaviour(t, d, see);
        if (--this.repath <= 0 || !this.path) {
          this.repath = 10 + Math.floor(Math.random() * 20);
          if (!(this.def.ranged && see && d < 10)) this.path = E.findPath(w, this, t.x, t.y, t.z, 300, 24);
          else this.path = null;
          this.pathIdx = 0;
        }
      } else {
        if (this.panic > 0 && (!this.path || this.pathIdx >= this.path.length)) this.wander(true);
        else if (!this.path && Math.random() < (this.panic > 0 ? 0.5 : 1 / 80)) this.wander(false);
        // idle look around
        if (--this.lookTimer <= 0) {
          this.lookTimer = 40 + Math.floor(Math.random() * 80);
          const p = w.player;
          if (p && this.distTo(p) < 8 && Math.random() < 0.5) this.lookTarget = p;
          else { this.lookTarget = null; if (!this.path) this.yaw += (Math.random() - 0.5) * 1.2; }
        }
        if (this.type === 'sheep' && !this.path && this.eatTimer <= 0 && Math.random() < (this.sheared ? 0.01 : 0.002)) this.eatTimer = 40;
        if (this.def.idle) this.def.idle(this);
      }
      this.followPath();
      if (this.inWater || this.inLava) { if (Math.random() < 0.8) this.jumping = true; }
      // look
      const lt = t || this.lookTarget;
      if (lt && !lt.removed) {
        const dx = lt.x - this.x, dz = lt.z - this.z, dy = (lt.y + (lt.eye || 1)) - (this.y + this.eye);
        this.lookYaw = Math.atan2(-dx, -dz);
        const hd = DL.wrapAngle(this.lookYaw - this.bodyYaw);
        const lim = Math.PI * 70 / 180;
        this.lookYaw = this.bodyYaw + Math.max(-lim, Math.min(lim, hd));
        this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        if (!this.path) this.faceTowards(lt.x, lt.z, 0.3);
      } else { this.lookYaw = undefined; this.pitch *= 0.8; }
    }
    wander(panic) {
      const w = this.world;
      let best = null, bestScore = -1e9;
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(this.x + Math.random() * 26 - 13), y = Math.floor(this.y + Math.random() * 14 - 7), z = Math.floor(this.z + Math.random() * 26 - 13);
        if (!w.isReady(x, z)) continue;
        let score;
        if (this.hostile) score = 0.5 - w.getLightLevel(x, y, z) / 15;
        else score = (w.getBlock(x, y - 1, z) === B.grass || w.getBlock(x, y - 1, z) === B.aether_grass) ? 10 : w.getLightLevel(x, y, z) / 15 - 0.5;
        if (this.home) score -= Math.hypot(x - this.home[0], z - this.home[2]) > 24 ? 20 : 0;
        if (score > bestScore) { bestScore = score; best = [x, y, z]; }
      }
      if (best) {
        this.path = E.findPath(w, this, best[0], best[1], best[2], 200, 16);
        this.pathIdx = 0;
      }
    }
    followPath() {
      const p = this.path;
      if (!p) return;
      if (this.pathIdx >= p.length) { this.path = null; return; }
      const n = p[this.pathIdx];
      const tx = n.x + 0.5, tz = n.z + 0.5;
      const dx = tx - this.x, dz = tz - this.z;
      const hd = Math.hypot(dx, dz);
      if (hd < Math.max(0.35, this.w * 0.5) && Math.abs(n.y - this.y) < 1.2) {
        this.pathIdx++; this.stuckTicks = 0;
        return;
      }
      this.faceTowards(tx, tz, 0.5);
      this.moveForward = this.panic > 0 ? 1.25 : 1;
      if (n.y > Math.floor(this.y + 0.2) || (this.collidedH && this.onGround)) this.jumping = true;
      if (this.type === 'spider' && this.collidedH) this.vy = 0.2;
      if (++this.stuckTicks > 80) { this.path = null; this.stuckTicks = 0; }
    }
    attackBehaviour(t, d, see) {
      const w = this.world;
      if (this.attackTime > 0) this.attackTime--;
      if (this.def.attackFn) { this.def.attackFn(this, t, d, see); return; }
      if (this.type === 'zombie' || (this.type === 'spider') || (this.def.attack && !this.def.ranged && this.type !== 'creeper')) {
        if (this.type === 'spider' && d > 2 && d < 6 && this.onGround && Math.random() < 0.1) {
          const dx = t.x - this.x, dz = t.z - this.z, l = Math.hypot(dx, dz) || 1;
          this.vx = dx / l * 0.4 + this.vx * 0.2; this.vz = dz / l * 0.4 + this.vz * 0.2; this.vy = 0.4;
        }
        const reach = this.w * 0.5 + t.w * 0.5 + 0.9;
        if (d < reach + 0.5 && this.attackTime <= 0 && Math.abs(t.y - this.y) < 1.5 && see) {
          this.attackTime = 20;
          this.swing();
          t.damage('mob', t.isPlayer ? scaleDamage(this.def.attack, w.difficulty) : this.def.attack, this);
          if (this.def.onHit) this.def.onHit(this, t);
        }
        if (d < 1.2) { this.faceTowards(t.x, t.z, 0.6); this.moveForward = 1; }
      } else if (this.def.ranged === true) {
        this.aiming = see && d < 12;
        if (see && d < 10) {
          this.faceTowards(t.x, t.z, 0.8);
          if (this.attackTime <= 0) {
            this.attackTime = 30 + Math.floor(Math.random() * 20);
            const a = new Arrow(w, this.x, this.y + this.eye - 0.1, this.z, this);
            if (this.def.fireArrows) a.fire = 100;
            const dx = t.x - this.x, dz = t.z - this.z;
            const dy = (t.y + t.h * 0.66) - (this.y + this.eye - 0.1);
            const dist = Math.hypot(dx, dz);
            a.shoot(dx, dy + dist * 0.2, dz, 1.2, 12);
            w.entities.push(a);
            if (w.fx) w.fx.sound('bow', this.x, this.y, this.z, 1, 1 / (Math.random() * 0.4 + 0.8));
          }
          if (d < 4) { this.moveForward = -0.8; }
        }
      } else if (this.type === 'creeper') {
        this.fuseDir = see && d < 3.2 ? 1 : (d > 7 ? -1 : this.fuseDir);
      }
    }
    creeperFuse() {
      this.prevFuse = this.fuse;
      if (this.fuseDir > 0 && this.fuse === 0 && this.world.fx) this.world.fx.sound('fuse', this.x, this.y, this.z, 1, 0.5);
      this.fuse += this.fuseDir;
      if (this.fuse < 0) this.fuse = 0;
      if (this.fuseDir > 0) { this.moveForward = 0; this.path = null; }
      if (this.fuse >= 30) {
        this.removed = true;
        this.world.explode(this.x, this.y + 0.8, this.z, 3, this);
      }
    }
    onHurt(src, from) {
      if (!this.hostile && !this.def.neutral) { this.panic = 60; this.path = null; }
      if (from && from.living && from !== this && (this.hostile || this.def.neutral) && (from.isPlayer ? !from.creative : true)) { this.target = from; this.provoked = true; }
      if (this.def.onHurt) this.def.onHurt(this, src, from);
      if (this.world.fx) this.world.fx.sound(this.def.sound ? this.def.sound + 'hurt' : 'hurtmob', this.x, this.y + this.h, this.z, 1, (Math.random() - Math.random()) * 0.2 + 1);
      if (this.type === 'sheep' && !this.sheared && from && from.isPlayer) {
        this.sheared = true;
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.world.spawnItem(this.x, this.y + 1, this.z, I().stack(B.wool), true);
      }
    }
    onDeath(src, killer) {
      this.deathTime = 0;
      if (this.world.fx) this.world.fx.sound(this.def.sound ? this.def.sound + 'death' : 'hurtmob', this.x, this.y + this.h, this.z, 1, (Math.random() - Math.random()) * 0.2 + 1);
      if (killer && killer.isPlayer) killer.score += this.hostile ? 100 : 0;
      const drop = (id, max) => { const n = Math.floor(Math.random() * (max + 1)); if (n) this.world.spawnItem(this.x, this.y + 0.5, this.z, I().stack(id, n), true); };
      switch (this.type) {
        case 'pig': drop(this.fire > 0 ? 320 : 319, 2); break;
        case 'cow': drop(334, 2); break;
        case 'sheep': if (!this.sheared) this.world.spawnItem(this.x, this.y + 0.5, this.z, I().stack(B.wool, 1), true); break;
        case 'chicken': drop(288, 2); break;
        case 'zombie': drop(288, 2); break;
        case 'skeleton': drop(262, 2); drop(352, 2); break;
        case 'creeper': drop(289, 2); break;
        case 'spider': drop(287, 2); break;
        default: if (this.def.drops) for (const [id, max, chance] of this.def.drops) { if (chance === undefined || Math.random() < chance) drop(id, max); }
      }
      if (this.def.onDeath) this.def.onDeath(this, killer);
    }
    serialize() {
      if (!this.persistent || this.health <= 0) return null;
      if (this.def.noSave) return null;
      return { type: this.type, x: this.x, y: this.y, z: this.z, health: this.health, yaw: this.yaw, sheared: this.sheared, v: this.variant, home: this.home, tamed: this.tamed };
    }
  }
  E.Mob = Mob;
  function scaleDamage(d, diff) {
    if (diff === 0) return 0;
    if (diff === 1) return Math.floor(d / 2) + 1;
    if (diff === 3) return Math.floor(d * 3 / 2);
    return d;
  }

  E.spawnMob = function (world, type, x, y, z, extra) {
    const m = new Mob(world, x, y, z, type);
    if (extra) {
      if (extra.health !== undefined) m.health = extra.health;
      if (extra.yaw !== undefined) m.yaw = m.bodyYaw = extra.yaw;
      if (extra.sheared) m.sheared = true;
      if (extra.v !== undefined) { m.variant = extra.v; if (m.def.onVariant) m.def.onVariant(m); }
      if (extra.home) m.home = extra.home;
      if (extra.tamed) m.tamed = extra.tamed;
    }
    world.entities.push(m);
    return m;
  };

  E.fromSave = function (world, d) {
    if (!d) return null;
    if (d.type === 'item') {
      const e = new ItemEntity(world, d.x, d.y, d.z, d.stack);
      e.age = d.age || 0; e.pickupDelay = 0;
      world.entities.push(e);
      return e;
    }
    if (MOBS[d.type]) return E.spawnMob(world, d.type, d.x, d.y, d.z, d);
    return null;
  };

  /* ------------------------------------------------------------ */
  /* Natural spawning                                             */
  /* ------------------------------------------------------------ */
  E.canMonsterSpawn = function (w, x, y, z, type) {
    const h = Math.ceil(MOBS[type].h);
    if (!standable(w, x, y, z, h)) return false;
    const below = w.getBlock(x, y - 1, z);
    if (!OPAQUE[below] || below === B.bedrock && false) return false;
    if (w.getBlock(x, y, z) === B.water) return false;
    const sky = w.getSky(x, y, z);
    if (sky > Math.floor(Math.random() * 32)) return false;
    const light = Math.max(sky - w.skySubtracted(), w.getBlockLight(x, y, z));
    return light <= Math.floor(Math.random() * 8);
  };
  E.naturalSpawn = function (world, player) {
    if (!player || player.health <= 0) return;
    let hostile = 0, passive = 0;
    for (const e of world.entities) if (e instanceof Mob && !e.removed) { if (e.hostile) hostile++; else passive++; }
    const pcx = Math.floor(player.x / 16), pcz = Math.floor(player.z / 16);
    const r = world.rng;
    const HMAX = 30;
    if (world.difficulty > 0 && hostile < HMAX) {
      for (let tries = 0; tries < 3; tries++) {
        const cx = pcx + r.nextInt(17) - 8, cz = pcz + r.nextInt(17) - 8;
        const c = world.getChunk(cx, cz);
        if (!c || !c.lit) continue;
        const x = cx * 16 + r.nextInt(16), z = cz * 16 + r.nextInt(16), y = r.nextInt(120) + 1;
        const types = ['zombie', 'skeleton', 'creeper', 'spider'];
        const type = types[r.nextInt(types.length)];
        let n = 0;
        for (let k = 0; k < 4 && n < 4; k++) {
          const sx = x + r.nextInt(6) - r.nextInt(6), sz = z + r.nextInt(6) - r.nextInt(6);
          if (!world.isReady(sx, sz)) continue;
          const d2 = (sx + 0.5 - player.x) ** 2 + (y - player.y) ** 2 + (sz + 0.5 - player.z) ** 2;
          if (d2 < 24 * 24) continue;
          if (!E.canMonsterSpawn(world, sx, y, sz, type)) continue;
          if (type === 'spider' && !standable(world, sx + 1, y, sz, 1)) continue;
          const m = E.spawnMob(world, type, sx + 0.5, y, sz + 0.5);
          m.persistent = false;
          n++;
        }
      }
    }
    if (passive < 20 && world.totalTicks % 400 === 0) {
      const cx = pcx + r.nextInt(17) - 8, cz = pcz + r.nextInt(17) - 8;
      const c = world.getChunk(cx, cz);
      if (!c || !c.lit) return;
      const x = cx * 16 + r.nextInt(16), z = cz * 16 + r.nextInt(16);
      const y = world.topSolidY(x, z);
      if (world.getBlock(x, y - 1, z) !== B.grass) return;
      if (world.getSky(x, y, z) < 12) return;
      const d2 = (x - player.x) ** 2 + (z - player.z) ** 2;
      if (d2 < 24 * 24) return;
      const types = ['pig', 'cow', 'sheep', 'chicken'];
      const type = types[r.nextInt(4)];
      for (let k = 0; k < 3; k++) {
        const sx = x + r.nextInt(5) - 2, sz = z + r.nextInt(5) - 2;
        const sy = world.topSolidY(sx, sz);
        if (world.getBlock(sx, sy - 1, sz) === B.grass && standable(world, sx, sy, sz, 2)) E.spawnMob(world, type, sx + 0.5, sy, sz + 0.5);
      }
    }
  };

  E.tickSpawners = function (world, player) {
    for (const sp of world.spawners) {
      if (!player) return;
      const d2 = (sp.x + 0.5 - player.x) ** 2 + (sp.y + 0.5 - player.y) ** 2 + (sp.z + 0.5 - player.z) ** 2;
      if (d2 > 16 * 16) continue;
      if (world.fx && Math.random() < 0.5) world.fx.particles('flame', sp.x + Math.random(), sp.y + Math.random(), sp.z + Math.random(), 1, 0);
      if (world.fx && Math.random() < 0.5) world.fx.particles('smoke', sp.x + Math.random(), sp.y + Math.random(), sp.z + Math.random(), 1, 0);
      if (world.difficulty === 0) continue;
      if (--sp.delay > 0) continue;
      sp.delay = 200 + Math.floor(Math.random() * 600);
      let near = 0;
      for (const e of world.entities) if (e instanceof Mob && e.type === sp.mob && Math.abs(e.x - sp.x) < 8 && Math.abs(e.y - sp.y) < 4 && Math.abs(e.z - sp.z) < 8) near++;
      if (near >= 6) continue;
      for (let i = 0; i < 4; i++) {
        const x = sp.x + Math.floor((Math.random() - Math.random()) * 4), y = sp.y + Math.floor(Math.random() * 3) - 1, z = sp.z + Math.floor((Math.random() - Math.random()) * 4);
        if (!E.canMonsterSpawn(world, x, y, z, sp.mob)) continue;
        const m = E.spawnMob(world, sp.mob, x + 0.5, y, z + 0.5);
        m.persistent = false;
        if (world.fx) world.fx.particles('poof', x + 0.5, y + 0.5, z + 0.5, 10, 0.5);
      }
    }
  };

  E.standable = standable;
})();
