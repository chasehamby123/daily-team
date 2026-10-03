// node --test test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addCsp, checkArtifact, decisionLine, extractHtml, findBanned } from './run.mjs';
import { archive, buildSite, dayReadme, loadDays, publish, recentBlock, teamSvg, todayBlock } from './publish.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEAM = join(HERE, 'team.sh');
const RUN = join(HERE, 'run.mjs');

// sha256 of the output for the 60 days from 2026-01-01. Same on every machine and awk.
const GOLDEN = '574fee66eb3768e67a714ae8d59e78df95ef3f5304747a34534e838278d721a9';

const team = (date, env = {}) => spawnSync('sh', [TEAM, date], { encoding: 'utf8', env: { ...process.env, ...env } });
const tmp = () => mkdtempSync(join(tmpdir(), 'daily-team-'));

function dates(start, count) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < count; i++, d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

function parse(text) {
  const members = [...text.matchAll(/^\d\. (.+)\n {3}Method: (.+)\n {3}Stance: (.+)$/gm)]
    .map(([, role, method, stance]) => ({ role, method, stance }));
  return { members, constraint: text.match(/^Constraint: (.+)$/m)?.[1], task: text.match(/^Task: (.+)$/m)?.[1] };
}

// team.sh

const awks = ['awk', 'gawk', 'mawk'].filter((a) => spawnSync('sh', ['-c', `command -v ${a}`]).status === 0);
for (const awk of awks) {
  test(`team.sh output matches the golden hash with ${awk}`, () => {
    const all = dates('2026-01-01', 60).map((d) => team(d, { AWK: awk }).stdout).join('');
    assert.equal(createHash('sha256').update(all).digest('hex'), GOLDEN);
  });
}

test('team.sh rejects invalid dates', () => {
  for (const bad of ['2026-02-29', '2026-13-01', '1969-12-31', 'today', '2026-1-1']) {
    assert.equal(team(bad).status, 2, bad);
  }
  assert.equal(team('2028-02-29').status, 0);
});

test('teams follow the no-repeat rules and never repeat as a whole', () => {
  const last = { role: {}, method: {}, constraint: {}, task: {} };
  const minGap = { role: Infinity, method: Infinity, constraint: Infinity, task: Infinity };
  const seen = new Set();
  dates('2026-01-01', 1000).forEach((date, day) => {
    const { members, constraint, task } = parse(team(date).stdout);
    assert.equal(members.length, 4, date);
    assert.ok(constraint && task, date);
    for (const key of ['role', 'method', 'stance']) {
      assert.equal(new Set(members.map((m) => m[key])).size, 4, `${date}: duplicate ${key}`);
    }
    const items = [...members.map((m) => ['role', m.role]), ...members.map((m) => ['method', m.method]),
      ['constraint', constraint], ['task', task]];
    for (const [kind, value] of items) {
      if (value in last[kind]) minGap[kind] = Math.min(minGap[kind], day - last[kind][value]);
      last[kind][value] = day;
    }
    const signature = `${members.map((m) => `${m.role}|${m.method}|${m.stance}`).join('/')}/${constraint}/${task}`;
    assert.ok(!seen.has(signature), `${date}: repeated team`);
    seen.add(signature);
  });
  assert.ok(minGap.role >= 7, `role gap ${minGap.role}`);
  assert.ok(minGap.method >= 7, `method gap ${minGap.method}`);
  assert.ok(minGap.constraint >= 22, `constraint gap ${minGap.constraint}`);
  assert.ok(minGap.task >= 61, `task gap ${minGap.task}`);
});

// Repository hygiene

test('text follows the writing rules', () => {
  const prompt = readFileSync(join(HERE, 'prompt.md'), 'utf8');
  const listLine = prompt.split('\n').find((l) => l.startsWith('- Do not use these words:'));
  for (const file of ['README.md', 'SKILL.md', 'prompt.md', 'SECURITY.md', 'team.sh']) {
    const text = readFileSync(join(HERE, file), 'utf8')
      .replace(/<!-- (TODAY|RECENT):START -->[\s\S]*?<!-- \1:END -->/g, '') // generated, checked when made
      .split('\n').filter((l) => l !== listLine).join('\n');
    assert.deepEqual(findBanned(text), [], file);
    assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, `${file}: emoji`);
    if (file.endsWith('.md')) assert.doesNotMatch(text, /[a-z]!(\s|$)/i, `${file}: exclamation mark`);
  }
});

