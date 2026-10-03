/*
 * DreamLand - gear in 3D.
 *  - OreSpawn's great weapons (Big Bertha, Slice, the Royal Guardian Sword, the battle
 *    axes, hammers, the chainsaw and the guns) are held as real voxel models, built from
 *    blades, guards, grips and gems, instead of flat icons.
 *  - Every armour set looks like what it is made of (scales, gems, feathers, gold and
 *    red cloth) and has 3D parts of its own: crowns, horns, plumes, spikes, wings, capes.
 *  - The little you in the inventory wears your armour and holds what you hold.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, I = DL.Items, M = DL.Models, RP = DL.Renderer.prototype, E = DL.Entities;
  const hex = M.hex, D = M.defs;
  const P = (pivot, boxes) => ({ pivot, boxes });

  /* ============================================================ */
  /* Voxel item models                                            */
  /* ============================================================ */
  // boxes in pixels: [x0, y0, z0, x1, y1, z1, colour]; built upright (grip at y=0), then laid along
  // the item's diagonal like a Minecraft sword
  const MODELS = {};
  function sword(o) {
    const L = o.len, W = o.width, T = o.thick || 1, g = o.grip || 5, gw = o.guardW || W + 4, gt = o.guardT || 1.6;
    const bx = [];
    // pommel and grip with wraps
    bx.push([-1.2, -2, -1.2, 1.2, 0, 1.2, o.pommel || o.guard]);
    for (let y = 0; y < g; y++) bx.push([-0.8, y, -0.8, 0.8, y + 1, 0.8, y % 2 ? o.grip2 || o.gripC : o.gripC]);
    // guard
    bx.push([-gw / 2, g, -gt / 2 - 0.2, gw / 2, g + gt, gt / 2 + 0.2, o.guard]);
    if (o.gem) bx.push([-0.9, g + 0.1, -gt / 2 - 0.5, 0.9, g + gt - 0.1, gt / 2 + 0.5, o.gem]);
    if (o.guardTips) { bx.push([-gw / 2 - 1, g - 0.8, -0.7, -gw / 2, g + gt + 0.8, 0.7, o.guard2 || o.guard]); bx.push([gw / 2, g - 0.8, -0.7, gw / 2 + 1, g + gt + 0.8, 0.7, o.guard2 || o.guard]); }
    if (o.wings) { bx.push([-gw / 2 - 2.5, g + gt, -0.5, -gw / 2 + 0.5, g + gt + 2.5, 0.5, o.guard2 || o.guard]); bx.push([gw / 2 - 0.5, g + gt, -0.5, gw / 2 + 2.5, g + gt + 2.5, 0.5, o.guard2 || o.guard]); }
    // the blade: a thick core with bright edges and a darker fuller, tapering to a point
    const y0 = g + gt, tip = Math.max(2, W * 0.9);
    bx.push([-W / 2, y0, -T / 2, W / 2, y0 + L - tip, T / 2, o.blade]);
    bx.push([-W / 2 - 0.01, y0, -T / 2 + 0.2, -W / 2 + 0.6, y0 + L - tip, T / 2 - 0.2, o.edge || o.blade]);
    bx.push([W / 2 - 0.6, y0, -T / 2 + 0.2, W / 2 + 0.01, y0 + L - tip, T / 2 - 0.2, o.edge || o.blade]);
    if (W >= 2.5) bx.push([-0.4, y0 + 0.5, -T / 2 - 0.05, 0.4, y0 + L - tip - 1, T / 2 + 0.05, o.fuller || o.blade]);
    if (o.jagged) for (let y = y0 + 2; y < y0 + L - tip - 1; y += 3) { bx.push([-W / 2 - 1, y, -T / 2 + 0.2, -W / 2, y + 1.2, T / 2 - 0.2, o.edge]); bx.push([W / 2, y + 1.5, -T / 2 + 0.2, W / 2 + 1, y + 2.7, T / 2 - 0.2, o.edge]); }
    for (let k = 0; k < tip; k++) { const w = (W / 2) * (1 - (k + 1) / (tip + 1)); bx.push([-w, y0 + L - tip + k, -T / 2 + 0.1, w, y0 + L - tip + k + 1, T / 2 - 0.1, k % 2 ? o.edge || o.blade : o.blade]); }
    return { boxes: bx, origin: o.origin || [3, 3], scale: o.scale || 1 };
  }
  function axe(o) {
    const bx = [], H = o.len;
    for (let y = 0; y < H; y++) bx.push([-0.8, y, -0.8, 0.8, y + 1, 0.8, y % 3 === 0 ? o.grip2 || o.gripC : o.gripC]);
    bx.push([-1.1, -1.5, -1.1, 1.1, 0, 1.1, o.metal2 || o.metal]);
    const hy = H - o.head - 1;
    // two curved blades (double axe) or one
    for (const side of o.double ? [-1, 1] : [1]) {
      for (let k = 0; k < o.head; k++) {
        const reach = o.reach * (1 - Math.abs(k - o.head / 2) / (o.head / 1.4));
        bx.push(side > 0 ? [0.8, hy + k, -0.6, 0.8 + reach, hy + k + 1, 0.6, k === 0 || k === o.head - 1 ? o.metal2 || o.metal : o.metal] : [-0.8 - reach, hy + k, -0.6, -0.8, hy + k + 1, 0.6, k === 0 || k === o.head - 1 ? o.metal2 || o.metal : o.metal]);
      }
      bx.push(side > 0 ? [0.8 + o.reach - 0.6, hy, -0.7, 0.8 + o.reach, hy + o.head, 0.7, o.edge || o.metal] : [-0.8 - o.reach, hy, -0.7, -0.8 - o.reach + 0.6, hy + o.head, 0.7, o.edge || o.metal]);
    }
    bx.push([-1.2, hy - 0.5, -1.2, 1.2, hy + o.head + 0.5, 1.2, o.metal2 || o.metal]);
    if (o.spike) bx.push([-0.6, H, -0.6, 0.6, H + 3, 0.6, o.metal]);
    if (o.gem) bx.push([-0.7, hy + o.head / 2 - 0.7, -1.4, 0.7, hy + o.head / 2 + 0.7, 1.4, o.gem]);
    return { boxes: bx, origin: o.origin || [3, 3], scale: o.scale || 1 };
  }
  function hammer(o) {
    const bx = [], H = o.len;
    for (let y = 0; y < H; y++) bx.push([-0.8, y, -0.8, 0.8, y + 1, 0.8, y % 3 === 0 ? o.grip2 || o.gripC : o.gripC]);
    const hw = o.headW, hh = o.headH, hd = o.headD || hh;
    bx.push([-hw / 2, H, -hd / 2, hw / 2, H + hh, hd / 2, o.metal]);
    bx.push([-hw / 2 - 0.4, H + 0.6, -hd / 2 + 0.6, -hw / 2, H + hh - 0.6, hd / 2 - 0.6, o.metal2]);
    bx.push([hw / 2, H + 0.6, -hd / 2 + 0.6, hw / 2 + 0.4, H + hh - 0.6, hd / 2 - 0.6, o.metal2]);
    bx.push([-hw / 2 + 0.5, H + hh, -hd / 2 + 0.5, hw / 2 - 0.5, H + hh + 0.4, hd / 2 - 0.5, o.metal2]);
    if (o.spikes) for (const sx of [-hw / 2 - 1.2, hw / 2]) bx.push([sx, H + hh / 2 - 0.6, -0.6, sx + 1.2, H + hh / 2 + 0.6, 0.6, o.metal2]);
    return { boxes: bx, origin: o.origin || [3, 3], scale: o.scale || 1 };
  }
  // guns lie flat along x, grip down, muzzle to the right
  function gun(o) {
    const bx = [];
    bx.push([0, 0, -0.8, 2.2, 4, 0.8, o.grip]);
    bx.push([-1, 3.5, -1.3, o.len, 6.5, 1.3, o.body]);
    bx.push([o.len, 4.2, -0.9, o.len + o.barrel, 5.8, 0.9, o.barrelC]);
    if (o.rings) for (let x = 1; x < o.len; x += 2.5) bx.push([x, 3.3, -1.5, x + 0.8, 6.7, 1.5, o.trim]);
    bx.push([o.len * 0.4, 6.5, -0.6, o.len * 0.7, 7.6, 0.6, o.trim]);
    bx.push([2.4, 1.2, -0.3, 3.4, 3.5, 0.3, o.trim]);
    if (o.tube) bx.push([-1.5, 3, -1.8, 0, 7, 1.8, o.trim]);
    if (o.glow) bx.push([o.len + o.barrel - 0.4, 4.4, -1, o.len + o.barrel + 0.4, 5.6, 1, o.glow]);
    return { boxes: bx, flat: true, origin: o.origin || [1.5, 4], scale: o.scale || 1 };
  }
  function chainsaw() {
    const bx = [], C = { o: '#e86a1c', d: '#8a3a0c', k: '#2a2a2a', m: '#b8c0c8', t: '#e0e0e0' };
    bx.push([0, 2, -2, 7, 8, 2, C.o]); bx.push([0.5, 8, -1.2, 5, 9.5, 1.2, C.k]); bx.push([-1.5, 3, -1, 0, 7, 1, C.k]);
    bx.push([1, 3, -2.1, 6, 4, 2.1, C.d]);
    bx.push([7, 4, -0.4, 17, 6.5, 0.4, C.m]);
    for (let x = 7; x < 17; x += 1.5) { bx.push([x, 6.5, -0.5, x + 0.8, 7.2, 0.5, C.t]); bx.push([x + 0.6, 3.3, -0.5, x + 1.4, 4, 0.5, C.t]); }
    bx.push([16.5, 4.3, -0.5, 17.5, 6.2, 0.5, C.t]);
    return { boxes: bx, flat: true, origin: [0.5, 3.5], scale: 0.7 };
  }
  function staff(o) {
    const bx = [];
    for (let y = 0; y < o.len; y++) bx.push([-0.7, y, -0.7, 0.7, y + 1, 0.7, y % 4 === 0 ? o.ring : o.wood]);
    bx.push([-1.6, o.len, -1.6, 1.6, o.len + 1, 1.6, o.ring]);
    bx.push([-1.1, o.len + 1, -1.1, 1.1, o.len + 3.4, 1.1, o.orb]);
    bx.push([-0.5, o.len + 3.4, -0.5, 0.5, o.len + 4.6, 0.5, o.orb2]);
    return { boxes: bx, origin: [3, 3], scale: 1 };
  }
  const GOLD = '#e8c040', GOLD2 = '#b88a18', LEATHER = '#5a3a1c', LEATHER2 = '#7a5230';
  MODELS.big_bertha = sword({ len: 30, width: 5, thick: 1.4, grip: 6, guardW: 12, guardT: 2, blade: '#c8d4e0', edge: '#f4f8ff', fuller: '#8a96a4', guard: GOLD, guard2: GOLD2, gripC: LEATHER, grip2: LEATHER2, pommel: GOLD, gem: '#e02030', guardTips: true, scale: 0.8 });
  MODELS.slice = sword({ len: 28, width: 4.6, thick: 1.4, grip: 6, guardW: 11, guardT: 2, blade: '#e83030', edge: '#ffb0a0', fuller: '#901010', guard: GOLD, guard2: GOLD2, gripC: LEATHER, grip2: LEATHER2, gem: '#ffffff', guardTips: true, scale: 0.8 });
  MODELS.royal_guardian_sword = sword({ len: 32, width: 5, thick: 1.5, grip: 7, guardW: 13, guardT: 2.2, blade: '#ffe060', edge: '#fff8d0', fuller: '#c040e0', guard: '#c040e0', guard2: GOLD, gripC: '#8a2010', grip2: GOLD, pommel: GOLD, gem: '#40e0ff', wings: true, scale: 0.8 });
  MODELS.nightmare_sword = sword({ len: 18, width: 3, thick: 1, grip: 4, guardW: 8, blade: '#3a1a40', edge: '#e02020', fuller: '#1a0a20', guard: '#2a1020', gripC: '#1a0a10', grip2: '#c02020', jagged: true, gem: '#ff2020' });
  for (const [n, blade, edge, guard, grip] of [['ultimate_sword', '#e8e4ff', '#ffffff', '#9a8ad8', '#2a1a5a'], ['emerald_sword', '#1fc760', '#c8ffdd', GOLD, LEATHER], ['ruby_sword', '#e8203c', '#ffd0d8', GOLD, LEATHER], ['amethyst_sword', '#a060e8', '#f4e4ff', GOLD, LEATHER],
    ['experience_sword', '#c8ff40', '#f0ffc0', '#1fc760', LEATHER], ['poison_sword', '#6a9a28', '#b8e060', '#3a3a20', '#3a2a10'], ['rat_sword', '#c0b0a0', '#f0e8e0', '#9ab8f4', '#5a74b8'], ['fairy_sword', '#ffc0f0', '#ffffff', '#9ab8f4', '#5a74b8'],
    ['rose_sword', '#e02040', '#ff90a0', '#3a8a28', '#2a6a18'], ['pink_tourmaline_sword', '#f050a8', '#ffe0f2', GOLD, LEATHER], ['tigers_eye_sword', '#e0a030', '#fff0b0', '#5a3008', LEATHER], ['crystal_stone_sword', '#d0c0f4', '#ffffff', '#9a80d0', '#5a74b8'], ['crystal_wood_sword', '#9ab8f4', '#d4e8ff', '#5a74b8', '#1a2448']]) {
    MODELS[n] = sword({ len: 12, width: 2.6, thick: 1, grip: 3.5, guardW: 6.5, blade, edge, fuller: edge, guard, gripC: grip, grip2: grip });
  }
  MODELS.queen_battle_axe = axe({ len: 22, head: 9, reach: 6, double: true, metal: '#e070e8', metal2: '#8a28a0', edge: '#ffd8ff', gripC: '#3a1a40', grip2: '#c060e0', spike: true, gem: '#60e8ff' });
  MODELS.battle_axe = axe({ len: 19, head: 8, reach: 5.5, double: true, metal: '#d0d8e0', metal2: '#8a96a4', edge: '#ffffff', gripC: LEATHER, grip2: LEATHER2, spike: true });
  MODELS.big_hammer = hammer({ len: 14, headW: 9, headH: 6, metal: '#5a5a6a', metal2: '#8a8a9a', gripC: LEATHER, grip2: '#3a2a10', spikes: true });
  MODELS.attitude_adjuster = hammer({ len: 18, headW: 11, headH: 7, metal: '#8a96a4', metal2: '#e8e4ff', gripC: '#2a1a5a', grip2: '#9a8ad8', spikes: true });
  MODELS.ray_gun = gun({ len: 9, barrel: 4, grip: '#3a3a44', body: '#c8d0d8', barrelC: '#8a96a4', trim: '#e03030', rings: true, glow: '#ff6060' });
  MODELS.squidzooka = gun({ len: 13, barrel: 3, grip: '#2a2a40', body: '#4a6aa0', barrelC: '#2a2a40', trim: '#a0c0f0', tube: true, scale: 0.9 });
  MODELS.creeper_launcher = gun({ len: 13, barrel: 3, grip: '#1a3a10', body: '#3a8a28', barrelC: '#1a3a10', trim: '#202020', tube: true, scale: 0.9 });
  MODELS.chainsaw = chainsaw();
  MODELS.thunder_staff = staff({ len: 16, wood: '#8a6430', ring: GOLD, orb: '#60c0ff', orb2: '#ffffff' });

  // a model's colours live in a strip texture: one texel per colour
  const COS = Math.SQRT1_2;
  RP.voxelItemMesh = function (name) {
    this.voxelCache = this.voxelCache || new Map();
    let m = this.voxelCache.get(name);
    if (m) return m;
    const mdl = MODELS[name], gl = this.gl;
    const cols = [], idx = (c) => { let i = cols.indexOf(c); if (i < 0) { cols.push(c); i = cols.length - 1; } return i; };
    const v = [];
    const sc = mdl.scale || 1, [ox, oy] = mdl.origin;
    const tf = mdl.flat
      ? (x, y) => [ox + x * sc, oy + y * sc]
      : (x, y) => [ox + (x + y) * COS * sc, oy + (y - x) * COS * sc];
    const tn = mdl.flat ? (nx, ny) => [nx, ny] : (nx, ny) => [(nx + ny) * COS, (ny - nx) * COS];
    const quad = (pts, n, ci) => {
      const u = (ci + 0.5) / 64;
      const [nx, ny] = tn(n[0], n[1]);
      for (const k of [0, 1, 2, 0, 2, 3]) { const p = pts[k], [x, y] = tf(p[0], p[1]); v.push(x / 16, y / 16, (p[2] * sc - 0.5) / 16, u, 0.5, nx, ny, n[2]); }
    };
    for (const b of mdl.boxes) {
      const [x0, y0, z0, x1, y1, z1, c] = b, ci = idx(c);
      quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], ci);
      quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], ci);
      quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], ci);
      quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], ci);
      quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], ci);
      quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], ci);
    }
    const px = new Uint8Array(64 * 4);
    cols.forEach((c, i) => { const h = hex(c); px[i * 4] = h[0]; px[i * 4 + 1] = h[1]; px[i * 4 + 2] = h[2]; px[i * 4 + 3] = 255; });
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    m = { buf, n: v.length / 8, tex };
    this.voxelCache.set(name, m);
    return m;
  };
  const drawItemMesh = RP.drawItemMesh;
  RP.drawItemMesh = function (stack, model, light, tint) {
    const d = stack && I.get(stack.id);
    if (!d || !MODELS[d.name] || this.flatItems) return drawItemMesh.apply(this, arguments);
    const gl = this.gl, m = this.voxelItemMesh(d.name);
    const sh = this.useEntityShader();
    gl.uniformMatrix4fv(sh.u.uModel, false, model);
    gl.uniform2f(sh.u.uLight, light[0], light[1]);
    if (tint) gl.uniform4fv(sh.u.uTint, tint);
    gl.bindTexture(gl.TEXTURE_2D, m.tex);
    this.bindEntityBuffer(m.buf);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, m.n);
    gl.enable(gl.CULL_FACE);
  };
  DL.ItemModels = MODELS;

  /* ============================================================ */
  /* Armour that looks like what it is made of                    */
  /* ============================================================ */
  const C = (h) => hex(h);
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // overlay helper: repaint only where the armour already has paint
  function over(s, part, faces, fn) {
    for (const f of faces.split(',')) {
      const [u, v, w, h] = s.rect(part, 0, f);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = ((v + y) * s.w + u + x) * 4;
        if (s.img.data[o + 3] < 10) continue;
        const c = fn(x, y, w, h, f, [s.img.data[o], s.img.data[o + 1], s.img.data[o + 2]]);
        if (c) s.px(u + x, v + y, c);
      }
    }
  }
  const PARTS = ['head', 'body', 'rarm', 'larm', 'rleg', 'lleg'];
  const ALLF = 'front,back,left,right,top,bottom';
  const each = (s, fn) => { for (const p of PARTS) over(s, p, ALLF, (x, y, w, h, f, b) => fn(x, y, w, h, f, b, p)); };
  const scales = (dark, mid, light) => (s) => each(s, (x, y) => { const r = y >> 1, sx = (x + (r % 2) * 2) % 4, sy = y % 2; return sy === 1 && (sx === 0 || sx === 3) ? dark : sx === 1 && sy === 0 ? light : mid; });
  const facets = (dark, mid, light) => (s) => each(s, (x, y) => ((x + y) % 5 === 0 ? light : (x - y + 40) % 6 === 0 ? dark : (x * 7 + y * 3) % 13 === 0 ? mixc(mid, light, 0.5) : mid));
  const STYLES = {
    royal: (s) => {
      const gold = C('#ffd040'), gold2 = C('#c89418'), red = C('#c02020'), red2 = C('#801010'), white = C('#fff4b0');
      each(s, (x, y, w, h, f, b, part) => {
        if (part === 'body' && f === 'front' && (x === Math.floor(w / 2) || x === Math.floor(w / 2) - 1 || y === 3)) return red;
        if (y === 0 || y === h - 1) return gold2;
        if (part === 'body' && (y === 1)) return white;
        if ((part === 'rarm' || part === 'larm') && y === 2) return red;
        if ((part === 'rleg' || part === 'lleg') && f === 'front' && y > 1 && x > 0 && x < w - 1 && y < h - 2) return (y % 2 ? red : red2);
        return (x * 5 + y * 3) % 11 === 0 ? white : gold;
      });
    },
    mobzilla: scales(C('#1a2a18'), C('#3e5a34'), C('#7a9a6a')),
    queen: (s) => { scales(C('#8a28a0'), C('#e070e8'), C('#ffd8ff'))(s); each(s, (x, y, w, h, f, b, part) => (part === 'body' && f === 'front' && Math.abs(x - w / 2 + 0.5) + Math.abs(y - 4) < 2 ? C('#60e8ff') : null)); },
    peacock: (s) => each(s, (x, y, w, h, f) => { const k = ((x * 3 + y * 5) % 9); if (f === 'top' || f === 'bottom') return C('#1a5a7a'); return k === 0 ? C('#e0c040') : k === 1 ? C('#2050c0') : k < 4 ? C('#28a0a0') : C('#1a7a6a'); }),
    lava_eel: (s) => { scales(C('#8a2a08'), C('#e05a18'), C('#ffc060'))(s); each(s, (x, y) => ((x * 7 + y * 11) % 17 === 0 ? C('#2a0a00') : null)); },
    moth_scale: (s) => each(s, (x, y, w, h, f) => { const cx = w / 2 - 0.5, cy = h / 2 - 0.5, d = Math.hypot(x - cx, (y - cy) * 1.3); if (f === 'front' || f === 'back') { if (d < 1) return C('#101010'); if (d < 2) return C('#3070e0'); if (d < 2.8) return C('#f4e0b0'); } return (x + y) % 4 === 0 ? C('#7a5a28') : C('#c8a060'); }),
    ultimate: (s) => each(s, (x, y, w, h) => (y === 0 || x === 0 ? C('#ffffff') : (x + y) % 6 === 0 ? C('#b080ff') : y === h - 1 || x === w - 1 ? C('#9a8ad8') : C('#e8e4ff'))),
    emerald: facets(C('#0e7a3a'), C('#1fc760'), C('#c8ffdd')),
    ruby: facets(C('#8a0a1c'), C('#e8203c'), C('#ffd0d8')),
    amethyst: facets(C('#5a2a98'), C('#a060e8'), C('#f4e4ff')),
    pink_tourmaline: facets(C('#a01060'), C('#f050a8'), C('#ffe0f2')),
    tigers_eye: (s) => each(s, (x, y) => { const k = Math.sin(y * 0.9 + x * 0.25) * 2; return Math.abs(((x + k + y * 0.3) % 5) - 2.5) < 0.7 ? C('#fff0b0') : (y % 3 === 0 ? C('#8a5208') : C('#e0a030')); }),
    experience: (s) => each(s, (x, y) => { const k = (x * x + y * 3) % 7; return k === 0 ? C('#ffffa0') : k < 3 ? C('#c8ff40') : C('#6aa818'); }),
    lapis: (s) => each(s, (x, y) => ((x * 7 + y * 5) % 11 === 0 ? C('#ffd040') : (x + y) % 5 === 0 ? C('#90a8f8') : C('#2a4ab8')))
  };
  M.armorStyles = Object.assign(M.armorStyles || {}, STYLES);

  // the parts that stand out from the body
  const XTRA = {
    royal: {
      head: [[-4.5, -10.5, -5.2, 9, 1.5, 0.8, '#ffd040'], [-4.5, -10.5, 4.4, 9, 1.5, 0.8, '#ffd040'], [-5.2, -10.5, -4.5, 0.8, 1.5, 9, '#ffd040'], [4.4, -10.5, -4.5, 0.8, 1.5, 9, '#ffd040'],
        [-4.6, -12.5, -5.2, 1.2, 2, 0.8, '#ffd040'], [-0.6, -13.2, -5.2, 1.2, 2.7, 0.8, '#ffd040'], [3.4, -12.5, -5.2, 1.2, 2, 0.8, '#ffd040'], [-4.6, -12.5, 4.4, 1.2, 2, 0.8, '#ffd040'], [3.4, -12.5, 4.4, 1.2, 2, 0.8, '#ffd040'],
        [-0.6, -10.2, -5.6, 1.2, 1, 0.5, '#e02020'], [-3.4, -10.2, -5.6, 1, 1, 0.5, '#40e0ff'], [2.4, -10.2, -5.6, 1, 1, 0.5, '#40e0ff']],
      body: [[-4.6, 0, 3.1, 9.2, 15, 0.6, '#c02020'], [-4.6, 0, 3.0, 9.2, 1, 0.8, '#ffd040']],
      rarm: [[-4.6, -3.4, -3, 5.2, 2.4, 6, '#ffd040'], [-4.8, -1.2, -3.1, 5.6, 0.8, 6.2, '#c02020']],
      larm: [[-0.6, -3.4, -3, 5.2, 2.4, 6, '#ffd040'], [-0.8, -1.2, -3.1, 5.6, 0.8, 6.2, '#c02020']]
    },
    mobzilla: {
      head: [[-0.75, -12, -3.5, 1.5, 3, 1.5, '#d8d8c8'], [-0.75, -12.8, -0.5, 1.5, 3.8, 1.5, '#d8d8c8'], [-0.75, -11.5, 2.5, 1.5, 2.5, 1.5, '#d8d8c8'], [-5.4, -6, -3, 1, 1, 1, '#ffe030'], [4.4, -6, -3, 1, 1, 1, '#ffe030']],
      body: [[-0.75, 0.5, 3.1, 1.5, 3, 2, '#d8d8c8'], [-0.75, 4.5, 3.1, 1.5, 3, 2, '#d8d8c8'], [-0.75, 8.5, 3.1, 1.5, 2.5, 1.5, '#d8d8c8']],
      rleg: [[-2.2, 11, -3.8, 1, 1, 1.4, '#e8e0c8'], [-0.5, 11, -3.8, 1, 1, 1.4, '#e8e0c8'], [1.2, 11, -3.8, 1, 1, 1.4, '#e8e0c8']],
      lleg: [[-2.2, 11, -3.8, 1, 1, 1.4, '#e8e0c8'], [-0.5, 11, -3.8, 1, 1, 1.4, '#e8e0c8'], [1.2, 11, -3.8, 1, 1, 1.4, '#e8e0c8']]
    },
    queen: {
      head: [[-4.2, -12.5, -1, 1.4, 3.5, 1.4, '#ffd8ff'], [2.8, -12.5, -1, 1.4, 3.5, 1.4, '#ffd8ff'], [-4.6, -14, -0.8, 1, 1.6, 1, '#ffd8ff'], [3.6, -14, -0.8, 1, 1.6, 1, '#ffd8ff'], [-0.5, -11, -3.5, 1, 2, 7, '#60e8ff']],
      rarm: [[-4.6, -3.4, -3, 5.2, 2.2, 6, '#e070e8'], [-4.2, -5, -0.5, 1, 1.8, 1, '#ffd8ff']],
      larm: [[-0.6, -3.4, -3, 5.2, 2.2, 6, '#e070e8'], [3.2, -5, -0.5, 1, 1.8, 1, '#ffd8ff']]
    },
    peacock: {
      head: [[-0.5, -15.5, 0, 1, 6.5, 1, '#28a0a0'], [-2.2, -14, 1, 1, 5, 1, '#28a0a0'], [1.2, -14, 1, 1, 5, 1, '#28a0a0'], [-0.7, -16.5, -0.2, 1.4, 1.4, 1.4, '#2050c0'], [-2.4, -15, 0.8, 1.4, 1.2, 1.4, '#e0c040'], [1, -15, 0.8, 1.4, 1.2, 1.4, '#e0c040']],
      body: [[-7, -3, 3.4, 14, 12, 0.5, '#1a7a6a'], [-5, -4, 3.5, 2, 2, 0.5, '#2050c0'], [3, -4, 3.5, 2, 2, 0.5, '#2050c0'], [-1, -5, 3.5, 2, 2, 0.5, '#e0c040']]
    },
    moth_scale: {
      head: [[-2.6, -13, -4.4, 0.6, 4.5, 0.6, '#5a3a18'], [2, -13, -4.4, 0.6, 4.5, 0.6, '#5a3a18'], [-3, -13.6, -4.6, 1.2, 1, 1, '#c8a060'], [1.7, -13.6, -4.6, 1.2, 1, 1, '#c8a060']],
      body: [[-8, 0, 3.2, 7, 10, 0.4, '#c8a060'], [1, 0, 3.2, 7, 10, 0.4, '#c8a060'], [-6, 3, 3.3, 3, 3, 0.4, '#3070e0'], [3, 3, 3.3, 3, 3, 0.4, '#3070e0']]
    },
    lava_eel: { head: [[-0.4, -12, -4, 0.8, 3, 8, '#ffc060'], [-0.3, -11.5, -4.6, 0.6, 2, 0.8, '#e05a18']] },
    ultimate: {
      head: [[-5.8, -10, -2, 1, 4, 5, '#ffffff'], [4.8, -10, -2, 1, 4, 5, '#ffffff'], [-6.3, -12, 0, 1, 3, 2, '#b080ff'], [5.3, -12, 0, 1, 3, 2, '#b080ff']],
      rarm: [[-4.6, -3.4, -3, 5.2, 2.2, 6, '#e8e4ff']], larm: [[-0.6, -3.4, -3, 5.2, 2.2, 6, '#e8e4ff']]
    },
    experience: { head: [[-1, -8.2, -5.6, 2, 2, 0.8, '#ffffa0']], body: [[-1.2, 3, -3.3, 2.4, 2.4, 0.8, '#ffffa0']] }
  };
  for (const [k, gem] of [['emerald', '#c8ffdd'], ['ruby', '#ffd0d8'], ['amethyst', '#f4e4ff'], ['pink_tourmaline', '#ffe0f2'], ['tigers_eye', '#fff0b0'], ['lapis', '#ffd040']]) XTRA[k] = { head: [[-1, -8.2, -5.5, 2, 2, 0.7, gem]], body: [[-1, 3, -3.2, 2, 2, 0.7, gem]] };
  const PIV = { head: [0, 0, 0], body: [0, 0, 0], rarm: [-5, 2, 0], larm: [5, 2, 0], rleg: [-2, 12, 0], lleg: [2, 12, 0] };
  for (const set in XTRA) {
    const name = 'armx_' + set, parts = {}, colours = {};
    for (const pn of PARTS) {
      const list = XTRA[set][pn] || [];
      // every part exists so the pose applies; empty ones hold a speck far inside the body
      parts[pn] = P(PIV[pn], list.length ? list.map(b => b.slice(0, 6)) : [[0, 0, 0, 0.01, 0.01, 0.01]]);
      list.forEach((b, i) => { colours[pn + ':' + i] = b[6]; });
    }
    D[name] = { anim: 'biped', noCull: true, shadow: 0, parts };
    if (M.newModels.indexOf(name) < 0) M.newModels.push(name);
    const paint = DL.OreSpawn && DL.OreSpawn.mobs && DL.OreSpawn.mobs.paint;
    M.skinPainters[name] = () => {
      if (paint) return paint(name, 7000 + set.length, Object.assign({ _: ['#ffffff', 0.05] }, Object.fromEntries(Object.entries(colours).map(([k, c]) => [k, [c, 0.06]]))));
      const s = new M.Skin(name, 1); for (const pn of PARTS) (XTRA[set][pn] || []).forEach((b, i) => s.fill(pn, i, 'all', () => hex(b[6]))); return s.done();
    };
  }
  const SLOT_PARTS = [['head'], ['body', 'rarm', 'larm'], [], ['rleg', 'lleg']];
  const drawArmor = RP.drawArmor;
  RP.drawArmor = function (p, pt, m, light) {
    drawArmor.apply(this, arguments);
    if (!p.armor) return;
    let pose = null;
    for (let i = 0; i < 4; i++) {
      const s = p.armor[i], d = s && I.get(s.id), set = d && d.armor && (d.armor.set || d.armor.mat);
      if (!set || !XTRA[set] || !SLOT_PARTS[i].length || !this.modelMeshes['armx_' + set]) continue;
      if (!pose) pose = M.pose('player', p, pt);
      this.drawModel('armx_' + set, p, pt, m, light, { only: SLOT_PARTS[i], pose });
    }
  };

  /* ============================================================ */
  /* The little you in the inventory: armour on, item in hand     */
  /* ============================================================ */
  RP.renderPlayerPreview = (function (prev) {
    return function (p) {
      const self = this, base = RP.drawModel;
      let done = false;
      // draw the armour and the held item right after the body, with the same matrix
      this.drawModel = function (type, e, pt2, model, light) {
        const r = base.apply(this, arguments);
        if (!done && type === 'player' && e && (e === p || Object.getPrototypeOf(e) === p)) {
          done = true;
          try { self.drawArmor(e, pt2, model, light); if (p.held) self.drawHeldThirdPerson(e, pt2, model, light, p.held, 'player'); } catch (err) { /* keep the preview alive */ }
        }
        return r;
      };
      try { return prev.apply(this, arguments); } finally { delete this.drawModel; }
    };
  })(RP.renderPlayerPreview);
  void E; void S;
})();
