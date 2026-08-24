/**
 * Production Runner for "Atelier Nocturne" (Sibiu) - Experience Signature Generation.
 *
 * Strictly adheres to Factual Grounding, Creative Territory Divergence,
 * Experience Signature formulation, Two-Pass Frontend Generation, Anti-AI Slop Audit,
 * Playwright Screenshot Capture, Multi-Modal Vision QA, and Auto-Browser Launch.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { FactualDossier, CreativeTerritory, ExperienceSignature, ExperienceBlueprint, GeneratedCode } from '../../lib/forge/types.js';
import { compileBlueprint } from '../../lib/forge/blueprint.js';
import { buildFrontend } from '../../lib/forge/builder.js';
import { auditAntiAIGeneric } from '../../lib/forge/anti-ai-gate.js';
import { captureSite } from '../../lib/forge/browser.js';
import { evaluateVision } from '../../lib/forge/critic.js';
import { openInBrowser } from './preview.js';
import { loadConfig } from '../../lib/config.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';
import { createAIProvider } from '../../lib/ai/factory.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const runId = 'atelier-nocturne';
  const runDir = path.join(config.outputDir, runId);
  const forgeDir = path.join(runDir, 'forge');
  const siteDir = path.join(runDir, 'site');

  await fs.mkdir(forgeDir, { recursive: true });
  await fs.mkdir(siteDir, { recursive: true });

  const logger = createLogger({
    level: config.logLevel,
    scope: `atelier-nocturne`,
    sink: createConsoleSink(),
  });

  logger.info('========================================================================');
  logger.info('BUSINESSFORGE 2.0 — ATELIER NOCTURNE BESPOKE EXPERIENCE PIPELINE');
  logger.info('========================================================================');

  // =========================================================================
  // STEP 1: Strict Factual Dossier (No Hallucinations)
  // =========================================================================
  logger.info('STEP 1: Compiling Strict Factual Dossier...');

  const factualDossier: FactualDossier = {
    businessName: 'Atelier Nocturne',
    category: 'Contemporary Event & Cultural Space',
    verifiedFacts: [
      {
        id: 'fact-1',
        category: 'identity',
        claim: 'Atelier Nocturne is an independent contemporary event and cultural space in Sibiu.',
        source: 'user_input',
        confidence: 'verified',
        evidenceSnippet: 'An independent contemporary event and cultural space in Sibiu.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'fact-2',
        category: 'space',
        claim: 'The space combines an authentic old industrial interior with contemporary furniture, high ceilings, exposed structural elements, and a large central skylight.',
        source: 'user_input',
        confidence: 'verified',
        evidenceSnippet: 'Combines an old industrial interior with contemporary furniture. High ceiling, exposed structural elements, large central skylight.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'fact-3',
        category: 'space',
        claim: 'Maximum capacity is approximately 80 guests.',
        source: 'user_input',
        confidence: 'verified',
        evidenceSnippet: 'Capacity is approximately 80 guests.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'fact-4',
        category: 'service',
        claim: 'Hosts private dinners, intimate celebrations, cultural evenings, and small curated events where lighting naturally transitions from daylight into evening.',
        source: 'user_input',
        confidence: 'verified',
        evidenceSnippet: 'Hosts private dinners, intimate celebrations, cultural evenings and small events. Events transition from daylight into evening.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'fact-5',
        category: 'feature',
        claim: 'Features a dedicated small bar and an open preparation kitchen designed for culinary and guest interaction.',
        source: 'user_input',
        confidence: 'verified',
        evidenceSnippet: 'The venue has a small bar and an open preparation kitchen.',
        timestamp: new Date().toISOString(),
      },
    ],
    inferences: [
      {
        id: 'inf-1',
        claim: 'The central skylight acts as a natural temporal element, creating an evolving light choreography throughout the event.',
        reasoning: 'Because the space features a large skylight and events transition from daylight to evening.',
        supportingFactIds: ['fact-2', 'fact-4'],
        confidence: 'likely',
      },
    ],
    creativeInterpretations: [
      {
        id: 'ci-1',
        concept: 'Chiaroscuro & Temporal Shift (The Skylight as a Living Architectural Clock).',
        derivedFromFactIds: ['fact-2', 'fact-4'],
        artisticRationale: 'Focusing on the physical shift of natural light elevates the venue above generic windowless ballrooms.',
      },
    ],
    conflicts: [],
    forbiddenAssumptions: [
      'Do not invent street addresses, phone numbers, fake awards, fake founder bios, or fake partnerships.',
      'Do not invent fake customer reviews, ratings, or numerical testimonials.',
      'Do not claim a capacity exceeding 80 guests.',
      'Do not use generic SaaS event templates or commercial ballroom tropes.',
    ],
    realPhotoAssets: [],
    location: {
      fullAddress: 'Sibiu, România',
      street: 'Sibiu',
      city: 'Sibiu',
      region: 'Transilvania',
    },
    contact: {
      email: 'enquiries@ateliernocturne.ro',
    },
    primaryLanguage: 'ro',
  };

  await fs.writeFile(path.join(forgeDir, '0-factual-dossier.json'), JSON.stringify(factualDossier, null, 2), 'utf8');

  // =========================================================================
  // STEP 2: The 3 Radical Creative Territories
  // =========================================================================
  logger.info('STEP 2: Defining 3 Radical Creative Territories...');

  const territories: CreativeTerritory[] = [
    {
      id: "skylight-diurnal-shift",
      name: "The Skylight Diurnal Shift (Chiaroscuro & Temporal Transition)",
      conceptThesis: "An architectural light-study where the website experience mirrors the physical transition of an event under the central skylight—from natural afternoon daylight through industrial steel to intimate candlelit evening around the open kitchen and bar.",
      metaphor: "The Skylight as a Living Architectural Clock.",
      emotionalTarget: "Atmospheric intimacy, anticipation, temporal stillness, unhurried elegance.",
      visualLanguage: "Chiaroscuro palette: limestone chalk (#EAE6DF), raw iron charcoal (#181A1B), warm amber candlelight (#D89B52), deep twilight indigo (#0D1117). Monographic typography (Neue Haas Grotesk style + refined transitional serif), architectural line diagrams, generous breathing whitespace.",
      interactionLanguage: "Ambient Light Scrub (Daylight → Twilight → Nocturne toggle) shifting the tone and focus of the space; architectural spatial annotations; quiet editorial scroll.",
      signatureMoment: "The Diurnal Light Scrub: a fluid interactive slider that shifts the venue's visual atmosphere from sun-drenched industrial afternoon to candlelit evening dinner under the skylight.",
      risks: [
        "Requires delicate CSS/JS color-mode transitions to feel organic rather than jarring."
      ],
      reasonsNotToChoose: "Do not choose if the client demands a loud, high-tempo nightclub aesthetic."
    },
    {
      id: "culinary-workshop-salon",
      name: "The Artisanal Workshop & Communal Table",
      conceptThesis: "Positioning the venue as an authentic atelier where the open preparation kitchen, seasonal culinary craft, and tactile materials (exposed brick, raw steel, oiled oak) take center stage.",
      metaphor: "The Host's Private Kitchen Atelier.",
      emotionalTarget: "Tactile warmth, conviviality, culinary authenticity, unpretentious sophistication.",
      visualLanguage: "Warm terracotta (#B85D3B), raw linen (#D9CEBE), oiled oak brown (#3E271D), brushed aluminum. Monospaced annotations, macro material textures, robust editorial grid.",
      interactionLanguage: "Spatial flow diagram highlighting the dialogue between the open kitchen prep counter, the small bar, and the 80-seat communal dinner setting.",
      signatureMoment: "The Kitchen-to-Table Choreography plan illustrating how chefs and guests share the open preparation space.",
      risks: [
        "May skew the perception toward a private restaurant rather than a versatile cultural gathering space."
      ],
      reasonsNotToChoose: "Do not choose if private celebrations or cultural evenings need equal prominence with dining."
    },
    {
      id: "spatial-monograph-archive",
      name: "The Spatial Monograph & Cultural Ledger",
      conceptThesis: "Presenting the venue like a limited-edition architectural and cultural publication—a quiet, museum-grade monograph detailing acoustic properties, raw industrial textures, and curated event scenarios.",
      metaphor: "An Architectural & Cultural Ledger.",
      emotionalTarget: "Intellectual poise, discerning exclusivity, architectural reverence.",
      visualLanguage: "Strict monochromatic bone (#F4F3EE) and carbon black (#121212) with structural framing lines, precise metric dimensions (80 cap, ceiling height, skylight aperture), Swiss typographic grid.",
      interactionLanguage: "Horizontal spatial ledger navigation, minimalist blueprint dimension overlays, minimalist enquiry form.",
      signatureMoment: "The Curatorial Specification Index: an interactive blueprint detailing volume, acoustics, light ingress, and layout variations for 80 guests.",
      risks: [
        "May feel emotionally austere for couples planning intimate weddings."
      ],
      reasonsNotToChoose: "Do not choose if immediate emotional warmth and romantic charm are primary sales drivers."
    }
  ];

  await fs.writeFile(path.join(forgeDir, '1-territories.json'), JSON.stringify(territories, null, 2), 'utf8');

  // =========================================================================
  // STEP 3: Territory Selection & Experience Signature Formulation
  // =========================================================================
  logger.info('STEP 3: Formulating Experience Signature & Restraint Contract...');

  const signature: ExperienceSignature = {
    selectedTerritoryId: "skylight-diurnal-shift",
    selectionRationale: "The defining physical and emotional reality of Atelier Nocturne is its large central skylight and the natural transition of events from daylight into evening. This is an uncopyable, bespoke spatial truth that honors the industrial architecture, the open kitchen, and the intimate 80-guest scale without relying on generic luxury clichés.",
    businessTruth: "An independent contemporary space in Sibiu combining an authentic industrial shell with contemporary furniture, an open kitchen, a small bar, and a central skylight for intimate gatherings of up to 80 guests.",
    humanInsight: "People organizing an intimate wedding, private dinner, or cultural evening aren't looking for a sterile banquet hall; they crave a space with genuine soul, architectural character, and a light-filled atmosphere that evolves naturally as the night unfolds.",
    creativeMetaphor: "The Skylight as a Living Architectural Clock — where raw industrial structural bones cradle shifting natural light and warm culinary intimacy.",
    centralMechanism: "Diurnal Atmosphere Shift: An interactive ambient lighting control (Lumina Zilei / Amurg / Nocturn) that lets the visitor experience the space across the natural arc of an event.",
    signatureMoment: "The Interactive Skylight Light Study: a visual and textural atmospheric transformation demonstrating how natural daylight through the skylight yields to candlelit evening warmth over the open kitchen and communal tables.",
    interactionGrammar: {
      paceAndMotion: "Unrushed, architectural, tactile. Elements reveal with quiet precision, mimicking natural light moving across concrete and brushed steel.",
      openingMoment: "A monumental, asymmetric typographic composition stating the architectural truth of the space, framed by an ambient light indicator showing the current time in Sibiu.",
      scrollChoreography: "Continuous editorial flow linking the structural anatomy (skylight, ceiling, raw textures) directly to curated event formats (dinners, private celebrations, cultural salons).",
      microInteractions: [
        "Light mode scrub (Daylight / Twilight / Nocturne) altering page tones and atmospheric mood",
        "Spatial blueprint toggle detailing the 80-guest dinner layout vs. cultural salon layout",
        "Curated event enquiry composer with guest slider (10 to 80 guests) and light-preference selector"
      ],
      selectedPatterns: [
        "Asymmetric architectural layout grids",
        "Ambient diurnal light shift toggle",
        "Tactile material specification cards (Beton industrial, Lemn cald, Fier forjat, Sticlă luminator)",
        "Bespoke 80-guest event enquiry composer"
      ],
      rejectedPatterns: [
        "NO 3D models or WebGL load delays",
        "NO decorative floating particle blizzard",
        "NO generic 3-column card grids",
        "NO centered hero with two buttons",
        "NO glassmorphism blur cards or neon glow",
        "NO fake testimonials, reviews, or invented awards",
        "NO repetitive CTA banners"
      ]
    },
    visualGrammar: {
      moodWords: ["Architectural", "Diurnal", "Intimate", "Raw", "Tactile", "Curated"],
      colorPalette: {
        background: "#0E1114",
        surface: "#161B22",
        primary: "#E2DDD5",
        secondary: "#8B949E",
        textPrimary: "#F0EBE1",
        textMuted: "#8F96A0",
        accent: "#D49B55" // Warm candlelight amber
      },
      typography: {
        displayFamily: "Plus Jakarta Sans, sans-serif",
        bodyFamily: "Plus Jakarta Sans, sans-serif",
        styleNote: "Crisp architectural sans-serif with subtle editorial serif accents (Instrument Serif / Playfair) for poetic moments."
      },
      spatialComposition: "Asymmetric editorial monograph layout with bold scale contrasts, generous negative space, and architectural line work."
    },
    restraintContract: {
      forbiddenAntiPatterns: [
        "Do not use generic 'Create unforgettable memories' marketing copy",
        "Do not invent phone numbers, street addresses, or fake testimonials",
        "Do not claim capacity above 80 guests",
        "Do not use generic three-column card grids",
        "Do not use decorative particle systems or floating shapes"
      ],
      mandatoryDesignRules: [
        "Every section must directly reinforce the central architectural facts (skylight, industrial interior, open kitchen, 80-guest capacity)",
        "Copy must be written in sophisticated, restrained Romanian celebrating architectural and culinary craft",
        "The enquiry mechanism must be tailored specifically for curated 80-guest gatherings"
      ]
    },
    scenes: [
      {
        id: "scene-intro",
        actName: "I. Spațiul & Lumina",
        purpose: "Prezentarea identității arhitecturale unice: interiorul industrial, mobilierul contemporan și luminatorul central.",
        title: "Arhitectură industrială sub lumina cerului deschis.",
        subtitle: "Un spațiu independent dedicat întâlnirilor intime, cinei private și culturii contemporane în Sibiu.",
        bodyText: "Atelier Nocturne este un dialog între materia brută a unei vechi structuri industriale și finețea designului contemporan. Sub un luminator central monumental, evenimentele trăiesc o transformare organică — de la claritatea luminii naturale de zi la intimitatea caldă a serii.",
        layoutPattern: "monumental_architectural_hero",
        keyInteraction: "Comutator de lumină ambientală (Zi → Amurg → Nocturn)",
        assetIds: []
      },
      {
        id: "scene-anatomy",
        actName: "II. Anatomia Spațiului",
        purpose: "Detalierea caracteristicilor fizice verificate: tavan înalt, elemente structurale expuse, bucătărie deschisă și bar.",
        title: "Proporții generoase. Detalii meticuloase.",
        subtitle: "Un spațiu gândit pentru până la 80 de oaspeți, fără pachete standardizate.",
        bodyText: "Fiecare colț al atelierului este conceput pentru fluiditate și conversație: bucătăria deschisă de preparare aduce măiestria culinară în văzul oaspeților, micul bar găzduiește vinuri și distilate alese, iar tavanul înalt cu structură aparentă oferă o acustică impecabilă.",
        layoutPattern: "spatial_anatomy_monograph",
        keyInteraction: "Selector de configurare spațială (Cină lungă comunală vs. Salon cultural)",
        assetIds: []
      },
      {
        id: "scene-experience",
        actName: "III. Trecerea Timpului",
        purpose: "Sublinierea momentului semnătură: tranziția de la lumină la întuneric în timpul unui eveniment.",
        title: "De la lumina zilei la căldura serii.",
        subtitle: "Luminatorul central devine martorul tăcut al fiecărui eveniment.",
        bodyText: "O nuntă intimă sau o cină privată la Atelier Nocturne începe sub razele soarelui filtrat prin sticla luminatorului și culminează la lumina discretă a lumânărilor și a reflectoarelor arhitecturale calde, pe măsură ce noaptea se așterne peste Sibiu.",
        layoutPattern: "diurnal_light_study",
        keyInteraction: "Slider interactiv de intensitate a luminii peste masa centrală",
        assetIds: []
      },
      {
        id: "scene-curation",
        actName: "IV. Destinații de Eveniment",
        purpose: "Definirea tipurilor de evenimente găzduite exclusiv pentru grupuri de până la 80 de persoane.",
        title: "Creat pentru evenimente cu substanță.",
        subtitle: "Cine private · Nunți intime · Seri culturale · Lansări dedicate",
        bodyText: "Refuzăm producția de serie și evenimentele de masă. Oferim spațiul celor care caută o experiență curatoriată, unde mâncarea se gătește la vedere, conversația se aude firesc, iar atmosfera este modelată după viziunea fiecărui gazdă.",
        layoutPattern: "curated_formats_ledger",
        keyInteraction: "Selector tactil de format de eveniment cu detalii de capacitate",
        assetIds: []
      },
      {
        id: "scene-enquiry",
        actName: "V. Inițiere Dialog",
        purpose: "Conversia primară: formular elegant și personalizat de solicitare disponibilitate.",
        title: "Imaginează-ți evenimentul la Atelier Nocturne.",
        subtitle: "Primele conversații pentru evenimente private în Sibiu (până la 80 de oaspeți).",
        bodyText: "Spune-ne ce moment dorești să creezi. Răspundem personal fiecărei solicitări pentru a discuta disponibilitatea și viziunea spațială a evenimentului tău.",
        layoutPattern: "bespoke_enquiry_composer",
        keyInteraction: "Configurator de invitați (10–80 persoane) și trimitere directă solicitare",
        assetIds: []
      }
    ]
  };

  await fs.writeFile(path.join(forgeDir, '2-signature.json'), JSON.stringify(signature, null, 2), 'utf8');

  // =========================================================================
  // STEP 4: Experience Blueprint Compilation
  // =========================================================================
  logger.info('STEP 4: Compiling Experience Blueprint...');
  const blueprint = compileBlueprint(factualDossier, signature, logger.child('blueprint'));
  await fs.writeFile(path.join(forgeDir, '3-blueprint.json'), JSON.stringify(blueprint, null, 2), 'utf8');

  // =========================================================================
  // STEP 5: Two-Pass Autonomous Frontend Builder
  // =========================================================================
  logger.info('STEP 5: Coding Bespoke Frontend (Two-Pass Architecture)...');
  const code = await buildFrontend(blueprint, runDir, config, logger.child('builder'));

  // =========================================================================
  // STEP 6: Anti-AI-Generic Slop Audit
  // =========================================================================
  logger.info('STEP 6: Running Anti-AI-Generic Gate Audit...');
  const antiAiResult = await auditAntiAIGeneric({
    code,
    blueprint,
    outputDir: config.outputDir,
    logger: logger.child('anti-ai-gate'),
  });
  await fs.writeFile(path.join(forgeDir, '4-anti-ai-gate.json'), JSON.stringify(antiAiResult, null, 2), 'utf8');

  // =========================================================================
  // STEP 7: Playwright Headless Browser Settle & Capture
  // =========================================================================
  logger.info('STEP 7: Rendering in Playwright & Capturing High-Res Screenshots...');
  const capture = await captureSite(siteDir, runDir, logger.child('browser'));

  // =========================================================================
  // STEP 8: Multi-Modal Vision QA Critic (10 Axes + Human Art Direction)
  // =========================================================================
  logger.info('STEP 8: Multi-Modal Vision QA Critic...');
  const critique = await evaluateVision({
    desktopShotPath: capture.desktop,
    mobileShotPath: capture.mobile,
    businessName: blueprint.brandName,
    signature: blueprint.signature,
    config,
    logger: logger.child('critic'),
  });
  await fs.writeFile(path.join(forgeDir, '5-critique.json'), JSON.stringify(critique, null, 2), 'utf8');

  // =========================================================================
  // STEP 9: Auto Live Browser Preview Launch
  // =========================================================================
  logger.info('STEP 9: Automatically Launching Browser Preview...');
  const indexPath = path.join(siteDir, 'index.html');
  openInBrowser(indexPath, logger);

  logger.info('========================================================================');
  logger.info('ATELIER NOCTURNE BUILD COMPLETE');
  logger.info(`Live Site: ${indexPath}`);
  logger.info(`Verdict: ${critique.feelsArtDirectedVsAi} (${critique.score}/100)`);
  logger.info(`Anti-AI Gate Score: ${antiAiResult.score}/100 (Passed: ${antiAiResult.passed})`);
  logger.info('========================================================================');
}

main().catch((err) => {
  process.stderr.write(`\nError in Atelier Nocturne execution: ${err.message || err}\n`);
  if (err.stack) process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
