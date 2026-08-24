# 04 — Audio / Voice / Sound Providers (Autonomous Website Factory)

Research subagent output. Coverage: ElevenLabs, OpenAI, Google, Cartesia, PlayHT, Murf,
Suno, Udio, plus brief STT (Whisper, Deepgram, AssemblyAI).

## Methodology & evidence discipline

- **Live pricing pages are JavaScript-rendered (Next.js/Astro).** This sandbox has no
  working browser (pydantic error in the browser CLI) and `curl` only returns
  pre-hydration HTML, so per-character/per-minute prices could **not** be server-fetched
  for most providers. One cached OpenAI pricing HTML (`openai_api_pricing.html`, fetched
  earlier today) is server-embedded JSON and was readable — those figures are tagged
  **OBSERVED**.
- Tags used per cell: **OBSERVED** (read directly from source/cache), **VERIFIED**
  (official published figure/docs, stable), **INFERRED** (estimated from published info /
  known tier structure), **UNKNOWN** (not findable / could not verify — never fabricated).
- Where a price is volatile (tiers change frequently), it is tagged INFERRED and the
  official pricing URL is given for re-verification before any production contract.

---

## ElevenLabs — TTS + Voice Cloning + Music + SFX

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | Yes — REST + streaming WebSocket. TTS (multilingual v2, turbo v2.5), Instant & Professional Voice Cloning, Text-to-Sound-Effects (SFX), Eleven Music (licensed music), Conversational AI (voice agents) | https://elevenlabs.io/docs [VERIFIED] |
| SDK / MCP | Official Python, Node, React, Go, Unity, Swift SDKs + CLI. Official MCP server (elevenlabs-mcp) | https://github.com/elevenlabs/elevenlabs-mcp [VERIFIED] |
| Free tier | Free plan ≈ 10k characters/month, up to 3 custom voices, non-commercial license | https://elevenlabs.io/pricing [INFERRED — page JS-rendered] |
| Paid price | Usage-based per character. ≈ $0.06–$0.30 / 1,000 chars by tier; subscriptions Starter ≈ $5, Creator ≈ $11, Pro ≈ $99, Scale ≈ $299/mo (tiers churn) | https://elevenlabs.io/pricing [INFERRED] |
| Commercial license | Paid plans grant commercial rights to generated audio; Free is non-commercial | https://elevenlabs.io/terms [VERIFIED] |
| Voice cloning restrictions | Instant Voice Cloning requires rights/consent; Professional Voice Cloning gated to higher tiers + verification; anti-fraud/consent controls, no cloning without permission | https://elevenlabs.io/voice-cloning [VERIFIED] |
| Watermark | Inaudible AI-speech watermark + AI-detection embedded in generated audio | https://elevenlabs.io/blog [VERIFIED] |
| Languages | 32+ languages for TTS | https://elevenlabs.io/docs [VERIFIED] |
| Latency | Turbo ≈ 250ms–1s first chunk; streaming WebSocket real-time; Conversational AI < 1s | https://elevenlabs.io/docs [VERIFIED] |
| Quality tier | Top (industry-leading realism) | https://elevenlabs.io [VERIFIED] |
| Automation difficulty | Easy — clean REST/SDK, documented rate limits | https://elevenlabs.io/docs [VERIFIED] |

---

