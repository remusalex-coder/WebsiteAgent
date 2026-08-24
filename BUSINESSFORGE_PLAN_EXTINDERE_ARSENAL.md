# BUSINESSFORGE — PLAN DE EXTINDERE A ARSENALULUI, FĂRĂ REGRESIE

## Context — de ce arată planul așa cum arată

Brief-ul inițial presupunea că `WebsiteAgent` conține deja o infrastructură amplă — Experience Registry, Arsenal
Resolver, Vision Critic, `lib/forge/`, `MASTER_ARSENAL.md` — și că Bakery V2 / Ridgeway Motors sunt artefacte deja
produse de acel sistem, de protejat ca benchmark-uri de regresie.

Trei explorări paralele ale repository-ului (arhitectură/pipeline, assets/librării/capabilități, MCP/skills/QA/AI)
plus verificarea directă a istoricului git (7 commit-uri, un singur branch relevant, working tree curat, fără
stash) au confirmat: **niciuna dintre aceste componente nu există în repo.** Ce există e un pipeline determinist,
single-track, mic și foarte onest despre limitele lui (vezi Secțiunea 3).

Ai clarificat apoi personal, trimițând codul complet al celor două benchmark-uri (`index.html` + `styles.css` +
`.js` pentru fiecare). Asta a schimbat complet premisa: Bakery V2 și Ridgeway Motors **nu sunt** output-uri ale
pipeline-ului determinist actual — sunt artizanale, scrise manual/generate ad-hoc, folosind exclusiv WebGL2 crud,
JS vanilla și CSS custom properties, fără nicio dependență npm. Ele reprezintă bara de calitate creativă țintă, nu
un sistem existent de extins.

Planul de mai jos pornește de la această realitate verificată: **motorul actual (determinist) rămâne complet
neatins**, iar tot ce descrie brief-ul — Experience Registry, Arsenal Resolver, Vision Critic, Asset Resolver —
se construiește ca un **al doilea track, aditiv, opțional**, care produce site-uri de calibrul Bakery V2/Ridgeway
folosind cod generat de model, ghidat de un cookbook de pattern-uri (nu de librării grele), cu fallback garantat
la motorul determinist dacă ceva eșuează.

---

## 1. Rezumat executiv

BusinessForge (`WebsiteAgent`) are azi un singur pipeline determinist (`main.ts` → 8 stagii) care produce site-uri
statice, fără JavaScript, din datele unei firme scrap-uite de pe Google Maps + site propriu. E bine inginerit,
bine testat (248 assertion-uri), dar auto-critic recunoaște că diferențierea vizuală e "cosmetică, nu
compozițională" (`docs/design-intelligence-review.md`).

Bakery V2 și Ridgeway Motors demonstrează ce e posibil dincolo de acel plafon: storytelling cinematic cu scroll
pinned și shader WebGL raymarched (Bakery), respectiv o interfață interactivă completă tip "diagnostic HUD" cu
tab-uri, slidere, modal, formular (Ridgeway) — ambele 100% vanilla, ambele accesibile, ambele fără nicio rețea
externă la runtime (cu o excepție: Ridgeway încarcă fonturi de la Google Fonts CDN, o abatere de la convenția
"self-hosted" pe care o semnalez ca decizie deschisă).

**Concluzia arhitecturală centrală a acestui plan:** "Arsenalul" nu înseamnă în primul rând GSAP/Three.js/Lenis —
înseamnă un cookbook de rețete vanilla (scroll-pin, shader fallback, tab-uri accesibile, modal nativ,
IntersectionObserver reveals) pe care un stagiu nou, generativ, trebuie să-l aibă la dispoziție când scrie cod
bespoke per business. Librăriile reale (Leaflet, Stripe Elements, Cal.com embed) intră doar acolo unde
reinventarea manuală ar fi nesigură sau nepractică — plăți, hărți cu geocodare, booking cu disponibilitate reală.

Planul introduce un **Track B ("Experience Signature Factory")** paralel cu Track A (pipeline-ul actual,
neschimbat), cu propriul stagiu de generare, propriul Vision Critic + repair loop, și fallback automat la Track A
dacă QA eșuează. Fiecare integrare externă are un contract explicit: ce poate face Claude autonom, ce trebuie să
faci tu, ce credențial, cât costă, ce test confirmă că merge.

---

## 2. Benchmarkurile Bakery V2 + Ridgeway — analiză tehnică

### 2.1 Bakery V2 (Tartine Bakery — "Proof")

- **Structură:** o singură pagină, 10 "scene" (`levain`, `three-things`, `rise`, `blade`, `oven`, `cooling`,
  `rack`, `doors`, `threshold`, `coda`), fiecare `position: sticky; height: 100svh` — scroll pinned cinematic.
- **WebGL:** canvas WebGL2 crud (fără Three.js), shader GLSL raymarched scris manual (SDF ellipsoid pentru o
  pâine/aluat, cu fermentare, tăietură de lamă, oven-spring, aburi) — cod shader comentat extensiv cu raționamente
  de performanță ("două octave, nu patru — al patrulea e invizibil pe un obiect soft, backlit").
  Degradare automată de calitate pe FPS scăzut (2 trepte: mai puțini pași de march → rezoluție mai mică → fallback
  fără GL), tratare `webglcontextlost` fără pagină spartă.
- **`proof.js` (~480 linii, vanilla):** o mașină de stare condusă de scroll — playhead = centrul viewport-ului,
  interpolare `smoothstep`/`lerp` între stările a două scene adiacente, scrise ca CSS custom properties
  (`--p`, `--vis`, `--ground`, `--ink`, `--ember`) și ca uniforme de shader. Include: "reel" (carusel pseudo-3D
  prin `perspective()`/`rotateY()` calculat manual pe scroll), butoane "magnetice" (atracție spre cursor pe
  `pointermove`), animație de intrare a titlurilor prin split de text la boot, respect complet pentru
  `prefers-reduced-motion` (oprește parallax-ul shaderului, blocul de tranziție ground-to-ground devine snap în
  loc de blend).
- **Fonturi:** `Archivo` (400/900), `Cormorant Garamond` (300), `IBM Plex Mono` (400) — self-hosted `.woff2`,
  **exact aceleași fișiere există deja** în `assets/fonts/manifest.json` din repo (verificat direct: `archivo-400`,
  `cormorant-garamond-300`, `ibm-plex-mono-400`). Zero muncă de adăugat — REUSE 100%.
