# BUSINESSFORGE 2.0 — CONTROL PLANE V2

*Independent control-plane architecture. Read-only: no repository modified, no n8n changed, nothing implemented. Grounded in `CONTROL_PLANE_AUDIT.md` (real code findings) and `BUSINESSFORGE_2.0_ARSENAL.md` (provider/role model). The two other referenced inputs (`BUSINESSFORGE_2.0_REGISTRY_V1_REDTEAM.md`, `BUSINESSFORGE_2.0_MASTER_ARCHITECTURE.md`) **do not exist on disk** — they were not fabricated; this spec draws on the audit's anti-template/security findings and the arsenal's role/router model instead. Classification per item: MUST / SHOULD / OPTIONAL / REJECT.*

---

## 0. DESIGN PRINCIPLES (replace, don't defend)

1. **One authority, one machine.** Hermes is the sole state machine. n8n is a worker, not a brain.
2. **State is durable, resumable, and the single source of truth** — not a log, not a label.
3. **Every external dependency is multi-vendor and rate-limited** by default. No single-vendor SPOF.
4. **Cost and parallelism are hard ceilings, enforced by the authority**, not by coincidence.
5. **A run that cannot be proved good is escalated, never delivered.**
6. **PII never leaves the box unless redacted and logged.**

---

## 1. CINE DEȚINE AUTORITATEA? — **HERMES (FSM), singur**

Autoritatea este **Hermes**, implementat ca o mașină de stări finită (`State × Event → nextState`). Hermes:
- deține *toate* tranzițiile (`CREATED → … → DELIVER | ESCALATE`);
- citește starea din `job.json` (resume cursor);
- aprobă/refuză fiecare pas pe baza `budget lease`, `iteration ceiling`, `PII policy`, `peers`;
- emite următorul stage numit;
- decide `TERMINATE` (deliver / escalate / dead).

**MUST.** n8n NU deține autoritatea, nu face branching de logică, nu înțelege `iteration`/`route`. Executorul întreabă Hermes "ce fac acum?" și execută orbește.

---

## 2. CARE ESTE SINGURA STATE MACHINE? — **Hermes FSM**

Stări explicite (nu doar enum scris pe disc):

```
CREATED
  → BUILD            (compose concept set / site)
BUILD → BROWSER     (render + screenshot)
BROWSER → BATTLE    (parallel fan-out of N concepts)   [if premium/concept stage]
BATTLE → JOIN       (aggregate, pick best-so-far)
JOIN → CRITIC       (multi-judge visual + deterministic)
CRITIC → GATE       (PASS/FAIL + diagnosis + distinctness)
GATE:
  PASS                → DELIVER
  FAIL & iter<max     → REBUILD(route)   → BUILD (with new directive)
  FAIL & iter>=max    → ESCALATE
  FAIL & budget<=0    → ESCALATE
  UNCERTAIN_VISION    → ESCALATE or DEFER (never PASS)   ← fix audit F.3
REBUILD → BUILD
DELIVER → DONE
ESCALATE → HUMAN (alert) → DONE
```

**MUST.** O singură implementare, partajată de ambele căi de execuție (direct + n8n). Elimină dualitatea `runJob.ts`/`n8n JSON`.

---

## 3. CONTRACTUL HERMES ↔ EXECUTOR

Executorul (n8n sau orice worker) vorbește cu Hermes printr-un protocol minimal și **stateless pe partea de decizie**:

```
EXECUTOR → HERMES:  POST /hermes/next  { runId, stageCompleted?, result? }
HERMES  → EXECUTOR: { action: "RUN_STAGE"|"TERMINATE"|"WAIT",
                       stage: <StageName>,
                       runId, iteration, budgetRemaining,
                       reason }
```

Reguli:
- Executorul **nu ia decizii**. Dacă Hermes zice `RUN_STAGE: build`, executorul rulează build și raportează înapoi.
- Hermes **nu execută I/O**. Doar decide.
- Hermes verifică `budgetRemaining` și `iteration` **înainte** de a emite orice stage costisitor.
- Dacă `action: TERMINATE`, executorul oprește run-ul și eliberează lock-ul.

