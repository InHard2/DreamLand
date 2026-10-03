#!/bin/sh
# Update DreamLand to the latest version on GitHub: ./update.sh
# Worlds are kept (they live in the browser, not in this folder).
cd "$(dirname "$0")" || exit 1
if ! command -v git >/dev/null 2>&1; then
  echo "Updating needs Git (https://git-scm.com/downloads)."; exit 1
fi
if [ ! -d .git ]; then
  echo "First update: linking this folder to GitHub..."
  git init -q && git remote add origin https://github.com/InHard2/DreamLand.git
fi
echo "Downloading the latest DreamLand..."
git fetch --depth 1 origin main || { echo "Could not reach GitHub."; exit 1; }
git checkout -q -f -B main origin/main
git branch -q --set-upstream-to=origin/main main >/dev/null 2>&1
echo "DreamLand is up to date. Reload the game page to play the new version."