test('no tracked file contains an API key or token', () => {
  const files = spawnSync('git', ['ls-files'], { cwd: HERE, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const key = /sk-or-v1-[0-9a-f]{20,}|sk-ant-[\w-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_\w{20,}|AKIA[0-9A-Z]{16}/;
  for (const f of files) {
    if (!existsSync(join(HERE, f)) || f.endsWith('.png')) continue;
    assert.doesNotMatch(readFileSync(join(HERE, f), 'utf8'), key, f);
  }
  const ignored = spawnSync('git', ['check-ignore', '.env', 'brief.md'], { cwd: HERE, encoding: 'utf8' }).stdout;
  assert.match(ignored, /\.env/);
  assert.match(ignored, /brief\.md/);
});

// run.mjs helpers

const GOOD = '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Tip</title></head><body>ok</body></html>';

test('extractHtml takes a fenced block or a bare document', () => {
  assert.equal(extractHtml('Here:\n```html\n<p>x</p>\n```\n'), '<p>x</p>');
  assert.equal(extractHtml('x <!DOCTYPE html><html><body>y</body></html> z'), '<!DOCTYPE html><html><body>y</body></html>');
  assert.equal(extractHtml('no markup here'), null);
});

test('checkArtifact passes a clean file and names each problem', () => {
  assert.deepEqual(checkArtifact(GOOD), []);
  const p = (html) => checkArtifact(html).join('; ');
  assert.match(p('<html><body>x</body></html>'), /no title element.*no viewport/);
  assert.match(p(GOOD.replace('</head>', '<script src="https://cdn.example/x.js"></script></head>')), /external resource/);
  assert.match(p(GOOD.replace('</head>', '<style>@import url(//fonts.example/a.css);</style></head>')), /external resource/);
  assert.match(p(GOOD.replace('ok', '<script>fetch("/x")</script>')), /network calls/);
  assert.match(p(GOOD.replace('ok', 'A seamless tool')), /"seamless"/);
  assert.match(p(GOOD.replace('ok', 'x'.repeat(110_000))), /100 KB/);
  assert.deepEqual(checkArtifact(GOOD.replace('ok', '<a href="https://example.com">source</a>')), []);
});

test('addCsp blocks network requests', () => {
  assert.match(addCsp('<html><head><title>t</title></head></html>'), /<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'/);
  assert.match(addCsp('<p>x</p>'), /^<meta http-equiv="Content-Security-Policy"/);
});

test('decisionLine takes the first sentence after the Decision heading', () => {
  assert.equal(decisionLine('## Proposals\nx\n\n## Decision\nA **tip** splitter with rounding. It answers 2.\n\n## Next steps\n1. y'),
    'A tip splitter with rounding.');
  assert.equal(decisionLine('**Decision:**\n![img](http://x) One page. More.\n'), 'One page.');
  assert.equal(decisionLine('no heading'), '');
});

// run.mjs end to end against a fake API

async function withServer(replies, fn) {
  const calls = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      calls.push(JSON.parse(body));
      const [status, content] = replies.shift() ?? [500, null];
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status === 200
        ? { model: JSON.parse(body).model, choices: [{ message: { content } }] }
        : { error: { message: 'fake error' } }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}/v1/chat/completions`, calls);
  } finally {
    server.close();
  }
}

function run(args, env) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [RUN, ...args], { env: { ...process.env, RETRY_MS: '0', PROVIDER: '', ...env } });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (c) => { stdout += c; });
    p.stderr.on('data', (c) => { stderr += c; });
    p.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

const readDay = (out, date) => JSON.parse(readFileSync(join(out, date, 'day.json'), 'utf8'));
const BAD = '```html\n<html><body>no title</body></html>\n```';
const GOOD_REPLY = `\`\`\`html\n${GOOD}\n\`\`\``;

test('run.mjs --dry-run uses the daily task when there is no brief', async () => {
  const r = await run(['--dry-run', '--date', '2026-10-03'], { OPENROUTER_API_KEY: '' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Task: Running pace calculator/);
  assert.doesNotMatch(r.stdout, /<brief>/);
  assert.match(r.stdout, /Member 1 leads/);
  const custom = await run(['--dry-run', '--date', '2026-10-03', '--brief', 'A clock'], { OPENROUTER_API_KEY: '' });
  assert.match(custom.stdout, /<brief>\\nA clock/);
});

test('run.mjs refuses to run without a key, with an empty brief, or with bad options', async () => {
  const out = tmp();
  assert.equal((await run(['--out', out], { OPENROUTER_API_KEY: '' })).status, 2);
  assert.equal((await run(['--out', out, '--brief', ' '], { OPENROUTER_API_KEY: 'k' })).status, 2);
  assert.equal((await run(['--artifacts', '9'], { OPENROUTER_API_KEY: 'k' })).status, 2);
  assert.equal((await run(['--provider', 'other'], { OPENROUTER_API_KEY: 'k' })).status, 2);
  const wrong = await run(['--out', out], { OPENROUTER_API_KEY: ' not-a-key-1234', API_URL: '' });
  assert.equal(wrong.status, 2);
  assert.match(wrong.stderr, /does not look like an OpenRouter key/);
  assert.doesNotMatch(wrong.stderr, /not-a-key-1234/, 'never print the key');
  rmSync(out, { recursive: true });
});

test('run.mjs falls back, retries failed checks, records status, and skips a recorded day', async () => {
  const out = tmp();
  const replies = [
    [429, null], [429, null], [200, '## Decision\nA pace table. Done.'], // plan: model a rate-limited, b answers
    [200, BAD], [200, GOOD_REPLY], // artifact 1: fails the check, then passes on retry
    [200, BAD], [200, BAD], // artifact 2: fails twice, saved as needs review
    [200, 'no file'], [200, 'still no file'], // artifact 3: no HTML at all
  ];
  await withServer(replies, async (url, calls) => {
    const env = { OPENROUTER_API_KEY: 'k', API_URL: url, MODEL: 'a/one:free, b/two:free' };
    const r = await run(['--date', '2026-10-03', '--out', out, '--artifacts', '3'], env);
    assert.equal(r.status, 3, r.stderr);
    assert.deepEqual(calls.slice(0, 3).map((c) => c.model), ['a/one:free', 'a/one:free', 'b/two:free']);
    assert.match(calls[4].messages.at(-1).content, /Fix these problems[\s\S]*no title element/);

    const day = readDay(out, '2026-10-03');
    assert.match(day.task, /^Running pace calculator/);
    assert.equal(day.provider, 'openrouter');
    assert.equal(day.decision, 'A pace table.');
    assert.match(day.plan, /## Decision/);
    assert.equal(day.status, 'needs review');
    assert.deepEqual(day.artifacts.map((a) => a.status), ['ok', 'needs review', 'failed']);
    assert.match(readFileSync(join(out, '2026-10-03', 'artifact-1.html'), 'utf8'), /Content-Security-Policy/);

    const again = await run(['--date', '2026-10-03', '--out', out], env);
    assert.equal(again.status, 0);
    assert.match(again.stdout, /already recorded/);

    writeFileSync(join(out, '2026-10-03', 'artifact-1.png'), 'old screenshot');
    replies.push([200, '## Decision\nA new table.']);
    const forced = await run(['--date', '2026-10-03', '--out', out, '--artifacts', '0', '--force'], env);
    assert.equal(forced.status, 0, forced.stderr);
    for (const f of ['artifact-1.png', 'artifact-1.html', 'artifact-2.html']) {
      assert.ok(!existsSync(join(out, '2026-10-03', f)), `${f} should be removed by --force`);
    }
  });
  rmSync(out, { recursive: true });
});

test('run.mjs records a failed day and runs it again next time', async () => {
  const out = tmp();
  await withServer([], async (url) => {
    const r = await run(['--date', '2026-10-04', '--out', out], { OPENROUTER_API_KEY: 'k', API_URL: url, MODEL: 'a' });
    assert.equal(r.status, 1);
    const day = readDay(out, '2026-10-04');
    assert.equal(day.status, 'failed');
    assert.match(day.error, /all models failed/);
    assert.match(day.team, /Team for 2026-10-04/);
  });
  await withServer([[200, '## Decision\nA table.']], async (url) => {
    const r = await run(['--date', '2026-10-04', '--out', out, '--artifacts', '0'], { OPENROUTER_API_KEY: ' k ', API_URL: url, MODEL: 'a' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readDay(out, '2026-10-04').status, 'ok');
  });
  rmSync(out, { recursive: true });
});

// A stand-in for the claude CLI: logs its arguments, folder, and environment, then answers
// from a queue.
function fakeClaude(dir, replies) {
  const bin = join(dir, 'claude');
  writeFileSync(join(dir, 'replies.json'), JSON.stringify(replies));
  writeFileSync(bin, `#!${process.execPath}
const fs = require('fs');
const dir = ${JSON.stringify(dir)};
let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  fs.appendFileSync(dir + '/log.jsonl', JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(),
    noClaudeMd: process.env.CLAUDE_CODE_DISABLE_CLAUDE_MDS, input }) + '\\n');
  const replies = JSON.parse(fs.readFileSync(dir + '/replies.json', 'utf8'));
  const next = replies.shift();
  fs.writeFileSync(dir + '/replies.json', JSON.stringify(replies));
  process.stdout.write(JSON.stringify({ type: 'result', is_error: !next, result: next || 'no reply',
    modelUsage: { 'claude-test-model': {} } }));
});
`);
  chmodSync(bin, 0o755);
  return bin;
}

test('run.mjs --provider claude calls the CLI with no tools, settings, or CLAUDE.md', async () => {
  const dir = tmp();
  const out = join(dir, 'days');
  const bin = fakeClaude(dir, ['## Decision\nA pace table.', GOOD_REPLY]);
  const r = await run(['--provider', 'claude', '--date', '2026-10-03', '--out', out],
    { CLAUDE_BIN: bin, OPENROUTER_API_KEY: '', CLAUDE_MODEL: 'opus' });
  assert.equal(r.status, 0, r.stderr);
  const calls = readFileSync(join(dir, 'log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(calls.length, 2);
  for (const c of calls) {
    const arg = (name) => c.args[c.args.indexOf(name) + 1];
    assert.equal(arg('--tools'), '');
    assert.equal(arg('--setting-sources'), 'project');
    assert.equal(arg('--model'), 'opus');
    assert.ok(c.args.includes('--strict-mcp-config') && c.args.includes('--no-session-persistence'));
    assert.ok(!c.args.includes('--bare'), '--bare ignores subscription logins');
    assert.match(arg('--system-prompt'), /Writing rules/);
    assert.equal(c.noClaudeMd, '1');
    assert.ok(!c.cwd.startsWith(HERE), 'runs outside the repository');
  }
  assert.match(calls[0].input, /Task: Running pace calculator/);
  const day = readDay(out, '2026-10-03');
  assert.equal(day.provider, 'claude');
  assert.equal(day.model, 'claude-test-model');
  assert.equal(day.artifacts[0].status, 'ok');
  rmSync(dir, { recursive: true });
});

test('run.mjs --provider claude rejects a malformed token without printing it', async () => {
  const r = await run(['--provider', 'claude', '--out', tmp()], { CLAUDE_CODE_OAUTH_TOKEN: ' secret-value-xyz ' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /does not look like a token from claude setup-token.*length 16/);
  assert.doesNotMatch(r.stderr, /secret-value-xyz/);
});

test('run.mjs --provider claude records a failed day when the CLI errors', async () => {
  const dir = tmp();
  const out = join(dir, 'days');
  const bin = fakeClaude(dir, []);
  const r = await run(['--provider', 'claude', '--date', '2026-10-03', '--out', out], { CLAUDE_BIN: bin });
  assert.equal(r.status, 1);
  assert.equal(readDay(out, '2026-10-03').status, 'failed');
  rmSync(dir, { recursive: true });
});

// publish.mjs

function fakeDay(daysDir, date, artifacts, extra = {}) {
  mkdirSync(join(daysDir, date), { recursive: true });
  for (const a of artifacts) if (a.status !== 'failed') writeFileSync(join(daysDir, date, a.file), a.html ?? GOOD);
  writeFileSync(join(daysDir, date, 'day.json'), JSON.stringify({
    date, task: 'Tip splitter: total and people give the amount each.', brief: null,
    team: teamFor(date), provider: 'openrouter', model: 'm', status: 'ok', error: null,
    decision: 'A tip splitter.', plan: '## Decision\nA tip splitter.', planProblems: [],
    artifacts: artifacts.map(({ html, ...a }) => ({ model: 'm', problems: [], ...a })), ...extra,
  }));
}
const teamFor = (date) => team(date).stdout.trim();

function fakeRepo() {
  const root = tmp();
  writeFileSync(join(root, 'README.md'), 'top\n<!-- TODAY:START -->\nold\n<!-- TODAY:END -->\nmid\n<!-- RECENT:START -->\nold\n<!-- RECENT:END -->\nbottom\n');
  return { root, days: join(root, 'days') };
}

test('publish writes the day pages, team cards, archive, and README blocks', () => {
  const { root, days } = fakeRepo();
  fakeDay(days, '2026-10-01', [{ file: 'artifact-1.html', lead: 1, status: 'ok' }]);
  fakeDay(days, '2026-10-02', [{ file: 'artifact-1.html', lead: 2, status: 'needs review', problems: ['no title element'] }]);
  writeFileSync(join(days, '2026-10-02', 'artifact-1.png'), Buffer.alloc(100));
  fakeDay(days, '2026-10-03', [], { status: 'failed', error: 'all models failed', plan: '', decision: '', model: null });

  assert.equal(publish(root, { pagesUrl: 'https://x.github.io/daily-team/' }), 3);

  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.match(readme, /^top\n<!-- TODAY:START -->\n### 2026-10-03: Tip splitter/);
  assert.match(readme, /No asset today\. all models failed/);
  assert.match(readme, /<img src="days\/2026-10-03\/team\.svg"/);
  assert.match(readme, /mid\n<!-- RECENT:START -->\n\| Date \| Asset \| Task \| Team \|/);
  assert.ok(readme.indexOf('[2026-10-03]') < readme.indexOf('[2026-10-01]'), 'newest first');
  assert.match(readme, /<img src="days\/2026-10-02\/artifact-1\.png" alt="Tip splitter" width="160">/);
  assert.match(readme, /\[All 3 days\]\(ARCHIVE\.md\)/);
  assert.match(readme, /<!-- RECENT:END -->\nbottom\n$/);
  assert.doesNotMatch(readme, /\nold\n/);

  const arch = readFileSync(join(root, 'ARCHIVE.md'), 'utf8');
  assert.match(arch, /3 days recorded/);
  assert.match(arch, /\| \[2026-10-02\]\(days\/2026-10-02\/\) \| Tip splitter \| .+ · .+ \| .+ \| \[asset, needs review\]/);
  assert.match(arch, /\| \[2026-10-03\]\(days\/2026-10-03\/\) .* \| no asset \|/);

  const page = readFileSync(join(days, '2026-10-02', 'README.md'), 'utf8');
  assert.match(page, /^# 2026-10-02: Tip splitter/);
  assert.match(page, /<img src="team\.svg"/);
  assert.match(page, /<img src="artifact-1\.png"/);
  assert.match(page, /\[Use it\]\(https:\/\/x\.github\.io\/daily-team\/2026-10-02\/\)/);
  assert.match(page, /Needs review: no title element/);
  assert.match(page, /## Team plan\n\n### Decision/);
  assert.match(readFileSync(join(days, '2026-10-03', 'README.md'), 'utf8'), /No asset\. The team could not run: all models failed/);
  assert.ok(existsSync(join(days, '2026-10-01', 'team.svg')));
  rmSync(root, { recursive: true });
});

test('the team card is valid SVG with the team, task, and an escaped title', () => {
  const day = { date: '2026-10-03', task: 'Bill <splitter> & co: x', brief: null, team: teamFor('2026-10-03') };
  const svg = teamSvg(day);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1200" height="630"/);
  assert.match(svg, /Bill &lt;splitter&gt; &amp; co/);
  for (const m of ['Service designer', 'Product designer', 'Interaction designer', 'Choreographer']) assert.match(svg, new RegExp(m));
  assert.match(svg, /Constraint: Has a dark mode/);
  assert.doesNotMatch(svg.replace(/&(amp|lt|gt|quot);/g, ''), /&/);
  assert.match(svg, /prefers-color-scheme: dark/);
});

test('publish shows today\'s team before the first run', () => {
  const block = todayBlock(undefined, '/nonexistent', '');
  assert.match(block, /first daily run adds the team card and the asset/);
  assert.match(block, /Team for \d{4}-\d{2}-\d{2}/);
  assert.match(recentBlock([]), /archive starts with the first daily run/);
  assert.match(archive([]), /0 days recorded/);
  assert.match(recentBlock([{ date: '2026-10-03', task: 'A: b', brief: null, team: teamFor('2026-10-03'), artifacts: [] }]), /\[All 1 day\]/);
  assert.equal(typeof dayReadme, 'function');
});

test('the site runs artifacts only inside a sandboxed frame and shows images', () => {
  const dir = tmp();
  const days = join(dir, 'days');
  const site = join(dir, '_site');
  const html = GOOD.replace('ok', '<script>document.title="a&b"</script>"quoted"');
  fakeDay(days, '2026-10-02', [{ file: 'artifact-1.html', lead: 1, status: 'ok', html }]);
  writeFileSync(join(days, '2026-10-02', 'team.svg'), teamSvg(loadDays(days)[0]));
  writeFileSync(join(days, '2026-10-02', 'artifact-1.png'), Buffer.alloc(9000));
  buildSite(site, loadDays(days), days, 'isas1/daily-team');
  const page = readFileSync(join(site, '2026-10-02', 'index.html'), 'utf8');
  const index = readFileSync(join(site, 'index.html'), 'utf8');
  assert.match(page, /<iframe sandbox="allow-scripts allow-modals allow-downloads allow-popups allow-forms"/);
  assert.doesNotMatch(page, /allow-same-origin/);
  assert.match(page, /srcdoc="[^"]*&lt;script&gt;document\.title=&quot;a&amp;b&quot;/);
  assert.doesNotMatch(page, /<script>/);
  assert.match(page, /img-src 'self'/);
  assert.match(page, /<img src="team\.svg"/);
  assert.match(index, /<img src="\.\/2026-10-02\/team\.svg"/);
  assert.match(index, /<img src="\.\/2026-10-02\/artifact-1\.png" alt="" loading="lazy">/);
  assert.ok(existsSync(join(site, '2026-10-02', 'team.svg')) && existsSync(join(site, '2026-10-02', 'artifact-1.png')));
  assert.ok(!existsSync(join(site, '2026-10-02', 'artifact-1.html')), 'raw artifact must not be served');
  rmSync(dir, { recursive: true });
});

// Shell scripts

test('shell scripts parse', () => {
  for (const f of ['team.sh', 'shot.sh', 'daily.sh']) assert.equal(spawnSync('sh', ['-n', join(HERE, f)]).status, 0, f);
});

const chrome = ['google-chrome', 'chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  .find((c) => spawnSync('sh', ['-c', `command -v "${c}"`]).status === 0);

test('shot.sh screenshots new artifacts', { skip: !chrome && 'Chrome not installed' }, () => {
  const dir = tmp();
  cpSync(join(HERE, 'shot.sh'), join(dir, 'shot.sh'));
  mkdirSync(join(dir, 'days', '2026-10-02'), { recursive: true });
  writeFileSync(join(dir, 'days', '2026-10-02', 'artifact-1.html'),
    GOOD.replace('ok', '<h1 style="font-size:120px">Tip splitter</h1><div style="height:300px;background:#123"></div>'));
  const r = spawnSync('sh', ['shot.sh', 'days'], { cwd: dir, encoding: 'utf8', timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  const png = join(dir, 'days', '2026-10-02', 'artifact-1.png');
  assert.ok(existsSync(png) && statSync(png).size > 8000, 'screenshot missing or blank');
  rmSync(dir, { recursive: true });
});
