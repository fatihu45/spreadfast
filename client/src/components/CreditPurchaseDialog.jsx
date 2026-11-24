import React, { useEffect, useId, useRef } from 'react';
import { Button } from './ui';
import './StudioControls.css';

export default function CreditPurchaseDialog({ open, onClose, balance = 0, requiredCredits = 1 }) {
  const dialog = useRef(null);
  const title = useId();
  useEffect(() => {
    if (!open) return undefined;
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  if (!open) return null;
  return <dialog ref={dialog} className="sf-credit-dialog" aria-labelledby={title} onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <h2 id={title}>A few credits away</h2>
    <p>This ad needs {requiredCredits} {requiredCredits === 1 ? 'credit' : 'credits'}. Your photos and choices stay here while you top up.</p>
    <dl><div><dt>Available</dt><dd>{balance}</dd></div><div><dt>Needed</dt><dd>{Math.max(0, requiredCredits - balance)} more</dd></div></dl>
    <a className="sf-button sf-button--primary" href="/quickads/credits" target="_blank" rel="noopener noreferrer" onClick={onClose}>Buy credits</a>
    <small>Checkout opens in a new tab.</small>
    <Button variant="ghost" fullWidth onClick={onClose}>Keep editing</Button>
  </dialog>;
}
