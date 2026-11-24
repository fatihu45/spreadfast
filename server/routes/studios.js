const express = require('express');
const multer = require('multer');
const cloudinaryDefault = require('cloudinary').v2;
const { authenticateToken } = require('../middleware/auth');
const { quickAdAccountOnly } = require('../services/quickAdAccess');
const { MODES, quote, requireMode, presets } = require('../config/studios');
const { validate, providerUrl, narrationSummary, vehicleDetails } = require('../services/studioInputs');
const { beginGeneration, failGeneration } = require('../services/quickAdCredits');
const { readBranding, uploadBranding } = require('../services/quickAdBranding');
const { publicGeneration } = require('../services/quickAdMedia');
const { safeError } = require('./quickAdMedia');
function createStudiosRouter({ authenticate = authenticateToken, cloudinary = cloudinaryDefault, env = process.env } = {}) {
  const router = express.Router();
  router.get('/catalog', (req,res) => res.json({ success: true, modes: Object.keys(MODES).map(mode => quote(mode,env)), models: presets(env) }));
  router.use(authenticate, quickAdAccountOnly);
  router.post('/narration-preview', (req, res) => {
    try { res.json({ success: true, ...narrationSummary({ vehicle: vehicleDetails(req.body || {}) }) }); }
    catch (error) { safeError(res, error); }
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 6, fields: 24, fieldSize: 4096 } }).fields([{ name: 'images', maxCount: 5 }, { name: 'brandingLogo', maxCount: 1 }]);
  const enqueue = async (req,res) => {
    const DB = req.app.locals.db;
    let job;
    try {
      const key = req.get('Idempotency-Key');
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key || '')) throw Object.assign(new Error('A valid request key is required.'), { statusCode:400, quickAdSafe:true });
      const prior = await DB.QuickAdGeneration.findOne({ userId:req.user.id, idempotencyKey:key });
      if (prior) {
        if (prior.deletedAt || prior.generationMode !== req.body.mode) return res.status(409).json({success:false,message:'Use a new request key for a different ad.'});
        return res.json(publicGeneration(prior, await DB.User.findOne({id:req.user.id})));
      }
      const q = requireMode(req.body.mode, env);
      if (env.STUDIO_WORKER_ENABLED !== 'true' || !env.FAL_KEY) throw Object.assign(new Error('This studio is being prepared.'), {statusCode:503,quickAdSafe:true});
      const input = validate(req.body, req.files?.images || [], presets(env));
      if (input.mode === 'auto_voiceover' && !narrationSummary(input).withinLimit) throw Object.assign(new Error('Shorten the sales details to fit a 15-second voiceover (32 words, up to 230 characters).'), {statusCode:400,quickAdSafe:true});
      const recent = await DB.QuickAdGeneration.find({userId:req.user.id,provider:'studios'});
      if (recent.filter(g => new Date(g.createdAt).getTime() > Date.now()-86400000).length >= 5) return res.status(429).json({success:false,message:'Daily generation limit reached. Please try tomorrow.'});
      const branding = readBranding(req.body, req.files?.brandingLogo?.[0]);
      const reserved = await beginGeneration(DB, { userId:req.user.id,key,style:input.mode==='fashion_mannequin'?'fashion_studio':'studio',model:q.video,creditCost:q.credits,allowFreePreview:input.mode==='quick_ad',provider:'studios',leaseMs:86400000 });
      job = reserved.generation;
      await DB.QuickAdGeneration.updateOne({id:job.id},{$set:{generationMode:input.mode,studioType:q.studio,outputDurationSeconds:q.duration,title:input.title,stage:'preparing_images'}});
      const sources=[];
      for (const file of req.files.images) {
        const asset = await new Promise((resolve,reject) => {
          const stream = cloudinary.uploader.upload_stream({ resource_type:'image',public_id:`spreadfast/studios/${job.id}-source-${sources.length}`,overwrite:false,allowed_formats:['jpg','jpeg','png','webp'],timeout:60000 },(e,r)=>e?reject(e):resolve(r));
          stream.on('error',reject); stream.end(file.buffer);
        });
        sources.push(providerUrl(asset.secure_url));
      }
      const uploadedBrand = await uploadBranding(cloudinary,branding,req.files?.brandingLogo?.[0]);
      const fields = {studioInput:input,sourceImageUrls:sources,sourceImageUrl:sources[0],branding:uploadedBrand,stage:'queued',studioType:q.studio,generationMode:input.mode,outputDurationSeconds:q.duration,title:input.title,providerReportedTotalCost:null,currency:'USD'};
      await DB.QuickAdGeneration.updateOne({id:job.id,status:'pending'},{$set:fields});
      return res.status(202).json(publicGeneration({...job,...fields},await DB.User.findOne({id:req.user.id})));
    } catch(error) {
      if(job) await failGeneration(DB,{userId:req.user.id,id:job.id,code:'UPLOAD_FAILED'}).catch(()=>{});
      return safeError(res,error);
    }
  };
  router.post('/jobs', (req,res,next) => upload(req,res,error => error ? res.status(400).json({success:false,message:'Upload up to five JPG, PNG or WEBP images, 8 MB each.'}) : next()), enqueue);
  router.enqueue = enqueue;
  router.post('/jobs/:id/retry',async(req,res)=>{
    try {
      if (env.STUDIO_WORKER_ENABLED !== 'true') throw Object.assign(new Error('Video finishing is temporarily unavailable. Please try again later.'), {statusCode:503,quickAdSafe:true});
      const DB=req.app.locals.db;
      await DB.withTransaction(async tx=>{
        const job=await tx.QuickAdGeneration.findOne({id:req.params.id,userId:req.user.id,provider:'studios'});
        if(!job || job.deletedAt || job.status!=='failed' || !job.media?.publicId || job.studioInput?.mode==='auto_voiceover' && !job.studioAssets?.voice?.applied || (job.finalizationRetries||0)>=2) throw Object.assign(new Error('This job needs support recovery.'),{statusCode:409,quickAdSafe:true});
        const user=await tx.User.findOne({id:req.user.id});
        if(user.quickAdCredits<job.creditCost) throw Object.assign(new Error('Add credits to finish this saved video.'),{statusCode:403,code:'NO_QUICK_AD_CREDITS',quickAdSafe:true});
        if(user.quickAdGenerationLock && new Date(user.quickAdGenerationLockExpiresAt).getTime()>Date.now()) throw Object.assign(new Error('Wait for your current ad to finish.'),{statusCode:409,quickAdSafe:true});
        const expiresAt=new Date(Date.now()+86400000);
        await tx.User.updateOne({id:req.user.id},{$set:{quickAdGenerationLock:job.id,quickAdGenerationLockExpiresAt:expiresAt}});
        await tx.QuickAdGeneration.updateOne({id:job.id,userId:req.user.id,status:'failed'},{$set:{status:'pending',stage:'applying_branding',expiresAt,workerUntil:new Date(0),workerAttempts:0},$inc:{finalizationRetries:1}});
      });
      res.status(202).json({success:true});
    }catch(error){safeError(res,error);}
  });
  router.post('/jobs/:id/approve',async(req,res)=>{
    try {
      const DB=req.app.locals.db;
      const changed=await DB.QuickAdGeneration.updateOne({id:req.params.id,userId:req.user.id,provider:'studios',status:'pending',stage:'awaiting_approval',deletedAt:{$exists:false}},{$set:{approvedAt:new Date(),stage:'queued',workerUntil:new Date(0)}});
      if(!changed.matchedCount) return res.status(409).json({success:false,message:'No try-on is waiting for approval.'});
      res.json({success:true});
    }catch(error){safeError(res,error);}
  });
  router.post('/jobs/:id/cancel',async(req,res)=>{
    try {
      const DB=req.app.locals.db;
      await DB.withTransaction(async tx => {
        const job=await tx.QuickAdGeneration.findOne({id:req.params.id,userId:req.user.id,provider:'studios',status:'pending',stage:'awaiting_approval'});
        if(!job) throw Object.assign(new Error('Only an unapproved try-on can be cancelled here.'),{statusCode:409,quickAdSafe:true});
        await tx.QuickAdGeneration.updateOne({id:job.id,status:'pending',stage:'awaiting_approval'},{$set:{status:'failed',stage:'failed',failureCode:'USER_CANCELLED'}});
        const user=await tx.User.findOne({id:req.user.id});
        if(user?.quickAdGenerationLock===job.id) await tx.User.updateOne({id:req.user.id},{$set:{quickAdGenerationLock:null,quickAdGenerationLockExpiresAt:null}});
      });
      res.json({success:true});
    }catch(error){safeError(res,error);}
  });
  return router;
}
module.exports={createStudiosRouter};
