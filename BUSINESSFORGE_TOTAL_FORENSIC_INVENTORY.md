# BUSINESSFORGE — TOTAL FORENSIC INVENTORY

_Compiled 2026-08-17. Independent of the prior audit: every claim below was
re-derived from the source or from executing it in this session. Where this
inventory corrects the earlier `BUSINESSFORGE_FULL_AUDIT.md`, it says so._

**Labels used throughout:** **FACT** (verified here, cited to `file:line` or to a
command I ran) · **INFERENCE** (my judgement) · **UNKNOWN** (not establishable,
with the reason).

---

## 0. ACCESS BOUNDARY — READ THIS BEFORE ANY OTHER SECTION

You asked for a forensic inventory of a Windows laptop at
`C:\Users\40728\WebsiteAgent`, including installed applications, AI tools, MCP
installations, n8n workflows, Docker containers, listening ports, and a
filesystem sweep for projects and agent configurations.

**I cannot reach that machine. This was verified, not assumed:**

| Probe | Result |
|---|---|
| `uname -a` | `Linux vm 6.18.5-fc-v20 … x86_64` |
| `hostname` / `whoami` | `vm` / `root` |
| `/mnt/c`, `/c`, `/Users` | **all three: No such file or directory** |
| Mounted filesystems | `/dev/vda /`, `/dev/vdc /opt/claude-code`, `/dev/vdd /opt/env-runner`, two tmpfs. **No Windows volume.** |
| `/home/user/` contents | exactly one entry: `WebsiteAgent` |
| `.git` directory mtime | `2026-08-17 12:33` — **created minutes ago** |
| `remote.origin.url` | `https://github.com/remusalex-coder/WebsiteAgent` |

This is an ephemeral Linux VM holding a **fresh `git clone`** of one repository.
It is not your laptop, does not mirror your laptop, and shares no filesystem
with it.

**Consequence for the 51 requested sections.** Of the 51, **35 are fully
answerable** from the repository and this environment, **3 are partially
answerable**, and **13 are UNKNOWN because they describe machine state I cannot
observe.** Rather than guess, each UNKNOWN section below states (a) precisely why,
(b) what evidence *inside the repository* bears on it, and (c) the exact command
to run on the laptop to fill the gap. Nothing is invented and nothing is
extrapolated from the previous audit.

**Also unchanged from the previous audit, re-verified independently this session:**
`grep -ri` across all 168 tracked files returns **zero** matches for `n8n`,
`docker`, `Dockerfile`, `Go Sweet`, `goSweet`, `River Park`, `riverpark`,
`controlRoom`, `blueprint`, `jury`, `divergence`, `critic`, `webgl`.

---

## PART I — ENVIRONMENT (sections 1–13)

### 1. Entire relevant laptop environment

**UNKNOWN.** No Windows filesystem is mounted (§0).

**What the repository nevertheless proves about the laptop (FACT):**

| Evidence in repo | What it establishes |
|---|---|
| `.gitignore:6-7` — `# Machine-local Claude Code state, not project configuration.` / `.claude/settings.local.json` | **Claude Code is used on the laptop.** Someone hit a `.claude/settings.local.json` and deliberately excluded it. This is the single strongest artefact about the dev environment. |
| `.gitignore` ignores only `settings.local.json`, **not** `.claude/` | Therefore a `.claude/settings.json`, `.claude/skills/`, `.claude/agents/` or `.mcp.json` **would be committed** if it existed. `git ls-files` shows none. **INFERENCE: there is no project-scoped Claude config, no project skills, no project MCP servers, and no project agents.** |
| `.gitattributes:1` — `* text=auto eol=lf` + binary rules | A CRLF platform was anticipated. Consistent with Windows. |
| `package.json:7` — `"engines": {"node": ">=20"}` | Node ≥20 required. |
| `package.json` `postinstall: playwright install chromium` | Chromium is installed **into the project**, not system-wide. |
| `docs/developer-guide.md`, `.env.example` | The documented setup is `npm install` + `.env`. **No Docker, no compose, no service, no n8n step anywhere.** |

**To fill this gap, run on the laptop:**
`Get-ComputerInfo | Select OsName,OsVersion,CsProcessors,CsTotalPhysicalMemory`

### 2. Windows software inventory

**UNKNOWN.** Cannot enumerate installed programs.

**To fill:** `Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | Select DisplayName,DisplayVersion,InstallLocation | Sort DisplayName`
and `winget list`.

**What BusinessForge actually requires (FACT, derived from `package.json` and the import graph):** Node ≥20, npm, Playwright + Chromium, TypeScript/tsx. **Nothing else.** No Docker, no Python, no n8n, no AI CLI is imported or invoked by any file in `lib/`, `agents/` or `main.ts`.

### 3. AI applications

**UNKNOWN for the laptop.**

**What is verifiable (FACT):**
- **In the repository:** BusinessForge reaches AI vendors over **HTTPS from its own code**, never through a CLI or desktop app. One SDK import exists in the entire repo — `@anthropic-ai/sdk` at `lib/ai/providers/anthropic.ts:14`. The other three vendors use raw `fetch`. **No file spawns, shells out to, or imports any AI CLI.** (Verified: the only `spawnSync` in the repo is `scripts/batch-audit.ts:17`, invoking `npm run dev` on itself.)
- **In this container:** `claude` (Claude Code 2.1.233) is present. `gemini`, `openai`, `antigravity`, `hermes`: **not installed**. This is the container's toolchain, irrelevant to the product.
- **Antigravity / Hermes: UNKNOWN.** They appear in **zero** files. I have no evidence they exist, and I will not speculate about what they are.

**To fill:** `where claude; where gemini; where openai; where codex; where cursor` and `Get-ChildItem $env:APPDATA,$env:LOCALAPPDATA -Depth 1 -Filter "*claude*","*cursor*","*gemini*"`.

### 4. AI models / providers

**FACT — fully answerable, this is in-repo configuration.**

| Provider | Adapter | Transport | Default model | Credential var | Native schema | Base-URL override |
|---|---|---|---|---|---|---|
| anthropic | `lib/ai/providers/anthropic.ts` | `@anthropic-ai/sdk`, **streaming** | `claude-opus-5` (`:195`) | `ANTHROPIC_API_KEY` | yes | `ANTHROPIC_BASE_URL` |
| openai | `providers/openai.ts` | raw `fetch` | `gpt-5` (`config.ts:253`) | `OPENAI_API_KEY` | yes | `OPENAI_BASE_URL` |
| gemini | `providers/gemini.ts` | raw `fetch` | `gemini-3.6-flash` (`config.ts:258`) | `GEMINI_API_KEY` | yes (OpenAPI subset) | `GEMINI_BASE_URL` |
| openrouter | `providers/openrouter.ts` | raw `fetch` | `openai/gpt-5` (`config.ts:259`) | `OPENROUTER_API_KEY` | yes | `OPENROUTER_BASE_URL` |

Selection: `AI_PROVIDER` (default `anthropic`, `config.ts:210`), validated at point of use not at load (`lib/ai/factory.ts:9-14`) so stages 1–3 run uncredentialled.

**Which are actually used: exactly two call sites.** `businessAnalystAgent.ts:314` and `writerAgent.ts:990`. Nothing else in the repository calls a model.

**Per your instruction not to assume a configured provider is used:** `AI_PROVIDER` defaults to `anthropic`, but **which vendor your laptop is configured for is UNKNOWN** — it depends on your `.env`, which is gitignored and absent here. **To fill:** `Select-String -Path .env -Pattern '^AI_PROVIDER|^ANALYST_MODEL|^WRITER_MODEL'`.

**Live-proven status:** Anthropic — **INFERENCE: yes**, it is the only adapter carrying vendor-specific bug handling (refusal `:143`, `max_tokens` truncation `:149`, server-side fallback beta `:41`) that you only write after seeing the failures. The other three: **UNKNOWN**, and `PROJECT_STATUS.md:161` states they have never run live.

### 5. AI configurations

**FACT (repo):** the complete AI configuration surface is 14 variables — `AI_PROVIDER`, 4 × `*_API_KEY`, 4 × `*_BASE_URL`, `AI_REQUEST_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_RETRY_BASE_DELAY_MS`, `OPENROUTER_REFERER`, `OPENROUTER_TITLE` — plus 8 per-stage (`ANALYST_MODEL/EFFORT/MAX_OUTPUT_TOKENS/MAX_PAGE_CHARS`, same 4 for `WRITER_`). All parsed in `lib/config.ts:502-551`.

**System instructions (FACT):** two, both hard-coded in source, neither externally configurable:
- `businessAnalystAgent.ts:154-162` — analyst persona, ~9 lines.
- `writerAgent.ts:227-275` — copywriter persona, ~49 lines, containing the prohibition list (`:229-240`), the anti-brochure lexicon (`:242`), the structure rules (`:246-258`), a worked negative example (`:260-267`) and thin-profile handling (`:269-275`).

**INFERENCE:** these prompts are the most valuable prose in the repository and the least visible — they are unversioned, untested, and cannot be changed without a code deploy. A prompt registry is a cheap, high-value addition.

**Container config (FACT, for completeness, credentials redacted):** `/root/.claude.json` `projects./home/user/WebsiteAgent` shows `mcpServers: null`, `enabledMcpjsonServers: []`, `allowedTools: []`, `hasTrustDialogAccepted: false`, `firstStartTime: 2026-08-11`. A **fresh install**. `/root/.claude/settings.json` and `/root/.claude/mcp.json`: **ABSENT**. This tells you nothing about your laptop and is recorded only so you know I looked.

### 6. MCP inventory

**Two distinct things, and conflating them would be the main error here.**

**(a) MCP *client* capability built into BusinessForge — FACT, real, and empty by default.**

BusinessForge is itself an MCP client. `lib/platform/mcp/` implements it:

| File | LOC | What it does | Status |
|---|---|---|---|
| `types.ts` | 92 | `MCPConnector` contract: metadata, health, capabilities, execute | REAL |
| `manager.ts` | 407 | Holds many servers, routes calls, enable/disable policy, credential checks, telemetry, capability caching, cross-server search | REAL |
| `httpConnector.ts` | 365 | **Streamable HTTP, JSON-RPC 2.0, no SDK.** Verified methods: `initialize` (`:174`), `tools/list` (`:199`), `resources/list` (`:200`), `prompts/list` (`:201`), `tools/call` (`:213`). Handles both JSON and SSE responses. Session id assigned on initialize and echoed (`:88`), re-initialises on a dead session (`:144`). | **REAL — never run live (UNKNOWN)** |
| `stdioConnector.ts` | 77 | **Throws** `MCPNotImplementedError` (`:70`). Message: "the stdio transport is not implemented; use an http endpoint instead" (`:28`). `capabilities()` returns empty rather than throwing (`:64`). | **STUB** |

Configuration: `MCP_SERVERS`, a JSON array parsed at `config.ts:383-430`, plus `MCP_ENABLED`/`MCP_DISABLED`/`MCP_REQUEST_TIMEOUT_MS`.

**Critical FACT: `MCP_SERVERS` is commented out in `.env.example:108`.** The only example is a commented GitHub server at `:106`. **So by default BusinessForge registers zero MCP servers, and nothing in the pipeline calls `platform.mcp` at all** — verified: no file in `agents/` imports or references `mcp`.

**Per your instruction — "MCP server X exposes tools A,B,C; tool A can do X":** I cannot list tools for BusinessForge's MCP servers because **there are none configured.** Listing tools requires a live `tools/list` against a running server. There is no server, no endpoint, and no credential.

**(b) MCP servers available to *this Claude Code session* — FACT, and genuinely useful to you.**

These are configured server-side for this remote environment, not in any file I can show you, and **not on your laptop**. They are worth inventorying because they answer "what could a Claude-Code-hosted BusinessForge worker reach?"

| Server | Representative tools (from the tool schemas available to me) | BusinessForge relevance |
|---|---|---|
| **github** | `get_file_contents`, `create_pull_request`, `push_files`, `create_or_update_file`, `list_commits`, `search_code`, `actions_run_trigger`, `get_job_logs`, `run_secret_scanning`, `create_branch`, `merge_pull_request` | **HIGH.** A deployment worker could push a rendered site to a repo and let Pages/Vercel publish it — a real path to closing the P0 without a hosting SDK. `run_secret_scanning` is a ready-made security-worker input. |
| **Figma** | `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_metadata`, `create_new_file`, `use_figma`, `get_motion_context`, `get_shader_fill`, `download_assets`, `get_code_connect_map` | **HIGH for the design gap.** `get_variable_defs` could import a real design-token system; `get_motion_context` addresses the motion gap; `create_new_file` could emit an editable design deliverable alongside the site. |
| **Canva** | `generate-design`, `export-design`, `list-brand-kits`, `upload-asset-from-url`, `create-design-from-brand-template`, `resize-design` | **MEDIUM.** `list-brand-kits` is a legitimate *brand-fact* source — the strongest answer to "most businesses have no scrapable brand colour". |
| **Notion** | `notion-create-pages`, `notion-fetch`, `notion-search`, `notion-query-data-sources`, `notion-update-page`, `notion-create-database` | **MEDIUM-HIGH.** `PROJECT_STATUS.md:5` and `NEXT_SESSION.md:6` both name Notion as canonical. This is the only tool that could reconcile repo state with "BusinessForge HQ". |
| **Kernel** | `execute_playwright_code`, `browser_curl`, `computer_action`, `manage_browsers`, `manage_profiles`, `exec_command`, `manage_replays` | **MEDIUM.** Hosted browsers would let QA/screenshot work run off the laptop. Overlaps existing local Playwright, so it buys scale, not capability. |
| **Claude_Code_Remote** | `create_session`, `send_message`, `create_trigger`, `list_environments`, `subscribe_pr_activity`, `send_later`, `interrupt_session` | **HIGH for orchestration.** `create_trigger` + `create_session` is a working scheduler and fan-out primitive — the closest thing available to a Factory Manager without building one. |

