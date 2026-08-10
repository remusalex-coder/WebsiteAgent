# ADR 0003 — Carry the provider's request id on `AIGenerateResult`

**Date:** 2026-08-10
**Status:** Accepted
**Context:** the Design Director V1 smoke test

## Context

The platform's claim about any generated artifact is "a real model produced
this". Before this change, everything supporting that claim was self-reported:
the provider name we selected, the model we asked for, the token counts the
response carried. All of it is exactly what a mock would also produce.

Every vendor returns an identifier for the request — Anthropic's `message.id`,
OpenAI's and OpenRouter's `id`, Gemini's `responseId` — and the adapters were
throwing it away.

## Decision

Add an optional `requestId: string | null` to `AIGenerateResult`, and populate it
in all four adapters.

Optional rather than required, so an adapter that has no such field (or a vendor
that stops sending one) is not a compile error and is not tempted to invent a
value. Absent means `null`, and `null` is reported as `null`.

`designDirectorAgent` carries it out through `DirectorProvenance`, alongside the
provider, the model that *actually served* the request (which can differ from the
one asked for), token usage, finish reason and timestamps. The smoke harness
persists that as `directive.provenance.json` beside the directive itself.

## Consequences

- A generated artifact can be reconciled against the vendor's own records by a
  third party. That is the difference between an audit trail and an assertion.
- `run.log.ndjson` carries the same id, so the log and the artifact can be
  matched to each other and to the vendor.
- The first real directive produced under this scheme:
  `gemini` / `gemini-3.6-flash`, request `rbl5as-JA_6nkdUP_O_osQU`,
  657 input + 215 output tokens, finish reason `STOP`,
  2026-08-10T11:44:44.917Z.
- Nothing else in the platform reads the field yet. It exists so that the
  provenance of a paid artifact is recorded at the moment it is cheap to
  record — after the fact it is unrecoverable.