**MUST.** Acest contract ucide fragmentarea de autoritate din audit (A).

---

## 4. CHECKPOINT / RESUME

`job.json` devine **cursor de resume**, nu doar persistence:
- Fiecare stage e **idempotent** și verifică: "am deja output valid pentru `(runId, stage, iteration)`?". Dacă da → skip (nu re-rulează).
- La restart, Hermes citește `job.json`, găsește primul stage incomplet la iterația curentă și reia de acolo.
- Cheie de idempotență per `(runId, stage, iteration)`.
- Starea conține: `stage`, `iteration`, `maxIter`, `budgetSpentUsd`, `budgetTokens`, `bestSoFarRef`, `peersRef`, `creativeDirection`, `decision`, `errors[]`, `finalOutput`.

**MUST.** Crash la iterația 2 ≠ restart de la zero. (Audit H fixat.)

---

## 5. CONCURRENCY

- **Intra-run fan-out**: BATTLE rulează N concepte în paralel (vezi 13). JOIN așteaptă toate.
- **Cross-run**: un **semaphore global** limitează numărul de run-uri/concepte simultane.
- **Per-vendor**: rate limiter (vezi 7) izolează presiunea per vendor.
- **Browser**: un pool de contexte Playwright (desktop+mobile) reutilizabile, nu unul serial.

**MUST** semaphore global + fan-out controlat. **SHOULD** worker pool.

---

## 6. JOB LOCKS

- **Job-level distributed lock** keyed pe `runId` (Redis/DB `SET NX` cu TTL + heartbeat renew).
- Deținut pe durata unui stage; eliberat la `TERMINATE` sau la timeout (heartbeat mort → lock eliberat, run reluat de alt worker).
- Previne coruperea `job.json` chiar și cu 2 instanțe stage-server sau 2 webhook-uri pentru același `runId` (audit C.1).
- Lock-ul e **separat** de semaphore-ul global (lock = excludere pe un run; semaphore = număr maxim run-uri).

**MUST.** Fără lock distribuit, `serialise()` dintr-un singur proces e insuficient.

---

## 7. PROVIDER RATE LIMITS

- **Token-bucket / sliding-window per vendor** în stratul provider (înainte de retry).
- Respectă header-ul **`Retry-After`** (audit D: azi e ignorat).
- **Semaphore global** + **per-vendor RPM cap**.
- Limitele vin din config (nu hardcodate): `vendor.rpm`, `vendor.tpm`, `global.maxConcurrent`.
- Când se atinge plafonul → call-ul așteaptă (nu aruncă 429 în cascadă).

**MUST.** Altfel BusinessForge *cauzează* 429-uri sub load (audit D).

---

## 8. BUDGET LEASES

- Fiecare run primește o **lease**: `maxUsd`, `maxTokens`, `maxIter` (default 2–3, NU 1..20 — audit E/G).
- Hermes decrementează `budgetSpentUsd/Tokens` după fiecare call (din răspunsul provider-ului).
- **Înainte** de orice rebuild costisitor, Hermes verifică `budgetRemaining > 0`. Dacă nu → ESCALATE.
- Lease-ul e persistat în `job.json` → supraviețuiește crash-ului și e vizibil în observability.
- Plafon agresiv dar realist: ex. `maxUsd = $0.50` deterministic, `$5` premium, configurabil per client.

**MUST.** Fără budget lease, `maxIter=20` e un SPOF financiar (audit E).

---

## 9. PROVIDER FAILOVER

- Stratul factory devine **try-list**, nu single (`factory.createDefault` azi = 1 vendor).
- `Hermes/Executor` cere `capability` → router returnează **ranked provider list** + fallback.
- Pe eșec după retries (429/5xx/transport), **trece la următorul vendor** din listă (Anthropic → OpenAI → Gemini → OpenRouter → local Ollama).
- Fallback-ul e *per capability*, nu per run.
- Niciodată blocat pe un singur vendor SPOF.