**INFERENCE, and it is the most actionable finding in this section:** BusinessForge implements a full MCP client that is wired to nothing, while the environment it is developed in exposes six populated MCP servers covering deployment, design tokens, brand assets, hosted browsers and orchestration. **The integration cost is one `MCP_SERVERS` JSON entry per server** — `config.ts:383` already parses it, `manager.ts` already routes it, `httpConnector.ts` already speaks the protocol. This is the largest owned-but-unused capability in the whole system (§40).

### 7. Skills inventory

**Two categories again, and they must not be merged.**

**(a) BusinessForge's own skill system — FACT: 38 declared, 38 throw.**

Machinery (all REAL): `registry.ts` (164) validated id→impl map; `loader.ts` (184) built-ins + dynamic `*.skill.ts` discovery; `manager.ts` (481) policy, dependency checks, credential checks, timeouts, telemetry, and a `blockingReason` ladder (`:136`) producing `disabled` → `missing_credential` → `unmet_dependency` → `not_implemented` → `timeout`/`cancelled`; `placeholder.ts` (71) the honest-stub factory; `types.ts` (163) the `Skill` contract.

**Per your instruction to read actual instructions, not infer from names — I read all eight category files.** Every one calls `definePlaceholders(...)`. Every skill therefore has `version: '0.0.0'` (`placeholder.ts:29`), `health: 'unavailable'` (`:60`), and `execute()` that throws `SkillNotImplementedError` (`:56`). **There are no instructions to read: none of the 38 has an implementation body.** What each *does* carry is a `description` and a `blockedOn` reason, which is the real content:

| Category | File | Ids | Representative `blockedOn` (verbatim) |
|---|---|---|---|
| web | `web.ts` (64) | `playwright`, `browser-automation`, `firecrawl`, `web-search`, `google-maps`, `seo` | — |
| development | `development.ts` (68) | `git`, `github`, `filesystem`, `database`, `deployment`, `api-testing`, `performance-testing` | — |
| documents | `documents.ts` (39) | `pdf`, `word`, `excel`, `powerpoint` | — |
| media | `media.ts` (49) | `vision`, `ocr`, `image-generation`, `speech`, `translation` | `vision`: "needs multimodal input on the AIProvider contract, which is text-only today" (`:20`). `image-generation`: "needs an image-model contract; the provider layer generates text only" (`:34`). `ocr`: "needs an OCR engine chosen — local Tesseract or a hosted API" (`:27`). `translation`: "needs a glossary mechanism so business names are never translated" (`:47`) |
| data | `data.ts` (37) | `embeddings`, `vector-store`, `analytics` | — |
| operations | `operations.ts` (66) | `email`, `notifications`, `calendar`, `scheduling`, `monitoring`, `logging`, `security-scanning` | — |
| marketing | `marketing.ts` (47) | `cms`, `social-media`, `payments`, `accessibility-testing` | — |
| productivity | `productivity.ts` (31) | `authentication`, `lovable` | — |

`BUILTIN_SKILLS` (`builtin/index.ts:26`) concatenates all eight. Its own docstring is accurate: "Thirty-eight reserved capability ids… Every one is a placeholder today."

**FACT: `SKILLS_DIR` is commented out at `.env.example:98`,** so discovery scans nothing by default. **And no file in `agents/` references `platform.skills`** — the manager boots, reports `0/38 enabled`, and is never called.

**(b) Skills available to this Claude Code session — FACT.** ~30 are exposed to me, including `code-review`, `security-review`, `artifact-design`, `artifact-diagramming`, `dataviz`, `ui-ux-pro-max`, `canvas-design`, `algorithmic-art`, `theme-factory`, `web-artifacts-builder`, `docx`/`pdf`/`pptx`/`xlsx`, `mcp-builder`, `skill-creator`, `doc-coauthoring`, `brand-guidelines`, `prompt-master`, `learn`, `run`, `loop`, `simplify`.

**Can BusinessForge reuse them? Mostly no, and it matters to be precise about why (INFERENCE):** these are *instruction bundles for an agent inside Claude Code*, not callable APIs. BusinessForge is a standalone Node process; it has no Claude Code runtime to invoke them in. Three that transfer as **content rather than code**:
- **`ui-ux-pro-max`** — a curated database of 161 product categories, 67 UI styles, 161 palettes, 57 font pairings, 99 UX guidelines. BusinessForge's whole collision problem (§30) is that it has **17 industries × 11 themes**. This skill's taxonomy is an order of magnitude larger and is *data*, which is portable.
- **`brand-guidelines`** / **`theme-factory`** — token-set patterns transferable into `lib/design/themes.ts`.
- **`security-review`** / **`code-review`** — usable in CI on BusinessForge itself, not on generated sites.

### 8. CLI tools

**FACT — BusinessForge's own CLI, fully traced from `main.ts:435-495`:**

| Invocation | Mode | Entry | Needs credential? | Needs browser? |
|---|---|---|---|---|
| `npm run dev -- <maps-url>` | `pipeline` | `runPipeline` `:386` | yes (stages 4–5) | yes |
| `npm run dev -- --from=<stage> <runId>` | `resume` | `resumePipeline` `:402` | only if ≥`analyze` | only if ≤`collect` |
| `npm run discover -- <maps-url>` | `discovery` | `discoverStandalone` `:721` | **no** | yes |
| `npm run render -- <content.json> [--out=<dir>]` | `render` | `renderStandalone` `:559` | **no** | **no** |
| `npm test` / `typecheck` / `build` / `start` | — | — | no | no |

Stage names accepted by `--from` (`main.ts:169-178`): `discovery, collect, normalize, analyze, write, design, render, deploy`.

**Argument parsing note (FACT):** `parseArgs` takes the **first** non-`--` argument (`:468`, `argv.find`). Flags use `--name=value` only (`:461-464`); `--out <dir>` with a space would be silently misread as the positional.

**Dev CLIs (FACT):** 10 scripts under `scripts/`, none part of the product — `generate-examples`, `screenshot-examples`, `renderer-coverage`, `batch-audit`, `build-review`, `hue-report`, `vendor-fonts`, plus three fixture modules. **All nine executable scripts have zero internal callers** (verified by import graph) — they are human-invoked leaves.

**Laptop CLIs: UNKNOWN.** To fill: `where node npm npx git docker python n8n claude`.

### 9. SDKs

**FACT — the complete third-party surface, from `package.json` and confirmed by the import graph:**

```
dependencies:      @anthropic-ai/sdk ^0.115.0   → imported in exactly ONE file
                   playwright ^1.49.1           → imported in exactly THREE files
devDependencies:   @types/node ^22.10.2, tsx ^4.19.2, typescript ^5.7.2
```

`npm install` → **16 packages, 0 vulnerabilities** (run this session).

Import graph proof of containment:
- `@anthropic-ai/sdk` → only `lib/ai/providers/anthropic.ts:14`. The file's docstring claims this exclusivity (`:10-12`) and **the claim is true.**
- `playwright` → `lib/browser.ts:8`, `scripts/batch-audit.ts:21`, `scripts/screenshot-examples.ts`. **No agent imports Playwright** — `discoveryAgent` and `collectorAgent` receive a `BrowserSession`/`PageHandle` (type-only imports at `:18`/`:19`). **That claim is also true.**

**INFERENCE:** a 2-runtime-dependency surface for a 29k-line system is exceptional and is a genuine asset. Guard it.

### 10. Browser tooling

**FACT.** `lib/browser.ts` (329) is a narrow Playwright Chromium abstraction. `PageHandle` exposes 19 methods; `BrowserSession` exposes 4.

| Method | Purpose | Called by |
|---|---|---|
| `goto`, `url`, `html`, `wait`, `close` | navigation/state | discovery, collector |
| `waitForSelector`, `exists` | readiness | discovery, collector |
| `text`, `textAll`, `innerText`, `attribute`, `attributeAll` | extraction | discovery, collector |
| `fieldsAll` | **DOM property with attribute fallback** — yields absolute `src`/`href` and `naturalWidth` (`:174-190`) | collector (image sizing) |
| `computedStyleAll` | **resolved** CSS — absolute `url()` for `background-image` (`:222-236`) | collector (CSS images) |
| `click`, `scroll`, `scrollPage` | interaction / lazy-load triggering | discovery (hours toggle, consent), collector |
| **`screenshot`** (`:240`) | full-page png | **NO product code. Dev scripts only.** |
| `fetchBinary` (`:313`) | download via the browser context so cookies/UA match | collector (images) |

Session config: `headless` (default true), `viewport 1440×1000` hard-coded (`:278`), `locale`, optional `userAgent`, optional `proxyUrl`, timeouts from config, `close()` idempotent and bound to `AbortSignal` (`:296`).

**FACT — the capability gap this exposes:** the pipeline **never screenshots its own output.** Screenshot capability exists and is unreachable from a run. That single unused method is the whole difference between "we render a site" and "we can see what we rendered".

### 11. Docker

**FACT: no Docker in the repository.** Zero matches for `docker`, `Dockerfile`, `docker-compose`, `compose.yml`, `.dockerignore` across all 168 tracked files. No containers, images, volumes, networks, compose files, port or service definitions exist to inspect.

Docker 29.3.1 *is* installed in this container, but nothing in the repo uses it, so it is **NOT REQUIRED**.

**Laptop Docker state: UNKNOWN.** To fill: `docker ps -a; docker images; docker volume ls; docker network ls; Get-ChildItem -Recurse -Filter "docker-compose*.y*ml" $env:USERPROFILE`.

### 12. n8n

**FACT: n8n does not exist in this repository.** Zero matches for `n8n` across every tracked file — no workflow JSON, no webhook route, no credential reference, no node definition, no mention in any of the 9 docs, the README, `ROADMAP.md`, `PROJECT_STATUS.md` or `NEXT_SESSION.md`.

Therefore, of your requested classification — REAL ORCHESTRATION / HTTP WRAPPER / DECORATIVE / PARTIAL / LEGACY / BROKEN — **none applies. There is nothing to classify.** I cannot report workflow names, triggers, nodes, credentials or active state because no such artefact exists here.

**100% of orchestration is in `main.ts`** (FACT): a `STAGES` const array (`:169-178`), an `ARTIFACTS` map (`:188-197`), an `ARTIFACT_KEYS` structural check (`:206-215`), a `step()` helper that either runs a stage or reads its predecessor off disk (`:317-327`), and eight sequential `await`s (`:336-361`).

**BusinessForge has no HTTP interface of any kind** — no server, no route, no listener. **INFERENCE: this is the precondition for any n8n integration, and it does not exist.** n8n cannot orchestrate what it cannot call.

**Laptop n8n state: UNKNOWN.** To fill: `Get-ChildItem $env:USERPROFILE\.n8n -Recurse -Filter "*.json"` and `Test-NetConnection localhost -Port 5678`.

### 13. Local services

**FACT (this container):** `ss -ltnp` returned **no listening TCP sockets**. Nothing serves anything.

**FACT (the product):** BusinessForge opens **no listening port**. It is a batch CLI. It makes only *outbound* connections: Chromium to Maps and to the target site, and HTTPS to one AI vendor. There is no port, process, service, local/network exposure or safe-to-expose question to answer — the surface is empty by construction.

**INFERENCE:** this is why §6's job-contract recommendation is structural rather than cosmetic. Every autonomy feature you want — Control Room, approval gate, n8n trigger, remote submission — requires a listening service that does not exist yet. It is one small server, and it is the keystone.

**Laptop services: UNKNOWN.** To fill: `Get-NetTCPConnection -State Listen | Select LocalPort,OwningProcess | Sort LocalPort` joined to `Get-Process`.

---

## PART II — REPOSITORY FORENSICS (sections 14–19)

### 14. WebsiteAgent complete tree

168 tracked files. `assets/fonts/` holds 34 `.woff2` binaries + `manifest.json` and is collapsed. `[n]` = lines.

