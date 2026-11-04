import React, { useContext, useEffect, useState, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Button, Input, FormField } from './ui';
import { readResponse } from '../utils/readResponse';
import './AdminEmails.css';
const API = (process.env.REACT_APP_API_URL || 'http://localhost:5000') + '/api/email-marketing/admin';
export default function AdminEmails() {
  const { token } = useContext(AuthContext);
  const [data, setData] = useState(null), [form, setForm] = useState(null), [settings, setSettings] = useState(null);
  const [preview, setPreview] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const testKey = useRef(null);
  async function request(path = '', method = 'GET', body, headers = {}) {
    return readResponse(await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }));
  }
  async function load() { const r = await request(); setData(r); setSettings(r.settings); setForm(f => f || r.starter); }
  useEffect(() => { load().catch(e => setMessage(e.message)); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(fn) { setBusy(true); setMessage(''); try { await fn(); } catch(e) { setMessage(e.message); } finally { setBusy(false); } }
  function change(key, value) { setForm({ ...form, [key]: value }); setPreview(''); testKey.current = null; }
  async function uploadImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage('Choose a JPG, PNG or WebP image smaller than 5 MB.'); return;
    }
    await act(async () => {
      setMessage('Uploading image…');
      const body = new FormData(); body.append('image', file);
      const result = await readResponse(await fetch(API + '/images', { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body, signal: AbortSignal.timeout(70000) }));
      setForm(current => ({ ...current, imageUrl:result.imageUrl }));
      setPreview(''); testKey.current = null; setMessage('Image uploaded.');
    });
  }
  if (!data || !form) return <div><p role="status">{message || 'Loading emails…'}</p><Button onClick={() => act(load)}>Retry</Button></div>;
  return <div className="sf-email-admin"><p role="status">{message}</p>
    <section className="sf-email-panel"><h2>Weekly schedule</h2><p>One queued email per slot, oldest first. Empty slots are skipped. Times are Lagos time.</p><div className="sf-email-controls">
      <FormField label="Frequency"><select value={settings.frequency} onChange={e => setSettings({ ...settings, frequency:Number(e.target.value) })}><option value={3}>Monday, Wednesday, Friday</option><option value={4}>Monday, Wednesday, Friday, Sunday</option></select></FormField>
      <FormField label="Send time"><select value={settings.hour} onChange={e => setSettings({ ...settings, hour:Number(e.target.value) })}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{String(h).padStart(2,'0')}:00 WAT</option>)}</select></FormField>
      <label><input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled:e.target.checked })} /> Enable weekly sending</label>
      <Button disabled={busy} onClick={() => act(async()=>{ await request('/settings','PUT',{ enabled:settings.enabled, frequency:settings.frequency, hour:settings.hour }); await load(); setMessage('Schedule saved.'); })}>Save schedule</Button>
    </div><p>Only subscribed, active users receive marketing emails. Pausing stops future slots; it cannot recall a broadcast already sent.</p></section>
    <section className="sf-email-panel"><h2>Compose an email</h2><p>Save a draft, preview it, then add it to the weekly queue.</p><div className="sf-email-form">
      {[['subject','Subject'],['title','Headline'],['cta','Button label'],['url','Button link']].map(([key,label])=><FormField key={key} label={label}><Input value={form[key] || ''} onChange={e=>change(key,e.target.value)} /></FormField>)}
      <div><FormField label="Image (optional)"><Input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={uploadImage} /></FormField><p>Upload a JPG, PNG or WebP image, up to 5 MB.</p>
        {form.imageUrl && <div><img src={form.imageUrl} alt="Selected email artwork" style={{ display:'block', maxWidth:'100%', maxHeight:240, borderRadius:12, marginBottom:12 }} /><Button disabled={busy} variant="secondary" onClick={() => change('imageUrl','')}>Remove image</Button></div>}
      </div>
      <FormField label="Message"><textarea rows={7} value={form.body} onChange={e=>change('body',e.target.value)} /></FormField>
      <FormField label="Recipients"><select value={form.audience} onChange={e=>change('audience',e.target.value)}><option value="all">All subscribed users</option><option value="company">Subscribed businesses</option><option value="promoter">Subscribed promoter accounts</option></select></FormField>
    </div><div className="sf-email-controls">
      <Button disabled={busy} onClick={()=>act(async()=>setPreview((await request('/preview','POST',form)).html))}>Preview</Button>
      <Button disabled={busy || !data.configured} variant="secondary" onClick={()=>act(async()=>{ if(!testKey.current) testKey.current=crypto.randomUUID(); const r=await request('/test','POST',form,{'Idempotency-Key':testKey.current}); await load(); setMessage(r.message); })}>Send test to my Gmail</Button>
      <Button disabled={busy} variant="secondary" onClick={()=>act(async()=>{ await request('/campaigns','POST',form); await load(); setMessage('Draft saved. Add it to the queue below when ready.'); })}>Save draft</Button>
    </div>{preview && <iframe title="Email preview" sandbox="" srcDoc={preview} className="sf-email-preview" />}</section>
    <section className="sf-email-panel"><h2>Email queue and history</h2><p>Sent means accepted by Resend, not confirmed inbox delivery. Delivery and click reports are available in <a href="https://resend.com/broadcasts" target="_blank" rel="noreferrer">Resend</a>.</p>
      {!data.campaigns.length && <p>No emails queued yet.</p>}{data.campaigns.map(item=><article className="sf-email-row" key={item._id}><div><strong>{item.subject}</strong><p>{item.status.replace('_',' ')} · {item.audience}{item.recipients != null ? ` · ${item.recipients} recipients` : ''}</p>{item.error && <p>{item.error}</p>}{item.broadcastId && <small>Broadcast: {item.broadcastId}</small>}</div>{['draft','ready'].includes(item.status) && <Button disabled={busy} variant="secondary" onClick={()=>act(async()=>{ await request(`/campaigns/${item._id}`,'PATCH',{status:item.status === 'draft' ? 'ready':'draft'}); await load(); })}>{item.status === 'draft' ? 'Add to queue':'Remove from queue'}</Button>}</article>)}
      <h3>Recent test emails</h3>{data.tests.map((item,i)=><p key={i}>tryspreadfast@gmail.com — {item.status}{item.providerId ? ` · ${item.providerId}`:''}</p>)}<Button disabled={busy} variant="secondary" onClick={()=>act(load)}>Refresh status</Button>
    </section></div>;
}
