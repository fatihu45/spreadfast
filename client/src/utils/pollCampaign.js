// A separate deadline also ends polling when a request never settles.
export function pollCampaign({ check, onConfirmed, onExpired, onProgress = () => {}, interval = 5000, timeout = 300000, immediate = false }) {
  let stopped = false, next, deadline;
  const started = Date.now();
  function cancel() { stopped = true; clearTimeout(next); clearTimeout(deadline); }
  deadline = setTimeout(() => { if (!stopped) { cancel(); onExpired(); } }, timeout);
  async function tick() {
    try {
      const data = await check();
      if (stopped) return;
      if (data?.success && data.campaignCreated && data.campaign?.id) {
        cancel(); await onConfirmed(data.campaign); return;
      }
    } catch { /* Retry transient failures within the same deadline. */ }
    if (!stopped) { onProgress(Math.floor((Date.now() - started) / 1000)); next = setTimeout(tick, interval); }
  }
  next = setTimeout(tick, immediate ? 0 : interval);
  return cancel;
}
