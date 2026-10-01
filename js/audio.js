/*
 * DreamLand - procedural audio: synthesized sound effects and generative
 * ambient piano music. No sample files required.
 */
(function () {
  const DL = window.DL;
  const A = DL.Audio = {};
  let ctx = null, master = null, sfxGain = null, musicGain = null, reverb = null;
  const buffers = {};
  const SR = 22050;
  A.volume = { sound: 1, music: 0.6 };
  A.listener = { x: 0, y: 0, z: 0, yaw: 0 };
  A.ready = false;

  /* ------------------------------------------------------------ */
  /* DSP helpers                                                  */
  /* ------------------------------------------------------------ */
  let seed = 12345;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  function noise() { return rnd() * 2 - 1; }
  function Biquad(type, f, q) {
    const w = 2 * Math.PI * f / SR, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * (q || 0.707));
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  Biquad.prototype.run = function (x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  };
  Biquad.prototype.set = function (type, f, q) { const n = new Biquad(type, f, q); this.b0 = n.b0; this.b1 = n.b1; this.b2 = n.b2; this.a1 = n.a1; this.a2 = n.a2; };
  function gen(dur, fn) {
    const n = Math.floor(dur * SR);
    const d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = fn(i / SR, i, n);
    // normalise peak
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i]));
    if (pk > 0) for (let i = 0; i < n; i++) d[i] = d[i] / pk * 0.9;
    // tiny fade out
    for (let i = Math.max(0, n - 64); i < n; i++) d[i] *= (n - i) / 64;
    return d;
  }
  const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

  /* ------------------------------------------------------------ */
  /* Sound designs                                                */
  /* ------------------------------------------------------------ */
  const DESIGNS = {
    stone: (v) => { const bp = new Biquad('bp', 1400 + v * 300, 1.2), lp = new Biquad('lp', 4000); return gen(0.16, t => lp.run(bp.run(noise()) * env(t, 0.002, 0.035) * 2 + Math.sin(t * 2 * Math.PI * (110 + v * 20)) * env(t, 0.001, 0.02) * 0.6)); },
    wood: (v) => { const bp = new Biquad('bp', 500 + v * 120, 2.5); return gen(0.2, t => bp.run(noise()) * env(t, 0.002, 0.05) * 1.5 + (Math.sin(t * 2 * Math.PI * (190 + v * 25)) * 0.7 + Math.sin(t * 2 * Math.PI * (390 + v * 30)) * 0.3) * env(t, 0.001, 0.045)); },
    gravel: (v) => {
      const lp = new Biquad('lp', 2200), hp = new Biquad('hp', 200);
      const bursts = []; for (let i = 0; i < 9; i++) bursts.push([rnd() * 0.12, 0.004 + rnd() * 0.008, 0.4 + rnd() * 0.6]);
      return gen(0.18, t => { let s = 0; for (const [bt, bd, ba] of bursts) if (t >= bt && t < bt + bd * 4) s += noise() * ba * Math.exp(-(t - bt) / bd); return lp.run(hp.run(s)); });
    },
    grass: (v) => {
      const hp = new Biquad('hp', 1800), lp = new Biquad('lp', 7000);
      const cr = []; for (let i = 0; i < 26; i++) cr.push([rnd() * 0.13, 0.4 + rnd() * 0.6]);
      return gen(0.17, t => { let s = 0; for (const [bt, ba] of cr) if (t >= bt && t < bt + 0.006) s += noise() * ba * (1 - (t - bt) / 0.006); return lp.run(hp.run(s)) * env(t, 0.005, 0.08); });
    },
    sand: (v) => { const bp = new Biquad('bp', 2800 + v * 400, 0.6); return gen(0.2, t => bp.run(noise()) * env(t, 0.02, 0.06) * (0.6 + 0.4 * Math.sin(t * 180))); },
    cloth: (v) => { const lp = new Biquad('lp', 900 + v * 100); return gen(0.18, t => lp.run(noise()) * env(t, 0.015, 0.05)); },
    snow: (v) => { const bp = new Biquad('bp', 1600 + v * 200, 0.8); return gen(0.18, t => bp.run(noise()) * env(t, 0.01, 0.05) * (0.7 + 0.3 * Math.sin(t * 400))); },
    metal: (v) => { const bp = new Biquad('bp', 3000, 3); return gen(0.3, t => bp.run(noise()) * env(t, 0.001, 0.02) + Math.sin(t * 2 * Math.PI * (1180 + v * 60)) * env(t, 0.001, 0.09) * 0.5 + Math.sin(t * 2 * Math.PI * 2750) * env(t, 0.001, 0.05) * 0.2); },
    glass: (v) => {
      const hp = new Biquad('hp', 2500);
      const pings = []; for (let i = 0; i < 7; i++) pings.push([rnd() * 0.12, 2200 + rnd() * 3800]);
      return gen(0.45, t => { let s = hp.run(noise()) * env(t, 0.001, 0.03) * 0.8; for (const [pt, f] of pings) if (t > pt) s += Math.sin((t - pt) * 2 * Math.PI * f) * Math.exp(-(t - pt) / 0.05) * 0.5; return s; });
    },
    click: () => { const bp = new Biquad('bp', 2400, 2); return gen(0.05, t => bp.run(noise()) * env(t, 0.0005, 0.006) + Math.sin(t * 2 * Math.PI * 1300) * env(t, 0.0005, 0.01) * 0.6); },
    pop: () => gen(0.09, t => Math.sin(2 * Math.PI * (500 * t + 3500 * t * t)) * env(t, 0.002, 0.03)),
    hurt: () => {
      const f1 = new Biquad('bp', 650, 4), f2 = new Biquad('bp', 1100, 5), f3 = new Biquad('bp', 2400, 6);
      let ph = 0;
      return gen(0.3, (t) => {
        const f = 150 - t * 120;
        ph += f / SR;
        const saw = (ph % 1) * 2 - 1;
        const s = saw + noise() * 0.15;
        return (f1.run(s) * 1.0 + f2.run(s) * 0.6 + f3.run(s) * 0.2) * env(t, 0.01, 0.07) * (t < 0.25 ? 1 : 0);
      });
    },
    fallsmall: () => { const lp = new Biquad('lp', 600); return gen(0.25, t => lp.run(noise()) * env(t, 0.002, 0.05) + Math.sin(t * 2 * Math.PI * 80) * env(t, 0.001, 0.06)); },
    fallbig: () => { const lp = new Biquad('lp', 400); return gen(0.45, t => lp.run(noise()) * env(t, 0.002, 0.1) + Math.sin(t * 2 * Math.PI * 55) * env(t, 0.001, 0.12)); },
    break: () => { const bp = new Biquad('bp', 2000, 1.5); return gen(0.25, t => bp.run(noise()) * env(t, 0.001, 0.05) + Math.sin(t * 2 * Math.PI * 900) * env(t, 0.001, 0.04) * 0.3); },
    pig: (v) => voice({ f0: 220 + v * 30, f1: 190, dur: 0.22, formants: [[700, 5], [1400, 6]], rough: 0.5, reps: v % 2 ? 2 : 1, gap: 0.08 }),
    pighurt: () => voice({ f0: 340, f1: 280, dur: 0.25, formants: [[900, 5], [1800, 6]], rough: 0.4 }),
    pigdeath: () => voice({ f0: 320, f1: 150, dur: 0.5, formants: [[800, 4], [1600, 6]], rough: 0.5 }),
    cow: (v) => voice({ f0: 120 + v * 10, f1: 100, dur: 1.0, formants: [[350, 3], [650, 5]], sweep: [[300, 700], [500, 1000]], vib: 5, rough: 0.2 }),
    cowhurt: () => voice({ f0: 170, f1: 130, dur: 0.4, formants: [[500, 4], [900, 5]], rough: 0.3 }),
    cowdeath: () => voice({ f0: 150, f1: 90, dur: 0.8, formants: [[450, 4], [800, 5]], rough: 0.3 }),
    sheep: (v) => voice({ f0: 330 + v * 30, f1: 300, dur: 0.6, formants: [[850, 5], [1300, 6]], vib: 9, vibDepth: 0.06, rough: 0.2 }),
    sheephurt: () => voice({ f0: 420, f1: 360, dur: 0.3, formants: [[900, 5], [1500, 6]], vib: 12, vibDepth: 0.08 }),
    sheepdeath: () => voice({ f0: 380, f1: 250, dur: 0.6, formants: [[850, 5], [1300, 6]], vib: 10, vibDepth: 0.08 }),
    chicken: (v) => {
      const chirps = [[0, 1100 + v * 100], [0.09, 900 + v * 80], [0.17, 1300]];
      const bp = new Biquad('bp', 1500, 2);
      return gen(0.3, t => { let s = 0; for (const [ct, f] of chirps) if (t >= ct && t < ct + 0.06) { const tt = t - ct; s += Math.sign(Math.sin(2 * Math.PI * f * tt * (1 - tt * 3))) * Math.sin(Math.PI * tt / 0.06); } return bp.run(s); });
    },
    chickenhurt: () => { const bp = new Biquad('bp', 2000, 2); return gen(0.25, t => bp.run(Math.sign(Math.sin(2 * Math.PI * (1600 - t * 2000) * t)) + noise() * 0.3) * env(t, 0.005, 0.08)); },
    chickendeath: () => { const bp = new Biquad('bp', 1800, 2); return gen(0.35, t => bp.run(Math.sign(Math.sin(2 * Math.PI * (1500 - t * 1800) * t)) + noise() * 0.3) * env(t, 0.005, 0.12)); },
    zombie: (v) => voice({ f0: 85 + v * 8, f1: 70, dur: 1.3, formants: [[400, 3], [900, 4]], sweep: [[300, 500], [700, 1000]], vib: 3, vibDepth: 0.08, rough: 0.8, breath: 0.4 }),
    zombiehurt: () => voice({ f0: 120, f1: 90, dur: 0.45, formants: [[500, 3], [1000, 4]], rough: 0.8, breath: 0.3 }),
    zombiedeath: () => voice({ f0: 110, f1: 50, dur: 1.0, formants: [[450, 3], [900, 4]], rough: 0.9, breath: 0.4 }),
    skeleton: () => {
      const bp = new Biquad('bp', 2200, 3);
      const clacks = []; for (let i = 0; i < 10; i++) clacks.push(i * 0.045 + rnd() * 0.02);
      return gen(0.55, t => { let s = 0; for (const c of clacks) if (t >= c && t < c + 0.012) s += noise() * (1 - (t - c) / 0.012) + Math.sin((t - c) * 2 * Math.PI * 1800) * 0.5; return bp.run(s); });
    },
    skeletonhurt: () => { const bp = new Biquad('bp', 2600, 3); return gen(0.3, t => bp.run(noise() * ((t * 60) % 1 < 0.3 ? 1 : 0)) * env(t, 0.001, 0.1)); },
    skeletondeath: () => { const bp = new Biquad('bp', 2000, 2); return gen(0.7, t => bp.run(noise() * ((t * 40) % 1 < 0.25 ? 1 : 0)) * env(t, 0.001, 0.25)); },
    spider: () => { const bp = new Biquad('bp', 3200, 1.5); return gen(0.6, t => bp.run(noise()) * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 28)) * env(t, 0.05, 0.25)); },
    spiderhurt: () => { const bp = new Biquad('bp', 3600, 1.5); return gen(0.3, t => bp.run(noise()) * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 40)) * env(t, 0.005, 0.1)); },
    spiderdeath: () => { const bp = new Biquad('bp', 2800, 1.5); return gen(0.7, t => bp.run(noise()) * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 22)) * env(t, 0.01, 0.25)); },
    hurtmob: () => { const lp = new Biquad('lp', 1200); return gen(0.2, t => lp.run(noise()) * env(t, 0.002, 0.05)); },
    villager: (v) => voice({ f0: 150 + v * 15, f1: 120, dur: 0.45, formants: [[500, 4], [1100, 5]], sweep: [[400, 700], [900, 1300]], rough: 0.2 }),
    villagerhurt: () => voice({ f0: 190, f1: 150, dur: 0.3, formants: [[600, 4], [1200, 5]], rough: 0.3 }),
    villagerdeath: () => voice({ f0: 170, f1: 90, dur: 0.6, formants: [[550, 4], [1100, 5]], rough: 0.3 }),
    enderman: () => { const bp = new Biquad('bp', 700, 3); return gen(1.2, t => bp.run(noise() * 0.6 + Math.sin(2 * Math.PI * (90 + Math.sin(t * 13) * 30) * t)) * env(t, 0.1, 0.4)); },
    endermanhurt: () => { const bp = new Biquad('bp', 900, 3); return gen(0.5, t => bp.run(noise() * 0.6 + Math.sin(2 * Math.PI * (160 - t * 90) * t)) * env(t, 0.01, 0.15)); },
    endermandeath: () => { const bp = new Biquad('bp', 600, 3); return gen(1.5, t => bp.run(noise() * 0.6 + Math.sin(2 * Math.PI * (120 - t * 50) * t)) * env(t, 0.05, 0.5)); },
    ghast: (v) => voice({ f0: 420 + v * 40, f1: 300, dur: 1.2, formants: [[900, 3], [1800, 4]], vib: 7, vibDepth: 0.1, breath: 0.5 }),
    ghasthurt: () => voice({ f0: 700, f1: 500, dur: 0.5, formants: [[1200, 3], [2400, 4]], breath: 0.4 }),
    ghastdeath: () => voice({ f0: 600, f1: 200, dur: 1.2, formants: [[1000, 3], [2000, 4]], breath: 0.5 }),
    shoot: () => { const lp = new Biquad('lp', 900); return gen(0.6, t => lp.run(noise()) * env(t, 0.02, 0.18)); },
    blaze: () => { const bp = new Biquad('bp', 500, 1.5); return gen(1.0, t => bp.run(noise()) * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 9)) * env(t, 0.1, 0.35)); },
    blazehurt: () => { const bp = new Biquad('bp', 1500, 2); return gen(0.3, t => bp.run(noise()) * env(t, 0.005, 0.08)); },
    blazedeath: () => { const bp = new Biquad('bp', 800, 1.5); return gen(1.0, t => bp.run(noise()) * env(t, 0.01, 0.3)); },
    roar: () => { const lp = new Biquad('lp', 700); return gen(2.2, t => lp.run(noise() * 0.7 + Math.sin(2 * Math.PI * (70 + Math.sin(t * 7) * 20) * t) * 0.8) * Math.min(1, t * 4) * Math.exp(-t * 1.2)); },
    portal: () => { const bp = new Biquad('bp', 800, 1.2); return gen(2.5, t => bp.run(noise()) * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * (2 + t * 3))) * Math.min(1, t) * Math.exp(-t * 0.6)); },
    teleport: () => gen(0.5, t => Math.sin(2 * Math.PI * (300 + t * 1400) * t) * env(t, 0.01, 0.15)),
    slime: () => { const lp = new Biquad('lp', 500); return gen(0.25, t => lp.run(noise()) * env(t, 0.005, 0.06) + Math.sin(2 * Math.PI * (140 - t * 200) * t) * env(t, 0.003, 0.08)); },
    wolf: () => voice({ f0: 520, f1: 380, dur: 0.18, formants: [[900, 4], [1900, 5]], rough: 0.6, reps: 2, gap: 0.12 }),
    bat: () => gen(0.1, t => Math.sin(2 * Math.PI * (4200 - t * 9000) * t) * env(t, 0.002, 0.02)),
    pgfire: () => { const bp = new Biquad('bp', 1800, 1.5); return gen(0.35, t => (Math.sin(2 * Math.PI * (1400 - t * 3200) * t) * 0.6 + bp.run(noise()) * 0.5) * env(t, 0.002, 0.08)); },
    pgopen: () => { const lp = new Biquad('lp', 1200); return gen(0.7, t => (lp.run(noise()) * 0.6 + Math.sin(2 * Math.PI * (220 + t * 260) * t) * 0.5) * Math.min(1, t * 20) * Math.exp(-t * 5)); },
    pgenter: () => { const bp = new Biquad('bp', 900, 1.2); return gen(0.5, t => (bp.run(noise()) * 0.7 + Math.sin(2 * Math.PI * (600 - t * 700) * t) * 0.4) * Math.min(1, t * 30) * Math.exp(-t * 7)); },
    pgfizzle: () => { const hp = new Biquad('hp', 2500); return gen(0.4, t => hp.run(noise()) * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 40)) * env(t, 0.003, 0.1)); },
    fuse: () => { const hp = new Biquad('hp', 2500), lp = new Biquad('lp', 9000); return gen(1.6, t => lp.run(hp.run(noise())) * Math.min(1, t / 0.4) * (t > 1.5 ? (1.6 - t) / 0.1 : 1) * (0.8 + 0.2 * Math.sin(t * 90))); },
    explode: () => {
      const lp = new Biquad('lp', 900), lp2 = new Biquad('lp', 160);
      return gen(2.4, t => lp.run(noise()) * env(t, 0.003, 0.35) * 0.9 + lp2.run(noise()) * env(t, 0.01, 0.6) * 2.5 + Math.sin(2 * Math.PI * (60 - t * 15) * t) * env(t, 0.002, 0.3) * 0.8);
    },
    bow: () => {
      const n = Math.floor(SR / 180);
      const line = new Float32Array(n); for (let i = 0; i < n; i++) line[i] = noise();
      let idx = 0;
      const hp = new Biquad('hp', 800);
      return gen(0.45, t => { const v = line[idx]; const nx = line[(idx + 1) % n]; line[idx] = (v + nx) * 0.497; idx = (idx + 1) % n; return v * env(t, 0.001, 0.12) + hp.run(noise()) * env(t, 0.005, 0.08) * 0.3; });
    },
    arrowhit: () => { const lp = new Biquad('lp', 1800); return gen(0.15, t => lp.run(noise()) * env(t, 0.001, 0.02) + Math.sin(t * 2 * Math.PI * 220) * env(t, 0.001, 0.03) * 0.6); },
    splash: () => {
      const bp = new Biquad('bp', 1400, 0.8), lp = new Biquad('lp', 3000);
      const bubbles = []; for (let i = 0; i < 12; i++) bubbles.push([0.05 + rnd() * 0.4, 400 + rnd() * 900]);
      return gen(0.6, t => { let s = bp.run(noise()) * env(t, 0.01, 0.12); for (const [bt, f] of bubbles) if (t > bt && t < bt + 0.05) s += Math.sin(2 * Math.PI * f * (t - bt) * (1 + (t - bt) * 8)) * Math.exp(-(t - bt) / 0.015) * 0.4; return lp.run(s); });
    },
    fizz: () => { const hp = new Biquad('hp', 4000); return gen(0.5, t => hp.run(noise()) * env(t, 0.005, 0.12)); },
    door: () => { const bp = new Biquad('bp', 350, 2); return gen(0.35, t => bp.run(noise()) * env(t, 0.002, 0.06) * 1.5 + Math.sin(t * 2 * Math.PI * (160 + Math.sin(t * 40) * 20)) * env(t, 0.03, 0.08) * 0.5); },
    chest: () => { const bp = new Biquad('bp', 600, 4); return gen(0.5, t => bp.run(noise()) * env(t, 0.05, 0.12) + Math.sin(t * 2 * Math.PI * (300 + t * 400)) * env(t, 0.05, 0.1) * 0.3); },
    eat: () => {
      const bp = new Biquad('bp', 1600, 1);
      return gen(0.5, t => { const ph = (t * 7) % 1; return bp.run(noise()) * (ph < 0.25 ? Math.sin(ph / 0.25 * Math.PI) : 0); });
    },
    burp: () => voice({ f0: 110, f1: 80, dur: 0.4, formants: [[500, 3], [900, 4]], rough: 0.9 }),
    lavapop: () => gen(0.12, t => Math.sin(2 * Math.PI * (300 - t * 1500) * t) * env(t, 0.001, 0.03)),
    cave: (v) => {
      const bp1 = new Biquad('bp', 300, 6), bp2 = new Biquad('bp', 700, 8);
      let ph = 0;
      return gen(4.5, t => {
        const f = 55 + v * 7 + Math.sin(t * 0.8) * 6;
        ph += f / SR;
        const s = ((ph % 1) * 2 - 1) * 0.5 + noise() * 0.6;
        bp1.set('bp', 250 + Math.sin(t * 0.9 + v) * 150, 6);
        return (bp1.run(s) + bp2.run(s) * 0.4) * Math.sin(Math.PI * Math.min(1, t / 4.5)) ;
      });
    }
  };
  function voice(o) {
    const fs = o.formants.map(([f, q]) => new Biquad('bp', f, q));
    let ph = 0;
    const reps = o.reps || 1, gap = o.gap || 0;
    const total = o.dur * reps + gap * (reps - 1);
    return gen(total, (t) => {
      const rep = Math.floor(t / (o.dur + gap));
      const tt = t - rep * (o.dur + gap);
      if (tt > o.dur) return 0;
      const k = tt / o.dur;
      let f = o.f0 + (o.f1 - o.f0) * k;
      if (o.vib) f *= 1 + Math.sin(tt * 2 * Math.PI * o.vib) * (o.vibDepth || 0.03);
      ph += f / SR;
      let s = (ph % 1) * 2 - 1;
      if (o.rough) s += Math.sin(ph * Math.PI * 2 * 0.5) * o.rough * 0.5;
      s += noise() * (o.breath || 0.08);
      if (o.sweep) fs.forEach((b, i) => { const sw = o.sweep[i]; if (sw) b.set('bp', sw[0] + (sw[1] - sw[0]) * Math.sin(k * Math.PI), o.formants[i][1]); });
      let out = 0; fs.forEach((b, i) => { out += b.run(s) * (i === 0 ? 1 : 0.6); });
      const e = Math.min(1, tt / 0.03) * Math.min(1, (o.dur - tt) / 0.08);
      return out * e;
    });
  }
  const VARIANTS = { stone: 4, wood: 4, gravel: 4, grass: 4, sand: 4, cloth: 4, snow: 4, metal: 2, glass: 3, pig: 3, cow: 3, sheep: 3, chicken: 3, zombie: 3, cave: 4 };

  function getBuffer(name) {
    const variants = VARIANTS[name] || 1;
    let list = buffers[name];
    if (!list) {
      list = [];
      const d = DESIGNS[name];
      if (!d) return null;
      for (let v = 0; v < variants; v++) {
        seed = 1000 + v * 7919 + name.length * 31;
        const data = d(v);
        const b = ctx.createBuffer(1, data.length, SR);
        b.copyToChannel ? b.copyToChannel(data, 0) : b.getChannelData(0).set(data);
        list.push(b);
      }
      buffers[name] = list;
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ------------------------------------------------------------ */
  /* Context & playback                                           */
  /* ------------------------------------------------------------ */
  A.unlock = function () {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain(); master.connect(ctx.destination);
        sfxGain = ctx.createGain(); sfxGain.connect(master);
        musicGain = ctx.createGain(); musicGain.connect(master);
        reverb = ctx.createConvolver();
        const len = ctx.sampleRate * 3.2;
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
        reverb.buffer = ir;
        const rg = ctx.createGain(); rg.gain.value = 0.55;
        reverb.connect(rg); rg.connect(musicGain);
        A.applyVolume();
        // warm up common buffers lazily in idle time
        const warm = ['click', 'pop', 'stone', 'grass', 'wood', 'gravel', 'sand', 'hurt'];
        let i = 0;
        const step = () => { if (i < warm.length) { getBuffer(warm[i++]); setTimeout(step, 30); } };
        setTimeout(step, 50);
      }
      if (ctx.state === 'suspended') ctx.resume();
      // iOS: play an empty buffer inside the gesture
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
      A.ready = true;
    } catch (e) { console.warn('audio unlock failed', e); }
  };
  A.applyVolume = function () {
    if (!ctx) return;
    sfxGain.gain.value = A.volume.sound;
    musicGain.gain.value = A.volume.music * 0.5;
  };
  A.setListener = function (x, y, z, yaw) { const l = A.listener; l.x = x; l.y = y; l.z = z; l.yaw = yaw; };

  /** Play a sound. pos may be null for UI sounds. */
  A.play = function (name, x, y, z, vol, pitch) {
    if (!ctx || !A.ready || A.volume.sound <= 0) return;
    const buf = getBuffer(name);
    if (!buf) return;
    vol = vol === undefined ? 1 : vol;
    let pan = 0;
    if (x !== null && x !== undefined) {
      const l = A.listener;
      const dx = x - l.x, dy = y - l.y, dz = z - l.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const range = 16 * Math.max(1, vol);
      if (d > range) return;
      vol *= Math.max(0, 1 - d / range);
      if (d > 0.1) {
        const rx = Math.cos(l.yaw), rz = -Math.sin(l.yaw);
        pan = Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8;
      }
    }
    if (vol <= 0.01) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.max(0.3, Math.min(3, pitch || 1));
    const g = ctx.createGain();
    g.gain.value = Math.min(1.5, vol) * 0.6;
    src.connect(g);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(sfxGain);
    } else g.connect(sfxGain);
    src.start();
  };

  /* ------------------------------------------------------------ */
  /* Generative music                                             */
  /* ------------------------------------------------------------ */
  const music = { playing: false, nextAt: 0, endAt: 0 };
  A.music = music;
  function pianoNote(time, midi, vel, dur) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(vel, time + 0.008);
    out.gain.exponentialRampToValueAtTime(vel * 0.4, time + 0.4);
    out.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    const partials = [[1, 1], [2, 0.45], [3, 0.2], [4, 0.1], [5.02, 0.05]];
    for (const [h, a] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * h * (1 + (Math.random() - 0.5) * 0.0015);
      const g = ctx.createGain();
      g.gain.setValueAtTime(a, time);
      g.gain.exponentialRampToValueAtTime(a * 0.02 + 0.0001, time + dur * (1.2 / h));
      o.connect(g); g.connect(out);
      o.start(time); o.stop(time + dur + 0.05);
    }
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    out.connect(lp);
    lp.connect(musicGain);
    lp.connect(reverb);
  }
  function composePiece() {
    const keys = [60, 62, 65, 67, 57, 55];
    const root = keys[Math.floor(Math.random() * keys.length)];
    const scales = [[0, 2, 4, 7, 9], [0, 2, 4, 6, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10], [0, 2, 4, 5, 7, 9, 11]];
    const scale = scales[Math.floor(Math.random() * scales.length)];
    const progs = [[0, 5, 3, 4], [0, 3, 5, 4], [0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 1, 4]];
    const prog = progs[Math.floor(Math.random() * progs.length)];
    const beat = 60 / (54 + Math.random() * 18);
    const bars = 12 + Math.floor(Math.random() * 8);
    const notes = [];
    const deg = (d, oct) => { const s = scale.length; const o = Math.floor(d / s); return root + scale[((d % s) + s) % s] + 12 * (o + (oct || 0)); };
    let melody = Math.floor(Math.random() * scale.length) + scale.length;
    for (let b = 0; b < bars; b++) {
      const chord = prog[b % prog.length];
      const t0 = b * beat * 4;
      // left hand: gentle arpeggio
      const arp = [deg(chord, -1), deg(chord + 2, -1), deg(chord + 4, -1), deg(chord + 2, -1)];
      for (let i = 0; i < 4; i++) if (Math.random() < 0.85) notes.push([t0 + i * beat, arp[i], 0.16, beat * 3.5]);
      // right hand melody, sparse
      for (let i = 0; i < 4; i++) {
        if (Math.random() < (b % 4 === 3 ? 0.25 : 0.5)) {
          melody += Math.floor(Math.random() * 5) - 2;
          melody = Math.max(scale.length, Math.min(scale.length * 3, melody));
          notes.push([t0 + i * beat + (Math.random() < 0.3 ? beat / 2 : 0), deg(melody, 0), 0.2, beat * 3]);
        }
      }
    }
    return { notes, length: bars * beat * 4 + 6 };
  }
  A.updateMusic = function (inGame) {
    if (!ctx || !A.ready) return;
    const now = ctx.currentTime;
    if (A.volume.music <= 0) { music.nextAt = Math.max(music.nextAt, now + 30); return; }
    if (!music.nextAt) music.nextAt = now + (inGame ? 20 + Math.random() * 40 : 4 + Math.random() * 6);
    if (now >= music.nextAt && now >= music.endAt) {
      const p = composePiece();
      const t0 = now + 0.3;
      for (const [t, midi, vel, dur] of p.notes) pianoNote(t0 + t, midi, vel, dur);
      music.endAt = t0 + p.length;
      music.nextAt = music.endAt + 120 + Math.random() * 240;
    }
  };
  A.stopMusic = function () {
    if (!ctx) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    setTimeout(() => {
      // rebuild music bus so scheduled notes stop
      const old = musicGain;
      musicGain = ctx.createGain(); musicGain.connect(master);
      reverb.disconnect();
      const rg = ctx.createGain(); rg.gain.value = 0.55; reverb.connect(rg); rg.connect(musicGain);
      old.disconnect();
      A.applyVolume();
      music.endAt = 0; music.nextAt = ctx.currentTime + 30 + Math.random() * 60;
    }, 1600);
  };
})();
