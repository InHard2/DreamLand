/*
 * DreamLand - modern survival: the hunger bar with saturation and exhaustion,
 * eating over time, golden apple effects, more food from animals, swimming,
 * horse taming with a horse inventory (saddle and horse armour), long-press
 * to use on touch screens, and mob interactions for multiplayer guests.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, E = DL.Entities, I = DL.Items, M = DL.Models, G = DL.GUI, A = DL.Audio, In = DL.Input, N = DL.Net;
  const GP = DL.Game.prototype, RP = DL.Renderer.prototype, PL = E.Player.prototype;
  const Tex = DL.Tex, St = DL.Structures, W = DL.Wishlist || {};
  const M4 = DL.M4;
  const rnd = Math.random;
  const isGuest = () => !!(N && N.client);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ------------------------------------------------------------ */
  /* New items: food from every animal, sugar, pumpkin pie,       */
  /* horse armour                                                 */
  /* ------------------------------------------------------------ */
  const ids = {};
  function item(id, name, o, art) {
    if (I.get(id)) { console.warn('survival: item id taken', id, name); return; }
    I._def(id, name, o);
    ids[name] = id;
    if (art) Tex.ITEM_ART[name] = art;
  }
  const MEAT = (o, R, r, w) => ({ o, R, r, w });
  const meatSlab = ['................', '................', '.....oooooo.....', '...ooRRRRRRoo...', '..oRRrRRRRwRRo..', '.oRRRRRwwRRRRRo.', '.oRwRRRRRRRrRRo.',
    '.oRRwwRRRRRRRwo.', '..oRRRRRrRRRRRo.', '..oRRRRRRRwwRo..', '...ooRRRRRRRo...', '.....ooooooo....'];
  const drumstick = ['................', '................', '....oooooo......', '...oRRRRRRo.....', '..oRRrRRRRRo....', '..oRRRRRRRRRo...', '..oRrRRRRRRRo...',
    '...oRRRRRRRRo...', '....oRRRRRRo....', '.....oooRRo.....', '.......owwwo....', '........owwwo...', '.........owo....'];
  const shank = ['................', '.....oooo.......', '....oRRRRoo.....', '...oRRrRRRRo....', '...oRRRRRwRo....', '...oRwRRRRRo....', '....oRRRRRo.....',
    '.....oRRRo......', '......owo.......', '.......owo......', '........owwo....', '........owwwo...', '.........oo.....'];
  item(520, 'raw_beef', { display: 'Raw Beef' }, [meatSlab, MEAT([110, 20, 24], [204, 52, 52], [160, 30, 34], [242, 204, 204]), 1]);
  item(521, 'steak', { display: 'Steak' }, [meatSlab, MEAT([64, 32, 14], [150, 86, 44], [112, 60, 28], [206, 156, 104]), 1]);
  item(522, 'raw_chicken', { display: 'Raw Chicken' }, [drumstick, MEAT([150, 90, 80], [242, 192, 182], [214, 150, 140], [250, 246, 236]), 1]);
  item(523, 'cooked_chicken', { display: 'Cooked Chicken' }, [drumstick, MEAT([96, 52, 18], [204, 134, 62], [168, 100, 40], [240, 230, 210]), 1]);
  item(524, 'raw_mutton', { display: 'Raw Mutton' }, [shank, MEAT([110, 24, 28], [196, 58, 58], [150, 34, 38], [240, 236, 226]), 1]);
  item(525, 'cooked_mutton', { display: 'Cooked Mutton' }, [shank, MEAT([66, 32, 14], [158, 92, 48], [118, 64, 30], [240, 232, 214]), 1]);
  if (!I.byName.sugar) item(526, 'sugar', { display: 'Sugar' }, [['................', '................', '................', '................', '................', '........w.......',
    '.....w.wWw.w....', '....wWwWWwWw....', '...wWWWWWWWWw...', '..wWWwWWWWwWWw..', '..wwwwwwwwwwww..'], { w: [214, 218, 224], W: [252, 252, 255] }, 2]);
  item(527, 'pumpkin_pie', { display: 'Pumpkin Pie' }, [['................', '................', '................', '.....oooooo.....', '...ooccccccoo...', '..occOOOOOOcco..',
    '.ocOOOoOOOOoOco.', '.ocOOOOOOoOOOco.', '.occOOOOOOOOcco.', '..occccccccccco.', '...oooooooooo...'], { o: [110, 60, 20], c: [214, 164, 92], O: [226, 136, 44] }, 2]);
  const HARMOR = ['................', '..........oo....', '.........oLmo...', '........oLmmo...', '.......oLmmmdo..', '......oLmmmmdo..', '.....oLmmmmdo...',
    '....oLmmmmdo....', '...oLmmoooddo...', '..oLmmo..oddo...', '..oLmo....odo...', '..oLmo....odo...', '..oddo....oddo..', '..oooo....oooo..'];
  const HA = [['leather', 528, [50, 24, 10], [182, 118, 70], [150, 88, 46], [110, 60, 30], 3],
    ['iron', 529, [50, 50, 50], [245, 245, 245], [212, 212, 212], [160, 160, 160], 5],
    ['golden', 530, [90, 60, 0], [255, 250, 160], [250, 214, 60], [200, 150, 20], 7],
    ['diamond', 531, [10, 60, 60], [200, 255, 250], [80, 230, 220], [30, 160, 150], 11]];
  const HORSE_ARMOR = {}; // item id -> [index 1..4, armour points]
  HA.forEach(([mat, id, o, L, m, d, pts], i) => {
    item(id, mat + '_horse_armor', { display: (mat === 'golden' ? 'Golden' : mat[0].toUpperCase() + mat.slice(1)) + ' Horse Armor', maxStack: 1, tab: 'combat' }, [HARMOR, { o, L, m, d }, 1]);
    HORSE_ARMOR[id] = [i + 1, pts];
  });
  const HORSE_ARMOR_ID = [0, 528, 529, 530, 531];

  // modern stack sizes: food stacks to 64, stews stay single
  for (const d of I.all()) if (d.food && !d.returns && d.maxStack === 1) d.maxStack = 64;

  I._shaped(['L L', 'LLL', 'L L'], { L: 'leather' }, 'leather_horse_armor');
  I._shapeless(['reeds'], 'sugar');
  if (I.byName.pumpkin && I.byName.egg) I._shapeless(['pumpkin', 'sugar', 'egg'], 'pumpkin_pie');
  I._smelt[520] = 521; I._smelt[522] = 523; I._smelt[524] = 525;
  if (St && St.LOOT) {
    St.LOOT.temple.push(['iron_horse_armor', 1, 1, 4], ['golden_horse_armor', 1, 1, 3], ['diamond_horse_armor', 1, 1, 2]);
    St.LOOT.village.push(['iron_horse_armor', 1, 1, 2], ['leather_horse_armor', 1, 1, 3]);
    St.LOOT.mineshaft.push(['iron_horse_armor', 1, 1, 2], ['golden_horse_armor', 1, 1, 1]);
    St.LOOT.end_city.push(['diamond_horse_armor', 1, 1, 2], ['golden_horse_armor', 1, 1, 2]);
    St.LOOT.fortress.push(['iron_horse_armor', 1, 1, 4], ['golden_horse_armor', 1, 1, 6], ['diamond_horse_armor', 1, 1, 3]);
  }

  // animals drop meat like in modern Minecraft
  const onDeath = E.Mob.prototype.onDeath;
  E.Mob.prototype.onDeath = function (src, killer) {
    onDeath.apply(this, arguments);
    const cooked = this.fire > 0;
    const drop = (raw, done, min, max) => { const n = min + Math.floor(rnd() * (max - min + 1)); if (n > 0) this.world.spawnItem(this.x, this.y + 0.5, this.z, I.stack(cooked ? done : raw, n), true); };
    if (this.type === 'cow' || this.type === 'moobloom') drop(520, 521, 1, 3);
    else if (this.type === 'chicken') drop(522, 523, 1, 1);
    else if (this.type === 'sheep') drop(524, 525, 1, 2);
  };

  /* ------------------------------------------------------------ */
  /* Food values: [hunger, saturation, extras]                    */
  /* ------------------------------------------------------------ */
  const FOOD = {
    apple: [4, 2.4], bread: [5, 6], mushroom_stew: [6, 7.2], porkchop_raw: [3, 1.8], porkchop_cooked: [8, 12.8],
    golden_apple: [4, 9.6, { always: true, regen: [100, 1], absorb: [2400, 4] }],
    fish_raw: [2, 0.4], fish_cooked: [5, 6], rotten_flesh: [4, 0.8, { sick: [600, 0.8] }],
    raw_rabbit: [3, 1.8], cooked_rabbit: [5, 6], chorus_fruit: [4, 2.4, { always: true, teleport: true }],
    ambrosium_shard: [0, 0, { always: true, heal: 2, fast: true }],
    raw_beef: [3, 1.8], steak: [8, 12.8], raw_chicken: [2, 1.2, { sick: [600, 0.3] }], cooked_chicken: [6, 7.2],
    raw_mutton: [2, 1.2], cooked_mutton: [6, 9.6], pumpkin_pie: [8, 4.8]
  };
  const MILK = 335, BUCKET = 325;
  for (const n in FOOD) { const d = I.byName[n]; if (d && !d.food) d.food = Math.max(1, FOOD[n][0]); }
  function foodOf(d) {
    if (!d) return null;
    if (d.id === MILK) return [0, 0, { always: true, milk: true }];
    if (!d.food) return null;
    return FOOD[d.name] || [d.food, d.food * 1.2];
  }
  DL.Food = { FOOD, foodOf };

  /* ------------------------------------------------------------ */
  /* Hunger, saturation, exhaustion and effects on the player     */
  /* ------------------------------------------------------------ */
  function initHunger(p) {
    if (p.food !== undefined) return;
    p.food = 20; p.sat = 5; p.exh = 0; p.foodTick = 0; p.effects = {}; p.absorb = 0;
  }
  PL.exhaust = function (a) { if (this.food !== undefined && !this.creative) this.exh = Math.min(40, this.exh + a); };
  PL.addEffect = function (k, t, amp) {
    initHunger(this);
    const cur = this.effects[k];
    if (!cur || cur.amp < (amp || 0) || cur.t < t) this.effects[k] = { t, amp: amp || 0 };
  };
  function tickHunger(p) {
    initHunger(p);
    const w = p.world, diff = w.difficulty === undefined ? 2 : w.difficulty;
    // effects
    const ef = p.effects;
    if (ef.regen) { const per = Math.max(1, 50 >> ef.regen.amp); if (ef.regen.t % per === 0 && p.health > 0 && p.health < (p.maxHealth || 20)) p.heal(1); if (--ef.regen.t <= 0) delete ef.regen; }
    if (ef.absorb) { if (--ef.absorb.t <= 0 || p.absorb <= 0) { delete ef.absorb; p.absorb = 0; } }
    if (ef.hunger) { p.exhaust(0.005 * (ef.hunger.amp + 1)); if (--ef.hunger.t <= 0) delete ef.hunger; }
    if (p.creative) { p.food = 20; p.exh = 0; return; }
    // movement costs
    const dx = p.x - p.px, dz = p.z - p.pz, d = Math.hypot(dx, dz);
    if (!p.vehicle && !p.sitting) {
      if (p.swimming || (p.inWater && p.headInWater())) p.exhaust(0.01 * Math.hypot(d, p.y - p.py));
      else if (p.sprinting && p.onGround) p.exhaust(0.1 * d);
      if (p._wasGround && !p.onGround && p.vy > 0.3 && !p.inWater) p.exhaust(p.sprinting ? 0.2 : 0.05);
    }
    p._wasGround = p.onGround;
    // exhaustion drains saturation first, then the bar
    if (p.exh >= 4) { p.exh -= 4; if (p.sat > 0) p.sat = Math.max(0, p.sat - 1); else if (diff > 0) p.food = Math.max(0, p.food - 1); }
    // peaceful: the bar refills on its own
    if (diff === 0 && p.tickCountFood % 10 === 0 && p.food < 20) p.food++;
    p.tickCountFood = (p.tickCountFood || 0) + 1;
    // natural regeneration and starvation
    const maxHp = p.maxHealth || 20;
    if (p.health <= 0) return;
    if (p.noNaturalRegen && p.food > 0) { p.foodTick = 0; return; }
    if (p.sat > 0 && p.food >= 20 && p.health < maxHp) {
      if (++p.foodTick >= 10) { p.heal(1); p.exhaust(6); p.foodTick = 0; }
    } else if (p.food >= 18 && p.health < maxHp) {
      if (++p.foodTick >= 80) { p.heal(1); p.exhaust(6); p.foodTick = 0; }
    } else if (p.food <= 0) {
      if (++p.foodTick >= 80) {
        if (p.health > 10 || diff >= 3 || (p.health > 1 && diff >= 2)) p.damage('starve', 1);
        p.foodTick = 0;
      }
    } else p.foodTick = 0;
  }
  // absorption hearts soak up damage first; taking damage costs a little food
  const applyDamage = PL.applyDamage;
  PL.applyDamage = function (a, src) {
    initHunger(this);
    this.exhaust(0.1);
    if (this.absorb > 0 && a > 0) { const k = Math.min(this.absorb, a); this.absorb -= k; a -= k; if (a <= 0) { if (this.world.fx) this.world.fx.playerHurt(this, 0, src); return; } }
    return applyDamage.call(this, a, src);
  };
  const serialize = PL.serialize, restore = PL.restore;
  PL.serialize = function () {
    const d = serialize.call(this);
    initHunger(this);
    d.food = this.food; d.sat = Math.round(this.sat * 10) / 10; d.exh = Math.round(this.exh * 100) / 100;
    d.effects = this.effects; d.absorb = this.absorb;
    return d;
  };
  PL.restore = function (d) {
    restore.call(this, d);
    initHunger(this);
    if (typeof d.food === 'number') { this.food = clamp(d.food | 0, 0, 20); this.sat = clamp(+d.sat || 0, 0, 20); this.exh = clamp(+d.exh || 0, 0, 40); }
    if (d.effects && typeof d.effects === 'object') for (const k of ['regen', 'absorb', 'hunger']) { const e = d.effects[k]; if (e && e.t > 0) this.effects[k] = { t: e.t | 0, amp: e.amp | 0 }; }
    this.absorb = clamp(+d.absorb || 0, 0, 20);
  };
  const respawn = GP.respawn;
  GP.respawn = function () {
    const p = this.player;
    if (p) { p.food = 20; p.sat = 5; p.exh = 0; p.effects = {}; p.absorb = 0; p.eating = null; p.swimming = false; p.crawling = false; p.h = 1.8; p.eye = 1.62; }
    return respawn.apply(this, arguments);
  };

  /* ------------------------------------------------------------ */
  /* Eating and drinking take time (hold use)                     */
  /* ------------------------------------------------------------ */
  GP.eat = function () {
    const p = this.player, s = p.held, d = s && I.get(s.id);
    const f = foodOf(d);
    if (!f || p.eating) return;
    initHunger(p);
    const x = f[2] || {};
    if (!x.always && !p.creative && p.food >= 20) return;
    if (p.creative && !x.always) return;
    p.eating = { slot: p.selected, id: s.id, t: 0, max: x.fast ? 16 : 32, touch: In.lastDevice === 'touch' };
  };
  function finishEating(g, p, s) {
    const d = I.get(s.id), f = foodOf(d), x = f[2] || {};
    if (!p.creative) {
      p.food = Math.min(20, p.food + f[0]);
      p.sat = Math.min(p.food, p.sat + f[1]);
    }
    if (x.heal) p.heal(x.heal);
    if (x.regen) p.addEffect('regen', x.regen[0], x.regen[1]);
    if (x.absorb) { p.addEffect('absorb', x.absorb[0], 0); p.absorb = Math.max(p.absorb || 0, x.absorb[1]); }
    if (x.sick && rnd() < x.sick[1]) p.addEffect('hunger', x.sick[0], 0);
    if (x.milk) { p.effects = {}; p.absorb = 0; }
    if (x.teleport) chorusTeleport(g, p);
    A.play(x.milk ? 'splash' : 'burp', p.x, p.y, p.z, 0.5, 0.9 + rnd() * 0.1);
    if (!p.creative) {
      if (x.milk) p.held = I.stack(BUCKET);
      else if (d.returns) p.held = I.stack(d.returns);
      else p.consumeHeld(1);
    }
    In.haptic('place');
  }
  function chorusTeleport(g, p) {
    const w = p.world;
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(p.x + (rnd() - 0.5) * 16), z = Math.floor(p.z + (rnd() - 0.5) * 16);
      let y = clamp(Math.floor(p.y + (rnd() - 0.5) * 16), 1, S.CH - 3);
      if (!w.isReady(x, z)) continue;
      while (y > 1 && !S.SOLID[w.getBlock(x, y - 1, z)]) y--;
      if (S.SOLID[w.getBlock(x, y - 1, z)] && !S.SOLID[w.getBlock(x, y, z)] && !S.SOLID[w.getBlock(x, y + 1, z)] && !S.LIQUID[w.getBlock(x, y, z)]) {
        g.spawnParticles('portal', p.x, p.y + 1, p.z, 16, 0.6);
        p.setPos(x + 0.5, y, z + 0.5); p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
        A.play('teleport', x, y, z, 0.8, 1);
        return;
      }
    }
  }
  function tickEating(g) {
    const p = g.player, e = p.eating;
    if (!e) return;
    const s = p.held;
    const scr = G.screen;
    const holding = e.touch ? !scr : (g.useHeld || g.usePressed) && !scr;
    if (!s || s.id !== e.id || p.selected !== e.slot || !holding || p.health <= 0) { p.eating = null; return; }
    e.t++;
    if (e.t > 6 && e.t % 4 === 0) {
      const f = foodOf(I.get(s.id));
      const milk = f && f[2] && f[2].milk;
      if (!milk) g.spawnParticles('itemcrack', p.x - Math.sin(p.yaw) * 0.35, p.y + p.eye - 0.15, p.z - Math.cos(p.yaw) * 0.35, 5, 0.1, s.id);
      A.play(milk ? 'splash' : 'eat', p.x, p.y, p.z, 0.5 + 0.5 * rnd(), (milk ? 1.4 : 1) + (rnd() - rnd()) * 0.2);
      if (e.t % 8 === 0) p.swingTicks = -1;
    }
    if (e.t >= e.max) { p.eating = null; finishEating(g, p, s); }
  }

  /* ------------------------------------------------------------ */
  /* Swimming                                                     */
  /* ------------------------------------------------------------ */
  function roomToStand(p) {
    const hw = p.w / 2, bb = [p.x - hw + 0.001, p.y + 0.001, p.z - hw + 0.001, p.x + hw - 0.001, p.y + 1.8, p.z + hw - 0.001];
    const boxes = p.collectBoxes(bb);
    for (const o of boxes) if (bb[3] > o[0] && bb[0] < o[3] && bb[4] > o[1] && bb[1] < o[4] && bb[5] > o[2] && bb[2] < o[5]) return false;
    return true;
  }
  function updateSwim(p) {
    const w = p.world;
    const wasLow = p.swimming || p.crawling;
    if (p.flying || p.vehicle || p.sitting || p.health <= 0) { p.swimming = false; }
    else if (!p.swimming) {
      const deep = p.headInWater() || w.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z)) === B.water;
      if (p.sprinting && p.inWater && deep) p.swimming = true;
    } else if (!p.sprinting || !p.inWater) p.swimming = false;
    // can't stand up under a low ceiling: keep crawling
    p.crawling = !p.swimming && wasLow && !roomToStand(p) && !p.flying;
    const low = p.swimming || p.crawling;
    p.h = low ? 0.6 : 1.8;
    const eye = low ? 0.4 : 1.62;
    p.eye = Math.abs(p.eye - eye) < 0.05 ? eye : p.eye + (eye - p.eye) * 0.45;
    if (p.swimming && p.inWater && rnd() < 0.2 && p.world.fx) p.world.fx.particles('bubble', p.x, p.y + 0.3, p.z, 1, 0.3);
  }
  const travel = PL.travel;
  PL.travel = function (strafe, forward) {
    if (!(this.swimming && this.inWater)) {
      if (this.crawling) { strafe *= 0.3; forward *= 0.3; }
      return travel.call(this, strafe, forward);
    }
    const l = this.look(), ly = l[1];
    const k = ly < -0.2 ? 0.085 : 0.06;
    const above = this.world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.9), Math.floor(this.z)) === B.water;
    if (ly <= 0 || this.jumping || above) this.vy += (ly - this.vy) * k;
    this.moveRelative(strafe, forward, 0.028);
    this.move(this.vx, this.vy, this.vz);
    this.vx *= 0.9; this.vy *= 0.8; this.vz *= 0.9;
    if (this.collidedH && this.isOffsetFree(this.vx, this.vy + 0.6 - this.y + this.py, this.vz)) this.vy = 0.3;
    this.prevLimbAmount = this.limbSwingAmount;
    let f = Math.hypot(this.x - this.px, this.z - this.pz, (this.y - this.py) * 0.5) * 4;
    if (f > 1) f = 1;
    this.limbSwingAmount += (f - this.limbSwingAmount) * 0.4;
    this.limbSwing += this.limbSwingAmount;
  };

  /* ------------------------------------------------------------ */
  /* The player tick: hunger, effects, swimming, gentle air refill */
  /* ------------------------------------------------------------ */
  const ptick = PL.tick;
  PL.tick = function () {
    initHunger(this);
    const air = this.air;
    updateSwim(this);
    ptick.call(this);
    if (!this.headInWater() && air < 300 && this.air === 300) this.air = Math.min(300, Math.max(0, air) + 4);
    if (this.health > 0) tickHunger(this);
  };

  /* ------------------------------------------------------------ */
  /* Poses: swimming strokes, eating, rearing horses              */
  /* ------------------------------------------------------------ */
  const qArm = (f) => -65 * f + f * f;
  const rotlerp = (t, a, b) => { let d = (b - a) % (Math.PI * 2); if (d < -Math.PI) d += Math.PI * 2; if (d >= Math.PI) d -= Math.PI * 2; return a + t * d; };
  const pose = M.pose;
  M.pose = function (name, e, pt) {
    const o = pose.call(this, name, e, pt);
    if (!e) return o;
    if (name === 'player' || name === 'armor1' || name === 'armor2') {
      const amt = e.swimVis || 0;
      if (amt > 0.01 && o.rarm && o.larm) {
        const limb = (e.limbSwing || 0) - (e.limbSwingAmount || 0) * (1 - pt);
        const f3 = ((limb % 26) + 26) % 26;
        const L = o.larm, R = o.rarm;
        let lx, ly, lz, rx, ry, rz;
        if (f3 < 14) { const q = qArm(f3) / qArm(14); lx = 0; rx = 0; ly = ry = Math.PI; lz = Math.PI + 1.8707964 * q; rz = Math.PI - 1.8707964 * q; }
        else if (f3 < 22) { const t = (f3 - 14) / 8; lx = rx = Math.PI / 2 * t; ly = ry = Math.PI; lz = 5.012389 - 1.8707964 * t; rz = 1.2707963 + 1.8707964 * t; }
        else { const t = (f3 - 22) / 4; lx = rx = Math.PI / 2 - Math.PI / 2 * t; ly = ry = Math.PI; lz = rz = Math.PI; }
        o.larm = [rotlerp(amt, L[0], lx), rotlerp(amt, L[1] || 0, ly), rotlerp(amt, L[2] || 0, lz)];
        o.rarm = [lerp(R[0], rx, amt), lerp(R[1] || 0, ry, amt), lerp(R[2] || 0, rz, amt)];
        if (o.lleg) o.lleg = [lerp(o.lleg[0], 0.3 * Math.cos(limb / 3 + Math.PI), amt), 0, 0];
        if (o.rleg) o.rleg = [lerp(o.rleg[0], 0.3 * Math.cos(limb / 3), amt), 0, 0];
        if (o.head) o.head = [rotlerp(amt, o.head[0], -Math.PI / 4), o.head[1] || 0, 0];
      } else if (e.eating && o.rarm) {
        const age = (e.age || 0) + pt;
        o.rarm = [-1.05 + Math.sin(age * 1.4) * 0.12, -0.45, 0];
      }
    } else if ((name === 'horse' || name === 'horse_saddled' || name === 'horse_armor') && e.rearing > 0 && o.body) {
      const r = Math.min(1, e.rearing / 6) * 0.9;
      o.body = [-r, 0, 0, 0, 0, 0];
      o.head = [(o.head ? o.head[0] : 0.5) - r * 0.6, o.head ? o.head[1] : 0, 0, 0, -r * 6, -r * 4]; o.mane = o.head;
      if (o.leg3) { o.leg3 = [-r * 1.4 + Math.sin(((e.age || 0) + pt) * 0.9) * 0.4, 0, 0, 0, -r * 10, r * 2]; o.leg4 = [-r * 1.4 - Math.sin(((e.age || 0) + pt) * 0.9) * 0.4, 0, 0, 0, -r * 10, r * 2]; }
      if (o.tail) o.tail = [o.tail[0] + r * 0.5, o.tail[1], 0];
    }
    return o;
  };
  // the body lies flat while swimming and follows where you look (Minecraft's PlayerRenderer.setupRotations)
  const emm = RP.entityModelMatrix;
  RP.entityModelMatrix = function (e, pt, out) {
    const r = emm.call(this, e, pt, out);
    if (e.type !== 'player') return r;
    const target = (e.swimming || e.crawling) ? 1 : 0;
    const now = performance.now(), dt = Math.min(0.1, (now - (e._swT || now)) / 1000);
    e._swT = now;
    e.swimVis = e.swimVis === undefined ? target : e.swimVis + (target - e.swimVis) * Math.min(1, dt * 7);
    const amt = e.swimVis;
    if (amt > 0.01 && e.deathTime <= 0) {
      const up = 24 / 16 - (e.sneaking ? 0.125 : 0);
      const pitch = e.isPlayer && !e.isProxy ? lerp(e.ppitch, e.pitch, pt) : (e.pitch || 0);
      const inWater = e.swimming;
      M4.translate(out, out, 0, -up, 0);
      M4.rotateX(out, out, amt * (-Math.PI / 2 + (inWater ? pitch : 0)));
      M4.translate(out, out, 0, -1 * amt, 0.3 * amt);
      M4.translate(out, out, 0, up, 0);
    }
    return r;
  };

  /* ------------------------------------------------------------ */
  /* Game hooks: eating ticks, exhaustion from fighting/mining    */
  /* ------------------------------------------------------------ */
  const interact = GP.interact;
  GP.interact = function () {
    const p = this.player;
    const attacking = this.attackPressed && this.target && this.target.entity;
    const dig = this.dig;
    const r = interact.apply(this, arguments);
    if (p && !p.creative) {
      if (attacking) p.exhaust(0.1);
      if (dig && !this.dig && this.breakDelay === 5) p.exhaust(0.005);
    }
    return r;
  };
  const useItem = GP.useItem;
  GP.useItem = function () {
    const p = this.player, held = p && p.held, t = this.target;
    // guests: mobs live on the host, so ask the host to do the interaction
    if (isGuest() && t && t.entity && t.entity.isProxy && t.entity.living && t.entity.type !== 'player') {
      if (!this.usePressed && !this._pgUseEdge) return;
      const e = t.entity;
      N.client.send({ t: 'eu', id: e.netId, h: held ? held.id : 0, n: held ? p.countItem(held.id) : 0, sn: p.sneaking ? 1 : 0 });
      p.swing();
      return;
    }
    // drink milk
    if (held && held.id === MILK && !(t && t.entity)) { this.eat(); return; }
    // horses: sneak + use opens the horse's inventory
    if (t && t.entity && t.entity.type === 'horse' && p.sneaking && !isGuest() && (this.usePressed || this._pgUseEdge)) {
      const h = t.entity;
      if (isTamed(h)) { this.setScreen(new HorseScreen(this, h)); return; }
    }
    return useItem.apply(this, arguments);
  };
  const openInventory = GP.openInventory;
  GP.openInventory = function () {
    const p = this.player, v = p && p.vehicle;
    if (v && v.type === 'horse' && !isGuest() && isTamed(v)) { this.setScreen(new HorseScreen(this, v)); return; }
    return openInventory.apply(this, arguments);
  };
  const tick = GP.tick;
  GP.tick = function () {
    tick.apply(this, arguments);
    if (!this.inGame || !this.player || !this.world) return;
    if (G.screen && G.screen.pauses && !(N && N.active && N.active())) return;
    tickEating(this);
    if (isGuest()) guestRideTick(this);
  };
  // touch: hold on an animal to use it (ride, saddle, feed, trade); a quick tap still attacks
  const frameInput = GP.frameInput;
  GP.frameInput = function (dt) {
    const r = frameInput.apply(this, arguments);
    const T = In.touch;
    if (In.lastDevice === 'touch' && T.look && !T.look.usedEnt && this.target && this.target.entity && !G.screen) {
      const held = performance.now() - T.look.t0;
      if (held > 330 && T.look.moved < 30) { T.look.usedEnt = true; T.look.brokeBlock = true; this.usePressed = true; this.useTimer = 0; In.haptic('tick', true); }
    }
    return r;
  };

  /* ------------------------------------------------------------ */
  /* First-person eating animation                                */
  /* ------------------------------------------------------------ */
  RP.eatTransform = function (p, pt, m) {
    const e = p.eating;
    if (!e || !p.equippedStack || p.equippedStack.id !== e.id) return;
    const deg = Math.PI / 180;
    const left = e.max - (e.t + pt) + 1, f1 = clamp(left / e.max, 0, 1);
    if (f1 < 0.8) M4.translate(m, m, 0, Math.abs(Math.cos(left / 4 * Math.PI) * 0.1), 0);
    const f3 = 1 - Math.pow(f1, 27);
    M4.translate(m, m, f3 * 0.6, f3 * -0.5, 0);
    M4.rotateY(m, m, f3 * 90 * deg); M4.rotateX(m, m, f3 * 10 * deg); M4.rotateZ(m, m, f3 * 30 * deg);
  };

  /* ------------------------------------------------------------ */
  /* HUD icons: drumsticks, golden and mount hearts               */
  /* ------------------------------------------------------------ */
  const buildGui = Tex.buildGui;
  Tex.buildGui = function () {
    buildGui.apply(this, arguments);
    const gui = Tex.gui;
    const leg = ['.....kkk.', '....kRrRk', '...kRrRRk', '...kRRRRk', '..kWkRRk.', '.kWk.kk..', 'kWWk.....', '.kk......', '.........'];
    const pal = (R, r, W, k) => ({ k: k || [24, 16, 8], R, r, W });
    const half = (rows) => rows.map(row => row.split('').map((ch, x) => (ch === 'R' || ch === 'r' || ch === 'W') && x < 5 ? 'E' : ch).join(''));
    const mk = (rows, p, e) => Tex.artCanvas(rows, Object.assign({ E: e }, p));
    const EMPTY = [56, 34, 20];
    const meat = pal([164, 92, 40], [214, 140, 82], [236, 228, 208]);
    const sick = pal([104, 132, 48], [146, 170, 84], [176, 196, 136]);
    const empty = { k: [24, 16, 8], R: EMPTY, r: EMPTY, W: EMPTY };
    gui.foodFull = mk(leg, meat); gui.foodHalf = mk(half(leg), meat, EMPTY); gui.foodEmpty = mk(leg, empty);
    gui.foodFullSick = mk(leg, sick); gui.foodHalfSick = mk(half(leg), sick, [40, 50, 24]); gui.foodEmptySick = mk(leg, { k: [24, 30, 10], R: [40, 50, 24], r: [40, 50, 24], W: [40, 50, 24] });
    const heart = ['.kkk.kkk.', 'kRRRkRRRk', 'kRWRRRRRk', 'kRRRRRRRk', '.kRRRRRk.', '..kRRRk..', '...kRk...', '....k....', '.........'];
    const hh = (rows) => rows.map(row => row.split('').map((ch, x) => (ch === 'R' || ch === 'W') && x > 4 ? 'E' : ch).join(''));
    const hp = (R, W) => ({ k: [20, 20, 20], R, W, E: [48, 20, 20] });
    gui.heartGold = Tex.artCanvas(heart, hp([232, 180, 20], [255, 240, 150])); gui.heartGoldHalf = Tex.artCanvas(hh(heart), hp([232, 180, 20], [255, 240, 150]));
    gui.heartMount = Tex.artCanvas(heart, hp([236, 96, 40], [255, 196, 150])); gui.heartMountHalf = Tex.artCanvas(hh(heart), hp([236, 96, 40], [255, 196, 150]));
  };

  /* ------------------------------------------------------------ */
  /* Horses: taming, feeding, saddles, horse armour, inventory    */
  /* ------------------------------------------------------------ */
  const HORSE = E.MOBS.horse;
  const SADDLE = 329;
  const saddled = (m) => ((m.variant || 0) & 8) !== 0;
  const armorOf = (m) => ((m.variant || 0) >> 5) & 7;
  const setArmor = (m, k) => { m.variant = ((m.variant || 0) & ~(7 << 5)) | ((k & 7) << 5); };
  const setSaddle = (m, on) => { m.variant = on ? ((m.variant || 0) | 8) : ((m.variant || 0) & ~8); };
  function isTamed(m) { if (saddled(m) && !m.tamed) m.tamed = 1; return !!m.tamed; }
  const HORSE_FOOD = {}; // item id -> [heal, temper]
  for (const [n, heal, temper] of [['wheat', 2, 3], ['apple', 3, 3], ['bread', 7, 0], ['golden_apple', 10, 10], ['sugar', 1, 3], ['hay_bale', 20, 0]]) if (I.byName[n]) HORSE_FOOD[I.byName[n].id] = [heal, temper];
  const say = (game, p, t) => { if (game && game.chatMessage) game.chatMessage(t); };
  const fx = (m, k, n) => { if (m.world.fx) m.world.fx.particles(k, m.x, m.y + m.h, m.z, n, 0.6); };
  const snd = (m, k, v, pi) => { if (m.world.fx) m.world.fx.sound(k, m.x, m.y + 1, m.z, v || 1, pi || 1); };

  function mountHorse(p, m, game) {
    p.sitting = null; p.vehicle = m; m.rider = p; m.persistent = true; m.path = null; m.target = null;
    m.tameT = 0;
    snd(m, 'cow', 0.6, 1.4);
    if (!isTamed(m)) say(game, p, m.saddleFor ? '§eIt\'s wild! Hold on until it trusts you (hearts), and your saddle goes on by itself.' : '§7This horse is wild: stay on until it calms down (hearts), then it\'s yours.');
    else if (!saddled(m)) say(game, p, '§7Riding bareback: it goes where it likes. Put a saddle on it to steer. Sneak to get off.');
    else say(game, p, '§7Riding! Sneak to get off. ' + (p === (DL.game && DL.game.player) ? 'Press ' + (In.lastDevice === 'gamepad' ? 'Y' : In.lastDevice === 'touch' ? 'the inventory button' : In.keyName(In.binds.inventory)) + ' for the horse\'s inventory.' : ''));
    if (p === (DL.game && DL.game.player) && DL.Extras && DL.Extras.grant) DL.Extras.grant('ride');
  }
  function throwOff(m) {
    const p = m.rider;
    if (!p) return;
    m.rearing = 14;
    snd(m, 'cow', 1, 0.6);
    if (p.isRemote) { p.vehicle = null; m.rider = null; if (p.conn) p.conn.send({ t: 'dis' }); p.setPos(m.x + Math.cos(m.yaw) * 1.4, m.y + 0.2, m.z + Math.sin(m.yaw) * 1.4); }
    else if (W.dismount) W.dismount(p);
    else { p.vehicle = null; m.rider = null; }
    p.vy = 0.3;
  }
  function horseInteract(m, p, game) {
    const now = performance.now();
    m._useCd = m._useCd || {};
    const key = p.conn ? p.conn.peer : 'me';
    if ((m._useCd[key] || 0) > now) return true;
    m._useCd[key] = now + 300;
    const held = p.held;
    const tamed = isTamed(m);
    // food: heals, and makes wild horses friendlier
    if (held && HORSE_FOOD[held.id]) {
      const [heal, temper] = HORSE_FOOD[held.id];
      const hurt = m.health < m.maxHealth;
      if (!hurt && (tamed || !temper)) { if (!p.vehicle) mountOrInfo(); return true; }
      if (heal) m.heal(heal);
      if (!tamed && temper) m.temper = Math.min(100, (m.temper || 0) + temper);
      if (!p.creative) p.consumeHeld(1);
      m.grazing = 20; fx(m, 'happy', 5); snd(m, 'eat', 0.6, 1);
      return true;
    }
    function mountOrInfo() { if (!p.vehicle && !m.rider) mountHorse(p, m, game); }
    if (held && held.id === SADDLE) {
      if (saddled(m)) { mountOrInfo(); return true; }
      if (!tamed) {
        // a wild horse: climb on to tame it, and the saddle goes on once it trusts you
        if (p.vehicle || m.rider) return true;
        m.saddleFor = p.conn || 'me';
        mountHorse(p, m, game);
        return true;
      }
      setSaddle(m, true); m.persistent = true;
      if (!p.creative) p.consumeHeld(1);
      snd(m, 'cloth', 0.8, 1); fx(m, 'happy', 6);
      say(game, p, '§eSaddled! Ride it with an empty hand.');
      return true;
    }
    if (held && HORSE_ARMOR[held.id]) {
      if (!tamed) { say(game, p, '§eTame this horse before giving it armour.'); return true; }
      if (armorOf(m)) { say(game, p, '§7It already wears armour. ' + (p.isRemote ? '' : 'Sneak and use it to open its inventory.')); return true; }
      setArmor(m, HORSE_ARMOR[held.id][0]); m.persistent = true;
      if (!p.creative) p.consumeHeld(1);
      snd(m, 'metal', 0.8, 1);
      return true;
    }
    if (held && !(I.get(held.id) || {}).food) return false;
    if (p.vehicle || m.rider) return true;
    mountHorse(p, m, game);
    return true;
  }
  function takeOne(p, id) {
    if (p.held && p.held.id === id) { p.consumeHeld(1); return; }
    for (let i = 0; i < p.inv.length; i++) { const st = p.inv[i]; if (st && st.id === id) { if (--st.count <= 0) p.inv[i] = null; return; } }
  }
  function horseAI(m) {
    const r = m.rider;
    if (r && (r.vehicle !== m || r.removed || r.health <= 0)) m.rider = null;
    if (m.rearing > 0) { m.rearing--; m.moveForward = m.moveStrafe = 0; m.jumping = false; m.path = null; return; }
    // armour: tougher horses
    const ap = armorOf(m) ? HORSE_ARMOR[HORSE_ARMOR_ID[armorOf(m)]][1] : 0;
    m.armorPoints = ap;
    m.speedMul = 1;
    // a wild horse bucks until it accepts you
    if (m.rider && !isTamed(m)) {
      m.tameT = (m.tameT || 0) + 1;
      m.path = null; m.target = null;
      if (m.tameT % 20 === 0) m.yaw += (rnd() - 0.5) * 1.6;
      m.moveForward = 0.6; m.moveStrafe = (rnd() - 0.5) * 0.4; m.speedMul = 1.3;
      if (m.onGround && rnd() < 0.04) m.vy = 0.4;
      if (m.tameT > 40 + (m.tempo || (m.tempo = Math.floor(rnd() * 60)))) {
        m.tempo = 0; m.tameT = 0;
        if (rnd() * 100 < (m.temper || 0)) {
          m.tamed = 1; m.persistent = true;
          fx(m, 'heart', 7); snd(m, 'cow', 0.8, 1.6);
          const g = DL.game, me = m.rider === (g && g.player);
          // the saddle you were holding goes straight on
          let msg = '§aThe horse trusts you now! Put a saddle on it to steer.';
          const r0 = m.rider, guest = !!(r0 && r0.conn && m.saddleFor === r0.conn);
          if (!saddled(m) && ((me && r0.inv && (r0.creative || r0.countItem(SADDLE) > 0)) || guest)) {
            if (me && !r0.creative) takeOne(r0, SADDLE);
            // a guest's inventory lives on their side: ask for the saddle back
            if (guest) r0.conn.send({ t: 'inv', take: [SADDLE, 1] });
            setSaddle(m, true); snd(m, 'cloth', 0.8, 1);
            msg = '§aThe horse trusts you now, and it\'s saddled! Steer with your movement keys.';
          }
          m.saddleFor = null;
          if (me) g.chatMessage(msg);
          else if (m.rider && m.rider.conn) m.rider.conn.send({ t: 'msg', m: msg });
        } else {
          m.temper = Math.min(100, (m.temper || 0) + 10);
          fx(m, 'smoke', 6);
          throwOff(m);
        }
      }
      return;
    }
    return HORSE._wishAI ? HORSE._wishAI(m) : m.aiTick();
  }
  HORSE._wishAI = HORSE.ai;
  HORSE.interact = horseInteract;
  HORSE.ai = horseAI;
  const hinit = HORSE.init;
  HORSE.init = (m) => { if (hinit) hinit(m); if (m.temper === undefined) m.temper = Math.floor(rnd() * 30); };
  // horse armour soaks up damage
  const mobDamage = E.Mob.prototype.damage;
  E.Mob.prototype.damage = function (src, amount, from) {
    if (this.type === 'horse' && this.armorPoints && amount > 0 && src !== 'fall' && src !== 'void' && src !== 'drown') amount = amount * (25 - this.armorPoints) / 25;
    return mobDamage.call(this, src, amount, from);
  };
  // dropping a horse's gear when it dies
  const mobDeath = E.Mob.prototype.onDeath;
  E.Mob.prototype.onDeath = function (src, killer) {
    mobDeath.apply(this, arguments);
    if (this.type !== 'horse') return;
    if (saddled(this)) this.world.spawnItem(this.x, this.y + 0.5, this.z, I.stack(SADDLE), true);
    const a = armorOf(this);
    if (a && HORSE_ARMOR_ID[a]) this.world.spawnItem(this.x, this.y + 0.5, this.z, I.stack(HORSE_ARMOR_ID[a]), true);
  };

  /* horse armour model: the horse's shape, a little bigger */
  const D = M.defs;
  const P = (pivot, boxes, extra) => Object.assign({ pivot, boxes }, extra || {});
  D.horse_armor = { anim: 'horse', shadow: 0.9, parts: {
    body: P([0, 11, 5], [[-5, -8, -17, 10, 10, 22, 0.35]]),
    head: P([0, 4, -12], [[-2.05, -6, -2, 4, 12, 7, 0.3], [-3, -11, -2, 6, 5, 7, 0.3], [-2, -11, -7, 4, 5, 5, 0.3]]),
    leg1: P([4, 14, 7], [[-3, -1.01, -1, 4, 11, 4, 0.3]]), leg2: P([-4, 14, 7], [[-1, -1.01, -1, 4, 11, 4, 0.3]]),
    leg3: P([4, 14, -10], [[-3, -1.01, -1.9, 4, 11, 4, 0.3]]), leg4: P([-4, 14, -10], [[-1, -1.01, -1.9, 4, 11, 4, 0.3]])
  } };
  M.newModels.push('horse_armor');
  const ARMOR_COL = [null, ['#a0663a', '#7a4a26', '#c8905a'], ['#d8d8d8', '#a8a8a8', '#f4f4f4'], ['#f0c838', '#c89818', '#fff0a0'], ['#4ee0d4', '#22a89c', '#b8fff8']];
  ARMOR_COL.forEach((c, k) => {
    if (!c) return;
    M.skinPainters['horse_armor_' + k] = () => {
      const s = new M.Skin('horse_armor', 400 + k), mdl = D.horse_armor;
      const [base, dark, hi] = c.map(M.hex);
      const jit = (col) => { const j = 1 + (s.r.next() - 0.5) * 0.1; return [Math.min(255, col[0] * j), Math.min(255, col[1] * j), Math.min(255, col[2] * j)]; };
      for (const pn in mdl.parts) mdl.parts[pn].boxes.forEach((b, bi) => {
        s.fill(pn, bi, 'all', () => [0, 0, 0, 0]);
        if (pn === 'body') {
          // a blanket of plates over the back and flanks, with a trim and rivets
          s.fill(pn, bi, 'top', (x, y, w) => (x === 0 || x === w - 1) ? jit(dark) : jit(base));
          s.fill(pn, bi, 'left,right', (x, y, w, h) => y < h - 3 ? (y === h - 4 ? jit(dark) : (x % 5 === 2 && y % 4 === 1) ? jit(hi) : jit(base)) : null);
          s.fill(pn, bi, 'front', (x, y, w, h) => y < h - 2 ? (y === h - 3 ? jit(dark) : jit(base)) : null);
          s.fill(pn, bi, 'back', (x, y, w, h) => y < 4 ? jit(dark) : null);
        } else if (pn === 'head') {
          if (bi === 0) s.fill(pn, bi, 'front,left,right,top', (x, y, w, h) => y < h - 2 ? jit(base) : null);
          else if (bi === 1) {
            s.fill(pn, bi, 'top,front,back', (x, y, w) => (x === 0 || x === w - 1) ? jit(dark) : jit(base));
            s.fill(pn, bi, 'left,right', (x, y, w, h) => (y === 1 && (x === 3 || x === 4)) ? null : y === h - 1 ? jit(dark) : jit(base));
          } else s.fill(pn, bi, 'top,left,right', (x, y, w, h) => y < h - 1 ? jit(base) : jit(dark));
        } else {
          s.fill(pn, bi, 'front,back,left,right', (x, y, w, h) => (y >= 2 && y < h - 3) ? (y === 2 || y === h - 4 ? jit(dark) : jit(base)) : null);
        }
      });
      return s.done();
    };
  });
  const drawModel = RP.drawModel;
  RP.drawModel = function (type, e, pt, model, light, opts) {
    const r = drawModel.apply(this, arguments);
    if ((type === 'horse' || type === 'horse_saddled') && e && armorOf(e) && !(opts && opts.only)) {
      drawModel.call(this, 'horse_armor', e, pt, model, light, Object.assign({}, opts || {}, { skin: 'horse_armor_' + armorOf(e), poseAs: type }));
    }
    return r;
  };

  /* horse inventory */
  class HorseScreen extends G.ContainerScreen {
    constructor(game, horse) { super(game); this.horse = horse; }
    buildSlots() {
      const h = this.horse;
      this.slots.push({
        x: 8, y: 18, max: 1, get: () => saddled(h) ? I.stack(SADDLE) : null,
        set: (s) => { setSaddle(h, !!(s && s.id === SADDLE)); }, accept: (s) => s.id === SADDLE,
        ghost: (x, y) => ghostIcon('saddle', x, y)
      });
      this.slots.push({
        x: 8, y: 36, max: 1, get: () => armorOf(h) ? I.stack(HORSE_ARMOR_ID[armorOf(h)]) : null,
        set: (s) => { setArmor(h, s && HORSE_ARMOR[s.id] ? HORSE_ARMOR[s.id][0] : 0); }, accept: (s) => !!HORSE_ARMOR[s.id],
        ghost: (x, y) => ghostIcon('iron_horse_armor', x, y)
      });
      this.addInventorySlots(84);
      this.quickToContainer = true;
    }
    draw(mx, my) {
      const h = this.horse, p = this.player;
      if (h.removed || h.health <= 0 || Math.hypot(h.x - p.x, h.z - p.z) > 8) { this.game.setScreen(null); return; }
      super.draw(mx, my);
    }
    drawBackground(mx, my) {
      G.panel(this.px, this.py, this.pw, this.ph);
      const bx = this.px + 26, by = this.py + 17;
      G.rect(bx, by, 54, 54, '#000');
      G.ctx.clearRect(bx + 1, by + 1, 52, 52);
      this.preview = [bx + 1, by + 1, 52, 52];
      this.previewLook = [(mx - bx - 26) / 30, (my - by - 20) / 30];
      this.previewEntity = this.horse;
      const h = this.horse;
      this.drawLabel('Horse', 8, 6);
      const hp = Math.ceil(h.health) + ' / ' + h.maxHealth;
      this.drawLabel('Health ' + hp, 86, 22);
      this.drawLabel(isTamed(h) ? (saddled(h) ? 'Ready to ride' : 'Needs a saddle') : 'Wild', 86, 36);
      if (armorOf(h)) this.drawLabel('Armour +' + HORSE_ARMOR[HORSE_ARMOR_ID[armorOf(h)]][1], 86, 50);
      this.drawLabel('Inventory', 8, this.ph - 94);
    }
  }
  G.HorseScreen = HorseScreen;
  function ghostIcon(name, x, y) {
    const t = Tex.itemTile(name);
    if (t === undefined) return;
    G.ctx.globalAlpha = 0.25; G.ctx.filter = 'grayscale(1) brightness(0.4)';
    Tex.drawItemTile(G.ctx, t, x, y, 16);
    G.ctx.filter = 'none'; G.ctx.globalAlpha = 1;
  }
  // the preview box shows the horse instead of you
  const prev = RP.renderPlayerPreview;
  RP.renderPlayerPreview = function (p, rx, ry, rw, rh, lookX, lookY) {
    const scr = G.screen;
    if (!scr || !scr.previewEntity) return prev.apply(this, arguments);
    const e = scr.previewEntity, gl = this.gl;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rx, this.h - ry - rh, rw, rh);
    gl.viewport(rx, this.h - ry - rh, rw, rh);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const saveProj = new Float32Array(this.proj), saveView = new Float32Array(this.view);
    M4.ortho(this.proj, -1.3, 1.3, -1.3 * rh / rw, 1.3 * rh / rw, -10, 10);
    M4.identity(this.view);
    const saveFog = [this.fogStart, this.fogEnd, this.fogMode], saveSub = this.skySub;
    this.fogStart = 100; this.fogEnd = 200; this.fogMode = 0; this.skySub = 0;
    const m = M4.create();
    M4.translate(m, m, 0, -0.95, 0);
    M4.scale(m, m, 0.95, 0.95, 0.95);
    M4.rotateX(m, m, 0.25);
    M4.rotateY(m, m, Math.PI * 0.75 + Math.atan(lookX) * 0.6);
    M4.translate(m, m, 0, 24 / 16, 0);
    const fake = Object.create(e);
    fake.limbSwing = 0; fake.limbSwingAmount = 0; fake.prevLimbAmount = 0; fake.hurtTime = 0; fake.deathTime = 0; fake.rider = null;
    fake.headYawRel = Math.atan(lookX) * 0.5; fake.renderPitch = Math.atan(lookY) * 0.4; fake.grazing = 0; fake.rearing = 0;
    const def = e.def || {};
    const type = (def.modelFor && def.modelFor(e)) || def.model || e.type;
    this.drawModel(type, fake, 1, m, [15, 15], def.skinFor ? { skin: def.skinFor(e) } : null);
    this.proj.set(saveProj); this.view.set(saveView);
    this.fogStart = saveFog[0]; this.fogEnd = saveFog[1]; this.fogMode = saveFog[2]; this.skySub = saveSub;
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, this.w, this.h);
  };

  /* ------------------------------------------------------------ */
  /* Multiplayer: guests use mobs through the host                */
  /* ------------------------------------------------------------ */
  if (N && N.hostHandlers) {
    const isI = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
    const text = (t) => String(t || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 240);
    // a stand-in for the guest's hand: reads fall through to the guest's entity, items are tracked and sent back
    function guestHand(conn, rp, held, total) {
      const h = Object.create(rp);
      h.inv = new Array(36).fill(null);
      h.inv[0] = held ? I.stack(held.id, Math.max(1, total)) : null;
      h.selected = 0;
      Object.defineProperty(h, 'held', { get() { return this.inv[0]; }, set(v) { this.inv[0] = v; }, configurable: true });
      h.gives = [];
      h.consumeHeld = function (n) { const s = this.inv[0]; if (!s) return; s.count -= n || 1; if (s.count <= 0) this.inv[0] = null; };
      h.damageHeld = function () { };
      h.addItem = function (st) { this.gives.push(I.copy(st)); return null; };
      h.countItem = function (id) { let n = 0; for (const s of this.inv) if (s && s.id === id) n += s.count; return n; };
      h.swing = function () { rp.swingTicks = 0; };
      h.conn = conn; h.isGuestHand = true;
      return h;
    }
    function fakeGame(conn) {
      if (!conn._fg) conn._fg = { chatMessage: (t) => conn.send({ t: 'msg', m: text(t) }) };
      return conn._fg;
    }
    N.hostHandlers.eu = (conn, m, rp, w) => {
      if (!isI(m.id, 1, 1e12) || rp.health <= 0) return;
      const now = performance.now();
      if (now - (conn.lastEu || 0) < 150) return;
      conn.lastEu = now;
      const e = w.entities.find(o => o.id === m.id);
      if (!e || !e.living || e.removed || e.isPlayer || e.health <= 0 || !conn.near(e.x, e.y + e.h / 2, e.z, 7)) return;
      const held = isI(m.h, 1, 1023) && I.get(m.h) ? { id: m.h, count: 1 } : null;
      const total = held ? clamp(isI(m.n, 1, 2304) ? m.n : 1, 1, 2304) : 0;
      const hand = guestHand(conn, rp, held, total);
      hand.sneaking = !!m.sn;
      const before = held ? total : 0;
      let used = false;
      if (e.def && e.def.interact) used = e.def.interact(e, hand, fakeGame(conn));
      else if (e.type === 'cow' && held && held.id === BUCKET) { hand.held = hand.held.count > 1 ? (hand.gives.push(I.stack(MILK)), I.stack(BUCKET, hand.held.count - 1)) : I.stack(MILK); used = true; }
      void used;
      // what changed in the guest's hand
      const now0 = hand.inv[0];
      const left = now0 && held && now0.id === held.id ? now0.count : 0;
      const take = held ? before - left : 0;
      const give = now0 && (!held || now0.id !== held.id) ? I.copy(now0) : null;
      if (take > 0 || give || hand.gives.length) conn.send({ t: 'inv', take: held && take > 0 ? [held.id, take] : null, give, gives: hand.gives.slice(0, 8) });
      // mounting: the real rider is the guest's entity
      if (e.rider === hand) { e.rider = rp; rp.vehicle = e; rp.rideInput = {}; conn.send({ t: 'mnt', id: e.id }); }
    };
    N.hostHandlers.ri = (conn, m, rp) => {
      const n = (v) => typeof v === 'number' && isFinite(v) ? clamp(v, -1, 1) : 0;
      rp.rideInput = { f: n(m.f), s: n(m.s), j: !!m.j, sprint: !!m.sp };
    };
    N.hostHandlers.dis = (conn, m, rp) => {
      const v = rp.vehicle;
      if (v && v.rider === rp) v.rider = null;
      rp.vehicle = null; rp.rideInput = null;
    };
    // guest side
    N.clientHandlers.msg = (cl, m, g) => { const t = text(m.m); if (t) g.chatMessage(t); };
    N.clientHandlers.inv = (cl, m, g, w, p) => {
      const ok = (st) => st && Number.isInteger(st.id) && I.get(st.id) && Number.isInteger(st.count) && st.count > 0 && st.count <= 64;
      if (Array.isArray(m.take) && isI(m.take[0], 1, 1023) && isI(m.take[1], 1, 2304)) {
        let [id, n] = m.take;
        const order = [p.selected].concat([...Array(36).keys()].filter(i => i !== p.selected));
        for (const i of order) { const s = p.inv[i]; if (!s || s.id !== id || n <= 0) continue; const k = Math.min(n, s.count); s.count -= k; n -= k; if (s.count <= 0) p.inv[i] = null; }
      }
      const put = (st) => { if (!ok(st)) return; const s = I.stack(st.id, st.count, st.dmg | 0); if (!p.held) p.held = s; else { const l = p.addItem(s); if (l) p.dropItem(l); } };
      if (m.give) put(m.give);
      if (Array.isArray(m.gives)) for (const st of m.gives.slice(0, 8)) { if (!ok(st)) continue; const l = p.addItem(I.stack(st.id, st.count, st.dmg | 0)); if (l) p.dropItem(l); }
    };
    N.clientHandlers.mnt = (cl, m, g, w, p) => {
      const px = cl.proxies && cl.proxies.get(m.id);
      if (!px || p.vehicle) return;
      p.sitting = null; p.vehicle = px; px.rider = p;
      cl._riding = px;
    };
    N.clientHandlers.dis = (cl, m, g, w, p) => {
      if (!p.vehicle) return;
      cl._noDis = true;
      if (W.dismount) W.dismount(p); else p.vehicle = null;
    };
  }
  function guestRideTick(g) {
    const cl = N.client, p = g.player;
    if (!cl) return;
    if (p.vehicle && p.vehicle.isProxy) {
      cl._riding = p.vehicle;
      const ri = p.rideInput || {};
      const key = [ri.f, ri.s, ri.j, ri.sprint].join();
      if (key !== cl._riKey || g.tickCount % 10 === 0) { cl._riKey = key; cl.send({ t: 'ri', f: ri.f || 0, s: ri.s || 0, j: ri.j ? 1 : 0, sp: ri.sprint ? 1 : 0 }); }
    } else if (cl._riding) {
      cl._riding = null;
      if (!cl._noDis) cl.send({ t: 'dis' });
      cl._noDis = false;
    }
  }
})();
