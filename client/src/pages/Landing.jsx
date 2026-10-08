import { getAuthDestination } from '../utils/authDestination';
import UiIcon from '../components/ui/UiIcon';
import React, { useContext, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { MegaphoneIcon, PeopleIcon, ShareIcon } from './Icons';
import { Button, Container } from '../components/ui';

import LandingHeroVisual from '../components/LandingHeroVisual';
import LandingSampleVideo from '../components/LandingSampleVideo';
import LandingVideoCarousel from '../components/LandingVideoCarousel';
import './Landing.css';

export default function LandingPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);

  const handleCreateCampaign = () => {
    if (user?.role === 'company') {
      navigate('/company');
    } else if (user) {
      // User is logged in but not a company
      alert('Only companies can create campaigns. Please login as a company.');
    } else {
      // Not logged in, redirect to register as company
      navigate('/register?role=company');
    }
  };

  const handleJoinAsPromoter = () => {
    if (user?.role === 'promoter') {
      navigate('/dashboard');
    } else if (user) {
      // User is logged in but not a promoter
      alert('Please login as a promoter to join campaigns.');
    } else {
      // Not logged in, redirect to register as promoter
      navigate('/register?role=promoter');
    }
  };

  const faqs = [
    {
      q: 'How is engagement verified?',
      a: 'Every promoter submission is tracked and checked against the campaign requirements before it counts toward payout. No automated bots or fake engagement is counted — only real, verifiable interactions.',
    },
    {
      q: "What if a promoter doesn't deliver?",
      a: "Businesses only pay for verified results. If a promoter's submission doesn't meet the campaign requirements, it simply doesn't count toward their share of the payout — there's no upfront risk to the business.",
    },
    {
      q: 'How much does it cost to run a campaign?',
      a: 'Campaigns cost ₦20,000 per creator. Choose the number of creators that fits your campaign.',
    },
    {
      q: 'How much does Quick Ads cost?',
      a: 'Quick Ads starts at ₦1,700 for one video generation, with larger credit packages available.',
    },
    {
      q: 'How do promoters get paid?',
      a: 'Promoters earn a share of the campaign pool based on their percentage of total group engagement. Withdrawals are processed through Paystack, with a minimum withdrawal of ₦1,000.',
    },
    {
      q: 'What platforms can I promote on?',
      a: 'Instagram, TikTok, X (Twitter), and WhatsApp are all supported for campaign promotion.',
    },
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
          <Link to="/" aria-label="SpreadFast home" className="landing-logo"><img className="landing-logo-image" src="/spreadfast-logo.png" alt="SpreadFast" width="2172" height="724" /></Link>
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
              <a href="#businesses" onClick={() => setMenuOpen(false)}>For Businesses</a>
              <a href="#creators" onClick={() => setMenuOpen(false)}>For Creators</a>
              <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
              <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            </div>
            <div className="landing-account-links">
              {user ? (
                <>
                  <span className="landing-welcome">Welcome, {user.name}</span>
                  <Link to={getAuthDestination(user)} className="sf-control sf-button sf-button--primary">{getAuthDestination(user) === '/admin-portal' ? 'Admin Dashboard' : 'Open Quick Ads'}</Link>
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
              <h1 id="landing-title">Get more customers.<br className="landing-title-break" /> Grow your Business.</h1>
              <p className="landing-hero-description">
                Create AI-powered video ads, launch creator campaigns, and reach more customers — all from one platform.
              </p>
              <div className="landing-hero-actions">
                <Link to="/quick-ad" className="sf-control sf-button sf-button--primary"><UiIcon name="video" /> Create a Quick Ad</Link>
                <Button size="lg" variant="secondary" onClick={handleCreateCampaign}>Start a Campaign <span aria-hidden="true"><UiIcon name="external" /></span></Button>
                <Button size="lg" variant="secondary" onClick={handleJoinAsPromoter}>Earn with SpreadFast</Button>
              </div>
              <div className="landing-trust" aria-label="Why SpreadFast">
                <span><strong>Real people</strong><small>Authentic content</small></span>
                <span><strong>Local reach</strong><small>Built for Nigeria</small></span>
                <span><strong>Secure payments</strong><small>Powered by Paystack</small></span>
              </div>
            </div>
            <LandingHeroVisual />
          </Container>
        </section>

        <section className="landing-quick-ads" aria-labelledby="landing-quick-ads-title">
          <Container>
            <div className="landing-quick-ads-card">
              <div className="landing-quick-ads-copy">
                <p className="landing-quick-ads-eyebrow"><span>Quick Ads</span> AI-generated short video advertising</p>
                <h2 id="landing-quick-ads-title">Turn one photo into an ad.</h2>
                <p className="landing-quick-ads-description">Upload your product photo and create a short AI-powered video ad in seconds.</p>
                <Link to="/quick-ad" className="sf-control sf-button sf-button--primary">Create a Quick Ad <UiIcon name="arrow" /></Link>
                <p className="landing-quick-ads-support">No editing. No prompts. No design experience needed.</p>
              </div>
              <figure className="landing-quick-ads-visual" aria-label="Before and after: a simple jollof rice, chicken, and plantain takeaway photo becomes a generated food advert video.">
                <div className="landing-quick-ads-flow">
                  <div className="landing-quick-ads-source">
                    <span className="landing-quick-ads-label">Your photo</span>
                    <div className="landing-quick-ads-photo"><div><img src="/quick-ads-food-photo.png" alt="" width="1254" height="1254" loading="lazy" decoding="async" /></div></div>
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
          </Container>
        </section>

        <section className="landing-how" aria-labelledby="how-title">
          <Container>
            <div className="landing-section-heading">
              <p className="landing-eyebrow">Quick Ads + Creator Campaigns</p>
              <h2 id="how-title">How SpreadFast Works</h2>
              <p>Create AI-powered ads or launch creator campaigns from one platform.</p>
            </div>
            <ol className="landing-steps">
              <li id="businesses">
                <span className="landing-step-icon" aria-hidden="true"><MegaphoneIcon color="currentColor" size={28} /></span>
                <h3>1. Create</h3>
                <p>Turn your product photo into an AI-powered video ad with Quick Ads.</p>
                <span className="landing-step-arrow" aria-hidden="true">⟶</span>
              </li>
              <li id="creators">
                <span className="landing-step-icon" aria-hidden="true"><ShareIcon color="currentColor" size={28} /></span>
                <h3>2. Promote</h3>
                <p>Launch a campaign and work with creators who can put your brand in front of real audiences.</p>
                <span className="landing-step-arrow" aria-hidden="true">⟶</span>
              </li>
              <li>
                <span className="landing-step-icon" aria-hidden="true"><PeopleIcon color="currentColor" size={28} /></span>
                <h3>3. Grow</h3>
                <p>Reach more customers through AI-created content and authentic creator promotion.</p>
              </li>
            </ol>
          </Container>
        </section>

        <section id="pricing" className="landing-pricing" aria-labelledby="pricing-title">
          <Container>
            <div className="landing-section-heading">
              <h2 id="pricing-title">A simple way to get started.</h2>
              <p>Two ways to advertise. Choose what works for your business.</p>
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
                <p className="landing-eyebrow">Creator Campaigns</p>
                <h3>Get your brand out there.</h3>
                <p className="landing-price">₦20,000 <span>per creator</span></p>
                <p>Promote your brand through creators and their audiences.</p>
                <ul><li>Work with verified creators</li><li>Launch campaigns in minutes</li><li>Reach customers with authentic content</li></ul>
                <Button variant="secondary" onClick={handleCreateCampaign}>Create a Campaign</Button>
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
            <div><h2>Better together.</h2><p>For Creators: Create content, join brand campaigns, and earn with SpreadFast.</p></div>
            <a href="https://chat.whatsapp.com/LQey4iZk9Hn2RSEg8DcLvr?mode=gi_t"
              target="_blank" rel="noopener noreferrer" className="sf-control sf-button sf-button--secondary">
              Join our WhatsApp creator community <span aria-hidden="true"><UiIcon name="external" /></span>
            </a>
          </Container>
        </section>
      </main>

      <footer className="landing-footer">
        <Container>
          <div className="landing-footer-grid">
            <div className="landing-footer-brand"><img className="landing-logo-image" src="/spreadfast-logo.png" alt="SpreadFast" width="2172" height="724" /><p>AI-powered advertising for businesses and creators.</p></div>
            <div><h2>For Companies</h2><ul>
              <li><button type="button" onClick={handleCreateCampaign}>Create Campaign</button></li>
              <li><a href="#creators">Meet our creators</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul></div>
            <div><h2>For Promoters</h2><ul>
              <li><button type="button" onClick={handleJoinAsPromoter}>Find Campaigns</button></li>
              <li><a href="#creators">How to Earn</a></li>
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
