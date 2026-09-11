# Design MCP Setup

The project skills are versioned in the repository. MCP servers are client-level integrations and must be connected in the coding client that runs the agent.

## Playwright MCP

Official server: `@playwright/mcp`.

Standard configuration:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--isolated"]
    }
  }
}
```

Common CLI setup:

- Codex: `codex mcp add playwright npx "@playwright/mcp@latest"`
- Claude Code: `claude mcp add playwright npx @playwright/mcp@latest`
- Cursor: Settings → MCP → Add server → command `npx @playwright/mcp@latest`

Use it for rendered-page inspection, responsive checks, interaction verification and visual QA.

## Figma MCP

Official remote endpoint:

`https://mcp.figma.com/mcp`

Generic configuration:

```json
{
  "mcpServers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

Figma requires user authentication/authorization in the client. Repository code cannot complete that OAuth step on behalf of the user.

## Recommended order for IA-conect

Taste → Impeccable critique/audit → static UI direction → implementation → Emil motion pass → Playwright verification → final Impeccable polish/audit.
