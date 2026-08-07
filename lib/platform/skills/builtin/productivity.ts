/**
 * Productivity capabilities: the two systems a business actually runs on.
 *
 * Both are read-and-write, and both write outward. Their implementations will
 * need an explicit confirmation step before anything leaves the process —
 * sending mail and creating invites are visible to third parties in a way that
 * nothing else in this platform is.
 */

import { definePlaceholders } from '../placeholder.js';

import type { AnySkill } from '../types.js';

export const PRODUCTIVITY_SKILLS: readonly AnySkill[] = definePlaceholders('productivity', [
  {
    id: 'email',
    name: 'Email',
    description:
      'Reads mailboxes and sends messages — run reports, enquiry forwarding, launch notices.',
    requiredCredentials: ['EMAIL_API_KEY'],
    blockedOn: 'needs a transport chosen and a send-confirmation gate',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description:
      'Reads availability and creates events, for sites that take bookings or appointments.',
    requiredCredentials: ['CALENDAR_API_KEY'],
    blockedOn: 'needs a calendar provider chosen and a timezone model',
  },
]);
