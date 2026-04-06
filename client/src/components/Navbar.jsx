import React from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-primary text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">SpreadFast</Link>
        <div className="flex gap-4">
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
