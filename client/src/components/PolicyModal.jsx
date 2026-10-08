import UiIcon from './ui/UiIcon';
import React, { useState, useEffect } from 'react';
import './PolicyModal.css';

export default function PolicyModal({ isOpen, policyType, onClose }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const loadPolicy = async () => {
    setLoading(true);
    setContent('');
    try {
      const fileName = policyType === 'terms' ? 'terms-and-conditions.html' : 'privacy-policy.html';
      const response = await fetch(`/policies/${fileName}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Policy unavailable');
      const html = await response.text();
      const document = new DOMParser().parseFromString(html, 'text/html');
      const policy = document.querySelector('[data-policy-content]');
      if (!policy) throw new Error('Invalid policy response');
      if (!controller.signal.aborted) setContent(policy.innerHTML);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Error loading policy:', error);
      setContent('<p>Error loading policy. Please try again.</p>');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    };
    loadPolicy();
    return () => controller.abort();
  }, [isOpen, policyType]);

  if (!isOpen) return null;

  return (
    <div className="policy-modal-overlay" onClick={onClose}>
      <div className="policy-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="policy-modal-header">
          <h2>
            {policyType === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
          </h2>
          <button type="button" aria-label="Close policy" className="policy-modal-close" onClick={onClose}>
            <UiIcon name="close" />
          </button>
        </div>
        
        <div className="policy-modal-content">
          {loading ? (
            <p>Loading policy...</p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          )}
        </div>
        
        <div className="policy-modal-footer">
          <button type="button" className="policy-modal-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
