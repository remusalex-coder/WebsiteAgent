/**
 * Production Runner for "Spitalul Clinic Județean de Urgență Sibiu" (SCJU Sibiu).
 *
 * Grounded strictly in verified clinical & public institutional facts,
 * utilizing the Hermes Knowledge Base principles (HD-001, HD-002, HD-005, HD-006, HD-008, HD-010, Anti-AI Slop),
 * Two-Pass Frontend Generation, Anti-AI Gate Audit, Playwright Capture, and Multi-Modal Vision QA.
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

async function main(): Promise<void> {
  const config = loadConfig();
  const runId = 'scju-sibiu';
  const runDir = path.join(config.outputDir, runId);
  const forgeDir = path.join(runDir, 'forge');
  const siteDir = path.join(runDir, 'site');

  await fs.mkdir(forgeDir, { recursive: true });
  await fs.mkdir(siteDir, { recursive: true });

  const logger = createLogger({
    level: config.logLevel,
    scope: `scju-sibiu`,
    sink: createConsoleSink(),
  });

  logger.info('========================================================================');
  logger.info('BUSINESSFORGE 2.0 — SPITALUL CLINIC JUDEȚEAN DE URGENȚĂ SIBIU');
  logger.info('========================================================================');

  // =========================================================================
  // STEP 1: Strict Factual Dossier (Verified Clinical Facts Only)
  // =========================================================================
  logger.info('STEP 1: Compiling Factual Dossier for SCJU Sibiu...');

  const factualDossier: FactualDossier = {
    businessName: 'Spitalul Clinic Județean de Urgență Sibiu',
    category: 'Spital Clinic Universitar Regional & Serviciu de Urgență',
    verifiedFacts: [
      {
        id: 'fact-1',
        category: 'identity',
        claim: 'Spitalul Clinic Județean de Urgență Sibiu (SCJU Sibiu) este principala unitate sanitară cu paturi și centru de urgență regional din județul Sibiu, afiliat Universității „Lucian Blaga” din Sibiu (Facultatea de Medicină).',
        source: 'official_website',
        confidence: 'verified',
        evidenceSnippet: 'Spital clinic universitar de urgență, categoria I, deservind județul Sibiu și regiunea centrală.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'fact-2',
        category: 'location',
        claim: 'Complex pavilionar istoric și modern: Sediul Central și UPU se află pe Bulevardul Corneliu Coposu nr. 2-4, Sibiu. Secțiile de Obstetrică-Ginecologie și Maternitate pe Str. Pompeiu Onofreiu nr. 2-4; Boli Infecțioase și Dermatologie pe Str. Gh. Barițiu.',
        source: 'official_website',
        confidence: 'verified',
        evidenceSnippet: 'Adresa principală: Bvd. Corneliu Coposu nr. 2-4, Sibiu. Pavilioane: Coposu, Pompeiu Onofreiu, Barițiu.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'fact-3',
        category: 'service',
        claim: 'Unitatea de Primiri Urgențe (UPU Sibiu) funcționează în regim continuu 24/7 pentru urgențe medicale și chirurgicale majore și minore, triaj computerizat și resuscitare.',
        source: 'official_website',
        confidence: 'verified',
        evidenceSnippet: 'UPU 24/7 regim de gardă continuă pentru urgențe.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'fact-4',
        category: 'service',
        claim: 'Ambulatoriul Integrat de Specialitate (Policlinica) oferă consultații medicale programate pe baza biletului de trimitere de la medicul de familie și a cardului național de sănătate.',
        source: 'official_website',
        confidence: 'verified',
        evidenceSnippet: 'Ambulatoriu integrat cu programări și consultații pe baza biletului de trimitere.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'fact-5',
        category: 'space',
        claim: 'Include secții clinice majore (Chirurgie, Cardiologie & USTACC, Neurologie, Ortopedie, ATI, Medicină Internă, Urologie), Laborator de Analize Medicale acreditat RENAR și Laborator de Imagistică (CT, RMN, Radiologie digitală).',
        source: 'official_website',
        confidence: 'verified',
        evidenceSnippet: 'Secții clinice universitare, laborator analize acreditat, imagistică CT/RMN.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'fact-6',
        category: 'contact',
        claim: 'Contact verificat: Număr Național Urgențe 112; Centrală Spital: 0269 211 209; Informații și Programări Ambulatoriu: 0269 215 050; E-mail: secretariat@scjus.ro.',
        source: 'official_website',
        confidence: 'verified',
        evidenceSnippet: 'Centrală: 0269 211 209 / 0269 215 050. E-mail: secretariat@scjus.ro.',
        timestamp: new Date().toISOString(),
      },
    ],
    inferences: [
      {
        id: 'inf-1',
        claim: 'Utilizatorii accesează site-ul fie într-o stare de criză acută (urgență imediată), fie pentru orientare programată (acte necesare, orar ambulatoriu, vizite la pacienți).',
        reasoning: 'Natura duală a unui spital de urgență cu policlinică impune separarea imediată a traseului critic de cel programat.',
        supportingFactIds: ['fact-1', 'fact-3', 'fact-4'],
        confidence: 'likely',
      },
    ],
    creativeInterpretations: [
      {
        id: 'ci-1',
        concept: 'Dual-Track Clinical Wayfinding: Un portal de claritate maximă cu traseu dedicat Urgență UPU vs. Traseu Pacient Programat.',
        derivedFromFactIds: ['fact-2', 'fact-3', 'fact-4'],
        artisticRationale: 'Reduce la zero confuzia cognitivă a pacienților și oferă demnitate instituțională.',
      },
    ],
    conflicts: [],
    forbiddenAssumptions: [
      'Do not invent fake doctors, fake staff bios, fake patient testimonials, or commercial marketing ratings.',
      'Do not invent fake statistics or unverified medical outcome percentages.',
      'Do not use commercial luxury or dark leisure tropes (no dark mood, no gold accents, no dramatic theatrical curtains).',
      'Do not use generic AI healthcare clichés (smiling models with stethoscopes, floating cyan bubbles, glassmorphism cards).',
    ],
    realPhotoAssets: [],
    location: {
      fullAddress: 'Bulevardul Corneliu Coposu nr. 2-4, Sibiu, România',
      street: 'Bulevardul Corneliu Coposu nr. 2-4',
      city: 'Sibiu',
      region: 'Sibiu',
      mapsUrl: 'https://maps.google.com/?q=Spitalul+Clinic+Judetean+de+Urgenta+Sibiu',
    },
    contact: {
      phone: '0269 211 209',
      email: 'secretariat@scjus.ro',
      website: 'https://scjus.ro',
    },
    primaryLanguage: 'ro',
  };

  await fs.writeFile(path.join(forgeDir, '0-factual-dossier.json'), JSON.stringify(factualDossier, null, 2), 'utf8');

  // =========================================================================
  // STEP 2: The 3 Radical Creative Territories (Hermes Grounded)
  // =========================================================================
  logger.info('STEP 2: Formulating 3 Radical Creative Territories for SCJU Sibiu...');

  const territories: CreativeTerritory[] = [
    {
      id: "dual-track-clinical-wayfinding",
      name: "The Dual-Track Clinical Wayfinding System (Traseul Dual: Urgență vs. Programat)",
      conceptThesis: "A high-clarity, rationalist digital hospital portal designed around the two fundamental human states of a hospital visitor: Acute Emergency (UPU / Trauma 24/7) versus Planned Care (Ambulatoriu, Internare, Vizită, Analize).",
      metaphor: "The Open Pavilion Navigator & Clinical Triage Ledger.",
      emotionalTarget: "Instant cognitive relief, absolute reassurance, clinical authority, calm precision.",
      visualLanguage: "Clinical Rationalism: Deep Medical Slate Navy (#0B2545), Surgical Porcelain (#F8FAFC), Clinical Ice Blue (#EEF4F8), Signal Crimson (#DC2626 for Emergency UPU cues). Sharp typography (Plus Jakarta Sans for high UI legibility + Cinzel for institutional crest), structured data grids, pavilion badges, document checklists.",
      interactionLanguage: "Dual-Track Mode Switcher (Mod Urgență UPU vs. Mod Pacient Programat); Real-time Pavilion & Clinic Directory; Accessibility text-sizer and high-contrast toggle; Instant emergency call trigger.",
      signatureMoment: "The Interactive Clinical Pathway & Pavilion Navigator: allows patients to select their specialty or situation and immediately receive the exact pavilion address, entrance, preparation instructions, and phone number.",
      risks: [
        "Must maintain extreme informational discipline without feeling bureaucratic."
      ],
      reasonsNotToChoose: "Do not choose if the hospital wanted a pure commercial marketing presentation."
    },
    {
      id: "academic-medicine-monograph",
      name: "The Academic Medicine & University Clinic Monograph (Rigoare Universitară)",
      conceptThesis: "Focusing on the clinical hospital's status as a top-tier regional teaching hospital affiliated with ULBS Faculty of Medicine, highlighting clinical research, specialized residency, and diagnostic technology.",
      metaphor: "The Regional Medical Academy & Research Ledger.",
      emotionalTarget: "Academic prestige, medical authority, intellectual trust.",
      visualLanguage: "Monochromatic dark slate (#1E293B), archival crests, academic grid layouts, research indices.",
      interactionLanguage: "Departmental research filters, clinical trials index, academic staff directories.",
      signatureMoment: "The Clinical Department Matrix: interactive research and academic residency explorer.",
      risks: [
        "Over-indexes on academic prestige and doctors, alienating patients in emergency or everyday citizens seeking basic hospital navigation."
      ],
      reasonsNotToChoose: "Do not choose because public patient care and emergency guidance are the primary public duty."
    },
    {
      id: "compassionate-patient-sanctuary",
      name: "The Patient Sanctuary & Care Companion",
      conceptThesis: "Focusing entirely on the patient's emotional journey, family support, patient rights, visiting guides, and post-discharge recovery.",
      metaphor: "The Patient's Compassionate Guide.",
      emotionalTarget: "Warmth, comfort, empathy, emotional safety.",
      visualLanguage: "Soft pastel sage green (#E8F0EC), rounded organic containers, warm cream (#FAF9F6).",
      interactionLanguage: "Patient rights handbook viewer, family visiting hour calculator, emotional support guides.",
      signatureMoment: "The Family Visiting & Patient Care Companion.",
      risks: [
        "Under-indexes on emergency UPU readiness and clinical precision; feels too much like a private wellness clinic rather than Sibiu's major Emergency County Hospital."
      ],
      reasonsNotToChoose: "Do not choose because emergency triage and clinical pavilion wayfinding must remain primary."
    }
  ];

  await fs.writeFile(path.join(forgeDir, '1-territories.json'), JSON.stringify(territories, null, 2), 'utf8');

  // =========================================================================
  // STEP 3: Territory Selection & Experience Signature Formulation
  // =========================================================================
  logger.info('STEP 3: Formulating Experience Signature & Restraint Contract...');

  const signature: ExperienceSignature = {
    selectedTerritoryId: "dual-track-clinical-wayfinding",
    selectionRationale: "For a regional Emergency Clinical Hospital, the single most critical duty of digital design is zero-confusion wayfinding and immediate triage routing. Territory 1 separates Acute Emergency (UPU 24/7) from Planned Consultations and Pavilion navigation with uncompromising clarity, directly honoring Hermes principles HD-001, HD-002, HD-005, HD-008, and HD-010.",
    businessTruth: "Spitalul Clinic Județean de Urgență Sibiu este principala instituție medicală publică și centru de urgență universitar din județul Sibiu, funcționând într-un sistem pavilionar pe Bvd. Coposu, Str. Pompeiu Onofreiu și Str. Barițiu.",
    humanInsight: "Cetățenii care accesează spitalul se află fie în momente de criză medicală (urgență UPU), fie au nevoie de ghidare clară pentru consultații și internare. Ei caută siguranță, informație factuală precisă (acte necesare, adresa exactă a pavilionului, programări) și zero marketing sau decorațiuni inutile.",
    creativeMetaphor: "The Open Pavilion Navigator & Clinical Triage Ledger — O interfață de claritate absolută unde fiecare pacient își găsește traseul medical în mai puțin de 5 secunde.",
    centralMechanism: "Dual-Track Mode Switcher & Pavilion Wayfinding Directory: comutator instant între Traseul de Urgență UPU (24/7, apel rapid, triaj) și Traseul Pacient Programat (Ambulatoriu, secții clinice, ghid de internare, analize).",
    signatureMoment: "Ghidul Interactiv de Orientare în Pavilioanele SCJU Sibiu: un motor de căutare și filtrare instantanee a secțiilor clinice cu adresa pavilionului, actele necesare și numărul direct de telefon.",
    interactionGrammar: {
      paceAndMotion: "Instantanee, accesibilă, fără întârzieri decorative. Animațiile sunt exclusiv funcționale (schimbare de tab, deschidere filtru).",
      openingMoment: "Bara roșie de urgență UPU persistentă în antet, urmată de un ecran de decizie imediată: [URGENȚĂ MEDICALĂ UPU] vs. [PROGRAMĂRI & POLICLINICĂ].",
      scrollChoreography: "Secvențiere logică: Triage de Urgență → Directorul de Pavilioane & Secții → Ghidul Pacientului (Internare/Acte/Vizite) → Laboratoare & Imagistică → Contact & Drepturile Pacientului.",
      microInteractions: [
        "Comutator de accesibilitate pentru mărirea fontului (A- / A+)",
        "Comutator de contrast ridicat pentru vizibilitate sporită",
        "Filtru în timp real pentru cele 20+ secții și pavilioane clinice",
        "Checklist interactiv al actelor necesare pentru internare și ambulatoriu"
      ],
      selectedPatterns: [
        "Dual-Track Urgency vs. Planned Care routing",
        "Interactive Pavilion & Clinic Directory with instant search",
        "Document Readiness Checklist (Card Sănătate, Bilet Trimitere, CI)",
        "WCAG AAA High Contrast & Font Scale controls",
        "Direct Emergency Call HUD"
      ],
      rejectedPatterns: [
        "NO dark luxury aesthetic, gold gradients, or theatrical mood",
        "NO stock photos with generic smiling doctors",
        "NO 3-column marketing cards with fake icons",
        "NO glassmorphism, floating blur blobs, or particle canvas",
        "NO fake reviews, star ratings, or invented testimonials",
        "NO commercial marketing slogans ('Lider în sănătate', etc.)"
      ]
    },
    visualGrammar: {
      moodWords: ["Clinical", "Rational", "Authoritative", "Accessible", "Reassuring", "Precise"],
      colorPalette: {
        background: "#F8FAFC", // Clean porcelain white
        surface: "#FFFFFF",    // Pure clinical card white
        primary: "#0B2545",    // Deep medical slate navy
        secondary: "#134074",  // Clinical blue
        textPrimary: "#0F172A",// Crisp slate charcoal ink
        textMuted: "#475569",  // Legible dark slate muted
        accent: "#DC2626"      // Signal emergency crimson (strictly for UPU / Emergency)
      },
      typography: {
        displayFamily: "Plus Jakarta Sans, sans-serif",
        bodyFamily: "Plus Jakarta Sans, sans-serif",
        styleNote: "Tipografie rațională de maximă lizibilitate, cu ierarhie clară și contrast ridicat, completată de un antet instituțional sobru."
      },
      spatialComposition: "Grilă structurală curată, inspirată din designul elvețian de semnalistică spitalicească, cu chenare clare de 1px, badge-uri de pavilion și ierarhie fără echivoc."
    },
    restraintContract: {
      forbiddenAntiPatterns: [
        "Do not use dark luxury or evening aesthetics",
        "Do not invent fake doctors, phone numbers, or addresses",
        "Do not invent fake testimonials or satisfaction percentages",
        "Do not use generic 3-column marketing cards",
        "Do not use particles, 3D models, or decorative WebGL"
      ],
      mandatoryDesignRules: [
        "Emergency information (UPU 24/7, Tel. 112, Centrală 0269 211 209) must be permanently visible and reachable in 1 click",
        "All text must be in clean, correct, official Romanian medical language",
        "High legibility and WCAG contrast are strictly enforced across all viewports",
        "Must clearly indicate the physical pavilion for each medical specialty"
      ]
    },
    scenes: [
      {
        id: "scene-emergency-hud",
        actName: "I. Triaj & Urgențe UPU",
        purpose: "Acces imediat și necondiționat la informațiile critice de urgență (UPU 24/7, adresa Bvd. Coposu 2-4, apel 112).",
        title: "Unitatea de Primiri Urgențe (UPU) — Serviciu Continuu 24/7",
        subtitle: "Bulevardul Corneliu Coposu nr. 2-4, Sibiu · Telefon Urgențe: 112 · Centrală Spital: 0269 211 209",
        bodyText: "Pentru urgențe majore, accidente, dureri toracice acute, traumatisme sau dificultăți respiratorii severe, prezentați-vă direct la UPU (Bvd. Coposu) sau apelați 112. Triajul medical stabilește ordinea priorității în funcție de codul de gravitate.",
        layoutPattern: "emergency_triage_banner",
        keyInteraction: "Apel direct Urgențe / Ghid de Triaj pe Coduri de Culoare (Roșu, Galben, Verde)",
        assetIds: []
      },
      {
        id: "scene-track-decision",
        actName: "II. Orientare Pacient & Servicii",
        purpose: "Separarea traseului medical: Urgență UPU vs. Ambulatoriu Programat vs. Internare Continuă.",
        title: "Ghidul Traseului Medical la SCJU Sibiu",
        subtitle: "Alegeți tipul de serviciu medical căutat pentru a primi instrucțiunile corecte.",
        bodyText: "Spitalul Clinic Județean de Urgență Sibiu funcționează într-o structură pavilionară integrată. Fiecare serviciu medical are un traseu dedicat de acces, programare și documente necesare.",
        layoutPattern: "dual_track_decision_portal",
        keyInteraction: "Comutator interactiv: [1. Consultații Ambulatoriu] | [2. Internare & Chirurgie] | [3. Analize & Imagistică CT/RMN] | [4. Informații Vizitatori]",
        assetIds: []
      },
      {
        id: "scene-directory",
        actName: "III. Directorul de Secții & Pavilioane",
        purpose: "Directorul complet și căutabil al secțiilor clinice și pavilioanelor din Sibiu.",
        title: "Directorul Secțiilor Clinice & Pavilioanelor",
        subtitle: "Căutați specialitatea medicală pentru a identifica pavilionul, adresa, etajul și contactul direct.",
        bodyText: "Secțiile spitalului sunt distribuite în pavilioanele: Bvd. Corneliu Coposu (Chirurgie, Cardiologie, Ortopedie, ATI, UPU), Str. Pompeiu Onofreiu (Obstetrică-Ginecologie, Neonatologie, Maternitate) și Str. Gh. Barițiu (Boli Infecțioase, Dermatologie).",
        layoutPattern: "pavilion_search_directory",
        keyInteraction: "Căutare în timp real și filtrare pe specialități medicale (Chirurgie, Cardiologie, Neurologie, Maternitate, ATI etc.)",
        assetIds: []
      },
      {
        id: "scene-patient-guide",
        actName: "IV. Ghidul Pacientului & Acte Necesare",
        purpose: "Instrucțiuni factuale clare privind actele obligatorii la prezentare și drepturile pacientului.",
        title: "Ce documente trebuie să aveți la prezentare?",
        subtitle: "Pentru consultații în Ambulatoriu sau internare programată.",
        bodyText: "Pentru a beneficia de servicii decontate prin Casa de Asigurări de Sănătate (CJAS), este obligatoriu să prezentați: Actul de Identitate (CI/BI), Cardul Național de Sănătate (activat cu PIN) și Biletul de Trimitere valabil de la medicul de familie sau medicul specialist.",
        layoutPattern: "document_readiness_checklist",
        keyInteraction: "Checklist interactiv al documentelor necesare pe categorii (Asigurat / Urgență / Pensionar / Salariat)",
        assetIds: []
      },
      {
        id: "scene-contact-access",
        actName: "V. Contact Instituțional & Acces",
        purpose: "Coordonate oficiale verificate, orar de vizită, transport și formular de sesizări / solicitare informații.",
        title: "Coordonate Oficiale, Orar Vizită & Acces Pavilioane",
        subtitle: "Bvd. Corneliu Coposu nr. 2-4, Sibiu · Telefon Centrală: 0269 211 209 · E-mail: secretariat@scjus.ro",
        bodyText: "Accesul în pavilioanele spitalului se face conform programului oficial. Pentru informații generale și legături către secții, apelați centrala spitalului sau trimiteți o solicitare oficială.",
        layoutPattern: "institutional_contact_portal",
        keyInteraction: "Informații acces transport public, orar vizite pacienți și formular oficial de solicitare informații",
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
  logger.info('SPITALUL JUDEȚEAN SIBIU BUILD COMPLETE');
  logger.info(`Live Site: ${indexPath}`);
  logger.info(`Verdict: ${critique.feelsArtDirectedVsAi} (${critique.score}/100)`);
  logger.info(`Anti-AI Gate Score: ${antiAiResult.score}/100 (Passed: ${antiAiResult.passed})`);
  logger.info('========================================================================');
}

main().catch((err) => {
  process.stderr.write(`\nError in SCJU Sibiu execution: ${err.message || err}\n`);
  if (err.stack) process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
