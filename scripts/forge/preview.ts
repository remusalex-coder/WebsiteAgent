/**
 * Browser preview utility for opening generated sites in the default OS browser.
 * Kept under scripts/ so that lib/ remains process-free.
 */

import { exec } from 'node:child_process';
import path from 'node:path';

export function openInBrowser(filePath: string, logger?: { info: (...args: any[]) => void }): void {
  const fullPath = path.resolve(filePath);
  const fileUrl = `file:///${fullPath.replace(/\\/g, '/')}`;
  logger?.info('Opening browser preview window', { fileUrl });

  const cmd =
    process.platform === 'win32'
      ? `start "" "${fileUrl}"`
      : process.platform === 'darwin'
      ? `open "${fileUrl}"`
      : `xdg-open "${fileUrl}"`;

  exec(cmd, () => {
    // Non-blocking fire and forget
  });
}
