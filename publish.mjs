#!/usr/bin/env node
// Turns the records in days/ into pages:
//   days/<date>/team.svg    a card showing the team
//   days/<date>/README.md   the day page GitHub shows when the folder is opened
//   ARCHIVE.md              every day, newest first
//   README.md               the Today and Recent blocks
//   --site <dir>            a static site where artifacts run only in sandboxed frames
//
// Usage: node publish.mjs [--site dir] [--root dir]
// Env:   PAGES_URL          site link to show in the README
//        GITHUB_REPOSITORY  owner/repo, for links from the site back to the repo
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTeam, teamFor, today } from './run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RECENT_DAYS = 7;
const MIN_SCREENSHOT_BYTES = 8000;
const SANDBOX = 'allow-scripts allow-modals allow-downloads allow-popups allow-forms';
const SITE_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
  + "img-src 'self' data: blob:; media-src data: blob:; font-src data:";

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

export const title = (day) => (day.brief || day.task).split(':')[0].trim();
const roles = (day) => parseTeam(day.team).members.map((m) => m.role).join(' · ');
const firstAsset = (day) => day.artifacts.find((a) => a.status !== 'failed');
const png = (a) => a.file.replace(/\.html$/, '.png');

export function loadDays(daysDir) {
  if (!existsSync(daysDir)) return [];
  return readdirSync(daysDir)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && existsSync(join(daysDir, d, 'day.json')))
    .sort()
    .map((d) => JSON.parse(readFileSync(join(daysDir, d, 'day.json'), 'utf8')));
}

function wrap(text, max, lines) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && `${line} ${word}`.length > max) { out.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = `${out[lines - 1].replace(/[\s,.;:]*\S{0,3}$/, '')}…`;
  }
  return out;
}

