# Appendix — Supplementary Raw Taxonomies & Reconciliation

*Companion to `BUSINESSFORGE_EXPERIENCE_ARSENAL_v1.md`. Research-only; no repo modified.*

## A. What the async research batch produced

A parallel fan-out of 3 subagents attempted to build standalone pattern taxonomies. Because the live browser (`browser_exec`) was broken in this environment (a `pydantic_core` ABI crash in the browser-use venv), all three pivoted to HTTP doc-fetches. Result on disk:

| File | Status | Patterns | Evidence basis |
|---|---|---|---|
| `01_entry_nav_cursor.md` | **present** (805 lines) | 35 (10 entry + 14 nav + 11 cursor) | Official docs (MDN, GSAP, Lenis, Can I Use, Chrome Dev, three.js) + confirmed HTTP-200 studio URLs; studio-site specific techniques marked INFERRED |
| `02_layout_scroll_type.md` | **present** (942 lines) | 41 (15 layout + 17 scroll + 9 typography) | Same doc-backed method; 67 URL citations; in-workspace Awwwards teardown reused |
| `03_image_video_audio_motion_micro.md` | **ABSENT** | n/a | **Subagent 3 self-reported "completed, 806 lines" but the file was never written.** Classic child-self-report inaccuracy. NOTE: its full scope is already covered inside the main v1 deliverable §10–§14, so there is no research gap. |

**Recommendation:** `01` and `02` are useful *breadth* evidence (they enumerate more individual named techniques than the v1 synthesis). They should be treated as **raw reference**, not as the deliverable — the v1 document is the synthesized, CRAV-grounded, BusinessForge-wired result the brief asked for. Fold specific patterns from `01`/`02` into the capability registry schema (§29 of v1) as needed; do not paste them verbatim as "the arsenal."

## B. Reconciliation notes (discrepancies to fix before registry adoption)

1. **Locomotive Scroll is DEPRECATED — do not adopt.**
   - `02` lists `Locomotive Scroll (pin)` and `GSAP; Lenis; Locomotive` as providers in two patterns (lines ~286, ~308).
   - **Correction (verified live on GitHub):** Locomotive Scroll is unmaintained/deprecated. BusinessForge standard is **Lenis** for smooth/inertia scroll, **GSAP ScrollTrigger** for pin/scrub. Remove Locomotive from any provider list. (v1 §13 / §24 already state this correctly.)
2. **CRAV was reverse-engineered separately and authoritatively in v1 §2.**
   - The async batch did **not** analyze CRAV (it could not run a browser). The v1 CRAV finding stands as the authoritative technical read: **Next.js/Turbopack + Lenis + GSAP/ScrollTrigger + Framer Motion + lerp custom cursor; NO WebGL/Three.js on the homepage.** Do not let any standalone file's generic "WebGL cursor distortion" pattern be applied to CRAV.
3. **Evidence grading.** Async patterns that name studio sites (Active Theory, Resn, Dogstudio, 14islands, Immersive Garden, Monogrid, Cuberto) as examples are correctly marked INFERRED (their live DOM was not probed). Keep them INFERRED until a real DOM/JS inspection confirms. The v1 CRAV patterns are OBSERVED (code-extracted).
4. **No contradiction on motion-system doctrine.** Both `01`/`02` and v1 agree: one coherent motion language, reduced-motion as a designed branch, accessibility floor, anti-template. Consistent.

## C. How to use these files

- `BUSINESSFORGE_EXPERIENCE_ARSENAL_v1.md` = **the deliverable** (read this first).
- `01_entry_nav_cursor.md`, `02_layout_scroll_type.md` = **raw technique dictionaries** for the Experience Director / capability-planner to mine when expanding the registry beyond the v1's 60+ named capabilities.
- Missing `03` = no action needed (covered in v1 §10–§14).

## D. Open items carried forward

- Re-run a real DOM/JS probe of the named studio sites (Active Theory et al.) to upgrade their patterns from INFERRED → OBSERVED once `browser_exec` is repaired (fix: clear `PYTHONPATH` so browser-use uses its own uv-venv pydantic, not the 3.11 hermes site-packages).
- Build the "interaction composition" library (preloader → hero → cursor → scroll-story → functional → transition) with context tags — proposed in v1 §32.
