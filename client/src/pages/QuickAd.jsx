import React, { useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Alert, Button } from '../components/ui';
import UiIcon from '../components/ui/UiIcon';
import { quickAdsUrl, quickAdsAuth, generationVideoUrl, newGenerationKey, canUseQuickAds } from '../utils/quickAdsApi';
import './QuickAd.css';
import './QuickAdCredits.css';

const styles = [
  { id: 'food', name: 'Food Burst', description: 'Make food look fresh and irresistible.', image: '/dynamic_grilled_salmon_bowl_with_lemon_splash.png', caption: 'Fresh energy' },
  { id: 'reveal', name: 'Product Reveal', description: 'A cinematic product reveal.', image: '/luxury_amber_perfume_spotlight.png', caption: 'In the spotlight' },
  { id: 'studio', name: 'Clean Studio', description: 'Simple, premium product motion.', image: '/luxury_skincare_bottle_in_soft_beige_studio.png', caption: 'Less. But better.' },
  { id: 'social', name: 'Attention Grabber', description: 'Fast movement made for social media.', image: '/energetic_citrus_juice_splash.png', caption: 'Make them look.' },
];
const GENERATION_ERROR = "We couldn't generate your advert. Please try again.";

export default function QuickAd() {
  const { token, user } = useContext(AuthContext);
  const canGenerate = canUseQuickAds(user?.role);
  const canStartCampaign = user?.role === 'company';
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [styleId, setStyleId] = useState('food');
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [result, setResult] = useState(null);
  const [generationStage, setGenerationStage] = useState('queued');
  const [history, setHistory] = useState([]);
  const [balance, setBalance] = useState(null);
  const storageKey = `spreadfast-quick-ad-generation:${user?.id}`;
  const [pendingKey, setPendingKey] = useState(() => { try { return sessionStorage.getItem(storageKey) || ''; } catch { return ''; } });
  const [saving, setSaving] = useState(false);
  const request = useRef(null);
  const download = useRef(null);
  const downloadUrls = useRef([]);
  const generating = phase === 'generating';
  const ready = phase === 'ready';
  const downloadable = ready && result?.downloadable === true && !result?.freePreview;
  const outOfCredits = balance && !balance.freePreviewAvailable && balance.quickAdCredits < 1;
  const buyCredits = () => navigate('/quickads/credits', { state: { outOfCredits } });
  const stageSteps = [
    { key: 'queued', label: 'Preparing your product' },
    { key: 'preparing_image', label: 'Preparing your product' },
    { key: 'creating_scene', label: 'Building your commercial scene' },
    { key: 'creating_video', label: 'Adding cinematic motion' },
    { key: 'finalizing', label: 'Finishing your Quick Ad' },
    { key: 'completed', label: 'Quick Ad ready' },
  ];
  const currentStageIndex = Math.max(0, stageSteps.findIndex(step => step.key === generationStage));
  const previewImage = (result?.imageUrl || result?.commercialImage?.url || product?.url || null);
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
    setVideoUrl(generationVideoUrl(data)); setResult(data); setBalance(data); setPhase('ready'); setGenerationStage(data?.stage || 'completed'); rememberKey('');
    loadHistory();
  }
  async function recover() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setSaving(true);
    try {
      const { data } = await axios.get(quickAdsUrl(`/requests/${encodeURIComponent(pendingKey)}`), { headers: quickAdsAuth(token), signal: controller.signal, timeout: 20000 });
      if (controller.signal.aborted) return;
      setGenerationStage(data?.stage || (data.status === 'completed' ? 'completed' : 'queued'));
      if (data.status === 'completed') { showResult(data); setError(''); }
      else if (data.status === 'failed') { rememberKey(''); setError(GENERATION_ERROR); }
      else setError('Your ad is still processing. Check generation again shortly.');
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
        if (data.status === 'completed') { showResult(data); }
        else if (data.status === 'failed') { rememberKey(''); setPhase('idle'); setError(GENERATION_ERROR); }
      } catch (failure) {
        if ([404, 410].includes(failure.response?.status)) { return; }
      }
    };
    poll();
    const id = window.setInterval(poll, 2500);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [canGenerate, token, pendingKey, phase]);

  async function loadHistory() {
    if (!canGenerate || !token) return;
    try {
      const { data } = await axios.get(quickAdsUrl('/generations'), { headers: quickAdsAuth(token), timeout: 20000 });
      if (data?.success) setHistory(data.generations || []);
    } catch {
      setHistory([]);
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

  function reset() {
    request.current?.abort();
    request.current = null;
    download.current?.abort();
    download.current = null;
    setSaving(false);
    setVideoUrl('');
    setResult(null);
    setGenerationStage('queued');
    setPhase('idle');
    setNotice('');
  }

  function selectPhoto(files) {
    if (generating || !files?.length) return;
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

  function removePhoto() { reset(); setProduct(null); setError(''); }

  async function generate() {
    if (!canGenerate) return;
    if (generating || request.current || pendingKey || !balance) return;
    if (outOfCredits) { buyCredits(); return; }
    if (!product?.file) { setError('Please add a product photo first.'); return; }
    const controller = new AbortController();
    request.current = controller;
    setError(''); setNotice(''); setPhase('generating'); setGenerationStage('queued');
    setVideoUrl('');
    setResult(null);
    try {
      const baseUrl = process.env.REACT_APP_API_URL?.trim().replace(/\/+$/, '');
      if (!baseUrl || !token) throw new Error('Missing API configuration or session');
      const form = new FormData();
      form.append('image', product.file);
      form.append('style', styleId);
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
        if ([400, 401, 403, 413].includes(failure.response?.status)) rememberKey('');
        if (failure.response?.data?.code === 'NO_QUICK_AD_CREDITS') { navigate('/quickads/credits', { state: { outOfCredits: true } }); }
        const timedOut = failure?.response?.status === 504 || ['ECONNABORTED', 'ETIMEDOUT'].includes(failure?.code);
        setError(timedOut
          ? 'Your advert is taking longer than expected and may still be processing. Please wait before trying again to avoid creating a duplicate advert.'
          : GENERATION_ERROR);
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
      <span className="quick-ad-badge"><UiIcon name="video" /> SpreadFast Quick Ads</span>
      <h1 id="quick-ad-title">Turn one photo into an ad.</h1>
      <p>Upload your product. Choose a style. SpreadFast does the rest.</p>
    </header>
    {canGenerate && <div className="quick-ad-credit-summary"><div><strong>{balance ? `${balance.quickAdCredits} credits available` : 'Loading credits...'}</strong>{balance?.freePreviewAvailable && <><p>1 free preview available</p><p>Preview your first Quick Ad free. Purchase credits to download new paid ads and continue creating.</p></>}</div><Button variant="secondary" onClick={buyCredits}>Buy Credits</Button></div>}
    {pendingKey && !generating && <Alert>Your last generation needs confirmation. <Button variant="secondary" disabled={saving} onClick={recover}>Check generation</Button></Alert>}
    <div className="quick-ad-layout">
      <div className="quick-ad-editor">
        <section className="quick-ad-panel" aria-labelledby="quick-ad-upload-title">
          <div className="quick-ad-step"><span aria-hidden="true">1</span><div><h2 id="quick-ad-upload-title">Add your product</h2><p>A great ad starts with a clear photo.</p></div></div>
          <div className={'quick-ad-upload' + (dragging ? ' is-dragging' : '')}
            onDragOver={event => { event.preventDefault(); if (!generating) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => { event.preventDefault(); setDragging(false); selectPhoto(event.dataTransfer.files); }}>
            {product ? <>
              <img className="quick-ad-product" src={product.url} alt="Selected product" onError={() => { removePhoto(); setError('This image could not be opened. Please choose another photo.'); }} />
              <div className="quick-ad-file"><span>{product.name}</span><Button size="sm" variant="secondary" disabled={generating} onClick={removePhoto} aria-label="Remove product photo"><UiIcon name="close" /> Remove</Button></div>
            </> : <div className="quick-ad-upload-copy"><span className="quick-ad-round-icon"><UiIcon name="image" /></span><strong>Drop your product photo here</strong><span>or choose one from your device</span></div>}
            <label className={'quick-ad-picker' + (generating ? ' is-disabled' : '')}>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={generating}
                aria-label={product ? 'Replace product photo' : 'Upload product photo'} aria-describedby="quick-ad-file-hint"
                onChange={event => { selectPhoto(event.target.files); event.target.value = ''; }} />
              <span>{product ? 'Change photo' : 'Choose photo'} <UiIcon name="plus" /></span>
            </label>
            <p id="quick-ad-file-hint">JPG, PNG, WEBP · Up to 8 MB</p>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
        </section>
        <section className="quick-ad-panel" aria-labelledby="quick-ad-style-title">
          <div className="quick-ad-step"><span aria-hidden="true">2</span><div><h2 id="quick-ad-style-title">Choose an ad style</h2><p>Find the feeling that fits your product.</p></div></div>
          <fieldset className="quick-ad-templates" disabled={generating}>
            <legend className="sr-only">Ad style</legend>
            {styles.map(style => <label key={style.id} className={'quick-ad-template' + (styleId === style.id ? ' is-selected' : '')}>
              <input type="radio" name="quick-ad-style" value={style.id} checked={styleId === style.id} onChange={() => { setStyleId(style.id); reset(); }} />
              <span className="quick-ad-art" aria-hidden="true"><img className="quick-ad-style-image" src={style.image} alt="" draggable={false} /><span>{style.caption}</span></span>
              <span className="quick-ad-template-copy"><strong>{style.name}</strong><span>{style.description}</span></span>
              {styleId === style.id && <span className="quick-ad-selected" aria-hidden="true"><UiIcon name="check" /></span>}
            </label>)}
          </fieldset>
        </section>
        <div className="quick-ad-generate">
          <Button fullWidth size="lg" disabled={!canGenerate || !balance || (!product && !outOfCredits) || generating || saving || !!pendingKey} onClick={outOfCredits ? buyCredits : generate} aria-describedby="quick-ad-generation-note">
            {generating ? <><span className="quick-ad-spinner" aria-hidden="true" /> Creating your Quick Ad...</> : <>{outOfCredits ? 'Buy Credits' : balance?.freePreviewAvailable ? 'Create Free Preview' : 'Generate Quick Ad'} <UiIcon name="star" /></>}
          </Button>
          <p id="quick-ad-generation-note">{canGenerate ? 'Generation can take a few minutes. Keep this page open.' : 'A company or promoter account is required to generate Quick Ads.'}</p>
        </div>
      </div>
      <aside className="quick-ad-preview-panel" aria-labelledby="quick-ad-preview-title">
        <div className="quick-ad-preview-heading"><h2 id="quick-ad-preview-title">Video preview</h2><span>0:05</span></div>
        <div className={'quick-ad-phone' + (ready ? ' is-ready' : '')} aria-busy={generating}>
          <div className="quick-ad-phone-top"><UiIcon name="video" /><span>SpreadFast</span><span className="quick-ad-phone-dot" /></div>
          {ready && videoUrl ? <video key={videoUrl} className="quick-ad-video" src={videoUrl}
            poster={product?.url} playsInline controls loop muted controlsList={result?.freePreview ? 'nodownload' : undefined} preload="metadata" aria-label="Your generated advert"
            onError={() => setNotice(result?.freePreview ? 'Choose Preview Again to reload your preview.' : 'The preview could not play. Open the video below to watch or save it.')} />
            : <div className="quick-ad-placeholder">
              {generating && previewImage ? <img className="quick-ad-stage-image" src={previewImage} alt="Product or commercial preview" /> : null}
              <span className="quick-ad-round-icon"><UiIcon name={generating ? 'clock' : 'video'} /></span>
              <strong>{generating ? (generationStage === 'creating_video' ? 'Bringing your ad to life...' : 'A little magic in progress.') : 'Your ad will appear here.'}</strong>
              <p>{generating ? (generationStage === 'creating_video' ? 'Kling is creating the final commercial motion.' : 'Creating your ad...') : 'One photo. Five seconds. Endless possibilities.'}</p>
            </div>}
          {!ready && <div className="quick-ad-phone-bottom"><span /><small>Made for the small screen</small></div>}
        </div>
        {generating && <ol className="quick-ad-stage-list" aria-live="polite">
          {stageSteps.map((step, index) => (
            <li key={step.key} className={index < currentStageIndex ? 'is-done' : index === currentStageIndex ? 'is-active' : 'is-muted'}>
              <span className="quick-ad-stage-marker" aria-hidden="true">{index < currentStageIndex ? '✓' : index === currentStageIndex ? '•' : ''}</span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>}
        <p className="quick-ad-result-status" role="status">{ready ? 'Your ad is ready. Tap play to preview it.' : generating ? 'Creating your ad... This can take a few minutes.' : 'Choose a photo and style to get started.'}</p>
        <div className="quick-ad-result-actions">
          {ready && result?.freePreview && <><strong>Your free Quick Ad is ready.</strong><p>Purchase Quick Ads credits to download new paid ads and continue creating. This free preview stays locked.</p><Button onClick={buyCredits}>Buy Credits</Button><Button variant="secondary" disabled={saving} onClick={previewAgain}>Preview Again</Button></>}
          <Button variant="secondary" fullWidth disabled={!downloadable || saving} onClick={saveVideo}><UiIcon name="download" /> {result?.freePreview ? 'Save video — Locked' : saving ? 'Saving video...' : 'Save video'}</Button>
          <Button variant="secondary" fullWidth disabled={!canStartCampaign || !downloadable || saving} onClick={startCampaign}><UiIcon name="user" /> Promote with creators</Button>
          <Button variant="secondary" fullWidth disabled={!canStartCampaign || !downloadable || saving} onClick={startCampaign}><UiIcon name="campaign" /> Start campaign</Button>
          {!canStartCampaign && ready && <p className="sf-small sf-muted">A company account is required to start a creator campaign.</p>}
        </div>
        {notice && <Alert>{notice}</Alert>}
        {downloadable && videoUrl && <a className="quick-ad-open-video" href={videoUrl} target="_blank" rel="noopener noreferrer">Open video to watch or save</a>}
      </aside>
    </div>
    <section className="quick-ad-history" aria-labelledby="quick-ad-history-title">
      <div className="quick-ad-history-header">
        <h2 id="quick-ad-history-title">My Quick Ads</h2>
      </div>
      {history.length === 0 ? (
        <div className="quick-ad-empty-state">Your Quick Ads will appear here after you create them.</div>
      ) : (
        <div className="quick-ad-history-grid">
          {history.map(item => (
            <article key={item.generationId} className="quick-ad-history-card">
              <img className="quick-ad-history-thumb" src={item.thumbnail || '/dynamic_grilled_salmon_bowl_with_lemon_splash.png'} alt={item.style || 'Quick Ad'} />
              <div className="quick-ad-history-copy">
                <strong>{styles.find(s => s.id === item.style)?.name || item.style}</strong>
                <small>{item.completedAt ? new Date(item.completedAt).toLocaleDateString() : new Date(item.createdAt).toLocaleDateString()}</small>
                <span>{item.status === 'completed' ? 'Ready' : item.status}</span>
              </div>
              <div className="quick-ad-history-actions">
                <Button size="sm" variant="secondary" onClick={() => { if (item.generationId) { const url = quickAdsUrl(`/generations/${encodeURIComponent(item.generationId)}`); axios.get(url,{ headers: quickAdsAuth(token), timeout:20000 }).then(({data}) => { if (data.success) showResult(data); }).catch(()=>setNotice('Could not open that Quick Ad.')); } }}>Watch</Button>
                {item.downloadable && <Button size="sm" variant="secondary" onClick={async () => { const url = quickAdsUrl(`/generations/${encodeURIComponent(item.generationId)}/download`); const { data } = await axios.get(url,{headers: quickAdsAuth(token), responseType:'blob', timeout:60000}); const objectUrl = URL.createObjectURL(data); downloadUrls.current.push(objectUrl); const link = document.createElement('a'); link.href = objectUrl; link.download='spreadfast-quick-ad.mp4'; document.body.appendChild(link); link.click(); link.remove(); }}>Download</Button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
    <footer className="quick-ad-footer"><span className="quick-ad-round-icon"><UiIcon name="sun" /></span><div><strong>A little inspiration. A bigger impression.</strong><p>Give your product a moment in the spotlight.</p></div></footer>
  </section>;
}
