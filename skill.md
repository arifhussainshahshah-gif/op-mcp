---
name: opencode-control-mcp
description: Controls OpenCode through its documented headless HTTP/OpenAPI server.
status: IMPLEMENTED
---

# OpenCode Control MCP

## Purpose

This MCP gives an MCP host such as Hermes programmatic control of an OpenCode instance. Hermes connects to this MCP over stdio; the MCP calls OpenCode's documented HTTP server.

## Source of truth

The authoritative OpenCode control surface is the running server's OpenAPI 3.1 document at `GET /doc`. OpenCode's current server documentation confirms `opencode serve`, localhost defaults, Basic Auth, session/message/shell/command APIs, file search/read/status, experimental tool discovery, LSP/formatter/MCP status, agents, logging, TUI control, auth, and SSE events.

## Verification labels

- [VERIFIED RESEARCH] OpenCode documents `opencode serve` as a headless HTTP server exposing OpenAPI 3.1.
- [VERIFIED RESEARCH] Default server bind is `127.0.0.1:4096` and Basic Auth uses `OPENCODE_SERVER_PASSWORD`, with username defaulting to `opencode`.
- [VERIFIED RESEARCH] Current OpenCode session shell requests require `{ agent, model?, command }`.
- [VERIFIED RESEARCH] Current OpenCode permission responses use `POST /session/:id/permissions/:permissionID` with `{ response, remember? }`.
- [VERIFIED RESEARCH] Current file search uses `/find?pattern=`, while file-name search uses `/find/file?query=`.
- [VERIFIED RESEARCH] Current session diff uses `/session/:id/diff?messageID?`.
- [UNKNOWN] Hermes-specific installation/discovery depends on the Hermes installation/configuration available on the user's machine.
- [UNKNOWN] A real Hermes -> MCP -> OpenCode -> real result round trip has not been executed in this repository environment.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/arifhussainshahshah-gif/op-mcp/main/install.sh | bash
```

The installer builds the MCP and installs an executable wrapper at `$HOME/.local/bin/op-mcp`.

## Start OpenCode

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

Optional authentication:

```bash
OPENCODE_SERVER_PASSWORD='<RUNTIME_PASSWORD>' opencode serve --hostname 127.0.0.1 --port 4096
```

Keep OpenCode on loopback unless remote access is intentional. If exposed beyond loopback, enable authentication.

## MCP environment

- `OPENCODE_URL`: OpenCode base URL. Default `http://127.0.0.1:4096`.
- `OPENCODE_SERVER_USERNAME`: Basic-auth username. Default `opencode`.
- `OPENCODE_SERVER_PASSWORD`: Basic-auth password. Never commit a real value.
- `OPENCODE_REQUEST_TIMEOUT_MS`: HTTP request timeout. Default `120000`.

## Exposed control surface

### Core control

- `opencode_health`
- `opencode_request` — low-level documented HTTP escape hatch
- project/path/VCS discovery
- session create/list/get/update/delete/status/children/todo/init/fork/abort/share/unshare/diff/summarize/revert/unrevert
- synchronous and asynchronous prompts
- message listing and retrieval
- shell and slash-command execution
- permission inspection and response

### Workspace and capabilities

- file listing and file content
- text, file-name, and symbol search
- tracked-file status
- agents, skills, slash commands
- configuration read/patch
- provider discovery/auth methods
- OpenCode MCP status and dynamic MCP add
- experimental tool IDs and model-specific schemas
- LSP and formatter status
- OpenCode logging

### UI/event control

- documented `/tui/*` actions through `opencode_tui`
- bounded SSE event snapshots through `opencode_event_snapshot`
- provider credential write through `opencode_auth_set` using runtime-supplied values

## Important implementation mapping

The implementation follows the current OpenCode server documentation, including:

- `/session/:id/shell` -> requires `agent`; optional `model`.
- `/session/:id/command` -> supports `messageID?`, `agent?`, `model?`, `command`, `arguments`.
- `/session/:id/permissions/:permissionID` -> `{ response, remember? }`.
- `/session/:id/diff` -> optional `messageID` query.
- `/find?pattern=` -> content search.
- `/find/file?query=` -> file/directory-name search.
- `/find/symbol?query=` -> workspace symbol search.

The low-level `opencode_request` tool exists so Hermes can use a documented HTTP operation that does not yet have a dedicated wrapper. It should only be used with endpoints documented by the connected OpenCode `/doc` spec.

## Permissions

OpenCode remains the authority for execution permissions. Its documented permission outcomes are `allow`, `ask`, and `deny`; `--auto` auto-approves requests that are not explicitly denied. This MCP does not bypass OpenCode's policy layer.

## Limitations

1. OpenCode's interactive PTY is WebSocket-based; this MCP does not tunnel arbitrary WebSocket traffic.
2. SSE is exposed as bounded snapshots rather than a persistent MCP subscription. Hermes can poll messages/status or call the event snapshot repeatedly.
3. Experimental OpenCode endpoints are exposed only where the documented HTTP API supports them; they are not claimed to be stable.
4. OpenCode may change its API. The running `/doc` document is the final compatibility check.

## Verification procedure

Run:

```bash
bash verify-opencode.sh
```

That checks that the configured OpenCode server is reachable, `/doc` is available, and key current API paths exist. It does not constitute Hermes E2E verification.

For `VERIFIED`, all of the following must be demonstrated on a real machine:

1. OpenCode server starts.
2. `op-mcp` starts as an MCP stdio server.
3. Hermes successfully registers/connects to `op-mcp`.
4. Hermes invokes a control tool through MCP.
5. OpenCode creates/uses a session and performs a real coding task.
6. MCP returns the result to Hermes.
7. The resulting filesystem/git state is independently checked.
8. Evidence is recorded with commands, timestamps, project path, session ID, and result.

Until those steps are actually executed, repository status remains `IMPLEMENTED`, not `VERIFIED`.
