#!/usr/bin/env node
/**
 * chat-worker.mjs — Your connected AI chat workers.
 *
 * This is the "chaturile de AI ca muncitori" layer, done the SAFE way:
 * every one of your accounts is reached through its OFFICIAL API (not by
 * automating the web interface, which risks account bans). Each worker is a
 * real API call to one of your own API keys.
 *
 * Workers available (those with a key in .env are active):
 *   - gemini     (GEMINI_API_KEY)        Google Gemini
 *   - openai     (OPENAI_API_KEY)        ChatGPT / OpenAI
 *   - anthropic  (ANTHROPIC_API_KEY)     Claude  (add key in .env to enable)
 *   - xai        (XAI_API_KEY)           Grok
 *   - deepseek   (DEEPSEEK_API_KEY)      DeepSeek
 *   - cerebras   (CEREBRAS_API_KEY)      Cerebras (fast open-weight models)
 *   - openrouter (OPENROUTER_API_KEY)    OpenRouter (hundreds of models)
 *
 * Usage:
 *   node chat-worker.mjs "Your prompt here"            # asks all active workers
 *   node chat-worker.mjs --worker gemini "prompt"       # asks one worker
 *   node chat-worker.mjs --list                         # show which workers are ready
 *
 * It reads .env automatically (no setup). Output is printed per-worker.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO_ROOT = process.cwd();

function loadEnv() {
  const env = { ...process.env };
  const f = path.join(REPO_ROOT, '.env');
  try {
    const txt = fs.readFileSync(f, 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && env[m[1]] === undefined) {
        env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {}
  return env;
}

const ENV = loadEnv();

// Worker definitions: which key, API base, default model, and call style.
const WORKERS = {
  gemini: {
    label: 'Google Gemini',
    key: ENV.GEMINI_API_KEY,
    model: ENV.GEMINI_MODEL || 'gemini-3.6-flash',
    kind: 'gemini',
    base: ENV.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  },
  openai: {
    label: 'OpenAI ChatGPT',
    key: ENV.OPENAI_API_KEY,
    model: ENV.OPENAI_MODEL || 'gpt-5',
    kind: 'openai',
    base: ENV.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  },
  anthropic: {
    label: 'Anthropic Claude',
    key: ENV.ANTHROPIC_API_KEY,
    model: ENV.ANTHROPIC_MODEL || 'claude-opus-4',
    kind: 'anthropic',
    base: ENV.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
  },
  xai: {
    label: 'xAI Grok',
    key: ENV.XAI_API_KEY,
    model: ENV.XAI_MODEL || 'grok-4.6',
    kind: 'openai',
    base: ENV.XAI_BASE_URL || 'https://api.x.ai/v1',
  },
  deepseek: {
    label: 'DeepSeek',
    key: ENV.DEEPSEEK_API_KEY,
    model: ENV.DEEPSEEK_MODEL || 'deepseek-chat',
    kind: 'openai',
    base: ENV.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  },
  cerebras: {
    label: 'Cerebras',
    key: ENV.CEREBRAS_API_KEY,
    model: ENV.CEREBRAS_MODEL || 'gpt-oss-120b',
    kind: 'openai',
    base: ENV.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
  },
  openrouter: {
    label: 'OpenRouter',
    key: ENV.OPENROUTER_API_KEY,
    model: ENV.OPENROUTER_MODEL || 'anthropic/claude-opus-4',
    kind: 'openai',
    base: ENV.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  },
};

function activeWorkers() {
  return Object.entries(WORKERS).filter(([, w]) => w.key && w.key.length > 8);
}

function postJson(url, headers, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal })
    .finally(() => clearTimeout(t))
    .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, body: j })));
}

async function askWorker(name, w, prompt) {
  if (!w.key || w.key.length <= 8) return { name, label: w.label, error: 'no API key (add it to .env)' };
  try {
    if (w.kind === 'openai') {
      const res = await postJson(`${w.base}/chat/completions`, {
        'content-type': 'application/json',
        authorization: `Bearer ${w.key}`,
      }, {
        model: w.model,
        max_completion_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });
      if (!res.ok) return { name, label: w.label, error: `${res.status} ${JSON.stringify(res.body).slice(0, 200)}` };
      const txt = res.body?.choices?.[0]?.message?.content ?? '(empty)';
      return { name, label: w.label, text: txt };
    }
    if (w.kind === 'anthropic') {
      const res = await postJson(`${w.base}/messages`, {
        'content-type': 'application/json',
        'x-api-key': w.key,
        'anthropic-version': '2023-06-01',
      }, {
        model: w.model,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });
      if (!res.ok) return { name, label: w.label, error: `${res.status} ${JSON.stringify(res.body).slice(0, 200)}` };
      const txt = (res.body?.content || []).map((c) => c.text || '').join('');
      return { name, label: w.label, text: txt || '(empty)' };
    }
    if (w.kind === 'gemini') {
      const url = `${w.base}/models/${encodeURIComponent(w.model)}:generateContent?key=${w.key}`;
      const res = await postJson(url, { 'content-type': 'application/json' }, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1500 },
      });
      if (!res.ok) return { name, label: w.label, error: `${res.status} ${JSON.stringify(res.body).slice(0, 200)}` };
      const txt = res.body?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '(empty)';
      return { name, label: w.label, text: txt };
    }
  } catch (e) {
    return { name, label: w.label, error: String(e?.message || e) };
  }
  return { name, label: w.label, error: 'unknown worker kind' };
}

async function main() {
  const args = process.argv.slice(2);
  const listMode = args.includes('--list');
  const wIdx = args.indexOf('--worker');
  const workerName = wIdx >= 0 ? args[wIdx + 1] : null;
  const prompt = args.filter((a) => !a.startsWith('--') && a !== workerName).join(' ').trim();

  if (listMode) {
    console.log('Connected AI workers (those with a key are ACTIVE):\n');
    for (const [n, w] of Object.entries(WORKERS)) {
      const on = w.key && w.key.length > 8;
      console.log(`  [${on ? 'ON ' : 'off'}] ${n.padEnd(11)} ${w.label}  (model: ${w.model})`);
    }
    console.log(`\nActive: ${activeWorkers().length}/${Object.keys(WORKERS).length}`);
    return;
  }

  if (!prompt) {
    console.log('Usage:');
    console.log('  node chat-worker.mjs "prompt"              # ask all active workers');
    console.log('  node chat-worker.mjs --worker gemini "p"   # ask one');
    console.log('  node chat-worker.mjs --list                # show connected workers');
    process.exit(1);
  }

  let targets = activeWorkers();
  if (workerName) {
    const w = WORKERS[workerName];
    if (!w) { console.error(`Unknown worker "${workerName}". Run --list.`); process.exit(1); }
    targets = [[workerName, w]];
  }

  console.log(`\n=== Sending to ${targets.length} connected worker(s) ===\n`);
  const results = await Promise.all(targets.map(([n, w]) => askWorker(n, w, prompt)));
  for (const r of results) {
    console.log(`\n──────── ${r.label} (${r.name}) ────────`);
    if (r.error) console.log(`  ⚠ ${r.error}`);
    else console.log('  ' + (r.text || '').replace(/\n/g, '\n  '));
  }
  console.log('\n=== done ===');
}

main().catch((e) => { console.error(e); process.exit(1); });
