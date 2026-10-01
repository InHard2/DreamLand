/*
 * DreamLand - the Portal Gun.
 *
 * Use (right click / tap / LT) fires a blue portal, attack (left click / hold /
 * RT) fires an orange one; sneak + use closes both. Portals sit on solid
 * blocks: 1x2 on walls, 1x1 on floors and ceilings. Anything that walks, falls
 * or flies into one comes out of the other with its momentum rotated ("speedy
 * thing goes in, speedy thing comes out"). Wall portals show a live view of
 * what is on the other side, rendered from a second camera with an oblique
 * near plane.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, E = DL.Entities, G = DL.GUI, I = DL.Items, A = DL.Audio, In = DL.Input, M4 = DL.M4, M = DL.Models;
  const GUN = 452;
  const PG = DL.PortalGun = { recoil: 0, last: 'blue' };
  const COL = { blue: [0.22, 0.62, 1.0], orange: [1.0, 0.52, 0.08] };
  const OTHER = { blue: 'orange', orange: 'blue' };

  /* ------------------------------------------------------------ */
  /* Item, recipe and icon                                        */
  /* ------------------------------------------------------------ */
  I._def(GUN, 'portal_gun', { maxStack: 1, display: 'Portal Gun', portalGun: true });
  I._shaped([' G ', 'IEI', 'IOI'], { G: 'glowstone_dust', I: 'iron_ingot', E: 'ender_pearl', O: 'obsidian' }, 'portal_gun');
  DL.Tex.ITEM_ART.portal_gun = [[
    '................',
    '...........kkk..',
    '..........kbBbk.',
    '.........kWBBBk.',
    '........kWWkBk..',
    '.......kWWWWk...',
    '......kWWWwk....',
    '.....kWWWwk.....',
    '....kWWWwk......',
    '...kWWkwk.......',
    '...kWkkk........',
    '..kkWk..........',
    '..kWWk..........',
    '..kkk...........'
  ], { k: [36, 36, 44], W: [236, 236, 242], w: [176, 178, 190], B: [70, 160, 255], b: [175, 220, 255] }, 1];

  /* ------------------------------------------------------------ */
  /* 3D model                                                     */
  /* ------------------------------------------------------------ */
  // pixels, y down, forward is -z
  M.defs.portal_gun = {
    anim: 'none', shadow: 0, noCull: true, parts: {
      body: { pivot: [0, 0, 0], boxes: [[-2.5, -2.5, -1, 5, 5, 10], [-2, -2, 9, 4, 4, 2, -0.25], [-3, -1.5, 1.5, 6, 3, 6], [-2, -3.5, 2, 4, 1, 5, -0.1]] },
      grip: { pivot: [0, 2.5, 6.5], boxes: [[-1.5, 0, -1.5, 3, 5, 3, -0.2]] },
      front: { pivot: [0, 0, 0], boxes: [[-2, -2, -3.5, 4, 4, 3, 0.2], [-1.5, -1.5, -5, 3, 3, 2, -0.1]] },
      glow: { pivot: [0, 0, 0], boxes: [[-1, -4, 2.5, 2, 1, 4, -0.3], [-1, -1, -5.6, 2, 2, 1, -0.15], [3, -0.5, 2.5, 1, 1, 4, -0.35], [-4, -0.5, 2.5, 1, 1, 4, -0.35]] },
      claw1: { pivot: [0, -1.8, -4.5], boxes: [[-0.5, -1, -4, 1, 1, 5, -0.1]] },
      claw2: { pivot: [-1.6, 1, -4.5], boxes: [[-1, -0.5, -4, 1, 1, 5, -0.1]] },
      claw3: { pivot: [1.6, 1, -4.5], boxes: [[0, -0.5, -4, 1, 1, 5, -0.1]] }
    }
  };
  M.newModels.push('portal_gun');
  const hex = M.hex;
  function paintGun(color) {
    const s = new M.Skin('portal_gun', 90);
    const mdl = M.defs.portal_gun;
    const FACES = ['bottom', 'top', 'front', 'back', 'left', 'right'];
    const C = {
      body: ['#ececf2', 0.03], grip: ['#2c2c34', 0.08], front: ['#3a3a44', 0.06], claw1: ['#e4e4ea', 0.03], claw2: ['#e4e4ea', 0.03], claw3: ['#e4e4ea', 0.03],
      glow: [color, 0.0]
    };
    for (const pn in mdl.parts) mdl.parts[pn].boxes.forEach((b, bi) => {
      const [c, v] = C[pn];
      const base = hex(c);
      for (const f of FACES) {
        const k = f === 'top' ? 1.05 : f === 'bottom' ? 0.8 : 1;
        s.fill(pn, bi, f, (x, y, w, h) => {
          let m = k * (1 + (s.r.next() - 0.5) * 2 * v);
          if (pn === 'body' && bi === 0 && (y === 0 || y === h - 1)) m *= 0.88;
          if (pn === 'glow') { const e = Math.min(x, y, w - 1 - x, h - 1 - y); m = e === 0 ? 0.85 : 1.15; }
          return [Math.min(255, base[0] * m), Math.min(255, base[1] * m), Math.min(255, base[2] * m)];
        });
      }
    });
    // seams and a little logo on the housing
    s.fill('body', 0, 'left,right', (x, y, w, h) => (x === 3 || x === 8) ? hex('#a8a8b4') : null);
    s.fill('body', 2, 'top', (x, y, w) => (x === 1 || x === w - 2) ? hex('#9a9aa6') : null);
    return s.done();
  }
  M.skinPainters.portal_gun_blue = () => paintGun('#3d9bff');
  M.skinPainters.portal_gun_orange = () => paintGun('#ff8a1c');
  M.skinPainters.portal_gun = M.skinPainters.portal_gun_blue;

  /* ------------------------------------------------------------ */
  /* Portal state                                                 */
  /* ------------------------------------------------------------ */
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  function build(rec, color) {
    const n = S.FACE_DIR[rec.face];
    const wall = n[1] === 0;
    const u = wall ? (n[0] !== 0 ? [0, 0, 1] : [1, 0, 0]) : [1, 0, 0];
    const v = wall ? [0, 1, 0] : [0, 0, 1];
    const hv = wall ? 1 : 0.5;
    const c = [rec.x + 0.5 + n[0] * 0.5, rec.y + 0.5 + n[1] * 0.5 + (wall ? 0.5 : 0), rec.z + 0.5 + n[2] * 0.5];
    const cells = wall ? [[rec.x, rec.y, rec.z], [rec.x, rec.y + 1, rec.z]] : [[rec.x, rec.y, rec.z]];
    return { color, x: rec.x, y: rec.y, z: rec.z, face: rec.face, n, u, v, hu: 0.5, hv, c, cells, wall, open: rec.open === undefined ? 1 : rec.open, t: 0 };
  }
  PG.portals = function (game) {
    const g = game || DL.game;
    if (!g || !g.world || !g.meta) return null;
    if (!g._pg || g._pg.world !== g.world) {
      const dim = g.world.dim || 0;
      const saved = g.meta.portals && g.meta.portals[dim];
      g._pg = { world: g.world, blue: saved && saved.blue ? build(saved.blue, 'blue') : null, orange: saved && saved.orange ? build(saved.orange, 'orange') : null };
    }
    return g._pg;
  };
  function persist(g) {
    const st = PG.portals(g);
    const dim = g.world.dim || 0;
    if (!g.meta.portals || typeof g.meta.portals !== 'object') g.meta.portals = {};
    const rec = (p) => p ? { x: p.x, y: p.y, z: p.z, face: p.face } : null;
    g.meta.portals[dim] = { blue: rec(st.blue), orange: rec(st.orange) };
  }
  const isSupport = (w, x, y, z) => { const b = w.getBlock(x, y, z); return S.SOLID[b] && S.OPAQUE[b] && S.RENDER[b] === S.R.CUBE && b !== B.bedrock || b === B.bedrock; };
  const isOpen = (w, x, y, z) => { const b = w.getBlock(x, y, z); return !S.SOLID[b] && !S.LIQUID[b]; };
  function stillValid(w, p) {
    for (const [x, y, z] of p.cells) {
      if (!isSupport(w, x, y, z) || !isOpen(w, x + p.n[0], y + p.n[1], z + p.n[2])) return false;
    }
    return true;
  }
  function overlaps(a, b) {
    if (!a || !b || a.face !== b.face) return false;
    return a.cells.some(c => b.cells.some(d => c[0] === d[0] && c[1] === d[1] && c[2] === d[2]));
  }

  /* ------------------------------------------------------------ */
  /* Firing                                                       */
  /* ------------------------------------------------------------ */
  function spark(x, y, z, col, n, sp) {
    const r = DL.game && DL.game.renderer;
    if (!r) return;
    for (let i = 0; i < n; i++) {
      const px = x + (Math.random() - 0.5) * (sp || 0.2), py = y + (Math.random() - 0.5) * (sp || 0.2), pz = z + (Math.random() - 0.5) * (sp || 0.2);
      const k = 0.7 + Math.random() * 0.5;
      r.addParticle({ type: 'pg', tex: 'particle', cellX: 0, cellY: 0, anim: true, x: px, y: py, z: pz, px, py, pz, vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.5) * 0.06, vz: (Math.random() - 0.5) * 0.06, gravity: 0, drag: 0.88, life: 10 + Math.floor(Math.random() * 14), age: 0, size: 0.06 + Math.random() * 0.06, r: col[0] * k, g: col[1] * k, b: col[2] * k, a: 1, fullBright: true });
    }
  }
  PG.fire = function (game, color) {
    const p = game.player, w = game.world;
    if (!p || !w) return;
    if ((game._pgCool || 0) > game.tickCount) return;
    game._pgCool = game.tickCount + 5;
    PG.recoil = 1; PG.last = color;
    p.swing();
    const col = COL[color];
    const ex = p.x, ey = p.y + p.eye - (p.sneaking ? 0.08 : 0), ez = p.z;
    const d = p.look();
    const hit = E.raycast(w, ex, ey, ez, d[0], d[1], d[2], 96, false);
    A.play('pgfire', null, null, null, 0.8, color === 'blue' ? 1.15 : 0.9);
    In.haptic('place');
    const dist = hit ? hit.t : 40;
    for (let t = 1; t < dist; t += 0.6) spark(ex + d[0] * t, ey + d[1] * t - 0.15, ez + d[2] * t, col, 1, 0.05);
    if (!hit || S.LIQUID[hit.id]) { if (hit) spark(hit.px, hit.py, hit.pz, col, 12, 0.5); return; }
    const rec = place(w, hit, p);
    if (!rec) {
      spark(hit.px, hit.py, hit.pz, col, 16, 0.6);
      A.play('pgfizzle', hit.px, hit.py, hit.pz, 0.8, 1);
      return;
    }
    const st = PG.portals(game);
    const np = build(rec, color);
    np.open = 0;
    if (overlaps(np, st[OTHER[color]])) { spark(hit.px, hit.py, hit.pz, col, 16, 0.6); A.play('pgfizzle', hit.px, hit.py, hit.pz, 0.8, 1); return; }
    st[color] = np;
    persist(game);
    A.play('pgopen', np.c[0], np.c[1], np.c[2], 1, color === 'blue' ? 1.1 : 0.9);
    spark(np.c[0], np.c[1], np.c[2], col, 30, 0.9);
  };
  function place(w, hit, p) {
    const f = hit.face, n = S.FACE_DIR[f];
    const x = hit.x, y = hit.y, z = hit.z;
    if (!isSupport(w, x, y, z) || w.getBlock(x, y, z) === B.bedrock && false) return null;
    if (!isOpen(w, x + n[0], y + n[1], z + n[2])) return null;
    if (n[1] !== 0) return { x, y, z, face: f };
    // walls need two blocks: prefer the one above, else below
    const ok = (yy) => isSupport(w, x, yy, z) && isOpen(w, x + n[0], yy, z + n[2]);
    const fracY = hit.py - y;
    if (fracY >= 0.5 && ok(y + 1)) return { x, y, z, face: f };
    if (ok(y - 1)) return { x, y: y - 1, z, face: f };
    if (ok(y + 1)) return { x, y, z, face: f };
    void p;
    return null;
  }
  PG.clear = function (game) {
    const st = PG.portals(game);
    if (!st || (!st.blue && !st.orange)) return;
    for (const c of ['blue', 'orange']) if (st[c]) spark(st[c].c[0], st[c].c[1], st[c].c[2], COL[c], 20, 0.8);
    st.blue = st.orange = null;
    persist(game);
    A.play('pgfizzle', null, null, null, 0.8, 0.8);
  };

  /* ------------------------------------------------------------ */
  /* Going through                                                */
  /* ------------------------------------------------------------ */
  /** Rotation (3x3, rows) taking things that enter `a` to things that leave `b`. */
  function frameMap(a, b) {
    const det3 = (c0, c1, c2) => c0[0] * (c1[1] * c2[2] - c1[2] * c2[1]) - c1[0] * (c0[1] * c2[2] - c0[2] * c2[1]) + c2[0] * (c0[1] * c1[2] - c0[2] * c1[1]);
    const nb = [-b.n[0], -b.n[1], -b.n[2]];
    let su = 1;
    if (Math.sign(det3([su * b.u[0], su * b.u[1], su * b.u[2]], b.v, nb)) !== Math.sign(det3(a.u, a.v, a.n))) su = -1;
    const ub = [su * b.u[0], su * b.u[1], su * b.u[2]];
    // R = Fb * Fa^T where Fa = [u v n], Fb = [ub vb -nb]
    const R = [];
    for (let i = 0; i < 3; i++) R.push([0, 1, 2].map(j => ub[i] * a.u[j] + b.v[i] * a.v[j] + nb[i] * a.n[j]));
    return R;
  }
  const mul = (R, v) => [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];
  PG.frameMap = frameMap;

  function teleport(game, e, a, b) {
    const R = frameMap(a, b);
    const cy = e.y + (e.h || 0) / 2;
    const rel = [e.x - a.c[0], cy - a.c[1], e.z - a.c[2]];
    // keep the lateral offset, come out just in front of the exit
    const du = Math.max(-b.hu + 0.05, Math.min(b.hu - 0.05, dot(rel, a.u)));
    const dv = Math.max(-b.hv + 0.05, Math.min(b.hv - 0.05, dot(rel, a.v)));
    const lat = mul(R, add(add([0, 0, 0], a.u, du), a.v, dv));
    let out = add(b.c, lat, 1);
    const clear = b.wall ? (e.w || 0.5) / 2 + 0.06 : (b.n[1] > 0 ? 0.05 : (e.h || 0.5) + 0.05);
    out = add(out, b.n, clear);
    let vin = [e.vx || 0, e.vy || 0, e.vz || 0];
    if (e.type === 'arrow' && e.inGround) { const cp = Math.cos(e.pitch); vin = [-Math.sin(e.yaw) * cp * 1.2, Math.sin(e.pitch) * 1.2, -Math.cos(e.yaw) * cp * 1.2]; }
    let v = mul(R, vin);
    const vn = dot(v, b.n);
    if (vn < 0.12) v = add(v, b.n, 0.12 - vn);
    const feetY = b.wall ? out[1] - (e.h || 0) / 2 : (b.n[1] > 0 ? out[1] : out[1] - (e.h || 0));
    const fy = b.wall ? Math.max(b.c[1] - b.hv, feetY) : feetY;
    e.setPos(out[0], fy, out[2]);
    e.vx = v[0]; e.vy = v[1]; e.vz = v[2];
    e.fallDistance = 0;
    e._pgCool = 6;
    if (e === game.player) {
      const L = mul(R, e.look());
      e.yaw = Math.atan2(-L[0], -L[2]);
      e.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Math.asin(Math.max(-1, Math.min(1, L[1])))));
      e.bodyYaw = e.pbodyYaw = e.yaw; e.pyaw = e.yaw; e.ppitch = e.pitch;
      A.play('pgenter', null, null, null, 0.7, 1);
      In.haptic('tick');
      game.renderer.particles.length = Math.min(game.renderer.particles.length, 200);
    } else if (e.living) {
      const L = mul(R, [-Math.sin(e.yaw), 0, -Math.cos(e.yaw)]);
      if (Math.abs(L[0]) + Math.abs(L[2]) > 0.01) e.yaw = e.bodyYaw = Math.atan2(-L[0], -L[2]);
    }
    if (e.inGround) { e.inGround = false; e.groundTime = 0; }
    spark(b.c[0], b.c[1], b.c[2], COL[b.color], 10, 0.6);
  }
  /** How an entity sits relative to a portal: lateral offsets, depth and whether it fits the hole. */
  function relTo(e, p) {
    const cy = e.y + (e.h || 0) / 2;
    const rel = [e.x - p.c[0], cy - p.c[1], e.z - p.c[2]];
    const du = dot(rel, p.u), dv = dot(rel, p.v), dn = dot(rel, p.n);
    const hw = (e.w || 0.25) / 2, hh = (e.h || 0.25) / 2;
    const fitU = Math.abs(du) <= p.hu - hw + 0.08;
    const fitV = p.wall ? Math.abs(dv) <= p.hv - hh + 0.12 : Math.abs(dv) <= p.hv - hw + 0.08;
    return { du, dv, dn, fit: fitU && fitV };
  }

  // walls behind an open portal pair do not block whoever is lined up with the hole
  const collectBoxes = E.Entity.prototype.collectBoxes;
  E.Entity.prototype.collectBoxes = function (bb) {
    const out = collectBoxes.call(this, bb);
    const g = DL.game;
    if (!g || g.world !== this.world || !g._pg || this.isProxy) return out;
    const st = g._pg;
    if (!st.blue || !st.orange) return out;
    let res = out;
    for (const p of [st.blue, st.orange]) {
      const r = relTo(this, p);
      if (!r.fit || r.dn > 2.5 || r.dn < -2) continue;
      res = res.filter(b => !p.cells.some(c => b[0] === c[0] && b[1] === c[1] && b[2] === c[2] && b[3] === c[0] + 1));
    }
    return res;
  };

  PG.tick = function (game) {
    const w = game.world, p = game.player;
    if (!w || !p) return;
    if (PG.recoil > 0) PG.recoil = Math.max(0, PG.recoil - 0.2);
    const st = PG.portals(game);
    if (!st) return;
    for (const c of ['blue', 'orange']) {
      const P = st[c];
      if (!P) continue;
      P.t++;
      if (P.open < 1) P.open = Math.min(1, P.open + 0.18);
      if (P.t % 10 === 0 && w.isReady(P.x, P.z) && !stillValid(w, P)) { st[c] = null; persist(game); A.play('pgfizzle', P.c[0], P.c[1], P.c[2], 0.8, 1); spark(P.c[0], P.c[1], P.c[2], COL[c], 20, 0.8); continue; }
      if (Math.random() < 0.3) spark(P.c[0] + P.u[0] * (Math.random() - 0.5) * 2 * P.hu, P.c[1] + P.v[1] * (Math.random() - 0.5) * 2 * P.hv + (P.wall ? 0 : 0), P.c[2] + (P.wall ? P.u[2] : P.v[2]) * (Math.random() - 0.5) * 2 * (P.wall ? P.hu : P.hv), COL[c], 1, 0.05);
    }
    if (!st.blue || !st.orange) return;
    for (const e of w.entities) {
      if (e.removed || e.isProxy || e.isRemote) continue;
      if (e._pgCool > 0) { e._pgCool--; continue; }
      if ((e.x - st.blue.c[0]) ** 2 + (e.z - st.blue.c[2]) ** 2 > 400 && (e.x - st.orange.c[0]) ** 2 + (e.z - st.orange.c[2]) ** 2 > 400) continue;
      for (const [a, b] of [[st.blue, st.orange], [st.orange, st.blue]]) {
        const r = relTo(e, a);
        const inside = r.dn < (e.type === 'arrow' && e.inGround ? 0.2 : 0) && r.dn > -1.5;
        const lateral = Math.abs(r.du) <= a.hu + 0.05 && Math.abs(r.dv) <= a.hv + 0.05;
        if (inside && lateral && (r.fit || e.type === 'arrow' || e.type === 'thrown' || e.type === 'item')) { teleport(game, e, a, b); break; }
        // funnel: nudge things that are heading in towards the middle of the hole
        if (r.dn > 0 && r.dn < 1.6 && !r.fit && Math.abs(r.du) < a.hu + 0.45 && Math.abs(r.dv) < a.hv + 0.45) {
          const toward = -dot([e.vx || 0, e.vy || 0, e.vz || 0], a.n);
          const pushing = e === p && (game.moveF || game.moveS) && -dot(p.look(), a.n) > 0.3;
          if (toward > 0.01 || pushing || (!a.wall && a.n[1] > 0)) {
            const k = 0.12;
            const fix = add(add([0, 0, 0], a.u, -r.du * k), a.wall ? [0, 0, 0] : a.v, a.wall ? 0 : -r.dv * k);
            e.vx += fix[0]; e.vz += fix[2];
            if (a.wall && Math.abs(r.dv) > a.hv - (e.h || 0) / 2 && r.dv > 0) e.vy = Math.min(e.vy, 0);
          }
        }
      }
    }
  };

  /* ------------------------------------------------------------ */
  /* Input                                                        */
  /* ------------------------------------------------------------ */
  const GP = DL.Game.prototype;
  const holding = (g) => g.player && g.player.held && g.player.held.id === GUN;
  const interact = GP.interact;
  GP.interact = function () {
    this._pgUseEdge = this.useHeld && !this._pgUseWas;
    this._pgUseWas = this.useHeld;
    if (!holding(this)) { this._pgAtkWas = this.attackHeld; return interact.call(this); }
    const edge = this.attackHeld && !this._pgAtkWas;
    this._pgAtkWas = this.attackHeld;
    if ((this.attackPressed && !(this.target && this.target.entity)) || edge) PG.fire(this, 'orange');
    const held = this.attackHeld;
    this.attackHeld = false; this.dig = null;
    const ap = this.attackPressed;
    if (ap && !(this.target && this.target.entity)) this.attackPressed = false;
    try { interact.call(this); } finally { this.attackHeld = held; }
  };
  const useItem = GP.useItem;
  GP.useItem = function () {
    if (!holding(this)) return useItem.call(this);
    if (this.player.sneaking) { PG.clear(this); return; }
    if (!this.usePressed && !this._pgUseEdge) return;
    PG.fire(this, 'blue');
  };
  const tick = GP.tick;
  GP.tick = function () {
    tick.call(this);
    if (this.inGame && this.world && !(G.screen && G.screen.pauses && !(DL.Net && DL.Net.active()))) PG.tick(this);
  };

  /* ------------------------------------------------------------ */
  /* Rendering: the gun                                           */
  /* ------------------------------------------------------------ */
  const RP = DL.Renderer.prototype;
  const lerp = (a, b, t) => a + (b - a) * t;
  function gunPose(t) {
    const open = Math.max(0, PG.recoil) * 0.5 + 0.08 + Math.sin(t * 0.08) * 0.03;
    return { body: [0, 0, 0], grip: [0.25, 0, 0], front: [0, 0, 0], glow: [0, 0, 0], claw1: [open, 0, 0], claw2: [-open * 0.6, -open * 0.6, 0], claw3: [-open * 0.6, open * 0.6, 0] };
  }
  const DUMMY = { hurtTime: 0, deathTime: 0, limbSwing: 0, limbSwingAmount: 0, prevLimbAmount: 0, swingProgress: 0 };
  RP.drawPortalGun = function (m, light, raw) {
    const pose = gunPose(performance.now() / 50);
    const skin = PG.last === 'orange' ? 'portal_gun_orange' : 'portal_gun_blue';
    this.drawModel('portal_gun', DUMMY, 0, m, light, { skin, pose, raw, only: ['body', 'grip', 'front', 'claw1', 'claw2', 'claw3'] });
    this.drawModel('portal_gun', DUMMY, 0, m, [15, 15], { skin, pose, raw, only: ['glow'] });
  };
  const renderHand = RP.renderHand;
  RP.renderHand = function (game, pt) {
    const p = game.player;
    if (!p || !p.equippedStack || p.equippedStack.id !== GUN) return renderHand.call(this, game, pt);
    const gl = this.gl;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const saveProj = new Float32Array(this.proj), saveView = new Float32Array(this.view);
    M4.perspective(this.proj, 70 * Math.PI / 180, this.w / this.h, 0.02, 10);
    M4.identity(this.view);
    if (game.settings.bobbing) {
      const walked = p.stepDist;
      const bob = lerp(p.pbob, p.bob, pt);
      const wv = -(walked + (walked - (p._pstep || walked)) * pt) * 1.6;
      M4.translate(this.view, this.view, Math.sin(wv * Math.PI) * bob * 0.5, -Math.abs(Math.cos(wv * Math.PI) * bob), 0);
    }
    const equip = lerp(p.pequipProgress, p.equipProgress, pt);
    const rc = PG.recoil;
    const bx = Math.floor(p.x), by = Math.floor(p.y + p.eye), bz = Math.floor(p.z);
    const light = [game.world.getSky(bx, by, bz), game.world.getBlockLight(bx, by, bz)];
    const m = M4.create();
    M4.translate(m, m, 0.33, -0.32 - (1 - equip) * 0.5 + Math.sin(performance.now() / 700) * 0.006, -0.66 + rc * 0.07);
    M4.rotateY(m, m, 0.2);
    M4.rotateX(m, m, 0.04 + rc * 0.25);
    M4.rotateZ(m, m, -0.05);
    M4.scale(m, m, 0.42, 0.42, 0.42);
    this.drawPortalGun(m, light, false);
    this.proj.set(saveProj); this.view.set(saveView);
  };
  const drawHeld = RP.drawHeldThirdPerson;
  RP.drawHeldThirdPerson = function (p, pt, model, light, stack, poseAs) {
    if (!stack || stack.id !== GUN) return drawHeld.apply(this, arguments);
    const m = M4.create();
    M4.copy(m, model);
    M4.translate(m, m, 0, -1.5, 0);
    M4.scale(m, m, -1, -1, 1);
    M4.translate(m, m, 0, -1.5, 0);
    const pose = DL.Models.pose(poseAs || 'player', p, pt);
    const ra = pose.rarm;
    M4.translate(m, m, (-5 + (ra[3] || 0)) / 16, (2 + (ra[4] || 0)) / 16, (ra[5] || 0) / 16);
    M4.rotateZ(m, m, ra[2]); M4.rotateY(m, m, ra[1]); M4.rotateX(m, m, ra[0]);
    M4.translate(m, m, -1 / 16, 10 / 16, -1 / 16);
    M4.rotateX(m, m, -ra[0] * 0.6);
    M4.scale(m, m, 0.55, 0.55, 0.55);
    this.drawPortalGun(m, light, true);
  };

  /* ------------------------------------------------------------ */
  /* Rendering: portals and the view through them                 */
  /* ------------------------------------------------------------ */
  const VS = `
attribute vec3 aPos; attribute vec2 aUV;
uniform mat4 uMVP; varying vec2 vUV;
void main(){ gl_Position = uMVP * vec4(aPos, 1.0); vUV = aUV; }`;
  const FS = `
precision mediump float;
uniform sampler2D uView; uniform vec2 uRes; uniform vec3 uCol; uniform float uTime, uHasView, uOpen;
varying vec2 vUV;
void main(){
  vec2 p = vUV * 2.0 - 1.0;
  float d = length(p);
  float r = uOpen;
  if (d > r) discard;
  float ang = atan(p.y, p.x);
  float sw = 0.5 + 0.5 * sin(ang * 3.0 + d * 9.0 - uTime * 3.5);
  float sw2 = 0.5 + 0.5 * sin(-ang * 2.0 + d * 14.0 + uTime * 2.3);
  vec3 inner = uHasView > 0.5 ? texture2D(uView, gl_FragCoord.xy / uRes).rgb : uCol * (0.18 + 0.3 * sw * sw2) + vec3(0.02);
  float rim = smoothstep(r - 0.24, r - 0.02, d);
  vec3 glow = uCol * (1.15 + 0.35 * sw) + vec3(0.25) * smoothstep(r - 0.06, r, d);
  vec3 col = mix(inner, glow, rim);
  if (uHasView > 0.5) col = mix(col, uCol, 0.06 * (1.0 - rim));
  gl_FragColor = vec4(col, 1.0);
}`;
  RP.pgInit = function () {
    if (this._pgSh) return;
    const gl = this.gl;
    this._pgSh = this.compile(VS, FS, ['aPos', 'aUV']);
    this._pgBuf = gl.createBuffer();
    this._pgFbo = {};
  };
  RP.pgTarget = function (color) {
    const gl = this.gl;
    const w = Math.max(64, Math.min(1024, Math.floor(this.w / 2))), h = Math.max(64, Math.min(1024, Math.floor(this.h / 2)));
    let f = this._pgFbo[color];
    if (f && f.w === w && f.h === h) return f;
    if (f) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); gl.deleteRenderbuffer(f.rb); }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    f = { fb, tex, rb, w, h, ok, ready: false };
    this._pgFbo[color] = f;
    return f;
  };
  /** Replace the near plane with the exit portal's plane (Lengyel's oblique frustum). */
  function oblique(P, c) {
    const q = [(Math.sign(c[0]) + P[8]) / P[0], (Math.sign(c[1]) + P[9]) / P[5], -1, (1 + P[10]) / P[14]];
    const k = 2 / (c[0] * q[0] + c[1] * q[1] + c[2] * q[2] + c[3] * q[3]);
    P[2] = c[0] * k; P[6] = c[1] * k; P[10] = c[2] * k + 1; P[14] = c[3] * k;
  }
  RP.pgRenderViews = function (main) {
    const g = DL.game, w = g && g.world;
    if (!w || !g.inGame || !g._pg || g._pg.world !== w) return;
    const st = g._pg;
    if (!st.blue || !st.orange) return;
    this.pgInit();
    const gl = this.gl;
    const cam = [main.x, main.y, main.z];
    const want = [];
    for (const [a, b] of [[st.blue, st.orange], [st.orange, st.blue]]) {
      const f = this._pgFbo[a.color];
      if (f) f.ready = false;
      if (!a.wall || !b.wall || a.open < 0.3) continue;
      const rel = [cam[0] - a.c[0], cam[1] - a.c[1], cam[2] - a.c[2]];
      if (dot(rel, a.n) < 0.02 || dot(rel, rel) > 72 * 72) continue;
      const fr = this.frustum;
      if (fr && fr.testAABB && !fr.testAABB(a.c[0] - 1 - cam[0], a.c[1] - 1.2 - cam[1], a.c[2] - 1 - cam[2], a.c[0] + 1 - cam[0], a.c[1] + 1.2 - cam[1], a.c[2] + 1 - cam[2])) continue;
      want.push([a, b]);
    }
    if (!want.length) return;
    // with both in sight, refresh them on alternate frames
    this._pgFlip = !this._pgFlip;
    const list = want.length === 2 ? [want[this._pgFlip ? 0 : 1]] : want;
    for (const [a, b] of list) {
      const f = this.pgTarget(a.color);
      if (!f.ok) continue;
      const R = frameMap(a, b);
      const rel = [cam[0] - a.c[0], cam[1] - a.c[1], cam[2] - a.c[2]];
      const vp = add(b.c, mul(R, rel), 1);
      const fwd = mul(R, [-Math.sin(main.yaw) * Math.cos(main.pitch), Math.sin(main.pitch), -Math.cos(main.yaw) * Math.cos(main.pitch)]);
      const yaw = Math.atan2(-fwd[0], -fwd[2]), pitch = Math.asin(Math.max(-1, Math.min(1, fwd[1])));
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb);
      gl.viewport(0, 0, f.w, f.h);
      this.pgSetup(vp[0], vp[1], vp[2], yaw, pitch, 0, main.fov, main.far, null);
      // clip everything behind the exit portal's wall
      const n = b.n, V = this.view;
      const nv = [V[0] * n[0] + V[4] * n[1] + V[8] * n[2], V[1] * n[0] + V[5] * n[1] + V[9] * n[2], V[2] * n[0] + V[6] * n[1] + V[10] * n[2]];
      const dpl = n[0] * (vp[0] - b.c[0]) + n[1] * (vp[1] - b.c[1]) + n[2] * (vp[2] - b.c[2]) + 0.01;
      if (dpl < 0) oblique(this.proj, [nv[0], nv[1], nv[2], dpl]);
      const fc = this.fogColor;
      gl.clearColor(fc[0], fc[1], fc[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const tp = g.thirdPerson;
      try {
        this.renderSky(w, 0.5);
        this.collectVisible(w);
        this.renderChunks(w, false);
        g.thirdPerson = 1;
        this.renderEntities(g, 0.5);
        g.thirdPerson = tp;
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this.renderChunks(w, true);
        gl.disable(gl.BLEND);
        f.ready = true;
      } catch (e) { console.warn('portal view', e); }
      g.thirdPerson = tp;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.w, this.h);
    }
  };
  const setupCamera = RP.setupCamera;
  RP.pgSetup = setupCamera;
  RP.setupCamera = function (x, y, z, yaw, pitch, roll, fov, far) {
    if (!this._pgInner && DL.game && DL.game.world && DL.game.inGame && DL.game._pg) {
      this._pgInner = true;
      try { this.pgRenderViews({ x, y, z, yaw, pitch, fov, far }); } catch (e) { console.warn('portal views', e); }
      this._pgInner = false;
    }
    return setupCamera.apply(this, arguments);
  };
  RP.pgDrawPortals = function (game) {
    const st = game._pg;
    if (!st || st.world !== game.world || (!st.blue && !st.orange)) return;
    this.pgInit();
    const gl = this.gl, cam = this.cam, sh = this._pgSh;
    const mvp = M4.create();
    M4.multiply(mvp, this.proj, this.view);
    gl.useProgram(sh.p);
    gl.uniformMatrix4fv(sh.u.uMVP, false, mvp);
    gl.uniform2f(sh.u.uRes, this.w, this.h);
    gl.uniform1f(sh.u.uTime, performance.now() / 1000);
    gl.uniform1i(sh.u.uView, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._pgBuf);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.disableVertexAttribArray(2);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4);
    for (const c of ['blue', 'orange']) {
      const P = st[c];
      if (!P) continue;
      const o = add(P.c, P.n, 0.004);
      const cx = o[0] - cam.x, cy = o[1] - cam.y, cz = o[2] - cam.z;
      const U = P.u, Vv = P.v, hu = P.hu * 0.98, hv = P.hv * 0.98;
      const pt = (su, sv) => [cx + U[0] * su * hu + Vv[0] * sv * hv, cy + U[1] * su * hu + Vv[1] * sv * hv, cz + U[2] * su * hu + Vv[2] * sv * hv];
      const q = [pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)], uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      const data = new Float32Array(30);
      [0, 1, 2, 0, 2, 3].forEach((k, i) => { data.set(q[k], i * 5); data[i * 5 + 3] = uv[k][0]; data[i * 5 + 4] = uv[k][1]; });
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
      const f = this._pgFbo[c];
      const has = !!(f && f.ready && st.blue && st.orange);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, has ? f.tex : this.terrainTex);
      gl.uniform1f(sh.u.uHasView, has ? 1 : 0);
      gl.uniform3fv(sh.u.uCol, COL[c]);
      gl.uniform1f(sh.u.uOpen, Math.max(0.05, P.open));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.enable(gl.CULL_FACE);
  };
  const renderBillboards = RP.renderBillboards;
  RP.renderBillboards = function (world, pt) {
    if (DL.game && DL.game.world === world) { try { this.pgDrawPortals(DL.game); } catch (e) { console.warn('portals', e); } }
    return renderBillboards.apply(this, arguments);
  };

  /* ------------------------------------------------------------ */
  /* HUD: Portal-style crosshair                                  */
  /* ------------------------------------------------------------ */
  const extras = G.drawHUDExtras;
  G.drawHUDExtras = function (game, Wd, H, hy) {
    if (game.inGame && holding(game) && !game.hideGui && !G.screen) {
      const ctx = G.ctx, st = PG.portals(game);
      const cx = Wd / 2, cy = H / 2, r = 7;
      ctx.save();
      ctx.lineWidth = 1.5;
      for (const [c, a0, a1] of [['blue', Math.PI * 0.62, Math.PI * 1.38], ['orange', -Math.PI * 0.38, Math.PI * 0.38]]) {
        const col = COL[c].map(v => Math.round(v * 255));
        ctx.strokeStyle = 'rgb(' + col.join(',') + ')';
        ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
        if (st && st[c]) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(cx + (c === 'blue' ? -r - 2.5 : r + 2.5), cy, 1.6, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
    return extras.call(this, game, Wd, H, hy);
  };
})();
