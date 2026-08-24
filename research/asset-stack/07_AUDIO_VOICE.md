# 07 — AUDIO & VOICE (deep dive)

> V=VERIFIED, U=UNKNOWN. Commercial-use traps flagged.

## A. TTS (text-to-speech)

### LOCAL — FREE, owns output, no watermark, autonomous
| Engine | Licence | Quality | Voices | Evidence |
|--------|---------|---------|--------|----------|
| **Kokoro-82M** | permissive OSS | high (multilingual) | ~50+ | KNOWN huggingface |
| **Piper** | Apache-2 / OSS | good | ~50 | KNOWN rhasspy/piper |
| **Coqui TTS / XTTS** | CPML (some non-commercial) | high, voice-clone | many | KNOWN |
| **OpenTTS / native** | OSS | var | var | KNOWN |

→ **For €0 commercial-safe voice, local Kokoro or Piper is the primary.** Runs on CPU,
fast, automatable. This is the BusinessForge default for any voice need at €0.

### CLOUD — paid for commercial rights
| Provider | Free | Paid | Commercial | Watermark | Evidence |
|----------|------|------|------------|-----------|----------|
| **ElevenLabs** | $0, 10k cr/mo, **non-commercial** | Starter $6 (Commercial License + Instant VC), Creator $22, Pro $99, Scale $299, Business $990 | free=NO, paid=YES | none | VERIFIED elevenlabs.io/pricing |
| **Cartesia** | limited | per-character (U) | yes(paid) | none | U price |
| **PlayHT** | limited | per-character (U) | yes(paid) | none | U price |
| **Murf** | limited | sub (U) | yes(paid) | none | U price |
| **OpenAI TTS** | pay per char | yes(paid) | none | API |

### Decision
- €0 + commercial → **local Kokoro/Piper**.
- €1–€5 → still prefer local; if cloud needed for voice-clone quality, ElevenLabs Starter
  $6 pushes over €5 → use only in €5–€20 band.
- €5–€20 → ElevenLabs Creator/Pro for studio narration.

## B. STT (speech-to-text)
- **Whisper.cpp** (local, MIT, FREE) — primary. CPU-capable, automatable.
- OpenAI Whisper API (paid per minute). ElevenLabs/Deepgram (paid).
- Use: voice search, auto-captions, voice agents.

## C. VOICE CLONING
- ElevenLabs Instant VC (Starter+), Professional VC (Creator+). Local: XTTS/OpenVoice
  (licence check). Never clone without consent — legal/QA gate.

## D. MUSIC
| Provider | Free | Paid | Commercial | Evidence |
|----------|------|------|------------|----------|
| **Suno** | 10 songs/day, **non-commercial** | Pro/Premier (commercial rights) | free=NO, paid=YES | VERIFIED suno.com/suno-plus |
| **Udio** | limited | sub | paid=yes | U |
| Local generative (Sox/PD loops) | ✅ $0 | n/a | PD/CC0 | KNOWN |

→ €0 music: public-domain / CC0 loops or no music. €5–€20: Suno Pro for brand track.

## E. SFX / AMBIENT
- ElevenLabs SFX (paid). Local: PD sample libraries, Sox synthesis (FREE).
- Ambient: procedural Web Audio (FREE) — generate pads/drones in-browser, zero assets.

## F. VOICE AGENTS
- ElevenLabs Agents (paid). Local: Kokoro + Whisper.cpp + orchestration (FREE, self-host).
- For autonomous factory: local stack is the €0 path; cloud agents for quality.

## G. WATERMARK / OWNERSHIP SUMMARY
- Local engines: you own output, no watermark, commercial per engine licence.
- ElevenLabs/Suno FREE: NO commercial rights (VERIFIED). Paid tiers grant them.
- Never ship free-tier cloud TTS/music on a paying client site.
