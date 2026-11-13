import { getAuthDestination } from '../utils/authDestination';
import UiIcon from '../components/ui/UiIcon';
import React, { useContext, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { MegaphoneIcon, PeopleIcon, ShareIcon } from './Icons';
import { Button, Container } from '../components/ui';

import LandingHeroVisual from '../components/LandingHeroVisual';
import LandingSampleVideo from '../components/LandingSampleVideo';
import LandingVideoCarousel from '../components/LandingVideoCarousel';
import './Landing.css';
import { StudioCards } from './Studios';

export default function LandingPage() {
  const { user } = useContext(AuthContext);
  const [openFaq, setOpenFaq] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);

  const faqs = [
    { q: 'What can I create with SpreadFast?', a: 'Create short product videos with Quick Ad, rotating outfit videos with Fashion Studio, and multi-scene ads with AI Commercial. Upload your product photos and choose the format that fits your business.' },
    { q: 'How does Fashion Studio work?', a: 'Open Fashion Studio from Create and upload clear front and back photos of your outfit. SpreadFast creates an invisible-mannequin video. Add optional specifications to describe details that should stay consistent.' },
    { q: 'How much does it cost?', a: 'Buy 1 credit for ₦1,700, 4 for ₦5,000, 8 for ₦10,000, or 16 for ₦20,000. Quick Ad uses 1 credit. AI Commercial shows the credits required for your selected tier before generation.' },
    { q: 'Do I need editing experience?', a: 'No. Upload clear product photos, choose a style, and add your product details. SpreadFast handles the video generation. Review the result before publishing, because AI can change product details.' },
    { q: 'Can I add my brand?', a: 'Yes. Use the branding options in the workspace to add your brand name or logo. Check the preview to make sure the final ad represents your business accurately.' },
    { q: 'Where can I use my video?', a: 'Download eligible completed ads and share them on Instagram, TikTok, WhatsApp, or other channels. Free previews may require a credit purchase to unlock downloads. Generation time varies by product and demand.' },
  ];

  return (
    <div className="sf-landing">
      <a className="sf-skip-link" href="#landing-main">Skip to content</a>
      <header className="landing-header" onKeyDown={event => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}>
        <Container className="landing-header-inner">
          <Link to="/" aria-label="SpreadFast home" className="landing-logo"><img className="landing-logo-image" src="/spreadfast-logo.webp" alt="SpreadFast" width="2172" height="724" /></Link>
          <Button ref={menuButton} variant="ghost" className="landing-menu-toggle"
            aria-expanded={menuOpen} aria-controls="landing-navigation"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setMenuOpen(!menuOpen)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d={menuOpen ? 'm6 6 12 12M6 18 18 6' : 'M4 7h16M4 12h16M4 17h16'} />
            </svg>
          </Button>
          <nav id="landing-navigation" aria-label="Main navigation"
            className={'landing-navigation' + (menuOpen ? ' is-open' : '')}>
            <div className="landing-section-links">
              <a href="#products" onClick={() => setMenuOpen(false)}>Products</a>
              <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
              <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
              <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            </div>
            <div className="landing-account-links">
              {user ? (
                <>
                  <span className="landing-welcome">Welcome, {user.name}</span>
                  <Link to={getAuthDestination(user)} className="sf-control sf-button sf-button--primary">{getAuthDestination(user) === '/admin-portal' ? 'Admin Dashboard' : 'Create Ad'}</Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="landing-login">Log in</Link>
                  <Link to="/register" className="sf-control sf-button sf-button--primary">Get Started</Link>
                </>
              )}
            </div>
          </nav>
        </Container>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="landing-title">
          <Container className="landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow"><span aria-hidden="true" />AI-powered advertising</p>
              <h1 id="landing-title">Ai advertisement,<br className="landing-title-break" /> made <span className="landing-title-accent">simple.</span></h1>
              <p className="landing-hero-description">
                Create stunning video advertisements for fashion, cars, shoes, bags, and more. No expensive cameras, editing skills, or production teams required. Studio availability is shown below.
              </p>
              <div className="landing-hero-actions">
                <Link to="/create" className="sf-control sf-button sf-button--primary"><UiIcon name="video" /> Create Your First Ad</Link>
                <a href="#studios" className="sf-control sf-button sf-button--secondary">Explore Studios <UiIcon name="arrow" /></a>
              </div>
              <div className="landing-trust" aria-label="Why SpreadFast">
                <span><strong>Your product</strong><small>Made for the spotlight</small></span>
                <span><strong>Pay in naira</strong><small>Buy credits as you need</small></span>
                <span><strong>Secure payments</strong><small>Powered by Paystack</small></span>
              </div>
            </div>
            <LandingHeroVisual />
          </Container>
        </section>

        <section id="studios"><Container><h2>What are you advertising?</h2><StudioCards marketing /></Container></section>

        <section id="products" className="landing-quick-ads" aria-labelledby="landing-quick-ads-title">
          <Container>
            <div className="landing-quick-ads-card">
              <div className="landing-quick-ads-copy">
                <p className="landing-quick-ads-eyebrow"><span>Quick Ads</span> AI-generated short video advertising</p>
                <h2 id="landing-quick-ads-title">Turn one photo into an ad.</h2>
                <p className="landing-quick-ads-description">Upload your product photo, choose a style, and generate a short video for your next post.</p>
                <Link to="/quick-ad" className="sf-control sf-button sf-button--primary">Create a Quick Ad <UiIcon name="arrow" /></Link>
                <p className="landing-quick-ads-support">No editing. No prompts. No design experience needed.</p>
              </div>
              <figure className="landing-quick-ads-visual" aria-label="Before and after: a simple jollof rice, chicken, and plantain takeaway photo becomes a generated food advert video.">
                <div className="landing-quick-ads-flow">
                  <div className="landing-quick-ads-source">
                    <span className="landing-quick-ads-label">Your photo</span>
                    <div className="landing-quick-ads-photo"><div><img src="/quick-ads-food-photo.webp" alt="" width="1254" height="1254" loading="lazy" decoding="async" /></div></div>
                    <span className="landing-quick-ads-source-note"><UiIcon name="image" /> One product.</span>
                  </div>
                  <span className="landing-quick-ads-arrow"><UiIcon name="arrow" /></span>
                  <div className="landing-quick-ads-output">
                    <span className="landing-quick-ads-label">Your next ad</span>
                    <div className="landing-quick-ads-phone">
                      <LandingSampleVideo name="jollof" label="Jollof rice, chicken and plantain Quick Ad" autoPlay />
                      <span className="landing-quick-ads-phone-brand">SpreadFast</span>
                      <div className="landing-quick-ads-caption"><strong>Craving something good?</strong><span>Made fresh. Delivered fast.</span></div>
                    </div>
                  </div>
                </div>
                <figcaption>Generated Quick Ad · 8 seconds</figcaption>
              </figure>
            </div>
            <LandingVideoCarousel />
            <div className="landing-fashion-feature">
              <img src="/studios/mannequin.webp" alt="Illustrative emerald kaftan on an invisible mannequin" width="1200" height="800" loading="lazy" />
              <div><p className="landing-eyebrow">Fashion Studio · inside Quick Ad</p><h2>Your collection. In motion.</h2>
                <p>Turn front and back outfit photos into a rotating invisible-mannequin video. Add specifications to guide the details, then preview before sharing.</p>
                <Link to="/quick-ad" className="sf-control sf-button sf-button--secondary">Explore Fashion Studio <UiIcon name="arrow" /></Link>
              </div>
            </div>
          </Container>
        </section>

        <section id="how-it-works" className="landing-how" aria-labelledby="how-title">
          <Container>
            <div className="landing-section-heading">
              <p className="landing-eyebrow">From photo to finished ad</p>
              <h2 id="how-title">How SpreadFast Works</h2>
              <p>A simple workflow. More room for your ideas.</p>
            </div>
            <ol className="landing-steps">
              <li>
                <span className="landing-step-icon" aria-hidden="true"><MegaphoneIcon color="currentColor" size={28} /></span>
                <h3>1. Upload</h3>
                <p>Start with clear product photos. Add your brand and the details that matter.</p>
                <span className="landing-step-arrow" aria-hidden="true">⟶</span>
              </li>
              <li>
                <span className="landing-step-icon" aria-hidden="true"><ShareIcon color="currentColor" size={28} /></span>
                <h3>2. Customize</h3>
                <p>Select your studio, presentation style, and optional branding.</p>
                <span className="landing-step-arrow" aria-hidden="true">⟶</span>
              </li>
              <li>
                <span className="landing-step-icon" aria-hidden="true"><PeopleIcon color="currentColor" size={28} /></span>
                <h3>3. Generate</h3>
                <p>Create and download your video advertisement. Review it before sharing.</p>
              </li>
            </ol>
          </Container>
        </section>

        <section id="pricing" className="landing-pricing" aria-labelledby="pricing-title">
          <Container>
            <div className="landing-section-heading">
              <h2 id="pricing-title">A simple way to get started.</h2>
              <p>One credit balance for your AI ads. No subscription required.</p>
            </div>
            <div className="landing-pricing-grid">
              <article className="landing-price-card">
                <p className="landing-eyebrow">Quick Ads</p>
                <h3>Create video ads with AI.</h3>
                <p className="landing-price"><span>Starting from</span> ₦1,700</p>
                <p>Turn one product photo into a short AI-powered video ad.</p>
                <ul><li>No editing required</li><li>No design experience needed</li><li>Ready for social media</li></ul>
                <Link to="/quick-ad" className="sf-control sf-button sf-button--primary">Create a Quick Ad</Link>
                <Link to="/quickads/credits" className="landing-text-link">View Quick Ads pricing</Link>
              </article>
              <article className="landing-price-card">
                <p className="landing-eyebrow">AI Commercial</p>
                <h3>Give your product a story.</h3>
                <p className="landing-price">Three scenes.<span> One commercial.</span></p>
                <p>Move from a product introduction to a showcase and a closing message.</p>
                <ul><li>AI-planned scenes</li><li>Your product and brand details</li><li>Credit cost shown before generation</li></ul>
                <Link to="/ai-commercials" className="sf-control sf-button sf-button--secondary">Create an AI Commercial</Link>
              </article>
            </div>
          </Container>
        </section>

        <section id="faq" className="landing-faq" aria-labelledby="faq-title">
          <Container className="landing-faq-grid">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">A few things to know</p>
              <h2 id="faq-title">Good questions.<br />Clear answers.</h2>
              <a href="https://wa.me/+2349071023617" target="_blank" rel="noopener noreferrer" className="landing-text-link">Contact on WhatsApp <span aria-hidden="true"><UiIcon name="external" /></span></a>
            </div>
            <div className="landing-faq-list">
              {faqs.map((item, idx) => (
                <div key={item.q} className="landing-faq-item">
                  <button type="button" id={'faq-question-' + idx}
                    aria-expanded={openFaq === idx} aria-controls={'faq-answer-' + idx}
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
                    {item.q}<span aria-hidden="true">{openFaq === idx ? '−' : '+'}</span>
                  </button>
                  <div id={'faq-answer-' + idx} hidden={openFaq !== idx}
                    aria-labelledby={'faq-question-' + idx} className="landing-faq-answer">{item.a}</div>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section className="landing-community">
          <Container className="landing-community-inner">
            <div><h2>Your next ad starts with a photo.</h2><p>Join other businesses exploring a simpler way to create video adverts.</p></div>
            <a href="https://chat.whatsapp.com/LQey4iZk9Hn2RSEg8DcLvr?mode=gi_t"
              target="_blank" rel="noopener noreferrer" className="sf-control sf-button sf-button--secondary">
              Join our WhatsApp community <span aria-hidden="true"><UiIcon name="external" /></span>
            </a>
          </Container>
        </section>
      </main>

      <footer className="landing-footer">
        <Container>
          <div className="landing-footer-grid">
            <div className="landing-footer-brand"><img className="landing-logo-image" src="/spreadfast-logo.webp" alt="SpreadFast" width="2172" height="724" /><p>AI-powered advertising for businesses and creators.</p></div>
            <div><h2>Create</h2><ul>
              <li><Link to="/quick-ad">Quick Ad &amp; Fashion Studio</Link></li>
              <li><Link to="/ai-commercials">AI Commercial</Link></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul></div>
            <div><h2>Explore</h2><ul>
              <li><Link to="/my-ads">My Ads</Link></li>
              <li><a href="#how-it-works">How it works</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul></div>
            <div><h2>Connect</h2><ul>
              <li><a href="https://chat.whatsapp.com/LQey4iZk9Hn2RSEg8DcLvr?mode=gi_t" target="_blank" rel="noopener noreferrer">WhatsApp community</a></li>
              <li><a href="https://wa.me/+2349071023617" target="_blank" rel="noopener noreferrer">WhatsApp support</a></li>
            </ul></div>
          </div>
          <nav className="landing-policy-links" aria-label="Policies"><a href="/policies/terms-and-conditions.html">Terms and Conditions</a> <a href="/policies/privacy-policy.html">Privacy Policy</a> <a href="/policies/refund-and-credits-policy.html">Refund and Credits Policy</a> <a href="/policies/acceptable-use-policy.html">Acceptable Use Policy</a> <a href="/policies/cookie-policy.html">Cookie and Browser Storage Policy</a> <a href="/policies/disclaimer.html">AI and Advertising Disclaimer</a></nav>
          <p className="landing-copyright">© 2026 SpreadFast. All rights reserved.</p>
        </Container>
      </footer>
    </div>
  );
}