- **Conținut:** business real (Tartine Bakery, San Francisco), fapte verificabile (fondatori, 2002, James Beard
  Award 2008), voce editorială/atmosferică. JSON-LD Schema.org `Bakery` cu adresă/rating/telefon reale.
- **Zero rețea externă la runtime** (fonturi locale, fără CDN).
- **Accesibilitate:** skip-link, `sr-only` h1, `aria-hidden` pe elementele decorative HUD, bloc CSS complet pentru
  `prefers-reduced-motion`.

### 2.2 Ridgeway Motors

- **Structură:** 5 "Acte" (hero/diagnostics/brakes/workshop/booking) — flux normal de document, NU pinned; reveal
  prin `IntersectionObserver` (fade + translate).
- **`experience.js` (235 linii, vanilla):** ceas live (`setInterval`), toggle expand/collapse
  (`aria-expanded`), tab-uri OBD (implementare manuală `role="tablist"`/`tabpanel`), slider de uzură frână cu
  citire live (text + culoare), readout la hover pe unelte, estimare de preț live la schimbarea select-ului de
  serviciu, toggle courtesy-car cu badge live, modal `<dialog>` nativ (cu feature-detection `showModal`/`close`),
  `IntersectionObserver` pentru reveal + stare activă în navigație.
- **CSS:** `@import` din Google Fonts CDN (`JetBrains Mono`, `Syne`, `Inter`) — **contrazice** convenția
  self-hosted din restul repo-ului și din Bakery V2. Semnalat explicit ca punct de decizie (§9.3).
- **Estetică:** "clinical diagnostic HUD" — fundal grid, accent portocaliu `#FF5500`, etichete monospace,
  overlay-uri HUD/crosshair pe imagini, animație scanline.
- **Conținut:** business fictiv/sintetic (telefon placeholder `0700 000 000`, cod poștal fictiv) — servește ca
  demo de arhetip de industrie, nu ca test de fidelitate pe date reale. JSON-LD `AutoRepair` cu
  `aggregateRating`, `openingHoursSpecification`, `hasOfferCatalog`, `amenityFeature`.
- **Accesibilitate:** atribute ARIA corecte pe toate widget-urile interactive.

### 2.3 Ce demonstrează împreună

Zero librării third-party în niciunul. Ambele: WebGL2/DOM API-uri native, CSS custom properties ca punte
JS↔CSS, `<dialog>` nativ, ARIA manual, disciplină serioasă de `prefers-reduced-motion`, output complet static
(HTML+CSS+JS+assets, fără build step, fără server) — consistent cu etosul "se deschide de pe disc" al
renderer-ului actual, doar extins ca să permită JavaScript.

**Aceasta e concluzia care direcționează tot planul:** arsenalul de motion/interaction nu trebuie construit ca
o listă de dependențe npm, ci ca un **cookbook de rețete** (pattern + cod de referință + when-to-use), pe care un
stagiu generativ nou îl consumă ca context de prompt, nu ca `import`.

---

## 3. Auditul pipeline-ului actual (Track A — motorul de protejat)

```
mapsUrl → discoveryAgent → collectorAgent → normalizerAgent → businessAnalystAgent[LLM]
        → writerAgent[LLM] → designAgent[determinist, fără LLM] → render (pur) → lovableAgent[STUB]
```

Un singur pipeline, orchestrat integral din `main.ts` (~627 linii — "Entry point and orchestrator", nu există
`lib/forge/orchestrator.ts` separat). Fiecare stagiu își persistă artefactul (`output/<runId>/N-nume.json`),
ceea ce face pipeline-ul reluabil (`resumePipeline`). `renderStage()` nu e un `step` — e funcție pură de
`5-content.json` + `5b-design.json`, re-randează în milisecunde.

Componente cheie de reținut ca "motor":

- **`lib/design/`** (8 fișiere, ~3300 linii) — `composeDesign()` determinist: clasificare industrie (17 tipuri),
  alegere `DesignDirection` (11 tipuri), tokens (culoare OKLCH, tipografie, spacing, radius, elevation, motion),
  `LayoutPlan` (variantă hero, variantă/ordine secțiuni). **Seam-ul explicit pentru un art-director AI**: parametrul
  opțional `direction` din `composeDesign(input, options)` — comentariul din cod spune direct că ăsta e locul unde
  s-ar conecta o decizie luată de model, restul rămânând determinist.
- **`lib/render/`** (12 fișiere, ~6400 linii) — randare pură `WebsiteContent + WebsiteDesign → HTML/CSS`, **zero
  JavaScript emis, zero fetch extern la runtime** (invariantă de design deliberată). Bug istoric documentat,
  INF-007: coliziune de nume de custom properties CSS între `css.ts` și `variants.ts` a suprascris silențios
  valorile design-ului — reparat cu forma `var(--token, fallback-vechi)`. Precedent util pentru orice cod nou care
  atinge CSS-ul generat.
- **`lib/platform/`** — "capability platform": `skills/` (38 placeholder-uri oneste pe 8 categorii, toate
  `not_implemented`, extensibile prin drop-in `*.skill.ts` în `SKILLS_DIR` fără cod nou), `mcp/`
  (`httpConnector.ts` real dar niciodată rulat contra unui server viu, `stdioConnector.ts` declarat dar
  neimplementat), `telemetry.ts`.
- **`lib/ai/`** — 4 provideri reali (Anthropic/OpenAI/Gemini/OpenRouter) în spatele unei interfețe `AIProvider`
  comune, selectabili prin `AI_PROVIDER`. **Text-only azi** — niciun input multimodal, relevant pentru Vision
  Critic (§16).
- **`assets/fonts/`** — 49 fișiere `.woff2`, 18 familii, vendorizate o singură dată la build-time
  (`scripts/vendor-fonts.ts`), servite 100% local.
- **`test/`** — 248 assertion-uri, `node:test`, snapshot-uri commise (`test/__snapshots__/`). *Notă de
  dezambiguizare*: `design.bakery.json` din snapshot-uri e un fixture de test pentru clasificarea industriei
  "Bakery" (generic), **nu are nicio legătură cu Bakery V2 / Tartine** din §2.1.

**Nu există `lib/forge/`, `lib/runtime/`, `lib/capability/`, `research/`.** Nu există CI (`.github/workflows`).
Sursa canonică de status/roadmap e declarată a fi Notion ("BusinessForge HQ"), inaccesibilă din această sesiune.

