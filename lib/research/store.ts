/**
 * Where research lives on disk, and the only code that puts it there.
 *
 * Research artifacts are **committed to the repository**, unlike run artifacts
 * under `output/`, and that is the whole resume story. A session works in a
 * container that is destroyed when it ends; the next session gets a fresh clone.
 * Anything a later session must be able to read has to survive in git, so this
 * store writes to a tracked directory and nowhere else.
 *
 *   research/
 *     <key>.research.json            the canonical artifact — source of truth
 *     requests/<requestId>.json      open questions, oldest first
 *     answers/<requestId>.json       what Hermes actually returned, kept verbatim
 *
 * The answers directory is not redundant with the artifact. The artifact is the
 * merged state; the answer is the receipt. Keeping both means a claim can always
 * be traced back past the merge to the exact message that introduced it, which
 * is what makes "every Hermes claim remains attributable" true of the storage
 * and not only of the schema.
 *
 * Every write goes through a temporary file and a rename, the same way
 * `main.ts` persists a stage: an interrupted write must not leave a half-written
 * artifact that the next session then fails to parse.
 */

import path from 'node:path';
import fs from 'node:fs/promises';

import { InvalidInputError } from '../errors.js';
import { parseArtifact, parseDelta, parseRequest } from './validate.js';

import type { ResearchArtifact, ResearchDelta, ResearchRequest } from './types.js';

const SOURCE = 'research';

/** Subdirectories, relative to the research root. */
const REQUESTS = 'requests';
const ANSWERS = 'answers';

/** Artifact filename suffix. Distinctive enough to glob for. */
const ARTIFACT_SUFFIX = '.research.json';

export interface ResearchPaths {
  readonly root: string;
  readonly artifact: string;
  readonly requestsDir: string;
  readonly answersDir: string;
}

export function researchPaths(root: string, key: string): ResearchPaths {
  return {
    root,
    artifact: path.join(root, `${key}${ARTIFACT_SUFFIX}`),
    requestsDir: path.join(root, REQUESTS),
    answersDir: path.join(root, ANSWERS),
  };
}

/* ------------------------------------------------------------------ */
/* Reading and writing                                                 */
/* ------------------------------------------------------------------ */

/** Two spaces and a trailing newline — the repository's JSON house style. */
function serialise(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeAtomic(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, contents, 'utf8');
  await fs.rename(tempPath, filePath);
}

/** `null` when the file is not there; throws when it is there and unreadable. */
async function readJson(filePath: string): Promise<unknown | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new InvalidInputError(`${filePath} is not valid JSON`, SOURCE, error);
  }
}

/* ------------------------------------------------------------------ */
/* Artifacts                                                           */
/* ------------------------------------------------------------------ */

/**
 * Loads a subject's artifact.
 *
 * `null` means no research has ever been filed for this business, which is a
 * normal state and not an error — the caller starts from `emptyArtifact`. A file
 * that exists but does not validate *is* an error: an artifact that silently
 * degraded to "no research" would send the next session out to redo work that is
 * sitting on disk.
 */
export async function loadArtifact(root: string, key: string): Promise<ResearchArtifact | null> {
  const { artifact } = researchPaths(root, key);
  const parsed = await readJson(artifact);
  if (parsed === null) return null;
  return parseArtifact(parsed, artifact);
}

export async function saveArtifact(root: string, artifact: ResearchArtifact): Promise<string> {
  const { artifact: filePath } = researchPaths(root, artifact.subject.key);
  await writeAtomic(filePath, serialise(artifact));
  return filePath;
}

/** Subject keys with an artifact on disk, sorted. */
export async function listSubjects(root: string): Promise<readonly string[]> {
  let entries: readonly string[];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.endsWith(ARTIFACT_SUFFIX))
    .map((entry) => entry.slice(0, -ARTIFACT_SUFFIX.length))
    .sort();
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export async function saveRequest(root: string, request: ResearchRequest): Promise<string> {
  const filePath = path.join(root, REQUESTS, `${request.requestId}.json`);
  await writeAtomic(filePath, serialise(request));
  return filePath;
}

export async function loadRequest(root: string, requestId: string): Promise<ResearchRequest | null> {
  const filePath = path.join(root, REQUESTS, `${requestId}.json`);
  const parsed = await readJson(filePath);
  if (parsed === null) return null;
  return parseRequest(parsed, filePath);
}

/**
 * Every request on disk, oldest first.
 *
 * Unreadable entries are reported rather than skipped: a request file that
 * cannot be parsed is a question nobody will ever answer, and a listing that
 * quietly omitted it would make it invisible instead of broken.
 */
export async function listRequests(root: string): Promise<readonly ResearchRequest[]> {
  const dir = path.join(root, REQUESTS);

  let entries: readonly string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const requests: ResearchRequest[] = [];
  for (const entry of entries.filter((name) => name.endsWith('.json')).sort()) {
    const filePath = path.join(dir, entry);
    const parsed = await readJson(filePath);
    if (parsed !== null) requests.push(parseRequest(parsed, filePath));
  }

  return requests.sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0));
}

/**
 * Removes an answered request.
 *
 * Called after a delta merges. The request has served its purpose — the
 * provenance chain now records what was asked, on the pass — and leaving it in
 * `requests/` would tell the next session to research it again.
 */
export async function closeRequest(root: string, requestId: string): Promise<boolean> {
  const filePath = path.join(root, REQUESTS, `${requestId}.json`);
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Answers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Files what Hermes returned, verbatim, before it is merged.
 *
 * Named by request and research timestamp so a second pass answering the same
 * request does not overwrite the first one's receipt.
 */
export async function saveAnswer(root: string, delta: ResearchDelta): Promise<string> {
  const stamp = delta.researchedAt.replace(/[:.]/g, '-');
  const filePath = path.join(root, ANSWERS, `${delta.requestId}-${stamp}.json`);
  await writeAtomic(filePath, serialise(delta));
  return filePath;
}

/** Reads a delta from any path — a saved answer, or a file Hermes just wrote. */
export async function loadDelta(filePath: string): Promise<ResearchDelta> {
  const parsed = await readJson(filePath);
  if (parsed === null) {
    throw new InvalidInputError(`${filePath} is not there`, SOURCE);
  }
  return parseDelta(parsed, filePath);
}
