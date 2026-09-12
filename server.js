#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// mcp-uk-tools — a Model Context Protocol (MCP) server
//
// Exposes a few UK public-data tools to any MCP-compatible AI client (Claude
// Code, Claude Desktop, etc.) over stdio. Every source is a FREE, keyless
// public API — there are no API keys or secrets anywhere in this project.
//
// Tools:
//   • uk_postcode_lookup  — location, region, council & coordinates for a postcode
//   • uk_postcode_nearest — nearby postcodes for a lat/lng
//   • uk_bank_holidays    — upcoming UK bank holidays by division
//
// Author: Azeem Javed · MIT License
// ─────────────────────────────────────────────────────────────────────────────
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// ── helpers ──────────────────────────────────────────────────────────────────
async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'mcp-uk-tools' } });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
  return res.json();
}
const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = (msg) => ({ content: [{ type: 'text', text: `Error: ${msg}` }], isError: true });

// ── tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'uk_postcode_lookup',
    description: 'Look up a UK postcode — returns the town/area, region, council, country and coordinates. Source: postcodes.io (keyless).',
    inputSchema: {
      type: 'object',
      properties: { postcode: { type: 'string', description: 'A UK postcode, e.g. "SW1A 1AA"' } },
      required: ['postcode'],
    },
  },
  {
    name: 'uk_postcode_nearest',
    description: 'Find UK postcodes nearest to a latitude/longitude. Source: postcodes.io (keyless).',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        limit: { type: 'number', description: 'How many results (default 5)' },
      },
      required: ['latitude', 'longitude'],
    },
  },
  {
    name: 'uk_bank_holidays',
    description: 'List upcoming UK bank holidays for a division (england-and-wales, scotland or northern-ireland). Source: gov.uk (keyless).',
    inputSchema: {
      type: 'object',
      properties: {
        division: {
          type: 'string',
          enum: ['england-and-wales', 'scotland', 'northern-ireland'],
          description: 'Default england-and-wales',
        },
      },
    },
  },
];

// ── tool implementations ─────────────────────────────────────────────────────
async function runTool(name, args) {
  if (name === 'uk_postcode_lookup') {
    const pc = String(args.postcode || '').trim();
    if (!pc) return fail('postcode is required');
    const d = await getJSON(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
    const r = d.result || {};
    return ok({
      postcode: r.postcode, town: r.admin_ward || r.parish, region: r.region,
      council: r.admin_district, country: r.country,
      latitude: r.latitude, longitude: r.longitude,
    });
  }
  if (name === 'uk_postcode_nearest') {
    const { latitude, longitude, limit = 5 } = args;
    if (latitude == null || longitude == null) return fail('latitude and longitude are required');
    const d = await getJSON(`https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}&limit=${limit}`);
    return ok((d.result || []).map((r) => ({ postcode: r.postcode, distance_m: Math.round(r.distance), council: r.admin_district })));
  }
  if (name === 'uk_bank_holidays') {
    const division = args.division || 'england-and-wales';
    const d = await getJSON('https://www.gov.uk/bank-holidays.json');
    const events = ((d[division] || {}).events || []).filter((e) => new Date(e.date) >= new Date()).slice(0, 8);
    return ok({ division, upcoming: events });
  }
  return fail(`Unknown tool: ${name}`);
}

// ── wire up the MCP server ───────────────────────────────────────────────────
const server = new Server(
  { name: 'mcp-uk-tools', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    return await runTool(req.params.name, req.params.arguments || {});
  } catch (e) {
    return fail(e.message);
  }
});

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('mcp-uk-tools running on stdio');
})();
