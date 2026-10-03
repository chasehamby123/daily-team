#!/usr/bin/env node
// Updates the Today block in README.md from the latest finished day. With --site, also builds
// a static site where each artifact runs in a sandboxed frame, never as a top-level page.
//
// Usage: node publish.mjs [--site dir] [--days dir] [--readme file]
// Env:   PAGES_URL          site link to show in the README
//        GITHUB_REPOSITORY  owner/repo, for links from the site back to the repo
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { teamFor, today } from './run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const START = '<!-- TODAY:START -->';
const END = '<!-- TODAY:END -->';
const MIN_SCREENSHOT_BYTES = 8000;
const SANDBOX = 'allow-scripts allow-modals allow-downloads allow-popups allow-forms';
const SITE_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
  + "img-src data: blob:; media-src data: blob:; font-src data:";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function loadDays(daysDir) {
  if (!existsSync(daysDir)) return [];
  return readdirSync(daysDir)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && existsSync(join(daysDir, d, 'day.json')))
    .sort()
    .map((d) => JSON.parse(readFileSync(join(daysDir, d, 'day.json'), 'utf8')));
}

export function readmeBlock(day, daysDir, pagesUrl) {
  if (!day) {
    const team = teamFor(today());
    return [
      `### ${today()}: ${team.match(/^Task: (.+)$/m)[1]}`, '',
      'The first daily run adds the example here.', '', '```text', team, '```',
    ].join('\n');
  }
  const base = `days/${day.date}`;
  const first = day.artifacts.find((a) => a.status !== 'failed');
  const png = first && join(daysDir, day.date, first.file.replace(/\.html$/, '.png'));
  const lines = [`### ${day.date}: ${day.brief || day.task}`, ''];
  if (png && existsSync(png)) {
    lines.push(`[![Screenshot of the ${day.date} example](${base}/${first.file.replace(/\.html$/, '.png')})](${base}/${first.file})`, '');
    if (statSync(png).size < MIN_SCREENSHOT_BYTES) lines.push('The screenshot may be blank. Open the file to check.', '');
  }
  const links = [];
  if (pagesUrl && first) links.push(`[Use it](${pagesUrl}${day.date}/)`);
  if (first) links.push(`[HTML source](${base}/${first.file})`);
  links.push(`[Team plan](${base}/team.md)`, '[All days](days/)');
  lines.push(links.join(' · '), '');
  for (const a of day.artifacts) {
    if (a.status !== 'ok') lines.push(`${a.file}: ${a.status}. ${a.problems.join('; ')}.`, '');
  }
  if (day.decision) lines.push(`Decision: ${day.decision}`, '');
  lines.push('```text', day.team, '```');
  return lines.join('\n');
}

export function updateReadme(readmePath, block) {
  const text = readFileSync(readmePath, 'utf8');
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a < 0 || b < a) throw new Error(`${readmePath} has no ${START} ... ${END} block`);
  writeFileSync(readmePath, `${text.slice(0, a + START.length)}\n${block}\n${text.slice(b)}`);
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${SITE_CSP}">
<title>${esc(title)}</title>
<style>
:root { color-scheme: light dark; --fg: #1a1a1a; --bg: #fafaf8; --muted: #666; --line: #ddd; }
@media (prefers-color-scheme: dark) { :root { --fg: #eee; --bg: #161616; --muted: #999; --line: #333; } }
body { margin: 0 auto; max-width: 960px; padding: 24px 16px; font: 16px/1.5 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
h1 { font-size: 1.4rem; margin: 0 0 4px; } .muted { color: var(--muted); }
pre { white-space: pre-wrap; border: 1px solid var(--line); padding: 12px; font-size: 14px; }
iframe { width: 100%; height: 80vh; border: 1px solid var(--line); background: #fff; }
a { color: inherit; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function dayPage(day, daysDir, repo, archive) {
  const frames = day.artifacts.filter((a) => a.status !== 'failed' && existsSync(join(daysDir, day.date, a.file))).map((a) => {
    const html = readFileSync(join(daysDir, day.date, a.file), 'utf8');
    const note = a.status === 'ok' ? '' : ` <span class="muted">(${esc(a.status)}: ${esc(a.problems.join('; '))})</span>`;
    return `<h2>${esc(a.file)}, led by member ${a.lead}${note}</h2>\n<iframe sandbox="${SANDBOX}" title="${esc(a.file)}" srcdoc="${esc(html)}"></iframe>`;
  });
  const plan = repo ? `<p><a href="https://github.com/${esc(repo)}/blob/main/days/${day.date}/team.md">Team plan</a></p>` : '';
  return page(`${day.date}: ${day.brief || day.task}`, [
    `<h1>${esc(day.brief || day.task)}</h1>`,
    `<p class="muted">${day.date}${day.decision ? `. ${esc(day.decision)}` : ''}</p>`,
    ...frames, plan, `<pre>${esc(day.team)}</pre>`, archive,
  ].join('\n'));
}

export function buildSite(siteDir, days, daysDir, repo) {
  const archive = (prefix) => `<h2>All days</h2>\n<ul>\n${[...days].reverse()
    .map((d) => `<li><a href="${prefix}${d.date}/">${d.date}</a>: ${esc(d.brief || d.task)}</li>`).join('\n')}\n</ul>`;
  for (const day of days) {
    mkdirSync(join(siteDir, day.date), { recursive: true });
    writeFileSync(join(siteDir, day.date, 'index.html'), dayPage(day, daysDir, repo, archive('../')));
  }
  mkdirSync(siteDir, { recursive: true });
  const latest = days.at(-1);
  writeFileSync(join(siteDir, 'index.html'), latest
    ? dayPage(latest, daysDir, repo, archive('./'))
    : page('daily-team', '<p>No days yet.</p>'));
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const daysDir = opt('--days', join(HERE, 'days'));
  const readme = opt('--readme', join(HERE, 'README.md'));
  const site = opt('--site');
  const days = loadDays(daysDir);
  updateReadme(readme, readmeBlock(days.at(-1), daysDir, process.env.PAGES_URL));
  console.log(`updated ${readme}`);
  if (site) {
    buildSite(site, days, daysDir, process.env.GITHUB_REPOSITORY);
    console.log(`built ${site} (${days.length} days)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