**MUST.** (Audit F.2: azi zero failover.)

---

## 10. RETRIES

- Păstrăm stratul bun existent: `protocol.ts` clasifică `retryable` onest; `factory.withRetry` = exponential backoff + full jitter.
- **Adăugăm**: respect `Retry-After`; cap de timp total per stage (nu doar per call); pe epuizare → failover (9), nu throw mort.
- Retry numai pentru `retryable:true` și `signal.aborted !== true`.

**MUST** păstrare backoff+jitter; **SHOULD** respect `Retry-After` + total-stage-deadline.

---

## 11. EVITAREA INFINITE LOOPS

- **Iteration ceiling** (`maxIter`) e singura sursă de terminare, verificată în Hermes FSM **și** re-verificată de executor (n8n citește `iteration`+`maxIter` din răspuns, nu doar `loop`).
- **Budget lease** e al doilea plafon (mai strict decât iter).
- **Best-so-far** garantează că nu livrăm mai rău decât deja avem (12).
- Dacă `loop:true` fără increment de iterație → executor detectează inconsistencies și raportează eroare (nu loop infinit).

**MUST** dublă gardă (Hermes + executor) pe iteration.

---

## 12. BEST-SO-FAR

- Hermes păstrează `bestSoFarRef` = cel mai bun design (scor distinctness + critic) văzut până acum, în ciuda iterațiilor ulterioare eșuate.
- La `ESCALATE` (iter/budget epuizat), dacă `bestSoFar` trece un **prag minim de livrabil** → se poate livra best-so-far cu avertisment; altfel → HUMAN.
- Best-so-far e *mereu* opțiunea de livrare, niciodată un design mai slab.

**MUST.** (Acoperă cazul "toate iterațiile următoare au fost mai proaste".)

---

## 13. DESIGN BATTLE FAN-OUT / JOIN

```
BATTLE:
  fan-out → [Concept_0 | Concept_1 | Concept_2]   (modele DIFERITE, seed DIFERIT)
            fiecare = apel paralel prin Capability Router (diverse vendors)
  JOIN:
    așteaptă toate N (sau timeout per concept)
    fiecare concept → BROWSER (screenshot) → CRITIC (judecător orb)
    agregare în cod (nu în model): scor compus = distinctness + critic - cost
    selectează câștigătorul → devine `bestSoFar` candidate
    perdantții sunt arhivați în design-memory (pentru repulsion cross-site)
```
- Divergența e **forțată**: fiecare generator e alt model + alt seed + alt constraint → evită "primul model setează frame-ul".
- Judecătorii sunt **orbi** (nu au autorat niciun concept) → evită bandwagon/sycophancy.
- JOIN e determinist; tie-break = distinctness.

**MUST** pentru livrarea premisei "experiențe distinctive".

---

## 14. IZOLAREA AGENȚILOR

- Fiecare agent = **rol**; provider-ul e injectat per call de router (nu importă SDK).
- Agenții nu se văd între ei înainte de JOIN (previne contagierea de opinie).
- Codul generat de coding-agent rulează în **sandbox** (Docker/e2b/Modal), fără host network, fără `eval`, fără secrete montate.
- Contextul fiecărui sub-agent e izolat (conform cercetării Anthropic multi-agent).

**MUST** sandbox + absența import-ului de provider în agenți.

---

## 15. PROTECȚIA SECRETELOR

- **Token-ul leak-at din n8n JSON se rotește** (audit J.1) și se mută în n8n credential / env / vault.
- Stage-server se leagă la **`127.0.0.1`**; n8n ajunge prin tunnel securizat / reverse proxy cu mTLS, nu `0.0.0.0` LAN.
- **Webhook n8n are auth** (header/JWT), nu deschis.
- Cheile API stau în secret manager, injectate ca env la runtime; niciodată în repo/JSON.
- Rate-limit pe `/stage/*` și `/hermes/*`.

