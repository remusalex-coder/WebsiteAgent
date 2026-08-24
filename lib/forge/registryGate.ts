/**
 * Runtime-primitive registry gate — the one deliberate `lib/forge` →
 * `lib/design` import boundary crossing.
 *
 * `lib/design/experienceRegistry.ts`'s rule is "declare it, do not silently
 * reach for it": a `RuntimePrimitiveId` may only ship if it has earned
 * `status: 'exists'` and `integrationMode: 'runtime-primitive'`, checked by
 * `executablePrimitiveIds()`. The classic pipeline (`main.ts`'s Director →
 * `resolvePrimitives`) already goes through that gate. Forge's builder never
 * did — `buildFrontend`'s prompt recommends GSAP/ScrollTrigger/Lenis/Three.js
 * (`lib/forge/motion.ts`) and the model is free to add CDN `<script>` tags
 * for any of them with no check against what this pipeline has actually
 * vendored and can serve offline. This module is that check.
 *
 * `checkMotionLibraryUsage` (`antiPatternSignals.ts`) already answers "is a
 * called library actually loaded" — a functional-correctness question. This
 * answers a different one: "is this library one BusinessForge is allowed to
 * ship at all, and does the build stay within `RUNTIME_PRIMITIVE_BUDGET`."
 * Both feed the same `AntiAIGateResult.flags`.
 */

import { executablePrimitiveIds } from '../design/experienceRegistry.js';
import { RUNTIME_PRIMITIVE_BUDGET } from '../design/experience.js';
import type { RuntimePrimitiveId } from '../design/experience.js';
import type { GeneratedCode } from './types.js';
import type { AntiPatternFlag } from './antiPatternSignals.js';

/** One runtime library's detection signal and the registry id it stands for, when it has one. */
interface LibraryRegistryMapping {
  readonly name: string;
  readonly usage: RegExp;
  /** `null` for a library with no registry entry at all — always ungated. */
  readonly primitiveId: RuntimePrimitiveId | null;
}

/**
 * Every runtime library `lib/forge/motion.ts` might recommend or a build
 * might otherwise reach for, mapped to its `RuntimePrimitiveId` — or `null`
 * when none exists yet (OGL: deliberately dropped from `motion.ts`'s
 * `immersive` recommendation rather than given a stub entry here, since no
 * vendored adapter exists — see that file's own note).
 */
const LIBRARY_REGISTRY_MAPPINGS: readonly LibraryRegistryMapping[] = [
  { name: 'GSAP+ScrollTrigger', usage: /\bScrollTrigger\s*\./, primitiveId: 'gsap-scrolltrigger' },
  { name: 'GSAP', usage: /\bgsap\s*\./, primitiveId: 'gsap-scrolltrigger' },
  { name: 'Lenis', usage: /\bnew\s+Lenis\s*\(/, primitiveId: 'lenis-smooth-scroll' },
  { name: 'Three.js', usage: /\bTHREE\s*\./, primitiveId: 'three-js-hero-object' },
  { name: 'OGL', usage: /\bfrom\s+['"]ogl['"]|\bnew\s+(?:Renderer|Camera|Transform)\s*\(/, primitiveId: null },
];

/**
 * Checks every runtime library the generated code actually calls against the
 * primitive registry: unmapped or unregistered libraries fail outright, and
 * a build using more distinct registered primitives than
 * `RUNTIME_PRIMITIVE_BUDGET` allows fails as an over-budget build — the same
 * budget `resolvePrimitives` enforces for the classic pipeline.
 */
export function checkRuntimePrimitiveRegistryGate(code: GeneratedCode): AntiPatternFlag[] {
  const flags: AntiPatternFlag[] = [];
  const executable = new Set(executablePrimitiveIds());
  const usedIds = new Set<RuntimePrimitiveId>();

  for (const { name, usage, primitiveId } of LIBRARY_REGISTRY_MAPPINGS) {
    if (!usage.test(code.js)) continue;

    if (primitiveId === null) {
      flags.push({
        code: 'RUNTIME_PRIMITIVE_UNREGISTERED',
        severity: 'fail',
        message: `experience.js uses ${name}, which has no entry in lib/design/experienceRegistry.ts — "declare it, do not silently reach for it" means an unregistered runtime library may not ship.`,
        evidence: name,
      });
      continue;
    }

    if (!executable.has(primitiveId)) {
      flags.push({
        code: 'RUNTIME_PRIMITIVE_NOT_EXECUTABLE',
        severity: 'fail',
        message: `experience.js uses ${name}, which maps to registry id "${primitiveId}", but that entry is not status:'exists'/integrationMode:'runtime-primitive' — it has not earned a real, shipped adapter yet.`,
        evidence: primitiveId,
      });
      continue;
    }

    usedIds.add(primitiveId);
  }

  if (usedIds.size > RUNTIME_PRIMITIVE_BUDGET) {
    flags.push({
      code: 'RUNTIME_PRIMITIVE_BUDGET_EXCEEDED',
      severity: 'fail',
      message: `experience.js uses ${usedIds.size} distinct registered runtime primitives (${[...usedIds].join(', ')}), over the budget of ${RUNTIME_PRIMITIVE_BUDGET} every pipeline output must respect.`,
      evidence: [...usedIds].join(', '),
    });
  }

  return flags;
}