```
WebsiteAgent/
├── agents/                                    7 files · 3,979 loc · the pipeline stages
│   ├── discoveryAgent.ts            [774]     stage 1 · Maps → identity · Playwright
│   ├── collectorAgent.ts            [789]     stage 2 · site crawl · Playwright
│   ├── normalizerAgent.ts           [681]     stage 3 · merge/dedupe/validate · pure
│   ├── businessAnalystAgent.ts      [423]     stage 4 · strategy · LLM #1
│   ├── writerAgent.ts              [1185]     stage 5 · copy + fact re-injection · LLM #2
│   ├── designAgent.ts                [92]     stage 5b · thin wrapper over composeDesign
│   └── lovableAgent.ts               [35]     stage 6 · THROWS NotImplementedError
├── assets/
│   └── fonts/                                 34 woff2 (latin subset) + manifest.json [299]
│                                              GENERATED by scripts/vendor-fonts.ts
├── docs/                                      9 files · 1,578 loc · see §19
│   ├── architecture.md              [126]     stale: "110 assertions"; 1 mention of design
│   ├── configuration.md             [129]     env var reference
│   ├── design-intelligence-review.md[322]     the design critique · 5 of 10 items now fixed
│   ├── developer-guide.md           [171]     setup + workflow
│   ├── folder-structure.md           [98]     STALE: zero mentions of lib/design
│   ├── mcp.md                       [134]     MCP contract + config
│   ├── providers.md                 [132]     provider layer + how to add one
│   ├── renderer.md                  [312]     renderer contract · stale test count
│   └── skills.md                    [154]     skill contract + the 38 ids
├── lib/
│   ├── ai/                                    11 files · 1,767 loc · provider abstraction
│   │   ├── types.ts                 [141]     AIProvider + ProviderAdapter contracts
│   │   ├── factory.ts               [244]     selection · credential check · retry+jitter
│   │   ├── protocol.ts              [233]     postJson · decodeStructured · effort mapping
│   │   ├── schema.ts                [253]     JSON-Schema → Gemini dialect · local validator
│   │   ├── http.ts                  [116]     timeout budget + credential probe
│   │   ├── index.ts                  [24]     ORPHAN barrel — nothing imports it
│   │   └── providers/
│   │       ├── index.ts              [34]     ADAPTERS table — the extension surface
│   │       ├── anthropic.ts         [199]     SDK, streaming, only file importing a vendor SDK
│   │       ├── openai.ts            [165]     fetch · never run live
│   │       ├── gemini.ts            [179]     fetch · schema translated, validated vs original
│   │       └── openrouter.ts        [179]     fetch · never run live
│   ├── design/                                8 files · 3,291 loc · visual intelligence
│   │   ├── types.ts                 [557]     WebsiteDesign and every sub-type
│   │   ├── industries.ts            [458]     17 industries · 16 keyword rules · defaults
│   │   ├── themes.ts                [434]     11 hand-authored design directions
│   │   ├── layout.ts                [531]     hero veto · variant scoring · frames · rhythm
│   │   ├── tokens.ts                [494]     type scale, spacing, radius, elevation, motion
│   │   ├── compose.ts               [406]     THE decision pipeline (industry→direction→…)
│   │   ├── color.ts                 [324]     OKLCH mathematics, dependency-free
│   │   └── index.ts                  [87]     public surface
│   ├── platform/                              20 files · 3,225 loc · capability platform
│   │   ├── platform.ts              [242]     wires providers + skills + MCP into one object
│   │   ├── types.ts                 [234]     CapabilityOutcome, HealthReport, metrics
│   │   ├── telemetry.ts             [264]     latency/error/availability · in-process only
│   │   ├── skills/                            14 files · all 38 skills are stubs
│   │   │   ├── types.ts             [163]     Skill contract + SkillNotImplementedError
│   │   │   ├── registry.ts          [164]     validated id→impl map
│   │   │   ├── loader.ts            [184]     built-ins + dynamic *.skill.ts discovery
│   │   │   ├── manager.ts           [481]     policy · blockingReason ladder · timeouts
│   │   │   ├── placeholder.ts        [71]     the honest-stub factory
│   │   │   └── builtin/                       8 category files, 38 ids, 0 implementations
│   │   │       ├── web.ts            [64]     playwright browser-automation firecrawl
│   │   │       │                              web-search google-maps seo
│   │   │       ├── development.ts    [68]     git github filesystem database
│   │   │       │                              deployment api-testing performance-testing
│   │   │       ├── operations.ts     [66]     email notifications calendar scheduling
│   │   │       │                              monitoring logging security-scanning
│   │   │       ├── media.ts          [49]     vision ocr image-generation speech translation
│   │   │       ├── marketing.ts      [47]     cms social-media payments accessibility-testing
│   │   │       ├── documents.ts      [39]     pdf word excel powerpoint
│   │   │       ├── data.ts           [37]     embeddings vector-store analytics
│   │   │       ├── productivity.ts   [31]     authentication lovable
│   │   │       └── index.ts          [46]     concatenates all eight
│   │   └── mcp/                               4 files · MCP client
│   │       ├── manager.ts           [407]     routing · policy · capability cache · search
│   │       ├── httpConnector.ts     [365]     JSON-RPC 2.0 over Streamable HTTP · REAL
│   │       ├── types.ts              [92]     MCPConnector contract
│   │       └── stdioConnector.ts     [77]     THROWS MCPNotImplementedError
│   ├── render/                                13 files · 5,650 loc · content → static site
│   │   ├── variants.ts             [2036]     design-driven CSS: heroes, variants, grid,
│   │   │                                      cards, buttons, footers, motion budget
│   │   ├── sections.ts             [1087]     one section → one <section>; 22 render fns
│   │   ├── css.ts                   [774]     base sheet + token block
│   │   ├── document.ts              [346]     <head>, header, nav, footer, JSON-LD, data-attrs
│   │   ├── theme.ts                 [301]     BrandVoice → validated tokens (CSS-injection guard)
│   │   ├── site.ts                  [249]     renderSite + assignIds · pure
│   │   ├── html.ts                  [224]     branded Html type · escaping · jsonLd
│   │   ├── assets.ts                [162]     safeHref/safeImageUrl · asset placement
│   │   ├── fonts.ts                 [132]     @font-face for the faces a design uses
│   │   ├── write.ts                 [123]     the ONLY filesystem writer · path-escape guard
│   │   ├── types.ts                 [120]     RenderedFile/Asset/Font/Site + options
│   │   ├── fontManifest.ts           [66]     GENERATED — do not edit
│   │   └── index.ts                  [30]     public surface
│   ├── config.ts                    [559]     THE ONLY process.env reader (verified)
│   ├── types.ts                     [492]     domain contracts + AgentContext + Agent
│   ├── browser.ts                   [329]     Playwright abstraction · 19 page methods
│   ├── logger.ts                    [182]     NDJSON + console sinks · scoped · timing
│   └── errors.ts                    [128]     AgentError taxonomy with honest `retryable`
├── output/
│   └── .gitkeep                      [10]     artifacts gitignored (.gitignore:11)
├── scripts/                                   10 files · 3,576 loc · ALL dev-only, 0 callers
│   ├── example-businesses-extra.ts [1184]     31 hand-written business fixtures
│   ├── example-businesses.ts        [759]     20 hand-written business fixtures + build()
│   ├── renderer-coverage.ts         [420]     coverage by PERTURBATION — the best tool here
│   ├── build-review.ts              [256]     review dashboard · reads scores.json (NOT generated)
│   ├── batch-audit.ts               [244]     5 real Maps URLs → generate + measure + screenshot
│   ├── generate-examples.ts         [276]     51 fixtures → 51 sites + comparison.md
│   ├── vendor-fonts.ts              [193]     fetches woff2 at author time
│   ├── screenshot-examples.ts       [120]     desktop+mobile shots of the example set
│   ├── hue-report.ts                 [84]     prints what each industry hue renders to
│   └── example-images.ts             [40]     placeholder image specs
├── test/                                      21 files · covers ONLY design + render
│   ├── design/    color[218] compose[400] industries[229] palette[249] renderer[456]
│   ├── render/    assets[130] html[156] site[432] snapshot[39] theme[144] write[65]
│   ├── fixtures/  business[103] content[231]
│   ├── support/   snapshot[36]                (reads UPDATE_SNAPSHOTS — the one test env read)
│   └── __snapshots__/  design.bakery.json[586] design.bakery.styles.css[2711]
│                       design.law.json[594] full.index.html[178] full.styles.css[578]
│                       minimal.index.html[35] minimal.styles.css[578]
├── main.ts                          [626]     orchestrator + CLI + 4 modes
├── README.md                        [527]     claims "one deployed website out" — false
├── PROJECT_STATUS.md                [196]     honest, with 3 stale/self-contradicting lines
├── ROADMAP.md                       [111]     M1✅ M2 deploy(P0) M3 content M4 M5
├── NEXT_SESSION.md                   [87]     claims "works end to end" — false
├── BUSINESSFORGE_FULL_AUDIT.md     [1769]     prior audit (this session's predecessor)
├── .env.example                     [151]     60 vars; MCP_SERVERS & SKILLS_DIR commented out
├── .gitignore                        [11]     node_modules dist .env output/* .claude/settings.local.json
├── .gitattributes                    [16]     * text=auto eol=lf + binary rules
├── package.json                      [30]     2 runtime deps · postinstall installs Chromium
├── package-lock.json                [689]     16 packages
├── tsconfig.json                     [23]     build config
└── tsconfig.test.json                 [8]     typecheck incl. tests
```

### 15. File-by-file BusinessForge architecture

Caller/callee relations below are from the **programmatically built import graph** (90 `.ts` files parsed), not from reading docstrings. `→` = imports value; `⇢` = imports type only.

#### 15.1 Directory-level

| Folder | PURPOSE | CONTENTS | DEPENDENCIES | WHO USES IT | WHO IT CALLS | WHO CALLS IT | STATUS | BUSINESSFORGE ROLE |
|---|---|---|---|---|---|---|---|---|
| `agents/` | one file per pipeline stage | 7 agents, 3,979 loc | `lib/*` only; **no agent imports another** (verified) | `main.ts` | `lib/browser`, `lib/errors`, `lib/design`, `lib/render` (writer only) | `main.ts`, `scripts/batch-audit` (via CLI) | 6 ACTIVE, 1 BROKEN | the production line |
| `lib/ai/` | vendor-agnostic model access | contract, factory, 4 adapters, protocol, schema, http | `@anthropic-ai/sdk` (1 file) | analyst, writer (⇢ types), platform (→ factory) | vendor HTTPS | `platform.ts:112` | ACTIVE (1 of 4 proven) | the only AI in the system |
| `lib/design/` | visual decision engine | 8 files, 3,291 loc | **none — zero external deps** | `designAgent`, `lib/render`, 4 scripts | nothing | `designAgent:21`, `render/*`, scripts | ACTIVE | where "how it looks" is decided |
| `lib/render/` | content+design → static site | 13 files, 5,650 loc | `lib/design` ⇢, `lib/types` ⇢ | `main.ts`, `writerAgent`, scripts | `node:fs` (write.ts only) | `main.ts:31`, `writerAgent:37-38` | ACTIVE | the deliverable |
| `lib/platform/` | pluggable capability layer | providers + skills + MCP + telemetry | `lib/ai/factory` | `main.ts`, `discoveryAgent` | `lib/ai`, `fetch` (MCP) | `main.ts:30`, `discoveryAgent:21` | **PARTIAL — providers live, skills 0/38, MCP 0 servers** | intended extension point |
| `scripts/` | dev tooling | 10 files, 3,576 loc | `playwright`, `lib/*` | humans | `lib/*`, `npm run dev` | **nobody (0 internal callers)** | DEV-ONLY | the QA harness, outside the product |
| `test/` | node:test suites | 21 files | `lib/design`, `lib/render` | `npm test` | those two only | `npm test` | ACTIVE but **narrow** | covers the deterministic half only |
| `docs/` | reference | 9 files | — | humans | — | — | **PARTIAL — see §19** | the drift risk |
| `assets/fonts/` | vendored typefaces | 34 woff2 + manifest | — | `render/write.ts:113` | — | `write.ts`, `fontManifest.ts` | ACTIVE | why 18 families now reach a page |
| `output/` | run artifacts | `.gitkeep` only | — | every agent | — | agents, `main.ts` | ACTIVE, empty | the memory that isn't |

#### 15.2 Every production source file

Columns: **AI** = makes a model call · **NET** = opens a network connection · **W/R** = writes/reads files · **SEC** = touches secrets.

