/**
 * Autonomous Frontend Builder (Experience Signature Edition - Two-Pass Architecture).
 *
 * Pass 1: Generates bespoke HTML5 document containing all scenes, Schema.org, and interactive containers.
 * Pass 2: Generates matching modern CSS3 and vanilla JavaScript targeting the exact DOM structure from Pass 1.
 *
 * Both passes route through the `structured_generation` capability — "return
 * an object that validates against a closed schema", which is exactly what
 * each pass does — rather than constructing a provider directly, giving the
 * builder the same cross-vendor failover `signature.ts` and `critic.ts`
 * already have instead of depending on a single vendor's daily quota.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createModelInvoker } from '../capability/invokers.js';
import { motionContractFor, motionContractPrompt, motionLibraryHtmlPrompt } from './motion.js';
import { functionalModulePrompt } from './functionalModules.js';
import { assetStrategyPrompt } from './assetStrategy.js';
import type { ExperienceBlueprint, ForgeRouting, GeneratedCode } from './types.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';

/**
 * The experience-strategy directives every prompt below must obey —
 * decisions the signature already made explicitly
 * (`ExperienceSignature.experienceStrategy`), rendered as instructions
 * rather than left for the builder to reinvent per business.
 */
function experienceStrategyPrompt(blueprint: ExperienceBlueprint): string {
  const s = blueprint.signature.experienceStrategy;
  return `EXPERIENCE STRATEGY DIRECTIVES (decided by the signature — do not override):
- Navigation model: ${s.navigationModel}
- Loading model: ${s.loadingModel}${s.loadingModel !== 'none' ? ' — tie any preloader/skeleton to real asset load events, never a fake timed animation' : ' — no preloader or skeleton; content is present on load'}
- Typography behavior: ${s.typographyBehavior}
- Cursor behavior: ${s.cursorBehavior}
- Scroll behavior: ${s.scrollBehavior}
- Layout grammar: ${s.layoutGrammar}
- Mobile behavior: ${s.mobileBehavior}
- Accessibility strategy: ${s.accessibilityStrategy}${s.accessibilityStrategy === 'wcag-aa-enhanced' ? ' — exceed the AA floor where it costs nothing structurally' : ' — meet the WCAG AA floor'}
- Media strategy: ${s.mediaStrategy}${!s.requires3D ? ' — no 3D asset or WebGL context; a real photograph or CSS/SVG conveys this' : ` — 3D justified: ${s.requires3DRationale}`}${!s.requiresVideo ? '' : ` — video justified: ${s.requiresVideoRationale}`}`;
}

