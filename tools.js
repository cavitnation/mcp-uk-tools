'use strict';

const DIVISIONS = ['england-and-wales', 'scotland', 'northern-ireland'];
const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = (message) => ({ content: [{ type: 'text', text: `Error: ${message}` }], isError: true });
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

async function getJSON(url, { timeoutMs = 10000, signal, fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { 'User-Agent': 'mcp-uk-tools', Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) throw new Error(signal?.aborted ? 'Request cancelled' : 'Upstream request timed out');
    if (error instanceof SyntaxError) throw new Error('Upstream returned invalid JSON');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

const TOOLS = [
  { name: 'uk_postcode_lookup', description: 'Look up a UK postcode: administrative area, region, council, country and coordinates. Source: postcodes.io.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { postcode: { type: 'string', minLength: 1, maxLength: 16 } }, required: ['postcode'] } },
  { name: 'uk_postcode_nearest', description: 'Find UK postcodes nearest to coordinates. Source: postcodes.io.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 5 } }, required: ['latitude', 'longitude'] } },
  { name: 'uk_bank_holidays', description: 'List up to eight UK bank holidays, including today in Europe/London. Source: gov.uk.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { division: { type: 'string', enum: DIVISIONS } } } },
];

function londonDate(now) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function validEvent(event) {
  if (!object(event) || typeof event.title !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return false;
  const parsed = new Date(`${event.date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === event.date;
}

async function runTool(name, args = {}, options = {}) {
  const tool = TOOLS.find((item) => item.name === name);
  if (!tool) return fail('Unknown tool');
  if (!object(args)) return fail('arguments must be an object');
  if (Object.keys(args).some((key) => !Object.hasOwn(tool.inputSchema.properties, key))) return fail('Unexpected argument');
  try {
    if (name === 'uk_postcode_lookup') {
      if (typeof args.postcode !== 'string' || !args.postcode.trim()) return fail('postcode is required and must be a string');
      const postcode = args.postcode.trim();
      if (postcode.length > 16 || !/^[a-z0-9 ]+$/i.test(postcode)) return fail('Invalid postcode format');
      const data = await getJSON(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, options);
      const r = data?.result;
      if (data?.status !== 200 || !object(r) || typeof r.postcode !== 'string' || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) throw new Error('Unexpected upstream postcode response');
      return ok({ postcode: r.postcode, town: r.admin_ward || r.parish, region: r.region,
        council: r.admin_district, country: r.country, latitude: r.latitude, longitude: r.longitude });
    }
    if (name === 'uk_postcode_nearest') {
      const { latitude, longitude, limit = 5 } = args;
      if (latitude == null || longitude == null) return fail('latitude and longitude are required');
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return fail('Coordinates must be finite numbers within geographic bounds');
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail('limit must be an integer between 1 and 100');
      const query = new URLSearchParams({ lon: String(longitude), lat: String(latitude), limit: String(limit) });
      const data = await getJSON(`https://api.postcodes.io/postcodes?${query}`, options);
      if (data?.status !== 200 || !(data.result === null || Array.isArray(data.result))) throw new Error('Unexpected upstream nearest-postcode response');
      const rows = data.result || [];
      if (rows.some((r) => !object(r) || typeof r.postcode !== 'string' || !Number.isFinite(r.distance) || r.distance < 0)) throw new Error('Unexpected upstream nearest-postcode record');
      return ok(rows.slice(0, limit).map((r) => ({ postcode: r.postcode, distance_m: Math.round(r.distance), council: r.admin_district })));
    }
    const division = args.division === undefined ? 'england-and-wales' : args.division;
    if (!DIVISIONS.includes(division)) return fail('Invalid bank-holiday division');
    const data = await getJSON('https://www.gov.uk/bank-holidays.json', options);
    const events = data?.[division]?.events;
    if (!Array.isArray(events) || !events.every(validEvent)) throw new Error('Unexpected upstream bank-holiday response');
    const today = londonDate(options.now ? options.now() : new Date());
    return ok({ division, upcoming: events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8) });
  } catch (error) { return fail(error.message || 'Upstream request failed'); }
}

module.exports = { TOOLS, runTool, getJSON, ok, fail, londonDate };
