/*
 * DreamLand - input: keyboard & mouse (pointer lock), touch controls
 * (phones / tablets / iOS), gamepads (Xbox & standard mapping) and haptics.
 */
(function () {
  const DL = window.DL;
  const In = DL.Input = {};

  In.DEFAULT_BINDS = {
    forward: 'KeyW', left: 'KeyA', back: 'KeyS', right: 'KeyD', jump: 'Space', sneak: 'ShiftLeft',
    inventory: 'KeyE', drop: 'KeyQ', chat: 'KeyT', fog: 'KeyF', perspective: 'F5', debug: 'F3', hideGui: 'F1', screenshot: 'F2', sprint: 'KeyR'
  };
  In.BIND_NAMES = {
    forward: 'Forward', left: 'Left', back: 'Back', right: 'Right', jump: 'Jump', sneak: 'Sneak', inventory: 'Inventory',
    drop: 'Drop', chat: 'Chat', fog: 'Toggle Fog', perspective: 'Perspective', debug: 'Debug Info', hideGui: 'Hide GUI', screenshot: 'Screenshot', sprint: 'Sprint'
  };
  In.binds = Object.assign({}, In.DEFAULT_BINDS);
  In.keys = new Set();
  In.mouse = { x: 0, y: 0, dx: 0, dy: 0, left: false, right: false, middle: false };
  In.locked = false;
  In.lastDevice = 'kbm';
  In.handler = null;
  In.touch = { active: new Map(), joy: null, look: null, jump: false, sneakToggle: false, move: [0, 0], breaking: false, tapUse: false, tapAttack: false, lookDX: 0, lookDY: 0 };
  In.gp = { index: -1, prev: [], buttons: [], axes: [0, 0, 0, 0], cursor: { x: 200, y: 150 }, connected: false, id: '' };
  In.isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  In.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const emit = (type, d) => { if (In.handler) In.handler(type, d || {}); };
  In.keyName = function (code) {
    if (!code) return 'NONE';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    const map = { Space: 'SPACE', ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT', ControlLeft: 'LCONTROL', ControlRight: 'RCONTROL', AltLeft: 'LMENU', Tab: 'TAB', Enter: 'RETURN', Escape: 'ESCAPE', Backspace: 'BACK', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', CapsLock: 'CAPITAL' };
    return map[code] || code.toUpperCase();
  };

  In.init = function (canvas, uiCanvas) {
    In.canvas = canvas;
    try { if ('gamepadInputEmulation' in navigator) navigator.gamepadInputEmulation = 'gamepad'; } catch (e) { /* Xbox Edge only */ }
    // hidden text input for chat / text fields (brings up soft keyboards)
    const ti = document.createElement('input');
    ti.type = 'text'; ti.id = 'textInput'; ti.autocomplete = 'off'; ti.autocapitalize = 'off'; ti.spellcheck = false;
    ti.setAttribute('autocorrect', 'off');
    ti.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;pointer-events:none;';
    document.body.appendChild(ti);
    In.textInput = ti;
    ti.addEventListener('input', () => emit('textinput', { value: ti.value }));
    ti.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        emit('textkey', { key: e.key });
      }
      e.stopPropagation();
    });
    // iOS haptic trick: toggling a native switch triggers a system haptic tick
    if (In.isIOS) {
      const label = document.createElement('label');
      label.style.cssText = 'position:fixed;left:-100px;top:-100px;opacity:0;pointer-events:none;';
      const sw = document.createElement('input');
      sw.type = 'checkbox'; sw.setAttribute('switch', '');
      label.appendChild(sw);
      document.body.appendChild(label);
      In.iosHaptic = label;
    }

    window.addEventListener('keydown', (e) => {
      if (document.activeElement === ti) return;
      // a text box is open but lost the keyboard (a click elsewhere, a frame switch): hand the keys back to it
      if (In.wantsText && In.wantsText() && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter')) {
        e.preventDefault();
        ti.style.pointerEvents = 'auto'; ti.focus();
        if (e.key === 'Enter') { emit('textkey', { key: 'Enter' }); return; }
        ti.value = e.key === 'Backspace' ? ti.value.slice(0, -1) : ti.value + e.key;
        try { ti.setSelectionRange(ti.value.length, ti.value.length); } catch (err) { /* ignore */ }
        emit('textinput', { value: ti.value });
        return;
      }
      In.lastDevice = 'kbm';
      const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F1', 'F2', 'F3', 'F5', 'Slash', 'Quote', 'Backspace'];
      if (block.includes(e.code) || (e.ctrlKey && e.code === 'KeyS')) e.preventDefault();
      if (!e.repeat) In.keys.add(e.code);
      emit('keydown', { code: e.code, key: e.key, repeat: e.repeat, shift: e.shiftKey, ctrl: e.ctrlKey, t: e.timeStamp || performance.now() });
    });
    window.addEventListener('keyup', (e) => {
      In.keys.delete(e.code);
      emit('keyup', { code: e.code });
    });
    window.addEventListener('blur', () => { In.keys.clear(); In.mouse.left = In.mouse.right = false; emit('blur'); });

    // the focused frame is the one browsers send controller input to
    window.addEventListener('pointerdown', () => { try { window.focus(); } catch (e) { /* ignore */ } }, true);
    const pos = (e) => [e.clientX, e.clientY];
    uiCanvas.addEventListener('mousedown', (e) => {
      if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      In.lastDevice = 'kbm';
      const [x, y] = pos(e);
      In.mouse.x = x; In.mouse.y = y;
      if (e.button === 0) In.mouse.left = true;
      if (e.button === 2) In.mouse.right = true;
      if (e.button === 1) { In.mouse.middle = true; e.preventDefault(); }
      emit('mousedown', { x, y, button: e.button, shift: e.shiftKey });
      // a text field just took the keyboard: keep the click from moving focus back to the canvas
      if (document.activeElement === ti) e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      const [x, y] = pos(e);
      if (e.button === 0) In.mouse.left = false;
      if (e.button === 2) In.mouse.right = false;
      if (e.button === 1) In.mouse.middle = false;
      emit('mouseup', { x, y, button: e.button });
    });
    window.addEventListener('mousemove', (e) => {
      if (In.locked) {
        In.mouse.dx += e.movementX || 0; In.mouse.dy += e.movementY || 0;
      } else {
        In.mouse.x = e.clientX; In.mouse.y = e.clientY;
        emit('mousemove', { x: e.clientX, y: e.clientY });
      }
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) In.lastDevice = In.lastDevice === 'touch' ? 'touch' : 'kbm';
    });
    uiCanvas.addEventListener('wheel', (e) => { e.preventDefault(); emit('wheel', { delta: Math.sign(e.deltaY) }); }, { passive: false });
    uiCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = In.locked;
      In.locked = document.pointerLockElement === uiCanvas;
      // a lock that lands after a menu opened would trap the menu's cursor: give it straight back
      if (In.locked && In.wantsCursor && In.wantsCursor()) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
      if (was && !In.locked) emit('unlock');
    });
    document.addEventListener('pointerlockerror', () => { In.locked = false; });

    // touch
    const opt = { passive: false };
    uiCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); In.lastDevice = 'touch'; DL.Audio.unlock(); for (const t of e.changedTouches) In.touchStart(t); }, opt);
    uiCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) In.touchMove(t); }, opt);
    uiCanvas.addEventListener('touchend', (e) => { e.preventDefault(); for (const t of e.changedTouches) In.touchEnd(t, false); }, opt);
    uiCanvas.addEventListener('touchcancel', (e) => { e.preventDefault(); for (const t of e.changedTouches) In.touchEnd(t, true); }, opt);
    // gestures on iOS
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());

    // a pad that merely connects (or a phantom device) does not switch the game to controller mode: using it does
    window.addEventListener('gamepadconnected', (e) => {
      In.gp.connected = true; In.gp.id = e.gamepad.id;
      In.getPad();
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index === In.gp.index) { In.gp.index = -1; In.gp.connected = false; }
      emit('gamepad', { connected: false });
    });
  };

  In.requestLock = function () {
    if (In.lastDevice === 'touch' || In.lastDevice === 'gamepad') return;
    const c = document.getElementById('ui');
    if (c && c.requestPointerLock && !In.locked) {
      try { const p = c.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { c.requestPointerLock(); } catch (e) { /* ignore */ } }); } catch (e) { try { c.requestPointerLock(); } catch (e2) { /* ignore */ } }
    }
  };
  In.releaseLock = function () { if (document.exitPointerLock && In.locked) document.exitPointerLock(); };
  In.down = function (action) { const c = In.binds[action]; return c ? In.keys.has(c) : false; };

  /* ------------------------------------------------------------ */
  /* Touch                                                        */
  /* ------------------------------------------------------------ */
  In.touchStart = function (t) {
    const x = t.clientX, y = t.clientY;
    const T = In.touch;
    const info = { id: t.identifier, sx: x, sy: y, x, y, t0: performance.now(), moved: 0, role: null };
    T.active.set(t.identifier, info);
    if (!In.gameTouchActive || !In.gameTouchActive()) {
      info.role = 'ui';
      emit('mousedown', { x, y, button: 0, touch: true, id: t.identifier });
      return;
    }
    const L = In.touchLayout ? In.touchLayout() : null;
    const hit = (r) => r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
    if (L) {
      for (const b of L.buttons) {
        if (hit(b)) {
          info.role = 'button'; info.button = b.id;
          if (b.id === 'jump') T.jump = true;
          else emit('touchbutton', { id: b.id, down: true });
          In.haptic('tick', true);
          return;
        }
      }
      if (hit(L.hotbar)) { info.role = 'hotbar'; emit('touchhotbar', { x, y, start: true, id: t.identifier }); return; }
      if (x < L.joyZone && !T.joy) {
        info.role = 'joy';
        T.joy = { id: t.identifier, cx: x, cy: y, x, y, r: L.joyRadius };
        return;
      }
    }
    info.role = 'look';
    if (!T.look) T.look = info;
  };
  In.touchMove = function (t) {
    const T = In.touch;
    const info = T.active.get(t.identifier);
    if (!info) return;
    const dx = t.clientX - info.x, dy = t.clientY - info.y;
    info.x = t.clientX; info.y = t.clientY;
    info.moved += Math.abs(dx) + Math.abs(dy);
    if (info.role === 'ui') { emit('mousemove', { x: info.x, y: info.y, touch: true }); return; }
    if (info.role === 'joy' && T.joy) {
      T.joy.x = info.x; T.joy.y = info.y;
      let jx = info.x - T.joy.cx, jy = info.y - T.joy.cy;
      const l = Math.hypot(jx, jy);
      if (l > T.joy.r * 1.6) { T.joy.cx += jx / l * (l - T.joy.r * 1.6); T.joy.cy += jy / l * (l - T.joy.r * 1.6); }
      return;
    }
    if (info.role === 'look') { T.lookDX += dx; T.lookDY += dy; }
    if (info.role === 'hotbar') emit('touchhotbar', { x: info.x, y: info.y, move: true, id: t.identifier });
  };
  In.touchEnd = function (t, cancel) {
    const T = In.touch;
    const info = T.active.get(t.identifier);
    if (!info) return;
    T.active.delete(t.identifier);
    const dt = performance.now() - info.t0;
    if (info.role === 'ui') { emit('mouseup', { x: info.x, y: info.y, button: 0, touch: true, id: t.identifier, dt }); return; }
    if (info.role === 'button') {
      if (info.button === 'jump') T.jump = false;
      else emit('touchbutton', { id: info.button, down: false });
      return;
    }
    if (info.role === 'joy') { T.joy = null; return; }
    if (info.role === 'hotbar') { emit('touchhotbar', { x: info.x, y: info.y, end: true, dt, id: t.identifier }); return; }
    if (info.role === 'look') {
      if (T.look === info) T.look = null;
      if (!cancel && dt < 280 && info.moved < 14 && !info.brokeBlock) {
        T.tap = true;
        In.haptic('tick', true);
      }
    }
  };
  /** Per-frame touch evaluation. */
  In.updateTouch = function () {
    const T = In.touch;
    T.move = [0, 0]; T.sprint = false;
    if (T.joy) {
      let jx = (T.joy.x - T.joy.cx) / T.joy.r, jy = (T.joy.y - T.joy.cy) / T.joy.r;
      const l = Math.hypot(jx, jy);
      T.sprint = l > 1.3 && -jy / l > 0.8; // pushed past the ring, straight ahead
      if (l > 1) { jx /= l; jy /= l; }
      if (l > 0.12) T.move = [jx, -jy];
    }
    T.breaking = false;
    if (T.look) {
      const held = performance.now() - T.look.t0;
      if (held > 300 && T.look.moved < 40 + held * 0.05) { T.breaking = true; T.look.brokeBlock = true; }
      else if (T.look.brokeBlock) T.breaking = true;
    }
  };

  /* ------------------------------------------------------------ */
  /* Gamepad                                                      */
  /* ------------------------------------------------------------ */
  const GPB = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16 };
  In.GPB = GPB;
  // Controller access can be switched off by the page that embeds the game (permissions policy).
  In.padBlocked = (function () {
    try {
      const fp = document.permissionsPolicy || document.featurePolicy;
      if (fp && fp.allowsFeature && !fp.allowsFeature('gamepad')) return true;
    } catch (e) { /* ignore */ }
    return !navigator.getGamepads;
  })();
  function readPads() {
    if (!navigator.getGamepads) return [];
    try { return Array.from(navigator.getGamepads() || []); } catch (e) { In.padBlocked = true; return []; }
  }
  In.readPads = readPads;
  /** Why a controller does or does not work here, in words a player can act on. */
  In.padStatus = function () {
    const host = location.hostname || '';
    if (window.isSecureContext === false) return { state: 'insecure', text: 'Controllers need a secure address: open http://localhost:' + (location.port || '8080') + ' on this PC', color: '#FF9090' };
    if (!navigator.getGamepads) return { state: 'unsupported', text: 'This browser has no controller support: use Edge, Chrome or Firefox', color: '#FF9090' };
    if (In.padBlocked && In.embedded) return { state: 'blocked', text: 'This window blocks controllers: click here to open DreamLand in its own tab', color: '#FFB060' };
    const pads = readPads().filter(q => q && q.connected !== false);
    const live = In.gp.connected && pads.find(q => q.index === In.gp.index);
    if (live) { const s = seen.get(live.index); const name = live.id.replace(/\s*\(.*$/, '').slice(0, 40) || 'Controller'; return s && s.used ? { state: 'ready', text: 'Controller ready: ' + name, color: '#80FF80' } : { state: 'listed', text: name + ' found: press A', color: '#E0E060' }; }
    void host;
    return { state: 'waiting', text: 'Controller: click the game once, then press A (Options > Controller Test)', color: '#C0C0C0' };
  };
  In.embedded = (function () { try { return window.top !== window; } catch (e) { return true; } })();
  // Every pad we have seen: resting axes (so stuck axes on phantom devices never count as input) and when it was last used.
  const seen = new Map();
  const XBOXY = /xbox|xinput|045e|microsoft|standard gamepad/i;
  function padInfo(p) {
    let s = seen.get(p.index);
    if (!s || s.id !== p.id) {
      s = { id: p.id, rest: Array.from(p.axes, a => Math.abs(a) > 0.5 ? a : 0), used: 0, announced: false };
      seen.set(p.index, s);
    }
    return s;
  }
  function active(p, s) {
    for (const b of p.buttons) if ((typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5)) return true;
    for (let i = 0; i < p.axes.length; i++) if (Math.abs((p.axes[i] || 0) - (s.rest[i] || 0)) > 0.5) return true;
    return false;
  }
  In.getPad = function () {
    let best = null, bestScore = -1;
    const now = performance.now();
    for (const p of readPads()) {
      if (!p || p.connected === false) continue;
      const s = padInfo(p);
      if (active(p, s)) s.used = now;
      // the pad that was used last wins; before any input, prefer a real Xbox / standard pad
      const score = s.used * 10 + (p.mapping === 'standard' ? 2 : 0) + (XBOXY.test(p.id) ? 1 : 0);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) {
      In.gp.index = best.index; In.gp.connected = true; In.gp.id = best.id; In.gp.mapping = best.mapping || '';
      const s = seen.get(best.index);
      if (s && s.used && !s.announced) { s.announced = true; emit('gamepad', { connected: true, id: best.id }); }
    } else In.gp.connected = false;
    return best;
  };
  In.padRest = (p) => padInfo(p).rest;
  const btnVal = (b) => (b === undefined ? 0 : typeof b === 'object' ? (b.pressed && !b.value ? 1 : b.value) : b);
  In.btnVal = btnVal;
  // Custom layouts made with the Remap Buttons screen, by controller name.
  In.padMaps = {};
  const HAT_STEP = 2 / 7;
  const hatDir = (v) => (v >= -1.05 && v <= 1.05 ? ((Math.round((v + 1) / HAT_STEP) % 8) + 8) % 8 : -1);
  /** One mapped input: {b} a button, {a, v, r} an axis pushed from r towards v, {a, h} a d-pad hat direction. */
  function srcVal(src, raw, a) {
    if (!src) return 0;
    if (src.b !== undefined) return raw[src.b] || 0;
    const x = a[src.a];
    if (x === undefined) return 0;
    if (src.h !== undefined) { const d = hatDir(x); return d < 0 ? 0 : (d === src.h || d === (src.h + 1) % 8 || d === (src.h + 7) % 8) ? 1 : 0; }
    const span = src.v - src.r;
    return Math.abs(span) < 0.2 ? 0 : Math.max(0, Math.min(1, (x - src.r) / span));
  }
  function applyMap(p, map) {
    const raw = Array.from(p.buttons, btnVal), a = Array.from(p.axes);
    const b = new Array(17).fill(0);
    for (let i = 0; i < 17; i++) b[i] = srcVal(map.b && map.b[i], raw, a);
    const ax = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) { const s = map.ax && map.ax[i]; if (s && a[s.a] !== undefined) ax[i] = Math.max(-1, Math.min(1, a[s.a] * s.s)); }
    return { buttons: b, axes: ax };
  }
  /** Buttons and sticks in the standard (Xbox) layout, whatever layout the browser reports. */
  function standardize(p) {
    const custom = In.padMaps && In.padMaps[p.id];
    if (custom) return applyMap(p, custom);
    const raw = Array.from(p.buttons, btnVal), a = Array.from(p.axes);
    if (p.mapping === 'standard' || (raw.length >= 17 && a.length <= 4)) return { buttons: raw, axes: [a[0] || 0, a[1] || 0, a[2] || 0, a[3] || 0] };
    // Xbox One / Series pads over Bluetooth seen as plain HID (DirectInput): A B _ X Y _ LB RB _ _ View Menu Xbox LS RS,
    // sticks on axes 0-1 and 2-5 (or 2-3), triggers on two of the remaining axes and the d-pad on a hat.
    if (/045e/i.test(p.id) && raw.length >= 15 && raw.length <= 17) {
      const b = new Array(17).fill(0);
      const map = [0, 1, -1, 2, 3, -1, 4, 5, -1, -1, 8, 9, 16, 10, 11];
      for (let i = 0; i < map.length; i++) if (map[i] >= 0) b[map[i]] = raw[i] || 0;
      const rest = padInfo(p).rest;
      // a trigger travels away from wherever it rests (-1, 0 or 1)
      const trig = (i) => { const x = a[i], r = rest[i] || 0; if (x === undefined) return 0; return Math.max(0, Math.min(1, r > 0.5 ? (r - x) / (r + 1) : (x - r) / (1 - r))); };
      let rx = a[2] || 0, ry = a[3] || 0;
      if (a.length >= 6) { rx = a[2] || 0; ry = a[5] || 0; b[6] = trig(3); b[7] = trig(4); }
      const last = a.length - 1, hat = a.length >= 7 && (rest[last] || 0) > 1.05 ? hatDir(a[last]) : -1;
      if (hat >= 0) { b[12] = hat === 7 || hat <= 1 ? 1 : 0; b[15] = hat >= 1 && hat <= 3 ? 1 : 0; b[13] = hat >= 3 && hat <= 5 ? 1 : 0; b[14] = hat >= 5 && hat <= 7 ? 1 : 0; }
      return { buttons: b, axes: [a[0] || 0, a[1] || 0, rx, ry] };
    }
    // Common raw Xbox layout (Firefox, older drivers): axes lx, ly, lt, rx, ry, rt, dpad x, dpad y;
    // buttons A B X Y LB RB View Menu Xbox LS RS.
    const b = new Array(17).fill(0);
    const map = [0, 1, 2, 3, 4, 5, 8, 9, 16, 10, 11];
    for (let i = 0; i < map.length && i < raw.length; i++) b[map[i]] = raw[i];
    let rx = a[3] || 0, ry = a[4] || 0;
    if (a.length >= 6) {
      b[6] = Math.max(b[6], ((a[2] || -1) + 1) / 2); b[7] = Math.max(b[7], ((a[5] || -1) + 1) / 2);
    } else { rx = a[2] || 0; ry = a[3] || 0; }
    if (a.length >= 8) { b[14] = a[6] < -0.5 ? 1 : 0; b[15] = a[6] > 0.5 ? 1 : 0; b[12] = a[7] < -0.5 ? 1 : 0; b[13] = a[7] > 0.5 ? 1 : 0; }
    if (raw.length >= 15) for (let i = 12; i <= 15; i++) b[i] = Math.max(b[i], raw[i] || 0);
    return { buttons: b, axes: [a[0] || 0, a[1] || 0, rx, ry] };
  }
  In.pollGamepad = function () {
    const p = In.getPad();
    const G = In.gp;
    G.prev = G.buttons.slice();
    if (!p) { G.buttons = []; G.axes = [0, 0, 0, 0]; return; }
    const st = standardize(p);
    G.buttons = st.buttons;
    const dz = (x, y) => {
      const l = Math.hypot(x, y);
      if (l < 0.16) return [0, 0];
      const k = Math.min(1, (l - 0.16) / 0.84) / l;
      return [x * k, y * k];
    };
    const a = st.axes;
    const [lx, ly] = dz(a[0], a[1]);
    const [rx, ry] = dz(a[2], a[3]);
    G.axes = [lx, ly, rx, ry];
    const any = G.buttons.some(v => v > 0.3) || Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0.2;
    if (any && In.lastDevice !== 'gamepad') { In.lastDevice = 'gamepad'; emit('devicechange', { device: 'gamepad' }); }
    for (let i = 0; i < G.buttons.length; i++) {
      const now = G.buttons[i] > 0.5, was = (G.prev[i] || 0) > 0.5;
      if (now && !was) emit('padbutton', { button: i, down: true });
      else if (!now && was) emit('padbutton', { button: i, down: false });
    }
  };
  In.standardize = standardize;
  In.padDown = (b) => (In.gp.buttons[b] || 0) > 0.5;
  In.padValue = (b) => In.gp.buttons[b] || 0;

  /* ------------------------------------------------------------ */
  /* Haptics                                                      */
  /* ------------------------------------------------------------ */
  In.hapticsEnabled = true;
  const HAPTIC = {
    tick: [18, 0.0, 0.18], place: [35, 0.1, 0.3], dig: [22, 0.05, 0.15], break: [70, 0.35, 0.55], hit: [90, 0.5, 0.7],
    hurt: [220, 0.9, 1.0], land: [120, 0.7, 0.4], explode: [650, 1.0, 1.0], pickup: [25, 0.0, 0.25], death: [700, 1, 0.6], bow: [80, 0.2, 0.7]
  };
  In.haptic = function (kind, inGesture) {
    if (!In.hapticsEnabled) return;
    const h = HAPTIC[kind] || HAPTIC.tick;
    const [ms, strong, weak] = h;
    if (In.lastDevice === 'gamepad') {
      const p = In.getPad();
      if (!p) return;
      const va = p.vibrationActuator;
      try {
        if (va && va.playEffect) {
          const effects = va.effects || [];
          if ((kind === 'hit' || kind === 'dig' || kind === 'break' || kind === 'bow') && effects.includes && effects.includes('trigger-rumble')) {
            va.playEffect('trigger-rumble', { duration: ms, startDelay: 0, strongMagnitude: strong, weakMagnitude: weak, leftTrigger: kind === 'bow' ? 0.6 : 0, rightTrigger: kind === 'bow' ? 0 : Math.max(0.3, weak) });
          }
          va.playEffect('dual-rumble', { duration: ms, startDelay: 0, strongMagnitude: strong, weakMagnitude: weak });
        } else if (p.hapticActuators && p.hapticActuators[0]) {
          p.hapticActuators[0].pulse(Math.max(strong, weak), ms);
        }
      } catch (e) { /* unsupported */ }
      return;
    }
    if (In.lastDevice === 'touch') {
      if (navigator.vibrate) { try { navigator.vibrate(Math.max(10, Math.round(ms * (strong + weak)))); } catch (e) { /* ignore */ } }
      else if (In.iosHaptic && inGesture) { try { In.iosHaptic.click(); } catch (e) { /* ignore */ } }
    }
  };
})();
