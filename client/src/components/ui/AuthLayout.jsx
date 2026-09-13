import React from 'react';
import { Link } from 'react-router-dom';
import './auth-layout.css';
export default function AuthLayout({ children, className = '' }) {
  return <main className={'sf-signup ' + className}>
    <Link to="/" className="sf-signup-logo" aria-label="SpreadFast home"><img src="/spreadfast-logo.png" alt="SpreadFast" width="2172" height="724" /></Link>
    <div className="sf-signup-card">{children}</div>
  </main>;
}
