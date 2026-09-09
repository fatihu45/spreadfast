import React from 'react';

function CheckIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// Illustrative artwork only: no real profile, campaign or performance data.
export default function LandingHeroVisual() {
  return (
    <figure className="landing-visual" role="img" aria-label="A creator presenting a product in a social-media video, surrounded by social platform symbols.">
      <div className="landing-visual-art" aria-hidden="true">
        <div className="landing-visual-halo" />
        <div className="landing-visual-shape landing-visual-shape--back" />
        <div className="landing-visual-shape landing-visual-shape--front" />
        <div className="landing-phone">
          <img src="/spreadfast-creator.png" width="1024" height="1536" alt="" decoding="async" />
          <div className="landing-phone-notch" />
          <span className="landing-phone-topline">Creator spotlight</span>
          <div className="landing-phone-caption">
            <span className="landing-phone-play"><svg viewBox="0 0 20 20" fill="currentColor"><path d="m7 4 9 6-9 6V4Z" /></svg></span>
            <strong>Made to be shared.</strong>
            <span>Real stories. Real connection.</span>
          </div>
          <span className="landing-phone-home" />
        </div>
        <div className="landing-visual-tag"><span><CheckIcon /></span>Creator-led advertising</div>
        <div className="landing-impact-card">
          <span className="landing-impact-symbol"><CheckIcon /></span>
          <strong>Real people.<br />Real impact.</strong>
          <p>Authentic content.<br />A human connection.</p>
        </div>
        <div className="landing-social-rail">
          <span className="landing-social landing-social--tiktok"><svg viewBox="0 0 24 24" fill="none"><path d="M14 4v12a4 4 0 1 1-4-4M14 4c0 4 3 5 6 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg></span>
          <span className="landing-social landing-social--instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" /></svg></span>
          <span className="landing-social landing-social--youtube"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="m10 9 6 3-6 3V9Z" fill="white" /></svg></span>
          <span className="landing-social landing-social--x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 4 14 16h-4L1 4h4ZM19 4 5 20" transform="translate(2 0)" /></svg></span>
        </div>
        <div className="landing-visual-note"><span />Your story, shared differently.</div>
      </div>
    </figure>
  );
}
