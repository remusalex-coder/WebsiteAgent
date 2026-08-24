# Higgsfield AI — Research Findings (AI Video Generation)

> Researched via live browser on 2026-08-19. Evidence tags: [OBSERVED] = seen directly on a page; [VERIFIED] = confirmed in official docs/terms/pricing; [INFERRED] = reasonable conclusion; [UNKNOWN] = could not verify. Source URL included per claim. Where sources conflict, both are reported.

## Overview
- Higgsfield (Higgsfield, Inc., San Francisco, CA — 535 Mission St, 14th floor) is an "AI-native creative suite" offering image, video, audio generation, editing, and agent automation. [OBSERVED] https://higgsfield.ai/
- Product surface includes Image, Video, Audio, Edit, Layers, Cinema Studio, Marketing Studio, Viral Presets, MCP & CLI, Supercomputer, Academy, Community, Contests, Plugins, Canvas, Originals. [OBSERVED] https://higgsfield.ai/
- Headline models include Seedance 2.5 (1080p, "most advanced video model"), Seedance 2.0, Kling 3.0, Nano Banana Pro, Soul 2.0, Veo 3.1, Sora 2, Wan 2.6, Minimax Hailuo, Flux, GPT Image. Higgsfield states access to "30+ models". [OBSERVED] https://higgsfield.ai/cli and https://higgsfield.ai/
- Higgsfield runs a Global Film Festival with a $1,000,000 prize (as of research date, submissions by Sep 3). [OBSERVED] https://higgsfield.ai/
- Copyright "© 2026 Higgsfield, Inc. All rights reserved." [OBSERVED] https://higgsfield.ai/terms-of-use-agreement

