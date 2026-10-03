#!/usr/bin/env node
// Runs today's team on today's task and records the result in days/<date>/day.json, plus one
// HTML file per artifact. publish.mjs turns the records into pages.
//
// Usage: node run.mjs [--provider openrouter|claude] [--artifacts N] [--brief "text"]
//                     [--date YYYY-MM-DD] [--out dir] [--force] [--dry-run]
// Env:   PROVIDER            openrouter (default) or claude
//        OPENROUTER_API_KEY  required for openrouter
//        MODEL               openrouter models, comma-separated, tried in order
//        API_URL             chat completions endpoint (default: OpenRouter)
//        CLAUDE_MODEL        model for the claude provider (default: the CLI default)
//        CLAUDE_BIN          path to the claude CLI (default: claude)
//        ARTIFACTS           default for --artifacts (default: 1)
// A brief from --brief or a brief.md file replaces today's task.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const MODELS = (process.env.MODEL || 'openrouter/free,qwen/qwen3.8-27b:free,google/gemma-4-31b-it:free')
  .split(',').map((m) => m.trim()).filter(Boolean);
const MAX_BYTES = 100 * 1024;
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
  + "img-src data: blob:; media-src data: blob:; font-src data:";

function die(msg, code = 2) {
  console.error(`run.mjs: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = {
    provider: process.env.PROVIDER || 'openrouter', artifacts: process.env.ARTIFACTS || '1',
    out: join(HERE, 'days'), force: false, dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => (i + 1 < argv.length ? argv[++i] : die(`${a} needs a value`));
    if (a === '--provider') opts.provider = value();
    else if (a === '--artifacts') opts.artifacts = value();
    else if (a === '--brief') opts.brief = value();
    else if (a === '--date') opts.date = value();
    else if (a === '--out') opts.out = value();
    else if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else die(`unknown argument ${a}`);
  }
  if (!['openrouter', 'claude'].includes(opts.provider)) die('--provider must be openrouter or claude');
  opts.artifacts = Number(opts.artifacts);
  if (!Number.isInteger(opts.artifacts) || opts.artifacts < 0 || opts.artifacts > 4) die('--artifacts must be 0 to 4');
  return opts;
}

export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function teamFor(date) {
  return execFileSync('sh', [join(HERE, 'team.sh'), date], { encoding: 'utf8' }).trim();
}

export function parseTeam(text) {
  const members = [...text.matchAll(/^\d\. (.+)\n {3}Method: (.+)\n {3}Stance: (.+)$/gm)]
    .map(([, role, method, stance]) => ({ role, method, stance }));
  return {
    members,
    constraint: text.match(/^Constraint: (.+)$/m)?.[1] ?? '',
    task: text.match(/^Task: (.+)$/m)?.[1] ?? '',
  };
}

// prompt.md sections, keyed by heading.
export function sections() {
  const out = {};
  for (const part of readFileSync(join(HERE, 'prompt.md'), 'utf8').split(/^## /m).slice(1)) {
    const nl = part.indexOf('\n');
    out[part.slice(0, nl).trim()] = part.slice(nl + 1).trim();
  }
  return out;
}

export function bannedWords() {
  const line = sections()['Writing rules'].split('\n').find((l) => l.startsWith('- Do not use these words:'));
  return line.replace(/^.*?:/, '').replace(/\.$/, '').split(',').map((w) => w.trim()).filter(Boolean);
}

export function findBanned(text) {
  return bannedWords().filter((w) => new RegExp(`\\b${w}`, 'i').test(text));
}

export function extractHtml(text) {
  const fenced = text.match(/```html[^\n]*\n([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.search(/<!doctype html|<html/i);
  const end = text.toLowerCase().lastIndexOf('</html>');
  return start >= 0 && end > start ? text.slice(start, end + 7).trim() : null;
}

// Problems that block an artifact from being marked ready.
export function checkArtifact(html) {
  const problems = [];
  if (Buffer.byteLength(html) > MAX_BYTES) problems.push('larger than 100 KB');
  if (!/<title>[^<]*\S[^<]*<\/title>/i.test(html)) problems.push('no title element');
  if (!/<meta[^>]+name=["']?viewport/i.test(html)) problems.push('no viewport meta tag');
  if (/<(script|img|iframe|link|source|video|audio|embed|object)\b[^>]*\b(src|href)\s*=\s*["']?(https?:)?\/\//i.test(html)
    || /url\(\s*["']?(https?:)?\/\//i.test(html) || /@import/i.test(html)) problems.push('loads an external resource');
  if (/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|sendBeacon|new\s+EventSource/.test(html)) problems.push('makes network calls');
  const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  for (const w of findBanned(text)) problems.push(`uses the word "${w}"`);
  return problems;
}

// Blocks all network requests from the artifact.
export function addCsp(html) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}\n${meta}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${meta}</head>`);
  return `${meta}\n${html}`;
}

// The first sentence after the Decision heading, as plain text.
export function decisionLine(plan) {
  const m = plan.match(/^[#*\s\d.]*Decision\b[*:]*\s*\n+([\s\S]*?)(?:\n\s*\n|\n[#*\s\d.]*(?:Next steps|Proposals|Objections)\b|$)/im);
  if (!m) return '';
  const text = m[1].replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  const sentence = text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
  return sentence.length > 240 ? `${sentence.slice(0, 237)}...` : sentence;
}

async function completeOpenRouter(messages, maxTokens) {
  const errors = [];
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Title': 'daily-team',
          },
          body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
          signal: AbortSignal.timeout(300_000),
        });
        const body = await res.json().catch(() => ({}));
        const text = body.choices?.[0]?.message?.content;
        if (res.ok && text?.trim()) return { text, model: body.model || model };
        errors.push(`${model}: ${res.status} ${body.error?.message || 'empty response'}`);
        if (res.status !== 429) break;
        await new Promise((r) => setTimeout(r, Number(process.env.RETRY_MS ?? 10_000)));
      } catch (e) {
        errors.push(`${model}: ${e.message}`);
        break;
      }
    }
  }
  throw new Error(`all models failed: ${errors.join('; ')}`);
}

// Claude Code in print mode, on the user's subscription. No tools, no MCP servers, no user
// settings or hooks, no CLAUDE.md, and an empty working directory: it can only return text.
export function claudeArgs(system) {
  const args = ['-p', '--output-format', 'json', '--tools', '', '--strict-mcp-config',
    '--setting-sources', 'project', '--no-session-persistence', '--system-prompt', system];
  if (process.env.CLAUDE_MODEL) args.push('--model', process.env.CLAUDE_MODEL);
  return args;
}

function completeClaude(messages) {
  const prompt = messages.slice(1).map((m) => (m.role === 'assistant'
    ? `<your_previous_answer>\n${m.content}\n</your_previous_answer>` : m.content)).join('\n\n');
  const cwd = mkdtempSync(join(tmpdir(), 'daily-team-claude-'));
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.CLAUDE_BIN || 'claude', claudeArgs(messages[0].content), {
      cwd, env: { ...process.env, CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1' }, timeout: 900_000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', reject);
    child.on('close', (code) => {
      rmSync(cwd, { recursive: true, force: true });
      let body;
      try {
        body = JSON.parse(stdout);
      } catch {
        return reject(new Error(`claude exited ${code}: ${(stderr || stdout).trim().slice(0, 300)}`));
      }
      if (code !== 0 || body.is_error || !body.result?.trim()) {
        return reject(new Error(`claude: ${String(body.result || stderr || `exit ${code}`).slice(0, 300)}`));
      }
      const model = Object.keys(body.modelUsage || {})[0] || process.env.CLAUDE_MODEL || 'claude';
      resolve({ text: body.result, model });
    });
    child.stdin.end(prompt);
  });
}

// One call, then one more with the problems listed if the result fails its check.
async function completeChecked(complete, messages, maxTokens, check) {
  let out = await complete(messages, maxTokens);
  let problems = check(out.text);
  if (problems.length) {
    const retry = [...messages, { role: 'assistant', content: out.text },
      { role: 'user', content: `Fix these problems and return the full result again:\n- ${problems.join('\n- ')}` }];
    out = await complete(retry, maxTokens);
    problems = check(out.text);
  }
  return { ...out, problems };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const date = opts.date || today();

  let team;
  try {
    team = teamFor(date);
  } catch (e) {
    die(e.stderr?.trim() || e.message);
  }
  const { task } = parseTeam(team);
  const briefPath = join(HERE, 'brief.md');
  const custom = (opts.brief ?? (existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : '')).trim();
  if (opts.brief !== undefined && !custom) die('--brief is empty');

  const dir = join(opts.out, date);
  const record = join(dir, 'day.json');
  // A failed day can be run again; a finished one only with --force.
  if (!opts.dryRun && existsSync(record) && !opts.force
    && JSON.parse(readFileSync(record, 'utf8')).status !== 'failed') {
    console.log(`${date} is already recorded, skipping (use --force to replace)`);
    return;
  }

  const s = sections();
  const system = { role: 'system', content: `Writing rules:\n\n${s['Writing rules']}` };
  const context = `<team>\n${team}\n</team>${custom ? `\n\n<brief>\n${custom}\n</brief>` : ''}`;
  const planMessages = [system, { role: 'user', content: `${context}\n\n${s['Work the brief']}` }];
  const buildMessages = (plan, lead) => [system, {
    role: 'user',
    content: `${context}\n\n<plan>\n${plan}\n</plan>\n\n${s['Build an artifact'].replaceAll('{{LEAD}}', String(lead))}`,
  }];

  if (opts.dryRun) {
    console.log(JSON.stringify(planMessages, null, 2));
    if (opts.artifacts) console.log(JSON.stringify(buildMessages('<plan from the first call>', 1), null, 2));
    if (opts.provider === 'claude') console.log(JSON.stringify(['claude', ...claudeArgs(system.content)]));
    return;
  }
  if (opts.provider === 'openrouter') {
    const key = (process.env.OPENROUTER_API_KEY || '').trim();
    if (!key) die('OPENROUTER_API_KEY is not set');
    if (!process.env.API_URL && !key.startsWith('sk-or-')) {
      die(`OPENROUTER_API_KEY does not look like an OpenRouter key: expected it to start with "sk-or-" (length ${key.length})`);
    }
    process.env.OPENROUTER_API_KEY = key;
  }
  if (opts.provider === 'claude' && process.env.CLAUDE_CODE_OAUTH_TOKEN !== undefined) {
    const token = process.env.CLAUDE_CODE_OAUTH_TOKEN.trim();
    if (!token) delete process.env.CLAUDE_CODE_OAUTH_TOKEN; // use the local login
    else if (!token.startsWith('sk-ant-oat')) {
      die(`CLAUDE_CODE_OAUTH_TOKEN does not look like a token from claude setup-token: expected it to start with "sk-ant-oat" (length ${token.length})`);
    } else process.env.CLAUDE_CODE_OAUTH_TOKEN = token;
  }
  const complete = opts.provider === 'claude' ? completeClaude : completeOpenRouter;

  const day = {
    date, task, brief: custom || null, team, provider: opts.provider, model: null,
    status: 'ok', error: null, decision: '', plan: '', planProblems: [], artifacts: [],
  };
  // A forced run replaces the day, so old assets and screenshots must not linger.
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) if (/^artifact-\d+\.(html|png)$/.test(f)) rmSync(join(dir, f));
  }
  const save = () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(record, `${JSON.stringify(day, null, 2)}\n`);
  };

  // A failed day is still recorded, so the archive has no silent gaps.
  let plan;
  try {
    plan = await completeChecked(complete, planMessages, 3000, (t) => findBanned(t).map((w) => `uses the word "${w}"`));
  } catch (e) {
    Object.assign(day, { status: 'failed', error: e.message });
    save();
    die(`plan failed, recorded ${record}: ${e.message}`, 1);
  }
  Object.assign(day, { model: plan.model, plan: plan.text.trim(), decision: decisionLine(plan.text), planProblems: plan.problems });
  console.log(`plan: ${plan.model}`);
  mkdirSync(dir, { recursive: true });

  for (let n = 1; n <= opts.artifacts; n++) {
    const file = `artifact-${n}.html`;
    try {
      const out = await completeChecked(complete, buildMessages(plan.text, n), 16000, (t) => {
        const html = extractHtml(t);
        return html ? checkArtifact(html) : ['no HTML code block'];
      });
      const html = extractHtml(out.text);
      if (!html) throw new Error(`${out.model} returned no HTML`);
      writeFileSync(join(dir, file), `${addCsp(html)}\n`);
      day.artifacts.push({ file, lead: n, model: out.model, status: out.problems.length ? 'needs review' : 'ok', problems: out.problems });
      console.log(`${file}: ${out.model}${out.problems.length ? `, needs review: ${out.problems.join('; ')}` : ''}`);
    } catch (e) {
      day.artifacts.push({ file, lead: n, model: null, status: 'failed', problems: [e.message] });
      console.error(`${file}: ${e.message}`);
    }
  }
  if (day.artifacts.length && day.artifacts.every((a) => a.status === 'failed')) day.status = 'failed';
  else if (day.artifacts.some((a) => a.status !== 'ok')) day.status = 'needs review';
  save();
  console.log(`recorded ${record}`);
  if (day.artifacts.some((a) => a.status === 'failed')) process.exit(3);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
