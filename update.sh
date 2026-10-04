#!/bin/sh
# Update DreamLand to the latest version on GitHub: ./update.sh
# Worlds are kept (they live in the browser, not in this folder).
cd "$(dirname "$0")" || exit 1
if command -v git >/dev/null 2>&1; then
  if [ ! -d .git ]; then
    echo "First update: linking this folder to GitHub..."
    git init -q && git remote add origin https://github.com/InHard2/DreamLand.git
  fi
  echo "Downloading the latest DreamLand..."
  if git fetch --depth 1 origin main; then
    git checkout -q -f -B main origin/main
    git branch -q --set-upstream-to=origin/main main >/dev/null 2>&1
    echo "DreamLand is up to date. Reload the game page to play the new version."
    exit 0
  fi
fi
# no Git (or it failed): fetch the zip instead
echo "Downloading the latest DreamLand from GitHub (no Git needed)..."
tmp=$(mktemp -d) || exit 1
if curl -fsSL -o "$tmp/main.tar.gz" https://github.com/InHard2/DreamLand/archive/refs/heads/main.tar.gz && tar -xzf "$tmp/main.tar.gz" -C "$tmp"; then
  cp -R "$tmp"/*/. .
  rm -rf "$tmp"
  echo "DreamLand is up to date. Reload the game page to play the new version."
else
  rm -rf "$tmp"
  echo "Could not download the update. Check your internet connection."; exit 1
fi
