import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-surface text-ink border-t border-line py-8 mt-12">
      <div className="max-w-content mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-3">SpreadFast</h3>
            <p className="text-muted">Get real customers through real people</p>
          </div>
          <div>
            <h4 className="font-bold mb-3">Quick Links</h4>
            <ul className="text-muted space-y-2">
              <li><a href="/" className="hover:text-primary">Home</a></li>
              <li><a href="/campaigns" className="hover:text-primary">Campaigns</a></li>
              <li><a href="/admin" className="hover:text-primary">Admin</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3">Contact</h4>
            <a href="https://wa.me/1234567890" className="text-muted hover:text-primary block">WhatsApp</a>
            <a href="https://t.me/spreadfast" className="text-muted hover:text-primary block">Telegram</a>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-6 text-center text-muted">
          <p>&copy; 2025 SpreadFast. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
