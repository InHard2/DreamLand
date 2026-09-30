/*
 * DreamLand - box-model rigs, procedural skins and animation poses.
 * Model space follows the classic convention: pixels, Y down, feet at y=24,
 * front of the creature towards -Z.
 */
(function () {
  const DL = window.DL;
  const S = DL.S;
  const M = DL.Models = {};

  // box: [x, y, z, w, h, d, u, v, inflate]
  const MODELS = {
    pig: {
      tex: [64, 32],
      parts: {
        head: { pivot: [0, 12, -6], boxes: [[-4, -4, -8, 8, 8, 8, 0, 0], [-2, 0, -9, 4, 3, 1, 16, 16]] },
        body: { pivot: [0, 0, 0], boxes: [[-5, 10, -8, 10, 8, 16, 28, 8]] },
        leg1: { pivot: [-3, 18, 7], boxes: [[-2, 0, -2, 4, 6, 4, 0, 16]] },
        leg2: { pivot: [3, 18, 7], boxes: [[-2, 0, -2, 4, 6, 4, 0, 16]] },
        leg3: { pivot: [-3, 18, -5], boxes: [[-2, 0, -2, 4, 6, 4, 0, 16]] },
        leg4: { pivot: [3, 18, -5], boxes: [[-2, 0, -2, 4, 6, 4, 0, 16]] }
      },
      quad: 1
    },
    cow: {
      tex: [64, 32],
      parts: {
        head: { pivot: [0, 4, -8], boxes: [[-4, -4, -6, 8, 8, 6, 0, 0], [-5, -5, -4, 1, 3, 1, 22, 0], [4, -5, -4, 1, 3, 1, 22, 0]] },
        body: { pivot: [0, 0, 0], boxes: [[-6, 2, -8, 12, 10, 18, 18, 4], [-2, 12, 3, 4, 1, 6, 52, 0]] },
        leg1: { pivot: [-4, 12, 7], boxes: [[-2, 0, -2, 4, 12, 4, 0, 16]] },
        leg2: { pivot: [4, 12, 7], boxes: [[-2, 0, -2, 4, 12, 4, 0, 16]] },
        leg3: { pivot: [-4, 12, -6], boxes: [[-2, 0, -2, 4, 12, 4, 0, 16]] },
        leg4: { pivot: [4, 12, -6], boxes: [[-2, 0, -2, 4, 12, 4, 0, 16]] }
      },
      quad: 1
    },
    sheep: {
      tex: [64, 64],
      parts: {
        head: { pivot: [0, 6, -8], boxes: [[-3, -4, -6, 6, 6, 8, 0, 0]] },
        body: { pivot: [0, 0, 0], boxes: [[-4, 6, -8, 8, 6, 16, 28, 8]] },
        leg1: { pivot: [-3, 12, 7], boxes: [[-2, 0, -2, 4, 12, 4, 0, 16]] },
        leg2: { pivot: [3, 12, 7], boxes: [[-2, 0, -2, 4, 12, 4, 0, 16]] },
        leg3: { pivot: [-3, 12, -5], boxes: [[-2, 0, -2, 4, 12, 4, 0, 16]] },
        leg4: { pivot: [3, 12, -5], boxes: [[-2, 0, -2, 4, 12, 4, 0, 16]] },
        whead: { pivot: [0, 6, -8], boxes: [[-3, -4, -4, 6, 6, 6, 0, 32, 0.6]], wool: 1, follow: 'head' },
        wbody: { pivot: [0, 0, 0], boxes: [[-4, 6, -8, 8, 6, 16, 28, 40, 1.75]], wool: 1, follow: 'body' },
        wleg1: { pivot: [-3, 12, 7], boxes: [[-2, 0, -2, 4, 6, 4, 0, 48, 0.5]], wool: 1, follow: 'leg1' },
        wleg2: { pivot: [3, 12, 7], boxes: [[-2, 0, -2, 4, 6, 4, 0, 48, 0.5]], wool: 1, follow: 'leg2' },
        wleg3: { pivot: [-3, 12, -5], boxes: [[-2, 0, -2, 4, 6, 4, 0, 48, 0.5]], wool: 1, follow: 'leg3' },
        wleg4: { pivot: [3, 12, -5], boxes: [[-2, 0, -2, 4, 6, 4, 0, 48, 0.5]], wool: 1, follow: 'leg4' }
      },
      quad: 1
    },
    chicken: {
      tex: [64, 32],
      parts: {
        head: { pivot: [0, 15, -4], boxes: [[-2, -6, -2, 4, 6, 3, 0, 0], [-2, -4, -4, 4, 2, 2, 14, 0], [-1, -2, -3, 2, 2, 2, 14, 4]] },
        body: { pivot: [0, 0, 0], boxes: [[-3, 13, -4, 6, 6, 8, 0, 9]] },
        leg1: { pivot: [-2, 19, 1], boxes: [[-1, 0, -3, 3, 5, 3, 26, 0]] },
        leg2: { pivot: [1, 19, 1], boxes: [[-1, 0, -3, 3, 5, 3, 26, 0]] },
        wing1: { pivot: [-4, 13, 0], boxes: [[0, 0, -3, 1, 4, 6, 24, 13]] },
        wing2: { pivot: [4, 13, 0], boxes: [[-1, 0, -3, 1, 4, 6, 24, 13]] }
      }
    },
    biped: {
      tex: [64, 32],
      parts: {
        head: { pivot: [0, 0, 0], boxes: [[-4, -8, -4, 8, 8, 8, 0, 0]] },
        body: { pivot: [0, 0, 0], boxes: [[-4, 0, -2, 8, 12, 4, 16, 16]] },
        rarm: { pivot: [-5, 2, 0], boxes: [[-3, -2, -2, 4, 12, 4, 40, 16]] },
        larm: { pivot: [5, 2, 0], boxes: [[-1, -2, -2, 4, 12, 4, 48, 0]] },
        rleg: { pivot: [-2, 12, 0], boxes: [[-2, 0, -2, 4, 12, 4, 0, 16]] },
        lleg: { pivot: [2, 12, 0], boxes: [[-2, 0, -2, 4, 12, 4, 32, 0]] }
      }
    },
    skeleton: {
      tex: [64, 32],
      parts: {
        head: { pivot: [0, 0, 0], boxes: [[-4, -8, -4, 8, 8, 8, 0, 0]] },
        body: { pivot: [0, 0, 0], boxes: [[-4, 0, -2, 8, 12, 4, 16, 16]] },
        rarm: { pivot: [-5, 2, 0], boxes: [[-1, -2, -1, 2, 12, 2, 40, 16]] },
        larm: { pivot: [5, 2, 0], boxes: [[-1, -2, -1, 2, 12, 2, 48, 16]] },
        rleg: { pivot: [-2, 12, 0], boxes: [[-1, 0, -1, 2, 12, 2, 0, 16]] },
        lleg: { pivot: [2, 12, 0], boxes: [[-1, 0, -1, 2, 12, 2, 8, 16]] }
      }
    },
    creeper: {
      tex: [64, 32],
      parts: {
        head: { pivot: [0, 6, 0], boxes: [[-4, -8, -4, 8, 8, 8, 0, 0]] },
        body: { pivot: [0, 6, 0], boxes: [[-4, 0, -2, 8, 12, 4, 16, 16]] },
        leg1: { pivot: [-2, 18, 4], boxes: [[-2, 0, -2, 4, 6, 4, 0, 16]] },
        leg2: { pivot: [2, 18, 4], boxes: [[-2, 0, -2, 4, 6, 4, 0, 16]] },
        leg3: { pivot: [-2, 18, -4], boxes: [[-2, 0, -2, 4, 6, 4, 0, 16]] },
        leg4: { pivot: [2, 18, -4], boxes: [[-2, 0, -2, 4, 6, 4, 0, 16]] }
      }
    },
    spider: {
      tex: [64, 32],
      parts: {
        head: { pivot: [0, 15, -3], boxes: [[-4, -4, -8, 8, 8, 8, 32, 4]] },
        neck: { pivot: [0, 15, 0], boxes: [[-3, -3, -3, 6, 6, 6, 0, 0]] },
        body: { pivot: [0, 15, 9], boxes: [[-5, -4, -6, 10, 8, 12, 0, 12]] },
        leg1: { pivot: [-4, 15, 2], boxes: [[-15, -1, -1, 16, 2, 2, 18, 0]] },
        leg2: { pivot: [4, 15, 2], boxes: [[-1, -1, -1, 16, 2, 2, 18, 0]] },
        leg3: { pivot: [-4, 15, 1], boxes: [[-15, -1, -1, 16, 2, 2, 18, 0]] },
        leg4: { pivot: [4, 15, 1], boxes: [[-1, -1, -1, 16, 2, 2, 18, 0]] },
        leg5: { pivot: [-4, 15, 0], boxes: [[-15, -1, -1, 16, 2, 2, 18, 0]] },
        leg6: { pivot: [4, 15, 0], boxes: [[-1, -1, -1, 16, 2, 2, 18, 0]] },
        leg7: { pivot: [-4, 15, -1], boxes: [[-15, -1, -1, 16, 2, 2, 18, 0]] },
        leg8: { pivot: [4, 15, -1], boxes: [[-1, -1, -1, 16, 2, 2, 18, 0]] }
      }
    }
  };
  M.defs = MODELS;

  /* ------------------------------------------------------------ */
  /* UV unwrap: face rects for a box                              */
  /* ------------------------------------------------------------ */
  // Faces in local (post-flip, y-up) space using shared FACE order:
  // 0 bottom, 1 top, 2 front(-z), 3 back(+z), 4 entity-left (local -x), 5 entity-right (local +x)
  function faceRects(b) {
    const [, , , w, h, d, u, v] = b;
    return [
      [u + d + w, v, w, d],        // bottom
      [u + d, v, w, d],            // top
      [u + d, v + d, w, h],        // front
      [u + d * 2 + w, v + d, w, h],// back
      [u + d + w, v + d, d, h],    // left
      [u, v + d, d, h]             // right
    ];
  }
  M.faceRects = faceRects;

  /* ------------------------------------------------------------ */
  /* Skin painting                                                */
  /* ------------------------------------------------------------ */
  function Painter(w, h, seed) {
    this.w = w; this.h = h;
    this.c = DL.Tex.makeCanvas(w, h);
    this.ctx = this.c.getContext('2d');
    this.img = this.ctx.createImageData(w, h);
    this.r = new S.RNG(seed);
  }
  Painter.prototype.px = function (x, y, c, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 4;
    this.img.data[o] = c[0]; this.img.data[o + 1] = c[1]; this.img.data[o + 2] = c[2]; this.img.data[o + 3] = a === undefined ? 255 : a;
  };
  // fill a face rect with fn(x, y, fw, fh) -> color
  Painter.prototype.face = function (rect, fn) {
    const [u, v, fw, fh] = rect;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const c = fn(x, y, fw, fh);
      if (c) this.px(u + x, v + y, c, c[3]);
    }
  };
  Painter.prototype.box = function (b, fns) {
    const rects = faceRects(b);
    for (let f = 0; f < 6; f++) {
      const fn = fns[f] || fns.all;
      if (fn) this.face(rects[f], fn);
    }
  };
  Painter.prototype.noise = function (base, amt) {
    const f = 1 + (this.r.next() * 2 - 1) * amt;
    return [base[0] * f, base[1] * f, base[2] * f];
  };
  Painter.prototype.done = function () { this.ctx.putImageData(this.img, 0, 0); return this.c; };

  const SKINS = {};
  M.skins = SKINS;

  function paintPig() {
    const p = new Painter(64, 32, 11);
    const pink = [240, 158, 156], dark = [214, 128, 126];
    const m = MODELS.pig.parts;
    const flesh = () => p.noise(pink, 0.05);
    p.box(m.head.boxes[0], {
      all: flesh, 2: (x, y) => {
        if (y === 3 && (x === 1 || x === 6)) return [255, 255, 255];
        if (y === 3 && (x === 2 || x === 5)) return [20, 20, 20];
        if (y === 2 && x >= 1 && x <= 2) return dark;
        if (y === 2 && x >= 5 && x <= 6) return dark;
        return flesh();
      }
    });
    p.box(m.head.boxes[1], { all: () => p.noise([236, 146, 146], 0.04), 2: (x, y) => (y === 1 && (x === 0 || x === 3)) ? [150, 80, 80] : [248, 170, 168] });
    p.box(m.body.boxes[0], { all: flesh, 0: () => p.noise(dark, 0.05) });
    p.box(m.leg1.boxes[0], { all: flesh, 0: () => [120, 80, 70] , 2: (x, y) => y === 5 ? [150, 100, 90] : flesh() });
    return p.done();
  }
  function paintCow() {
    const p = new Painter(64, 32, 12);
    const brown = [70, 52, 42], white = [236, 236, 236];
    const m = MODELS.cow.parts;
    const spot = (x, y) => ((Math.sin(x * 0.9 + y * 0.4) + Math.cos(x * 0.3 - y * 0.8)) > 0.3 ? p.noise(white, 0.04) : p.noise(brown, 0.08));
    p.box(m.head.boxes[0], {
      all: (x, y) => p.noise(brown, 0.08),
      2: (x, y) => {
        if (y === 2 && (x === 1 || x === 6)) return [20, 20, 20];
        if (y === 2 && (x === 2 || x === 5)) return [255, 255, 255];
        if (y >= 5 && x >= 2 && x <= 5) return y === 6 && (x === 2 || x === 5) ? [60, 40, 40] : [200, 170, 160];
        if (x >= 3 && x <= 4 && y <= 3) return p.noise(white, 0.03);
        return p.noise(brown, 0.08);
      }
    });
    p.box(m.head.boxes[1], { all: () => [220, 220, 210] });
    p.box(m.body.boxes[0], { all: (x, y) => spot(x + 3, y), 1: (x, y) => spot(x, y + 5) });
    p.box(m.body.boxes[1], { all: () => [236, 160, 160] });
    p.box(m.leg1.boxes[0], { all: (x, y) => y > 8 ? p.noise(white, 0.03) : p.noise(brown, 0.08), 0: () => [50, 40, 30] });
    return p.done();
  }
  function paintSheep() {
    const p = new Painter(64, 64, 13);
    const skin = [218, 196, 186], wool = [236, 236, 236];
    const m = MODELS.sheep.parts;
    p.box(m.head.boxes[0], {
      all: () => p.noise(skin, 0.04),
      2: (x, y) => {
        if (y === 2 && (x === 1 || x === 4)) return [30, 30, 30];
        if (y === 2 && (x === 0 || x === 5)) return [255, 255, 255];
        if (y === 4 && x >= 2 && x <= 3) return [160, 110, 110];
        return p.noise(skin, 0.04);
      }
    });
    p.box(m.body.boxes[0], { all: () => p.noise(skin, 0.05) });
    p.box(m.leg1.boxes[0], { all: (x, y) => y > 9 ? [110, 90, 80] : p.noise(skin, 0.05) });
    const woolFn = () => p.noise(wool, 0.06);
    p.box(m.whead.boxes[0], { all: woolFn, 2: () => [0, 0, 0, 0] });
    p.box(m.wbody.boxes[0], { all: woolFn });
    p.box(m.wleg1.boxes[0], { all: woolFn, 0: () => [0, 0, 0, 0], 1: () => [0, 0, 0, 0] });
    return p.done();
  }
  function paintChicken() {
    const p = new Painter(64, 32, 14);
    const white = [242, 242, 242];
    const m = MODELS.chicken.parts;
    p.box(m.head.boxes[0], { all: () => p.noise(white, 0.03), 2: (x, y) => (y === 1 && (x === 0 || x === 3)) ? [20, 20, 20] : p.noise(white, 0.03) });
    p.box(m.head.boxes[1], { all: () => [250, 190, 40] });
    p.box(m.head.boxes[2], { all: () => [220, 30, 30] });
    p.box(m.body.boxes[0], { all: () => p.noise(white, 0.04) });
    p.box(m.leg1.boxes[0], { all: (x, y) => y >= 4 ? [230, 150, 40] : (x === 1 ? [230, 150, 40] : [0, 0, 0, 0]) });
    p.box(m.wing1.boxes[0], { all: () => p.noise([226, 226, 226], 0.04) });
    return p.done();
  }
  function paintBiped(opts) {
    const p = new Painter(64, 32, opts.seed);
    const m = MODELS.biped.parts;
    const skin = opts.skin, shirt = opts.shirt, pants = opts.pants, hair = opts.hair;
    p.box(m.head.boxes[0], {
      all: (x, y) => hair && y < 2 ? p.noise(hair, 0.06) : p.noise(skin, 0.04),
      1: () => hair ? p.noise(hair, 0.06) : p.noise(skin, 0.04),
      3: (x, y) => hair && y < 6 ? p.noise(hair, 0.06) : p.noise(skin, 0.04),
      4: (x, y) => hair && (y < 2 || (y < 4 && x > 4)) ? p.noise(hair, 0.06) : p.noise(skin, 0.04),
      5: (x, y) => hair && (y < 2 || (y < 4 && x < 3)) ? p.noise(hair, 0.06) : p.noise(skin, 0.04),
      2: opts.face
    });
    p.box(m.body.boxes[0], { all: () => p.noise(shirt, 0.05), 0: () => p.noise(pants, 0.05) });
    const arm = (x, y) => y < (opts.sleeve || 4) ? p.noise(shirt, 0.05) : p.noise(skin, 0.04);
    p.box(m.rarm.boxes[0], { all: arm, 0: () => p.noise(skin, 0.04), 1: () => p.noise(shirt, 0.05) });
    p.box(m.larm.boxes[0], { all: arm, 0: () => p.noise(skin, 0.04), 1: () => p.noise(shirt, 0.05) });
    const leg = (x, y) => y >= 10 && opts.shoes ? p.noise(opts.shoes, 0.05) : p.noise(pants, 0.05);
    p.box(m.rleg.boxes[0], { all: leg, 0: () => opts.shoes || pants });
    p.box(m.lleg.boxes[0], { all: leg, 0: () => opts.shoes || pants });
    return p.done();
  }
  function paintSkeleton() {
    const p = new Painter(64, 32, 16);
    const bone = [196, 196, 196], dark = [120, 120, 120], black = [30, 30, 30];
    const m = MODELS.skeleton.parts;
    p.box(m.head.boxes[0], {
      all: () => p.noise(bone, 0.06),
      2: (x, y) => {
        if ((y === 3 || y === 4) && (x === 1 || x === 2 || x === 5 || x === 6)) return black;
        if (y === 5 && (x === 3 || x === 4)) return dark;
        if (y === 6 && x >= 1 && x <= 6) return x % 2 ? black : bone;
        return p.noise(bone, 0.06);
      }
    });
    p.box(m.body.boxes[0], {
      all: (x, y) => (y % 3 === 1 && x > 0 && x < 7) ? [0, 0, 0, 0] : (x === 3 || x === 4 ? p.noise(bone, 0.05) : (y % 3 === 1 ? [0, 0, 0, 0] : p.noise(bone, 0.05)))
    });
    const limb = () => p.noise(bone, 0.07);
    for (const k of ['rarm', 'larm', 'rleg', 'lleg']) p.box(m[k].boxes[0], { all: limb });
    return p.done();
  }
  function paintCreeper() {
    const p = new Painter(64, 32, 17);
    const greens = [[88, 178, 72], [70, 150, 58], [110, 196, 94], [50, 120, 44], [140, 210, 130]];
    const g = () => { const v = p.r.next(); return greens[v < 0.35 ? 0 : v < 0.6 ? 1 : v < 0.8 ? 2 : v < 0.93 ? 3 : 4]; };
    const m = MODELS.creeper.parts;
    const face = [
      '........',
      '........',
      '.kk..kk.',
      '.kk..kk.',
      '...kk...',
      '..kkkk..',
      '..kkkk..',
      '..k..k..'
    ];
    p.box(m.head.boxes[0], { all: g, 2: (x, y) => face[y][x] === 'k' ? [16, 16, 16] : g() });
    p.box(m.body.boxes[0], { all: g });
    p.box(m.leg1.boxes[0], { all: g, 0: () => [40, 90, 34] });
    return p.done();
  }
  function paintSpider() {
    const p = new Painter(64, 32, 18);
    const base = [52, 44, 38];
    const m = MODELS.spider.parts;
    const fur = () => p.noise(base, 0.2);
    p.box(m.head.boxes[0], {
      all: fur, 2: (x, y) => {
        if ((y === 2 || y === 3) && (x === 1 || x === 2 || x === 5 || x === 6)) return [220, 20, 20];
        if (y === 4 && (x === 0 || x === 7)) return [180, 10, 10];
        if (y === 1 && (x === 3 || x === 4)) return [200, 20, 20];
        return fur();
      }
    });
    p.box(m.neck.boxes[0], { all: fur });
    p.box(m.body.boxes[0], { all: (x, y) => ((x + y) % 5 === 0 ? p.noise([80, 60, 50], 0.1) : fur()) });
    p.box(m.leg1.boxes[0], { all: fur });
    return p.done();
  }

  M.buildSkins = function () {
    SKINS.pig = paintPig();
    SKINS.cow = paintCow();
    SKINS.sheep = paintSheep();
    SKINS.chicken = paintChicken();
    SKINS.zombie = paintBiped({
      seed: 15, skin: [88, 150, 72], shirt: [40, 150, 160], pants: [60, 60, 150], shoes: [70, 70, 70], hair: null, sleeve: 5,
      face: (x, y) => {
        if (y === 4 && (x === 1 || x === 2 || x === 5 || x === 6)) return [20, 30, 20];
        if (y === 6 && x >= 2 && x <= 5) return [50, 90, 40];
        return [88 + ((x * 13 + y * 7) % 11), 150 + ((x * 5 + y * 3) % 9), 72];
      }
    });
    SKINS.player = paintBiped({
      seed: 19, skin: [214, 164, 130], shirt: [44, 132, 196], pants: [54, 58, 112], shoes: [90, 76, 60], hair: [70, 44, 24], sleeve: 5,
      face: (x, y) => {
        if (y < 2) return [70, 44, 24];
        if (y === 4 && (x === 1 || x === 6)) return [255, 255, 255];
        if (y === 4 && (x === 2 || x === 5)) return [60, 90, 170];
        if (y === 6 && x >= 3 && x <= 4) return [150, 90, 80];
        if (y === 3 && x >= 1 && x <= 2) return [90, 60, 36];
        if (y === 3 && x >= 5 && x <= 6) return [90, 60, 36];
        return [214, 164, 130];
      }
    });
    SKINS.skeleton = paintSkeleton();
    SKINS.creeper = paintCreeper();
    SKINS.spider = paintSpider();
  };

  /* ------------------------------------------------------------ */
  /* Mesh building                                                */
  /* ------------------------------------------------------------ */
  // Vertex: pos(3 float) uv(2 float) shade(1 float) = 6 floats
  M.buildMesh = function (name) {
    const mdl = MODELS[name === 'zombie' || name === 'player' ? 'biped' : name];
    const [TW, TH] = mdl.tex;
    const parts = {};
    const verts = [];
    for (const pn in mdl.parts) {
      const part = mdl.parts[pn];
      const start = verts.length / 6;
      for (const b of part.boxes) {
        const [x, y, z, w, h, d] = b;
        const inf = b[8] || 0;
        // model space box -> local (flip x,y): x' = -x, y' = -y
        const mx0 = x - inf, mx1 = x + w + inf, my0 = y - inf, my1 = y + h + inf, mz0 = z - inf, mz1 = z + d + inf;
        const lx0 = -mx1, lx1 = -mx0, ly0 = -my1, ly1 = -my0;
        const rects = faceRects(b);
        for (let f = 0; f < 6; f++) {
          const fv = S.FACE_VERTS[f], fuv = S.FACE_UV;
          const [ru, rv, rw, rh] = rects[f];
          const quad = [];
          for (let v = 0; v < 4; v++) {
            const c = fv[v];
            const px = c[0] ? lx1 : lx0, py = c[1] ? ly1 : ly0, pz = c[2] ? mz1 : mz0;
            const u = (ru + fuv[v][0] * rw) / TW, vv = (rv + fuv[v][1] * rh) / TH;
            quad.push([px, py, pz, u, vv, S.FACE_SHADE[f]]);
          }
          for (const k of [0, 1, 2, 0, 2, 3]) verts.push(...quad[k]);
        }
      }
      parts[pn] = { start, count: verts.length / 6 - start, pivot: part.pivot, wool: !!part.wool, follow: part.follow };
    }
    return { data: new Float32Array(verts), parts };
  };

  /* ------------------------------------------------------------ */
  /* Poses                                                        */
  /* ------------------------------------------------------------ */
  // Returns { part: [rx, ry, rz] } in radians, classic conventions.
  M.pose = function (name, e, pt) {
    const limb = e.limbSwing - e.limbSwingAmount * (1 - pt);
    let amt = e.prevLimbAmount + (e.limbSwingAmount - e.prevLimbAmount) * pt;
    if (amt > 1) amt = 1;
    const headYaw = -(e.headYawRel || 0);
    const headPitch = e.renderPitch || 0;
    const age = (e.age || 0) + pt;
    const o = {};
    const q = (a) => Math.cos(limb * 0.6662 + a) * 1.4 * amt;
    if (name === 'pig' || name === 'cow' || name === 'sheep') {
      o.head = [headPitch, headYaw, 0];
      if (name === 'sheep' && e.eatTimer > 0) o.head[0] = 0.8;
      o.body = [0, 0, 0];
      o.leg1 = [q(0), 0, 0]; o.leg2 = [q(Math.PI), 0, 0]; o.leg3 = [q(Math.PI), 0, 0]; o.leg4 = [q(0), 0, 0];
      if (name === 'sheep') { o.whead = o.head; o.wbody = o.body; o.wleg1 = o.leg1; o.wleg2 = o.leg2; o.wleg3 = o.leg3; o.wleg4 = o.leg4; }
    } else if (name === 'chicken') {
      o.head = [headPitch, headYaw, 0];
      o.body = [0, 0, 0];
      o.leg1 = [q(0), 0, 0]; o.leg2 = [q(Math.PI), 0, 0];
      const flap = e.onGround ? 0 : (Math.sin(age * 1.8) + 1) * 0.9;
      o.wing1 = [0, 0, flap]; o.wing2 = [0, 0, -flap];
    } else if (name === 'biped' || name === 'zombie' || name === 'player' || name === 'skeleton') {
      o.head = [headPitch, headYaw, 0];
      o.body = [0, 0, 0];
      o.rarm = [Math.cos(limb * 0.6662 + Math.PI) * 2 * amt * 0.5, 0, 0];
      o.larm = [Math.cos(limb * 0.6662) * 2 * amt * 0.5, 0, 0];
      o.rleg = [Math.cos(limb * 0.6662) * 1.4 * amt, 0, 0];
      o.lleg = [Math.cos(limb * 0.6662 + Math.PI) * 1.4 * amt, 0, 0];
      if (name === 'zombie' || name === 'skeleton') {
        const swing = e.swingProgress ? Math.sin(e.swingProgress * Math.PI) : 0;
        const f1 = Math.sin((1 - (1 - swing) * (1 - swing)) * Math.PI);
        o.rarm = [-Math.PI / 2 - swing * 1.2 + f1 * 0.4, -(0.1 - swing * 0.6), 0];
        o.larm = [-Math.PI / 2 - swing * 1.2 + f1 * 0.4, 0.1 - swing * 0.6, 0];
        o.rarm[2] = Math.cos(age * 0.09) * 0.05 + 0.05; o.larm[2] = -(Math.cos(age * 0.09) * 0.05 + 0.05);
        o.rarm[0] += Math.sin(age * 0.067) * 0.05; o.larm[0] -= Math.sin(age * 0.067) * 0.05;
        if (name === 'skeleton' && e.aiming) { o.rarm = [-Math.PI / 2 + headPitch, -0.1 + headYaw, 0]; o.larm = [-Math.PI / 2 + headPitch, 0.1 + headYaw + 0.4, 0]; }
      } else {
        if (e.swingProgress > 0) {
          const sp = e.swingProgress;
          const bodyY = Math.sin(Math.sqrt(sp) * Math.PI * 2) * 0.2;
          o.body[1] = bodyY;
          const f = 1 - sp;
          const f2 = Math.sin((1 - f * f * f * f) * Math.PI);
          o.rarm[0] -= f2 * 1.2 + Math.sin(sp * Math.PI) * 0.75;
          o.rarm[1] += bodyY * 2;
        }
        if (e.sneaking) { o.body[0] = 0.5; o.rarm[0] += 0.4; o.larm[0] += 0.4; }
        if (e.heldItem) o.rarm[0] = o.rarm[0] * 0.5 - Math.PI / 10;
      }
    } else if (name === 'creeper') {
      o.head = [headPitch, headYaw, 0];
      o.body = [0, 0, 0];
      o.leg1 = [q(0), 0, 0]; o.leg2 = [q(Math.PI), 0, 0]; o.leg3 = [q(Math.PI), 0, 0]; o.leg4 = [q(0), 0, 0];
    } else if (name === 'spider') {
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

  M.meshName = function (type) {
    if (type === 'zombie' || type === 'player') return type;
    return type;
  };
})();
