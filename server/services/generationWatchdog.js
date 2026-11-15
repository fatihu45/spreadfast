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
async function reconcileBatch(DB, recover) {
  const expired = await DB.QuickAdGeneration.find({ status: 'pending', expiresAt: { $lte: new Date() }, deletedAt: { $exists: false } }).sort({ expiresAt: 1 }).limit(25);
  for (const row of expired) await reconcileGeneration(DB, row, recover);
  // Include jobs that failed before their lease expired, including previous restarts.
  // Filter for saved provider work so unrecoverable jobs cannot starve the queue.
  const failed = await DB.QuickAdGeneration.find({ status: 'failed', deletedAt: { $exists: false }, autoRecoveryAttempted: { $exists: false },
    $or: [
      { provider: { $ne: 'ai-commercials' }, 'media.publicId': { $type: 'string', $ne: '' } },
      { provider: { $ne: 'ai-commercials' }, videoRequestId: { $type: 'string', $ne: '' } },
      { provider: 'ai-commercials', freePreview: false, sceneAssets: { $size: 3 },
        ...Object.fromEntries([0, 1, 2].flatMap(i => ['videoPublicId', 'imageUrl'].map(field => [`sceneAssets.${i}.${field}`, { $type: 'string', $ne: '' }]))) }
    ]
  }).sort({ updatedAt: 1 }).limit(25);
  for (const row of failed) await reconcileGeneration(DB, row, recover);
}
function startGenerationWatchdog(DB, connected, recover) {
  let busy = false;
  const tick = async () => {
    if (busy || !connected()) return;
    busy = true;
    try {
      await reconcileBatch(DB, recover);
    } catch { console.error('[Generation recovery] Reconciliation unavailable'); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 60000); timer.unref();
  return () => clearInterval(timer);
}
module.exports = { startGenerationWatchdog, reconcileGeneration, reconcileBatch };
