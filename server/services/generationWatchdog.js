const { settleExpired, recoverable } = require('./quickAdRecovery');
const { canRetryFinalization } = require('./aiCommercialRecovery');
// Recover completed provider work after a restart. Never submit a new AI job here.
async function reconcileGeneration(DB, record, recover) {
  const job = await settleExpired(DB, record);
  if (!job || job.status !== 'failed' || job.deletedAt || job.autoRecoveryAttempted) return;
  const commercial = canRetryFinalization(job);
  if (!commercial && !recoverable(job)) return;
  const claim = await DB.QuickAdGeneration.updateOne({ id: job.id, status: 'failed', autoRecoveryAttempted: { $exists: false } }, { $set: { autoRecoveryAttempted: true } });
  if (!claim.modifiedCount) return;
  try { await (commercial ? recover.commercial : recover.quick)(DB, job.userId, job.id); }
  catch { /* Remains available for an owner-initiated retry; no repeated background spend. */ }
}
function startGenerationWatchdog(DB, connected, recover) {
  let busy = false;
  const tick = async () => {
    if (busy || !connected()) return;
    busy = true;
    try {
      const rows = await DB.QuickAdGeneration.find({ status: 'pending', expiresAt: { $lte: new Date() }, deletedAt: { $exists: false } }).sort({ expiresAt: 1 }).limit(25);
      for (const row of rows) await reconcileGeneration(DB, row, recover);
    } catch { console.error('[Generation recovery] Reconciliation unavailable'); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 60000); timer.unref();
  return () => clearInterval(timer);
}
module.exports = { startGenerationWatchdog, reconcileGeneration };
