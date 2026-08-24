#!/usr/bin/env bash
#
# Starts the stage server configured for ONE clean run on the Gemini free tier.
#
#   bash scripts/n8n/start-stage-server.sh
#
# ## Why the settings are what they are
#
# The free tier's binding limit is not tokens or requests-per-minute, it is
# `GenerateRequestsPerDayPerProjectPerModel-FreeTier` = **20 requests per day
# per model**. A full Factory V1 run spends about six of them — intake,
# research, analyst, writer, director, visual critic — plus one per repair
# iteration. Diverge and jury spend none: their perturbations and scoring are
# deterministic.
#
# That budget is only comfortable if nothing wastes it, which is why
# `AI_MAX_RETRIES=0`. The default of 3 turns one 429 into four spent requests,
# and on a daily cap a retry storm does not recover the run — it ends the day.
#
# The visual critic reaches Gemini through the OpenAI-compatibility endpoint, so
# it draws on the *same* project quota. It is counted above deliberately.
set -euo pipefail

cd "$(dirname "$0")/../.."

# The design director is the difference between "a page" and a directed one, and
# the brief asks for something memorable rather than a template.
export DIRECTOR_ENABLED=true

# One credentialled vendor. Anthropic and OpenRouter have no key on this
# deployment and are reported `unavailable` rather than silently skipped;
# OpenAI is credentialled but paid, so it stays out of the pool until the
# founder says otherwise.
export BF_POOL=gemini
export BF_POOL_RESEARCH=gemini
export BF_POOL_CONTENT=gemini
export BF_POOL_DESIGN=gemini

# Never spend a retry against a daily cap. See above.
export AI_MAX_RETRIES=0

# Keep the analyst's budget modest; the default 32k at `high` is far more
# thinking than a strategy for a dessert shop needs.
export ANALYST_EFFORT=medium
export ANALYST_MAX_OUTPUT_TOKENS=8000
export WRITER_MAX_OUTPUT_TOKENS=12000

# Vision for the visual critic, through Gemini's OpenAI-compatible endpoint.
export VISION_API_KEY="$(grep '^GEMINI_API_KEY=' .env | cut -d= -f2-)"
export VISION_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
export VISION_MODEL="gemini-3.6-flash"

exec npx tsx --env-file=.env scripts/n8n/stage-server.ts
