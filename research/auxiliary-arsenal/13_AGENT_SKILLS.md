# 13 — AGENT SKILLS

> Reusable skills. The repo ALREADY has a skill system (`lib/platform/skills/*` loader/
> registry/manager). This maps external skills to adopt/adapt/study/reject. SECURITY-first.

## A. Skills observed (OBSERVED)
- **Higgsfield skills:** `npx skills add higgsfield-ai/skills` (OBSERVED higgsfield.ai/cli).
  Agent-native media generation skills. → **ADAPT** into BF skill (media generation via
  Higgsfield MCP/CLI). P0.
- **Firecrawl agent onboarding:** `https://www.firecrawl.dev/agent-onboarding/SKILL.md`
  (OBSERVED) + `auth.md`. → **ADOPT** as research specialist skill. P0.
- **screenshot-to-code** run skill (local FastAPI) → **STUDY** (see 02). P2.

## B. Skill categories to BUILD internally (reuse repo skill loader)
| Skill | Triggers | Uses | Priority |
|---|---|---|---|
| `research-specialist` | evidence_research | Firecrawl/Tavily/Exa + Maps | P0 |
| `visual-archaeologist` | reference screenshot | Playwright + vision LLM | P1 |
| `design-token-compiler` | blueprint | Style Dictionary | P1 |
| `media-generator` | image/video/3D request | Higgsfield/(fal/Replicate) | P0 (gated) |
| `voice-generator` | audio request | Kokoro-local/ElevenLabs(gated) | P2 |
| `visual-qa-judge` | post-render | Playwright + multimodal LLM | P0 (exists as critic) |
| `a11y-scanner` | pre-prod | axe-core/Axe MCP | P1 |
| `perf-scanner` | pre-prod | Lighthouse | P1 |
| `security-scanner` | pre-prod | Semgrep + npm audit | P1 |
| `functional-assembler` | module request | Cal.com/Supabase/Stripe/etc. | P0 (exists functionalModules) |
| `deploy-publisher` | production | GitHub/Cloudflare MCP | P1 |

## C. Adopt / Adapt / Study / Reject
- **ADOPT:** Higgsfield skills, Firecrawl SKILL.md, internal QA/security skills.
- **ADAPT:** external media/research skills → wrap in BF skill contract (no vendor SDK
  imported outside adapter; consistent with `providers.md` rule).
- **STUDY:** screenshot-to-code skill (pattern only), any "AI website builder" skill
  (REJECT for production — defeats determinism).
- **REJECT:** skills that (a) require committing secrets, (b) run unsafe arbitrary shell
  without sandbox, (c) pull untrusted remote code at runtime, (d) auto-publish without
  human gate, (e) claim to "generate the whole site" bypassing the pipeline.

## D. Security rules for skills (mandatory)
1. No skill may read/write outside its sandboxed workspace without explicit approval.
2. No skill may exfiltrate client evidence to third parties not in the allow-list.
3. Skills importing vendor SDKs must go through the adapter layer (existing contract).
4. Every skill output passes the `output_security` gate before use.
5. Prompt-injection: skills consuming web/scraped content treat it as untrusted.

## E. Where skills live
`lib/platform/skills/builtin/` (EXISTS). New BF skills added there; external skills
adapted, never blindly installed.
