'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TOOLS, runTool } = require('../tools.js');

test('every tool has a unique name, description and object inputSchema', () => {
  const names = new Set();
  for (const t of TOOLS) {
    assert.equal(typeof t.name, 'string');
    assert.ok(t.name.length > 0, 'name non-empty');
    assert.ok(!names.has(t.name), `duplicate tool name: ${t.name}`);
    names.add(t.name);
    assert.equal(typeof t.description, 'string');
    assert.equal(t.inputSchema.type, 'object');
  }
  assert.deepEqual([...names], ['uk_postcode_lookup', 'uk_postcode_nearest', 'uk_bank_holidays']);
});

test('required fields are listed in each schema', () => {
  const byName = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
  assert.deepEqual(byName.uk_postcode_lookup.inputSchema.required, ['postcode']);
  assert.deepEqual(byName.uk_postcode_nearest.inputSchema.required, ['latitude', 'longitude']);
});

test('uk_postcode_lookup rejects a missing postcode without a network call', async () => {
  const res = await runTool('uk_postcode_lookup', {});
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /postcode is required/);
});

test('uk_postcode_nearest rejects missing coordinates', async () => {
  const res = await runTool('uk_postcode_nearest', { latitude: 51.5 });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /latitude and longitude are required/);
});

test('an unknown tool name returns an error result', async () => {
  const res = await runTool('does_not_exist', {});
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /Unknown tool/);
});
