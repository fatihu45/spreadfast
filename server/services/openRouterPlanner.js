const { setTimeout: delay } = require('node:timers/promises');

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const string = { type: 'string' };
const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'voiceover', 'scenes', 'endCard', 'accuracyRules'],
  properties: {
    title: string, voiceover: string, endCard: string,
    accuracyRules: { type: 'array', items: string },
    scenes: { type: 'array', minItems: 3, maxItems: 3, items: {
      type: 'object', additionalProperties: false,
      required: ['purpose', 'imagePrompt', 'motionPrompt', 'durationSeconds', 'narration'],
      properties: { purpose: string, imagePrompt: string, motionPrompt: string,
        durationSeconds: { type: 'number', enum: [6, 8] }, narration: string }
    } }
  }
};

function plannerError(code, providerStatus) {
  // Never attach provider messages, response bodies, request headers or customer input.
  return Object.assign(new Error('Commercial planning is temporarily unavailable.'), {
    code, statusCode: 503, ...(providerStatus ? { providerStatus } : {})
  });
}
function statusError(status) {
  const codes = { 400: 'OPENROUTER_REQUEST_INVALID', 401: 'OPENROUTER_AUTH_FAILED',
    402: 'OPENROUTER_INSUFFICIENT_CREDITS', 403: 'OPENROUTER_FORBIDDEN',
    404: 'OPENROUTER_MODEL_UNAVAILABLE', 408: 'OPENROUTER_TIMEOUT',
    429: 'OPENROUTER_RATE_LIMITED', 503: 'OPENROUTER_MODEL_UNAVAILABLE' };
  return plannerError(codes[status] || 'OPENROUTER_UNAVAILABLE', status);
}
function retryDelay(header, attempt) {
  if (!header) return 500 * (2 ** attempt);
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
  return Number.isFinite(ms) ? Math.max(0, ms) : 500 * (2 ** attempt);
}

async function requestCreativeCompletion(body, { signal, fetchImpl = fetch, timeoutMs = 45000, sleep = delay } = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw plannerError('AI_PROVIDER_NOT_CONFIGURED');
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  // Three attempts maximum, within a single job and its existing credit reservation.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (signal?.aborted) throw plannerError('CREATIVE_PLAN_CANCELLED');
    const timeout = AbortSignal.timeout(timeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let error;
    let retryMs = 500 * (2 ** attempt);
    try {
      const response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ ...body, model, stream: false,
          response_format: { type: 'json_schema', json_schema: { name: 'commercial_plan', strict: true, schema: PLAN_SCHEMA } },
          provider: { require_parameters: true }
        }),
        signal: requestSignal
      });
      const payload = await response.json().catch(err => {
        if (requestSignal.aborted) throw err;
        return null;
      });
      if (requestSignal.aborted) requestSignal.throwIfAborted();
      if (response.ok && payload && !payload.error) return payload;
      const status = response.ok ? Number(payload?.error?.code) || 502 : response.status;
      error = statusError(status);
      if (![408, 429, 500, 502, 503, 504].includes(status)) throw error;
      retryMs = retryDelay(response.headers?.get('retry-after'), attempt);
    } catch (cause) {
      if (signal?.aborted) throw plannerError('CREATIVE_PLAN_CANCELLED');
      if (typeof cause.code === 'string' && cause.code.startsWith('OPENROUTER_')) throw cause;
      error = plannerError(timeout.aborted || cause.name === 'TimeoutError' ? 'OPENROUTER_TIMEOUT' : 'OPENROUTER_UNAVAILABLE');
    }
    // Respect long Retry-After values by stopping, rather than retrying prematurely.
    if (attempt === 2 || retryMs > 5000) throw error;
    try { await sleep(retryMs, undefined, signal ? { signal } : {}); }
    catch { throw plannerError('CREATIVE_PLAN_CANCELLED'); }
  }
}
module.exports = { requestCreativeCompletion, DEFAULT_MODEL, PLAN_SCHEMA };
