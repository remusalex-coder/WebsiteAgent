#!/usr/bin/env node
/**
 * factory-console.mjs — Centrul unic de comandă pentru fabrica WebsiteAgent.
 *
 * Rezolvă problema „totul e împrăștiat prin chat-uri și tu ești mesagerul":
 * acesta este UNICUL loc de unde pornește totul.
 *
 *   - Vezi coada de comenzi (orders.json): PENDING / RUNNING / DONE / ESCALATED
 *   - Adaugi o comandă printr-un form (fără batch files, fără copiat între chaturi)
 *   - Vezi log-ul live al fabricii (factory.log)
 *   - Pornești / oprești fabrica cu un buton (cheamă run-factory.mjs)
 *
 * Rulează:  node factory-console.mjs
 * Deschide: http://localhost:4747
 *
 * Nu are dependințe noi — doar Node built-ins.
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const ORDERS = path.join(REPO, 'docs', 'orders.json');
const LOG = path.join(REPO, 'logs', 'factory.log');
const PORT = Number(process.env.BF_CONSOLE_PORT ?? 4747);

let factoryProc = null;

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS, 'utf8'));
  } catch {
    return { orders: [] };
  }
}

function writeOrders(data) {
  fs.writeFileSync(ORDERS, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function addOrder(text) {
  const d = readOrders();
  const n = d.orders.length + 1;
  const id = 'ORD-' + String(n).padStart(3, '0');
  d.orders.push({
    id,
    order: text,
    status: 'PENDING',
    maxIter: 3,
    attempts: 0,
    budgetTier: 'tier1',
    decision: null,
    finalOutput: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  writeOrders(d);
  return id;
}

function tailLog(lines = 60) {
  try {
    const content = fs.readFileSync(LOG, 'utf8');
    const all = content.split('\n');
    return all.slice(-lines).join('\n');
  } catch {
    return '(lipsă log)';
  }
}

function startFactory() {
  if (factoryProc) return { ok: false, msg: 'Fabrica rulează deja.' };
  factoryProc = spawn('node', ['run-factory.mjs'], {
    cwd: REPO,
    detached: true,
    stdio: 'ignore',
  });
  factoryProc.unref();
  return { ok: true, msg: 'Fabrica pornită.' };
}

function stopFactory() {
  if (!factoryProc) return { ok: false, msg: 'Fabrica nu rulează.' };
  try {
    process.kill(-factoryProc.pid);
  } catch {
    try { factoryProc.kill(); } catch {}
  }
  factoryProc = null;
  return { ok: true, msg: 'Fabrica oprită.' };
}

function factoryRunning() {
  return factoryProc !== null;
}

const uiHtml = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BusinessForge — Centrul Fabricii</title>
<style>
  :root{--bg:#0b0d12;--card:#151922;--line:#232a36;--txt:#e6edf3;--mut:#8b97a7;--grn:#3fb950;--red:#f85149;--yel:#d29922;--blu:#58a6ff}
  *{box-sizing:border-box}
  body{margin:0;font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--txt)}
  header{padding:18px 24px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:14px}
  header h1{font-size:18px;margin:0;font-weight:650}
  .badge{font-size:12px;padding:3px 10px;border-radius:20px;border:1px solid var(--line)}
  .on{color:var(--grn);border-color:var(--grn)}
  .off{color:var(--mut)}
  .wrap{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:18px 24px;max-width:1200px}
  @media(max-width:900px){.wrap{grid-template-columns:1fr}}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
  .card h2{margin:0 0 12px;font-size:14px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
  input[type=text]{width:100%;padding:11px 12px;border-radius:8px;border:1px solid var(--line);background:#0e1218;color:var(--txt);font-size:14px}
  button{cursor:pointer;border:1px solid var(--line);background:#1c2230;color:var(--txt);padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600}
  button:hover{border-color:var(--blu)}
  button.grn{border-color:var(--grn);color:var(--grn)}
  button.red{border-color:var(--red);color:var(--red)}
  .row{display:flex;gap:10px;margin-top:10px}
  .order{border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-bottom:8px}
  .order .top{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .order .id{font-size:12px;color:var(--mut)}
  .order .txt{margin-top:4px;font-size:14px}
  .st{font-size:11px;padding:2px 9px;border-radius:20px;font-weight:600}
  .PENDING{background:#3a2f00;color:var(--yel)}
  .RUNNING{background:#06243a;color:var(--blu)}
  .DONE{background:#062a12;color:var(--grn)}
  .ESCALATED,.FAILED{background:#3a0c0c;color:var(--red)}
  .out{font-size:12px;color:var(--mut);margin-top:6px;word-break:break-all}
  pre{background:#0e1218;border:1px solid var(--line);border-radius:8px;padding:12px;max-height:340px;overflow:auto;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#b9c4d0;white-space:pre-wrap;margin:0}
  .msg{font-size:13px;color:var(--grn);min-height:18px;margin-top:8px}
  .hint{font-size:12px;color:var(--mut);margin-top:6px}
</style>
</head>
<body>
<header>
  <h1>🏭 BusinessForge — Centrul Fabricii</h1>
  <span id="fstate" class="badge off">Fabrica: oprită</span>
  <span class="hint">Unicul loc de unde pornește totul. Niciun chat între tine și fabrică.</span>
</header>

<div class="wrap">
  <div class="card">
    <h2>1 · Comandă nouă</h2>
    <input id="cmd" type="text" placeholder="ex: Site premium pentru o brutărie artizanală din Sibiu">
    <div class="row">
      <button class="grn" onclick="addOrder()">Pune în coadă</button>
    </div>
    <div class="msg" id="msg"></div>
    <div class="row">
      <button id="btnStart" class="grn" onclick="toggleFactory()">Pornește fabrica</button>
    </div>
    <div class="hint">Fabrica procesează coada una câte una, 24/7, fără tine.</div>
  </div>

  <div class="card">
    <h2>2 · Coada de comenzi</h2>
    <div id="orders"></div>
  </div>

  <div class="card" style="grid-column:1/-1">
    <h2>3 · Log live al fabricii</h2>
    <pre id="log"></pre>
  </div>
</div>

<script>
const api = (u, opt) => fetch(u, opt).then(r => r.json());
async function refresh() {
  const s = await api('/state');
  document.getElementById('fstate').textContent = 'Fabrica: ' + (s.running ? 'pornită' : 'oprită');
  document.getElementById('fstate').className = 'badge ' + (s.running ? 'on' : 'off');
  document.getElementById('btnStart').textContent = s.running ? 'Oprește fabrica' : 'Pornește fabrica';
  const box = document.getElementById('orders');
  box.innerHTML = s.orders.map(o => \`
    <div class="order">
      <div class="top"><span class="id">\${o.id}</span><span class="st \${o.status}">\${o.status}</span></div>
      <div class="txt">\${o.order}</div>
      \${o.finalOutput ? '<div class="out">→ ' + o.finalOutput + '</div>' : ''}
      \${o.error ? '<div class="out" style="color:var(--red)">⚠ ' + o.error + '</div>' : ''}
    </div>\`).join('') || '<div class="hint">Coadă goală.</div>';
  document.getElementById('log').textContent = s.log;
}
async function addOrder() {
  const v = document.getElementById('cmd').value.trim();
  if (!v) return;
  const r = await api('/add', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({order:v})});
  document.getElementById('msg').textContent = r.ok ? ('Adăugat ' + r.id + ' în coadă.') : 'Eroare: ' + r.msg;
  document.getElementById('cmd').value = '';
  refresh();
}
async function toggleFactory() {
  const s = await api('/state');
  const r = await api(s.running ? '/stop' : '/start', {method:'POST'});
  document.getElementById('msg').textContent = r.msg;
  setTimeout(refresh, 600);
}
refresh();
setInterval(refresh, 4000);
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(uiHtml);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      running: factoryRunning(),
      orders: readOrders().orders,
      log: tailLog(60),
    }));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/add') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { order } = JSON.parse(body);
        const id = addOrder(String(order || '').trim());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, msg: 'JSON invalid' }));
      }
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/start') {
    const r = startFactory();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(r));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/stop') {
    const r = stopFactory();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(r));
    return;
  }
  res.writeHead(404);
  res.end('nu există');
});

server.listen(PORT, () => {
  console.log(`Centrul fabricii rulează pe http://localhost:${PORT}`);
});
