# Verification record

## Current status

`IMPLEMENTED`

## Research confirmed

- `[VERIFIED]` Official OpenCode server documentation confirms `opencode serve` as the headless HTTP/OpenAPI interface.
- `[VERIFIED]` Default bind is `127.0.0.1:4096`; Basic Auth is controlled by `OPENCODE_SERVER_PASSWORD` with username default `opencode`.
- `[VERIFIED]` Current session/message/shell/command request shapes were checked against the current server documentation.
- `[VERIFIED]` Current permission response path is `/session/:id/permissions/:permissionID` with `{ response, remember? }`.
- `[VERIFIED]` Current text search uses `/find?pattern=`, file-name search uses `/find/file?query=`, and session diff uses `/session/:id/diff?messageID?`.
- `[VERIFIED]` Current TUI, SSE, experimental-tool, config/provider, MCP, agent, logging, and auth endpoints are documented by OpenCode.

## Interface decision

Chosen interface: **OpenCode headless HTTP/OpenAPI server**.

Reason: OpenCode explicitly documents it as the programmatic interface used by clients and publishes the runtime OpenAPI description at `/doc`. citeturn2search0

## Implementation

`src/index.ts` implements an MCP stdio server using the official MCP TypeScript server package. It forwards requests to OpenCode with optional Basic Auth and runtime-configurable URL/timeouts. No real credentials are stored in source.

The implementation was corrected to match the current documented shell, command, permission, file-search, and session-diff routes.

## Installer

`install.sh` creates a real executable wrapper that invokes Node explicitly, avoiding reliance on a JavaScript shebang or executable bit in the compiled artifact.

## Standalone verification

`verify-opencode.sh` was added. It checks:

1. OpenCode health endpoint is reachable.
2. `/doc` is reachable.
3. Current key session message, shell, and permission routes are present in the server's OpenAPI document.

This is a repository-level verification aid. It cannot be executed against a real OpenCode process from this hosted environment.

## Hermes connection

`[UNKNOWN]` A real Hermes runtime registration/connection has not been executed here. The MCP uses standard stdio transport, and the repository contains the Hermes-oriented `skill.md`.

## End-to-end verification

`[UNKNOWN]` A real Hermes → op-mcp → OpenCode → real filesystem change → MCP → Hermes round trip has not been executed in this environment.

Therefore the integration is **not VERIFIED**.

## Final status

`IMPLEMENTED`

`TESTING` begins when the user runs `bash verify-opencode.sh` against a live OpenCode server and then performs the Hermes E2E procedure.

`VERIFIED` is allowed only after real E2E evidence is recorded. No `VERIFIED` claim is made by this repository at this time.