**MUST** rotire token + bind localhost + webhook auth. (Audit J.)

---

## 16. PII ÎNAINTE DE EGRESS

- `output/<runId>/` e clasificat **PII-bearing**: criptat at rest / perms restricționate; retention + deletion policy.
- Înainte de egressul screenshot-ului la vision: **redacție** a PII detectabil (adresă/telefon/email) în imagine, SAU rulează criticul pe **vision local** (Qwen-VL via Ollama) → PII nu părăsește mașina.
- Orice egress e **logat** + acoperit de DPA cu providerul extern.
- Unknown/third-party vision fără DPA = **REJECT** pentru date client reale.

**MUST** criptare at rest + opțiune local-vision + log egress. (Audit K — GDPR, EU.)

---

## 17. VERIFICAREA CĂ QA E REPRODUCIBIL

- Gate-ul **nu trece niciodată** pe `uncertain` vision (audit F.3 fixat): `uncertain` ⇒ FAIL/DEFER, nu PASS.
- **Peers.json e auto-seed-at** din design-memory (corpus Qdrant) → cross-site repulsion e mereu activă (audit I.2).
- Distinctness are **floor hard independent** de scorul determinist (reference-distance / embedding repulsion) → un site "perfect" dar apropiat de un peer e REFUZAT.
- QA e **deterministă + versionată**: aceeași intrare → același verdict (seed fixat, judge schema fixată).

**MUST.** Vision OFF ⇒ nu se livrează; cross-site mereu pornit.

---

## 18. CE FACE n8n?

**Executor dumb + integration fabric:**
- primește triggerul (webhook/manual);
- apelează `POST /hermes/next`, rulează stage-ul numit, raportează înapoi;
- face I/O real (HTTP către stage-server, scheduling, retry-la-nivel-de-workflow, error workflow → DLQ + alert);
- nu decide nimic.

**MUST** (ca executor). **REJECT** (ca orchestrator/autoritate).

---

## 19. CE NU FACE n8n?

- NU deține loop-ul / branching-ul de logică.
- NU înțelege `iteration`/`route`/`rationale`.
- NU alege provider / model.
- NU calculează budget / cost.
- NU e sursa de adevăr a stării (doar o citește de la Hermes).

---

## 20. CE FACE BROWSER?

- **Render + screenshot** real (Playwright pool): desktop + mobile, full-page corect (tehnica existentă din `runJob.ts`).
- Rulează **după** fiecare rebuild (nu o singură dată).
- Alimentează CRITIC (pixel-level) și QA (a11y/perf).
- Opțional: Browserbase/Stagehand când local insuficient.

**MUST** ca verigă de realitate pentru QA.

---

## 21. CE FACE BUSINESSFORGE?

- **Produsul** (sistemul autonom). Nu e un component — e suma: Hermes + Executor(n8n) + Stage Layer + Provider Layer + Persistence + Design Memory.
- Responsabilitatea sa: produce website-uri distinctive, verificate, la cost controlat, fără pași manuali.

---

## 22. CE FACE CAPABILITY ROUTER?

- Pentru fiecare `capability`, returnează **ranked provider list + fallback** evaluat după `[quality, cost, latency, availability, license-clearance]`.
- **Auto-fallback** pe 429/5xx/timeout/auth-fail.
- **Commercial-license gate**: respinge Sora / SD3.5>$1M / free non-commercial (audit arsenal §16).
- Extinde contractul text-only existent (`generateImage/transcribe/judgeImage/embed`) — nu îl înlocuiește.
- Suportă **mai mulți provideri simultan** pentru aceeași capabilitate (battle).

**MUST.** (Arsenal §7.)

---

## 23. CE FACE AGENT POOL?

