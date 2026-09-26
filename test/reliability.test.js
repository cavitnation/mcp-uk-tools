'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runTool, getJSON } = require('../tools.js');
const response = (data) => async () => ({ ok: true, json: async () => data });
const result = (r) => JSON.parse(r.content[0].text);

test('rejects invalid arguments without network access', async () => {
  const options = { fetchImpl: () => { throw new Error('NETWORK CALLED'); } };
  const cases = [
    ['uk_postcode_lookup', { postcode: 123 }], ['uk_postcode_lookup', { postcode: 'x?query=bad' }],
    ['uk_postcode_nearest', { latitude: 999, longitude: 0 }], ['uk_postcode_nearest', { latitude: 0, longitude: -181 }],
    ['uk_postcode_nearest', { latitude: '51', longitude: 0 }], ['uk_postcode_nearest', { latitude: NaN, longitude: 0 }],
    ['uk_postcode_nearest', { latitude: 0, longitude: 0, limit: -1 }], ['uk_postcode_nearest', { latitude: 0, longitude: 0, limit: 1.5 }],
    ['uk_postcode_nearest', { latitude: 0, longitude: 0, limit: 101 }], ['uk_bank_holidays', { division: 'invalid' }],
    ['uk_bank_holidays', { division: '' }], ['uk_bank_holidays', { unexpected: 1 }], ['uk_bank_holidays', null],
  ];
  for (const [name, args] of cases) {
    const r = await runTool(name, args, options);
    assert.equal(r.isError, true); assert.doesNotMatch(r.content[0].text, /NETWORK CALLED/);
  }
});
test('postcode lookup formats an upstream success', async () => {
  const r = await runTool('uk_postcode_lookup', { postcode: 'SW1A 1AA' }, { fetchImpl: response({ status: 200, result: {
    postcode: 'SW1A 1AA', admin_ward: 'St James', admin_district: 'Westminster', latitude: 51.5, longitude: -0.14,
  } }) });
  assert.equal(result(r).council, 'Westminster'); assert.equal(result(r).latitude, 51.5);
});
test('nearest handles no matches and rounds distances', async () => {
  const args = { latitude: 51.5, longitude: -0.1 };
  assert.deepEqual(result(await runTool('uk_postcode_nearest', args, { fetchImpl: response({ status: 200, result: null }) })), []);
  const r = await runTool('uk_postcode_nearest', args, { fetchImpl: response({ status: 200, result: [{ postcode: 'TEST', distance: 12.6 }] }) });
  assert.equal(result(r)[0].distance_m, 13);
});
test('holidays include today, sort dates and use the London calendar at midnight', async () => {
  const events = [{ title: 'Next', date: '2026-12-28' }, { title: 'Today', date: '2026-12-25' }, { title: 'Past', date: '2026-12-24' }];
  const r = await runTool('uk_bank_holidays', {}, { fetchImpl: response({ 'england-and-wales': { events } }), now: () => new Date('2026-12-25T12:00:00Z') });
  assert.deepEqual(result(r).upcoming.map((x) => x.title), ['Today', 'Next']);
  const summer = await runTool('uk_bank_holidays', { division: 'scotland' }, { fetchImpl: response({ scotland: { events: [{ title: 'Yesterday', date: '2026-08-02' }, { title: 'Today', date: '2026-08-03' }] } }), now: () => new Date('2026-08-02T23:30:00Z') });
  assert.deepEqual(result(summer).upcoming.map((x) => x.title), ['Today']);
});
test('malformed upstream payloads produce errors, not empty successes', async () => {
  for (const [name, args, body] of [
    ['uk_postcode_lookup', { postcode: 'SW1A 1AA' }, {}],
    ['uk_postcode_nearest', { latitude: 0, longitude: 0 }, { status: 200, result: [{}] }],
    ['uk_bank_holidays', {}, {}],
    ['uk_bank_holidays', {}, { 'england-and-wales': { events: [{ title: 'Bad', date: '2026-02-31' }] } }],
  ]) assert.equal((await runTool(name, args, { fetchImpl: response(body) })).isError, true);
});
test('HTTP and invalid JSON errors are explicit', async () => {
  await assert.rejects(getJSON('https://example.invalid', { fetchImpl: async () => ({ ok: false, status: 429 }) }), /429/);
  await assert.rejects(getJSON('https://example.invalid', { fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError(); } }) }), /invalid JSON/);
});
test('deadlines and caller cancellation abort upstream requests', async () => {
  const fetchImpl = (_, { signal }) => new Promise((resolve, reject) => {
    const abort = () => reject(new Error('aborted'));
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
  await assert.rejects(getJSON('https://example.invalid', { fetchImpl, timeoutMs: 10 }), /timed out/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(getJSON('https://example.invalid', { fetchImpl, signal: controller.signal }), /cancelled/);
});
