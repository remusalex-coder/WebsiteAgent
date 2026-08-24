/**
 * Conditional jury (Freeze P5-4, §1.2 margin ±5).
 *
 * The deterministic QA gates score every candidate before any vision call. The
 * jury's job is to spend vision only where the deterministic signal is
 * inconclusive:
 *
 *   - **Wide spread** (best − runner-up ≥ margin) → the deterministic ranking
 *     is decisive, one judge suffices, **zero vision calls**.
 *   - **Narrow spread** (best − runner-up < margin) → the deterministic signal
 *     cannot separate the leaders, so a second vision judge is called.
 *
 * "Wide spread → 0 vision calls" is the P5-4 acceptance test. This module is
 * pure: it decides and counts, the caller performs the calls.
 */

const SOURCE = 'qa.jury';

/** The frozen ±5 point margin that triggers k=2. */
export const JURY_MARGIN_POINTS = 5;

/** The frozen quality floor below which no candidate is deliverable (§1.2). */
export const QUALITY_FLOOR = 70;

export type JurySize = 1 | 2;

export interface JuryDecision {
  /** Number of vision judges that will run. 1 unless the spread is narrow. */
  readonly judgeCount: JurySize;
  /** Number of vision model calls this decision costs. 0 when wide. */
  readonly visionCalls: 0 | 1;
  /** The deterministic best quality score, 0–100. */
  readonly bestQuality: number;
  /** The deterministic second-best quality score, 0–100. */
  readonly runnerUpQuality: number;
  /** best − runner-up, in points. */
  readonly spread: number;
  /** Whether the margin (not the quality floor) forced a second judge. */
  readonly marginTriggered: boolean;
  /** Whether the best candidate failed the quality floor entirely. */
  readonly belowFloor: boolean;
  readonly rationale: string;
}

/**
 * Decides jury size from the candidates' deterministic quality scores.
 *
 * @param qualities  One quality per candidate — the `.quality` of each
 *                   candidate's `CombinedVerdict` from `combineVerdicts`
 *                   (best non-blocking dimension, already lexicographically
 *                   combined). In candidate order.
 * @param margin     Points of deterministic spread below which k=2. Defaults
 *                   to the frozen `JURY_MARGIN_POINTS`.
 */
export function decideJury(
  qualities: readonly number[],
  margin: number = JURY_MARGIN_POINTS,
): JuryDecision {
  const sorted = [...qualities].sort((a, b) => b - a);
  const bestQuality = sorted[0] ?? 0;
  const runnerUpQuality = sorted[1] ?? bestQuality;
  const spread = bestQuality - runnerUpQuality;

  const belowFloor = bestQuality < QUALITY_FLOOR;
  const hasRunnerUp = qualities.length > 1;
  const marginTriggered = hasRunnerUp && spread < margin && !belowFloor;

  if (marginTriggered) {
    return {
      judgeCount: 2,
      visionCalls: 1,
      bestQuality,
      runnerUpQuality,
      spread,
      marginTriggered,
      belowFloor,
      rationale: `deterministic spread ${spread.toFixed(1)} < ${margin.toFixed(1)}-point margin — second vision judge required`,
    };
  }

  return {
    judgeCount: 1,
    visionCalls: 0,
    bestQuality,
    runnerUpQuality,
    spread,
    marginTriggered,
    belowFloor,
    rationale: belowFloor
      ? `best quality ${bestQuality.toFixed(1)} below the ${QUALITY_FLOOR} floor — escalation, no judge spend`
      : `deterministic spread ${spread.toFixed(1)} >= ${margin.toFixed(1)}-point margin — one judge suffices`,
  };
}

/**
 * Judges that carry no vision call: a wide deterministic spread means the
 * structural fingerprints alone decide. Exported for the runner so the battle
 * never spends vision on a ranking the gates already settled.
 */
export function wantsSecondJudge(decision: JuryDecision): boolean {
  return decision.judgeCount === 2;
}

export const SOURCE_NAME = SOURCE;