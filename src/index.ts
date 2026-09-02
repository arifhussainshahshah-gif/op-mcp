import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const BASE_URL = (process.env.OPENCODE_URL ?? 'http://127.0.0.1:4096').replace(/\/$/, '');
const USERNAME = process.env.OPENCODE_SERVER_USERNAME ?? 'opencode';
const PASSWORD = process.env.OPENCODE_SERVER_PASSWORD;

function authHeaders(): Record<string, string> {
  if (!PASSWORD) return {};
  return { Authorization: `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}` };
}

async function opencodeRequest(path: string, method = 'GET', body?: unknown, query?: Record<string, unknown>, directory?: string) {
  const url = new URL(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  if (directory) url.searchParams.set('directory', directory);

  const headers: Record<string, string> = { Accept: 'application/json, text/event-stream', ...authHeaders() };
  const init: RequestInit = { method, headers };
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  const text = await response.text();
  let data: unknown = text;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(`OpenCode HTTP ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

const server = new McpServer({ name: 'opencode-control', version: '0.1.0' });
const method = z.enum(['GET','POST','PUT','PATCH','DELETE']);

server.registerTool('opencode_health', {
  description: 'Check the connected OpenCode server and return its health/version.',
  inputSchema: z.object({})
}, async () => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/global/health')) }] }));

server.registerTool('opencode_request', {
  description: 'Low-level escape hatch for the documented OpenCode HTTP/OpenAPI server. Use this when a specific high-level tool is not provided. Path must be an OpenCode API path.',
  inputSchema: z.object({ path: z.string().min(1), method, query: z.record(z.string(), z.unknown()).optional(), body: z.unknown().optional(), directory: z.string().optional() })
}, async ({ path, method, query, body, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest(path, method, body, query, directory)) }] }));

server.registerTool('opencode_projects', {
  description: 'List known OpenCode projects.', inputSchema: z.object({})
}, async () => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/project')) }] }));

server.registerTool('opencode_sessions', {
  description: 'List OpenCode sessions, optionally scoped to a project directory.',
  inputSchema: z.object({ directory: z.string().optional(), roots: z.boolean().optional(), start: z.string().optional(), search: z.string().optional(), limit: z.number().int().positive().optional() })
}, async ({ directory, roots, start, search, limit }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/session','GET',undefined,{roots,start,search,limit},directory)) }] }));

server.registerTool('opencode_session_create', {
  description: 'Create a new OpenCode session.',
  inputSchema: z.object({ directory: z.string().optional(), title: z.string().optional() })
}, async ({ directory, title }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/session','POST',title ? { title } : {},undefined,directory)) }] }));

server.registerTool('opencode_session_get', {
  description: 'Get session details.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() })
}, async ({ session_id, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest(`/session/${encodeURIComponent(session_id)}`,'GET',undefined,undefined,directory)) }] }));

server.registerTool('opencode_session_delete', {
  description: 'Delete a session and its data.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() })
}, async ({ session_id, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest(`/session/${encodeURIComponent(session_id)}`,'DELETE',undefined,undefined,directory)) }] }));

server.registerTool('opencode_prompt', {
  description: 'Send a synchronous prompt to an OpenCode session and return the resulting message.',
  inputSchema: z.object({ session_id: z.string(), text: z.string(), agent: z.string().optional(), provider_id: z.string().optional(), model_id: z.string().optional(), directory: z.string().optional() })
}, async ({ session_id, text, agent, provider_id, model_id, directory }) => {
  const body: Record<string, unknown> = { parts: [{ type: 'text', text }] };
  if (agent) body.agent = agent;
  if (provider_id && model_id) body.model = { providerID: provider_id, modelID: model_id };
  return { content: [{ type: 'text', text: JSON.stringify(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/message`,'POST',body,undefined,directory)) }] };
});

server.registerTool('opencode_prompt_async', {
  description: 'Submit a prompt asynchronously. Returns when OpenCode accepts the request.',
  inputSchema: z.object({ session_id: z.string(), text: z.string(), agent: z.string().optional(), provider_id: z.string().optional(), model_id: z.string().optional(), directory: z.string().optional() })
}, async ({ session_id, text, agent, provider_id, model_id, directory }) => {
  const body: Record<string, unknown> = { parts: [{ type: 'text', text }] };
  if (agent) body.agent = agent;
  if (provider_id && model_id) body.model = { providerID: provider_id, modelID: model_id };
  await opencodeRequest(`/session/${encodeURIComponent(session_id)}/prompt_async`,'POST',body,undefined,directory);
  return { content: [{ type: 'text', text: 'OpenCode accepted the asynchronous prompt.' }] };
});

