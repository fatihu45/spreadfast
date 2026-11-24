// Read-only readiness checks. No login, payments, uploads or generation requests.
const [baseInput, originInput] = process.argv.slice(2);
function originOnly(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use an exact HTTP(S) origin, without credentials or a path.');
  return url.origin;
}
async function main() {
  if (!baseInput || !originInput) throw new Error('Usage: node scripts/check-studio-preview.js <backend-origin> <frontend-origin>');
  const base = originOnly(baseInput), origin = originOnly(originInput);
  const headers = { Origin: origin };
  const checks = [
    ['API and database', '/api/health', {}, async response => { const body = await response.json(); return response.ok && body.success === true && body.mongoConnected === true; }],
    ['Studio routes', '/api/studios/catalog', {}, async response => { const body = await response.json(); return response.ok && body.success === true && Array.isArray(body.modes) && body.modes.some(mode => mode.studio === 'fashion') && body.modes.some(mode => mode.studio === 'product'); }],
    ['Preview access', '/api/studios/jobs', { method: 'OPTIONS', headers: { ...headers, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization,Content-Type,Idempotency-Key' } }, async response => {
      const allowed = (response.headers.get('access-control-allow-headers') || '').toLowerCase().split(',').map(value => value.trim());
      return response.ok && response.headers.get('access-control-allow-origin') === origin && response.headers.get('access-control-allow-credentials') === 'true' && ['authorization', 'content-type', 'idempotency-key'].every(value => allowed.includes(value));
    }]
  ];
  const results = await Promise.all(checks.map(async ([name, path, options, valid]) => {
    try {
      const response = await fetch(base + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
      let ok = false; try { ok = await valid(response); } catch { /* Unexpected response shape is a failed readiness check. */ }
      return { check: name, ok, status: response.status };
    } catch { return { check: name, ok: false, error: 'Request failed or timed out' }; }
  }));
  console.log(JSON.stringify({ results }, null, 2));
  if (results.some(result => !result.ok)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
