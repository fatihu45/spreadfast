import React, { useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Alert, Button } from '../components/ui';
import UiIcon from '../components/ui/UiIcon';
import { quickAdsUrl, quickAdsAuth, generationVideoUrl, newGenerationKey, canUseQuickAds } from '../utils/quickAdsApi';
import QuickAdBranding, { appendBranding } from '../components/QuickAdBranding';
import QuickAdHistoryVideo from '../components/QuickAdHistoryVideo';
import './QuickAd.css';
import './QuickAdCredits.css';

const styles = [
  { id: 'food', name: 'Food Burst', description: 'Make food look fresh and irresistible.', image: '/dynamic_grilled_salmon_bowl_with_lemon_splash.png', caption: 'Fresh energy' },
  { id: 'reveal', name: 'Product Reveal', description: 'A cinematic product reveal.', image: '/luxury_amber_perfume_spotlight.png', caption: 'In the spotlight' },
  { id: 'studio', name: 'Clean Studio', description: 'Simple, premium product motion.', image: '/luxury_skincare_bottle_in_soft_beige_studio.png', caption: 'Less. But better.' },
  { id: 'social', name: 'Attention Grabber', description: 'Fast movement made for social media.', image: '/energetic_citrus_juice_splash.png', caption: 'Make them look.' },
  { id: 'fashion_studio', name: 'Fashion Studio', description: 'Front & back photos into a clean fashion ad.', image: '/fashion-studio-kaftan.png', caption: 'Front to back.' },
];
const GENERATION_ERROR = "We couldn't generate your advert. Please try again.";

