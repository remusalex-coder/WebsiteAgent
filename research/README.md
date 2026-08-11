# Research artifacts

This directory is the shared medium between **Claude** (which decides what
evidence is missing, and what to do with the evidence) and **Hermes** (which
finds it and attaches sources).

It is **committed to the repository**, unlike `output/`. That is deliberate and
it is the whole point: a session works in a container that is destroyed when the
session ends, and the next session starts from a fresh clone. Anything a later
session must be able to read has to survive in git.

```
research/
  <key>.research.json            canonical artifact — the source of truth
  requests/<requestId>.json      open questions, waiting for an answer
  answers/<requestId>-<t>.json   what Hermes returned, kept verbatim as a receipt
```

## Start here

```bash
npx tsx main.ts --research-list             # every subject, every open question
npx tsx main.ts --research <key>            # the brief for one business
```

## The rules, in one line each

- Every claim names at least one source that was actually read. A claim with no
  source is refused by the parser — it is not stored at low confidence.
- Blocked sources, gaps and open questions are recorded. "We could not find out"
  never renders as "there is nothing there".
- Conflicts keep both sides. Nothing here picks a winner.
- Hermes supplies evidence and decides nothing about the website.
- These files are the source of truth for research evidence.
  `BusinessProfile.provenance` is a projection of them, never a copy.

Full contract, provenance rules and what happens when Hermes is unavailable:
[`docs/research-handoff.md`](../docs/research-handoff.md).
