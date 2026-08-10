# ADR 0002 — Resumable jobs, not discipline, enforce the one-call rule

**Date:** 2026-08-10
**Status:** Accepted
**Context:** the Design Director V1 smoke test; the autonomous production system

## Context

Pre-revenue, a model call is a cost that has to be justified per invocation. The
smoke test's contract was *exactly one real AI call* — and the failure mode to
design against is not "someone deliberately calls twice", it is:

> the call succeeds, something downstream throws, the operator fixes it and runs
> the command again — and pays for a second call to recover from a bug that had
> nothing to do with the model.

That happened in this very milestone. The first full run made its one call,
produced a valid directive, rendered both variants, and then failed a
verification check that was itself wrong (it compared raw word counts, and the
design system legitimately changes chrome text). Under a non-resumable harness,
fixing that check would have cost a second call.

## Decision

Every stage of the smoke harness is a **job with declared artifacts**. If all of
a job's artifacts are on disk, the job does not run — its output is read back
instead.

```
JOB → WORKER → ARTIFACT → VALIDATION → NEXT JOB
```

`control.design` → `control.render` → `control.shoot` →
**`director.directive`** → `director.design` → `director.render` →
`director.shoot` → verification.

The AI call is one job, and its artifacts are `directive.json` plus
`directive.provenance.json`. Once written, re-running the command is free.

Three further properties fall out of, or sit beside, that:

1. **The AI job is ordered after everything that does not need it.** Control
   composes, renders and screenshots first, so a fixture, renderer or Playwright
   bug surfaces *before* any money is spent. `--control-only` runs that half
   deliberately, with no credential required at all.
2. **`maxRetries` is forced to 0** for the run, so one `generate()` is one HTTP
   request rather than up to four.
3. **The provider is wrapped in a counter that throws on the second call**, so
   an accidental second call is a crash, not a doubled bill.

A resumed run reports `directiveSource: "resumed"` and `calls: 0`, and its
check detail names the timestamp and vendor request id of the live call that
produced the artifact. Resuming is a pass; it is never reported as fresh
evidence.

## Consequences

- The harness is the smallest honest instance of the orchestrator contract the
  autonomous production system needs. Re-running a partially-completed run is
  the normal path, not a recovery mode.
- To force a genuinely fresh call, an operator deletes
  `smoke-test/director/directive.json`. There is no flag for it, deliberately:
  spending money should require removing evidence, not passing an argument.
- The same shape generalises. A job's artifact is its idempotency key, which is
  what lets a worker be killed and restarted, and what lets a run resume after
  an interruption without a coordinator holding state in memory.
- This is a harness-level guarantee today. Making it the *pipeline's* guarantee
  — `main.ts` stages as resumable jobs against a run directory — is the next
  structural step and is not done here.
