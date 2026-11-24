export function jobStatus(job) {
  if (job?.cancelled) return 'Cancelled';
  if (job?.status === 'failed') return 'Could not finish';
  return ({ queued: 'Waiting to start', preparing_image: 'Planning your ad', preparing_images: 'Preparing your photos',
    generating_images: 'Creating your preview', creating_scene: 'Creating scene images', awaiting_approval: 'Review your outfit',
    generating_video: 'Creating your video', creating_video: 'Animating your ad', generating_voiceover: 'Adding voiceover',
    assembling_video: 'Putting your video together', finalizing: 'Finishing your video', applying_branding: 'Adding your branding',
    completed: 'Ready to download' })[job?.stage] || 'Preparing your ad';
}
export function jobProgress(job) {
  if (job?.status === 'completed') return 100;
  return ({ queued: 6, preparing_image: 16, preparing_images: 16, generating_images: 32, creating_scene: 35,
    awaiting_approval: 40, generating_video: 65, creating_video: 65, assembling_video: 82, generating_voiceover: 88,
    finalizing: 92, applying_branding: 96 })[job?.stage] || 6;
}
export function recoveryPath(job) {
  const id = encodeURIComponent(job.generationId);
  if (job.studioRetryAvailable) return `/api/studios/jobs/${id}/retry`;
  if (job.commercialRetryAvailable || job.finalizationRetryAvailable) return `/api/ai-commercials/jobs/${id}/retry`;
  if (job.recoveryAvailable) return `/api/quick-ads/generations/${id}/retry`;
  if (job.brandingRetryAvailable) return `/api/quick-ads/generations/${id}/branding/retry`;
  return null;
}
export function progressPath(job) {
  const id = encodeURIComponent(job.generationId);
  if (job.studioType === 'commercial' || job.provider === 'ai-commercials') return `/ai-commercials?job=${id}`;
  if (job.provider === 'studios' || job.generationMode) return `/studios/${job.studioType}?job=${id}`;
  return `/quick-ad?job=${id}`;
}
