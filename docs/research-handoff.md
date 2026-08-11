# The research handoff — Claude ↔ Hermes

_Last updated: 2026-08-11._

Claude runs out of session before the work runs out. Research, architecture,
implementation, rendering and visual QA in one context is more than one session
holds, and the research half is both the most interruptible and the least
reusable — it is thrown away when the session ends and done again by the next
one.

This document describes the mechanism that stops that: a second agent that
researches, and a committed artifact that both agents read and only one writes.

---

## The two roles

The division is strict, and the point of it is that neither agent can quietly do
the other's job.

| | **Claude** | **Hermes** |
|---|---|---|
| is | lead product architect, design director, UX director, content director, implementation owner, visual QA owner | research and evidence agent |
| decides | everything about the product and the site | nothing about the product or the site |
| produces | code, design, copy, rendered sites, judgements | attributed evidence |
| writes to the repository | all of it | nothing (see below) |
| may invent | nothing about a business | nothing at all |

**Hermes is not a second implementation system, not a second Design Director,
and not a second opinion.** It answers questions about the world and attaches
sources. What the answer is used for — whether a terrace photograph becomes a
hero image, whether a capacity figure appears on the page at all — is Claude's
decision inside BusinessForge's existing contracts.

### What Hermes may do

- Read public sources and report what they say.
- Attribute every claim to at least one source it actually read.
- Report sources it could **not** read, and why.
- Report what it looked for and did not find.
- Report images, menus, logos and documents it found, with the URL and whatever
  the source states about rights.
- Report that two sources disagree — by returning both, each with its own source.

### What Hermes may not do

- **Invent a fact about a business.** A claim with no source is refused by the
  parser; it is not stored at low confidence. If Hermes reasoned its way to
  something, it marks the claim `inferred` and writes the reasoning down, so a
  reader can reject it.
- **Decide anything visual or editorial** — no layout, palette, section, tone,
  copy or composition. Nothing in the research contract can express those.
- **Modify the BusinessForge codebase.** Hermes writes research artifacts and
  nothing else. It has no reason to touch `agents/`, `lib/` or `main.ts`, and no
  part of this mechanism gives it a way to.
- **Resolve a conflict.** It reports both sides. Choosing is downstream.

---

## Why this shape — the three options

The choice was between three architectures. The comparison is recorded because
the cheapest of the three is not the one that survives a session ending.

### A. Shared research artifact in the repository

Claude writes a question to a file; Hermes writes the answer to a file; the
answer merges into a committed artifact.

- **Works today**, with no dependency on anything being reachable.
- **Survives everything** — the session, the container, the machine. A repository
  is the only medium both agents provably share.
- Asynchronous. Nothing answers inside the session that asked.

### B. Direct Hermes MCP request/response

Claude calls a Hermes MCP tool and gets a delta back in the same turn.

- **Fast, and closes the loop inside one session.**
- **Not available.** There is no Hermes MCP server in this environment, no
  Hermes endpoint, no Hermes binary, and no Hermes entry in `MCP_SERVERS`. See
  the audit note at the end of this document.
- Answers evaporate with the session unless something also persists them, so on
  its own it does not solve the problem that motivated the work.

### C. Hybrid — MCP invocation *and* a persisted artifact

The request is always filed. A transport may answer it now. Either way the
answer lands in the same committed artifact.

**Chosen.** It is not more machinery than A: the persistence *is* A, and the
transport is a thin adapter over the MCP manager that already exists. What it
adds is that the day a Hermes endpoint exists, it is one `MCP_SERVERS` entry
away from working — and until that day, the loop already runs.

The ordering inside the hybrid is the load-bearing decision:

> **The request is persisted before the transport is tried.**

A transport that hangs, crashes or returns nonsense leaves a well-formed
question on disk. The durable path is the default path, and the fast path is an
optimisation on top of it — not the other way round.

---

## Where research lives

```
research/
  <key>.research.json        the canonical artifact — the source of truth
  requests/<requestId>.json  open questions, waiting for an answer
  answers/<requestId>-<t>.json   what Hermes actually returned, kept verbatim
```

**Committed to git**, unlike `output/`. That is the entire resume story: a
session works in a container that is destroyed when it ends, and the next
session gets a fresh clone. Anything a later session must read has to survive in
the repository.

`answers/` is not redundant with the artifact. The artifact is merged state; an
answer is the receipt. Keeping both means any claim can be traced back *past* the
merge to the exact message that introduced it.

Configure with `RESEARCH_DIR` (default `./research`) and `RESEARCH_MCP_SERVER`
(default `hermes`).

---

## The artifact

One file per business. It holds evidence and nothing else — it is emphatically
**not** a second `BusinessProfile`, and must never grow into one.

