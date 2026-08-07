/**
 * Development capabilities: source control, the local filesystem, and the four
 * kinds of automated check a generated site should pass before it ships.
 *
 * The testing skills all depend on `browser-automation` rather than each
 * carrying a driver: an accessibility audit and a performance trace are two
 * questions asked of one page load, and they should share the session.
 */

import { definePlaceholders } from '../placeholder.js';

import type { AnySkill } from '../types.js';

export const DEVELOPMENT_SKILLS: readonly AnySkill[] = definePlaceholders('development', [
  {
    id: 'github',
    name: 'GitHub',
    description:
      'Repositories, branches, commits, pull requests, issues and Actions runs through the GitHub API.',
    requiredCredentials: ['GITHUB_TOKEN'],
    blockedOn: 'needs the GitHub client and a scope policy for write operations',
  },
  {
    id: 'git',
    name: 'Git',
    description:
      'Local repository operations: status, diff, branch, commit, tag. No network, no remotes.',
    blockedOn: 'needs a git wrapper with a working-tree safety check',
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    description:
      'Sandboxed reads and writes beneath the run output directory. Refuses paths that escape it.',
    blockedOn: 'needs the path-confinement check before any write is exposed',
  },
  {
    id: 'api-testing',
    name: 'API testing',
    description:
      'Issues HTTP requests against a running service and asserts on status, headers, body shape and latency.',
    blockedOn: 'needs an assertion vocabulary and a result format',
  },
  {
    id: 'performance-testing',
    name: 'Performance testing',
    description:
      'Measures page load: Core Web Vitals, resource weight, render-blocking assets, time to interactive.',
    dependencies: ['browser-automation'],
    blockedOn: 'needs a metrics collector bound to the browser session',
  },
  {
    id: 'security-scanning',
    name: 'Security scanning',
    description:
      'Checks a deployed site for missing security headers, mixed content, exposed secrets and known-vulnerable dependencies.',
    dependencies: ['browser-automation'],
    blockedOn: 'needs a check catalogue and a severity model',
  },
  {
    id: 'accessibility-testing',
    name: 'Accessibility testing',
    description:
      'Audits a page against WCAG: contrast, landmarks, alt text, focus order, form labelling.',
    dependencies: ['browser-automation'],
    blockedOn: 'needs an axe-style rule engine wired to the browser session',
  },
]);
