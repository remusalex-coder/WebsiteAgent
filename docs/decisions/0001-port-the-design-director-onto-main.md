# ADR 0001 — Port the Design Director onto `main` rather than merge its branch

**Date:** 2026-08-10
**Status:** Accepted
**Supersedes:** nothing
**Context:** the Design Director V1 smoke test

## Context

The Design Director was believed to be part of the platform. It was not on
`main`. It lived entirely on `origin/copilot/inspect-repository-codebase`, a
branch that forked at `06d3ab1` and has not been merged.

At the time of writing the two sides had diverged badly:

| | commits since fork | what changed |
|---|---|---|
| `main` | 16 | `lib/art/`, `lib/design/patterns.ts`, `worlds.ts`, the vocabulary engine, Places, the writer rewrite |
| `copilot/inspect-repository-codebase` | 12 | the Design Director, and an A/B harness built around it |

They overlap on `lib/config.ts`, `lib/design/index.ts`, `main.ts` and
`agents/designAgent.ts`. The branch's A/B harness (`scripts/ab-test.ts`,
`scripts/ab-replay.ts`, `scripts/ab-contact-sheet.ts` — about 2,150 lines) was
built against a design layer that no longer exists: it predates patterns,
worlds, art direction and the vocabulary engine.

## Decision

Port the three self-contained pieces onto `main` and leave the branch unmerged.

Ported:

- `lib/design/directive.ts` — the `DesignDirective` contract and `applyDirective`
- `agents/designDirectorAgent.ts` — the agent
- `DirectorConfig` in `lib/config.ts`
- the two test files

Not ported:

- `scripts/ab-test.ts`, `scripts/ab-replay.ts`, `scripts/ab-contact-sheet.ts`
- the branch's `main.ts` pipeline integration
- the branch's nine `docs/design-director-v1-*.md` files, which describe a
  design layer that has since been replaced

## Why not merge

The valuable part of that branch is 830 lines; the merge is ~7,500 lines, most
of it a harness whose premise no longer holds and documentation that would
contradict `main`'s own.

More importantly, **`scripts/ab-replay.ts` used `FALLBACK_DIRECTIVES`.** Merging
it would bring a canned-directive path back into a repository whose whole claim
is that there is no such path. The five-business A/B experiment run from it is
not evidence about any model and must not be cited as such.

`FALLBACK_DIRECTIVES` does not appear anywhere on `main`, before or after this
port. `test/design/designDirectorAgent.test.ts` asserts that the agent module
exports nothing matching `/fallback|default.*directive|canned|stub/i`, so
reintroducing one fails a test rather than passing silently.

## Consequences

- The Director composes against the *current* design engine — patterns, worlds
  and art direction — rather than the pre-vocabulary one.
- `origin/copilot/inspect-repository-codebase` is now superseded. It should be
  read as history, not as a branch awaiting merge.
- V1's mapping surface is unchanged and deliberately narrow: of eleven directive
  fields, `applyDirective` maps two — `direction` and `accessibilityTarget` /
  `colorStrategy` → `accessibilityLevel`. Everything else is advisory and
  logged. Widening it is a decision for Visual Critic evidence, not for this
  port. See ADR 0004.
