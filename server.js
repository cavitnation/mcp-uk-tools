#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// mcp-uk-tools — MCP server exposing keyless UK public-data tools over stdio.
// Tool logic lives in ./tools.js (unit-tested); this file only wires it to the
// Model Context Protocol SDK. No API keys or secrets anywhere.
//   Author: Azeem Javed · MIT License
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { TOOLS, runTool, fail } = require('./tools.js');

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
