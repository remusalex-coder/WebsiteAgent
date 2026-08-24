/**
 * Netlify "Drop" deploy — the real stage-6 target that replaced the Lovable
 * stub.
 *
 * The rendered `RenderedFile[]` is zipped and uploaded verbatim through
 * Netlify's Deploy API, so what ships is exactly what `renderSite` produced —
 * no second rendering system, no JSX prompt round-trip. The deploy agent
 * (`agents/lovableAgent.ts`) is the only caller and the only place Netlify is
 * known; swapping the host means changing this file and nothing else.
 *
 * The token is the switch: an empty `NETLIFY_DEPLOY_TOKEN` means deploy is
 * skipped, returning `status: 'skipped'` (never `failed`) — the same
 * discipline `PlacesConfig` uses. A missing/absent key must not turn a working
 * site into a "broken" run.
 */

import { mkdtemp, writeFile, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

import type { AppConfig } from '../config.js';
import type { DeploymentResult } from '../types.js';

const NETLIFY_API = 'https://api.netlify.com/api/v1';

interface NetlifySite {
  readonly id: string;
  readonly url: string;
  readonly deploy_url: string;
}

interface NetlifyDeploy {
  readonly id: string;
  readonly state: string;
  readonly deploy_ssl_url?: string;
  readonly ssl_url?: string;
}

/* ------------------------------------------------------------------ */
/* Pure-Node ZIP writer (store method, no external `zip` binary)         */
/* ------------------------------------------------------------------ */

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(buf: Buffer, table: Uint32Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i] ?? 0;
    const entry = table[(c ^ byte) & 0xff] ?? 0;
    c = entry ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Zips a directory's *contents* (not the directory itself) into `outZip` so
 * Netlify serves `index.html` at the root, not under a subpath — the same
 * "select the files inside the folder, not the folder" rule the CloudCode
 * tutorial follows. Store method (method 0) keeps it dependency-free.
 */
async function zipContents(dir: string, outZip: string): Promise<void> {
  const entries: { rel: string; data: Buffer }[] = [];
  const walk = async (cur: string, prefix: string): Promise<void> => {
    const items = await readdir(cur, { withFileTypes: true });
    for (const item of items) {
      const abs = path.join(cur, item.name);
      const rel = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isDirectory()) await walk(abs, rel);
      else if (item.isFile()) entries.push({ rel, data: await readFile(abs) });
    }
  };
  await walk(dir, '');

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const crcTable = makeCrcTable();

  for (const { rel, data } of entries) {
    const nameBuf = Buffer.from(rel, 'utf8');
    const crc = crc32(data, crcTable);
    const method = 0; // store — no inflation needed on the other end
    const body = data;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const localBuf = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(localBuf.length, 16);
  end.writeUInt16LE(0, 20);

  await writeFile(outZip, Buffer.concat([localBuf, centralBuf, end]));
}

/* ------------------------------------------------------------------ */
/* Netlify API calls                                                   */
/* ------------------------------------------------------------------ */

async function uploadDeploy(siteId: string, zipPath: string, token: string, timeoutMs: number, signal: AbortSignal): Promise<NetlifyDeploy> {
  const res = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/zip' },
    body: await readFile(zipPath),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Netlify deploy ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as NetlifyDeploy;
}

async function createSite(token: string, _timeoutMs: number, signal: AbortSignal): Promise<NetlifySite> {
  const res = await fetch(`${NETLIFY_API}/sites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Netlify site create ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as NetlifySite;
}

async function pollDeploy(siteId: string, deployId: string, token: string, timeoutMs: number, signal: AbortSignal): Promise<NetlifyDeploy> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys/${deployId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!res.ok) throw new Error(`Netlify poll ${res.status} ${res.statusText}`);
    const deploy = (await res.json()) as NetlifyDeploy;
    if (deploy.state === 'ready' || deploy.state === 'uploaded') return deploy;
    if (deploy.state === 'error' || deploy.state === 'failed') {
      throw new Error(`Netlify deploy ${deployId} entered state ${deploy.state}`);
    }
    if (Date.now() > deadline) return deploy;
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

/**
 * Deploys the rendered `site/` directory to Netlify and returns a
 * `DeploymentResult`. `config.netlify.apiKey` empty → `skipped` (no throw).
 */
export async function deployToNetlify(
  siteDir: string,
  config: AppConfig,
  opts: { readonly signal: AbortSignal; readonly logger?: { info: (m: string) => void; warn: (m: string) => void } },
): Promise<DeploymentResult> {
  const log = opts.logger ?? { info: () => {}, warn: () => {} };
  const netlify = config.netlify;

  if (netlify.apiKey === '') {
    log.info('deploy skipped: NETLIFY_DEPLOY_TOKEN is not set');
    return {
      projectId: '',
      liveUrl: null,
      editorUrl: null,
      status: 'skipped',
      promptUsed: 'NETLIFY_DEPLOY_TOKEN is not set, so no deployment was attempted.',
      deployedAt: new Date().toISOString(),
    };
  }

  const tmp = await mkdtemp(path.join(tmpdir(), 'wa-deploy-'));
  const zipPath = path.join(tmp, 'site.zip');
  try {
    await zipContents(siteDir, zipPath);
    log.info('site zipped for deploy');

    const site: NetlifySite = netlify.siteId
      ? { id: netlify.siteId, url: '', deploy_url: '' }
      : await createSite(netlify.apiKey, netlify.deployTimeoutMs, opts.signal);

    const deploy = await uploadDeploy(site.id, zipPath, netlify.apiKey, netlify.deployTimeoutMs, opts.signal);
    const settled = await pollDeploy(site.id, deploy.id, netlify.apiKey, netlify.deployTimeoutMs, opts.signal);

    const liveUrl = settled.deploy_ssl_url ?? settled.ssl_url ?? (site.url || null);
    return {
      projectId: site.id,
      liveUrl,
      editorUrl: liveUrl,
      status: liveUrl !== null ? 'live' : 'building',
      promptUsed: `Netlify Drop deploy of ${siteDir} (site ${site.id}, deploy ${deploy.id})`,
      deployedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`deploy failed: ${message}`);
    return {
      projectId: netlify.siteId ?? '',
      liveUrl: null,
      editorUrl: null,
      status: 'failed',
      promptUsed: `Netlify deploy error: ${message}`,
      deployedAt: new Date().toISOString(),
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
