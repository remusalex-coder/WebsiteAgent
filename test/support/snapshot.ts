/**
 * File-backed snapshots.
 *
 * Node's own `assert.snapshot` is still experimental and its flag has moved
 * between releases; this is twenty lines and does the one thing needed —
 * compare a rendered artifact against a file a reviewer can read in a diff.
 *
 * Regenerate with `UPDATE_SNAPSHOTS=1 npm test`, and read the diff before
 * committing it: a snapshot that changes without an intended template change is
 * the failure this suite exists to catch.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SNAPSHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '__snapshots__');

const updating = process.env.UPDATE_SNAPSHOTS === '1';

export function assertMatchesSnapshot(name: string, actual: string): void {
  const file = path.join(SNAPSHOT_DIR, name);

  if (updating || !fs.existsSync(file)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(file, actual, 'utf8');
    return;
  }

  // Snapshots are committed with LF; a checkout with autocrlf would otherwise
  // fail every one of them on Windows for a reason that has nothing to do with
  // the renderer.
  const expected = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(actual.replace(/\r\n/g, '\n'), expected, `snapshot ${name} changed`);
}
