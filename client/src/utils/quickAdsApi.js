export function quickAdsBaseUrl() {
  const base = process.env.REACT_APP_API_URL?.trim().replace(/\/+$/, '');
  if (!base) throw new Error('Missing API configuration');
  return base;
}
export const quickAdsUrl = path => `${quickAdsBaseUrl()}/api/quick-ads${path}`;
export const quickAdsAuth = token => ({ Authorization: `Bearer ${token}` });
export const canUseQuickAds = role => role === 'company' || role === 'promoter';
export const quickAdsHome = role => role === 'promoter' ? '/promoter/quick-ads' : '/company/quick-ads';
export function generationVideoUrl(data) {
  if (!data?.success || data.status !== 'completed' || typeof data.generationId !== 'string') throw new Error('Missing completed ad');
  if (data.freePreview === true && data.downloadable !== true) {
    const prefix = `/api/quick-ads/generations/${encodeURIComponent(data.generationId)}/preview?token=`;
    if (typeof data.previewPath !== 'string' || !data.previewPath.startsWith(prefix)) throw new Error('Invalid preview');
    return quickAdsBaseUrl() + data.previewPath;
  }
  if (data.downloadable !== true || typeof data.videoUrl !== 'string') throw new Error('Missing video');
  const url = new URL(data.videoUrl);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid video');
  return url.href;
}
export function newGenerationKey() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
