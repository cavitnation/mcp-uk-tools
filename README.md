# mcp-uk-tools

A small **[Model Context Protocol](https://modelcontextprotocol.io) (MCP)** server that exposes UK public-data tools to any MCP-compatible AI client — **Claude Code**, Claude Desktop, or your own agent.

It's a clean, dependency-light reference for how I build MCP tool servers: a typed tool schema, a thin request handler, and each tool wrapping a real data source. Every source here is a **free, keyless public API**, so there are **no API keys or secrets** anywhere in this repo.

> I use this same pattern in production to give an LLM grounded, source-cited access to official registers — this is the open, keyless version of it.

## Tools

| Tool | What it does | Source |
|------|--------------|--------|
| `uk_postcode_lookup` | Town/area, region, council, country & coordinates for a postcode | postcodes.io |
| `uk_postcode_nearest` | Nearest postcodes to a latitude/longitude | postcodes.io |
| `uk_bank_holidays` | Upcoming UK bank holidays by division | gov.uk |

## Run it

```bash
npm install
node server.js      # speaks MCP over stdio
```

## Use it from Claude Code / Claude Desktop

Add it to your MCP client config:

```json
{
  "mcpServers": {
    "uk-tools": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-uk-tools/server.js"]
    }
  }
}
```

Then just ask: *"What council is SW1A 1AA in?"* or *"When is the next UK bank holiday?"* — the model calls the tools itself.

## How it works

- `ListToolsRequestSchema` → advertises the typed tool schemas
- `CallToolRequestSchema` → routes a call to the matching handler
- each handler does one `fetch` to a keyless public API and returns JSON

That's the whole contract. Swap the data sources for your own APIs and you have a grounded tool layer for any agent.

## License

MIT © Azeem Javed
