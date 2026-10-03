/*
 * DreamLand - the creatures of the Sift, after Minecraft Dungeons II:
 *  - Blubs (rabbit-like, they walk instead of hopping; the blue ones glow with souls)
 *  - Lickers (turtle-like grazers), Singers (they sing, calm the sifters and can
 *    sing Echo Golems into being), Echo Golems (helpers powered by soul blocks)
 *  - Sifters: Seedlings, Nesters (gallop, lunge and bite), Sprouts (flying,
 *    tentacled), Crested Sentinels (head-shake barrages of homing seeds) and
 *    Groobler Sentinels (big orbs that burst)
 *  - Sculkers: Sculk Mages (exploding souls) and Sculk Slashers (long claws)
 *  - Bosses: the Monarch (summons its echo and its court), the Sculk Monstrosity
 *    and the Harmonizer
 *  - Trills: flocks drifting across the sky
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, E = DL.Entities, I = DL.Items, M = DL.Models, A = DL.Audio, GUI = DL.GUI, N = DL.Net;
  const MOBS = E.MOBS, D = M.defs, hex = M.hex, Skin = M.Skin, AN = M.anims, SP = M.skinPainters;
  const RP = DL.Renderer.prototype, GP = DL.Game.prototype;
  const Sift = DL.Sift, SIFT = 4, rnd = Math.random, SOLID = S.SOLID;
  const isGuest = () => !!(N && N.client);
  const P = (pivot, boxes, extra) => Object.assign({ pivot, boxes }, extra || {});
  const add = (name, o) => { MOBS[name] = Object.assign({ w: 0.6, h: 1.8, hp: 20, speed: 0.7, hostile: false, sound: null, model: name, sift: true, fireImmune: true }, o); };
  const snd = (m, k, v, p) => { if (m.world.fx) m.world.fx.sound(k, m.x, m.y + m.h * 0.6, m.z, v || 1, p || 1); };
  const fx = (m, k, n, s, dy) => { if (m.world.fx) m.world.fx.particles(k, m.x, m.y + (dy === undefined ? m.h * 0.6 : dy), m.z, n, s || 0.5); };
  const ECHO = Sift.ECHO;

  /* who the Sift's creatures go after: every player, not just the host */
  function players(w) {
    const out = [];
    for (const e of w.entities) if (e.isPlayer && !e.removed && e.health > 0 && !e.creative && (!e.isProxy)) out.push(e);
    return out;
  }
  function nearestPlayer(m, range) {
    if (m.world.difficulty === 0) return null;
    let best = null, bd = range * range;
    for (const p of players(m.world)) {
      const d = m.dist2(p.x, p.y, p.z);
      if (d < bd && m.canSee(p)) { bd = d; best = p; }
    }
    return best;
  }
  const hostileFind = (range) => (m) => {
    if (m.calmed > 0) return null;
    const t = nearestPlayer(m, range);
    if (t && t.armor && t.armor[0] && t.armor[0].id === Sift.CROWN && m.dist2(t.x, t.y, t.z) > 36) return null; // the crown commands respect
    return t;
  };
  const tide = (m) => Sift.tide(m.world);
  const fierce = (m, dmg) => tide(m) === 'Endure' ? dmg * 1.5 : dmg;
  const hurt = (m, t, dmg) => { if (!t || t.health <= 0) return false; return t.damage('mob', fierce(m, dmg), m); };

  /* ------------------------------------------------------------ */
  /* Projectiles: homing seeds, soul orbs and grooble bursts      */
  /* ------------------------------------------------------------ */
  class SiftBolt extends E.Magic {
    constructor(world, x, y, z, shooter, kind, target) {
      super(world, x, y, z, shooter, 'sift_' + kind, target);
      this.sk = kind; this.icon = kind === 'seed' ? Sift.SEED : Sift.SOUL_ORB;
      this.size = kind === 'groob' ? 0.8 : kind === 'orb' ? 0.45 : 0.3;
      this.drag = kind === 'groob' ? 0.96 : 1;
      this.fuse = kind === 'groob' ? 34 : 0;
      this.noSave = true; this.homing = target || null;
    }
    tick() {
      const t = this.homing;
      if (this.sk === 'seed' && t && !t.removed && this.age < 40) {
        const sp = 0.42, dx = t.x - this.x, dy = t.y + t.h / 2 - this.y, dz = t.z - this.z, l = Math.hypot(dx, dy, dz) || 1;
        this.vx += (dx / l * sp - this.vx) * 0.12; this.vy += (dy / l * sp - this.vy) * 0.12; this.vz += (dz / l * sp - this.vz) * 0.12;
      }
      if (this.age % 2 === 0 && this.world.fx) this.world.fx.particles(this.sk === 'seed' ? 'happy' : 'soul', this.x, this.y, this.z, 1, 0.1);
      if (this.fuse > 0 && --this.fuse === 0) { this.burst(); return; }
      super.tick();
      if (this.age > 160) this.removed = true;
    }
    hitEntity(e) {
      if (e === this.shooter || (e.def && e.def.sift)) return;
      if (this.sk === 'seed') { e.damage('mob', fierce(this.shooter || this, 3), this.shooter || this); if (this.world.fx) this.world.fx.particles('poof', this.x, this.y, this.z, 4, 0.2); this.removed = true; }
      else this.burst();
    }
    hitBlock() { if (this.sk === 'seed') { this.removed = true; if (this.world.fx) this.world.fx.particles('poof', this.x, this.y, this.z, 3, 0.2); } else this.burst(); }
    burst() {
      if (this.removed) return;
      this.removed = true;
      const w = this.world, R = this.sk === 'groob' ? 3.4 : 2.6, dmg = this.sk === 'groob' ? 7 : 5;
      for (const e of w.entities) {
        if (!e.living || e.health <= 0 || e === this.shooter || (e.def && e.def.sift)) continue;
        const d = Math.hypot(e.x - this.x, e.y + e.h / 2 - this.y, e.z - this.z);
        if (d > R) continue;
        e.damage('magic', fierce(this.shooter || this, dmg * (1 - d / R * 0.6)), this.shooter || this);
        const k = 0.5 / Math.max(0.5, d);
        e.vx += (e.x - this.x) * k * 0.3; e.vz += (e.z - this.z) * k * 0.3; e.vy += 0.3;
      }
      if (w.fx) { w.fx.particles('soul', this.x, this.y, this.z, 24, R * 0.8); w.fx.particles('explosion', this.x, this.y, this.z, 3, 0.6); w.fx.sound('explode', this.x, this.y, this.z, 0.8, 1.6); }
    }
  }
  E.SiftBolt = SiftBolt;
  function fire(m, kind, t, speed, spread, homing) {
    const b = new SiftBolt(m.world, m.x, m.y + m.h * 0.75, m.z, m, kind, homing ? t : null);
    const dx = t.x - b.x, dy = t.y + t.h * 0.5 - b.y, dz = t.z - b.z;
    b.shoot(dx, dy + (kind === 'groob' ? Math.hypot(dx, dz) * 0.12 : 0), dz, speed, spread);
    m.world.entities.push(b);
    return b;
  }

  /* ------------------------------------------------------------ */
  /* Models                                                       */
  /* ------------------------------------------------------------ */
  D.blub = { anim: 'blub', shadow: 0.35, parts: {
    body: P([0, 21, 0], [[-3, -5, -4, 6, 5, 8], [-2, -4, 4, 4, 3, 1]]),
    head: P([0, 17, -3], [[-2.5, -5, -4, 5, 5, 5], [-2.5, -11, -1.5, 1.5, 6, 1], [1, -11, -1.5, 1.5, 6, 1], [-1, -2, -5, 2, 1.5, 1]]),
    leg1: P([-2, 21, -2.5], [[-1, 0, -1, 2, 3, 2]]), leg2: P([2, 21, -2.5], [[-1, 0, -1, 2, 3, 2]]),
    leg3: P([-2, 21, 2.5], [[-1, 0, -1, 2, 3, 2]]), leg4: P([2, 21, 2.5], [[-1, 0, -1, 2, 3, 2]])
  } };
  D.licker = { anim: 'licker', shadow: 0.6, parts: {
    shell: P([0, 21, 0], [[-5, -5, -6, 10, 4, 12], [-3.5, -7, -4.5, 7, 2, 9], [-6, -2, -7, 12, 1, 14]]),
    head: P([0, 20, -6], [[-2, -2.5, -4, 4, 3, 4], [-1.5, -3.5, -3.5, 1, 1, 1], [0.5, -3.5, -3.5, 1, 1, 1]]),
    tongue: P([0, 20.5, -10], [[-0.5, -0.5, -3, 1, 1, 3]]),
    leg1: P([-4, 21, -4], [[-1.5, 0, -1.5, 3, 3, 3]]), leg2: P([4, 21, -4], [[-1.5, 0, -1.5, 3, 3, 3]]),
    leg3: P([-4, 21, 4], [[-1.5, 0, -1.5, 3, 3, 3]]), leg4: P([4, 21, 4], [[-1.5, 0, -1.5, 3, 3, 3]])
  } };
  D.singer = { anim: 'singer', shadow: 0.4, noCull: true, parts: {
    robe: P([0, 24, 0], [[-3, -9, -2.5, 6, 8, 5], [-2.5, -16, -2, 5, 7, 4], [-3.5, -2, -3, 7, 1, 6]]),
    head: P([0, 8, 0], [[-3, -6, -3, 6, 6, 6], [-4, -10, 0.5, 8, 4, 0.5], [-1, -12, -0.5, 2, 2, 2]]),
    rarm: P([-3, 9, 0], [[-2, 0, -1, 2, 13, 2]]), larm: P([3, 9, 0], [[0, 0, -1, 2, 13, 2]]),
    ribbon: P([0, 10, 2.2], [[-2, 0, 0, 4, 13, 0.4]])
  } };
  D.seedling = { anim: 'seedling', shadow: 0.35, noCull: true, parts: {
    bulb: P([0, 22, 0], [[-3, -6, -3, 6, 6, 6], [-2.5, -9, 0, 5, 3, 0.2], [0, -9, -2.5, 0.2, 3, 5]]),
    leg1: P([-1.5, 22, 0], [[-1, 0, -1, 2, 2, 2]]), leg2: P([1.5, 22, 0], [[-1, 0, -1, 2, 2, 2]])
  } };
  D.nester = { anim: 'nester', shadow: 0.7, parts: {
    body: P([0, 10, 0], [[-3, -3, -6, 6, 6, 12], [-3.5, -4, -2, 7, 1, 6]]),
    head: P([0, 8, -6], [[-1.5, -6, -2, 3, 7, 3], [-2.5, -9, -8, 5, 4, 7], [-3, -11, -3, 1, 3, 1], [2, -11, -3, 1, 3, 1]]),
    jaw: P([0, 8, -6], [[-2, -5, -7.5, 4, 1.5, 6]]),
    tail: P([0, 9, 6], [[-1, -1, 0, 2, 2, 7]]),
    leg1: P([-2.5, 12, -4.5], [[-1, 0, -1, 2, 12, 2]]), leg2: P([2.5, 12, -4.5], [[-1, 0, -1, 2, 12, 2]]),
    leg3: P([-2.5, 12, 4.5], [[-1, 0, -1, 2, 12, 2]]), leg4: P([2.5, 12, 4.5], [[-1, 0, -1, 2, 12, 2]])
  } };
  D.sprout = { anim: 'sprout', shadow: 0, noCull: true, parts: {
    head: P([0, 12, 0], [[-4, -8, -4, 8, 8, 8], [-5, -10, -0.5, 10, 3, 1], [-0.5, -10, -5, 1, 3, 10]]),
    t1: P([-2, 12, -2], [[-1, 0, -1, 2, 9, 2]]), t2: P([2, 12, -2], [[-1, 0, -1, 2, 9, 2]]),
    t3: P([-2, 12, 2], [[-1, 0, -1, 2, 9, 2]]), t4: P([2, 12, 2], [[-1, 0, -1, 2, 9, 2]])
  } };
  D.crested_sentinel = { anim: 'crested', shadow: 1.0, noCull: true, parts: {
    body: P([0, 24, 0], [[-6, -10, -5, 12, 9, 10]]),
    head: P([0, 15, -4], [[-4, -4, -5, 8, 6, 5], [-7, -12, -1, 14, 8, 1], [-5, -1, -6, 10, 1, 1]]),
    leg1: P([-4.5, 22, -3], [[-1.5, -1, -1.5, 3, 3, 3]]), leg2: P([4.5, 22, -3], [[-1.5, -1, -1.5, 3, 3, 3]]),
    leg3: P([-4.5, 22, 3], [[-1.5, -1, -1.5, 3, 3, 3]]), leg4: P([4.5, 22, 3], [[-1.5, -1, -1.5, 3, 3, 3]])
  } };
  D.groobler_sentinel = { anim: 'groobler', shadow: 0.9, parts: {
    body: P([0, 24, 0], [[-4, -14, -4, 8, 14, 8], [-3, -22, -3, 6, 8, 6]]),
    head: P([0, 2, 0], [[-5, -8, -5, 10, 7, 10], [-2, -11, -2, 4, 3, 4]]),
    jaw: P([0, 2, -1], [[-4.5, -1, -4.5, 9, 3, 9]]),
    rarm: P([-4.5, 12, 0], [[-2, 0, -1.5, 2.5, 8, 3]]), larm: P([4.5, 12, 0], [[-0.5, 0, -1.5, 2.5, 8, 3]])
  } };
  const humanoid = (o) => Object.assign({
    head: P([0, 0, 0], [[-4, -8, -4, 8, 8, 8]]),
    body: P([0, 0, 0], [[-4, 0, -2, 8, 12, 4]]),
    rarm: P([-5, 2, 0], [[-3, -2, -2, 4, 12, 4]]), larm: P([5, 2, 0], [[-1, -2, -2, 4, 12, 4]]),
    rleg: P([-2, 12, 0], [[-2, 0, -2, 4, 12, 4]]), lleg: P([2, 12, 0], [[-2, 0, -2, 4, 12, 4]])
  }, o);
  D.sculk_mage = { anim: 'sculker', shadow: 0.5, noCull: true, parts: humanoid({
    head: P([0, 0, 0], [[-4, -8, -4, 8, 8, 8], [-3, -11, -1, 1, 3, 1], [2, -11, -1, 1, 3, 1], [-0.5, -12, -1, 1, 4, 1]]),
    body: P([0, 0, 0], [[-4, 0, -2, 8, 12, 4], [-4.5, 9, -2.5, 9, 13, 5]]),
    rarm: P([-5, 2, 0], [[-2.5, -2, -1.5, 3, 12, 3]]), larm: P([5, 2, 0], [[-0.5, -2, -1.5, 3, 12, 3]])
  }) };
  D.sculk_slasher = { anim: 'sculker', shadow: 0.5, noCull: true, parts: humanoid({
    head: P([0, 0, 0], [[-3.5, -7, -3.5, 7, 7, 7], [-4, -9, 0, 8, 2, 1]]),
    rarm: P([-5, 2, 0], [[-2.5, -2, -1.5, 3, 15, 3], [-3, 13, -2, 1, 5, 1], [-1.5, 13, -2, 1, 6, 1], [0, 13, -2, 1, 5, 1]]),
    larm: P([5, 2, 0], [[-0.5, -2, -1.5, 3, 15, 3], [-1, 13, -2, 1, 5, 1], [0.5, 13, -2, 1, 6, 1], [2, 13, -2, 1, 5, 1]]),
    rleg: P([-2, 12, 0], [[-1.5, 0, -1.5, 3, 12, 3]]), lleg: P([2, 12, 0], [[-1.5, 0, -1.5, 3, 12, 3]])
  }) };
  D.monarch = { anim: 'sculker', shadow: 1.0, noCull: true, parts: humanoid({
    head: P([0, 0, 0], [[-4, -8, -4, 8, 8, 8], [-4.5, -10, -4.5, 9, 2, 9], [-4, -13, -4, 1, 3, 1], [3, -13, -4, 1, 3, 1], [-0.5, -14, -4, 1, 4, 1], [-4, -13, 3, 1, 3, 1], [3, -13, 3, 1, 3, 1]]),
    body: P([0, 0, 0], [[-4, 0, -2, 8, 12, 4], [-5, -1, 2, 10, 23, 0.6], [-6, -1, -2.5, 12, 3, 5]]),
    rarm: P([-5, 2, 0], [[-3, -2, -2, 4, 13, 4], [-3.5, 11, -2.5, 1, 6, 1], [-2, 11, -2.5, 1, 7, 1], [-0.5, 11, -2.5, 1, 6, 1]]),
    larm: P([5, 2, 0], [[-1, -2, -2, 4, 13, 4], [-0.5, 11, -2.5, 1, 6, 1], [1, 11, -2.5, 1, 7, 1], [2.5, 11, -2.5, 1, 6, 1]])
  }) };
  M.newModels.push('blub', 'licker', 'singer', 'seedling', 'nester', 'sprout', 'crested_sentinel', 'groobler_sentinel', 'sculk_mage', 'sculk_slasher', 'monarch');

  /* animations */
  AN.blub = ({ e, o, limb, amt, headYaw, headPitch, age }) => {
    const w = Math.cos(limb * 0.9) * 0.9 * amt;
    o.body = [0, 0, Math.sin(limb * 0.9) * 0.08 * amt, 0, -Math.abs(Math.sin(limb * 0.9)) * 0.5 * amt, 0];
    o.head = [headPitch * 0.5 + Math.sin(age * 0.07) * 0.05, headYaw * 0.7, 0];
    o.leg1 = [w, 0, 0]; o.leg2 = [-w, 0, 0]; o.leg3 = [-w, 0, 0]; o.leg4 = [w, 0, 0];
    void e;
    return o;
  };
  AN.licker = ({ e, o, limb, amt, headYaw, age }) => {
    const w = Math.cos(limb * 0.5) * 0.5 * amt;
    o.shell = [0, 0, Math.sin(limb * 0.5) * 0.05 * amt];
    o.head = [0, headYaw * 0.5, 0];
    const lick = e.lick > 0 ? Math.sin((e.lick / 20) * Math.PI) : 0;
    o.tongue = [0.3 * lick, headYaw * 0.5, 0, 0, 0.5 * lick, -lick * 3 + 2];
    o.leg1 = [w, 0, 0]; o.leg2 = [-w, 0, 0]; o.leg3 = [-w, 0, 0]; o.leg4 = [w, 0, 0];
    void age;
    return o;
  };
  AN.singer = ({ e, o, headYaw, headPitch, age, amt }) => {
    const bob = Math.sin(age * 0.08) * 1.2, sing = e.singing > 0 ? 1 : 0;
    o.robe = [Math.sin(age * 0.05) * 0.03, 0, Math.sin(age * 0.07) * 0.04, 0, bob, 0];
    o.head = [headPitch * 0.6 - sing * 0.25, headYaw * 0.8 + Math.sin(age * 0.2) * 0.15 * sing, Math.sin(age * 0.11) * 0.08, 0, bob, 0];
    const lift = sing * (2.4 + Math.sin(age * 0.3) * 0.2);
    o.rarm = [-lift * 0.3 + Math.sin(age * 0.09) * 0.1 - amt * 0.2, 0, 0.2 + lift * 0.45, 0, bob, 0];
    o.larm = [-lift * 0.3 - Math.sin(age * 0.09) * 0.1 - amt * 0.2, 0, -0.2 - lift * 0.45, 0, bob, 0];
    o.ribbon = [0.2 + Math.sin(age * 0.12) * 0.15 + amt * 0.4, 0, 0, 0, bob, 0];
    return o;
  };
  AN.seedling = ({ o, limb, amt, age }) => {
    const hop = Math.abs(Math.sin(limb * 0.7)) * amt;
    o.bulb = [0, Math.sin(age * 0.1) * 0.1, 0, 0, -hop * 2, 0];
    o.leg1 = [Math.cos(limb * 0.7) * amt, 0, 0]; o.leg2 = [-Math.cos(limb * 0.7) * amt, 0, 0];
    return o;
  };
  AN.nester = ({ e, o, limb, amt, headYaw, headPitch, age }) => {
    const g = Math.cos(limb * 0.5) * 1.1 * amt;
    o.body = [Math.sin(limb * 0.5) * 0.05 * amt, 0, 0];
    const bite = e.biteAnim > 0 ? Math.sin(e.biteAnim / 8 * Math.PI) : 0;
    o.head = [0.2 + headPitch * 0.5 + bite * 0.4, headYaw * 0.7, 0];
    o.jaw = [0.2 + headPitch * 0.5 + bite * 0.4 + 0.15 + bite * 0.5 + (e.lunging ? 0.4 : 0), headYaw * 0.7, 0];
    o.tail = [-0.4 + Math.sin(age * 0.2) * 0.2, Math.sin(age * 0.13) * 0.3, 0];
    o.leg1 = [g, 0, 0]; o.leg2 = [-g, 0, 0]; o.leg3 = [-g * 0.8, 0, 0]; o.leg4 = [g * 0.8, 0, 0];
    return o;
  };
  AN.sprout = ({ o, age, headYaw }) => {
    o.head = [Math.sin(age * 0.07) * 0.08, headYaw, 0, 0, Math.sin(age * 0.1) * 1, 0];
    const t = (k) => [0.25 + Math.sin(age * 0.18 + k * 1.6) * 0.35, 0, Math.cos(age * 0.15 + k) * 0.25, 0, Math.sin(age * 0.1) * 1, 0];
    o.t1 = t(0); o.t2 = t(1); o.t3 = t(2); o.t4 = t(3);
    o.t1[2] -= 0.3; o.t3[2] -= 0.3; o.t2[2] += 0.3; o.t4[2] += 0.3;
    return o;
  };
  AN.crested = ({ e, o, headYaw, age, limb, amt }) => {
    const shake = e.shake > 0 ? Math.sin(e.shake * 1.3) * 0.6 : 0;
    o.body = [0, 0, 0]; o.head = [Math.sin(age * 0.05) * 0.05, headYaw * 0.5 + shake, shake * 0.2];
    const w = Math.cos(limb * 0.6) * 0.5 * amt;
    o.leg1 = [w, 0, 0]; o.leg2 = [-w, 0, 0]; o.leg3 = [-w, 0, 0]; o.leg4 = [w, 0, 0];
    return o;
  };
  AN.groobler = ({ e, o, headYaw, headPitch, age }) => {
    const ch = Math.min(1, (e.charge || 0) / 20);
    o.body = [0, 0, Math.sin(age * 0.04) * 0.03];
    o.head = [headPitch * 0.4 - ch * 0.3, headYaw * 0.6, 0];
    o.jaw = [headPitch * 0.4 - ch * 0.3 + ch * 0.6, headYaw * 0.6, 0];
    o.rarm = [Math.sin(age * 0.1) * 0.2 - ch, 0, 0.2]; o.larm = [-Math.sin(age * 0.1) * 0.2 - ch, 0, -0.2];
    return o;
  };
  AN.sculker = ({ e, o, limb, amt, headYaw, headPitch, swing, age }) => {
    const q = (a) => Math.cos(limb * 0.6662 + a) * 1.4 * amt;
    const hunch = e.type === 'sculk_slasher' ? 0.35 : 0;
    o.head = [headPitch + hunch * 0.3, headYaw, 0];
    o.body = [hunch, 0, 0];
    o.rleg = [q(0), 0, 0]; o.lleg = [q(Math.PI), 0, 0];
    let ra = q(Math.PI) * 0.5, la = q(0) * 0.5;
    if (e.casting > 0) { ra = -2.6 + Math.sin(age * 0.6) * 0.15; la = -2.6 - Math.sin(age * 0.6) * 0.15; }
    if (swing > 0) { const s = Math.sin(swing * Math.PI); ra -= s * 2.2; la -= s * 1.4; }
    o.rarm = [ra - hunch, 0, 0.1]; o.larm = [la - hunch, 0, -0.1];
    if (hunch) { o.rarm[3] = 0; o.rarm[5] = -1.5; o.larm[5] = -1.5; o.head[5] = -2; }
    return o;
  };

  /* skins */
  function paint(model, seed, colors, extra) {
    const s = new Skin(model, seed), mdl = D[model];
    for (const pn in mdl.parts) mdl.parts[pn].boxes.forEach((b, bi) => {
      const c = colors[pn + ':' + bi] !== undefined ? colors[pn + ':' + bi] : colors[pn] !== undefined ? colors[pn] : colors._;
      if (!c) { s.fill(pn, bi, 'all', () => [0, 0, 0, 0]); return; }
      const base = hex(Array.isArray(c) ? c[0] : c), v = Array.isArray(c) && c[1] !== undefined ? c[1] : 0.08;
      for (const f of ['bottom', 'top', 'front', 'back', 'left', 'right']) {
        const k = f === 'top' ? 1.1 : f === 'bottom' ? 0.8 : 1;
        s.fill(pn, bi, f, () => { const j = 1 + (s.r.next() - 0.5) * 2 * v; return [Math.min(255, base[0] * k * j), Math.min(255, base[1] * k * j), Math.min(255, base[2] * k * j)]; });
      }
    });
    if (extra) extra(s);
    return s.done();
  }
  const EYES = (W, K) => ({ W: hex(W || '#ffffff'), K: hex(K || '#101418') });
  const BLUB = [['#5ab4ff', '#2c78d8'], ['#ffa8d0', '#e070a8'], ['#9ff0c8', '#4cc08a'], ['#c8a8ff', '#8a68d8']];
  BLUB.forEach(([c, d], i) => {
    SP['blub_' + i] = () => paint('blub', 500 + i, { _: [c, 0.06], 'body:1': d, 'head:1': [c, 0.04], 'head:2': [c, 0.04], 'head:3': '#ffd8e8' }, (s) => {
      s.art('head', 0, 'front', ['.....', 'WK.KW', 'KK.KK', '..p..', '.....'], Object.assign(EYES(), { p: hex('#ff8ab8') }));
      for (const bi of [1, 2]) s.fill('head', bi, 'front', (x, y, w, h) => (x > 0 && y > 0 && y < h - 1) ? hex('#ffb8d8') : null);
      s.fill('body', 0, 'bottom', () => hex(i === 0 ? '#c8ecff' : '#fff4f8'));
    });
  });
  SP.licker = () => paint('licker', 520, { _: ['#7ad6b0', 0.08], 'shell:0': ['#e8826a', 0.1], 'shell:1': ['#f4a07a', 0.08], 'shell:2': ['#c8604c', 0.08], tongue: '#ff6aa8' }, (s) => {
    for (const bi of [0, 1]) s.fill('shell', bi, 'top', (x, y) => ((x + (y >> 1) * 2) % 4 === 0 || y % 3 === 0) ? hex('#a84a3a') : null);
    s.art('head', 0, 'front', ['....', 'K..K', '....'], EYES());
  });
  SP.singer = () => paint('singer', 530, { _: ['#f2eef6', 0.05], 'robe:0': ['#f2eef6', 0.05], 'robe:1': ['#ffe4f0', 0.05], 'robe:2': '#ff8fc8', 'head:1': ['#ff8fc8', 0.1], 'head:2': '#5ff0e0', rarm: '#f8f0f4', larm: '#f8f0f4', ribbon: ['#5ff0e0', 0.12] }, (s) => {
    s.fill('robe', 0, 'front,left,right,back', (x, y, w, h) => y > h - 3 ? hex('#ff8fc8') : y % 4 === 0 ? hex('#c8f8f0') : null);
    s.art('head', 0, 'front', ['......', '.CC.CC', '.CK.KC', '......', '..pp..', '......'], { C: hex('#5ff0e0'), K: hex('#0e6e68'), p: hex('#ffb0d8') });
    s.fill('head', 1, 'front,back', (x, y, w) => (x % 2 === 0) ? hex('#ffc0e0') : null);
  });
  SP.seedling = () => paint('seedling', 540, { _: ['#4cb878', 0.1], 'bulb:1': '#8af0a0', 'bulb:2': '#8af0a0', leg1: '#2e7a4c', leg2: '#2e7a4c' }, (s) => {
    s.art('bulb', 0, 'front', ['......', '.R..R.', '......', 'kWkWkW', '.kkkk.', '......'], { R: hex('#ff3a5a'), k: hex('#1a3020'), W: hex('#f4f0e0') });
    s.fill('bulb', 0, 'top', (x, y) => (x + y) % 3 === 0 ? hex('#ff8fc8') : null);
  });
  SP.nester = () => paint('nester', 550, { _: ['#2a4a4a', 0.1], 'body:1': '#ff7a5a', 'head:2': '#ff7a5a', 'head:3': '#ff7a5a', jaw: '#3a2a2a', tail: ['#2a4a4a', 0.1] }, (s) => {
    s.fill('body', 0, 'left,right,top', (x, y) => (x % 4 === 0) ? hex('#ff9a6a') : null);
    s.art('head', 1, 'front', ['.....', 'R...R', '.....', 'WkWkW'], { R: hex('#ffe040'), W: hex('#f4f0e0'), k: hex('#1a1010') });
    s.fill('jaw', 0, 'front', (x) => x % 2 ? hex('#f4f0e0') : null);
  });
  SP.sprout = () => paint('sprout', 560, { _: ['#e870a8', 0.08], 'head:1': '#ffb0d8', 'head:2': '#ffb0d8', t1: '#40d8c0', t2: '#40d8c0', t3: '#40d8c0', t4: '#40d8c0' }, (s) => {
    s.art('head', 0, 'front', ['........', '..WWWW..', '.WKKKKW.', '.WKCCKW.', '.WKKKKW.', '..WWWW..', '........', '.k.k.k..'], { W: hex('#ffffff'), K: hex('#2a1838'), C: hex('#5ff0e0'), k: hex('#7a1840') });
    for (const pn of ['t1', 't2', 't3', 't4']) s.fill(pn, 0, 'front,back,left,right', (x, y) => y % 3 === 2 ? hex('#a8fff0') : null);
  });
  SP.crested_sentinel = () => paint('crested_sentinel', 570, { _: ['#3a6a7a', 0.08], 'head:1': ['#ff9a5a', 0.12], 'head:2': '#f4f0e0' }, (s) => {
    s.fill('head', 1, 'front,back', (x, y, w, h) => (y < 2 || (x * 3 + y) % 5 === 0) ? hex('#ffd04a') : null);
    s.art('head', 0, 'front', ['........', '.RR..RR.', '.RK..KR.', '........', '..kkkk..', '........'], { R: hex('#ffd04a'), K: hex('#101010'), k: hex('#101010') });
    s.fill('body', 0, 'top,left,right', (x, y) => ((x >> 1) + (y >> 1)) % 3 === 0 ? hex('#5a8a9a') : null);
  });
  SP.groobler_sentinel = () => paint('groobler_sentinel', 580, { _: ['#6a3a7a', 0.08], 'body:1': ['#8a4a9a', 0.08], 'head:1': '#ff8fc8', jaw: '#3a1a40', rarm: '#5a2a6a', larm: '#5a2a6a' }, (s) => {
    s.art('head', 0, 'front', ['..........', '.YY....YY.', '.YK....KY.', '..........', '.WkWkWkWk.', '.kkkkkkkk.', '.kkkkkkkk.'], { Y: hex('#c8ff4a'), K: hex('#101010'), W: hex('#f4f0e0'), k: hex('#200818') });
    s.fill('body', 0, 'front,left,right,back', (x, y) => y % 4 === 0 ? hex('#ff8fc8') : null);
  });
  const sculkSkin = (model, seed, accent, crown) => () => paint(model, seed, { _: ['#1a1418', 0.1], 'body:1': ['#3a0a1a', 0.1], 'body:2': ['#3a0a1a', 0.1] }, (s) => {
    const mdl = D[model];
    // red sculk veins over black
    for (const pn in mdl.parts) mdl.parts[pn].boxes.forEach((b, bi) => s.fill(pn, bi, 'front,back,left,right,top', (x, y) => ((x * 7 + y * 3 + bi) % 9 === 0) ? hex(accent) : ((x + y * 5) % 13 === 0 ? hex('#5ff0e0') : null)));
    s.art('head', 0, 'front', ['........', '........', '.CC..CC.', '.CC..CC.', '........', '..aaaa..', '.a....a.', '........'], { C: hex('#5ff0e0'), a: hex(accent) });
    if (crown) for (let bi = 1; bi < mdl.parts.head.boxes.length; bi++) s.fill('head', bi, 'all', () => hex(bi === 1 ? '#c02848' : '#ff5a8a'));
  });
  SP.sculk_mage = sculkSkin('sculk_mage', 590, '#ff4f8f', true);
  SP.sculk_slasher = sculkSkin('sculk_slasher', 591, '#ff4f8f', false);
  SP.monarch = sculkSkin('monarch', 592, '#ff4f8f', true);
  SP.monarch_echo = () => paint('monarch', 593, { _: ['#5ff0e0', 0.15] }, (s) => s.art('head', 0, 'front', ['........', '........', '.WW..WW.', '.WW..WW.'], { W: hex('#ffffff') }));
  // the echo golem: coral stone with a soul core; the monstrosity: black sculk with red veins
  SP.echo_golem = () => paint('iron_golem', 594, { _: ['#cc634b', 0.1], 'body:1': '#bd5642', 'head:1': '#e68863' }, (s) => {
    s.fill('body', 0, 'front', (x, y, w, h) => (Math.abs(x - w / 2) < 3 && Math.abs(y - h / 2) < 3) ? hex(Math.abs(x - w / 2) + Math.abs(y - h / 2) < 2 ? '#e0fffa' : '#3ad8c8') : ((x + y) % 7 === 0 ? hex('#ef9a6a') : null));
    s.art('head', 0, 'front', ['........', '........', '.CC..CC.', '.CC..CC.', '........', '........'], { C: hex('#5ff0e0') });
    for (const pn of ['rarm', 'larm', 'rleg', 'lleg']) s.fill(pn, 0, 'front,back,left,right', (x, y) => y % 6 === 0 ? hex('#ef9a6a') : null);
  });
  SP.monstrosity = () => paint('iron_golem', 595, { _: ['#1a1418', 0.12], 'body:1': '#3a0a1a' }, (s) => {
    for (const pn of ['head', 'body', 'rarm', 'larm', 'rleg', 'lleg']) D.iron_golem.parts[pn].boxes.forEach((b, bi) => s.fill(pn, bi, 'front,back,left,right,top', (x, y) => ((x * 5 + y * 3) % 7 === 0) ? hex('#ff4f8f') : null));
    s.fill('body', 0, 'front', (x, y, w, h) => (Math.abs(x - w / 2) < 3 && Math.abs(y - h / 2) < 3) ? hex('#ff7aa8') : null);
    s.art('head', 0, 'front', ['........', '........', '.RR..RR.', '.RR..RR.'], { R: hex('#ff3a6a') });
  });
  SP.harmonizer = () => paint('singer', 596, { _: ['#2a1020', 0.08], 'robe:2': '#ff3a6a', 'head:1': ['#ff3a6a', 0.1], 'head:2': '#ff3a6a', ribbon: ['#ff3a6a', 0.12] }, (s) => {
    s.art('head', 0, 'front', ['......', '.RR.RR', '.RK.KR', '......', '.kkkk.', '.k..k.'], { R: hex('#ff4f8f'), K: hex('#ffffff'), k: hex('#ff4f8f') });
  });

  /* ------------------------------------------------------------ */
  /* Creatures                                                    */
  /* ------------------------------------------------------------ */
  const shard = (n, chance) => [ECHO, n, chance];
  // ambient wildlife
  add('blub', { w: 0.45, h: 0.6, hp: 6, speed: 0.55, init: (m) => { if (m.variant === undefined) m.variant = rnd() < 0.55 ? 0 : 1 + Math.floor(rnd() * 3); },
    skinFor: (e) => 'blub_' + ((e.variant || 0) % 4), glow: (e) => (e.variant || 0) === 0, drops: [shard(1, 0.15)],
    tick: (m) => { if (rnd() < 0.004) snd(m, 'chicken', 0.4, 2.2); if ((m.variant || 0) === 0 && rnd() < 0.03) fx(m, 'soul', 1, 0.3); } });
  add('licker', { w: 0.9, h: 0.55, hp: 14, speed: 0.3, drops: [[B.sift_grass, 1], shard(1, 0.1)],
    tick: (m) => { if (m.lick > 0) m.lick--; else if (rnd() < 0.006 && m.onGround) { m.lick = 20; snd(m, 'slime', 0.3, 1.6); } } });
  // singers sing: they calm the sifters around them and sing echo golems into being
  add('singer', { w: 0.6, h: 2.2, hp: 24, speed: 0.4, glow: () => true, drops: [shard(2, 0.6)], interact: singerInteract,
    ai: (m) => { if (m.singing > 0) { m.moveForward = m.moveStrafe = 0; m.path = null; return; } m.aiTick(); },
    tick: (m) => {
      if (!m.vyHold) m.vyHold = 0;
      if (m.singing > 0) {
        m.singing--;
        if (m.singing % 8 === 0) { fx(m, 'happy', 3, 0.8, m.h + 0.2); snd(m, 'villager', 0.5, 1.6 + Math.sin(m.age * 0.4) * 0.4); }
        if (m.singing % 20 === 0) for (const e of m.world.entities) if (e.def && e.def.sift && e.hostile && e.dist2(m.x, m.y, m.z) < 100) { e.calmed = 120; e.target = null; }
      } else if (rnd() < 0.003) m.singing = 80;
    } });
  function singerInteract(m, p, game) {
    const held = p.held;
    if (held && held.id === B.soul_block) {
      if (!p.creative) p.consumeHeld(1);
      m.singing = 100;
      const g = E.spawnMob(m.world, 'echo_golem', m.x + Math.cos(m.yaw) * 2, m.y, m.z + Math.sin(m.yaw) * 2);
      if (g) { g.persistent = true; g.owner = p.isRemote ? 'guest' : 'host'; fx(g, 'soul', 30, 1.5); }
      if (game && game.chatMessage) game.chatMessage('§bThe Singer sings an Echo Golem into being!');
      return true;
    }
    if (held && held.id === ECHO) {
      if (!p.creative) p.consumeHeld(1);
      m.singing = 80;
      if (p.addEffect) p.addEffect('regen', 200, 1);
      if (game && game.chatMessage) game.chatMessage('§dThe Singer\'s song soothes you.');
      return true;
    }
    m.singing = Math.max(m.singing || 0, 40);
    if (game && game.chatMessage && !m._told) { m._told = true; game.chatMessage('§7The Singer hums. (It would love an echo shard... and with a soul block, it can sing an Echo Golem.)'); }
    return true;
  }
  // echo golems help everyone: they fight the Sift's monsters
  function golemFind(m) {
    let best = null, bd = 16 * 16;
    for (const e of m.world.entities) {
      if (!e.living || e.removed || e.health <= 0 || !e.hostile || e.isPlayer || e === m) continue;
      const d = e.dist2(m.x, m.y, m.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  add('echo_golem', { w: 1.4, h: 2.7, hp: 80, speed: 0.55, model: 'iron_golem', skin: 'echo_golem', neutral: true, attack: 11, glow: () => false, findTarget: golemFind,
    onHit: (m, t) => { t.vy += 0.5; m.attackAnim = 10; fx(t, 'soul', 6, 0.6); }, tick: (m) => { if (m.attackAnim > 0) m.attackAnim--; if (rnd() < 0.02) fx(m, 'soul', 1, 0.6, 1.6); },
    drops: [[B.soul_block, 1], [B.sift_stone, 4]], init: (m) => { m.persistent = true; } });
  // sifters
  add('seedling', { w: 0.5, h: 0.75, hp: 10, hostile: true, speed: 0.85, attack: 3, findTarget: hostileFind(16), drops: [shard(1, 0.25), [B.tidebloom, 1, 0.15]],
    tick: (m) => { if (m.onGround && Math.hypot(m.vx, m.vz) > 0.02 && rnd() < 0.2) m.vy = 0.3; } });
  add('nester', { w: 0.9, h: 1.9, hp: 26, hostile: true, speed: 1.05, attack: 6, findTarget: hostileFind(20), attackFn: nesterAttack, drops: [shard(1, 0.4), [352, 2]],
    tick: (m) => { if (m.biteAnim > 0) m.biteAnim--; if (m.lunging && m.onGround && m.age - (m.lungeT || 0) > 4) m.lunging = false; if (m.calmed > 0) m.calmed--; } });
  function nesterAttack(m, t, d, see) {
    if (m.attackTime > 0) {
      // circle the hero while the bite recovers
      m.faceTowards(t.x, t.z, 0.4);
      if (d < 4) { m.moveStrafe = (m.id % 2 ? 1 : -1) * 0.8; m.moveForward = -0.2; m.path = null; }
      return;
    }
    if (see && d < 7 && d > 2.2 && m.onGround && !m.lunging) {
      const dx = t.x - m.x, dz = t.z - m.z, l = Math.hypot(dx, dz) || 1;
      m.vx = dx / l * 0.55; m.vz = dz / l * 0.55; m.vy = 0.38; m.lunging = true; m.lungeT = m.age;
      m.faceTowards(t.x, t.z, 3); snd(m, 'wolf', 1, 0.7);
    }
    if (d < 2.3 && Math.abs(t.y - m.y) < 2) {
      m.attackTime = 30; m.biteAnim = 8; m.swing();
      if (hurt(m, t, 6)) { t.vx += (t.x - m.x) * 0.2; t.vz += (t.z - m.z) * 0.2; }
      snd(m, 'wolf', 1, 1.3);
    }
  }
  add('sprout', { w: 0.8, h: 1.3, hp: 14, hostile: true, fly: true, flySpeed: 0.02, findTarget: hostileFind(24), ai: sproutAI, drops: [shard(1, 0.3)], minY: 20, maxY: 120 });
  function sproutAI(m) {
    m.moveForward = m.moveStrafe = 0; m.jumping = false;
    if (m.attackTime > 0) m.attackTime--;
    if (m.calmed > 0) m.calmed--;
    if (!m.target || m.target.removed || m.target.health <= 0 || m.age % 20 === 0) m.target = m.def.findTarget(m);
    const t = m.target;
    let tx, ty, tz;
    if (t) {
      const d = m.distTo(t);
      const a = m.age * 0.02 + (m.id || 0);
      tx = t.x + Math.cos(a) * 6; ty = t.y + 3.5; tz = t.z + Math.sin(a) * 6;
      m.lookYaw = Math.atan2(-(t.x - m.x), -(t.z - m.z)); m.yaw = m.lookYaw;
      if (m.attackTime <= 0 && d < 20 && m.canSee(t)) { m.attackTime = 45; fire(m, 'seed', t, 0.7, 4, false); snd(m, 'slime', 0.8, 1.8); }
    } else {
      if (!m.home) m.home = [m.x, m.y, m.z];
      if (!m.wp || rnd() < 0.01) m.wp = [m.home[0] + (rnd() - 0.5) * 20, m.home[1] + (rnd() - 0.5) * 6, m.home[2] + (rnd() - 0.5) * 20];
      [tx, ty, tz] = m.wp; m.lookYaw = undefined;
      m.faceTowards(m.x + m.vx * 10, m.z + m.vz * 10, 0.2);
    }
    const dx = tx - m.x, dy = ty - m.y, dz = tz - m.z, l = Math.hypot(dx, dy, dz);
    if (l > 0.5) { const f = Math.min(0.025, l * 0.01); m.vx += dx / l * f; m.vy += dy / l * f; m.vz += dz / l * f; }
  }
  add('crested_sentinel', { w: 1.3, h: 1.3, hp: 30, hostile: true, speed: 0.25, findTarget: hostileFind(22), attackFn: crestedAttack, drops: [shard(2, 0.5)],
    tick: (m) => { if (m.shake > 0) { m.shake--; if (m.shake % 4 === 0 && m.target && !m.target.removed) { const b = fire(m, 'seed', m.target, 0.55, 30, true); b.vy += 0.15; } } if (m.calmed > 0) m.calmed--; } });
  function crestedAttack(m, t, d, see) {
    m.faceTowards(t.x, t.z, 0.4);
    if (d < 8) m.moveForward = -0.5; else if (d > 14) m.moveForward = 0.6; else { m.moveForward = 0; m.path = null; }
    if (see && d < 20 && m.attackTime <= 0 && !m.shake) { m.attackTime = 90; m.shake = 20; snd(m, 'villager', 1, 0.6); }
  }
  add('groobler_sentinel', { w: 0.9, h: 2.6, hp: 34, hostile: true, speed: 0.2, findTarget: hostileFind(24), attackFn: groobAttack, drops: [shard(2, 0.6)],
    tick: (m) => { if (m.calmed > 0) m.calmed--; } });
  function groobAttack(m, t, d, see) {
    m.faceTowards(t.x, t.z, 0.3);
    if (d < 10) m.moveForward = -0.6; else { m.moveForward = 0; m.path = null; }
    if (see && d < 24 && m.attackTime <= 0) {
      m.charge = (m.charge || 0) + 1;
      if (m.charge === 1) snd(m, 'ghast', 0.6, 0.6);
      if (m.charge >= 22) { m.charge = 0; m.attackTime = 100; fire(m, 'groob', t, 0.55, 2, false); snd(m, 'shoot', 1, 0.6); }
    } else if (m.charge > 0) m.charge--;
  }
  // sculkers
  add('sculk_mage', { hp: 22, hostile: true, speed: 0.6, findTarget: hostileFind(22), attackFn: mageAttack, drops: [shard(2, 0.5), [B.red_sculk, 2]],
    tick: (m) => { if (m.casting > 0) m.casting--; if (m.calmed > 0) m.calmed--; if (rnd() < 0.02) fx(m, 'soul', 1, 0.4, 2); } });
  function mageAttack(m, t, d, see) {
    m.faceTowards(t.x, t.z, 0.5);
    if (d < 6) m.moveForward = -0.9; else if (d > 13) m.moveForward = 0.8; else { m.moveForward = 0; m.path = null; }
    if (d < 3 && rnd() < 0.03 && E.teleportRandom) { E.teleportRandom(m, 8); return; }
    if (see && d < 20 && m.attackTime <= 0) { m.casting = 16; m.attackTime = 55; setTimeoutTick(m, 10, () => { if (!m.removed && m.health > 0 && t && !t.removed) fire(m, 'orb', t, 0.6, 3, false); }); snd(m, 'blaze', 0.7, 1.4); }
  }
  add('sculk_slasher', { hp: 26, hostile: true, speed: 1.15, attack: 5, findTarget: hostileFind(22), attackFn: slasherAttack, drops: [shard(1, 0.45), [B.red_sculk, 1]],
    tick: (m) => { if (m.calmed > 0) m.calmed--; } });
  function slasherAttack(m, t, d, see) {
    // dash in, then rake with the long claws (they reach far)
    if (see && d > 3 && d < 8 && m.onGround && (m.dashCd || 0) < m.age) {
      const dx = t.x - m.x, dz = t.z - m.z, l = Math.hypot(dx, dz) || 1;
      m.vx = dx / l * 0.75; m.vz = dz / l * 0.75; m.vy = 0.2; m.dashCd = m.age + 60; snd(m, 'zombie', 0.8, 1.6);
    }
    if (d < 3.2 && m.attackTime <= 0 && Math.abs(t.y - m.y) < 2 && see) { m.attackTime = 18; m.swing(); hurt(m, t, 5); }
    if (d < 1.5) { m.faceTowards(t.x, t.z, 0.6); m.moveForward = 1; }
  }
  // tick-based timers that also work for mobs on the host
  function setTimeoutTick(m, n, fn) { (m._timers || (m._timers = [])).push([m.age + n, fn]); }
  const mobTick = E.Mob.prototype.tick;
  E.Mob.prototype.tick = function () {
    mobTick.apply(this, arguments);
    if (this._timers && this._timers.length) {
      const now = this.age, due = this._timers.filter(t => t[0] <= now);
      this._timers = this._timers.filter(t => t[0] > now);
      for (const [, fn] of due) try { fn(); } catch (e) { console.warn(e); }
    }
  };

  /* ------------------------------------------------------------ */
  /* Bosses                                                       */
  /* ------------------------------------------------------------ */
  add('monarch', { w: 1.1, h: 3.1, hp: 320, hostile: true, speed: 0.75, scale: 1.55, boss: 'The Monarch', findTarget: hostileFind(40), ai: monarchAI, onDeath: monarchDeath, noSave: false,
    init: (m) => { m.persistent = true; } });
  add('monarch_echo', { w: 1.1, h: 3.1, hp: 90, hostile: true, speed: 0.85, scale: 1.55, model: 'monarch', skin: 'monarch_echo', findTarget: hostileFind(40), ai: monarchAI, spectral: true, noSave: true, drops: [shard(3, 1)] });
  function adds(m) { let n = 0; for (const e of m.world.entities) if (e.summoner === m && !e.removed && e.health > 0) n++; return n; }
  function summon(m, type) {
    const a = rnd() * Math.PI * 2, x = m.x + Math.cos(a) * 3, z = m.z + Math.sin(a) * 3;
    const s = E.spawnMob(m.world, type, x, m.y + 0.5, z);
    if (s) { s.summoner = m; s.persistent = true; fx(s, 'soul', 16, 1); }
    return s;
  }
  function monarchAI(m) {
    const w = m.world;
    m.moveForward = m.moveStrafe = 0; m.jumping = false;
    if (m.attackTime > 0) m.attackTime--;
    if (m.casting > 0) m.casting--;
    if (!m.def.spectral) w.boss = m;
    if (!m.target || m.target.removed || m.target.health <= 0 || m.age % 20 === 0) m.target = m.def.findTarget(m);
    const t = m.target;
    if (!t) { if (m.age % 60 === 0) m.yaw += 0.6; return; }
    const d = m.distTo(t), see = m.canSee(t);
    m.faceTowards(t.x, t.z, 0.35);
    m.lookYaw = m.yaw;
    // the echo appears once the Monarch is wounded
    if (!m.def.spectral && !m.echoed && m.health < m.maxHealth * 0.75) {
      m.echoed = true;
      const e = summon(m, 'monarch_echo');
      if (e) { e.summoner = m; snd(m, 'roar', 2, 1.4); }
      announce(m, '§dThe Monarch calls forth its echo!');
    }
    // its court: two slashers and two mages
    if (!m.def.spectral && m.age % 500 === 120 && adds(m) < 6) {
      for (const k of ['sculk_slasher', 'sculk_slasher', 'sculk_mage', 'sculk_mage']) summon(m, k);
      announce(m, '§dThe Monarch summons its court!');
      snd(m, 'roar', 1.5, 0.9);
    }
    if (d < 3.6 && m.attackTime <= 0) {
      // a sweep of the claws hits everything around it
      m.attackTime = 26; m.swing();
      for (const e of w.entities) {
        if (!e.living || e === m || e.health <= 0 || (e.def && e.def.sift) || e.summoner === m) continue;
        if (e.dist2(m.x, m.y, m.z) > 3.8 * 3.8) continue;
        if (hurt(m, e, 9)) { const dx = e.x - m.x, dz = e.z - m.z, l = Math.hypot(dx, dz) || 1; e.vx += dx / l * 0.6; e.vz += dz / l * 0.6; e.vy += 0.35; }
      }
      fx(m, 'soul', 12, 3, 1);
    } else if (see && d < 26 && m.attackTime <= 0 && m.age % 70 < 3) {
      m.casting = 20; m.attackTime = 40;
      for (let i = 0; i < 3; i++) setTimeoutTick(m, 6 + i * 5, () => { if (!m.removed && t && !t.removed) fire(m, 'orb', t, 0.75, 8, false); });
      snd(m, 'blaze', 1, 0.7);
    } else if (d > 4) {
      // stride, or leap at far targets
      m.moveForward = 1;
      if (d > 12 && m.onGround && m.age % 80 === 0) { const dx = t.x - m.x, dz = t.z - m.z, l = Math.hypot(dx, dz) || 1; m.vx = dx / l * 0.9; m.vz = dz / l * 0.9; m.vy = 0.6; snd(m, 'roar', 1, 1.2); }
      if (m.collidedH && m.onGround) m.jumping = true;
    }
  }
  function announce(m, text) {
    const g = DL.game;
    if (g && g.player && g.player.world === m.world && g.player.dist2(m.x, m.y, m.z) < 80 * 80) g.chatMessage(text);
    if (N && N.host) for (const c of N.host.conns) if (c.rp && c.rp.dist2(m.x, m.y, m.z) < 80 * 80) c.send({ t: 'msg', m: text });
  }
  function monarchDeath(m, killer) {
    const w = m.world;
    w.boss = null;
    for (const e of w.entities) if (e.summoner === m && !e.removed) { e.health = 0; e.damage('void', 999); }
    w.spawnItem(m.x, m.y + 1, m.z, I.stack(Sift.CROWN), true);
    w.spawnItem(m.x, m.y + 1, m.z, I.stack(ECHO, 16), true);
    w.spawnItem(m.x, m.y + 1, m.z, I.stack(B.soul_block, 2), true);
    const g = DL.game;
    if (g && g.meta) { g.meta.monarchs = g.meta.monarchs || {}; if (m.hallKey) g.meta.monarchs[m.hallKey] = true; }
    announce(m, '§6The Monarch has fallen! Its crown is yours.');
    if (killer && killer === (g && g.player) && DL.Extras && DL.Extras.grant) DL.Extras.grant('monarch');
    snd(m, 'roar', 2, 0.5);
    fx(m, 'soul', 60, 3);
  }
  add('sculk_monstrosity', { w: 1.8, h: 3.6, hp: 200, hostile: true, speed: 0.6, model: 'iron_golem', skin: 'monstrosity', scale: 1.35, boss: 'Sculk Monstrosity', attack: 12,
    findTarget: hostileFind(32), attackFn: monstrosityAttack, onHit: (m, t) => { t.vy += 0.6; m.attackAnim = 10; },
    tick: (m) => { if (m.attackAnim > 0) m.attackAnim--; m.world.boss = m; if (m.charging > 0) { m.charging--; m.vx = Math.cos(m.chargeA) * 0.55; m.vz = Math.sin(m.chargeA) * 0.55; for (const e of m.world.entities) if (e.isPlayer && e.health > 0 && e.dist2(m.x, m.y, m.z) < 4) { hurt(m, e, 10); e.vy += 0.5; m.charging = 0; } } },
    onDeath: (m) => { m.world.boss = null; m.world.spawnItem(m.x, m.y + 1, m.z, I.stack(ECHO, 10), true); m.world.spawnItem(m.x, m.y + 1, m.z, I.stack(Sift.ECHO_BLADE_ID || 601), true); }, init: (m) => { m.persistent = true; } });
  function monstrosityAttack(m, t, d, see) {
    if (m.charging > 0) return;
    if (see && d > 6 && d < 18 && m.onGround && (m.chargeCd || 0) < m.age) {
      m.chargeA = Math.atan2(t.z - m.z, t.x - m.x); m.charging = 26; m.chargeCd = m.age + 120; m.path = null; snd(m, 'roar', 1.6, 0.6);
      return;
    }
    if (see && d < 6 && (m.flameCd || 0) < m.age) {
      // soul flame: a burst of blue fire
      m.flameCd = m.age + 90;
      for (const e of m.world.entities) if (e.living && e !== m && !(e.def && e.def.sift) && e.health > 0 && e.dist2(m.x, m.y, m.z) < 25) { hurt(m, e, 4); e.fire = Math.max(e.fire || 0, 100); e.soulFire = 80; }
      fx(m, 'soul', 40, 4, 1); snd(m, 'fizz', 1.5, 0.6);
    }
    const reach = m.w * 0.5 + t.w * 0.5 + 1.2;
    if (d < reach && m.attackTime <= 0) { m.attackTime = 30; m.swing(); if (hurt(m, t, 12)) { t.vy += 0.6; m.attackAnim = 10; } }
  }
  add('harmonizer', { w: 1.2, h: 4.4, hp: 220, hostile: true, speed: 0.35, model: 'singer', skin: 'harmonizer', scale: 2, boss: 'The Harmonizer', glow: () => true,
    findTarget: hostileFind(36), attackFn: harmonizerAttack,
    tick: (m) => { m.world.boss = m; if (m.singing > 0) m.singing--; m.vy += 0.035; if (m.calmed > 0) m.calmed = 0; },
    onDeath: (m) => { m.world.boss = null; m.world.spawnItem(m.x, m.y + 1, m.z, I.stack(ECHO, 12), true); m.world.spawnItem(m.x, m.y + 1, m.z, I.stack(B.soul_block, 3), true); }, init: (m) => { m.persistent = true; } });
  function harmonizerAttack(m, t, d, see) {
    m.faceTowards(t.x, t.z, 0.3);
    if (d < 8) m.moveForward = -0.7; else if (d > 16) m.moveForward = 0.6; else { m.moveForward = 0; m.path = null; }
    if (see && d < 28 && m.attackTime <= 0) {
      // the screech: a ringing beam that ignores armour
      m.attackTime = 80; m.singing = 30;
      snd(m, 'ghast', 2, 0.5);
      setTimeoutTick(m, 12, () => {
        if (m.removed || !t || t.removed || t.health <= 0) return;
        const sx = m.x, sy = m.y + m.h * 0.8, sz = m.z, tx = t.x, ty = t.y + 1, tz = t.z, n = Math.ceil(Math.hypot(tx - sx, ty - sy, tz - sz) * 2);
        for (let i = 0; i < n; i++) if (m.world.fx) m.world.fx.particles('soul', sx + (tx - sx) * i / n, sy + (ty - sy) * i / n, sz + (tz - sz) * i / n, 1, 0.2);
        if (m.canSee(t)) { t.damage('sonic', fierce(m, 8), m); t.vx += (tx - sx) * 0.05; t.vz += (tz - sz) * 0.05; }
      });
    }
  }

  /* the Monarch waits in its hall */
  DL.SiftMobs = {
    hallTick(game, w, p) {
      const h = Sift.nearestHall(w.seed, p.x, p.z);
      if (!h || h[2] > 26) return;
      const meta = game.meta || {};
      if (meta.monarchs && meta.monarchs[h[3]]) return;
      if (!w.isReady(h[0], h[1]) || w.getBlock(h[0], Math.max(1, w.topSolidY(h[0], h[1]) - 1), h[1]) === 0) return;
      for (const e of w.entities) if (e.type === 'monarch' && !e.removed) return;
      if (w._monarchCd && w._monarchCd > game.tickCount) return;
      w._monarchCd = game.tickCount + 600;
      let y = w.topSolidY(h[0], h[1] - 3);
      const m = E.spawnMob(w, 'monarch', h[0] + 0.5, y, h[1] - 3 + 0.5);
      if (m) { m.hallKey = h[3]; announce(m, '§5The Monarch rises from its throne...'); A.play('roar', h[0], y, h[1], 2, 0.6); }
    }
  };
  // bosses keep their hall key across saves
  const ser = E.Mob.prototype.serialize;
  E.Mob.prototype.serialize = function () { const d = ser.apply(this, arguments); if (d && this.hallKey) d.hallKey = this.hallKey; if (d && this.echoed) d.echoed = 1; return d; };
  const fromSave = E.fromSave;
  E.fromSave = function (world, d) { const m = fromSave.apply(this, arguments); if (m && d) { if (d.hallKey) m.hallKey = d.hallKey; if (d.echoed) m.echoed = true; } return m; };

  /* glowing creatures and the spectral echo */
  const drawModel = RP.drawModel;
  RP.drawModel = function (type, e, pt, model, light, opts) {
    const def = e && e.def;
    if (def && def.glow && def.glow(e)) light = [15, 15];
    if (def && def.spectral) opts = Object.assign({}, opts || {}, { tint: [0.35, 0.95, 0.9, 0.55] });
    return drawModel.call(this, type, e, pt, model, light, opts);
  };

  /* ------------------------------------------------------------ */
  /* Who lives where                                              */
  /* ------------------------------------------------------------ */
  const HOSTILE = {
    0: [['seedling', 10], ['nester', 6], ['sprout', 6], ['crested_sentinel', 3], ['groobler_sentinel', 2]],
    1: [['nester', 8], ['crested_sentinel', 5], ['groobler_sentinel', 4], ['seedling', 4], ['sprout', 2]],
    2: [['sculk_slasher', 7], ['sculk_mage', 5], ['nester', 4], ['sprout', 3], ['harmonizer', 0.15]],
    3: [['sculk_slasher', 8], ['sculk_mage', 7], ['seedling', 4], ['sculk_monstrosity', 0.25]]
  };
  const PASSIVE = { 0: ['blub', 'blub', 'blub', 'singer', 'licker'], 1: ['licker', 'licker', 'blub'], 2: ['echo_golem', 'blub', 'licker'], 3: ['blub', 'singer'] };
  const BOSSES = new Set(['harmonizer', 'sculk_monstrosity']);
  function weighted(list) { let t = 0; for (const e of list) t += e[1]; let v = rnd() * t; for (const e of list) { v -= e[1]; if (v <= 0) return e[0]; } return list[0][0]; }
  const SURF = new Set([B.sift_turf, B.lullaby_moss, B.carapace_sand, B.red_sculk, B.sift_stone, B.carapace_rock]);
  function standableAt(w, x, y, z, h) {
    if (!SURF.has(w.getBlock(x, y - 1, z))) return false;
    for (let k = 0; k < Math.ceil(h); k++) { const b = w.getBlock(x, y + k, z); if (SOLID[b] || S.LIQUID[b]) return false; }
    return true;
  }
  function siftSpawn(world, player) {
    if (!player || player.health <= 0) return;
    let hostile = 0, passive = 0, bosses = 0;
    for (const e of world.entities) if (e instanceof E.Mob && !e.removed) { if (BOSSES.has(e.type) || e.type === 'monarch') bosses++; else if (e.hostile) hostile++; else passive++; }
    const tideNow = Sift.tide(world);
    const cap = tideNow === 'Endure' ? 34 : 24;
    const pick = (fn) => {
      for (let tries = 0; tries < 4; tries++) {
        const a = rnd() * Math.PI * 2, r = 24 + rnd() * 40;
        const x = Math.floor(player.x + Math.cos(a) * r), z = Math.floor(player.z + Math.sin(a) * r);
        if (!world.isReady(x, z)) continue;
        // a surface or a cave floor, top down
        const candidates = [];
        for (let y = Math.min(S.CH - 3, Math.floor(player.y) + 30); y > 14; y--) if (standableAt(world, x, y, z, 2)) { candidates.push(y); if (candidates.length > 3) break; }
        if (!candidates.length) continue;
        const y = candidates[Math.floor(rnd() * candidates.length)];
        if (fn(x, y, z)) return true;
      }
      return false;
    };
    if (world.difficulty > 0 && hostile < cap && world.totalTicks % 3 === 0) {
      pick((x, y, z) => {
        const bio = world.gen.siftBiome(x, z);
        let type = weighted(HOSTILE[bio] || HOSTILE[0]);
        if (BOSSES.has(type) && bosses > 0) return false;
        const def = MOBS[type];
        const yy = def.fly ? y + 4 + Math.floor(rnd() * 6) : y;
        const m = E.spawnMob(world, type, x + 0.5, yy, z + 0.5);
        if (m && tideNow === 'Endure') { m.maxHealth = Math.round(m.maxHealth * 1.5); m.health = m.maxHealth; }
        if (m && BOSSES.has(type)) { m.persistent = true; const g = DL.game; if (g && g.player === player) g.chatMessage('§5You feel something enormous stir nearby...'); }
        if (m && !def.fly && rnd() < 0.5 && type !== 'harmonizer' && type !== 'sculk_monstrosity') E.spawnMob(world, type, x + 1.5, y, z + 0.5);
        return !!m;
      });
    }
    if (passive < 16 && world.totalTicks % 200 === 0) {
      pick((x, y, z) => {
        if (world.getBlock(x, y - 1, z) === B.red_sculk) return false;
        const bio = world.gen.siftBiome(x, z);
        const list = PASSIVE[bio] || PASSIVE[0];
        const type = list[Math.floor(rnd() * list.length)];
        const n = type === 'blub' ? 2 + Math.floor(rnd() * 3) : 1;
        for (let k = 0; k < n; k++) E.spawnMob(world, type, x + 0.5 + (rnd() - 0.5) * 2, y, z + 0.5 + (rnd() - 0.5) * 2);
        return true;
      });
    }
  }
  const naturalSpawn = E.naturalSpawn;
  E.naturalSpawn = function (world, player) {
    if (world.dim === SIFT) return siftSpawn(world, player);
    return naturalSpawn.apply(this, arguments);
  };
  // the Sift's own build: soul block on top of a T of sift stone bricks makes an echo golem
  const afterPlace = GP.afterPlace;
  GP.afterPlace = function (id, x, y, z) {
    const r = afterPlace.apply(this, arguments);
    if (id !== B.soul_block || isGuest()) return r;
    const w = this.world, Bk = B.sift_stone_bricks;
    if (w.getBlock(x, y - 1, z) !== Bk || w.getBlock(x, y - 2, z) !== Bk) return r;
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      if (w.getBlock(x + dx, y - 1, z + dz) === Bk && w.getBlock(x - dx, y - 1, z - dz) === Bk) {
        for (const [a, b, c] of [[0, 0, 0], [0, -1, 0], [0, -2, 0], [dx, -1, dz], [-dx, -1, -dz]]) w.setBlock(x + a, y + b, z + c, 0, 0, 3);
        const g = E.spawnMob(w, 'echo_golem', x + 0.5, y - 2, z + 0.5);
        if (g) { g.persistent = true; this.spawnParticles('soul', x + 0.5, y - 1, z + 0.5, 40, 2); A.play('portal', x, y, z, 1, 1.6); this.chatMessage('§bAn Echo Golem awakens!'); }
        break;
      }
    }
    return r;
  };

  /* ------------------------------------------------------------ */
  /* Trills: flocks across the Sift's sky                         */
  /* ------------------------------------------------------------ */
  const FLOCKS = [];
  function tickTrills(w, p) {
    if (w.dim !== SIFT) { FLOCKS.length = 0; return; }
    while (FLOCKS.length < 4) {
      const a = rnd() * Math.PI * 2;
      const f = { x: p.x + Math.cos(a) * 60, y: p.y + 18 + rnd() * 25, z: p.z + Math.sin(a) * 60, h: a + Math.PI + (rnd() - 0.5), sp: 0.18 + rnd() * 0.1, t: 0, life: 600 + rnd() * 600, birds: [] };
      const n = 12 + Math.floor(rnd() * 14);
      for (let i = 0; i < n; i++) f.birds.push({ ox: (rnd() - 0.5) * 8, oy: (rnd() - 0.5) * 3, oz: (rnd() - 0.5) * 8, ph: rnd() * 6.28, c: rnd() < 0.5 ? [1, 0.75, 0.9] : [0.6, 1, 0.95] });
      FLOCKS.push(f);
    }
    for (let i = FLOCKS.length - 1; i >= 0; i--) {
      const f = FLOCKS[i];
      f.t++; f.h += Math.sin(f.t * 0.01) * 0.006;
      f.px = f.x; f.py = f.y; f.pz = f.z;
      f.x += Math.cos(f.h) * f.sp; f.z += Math.sin(f.h) * f.sp; f.y += Math.sin(f.t * 0.02) * 0.03;
      if (f.t > f.life || Math.hypot(f.x - p.x, f.z - p.z) > 140) FLOCKS.splice(i, 1);
    }
  }
  const gtick = GP.tick;
  GP.tick = function () {
    gtick.apply(this, arguments);
    if (this.inGame && this.world && this.player) tickTrills(this.world, this.player);
  };
  RP.renderTrills = function (world, pt) {
    if (world.dim !== SIFT || !FLOCKS.length) return;
    const cam = this.cam, v = this.view;
    const rt = [v[0], v[4], v[8]], up = [v[1], v[5], v[9]];
    DL.M4.multiply(this.mvp, this.proj, this.view);
    this.begin();
    const time = performance.now() / 1000;
    for (const f of FLOCKS) {
      const fx0 = (f.px === undefined ? f.x : f.px + (f.x - f.px) * pt), fy0 = (f.py === undefined ? f.y : f.py + (f.y - f.py) * pt), fz0 = (f.pz === undefined ? f.z : f.pz + (f.z - f.pz) * pt);
      const fade = Math.min(1, f.t / 60, (f.life - f.t) / 60);
      for (const b of f.birds) {
        const x = fx0 + b.ox + Math.sin(time * 1.3 + b.ph) * 0.6 - cam.x, y = fy0 + b.oy + Math.sin(time * 2 + b.ph) * 0.4 - cam.y, z = fz0 + b.oz + Math.cos(time * 1.1 + b.ph) * 0.6 - cam.z;
        const flap = Math.sin(time * 9 + b.ph) * 0.12, s = 0.13;
        // a little "v": two wings
        const P2 = (a, c) => [x + rt[0] * a + up[0] * c, y + rt[1] * a + up[1] * c, z + rt[2] * a + up[2] * c];
        const col = [b.c[0], b.c[1], b.c[2], fade];
        this.quadV([P2(-s * 2, flap), P2(0, -s * 0.3), P2(0, s * 0.3), P2(-s * 2, flap + s * 0.5)], null, col);
        this.quadV([P2(0, -s * 0.3), P2(s * 2, flap), P2(s * 2, flap + s * 0.5), P2(0, s * 0.3)], null, col);
      }
    }
    const gl = this.gl;
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    this.flush('quads', { fog: true });
    gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
  };
  const renderBillboards = RP.renderBillboards;
  RP.renderBillboards = function (world, pt) {
    const out = renderBillboards.apply(this, arguments);
    try { this.renderTrills(world, pt); } catch (e) { console.warn('trills', e); }
    return out;
  };

  /* ------------------------------------------------------------ */
  /* Spawn eggs for the creative inventory                        */
  /* ------------------------------------------------------------ */
  if (DL.Creative && DL.Creative.addEgg) {
    const eggs = [['blub', '#5ab4ff', '#ffd8e8'], ['licker', '#e8826a', '#7ad6b0'], ['singer', '#f2eef6', '#ff8fc8'], ['echo_golem', '#cc634b', '#3ad8c8'],
      ['seedling', '#4cb878', '#ff3a5a'], ['nester', '#2a4a4a', '#ff7a5a'], ['sprout', '#e870a8', '#40d8c0'], ['crested_sentinel', '#3a6a7a', '#ffd04a'],
      ['groobler_sentinel', '#6a3a7a', '#c8ff4a'], ['sculk_mage', '#1a1418', '#ff4f8f'], ['sculk_slasher', '#1a1418', '#5ff0e0'], ['monarch', '#3a0a1a', '#c02848'],
      ['sculk_monstrosity', '#1a1418', '#ff3a6a'], ['harmonizer', '#2a1020', '#ff3a6a']];
    eggs.forEach(([mob, a, b], i) => { try { DL.Creative.addEgg(mob, a, b, 610 + i); } catch (e) { console.warn('egg', mob, e); } });
  }
})();
