/**
 * Asset Intelligence — the decision layer this pipeline did not previously
 * have (confirmed by audit, 2026-08-19: `lib/render/assets.ts`'s
 * `AssetPlan` only places already-collected real photos on disk; nothing in
 * `lib/forge/` ever decided which images are real evidence, which should be
 * edited, which should be a non-depictive substitute, or which capability —
 * if any — would produce a missing one, and why).
 *
 * The goal is not "generate everything with AI". It is: real business
 * evidence first, a synthesized substitute only where the registry already
 * permits one honestly, and every decision to reach for a generation
 * capability recorded with its cost and gate — never executed here.
 *
 * ## Why this never calls a media-generation capability itself
 *
 * `image_editing` and `motion_media` are `gate: 'human'` in
 * `lib/capability/registry.ts`; `three_d_generation` is `gate: 'never'`
 * (frozen, F-18/the registry review). This module respects those gates by
 * construction: it produces a plan — a `CapabilityId`, a rationale, a cost
 * justification — and stops. Executing a gated capability autonomously
 * would be redesigning the anti-AI/media-gating architecture, which this
 * pass was explicitly told not to do. `orchestrator.ts`/`builder.ts` read
 * the plan to decide what to *say* about each asset slot in the generated
 * HTML (use this real photo / treat this slot as non-depictive texture /
 * this is a vector mark); nothing here reaches a network.
 *
 * ## Why a missing photo never becomes a synthesized photograph
 *
 * `image_nondepictive`'s own rationale in the registry: "a generated image
 * that appears to show the business is a fabricated fact." No capability in
 * this registry synthesizes a photorealistic depiction of the business from
 * nothing, on purpose — `image_editing` requires a real photograph as its
 * input, and nothing else touches photography. So an asset slot with no
 * backing real photo gets the same honest substitute the deterministic
 * floor already ships (a gradient/texture ground), not a fabricated stand-in.
 */

import type { CapabilityId } from '../capability/types.js';
import type { ExperienceSignature, FactualDossier, SourcedAsset } from './types.js';

export type AssetSource = 'real' | 'edited-real' | 'animated-real' | 'vector' | 'non-depictive' | 'unavailable';

export interface AssetDecision {
  readonly sceneId: string;
  readonly assetId: string;
  readonly source: AssetSource;
  readonly capability: CapabilityId | null;
  /** Mirrors the chosen capability's registry gate — 'none' when no capability is involved at all. */
  readonly gate: 'none' | 'human' | 'never';
  readonly rationale: string;
  readonly costJustification: string;
}

export interface AssetStrategy {
  readonly decisions: readonly AssetDecision[];
  readonly realAssetsUsed: number;
  readonly nonDepictiveSubstitutes: number;
  readonly humanGatedCandidates: number;
  readonly summary: string;
}

const MARK_WORDS = /icon|mark|logo|glyph|ornament|badge|monogram/i;

function decideMissingAsset(sceneId: string, assetId: string, sceneText: string): AssetDecision {
  if (MARK_WORDS.test(sceneText)) {
    return {
      sceneId,
      assetId,
      source: 'vector',
      capability: 'vector_generation',
      gate: 'none',
      rationale: `No real photograph backs "${assetId}", and the scene calls for a mark/icon/ornament, not a depiction of the business — vector geometry is inspectable before it ships (registry.ts), unlike generated photography.`,
      costJustification: 'Deterministic inline SVG/CSS — $0, no model call needed.',
    };
  }
  return {
    sceneId,
    assetId,
    source: 'non-depictive',
    capability: 'image_nondepictive',
    gate: 'none',
    rationale: `No real photograph backs "${assetId}". A synthesized photorealistic stand-in would depict something that does not exist — a fabricated fact, not a design choice (registry.ts's own rule for this capability). Falls back to the non-depictive texture/gradient treatment the deterministic floor already ships, which asserts nothing about the business.`,
    costJustification: 'Resolves to the deterministic gradient/texture floor at $0 unless a media-generation provider is credentialed — deciding this costs nothing by itself.',
  };
}

function decideRealAsset(
  sceneId: string,
  assetId: string,
  real: SourcedAsset,
  strategy: ExperienceSignature['experienceStrategy'],
): AssetDecision {
  const wantsEdit = strategy.mediaStrategy === 'ai-generated-imagery' || strategy.mediaStrategy === 'cinematic-hero-media';
  if (wantsEdit) {
    return {
      sceneId,
      assetId,
      source: 'edited-real',
      capability: 'image_editing',
      gate: 'human',
      rationale: `experienceStrategy.mediaStrategy is "${strategy.mediaStrategy}"; the real photograph ("${real.realDescription}") is the input to crop/relight — never synthesized. Held for human sign-off: Freeze O-6 (the right to redistribute a business's own social photographs) is unresolved.`,
      costJustification: 'Only justified if the plain photograph (source: "real", $0) cannot carry the scene on its own — image_editing has no bound provider today, so this executes as a no-op until a human approves it and a provider is credentialed.',
    };
  }
  return {
    sceneId,
    assetId,
    source: 'real',
    capability: null,
    gate: 'none',
    rationale: `Real photograph on file: "${real.realDescription}". Used exactly as collected — the cheapest and most honest option, and experienceStrategy.mediaStrategy ("${strategy.mediaStrategy}") does not call for altering it.`,
    costJustification: '$0 — already have it.',
  };
}

