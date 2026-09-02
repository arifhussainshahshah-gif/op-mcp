# op-mcp — OpenCode control MCP for Hermes

An MCP stdio server that lets Hermes control OpenCode through OpenCode's documented headless HTTP/OpenAPI server.

## Status

**IMPLEMENTED / NOT YET VERIFIED**

The implementation and installer are committed. `VERIFIED` is deliberately not claimed because the complete real Hermes → MCP → OpenCode round trip has not been executed in this environment.

## One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/arifhussainshahshah-gif/op-mcp/main/install.sh | bash
```

The installer clones/updates the repository under `$HOME/.local/share/op-mcp`, installs dependencies, builds the TypeScript server, and creates `$HOME/.local/bin/op-mcp`.

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
OpenCode agent/session/tools/files/VCS/etc.
```

OpenCode officially documents `opencode serve` as a headless HTTP server exposing an OpenAPI 3.1 API. The runtime OpenAPI description is available at `/doc`.

## Run OpenCode

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

Optional password protection:

```bash
OPENCODE_SERVER_PASSWORD='<RUNTIME_PASSWORD>' opencode serve --hostname 127.0.0.1 --port 4096
```

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
```

Do not put a real password in source control.

## Control surface

The MCP includes high-level operations for health, projects, session lifecycle, synchronous/asynchronous prompts, messages, abort, commands, shell, permissions, questions, files, search, VCS status/diff, agents, skills, commands, configuration, providers, OpenCode MCP status, and path information.

It also provides `opencode_request` as a documented-API escape hatch so Hermes can reach an OpenCode HTTP operation that has not yet received a dedicated wrapper.

## Verification procedure

1. Install this MCP.
2. Start OpenCode on localhost.
3. Start `op-mcp` directly and confirm MCP initialization.
4. Call `opencode_health`.
5. Create a session for a disposable test project.
6. Send a real coding prompt.
7. Read resulting messages and confirm the underlying change occurred.
8. Exercise abort/permissions as applicable.
9. Register the MCP in Hermes.
10. Run the same coding task through Hermes and verify the complete round trip.
11. Record exact commands, project, session ID, result, and evidence before changing status to `VERIFIED`.

## Design principles

- No hardcoded credentials.
- No invented OpenCode API.
- OpenCode remains responsible for its agent permissions and execution policy.
- Stable documented operations get high-level wrappers; the raw request tool covers documented API surface that is not yet wrapped.
- Experimental/WebSocket-only capabilities are not falsely represented as fully verified MCP tools.

## Files

- `src/index.ts` — MCP implementation
- `install.sh` — one-line installer
- `skill.md` — Hermes skill documentation
- `tsconfig.json` — TypeScript configuration
- `package.json` — package/build metadata
