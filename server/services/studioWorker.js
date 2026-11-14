const { randomUUID } = require('node:crypto');
const cloudinaryDefault = require('cloudinary').v2;
const { resolveModelReference } = require('./fashionModels');
const { MODELS } = require('../config/studios');
const { providerUrl, imagePrompt, motionPrompt, narration } = require('./studioInputs');
const { runQueuedFalJob } = require('./aiCommercialProviders');
const { finishGeneration, failGeneration } = require('./quickAdCredits');
const { storeVideo, assembleVideos, PREVIEW_TRANSFORMATION } = require('./quickAdMedia');
const { renderBranding } = require('./quickAdBranding');
const plain = value => value?.toObject ? value.toObject() : value;
const LEASE_MS = 18 * 60 * 1000;
async function claim(DB, id, now = Date.now(), provider = 'studios') {
  return DB.withTransaction(async tx => {
    const job = plain(await tx.QuickAdGeneration.findOne({ id, provider }));
    if (!job || job.status !== 'pending' || job.deletedAt || (provider === 'studios' && !job.studioInput) || job.stage === 'awaiting_approval' || new Date(job.workerUntil || 0).getTime() > now) return null;
    if (new Date(job.expiresAt).getTime() <= now) return null;
    const executionId = randomUUID(), workerUntil = new Date(now + LEASE_MS);
    await tx.QuickAdGeneration.updateOne({ id, status: 'pending' }, { $set: { executionId, workerUntil }, $inc: { workerAttempts: 1 } });
    return { ...job, executionId, workerUntil, workerAttempts: (job.workerAttempts || 0) + 1 };
  });
}
function createProcessor({ cloudinary = cloudinaryDefault, getFal, queue = runQueuedFalJob, persistVideo = storeVideo, assemble = assembleVideos, brand = renderBranding, speechFetch = fetch, planVehicle = require('./autoStudioPlan').createVehiclePlan, persistImage = async (client, url, id) => client.uploader.upload(providerUrl(url), {resource_type:'image',public_id:id,overwrite:false,timeout:60000}) } = {}) {
  return async function processJob(DB, job) {
    const signal = AbortSignal.timeout(15 * 60 * 1000);
    const save = async fields => {
      signal.throwIfAborted();
      const result = await DB.QuickAdGeneration.updateOne({ id: job.id, userId: job.userId, status: 'pending', executionId: job.executionId }, { $set: fields });
      if (!result.matchedCount) throw new Error('Job ownership changed');
      Object.assign(job, fields);
    };
    const input = job.studioInput;
    const assets = job.studioAssets || {};
    const costs = job.providerCosts || { imageGeneration: 0, videoGeneration: 0, voiceGeneration: 0, other: 0 };
    let fal;
    async function client() {
      if (!fal) {
        if (getFal) fal = await getFal();
        else {
          const { createFalClient } = await import('@fal-ai/client');
          const { singleSubmissionFetch } = require('./aiCommercialProviders');
          fal = createFalClient({ credentials: process.env.FAL_KEY, fetch: singleSubmissionFetch });
        }
      }
      return fal;
    }
    async function stageAsset(key, model, payload, kind, estimate) {
      const asset = assets[key] ||= { model };
      if (asset.url) {
        if (kind === 'imageGeneration' && !asset.storedUrl) {
          const stored = await persistImage(cloudinary,asset.url,`spreadfast/studios/${job.id}-${key}`);
          asset.storedUrl = providerUrl(stored.secure_url); asset.publicId = stored.public_id;
          await save({studioAssets:assets});
        }
        return asset.storedUrl || asset.url;
      }
      if (asset.submitting && !asset.requestId) throw Object.assign(new Error('Provider submission needs reconciliation'), { reconcile: true });
      if (!asset.requestId) {
        asset.submitting = true;
        costs[kind] += estimate;
        await save({ studioAssets: assets, providerCosts: costs, estimatedTotalCost: Object.values(costs).reduce((a,b) => a+b,0) });
      }
      const result = await queue(await client(), model, payload, { signal, requestId: asset.requestId,
        onSubmitted: async id => { asset.requestId = id; await save({ studioAssets: assets }); } });
      asset.url = providerUrl(result.data?.video?.url || result.data?.images?.[0]?.url);
      asset.submitting = false;
      await save({ studioAssets: assets });
      if (kind === 'imageGeneration') {
        const stored = await persistImage(cloudinary,asset.url,`spreadfast/studios/${job.id}-${key}`);
        asset.storedUrl = providerUrl(stored.secure_url); asset.publicId = stored.public_id;
        await save({studioAssets:assets});
      }
      return asset.storedUrl || asset.url;
    }
    const sources = job.sourceImageUrls.map(providerUrl);
    if (input.mode === 'auto_voiceover' && !job.autoPlan) {
      await save({stage:'preparing_images'});
      const autoPlan = await planVehicle(input,sources.length,signal);
      await save({autoPlan});
    }
    const modelFashion = !!input.modelId;
    let images = [];
    if (modelFashion) {
      await save({ stage: 'generating_images' });
      if (!assets.modelReference) {
        assets.modelReference = { url: await resolveModelReference(cloudinary, input) };
        await save({ studioAssets: assets });
      }
      const url = await stageAsset('tryon', MODELS.tryon, { model_image: providerUrl(assets.modelReference.url), garment_image: sources[0], category: 'auto', mode: 'quality', num_samples: 1, output_format: 'png' }, 'imageGeneration', .075);
      images = [url];
      await save({ imageUrl: url });
      if (!job.approvedAt) { await save({ stage: 'awaiting_approval', workerUntil: new Date(0) }); return; }
    } else {
      const count = input.mode.startsWith('auto_') ? (input.mode === 'auto_voiceover' ? 3 : 2) : input.mode === 'fashion_mannequin' ? 2 : 1;
      for (let i = 0; i < count; i++) {
        if (input.mode.startsWith('auto_') && !input.enhance) { images.push(sources[job.autoPlan?.sceneOrder?.[i] ?? (i % sources.length)]); continue; }
        await save({ stage: 'generating_images' });
        const refs = input.mode.startsWith('auto_') ? [sources[job.autoPlan?.sceneOrder?.[i] ?? (i % sources.length)]] : i === 1 ? [sources[1], sources[0]] : sources;
        images.push(await stageAsset(`image${i}`, MODELS.image, { prompt: imagePrompt(input,i), image_urls: refs, num_images: 1, aspect_ratio: '9:16', resolution: '1K', output_format: 'png', limit_generations: true }, 'imageGeneration', .08));
      }
      await save({ imageUrl: images[0] });
    }
    const clipCount = input.mode.startsWith('auto_') ? images.length : 1;
    const clips = [];
    for (let i = 0; i < clipCount; i++) {
      await save({ stage: 'generating_video' });
      const duration = modelFashion ? job.outputDurationSeconds : 5;
      const modern = job.model === MODELS.motion;
      const payload = { [modern ? 'start_image_url' : 'image_url']: images[i], prompt: `${motionPrompt(input)} ${job.autoPlan?.shots?.[i] ? `Camera direction: ${job.autoPlan.shots[i]}.` : ''}`, duration: String(duration), ...(modern ? { generate_audio: false } : {}), ...(input.mode === 'fashion_mannequin' ? { tail_image_url: images[1] } : {}) };
      const url = await stageAsset(`video${i}`, job.model, payload, 'videoGeneration', modern ? duration * .084 : .35);
      const asset = assets[`video${i}`];
      if (!asset.media) { asset.media = await persistVideo(cloudinary, url, { id: `${job.id}-clip-${i}`, freePreview: job.freePreview }, signal); await save({ studioAssets: assets }); }
      clips.push({ publicId: asset.media.publicId, durationSeconds: duration });
    }
    let media = job.media;
    if (!media?.publicId) {
      await save({ stage: 'assembling_video' });
      media = clips.length === 1 ? assets.video0.media : await assemble(cloudinary, clips, job.id, input.vehicle?.dealership || '');
      await save({ media });
    }
    if (input.mode === 'auto_voiceover' && !assets.voice?.applied) {
      await save({ stage: 'generating_voiceover' });
      const voice = assets.voice ||= {};
      if (!voice.publicId) {
        if (voice.submitting) throw Object.assign(new Error('Speech submission needs reconciliation'), { reconcile: true });
        const script = job.autoPlan?.script || narration(input);
        if (script.split(/\s+/).length > 32 || script.length > 230) throw Object.assign(new Error('Vehicle details are too long for 15-second narration'), { terminal: true });
        voice.submitting = true;
        costs.voiceGeneration += script.length * .00008;
        await save({ studioAssets: assets, providerCosts: costs, estimatedTotalCost: Object.values(costs).reduce((a,b)=>a+b,0) });
        const response = await speechFetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(process.env.ELEVENLABS_VOICE_ID)}/with-timestamps?output_format=mp3_44100_128`, { method: 'POST', signal, headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: script, model_id: 'eleven_multilingual_v2' }) });
        if (!response.ok) throw new Error('Voice generation unavailable');
        const data = await response.json();
        const ends = data.alignment?.character_end_times_seconds;
        const duration = Array.isArray(ends) ? Math.max(...ends) : NaN;
        if (!Number.isFinite(duration) || duration <= 0 || duration > 14.5 || typeof data.audio_base64 !== 'string' || data.audio_base64.length > 4000000) throw Object.assign(new Error('Voice timing could not be verified'), { reconcile: true });
        const audio = await new Promise((resolve,reject) => {
          const stream = cloudinary.uploader.upload_stream({ resource_type: 'video', type: 'authenticated', public_id: `spreadfast/studios/${job.id}-voice`, overwrite: false }, (e,r) => e ? reject(e) : resolve(r));
          stream.on('error',reject); stream.end(Buffer.from(data.audio_base64,'base64'));
        });
        if (!audio.public_id || !Number.isFinite(audio.duration) || audio.duration <= 0 || audio.duration > 15) throw Object.assign(new Error('Audio duration could not be verified'), {reconcile:true});
        voice.publicId = audio.public_id; voice.duration = audio.duration; voice.submitting = false;
        await save({ studioAssets: assets });
      }
      const transformation = [...(media.transformations || []), { overlay: `video:authenticated:${voice.publicId.replace(/\//g,':')}` }, { flags: 'layer_apply', start_offset: 0 }];
      const result = await cloudinary.uploader.explicit(media.publicId, { resource_type: 'video', type: 'authenticated', eager: [{ transformation, format: 'mp4' }], eager_async: false });
      if (!result.eager?.[0]?.secure_url || result.eager[0].error) throw new Error('Narration assembly failed');
      media = { ...media, transformations: transformation, outputUrl: cloudinary.url(media.publicId, { resource_type: 'video', type: 'authenticated', format: 'mp4', transformation, sign_url: true, secure: true }) };
      media.originalOutputUrl = media.outputUrl; voice.applied = true;
      await save({ media, studioAssets: assets });
    }
    if (job.branding?.mode !== 'none' && job.brandingStatus !== 'applied') {
      await save({ stage: 'applying_branding' });
      media = await brand(cloudinary, { ...job, media }, job.branding, PREVIEW_TRANSFORMATION);
      await save({ media, brandingStatus: 'applied' });
    }
    await finishGeneration(DB, { userId: job.userId, id: job.id, executionId: job.executionId, imageUrl: images[0], media, brandingStatus: job.branding?.mode === 'none' ? 'none' : 'applied' });
  };
}
async function runOne(DB, id, processJob = createProcessor()) {
  const job = await claim(DB, id);
  if (!job) return false;
  try { await processJob(DB, job); }
  catch (error) {
    // Never resubmit ambiguous provider calls; all retries retain checkpointed IDs.
    if (job.workerAttempts >= 3 || error.reconcile || error.terminal || error.providerTerminal) {
      await failGeneration(DB, { userId: job.userId, id: job.id, executionId: job.executionId, code: error.reconcile ? 'RECONCILIATION_REQUIRED' : 'STUDIO_STAGE_FAILED' });
    } else await DB.QuickAdGeneration.updateOne({ id: job.id, executionId: job.executionId, status: 'pending' }, { $set: { workerUntil: new Date(Date.now() + 30000) } });
  }
  return true;
}
function startStudioWorker(DB, connected, env = process.env) {
  if (env.STUDIO_WORKER_ENABLED !== 'true') return () => {};
  let busy = false, stopped = false;
  const tick = async () => {
    if (busy || stopped || !connected()) return;
    busy = true;
    try {
      const rows = await DB.QuickAdGeneration.find({ provider: 'studios', status: 'pending' }).sort({ createdAt: 1 }).limit(100);
      for (const row of rows) {
        if (stopped) break;
        if (new Date(row.expiresAt).getTime() <= Date.now()) await failGeneration(DB, { userId: row.userId, id: row.id, code: 'LEASE_EXPIRED' });
        else if (await runOne(DB,row.id)) break;
      }
    } catch { console.error('[Studios] Worker tick unavailable'); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 5000); timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
module.exports = { createProcessor, claim, runOne, startStudioWorker };
