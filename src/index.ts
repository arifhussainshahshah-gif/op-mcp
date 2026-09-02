import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const BASE_URL = (process.env.OPENCODE_URL ?? 'http://127.0.0.1:4096').replace(/\/$/, '');
const USERNAME = process.env.OPENCODE_SERVER_USERNAME ?? 'opencode';
const PASSWORD = process.env.OPENCODE_SERVER_PASSWORD;
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENCODE_REQUEST_TIMEOUT_MS ?? 120000);

function authHeaders(): Record<string, string> {
  if (!PASSWORD) return {};
  return { Authorization: `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}` };
}

function makeUrl(path: string, query?: Record<string, unknown>, directory?: string): URL {
  const url = new URL(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  if (directory) url.searchParams.set('directory', directory);
  return url;
}

async function opencodeRequest(path: string, method = 'GET', body?: unknown, query?: Record<string, unknown>, directory?: string) {
  const url = makeUrl(path, query, directory);
  const headers: Record<string, string> = { Accept: 'application/json, text/event-stream', ...authHeaders() };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const init: RequestInit = { method, headers, signal: controller.signal };
    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);
    const text = await response.text();
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* preserve non-JSON */ }
    if (!response.ok) {
      throw new Error(`OpenCode HTTP ${response.status} ${response.statusText}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error(`OpenCode request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function sseSnapshot(path: string, query?: Record<string, unknown>, directory?: string, timeoutMs = 5000) {
  const url = makeUrl(path, query, directory);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: 'text/event-stream', ...authHeaders() }, signal: controller.signal });
    if (!response.ok) throw new Error(`OpenCode HTTP ${response.status} ${response.statusText}`);
    if (!response.body) return '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let out = '';
    try {
      while (out.length < 50000) {
        const { value, done } = await reader.read();
        if (done) break;
        out += decoder.decode(value, { stream: true });
        if (out.includes('\n\n')) break;
      }
    } finally { await reader.cancel().catch(() => {}); }
    return out;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'SSE snapshot timed out; no complete event frame arrived within the requested window.';
    throw error;
  } finally { clearTimeout(timer); }
}

const server = new McpServer({ name: 'opencode-control', version: '0.2.0' });
const httpMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const modelSchema = z.object({ providerID: z.string(), modelID: z.string() });

async function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value) }] };
}

server.registerTool('opencode_health', {
  description: 'Check the connected OpenCode server and return health/version.',
  inputSchema: z.object({})
}, async () => textResult(await opencodeRequest('/global/health')));

server.registerTool('opencode_request', {
  description: 'Low-level access to the documented OpenCode HTTP API. Use for any supported endpoint not covered by a convenience tool. Do not use undocumented endpoints.',
  inputSchema: z.object({
    path: z.string().min(1), method: httpMethod, query: z.record(z.string(), z.unknown()).optional(),
    body: z.unknown().optional(), directory: z.string().optional()
  })
}, async ({ path, method, query, body, directory }) => textResult(await opencodeRequest(path, method, body, query, directory)));

