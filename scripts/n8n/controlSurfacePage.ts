/**
 * The BusinessForge control surface (WQ-016, extending WQ-014).
 *
 * A single self-contained HTML page, served by `stage-server.ts` at `GET /`
 * and `GET /ui`, that lets a human do the whole loop the mandate asks for
 * without knowing the internal stage/capability vocabulary:
 *
 *   business URL/brief -> Start -> job id -> live stage/progress/workers/
 *   provider fallback/candidate battle/QA gate/errors -> final result.
 *
 * It reads exactly the same facts `scripts/status.ts` reads, through the
 * same wire shape `stage-server.ts`'s `GET /job`/`GET /jobs` already expose
 * (themselves built on `lib/workflow/summary.ts` — one read model, not a
 * second system of truth invented for this page). Starting a job calls the
 * real `POST /job` endpoint that already runs `runJobFull` end to end; this
 * page adds no orchestration of its own, only a view onto the real one.
 *
 * No build step, no framework, no CDN: this runs on a LAN-only host that may
 * have no outbound internet, so every byte is inline. `localStorage` here is
 * appropriate and safe — this is a real page served by BusinessForge's own
 * process to its own operator, not a sandboxed preview, so it may use normal
 * browser storage for the one per-viewer convenience worth keeping (the
 * shared token, so a human does not retype it every visit).
 */