---

## 4. Motorul protejat — ce NU se atinge

Lista exactă de fișiere/directoare intangibile în orice fază a acestui plan, decât dacă o fază spune explicit
altfel și justifică de ce (cu test de regresie înainte/după):

| Zonă protejată | De ce |
|---|---|
| `main.ts` (stagii 1–6 existente, `STAGES`, `ARTIFACT_KEYS`) | orchestrare validată, resumable |
| `lib/design/*` | 3300 linii determinism testat, sursa `LayoutPlan` |
| `lib/render/*` | 6400 linii, zero-JS invariant, 248 teste, precedent INF-007 |
| `agents/discoveryAgent.ts`, `collectorAgent.ts`, `normalizerAgent.ts` | validate pe 6 businessuri reale |
| `agents/businessAnalystAgent.ts`, `writerAgent.ts` | singurele apeluri LLM verificate live |
| `lib/ai/*` (contractul existent, nu extensia) | 4 provideri, zero import de vendor SDK în afara `anthropic.ts` |
| `assets/fonts/*`, `scripts/vendor-fonts.ts` | sistem de fonturi funcțional, de reutilizat ca atare |
| `test/__snapshots__/*` | regresie determinism — orice schimbare aici trebuie să fie intenționată și revizuită |

Orice cod nou (Track B) trăiește în fișiere/directoare noi (`agents/experience*.ts`, `lib/experience/`,
`output/<runId>/experience/`) și se conectează la Track A doar prin puncte de extensie deja existente și
documentate ca atare (`composeDesign()`'s `direction` param, `STAGES` array appending, artefactele stage 4/5 ca
input read-only).

---

## 5. Cauzele regresiei — lecții din istoricul repo-ului

1. **INF-007** (coliziune CSS între `css.ts`/`variants.ts`) — orice CSS nou trebuie să folosească nume de
   custom-property namespaced/unic, nu presupuse-libere.
2. **Documentație stale** — `docs/architecture.md` și `docs/folder-structure.md` sunt cu o generație în urmă
   față de `PROJECT_STATUS.md`/`NEXT_SESSION.md` (ex: marchează `writerAgent` ca stub deși e verificat live).
   Lecție: orice fază din acest plan trebuie să actualizeze docs-ul relevant în același commit cu codul, nu
   separat.
3. **Lazy-loaded images mint capturi false-goale** — `scripts/batch-audit.ts` documentează fix-ul (force
   `loading=eager` + `img.decode()` înainte de screenshot); Vision Critic (§16) TREBUIE să refolosească exact
   acest pattern, nu să-l reinventeze.
4. **Pipeline unic, fără A/B** — până acum n-a existat niciun risc de "silent fallback între două pipeline-uri"
   pentru simplul motiv că exista un singur pipeline. Introducerea Track B e prima dată când acest risc devine
   real — de-aia fiecare fază de mai jos specifică explicit namespace separat de artefacte (`output/<runId>/site/`
   vs `output/<runId>/experience/`) ca să nu se poată repeta un INF-007 la nivel de pipeline.

---

## 6. Inventarul actual — REUSE / CONNECT / ADAPT / EXTEND / BUILD NEW

| Nevoie | Ce avem | Status |
|---|---|---|
| Orchestrare pipeline | `main.ts`, `executePipeline`, artefacte pe disc, resume | REUSE |
| Design tokens/direcție | `lib/design/compose.ts` + `direction` override seam | CONNECT (pt. Track B) |
| Randare statică zero-JS | `lib/render/*` | REUSE (Track A neschimbat) |
| Fonturi self-hosted | `assets/fonts/`, `scripts/vendor-fonts.ts`, `lib/render/fonts.ts` | REUSE 100% (fonturile din Bakery V2 deja vendorizate) |
| Provideri AI | `lib/ai/*`, 4 adaptoare | EXTEND (adaugă suport imagine pt. Vision Critic, §16) |
| Capability platform | `lib/platform/skills/*`, 38 placeholder-uri | CONNECT (implementează skill-uri reale în locul placeholder-elor, fără schimbare de agent) |
| MCP | `lib/platform/mcp/httpConnector.ts` | CONNECT (niciun apelant azi; conectează Playwright deja folosit direct, opțional axe/Firecrawl) |
| Screenshot QA | `scripts/batch-audit.ts` (Playwright direct, tehnică force-eager-load) | ADAPT (extrage logica reutilizabil pentru Vision Critic) |
| Motion/WebGL/Interaction | — (absent complet) | BUILD NEW (cookbook vanilla, §10) |
| Vision Critic + repair | — (absent complet) | BUILD NEW (§16) |
| Experience Registry/variante | — (absent; doar `direction` enum static) | BUILD NEW (§10, generativ nu determinist) |
| Forms/booking/maps/payments | — (doar placeholder-uri `not_implemented`) | BUILD NEW pe adaptor, BLOCKED pe credențial (§11–12) |
| Cost governance (tier0-3) | — (absent; există doar `FeatureFlags`) | BUILD NEW, pe fundația `FeatureFlags` existentă |
| Accessibility audit automat (axe) | — (absent; doar teste de contrast pe token-uri) | BUILD NEW, TIER 1, zero credențial |
| Deploy real | `agents/lovableAgent.ts` (throw imediat) | BUILD NEW, retarget Cloudflare Pages per `NEXT_SESSION.md` |

---

## 7. Arsenalul lipsă — pe capabilitate

- **Motion/interaction:** scroll-pin cinematic, reveal-on-scroll, magnetic CTA, tab-uri/accordion accesibile,
  modal nativ, slider/gauge interactiv, carousel/"reel" pseudo-3D — toate demonstrate deja *fezabile fără nicio
  librărie* de cele două benchmark-uri.
- **WebGL/3D:** raymarched shader custom (posibil per-industrie: aluat pentru bakery, ceva analog pentru alte
  industrii) — cookbook + fallback obligatoriu (context loss, `prefers-reduced-motion`, degradare pe FPS).
  Three.js util doar dacă un pattern cere scenă 3D cu geometrie/light management complex, nu pentru shadere
  fullscreen single-quad ca în Bakery.
- **Galleries/typography/UI/navigation:** parțial acoperite generic de `lib/design/`+`lib/render/` pe Track A;
  pe Track B, toate sunt generate bespoke per pattern din cookbook.
