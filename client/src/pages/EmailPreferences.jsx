import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Button } from '../components/ui';
import { readResponse } from '../utils/readResponse';
export default function EmailPreferences() {
  const { token } = useContext(AuthContext);
  const [subscribed,setSubscribed]=useState(false), [busy,setBusy]=useState(true), [message,setMessage]=useState('');
  const url=(process.env.REACT_APP_API_URL || 'http://localhost:5000')+'/api/email-marketing/preferences';
  useEffect(()=>{ fetch(url,{headers:{Authorization:`Bearer ${token}`}}).then(readResponse).then(r=>setSubscribed(r.subscribed)).catch(e=>setMessage(e.message)).finally(()=>setBusy(false)); },[token,url]);
  async function save(){ setBusy(true); setMessage(''); try { const r=await readResponse(await fetch(url,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({subscribed})})); setSubscribed(r.subscribed); setMessage('Your email preference has been saved.'); } catch(e){setMessage(e.message);} finally{setBusy(false);} }
  return <main className="sf-container" style={{maxWidth:600,paddingTop:48}}><Link to="/"><img src="/spreadfast-logo.png" width="180" height="60" alt="SpreadFast" /></Link><h1>Email preferences</h1><p style={{margin:'24px 0'}}>Advertising tips, product updates and inspiration, up to four times weekly.</p><label><input type="checkbox" checked={subscribed} disabled={busy} onChange={e=>setSubscribed(e.target.checked)} /> Send me SpreadFast marketing emails</label><p style={{margin:'24px 0'}}>Account, payment and password emails continue regardless of this setting.</p><Button disabled={busy} onClick={save}>Save preference</Button><p role="status">{message}</p></main>;
}
