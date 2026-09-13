import React from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-surface text-ink border-b border-line">
      <div className="max-w-content mx-auto px-4 py-4 flex flex-wrap gap-4 justify-between items-center">
        <span className="text-2xl font-bold cursor-default">SpreadFast</span>
        <div className="flex flex-wrap gap-4">
          <Link to="/" className="hover:text-green-200 transition">Home</Link>
          <Link to="/campaigns" className="hover:text-green-200 transition">Campaigns</Link>
          <Link to="/company" className="hover:text-green-200 transition">Create Campaign</Link>
          <Link to="/signup" className="hover:text-green-200 transition">Join as Promoter</Link>
          <Link to="/admin" className="hover:text-green-200 transition">Admin</Link>
        </div>
      </div>
    </nav>
  );
}
