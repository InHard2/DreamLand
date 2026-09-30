/*
 * DreamLand - box-model rigs, hand-authored procedural skins and poses.
 *
 * Model space follows the classic convention: units are pixels, Y points
 * down, feet rest at y=24 and the creature faces -Z. Box coordinates are
 * relative to their part's pivot. UVs are packed automatically, so every
 * box owns its own non-overlapping region of the skin.
 */
(function () {
  const DL = window.DL;
  const S = DL.S;
  const M = DL.Models = {};

  /* ------------------------------------------------------------ */
  /* Rigs                                                         */
  /* ------------------------------------------------------------ */
  function biped(o) {
    o = o || {};
    const inf = o.inflate || 0;
    const aw = o.thin ? 2 : 4;
    const box = (x, y, z, w, h, d, i) => [x, y, z, w, h, d, i === undefined ? inf : i];
    const parts = {
      head: { pivot: [0, 0, 0], boxes: [box(-4, -8, -4, 8, 8, 8)] },
      body: { pivot: [0, 0, 0], boxes: [box(-4, 0, -2, 8, 12, 4)] },
      rarm: { pivot: [-5, 2, 0], boxes: [o.thin ? box(-1, -2, -1, 2, 12, 2) : box(-3, -2, -2, 4, 12, 4)] },
      larm: { pivot: [5, 2, 0], boxes: [o.thin ? box(-1, -2, -1, 2, 12, 2) : box(-1, -2, -2, 4, 12, 4)] },
      rleg: { pivot: [-2, 12, 0], boxes: [o.thin ? box(-1, 0, -1, 2, 12, 2) : box(-2, 0, -2, 4, 12, 4)] },
      lleg: { pivot: [2, 12, 0], boxes: [o.thin ? box(-1, 0, -1, 2, 12, 2) : box(-2, 0, -2, 4, 12, 4)] }
    };
    if (o.hat) parts.hat = { pivot: [0, 0, 0], boxes: [box(-4, -8, -4, 8, 8, 8, 0.5)], follow: 'head' };
    void aw;
    return { parts, anim: o.anim || 'biped', noCull: !!o.noCull, shadow: 0.5 };
  }
  function quad(o) {
    return o;
  }
  const MODELS = {
    pig: quad({
      anim: 'quad', shadow: 0.5,
      parts: {
        head: { pivot: [0, 12, -6], boxes: [[-4, -4, -8, 8, 8, 8], [-2, 0, -9, 4, 3, 1]] },
        body: { pivot: [0, 0, 0], boxes: [[-5, 10, -8, 10, 8, 16]] },
        leg1: { pivot: [-3, 18, 7], boxes: [[-2, 0, -2, 4, 6, 4]] },
        leg2: { pivot: [3, 18, 7], boxes: [[-2, 0, -2, 4, 6, 4]] },
        leg3: { pivot: [-3, 18, -5], boxes: [[-2, 0, -2, 4, 6, 4]] },
        leg4: { pivot: [3, 18, -5], boxes: [[-2, 0, -2, 4, 6, 4]] }
      }
    }),
    cow: quad({
      anim: 'quad', shadow: 0.7,
      parts: {
        head: { pivot: [0, 4, -8], boxes: [[-4, -4, -6, 8, 8, 6], [-5, -5, -4, 1, 3, 1], [4, -5, -4, 1, 3, 1]] },
        body: { pivot: [0, 0, 0], boxes: [[-6, 2, -8, 12, 10, 18], [-2, 12, 3, 4, 1, 6]] },
        leg1: { pivot: [-4, 12, 7], boxes: [[-2, 0, -2, 4, 12, 4]] },
        leg2: { pivot: [4, 12, 7], boxes: [[-2, 0, -2, 4, 12, 4]] },
        leg3: { pivot: [-4, 12, -6], boxes: [[-2, 0, -2, 4, 12, 4]] },
        leg4: { pivot: [4, 12, -6], boxes: [[-2, 0, -2, 4, 12, 4]] }
      }
    }),
    sheep: quad({
      anim: 'quad', shadow: 0.7,
      parts: {
        head: { pivot: [0, 6, -8], boxes: [[-3, -4, -6, 6, 6, 8]] },
        body: { pivot: [0, 0, 0], boxes: [[-4, 6, -8, 8, 6, 16]] },
        leg1: { pivot: [-3, 12, 7], boxes: [[-2, 0, -2, 4, 12, 4]] },
        leg2: { pivot: [3, 12, 7], boxes: [[-2, 0, -2, 4, 12, 4]] },
        leg3: { pivot: [-3, 12, -5], boxes: [[-2, 0, -2, 4, 12, 4]] },
        leg4: { pivot: [3, 12, -5], boxes: [[-2, 0, -2, 4, 12, 4]] },
        whead: { pivot: [0, 6, -8], boxes: [[-3, -4, -4, 6, 6, 6, 0.6]], wool: 1, follow: 'head' },
        wbody: { pivot: [0, 0, 0], boxes: [[-4, 6, -8, 8, 6, 16, 1.75]], wool: 1, follow: 'body' },
        wleg1: { pivot: [-3, 12, 7], boxes: [[-2, 0, -2, 4, 6, 4, 0.5]], wool: 1, follow: 'leg1' },
        wleg2: { pivot: [3, 12, 7], boxes: [[-2, 0, -2, 4, 6, 4, 0.5]], wool: 1, follow: 'leg2' },
        wleg3: { pivot: [-3, 12, -5], boxes: [[-2, 0, -2, 4, 6, 4, 0.5]], wool: 1, follow: 'leg3' },
        wleg4: { pivot: [3, 12, -5], boxes: [[-2, 0, -2, 4, 6, 4, 0.5]], wool: 1, follow: 'leg4' }
      }
    }),
    chicken: quad({
      anim: 'chicken', shadow: 0.3, noCull: true,
      parts: {
        head: { pivot: [0, 15, -4], boxes: [[-2, -6, -2, 4, 6, 3], [-2, -4, -4, 4, 2, 2], [-1, -2, -3, 2, 2, 2]] },
        body: { pivot: [0, 0, 0], boxes: [[-3, 13, -4, 6, 6, 8]] },
        leg1: { pivot: [-2, 19, 1], boxes: [[-1, 0, -3, 3, 5, 3]] },
        leg2: { pivot: [1, 19, 1], boxes: [[-1, 0, -3, 3, 5, 3]] },
        wing1: { pivot: [-4, 13, 0], boxes: [[0, 0, -3, 1, 4, 6]] },
        wing2: { pivot: [4, 13, 0], boxes: [[-1, 0, -3, 1, 4, 6]] }
      }
    }),
    player: biped({ hat: true }),
    zombie: biped({ anim: 'zombie' }),
    skeleton: biped({ thin: true, anim: 'zombie', noCull: true }),
    armor1: biped({ inflate: 1.0, noCull: true }),
    armor2: biped({ inflate: 0.5, noCull: true }),
    creeper: quad({
      anim: 'creeper', shadow: 0.5,
      parts: {
        head: { pivot: [0, 6, 0], boxes: [[-4, -8, -4, 8, 8, 8]] },
        body: { pivot: [0, 6, 0], boxes: [[-4, 0, -2, 8, 12, 4]] },
        leg1: { pivot: [-2, 18, 4], boxes: [[-2, 0, -2, 4, 6, 4]] },
        leg2: { pivot: [2, 18, 4], boxes: [[-2, 0, -2, 4, 6, 4]] },
        leg3: { pivot: [-2, 18, -4], boxes: [[-2, 0, -2, 4, 6, 4]] },
        leg4: { pivot: [2, 18, -4], boxes: [[-2, 0, -2, 4, 6, 4]] }
      }
    }),
    spider: quad({
      anim: 'spider', shadow: 1.0,
      parts: {
        head: { pivot: [0, 15, -3], boxes: [[-4, -4, -8, 8, 8, 8]] },
        neck: { pivot: [0, 15, 0], boxes: [[-3, -3, -3, 6, 6, 6]] },
        body: { pivot: [0, 15, 9], boxes: [[-5, -4, -6, 10, 8, 12]] },
        leg1: { pivot: [-4, 15, 2], boxes: [[-15, -1, -1, 16, 2, 2]] },
        leg2: { pivot: [4, 15, 2], boxes: [[-1, -1, -1, 16, 2, 2]] },
        leg3: { pivot: [-4, 15, 1], boxes: [[-15, -1, -1, 16, 2, 2]] },
        leg4: { pivot: [4, 15, 1], boxes: [[-1, -1, -1, 16, 2, 2]] },
        leg5: { pivot: [-4, 15, 0], boxes: [[-15, -1, -1, 16, 2, 2]] },
        leg6: { pivot: [4, 15, 0], boxes: [[-1, -1, -1, 16, 2, 2]] },
        leg7: { pivot: [-4, 15, -1], boxes: [[-15, -1, -1, 16, 2, 2]] },
        leg8: { pivot: [4, 15, -1], boxes: [[-1, -1, -1, 16, 2, 2]] }
      }
    })
  };
  M.defs = MODELS;

  /* ------------------------------------------------------------ */
  /* Automatic UV layout (shelf packer)                           */
  /* ------------------------------------------------------------ */
  function layout(mdl) {
    if (mdl.layout) return mdl.layout;
    const items = [];
    for (const pn in mdl.parts) mdl.parts[pn].boxes.forEach((b, i) => items.push({ pn, i, w: 2 * (b[5] + b[3]), h: b[5] + b[4] }));
    const W = Math.max(64, ...items.map(it => it.w <= 64 ? 64 : 128));
    items.sort((a, b) => b.h - a.h || b.w - a.w);
    let x = 0, y = 0, rowH = 0;
    const uv = {};
    for (const it of items) {
      if (x + it.w > W) { x = 0; y += rowH; rowH = 0; }
      uv[it.pn + ':' + it.i] = [x, y];
      x += it.w; rowH = Math.max(rowH, it.h);
    }
    let H = 16;
    while (H < y + rowH) H *= 2;
    mdl.layout = { W, H, uv };
    return mdl.layout;
  }
  M.layout = (name) => layout(MODELS[name]);

  const FACE = { bottom: 0, top: 1, front: 2, back: 3, left: 4, right: 5 };
  // rects: [u, v, w, h] per face index. Orientation as seen from outside:
  // front/back/sides: x right, y down; top: front edge at row 0; bottom: back edge at row 0.
  function faceRects(b, u, v) {
    const w = b[3], h = b[4], d = b[5];
    return [
      [u + d + w, v, w, d],
      [u + d, v, w, d],
      [u + d, v + d, w, h],
      [u + d * 2 + w, v + d, w, h],
      [u + d + w, v + d, d, h],
      [u, v + d, d, h]
    ];
  }

  /* ------------------------------------------------------------ */
  /* Skin painting                                                */
  /* ------------------------------------------------------------ */
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const shade = (c, f) => [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)];

  function Skin(modelName, seed) {
    this.mdl = MODELS[modelName];
    this.L = layout(this.mdl);
    this.w = this.L.W; this.h = this.L.H;
    this.c = DL.Tex.makeCanvas(this.w, this.h);
    this.ctx = this.c.getContext('2d');
    this.img = this.ctx.createImageData(this.w, this.h);
    this.r = new S.RNG(seed || 1);
  }
  Skin.prototype.px = function (x, y, c) {
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 4;
    this.img.data[o] = c[0]; this.img.data[o + 1] = c[1]; this.img.data[o + 2] = c[2]; this.img.data[o + 3] = c[3] === undefined ? 255 : c[3];
  };
  Skin.prototype.rect = function (pn, bi, face) {
    const b = this.mdl.parts[pn].boxes[bi];
    const [u, v] = this.L.uv[pn + ':' + bi];
    return faceRects(b, u, v)[FACE[face]];
  };
  Skin.prototype.pick = function (v) {
    if (!Array.isArray(v)) return v;
    if (!Array.isArray(v[0])) return v;
    return v[this.r.nextInt(v.length)];
  };
  /** Paint a face using fn(x, y, w, h) -> color | null */
  Skin.prototype.fill = function (pn, bi, face, fn) {
    const faces = face === 'all' ? Object.keys(FACE) : face.split(',');
    for (const f of faces) {
      const [u, v, w, h] = this.rect(pn, bi, f);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.px(u + x, v + y, this.pick(fn(x, y, w, h, f)));
    }
  };
  /** Paint a face from pixel-art rows (must match the face size). */
  Skin.prototype.art = function (pn, bi, face, rows, pal) {
    const [u, v, w, h] = this.rect(pn, bi, face);
    for (let y = 0; y < h && y < rows.length; y++) {
      for (let x = 0; x < w && x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (ch === '.' || ch === ' ') continue;
        this.px(u + x, v + y, this.pick(pal[ch]));
      }
    }
  };
  Skin.prototype.mirror = (rows) => rows.map(r => r.split('').reverse().join(''));
  Skin.prototype.done = function () { this.ctx.putImageData(this.img, 0, 0); return this.c; };
  // weighted dither helper: returns one of cols by thresholds
  Skin.prototype.dither = function (cols, weights) {
    let v = this.r.next(), acc = 0;
    for (let i = 0; i < cols.length; i++) { acc += weights[i]; if (v < acc) return cols[i]; }
    return cols[cols.length - 1];
  };

  const SKINS = {};
  M.skins = SKINS;

  /* ---------------- Player ("Dreamer") ---------------- */
  function paintPlayer() {
    const s = new Skin('player', 19);
    const P = {
      H: hex('#4a2e1c'), h: hex('#382214'), i: hex('#623e26'), S: hex('#dda886'), s: hex('#c48e6e'), k: hex('#ecba98'),
      W: hex('#f8f8f8'), E: hex('#366cb0'), B: hex('#3e2616'), n: hex('#c89070'), M: hex('#9c5448'),
      C: hex('#2e8c66'), c: hex('#226e50'), l: hex('#3ea47a'), T: hex('#604026'), Y: hex('#d4b85c'),
      J: hex('#424e78'), j: hex('#323c60'), g: hex('#52608e'), O: hex('#48382c'), o: hex('#342820')
    };
    const hair = [P.H, P.H, P.H, P.i, P.h];
    P.X = hair;
    s.art('head', 0, 'front', [
      'XXXXXXXX',
      'XXiXXXXX',
      'HSkkkkSH',
      'SBBSSBBS',
      'SWESSEWS',
      'SSSnnSSS',
      'SSSMMSSS',
      'sSSSSSSs'
    ], P);
    const side = [
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXSk',
      'XXXXXSSS',
      'hXXXssSS',
      'hXXXssSS',
      'hhXSSSSS',
      'hhsSSSSs'
    ];
    s.art('head', 0, 'right', side, P);
    s.art('head', 0, 'left', s.mirror(side), P);
    s.fill('head', 0, 'back', (x, y) => y >= 6 ? (y === 7 ? P.h : [P.H, P.h]) : hair);
    s.fill('head', 0, 'top', (x, y) => (x === 3 && y < 5) ? P.i : hair);
    s.fill('head', 0, 'bottom', (x, y) => y < 3 ? P.h : P.s);
    // hair overlay (adds volume)
    s.art('hat', 0, 'front', ['XXXXXXXX', 'XX.XXX.X', 'X......X', 'h......h'], P);
    const hs = ['XXXXXXXX', 'XXXXXXX.', 'XXXXX...', 'XXX.....', 'hX......', 'h.......'];
    s.art('hat', 0, 'right', hs, P);
    s.art('hat', 0, 'left', s.mirror(hs), P);
    s.art('hat', 0, 'back', ['XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'hXXXXXXh', 'h.hXXh.h'], P);
    s.fill('hat', 0, 'top', (x, y) => (x + y * 3) % 7 === 0 ? P.i : hair);
    // body
    P.Q = [P.C, P.C, P.C, P.l];
    s.art('body', 0, 'front', [
      'QQSSSSQQ',
      'QQQSSQQQ',
      'QcQQQQcQ',
      'QcQQQQcQ',
      'QQQQQQQQ',
      'QcQQQQQQ',
      'QQQQQQcQ',
      'QQQQQQQQ',
      'cQQQQQQc',
      'cccccccc',
      'TTTYYTTT',
      'JJJJJJJJ'
    ], P);
    s.art('body', 0, 'back', ['QQQQQQQQ', 'QQQQQQQQ', 'QQQcQQQQ', 'QQQcQQQQ', 'QQQQQQQQ', 'QQQQcQQQ', 'QQQQcQQQ', 'QQQQQQQQ', 'cQQQQQQc', 'cccccccc', 'TTTTTTTT', 'JJJJJJJJ'], P);
    const bs = ['QQQQ', 'QQQQ', 'QQQc', 'QQQc', 'QQQQ', 'QQQQ', 'QQQQ', 'QQQQ', 'cQQc', 'cccc', 'TTTT', 'jJJj'];
    s.art('body', 0, 'right', bs, P);
    s.art('body', 0, 'left', s.mirror(bs), P);
    s.art('body', 0, 'top', ['QQSSSSQQ', 'QQSSSSQQ', 'QQQSSQQQ', 'QQQQQQQQ'], P);
    s.fill('body', 0, 'bottom', () => P.j);
    // arms
    const arm = (x, y, w) => y < 4 ? P.Q : y === 4 ? P.c : y === 11 ? P.s : (x === 0 || x === w - 1) ? [P.S, P.s] : [P.S, P.S, P.k];
    for (const a of ['rarm', 'larm']) {
      s.fill(a, 0, 'front,back,left,right', arm);
      s.fill(a, 0, 'top', () => P.Q);
      s.fill(a, 0, 'bottom', () => P.s);
    }
    // legs
    const leg = (x, y, w) => y >= 9 ? (y === 9 ? P.O : P.o) : (x === w - 1 ? P.j : (y === 5 && x === 1) ? P.g : [P.J, P.J, P.J, P.g]);
    for (const l of ['rleg', 'lleg']) {
      s.fill(l, 0, 'front,back,left,right', leg);
      s.fill(l, 0, 'top', () => P.J);
      s.fill(l, 0, 'bottom', () => P.o);
    }
    return s.done();
  }

  /* ---------------- Zombie ---------------- */
  function paintZombie() {
    const s = new Skin('zombie', 15);
    const P = {
      Z: hex('#4c8a3c'), z: hex('#3a6c2e'), y: hex('#5e9e4c'), K: hex('#10180e'), k: hex('#26381e'), m: hex('#2c4424'),
      C: hex('#00a0a0'), c: hex('#007a7a'), l: hex('#1cb6b6'), J: hex('#443c96'), j: hex('#322c74'), g: hex('#554ca8'), F: hex('#2e4a26')
    };
    P.X = [P.Z, P.Z, P.Z, P.y, P.z];
    s.art('head', 0, 'front', [
      'XXXXXXXX',
      'XzXXXXXX',
      'XXXXXXzX',
      'XkkXXkkX',
      'XKKXXKKX',
      'XXXzzXXX',
      'XXmmmmXX',
      'zXmXXmXz'
    ], P);
    s.fill('head', 0, 'right,left,back,top,bottom', (x, y) => y === 7 ? [P.z, P.X] : P.X);
    const shirt = [P.C, P.C, P.C, P.l];
    const torn = (x, y) => (y >= 9 && ((x * 7 + y * 3) % 5 === 0)) || (y === 11 && x % 3 !== 1);
    s.fill('body', 0, 'front,back,left,right', (x, y) => torn(x, y) ? P.X : y === 10 ? P.c : shirt);
    s.fill('body', 0, 'top', () => shirt);
    s.fill('body', 0, 'bottom', () => P.J);
    const arm = (x, y) => y < 4 ? shirt : y === 4 ? (x % 2 ? P.c : P.X) : (y === 11 ? P.z : P.X);
    for (const a of ['rarm', 'larm']) { s.fill(a, 0, 'front,back,left,right', arm); s.fill(a, 0, 'top', () => shirt); s.fill(a, 0, 'bottom', () => P.z); }
    const leg = (x, y, w) => y >= 10 ? P.F : (y === 9 && x % 2) ? P.X : (x === w - 1 ? P.j : [P.J, P.J, P.g]);
    for (const l of ['rleg', 'lleg']) { s.fill(l, 0, 'front,back,left,right', leg); s.fill(l, 0, 'top', () => P.J); s.fill(l, 0, 'bottom', () => P.F); }
    return s.done();
  }

  /* ---------------- Skeleton ---------------- */
  function paintSkeleton() {
    const s = new Skin('skeleton', 16);
    const P = { B: hex('#c8c8c4'), b: hex('#a4a4a0'), x: hex('#76766f'), K: hex('#1e1e1e'), k: hex('#3a3a38'), t: hex('#e2e2de') };
    P.X = [P.B, P.B, P.B, P.t, P.b];
    s.art('head', 0, 'front', [
      'bXXXXXXb',
      'XXXXXXXX',
      'XXbXXbXX',
      'XKKXXKKX',
      'XKkXXkKX',
      'XXXxxXXX',
      'XKtKtKtX',
      'bXKXKXKb'
    ], P);
    s.fill('head', 0, 'right,left,back,top', (x, y) => (x + y) % 9 === 0 ? P.b : P.X);
    s.fill('head', 0, 'bottom', (x, y) => (y > 1 && x > 1 && x < 6) ? P.K : P.b);
    const ribs = (x, y, w) => {
      if (y >= 10) return y === 11 ? P.b : P.X;
      if (w === 8 && (x === 3 || x === 4)) return (y % 2 ? P.b : P.X);
      if (y % 2 === 1 && y < 9 && (w !== 8 || (x > 0 && x < 7))) return P.X;
      return null;
    };
    s.fill('body', 0, 'front,back,left,right', ribs);
    s.fill('body', 0, 'top', () => P.X);
    s.fill('body', 0, 'bottom', () => P.b);
    const limb = (x, y) => (y === 5 || y === 6) ? P.x : (y === 0 || y === 11) ? P.b : P.X;
    for (const k of ['rarm', 'larm', 'rleg', 'lleg']) { s.fill(k, 0, 'front,back,left,right', limb); s.fill(k, 0, 'top,bottom', () => P.b); }
    return s.done();
  }

  /* ---------------- Creeper ---------------- */
  function paintCreeper() {
    const s = new Skin('creeper', 17);
    const g = [hex('#5aae48'), hex('#5aae48'), hex('#4a9a3c'), hex('#6cc05a'), hex('#3a8230'), hex('#86d078'), hex('#9ab896'), hex('#2f6e28')];
    const w = [0.3, 0.1, 0.18, 0.14, 0.12, 0.07, 0.04, 0.05];
    const G = () => s.dither(g, w);
    const P = { K: hex('#0c0c0c'), k: hex('#1e3a1a'), m: hex('#244a20') };
    s.fill('head', 0, 'right,left,back,top,bottom', G);
    const face = [
      '........',
      '........',
      '.KK..KK.',
      '.KK..KK.',
      '...KK...',
      '..kKKk..',
      '..KKKK..',
      '..K..K..'
    ];
    s.fill('head', 0, 'front', (x, y) => face[y][x] === 'K' ? P.K : face[y][x] === 'k' ? P.m : G());
    s.fill('body', 0, 'all', G);
    for (let i = 1; i <= 4; i++) {
      s.fill('leg' + i, 0, 'front,back,left,right', (x, y) => y >= 5 ? shade(G(), 0.7) : G());
      s.fill('leg' + i, 0, 'top', G);
      s.fill('leg' + i, 0, 'bottom', () => hex('#2a5a24'));
    }
    return s.done();
  }

  /* ---------------- Spider ---------------- */
  function paintSpider() {
    const s = new Skin('spider', 18);
    const base = [hex('#2e2724'), hex('#2e2724'), hex('#3c332e'), hex('#1e1a18'), hex('#4a3f38')];
    const F = () => s.dither(base, [0.35, 0.2, 0.2, 0.15, 0.1]);
    const P = { R: hex('#e0201c'), r: hex('#a8100c'), p: hex('#ff6a5a'), K: hex('#141110'), f: hex('#5a4a40') };
    s.fill('head', 0, 'right,left,back,top,bottom', F);
    s.fill('head', 0, 'front', (x, y) => {
      const eyes = ['........', '...rr...', '...pr...', '.RR..RR.', '.Rp..pR.', 'r......r', '..K..K..', '.fK..Kf.'];
      const ch = eyes[y][x];
      return ch === '.' ? F() : P[ch];
    });
    s.fill('neck', 0, 'all', F);
    s.fill('body', 0, 'front,back,left,right,bottom', (x, y) => ((x + y * 2) % 7 === 0 ? P.f : F()));
    s.fill('body', 0, 'top', (x, y, w, h) => {
      const cx = Math.abs(x - (w - 1) / 2);
      if ((y === 3 || y === 7) && cx < 3) return P.f;
      if (y > 4 && y < 10 && cx < 1) return hex('#5e2a20');
      return F();
    });
    for (let i = 1; i <= 8; i++) s.fill('leg' + i, 0, 'all', (x) => (x === 6 || x === 7 || x === 12) ? P.f : F());
    return s.done();
  }

  /* ---------------- Pig ---------------- */
  function paintPig() {
    const s = new Skin('pig', 11);
    const P = { P: hex('#eea0a2'), p: hex('#d88486'), q: hex('#f8b8ba'), W: hex('#f8f8f8'), K: hex('#1a1a1a'), n: hex('#b05a60'), N: hex('#f6aeb0'), h: hex('#6e4a40') };
    P.X = [P.P, P.P, P.P, P.q, P.p];
    s.art('head', 0, 'front', [
      'XXXXXXXX',
      'XXXXXXXX',
      'XpXXXXpX',
      'XWKXXKWX',
      'XXXXXXXX',
      'XXXXXXXX',
      'pXXXXXXp',
      'ppXXXXpp'
    ], P);
    s.fill('head', 0, 'right,left,back,top', (x, y) => y === 7 ? P.p : P.X);
    s.fill('head', 0, 'bottom', () => P.p);
    s.art('head', 1, 'front', ['NNNN', 'NnnN', 'pNNp'], P);
    s.fill('head', 1, 'right,left,top,bottom,back', () => P.N);
    s.fill('body', 0, 'front,back,left,right', (x, y, w, h) => y >= h - 2 ? P.p : (x * 5 + y * 11) % 17 === 0 ? P.q : P.X);
    s.fill('body', 0, 'top', (x, y) => (x * 3 + y * 7) % 13 === 0 ? P.p : P.X);
    s.fill('body', 0, 'bottom', (x, y) => (y > 5 && y < 12 && (x === 2 || x === 7) && y % 2) ? P.n : P.p);
    for (let i = 1; i <= 4; i++) {
      s.fill('leg' + i, 0, 'front,back,left,right', (x, y) => y === 5 ? P.h : y === 4 ? P.p : P.X);
      s.fill('leg' + i, 0, 'top', () => P.P);
      s.fill('leg' + i, 0, 'bottom', () => P.h);
    }
    return s.done();
  }

  /* ---------------- Cow ---------------- */
  function paintCow() {
    const s = new Skin('cow', 12);
    const P = { D: hex('#46322a'), d: hex('#34251e'), e: hex('#5a4234'), W: hex('#ececea'), w: hex('#d4d4d0'), K: hex('#141414'), m: hex('#d8a898'), n: hex('#8a5a50'), H: hex('#e6e0d0'), h: hex('#a8a090'), U: hex('#eca8a8'), u: hex('#c88888'), F: hex('#2a2420') };
    const brown = [P.D, P.D, P.D, P.e, P.d];
    const white = [P.W, P.W, P.w];
    const noise = new S.Perlin(new S.RNG(1212));
    const patch = (x, y, k) => noise.noise(x / 4.5, y / 4.5, k) > 0.08 ? white : brown;
    s.art('head', 0, 'front', [
      'DDDWWDDD',
      'DDDWWDDD',
      'DWKDDKWD',
      'DDDWWDDD',
      'DDDWWDDD',
      'DmmmmmmD',
      'mmnmmnmm',
      'mmmmmmmm'
    ], Object.assign({}, P, { D: brown, W: white }));
    s.fill('head', 0, 'right,left', (x, y) => y >= 5 ? (y === 7 ? P.m : brown) : brown);
    s.fill('head', 0, 'back,top,bottom', () => brown);
    for (const bi of [1, 2]) { s.fill('head', bi, 'all', (x, y) => y === 0 ? P.h : P.H); }
    s.fill('body', 0, 'front', (x, y) => patch(x, y, 0.5));
    s.fill('body', 0, 'back', (x, y) => patch(x + 20, y, 0.5));
    s.fill('body', 0, 'right', (x, y) => patch(x + 40, y, 1.5));
    s.fill('body', 0, 'left', (x, y) => patch(x + 70, y, 2.5));
    s.fill('body', 0, 'top', (x, y) => patch(x, y + 30, 3.5));
    s.fill('body', 0, 'bottom', (x, y) => patch(x + 5, y + 50, 4.5));
    s.fill('body', 1, 'all', (x, y) => (x + y) % 3 === 0 ? P.u : P.U);
    for (let i = 1; i <= 4; i++) {
      s.fill('leg' + i, 0, 'front,back,left,right', (x, y) => y === 11 ? P.F : y >= 7 ? white : brown);
      s.fill('leg' + i, 0, 'top', () => brown);
      s.fill('leg' + i, 0, 'bottom', () => P.F);
    }
    return s.done();
  }

  /* ---------------- Sheep ---------------- */
  function paintSheep() {
    const s = new Skin('sheep', 13);
    const P = { F: hex('#dccab8'), f: hex('#c4b09c'), K: hex('#181818'), W: hex('#f4f4f4'), n: hex('#c89090'), N: hex('#a86c6c'), s: hex('#d8bcb0'), H: hex('#584a40') };
    s.art('head', 0, 'front', [
      'FFFFFF',
      'FFFFFF',
      'KWFFWK',
      'FFFFFF',
      'FFnnFF',
      'fFNNFf'
    ], P);
    s.fill('head', 0, 'right,left,back,top,bottom', (x, y) => y === 5 ? P.f : P.F);
    s.fill('body', 0, 'all', (x, y) => (x + y) % 5 === 0 ? P.f : P.s);
    for (let i = 1; i <= 4; i++) {
      s.fill('leg' + i, 0, 'front,back,left,right', (x, y) => y >= 10 ? P.H : (y > 5 ? P.F : P.s));
      s.fill('leg' + i, 0, 'top', () => P.s);
      s.fill('leg' + i, 0, 'bottom', () => P.H);
    }
    // wool: curly two-tone tufts
    const W1 = hex('#f0f0ec'), W2 = hex('#dcdcd6'), W3 = hex('#fcfcfa'), W4 = hex('#c6c6c0');
    const wool = (x, y) => {
      const k = ((x >> 1) * 3 + (y >> 1) * 5 + ((x + y) & 1)) % 7;
      return k === 0 ? W4 : k < 3 ? W2 : k === 6 ? W3 : W1;
    };
    s.fill('whead', 0, 'right,left,back,top', wool);
    s.fill('whead', 0, 'front', (x, y) => (y < 2 || x === 0 || x === 5) ? wool(x, y) : null);
    s.fill('whead', 0, 'bottom', () => null);
    s.fill('wbody', 0, 'all', wool);
    for (let i = 1; i <= 4; i++) { s.fill('wleg' + i, 0, 'front,back,left,right', wool); s.fill('wleg' + i, 0, 'top,bottom', () => null); }
    return s.done();
  }

  /* ---------------- Chicken ---------------- */
  function paintChicken() {
    const s = new Skin('chicken', 14);
    const P = { F: hex('#f6f6f6'), f: hex('#dedede'), g: hex('#c4c4c4'), K: hex('#141414'), Y: hex('#f8c030'), y: hex('#d89818'), R: hex('#dc2c28'), r: hex('#aa1a18'), O: hex('#e89830'), o: hex('#b86e18') };
    s.art('head', 0, 'front', ['FFFF', 'KFFK', 'FFFF', 'FFFF', 'FFFF', 'fFFf'], P);
    s.fill('head', 0, 'right,left', (x, y) => (y === 1 && x === 1) ? P.K : y === 5 ? P.f : P.F);
    s.fill('head', 0, 'back,top,bottom', (x, y) => y === 0 ? P.F : [P.F, P.F, P.f]);
    s.fill('head', 1, 'all', (x, y, w, h, f) => f === 'bottom' ? P.y : (y === 1 ? P.y : P.Y));
    s.fill('head', 2, 'all', (x, y) => y === 1 ? P.r : P.R);
    s.fill('body', 0, 'front,back,left,right', (x, y, w, h) => y === h - 1 ? P.g : (x + y * 2) % 5 === 0 ? P.f : P.F);
    s.fill('body', 0, 'top', (x, y) => (y > 5 ? P.f : P.F));
    s.fill('body', 0, 'bottom', () => P.f);
    const legFn = (x, y) => (y === 4) ? P.O : (x === 1 ? P.O : null);
    for (const l of ['leg1', 'leg2']) {
      s.fill(l, 0, 'front,back,left,right', legFn);
      s.fill(l, 0, 'bottom', (x, y) => (x === 1 || y === 0) ? P.o : null);
      s.fill(l, 0, 'top', () => null);
    }
    for (const w of ['wing1', 'wing2']) {
      s.fill(w, 0, 'left,right', (x, y) => y === 3 ? P.g : (x % 2 === 0 && y > 0) ? P.f : P.F);
      s.fill(w, 0, 'front,back,top,bottom', () => P.f);
    }
    return s.done();
  }

  /* ---------------- Armor ---------------- */
  const ARMOR_MAT = {
    leather: [hex('#8a5230'), hex('#6c3e22'), hex('#a86e46'), hex('#4e2c16')],
    iron: [hex('#d0d0d0'), hex('#a2a2a2'), hex('#f2f2f2'), hex('#6e6e6e')],
    gold: [hex('#f4c83c'), hex('#c8961c'), hex('#fff098'), hex('#8a6410')],
    diamond: [hex('#62dcd6'), hex('#2ca6a2'), hex('#c6fcf6'), hex('#15706c')]
  };
  M.ARMOR_MATS = Object.keys(ARMOR_MAT);
  function paintArmor(layer, mat) {
    const s = new Skin(layer === 1 ? 'armor1' : 'armor2', 30 + layer);
    const [m, d, l, o] = ARMOR_MAT[mat];
    const metal = (x, y, w, h) => (y === 0 || x === 0) ? l : (y === h - 1 || x === w - 1) ? d : ((x * 3 + y * 5) % 11 === 0 ? l : m);
    if (layer === 1) {
      // helmet
      s.fill('head', 0, 'top', metal);
      s.fill('head', 0, 'back', (x, y, w, h) => y < 7 ? metal(x, y, w, 7) : null);
      s.fill('head', 0, 'right,left', (x, y, w) => {
        const front = w - 1; // right face: x=w-1 is front; handled symmetric below
        void front;
        return y < 5 || (y < 7 && x < 5) ? metal(x, y, w, 7) : null;
      });
      s.fill('head', 0, 'front', (x, y) => y < 2 ? (y === 1 ? d : l) : ((x === 0 || x === 7) && y < 6 ? m : (y === 2 && (x === 1 || x === 6) ? o : null)));
      s.fill('head', 0, 'bottom', () => null);
      // chestplate
      s.fill('body', 0, 'front,back', (x, y, w, h) => y < 10 ? (y === 9 ? d : (x === 3 || x === 4) && y > 1 ? l : metal(x, y, w, 10)) : null);
      s.fill('body', 0, 'right,left', (x, y, w) => y < 10 ? metal(x, y, w, 10) : null);
      s.fill('body', 0, 'top', metal);
      s.fill('body', 0, 'bottom', () => null);
      for (const a of ['rarm', 'larm']) {
        s.fill(a, 0, 'front,back,right,left', (x, y, w) => y < 5 ? (y === 4 ? d : metal(x, y, w, 5)) : null);
        s.fill(a, 0, 'top', metal);
        s.fill(a, 0, 'bottom', () => null);
      }
      // boots
      for (const g of ['rleg', 'lleg']) {
        s.fill(g, 0, 'front,back,right,left', (x, y, w) => y >= 8 ? (y === 8 ? l : y === 11 ? o : m) : null);
        s.fill(g, 0, 'bottom', () => o);
        s.fill(g, 0, 'top', () => null);
      }
    } else {
      s.fill('body', 0, 'front,back,right,left', (x, y) => y >= 8 ? (y === 8 ? l : (y === 11 ? d : m)) : null);
      s.fill('body', 0, 'bottom', metal);
      s.fill('body', 0, 'top', () => null);
      for (const g of ['rleg', 'lleg']) {
        s.fill(g, 0, 'front,back,right,left', (x, y, w) => y < 9 ? (y === 8 ? d : metal(x, y, w, 9)) : null);
        s.fill(g, 0, 'top', metal);
        s.fill(g, 0, 'bottom', () => null);
      }
      for (const k of ['head', 'rarm', 'larm']) s.fill(k, 0, 'all', () => null);
    }
    return s.done();
  }

  M.buildSkins = function () {
    SKINS.player = paintPlayer();
    SKINS.zombie = paintZombie();
    SKINS.skeleton = paintSkeleton();
    SKINS.creeper = paintCreeper();
    SKINS.spider = paintSpider();
    SKINS.pig = paintPig();
    SKINS.cow = paintCow();
    SKINS.sheep = paintSheep();
    SKINS.chicken = paintChicken();
    for (const mat of M.ARMOR_MATS) {
      SKINS['armor1_' + mat] = paintArmor(1, mat);
      SKINS['armor2_' + mat] = paintArmor(2, mat);
    }
  };

  /* ------------------------------------------------------------ */
  /* Mesh building                                                */
  /* ------------------------------------------------------------ */
  const FACE_NORMAL = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  // Vertex: pos(3) uv(2) normal(3) = 8 floats. Positions in local (flipped, y-up) pixel space.
  M.buildMesh = function (name) {
    const mdl = MODELS[name];
    const L = layout(mdl);
    const parts = {};
    const verts = [];
    for (const pn in mdl.parts) {
      const part = mdl.parts[pn];
      const start = verts.length / 8;
      part.boxes.forEach((b, bi) => {
        const [x, y, z, w, h, d] = b;
        const inf = b[6] || 0;
        const mx0 = x - inf, mx1 = x + w + inf, my0 = y - inf, my1 = y + h + inf, mz0 = z - inf, mz1 = z + d + inf;
        const lx0 = -mx1, lx1 = -mx0, ly0 = -my1, ly1 = -my0;
        const [u0, v0] = L.uv[pn + ':' + bi];
        const rects = faceRects(b, u0, v0);
        for (let f = 0; f < 6; f++) {
          const fv = S.FACE_VERTS[f], fuv = S.FACE_UV, n = FACE_NORMAL[f];
          const [ru, rv, rw, rh] = rects[f];
          const q = [];
          for (let v = 0; v < 4; v++) {
            const c = fv[v];
            q.push([c[0] ? lx1 : lx0, c[1] ? ly1 : ly0, c[2] ? mz1 : mz0, (ru + fuv[v][0] * rw) / L.W, (rv + fuv[v][1] * rh) / L.H, n[0], n[1], n[2]]);
          }
          for (const k of [0, 1, 2, 0, 2, 3]) verts.push(...q[k]);
        }
      });
      parts[pn] = { start, count: verts.length / 8 - start, pivot: part.pivot, wool: !!part.wool, follow: part.follow };
    }
    return { data: new Float32Array(verts), parts, noCull: !!mdl.noCull, shadow: mdl.shadow || 0.5 };
  };

  /* ------------------------------------------------------------ */
  /* Poses                                                        */
  /* ------------------------------------------------------------ */
  // Returns { part: [rx, ry, rz, dx, dy, dz] }: radians in classic model space,
  // plus optional pivot offsets in model pixels.
  M.pose = function (name, e, pt) {
    const mdl = MODELS[name];
    const anim = mdl ? mdl.anim : name;
    const limb = e.limbSwing - e.limbSwingAmount * (1 - pt);
    let amt = e.prevLimbAmount + (e.limbSwingAmount - e.prevLimbAmount) * pt;
    if (amt > 1) amt = 1;
    const headYaw = -(e.headYawRel || 0);
    const headPitch = e.renderPitch || 0;
    const age = (e.age || 0) + pt;
    const o = {};
    const q = (a) => Math.cos(limb * 0.6662 + a) * 1.4 * amt;
    const swing = e.swingTicks >= 0 && e.swingTicks !== undefined ? Math.min(1, (e.swingTicks + pt) / 6) : (e.swingProgress || 0);
    if (anim === 'quad') {
      o.head = [headPitch, headYaw, 0];
      if (name === 'sheep' && e.eatTimer > 0) {
        const t = e.eatTimer - pt;
        let py;
        if (t >= 4 && t <= 36) py = 1; else if (t < 4) py = t / 4; else py = -(t - 40) / 4;
        let ax;
        if (t > 4 && t <= 36) { const f = (t - 4) / 32; ax = Math.PI / 5 + Math.PI * 7 / 100 * Math.sin(f * 28.7); }
        else ax = Math.PI / 5;
        o.head = [ax, 0, 0, 0, py * 9, 0];
      }
      o.body = [0, 0, 0];
      o.leg1 = [q(0), 0, 0]; o.leg2 = [q(Math.PI), 0, 0]; o.leg3 = [q(Math.PI), 0, 0]; o.leg4 = [q(0), 0, 0];
    } else if (anim === 'chicken') {
      o.head = [headPitch, headYaw, 0];
      o.body = [0, 0, 0];
      o.leg1 = [q(0), 0, 0]; o.leg2 = [q(Math.PI), 0, 0];
      const flap = e.onGround ? 0 : (Math.sin(age * 1.8) + 1) * 0.9;
      o.wing1 = [0, 0, flap]; o.wing2 = [0, 0, -flap];
    } else if (anim === 'biped' || anim === 'zombie') {
      o.head = [headPitch, headYaw, 0];
      o.body = [0, 0, 0];
      o.rarm = [Math.cos(limb * 0.6662 + Math.PI) * 2 * amt * 0.5, 0, 0];
      o.larm = [Math.cos(limb * 0.6662) * 2 * amt * 0.5, 0, 0];
      o.rleg = [Math.cos(limb * 0.6662) * 1.4 * amt, 0, 0];
      o.lleg = [Math.cos(limb * 0.6662 + Math.PI) * 1.4 * amt, 0, 0];
      if (anim === 'zombie') {
        const f8 = Math.sin(swing * Math.PI);
        const f9 = Math.sin((1 - (1 - swing) * (1 - swing)) * Math.PI);
        o.rarm = [-Math.PI / 2 - (f8 * 1.2 - f9 * 0.4), -(0.1 - f8 * 0.6), 0];
        o.larm = [-Math.PI / 2 - (f8 * 1.2 - f9 * 0.4), 0.1 - f8 * 0.6, 0];
      } else {
        if (e.heldItem) o.rarm[0] = o.rarm[0] * 0.5 - Math.PI / 10;
        if (swing > 0) {
          const by = Math.sin(Math.sqrt(swing) * Math.PI * 2) * 0.2;
          o.body[1] = by;
          // shoulders follow the body twist (pivot offsets relative to default pivots)
          o.rarm[3] = -Math.cos(by) * 5 + 5; o.rarm[5] = Math.sin(by) * 5;
          o.larm[3] = Math.cos(by) * 5 - 5; o.larm[5] = -Math.sin(by) * 5;
          o.rarm[1] += by; o.larm[1] += by; o.larm[0] += by;
          let f = 1 - swing; f *= f; f *= f; f = 1 - f;
          const f9 = Math.sin(f * Math.PI);
          const f10 = Math.sin(swing * Math.PI) * -(headPitch - 0.7) * 0.75;
          o.rarm[0] -= f9 * 1.2 + f10;
          o.rarm[1] += by * 2;
          o.rarm[2] = Math.sin(swing * Math.PI) * -0.4;
        }
        if (e.sneaking) {
          o.body[0] = 0.5;
          o.rarm[0] += 0.4; o.larm[0] += 0.4;
          o.rleg[4] = -3; o.rleg[5] = 4; o.lleg[4] = -3; o.lleg[5] = 4;
          o.head[4] = 1;
        }
      }
      // idle breathing sway
      const zs = Math.cos(age * 0.09) * 0.05 + 0.05, xs = Math.sin(age * 0.067) * 0.05;
      o.rarm[2] = (o.rarm[2] || 0) + zs; o.larm[2] = (o.larm[2] || 0) - zs;
      o.rarm[0] += xs; o.larm[0] -= xs;
    } else if (anim === 'creeper') {
      o.head = [headPitch, headYaw, 0];
      o.body = [0, 0, 0];
      o.leg1 = [q(0), 0, 0]; o.leg2 = [q(Math.PI), 0, 0]; o.leg3 = [q(Math.PI), 0, 0]; o.leg4 = [q(0), 0, 0];
    } else if (anim === 'spider') {
      o.head = [headPitch, headYaw, 0];
      o.neck = [0, 0, 0]; o.body = [0, 0, 0];
      const p4 = Math.PI / 4, p8 = Math.PI / 8;
      const z = [-p4, p4, -p4 * 0.74, p4 * 0.74, -p4 * 0.74, p4 * 0.74, -p4, p4];
      const y = [p8 * 2, -p8 * 2, p8, -p8, -p8, p8, -p8 * 2, p8 * 2];
      const a1 = -(Math.cos(limb * 0.6662 * 2) * 0.4) * amt, a2 = -(Math.cos(limb * 0.6662 * 2 + Math.PI) * 0.4) * amt;
      const a3 = -(Math.cos(limb * 0.6662 * 2 + Math.PI / 2) * 0.4) * amt, a4 = -(Math.cos(limb * 0.6662 * 2 + Math.PI * 1.5) * 0.4) * amt;
      const b1 = Math.abs(Math.sin(limb * 0.6662) * 0.4) * amt, b2 = Math.abs(Math.sin(limb * 0.6662 + Math.PI) * 0.4) * amt;
      const b3 = Math.abs(Math.sin(limb * 0.6662 + Math.PI / 2) * 0.4) * amt, b4 = Math.abs(Math.sin(limb * 0.6662 + Math.PI * 1.5) * 0.4) * amt;
      y[0] += a1; y[1] -= a1; y[2] += a2; y[3] -= a2; y[4] += a3; y[5] -= a3; y[6] += a4; y[7] -= a4;
      z[0] += b1; z[1] -= b1; z[2] += b2; z[3] -= b2; z[4] += b3; z[5] -= b3; z[6] += b4; z[7] -= b4;
      for (let i = 0; i < 8; i++) o['leg' + (i + 1)] = [0, y[i], z[i]];
    }
    return o;
  };
})();
