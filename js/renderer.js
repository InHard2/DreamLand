/*
 * DreamLand - WebGL renderer.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, M4 = DL.M4;

  const TERRAIN_VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec4 aLight; attribute float aTint;
uniform mat4 uProj, uView, uModel; uniform highp float uTime; uniform vec3 uCamPos;
varying vec2 vUV; varying float vSky, vBlk, vShade, vDist; varying float vFlag; varying vec3 vPos; varying vec3 vTint;
void main(){
  // biome colour multiplier, packed as RGB565 of (ratio / 2); 0 = untinted
  vTint = vec3(1.0);
  if (aTint > 0.5) { highp float t = floor(aTint + 0.5); vTint = vec3(floor(t / 2048.0) / 31.0, floor(mod(t, 2048.0) / 32.0) / 63.0, mod(t, 32.0) / 31.0) * 2.0; }
  vec3 lp = aPos * (1.0/256.0);
  vec4 wp = uModel * vec4(lp, 1.0);
  float fl = floor(aLight.w * 255.0 + 0.5);
  if (uTime >= 0.0) {
    vec3 W = wp.xyz + uCamPos;
    if (fl == 1.0 || fl == 5.0) {
      float ph = W.x * 0.7 + W.z * 0.5 + W.y * 0.3;
      wp.x += sin(uTime * 1.7 + ph) * 0.03; wp.z += cos(uTime * 1.3 + ph * 1.3) * 0.03; wp.y += sin(uTime * 2.1 + ph) * 0.01;
    } else if (fl == 2.0) {
      float top = 1.0 - fract(aUV.y * 16.0 + 0.0001);
      float ph = W.x * 0.9 + W.z * 0.6;
      wp.x += sin(uTime * 2.0 + ph) * 0.07 * top; wp.z += cos(uTime * 1.6 + ph) * 0.05 * top;
    } else if (fl == 3.0 && fract(lp.y) > 0.02) {
      wp.y += (sin(uTime * 1.8 + W.x * 0.9 + W.z * 0.6) + sin(uTime * 1.3 - W.z * 0.8 + W.x * 0.3)) * 0.022 - 0.045;
    }
  }
  vPos = wp.xyz;
  vec4 vp = uView * wp;
  gl_Position = uProj * vp;
  vDist = length(vp.xyz);
  vUV = aUV; vSky = aLight.x; vBlk = aLight.y; vShade = aLight.z; vFlag = aLight.w;
}`;
  const TERRAIN_FS = `
precision mediump float;
uniform sampler2D uTex;
uniform float uSkySub, uAlphaTest, uGamma, uFogDensity, uFogMode, uAmb;
uniform vec3 uFogColor; uniform vec2 uFog; uniform vec3 uLightOv; uniform vec4 uTint; uniform vec4 uDyn, uDyn2; uniform highp float uTime;
varying vec2 vUV; varying float vSky, vBlk, vShade, vDist; varying float vFlag; varying vec3 vPos; varying vec3 vTint;
float bright(float l){ float f = 1.0 - l/15.0; float b = (1.0-f)/(f*3.0+1.0)*(0.95-uAmb)+0.05+uAmb; float g = 1.0 - pow(1.0-b, 4.0); return mix(b, g, uGamma); }
void main(){
  vec4 t = texture2D(uTex, vUV);
  bool solidLeaf = vFlag > 4.5 / 255.0 && vFlag < 5.5 / 255.0;
  if (solidLeaf) { if (t.a < 0.5) t = vec4(0.09, 0.16, 0.05, 1.0); t.a = 1.0; }
  if (t.a < uAlphaTest) discard;
  if (vTint != vec3(1.0)) {
    // tint green pixels (grass, leaves, plants) and all of the water
    float gw = floor(vFlag * 255.0 + 0.5) == 3.0 ? 1.0 : clamp((t.g - max(t.r, t.b)) * 7.0, 0.0, 1.0);
    t.rgb = mix(t.rgb, clamp(t.rgb * vTint, 0.0, 1.0), gw);
  }
  float sky = uLightOv.x > 0.5 ? uLightOv.y : vSky * 15.0;
  float blk = uLightOv.x > 0.5 ? uLightOv.z : vBlk * 15.0;
  if (uDyn.w > 0.0) blk = max(blk, uDyn.w - length(vPos - uDyn.xyz));
  if (uDyn2.w > 0.0) blk = max(blk, uDyn2.w - length(vPos - uDyn2.xyz) * 0.8);
  float L = max(sky - uSkySub, blk);
  vec3 c = t.rgb * vShade * bright(max(L, 0.0));
  if (uTime >= 0.0 && floor(vFlag * 255.0 + 0.5) == 3.0) c *= 1.0 + 0.07 * sin(uTime * 2.2 + vPos.x * 2.1 + vPos.z * 1.7);
  c = mix(c, uTint.rgb, uTint.a);
  float fog = uFogMode > 0.5 ? clamp(exp(-uFogDensity * vDist), 0.0, 1.0) : clamp((uFog.y - vDist)/(uFog.y - uFog.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(uFogColor, c, fog), t.a);
}`;
  const ENTITY_VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec3 aNormal;
uniform mat4 uProj, uView, uModel;
varying vec2 vUV; varying float vShade, vDist;
void main(){
  vec4 vp = uView * uModel * vec4(aPos, 1.0); gl_Position = uProj * vp; vDist = length(vp.xyz); vUV = aUV;
  vec3 n = normalize((uModel * vec4(aNormal, 0.0)).xyz);
  vec3 l0 = normalize(vec3(0.2, 1.0, -0.7)), l1 = normalize(vec3(-0.2, 1.0, 0.7));
  vShade = min(1.0, 0.4 + 0.6 * (max(dot(n, l0), 0.0) + max(dot(n, l1), 0.0)));
}`;
  const ENTITY_FS = `
precision mediump float;
uniform sampler2D uTex; uniform vec2 uLight; uniform float uSkySub, uGamma, uFogDensity, uFogMode, uAmb;
uniform vec3 uFogColor; uniform vec2 uFog; uniform vec4 uTint; uniform float uAlpha;
varying vec2 vUV; varying float vShade, vDist;
float bright(float l){ float f = 1.0 - l/15.0; float b = (1.0-f)/(f*3.0+1.0)*(0.95-uAmb)+0.05+uAmb; float g = 1.0 - pow(1.0-b, 4.0); return mix(b, g, uGamma); }
void main(){
  vec4 t = texture2D(uTex, vUV);
  if (t.a < 0.1) discard;
  float L = max(uLight.x - uSkySub, uLight.y);
  vec3 c = t.rgb * vShade * bright(max(L, 0.0));
  c = mix(c, uTint.rgb, uTint.a);
  float fog = uFogMode > 0.5 ? clamp(exp(-uFogDensity * vDist), 0.0, 1.0) : clamp((uFog.y - vDist)/(uFog.y - uFog.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(uFogColor, c, fog), t.a * uAlpha);
}`;
  const BASIC_VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec4 aColor;
uniform mat4 uMVP; uniform mat4 uMV;
varying vec2 vUV; varying vec4 vColor; varying float vDist;
void main(){ gl_Position = uMVP * vec4(aPos, 1.0); vUV = aUV; vColor = aColor; vDist = length((uMV * vec4(aPos,1.0)).xyz); }`;
  const BASIC_FS = `
precision mediump float;
uniform sampler2D uTex; uniform float uUseTex, uAlphaTest, uUseFog; uniform vec3 uFogColor; uniform vec2 uFog;
varying vec2 vUV; varying vec4 vColor; varying float vDist;
void main(){
  vec4 c = vColor;
  if (uUseTex > 0.5) c *= texture2D(uTex, vUV);
  if (c.a < uAlphaTest) discard;
  if (uUseFog > 0.5) { float f = clamp((uFog.y - vDist)/(uFog.y - uFog.x), 0.0, 1.0); c.rgb = mix(uFogColor, c.rgb, f); }
  gl_FragColor = c;
}`;

  function Renderer(canvas) {
    this.canvas = canvas;
    const opts = { antialias: false, alpha: false, depth: true, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    let gl = canvas.getContext('webgl2', opts);
    this.gl2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) throw new Error('WebGL is not supported on this device');
    this.gl = gl;
    this.proj = M4.create(); this.view = M4.create(); this.tmp = M4.create(); this.mvp = M4.create(); this.model = M4.create();
    this.frustum = new DL.Frustum();
    this.cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    this.fogColor = [0.75, 0.85, 1]; this.skyColor = [0.47, 0.66, 1];
    this.particles = [];
    this.stats = { sections: 0, drawn: 0, faces: 0 };
    this.initGL();
  }
  DL.Renderer = Renderer;

  Renderer.prototype.compile = function (vs, fs, attribs) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  };

  Renderer.prototype.texture = function (src, repeat) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    return t;
  };

  Renderer.prototype.initGL = function () {
    const gl = this.gl;
    this.terrainShader = this.compile(TERRAIN_VS, TERRAIN_FS, ['aPos', 'aUV', 'aLight', 'aTint']);
    this.gl.vertexAttrib1f(3, 0);
    this.entityShader = this.compile(ENTITY_VS, ENTITY_FS, ['aPos', 'aUV', 'aNormal']);
    this.basicShader = this.compile(BASIC_VS, BASIC_FS, ['aPos', 'aUV', 'aColor']);
    // quad index buffer (16384 quads, uint16)
    const idx = new Uint16Array(16384 * 6);
    for (let i = 0; i < 16384; i++) { idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); }
    this.quadIndex = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.dyn = gl.createBuffer();
    this.dynData = new ArrayBuffer(24 * 65536);
    this.dynF = new Float32Array(this.dynData); this.dynU8 = new Uint8Array(this.dynData);
    this.dynN = 0;
    this.entityBuf = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
  };

  Renderer.prototype.loadTextures = function () {
    const gl = this.gl;
    this.terrainTex = this.texture(DL.Tex.terrain);
    this.itemsTex = this.texture(DL.Tex.items);
    this.dirtTex = this.texture(DL.Tex.gui.dirt, true);
    this.itemsData = DL.Tex.items.getContext('2d').getImageData(0, 0, 256, 256).data;
    this.skinTex = {};
    for (const k in DL.Models.skins) this.skinTex[k] = this.texture(DL.Models.skins[k]);
    this.modelMeshes = {};
    for (const k of ['pig', 'cow', 'sheep', 'chicken', 'zombie', 'player', 'skeleton', 'creeper', 'spider', 'armor1', 'armor2'].concat(DL.Models.newModels || [])) {
      const m = DL.Models.buildMesh(k);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);
      this.modelMeshes[k] = { buf, parts: m.parts, noCull: m.noCull, shadow: m.shadow };
    }
    this.buildParticleAtlas();
    this.buildShadowTex();
    this.buildCelestial();
    this.buildStars();
    this.clouds = DL.Tex.buildClouds();
    this.cloudTex = this.texture(this.cloudCanvas(), true);
    this.blockMeshCache = new Map();
    this.itemMeshCache = new Map();
  };

  Renderer.prototype.cloudCanvas = function () {
    const c = DL.Tex.makeCanvas(this.clouds.size, this.clouds.size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < this.clouds.data.length; i++) {
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = this.clouds.data[i] ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  Renderer.prototype.buildParticleAtlas = function () {
    // 128x128, 8x8 cells
    const c = DL.Tex.makeCanvas(128, 128), ctx = c.getContext('2d');
    const img = ctx.createImageData(128, 128);
    const set = (cx, cy, x, y, a, rgb) => {
      const o = ((cy * 8 + y) * 128 + cx * 8 + x) * 4;
      img.data[o] = rgb ? rgb[0] : 255; img.data[o + 1] = rgb ? rgb[1] : 255; img.data[o + 2] = rgb ? rgb[2] : 255; img.data[o + 3] = a;
    };
    // row 0: generic puffs shrinking (frame 0 largest)
    for (let f = 0; f < 8; f++) {
      const r = 3.8 - f * 0.45;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const d = Math.hypot(x - 3.5, y - 3.5);
        if (d < r) set(f, 0, x, y, 255, d > r - 1.1 ? [200, 200, 200] : [255, 255, 255]);
      }
    }
    // bubble (0,1)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x - 3.5, y - 3.5);
      if (d < 3.2 && d > 2.2) set(0, 1, x, y, 255, [90, 150, 255]);
      if (x === 2 && y === 2) set(0, 1, x, y, 255, [255, 255, 255]);
    }
    // splash drops (1..4,1)
    for (let f = 0; f < 4; f++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x - 3.5, y - 3.5);
      if (d < 2.5 - f * 0.4) set(1 + f, 1, x, y, 255, [80, 120, 255]);
    }
    // flame (0,3)
    const flame = ['...yy...', '..yooy..', '..yooy..', '.yoowoy.', '.yowwoy.', '.yowwoy.', '..yooy..', '...yy...'];
    const fpal = { y: [255, 200, 40], o: [255, 120, 20], w: [255, 255, 200] };
    flame.forEach((row, y) => row.split('').forEach((ch, x) => { if (fpal[ch]) set(0, 3, x, y, 255, fpal[ch]); }));
    // lava (1,3)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const d = Math.hypot(x - 3.5, y - 3.5); if (d < 2.5) set(1, 3, x, y, 255, [255, 140 - d * 30, 0]); }
    // crit/spark (2,3)
    for (let i = 0; i < 8; i++) { set(2, 3, i, 3, 255); set(2, 3, 3, i, 255); }
    ctx.putImageData(img, 0, 0);
    this.particleTex = this.texture(c);
  };

  Renderer.prototype.buildCelestial = function () {
    const sun = DL.Tex.makeCanvas(32, 32), sc = sun.getContext('2d');
    const img = sc.createImageData(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const o = (y * 32 + x) * 4;
      const inCore = x >= 8 && x < 24 && y >= 8 && y < 24;
      const dx = Math.max(0, Math.abs(x - 15.5) - 8), dy = Math.max(0, Math.abs(y - 15.5) - 8);
      const glow = Math.max(0, 1 - Math.hypot(dx, dy) / 8);
      if (inCore) { img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = (x + y) % 5 === 0 ? 170 : 210; img.data[o + 3] = 255; }
      else { img.data[o] = 255 * glow; img.data[o + 1] = 230 * glow; img.data[o + 2] = 130 * glow; img.data[o + 3] = 255; }
    }
    sc.putImageData(img, 0, 0);
    this.sunTex = this.texture(sun);
    const moon = DL.Tex.makeCanvas(32, 32), mc = moon.getContext('2d');
    const im2 = mc.createImageData(32, 32);
    const r = new S.RNG(77);
    const craters = [[12, 13, 2.5], [19, 18, 2], [14, 21, 1.5], [20, 11, 1.5]];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const o = (y * 32 + x) * 4;
      if (x >= 9 && x < 23 && y >= 9 && y < 23) {
        let v = 200 + r.nextInt(30);
        for (const [cx, cy, cr] of craters) if (Math.hypot(x - cx, y - cy) < cr) v = 140;
        im2.data[o] = v; im2.data[o + 1] = v; im2.data[o + 2] = v + 15; im2.data[o + 3] = 255;
      } else { im2.data[o + 3] = 255; }
    }
    mc.putImageData(im2, 0, 0);
    this.moonTex = this.texture(moon);
  };

  Renderer.prototype.buildStars = function () {
    const r = new S.RNG(10842);
    const v = [];
    for (let i = 0; i < 1500; i++) {
      let x = r.next() * 2 - 1, y = r.next() * 2 - 1, z = r.next() * 2 - 1;
      const size = 0.25 + r.next() * 0.25;
      let d = x * x + y * y + z * z;
      if (d >= 1 || d < 0.01) continue;
      d = 1 / Math.sqrt(d);
      x *= d; y *= d; z *= d;
      const px = x * 100, py = y * 100, pz = z * 100;
      const yaw = Math.atan2(x, z), pitch = Math.atan2(Math.hypot(x, z), y);
      const rot = r.next() * Math.PI * 2;
      const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch), sr = Math.sin(rot), cr = Math.cos(rot);
      for (let k = 0; k < 4; k++) {
        const a = ((k & 2) - 1) * size, b = (((k + 1) & 2) - 1) * size;
        const lx = a * cr - b * sr, lz = b * cr + a * sr;
        const ly = lx * sp + 0 * cp;
        const vv = 0 * sp - lx * cp;
        v.push(px + vv * sy - lz * cy, py + ly, pz + lz * sy + vv * cy);
      }
    }
    this.starVerts = new Float32Array(v);
  };

  /* ---------------------------------------------------------------- */
  /* Resize                                                           */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.resize = function (w, h, scale) {
    const c = this.canvas;
    c.width = Math.max(1, Math.floor(w * scale));
    c.height = Math.max(1, Math.floor(h * scale));
    this.w = c.width; this.h = c.height;
  };

  /* ---------------------------------------------------------------- */
  /* Immediate-mode helper (basic shader)                             */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.begin = function () { this.dynN = 0; };
  Renderer.prototype.vtx = function (x, y, z, u, v, r, g, b, a) {
    if (this.dynN >= 65536) return;
    const o = this.dynN * 6;
    const f = this.dynF;
    f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = u; f[o + 4] = v;
    const bo = this.dynN * 24 + 20;
    const u8 = this.dynU8;
    u8[bo] = r * 255; u8[bo + 1] = g * 255; u8[bo + 2] = b * 255; u8[bo + 3] = (a === undefined ? 1 : a) * 255;
    this.dynN++;
  };
  Renderer.prototype.quadV = function (p, uv, c) {
    for (let i = 0; i < 4; i++) this.vtx(p[i][0], p[i][1], p[i][2], uv ? uv[i][0] : 0, uv ? uv[i][1] : 0, c[0], c[1], c[2], c[3]);
  };
  Renderer.prototype.flush = function (mode, opts) {
    const gl = this.gl;
    if (!this.dynN) return;
    const sh = this.basicShader;
    gl.useProgram(sh.p);
    gl.uniformMatrix4fv(sh.u.uMVP, false, opts.mvp || this.mvp);
    gl.uniformMatrix4fv(sh.u.uMV, false, opts.mv || this.view);
    gl.uniform1f(sh.u.uUseTex, opts.tex ? 1 : 0);
    gl.uniform1f(sh.u.uAlphaTest, opts.alphaTest || 0);
    gl.uniform1f(sh.u.uUseFog, opts.fog ? 1 : 0);
    gl.uniform3fv(sh.u.uFogColor, this.fogColor);
    gl.uniform2f(sh.u.uFog, this.fogStart, this.fogEnd);
    if (opts.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, opts.tex); gl.uniform1i(sh.u.uTex, 0); }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dyn);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(this.dynData, 0, this.dynN * 24), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 24, 20);
    if (mode === 'quads') {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndex);
      gl.drawElements(gl.TRIANGLES, (this.dynN / 4 | 0) * 6, gl.UNSIGNED_SHORT, 0);
    } else if (mode === 'lines') gl.drawArrays(gl.LINES, 0, this.dynN);
    else if (mode === 'fan') gl.drawArrays(gl.TRIANGLE_FAN, 0, this.dynN);
    else gl.drawArrays(gl.TRIANGLES, 0, this.dynN);
    this.dynN = 0;
  };

  /* ---------------------------------------------------------------- */
  /* Chunk meshes                                                     */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.uploadSection = function (s, m) {
    const gl = this.gl;
    if (!s.gl) s.gl = { solid: null, solidN: 0, trans: null, transN: 0 };
    const g = s.gl;
    const up = (key, data, n) => {
      if (!n) { if (g[key]) { gl.deleteBuffer(g[key]); g[key] = null; } return; }
      if (!g[key]) g[key] = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, g[key]);
      gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(data, 0, n * 16), gl.STATIC_DRAW);
    };
    up('solid', m.solid, m.solidCount); g.solidN = m.solidCount;
    up('trans', m.trans, m.transCount); g.transN = m.transCount;
  };
  Renderer.prototype.freeChunk = function (c) {
    const gl = this.gl;
    for (const s of c.sections) if (s.gl) {
      if (s.gl.solid) gl.deleteBuffer(s.gl.solid);
      if (s.gl.trans) gl.deleteBuffer(s.gl.trans);
      s.gl = null;
    }
  };
  Renderer.prototype.drawTerrainBuffer = function (buf, n) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    for (let base = 0; base < n; base += 65536) {
      const cnt = Math.min(65536, n - base);
      const off = base * 16;
      gl.vertexAttribPointer(0, 3, gl.SHORT, false, 16, off);
      gl.vertexAttribPointer(1, 2, gl.UNSIGNED_SHORT, true, 16, off + 8);
      gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 16, off + 12);
      gl.vertexAttribPointer(3, 1, gl.UNSIGNED_SHORT, false, 16, off + 6);
      gl.enableVertexAttribArray(3);
      gl.drawElements(gl.TRIANGLES, (cnt / 4) * 6, gl.UNSIGNED_SHORT, 0);
      gl.disableVertexAttribArray(3);
    }
  };

  Renderer.prototype.useTerrainShader = function (alphaTest) {
    const gl = this.gl, sh = this.terrainShader;
    gl.useProgram(sh.p);
    gl.uniformMatrix4fv(sh.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(sh.u.uView, false, this.view);
    gl.uniform1f(sh.u.uSkySub, this.skySub);
    gl.uniform1f(sh.u.uAlphaTest, alphaTest);
    gl.uniform1f(sh.u.uGamma, this.gamma);
    gl.uniform3fv(sh.u.uFogColor, this.fogColor);
    gl.uniform2f(sh.u.uFog, this.fogStart, this.fogEnd);
    gl.uniform1f(sh.u.uFogMode, this.fogMode);
    gl.uniform1f(sh.u.uFogDensity, this.fogDensity);
    gl.uniform1f(sh.u.uAmb, this.ambient || 0);
    const cam = this.cam, dw = this.dynWorld, dw2 = this.dynWorld2;
    gl.uniform1f(sh.u.uTime, this.waving === true ? (performance.now() / 1000) % 3600 : -1); // swaying/rippling is off unless enabled
    gl.uniform3f(sh.u.uCamPos, cam.x, cam.y, cam.z);
    if (dw && dw[3] > 0) gl.uniform4f(sh.u.uDyn, dw[0] - cam.x, dw[1] - cam.y, dw[2] - cam.z, dw[3]); else gl.uniform4f(sh.u.uDyn, 0, 0, 0, 0);
    if (dw2 && dw2[3] > 0) gl.uniform4f(sh.u.uDyn2, dw2[0] - cam.x, dw2[1] - cam.y, dw2[2] - cam.z, dw2[3]); else gl.uniform4f(sh.u.uDyn2, 0, 0, 0, 0);
    gl.uniform3f(sh.u.uLightOv, 0, 0, 0);
    gl.uniform4f(sh.u.uTint, 0, 0, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.terrainTex);
    gl.uniform1i(sh.u.uTex, 0);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndex);
    return sh;
  };

  Renderer.prototype.renderChunks = function (world, translucent) {
    const gl = this.gl;
    const sh = this.useTerrainShader(translucent ? 0.01 : 0.5);
    const cam = this.cam;
    const list = this._visible;
    const m = this.model;
    if (translucent) {
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i];
        if (!s.gl.transN) continue;
        M4.identity(m); m[12] = s.chunk.cx * 16 - cam.x; m[13] = s.sy * 16 - cam.y; m[14] = s.chunk.cz * 16 - cam.z;
        gl.uniformMatrix4fv(sh.u.uModel, false, m);
        this.drawTerrainBuffer(s.gl.trans, s.gl.transN);
      }
    } else {
      for (const s of list) {
        if (!s.gl.solidN) continue;
        M4.identity(m); m[12] = s.chunk.cx * 16 - cam.x; m[13] = s.sy * 16 - cam.y; m[14] = s.chunk.cz * 16 - cam.z;
        gl.uniformMatrix4fv(sh.u.uModel, false, m);
        this.drawTerrainBuffer(s.gl.solid, s.gl.solidN);
        this.stats.faces += s.gl.solidN / 4;
      }
    }
  };

  Renderer.prototype.collectVisible = function (world) {
    const cam = this.cam;
    const out = [];
    const f = this.frustum;
    const maxD = (world.renderDist + 1) * 16;
    let total = 0;
    for (const c of world.chunks.values()) {
      if (!c.meshReady) continue;
      const bx = c.cx * 16 - cam.x, bz = c.cz * 16 - cam.z;
      const dx = Math.max(0, Math.abs(bx + 8) - 8), dz = Math.max(0, Math.abs(bz + 8) - 8);
      if (dx * dx + dz * dz > maxD * maxD) continue;
      for (const s of c.sections) {
        if (!s.gl || (!s.gl.solidN && !s.gl.transN)) continue;
        total++;
        const by = s.sy * 16 - cam.y;
        if (!f.testAABB(bx, by, bz, bx + 16, by + 16, bz + 16)) continue;
        s._d = (bx + 8) * (bx + 8) + (by + 8) * (by + 8) + (bz + 8) * (bz + 8);
        out.push(s);
      }
    }
    out.sort((a, b) => a._d - b._d);
    this._visible = out;
    this.stats.sections = total; this.stats.drawn = out.length;
  };

  /* ---------------------------------------------------------------- */
  /* Sky                                                              */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.computeSky = function (world, pt, lookDir, renderDist) {
    const a = world.celestialAngle(pt);
    let f = Math.cos(a * Math.PI * 2) * 2 + 0.5;
    f = Math.max(0, Math.min(1, f));
    const base = [0.47, 0.66, 1.0];
    this.skyColor = [base[0] * f, base[1] * f, base[2] * f];
    let fog = [0.7529412 * (f * 0.94 + 0.06), 0.84705883 * (f * 0.94 + 0.06), 1.0 * (f * 0.91 + 0.09)];
    // blend with sky by render distance (closer distance -> more sky tint)
    const rd = Math.max(0, Math.min(1, renderDist / 16));
    const k = 1 - Math.pow(rd * 0.75 + 0.25, 0.25);
    fog = fog.map((c, i) => c + (this.skyColor[i] - c) * k);
    // sunrise tint when looking towards the sun
    const sr = this.sunriseColor(a);
    if (sr && lookDir) {
      const sunDir = [-Math.sin(a * Math.PI * 2), Math.cos(a * Math.PI * 2), 0];
      let d = lookDir[0] * (sunDir[0] > 0 ? 1 : -1);
      d = Math.max(0, d) * sr[3];
      fog = fog.map((c, i) => c + (sr[i] - c) * d * 0.6);
    }
    this.fogColor = fog;
    this.sunrise = sr;
    this.celestial = a;
    let sb = 1 - (Math.cos(a * Math.PI * 2) * 2 + 0.75);
    sb = Math.max(0, Math.min(1, sb));
    this.starBright = sb * sb * 0.5;
  };
  Renderer.prototype.sunriseColor = function (a) {
    const c = Math.cos(a * Math.PI * 2);
    if (c < -0.4 || c > 0.4) return null;
    const f3 = c / 0.4 * 0.5 + 0.5;
    let al = 1 - (1 - Math.sin(f3 * Math.PI)) * 0.99;
    al *= al;
    return [f3 * 0.3 + 0.7, f3 * f3 * 0.7 + 0.2, 0.2, al];
  };

  Renderer.prototype.renderSky = function (world, pt) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    // view rotation only
    M4.multiply(this.mvp, this.proj, this.view);
    const sky = this.skyColor, fog = this.fogColor;
    // dome
    this.begin();
    const seg = 24;
    const ring = (el) => { const r = []; for (let i = 0; i <= seg; i++) { const t = i / seg * Math.PI * 2; r.push([Math.cos(t) * Math.cos(el) * 100, Math.sin(el) * 100, Math.sin(t) * Math.cos(el) * 100]); } return r; };
    const bands = [[-0.6, fog.map(c => c * 0.55)], [-0.05, fog], [0.08, fog], [0.35, sky.map((c, i) => c * 0.7 + fog[i] * 0.3)], [1.5707, sky]];
    for (let b = 0; b < bands.length - 1; b++) {
      const r0 = ring(bands[b][0]), r1 = ring(bands[b + 1][0]);
      const c0 = bands[b][1], c1 = bands[b + 1][1];
      for (let i = 0; i < seg; i++) {
        this.vtx(r0[i][0], r0[i][1], r0[i][2], 0, 0, c0[0], c0[1], c0[2], 1);
        this.vtx(r0[i + 1][0], r0[i + 1][1], r0[i + 1][2], 0, 0, c0[0], c0[1], c0[2], 1);
        this.vtx(r1[i + 1][0], r1[i + 1][1], r1[i + 1][2], 0, 0, c1[0], c1[1], c1[2], 1);
        this.vtx(r1[i][0], r1[i][1], r1[i][2], 0, 0, c1[0], c1[1], c1[2], 1);
      }
    }
    this.flush('quads', {});
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // sunrise fan
    const a = this.celestial;
    const sr = this.sunrise;
    const rot = M4.create();
    if (sr) {
      const side = -Math.sin(a * Math.PI * 2) > 0 ? 1 : -1;
      this.begin();
      this.vtx(side * 100, 4, 0, 0, 0, sr[0], sr[1], sr[2], sr[3]);
      for (let i = 0; i <= 16; i++) {
        const t = i * Math.PI * 2 / 16;
        this.vtx(side * 55, Math.sin(t) * 45 * sr[3] + 4, Math.cos(t) * 120, 0, 0, sr[0], sr[1], sr[2], 0);
      }
      this.flush('fan', { mvp: this.mvp });
    }
    // sun & moon (additive)
    gl.blendFunc(gl.ONE, gl.ONE);
    M4.copy(rot, this.mvp);
    M4.rotateZ(rot, rot, a * Math.PI * 2);
    const rain = 1 - (this.rainLevel || 0) * 0.95;
    this.begin();
    const s1 = 30;
    this.quadV([[-s1, 100, -s1], [s1, 100, -s1], [s1, 100, s1], [-s1, 100, s1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [rain, rain, rain, 1]);
    this.flush('quads', { mvp: rot, tex: this.sunTex });
    this.begin();
    const s2 = 20;
    this.quadV([[-s2, -100, s2], [s2, -100, s2], [s2, -100, -s2], [-s2, -100, -s2]], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 1, 1, 1]);
    this.flush('quads', { mvp: rot, tex: this.moonTex });
    // stars
    if (this.starBright > 0) {
      this.begin();
      const v = this.starVerts, b = this.starBright;
      for (let i = 0; i < v.length; i += 3) this.vtx(v[i], v[i + 1], v[i + 2], 0, 0, b, b, b, 1);
      this.flush('quads', { mvp: rot });
    }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
  };

  Renderer.prototype.renderClouds = function (world, pt, fancy) {
    const gl = this.gl;
    const cam = this.cam;
    const cloudY = 108.33;
    const drift = (world.totalTicks + pt) * 0.03;
    const cell = 12;
    const cl = this.clouds;
    const bright = Math.max(0.1, Math.min(1, Math.cos(world.celestialAngle(pt) * Math.PI * 2) * 2 + 0.5)) * (1 - (this.rainLevel || 0) * 0.45);
    const col = [0.9 * bright + 0.1 * this.fogColor[0], 0.9 * bright + 0.1 * this.fogColor[1], 0.9 * bright + 0.1 * this.fogColor[2]];
    M4.multiply(this.mvp, this.proj, this.view);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    const range = Math.min(24, Math.max(10, world.renderDist * 2));
    const ox = cam.x + drift, oz = cam.z;
    const ccx = Math.floor(ox / cell), ccz = Math.floor(oz / cell);
    const fx = ox - ccx * cell, fz = oz - ccz * cell;
    const baseY = cloudY - cam.y;
    const filled = (i, j) => cl.data[(((ccz + j) % 256 + 256) % 256) * 256 + (((ccx + i) % 256 + 256) % 256)];
    const saveFog = [this.fogStart, this.fogEnd];
    this.fogStart = range * cell * 0.5; this.fogEnd = range * cell;
    const passes = fancy ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      if (fancy) gl.colorMask(pass === 1, pass === 1, pass === 1, pass === 1);
      this.begin();
      for (let i = -range; i <= range; i++) for (let j = -range; j <= range; j++) {
        if (!filled(i, j)) continue;
        const x0 = i * cell - fx, z0 = j * cell - fz, x1 = x0 + cell, z1 = z0 + cell;
        if (!fancy) {
          this.quadV([[x0, baseY, z0], [x1, baseY, z0], [x1, baseY, z1], [x0, baseY, z1]], null, [col[0], col[1], col[2], 0.8]);
          continue;
        }
        const y0 = baseY, y1 = baseY + 4;
        const top = [col[0], col[1], col[2], 0.8], bot = [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7, 0.8];
        const sx = [col[0] * 0.9, col[1] * 0.9, col[2] * 0.9, 0.8], sz = [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8, 0.8];
        if (cam.y < cloudY + 4) this.quadV([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], null, bot);
        if (cam.y > cloudY) this.quadV([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], null, top);
        if (!filled(i - 1, j)) this.quadV([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], null, sx);
        if (!filled(i + 1, j)) this.quadV([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], null, sx);
        if (!filled(i, j - 1)) this.quadV([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], null, sz);
        if (!filled(i, j + 1)) this.quadV([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], null, sz);
      }
      this.flush('quads', { fog: true });
    }
    gl.colorMask(true, true, true, true);
    this.fogStart = saveFog[0]; this.fogEnd = saveFog[1];
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  };

  /* ---------------------------------------------------------------- */
  /* Camera                                                           */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.setupCamera = function (x, y, z, yaw, pitch, roll, fov, far, extra) {
    const cam = this.cam;
    cam.x = x; cam.y = y; cam.z = z; cam.yaw = yaw; cam.pitch = pitch;
    M4.perspective(this.proj, fov * Math.PI / 180, this.w / this.h, 0.05, far);
    const v = this.view;
    M4.identity(v);
    if (extra) extra(v);
    if (roll) M4.rotateZ(v, v, roll);
    M4.rotateX(v, v, -pitch);
    M4.rotateY(v, v, -yaw);
    M4.multiply(this.tmp, this.proj, this.view);
    this.frustum.fromMatrix(this.tmp);
  };

  /* ---------------------------------------------------------------- */
  /* Block / item meshes for entities                                 */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.blockMesh = function (id, meta) {
    const key = id * 256 + (meta || 0);
    let m = this.blockMeshCache.get(key);
    if (m) return m;
    const blocks = new Uint8Array(5832), metaA = new Uint8Array(5832), light = new Uint8Array(5832);
    light.fill(0xF0);
    const ci = 1 * 324 + 1 * 18 + 1;
    blocks[ci] = id; metaA[ci] = meta || 0;
    const mesher = new S.Mesher();
    const r = mesher.mesh({ blocks, meta: metaA, light, fancy: true, smooth: false });
    const gl = this.gl;
    const mk = (data, n) => { if (!n) return null; const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(data, 0, n * 16), gl.STATIC_DRAW); return b; };
    m = { solid: mk(r.solid, r.solidCount), solidN: r.solidCount, trans: mk(r.trans, r.transCount), transN: r.transCount };
    this.blockMeshCache.set(key, m);
    return m;
  };

  /** Extruded item mesh (pixels -> depth) using entity vertex layout. */
  Renderer.prototype.itemMesh = function (stack) {
    const d = DL.Items.get(stack.id);
    const terrain = d.isBlock;
    const key = (terrain ? 't' : 'i') + stack.id;
    let m = this.itemMeshCache.get(key);
    if (m) return m;
    let px, tile;
    if (terrain) { tile = S.blocks[d.block].icon; px = DL.Tex.tileData[S.TILE_NAMES[tile]]; }
    else {
      tile = DL.Tex.itemTile(d.icon || d.name);
      px = new Uint8ClampedArray(1024);
      const tx = (tile & 15) * 16, ty = (tile >> 4) * 16;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) for (let c = 0; c < 4; c++) px[(y * 16 + x) * 4 + c] = this.itemsData[((ty + y) * 256 + tx + x) * 4 + c];
    }
    const tu = (tile & 15) / 16, tv = (tile >> 4) / 16;
    const v = [];
    const depth = 1 / 16;
    const U = (x) => tu + x / 256, V = (y) => tv + y / 256;
    const quad = (p, uv, n) => { for (const k of [0, 1, 2, 0, 2, 3]) v.push(p[k][0], p[k][1], p[k][2], uv[k][0], uv[k][1], n[0], n[1], n[2]); };
    // front/back full quads (x: 0..1 left->right, y: 1..0 top->bottom)
    quad([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], [[U(0), V(16)], [U(16), V(16)], [U(16), V(0)], [U(0), V(0)]], [0, 0, 1]);
    quad([[1, 0, -depth], [0, 0, -depth], [0, 1, -depth], [1, 1, -depth]], [[U(16), V(16)], [U(0), V(16)], [U(0), V(0)], [U(16), V(0)]], [0, 0, -1]);
    const a = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && px[(y * 16 + x) * 4 + 3] > 20;
    const e = 0.001;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!a(x, y)) continue;
      const x0 = x / 16, x1 = (x + 1) / 16, y0 = 1 - (y + 1) / 16, y1 = 1 - y / 16;
      const uv = [[U(x + e), V(y + 1 - e)], [U(x + 1 - e), V(y + 1 - e)], [U(x + 1 - e), V(y + e)], [U(x + e), V(y + e)]];
      if (!a(x - 1, y)) quad([[x0, y0, -depth], [x0, y0, 0], [x0, y1, 0], [x0, y1, -depth]], uv, [-1, 0, 0]);
      if (!a(x + 1, y)) quad([[x1, y0, 0], [x1, y0, -depth], [x1, y1, -depth], [x1, y1, 0]], uv, [1, 0, 0]);
      if (!a(x, y - 1)) quad([[x0, y1, 0], [x1, y1, 0], [x1, y1, -depth], [x0, y1, -depth]], uv, [0, 1, 0]);
      if (!a(x, y + 1)) quad([[x0, y0, -depth], [x1, y0, -depth], [x1, y0, 0], [x0, y0, 0]], uv, [0, -1, 0]);
    }
    const gl = this.gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    m = { buf, n: v.length / 8, tex: terrain ? this.terrainTex : this.itemsTex };
    this.itemMeshCache.set(key, m);
    return m;
  };

  Renderer.prototype.useEntityShader = function () {
    const gl = this.gl, sh = this.entityShader;
    gl.useProgram(sh.p);
    gl.uniformMatrix4fv(sh.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(sh.u.uView, false, this.view);
    gl.uniform1f(sh.u.uSkySub, this.skySub);
    gl.uniform1f(sh.u.uGamma, this.gamma);
    gl.uniform3fv(sh.u.uFogColor, this.fogColor);
    gl.uniform2f(sh.u.uFog, this.fogStart, this.fogEnd);
    gl.uniform1f(sh.u.uFogMode, this.fogMode);
    gl.uniform1f(sh.u.uFogDensity, this.fogDensity);
    gl.uniform1f(sh.u.uAmb, this.ambient || 0);
    gl.uniform4f(sh.u.uTint, 0, 0, 0, 0);
    gl.uniform1f(sh.u.uAlpha, 1);
    gl.uniform1i(sh.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.disableVertexAttribArray(2);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    return sh;
  };
  Renderer.prototype.bindEntityBuffer = function (buf) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20);
  };

  Renderer.prototype.drawItemMesh = function (stack, model, light, tint) {
    const gl = this.gl;
    const m = this.itemMesh(stack);
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
  Renderer.prototype.drawBlockMesh = function (id, meta, model, light, tint, translucentPass) {
    const gl = this.gl;
    const m = this.blockMesh(id, meta);
    const sh = this.useTerrainShader(0.5);
    gl.uniformMatrix4fv(sh.u.uModel, false, model);
    gl.uniform3f(sh.u.uLightOv, 1, light[0], light[1]);
    if (tint) gl.uniform4fv(sh.u.uTint, tint);
    gl.disable(gl.CULL_FACE);
    if (m.solid) this.drawTerrainBuffer(m.solid, m.solidN);
    if (m.trans) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(sh.u.uAlphaTest, 0.01);
      this.drawTerrainBuffer(m.trans, m.transN);
      gl.disable(gl.BLEND);
    }
    gl.enable(gl.CULL_FACE);
  };

  /* ---------------------------------------------------------------- */
  /* Entities                                                         */
  /* ---------------------------------------------------------------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAngle = (a, b, t) => a + DL.wrapAngle(b - a) * t;

  Renderer.prototype.drawModel = function (type, e, pt, model, light, opts) {
    const gl = this.gl;
    opts = opts || {};
    const mesh = this.modelMeshes[type];
    if (!mesh) return;
    const sh = this.useEntityShader();
    gl.bindTexture(gl.TEXTURE_2D, this.skinTex[opts.skin || type]);
    this.bindEntityBuffer(mesh.buf);
    gl.uniform2f(sh.u.uLight, light[0], light[1]);
    let tint = [0, 0, 0, 0];
    if (e.hurtTime > 0 || e.deathTime > 0) tint = [1, 0, 0, 0.4];
    if (type === 'creeper' && e.fuse > 0) {
      const f = (e.prevFuse + (e.fuse - e.prevFuse) * pt) / 28;
      if (Math.floor(f * 10) % 2 === 1) tint = [1, 1, 1, Math.min(0.8, f * 0.8)];
    }
    if (opts.tint) tint = opts.tint;
    gl.uniform4fv(sh.u.uTint, tint);
    const pose = opts.pose || DL.Models.pose(opts.poseAs || type, e, pt);
    if (mesh.noCull) gl.disable(gl.CULL_FACE);
    const pm = M4.create();
    for (const pn in mesh.parts) {
      const part = mesh.parts[pn];
      if (part.wool && e.sheared) continue;
      if (opts.only && opts.only.indexOf(pn) < 0) continue;
      const r = pose[pn] || pose[part.follow] || [0, 0, 0];
      const pv = part.pivot;
      const px = pv[0] + (r[3] || 0), py = pv[1] + (r[4] || 0), pz = pv[2] + (r[5] || 0);
      M4.copy(pm, model);
      if (opts.raw) {
        // classic model space (y down, no flip): T(pivot) Rz Ry Rx S(1/16), undoing the mesh's local flip
        M4.translate(pm, pm, px / 16, py / 16, pz / 16);
        if (r[2]) M4.rotateZ(pm, pm, r[2]);
        if (r[1]) M4.rotateY(pm, pm, r[1]);
        if (r[0]) M4.rotateX(pm, pm, r[0]);
        M4.scale(pm, pm, -1 / 16, -1 / 16, 1 / 16);
      } else {
        // local (x,y flipped) space: rotations about x and y are negated
        M4.translate(pm, pm, -px / 16, -py / 16, pz / 16);
        if (r[2]) M4.rotateZ(pm, pm, r[2]);
        if (r[1]) M4.rotateY(pm, pm, -r[1]);
        if (r[0]) M4.rotateX(pm, pm, -r[0]);
        M4.scale(pm, pm, 1 / 16, 1 / 16, 1 / 16);
      }
      gl.uniformMatrix4fv(sh.u.uModel, false, pm);
      gl.drawArrays(gl.TRIANGLES, part.start, part.count);
    }
    if (mesh.noCull) gl.enable(gl.CULL_FACE);
  };

  /** Armor layers worn by the player. */
  const ARMOR_BASE = { 298: 'leather', 306: 'iron', 310: 'diamond', 314: 'gold' };
  function armorMat(id) { for (const b in ARMOR_BASE) if (id >= +b && id < +b + 4) return ARMOR_BASE[b]; return null; }
  Renderer.prototype.drawArmor = function (p, pt, m, light) {
    if (!p.armor) return;
    const pose = DL.Models.pose('player', p, pt);
    const slots = [[0, 'armor1', ['head']], [1, 'armor1', ['body', 'rarm', 'larm']], [2, 'armor2', ['body', 'rleg', 'lleg']], [3, 'armor1', ['rleg', 'lleg']]];
    for (const [i, model, parts] of slots) {
      const s = p.armor[i];
      const mat = s && armorMat(s.id);
      if (!mat) continue;
      this.drawModel(model, p, pt, m, light, { skin: model + '_' + mat, only: parts, pose });
    }
  };

  Renderer.prototype.buildShadowTex = function () {
    const c = DL.Tex.makeCanvas(32, 32), ctx = c.getContext('2d');
    const img = ctx.createImageData(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5);
      img.data[(y * 32 + x) * 4 + 3] = Math.max(0, Math.min(1, (16 - d) / 4)) * 255;
    }
    ctx.putImageData(img, 0, 0);
    this.shadowTex = this.texture(c);
  };
  /** Classic blob shadows projected onto the block tops beneath entities. */
  Renderer.prototype.renderShadows = function (world, list) {
    if (!list.length) return;
    const gl = this.gl, cam = this.cam;
    M4.multiply(this.mvp, this.proj, this.view);
    this.begin();
    for (const [ex, ey, ez, r, op] of list) {
      const x0 = Math.floor(ex - r), x1 = Math.floor(ex + r), z0 = Math.floor(ez - r), z1 = Math.floor(ez + r);
      const y1 = Math.floor(ey), y0 = Math.floor(ey - 2);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
        const b = world.getBlock(x, y - 1, z);
        if (!b || !S.OPAQUE[b] || S.OPAQUE[world.getBlock(x, y, z)]) continue;
        const L = Math.max(world.getSky(x, y, z) - this.skySub, world.getBlockLight(x, y, z));
        let a = (op - (ey - y) / 2) * 0.5 * (0.3 + 0.7 * L / 15);
        if (a <= 0) continue;
        a = Math.min(1, a);
        const u0 = (x - ex) / 2 / r + 0.5, u1 = (x + 1 - ex) / 2 / r + 0.5, v0 = (z - ez) / 2 / r + 0.5, v1 = (z + 1 - ez) / 2 / r + 0.5;
        const yy = y + 0.015 - cam.y;
        this.quadV([[x - cam.x, yy, z - cam.z], [x - cam.x, yy, z + 1 - cam.z], [x + 1 - cam.x, yy, z + 1 - cam.z], [x + 1 - cam.x, yy, z - cam.z]],
          [[u0, v0], [u0, v1], [u1, v1], [u1, v0]], [1, 1, 1, a]);
      }
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
    gl.disable(gl.CULL_FACE);
    this.flush('quads', { tex: this.shadowTex, fog: true });
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  };

  Renderer.prototype.entityModelMatrix = function (e, pt, out) {
    const cam = this.cam;
    const x = lerp(e.px, e.x, pt) - cam.x, y = lerp(e.py, e.y, pt) - cam.y, z = lerp(e.pz, e.z, pt) - cam.z;
    M4.identity(out);
    M4.translate(out, out, x, y, z);
    const by = lerpAngle(e.pbodyYaw, e.bodyYaw, pt);
    M4.rotateY(out, out, by);
    if (e.deathTime > 0) {
      let f = (e.deathTime + pt - 1) / 20 * 1.6;
      f = Math.sqrt(Math.min(1, f));
      M4.rotateZ(out, out, -f * Math.PI / 2);
    }
    // model origin: feet at y=24 in model space -> local y = (24 - my)/16
    M4.translate(out, out, 0, 24 / 16 - (e.sneaking ? 0.125 : 0), 0);
    return by;
  };

  Renderer.prototype.renderEntities = function (game, pt) {
    const gl = this.gl;
    const world = game.world;
    const cam = this.cam;
    const m = M4.create();
    const maxD2 = (world.renderDist * 16) ** 2;
    this.billboards = [];
    const shadows = [];
    for (const e of world.entities) {
      if (e.removed) continue;
      if (e === game.player && !game.thirdPerson) continue;
      const ex = lerp(e.px, e.x, pt), ey = lerp(e.py, e.y, pt), ez = lerp(e.pz, e.z, pt);
      const d2 = (ex - cam.x) ** 2 + (ey - cam.y) ** 2 + (ez - cam.z) ** 2;
      if (d2 > maxD2) continue;
      const hw = (e.w || 0.5) / 2 + 0.5;
      if (!this.frustum.testAABB(ex - hw - cam.x, ey - cam.y - 0.5, ez - hw - cam.z, ex + hw - cam.x, ey + (e.h || 1) + 0.5 - cam.y, ez + hw - cam.z)) continue;
      const bx = Math.floor(ex), by = Math.floor(ey + (e.h || 0.5) * 0.6), bz = Math.floor(ez);
      const light = [world.getSky(bx, by, bz), world.getBlockLight(bx, by, bz)];
      if (e.living) {
        e.headYawRel = DL.wrapAngle(lerpAngle(e.pheadYaw, e.headYaw, pt) - lerpAngle(e.pbodyYaw, e.bodyYaw, pt));
        e.renderPitch = e.isPlayer ? lerp(e.ppitch, e.pitch, pt) * -1 : -(e.pitch || 0);
        this.entityModelMatrix(e, pt, m);
        let type = e.type;
        const def = e.def;
        let skin = null;
        if (def) {
          type = (def.modelFor && def.modelFor(e)) || def.model || type;
          skin = def.skinFor ? def.skinFor(e) : def.skin || null;
          const sc = e.scale || def.scale || 1;
          if (sc !== 1 || e.squish) {
            const sq = e.squish || 0;
            M4.translate(m, m, 0, -24 / 16, 0);
            M4.scale(m, m, sc * (1 - sq * 0.25), sc * (1 + sq * 0.5), sc * (1 - sq * 0.25));
            M4.translate(m, m, 0, 24 / 16, 0);
          }
          if (def.boss && e.deathTime > 0) { this.entityModelMatrix({ px: e.px, py: e.py, pz: e.pz, x: e.x, y: e.y, z: e.z, pbodyYaw: e.pbodyYaw, bodyYaw: e.bodyYaw, deathTime: 0 }, pt, m); M4.translate(m, m, 0, -24 / 16, 0); M4.scale(m, m, sc, sc, sc); M4.translate(m, m, 0, 24 / 16, 0); }
        }
        if (type === 'creeper' && e.fuse > 0) {
          let f = (e.prevFuse + (e.fuse - e.prevFuse) * pt) / 28;
          f = Math.max(0, Math.min(1, f));
          const s1 = 1 + Math.sin(f * 100) * f * 0.01;
          const f2 = f * f * f * f;
          M4.scale(m, m, (1 + f2 * 0.4) * s1, (1 + f2 * 0.1) / s1, (1 + f2 * 0.4) * s1);
        }
        if (e.type === 'player') e.heldItem = !!e.held;
        const lit = def && (def.fireImmune && (e.type === 'blaze' || e.type === 'magma_cube') || e.type === 'end_crystal' || e.type === 'ender_dragon' && world.dim === 2) ? [15, 15] : light;
        this.drawModel(type, e, pt, m, lit, skin ? { skin } : null);
        if (def && def.held) this.drawHeldThirdPerson(e, pt, m, lit, { id: def.held, count: 1 }, type);
        if (e.type === 'end_crystal' || (e.type === 'ender_dragon' && e.healer)) this.crystalBeams = true;
        if (e.type === 'player') this.drawArmor(e, pt, m, light);
        if (e.type === 'player' && e.held) this.drawHeldThirdPerson(e, pt, m, light, e.held, 'player');
        if (e.type === 'skeleton') this.drawHeldThirdPerson(e, pt, m, light, { id: 261, count: 1 }, 'skeleton');
        const mesh = this.modelMeshes[type];
        if (mesh && e.deathTime <= 0 && !(def && def.fly && e.type !== 'blaze')) shadows.push([ex, ey, ez, mesh.shadow * (e.scale || (def && def.scale) || 1), 1]);
        if (e.fire > 0) this.billboards.push({ fire: true, x: ex, y: ey, z: ez, w: e.w, h: e.h });
      } else if (e.type === 'item') {
        this.drawDroppedItem(e, pt, ex, ey, ez, light);
        shadows.push([ex, ey, ez, 0.15, 0.75]);
      } else if (e.type === 'tnt' || e.type === 'falling') {
        M4.identity(m);
        M4.translate(m, m, ex - cam.x - 0.5, ey - cam.y, ez - cam.z - 0.5);
        let tint = null;
        if (e.type === 'tnt') {
          const f = e.fuse - pt + 1;
          if (f < 10) { const s = 1 + (1 - f / 10) * 0.3; M4.translate(m, m, 0.5, 0.5, 0.5); M4.scale(m, m, s, s, s); M4.translate(m, m, -0.5, -0.5, -0.5); }
          if (Math.floor(f / 5) % 2 === 0) tint = [1, 1, 1, 0.6];
        }
        this.drawBlockMesh(e.type === 'tnt' ? B.tnt : e.block, 0, m, light, tint);
      } else if (e.type === 'arrow') {
        this.drawArrow(e, pt, ex, ey, ez, light);
      } else if (e.type === 'thrown') {
        this.billboards.push({ item: e.icon || (e.kind === 'egg' ? 344 : 332), x: ex, y: ey, z: ez, size: e.size || 0.25, light: e.icon === 385 || e.icon === 381 ? [15, 15] : light });
      }
    }
    this.renderShadows(world, shadows);
    // collect animations
    for (const c of game.collectAnims) {
      const t = Math.min(1, (c.t + pt) / 3);
      const p = game.player;
      const tx = lerp(p.px, p.x, pt), ty = lerp(p.py, p.y, pt) + 0.8, tz = lerp(p.pz, p.z, pt);
      const x = lerp(c.x, tx, t * t), y = lerp(c.y, ty, t * t), z = lerp(c.z, tz, t * t);
      if (c.stack) this.drawDroppedItem({ stack: c.stack, age: c.age, bobOffset: c.bob, rot: 0 }, pt, x, y, z, [15, 0]);
    }
  };

  Renderer.prototype.drawDroppedItem = function (e, pt, x, y, z, light) {
    const cam = this.cam;
    const d = DL.Items.get(e.stack.id);
    if (!d) return;
    const age = (e.age || 0) + pt;
    const bob = Math.sin(age / 10 + e.bobOffset) * 0.1 + 0.1;
    const copies = e.stack.count > 20 ? 4 : e.stack.count > 5 ? 3 : e.stack.count > 1 ? 2 : 1;
    if (d.isBlock && !d.flat) {
      const m = M4.create();
      const spin = (age / 20 + e.bobOffset) * 1.0;
      for (let i = 0; i < copies; i++) {
        M4.identity(m);
        const r = new S.RNG(187 + i);
        const ox = i ? (r.next() * 2 - 1) * 0.2 : 0, oy = i ? (r.next() * 2 - 1) * 0.2 : 0, oz = i ? (r.next() * 2 - 1) * 0.2 : 0;
        M4.translate(m, m, x - cam.x + ox, y - cam.y + bob + 0.05 + oy, z - cam.z + oz);
        M4.rotateY(m, m, spin);
        M4.scale(m, m, 0.25, 0.25, 0.25);
        M4.translate(m, m, -0.5, 0, -0.5);
        this.drawBlockMesh(d.block, 0, m, light);
      }
    } else {
      for (let i = 0; i < copies; i++) {
        const r = new S.RNG(187 + i);
        const ox = i ? (r.next() * 2 - 1) * 0.3 : 0, oy = i ? (r.next() * 2 - 1) * 0.3 : 0;
        this.billboards.push({ item: e.stack.id, x, y: y + bob + 0.25, z, size: 0.5, light, ox, oy });
      }
    }
  };

  Renderer.prototype.drawArrow = function (e, pt, x, y, z, light) {
    const m = M4.create();
    const cam = this.cam;
    M4.identity(m);
    M4.translate(m, m, x - cam.x, y - cam.y, z - cam.z);
    M4.rotateY(m, m, lerpAngle(e.pyaw, e.yaw, pt));
    M4.rotateX(m, m, lerp(e.ppitch, e.pitch, pt));
    if (e.shake > 0) M4.rotateX(m, m, Math.sin((e.shake - pt) * 3) * (e.shake - pt) * 0.03);
    // arrow sprite is diagonal: rotate so it points along -z
    M4.rotateY(m, m, Math.PI / 2);
    M4.rotateZ(m, m, -Math.PI / 4 * 3);
    M4.scale(m, m, 0.7, 0.7, 0.7);
    M4.translate(m, m, -0.5, -0.5, 0.03);
    this.drawItemMesh({ id: 262 }, m, light);
    M4.rotateX(m, m, Math.PI / 2);
  };

  const FULL3D = new Set([280, 352, 261]);
  /** Classic ItemRenderer.renderItem: draws the stack at the current matrix. */
  Renderer.prototype.drawItemClassic = function (stack, m, light) {
    const d = DL.Items.get(stack.id);
    if (d.isBlock && !d.flat) {
      M4.rotateY(m, m, Math.PI / 2);
      M4.translate(m, m, -0.5, -0.5, -0.5);
      this.drawBlockMesh(d.block, S.FRONT_BLOCKS[d.block] ? 3 : 0, m, light);
    } else {
      M4.translate(m, m, 0, -0.3, 0);
      M4.scale(m, m, 1.5, 1.5, 1.5);
      M4.rotateY(m, m, 50 * Math.PI / 180);
      M4.rotateZ(m, m, 335 * Math.PI / 180);
      M4.translate(m, m, -0.9375, -0.0625, 0);
      this.drawItemMesh(stack, m, light);
    }
  };
  Renderer.prototype.drawHeldThirdPerson = function (p, pt, model, light, stack, poseAs) {
    const m = M4.create();
    M4.copy(m, model);
    // back into classic model space (blocks, y down)
    M4.translate(m, m, 0, -1.5, 0);
    M4.scale(m, m, -1, -1, 1);
    M4.translate(m, m, 0, -1.5, 0);
    const pose = DL.Models.pose(poseAs || 'player', p, pt);
    const ra = pose.rarm;
    M4.translate(m, m, (-5 + (ra[3] || 0)) / 16, (2 + (ra[4] || 0)) / 16, (ra[5] || 0) / 16);
    M4.rotateZ(m, m, ra[2]); M4.rotateY(m, m, ra[1]); M4.rotateX(m, m, ra[0]);
    M4.translate(m, m, -0.0625, 0.4375, 0.0625);
    const d = DL.Items.get(stack.id);
    const deg = Math.PI / 180;
    if (d.id === 261) {
      const k = 0.625;
      M4.translate(m, m, 0, 0.125, 0.3125);
      M4.rotateY(m, m, -20 * deg);
      M4.scale(m, m, k, -k, k);
      M4.rotateX(m, m, -100 * deg); M4.rotateY(m, m, 45 * deg);
    } else if (d.isBlock && !d.flat) {
      const k = 0.5 * 0.75;
      M4.translate(m, m, 0, 0.1875, -0.3125);
      M4.rotateX(m, m, 20 * deg); M4.rotateY(m, m, 45 * deg);
      M4.scale(m, m, k, -k, k);
    } else if (d.tool || FULL3D.has(d.id)) {
      const k = 0.625;
      M4.translate(m, m, 0, 0.1875, 0);
      M4.scale(m, m, k, -k, k);
      M4.rotateX(m, m, -100 * deg); M4.rotateY(m, m, 45 * deg);
    } else {
      const k = 0.375;
      M4.translate(m, m, 0.25, 0.1875, -0.1875);
      M4.scale(m, m, k, k, k);
      M4.rotateZ(m, m, 60 * deg); M4.rotateX(m, m, -90 * deg); M4.rotateZ(m, m, 20 * deg);
    }
    this.drawItemClassic(stack, m, light);
  };

  /* ---------------------------------------------------------------- */
  /* Billboards & particles                                           */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.renderBillboards = function (world, pt) {
    const gl = this.gl;
    const cam = this.cam;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const right = [cy, 0, -sy];
    const up = [sy * sp, cp, cy * sp];
    const bright = (sky, blk) => {
      const L = Math.max(sky - this.skySub, blk);
      const f = 1 - Math.max(0, L) / 15;
      const b = (1 - f) / (f * 3 + 1) * 0.95 + 0.05;
      return b + ((1 - Math.pow(1 - b, 4)) - b) * this.gamma;
    };
    M4.multiply(this.mvp, this.proj, this.view);
    gl.disable(gl.CULL_FACE);
    // items
    this.begin();
    const fireQuads = [];
    for (const b of this.billboards) {
      if (b.fire) { fireQuads.push(b); continue; }
      const d = DL.Items.get(b.item);
      if (!d) continue;
      const terrain = d.isBlock;
      if (terrain) continue;
      const tile = DL.Tex.itemTile(d.icon || d.name);
      this.billboardQuad(b.x - cam.x, b.y - cam.y, b.z - cam.z, b.size, right, up, tile, bright(b.light[0], b.light[1]), b.ox, b.oy);
    }
    this.flush('quads', { tex: this.itemsTex, alphaTest: 0.1, fog: true });
    this.begin();
    for (const b of this.billboards) {
      if (b.fire) continue;
      const d = DL.Items.get(b.item);
      if (!d || !d.isBlock) continue;
      this.billboardQuad(b.x - cam.x, b.y - cam.y, b.z - cam.z, b.size, right, up, S.blocks[d.block].icon, bright(b.light[0], b.light[1]), b.ox, b.oy);
    }
    // entity fire
    for (const f of fireQuads) {
      const s = Math.max(f.w, 0.6) * 1.4;
      for (let k = 0; k < 3; k++) this.billboardQuad(f.x - cam.x, f.y - cam.y + f.h * 0.5 + k * 0.25, f.z - cam.z, s * (1 - k * 0.2), right, up, k % 2 ? S.T.fire_2 : S.T.fire, 1, 0, 0, true);
    }
    this.flush('quads', { tex: this.terrainTex, alphaTest: 0.1, fog: true });
    // particles
    this.renderParticles(pt, right, up, bright, world);
    gl.enable(gl.CULL_FACE);
  };
  Renderer.prototype.billboardQuad = function (x, y, z, size, right, up, tile, br, ox, oy, center) {
    const h = size / 2;
    const tu = (tile & 15) / 16, tv = (tile >> 4) / 16, e = 0.0005;
    ox = ox || 0; oy = oy || 0;
    const cx = x + right[0] * ox + up[0] * oy, cy = y + right[1] * ox + up[1] * oy + (center ? 0 : 0), cz = z + right[2] * ox + up[2] * oy;
    const p = (a, b) => [cx + right[0] * a + up[0] * b, cy + right[1] * a + up[1] * b, cz + right[2] * a + up[2] * b];
    this.quadV([p(-h, -h), p(h, -h), p(h, h), p(-h, h)], [[tu + e, tv + 1 / 16 - e], [tu + 1 / 16 - e, tv + 1 / 16 - e], [tu + 1 / 16 - e, tv + e], [tu + e, tv + e]], [br, br, br, 1]);
  };

  Renderer.prototype.addParticle = function (p) { if (this.particles.length < 4000) this.particles.push(p); };
  Renderer.prototype.tickParticles = function (world) {
    const ps = this.particles;
    let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.age++;
      if (p.age >= p.life) continue;
      p.vy -= p.gravity;
      if (p.type === 'bubble') {
        p.vy += 0.002;
        if (world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) !== B.water) continue;
      }
      let nx = p.x + p.vx, ny = p.y + p.vy, nz = p.z + p.vz;
      if (p.collide) {
        const b = world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (S.SOLID[b] && S.OPAQUE[b]) {
          if (world.getBlock(Math.floor(p.x), Math.floor(ny), Math.floor(p.z)) && S.SOLID[world.getBlock(Math.floor(p.x), Math.floor(ny), Math.floor(p.z))]) { ny = p.y; p.vy = 0; p.vx *= 0.7; p.vz *= 0.7; p.ground = true; }
          if (S.SOLID[world.getBlock(Math.floor(nx), Math.floor(p.y), Math.floor(p.z))]) { nx = p.x; p.vx = 0; }
          if (S.SOLID[world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(nz))]) { nz = p.z; p.vz = 0; }
        }
      }
      p.x = nx; p.y = ny; p.z = nz;
      p.vx *= p.drag; p.vy *= p.drag; p.vz *= p.drag;
      if (p.ground) { p.vx *= 0.7; p.vz *= 0.7; }
      ps[j++] = p;
    }
    ps.length = j;
  };
  Renderer.prototype.renderParticles = function (pt, right, up, bright, world) {
    const cam = this.cam;
    const groups = { terrain: [], particle: [], items: [] };
    for (const p of this.particles) groups[p.tex].push(p);
    const gl = this.gl;
    for (const k of ['terrain', 'particle', 'items']) {
      const list = groups[k];
      if (!list.length) continue;
      this.begin();
      for (const p of list) {
        const x = lerp(p.px, p.x, pt) - cam.x, y = lerp(p.py, p.y, pt) - cam.y, z = lerp(p.pz, p.z, pt) - cam.z;
        let size = p.size;
        let u0, v0, u1, v1;
        if (p.tex === 'particle') {
          let frame = p.frame;
          if (p.anim) frame = Math.min(7, Math.floor(p.age / p.life * 8));
          const cx = p.cellX + (p.anim ? frame : 0), cy = p.cellY;
          u0 = cx * 8 / 128; v0 = cy * 8 / 128; u1 = u0 + 8 / 128; v1 = v0 + 8 / 128;
          if (p.type === 'flame') size = p.size * (1 - Math.pow((p.age + pt) / p.life, 2) * 0.5);
          if (p.type === 'explosion' || p.type === 'smoke' || p.type === 'poof') size = p.size * Math.min(1, (p.age + pt) / p.life * 32);
        } else {
          const tile = p.tile;
          const tu = (tile & 15) * 16, tv = (tile >> 4) * 16;
          u0 = (tu + p.sub[0]) / 256; v0 = (tv + p.sub[1]) / 256; u1 = u0 + 4 / 256; v1 = v0 + 4 / 256;
        }
        let br = 1;
        if (!p.fullBright) {
          const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
          br = bright(world.getSky(bx, by, bz), world.getBlockLight(bx, by, bz));
        }
        const h = size / 2;
        const P = (a, b) => [x + right[0] * a + up[0] * b, y + right[1] * a + up[1] * b, z + right[2] * a + up[2] * b];
        const c = [p.r * br, p.g * br, p.b * br, p.a];
        this.quadV([P(-h, -h), P(h, -h), P(h, h), P(-h, h)], [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], c);
      }
      const tex = k === 'terrain' ? this.terrainTex : k === 'items' ? this.itemsTex : this.particleTex;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      this.flush('quads', { tex, alphaTest: 0.1, fog: true });
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Selection, cracks                                                */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.renderSelection = function (box) {
    if (!box) return;
    const gl = this.gl, cam = this.cam;
    M4.multiply(this.mvp, this.proj, this.view);
    const e = 0.002;
    const x0 = box[0] - e - cam.x, y0 = box[1] - e - cam.y, z0 = box[2] - e - cam.z, x1 = box[3] + e - cam.x, y1 = box[4] + e - cam.y, z1 = box[5] + e - cam.z;
    this.begin();
    const L = (a, b) => { this.vtx(a[0], a[1], a[2], 0, 0, 0, 0, 0, 0.4); this.vtx(b[0], b[1], b[2], 0, 0, 0, 0, 0, 0.4); };
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    for (let i = 0; i < 4; i++) { L(c[i], c[(i + 1) % 4]); L(c[i + 4], c[(i + 1) % 4 + 4]); L(c[i], c[i + 4]); }
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.flush('lines', {});
    gl.disable(gl.BLEND);
  };
  Renderer.prototype.renderCrack = function (box, stage) {
    const gl = this.gl, cam = this.cam;
    M4.multiply(this.mvp, this.proj, this.view);
    const tile = S.T['destroy_' + Math.max(0, Math.min(9, stage))];
    const e = 0.004;
    const b = [box[0] - e - cam.x, box[1] - e - cam.y, box[2] - e - cam.z, box[3] + e - cam.x, box[4] + e - cam.y, box[5] + e - cam.z];
    const tu = (tile & 15) / 16, tv = (tile >> 4) / 16;
    this.begin();
    for (let f = 0; f < 6; f++) {
      const fv = S.FACE_VERTS[f];
      const pts = [], uvs = [];
      for (let v = 0; v < 4; v++) {
        const c = fv[v];
        pts.push([c[0] ? b[3] : b[0], c[1] ? b[4] : b[1], c[2] ? b[5] : b[2]]);
        uvs.push([tu + S.FACE_UV[v][0] / 16, tv + S.FACE_UV[v][1] / 16]);
      }
      this.quadV(pts, uvs, [0.5, 0.5, 0.5, 1]);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.DST_COLOR, gl.SRC_COLOR);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-3, -3);
    gl.depthMask(false);
    this.flush('quads', { tex: this.terrainTex, alphaTest: 0.1 });
    gl.depthMask(true);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
  };

  /* ---------------------------------------------------------------- */
  /* First person hand                                                */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.renderHand = function (game, pt) {
    const gl = this.gl;
    const p = game.player;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const saveProj = new Float32Array(this.proj), saveView = new Float32Array(this.view);
    M4.perspective(this.proj, 70 * Math.PI / 180, this.w / this.h, 0.05, 10);
    M4.identity(this.view);
    // view bob (hand)
    if (game.settings.bobbing) {
      const walked = p.stepDist * 1.0;
      const bob = lerp(p.pbob, p.bob, pt);
      const w = -(walked + (walked - (p._pstep || walked)) * pt) * 1.6;
      M4.translate(this.view, this.view, Math.sin(w * Math.PI) * bob * 0.5, -Math.abs(Math.cos(w * Math.PI) * bob), 0);
    }
    const equip = lerp(p.pequipProgress, p.equipProgress, pt);
    const swing = p.swingTicks >= 0 ? (p.swingTicks + pt) / 6 : 0;
    const sw = Math.min(1, swing);
    const bx = Math.floor(p.x), by = Math.floor(p.y + p.eye), bz = Math.floor(p.z);
    const light = [game.world.getSky(bx, by, bz), game.world.getBlockLight(bx, by, bz)];
    const stack = p.equippedStack;
    const m = M4.create();
    const deg = Math.PI / 180;
    const sq = Math.sqrt(sw);
    if (stack) {
      const k = 0.8;
      M4.translate(m, m, -Math.sin(sq * Math.PI) * 0.4, Math.sin(sq * Math.PI * 2) * 0.2, -Math.sin(sw * Math.PI) * 0.2);
      M4.translate(m, m, 0.7 * k, -0.65 * k - (1 - equip) * 0.6, -0.9 * k);
      M4.rotateY(m, m, 45 * deg);
      M4.rotateY(m, m, -Math.sin(sw * sw * Math.PI) * 20 * deg);
      M4.rotateZ(m, m, -Math.sin(sq * Math.PI) * 20 * deg);
      M4.rotateX(m, m, -Math.sin(sq * Math.PI) * 80 * deg);
      M4.scale(m, m, 0.4, 0.4, 0.4);
      this.drawItemClassic(stack, m, light);
    } else {
      const k = 0.8;
      M4.translate(m, m, -Math.sin(sq * Math.PI) * 0.3, Math.sin(sq * Math.PI * 2) * 0.4, -Math.sin(sw * Math.PI) * 0.4);
      M4.translate(m, m, 0.8 * k, -0.75 * k - (1 - equip) * 0.6, -0.9 * k);
      M4.rotateY(m, m, 45 * deg);
      M4.rotateY(m, m, Math.sin(sq * Math.PI) * 70 * deg);
      M4.rotateZ(m, m, -Math.sin(sw * sw * Math.PI) * 20 * deg);
      M4.translate(m, m, -1, 3.6, 3.5);
      M4.rotateZ(m, m, 120 * deg);
      M4.rotateX(m, m, 200 * deg);
      M4.rotateY(m, m, -135 * deg);
      M4.translate(m, m, 5.6, 0, 0);
      this.drawModel('player', { hurtTime: 0, deathTime: 0, limbSwing: 0, limbSwingAmount: 0, prevLimbAmount: 0, swingProgress: 0 }, pt, m, light, { only: ['rarm'], raw: true, pose: { rarm: [0, 0, 0] } });
    }
    this.proj.set(saveProj); this.view.set(saveView);
  };

  /* ---------------------------------------------------------------- */
  /* Screen overlays                                                  */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.ortho = function () {
    const o = M4.create();
    M4.ortho(o, 0, this.w, this.h, 0, -10, 10);
    return o;
  };
  Renderer.prototype.overlayColor = function (r, g, b, a) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.begin();
    this.quadV([[0, this.h, 0], [this.w, this.h, 0], [this.w, 0, 0], [0, 0, 0]], null, [r, g, b, a]);
    const o = this.ortho();
    this.flush('quads', { mvp: o, mv: o });
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
  };
  Renderer.prototype.overlayTile = function (tile, br, alpha) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const tu = (tile & 15) / 16, tv = (tile >> 4) / 16;
    this.begin();
    const s = Math.max(this.w, this.h);
    this.quadV([[0, s, 0], [s, s, 0], [s, 0, 0], [0, 0, 0]], [[tu, tv + 1 / 16], [tu + 1 / 16, tv + 1 / 16], [tu + 1 / 16, tv], [tu, tv]], [br, br, br, alpha]);
    const o = this.ortho();
    this.flush('quads', { mvp: o, mv: o, tex: this.terrainTex });
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
  };
  Renderer.prototype.renderCrosshair = function (scale) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_COLOR);
    const cx = Math.floor(this.w / 2), cy = Math.floor(this.h / 2);
    const s = scale, len = 4.5 * s, th = s / 2;
    this.begin();
    const R = (x0, y0, x1, y1) => this.quadV([[x0, y1, 0], [x1, y1, 0], [x1, y0, 0], [x0, y0, 0]], null, [1, 1, 1, 1]);
    R(cx - len, cy - th, cx + len, cy + th);
    R(cx - th, cy - len, cx + th, cy - th);
    R(cx - th, cy + th, cx + th, cy + len);
    const o = this.ortho();
    this.flush('quads', { mvp: o, mv: o });
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
  };

  /* ---------------------------------------------------------------- */
  /* Menu background and 3D logo                                      */
  /* ---------------------------------------------------------------- */
  Renderer.prototype.renderMenuBackground = function (guiScale, scroll) {
    const gl = this.gl;
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    const t = 32 * guiScale;
    const off = (scroll || 0) / t;
    this.begin();
    const c = 64 / 255;
    this.quadV([[0, this.h, 0], [this.w, this.h, 0], [this.w, 0, 0], [0, 0, 0]], [[0, this.h / t + off], [this.w / t, this.h / t + off], [this.w / t, off], [0, off]], [c, c, c, 1]);
    const o = this.ortho();
    this.flush('quads', { mvp: o, mv: o, tex: this.dirtTex });
    gl.enable(gl.DEPTH_TEST);
  };

  const LOGO = {
    D: ['###.', '#..#', '#..#', '#..#', '###.'],
    R: ['###.', '#..#', '###.', '#.#.', '#..#'],
    E: ['###', '#..', '##.', '#..', '###'],
    A: ['.##.', '#..#', '####', '#..#', '#..#'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    L: ['#..', '#..', '#..', '#..', '###'],
    N: ['#...#', '##..#', '#.#.#', '#..##', '#...#']
  };
  Renderer.prototype.buildLogo = function (text) {
    const blocks = [];
    let x = 0;
    for (const ch of text) {
      const g = LOGO[ch];
      if (!g) { x += 2; continue; }
      for (let y = 0; y < 5; y++) for (let i = 0; i < g[y].length; i++) if (g[y][i] === '#') blocks.push({ x: x + i, y: 4 - y, delay: Math.random() * 1.2 + (x + i) * 0.03 });
      x += g[0].length + 1;
    }
    this.logo = { blocks, width: x - 1, start: performance.now() };
  };
  Renderer.prototype.renderLogo = function (vx, vy, vw, vh, now) {
    if (!this.logo) this.buildLogo('DREAMLAND');
    const gl = this.gl;
    const L = this.logo;
    gl.viewport(vx, this.h - vy - vh, vw, vh);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const proj = M4.create();
    const fov = 50 * Math.PI / 180;
    M4.perspective(proj, fov, vw / vh, 0.05, 200);
    const view = M4.create();
    const dist = Math.max((L.width / 2 + 0.6) / (Math.tan(fov / 2) * vw / vh), 3.4 / Math.tan(fov / 2));
    M4.translate(view, view, 0, 0, -dist);
    M4.rotateX(view, view, 0.12);
    M4.translate(view, view, -L.width / 2, -2.5, 0);
    const t = (now - L.start) / 1000;
    const mvp = M4.create();
    const sh = this.useTerrainShader(0.5);
    const saveProj = this.proj, saveView = this.view;
    gl.uniformMatrix4fv(sh.u.uProj, false, proj);
    gl.uniformMatrix4fv(sh.u.uView, false, view);
    gl.uniform3f(sh.u.uFogColor, 0, 0, 0);
    gl.uniform2f(sh.u.uFog, 1000, 2000);
    gl.uniform1f(sh.u.uFogMode, 0);
    gl.uniform1f(sh.u.uSkySub, 0);
    gl.uniform1f(sh.u.uGamma, 0);
    const m = M4.create();
    for (let pass = 0; pass < 2; pass++) {
      for (const b of L.blocks) {
        let k = Math.max(0, Math.min(1, (t - b.delay) / 0.9));
        const z = (1 - k * k) * 30 + (pass === 0 ? -0.35 : 0);
        if (k <= 0) continue;
        M4.identity(m);
        M4.translate(m, m, b.x + (pass === 0 ? 0.15 : 0), b.y - (pass === 0 ? 0.15 : 0), z);
        gl.uniformMatrix4fv(sh.u.uModel, false, m);
        gl.uniform3f(sh.u.uLightOv, 1, pass === 0 ? 0 : 15, 0);
        gl.uniform4f(sh.u.uTint, 0, 0, 0, pass === 0 ? 0.85 : 0);
        const mesh = this.blockMesh(B.stone, 0);
        this.drawTerrainBuffer(mesh.solid, mesh.solidN);
      }
    }
    gl.viewport(0, 0, this.w, this.h);
    this.proj = saveProj; this.view = saveView;
    return t > 2.5;
  };

  /* Player preview (inventory) */
  Renderer.prototype.renderPlayerPreview = function (p, rx, ry, rw, rh, lookX, lookY) {
    const gl = this.gl;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rx, this.h - ry - rh, rw, rh);
    gl.viewport(rx, this.h - ry - rh, rw, rh);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const saveProj = new Float32Array(this.proj), saveView = new Float32Array(this.view);
    M4.ortho(this.proj, -1, 1, -1.35 * rh / rw, 1.35 * rh / rw, -10, 10);
    M4.identity(this.view);
    const saveFog = [this.fogStart, this.fogEnd, this.fogMode];
    this.fogStart = 100; this.fogEnd = 200; this.fogMode = 0;
    const saveSub = this.skySub; this.skySub = 0;
    const m = M4.create();
    M4.scale(m, m, 1.0, 1.0, 1.0);
    M4.translate(m, m, 0, -1.25, 0);
    M4.scale(m, m, 1.3, 1.3, 1.3);
    const yaw = Math.atan(lookX) * 0.8;
    const fake = Object.create(p);
    fake.limbSwing = 0; fake.limbSwingAmount = 0; fake.prevLimbAmount = 0; fake.hurtTime = 0; fake.deathTime = 0;
    fake.headYawRel = Math.atan(lookX) * 0.6; fake.renderPitch = Math.atan(lookY) * 0.5;
    fake.swingProgress = 0;
    M4.rotateY(m, m, Math.PI + yaw * 0.5);
    M4.translate(m, m, 0, 24 / 16, 0);
    this.drawModel('player', fake, 1, m, [15, 15]);
    this.proj.set(saveProj); this.view.set(saveView);
    this.fogStart = saveFog[0]; this.fogEnd = saveFog[1]; this.fogMode = saveFog[2]; this.skySub = saveSub;
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, this.w, this.h);
  };

  /* Inventory block icons rendered in 3D (offscreen framebuffer) */
  Renderer.prototype.renderBlockIcon = function (id, size) {
    const gl = this.gl;
    if (!this.iconFB || this.iconSize !== size) {
      if (this.iconFB) { gl.deleteFramebuffer(this.iconFB); gl.deleteTexture(this.iconTex); gl.deleteRenderbuffer(this.iconDepth); }
      this.iconSize = size;
      this.iconTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.iconTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      this.iconDepth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.iconDepth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
      this.iconFB = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.iconFB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.iconTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.iconDepth);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.iconFB);
    gl.viewport(0, 0, size, size);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    const saveProj = new Float32Array(this.proj), saveView = new Float32Array(this.view);
    const saveFog = [this.fogStart, this.fogEnd, this.fogMode, this.skySub, this.gamma];
    this.fogStart = 100; this.fogEnd = 200; this.fogMode = 0; this.skySub = 0; this.gamma = 0;
    const h = 0.785;
    M4.ortho(this.proj, -h, h, -h, h, -10, 10);
    M4.identity(this.view);
    M4.rotateX(this.view, this.view, 30 * Math.PI / 180);
    M4.rotateY(this.view, this.view, -45 * Math.PI / 180);
    const m = M4.create();
    const R = S.RENDER[id];
    const yOff = R === S.R.SLAB || R === S.R.SNOW || R === S.R.FARMLAND ? -0.5 : -0.5;
    M4.translate(m, m, -0.5, yOff, -0.5);
    this.drawBlockMesh(id, id === B.chest || id === B.furnace || id === B.pumpkin || id === B.jack_o_lantern ? 1 : (S.RENDER[id] === S.R.STAIRS ? 0 : 0), m, [15, 15]);
    const px = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    this.proj.set(saveProj); this.view.set(saveView);
    [this.fogStart, this.fogEnd, this.fogMode, this.skySub, this.gamma] = saveFog;
    const c = DL.Tex.makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    ctx.putImageData(img, 0, 0);
    return c;
  };

  /* Animated texture upload */
  Renderer.prototype.updateAnimations = function () {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.terrainTex);
    for (const a of DL.Tex.anims) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, (a.tile & 15) * 16, (a.tile >> 4) * 16, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(a.fx.data.buffer));
    }
  };
})();
