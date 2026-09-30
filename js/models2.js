/*
 * DreamLand - box models, skins and animations for the new creatures:
 * villagers, golems, illagers, wolves, rabbits, slimes, endermen, bats, bears,
 * Nether mobs, End mobs (shulker, endermite, the Ender Dragon, end crystals)
 * and the Aether's inhabitants.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, M = DL.Models;
  const D = M.defs, hex = M.hex, Skin = M.Skin;

  /* ------------------------------------------------------------ */
  /* Rigs (classic model space: pixels, Y down, feet at y=24)     */
  /* ------------------------------------------------------------ */
  const P = (pivot, boxes, extra) => Object.assign({ pivot, boxes }, extra || {});
  const legs4 = (y, x1, zb, zf, box) => ({
    leg1: P([-x1, y, zb], [box]), leg2: P([x1, y, zb], [box]), leg3: P([-x1, y, zf], [box]), leg4: P([x1, y, zf], [box])
  });
  const villagerParts = () => ({
    head: P([0, 0, 0], [[-4, -10, -4, 8, 10, 8], [-1, -3, -6, 2, 4, 2]]),
    body: P([0, 0, 0], [[-4, 0, -3, 8, 12, 6], [-4, 0, -3, 8, 18, 6, 0.5]]),
    arms: P([0, 3, -1], [[-4, 2, -2, 8, 4, 4], [-8, -2, -2, 4, 8, 4], [4, -2, -2, 4, 8, 4]]),
    rleg: P([-2, 12, 0], [[-2, 0, -2, 4, 12, 4]]),
    lleg: P([2, 12, 0], [[-2, 0, -2, 4, 12, 4]])
  });
  const illagerParts = () => ({
    head: P([0, 0, 0], [[-4, -10, -4, 8, 10, 8], [-1, -3, -6, 2, 4, 2]]),
    body: P([0, 0, 0], [[-4, 0, -3, 8, 12, 6]]),
    rarm: P([-5, 2, 0], [[-3, -2, -2, 4, 12, 4]]),
    larm: P([5, 2, 0], [[-1, -2, -2, 4, 12, 4]]),
    rleg: P([-2, 12, 0], [[-2, 0, -2, 4, 12, 4]]),
    lleg: P([2, 12, 0], [[-2, 0, -2, 4, 12, 4]])
  });
  const bipedParts = (head) => ({
    head: P([0, 0, 0], head || [[-4, -8, -4, 8, 8, 8]]),
    body: P([0, 0, 0], [[-4, 0, -2, 8, 12, 4]]),
    rarm: P([-5, 2, 0], [[-3, -2, -2, 4, 12, 4]]),
    larm: P([5, 2, 0], [[-1, -2, -2, 4, 12, 4]]),
    rleg: P([-2, 12, 0], [[-2, 0, -2, 4, 12, 4]]),
    lleg: P([2, 12, 0], [[-2, 0, -2, 4, 12, 4]])
  });
  const thin = (o) => {
    const p = bipedParts();
    p.rarm.boxes = [[-1, -2, -1, 2, 12, 2]]; p.larm.boxes = [[-1, -2, -1, 2, 12, 2]];
    p.rleg.boxes = [[-1, 0, -1, 2, 12, 2]]; p.lleg.boxes = [[-1, 0, -1, 2, 12, 2]];
    return Object.assign({ parts: p }, o);
  };
  function clone(parts) { return JSON.parse(JSON.stringify(parts)); }

  const NEW = {
    villager: { anim: 'villager', shadow: 0.5, parts: villagerParts() },
    witch: {
      anim: 'villager', shadow: 0.5, parts: Object.assign(villagerParts(), {
        hat: P([0, 0, 0], [[-5, -10.5, -5, 10, 2, 10], [-3.5, -14.5, -3.5, 7, 4, 7], [-2, -17.5, -2, 4, 3, 4], [-1, -19.5, -1, 2, 2, 2]], { follow: 'head' })
      })
    },
    pillager: { anim: 'zombie', shadow: 0.5, parts: illagerParts() },
    vindicator: { anim: 'biped', shadow: 0.5, parts: illagerParts() },
    iron_golem: {
      anim: 'golem', shadow: 1.0, parts: {
        head: P([0, -7, -2], [[-4, -12, -5.5, 8, 10, 8], [-1, -5, -7.5, 2, 4, 2]]),
        body: P([0, -7, 0], [[-9, -2, -6, 18, 12, 11], [-4.5, 10, -3, 9, 5, 6, 0.5]]),
        rarm: P([0, -7, 0], [[-13, -2.5, -3, 4, 30, 6]]),
        larm: P([0, -7, 0], [[9, -2.5, -3, 4, 30, 6]]),
        rleg: P([-4, 11, 0], [[-3.5, -3, -3, 6, 16, 5]]),
        lleg: P([5, 11, 0], [[-3.5, -3, -3, 6, 16, 5]])
      }
    },
    wolf: {
      anim: 'wolf', shadow: 0.5, parts: Object.assign({
        body: P([0, 0, 0], [[-3, 11, -4, 6, 6, 10]]),
        mane: P([0, 0, 0], [[-4, 10, -8, 8, 7, 5]]),
        head: P([0, 12.5, -8], [[-3, -3.5, -4, 6, 6, 4], [-1.5, -0.5, -7, 3, 3, 3], [-3, -5.5, -2, 2, 2, 1], [1, -5.5, -2, 2, 2, 1]]),
        tail: P([0, 12, 6], [[-1, 0, -1, 2, 8, 2]])
      }, legs4(17, 1.5, 5, -5, [-1, 0, -1, 2, 7, 2]))
    },
    rabbit: {
      anim: 'rabbit', shadow: 0.3, parts: {
        body: P([0, 0, 0], [[-2.5, 17, -3, 5, 5, 8]]),
        head: P([0, 17, -3], [[-2.5, -4, -4, 5, 4, 5], [-2, -9, -1, 1.5, 5, 1], [0.5, -9, -1, 1.5, 5, 1]]),
        leg1: P([-2, 21, 3], [[-1, 0, -3, 2, 3, 5]]),
        leg2: P([2, 21, 3], [[-1, 0, -3, 2, 3, 5]]),
        leg3: P([-1.5, 20, -2], [[-0.5, 0, -0.5, 1, 4, 1]]),
        leg4: P([1.5, 20, -2], [[-0.5, 0, -0.5, 1, 4, 1]]),
        tail: P([0, 18, 5], [[-1, -1, 0, 2, 2, 2]])
      }
    },
    slime: {
      anim: 'slime', shadow: 0.5, noCull: true, parts: {
        inner: P([0, 0, 0], [[-3, 17, -3, 6, 6, 6], [-3.3, 18, -3.5, 2, 2, 2], [1.3, 18, -3.5, 2, 2, 2], [0, 21, -3.5, 1, 1, 1]]),
        outer: P([0, 0, 0], [[-4, 16, -4, 8, 8, 8]])
      }
    },
    enderman: {
      anim: 'enderman', shadow: 0.5, parts: {
        head: P([0, -18, 0], [[-4, -8, -4, 8, 8, 8]]),
        body: P([0, -18, 0], [[-4, 0, -2, 8, 12, 4]]),
        rarm: P([-5, -16, 0], [[-1, -2, -1, 2, 30, 2]]),
        larm: P([5, -16, 0], [[-1, -2, -1, 2, 30, 2]]),
        rleg: P([-2, -6, 0], [[-1, 0, -1, 2, 30, 2]]),
        lleg: P([2, -6, 0], [[-1, 0, -1, 2, 30, 2]])
      }
    },
    bat: {
      anim: 'bat', shadow: 0.2, noCull: true, parts: {
        head: P([0, 12, 0], [[-3, -5, -3, 6, 5, 6], [-3.5, -8, -1, 2.5, 3, 1], [1, -8, -1, 2.5, 3, 1]]),
        body: P([0, 12, 0], [[-3, 0, -2, 6, 10, 4]]),
        rwing: P([-3, 13, 0], [[-12, 0, -0.5, 12, 10, 1]]),
        lwing: P([3, 13, 0], [[0, 0, -0.5, 12, 10, 1]])
      }
    },
    polar_bear: {
      anim: 'quad', shadow: 1.0, parts: Object.assign({
        head: P([0, 9, -10], [[-3.5, -3, -7, 7, 7, 7], [-2.5, 1, -10, 5, 3, 3], [-4.5, -4, -3, 2, 2, 1], [2.5, -4, -3, 2, 2, 1]]),
        body: P([0, 0, 0], [[-7, 5, -10, 14, 11, 22]])
      }, legs4(16, 4.5, 9, -7, [-2, 0, -2, 4, 8, 4]))
    },
    zombie_pigman: { anim: 'biped', shadow: 0.5, parts: bipedParts([[-4, -8, -4, 8, 8, 8], [-2, -4, -5, 4, 3, 1]]) },
    piglin: { anim: 'biped', shadow: 0.5, parts: bipedParts([[-5, -8, -4, 10, 8, 8], [-2, -4, -5, 4, 4, 1], [-7, -7, -1, 2, 5, 3], [5, -7, -1, 2, 5, 3], [-3, -1, -5, 1, 2, 1], [2, -1, -5, 1, 2, 1]]) },
    wither_skeleton: thin({ anim: 'biped', shadow: 0.6, noCull: true }),
    ghast: {
      anim: 'ghast', shadow: 1.0, parts: (() => {
        const p = { body: P([0, 16, 0], [[-8, -8, -8, 16, 16, 16]]) };
        const r = new S.RNG(1660);
        for (let i = 0; i < 9; i++) {
          const x = (((i % 3) - (Math.floor(i / 3) % 2) * 0.5 + 0.25) / 2 * 2 - 1) * 5;
          const z = (Math.floor(i / 3) / 2 * 2 - 1) * 5;
          p['t' + i] = P([x, 24, z], [[-1, 0, -1, 2, 7 + r.nextInt(7), 2]]);
        }
        return p;
      })()
    },
    blaze: {
      anim: 'blaze', shadow: 0.5, noCull: true, parts: (() => {
        const p = { head: P([0, 4, 0], [[-4, -4, -4, 8, 8, 8]]) };
        for (let i = 0; i < 12; i++) p['r' + i] = P([0, 0, 0], [[-1, 0, -1, 2, 8, 2]]);
        return p;
      })()
    },
    shulker: {
      anim: 'shulker', shadow: 0.6, parts: {
        base: P([0, 0, 0], [[-7.9, 16, -7.9, 15.8, 8, 15.8]]),
        head: P([0, 18, 0], [[-3, -6, -3, 6, 6, 6]]),
        lid: P([0, 24, 0], [[-8, -16, -8, 16, 12, 16]])
      }
    },
    endermite: {
      anim: 'mite', shadow: 0.2, parts: {
        s0: P([0, 0, 0], [[-2, 21, -4, 4, 3, 2]]),
        s1: P([0, 0, 0], [[-3, 20, -2, 6, 4, 5]]),
        s2: P([0, 0, 0], [[-1.5, 21, 3, 3, 3, 1]]),
        s3: P([0, 0, 0], [[-0.5, 22, 4, 1, 2, 1]])
      }
    },
    ender_dragon: {
      anim: 'dragon', shadow: 3.0, noCull: true, parts: (() => {
        const p = {
          body: P([0, 0, 0], [[-12, 0, -24, 24, 24, 48], [-1, -6, -20, 2, 6, 12], [-1, -6, -4, 2, 6, 12], [-1, -6, 12, 2, 6, 10]]),
          neck: P([0, 8, -24], [[-5, -5, -20, 10, 10, 20], [-1, -9, -16, 2, 4, 10]]),
          head: P([0, 6, -44], [[-8, -8, -16, 16, 16, 16], [-6, -4, -30, 12, 5, 14], [-5, -12, -10, 2, 4, 6], [3, -12, -10, 2, 4, 6], [-5, -6, -30, 2, 2, 4], [3, -6, -30, 2, 2, 4]]),
          jaw: P([0, 10, -58], [[-6, 0, -16, 12, 4, 16]]),
          rwing: P([-12, 4, -14], [[-56, -4, -4, 56, 8, 8], [-56, 0, 4, 56, 1, 44]]),
          lwing: P([12, 4, -14], [[0, -4, -4, 56, 8, 8], [0, 0, 4, 56, 1, 44]]),
          fleg1: P([-10, 20, -16], [[-3, 0, -3, 6, 16, 6]]),
          fleg2: P([10, 20, -16], [[-3, 0, -3, 6, 16, 6]]),
          rleg1: P([-12, 20, 16], [[-4, 0, -4, 8, 20, 8]]),
          rleg2: P([12, 20, 16], [[-4, 0, -4, 8, 20, 8]])
        };
        for (let i = 0; i < 8; i++) p['t' + i] = P([0, 10, 24 + i * 10], [[-5, -5, 0, 10, 10, 10], [-1, -9, 2, 2, 4, 6]]);
        return p;
      })()
    },
    end_crystal: {
      anim: 'crystal', shadow: 0.8, noCull: true, parts: {
        base: P([0, 0, 0], [[-6, 20, -6, 12, 4, 12]]),
        outer: P([0, 8, 0], [[-4, -4, -4, 8, 8, 8]]),
        inner: P([0, 8, 0], [[-3, -3, -3, 6, 6, 6]]),
        core: P([0, 8, 0], [[-2, -2, -2, 4, 4, 4]])
      }
    },
    moa: {
      anim: 'chicken', shadow: 0.5, parts: {
        head: P([0, 8, -5], [[-2, -11, -2, 4, 11, 4], [-2.5, -15, -5, 5, 5, 6], [-1.5, -13, -9, 3, 2, 4]]),
        body: P([0, 0, 0], [[-4, 6, -6, 8, 8, 12]]),
        wing1: P([-4, 7, -2], [[-1, 0, -4, 1, 6, 10]]),
        wing2: P([4, 7, -2], [[0, 0, -4, 1, 6, 10]]),
        tail: P([0, 8, 6], [[-3, -1, 0, 6, 3, 8]]),
        leg1: P([-2, 14, 0], [[-1, 0, -1, 2, 10, 2]]),
        leg2: P([2, 14, 0], [[-1, 0, -1, 2, 10, 2]])
      }
    },
    phyg: {
      anim: 'winged', shadow: 0.5, parts: Object.assign(clone(D.pig.parts), {
        wing1: P([-5, 11, -3], [[-10, 0, 0, 10, 1, 7]]), wing2: P([5, 11, -3], [[0, 0, 0, 10, 1, 7]])
      })
    },
    flying_cow: {
      anim: 'winged', shadow: 0.7, parts: Object.assign(clone(D.cow.parts), {
        wing1: P([-6, 3, -3], [[-12, 0, 0, 12, 1, 9]]), wing2: P([6, 3, -3], [[0, 0, 0, 12, 1, 9]])
      })
    },
    zephyr: {
      anim: 'zephyr', shadow: 0.8, parts: {
        body: P([0, 12, 0], [[-9, -6, -9, 18, 12, 18], [-11, -3, -6, 2, 8, 12], [9, -3, -6, 2, 8, 12], [-6, -8, -6, 12, 2, 12], [-6, 6, -6, 12, 2, 12]])
      }
    },
    slider: { anim: 'none', shadow: 1.0, parts: { body: P([0, 16, 0], [[-8, -8, -8, 16, 16, 16]]) } },
    guardian: {
      anim: 'guardian', shadow: 0.6, parts: {
        body: P([0, 16, 0], [[-6, -6, -8, 12, 12, 16], [-1, -7.5, -1, 2, 2, 2], [-1, 5.5, -1, 2, 2, 2], [-7.5, -1, -1, 2, 2, 2], [5.5, -1, -1, 2, 2, 2]]),
        eye: P([0, 16, -8], [[-1.5, -1.5, -0.6, 3, 3, 1]]),
        t0: P([0, 16, 8], [[-2, -2, 0, 4, 4, 8]]),
        t1: P([0, 16, 15], [[-1.5, -1.5, 0, 3, 3, 7]]),
        t2: P([0, 16, 21], [[-1, -1, 0, 2, 2, 6], [0, -4.5, 3, 1, 9, 9]])
      }
    }
  };
  for (const k in NEW) D[k] = NEW[k];
  M.newModels = Object.keys(NEW);

  /* ------------------------------------------------------------ */
  /* Skins                                                        */
  /* ------------------------------------------------------------ */
  const FACES = ['bottom', 'top', 'front', 'back', 'left', 'right'];
  const col = (c) => typeof c === 'string' ? hex(c) : c;
  /** Paint every box with a noisy base colour (per part), then run extra(s). */
  function paint(model, seed, colors, extra) {
    const s = new Skin(model, seed);
    const mdl = D[model];
    for (const pn in mdl.parts) {
      mdl.parts[pn].boxes.forEach((b, bi) => {
        const key = pn + ':' + bi;
        const c = key in colors ? colors[key] : pn in colors ? colors[pn] : colors._;
        if (c === null || c === undefined) { s.fill(pn, bi, 'all', () => [0, 0, 0, 0]); return; }
        const spec = Array.isArray(c) && typeof c[0] !== 'number' ? c : [c];
        const base = col(spec[0]), v = spec[1] === undefined ? 0.08 : spec[1];
        for (const f of FACES) {
          const k = f === 'top' ? 1.08 : f === 'bottom' ? 0.82 : 1;
          s.fill(pn, bi, f, () => { const j = 1 + (s.r.next() - 0.5) * 2 * v; return [Math.min(255, base[0] * k * j), Math.min(255, base[1] * k * j), Math.min(255, base[2] * k * j)]; });
        }
      });
    }
    if (extra) extra(s);
    return s.done();
  }
  /** Colour-transform another skin canvas. */
  function recolor(srcName, fn) {
    const src = M.skins[srcName];
    const c = DL.Tex.makeCanvas(src.width, src.height), ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const o = fn(d[i], d[i + 1], d[i + 2], i);
      d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  const lum = (r, g, b) => (r * 0.3 + g * 0.59 + b * 0.11) / 255;
  const tint = (c, l) => [Math.min(255, c[0] * l), Math.min(255, c[1] * l), Math.min(255, c[2] * l)];
  const border = (s, pn, bi, face, c, a) => {
    const [, , w, h] = s.rect(pn, bi, face);
    void w; void h;
    s.fill(pn, bi, face, (x, y, W, H) => (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? [c[0], c[1], c[2], a] : (s.r.next() < 0.12 ? [c[0] * 0.9, c[1] * 0.9, c[2] * 0.9, a] : [0, 0, 0, 0]));
  };
  const SP = M.skinPainters;

  const VROBES = ['#6b4a2b', '#e4e4dc', '#7a3d93', '#34343a', '#f0f0f0'];
  VROBES.forEach((robe, i) => {
    SP['villager_' + i] = () => paint('villager', 40 + i, {
      head: '#b48a6a', 'head:1': '#a07858', body: [i === 4 ? '#6b4a2b' : robe, 0.06], 'body:1': [robe, 0.07], arms: [robe, 0.07], rleg: '#4a3a2a', lleg: '#4a3a2a'
    }, (s) => {
      s.art('head', 0, 'front', ['........', '........', '........', '.bbbbbb.', '.WG..GW.', '........', '........', '........', '...mm...', '........'],
        { b: hex('#3a2a20'), W: hex('#f4f4f4'), G: hex('#2a8a3a'), m: hex('#7a4a3a') });
      if (i === 0) s.fill('head', 0, 'top', () => hex('#d8c070'));
      if (i === 3 || i === 4) s.fill('body', 1, 'front', (x, y, w, h) => y > 2 && x > 1 && x < w - 2 ? hex(i === 3 ? '#1a1a1a' : '#e8e8e8') : null);
    });
  });
  SP.witch = () => paint('witch', 50, { head: '#9aaa7a', 'head:1': '#8a9a6a', body: '#3a2a4a', 'body:1': ['#4a2a5a', 0.1], arms: '#4a2a5a', rleg: '#2a2030', lleg: '#2a2030', hat: ['#1e1e24', 0.1] }, (s) => {
    s.art('head', 0, 'front', ['........', '........', '........', '.bbbbbb.', '.WP..PW.', '........', '........', '........', '...mm...', '........'], { b: hex('#2a2a20'), W: hex('#e8e8e8'), P: hex('#7a3a9a'), m: hex('#4a3a3a') });
    s.fill('head', 1, 'front', (x, y) => x === 1 && y === 3 ? hex('#3a6a2a') : null);
    s.fill('hat', 0, 'left,right,front,back', (x, y) => y === 1 ? hex('#3a8a3a') : null);
  });
  const illager = (name, seed, coat) => () => paint(name, seed, { head: '#a4aaa4', 'head:1': '#949a94', body: coat, rarm: coat, larm: coat, rleg: '#2e2e36', lleg: '#2e2e36' }, (s) => {
    s.art('head', 0, 'front', ['kkkkkkkk', 'k......k', '........', '.bbbbbb.', '.WG..GW.', '........', '........', '........', '..mmmm..', '........'], { k: hex('#2a2a2a'), b: hex('#1e1e1e'), W: hex('#f0f0f0'), G: hex('#3a7a4a'), m: hex('#5a5a5a') });
    s.fill('head', 0, 'top,back,left,right', (x, y) => y < 3 ? hex('#2a2a2a') : null);
  });
  SP.pillager = illager('pillager', 51, '#3c3a48');
  SP.vindicator = illager('vindicator', 52, '#3a4a5a');
  SP.iron_golem = () => paint('iron_golem', 53, { _: ['#d4ccc2', 0.1], 'body:1': '#c8c0b6' }, (s) => {
    s.art('head', 0, 'front', ['........', '........', '........', '........', '.dddddd.', '.dRddRd.', '........', '........', '........', '........'], { d: hex('#8a847c'), R: hex('#c02020') });
    for (const f of ['front', 'back', 'left', 'right']) s.fill('body', 0, f, () => s.r.next() < 0.1 ? hex('#4a8a2a') : null);
    s.fill('rarm', 0, 'front,left,right,back', (x, y) => y > 20 && s.r.next() < 0.2 ? hex('#4a8a2a') : null);
  });
  const wolfSkin = (eyes, collar) => () => paint('wolf', 54, { _: ['#d6d2ca', 0.08], mane: ['#cac6be', 0.1], 'head:1': '#bcb8b0', tail: '#bdb9b1' }, (s) => {
    s.art('head', 0, 'front', ['......', '......', '.E..E.', '......', '......', '......'], { E: hex(eyes) });
    s.fill('head', 1, 'front', (x, y) => y === 0 && x === 1 ? hex('#1a1a1a') : null);
    s.fill('body', 0, 'top', () => hex('#9a948a'));
    if (collar) s.fill('mane', 0, 'front,left,right,top', (x, y, w, h, f) => (f === 'top' ? y === 0 : y === 1) ? hex('#c02828') : null);
  });
  SP.wolf = wolfSkin('#1a1a1a', false);
  SP.wolf_angry = wolfSkin('#e02020', false);
  SP.wolf_tame = wolfSkin('#1a1a1a', true);
  SP.rabbit = () => paint('rabbit', 55, { _: ['#8a6a4a', 0.1], tail: '#f0ece4', 'head:1': '#7a5a3a', 'head:2': '#7a5a3a' }, (s) => {
    s.art('head', 0, 'front', ['.....', '.E.E.', '.....', '..p..'], { E: hex('#1a1a1a'), p: hex('#e0a0a0') });
  });
  SP.aerbunny = () => paint('rabbit', 56, { _: ['#f4f4fa', 0.05], tail: '#ffffff' }, (s) => {
    s.art('head', 0, 'front', ['.....', '.E.E.', '.....', '..p..'], { E: hex('#6a4aa0'), p: hex('#f0a0c0') });
  });
  SP.slime = () => paint('slime', 57, { inner: ['#5aa84a', 0.1], 'inner:1': '#1a3a1a', 'inner:2': '#1a3a1a', 'inner:3': '#1a3a1a' }, (s) => {
    for (const f of FACES) border(s, 'outer', 0, f, hex('#7ec86a'), 220);
  });
  SP.magma_cube = () => paint('slime', 58, { inner: '#f0a020', 'inner:1': '#ffd040', 'inner:2': '#ffd040', 'inner:3': '#ffd040', outer: '#3a0a04' }, (s) => {
    for (const f of FACES) s.fill('outer', 0, f, (x, y) => (y % 3 === 1 ? (s.r.next() < 0.4 ? hex('#f08020') : hex('#8a2a0a')) : [58 + s.r.nextInt(20), 10, 4, 255]));
    s.fill('outer', 0, 'front', (x, y) => (y === 3 && (x === 1 || x === 2 || x === 5 || x === 6)) ? hex('#ffd040') : null);
  });
  SP.enderman = () => paint('enderman', 59, { _: ['#141414', 0.25] }, (s) => {
    s.art('head', 0, 'front', ['........', '........', '........', '........', 'PpP..PpP', '........', '........', '........'], { P: hex('#e070ff'), p: hex('#b030e0') });
  });
  SP.bat = () => paint('bat', 60, { _: ['#4a3a2a', 0.1], rwing: ['#2a1e16', 0.08], lwing: ['#2a1e16', 0.08] }, (s) => {
    s.art('head', 0, 'front', ['......', '.E..E.', '......', '..tt..', '......'], { E: hex('#101010'), t: hex('#e8e8e8') });
  });
  SP.polar_bear = () => paint('polar_bear', 61, { _: ['#f0f0ea', 0.05] }, (s) => {
    s.art('head', 0, 'front', ['.......', '.......', '.E...E.', '.......', '.......', '.......', '.......'], { E: hex('#1a1a1a') });
    s.fill('head', 1, 'front', (x, y) => y === 0 && x > 0 && x < 4 ? hex('#1a1a1a') : null);
  });
  SP.zombie_pigman = () => paint('zombie_pigman', 62, { _: ['#e8a0a0', 0.1], rleg: '#6a4a2a', lleg: '#6a4a2a', 'head:1': '#d08888' }, (s) => {
    s.art('head', 0, 'front', ['........', '........', '..rr....', '.WK..KW.', '........', '........', '........', '........'], { r: hex('#6a9a5a'), W: hex('#f0f0f0'), K: hex('#a01010') });
    s.fill('head', 1, 'front', (x, y) => y === 1 && (x === 1 || x === 2) ? hex('#7a3a3a') : null);
    for (const f of ['front', 'right']) s.fill('body', 0, f, (x, y) => (y > 3 && y < 8 && x % 2 === 0) ? hex('#e8e0d0') : (s.r.next() < 0.15 ? hex('#6a9a5a') : null));
    s.fill('rarm', 0, 'front,left,right,back', (x, y) => y > 6 ? hex('#e8e0d0') : null);
  });
  SP.piglin = () => paint('piglin', 63, { _: ['#e2a08e', 0.08], body: '#6a4a2a', rleg: '#4a3a2a', lleg: '#4a3a2a', 'head:4': '#f0f0e0', 'head:5': '#f0f0e0' }, (s) => {
    s.art('head', 0, 'front', ['..........', '..........', '..........', '.WK....KW.', '..........', '..........', '..........', '..........'], { W: hex('#f0f0f0'), K: hex('#3a2a20') });
    s.fill('head', 1, 'front', (x, y) => y === 1 && (x === 0 || x === 3) ? hex('#6a3a3a') : null);
    s.fill('body', 0, 'front', (x, y) => y === 7 ? hex('#e8c040') : null);
  });
  SP.wither_skeleton = () => recolor('skeleton', (r, g, b) => { const l = lum(r, g, b); return tint([48, 48, 50], 0.35 + l * 0.9); });
  SP.stray = () => recolor('skeleton', (r, g, b) => { const l = lum(r, g, b); return tint([170, 196, 204], 0.3 + l * 0.8); });
  SP.husk = () => recolor('zombie', (r, g, b) => (g > r && g > b) ? tint([190, 160, 110], 0.6 + lum(r, g, b) * 0.7) : tint([140, 110, 80], 0.5 + lum(r, g, b) * 0.9));
  SP.drowned = () => recolor('zombie', (r, g, b) => (g > r && g > b) ? tint([100, 170, 160], 0.6 + lum(r, g, b) * 0.6) : tint([60, 120, 110], 0.5 + lum(r, g, b) * 0.9));
  SP.sheepuff = () => recolor('sheep', (r, g, b) => (r > 200 && g > 200) ? [r * 0.72, g * 0.84, b] : [r, g, b]);
  const ghast = (open) => () => paint('ghast', 64, { _: ['#f0f0f0', 0.04] }, (s) => {
    const eyes = open ? ['................', '................', '................', '................', '..RRRR....RRRR..', '..RKKR....RKKR..', '..RRRR....RRRR..'] : ['................', '................', '................', '................', '................', '..kkkk....kkkk..', '................'];
    s.art('body', 0, 'front', eyes.concat(['................', '................', '................', '.....kkkkkk.....', '....k......k....', '.....kkkkkk.....']), { R: hex('#c02020'), K: hex('#101010'), k: hex('#7a7a7a') });
  });
  SP.ghast = ghast(false);
  SP.ghast_fire = ghast(true);
  SP.blaze = () => paint('blaze', 65, { _: ['#f0b830', 0.12], head: ['#e8b020', 0.15] }, (s) => {
    s.art('head', 0, 'front', ['........', '........', '.KK..KK.', '........', '..oooo..', '........', '........', '........'], { K: hex('#1a1a1a'), o: hex('#a05010') });
  });
  SP.shulker = () => paint('shulker', 66, { base: ['#8a5a8a', 0.06], lid: ['#a070a0', 0.06], head: '#e8dca8' }, (s) => {
    for (const f of ['front', 'back', 'left', 'right']) s.fill('lid', 0, f, (x, y) => y === 11 || (y > 3 && y < 8 && x % 4 === 1) ? hex('#6a3a6a') : null);
    s.art('head', 0, 'front', ['......', '......', '.K..K.', '......', '......', '......'], { K: hex('#2a2a2a') });
  });
  SP.endermite = () => paint('endermite', 67, { _: ['#3a2450', 0.2] });
  SP.silverfish = () => paint('endermite', 68, { _: ['#8a8a8e', 0.15] });
  SP.ender_dragon = () => paint('ender_dragon', 69, { _: ['#1a1a1c', 0.12], 'rwing:1': ['#262630', 0.1], 'lwing:1': ['#262630', 0.1], 'body:1': '#3a3a3e', 'body:2': '#3a3a3e', 'body:3': '#3a3a3e', 'neck:1': '#3a3a3e', 'head:2': '#4a4a4e', 'head:3': '#4a4a4e' }, (s) => {
    s.art('head', 0, 'front', ['................', '................', '................', '................', '................', '.PPPP......PPPP.', '.PWWP......PWWP.', '.PPPP......PPPP.'], { P: hex('#b040e0'), W: hex('#f0c0ff') });
    for (let i = 0; i < 8; i++) s.fill('t' + i, 1, 'all', () => hex('#3a3a3e'));
    for (const w of ['rwing', 'lwing']) s.fill(w, 1, 'top,bottom', (x, y) => (x % 14 === 0) ? hex('#141418') : null);
  });
  SP.end_crystal = () => paint('end_crystal', 70, { base: ['#4a4a4a', 0.25], core: ['#e050e0', 0.15] }, (s) => {
    for (const f of FACES) { border(s, 'outer', 0, f, hex('#f0d0f0'), 200); border(s, 'inner', 0, f, hex('#d0a0e0'), 180); }
  });
  const moa = (c, i) => { SP['moa_' + i] = () => paint('moa', 71 + i, { _: [c, 0.08], 'head:2': '#e8c040', leg1: '#8a8a70', leg2: '#8a8a70', tail: c }, (s) => {
    s.fill('head', 1, 'left,right', (x, y) => y === 1 && x === 1 ? hex('#1a1a1a') : null);
  }); };
  moa('#6aa0e0', 0); moa('#f0f0f0', 1); moa('#303038', 2);
  SP.phyg = () => paint('phyg', 74, { _: ['#f0a8a0', 0.06], 'head:1': '#e89890', wing1: '#fafafa', wing2: '#fafafa' }, (s) => {
    s.art('head', 0, 'front', ['........', '........', '.WK..KW.', '........', '........', '........', '........', '........'], { W: hex('#f0f0f0'), K: hex('#1a1a1a') });
    s.fill('head', 1, 'front', (x, y) => y === 1 && (x === 0 || x === 3) ? hex('#8a4a4a') : null);
  });
  SP.flying_cow = () => paint('flying_cow', 75, { _: ['#4a3624', 0.08], wing1: '#fafafa', wing2: '#fafafa', 'head:1': '#d8d0c0', 'head:2': '#d8d0c0' }, (s) => {
    for (const f of ['left', 'right', 'top']) s.fill('body', 0, f, (x, y) => ((x * 7 + y * 3) % 11 < 4) ? hex('#f0f0ea') : null);
    s.art('head', 0, 'front', ['........', '........', '.WK..KW.', '........', '..pppp..', '..pKKp..', '..pppp..', '........'], { W: hex('#f0f0f0'), K: hex('#1a1a1a'), p: hex('#d8a090') });
  });
  SP.zephyr = () => paint('zephyr', 76, { _: ['#e6ecf6', 0.05] }, (s) => {
    s.art('body', 0, 'front', ['..................', '..................', '...kkkk....kkkk...', '...kKKk....kKKk...', '...kkkk....kkkk...', '..................', '.......kkkk.......', '......k....k......', '.......kkkk.......'], { k: hex('#8a9ab0'), K: hex('#2a3a5a') });
  });
  const slider = (awake) => () => paint('slider', 77, { _: ['#9a9a9a', 0.15] }, (s) => {
    s.art('body', 0, 'front', ['................', '................', '................', '..ssssss.ssssss.', '..s' + (awake ? 'RRRR' : 'kkkk') + 's.s' + (awake ? 'RRRR' : 'kkkk') + 's.', '..ssssss.ssssss.', '................', '................', '................', '....ssssssss....', '....s......s....', '....ssssssss....'],
      { s: hex('#5a5a5a'), k: hex('#3a3a3a'), R: hex('#ff3030') });
    for (const f of ['back', 'left', 'right', 'top']) s.fill('body', 0, f, (x, y) => (x === 0 || y === 0 || x === 15 || y === 15) ? hex('#6a6a6a') : null);
  });
  SP.slider = slider(false);
  SP.slider_awake = slider(true);
  SP.guardian = () => paint('guardian', 78, { _: ['#6aa89a', 0.12], eye: '#e8e8d0', 'body:1': '#e8a050', 'body:2': '#e8a050', 'body:3': '#e8a050', 'body:4': '#e8a050', 't2:1': '#e8a050' }, (s) => {
    s.fill('eye', 0, 'front', (x, y) => x === 1 && y === 1 ? hex('#6a3a1a') : null);
    for (const f of FACES) s.fill('body', 0, f, (x, y) => (x + y) % 5 === 0 ? hex('#4a8a7a') : null);
  });

  /* ------------------------------------------------------------ */
  /* Animations                                                   */
  /* ------------------------------------------------------------ */
  const A = M.anims;
  A.none = ({ o }) => o;
  A.villager = ({ e, o, q, headYaw, headPitch, amt, limb }) => {
    o.head = [headPitch, headYaw, 0];
    o.body = [0, 0, 0];
    o.arms = [-0.75, 0, 0];
    o.rleg = [Math.cos(limb * 0.6662) * 1.4 * amt * 0.5, 0, 0];
    o.lleg = [Math.cos(limb * 0.6662 + Math.PI) * 1.4 * amt * 0.5, 0, 0];
    if (e.headShake > 0) o.head[2] = Math.sin(e.headShake * 1.2) * 0.3;
    void q;
    return o;
  };
  A.golem = ({ e, o, headYaw, headPitch, amt, limb, pt }) => {
    o.head = [headPitch, headYaw, 0];
    o.body = [0, 0, 0];
    const tri = (f, a) => (Math.abs(f % a - a * 0.5) - a * 0.25) / (a * 0.25);
    o.rleg = [-1.5 * tri(limb, 13) * amt, 0, 0];
    o.lleg = [1.5 * tri(limb, 13) * amt, 0, 0];
    const at = e.attackAnim > 0 ? e.attackAnim - pt : 0;
    if (at > 0) { const v = -2 + 1.5 * tri(at, 10); o.rarm = [v, 0, 0]; o.larm = [v, 0, 0]; }
    else { o.rarm = [(-0.2 + 1.5 * tri(limb, 13)) * amt, 0, 0]; o.larm = [(-0.2 - 1.5 * tri(limb, 13)) * amt, 0, 0]; }
    return o;
  };
  A.wolf = ({ e, o, q, headYaw, headPitch, age }) => {
    o.head = [headPitch, headYaw, e.tamed && e.sitting ? 0 : Math.sin(age * 0.1) * 0.03];
    o.body = [0, 0, 0]; o.mane = [0, 0, 0];
    o.leg1 = [q(0), 0, 0]; o.leg2 = [q(Math.PI), 0, 0]; o.leg3 = [q(Math.PI), 0, 0]; o.leg4 = [q(0), 0, 0];
    o.tail = [e.provoked ? 1.4 : 0.8 + Math.sin(age * 0.2) * (e.tamed ? 0.25 : 0.05), Math.sin(age * 0.5) * (e.tamed ? 0.4 : 0), 0];
    return o;
  };
  A.rabbit = ({ e, o, headYaw, headPitch }) => {
    o.head = [headPitch, headYaw, 0];
    o.body = [0, 0, 0];
    const air = e.onGround ? 0 : 1;
    o.leg1 = [-0.9 * air, 0, 0]; o.leg2 = [-0.9 * air, 0, 0];
    o.leg3 = [0.8 * air, 0, 0]; o.leg4 = [0.8 * air, 0, 0];
    o.tail = [0, 0, 0];
    return o;
  };
  A.slime = ({ o }) => { o.inner = [0, 0, 0]; o.outer = [0, 0, 0]; return o; };
  A.enderman = ({ e, o, headYaw, headPitch, limb, amt, swing }) => {
    o.head = [headPitch, headYaw, 0, 0, e.provoked ? -3 : 0, 0];
    o.body = [0, 0, 0];
    o.rarm = [Math.cos(limb * 0.6662 + Math.PI) * amt * 0.5, 0, 0.05];
    o.larm = [Math.cos(limb * 0.6662) * amt * 0.5, 0, -0.05];
    o.rleg = [Math.cos(limb * 0.6662) * 0.7 * amt, 0, 0];
    o.lleg = [Math.cos(limb * 0.6662 + Math.PI) * 0.7 * amt, 0, 0];
    if (swing > 0) o.rarm[0] -= Math.sin(swing * Math.PI) * 1.2;
    return o;
  };
  A.bat = ({ o, age, headYaw, headPitch }) => {
    const f = Math.sin(age * 1.3) * 1.1;
    o.head = [headPitch, headYaw, 0]; o.body = [0.2, 0, 0];
    o.rwing = [0, 0.3, f]; o.lwing = [0, -0.3, -f];
    return o;
  };
  A.ghast = ({ o, age }) => {
    o.body = [0, 0, 0];
    for (let i = 0; i < 9; i++) o['t' + i] = [0.2 * Math.sin(age * 0.3 + i) + 0.4, 0, 0];
    return o;
  };
  A.blaze = ({ o, age, headYaw, headPitch }) => {
    o.head = [headPitch, headYaw, 0];
    let a = age * Math.PI * -0.1;
    for (let i = 0; i < 4; i++) { o['r' + i] = [0, 0, 0, Math.cos(a) * 9, 2 + Math.cos((i * 2 + age) * 0.25), Math.sin(a) * 9]; a += Math.PI / 2; }
    a = Math.PI / 4 + age * Math.PI * 0.03;
    for (let i = 4; i < 8; i++) { o['r' + i] = [0, 0, 0, Math.cos(a) * 7, 8 + Math.cos((i * 2 + age) * 0.25), Math.sin(a) * 7]; a += Math.PI / 2; }
    a = 0.47123894 + age * Math.PI * -0.05;
    for (let i = 8; i < 12; i++) { o['r' + i] = [0, 0, 0, Math.cos(a) * 5, 13 + Math.cos((i * 1.5 + age) * 0.5), Math.sin(a) * 5]; a += Math.PI / 2; }
    return o;
  };
  A.shulker = ({ e, o, pt, headYaw, headPitch }) => {
    const p = (e.prevPeek || 0) + ((e.peek || 0) - (e.prevPeek || 0)) * pt;
    o.base = [0, 0, 0];
    o.lid = [0, p * Math.PI * 0.3, 0, 0, -p * 8, 0];
    o.head = [headPitch * 0.5, headYaw, 0, 0, -p * 3, 0];
    return o;
  };
  A.mite = ({ o, age, amt }) => {
    for (let i = 0; i < 4; i++) o['s' + i] = [0, Math.cos(age * 0.9 + i * 0.15 * Math.PI) * Math.PI * 0.05 * (1 + Math.abs(i - 2)) * (0.5 + amt), 0, Math.sin(age * 0.9 + i * 0.15 * Math.PI) * Math.PI * 0.2 * Math.abs(i - 2) * 0.3, 0, 0];
    return o;
  };
  A.dragon = ({ e, o, age }) => {
    const flap = Math.sin((e.flapTime || age * 0.12) * Math.PI * 2 * 0.25 + (e.flapTime ? 0 : 0));
    const fl = e.perched ? Math.sin(age * 0.05) * 0.1 - 0.4 : flap * 0.8;
    o.body = [0, 0, 0];
    o.neck = [0.1 + Math.sin(age * 0.07) * 0.05, 0, 0];
    o.head = [0, 0, 0, 0, Math.sin(age * 0.07) * 1.5, 0];
    o.jaw = [0, 0, 0, 0, Math.sin(age * 0.07) * 1.5, 0];
    if (e.jawOpen) o.jaw[0] = e.jawOpen * 0.5;
    o.rwing = [0, 0, fl]; o.lwing = [0, 0, -fl];
    o.fleg1 = o.fleg2 = [0.9 + Math.sin(age * 0.05) * 0.1, 0, 0];
    o.rleg1 = o.rleg2 = [1.1 + Math.sin(age * 0.05) * 0.1, 0, 0];
    for (let i = 0; i < 8; i++) o['t' + i] = [0, 0, 0, Math.sin(age * 0.08 - i * 0.5) * i * 1.4, i * 1.2 + Math.sin(age * 0.1 - i * 0.4) * i * 0.5, -i * 0.5];
    return o;
  };
  A.crystal = ({ o, age }) => {
    const r = age * 3 * Math.PI / 180, b = Math.sin(age * 0.2) / 2 + 0.5, dy = -(b * b + b) * 4;
    o.base = [0, 0, 0];
    o.outer = [0.785, r, 0.615, 0, dy, 0];
    o.inner = [-0.4, -r * 1.5, 0.785, 0, dy, 0];
    o.core = [0.615, r * 2, -0.785, 0, dy, 0];
    return o;
  };
  A.winged = ({ e, o, q, headYaw, headPitch, age }) => {
    o.head = [headPitch, headYaw, 0]; o.body = [0, 0, 0];
    o.leg1 = [q(0), 0, 0]; o.leg2 = [q(Math.PI), 0, 0]; o.leg3 = [q(Math.PI), 0, 0]; o.leg4 = [q(0), 0, 0];
    const f = e.onGround ? Math.sin(age * 0.1) * 0.1 + 0.2 : Math.sin(age * 0.6) * 0.8;
    o.wing1 = [0, 0, -f]; o.wing2 = [0, 0, f];
    return o;
  };
  A.zephyr = ({ o, age }) => { o.body = [0, 0, Math.sin(age * 0.1) * 0.05, 0, Math.sin(age * 0.15) * 1, 0]; return o; };
  A.guardian = ({ o, age, headYaw, headPitch }) => {
    o.body = [headPitch * 0.5, headYaw * 0.5, 0];
    o.eye = [0, 0, 0];
    for (let i = 0; i < 3; i++) o['t' + i] = [0, Math.sin(age * 0.3 - i) * 0.3 * (i + 1), 0];
    return o;
  };
})();
