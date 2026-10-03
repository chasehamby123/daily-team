#!/bin/sh
# Prints the creative team for a date. Same date, same team, on any machine.
# Usage: sh team.sh [YYYY-MM-DD]   (default: today, local time)
#
# Pools live in pools/<start-date>.txt, one file per season. A date uses the latest season that
# started on or before it (the first season for earlier dates), so a new season never changes
# a past team.
#
# Pool lines: "+ " marks an item new this season; " | @name" credits the person who suggested
# a task.
#
# Each pool is split in two halves. A half is used for a block of days, then the other half,
# and is reshuffled each time it comes back. So within a season no item repeats within
# (pool size / 2 / items per day) + 1 days: 7 for roles and methods, 22 for constraints,
# 61 for tasks.
set -eu

day_arg=${1:-$(date +%Y-%m-%d)}
case $day_arg in
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
  *) echo "team.sh: date must be YYYY-MM-DD, got: $day_arg" >&2; exit 2 ;;
esac

dir=$(cd "$(dirname "$0")" && pwd)
target=$(echo "$day_arg" | tr -d -)
season=
for f in "$dir"/pools/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].txt; do
  [ -e "$f" ] || continue
  start=$(basename "$f" .txt | tr -d -)
  if [ -z "$season" ] || [ "$start" -le "$target" ]; then season=$f; fi
done
[ -n "$season" ] || { echo "team.sh: no pools in $dir/pools" >&2; exit 2; }

exec "${AWK:-awk}" -v date="$day_arg" -v season="$(basename "$season" .txt)" '
function fail(msg) { print "team.sh: " msg | "cat 1>&2"; bad = 1; exit 2 }
function leap(y) { return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 }
function dim(y, m) { return m == 2 ? 28 + leap(y) : (m == 4 || m == 6 || m == 9 || m == 11) ? 30 : 31 }
# Days since 1970-01-01 (proleptic Gregorian).
function days(y, m, d,   era, yoe, doy) {
  y -= (m <= 2); era = int(y / 400); yoe = y - era * 400
  doy = int((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1
  return era * 146097 + yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy - 719468
}
# Park-Miller generator. Integer math below 2^53, so every awk gives the same sequence.
function rnd() { seed = (seed * 16807) % 2147483647; return seed }
# Fills out[1..k] with indexes into the pool for day.
function pick(pool, k, pid, out,   N, h, s, b, base, i, j, t, a) {
  N = n[pool]; h = N / 2; s = h / k
  if (N == 0 || s != int(s)) fail("pool " pool " size " N " must be a multiple of " 2 * k)
  b = int(day / s); base = (b % 2) * h
  for (i = 1; i <= h; i++) a[i] = base + i
  seed = (b * 7919 + pid * 104729 + 12345) % 2147483647
  if (seed == 0) seed = 1
  for (i = 0; i < 5; i++) rnd()
  for (i = h; i > 1; i--) { j = rnd() % i + 1; t = a[i]; a[i] = a[j]; a[j] = t }
  for (i = 1; i <= k; i++) out[i] = a[(day % s) * k + i]
}
function show(pool, i) { return item[pool, i] (isnew[pool, i] ? " [new]" : "") }
BEGIN {
  split(date, p, "-"); y = p[1] + 0; m = p[2] + 0; d = p[3] + 0
  if (y < 1970 || m < 1 || m > 12 || d < 1 || d > dim(y, m)) fail("invalid date " date)
  day = days(y, m, d)
}
/^#@ / { pool = $2; next }
pool != "" && NF {
  line = $0; fresh = 0; who = ""
  if (substr(line, 1, 2) == "+ ") { fresh = 1; line = substr(line, 3) }
  if ((c = index(line, " | @")) > 0) { who = substr(line, c + 3); line = substr(line, 1, c - 1) }
  n[pool]++; item[pool, n[pool]] = line; isnew[pool, n[pool]] = fresh; credit[pool, n[pool]] = who
}
END {
  if (bad) exit 2
  pick("roles", 4, 1, role); pick("methods", 4, 2, method)
  pick("stances", 4, 3, stance); pick("constraints", 1, 4, rule); pick("tasks", 1, 5, task)
  print "Team for " date
  print "Season: " season
  print ""
  for (i = 1; i <= 4; i++) {
    print i ". " show("roles", role[i])
    print "   Method: " show("methods", method[i])
    print "   Stance: " item["stances", stance[i]]
  }
  print ""
  print "Constraint: " item["constraints", rule[1]]
  print "Task: " item["tasks", task[1]]
  if (credit["tasks", task[1]] != "") print "Suggested by: " credit["tasks", task[1]]
}
' "$season"
