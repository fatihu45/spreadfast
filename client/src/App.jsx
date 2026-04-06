import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import CompanyDashboard from './pages/CompanyDashboard';
import PromoteSignup from './pages/PromoteSignup';
import Campaigns from './pages/Campaigns';
import SubmitProof from './pages/SubmitProof';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/company" element={<CompanyDashboard />} />
            <Route path="/signup" element={<PromoteSignup />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/submit" element={<SubmitProof />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
