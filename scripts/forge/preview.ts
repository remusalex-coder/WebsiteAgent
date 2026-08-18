/**
 * Browser preview launcher — a script-layer capability, deliberately.
 *
 * This used to live at `lib/forge/preview.ts`, which broke the invariant
 * `test/qa/no-agent-spawn.test.ts` asserts: **no module under `lib/` spawns a
 * process**. That rule is not about this function — opening a file:// URL is
 * harmless — it is about the import graph. A `child_process` import anywhere
 * under `lib/` is reachable from every stage, and the fence has to hold at the
 * directory boundary or it does not hold at all.
 *
 * So the library returns a path and the script opens it. `runExperienceForge`
 * hands back `indexPath`; whoever ran it from a terminal decides whether a
 * window appears.
 */

import { exec } from 'node:child_process';
import os from 'node:os';

import type { Logger } from '../../lib/logger.js';

/** Opens a local file in the operating system's default browser. */
export function openInBrowser(filePath: string, logger?: Logger): void {
  const platform = os.platform();
  const normalizedPath = filePath.replace(/\\/g, '/');
  const targetUrl = `file:///${normalizedPath.replace(/^\/+/, '')}`;

  logger?.info('launching browser preview', { targetUrl });

  const command =
    platform === 'win32'
      ? `start "" "${targetUrl}"`
      : platform === 'darwin'
        ? `open "${targetUrl}"`
        : `xdg-open "${targetUrl}"`;

  exec(command, (error) => {
    if (error) {
      logger?.warn('failed to open browser preview', { error: error.message });
      return;
    }
    logger?.info('browser preview opened');
  });
}
