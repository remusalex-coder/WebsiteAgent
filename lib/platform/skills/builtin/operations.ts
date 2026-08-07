/**
 * Operations capabilities: running what has been built, and knowing when it
 * stops working.
 *
 * `logging` overlaps with `lib/logger.ts` and does not replace it. The logger
 * is how this process records its own run; this skill is how a *generated site*
 * gets log shipping wired into it. Keeping them separate stops a deployment
 * concern leaking into the pipeline's own instrumentation.
 */

import { definePlaceholders } from '../placeholder.js';

import type { AnySkill } from '../types.js';

export const OPERATIONS_SKILLS: readonly AnySkill[] = definePlaceholders('operations', [
  {
    id: 'deployment',
    name: 'Deployment',
    description:
      'Ships a built site to a host, waits for it to go live, and returns the URL. Host-agnostic.',
    blockedOn: 'needs a host-adapter contract; stage 6 targets Lovable directly today',
  },
  {
    id: 'authentication',
    name: 'Authentication',
    description:
      'Provisions sign-in for a generated site: providers, sessions, password reset, roles.',
    blockedOn: 'needs an auth provider chosen and a session model',
  },
  {
    id: 'payments',
    name: 'Payments',
    description:
      'Checkout, subscriptions and webhooks for sites that sell — products, bookings or deposits.',
    requiredCredentials: ['PAYMENTS_API_KEY'],
    blockedOn: 'needs a payment provider chosen; handles no card data itself under any design',
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    description:
      'Uptime and error-rate checks on a deployed site, with alerting thresholds per business.',
    blockedOn: 'needs a monitoring backend and a check schedule',
  },
  {
    id: 'logging',
    name: 'Logging',
    description:
      'Ships a generated site’s application logs to an aggregator, with retention and redaction rules.',
    blockedOn: 'needs a log destination chosen and a redaction policy',
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description:
      'Delivers messages over SMS, push or chat when a run finishes, a deploy fails, or a form is submitted.',
    blockedOn: 'needs a transport chosen and a rate-limit policy',
  },
  {
    id: 'scheduling',
    name: 'Scheduling',
    description:
      'Runs work on a cron or at a future time: re-crawls, content refreshes, monitoring sweeps.',
    blockedOn: 'needs a scheduler and a durable job store; runs are one-shot today',
  },
]);
