/**
 * Serve a generated site so it can be opened and used in a browser.
 *
 *   npm run preview -- <runId>
 *
 * A generated site opens fine from `file://` — it needs no server and no
 * JavaScript. This exists anyway because `file://` is not how anyone will
 * actually receive the thing: relative asset paths, anchor navigation and
 * anything added later that assumes an origin all behave differently there, and
 * a preview that flatters the artifact is worse than no preview.
 *
 * Static only. No build step, no watch, no dependency — `node:http` and the
 * filesystem, so it starts instantly and cannot drift from what was rendered.
 */

import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const runId = process.argv[2];
if (runId === undefined) {
  process.stderr.write('usage: npm run preview -- <runId>\n');
  process.exit(1);
}

const ARTIFACTS_ROOT = path.resolve(process.env.ARTIFACTS_DIR ?? path.join(ROOT, 'artifacts'));

/** `render/` is the published site; `site/` is where the pipeline wrote it. */
const CANDIDATES = [
  path.join(ARTIFACTS_ROOT, runId, 'render'),
  path.join(ARTIFACTS_ROOT, runId, 'site'),
  path.join(ROOT, 'output', runId, 'site'),
];

let base = null;
for (const candidate of CANDIDATES) {
  try {
    await fs.access(path.join(candidate, 'index.html'));
    base = candidate;
    break;
  } catch { /* try the next one */ }
}

if (base === null) {
  process.stderr.write(
    `No rendered site for run "${runId}". Looked in:\n${CANDIDATES.map((c) => `  ${c}`).join('\n')}\n`,
  );
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/**
 * Resolves a request path inside `base`, or `null` if it would escape.
 *
 * The names come from a rendered site and everything upstream sanitises them.
 * This is the check that does not depend on the ones before it holding.
 */
function resolveInside(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const target = path.resolve(base, `.${decoded === '/' ? '/index.html' : decoded}`);
  const prefix = path.resolve(base) + path.sep;
  return target === path.resolve(base) || target.startsWith(prefix) ? target : null;
}

const server = http.createServer(async (req, res) => {
  const target = resolveInside(req.url ?? '/');
  if (target === null) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('forbidden');
    return;
  }

  let file = target;
  try {
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }

  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': body.length,
      // The point of a preview is to see the current bytes.
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

const port = Number(process.env.PREVIEW_PORT ?? 4321);
server.listen(port, () => {
  process.stdout.write(`\n  ${path.relative(ROOT, base).replace(/\\/g, '/')}\n`);
  process.stdout.write(`  http://localhost:${port}\n\n  Ctrl+C to stop.\n\n`);
});
