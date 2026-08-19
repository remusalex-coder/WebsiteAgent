/**
 * Experience Blueprint Compiler.
 *
 * Compiles the Factual Dossier and Experience Signature into an actionable,
 * strictly grounded Experience Blueprint for the Frontend Builder.
 *
 * `conversionStrategy` used to be four string literals — a reservation CTA in
 * Romanian, a phone-the-events-office secondary action, and reassurance
 * points reading "the cloud dance moment" and "4.7 stars from 217 reviews".
 * Those are River Park Events Drăgășani's own facts, hardcoded here rather
 * than read off `dossier`, so every business run through this compiler
 * received River Park's conversion copy regardless of what it actually is.
 * `buildFrontend` never reads this field today (confirmed: it destructures
 * `conversionStrategy` and never references it in either generation pass),
 * so the defect was silent — a wrong-but-unused value in `4-blueprint.json`
 * — rather than a wrong-and-shipped one. Deriving it from the dossier fixes
 * the artifact's honesty regardless, and `builder.ts` now actually reads it.
 */

import { planAssetStrategy } from './assetStrategy.js';
import type { ExperienceBlueprint, ExperienceSignature, FactualDossier } from './types.js';
import type { Logger } from '../logger.js';

type PrimaryActionType = ExperienceBlueprint['conversionStrategy']['primaryActionType'];

/** English/Romanian only — the two languages `dossier.primaryLanguage` is ever set to today. */
function isRomanian(dossier: FactualDossier): boolean {
  return dossier.primaryLanguage.toLowerCase().startsWith('ro');
}

/**
 * The conversion posture, from the business's own category — not a guess: a
 * venue or hospitality business is booked ahead of time, a restaurant or
 * bakery is ordered from, a trade is called, and anything else is visited.
 * Closed set, matching `ExperienceBlueprint.conversionStrategy.primaryActionType`.
 */
function actionTypeFor(category: string): PrimaryActionType {
  const c = category.toLowerCase();
  if (/venue|hotel|hospitality|wedding|event/.test(c)) return 'reserve';
  if (/restaurant|bakery|cafe|food|catering/.test(c)) return 'order';
  if (/repair|plumb|electric|mechanic|trade|service/.test(c)) return 'call';
  if (/book|studio|class|tour|appointment/.test(c)) return 'book';
  return 'visit';
}

const LABELS: Record<PrimaryActionType, { readonly en: string; readonly ro: string }> = {
  reserve: { en: 'Book Now', ro: 'Rezervă acum' },
  order: { en: 'Order Now', ro: 'Comandă acum' },
  call: { en: 'Call Now', ro: 'Sună acum' },
  book: { en: 'Book a Session', ro: 'Programează-te' },
  visit: { en: 'Get in Touch', ro: 'Ia legătura' },
};

const SECONDARY: Record<PrimaryActionType, { readonly en: string; readonly ro: string }> = {
  reserve: { en: 'Call to Ask a Question', ro: 'Sună cu o întrebare' },
  order: { en: 'View the Menu', ro: 'Vezi meniul' },
  call: { en: 'Send a Message', ro: 'Trimite un mesaj' },
  book: { en: 'Call to Ask a Question', ro: 'Sună cu o întrebare' },
  visit: { en: 'Call Us', ro: 'Sună-ne' },
};

/**
 * Reassurance points grounded in what the dossier actually verified — a
 * rating with its real count, a phone number that is real and dialable, the
 * signature moment named by the Experience Signature itself (not a
 * paraphrase of one specific business's). Never invents a number: a business
 * with no verified rating gets no rating line, exactly as the writer's
 * grounding rules require elsewhere in this repository.
 */
function reassurancePointsFor(
  dossier: FactualDossier,
  signature: ExperienceSignature,
  ro: boolean,
): readonly string[] {
  const points: string[] = [];

  if (dossier.verifiedRating) {
    const { rating, reviewCount } = dossier.verifiedRating;
    points.push(
      ro
        ? `${rating.toFixed(1)} ★ pe Google din ${reviewCount} recenzii verificate`
        : `${rating.toFixed(1)} ★ on Google from ${reviewCount} verified reviews`,
    );
  }

  if (signature.signatureMoment.trim() !== '') {
    points.push(ro ? `Experiență construită în jurul ${signature.signatureMoment.toLowerCase()}` : signature.signatureMoment);
  }

  if (dossier.contact.phone) {
    points.push(ro ? 'Răspuns rapid la telefon' : 'Fast response by phone');
  }

  return points;
}

export function compileBlueprint(
  dossier: FactualDossier,
  signature: ExperienceSignature,
  logger: Logger,
): ExperienceBlueprint {
  const ro = isRomanian(dossier);
  const actionType = actionTypeFor(dossier.category);
  const reassurancePoints = reassurancePointsFor(dossier, signature, ro);

  logger.info('Compiling Experience Blueprint with Factual Firewall bindings', {
    brandName: dossier.businessName,
    signatureMetaphor: signature.creativeMetaphor,
    scenesCount: signature.scenes.length,
    actionType,
    reassurancePointCount: reassurancePoints.length,
  });

  const assetStrategy = planAssetStrategy(dossier, signature);
  logger.info('Asset strategy planned', {
    realAssetsUsed: assetStrategy.realAssetsUsed,
    nonDepictiveSubstitutes: assetStrategy.nonDepictiveSubstitutes,
    humanGatedCandidates: assetStrategy.humanGatedCandidates,
  });

  const blueprint: ExperienceBlueprint = {
    brandName: dossier.businessName,
    factualDossier: dossier,
    signature,
    conversionStrategy: {
      primaryActionLabel: ro ? LABELS[actionType].ro : LABELS[actionType].en,
      primaryActionType: actionType,
      secondaryActionLabel: ro ? SECONDARY[actionType].ro : SECONDARY[actionType].en,
      reassurancePoints,
    },
    assetStrategy,
  };

  return blueprint;
}
