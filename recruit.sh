#!/bin/sh
# Drafts next week's season with your Claude login and opens a pull request for review.
# Usage: sh recruit.sh [recruit.mjs options, for example --provider openrouter]
set -eu
cd "$(dirname "$0")"

git switch --quiet main
git pull --ff-only --quiet
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=$(gh repo view --json nameWithOwner -q .nameWithOwner) \
  node github.mjs suggestions > "$tmp/suggestions.json"
PROVIDER=${PROVIDER:-claude} node recruit.mjs --suggestions "$tmp/suggestions.json" "$@" | tee "$tmp/out.txt"
start=$(sed -n 's/^season //p' "$tmp/out.txt")
node --test test.mjs > "$tmp/test.txt" || { cat "$tmp/test.txt"; git checkout -- pools; git clean -fq pools; exit 1; }

branch="recruit/$start"
git switch --quiet -C "$branch"
git add pools
git commit --quiet -m "Season $start: new members and tasks"
git push --quiet --force -u origin "$branch"
node recruit.mjs --summary "pools/$start.json" > "$tmp/body.md"
if gh pr view "$branch" --json number >/dev/null 2>&1; then
  gh pr edit "$branch" --body-file "$tmp/body.md"
else
  gh pr create --base main --head "$branch" --title "Season $start" --body-file "$tmp/body.md"
fi
git switch --quiet main
