import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadConfig } from '../../lib/config.js';
import { securityChecks } from '../../lib/preflight/checks/security.js';
import { buildContext, section } from './support.js';

function run(id: string, overrides: Parameters<typeof buildContext>[0] = {}) {
  const ctx = buildContext(overrides);
  const result = securityChecks.map((check) => check(ctx)).find((r) => r.id === id);
  assert.ok(result, `no check registered with id "${id}"`);
  return result;
}

describe('security.no-embedded-secrets (required: secret exposure)', () => {
  it('passes on ordinary content', () => {
    assert.equal(run('security.no-embedded-secrets').status, 'PASS');
  });

  it('fails critically when a secret-shaped string is rendered into the page', () => {
    const result = run('security.no-embedded-secrets', {
      content: {
        sections: [section({ kind: 'about', heading: 'About', body: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789' })],
      },
    });
    assert.equal(result.status, 'FAIL');
    assert.equal(result.severity, 'critical');
  });
});

describe('security.env-vars-isolated (required: secret exposure)', () => {
  it('fails critically when a configured credential value leaks into the output', () => {
    const secret = 'sk-ant-configured-secret-value-1234567890';
    const baseAi = loadConfig({}).ai;
    const result = run('security.env-vars-isolated', {
      config: { ai: { ...baseAi, apiKeys: { anthropic: secret, openai: '', gemini: '', openrouter: '' } } },
      content: { sections: [section({ kind: 'about', heading: 'About', body: secret })] },
    });
    assert.equal(result.status, 'FAIL');
    assert.equal(result.severity, 'critical');
  });

  it('passes when nothing is configured to leak', () => {
    assert.equal(run('security.env-vars-isolated').status, 'PASS');
  });
});

describe('security.authentication / authorization / user-permissions', () => {
  it('is not applicable when the page references no protected functionality', () => {
    assert.equal(run('security.authentication').status, 'NOT_APPLICABLE');
    assert.equal(run('security.authorization').status, 'NOT_APPLICABLE');
    assert.equal(run('security.user-permissions').status, 'NOT_APPLICABLE');
  });
});

describe('security.database-rules / csrf / secure-file-uploads / cors / input-validation', () => {
  it('are not applicable on a static site with no form, upload or client-side API call', () => {
    for (const id of ['security.database-rules', 'security.csrf', 'security.secure-file-uploads', 'security.cors', 'security.input-validation']) {
      const result = run(id);
      assert.equal(result.status, 'NOT_APPLICABLE', id);
    }
  });
});

describe('security.xss-protection', () => {
  it('passes: the renderer escapes everything, including an attempted injection', () => {
    const result = run('security.xss-protection', {
      content: {
        sections: [section({ kind: 'about', heading: '<script>alert(1)</script>', body: '<img src=x onerror=alert(1)>' })],
      },
    });
    assert.equal(result.status, 'PASS');
  });
});

describe('security.injection-risks', () => {
  it('passes: the JSON-LD payload parses and carries no unescaped </script>', () => {
    assert.equal(run('security.injection-risks').status, 'PASS');
  });

  it('is not applicable when no structured data is rendered', () => {
    const result = run('security.injection-risks', { content: { structuredData: {} } });
    assert.equal(result.status, 'NOT_APPLICABLE');
  });
});

describe('security.rate-limiting / spend-caps (pipeline-level)', () => {
  it('pass with the default configuration', () => {
    assert.equal(run('security.rate-limiting').status, 'PASS');
    assert.equal(run('security.spend-caps').status, 'PASS');
  });
});

describe('security.https / security-headers / secure-cookies (required: critical production blockers, but never via BLOCKED)', () => {
  it('report BLOCKED, not FAIL, because no deployment target exists yet', () => {
    assert.equal(run('security.https').status, 'BLOCKED');
    assert.equal(run('security.security-headers').status, 'BLOCKED');
  });

  it('BLOCKED never contributes to the production gate', () => {
    const result = run('security.https');
    assert.equal(result.status, 'BLOCKED');
    // A BLOCKED result is never a FAIL, which is the only status the gate acts on.
    assert.notEqual(result.status, 'FAIL');
  });

  it('secure-cookies is not applicable with no cookie-setting mechanism present', () => {
    assert.equal(run('security.secure-cookies').status, 'NOT_APPLICABLE');
  });
});

describe('security.production-debug-config', () => {
  it('passes on ordinary content', () => {
    assert.equal(run('security.production-debug-config').status, 'PASS');
  });

  it('fails when a debug marker leaks into the rendered copy', () => {
    const result = run('security.production-debug-config', {
      content: { sections: [section({ kind: 'about', heading: 'About', body: 'TODO: replace this placeholder body.' })] },
    });
    assert.equal(result.status, 'FAIL');
  });
});

describe('security.production-settings', () => {
  it('warns when LOG_LEVEL is "debug"', () => {
    const result = run('security.production-settings', { config: { logLevel: 'debug' } });
    assert.equal(result.status, 'WARN');
  });

  it('passes otherwise', () => {
    assert.equal(run('security.production-settings').status, 'PASS');
  });
});
