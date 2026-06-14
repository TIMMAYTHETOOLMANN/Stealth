# Stealth

This repository is configured to run **mcp-stealth-chrome** in a cloud-friendly setup with an **HTTP MCP endpoint** and local MCP-client integration.

## Included configuration

- **Copilot cloud agent bootstrap:**
  - `.github/workflows/copilot-setup-steps.yml`
  - Installs Node.js, `uv`, Chrome/Chromium, and warms both `mcp-stealth-chrome` and `supergateway`
- **Project MCP client bridge config:**
  - `.mcp.json` (Claude/project-level)
  - `.vscode/mcp.json` (VS Code/project-level)
  - Connects MCP clients to the HTTP endpoint via `supergateway --streamableHttp`

## Start always-on HTTP MCP server (preferred)

Run this on your host (or in your cloud runtime) and keep it running:

```bash
npx -y supergateway \
  --stdio "uvx mcp-stealth-chrome@latest" \
  --outputTransport streamableHttp \
  --stateful \
  --sessionTimeout 3600000 \
  --port 8000 \
  --streamableHttpPath /mcp \
  --healthEndpoint /healthz
```

- MCP endpoint: `http://127.0.0.1:8000/mcp`
- Health endpoint: `http://127.0.0.1:8000/healthz`

## Verify

```bash
curl -fsS http://127.0.0.1:8000/healthz
```

Then confirm your MCP client lists the `stealth-chrome-http` server and its tools.
