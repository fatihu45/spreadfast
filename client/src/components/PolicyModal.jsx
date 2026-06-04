import React, { useState, useEffect } from 'react';
import './PolicyModal.css';

export default function PolicyModal({ isOpen, policyType, onClose }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPolicy();
    }
  }, [isOpen, policyType]);

  const loadPolicy = async () => {
    setLoading(true);
    try {
      const fileName = policyType === 'terms' ? 'terms-and-conditions.html' : 'privacy-policy.html';
      const response = await fetch(`/policies/${fileName}`);
      const html = await response.text();
      setContent(html);
    } catch (error) {
      console.error('Error loading policy:', error);
      setContent('<p>Error loading policy. Please try again.</p>');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="policy-modal-overlay" onClick={onClose}>
      <div className="policy-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="policy-modal-header">
          <h2>
            {policyType === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
          </h2>
          <button className="policy-modal-close" onClick={onClose}>
            ✕
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
          <button className="policy-modal-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
