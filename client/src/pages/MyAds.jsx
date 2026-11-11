import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import QuickAdHistoryVideo from '../components/QuickAdHistoryVideo';
import UiIcon from '../components/ui/UiIcon';
import { Button } from '../components/ui';
import { quickAdsAuth, quickAdsUrl, quickAdsBaseUrl } from '../utils/quickAdsApi';
import './QuickAd.css';
import './Studios.css';
const filters=[['','All Ads'],['quick','Quick Ads'],['fashion','Fashion'],['auto','Auto'],['product','Products'],['commercial','Commercials']];
export default function MyAds(){
  const {token}=useContext(AuthContext);const [rows,setRows]=useState([]),[filter,setFilter]=useState(''),[page,setPage]=useState(1),[error,setError]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0),[editing,setEditing]=useState(null),[title,setTitle]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');axios.get(quickAdsUrl(`/generations?page=${page}&limit=12&studio=${filter}`),{headers:quickAdsAuth(token),signal:controller.signal}).then(({data})=>{if(!controller.signal.aborted)setRows(data.generations || []);}).catch(()=>{if(!controller.signal.aborted)setError('Could not load your advertisements.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[filter,page,revision,token]);
  async function action(item,kind){if(busy)return;setBusy(true);setError('');try{
    const path=quickAdsUrl(`/generations/${encodeURIComponent(item.generationId)}`),options={headers:quickAdsAuth(token)};
    if(kind==='retry'){await axios.post(`${quickAdsBaseUrl()}/api/studios/jobs/${item.generationId}/retry`,{},options);setRevision(r=>r+1);}
    if(kind==='delete'){if(!window.confirm('Delete this advertisement from your history? Credits are not refunded.'))return;await axios.delete(path,options);setRows(current=>current.filter(r=>r.generationId!==item.generationId));}
    if(kind==='edit'){await axios.patch(path,{title},options);setEditing(null);setRevision(r=>r+1);}
    if(kind==='download'){const {data}=await axios.get(`${path}/download`,{...options,responseType:'blob'});const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download='spreadfast-ad.mp4';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }catch(e){setError(e.response?.data?.message || `Could not ${kind} this advertisement.`);}finally{setBusy(false);}}
  return <main className="sf-studios"><h1>My Ads</h1><p>Your advertisements from every SpreadFast studio.</p><nav className="sf-studio-options" aria-label="Filter advertisements">{filters.map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>{setFilter(id);setPage(1);}}>{label}</button>)}</nav>
    {error && <p role="alert">{error}</p>}{loading && <p role="status">Loading advertisements…</p>}
    {!loading && !rows.length && <p>No advertisements here yet. <Link to="/create">Create an ad</Link></p>}
    <div className="quick-ad-history-grid">{rows.map(item=><article className="quick-ad-history-card" key={item.generationId}><QuickAdHistoryVideo item={item} token={token}/><div className="sf-studio-panel"><strong>{item.title || 'Your advertisement'}</strong><p>{filters.find(([id])=>id===item.studioType)?.[1] || 'Quick Ad'} · {item.duration || 5} seconds</p><p>{item.stage?.replace(/_/g,' ') || item.status} · {item.creditsUsed || 0} credits used</p><p>{new Date(item.createdAt).toLocaleDateString()}</p>
      {item.status==='pending' && <Link to={item.studioType==='commercial'?'/ai-commercials':item.generationMode?`/studios/${item.studioType}?job=${item.generationId}`:'/quick-ad'}>View progress</Link>}
      {item.studioRetryAvailable && <Button disabled={busy} onClick={()=>action(item,'retry')}>Retry finishing saved video</Button>}
      <div className="sf-studio-options"><Button variant="ghost" aria-label="Download advertisement" disabled={busy||!item.downloadable} onClick={()=>action(item,'download')}><UiIcon name="download"/></Button><Button variant="ghost" aria-label="Edit advertisement title" disabled={busy||item.status==='pending'} onClick={()=>{setEditing(item.generationId);setTitle(item.title || '');}}><UiIcon name="edit"/></Button><Button variant="ghost" aria-label="Delete advertisement" disabled={busy||item.status==='pending'} onClick={()=>action(item,'delete')}><UiIcon name="trash"/></Button></div>
      {editing===item.generationId && <form onSubmit={e=>{e.preventDefault();action(item,'edit');}}><label>Advertisement title<input aria-label="Advertisement title" required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label><p>Title changes are free and do not change the video.</p><Button type="submit" disabled={busy}>Save title</Button><Button variant="secondary" onClick={()=>setEditing(null)}>Cancel</Button></form>}
    </div></article>)}</div><div className="sf-studio-options"><Button disabled={loading||page===1} onClick={()=>setPage(p=>p-1)}>Previous</Button><span>Page {page}</span><Button disabled={loading||rows.length<12} onClick={()=>setPage(p=>p+1)}>Next</Button><Button variant="secondary" onClick={()=>setRevision(r=>r+1)}>Refresh</Button></div></main>;
}
