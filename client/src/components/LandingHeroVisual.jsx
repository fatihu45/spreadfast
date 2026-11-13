import React from 'react';

export default function LandingHeroVisual() {
  return <figure className="sf-editorial-hero" aria-label="Illustrative SpreadFast product campaign concepts">
    <img className="sf-editorial-hero__main" src="/studios/fashion.webp" alt="Nigerian fashion model wearing an emerald dress in an ivory studio" width="1200" height="800" fetchPriority="high" />
    <figcaption><span>YOUR PRODUCT. REIMAGINED.</span><strong>Made for the spotlight.</strong><small>Illustrative campaign concepts</small></figcaption>
    <div className="sf-editorial-hero__strip"><img src="/studios/commercial-story.webp" alt="Cinematic drink advertisement featuring a Nigerian presenter" width="1200" height="800" /><img src="/studios/auto.webp" alt="Cinematic vehicle showcase" width="1200" height="800" /><img src="/studios/product.webp" alt="Leather accessories in a product studio" width="1200" height="800" /></div>
  </figure>;
}
