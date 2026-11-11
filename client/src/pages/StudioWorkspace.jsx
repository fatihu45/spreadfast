import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import QuickAdBranding, { appendBranding } from '../components/QuickAdBranding';
import { Button } from '../components/ui';
import { quickAdsBaseUrl, quickAdsUrl, quickAdsAuth, newGenerationKey, generationVideoUrl } from '../utils/quickAdsApi';
import QuickAd from './QuickAd';
import './QuickAd.css';
import './Studios.css';
const labels={ fashion_mannequin:'Invisible Mannequin', fashion_model_5s:'Fashion Motion · 5 seconds', fashion_model_10s:'Fashion Walk · 10 seconds', product_studio:'Product advertisement', auto_cinematic:'Cinematic Showcase · 10 seconds', auto_voiceover:'Sales Advertisement · 15 seconds' };
const stages=['queued','preparing_images','generating_images','generating_video','generating_voiceover','assembling_video','applying_branding','completed'];
export function validateStudioFiles(files,max=5) {
  return files.length>0 && files.length<=max && files.every(f=>['image/jpeg','image/png','image/webp'].includes(f.type) && f.size>0 && f.size<=8*1024*1024);
}
export default function StudioWorkspace(){
  const {studio}=useParams(); const [params]=useSearchParams();
  const {token,user}=useContext(AuthContext); const headers=quickAdsAuth(token);
  const [catalog,setCatalog]=useState(null),[models,setModels]=useState([]),[mode,setMode]=useState(studio==='fashion'?'fashion_mannequin':studio==='auto'?'auto_cinematic':'product_studio');
  const [files,setFiles]=useState([]),[previews,setPreviews]=useState([]),[values,setValues]=useState({style:'luxury',category:'shoes',background:'studio',motion:'pose',condition:'foreign used'});
  const [branding,setBranding]=useState({mode:'none'}),[balance,setBalance]=useState(null),[error,setError]=useState(''),[job,setJob]=useState(null),[busy,setBusy]=useState(false),[upload,setUpload]=useState(0);
  const key=useRef(null); const storage=`spreadfast-studio:${user?.id}:${studio}`;
  const [jobId,setJobId]=useState(()=>{try{return params.get('job') || localStorage.getItem(storage) || '';}catch{return params.get('job') || '';}});
  useEffect(()=>{let active=true; Promise.all([axios.get(`${quickAdsBaseUrl()}/api/studios/catalog`),axios.get(quickAdsUrl('/credits'),{headers:quickAdsAuth(token)})]).then(([a,b])=>{if(active){setCatalog(a.data.modes);setModels(a.data.models);setBalance(b.data.quickAdCredits);}}).catch(()=>{if(active)setError('Could not load this studio. Refresh to try again.');});return()=>{active=false;};},[token]);
  useEffect(()=>{const urls=files.map(f=>URL.createObjectURL(f));setPreviews(urls);return()=>urls.forEach(URL.revokeObjectURL);},[files]);
  useEffect(()=>{if(!jobId)return undefined;let active=true;
    const poll=()=>axios.get(quickAdsUrl(`/generations/${encodeURIComponent(jobId)}`),{headers:quickAdsAuth(token)}).then(({data})=>{if(active){setJob(data);setBalance(data.quickAdCredits);}}).catch(()=>{if(active)setError('Could not retrieve progress. Your job remains saved in My Ads.');});
    poll();const timer=setInterval(poll,4000);return()=>{active=false;clearInterval(timer);};},[jobId,token]);
  const choices=(catalog || []).filter(m=>m.studio===studio),selected=choices.find(m=>m.mode===mode);
  const pending=job?.status==='pending';
  const set=(name,value)=>{key.current=null;setValues(v=>({...v,[name]:value}));};
  async function generate(event){event.preventDefault();if(busy)return;setError('');setBusy(true);key.current ||=newGenerationKey();
    try{if(!validateStudioFiles(files,selected?.images))throw new Error('Choose valid photos, up to 8 MB each.');
      const form=new FormData();form.append('mode',mode);files.forEach(f=>form.append('images',f));Object.entries(values).forEach(([k,v])=>form.append(k,String(v)));appendBranding(form,branding);
      const {data}=await axios.post(`${quickAdsBaseUrl()}/api/studios/jobs`,form,{headers:{...headers,'Idempotency-Key':key.current},onUploadProgress:e=>setUpload(e.total?Math.round(e.loaded/e.total*100):0),timeout:120000});
      setJob(data);setJobId(data.generationId);try{localStorage.setItem(storage,data.generationId);}catch{/* My Ads still retains the job. */}
    }catch(e){setError(e.response?.data?.message || e.message || 'Could not submit your ad. Retry with the same request.');}finally{setBusy(false);}}
  async function review(action){setBusy(true);setError('');try{await axios.post(`${quickAdsBaseUrl()}/api/studios/jobs/${jobId}/${action}`,{}, {headers}); const {data}=await axios.get(quickAdsUrl(`/generations/${jobId}`),{headers});setJob(data);}catch(e){setError(e.response?.data?.message || 'Could not save your decision.');}finally{setBusy(false);}}
  const field=(name,label,required=false,type='text')=><label key={name}>{label}<input type={type} required={required} maxLength={name==='features'?300:80} value={values[name] || ''} onChange={e=>set(name,e.target.value)} /></label>;
  return <main className="sf-studios"><Link to="/create">← All studios</Link><h1>{studio==='auto'?'Turn Car Photos Into Professional Video Ads.':studio==='fashion'?'Fashion Studio':'Product Studio'}</h1>
    <p>{studio==='auto'?'Showcase your vehicles with cinematic motion, dealership branding, and optional AI narration.':'Choose your presentation and keep your product in focus.'}</p>
    <div className="sf-studio-options">{(studio==='fashion'?[{mode:'fashion_mannequin'},...choices.filter(m=>m.mode!=='fashion_mannequin')]:choices).map(m=><button key={m.mode} type="button" disabled={busy||pending} aria-pressed={mode===m.mode} onClick={()=>{setMode(m.mode);key.current=null;setFiles([]);}}>{labels[m.mode]}</button>)}</div>
    {studio==='fashion' && mode==='fashion_mannequin' ? <QuickAd dedicatedFashion /> : <div className="sf-studio-workspace">
      <form onSubmit={generate} className="sf-studio-panel"><p>{balance ?? '…'} credits available · <Link to="/quickads/credits">Buy credits</Link></p>
        <fieldset disabled={busy||pending}><legend>Product photographs</legend><label>Upload photographs<input aria-label="Upload photographs" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{const next=Array.from(e.target.files || []);if(!validateStudioFiles(next,selected?.images)){setError('Choose JPG, PNG or WEBP files, up to 8 MB each.');return;}setError('');setFiles(next);key.current=null;}} /></label>
          <p>{studio==='auto'?'Add 2–5 views: front, side, rear, interior and dashboard.':studio==='fashion'?'Upload the front garment photo. A back photo is optional; try-on uses the front.':'Add up to five views of the same product.'}</p>
          <div className="sf-upload-previews">{previews.map((url,i)=><img key={url} src={url} alt={`Uploaded view ${i+1}`} />)}</div>
          {field('title','Advertisement title')}
          {studio==='product' && <><label>Category<select value={values.category} onChange={e=>set('category',e.target.value)}>{['shoes','bags','watches','jewellery','perfumes','electronics','other'].map(v=><option key={v}>{v}</option>)}</select></label><label>Style<select value={values.style} onChange={e=>set('style',e.target.value)}>{[['rotation','Product Rotation'],['luxury','Luxury Showcase'],['reveal','Cinematic Reveal'],['lifestyle','Lifestyle']].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><p>Unseen surfaces may be estimated by AI. Supply multiple views and check the result.</p></>}
          {studio==='fashion' && <><label>Model<select required value={values.modelId||''} onChange={e=>set('modelId',e.target.value)}><option value="">Select a model</option>{models.map(m=><option key={m.id} value={m.id}>{m.label}{m.modest?' · modest presentation':''}</option>)}</select></label><div className="sf-upload-previews">{models.filter(m=>m.id===values.modelId).map(m=><img key={m.id} src={m.image} alt={m.label} />)}</div><p>Background: selected model’s studio. Select presentation yourself; we do not infer identity from clothing.</p><label>Motion<select value={values.motion} onChange={e=>set('motion',e.target.value)}><option value="pose">Subtle pose</option><option value="walk">Slow walk</option></select></label><p>You will review the try-on before animation. Check colours, embroidery, seams and every garment component. Accuracy is not guaranteed.</p></>}
          {studio==='auto' && <><div className="sf-studio-fields">{[['manufacturer','Manufacturer'],['vehicleModel','Model'],['year','Model year'],['price','Price (include currency)'],['location','Location'],['dealership','Dealership name']].map(([n,l])=>field(n,l,true))}{field('mileage','Mileage (optional)')}{field('features','Additional features (optional)')}{field('contact','Contact information (optional)')}</div><label>Condition<select value={values.condition} onChange={e=>set('condition',e.target.value)}>{['new','foreign used','locally used'].map(v=><option key={v}>{v}</option>)}</select></label><label><input type="checkbox" checked={!!values.enhance} onChange={e=>set('enhance',e.target.checked)} /> Enhance image lighting before animation</label><p>Only supplied vehicle details are used. Verify all facts before publishing.</p></>}
          <label>Additional specifications<textarea maxLength={500} value={values.instructions||''} onChange={e=>set('instructions',e.target.value)} /></label>
          <QuickAdBranding value={branding} onChange={v=>{key.current=null;setBranding(v);}} />
        </fieldset>
        <p>{selected?.credits ? `${selected.credits} credits · ${selected.duration} seconds` : 'Loading pricing…'}</p>
        {!selected?.available && <p role="status">{selected?.reason || 'This studio is being prepared.'}</p>}
        {busy && <p role="status">Uploading: {upload}%</p>}
        <Button type="submit" disabled={busy||pending||!selected?.available||!files.length||balance<selected?.credits}>Generate advertisement</Button>
      </form>
      <section className="sf-studio-panel" aria-label="Advertisement preview"><h2>Preview</h2>
        {job ? <><p role="status">{job.stage?.replace(/_/g,' ')}</p>{pending && job.stage!=='awaiting_approval' && <><progress max="100" value={Math.max(5,stages.indexOf(job.stage)*12)} /><p>Progress reflects completed stages. You can leave and return through My Ads.</p></>}
          {job.imageUrl && job.status!=='completed' && <img className="sf-studio-preview" src={job.imageUrl} alt="Generated result — check product accuracy" />}
          {job.stage==='awaiting_approval' && <><p>Check the complete outfit before continuing. Approving starts video generation at the displayed credit cost.</p><Button disabled={busy} onClick={()=>review('approve')}>Approve outfit and animate</Button><Button disabled={busy} variant="secondary" onClick={()=>review('cancel')}>Reject and cancel</Button></>}
          {job.status==='completed' && <video className="sf-studio-preview" src={generationVideoUrl(job)} controls playsInline />}
          {job.status==='failed' && <p>No credits were charged. Saved assets remain available for support recovery.</p>}
          <Link to="/my-ads">View in My Ads</Link></> : <p>Your advertisement will appear here.</p>}
      </section>
    </div>}{error && <p role="alert">{error}</p>}</main>;
}
