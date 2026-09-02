#!/usr/bin/env bash
set -euo pipefail

REPO="${OP_MCP_REPO:-https://github.com/arifhussainshahshah-gif/op-mcp.git}"
DIR="${OP_MCP_DIR:-$HOME/.local/share/op-mcp}"
BIN="${OP_MCP_BIN:-$HOME/.local/bin}"

command -v git >/dev/null || { echo 'git is required' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js 20+ is required' >&2; exit 1; }
command -v npm >/dev/null || { echo 'npm is required' >&2; exit 1; }

mkdir -p "$(dirname "$DIR")" "$BIN"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi

cd "$DIR"
npm install
npm run build
ln -sfn "$DIR/dist/src/index.js" "$BIN/op-mcp"

cat <<EOF
Installed op-mcp at $DIR
Executable: $BIN/op-mcp

For a local OpenCode server:
  opencode serve --hostname 127.0.0.1 --port 4096

Configure the MCP host to launch:
  $BIN/op-mcp

Optional environment variables:
  OPENCODE_URL=http://127.0.0.1:4096
  OPENCODE_SERVER_USERNAME=opencode
  OPENCODE_SERVER_PASSWORD=<RUNTIME_PASSWORD>
EOF
