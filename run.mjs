#!/usr/bin/env node
// Runs today's team on brief.md through an OpenAI-compatible API (default: OpenRouter free
// models) and writes days/<date>/team.md plus any HTML artifacts.
//
// Usage: node run.mjs [--artifacts N] [--brief "text"] [--date YYYY-MM-DD] [--out dir] [--force] [--dry-run]
// Env:   OPENROUTER_API_KEY  required unless --dry-run
//        MODEL               comma-separated models, tried in order (default: openrouter/free)
//        API_URL             chat completions endpoint (default: OpenRouter)
//        ARTIFACTS           default for --artifacts (default: 1)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const MODELS = (process.env.MODEL || 'openrouter/free').split(',').map((m) => m.trim()).filter(Boolean);
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
  + "img-src data: blob:; media-src data: blob:; font-src data:";

function die(msg, code = 2) {
  console.error(`run.mjs: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { artifacts: process.env.ARTIFACTS ?? '1', out: join(HERE, 'days'), force: false, dryRun: false };
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

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// prompt.md sections, keyed by heading.
function sections() {
  const out = {};
  for (const part of readFileSync(join(HERE, 'prompt.md'), 'utf8').split(/^## /m).slice(1)) {
    const nl = part.indexOf('\n');
    out[part.slice(0, nl).trim()] = part.slice(nl + 1).trim();
  }
  return out;
}

export function extractHtml(text) {
  const fenced = text.match(/```html[^\n]*\n([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.search(/<!doctype html|<html/i);
  const end = text.toLowerCase().lastIndexOf('</html>');
  return start >= 0 && end > start ? text.slice(start, end + 7).trim() : null;
}

// Blocks all network requests from the artifact.
export function addCsp(html) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}\n${meta}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${meta}</head>`);
  return `${meta}\n${html}`;
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

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const date = opts.date || today();
  const briefPath = join(HERE, 'brief.md');
  const brief = (opts.brief ?? (existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : '')).trim();
  if (!brief) die('no brief: write one in brief.md or pass --brief');

  let team;
  try {
    team = execFileSync('sh', [join(HERE, 'team.sh'), date], { encoding: 'utf8' }).trim();
  } catch (e) {
    die(e.stderr?.trim() || e.message);
  }

  const dir = join(opts.out, date);
  const planFile = join(dir, 'team.md');
  if (!opts.dryRun && existsSync(planFile) && !opts.force) {
    console.log(`${planFile} exists, skipping (use --force to replace)`);
    return;
  }

  const s = sections();
  const system = { role: 'system', content: `Writing rules:\n\n${s['Writing rules']}` };
  const context = `<team>\n${team}\n</team>\n\n<brief>\n${brief}\n</brief>`;
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

  const plan = await complete(planMessages, 3000).catch((e) => die(e.message, 1));
  console.log(`plan: ${plan.model}`);
  mkdirSync(dir, { recursive: true });

  const results = [];
  for (let n = 1; n <= opts.artifacts; n++) {
    const file = `artifact-${n}.html`;
    try {
      const out = await complete(buildMessages(plan.text, n), 16000);
      const html = extractHtml(out.text);
      if (!html) throw new Error(`${out.model} returned no HTML`);
      writeFileSync(join(dir, file), `${addCsp(html)}\n`);
      results.push(`- [${file}](${file}), led by member ${n}, model ${out.model}`);
      console.log(`${file}: ${out.model}`);
    } catch (e) {
      results.push(`- ${file}: failed (${e.message})`);
      console.error(`${file}: ${e.message}`);
    }
  }

  const doc = [
    `# ${date}`, '', '```text', team, '```', '', `Brief: ${brief}`, '', `Model: ${plan.model}`, '',
    plan.text.trim(), '',
    ...(results.length ? ['## Artifacts', '', ...results, ''] : []),
  ].join('\n');
  writeFileSync(planFile, doc);
  console.log(`wrote ${planFile}`);
  if (results.some((r) => r.includes(': failed'))) process.exit(3);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
