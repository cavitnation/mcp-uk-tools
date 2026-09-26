# mcp-uk-tools


[![CI](https://github.com/cavitnation/mcp-uk-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/cavitnation/mcp-uk-tools/actions/workflows/ci.yml) [![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-server-6d28d9)](https://modelcontextprotocol.io)

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
npm ci
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

## Tests

```bash
npm test   # node --test — unit, upstream-response, timeout and stdio integration tests
```

Every push and PR runs the suite on Node 22 and 24 via GitHub Actions. Node 22+ is required; use a supported LTS release.

## License

MIT © Azeem Javed

## Reliability contract

Arguments are validated by the server before network access. Nearest-postcode coordinates must be finite numbers within geographic bounds; `limit` is an integer from 1 to 100. Unknown holiday divisions return an explicit error. Upstream failures and malformed responses do not become successful empty results.

Bank holidays include **today in Europe/London**, are sorted by date, and return at most eight events. Requests have a 10-second deadline and propagate MCP cancellation. The postcode lookup's historical `town` field represents an administrative ward/parish, not a verified postal town.

The lockfile and `npm ci` make dependency resolution repeatable. Tests mock upstream data, cover London date boundaries and exercise a real stdio client/server exchange without contacting public APIs. Dependabot checks npm and Actions dependencies weekly.

```sh
npm ci
npm run check
npm test
npm audit --omit=dev
```

No upstream availability guarantee is implied. Sources: [Postcodes.io geolocation contract](https://postcodes.io/docs/api/postcode-lookup/) and [GOV.UK bank-holiday data](https://www.gov.uk/bank-holidays.json).
