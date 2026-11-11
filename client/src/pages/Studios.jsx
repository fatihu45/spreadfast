import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { quickAdsBaseUrl, quickAdsAuth, quickAdsUrl } from '../utils/quickAdsApi';
import './Studios.css';
export const STUDIO_CARDS = [
  { id:'quick', name:'Quick Ad', description:'Turn a product photograph into a five-second advertisement.', duration:'5 seconds', image:'/dynamic_grilled_salmon_bowl_with_lemon_splash.png', to:'/quick-ad', cost:1 },
  { id:'fashion', name:'Fashion Studio', description:'Showcase outfits on invisible mannequins or approved AI fashion models.', duration:'5–10 seconds', image:'/fashion-studio-kaftan.png', to:'/studios/fashion', cost:1 },
  { id:'auto', name:'Auto Studio', description:'Create cinematic vehicle advertisements with optional narration.', duration:'10–15 seconds', to:'/studios/auto', icon:'🚘' },
  { id:'product', name:'Product Studio', description:'Showcase shoes, bags, watches, jewellery, perfumes and more.', duration:'5 seconds', image:'/luxury_amber_perfume_spotlight.png', to:'/studios/product' },
  { id:'commercial', name:'AI Commercial', description:'Tell your product’s story with a longer, multi-scene advertisement.', duration:'Up to 24 seconds', image:'/luxury_skincare_bottle_in_soft_beige_studio.png', to:'/ai-commercials' }
];
export function StudioCards({ marketing = false }) {
  const [catalog,setCatalog] = useState([]);
  useEffect(()=>{ if (!process.env.REACT_APP_API_URL) return undefined; const controller=new AbortController();
    axios.get(`${quickAdsBaseUrl()}/api/studios/catalog`,{signal:controller.signal}).then(({data})=>setCatalog(data.modes || [])).catch(()=>{});
    return ()=>controller.abort(); },[]);
  return <div className="sf-studio-grid">{STUDIO_CARDS.map(card=>{
    const modes=catalog.filter(m=>m.studio===card.id && m.available);
    const existing=['quick','fashion'].includes(card.id);
    const available=existing || modes.length>0;
    const cost=card.cost || (modes.length ? Math.min(...modes.map(m=>m.credits)) : null);
    return <article className="sf-studio-card" key={card.id}>
      {card.image ? <img src={card.image} alt={`${card.name} illustration`} loading="lazy" width="400" height="250" /> : <div className="sf-studio-placeholder" aria-hidden="true">{card.icon}</div>}
      <div><h2>{card.name}</h2><p>{card.description}</p><p className="sf-studio-meta">{card.duration}{cost ? ` · From ${cost} credit${cost>1?'s':''}` : ' · See studio pricing'}</p>
      {marketing && <small>Illustrative preview</small>}
      <Link className="sf-control sf-button sf-button--secondary" to={card.to}>{available ? `Open ${card.name}` : 'Coming soon'}</Link></div>
    </article>;
  })}</div>;
}
export default function Studios() {
  const {token}=useContext(AuthContext); const [balance,setBalance]=useState(null);
  useEffect(()=>{axios.get(quickAdsUrl('/credits'),{headers:quickAdsAuth(token)}).then(({data})=>setBalance(data.quickAdCredits)).catch(()=>{});},[token]);
  return <main className="sf-studios"><p>SpreadFast Studios</p><h1>What are you advertising today?</h1><p>Choose a studio, upload your product photos, and create professional video advertisements in minutes.</p>
    <p>{balance === null ? 'Loading credit balance…' : `${balance} credits available`} · <Link to="/quickads/credits">Buy credits</Link></p><StudioCards /></main>;
}