server.registerTool('opencode_messages', {
  description: 'Read messages and tool activity from a session.', inputSchema: z.object({ session_id: z.string(), limit: z.number().int().positive().optional(), before: z.string().optional(), directory: z.string().optional() })
}, async ({ session_id, limit, before, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/message`,'GET',undefined,{limit,before},directory)) }] }));

server.registerTool('opencode_abort', {
  description: 'Abort active processing in a session.', inputSchema: z.object({ session_id: z.string(), directory: z.string().optional() })
}, async ({ session_id, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/abort`,'POST',{},undefined,directory)) }] }));

server.registerTool('opencode_shell', {
  description: 'Run a shell command through OpenCode in a session context. OpenCode permissions still apply.',
  inputSchema: z.object({ session_id: z.string(), command: z.string(), directory: z.string().optional() })
}, async ({ session_id, command, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/shell`,'POST',{command},undefined,directory)) }] }));

server.registerTool('opencode_command', {
  description: 'Execute an OpenCode slash command in a session.',
  inputSchema: z.object({ session_id: z.string(), command: z.string(), arguments: z.array(z.string()).optional(), directory: z.string().optional() })
}, async ({ session_id, command, arguments: args, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest(`/session/${encodeURIComponent(session_id)}/command`,'POST',{command,arguments: args ?? []},undefined,directory)) }] }));

server.registerTool('opencode_permissions', {
  description: 'List pending OpenCode permission requests.', inputSchema: z.object({ directory: z.string().optional() })
}, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/permission','GET',undefined,undefined,directory)) }] }));

server.registerTool('opencode_permission_reply', {
  description: 'Approve or reject a pending OpenCode permission request.',
  inputSchema: z.object({ request_id: z.string(), reply: z.enum(['once','always','reject']), directory: z.string().optional() })
}, async ({ request_id, reply, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest(`/permission/${encodeURIComponent(request_id)}/reply`,'POST',{reply},undefined,directory)) }] }));

server.registerTool('opencode_questions', {
  description: 'List pending OpenCode user questions.', inputSchema: z.object({ directory: z.string().optional() })
}, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/question','GET',undefined,undefined,directory)) }] }));

server.registerTool('opencode_files', {
  description: 'List files in an OpenCode workspace directory.', inputSchema: z.object({ path: z.string().optional(), directory: z.string().optional() })
}, async ({ path, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/file','GET',undefined,{path},directory)) }] }));

server.registerTool('opencode_read_file', {
  description: 'Read file content through OpenCode.', inputSchema: z.object({ path: z.string(), directory: z.string().optional() })
}, async ({ path, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/file/content','GET',undefined,{path},directory)) }] }));

server.registerTool('opencode_find', {
  description: 'Search file contents using OpenCode workspace search.', inputSchema: z.object({ query: z.string(), directory: z.string().optional() })
}, async ({ query, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/find','GET',undefined,{query},directory)) }] }));

server.registerTool('opencode_git_diff', {
  description: 'Get the current project git diff through OpenCode.', inputSchema: z.object({ mode: z.string().optional(), directory: z.string().optional() })
}, async ({ mode, directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/vcs/diff','GET',undefined,{mode},directory)) }] }));

server.registerTool('opencode_status', {
  description: 'Get git/file status through OpenCode.', inputSchema: z.object({ directory: z.string().optional() })
}, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/file/status','GET',undefined,undefined,directory)) }] }));

server.registerTool('opencode_agents', { description: 'List available OpenCode agents.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/agent','GET',undefined,undefined,directory)) }] }));
server.registerTool('opencode_skills', { description: 'List available OpenCode skills.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/skill','GET',undefined,undefined,directory)) }] }));
server.registerTool('opencode_commands', { description: 'List available OpenCode commands.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/command','GET',undefined,undefined,directory)) }] }));
server.registerTool('opencode_config', { description: 'Read project OpenCode configuration.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/config','GET',undefined,undefined,directory)) }] }));
server.registerTool('opencode_providers', { description: 'List configured OpenCode providers and defaults.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/config/providers','GET',undefined,undefined,directory)) }] }));
server.registerTool('opencode_mcp_status', { description: 'List MCP servers known to OpenCode.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/mcp','GET',undefined,undefined,directory)) }] }));
server.registerTool('opencode_path', { description: 'Get OpenCode home/state/config/worktree/directory paths.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/path','GET',undefined,undefined,directory)) }] }));
server.registerTool('opencode_vcs', { description: 'Get OpenCode VCS information.', inputSchema: z.object({ directory: z.string().optional() }) }, async ({ directory }) => ({ content: [{ type: 'text', text: JSON.stringify(await opencodeRequest('/vcs','GET',undefined,undefined,directory)) }] }));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`op-mcp connected to ${BASE_URL}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
