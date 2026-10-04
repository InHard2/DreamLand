/*
 * DreamLand - the controller test and remap screens.
 * Shows every controller the browser can see, live, on a drawing of an Xbox pad, explains why one
 * might be missing, and lets any controller be taught the Xbox layout one button at a time.
 */
(function () {
  'use strict';
  const DL = window.DL, G = DL.GUI, In = DL.Input, F = DL.Font, A = DL.Audio;
  const P = In.GPB;
  const NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', 'Up', 'Down', 'Left', 'Right', 'Xbox'];
  const short = (id) => {
    id = String(id || '');
    const v = /Vendor:\s*([0-9a-f]{4})\s*Product:\s*([0-9a-f]{4})/i.exec(id) || /^([0-9a-f]{4})-([0-9a-f]{4})-/i.exec(id);
    const name = id.replace(/\s*\(.*$/, '').replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '').trim() || 'Controller';
    return (name.slice(0, 40) + (v ? ' [' + v[1] + ':' + v[2] + ']' : '')).trim();
  };
  const activePad = () => { const p = In.getPad(); return p && p.connected !== false ? p : null; };
  const findPad = (index, id) => In.readPads().find(p => p && p.index === index && p.id === id) || null;
  function rumble(p, ms, strong, weak) {
    try {
      if (p && p.vibrationActuator && p.vibrationActuator.playEffect) p.vibrationActuator.playEffect('dual-rumble', { duration: ms, startDelay: 0, strongMagnitude: strong, weakMagnitude: weak });
      else if (p && p.hapticActuators && p.hapticActuators[0]) p.hapticActuators[0].pulse(Math.max(strong, weak), ms);
    } catch (e) { /* not supported */ }
  }

  /* ------------------------------------------------------------ */
  /* A drawing of an Xbox controller, lit by what is pressed      */
  /* ------------------------------------------------------------ */
  function drawPad(cx, cy, k, b, ax) {
    const ctx = G.ctx;
    const on = (i) => (b[i] || 0) > 0.5;
    const circle = (x, y, r, fill, stroke) => { ctx.beginPath(); ctx.arc(cx + x * k, cy + y * k, r * k, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, k); ctx.stroke(); } };
    const rrect = (x, y, w, h, r, fill) => {
      ctx.beginPath();
      const X = cx + x * k, Y = cy + y * k, Wd = w * k, H = h * k, R = Math.min(r * k, Wd / 2, H / 2);
      ctx.moveTo(X + R, Y); ctx.arcTo(X + Wd, Y, X + Wd, Y + H, R); ctx.arcTo(X + Wd, Y + H, X, Y + H, R); ctx.arcTo(X, Y + H, X, Y, R); ctx.arcTo(X, Y, X + Wd, Y, R); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    };
    const label = (s, x, y, col) => { G.textC(s, cx + x * k, cy + y * k - 4, col || '#FFFFFF', false); };
    // triggers: fill with how far they are pulled
    for (const [i, x] of [[P.LT, -62], [P.RT, 38]]) {
      const v = Math.max(0, Math.min(1, b[i] || 0));
      rrect(x, -62, 24, 12, 3, '#303030');
      if (v > 0.02) rrect(x, -62 + 12 * (1 - v), 24, 12 * v, 3, v > 0.5 ? '#7CFC6A' : '#3A8A34');
      label(NAMES[i], x + 12, -56, '#E0E0E0');
    }
    // bumpers
    rrect(-66, -46, 34, 9, 4, on(P.LB) ? '#7CFC6A' : '#4A4A4A'); label('LB', -49, -41.5);
    rrect(32, -46, 34, 9, 4, on(P.RB) ? '#7CFC6A' : '#4A4A4A'); label('RB', 49, -41.5);
    // body and grips
    circle(-48, 22, 26, '#2B2B2B'); circle(48, 22, 26, '#2B2B2B');
    rrect(-74, -38, 148, 54, 22, '#2B2B2B');
    rrect(-70, -35, 140, 46, 19, '#363636');
    // left stick
    const stick = (x, y, sx, sy, pressed) => {
      circle(x, y, 13, '#1E1E1E');
      circle(x + sx * 7, y + sy * 7, 8, pressed ? '#7CFC6A' : '#5A5A5A', '#8A8A8A');
    };
    stick(-44, -14, ax[0], ax[1], on(P.LS));
    stick(22, 14, ax[2], ax[3], on(P.RS));
    // d-pad
    const dp = (x, y, w, h, lit) => rrect(-22 + x, 14 + y, w, h, 1.5, lit ? '#7CFC6A' : '#5A5A5A');
    circle(-22 + 0, 14 + 0, 13, '#1E1E1E');
    dp(-3, -11, 6, 8, on(P.UP)); dp(-3, 3, 6, 8, on(P.DOWN)); dp(-11, -3, 8, 6, on(P.LEFT)); dp(3, -3, 8, 6, on(P.RIGHT));
    // A B X Y
    const face = [[P.Y, 0, -10, '#E8C21C'], [P.B, 10, 0, '#D8342C'], [P.A, 0, 10, '#4CB73A'], [P.X, -10, 0, '#2C6FD8']];
    for (const [i, x, y, c] of face) {
      const lit = on(i);
      circle(44 + x, -14 + y, 6.2, lit ? c : '#1E1E1E', lit ? '#FFFFFF' : c);
      label(NAMES[i], 44 + x, -14 + y + 0.5, lit ? '#FFFFFF' : c);
    }
    // View, Menu, Xbox
    circle(-12, -14, 3.6, on(P.BACK) ? '#7CFC6A' : '#5A5A5A');
    circle(12, -14, 3.6, on(P.START) ? '#7CFC6A' : '#5A5A5A');
    circle(0, -27, 6, on(P.HOME) ? '#7CFC6A' : '#1E1E1E', '#9A9A9A');
  }

  /* ------------------------------------------------------------ */
  /* Controller Test                                              */
  /* ------------------------------------------------------------ */
  class ControllerScreen extends G.Screen {
    constructor(game, parent) { super(game, parent); this.last = ''; this.lastT = 0; this.hold = { b: 0, y: 0 }; this.t0 = performance.now(); }
    get pauses() { return this.parent ? this.parent.pauses : true; }
    layout() {
      this.widgets = [];
      const n = 4, gap = 4, w = Math.min(100, (G.W - 16 - G.safe.l - G.safe.r - gap * (n - 1)) / n), total = w * n + gap * (n - 1);
      const x0 = G.W / 2 - total / 2, y = G.H - 26 - G.safe.b;
      this.remapBtn = this.btn('Remap Buttons...', x0, y, w, 20, () => this.remap());
      this.resetBtn = this.btn('Reset Layout', x0 + (w + gap), y, w, 20, () => {
        const p = activePad();
        if (p && In.padMaps[p.id]) { delete In.padMaps[p.id]; this.game.saveSettings(); G.notice('Back to the built-in layout'); }
      });
      this.btn('Rumble', x0 + (w + gap) * 2, y, w, 20, () => rumble(activePad(), 400, 1, 0.6));
      this.btn('Done', x0 + (w + gap) * 3, y, w, 20, () => this.back());
      this.focus = -1;
    }
    remap() { const p = activePad(); if (p) this.game.setScreen(new RemapScreen(this.game, this, p)); else G.notice('Press a button on the controller first'); }
    // every button is being tested here, so the pad does not drive the menu: hold B to leave, hold Y to remap
    padButton() { }
    stickNav() { }
    draw(mx, my) {
      if (this.showWorld) G.dim();
      const W = G.W, H = G.H, top = 6 + G.safe.t, now = performance.now();
      G.textC('Controller Test', W / 2, top, '#FFFFFF');
      const pads = In.readPads().filter(p => p && p.connected !== false);
      const p = activePad();
      this.remapBtn.enabled = !!p;
      this.resetBtn.enabled = !!(p && In.padMaps[p.id]);
      let y = top + 13;
      const line = (s, col) => { G.textC(s, W / 2, y, col || '#A0A0A0'); y += 10; };
      if (window.isSecureContext === false) { line('Browsers only allow controllers on secure addresses.', '#FF8080'); line('On this PC open http://localhost:' + (location.port || '8080') + ' instead of ' + location.host + '.', '#FF8080'); }
      else if (!navigator.getGamepads) line('This browser has no controller support. Try Chrome, Edge or Firefox.', '#FF8080');
      else if (In.padBlocked && In.embedded) {
        line('The page this game is embedded in blocks controllers.', '#FF8080');
        line('Open DreamLand in its own tab (or the downloaded copy) to use one.', '#FF8080');
      } else if (!pads.length) {
        const blink = Math.floor(now / 500) % 2 === 0;
        line('No controller yet: click this window once, then press A.', blink ? '#FFFF60' : '#E0E040');
        line('Browsers only reveal a controller after a button is pressed.');
        line('Still nothing? Plug it in with a cable, or close Steam / DS4Windows', '#808080');
        line('(they can take over the controller), then reload the page.', '#808080');
        if (In.embedded) line('Playing inside another app? Open DreamLand in Edge or Chrome instead.', '#808080');
        else {
          // works somewhere else but not in this browser: an extension or the browser itself is hiding it
          line('Works elsewhere but not here? Try a private window (Ctrl+Shift+N):', '#808080');
          line('if it works there, a browser extension is hiding the controller. Or try Edge.', '#808080');
        }
        const ua = navigator.userAgent, br = /Edg\/(\d+)/.exec(ua) ? 'Edge ' + /Edg\/(\d+)/.exec(ua)[1] : /Chrome\/(\d+)/.exec(ua) ? 'Chrome ' + /Chrome\/(\d+)/.exec(ua)[1] : /Firefox\/(\d+)/.exec(ua) ? 'Firefox ' + /Firefox\/(\d+)/.exec(ua)[1] : 'browser';
        let slots = 0; try { slots = (navigator.getGamepads() || []).length; } catch (e) { slots = -1; }
        line(br + ', ' + (location.protocol === 'file:' ? 'file' : location.host || 'page') + ', DreamLand v' + DL.VERSION + ', ' + slots + ' slots, none in use', '#606060');
      } else {
        for (const q of pads.slice(0, 4)) {
          const act = p && q.index === p.index;
          const kind = In.padMaps[q.id] ? 'your layout' : q.mapping === 'standard' ? 'standard layout' : 'raw layout';
          line((act ? '> ' : '  ') + '#' + q.index + ' ' + short(q.id) + ' - ' + kind, act ? '#80FF80' : '#909090');
        }
      }
      // the drawing, using the layout the game uses
      const st = p ? In.standardize(p) : { buttons: [], axes: [0, 0, 0, 0] };
      const bb = st.buttons, ax = st.axes;
      const avail = H - y - 70 - G.safe.b;
      const k = Math.max(0.6, Math.min(1.6, avail / 130, (W - 20) / 170));
      const cy = y + 66 * k;
      drawPad(W / 2, cy, k, bb, ax);
      // what was pressed last
      for (let i = 0; i < bb.length && i < NAMES.length; i++) if ((bb[i] || 0) > 0.5) { this.last = NAMES[i]; this.lastT = now; }
      let ty = cy + 50 * k;
      if (p) {
        const pressed = NAMES.filter((n, i) => (bb[i] || 0) > 0.5).join(' ');
        const sticks = 'L ' + ax[0].toFixed(2) + ' ' + ax[1].toFixed(2) + '   R ' + ax[2].toFixed(2) + ' ' + ax[3].toFixed(2);
        G.textC(pressed ? 'Pressed: ' + pressed : this.last && now - this.lastT < 2500 ? 'Last: ' + this.last : 'Press any button', W / 2, ty, pressed ? '#80FF80' : '#C0C0C0'); ty += 10;
        G.textC('Sticks: ' + sticks, W / 2, ty, '#909090'); ty += 10;
        const raw = Array.from(p.buttons, In.btnVal).map((v, i) => (v > 0.5 ? i : -1)).filter(i => i >= 0);
        const rawAx = Array.from(p.axes).slice(0, 10).map(v => v.toFixed(2)).join(' ');
        G.textC('Raw: buttons [' + raw.join(',') + '] of ' + p.buttons.length + '  axes ' + rawAx, W / 2, ty, '#707070'); ty += 10;
        G.textC('Wrong buttons? Remap them. Hold B to go back, hold Y to remap.', W / 2, ty, '#808080');
        // holding B / Y
        const dt = Math.min(0.1, (now - (this._t || now)) / 1000); this._t = now;
        for (const [key, btn, act] of [['b', P.B, () => this.back()], ['y', P.Y, () => this.remap()]]) {
          if ((bb[btn] || 0) > 0.5) { this.hold[key] += dt; if (this.hold[key] > 0.9) { this.hold[key] = -99; act(); return; } } else this.hold[key] = 0;
          if (this.hold[key] > 0.15) G.rect(W / 2 - 40, ty + 10, 80 * Math.min(1, this.hold[key] / 0.9), 2, '#80FF80');
        }
      }
      this.drawWidgets(mx, my);
    }
  }
  G.ControllerScreen = ControllerScreen;

  /* ------------------------------------------------------------ */
  /* Remap: teach the game a controller, one input at a time      */
  /* ------------------------------------------------------------ */
  const STEPS = [
    ['b', P.A, 'Press A (the bottom face button)'], ['b', P.B, 'Press B (the right face button)'],
    ['b', P.X, 'Press X (the left face button)'], ['b', P.Y, 'Press Y (the top face button)'],
    ['b', P.LB, 'Press LB (left bumper)'], ['b', P.RB, 'Press RB (right bumper)'],
    ['b', P.LT, 'Pull LT (left trigger) all the way'], ['b', P.RT, 'Pull RT (right trigger) all the way'],
    ['b', P.BACK, 'Press View (small button, left)'], ['b', P.START, 'Press Menu (small button, right)'],
    ['b', P.LS, 'Click the left stick in'], ['b', P.RS, 'Click the right stick in'],
    ['b', P.UP, 'Press the d-pad UP'], ['b', P.DOWN, 'Press the d-pad DOWN'], ['b', P.LEFT, 'Press the d-pad LEFT'], ['b', P.RIGHT, 'Press the d-pad RIGHT'],
    ['ax', 0, 'Push the left stick RIGHT'], ['ax', 1, 'Push the left stick DOWN'],
    ['ax', 2, 'Push the right stick RIGHT'], ['ax', 3, 'Push the right stick DOWN']
  ];
  const HAT_STEP = 2 / 7;
  const hatDir = (v) => (((Math.round((v + 1) / HAT_STEP) % 8) + 8) % 8);
  class RemapScreen extends G.Screen {
    constructor(game, parent, pad) {
      super(game, parent);
      this.index = pad.index; this.id = pad.id;
      this.rest = Array.from(pad.axes, a => (Math.abs(a) > 0.5 ? a : 0));
      this.map = { b: new Array(17).fill(null), ax: [null, null, null, null] };
      this.step = 0; this.armed = false; this.t0 = performance.now(); this.flash = 0;
    }
    get pauses() { return this.parent ? this.parent.pauses : true; }
    layout() {
      this.widgets = [];
      const y = G.H - 26 - G.safe.b;
      this.btn('Skip', G.W / 2 - 154, y, 100, 20, () => this.next(null));
      this.btn('Start Over', G.W / 2 - 50, y, 100, 20, () => { this.step = 0; this.map = { b: new Array(17).fill(null), ax: [null, null, null, null] }; this.armed = false; });
      this.btn('Cancel', G.W / 2 + 54, y, 100, 20, () => this.back());
      this.focus = -1;
    }
    padButton() { }
    stickNav() { }
    next(src) {
      const [kind, slot] = STEPS[this.step];
      if (src) { if (kind === 'b') this.map.b[slot] = src; else this.map.ax[slot] = src; }
      this.step++; this.armed = false; this.t0 = performance.now(); this.flash = performance.now();
      A.play('click', null, null, null, 1, src ? 1.2 : 0.8);
      const p = findPad(this.index, this.id);
      if (src) rumble(p, 60, 0.2, 0.4);
      if (this.step >= STEPS.length) this.finish();
    }
    finish() {
      // skipped inputs simply do nothing
      In.padMaps[this.id] = this.map;
      this.game.saveSettings();
      G.notice('Controller layout saved: ' + short(this.id));
      this.back();
    }
    /** What the controller is doing that it was not doing at rest. */
    poll(p) {
      const raw = Array.from(p.buttons, In.btnVal), a = Array.from(p.axes);
      let quiet = true, hitB = -1, hitA = -1;
      for (let i = 0; i < raw.length; i++) { if (raw[i] > 0.3) quiet = false; if (raw[i] > 0.6 && hitB < 0) hitB = i; }
      let bestD = 0;
      for (let i = 0; i < a.length; i++) {
        const d = Math.abs((a[i] || 0) - (this.rest[i] || 0));
        if (d > 0.3) quiet = false;
        if (d > 0.6 && d > bestD) { bestD = d; hitA = i; }
      }
      return { quiet, hitB, hitA, a };
    }
    draw(mx, my) {
      if (this.showWorld) G.dim();
      const W = G.W, H = G.H, top = 6 + G.safe.t, now = performance.now();
      G.textC('Remap Buttons', W / 2, top, '#FFFFFF');
      G.textC(short(this.id), W / 2, top + 11, '#909090');
      const p = findPad(this.index, this.id);
      if (!p) { G.textC('The controller went away. Plug it back in and press a button.', W / 2, H / 2, '#FF8080'); this.drawWidgets(mx, my); return; }
      if (this.step >= STEPS.length) { this.drawWidgets(mx, my); return; }
      const [kind, slot, text] = STEPS[this.step];
      const st = this.poll(p);
      // wait for everything to be let go before listening for the next input
      if (!this.armed) { if (st.quiet) this.armed = true; }
      else if (kind === 'b') {
        if (st.hitB >= 0) this.next({ b: st.hitB });
        else if (st.hitA >= 0) {
          const i = st.hitA, r = this.rest[i] || 0, x = st.a[i];
          if (Math.abs(r) > 1.05) this.next({ a: i, h: hatDir(x) });
          else this.next({ a: i, r, v: x > r ? 1 : -1 });
        }
      } else if (st.hitA >= 0 && Math.abs(this.rest[st.hitA] || 0) <= 1.05) {
        const i = st.hitA, x = st.a[i];
        this.next({ a: i, s: x > (this.rest[i] || 0) ? 1 : -1 });
      }
      // the step, on the drawing
      const k = Math.max(0.6, Math.min(1.5, (H - 120) / 130, (W - 20) / 170));
      const cy = top + 30 + 62 * k;
      const demo = new Array(17).fill(0), ax = [0, 0, 0, 0];
      const pulse = Math.floor(now / 350) % 2 === 0;
      if (kind === 'b' && pulse) demo[slot] = 1;
      if (kind === 'ax' && pulse) ax[slot] = 1;
      drawPad(W / 2, cy, k, demo, ax);
      let y = cy + 50 * k;
      G.textC((this.step + 1) + ' / ' + STEPS.length + ':  ' + text, W / 2, y, now - this.flash < 200 ? '#FFFFFF' : '#FFFF60'); y += 11;
      G.textC(this.armed ? 'Listening...' : 'Let go of everything...', W / 2, y, this.armed ? '#80FF80' : '#A0A0A0'); y += 11;
      if (now - this.t0 > 9000) G.textC('No such button on your controller? Click Skip.', W / 2, y, '#A0A0A0');
      this.drawWidgets(mx, my);
    }
  }
  G.RemapScreen = RemapScreen;
})();