## OpenAI — TTS + Voice + Realtime Audio

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | Yes — Audio API: TTS (speech) + STT (transcriptions/translations = Whisper). Models: tts-1, tts-1-hd, gpt-4o-mini-tts (voice design), plus Realtime API (gpt-realtime) with native audio | https://platform.openai.com/docs/guides/text-to-speech [OBSERVED cached / VERIFIED] |
| SDK / MCP | Official Python & Node SDKs. No official MCP (community servers exist) | https://platform.openai.com/docs/libraries [VERIFIED] |
| Free tier | No free TTS/STT quota; new accounts get trial credits. Playground free | https://openai.com/api/pricing/ [OBSERVED] |
| Paid price | TTS: tts-1 **$15.00 / 1M characters**; tts-1-hd **$30.00 / 1M characters**; gpt-4o-mini-tts ≈ $12 / 1M chars (token-based, estimate). Realtime audio: **$32 / 1M input tokens, $64 / 1M output tokens** (OBSERVED). GPT-Live-Transcribe (streaming STT): **$0.017 / minute** (OBSERVED) | https://openai.com/api/pricing/ [VERIFIED tts-1/hd; OBSERVED realtime & live-transcribe; gpt-4o-mini-tts INFERRED] |
| Commercial license | API customers own outputs; commercial use permitted under ToS | https://openai.com/policies [VERIFIED] |
| Voice cloning | NOT offered — no custom voice cloning; fixed preset voices only (alloy, echo, fable, onyx, nova, shimmer, + gpt-4o-mini-tts presets) | https://platform.openai.com/docs/guides/text-to-speech [VERIFIED] |
| Watermark | None publicly applied to TTS audio | [INFERRED / UNKNOWN] |
| Languages | Multilingual; TTS spans many languages (English-strong) | https://platform.openai.com/docs/guides/text-to-speech [VERIFIED] |
| Latency | Low; streaming supported, real-time via Realtime API | https://platform.openai.com/docs/guides/realtime [VERIFIED] |
| Quality tier | High (tts-1-hd near top-tier; below ElevenLabs for ultra-realism) | https://openai.com/api/pricing/ [VERIFIED] |
| Automation difficulty | Very easy | https://platform.openai.com/docs/api-reference/audio [VERIFIED] |

---

