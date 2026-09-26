'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

test('stdio initialize, list tools and call validation without upstream access', { timeout: 10000 }, async () => {
  const client = new Client({ name: 'integration-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(__dirname, '..', 'server.js')], stderr: 'pipe' });
  try {
    await client.connect(transport);
    const list = await client.listTools();
    assert.equal(list.tools.length, 3);
    const bad = await client.callTool({ name: 'uk_postcode_nearest', arguments: { latitude: 999, longitude: 0 } });
    assert.equal(bad.isError, true);
    const holiday = await client.callTool({ name: 'uk_bank_holidays', arguments: { division: 'invalid' } });
    assert.equal(holiday.isError, true);
  } finally { await client.close(); }
});
