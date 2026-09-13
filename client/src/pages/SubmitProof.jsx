import Alert from '../components/ui/Alert';
/* eslint-disable */

import React, { useState, useContext, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCall, apiCallAuth } from '../utils/api';
import { Button, Card, CampaignStatusBadge, FormField, Input, PageHeader, PlatformBadge } from '../components/ui';
import UiIcon from '../components/ui/UiIcon';
import './SubmitProof.css';

export default function SubmitProof() {
  const { token } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaignId') || '';

  const [formData, setFormData] = useState({
    campaignId,
    userName: '',
    selectedPlatforms: {
      tiktok: false,
      instagram: false,
      twitter: false,
      facebook: false,
      youtube: false
    },
    platformLinks: {
      tiktok: '',
      instagram: '',
      twitter: '',
      facebook: '',
      youtube: ''
    },
    screenshot: ''
  });
  const [loading, setLoading] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [submissionsError, setSubmissionsError] = useState('');

  const [campaign, setCampaign] = useState(null);
  const [campaignImage, setCampaignImage] = useState('');
  const [campaignError, setCampaignError] = useState('');
  const [fileName, setFileName] = useState('');
  const [readingFile, setReadingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCampaign(null); setCampaignImage(''); setCampaignError(''); setImageFailed(false);
    if (!campaignId) { setCampaignError('Choose a campaign before submitting your post.'); return; }
    apiCall('/api/campaigns/' + campaignId).then(data => {
      if (!cancelled) { if (data.success && data.campaign) setCampaign(data.campaign); else setCampaignError('Campaign details are unavailable.'); }
    }).catch(() => { if (!cancelled) setCampaignError('Campaign details are unavailable.'); });
    apiCall('/api/campaigns/' + campaignId + '/assets/preview').then(data => {
      if (!cancelled && data.success) setCampaignImage(data.assets?.find(asset => asset.file_type === 'image' && asset.url)?.url || '');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [campaignId]);

  const handleScreenshotFile = async file => {
    if (!file) return;
    setUploadError('');
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setUploadError('Choose a PNG or JPG image.'); return; }
    if (file.size > 60 * 1024) { setUploadError('Choose an image under 60 KB, or paste a screenshot URL below.'); return; }
    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => { setFormData(prev => ({ ...prev, screenshot: reader.result })); setFileName(file.name); setReadingFile(false); };
    reader.onerror = () => { setUploadError('This image could not be read. Please try again.'); setReadingFile(false); };
    reader.readAsDataURL(file);
  };

  // Fetch user's submissions on mount
  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSubmissions = async () => {
    setSubmissionsLoading(true); setSubmissionsError('');
    if (!token) {
      setSubmissionsLoading(false);
      return;
    }

    try {
      const data = await apiCallAuth('/api/submissions/my-submissions', token);
      if (data.success) {
        setSubmissions(data.submissions || []);
      } else setSubmissionsError(data.message || 'Failed to load submissions');
    } catch (error) {
      setSubmissionsError('Failed to load submissions');
      console.error('Failed to fetch submissions:', error);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handlePlatformChange = (platform) => {
    setFormData(prev => ({
      ...prev,
      selectedPlatforms: {
        ...prev.selectedPlatforms,
        [platform]: !prev.selectedPlatforms[platform]
      }
    }));
  };

  const handlePlatformLinkChange = (platform, value) => {
    setFormData(prev => ({
      ...prev,
      platformLinks: {
        ...prev.platformLinks,
        [platform]: value
      }
    }));
  };

  const handleScreenshotChange = (e) => {
    setFormData(prev => ({ ...prev, screenshot: e.target.value }));
  };

  const handleUserNameChange = (e) => {
    setFormData(prev => ({ ...prev, userName: e.target.value }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (loading || readingFile || !campaignId) return;
    setLoading(true); setMessage(''); setError('');
    const selected = Object.keys(formData.selectedPlatforms).filter(p => formData.selectedPlatforms[p]);
    if (!selected.length) { setError('Please select at least one platform'); setLoading(false); return; }
    if (selected.some(p => !formData.platformLinks[p]?.trim())) { setError('Please provide links for all selected platforms'); setLoading(false); return; }
    try {
      const proofData = {};
      selected.forEach(platform => { proofData[platform] = formData.platformLinks[platform]; });
      const payload = { proofUrl: JSON.stringify(proofData), proofDescription: selected.join(', ') + ' - ' + formData.userName, platforms: selected, screenshot: formData.screenshot };
      if (new Blob([JSON.stringify(payload)]).size > 95 * 1024) { setError('Your submission is too large. Use a screenshot URL or shorter post links.'); return; }
      const data = await apiCallAuth('/api/campaigns/' + campaignId + '/submit', token, { method: 'POST', body: JSON.stringify(payload) });
      if (data.success) {
        setMessage('Submission successful! Our team will review your post soon.');
        setFormData({ campaignId, userName: '', selectedPlatforms: { tiktok: false, instagram: false, twitter: false, facebook: false, youtube: false }, platformLinks: { tiktok: '', instagram: '', twitter: '', facebook: '', youtube: '' }, screenshot: '' });
        setFileName(''); setUploadError(''); fetchSubmissions();
        setTimeout(() => setMessage(''), 3000);
      } else setError(data.message || 'Failed to submit. Please try again.');
    } catch (err) { console.error('Submission error:', err); setError('Failed to submit. Please try again.'); }
    finally { setLoading(false); }
  };

  const selectedPlatforms = Object.keys(formData.selectedPlatforms).filter(p => formData.selectedPlatforms[p]);
  const platforms = [{ key: 'tiktok', label: 'TikTok' }, { key: 'instagram', label: 'Instagram' }, { key: 'youtube', label: 'YouTube' }, { key: 'twitter', label: 'X (Twitter)' }, { key: 'facebook', label: 'Facebook' }];
  const thumbnail = campaignImage || campaign?.brandAssets?.find(asset => asset.fileType?.startsWith('image/'))?.fileUrl;
  return <section className="submission-page">
    <Link to="/available-campaigns" className="submission-back">&larr; Back to campaigns</Link>
    <PageHeader title="Submit your post" description="Share your content for review." />
    {message && <Alert tone="success">{message}</Alert>}
    {error && <Alert tone="error">{error}</Alert>}
    <div className="submission-layout">
      <Card as="form" onSubmit={handleSubmit} className="submission-form">
        <div className="submission-campaign">
          <div className="submission-campaign-image">{thumbnail && !imageFailed ? <img src={thumbnail} alt="" onError={() => setImageFailed(true)} /> : <UiIcon name="campaign" />}</div>
          <div><h2>{campaign?.title || campaign?.name || (campaignError ? 'Campaign' : 'Loading campaign...')}</h2>
            {campaign ? <CampaignStatusBadge status={campaign.status || 'active'} /> : <p>{campaignError || 'Fetching campaign details'}</p>}
            {campaignError && campaignId && <small>Campaign ID: {campaignId}</small>}
          </div>
        </div>
        <FormField label="Your name" required><Input value={formData.userName} onChange={handleUserNameChange} autoComplete="name" /></FormField>
        <fieldset className="submission-platforms"><legend>Where did you post?</legend><p>Select all platforms you posted on.</p><div className="submission-platform-options">
          {platforms.map(platform => <label key={platform.key} className={formData.selectedPlatforms[platform.key] ? 'is-selected' : ''}>
            <input type="checkbox" checked={formData.selectedPlatforms[platform.key]} onChange={() => handlePlatformChange(platform.key)} />
            <PlatformBadge platform={platform.key} />
          </label>)}
        </div></fieldset>
        {selectedPlatforms.map(platform => <FormField key={platform} label={platforms.find(item => item.key === platform).label + ' post link'} required>
          <Input type="url" value={formData.platformLinks[platform]} onChange={event => handlePlatformLinkChange(platform, event.target.value)} placeholder={'Paste your ' + platforms.find(item => item.key === platform).label + ' link here'} />
        </FormField>)}
        <div className="submission-screenshot"><span className="sf-label">Proof screenshot <span className="submission-muted">(optional)</span></span>
          <label className="submission-upload" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!readingFile && !loading) handleScreenshotFile(event.dataTransfer.files[0]); }}>
            <input aria-label="Upload screenshot" type="file" accept="image/png,image/jpeg" disabled={readingFile || loading} onChange={event => { handleScreenshotFile(event.target.files[0]); event.target.value = ''; }} />
            {fileName && formData.screenshot.startsWith('data:image/') ? <img src={formData.screenshot} alt="Selected proof screenshot" /> : <UiIcon name="campaign" />}
            <strong>{readingFile ? 'Reading screenshot...' : fileName || 'Upload screenshot'}</strong><span>Drag and drop or click to upload</span><small>PNG or JPG, up to 60 KB. Use a URL for larger images.</small>
          </label>
          {uploadError && <p role="alert" className="submission-upload-error">{uploadError}</p>}
          {fileName && <Button size="sm" variant="ghost" onClick={() => { setFileName(''); setFormData(prev => ({ ...prev, screenshot: '' })); }}>Remove screenshot</Button>}
          {!fileName && <FormField label="Or paste a screenshot URL"><Input type="url" value={formData.screenshot} onChange={handleScreenshotChange} placeholder="https://example.com/screenshot.jpg" /></FormField>}
        </div>
        <Button type="submit" fullWidth disabled={loading || readingFile || !campaignId}>{loading ? 'Submitting...' : 'Submit for Review'}</Button>
      </Card>
      <aside className="submission-tips"><h2>Tips for approval</h2><ul>
        {['Show the full post clearly', 'Make sure your post is public', 'Include the brand clearly', 'Follow the campaign key message'].map(tip => <li key={tip}><span aria-hidden="true"><UiIcon name="check" /></span>{tip}</li>)}
      </ul>{campaign?.keyMessage && <div className="submission-key-message"><h3>Key message</h3><p>{campaign.keyMessage}</p></div>}
        <h3>Before you submit</h3><p>Check that your links open the correct posts and your screenshot is easy to read.</p>
      </aside>
    </div>
    <Card className="submission-history"><h2>Your submissions</h2>
      {submissionsLoading ? <p role="status">Loading submissions...</p> : submissionsError ? <Alert tone="error">{submissionsError} <Button size="sm" variant="secondary" onClick={fetchSubmissions}>Retry submissions</Button></Alert> : submissions.length === 0 ? <p>No submissions yet. Your posts will appear here after you submit.</p> : submissions.map(submission => {
        let links = [];
        try { const parsed = JSON.parse(submission.proofUrl); if (parsed && typeof parsed === 'object') links = Object.entries(parsed); } catch { if (submission.proofUrl) links = [['Post', submission.proofUrl]]; }
        return <article key={submission.id}><div className="submission-history-heading"><h3>{submission.campaignTitle || submission.campaignId}</h3><CampaignStatusBadge status={submission.status} /></div>
          <p>{submission.proofDescription}</p><p>Submitted: {new Date(submission.createdAt).toLocaleDateString()}</p>
          {submission.status === 'approved' && submission.approvalAmount > 0 && <p className="submission-approved">Approved amount: &#8358;{submission.approvalAmount}</p>}
          <div className="submission-history-links">{links.filter(([, url]) => typeof url === 'string' && /^https?:\/\//i.test(url)).map(([platform, url]) => <a key={platform} href={url} target="_blank" rel="noopener noreferrer">View {platform} post &rarr;</a>)}</div>
        </article>;
      })}
    </Card>
  </section>;
}
