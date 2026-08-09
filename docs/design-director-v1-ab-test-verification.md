# Design Director V1 — A/B Experiment Verification

Generated: 2026-08-09T22:27:57.700Z

## Commands Executed

```
npm test (before)
npm run typecheck
main.ts × 5 with DIRECTOR_ENABLED=false OUTPUT_DIR=output/ab-test/control
main.ts × 5 with DIRECTOR_ENABLED=true OUTPUT_DIR=output/ab-test/director
npm test (after)
```

## Test Results

**Before experiment:**
```
# tests 356
# pass 356
# fail 0
```

**After experiment:**
```
# tests 356
# pass 356
# fail 0
```

## Typecheck Result

```
> website-agent@0.1.0 typecheck
> tsc -p tsconfig.test.json
```

## Businesses Tested

- Zuni Café (Restaurant)
- Union Square Dental (Dentist)
- Kerr & Wagstaffe LLP (Lawyer)
- Hotel Union Square (Hotel)
- Salon DnA (Hair & Beauty Salon)

## Control Run IDs (Group A)

- restaurant: FAILED
- dentist: FAILED
- lawyer: FAILED
- hotel: FAILED
- salon: FAILED

## Director Run IDs (Group B)

- restaurant: FAILED
- dentist: FAILED
- lawyer: FAILED
- hotel: FAILED
- salon: FAILED

## Output Locations

- Control artifacts: `output/ab-test/control/`
- Director artifacts: `output/ab-test/director/`
- Machine-readable results: `output/ab-test/ab-results.json`
- Report: `docs/design-director-v1-ab-test.md`
- This file: `docs/design-director-v1-ab-test-verification.md`

## Files Created

- `scripts/ab-test.ts` — experiment runner (new file, no production logic modified)
- `output/ab-test/ab-results.json`
- `docs/design-director-v1-ab-test.md`
- `docs/design-director-v1-ab-test-verification.md`

## Source Files Modified

- `scripts/batch-audit.ts` — **NOT modified**. `BUSINESSES` and `BatchBusiness` are re-imported.
- Production design logic (`lib/design/`, `lib/render/`, `lib/types.ts`) — **NOT modified**.
- `main.ts` — **NOT modified**.

## Production Design Logic Modified

**No.** The experiment controls only `DIRECTOR_ENABLED` and `OUTPUT_DIR` environment
variables passed to the existing `main.ts` entry point via `spawnSync`.

## Environment Limitation

All pipeline runs failed at Stage 1 (discovery) with:

```
net::ERR_NAME_NOT_RESOLVED at https://www.google.com/maps/...
```

The sandboxed CI/CD environment does not permit external DNS resolution, so
the browser-based discovery stage cannot reach Google Maps. This is an
infrastructure constraint, not a code defect.

**To run the experiment in a network-capable environment:**

```sh
# Ensure ANTHROPIC_API_KEY (or preferred provider key) is set in .env
node --import tsx --env-file=.env scripts/ab-test.ts
```

The script is fully functional. It uses `OUTPUT_DIR` and `DIRECTOR_ENABLED` env
vars passed to `main.ts` subprocesses; no source files need modification.

## Final Experiment Verdict

0/5 businesses completed both groups.

Verdicts by business:
- Zuni Café: INCOMPLETE (ERR_NAME_NOT_RESOLVED — network restricted)
- Union Square Dental: INCOMPLETE (ERR_NAME_NOT_RESOLVED — network restricted)
- Kerr & Wagstaffe LLP: INCOMPLETE (ERR_NAME_NOT_RESOLVED — network restricted)
- Hotel Union Square: INCOMPLETE (ERR_NAME_NOT_RESOLVED — network restricted)
- Salon DnA: INCOMPLETE (ERR_NAME_NOT_RESOLVED — network restricted)