export default function QuickAd() {
  const location = useLocation();
  const { token, user } = useContext(AuthContext);
  const canGenerate = canUseQuickAds(user?.role);
  const canStartCampaign = user?.role === 'company';
  const navigate = useNavigate();
  const [branding, setBranding] = useState({ mode: 'none' });
  const [editingBranding, setEditingBranding] = useState(false);
  const [editBranding, setEditBranding] = useState({ mode: 'none' });
  const [brandingDirty, setBrandingDirty] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingError, setBrandingError] = useState('');
  const [product, setProduct] = useState(null);
  const [frontPhoto, setFrontPhoto] = useState(null);
  const [backPhoto, setBackPhoto] = useState(null);
  const [styleId, setStyleId] = useState('food');
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [result, setResult] = useState(null);
  const [generationStage, setGenerationStage] = useState('queued');
  const [stageImage, setStageImage] = useState('');
  const [history, setHistory] = useState([]);
  const [historyStatus, setHistoryStatus] = useState('loading');
  const [historyError, setHistoryError] = useState('');
  const [historyActionError, setHistoryActionError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const deletedHistoryIds = useRef(new Set());
  const [balance, setBalance] = useState(null);
  const storageKey = `spreadfast-quick-ad-generation:${user?.id}`;
  const [pendingKey, setPendingKey] = useState(() => { try { return sessionStorage.getItem(storageKey) || ''; } catch { return ''; } });
  const [saving, setSaving] = useState(false);
  const request = useRef(null);
  const download = useRef(null);
  const downloadUrls = useRef([]);
  const previewPanel = useRef(null);
  const isFashionStyle = styleId === 'fashion_studio';
  const generating = phase === 'generating';
  const ready = phase === 'ready';
  const downloadable = ready && result?.downloadable === true;
  const outOfCredits = balance && !balance.freePreviewAvailable && balance.quickAdCredits < 1;
  const buyCredits = () => navigate('/quickads/credits', { state: { outOfCredits } });
  const stageSteps = [
    { key: 'preparing_image', label: 'Preparing your product' },
    { key: 'creating_scene', label: 'Building your commercial scene' },
    { key: 'creating_video', label: 'Adding cinematic motion' },
    { key: 'finalizing', label: 'Finishing your Quick Ad' },
    { key: 'completed', label: 'Your Quick Ad is ready' },
  ];
  const normalizedStage = generationStage === 'queued' ? 'preparing_image' : generationStage;
  const currentStageIndex = Math.max(0, stageSteps.findIndex(step => step.key === normalizedStage));
  const stageLabel = stageSteps.find(step => step.key === normalizedStage)?.label || stageSteps[0].label;
  const previewImage = stageImage || (isFashionStyle ? frontPhoto?.url : product?.url) || null;
  const hasRequiredPhotos = isFashionStyle ? !!(frontPhoto?.file && backPhoto?.file) : !!product?.file;

  useEffect(() => {
    if (!generating || !window.matchMedia?.('(max-width: 759px)').matches) return;
    const panel = previewPanel.current;
    if (!panel || typeof panel.scrollIntoView !== 'function') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [generating]);
  useEffect(() => {
    if (!canGenerate) return undefined;
    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await axios.get(quickAdsUrl('/credits'), { headers: quickAdsAuth(token), signal: controller.signal, timeout: 15000 });
        if (!data?.success || !Number.isSafeInteger(data.quickAdCredits) || data.quickAdCredits < 0 || typeof data.freePreviewAvailable !== 'boolean') throw new Error('Invalid balance');
        if (!controller.signal.aborted) setBalance(data);
      }
      catch { if (!controller.signal.aborted) setError('Could not load your credits. Refresh this page to try again.'); }
    })();
    return () => controller.abort();
  }, [canGenerate, token]);
  function rememberKey(key) {
    setPendingKey(key);
    try { if (key) sessionStorage.setItem(storageKey, key); else sessionStorage.removeItem(storageKey); } catch { /* Current-page duplicate protection remains active. */ }
  }
  function showResult(data) {
    setEditingBranding(false); setBrandingError('');
    setVideoUrl(generationVideoUrl(data)); setResult(data); setBalance(data); setPhase('ready'); setGenerationStage(data?.stage || 'completed');
    setStageImage(data?.commercialImage?.url || data?.imageUrl || ''); rememberKey('');
    loadHistory();
  }
  async function recover() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setSaving(true);
    try {
      const { data } = await axios.get(quickAdsUrl(`/requests/${encodeURIComponent(pendingKey)}`), { headers: quickAdsAuth(token), signal: controller.signal, timeout: 20000 });
      if (controller.signal.aborted) return;
      setGenerationStage(data?.stage || (data.status === 'completed' ? 'completed' : 'queued'));
      if (data?.commercialImage?.url || data?.imageUrl) setStageImage(data.commercialImage?.url || data.imageUrl);
      if (data.status === 'completed') { showResult(data); setError(''); }
      else if (data.status === 'failed') { rememberKey(''); setStageImage(''); setError(GENERATION_ERROR); }
      else { setPhase('generating'); setError(''); }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if ([404, 410].includes(failure.response?.status)) rememberKey('');
        setError('We could not retrieve a completed ad. Please try again.');
      }
    } finally { if (request.current === controller) request.current = null; if (!controller.signal.aborted) setSaving(false); }
  }

  useEffect(() => {
    if (!canGenerate || !token || !pendingKey || phase !== 'generating') return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await axios.get(quickAdsUrl(`/requests/${encodeURIComponent(pendingKey)}`), { headers: quickAdsAuth(token), timeout: 15000 });
        if (cancelled || !data) return;
        setGenerationStage(data?.stage || (data.status === 'completed' ? 'completed' : 'queued'));
        if (data?.commercialImage?.url || data?.imageUrl) setStageImage(data.commercialImage?.url || data.imageUrl);
        if (data.status === 'completed') { showResult(data); }
        else if (data.status === 'failed') { rememberKey(''); setStageImage(''); setPhase('idle'); setError(GENERATION_ERROR); }
      } catch (failure) {
        if (cancelled) return;
        if (failure.response?.status === 410) {
          rememberKey(''); setPhase('idle'); setStageImage('');
          setError('This generation expired. No credit was used. Please try again.');
        }
      }
    };
    poll();
    const id = window.setInterval(poll, 2500);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [canGenerate, token, pendingKey, phase]);

  useEffect(() => {
    if (location.hash === '#quick-ad-history-title' && historyStatus === 'loaded') {
      document.getElementById('quick-ad-history-title')?.scrollIntoView?.({ block: 'start' });
    }
  }, [location.hash, historyStatus]);

  async function loadHistory() {
    if (!canGenerate || !token) return;
    setHistoryStatus('loading');
    setHistoryError('');
    try {
      const { data } = await axios.get(quickAdsUrl('/generations'), { headers: quickAdsAuth(token), timeout: 20000 });
      if (!data?.success || !Array.isArray(data.generations)) throw new Error('Invalid Quick Ads history response');
      setHistory(data.generations.filter(item => !deletedHistoryIds.current.has(item.generationId)));
      setHistoryStatus('loaded');
    } catch {
      setHistoryError('We could not load your Quick Ads. Please try again.');
      setHistoryStatus('error');
    }
  }

  async function deleteHistoryItem(item) {
    if (brandingSaving || deletingId || item.status === 'pending') return;
    if (!window.confirm('Delete this video from My Quick Ads? Credits will not be refunded. Videos already used in campaigns will remain available.')) return;
    setDeletingId(item.generationId);
    setHistoryActionError('');
    try {
      const { data } = await axios.delete(quickAdsUrl(`/generations/${encodeURIComponent(item.generationId)}`), {
        headers: quickAdsAuth(token), timeout: 20000,
      });
      if (!data?.success) throw new Error('Delete failed');
      deletedHistoryIds.current.add(item.generationId);
      setHistory(previous => previous.filter(row => row.generationId !== item.generationId));
      if (result?.generationId === item.generationId) {
        setResult(null); setVideoUrl(''); setStageImage(''); setPhase('idle');
      }
    } catch {
      setHistoryActionError('Could not delete that Quick Ad. Please try again.');
    } finally { setDeletingId(null); }
  }

  async function downloadHistoryItem(item) {
    if (!item.downloadable || saving) return;
    setSaving(true);
    setHistoryActionError('');
    try {
      const { data } = await axios.get(quickAdsUrl(`/generations/${encodeURIComponent(item.generationId)}/download`), {
        headers: quickAdsAuth(token), responseType: 'blob', timeout: 60000,
      });
      if (!data.size) throw new Error('Empty video');
      const objectUrl = URL.createObjectURL(data);
      downloadUrls.current.push(objectUrl);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'spreadfast-quick-ad.mp4';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setHistoryActionError('Could not download that Quick Ad. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!canGenerate || !token) return undefined;
    loadHistory();
    return undefined;
  }, [canGenerate, token]);

  useEffect(() => () => {
    request.current?.abort();
    download.current?.abort();
    downloadUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    if (!product) return undefined;
    return () => URL.revokeObjectURL(product.url);
  }, [product]);
  useEffect(() => {
    if (!frontPhoto) return undefined;
    return () => URL.revokeObjectURL(frontPhoto.url);
  }, [frontPhoto]);
  useEffect(() => {
    if (!backPhoto) return undefined;
    return () => URL.revokeObjectURL(backPhoto.url);
  }, [backPhoto]);

  function reset() {
    request.current?.abort();
    request.current = null;
    download.current?.abort();
    download.current = null;
    setSaving(false);
    setVideoUrl('');
    setResult(null);
    setStageImage('');
    setGenerationStage('queued');
    setPhase('idle');
    setNotice('');
  }

  function selectPhoto(files) {
    if (generating || brandingSaving || !files?.length) return;
    if (files.length !== 1) { setError('Please choose one product photo.'); return; }
    const file = files[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WEBP image.'); return;
    }
    if (!file.size || file.size > 8 * 1024 * 1024) {
      setError('Choose a non-empty image up to 8 MB.'); return;
    }
    reset();
    setError('');
    setProduct({ file, name: file.name, url: URL.createObjectURL(file) });
  }

  function selectFashionPhoto(slot, files) {
    if (generating || brandingSaving || !files?.length) return;
    if (files.length !== 1) { setError('Please choose exactly one outfit photo.'); return; }
    const file = files[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WEBP image for both outfit photos.'); return;
    }
    if (!file.size || file.size > 8 * 1024 * 1024) {
      setError('Choose a non-empty image up to 8 MB for each outfit photo.'); return;
    }
    reset();
    setError('');
    const next = { file, name: file.name, url: URL.createObjectURL(file) };
    if (slot === 'front') setFrontPhoto(prev => { if (prev?.url) URL.revokeObjectURL(prev.url); return next; });
    else setBackPhoto(prev => { if (prev?.url) URL.revokeObjectURL(prev.url); return next; });
  }

  function removePhoto() { reset(); setProduct(null); setError(''); }
  function removeFashionPhoto(slot) {
    reset();
    if (slot === 'front') setFrontPhoto(prev => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
    else setBackPhoto(prev => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
    setError('');
  }

  async function editHistoryBranding(item) {
    if (saving || brandingSaving || generating || pendingKey || item.status !== 'completed') return;
    setSaving(true); setHistoryActionError('');
    try {
      const { data } = await axios.get(quickAdsUrl(`/generations/${encodeURIComponent(item.generationId)}`), { headers: quickAdsAuth(token), timeout: 20000 });
      showResult(data); setEditBranding(data.branding || { mode: 'none' }); setBrandingDirty(false); setEditingBranding(true);
      previewPanel.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch { setHistoryActionError('Could not open this video. Please try again.'); }
    finally { setSaving(false); }
  }

  async function saveBranding() {
    if (!result?.generationId || brandingSaving) return;
    const generationId = result.generationId;
    setBrandingError('');
    try {
      const form = new FormData(); appendBranding(form, editBranding);
      setBrandingSaving(true);
      const { data } = await axios.patch(quickAdsUrl(`/generations/${encodeURIComponent(generationId)}/branding`), form,
        { headers: quickAdsAuth(token), timeout: 180000 });
      showResult(data);
      setNotice('Branding updated. No generation credit was used.');
    } catch (failure) {
      setBrandingError(failure.response?.data?.message || (failure.response ? 'Could not update branding. Please try again.' : failure.message));
    } finally { setBrandingSaving(false); }
  }

  async function generate() {
    if (!canGenerate) return;
    if (generating || request.current || pendingKey || !balance) return;
    if (outOfCredits) { buyCredits(); return; }
    if (isFashionStyle) {
      if (!frontPhoto?.file || !backPhoto?.file) {
        setError('Please add both the front and back outfit photos.');
        return;
      }
    } else if (!product?.file) {
      setError('Please add a product photo first.');
      return;
    }
    try { appendBranding(new FormData(), branding); } catch (failure) { setError(failure.message); return; }
    const controller = new AbortController();
    request.current = controller;
    setError(''); setNotice(''); setPhase('generating'); setGenerationStage('queued');
    setStageImage('');
    setVideoUrl('');
    setResult(null);
    try {
      const baseUrl = process.env.REACT_APP_API_URL?.trim().replace(/\/+$/, '');
      if (!baseUrl || !token) throw new Error('Missing API configuration or session');
      const form = new FormData();
      if (isFashionStyle) {
        form.append('frontImage', frontPhoto.file);
        form.append('backImage', backPhoto.file);
      } else {
        form.append('image', product.file);
      }
      form.append('style', styleId);
      appendBranding(form, branding);
      const key = newGenerationKey(); rememberKey(key);
      const { data } = await axios.post(`${baseUrl}/api/quick-ads/generate`, form, {
        headers: { ...quickAdsAuth(token), 'Idempotency-Key': key },
        // Allow the existing backend's ten-minute generation deadline.
        timeout: 11 * 60 * 1000,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      showResult(data);
    } catch (failure) {
      if (!controller.signal.aborted) {
        const status = failure.response?.status;
        const timedOut = status === 504 || ['ECONNABORTED', 'ETIMEDOUT'].includes(failure?.code);
        // Definitive server failures release the generation reservation. Clear the
        // idempotency key so the user can retry with the same selected product/logo.
        // Keep it on timeouts/network drops because the server may still be working.
        if (!timedOut && [400, 401, 403, 413, 422, 502, 503].includes(status)) rememberKey('');
        if (failure.response?.data?.code === 'NO_QUICK_AD_CREDITS') { navigate('/quickads/credits', { state: { outOfCredits: true } }); }
        setError(timedOut
          ? 'Your advert is taking longer than expected and may still be processing. Please check its status before trying again to avoid creating a duplicate advert.'
          : GENERATION_ERROR);
        if (!timedOut && [400, 413, 422, 502, 503].includes(status)) {
          setNotice(branding.mode === 'logo'
            ? 'No credit was used. Your product photo and attached logo are still selected. Tap Generate Quick Ad to retry.'
            : 'No credit was used. Your product photo is still selected. Tap Generate Quick Ad to retry.');
        }
        setStageImage('');
        setPhase('idle');
      }
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  async function startCampaign() {
    if (!canStartCampaign || !downloadable || download.current) return;
    const controller = new AbortController(); download.current = controller; setSaving(true);
    try {
      const { data } = await axios.get(quickAdsUrl(`/generations/${result.generationId}/export`), { headers: quickAdsAuth(token), signal: controller.signal, timeout: 20000 });
      if (!controller.signal.aborted && data.success) navigate('/company#create-campaign', { state: { quickAd: { videoUrl: data.videoUrl, imageUrl: data.imageUrl } } });
    } catch { if (!controller.signal.aborted) setNotice('Could not prepare your ad for a campaign. Please try again.'); }
    finally { if (download.current === controller) download.current = null; if (!controller.signal.aborted) setSaving(false); }
  }
  async function previewAgain() {
    if (!result?.freePreview || download.current) return;
    const controller = new AbortController(); download.current = controller; setSaving(true);
    try {
      const { data } = await axios.get(quickAdsUrl(`/generations/${result.generationId}`), { headers: quickAdsAuth(token), signal: controller.signal, timeout: 20000 });
      if (!controller.signal.aborted) { showResult(data); setNotice('Tap play to preview your ad again.'); }
    } catch { if (!controller.signal.aborted) setNotice('Could not load the preview. Please try again.'); }
    finally { if (download.current === controller) download.current = null; if (!controller.signal.aborted) setSaving(false); }
  }

  async function saveVideo() {
    if (!downloadable || download.current) return;
    const controller = new AbortController();
    download.current = controller;
    setSaving(true); setNotice('');
    try {
      const { data } = await axios.get(quickAdsUrl(`/generations/${result.generationId}/download`), { headers: quickAdsAuth(token), responseType: 'blob', timeout: 60000, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!data.size) throw new Error('Empty video');
      const url = URL.createObjectURL(data);
      downloadUrls.current.push(url);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'spreadfast-quick-ad.mp4';
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Keep the URL alive while Safari handles the download.
      setNotice('If your browser opens the video, use its Share or Download menu to save it.');
    } catch {
      if (!controller.signal.aborted) setNotice('Open the video below and use your browser’s Share or Download menu to save it.');
    } finally {
      if (download.current === controller) {
        download.current = null;
        if (!controller.signal.aborted) setSaving(false);
      }
    }
  }

  return <section className="quick-ad" aria-labelledby="quick-ad-title">
    <header className="quick-ad-heading">
      <div className="quick-ad-heading-line">
        <h1 id="quick-ad-title">Quick Ads</h1>
        <span className="quick-ad-studio-badge">AI studio</span>
      </div>
      <p>Turn your product photos into an ad.</p>
      {isFashionStyle && <p className="quick-ad-fashion-hint">Photograph the same outfit from the front and back, fully visible in good lighting.</p>}
    </header>
    {canGenerate && <div className="quick-ad-credit-summary">
      <div className="quick-ad-credit-copy">
        <span className="quick-ad-credit-icon"><UiIcon name="wallet" /></span>
        <div><strong>{balance ? `${balance.quickAdCredits} credits available` : 'Loading credits...'}</strong>
          {balance?.freePreviewAvailable && <span className="quick-ad-free-preview">1 free preview available</span>}
        </div>
      </div>
      <Button variant="secondary" onClick={buyCredits}>Buy Credits</Button>
    </div>}
    {balance?.freePreviewAvailable && <p className="quick-ad-credit-note">Your first Quick Ad is free to preview. Buy any credit plan to unlock its download.</p>}
    {pendingKey && !generating && <Alert>Your last generation needs confirmation. <Button variant="secondary" disabled={saving} onClick={recover}>Check generation</Button></Alert>}
    <div className="quick-ad-layout">
      <div className="quick-ad-editor">
        <section className="quick-ad-panel" aria-labelledby="quick-ad-upload-title">
          <div className="quick-ad-step"><span aria-hidden="true">1</span><div><h2 id="quick-ad-upload-title">{isFashionStyle ? 'Your outfit' : 'Your product'}</h2><p>{isFashionStyle ? 'Add both sides of the same garment.' : 'Start with a clear product photo.'}</p></div></div>
          {isFashionStyle ? <div className="quick-ad-fashion-grid">
            {['front', 'back'].map(slot => (
              <div key={slot} className={'quick-ad-fashion-slot' + ((slot === 'front' ? frontPhoto : backPhoto) ? ' is-populated' : '')}>
                <label className="quick-ad-fashion-label">{slot === 'front' ? 'Front photo' : 'Back photo'}</label>
                <div className="quick-ad-upload" onDragOver={event => { event.preventDefault(); if (!generating) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); selectFashionPhoto(slot, event.dataTransfer.files); }}>
                  {(slot === 'front' ? frontPhoto : backPhoto) ? <>
                    <img className="quick-ad-product" src={slot === 'front' ? frontPhoto.url : backPhoto.url} alt={slot === 'front' ? 'Front outfit photo' : 'Back outfit photo'} onError={() => { removeFashionPhoto(slot); setError('This image could not be opened. Please choose another photo.'); }} />
                    <div className="quick-ad-file"><span>{slot === 'front' ? frontPhoto.name : backPhoto.name}</span><Button size="sm" variant="secondary" disabled={generating || brandingSaving} onClick={() => removeFashionPhoto(slot)} aria-label={`Remove ${slot} outfit photo`}><UiIcon name="close" /> Remove</Button></div>
                  </> : <div className="quick-ad-upload-copy"><span className="quick-ad-round-icon"><UiIcon name="image" /></span><strong>{slot === 'front' ? 'Front photo' : 'Back photo'}</strong><span>Choose a garment photo</span></div>}
                  <label className={'quick-ad-picker' + (generating ? ' is-disabled' : '')}>
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={generating || brandingSaving}
                      aria-label={slot === 'front' ? 'Upload front outfit photo' : 'Upload back outfit photo'}
                      onChange={event => { selectFashionPhoto(slot, event.target.files); event.target.value = ''; }} />
                    <span>{(slot === 'front' ? frontPhoto : backPhoto) ? 'Change photo' : 'Choose photo'} <UiIcon name="plus" /></span>
                  </label>
                </div>
              </div>
            ))}
            <p className="quick-ad-file-hint">JPG, PNG, WEBP · Up to 8 MB each</p>
          </div> : <div className={'quick-ad-upload' + (dragging ? ' is-dragging' : '') + (product ? ' is-populated' : '')}
            onDragOver={event => { event.preventDefault(); if (!generating) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => { event.preventDefault(); setDragging(false); selectPhoto(event.dataTransfer.files); }}>
            {product ? <>
              <img className="quick-ad-product" src={product.url} alt="Selected product" onError={() => { removePhoto(); setError('This image could not be opened. Please choose another photo.'); }} />
              <div className="quick-ad-file"><span>{product.name}</span><Button size="sm" variant="secondary" disabled={generating || brandingSaving} onClick={removePhoto} aria-label="Remove product photo"><UiIcon name="close" /> Remove</Button></div>
            </> : <div className="quick-ad-upload-copy"><span className="quick-ad-round-icon"><UiIcon name="image" /></span><strong>Drop your product photo here</strong><span>or choose one from your device</span></div>}
            <label className={'quick-ad-picker' + (generating ? ' is-disabled' : '')}>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={generating || brandingSaving}
                aria-label={product ? 'Replace product photo' : 'Upload product photo'} aria-describedby="quick-ad-file-hint"
                onChange={event => { selectPhoto(event.target.files); event.target.value = ''; }} />
              <span>{product ? 'Change photo' : 'Choose photo'} <UiIcon name="plus" /></span>
            </label>
            <p id="quick-ad-file-hint">JPG, PNG, WEBP · Up to 8 MB</p>
          </div>}
          <QuickAdBranding value={branding} onChange={setBranding} disabled={generating || !!pendingKey || brandingSaving} />
          {error && <Alert tone="error">{error}</Alert>}
        </section>
        <section className="quick-ad-panel" aria-labelledby="quick-ad-style-title">
          <div className="quick-ad-step"><span aria-hidden="true">2</span><div><h2 id="quick-ad-style-title">Choose your style</h2><p>Find the feeling that fits your product.</p></div></div>
          <fieldset className="quick-ad-templates" disabled={generating || brandingSaving}>
            <legend className="sr-only">Ad style</legend>
            {styles.map(style => <label key={style.id} className={'quick-ad-template' + (styleId === style.id ? ' is-selected' : '')}>
              <input type="radio" name="quick-ad-style" value={style.id} checked={styleId === style.id} onChange={() => { setStyleId(style.id); reset(); }} />
              <span className={'quick-ad-art' + (style.id === 'fashion_studio' ? ' is-fashion' : '')} aria-hidden="true"><img className="quick-ad-style-image" src={style.image} alt="" draggable={false} /></span>
              <span className="quick-ad-template-copy"><strong>{style.name}</strong><span>{style.description}</span></span>
              {styleId === style.id && <span className="quick-ad-selected" aria-hidden="true"><UiIcon name="check" /></span>}
            </label>)}
          </fieldset>
        </section>
        <div className="quick-ad-generate">
          <Button fullWidth size="lg" disabled={!canGenerate || !balance || (!hasRequiredPhotos && !outOfCredits) || generating || saving || brandingSaving || !!pendingKey} onClick={outOfCredits ? buyCredits : generate} aria-describedby="quick-ad-generation-note">
            {generating ? <><span className="quick-ad-spinner" aria-hidden="true" /> Creating your Quick Ad...</> : <>{outOfCredits ? 'Buy Credits' : balance?.freePreviewAvailable ? 'Create Free Preview' : 'Generate Quick Ad'} <UiIcon name="star" /></>}
          </Button>
          <p id="quick-ad-generation-note">{canGenerate ? 'Generation can take a few minutes. Keep this page open.' : 'A company or promoter account is required to generate Quick Ads.'}</p>
        </div>
      </div>
      <aside ref={previewPanel} className="quick-ad-preview-panel" aria-labelledby="quick-ad-preview-title">
        <div className="quick-ad-preview-heading">
          <div><h2 id="quick-ad-preview-title">Your creative preview</h2><p>See your product take the spotlight.</p></div>
          <span className={'quick-ad-processing-status' + (generating ? ' is-active' : '')}><i aria-hidden="true" />{generating ? 'Processing' : ready ? 'Ready' : 'Preview'}</span>
        </div>
        <div className={'quick-ad-media' + (generating ? ' is-generating' : '') + (ready ? ' is-ready' : '')} aria-busy={generating}>
          {ready && videoUrl ? <video key={videoUrl} className="quick-ad-video" src={videoUrl}
            poster={result?.commercialImage?.url || result?.imageUrl || product?.url} playsInline controls loop muted controlsList={!downloadable ? 'nodownload' : undefined} preload="metadata" aria-label="Your generated advert"
            onError={() => setNotice(!downloadable ? 'Choose Preview Again to reload your preview.' : 'The preview could not play. Open the video below to watch or save it.')} />
            : previewImage ? <img className="quick-ad-stage-image" src={previewImage} alt={stageImage ? 'Commercial scene preview' : 'Selected product preview'}
              onError={() => { if (stageImage) setStageImage(''); }} />
              : <div className="quick-ad-placeholder"><span className="quick-ad-round-icon"><UiIcon name="image" /></span><strong>Your preview starts here</strong><p>Upload a product photo to see it in your creative workspace.</p></div>}
          {stageImage && !ready && <span className="quick-ad-scene-tag">Commercial scene</span>}
          {generating && <div className="quick-ad-processing-label"><span className="quick-ad-processing-sparkle"><UiIcon name="star" /></span><span>{stageLabel}</span></div>}
        </div>
        {(generating || ready) && <ol className="quick-ad-stage-list" aria-label="Quick Ad generation progress" aria-live="polite">
          {stageSteps.map((step, index) => (
            <li key={step.key} className={ready || index < currentStageIndex ? 'is-done' : index === currentStageIndex ? 'is-active' : 'is-muted'}>
              <span className="quick-ad-stage-marker" aria-hidden="true">{ready || index < currentStageIndex ? '✓' : index === currentStageIndex ? '•' : ''}</span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>}
        <p className="quick-ad-result-status" role="status">{ready ? 'Your Quick Ad is ready. Tap play to preview it.' : generating ? 'Generation can take a few minutes. Keep this page open.' : 'Choose a photo and style to get started.'}</p>
        {ready && <div className="quick-ad-branding-edit">
          {!editingBranding ? <Button variant="secondary" size="sm" disabled={saving || brandingSaving} onClick={() => {
            setEditBranding(result?.branding || { mode: 'none' }); setBrandingDirty(false); setBrandingError(''); setEditingBranding(true);
          }}>Edit branding</Button> : <>
            <QuickAdBranding key={result.generationId} value={editBranding} onChange={value => { setEditBranding(value); setBrandingDirty(true); }} disabled={brandingSaving} expanded title="Video branding" />
            <div className="quick-ad-branding-edit-actions">
              <Button size="sm" disabled={brandingSaving || !brandingDirty} onClick={saveBranding}>{brandingSaving ? 'Applying branding...' : 'Save branding'}</Button>
              <Button size="sm" variant="secondary" disabled={brandingSaving} onClick={() => setEditingBranding(false)}>Cancel</Button>
            </div>
            <p className="sf-small sf-muted">Updates this video without using a generation credit.</p>
            {brandingError && <Alert tone="error">{brandingError}</Alert>}
          </>}
        </div>}
        <div className="quick-ad-result-actions">
          {ready && result?.freePreview && !downloadable && <><strong>Your free Quick Ad is ready.</strong><p>Buy any credit plan to unlock this video and create more ads.</p><Button onClick={buyCredits}>Buy Credits</Button><Button variant="secondary" disabled={saving} onClick={previewAgain}>Preview Again</Button></>}
          <Button variant="secondary" fullWidth disabled={!downloadable || saving || brandingSaving} onClick={saveVideo}><UiIcon name="download" /> {result?.freePreview && !downloadable ? 'Save video — Locked' : saving ? 'Saving video...' : 'Save video'}</Button>
          <Button variant="secondary" fullWidth disabled={!canStartCampaign || !downloadable || saving || brandingSaving} onClick={startCampaign}><UiIcon name="user" /> Promote with creators</Button>
          <Button variant="secondary" fullWidth disabled={!canStartCampaign || !downloadable || saving || brandingSaving} onClick={startCampaign}><UiIcon name="campaign" /> Start campaign</Button>
          {!canStartCampaign && ready && <p className="sf-small sf-muted">A company account is required to start a creator campaign.</p>}
        </div>
        {notice && <Alert>{notice}</Alert>}
        {downloadable && videoUrl && <a className="quick-ad-open-video" href={videoUrl} target="_blank" rel="noopener noreferrer">Open video to watch or save</a>}
      </aside>
    </div>
    <section className="quick-ad-history" aria-labelledby="quick-ad-history-title">
      <div className="quick-ad-history-header">
        <h2 id="quick-ad-history-title">My Quick Ads</h2>
        {historyStatus === 'loading' && history.length > 0 && <span className="quick-ad-history-loading" role="status">Refreshing...</span>}
      </div>
      {!canGenerate && <div className="quick-ad-empty-state">Quick Ads history is available to company and promoter accounts.</div>}
      {canGenerate && historyStatus === 'loading' && history.length === 0 && <div className="quick-ad-empty-state" role="status">Loading your Quick Ads...</div>}
      {canGenerate && historyStatus === 'error' && <Alert tone="error">{historyError} <Button variant="secondary" size="sm" onClick={loadHistory}>Retry</Button></Alert>}
      {historyActionError && <Alert tone="error">{historyActionError}</Alert>}
      {canGenerate && historyStatus === 'loaded' && history.length === 0 && <div className="quick-ad-empty-state">Your Quick Ads will appear here after you create them.</div>}
      {history.length > 0 && <div className="quick-ad-history-grid">
          {history.map(item => (
            <article key={item.generationId} className="quick-ad-history-card">
              <QuickAdHistoryVideo key={`${item.generationId}:${item.brandingRevision || 0}`} item={item} token={token} />
              <div className="quick-ad-history-footer">
              <div className="quick-ad-history-copy">
                <strong>{styles.find(style => style.id === item.style)?.name || item.style || 'Quick Ad'}</strong>
                <small>{(item.completedAt || item.createdAt) && !Number.isNaN(new Date(item.completedAt || item.createdAt).getTime())
                  ? new Date(item.completedAt || item.createdAt).toLocaleDateString() : 'Date unavailable'}</small>
                <span className={'quick-ad-history-status is-' + (item.status || 'unknown')}>{item.status === 'completed' ? 'Ready' : item.status === 'pending' ? 'Processing' : item.status || 'Status unavailable'}</span>
              </div>
              <div className="quick-ad-history-actions">
                {item.status === 'completed' && <Button size="sm" variant="secondary" aria-label="Edit video branding" title="Edit branding" disabled={saving || brandingSaving || generating || !!pendingKey} onClick={() => editHistoryBranding(item)}><UiIcon name="edit" /></Button>}
                {item.downloadable && <Button size="sm" variant="secondary" aria-label="Download video" title={saving ? 'Saving video...' : 'Download video'} disabled={saving} onClick={() => downloadHistoryItem(item)}><UiIcon name="download" /></Button>}
                <Button size="sm" variant="secondary" className="quick-ad-history-delete" aria-label={deletingId === item.generationId ? 'Deleting video...' : 'Delete video'} title="Delete video" disabled={item.status === 'pending' || !!deletingId || brandingSaving} onClick={() => deleteHistoryItem(item)}><UiIcon name="trash" /></Button>
              </div>
              </div>
            </article>
          ))}
        </div>}
    </section>
    <footer className="quick-ad-footer"><span className="quick-ad-round-icon"><UiIcon name="sun" /></span><div><strong>A little inspiration. A bigger impression.</strong><p>Give your product a moment in the spotlight.</p></div></footer>
  </section>;
}
