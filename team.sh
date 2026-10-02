#!/bin/sh
# Prints the creative team for a date. Same date, same team, on any machine.
# Usage: sh team.sh [YYYY-MM-DD]   (default: today, local time)
#
# Each pool is split in two halves. A half is used for a block of days, then the other
# half, and is reshuffled each time it comes back. So no item repeats within
# (pool size / 2 / items per day) + 1 days: 7 for roles and methods, 22 for constraints.
set -eu

day_arg=${1:-$(date +%Y-%m-%d)}
case $day_arg in
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
  *) echo "team.sh: date must be YYYY-MM-DD, got: $day_arg" >&2; exit 2 ;;
esac

exec "${AWK:-awk}" -v date="$day_arg" '
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
# Fills out[1..k] with the items of pool for day.
function pick(pool, k, pid, out,   N, h, s, b, base, i, j, t, a) {
  N = n[pool]; h = N / 2; s = h / k
  if (N == 0 || s != int(s)) fail("pool " pool " size " N " must be a multiple of " 2 * k)
  b = int(day / s); base = (b % 2) * h
  for (i = 1; i <= h; i++) a[i] = item[pool, base + i]
  seed = (b * 7919 + pid * 104729 + 12345) % 2147483647
  if (seed == 0) seed = 1
  for (i = 0; i < 5; i++) rnd()
  for (i = h; i > 1; i--) { j = rnd() % i + 1; t = a[i]; a[i] = a[j]; a[j] = t }
  for (i = 1; i <= k; i++) out[i] = a[(day % s) * k + i]
}
BEGIN {
  split(date, p, "-"); y = p[1] + 0; m = p[2] + 0; d = p[3] + 0
  if (y < 1970 || m < 1 || m > 12 || d < 1 || d > dim(y, m)) fail("invalid date " date)
  day = days(y, m, d)
}
/^#@ / { pool = $2; next }
pool != "" && NF { n[pool]++; item[pool, n[pool]] = $0 }
END {
  if (bad) exit 2
  pick("roles", 4, 1, role); pick("methods", 4, 2, method)
  pick("stances", 4, 3, stance); pick("constraints", 1, 4, rule)
  print "Team for " date
  print ""
  for (i = 1; i <= 4; i++) {
    print i ". " role[i]
    print "   Method: " method[i]
    print "   Stance: " stance[i]
  }
  print ""
  print "Constraint: " rule[1]
}
' "$0"

# Pools. One item per line. Each pool size must be a multiple of twice the items drawn per day.

#@ roles
Typographer
Illustrator
Photographer
Film editor
Sound designer
Composer
Copywriter
Book editor
Interaction designer
Motion designer
Product designer
Service designer
Information designer
Cartographer
Architect
Landscape architect
Industrial designer
Furniture maker
Set designer
Lighting designer
Costume designer
Game designer
Puppeteer
Choreographer
Playwright
Stand-up comedian
Radio producer
Documentary director
Animator
Comic artist
Printmaker
Ceramicist
Textile designer
Bookbinder
Sign painter
Exhibition designer
Museum curator
Front-end engineer
Creative coder
Data journalist
Brand strategist
Packaging designer
Chef
Perfumer
Window dresser
Urban planner
Teacher
Librarian

#@ methods
Make ten rough versions before choosing one.
Start from the final result and work backwards.
Cut the first draft by half.
Test on paper before building anything.
Copy a structure from an unrelated field.
Work at actual size only.
Use one grid for every part.
Write the announcement before the work exists.
Watch three people use the current version first.
Build the smallest version that works end to end.
Remove one element per pass until it breaks, then restore the last one.
Sketch with a thick marker so small detail is impossible.
Give each idea 20 minutes, then move on.
Explain it aloud to someone outside the field.
Map every step the user takes, then remove steps.
Pick the one number that matters and design around it.
Design the error and empty states first.
List the assumptions in the brief and check each one.
Make it work in black and white before adding color.
Prototype in the final material.
Take the conventions of a genre and break exactly one.
Storyboard every change of state.
Write the copy before the layout.
Scope the work to what fits in one day.
Use found material only.
Show it to someone at 10 percent done.
Repeat one motif with variation.
Design for the slowest device and connection first.
Count words, clicks, and seconds, then reduce each.
Find what the audience already does and build on it.
Interview someone who dislikes the category.
Collect references, then put them away and work from memory.
Make the ending first.
Try it ten times larger and ten times smaller.
Invert the default and see what still works.
Write down what it must never do.
Structure it in three acts.
Reduce it to one sentence before making anything.
Build a kit of parts, then assemble.
Design for one sense alone.
Use real content only, no placeholders.
Test it in the place where it will be used.
Set one rule, follow it strictly, and note where it fails.
Rework only the weakest part.
Time-box to one hour and keep the result.
Replace every adjective in the brief with a measurable target.
Name the audience as one specific person.
Remove the feature everyone assumes is required.

#@ stances
Cuts scope.
Adds one bold element.
Speaks for the user.
Checks cost and time.
Questions the brief.
Pushes for a less expected result.
Guards execution quality.
Plans how it reaches people.

#@ constraints
One typeface, two weights.
Black and white only.
Must work on a 320 px wide screen.
No images.
Under 100 words of copy.
One day of work.
Must work offline.
Only assets you already have.
Three colors at most.
Usable with one hand.
No animation.
Readable from 3 metres.
Explainable in one sentence.
Built for people over 70.
Built for a 10-year-old.
Works without sound or color.
One screen only.
Costs nothing to run.
Made from one photograph.
Uses a single shape.
Under 50 KB in total.
Delivered in 24 hours.
Must work printed on A4.
Must work in a noisy room.
No words.
Lowercase only.
Uses only data the user already has.
Three-column grid only.
Must survive a photocopier.
No screens: physical or printed only.
Loads in under one second.
Learnable in 30 seconds.
Works in three languages.
Sound is the main output.
System fonts only.
The user can do exactly one thing.
Pen and paper first, no software.
Repairable by the user.
Still makes sense in 10 years.
Works at night.
No buttons.
Fits on a postcard.