| Field | What it holds |
|---|---|
| `subject` | key, name, locality, homepage, Maps URL — five fields, no more |
| `researcher` | `hermes` |
| `revision`, `updatedAt` | how many passes have merged, and when the last one ran |
| `passes[]` | the provenance chain: one entry per pass, with its request, scope, timestamp, counts and handoff |
| `sources[]` | every source ever touched, with `access` (`ok`/`blocked`/`not_found`/`unreachable`) and a note |
| `claims[]` | attributed facts: topic, field, value, `sourceIds`, excerpt, status, confidence, note, `observedAt` |
| `conflicts[]` | fields whose live claims disagree — computed, never sent |
| `assets[]` | images and documents found, with source, dimensions, credit and stated rights |
| `gaps[]` | what was looked for and not established, and why |
| `openQuestions[]` | what a later pass or a human might settle |
| `handoff` | a few sentences for whoever reads this next |

**Blocked sources are `sources` entries with `access` other than `ok`.** There is
no separate list, deliberately: one place where a source's readability is
recorded means the two cannot disagree. `researchBrief` and `projectProvenance`
both surface them prominently.

### The five statuses

`verified` · `corroborated` · `inferred` · `unknown` · `conflicted` — the
canonical BusinessForge evidence statuses.

`conflicted` is a property of a **field**, not of a claim. Two sources
disagreeing does not make either claim less well attested, so each keeps the
status its own sources earn and the disagreement is recorded once, in
`conflicts`. A delta that puts `conflicted` on a claim is refused.

---

## The loop

```
Claude finds an evidence gap
  → --research --ask="…" --fields=a,b <key>          request filed to research/requests/
      → Hermes answers  (MCP now, or a file later)
        → --research-apply <delta.json>              merged, receipt stored, request closed
          → Claude reads --research <key>            implements, renders, evaluates
            → finds the next gap → repeat
```

### Claude asks

```bash
npx tsx main.ts --research \
  --ask="Establish the outdoor space, hotel capacity and official contact details." \
  --fields=outdoor-space,capacity,contact-email \
  --name="River Park Events" --locality="Cluj-Napoca" river-park-events
```

`--name` is needed only for the first request about a business; after that the
subject comes from the artifact, so it cannot drift between passes.

The command prints the request id, the file it was written to, and the full
prompt for Hermes. If a transport answered, it prints the handoff instead.

### Hermes answers

With a `ResearchDelta` — **new and changed findings only**. Repeating settled
facts is not an error (the merge deduplicates) but it wastes the pass.

### Claude applies

```bash
npx tsx main.ts --research-apply path/to/delta.json
```

Merges, stores the receipt, closes the request.

### A later session resumes

```bash
npx tsx main.ts --research river-park-events   # the brief: known, contested, missing
npx tsx main.ts --research-list                # every subject, every open question
```

The brief leads with contested fields, then established claims with their source
URLs, then assets, blocked sources, gaps, open questions and the provenance
chain. A session that has read it knows what is known, how well, and what to ask
next — without a transcript.

---

## Incremental research

`buildRequest` derives `excludeFields` from the artifact: every field that is
attested, uncontested, and not merely inferred goes on the "already settled, do
not re-confirm" list. So the second pass is genuinely cheaper than the first, and
the saving is **derived from disk rather than remembered by a session** — which
is why it still works after the session that asked is gone.

Two refinements that matter in practice:

- **A field the caller explicitly asks about is never excluded.** Asking again is
  how a session says "I think this changed", and the exclusion list must not
  overrule the question.
- **An `inferred` claim is never settled.** It is Hermes's own reasoning, not a
  source's statement. Finding a real source for it is exactly the work worth
  doing next.

### Focused asset research

Visual QA discovering that the image set cannot carry a signature composition is
an evidence gap like any other:

```bash
npx tsx main.ts --research \
  --ask="Find wide landscape photographs of the terrace at dusk, 2000px or wider." \
  --fields=asset-terrace-wide river-park-events
```

The answer arrives as `assets[]` with URLs, dimensions and whatever each source
states about rights. Nothing is downloaded and nothing is judged usable — that
is a decision, and decisions are Claude's.

---

## Preventing duplicated work

Four mechanisms, none of which needs the two agents to be running at once:

1. **Request ids are content hashes** of the subject, question and fields. Two
   sessions that independently decide the same evidence is missing write the
   *same* file. The second is told the question was already open.
2. **Claim ids are content hashes** of field, value and sources. The same finding
   from the same source is one claim however many times it is sent.
3. **A merged pass is recognised.** Same request, same research timestamp,
   already in the chain — the merge changes nothing and says so.
4. **Answered gaps disappear.** Once a live claim exists for a field, the gap
   that asked for it is dropped, so it stops appearing in briefs.

---

## Provenance rules

1. **The artifact is the source of truth for research evidence.**
   `BusinessProfile.provenance` is a **downstream projection** of it, produced by
   `projectProvenance`, never a copy and never a competing record.
2. **Every claim names at least one declared source.** Enforced by the parser,
   not by prompting. A claim with no source cannot be stored.
3. **`verified` requires a source that was actually readable.** `corroborated`
   requires two. A claim backed only by a blocked source cannot claim to be
   verified.
