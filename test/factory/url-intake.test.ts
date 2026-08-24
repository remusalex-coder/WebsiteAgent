/**
 * Test: Real Business URL Intake & Propagation
 *
 * Verifies that businessUrl, sourceUrls, and additionalInstruction are accepted
 * at intake and propagated through brief, research, synthesis, and job records.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fallbackBrief } from '../../lib/factory/brief.js';
import { synthesizeResearch } from '../../lib/factory/synthesize.js';
import { buildFactoryWorkflow } from '../../scripts/n8n/build-factory-workflow.js';
import type { FactoryBrief } from '../../lib/factory/brief.js';
import type { ResearchNote } from '../../lib/factory/research.js';

test('fallbackBrief preserves businessUrl, sourceUrls, and additionalInstruction', () => {
  const brief = fallbackBrief('Brutarie Sibiu', {
    businessUrl: 'https://maps.google.com/?cid=123456789',
    sourceUrls: ['https://instagram.com/brutariamara_sibiu'],
    additionalInstruction: 'Highlight traditional stone-baked sourdough',
  });

  assert.equal(brief.businessUrl, 'https://maps.google.com/?cid=123456789');
  assert.deepEqual(brief.sourceUrls, ['https://instagram.com/brutariamara_sibiu']);
  assert.equal(brief.additionalInstruction, 'Highlight traditional stone-baked sourdough');
  assert.equal(brief.searchQuery, 'https://maps.google.com/?cid=123456789');
});

test('synthesizeResearch propagates businessUrl and sourceUrls into synthesis artifact', () => {
  const brief: FactoryBrief = {
    order: 'Brutarie Sibiu',
    businessType: 'artisan bakery',
    city: 'Sibiu',
    country: 'Romania',
    language: 'ro',
    searchQuery: 'brutarie artizanala sibiu',
    qualityBar: 'premium',
    businessUrl: 'https://maps.google.com/?cid=123456789',
    sourceUrls: ['https://instagram.com/brutariamara_sibiu'],
    additionalInstruction: 'Highlight stone-baked sourdough',
    authoredBy: null,
    createdAt: new Date().toISOString(),
  };

  const dummyNote: ResearchNote = {
    role: 'research',
    positioning: 'High quality artisan bakery',
    audience: 'Local sourdough enthusiasts',
    differentiators: ['Natural fermentation', 'Organic local wheat'],
    siteMustDo: ['Daily bread menu', 'Opening hours'],
    searchQueries: ['brutarie artizanala sibiu'],
    risks: ['Generic bakery styling'],
    authoredBy: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      requestId: null,
      at: new Date().toISOString(),
    },
  };

  const synthesis = synthesizeResearch(brief, [dummyNote]);

  assert.equal(synthesis.businessUrl, 'https://maps.google.com/?cid=123456789');
  assert.deepEqual(synthesis.sourceUrls, ['https://instagram.com/brutariamara_sibiu']);
  assert.equal(synthesis.additionalInstruction, 'Highlight stone-baked sourdough');
  assert.equal(synthesis.searchQuery, 'brutarie artizanala sibiu');
});

test('n8n workflow contains official businessUrl, sourceUrls, and additionalInstruction in Job Intake', () => {
  const workflow = buildFactoryWorkflow();
  assert.equal(workflow.nodes.length, 41, 'factory workflow retains all 41 nodes');

  const intakeNode = workflow.nodes.find((n) => n.name === 'Job Intake');
  assert.ok(intakeNode, 'Job Intake node exists');

  const assignments = (intakeNode.parameters as { assignments?: { assignments?: Array<{ name: string; value: string }> } })
    ?.assignments?.assignments ?? [];

  const assignmentNames = assignments.map((a) => a.name);
  assert.ok(assignmentNames.includes('businessUrl'), 'Job Intake has businessUrl assignment');
  assert.ok(assignmentNames.includes('sourceUrls'), 'Job Intake has sourceUrls assignment');
  assert.ok(assignmentNames.includes('additionalInstruction'), 'Job Intake has additionalInstruction assignment');
  assert.ok(assignmentNames.includes('order'), 'Job Intake retains order for backward compatibility');

  const normalizeNode = workflow.nodes.find((n) => n.name === 'Normalize Brief');
  assert.ok(normalizeNode, 'Normalize Brief node exists');

  const queryParams = (normalizeNode.parameters as { queryParameters?: { parameters?: Array<{ name: string; value: string }> } })
    ?.queryParameters?.parameters ?? [];

  const paramNames = queryParams.map((p) => p.name);
  assert.ok(paramNames.includes('businessUrl'), 'Normalize Brief forwards businessUrl');
  assert.ok(paramNames.includes('sourceUrls'), 'Normalize Brief forwards sourceUrls');
  assert.ok(paramNames.includes('additionalInstruction'), 'Normalize Brief forwards additionalInstruction');
  assert.ok(paramNames.includes('order'), 'Normalize Brief forwards order');
});