/**
 * Signature-level decisions that are not about any one scene's asset slot:
 * whether video/3D was actually justified by evidence, and — if so — what,
 * concretely, would serve it.
 */
function decideSignatureLevel(dossier: FactualDossier, strategy: ExperienceSignature['experienceStrategy']): AssetDecision[] {
  const decisions: AssetDecision[] = [];

  if (strategy.requiresVideo) {
    const candidate = dossier.realPhotoAssets[0];
    decisions.push({
      sceneId: '__signature__',
      assetId: candidate ? candidate.id : '__none__',
      source: candidate ? 'animated-real' : 'unavailable',
      capability: candidate ? 'motion_media' : null,
      gate: candidate ? 'human' : 'never',
      rationale: candidate
        ? `experienceStrategy.requiresVideo is true: "${strategy.requiresVideoRationale}". A real photograph exists to animate ("${candidate.realDescription}") — image-to-video from real material, not a synthesized scene. Held for human sign-off; motion_media is declared infrastructure with no bound provider yet.`
        : `experienceStrategy.requiresVideo is true ("${strategy.requiresVideoRationale}"), but no real photograph exists to animate. Synthesizing video from nothing is not a capability this registry offers — motion_media requires a real still as its input — so this requirement cannot be honestly served without more evidence.`,
      costJustification: candidate
        ? "Video generation is the most expensive media capability in the registry (\"expensive, slow, rarely better than a still\") — justified only because the signature named a specific rationale, never by default."
        : 'N/A — nothing to animate.',
    });
  }

  if (strategy.requires3D) {
    decisions.push({
      sceneId: '__signature__',
      assetId: '__none__',
      source: 'unavailable',
      capability: 'three_d_generation',
      gate: 'never',
      rationale: `experienceStrategy.requires3D is true: "${strategy.requires3DRationale}". three_d_generation is frozen (F-18/the registry review) and never invoked. Under this architecture, 3D is served by runtime_tier's procedural WebGL — shader code the renderer authors — which is a code capability, not a generated asset.`,
      costJustification: 'N/A — the frozen capability is never called; the real cost is the procedural-shader implementation effort, tracked under runtime_tier, not here.',
    });
  }

  return decisions;
}

/**
 * Plans, but never executes, the asset decision for every asset slot a
 * scene references. Deterministic and pure — same inputs, same plan, no
 * network call, safe to run on every build.
 */
export function planAssetStrategy(dossier: FactualDossier, signature: ExperienceSignature): AssetStrategy {
  const strategy = signature.experienceStrategy;
  const realById = new Map(dossier.realPhotoAssets.map((a) => [a.id, a] as const));
  const decisions: AssetDecision[] = [];

  for (const scene of signature.scenes) {
    const sceneText = `${scene.visualEffect ?? ''} ${scene.keyInteraction}`;
    for (const assetId of scene.assetIds) {
      const real = realById.get(assetId);
      decisions.push(
        real ? decideRealAsset(scene.id, assetId, real, strategy) : decideMissingAsset(scene.id, assetId, sceneText),
      );
    }
  }

  decisions.push(...decideSignatureLevel(dossier, strategy));

  const realAssetsUsed = decisions.filter((d) => d.source === 'real' || d.source === 'edited-real' || d.source === 'animated-real').length;
  const nonDepictiveSubstitutes = decisions.filter((d) => d.source === 'non-depictive').length;
  const humanGatedCandidates = decisions.filter((d) => d.gate === 'human').length;

  return {
    decisions,
    realAssetsUsed,
    nonDepictiveSubstitutes,
    humanGatedCandidates,
    summary: `${realAssetsUsed} real asset(s) used as evidence, ${nonDepictiveSubstitutes} non-depictive substitute(s) for asset slots with no matching photo, ${humanGatedCandidates} candidate(s) awaiting human sign-off before any gated media capability could run.`,
  };
}

/**
 * The prompt fragment `builder.ts`'s HTML pass includes so the model is told
 * exactly which asset slots are real and which are not, rather than left to
 * assume every id in `scenes[].assetIds` resolves to a real photograph.
 */
export function assetStrategyPrompt(strategy: AssetStrategy): string {
  if (strategy.decisions.length === 0) {
    return 'ASSET STRATEGY: no scene references any asset id.';
  }
  const lines = strategy.decisions
    .filter((d) => d.sceneId !== '__signature__')
    .map((d) => {
      switch (d.source) {
        case 'real':
        case 'edited-real':
          return `  - "${d.assetId}" (scene ${d.sceneId}): REAL — use the photograph from REAL PHOTO ASSETS AVAILABLE above.`;
        case 'vector':
          return `  - "${d.assetId}" (scene ${d.sceneId}): no real photograph — render as inline SVG/vector mark, not an <img>.`;
        case 'non-depictive':
          return `  - "${d.assetId}" (scene ${d.sceneId}): no real photograph — use a non-depictive CSS gradient/texture ground, never an <img> claiming to show the business.`;
        default:
          return `  - "${d.assetId}" (scene ${d.sceneId}): unavailable — omit imagery for this slot rather than inventing one.`;
      }
    });
  return `ASSET STRATEGY (decided in advance — do not treat every scenes[].assetIds entry as a real photograph):\n${lines.join('\n')}`;
}
