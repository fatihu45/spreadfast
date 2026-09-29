// Never log HTTP request configuration, response bodies, or credential-bearing messages.
function safeError(error) {
  return {
    code: typeof error?.code === 'string' && /^[A-Z_0-9]{1,60}$/.test(error.code) ? error.code : 'REQUEST_FAILED',
    status: Number.isInteger(error?.response?.status) ? error.response.status : undefined
  };
}
module.exports = { safeError };
