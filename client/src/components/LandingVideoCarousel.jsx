import React, { useRef } from 'react';
import LandingSampleVideo from './LandingSampleVideo';

const samples = [
  ['breakfast', 'Breakfast', 'Food'],
  ['black-kaftan', 'Black kaftan', 'Fashion'],
  ['perfume', 'Perfume', 'Product'],
  ['birthday-cake', 'Birthday cake', 'Food'],
  ['embroidered-abaya', 'Embroidered abaya', 'Fashion'],
  ['noodles', 'Noodles', 'Food'],
  ['blue-kaftan', 'Blue kaftan', 'Fashion'],
  ['skincare', 'Skincare', 'Product'],
];

export default function LandingVideoCarousel() {
  const track = useRef(null);
  function move(direction) {
    const card = track.current?.firstElementChild;
    if (!card) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    track.current.scrollBy({ left: direction * (card.getBoundingClientRect().width + 16), behavior: reduced ? 'auto' : 'smooth' });
  }
  return <section className="landing-samples" aria-labelledby="landing-samples-title" aria-roledescription="carousel">
    <div className="landing-samples-heading">
      <div><h3 id="landing-samples-title">See what you can create.</h3><p>Quick Ads for food, products, and fashion.</p></div>
      <div className="landing-samples-navigation">
        <button type="button" aria-label="Previous videos" aria-controls="landing-samples-track" onClick={() => move(-1)}>←</button>
        <button type="button" aria-label="Next videos" aria-controls="landing-samples-track" onClick={() => move(1)}>→</button>
      </div>
    </div>
    <div className="landing-samples-track" id="landing-samples-track" ref={track} tabIndex={0} aria-label="Quick Ad video samples" onKeyDown={event => {
      if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
    }}>
      {samples.map(([name, label, category], index) => <article className="landing-sample-card" key={name} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${samples.length}: ${label}`}>
        <LandingSampleVideo name={name} label={`${label} Quick Ad sample`} />
        <div className="landing-sample-caption"><strong>{label}</strong><span>{category}</span></div>
      </article>)}
    </div>
  </section>;
}
