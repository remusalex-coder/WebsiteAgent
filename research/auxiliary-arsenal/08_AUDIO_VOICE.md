# 08 — AUDIO & VOICE

> VERIFIED from `bf_research/04_audio.md` + this pass. Note: `audio_speech` is tier
> **rejected** in registry (frozen F-18) — ElevenLabs researched but NOT activated.
> This doc records the candidates for if/when the gate re-opens on evidence.

## A. Voice / TTS
| Provider | Free | MED $ | PREM $ | Comm | Watermark | MCP | Evidence |
|---|---|---|---|---|---|---|---|
| **Kokoro-82M** (local) | ✅ $0 | — | — | permissive OSS | no | ❌ | KNOWN |
| **Piper** (local) | ✅ $0 | — | — | Apache-2 | no | ❌ | KNOWN |
| **ElevenLabs** | **$0 non-comm** | **$6 comm licence** | $22/$99/$299/$990 | paid-only | none | ✅ | VERIFIED |
| **Cartesia** | limited | per-char (U) | ent | paid | none | ❌ | U |
| **PlayHT** | limited | per-char (U) | ent | paid | none | ❌ | U |
| **OpenAI TTS** | pay/char | yes(paid) | — | none | API | VERIFIED |
| **Gemini TTS** | free allow | per-char | — | yes(paid) | none | API | VERIFIED |

**Default €0:** local Kokoro/Piper (own output, no watermark, commercial per licence).
**Escalate:** ElevenLabs Starter $6 (commercial) only if cloud voice-clone quality needed
AND `audio_speech` gate re-opens.

## B. STT
- **Whisper.cpp** (local, MIT, $0) — primary. OpenAI Whisper API (paid) alt.

## C. Music
| Provider | Free | MED/PREM | Comm | Evidence |
|---|---|---|---|---|
| **Suno** | 10 songs/day **non-comm** | Pro/Premier comm | free=NO | VERIFIED |
| **Udio** | beta (U) | sub | U | U |
| **Mubert** | API free tier | Render API | royalty-free | VERIFIED |
| **Local PD/CC0** | ✅ $0 | — | PD/CC0 | KNOWN |

**Default €0:** PD/CC0 loops or Web Audio procedural. Escalate: Suno Pro for brand track
(only if `audio_speech` re-opens / client needs music).

## D. SFX / ambient
- ElevenLabs SFX (paid), Freesound (CC mix — CHECK), local Sox/PD, Web Audio synthesis ($0).

## E. Licence traps (VERIFIED)
- ElevenLabs FREE = NO commercial. Suno FREE = NO commercial. → never ship free-tier
  cloud TTS/music on a paying client site. Use local or paid.

## F. Recommendation
- **ADOPT local (P0):** Kokoro/Piper, Whisper.cpp — €0, own output.
- **OPTIONAL (P2):** ElevenLabs/OpenAI/Gemini TTS only if voice gate re-opens.
- **REJECT default:** do not add audio to sites without business evidence (frozen F-18).
