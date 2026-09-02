---
name: opencode-control-mcp
description: Controls OpenCode through its documented headless HTTP/OpenAPI server.
status: IMPLEMENTED
---

# OpenCode Control MCP

## Purpose

This MCP gives an MCP host (including Hermes) programmatic control of an OpenCode instance. The transport from Hermes to this MCP is MCP stdio; the MCP then calls OpenCode's documented HTTP server.

## Verification labels

- [VERIFIED RESEARCH] OpenCode documents `opencode serve` as a headless HTTP server exposing an OpenAPI 3.1 API.
- [VERIFIED RESEARCH] OpenCode documents localhost binding by default and HTTP Basic Auth using `OPENCODE_SERVER_PASSWORD` (username defaults to `opencode`).
- [VERIFIED RESEARCH] OpenCode documents session creation/list/get/delete, synchronous and asynchronous prompting, abort, commands, shell, permissions, questions, files, VCS, agents, skills, configuration, and MCP management endpoints.
- [UNKNOWN] Hermes-specific connection/discovery mechanics cannot be verified from the OpenCode sources alone; configure this MCP using the standard Hermes MCP registration mechanism available in the Hermes installation.
- [UNKNOWN] A real Hermes -> MCP -> OpenCode -> result round trip has not been executed in this repository environment.

## When to use

Use this MCP when Hermes needs OpenCode to perform or supervise coding/agent work in a real project. Prefer the high-level tools for common operations. Use `opencode_request` when an OpenCode API operation is documented but does not have a dedicated high-level wrapper.

Do not claim `VERIFIED` until a real end-to-end Hermes task has been executed.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/arifhussainshahshah-gif/op-mcp/main/install.sh | bash
```

The installer builds the MCP and installs `op-mcp` under `$HOME/.local/bin` by default.

## Start OpenCode

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

Optional authentication:

```bash
OPENCODE_SERVER_PASSWORD='<RUNTIME_PASSWORD>' opencode serve --hostname 127.0.0.1 --port 4096
```

For a non-loopback bind, authentication should be enabled.

## MCP environment

- `OPENCODE_URL`: OpenCode base URL. Default: `http://127.0.0.1:4096`.
- `OPENCODE_SERVER_USERNAME`: Basic-auth username. Default: `opencode`.
- `OPENCODE_SERVER_PASSWORD`: Basic-auth password. Never commit a real value.

## Exposed actions

- `opencode_health` — server health/version.
- `opencode_request` — documented OpenCode API escape hatch (GET/POST/PUT/PATCH/DELETE).
- `opencode_projects` — known projects.
- `opencode_sessions` — list sessions.
- `opencode_session_create/get/delete` — lifecycle management.
- `opencode_prompt` — synchronous prompt execution.
- `opencode_prompt_async` — asynchronous prompt submission.
- `opencode_messages` — read session messages and parts.
- `opencode_abort` — stop active processing.
- `opencode_shell` — run a shell command in session context, subject to OpenCode permissions.
- `opencode_command` — execute an OpenCode slash command.
- `opencode_permissions` / `opencode_permission_reply` — inspect and answer permission requests.
- `opencode_questions` — inspect pending questions.
- `opencode_files` / `opencode_read_file` / `opencode_find` — workspace inspection.
- `opencode_git_diff` / `opencode_status` / `opencode_vcs` — VCS inspection.
- `opencode_agents` / `opencode_skills` / `opencode_commands` — capability discovery.
- `opencode_config` / `opencode_providers` — configuration/provider discovery.
- `opencode_mcp_status` — inspect OpenCode's configured MCP servers.
- `opencode_path` — inspect OpenCode paths.

## Underlying API mapping

The MCP is a thin wrapper over OpenCode's documented server API. The canonical runtime API description is available from OpenCode at `GET /doc`.

Important documented mappings include:

- `/global/health` -> `opencode_health`
- `/project` -> `opencode_projects`
- `/session` -> session list/create
- `/session/:id` -> session get/update/delete
- `/session/:id/message` -> synchronous prompt/messages
- `/session/:id/prompt_async` -> asynchronous prompt
- `/session/:id/abort` -> abort
- `/session/:id/command` -> command
- `/session/:id/shell` -> shell
- `/permission` and `/permission/:requestID/reply` -> permission tools
- `/question` -> question inspection
- `/file`, `/file/content`, `/find` -> workspace tools
- `/file/status`, `/vcs`, `/vcs/diff` -> VCS tools
- `/agent`, `/skill`, `/command` -> discovery tools
- `/config`, `/config/providers` -> configuration tools
- `/mcp` -> OpenCode MCP status
- `/path` -> path inspection

## Limitations

1. OpenCode's interactive PTY endpoint uses WebSocket; this MCP currently exposes the documented HTTP management surface but does not provide an interactive WebSocket tool.
2. SSE event streams are not currently surfaced as a persistent MCP subscription. Hermes can poll session messages/status, or use `opencode_request` for compatible HTTP operations.
3. The low-level request tool intentionally exposes only HTTP methods; it does not tunnel arbitrary WebSocket traffic.
4. Some OpenCode endpoints are marked experimental by OpenCode and are not promoted to stable high-level MCP tools.

## Security

Keep OpenCode bound to localhost unless remote access is intentionally required. If exposed beyond loopback, configure `OPENCODE_SERVER_PASSWORD`. Never place passwords/API keys in this file, source code, Git history, or MCP configuration committed to a repository.

## Verification status

`IMPLEMENTED` — source implementation and installer are present.

`TESTING` requires standalone execution against a real OpenCode server.

`VERIFIED` requires the complete Hermes -> MCP -> OpenCode -> real result -> MCP -> Hermes round trip with evidence. This repository does not claim that status yet.
