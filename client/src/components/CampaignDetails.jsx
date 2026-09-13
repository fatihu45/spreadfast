import React, { useEffect, useRef, useState } from 'react';
import { Button, CampaignStatusBadge, PlatformBadge } from './ui';
import UiIcon from './ui/UiIcon';
import './CampaignDetails.css';

const tabs = ['Overview', "What you'll create", 'Platforms', 'Assets', 'Earning info'];

export default function CampaignDetails({ campaign, thumbnail, assets, totalSlots, subscribedCount,
  remainingSlots, isSubscribed, downloadingAsset, onClose, onJoin, onSubmit, onDownload }) {
  const [activeTab, setActiveTab] = useState(0);
  const [failedImage, setFailedImage] = useState(null);
  const backRef = useRef(null);
  const tabRefs = useRef([]);
  useEffect(() => { backRef.current?.focus({ preventScroll: true }); }, []);
  const name = campaign.title || campaign.name;
  const brief = campaign.description || campaign.caption;
  const platforms = campaign.socialMediaPlatforms || [];
  const budget = campaign.budget ? '\u20a6' + parseFloat(campaign.budget).toLocaleString() : 'N/A';
  const prefix = 'campaign-detail-' + campaign.id;
  const platformBadges = platforms.length ? <div className="sf-platform-list">{platforms.map(platform => <PlatformBadge key={platform} platform={platform} />)}</div> : <p>Platforms have not been specified.</p>;
  const earningCopy = 'Your earning amount is set when your submission is approved. The campaign budget is the total campaign pool, not a guaranteed individual payout.';
  function handleTabKey(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); setActiveTab(next); tabRefs.current[next]?.focus(); }
  }
  return <div className="campaign-detail">
    <Button ref={backRef} variant="ghost" size="sm" className="campaign-detail-back" onClick={onClose}><span aria-hidden="true">&larr;</span> Back to campaigns</Button>
    <header className="campaign-detail-hero">
      <div className="campaign-detail-image">{thumbnail && failedImage !== thumbnail ? <img src={thumbnail} alt={name || 'Campaign'} onError={() => setFailedImage(thumbnail)} /> : <UiIcon name="campaign" />}</div>
      <div className="campaign-detail-heading">
        {campaign.companyName && campaign.companyName !== name && <p>{campaign.companyName}</p>}
        <div className="campaign-detail-title"><h2>{name}</h2><CampaignStatusBadge status={campaign.status || 'active'} /><span className="campaign-detail-slot-badge">{remainingSlots} slots left</span></div>
        <p>{brief}</p>
        {platformBadges}
        <dl className="campaign-detail-numbers"><div><dt>Campaign budget</dt><dd>{budget}</dd></div><div><dt>Creator earning</dt><dd>Set on approval</dd></div></dl>
        <Button fullWidth disabled={remainingSlots === 0} onClick={onJoin}>{remainingSlots === 0 ? 'All Slots Filled' : 'Join Campaign'}</Button>
        {isSubscribed && <p className="campaign-detail-joined">You have joined this campaign.</p>}
      </div>
    </header>
    <div className="campaign-detail-tabs" role="tablist" aria-label="Campaign information">
      {tabs.map((tab, index) => <button type="button" key={tab} ref={element => { tabRefs.current[index] = element; }}
        role="tab" id={prefix + '-tab-' + index} aria-controls={prefix + '-panel'} aria-selected={activeTab === index}
        tabIndex={activeTab === index ? 0 : -1} onClick={() => setActiveTab(index)} onKeyDown={event => handleTabKey(event, index)}>{tab}</button>)}
    </div>
    <div className="campaign-detail-body">
      <div role="tabpanel" id={prefix + '-panel'} aria-labelledby={prefix + '-tab-' + activeTab} tabIndex={0} className="campaign-detail-panel">
        {activeTab === 0 && <><h3>Campaign brief</h3><p>{brief || 'No campaign brief has been provided yet.'}</p><h3>Key message</h3><p>{campaign.keyMessage || 'No key message has been provided yet.'}</p></>}
        {activeTab === 1 && <><h3>What you'll create</h3><p>{brief || 'Refer to the campaign brief for content requirements.'}</p>{campaign.keyMessage && <><h3>Key message</h3><p>{campaign.keyMessage}</p></>}<p>Create your content using the campaign brief, then submit your post for review.</p></>}
        {activeTab === 2 && <><h3>Supported platforms</h3>{platformBadges}</>}
        {activeTab === 3 && <><h3>Brand assets ({assets.length})</h3>{!isSubscribed && assets.length > 0 && <p>Join this campaign to download its brand assets.</p>}
          {assets.length === 0 ? <p>No brand assets have been provided yet.</p> : assets.map(asset => <div key={asset.id} className="marketplace-asset">
            <div className="marketplace-asset-preview">{asset.file_type === 'image' ? <img src={asset.url} alt={asset.file_name} loading="lazy" /> : <UiIcon name="campaign" />}</div>
            <div className="marketplace-asset-name"><strong>{asset.file_name}</strong><span>{asset.file_type}</span></div>
            {isSubscribed ? <Button size="sm" variant="secondary" disabled={downloadingAsset === asset.id} onClick={() => onDownload(asset)}>{downloadingAsset === asset.id ? 'Downloading...' : 'Download'}</Button> : <span className="marketplace-locked">Locked</span>}
          </div>)}</>}
        {activeTab === 4 && <><h3>Earning info</h3><p>{earningCopy}</p><p>Approved earnings are added to your wallet.</p></>}
      </div>
      <aside className="campaign-detail-quick"><h3>Quick info</h3><dl>
        <div><dt>Available creator slots</dt><dd>{remainingSlots}</dd></div>
        <div><dt>Creator slots filled</dt><dd>{subscribedCount} of {totalSlots}</dd></div>
        <div><dt>Platforms</dt><dd>{platformBadges}</dd></div>
        <div><dt>Creator earning</dt><dd>Set on approval</dd></div>
      </dl><Button fullWidth variant="secondary" onClick={onSubmit}>Submit Proof</Button></aside>
    </div>
  </div>;
}
