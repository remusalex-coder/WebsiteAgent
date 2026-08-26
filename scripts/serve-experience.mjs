/**
 * A static file server for looking at a built experience.
 *
 *   node scripts/serve-experience.mjs [runId] [port]
 *
 * A file:// URL would technically open the page, but it makes the WebGL
 * context, font loading and image decoding behave differently to how a visitor
 * would see them — so review happens over http, like the real thing.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = process.argv[2] ?? '25e648c7';
// PORT wins when a launcher assigns one dynamically; the positional arg is
// for a human running this by hand.
const port = Number(process.env.PORT ?? process.argv[3] ?? 4321);
// `experience/` is the hand-built demo folder; `site/` is what the pipeline
// renders. A factory run only ever produces the latter, so serve whichever the
// run actually has rather than 404ing on every generated site.
const candidates = ['experience', 'site'].map((dir) => path.join(ROOT, 'output', runId, dir));
const base = candidates.find((dir) => fs.existsSync(dir)) ?? candidates[0];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(base, rel);

  if (!file.startsWith(base)) { res.writeHead(403).end('no'); return; }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`serving ${path.relative(ROOT, base)} on http://localhost:${port}`);
});
