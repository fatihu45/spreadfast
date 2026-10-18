import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Button, Card } from '../components/ui';
import UiIcon from '../components/ui/UiIcon';
import './AICommercials.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const TIER_COST = { standard: 4, premium: 7 };
const styles = [
  { id: 'cinematic', title: 'Cinematic', description: 'Bold lighting and premium camera movement', icon: 'star' },
  { id: 'showcase', title: 'Product showcase', description: 'Clear, detail-first product presentation', icon: 'image' },
  { id: 'lifestyle', title: 'Lifestyle', description: 'Place your product in a natural scene', icon: 'sun' },
  { id: 'promo', title: 'Promotional', description: 'Energetic visuals for offers and launches', icon: 'zap' },
];

function toFileSizeLabel(size) {
  if (!size || size <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB'];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

function stageLabel(stage) {
  const labels = {
    queued: 'Queued',
    preparing_image: 'Planning your commercial',
    creating_scene: 'Creating scene images',
    creating_video: 'Animating scenes',
    finalizing: 'Assembling final video',
    completed: 'Completed',
    failed: 'Failed'
  };
  return labels[stage] || 'Processing';
}

function validateImageFile(file, label = 'Image') {
  if (!file) return `${label} is required.`;
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return 'Only JPG, PNG, and WEBP images are supported.';
  }
  if (file.size > 8 * 1024 * 1024) {
    return `${label} must be smaller than 8 MB.`;
  }
  return '';
}

export default function AICommercials({ initialTab = 'create' }) {
  const { token, user } = useContext(AuthContext);
  const [tab, setTab] = useState(initialTab);
  const [productName, setProductName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [contact, setContact] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [style, setStyle] = useState('cinematic');
  const [tier, setTier] = useState('standard');
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [logo, setLogo] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balance, setBalance] = useState({ quickAdCredits: 0, requiredCredits: TIER_COST.standard });
  const [jobs, setJobs] = useState([]);
  // Reuse the same key if the browser loses the response after the server accepted the job.
  const submissionKeyRef = useRef(null);

  const requiredCredits = useMemo(() => TIER_COST[tier] || TIER_COST.standard, [tier]);
  const hasFreePreview = balance.freePreviewAvailable === true;
  const canAfford = hasFreePreview || Number(balance.quickAdCredits || 0) >= requiredCredits;

  async function loadCredits() {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/ai-commercials/credits`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Could not load credit balance.');
      setBalance({
        quickAdCredits: Number(data.quickAdCredits || 0),
        requiredCredits: Number(data.requiredCredits || requiredCredits),
        ...data
      });
    } catch (loadError) {
      setError(loadError.message || 'We could not load your credits.');
    }
  }

  async function loadHistory() {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/ai-commercials/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Could not read your ads.');
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (historyError) {
      setError(historyError.message || 'Could not load your previous ads.');
    }
  }

  async function editJob(job) {
    const details = job.commercialDetails || {};
    const productName = window.prompt('Product name', job.productName || details.productName || '');
    if (productName === null) return;
    const brandName = window.prompt('Brand name', job.brandName || details.brandName || '');
    if (brandName === null) return;
    const contact = window.prompt('Contact / call to action', details.contact || '');
    if (contact === null) return;
    const specifications = window.prompt('Product specifications', details.specifications || '');
    if (specifications === null) return;
    try {
      const response = await fetch(`${API_URL}/api/ai-commercials/jobs/${encodeURIComponent(job.generationId || job.id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productName, brandName, contact, specifications })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Could not update this ad.');
      setNotice('Ad details updated.');
      setError('');
      await loadHistory();
    } catch (editError) {
      setError(editError.message || 'Could not update this ad.');
    }
  }

  async function deleteJob(job) {
    const title = job.title || job.productName || 'this ad';
    if (!window.confirm(`Delete "${title}" from My Ads? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${API_URL}/api/ai-commercials/jobs/${encodeURIComponent(job.generationId || job.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Could not delete this ad.');
      setJobs(current => current.filter(item => (item.generationId || item.id) !== (job.generationId || job.id)));
      setNotice('Ad deleted.');
      setError('');
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this ad.');
    }
  }

  useEffect(() => {
    loadCredits();
  }, [token, tier]);

  useEffect(() => {
    if (tab !== 'history') return undefined;
    loadHistory();
    // Long-running AI jobs may finish after the initial page load; keep history fresh.
    const timer = window.setInterval(() => loadHistory(), 5000);
    return () => window.clearInterval(timer);
  }, [tab, token]);

  const handlePhotoChange = (input) => {
    const file = input?.files?.[0] || null;
    const validation = validateImageFile(file, 'Product photo');
    if (validation) {
      setError(validation);
      return;
    }
    setPhotoFile(file);
    setPhoto(URL.createObjectURL(file));
    setError('');
    setNotice('');
  };

  const handleLogoChange = (input) => {
    const file = input?.files?.[0] || null;
    const validation = validateImageFile(file, 'Logo');
    if (validation) {
      setError(validation);
      return;
    }
    setLogoFile(file);
    setLogo(URL.createObjectURL(file));
    setError('');
  };

  const handleSubmit = async () => {
    if (!token) {
      setError('Please log in before generating a commercial.');
      return;
    }
    if (!photoFile) {
      setError('Upload a product photo before generating.');
      return;
    }
    if (!productName.trim() || !brandName.trim()) {
      setError('Product name and brand name are required.');
      return;
    }
    if (!canAfford) {
      setError(`You need at least ${requiredCredits} credits for this tier. Buy more credits to continue.`);
      return;
    }

    setIsSubmitting(true);
    setError('');
    setNotice('');
    setStatus('Preparing your brief');

    try {
      const formData = new FormData();
      formData.append('productName', productName.trim());
      formData.append('brandName', brandName.trim());
      formData.append('contact', contact.trim());
      formData.append('specifications', specifications.trim());
      formData.append('style', style);
      formData.append('tier', tier);
      formData.append('productImage', photoFile);
      if (logoFile) formData.append('logo', logoFile);

      if (!submissionKeyRef.current) {
        submissionKeyRef.current = (window.crypto && typeof window.crypto.randomUUID === 'function')
          ? window.crypto.randomUUID()
          : `commercial-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const response = await fetch(`${API_URL}/api/ai-commercials/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': submissionKeyRef.current
        },
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        // A definite server response means this attempt ended; a network exception below
        // deliberately keeps the key so a retry cannot accidentally start a second paid job.
        submissionKeyRef.current = null;
        if (response.status === 409) {
          await loadHistory();
          setTab('history');
        }
        throw new Error(data.message || 'Commercial generation failed. Please try again.');
      }

      submissionKeyRef.current = null;
      setStatus('Commercial ready');
      setNotice('Your AI commercial is ready to review.');
      setTab('history');
      await loadCredits();
      await loadHistory();
      setError('');
      setIsSubmitting(false);
      return data;
    } catch (submitError) {
      setStatus('Retry needed');
      setError(submitError.message || 'Commercial generation failed.');
      setNotice('Please fix the issue and try again.');
      setIsSubmitting(false);
      return null;
    }
  };

  const styleLabel = styles.find(item => item.id === style)?.title || 'Cinematic';

  return <main className="sf-commercials">
    <header className="sf-commercials__header">
      <div>
        <span className="sf-commercials__eyebrow">SPREADFAST AI STUDIO</span>
        <h1>{tab === 'history' ? 'My Ads' : 'Create an AI commercial'}</h1>
        <p>Turn a product photo into a polished, scene-by-scene video advert.</p>
      </div>
      <div className="sf-commercials__actions">
        <Link to="/company/quick-ads" className="sf-commercials__secondary">Quick Ads <UiIcon name="arrow-right" /></Link>
        <Link to="/quickads/credits" className="sf-commercials__credit"><UiIcon name="wallet" /> Buy credits</Link>
      </div>
    </header>

    <div className="sf-commercials__tabs" role="tablist" aria-label="Ad workspace">
      <button type="button" role="tab" aria-selected={tab === 'create'} className={tab === 'create' ? 'is-active' : ''} onClick={() => setTab('create')}>Create commercial</button>
      <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}>My Ads</button>
    </div>

    {tab === 'history' ? (
      <Card className="sf-commercials__empty">
        {(notice || error) && <p className={error ? "sf-commercials__notice sf-commercials__notice--error" : "sf-commercials__notice"} role="status">{error || notice}</p>}
        {jobs.length > 0 ? (
          <div className="sf-commercials__history-list">
            {jobs.map(job => {
              const rawTitle = job.title || job.productName || job.style || 'AI commercial';
              const title = String(rawTitle).replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
              const rawStatus = String(job.status || job.stage || 'processing').toLowerCase();
              const isCompleted = rawStatus === 'completed' || rawStatus === 'complete';
              const isFailed = rawStatus === 'failed' || rawStatus === 'error';
              const videoUrl = job.videoUrl || (job.previewPath ? `${API_URL}${job.previewPath}` : '');
              const createdAt = job.completedAt || job.createdAt || job.updatedAt;
              const dateLabel = createdAt && !Number.isNaN(new Date(createdAt).getTime())
                ? new Date(createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                : '';
              return (
                <article key={job.generationId || job.id} className="sf-commercials__history-item">
                  {isCompleted && videoUrl ? (
                    <div className="sf-commercials__history-media">
                      <video src={videoUrl} controls playsInline preload="metadata" aria-label={`${title} commercial video`} />
                    </div>
                  ) : (
                    <div className={`sf-commercials__history-media sf-commercials__history-media--placeholder ${isFailed ? 'is-failed' : ''}`} aria-label={isFailed ? 'Generation failed' : 'Video is processing'}>
                      <UiIcon name={isFailed ? 'alert-circle' : 'video'} />
                      <span>{isFailed ? 'Generation failed' : 'Your video is processing'}</span>
                    </div>
                  )}
                  <div className="sf-commercials__history-copy">
                    <strong>{title}</strong>
                    <span className={`sf-commercials__job-status ${isCompleted ? 'is-completed' : isFailed ? 'is-failed' : 'is-processing'}`}>
                      <i aria-hidden="true" /> {stageLabel(job.stage || job.status)}
                    </span>
                    <small>{String(job.style || 'Brand campaign').replace(/[_-]+/g, ' ')}{dateLabel ? ` · ${dateLabel}` : ''}</small>
                    {job.voiceover && <small>Voiceover: {job.voiceover}</small>}
                    <div className="sf-commercials__history-actions">
                      {isCompleted && videoUrl
                        ? <a className="sf-commercials__icon-button" href={videoUrl} download aria-label={`Download ${title}`} title="Download"><UiIcon name="download" /></a>
                        : <button type="button" className="sf-commercials__icon-button" disabled aria-label="Download unavailable" title="Download unavailable"><UiIcon name="download" /></button>}
                      <button type="button" className="sf-commercials__icon-button" onClick={() => editJob(job)} aria-label={`Edit details for ${title}`} title="Edit details"><UiIcon name="edit" /></button>
                      <button type="button" className="sf-commercials__icon-button sf-commercials__icon-button--danger" onClick={() => deleteJob(job)} aria-label={`Delete ${title}`} title="Delete"><UiIcon name="trash" /></button>
                    </div>
                    {isCompleted && !videoUrl ? (
                      <span className="sf-commercials__history-result">Video link unavailable</span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <>
            <span className="sf-commercials__empty-icon"><UiIcon name="video" /></span>
            <h2>Your ads will live here</h2>
            <p>Completed AI commercials and Quick Ads will appear here once a generation is finished.</p>
            <Button onClick={() => setTab('create')}>Create a commercial</Button>
          </>
        )}
      </Card>
    ) : (
      <>
        <div className="sf-commercials__layout">
          <div className="sf-commercials__form">
            <section className="sf-commercials__panel">
              <div className="sf-commercials__step"><span>1</span><div><h2>Product details</h2><p>Start with a clear image of the product you want to advertise.</p></div></div>
              <label className="sf-commercials__upload">
                {photo ? <><img src={photo} alt="Selected product preview" /><span className="sf-commercials__change">Change photo</span></> : <><span className="sf-commercials__upload-icon"><UiIcon name="image" /></span><strong>Upload product photo</strong><span>JPG, PNG or WEBP · Use a clear, well-lit image</span></>}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handlePhotoChange(e.target)} />
              </label>
              <div className="sf-commercials__fields">
                <label>Product name<input value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Signature leather bag" maxLength={100} /></label>
                <label>Brand name<input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Your business or brand" maxLength={100} /></label>
                <label>Contact / call to action<input value={contact} onChange={e => setContact(e.target.value)} placeholder="WhatsApp number, website or tagline" maxLength={120} /></label>
              </div>
              <div className="sf-commercials__spec">
                <label htmlFor="commercial-specs">Product specifications <span>Optional</span></label>
                <p id="commercial-specs-help">Tell the AI what must stay accurate. These details should guide every scene.</p>
                <textarea id="commercial-specs" value={specifications} onChange={e => setSpecifications(e.target.value.slice(0,500))} maxLength={500} rows={4} placeholder="Preserve the exact colour, shape, fabric, stitching, labels and packaging. Do not invent or remove product details." aria-describedby="commercial-specs-help commercial-specs-count" />
                <div className="sf-commercials__spec-footer"><span>Product accuracy first</span><span id="commercial-specs-count">{specifications.length}/500</span></div>
              </div>
              <div className="sf-commercials__logo"><div><strong>Add your logo</strong><p>Optional brand mark for your final commercial.</p></div><label className="sf-commercials__logo-button">{logo ? 'Logo selected' : 'Choose logo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleLogoChange(e.target)} /></label></div>
            </section>

            <section className="sf-commercials__panel">
              <div className="sf-commercials__step"><span>2</span><div><h2>Choose your creative direction</h2><p>Set the mood for your commercial.</p></div></div>
              <div className="sf-commercials__styles">{styles.map(item => <button type="button" key={item.id} onClick={() => setStyle(item.id)} className={'sf-commercials__style ' + (style === item.id ? 'is-selected' : '')}><span><UiIcon name={item.icon} /></span><strong>{item.title}</strong><small>{item.description}</small>{style === item.id && <b aria-label="Selected">✓</b>}</button>)}</div>
            </section>

            <section className="sf-commercials__panel">
              <div className="sf-commercials__step"><span>3</span><div><h2>Video quality</h2><p>Choose the generation tier for your commercial.</p></div></div>
              <div className="sf-commercials__tiers">
                <button type="button" onClick={() => setTier('standard')} className={tier === 'standard' ? 'is-selected' : ''}><span className="sf-commercials__tier-check">{tier === 'standard' ? '✓' : ''}</span><strong>Standard</strong><span>Balanced quality for everyday campaigns</span><b>{hasFreePreview ? 'Free preview' : '4 credits'}</b></button>
                <button type="button" onClick={() => setTier('premium')} className={tier === 'premium' ? 'is-selected' : ''}><span className="sf-commercials__tier-check">{tier === 'premium' ? '✓' : ''}</span><strong>Premium</strong><span>Enhanced motion and cinematic detail</span><b>{hasFreePreview ? 'Free preview' : '7 credits'}</b></button>
              </div>
            </section>

            {(notice || error) && <p className={error ? 'sf-commercials__notice sf-commercials__notice--error' : 'sf-commercials__notice'} role="status">{error || notice}</p>}
            <div className="sf-commercials__status-bar">
              <span className="sf-commercials__status-label">Status</span>
              <strong>{status}</strong>
              <small>{user?.role ? `Balance: ${balance.quickAdCredits || 0} credits` : 'Log in to view your credit balance'}</small>
            </div>

            <Button fullWidth size="lg" disabled={isSubmitting || !canAfford} onClick={handleSubmit}>
              <UiIcon name="sparkles" /> {isSubmitting ? 'Generating...' : `Generate commercial · ${hasFreePreview ? 'free preview' : `${requiredCredits} credits`}`}
            </Button>
            {!canAfford && <p className="sf-commercials__footnote">You have {balance.quickAdCredits || 0} credits available. Buy more to generate this ad.</p>}
            {hasFreePreview && <p className="sf-commercials__footnote">Your one free preview is available. Paid generations use the selected tier credits.</p>}
            {!hasFreePreview && <p className="sf-commercials__footnote">Credits are only used when a generation is successfully completed: 4 for Standard or 7 for Premium.</p>}
          </div>

          <aside className="sf-commercials__preview">
            <div className="sf-commercials__preview-top"><span>PREVIEW</span><span className="sf-commercials__live"><i/> Live setup</span></div>
            <div className="sf-commercials__preview-stage">
              {photo ? <img src={photo} alt="Product preview" /> : <div className="sf-commercials__preview-placeholder"><span><UiIcon name="video" /></span><strong>Your commercial starts here</strong><p>Upload a product photo to preview your creative setup.</p></div>}
              <span className="sf-commercials__duration">Up to 24 sec commercial</span>
            </div>
            <div className="sf-commercials__preview-details">
              <div><span>PRODUCT</span><strong>{productName || 'Your product'}</strong></div>
              <div><span>BRAND</span><strong>{brandName || 'Your brand'}</strong></div>
              <div><span>STYLE</span><strong>{styleLabel}</strong></div>
              <div><span>QUALITY</span><strong>{tier === 'standard' ? `Standard · ${hasFreePreview ? 'free preview' : '4 credits'}` : `Premium · ${hasFreePreview ? 'free preview' : '7 credits'}`}</strong></div>
            </div>
            <div className="sf-commercials__scene-note">
              <span><UiIcon name="sparkles" /></span>
              <div>
                <strong>Scene-by-scene creation</strong>
                <p>Claude directs three scenes, Nano Banana creates the scene images, and Veo animates each before final assembly and branding.</p>
              </div>
            </div>
            {logo && <div className="sf-commercials__logo-preview"><span>Logo uploaded</span><img src={logo} alt="Brand logo preview" /></div>}
            {photoFile && <small className="sf-commercials__file-meta">Product: {toFileSizeLabel(photoFile.size)}</small>}
            {logoFile && <small className="sf-commercials__file-meta">Logo: {toFileSizeLabel(logoFile.size)}</small>}
          </aside>
        </div>
      </>
    )}
  </main>;
}
