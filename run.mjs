#!/usr/bin/env node
// Runs today's team on today's task through an OpenAI-compatible API (default: OpenRouter
// free models) and writes days/<date>/: team.md, day.json, and artifact-<n>.html.
//
// Usage: node run.mjs [--artifacts N] [--brief "text"] [--date YYYY-MM-DD] [--out dir] [--force] [--dry-run]
// Env:   OPENROUTER_API_KEY  required unless --dry-run
//        MODEL               comma-separated models, tried in order (default: openrouter/free)
//        API_URL             chat completions endpoint (default: OpenRouter)
//        ARTIFACTS           default for --artifacts (default: 1)
// A brief from --brief or a brief.md file replaces today's task.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const MODELS = (process.env.MODEL || 'openrouter/free').split(',').map((m) => m.trim()).filter(Boolean);
const MAX_BYTES = 100 * 1024;
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
  + "img-src data: blob:; media-src data: blob:; font-src data:";

function die(msg, code = 2) {
  console.error(`run.mjs: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { artifacts: process.env.ARTIFACTS || '1', out: join(HERE, 'days'), force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => (i + 1 < argv.length ? argv[++i] : die(`${a} needs a value`));
    if (a === '--artifacts') opts.artifacts = value();
    else if (a === '--brief') opts.brief = value();
    else if (a === '--date') opts.date = value();
    else if (a === '--out') opts.out = value();
    else if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else die(`unknown argument ${a}`);
  }
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

async function complete(messages, maxTokens) {
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

// One call, then one more with the problems listed if the result fails its check.
async function completeChecked(messages, maxTokens, check) {
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
  const task = team.match(/^Task: (.+)$/m)[1];
  const briefPath = join(HERE, 'brief.md');
  const custom = (opts.brief ?? (existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : '')).trim();
  if (opts.brief !== undefined && !custom) die('--brief is empty');

  const dir = join(opts.out, date);
  if (!opts.dryRun && existsSync(join(dir, 'day.json')) && !opts.force) {
    console.log(`${dir} is done, skipping (use --force to replace)`);
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
    return;
  }
  if (!process.env.OPENROUTER_API_KEY) die('OPENROUTER_API_KEY is not set');

  const plan = await completeChecked(planMessages, 3000, (t) => findBanned(t).map((w) => `uses the word "${w}"`))
    .catch((e) => die(e.message, 1));
  console.log(`plan: ${plan.model}`);
  mkdirSync(dir, { recursive: true });

  const artifacts = [];
  for (let n = 1; n <= opts.artifacts; n++) {
    const file = `artifact-${n}.html`;
    try {
      const out = await completeChecked(buildMessages(plan.text, n), 16000, (t) => {
        const html = extractHtml(t);
        return html ? checkArtifact(html) : ['no HTML code block'];
      });
      const html = extractHtml(out.text);
      if (!html) throw new Error(`${out.model} returned no HTML`);
      writeFileSync(join(dir, file), `${addCsp(html)}\n`);
      artifacts.push({ file, lead: n, model: out.model, status: out.problems.length ? 'needs review' : 'ok', problems: out.problems });
      console.log(`${file}: ${out.model}${out.problems.length ? `, needs review: ${out.problems.join('; ')}` : ''}`);
    } catch (e) {
      artifacts.push({ file, lead: n, status: 'failed', problems: [e.message] });
      console.error(`${file}: ${e.message}`);
    }
  }

  const day = {
    date, task, brief: custom || null, team, model: plan.model, decision: decisionLine(plan.text),
    planProblems: plan.problems, artifacts,
  };
  const lines = artifacts.map((a) => (a.status === 'failed'
    ? `- ${a.file}: failed (${a.problems.join('; ')})`
    : `- [${a.file}](${a.file}), led by member ${a.lead}, model ${a.model}${a.problems.length ? `. Needs review: ${a.problems.join('; ')}` : ''}`));
  const doc = [
    `# ${date}`, '', '```text', team, '```', '', ...(custom ? [`Brief: ${custom}`, ''] : []), `Model: ${plan.model}`, '',
    plan.text.trim(), '', ...(lines.length ? ['## Artifacts', '', ...lines, ''] : []),
  ].join('\n');
  writeFileSync(join(dir, 'team.md'), doc);
  writeFileSync(join(dir, 'day.json'), `${JSON.stringify(day, null, 2)}\n`);
  console.log(`wrote ${dir}`);
  if (artifacts.some((a) => a.status === 'failed')) process.exit(3);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
