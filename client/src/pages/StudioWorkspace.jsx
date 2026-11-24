import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { BrandingSwitch, appendBranding } from '../components/QuickAdBranding';
import CreditPurchaseDialog from '../components/CreditPurchaseDialog';
import GenerationProgress from '../components/GenerationProgress';
import { Button } from '../components/ui';
import { quickAdsBaseUrl, quickAdsUrl, quickAdsAuth, newGenerationKey, generationVideoUrl } from '../utils/quickAdsApi';
import { jobStatus, recoveryPath } from '../utils/studioJobs';
import QuickAd from './QuickAd';
import FashionModelPicker from '../components/FashionModelPicker';
import fashionModels from '../data/fashionModels.json';
import { STUDIO_CARDS } from './Studios';
import './QuickAd.css';
import './Studios.css';
import './StudioWorkspace.css';

const viewNames = ['front', 'side', 'rear', 'interior', 'dashboard', 'detail'];
const defaultMode = studio => studio === 'fashion' ? 'fashion_mannequin' : studio === 'auto' ? 'auto_cinematic' : studio === 'quick' ? 'quick_ad' : 'product_studio';
export function validateStudioFiles(files, max = 5) {
  return files.length > 0 && files.length <= max && files.every(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size > 0 && file.size <= 8 * 1024 * 1024);
}
function savedJob(storage, params) {
  try { return params.get('job') || localStorage.getItem(storage) || ''; } catch { return params.get('job') || ''; }
}
function videoSource(job) {
  try { return generationVideoUrl(job); } catch { return ''; }
}
export default function StudioWorkspace() {
  const { studio } = useParams();
  const [params, setParams] = useSearchParams();
  const { token, user } = useContext(AuthContext);
  const card = STUDIO_CARDS.find(item => item.id === studio);
  const storage = `spreadfast-studio:${user?.id}:${studio}`;
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState(false);
  const [models, setModels] = useState(fashionModels);
  const [mode, setMode] = useState(() => defaultMode(studio));
  const [files, setFiles] = useState([]);
  const [views, setViews] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [values, setValues] = useState({ style: 'luxury', category: 'shoes', background: 'studio', motion: 'pose', condition: '' });
  const [branding, setBranding] = useState({ mode: 'none' });
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState('');
  const [progressError, setProgressError] = useState('');
  const [job, setJob] = useState(null);
  const [jobId, setJobId] = useState(() => savedJob(storage, params));
  const [pollRevision, setPollRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState(0);
  const [showCredits, setShowCredits] = useState(false);
  const [script, setScript] = useState(null);
  const requestKey = useRef(null);
  const submitting = useRef(false);
  const resultRef = useRef(null);
  const choices = (catalog || []).filter(item => item.studio === studio);
  const selected = choices.find(item => item.mode === mode);
  const pending = job?.status === 'pending';
  const locked = busy || pending || (!!jobId && !job);
  const voiceover = mode === 'auto_voiceover';
  const modelMode = mode.startsWith('fashion_model_');
  const urlJob = params.get('job');

  const loadCredits = useCallback(async () => {
    try {
      const { data } = await axios.get(quickAdsUrl('/credits'), { headers: quickAdsAuth(token), timeout: 15000 });
      setBalance(data.quickAdCredits);
    } catch { setError('Could not refresh your credits. Try again in a moment.'); }
  }, [token]);
  const loadCatalog = useCallback(async () => {
    setCatalogError(false);
    try {
      const { data } = await axios.get(`${quickAdsBaseUrl()}/api/studios/catalog`, { timeout: 15000 });
      setCatalog(data.modes || []);
      setModels(data.models?.length ? data.models : fashionModels);
    } catch { setCatalogError(true); }
  }, []);
  useEffect(() => { loadCatalog(); loadCredits(); }, [loadCatalog, loadCredits]);
  useEffect(() => {
    window.addEventListener('focus', loadCredits);
    return () => window.removeEventListener('focus', loadCredits);
  }, [loadCredits]);
  useEffect(() => { if (urlJob) { setJobId(urlJob); setJob(null); } }, [urlJob]);
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  useEffect(() => {
    if (!jobId) return undefined;
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const { data } = await axios.get(quickAdsUrl(`/generations/${encodeURIComponent(jobId)}`), { headers: quickAdsAuth(token), signal: controller.signal, timeout: 20000 });
        if (controller.signal.aborted) return;
        setJob(data); setProgressError(''); setBalance(data.quickAdCredits);
        if (data.generationMode) setMode(data.generationMode);
        if (data.status === 'pending') timer = setTimeout(poll, 4000);
        else { requestKey.current = null; try { localStorage.removeItem(storage); } catch { /* Optional resume shortcut. */ } }
      } catch (failure) {
        if (controller.signal.aborted) return;
        setProgressError('Progress could not be refreshed. Your saved ad is still in My Ads.');
        if (![403, 404].includes(failure.response?.status)) timer = setTimeout(poll, 8000);
      }
    }
    poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [jobId, token, storage, pollRevision]);
  useEffect(() => {
    if (!voiceover || studio !== 'auto') return undefined;
    const controller = new AbortController();
    setScript(null);
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.post(`${quickAdsBaseUrl()}/api/studios/narration-preview`, values, { headers: quickAdsAuth(token), signal: controller.signal });
        if (!controller.signal.aborted) setScript(data);
      } catch { if (!controller.signal.aborted) setScript({ error: true }); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [voiceover, studio, values, token]);
  useEffect(() => {
    if (jobId) resultRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [jobId]);

  function setValue(name, value) {
    requestKey.current = null;
    setValues(current => ({ ...current, [name]: value }));
  }
  function changeMode(next) {
    if (locked || next === mode) return;
    setMode(next); setError(''); requestKey.current = null;
    setValues(current => ({ ...current, motion: next === 'fashion_model_10s' ? 'walk' : 'pose' }));
  }
  function addPhotos(event) {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';
    if (!incoming.length) return;
    const next = modelMode ? incoming : [...files, ...incoming];
    const maximum = selected?.images || (modelMode ? 1 : 5);
    if (!validateStudioFiles(next, maximum)) { setError(`Choose up to ${maximum} JPG, PNG or WEBP photo${maximum === 1 ? '' : 's'}, no larger than 8 MB each.`); return; }
    setFiles(next); setViews(current => next.map((_, index) => current[index] || viewNames[index]));
    setError(''); requestKey.current = null;
  }
  function movePhoto(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const reorder = items => { const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; };
    setFiles(reorder); setViews(reorder); requestKey.current = null;
  }
  function startAnother() {
    requestKey.current = null; setJobId(''); setJob(null); setError(''); setProgressError('');
    try { localStorage.removeItem(storage); } catch { /* No persisted shortcut. */ }
    setParams({}, { replace: true });
  }
  async function generate(event) {
    event.preventDefault();
    if (submitting.current || locked || !selected?.available) return;
    if (balance < selected.credits) { setShowCredits(true); return; }
    if (!validateStudioFiles(files, selected.images) || (studio === 'auto' && files.length < 2)) { setError(studio === 'auto' ? 'Add at least two vehicle photos.' : 'Choose a valid product photo.'); return; }
    if (voiceover && script?.withinLimit === false) { setError('Shorten the sales details to fit the voiceover preview.'); return; }
    submitting.current = true; setBusy(true); setError(''); setUpload(0);
    try {
      requestKey.current ||= newGenerationKey();
      const form = new FormData(); form.append('mode', mode);
      files.forEach(file => form.append('images', file));
      Object.entries(values).forEach(([name, value]) => form.append(name, String(value)));
      if (studio === 'auto') form.append('sourceViews', JSON.stringify(views));
      appendBranding(form, branding);
      const { data } = await axios.post(`${quickAdsBaseUrl()}/api/studios/jobs`, form, {
        headers: { ...quickAdsAuth(token), 'Idempotency-Key': requestKey.current }, timeout: 120000,
        onUploadProgress: event => setUpload(event.total ? Math.round(event.loaded / event.total * 100) : 0)
      });
      setJob(data); setJobId(data.generationId);
      try { localStorage.setItem(storage, data.generationId); } catch { /* My Ads retains the job. */ }
      if (data.status !== 'pending') requestKey.current = null;
    } catch (failure) {
      if (failure.response?.data?.code === 'NO_QUICK_AD_CREDITS') { setShowCredits(true); loadCredits(); }
      else setError(failure.response?.data?.message || failure.message || 'Could not submit your ad. Try again to check the same request.');
      if (failure.response && failure.response.status < 500 && failure.response.status !== 409) requestKey.current = null;
    } finally { submitting.current = false; setBusy(false); }
  }
  async function review(action) {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await axios.post(`${quickAdsBaseUrl()}/api/studios/jobs/${encodeURIComponent(jobId)}/${action}`, {}, { headers: quickAdsAuth(token) });
      const { data } = await axios.get(quickAdsUrl(`/generations/${encodeURIComponent(jobId)}`), { headers: quickAdsAuth(token) });
      setJob(data); setPollRevision(value => value + 1);
    } catch (failure) { setError(failure.response?.data?.message || 'Could not save your decision. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function retry() {
    if (submitting.current) return;
    if (balance < job.creditCost) { setShowCredits(true); return; }
    submitting.current = true; setBusy(true); setError('');
    const previous = job;
    setJob({ ...job, status: 'pending', stage: 'applying_branding' });
    setPollRevision(value => value + 1);
    try {
      await axios.post(`${quickAdsBaseUrl()}${recoveryPath(job)}`, {}, { headers: quickAdsAuth(token), timeout: 120000 });
      setPollRevision(value => value + 1);
    } catch (failure) {
      setJob(previous);
      if (failure.response?.data?.code === 'NO_QUICK_AD_CREDITS') { setShowCredits(true); loadCredits(); }
      else setError(failure.response?.data?.message || 'Could not resume this video. Your saved work is safe.');
    } finally { submitting.current = false; setBusy(false); }
  }
  const field = (name, label, required = false, type = 'text') => <label key={name}>{label}<input type={type} required={required}
    maxLength={name === 'features' ? 300 : 80} value={values[name] || ''} onChange={event => setValue(name, event.target.value)} /></label>;
  const vehicleIdentity = required => <div className="sf-studio-fields">{field('manufacturer', 'Make', required)}{field('vehicleModel', 'Model', required)}{field('year', 'Year', required, 'number')}</div>;
  if (!card) return <main className="sf-studios"><h1>Choose your studio</h1><Link to="/create">Explore all studios</Link></main>;
  const showLegacy = !jobId && (studio === 'quick' || mode === 'fashion_mannequin');
  return <main className="sf-studios sf-workspace">
    <Link className="sf-studio-back" to="/create">All studios</Link>
    <header className="sf-studio-workspace-hero"><div><h1>{card.name}</h1><p>{studio === 'fashion' ? 'Bring your outfit to life.' : studio === 'auto' ? 'Give buyers a closer look.' : 'Turn your product photos into a short video.'}</p></div><img src={card.image} alt="" width="88" height="88" /></header>
    {!jobId && studio === 'fashion' && <div className="sf-workspace-choices">
      <div className="sf-segmented" role="group" aria-label="Fashion presentation">
        <button type="button" disabled={locked} aria-pressed={mode === 'fashion_mannequin'} onClick={() => changeMode('fashion_mannequin')}>Mannequin</button>
        <button type="button" disabled={locked} aria-pressed={modelMode} onClick={() => changeMode(modelMode ? mode : 'fashion_model_5s')}>AI Model</button>
      </div>
      {modelMode && <div className="sf-segmented sf-duration" role="group" aria-label="Video duration">{[5, 10].map(seconds => <button key={seconds} type="button" disabled={locked} aria-pressed={mode === `fashion_model_${seconds}s`} onClick={() => changeMode(`fashion_model_${seconds}s`)}>{seconds}s</button>)}</div>}
    </div>}
    {!jobId && studio === 'auto' && <div className="sf-segmented" role="group" aria-label="Auto presentation">
      <button type="button" disabled={locked} aria-pressed={!voiceover} onClick={() => changeMode('auto_cinematic')}>Showcase · 10s</button>
      <button type="button" disabled={locked} aria-pressed={voiceover} onClick={() => changeMode('auto_voiceover')}>With voiceover · 15s</button>
    </div>}
    {catalogError && <p role="alert">Could not load studio availability. <button className="sf-text-button" onClick={loadCatalog}>Try again</button></p>}
    {showLegacy ? <QuickAd dedicatedFashion={studio === 'fashion'} embedded /> : jobId ? <section ref={resultRef} className="sf-studio-panel sf-job-result" aria-label="Advertisement preview">
      <h2>{job ? jobStatus(job) : 'Opening your saved ad'}</h2>
      {job?.status === 'pending' && job.stage !== 'awaiting_approval' && <GenerationProgress job={job} />}
      {job?.imageUrl && job.status !== 'completed' && <img className="sf-studio-preview" src={job.imageUrl} alt="Your generated outfit or product preview" />}
      {job?.stage === 'awaiting_approval' && <><p>Check the colour, fit, embroidery and details before making your video.</p><div className="sf-result-actions"><Button disabled={busy} onClick={() => review('approve')}>{busy ? 'Saving…' : 'Approve and create video'}</Button><Button disabled={busy} variant="secondary" onClick={() => review('cancel')}>Cancel without charge</Button></div></>}
      {job?.status === 'completed' && <>{videoSource(job) ? <video className="sf-studio-preview" src={videoSource(job)} controls playsInline /> : <p>Your ad is saved. Open My Ads to load the video.</p>}<div className="sf-result-actions"><Button onClick={startAnother}>Create another ad</Button><Link to="/my-ads">View and download</Link></div></>}
      {job?.status === 'failed' && <><p>{job.cancelled ? 'Your try-on was cancelled. No credits were charged.' : 'No credits were charged. Your saved work stays in My Ads.'}</p><div className="sf-result-actions">{recoveryPath(job) && <Button disabled={busy} onClick={retry}>Retry finishing video</Button>}<Button variant="secondary" disabled={busy} onClick={startAnother}>Create another ad</Button></div></>}
      {progressError && <p role="alert">{progressError} <button className="sf-text-button" onClick={() => setPollRevision(value => value + 1)}>Check again</button></p>}
      {job?.status !== 'completed' && <Link to="/my-ads">Open My Ads</Link>}
    </section> : <form onSubmit={generate} className="sf-studio-panel sf-studio-form">
      <fieldset disabled={locked}>
        <legend>{studio === 'fashion' ? 'Your outfit' : studio === 'auto' ? 'Vehicle photos' : 'Your product'}</legend>
        <label className="sf-studio-upload"><strong>{files.length ? 'Add or change photos' : 'Choose photos'}</strong><span>{modelMode ? 'One clear front photo' : studio === 'auto' ? '2–5 views of the same vehicle' : 'Up to five views of the same product'} · Up to 8 MB each</span><input aria-label="Upload photographs" type="file" multiple={!modelMode} accept="image/jpeg,image/png,image/webp" onChange={addPhotos} /></label>
        <div className={`sf-upload-previews${studio === 'auto' ? ' sf-vehicle-photos' : ''}`}>{previews.map((url, index) => <figure key={url}><img src={url} alt={`Uploaded view ${index + 1}`} />
          {studio === 'auto' && <><label className="sr-only" htmlFor={`view-${index}`}>Photo {index + 1} view</label><select id={`view-${index}`} value={views[index]} onChange={event => { const value = event.target.value; setViews(current => current.map((view, i) => i === index ? value : view)); requestKey.current = null; }}>{viewNames.map(view => <option key={view} value={view}>{view[0].toUpperCase() + view.slice(1)}</option>)}</select><div className="sf-photo-order"><button type="button" disabled={index === 0} aria-label={`Move photo ${index + 1} earlier`} onClick={() => movePhoto(index, -1)}>Earlier</button><button type="button" disabled={index === files.length - 1} aria-label={`Move photo ${index + 1} later`} onClick={() => movePhoto(index, 1)}>Later</button></div></>}
          <button type="button" onClick={() => { setFiles(current => current.filter((_, i) => i !== index)); setViews(current => current.filter((_, i) => i !== index)); requestKey.current = null; }} aria-label={`Remove uploaded view ${index + 1}`}>Remove</button>
        </figure>)}</div>
        {studio === 'auto' && files.length > 0 && <p>Arrange your photos in order. Your {voiceover ? 'first three views' : 'first two views'} make the video{voiceover && files.length === 2 ? '; the first view also closes the ad' : ''}.</p>}
        {studio === 'product' && <div className="sf-studio-fields"><label>Product type<select value={values.category} onChange={event => setValue('category', event.target.value)}>{['shoes', 'bags', 'watches', 'jewellery', 'perfumes', 'electronics', 'other'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label><label>Style<select value={values.style} onChange={event => setValue('style', event.target.value)}>{[['luxury', 'Clean showcase'], ['reveal', 'Cinematic reveal'], ['rotation', 'Gentle rotation'], ['lifestyle', 'Lifestyle']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>}
        {modelMode && <><FashionModelPicker models={models} value={values.modelId} onChange={id => setValue('modelId', id)} /><p className="sf-workspace-hint">Your model keeps this studio background. You’ll review the outfit before animation.</p></>}
        {studio === 'auto' && <>
          {voiceover && vehicleIdentity(true)}
          <details className="sf-studio-extras"><summary>{voiceover ? 'Sales details' : 'Vehicle details'} <span>Optional</span></summary>{!voiceover && vehicleIdentity(false)}
            <div className="sf-studio-fields">{field('price', 'Price, including currency')}{field('location', 'Location')}{field('dealership', 'Dealership')}{field('mileage', 'Mileage, including unit')}{field('contact', 'Contact')}</div>
            {field('features', 'Features')}<label>Condition<select value={values.condition} onChange={event => setValue('condition', event.target.value)}><option value="">Not specified</option>{['new', 'foreign used', 'locally used'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
          </details>
          {voiceover && <div className="sf-narration-preview" aria-live="polite"><strong>Voiceover preview</strong><p>{script?.error ? 'The preview could not load. Your details will be checked before generation.' : script?.script || 'Add the make, model and year to preview your voiceover.'}</p>{script?.script && <small>{script.words}/32 words · {script.characters}/230 characters</small>}{script?.withinLimit === false && <p role="alert">Shorten the sales details so the complete script fits 15 seconds.</p>}</div>}
        </>}
        <BrandingSwitch value={branding} disabled={locked} onChange={value => { requestKey.current = null; setBranding(value); }} />
        <details className="sf-studio-extras"><summary>More options</summary>{field('title', 'Ad title')}
          {!modelMode && <label>Instructions<textarea maxLength={500} value={values.instructions || ''} onChange={event => setValue('instructions', event.target.value)} placeholder="Anything we should pay attention to?" /></label>}
          {studio === 'auto' && <label className="sf-inline-check"><input type="checkbox" checked={!!values.enhance} onChange={event => setValue('enhance', event.target.checked)} />Improve photo lighting</label>}
        </details>
      </fieldset>
      {error && <p className="sf-studio-error" role="alert">{error}</p>}
      <div className="sf-studio-submit"><div><span>{selected ? `${selected.duration} seconds · ${selected.credits} ${selected.credits === 1 ? 'credit' : 'credits'}` : 'Loading pricing…'}</span><small>{balance === null ? 'Loading balance…' : `${balance} credits available`}</small></div>
        <Button type="submit" disabled={locked || !selected?.available || balance === null || (!files.length && balance >= selected?.credits) || (modelMode && !values.modelId && balance >= selected?.credits)}>{busy ? `Uploading · ${upload}%` : 'Generate video'}</Button>
      </div>
      {catalog && !selected?.available && <p role="status" className="sf-workspace-hint">This presentation isn’t available yet. You can explore the options above.</p>}
    </form>}
    {jobId && error && <p className="sf-studio-error" role="alert">{error}</p>}
    <CreditPurchaseDialog open={showCredits} onClose={() => setShowCredits(false)} balance={balance || 0} requiredCredits={job?.creditCost || selected?.credits || 1} />
  </main>;
}
