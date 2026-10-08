import React, { useEffect, useId, useState } from 'react';
import { Button } from './ui';

export function appendBranding(form, value) {
  const mode = value.mode || 'none';
  if (mode === 'name' && !value.name?.trim()) throw new Error('Enter your business name or remove branding.');
  if (mode === 'logo' && !value.file) throw new Error('Choose a logo or remove branding.');
  form.append('brandingMode', mode);
  if (mode === 'name') form.append('businessName', value.name.trim());
  if (mode === 'logo') form.append('brandingLogo', value.file);
}

export default function QuickAdBranding({ value, onChange, disabled, expanded = false, title = 'Add your branding' }) {
  const id = useId();
  const [error, setError] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  useEffect(() => {
    if (!value.file) { setLogoPreview(''); return undefined; }
    const url = URL.createObjectURL(value.file);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);
  function selectLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) {
      setError('Choose a PNG, JPG, or WEBP logo up to 2 MB.'); return;
    }
    setError(''); onChange({ mode: 'logo', file });
  }
  return <details className="quick-ad-branding" open={expanded || undefined}>
    <summary>{title}<span>Optional</span></summary>
    <div className="quick-ad-branding-body">
      <div className="quick-ad-branding-choices" role="group" aria-label="Branding type">
        <button type="button" disabled={disabled} aria-pressed={value.mode === 'name'} onClick={() => { setError(''); onChange({ mode: 'name', name: '' }); }}>Business name</button>
        <button type="button" disabled={disabled} aria-pressed={value.mode === 'logo'} onClick={() => { setError(''); onChange({ mode: 'logo' }); }}>Upload logo</button>
      </div>
      {value.mode === 'name' && <label className="quick-ad-branding-name" htmlFor={id}>Business name
        <input id={id} type="text" maxLength={40} value={value.name || ''} placeholder="Your business name" disabled={disabled} onChange={event => onChange({ mode: 'name', name: event.target.value })} />
      </label>}
      {value.mode === 'logo' && <div className="quick-ad-branding-logo">
        {(logoPreview || value.logoUrl) && <img src={logoPreview || value.logoUrl} alt="Your logo" />}
        <label className={'quick-ad-picker' + (disabled ? ' is-disabled' : '')}>
          <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload branding logo" disabled={disabled} onChange={selectLogo} />
          <span>{logoPreview || value.logoUrl ? 'Replace logo' : 'Choose logo'}</span>
        </label>
      </div>}
      <p>A small {value.mode === 'name' ? 'name' : 'logo'} appears in the top-left corner. {value.mode === 'logo' ? 'PNG with a transparent background works best. Up to 2 MB.' : 'Your product stays the focus.'}</p>
      {value.mode !== 'none' && <Button size="sm" variant="secondary" disabled={disabled} onClick={() => { setError(''); onChange({ mode: 'none' }); }}>Remove branding</Button>}
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}
