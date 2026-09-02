#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${OPENCODE_URL:-http://127.0.0.1:4096}"
AUTH=()
if [[ -n "${OPENCODE_SERVER_PASSWORD:-}" ]]; then
  AUTH=(-u "${OPENCODE_SERVER_USERNAME:-opencode}:${OPENCODE_SERVER_PASSWORD}")
fi

fail() { echo "BLOCKED: $*" >&2; exit 2; }

health="$(curl -fsS "${AUTH[@]}" "$BASE_URL/global/health")" || fail "OpenCode health endpoint is unreachable at $BASE_URL"
doc="$(curl -fsS "${AUTH[@]}" "$BASE_URL/doc")" || fail "OpenCode /doc endpoint is unreachable"

printf '%s\n' "$health"
printf 'OpenAPI spec reachable: yes\n'

if ! grep -q 'session/:id/message' <<<"$doc"; then
  fail "OpenCode /doc did not contain the expected session message API"
fi
if ! grep -q 'session/:id/shell' <<<"$doc"; then
  fail "OpenCode /doc did not contain the expected shell API"
fi
if ! grep -q 'session/:id/permissions/:permissionID' <<<"$doc"; then
  fail "OpenCode /doc did not contain the current session permission API"
fi

printf 'TESTING: core OpenCode API discovery passed.\n'
printf 'Next: run the MCP through Hermes and perform a real coding task before claiming VERIFIED.\n'