| File | PURPOSE | INPUTS | OUTPUTS | CALLERS | CALLEES | AI | NET | W/R | SEC | STATUS |
|---|---|---|---|---|---|---|---|---|---|---|
| `main.ts` | orchestrate 8 stages; CLI; run lifecycle; artifact persistence | `argv`, `AppConfig` | `PipelineResult`, `output/<runId>/*.json`, `site/` | **entrypoint** | all 7 agents, `config`, `logger`, `browser`, `platform`, `render`, `errors` | no | no | **W** `mkdir/writeFile/rename`; **R** `readFile/access` | no | ACTIVE |
| `agents/discoveryAgent.ts` | Maps URL → identity | `DiscoveryInput` | `DiscoveryResult`, `discovery.json` | `main.ts:336` | `browser`, `logger`, `config`, `platform`, `errors` | **no** | **`page.goto`** → Maps | W `discovery.json` | no | ACTIVE |
| `agents/collectorAgent.ts` | crawl the business's own site | `DiscoveryResult` | `CollectedBusiness`, `collector.json`, `content.md`, `assets/*` | `main.ts:339` | `browser` ⇢, `logger` ⇢, `config` ⇢ | **no** | **`page.goto`** → arbitrary third-party host | W json/md/images | no | ACTIVE |
| `agents/normalizerAgent.ts` | merge + dedupe + validate | discovery + collected | `BusinessProfile` (per-field provenance), `business.json` | `main.ts:342` | `errors`, `logger` ⇢, `crypto` | no | **no** | W `business.json` | no | ACTIVE |
| `agents/businessAnalystAgent.ts` | strategy + module recommendations | `BusinessProfile` | `BusinessStrategy`, `strategy.json` | `main.ts:345` | `errors`, `ai/types` ⇢, `config` ⇢ | **YES (call #1)** | via provider | W `strategy.json` | via `platform.ai()` | ACTIVE |
| `agents/writerAgent.ts` | copy + **fact re-injection** + grounding | profile + strategy | `WebsiteContent`, `content.json` | `main.ts:348` | `errors`, **`render/fontManifest`**, **`render/site`**, `ai/types` ⇢ | **YES (call #2)** | via provider | W `content.json` | via `platform.ai()` | ACTIVE |
| `agents/designAgent.ts` | thin wrapper: read flag, call `composeDesign`, log notes | profile+strategy+content | `WebsiteDesign` | `main.ts:351` | `design/index` | **no** | no | no | reads `config.features` | ACTIVE (**latent bug**, §45) |
| `agents/lovableAgent.ts` | *intended* deploy | `WebsiteContent` | — | `main.ts:360` | `errors` | no | no | no | `LOVABLE_API_KEY` read, never used | **BROKEN — throws `:33`** |
| `lib/config.ts` | typed config; **the only `process.env` reader** | `process.env` | `AppConfig` | `main.ts`, `discoveryAgent`, agents ⇢ | `errors`, `ai/types` ⇢ | no | no | no | **reads all keys; never logs them** | ACTIVE |
| `lib/types.ts` | domain contracts, `AgentContext`, `Agent<I,O>` | — | types | everything | — | no | no | no | no | ACTIVE |
| `lib/errors.ts` | `AgentError` taxonomy with `retryable` | — | error classes | everything | — | no | no | no | no | ACTIVE |
| `lib/logger.ts` | NDJSON + console sinks, scoped, `time()` | log records | stderr + `run.log.ndjson` | `main.ts`, agents ⇢ | `node:fs` | no | no | **W** `createWriteStream` | no | ACTIVE |
| `lib/browser.ts` | Playwright abstraction | `BrowserConfig` | `BrowserSession`/`PageHandle` | `main.ts`, discovery, collector ⇢ | `playwright`, `errors` | no | **`page.goto`, `context.request`** | no | no | ACTIVE (`screenshot` unused) |
| `lib/ai/types.ts` | `AIProvider` + `ProviderAdapter` contracts | — | types | factory, adapters, analyst ⇢, writer ⇢ | `config` ⇢, `logger` ⇢ | no | no | no | no | ACTIVE |
| `lib/ai/factory.ts` | select provider, check credential, **retry+jitter**, status board | `AiConfig` | `AIProvider` | `platform.ts:112`, `ai/index` (orphan) | `providers/index`, `errors`, `telemetry` | no | no | no | **resolves API keys** | ACTIVE |
| `lib/ai/protocol.ts` | `postJson`, `decodeStructured`, effort mapping, truncation checks | request | validated object | 3 fetch adapters | `http`, `schema`, `errors` | no | **`fetch`** | no | headers | ACTIVE |
| `lib/ai/schema.ts` | JSON-Schema→Gemini dialect; recover JSON from prose; **recursive local validator** (`:173`) | schema + text | object or problems | `protocol`, `gemini` | `errors` | no | no | no | no | ACTIVE |
| `lib/ai/http.ts` | wall-clock budget without discarding run signal; credential probe | request | response | `protocol`, all fetch adapters | `errors` | no | **`fetch`** | no | headers | ACTIVE |
| `lib/ai/providers/index.ts` | `ADAPTERS` table — the whole extension surface | — | table | `factory:26` | 4 adapters | no | no | no | no | ACTIVE |
| `…/anthropic.ts` | SDK, streaming, adaptive thinking, refusal/truncation handling | request | result | `providers/index` | `@anthropic-ai/sdk`, `protocol`, `errors` | **serves** | **`client.beta.messages.stream`, `client.models.list`** | no | `ANTHROPIC_API_KEY` | ACTIVE |
| `…/openai.ts` | fetch adapter | request | result | `providers/index` | `protocol`, `http`, `errors` | serves | `postJson` | no | `OPENAI_API_KEY` | **REAL, UNPROVEN** |
| `…/gemini.ts` | fetch adapter; schema translated, response validated vs **original** | request | result | `providers/index` | `protocol`, `schema`, `http` | serves | `postJson` | no | `GEMINI_API_KEY` (header, never query) | **REAL, UNPROVEN** |
| `…/openrouter.ts` | fetch adapter + attribution headers | request | result | `providers/index` | `protocol`, `http` | serves | `postJson` | no | `OPENROUTER_API_KEY` | **REAL, UNPROVEN** |
| `lib/ai/index.ts` | *claims* to be the agents' import surface | — | re-exports | **NOBODY** | `factory`, `types`, `providers/index` | no | no | no | no | **DEAD ORPHAN (§38)** |
| `lib/design/compose.ts` | **the decision pipeline**: industry→direction→mood→tokens→layout | profile+strategy+content | `WebsiteDesign` | `design/index`, tests | `industries`, `themes`, `tokens`, `layout`, `color` | **no** | no | no | no | ACTIVE |
| `lib/design/industries.ts` | 16 keyword rules + 17 defaults + `emphasisFor` | classify input | `ClassifyResult`, `IndustryDefaults` | `compose`, `layout`, `hue-report`, tests | `types` ⇢ | no | no | no | no | ACTIVE |
| `lib/design/themes.ts` | 11 hand-authored directions | direction | `ThemeDefinition` | `compose`, `tokens`, `layout`, scripts | `types` ⇢ | no | no | no | no | ACTIVE |
| `lib/design/layout.ts` | hero veto walk, variant scoring, frame anti-repeat, background rhythm, industry reorder | content+industry+theme+density | `LayoutPlan` | `compose` | `industries`, `themes` ⇢ | no | no | no | no | ACTIVE |
| `lib/design/tokens.ts` | type scale, spacing, radius, elevation, motion, **colour system** | theme+brand+density | token sets | `compose` | `color`, `themes` ⇢ | no | no | no | no | ACTIVE (`scheme` hard-coded, §38) |
| `lib/design/color.ts` | OKLCH mathematics, rounded to 8-bit for cross-platform determinism | seed hue, targets | ramps + contrast | `tokens`, `compose`, tests | none | no | no | no | no | ACTIVE |
| `lib/design/types.ts` | every design type | — | types | all design + render | — | no | no | no | no | ACTIVE |
| `lib/design/index.ts` | public surface | — | re-exports | `designAgent:21`, render, scripts, tests | the 7 above | no | no | no | no | ACTIVE |
| `lib/render/site.ts` | `renderSite` (pure) + `assignIds` | content + design? | `RenderedSite` | `render/index`, **`writerAgent:38`** | `document`, `sections`, `css`, `assets`, `fonts`, `theme` | no | no | **no** | no | ACTIVE |
| `lib/render/document.ts` | `<head>`, header, nav, footer, JSON-LD, root `data-*` | content+sections+design | `Html` | `site` | `html`, `assets` | no | no | no | no | ACTIVE |
| `lib/render/sections.ts` | one section → one `<section>`; **22 render functions** | section + `SectionDesign` | `Html` | `site` | `html`, `assets` | no | no | no | no | ACTIVE |
| `lib/render/variants.ts` | design-driven CSS: heroes, variants, grid, cards, buttons, footers, motion | design | CSS string | `css.ts:13` | `design/types` ⇢ | no | no | no | no | ACTIVE |
| `lib/render/css.ts` | base sheet + token block | theme + design | CSS string | `site` | `variants`, `fonts` | no | no | no | no | ACTIVE |
| `lib/render/theme.ts` | **CSS-injection guard**: validate model-written colours/fonts | `BrandVoice` | `Theme` + warnings | `site`, tests | `types` ⇢ | no | no | no | no | ACTIVE |
| `lib/render/html.ts` | **branded `Html`**, escaping, `jsonLd` | strings | `Html` | document, sections, assets | none | no | no | no | no | ACTIVE |
| `lib/render/assets.ts` | `safeHref`/`safeImageUrl`, asset placement | urls, images | safe urls, `AssetPlan` | document, sections, site | `types` ⇢ | no | no | no | no | ACTIVE |
| `lib/render/fonts.ts` | `@font-face` for the faces a design uses | design | CSS + `FontAsset[]` | `css`, `site` | `fontManifest` | no | no | no | no | ACTIVE |
| `lib/render/fontManifest.ts` | **GENERATED** face table | — | `VENDORED_FACES` | `fonts`, **`writerAgent:37`** | — | no | no | no | no | ACTIVE |
| `lib/render/write.ts` | **the only filesystem writer**; path-escape guard `:57` | `RenderedSite` | files on disk | `main.ts`, `render/index`, scripts | `node:fs`, `node:url` | no | no | **W** `writeFile/mkdir/copyFile` | no | ACTIVE |
| `lib/render/types.ts` | renderer contract + options | — | types | all render | — | no | no | no | no | ACTIVE |
| `lib/render/index.ts` | public surface | — | re-exports | `main.ts:31`, scripts, tests | the 12 above | no | no | no | no | ACTIVE |
| `lib/platform/platform.ts` | wire providers+skills+MCP into one object | `AppConfig` | `Platform` | `main.ts:30`, `discoveryAgent:21` | `ai/factory`, skills, mcp, telemetry, `config` | no | no | no | **`describe()` returns credential NAMES only `:223`** | ACTIVE |
| `lib/platform/types.ts` | `CapabilityOutcome`, `HealthReport`, metrics | — | types | all platform | — | no | no | no | no | ACTIVE |
| `lib/platform/telemetry.ts` | latency/error/availability, bounded ring buffer, **in-process only** | call events | metrics | platform, factory, managers | `logger` ⇢ | no | no | no | no | **PARTIAL — discarded on exit** |
| `…/skills/types.ts` | `Skill` contract + `SkillNotImplementedError` | — | types | all skills | — | no | no | no | no | ACTIVE |
| `…/skills/registry.ts` | validated id→impl map | descriptors | registry | `manager` | `types` | no | no | no | no | ACTIVE (registry of stubs) |
| `…/skills/loader.ts` | built-ins + dynamic `*.skill.ts` import | dirs | descriptors | `platform:127` | `builtin/index` | no | no | **R** dir scan | no | ACTIVE (**ACE path, §44**) |
| `…/skills/manager.ts` | policy, `blockingReason` ladder `:136`, timeouts, telemetry | registry+config | `CapabilityOutcome` | `platform:122` | registry, loader, telemetry | no | no | no | credential presence checks | ACTIVE, **never called by an agent** |
| `…/skills/placeholder.ts` | honest-stub factory: `0.0.0`, `unavailable`, throws | spec | `AnySkill` | all 8 category files | `types` | no | no | no | no | ACTIVE (by design) |
| `…/skills/builtin/*.ts` (9) | 38 reserved ids in 8 categories | — | placeholders | `builtin/index` | `placeholder` | declared | no | no | declared | **STUB ×38** |
| `…/mcp/types.ts` | `MCPConnector` contract | — | types | manager, connectors | — | no | no | no | no | ACTIVE |
| `…/mcp/manager.ts` | routing, policy, capability cache, cross-server search | connectors+config | `CapabilityOutcome` | `platform:145` | connectors, telemetry, `stdioConnector` (error type) | no | no | no | credential checks | ACTIVE, **0 servers** |
| `…/mcp/httpConnector.ts` | JSON-RPC 2.0 / Streamable HTTP + SSE | server config | tool results | `platform:169` | `fetch` | no | **`fetch`** | no | `headers` from config | **REAL, UNPROVEN** |
| `…/mcp/stdioConnector.ts` | *intended* stdio transport | — | throws | `platform:154` | — | no | no | no | no | **STUB `:70`** |

#### 15.3 Traced relationships worth naming

**FACT — the writer reaches into the renderer.** `writerAgent.ts:37-38` imports `VENDORED_FACES` from `lib/render/fontManifest.js` and `assignIds` from `lib/render/site.js`. Both uses are principled — the font enum constrains `CONTENT_SCHEMA` to faces that can actually be served (`:132-134`), and `assignIds` guarantees a CTA anchor resolves to a section that will exist (`:1074-1087`, with the reasoning spelled out). But it means **stage 5 is not independent of the render layer.** `PROJECT_STATUS.md:19-20` says "No agent imports another; each is replaceable and runnable alone" — true about *agents*, and the writer is nonetheless coupled to a downstream library.

**FACT — `discoveryAgent` is the only self-bootstrapping agent.** It imports `createBrowserSession`, `createLogger`, `loadConfig` and `createPlatform` as **values** (`:18-21`) to support `discoverStandalone` (`:721`). Every other agent imports `lib/config`, `lib/logger` and `lib/browser` **type-only**. That is a deliberate documented feature (`:714-719`) and it makes discovery the heaviest agent by dependency.

**FACT — the platform is built for every run and used by two stages.** `main.ts:94` awaits `createPlatform` eagerly (skill discovery must finish before stage 1). Only `businessAnalystAgent:368` and `writerAgent:1047` ever call it, both `ctx.platform.ai()`. `platform.skills` and `platform.mcp` are **never touched by any agent** — verified by grep across `agents/`.

**FACT — corrected from the prior audit.** My first pass flagged four `process.env` readers. Re-checked: `lib/platform/skills/types.ts:38` and `lib/types.ts:22` are **docstring prose**, and `test/support/snapshot.ts:20` is a test helper reading `UPDATE_SNAPSHOTS`. **Production code has exactly one reader — `lib/config.ts:480` — and it takes `env` as a default parameter, which is the right pattern. The documented invariant holds.**

### 16. Agent / worker map

**FACT.** 7 agents, all conforming to `Agent<I,O>` (`lib/types.ts`), all reached only from `main.ts`.

| # | Stage | Agent | I → O | Artifact | Model | Browser | Blocking? |
|---|---|---|---|---|---|---|---|
| 1 | `discovery` | `discoveryAgent` | `DiscoveryInput` → `DiscoveryResult` | `1-discovery.json` | no | **yes** | yes — fatal without a name |
| 2 | `collect` | `collectorAgent` | discovery → `CollectedBusiness` | `2-collected.json` | no | **yes** | no — thin profile is tolerated |
| 3 | `normalize` | `normalizerAgent` | both → `BusinessProfile` | `3-profile.json` | no | no | yes |
| 4 | `analyze` | `businessAnalystAgent` | profile → `BusinessStrategy` | `4-strategy.json` | **yes** | no | yes |
| 5 | `write` | `writerAgent` | profile+strategy → `WebsiteContent` | `5-content.json` | **yes** | no | yes |
| 5b | `design` | `designAgent` | all three → `WebsiteDesign` | `5b-design.json` | **no** | no | no — renderer falls back |
| — | `render` | *not an agent* | content+design → files | `site/` | no | no | yes |
| 6 | `deploy` | `lovableAgent` | content → `DeploymentResult` | *never written* | no | no | **THROWS** |

**Roles the target architecture needs and that have no code at all (FACT):** Factory Manager, Evidence Worker, Creative Director, Experience Architect, Content Planner, Asset Worker, Motion Worker, 3D Worker, QA Worker, Visual Critic, Repair Worker, Security Worker, SEO Worker, Accessibility Worker, Cost Controller, Memory Worker, Knowledge Worker. **17 of the 20 workers in your Phase 12 list do not exist.**

### 17. Provider map

Covered in §4. One structural note (FACT): the extension surface is exactly three edits — `providers/<vendor>.ts` exporting a `ProviderAdapter`, one name in `AI_PROVIDER_NAMES` (`ai/types.ts:20`), one line in `ADAPTERS` (`providers/index.ts`). `API_KEY_VARIABLES` is **derived** from the adapter table (`factory.ts:43-45`) rather than restated, so a new provider cannot ship with a misspelled credential variable. That is a good design detail.

### 18. Tool map

| Tool | Where | Used by | Real? |
|---|---|---|---|
| Playwright Chromium | `lib/browser.ts` | stages 1–2, 2 dev scripts | **REAL** |
| Anthropic SDK | `ai/providers/anthropic.ts` | stages 4–5 | **REAL** |
| `fetch` (3 vendors) | `ai/http.ts`, `ai/protocol.ts` | stages 4–5 | REAL, unproven |
| `fetch` (MCP JSON-RPC) | `mcp/httpConnector.ts` | nothing | REAL, unproven, **0 servers** |
| `fetch` (font vendoring) | `scripts/vendor-fonts.ts` | human, author-time | REAL |
| `spawnSync` | `scripts/batch-audit.ts` | human | REAL (dev only) |
| `node:crypto` SHA-256 | collector, normalizer | image/text dedupe | REAL |
| axe / Lighthouse / W3C validator | — | — | **ABSENT** |
| image processing (sharp etc.) | — | — | **ABSENT** |
| deployment SDK | — | — | **ABSENT** |

### 19. Knowledge / documentation map

9 docs, 1,578 loc. **You told me not to assume documentation is correct. I checked every numeric and structural claim I could.**

| Doc | LOC | Subject | Accuracy |
|---|---|---|---|
| `docs/architecture.md` | 126 | stages, platform, testing table | **STALE.** `:112` "110 assertions" — actual **248**. Contains **one** occurrence of the word "design" — the entire `lib/design/` layer (8 files, 3,291 loc) is essentially absent. |
| `docs/folder-structure.md` | 98 | tree + "where to add things" | **STALE, worst offender.** **Zero** occurrences of "design". Lists `lib/` as `browser/config/logger/errors/types` only. Also points `BULLET_LAYOUTS` at `lib/types.ts`; it lives at `lib/render/sections.ts:49`. |
| `docs/renderer.md` | 312 | renderer contract | **MOSTLY GOOD, stale count.** `:296` "245 assertions. Five suites in `test/render/`" — there are **six** suites in `test/render/` plus five in `test/design/`, 248 total. |
| `docs/design-intelligence-review.md` | 322 | the design critique | **HALF STALE.** Its §4 "Top 10 improvements": **#1 variant classes, #2 `layout.order`, #3 fonts, #4 hero variants, #6 computed columns are DONE** (re-verified §29). **#5, #7, #8, #9, #10 remain true.** The doc never says which. |
| `docs/providers.md` | 132 | provider layer | consistent with code (spot-checked) |
| `docs/skills.md` | 154 | skill contract + 38 ids | consistent — states the placeholder truth |
| `docs/mcp.md` | 134 | MCP contract + config | consistent — states stdio is unimplemented |
| `docs/configuration.md` | 129 | env reference | consistent with `config.ts` (spot-checked) |
| `docs/developer-guide.md` | 171 | setup/workflow | consistent |
| `PROJECT_STATUS.md` | 196 | status | **3 defects:** `:178-180` "No web fonts" (false — 34 woff2 shipped, `@font-face` emitted); `:192` "Only the renderer is tested… 110 assertions"; `:53` "stage 4 ✅ verified live" vs `:151` "Stage 4's live call has never run" — **self-contradiction in one file.** |
| `README.md` | 527 | overview | `:3` "one deployed website out" — **false**, deploy throws. |
| `NEXT_SESSION.md` | 87 | handoff | `:10` "The pipeline works end to end" — **false**. Contains the best commercial insight in the repo (§43). |
| `ROADMAP.md` | 111 | M1–M5 | **accurate**, and `:36-50` already specifies the deployment fix correctly. |

**No knowledge base, no exemplar library, no prompt registry, no decision log exists.** Design rationale lives in source comments — genuinely high quality, and invisible to any tool.

---

## PART III — CAPABILITY FORENSICS (sections 20–37)

### 20. Go Sweet forensic reconstruction

**CANNOT BE PERFORMED. UNKNOWN.**

Evidence gathered: `grep -ri` for `go sweet`, `gosweet`, `go-sweet` across all 168 tracked files and the full git history — **zero matches**. `output/` contains only `.gitkeep`. `.gitignore:11` excludes `output/*`, so no run artifact was ever committed. `git log` shows 8 commits, none referencing it.

There is no `1-discovery.json`, no `5-content.json`, no `5b-design.json`, no `site/`, no screenshot and no log line to reconstruct from. I will not infer what the pipeline "would have" produced — that would be fabrication.

**To fill:** on the laptop, `Get-ChildItem C:\Users\40728\WebsiteAgent\output -Recurse -Filter "*.json" | Select FullName,Length,LastWriteTime`, then supply the run folder. With `1-discovery.json` + `3-profile.json` + `5-content.json` + `5b-design.json` I can reconstruct the run completely, including which claims were grounded.

### 21. River Park Events forensic reconstruction

**CANNOT BE PERFORMED. UNKNOWN.** Same evidence, same zero matches for `river park` / `riverpark`.

**What I can still state precisely (FACT), because it is a property of the code rather than of that run:** the mechanism by which "River Park Events" could acquire a river is present and undefended.
- `writerAgent.ts:314` puts `Name: <business name>` in the brief.
- `:229-240` forbids awards, founding dates, prices, staff counts, certifications, amenities, testimonials and contact details in prose. **It does not forbid inferring a property of the place from the place's name.**
- `:274` actively requests "the neighbourhood, the nearest cross street, what the category means in practice".
- `groundingWarnings` (`:917-967`) matches only emails (`EMAIL_IN_TEXT`), URLs (`URL_IN_TEXT`) and 9+-digit runs (`DIGIT_RUN`). "Set beside the water" contains none of the three and **passes silently.**

So the vulnerability is confirmed structurally even though the specific run is unrecoverable.

### 22. Existing generated artifacts

**FACT.** In the repository: **none.** `output/` holds `.gitkeep`.

What a run *would* write (from `main.ts:188-197` plus each agent's own `ARTIFACT` const):

```
output/<runId>/
├── run.log.ndjson       logger.ts (createWriteStream)
├── 1-discovery.json     main.ts persistStage    + discovery.json  (agent's own copy)
├── 2-collected.json     main.ts                 + collector.json, content.md
├── 3-profile.json       main.ts                 + business.json
├── 4-strategy.json      main.ts                 + strategy.json
├── 5-content.json       main.ts                 + content.json
├── 5b-design.json       main.ts
├── assets/              collectorAgent (downloaded images)
├── site/
│   ├── index.html
│   ├── styles.css
│   ├── assets/…         copied images
│   └── assets/fonts/…   copied woff2
├── 6-deployment.json    NEVER WRITTEN (deploy throws)
└── result.json          NEVER WRITTEN (unreachable)
```

**FACT — a redundancy worth noting:** every agent writes its own artifact *and* `main.ts` persists the same value under a numbered name. So each of stages 1–5 produces **two copies** of its output under different filenames. Nothing reads the agents' own copies — `readArtifact` (`main.ts:222`) reads only the numbered ones.

**Artifacts I generated this session (gitignored, inspectable):** `output/examples/` — 51 sites + `index.html` + `comparison.md`, from `scripts/generate-examples.ts`.

### 23. Existing prompts / instructions

**FACT — the complete inventory is two prompts and two schemas, all hard-coded:**

| Artefact | Location | Size | Notable content |
|---|---|---|---|
| Analyst system prompt | `businessAnalystAgent.ts:154-162` | ~9 lines | "produce strategy, not implementation"; "Ground every recommendation in the profile"; "Recommend what this business can deliver" |
| `STRATEGY_SCHEMA` | `businessAnalystAgent.ts:97-148` | ~50 lines | `businessName`, `category{primary,secondary,rationale,basis}`, `goals[]`, `audience{primary,secondary[]}`, `pages[]`, `features[]`, `backendModules[]`, `frontendModules[]`, `seoPriorities[]`, `openQuestions[]` — each recommendation carrying `title`/`rationale`/`priority`/`evidence[]` |
| Writer system prompt | `writerAgent.ts:227-275` | ~49 lines | "THE ONE RULE" + 8-item prohibition list; "WRITE LIKE A PERSON" + 15-phrase banned lexicon; section-by-section structure guidance; "NEVER SAY THE SAME THING TWICE" with a **worked negative example** (`:260-267`); thin-profile protocol |
| `CONTENT_SCHEMA` | `writerAgent.ts:164-221` | ~57 lines | **Notable for absences:** no image field, no telephone, no address, no href, no structured-data field (`:161-163` explains why) |

No prompt file, no template directory, no prompt versioning, no prompt tests, no externalisation. **INFERENCE:** these four artefacts encode most of the product's actual intelligence and are the least inspectable, least testable part of the system.

### 24. Existing automation

**FACT.**

| Automation | Present? |
|---|---|
| CLI pipeline with resumable stages | **YES** — `main.ts`, `--from` |
| Idempotent stage persistence (temp+rename) | **YES** — `main.ts:146-152` |
| SIGINT → `AbortSignal` propagation | **YES** — `main.ts:85-87`, honoured in browser and providers |
| Provider retry with jittered backoff | **YES** — `factory.ts:126-155` |
| Batch generation + measurement | **YES, dev only** — `scripts/batch-audit.ts` |
| CI / GitHub Actions | **NO** — no `.github/` directory |
| Scheduler / cron / queue | **NO** |
| Webhook / trigger / HTTP endpoint | **NO** |
| Retry across stages | **NO** — `retryable` is reported and unconsumed |
| Approval gate | **NO** |
| Notification | **NO** |

### 25. Existing deployment capability

**FACT: none.** `lovableAgent.run` throws (`:33`). No deployment SDK, no upload code, no host client. `LovableConfig` (`config.ts:158-165`) parses `LOVABLE_API_KEY`, `LOVABLE_BASE_URL`, `LOVABLE_PROJECT_ID`, `LOVABLE_DEPLOY_TIMEOUT_MS`; none is ever read.

**What is ready for it (FACT, and this is the good news):** `RenderedSite` (`render/types.ts`) is `{files: RenderedFile[], assets: RenderedAsset[], fonts: RenderedFont[], warnings}`. `RenderedFile` is `{path, contents}` — **in-memory, no filesystem required.** `render/types.ts:5-6` states the intent explicitly: "a deployment stage that uploads the same array without a file ever existing." The contract for deployment already exists and is correct; only the uploader is missing.

### 26. Existing backend capability

**FACT: none generated.** The analyst emits `backendModules[]` with `layer`, `dependsOn`, `rationale`, `evidence`, `priority` (`businessAnalystAgent.ts:129-132`). **Nothing consumes it** — the writer reads only `features[].title` into a prose line (`writerAgent.ts:366`); the renderer never sees strategy at all.

No forms, no server, no database, no auth, no API routes in the output. **`database` and `authentication` are placeholder skills.**

**INFERENCE, and it is a notable one:** the system *already decides* what backend a business needs, with reasoning and evidence, and then throws that decision away. Wiring `backendModules[]` into a Capability Requirements Document is cheap because the analysis is already being paid for.

### 27. Existing security capability

**Split cleanly: output security is strong, pipeline security is weak.**

**Output security — REAL (FACT):**
- Branded `Html` type — a plain `string` is not accepted as markup (`html.ts:15-18`). XSS becomes a type error.
- `escapeText` (`&<>`) and `escapeAttribute` (+`"'`) (`html.ts:50-68`).
- `jsonLd` escapes `<`, `>`, `&` so `</script>` cannot close its element (`html.ts:204-212`).
- `safeHref` / `safeImageUrl` reject non-allowlisted schemes (`assets.ts:49-56`); tested against `javascript:`, `JavaScript:`, `vbscript:`, `data:text/html` (`test/render/assets.test.ts:44-51`).
- `theme.ts` validates model-written colour and font strings before interpolation — the docstring names the exact attack (`:5-7`).
- `resolveInside` path-escape guard + `path.basename` on font names (`write.ts:57-61, 113`).
- CTA targets are a closed enum resolved from the profile (`writerAgent.ts:119-127, 847-878`) — a model cannot emit an arbitrary href.
- **No code generation anywhere.** No `eval`, no `new Function`, no generated JS. Verified by grep.

**Pipeline security — WEAK (FACT):**
- **No SSRF protection.** `toAbsolute` (`collectorAgent.ts:94-103`) checks scheme only (`:98`). Zero occurrences of `localhost`, `127.0.0`, `169.254`, `10.`, `192.168`, `::1` anywhere in the repo.
- **No prompt-injection defence.** Scraped text interpolated raw with length truncation only (`writerAgent.ts:350-355`, `businessAnalystAgent.ts:235-238`). Zero hits for `sanitiz|sanitis|injection|untrusted` in `agents/` or `lib/ai/`.
- **`SKILLS_DIR` dynamic import** is an operator-controlled arbitrary-code-execution path (`skills/loader.ts`).
- No content-type check before writing a downloaded "image"; no total-byte budget (40 × 8 MB possible).
- **Secrets hygiene: GOOD.** One `process.env` reader; `platform.describe()` returns names only (`platform.ts:223`); `.env` gitignored; scan for `sk-`, `sk-ant-`, `AIza` patterns — **clean**; `npm audit` — **0 vulnerabilities**.

`security-scanning` is a placeholder skill.

### 28. Existing QA capability

**FACT: measurement exists; a verdict does not.**

| Layer | Present |
|---|---|
| Unit/snapshot tests | **248 passing**, `test/design/` (5 suites) + `test/render/` (6 suites) |
| Coverage-by-perturbation | **`scripts/renderer-coverage.ts`** — mutates each design leaf, re-renders, diffs. Ran it: **132 visual fields, 127 USED, 5 PARTIAL, 0 IGNORED = 98.1%** |
| DOM measurement | **`scripts/batch-audit.ts:114-144`** — broken images, horizontal overflow, header height, h1 size/font, per-section height/words/images, CTA counts, external-CTA counts |
| Screenshots | desktop-fold, desktop-full, mobile — **dev scripts only** |
| Thresholds / pass-fail gate | **NONE** |
| Visual critic | **NONE** |
| Repair loop | **NONE** |
| axe / Lighthouse / W3C validation | **NONE** |
| Qualitative scorecard | **`output/scores.json` is READ by `build-review.ts:4` and written by nothing.** INFERENCE: hand-authored. |

**Coverage gap (FACT, re-verified by import graph):** zero tests import `agents/`, `lib/ai/`, `lib/platform/`, `lib/browser.ts`, `lib/config.ts` or `main.ts`. The tested half is the pure half; the untested half is the half touching network, filesystem and secrets.

### 29. Existing design capability

**FACT — and I re-verified the five previously-reported fixes rather than trusting them.**

| Claim | Verification method | Result |
|---|---|---|
| Variant classes reach the DOM | grep class attrs in 51 generated sites | **TRUE** — `section section--gallery section--grid`, `section--services section--feature-grid` |
| Variants are **markup**, not class names (`sections.ts:11-14`) | parsed DOM tag-skeletons per variant | **TRUE.** `feature-grid` → `ul>li>span+h3`; `list` → `ul>li>span+a`; `quotes` → `ul>li>figure>blockquote`; `banner` → flat `h2+p+p+a`; `stack` → `h2+p`. **Genuinely different trees.** |
| `layout.order` honoured | compared `design.json` plan order to DOM order, hotel | **TRUE** — identical: `hero→gallery→services→about→location→testimonials→contact` |
| Frames + emphasis emitted | grep `data-*` | **TRUE** — `data-frame` ∈ {aside, centered, offset, stacked, statement}; `data-emphasis` ∈ {lead, primary, secondary, quiet}; `data-variant` present |
| Computed columns used | grep `--columns` vs `auto-fit` | **TRUE** — 7 `--columns`, 4 residual `auto-fit` |
| Web fonts shipped | count `@font-face` + woff2 in output | **TRUE** — hotel site: 5 `@font-face`, 5 woff2 (`cormorant-garamond-300/400/500`, `jost-300/400`) |

**The new quantitative finding — variant *distribution*, measured across all 51 sites:**

| Variant | Uses | | Variant | Uses |
|---|---|---|---|---|
| `contact--list` | **50** (98%) | | `services--list` | 4 |
| `hero-split` | **32** (63%) | | `hero-editorial` | 3 |
| `gallery--grid` | 32 | | `hero-centered` | 3 |
| `hours--list` | 27 | | `gallery--masonry` | **3** |
| `services--cards` | 26 | | `about--split` | 3 |
| `testimonials--quotes` | 23 | | `services--bento` | **2** |
| `about--stack` | 18 | | `hero-minimal` | **2** |
| `hero-full-bleed` | 11 | | | |

**INFERENCE — this refines the earlier "template" diagnosis materially.** The rich vocabulary is **real and implemented**; it is **starved**. `bento` fires twice in 51 sites and `masonry` three times, because `supports()` (`layout.ts:130-164`) gates them behind content thresholds — bento needs ≥5 bullets, masonry ≥4 images — that most generated content never meets. Meanwhile 63% of sites take `hero-split`. So the collision is **not** "the renderer can only draw one thing"; it is "the *content* is too thin and too uniform to unlock the compositions that exist." That points the fix upstream, at the writer and the asset pipeline, not at the renderer.

**Also confirmed still broken:** `scheme` hard-coded `'light'` (`tokens.ts:241`) so all 51 sites are light and `premium`'s "Dark ground" description (`themes.ts:365`) is false in effect; `.section__subheading` hard-coded `clamp(1.0625rem, 1rem + 0.4vw, 1.25rem)` regardless of direction; `friendly.accentHueShift: 200` (`themes.ts:406`) still gives the bakery a periwinkle accent against honey gold; 17 industries with no `creative` slot, photography → `general`/`fallback`.

### 30. Existing media capability

**FACT.** **Selection and filtering: real and thoughtful. Creation and understanding: absent.**

Real (all in `writerAgent.ts`):
- `isUsablePhotograph` (`:764-777`) — rejects known map-tile hosts (`MAP_HOSTS :745-748`), exact 256/512 squares, and anything under 320px.
- `looksLikeProductShot` (`:739-742`) — demotes (does not drop) merchandise via `NOT_PHOTOGRAPHY` (`:733-736`): amazon, book, cover, cookbook, logo, icon, badge, sprite, placeholder, avatar, screenshot, gift card.
- `assignImages` (`:779-838`) — cursor-based so no image repeats; hero takes logo+favicon+lead; gallery takes up to `MAX_GALLERY_IMAGES = 12`; then one each to about/location/services/menu/testimonials.
- Collector finds images in `<img>`, lazy `srcset`/`data-src`, **and** resolved CSS `background-image` (`browser.ts:222-236`).
- Dedupe by CDN path **and** SHA-256 of bytes (normalizer).
- 34 vendored woff2 faces, latin subset, `font-display: swap`, only the faces a design uses.

Absent: image generation, vision/understanding, OCR, cropping, resizing, format conversion, compression, art-directed pairing, video, audio. **`vision`, `image-generation`, `ocr`, `speech` are placeholder skills.**

**FACT — the consequence, from the project's own batch:** 3 of 5 real businesses had no crawlable website → **zero images**. There is no fallback path.

### 31. Existing 3D capability

**FACT: none, and not even declared.** Zero occurrences of `webgl`, `three`, `gltf`, `glb`, `shader`, `canvas` as an HTML element, `<canvas>` or any 3D library across all 168 files. No placeholder skill reserves the capability.

Note for accuracy: `canvas` **does** appear ~40 times in `lib/design/` and `lib/render/` — as a **colour token name** meaning the page background (`--color-canvas`). It is not the HTML element. Anyone grepping for 3D capability will hit these and must not be misled.

### 32. Existing motion capability

**FACT: computed and published; almost nothing consumes it.**

Produced by the design layer: `tokens.motion.level` (`none|subtle|moderate|expressive`), `durationFastMs`, `durationBaseMs`, `durationSlowMs`, `easing`, `effects[]` drawn from `fade|rise|scale|stagger` (`themes.ts:78`), `respectReducedMotion`. `renderer-coverage` reports every one of these as **USED** — i.e. they are emitted as custom properties and reach the page.

What the page actually does with them (FACT, measured on generated CSS):
- **`@keyframes`: 0**
- `transition` declarations: **2** — skip-link `top` and a button background/border hover
- `animation` references: **2**, both inside the `prefers-reduced-motion` reset
- `<script>` tags: **1**, `application/ld+json` — data, not code
- IntersectionObserver: **absent**

**INFERENCE:** `fade`, `rise`, `scale` and `stagger` name entrance animations that require `@keyframes` + `animation`, or an observer. Neither exists. The motion vocabulary is fully plumbed to the page and terminates in nothing. This is the cheapest large perceptual gain available (§41).

### 33. Existing research capability

**FACT: strong for the listing and the site; nothing beyond them.**

Real: Maps resolution through short links, place URLs and search URLs (opens first result); EU consent interstitial **declined, never accepted** (`discoveryAgent.ts:490-516`); canonicalisation through a bare `ftid`/`place_id` URL to get a single-pane DOM (`:92-98`, with the two-`role=main` hazard documented); ordered selector-ladder extraction with per-field degradation to `null` (`firstOf :330-342`); hours parsed from aria-labels, week summaries and a two-column table fallback, with meridiem inheritance (`:203-241`); social-profile pattern matching that excludes share widgets and policy pages; site crawl ≤6 pages with `SKIP_PATH` filtering; **bot-wall detection that records and skips, never solves** (`collectorAgent.ts:78-83`).

Absent: Places API (`google-maps` is a placeholder skill), review text harvesting, competitor research, keyword research, market data, third-party enrichment, JS-rendered-site handling (the acknowledged P0 in `NEXT_SESSION.md`), and any re-use of prior research.

### 34. Existing memory capability

**FACT: none across runs.** No `designMemory` — grep confirms it does not exist. Telemetry is a **bounded in-process ring buffer**, discarded at exit (`telemetry.ts:5-6` says so). Artifacts are local files under a gitignored directory with no index. Every run is fully cold: the same business re-scraped from scratch, with no knowledge of any previous output.

**Within a run**, memory is genuinely good: 7 stage artifacts + `--from` resumption + structural validation on read-back (`ARTIFACT_KEYS`, `main.ts:206-215`), with the cost rationale documented at `:158-167`.

**INFERENCE:** this is why the 8-way design collision (§39) cannot self-correct. Nothing knows the last retail site looked identical.

### 35. Existing observability

**FACT.** Real: `lib/logger.ts` — NDJSON file sink + console sink, per-run scope, `baseFields`, `logger.time()` spans, **stderr only so stdout stays clean for the CLI result** (`:6`). `lib/platform/telemetry.ts` — per-capability calls/failures/availability/latency (last/avg/p50/p95/max/samples, `platform/types.ts:203-219`). `platform.status()` — one row per provider, skill and MCP server with health, version, latency and errors. `CapabilityOutcome` — every capability call returns success-or-error rather than throwing.

Absent: metric export, tracing, dashboard, alerting, persistence, aggregation across runs, any way to see a run in progress from outside the terminal.

### 36. Existing cost tracking

**FACT: none.** `AITokenUsage {inputTokens, outputTokens}` (`ai/types.ts:54-57`) is captured by every adapter and logged at `debug` (`writerAgent.ts:1009-1016`, `businessAnalystAgent.ts:336-343`), then discarded. Grep for `cost|price|usd|budget` in `telemetry.ts`, `lib/ai/*` and `logger.ts` returns only unrelated prose plus `timeoutMs`/`thinkingBudget`. No pricing table, no per-run total, no cap, no ledger.

**INFERENCE:** `NEXT_SESSION.md:11`'s "$0.00 per site" is a statement about a free tier, not a measurement the system can produce — and it is inconsistent with `claude-opus-5` being the Anthropic default (`config.ts:252`). Cost control is a prerequisite for any repair loop or multi-candidate generation, because both multiply model calls.

### 37. Existing failure / recovery mechanisms

**FACT — better than most of this system, and unconsumed at the top.**

| Mechanism | Where | Real? |
|---|---|---|
| `AgentError` taxonomy with honest `retryable` | `lib/errors.ts` | **YES** |
| Provider retry, exponential + **full jitter**, aborts respected | `factory.ts:126-155` | **YES** |
| Refusal / truncation classified **non-retryable** | `anthropic.ts:143-155`, `protocol.ts` | **YES** |
| Per-field degradation to `null` rather than throwing | `discoveryAgent.ts:330-342` | **YES** |
| Renderer degrade-and-warn (`site.warnings`) | `render/*` | **YES** |
| Design compromise notes instead of throwing | `compose.ts:315-323` | **YES** |
| Missing asset reported, not fatal | `write.ts:44-48` | **YES** |
| Stage resumption after failure | `main.ts:317-327` | **YES** |
| SIGINT → `AbortSignal`, browser closed on abort | `main.ts:85`, `browser.ts:296` | **YES** |
| Teardown never masks the real error | `browser.ts:291`, `main.ts:381` | **YES** |
| **Retry across stages** | — | **NO** — `retryable` is honest and nothing above the provider consumes it |
| **Recovery from the deploy stub** | — | **NO** — unconditional throw, no catch |
| **Circuit breaker / dead-letter / parking** | — | **NO** |

---

## PART IV — ANALYSIS (sections 38–45)

### 38. Broken / unused / duplicate systems

| # | Item | Class | Evidence |
|---|---|---|---|
| 1 | `agents/lovableAgent.ts` | **BROKEN** | throws `:33`; executed and confirmed |
| 2 | 38 built-in skills | **STUB ×38** | all `definePlaceholders`; `execute` throws |
| 3 | `mcp/stdioConnector.ts` | **STUB** | throws `:70` |
| 4 | **`lib/ai/index.ts`** | **DEAD ORPHAN** | 24 loc, **zero importers** (import graph). Its docstring claims "Agents import from here and never from a provider file" — agents import `ai/types.js` **type-only** and get the instance from `ctx.platform.ai()`. Dead code **and** a false convention. |
| 5 | Dark colour scheme | **DEAD** | `ColorSystem.scheme: 'light'\|'dark'` (`design/types.ts:199`) with `'light'` hard-coded (`tokens.ts:241`); no CSS reads `[data-scheme]`; 51/51 sites light |
| 6 | `PageHandle.screenshot` | **UNUSED in product** | `browser.ts:240`; only dev scripts call it |
| 7 | `LovableConfig` (4 vars) | **UNUSED** | parsed `config.ts:552-557`, never read |
| 8 | `strategy.backendModules/frontendModules/pages/features` | **UNUSED** | produced with rationale+evidence; only `features[].title` reaches a prose line |
| 9 | `output/scores.json` | **MISSING PRODUCER** | read by `build-review.ts:4`, written by nothing |
| 10 | Agents' own artifacts (`discovery.json`, `collector.json`, `business.json`, `strategy.json`, `content.json`) | **DUPLICATE** | each stage writes its own copy *and* `main.ts` writes a numbered copy; only the numbered ones are read |
| 11 | `playwright` + `browser-automation` skills | **DUPLICATE** | real Playwright already works in `lib/browser.ts` |
| 12 | `deployment` + `lovable` skills | **DUPLICATE** | overlap the stub agent |
| 13 | `seo` skill | **DUPLICATE** | SEO metadata is really produced by the writer |
| 14 | 10 credentials in `.env.example` (`GOOGLE_MAPS_API_KEY`, `FIRECRAWL_API_KEY`, `CMS_API_KEY`, `EMAIL_API_KEY`, `PAYMENTS_API_KEY`, `CALENDAR_API_KEY`, `SOCIAL_API_KEY`, `SEARCH_API_KEY`, `DATABASE_URL`, `GITHUB_TOKEN`) | **UNUSED** | every capability they credential is a stub |
| 15 | `docs/folder-structure.md` | **STALE** | zero mentions of `lib/design`; wrong file for `BULLET_LAYOUTS` |
| 16 | MCP client subsystem (864 loc) | **UNUSED** | `MCP_SERVERS` commented out; no agent references `platform.mcp` |
| 17 | Skill subsystem (1,063 loc machinery) | **UNUSED** | `SKILLS_DIR` commented out; no agent references `platform.skills` |

### 39. Capabilities duplicated across tools

| Capability | BusinessForge | Session MCP | Verdict |
|---|---|---|---|
| Browser automation | **REAL** (`lib/browser.ts`) | Kernel `execute_playwright_code` | Keep local; Kernel only if QA needs to scale off-machine |
| Screenshots | REAL but **unused** in product | Kernel, Figma `get_screenshot` | **Use the local one first** — it already exists |
| Git/GitHub | placeholder skills | github MCP (**populated**) | **Delete the placeholders; use the MCP** |
| Design tokens | **REAL** (`lib/design/`, 3,291 loc) | Figma `get_variable_defs` | Keep local as the engine; Figma as an *input* for real brand systems |
| Image generation | placeholder | Canva `generate-design` | Canva is the only live path today |
| Brand assets | scrape-a-hex-from-page-text | Canva `list-brand-kits` | **MCP is materially better** and is a legitimate fact source |
| Docs/knowledge | none | Notion (**populated**) | MCP is the only option |
| Orchestration | 8 `await`s | Claude_Code_Remote `create_trigger`/`create_session` | MCP is a working scheduler today |
| Deployment | **STUB** | github `push_files` + Pages | **MCP is a viable P0 path** |

### 40. Capabilities we already own but aren't using

Ordered by value. Every one is built and paid for.

1. **A complete MCP client with nothing plugged in.** 864 loc across `manager.ts`, `httpConnector.ts`, `types.ts` — `initialize`, `tools/list`, `resources/list`, `prompts/list`, `tools/call`, SSE handling, session resumption, policy, telemetry, capability caching. Integration cost per server: **one JSON object in `MCP_SERVERS`.** Meanwhile six populated MCP servers sit in this very environment (§6b).
2. **The analyst's capability recommendations.** `backendModules[]`, `frontendModules[]`, `pages[]`, `features[]` — each with priority, rationale and evidence, produced by a paid model call and discarded.
3. **`PageHandle.screenshot`.** One method away from the pipeline being able to see its own output — the precondition for QA and any visual critic.
4. **The motion token system.** Computed, published to the page, consumed by ~nothing (§32).
5. **`scripts/batch-audit.ts`'s measurement script.** A real DOM QA harness needing only thresholds and a verdict to become a gate.
6. **`scripts/renderer-coverage.ts`.** Perturbation-based coverage; belongs in CI.
7. **`AITokenUsage`.** Every call already reports tokens; a price table turns it into a ledger.
8. **The `retryable` flag.** Honest on every error; consumed only inside the provider.
9. **Design `rationale` + `notes`.** Every decision explains itself; nothing collects them into a client-facing or QA-facing record.
10. **`Attributed<T>` provenance.** `{value, source, sourceUrl, alternatives[]}` per profile field — flattened into prose at `writerAgent.ts:302-385` and never seen again.
11. **The rich variant vocabulary.** `bento`, `masonry`, `collage`, `timeline`, `alternating`, `carousel`, `slider` are implemented as distinct markup and fire 2–3 times in 51 sites (§29).
12. **`RenderedSite` as in-memory bytes.** Deployment-ready contract with no uploader.

### 41. Capabilities that can be combined

| Combination | Yields | Cost |
|---|---|---|
| `PageHandle.screenshot` + `batch-audit` MEASURE + thresholds | **a QA gate inside the pipeline** | small — all three parts exist |
| github MCP `push_files` + `RenderedFile[]` | **deployment, closing the P0** | small — no new SDK |
| Canva `list-brand-kits` + `compose.ts` brand-colour lookup | real brand colour instead of category hue → **breaks the 8-way collision** | small |
| Figma `get_variable_defs` + `lib/design/tokens.ts` | import genuine design systems, widening the 11-theme space | medium |
| `AITokenUsage` + a price table + `telemetry` | **cost ledger and hard cap** | small |
| `motion.effects` + `@keyframes` + IntersectionObserver | the single largest perceptual gain available | small–medium |
| `strategy.backendModules` + a template library | T1 contact forms without model-authored code | medium |
| Provenance + `groundingWarnings` + a name-entity lexicon | **the evidence gate that stops "beside the river"** | medium |
| `renderer-coverage` + `npm test` in CI | visual-regression protection | small |
| Claude_Code_Remote `create_trigger` + an HTTP job contract | scheduled autonomous runs | medium (needs the server) |

### 42. Capabilities that cannot currently be automated

| Capability | Blocker | Removable? |
|---|---|---|
| Deployment | no uploader | **yes** — small |
| Seeing the rendered result | pipeline never opens a browser | **yes** — trivial |
| Judging design quality | no critic; needs **multimodal**, which `AIProvider` lacks | yes — contract change |
| Image understanding / generation | provider layer is text-only (`media.ts:20,34`) | yes — contract change |
| Approve/Reject | no state, no interface | **yes** — needs the server |
| Job submission without a terminal | no HTTP interface | **yes** |
| Cross-run learning | no memory | **yes** |
| Cost control | no ledger | **yes** — small |
| Multi-page sites | `WebsiteContent` has `sections`, not `pages` | yes — breaking contract change |
| Forms, booking, payments, accounts | no backend generation | yes — large |
| JS-rendered site scraping | collector doesn't await hydration | **yes** — small, and it is the P0 in `NEXT_SESSION.md` |
| Truly novel art direction | determinism-by-contract (`compose.ts:5-21`) | yes — but it is an architectural decision, not a bug |
| **Taste** | — | **no. Keep a human here.** |

### 43. Missing capabilities

**Existential:** deployment · a claim/evidence model with provenance surviving to output · a QA verdict · an HTTP job contract.

**High:** creative direction as an artefact · brand-colour extraction from the logo (already downloaded) · composition vocabulary beyond the vertical band · cross-run memory (esp. design fingerprints as a **disqualifier**) · cost ledger + cap · motion execution · tests for the network/secret half · multimodal on `AIProvider` · **JS-rendered-site scraping and Maps-photography ingestion** — the two fixes named in `NEXT_SESSION.md` that would roughly double the material for the 3-in-5 businesses with no crawlable site, and **invent nothing**.

**Medium:** Control Room · multi-page · forms + email · axe/Lighthouse in CI · prompt registry + versioning · wider industry taxonomy incl. `creative` · asset processing (crop/resize/optimise) · Places API.

**Low / defer:** 3D and WebGL · video · audio · ecommerce · accounts and dashboards · multi-tenancy.

### 44. Security risks

| # | Risk | Severity | Evidence | Note |
|---|---|---|---|---|
| 1 | **SSRF** — real Chromium navigates a URL from a third-party Maps listing; `fetchBinary` downloads from it | **CRITICAL** | `collectorAgent.ts:98` scheme-only; zero private-range checks in repo | `169.254.169.254` reachable |
| 2 | **Prompt injection, undefended** | **CRITICAL** | raw scraped text at `writerAgent.ts:350`, `businessAnalystAgent.ts:235`; zero sanitisation hits | Blast radius limited by the closed schema, the hours/contact overwrite and the CTA enum — but headings, body, tagline, SEO description and `unresolvedGaps` are all controllable |
| 3 | **Unverified inference published as fact** | **CRITICAL** | §21 mechanism confirmed | The product's core promise |
| 4 | Arbitrary code execution via `SKILLS_DIR` | **HIGH** (opt-in) | `skills/loader.ts` dynamic import | Operator-controlled by design; still an env-var-configured ACE path |
| 5 | The untested half is the dangerous half | **HIGH** | 0 tests touch `agents/`, `lib/ai/`, `lib/platform/`, `browser`, `config`, `main` | |
| 6 | No content-type check / byte budget on downloads | **MEDIUM** | `collector` writes "images"; 40 × 8 MB possible | Bytes get copied into a published site |
| 7 | Command injection | **MEDIUM (latent)** | only `spawnSync` is a dev script with fixed argv | **Becomes live the moment stdio MCP ships** |
| 8 | Single-tenant assumptions | **LOW now / HIGH later** | 8-hex run ids (`main.ts:387`); `resumePipeline` overwrites in place (`:396-400`) | |
| 9 | Scrape politeness / rate limiting | **LOW** | none | Reputational rather than technical |

**Genuine strengths, stated so they are not lost in a refactor:** branded-`Html` XSS prevention · `safeHref`/`safeImageUrl` with tests · `jsonLd` `</script>` neutralisation · `theme.ts` CSS-injection validation · `resolveInside` path guard · closed CTA enum · **no code generation, no `eval`, anywhere** · one `process.env` reader · names-only credential reporting · 2 runtime deps, 0 vulnerabilities.

### 45. Architecture contradictions

**Code vs code:**
1. **`designAgent.ts:58-59` casts any `FEATURE_design-direction-*` suffix to `DesignDirection` with no validation**, while its own docstring (`:49-51`) promises "An unrecognised name is ignored with a warning rather than failing the run." A typo yields `THEMES[undefined]` at `themes.ts:430` and the run crashes on a property access. **Live latent bug.**
2. **`lib/ai/index.ts` declares a convention nothing follows** and is imported by nobody (§38.4).
3. **`writerAgent` (stage 5) imports from `lib/render/`** (`:37-38`), so the writer is coupled to a downstream library despite the agent-independence principle.
4. **Every stage writes its artifact twice** under two names; only one copy is ever read (§22).
5. **`ColorSystem.scheme` admits `'dark'`; nothing produces it** (§38.5), making `premium`'s own description false.
6. **`build-review.ts` reads `output/scores.json`, which no script writes** (§38.9).

**Docs vs code:** eight, catalogued in §19 — `PROJECT_STATUS.md:178-180` (web fonts), `:192` (test count), `:53` vs `:151` (**self-contradiction**), `README.md:3` and `NEXT_SESSION.md:10` (deployment/end-to-end), `docs/architecture.md:112` (110 assertions), `docs/renderer.md:296` (245 assertions / five suites), `docs/folder-structure.md` (**design layer absent entirely**), `docs/design-intelligence-review.md` (5 of 10 items silently fixed), `scripts/vendor-fonts.ts:7` ("base64-inlines" — it copies files), `themes.ts:14-16` ("never fetched" — now vendored).

**Principle vs ambition:** `compose.ts:5-21` makes byte-determinism and the absence of feedback loops an architectural principle. Divergence, candidate generation, juries and repair loops all require relaxing it. **This is the one contradiction that is a genuine design decision rather than a defect,** and the resolution is to move the determinism boundary (§50), not to abandon it.

**Config vs reality:** `.env.example` credentials ten capabilities that throw; `MCP_SERVERS` and `SKILLS_DIR` are both commented out, so both subsystems boot empty in the default configuration.

---

## PART V — RECOMMENDATIONS (sections 46–51)

### 46. Recommended integrations

Ranked by value ÷ cost. Every one uses machinery that already exists.

| # | Integration | Mechanism | Buys | Cost | Risk |
|---|---|---|---|---|---|
| 1 | **github MCP → deployment** | `MCP_SERVERS` entry + a deployment agent calling `push_files`; Pages/Vercel serves | **closes the P0**; runs exit 0 | S | commit noise; needs a site branch or repo per client |
| 2 | **Local screenshot → QA gate** | call the existing `PageHandle.screenshot` + `batch-audit`'s MEASURE + thresholds | the pipeline can see and judge its output | S | over-strict thresholds stall runs |
| 3 | **Canva MCP → brand facts** | `list-brand-kits` as a `FactStore` source before the industry-hue fallback | **breaks the 8-way collision at its root** | S | not every client has a Canva kit |
| 4 | **Cost ledger** | price table × existing `AITokenUsage` → telemetry | spend visibility + hard cap | S | none |
| 5 | **Notion MCP → reconcile HQ** | `notion-fetch`/`notion-search` against the pages `PROJECT_STATUS.md:5` names | **resolves §0 — finds the BusinessForge you described** | S | read-only until verified |
| 6 | **Figma MCP → design tokens** | `get_variable_defs` → `lib/design/tokens.ts` | widens the 11-theme space with real systems | M | schema mapping |
| 7 | **Multimodal `AIProvider`** | extend `AIGenerateRequest` with image parts | unblocks `vision`, Visual Critic, image gen in one change | M | per-vendor differences |
| 8 | **Claude_Code_Remote → scheduling** | `create_trigger` + `create_session` | scheduled autonomous runs | M | **requires the HTTP job contract first** |
| 9 | **Kernel MCP → hosted browsers** | `execute_playwright_code` | QA at scale off-laptop | M | duplicates local Playwright |
| 10 | **axe + Lighthouse** | npm deps in the QA worker | real a11y/perf numbers instead of assertions | S | new deps — weigh against the 2-dep asset |

### 47. Recommended worker structure

Deterministic (**D**) unless a model is genuinely required (**M**) or hybrid (**H**). **11 of 20 need no model.**

```
CONTROL ROOM (UI)  ──HTTP──▶  FACTORY MANAGER (D)
                                 │ plans DAG from the Capability Requirements Doc,
                                 │ retries per worker, enforces cost cap, holds gates
   ┌──────────┬──────────┬───────┴────┬──────────┬──────────┐
   ▼          ▼          ▼            ▼          ▼          ▼
RESEARCH   EVIDENCE   CREATIVE      BUILD       QA      DELIVERY
listing(D) FactStore  Director(M)   DesignSys(D) measure(D) Security(D)
site(D)    claims(D)  ExpArch(H)    Frontend(D)  GATE(D)    Approval(human)
places(D)  GATE(D)    ContentPlan(H) Backend(H)  Critic(M)  Deployment(D)
                      ProseWriter(M) Asset(H)      │ fail
                                     Motion(D)     ▼
                                     3D(D, gated) REPAIR (H, ≤2 iterations,
                                                  must reduce a measured defect)
CROSS-CUTTING (all D): Cost Controller · Memory · Knowledge · Observability
```

Three rules that matter more than the boxes:
1. **The Factory Manager must be deterministic.** A model choosing the next stage makes runs unreproducible and unbudgetable.
2. **The Creative Director must never block.** Its only failure mode is falling back to today's deterministic design — which preserves the current guarantee that every run yields a competent site while letting the ceiling rise.
3. **Repair must be bounded and monotonic.** `compose.ts:17-21` is right that unbounded loops make output depend on iteration count. Cap at 2, require each pass to reduce a *measured* defect, and make the QA report the arbiter.

### 48. Recommended tool registry

Replace the 38-id placeholder catalogue with a registry whose entries are **either real or absent** — never throwing.

```ts
interface Tool {
  id: string;
  kind: 'deterministic' | 'model' | 'mcp' | 'external';
  status: 'live' | 'planned';          // ONLY these two. No 'placeholder'.
  version: string;                      // never 0.0.0
  invoke(input): Promise<CapabilityOutcome>;
  health(): Promise<HealthReport>;
  cost?: CostModel;                     // NEW — the Cost Controller reads this
  provenance?: 'fact-source' | 'transform' | 'sink';  // NEW — Evidence reads this
  requiredCredentials: string[];
}
```

Four changes from today: (1) **`status: 'planned'` entries are not registered at all**, so `skills.list()` cannot advertise capability that throws; (2) **`cost`** makes budgeting possible; (3) **`provenance`** lets the Evidence worker know which tools may write facts; (4) **MCP servers are first-class tools**, not a parallel subsystem — collapsing today's two managers into one.

Seed it with what is real: `browser`, `maps-listing`, `site-crawl`, `design-compose`, `render`, `screenshot`, `measure`, `provider:{anthropic,openai,gemini,openrouter}`, plus MCP tools per §46. **Delete the 38 stubs.** Keep `placeholder.ts` as a *pattern*; stop shipping a catalogue of them.

### 49. Recommended knowledge structure

Five stores, separated by lifetime and write discipline. **The critical rule: separate what is TRUE from what WORKED.**

| Store | Key | Contents | Write discipline |
|---|---|---|---|
| **FACT MEMORY** | `placeId` | every fact + `Provenance{sourceUrl, textSpan, retrievedAt, extractor, claimLevel}` | **append-only, never model-written.** Per-field-kind TTL (hours 30d, address 1y, prose 90d). A changed fact is a new observation so contradictions stay visible. |
| **PROJECT MEMORY** | `runId` | today's artifacts + ArtDirection, ClaimSet, QAReport, critique, approval, deployed URL, cost ledger | immutable, content-addressed, indexed by business+date |
| **DESIGN MEMORY** | fingerprint | the `(direction, density, hero, brand, font)` tuple I measured in §29, + QA score + outcome | **queried as a hard DISQUALIFIER**, not a hint. Same industry + same locale + same fingerprint = rejected. This is the store that would have prevented eight identical sites. |
| **WORKER MEMORY** | worker+task | latency, failure rate, refusal rate, tokens, cost | rolling window, aggregate only; feeds routing and the cost cap |
| **FAILURE MEMORY** | defect id | every QA defect + critique finding + the fix | **a defect seen in ≥2 runs is auto-promoted to a QA threshold** — the loop that turns "noticed once" into "cannot ship again" |
| **KNOWLEDGE BASE** | topic | industry conventions, category prohibition lists, the name-entity lexicon, hue anchors, exemplar compositions | **human-reviewed promotion only.** The boundary that stops the factory learning its own mistakes. |

**Storage: SQLite.** One file, transactional, queryable, no service — it preserves the current zero-infrastructure property. Do not reach for a vector store; there is no retrieval problem yet.

### 50. Recommended Factory Manager interfaces

```
POST   /runs                    {source: {mapsUrl|nameAndCity|brief}, tier: T0..T4,
                                 budgetUsd?, dryRun?}        → {runId, status}
GET    /runs                    ?status=&business=&since=    → [RunSummary]
GET    /runs/:id                → {status, stages[{name,state,startedAt,artifactPath,
                                   error?,retries}], cost, qa?, critique?, previewUrl?}
GET    /runs/:id/artifacts/:name→ the stage artifact (auth required)
GET    /runs/:id/preview        → the rendered site, served
POST   /runs/:id/approve        {decision:'approve'|'reject'|'changes',
                                 notes?, changes?[]}          → {status}
POST   /runs/:id/resume         {fromStage}                   → {status}
POST   /runs/:id/cancel         → {status}
GET    /capabilities            → tool registry + health + cost model
GET    /facts/:placeId          → FactStore with provenance
GET    /design-memory?industry=&locale= → fingerprints already shipped
GET    /costs?since=            → ledger
```

Internal contract every worker implements — deliberately the shape `Agent<I,O>` already has, so today's agents adapt rather than get rewritten:

```ts
interface Worker<I, O> {
  name: string;
  kind: 'deterministic' | 'model' | 'hybrid';
  run(input: I, ctx: WorkerContext): Promise<O>;
  estimate?(input: I): CostEstimate;   // NEW — the Manager pre-checks the budget
  blocking: boolean;                    // NEW — may this worker fail the run?
  idempotent: boolean;                  // NEW — may the Manager retry it?
}
```

**Design constraints:** single process, SQLite, in-process queue. No broker until there is contention. Auth: a single bearer token to start — the service is localhost-only until Approve/Reject is remote. The **resume semantics already exist** (`main.ts:317-327`); generalise, don't reinvent.

### 51. Exact next actions

Concrete, ordered, each with a done-condition. **Actions 1–3 are gap-closing on this inventory and cost minutes.**

| # | Action | Done when |
|---|---|---|
| 1 | **Run the five PowerShell probes** from §1, §2, §8, §11, §12, §13 and paste the output. | The 13 UNKNOWN sections become answerable. |
| 2 | **`Get-ChildItem C:\Users\40728\WebsiteAgent\output -Recurse -Filter "*.json"`** and send one Go Sweet or River Park run folder. | §20 and §21 become real forensic reconstructions. |
| 3 | **Point me at the Notion "BusinessForge HQ" pages** (`PROJECT_STATUS.md:5`), or authorise the Notion MCP. | §0 resolves — I can tell you whether the Factory Manager/Control Room/n8n exist as designs. |
| 4 | **Fix `designAgent.ts:58`** — validate the suffix against `DesignDirection` before casting; warn and ignore on miss, as the docstring already promises. | A bad `FEATURE_design-direction-*` warns instead of crashing. |
| 5 | **Delete `lib/ai/index.ts`** (dead orphan, false convention). | Import graph shows no orphan barrels. |
| 6 | **Correct the 8 documentation contradictions** in §19 and §45, and add `lib/design/` to `docs/folder-structure.md` and `docs/architecture.md`. | No doc claim is falsifiable by `grep`. |
| 7 | **Decide the dark scheme:** implement it or delete `ColorSystem.scheme`. | `premium`'s description matches its output. |
| 8 | **Add the SSRF allowlist** in `collectorAgent.ts:98` and `browser.ts:313` — reject loopback/private/link-local, resolve-then-check to defeat DNS rebinding. Add a test. | A listing whose website is `http://169.254.169.254/` is refused by name. |
| 9 | **Harden the two prompts** — delimit scraped text, mark it data-not-instructions, add a post-generation consistency check. Add a test. | A page containing "ignore previous instructions" does not steer the copy. |
| 10 | **Build the deployment worker** — `RenderedFile[]` → github MCP `push_files` (or Vercel). Retire `lovableAgent`, as `ROADMAP.md:48` already says to. | `npm run dev -- <url>` **exits 0** and prints a URL that serves the site. |
| 11 | **Wire screenshot + measure + thresholds into the pipeline** as a QA worker. Start with the seven objective defects: broken images, horizontal overflow, AA contrast, empty band, ragged tail, orphan grid item, missing `<h1>`. | A site with a broken image is blocked before a human sees it. |
| 12 | **Generate `output/scores.json`** from the QA worker instead of hand-writing it. | `build-review.ts` runs with no manual step. |
| 13 | **Add the cost ledger** — price table × existing `AITokenUsage`, persisted, with a hard per-run cap. | Every run reports its spend; exceeding the cap halts it. |
| 14 | **Fix the two thin-profile causes** (`NEXT_SESSION.md`): await hydration on JS-rendered sites, and ingest the Maps listing's owner-uploaded photography. **Both invent nothing.** | The 3-in-5 no-website businesses get images and >174 words. |
| 15 | **Write tests for `lib/config.ts`, `lib/ai/`, `lib/platform/`, and the collector's URL handling.** | The network/secret half has coverage. |
| 16 | **Build the HTTP job contract** (§50), single process + SQLite. | A run is submitted, observed and approved without a terminal. |
| 17 | **Then, and only then, the creative work:** Creative Director, logo-based brand-colour extraction, Design Memory as a disqualifier, wider taxonomy incl. `creative`, composition vocabulary, motion execution. | Regenerating the 51-site set moves distinct fingerprints from **24 toward 51**, with no QA regression. |

**On sequencing, and this is the one judgement I would defend hardest:** action 17 is the interesting work and the visible problem, and it is deliberately last. Without deployment there is no product; without a QA gate you cannot tell whether creative freedom improved anything or merely added variance; without the evidence layer the product's core promise stays unenforced. The 8-way design collision is the most *visible* defect and the *fifth* most important.

---

## Appendix A — What this inventory could not establish

| # | Gap | Reason | Fill with |
|---|---|---|---|
| 1 | Laptop OS, hardware, installed software | no Windows filesystem mounted (§0) | `Get-ComputerInfo`; `winget list` |
| 2 | AI applications installed on the laptop | same | `where` probes; `$env:APPDATA` scan |
| 3 | Laptop Claude Code config, skills, agents, MCP servers | `.claude/` not committed; container config is a fresh install | `Get-ChildItem $env:USERPROFILE\.claude -Recurse` |
| 4 | Antigravity, Hermes | **zero** occurrences in 168 files; no evidence they exist | tell me what they are |
| 5 | n8n workflows | zero occurrences; nothing to inspect | `$env:USERPROFILE\.n8n` |
| 6 | Docker containers/images/volumes | zero occurrences | `docker ps -a`, `docker images` |
| 7 | Listening ports / local services | none in container; product opens none | `Get-NetTCPConnection -State Listen` |
| 8 | Other projects / repos / datasets on the laptop | cannot sweep a filesystem I cannot see | `Get-ChildItem $env:USERPROFILE -Depth 3 -Filter ".git" -Directory` |
| 9 | **Go Sweet run** | no artifact in repo or history; `output/` gitignored | send the run folder |
| 10 | **River Park Events run** | same | send the run folder |
| 11 | Which AI provider is actually configured | `.env` gitignored and absent | `Select-String .env -Pattern '^AI_PROVIDER'` |
| 12 | Whether stage 4 ever ran live | `PROJECT_STATUS.md:53` and `:151` contradict each other | check `output/*/4-strategy.json` for a `model` field |
| 13 | Whether openai/gemini/openrouter adapters work | never run live; no integration tests | one live call each |
| 14 | Live axe / Lighthouse scores | never measured | run them on `output/examples/hotel/index.html` |
| 15 | Tool lists for BusinessForge's MCP servers | **zero servers configured**; `tools/list` needs a live endpoint | populate `MCP_SERVERS` |

---

## Appendix B — Verification log

Commands run this session, so any claim above can be re-derived:

```
uname -a / hostname / whoami / df -h            → §0 access boundary
ls /mnt/c /c /Users                             → no Windows volume
git log / git config / stat .git                → fresh clone, 2026-08-17
git ls-files | grep -iE '\.claude|\.mcp|…'      → no committed AI config
grep -ri n8n|docker|"go sweet"|"river park" .   → 0 matches each
npm install                                     → 16 packages, 0 vulnerabilities
npm test                                        → 248 pass, 0 fail, 1.67s
npm run typecheck / npm run build               → both clean
python3 graph.py  (90 .ts files parsed)         → import graph, orphans, net/fs/env/secret map
grep -n process.env <4 candidate files>         → invariant HOLDS (3 were docstrings)
npx tsx scripts/generate-examples.ts            → 51 sites
python3 (fingerprint 51 design.json)            → 24 distinct visual systems
grep class attrs across 51 index.html           → true variant distribution (§29)
HTMLParser tag-skeleton comparison              → variants are distinct markup
npx tsx scripts/renderer-coverage.ts            → 98.1% visual coverage
npm run render -- <content.json>                → render path works
lovableAgent.run(...) via tsx                   → threw NotImplementedError
grep @font-face + ls assets/fonts in output      → 5 faces, 5 woff2 per site
grep -c '<script' / '@keyframes' in output       → 1 (JSON-LD) / 0
ss -ltnp                                        → no listening sockets
```

**Repository state: unmodified.** `git status --porcelain` shows only this new file.
Artifacts from the audit live in `output/examples/` (gitignored) and are inspectable:
`output/examples/index.html` (51 sites), `output/examples/comparison.md` (decision matrix).