- **Roluri** (`research`, `strategist`, `conceptA/B/C`, `critic`, `jury`, `judge`, `director`, `builder`, `asset*`, `browser`, `qa`, `distinctness`, `hermes`).
- Fiecare declară `requiredCapability` + `budgetTier`; router-ul rezolvă provider-ul la call-time.
- Agenti **nu importă SDK-uri** (regula existentă păstrată).
- Pool-ul e consumat de Hermes FSM prin fan-out/join.

**MUST** ca mod de organizare a rolurilor.

---

## 24. DACĂ PROCESUL MOARE?

- `job.json` e cursor de resume (4) → alt worker preia lock-ul (heartbeat mort) și reia de la primul stage incomplet.
- Stage-urile idempotente → nu dublează munca.
- Nimic nu e pierdut; nu se livrează parțial.
- Dacă moartea e în timpul unui stage → lock eliberat după TTL, reluat.

**MUST** resume + lock heartbeat.

---

## 25. DACĂ UN PROVIDER MOARE?

- Retry (10) → failover la următorul vendor din listă (9).
- Dacă toți de pe acea capabilitate mor → stage-ul raportează eșec → Hermes decide ESCALATE sau DEFER (nu livrare cu QA ocolită).

**MUST.**

---

## 26. DACĂ TOATE MODELELE FRONTIER SUNT INDISPONIBILE?

- Fallback la **local/OSS** (Ollama: Qwen-VL judge, DeepSeek-distill concept, BGE embeddings) + **Gemini free tier** (dacă live).
- Dacă și local e mort → run-ul se **ESCALATE** (așteaptă om), nu livrează fără QA.
- Best-so-far (12) e tot ce avem de livrat, dacă trece pragul minim.

**MUST** kill-switch local; **SHOULD** queue-and-retry-later.

---

## 27. LIMITE DE COST

- `maxUsd` per run (lease), default: deterministic `$0.50`, premium `$5` (configurabil).
- `maxTokens` per run.
- `maxIter` 2–3 (nu 1..20).
- Plafon global lunar (opțional, pentru overhead).
- Hermes oprește rebuild-ul când `budgetRemaining ≤ 0`.

**MUST.**

---

## 28. LIMITE DE PARALELISM

- `global.maxConcurrentRuns` (ex. 4).
- `global.maxConcurrentConcepts` per battle (ex. 3–5).
- `vendor.rpm` / `vendor.tpm` per vendor.
- `browser.poolSize` (ex. 4 contexte).
- Toate enforce-ate de semaphore + rate-limiter, nu de noroc.

**MUST.**

---

## 29. CONDIȚII EXACTE DE TERMINATE

Run-ul se termină (`TERMINATE`) când **oricare**:
1. `GATE.verdict === PASS` (cu vision ON) → **DELIVER** (best-so-far dacă e mai bun).
2. `iteration >= maxIter` → **ESCALATE** (livrează best-so-far dacă trece prag minim, altfel HUMAN).
3. `budgetRemaining <= 0` → **ESCALATE**.
4. `GATE.route ∈ {escalate, deliver}` sau `diagnosis ∈ {E-thin-evidence}` → **ESCALATE**.
5. Toți providerii + local mor → **ESCALATE** (HUMAN).
6. `UNCERTAIN_VISION` și nu e disponibil judge local → **ESCALATE/DEFER** (NICIODATĂ PASS).

Niciun `TERMINATE` nu livrează un site care n-a trecut QA cu vision ON.

**MUST.**

---

## 30. CE NU TREBUIE CONSTRUIT? (REJECT)

- ❌ n8n ca orchestrator/autoritate (rămâne executor).
- ❌ Două mașini de stare (runJob vs n8n) — una singură (Hermes FSM).
- ❌ `loop:true` fără gardă de iterație în executor.
- ❌ Single-vendor provider (fără failover).
- ❌ QA care trece pe `uncertain` vision.
- ❌ Token plaintext în repo/n8n JSON; `0.0.0.0` LAN-exposed fără auth.
- ❌ PII necriptat la rest + screenshot egress fără redacție/DPA.
- ❌ `maxIter` 1..20 fără budget lease.
- ❌ Livrare pe "site tehnic corect dar generic" (fără pixel judge).
- ❌ Vendor lock-in (Cloudinary ca default, Sora, etc.) — vezi arsenal §15.
- ❌ Generare media by default (deterministic floor e anti-template + €0) — doar gated premium.

