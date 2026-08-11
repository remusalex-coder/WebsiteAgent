/**
 * The two operations a session actually performs.
 *
 *   `openRequest`  — Claude notices missing evidence and asks for it.
 *   `applyAnswer`  — Hermes's reply becomes part of the canonical artifact.
 *
 * They are separate functions because they are separate *sessions* in the normal
 * case. `openRequest` files a durable question and, if a transport happens to be
 * reachable, answers it in the same breath. `applyAnswer` exists for every other
 * case: the transport was absent, the session was killed, the answer arrived
 * hours later through git. Neither depends on the other having run in the same
 * process, and that is the property the whole design is for.
 *
 * Everything that moves — the clock — is passed in. These are the functions the
 * tests drive, and a function that read `Date.now()` internally could not be
 * tested for the determinism the merge depends on.
 */

import { emptyArtifact, mergeResearch } from './merge.js';
import { buildRequest, hermesPrompt } from './brief.js';
import {
  closeRequest,
  listRequests,
  loadArtifact,
  loadDelta,
  loadRequest,
  saveAnswer,
  saveArtifact,
  saveRequest,
} from './store.js';

import type { CapabilityError } from '../platform/types.js';
import type { HermesClient } from './hermes.js';
import type { ResearchArtifact, ResearchDelta, ResearchRequest, ResearchSubject } from './types.js';

/* ------------------------------------------------------------------ */
/* Opening a request                                                   */
/* ------------------------------------------------------------------ */

export interface OpenRequestOptions {
  /** Directory research is stored in — tracked by git, not `output/`. */
  readonly root: string;
  readonly subject: ResearchSubject;
  readonly query: string;
  readonly fields: readonly string[];
  readonly notes: string | null;
  /** ISO 8601. Supplied, never read from a clock inside. */
  readonly now: string;
  /** Optional: something that can answer inside this session. */
  readonly client: HermesClient | null;
  readonly signal?: AbortSignal | undefined;
}

export interface OpenRequestResult {
  readonly request: ResearchRequest;
  readonly requestPath: string;
  /** The instructions, whatever the transport. Printable, pasteable, storable. */
  readonly prompt: string;
  /**
   * True when an identical question was already open.
   *
   * Not an error, and not a reason to stop: the request id is a hash of the
   * subject, question and fields, so two sessions reaching the same conclusion
   * write the same file. Reporting it is what stops the second session from
   * asking Hermes to do work the first already asked for.
   */
  readonly alreadyOpen: boolean;
  /** The artifact as it stands — after the merge, when one happened. */
  readonly artifact: ResearchArtifact;
  /** Present when a transport answered inside this session. */
  readonly answered: AnsweredNow | null;
  /** Present when no transport could answer. The request is still filed. */
  readonly unanswered: CapabilityError | null;
}

export interface AnsweredNow {
  readonly delta: ResearchDelta;
  readonly answerPath: string;
  readonly artifactPath: string;
  readonly applied: boolean;
}

/**
 * Files a research request, and fulfils it if anything can.
 *
 * The order matters and is deliberate: the request is persisted **before** the
 * transport is tried. A transport that hangs, crashes the process, or returns
 * something unparseable leaves a well-formed question on disk either way, and
 * the session that follows starts from it rather than from nothing.
 */
export async function openRequest(options: OpenRequestOptions): Promise<OpenRequestResult> {
  const { root, subject, query, fields, notes, now, client, signal } = options;

  const existing = await loadArtifact(root, subject.key);
  const artifact = existing ?? emptyArtifact(subject);

  const request = buildRequest({ subject, query, fields, artifact: existing, requestedAt: now, notes });
  const alreadyOpen = (await loadRequest(root, request.requestId)) !== null;

  // Rewritten even when already open: `requestedAt` moves, and a question asked
  // twice is worth showing as recently wanted rather than stale.
  const requestPath = await saveRequest(root, request);
  const prompt = hermesPrompt(request);

  if (client === null) {
    return { request, requestPath, prompt, alreadyOpen, artifact, answered: null, unanswered: null };
  }

  // Covers the transport-less client too: it answers with the structured reason
  // rather than throwing, which is the whole point of the outcome vocabulary.
  const outcome = await client.research(request, signal);
  if (!outcome.ok) {
    return { request, requestPath, prompt, alreadyOpen, artifact, answered: null, unanswered: outcome.error };
  }

  const applied = await applyDelta({ root, delta: outcome.data, request });
  return {
    request,
    requestPath,
    prompt,
    alreadyOpen,
    artifact: applied.artifact,
    answered: {
      delta: outcome.data,
      answerPath: applied.answerPath,
      artifactPath: applied.artifactPath,
      applied: applied.applied,
    },
    unanswered: null,
  };
}

/* ------------------------------------------------------------------ */
/* Applying an answer                                                  */
/* ------------------------------------------------------------------ */

export interface ApplyDeltaOptions {
  readonly root: string;
  readonly delta: ResearchDelta;
  /**
   * The request being answered. Its scope is recorded on the pass — what was
   * *asked* is provenance, and a researcher should not define its own remit.
   */
  readonly request: ResearchRequest;
}

export interface ApplyDeltaResult {
  readonly artifact: ResearchArtifact;
  readonly artifactPath: string;
  readonly answerPath: string;
  /** False when this exact pass was already in the chain. */
  readonly applied: boolean;
}

/**
 * Merges one delta into the subject's artifact and persists everything.
 *
 * The answer is written before the merge, so the receipt survives even if the
 * merge is the thing that fails. Re-running this with the same delta is safe:
 * the merge recognises a pass it has already recorded and changes nothing.
 */
export async function applyDelta(options: ApplyDeltaOptions): Promise<ApplyDeltaResult> {
  const { root, delta, request } = options;

  const answerPath = await saveAnswer(root, delta);

  const existing = await loadArtifact(root, request.subject.key);
  const previous = existing ?? emptyArtifact(request.subject);

  const { artifact, applied } = mergeResearch(previous, delta, request.scope);
  const artifactPath = await saveArtifact(root, artifact);

  // Only once the artifact is safely on disk: a request closed before its
  // answer was stored would be a question nobody knows to ask again.
  if (applied) await closeRequest(root, request.requestId);

  return { artifact, artifactPath, answerPath, applied };
}

export interface ApplyAnswerFileOptions {
  readonly root: string;
  /** Path to a `ResearchDelta` JSON file — from Hermes, or hand-written. */
  readonly deltaPath: string;
}

/**
 * Applies an answer that arrived out of band.
 *
 * The path a new session takes when the previous one only got as far as filing
 * the question: read the delta, find the request it answers, merge. A delta
 * naming a request that is not on disk is refused rather than merged with an
 * invented scope — the provenance chain would otherwise record a pass whose
 * remit nobody ever set.
 */
export async function applyAnswerFile(options: ApplyAnswerFileOptions): Promise<ApplyDeltaResult> {
  const { root, deltaPath } = options;

  const delta = await loadDelta(deltaPath);
  const request = await loadRequest(root, delta.requestId);

  if (request === null) {
    const open = await listRequests(root);
    const known = open.length === 0 ? 'none are open' : open.map((entry) => entry.requestId).join(', ');
    throw new Error(
      `${deltaPath} answers request "${delta.requestId}", which is not in ${root}/requests (${known}). ` +
        'Merging it would record a pass with no recorded question.',
    );
  }

  return applyDelta({ root, delta, request });
}
