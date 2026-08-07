# MCP system

_Last updated: 2026-08-06._

An MCP server is a capability **someone else** implements, reached over a protocol and
discovered at runtime. Registering one takes no code:

```bash
MCP_SERVERS='[
  {
    "id": "github",
    "name": "GitHub",
    "transport": "http",
    "endpoint": "https://api.githubcopilot.com/mcp/",
    "headers": { "Authorization": "Bearer ghp_..." },
    "requiredCredentials": ["GITHUB_TOKEN"]
  }
]'
```

## Skill or MCP server?

| | Skill | MCP server |
|---|---|---|
| implemented by | this repository | a third party |
| declared | at build time | at runtime, by the server |
| input types | compile-time | a JSON Schema fetched from the server |
| added by | writing a file | editing configuration |

The consequence: MCP calls are `unknown` in and `unknown` out. **A caller that wants
types puts a skill in front of the server** — that is the intended pattern, and it
keeps the untyped boundary in one place.

## The contract

```ts
interface MCPConnector {
  metadata: MCPServerMetadata;
  capabilities(signal?): Promise<readonly MCPCapability[]>;
  health(signal?): Promise<HealthReport>;
  execute(call: MCPCall, signal?): Promise<unknown>;
  connect?(signal?): Promise<void>;
  disconnect?(): Promise<void>;
}
```

`connect`/`disconnect` are optional because an HTTP server needs no session and a
stdio one does. The manager calls them when present.

## Using it

```ts
const github = ctx.platform.mcp.get('github');

const tools = await github.capabilities();
if (!tools.ok) return;

const result = await github.execute({
  capability: 'search_repositories',
  arguments: { query: 'org:acme topic:website' },
});
if (!result.ok) ctx.logger.warn('mcp failed', { code: result.error.code });
```

Same shape as a skill handle, deliberately — an agent should not hold two mental
models for "a capability I can call that might not be there".

## What the manager adds

Everything a skill gets — enable/disable policy, credential checks, telemetry,
structured errors, a status row — plus two things skills do not need:

**Capability caching.** `tools/list` is a network round trip and a capability set does
not change mid-run, so it is fetched once per server.

**Capability search.** With several servers registered, "who can do X?" is a real
question:

```ts
const providers = await ctx.platform.mcp.find('search_repositories');
```

Answering it by hand would mean a caller hard-coding which server owns which tool —
exactly the coupling this layer exists to prevent.

## Transports

**`http` — implemented.** JSON-RPC 2.0 over Streamable HTTP. Handles both response
forms (plain JSON and SSE), honours `mcp-session-id`, re-initializes when the server
drops a session (404), and treats a `method not found` on `resources/list` or
`prompts/list` as "this server offers none" rather than a failure.

**`stdio` — declared, not implemented.** A stdio server is a child process the
platform owns: spawned, framed, kept alive across calls, drained on both pipes, reaped
on shutdown. Getting any of that wrong leaks processes rather than failing cleanly.
That is a real piece of work and it was not this refactor's, so it is registered
honestly instead of half-built: it appears on the status board as `unavailable` with a
reason, and calls return `not_implemented`.

> **The HTTP connector has never run against a live MCP server.** It follows the
> specification and is exercised by the typecheck, but the first real integration is
> the test.

## Configuration

| Field | Required | Notes |
|---|---|---|
| `id` | yes | unique; used in `MCP_ENABLED` / `MCP_DISABLED` and in logs |
| `transport` | no | `http` (default) or `stdio` |
| `endpoint` | for `http` | load fails without it |
| `command`, `args` | for `stdio` | load fails without `command` |
| `headers` | no | sent on every HTTP request; where a bearer token goes |
| `requiredCredentials` | no | checked before any call; names the missing variable |

```bash
MCP_ENABLED=github            # allow-list; empty means "all"
MCP_DISABLED=demo             # deny-list, applied last
MCP_REQUEST_TIMEOUT_MS=60000
```

A malformed entry fails the whole config load rather than being skipped — a typo in a
server id would otherwise surface much later as "no MCP server is registered as …",
which is a far worse error to debug.

Servers are registered **without being contacted**, so a run with no connectivity
still starts and fails at the point it actually needs something.

## Runtime control

```ts
ctx.platform.mcp.setEnabled('github', false);
```

Overrides configuration for the rest of the run.
