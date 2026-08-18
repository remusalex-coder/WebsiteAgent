/**
 * The roster is checked against two things the compiler cannot enforce: that
 * an `implemented` seat's module actually exists on disk, and that the
 * pairing declared in `crossVendorWith` points at a real seat.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AGENT_SEATS, seat } from '../../lib/capability/agents.js';
import { isCapabilityId } from '../../lib/capability/types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('every implemented seat names a module that exists on disk', () => {
  for (const entry of AGENT_SEATS) {
    if (entry.status !== 'implemented' && entry.status !== 'deterministic') continue;
    assert.notEqual(entry.module, null, `${entry.id} is ${entry.status} but names no module`);
    const abs = path.join(ROOT, entry.module ?? '');
    assert.ok(fs.existsSync(abs), `${entry.id} names ${entry.module}, which does not exist`);
  }
});

test('a planned seat names no module, so the roster cannot lie about what exists', () => {
  for (const entry of AGENT_SEATS) {
    if (entry.status !== 'planned') continue;
    assert.equal(entry.module, null, `${entry.id} is planned but names a module`);
  }
});

test('every seat consumes a real capability', () => {
  for (const entry of AGENT_SEATS) {
    assert.equal(isCapabilityId(entry.capability), true, `${entry.id} names an unknown capability`);
  }
});

test('every crossVendorWith reference points at a seat that exists', () => {
  for (const entry of AGENT_SEATS) {
    if (entry.crossVendorWith === null) continue;
    assert.notEqual(seat(entry.crossVendorWith), null, `${entry.id} points at unknown seat ${entry.crossVendorWith}`);
  }
});

test('a cross-vendor pairing is symmetric', () => {
  for (const entry of AGENT_SEATS) {
    if (entry.crossVendorWith === null) continue;
    const partner = seat(entry.crossVendorWith);
    assert.equal(partner?.crossVendorWith, entry.id, `${entry.id} <-> ${entry.crossVendorWith} is not a mutual pairing`);
  }
});

test('k > 1 seats state which of the three justified reasons applies', () => {
  const reasons = /comparative|gating|corroborative|battle|jury/i;
  for (const entry of AGENT_SEATS) {
    if (entry.k <= 1) continue;
    assert.match(
      entry.kRationale,
      reasons,
      `${entry.id} runs k=${entry.k} but its rationale does not cite battle/jury/corroboration`,
    );
  }
});