---

# CONTROL PLANE V2 DIAGRAM

```
┌──────────────────────────────────────────────────────────────────┐
│ TRIGGER (n8n webhook, authed)                                     │
└───────────────────────────────┬──────────────────────────────────┘
                                 │ POST /hermes/next
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ HERMES — THE ONLY STATE MACHINE (FSM)                             │
│  reads: job.json (resume) + design-memory (peers) + budget lease  │
│  checks: iteration ceiling • budgetRemaining • PII policy         │
│  emits: RUN_STAGE(name) | TERMINATE(deliver/escalate)             │
└───────────────────────────────┬──────────────────────────────────┘
          RUN_STAGE ─────────────┼─────────── TERMINATE
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ EXECUTOR (n8n, DUMB) — runs the named stage, reports back        │
│  • holds job lock (Redis NX+TTL+heartbeat)                       │
│  • idempotent per (runId,stage,iteration)                        │
└───────────────────────────────┬──────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE LAYER (resumable, parallel-capable)                         │
│  BUILD → BROWSER → [BATTLE fan-out N] → JOIN → CRITIC → GATE     │
│  BATTLE: Concept0‖Concept1‖Concept2 (different models+seeds)      │
│  JOIN: aggregate in CODE, pick best-so-far, store losers→memory  │
└───────────────────────────────┬──────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ CAPABILITY ROUTER  →  ranked provider list + fallback             │
│   • rate limiter (token-bucket, Retry-After)  • global semaphore  │
│   • commercial-license gate  • auto-failover                    │
└───────────────────────────────┬──────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ PROVIDER LAYER  (multi-vendor, no SPOF)                          │
│  Anthropic ⇄ OpenAI ⇄ Gemini ⇄ OpenRouter ⇄ Ollama(local)        │
│  media: fal/Replicate/Firefly/Veo/Tripo/ElevenLabs …             │
│  retries: honest retryable + jitter + Retry-After                 │
└───────────────────────────────┬──────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ PERSISTENCE + MEMORY                                             │
│  job.json (resume cursor, encrypted PII at rest)                 │
│  design-memory (Qdrant) — peers.json auto-seeded (cross-site)    │
│  budget lease recorded; egress logged                            │
└──────────────────────────────────────────────────────────────────┘
        ▲ loop-back (REBUILD)            ▼ on TERMINATE
   Hermes ◄── report ──── Executor   DELIVER → Cloudflare/R2
                                      ESCALATE → alert + HUMAN
```

# STATE MACHINE (formal)

| Current State | Event | Condition | Next State |
|---|---|---|---|
| CREATED | start | — | BUILD |
| BUILD | done | — | BROWSER |
| BROWSER | done | premium concept stage | BATTLE |
| BROWSER | done | no battle | JOIN |
| BATTLE | all concepts judged | — | JOIN |
| JOIN | aggregated | — | CRITIC |
| CRITIC | scored | — | GATE |
| GATE | verdict | PASS (vision ON) | DELIVER |
| GATE | verdict | FAIL & iter<max & budget>0 | REBUILD→BUILD |
| GATE | verdict | FAIL & (iter≥max \| budget≤0) | ESCALATE |
| GATE | verdict | UNCERTAIN & local-judge avail | DEFER→CRITIC(local) |
| GATE | verdict | UNCERTAIN & no judge | ESCALATE |
| REBUILD | directive applied | — | BUILD |
| DELIVER | — | best-so-far if better | DONE |
| ESCALATE | — | alert HUMAN | DONE |

# FAILURE MATRIX