export const CONTROL_SURFACE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BusinessForge — Control Surface</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem; max-width: 960px; margin-inline: auto;
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: Canvas; color: CanvasText;
  }
  h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
  .sub { opacity: .65; margin: 0 0 1.5rem; font-size: .9rem; }
  fieldset { border: 1px solid color-mix(in srgb, CanvasText 20%, transparent); border-radius: 10px; padding: 1rem 1.25rem; margin: 0 0 1.5rem; }
  legend { padding: 0 .4rem; font-weight: 600; }
  label { display: block; font-size: .85rem; opacity: .8; margin: .6rem 0 .2rem; }
  input, textarea, button, select { font: inherit; }
  input[type=text], input[type=password], input[type=number], textarea {
    width: 100%; padding: .5rem .6rem; border-radius: 6px;
    border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
    background: Field; color: FieldText;
  }
  textarea { min-height: 4.5rem; resize: vertical; }
  .row { display: flex; gap: .75rem; align-items: end; flex-wrap: wrap; }
  .row > div { flex: 1 1 12rem; }
  .row > div.small { flex: 0 0 8rem; }
  button {
    padding: .55rem 1.1rem; border-radius: 6px; border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
    background: color-mix(in srgb, CanvasText 8%, Canvas); color: CanvasText; cursor: pointer;
  }
  button.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
  button:disabled { opacity: .5; cursor: default; }
  #jobView { display: none; }
  .runId { font-family: ui-monospace, monospace; font-size: .85rem; opacity: .7; }
  .stageLine { font-size: 1.05rem; font-weight: 600; margin: .25rem 0 .75rem; }
  .bar { height: 8px; border-radius: 4px; background: color-mix(in srgb, CanvasText 12%, transparent); overflow: hidden; margin-bottom: 1rem; }
  .bar > div { height: 100%; background: #2563eb; transition: width .3s ease; }
  .badges { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .badge { padding: .3rem .65rem; border-radius: 999px; font-size: .8rem; border: 1px solid transparent; }
  .badge.pending { background: color-mix(in srgb, CanvasText 10%, transparent); }
  .badge.passed, .badge.built, .badge.shot, .badge.ok { background: #16a34a22; color: #16a34a; border-color: #16a34a55; }
  .badge.failed, .badge.err { background: #dc262622; color: #dc2626; border-color: #dc262655; }
  .badge.running { background: #2563eb22; color: #2563eb; border-color: #2563eb55; }
  section { margin-bottom: 1.5rem; }
  h2 { font-size: .95rem; margin: 0 0 .5rem; opacity: .85; }
  table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  td, th { text-align: left; padding: .35rem .4rem; border-bottom: 1px solid color-mix(in srgb, CanvasText 10%, transparent); }
  .muted { opacity: .6; }
  ul.errors { margin: 0; padding-left: 1.1rem; color: #dc2626; }
  #log { font-family: ui-monospace, monospace; font-size: .78rem; opacity: .7; white-space: pre-wrap; margin-top: .5rem; }
  a.final { font-weight: 600; }
  .jobsList { font-size: .85rem; }
  .jobsList button { padding: .2rem .55rem; font-size: .8rem; }
</style>
</head>
<body>

<h1>BusinessForge</h1>
<p class="sub">Control surface — real state from the running orchestrator, not a mock. WQ-016.</p>

<fieldset>
  <legend>Connection</legend>
  <label for="token">Shared token (from <span class="muted">n8n/.stage-token</span> or <span class="muted">BF_STAGE_TOKEN</span>)</label>
  <input type="password" id="token" placeholder="paste the stage-server token">
</fieldset>

<fieldset>
  <legend>Start a job</legend>
  <label for="order">Business URL or brief</label>
  <textarea id="order" placeholder="e.g. https://maps.google.com/... or &quot;an artisanal bakery in Sibiu&quot;"></textarea>
  <div class="row">
    <div class="small">
      <label for="maxIter">Max retries</label>
      <input type="number" id="maxIter" value="3" min="1" max="20">
    </div>
    <div>
      <label for="runIdField">Job ID <span class="muted">(auto-generated, editable)</span></label>
      <input type="text" id="runIdField">
    </div>
    <div class="small"><button class="primary" id="startBtn" style="width:100%">Start job</button></div>
  </div>
</fieldset>

<fieldset>
  <legend>Existing jobs</legend>
  <div class="jobsList" id="jobsList">Enter a token above to list runs.</div>
</fieldset>

<div id="jobView">
  <fieldset>
    <legend>Job <span class="runId" id="viewRunId"></span></legend>
    <div class="stageLine" id="stageLine">—</div>
    <div class="bar"><div id="progressBar" style="width:0%"></div></div>
    <div class="badges" id="phaseBadges"></div>

    <section>
      <h2>Workers / providers</h2>
      <table id="workersTable"><tbody></tbody></table>
    </section>

    <section id="battleSection" style="display:none">
      <h2>Design candidate battle</h2>
      <p id="battleLine"></p>
    </section>

    <section id="gateSection" style="display:none">
      <h2>Distinctness gate</h2>
      <p id="gateLine"></p>
    </section>

    <section id="errorsSection" style="display:none">
      <h2>Errors</h2>
      <ul class="errors" id="errorsList"></ul>
    </section>

    <section id="finalSection" style="display:none">
      <h2>Result</h2>
      <p id="finalLine"></p>
    </section>

    <div id="log"></div>
  </fieldset>
</div>

<script>
(function () {
  'use strict';

  var STAGE_LABELS = {
    created: 'Starting', research: 'Researching the business', evidence: 'Verifying evidence',
    character: 'Understanding the business', creative: 'Choosing creative direction',
    experience: 'Planning the experience', diverge: 'Building design candidates',
    content: 'Writing content', asset: 'Planning assets', design: 'Composing design',
    build: 'Building the site', browser: 'Capturing screenshots',
    'visual-critic': 'Visual quality review', 'distinctness-gate': 'Distinctness check',
    hermes: 'Deciding next step', delivery: 'Deploying', human: 'Waiting for a person'
  };
  var STAGE_ORDER = ['created','research','evidence','character','creative','experience','diverge',
    'content','asset','design','build','browser','visual-critic','distinctness-gate','hermes','delivery'];
  var DECISION_LABELS = { running: 'In progress', deliver: 'Delivered', reconcept: 'Rebuilding (previous attempt rejected)', escalate: 'Escalated to a human' };
  var PHASE_LABELS = { pending: 'not started', built: 'built', shot: 'captured', passed: 'passed', failed: 'failed' };

  var els = {
    token: document.getElementById('token'),
    order: document.getElementById('order'),
    maxIter: document.getElementById('maxIter'),
    runIdField: document.getElementById('runIdField'),
    startBtn: document.getElementById('startBtn'),
    jobsList: document.getElementById('jobsList'),
    jobView: document.getElementById('jobView'),
    viewRunId: document.getElementById('viewRunId'),
    stageLine: document.getElementById('stageLine'),
    progressBar: document.getElementById('progressBar'),
    phaseBadges: document.getElementById('phaseBadges'),
    workersTable: document.getElementById('workersTable').querySelector('tbody'),
    battleSection: document.getElementById('battleSection'),
    battleLine: document.getElementById('battleLine'),
    gateSection: document.getElementById('gateSection'),
    gateLine: document.getElementById('gateLine'),
    errorsSection: document.getElementById('errorsSection'),
    errorsList: document.getElementById('errorsList'),
    finalSection: document.getElementById('finalSection'),
    finalLine: document.getElementById('finalLine'),
    log: document.getElementById('log')
  };

  var pollTimer = null;

  function log(msg) {
    var t = new Date().toISOString().slice(11, 19);
    els.log.textContent = '[' + t + '] ' + msg + '\\n' + els.log.textContent;
  }

  function token() { return els.token.value.trim(); }

  try {
    var saved = localStorage.getItem('bf-stage-token');
    if (saved) { els.token.value = saved; }
  } catch (e) { /* private browsing or storage disabled — token just won't persist */ }
  els.token.addEventListener('change', function () {
    try { localStorage.setItem('bf-stage-token', token()); } catch (e) { /* ignore */ }
    refreshJobsList();
  });

  function genRunId() {
    var rand = Math.random().toString(36).slice(2, 8);
    return 'run-' + Date.now().toString(36) + '-' + rand;
  }
  els.runIdField.value = genRunId();

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { 'x-bf-token': token() });
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        return { ok: res.ok, status: res.status, body: body };
      });
    });
  }

  function refreshJobsList() {
    if (!token()) { els.jobsList.textContent = 'Enter a token above to list runs.'; return; }
    api('/jobs').then(function (r) {
      if (!r.ok) { els.jobsList.textContent = 'Could not list runs (' + r.status + ').'; return; }
      var runs = (r.body && r.body.runs) || [];
      if (runs.length === 0) { els.jobsList.textContent = 'No runs yet.'; return; }
      els.jobsList.innerHTML = '';
      runs.slice(0, 25).forEach(function (s) {
        var row = document.createElement('div');
        row.style.padding = '.25rem 0';
        var btn = document.createElement('button');
        btn.textContent = 'Watch';
        btn.addEventListener('click', function () { watch(s.jobId); });
        row.appendChild(btn);
        var label = document.createElement('span');
        label.style.marginLeft = '.5rem';
        label.textContent = (s.business || s.jobId) + '  —  ' + (STAGE_LABELS[s.stage] || s.stage) + '  (' + (DECISION_LABELS[s.decision] || s.decision) + ')';
        row.appendChild(label);
        els.jobsList.appendChild(row);
      });
    }).catch(function () { els.jobsList.textContent = 'Could not reach the stage server.'; });
  }

  function progressPct(summary) {
    var idx = STAGE_ORDER.indexOf(summary.stage);
    var base = idx < 0 ? 0 : (idx / (STAGE_ORDER.length - 1)) * 100;
    return Math.max(2, Math.min(100, Math.round(base)));
  }

  function render(runId, summary) {
    els.jobView.style.display = 'block';
    els.viewRunId.textContent = runId;
    var terminal = summary.decision === 'deliver' || summary.decision === 'escalate';
    els.stageLine.textContent = (STAGE_LABELS[summary.stage] || summary.stage) +
      ' — iteration ' + summary.iteration + '/' + summary.maxIter +
      ' — ' + (DECISION_LABELS[summary.decision] || summary.decision || 'in progress');
    els.progressBar.style.width = (terminal ? 100 : progressPct(summary)) + '%';

    els.phaseBadges.innerHTML = '';
    ['implementation', 'browser', 'qa'].forEach(function (key) {
      var status = (summary.phases && summary.phases[key]) || 'pending';
      var b = document.createElement('span');
      b.className = 'badge ' + status;
      b.textContent = key + ': ' + (PHASE_LABELS[status] || status);
      els.phaseBadges.appendChild(b);
    });

    els.workersTable.innerHTML = '';
    var workers = summary.workers || { calls: 0, providersUsed: [], failedProviders: [], fallbacks: 0 };
    var headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Provider</th><th>OK</th><th>Failed</th>';
    els.workersTable.appendChild(headerRow);
    var names = {};
    (workers.providersUsed || []).forEach(function (n) { names[n] = true; });
    (workers.failedProviders || []).forEach(function (n) { names[n] = true; });
    var any = false;
    Object.keys(names).forEach(function (name) {
      any = true;
      var okBadge = workers.providersUsed.indexOf(name) >= 0 ? '<span class="badge ok">used</span>' : '';
      var failBadge = workers.failedProviders.indexOf(name) >= 0 ? '<span class="badge err">had failures</span>' : '';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + name + '</td><td>' + okBadge + '</td><td>' + failBadge + '</td>';
      els.workersTable.appendChild(tr);
    });
    if (!any) {
      var tr2 = document.createElement('tr');
      tr2.innerHTML = '<td colspan="3" class="muted">' + workers.calls + ' call(s) so far' + (workers.fallbacks ? ', ' + workers.fallbacks + ' via the deterministic floor' : '') + '</td>';
      els.workersTable.appendChild(tr2);
    } else if (workers.fallbacks) {
      var tr3 = document.createElement('tr');
      tr3.innerHTML = '<td colspan="3" class="muted">' + workers.fallbacks + ' call(s) fell back to the deterministic floor (no live provider used)</td>';
      els.workersTable.appendChild(tr3);
    }

    if (summary.battle) {
      els.battleSection.style.display = 'block';
      var b = summary.battle;
      els.battleLine.textContent = b.count + ' candidate(s) built' +
        (b.winnerId ? ', winner ' + b.winnerId : '') +
        (b.bestQuality != null ? ', best quality ' + b.bestQuality.toFixed(1) + '/100' : '') +
        (b.judgeCount != null ? ', ' + b.judgeCount + ' judge pass(es)' : '');
    } else { els.battleSection.style.display = 'none'; }

    if (summary.gate) {
      els.gateSection.style.display = 'block';
      els.gateLine.textContent = 'Verdict: ' + summary.gate.verdict + ' (score ' + summary.gate.score + ')';
    } else { els.gateSection.style.display = 'none'; }

    if (summary.errors && summary.errors.length) {
      els.errorsSection.style.display = 'block';
      els.errorsList.innerHTML = '';
      summary.errors.forEach(function (e) {
        var li = document.createElement('li');
        li.textContent = e;
        els.errorsList.appendChild(li);
      });
    } else { els.errorsSection.style.display = 'none'; }

    if (summary.finalOutput) {
      els.finalSection.style.display = 'block';
      els.finalLine.innerHTML = 'Delivered: <a class="final" href="' + summary.finalOutput + '" target="_blank" rel="noopener">' + summary.finalOutput + '</a>';
    } else if (summary.decision === 'escalate') {
      els.finalSection.style.display = 'block';
      els.finalLine.textContent = 'Escalated to a human — no automatic result. See errors above.';
    } else {
      els.finalSection.style.display = 'none';
    }

    return terminal;
  }

  function stopPolling() { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } }

  function watch(runId) {
    stopPolling();
    els.jobView.style.display = 'block';
    els.viewRunId.textContent = runId;
    log('watching ' + runId);
    var consecutiveFailures = 0;

    function tick() {
      api('/job?runId=' + encodeURIComponent(runId)).then(function (r) {
        if (!r.ok) {
          consecutiveFailures++;
          log('poll failed (' + r.status + '): ' + (r.body && r.body.error || 'unknown error'));
          if (consecutiveFailures >= 5) { log('giving up after 5 consecutive failed polls'); return; }
          pollTimer = setTimeout(tick, 4000);
          return;
        }
        consecutiveFailures = 0;
        var terminal = render(runId, r.body);
        if (!terminal) { pollTimer = setTimeout(tick, 3000); }
        else { log('job reached a terminal decision: ' + r.body.decision); refreshJobsList(); }
      }).catch(function (err) {
        consecutiveFailures++;
        log('poll error: ' + err);
        if (consecutiveFailures < 5) { pollTimer = setTimeout(tick, 4000); }
      });
    }
    tick();
  }

  els.startBtn.addEventListener('click', function () {
    var order = els.order.value.trim();
    if (!order) { log('enter a business URL or brief first'); return; }
    if (!token()) { log('enter the shared token first'); return; }
    var runId = (els.runIdField.value.trim() || genRunId());
    var maxIter = Number(els.maxIter.value) || 3;
    els.startBtn.disabled = true;
    log('starting job ' + runId + ' (maxIter=' + maxIter + ')');

    var qs = '?runId=' + encodeURIComponent(runId) + '&order=' + encodeURIComponent(order) + '&maxIter=' + encodeURIComponent(String(maxIter));
    // Deliberately not awaited before continuing: POST /job runs the whole
    // job host-side and only responds when it reaches a terminal decision,
    // which can be minutes away. job.json is written incrementally the
    // whole time, so polling GET /job separately (started immediately
    // below) is what gives live progress — the same reason the n8n
    // workflow itself is a separate Start/Poll pair, not one blocking call.
    api('/job' + qs, { method: 'POST' }).then(function (r) {
      log('job ' + runId + ' finished: ' + (r.body && r.body.decision || r.body && r.body.status || r.status));
    }).catch(function (err) { log('job ' + runId + ' request error: ' + err); }).then(function () {
      els.startBtn.disabled = false;
    });

    els.runIdField.value = genRunId();
    watch(runId);
  });

  refreshJobsList();
})();
</script>
</body>
</html>
`;
