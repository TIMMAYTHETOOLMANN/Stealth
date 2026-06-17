/**
 * Minimal MCP client for the Streamable HTTP transport exposed by
 * `supergateway --streamableHttp` in front of `mcp-stealth-chrome`.
 *
 * This is a REAL integration: it performs the MCP `initialize` handshake,
 * discovers the server's tools via `tools/list`, and invokes the appropriate
 * navigation + content-extraction tools to retrieve live job-posting HTML/text.
 * If the bridge is unreachable, callers fall back to user-pasted text — the
 * system never fabricates job data.
 */

const MCP_URL = process.env.STEALTH_MCP_URL ?? "http://127.0.0.1:8000/mcp";
const PROTOCOL_VERSION = "2024-11-05";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown> };
}

interface McpContentBlock {
  type: string;
  text?: string;
  [k: string]: unknown;
}

/** Parse a Streamable-HTTP response body that may be JSON or SSE framed. */
async function parseBody(res: Response): Promise<JsonRpcResponse | null> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (contentType.includes("application/json")) {
    return text ? (JSON.parse(text) as JsonRpcResponse) : null;
  }
  // text/event-stream: collect the last `data:` payload containing a result.
  let last: JsonRpcResponse | null = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as JsonRpcResponse;
      if (parsed && (parsed.result !== undefined || parsed.error !== undefined)) {
        last = parsed;
      }
    } catch {
      /* ignore keep-alive / non-JSON frames */
    }
  }
  return last;
}

class McpSession {
  private sessionId: string | null = null;
  private nextId = 1;

  private async rpc(
    method: string,
    params?: Record<string, unknown>,
    notify = false,
  ): Promise<JsonRpcResponse | null> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;

    const body: Record<string, unknown> = { jsonrpc: "2.0", method };
    if (params) body.params = params;
    if (!notify) body.id = this.nextId++;

    const res = await fetch(MCP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      // Server-side fetch; no caching.
      cache: "no-store",
    });

    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`MCP ${method} failed: HTTP ${res.status} ${detail}`);
    }
    if (notify) return null;

    const parsed = await parseBody(res);
    if (parsed?.error) {
      throw new Error(`MCP ${method} error: ${parsed.error.message}`);
    }
    return parsed;
  }

  async initialize(): Promise<void> {
    await this.rpc("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "stealth-job-agent", version: "0.1.0" },
    });
    // Required notification to complete the handshake.
    await this.rpc("notifications/initialized", undefined, true).catch(() => {});
  }

  async listTools(): Promise<McpTool[]> {
    const res = await this.rpc("tools/list", {});
    const tools = (res?.result as { tools?: McpTool[] })?.tools;
    return Array.isArray(tools) ? tools : [];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const res = await this.rpc("tools/call", { name, arguments: args });
    const content = (res?.result as { content?: McpContentBlock[] })?.content;
    if (!Array.isArray(content)) return "";
    return content
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string)
      .join("\n")
      .trim();
  }
}

/** Pick the best-matching tool by keyword priority over its name. */
function pickTool(tools: McpTool[], keywords: string[]): McpTool | null {
  for (const kw of keywords) {
    const match = tools.find((t) => t.name.toLowerCase().includes(kw));
    if (match) return match;
  }
  return null;
}

/** Choose the most likely argument key for a URL on a tool's input schema. */
function urlArgKey(tool: McpTool | null): string {
  const props = tool?.inputSchema?.properties ?? {};
  const keys = Object.keys(props);
  return (
    keys.find((k) => /^(url|uri|link|address)$/i.test(k)) ??
    keys.find((k) => /url|uri|link/i.test(k)) ??
    "url"
  );
}

export interface FetchedPage {
  url: string;
  content: string;
}

/**
 * Drive the stealth browser to load a URL and return its visible text/HTML.
 * Throws a descriptive error if the bridge is unreachable or exposes no usable
 * tools — callers surface this so the user can paste the description instead.
 */
export async function fetchPageViaStealth(url: string): Promise<FetchedPage> {
  const session = new McpSession();
  try {
    await session.initialize();
  } catch (err) {
    throw new Error(
      `Cannot reach the stealth-chrome MCP bridge at ${MCP_URL}. ` +
        `Start it (see README) or paste the job description manually. ` +
        `(${(err as Error).message})`,
    );
  }

  const tools = await session.listTools();
  if (tools.length === 0) {
    throw new Error("The MCP bridge exposed no tools.");
  }

  const navTool = pickTool(tools, ["navigate", "goto", "open", "visit"]);
  const contentTool = pickTool(tools, [
    "content",
    "text",
    "markdown",
    "html",
    "read",
    "extract",
    "snapshot",
    "dom",
  ]);

  if (!navTool && !contentTool) {
    throw new Error(
      `No navigation/content tools found. Available: ${tools
        .map((t) => t.name)
        .join(", ")}`,
    );
  }

  // Some servers fetch + return content in a single tool call.
  if (navTool) {
    const navOut = await session.callTool(navTool.name, {
      [urlArgKey(navTool)]: url,
    });
    if (!contentTool && navOut) {
      return { url, content: navOut };
    }
  }

  if (contentTool) {
    // Content tools sometimes accept the URL directly, sometimes not.
    const args: Record<string, unknown> = {};
    const props = contentTool.inputSchema?.properties ?? {};
    if (Object.keys(props).some((k) => /url|uri|link/i.test(k))) {
      args[urlArgKey(contentTool)] = url;
    }
    const content = await session.callTool(contentTool.name, args);
    if (content) return { url, content };
  }

  throw new Error("The stealth browser returned no readable content.");
}