// A 1200 x 630 card. The accent color moves around the color wheel day by day.
export function teamSvg(day) {
  const { members, constraint } = parseTeam(day.team);
  const hue = Math.round(((Date.parse(`${day.date}T00:00:00Z`) / 86_400_000) * 47) % 360);
  const tspans = (lines, x, y, size, gap = 1.3) => lines
    .map((l, i) => `<tspan x="${x}" y="${y + i * size * gap}">${esc(l)}</tspan>`).join('');
  const cardW = 258;
  const cards = members.map((m, i) => {
    const x = 48 + i * (cardW + 24);
    const role = wrap(m.role, 18, 2);
    const methodY = 292 + (role.length - 1) * 30;
    const stance = wrap(m.stance.replace(/\.$/, ''), 24, 2);
    const pillH = 32 + (stance.length - 1) * 20;
    return `<g>
  <rect class="card" x="${x}" y="200" width="${cardW}" height="330" rx="14"/>
  <circle cx="${x + 34}" cy="238" r="16" class="accent-fill"/>
  <text x="${x + 34}" y="244" class="num" text-anchor="middle">${i + 1}</text>
  <text class="role">${tspans(role, x + 22, 288, 24)}</text>
  <text class="method">${tspans(wrap(m.method, 26, 6), x + 22, methodY + 34, 17)}</text>
  <rect x="${x + 22}" y="${512 - pillH}" width="${cardW - 44}" height="${pillH}" rx="16" class="pill"/>
  <text class="stance" text-anchor="middle">${tspans(stance, x + cardW / 2, 512 - pillH + 21, 15)}</text>
</g>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="t">
<title id="t">Team for ${esc(day.date)}: ${esc(members.map((m) => m.role).join(', '))}. Task: ${esc(title(day))}.</title>
<style>
  .bg { fill: #f6f4ef; } .card { fill: #fff; stroke: #dedad2; } .ink { fill: #1b1b1b; }
  .accent-fill { fill: hsl(${hue} 55% 42%); } .pill { fill: hsl(${hue} 60% 92%); }
  text { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; fill: #1b1b1b; }
  .kicker { font-size: 18px; font-weight: 600; letter-spacing: 2px; fill: hsl(${hue} 55% 36%); }
  .title { font-size: 44px; font-weight: 700; } .num { font-size: 17px; font-weight: 700; fill: #fff; }
  .role { font-size: 24px; font-weight: 700; } .method { font-size: 17px; fill: #444; }
  .stance { font-size: 15px; font-weight: 600; fill: hsl(${hue} 55% 28%); } .foot { font-size: 20px; fill: #444; }
  @media (prefers-color-scheme: dark) {
    .bg { fill: #141414; } .card { fill: #1f1f1f; stroke: #333; } text { fill: #eee; }
    .method, .foot { fill: #bbb; } .pill { fill: hsl(${hue} 35% 22%); } .stance { fill: hsl(${hue} 70% 80%); }
    .kicker { fill: hsl(${hue} 70% 70%); }
  }
</style>
<rect class="bg" width="1200" height="630"/>
<text x="48" y="68" class="kicker">DAILY TEAM · ${esc(day.date)}</text>
<text class="title">${tspans(wrap(title(day), 44, 2), 48, 124, 44, 1.1)}</text>
${cards}
<text x="48" y="580" class="foot">Constraint: ${esc(wrap(constraint, 95, 1)[0])}</text>
</svg>
`;
}

function assetLines(day, base, pagesUrl) {
  if (day.status === 'failed' && !day.plan) return [`No asset. The team could not run: ${day.error}`];
  const lines = [];
  for (const a of day.artifacts) {
    const lead = parseTeam(day.team).members[a.lead - 1]?.role ?? `member ${a.lead}`;
    if (a.status === 'failed') { lines.push(`${a.file}: no asset. ${a.problems.join('; ')}`, ''); continue; }
    if (existsSync(join(base.dir, png(a)))) lines.push(`<a href="${base.href}${a.file}"><img src="${base.href}${png(a)}" alt="Screenshot of ${esc(a.file)}" width="100%"></a>`, '');
    const use = pagesUrl ? `[Use it](${pagesUrl}${day.date}/) · ` : '';
    const note = a.status === 'ok' ? '' : ` Needs review: ${a.problems.join('; ')}.`;
    lines.push(`${use}[${a.file}](${base.href}${a.file}), led by ${lead}. Model: ${a.model}.${note}`, '');
  }
  return lines.length ? lines : ['No asset was requested for this day.'];
}

export function dayReadme(day, daysDir, pagesUrl) {
  const { constraint } = parseTeam(day.team);
  const dir = join(daysDir, day.date);
  return [
    `# ${day.date}: ${title(day)}`, '',
    '[Today](../../README.md) · [Archive](../../ARCHIVE.md)', '',
    `<img src="team.svg" alt="Team for ${day.date}: ${esc(roles(day))}" width="100%">`, '',
    `**Task:** ${day.brief || day.task}`, '',
    `**Constraint:** ${constraint}`, '',
    ...(day.decision ? [`**Decision:** ${day.decision}`, ''] : []),
    '## Asset', '', ...assetLines(day, { dir, href: '' }, pagesUrl),
    ...(day.plan ? ['## Team plan', '', day.plan.replace(/^(#{1,5}) /gm, '#$1 '), ''] : []),
    '## Team', '', '```text', day.team, '```', '',
    `Provider: ${day.provider}. Model: ${day.model ?? 'none'}.`, '',
  ].join('\n');
}

export function todayBlock(day, daysDir, pagesUrl) {
  if (!day) {
    const team = teamFor(today());
    return [`### ${today()}: ${parseTeam(team).task.split(':')[0]}`, '', 'The first daily run adds the team card and the asset here.', '', '```text', team, '```'].join('\n');
  }
  const base = `days/${day.date}/`;
  const a = firstAsset(day);
  const shot = a && join(daysDir, day.date, png(a));
  const lines = [
    `### ${day.date}: ${title(day)}`, '',
    `<a href="${base}"><img src="${base}team.svg" alt="Team for ${day.date}: ${esc(roles(day))}" width="100%"></a>`, '',
    `**Task:** ${day.brief || day.task}`, '',
    ...(day.decision ? [`**Decision:** ${day.decision}`, ''] : []),
  ];
  if (shot && existsSync(shot)) {
    lines.push(`<a href="${base}"><img src="${base}${png(a)}" alt="Screenshot of today's asset" width="100%"></a>`, '');
    if (statSync(shot).size < MIN_SCREENSHOT_BYTES) lines.push('The screenshot may be blank. Open the day to check.', '');
  } else if (!a) lines.push(day.error ? `No asset today. ${day.error}` : 'No asset today.', '');
  const links = [`[Open the day](${base})`];
  if (pagesUrl && a) links.push(`[Use it](${pagesUrl}${day.date}/)`);
  links.push('[Archive](ARCHIVE.md)');
  lines.push(links.join(' · '));
  return lines.join('\n');
}

export function recentBlock(days) {
  if (!days.length) return 'The archive starts with the first daily run.';
  const rows = [...days].reverse().slice(0, RECENT_DAYS).map((d) => {
    const a = firstAsset(d);
    const thumb = a ? `<a href="days/${d.date}/"><img src="days/${d.date}/${png(a)}" alt="${esc(title(d))}" width="160"></a>` : 'No asset';
    return `| [${d.date}](days/${d.date}/) | ${thumb} | ${cell(title(d))} | ${cell(roles(d))} |`;
  });
  return ['| Date | Asset | Task | Team |', '|---|---|---|---|', ...rows, '', `[All ${plural(days.length, 'day')}](ARCHIVE.md)`].join('\n');
}

export function archive(days) {
  const rows = [...days].reverse().map((d) => {
    const a = firstAsset(d);
    const asset = a ? `[${a.status === 'ok' ? 'asset' : 'asset, needs review'}](days/${d.date}/${a.file})` : 'no asset';
    return `| [${d.date}](days/${d.date}/) | ${cell(title(d))} | ${cell(roles(d))} | ${cell(parseTeam(d.team).constraint)} | ${asset} |`;
  });
  return [
    '# Archive', '', `Every daily team and the asset it made, newest first. ${plural(days.length, 'day')} recorded.`, '',
    '[Today](README.md)', '',
    '| Date | Task | Team | Constraint | Asset |', '|---|---|---|---|---|', ...rows, '',
  ].join('\n');
}

export function replaceBlock(text, name, block) {
  const start = `<!-- ${name}:START -->`;
  const end = `<!-- ${name}:END -->`;
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a < 0 || b < a) throw new Error(`README has no ${start} ... ${end} block`);
  return `${text.slice(0, a + start.length)}\n${block}\n${text.slice(b)}`;
}

function page(heading, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${SITE_CSP}">
<title>${esc(heading)}</title>
<style>
:root { color-scheme: light dark; --fg: #1b1b1b; --bg: #f6f4ef; --muted: #666; --line: #dedad2; }
@media (prefers-color-scheme: dark) { :root { --fg: #eee; --bg: #141414; --muted: #999; --line: #333; } }
body { margin: 0 auto; max-width: 1000px; padding: 24px 16px; font: 16px/1.5 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
h1 { font-size: 1.5rem; margin: 0 0 4px; } h2 { font-size: 1.1rem; margin-top: 32px; } .muted { color: var(--muted); }
img { max-width: 100%; height: auto; } pre { white-space: pre-wrap; border: 1px solid var(--line); padding: 12px; font-size: 14px; }
iframe { width: 100%; height: 80vh; border: 1px solid var(--line); background: #fff; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; padding: 0; list-style: none; }
.grid a { color: inherit; text-decoration: none; } .grid img { border: 1px solid var(--line); display: block; }
a { color: inherit; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function grid(days, prefix) {
  return `<h2>All days</h2>\n<ul class="grid">\n${[...days].reverse().map((d) => {
    const a = firstAsset(d);
    const img = a ? `<img src="${prefix}${d.date}/${png(a)}" alt="" loading="lazy">` : `<img src="${prefix}${d.date}/team.svg" alt="" loading="lazy">`;
    return `<li><a href="${prefix}${d.date}/">${img}<strong>${d.date}</strong><br>${esc(title(d))}</a></li>`;
  }).join('\n')}\n</ul>`;
}

function dayPage(day, daysDir, repo, archiveHtml) {
  const frames = day.artifacts.filter((a) => a.status !== 'failed' && existsSync(join(daysDir, day.date, a.file))).map((a) => {
    const html = readFileSync(join(daysDir, day.date, a.file), 'utf8');
    const note = a.status === 'ok' ? '' : ` <span class="muted">(${esc(a.status)}: ${esc(a.problems.join('; '))})</span>`;
    return `<h2>${esc(a.file)}, led by member ${a.lead}${note}</h2>\n<iframe sandbox="${SANDBOX}" title="${esc(a.file)}" srcdoc="${esc(html)}"></iframe>`;
  });
  const plan = repo ? `<p><a href="https://github.com/${esc(repo)}/tree/main/days/${day.date}">Team plan and source</a></p>` : '';
  return page(`${day.date}: ${title(day)}`, [
    `<h1>${esc(title(day))}</h1>`,
    `<p class="muted">${day.date}. ${esc(day.brief || day.task)}</p>`,
    `<img src="team.svg" alt="Team for ${day.date}: ${esc(roles(day))}">`,
    day.decision ? `<p><strong>Decision:</strong> ${esc(day.decision)}</p>` : '',
    ...(frames.length ? frames : [`<p>No asset. ${esc(day.error || '')}</p>`]),
    plan, archiveHtml,
  ].join('\n'));
}

export function buildSite(siteDir, days, daysDir, repo) {
  for (const day of days) {
    const out = join(siteDir, day.date);
    mkdirSync(out, { recursive: true });
    for (const f of ['team.svg', ...day.artifacts.map(png)]) {
      if (existsSync(join(daysDir, day.date, f))) copyFileSync(join(daysDir, day.date, f), join(out, f));
    }
    writeFileSync(join(out, 'index.html'), dayPage(day, daysDir, repo, grid(days, '../')));
  }
  mkdirSync(siteDir, { recursive: true });
  const latest = days.at(-1);
  writeFileSync(join(siteDir, 'index.html'), latest
    ? dayPage(latest, daysDir, repo, grid(days, './')).replace(/src="(team\.svg|artifact-\d+\.png)"/g, `src="./${latest.date}/$1"`)
    : page('daily-team', '<p>No days yet.</p>'));
}

export function publish(root, { pagesUrl = '', site = '', repo = '' } = {}) {
  const daysDir = join(root, 'days');
  const days = loadDays(daysDir);
  for (const day of days) {
    writeFileSync(join(daysDir, day.date, 'team.svg'), teamSvg(day));
    writeFileSync(join(daysDir, day.date, 'README.md'), dayReadme(day, daysDir, pagesUrl));
  }
  writeFileSync(join(root, 'ARCHIVE.md'), archive(days));
  const readme = join(root, 'README.md');
  let text = readFileSync(readme, 'utf8');
  text = replaceBlock(text, 'TODAY', todayBlock(days.at(-1), daysDir, pagesUrl));
  text = replaceBlock(text, 'RECENT', recentBlock(days));
  writeFileSync(readme, text);
  if (site) buildSite(site, days, daysDir, repo);
  return days.length;
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : '';
  };
  const n = publish(opt('--root') || HERE, {
    pagesUrl: process.env.PAGES_URL, site: opt('--site'), repo: process.env.GITHUB_REPOSITORY,
  });
  console.log(`published ${n} days${opt('--site') ? ` and the site in ${opt('--site')}` : ''}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