- **Asseturi:** fără taxonomie de proveniență (business-owned/verified/licensed/generated), fără fallback
  determinist pe absența imaginilor — problemă P0 documentată deja în repo (`PRD-007`, `NEXT_SESSION.md`).
- **Funcțional real:** forms/booking/maps/whatsapp/search/CMS/auth/payments — toate azi placeholder
  `not_implemented`.
- **MCP live:** zero apelant din orice agent azi, deși transportul HTTP e implementat.
- **Cost/tier governance:** absent complet.
- **Anti-AI-generic automat:** azi doar document (`design-intelligence-review.md`), fără detector în cod.

---

## 8. Open-source candidates — clasificare

Principiu confirmat de benchmark-uri: **hand-rolled vanilla e TIER 1 by default** pentru motion/interaction —
zero bundle, zero licență, zero maintenance risk, exact ce a produs Bakery V2/Ridgeway. Librării reale intră doar
unde reinventarea ar fi nesigură/impracticabilă.

| Capabilitate | TIER 1 (implicit) | TIER 2 (fallback/caz special) | TIER 3 / RESPINS |
|---|---|---|---|
| Scroll-pin cinematic | Vanilla (pattern din Bakery V2: sticky + scroll-sampled state machine) | GSAP ScrollTrigger (MIT din v3.12, dacă timeline-uri complexe justifică) | Locomotive Scroll (necesită scroll hijacking complet, risc de accesibilitate) |
| Reveal on scroll | `IntersectionObserver` vanilla (pattern din Ridgeway) | — | AOS/ScrollReveal (inutile, IO nativ ajunge) |
| Tab-uri/accordion | ARIA manual vanilla (pattern din Ridgeway) | — | librărie UI kit (bundle nejustificat) |
| Modal | `<dialog>` nativ (pattern din Ridgeway) | — | librărie de modal |
| Shader/WebGL fullscreen | WebGL2 raw + GLSL (pattern din Bakery V2) | Three.js (doar dacă geometrie 3D reală, multiple obiecte, lumini) | — |
| Hartă embed simplă (fără geocodare) | Leaflet + tile OpenStreetMap (open, gratuit, fără cheie pt. tile-uri publice) | Google Maps JS embed (dacă owner cere brand Google) | — |
| Accessibility audit | `@axe-core/playwright` (MIT, zero credențial) | Lighthouse CI | — |
| Font loading | REUSE sistem existent `scripts/vendor-fonts.ts` | Google Fonts CDN (doar opt-in explicit, contrazice invarianta self-hosted) | — |
| Image optimization | `sharp` (dacă devine necesar pt. Asset Resolver) | — | — |

Fiecare candidat TIER 1/2 va fi verificat concret (licență, versiune, bundle size, browser support, mentenanță)
**la momentul integrării lui**, nu speculativ acum — regula #7 cere verificare reală, nu presupusă.

---

## 9. Asset Resolver — design propus

```
assets/
├── source/       # originale neatinse: scraped, uploaded de owner, achiziționate
├── processed/     # redimensionate/optimizate, cu manifest de transformare
├── final/          # ce ajunge efectiv în site
├── generated/       # produse AI, cu prompt+model+dată în manifest
└── manifest.json    # provenance per asset: source, license, role, dimensions, format, business association
```

### 9.1 Lanț de rezoluție (Regula #9)

`business-owned` (scraped de `collectorAgent`, deja funcțional) → `verified external` (Maps listing owner photos,
azi blocat pe skill `google-maps` neimplementat) → `licensed stock` (Unsplash/Pexels API, free tier, atribuire) →
`generated` (skill `image-generation`, azi placeholder, blocat pe extensia multimodală din §16) →
`deterministic fallback` (comportamentul actual din `lib/render/assets.ts`: omite imaginea, degradează layout-ul,
nu inventează).

### 9.2 Ce se reutilizează direct

`lib/render/assets.ts`'s `createAssetPlan()` (placement determinist, dedupe, URL safety) rămâne neatins pe
Track A. Track B are nevoie de propriul asset plan (fișiere JS/CSS custom per business), dar **taxonomia de
proveniență de mai sus e comună ambelor track-uri** — se implementează o singură dată în `lib/assets/` (nou),
consumat de Track A opțional (ca îmbunătățire viitoare, neurgentă — Track A funcționează azi fără ea) și de
Track B obligatoriu.

### 9.3 Decizie deschisă — fonturi CDN vs self-hosted

Ridgeway Motors folosește Google Fonts CDN; Bakery V2 și restul repo-ului folosesc self-hosting. **Recomandarea
acestui plan: implicit self-hosted (consistent cu invarianta "zero fetch extern" deja stabilită), CDN doar ca
opt-in explicit per business** dacă fontul cerut nu poate fi vendorizat legal/practic. Confirmă-mi această
alegere sau spune-mi dacă vrei alt comportament implicit.

---

## 10. Arsenal Resolver — design propus (esența planului)

**Nu e un runtime de rezolvare a dependențelor npm.** E un **cookbook de pattern-uri**, consumat ca context de
prompt de stagiul generativ (Phase 8), plus un mic strat de rezoluție tip `SkillManager` (deja existent ca
pattern în `lib/platform/skills/manager.ts`) pentru capabilitățile care CHIAR au nevoie de o librărie/serviciu
real.

```
lib/experience/arsenal/
├── patterns/
│   ├── scroll-pin-cinematic.md       # rețetă: sticky stage + scroll-sampled state machine, cod de referință din Bakery V2
│   ├── webgl-shader-fallback.md      # rețetă: raw WebGL2, context-loss handling, FPS degradation, no-gl class
│   ├── reveal-on-scroll.md           # IntersectionObserver, din Ridgeway
│   ├── accessible-tabs.md            # ARIA tablist manual, din Ridgeway
│   ├── native-modal.md               # <dialog>, feature-detected
│   ├── magnetic-cta.md               # pointermove attraction
│   └── ...
├── requirement-vocabulary.json       # mapare "cerință de creative direction" → pattern id(-uri) candidate
└── resolver.ts                       # dat un requirement id, întoarce pattern(-uri) + fallback + (dacă aplicabil) librărie reală cu blockingReason în stilul SkillManager
```

