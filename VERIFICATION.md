# Verification record

## Current status

`IMPLEMENTED`

## Step 1 — Research

- `[VERIFIED RESEARCH]` Official OpenCode documentation states `opencode serve` starts a headless HTTP server and exposes an OpenAPI endpoint.
- `[VERIFIED RESEARCH]` OpenCode server defaults to localhost and documents HTTP Basic Auth via `OPENCODE_SERVER_PASSWORD` / `OPENCODE_SERVER_USERNAME`.
- `[VERIFIED RESEARCH]` The documented API includes global health, projects, sessions, prompts, async prompts, messages, abort, commands, shell, permissions, questions, files, search, VCS, agents, skills, configuration, providers, MCP management, and TUI control.

## Step 2 — Interface decision

Chosen interface: **OpenCode headless HTTP/OpenAPI server**.

Reason: OpenCode documents this as the programmatic control interface used by its clients, and the server exposes its runtime OpenAPI description at `/doc`.

## Step 3 — MCP specification

The MCP exposes high-level wrappers for the core stable operations and `opencode_request` for documented HTTP operations without a dedicated wrapper.

## Step 4 — Implementation

Implemented in `src/index.ts` using the official MCP TypeScript server SDK package and stdio transport. Runtime configuration is environment-based; no secrets are stored in source.

## Step 5 — Standalone testing

`[UNKNOWN]` Not executed in this hosted development session because a runnable OpenCode installation and disposable workspace were not available here.

Required evidence:

1. Start `opencode serve`.
2. Call `opencode_health` and record the returned version.
3. Create a disposable session.
4. Send a real prompt that makes an observable workspace change.
5. Confirm the changed file/diff and returned assistant result.
6. Test a real abort/permission path where applicable.

## Step 6 — Skill file

`skill.md` is present and records the documented interface, actions, limitations, security requirements, and verification state.

## Step 7 — Hermes connection

`[UNKNOWN]` Hermes runtime registration has not been executed from this repository environment. The MCP is a standard stdio server and is intended to be registered using Hermes' normal MCP server configuration.

## Step 8 — End-to-end verification

`[UNKNOWN]` Not executed. Therefore the integration is **not VERIFIED**.

## Step 9 — Status

Current status: **IMPLEMENTED**.

Do not change this to `VERIFIED` until the real Hermes → op-mcp → OpenCode → real result → op-mcp → Hermes flow has been executed and the evidence is added here.