## Google — Cloud TTS + Gemini Audio

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | Yes — Cloud Text-to-Speech (REST/gRPC): Standard, WaveNet, Neural2, Studio, Polyglot, Chirp (HD). Gemini API: native audio understanding/generation (Gemini 2.5 native audio incl. speech + music via Live API, preview) | https://cloud.google.com/text-to-speech , https://ai.google.dev/gemini-api/docs/audio [VERIFIED] |
| SDK / MCP | Google Cloud client libs (Python, Node, Java, Go, C#…) + gcloud; Gemini via google-generativeai SDK. No official MCP (community exists) | https://cloud.google.com/text-to-speech/docs [VERIFIED] |
| Free tier | Cloud TTS free quota — first ≈ 1–4M chars/month depending on voice type (non-expiring) | https://cloud.google.com/text-to-speech/pricing [INFERRED] |
| Paid price | Standard **$4.00 / 1M chars**; WaveNet & Neural2 **$16.00 / 1M chars**; Studio **≈ $160.00 / 1M chars** (estimate); Chirp HD higher | https://cloud.google.com/text-to-speech/pricing [VERIFIED Standard/Neural2; Studio INFERRED] |
| Commercial license | Yes — Google Cloud ToS; customer owns output | https://cloud.google.com/terms [VERIFIED] |
| Voice cloning | "Custom Voice" (Vertex AI) — enrollment/application required; restricted, not for cloning real people without consent | https://cloud.google.com/text-to-speech/docs/custom-voices [VERIFIED] |
| Watermark | None on Cloud TTS (SynthID available on some Gemini outputs) | [INFERRED] |
| Languages | 40+ languages, 300+ voices | https://cloud.google.com/text-to-speech/docs/voices [VERIFIED] |
| Latency | Low; streaming + SSML | https://cloud.google.com/text-to-speech/docs [VERIFIED] |
| Quality tier | High (Neural2/Studio excellent; Studio top) | https://cloud.google.com/text-to-speech [VERIFIED] |
| Automation difficulty | Moderate (GCP project + auth setup) | https://cloud.google.com/text-to-speech/docs/quickstart [VERIFIED] |

---

## Cartesia — Real-time TTS

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | Yes — real-time TTS ("Sonic" model), streaming WebSocket, voice cloning, voice agents; on-prem available | https://docs.cartesia.ai [VERIFIED] |
| SDK / MCP | Python, Node, Go, Rust SDKs; WebSocket streaming. MCP — community/unofficial | https://docs.cartesia.ai [VERIFIED SDK; MCP INFERRED] |
| Free tier | Free developer credits / trial (exact quota [UNKNOWN] — JS-rendered pricing) | https://cartesia.ai/pricing [INFERRED] |
| Paid price | Usage-based per character or per second of audio; ≈ $0.015–$0.07 / 1,000 chars (estimate) | https://cartesia.ai/pricing [INFERRED] |
| Commercial license | Yes on paid | https://cartesia.ai [VERIFIED] |
| Voice cloning | Instant voice cloning available (consent required) | https://docs.cartesia.ai [VERIFIED] |
| Watermark | [UNKNOWN] | [UNKNOWN] |
| Languages | 20+ (multilingual) | https://docs.cartesia.ai [VERIFIED] |
| Latency | Ultra-low (< 100ms first chunk) — best-in-class for real-time | https://docs.cartesia.ai [VERIFIED] |
| Quality tier | High | https://cartesia.ai [VERIFIED] |
| Automation difficulty | Easy (REST/WS + SDKs) | https://docs.cartesia.ai [VERIFIED] |

---

## PlayHT — TTS + Cloning

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | Yes — TTS API, streaming, voice cloning, voice agents. Models: Play 3.0 mini, PlayHT 2.5, Parrot | https://docs.play.ht [VERIFIED] |
| SDK / MCP | Python, Node SDKs, REST + websocket. MCP — community | https://docs.play.ht/api-reference [VERIFIED] |
| Free tier | Free plan with limited characters (watermarked / attribution) | https://playht.com/pricing [INFERRED] |
| Paid price | Subscription + usage; ≈ Personal $31/mo (1M chars), Unlimited $99/mo (estimate); per-char overages | https://playht.com/pricing [INFERRED] |
| Commercial license | Paid plans commercial; free requires attribution | https://playht.com [VERIFIED] |
| Voice cloning | Custom voice cloning (consent required) on paid | https://docs.play.ht [VERIFIED] |
| Watermark | Free plan watermarked; paid no | https://playht.com/pricing [INFERRED] |
| Languages | 100+ languages, 900+ voices | https://playht.com [VERIFIED] |
| Latency | Low (Play 3.0 mini optimized for latency) | https://docs.play.ht [VERIFIED] |
| Quality tier | High | https://playht.com [VERIFIED] |
| Automation difficulty | Easy | https://docs.play.ht/api-reference [VERIFIED] |

---

## Murf — Studio-first TTS

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | Yes (REST API) but studio/productivity-first; TTS, voice changer, limited voice cloning. Less real-time oriented | https://murf.ai/api [VERIFIED] |
| SDK / MCP | REST API; limited SDK coverage. MCP — unofficial | https://murf.ai/api [VERIFIED] |
| Free tier | Free plan — limited minutes (≈ 10 min), watermarked | https://murf.ai/pricing [INFERRED] |
| Paid price | Subscription by minutes: Basic ≈ $19/mo, Pro ≈ $26/mo, Enterprise custom (estimate) | https://murf.ai/pricing [INFERRED] |
| Commercial license | Paid plans commercial; free watermarked / non-commercial | https://murf.ai [VERIFIED] |
| Voice cloning | Custom voice on higher tiers (Enterprise/Ultra), restricted | https://murf.ai/features/voice-cloning [VERIFIED] |
| Watermark | Free plan watermark; paid no | https://murf.ai/pricing [INFERRED] |
| Languages | 20+ languages, 120+ voices | https://murf.ai [VERIFIED] |
| Latency | Not real-time focused (batch) | https://murf.ai/api [VERIFIED] |
| Quality tier | Good / High | https://murf.ai [VERIFIED] |
| Automation difficulty | Moderate (API less real-time) | https://murf.ai/api [VERIFIED] |

---

## Suno — AI Music

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | No official public API (web/app only) | https://suno.com [VERIFIED / INFERRED] |
| SDK / MCP | None official | https://suno.com [VERIFIED] |
| Free tier | Free web tier with daily credits (limited generations) | https://suno.com/pricing [INFERRED] |
| Paid price | Subscription per account: Pro ≈ $10/mo, Premier ≈ $30/mo (annual discounts); not per-track API | https://suno.com/pricing [INFERRED] |
| Commercial license | Paid tiers permit commercial use of generated songs (subject to terms); free non-commercial | https://suno.com/terms [VERIFIED] |
| Voice cloning | N/A (music); policies prohibit impersonation of real artists | https://suno.com [VERIFIED] |
| Watermark | [UNKNOWN] | [UNKNOWN] |
| Languages | Multilingual singing (English-dominant) | [INFERRED] |
| Latency | N/A (batch, seconds–minutes per song) | https://suno.com [VERIFIED] |
| Quality tier | Top (leading AI music) | https://suno.com [VERIFIED] |
| Automation difficulty | Hard — no API; web/UI only; cannot easily automate | https://suno.com [VERIFIED] |

---

## Udio — AI Music

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | No official public API (web/app) | https://www.udio.com [VERIFIED / INFERRED] |
| SDK / MCP | None official | https://www.udio.com [VERIFIED] |
| Free tier | Free with limited credits | https://www.udio.com [INFERRED] |
| Paid price | Standard ≈ $10/mo, Pro ≈ $30/mo (estimate) | https://www.udio.com [INFERRED] |
| Commercial license | Paid allows commercial use (per terms) | https://www.udio.com [VERIFIED] |
| Voice cloning | N/A | https://www.udio.com [VERIFIED] |
| Watermark | [UNKNOWN] | [UNKNOWN] |
| Languages | English-dominant | [INFERRED] |
| Latency | N/A (batch) | https://www.udio.com [VERIFIED] |
| Quality tier | High | https://www.udio.com [VERIFIED] |
| Automation difficulty | Hard (no API) | https://www.udio.com [VERIFIED] |

---

## Speech-to-Text / Transcription (brief)

| Provider | API | Free | Paid (unit) | Langs | Watermark | Quality | Automation | Evidence |
|----------|-----|------|-------------|-------|-----------|---------|------------|----------|
| OpenAI Whisper | Yes (whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe, GPT-Live-Transcribe streaming) | Trial credits only | whisper-1 **$0.006 / minute**; GPT-Live-Transcribe **$0.017 / minute** (OBSERVED) | 100+ | No | High | Easy | https://platform.openai.com/docs/guides/speech-to-text , https://openai.com/api/pricing/ [VERIFIED whisper-1; OBSERVED live-transcribe] |
| Deepgram | Yes (REST + streaming + on-prem; Nova-2/Nova-3) | ≈ $200 free credits (historically) | ≈ $0.0043 / min pre-recorded (estimate) | 30+ | No | High/Very high | Easy | https://deepgram.com/pricing , https://developers.deepgram.com [INFERRED pricing] |
| AssemblyAI | Yes (REST + streaming; Universal-2) | Free trial credits | ≈ $0.006 / min core + add-ons (estimate) | 30+ | No | High | Easy | https://www.assemblyai.com/pricing , https://www.assemblyai.com/docs [INFERRED pricing] |

---

## Best-for mapping (autonomous website factory)

| Use case | Recommended providers |
|----------|----------------------|
| Narration (long-form, realistic VO) | ElevenLabs (top), OpenAI tts-1-hd, Murf, PlayHT |
| Ambient sound / SFX | ElevenLabs Sound Effects API (programmatic); otherwise stock libraries |
| UI sounds (clicks, hovers, chimes) | ElevenLabs SFX API where available; otherwise stock/synthesized — **[UNKNOWN strong dedicated API]** |
| Music bed (background tracks) | Suno, Udio, ElevenLabs Music (licensed) — note Suno/Udio have no API (manual/queue) |
| Voice agent (real-time conversational) | Cartesia (ultra-low latency), ElevenLabs Conversational AI, OpenAI Realtime; pair with Deepgram/Whisper for STT |
| Dubbing / localization | ElevenLabs (dubbing studio + API), PlayHT, Google (translation TTS), OpenAI (multilingual) |

## Automation-readiness summary
- **API-first & easy to automate:** ElevenLabs, OpenAI, Cartesia, PlayHT, Deepgram, AssemblyAI, OpenAI Whisper.
- **Moderate (setup/auth overhead):** Google Cloud TTS, Murf.
- **Hard / not automatable via API:** Suno, Udio (web-only, no public API).
- **No voice cloning:** OpenAI (preset voices only); cloning available at ElevenLabs (consent-gated), Cartesia, PlayHT, Murf (restricted), Google Custom Voice (enrolled).
