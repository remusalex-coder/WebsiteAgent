/**
 * Autonomous Frontend Builder (Experience Signature Edition - Two-Pass Architecture).
 *
 * Pass 1: Generates bespoke HTML5 document containing all scenes, Schema.org, and interactive containers.
 * Pass 2: Generates matching modern CSS3 and vanilla JavaScript targeting the exact DOM structure from Pass 1.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExperienceBlueprint, GeneratedCode } from './types.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { createAIProvider } from '../ai/factory.js';

export async function buildFrontend(
  blueprint: ExperienceBlueprint,
  runDir: string,
  config: AppConfig,
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

  const ai = createAIProvider(config.ai, logger);
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

SCENES TO BUILD:
${JSON.stringify(signature.scenes, null, 2)}

RESTRAINT CONTRACT & ANTI-PATTERNS:
${signature.restraintContract.forbiddenAntiPatterns.map((p) => `- DO NOT USE: ${p}`).join('\n')}

CRITICAL HTML5 MANDATES:
1. Output valid HTML5 from <!DOCTYPE html> to </html>.
2. Include <head> with meta tags, title, <link rel="stylesheet" href="styles.css">, Google Fonts preconnect, and Schema.org JSON-LD tailored to the business category.
3. ABSOLUTE PROHIBITION: DO NOT write any <style> tags or CSS inside index.html! All styling belongs exclusively in styles.css in Pass 2. Keep the <head> minimal.
4. Clean, purposeful header (<header class="site-header">) reflecting the visual grammar and navigation behavior.
5. Render ALL scenes in signature.scenes with rich semantic markup (<section id="..." class="scene ...">), monumental headings, sensory kicker tags, and interactive containers.
6. Implement the key interaction and central mechanism (${signature.centralMechanism}) with appropriate controls.
7. Include <dialog id="detail-modal" class="detail-modal"> for popups if relevant.
8. Include <script src="experience.js"></script> at the bottom before </body>.

Return JSON with a single key "html".`;

  const htmlResponse = await ai.generate({
    model: config.writer.model || config.analyst.model || ai.defaultModel,
    prompt: htmlPrompt,
    system: 'You generate pristine, semantic, accessible HTML5 for award-winning digital experiences. Never include inline style tags.',
    effort: 'low',
    maxTokens: 32000,
    schema: {
      type: 'object',
      required: ['html'],
      properties: {
        html: { type: 'string', description: 'Complete index.html content' },
      },
    },
  });

  let generatedHtml = (htmlResponse.data as any).html as string;

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

CSS3 MANDATES (styles.css):
1. Google Fonts imports matching the visual grammar typography.
2. Styling matching the exact color palette tokens, generous whitespace, fluid typography clamp(2.4rem, 5vw, 4.8rem), and fluid container padding.
3. Responsive down to 360px mobile viewports (stacking cards, touch targets >= 48px, high contrast).
4. Refined subtle animations and hover effects serving the concept.

JAVASCRIPT MANDATES (experience.js):
1. Defensive DOMContentLoaded listener. Verify all query selectors exist before adding listeners.
2. IntersectionObserver scroll reveals for scene elements.
3. Interactive behavior for the signature mechanisms (e.g. tabs, real-time search/filters, sliders, checklists, modal dialogs).
4. Smooth navigation and accessibility controls (e.g. contrast or font-size toggles if present).

Return JSON with "css" and "js" strings.`;

  const cssJsResponse = await ai.generate({
    model: config.writer.model || config.analyst.model || ai.defaultModel,
    prompt: cssJsPrompt,
    system:
      'You write bespoke, performant CSS3 and vanilla JavaScript strictly matching the provided HTML structure and visual grammar.',
    effort: 'low',
    maxTokens: 32000,
    schema: {
      type: 'object',
      required: ['css', 'js'],
      properties: {
        css: { type: 'string', description: 'Complete styles.css content' },
        js: { type: 'string', description: 'Complete experience.js content' },
      },
    },
  });

  const generatedCss = (cssJsResponse.data as any).css as string;
  const generatedJs = (cssJsResponse.data as any).js as string;

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
