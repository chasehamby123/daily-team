#!/bin/sh
# Records today's team and asset with your Claude subscription, then commits and pushes.
# Usage: sh daily.sh [run.mjs options, for example --artifacts 2 or --force]
set -eu
cd "$(dirname "$0")"

git pull --ff-only --quiet
status=0
PROVIDER=${PROVIDER:-claude} node run.mjs "$@" || status=$?
sh shot.sh days || true
node publish.mjs
git add README.md ARCHIVE.md days
if git diff --cached --quiet; then
  echo "Nothing new to commit."
else
  git commit --quiet -m "Daily team $(date +%Y-%m-%d)"
  git push --quiet
  echo "Pushed $(git rev-parse --short HEAD)."
fi
exit "$status"
