import UiIcon from '../components/ui/UiIcon';
import React, { useContext, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { MegaphoneIcon, PeopleIcon, ShareIcon } from './Icons';
import { Button, Container } from '../components/ui';

import LandingHeroVisual from '../components/LandingHeroVisual';
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
      a: 'Campaigns cost ₦20,000 per promoter. Choose the number of promoters that fits your campaign.',
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
                  <Link to="/dashboard" className="sf-control sf-button sf-button--primary">Dashboard</Link>
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
              <p className="landing-eyebrow"><span aria-hidden="true" />People-powered growth</p>
              <h1 id="landing-title">Get more customers.<br className="landing-title-break" /> Grow your Business.</h1>
              <p className="landing-hero-description">
                Connect with verified creators who bring your brand to life through authentic advertising.
                Simple, human, effective.
              </p>
              <div className="landing-hero-actions">
                <Button size="lg" onClick={handleCreateCampaign}>Start a Campaign <span aria-hidden="true"><UiIcon name="external" /></span></Button>
                <Link to="/quick-ad" className="sf-control sf-button sf-button--secondary"><UiIcon name="video" /> Create a Quick Ad</Link>
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
                <p className="landing-quick-ads-eyebrow"><span>New</span> SpreadFast Quick Ads</p>
                <h2 id="landing-quick-ads-title">Turn one photo into an ad.</h2>
                <p className="landing-quick-ads-description">Upload your product photo and create a short AI-powered video ad in seconds.</p>
                <Link to="/quick-ad" className="sf-control sf-button sf-button--primary">Create a Quick Ad <UiIcon name="arrow" /></Link>
                <p className="landing-quick-ads-support">No editing. No prompts. No design experience needed.</p>
              </div>
              <figure className="landing-quick-ads-visual" aria-label="Before and after: a simple jollof rice, chicken, and plantain takeaway photo becomes a polished five-second food advert preview.">
                <div className="landing-quick-ads-flow" aria-hidden="true">
                  <div className="landing-quick-ads-source">
                    <span className="landing-quick-ads-label">Your photo</span>
                    <div className="landing-quick-ads-photo"><div><img src="/quick-ads-food-photo.png" alt="" width="1254" height="1254" loading="lazy" decoding="async" /></div></div>
                    <span className="landing-quick-ads-source-note"><UiIcon name="image" /> One product.</span>
                  </div>
                  <span className="landing-quick-ads-arrow"><UiIcon name="arrow" /></span>
                  <div className="landing-quick-ads-output">
                    <span className="landing-quick-ads-label">Your next ad</span>
                    <div className="landing-quick-ads-phone">
                      <img src="/quick-ads-food-ad.png" alt="" width="941" height="1672" loading="lazy" decoding="async" />
                      <span className="landing-quick-ads-phone-brand">SpreadFast</span>
                      <div className="landing-quick-ads-caption"><strong>Craving something good?</strong><span>Made fresh. Delivered fast.</span></div>
                      <div className="landing-quick-ads-timeline"><span /><div><UiIcon name="video" /><span>0:00 / 0:05</span></div></div>
                    </div>
                  </div>
                </div>
                <figcaption>Illustrative preview</figcaption>
              </figure>
            </div>
          </Container>
        </section>

        <section className="landing-how" aria-labelledby="how-title">
          <Container>
            <div className="landing-section-heading">
              <p className="landing-eyebrow">A little content. A real connection.</p>
              <h2 id="how-title">How SpreadFast Works</h2>
              <p>Three simple steps to get your brand seen — or start creating.</p>
            </div>
            <ol className="landing-steps">
              <li id="businesses">
                <span className="landing-step-icon" aria-hidden="true"><MegaphoneIcon color="currentColor" size={28} /></span>
                <h3>1. Businesses</h3>
                <p>Create a campaign. Share your brief, choose your budget, and tell your story.</p>
                <span className="landing-step-arrow" aria-hidden="true">⟶</span>
              </li>
              <li id="creators">
                <span className="landing-step-icon" aria-hidden="true"><ShareIcon color="currentColor" size={28} /></span>
                <h3>2. Creators</h3>
                <p>Join a campaign, create authentic content, and submit your post for review.</p>
                <span className="landing-step-arrow" aria-hidden="true">⟶</span>
              </li>
              <li>
                <span className="landing-step-icon" aria-hidden="true"><PeopleIcon color="currentColor" size={28} /></span>
                <h3>3. Customers</h3>
                <p>Discover your brand through real people. Build connections that inspire action.</p>
              </li>
            </ol>
          </Container>
        </section>

        <section id="pricing" className="landing-pricing" aria-labelledby="pricing-title">
          <Container>
            <div className="landing-section-heading">
              <h2 id="pricing-title">A simple way to get started.</h2>
              <p>For the brands with a story. And the people who bring it to life.</p>
            </div>
            <div className="landing-pricing-grid">
              <article className="landing-price-card">
                <p className="landing-eyebrow">For Businesses</p>
                <h3>Put your brand out there.</h3>
                <p className="landing-price">₦20,000 <span>per promoter</span></p>
                <ul><li>Work with verified promoters</li><li>Launch campaigns in minutes</li><li>Reach more customers with authentic content</li></ul>
                <Button onClick={handleCreateCampaign}>Create a Campaign</Button>
              </article>
              <article className="landing-price-card">
                <p className="landing-eyebrow">For Creators</p>
                <h3>Make content. Make an impact.</h3>
                <p>Earn a share of every campaign pool.</p>
                <ul><li>Work with growing brands</li><li>Join campaigns that fit your style</li><li>Turn your content into income</li></ul>
                <Button variant="secondary" onClick={handleJoinAsPromoter}>Join as Promoter</Button>
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
            <div><h2>Better together.</h2><p>Meet the people creating with SpreadFast.</p></div>
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
            <div className="landing-footer-brand"><img className="landing-logo-image" src="/spreadfast-logo.png" alt="SpreadFast" width="2172" height="724" /><p>Get more customers. grow your business.</p></div>
            <div><h2>For Companies</h2><ul>
              <li><button type="button" onClick={handleCreateCampaign}>Create Campaign</button></li>
              <li><a href="#">View Promoters</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul></div>
            <div><h2>For Promoters</h2><ul>
              <li><button type="button" onClick={handleJoinAsPromoter}>Find Campaigns</button></li>
              <li><a href="#">How to Earn</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul></div>
            <div><h2>Connect</h2><ul>
              <li><a href="https://chat.whatsapp.com/LQey4iZk9Hn2RSEg8DcLvr?mode=gi_t" target="_blank" rel="noopener noreferrer">WhatsApp community</a></li>
              <li><a href="https://wa.me/+2349071023617" target="_blank" rel="noopener noreferrer">WhatsApp support</a></li>
            </ul></div>
          </div>
          <p className="landing-copyright">© 2026 SpreadFast. All rights reserved.</p>
        </Container>
      </footer>
    </div>
  );
}
