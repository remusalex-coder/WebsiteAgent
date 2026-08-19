/**
 * Security. A static site with no server, no database and no client script
 * beyond one JSON-LD payload makes most classic web-app vulnerabilities
 * structurally absent — and this file says so with `NOT_APPLICABLE` rather
 * than pretending to check for them. What *is* real here is checked for
 * real: secret exposure in the actual rendered bytes, the escaping the
 * renderer promises, and the pipeline's own AI-provider spend controls.
 *
 * Deployment-only concerns — HTTPS, security headers, cookie flags — cannot
 * be answered before a host is chosen, so they report `BLOCKED`, not `PASS`:
 * nothing here is verified to be fine, only not yet knowable.
 */

import { check, scanTextForKnownValues, scanTextForSecretPatterns } from '../helpers.js';
import type { CheckFn } from '../types.js';

function allRenderedText(ctx: Parameters<CheckFn>[0]): string {
  return [ctx.html, ctx.css, ...ctx.site.files.map((f) => f.contents)].join('\n');
}

const noEmbeddedSecrets: CheckFn = (ctx) => {
  const c = check('security.no-embedded-secrets', 'security', 'No secret patterns in rendered output', 'critical');
  const findings = scanTextForSecretPatterns(allRenderedText(ctx));
  if (findings.length > 0) {
    return c.fail(findings, 'Remove the matched credential from the content spec and rotate it — anything shaped like a key was rendered into a public, static file.');
  }
  return c.pass(['no known secret pattern (API key, token, private key block) matched in the rendered HTML, CSS or assets list']);
};

const envVarsIsolated: CheckFn = (ctx) => {
  const c = check('security.env-vars-isolated', 'security', 'Configured credentials never reach client output', 'critical');
  const known = new Map<string, string>();
  for (const [key, value] of Object.entries(ctx.config.credentials)) known.set(key, value);
  for (const [provider, key] of Object.entries(ctx.config.ai.apiKeys)) {
    if (key.trim() !== '') known.set(`${provider} API key`, key);
  }
  if (ctx.config.lovable.apiKey.trim() !== '') known.set('LOVABLE_API_KEY', ctx.config.lovable.apiKey);

  if (known.size === 0) {
    return c.pass(['no credentials are configured for this run to leak']);
  }
  const findings = scanTextForKnownValues(allRenderedText(ctx), known);
  if (findings.length > 0) {
    return c.fail(findings, 'A configured credential value was found in the rendered site. Trace how it entered the content spec and remove it — this is a live key exposure.');
  }
  return c.pass([`checked ${known.size} configured credential value(s) against the rendered output; none appear`]);
};

const noSecretsInGit: CheckFn = (ctx) => {
  const c = check('security.no-secrets-in-git', 'security', 'No secrets committable alongside the run', 'high');
  if (!ctx.secretScan.scanned) {
    return c.blocked(['no outputDir was supplied for this report; the run directory was not scanned'], 'Run the preflight gate with the run\'s artifact directory so it can be scanned before anything is committed.');
  }
  if (ctx.secretScan.findings.length > 0) {
    return c.fail(ctx.secretScan.findings, 'Remove the flagged file(s) from the run directory, or add them to .gitignore, before committing.');
  }
  const gitignoreNote = ctx.secretScan.gitignoreExcludesOutput === false
    ? ['warning: the repository .gitignore does not appear to exclude the output directory']
    : ctx.secretScan.gitignoreExcludesOutput === null
      ? ['could not locate a repository root to check .gitignore']
      : ['the repository .gitignore excludes the output directory'];
  if (ctx.secretScan.gitignoreExcludesOutput === false) {
    return c.warn(gitignoreNote, 'Add the output directory to .gitignore so a generated run is never committed by accident.');
  }
  return c.pass(['run directory scan found no .env files or secret-shaped content', ...gitignoreNote]);
};

/** Whether the rendered page implies protected, per-user functionality. */
function protectedFunctionalityEvidence(html: string): readonly string[] {
  const found: string[] = [];
  for (const pattern of [/href="[^"]*\/(login|signin|account|dashboard|admin)\b/i, /<input[^>]*type="password"/i]) {
    const match = pattern.exec(html);
    if (match !== null) found.push(match[0]);
  }
  return found;
}

const authentication: CheckFn = (ctx) => {
  const c = check('security.authentication', 'security', 'Authentication', 'critical');
  const evidence = protectedFunctionalityEvidence(ctx.html);
  if (evidence.length === 0) {
    return c.na('the rendered page references no login, account or password functionality');
  }
  return c.blocked(evidence, 'Protected functionality is referenced but this pipeline has no authentication capability. Do not ship the link until real authentication exists behind it.');
};

const authorization: CheckFn = (ctx) => {
  const c = check('security.authorization', 'security', 'Authorization', 'critical');
  const evidence = protectedFunctionalityEvidence(ctx.html);
  if (evidence.length === 0) {
    return c.na('no role- or account-scoped functionality is referenced');
  }
  return c.blocked(evidence, 'Define and enforce the permission model before the referenced functionality goes live.');
};

