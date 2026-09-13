import Alert from './ui/Alert';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, FormField, Input, PageHeader, PlatformBadge, Select, Textarea } from './ui';
import UiIcon from './ui/UiIcon';
import './BusinessCreateCampaign.css';

export const emptyCampaignBrief = { goal: '', contentRequirements: '', targetLocation: '', creatorRequirements: '', duration: '' };
export function buildCampaignBrief(description, brief) {
  const sections = [description, brief.goal && 'Campaign goal: ' + brief.goal,
    brief.contentRequirements && 'Content requirements: ' + brief.contentRequirements,
    brief.targetLocation && 'Target location (brief): ' + brief.targetLocation,
    brief.creatorRequirements && 'Creator requirements (brief): ' + brief.creatorRequirements,
    brief.duration && 'Planned campaign duration: ' + brief.duration + ' days (not an automatic end date)'];
  return sections.filter(value => value && value.trim()).join('\n\n');
}
const platforms = [{ key: 'tiktok', label: 'TikTok' }, { key: 'instagram', label: 'Instagram' }, { key: 'youtube', label: 'YouTube' }, { key: 'twitter', label: 'X (Twitter)' }, { key: 'facebook', label: 'Facebook' }];
const money = value => value !== '' && Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value)) : 'Not set';
export default function BusinessCreateCampaign({ values, onChange, brief, onBriefChange, onPlatformChange, onSelectAllPlatforms,
  assets, assetCount, onAssetChange, onRemoveAsset, creatorCount, onPayment, paymentProcessing, error, success, status }) {
  const [review, setReview] = useState(false);
  const [validation, setValidation] = useState('');
  const reviewRef = useRef(null);
  const titleRef = useRef(null);
  const selected = platforms.filter(platform => values.socialMediaPlatforms[platform.key]);
  useEffect(() => { if (review) reviewRef.current?.focus(); }, [review]);
  useEffect(() => { if (success) { setReview(false); setValidation(''); } }, [success]);
  const edit = () => { setReview(false); requestAnimationFrame(() => titleRef.current?.focus()); };
  async function submit(event) {
    event.preventDefault();
    if (paymentProcessing) return;
    if (!review) {
      if (!event.currentTarget.reportValidity()) return;
      if (!selected.length) { setValidation('Select at least one platform for your campaign.'); return; }
      if (!values.title.trim() || !values.keyMessage.trim()) { setValidation('Enter a campaign name and key message.'); return; }
      setValidation(''); setReview(true); return;
    }
    await onPayment(event);
  }
  return <div className="business-create">
    <PageHeader title={review ? 'Review your campaign' : 'Create a campaign'} description={review ? 'Check your brief and budget before you pay.' : 'Tell creators about your brand and what you want to achieve.'} />
    <ol className="business-create-steps" aria-label="Campaign creation progress"><li aria-current={!review ? 'step' : undefined}><span>1</span> Campaign details</li><li aria-current={review ? 'step' : undefined}><span>2</span> Review &amp; payment</li></ol>
    {error && <Alert tone="error">{error}</Alert>}
    {validation && <Alert tone="error">{validation}</Alert>}
    {status && <Alert tone="info">{status}</Alert>}
    <form id="create-campaign" tabIndex={-1} onSubmit={submit} className="business-create-form">
      <div className="business-create-layout">
        <div className="business-create-main">
          <fieldset disabled={paymentProcessing || review} hidden={review} className="business-create-fields">
            <Card className="business-create-card"><h2>Campaign brief</h2><p className="business-create-intro">Give creators a clear direction for their content.</p>
              <FormField label="Campaign goal"><Select value={brief.goal} onChange={event => onBriefChange('goal', event.target.value)}><option value="">Choose a goal (optional)</option><option>Build brand awareness</option><option>Reach more customers</option><option>Introduce a product</option><option>Encourage engagement</option></Select></FormField>
              <FormField label="Campaign name" required><Input ref={titleRef} value={values.title} onChange={event => onChange('title', event.target.value)} placeholder="Give your campaign a name" /></FormField>
              <FormField label="Description"><Textarea rows={4} value={values.description} onChange={event => onChange('description', event.target.value)} placeholder="Introduce your brand, product, or offer" /></FormField>
              <FormField label="Content requirements"><Textarea rows={3} value={brief.contentRequirements} onChange={event => onBriefChange('contentRequirements', event.target.value)} placeholder="Describe the posts you want creators to make" /></FormField>
              <FormField label="Key message" required hint="Up to 500 characters. Tell creators what their audience should remember."><Textarea rows={3} maxLength={500} value={values.keyMessage} onChange={event => onChange('keyMessage', event.target.value)} /></FormField>
            </Card>
            <Card className="business-create-card"><h2>Audience &amp; creators</h2><p className="business-create-intro">Location, creator preferences, and duration are included in your brief. They do not automatically restrict joining or schedule your campaign.</p>
              <FormField label="Target location"><Input value={brief.targetLocation} onChange={event => onBriefChange('targetLocation', event.target.value)} placeholder="City, region, or nationwide" /></FormField>
              <fieldset className="business-create-platforms"><legend>Platform selection *</legend><Button size="sm" variant="ghost" onClick={onSelectAllPlatforms}>{selected.length === platforms.length ? 'Clear selection' : 'Select all'}</Button>
                <div>{platforms.map(platform => <label key={platform.key} className={values.socialMediaPlatforms[platform.key] ? 'is-selected' : ''}><input type="checkbox" checked={values.socialMediaPlatforms[platform.key]} onChange={() => onPlatformChange(platform.key)} /><PlatformBadge platform={platform.key} /></label>)}</div>
              </fieldset>
              <FormField label="Creator requirements"><Textarea rows={3} value={brief.creatorRequirements} onChange={event => onBriefChange('creatorRequirements', event.target.value)} placeholder="Describe the style, audience, or experience you are looking for" /></FormField>
              <div className="business-create-field-grid"><FormField label="Number of creators" hint="Available slots are calculated from your campaign budget."><Input readOnly value={values.budget ? creatorCount : ''} placeholder="Set a budget below" /></FormField>
                <FormField label="Campaign duration (days)" hint="Planned duration for the brief; no automatic end date."><Input type="number" min="1" step="1" value={brief.duration} onChange={event => onBriefChange('duration', event.target.value)} /></FormField></div>
            </Card>
            <Card className="business-create-card"><h2>Budget &amp; content assets</h2>
              <FormField label="Budget (NGN)" required hint="NGN 20,000 per creator. Your budget determines available creator slots."><Input type="number" min="20000" step="20000" value={values.budget} onChange={event => onChange('budget', event.target.value)} placeholder="Enter your campaign budget" /></FormField>
              <label className="business-create-upload"><UiIcon name="campaign" /><strong>Add content assets</strong><span>Choose brand logos, photos, videos, or a campaign brief.</span><small>JPG, PNG, MP4, PDF. Up to 20 MB each, 10 files total.</small><input type="file" aria-label="Content assets" multiple accept=".jpg,.jpeg,.png,.mp4,.pdf" onChange={onAssetChange} /></label>
              {assets.length > 0 && <ul className="business-create-assets">{assets.map((item, index) => <li key={index}>{item.preview && !item.error && (item.file.type.startsWith('image/') ? <img src={item.preview} alt="" /> : <video src={item.preview} preload="metadata" />)}<div><strong>{item.file.name}</strong>{item.error && <p role="alert">{item.error}</p>}</div><Button size="sm" variant="ghost" aria-label={'Remove ' + item.file.name} onClick={() => onRemoveAsset(index)}>Remove</Button></li>)}</ul>}
              <p className="business-create-intro">{assetCount}/10 files selected. Assets are uploaded after payment confirmation.</p>
            </Card>
            <Card className="business-create-card"><h2>Sponsored advertising options</h2><label className="business-create-ad-option"><input type="radio" name="advertising" checked readOnly />Creator content only</label><label className="business-create-ad-option is-disabled"><input type="radio" name="advertising" disabled />Sponsored ad placement</label><p className="business-create-intro">Sponsored ads are not available in this checkout. <a href="https://wa.me/+2349071023617" target="_blank" rel="noopener noreferrer">Contact support</a> to discuss paid advertising. No sponsored-ad charge is added.</p></Card>
          </fieldset>
          {review && <Card className="business-create-card business-create-review">
            <h2 ref={reviewRef} tabIndex={-1}>Campaign review</h2><dl>
              {[['Campaign name', values.title], ['Campaign goal', brief.goal || 'Not specified'], ['Description', values.description || 'Not specified'], ['Content requirements', brief.contentRequirements || 'Not specified'], ['Key message', values.keyMessage], ['Target location', brief.targetLocation || 'Not specified'], ['Platforms', selected.map(platform => platform.label).join(', ')], ['Creator requirements', brief.creatorRequirements || 'Not specified'], ['Number of creators', creatorCount + (creatorCount === 1 ? ' slot' : ' slots')], ['Planned duration', brief.duration ? brief.duration + ' days' : 'Not specified'], ['Budget', money(values.budget)], ['Content assets', assets.filter(item => !item.error).map(item => item.file.name).join(', ') || 'No files selected'], ['Sponsored advertising', 'Not included']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl><p className="business-create-intro">Your goal, content requirements, location, creator preferences, and planned duration will be shared in the campaign brief.</p><Button variant="secondary" disabled={paymentProcessing} onClick={edit}>Edit campaign</Button>
          </Card>}
        </div>
        <aside className="business-create-summary"><Card className="business-create-card"><h2>{review ? 'Payment' : 'Campaign summary'}</h2><dl><div><dt>Campaign budget</dt><dd>{money(values.budget)}</dd></div><div><dt>Creator slots</dt><dd>{values.budget ? creatorCount : 'Set a budget'}</dd></div><div><dt>Platforms</dt><dd>{selected.length ? selected.map(platform => platform.label).join(', ') : 'Not selected'}</dd></div></dl>
          <p className="business-create-intro">Your total covers the selected number of creators.</p>
          {review && <p className="business-create-intro">Continue to Paystack to pay by card or bank transfer. Your campaign goes live after payment is confirmed.</p>}
          <Button fullWidth type="submit" disabled={paymentProcessing}>{paymentProcessing ? 'Processing payment...' : review ? 'Pay & Create Campaign' : 'Review campaign'}</Button>
          {paymentProcessing && <p className="business-create-intro">Waiting for payment confirmation. Your campaign details are locked while payment is processing.</p>}
        </Card></aside>
      </div>
    </form>
  </div>;
}
