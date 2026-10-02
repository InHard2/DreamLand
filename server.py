#!/usr/bin/env python3
"""
DreamLand LAN server - only needs Python 3.7+ (no packages).

    python server.py          (or double-click "Start DreamLand Server.bat" on Windows)

It serves the game to every device on your Wi-Fi and runs the multiplayer
lobby: open the address it prints on each computer, the host picks
Pause > Open to Wi-Fi, everyone else picks Multiplayer and types the code.
Game traffic is relayed through this server, so firewalls and hidden local
addresses no longer get in the way. The server only passes messages along;
the host still checks the join code and every action.
"""
import asyncio, base64, hashlib, json, mimetypes, os, socket, struct, sys
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('PORT') or (sys.argv[1] if len(sys.argv) > 1 else 8080))
MAX_PEERS, MAX_MSG, MAX_PRESENCE = 16, 1 << 20, 8192
MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
        '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.svg': 'image/svg+xml'}

peers = {}  # id -> Peer
next_id = [1]


def lan_addresses():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    try:  # the address used to reach the network (no packets are sent)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    ips = [ip for ip in ips if not ip.startswith('127.')]
    return sorted(ips, key=lambda ip: (not ip.startswith('192.168.'), not ip.startswith('10.'), ip))


def frame(op, payload):
    n = len(payload)
    if n < 126:
        head = struct.pack('!BB', 0x80 | op, n)
    elif n < 65536:
        head = struct.pack('!BBH', 0x80 | op, 126, n)
    else:
        head = struct.pack('!BBQ', 0x80 | op, 127, n)
    return head + payload


class Peer:
    def __init__(self, pid, writer):
        self.id, self.writer, self.presence = pid, writer, {}

    def send_text(self, obj):
        self._write(frame(1, json.dumps(obj, separators=(',', ':')).encode()))

    def send_bin(self, data):
        self._write(frame(2, data))

    def _write(self, data):
        if not self.writer.is_closing():
            self.writer.write(data)


peers_task = [None]


def broadcast_peers():
    async def later():
        await asyncio.sleep(0.03)
        lst = [{'peer': 'p%d' % p.id, 'presence': p.presence} for p in peers.values()]
        for p in list(peers.values()):
            p.send_text({'t': 'peers', 'you': 'p%d' % p.id, 'list': lst})
    if peers_task[0] and not peers_task[0].done():
        peers_task[0].cancel()
    peers_task[0] = asyncio.ensure_future(later())


