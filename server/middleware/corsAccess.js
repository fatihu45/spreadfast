const cors = require('cors');

const defaultOrigins = ['http://localhost:3000', 'http://localhost:5173', 'https://tryspreadfast.com', 'https://www.tryspreadfast.com'];

function configuredOrigin(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('CLIENT_URL and CLIENT_ORIGINS must contain exact HTTP or HTTPS origins.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*')) {
    throw new Error('CLIENT_URL and CLIENT_ORIGINS must contain exact HTTP or HTTPS origins.');
  }
  return url.origin;
}
function allowedOrigins(env = process.env) {
  const configured = [env.CLIENT_URL, ...(env.CLIENT_ORIGINS || '').split(',')].filter(value => value?.trim());
  return new Set([...defaultOrigins, ...configured.map(configuredOrigin)]);
}
function createCorsAccess(env = process.env) {
  const allowed = allowedOrigins(env);
  const middleware = cors({
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) return callback(null, true);
      callback(Object.assign(new Error('Origin not permitted'), { code: 'CORS_ORIGIN_DENIED' }));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'Range'],
    exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
  });
  return (req, res, next) => middleware(req, res, error => {
    if (error?.code === 'CORS_ORIGIN_DENIED') return res.status(403).json({ success: false, code: error.code, message: 'This website is not allowed to connect to this API.' });
    return next(error);
  });
}
module.exports = { allowedOrigins, createCorsAccess };
