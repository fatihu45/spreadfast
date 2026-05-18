import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CompanyDashboard from './pages/CompanyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Wallet from './pages/Wallet';
import PaymentCallback from './pages/PaymentCallback';
import PromotionDashboard from './pages/PromotionDashboard';
import AvailableCampaigns from './pages/AvailableCampaigns';
import SubmitProof from './pages/SubmitProof';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = React.useContext(AuthContext);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = React.useContext(AuthContext);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  // Check if user is admin (compare with env variable)
  const adminEmail = process.env.REACT_APP_ADMIN_EMAIL || 'admin@spreadfast.com';
  if (user.email !== adminEmail) {
    // Redirect based on user role
    if (user.role === 'promoter') {
      return <Navigate to="/promoter-dashboard" />;
    } else if (user.role === 'company') {
      return <Navigate to="/company" />;
    }
    return <Navigate to="/" />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Analytics />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/payment-callback" element={<PaymentCallback />} />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/company"
            element={
              <ProtectedRoute>
                <CompanyDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/promoter-dashboard"
            element={
              <ProtectedRoute>
                <PromotionDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/available-campaigns"
            element={
              <ProtectedRoute>
                <AvailableCampaigns />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/submit-proof"
            element={
              <ProtectedRoute>
                <SubmitProof />
              </ProtectedRoute>
            }
          />
          
          {/* Hidden Admin Portal - Only accessible to admin email */}
          <Route
            path="/admin-portal"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;