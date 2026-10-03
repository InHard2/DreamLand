/*
 * DreamLand - local multiplayer (same Wi-Fi).
 *
 * Finding games: hosts advertise in the artifact's live room (presence only),
 * and the WebRTC offer/answer travels the same way. Playing: an encrypted
 * WebRTC data channel that only accepts local-network candidates (no STUN or
 * TURN servers), so only devices on the same network can connect. The host's
 * world is the authority: every request from a guest is validated, rate
 * limited and range checked before it touches the world, and guests must
 * know the host's 4-digit join code.
 */
(function () {
  const DL = window.DL;
  const S = DL.S, B = S.B, E = DL.Entities, G = DL.GUI, I = DL.Items, A = DL.Audio, In = DL.Input;
  const N = DL.Net = { host: null, client: null };
  const PROTO = 1;
  const MAX_GUESTS = 7;
  const F2 = (v) => Math.round((v || 0) * 100) / 100;
  N.active = () => !!(N.host || N.client);

  /* ------------------------------------------------------------ */
  /* Validation                                                   */
  /* ------------------------------------------------------------ */
  const isNum = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
  const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const isVec = (a, n, lim) => Array.isArray(a) && a.length === n && a.every(v => isNum(v, -lim, lim));
  const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f§​-‏‪-‮⁠-⁯﻿]/g, '').slice(0, max);
  function validStack(s) {
    if (s === null) return null;
    if (!s || typeof s !== 'object' || !isInt(s.id, 1, 1023)) return undefined;
    const d = I.get(s.id);
    if (!d || !isInt(s.count, 1, d.maxStack || 64)) return undefined;
    const dmg = s.dmg === undefined ? 0 : s.dmg;
    if (!isInt(dmg, 0, d.maxDamage || 0)) return undefined;
    return { id: s.id, count: s.count, dmg };
  }
  function validStacks(arr, n) {
    if (!Array.isArray(arr) || arr.length !== n) return null;
    const out = [];
    for (const s of arr) { const v = validStack(s); if (v === undefined) return null; out.push(v); }
    return out;
  }
  const DENY_PLACE = new Set([B.bedrock, B.nether_portal, B.aether_portal, B.end_portal]);
  const DENY_BREAK = new Set([B.bedrock, B.end_portal, B.end_portal_frame]);

  /* ------------------------------------------------------------ */
  /* LAN-only signalling                                          */
  /* ------------------------------------------------------------ */
  function privateAddr(a) {
    a = String(a || '').toLowerCase();
    if (/^[0-9a-f-]{8,}\.local$/.test(a) || /\.local$/.test(a)) return true;
    const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
    if (m) { const x = +m[1], y = +m[2]; return x === 10 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 169 && y === 254); }
    if (a.includes(':')) return a.startsWith('fe80') || a.startsWith('fc') || a.startsWith('fd');
    return false;
  }
  /** Keep only host candidates on private / link-local addresses: same network or nothing. */
  function lanOnly(sdp) {
    if (typeof sdp !== 'string' || sdp.length > 6000 || !sdp.startsWith('v=0')) return null;
    return sdp.split(/\r?\n/).filter(line => {
      if (!line.startsWith('a=candidate:')) return true;
      const f = line.split(' ');
      return f[7] === 'host' && (privateAddr(f[4]) || N._testAnyHost === true);
    }).join('\r\n');
  }
  N.privateAddr = privateAddr;
  function packSdp(sdp) {
    if (!sdp) return null;
    const flat = sdp.split(/\r?\n/).filter(Boolean).join('|');
    if (flat.length > 3600 || /[^\x20-\x7e]/.test(flat)) return null;
    const out = [];
    for (let i = 0; i < flat.length; i += 900) out.push(flat.slice(i, i + 900));
    return out;
  }
  function unpackSdp(arr) {
    if (!Array.isArray(arr) || !arr.length || arr.length > 5 || !arr.every(x => typeof x === 'string' && x.length <= 1000 && !/[^\x20-\x7e]/.test(x))) return null;
    return arr.join('').split('|').join('\r\n') + '\r\n';
  }
  function gathered(pc, ms) {
    return new Promise(res => {
      if (pc.iceGatheringState === 'complete') { res(); return; }
      const t = setTimeout(res, ms);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  }
  const newPC = () => new RTCPeerConnection({ iceServers: [] });
  N.supported = () => typeof RTCPeerConnection === 'function';

  /* ------------------------------------------------------------ */
  /* Lobby: the artifact's live room, or tabs on this device      */
  /* ------------------------------------------------------------ */
  function localRoom() {
    const ch = typeof BroadcastChannel === 'function' ? new BroadcastChannel('dreamland-lan') : null;
    const me = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
    let mine = {};
    const others = new Map();
    const subs = new Set();
    let snap = Object.freeze([]);
    const rebuild = () => {
      const now = Date.now();
      const list = [Object.freeze({ peer: me, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze(Object.assign({}, mine)), updatedAt: now })];
      for (const [p, o] of others) list.push(Object.freeze({ peer: p, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: Object.freeze(o.presence || {}), updatedAt: o.at }));
      snap = Object.freeze(list);
      for (const f of subs) { try { f({ peers: snap, joined: [], left: [], updated: snap }); } catch (e) { /* ignore */ } }
    };
    const post = (m) => { if (ch) try { ch.postMessage(m); } catch (e) { /* ignore */ } };
    if (ch) ch.onmessage = (ev) => {
      const m = ev.data;
      if (!m || typeof m.from !== 'string' || m.from === me || m.from.length > 40) return;
      if (m.bye) others.delete(m.from);
      else others.set(m.from, { presence: m.presence && typeof m.presence === 'object' ? m.presence : {}, at: Date.now(), seen: Date.now() });
      rebuild();
    };
    setInterval(() => {
      post({ from: me, presence: mine });
      const now = Date.now(); let ch2 = false;
      for (const [p, o] of others) if (now - o.seen > 3500) { others.delete(p); ch2 = true; }
      if (ch2) rebuild();
    }, 1000);
    window.addEventListener('pagehide', () => post({ from: me, bye: 1 }));
    rebuild();
    return {
      presence(patch) { for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; } post({ from: me, presence: mine }); rebuild(); return Promise.resolve(); },
      peers: () => snap,
      onPeers(fn) { subs.add(fn); setTimeout(() => fn({ peers: snap, joined: snap, left: [], updated: [] }), 0); return () => subs.delete(fn); },
      connected: () => true
    };
  }
  /* ------------------------------------------------------------ */
  /* Lobby and relay through the bundled LAN server (server.js /  */
  /* server.py): works across PCs whatever the firewall does.     */
  /* ------------------------------------------------------------ */
  function serverRoom() {
    return new Promise((resolve) => {
      if (!/^https?:$/.test(location.protocol) || typeof WebSocket !== 'function') { resolve(null); return; }
      let settled = false, ws = null;
      const done = (v) => { if (settled) return; settled = true; clearTimeout(to); if (!v && ws) { try { ws.close(); } catch (e) { /* ignore */ } } resolve(v); };
      let to = setTimeout(() => done(null), 4000);
      fetch('/dl-lan.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(info => {
        if (!info || info.dreamland !== true) { done(null); return; }
        // there is a DreamLand server: give the lobby time to connect, even on a busy computer
        clearTimeout(to); to = setTimeout(() => done(null), 15000);
        try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/dl-ws'); } catch (e) { done(null); return; }
        ws.binaryType = 'arraybuffer';
        let me = null, snap = Object.freeze([]);
        const mine = {}, subs = new Set(), links = new Map(), ctl = new Set();
        const rebuild = (list) => {
          snap = Object.freeze(list.filter(e => e && typeof e.peer === 'string').map(e => Object.freeze({ peer: e.peer, by: null, isMe: e.peer === me, sameTab: e.peer === me, kind: 'viewer', guest: false, presence: Object.freeze(e.presence && typeof e.presence === 'object' ? e.presence : {}), updatedAt: Date.now() })));
          for (const f of subs) { try { f({ peers: snap, joined: [], left: [], updated: snap }); } catch (e) { /* ignore */ } }
        };
        const room = {
          info,
          presence(patch) { for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; } if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'presence', p: mine })); return Promise.resolve(); },
          peers: () => snap,
          onPeers(fn) { subs.add(fn); setTimeout(() => fn({ peers: snap, joined: snap, left: [], updated: [] }), 0); return () => subs.delete(fn); },
          connected: () => ws.readyState === 1,
          sendCtl(peer, d) { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'to', to: peer, d })); },
          onCtl(fn) { ctl.add(fn); return () => ctl.delete(fn); },
          /** A pretend peer connection whose two data channels ride the relay. */
          relayPc(peer, lid) {
            const chan = (label) => {
              const lab = label === 'u' ? 1 : 0, key = peer + ':' + lid + ':' + lab, to = parseInt(peer.slice(1), 10) >>> 0;
              const ch = {
                label, readyState: 'connecting', binaryType: 'arraybuffer', onmessage: null, onclose: null, onopen: null,
                get bufferedAmount() { return ws.bufferedAmount; },
                send(data) {
                  if (ch.readyState !== 'open' || ws.readyState !== 1) throw new Error('closed');
                  if (typeof data === 'string') { ws.send(JSON.stringify({ t: 'to', to: peer, d: { l: lid, c: label, s: data } })); return; }
                  const src = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
                  const out = new Uint8Array(10 + src.length), dv = new DataView(out.buffer);
                  out[0] = 1; dv.setUint32(1, to); dv.setUint32(5, lid); out[9] = lab;
                  out.set(src, 10);
                  ws.send(out.buffer);
                },
                close() { if (ch.readyState === 'closed') return; const was = ch.readyState; ch.readyState = 'closed'; links.delete(key); if (was === 'open' && ws.readyState === 1) ws.send(JSON.stringify({ t: 'to', to: peer, d: { l: lid, x: 1 } })); if (ch.onclose) ch.onclose(); },
                gone() { if (ch.readyState === 'closed') return; ch.readyState = 'closed'; links.delete(key); if (ch.onclose) ch.onclose(); },
                markOpen() { if (ch.readyState !== 'connecting') return; ch.readyState = 'open'; if (ch.onopen) ch.onopen(); }
              };
              links.set(key, ch);
              return ch;
            };
            const r = chan('r'), u = chan('u');
            const pc = { connectionState: 'connected', onconnectionstatechange: null, close() { r.close(); u.close(); } };
            return { pc, r, u };
          }
        };
        ws.onmessage = (ev) => {
          if (typeof ev.data !== 'string') {
            const u8 = new Uint8Array(ev.data);
            if (u8.length < 10 || u8[0] !== 1) return;
            const dv = new DataView(ev.data), ch = links.get('p' + dv.getUint32(1) + ':' + dv.getUint32(5) + ':' + u8[9]);
            if (ch && ch.readyState === 'open' && ch.onmessage) ch.onmessage({ data: ev.data.slice(10) });
            return;
          }
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (!m || typeof m !== 'object') return;
          if (m.t === 'hello' && typeof m.you === 'string') { me = m.you; room.presence({}); done(room); }
          else if (m.t === 'peers' && Array.isArray(m.list)) { if (typeof m.you === 'string') me = m.you; rebuild(m.list.slice(0, 64)); }
          else if (m.t === 'gone' && typeof m.peer === 'string') { for (const [k, ch] of Array.from(links)) if (k.startsWith(m.peer + ':')) ch.gone(); }
          else if (m.t === 'from' && typeof m.from === 'string' && m.d && typeof m.d === 'object') {
            const d = m.d;
            if (Number.isInteger(d.l) && typeof d.s === 'string') { const ch = links.get(m.from + ':' + d.l + ':' + (d.c === 'u' ? 1 : 0)); if (ch && ch.readyState === 'open' && ch.onmessage) ch.onmessage({ data: d.s }); return; }
            if (Number.isInteger(d.l) && d.x) { for (const lab of [0, 1]) { const ch = links.get(m.from + ':' + d.l + ':' + lab); if (ch) ch.gone(); } return; }
            for (const f of ctl) { try { f(m.from, d); } catch (e) { /* ignore */ } }
          }
        };
        ws.onclose = ws.onerror = () => { for (const ch of Array.from(links.values())) ch.gone(); snap = Object.freeze([]); done(null); };
      }).catch(() => done(null));
    });
  }
  let lobbyP = null;
  N.lobby = function () {
    if (lobbyP) return lobbyP;
    lobbyP = (async () => {
      let room = null, user = null;
      try {
        if (window.claude && typeof window.claude.use === 'function') {
          [room, user] = await Promise.all([window.claude.use('room').catch(() => null), window.claude.use('user').catch(() => null)]);
        }
      } catch (e) { room = null; }
      if (room) return { room, user, kind: 'artifact' };
      const srv = await serverRoom();
      if (srv) return { room: srv, user: null, kind: 'server', info: srv.info };
      return { room: localRoom(), user: null, kind: 'local' };
    })();
    return lobbyP;
  };
  N.myPeer = (room) => { const me = room.peers().find(p => p.sameTab); return me ? me.peer : null; };
  // find the lobby right away, before a world starts loading and keeps the page busy
  setTimeout(() => { if (/^https?:$/.test(location.protocol)) N.lobby(); }, 300);

  /* Names come from the platform (user capability), never from other players. */
  const names = new Map();
  N.nameOf = function (by) {
    if (!by) return 'Player';
    if (names.has(by)) return names.get(by) || 'Player';
    names.set(by, '');
    N.lobby().then(L => {
      if (!L.user || !L.user.profiles) return;
      L.user.profiles([by]).then(ps => { const n = ps && ps[by] && ps[by].name; names.set(by, clean(n || '', 24)); }).catch(() => {});
    });
    return 'Player';
  };
  N.myId = async function () {
    const L = await N.lobby();
    try { return L.user && L.user.id ? await L.user.id() : null; } catch (e) { return null; }
  };

  /* ------------------------------------------------------------ */
  /* Link: two data channels, JSON + fragmented binary            */
  /* ------------------------------------------------------------ */
  const FRAG = 15000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  class Link {
    constructor(pc) {
      this.pc = pc; this.r = null; this.u = null; this.frags = new Map(); this.closed = false;
      this.onmsg = () => {}; this.onbin = () => {}; this.onopen = null; this.onclose = null;
      this.lastHeard = performance.now(); this.fragId = 1;
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if ((s === 'failed' && !this.patient) || s === 'closed') this.close();
        else if (s === 'disconnected') { clearTimeout(this._dt); this._dt = setTimeout(() => { if (pc.connectionState === 'disconnected') this.close(); }, 6000); }
      };
    }
    attach(ch) {
      ch.binaryType = 'arraybuffer';
      if (ch.label === 'r') this.r = ch; else if (ch.label === 'u') this.u = ch; else { ch.close(); return; }
      ch.onmessage = (ev) => this.recv(ev.data);
      ch.onclose = () => { if (ch.label === 'r') this.close(); };
      ch.onopen = () => { if (this.r && this.r.readyState === 'open' && this.onopen) { const f = this.onopen; this.onopen = null; f(); } };
      if (ch.readyState === 'open') ch.onopen();
    }
    get open() { return !this.closed && this.r && this.r.readyState === 'open'; }
    get buffered() { return this.r ? this.r.bufferedAmount : 0; }
    send(obj, fast) {
      const ch = fast && this.u && this.u.readyState === 'open' ? this.u : this.r;
      if (!ch || ch.readyState !== 'open') return false;
      try { ch.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
    }
    sendBin(head, payload) {
      if (!this.open) return false;
      const h = enc.encode(JSON.stringify(head));
      const whole = new Uint8Array(3 + h.length + payload.length);
      whole[0] = 1; whole[1] = h.length & 255; whole[2] = h.length >> 8;
      whole.set(h, 3); whole.set(payload, 3 + h.length);
      try {
        if (whole.length <= FRAG) { this.r.send(whole); return true; }
        const id = this.fragId++ >>> 0, cnt = Math.ceil(whole.length / FRAG);
        for (let i = 0; i < cnt; i++) {
          const part = whole.subarray(i * FRAG, Math.min(whole.length, (i + 1) * FRAG));
          const f = new Uint8Array(9 + part.length);
          f[0] = 2; new DataView(f.buffer).setUint32(1, id); new DataView(f.buffer).setUint16(5, i); new DataView(f.buffer).setUint16(7, cnt);
          f.set(part, 9);
          this.r.send(f);
        }
        return true;
      } catch (e) { return false; }
    }
    recv(data) {
      this.lastHeard = performance.now();
      if (typeof data === 'string') {
        if (data.length > 200000) return;
        let m; try { m = JSON.parse(data); } catch (e) { return; }
        if (m && typeof m === 'object' && typeof m.t === 'string') this.onmsg(m);
        return;
      }
      const u8 = new Uint8Array(data);
      if (!u8.length) return;
      if (u8[0] === 1) return this.whole(u8);
      if (u8[0] !== 2 || u8.length < 10) return;
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const id = dv.getUint32(1), idx = dv.getUint16(5), cnt = dv.getUint16(7);
      if (cnt < 2 || cnt > 128 || idx >= cnt) return;
      let f = this.frags.get(id);
      if (!f) {
        if (this.frags.size > 16) this.frags.delete(this.frags.keys().next().value);
        f = { cnt, parts: new Array(cnt), got: 0, size: 0 };
        this.frags.set(id, f);
      }
      if (f.cnt !== cnt || f.parts[idx]) return;
      f.parts[idx] = u8.slice(9); f.got++; f.size += u8.length - 9;
      if (f.size > 2 * 1024 * 1024) { this.frags.delete(id); return; }
      if (f.got === cnt) {
        this.frags.delete(id);
        const all = new Uint8Array(f.size);
        let o = 0; for (const p of f.parts) { all.set(p, o); o += p.length; }
        if (all[0] === 1) this.whole(all);
      }
    }
    whole(u8) {
      if (u8.length < 3) return;
      const hl = u8[1] | (u8[2] << 8);
      if (3 + hl > u8.length) return;
      let head; try { head = JSON.parse(dec.decode(u8.subarray(3, 3 + hl))); } catch (e) { return; }
      if (head && typeof head.t === 'string') this.onbin(head, u8.subarray(3 + hl));
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      try { if (this.r) this.r.close(); } catch (e) { /* ignore */ }
      try { if (this.u) this.u.close(); } catch (e) { /* ignore */ }
      try { this.pc.close(); } catch (e) { /* ignore */ }
      if (this.onclose) this.onclose();
    }
  }

  /* ------------------------------------------------------------ */
  /* Entities on the host that stand for guests                   */
  /* ------------------------------------------------------------ */
  class RemotePlayer extends E.Living {
    constructor(world, conn, x, y, z) {
      super(world, x, y, z);
      this.type = 'player'; this.isPlayer = true; this.isRemote = true; this.conn = conn;
      this.w = 0.6; this.h = 1.8; this.eye = 1.62;
      this.armor = [null, null, null, null]; this.held = null; this.score = 0;
      this.target = [x, y, z]; this.creative = false;
      this.stepHeight = 0;
    }
    get removed() { return !!this._gone; }
    set removed(v) { if (v === 'gone') this._gone = true; }
    get heldItem() { return !!this.held; }
    set heldItem(v) { /* derived */ }
    tick() {
      this.px = this.x; this.py = this.y; this.pz = this.z;
      this.pyaw = this.yaw; this.ppitch = this.pitch; this.pbodyYaw = this.bodyYaw; this.pheadYaw = this.headYaw;
      this.age++;
      if (this.hurtTime > 0) this.hurtTime--;
      if (this.hurtResist > 0) this.hurtResist--;
      if (this.swingTicks >= 0) { this.swingTicks++; if (this.swingTicks >= 6) this.swingTicks = -1; }
      const [tx, ty, tz] = this.target;
      if (Math.abs(tx - this.x) + Math.abs(ty - this.y) + Math.abs(tz - this.z) > 12) { this.x = tx; this.y = ty; this.z = tz; }
      else { this.x += (tx - this.x) * 0.6; this.y += (ty - this.y) * 0.6; this.z += (tz - this.z) * 0.6; }
      this.yaw = this.tyaw === undefined ? this.yaw : this.yaw + DL.wrapAngle(this.tyaw - this.yaw) * 0.6;
      this.bodyYaw = this.tbody === undefined ? this.yaw : this.bodyYaw + DL.wrapAngle(this.tbody - this.bodyYaw) * 0.6;
      this.headYaw = this.yaw;
      this.prevLimbAmount = this.limbSwingAmount;
      let f = Math.hypot(this.x - this.px, this.z - this.pz) * 4; if (f > 1) f = 1;
      this.limbSwingAmount += (f - this.limbSwingAmount) * 0.4; this.limbSwing += this.limbSwingAmount;
      if (this.health <= 0) this.deathTime = Math.min(20, this.deathTime + 1); else this.deathTime = 0;
      if (this.health > 0) this.pickup();
    }
    pickup() {
      const b = this.box;
      for (const e of this.world.entities) {
        if (!(e instanceof E.ItemEntity) || e.removed || e.pickupDelay > 0) continue;
        if (e.x < b[0] - 1 || e.x > b[3] + 1 || e.y < b[1] - 0.5 || e.y > b[4] + 0.5 || e.z < b[2] - 1 || e.z > b[5] + 1) continue;
        e.removed = true;
        this.conn.send({ t: 'give', st: e.stack, p: [F2(e.x), F2(e.y), F2(e.z)] });
        if (this.world.fx) this.world.fx.sound('pop', e.x, e.y, e.z, 0.2, 1.5);
      }
    }
    damage(src, amount, from) {
      if (this.creative && src !== 'void') return false;
      if (this.health <= 0 || this.hurtResist > 10 || !(amount > 0)) return false;
      this.hurtResist = 20; this.hurtTime = 10;
      this.conn.send({ t: 'hurt', a: Math.min(100, Math.round(amount)), s: clean(src, 16), f: from && isFinite(from.x) ? [F2(from.x), F2(from.z)] : null });
      this.onHurt(src, from);
      return true;
    }
    heal() { }
    knockBack() { }
    travel() { }
    setPos(x, y, z) { super.setPos(x, y, z); this.target = [x, y, z]; if (this.conn && this.conn.authed) this.conn.send({ t: 'tp', p: [F2(x), F2(y), F2(z)] }); }
    serialize() { return null; }
  }
  N.RemotePlayer = RemotePlayer;
  // extra message types added by later modules: N.hostHandlers[t](conn, msg, rp, world, game), N.clientHandlers[t](client, msg, game, world, player)
  N.hostHandlers = {}; N.clientHandlers = {};

  /* ------------------------------------------------------------ */
  /* Host                                                         */
  /* ------------------------------------------------------------ */
  class Conn {
    constructor(host, pc, peer, by) {
      this.host = host; this.peer = peer; this.by = by;
      this.link = new Link(pc);
      this.authed = false; this.rp = null; this.sent = new Set(); this.want = []; this.sending = 0;
      this.tokens = 600; this.lastRefill = performance.now(); this.strikes = 0;
      this.watch = new Map(); this.seq = 0; this.rd = 4; this.key = by || null;
      this.link.onmsg = (m) => this.onMessage(m);
      this.link.onclose = () => host.drop(this);
    }
    send(m, fast) { return this.link.send(m, fast); }
    allow(cost) {
      const now = performance.now();
      this.tokens = Math.min(800, this.tokens + (now - this.lastRefill) * 0.4); this.lastRefill = now;
      if (this.tokens < cost) { if (++this.strikes > 4000) this.kick('Too many messages'); return false; }
      this.tokens -= cost; return true;
    }
    kick(reason) { this.send({ t: 'kick', r: clean(reason, 60) }); setTimeout(() => this.link.close(), 150); }
    near(x, y, z, r) { const p = this.rp; return p && (p.x - x) ** 2 + (p.y + 1.6 - y) ** 2 + (p.z - z) ** 2 <= r * r; }
    onMessage(m) {
      try { this.handle(m); } catch (e) { console.warn('net: bad message', e); }
    }
    handle(m) {
      const h = this.host, w = h.game.world, g = h.game;
      if (!this.authed) {
        if (m.t !== 'hello' || this._helloSeen) return;
        this._helloSeen = true;
        const fails = h.fails.get(this.peer) || 0;
        if (m.v !== PROTO) { this.kick('Different game version - reload both games'); return; }
        if (fails >= 5) { this.kick('Too many wrong codes'); return; }
        if (!this.trusted && (typeof m.code !== 'string' || m.code !== h.code)) { h.fails.set(this.peer, fails + 1); this.kick('Wrong join code'); return; }
        if (h.conns.size > MAX_GUESTS) { this.kick('The game is full'); return; }
        this.rd = isInt(m.rd, 2, 8) ? m.rd : 4;
        if (!this.key && typeof m.key === 'string' && /^[a-z0-9]{8,32}$/.test(m.key)) this.key = 'k:' + m.key;
        this.authed = true;
        h.welcome(this);
        return;
      }
      if (!this.allow(m.t === 'ch' && Array.isArray(m.k) ? 1 + m.k.length : 1)) return;
      const rp = this.rp;
      if (!rp || !w || h.game.loading) return;
      switch (m.t) {
        case 'ps': {
          if (!isVec(m.p, 3, 3e7) || !isVec(m.r, 4, 100) || m.p[1] < -200 || m.p[1] > 600) return;
          if (isInt(m.dim, 0, 4) && m.dim !== (w.dim || 0)) return;
          rp.target = m.p.slice();
          rp.tyaw = m.r[0]; rp.pitch = Math.max(-1.6, Math.min(1.6, m.r[1])); rp.tbody = m.r[2];
          const fl = isInt(m.f, 0, 255) ? m.f : 0;
          rp.sneaking = !!(fl & 1); rp.onGround = !!(fl & 2); rp.creative = !!(fl & 4) && !!g.meta.creative;
          rp.swimming = !!(fl & 8); rp.eating = !!(fl & 16); rp.seated = !!(fl & 32);
          rp.health = isNum(m.hp, -100, 100) ? m.hp : 20;
          if (isInt(m.sw, -1, 6) && m.sw === 0) rp.swingTicks = 0;
          rp.held = isInt(m.h, 1, 511) && I.get(m.h) ? { id: m.h, count: 1 } : null;
          if (Array.isArray(m.a) && m.a.length === 4) rp.armor = m.a.map(id => isInt(id, 1, 511) && I.get(id) && I.get(id).armor ? { id, count: 1 } : null);
          return;
        }
        case 'ch': {
          if (!Array.isArray(m.k) || m.k.length > 64) return;
          for (const c of m.k) if (Array.isArray(c) && isInt(c[0], -2e6, 2e6) && isInt(c[1], -2e6, 2e6)) {
            const dx = c[0] - Math.floor(rp.x / 16), dz = c[1] - Math.floor(rp.z / 16);
            if (dx * dx + dz * dz > (this.rd + 4) ** 2) continue;
            if (this.want.length < 600 && !this.want.some(q => q[0] === c[0] && q[1] === c[1])) this.want.push([c[0], c[1], performance.now()]);
          }
          return;
        }
        case 'un': {
          if (!Array.isArray(m.k) || m.k.length > 512) return;
          for (const c of m.k) if (Array.isArray(c) && isInt(c[0], -2e6, 2e6) && isInt(c[1], -2e6, 2e6)) this.sent.delete(DL.ckey(c[0], c[1]));
          return;
        }
        case 'set': {
          if (!isVec(m.p, 3, 3e7) || !m.p.every(Number.isInteger) || !isInt(m.id, 0, 255) || !isInt(m.m, 0, 15)) return;
          const [x, y, z] = m.p;
          if (y < 1 || y >= S.CH || !this.near(x + 0.5, y + 0.5, z + 0.5, 10) || !w.isReady(x, z)) return this.correct(x, y, z);
          if (m.id && (!S.blocks[m.id] || DENY_PLACE.has(m.id))) return this.correct(x, y, z);
          const cur = w.getBlock(x, y, z);
          if (DENY_BREAK.has(cur) && !(cur === B.end_portal_frame && m.id === B.end_portal_frame)) return this.correct(x, y, z);
          if (m.id === B.end_portal_frame && cur !== B.end_portal_frame && !g.meta.creative) return this.correct(x, y, z);
          w.setBlock(x, y, z, m.id, m.m, 3);
          w.neighborChanged(x, y, z);
          if (m.id === B.end_portal_frame && (m.m & 4) && g.checkEndPortal) g.checkEndPortal(x, y, z);
          return;
        }
        case 'br': {
          if (!isVec(m.p, 3, 3e7) || !m.p.every(Number.isInteger)) return;
          const [x, y, z] = m.p;
          if (y < 0 || y >= S.CH || !this.near(x + 0.5, y + 0.5, z + 0.5, 10) || !w.isReady(x, z)) return this.correct(x, y, z);
          const cur = w.getBlock(x, y, z);
          if (!cur) return;
          if (DENY_BREAK.has(cur) && !rp.creative) return this.correct(x, y, z);
          const tool = isInt(m.h, 1, 511) && I.get(m.h) ? { id: m.h, count: 1 } : null;
          h.muteBreak = [this, x, y, z];
          w.destroyBlock(x, y, z, !!m.d && !g.meta.creative, tool, true);
          h.muteBreak = null;
          return;
        }
        case 'ign': {
          if (!isVec(m.p, 3, 3e7) || !m.p.every(Number.isInteger)) return;
          if (this.near(m.p[0] + 0.5, m.p[1] + 0.5, m.p[2] + 0.5, 10)) w.igniteTNT(m.p[0], m.p[1], m.p[2], 80);
          return;
        }
        case 'atk': {
          if (!isInt(m.id, 1, 1e9) || !isNum(m.d, 0, 30) || rp.health <= 0) return;
          const now = performance.now();
          if (now - (this.lastAtk || 0) < 90) return;
          this.lastAtk = now;
          const e = w.entities.find(o => o.id === m.id);
          if (!e || !e.living || e === rp || e.removed || !this.near(e.x, e.y + e.h / 2, e.z, 7)) return;
          if (e.isPlayer) return;
          e.damage('player', m.d, rp);
          return;
        }
        case 'shoot': {
          if (!['arrow', 'snowball', 'egg'].includes(m.k) || !isVec(m.p, 3, 3e7) || !isVec(m.d, 3, 2) || !isNum(m.s, 0.1, 3)) return;
          if (!this.near(m.p[0], m.p[1], m.p[2], 3)) return;
          const now = performance.now();
          if (now - (this.lastShot || 0) < 150) return;
          this.lastShot = now;
          const pr = m.k === 'arrow' ? new E.Arrow(w, m.p[0], m.p[1], m.p[2], rp) : new E.Thrown(w, m.p[0], m.p[1], m.p[2], rp, m.k);
          pr.shoot(m.d[0], m.d[1], m.d[2], m.s, 1);
          w.entities.push(pr);
          return;
        }
        case 'drop': {
          const st = validStack(m.st);
          if (!st || !isVec(m.p, 3, 3e7) || !isVec(m.v, 3, 2) || !this.near(m.p[0], m.p[1], m.p[2], 4)) return;
          const e = new E.ItemEntity(w, m.p[0], m.p[1], m.p[2], st);
          e.vx = m.v[0]; e.vy = m.v[1]; e.vz = m.v[2]; e.pickupDelay = 40;
          w.entities.push(e);
          return;
        }
        case 'chat': {
          const t = clean(m.m, 100).trim();
          if (!t) return;
          const now = performance.now();
          if (now - (this.lastChat || 0) < 400) return;
          this.lastChat = now;
          h.chat(this.by, t);
          return;
        }
        case 'teo': case 'tec': case 'tes': {
          if (!isVec(m.p, 3, 3e7) || !m.p.every(Number.isInteger)) return;
          const [x, y, z] = m.p;
          const te = w.getTile(x, y, z);
          const k = x + ',' + y + ',' + z;
          if (!te || (te.type !== 'chest' && te.type !== 'furnace') || !this.near(x + 0.5, y + 0.5, z + 0.5, 9)) { this.watch.delete(k); return; }
          if (m.t === 'tec') { this.watch.delete(k); return; }
          if (m.t === 'tes') {
            const items = validStacks(m.items, te.items.length);
            if (!items) return;
            for (let i = 0; i < items.length; i++) te.items[i] = items[i];
            const c = w.getChunk(x >> 4, z >> 4); if (c) c.needsSave = true;
          }
          const json = JSON.stringify(teData(te));
          this.watch.set(k, { te, json });
          this.send({ t: 'te', p: [x, y, z], d: teData(te) });
          return;
        }
        case 'save': {
          const d = m.d;
          if (!d || typeof d !== 'object') return;
          const inv = validStacks(d.inv, 36), armor = validStacks(d.armor, 4);
          if (!inv || !armor || !this.key) return;
          if (!g.meta.mp || typeof g.meta.mp !== 'object') g.meta.mp = {};
          g.meta.mp[this.key] = { inv, armor, health: isNum(d.hp, 0, 20) ? d.hp : 20, selected: isInt(d.sel, 0, 8) ? d.sel : 0, x: rp.x, y: rp.y, z: rp.z, dim: w.dim || 0, score: isInt(d.score, 0, 1e9) ? d.score : 0 };
          return;
        }
        case 'bye': this.link.close(); return;
        default: if (Object.prototype.hasOwnProperty.call(N.hostHandlers, m.t)) N.hostHandlers[m.t](this, m, rp, w, g);
      }
    }
    correct(x, y, z) {
      const w = this.host.game.world;
      if (w && y >= 0 && y < S.CH) this.send({ t: 'bc', b: [[x, y, z, w.getBlock(x, y, z), w.getMeta(x, y, z)]] });
    }
  }
  function teData(te) { return { items: te.items, burn: te.burn || 0, burnMax: te.burnMax || 0, cook: te.cook || 0 }; }

  class Host {
    constructor(game, L) {
      this.game = game; this.L = L;
      const r = new Uint32Array(1); crypto.getRandomValues(r);
      this.code = String(1000 + (r[0] % 9000));
      this.conns = new Set(); this.queue = []; this.busy = false; this.seenK = new Set(); this.fails = new Map();
      this.changes = new Set(); this.fxq = []; this.tickN = 0; this.myPeer = null;
    }
    async start() {
      const room = this.L.room;
      this.myId = await N.myId();
      this.unsub = room.onPeers(() => this.scan());
      if (this.L.kind === 'server') this.unsubCtl = room.onCtl((from, d) => this.relayOpen(from, d));
      this.advertise();
      this.attachWorld(this.game.world);
      this.scanT = setInterval(() => this.scan(), 1000);
    }
    advertise(ans) {
      const g = this.game;
      if (ans !== undefined) this.ans = ans;
      this.L.room.presence({ dl: { v: PROTO, host: { n: clean(g.meta.name || 'World', 32), p: this.conns.size + 1 }, ans: this.ans || null } }).catch(() => {});
    }
    scan() {
      const room = this.L.room;
      this.myPeer = this.myPeer || N.myPeer(room);
      if (!this.myPeer) return;
      for (const p of room.peers()) {
        if (p.sameTab) continue;
        const j = p.presence && p.presence.dl && p.presence.dl.join;
        if (!j || j.to !== this.myPeer || typeof j.k !== 'string' || j.k.length > 40 || this.seenK.has(j.k)) continue;
        if ((this.fails.get(p.peer) || 0) >= 5) continue;
        this.seenK.add(j.k);
        const sdp = unpackSdp(j.sdp);
        if (sdp && this.queue.length < 8) this.queue.push({ peer: p.peer, by: p.by || null, sdp, k: j.k });
      }
      this.pump();
    }
    async pump() {
      if (this.busy || !this.queue.length || this.stopped) return;
      this.busy = true;
      const job = this.queue.shift();
      try { await this.accept(job); } catch (e) { console.warn('net: join failed', e); }
      this.advertise(null);
      this.busy = false;
      this.pump();
    }
    async accept(job) {
      const offer = lanOnly(job.sdp);
      if (!offer) return;
      const pc = newPC();
      const conn = new Conn(this, pc, job.peer, job.by);
      pc.ondatachannel = (ev) => conn.link.attach(ev.channel);
      const opened = new Promise(res => { conn.link.onopen = res; setTimeout(res, 15000); });
      await pc.setRemoteDescription({ type: 'offer', sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc, 2500);
      const sdp = lanOnly(pc.localDescription.sdp);
      const packed = packSdp(sdp);
      if (!packed) { conn.link.close(); return; }
      this.advertise({ to: job.peer, sdp: packed, k: job.k });
      await opened;
      if (!conn.link.open) { conn.link.close(); return; }
      this.conns.add(conn);
      setTimeout(() => { if (!conn.authed) conn.link.close(); }, 10000);
    }
    welcome(conn) {
      const g = this.game, w = g.world, p = g.player;
      const saved = conn.key && g.meta.mp && g.meta.mp[conn.key];
      let pos = [p.x + 1, p.y, p.z + 1];
      if (saved && saved.dim === (w.dim || 0) && isNum(saved.x, -3e7, 3e7)) pos = [saved.x, saved.y, saved.z];
      conn.rp = new RemotePlayer(w, conn, pos[0], pos[1], pos[2]);
      conn.rp.creative = !!g.meta.creative;
      w.entities.push(conn.rp);
      conn.send({
        t: 'welcome', v: PROTO, seed: w.seed, dim: w.dim || 0, time: w.time, tf: !!w.timeFrozen, cr: !!g.meta.creative,
        n: clean(g.meta.name || 'World', 32), sp: p.spawnPoint || g.meta.spawn || [p.x, p.y, p.z], pos: pos.map(F2), save: saved || null,
        fy: w.endFountainY || null, dk: !!g.meta.dragonKilled
      });
      this.advertise();
      this.sys(conn.by, 'joined the game');
    }
    drop(conn) {
      if (!this.conns.has(conn)) return;
      this.conns.delete(conn);
      if (conn.rp) { conn.rp.removed = 'gone'; if (conn.authed) this.sys(conn.by, 'left the game'); }
      this.advertise();
    }
    attachWorld(w) {
      w.netHost = this;
      for (const c of this.conns) { c.sent.clear(); c.want = []; c.watch.clear(); }
    }
    /** The host changed dimension: bring everyone along. */
    dimensionChanged() {
      const g = this.game, w = g.world, p = g.player;
      this.attachWorld(w);
      let i = 0;
      for (const c of this.conns) {
        if (!c.authed) continue;
        i++;
        const x = p.x + (i % 2 ? 1 : -1), y = p.y, z = p.z + (i > 2 ? 1 : 0);
        c.rp = new RemotePlayer(w, c, x, y, z);
        c.rp.creative = !!g.meta.creative;
        w.entities.push(c.rp);
        c.send({ t: 'world', dim: w.dim || 0, time: w.time, pos: [F2(x), F2(y), F2(z)], fy: w.endFountainY || null });
      }
    }
    mark(x, y, z) { if (this.conns.size) this.changes.add(x + ',' + y + ',' + z); }
    chat(by, text) {
      this.game.chatMessage('<' + N.nameOf(by) + '> ' + text);
      for (const c of this.conns) if (c.authed) c.send({ t: 'chat', by, m: text });
    }
    sys(by, text) {
      this.game.chatMessage('§e' + N.nameOf(by) + ' ' + text);
      for (const c of this.conns) if (c.authed) c.send({ t: 'sys', by, m: text });
    }
    fx(item) { if (this.conns.size && this.fxq.length < 64) this.fxq.push(item); }
    tick() {
      const g = this.game, w = g.world;
      if (!w || g.loading || !g.inGame) return;
      this.tickN++;
      // keep the world loaded and lively around every guest
      const centers = [];
      for (const c of this.conns) if (c.authed && c.rp) centers.push([Math.floor(c.rp.x / 16), Math.floor(c.rp.z / 16), c.rd + 4]);
      w.extraCenters = centers;
      if (this.tickN % 4 === 0) for (const c of this.conns) if (c.authed && c.rp && c.rp.health > 0) E.naturalSpawn(w, c.rp);
      // block changes
      let changes = null;
      if (this.changes.size) {
        changes = [];
        for (const k of this.changes) {
          const [x, y, z] = k.split(',').map(Number);
          changes.push([x, y, z, w.getBlock(x, y, z), w.getMeta(x, y, z)]);
        }
        this.changes.clear();
      }
      const fx = this.fxq; this.fxq = [];
      for (const c of this.conns) {
        if (!c.authed || !c.rp || !c.link.open) continue;
        if (performance.now() - c.link.lastHeard > 20000) { c.link.close(); continue; }
        if (changes) {
          const mine = changes.filter(b => c.sent.has(DL.ckey(b[0] >> 4, b[2] >> 4)));
          if (mine.length) c.send({ t: 'bc', b: mine });
        }
        if (fx.length) {
          const near = fx.filter(f => (f.p[0] - c.rp.x) ** 2 + (f.p[2] - c.rp.z) ** 2 < 48 * 48 && f.by !== c).map(f => { const o = Object.assign({}, f); delete o.by; return o; });
          if (near.length) c.send({ t: 'fx', l: near }, true);
        }
        this.serveChunks(c);
        this.snapshot(c);
        if (this.tickN % 20 === 0) c.send({ t: 'time', v: w.time, f: !!w.timeFrozen, wr: w.weather ? [w.weather.target ? 1 : 0, w.weather.thunderT ? 1 : 0] : null }, true);
        if (this.tickN % 5 === 0) for (const [k, o] of c.watch) {
          const json = JSON.stringify(teData(o.te));
          if (json !== o.json) { o.json = json; const p = k.split(',').map(Number); c.send({ t: 'te', p, d: teData(o.te) }); }
        }
      }
    }
    serveChunks(c) {
      const w = this.game.world;
      if (!c.want.length || c.sending > 6 || c.link.buffered > 1.5e6) return;
      const now = performance.now();
      let n = 0;
      for (let i = 0; i < c.want.length && n < 8; i++) {
        const [cx, cz, at] = c.want[i];
        const ch = w.getChunk(cx, cz);
        if (!ch || !ch.lit) { if (now - at > 60000) { c.want.splice(i, 1); i--; } continue; }
        c.want.splice(i, 1); i--; n++;
        this.sendChunk(c, ch);
      }
    }
    async sendChunk(c, ch) {
      c.sending++;
      try {
        const raw = new Uint8Array(65792);
        raw.set(ch.blocks, 0); raw.set(ch.meta, 32768); if (ch.biomes) raw.set(ch.biomes, 65536);
        const tiles = [];
        for (const te of ch.tiles.values()) if (tiles.length < 256) tiles.push(Object.assign({ x: te.x, y: te.y, z: te.z, type: te.type }, te.items ? teData(te) : {}, te.mob ? { mob: te.mob } : {}));
        const pack = await DL.Storage.compress(raw);
        c.sent.add(ch.key);
        c.link.sendBin({ t: 'chunk', cx: ch.cx, cz: ch.cz, z: !pack.raw, tiles }, new Uint8Array(pack.data));
      } catch (e) { console.warn('net: chunk send failed', e); }
      c.sending--;
    }
    snapshot(c) {
      const w = this.game.world, rp = c.rp;
      const list = [];
      for (const e of w.entities) {
        if (e === rp || e.removed) continue;
        const d2 = (e.x - rp.x) ** 2 + (e.z - rp.z) ** 2;
        if (d2 > 80 * 80) continue;
        list.push([d2, e]);
      }
      list.sort((a, b) => a[0] - b[0]);
      const out = [];
      for (let i = 0; i < list.length && i < 120; i++) { const v = encodeEnt(list[i][1], this); if (v) out.push(v); }
      c.send({ t: 'es', s: ++c.seq, e: out }, true);
    }
    /** A guest on the LAN server asks to connect through the relay. */
    relayOpen(from, d) {
      if (this.stopped || !d || !Number.isInteger(d.open) || d.open <= 0) return;
      const room = this.L.room;
      if ((this.fails.get(from) || 0) >= 5 || this.conns.size > MAX_GUESTS) { room.sendCtl(from, { refused: d.open }); return; }
      const rel = room.relayPc(from, d.open);
      const conn = new Conn(this, rel.pc, from, null);
      conn.link.onopen = () => { if (this.stopped) { conn.link.close(); return; } this.conns.add(conn); setTimeout(() => { if (!conn.authed) conn.link.close(); }, 10000); };
      conn.link.attach(rel.r); conn.link.attach(rel.u);
      rel.r.markOpen(); rel.u.markOpen();
      room.sendCtl(from, { opened: d.open });
    }
    stop() {
      this.stopped = true;
      clearInterval(this.scanT);
      if (this.unsub) this.unsub();
      if (this.unsubCtl) this.unsubCtl();
      for (const c of Array.from(this.conns)) { c.send({ t: 'kick', r: 'The host closed the game' }); setTimeout(() => c.link.close(), 100); }
      this.L.room.presence({ dl: null }).catch(() => {});
      if (this.game.world) { this.game.world.netHost = null; this.game.world.extraCenters = null; }
    }
  }
  const KEYS = ['sheared', 'fuse', 'prevFuse', 'eatTimer', 'charge', 'provoked', 'tamed', 'sitting', 'awake', 'peek', 'prevPeek', 'perched', 'jawOpen', 'attackAnim', 'squish', 'scale', 'variant', 'flapTime', 'headShake', 'healer', 'grumpy', 'sliding', 'grazing', 'rearing'];
  function encodeEnt(e, host) {
    const t = e.type;
    if (!t) return null;
    const x = {};
    if (e.living) {
      if (e.hurtTime) x.ht = e.hurtTime;
      if (e.deathTime) x.dt = e.deathTime;
      if (e.swingTicks >= 0) x.sw = e.swingTicks;
      if (!e.onGround) x.air = 1;
      if (e.fire > 0) x.f = 1;
      for (const k of KEYS) { const v = e[k]; if (v !== undefined && v !== null && v !== false && v !== 0) x[k] = typeof v === 'number' ? F2(v) : (typeof v === 'object' ? 1 : v); }
      if (e.def && e.def.boss) { x.hp = F2(e.health); x.mh = e.maxHealth; }
      if (t === 'player') {
        const held = e.held; if (held) x.h = held.id;
        x.a = (e.armor || []).map(s => s ? s.id : 0);
        if (e.sneaking) x.sn = 1;
        if (e.swimming) x.swm = 1;
        if (e.eating) x.eat = 1;
        if (e.vehicle || e.sitting || e.seated) x.rd = 1;
        x.by = e.isRemote ? e.conn.by : host.myId || null;
        if (e.health <= 0) x.dt = Math.max(1, x.dt || 1);
      }
    } else if (t === 'item') { x.st = [e.stack.id, e.stack.count, e.stack.dmg || 0]; x.ag = e.age; x.bo = F2(e.bobOffset); }
    else if (t === 'arrow') { if (e.shake) x.sh = e.shake; }
    else if (t === 'thrown') { x.k = e.kind; if (e.icon) x.ic = e.icon; if (e.size) x.sz = e.size; }
    else if (t === 'tnt') x.fu = e.fuse;
    else if (t === 'falling') x.bl = e.block;
    else return null;
    return [e.id, t, F2(e.x), F2(e.y), F2(e.z), F2(e.yaw), F2(e.bodyYaw === undefined ? e.yaw : e.bodyYaw), F2(e.headYaw === undefined ? e.yaw : e.headYaw), F2(e.pitch), x];
  }

  /* ------------------------------------------------------------ */
  /* Guest                                                        */
  /* ------------------------------------------------------------ */
  class Proxy extends E.Entity {
    constructor(world, id, type) {
      super(world, 0, 0, 0);
      this.netId = id; this.type = type; this.isProxy = true;
      const d = E.MOBS[type];
      this.def = d ? Object.assign({}, d, { interact: null, ai: null, tick: null, init: null }) : null;
      this._living = !!d || type === 'player';
      this.health = 20; this.maxHealth = 20;
      this.hurtTime = 0; this.deathTime = 0; this.swingTicks = -1; this.swingProgress = 0;
      this.limbSwing = 0; this.limbSwingAmount = 0; this.prevLimbAmount = 0;
      this.bodyYaw = 0; this.pbodyYaw = 0; this.headYaw = 0; this.pheadYaw = 0;
      this.t = null; this.fresh = true;
      if (d) { this.w = d.w; this.h = d.h; } else if (type === 'player') { this.w = 0.6; this.h = 1.8; } else { this.w = 0.25; this.h = 0.25; }
      this.eye = this.h * 0.85;
      if (type === 'item') { this.stack = { id: 1, count: 1 }; this.bobOffset = 0; }
    }
    get living() { return this._living; }
    apply(v) {
      const x = v[9] || {};
      this.t = [v[2], v[3], v[4], v[5], v[6], v[7], v[8]];
      if (this.fresh) { this.fresh = false; this.setPos(v[2], v[3], v[4]); this.yaw = this.pyaw = v[5]; this.bodyYaw = this.pbodyYaw = v[6]; this.headYaw = this.pheadYaw = v[7]; this.pitch = this.ppitch = v[8]; }
      this.hurtTime = x.ht || 0; this.deathTime = x.dt || 0;
      this.health = this.deathTime > 0 ? 0 : (x.hp !== undefined ? x.hp : 20);
      if (x.mh) this.maxHealth = x.mh;
      if (x.sw === 0 || (x.sw > 0 && this.swingTicks < 0)) this.swingTicks = x.sw;
      this.onGround = !x.air; this.fire = x.f ? 1 : 0;
      for (const k of KEYS) this[k] = x[k] === undefined ? (k === 'healer' ? null : (typeof this[k] === 'number' ? 0 : undefined)) : x[k];
      if (this.type === 'slime' || this.type === 'magma_cube') { const s = this.variant || 1; this.scale = s; this.w = this.h = 0.51 * s; }
      if (this.type === 'player') {
        this.held = x.h && I.get(x.h) ? { id: x.h, count: 1 } : null;
        this.armor = (Array.isArray(x.a) ? x.a : [0, 0, 0, 0]).slice(0, 4).map(id => id && I.get(id) ? { id, count: 1 } : null);
        this.sneaking = !!x.sn; this.by = typeof x.by === 'string' ? x.by.slice(0, 80) : null;
        this.swimming = !!x.swm; this.eating = !!x.eat; this.seated = !!x.rd;
      } else if (this.type === 'item' && Array.isArray(x.st)) {
        const st = validStack({ id: x.st[0], count: Math.max(1, Math.min(64, x.st[1] | 0)), dmg: 0 });
        if (st) this.stack = st;
        if (!this._ageSet) { this.age = x.ag | 0; this._ageSet = true; }
        this.bobOffset = x.bo || 0;
      } else if (this.type === 'arrow') this.shake = x.sh || 0;
      else if (this.type === 'thrown') { this.kind = x.k; this.icon = isInt(x.ic, 1, 511) ? x.ic : null; this.size = isNum(x.sz, 0.05, 2) ? x.sz : 0.25; }
      else if (this.type === 'tnt') this.fuse = x.fu | 0;
      else if (this.type === 'falling') this.block = isInt(x.bl, 1, 255) && S.blocks[x.bl] ? x.bl : B.sand;
    }
    tick() {
      this.px = this.x; this.py = this.y; this.pz = this.z;
      this.pyaw = this.yaw; this.ppitch = this.pitch; this.pbodyYaw = this.bodyYaw; this.pheadYaw = this.headYaw;
      this.age++;
      if (this.swingTicks >= 0) { this.swingTicks++; if (this.swingTicks >= 6) this.swingTicks = -1; }
      this.swingProgress = this.swingTicks >= 0 ? this.swingTicks / 6 : 0;
      if (this.t) {
        const [tx, ty, tz, yaw, by, hy, pi] = this.t;
        if (Math.abs(tx - this.x) + Math.abs(ty - this.y) + Math.abs(tz - this.z) > 16) { this.x = tx; this.y = ty; this.z = tz; }
        else { this.x += (tx - this.x) * 0.5; this.y += (ty - this.y) * 0.5; this.z += (tz - this.z) * 0.5; }
        this.yaw += DL.wrapAngle(yaw - this.yaw) * 0.5;
        this.bodyYaw += DL.wrapAngle(by - this.bodyYaw) * 0.5;
        this.headYaw += DL.wrapAngle(hy - this.headYaw) * 0.5;
        this.pitch += (pi - this.pitch) * 0.5;
      }
      if (this._living) {
        this.prevLimbAmount = this.limbSwingAmount;
        let f = Math.hypot(this.x - this.px, this.z - this.pz) * 4; if (f > 1) f = 1;
        this.limbSwingAmount += (f - this.limbSwingAmount) * 0.4; this.limbSwing += this.limbSwingAmount;
      }
    }
    damage(src, amount, from) {
      if (from && from === this.world.player && N.client) { N.client.send({ t: 'atk', id: this.netId, d: Math.min(30, Math.max(0, amount)) }); return true; }
      return false;
    }
    knockBack() { }
    serialize() { return null; }
  }

  class Client {
    constructor(game, L, link, info) {
      this.game = game; this.L = L; this.link = link; this.info = info;
      this.proxies = new Map(); this.seq = 0; this.wantQ = []; this.unQ = []; this.reqAt = new Map(); this.tickN = 0;
      link.onmsg = (m) => { try { this.handle(m); } catch (e) { console.warn('net: bad message', e); } };
      link.onbin = (h, p) => { try { this.binary(h, p); } catch (e) { console.warn('net: bad chunk', e); } };
      link.onclose = () => this.lost(this.kickReason || 'Connection to the host was lost');
    }
    send(m, fast) { return this.link.send(m, fast); }
    handle(m) {
      const g = this.game, w = g.world, p = g.player;
      switch (m.t) {
        case 'welcome': this.start(m); return;
        case 'kick': this.kickReason = clean(m.r, 60) || 'Disconnected'; return;
        case 'world': if (isInt(m.dim, 0, 4) && isVec(m.pos, 3, 3e7)) this.enterWorld(m.dim, m.pos, isNum(m.time, 0, 1e12) ? m.time : 0, m.fy); return;
      }
      if (!w || !p) return;
      switch (m.t) {
        case 'bc': {
          if (!Array.isArray(m.b) || m.b.length > 20000) return;
          w._netApply = true;
          for (const b of m.b) {
            if (!Array.isArray(b) || b.length !== 5 || !b.every(Number.isInteger)) continue;
            const [x, y, z, id, meta] = b;
            if (y < 0 || y >= S.CH || id < 0 || id > 255 || (id && !S.blocks[id]) || meta < 0 || meta > 15) continue;
            w.setBlock(x, y, z, id, meta, 0);
          }
          w._netApply = false;
          return;
        }
        case 'es': {
          if (!isInt(m.s, 0, 1e12) || m.s <= this.seq || !Array.isArray(m.e) || m.e.length > 200) return;
          this.seq = m.s;
          const seen = new Set();
          for (const v of m.e) {
            if (!Array.isArray(v) || v.length !== 10 || !isInt(v[0], 1, 1e12) || typeof v[1] !== 'string' || !v.slice(2, 9).every(n => isNum(n, -3e7, 3e7))) continue;
            const type = v[1];
            if (!(E.MOBS[type] || ['player', 'item', 'arrow', 'thrown', 'tnt', 'falling'].includes(type))) continue;
            let px = this.proxies.get(v[0]);
            if (!px || px.type !== type) { if (px) px.removed = true; px = new Proxy(w, v[0], type); this.proxies.set(v[0], px); w.entities.push(px); }
            px.apply(v);
            seen.add(v[0]);
          }
          let boss = null;
          for (const [id, px] of this.proxies) {
            if (!seen.has(id)) { px.removed = true; this.proxies.delete(id); }
            else if (px.def && px.def.boss && px.health > 0) boss = px;
          }
          w.boss = boss;
          return;
        }
        case 'time': if (isNum(m.v, 0, 1e12)) { w.time = m.v; w.timeFrozen = !!m.f; } if (Array.isArray(m.wr) && DL.Extras) { const wt = DL.Extras.weather(g); if (wt) { wt.target = m.wr[0] ? 1 : 0; wt.thunderT = m.wr[1] ? 1 : 0; } } return;
        case 'fx': {
          if (!Array.isArray(m.l) || !w.fx) return;
          for (const f of m.l.slice(0, 64)) {
            if (!f || !isVec(f.p, 3, 3e7)) continue;
            if (f.k === 's' && typeof f.n === 'string' && /^[a-z_]{1,24}$/.test(f.n)) w.fx.sound(f.n, f.p[0], f.p[1], f.p[2], isNum(f.v, 0, 10) ? f.v : 1, isNum(f.pi, 0.1, 4) ? f.pi : 1);
            else if (f.k === 'x' && isNum(f.w, 0, 10)) w.fx.explosion(f.p[0], f.p[1], f.p[2], f.w);
            else if (f.k === 'b' && isInt(f.id, 1, 255) && S.blocks[f.id]) w.fx.blockBroken(Math.floor(f.p[0]), Math.floor(f.p[1]), Math.floor(f.p[2]), f.id, f.m | 0);
            else if (f.k === 'l' && DL.Extras) DL.Extras.remoteBolt(Math.floor(f.p[0]), Math.floor(f.p[1]), Math.floor(f.p[2]));
            else if (f.k === 'p' && typeof f.n === 'string' && /^[a-z_]{1,16}$/.test(f.n)) w.fx.particles(f.n, f.p[0], f.p[1], f.p[2], Math.min(30, f.c | 0), isNum(f.sp, 0, 8) ? f.sp : 0.5);
          }
          return;
        }
        case 'chat': g.chatMessage('<' + N.nameOf(typeof m.by === 'string' ? m.by : null) + '> ' + clean(m.m, 100)); return;
        case 'sys': g.chatMessage('§e' + N.nameOf(typeof m.by === 'string' ? m.by : null) + ' ' + clean(m.m, 40)); return;
        case 'hurt': {
          if (!isNum(m.a, 0, 100)) return;
          const from = Array.isArray(m.f) && isVec(m.f, 2, 3e7) ? { x: m.f[0], z: m.f[1], living: false } : null;
          p.damage(clean(m.s, 16) || 'mob', m.a, from);
          return;
        }
        case 'give': {
          const st = validStack(m.st);
          if (!st) return;
          const left = p.addItem(st);
          if (left) this.dropStack(left);
          if (w.fx && isVec(m.p, 3, 3e7)) w.fx.pickup({ x: m.p[0], y: m.p[1], z: m.p[2], stack: st, age: 0, bobOffset: 0 }, p);
          return;
        }
        case 'tp': if (isVec(m.p, 3, 3e7)) { p.setPos(m.p[0], m.p[1], m.p[2]); p.vx = p.vy = p.vz = 0; p.fallDistance = 0; } return;
        case 'te': {
          if (!isVec(m.p, 3, 3e7) || !m.d) return;
          const te = w.getTile(m.p[0], m.p[1], m.p[2]);
          if (!te || !te.items) return;
          const items = validStacks(m.d.items, te.items.length);
          if (!items) return;
          for (let i = 0; i < items.length; i++) te.items[i] = items[i];
          for (const k of ['burn', 'burnMax', 'cook']) if (isInt(m.d[k], 0, 1e6)) te[k] = m.d[k];
          if (this.openTe && this.openTe.te === te) this.openTe.json = JSON.stringify(te.items);
          return;
        }
        case 'wait': if (G.screen === null || !(G.screen instanceof G.LoadingScreen)) { const ls = new G.LoadingScreen(g); ls.title = 'The host is changing dimension'; ls.status = 'Please wait'; ls.progress = -1; g.setScreen(ls); this.waiting = ls; } return;
        default: if (Object.prototype.hasOwnProperty.call(N.clientHandlers, m.t)) N.clientHandlers[m.t](this, m, g, w, p);
      }
    }
    binary(h, payload) {
      if (h.t !== 'chunk' || !isInt(h.cx, -2e6, 2e6) || !isInt(h.cz, -2e6, 2e6)) return;
      const w = this.game.world;
      if (!w) return;
      const k = DL.ckey(h.cx, h.cz);
      if (!w.pendingGen.has(k)) { this.unQ.push([h.cx, h.cz]); return; }
      const finish = (raw) => {
        if (!raw || raw.length !== 65792 || this.game.world !== w) return;
        const tiles = [];
        if (Array.isArray(h.tiles)) for (const t of h.tiles.slice(0, 256)) {
          if (!t || !isInt(t.x, h.cx * 16, h.cx * 16 + 15) || !isInt(t.z, h.cz * 16, h.cz * 16 + 15) || !isInt(t.y, 0, S.CH - 1)) continue;
          if (t.type === 'chest' || t.type === 'furnace') {
            const n = t.type === 'chest' ? (Array.isArray(t.items) ? t.items.length : 27) : 3;
            const items = validStacks(t.items, n === 27 || n === 3 ? n : 27);
            if (!items) continue;
            tiles.push({ type: t.type, x: t.x, y: t.y, z: t.z, items, burn: t.burn | 0, burnMax: t.burnMax | 0, cook: t.cook | 0 });
          } else if (t.type === 'spawner') tiles.push({ type: 'spawner', x: t.x, y: t.y, z: t.z, mob: 'pig', delay: 1e9 });
        }
        this.reqAt.delete(k);
        w.genResults.push({ t: 'gen', cx: h.cx, cz: h.cz, blocks: raw.slice(0, 32768), meta: raw.slice(32768, 65536), biomes: raw.slice(65536, 65792), saved: { populated: true, tiles, entities: null } });
      };
      const data = payload.slice();
      if (h.z) DL.Storage.decompress({ raw: false, data: data.buffer }).then(finish).catch(() => {});
      else finish(data);
    }
    /** Called by the guest world instead of generating a chunk. */
    want(cx, cz, k) { this.wantQ.push([cx, cz]); this.reqAt.set(k, performance.now()); this.soon(); }
    unloaded(c) { this.unQ.push([c.cx, c.cz]); this.reqAt.delete(c.key); this.soon(); }
    /** Requests go out right away (also while the loading screen is up). */
    soon() {
      if (this._flushQ) return;
      this._flushQ = true;
      setTimeout(() => { this._flushQ = false; this.flush(); }, 0);
    }
    flush() {
      const w = this.game.world;
      if (!w || !this.link.open) return;
      const now = performance.now();
      for (const [k, at] of this.reqAt) if (now - at > 12000) { this.reqAt.delete(k); w.pendingGen.delete(k); }
      while (this.wantQ.length) this.send({ t: 'ch', k: this.wantQ.splice(0, 48) });
      while (this.unQ.length) this.send({ t: 'un', k: this.unQ.splice(0, 256) });
    }
    dropStack(st) {
      const p = this.game.player;
      const s = Math.sin(p.yaw), c = Math.cos(p.yaw), ps = Math.sin(p.pitch), pc = Math.cos(p.pitch);
      this.send({ t: 'drop', p: [F2(p.x), F2(p.y + p.eye - 0.3), F2(p.z)], v: [F2(-s * pc * 0.3), F2(ps * 0.3 + 0.1), F2(-c * pc * 0.3)], st });
    }
    start(m) {
      if (this.started || !isInt(m.seed, -2147483648, 2147483647) || !isInt(m.dim, 0, 4) || !isVec(m.pos, 3, 3e7)) return;
      this.started = true;
      const g = this.game;
      g.meta = { slot: '__lan', name: clean(m.n, 32) || 'LAN World', seed: m.seed, creative: !!m.cr, spawn: isVec(m.sp, 3, 3e7) ? m.sp : m.pos, mp: true, dragonKilled: !!m.dk };
      this.seed = m.seed;
      this.save = m.save;
      this.enterWorld(m.dim, m.pos, isNum(m.time, 0, 1e12) ? m.time : 0, m.fy, true, !!m.tf);
    }
    enterWorld(dim, pos, time, fy, first, tf) {
      const g = this.game, st = g.settings;
      const old = g.world;
      if (old) { for (const c of old.chunks.values()) g.renderer.freeChunk(c); old.destroy(); }
      this.proxies.clear(); this.wantQ = []; this.unQ = []; this.reqAt.clear(); this.seq = 0;
      const ls = new G.LoadingScreen(g);
      ls.title = first ? 'Joining ' + g.meta.name : 'Following the host';
      ls.status = 'Downloading terrain';
      g.setScreen(ls); g.loadingScreen = ls; g.inGame = false;
      const world = new DL.World({ seed: this.seed, slot: '__lan', dim, name: g.meta.name, time, renderDist: Math.min(8, G.RENDER_DISTS[st.renderDist].v), fancy: st.fancy, smooth: st.smooth, difficulty: st.difficulty });
      world.remote = true; world.timeFrozen = !!tf; world._dragonChecked = true;
      if (isNum(fy, 0, 255)) world.endFountainY = fy;
      g.world = world;
      g.hookWorld(world);
      let p = g.player;
      if (!p || first) {
        p = new E.Player(world, pos[0], pos[1], pos[2]);
        if (this.save) {
          const s = this.save;
          const inv = validStacks(s.inv, 36), armor = validStacks(s.armor, 4);
          if (inv) p.inv = inv; if (armor) p.armor = armor;
          if (isNum(s.health, 1, 20)) p.health = s.health;
          if (isInt(s.selected, 0, 8)) p.selected = s.selected;
          if (isInt(s.score, 0, 1e9)) p.score = s.score;
        }
        p.creative = !!g.meta.creative;
        p.spawnPoint = g.meta.spawn;
        g.player = p;
      }
      p.world = world; world.player = p; world.entities.push(p);
      p.setPos(pos[0], pos[1], pos[2]); p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
      g.loading = { t0: performance.now(), isNew: false, phase: 0 };
      g.renderer.particles.length = 0; g.collectAnims.length = 0;
      g.prevHealth = p.health;
    }
    tick() {
      const g = this.game, w = g.world, p = g.player;
      if (!w || !this.link.open) return;
      this.tickN++;
      this.flush();
      if (!p || g.loading) return;
      const fl = (p.sneaking ? 1 : 0) | (p.onGround ? 2 : 0) | (p.creative ? 4 : 0) | (p.swimming ? 8 : 0) | (p.eating ? 16 : 0) | (p.vehicle || p.sitting ? 32 : 0);
      this.send({
        t: 'ps', p: [F2(p.x), F2(p.y), F2(p.z)], r: [F2(p.yaw), F2(p.pitch), F2(p.bodyYaw), F2(p.headYaw)], f: fl,
        hp: p.health, sw: p.swingTicks, h: p.held ? p.held.id : 0, a: p.armor.map(s => s ? s.id : 0), dim: w.dim || 0
      }, true);
      // chest / furnace being used
      const scr = G.screen;
      if (scr && scr.te && w.getTile(scr.te.x, scr.te.y, scr.te.z) === scr.te) {
        if (!this.openTe || this.openTe.te !== scr.te) {
          if (this.openTe) this.send({ t: 'tec', p: this.openTe.p });
          this.openTe = { te: scr.te, p: [scr.te.x, scr.te.y, scr.te.z], json: JSON.stringify(scr.te.items) };
          this.send({ t: 'teo', p: this.openTe.p });
        } else if (this.tickN % 3 === 0) {
          const json = JSON.stringify(scr.te.items);
          if (json !== this.openTe.json) { this.openTe.json = json; this.send({ t: 'tes', p: this.openTe.p, items: scr.te.items }); }
        }
      } else if (this.openTe) {
        const json = JSON.stringify(this.openTe.te.items);
        if (json !== this.openTe.json) this.send({ t: 'tes', p: this.openTe.p, items: this.openTe.te.items });
        this.send({ t: 'tec', p: this.openTe.p });
        this.openTe = null;
      }
      if (performance.now() - this.link.lastHeard > 20000) this.link.close();
    }
    sendSave() {
      const p = this.game.player;
      if (!p) return;
      this.send({ t: 'save', d: { inv: p.inv, armor: p.armor, hp: p.health, sel: p.selected, score: p.score } });
    }
    leave() {
      this.leaving = true;
      this.sendSave();
      this.send({ t: 'bye' });
      setTimeout(() => this.link.close(), 150);
    }
    lost(reason) {
      if (N.client !== this) return;
      N.client = null;
      if (this.leaving || !this.started) return; // still joining: N.join reports it
      const g = this.game;
      if (g.world) { for (const c of g.world.chunks.values()) g.renderer.freeChunk(c); g.world.destroy(); }
      g.world = null; g.player = null; g.loading = null; g.inGame = false;
      g.setScreen(new InfoScreen(g, 'Disconnected', reason));
    }
  }

  /* ------------------------------------------------------------ */
  /* Starting a game / joining one                                */
  /* ------------------------------------------------------------ */
  N.openToLan = async function (game) {
    if (N.host || N.client) return N.host;
    if (!N.supported()) { game.chatMessage('§cThis browser cannot host local multiplayer.'); return null; }
    const L = await N.lobby();
    const h = new Host(game, L);
    N.host = h;
    await h.start();
    game.chatMessage('§aLocal game opened! §fFriends on the same Wi-Fi can join from Multiplayer with code §e' + h.code);
    if (L.kind === 'server') {
      const ips = (L.info && L.info.ips) || [], port = location.port ? ':' + location.port : '';
      game.chatMessage('§7Friends open §fhttp://' + (ips[0] || location.hostname) + port + '§7 in their browser, then Multiplayer.');
    } else if (L.kind === 'local') game.chatMessage('§7(No lobby in this copy: run the DreamLand server from the download, or use Pause > Invite by code.)');
    else game.chatMessage('§7Friend on a downloaded copy? Use Pause > Invite by code.');
    return h;
  };
  N.join = async function (game, gameEntry, code, onStatus) {
    if (N.host || N.client) return false;
    if (!N.supported()) { onStatus('This browser cannot do local multiplayer'); return false; }
    const L = await N.lobby();
    if (L.kind === 'server') return joinViaServer(game, L, gameEntry, code, onStatus);
    const room = L.room;
    const hostPeer = gameEntry.peer;
    const pc = newPC();
    const link = new Link(pc);
    link.attach(pc.createDataChannel('r', { ordered: true }));
    link.attach(pc.createDataChannel('u', { ordered: false, maxRetransmits: 0 }));
    const k = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
    onStatus('Preparing connection...');
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc, 2500);
    const sdp = lanOnly(pc.localDescription.sdp);
    const packed = packSdp(sdp);
    if (!sdp || !packed || !/a=candidate:/.test(sdp)) { link.close(); onStatus('No local network found - connect to Wi-Fi'); return false; }
    try { await room.presence({ dl: { v: PROTO, join: { to: hostPeer, sdp: packed, k } } }); } catch (e) { link.close(); onStatus('The lobby refused the request, try again'); return false; }
    onStatus('Asking the host to let you in...');
    const ok = await new Promise((res) => {
      let done = false;
      const finish = (v) => { if (done) return; done = true; clearInterval(iv); clearTimeout(to); unsub(); res(v); };
      const check = async () => {
        if (link.open) return finish(true);
        if (pc.remoteDescription) return;
        const hp = room.peers().find(p => p.peer === hostPeer);
        const a = hp && hp.presence && hp.presence.dl && hp.presence.dl.ans;
        const me = N.myPeer(room);
        if (a && a.to === me && a.k === k) {
          const ans = lanOnly(unpackSdp(a.sdp));
          if (!ans) return finish(false);
          try { await pc.setRemoteDescription({ type: 'answer', sdp: ans }); onStatus('Connecting over your Wi-Fi...'); } catch (e) { finish(false); }
        }
      };
      link.onopen = () => finish(true);
      const unsub = room.onPeers(() => check());
      const iv = setInterval(check, 300);
      const to = setTimeout(() => finish(false), 25000);
    });
    room.presence({ dl: null }).catch(() => {});
    if (!ok || !link.open) { link.close(); onStatus('Could not connect. Make sure you are both on the same Wi-Fi.'); return false; }
    return enterGame(game, L, link, gameEntry, code, k, onStatus);
  };
  async function joinViaServer(game, L, gameEntry, code, onStatus) {
    const room = L.room, host = gameEntry.peer;
    const lid = (crypto.getRandomValues(new Uint32Array(1))[0] >>> 1) || 1;
    const rel = room.relayPc(host, lid);
    const link = new Link(rel.pc);
    link.attach(rel.r); link.attach(rel.u);
    onStatus('Asking the host to let you in...');
    const ok = await new Promise((res) => {
      let off = null;
      const t = setTimeout(() => { if (off) off(); res(false); }, 8000);
      off = room.onCtl((from, d) => {
        if (from !== host || !d) return;
        if (d.opened === lid) { clearTimeout(t); off(); rel.r.markOpen(); rel.u.markOpen(); res(true); }
        else if (d.refused === lid) { clearTimeout(t); off(); res(false); }
      });
      room.sendCtl(host, { open: lid, v: PROTO });
    });
    if (!ok || !link.open) { link.close(); onStatus('The host did not answer. Is their game open to Wi-Fi?'); return false; }
    const k = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
    return enterGame(game, L, link, gameEntry, code, k, onStatus);
  }
  async function enterGame(game, L, link, gameEntry, code, k, onStatus) {
    let key = null;
    try { key = localStorage.getItem('dreamland.lankey'); if (!key) { key = k + k.slice(0, 4); localStorage.setItem('dreamland.lankey', key); } } catch (e) { key = k; }
    const client = new Client(game, L, link, gameEntry);
    N.client = client;
    onStatus('Checking join code...');
    link.send({ t: 'hello', v: PROTO, code: String(code), rd: Math.min(8, G.RENDER_DISTS[game.settings.renderDist].v), key });
    const started = await new Promise(res => { const t0 = performance.now(); const iv = setInterval(() => { if (client.started) { clearInterval(iv); res(true); } else if (!link.open || performance.now() - t0 > 12000) { clearInterval(iv); res(false); } }, 100); });
    if (!started) {
      const why = client.kickReason || 'The host did not answer';
      N.client = null; link.close();
      onStatus(why);
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ */
  /* Invite codes: connect any two copies (claude.ai, a download, */
  /* another browser) by pasting two short codes, no lobby needed */
  /* ------------------------------------------------------------ */
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64enc(b) {
    let s = '';
    for (let i = 0; i < b.length; i += 3) {
      const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0), k = Math.min(4, Math.ceil((b.length - i) * 4 / 3));
      for (let j = 0; j < k; j++) s += B64[(n >> (18 - 6 * j)) & 63];
    }
    return s;
  }
  function b64dec(s) {
    const out = []; let acc = 0, bits = 0;
    for (const c of s) {
      const v = B64.indexOf(c); if (v < 0) return null;
      acc = ((acc << 6) | v) & 0xffffff; bits += 6;
      if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
    }
    return Uint8Array.from(out);
  }
  const ICE_RE = /^[A-Za-z0-9+/]{4,256}$/, MID_RE = /^[A-Za-z0-9_-]{1,16}$/;
  const UUID_LOCAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.local$/;
  const IP4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  /** The few things a data-channel SDP really needs. */
  function sdpInfo(sdp) {
    const get = (re) => { const m = re.exec(sdp); return m ? m[1].trim() : null; };
    const ufrag = get(/^a=ice-ufrag:(.+)$/m), pwd = get(/^a=ice-pwd:(.+)$/m), mid = get(/^a=mid:(.+)$/m) || '0', setup = get(/^a=setup:(.+)$/m) || 'actpass';
    const fpm = /^a=fingerprint:sha-256 ([0-9A-Fa-f:]+)\s*$/m.exec(sdp);
    if (!ufrag || !pwd || !fpm || !ICE_RE.test(ufrag) || !ICE_RE.test(pwd) || !MID_RE.test(mid)) return null;
    const fp = fpm[1].split(':').map(h => parseInt(h, 16));
    if (fp.length !== 32 || fp.some(v => !(v >= 0 && v <= 255))) return null;
    const cands = [];
    for (const line of sdp.split(/\r?\n/)) {
      if (!line.startsWith('a=candidate:')) continue;
      const f = line.slice(12).split(' '), a = String(f[4] || '').toLowerCase(), port = parseInt(f[5], 10);
      if (f.length < 8 || f[1] !== '1' || String(f[2]).toLowerCase() !== 'udp' || f[7] !== 'host' || !(port > 0 && port < 65536)) continue;
      if (!(privateAddr(a) || N._testAnyHost === true) || !(IP4.test(a) || UUID_LOCAL.test(a) || /^[0-9a-f:]{2,39}$/.test(a))) continue;
      if (!cands.some(c => c.a === a && c.p === port)) cands.push({ a, p: port });
    }
    cands.sort((x, y) => (x.a.includes(':') ? 1 : 0) - (y.a.includes(':') ? 1 : 0));
    return { ufrag, pwd, mid, setup: setup === 'active' ? 1 : setup === 'passive' ? 2 : 0, fp, cands: cands.slice(0, 6) };
  }
  /** kind 1 = join request (guest -> host), kind 2 = reply (host -> guest). */
  function packInvite(kind, sdp) {
    const s = sdpInfo(sdp);
    if (!s || (kind === 2 && !s.cands.length)) return null;
    const out = [1, kind | (s.setup << 4)];
    const str = (t) => { out.push(t.length); for (const ch of t) out.push(ch.charCodeAt(0) & 255); };
    str(s.ufrag); str(s.pwd); str(s.mid);
    out.push(...s.fp);
    // Both codes carry every local address: Windows firewalls only let the
    // other side in once traffic has gone out to it, so both ends must knock.
    const cands = s.cands;
    out.push(cands.length);
    for (const c of cands) {
      const m = IP4.exec(c.a);
      if (m) out.push(4, +m[1], +m[2], +m[3], +m[4]);
      else if (UUID_LOCAL.test(c.a)) { out.push(109); const hx = c.a.slice(0, 36).replace(/-/g, ''); for (let i = 0; i < 32; i += 2) out.push(parseInt(hx.slice(i, i + 2), 16)); }
      else { out.push(115); str(c.a); }
      out.push(c.p >> 8, c.p & 255);
    }
    return 'DL' + kind + '-' + b64enc(out);
  }
  function unpackInvite(text, kind) {
    const m = /DL([12])-([A-Za-z0-9_-]{40,400})/.exec(String(text || '').replace(/\s+/g, ''));
    if (!m || +m[1] !== kind) return null;
    const b = b64dec(m[2]);
    if (!b) return null;
    let i = 0;
    const need = (n) => { if (i + n > b.length) throw new Error('short'); };
    const str = () => { need(1); const n = b[i++]; need(n); let t = ''; for (let k = 0; k < n; k++) t += String.fromCharCode(b[i++]); return t; };
    try {
      need(2);
      if (b[i++] !== 1) return null;
      const fl = b[i++], setup = ['actpass', 'active', 'passive'][fl >> 4];
      if ((fl & 15) !== kind || !setup) return null;
      const ufrag = str(), pwd = str(), mid = str();
      if (!ICE_RE.test(ufrag) || !ICE_RE.test(pwd) || !MID_RE.test(mid)) return null;
      need(32);
      const fp = Array.from(b.slice(i, i + 32), v => v.toString(16).toUpperCase().padStart(2, '0')).join(':'); i += 32;
      need(1);
      const n = b[i++], cands = [];
      if (n > 6) return null;
      for (let k = 0; k < n; k++) {
        need(1);
        const ty = b[i++]; let a;
        if (ty === 4) { need(4); a = b[i] + '.' + b[i + 1] + '.' + b[i + 2] + '.' + b[i + 3]; i += 4; }
        else if (ty === 109) { need(16); const h = Array.from(b.slice(i, i + 16), v => v.toString(16).padStart(2, '0')).join(''); i += 16; a = h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20) + '.local'; }
        else if (ty === 115) { a = str(); if (!/^[0-9a-f:]{2,39}$/.test(a)) return null; }
        else return null;
        need(2);
        const port = (b[i] << 8) | b[i + 1]; i += 2;
        if (port && (privateAddr(a) || N._testAnyHost === true)) cands.push('a=candidate:' + (k + 1) + ' 1 udp ' + (2122260223 - k * 256) + ' ' + a + ' ' + port + ' typ host generation 0');
      }
      if (i !== b.length || (kind === 2 && !cands.length)) return null;
      const sid = String(Date.now()) + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
      return ['v=0', 'o=- ' + sid + ' 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE ' + mid,
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', ...cands,
        'a=ice-ufrag:' + ufrag, 'a=ice-pwd:' + pwd, 'a=ice-options:trickle', 'a=fingerprint:sha-256 ' + fp,
        'a=setup:' + setup, 'a=mid:' + mid, 'a=sctp-port:5000', 'a=max-message-size:262144'].join('\r\n') + '\r\n';
    } catch (e) { return null; }
  }
  N._invite = { pack: packInvite, unpack: unpackInvite };

  /** Guest: make a join-request code; `connect(reply)` finishes the job. */
  N.inviteOffer = async function () {
    if (!N.supported()) return { error: 'This browser cannot do local multiplayer' };
    const pc = newPC(), link = new Link(pc);
    link.patient = true;
    link.attach(pc.createDataChannel('r', { ordered: true }));
    link.attach(pc.createDataChannel('u', { ordered: false, maxRetransmits: 0 }));
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc, 2500);
    const local = pc.localDescription.sdp;
    if (!/a=candidate:/.test(lanOnly(local))) { link.close(); return { error: 'No Wi-Fi network found - connect to Wi-Fi first' }; }
    const code = packInvite(1, local);
    if (!code) { link.close(); return { error: 'This browser made a connection we cannot share, sorry' }; }
    const k = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
    return {
      code,
      cancel: () => { if (!link.open || !N.client) link.close(); },
      async connect(game, replyText, onStatus) {
        const sdp = unpackInvite(replyText, 2);
        if (!sdp) return 'bad';
        if (N.host || N.client) return 'busy';
        try { await pc.setRemoteDescription({ type: 'answer', sdp }); } catch (e) { console.warn('net: invite answer', e); return 'bad'; }
        onStatus('Connecting over your Wi-Fi...');
        const open = await new Promise(res => { if (link.open) return res(true); link.onopen = () => res(true); setTimeout(() => res(link.open), 20000); });
        if (!open) { link.close(); return 'fail'; }
        link.patient = false;
        const L = await N.lobby();
        return (await enterGame(game, L, link, { peer: null, by: null, world: 'World', players: 1 }, '', k, onStatus)) ? 'ok' : 'fail';
      }
    };
  };
  /** Host: turn a friend's join-request code into a reply code. */
  N.inviteAccept = async function (game, text) {
    const offer = unpackInvite(text, 1);
    if (!offer) return { error: 'bad' };
    if (N.client) return { error: 'You are playing on someone else\'s game' };
    const h = N.host || await N.openToLan(game);
    if (!h) return { error: 'This browser cannot host local multiplayer' };
    const pc = newPC();
    const conn = new Conn(h, pc, 'invite-' + Math.random().toString(36).slice(2, 10), null);
    conn.trusted = true; conn.link.patient = true;
    pc.ondatachannel = (ev) => conn.link.attach(ev.channel);
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
    } catch (e) { console.warn('net: invite offer', e); conn.link.close(); return { error: 'bad' }; }
    await gathered(pc, 2500);
    const reply = packInvite(2, lanOnly(pc.localDescription.sdp));
    if (!reply) { conn.link.close(); return { error: 'No Wi-Fi network found - connect to Wi-Fi first' }; }
    conn.link.onopen = () => {
      conn.link.patient = false;
      if (h.stopped || N.host !== h || h.conns.size > MAX_GUESTS) { conn.link.close(); return; }
      h.conns.add(conn);
      setTimeout(() => { if (!conn.authed) conn.link.close(); }, 10000);
    };
    setTimeout(() => { if (!conn.link.open) conn.link.close(); }, 10 * 60 * 1000);
    return { reply, conn };
  };

  /* A small HTML dialog: canvas text fields cannot be pasted into on phones. */
  function el(tag, css, text) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; return e; }
  const BTN_CSS = 'font:inherit;color:#fff;background:#6b6b6b;border:2px solid #000;box-shadow:inset 2px 2px #a5a5a5,inset -2px -2px #3e3e3e;padding:9px 14px;min-height:42px;cursor:pointer;margin:6px 6px 0 0;';
  function dialog(title) {
    try { DL.Input.textInput.blur(); } catch (e) { /* ignore */ }
    if (document.exitPointerLock) try { document.exitPointerLock(); } catch (e) { /* ignore */ }
    const root = el('div', 'position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.62);font:15px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#fff;touch-action:auto;-webkit-user-select:text;user-select:text;padding:12px;box-sizing:border-box;');
    const box = el('div', 'background:#2b2b2b;border:2px solid #000;box-shadow:inset 2px 2px #5a5a5a,inset -2px -2px #161616;padding:16px;width:100%;max-width:480px;max-height:100%;overflow:auto;box-sizing:border-box;');
    box.appendChild(el('div', 'font-size:17px;font-weight:bold;margin-bottom:8px;color:#ffff55;', title));
    const body = el('div');
    const status = el('div', 'min-height:1.4em;margin-top:10px;color:#a0a0a0;');
    box.appendChild(body); box.appendChild(status); root.appendChild(box);
    const stop = (e) => { e.stopPropagation(); if (e.type === 'keydown' && e.key === 'Escape') d.close(); };
    for (const t of ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointerup', 'contextmenu']) root.addEventListener(t, stop);
    document.body.appendChild(root);
    const d = {
      onclose: null,
      closed: false,
      close() { if (d.closed) return; d.closed = true; root.remove(); if (d.onclose) d.onclose(); },
      clear() { body.textContent = ''; },
      text(t, col) { const p = el('div', 'margin:8px 0 4px;' + (col ? 'color:' + col + ';' : ''), t); body.appendChild(p); return p; },
      area(value, editable, placeholder) {
        const a = el('textarea', 'display:block;width:100%;box-sizing:border-box;height:92px;font:16px/1.3 ui-monospace,Menlo,Consolas,monospace;background:#000;color:#fff;border:2px solid #a0a0a0;padding:6px;resize:none;word-break:break-all;-webkit-user-select:text;user-select:text;touch-action:auto;');
        a.value = value || ''; a.readOnly = !editable; a.spellcheck = false; a.autocapitalize = 'off'; a.setAttribute('autocorrect', 'off'); a.autocomplete = 'off';
        if (placeholder) a.placeholder = placeholder;
        if (!editable) a.addEventListener('focus', () => { try { a.select(); a.setSelectionRange(0, a.value.length); } catch (e) { /* ignore */ } });
        body.appendChild(a); return a;
      },
      buttons(list) {
        const row = el('div', 'display:flex;flex-wrap:wrap;');
        for (const [label, fn] of list) { const b = el('button', BTN_CSS, label); b.type = 'button'; b.addEventListener('click', (e) => { e.preventDefault(); fn(b); }); row.appendChild(b); }
        body.appendChild(row); return row;
      },
      status(t, col) { status.textContent = t || ''; status.style.color = col || '#a0a0a0'; }
    };
    return d;
  }
  async function copyCode(d, area) {
    const t = area.value;
    try { await navigator.clipboard.writeText(t); d.status('Copied! Now paste it in a message to your friend.', '#55ff55'); return; } catch (e) { /* try the old way */ }
    try { area.focus(); area.select(); area.setSelectionRange(0, t.length); if (document.execCommand('copy')) { d.status('Copied! Now paste it in a message to your friend.', '#55ff55'); return; } } catch (e) { /* ignore */ }
    d.status('Press and hold the code, then choose Select All and Copy.', '#ffff55');
  }
  async function shareCode(d, area) {
    try { await navigator.share({ text: area.value }); d.status('Sent!', '#55ff55'); } catch (e) { if (!e || e.name !== 'AbortError') copyCode(d, area); }
  }
  async function pasteInto(d, area) {
    try { const t = await navigator.clipboard.readText(); if (t) { area.value = t; area.dispatchEvent(new Event('input')); return; } } catch (e) { /* not allowed here */ }
    area.focus();
    d.status('Press and hold inside the box and choose Paste.', '#ffff55');
  }
  const shareBtn = (d, area) => (typeof navigator.share === 'function' ? [['Share...', () => shareCode(d, area)]] : []);

  /** Guest side: Multiplayer > Join with an invite code. */
  N.inviteJoinDialog = function (game, onStatus) {
    const d = dialog('Join with an invite code');
    let offer = null, busy = false;
    d.onclose = () => { if (offer && !N.client) offer.cancel(); };
    d.text('Making your code...');
    N.inviteOffer().then(o => {
      if (d.closed) { if (o.cancel) o.cancel(); return; }
      d.clear();
      if (o.error) { d.text(o.error, '#ff5555'); d.buttons([['Close', () => d.close()]]); return; }
      offer = o;
      d.text('1. Send this code to the friend who is hosting (Messages, WhatsApp, anything):');
      const mine = d.area(o.code, false);
      d.buttons([['Copy code', () => copyCode(d, mine)], ...shareBtn(d, mine)]);
      d.text('2. They open their pause menu, tap "Invite by code" and paste it. Then paste the reply code they send back here:');
      const reply = d.area('', true, 'DL2-...');
      const go = async () => {
        if (busy || d.closed) return;
        if (!unpackInvite(reply.value, 2)) { d.status(/DL1-/.test(reply.value) ? 'That is your own code - paste the reply your friend sends back.' : 'That does not look like a reply code (it starts with DL2-).', '#ff5555'); return; }
        busy = true;
        const r = await o.connect(game, reply.value, (t) => { d.status(t); if (onStatus) onStatus(t); });
        busy = false;
        if (r === 'ok') { offer = null; d.close(); return; }
        if (r === 'bad') d.status('That reply code did not work. Ask your friend to paste your code again.', '#ff5555');
        else if (r === 'busy') d.status('You are already in a game.', '#ff5555');
        else { offer = null; d.clear(); d.text('Could not connect. Check that you are both on the same Wi-Fi, then try again.', '#ff5555'); d.buttons([['Try again', () => { d.close(); N.inviteJoinDialog(game, onStatus); }], ['Close', () => d.close()]]); d.status(''); }
      };
      reply.addEventListener('input', () => { if (unpackInvite(reply.value, 2)) go(); });
      d.buttons([['Paste', () => pasteInto(d, reply)], ['Join', go], ['Cancel', () => d.close()]]);
    });
    return d;
  };
  /** Host side: Pause > Invite by code. */
  N.inviteHostDialog = function (game, onChange) {
    const d = dialog('Invite a friend by code');
    let busy = false, poll = null;
    d.onclose = () => { clearInterval(poll); if (onChange) onChange(); };
    const start = () => {
      d.clear(); d.status('');
      d.text('1. Your friend opens DreamLand (here on Claude, or a downloaded copy), taps Multiplayer > "Join with an invite code" and sends you their code. Paste it here:');
      const theirs = d.area('', true, 'DL1-...');
      const go = async () => {
        if (busy || d.closed) return;
        if (!unpackInvite(theirs.value, 1)) { d.status(/DL2-/.test(theirs.value) ? 'That is a reply code - paste the code that starts with DL1-.' : 'That does not look like a join code (it starts with DL1-).', '#ff5555'); return; }
        busy = true; d.status('Making a reply code...');
        const r = await N.inviteAccept(game, theirs.value);
        busy = false;
        if (d.closed) return;
        if (r.error) { d.status(r.error === 'bad' ? 'That code did not work. Ask your friend for a new one.' : r.error, '#ff5555'); return; }
        if (onChange) onChange();
        d.clear();
        d.text('2. Send this reply code back to your friend:');
        const mine = d.area(r.reply, false);
        d.buttons([['Copy code', () => copyCode(d, mine)], ...shareBtn(d, mine)]);
        d.status('Waiting for your friend to paste it...');
        d.buttons([['Invite someone else', () => { clearInterval(poll); start(); }], ['Close', () => d.close()]]);
        clearInterval(poll);
        poll = setInterval(() => {
          if (r.conn.authed) { clearInterval(poll); d.status('Your friend joined the game!', '#55ff55'); if (onChange) onChange(); setTimeout(() => d.close(), 1500); }
          else if (r.conn.link.closed) { clearInterval(poll); d.status('That invite expired. Tap "Invite someone else" to try again.', '#ff5555'); }
        }, 300);
      };
      theirs.addEventListener('input', () => { if (unpackInvite(theirs.value, 1)) go(); });
      d.buttons([['Paste', () => pasteInto(d, theirs)], ['Next', go], ['Close', () => d.close()]]);
    };
    start();
    return d;
  };

  /* ------------------------------------------------------------ */
  /* World hooks                                                  */
  /* ------------------------------------------------------------ */
  const W = DL.World.prototype;
  const setBlock = W.setBlock;
  W.setBlock = function (x, y, z, id, meta, flags) {
    if (this.remote && !this._netApply && !this._localEdit && N.client) {
      N.client.send({ t: 'set', p: [x, y, z], id: id | 0, m: (meta || 0) & 15 });
      this._localEdit = true;
      const r = setBlock.call(this, x, y, z, id, meta, (flags === undefined ? 1 : flags) & 2);
      this._localEdit = false;
      return r;
    }
    const r = setBlock.apply(this, arguments);
    if (r && this.netHost) this.netHost.mark(x, y, z);
    return r;
  };
  const setBlockRaw = W.setBlockRaw;
  W.setBlockRaw = function (x, y, z) { setBlockRaw.apply(this, arguments); if (this.netHost) this.netHost.mark(x, y, z); };
  const destroyBlock = W.destroyBlock;
  W.destroyBlock = function (x, y, z, drop, tool, byPlayer) {
    if (this.remote && N.client) {
      const id = this.getBlock(x, y, z);
      if (!id) return;
      const meta = this.getMeta(x, y, z);
      N.client.send({ t: 'br', p: [x, y, z], d: !!drop, h: tool && tool.id ? tool.id : 0 });
      this._localEdit = true;
      setBlock.call(this, x, y, z, 0, 0, 2);
      this._localEdit = false;
      if (this.fx) this.fx.blockBroken(x, y, z, id, meta);
      return;
    }
    return destroyBlock.apply(this, arguments);
  };
  const igniteTNT = W.igniteTNT;
  W.igniteTNT = function (x, y, z, fuse) {
    if (this.remote) { if (N.client) N.client.send({ t: 'ign', p: [x, y, z] }); return; }
    return igniteTNT.apply(this, arguments);
  };
  const spawnItem = W.spawnItem;
  W.spawnItem = function (x, y, z, stack, scatter) {
    if (this.remote) {
      if (this._netApply || this._localEdit || !N.client) return;
      const st = validStack(stack);
      if (st) N.client.send({ t: 'drop', p: [F2(x), F2(y), F2(z)], v: [F2((Math.random() - 0.5) * 0.2), 0.2, F2((Math.random() - 0.5) * 0.2)], st });
      return;
    }
    return spawnItem.apply(this, arguments);
  };
  const requestChunk = W.requestChunk;
  W.requestChunk = function (cx, cz, k) {
    if (this.remote) { this.pendingGen.add(k); if (N.client) N.client.want(cx, cz, k); return; }
    return requestChunk.apply(this, arguments);
  };
  const unloadChunk = W.unloadChunk;
  W.unloadChunk = function (c) { if (this.remote && N.client) N.client.unloaded(c); return unloadChunk.apply(this, arguments); };
  const saveChunk = W.saveChunk;
  W.saveChunk = function () { if (this.remote) return Promise.resolve(); return saveChunk.apply(this, arguments); };
  const saveAll = W.saveAll;
  W.saveAll = function () { if (this.remote) return Promise.resolve(); return saveAll.apply(this, arguments); };
  const wtick = W.tick;
  W.tick = function (pcx, pcz) {
    if (this.remote) { if (!this.timeFrozen) this.time++; this.totalTicks++; return; }
    return wtick.apply(this, arguments);
  };
  const schedule = W.schedule;
  W.schedule = function () { if (this.remote) return; return schedule.apply(this, arguments); };
  const explode = W.explode;
  W.explode = function () { if (this.remote) return; return explode.apply(this, arguments); };

  const naturalSpawn = E.naturalSpawn;
  E.naturalSpawn = function (world) { if (world.remote) return; return naturalSpawn.apply(this, arguments); };
  const tickSpawners = E.tickSpawners;
  E.tickSpawners = function (world) { if (world.remote) return; return tickSpawners.apply(this, arguments); };

  // mobs see every player, not just the host
  const Mob = E.Mob;
  const findTarget = Mob.prototype.findTarget;
  Mob.prototype.findTarget = function () {
    const w = this.world;
    if (!w.netHost || !w.netHost.conns.size) return findTarget.call(this);
    const save = w.player;
    const cands = [save];
    for (const c of w.netHost.conns) if (c.rp && !c.rp.removed && c.rp.health > 0) cands.push(c.rp);
    let best = null, bd = 1e9;
    try {
      for (const cand of cands) {
        w.player = cand;
        const t = findTarget.call(this);
        if (!t) continue;
        if (!t.isPlayer) { best = t; break; }
        const d = this.distTo(t);
        if (d < bd) { bd = d; best = t; }
      }
    } finally { w.player = save; }
    return best;
  };
  const despawnCheck = Mob.prototype.despawnCheck;
  Mob.prototype.despawnCheck = function () {
    const w = this.world;
    if (!w.netHost || !w.netHost.conns.size) return despawnCheck.call(this);
    const save = w.player;
    let best = save, bd = save ? this.dist2(save.x, save.y, save.z) : 1e18;
    for (const c of w.netHost.conns) if (c.rp && !c.rp.removed) { const d = this.dist2(c.rp.x, c.rp.y, c.rp.z); if (d < bd) { bd = d; best = c.rp; } }
    w.player = best;
    try { despawnCheck.call(this); } finally { w.player = save; }
  };

  // guests: drops and shots go to the host
  const P = E.Player.prototype;
  const dropItem = P.dropItem;
  P.dropItem = function (stack) {
    if (this.world.remote && N.client) { const st = validStack(stack); if (st) N.client.dropStack(st); return; }
    return dropItem.apply(this, arguments);
  };

  /* ------------------------------------------------------------ */
  /* Game hooks                                                   */
  /* ------------------------------------------------------------ */
  const GP = DL.Game.prototype;
  const gtick = GP.tick;
  GP.tick = function () {
    gtick.call(this);
    if (N.host) N.host.tick();
    if (N.client) N.client.tick();
  };
  const hookWorld = GP.hookWorld;
  GP.hookWorld = function (world) {
    hookWorld.call(this, world);
    if (N.host && !world.remote) N.host.attachWorld(world);
    const fx = world.fx;
    if (!fx) return;
    const send = (item) => { const h = N.host; if (h && h.game.world === world) h.fx(item); };
    const sound = fx.sound, particles = fx.particles, explosion = fx.explosion, blockBroken = fx.blockBroken;
    fx.sound = (n, x, y, z, v, p) => { if (x !== null && x !== undefined && isFinite(x)) send({ k: 's', n, p: [F2(x), F2(y), F2(z)], v: F2(v || 1), pi: F2(p || 1) }); return sound(n, x, y, z, v, p); };
    fx.particles = (t, x, y, z, n, s) => { if (n <= 30 && isFinite(x)) send({ k: 'p', n: t, p: [F2(x), F2(y), F2(z)], c: n, sp: F2(s || 0) }); return particles(t, x, y, z, n, s); };
    fx.explosion = (x, y, z, power) => { send({ k: 'x', p: [F2(x), F2(y), F2(z)], w: power }); return explosion(x, y, z, power); };
    fx.blockBroken = (x, y, z, id, meta) => {
      const h = N.host, mb = h && h.muteBreak;
      send({ k: 'b', p: [x + 0.5, y + 0.5, z + 0.5], id, m: meta, by: mb && mb[1] === x && mb[2] === y && mb[3] === z ? mb[0] : null });
      return blockBroken(x, y, z, id, meta);
    };
  };
  const saveWorld = GP.saveWorld;
  GP.saveWorld = function () {
    if (N.client || (this.world && this.world.remote)) { if (N.client) N.client.sendSave(); return Promise.resolve(); }
    return saveWorld.apply(this, arguments);
  };
  const quitToTitle = GP.quitToTitle;
  GP.quitToTitle = async function () {
    if (N.client) { const c = N.client; c.leave(); N.client = null; }
    if (N.host) { await this.saveWorld(); N.host.stop(); N.host = null; }
    return quitToTitle.apply(this, arguments);
  };
  const travel = GP.travel;
  GP.travel = function (dim, arrival) {
    if (N.client || (this.world && this.world.remote)) {
      const now = performance.now();
      if (now - (this._mpTravelMsg || 0) > 8000) { this._mpTravelMsg = now; this.chatMessage('§eIn multiplayer, the host takes everyone through portals.'); }
      return;
    }
    if (N.host) for (const c of N.host.conns) if (c.authed) c.send({ t: 'wait' });
    return travel.apply(this, arguments);
  };
  const arrive = GP.arrive;
  GP.arrive = function () { const r = arrive.apply(this, arguments); if (N.host) N.host.dimensionChanged(); return r; };
  const respawn = GP.respawn;
  GP.respawn = function () {
    if (N.client) {
      const p = this.player;
      p.health = 20; p.deathTime = 0; p.fire = 0; p.air = 300; p.hurtTime = 0; p.hurtResist = 0;
      p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
      const host = Array.from(N.client.proxies.values()).find(e => e.type === 'player' && e.health > 0);
      const sp = (this.world.dim || 0) === 0 ? (p.spawnPoint || this.meta.spawn) : host ? [host.x, host.y, host.z] : [p.x, 100, p.z];
      p.setPos(sp[0], sp[1], sp[2]);
      this.placeSafely(p);
      this.setScreen(null);
      return;
    }
    return respawn.apply(this, arguments);
  };
  const command = GP.command;
  GP.command = function (line) {
    if (N.client) {
      const cmd = line.split(/\s+/)[0].toLowerCase();
      if (cmd === 'help') { this.chatMessage('§eYou are a guest: chat freely; commands are run by the host.'); return; }
      if (cmd === 'seed') return command.apply(this, arguments);
      this.chatMessage('§cOnly the host can use commands.');
      return;
    }
    return command.apply(this, arguments);
  };
  const chatSubmit = GP.chatSubmit;
  GP.chatSubmit = function (v) {
    if (!v.startsWith('/') && (N.client || N.host)) {
      this.chatHistory.push(v);
      const t = clean(v, 100).trim();
      if (!t) return;
      if (N.client) N.client.send({ t: 'chat', m: t });
      else N.host.chat(N.host.myId, t);
      return;
    }
    return chatSubmit.apply(this, arguments);
  };
  const shootBow = GP.shootBow;
  GP.shootBow = function () {
    if (!N.client) return shootBow.apply(this, arguments);
    const p = this.player;
    const slot = p.inv.findIndex(s => s && s.id === 262);
    if (slot < 0) return;
    if (!p.creative) { p.inv[slot].count--; if (p.inv[slot].count <= 0) p.inv[slot] = null; }
    const d = p.look();
    N.client.send({ t: 'shoot', k: 'arrow', p: [F2(p.x + Math.cos(p.yaw) * 0.16), F2(p.y + p.eye - 0.1), F2(p.z - Math.sin(p.yaw) * 0.16)], d: d.map(F2), s: 1.5 });
    A.play('bow', p.x, p.y, p.z, 1, 1 / (Math.random() * 0.4 + 0.8));
    p.damageHeld(1); p.swing(); In.haptic('bow');
  };
  const throwItem = GP.throwItem;
  GP.throwItem = function () {
    if (!N.client) return throwItem.apply(this, arguments);
    const p = this.player;
    const kind = p.held.id === 344 ? 'egg' : 'snowball';
    const d = p.look();
    N.client.send({ t: 'shoot', k: kind, p: [F2(p.x), F2(p.y + p.eye - 0.1), F2(p.z)], d: d.map(F2), s: 1.5 });
    A.play('bow', p.x, p.y, p.z, 0.5, 0.4 / (Math.random() * 0.4 + 0.8));
    if (!p.creative) p.consumeHeld(1);
    p.swing();
  };

  /* ------------------------------------------------------------ */
  /* Screens                                                      */
  /* ------------------------------------------------------------ */
  class InfoScreen extends G.Screen {
    constructor(game, title, text) { super(game); this.title = title; this.text = text; }
    get pauses() { return false; }
    get showWorld() { return false; }
    layout() { this.widgets = []; this.btn('Back to title screen', G.W / 2 - 100, G.H / 2 + 20, 200, 20, () => this.game.setScreen(new G.TitleScreen(this.game))); if (DL.Input.lastDevice === 'gamepad') this.focus = 0; }
    draw(mx, my) { G.textC(this.title, G.W / 2, G.H / 2 - 30, '#FFFFFF'); G.textC(this.text, G.W / 2, G.H / 2 - 12, '#A0A0A0'); this.drawWidgets(mx, my); }
    back() { this.game.setScreen(new G.TitleScreen(this.game)); }
  }
  class MultiplayerScreen extends G.Screen {
    constructor(game, parent) {
      super(game, parent);
      this.games = []; this.sel = null; this.status = 'Looking for games on your Wi-Fi...'; this.joining = false;
      this.field = { type: 'field', x: 0, y: 0, w: 60, h: 20, value: '', max: 4, placeholder: '----' };
      this.field.onEnter = () => this.join();
    }
    get pauses() { return false; }
    get showWorld() { return false; }
    open() {
      super.open();
      if (!N.supported()) { this.status = 'This browser cannot do local multiplayer'; return; }
      N.lobby().then(L => {
        if (this.closed) return;
        this.L = L;
        this.unsub = L.room.onPeers(() => this.refresh());
        this.refresh();
      });
      this.iv = setInterval(() => this.refresh(), 1000);
    }
    close() { this.closed = true; if (this.unsub) this.unsub(); clearInterval(this.iv); DL.Input.textInput.blur(); if (this.inviteD && !N.client) this.inviteD.close(); }
    refresh() {
      if (!this.L) return;
      const list = [];
      for (const p of this.L.room.peers()) {
        if (p.sameTab) continue;
        const dl = p.presence && p.presence.dl;
        if (!dl || dl.v !== PROTO || !dl.host || typeof dl.host !== 'object') continue;
        list.push({ peer: p.peer, by: p.by, world: clean(dl.host.n, 32) || 'World', players: isInt(dl.host.p, 1, 99) ? dl.host.p : 1 });
      }
      this.games = list.slice(0, 5);
      this.others = this.L.room.peers().filter(p => !p.sameTab && p.kind !== 'agent').length;
      if (this.sel && !this.games.some(g => g.peer === this.sel.peer)) this.sel = null;
      if (!this.sel) this.picked = false;
      if (!this.picked) this.sel = this.games.length === 1 ? this.games[0] : null;
      if (!this.joining) this.status = this.lobbyStatus();
      this.layout();
    }
    lobbyStatus() {
      if (this.games.length) return this.games.length > 1 && !this.sel ? 'Type the code and press Join (or tap a game first)' : 'Type the 4-digit code and press Join';
      if (this.L && this.L.kind === 'local') return 'No lobby here: open the DreamLand server address, or use an invite code';
      if (this.others) return this.others + (this.others === 1 ? ' friend is' : ' friends are') + ' here, but no game is open yet. Host: Pause > Open to Wi-Fi';
      if (this.L && this.L.kind === 'server') return 'No games yet. The host picks Pause > Open to Wi-Fi';
      return 'Nobody else is in the lobby yet. Playing a downloaded copy? Use an invite code';
    }
    canJoin() { return /^\d{4}$/.test(this.field.value) && !this.joining; }
    layout() {
      const cx = G.W / 2, y0 = 52;
      const keepFocus = this.focus;
      this.widgets = [];
      this.games.forEach((gm, i) => {
        const label = (this.sel && this.sel.peer === gm.peer ? '> ' : '') + gm.world + ' - ' + N.nameOf(gm.by) + ' (' + gm.players + ' playing)';
        this.btn(label, cx - 120, y0 + i * 24, 240, 20, () => { this.sel = gm; this.picked = true; this.status = this.lobbyStatus(); this.layout(); });
      });
      const fy = y0 + Math.max(1, this.games.length) * 24 + 16;
      this.field.x = cx - 120 + 80; this.field.y = fy;
      this.widgets.push(this.field);
      this.joinBtn = this.btn(this.joining ? 'Joining...' : 'Join', cx + 26, fy, 94, 20, () => this.join(), { enabled: this.canJoin() });
      this.btn('Join with an invite code', cx - 100, fy + 52, 200, 20, () => { this.inviteD = N.inviteJoinDialog(this.game, (t) => { this.status = t; }); });
      this.btn('Back', cx - 100, fy + 76, 200, 20, () => this.back());
      this.codeY = fy;
      if (keepFocus >= 0 && keepFocus < this.widgets.length) this.focus = keepFocus;
      else if (DL.Input.lastDevice === 'gamepad') this.focus = 0;
    }
    activateField(f) { super.activateField(f); try { DL.Input.textInput.inputMode = 'numeric'; } catch (e) { /* ignore */ } }
    deactivateField(f) { super.deactivateField(f); try { DL.Input.textInput.inputMode = 'text'; } catch (e) { /* ignore */ } }
    textInput(v) { this.field.value = v.replace(/\D/g, '').slice(0, 4); if (this.joinBtn) this.joinBtn.enabled = this.canJoin(); }
    async join() {
      if (!this.canJoin()) { if (!this.joining) this.status = 'Type the 4-digit code shown on the host\'s pause menu'; return; }
      if (!this.L) { this.status = 'Still looking for games, try again in a moment'; return; }
      const tries = this.picked && this.sel ? [this.sel] : this.games.slice();
      if (!tries.length) { this.status = this.lobbyStatus(); return; }
      DL.Input.textInput.blur();
      this.joining = true; this.layout();
      let ok = false;
      for (const gm of tries) {
        try { ok = await N.join(this.game, gm, this.field.value, (s) => { this.status = s; }); } catch (e) { console.warn('net: join error', e); this.status = 'Could not connect. Make sure you are both on the same Wi-Fi.'; ok = false; }
        if (ok || G.screen !== this) break;
      }
      this.joining = false;
      if (!ok && G.screen === this) this.layout();
    }
    draw(mx, my) {
      const cx = G.W / 2;
      G.textC('Play with friends on the same Wi-Fi', cx, 16, '#FFFFFF');
      DL.Font.wrap(this.status, Math.min(G.W - 16, 300)).slice(0, 2).forEach((ln, i) => G.textC(ln, cx, 27 + i * 10, '#A0A0A0'));
      G.text('Join code', cx - 120, this.codeY + 6, '#A0A0A0');
      this.drawWidgets(mx, my);
      DL.Font.wrap('The host opens their world from the pause menu (Open to Wi-Fi). Both of you must be on the same Wi-Fi.', Math.min(G.W - 16, 300)).forEach((ln, i) => G.textC(ln, cx, this.codeY + 26 + i * 10, '#808080'));
    }
  }
  N.MultiplayerScreen = MultiplayerScreen;

  // title: enable Multiplayer
  const tLayout = G.TitleScreen.prototype.layout;
  G.TitleScreen.prototype.layout = function () {
    tLayout.call(this);
    const b = this.widgets.find(w => w.label === 'Multiplayer');
    if (b) { b.enabled = true; b.onClick = () => this.game.setScreen(new MultiplayerScreen(this.game, this)); }
  };
  // pause: open to Wi-Fi / show code / disconnect
  const pLayout = G.PauseScreen.prototype.layout;
  G.PauseScreen.prototype.layout = function () {
    pLayout.call(this);
    const cx = G.W / 2, y = G.H / 4 + 8;
    const quit = this.widgets.find(w => w.label === 'Save and quit to title');
    if (quit) { quit.y = y + 108; if (N.client) quit.label = 'Disconnect'; }
    let label, enabled = true, onClick = null;
    if (N.client) { label = 'Playing on ' + clean(this.game.meta.name, 20); enabled = false; }
    else if (N.host) { label = 'Code ' + N.host.code + ' (' + (N.host.conns.size + 1) + ' on)'; enabled = false; }
    else { label = 'Open to Wi-Fi'; onClick = async () => { await N.openToLan(this.game); this.layout(); }; }
    if (N.client) { this.btn(label, cx - 100, y + 80, 200, 20, onClick, { enabled }); return; }
    this.btn(label, cx - 100, y + 80, 98, 20, onClick, { enabled });
    this.btn('Invite by code', cx + 2, y + 80, 98, 20, () => N.inviteHostDialog(this.game, () => { if (G.screen === this) this.layout(); }));
  };

  /* Name tags above other players */
  const extras = G.drawHUDExtras;
  G.drawHUDExtras = function (game, Wd, H, hy) {
    const r = game.renderer, w = game.world;
    if (N.active() && w && r && r.proj && game.inGame && !game.hideGui) {
      const cam = r.cam, M4 = DL.M4, m = M4.create();
      M4.multiply(m, r.proj, r.view);
      for (const e of w.entities) {
        if (e === game.player || e.type !== 'player' || e.removed) continue;
        const x = e.x - cam.x, y = e.y + 2.15 - (e.sneaking ? 0.2 : 0) - cam.y, z = e.z - cam.z;
        const d = Math.hypot(x, y, z);
        if (d > 48) continue;
        const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
        if (cw <= 0.1) continue;
        const sx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw, sy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
        if (Math.abs(sx) > 1.1 || Math.abs(sy) > 1.1) continue;
        const name = N.nameOf(e.isRemote ? e.conn.by : e.by);
        const px = (sx * 0.5 + 0.5) * Wd, py = (0.5 - sy * 0.5) * H;
        const tw = DL.Font ? DL.Font.width(name) : name.length * 6;
        G.rect(px - tw / 2 - 2, py - 1, tw + 4, 10, 'rgba(0,0,0,0.35)');
        G.textC(name, px, py, e.sneaking ? '#BBBBBB' : '#FFFFFF');
      }
    }
    return extras.call(this, game, Wd, H, hy);
  };
})();
