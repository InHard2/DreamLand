/*
 * DreamLand - OreSpawn's creatures.
 * Built from seven families of models (theropods, four-legged beasts, bugs, flyers,
 * sea creatures, serpents and humanoids), each with its own walk, flap, swim or
 * slither, so that nearly a hundred creatures can share a few dozen lines each:
 * ants of five kinds (the way to OreSpawn's dimensions), butterflies, moths,
 * dragonflies, crickets, bees, mantises, beetles, scorpions, crabs, T. rexes and
 * raptors, camarasauruses, gazelles, ostriches, peacocks, rats, frogs, squids,
 * sharks, whales, jellyfish, worms, robots, ender knights, aliens, fairies...
 * The bosses (The King, The Queen, Mobzilla, the Kraken, Mothra...) are in
 * orespawn_bosses.js.
 */
(function () {
  'use strict';
  const DL = window.DL;
  const S = DL.S, B = S.B, E = DL.Entities, I = DL.Items, M = DL.Models, A = DL.Audio, N = DL.Net;
  const MOBS = E.MOBS, D = M.defs, hex = M.hex, Skin = M.Skin, AN = M.anims, SP = M.skinPainters;
  const OS = DL.OreSpawn, AI = E.AI, SOLID = S.SOLID, BI = S.BIOME;
  const rnd = Math.random;
  const isGuest = () => !!(N && N.client);
  const P = (pivot, boxes, extra) => Object.assign({ pivot, boxes }, extra || {});
  const id = (n) => (I.byName[n] ? I.byName[n].id : 0);
  const snd = (m, k, v, p) => { if (m.world.fx) m.world.fx.sound(k, m.x, m.y + m.h * 0.6, m.z, v || 1, p || 1); };
  const fx = (m, k, n, s, dy) => { if (m.world.fx) m.world.fx.particles(k, m.x, m.y + (dy === undefined ? m.h * 0.6 : dy), m.z, n, s || 0.5); };
  const OSM = OS.mobs = { list: [] };

  /* ------------------------------------------------------------ */
  /* Little kinematics: chains of parts (tails, necks, tentacles) */
  /* ------------------------------------------------------------ */
  // the renderer turns a part by Rz * Ry * Rx about its pivot (model space, y down)
  function rot(v, rx, ry, rz) {
    let x = v[0], y = v[1], z = v[2], c = Math.cos(rx), s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
    c = Math.cos(ry); s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(rz); s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c];
    return [x, y, z];
  }
  /** Lay segments end to end from base, each bending a little more. segs: [{n, p (default pivot), v (vector to its end)}] */
  function chain(o, base, segs, bends, start) {
    let pos = base.slice(), ax = start ? start[0] : 0, ay = start ? start[1] : 0, az = start ? start[2] : 0;
    segs.forEach((sg, i) => {
      const b = bends[i] || bends[bends.length - 1] || [0, 0, 0];
      ax += b[0]; ay += b[1]; az += b[2] || 0;
      o[sg.n] = [ax, ay, az, pos[0] - sg.p[0], pos[1] - sg.p[1], pos[2] - sg.p[2]];
      const d = rot(sg.v, ax, ay, az);
      pos = [pos[0] + d[0], pos[1] + d[1], pos[2] + d[2]];
    });
    return pos;
  }
  OSM.rot = rot; OSM.chain = chain;

  /* ------------------------------------------------------------ */
  /* Skins                                                        */
  /* ------------------------------------------------------------ */
  function paint(model, seed, colors, extra) {
    const s = new Skin(model, seed), mdl = D[model];
    for (const pn in mdl.parts) mdl.parts[pn].boxes.forEach((b, bi) => {
      const c = colors[pn + ':' + bi] !== undefined ? colors[pn + ':' + bi] : colors[pn] !== undefined ? colors[pn] : colors._;
      if (!c) { s.fill(pn, bi, 'all', () => [0, 0, 0, 0]); return; }
      const base = hex(Array.isArray(c) ? c[0] : c), v = Array.isArray(c) && c[1] !== undefined ? c[1] : 0.08;
      const belly = colors.belly ? hex(colors.belly) : null;
      for (const f of ['bottom', 'top', 'front', 'back', 'left', 'right']) {
        const k = f === 'top' ? 1.12 : f === 'bottom' ? 0.78 : 1;
        s.fill(pn, bi, f, () => {
          if (belly && f === 'bottom' && /body|thorax|abdomen|neck/.test(pn)) return belly;
          const j = 1 + (s.r.next() - 0.5) * 2 * v; return [Math.min(255, base[0] * k * j), Math.min(255, base[1] * k * j), Math.min(255, base[2] * k * j)];
        });
      }
    });
    if (extra) extra(s);
    return s.done();
  }
  // stripes, spots and scales over chosen parts
  const pattern = (s, parts, faces, fn) => { for (const [pn, bis] of parts) for (const bi of bis) s.fill(pn, bi, faces, fn); };
  const eyesOn = (s, part, bi, rows, pal) => s.art(part, bi, 'front', rows, pal);
  const EY = (c, k) => ({ W: hex(c || '#ffffff'), K: hex(k || '#101010'), R: hex('#ff2020'), Y: hex('#ffe030'), G: hex('#40ff60'), C: hex('#60e8ff'), P: hex('#e040ff') });
  OSM.paint = paint;

  /* ------------------------------------------------------------ */
  /* Families of models                                           */
  /* ------------------------------------------------------------ */
  const fam = {};
  /** A dinosaur standing on two legs: body leaning forward, a long tail, little arms. */
  fam.theropod = (name, o) => {
    const leg = o.leg || 12, L = o.L || 16, H = o.H || 9, Wd = o.W || 8, hipY = 24 - leg;
    const [hw, hh, hd] = o.head || [6, 6, 9], nl = o.neck || 3, tw = o.tw || 5, tl = o.tl || [9, 8, 7];
    const parts = {
      body: P([0, hipY, 0], [[-Wd / 2, -H * 0.75, -L * 0.55, Wd, H, L]].concat(o.bodyExtra || [])),
      head: P([0, hipY - H * 0.55, -L * 0.55], [[-hw / 2 + 1, -hh * 0.6, -nl, hw - 2, hh * 0.8, nl], [-hw / 2, -hh, -nl - hd, hw, hh * 0.7, hd]].concat(o.headExtra || [])),
      jaw: P([0, hipY - H * 0.55, -L * 0.55], [[-hw / 2 + 0.5, -hh * 0.3, -nl - hd + 0.5, hw - 1, hh * 0.35, hd - 1]].concat(o.teeth ? [[-hw / 2 + 0.6, -hh * 0.45, -nl - hd + 0.6, hw - 1.2, 0.6, hd - 1.5]] : [])),
      rleg: P([-Wd / 2 + 1.5, hipY, 1], [[-2, -1, -2.5, 4, leg * 0.55, 5], [-1.5, leg * 0.5, -1, 3, leg * 0.5 - 1, 3], [-2, leg - 1, -3.5, 4, 1, 5]]),
      lleg: P([Wd / 2 - 1.5, hipY, 1], [[-2, -1, -2.5, 4, leg * 0.55, 5], [-1.5, leg * 0.5, -1, 3, leg * 0.5 - 1, 3], [-2, leg - 1, -3.5, 4, 1, 5]]),
      rarm: P([-Wd / 2, hipY - H * 0.35, -L * 0.42], [[-1, 0, -1, 1.5, o.arm || 4, 1.5]]),
      larm: P([Wd / 2, hipY - H * 0.35, -L * 0.42], [[-0.5, 0, -1, 1.5, o.arm || 4, 1.5]])
    };
    tl.forEach((len, i) => { const k = 1 - i * 0.28; parts['tail' + i] = P([0, hipY - H * 0.45, L * 0.45], [[-tw * k / 2, -tw * k / 2, 0, tw * k, tw * k * 0.9, len]].concat(o.tailExtra && o.tailExtra[i] ? o.tailExtra[i] : [])); });
    D[name] = { anim: 'os_theropod', shadow: o.shadow || 0.7, noCull: !!o.noCull, parts, os: { hipY, H, L, tl, leg } };
  };
  /** Four legs: beasts, lizards, long-necked sauropods. */
  fam.quad = (name, o) => {
    const leg = o.leg === undefined ? 8 : o.leg, L = o.L || 14, H = o.H || 8, Wd = o.W || 8, top = 24 - leg;
    const [hw, hh, hd] = o.head || [6, 6, 6], lw = o.lw || 3, nl = o.neck || 0, tl = o.tl || [6];
    const parts = {
      body: P([0, top, 0], [[-Wd / 2, -H, -L / 2, Wd, H, L]].concat(o.bodyExtra || [])),
      leg1: P([-Wd / 2 + lw / 2, top, -L / 2 + lw / 2 + 0.5], [[-lw / 2, -0.5, -lw / 2, lw, leg + 0.5, lw]]),
      leg2: P([Wd / 2 - lw / 2, top, -L / 2 + lw / 2 + 0.5], [[-lw / 2, -0.5, -lw / 2, lw, leg + 0.5, lw]]),
      leg3: P([-Wd / 2 + lw / 2, top, L / 2 - lw / 2 - 0.5], [[-lw / 2, -0.5, -lw / 2, lw, leg + 0.5, lw]]),
      leg4: P([Wd / 2 - lw / 2, top, L / 2 - lw / 2 - 0.5], [[-lw / 2, -0.5, -lw / 2, lw, leg + 0.5, lw]])
    };
    if (nl) parts.neck = P([0, top - H * 0.7, -L / 2], [[-(o.nw || 3) / 2, -(o.nw || 3) / 2, -nl, o.nw || 3, o.nw || 3, nl]]);
    parts.head = P([0, top - H * 0.7, -L / 2 - (nl ? 0 : 0)], [[-hw / 2, -hh / 2, -hd, hw, hh, hd]].concat(o.headExtra || []));
    tl.forEach((len, i) => { const k = 1 - i * 0.3, t = (o.tw || 2) * k; parts['tail' + i] = P([0, top - H * 0.8, L / 2], [[-t / 2, -t / 2, 0, t, t, len]].concat(o.tailExtra && o.tailExtra[i] ? o.tailExtra[i] : [])); });
    D[name] = { anim: 'os_quad', shadow: o.shadow || 0.5, noCull: !!o.noCull, parts, os: { top, H, L, nl, tl, nw: o.nw || 3, neckUp: o.neckUp || 0 } };
  };
  /** Six legs (or eight), a head, a thorax and an abdomen; claws, stingers, horns and wings as wanted. */
  fam.bug = (name, o) => {
    const legH = o.legH || 3, top = 24 - legH, [tw, th, tl] = o.thorax || [4, 3, 4], [aw, ah, al] = o.abdomen || [5, 4, 6], [hw, hh, hd] = o.head || [3, 3, 3];
    const ll = o.legLen || 5, pairs = o.pairs || 3;
    const parts = {
      thorax: P([0, top, 0], [[-tw / 2, -th, -tl / 2, tw, th, tl]]),
      abdomen: P([0, top - th / 2, tl / 2], [[-aw / 2, -ah / 2, 0, aw, ah, al]].concat(o.abdomenExtra || [])),
      head: P([0, top - th / 2, -tl / 2], [[-hw / 2, -hh / 2, -hd, hw, hh, hd]].concat(o.headExtra || []))
    };
    for (let i = 0; i < pairs; i++) {
      const z = -tl / 2 + (tl * (i + 0.5)) / pairs;
      parts['rl' + i] = P([-tw / 2, top - th * 0.3, z], [[-ll, -0.5, -0.5, ll, 1, 1], [-ll, 0, -0.5, 1, legH + 0.5, 1]]);
      parts['ll' + i] = P([tw / 2, top - th * 0.3, z], [[0, -0.5, -0.5, ll, 1, 1], [ll - 1, 0, -0.5, 1, legH + 0.5, 1]]);
    }
    if (o.antennae) { parts.ant = P([0, top - th / 2, -tl / 2], [[-1.5, -hh / 2 - o.antennae, -hd + 0.5, 0.5, o.antennae, 0.5], [1, -hh / 2 - o.antennae, -hd + 0.5, 0.5, o.antennae, 0.5]], { follow: 'head' }); }
    if (o.mandibles) parts.mand = P([0, top - th / 2, -tl / 2], [[-hw / 2, 0, -hd - o.mandibles, 1, 1, o.mandibles], [hw / 2 - 1, 0, -hd - o.mandibles, 1, 1, o.mandibles]], { follow: 'head' });
    if (o.claws) { const [cl, cw] = o.claws; parts.rclaw = P([-tw / 2, top - th / 2, -tl / 2], [[-cw, -cw / 2, -cl, cw, cw, cl], [-cw - 0.5, -cw / 2, -cl - cw, cw / 2, cw, cw]]); parts.lclaw = P([tw / 2, top - th / 2, -tl / 2], [[0, -cw / 2, -cl, cw, cw, cl], [cw / 2 + 0.5, -cw / 2, -cl - cw, cw / 2, cw, cw]]); }
    if (o.raptorial) { const r = o.raptorial; parts.rclaw = P([-tw / 2 + 0.5, top - th, -tl / 2], [[-1, 0, -1, 1.5, r, 1.5], [-1, r - 1, -r * 0.8, 1.5, 1.5, r * 0.8]]); parts.lclaw = P([tw / 2 - 0.5, top - th, -tl / 2], [[-0.5, 0, -1, 1.5, r, 1.5], [-0.5, r - 1, -r * 0.8, 1.5, 1.5, r * 0.8]]); }
    if (o.stinger) o.stinger.forEach((len, i) => { parts['st' + i] = P([0, top - th / 2, tl / 2 + al], [[-1.2 + i * 0.15, -1.2 + i * 0.15, 0, 2.4 - i * 0.3, 2.4 - i * 0.3, len]].concat(i === o.stinger.length - 1 ? [[-0.5, -0.5, len, 1, 1, 2]] : [])); });
    if (o.wings) { const [wl, ww] = o.wings; parts.rwing = P([-0.5, top - th, 0], [[-ww, 0, -1, ww, 0.3, wl]]); parts.lwing = P([0.5, top - th, 0], [[0, 0, -1, ww, 0.3, wl]]); }
    if (o.elytra) { parts.relytra = P([-0.2, top - th, tl / 2 - 0.5], [[-aw / 2 - 0.5, -1, 0, aw / 2 + 0.5, 1.5, al + 1]]); parts.lelytra = P([0.2, top - th, tl / 2 - 0.5], [[0, -1, 0, aw / 2 + 0.5, 1.5, al + 1]]); }
    D[name] = { anim: 'os_bug', shadow: o.shadow || 0.3, noCull: true, parts, os: { pairs, stinger: o.stinger, top, th, tl, al, hop: o.hop } };
  };
  /** Wings: butterflies and moths, birds, dragons, flying sharks. */
  fam.flyer = (name, o) => {
    const [bw, bh, bl] = o.body || [3, 3, 8], [hw, hh, hd] = o.head || [3, 3, 3], [wl, ww] = o.wing || [8, 10], cy = o.cy || 16;
    const wthick = o.wthick || 0.4;
    const parts = {
      body: P([0, cy, 0], [[-bw / 2, -bh / 2, -bl / 2, bw, bh, bl]].concat(o.bodyExtra || [])),
      head: P([0, cy - bh * 0.2, -bl / 2], [[-hw / 2, -hh / 2, -hd, hw, hh, hd]].concat(o.headExtra || [])),
      rwing: P([-bw / 2, cy - bh / 2 + 0.2, -bl / 2 + (o.wingZ || 1)], [[-ww, 0, 0, ww, wthick, wl]].concat(o.rwingExtra || [])),
      lwing: P([bw / 2, cy - bh / 2 + 0.2, -bl / 2 + (o.wingZ || 1)], [[0, 0, 0, ww, wthick, wl]].concat(o.lwingExtra || []))
    };
    if (o.hind) { const [hl2, hw2] = o.hind; parts.rhind = P([-bw / 2, cy - bh / 2 + 0.3, 0], [[-hw2, 0, 0, hw2, wthick, hl2]]); parts.lhind = P([bw / 2, cy - bh / 2 + 0.3, 0], [[0, 0, 0, hw2, wthick, hl2]]); }
    if (o.tail) o.tail.forEach((len, i) => { const k = 1 - i * 0.3, t = (o.tw || 2) * k; parts['tail' + i] = P([0, cy, bl / 2], [[-t / 2, -t / 2, 0, t, t, len]].concat(o.tailExtra && o.tailExtra[i] ? o.tailExtra[i] : [])); });
    if (o.legs) { parts.rleg = P([-bw / 4, cy + bh / 2, 0], [[-0.5, 0, -0.5, 1, o.legs, 1]]); parts.lleg = P([bw / 4, cy + bh / 2, 0], [[-0.5, 0, -0.5, 1, o.legs, 1]]); }
    if (o.antennae) parts.ant = P([0, cy - bh * 0.2, -bl / 2], [[-1.2, -hh / 2 - o.antennae, -hd, 0.4, o.antennae, 0.4], [0.8, -hh / 2 - o.antennae, -hd, 0.4, o.antennae, 0.4]], { follow: 'head' });
    D[name] = { anim: 'os_flyer', shadow: o.shadow || 0.3, noCull: true, parts, os: { flap: o.flap || 0.6, speed: o.flapSpeed || 0.6, tail: o.tail, cy, bl, glide: o.glide } };
  };
  /** Fish, sharks, whales, squids, jellyfish and rays. */
  fam.fish = (name, o) => {
    const [bw, bh, bl] = o.body || [3, 4, 8], cy = o.cy || 18;
    const parts = { body: P([0, cy, 0], [[-bw / 2, -bh / 2, -bl / 2, bw, bh, bl]].concat(o.bodyExtra || [])) };
    if (o.tail !== false) parts.tail = P([0, cy, bl / 2], [[-0.5, -bh * 0.4, 0, 1, bh * 0.8, o.tailLen || 3], [-0.5, -bh * 0.7, (o.tailLen || 3) - 1, 1, bh * 1.4, 2]].concat(o.tailExtra || []));
    if (o.fins) { parts.rfin = P([-bw / 2, cy + bh * 0.1, -bl / 4], [[-o.fins, 0, -1, o.fins, 0.4, 3]]); parts.lfin = P([bw / 2, cy + bh * 0.1, -bl / 4], [[0, 0, -1, o.fins, 0.4, 3]]); }
    if (o.dorsal) parts.dorsal = P([0, cy - bh / 2, 0], [[-0.4, -o.dorsal, -1, 0.8, o.dorsal, 4]], { follow: 'body' });
    if (o.hammer) parts.head = P([0, cy, -bl / 2], [[-o.hammer / 2, -1, -3, o.hammer, 2, 3]]);
    if (o.tentacles) { const [n, len, r] = o.tentacles; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; parts['tn' + i] = P([Math.cos(a) * r, cy + bh / 2, Math.sin(a) * r], [[-0.6, 0, -0.6, 1.2, len, 1.2]]); } }
    if (o.wings) { parts.rfin = P([-bw / 2, cy, 0], [[-o.wings, -0.3, -bl / 3, o.wings, 0.6, bl * 0.66]]); parts.lfin = P([bw / 2, cy, 0], [[0, -0.3, -bl / 3, o.wings, 0.6, bl * 0.66]]); }
    D[name] = { anim: 'os_fish', shadow: 0, noCull: true, parts, os: { tentacles: o.tentacles, cy, bh, jelly: o.jelly, ray: !!o.wings } };
  };
  /** A body of many segments: worms, caterpillars, sea serpents, the basilisk. */
  fam.serpent = (name, o) => {
    const n = o.segments || 6, sw = o.sw || 4, sl = o.sl || 5, cy = o.cy || 24 - sw / 2, [hw, hh, hd] = o.head || [5, 4, 6];
    const parts = { head: P([0, cy, 0], [[-hw / 2, -hh / 2, -hd, hw, hh, hd]].concat(o.headExtra || [])), jaw: P([0, cy, 0], [[-hw / 2 + 0.5, hh / 2 - 0.5, -hd + 0.5, hw - 1, 1.5, hd - 1]]) };
    for (let i = 0; i < n; i++) { const k = o.taper ? 1 - (i / n) * o.taper : 1; parts['s' + i] = P([0, cy, i * sl], [[-sw * k / 2, -sw * k / 2, 0, sw * k, sw * k, sl + 0.2]].concat(o.segExtra ? o.segExtra(i, sw * k) : [])); }
    D[name] = { anim: 'os_serpent', shadow: o.shadow || 0.6, noCull: true, parts, os: { n, sl, cy, upright: !!o.upright, wave: o.wave || 0.35 } };
  };
  /** Two legs and two arms: knights, reapers, aliens, robots, plant monsters. */
  fam.humanoid = (name, o) => {
    const parts = {
      head: P([0, 0, 0], o.head || [[-4, -8, -4, 8, 8, 8]]),
      body: P([0, 0, 0], o.body || [[-4, 0, -2, 8, 12, 4]]),
      rarm: P([-5, 2, 0], o.rarm || [[-3, -2, -2, 4, 12, 4]]), larm: P([5, 2, 0], o.larm || [[-1, -2, -2, 4, 12, 4]]),
      rleg: P([-2, 12, 0], o.rleg || [[-2, 0, -2, 4, 12, 4]]), lleg: P([2, 12, 0], o.lleg || [[-2, 0, -2, 4, 12, 4]])
    };
    for (const k of ['head', 'body', 'rarm', 'larm', 'rleg', 'lleg']) if (o[k] === null) delete parts[k];
    if (o.extra) Object.assign(parts, o.extra);
    D[name] = { anim: 'os_humanoid', shadow: o.shadow || 0.5, noCull: !!o.noCull, parts, os: { float: o.float, heavy: o.heavy } };
  };
  OSM.fam = fam; OSM.P = P;

  /* ------------------------------------------------------------ */
  /* Animations                                                   */
  /* ------------------------------------------------------------ */
  const q = (limb, a, amt, k) => Math.cos(limb * (k || 0.6662) + a) * 1.2 * amt;
  AN.os_theropod = ({ name, e, o, limb, amt, headYaw, headPitch, age, swing }) => {
    const md = D[e && e.def && e.def.model || name] || D[name], g = md.os;
    const stride = q(limb, 0, amt, 0.5);
    const bob = Math.abs(Math.sin(limb * 0.5)) * amt * 1.2;
    o.body = [Math.sin(limb * 0.5) * 0.04 * amt, 0, Math.sin(limb * 0.25) * 0.05 * amt, 0, -bob, 0];
    const bite = Math.max(swing || 0, e.attackAnim > 0 ? e.attackAnim / 10 : 0);
    const roar = e.roar > 0 ? Math.sin(Math.min(1, e.roar / 20) * Math.PI) : 0;
    o.head = [headPitch * 0.6 - roar * 0.4 + Math.sin(age * 0.05) * 0.03, headYaw * 0.8, 0, 0, -bob, 0];
    o.jaw = [o.head[0] + 0.08 + bite * 0.7 + roar * 0.6, o.head[1], 0, 0, -bob, 0];
    o.rleg = [stride, 0, 0]; o.lleg = [-stride, 0, 0];
    o.rarm = [0.3 + Math.sin(age * 0.1) * 0.1, 0, 0.1, 0, -bob, 0]; o.larm = [0.3 - Math.sin(age * 0.1) * 0.1, 0, -0.1, 0, -bob, 0];
    const sway = Math.sin(age * 0.08 + limb * 0.3) * 0.12 + Math.sin(limb * 0.5) * 0.15 * amt;
    const segs = g.tl.map((len, i) => ({ n: 'tail' + i, p: md.parts['tail' + i].pivot, v: [0, 0, len] }));
    chain(o, [md.parts.tail0.pivot[0], md.parts.tail0.pivot[1] - bob, md.parts.tail0.pivot[2]], segs, [[-0.12, sway, 0], [0.08, sway * 0.8, 0], [0.06, sway * 0.6, 0]]);
    return o;
  };
  AN.os_quad = ({ name, e, o, limb, amt, headYaw, headPitch, age, swing }) => {
    const md = D[e && e.def && e.def.model || name] || D[name], g = md.os;
    const w = q(limb, 0, amt);
    o.body = [0, 0, 0];
    o.leg1 = [w, 0, 0]; o.leg2 = [-w, 0, 0]; o.leg3 = [-w, 0, 0]; o.leg4 = [w, 0, 0];
    const graze = e.grazing > 0 ? 0.9 : 0, bite = Math.max(swing || 0, e.attackAnim > 0 ? e.attackAnim / 10 : 0);
    if (g.nl) {
      const np = md.parts.neck.pivot;
      const end = chain(o, np, [{ n: 'neck', p: np, v: [0, 0, -g.nl] }], [[-g.neckUp + headPitch * 0.3 + graze, headYaw * 0.4, 0]]);
      o.head = [headPitch * 0.6 + graze * 0.4 + bite * 0.3, headYaw * 0.8, 0, end[0] - md.parts.head.pivot[0], end[1] - md.parts.head.pivot[1], end[2] - md.parts.head.pivot[2]];
    } else o.head = [headPitch + graze + bite * 0.4, headYaw, 0];
    if (g.tl && g.tl.length) {
      const sway = Math.sin(age * 0.12) * 0.25 + w * 0.15;
      chain(o, md.parts.tail0.pivot, g.tl.map((len, i) => ({ n: 'tail' + i, p: md.parts['tail' + i].pivot, v: [0, 0, len] })), [[e.tailUp !== undefined ? e.tailUp : 0.4, sway, 0], [0.1, sway * 0.6, 0], [0.1, sway * 0.4, 0]]);
    }
    return o;
  };
  AN.os_bug = ({ name, e, o, limb, amt, headYaw, headPitch, age, swing }) => {
    const md = D[e && e.def && e.def.model || name] || D[name], g = md.os;
    const hop = g.hop && e && !e.onGround ? 1 : 0;
    o.thorax = [0, 0, 0]; o.head = [headPitch * 0.5, headYaw * 0.6, 0];
    o.abdomen = [-0.1 + Math.sin(age * 0.15) * 0.04, Math.sin(limb * 0.4) * 0.05 * amt, 0];
    for (let i = 0; i < g.pairs; i++) {
      const ph = i % 2 ? Math.PI : 0, lift = Math.max(0, Math.sin(limb * 1.4 + ph)) * 0.5 * amt;
      const swingL = Math.cos(limb * 1.4 + ph) * 0.45 * amt;
      o['rl' + i] = [0, -0.3 + (i - 1) * 0.35 + swingL, 0.3 - lift - hop * 0.6]; o['ll' + i] = [0, 0.3 - (i - 1) * 0.35 + swingL, -0.3 + lift + hop * 0.6];
    }
    const pinch = Math.max(swing || 0, e.attackAnim > 0 ? e.attackAnim / 10 : 0);
    o.rclaw = [-0.2 - pinch * 0.6, 0.2 + Math.sin(age * 0.1) * 0.08, 0]; o.lclaw = [-0.2 - pinch * 0.6, -0.2 - Math.sin(age * 0.1) * 0.08, 0];
    if (g.stinger) {
      const tp = md.parts.st0.pivot, strike = pinch;
      chain(o, tp, g.stinger.map((len, i) => ({ n: 'st' + i, p: md.parts['st' + i].pivot, v: [0, 0, len] })), [[-0.9 - strike * 0.3, 0, 0], [-0.7 - strike * 0.3, 0, 0], [-0.6 - strike * 0.4, 0, 0], [-0.5, 0, 0]]);
    }
    const buzz = e && (!e.onGround || e.def && e.def.fly) ? Math.sin(age * 3) * 0.5 : 0;
    o.rwing = [0, 0.2, -0.2 - buzz]; o.lwing = [0, -0.2, 0.2 + buzz];
    const open = hop || (e && e.def && e.def.fly && !e.onGround) ? 0.8 : 0;
    o.relytra = [0, 0, -open]; o.lelytra = [0, 0, open];
    return o;
  };
  AN.os_flyer = ({ name, e, o, limb, amt, headYaw, headPitch, age }) => {
    const md = D[e && e.def && e.def.model || name] || D[name], g = md.os;
    const grounded = e && e.onGround && !(e.def && e.def.alwaysFly);
    const t = age * g.speed + (e ? (e.id || 0) : 0);
    const flap = grounded ? 0.15 : (g.glide && Math.sin(age * 0.05) > 0.5 ? 0.12 : 1) * g.flap;
    const a = Math.sin(t) * flap;
    const bob = grounded ? 0 : Math.cos(t) * 0.8;
    o.body = [grounded ? 0 : headPitch * 0.2, 0, 0, 0, bob, 0];
    o.head = [headPitch * 0.6, headYaw * 0.7, 0, 0, bob, 0];
    o.rwing = [0, 0, -0.15 + a, 0, bob, 0]; o.lwing = [0, 0, 0.15 - a, 0, bob, 0];
    o.rhind = [0, 0, -0.1 + a * 0.8, 0, bob, 0]; o.lhind = [0, 0, 0.1 - a * 0.8, 0, bob, 0];
    o.rleg = [grounded ? q(limb, 0, amt) : 0.6, 0, 0, 0, bob, 0]; o.lleg = [grounded ? q(limb, Math.PI, amt) : 0.6, 0, 0, 0, bob, 0];
    if (g.tail) chain(o, [0, md.parts.tail0.pivot[1] + bob, md.parts.tail0.pivot[2]], g.tail.map((len, i) => ({ n: 'tail' + i, p: md.parts['tail' + i].pivot, v: [0, 0, len] })), [[0.1 + Math.sin(age * 0.2) * 0.1, Math.sin(age * 0.13) * 0.2, 0], [0.05, Math.sin(age * 0.13 + 1) * 0.2, 0]]);
    return o;
  };
  AN.os_fish = ({ name, e, o, age, amt }) => {
    const md = D[e && e.def && e.def.model || name] || D[name], g = md.os;
    const sp = 0.25 + (amt || 0) * 0.3, flop = e && !e.inWater && !(e.def && e.def.fly && !e.def.water) ? 1 : 0;
    o.body = [0, Math.sin(age * sp) * 0.08, flop ? Math.PI / 2 : 0];
    o.tail = [0, Math.sin(age * sp * 2) * 0.5, flop ? Math.PI / 2 : 0];
    o.rfin = g.ray ? [0, 0, -Math.sin(age * 0.15) * 0.5] : [0, 0.3 + Math.sin(age * 0.3) * 0.3, 0];
    o.lfin = g.ray ? [0, 0, Math.sin(age * 0.15) * 0.5] : [0, -0.3 - Math.sin(age * 0.3) * 0.3, 0];
    o.head = [0, Math.sin(age * sp) * 0.08, 0];
    if (g.tentacles) for (let i = 0; i < g.tentacles[0]; i++) { const a = (i / g.tentacles[0]) * Math.PI * 2; const s = Math.sin(age * 0.15 + i) * 0.35 + 0.2; o['tn' + i] = [Math.sin(a) * s, 0, -Math.cos(a) * s]; }
    if (g.jelly) { const pulse = Math.sin(age * 0.12); o.body[4] = pulse * 0.8; }
    return o;
  };
  AN.os_serpent = ({ name, e, o, limb, amt, headYaw, headPitch, age, swing }) => {
    const md = D[e && e.def && e.def.model || name] || D[name], g = md.os;
    const ph = age * 0.25 + limb * 0.4;
    const bite = Math.max(swing || 0, e.attackAnim > 0 ? e.attackAnim / 10 : 0);
    if (g.upright) {
      // a worm rising out of the ground, swaying
      const segs = []; for (let i = 0; i < g.n; i++) segs.push({ n: 's' + i, p: md.parts['s' + i].pivot, v: [0, 0, g.sl] });
      // +z turned by +90 degrees about x points up (y is down in model space)
      const end = chain(o, [0, 24, 0], segs, segs.map((s, i) => [i === 0 ? Math.PI / 2 : Math.sin(ph + i) * 0.12, Math.cos(ph * 0.7 + i) * 0.1, 0]));
      o.head = [-Math.PI / 2 + 0.3 + headPitch * 0.3, headYaw * 0.4, 0, end[0] - md.parts.head.pivot[0], end[1] - md.parts.head.pivot[1], end[2] - md.parts.head.pivot[2]];
      o.jaw = [o.head[0] + bite * 0.8 + 0.1, o.head[1], 0, o.head[3], o.head[4], o.head[5]];
      return o;
    }
    o.head = [headPitch * 0.5, headYaw * 0.6 + Math.sin(ph) * 0.2, 0];
    o.jaw = [o.head[0] + 0.1 + bite * 0.8, o.head[1], 0];
    const segs = []; for (let i = 0; i < g.n; i++) segs.push({ n: 's' + i, p: md.parts['s' + i].pivot, v: [0, 0, g.sl] });
    chain(o, md.parts.s0.pivot, segs, segs.map((s, i) => [0, Math.sin(ph - i * 0.9) * g.wave * (i === 0 ? 0.5 : 1), 0]));
    return o;
  };
  AN.os_humanoid = ({ name, e, o, limb, amt, headYaw, headPitch, age, swing }) => {
    const md = D[e && e.def && e.def.model || name] || D[name], g = md.os;
    const k = g.heavy ? 0.4 : 0.6662;
    const w = Math.cos(limb * k) * 1.2 * amt;
    const fl = g.float ? Math.sin(age * 0.08) * 1.5 : 0;
    o.head = [headPitch, headYaw, 0, 0, fl, 0]; o.body = [0, 0, 0, 0, fl, 0];
    o.rleg = g.float ? [0.2, 0, 0, 0, fl, 0] : [w, 0, 0]; o.lleg = g.float ? [0.2, 0, 0, 0, fl, 0] : [-w, 0, 0];
    let ra = -w * 0.7, la = w * 0.7;
    if (swing > 0) { const s = Math.sin(swing * Math.PI); ra -= s * 1.8; la -= s * (g.heavy ? 1.8 : 0.4); }
    if (e.aiming > 0) { ra = -1.5; la = -1.5; }
    o.rarm = [ra, 0, 0.08, 0, fl, 0]; o.larm = [la, 0, -0.08, 0, fl, 0];
    for (const pn in md.parts) if (md.parts[pn].follow && o[md.parts[pn].follow]) o[pn] = o[md.parts[pn].follow];
    return o;
  };

  /* ------------------------------------------------------------ */
  /* Behaviour                                                    */
  /* ------------------------------------------------------------ */
  function players(w) { const out = []; for (const e of w.entities) if (e.isPlayer && !e.removed && e.health > 0 && !e.creative && !e.isProxy) out.push(e); return out; }
  function nearestPlayer(m, range) {
    if (m.world.difficulty === 0) return null;
    let best = null, bd = range * range;
    for (const p of players(m.world)) { const d = m.dist2(p.x, p.y, p.z); if (d < bd && m.canSee(p)) { bd = d; best = p; } }
    return best;
  }
  const hostileFind = (range) => (m) => (m.tamed ? ownerTarget(m) : nearestPlayer(m, range));
  function ownerTarget(m) { const o = m.owner; if (!o) return null; const t = o.lastAttacked; return t && !t.removed && t.health > 0 && t !== m ? t : null; }
  OSM.nearestPlayer = nearestPlayer; OSM.hostileFind = hostileFind; OSM.players = players;
  // damage scaled from OreSpawn (where everyone wears enchanted armour) to DreamLand
  const hurt = (m, t, dmg) => (t && t.health > 0 ? t.damage('mob', dmg, m) : false);
  OSM.hurt = hurt;
  function meleeFn(dmg, reach, cd, after) {
    return (m, t, d, see) => {
      if (m.attackTime > 0) return;
      if (d < (reach || 1.6) + m.w * 0.5 && see && Math.abs(t.y - m.y) < m.h + 1) {
        m.attackTime = cd || 20; m.attackAnim = 10; m.swing && m.swing();
        if (hurt(m, t, dmg) && after) after(m, t);
      }
    };
  }
  OSM.meleeFn = meleeFn;
  // attackAnim counts down every tick for every OreSpawn creature
  const mtick = E.Mob.prototype.tick;
  E.Mob.prototype.tick = function () {
    if (this.attackAnim > 0) this.attackAnim--;
    if (this.roar > 0) this.roar--;
    if (this.grazing > 0) this.grazing--;
    return mtick.apply(this, arguments);
  };
  // swimmers: wander under water, flop on land
  const swimAI = (m) => {
    if (m.inWater) { AI.flyingAI(m); return; }
    m.moveForward = 0;
  };
  const swimTick = (m) => {
    if (!m.inWater) { m.vy -= 0.04; if (m.onGround && rnd() < 0.1) { m.vy = 0.35; m.vx += (rnd() - 0.5) * 0.25; m.vz += (rnd() - 0.5) * 0.25; } if (m.age % 20 === 0 && !m.def.amphibious) m.damage('drown', 1); }
  };
  const SWIM = { fly: true, water: true, flySpeed: 0.02, drag: 0.9, ai: swimAI, tick: swimTick, init: (m) => { m.waterBreather = true; } };
  const FLY = { fly: true, ai: (m) => AI.flyingAI(m) };
  // hop instead of walking (frogs, jumpy bugs)
  const hopper = (power) => (m) => { m.aiTick(); if (m.onGround && (m.path || m.target) && m.age % 12 === 0) { m.vy = power; const a = m.yaw; m.vx -= Math.sin(a) * power * 0.6; m.vz -= Math.cos(a) * power * 0.6; } };
  OSM.SWIM = SWIM; OSM.FLY = FLY;

  /* ------------------------------------------------------------ */
  /* Registry                                                     */
  /* ------------------------------------------------------------ */
  const EGG_BASE = 900;
  let eggN = 0;
  const add = (name, o, egg) => {
    MOBS[name] = Object.assign({ w: 0.6, h: 0.8, hp: 10, speed: 0.7, hostile: false, sound: null, model: name, orespawn: true }, o);
    // the renderer would look for a skin named after the model: each creature wears its own
    if (!MOBS[name].skin && !MOBS[name].skinFor && MOBS[name].model !== name) MOBS[name].skin = name;
    OSM.list.push(name);
    if (egg && DL.Creative && DL.Creative.addEgg) { DL.Creative.addEgg(name, egg[0], egg[1], EGG_BASE + eggN++); const d = I.byName[name + '_spawn_egg']; if (d) d.tab = 'orespawn'; }
    return MOBS[name];
  };
  OSM.add = add;
  const drops = (...list) => list.map(([n, max, ch]) => [typeof n === 'number' ? n : id(n), max || 1, ch]);
  OSM.drops = drops;

  /* ============================================================ */
  /* Ants: the doors to OreSpawn's worlds                         */
  /* ============================================================ */
  fam.bug('os_ant', { legH: 1.5, thorax: [2, 1.5, 2], abdomen: [2.5, 2, 3], head: [2, 2, 2], legLen: 2, antennae: 2, mandibles: 1, shadow: 0.1 });
  const ANTS = [
    ['brown_ant', '#4a2a14', '#7a4a24', 'Utopia', 5], ['red_ant', '#a01810', '#e03020', 'the Mining Dimension', 6], ['rainbow_ant', null, null, 'Village Mania', 7],
    ['unstable_ant', '#40a0a0', '#a0ffff', 'the Islands', 8], ['termite', '#d8c8a0', '#f0e4c0', 'the Crystal Dimension', 9]
  ];
  for (const [n, c1, c2, place, dim] of ANTS) {
    const rainbow = c1 === null;
    SP[n] = () => paint('os_ant', 1000 + dim, { _: [c1 || '#6040c0', 0.1] }, (s) => {
      if (rainbow) { const R = ['#ff3030', '#ff9a20', '#ffe030', '#40d040', '#3070ff', '#a040e0']; pattern(s, [['thorax', [0]], ['abdomen', [0]], ['head', [0]]], 'all', (x, y) => hex(R[(x + y) % 6])); }
      else pattern(s, [['abdomen', [0]]], 'top,left,right', (x, y) => (y % 2 ? hex(c2) : null));
      if (n === 'unstable_ant') pattern(s, [['abdomen', [0]]], 'all', (x, y) => ((x + y) % 3 === 0 ? hex('#ffffff') : null));
    });
    add(n, {
      w: 0.25, h: 0.2, hp: n === 'red_ant' ? 3 : 1, speed: 0.6, model: 'os_ant', skin: n, scale: n === 'termite' ? 1.4 : 1, ant: { place, dim },
      hostile: n === 'red_ant', attack: 1, findTarget: n === 'red_ant' ? hostileFind(6) : undefined, attackFn: n === 'red_ant' ? meleeFn(1, 0.8, 20) : undefined,
      interact: (m, p, game) => OSM.antInteract && OSM.antInteract(m, p, game)
    }, [rainbow ? '#e040a0' : c1, rainbow ? '#40e0ff' : c2]);
  }

  /* ============================================================ */
  /* Small things that fly                                        */
  /* ============================================================ */
  fam.flyer('os_butterfly', { body: [1, 1, 5], head: [1.2, 1.2, 1.2], wing: [6, 6], hind: [4, 5], antennae: 2, cy: 18, flap: 1.1, flapSpeed: 0.9, wthick: 0.2, shadow: 0.1 });
  const BUTTERFLIES = [['#ff8020', '#202020'], ['#3080ff', '#101840'], ['#ffe040', '#402000'], ['#ff60c0', '#ffffff'], ['#80ff60', '#103010']];
  BUTTERFLIES.forEach(([c, k], i) => {
    SP['butterfly_' + i] = () => paint('os_butterfly', 1100 + i, { _: '#202020', rwing: c, lwing: c, rhind: c, lhind: c, ant: '#202020' }, (s) => {
      for (const pn of ['rwing', 'lwing', 'rhind', 'lhind']) s.fill(pn, 0, 'top,bottom', (x, y, w, h) => (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? hex(k) : ((x * 3 + y) % 7 === 0 ? hex('#ffffff') : null));
    });
  });
  const flitAI = (m) => {
    // a lazy zig-zag: drift, rise and fall, settle on flowers in the day
    if (!m.wp || rnd() < 0.02 || m.dist2(m.wp[0], m.wp[1], m.wp[2]) < 1) { const g = m.world.topSolidY(Math.floor(m.x), Math.floor(m.z)); m.wp = [m.x + (rnd() - 0.5) * 10, Math.max(g + 1, Math.min(g + 7, m.y + (rnd() - 0.5) * 4)), m.z + (rnd() - 0.5) * 10]; }
    AI.steer(m, m.wp[0], m.wp[1], m.wp[2], m.def.flySpeed || 0.01);
  };
  add('butterfly', { w: 0.4, h: 0.3, hp: 2, model: 'os_butterfly', fly: true, flySpeed: 0.012, drag: 0.85, ai: flitAI, init: (m) => { m.variant = Math.floor(rnd() * BUTTERFLIES.length); }, skinFor: (e) => 'butterfly_' + ((e.variant || 0) % BUTTERFLIES.length), interact: (m, p, game) => OSM.butterflyInteract && OSM.butterflyInteract(m, p, game) }, ['#ff8020', '#3080ff']);
  SP.moth = () => paint('os_butterfly', 1110, { _: '#4a3a28', rwing: ['#a08a68', 0.12], lwing: ['#a08a68', 0.12], rhind: ['#8a7458', 0.1], lhind: ['#8a7458', 0.1] }, (s) => {
    for (const pn of ['rwing', 'lwing']) s.fill(pn, 0, 'top', (x, y, w, h) => (Math.hypot(x - w / 2, y - h / 2) < 1.5 ? hex('#f0e0a0') : null));
  });
  add('moth', { w: 0.45, h: 0.3, hp: 2, model: 'os_butterfly', skin: 'moth', scale: 1.2, fly: true, flySpeed: 0.014, drag: 0.85, ai: flitAI, drops: drops(['moth_scale', 1, 0.15]) }, ['#a08a68', '#4a3a28']);
  fam.flyer('os_mosquito', { body: [1, 1, 3], head: [1, 1, 1], wing: [3, 2], legs: 2, cy: 20, flap: 0.5, flapSpeed: 2.5, wthick: 0.1, shadow: 0, headExtra: [[-0.2, 0, -3, 0.4, 0.4, 2]] });
  SP.mosquito = () => paint('os_mosquito', 1120, { _: '#3a3020', rwing: '#d0e0f0', lwing: '#d0e0f0', 'head:1': '#202020' });
  add('mosquito', { w: 0.2, h: 0.2, hp: 1, hostile: true, fly: true, flySpeed: 0.02, keep: 0, attack: 1, ai: (m) => AI.flyingAI(m), findTarget: hostileFind(12), attackFn: meleeFn(1, 0.6, 40), sound: 'bat' }, ['#3a3020', '#d0e0f0']);
  fam.flyer('os_dragonfly', { body: [1.5, 1.5, 4], head: [2, 2, 2], wing: [2, 7], hind: [2, 6], tail: [5, 4], tw: 1, cy: 18, flap: 0.6, flapSpeed: 2.2, wthick: 0.2, shadow: 0.1, wingZ: 0.5 });
  SP.dragonfly = () => paint('os_dragonfly', 1130, { _: ['#2a9a8a', 0.15], rwing: '#c8f0ff', lwing: '#c8f0ff', rhind: '#c8f0ff', lhind: '#c8f0ff', tail0: '#3a6ad8', tail1: '#3a6ad8' }, (s) => eyesOn(s, 'head', 0, ['GG', 'GG'], EY()));
  add('dragonfly', { w: 0.6, h: 0.3, hp: 4, model: 'os_dragonfly', scale: 1.5, fly: true, flySpeed: 0.03, drag: 0.82, ai: flitAI }, ['#2a9a8a', '#3a6ad8']);
  // fireflies in OreSpawn glow; DreamLand already has its own, these are bigger
  SP.os_firefly = () => paint('os_mosquito', 1140, { _: '#2a2a1a', rwing: '#e0e0c0', lwing: '#e0e0c0', 'head:1': '#ffff60' }, (s) => s.fill('body', 0, 'bottom,back', () => hex('#f0ff60')));
  add('os_firefly', { w: 0.3, h: 0.3, hp: 1, model: 'os_mosquito', skin: 'os_firefly', scale: 1.5, fly: true, flySpeed: 0.008, drag: 0.85, ai: flitAI, glow: () => true }, ['#2a2a1a', '#f0ff60']);

  /* ============================================================ */
  /* Bugs on the ground                                           */
  /* ============================================================ */
  fam.bug('os_cricket', { legH: 2, thorax: [2.5, 2, 3], abdomen: [2.5, 2.5, 4], head: [2.5, 2.5, 2], legLen: 3, antennae: 5, hop: true });
  SP.cricket = () => paint('os_cricket', 1200, { _: ['#4a5a20', 0.12], ant: '#2a2a10' }, (s) => eyesOn(s, 'head', 0, ['KK'], EY()));
  add('cricket', { w: 0.3, h: 0.3, hp: 2, model: 'os_cricket', ai: hopper(0.45), sound: 'cricket' }, ['#4a5a20', '#2a2a10']);
  fam.bug('os_stink_bug', { legH: 2, thorax: [4, 2, 3], abdomen: [6, 2.5, 5], head: [3, 2, 2], legLen: 3, antennae: 3, elytra: true });
  SP.stink_bug = () => paint('os_stink_bug', 1210, { _: ['#6a5a28', 0.1], relytra: ['#8a7a38', 0.08], lelytra: ['#8a7a38', 0.08] }, (s) => pattern(s, [['relytra', [0]], ['lelytra', [0]]], 'top', (x, y) => ((x + y) % 4 === 0 ? hex('#4a3a18') : null)));
  add('stink_bug', { w: 0.5, h: 0.4, hp: 6, model: 'os_stink_bug', drops: drops(['dead_stink_bug', 1]), onHit: (m, t) => { if (t && t.isPlayer) t.addEffect && t.addEffect('nausea', 100); }, onHurt: (m) => fx(m, 'smoke', 8, 0.6) }, ['#6a5a28', '#8a7a38']);
  fam.bug('os_jumpy_bug', { legH: 4, thorax: [5, 4, 5], abdomen: [6, 5, 7], head: [4, 4, 4], legLen: 6, antennae: 4, hop: true, elytra: true, mandibles: 2 });
  SP.jumpy_bug = () => paint('os_jumpy_bug', 1220, { _: ['#7a5a28', 0.1], relytra: '#a07a38', lelytra: '#a07a38', mand: '#2a1a08' }, (s) => eyesOn(s, 'head', 0, ['....', 'RR.RR'.slice(0, 4)], EY()));
  add('jumpy_bug', { w: 1.0, h: 0.9, hp: 40, hostile: true, speed: 0.9, model: 'os_jumpy_bug', ai: hopper(0.9), findTarget: hostileFind(20), attackFn: meleeFn(6, 1.4, 20), drops: drops(['jumpy_bug_scale', 2]), init: (m) => { m.fallImmune = true; } }, ['#7a5a28', '#a07a38']);
  fam.bug('os_spit_bug', { legH: 5, thorax: [7, 5, 7], abdomen: [8, 7, 9], head: [6, 5, 5], legLen: 8, antennae: 4, mandibles: 3 });
  SP.spit_bug = () => paint('os_spit_bug', 1230, { _: ['#3a6a28', 0.1], abdomen: ['#5a9a30', 0.1], mand: '#202010' }, (s) => { eyesOn(s, 'head', 0, ['......', '.YY.YY'], EY()); pattern(s, [['abdomen', [0]]], 'top,left,right', (x, y) => (y % 3 === 0 ? hex('#c8ff60') : null)); });
  const spitAttack = (m, t, d, see) => {
    if (m.attackTime > 0) return;
    if (see && d < 14) { m.attackTime = 40; m.attackAnim = 10; const b = OSM.shoot(m, t, 'acid', 0.9); if (b) snd(m, 'slime', 1, 0.6); }
  };
  add('spit_bug', { w: 1.6, h: 1.4, hp: 100, hostile: true, speed: 0.6, model: 'os_spit_bug', ranged: true, findTarget: hostileFind(20), attackFn: spitAttack, drops: drops(['green_goo', 2]) }, ['#3a6a28', '#c8ff60']);
  fam.bug('os_trooper_bug', { legH: 8, thorax: [10, 7, 10], abdomen: [12, 9, 14], head: [8, 7, 7], legLen: 12, antennae: 8, mandibles: 5, elytra: true });
  SP.trooper_bug = () => paint('os_trooper_bug', 1240, { _: ['#3a3a48', 0.1], relytra: ['#5a5a70', 0.06], lelytra: ['#5a5a70', 0.06], mand: '#a0a0b0' }, (s) => eyesOn(s, 'head', 0, ['........', '.RR..RR.', '.RR..RR.'], EY()));
  add('trooper_bug', { w: 2.5, h: 2.4, hp: 200, hostile: true, speed: 0.75, model: 'os_trooper_bug', findTarget: hostileFind(24), attackFn: meleeFn(12, 2.2, 25, (m, t) => { t.vy += 0.5; }), drops: drops(['jumpy_bug_scale', 3], ['green_goo', 2]) }, ['#3a3a48', '#5a5a70']);
  fam.bug('os_mantis', { legH: 9, thorax: [4, 4, 12], abdomen: [6, 5, 14], head: [5, 5, 4], legLen: 9, antennae: 6, raptorial: 10, wings: [14, 6], shadow: 0.7 });
  SP.mantis = () => paint('os_mantis', 1250, { _: ['#5ab030', 0.08], rwing: '#c8f0a0', lwing: '#c8f0a0', rclaw: '#3a8a20', lclaw: '#3a8a20' }, (s) => eyesOn(s, 'head', 0, ['.....', 'G...G', 'G...G'], EY()));
  add('mantis', { w: 1.6, h: 2.8, hp: 120, hostile: true, speed: 0.85, model: 'os_mantis', scale: 1.1, findTarget: hostileFind(24), attackFn: meleeFn(10, 2.4, 18), drops: drops(['mantis_claw', 1, 0.6]) }, ['#5ab030', '#c8f0a0']);
  fam.bug('os_beetle', { legH: 7, thorax: [12, 7, 9], abdomen: [16, 9, 16], head: [8, 6, 6], legLen: 10, elytra: true, headExtra: [[-1.5, -14, -14, 3, 3, 10], [-1, -16, -22, 2, 4, 9], [-1, -2, -12, 2, 2, 7]], shadow: 1.2 });
  SP.hercules_beetle = () => paint('os_beetle', 1260, { _: ['#2a1a10', 0.08], relytra: ['#c8b040', 0.1], lelytra: ['#c8b040', 0.1], 'head:1': '#1a1008', 'head:2': '#1a1008', 'head:3': '#1a1008' }, (s) => pattern(s, [['relytra', [0]], ['lelytra', [0]]], 'top,left,right', (x, y) => ((x * 5 + y * 3) % 11 === 0 ? hex('#2a1a10') : null)));
  add('hercules_beetle', { w: 3, h: 2.5, hp: 250, hostile: true, speed: 0.7, model: 'os_beetle', boss: 'Hercules Beetle', findTarget: hostileFind(32), attackFn: meleeFn(15, 3, 30, (m, t) => { t.vy += 0.9; const a = m.yaw; t.vx -= Math.sin(a) * 1.2; t.vz -= Math.cos(a) * 1.2; }), drops: drops(['green_goo', 4], ['diamond', 2]) }, ['#2a1a10', '#c8b040']);
  fam.bug('os_scorpion', { legH: 3, thorax: [5, 3, 5], abdomen: [5, 3, 6], head: [4, 2, 3], legLen: 5, pairs: 4, claws: [4, 2.5], stinger: [4, 4, 3, 3], shadow: 0.5 });
  SP.scorpion = () => paint('os_scorpion', 1270, { _: ['#2a2a30', 0.1], rclaw: '#3a3a44', lclaw: '#3a3a44', st3: '#c02020' }, (s) => eyesOn(s, 'head', 0, ['R..R'], EY()));
  SP.emperor_scorpion = () => paint('os_scorpion', 1271, { _: ['#1a1a28', 0.08], rclaw: '#2a2a40', lclaw: '#2a2a40', st3: '#ff3030' }, (s) => { eyesOn(s, 'head', 0, ['RR..RR'.slice(0, 4)], EY()); pattern(s, [['thorax', [0]], ['abdomen', [0]]], 'top', (x, y) => (y % 2 ? hex('#4040a0') : null)); });
  const stingAfter = (m, t) => { t.poisoned = Math.max(t.poisoned || 0, 100); if (t.addEffect) t.addEffect('poison', 100); };
  add('scorpion', { w: 0.9, h: 0.6, hp: 15, hostile: true, speed: 0.8, model: 'os_scorpion', findTarget: hostileFind(16), attackFn: meleeFn(3, 1.2, 20, stingAfter) }, ['#2a2a30', '#c02020']);
  add('emperor_scorpion', { w: 3.5, h: 2.5, hp: 350, hostile: true, speed: 0.75, model: 'os_scorpion', skin: 'emperor_scorpion', scale: 4, boss: 'Emperor Scorpion', findTarget: hostileFind(32), attackFn: meleeFn(17, 3.5, 22, stingAfter), drops: drops(['emperor_scorpion_scale', 3]) }, ['#1a1a28', '#4040a0']);
  fam.bug('os_cave_fisher', { legH: 4, thorax: [6, 4, 6], abdomen: [7, 6, 8], head: [5, 4, 4], legLen: 9, pairs: 4, mandibles: 3, shadow: 0.6 });
  SP.cave_fisher = () => paint('os_cave_fisher', 1280, { _: ['#4a3a50', 0.1], mand: '#c0b0a0' }, (s) => eyesOn(s, 'head', 0, ['.....', 'W.W.W'], EY()));
  add('cave_fisher', { w: 1.4, h: 0.8, hp: 10, hostile: true, speed: 0.8, model: 'os_cave_fisher', findTarget: hostileFind(16), attackFn: meleeFn(4, 1.4, 20, (m, t) => { t.vy += 0.3; }), drops: drops([287, 3]) }, ['#4a3a50', '#c0b0a0']);
  fam.bug('os_crab', { legH: 6, thorax: [12, 6, 10], abdomen: [10, 4, 4], head: [6, 3, 2], legLen: 8, pairs: 4, claws: [6, 4], shadow: 1.0, headExtra: [[-3, -4, -2, 1, 3, 1], [2, -4, -2, 1, 3, 1]] });
  SP.crab = () => paint('os_crab', 1290, { _: ['#d84020', 0.08], rclaw: '#e85030', lclaw: '#e85030', belly: '#f0d0b0' }, (s) => { s.fill('head', 1, 'all', () => hex('#101010')); s.fill('head', 2, 'all', () => hex('#101010')); });
  add('crab', { w: 1.6, h: 1.3, hp: 30, neutral: true, speed: 0.6, model: 'os_crab', findTarget: undefined, attackFn: meleeFn(5, 1.6, 20), drops: drops(['raw_crab_meat', 3]), init: (m) => { m.waterBreather = true; } }, ['#d84020', '#f0d0b0']);
  add('giant_crab', { w: 3.2, h: 2.6, hp: 180, hostile: true, speed: 0.55, model: 'os_crab', skin: 'crab', scale: 2.2, findTarget: hostileFind(24), attackFn: meleeFn(12, 3, 24), drops: drops(['raw_crab_meat', 8]), init: (m) => { m.waterBreather = true; } }, ['#a02010', '#f0d0b0']);
  fam.bug('os_bee', { legH: 6, thorax: [8, 7, 8], abdomen: [10, 10, 12], head: [7, 7, 6], legLen: 7, antennae: 6, wings: [14, 12], stinger: [3], shadow: 0.6 });
  SP.bee = () => paint('os_bee', 1300, { _: ['#f0c020', 0.06], head: '#2a2010', rwing: '#e0f0ff', lwing: '#e0f0ff', st0: '#2a2010' }, (s) => { pattern(s, [['abdomen', [0]]], 'top,left,right,bottom,back', (x, y, w) => ((x + 0) % 4 < 2 ? hex('#1a1408') : null)); eyesOn(s, 'head', 0, ['.......', 'KK...KK', 'KK...KK'], EY()); });
  add('bee', { w: 1.6, h: 1.6, hp: 80, neutral: true, speed: 0.8, model: 'os_bee', scale: 1.7, fly: true, flySpeed: 0.03, keep: 1.5, ai: (m) => AI.flyingAI(m), attackFn: meleeFn(6, 1.8, 30, stingAfter), drops: drops([288, 3]), sound: 'bee' }, ['#f0c020', '#1a1408']);
  fam.bug('os_brutalfly', { legH: 5, thorax: [10, 8, 10], abdomen: [10, 9, 14], head: [10, 8, 7], legLen: 8, wings: [28, 14], shadow: 1.2 });
  SP.brutalfly = () => paint('os_brutalfly', 1310, { _: ['#2a3a2a', 0.08], rwing: ['#a0b0a0', 0.05], lwing: ['#a0b0a0', 0.05] }, (s) => eyesOn(s, 'head', 0, ['..........', 'RRRR..RRRR', 'RRRR..RRRR', 'RRRR..RRRR'], EY()));
  add('brutalfly', { w: 4, h: 2, hp: 110, hostile: true, speed: 0.8, model: 'os_brutalfly', scale: 2.2, fly: true, flySpeed: 0.035, keep: 2, ai: (m) => AI.flyingAI(m), findTarget: hostileFind(32), attackFn: meleeFn(8, 3, 25), drops: drops(['green_goo', 2]), sound: 'bee', minY: 60, maxY: 120 }, ['#2a3a2a', '#a0b0a0']);

  /* ============================================================ */
  /* Dinosaurs and other big reptiles                             */
  /* ============================================================ */
  fam.theropod('os_trex', { leg: 14, L: 18, H: 11, W: 10, head: [9, 9, 12], neck: 3, tw: 6, tl: [10, 9, 8], arm: 4, teeth: true, shadow: 1.2 });
  SP.trex = () => paint('os_trex', 1400, { _: ['#5a7a3a', 0.1], jaw: '#4a6a30', belly: '#c8c090' }, (s) => { eyesOn(s, 'head', 1, ['.........', '.Y.....Y.'], EY()); s.fill('jaw', 1, 'all', () => hex('#f4f0e0')); pattern(s, [['body', [0]]], 'top,left,right', (x, y) => ((x * 3 + y * 7) % 13 === 0 ? hex('#3a5a28') : null)); });
  const roarAt = (m) => { m.roar = 30; snd(m, 'roar', 2, 0.7); };
  add('trex', { w: 2, h: 4.2, hp: 160, hostile: true, speed: 0.95, model: 'os_trex', scale: 1.4, findTarget: hostileFind(32), attackFn: meleeFn(16, 2.8, 25, (m, t) => { t.vy += 0.4; }), drops: drops(['trex_tooth', 1, 0.5], [B.bone_block || 352, 4]), onHurt: (m) => { if (rnd() < 0.2) roarAt(m); } }, ['#5a7a3a', '#c8c090']);
  fam.theropod('os_alosaurus', { leg: 13, L: 17, H: 9, W: 8, head: [7, 7, 11], neck: 3, tw: 5, tl: [10, 9, 8], arm: 6, teeth: true, headExtra: [[-1, -9, -10, 2, 2, 6]], shadow: 1 });
  SP.alosaurus = () => paint('os_alosaurus', 1410, { _: ['#a06a30', 0.1], belly: '#e0c890' }, (s) => { eyesOn(s, 'head', 1, ['.......', 'R.....R'], EY()); pattern(s, [['body', [0]], ['tail0', [0]], ['tail1', [0]]], 'top,left,right', (x, y) => (x % 4 === 0 ? hex('#6a4018') : null)); });
  add('alosaurus', { w: 1.9, h: 3.6, hp: 110, hostile: true, speed: 0.95, model: 'os_alosaurus', scale: 1.3, findTarget: hostileFind(28), attackFn: meleeFn(10, 2.4, 22), drops: drops([352, 4], ['porkchop_raw', 3]) }, ['#a06a30', '#e0c890']);
  fam.theropod('os_raptor', { leg: 9, L: 11, H: 6, W: 5, head: [4, 4, 7], neck: 4, tw: 3, tl: [7, 7, 6], arm: 5, teeth: true, bodyExtra: [[-0.5, -8, -4, 1, 3, 8]] });
  SP.velocity_raptor = () => paint('os_raptor', 1420, { _: ['#8a6a48', 0.12], belly: '#e8d8b8', 'body:1': '#c04020' }, (s) => { eyesOn(s, 'head', 1, ['....', 'Y..Y'], EY()); pattern(s, [['body', [0]]], 'top,left,right', (x, y) => ((x + y) % 3 === 0 ? hex('#5a3a28') : null)); });
  add('velocity_raptor', { w: 0.6, h: 1.2, hp: 20, hostile: true, speed: 1.35, model: 'os_raptor', findTarget: hostileFind(28), attackFn: meleeFn(4, 1.2, 12), drops: drops(['porkchop_raw', 2], [288, 2]) }, ['#8a6a48', '#c04020']);
  SP.cryolophosaurus = () => paint('os_raptor', 1430, { _: ['#4a6aa0', 0.1], belly: '#d0d8f0', 'body:1': '#ffe040' }, (s) => eyesOn(s, 'head', 1, ['....', 'R..R'], EY()));
  add('cryolophosaurus', { w: 0.75, h: 0.75, hp: 10, hostile: true, speed: 1.1, model: 'os_raptor', skin: 'cryolophosaurus', scale: 0.8, findTarget: hostileFind(20), attackFn: meleeFn(3, 1, 15) }, ['#4a6aa0', '#ffe040']);
  fam.theropod('os_baryonyx', { leg: 12, L: 16, H: 8, W: 7, head: [5, 5, 14], neck: 4, tw: 5, tl: [10, 9, 7], arm: 8, teeth: true, bodyExtra: [[-0.5, -12, -6, 1, 5, 12]], shadow: 0.9 });
  SP.baryonyx = () => paint('os_baryonyx', 1440, { _: ['#3a7a6a', 0.1], belly: '#d8e0c0', 'body:1': '#c06030' }, (s) => eyesOn(s, 'head', 1, ['.....', 'Y...Y'], EY()));
  add('baryonyx', { w: 1.5, h: 2.8, hp: 60, neutral: true, speed: 0.9, model: 'os_baryonyx', scale: 1.2, attackFn: meleeFn(8, 2, 20), drops: drops([349, 4], [352, 2]), interact: (m, p) => OSM.tame && OSM.tame(m, p, [349, 350]) }, ['#3a7a6a', '#c06030']);
  fam.theropod('os_nastysaurus', { leg: 15, L: 20, H: 12, W: 11, head: [9, 8, 12], neck: 4, tw: 6, tl: [11, 10, 9], arm: 6, teeth: true, shadow: 1.4,
    bodyExtra: [[-1, -14, -8, 2, 4, 3], [-1, -15, -3, 2, 5, 3], [-1, -14, 2, 2, 4, 3], [-6.5, -8, -6, 2, 2, 2], [4.5, -8, -6, 2, 2, 2]], headExtra: [[-4, -12, -6, 2, 4, 2], [2, -12, -6, 2, 4, 2]], tailExtra: [[[-1, -5, 2, 2, 3, 2], [-1, -5, 6, 2, 3, 2]]] });
  SP.nastysaurus = () => paint('os_nastysaurus', 1450, { _: ['#4a2a4a', 0.1], belly: '#a080a0', 'body:1': '#e0d0c0', 'body:2': '#e0d0c0', 'body:3': '#e0d0c0', 'head:2': '#e0d0c0', 'head:3': '#e0d0c0' }, (s) => eyesOn(s, 'head', 1, ['.........', '.RR...RR.'], EY()));
  add('nastysaurus', { w: 2.2, h: 4.6, hp: 200, hostile: true, speed: 1.0, model: 'os_nastysaurus', scale: 1.5, boss: 'Nastysaurus', findTarget: hostileFind(36), attackFn: meleeFn(18, 3.2, 22, (m, t) => { t.vy += 0.6; }), drops: drops([352, 6], ['diamond', 2]), onHurt: (m) => { if (rnd() < 0.15) roarAt(m); } }, ['#4a2a4a', '#e0d0c0']);
  fam.quad('os_pointysaurus', { leg: 6, L: 22, H: 9, W: 14, head: [7, 6, 6], lw: 4, tl: [8, 6], tw: 4, shadow: 1.2,
    bodyExtra: [[-6, -12, -9, 2, 3, 2], [4, -12, -9, 2, 3, 2], [-6, -12, -2, 2, 3, 2], [4, -12, -2, 2, 3, 2], [-6, -12, 5, 2, 3, 2], [4, -12, 5, 2, 3, 2], [-9, -6, -6, 2, 2, 2], [7, -6, -6, 2, 2, 2], [-9, -6, 3, 2, 2, 2], [7, -6, 3, 2, 2, 2]],
    tailExtra: [null, [[-3, -2, 5, 6, 4, 4]]] });
  SP.pointysaurus = () => paint('os_pointysaurus', 1460, { _: ['#8a7a4a', 0.1], 'tail1:1': '#5a4a2a' }, (s) => { for (let k = 1; k <= 10; k++) s.fill('body', k, 'all', () => hex('#e8e0c8')); eyesOn(s, 'head', 0, ['......', 'K....K'], EY()); });
  add('pointysaurus', { w: 2.9, h: 2.9, hp: 80, neutral: true, speed: 0.5, model: 'os_pointysaurus', scale: 1.3, attackFn: meleeFn(10, 3, 25, (m, t) => { t.vy += 0.5; }), drops: drops([334, 4]), init: (m) => { m.armorPoints = 16; } }, ['#8a7a4a', '#e8e0c8']);
  fam.quad('os_camarasaurus', { leg: 12, L: 20, H: 10, W: 10, head: [4, 4, 6], lw: 4, neck: 16, nw: 3, neckUp: 0.9, tl: [10, 9, 8], tw: 3, shadow: 1.3 });
  SP.camarasaurus = () => paint('os_camarasaurus', 1470, { _: ['#7a8a5a', 0.08], belly: '#d8d8b0' }, (s) => { eyesOn(s, 'head', 0, ['....', 'K..K'], EY()); pattern(s, [['body', [0]], ['neck', [0]]], 'top', (x, y) => ((x + y * 2) % 5 === 0 ? hex('#5a6a3a') : null)); });
  add('camarasaurus', { w: 2.2, h: 3.4, hp: 60, speed: 0.6, model: 'os_camarasaurus', scale: 1.4, drops: drops(['porkchop_raw', 6], [334, 3]), interact: (m, p, g) => (p.held ? OSM.tame(m, p, [B.leaves, 296, 260]) : m.tamed && OSM.ride(m, p, g)), rideable: true, rideSpeed: 0.22, seatY: 3.3, ai: (m) => OSM.rideAI()(m) }, ['#7a8a5a', '#d8d8b0']);
  fam.quad('os_lizard', { leg: 3, L: 12, H: 4, W: 6, head: [4, 3, 5], lw: 2, tl: [6, 6, 5], tw: 2.5, shadow: 0.4 });
  SP.lizard = () => paint('os_lizard', 1480, { _: ['#6a9a30', 0.12], belly: '#e0e8a0' }, (s) => pattern(s, [['body', [0]]], 'top', (x, y) => ((x + y) % 3 === 0 ? hex('#3a6a18') : null)));
  add('lizard', { w: 1.0, h: 0.5, hp: 12, speed: 0.9, model: 'os_lizard', scale: 1.3, drops: drops([334, 1]) }, ['#6a9a30', '#e0e8a0']);
  fam.serpent('os_basilisk', { segments: 9, sw: 8, sl: 8, head: [12, 8, 14], cy: 20, taper: 0.6, headExtra: [[-6, -9, -8, 2, 6, 2], [4, -9, -8, 2, 6, 2], [-1, -10, -6, 2, 6, 2]], shadow: 1.5 });
  SP.basilisk = () => paint('os_basilisk', 1490, { _: ['#2a6a28', 0.1], jaw: '#c0d080', 'head:1': '#e0d040', 'head:2': '#e0d040', 'head:3': '#e04040' }, (s) => { eyesOn(s, 'head', 0, ['............', '.YY......YY.', '.YK......KY.'], EY()); for (let i = 0; i < 9; i++) s.fill('s' + i, 0, 'top', (x, y) => ((x + y) % 4 === 0 ? hex('#4a9a30') : null)); });
  add('basilisk', { w: 2.5, h: 2.2, hp: 200, hostile: true, speed: 0.9, model: 'os_basilisk', scale: 1.6, boss: 'Basilisk', findTarget: hostileFind(40), attackFn: meleeFn(14, 3.5, 20, (m, t) => { if (rnd() < 0.3 && t.addEffect) t.addEffect('slowness', 100); }), drops: drops(['basilisk_scale', 3]) }, ['#2a6a28', '#e0d040']);

  /* ============================================================ */
  /* Mammals and birds                                            */
  /* ============================================================ */
  fam.quad('os_gazelle', { leg: 12, L: 12, H: 7, W: 6, head: [4, 5, 6], lw: 2, neck: 6, nw: 3, neckUp: 0.9, tl: [3], tw: 2, headExtra: [[-2, -8, -2, 1, 6, 1], [1, -8, -2, 1, 6, 1]] });
  SP.gazelle = () => paint('os_gazelle', 1500, { _: ['#c89050', 0.08], belly: '#f4e8d8', 'head:1': '#3a2a1a', 'head:2': '#3a2a1a' }, (s) => { eyesOn(s, 'head', 0, ['....', 'K..K'], EY()); pattern(s, [['body', [0]]], 'left,right', (x, y, w, h) => (y === h - 3 ? hex('#3a2a1a') : null)); });
  add('gazelle', { w: 0.7, h: 1.8, hp: 20, speed: 1.3, model: 'os_gazelle', drops: drops(['porkchop_raw', 2], [334, 1]), skittish: true }, ['#c89050', '#f4e8d8']);
  fam.theropod('os_ostrich', { leg: 14, L: 9, H: 7, W: 7, head: [3, 3, 4], neck: 8, tw: 3, tl: [3], arm: 3, shadow: 0.6 });
  SP.ostrich = () => paint('os_ostrich', 1510, { _: ['#2a2420', 0.1], head: '#d8b0a0', rleg: '#d8b0a0', lleg: '#d8b0a0', tail0: '#f4f0ec' }, (s) => eyesOn(s, 'head', 1, ['...', 'K.K'], EY()));
  add('ostrich', { w: 0.85, h: 2.1, hp: 25, speed: 1.4, model: 'os_ostrich', drops: drops([288, 4], ['raw_peacock', 2]), interact: (m, p, g) => OSM.ride(m, p, g), rideable: true, rideSpeed: 0.32, seatY: 1.5, skittish: true, ai: (m) => OSM.rideAI()(m) }, ['#2a2420', '#d8b0a0']);
  SP.cassowary = () => paint('os_ostrich', 1520, { _: ['#141418', 0.1], head: '#2a7ad8', rleg: '#5a5a40', lleg: '#5a5a40', jaw: '#e03030' }, (s) => eyesOn(s, 'head', 1, ['...', 'Y.Y'], EY()));
  add('cassowary', { w: 0.6, h: 1.4, hp: 30, neutral: true, speed: 1.1, model: 'os_ostrich', skin: 'cassowary', scale: 0.75, attackFn: meleeFn(6, 1.4, 20), drops: drops([288, 3]) }, ['#141418', '#2a7ad8']);
  fam.theropod('os_peacock', { leg: 8, L: 8, H: 6, W: 6, head: [3, 3, 3], neck: 5, tw: 2, tl: [2], arm: 2, headExtra: [[-0.5, -8, -5, 1, 4, 1]],
    tailExtra: [[[-8, -12, 0, 16, 14, 1]]] });
  SP.peacock = () => paint('os_peacock', 1530, { _: ['#2050c0', 0.1], 'tail0:1': '#2a8a40', rleg: '#8a8a7a', lleg: '#8a8a7a' }, (s) => { s.fill('tail0', 1, 'back,front', (x, y, w, h) => { const d = (Math.hypot((x - w / 2) % 4 - 2, (y - h) % 4 - 2)); return d < 1 ? hex('#102060') : d < 1.6 ? hex('#30c0c0') : d < 2.1 ? hex('#e0c040') : null; }); eyesOn(s, 'head', 1, ['...', 'K.K'], EY()); });
  add('peacock', { w: 0.65, h: 1.2, hp: 12, speed: 0.8, model: 'os_peacock', drops: drops(['peacock_feather', 2], ['raw_peacock', 1]) }, ['#2050c0', '#30c0c0']);
  fam.flyer('os_bird', { body: [3, 3, 5], head: [3, 3, 3], wing: [4, 6], tail: [4], tw: 2.5, legs: 2, cy: 19, flap: 0.9, flapSpeed: 1.2, headExtra: [[-0.5, 0, -4.5, 1, 1, 1.5]] });
  const BIRDS = [['#f0d040', '#ff8020'], ['#40a0f0', '#f0f0f0'], ['#f04040', '#202020'], ['#40c060', '#f0e040']];
  BIRDS.forEach(([c, k], i) => { SP['cockateil_' + i] = () => paint('os_bird', 1540 + i, { _: c, 'head:1': '#e0a040', rwing: [c, 0.12], lwing: [c, 0.12], tail0: k }, (s) => { s.fill('head', 0, 'left,right', (x, y) => (x === 1 && y === 1 ? hex('#101010') : (y === 2 ? hex('#ff7040') : null))); }); });
  add('cockateil', { w: 0.5, h: 0.5, hp: 4, model: 'os_bird', fly: true, flySpeed: 0.025, drag: 0.88, ai: flitAI, init: (m) => { m.variant = Math.floor(rnd() * BIRDS.length); }, skinFor: (e) => 'cockateil_' + ((e.variant || 0) % BIRDS.length), drops: drops([288, 1]), sound: 'chicken' }, ['#f0d040', '#40a0f0']);
  fam.quad('os_chipmunk', { leg: 2, L: 6, H: 4, W: 4, head: [4, 4, 3], lw: 1.5, tl: [2, 3, 3], tw: 2.5, headExtra: [[-2, -3, -1, 1, 1, 1], [1, -3, -1, 1, 1, 1]], shadow: 0.2 });
  SP.chipmunk = () => paint('os_chipmunk', 1550, { _: ['#a06a38', 0.1], belly: '#f0e0c8' }, (s) => { pattern(s, [['body', [0]]], 'top', (x, y, w) => (x === Math.floor(w / 2) || x === 0 || x === w - 1 ? hex('#3a2010') : null)); eyesOn(s, 'head', 0, ['....', 'K..K'], EY()); });
  add('chipmunk', { w: 0.35, h: 0.35, hp: 4, speed: 1.2, model: 'os_chipmunk', skittish: true }, ['#a06a38', '#3a2010']);
  fam.quad('os_beaver', { leg: 2, L: 9, H: 6, W: 6, head: [5, 5, 4], lw: 2, tl: [6], tw: 4, tailExtra: [[[-2.5, -0.5, 0, 5, 1, 6]]], shadow: 0.35 });
  SP.beaver = () => paint('os_beaver', 1560, { _: ['#6a4020', 0.1], tail0: '#2a2018' }, (s) => { s.art('head', 0, 'front', ['.....', 'K...K', '.....', '..W..', '..W..'], EY()); pattern(s, [['tail0', [0, 1]]], 'top,bottom', (x, y) => ((x + y) % 2 ? hex('#3a3028') : null)); });
  add('beaver', { w: 0.6, h: 0.6, hp: 10, speed: 0.7, model: 'os_beaver', drops: drops([334, 1]), tick: (m) => { if (!isGuest() && m.age % 200 === 0 && rnd() < 0.3) { const x = Math.floor(m.x - Math.sin(m.yaw)), z = Math.floor(m.z - Math.cos(m.yaw)), y = Math.floor(m.y); if (S.LOGS[m.world.getBlock(x, y, z)]) { m.world.destroyBlock(x, y, z, true); m.grazing = 20; } } } }, ['#6a4020', '#2a2018']);
  fam.quad('os_rat', { leg: 1.5, L: 6, H: 3, W: 3, head: [3, 3, 4], lw: 1, tl: [4, 4], tw: 0.8, headExtra: [[-2, -3, -1, 1.5, 1.5, 0.5], [0.5, -3, -1, 1.5, 1.5, 0.5]], shadow: 0.2 });
  SP.rat = () => paint('os_rat', 1570, { _: ['#6a6060', 0.1], tail0: '#e0a0a0', tail1: '#e0a0a0', 'head:1': '#e0a0a0', 'head:2': '#e0a0a0' }, (s) => eyesOn(s, 'head', 0, ['...', 'R.R'], EY()));
  SP.crystal_rat = () => paint('os_rat', 1571, { _: ['#a0d8ff', 0.15], tail0: '#ff90e0', tail1: '#ff90e0' }, (s) => eyesOn(s, 'head', 0, ['...', 'P.P'], EY()));
  add('rat', { w: 0.25, h: 0.5, hp: 5, hostile: true, speed: 1.0, model: 'os_rat', findTarget: hostileFind(16), attackFn: meleeFn(2, 0.8, 15), skinFor: (e) => (e.world && e.world.dim === 9 ? 'crystal_rat' : 'rat') }, ['#6a6060', '#e0a0a0']);
  fam.quad('os_frog', { leg: 2, L: 6, H: 4, W: 6, head: [6, 3, 4], lw: 2, tl: [], shadow: 0.3, headExtra: [[-3, -3, -2, 2, 1.5, 2], [1, -3, -2, 2, 1.5, 2]] });
  SP.frog = () => paint('os_frog', 1580, { _: ['#4aa040', 0.1], belly: '#e0f0a0', 'head:1': '#e0e040', 'head:2': '#e0e040' }, (s) => { s.fill('head', 1, 'front', (x) => (x === 1 ? hex('#101010') : null)); s.fill('head', 2, 'front', (x) => (x === 0 ? hex('#101010') : null)); });
  add('frog', { w: 0.6, h: 0.5, hp: 6, speed: 0.6, model: 'os_frog', ai: hopper(0.5), amphibious: true, init: (m) => { m.waterBreather = true; } }, ['#4aa040', '#e0e040']);
  fam.quad('os_bunny', { leg: 3, L: 6, H: 6, W: 5, head: [5, 5, 4], lw: 2, tl: [2], tw: 3, headExtra: [[-2, -9, -1, 1.5, 6, 1], [0.5, -9, -1, 1.5, 6, 1]], shadow: 0.3 });
  SP.easter_bunny = () => paint('os_bunny', 1590, { _: ['#f4f0f8', 0.06], tail0: '#ffffff', 'head:1': '#ffc0d8', 'head:2': '#ffc0d8' }, (s) => s.art('head', 0, 'front', ['.....', 'K...K', '..p..'], Object.assign(EY(), { p: hex('#ff80b0') })));
  add('easter_bunny', { w: 0.5, h: 0.75, hp: 10, speed: 1.1, model: 'os_bunny', ai: hopper(0.42), drops: drops([344, 3], ['butter_candy', 2]), skittish: true }, ['#f4f0f8', '#ff80b0']);
  fam.quad('os_ducky', { leg: 0.5, L: 6, H: 4, W: 5, head: [4, 4, 4], lw: 1, tl: [2], tw: 2, headExtra: [[-1.5, 0, -6, 3, 1, 2]], shadow: 0.2 });
  SP.rubber_ducky = () => paint('os_ducky', 1600, { _: ['#ffe020', 0.04], 'head:1': '#ff8020' }, (s) => eyesOn(s, 'head', 0, ['....', 'K..K'], EY()));
  add('rubber_ducky', { w: 0.4, h: 0.5, hp: 6, speed: 0.6, model: 'os_ducky', amphibious: true, sound: 'chicken', tick: (m) => { if (m.inWater) { m.vy = Math.max(m.vy, 0.02); } }, init: (m) => { m.waterBreather = true; } }, ['#ffe020', '#ff8020']);

  /* ============================================================ */
  /* Under the sea                                                */
  /* ============================================================ */
  fam.fish('os_squid', { body: [7, 9, 7], cy: 12, tail: false, tentacles: [8, 12, 3] });
  SP.attack_squid = () => paint('os_squid', 1700, { _: ['#3a2a6a', 0.12] }, (s) => s.art('body', 0, 'front', ['.......', '.......', '.......', '.......', 'WW...WW', 'WK...KW'], EY()));
  add('attack_squid', Object.assign({}, SWIM, { w: 1.0, h: 1.25, hp: 10, hostile: true, speed: 0.8, model: 'os_squid', flySpeed: 0.03, keep: 1, findTarget: hostileFind(16), attackFn: meleeFn(4, 1.4, 20, (m, t) => { if (t.addEffect) t.addEffect('blindness', 60); }), drops: drops(['ink_sac', 2]), ai: (m) => (m.inWater ? AI.flyingAI(m) : (m.launchedBy ? m.aiTick() : swimAI(m))), amphibious: true }), ['#3a2a6a', '#101010']);
  fam.fish('os_shark', { body: [8, 9, 24], cy: 14, tailLen: 10, fins: 8, dorsal: 6, bodyExtra: [[-3, 2, -14, 6, 3, 4]] });
  SP.shark = () => paint('os_shark', 1710, { _: ['#6a7a8a', 0.06], belly: '#e8eef4' }, (s) => s.art('body', 0, 'front', ['........', '........', 'K......K', '........', 'WWWWWWWW'], EY()));
  fam.fish('os_hammerhead', { body: [10, 10, 30], cy: 13, tailLen: 12, fins: 10, dorsal: 8, hammer: 20 });
  SP.hammerhead = () => paint('os_hammerhead', 1711, { _: ['#5a6a7a', 0.06], belly: '#e8eef4', head: '#4a5a6a' }, (s) => { s.fill('head', 0, 'left,right', () => hex('#101010')); });
  add('hammerhead', Object.assign({}, SWIM, { w: 3, h: 3, hp: 240, hostile: true, speed: 1, model: 'os_hammerhead', scale: 2.2, flySpeed: 0.04, keep: 2, boss: 'Hammerhead', findTarget: hostileFind(40), attackFn: meleeFn(20, 3.5, 25), drops: drops([349, 10], [352, 6]) }), ['#5a6a7a', '#e8eef4']);
  add('sea_monster', Object.assign({}, SWIM, { w: 1.4, h: 1.6, hp: 110, hostile: true, model: 'os_shark', skin: 'sea_monster', scale: 1.1, flySpeed: 0.035, keep: 1.5, findTarget: hostileFind(28), attackFn: meleeFn(10, 2, 20), drops: drops(['sea_monster_scale', 2]) }), ['#2a7a8a', '#e8eef4']);
  SP.sea_monster = () => paint('os_shark', 1712, { _: ['#2a7a6a', 0.1], belly: '#c8f0d8', dorsal: '#e04020' }, (s) => s.art('body', 0, 'front', ['........', '........', 'RR....RR', '........', 'WkWkWkWk'], Object.assign(EY(), { k: hex('#200808') })));
  fam.fish('os_whale', { body: [16, 14, 36], cy: 8, tailLen: 10, fins: 12, tailExtra: [[-10, -2, 8, 20, 2, 5]] });
  SP.whale = () => paint('os_whale', 1720, { _: ['#3a4a6a', 0.06], belly: '#d8e0e8' }, (s) => s.fill('body', 0, 'left,right', (x, y, w, h) => (y === Math.floor(h * 0.4) && x === w - 5 ? hex('#101010') : null)));
  add('whale', Object.assign({}, SWIM, { w: 2.5, h: 2.5, hp: 120, speed: 0.4, model: 'os_whale', scale: 1.8, flySpeed: 0.012, drops: drops([349, 12], [334, 4]) }), ['#3a4a6a', '#d8e0e8']);
  fam.fish('os_flatfish', { body: [8, 1.5, 8], cy: 23, tailLen: 3, wings: 3 });
  SP.flounder = () => paint('os_flatfish', 1730, { _: ['#8a7a5a', 0.15] }, (s) => s.fill('body', 0, 'top', (x, y) => ((x * 3 + y * 5) % 7 === 0 ? hex('#5a4a30') : (x === 2 && (y === 2 || y === 4) ? hex('#101010') : null))));
  add('flounder', Object.assign({}, SWIM, { w: 0.55, h: 0.25, hp: 6, model: 'os_flatfish', skin: 'flounder', flySpeed: 0.01, drops: drops([349, 1]) }), ['#8a7a5a', '#5a4a30']);
  SP.skate = () => paint('os_flatfish', 1731, { _: ['#4a5a7a', 0.1], tail: '#2a3a5a' }, (s) => s.fill('body', 0, 'top', (x, y) => ((x + y) % 5 === 0 ? hex('#7a8aaa') : null)));
  add('skate', Object.assign({}, SWIM, { w: 0.75, h: 0.25, hp: 8, hostile: true, model: 'os_flatfish', skin: 'skate', scale: 1.4, flySpeed: 0.025, keep: 0.5, findTarget: hostileFind(12), attackFn: meleeFn(4, 1, 25, (m, t) => { if (t.addEffect) t.addEffect('slowness', 60); }), drops: drops([287, 2]) }), ['#4a5a7a', '#7a8aaa']);
  fam.fish('os_goldfish', { body: [2, 4, 5], cy: 21, tailLen: 3, fins: 2, dorsal: 2 });
  SP.gold_fish = () => paint('os_goldfish', 1740, { _: ['#ff8a20', 0.08], tail: '#ffc060' }, (s) => s.art('body', 0, 'front', ['..', 'KK'], EY()));
  add('gold_fish', Object.assign({}, SWIM, { w: 0.5, h: 0.4, hp: 3, model: 'os_goldfish', flySpeed: 0.012, drops: drops(['sun_fish', 1]) }), ['#ff8a20', '#ffc060']);
  fam.fish('os_jelly', { body: [5, 4, 5], cy: 18, tail: false, tentacles: [6, 8, 1.6], jelly: true });
  SP.irukandji = () => paint('os_jelly', 1750, { _: ['#c8e8ff', 0.15] }, (s) => s.fill('body', 0, 'top', (x, y, w, h) => (Math.hypot(x - w / 2, y - h / 2) < 1.2 ? hex('#ff80c0') : null)));
  add('irukandji', Object.assign({}, SWIM, { w: 0.3, h: 0.3, hp: 1, hostile: true, model: 'os_jelly', scale: 0.5, flySpeed: 0.008, keep: 0, findTarget: hostileFind(6), attackFn: meleeFn(10, 0.6, 40, (m, t) => { if (t.addEffect) t.addEffect('poison', 200); }), drops: drops(['dead_irukandji', 1]), glow: () => true }), ['#c8e8ff', '#ff80c0']);

  /* ============================================================ */
  /* Up in the sky                                                */
  /* ============================================================ */
  fam.flyer('os_cliff_racer', { body: [4, 4, 12], head: [4, 3, 6], wing: [6, 14], tail: [8, 6], tw: 1.5, cy: 16, flap: 0.7, flapSpeed: 0.9, headExtra: [[-0.5, -5, -4, 1, 3, 2]], glide: true });
  SP.cliff_racer = () => paint('os_cliff_racer', 1800, { _: ['#c0806a', 0.1], rwing: ['#d8a080', 0.1], lwing: ['#d8a080', 0.1], 'head:1': '#e04020' }, (s) => eyesOn(s, 'head', 0, ['....', 'Y..Y'], EY()));
  add('cliff_racer', { w: 0.9, h: 0.6, hp: 20, hostile: true, model: 'os_cliff_racer', scale: 1.3, fly: true, flySpeed: 0.035, keep: 1.5, ai: (m) => AI.flyingAI(m), findTarget: hostileFind(28), attackFn: meleeFn(5, 1.6, 25), drops: drops([288, 3]), minY: 70, maxY: 125, sound: 'bat' }, ['#c0806a', '#e04020']);
  SP.cloud_shark = () => paint('os_shark', 1810, { _: ['#e8f0f8', 0.04], belly: '#ffffff', dorsal: '#c8d8e8' }, (s) => s.art('body', 0, 'front', ['........', '........', 'K......K', '........', 'WWWWWWWW'], EY()));
  add('cloud_shark', { w: 1.0, h: 0.75, hp: 15, hostile: true, model: 'os_shark', skin: 'cloud_shark', scale: 0.6, fly: true, flySpeed: 0.03, keep: 1, drag: 0.9, alwaysFly: true, ai: (m) => AI.flyingAI(m), findTarget: hostileFind(24), attackFn: meleeFn(6, 1.4, 20), minY: 80, maxY: 126 }, ['#e8f0f8', '#c8d8e8']);
  fam.flyer('os_leon', { body: [10, 10, 22], head: [8, 8, 12], wing: [18, 40], tail: [14, 12], tw: 4, legs: 8, cy: 6, flap: 0.55, flapSpeed: 0.35, headExtra: [[-2, -10, 0, 4, 6, 10], [-1, 3, -16, 2, 2, 6]], glide: true, shadow: 2 });
  SP.leonopteryx = () => paint('os_leon', 1820, { _: ['#7a4a2a', 0.1], rwing: ['#a06a3a', 0.08], lwing: ['#a06a3a', 0.08], 'head:1': '#e04020', 'head:2': '#e0c040' }, (s) => eyesOn(s, 'head', 0, ['........', '.YY..YY.', '.YK..KY.'], EY()));
  add('leonopteryx', { w: 3.5, h: 3, hp: 150, hostile: true, model: 'os_leon', scale: 2.2, fly: true, flySpeed: 0.04, keep: 4, hover: 3, ai: (m) => AI.flyingAI(m), boss: 'Leonopteryx', findTarget: hostileFind(48), attackFn: meleeFn(15, 4.5, 25, (m, t) => { t.vy += 1.0; }), drops: drops([288, 12], ['diamond', 2]), minY: 70, maxY: 126, sound: 'roar' }, ['#7a4a2a', '#e04020']);
  fam.flyer('os_dragon', { body: [8, 8, 16], head: [7, 6, 10], wing: [14, 24], tail: [10, 9, 8], tw: 4, legs: 6, cy: 10, flap: 0.6, flapSpeed: 0.4, headExtra: [[-3, -6, 0, 1.5, 4, 1.5], [1.5, -6, 0, 1.5, 4, 1.5]], bodyExtra: [[-0.5, -7, -6, 1, 3, 3], [-0.5, -7, 0, 1, 3, 3]], shadow: 1.2 });
  SP.dragon = () => paint('os_dragon', 1830, { _: ['#a02020', 0.1], rwing: ['#c04030', 0.08], lwing: ['#c04030', 0.08], belly: '#e0c060', 'head:1': '#e8e0c8', 'head:2': '#e8e0c8' }, (s) => eyesOn(s, 'head', 0, ['.......', '.YY.YY.', '.YK.KY.'], EY()));
  SP.water_dragon = () => paint('os_dragon', 1831, { _: ['#2060c0', 0.1], rwing: ['#40a0e0', 0.08], lwing: ['#40a0e0', 0.08], belly: '#a0e0f0' }, (s) => eyesOn(s, 'head', 0, ['.......', '.CC.CC.', '.CK.KC.'], EY()));
  SP.spyro = () => paint('os_dragon', 1832, { _: ['#8a40c0', 0.08], rwing: ['#e0c040', 0.05], lwing: ['#e0c040', 0.05], belly: '#e0c040' }, (s) => eyesOn(s, 'head', 0, ['.......', '.GG.GG.', '.GK.KG.'], EY()));
  const fireBreath = (m, t, d, see) => {
    if (m.attackTime > 0) return;
    if (see && d < 14) { m.attackTime = 30; m.attackAnim = 10; for (let k = 0; k < 3; k++) E.shoot && E.shoot(m, 'small_fireball', t, 0.8, 6); snd(m, 'blaze', 1, 0.6); }
  };
  add('dragon', { w: 1.6, h: 1.4, hp: 100, hostile: true, model: 'os_dragon', scale: 1.5, fly: true, flySpeed: 0.035, keep: 8, hover: 3, ai: (m) => AI.flyingAI(m), findTarget: hostileFind(40), attackFn: fireBreath, fireImmune: true, drops: drops([288, 6], ['diamond', 1, 0.5]), minY: 60, maxY: 125, sound: 'roar' }, ['#a02020', '#e0c060']);
  add('water_dragon', Object.assign({}, SWIM, { w: 1.25, h: 1.9, hp: 150, neutral: true, model: 'os_dragon', skin: 'water_dragon', scale: 1.2, flySpeed: 0.035, keep: 2, attackFn: meleeFn(10, 2.2, 22), drops: drops(['water_dragon_scale', 2]), amphibious: true }), ['#2060c0', '#a0e0f0']);
  add('spyro', { w: 0.5, h: 0.5, hp: 20, model: 'os_dragon', skin: 'spyro', scale: 0.45, neutral: true, attackFn: meleeFn(5, 1, 20), fireImmune: true, interact: (m, p) => OSM.tame && OSM.tame(m, p, [349, 350, 260]) }, ['#8a40c0', '#e0c040']);
  fam.flyer('os_terror', { body: [4, 4, 8], head: [4, 4, 5], wing: [6, 10], tail: [6, 5], tw: 1.5, legs: 3, cy: 18, flap: 0.8, flapSpeed: 1 });
  SP.terrible_terror = () => paint('os_terror', 1840, { _: ['#3a8a3a', 0.1], rwing: ['#e0c040', 0.1], lwing: ['#e0c040', 0.1] }, (s) => eyesOn(s, 'head', 0, ['....', 'Y..Y'], EY()));
  add('terrible_terror', { w: 1.0, h: 0.75, hp: 10, hostile: true, model: 'os_terror', fly: true, flySpeed: 0.03, keep: 1, ai: (m) => AI.flyingAI(m), findTarget: hostileFind(20), attackFn: meleeFn(4, 1.4, 20), drops: drops([288, 2]) }, ['#3a8a3a', '#e0c040']);
  fam.humanoid('os_fairy', { head: [[-2, -4, -2, 4, 4, 4]], body: [[-1.5, 0, -1, 3, 5, 2]], rarm: [[-1, -1, -0.5, 1, 4, 1]], larm: [[0, -1, -0.5, 1, 4, 1]], rleg: [[-0.5, 0, -0.5, 1, 4, 1]], lleg: [[-0.5, 0, -0.5, 1, 4, 1]], float: true,
    extra: { rwing: P([-1, 1, 1], [[-6, -4, 0, 6, 8, 0.3]], { follow: 'body' }), lwing: P([1, 1, 1], [[0, -4, 0, 6, 8, 0.3]], { follow: 'body' }) }, noCull: true });
  SP.fairy = () => paint('os_fairy', 1850, { _: ['#ffc8e8', 0.05], rwing: '#c8f0ff', lwing: '#c8f0ff', body: '#ff80c0' }, (s) => eyesOn(s, 'head', 0, ['....', 'K..K'], EY()));
  add('fairy', { w: 0.4, h: 0.8, hp: 6, model: 'os_fairy', scale: 0.6, fly: true, flySpeed: 0.02, drag: 0.85, ai: flitAI, glow: () => true, drops: drops(['love', 1, 0.3]), onHurt: (m) => fx(m, 'happy', 6, 0.4) }, ['#ffc8e8', '#c8f0ff']);
  fam.humanoid('os_ghost', { head: [[-4, -8, -4, 8, 8, 8]], body: [[-5, 0, -3, 10, 14, 6]], rarm: [[-2, -2, -1.5, 3, 9, 3]], larm: [[-1, -2, -1.5, 3, 9, 3]], rleg: null, lleg: null, float: true, noCull: true });
  SP.ghost = () => paint('os_ghost', 1860, { _: ['#f0f4ff', 0.04] }, (s) => eyesOn(s, 'head', 0, ['........', '........', '.KK..KK.', '.KK..KK.', '........', '...KK...', '...KK...'], EY()));
  add('ghost', { w: 0.5, h: 1.5, hp: 10, model: 'os_ghost', fly: true, flySpeed: 0.008, drag: 0.85, ai: flitAI, spectral: true, sound: 'ghast' }, ['#f0f4ff', '#101010']);

  /* ============================================================ */
  /* Things of the dark, the End and other worlds                 */
  /* ============================================================ */
  fam.humanoid('os_ender_knight', { head: [[-3.5, -7, -3.5, 7, 7, 7], [-4, -8, -4, 8, 2, 8]], body: [[-4, 0, -2, 8, 14, 4]], rarm: [[-2, -2, -1.5, 3, 16, 3], [-1.5, 13, -8, 1, 1, 14]], larm: [[-1, -2, -1.5, 3, 16, 3]], rleg: [[-1.5, 2, -1.5, 3, 20, 3]], lleg: [[-1.5, 2, -1.5, 3, 20, 3]] });
  SP.ender_knight = () => paint('os_ender_knight', 1900, { _: ['#1a1420', 0.06], 'head:1': '#5a4a6a', 'rarm:1': '#c8c8d8' }, (s) => eyesOn(s, 'head', 0, ['.......', '.......', '.PP.PP.'], EY()));
  SP.ender_reaper = () => paint('os_ender_knight', 1901, { _: ['#0a0810', 0.06], 'head:1': '#2a1a3a', 'rarm:1': '#e0e0f0' }, (s) => eyesOn(s, 'head', 0, ['.......', '.......', '.RR.RR.'], EY()));
  add('ender_knight', { w: 0.6, h: 2.9, hp: 60, hostile: true, speed: 0.95, model: 'os_ender_knight', findTarget: hostileFind(28), attackFn: meleeFn(8, 2, 18), drops: drops([368, 1, 0.5], ['iron_sword', 1, 0.1]), tick: (m) => { if (m.target && rnd() < 0.005) E.teleportRandom(m, 6, m.target); } }, ['#1a1420', '#e040ff']);
  add('ender_reaper', { w: 0.7, h: 2.9, hp: 90, hostile: true, speed: 1.05, model: 'os_ender_knight', skin: 'ender_reaper', scale: 1.1, findTarget: hostileFind(32), attackFn: meleeFn(12, 2.4, 18, (m, t) => { if (t.addEffect) t.addEffect('wither', 80); }), drops: drops([368, 2]), tick: (m) => { if (m.target && rnd() < 0.008) E.teleportRandom(m, 4, m.target); } }, ['#0a0810', '#ff2020']);
  fam.humanoid('os_alien', { head: [[-5, -10, -5, 10, 10, 10], [-1, -14, 0, 2, 4, 2]], body: [[-3, 0, -2, 6, 12, 4]], rarm: [[-2, -2, -1, 2, 16, 2]], larm: [[0, -2, -1, 2, 16, 2]], rleg: [[-1.5, 0, -1.5, 3, 12, 3]], lleg: [[-1.5, 0, -1.5, 3, 12, 3]] });
  SP.alien = () => paint('os_alien', 1910, { _: ['#7a8a8a', 0.06], 'head:1': '#40ff60' }, (s) => eyesOn(s, 'head', 0, ['..........', '..........', '.KKK..KKK.', '.KKK..KKK.', '..KK..KK..', '..........', '....KK....'], EY()));
  add('alien', { w: 1.1, h: 3.25, hp: 100, hostile: true, speed: 1.0, model: 'os_alien', scale: 1.1, findTarget: hostileFind(32), attackFn: meleeFn(12, 2.2, 20, (m, t) => { t.vy += 0.8; }), drops: drops(['green_goo', 3], [331, 6]), tick: (m) => { if (rnd() < 0.01) fx(m, 'happy', 3, 0.5); } }, ['#7a8a8a', '#40ff60']);
  const robot = (name, sc, body, extra) => fam.humanoid(name, Object.assign({ heavy: true, head: [[-4, -6, -4, 8, 6, 8], [-0.5, -10, -0.5, 1, 4, 1]], body: [[-6, 0, -3, 12, 12, 6]], rarm: [[-4, -2, -2.5, 4, 14, 5]], larm: [[0, -2, -2.5, 4, 14, 5]], rleg: [[-2.5, 0, -2.5, 5, 12, 5]], lleg: [[-2.5, 0, -2.5, 5, 12, 5]] }, extra || {}));
  robot('os_robot');
  const ROBOTS = [['robo_pounder', '#8a8a9a', '#ff4040', 2.0, 200], ['robo_gunner', '#5a6a5a', '#40ff40', 1.6, 120], ['robo_warrior', '#9a7a3a', '#ffa020', 1.8, 160], ['robo_sniper', '#4a4a5a', '#40c0ff', 1.3, 80]];
  ROBOTS.forEach(([n, c, eye, sc, hp]) => {
    SP[n] = () => paint('os_robot', 1920 + n.length, { _: [c, 0.04], 'head:1': eye }, (s) => {
      s.art('head', 0, 'front', ['........', '.EEEEEE.', '........', '.k.k.k..'], { E: hex(eye), k: hex('#202020') });
      pattern(s, [['body', [0]]], 'front', (x, y, w, h) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? hex('#2a2a2a') : ((x + y) % 5 === 0 ? hex('#c8c8d0') : null)));
    });
    const gun = n === 'robo_gunner' || n === 'robo_sniper';
    add(n, { w: 0.9 * sc, h: 2.6 * sc, hp, hostile: true, speed: n === 'robo_sniper' ? 0.6 : 0.75, model: 'os_robot', skin: n, scale: sc, ranged: gun, findTarget: hostileFind(gun ? 40 : 28),
      attackFn: gun ? (m, t, d, see) => { if (m.attackTime > 0 || !see) return; m.attackTime = n === 'robo_sniper' ? 60 : 20; m.aiming = 10; OSM.shoot(m, t, 'laser', n === 'robo_sniper' ? 2.4 : 1.6, n === 'robo_sniper' ? 14 : 6); snd(m, 'shoot', 1, 2); }
        : meleeFn(n === 'robo_pounder' ? 20 : 14, 2.5, 25, (m, t) => { t.vy += 0.9; }),
      drops: drops(['iron_ingot', 4], [331, 4]), fireImmune: true, sound: null, tick: (m) => { if (m.aiming > 0) m.aiming--; } }, [c, eye]);
  });
  fam.humanoid('os_triffid', { head: [[-6, -10, -6, 12, 10, 12], [-7, -2, -7, 14, 1, 14]], body: [[-3, 0, -3, 6, 14, 6]], rarm: [[-8, -2, -1, 8, 2, 2], [-10, -2, -2, 2, 4, 4]], larm: [[0, -2, -1, 8, 2, 2], [8, -2, -2, 2, 4, 4]], rleg: [[-4, 6, -4, 4, 4, 8]], lleg: [[0, 6, -4, 4, 4, 8]] });
  SP.triffid = () => paint('os_triffid', 1930, { _: ['#3a8a28', 0.12], 'head:1': '#e04080', 'rarm:1': '#e04080', 'larm:1': '#e04080' }, (s) => s.art('head', 0, 'front', ['............', '............', '............', '.WkWkWkWkWk.', '.kkkkkkkkkk.', '.kkkkkkkkkk.', '.WkWkWkWkWk.'], { W: hex('#f4f0e0'), k: hex('#3a0818') }));
  add('triffid', { w: 2, h: 4, hp: 100, hostile: true, speed: 0.4, model: 'os_triffid', scale: 1.3, findTarget: hostileFind(16), attackFn: meleeFn(10, 3, 30, (m, t) => { if (t.addEffect) t.addEffect('poison', 80); }), drops: drops(['green_goo', 2], [B.leaves, 4]) }, ['#3a8a28', '#e04080']);
  fam.quad('os_leaf_monster', { leg: 2, L: 12, H: 10, W: 12, head: [10, 6, 2], lw: 2, tl: [], shadow: 0.6 });
  SP.leaf_monster = () => paint('os_leaf_monster', 1940, { _: ['#3a8a20', 0.2] }, (s) => s.art('head', 0, 'front', ['..........', '.RR....RR.', '..........', '.WkWkWkWk.'], Object.assign(EY(), { k: hex('#1a0808') })));
  add('leaf_monster', { w: 1.0, h: 1.0, hp: 6, hostile: true, speed: 0.6, model: 'os_leaf_monster', findTarget: hostileFind(8), attackFn: meleeFn(3, 1.2, 20), drops: drops([B.leaves, 2], [B.sapling, 1]) }, ['#3a8a20', '#ff2020']);
  fam.bug('os_horror', { legH: 2, thorax: [6, 3, 6], abdomen: [7, 3, 8], head: [6, 3, 4], legLen: 7, pairs: 4, mandibles: 3 });
  SP.creeping_horror = () => paint('os_horror', 1950, { _: ['#2a1a2a', 0.15], mand: '#c0b0a0' }, (s) => eyesOn(s, 'head', 0, ['......', 'RRRRRR'], EY()));
  add('creeping_horror', { w: 0.75, h: 0.5, hp: 10, hostile: true, speed: 1.0, model: 'os_horror', findTarget: hostileFind(16), attackFn: meleeFn(3, 1, 15) }, ['#2a1a2a', '#ff2020']);
  SP.lurking_terror = () => paint('os_horror', 1951, { _: ['#4a4a40', 0.25], mand: '#e0d0c0' }, (s) => eyesOn(s, 'head', 0, ['......', 'Y....Y'], EY()));
  add('lurking_terror', { w: 1.75, h: 1.25, hp: 30, hostile: true, speed: 1.1, model: 'os_horror', skin: 'lurking_terror', scale: 2.2, findTarget: hostileFind(20), attackFn: meleeFn(6, 2, 18) }, ['#4a4a40', '#e0d0c0']);
  // worms come up out of the ground in the rain
  fam.serpent('os_worm', { segments: 5, sw: 3, sl: 3, head: [3.4, 3.4, 3], upright: true, taper: 0.1 });
  SP.worm = () => paint('os_worm', 1960, { _: ['#c07070', 0.08], jaw: '#5a2020' }, (s) => { for (let i = 0; i < 5; i++) s.fill('s' + i, 0, 'left,right,front,back', (x, y) => (y % 3 === 0 ? hex('#a05050') : null)); });
  const wormDef = (sc, hp, dmg) => ({ w: 0.3 * sc, h: 1.0 * sc, hp, hostile: true, speed: 0.15, model: 'os_worm', skin: 'worm', scale: sc, findTarget: hostileFind(4 + sc * 2), attackFn: meleeFn(dmg, 1 + sc * 0.5, 25), init: (m) => { m.persistent = false; } });
  add('worm_small', wormDef(1, 10, 2), ['#c07070', '#5a2020']);
  add('worm_medium', wormDef(2, 30, 5), ['#a05050', '#5a2020']);
  add('worm_large', Object.assign(wormDef(4, 90, 9), { drops: drops(['worm_tooth', 1, 0.5]) }), ['#804040', '#5a2020']);
  fam.quad('os_molenoid', { leg: 6, L: 30, H: 18, W: 22, head: [16, 12, 12], lw: 6, tl: [6], tw: 3, headExtra: [[-3, -2, -18, 6, 6, 6], [-5, -1, -20, 2, 2, 2], [3, -1, -20, 2, 2, 2]], shadow: 2 });
  SP.molenoid = () => paint('os_molenoid', 1970, { _: ['#3a2a2a', 0.1], 'head:1': '#f090a0', 'head:2': '#f090a0', 'head:3': '#f090a0' }, (s) => eyesOn(s, 'head', 0, ['................', '..K..........K..'], EY()));
  add('molenoid', { w: 3.9, h: 2.6, hp: 200, hostile: true, speed: 0.6, model: 'os_molenoid', scale: 1.6, boss: 'Molenoid', findTarget: hostileFind(32), attackFn: meleeFn(12, 3.5, 25, (m, t) => { t.vy += 0.6; }), drops: drops(['molenoid_nose', 1]),
    tick: (m) => { if (!isGuest() && m.target && m.age % 10 === 0) { /* it digs through anything in its way */ const w = m.world; for (let dy = 0; dy < 3; dy++) for (const s of [-1, 0, 1]) { const x = Math.floor(m.x - Math.sin(m.yaw) * 2.5 + Math.cos(m.yaw) * s), z = Math.floor(m.z - Math.cos(m.yaw) * 2.5 - Math.sin(m.yaw) * s), y = Math.floor(m.y) + dy; const b = w.getBlock(x, y, z); if (b && b !== B.bedrock && SOLID[b] && S.blocks[b].hardness >= 0 && S.blocks[b].hardness < 5) w.destroyBlock(x, y, z, rnd() < 0.1); } } } }, ['#3a2a2a', '#f090a0']);
  fam.humanoid('os_urchin', { head: [[-6, 6, -6, 12, 12, 12], [-1, 2, -1, 2, 4, 2], [-8, 11, -1, 2, 2, 2], [6, 11, -1, 2, 2, 2], [-1, 11, -8, 2, 2, 2], [-1, 11, 6, 2, 2, 2]], body: null, rarm: null, larm: null, rleg: [[-1, 6, -3, 6, 6, 6]], lleg: null });
  SP.urchin = () => paint('os_urchin', 1980, { _: ['#c060e0', 0.12], 'head:1': '#ffffff', 'head:2': '#ffffff', 'head:3': '#ffffff', 'head:4': '#ffffff', 'head:5': '#ffffff', rleg: '#8040a0' }, (s) => eyesOn(s, 'head', 0, ['............', '............', '...KK..KK...'], EY()));
  add('urchin', { w: 1.35, h: 2.1, hp: 25, hostile: true, speed: 0.4, model: 'os_urchin', findTarget: hostileFind(16), ranged: true, attackFn: (m, t, d, see) => { if (m.attackTime > 0 || !see || d > 14) return; m.attackTime = 40; OSM.shoot(m, t, 'spike', 1.2, 4); }, drops: drops(['crystal_shards', 3]) }, ['#c060e0', '#ffffff']);
  fam.humanoid('os_rotator', { head: [[-4, -8, -4, 8, 8, 8]], body: [[-1, 0, -1, 2, 14, 2], [-10, 4, -1, 20, 2, 2], [-1, 4, -10, 2, 2, 20]], rarm: null, larm: null, rleg: null, lleg: null, float: true });
  SP.rotator = () => paint('os_rotator', 1990, { _: ['#4080e0', 0.1], 'body:1': '#e0e8ff', 'body:2': '#e0e8ff' }, (s) => eyesOn(s, 'head', 0, ['........', '.CC..CC.'], EY()));
  AN.os_rotator_spin = (a) => { const o = AN.os_humanoid(a); o.body = [0, a.age * 0.4, 0, 0, o.body[4], 0]; return o; };
  D.os_rotator.anim = 'os_rotator_spin';
  add('rotator', { w: 1.0, h: 2.0, hp: 35, hostile: true, model: 'os_rotator', fly: true, flySpeed: 0.02, keep: 1.5, ai: (m) => AI.flyingAI(m), findTarget: hostileFind(20), attackFn: meleeFn(8, 2.2, 15), drops: drops(['crystal_shards', 2]) }, ['#4080e0', '#e0e8ff']);
  fam.quad('os_dungeon_beast', { leg: 5, L: 14, H: 9, W: 10, head: [8, 7, 7], lw: 3, tl: [6, 5], tw: 2.5, headExtra: [[-4, -6, -4, 1.5, 4, 1.5], [2.5, -6, -4, 1.5, 4, 1.5]] });
  SP.dungeon_beast = () => paint('os_dungeon_beast', 2000, { _: ['#5a2a1a', 0.12], 'head:1': '#e8e0c8', 'head:2': '#e8e0c8' }, (s) => eyesOn(s, 'head', 0, ['........', '.RR..RR.', '........', 'WkWkWkWk'], Object.assign(EY(), { k: hex('#200808') })));
  add('dungeon_beast', { w: 1.15, h: 1.1, hp: 65, hostile: true, speed: 0.95, model: 'os_dungeon_beast', findTarget: hostileFind(20), attackFn: meleeFn(8, 1.6, 18), drops: drops([352, 3], ['gold_ingot', 1, 0.3]) }, ['#5a2a1a', '#e8e0c8']);
  fam.quad('os_kyuubi', { leg: 6, L: 10, H: 6, W: 5, head: [5, 5, 6], lw: 2, tl: [8, 7], tw: 3, headExtra: [[-2.5, -5, -1, 2, 3, 1], [0.5, -5, -1, 2, 3, 1], [-1, 0, -8, 2, 2, 2]],
    tailExtra: [[[-6, -2, 0, 2, 2, 8], [4, -2, 0, 2, 2, 8], [-4, -5, 0, 2, 2, 8], [2, -5, 0, 2, 2, 8]], [[-5, -3, 0, 2, 2, 7], [3, -3, 0, 2, 2, 7], [-1, -6, 0, 2, 2, 7]]] });
  SP.kyuubi = () => paint('os_kyuubi', 2010, { _: ['#ff8020', 0.08], belly: '#fff0e0' }, (s) => { eyesOn(s, 'head', 0, ['.....', 'R...R'], EY()); for (const pn of ['tail0', 'tail1']) for (let bi = 0; bi < D.os_kyuubi.parts[pn].boxes.length; bi++) s.fill(pn, bi, 'back', () => hex('#fff0e0')); });
  add('kyuubi', { w: 0.5, h: 1.25, hp: 125, hostile: true, speed: 1.2, model: 'os_kyuubi', scale: 1.2, fireImmune: true, ranged: true, findTarget: hostileFind(32), attackFn: (m, t, d, see) => { if (m.attackTime > 0 || !see) return; if (d < 2) { meleeFn(8, 1.6, 15)(m, t, d, see); return; } m.attackTime = 30; if (E.shoot) E.shoot(m, 'small_fireball', t, 0.9, 3); }, drops: drops(['diamond', 1, 0.5], [377, 2]), glow: () => true }, ['#ff8020', '#fff0e0']);

  /* ============================================================ */
  /* Friends: girlfriends and boyfriends                          */
  /* ============================================================ */
  fam.humanoid('os_person', { head: [[-4, -8, -4, 8, 8, 8], [-4.5, -8.5, -4.5, 9, 4, 9]] });
  const PEOPLE = [['girlfriend', '#f0c0a0', '#e04080', '#5a3010'], ['boyfriend', '#d8a080', '#3060c0', '#2a1a10']];
  PEOPLE.forEach(([n, skinC, shirt, hair]) => {
    SP[n] = () => paint('os_person', 2100 + n.length, { _: skinC, body: shirt, rarm: skinC, larm: skinC, rleg: n === 'girlfriend' ? shirt : '#2a3a6a', lleg: n === 'girlfriend' ? shirt : '#2a3a6a', 'head:1': hair }, (s) => {
      s.art('head', 0, 'front', ['........', '........', '.WK..KW.', '........', '...rr...'], Object.assign(EY(), { r: hex('#c05050') }));
      s.fill('head', 1, 'front', (x, y) => (y < 2 ? null : () => null) && null);
    });
    add(n, { w: 0.5, h: 1.8, hp: 40, model: 'os_person', skin: n, neutral: true, speed: 0.8, attackFn: meleeFn(6, 1.6, 15), interact: (m, p, g) => OSM.befriend && OSM.befriend(m, p, g) }, [skinC, shirt]);
  });

  /* ------------------------------------------------------------ */
  /* Projectiles: acid, lasers, spikes                            */
  /* ------------------------------------------------------------ */
  const PROJ_ICON = () => ({ acid: id('green_goo'), laser: id('ruby'), spike: id('crystal_shards') });
  OSM.shoot = function (m, t, kind, speed, dmg) {
    if (!E.Magic) return null;
    const b = new E.Magic(m.world, m.x, m.y + m.h * 0.7, m.z, m, 'os_' + kind);
    b.icon = PROJ_ICON()[kind] || id('ruby'); b.size = kind === 'laser' ? 0.25 : 0.35; b.noSave = true;
    const d = dmg || (kind === 'acid' ? 6 : kind === 'laser' ? 8 : 4);
    b.hitEntity = function (e) { if (e === m || (e.def && e.def.orespawn && !e.tamed)) return; e.damage('mob', d, m); if (kind === 'acid' && e.addEffect) e.addEffect('poison', 60); if (m.world.fx) m.world.fx.particles(kind === 'acid' ? 'slime' : 'crit', this.x, this.y, this.z, 6, 0.3); this.removed = true; };
    b.hitBlock = function () { if (m.world.fx) m.world.fx.particles('smoke', this.x, this.y, this.z, 4, 0.2); this.removed = true; };
    const dx = t.x - b.x, dy = t.y + t.h * 0.5 - b.y, dz = t.z - b.z;
    b.shoot(dx, dy, dz, speed || 1, 2);
    m.world.entities.push(b);
    return b;
  };

  /* ------------------------------------------------------------ */
  /* Taming, riding and making friends                            */
  /* ------------------------------------------------------------ */
  OSM.tame = function (m, p, foods) {
    const h = p.held;
    if (m.tamed) { if (h && foods.includes(h.id) && m.health < m.maxHealth) { m.heal(6); if (!p.creative) p.consumeHeld(1); fx(m, 'heart', 3); return true; } m.sitting = !m.sitting; m.path = null; return true; }
    if (!h || !foods.includes(h.id)) return false;
    if (!p.creative) p.consumeHeld(1);
    if (rnd() < 0.3) { m.tamed = 1; m.owner = p; m.persistent = true; m.provoked = false; m.target = null; m.hostile = false; fx(m, 'heart', 7, 0.6); if (DL.game && DL.game.player === p) DL.game.chatMessage('§aYou tamed the ' + I._titleCase(m.type) + '!'); }
    else fx(m, 'smoke', 6, 0.5);
    return true;
  };
  OSM.ride = function (m, p, g) {
    if (!m.def.rideable || p.vehicle || m.rider) return false;
    if (m.def.interact && !m.tamed && m.type === 'camarasaurus') return false;
    p.sitting = null; p.vehicle = m; m.rider = p; m.persistent = true; m.path = null; m.target = null;
    if (g && g.chatMessage) g.chatMessage('§7Riding the ' + I._titleCase(m.type) + '! Sneak to get off.');
    return true;
  };
  // ride: the mount goes where its rider looks
  OSM.rideAI = (base) => (m) => {
    const r = m.rider;
    if (r && (r.vehicle !== m || r.removed || r.health <= 0)) m.rider = null;
    if (m.rider) {
      const inp = m.rider.rideInput || {}, k = (m.def.rideSpeed || 0.2) / (m.speed || 0.2);
      m.path = null; m.target = null; m.yaw = m.rider.yaw; m.lookYaw = m.yaw;
      m.moveForward = (inp.f || 0) * k * (inp.sprint ? 1.5 : 1); m.moveStrafe = (inp.s || 0) * k * 0.5; m.jumping = false;
      if (m.onGround && (inp.j || (m.collidedH && Math.abs(m.moveForward) > 0.1))) m.vy = 0.55;
      return;
    }
    return base ? base(m) : m.aiTick();
  };
  OSM.befriend = function (m, p, g) {
    const h = p.held;
    // flowers, gold and diamonds win hearts
    const gifts = [B.rose, B.dandelion, B.cornflower, B.allium, 266, 264, 388, id('love')];
    if (h && gifts.includes(h.id)) {
      if (!p.creative) p.consumeHeld(1);
      m.love = (m.love || 0) + (h.id === 264 || h.id === id('love') ? 3 : 1);
      fx(m, 'heart', 4, 0.5);
      if (m.love >= 3 && !m.tamed) { m.tamed = 1; m.owner = p; m.persistent = true; if (g && g.chatMessage) g.chatMessage('§d' + I._titleCase(m.type) + ': I\'d love to come along!'); }
      return true;
    }
    if (m.tamed) { m.sitting = !m.sitting; m.path = null; if (g && g.chatMessage) g.chatMessage('§d' + I._titleCase(m.type) + (m.sitting ? ': I\'ll wait here.' : ': Lead the way!')); return true; }
    return false;
  };
  // tamed creatures follow their owner, sit when told and fight for them
  const mobAI = E.Mob.prototype.aiTick;
  E.Mob.prototype.aiTick = function () {
    if (this.tamed && this.owner && this.def.orespawn) {
      if (this.sitting) { this.moveForward = 0; this.path = null; this.target = null; return; }
      const o = this.owner;
      if (o.removed || o.world !== this.world) return mobAI.apply(this, arguments);
      const t = o.lastAttacked;
      if (t && !t.removed && t.health > 0 && t !== this && o.age - (o.lastAttackAge || 0) < 200) this.target = t;
      if (!this.target && this.dist2(o.x, o.y, o.z) > 36) {
        if (this.dist2(o.x, o.y, o.z) > 400) { this.setPos(o.x, o.y, o.z); this.path = null; }
        else if (--this.repath <= 0 || !this.path) { this.repath = 10; this.path = E.findPath(this.world, this, o.x, o.y, o.z, 200, 20); this.pathIdx = 0; }
        this.followPath();
        return;
      }
    }
    // skittish animals run from players who come close
    if (this.def.skittish && !this.tamed && this.age % 10 === 0) {
      const p = nearestPlayer(this, 6);
      if (p && !p.sneaking) { this.panic = 60; this.path = null; }
    }
    return mobAI.apply(this, arguments);
  };
  // glowing creatures are lit by their own light
  const RP = DL.Renderer.prototype, drawModel = RP.drawModel;
  RP.drawModel = function (type, e, pt, model, light, opts) {
    const def = e && e.def;
    if (def && def.orespawn && def.glow && def.glow(e)) light = [15, 15];
    if (def && def.orespawn && def.spectral) opts = Object.assign({}, opts || {}, { tint: [0.9, 0.95, 1, 0.45] });
    return drawModel.call(this, type, e, pt, model, light, opts);
  };

  /* ------------------------------------------------------------ */
  /* Sounds                                                       */
  /* ------------------------------------------------------------ */
  const dsp = A.dsp;
  if (dsp) {
    A.DESIGNS.cricket = (v) => dsp.gen(0.5, (t) => { const ch = Math.floor(t * 18) % 3 === 0 ? 1 : 0; return Math.sin(t * 2 * Math.PI * (4200 + v * 300)) * ch * dsp.env(t, 0.01, 0.4) * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 60)); });
    A.DESIGNS.bee = (v) => { const lp = new dsp.Biquad('lp', 900); let ph = 0; return dsp.gen(0.8, (t) => { ph += (180 + v * 20 + Math.sin(t * 9) * 10) / dsp.SR; return lp.run(((ph % 1) * 2 - 1) * 0.8 + dsp.noise() * 0.2) * Math.min(1, t * 10) * Math.min(1, (0.8 - t) * 6); }); };
    A.VARIANTS.cricket = 2; A.VARIANTS.bee = 2;
  }

  /* ------------------------------------------------------------ */
  /* Where they live (the Overworld; the other worlds are in orespawn_dims.js) */
  /* ------------------------------------------------------------ */
  const WATER = new Set([BI.OCEAN, BI.DEEP_OCEAN, BI.WARM_OCEAN, BI.FROZEN_OCEAN, BI.RIVER]);
  const DESERTY = new Set([BI.DESERT, BI.BADLANDS, BI.ERODED_BADLANDS, BI.WOODED_BADLANDS]);
  const JUNGLY = new Set([BI.JUNGLE, BI.BAMBOO_JUNGLE, BI.SPARSE_JUNGLE, BI.SWAMP, BI.MANGROVE_SWAMP]);
  const HIGH = new Set([BI.WINDSWEPT_HILLS, BI.STONY_PEAKS, BI.JAGGED_PEAKS, BI.FROZEN_PEAKS, BI.GROVE, BI.SNOWY_SLOPES, BI.MEADOW]);
  const SAVANNA = new Set([BI.SAVANNA, BI.SAVANNA_PLATEAU]);
  function weighted(list) { let tot = 0; for (const e of list) tot += e[1]; let v = rnd() * tot; for (const e of list) { v -= e[1]; if (v < 0) return e[0]; } return list[0][0]; }
  OSM.weighted = weighted;
  const DAY = {
    any: [['butterfly', 10], ['cockateil', 6], ['chipmunk', 5], ['dragonfly', 3], ['lizard', 2], ['peacock', 2], ['easter_bunny', 1], ['stink_bug', 2], ['cricket', 3], ['gazelle', 2]],
    desert: [['lizard', 8], ['scorpion', 3], ['ostrich', 3], ['cricket', 2], ['emperor_scorpion', 0.08]],
    jungle: [['butterfly', 8], ['cassowary', 4], ['frog', 6], ['dragonfly', 6], ['triffid', 1], ['mantis', 0.6], ['peacock', 3], ['basilisk', 0.05], ['bee', 1]],
    savanna: [['gazelle', 8], ['ostrich', 6], ['lizard', 3], ['camarasaurus', 0.6], ['bee', 1]],
    high: [['cliff_racer', 4], ['cockateil', 4], ['chipmunk', 4], ['leonopteryx', 0.05]],
    water: [['gold_fish', 5], ['flounder', 4], ['skate', 3], ['whale', 1], ['attack_squid', 2], ['irukandji', 1], ['sea_monster', 0.5], ['water_dragon', 0.3], ['hammerhead', 0.08], ['rubber_ducky', 1]],
    river: [['gold_fish', 6], ['frog', 4], ['beaver', 4], ['rubber_ducky', 2], ['crab', 2]]
  };
  const NIGHT = {
    any: [['moth', 8], ['mosquito', 3], ['os_firefly', 5], ['cave_fisher', 1], ['ghost', 1], ['alien', 0.5], ['ender_knight', 0.4], ['robo_pounder', 0.15], ['robo_gunner', 0.15], ['robo_warrior', 0.15], ['robo_sniper', 0.15], ['leaf_monster', 1], ['rat', 2], ['jumpy_bug', 0.6], ['velocity_raptor', 0.4], ['terrible_terror', 0.5], ['dungeon_beast', 0.3], ['hercules_beetle', 0.04], ['brutalfly', 0.1], ['spit_bug', 0.3], ['trooper_bug', 0.1]],
    desert: [['scorpion', 6], ['moth', 3], ['emperor_scorpion', 0.1]],
    jungle: [['mosquito', 6], ['os_firefly', 6], ['triffid', 1], ['mantis', 0.8], ['spit_bug', 0.6]],
    rain: [['worm_small', 6], ['worm_medium', 2], ['worm_large', 0.4]]
  };
  const BEACH = new Set([BI.BEACH, BI.SNOWY_BEACH, BI.STONY_SHORE]);
  function osSpawn(world, player) {
    if (isGuest() || !player || player.health <= 0 || world.dim) return;
    let host = 0, peace = 0, bosses = 0;
    for (const e of world.entities) if (e.def && e.def.orespawn && !e.removed && !e.tamed) { if (e.def.boss) bosses++; else if (e.hostile) host++; else peace++; }
    if (world.totalTicks % 40 !== 0) return;
    const day = world.isDaytime ? world.isDaytime() : true;
    const raining = world.raining || (world.weather && world.weather.rain > 0.5);
    for (let tries = 0; tries < 2; tries++) {
      const a = rnd() * Math.PI * 2, r = 24 + rnd() * 36;
      const x = Math.floor(player.x + Math.cos(a) * r), z = Math.floor(player.z + Math.sin(a) * r);
      if (!world.isReady(x, z)) continue;
      const c = world.getChunk(x >> 4, z >> 4); if (!c || !c.biomes) continue;
      const bio = c.biomes[((z & 15) << 4) | (x & 15)];
      const top = world.topSolidY(x, z), below = world.getBlock(x, top - 1, z);
      let list;
      if (below === B.water || WATER.has(bio)) list = bio === BI.RIVER ? DAY.river : DAY.water;
      else if (BEACH.has(bio)) list = [['crab', 6], ['giant_crab', 0.3], ['rubber_ducky', 1]];
      else if (!day) list = raining ? NIGHT.rain.concat(NIGHT.any) : DESERTY.has(bio) ? NIGHT.desert.concat(NIGHT.any) : JUNGLY.has(bio) ? NIGHT.jungle.concat(NIGHT.any) : NIGHT.any;
      else list = DESERTY.has(bio) ? DAY.desert : JUNGLY.has(bio) ? DAY.jungle : SAVANNA.has(bio) ? DAY.savanna : HIGH.has(bio) ? DAY.high : DAY.any;
      const type = weighted(list), def = MOBS[type];
      if (!def) continue;
      if (def.boss && bosses > 0) continue;
      if (def.hostile ? host >= 14 || world.difficulty === 0 : peace >= 18) continue;
      let y = top;
      if (def.water) { if (below !== B.water) continue; y = top - 2 - Math.floor(rnd() * 4); if (world.getBlock(x, y, z) !== B.water) continue; }
      else if (below === B.water || S.LIQUID[world.getBlock(x, top, z)]) continue;
      if (def.fly && !def.water) y = top + 2 + Math.floor(rnd() * 6);
      if (def.minY && y < def.minY && def.fly) y = def.minY + Math.floor(rnd() * 10);
      const n = /ant$|butterfly|moth|firefly|chipmunk|gold_fish|cricket|rat|velocity|cryolo|worm_small|gazelle/.test(type) ? 1 + Math.floor(rnd() * 3) : 1;
      for (let k = 0; k < n; k++) { const m = E.spawnMob(world, type, x + 0.5 + (rnd() - 0.5) * 3, y, z + 0.5 + (rnd() - 0.5) * 3); if (m) { m.persistent = !!def.boss; if (def.boss && DL.game && DL.game.player === player) DL.game.chatMessage('§5The ground trembles... a ' + I._titleCase(type) + ' is near!'); } }
      break;
    }
  }
  const naturalSpawn = E.naturalSpawn;
  E.naturalSpawn = function (world, player) {
    const r = naturalSpawn.apply(this, arguments);
    if (!world.dim) osSpawn(world, player);
    return r;
  };
  OSM.weightedSpawn = weighted;

  // every OreSpawn model gets a mesh
  for (const k in D) if (k.startsWith('os_') && M.newModels.indexOf(k) < 0) M.newModels.push(k);

  // the bites and stings that linger: poison, wither, slowness, blindness
  const PLp = E.Player.prototype, ptick = PLp.tick;
  PLp.tick = function () {
    ptick.apply(this, arguments);
    const ef = this.effects;
    if (!ef || this.isRemote) return;
    if (ef.poison) { if (ef.poison.t % 25 === 0 && this.health > 1) this.damage('magic', 1); if (--ef.poison.t <= 0) delete ef.poison; }
    if (ef.wither) { if (ef.wither.t % 40 === 0) this.damage('wither', 1); if (--ef.wither.t <= 0) delete ef.wither; }
    if (ef.slowness) { this.vx *= 0.7; this.vz *= 0.7; if (--ef.slowness.t <= 0) delete ef.slowness; }
    if (ef.blindness && --ef.blindness.t <= 0) delete ef.blindness;
    if (ef.nausea && --ef.nausea.t <= 0) delete ef.nausea;
  };
  const extras = DL.GUI.drawHUDExtras;
  DL.GUI.drawHUDExtras = function (game, Wd, H) {
    const p = game.player, ef = p && p.effects;
    if (ef && ef.blindness) DL.GUI.rect(0, 0, Wd, H, 'rgba(0,0,0,' + Math.min(0.85, ef.blindness.t / 40).toFixed(2) + ')');
    if (ef && ef.poison && game.tickCount % 20 < 10) DL.GUI.rect(0, 0, Wd, H, 'rgba(60,140,20,0.12)');
    return extras.apply(this, arguments);
  };

  // ant hills breed ants
  if (DL.RTICK) {
    DL.RTICK[B.ant_hill] = (w, x, y, z, r) => {
      if (r.nextInt(8) !== 0 || isGuest() || w.getBlock(x, y + 1, z) !== 0) return;
      let near = 0; for (const e of w.entities) if (e.def && e.def.ant && e.dist2(x, y, z) < 64) near++;
      if (near >= 6) return;
      const kinds = ['brown_ant', 'brown_ant', 'brown_ant', 'red_ant', 'red_ant', 'rainbow_ant', 'unstable_ant', 'termite'];
      const m = w.getMeta(x, y, z) % kinds.length;
      E.spawnMob(w, kinds[(m + r.nextInt(3)) % kinds.length], x + 0.5, y + 1, z + 0.5);
    };
  }
})();
