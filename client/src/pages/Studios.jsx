import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { quickAdsBaseUrl, quickAdsAuth, quickAdsUrl } from '../utils/quickAdsApi';
import './Studios.css';
export const STUDIO_CARDS = [
  { id: 'quick', name: 'Quick Ad', eyebrow: 'A little photo. A big impression.', description: 'Make your next post a five-second product moment.', duration: '5 seconds', image: '/studios/quick.webp', alt: 'Jollof rice, grilled chicken and plantain in a softly lit studio', to: '/quick-ad', cost: 1 },
  { id: 'fashion', name: 'Fashion Studio', eyebrow: 'Let the details do the talking.', description: 'Bring your collection to life. Choose an invisible mannequin or an AI model.', duration: '5–10 seconds', image: '/studios/fashion.webp', alt: 'Fashion model wearing an emerald dress in an architectural studio', to: '/studios/fashion', cost: 1 },
  { id: 'auto', name: 'Auto Studio', eyebrow: 'Give every angle its moment.', description: 'Turn vehicle photos into a cinematic showcase, with optional narration.', duration: '10–15 seconds', image: '/studios/auto.webp', alt: 'Graphite SUV photographed in a minimalist architectural studio', to: '/studios/auto' },
  { id: 'product', name: 'Product Studio', eyebrow: 'Small details. Beautifully seen.', description: 'Put bags, shoes, jewellery and everyday essentials in the spotlight.', duration: '5 seconds', image: '/studios/product.webp', alt: 'Leather handbag and cream shoes on a limestone display', to: '/studios/product' },
  { id: 'commercial', name: 'AI Commercial', eyebrow: 'A bigger story for your brand.', description: 'A complete video advert, told across three scenes. Bring your brand story to life with AI creative direction.', duration: 'Up to 24 seconds', image: '/studios/commercial-story.webp', alt: 'Nigerian presenter introducing a drink in a cinematic café commercial', to: '/ai-commercials' }
];
export function StudioCards({ marketing = false }) {
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState(false);
  useEffect(() => {
    if (!process.env.REACT_APP_API_URL) { setCatalogError(true); return undefined; }
    const controller = new AbortController();
    axios.get(`${quickAdsBaseUrl()}/api/studios/catalog`, { signal: controller.signal })
      .then(({ data }) => setCatalog(data.modes || []))
      .catch(() => { if (!controller.signal.aborted) setCatalogError(true); });
    return () => controller.abort();
  }, []);
  return <div className="sf-studio-grid">{STUDIO_CARDS.map((card, index) => {
    const modes = (catalog || []).filter(m => m.studio === card.id && m.available);
    const available = ['quick', 'fashion'].includes(card.id) || modes.length > 0;
    const cost = card.cost || (modes.length ? Math.min(...modes.map(m => m.credits)) : null);
    const action = available ? `Open ${card.name}` : catalogError ? 'Explore studio' : catalog ? 'Coming soon' : 'Explore studio';
    return <article className={`sf-studio-card sf-studio-card--${card.id}`} key={card.id}>
      <div className="sf-studio-card__media"><img src={card.image} alt={card.alt} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" width="1200" height="800" /><span className="sf-studio-card__duration">{card.duration}</span></div>
      <div className="sf-studio-card__body"><p className="sf-studio-eyebrow">{card.eyebrow}</p><h2>{card.name}</h2><p className="sf-studio-card__description">{card.description}</p>
        <div className="sf-studio-card__footer"><span className="sf-studio-meta">{cost ? `From ${cost} credit${cost > 1 ? 's' : ''}` : 'Pricing inside'}<small>Illustrative concept</small></span><Link to={card.to} aria-label={`${action}${marketing ? ' — explore SpreadFast' : ''}`}>{action}<span aria-hidden="true">↗</span></Link></div>
      </div>
    </article>;
  })}</div>;
}
export default function Studios() {
  const { token } = useContext(AuthContext);
  const [balance, setBalance] = useState(null);
  const [balanceError, setBalanceError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    axios.get(quickAdsUrl('/credits'), { headers: quickAdsAuth(token), signal: controller.signal }).then(({ data }) => setBalance(data.quickAdCredits)).catch(() => { if (!controller.signal.aborted) setBalanceError(true); });
    return () => controller.abort();
  }, [token]);
  return <main className="sf-studios">
    <div className="sf-studio-topline"><p className="sf-studio-eyebrow">SpreadFast Studios</p><Link className="sf-studio-balance" to="/quickads/credits">{balanceError ? 'View your credits' : balance === null ? 'Loading credits…' : `${balance} credits available`}<span aria-hidden="true">＋</span></Link></div>
    <header className="sf-studios-intro"><h1>What are you advertising today?</h1><p>Your product. A fresh perspective.<br />Choose a studio and make something worth watching.</p></header>
    <StudioCards />
    <div className="sf-studio-guide"><div><span>01</span><strong>Start with your photos</strong><p>A clear view makes all the difference.</p></div><div><span>02</span><strong>Make it yours</strong><p>Choose a look. Add a few details.</p></div><div><span>03</span><strong>Ready for your next post</strong><p>Review, download, and share your ad.</p></div></div>
  </main>;
}
