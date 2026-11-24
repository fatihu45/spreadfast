import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import QuickAdHistoryVideo from '../components/QuickAdHistoryVideo';
import GenerationProgress from '../components/GenerationProgress';
import CreditPurchaseDialog from '../components/CreditPurchaseDialog';
import { Button } from '../components/ui';
import { quickAdsAuth, quickAdsUrl, quickAdsBaseUrl } from '../utils/quickAdsApi';
import { jobStatus, recoveryPath, progressPath } from '../utils/studioJobs';
import './QuickAd.css';
import './Studios.css';
import './MyAds.css';
const filters = [['', 'All'], ['quick', 'Quick Ads'], ['fashion', 'Fashion'], ['auto', 'Auto'], ['product', 'Products'], ['commercial', 'Commercials']];
export default function MyAds() {
  const { token } = useContext(AuthContext);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [creditRequest, setCreditRequest] = useState(null);
  const deleteDialog = useRef(null);
  const requestVersion = useRef(0);
  const actionLock = useRef(false);
  const deletedIds = useRef(new Set());
  const hasPending = rows.some(row => row.status === 'pending') || !!retryingId;
  const load = useCallback(async (quiet = false) => {
    const version = ++requestVersion.current;
    if (!quiet) setLoading(true);
    try {
      const { data } = await axios.get(quickAdsUrl(`/generations?all=true&page=${page}&limit=12&studio=${filter}`), { headers: quickAdsAuth(token), timeout: 20000 });
      if (version !== requestVersion.current) return;
      setRows((data.generations || []).filter(row => !deletedIds.current.has(row.generationId))); setHasMore(data.hasMore ?? data.generations?.length === 12);
    } catch { if (version === requestVersion.current) setError('Could not refresh your ads. Try again in a moment.'); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [filter, page, token]);
  useEffect(() => { setError(''); load(); return () => { requestVersion.current += 1; }; }, [load]);
  useEffect(() => {
    if (!hasPending) return undefined;
    const timer = setInterval(() => load(true), 4000);
    return () => clearInterval(timer);
  }, [hasPending, load]);
  useEffect(() => {
    if (!deleting) return undefined;
    const dialog = deleteDialog.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, [deleting]);
  async function action(item, kind) {
    if (actionLock.current) return;
    actionLock.current = true; setBusyId(item.generationId); setError('');
    const path = quickAdsUrl(`/generations/${encodeURIComponent(item.generationId)}`);
    const options = { headers: quickAdsAuth(token), timeout: 120000 };
    try {
      if (kind === 'retry') {
        const retryPath = recoveryPath(item);
        if (!retryPath) return;
        setRetryingId(item.generationId);
        setRows(current => current.map(row => row.generationId === item.generationId ? { ...row, status: 'pending', stage: 'finalizing' } : row));
        await axios.post(`${quickAdsBaseUrl()}${retryPath}`, {}, options);
        await load(true);
      }
      if (kind === 'delete') {
        await axios.delete(path, options);
        deletedIds.current.add(item.generationId);
        requestVersion.current += 1;
        setRows(current => current.filter(row => row.generationId !== item.generationId));
        setDeleting(null);
        await load(true);
      }
      if (kind === 'edit') {
        await axios.patch(path, { title }, options); setEditing(null); await load(true);
      }
      if (kind === 'download') {
        const { data } = await axios.get(`${path}/download`, { ...options, responseType: 'blob' });
        const url = URL.createObjectURL(data);
        const link = document.createElement('a'); link.href = url; link.download = 'spreadfast-ad.mp4'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (failure) {
      if (failure.response?.data?.code === 'NO_QUICK_AD_CREDITS') {
        let balance = item.quickAdCredits || 0;
        try { const { data } = await axios.get(quickAdsUrl('/credits'), options); balance = data.quickAdCredits; } catch { /* Show the last confirmed balance. */ }
        setCreditRequest({ balance, cost: item.creditCost || item.requiredCredits || 1 });
      } else setError(failure.response?.data?.message || (kind === 'retry' ? 'The connection was interrupted. Checking your saved progress; no new ad was requested.' : `Could not ${kind} this ad. Try again.`));
      if (kind === 'retry') await load(true);
    } finally { actionLock.current = false; setBusyId(null); setRetryingId(null); }
  }
  return <main className="sf-studios sf-my-ads">
    <header className="sf-library-heading"><div><h1>My Ads</h1><p>Your videos, all in one place.</p></div><Link to="/create">Create an ad</Link></header>
    <nav className="sf-library-filters" aria-label="Filter advertisements">{filters.map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => { setFilter(id); setPage(1); }}>{label}</button>)}</nav>
    {error && <p className="sf-studio-error" role="alert">{error}</p>}
    {loading && <p role="status">Loading your ads…</p>}
    {!loading && !rows.length && <div className="sf-library-empty"><h2>No ads here yet</h2><p>Choose a studio and start with a photo.</p><Link to="/create">Create an ad</Link></div>}
    <div className="quick-ad-history-grid">{rows.map(item => {
      const recovering = retryingId === item.generationId;
      const active = item.status === 'pending' || recovering;
      const busy = !!busyId;
      return <article className="quick-ad-history-card" key={item.generationId}>
        <QuickAdHistoryVideo item={item} token={token} />
        <div className="sf-studio-panel"><strong>{item.title || 'Your advertisement'}</strong>
          <p>{filters.find(([id]) => id === item.studioType)?.[1] || 'Quick Ad'} · {item.duration || 5}s · {item.creditsUsed || 0} credits</p>
          <p className="sf-library-date">{new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          {active && item.stage !== 'awaiting_approval' ? <GenerationProgress compact job={recovering ? { ...item, status: 'pending', stage: item.status === 'pending' ? item.stage : 'finalizing' } : item} /> : <p className={`sf-library-status is-${item.status}`}>{jobStatus(item)}</p>}
          <div className="sf-library-actions">
            {active && <Link className="sf-library-primary" to={progressPath(item)}>{item.stage === 'awaiting_approval' ? 'Review outfit' : 'View progress'}</Link>}
            {!active && recoveryPath(item) && <Button disabled={busy} onClick={() => action(item, 'retry')}>{item.brandingRetryAvailable ? 'Retry branding' : 'Retry finishing video'}</Button>}
            {item.downloadable && <Button variant="secondary" disabled={busy} aria-label="Download advertisement" onClick={() => action(item, 'download')}>Download</Button>}
            {!active && <details className="sf-library-more"><summary aria-label={`More actions for ${item.title || 'advertisement'}`}>More</summary><div><button disabled={busy} aria-label="Edit advertisement title" onClick={() => { setEditing(item.generationId); setTitle(item.title || ''); }}>Rename</button><button disabled={busy} aria-label="Delete advertisement" onClick={() => setDeleting(item)}>Delete</button></div></details>}
          </div>
          {!active && item.status === 'failed' && !item.cancelled && !recoveryPath(item) && <p>No credits charged. <Link to="/create">Create a new ad</Link></p>}
          {editing === item.generationId && <form className="sf-library-edit" onSubmit={event => { event.preventDefault(); action(item, 'edit'); }}><label>Ad title<input aria-label="Advertisement title" required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} /></label><div><Button type="submit" disabled={busy}>Save title</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div></form>}
        </div>
      </article>;
    })}</div>
    <div className="sf-library-pagination">{(page > 1 || hasMore) && <><Button variant="secondary" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={loading || !hasMore} onClick={() => setPage(value => value + 1)}>Next</Button></>}<Button variant="ghost" disabled={loading} onClick={() => { setError(''); load(); }}>Refresh</Button></div>
    {deleting && <dialog ref={deleteDialog} className="sf-credit-dialog" aria-labelledby="delete-ad-title" onCancel={() => { if (!busyId) setDeleting(null); }}><h2 id="delete-ad-title">Delete this ad?</h2><p>It will be removed from My Ads. Credits already used aren’t refunded.</p><Button fullWidth disabled={!!busyId} onClick={() => action(deleting, 'delete')}>Delete ad</Button><Button fullWidth variant="ghost" disabled={!!busyId} onClick={() => setDeleting(null)}>Keep ad</Button></dialog>}
    <CreditPurchaseDialog open={!!creditRequest} onClose={() => setCreditRequest(null)} balance={creditRequest?.balance} requiredCredits={creditRequest?.cost} />
  </main>;
}