const userPermissions: CheckFn = (ctx) => {
  const c = check('security.user-permissions', 'security', 'User permission model', 'high');
  const evidence = protectedFunctionalityEvidence(ctx.html);
  if (evidence.length === 0) {
    return c.na('no multi-user or account functionality exists for permissions to govern');
  }
  return c.blocked(evidence, 'Document who can do what before account functionality ships.');
};

const inputValidation: CheckFn = (ctx) => {
  const c = check('security.input-validation', 'security', 'Server-side input validation', 'critical');
  if (!/<form[\s>]/i.test(ctx.html)) return c.na('the rendered page has no <form> collecting input');
  return c.blocked(['a <form> is rendered but this pipeline has no server to validate a submission'], 'Do not accept submissions until a validated backend exists to receive them.');
};

const xssProtection: CheckFn = (ctx) => {
  const c = check('security.xss-protection', 'security', 'Output escaping (XSS)', 'critical');
  const problems: string[] = [];

  const scriptTags = [...ctx.html.matchAll(/<script[^>]*>/gi)];
  const nonJsonLd = scriptTags.filter((match) => !/type="application\/ld\+json"/.test(match[0]));
  if (nonJsonLd.length > 0) problems.push(`unexpected <script> tag(s) in rendered output: ${nonJsonLd.map((m) => m[0]).join(', ')}`);

  if (/href="javascript:/i.test(ctx.html)) problems.push('a javascript: URL survived into the rendered output');

  // Escaped text content can legitimately contain the substring "onerror=" —
  // e.g. a heading that quotes a malicious payload for editorial reasons, as
  // this repository's own tests do. Only a literal, unescaped opening tag
  // carrying the attribute is a real vulnerability, so the match requires a
  // `<tag` with no intervening `<`/`>` before the handler.
  if (/<[a-zA-Z][^<>]*\son(?:error|load|click|mouseover)\s*=/i.test(ctx.html)) {
    problems.push('an inline event handler attribute is present on a live element in the rendered output');
  }

  if (problems.length > 0) {
    return c.fail(problems, 'Everything reaching the page must go through the renderer\'s text()/attribute escaping — investigate how unescaped markup reached this run\'s output.');
  }
  return c.pass(['no unexpected <script> tags, javascript: URLs, or inline event handlers in the rendered HTML']);
};

const injectionRisks: CheckFn = (ctx) => {
  const c = check('security.injection-risks', 'security', 'Structured-data injection', 'critical');
  const scriptMatch = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(ctx.html);
  if (scriptMatch === null) return c.na('no JSON-LD script is rendered');

  const raw = scriptMatch[1] ?? '';
  if (/<\/script/i.test(raw)) {
    return c.fail(['the JSON-LD payload contains an unescaped </script> sequence'], 'Verify jsonLd() escaping ran on this payload — a raw </script> here closes the element early.');
  }
  const unescaped = raw.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&');
  try {
    JSON.parse(unescaped);
  } catch {
    return c.fail(['the JSON-LD payload does not parse as valid JSON once unescaped'], 'Investigate what corrupted the structured-data payload during rendering.');
  }
  return c.pass(['JSON-LD payload parses as valid JSON and contains no unescaped </script>']);
};

const databaseRules: CheckFn = (ctx) => {
  const c = check('security.database-rules', 'security', 'Database access rules', 'critical');
  const hasStatefulForm = /<form[^>]*method="post"/i.test(ctx.html);
  if (!hasStatefulForm) return c.na('no state-changing form exists; there is no database to have rules for');
  return c.blocked(['a POST form is rendered'], 'Define access rules before wiring any form to a database.');
};

const rateLimiting: CheckFn = (ctx) => {
  const c = check('security.rate-limiting', 'security', 'AI provider rate limiting (pipeline-level)', 'medium');
  const { maxRetries, retryBaseDelayMs, requestTimeoutMs } = ctx.config.ai;
  const evidence = [
    `maxRetries=${maxRetries}`,
    `retryBaseDelayMs=${retryBaseDelayMs}`,
    `requestTimeoutMs=${requestTimeoutMs}`,
    'note: this governs the generation pipeline\'s own AI-provider calls; the generated site makes no runtime API calls',
  ];
  if (maxRetries > 10 || requestTimeoutMs <= 0) {
    return c.warn(evidence, 'Bound AI_MAX_RETRIES and AI_REQUEST_TIMEOUT_MS to sane values so a stuck provider cannot retry unboundedly.');
  }
  return c.pass(evidence);
};

const spendCaps: CheckFn = (ctx) => {
  const c = check('security.spend-caps', 'security', 'AI provider spend caps (pipeline-level)', 'medium');
  const { analyst, writer } = ctx.config;
  const evidence = [
    `analyst.maxOutputTokens=${analyst.maxOutputTokens}`,
    `writer.maxOutputTokens=${writer.maxOutputTokens}`,
    'note: this bounds token spend on the generation pipeline itself, not the static site it produces',
  ];
  if (analyst.maxOutputTokens <= 0 || writer.maxOutputTokens <= 0) {
    return c.fail(evidence, 'Set a finite maxOutputTokens for both the analyst and the writer.');
  }
  return c.pass(evidence);
};

const secureFileUploads: CheckFn = (ctx) => {
  const c = check('security.secure-file-uploads', 'security', 'Secure file uploads', 'critical');
  if (!/<input[^>]*type="file"/i.test(ctx.html)) return c.na('no file upload control is rendered');
  return c.blocked(['a file input is rendered'], 'Do not accept uploads until server-side type/size validation and storage isolation exist.');
};

const csrf: CheckFn = (ctx) => {
  const c = check('security.csrf', 'security', 'CSRF protection', 'critical');
  const stateChanging = /<form[^>]*method="post"/i.test(ctx.html);
  if (!stateChanging) return c.na('no state-changing (POST) form is rendered');
  return c.blocked(['a POST form is rendered with no server to issue or verify a CSRF token'], 'Add CSRF protection when the form is wired to a real endpoint.');
};

const cors: CheckFn = (ctx) => {
  const c = check('security.cors', 'security', 'CORS policy', 'high');
  const crossOriginCall = /\bfetch\(|\bXMLHttpRequest\b/i.test(ctx.html);
  if (!crossOriginCall) return c.na('the rendered page makes no client-side API calls for a CORS policy to govern');
  return c.blocked(['client-side network calls are present in the rendered output'], 'Define a CORS policy on whatever endpoint the page now calls.');
};

const https: CheckFn = (ctx) => {
  const c = check('security.https', 'security', 'HTTPS enforced', 'critical');
  return c.blocked(
    ['deployment stage is not yet implemented for this run (lovableAgent is unimplemented); no host is chosen'],
    'Once a host is chosen, verify it serves the site over HTTPS and redirects HTTP to HTTPS.',
  );
};

const securityHeaders: CheckFn = (ctx) => {
  const c = check('security.security-headers', 'security', 'Security headers (CSP, X-Frame-Options, etc.)', 'high');
  return c.blocked(
    ['security headers are set by the hosting layer; no deployment target is chosen for this run'],
    'Configure Content-Security-Policy, X-Frame-Options, X-Content-Type-Options and Referrer-Policy at the host once one is chosen.',
  );
};

const secureCookies: CheckFn = (ctx) => {
  const c = check('security.secure-cookies', 'security', 'Secure, HttpOnly, SameSite cookies', 'high');
  const setsCookies = /document\.cookie/i.test(ctx.html) || /googletagmanager|google-analytics|gtag\(/i.test(ctx.html);
  if (!setsCookies) {
    return c.na('the rendered page contains no script that sets a cookie and no analytics vendor known to');
  }
  return c.blocked(['cookie-setting analytics is present'], 'Once a host and analytics vendor are finalised, verify cookies are Secure, HttpOnly where possible, and SameSite.');
};

const LOCAL_PATH_PATTERN = /\/(home|Users)\/[a-zA-Z0-9_-]+\/|[A-Z]:\\\\/;
const DEBUG_MARKER_PATTERN = /\b(TODO|FIXME|XXX|console\.log|debugger)\b/;

const productionDebugConfig: CheckFn = (ctx) => {
  const c = check('security.production-debug-config', 'security', 'No debug artefacts in rendered output', 'high');
  const text = allRenderedText(ctx);
  const problems: string[] = [];
  const pathMatch = LOCAL_PATH_PATTERN.exec(text);
  if (pathMatch !== null) problems.push(`local filesystem path leaked into output: "${pathMatch[0]}"`);
  const debugMatch = DEBUG_MARKER_PATTERN.exec(text);
  if (debugMatch !== null) problems.push(`debug marker in output: "${debugMatch[0]}"`);
  if (/sourceMappingURL/.test(text)) problems.push('a source map comment is present in the rendered output');

  if (problems.length > 0) {
    return c.fail(problems, 'Strip debug artefacts and local paths from the content spec before rendering for production.');
  }
  return c.pass(['no local filesystem paths, debug markers, or source-map comments in the rendered output']);
};

const productionSettings: CheckFn = (ctx) => {
  const c = check('security.production-settings', 'security', 'Non-debug pipeline log level', 'low');
  if (ctx.config.logLevel === 'debug') {
    return c.warn([`LOG_LEVEL is "debug" for this run`], 'Set LOG_LEVEL to "info" or quieter for a production generation run; debug logging is verbose and may capture more than intended.');
  }
  return c.pass([`LOG_LEVEL is "${ctx.config.logLevel}"`]);
};

export const securityChecks: readonly CheckFn[] = [
  noEmbeddedSecrets,
  envVarsIsolated,
  noSecretsInGit,
  authentication,
  authorization,
  userPermissions,
  inputValidation,
  xssProtection,
  injectionRisks,
  databaseRules,
  rateLimiting,
  spendCaps,
  secureFileUploads,
  csrf,
  cors,
  https,
  securityHeaders,
  secureCookies,
  productionDebugConfig,
  productionSettings,
];
