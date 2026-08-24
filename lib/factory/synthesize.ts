/**
 * Research merge — many independent answers become one decision.
 *
 * Pure, deterministic, and no model. The pool has already spent the tokens; a
 * fifth model call to decide what four models meant would add a vendor's
 * opinion to a question that arithmetic answers, and would make the merge
 * unreproducible from the artifacts on disk.
 *
 * ## The one decision with teeth
 *
 * `searchQuery`. Everything else merged here is advisory text that reaches the
 * creative direction, but the search query decides which *real business* the
 * factory collects, and therefore what the finished website is about. It is
 * chosen by agreement across the pool — the query the most members proposed,
 * ties broken by the order the pool was declared in, so the same notes always
 * produce the same choice.
 */

import type { FactoryBrief } from './brief.js';
import type { ResearchNote } from './research.js';

export interface QueryVote {
  readonly query: string;
  readonly votes: number;
  readonly from: readonly string[];
}

export interface ResearchSynthesis {
  readonly brief: FactoryBrief;
  readonly notes: readonly ResearchNote[];
  /** The query the factory will actually search Maps for. */
  readonly searchQuery: string;
  /** Primary business URL from intake. */
  readonly businessUrl?: string | null | undefined;
  /** Optional secondary source URLs from intake. */
  readonly sourceUrls?: readonly string[] | undefined;
  /** Optional user instructions from intake. */
  readonly additionalInstruction?: string | null | undefined;
  /** How that query won, so a surprising choice is explicable. */
  readonly queryVotes: readonly QueryVote[];
  /** Union of what the pool said a site in this category must do. */
  readonly siteMustDo: readonly string[];
  readonly differentiators: readonly string[];
  readonly risks: readonly string[];
  readonly providersUsed: readonly string[];
  readonly synthesizedAt: string;
}

/** Case- and space-insensitive, so "Brutărie Sibiu" and "brutărie sibiu" agree. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Deduplicates while keeping first-seen order.
 *
 * Order matters downstream: these lists reach the creative direction as prose,
 * and a set that reshuffles per run would make two runs of the same order
 * produce gratuitously different briefs.
 */
function uniqueInOrder(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

/**
 * Merges the pool's notes into one synthesis.
 *
 * An empty `notes` is a valid input, not an error: the pool may be unstaffed or
 * every member may have failed, and the brief's own query is then the answer.
 * The factory degrades to "search for what the human typed" rather than
 * stopping, and the synthesis says so by carrying no votes.
 */
export function synthesizeResearch(
  brief: FactoryBrief,
  notes: readonly ResearchNote[],
): ResearchSynthesis {
  const tally = new Map<string, { query: string; from: string[] }>();

  for (const note of notes) {
    // One vote per member per distinct query — a member that lists the same
    // search twice does not get to outvote a member that listed it once.
    const seenHere = new Set<string>();
    for (const raw of note.searchQueries) {
      const key = normalizeQuery(raw);
      if (key === '' || seenHere.has(key)) continue;
      seenHere.add(key);
      const entry = tally.get(key) ?? { query: raw.trim(), from: [] };
      entry.from.push(note.authoredBy.provider);
      tally.set(key, entry);
    }
  }

  const queryVotes: QueryVote[] = [...tally.values()]
    .map((entry) => ({ query: entry.query, votes: entry.from.length, from: entry.from }))
    // Descending by agreement. `sort` is stable in every supported runtime, so
    // equal votes keep insertion order — which is pool declaration order.
    .sort((a, b) => b.votes - a.votes);

  const searchQuery = queryVotes[0]?.query ?? brief.searchQuery;

  return {
    brief,
    notes,
    searchQuery,
    businessUrl: brief.businessUrl ?? null,
    sourceUrls: brief.sourceUrls ?? [],
    additionalInstruction: brief.additionalInstruction ?? null,
    queryVotes,
    siteMustDo: uniqueInOrder(notes.flatMap((note) => note.siteMustDo)),
    differentiators: uniqueInOrder(notes.flatMap((note) => note.differentiators)),
    risks: uniqueInOrder(notes.flatMap((note) => note.risks)),
    providersUsed: uniqueInOrder(notes.map((note) => note.authoredBy.provider)),
    synthesizedAt: new Date().toISOString(),
  };
}

/**
 * The Maps URL the sourcing stage navigates.
 *
 * A *search* URL, not a place URL, and that is deliberate: `discoveryAgent`
 * already opens the first result of a result feed (`openPlacePane`), so the
 * factory does not need a second resolver that would drift from the one the
 * pipeline trusts. `hl=en` is added by `normalizeMapsUrl` — every extraction
 * strategy in that agent matches English labels.
 */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(query.trim())}`;
}
