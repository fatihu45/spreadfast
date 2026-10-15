import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../components/ui';
import UiIcon from '../components/ui/UiIcon';
import './AICommercials.css';

const styles = [
  { id: 'cinematic', title: 'Cinematic', description: 'Bold lighting and premium camera movement', icon: 'star' },
  { id: 'showcase', title: 'Product showcase', description: 'Clear, detail-first product presentation', icon: 'image' },
  { id: 'lifestyle', title: 'Lifestyle', description: 'Place your product in a natural scene', icon: 'sun' },
  { id: 'promo', title: 'Promotional', description: 'Energetic visuals for offers and launches', icon: 'zap' },
];

export default function AICommercials({ initialTab = 'create' }) {
  const [tab, setTab] = useState(initialTab);
  const [productName, setProductName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [contact, setContact] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [style, setStyle] = useState('cinematic');
  const [tier, setTier] = useState('standard');
  const [photo, setPhoto] = useState(null);
  const [logo, setLogo] = useState(null);
  const [notice, setNotice] = useState('');

  return <main className="sf-commercials">
    <header className="sf-commercials__header">
      <div><span className="sf-commercials__eyebrow">SPREADFAST AI STUDIO</span><h1>{tab === 'history' ? 'My Ads' : 'Create an AI commercial'}</h1>
        <p>Turn a product photo into a polished, scene-by-scene video advert.</p></div>
      <div className="sf-commercials__actions"><Link to="/company/quick-ads" className="sf-commercials__secondary">Quick Ads <UiIcon name="arrow-right" /></Link><Link to="/quickads/credits" className="sf-commercials__credit"><UiIcon name="wallet" /> Buy credits</Link></div>
    </header>
    <div className="sf-commercials__tabs" role="tablist" aria-label="Ad workspace">
      <button type="button" role="tab" aria-selected={tab === 'create'} className={tab === 'create' ? 'is-active' : ''} onClick={() => setTab('create')}>Create commercial</button>
      <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}>My Ads</button>
    </div>
    {tab === 'history' ? <Card className="sf-commercials__empty"><span className="sf-commercials__empty-icon"><UiIcon name="video" /></span><h2>Your ads will live here</h2><p>Completed AI commercials and Quick Ads will be available here as history integration is connected.</p><Button onClick={() => setTab('create')}>Create a commercial</Button></Card> : <>
      <div className="sf-commercials__layout">
        <div className="sf-commercials__form">
          <section className="sf-commercials__panel">
            <div className="sf-commercials__step"><span>1</span><div><h2>Product details</h2><p>Start with a clear image of the product you want to advertise.</p></div></div>
            <label className="sf-commercials__upload">
              {photo ? <><img src={photo} alt="Selected product preview" /><span className="sf-commercials__change">Change photo</span></> : <><span className="sf-commercials__upload-icon"><UiIcon name="image" /></span><strong>Upload product photo</strong><span>JPG, PNG or WEBP · Use a clear, well-lit image</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file=e.target.files?.[0]; if(file){if(file.size>8*1024*1024){setNotice('Choose an image smaller than 8 MB.');return;}setPhoto(URL.createObjectURL(file));setNotice('');} }} />
            </label>
            <div className="sf-commercials__fields">
              <label>Product name<input value={productName} onChange={e=>setProductName(e.target.value)} placeholder="e.g. Signature leather bag" maxLength={100}/></label>
              <label>Brand name<input value={brandName} onChange={e=>setBrandName(e.target.value)} placeholder="Your business or brand" maxLength={100}/></label>
              <label>Contact / call to action<input value={contact} onChange={e=>setContact(e.target.value)} placeholder="WhatsApp number, website or tagline" maxLength={120}/></label>
            </div>
            <div className="sf-commercials__spec">
              <label htmlFor="commercial-specs">Product specifications <span>Optional</span></label>
              <p id="commercial-specs-help">Tell the AI what must stay accurate. These details should guide every scene.</p>
              <textarea id="commercial-specs" value={specifications} onChange={e=>setSpecifications(e.target.value.slice(0,500))} maxLength={500} rows={4} placeholder="Preserve the exact colour, shape, fabric, stitching, labels and packaging. Do not invent or remove product details." aria-describedby="commercial-specs-help commercial-specs-count"/>
              <div className="sf-commercials__spec-footer"><span>Product accuracy first</span><span id="commercial-specs-count">{specifications.length}/500</span></div>
            </div>
            <div className="sf-commercials__logo"><div><strong>Add your logo</strong><p>Optional brand mark for your final commercial.</p></div><label className="sf-commercials__logo-button">{logo ? 'Logo selected' : 'Choose logo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setLogo(e.target.files?.[0] || null)}/></label></div>
          </section>
          <section className="sf-commercials__panel">
            <div className="sf-commercials__step"><span>2</span><div><h2>Choose your creative direction</h2><p>Set the mood for your commercial.</p></div></div>
            <div className="sf-commercials__styles">{styles.map(item=><button type="button" key={item.id} onClick={()=>setStyle(item.id)} className={'sf-commercials__style '+(style===item.id?'is-selected':'')}><span><UiIcon name={item.icon}/></span><strong>{item.title}</strong><small>{item.description}</small>{style===item.id&&<b aria-label="Selected">✓</b>}</button>)}</div>
          </section>
          <section className="sf-commercials__panel">
            <div className="sf-commercials__step"><span>3</span><div><h2>Video quality</h2><p>Choose the generation tier for your commercial.</p></div></div>
            <div className="sf-commercials__tiers">
              <button type="button" onClick={()=>setTier('standard')} className={tier==='standard'?'is-selected':''}><span className="sf-commercials__tier-check">{tier==='standard'?'✓':''}</span><strong>Standard</strong><span>Balanced quality for everyday campaigns</span><b>4 credits</b></button>
              <button type="button" onClick={()=>setTier('premium')} className={tier==='premium'?'is-selected':''}><span className="sf-commercials__tier-check">{tier==='premium'?'✓':''}</span><strong>Premium</strong><span>Enhanced motion and cinematic detail</span><b>7 credits</b></button>
            </div>
          </section>
          {notice&&<p className="sf-commercials__notice" role="status">{notice}</p>}
          <Button fullWidth size="lg" onClick={()=>setNotice('The AI Commercials generation service is not connected yet. Your selected settings have not been submitted and no credits have been used.')}><UiIcon name="sparkles" /> Generate commercial · {tier==='standard'?'4':'7'} credits</Button>
          <p className="sf-commercials__footnote">Credits are only used when a generation is successfully completed. Prices are shown on the credit purchase page.</p>
        </div>
        <aside className="sf-commercials__preview">
          <div className="sf-commercials__preview-top"><span>PREVIEW</span><span className="sf-commercials__live"><i/> Live setup</span></div>
          <div className="sf-commercials__preview-stage">{photo?<img src={photo} alt="Product preview"/>:<div className="sf-commercials__preview-placeholder"><span><UiIcon name="video" /></span><strong>Your commercial starts here</strong><p>Upload a product photo to preview your creative setup.</p></div>}<span className="sf-commercials__duration">~30 sec commercial</span></div>
          <div className="sf-commercials__preview-details"><div><span>PRODUCT</span><strong>{productName||'Your product'}</strong></div><div><span>BRAND</span><strong>{brandName||'Your brand'}</strong></div><div><span>STYLE</span><strong>{styles.find(s=>s.id===style)?.title}</strong></div><div><span>QUALITY</span><strong>{tier==='standard'?'Standard · 4 credits':'Premium · 7 credits'}</strong></div></div>
          <div className="sf-commercials__scene-note"><span><UiIcon name="sparkles" /></span><div><strong>Scene-by-scene creation</strong><p>Your planned workflow: creative direction, product scene images, motion, then final assembly and branding.</p></div></div>
        </aside>
      </div>
    </>}
  </main>;
}
