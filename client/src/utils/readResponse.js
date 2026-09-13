// Keep useful backend errors while tolerating non-JSON proxy responses.
export async function readResponse(response) {
  let data;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) throw new Error(data?.message || data?.error || 'Request failed (HTTP ' + response.status + '). Please try again.');
  if (!data) throw new Error('The server returned an invalid response. Please try again.');
  return data;
}
