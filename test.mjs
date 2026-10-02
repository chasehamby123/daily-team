// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractHtml, addCsp } from './run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEAM = join(HERE, 'team.sh');
const RUN = join(HERE, 'run.mjs');

// sha256 of the teams for the 60 days from 2026-01-01. Same on every machine and awk.
const GOLDEN = '8fb05262127d3886e852440b345f1a12910e4b6eac244ca8d452b723a43bbe97';

const team = (date, env = {}) => spawnSync('sh', [TEAM, date], { encoding: 'utf8', env: { ...process.env, ...env } });

function dates(start, count) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < count; i++, d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

function parse(text) {
  const members = [...text.matchAll(/^\d\. (.+)\n {3}Method: (.+)\n {3}Stance: (.+)$/gm)]
    .map(([, role, method, stance]) => ({ role, method, stance }));
  return { members, constraint: text.match(/^Constraint: (.+)$/m)?.[1] };
}

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
  const last = { role: {}, method: {}, constraint: {} };
  const minGap = { role: Infinity, method: Infinity, constraint: Infinity };
  const seen = new Set();
  dates('2026-01-01', 1000).forEach((date, day) => {
    const { members, constraint } = parse(team(date).stdout);
    assert.equal(members.length, 4, date);
    assert.ok(constraint, date);
    for (const key of ['role', 'method', 'stance']) {
      assert.equal(new Set(members.map((m) => m[key])).size, 4, `${date}: duplicate ${key}`);
    }
    const items = [...members.map((m) => ['role', m.role]), ...members.map((m) => ['method', m.method]), ['constraint', constraint]];
    for (const [kind, value] of items) {
      if (value in last[kind]) minGap[kind] = Math.min(minGap[kind], day - last[kind][value]);
      last[kind][value] = day;
    }
    const signature = members.map((m) => `${m.role}|${m.method}|${m.stance}`).join('/') + constraint;
    assert.ok(!seen.has(signature), `${date}: repeated team`);
    seen.add(signature);
  });
  assert.ok(minGap.role >= 7, `role gap ${minGap.role}`);
  assert.ok(minGap.method >= 7, `method gap ${minGap.method}`);
  assert.ok(minGap.constraint >= 22, `constraint gap ${minGap.constraint}`);
});

test('text follows the writing rules', () => {
  const prompt = readFileSync(join(HERE, 'prompt.md'), 'utf8');
  const listLine = prompt.split('\n').find((l) => l.startsWith('- Do not use these words:'));
  const banned = listLine.replace(/^.*?:/, '').replace(/\.$/, '').split(',').map((w) => w.trim());
  assert.ok(banned.length >= 10);
  for (const file of ['README.md', 'SKILL.md', 'prompt.md', 'brief.md', 'team.sh']) {
    const text = readFileSync(join(HERE, file), 'utf8').split('\n').filter((l) => l !== listLine).join('\n');
    for (const word of banned) {
      assert.doesNotMatch(text, new RegExp(`\\b${word}`, 'i'), `${file}: "${word}"`);
    }
    assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, `${file}: emoji`);
    if (file.endsWith('.md')) assert.doesNotMatch(text, /[a-z]!(\s|$)/i, `${file}: exclamation mark`);
  }
});

test('extractHtml takes a fenced block or a bare document', () => {
  assert.equal(extractHtml('Here:\n```html\n<p>x</p>\n```\n'), '<p>x</p>');
  assert.equal(extractHtml('x <!DOCTYPE html><html><body>y</body></html> z'), '<!DOCTYPE html><html><body>y</body></html>');
  assert.equal(extractHtml('no markup here'), null);
});

test('addCsp blocks network requests', () => {
  assert.match(addCsp('<html><head><title>t</title></head></html>'), /<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'/);
  assert.match(addCsp('<p>x</p>'), /^<meta http-equiv="Content-Security-Policy"/);
});

// A fake chat completions API. Each call takes the next reply from the queue.
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
    const p = spawn(process.execPath, [RUN, ...args], { env: { ...process.env, RETRY_MS: '0', ...env } });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (c) => { stdout += c; });
    p.stderr.on('data', (c) => { stderr += c; });
    p.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

test('run.mjs --dry-run needs no key and includes the team and brief', async () => {
  const r = await run(['--dry-run', '--date', '2026-10-02', '--brief', 'A clock'], { OPENROUTER_API_KEY: '' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Team for 2026-10-02/);
  assert.match(r.stdout, /A clock/);
  assert.match(r.stdout, /Member 1 leads/);
});

test('run.mjs refuses to run without a key or a brief', async () => {
  const out = mkdtempSync(join(tmpdir(), 'daily-team-'));
  assert.equal((await run(['--out', out], { OPENROUTER_API_KEY: '' })).status, 2);
  assert.equal((await run(['--out', out, '--brief', ' '], { OPENROUTER_API_KEY: 'k' })).status, 2);
  assert.equal((await run(['--artifacts', '9'], { OPENROUTER_API_KEY: 'k' })).status, 2);
  rmSync(out, { recursive: true });
});

test('run.mjs writes the plan and artifacts, falls back on errors, and skips a finished day', async () => {
  const out = mkdtempSync(join(tmpdir(), 'daily-team-'));
  const html = '```html\n<!doctype html><html><head></head><body>ok</body></html>\n```';
  await withServer([[429, null], [429, null], [200, '## Decision\nShip it.'], [200, html], [200, 'no file']], async (url, calls) => {
    const env = { OPENROUTER_API_KEY: 'k', API_URL: url, MODEL: 'a/one:free, b/two:free' };
    const r = await run(['--date', '2026-10-02', '--out', out, '--artifacts', '2', '--brief', 'A clock'], env);
    assert.equal(r.status, 3, 'artifact 2 returned no HTML');
    assert.deepEqual(calls.map((c) => c.model), ['a/one:free', 'a/one:free', 'b/two:free', 'a/one:free', 'a/one:free']);

    const dir = join(out, '2026-10-02');
    const doc = readFileSync(join(dir, 'team.md'), 'utf8');
    assert.match(doc, /Team for 2026-10-02/);
    assert.match(doc, /Model: b\/two:free/);
    assert.match(doc, /Ship it\./);
    assert.match(doc, /artifact-1\.html\), led by member 1/);
    assert.match(doc, /artifact-2\.html: failed/);
    assert.match(readFileSync(join(dir, 'artifact-1.html'), 'utf8'), /Content-Security-Policy/);
    assert.ok(!existsSync(join(dir, 'artifact-2.html')));

    const again = await run(['--date', '2026-10-02', '--out', out], env);
    assert.equal(again.status, 0);
    assert.match(again.stdout, /skipping/);
  });
  rmSync(out, { recursive: true });
});
