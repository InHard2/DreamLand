#!/usr/bin/env node
/*
 * DreamLand LAN server - no installs needed besides Node.js.
 *
 *   node server.js            (or double-click "Start DreamLand Server.bat" on Windows)
 *
 * It serves the game to every device on your Wi-Fi and runs the multiplayer
 * lobby: open the address it prints on each computer, the host picks
 * Pause > Open to Wi-Fi, everyone else picks Multiplayer and types the code.
 * Game traffic is relayed through this server, so firewalls and hidden
 * local addresses no longer get in the way. The server only passes messages
 * along; the host still checks the join code and every action.
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');

const ROOT = __dirname;
const PORT = +(process.env.PORT || process.argv[2] || 8080);
const MAX_PEERS = 16, MAX_MSG = 1 << 20, MAX_PRESENCE = 8192;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.md': 'text/plain'
};

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' || a.family === 4) if (!a.internal) out.push(a.address);
  // the usual home network ranges first
  return out.sort((a, b) => (/^192\.168\./.test(b) - /^192\.168\./.test(a)) || (/^10\./.test(b) - /^10\./.test(a)));
}

/* ---------------- static files ---------------- */
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end(); return; }
  if (p === '/dl-lan.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ dreamland: true, v: 1, port: PORT, ips: lanAddresses(), players: peers.size }));
    return;
  }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) || /(^|[\\/])\.|server\.(js|py)$|\.bat$|\.sh$/.test(path.relative(ROOT, file))) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

/* ---------------- WebSocket lobby + relay ---------------- */
const peers = new Map(); // id -> { id, sock, presence }
let nextId = 1, peersTimer = null;

function frame(op, payload) {
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeUInt32BE(0, 2); head.writeUInt32BE(len, 6); }
  return Buffer.concat([head, payload]);
}
const sendText = (pr, obj) => { if (!pr.sock.destroyed) pr.sock.write(frame(1, Buffer.from(JSON.stringify(obj)))); };
const sendBin = (pr, buf) => { if (!pr.sock.destroyed) pr.sock.write(frame(2, buf)); };
function broadcastPeers() {
  clearTimeout(peersTimer);
  peersTimer = setTimeout(() => {
    const list = [...peers.values()].map(p => ({ peer: 'p' + p.id, presence: p.presence }));
    for (const p of peers.values()) sendText(p, { t: 'peers', you: 'p' + p.id, list });
  }, 30);
}

function onMessage(pr, op, data) {
  if (op === 2) {
    // [1][u32 to][...] -> [1][u32 from][...]
    if (data.length < 5 || data[0] !== 1) return;
    const to = peers.get(data.readUInt32BE(1));
    if (!to || to === pr) return;
    const out = Buffer.from(data); out.writeUInt32BE(pr.id, 1);
    sendBin(to, out);
    return;
  }
  let m;
  try { m = JSON.parse(data.toString('utf8')); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  if (m.t === 'presence') {
    const s = JSON.stringify(m.p || {});
    if (s.length > MAX_PRESENCE) return;
    pr.presence = JSON.parse(s);
    broadcastPeers();
  } else if (m.t === 'to' && typeof m.to === 'string') {
    const to = peers.get(parseInt(m.to.slice(1), 10));
    if (to && to !== pr) sendText(to, { t: 'from', from: 'p' + pr.id, d: m.d });
  }
}

server.on('upgrade', (req, sock) => {
  let p;
  try { p = new URL(req.url, 'http://x').pathname; } catch (e) { p = ''; }
  const key = req.headers['sec-websocket-key'];
  if (p !== '/dl-ws' || !key || peers.size >= MAX_PEERS) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const pr = { id: nextId++, sock, presence: {}, alive: true };
  peers.set(pr.id, pr);
  sendText(pr, { t: 'hello', you: 'p' + pr.id });
  broadcastPeers();
  let buf = Buffer.alloc(0), parts = [], partOp = 0;
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80;
      let len = buf[1] & 127, o = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); o = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = buf.readUInt32BE(6); o = 10; }
      if (len > MAX_MSG || !masked) { sock.destroy(); return; }
      if (buf.length < o + 4 + len) return;
      const mask = buf.subarray(o, o + 4), data = Buffer.from(buf.subarray(o + 4, o + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(o + 4 + len);
      if (op === 8) { sock.end(frame(8, Buffer.alloc(0))); return; }
      if (op === 9) { sock.write(frame(10, data)); continue; }
      if (op === 10) { pr.alive = true; continue; }
      if (op === 0) { parts.push(data); if (fin) { const all = Buffer.concat(parts); parts = []; if (all.length <= MAX_MSG) onMessage(pr, partOp, all); } continue; }
      if (!fin) { partOp = op; parts = [data]; continue; }
      onMessage(pr, op, data);
    }
  });
  const gone = () => { if (!peers.has(pr.id)) return; peers.delete(pr.id); for (const q of peers.values()) sendText(q, { t: 'gone', peer: 'p' + pr.id }); broadcastPeers(); };
  sock.on('close', gone); sock.on('error', gone);
});
setInterval(() => { for (const p of peers.values()) { if (!p.alive) { p.sock.destroy(); continue; } p.alive = false; p.sock.write(frame(9, Buffer.alloc(0))); } }, 20000);

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error('Port ' + PORT + ' is busy. Close the other server or run:  node server.js 8081');
  else console.error(e);
  process.exit(1);
});
server.listen(PORT, '0.0.0.0', () => {
  const ips = lanAddresses();
  console.log('\n  DreamLand LAN server is running!\n');
  console.log('  On this computer:      http://localhost:' + PORT);
  for (const ip of ips) console.log('  On other devices:      http://' + ip + ':' + PORT);
  console.log('\n  If Windows asks, allow access on Private (and Public) networks.');
  console.log('  Keep this window open while you play. Press Ctrl+C to stop.\n');
  // open the game on this computer
  if (!process.env.NO_BROWSER && (process.platform === 'win32' || process.platform === 'darwin')) {
    require('child_process').exec((process.platform === 'win32' ? 'start "" ' : 'open ') + 'http://localhost:' + PORT, () => {});
  }
});