| Failure | Detection | Action | Deliver? |
|---|---|---|---|
| Stage crash | lock heartbeat dead / report missing | resume from cursor, re-run stage | no |
| Provider 429/5xx | retryable=true | retry+jitter → failover vendor | no |
| Provider dead (all) | all list exhausted | ESCALATE / defer | no |
| Vision OFF | genericVerdict=uncertain | gate=FAIL/DEFER, never PASS | no |
| Budget exhausted | budgetRemaining≤0 | ESCALATE (best-so-far if ≥min) | conditional |
| Iteration ceiling | iteration≥maxIter | ESCALATE (best-so-far if ≥min) | conditional |
| PII egress blocked | no DPA/local | use local vision / redact | n/a |
| Human needed | escalate | alert + ticket, wait | no |
| Loop guard breach | loop=true, no iter++ | executor errors, reports | no |
| Process death | no heartbeat | another worker takes lock, resumes | no |

# COST MODEL

| Tier | maxUsd/run | maxIter | Battle concepts | Media |
|---|---|---|---|---|
| Deterministic (default) | $0.50 | 3 | 0 (single perturb) | off |
| Production | $2.00 | 3 | 3 | off (opt-in) |
| Premium (gated) | $5–20 + subs | 3 | 3–5 | on (gated, licensed) |

- Every provider call decrements lease (tokens + USD from response).
- Global monthly cap OPTIONAL.
- Determinism = €0 if Gemini-free + local; cost model is ceiling, not target.

# SECURITY MODEL

| Control | Status |
|---|---|
| Secrets in vault/env, not repo | MUST (rotate leaked n8n token) |
| Stage-server bind 127.0.0.1 + tunnel/mTLS | MUST (not 0.0.0.0 LAN) |
| n8n webhook auth | MUST |
| Rate-limit /hermes/* and /stage/* | MUST |
| Job lock (Redis NX+TTL+heartbeat) | MUST |
| PII encrypted at rest | MUST |
| Screenshot redact OR local vision | MUST |
| Egress logged + DPA | MUST |
| Sandbox for coding-agent | MUST |
| Commercial-license gate | MUST |

# FINAL VERDICT

Control Plane V2 transformă BusinessForge dintr-un **prototip secvențial cu autoritate fragmentată** (audit: "research prototype wearing a production costume") într-un sistem autonom cu **o singură autoritate (Hermes FSM)**, execuție dumb (n8n), stare durabilă și reluabilă, failover multi-vendor, plafoane hard de cost și paralelism, QA care nu trece fără judecător pixel, și PII tratat conform GDPR.

**MUST** (non-negociabil pentru "autonom, zero manual"): 1 autoritate Hermes · 1 FSM · contract Hermes↔Executor · resume cursor · job lock distribuit · rate limiter + semaphore · budget lease · multi-vendor failover · vision-ON gate · PII criptat/local · token rotit + bind localhost + webhook auth · error workflow → DLQ + alert om.

**SHOULD**: worker pool · respect Retry-After · best-so-far auto-deliver · queue-and-retry când toate modelele mor.

**OPTIONAL**: Temporal/Inngest pentru DAG · Langfuse/Helicone · Pinecone · Browserbase cloud.

**REJECT**: n8n ca orchestrator · 2 mașini de stare · single-vendor · QA pe uncertain · token plaintext/0.0.0.0 · PII neprotejat · maxIter 1..20 fără budget · media by default · vendor lock-in.

Fără cele 11 MUST, sistemul rămâne un prototip care *poate* livra un site generic, *poate* arde buget fără tavan, *poate* scăpa PII, și *moare* în tăcere când ceva ne-trivial merge prost.

---

*Read-only. Repository untouched, n8n untouched, nothing implemented. Grounded in CONTROL_PLANE_AUDIT.md + BUSINESSFORGE_2.0_ARSENAL.md. The two inputs REGISTRY_V1_REDTEAM and MASTER_ARCHITECTURE were not present on disk and were not fabricated; their anti-template/security intent was sourced from the audit instead.*