def on_message(pr, op, data):
    if op == 2:
        if len(data) < 5 or data[0] != 1:
            return
        to = peers.get(struct.unpack('!I', data[1:5])[0])
        if to and to is not pr:
            to.send_bin(b'\x01' + struct.pack('!I', pr.id) + data[5:])
        return
    try:
        m = json.loads(data.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return
    if not isinstance(m, dict):
        return
    if m.get('t') == 'presence':
        p = m.get('p') or {}
        if isinstance(p, dict) and len(json.dumps(p)) <= MAX_PRESENCE:
            pr.presence = p
            broadcast_peers()
    elif m.get('t') == 'to' and isinstance(m.get('to'), str):
        try:
            to = peers.get(int(m['to'][1:]))
        except ValueError:
            return
        if to and to is not pr:
            to.send_text({'t': 'from', 'from': 'p%d' % pr.id, 'd': m.get('d')})


async def websocket(reader, writer, key):
    if len(peers) >= MAX_PEERS:
        writer.close()
        return
    accept = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
    writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n' % accept).encode())
    pr = Peer(next_id[0], writer)
    next_id[0] += 1
    peers[pr.id] = pr
    pr.send_text({'t': 'hello', 'you': 'p%d' % pr.id})
    broadcast_peers()
    parts, part_op = [], 0
    try:
        while True:
            h = await asyncio.wait_for(reader.readexactly(2), 60)
            fin, op, masked, n = h[0] & 0x80, h[0] & 15, h[1] & 0x80, h[1] & 127
            if n == 126:
                n = struct.unpack('!H', await reader.readexactly(2))[0]
            elif n == 127:
                n = struct.unpack('!Q', await reader.readexactly(8))[0]
            if n > MAX_MSG or not masked:
                break
            mask = await reader.readexactly(4)
            raw = await reader.readexactly(n)
            data = (int.from_bytes(raw, 'big') ^ int.from_bytes((mask * (n // 4 + 1))[:n], 'big')).to_bytes(n, 'big') if n else b''
            if op == 8:
                writer.write(frame(8, b''))
                break
            if op == 9:
                writer.write(frame(10, data))
                continue
            if op == 10:
                continue
            if op == 0:
                parts.append(data)
                if fin:
                    whole, parts = b''.join(parts), []
                    if len(whole) <= MAX_MSG:
                        on_message(pr, part_op, whole)
                continue
            if not fin:
                part_op, parts = op, [data]
                continue
            on_message(pr, op, data)
            await writer.drain()
    except (asyncio.IncompleteReadError, asyncio.TimeoutError, ConnectionError, OSError):
        pass
    finally:
        peers.pop(pr.id, None)
        for q in list(peers.values()):
            q.send_text({'t': 'gone', 'peer': 'p%d' % pr.id})
        broadcast_peers()
        writer.close()


async def handle(reader, writer):
    try:
        head = await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'), 15)
    except (asyncio.IncompleteReadError, asyncio.LimitOverrunError, asyncio.TimeoutError, ConnectionError):
        writer.close()
        return
    lines = head.decode('latin-1').split('\r\n')
    try:
        method, target, _ = lines[0].split(' ', 2)
    except ValueError:
        writer.close()
        return
    hdr = {}
    for line in lines[1:]:
        if ':' in line:
            k, v = line.split(':', 1)
            hdr[k.strip().lower()] = v.strip()
    path = unquote(urlsplit(target).path)
    if path == '/dl-ws' and hdr.get('upgrade', '').lower() == 'websocket' and hdr.get('sec-websocket-key'):
        await websocket(reader, writer, hdr['sec-websocket-key'])
        return

    def reply(code, body, ctype='text/plain'):
        writer.write(('HTTP/1.1 %d %s\r\nContent-Type: %s\r\nContent-Length: %d\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n'
                      % (code, 'OK' if code == 200 else 'Not Found', ctype, len(body))).encode() + (body if method != 'HEAD' else b''))

    if path == '/dl-lan.json':
        reply(200, json.dumps({'dreamland': True, 'v': 1, 'port': PORT, 'ips': lan_addresses(), 'players': len(peers)}).encode(), 'application/json')
    else:
        if path.endswith('/'):
            path += 'index.html'
        file = os.path.normpath(os.path.join(ROOT, path.lstrip('/')))
        rel = os.path.relpath(file, ROOT)
        bad = not file.startswith(ROOT + os.sep) or any(part.startswith('.') for part in rel.split(os.sep)) or rel.endswith(('server.js', 'server.py', '.bat', '.sh'))
        if bad or not os.path.isfile(file):
            reply(404, b'Not found')
        else:
            with open(file, 'rb') as f:
                body = f.read()
            ext = os.path.splitext(file)[1].lower()
            reply(200, body, MIME.get(ext) or mimetypes.guess_type(file)[0] or 'application/octet-stream')
    try:
        await writer.drain()
    except ConnectionError:
        pass
    writer.close()


async def keepalive():
    while True:
        await asyncio.sleep(20)
        for p in list(peers.values()):
            p._write(frame(9, b''))


async def main():
    try:
        server = await asyncio.start_server(handle, '0.0.0.0', PORT, limit=1 << 16)
    except OSError:
        print('Port %d is busy. Close the other server or run:  python server.py 8081' % PORT)
        return
    print('\n  DreamLand LAN server is running!\n')
    print('  On this computer:      http://localhost:%d' % PORT)
    for ip in lan_addresses():
        print('  On other devices:      http://%s:%d' % (ip, PORT))
    print('\n  If Windows asks, allow access on Private (and Public) networks.')
    print('  Keep this window open while you play. Press Ctrl+C to stop.\n')
    asyncio.ensure_future(keepalive())
    if not os.environ.get('NO_BROWSER') and sys.platform in ('win32', 'darwin'):  # open the game on this computer
        import webbrowser
        webbrowser.open('http://localhost:%d' % PORT)
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