4. **An inference must show its reasoning.** `inferred` without a note is
   refused.
5. **Conflicts are preserved, never resolved.** Both claims stay, each with its
   own attribution. A precedence rule downstream chooses from alternatives that
   still exist.
6. **Absence is recorded.** Blocked sources, gaps and open questions are fields.
   "We could not find out" never renders as "there is nothing there".
7. **Nothing is deleted.** A retired claim leaves `claims` and is named on the
   pass that retired it, so the record still shows what was once believed.
8. **The research layer imports no pipeline contract.** `lib/research` does not
   import `lib/types.ts`, and no agent imports `lib/research`. Research cannot
   change a profile, a strategy, a design or a site — it can only make evidence
   available.

---

## What stays deterministic

Everything that was deterministic still is, and the new layer joins it:

- **The merge is a pure function.** Same previous artifact, same delta, same
  result, on any machine. No clock, no generated id, no insertion-ordered
  iteration. Timestamps come from the delta; the CLI passes `now` in.
- **Ids are derived from content**, so the merge is idempotent: a session that
  cannot remember whether it filed an answer can file it again.
- **Sorting is by code unit**, never `localeCompare`, so an artifact's byte
  layout does not depend on the host's ICU data.
- **The projection is pure**, so a profile derived from research is reproducible
  from the committed artifact alone.
- Discovery, collection, normalization, the design composer and the renderer are
  untouched. No existing contract changed.

## What is optional

- **The transport.** No Hermes endpoint is required for the loop to run.
- **Research itself.** A pipeline run that never consults an artifact behaves
  exactly as it did before this existed. Nothing in `main.ts`'s pipeline path
  reads `research/`.
- **The MCP server.** Registered through the existing `MCP_SERVERS` mechanism, or
  not at all.

## When Hermes is unavailable

Which is the current state, and is treated as normal rather than as a failure:

| | Behaviour |
|---|---|
| Filing a request | works — always, unconditionally |
| The prompt for Hermes | printed and stored |
| `research()` | returns a `not_registered` **outcome**, never throws, never an empty result |
| Applying an answer that arrives later | works |
| Reading the brief | works |
| The pipeline | unaffected |

The failure carries an instruction rather than only a status: point
`MCP_SERVERS` at a Hermes endpoint advertising a `research` tool, or have Hermes
read `research/requests/` and write the answer back to the repository. A
capability gap with no stated next step is how a gap becomes a dead end.

---

## Registering a Hermes MCP server

No code change. One entry in the existing MCP configuration:

```bash
MCP_SERVERS='[
  {
    "id": "hermes",
    "name": "Hermes",
    "transport": "http",
    "endpoint": "https://…/mcp/",
    "requiredCredentials": []
  }
]'
```

The server must advertise a tool named `research` taking `{ request }` and
returning a `ResearchDelta` — as `structuredContent`, as JSON in a text block, or
directly. All three are accepted. A delta answering a different `requestId` is
rejected: a researcher answering the wrong question would otherwise merge
cleanly and attach the wrong provenance to real claims.

> **Never exercised against a live Hermes server**, because none exists. The call
> shape follows the MCP specification and the response handling is covered by
> tests against each documented shape, but the first real call is the test — the
> same honesty [the HTTP connector](mcp.md) is documented with.

---

## Cost

**€0, and structurally so.** The mechanism is filesystem writes, JSON parsing and
SHA-256 hashing — no API, no key, no service, no new dependency. The MCP
transport, if ever pointed at something, uses the connector that already exists.
Nothing here consults an AI provider: `lib/research` never calls
`platform.ai()`.

---

## What the audit found, 2026-08-11

Recorded because the starting point is not obvious from the repository:

- **No Hermes integration existed in this repository.** No code, no types, no
  configuration, no documentation, and no occurrence of the string in any file or
  in the git history of any branch on the remote.
- **Nothing was specification-level either** — there was no Hermes contract to
  implement against, in the repository or in the Notion workspace.
- **Hermes is not invocable from this environment.** No MCP server, no connector,
  no binary, no agent registration, and no reachable agent of any kind.
- **The existing inter-stage mechanism is files on disk**: `main.ts` persists
  each stage to `output/<runId>/<n>-<stage>.json` and `--from` reads them back.
  The research layer follows the same pattern, with one deliberate difference —
  it writes to a tracked directory, because `output/` is gitignored and would not
  survive the session.
- **The repository's `main` was behind the working machine.** Notion records the
  local repository at commit `5300549` with 354 tests, on a branch
  (`design-director-smoke`) that has never been pushed; the remote's `main` was
  at `06d3ab1` with 248 tests. Everything here is additive — a new directory, one
  additive config section, new CLI modes — so it merges onto that branch without
  touching the work that is only on the machine.

---

## Related

- [Architecture](architecture.md) — where this layer sits
- [MCP system](mcp.md) — how a Hermes server would be registered
- [Configuration](configuration.md) — `RESEARCH_DIR`, `RESEARCH_MCP_SERVER`
