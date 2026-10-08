import Alert from '../components/ui/Alert';
import AuthLayout from '../components/ui/AuthLayout';
/* eslint-disable */

import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PolicyModal from '../components/PolicyModal';
import { Button, FormField, Input } from '../components/ui';
import UiIcon from '../components/ui/UiIcon';
import './Register.css';

export default function Register() {
  const { register } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(searchParams.get('role') === 'company' ? 'company' : 'promoter');
  const [socialMedia, setSocialMedia] = useState({
    tiktok: '',
    instagram: '',
    twitter: '',
    facebook: '',
    youtube: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [openPolicy, setOpenPolicy] = useState(null);
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const headingRef = useRef(null);
  useEffect(() => { if (step === 2) headingRef.current?.focus(); }, [step]);


  const handleSocialMediaChange = (platform, value) => {
    setSocialMedia(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

      if (!agreedToTerms) {
    setError('You must agree to the Terms & Conditions and acknowledge the Privacy Policy.');
    return;
    }

    setLoading(true);
    setError('');

    const registrationData = {
      name,
      email,
      password,
      role,
      ...(role === 'promoter' && { socialMedia })
    };
    

    const result = await register(
      registrationData.name,
      registrationData.email,
      registrationData.password,
      registrationData.role,
      registrationData.socialMedia
    );
    if (result.success) {
      window.location.href = role === 'company' ? '/company' : '/promoter-dashboard';
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  const next = async event => {
    event.preventDefault();
    if (loading) return;
    if (step === 1) {
      if (!event.currentTarget.reportValidity()) return;
      setError(''); setShowPassword(false); setStep(2); return;
    }
    await handleSubmit(event);
  };
  return <AuthLayout>
      <ol className="sf-signup-progress" aria-label="Signup progress"><li aria-current={step === 1 ? 'step' : undefined}><span>1</span> Account</li><li aria-current={step === 2 ? 'step' : undefined}><span>2</span> Your role</li></ol>
      <h1 ref={headingRef} tabIndex={-1}>{step === 1 ? 'Create your account' : 'What best describes you?'}</h1>
      <p className="sf-signup-intro">{step === 1 ? 'Join creators and businesses growing with SpreadFast.' : 'Choose how you want to use SpreadFast.'}</p>
      {error && <Alert tone="error">{error}</Alert>}
      <form className="sf-signup-form" onSubmit={next}>
        <fieldset hidden={step !== 1} disabled={step !== 1 || loading}>
          <FormField label="Full name" required><Input type="text" autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your full name" /></FormField>
          <FormField label="Email" required><Input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></FormField>
          <div className="sf-signup-password"><FormField label="Password" id="signup-password" required><Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Create a password" /></FormField>
            <Button variant="ghost" size="sm" className="sf-signup-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="signup-password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</Button>
          </div>
        </fieldset>
        {step === 2 && <fieldset disabled={loading} className="sf-signup-role-fields">
          <legend className="sr-only">Choose your role</legend>
          <div className="sf-signup-roles">{[
            { value: 'promoter', title: 'Promote campaigns', description: 'Create content and earn with growing brands.', icon: 'campaign' },
            { value: 'company', title: 'Advertise my business', description: 'Reach more people with authentic creator content.', icon: 'home' }
          ].map(option => <label key={option.value} className={'sf-signup-role' + (role === option.value ? ' is-selected' : '')}>
            <span className="sf-signup-role-icon"><UiIcon name={option.icon} /></span><span className="sf-signup-role-copy"><strong>{option.title}</strong><span>{option.description}</span></span>
            <input type="radio" name="account-role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)} />
          </label>)}</div>
          {role === 'promoter' && <details className="sf-signup-social"><summary>Add social profiles <span>(optional)</span></summary><div>
            {Object.entries({ tiktok: 'TikTok handle', instagram: 'Instagram handle', twitter: 'X (Twitter) handle', facebook: 'Facebook URL', youtube: 'YouTube channel URL' }).map(([platform, label]) => <FormField label={label} key={platform}><Input type="text" value={socialMedia[platform]} onChange={event => handleSocialMediaChange(platform, event.target.value)} /></FormField>)}
          </div></details>}
          <div className="sf-signup-consent"><input id="signup-consent" type="checkbox" checked={agreedToTerms} onChange={event => setAgreedToTerms(event.target.checked)} required />
            <div><label htmlFor="signup-consent">I agree to the </label><button type="button" onClick={() => setOpenPolicy('terms')}>Terms &amp; Conditions</button> and acknowledge the <button type="button" onClick={() => setOpenPolicy('privacy')}>Privacy Policy</button>.</div>
          </div>
        </fieldset>}
        <Button type="submit" fullWidth disabled={loading}>{loading ? 'Creating account...' : step === 1 ? 'Continue' : 'Create account'}</Button>
        {step === 2 && <Button variant="ghost" fullWidth disabled={loading} onClick={() => { setStep(1); setError(''); }}>Back to account details</Button>}
      </form>
      <p className="sf-signup-login">Already have an account? <Link to="/login">Log in</Link></p>
    <PolicyModal isOpen={openPolicy === 'terms'} policyType="terms" onClose={() => setOpenPolicy(null)} />
    <PolicyModal isOpen={openPolicy === 'privacy'} policyType="privacy" onClose={() => setOpenPolicy(null)} />
  </AuthLayout>;
}