## API/Endpoints
- Higgsfield provides an MCP (Model Context Protocol) server and a CLI package `@higgsfield/cli` for agent access. [OBSERVED] https://higgsfield.ai/cli
- CLI install/setup: `npm i -g @higgsfield/cli`; authenticate via `higgsfield auth login`; companion skills via `npx skills add higgsfield-ai/skills`. [OBSERVED] https://higgsfield.ai/cli
- MCP connection requires NO API key: "Add the Higgsfield MCP server URL in your agent's settings and authenticate through your Higgsfield account." [OBSERVED] https://higgsfield.ai/cli
- Supported agents explicitly listed: Claude (web, Cowork, Claude Code), OpenClaw, Hermes Agent, NemoClaw, and "any agent or client that supports MCP." [OBSERVED] https://higgsfield.ai/cli
- The Terms of Use grant a license to "access and use any APIs, MCP integrations, CLI tools, Supercomputer Agent, and other integrations" and include dedicated clauses "API Key Security" (§11.3) and "Agent and Automated Access" (§11.12), indicating a developer API with keys exists alongside MCP/CLI. [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- A separately documented public REST API (e.g. docs.higgsfield.ai with explicit endpoints) could NOT be located during this research; only MCP/CLI and Terms-referenced "APIs" were confirmed. [UNKNOWN] https://higgsfield.ai/terms-of-use-agreement

## Video generation
- Text-to-video is supported; example prompt "Generate a 15-second 9:16 UGC video using the attached creator..." produces video from text. [OBSERVED] https://higgsfield.ai/cli
- Higgsfield CLI page states videos are generated "up to 15 seconds" and images "up to 4K resolution." [OBSERVED] https://higgsfield.ai/cli
- Seedance 2.5 produces "cinematic videos up to 30 seconds, with sound generated in the same pass as the picture." [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026 — NOTE: this contradicts the CLI page's general "up to 15 seconds" statement; Seedance 2.5 specifically extends to 30s while other models may cap at 15s.
- Per-model credit costs are published (per 5s / per 4s clips), e.g. Seedance 2.0 720p=22, 1080p=45, 4K=110 credits/5s; Kling 3.0 720p=7, 1080p=8, 4K=30 credits/5s; Sora 2 Pro 1080p=50 credits/4s; Google Veo 3.1 1080p=29 credits/4s; Wan 2.6 1080p=20 credits/5s. [OBSERVED] https://higgsfield.ai/pricing
- Generation runs asynchronously; "your agent polls for results and delivers them as soon as they're ready." [OBSERVED] https://higgsfield.ai/cli

## Image-to-video
- Image/reference-driven generation is supported: "You can generate from text prompts, reference images, or a combination of both." [OBSERVED] https://higgsfield.ai/cli
- Seedance 2.5 accepts "up to 50 references" (images) to lock characters, locations, and style across a shot. [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- Users can "browse your full generation history, reference any past image or video, and use it as a starting point for new creations." [OBSERVED] https://higgsfield.ai/cli
- I2V is exposed through specific presets/models: Kling "Image Reference" / "Kling Omni 3 Image Reference", Higgsfield DoP (Lite/Standard/Turbo) models, "Draw to Video", and Multi Reference. [OBSERVED] https://higgsfield.ai/pricing and https://higgsfield.ai/cli

## Camera controls
- Higgsfield markets "THE ULTIMATE AI-POWERED CAMERA CONTROL FOR FILMMAKERS & CREATORS." [OBSERVED] https://higgsfield.ai/cli
- Camera movement, angle, and lens can be controlled three ways: (1) as text in a prompt, (2) as a fixed parameter set BEFORE generation, or (3) a combination via a "director-level tool." Locking settings pre-generation improves repeatability vs text-only. [OBSERVED] https://higgsfield.ai/blog/ai-video-camera-control
- Seedance 2.5 exposes explicit "Camera settings" selector: choose lens and body (24mm, anamorphic, macro); depth of field and distortion follow the chosen optics. [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- "Seedance motion control" lets you "Set a camera path and subject movement; the model executes it frame by frame." [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- "R2V motion guidance": show a reference clip of motion (e.g. stick-figure movement) and the model copies it. [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- "Lighting selector": choose light source (golden hour, hard key, practicals, moonlight) and move the angle by hand. [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- Viral preset library demonstrates camera moves: Bullet Time, Tracking, Earth Zoom, plus transformations (Agamemnon, Cold Vision, Particles, etc.). [OBSERVED] https://higgsfield.ai/
- "Higgsfield Angles" feature lets you "Change the Camera Perspective of Any Image." [OBSERVED] https://higgsfield.ai/blog (link /blog/Change-the-Angle-of-Any-Image)

## Director controls
- The "director-level tool" referenced for camera control is realized via Cinema Studio ("Cinema Studio 4.0 — NEW — Create cinematic scenes effortlessly"; "Cinema Studio 3.5 Settings Reference" in the camera guide). [OBSERVED] https://higgsfield.ai/ and https://higgsfield.ai/blog/ai-video-camera-control
- Seedance 2.5 "controls went from prompt-only to direct," exposing selectors for: era, genre, lighting angle, physics, lens, emotional tone, and montage pacing. [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- "Emotional control" dials performance "from calm to dread; framing and color temperature shift with it." [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- "Physics selector" sets world physics: realistic, superhero, hyperbolic (scales weight, speed, impact). [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- "Genre selector" sets pacing, contrast, and camera behavior; "Era selector" shoots in any decade 1960s–2020s (grain, color, lens character shift). [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- A "3D scene builder" lets you "block out a scene spatially instead of describing it." [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026

## Consistency
- "Consistent characters using Soul training" — Soul is Higgsfield's character/identity system (also "Soul ID Character", "Soul 2.0", "Soul Cinema", "Soul Cast"). [OBSERVED] https://higgsfield.ai/cli and https://higgsfield.ai/
- Seedance 2.5: "Character identity holds across shots from a single reference, so switching eras or worlds mid-project doesn't mean re-establishing who's on screen each time." [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- Up to 50 reference images can "lock characters, locations, and style across a shot." [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- "Soul Hex Engine (Transfer color)" locks the palette to exact hex values, pasted or pulled from a reference image — supports visual consistency. [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026

## Image references / Product video
- Product/advertising video is a first-class use case: "UGC Factory", "Product Placement", "Banana Placement", "Marketing Studio", and skills like "UGC factory — Create creator-led product videos" and "Product review UGC." [OBSERVED] https://higgsfield.ai/cli and https://higgsfield.ai/
- Example automated flow: "Create a complete UGC flow for this tumbler using the attached creator, from concept and script to a finished 9:16 video" — carries the same avatar/product through the final video. [OBSERVED] https://higgsfield.ai/cli
- "Reference Extension" and "Multi Reference" features support using reference images in generation. [OBSERVED] https://higgsfield.ai/cli (footer) and https://higgsfield.ai/pricing
- Region-level editing ("Region edit") lets you "Fix an object or a face in one spot without re-rendering the whole clip" — useful for product detail fixes. [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026

## Pricing
- Published plans (annual billing, "Annual 30% OFF"): Free ("Limited use"), Starter ($19/month billed annually), Plus ($47/month billed annually, 1,200 credits/mo), Ultra ($99/month billed annually; credit line shown as 3,000 / 6,000 / 9,000 — top tier ~9,000 credits/mo). Monthly prices higher (Plus $59/mo, Ultra $129/mo shown). [OBSERVED] https://higgsfield.ai/pricing
- Plan comparison columns: Free, Starter, Plus, Ultra. Concurrent jobs: Free=1, Starter=2, Plus=6 (videos) / 8 (images), Ultra=8 (videos) / 8 (images). [OBSERVED] https://higgsfield.ai/pricing
- Plus includes "Access to every model, all features & 4K quality", "Unlimited Kling 3.0 & Nano Banana 2 for 7 days", "5,000 FREE Soul 2.0 generations", parallel generations up to 6 videos / 8 images. [OBSERVED] https://higgsfield.ai/pricing
- Ultra adds "Full access Seedance 2.5 1080p" and "Full access Seedance 2.0 4K", parallel up to 8 videos / 8 images. [OBSERVED] https://higgsfield.ai/pricing
- IMPORTANT for automation: "Unlimited models and Free Generations on plans are accessible only via higgsfield.ai and are not accessible on MCP/CLI, Canvas or Supercomputer." [OBSERVED] https://higgsfield.ai/pricing
- "Prices exclude VAT and local taxes, calculated at checkout. Unlimited usage may be subject to dynamic speed adjustments during high-traffic periods." [OBSERVED] https://higgsfield.ai/pricing
- An Enterprise option ("Contact Sales") exists. [OBSERVED] https://higgsfield.ai/pricing

## Credits
- Higgsfield uses a credit system; "Each generation costs credits based on the model and resolution. Your existing Higgsfield plan credits work seamlessly through any connected agent." [OBSERVED] https://higgsfield.ai/cli
- Credit rules (Terms §9.4): purchased Credits are prepaid, may only be used within the specified timeframe, expire on Account cancellation/discontinuation (except per §16.4), have no cash value, are non-transferable, non-reloadable, non-redeemable for cash except as required by law; Company may change Credit terms at any time. [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- Promotional/Add-On/Package credits addressed separately (§9.5, §9.6). [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- Example equivalences published: ~53 Seedance 2.0 videos per Plus plan (1,200 credits); ~14 credits per Kling 3.0 generation (8s, 720p); 2 credits per Nano Banana Pro image. [OBSERVED] https://higgsfield.ai/pricing

## Free tier
- A Free plan exists, labeled "Free — Limited use", with 1 concurrent job. [OBSERVED] https://higgsfield.ai/pricing
- Specific included credit amount and which models are available on Free were NOT clearly enumerated on the reviewed pricing page (comparison table shows many models as "Not included" for the first columns, but column-to-plan mapping for Free/Starter was ambiguous). [UNKNOWN] https://higgsfield.ai/pricing
- A separate blog describes methods to obtain "Free Unlimited Seedance" via referrals, but this is promotional, not a baseline entitlement. [OBSERVED] https://higgsfield.ai/blog/how-to-get-free-unlimited-seedance-2

## Commercial license
- Terms §4.4: "Company does not claim ownership of any of your Inputs or Outputs, nor does it restrict your commercial use of Outputs." [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- §4.4 further: "Your rights in Outputs you have generated and exported survive cancellation of your subscription or deletion or termination of your Account, and you may transfer or sublicense your rights in Outputs to your clients or other third parties." [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- §4.2: "Company does not claim ownership of Your Content." [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- The commercial-use grant is stated generally (not restricted by plan tier in the Terms); however, the Free plan's exact commercial permissions were not separately spelled out on the pricing page. [INFERRED from Terms §4.4] https://higgsfield.ai/terms-of-use-agreement
- Developer/API use: §1.2 license permits use "solely for your own personal or internal business purposes or, where applicable, to build and operate applications" — i.e. commercial application building is contemplated. [VERIFIED] https://higgsfield.ai/terms-of-use-agreement

## Watermark
- Terms §6.4 (Provenance and Watermarking): "Company may embed machine-readable watermarks, secure metadata, or content-provenance signals (such as those based on the C2PA / Content Credentials standard) into Outputs so that Outputs can be identified as AI-generated. Company may make such markings imperceptible and enable third parties to detect them. Company does not warrant that any marking will be applied to, or persist in, every Output." [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- §5.5 (AI Disclosure): where required by law you must disclose Output is AI-generated and "will not remove, alter, or obscure any provenance signals or markings Company applies under Section 6.4." [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- §4.1/Service markings: "You may not remove, alter, or obscure any copyright, watermark, trademark, service mark or other proprietary notices incorporated in or accompanying the Service." (This governs the Service UI, not necessarily exported Outputs.) [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- Whether exported video files carry a VISIBLE Higgsfield watermark (especially on Free tier) could NOT be confirmed on the official pages reviewed. [UNKNOWN] https://higgsfield.ai/pricing

## API limits
- Concurrent generation limits by plan: Free=1 job; Starter=2; Plus=6 videos / 8 images; Ultra=8 videos / 8 images (concurrent jobs). [OBSERVED] https://higgsfield.ai/pricing
- Fair-use / throttling (Terms §10.6): "Company may restrict, suspend, throttle, or place on a slower processing queue usage that is automated or materially exceeds typical individual use, in order to protect Service quality for other users. Unlimited models operate on a dedicated processing queue, separate from the priority queue used for credit-based generations. During periods of high demand, generation speeds may vary and additional concurrency limits may apply. Processing speed and parallel generation capacity are not guaranteed and may dynamically adjust." [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- Rate caps expressed in credits: each generation consumes a fixed credit amount per model/resolution (see Video generation); overage beyond plan credits may incur overage fees. [OBSERVED] https://higgsfield.ai/pricing and [VERIFIED] https://higgsfield.ai/terms-of-use-agreement (§9.4 overage)
- "Unlimited models and Free Generations ... are not accessible on MCP/CLI, Canvas or Supercomputer" — so agent/automation access is credit-metered, not unlimited. [OBSERVED] https://higgsfield.ai/pricing
- Past-due accounts: "Company may suspend access to Supercomputer Agent, including any in-progress agent tasks, automations, and scheduled activities." [VERIFIED] https://higgsfield.ai/terms-of-use-agreement

## Latency
- CLI page: "Images typically complete in a few seconds. Videos take longer depending on duration and model. All generation runs asynchronously, so your agent polls for results and delivers them as soon as they're ready." [OBSERVED] https://higgsfield.ai/cli
- No fixed per-model latency SLA is published; Terms state processing speed "is not guaranteed and may dynamically adjust based on overall platform" load. [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- Specific seconds/minutes per model were NOT found on official pages reviewed. [UNKNOWN] https://higgsfield.ai/cli

## Output formats
- The exact exported file container/codec (e.g. MP4) is NOT explicitly stated on the pages reviewed; the UI provides a "Download" action for generated assets. [UNKNOWN] https://higgsfield.ai/cli
- Audio is generated natively: Seedance 2.5 produces "sound generated in the same pass as the picture"; several models list audio variants (e.g. "Kling 2.6 with sound", "Google Veo 3 w/audio"). [OBSERVED] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026 and https://higgsfield.ai/pricing
- Lipsync/audio tools exist (Lipsync Studio, Higgsfield Speak, Infinite Talk, Sync Lipsync) implying standard video + audio track outputs. [OBSERVED] https://higgsfield.ai/pricing

## Resolution
- Video resolutions observed across models: 480p, 512p, 720p, 768p, 1080p, and 4K. [OBSERVED] https://higgsfield.ai/pricing
- Seedance 2.5 is offered at 1080p ("Open Seedance 2.5 in 1080p"); Seedance 2.0 has full 4K access on Plus/Ultra. [OBSERVED] https://higgsfield.ai/ and https://higgsfield.ai/pricing
- Images: "up to 4K resolution" (e.g. Nano Banana Pro 4K = 4 credits/image). [OBSERVED] https://higgsfield.ai/cli and https://higgsfield.ai/pricing
- Aspect ratios: 9:16 observed (e.g. "15-second 9:16 UGC video"); full supported ratio matrix not enumerated on reviewed pages. [OBSERVED] https://higgsfield.ai/cli [UNKNOWN exact supported ratio matrix]

## Automation
- Primary automation path = MCP server + CLI, usable from Claude Code, Cursor, ChatGPT, OpenClaw, Hermes, and any MCP-compatible client; no API key needed for MCP (account auth). [OBSERVED] https://higgsfield.ai/cli
- "Supercomputer" is described as "One superagent for your entire creative stack" / "Automation, skills, apps and more." [OBSERVED] https://higgsfield.ai/
- Async workflow: "All generation runs asynchronously, so your agent polls for results." [OBSERVED] https://higgsfield.ai/cli
- Iterative automation: agents can "browse your full generation history, reference any past image or video, and use it as a starting point for new creations" — supports multi-step production loops. [OBSERVED] https://higgsfield.ai/cli
- Skills layer: `npx skills add higgsfield-ai/skills` adds ready-made skills (UGC factory, faceless content, website building, etc.) that drive generation. [OBSERVED] https://higgsfield.ai/cli
- Terms §11.12 (Agent and Automated Access): if you connect the Service to a third-party AI agent/automation via MCP, you are solely responsible for all actions taken by that agent using your credentials, and "Company treats all activity conducted through your Developer Access as your activity." [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- Terms §11.13: MCP may be accessed through third-party MCP Clients, each governed by its own terms; Company does not control/endorse them. [VERIFIED] https://higgsfield.ai/terms-of-use-agreement
- Caveat for BusinessForge: unlimited/free generations are excluded from MCP/CLI, so any automated video pipeline must be credit-funded and is subject to fair-use throttling of automated traffic. [INFERRED from §10.6 + pricing note] https://higgsfield.ai/pricing and https://higgsfield.ai/terms-of-use-agreement

---
### Research notes / caveats
- Some requests (Google search, the /ai/video generator app, and one /seedance community URL) were intercepted/redirected to an unrelated third-party site (tripo3d.ai) by the browser environment; those were discarded and replaced with direct Higgsfield-owned pages (homepage, /cli, /pricing, /terms-of-use-agreement, /blog articles), which loaded correctly.
- Two contradictory video-length claims exist: CLI page "videos up to 15 seconds" vs Seedance 2.5 blog "cinematic videos up to 30 seconds." Treated as model-specific (Seedance 2.5 = 30s; others likely 15s).
- No public REST API documentation (endpoints, auth scheme) was found; only MCP/CLI and Terms-referenced "APIs"/API-key clauses.