server.registerTool('opencode_projects', { description: 'List all OpenCode projects.', inputSchema: z.object({}) }, async () => textResult(await opencodeRequest('/project')));
server.registerTool('opencode_project_current', { description: 'Get the current OpenCode project.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/project/current', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_path', { description: 'Get OpenCode path information.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/path', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_vcs', { description: 'Get OpenCode VCS information.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/vcs', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_instance_dispose', { description: 'Dispose the current OpenCode instance.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/instance/dispose', 'POST', {}, undefined, directory)));

server.registerTool('opencode_sessions', {
  description: 'List OpenCode sessions.',
  inputSchema: z.object({ directory: z.string().optional(), roots: z.boolean().optional(), start: z.string().optional(), search: z.string().optional(), limit: z.number().int().positive().optional() })
}, async ({ directory, roots, start, search, limit }) => textResult(await opencodeRequest('/session', 'GET', undefined, { roots, start, search, limit }, directory)));
server.registerTool('opencode_session_create', { description: 'Create an OpenCode session.', inputSchema: z.object({ directory: z.string().optional(), parent_id: z.string().optional(), title: z.string().optional() }) }, async ({ directory, parent_id, title }) => textResult(await opencodeRequest('/session', 'POST', { ...(parent_id ? { parentID: parent_id } : {}), ...(title ? { title } : {}) }, undefined, directory)));
server.registerTool('opencode_session_get', { description: 'Get session details.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}`, 'GET', undefined, undefined, directory)));
server.registerTool('opencode_session_update', { description: 'Update a session title.', inputSchema: z.object({ session_id: z.string(), title: z.string().optional(), directory: z.string().optional() }) }, async ({ session_id, title, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}`, 'PATCH', { title }, undefined, directory)));
server.registerTool('opencode_session_delete', { description: 'Delete a session and its data.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}`, 'DELETE', undefined, undefined, directory)));
server.registerTool('opencode_session_status', { description: 'Get status for all sessions.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/session/status', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_session_children', { description: 'Get child sessions.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/children`, 'GET', undefined, undefined, directory)));
server.registerTool('opencode_session_todo', { description: 'Get the current session todo list.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/todo`, 'GET', undefined, undefined, directory)));
server.registerTool('opencode_session_init', { description: 'Analyze an app and create AGENTS.md.', inputSchema: z.object({ session_id: z.string(), message_id: z.string(), provider_id: z.string(), model_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, message_id, provider_id, model_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/init`, 'POST', { messageID: message_id, providerID: provider_id, modelID: model_id }, undefined, directory)));
server.registerTool('opencode_session_fork', { description: 'Fork a session at an optional message.', inputSchema: z.object({ session_id: z.string(), message_id: z.string().optional(), directory: z.string().optional() }) }, async ({ session_id, message_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/fork`, 'POST', message_id ? { messageID: message_id } : {}, undefined, directory)));
server.registerTool('opencode_abort', { description: 'Abort active processing in a session.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/abort`, 'POST', {}, undefined, directory)));
server.registerTool('opencode_share', { description: 'Share a session.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/share`, 'POST', {}, undefined, directory)));
server.registerTool('opencode_unshare', { description: 'Unshare a session.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/share`, 'DELETE', undefined, undefined, directory)));
server.registerTool('opencode_diff', { description: 'Get session file diffs.', inputSchema: z.object({ session_id: z.string(), message_id: z.string().optional(), directory: z.string().optional() }) }, async ({ session_id, message_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/diff`, 'GET', undefined, { messageID: message_id }, directory)));
server.registerTool('opencode_summarize', { description: 'Summarize a session.', inputSchema: z.object({ session_id: z.string(), provider_id: z.string(), model_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, provider_id, model_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/summarize`, 'POST', { providerID: provider_id, modelID: model_id }, undefined, directory)));
server.registerTool('opencode_revert', { description: 'Revert a message, optionally to a specific part.', inputSchema: z.object({ session_id: z.string(), message_id: z.string(), part_id: z.string().optional(), directory: z.string().optional() }) }, async ({ session_id, message_id, part_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/revert`, 'POST', { messageID: message_id, ...(part_id ? { partID: part_id } : {}) }, undefined, directory)));
server.registerTool('opencode_unrevert', { description: 'Restore all reverted messages in a session.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/unrevert`, 'POST', {}, undefined, directory)));

server.registerTool('opencode_prompt', {
  description: 'Send a synchronous prompt to a session and return the resulting message.',
  inputSchema: z.object({ session_id: z.string(), text: z.string(), agent: z.string().optional(), model: modelSchema.optional(), no_reply: z.boolean().optional(), system: z.string().optional(), tools: z.record(z.string(), z.boolean()).optional(), directory: z.string().optional() })
}, async ({ session_id, text, agent, model, no_reply, system, tools, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/message`, 'POST', { parts: [{ type: 'text', text }], ...(agent ? { agent } : {}), ...(model ? { model } : {}), ...(no_reply !== undefined ? { noReply: no_reply } : {}), ...(system ? { system } : {}), ...(tools ? { tools } : {}) }, undefined, directory)));
server.registerTool('opencode_prompt_async', { description: 'Submit a prompt asynchronously.', inputSchema: z.object({ session_id: z.string(), text: z.string(), agent: z.string().optional(), model: modelSchema.optional(), no_reply: z.boolean().optional(), system: z.string().optional(), tools: z.record(z.string(), z.boolean()).optional(), directory: z.string().optional() }) }, async ({ session_id, text, agent, model, no_reply, system, tools, directory }) => { await opencodeRequest(`/session/${encodeURIComponent(session_id)}/prompt_async`, 'POST', { parts: [{ type: 'text', text }], ...(agent ? { agent } : {}), ...(model ? { model } : {}), ...(no_reply !== undefined ? { noReply: no_reply } : {}), ...(system ? { system } : {}), ...(tools ? { tools } : {}) }, undefined, directory); return textResult('OpenCode accepted the asynchronous prompt.'); });
server.registerTool('opencode_messages', { description: 'Read messages and tool activity from a session.', inputSchema: z.object({ session_id: z.string(), limit: z.number().int().positive().optional(), before: z.string().optional(), directory: z.string().optional() }) }, async ({ session_id, limit, before, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/message`, 'GET', undefined, { limit, before }, directory)));
server.registerTool('opencode_message_get', { description: 'Get one message by ID.', inputSchema: z.object({ session_id: z.string(), message_id: z.string(), directory: z.string().optional() }) }, async ({ session_id, message_id, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/message/${encodeURIComponent(message_id)}`, 'GET', undefined, undefined, directory)));
server.registerTool('opencode_shell', { description: 'Run a shell command through OpenCode. Agent is required by the OpenCode server API; permissions still apply.', inputSchema: z.object({ session_id: z.string(), command: z.string(), agent: z.string(), model: modelSchema.optional(), directory: z.string().optional() }) }, async ({ session_id, command, agent, model, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/shell`, 'POST', { agent, ...(model ? { model } : {}), command }, undefined, directory)));
server.registerTool('opencode_command', { description: 'Execute an OpenCode slash command.', inputSchema: z.object({ session_id: z.string(), command: z.string(), arguments: z.array(z.string()).default([]), message_id: z.string().optional(), agent: z.string().optional(), model: modelSchema.optional(), directory: z.string().optional() }) }, async ({ session_id, command, arguments: args, message_id, agent, model, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/command`, 'POST', { command, arguments: args, ...(message_id ? { messageID: message_id } : {}), ...(agent ? { agent } : {}), ...(model ? { model } : {}) }, undefined, directory)));

server.registerTool('opencode_permissions', { description: 'List pending OpenCode permission requests.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/permission', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_permission_reply', { description: 'Respond to a pending permission request using the current OpenCode session-scoped API.', inputSchema: z.object({ session_id: z.string(), permission_id: z.string(), response: z.enum(['once', 'always', 'reject']), remember: z.boolean().optional(), directory: z.string().optional() }) }, async ({ session_id, permission_id, response, remember, directory }) => textResult(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/permissions/${encodeURIComponent(permission_id)}`, 'POST', { response, ...(remember !== undefined ? { remember } : {}) }, undefined, directory)));

server.registerTool('opencode_questions', { description: 'List pending OpenCode questions when supported by the connected server.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/question', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_question_reply', { description: 'Reply to a pending OpenCode question using the server question endpoint.', inputSchema: z.object({ request_id: z.string(), answers: z.array(z.unknown()), directory: z.string().optional() }) }, async ({ request_id, answers, directory }) => textResult(await opencodeRequest(`/question/${encodeURIComponent(request_id)}/reply`, 'POST', { answers }, undefined, directory)));
server.registerTool('opencode_question_reject', { description: 'Reject a pending OpenCode question using the server question endpoint.', inputSchema: z.object({ request_id: z.string(), directory: z.string().optional() }) }, async ({ request_id, directory }) => textResult(await opencodeRequest(`/question/${encodeURIComponent(request_id)}/reject`, 'POST', {}, undefined, directory)));

server.registerTool('opencode_files', { description: 'List files/directories in the workspace.', inputSchema: z.object({ path: z.string().optional(), directory: z.string().optional() }) }, async ({ path, directory }) => textResult(await opencodeRequest('/file', 'GET', undefined, { path }, directory)));
server.registerTool('opencode_read_file', { description: 'Read file content.', inputSchema: z.object({ path: z.string(), directory: z.string().optional() }) }, async ({ path, directory }) => textResult(await opencodeRequest('/file/content', 'GET', undefined, { path }, directory)));
server.registerTool('opencode_find_text', { description: 'Search text in files. Uses /find?pattern= as documented.', inputSchema: z.object({ pattern: z.string(), directory: z.string().optional() }) }, async ({ pattern, directory }) => textResult(await opencodeRequest('/find', 'GET', undefined, { pattern }, directory)));
server.registerTool('opencode_find_files', { description: 'Find files/directories by name.', inputSchema: z.object({ query: z.string(), type: z.enum(['file', 'directory']).optional(), limit: z.number().int().min(1).max(200).optional(), dirs: z.boolean().optional(), directory: z.string().optional() }) }, async ({ query, type, limit, dirs, directory }) => textResult(await opencodeRequest('/find/file', 'GET', undefined, { query, type, limit, dirs: dirs === undefined ? undefined : String(dirs) }, directory)));
server.registerTool('opencode_find_symbols', { description: 'Find workspace symbols.', inputSchema: z.object({ query: z.string(), directory: z.string().optional() }) }, async ({ query, directory }) => textResult(await opencodeRequest('/find/symbol', 'GET', undefined, { query }, directory)));
server.registerTool('opencode_status', { description: 'Get tracked file status.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/file/status', 'GET', undefined, undefined, directory)));

server.registerTool('opencode_tools', { description: 'List experimental tool IDs.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/experimental/tool/ids', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_tools_for_model', { description: 'List experimental tools and JSON schemas for a provider/model.', inputSchema: z.object({ provider: z.string(), model: z.string(), directory: z.string().optional() }) }, async ({ provider, model, directory }) => textResult(await opencodeRequest('/experimental/tool', 'GET', undefined, { provider, model }, directory)));
server.registerTool('opencode_lsp', { description: 'Get LSP server status.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/lsp', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_formatters', { description: 'Get formatter status.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/formatter', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_mcp_status', { description: 'Get MCP server status known to OpenCode.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/mcp', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_mcp_add', { description: 'Add an MCP server dynamically through OpenCode.', inputSchema: z.object({ name: z.string(), config: z.unknown(), directory: z.string().optional() }) }, async ({ name, config, directory }) => textResult(await opencodeRequest('/mcp', 'POST', { name, config }, undefined, directory)));
server.registerTool('opencode_agents', { description: 'List available agents.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/agent', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_skills', { description: 'List available skills.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/skill', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_commands', { description: 'List available slash commands.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/command', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_config', { description: 'Read OpenCode configuration.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/config', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_config_update', { description: 'Patch OpenCode configuration.', inputSchema: z.object({ config: z.record(z.string(), z.unknown()), directory: z.string().optional() }) }, async ({ config, directory }) => textResult(await opencodeRequest('/config', 'PATCH', config, undefined, directory)));
server.registerTool('opencode_providers', { description: 'List providers and default models.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/config/providers', 'GET', undefined, undefined, directory)));
server.registerTool('opencode_provider_auth', { description: 'Get provider authentication methods.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => textResult(await opencodeRequest('/provider/auth', 'GET', undefined, undefined, directory)));

server.registerTool('opencode_tui', { description: 'Drive an OpenCode TUI endpoint. Use only the documented /tui paths.', inputSchema: z.object({ action: z.enum(['append-prompt','open-help','open-sessions','open-themes','open-models','submit-prompt','clear-prompt','execute-command','show-toast']), body: z.record(z.string(), z.unknown()).optional(), directory: z.string().optional() }) }, async ({ action, body, directory }) => textResult(await opencodeRequest(`/tui/${action}`, 'POST', body ?? {}, undefined, directory)));
server.registerTool('opencode_event_snapshot', { description: 'Read a bounded snapshot of OpenCode SSE events. This is intentionally finite; use repeated calls for polling.', inputSchema: z.object({ global: z.boolean().default(false), timeout_ms: z.number().int().min(250).max(30000).default(5000), directory: z.string().optional() }) }, async ({ global, timeout_ms, directory }) => textResult(await sseSnapshot(global ? '/global/event' : '/event', undefined, directory, timeout_ms)));

server.registerTool('opencode_log', { description: 'Write a log entry to OpenCode.', inputSchema: z.object({ service: z.string(), level: z.string(), message: z.string(), extra: z.unknown().optional(), directory: z.string().optional() }) }, async ({ service, level, message, extra, directory }) => textResult(await opencodeRequest('/log', 'POST', { service, level, message, ...(extra !== undefined ? { extra } : {}) }, undefined, directory)));
server.registerTool('opencode_auth_set', { description: 'Set provider authentication credentials using the provider schema.', inputSchema: z.object({ provider_id: z.string(), credentials: z.record(z.string(), z.unknown()), directory: z.string().optional() }) }, async ({ provider_id, credentials, directory }) => textResult(await opencodeRequest(`/auth/${encodeURIComponent(provider_id)}`, 'PUT', credentials, undefined, directory)));

async function main() {
  await server.connect(new StdioServerTransport());
  console.error(`op-mcp connected to ${BASE_URL}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
