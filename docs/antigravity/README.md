# BusinessForge — Antigravity Knowledge & Forensics Archive

## 1. Executive Summary

This directory (`docs/antigravity/`) is the dedicated, authoritative knowledge bridge consolidating all architectural audits, design forensics, prompt engineering strategies, execution logs, and experimental benchmarks conducted during the **Antigravity AI Autonomous Coding Sessions** (August 16–18, 2026).

Its mission is to ensure that critical design intelligence, empirical lessons, and prompt forensics generated in Antigravity do not remain isolated in `.gemini/antigravity/brain/`, but are permanently preserved within the BusinessForge repository for Claude, Hermes, n8n, human engineers, and future agentic pipelines.

---

## 2. Directory Structure & Document Map

```
docs/antigravity/
├── README.md                 # This overview, provenance rules, and taxonomy
├── WORKSPACE_MAP.md          # Complete map of Antigravity brain workspaces & file origins
├── DESIGN_FORENSICS.md       # Grounded forensic analysis of design evolution & visual shifts
├── WORKFLOW_FORENSICS.md     # Agent execution flows, tool orchestration & two-pass builder
├── PROMPT_FORENSICS.md       # Exact system prompts, schemas, and prompting strategies used
├── EXPERIMENTS.md            # Detailed experiment logs (Go Sweet, River Park V1, V2, Token Cutoff)
└── ARTIFACT_INDEX.md         # Master index of all artifacts, JSON dossiers, logs, and screenshots
```

---

## 3. Epistemic Taxonomy & Status Tags

Every piece of forensic evidence in this archive is strictly tagged according to its reconciliation status:

- `[ALREADY_PRESENT]`: The knowledge is already codified in the main codebase (e.g. `lib/forge/`, `docs/EXPERIENCE_SIGNATURE_PIPELINE.md`, `README.md`).
- `[ANTIGRAVITY_ONLY]`: The knowledge (such as specific failure traces, token exhaustion diagnostics, or conversation thought processes) was discovered and extracted exclusively from Antigravity brain logs.
- `[PARTIALLY_RECONCILED]`: The concept is present in BusinessForge but has deeper historical context or implementation nuance in Antigravity.
- `[UNVERIFIED]`: Hypotheses or claims that lack direct textual or photographic proof and are flagged as unverified inferences.

---

## 4. Provenance Metadata Format

All forensic entries follow this standard attribution schema:

```
SOURCE: <Antigravity Task / Brain Log / Run Output>
ORIGINAL_PATH: <Absolute or Relative Filepath>
DATE: <ISO 8601 Timestamp>
TYPE: <Architecture | Design | Prompt | Experiment | Log>
STATUS: <ALREADY_PRESENT | ANTIGRAVITY_ONLY | PARTIALLY_RECONCILED | UNVERIFIED>
BUSINESSFORGE_DESTINATION: <Repository Path>
```