export async function buildFrontend(
  blueprint: ExperienceBlueprint,
  runDir: string,
  config: AppConfig,
  routing: ForgeRouting,
  logger: Logger,
): Promise<GeneratedCode> {
  const siteDir = path.join(runDir, 'site');
  const siteAssetsDir = path.join(siteDir, 'assets');
  await fs.mkdir(siteAssetsDir, { recursive: true });

  // Copy all assets into site/assets/
  const runAssetsDir = path.join(runDir, 'assets');
  try {
    const assetFiles = await fs.readdir(runAssetsDir);
    for (const f of assetFiles) {
      await fs.copyFile(path.join(runAssetsDir, f), path.join(siteAssetsDir, f)).catch(() => {});
    }
  } catch {
    // ignore
  }

  logger.info('Synthesizing bespoke frontend code from Experience Signature (Two-Pass Engine)', {
    brandName: blueprint.brandName,
    metaphor: blueprint.signature.creativeMetaphor,
    scenesCount: blueprint.signature.scenes.length,
  });

  const { factualDossier, signature, conversionStrategy } = blueprint;

  // =========================================================================
  // PASS 1: HTML Architecture & Semantic Structure
  // =========================================================================
  logger.info('Builder Pass 1: Generating HTML5 semantic structure...');

  const htmlPrompt = `You are a Principal Frontend Architect.
Generate the complete, semantic, accessible HTML5 document for this bespoke digital experience.

BRAND: "${blueprint.brandName}"
CATEGORY: "${factualDossier.category}"
CREATIVE METAPHOR: "${signature.creativeMetaphor}"
CENTRAL MECHANISM: "${signature.centralMechanism}"
SIGNATURE MOMENT: "${signature.signatureMoment}"

CONVERSION: the primary call to action is "${conversionStrategy.primaryActionLabel}" (${conversionStrategy.primaryActionType}); make it reachable from the header and from the signature moment. ${conversionStrategy.secondaryActionLabel ? `Secondary action: "${conversionStrategy.secondaryActionLabel}".` : ''} Reassurance points to place near the action, not as a separate wall of copy: ${conversionStrategy.reassurancePoints.join('; ') || 'none verified'}.

VERIFIED FACTS (Use ONLY these as literal truths):
${factualDossier.verifiedFacts.map((f) => `- [${f.category}]: ${f.claim}`).join('\n')}
- Address: ${factualDossier.location.fullAddress}
- Phone: ${factualDossier.contact.phone || factualDossier.contact.email || ''}

FORBIDDEN ASSUMPTIONS (STRICTLY FORBIDDEN TO CLAIM IN COPY):
${factualDossier.forbiddenAssumptions.map((a) => `- ${a}`).join('\n')}

REAL PHOTO ASSETS AVAILABLE:
${JSON.stringify(factualDossier.realPhotoAssets.map((a) => ({ path: a.localPath, desc: a.realDescription })))}

${assetStrategyPrompt(blueprint.assetStrategy)}

SCENES TO BUILD:
${JSON.stringify(signature.scenes, null, 2)}

RESTRAINT CONTRACT & ANTI-PATTERNS:
${signature.restraintContract.forbiddenAntiPatterns.map((p) => `- DO NOT USE: ${p}`).join('\n')}

${experienceStrategyPrompt(blueprint)}

${functionalModulePrompt(signature.experienceStrategy.functionalModules, factualDossier)}

${motionLibraryHtmlPrompt(motionContractFor(signature.experienceStrategy.motionIntensity))}

CRITICAL HTML5 MANDATES:
1. Output valid HTML5 from <!DOCTYPE html> to </html>.
2. Include <head> with meta tags, title, <link rel="stylesheet" href="styles.css">, Google Fonts preconnect, and Schema.org JSON-LD tailored to the business category.
3. ABSOLUTE PROHIBITION: DO NOT write any <style> tags or CSS inside index.html! All styling belongs exclusively in styles.css in Pass 2. Keep the <head> minimal.
4. Clean, purposeful header (<header class="site-header">) reflecting the visual grammar and navigation behavior (navigationModel above).
5. Render ALL scenes in signature.scenes with rich semantic markup (<section id="..." class="scene ...">), monumental headings, sensory kicker tags, and interactive containers.
6. Implement the key interaction and central mechanism (${signature.centralMechanism}) with appropriate controls.
7. Include <dialog id="detail-modal" class="detail-modal"> for popups if relevant.
8. Implement every functional module specified above with its real fields, states and mailto: mechanism — inside the HTML structure, not deferred.
9. If the MOTION LIBRARIES section above names a library, add its CDN <script> tag now (near the Google Fonts preconnect, or immediately before the tag in mandate 10) — Pass 2 cannot add one for you.
10. Include <script src="experience.js"></script> at the bottom before </body>, AFTER any motion-library CDN <script> tag from mandate 9 (the library must already be loaded when experience.js runs).

Return JSON with a single key "html".`;

  const htmlInvoke = createModelInvoker(
    {
      system: 'You generate pristine, semantic, accessible HTML5 for award-winning digital experiences. Never include inline style tags.',
      prompt: htmlPrompt,
      schemaName: 'frontend_html',
      effort: 'low',
      maxTokens: 32000,
      modelOverrides: { [config.ai.provider]: config.writer.model || config.analyst.model },
      schema: {
        type: 'object',
        required: ['html'],
        properties: {
          html: { type: 'string', description: 'Complete index.html content' },
        },
      },
    },
    routing.providers,
    logger,
  );

  const htmlOutcome = await routing.capabilities.run('structured_generation', htmlInvoke, {
    tokens: { inputTokens: htmlPrompt.length / 4, outputTokens: 8_000 },
  });
  if (!htmlOutcome.outcome.ok) {
    throw new Error(`[forge.builder] no vendor could generate the HTML pass: ${htmlOutcome.outcome.error.message}`);
  }

  let generatedHtml = (htmlOutcome.outcome.data.data as any).html as string;

  // Sanity check: Ensure HTML is not truncated and has no inline style bloat
  if (!generatedHtml.includes('</html>') || !generatedHtml.includes('</body>')) {
    logger.warn('HTML output appears unclosed, appending closing tags');
    if (!generatedHtml.includes('</body>')) generatedHtml += '\n  <script src="experience.js"></script>\n</body>';
    if (!generatedHtml.includes('</html>')) generatedHtml += '\n</html>';
  }

  logger.info('Builder Pass 1 complete', { htmlBytes: Buffer.byteLength(generatedHtml) });

  // =========================================================================
  // PASS 2: Visual Styling (CSS3) & Interaction Logic (JavaScript)
  // =========================================================================
  logger.info('Builder Pass 2: Generating matching CSS3 & bespoke JavaScript...');

  const cssJsPrompt = `You are an Awwwards-winning Creative Technologist & UI Styling Master.
Write the complete styles.css and experience.js targeting the exact HTML structure generated in Pass 1.

BRAND: "${blueprint.brandName}"
CREATIVE METAPHOR: "${signature.creativeMetaphor}"
SIGNATURE MOMENT: "${signature.signatureMoment}"

VISUAL GRAMMAR & PALETTE:
- Background: ${signature.visualGrammar.colorPalette.background}
- Surface: ${signature.visualGrammar.colorPalette.surface}
- Primary Brand: ${signature.visualGrammar.colorPalette.primary}
- Accent: ${signature.visualGrammar.colorPalette.accent}
- Text: ${signature.visualGrammar.colorPalette.textPrimary}
- Muted: ${signature.visualGrammar.colorPalette.textMuted}
- Typography: Display: ${signature.visualGrammar.typography.displayFamily}, Body: ${signature.visualGrammar.typography.bodyFamily}
- Selected Patterns: ${signature.interactionGrammar.selectedPatterns.join(', ')}
- REJECTED PATTERNS (DO NOT IMPLEMENT): ${signature.interactionGrammar.rejectedPatterns.join(', ')}

GENERATED HTML STRUCTURE (Match all selectors directly):
\`\`\`html
${generatedHtml}
\`\`\`

${motionContractPrompt(motionContractFor(signature.experienceStrategy.motionIntensity))}

${experienceStrategyPrompt(blueprint)}

CSS3 MANDATES (styles.css):
1. Google Fonts imports matching the visual grammar typography.
2. Styling matching the exact color palette tokens, generous whitespace, fluid typography clamp(2.4rem, 5vw, 4.8rem), and fluid container padding.
3. Responsive down to 360px mobile viewports (stacking cards, touch targets >= 48px, high contrast).
4. Animations and hover effects strictly within the motion system contract above — no invented durations or easings.

JAVASCRIPT MANDATES (experience.js):
1. Defensive DOMContentLoaded listener. Verify all query selectors exist before adding listeners.
2. IntersectionObserver scroll reveals for scene elements, respecting the motion system contract's simultaneity and stagger limits above.
3. Interactive behavior for the signature mechanisms (e.g. tabs, real-time search/filters, sliders, checklists, modal dialogs) and for every functional module specified in Pass 1 (real validation, real states, mailto: submission where specified — never a fetch/POST call, this site has no backend).
4. Smooth navigation and accessibility controls (e.g. contrast or font-size toggles if present).

Return JSON with "css" and "js" strings.`;

  const cssJsInvoke = createModelInvoker(
    {
      system:
        'You write bespoke, performant CSS3 and vanilla JavaScript strictly matching the provided HTML structure and visual grammar.',
      prompt: cssJsPrompt,
      schemaName: 'frontend_css_js',
      effort: 'low',
      maxTokens: 32000,
      modelOverrides: { [config.ai.provider]: config.writer.model || config.analyst.model },
      schema: {
        type: 'object',
        required: ['css', 'js'],
        properties: {
          css: { type: 'string', description: 'Complete styles.css content' },
          js: { type: 'string', description: 'Complete experience.js content' },
        },
      },
    },
    routing.providers,
    logger,
  );

  const cssJsOutcome = await routing.capabilities.run('structured_generation', cssJsInvoke, {
    tokens: { inputTokens: cssJsPrompt.length / 4, outputTokens: 8_000 },
  });
  if (!cssJsOutcome.outcome.ok) {
    throw new Error(`[forge.builder] no vendor could generate the CSS/JS pass: ${cssJsOutcome.outcome.error.message}`);
  }

  const generatedCss = (cssJsOutcome.outcome.data.data as any).css as string;
  const generatedJs = (cssJsOutcome.outcome.data.data as any).js as string;

  const code: GeneratedCode = {
    html: generatedHtml,
    css: generatedCss,
    js: generatedJs,
  };

  // Write files to siteDir
  await fs.writeFile(path.join(siteDir, 'index.html'), code.html, 'utf8');
  await fs.writeFile(path.join(siteDir, 'styles.css'), code.css, 'utf8');
  await fs.writeFile(path.join(siteDir, 'experience.js'), code.js, 'utf8');

  logger.info('Frontend code synthesized and saved successfully', {
    htmlBytes: Buffer.byteLength(code.html),
    cssBytes: Buffer.byteLength(code.css),
    jsBytes: Buffer.byteLength(code.js),
    targetDir: siteDir,
  });

  return code;
}