**Cum funcționează Regula #8 concret:** Creative Direction (rezultat din `experienceDirectorAgent`, stage nou)
emite un requirement precum `"pinned-cinematic-scroll"`. `resolver.ts` întoarce
`{ pattern: "scroll-pin-cinematic", codeRef: "arsenal/patterns/scroll-pin-cinematic.md", library: null }`.
Pentru un requirement care CHIAR are nevoie de librărie (`"interactive-map-embed"`), resolver-ul întoarce
`{ pattern: null, library: "leaflet", blockingReason: null }` sau, dacă lipsește o cheie necesară,
`{ library: "google-maps-js", blockingReason: "missing_credential:GOOGLE_MAPS_API_KEY" }` — exact taxonomia deja
folosită de `lib/platform/skills/manager.ts` (`not_registered`/`missing_credential`/`not_implemented`), reutilizată
ca vocabular comun, nu reinventată.

---

## 11. External Integration Contract — format obligatoriu per serviciu

Aplicat identic pentru fiecare integrare externă din §12; exemplu complet pentru Web3Forms (Regula #19):

**Web3Forms (formular de contact)**

*Ce face Claude autonom:* creează adaptorul (`lib/platform/skills/builtin/web.ts` → înlocuiește placeholder-ul
`forms` sau adaugă unul nou), integrează form renderer-ul pe Track A/B, adaugă validare client+server-side,
testează fallback (fără cheie → mesaj clar, nu eroare mută), creează artifact de test.

*Ce trebuie să faci tu:*
1. Intră pe https://web3forms.com.
2. Creează cont (gratuit, fără card).
3. Nu e nevoie de niciun plan plătit pentru volum mic (free tier: 250 submisii/lună).
4. Obține "Access Key" din dashboard.
5. **Nu trimite cheia în chat.**
6. Adaugă în `.env` local: `WEB3FORMS_ACCESS_KEY=...`
7. Spune-mi doar "gata".

*Ce fac eu după:* verific că variabila există (fără să-i afișez conținutul), fac un request real de test,
verific artifactul (screenshot al formularului trimis cu succes + confirmarea din dashboard Web3Forms).

*Cost:* tier0 (gratuit) pentru volum mic; niciun cost per site la scara actuală de testare.

Acest format (Claude autonom / tu configurezi / Claude verifică) e obligatoriu pentru **fiecare** rând
`BLOCKED_ON_CREDENTIAL` sau `BLOCKED_ON_ACCOUNT` din Dependency Ledger (§19) — detaliat complet abia când fiecare
integrare intră efectiv în lucru (Phase 5+), ca să nu-ți dau azi instrucțiuni pentru servicii pe care s-ar putea
să nu le mai vrei până atunci.

---

## 12. Functional Capabilities — pe capacitate

| Capabilitate | Provider recomandat | Alternativă open-source | Status |
|---|---|---|---|
| Forms | Web3Forms | mailto: (deja suportat prin `safeHref`) | BLOCKED_ON_CREDENTIAL |
| Booking | Cal.com | — | BLOCKED_ON_ACCOUNT (al cui cont — al tău sau al fiecărui business owner? clarificăm la Phase 5) |
| Hartă simplă (embed) | Leaflet + OSM tiles | — (deja open-source) | READY (zero credențial, dacă adresa/coordonatele vin din discovery) |
| Hartă cu date Places (rating live, poze owner) | Google Places API | — | BLOCKED_ON_CREDENTIAL (`GOOGLE_MAPS_API_KEY`, skill deja placeholder) |
| WhatsApp | link `wa.me` (dacă numărul există în date colectate) | — | BLOCKED_ON_BUSINESS_DATA (nu inventăm dacă nu există dovadă) |
| Search on-site | — | — | REJECTED implicit (over-engineering pt. site mic 1-pagină); RESEARCH doar dacă apare cerință multi-page |
| CMS self-edit | — | — | RESEARCH (decizie de produs, nu tehnică — te întreb când ajungem acolo) |
| Payments | Stripe Checkout links | — | BLOCKED_ON_OWNER_PROVISIONING (fiecare business owner își face propriul cont) |
| Image generation | OpenAI images / Gemini Imagen | Unsplash/Pexels stock (gratuit, atribuire) | BLOCKED_ON_CREDENTIAL pt. generare AI; Unsplash/Pexels READY-after-signup (gratuit) |
| Deploy | Cloudflare Pages | — | BLOCKED_ON_ACCOUNT |
| Accessibility audit | `@axe-core/playwright` | — (deja open-source) | READY, zero credențial |

---

## 13. MCP / Agent Skills — audit și plan

- **MCP HTTP connector** (`lib/platform/mcp/httpConnector.ts`) e implementat corect dar **niciodată rulat live** și
  **niciun agent nu-l apelează azi**. Nu propun conectarea lui ca prioritate — Playwright e deja folosit direct
  (mai simplu, fără overhead de protocol) pentru discovery/collector/QA. MCP rămâne o cale de extensie utilă doar
  dacă vrei un server extern specific (ex: un MCP de stock photos) — RESEARCH, nu urgent.
- **Skills platform** (`lib/platform/skills/`) e mecanismul corect de conectat capabilități reale — fiecare rând
  din §12 devine, tehnic, înlocuirea unui placeholder cu un `Skill` real, fără schimbare de agent (exact designul
  documentat în `docs/skills.md`).
- **Agent Skills (`.claude/skills/`)** specifice acestui repo: nu există azi. Nu propun crearea lor în acest plan
  decât dacă vrei explicit un workflow repetabil (ex: "/generate-experience-site") — RESEARCH, low priority.
- **Axe/accessibility MCP sau librărie directă:** recomand librăria directă (`@axe-core/playwright`), nu MCP —
  mai puține piese mobile, zero credențial, integrare directă în `scripts/batch-audit.ts` sau succesorul lui.

---

## 14. Provider Strategy — AI

Fundația e deja solidă: 4 provideri abstractizați (`AIProvider` interface), adăugarea unui al 5-lea e un proces
documentat în 3 pași (`docs/providers.md`). Pentru comparație "același business + același evidence + același
prompt + același arsenal + același budget → provider diferit", planul propune:

- Un script nou de comparație (`scripts/compare-providers.ts`, Phase 7) care rulează aceeași generare Track B pe
  Anthropic/OpenAI/Gemini/OpenRouter, cu output side-by-side (screenshot + scor Vision Critic per provider).
- DeepSeek/Cerebras: niciun adaptor azi. Adăugarea lor e READY tehnic (proces de 3 pași documentat), dar
  **BLOCKED_ON_CREDENTIAL** — fiecare are nevoie de cont + API key propriu (vezi §19 pentru detaliu per-provider
  la momentul implementării).
- Gemini nu e presupus implicit nicăieri — `AI_PROVIDER` e deja variabilă izolată, default `anthropic`.

---

## 15. Anti-AI-Generic

`docs/design-intelligence-review.md` documentează deja, exhaustiv, 10 pattern-uri "generice" identificate pe 20
site-uri Track A (left-rail syndrome, card-uri tip "Bootstrap alert", hero cu 5 nume dar o singură compoziție
reală etc.). Track B rezolvă structural cea mai mare parte a acestei probleme prin construcție: fiind cod
generat bespoke per business (nu selectat dintr-un set fix de variante), nu poate produce "aceeași compoziție cu
5 nume" — riscul se mută de la "template uniform" la "calitate inconsistentă a generării", motiv pentru care
Vision Critic (§16) e obligatoriu pe Track B, nu opțional.

Track A rămâne cu backlog-ul deja documentat (consumă `LayoutPlan` în renderer, implementează efectiv cele 5
variante de hero) — nu e în scope-ul urgent al acestui plan (Track A e "protejat", nu "de îmbunătățit" în
această rundă), dar îl păstrez ca item RESEARCH pentru o fază viitoare dacă vrei să investești și acolo.

---

## 16. Vision Critic / Repair — design propus

Complet absent azi — inclusiv infrastructura de bază (AI-ul e text-only). Plan concret:

1. **Extensie `lib/ai/types.ts`:** `AIGenerateRequest` capătă un câmp opțional `images?: {mimeType: string; data: string}[]`.
   Fiecare din cele 4 adaptoare (`anthropic.ts`, `openai.ts`, `gemini.ts`, `openrouter.ts`) capătă suport pentru
   input imagine — toate cele 4 API-uri suportă deja imagini base64 în schema lor de chat, deci e o extensie
   aditivă, nu un rewrite.
2. **Captură:** reutilizează exact tehnica din `scripts/batch-audit.ts` (force `loading=eager` + `img.decode()`
   înainte de `page.screenshot()`, desktop full-page + above-the-fold + mobile).
3. **Critică:** un prompt structurat cere modelului un scor per axă (design/UX/copy/accesibilitate/mobil) +
   listă de defecte specifice + instrucțiuni de reparație, format JSON validat local (reutilizează
   `lib/ai/schema.ts`).
4. **Repair loop:** dacă scorul < prag și bugetul de reparații nu e epuizat, defectele se transmit înapoi
   stagiului generativ ca instrucțiuni de patch. **Detecție de buclă**: dacă 2 reparații consecutive nu îmbunătățesc
   scorul (sau înrăutățesc), criticul poate emite `"schimbă direcția creativă"` → înapoi la
   `experienceDirectorAgent` cu un alt `direction`/pattern, nu la infinit pe aceeași variantă. Buget maxim
   dur (ex: 3 cicluri) — la epuizare, **fallback automat la Track A** (site-ul determinist, deja garantat corect),
   niciodată eșec total al pipeline-ului.
5. **Cost:** fiecare ciclu de critică = un apel LLM multimodal suplimentar — se contorizează în cost governance
   (§18).

---

## 17. Benchmark Protection

- Bakery V2 și Ridgeway Motors (fișierele trimise) trebuie **commise ca fixture-uri** în repo, ex:
  `test/fixtures/experience/bakery-v2/` și `test/fixtures/experience/ridgeway-motors/` (HTML+CSS+JS, fără
  asset-urile imagine lipsă — acelea rămân opțional de completat dacă le ai, altfel se documentează ca
  "assets missing" în manifest).
- Regresie propusă: nu "byte-identic" (Track B e generativ, nu determinist — nu putem cere output identic de la
  un LLM), ci **regresie structurală + de calitate**: (a) Vision Critic rulează pe orice output nou al Track B
  și scorul nu poate scădea sub scorul măsurat inițial pe cele două fixture-uri; (b) axe accessibility audit nu
  poate introduce erori noi; (c) Track A rămâne acoperit de cele 248 de teste existente, neschimbate — orice
  modificare acolo trebuie să treacă `npm test` fără diff de snapshot neintenționat.
- Orice fază din acest plan care atinge `lib/ai/`, `lib/platform/`, sau introduce cod nou trebuie rulată contra
  acestui set înainte de a fi considerată completă (Phase 10, dar verificat incremental la fiecare fază care
  atinge zone comune).

---

## 18. Cost Governance

Propunere nouă (nimic similar nu există azi), construită pe `FeatureFlags` deja existent:

- `tier0` (€0): Track A întotdeauna; Track B doar cu pattern-uri vanilla (fără apel AI de imagine, fără hartă
  plătită); Vision Critic dezactivat sau limitat la 0 cicluri (Track B fără QA = nepublicabil, deci tier0 practic
  înseamnă "doar Track A").
- `tier1` (până la €5/site): 1 ciclu Vision Critic + eventual 1-2 imagini generate AI dacă lipsesc.
- `tier2` (până la €20/site): până la 3 cicluri Vision Critic, integrare hartă/booking cu cheie platformă.
- `tier3` (caller supplied): business owner își aduce propriile credențiale (Stripe, Cal.com) — cost zero pentru
  platformă.
- Implementare: `FEATURE_COST_TIER=tier1` (nou), verificat înainte de orice apel plătit; fiecare skill/pattern
  își declară costul estimat; telemetria existentă (`lib/platform/telemetry.ts`) se extinde cu un câmp de cost
  cumulat per run.

---

## 19. Dependency Ledger

| Componentă | Ce rezolvă | Open Source? | Credential? | Account? | Cost | Remus | Claude | Status |
|---|---|---|---|---|---|---|---|---|
| Cookbook arsenal (patterns) | vocabular motion/interaction | N/A (conținut propriu) | Nu | Nu | €0 | — | scrie patterns + resolver | READY |
| Extensie multimodală `lib/ai/` | Vision Critic | N/A (cod propriu) | Nu (reutilizează cheile AI existente) | Nu | €0 (marginal la apeluri existente) | — | implementează | READY |
| `@axe-core/playwright` | accessibility audit | Da, MIT | Nu | Nu | €0 | — | instalează + integrează | READY |
| Leaflet + OSM tiles | hartă simplă | Da, BSD-2 | Nu (tile publice OSM au fair-use policy) | Nu | €0 | — | integrează | READY |
| Web3Forms | formular contact | Nu (SaaS) | Da | Da (gratuit) | €0 (free tier) | creează cont, obține cheie | adaptor + test | BLOCKED_ON_CREDENTIAL |
| Cal.com | booking | Parțial (self-host posibil, dar SaaS mai simplu) | Da | Da | €0 free tier / plătit pt. features avansate | decide model (platformă vs. per-owner) + cont | adaptor + test | BLOCKED_ON_ACCOUNT + BLOCKED_ON_ARCHITECTURE (decizie de produs) |
| Google Places API | date reale Maps (rating, poze) | Nu | Da | Da (Google Cloud) | plătit după quota gratuită | activează API + facturare | adaptor + test | BLOCKED_ON_CREDENTIAL |
| Stripe | plăți | Nu | Da | Da, per business owner | comision per tranzacție | — (owner-ul face asta) | link de checkout | BLOCKED_ON_OWNER_PROVISIONING |
| Unsplash/Pexels API | fallback foto licit | Da (API gratuit, atribuire) | Da (cheie gratuită) | Da (gratuit) | €0 | creează cont, obține cheie | adaptor + test | BLOCKED_ON_CREDENTIAL |
| Imagine generată AI | fallback foto când lipsește | Nu | Da (provider AI existent, dacă suportă imagini) | Nu (dacă provider deja configurat) | cost per imagine | confirmă provider dorit | implementează | BLOCKED_ON_CREDENTIAL (posibil deja rezolvat dacă AI key existent suportă imagini) |
| Cloudflare Pages | deploy | Parțial (platformă gratuită, cont necesar) | Da | Da (gratuit) | €0 pt. volum mic | creează cont + token | adaptor deploy | BLOCKED_ON_ACCOUNT |
| DeepSeek/Cerebras adapter | provider comparison | N/A (cod propriu, API extern plătit) | Da | Da | variabil | creează cont + cheie | adaptor (3 pași documentați) | BLOCKED_ON_CREDENTIAL, RESEARCH pt. prioritizare |
| CMS self-edit | editare ulterioară de owner | — | — | — | — | decizie de produs | — | RESEARCH |
| Search on-site | căutare în site | — | — | — | — | — | — | REJECTED (implicit, pt. site mic) |

---

## 20. Exact Implementation Phases

**PHASE 0 — Benchmark protection.** Commite Bakery V2/Ridgeway ca fixture-uri (`test/fixtures/experience/`).
Fișiere noi, zero atingere Track A. Test: fixture-urile se deschid corect local (verificare manuală browser).
Rollback: șterge directorul.

**PHASE 1 — Architecture/contracts.** Extensie multimodală `lib/ai/types.ts` + cele 4 adaptoare. Fișiere:
`lib/ai/types.ts`, `lib/ai/providers/*.ts`. Test: unit test nou pt. fiecare adaptor cu un input imagine mic,
verifică request-ul serializat corect (fără apel live obligatoriu la acest pas). Rollback: revert commit, Track A
neatins (câmpul e opțional).

**PHASE 2 — Arsenal Resolver.** Creează `lib/experience/arsenal/` (patterns + resolver.ts +
requirement-vocabulary.json), extrage cele 6+ pattern-uri din Bakery V2/Ridgeway ca documente de referință.
Fișiere noi exclusiv. Test: unit test pe `resolver.ts` (requirement → pattern/library mapping). Rollback: șterge
directorul.

**PHASE 3 — Asset Resolver.** `lib/assets/` nou + `assets/manifest.json` schema. Reutilizează
`lib/render/assets.ts` neschimbat pe Track A; taxonomia de proveniență disponibilă pentru Track B. Test: unit
test pe lanțul de rezoluție cu fixture-uri (business-owned prezent/absent → fallback corect). Rollback: șterge
directorul, Track A neatins.

**PHASE 4 — Open-source integrations (paralelizabile, per Regula #20).**
- 4a Leaflet+OSM: READY, fără blocaj.
- 4b `@axe-core/playwright`: READY, fără blocaj.
- 4c Web3Forms: BLOCKED_ON_CREDENTIAL — Claude pregătește adaptorul, testul real așteaptă cheia ta.
Fiecare sub-fază independentă, nu se blochează reciproc.

**PHASE 5 — Functional capabilities.** Booking/Maps Places/Payments — fiecare cu contractul din §11, detaliat
complet la începutul fazei (nu azi, ca să nu-ți dau instrucțiuni pentru servicii pe care poate nu le mai vrei
peste câteva săptămâni).

**PHASE 6 — MCP/Skills.** Conectare skill-uri reale în locul placeholder-elor relevante (§13). Fără atingere de
agent.

**PHASE 7 — Provider comparison.** `scripts/compare-providers.ts` nou. Necesită credențiale pentru providerii
suplimentari testați (BLOCKED_ON_CREDENTIAL per provider, altfel comparăm doar pe cei deja configurați).

**PHASE 8 — Creative/Experience improvements.** `experienceDirectorAgent.ts` + stagiul de generare Track B
propriu-zis. Cel mai mare bloc de lucru nou — detaliere completă file-level la kickoff-ul fazei.

**PHASE 9 — Vision/Repair improvements.** Integrare completă a buclei din §16 în Track B.

**PHASE 10 — Full benchmark.** Rulare completă `npm test` (Track A neschimbat) + Vision Critic pe fixture-urile
din Phase 0 + audit axe pe output Track B.

**PHASE 11 — Production rollout.** Deploy real (Cloudflare Pages), doar după Phase 10 verde.

---

## 21. Exact File-Level Changes (pentru fazele imediate)

**FILE:** `lib/ai/types.ts`
**FUNCTION:** interfața `AIGenerateRequest`
**CURRENT BEHAVIOR:** doar text (`prompt`, `schema`, etc.), fără suport de imagine.
**CHANGE:** adaugă câmp opțional `images?: { mimeType: string; data: string }[]`.
**WHY:** Vision Critic (§16) are nevoie să trimită screenshot-uri modelului.
**DEPENDENCIES:** cele 4 fișiere din `lib/ai/providers/`.
**TEST:** unit test nou, verifică serializarea request-ului cu/fără imagini.
**ARTIFACT:** rezultatul testului (pass/fail), niciun apel live necesar la acest pas.
**ROLLBACK:** revert commit — câmpul fiind opțional, Track A (care nu-l folosește) nu e afectat nici măcar
temporar.

*(Restul modificărilor file-level pentru Phase 2+ se detaliază la kickoff-ul fiecărei faze, cu context complet
din codul care va exista la acel moment — pre-specificarea lor acum ar însemna fie să ghicesc, fie să fac
implementarea de fapt.)*

---

## 22. Remus Action Checklist

*(În ordinea în care devin necesare — nimic din asta nu s-a executat în această sesiune; e lista pentru fazele
viitoare, pe măsură ce le aprobi.)*

**Phase 0-3:** nimic de la tine — totul e cod nou/fixture-uri, zero credențial.

**Phase 4c — Web3Forms** (detaliu complet, vezi §11 pentru contract):
1. https://web3forms.com → creează cont.
2. Obține Access Key.
3. Nu trimite cheia în chat.
4. `.env`: `WEB3FORMS_ACCESS_KEY=...`
5. Spune-mi "gata".

**Phase 5 — Maps Places API:**
1. https://console.cloud.google.com → creează proiect (sau reutilizează unul existent).
2. Activează "Places API".
3. Activează facturarea (necesar chiar și pt. free tier Google Cloud).
4. Creează cheie API, restricționează-o la Places API.
5. Nu trimite cheia în chat.
6. `.env`: `GOOGLE_MAPS_API_KEY=...`
7. Spune-mi "gata" — te anunț dacă quota gratuită ($200/lună credit Google) e suficientă pt. volumul tău de
   testare.

**Phase 5 — Cal.com:** aștept decizia ta de arhitectură (cont platformă unic vs. cont per business owner) înainte
să-ți dau pașii exacți.

**Phase 5 — Stripe:** nu e treaba ta să faci asta pentru fiecare business — proprietarul fiecărei firme își face
propriul cont Stripe; noi doar generăm link-ul de checkout. Nimic de făcut acum.

**Phase 11 — Cloudflare Pages:**
1. https://dash.cloudflare.com → creează cont gratuit.
2. Creează un API Token cu permisiune "Cloudflare Pages: Edit".
3. Nu trimite tokenul în chat.
4. `.env`: `CLOUDFLARE_API_TOKEN=...`, `CLOUDFLARE_ACCOUNT_ID=...`
5. Spune-mi "gata".

Restul (DeepSeek/Cerebras/OpenRouter suplimentar, Unsplash/Pexels, imagine AI) — detaliate identic, la momentul
fazei respective, ca să nu te aglomerez azi cu pași pentru servicii care poate nu mai sunt relevante peste
câteva săptămâni.

---

## 23. Risk Register

| Risc | Impact | Mitigare |
|---|---|---|
| Track B degradează accidental Track A prin atingere comună (ex: `lib/ai/types.ts`) | Înalt | Fiecare schimbare comună e strict aditivă (câmpuri opționale), verificată contra `npm test` înainte de commit |
| Vision Critic intră în buclă infinită de reparații | Mediu | Buget dur de cicluri + detecție de plateau + fallback automat la Track A |
| Cod generat de LLM (Track B) introduce vulnerabilități (XSS din conținut necurățat) | Înalt | Reutilizează `Html` branded type + escaping din `lib/render/html.ts` ca disciplină obligatorie, chiar și pt. cod generat |
| Costuri neașteptate din apeluri AI multimodale repetate | Mediu | Cost governance (§18) cu praguri dure per tier |
| Fonturi CDN (pattern Ridgeway) introduc dependență de rețea externă la runtime | Mic-Mediu | Implicit self-hosted (§9.3), CDN doar opt-in explicit |
| Documentație stale (precedent deja observat) | Mic | Fiecare fază actualizează docs-ul relevant în același commit |

---

## 24. Dependency Graph (simplificat)

```
Track A (neschimbat)
main.ts → discovery → collect → normalize → analyze[LLM] → write[LLM] → design → render → deploy(stub)

Track B (nou, opțional, paralel)
                                      ↘
                          [4-strategy.json, 5-content.json — READ-ONLY reuse]
                                      ↓
                        experienceDirectorAgent (nou, LLM) → arsenal resolver (§10)
                                      ↓
                        experienceGenerate (nou, LLM, cod bespoke HTML/CSS/JS)
                                      ↓
                        experienceQA — Vision Critic + repair loop (§16)
                                ↓ (scor OK)              ↓ (buget epuizat)
                    output/<runId>/experience/     fallback → Track A output/<runId>/site/
                                      ↓
                              deploy (comun ambelor track-uri)
```

---

## 25. Acceptance Criteria

- Track A: `npm test` trece 100%, zero diff de snapshot neintenționat, în orice fază.
- Phase 0: fixture-urile Bakery V2/Ridgeway există în repo, se deschid corect local.
- Phase 1: cele 4 adaptoare AI acceptă (opțional) imagini fără să rupă apelurile text-only existente.
- Phase 2: resolver-ul întoarce pattern/library corect pentru minim 6 requirement-uri de test.
- Phase 4a/4b: hartă Leaflet + audit axe rulează end-to-end pe un business de test, fără credențial.
- Phase 8-9: un business nou generat pe Track B obține scor Vision Critic peste pragul stabilit, sau cade automat
  pe Track A fără eroare vizibilă pentru utilizatorul final.
- Phase 10: benchmark complet verde pe ambele fixture-uri + un set de businessuri noi.

---

## 26. Rollback Strategy

Fiecare fază Track B trăiește în fișiere/directoare noi — rollback implicit prin `git revert`/ștergerea
directoarelor nou create, fără nicio interacțiune cu Track A. Singurele două puncte unde Track A e "atins" (deși
aditiv) sunt: (1) `lib/ai/types.ts` — câmp opțional, revert sigur; (2) `main.ts`'s `STAGES` array, dacă Phase 8
adaugă acolo un mod opțional de pipeline — se izolează sub un flag (`--track=experience`), implicit absent =
comportament identic cu azi.

---

## 27. Ordinea finală de implementare

Phase 0 → 1 → 2 → 3 → (4a, 4b în paralel cu 4c care așteaptă credențial) → 5 (pe măsură ce decizii/credențiale
sosesc, fără să blocheze restul) → 6 → 7 → 8 → 9 → 10 → 11.

Nimic din acest document nu s-a executat în această sesiune — e strict planul pentru sesiunile viitoare, pe
măsură ce aprobi fiecare fază.
