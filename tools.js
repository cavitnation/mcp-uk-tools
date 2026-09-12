// ─────────────────────────────────────────────────────────────────────────────
// tools.js — pure tool definitions + dispatch for mcp-uk-tools.
// Kept free of the MCP SDK so it is unit-testable in isolation. No secrets.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

/** @typedef {{content: {type:'text',text:string}[], isError?: boolean}} ToolResult */

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'mcp-uk-tools' } });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
  return res.json();
}
const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = (msg) => ({ content: [{ type: 'text', text: `Error: ${msg}` }], isError: true });

const TOOLS = [
  {
    name: 'uk_postcode_lookup',
    description: 'Look up a UK postcode — town/area, region, council, country and coordinates. Source: postcodes.io (keyless).',
    inputSchema: { type: 'object', properties: { postcode: { type: 'string' } }, required: ['postcode'] },
  },
  {
    name: 'uk_postcode_nearest',
    description: 'Find UK postcodes nearest to a latitude/longitude. Source: postcodes.io (keyless).',
    inputSchema: {
      type: 'object',
      properties: { latitude: { type: 'number' }, longitude: { type: 'number' }, limit: { type: 'number' } },
      required: ['latitude', 'longitude'],
    },
  },
  {
    name: 'uk_bank_holidays',
    description: 'List upcoming UK bank holidays for a division. Source: gov.uk (keyless).',
    inputSchema: {
      type: 'object',
      properties: { division: { type: 'string', enum: ['england-and-wales', 'scotland', 'northern-ireland'] } },
    },
  },
];

/** @param {string} name @param {Record<string,any>} args @returns {Promise<ToolResult>} */
async function runTool(name, args = {}) {
  if (name === 'uk_postcode_lookup') {
    const pc = String(args.postcode || '').trim();
    if (!pc) return fail('postcode is required');
    const d = await getJSON(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
    const r = d.result || {};
    return ok({ postcode: r.postcode, town: r.admin_ward || r.parish, region: r.region,
      council: r.admin_district, country: r.country, latitude: r.latitude, longitude: r.longitude });
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

module.exports = { TOOLS, runTool, getJSON, ok, fail };
