# Antigravity Workspace Map

## 1. Primary Antigravity Workspaces

### Workspace 1: The BusinessForge 2.0 & Experience Signature Session
- **Conversation ID / Workspace ID**: `0a5d9d24-65c0-4a7a-8ccb-e914ffe9660f`
- **Disk Path**: `C:\Users\40728\.gemini\antigravity\brain\0a5d9d24-65c0-4a7a-8ccb-e914ffe9660f\`
- **Date Range**: 2026-08-16T22:04:49Z – 2026-08-18T00:45:00Z
- **Scope & Objectives**:
  1. Full system audit of `WebsiteAgent` to discover why legacy pipelines produced brochure websites.
  2. Construction of the autonomous vertical slice factory in `lib/forge/`.
  3. Execution of the Go Sweet & More Sibiu benchmark (`forge-da56c149`).
  4. Execution of the initial River Park Events production run (`forge-d8073b04`).
  5. Conception and implementation of the **Experience Signature (V1)** pipeline with Factual Firewall, 3 Creative Territories, Two-Pass Frontend Builder, Anti-AI Gate, and Vision QA Critic (`forge-e94b778a`).
  6. Total documentation of the codebase.

---

## 2. Directory Structure of the Antigravity Brain Workspace

```
C:\Users\40728\.gemini\antigravity\brain\0a5d9d24-65c0-4a7a-8ccb-e914ffe9660f\
├── conversation_transcript_full.md       # Chronological transcript of all 7 session acts
├── full_system_documentation.md          # Consolidated master system documentation
├── implementation_plan.md                # Interactive planning artifact for the vertical slice
├── walkthrough.md                        # Production run walkthrough & comparison
├── scratch/                              # Temporary working scripts
├── .system_generated/
│   ├── logs/
│   │   └── transcript.jsonl              # Raw JSONL telemetry (390 steps, 676 KB)
│   ├── messages/                         # Inter-agent & timer notifications
│   └── tasks/
│       ├── task-89.log                   # Probe execution log
│       ├── task-128.log                  # Design memory search log
│       ├── task-238.log                  # Run log for Go Sweet (forge-da56c149)
│       ├── task-289.log                  # Run log for River Park V1 (forge-d8073b04)
│       ├── task-343.log                  # Failure trace log (forge-6aba5270 - 32k token cutoff)
│       └── task-351.log                  # Run log for River Park Signature V1 (forge-e94b778a)
```

---

## 3. Mapped Output Directories in BusinessForge Repository

The Antigravity session generated and interacted with these physical output directories in `C:\Users\40728\WebsiteAgent\output\`:

| Output Directory | Originating Task / Stage | Purpose & Assets Generated | Status Tag |
| :--- | :--- | :--- | :--- |
| `output/forge-da56c149/` | `task-238` (2026-08-16 22:20 UTC) | **Go Sweet Vertical Slice**: `site/index.html` (18.6 KB), `styles.css` (19.4 KB), `experience.js` (8.8 KB), `shots/` (desktop & mobile), `forge/` JSON dossiers. | `[ALREADY_PRESENT]` |
| `output/forge-d8073b04/` | `task-289` (2026-08-16 22:42 UTC) | **River Park Events Production V1**: `site/index.html` (32.4 KB), `styles.css` (24.1 KB), `experience.js` (14.3 KB), `shots/desktop.png` (598 KB), `shots/mobile.png` (301 KB). | `[ALREADY_PRESENT]` |
| `output/forge-6aba5270/` | `task-343` (2026-08-16 23:24 UTC) | **Failure Mode Trace**: Hit `MAX_TOKENS` cutoff at 32,000 tokens during single-pass generation. Led to the Two-Pass Builder innovation. | `[ANTIGRAVITY_ONLY]` |
| `output/forge-e94b778a/` | `task-351` (2026-08-16 23:28 UTC) | **River Park Experience Signature V1**: `site/index.html` (30.5 KB), `styles.css` (7.6 KB), `experience.js` (12.3 KB), `forge/1-factual-dossier.json`, `2-territories.json`, `3-signature.json`, `4-blueprint.json`, `5-anti-ai-gate.json`, `6-critique-iter0.json`. | `[ALREADY_PRESENT]` |
| `output/riverpark/` | Pre-existing Legacy Harvest | Verified profile and 13 authentic photos in `assets/` (`hall-grand-chandelier-wide.jpg`, `hall-grand-firstdance-clouds.jpg`, etc.). | `[ALREADY_PRESENT]` |
| `output/gosweet1/` | Pre-existing Legacy Harvest | Baseline profile and assets for Go Sweet Sibiu used in Anti-AI gate comparison. | `[ALREADY_PRESENT]` |

---

## 4. Reconciliation Table of Antigravity Knowledge Assets

| Artifact Name | Original Disk Location | Destination in BusinessForge | Status |
| :--- | :--- | :--- | :--- |
| **System Audit Findings (18 parts)** | `transcript.jsonl` (Steps 0–30) | `docs/antigravity/DESIGN_FORENSICS.md` | `[PARTIALLY_RECONCILED]` |
| **Two-Pass Builder Architecture** | `lib/forge/builder.ts` & `task-343.log` | `docs/antigravity/WORKFLOW_FORENSICS.md` | `[ALREADY_PRESENT]` |
| **Factual Firewall Prompt & Schema** | `lib/forge/grounding.ts` | `docs/antigravity/PROMPT_FORENSICS.md` | `[ALREADY_PRESENT]` |
| **3 Creative Territories Definition** | `output/forge-e94b778a/forge/2-territories.json` | `docs/antigravity/DESIGN_FORENSICS.md` | `[ALREADY_PRESENT]` |
| **32K Token Exhaustion Diagnosis** | `task-343.log` | `docs/antigravity/EXPERIMENTS.md` | `[ANTIGRAVITY_ONLY]` |
| **Anti-AI Gate Heuristic Metrics** | `lib/forge/anti-ai-gate.ts` | `docs/antigravity/WORKFLOW_FORENSICS.md` | `[ALREADY_PRESENT]` |
| **Multi-Modal Vision QA Prompts** | `lib/forge/critic.ts` | `docs/antigravity/PROMPT_FORENSICS.md` | `[ALREADY_PRESENT]` |
| **Full Chronological Transcript** | `conversation_transcript_full.md` | `docs/antigravity/ARTIFACT_INDEX.md` | `[ALREADY_PRESENT]` |
