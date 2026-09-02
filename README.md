# op-mcp — OpenCode control MCP for Hermes

An MCP stdio server that lets Hermes control OpenCode through OpenCode's documented headless HTTP/OpenAPI server.

## Status

**IMPLEMENTED / NOT YET VERIFIED**

The implementation has been hardened against the current OpenCode server documentation. `VERIFIED` is deliberately not claimed because a real Hermes → MCP → OpenCode coding round trip cannot be executed from this repository environment.

## One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/arifhussainshahshah-gif/op-mcp/main/install.sh | bash
```

The installer clones/updates the repository, installs dependencies, builds the TypeScript server, and creates an executable wrapper at `$HOME/.local/bin/op-mcp`.

## Architecture

```text
Hermes
  │ MCP stdio
  ▼
op-mcp
  │ HTTP + optional Basic Auth
  ▼
OpenCode `opencode serve`
  │
  ▼
OpenCode sessions / agents / commands / shell / files / VCS / config / TUI / events
```

OpenCode officially documents `opencode serve` as a headless HTTP server exposing an OpenAPI 3.1 API. The running server publishes the canonical API description at `/doc`. citeturn2search0

## Run OpenCode

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

Optional password protection:

```bash
OPENCODE_SERVER_PASSWORD='<RUNTIME_PASSWORD>' opencode serve --hostname 127.0.0.1 --port 4096
```

OpenCode's documented default is localhost `127.0.0.1:4096`; Basic Auth uses `OPENCODE_SERVER_PASSWORD` and defaults the username to `opencode`. citeturn2search0

## Configure the MCP host

Launch command:

```text
$HOME/.local/bin/op-mcp
```

Environment:

```text
OPENCODE_URL=http://127.0.0.1:4096
OPENCODE_SERVER_USERNAME=opencode
OPENCODE_SERVER_PASSWORD=<RUNTIME_PASSWORD>
OPENCODE_REQUEST_TIMEOUT_MS=120000
```

Do not put a real password or provider credential in source control.

## Control surface

The MCP provides high-level operations for the documented OpenCode HTTP API: health, projects, paths/VCS, instance lifecycle, session lifecycle, prompts, messages, abort, shell, commands, permissions, files/search, status/diff, experimental tool discovery, LSP/formatter/MCP status, agents, configuration, providers, logging, TUI actions, auth, and bounded event snapshots. The low-level `opencode_request` tool covers documented HTTP endpoints without requiring a dedicated wrapper.

Current OpenCode documentation confirms the key session/message/shell/command request shapes, including the required `agent` field for shell and the session-scoped permission endpoint. citeturn0search0turn1search0

## Verification

Run the standalone OpenCode compatibility check:

```bash
bash verify-opencode.sh
```

It checks reachability of the configured OpenCode server, `/doc`, and key current API paths. It does **not** claim Hermes E2E verification.

For `VERIFIED`, a real machine must demonstrate:

1. OpenCode starts.
2. `op-mcp` starts as MCP stdio.
3. Hermes registers/connects to `op-mcp`.
4. Hermes invokes an MCP control tool.
5. OpenCode performs a real coding task.
6. The result returns through MCP to Hermes.
7. The resulting filesystem/git state is independently checked.
8. Evidence is recorded with commands, timestamps, project path, session ID, and result.

Until then the status remains **IMPLEMENTED**, not VERIFIED.

## Design principles

- No hardcoded credentials.
- No invented OpenCode API paths.
- OpenCode remains responsible for its own agent permissions and execution policy.
- Stable documented operations get high-level wrappers; the raw request tool covers documented HTTP operations without wrappers.
- WebSocket-only interactive PTY traffic is not falsely represented as an HTTP MCP operation.
- SSE is exposed as bounded snapshots rather than pretending to be a persistent MCP subscription.

## Files

- `src/index.ts` — MCP implementation
- `install.sh` — installer and executable wrapper
- `verify-opencode.sh` — standalone OpenCode API compatibility check
- `skill.md` — Hermes skill instructions
- `VERIFICATION.md` — evidence/status record
- `tsconfig.json` — TypeScript configuration
- `package.json` — package/build metadata
