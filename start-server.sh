#!/bin/sh
# DreamLand LAN server for macOS / Linux: ./start-server.sh
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then exec node server.js "$@"; fi
if command -v python3 >/dev/null 2>&1; then exec python3 server.py "$@"; fi
echo "DreamLand needs Node.js or Python 3 to run its LAN server (https://nodejs.org or https://www.python.org)."
