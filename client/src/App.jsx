import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import CompanyDashboard from './pages/CompanyDashboard';
import QuickAd from './pages/QuickAd';
import QuickAdCredits from './pages/QuickAdCredits';
import AdminDashboard from './pages/AdminDashboard';
import Wallet from './pages/Wallet';
import PaymentCallback from './pages/PaymentCallback';
import PromotionDashboard from './pages/PromotionDashboard';
import AvailableCampaigns from './pages/AvailableCampaigns';
import SubmitProof from './pages/SubmitProof';
import DashboardShell from './components/DashboardShell';
import './App.css';
import './styles/legacy-ui.css';

function ProtectedRoute({ children }) {
  const { user, loading } = React.useContext(AuthContext);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function QuickAdRedirect() {
  const { user } = React.useContext(AuthContext);
  const { search, hash } = useLocation();
  const destination = user?.role === 'company' ? '/company/quick-ads' : '/promoter/quick-ads';
  return <Navigate to={`${destination}${search}${hash}`} replace />;
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
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/payment-callback" element={<PaymentCallback />} />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardShell><Dashboard /></DashboardShell>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/company"
            element={
              <ProtectedRoute>
                <DashboardShell><CompanyDashboard /></DashboardShell>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <DashboardShell><Wallet /></DashboardShell>
              </ProtectedRoute>
            }
          />

          {['/company/quick-ads', '/promoter/quick-ads'].map(path => <Route key={path} path={path} element={
            <ProtectedRoute>
              <DashboardShell><QuickAd /></DashboardShell>
            </ProtectedRoute>
          } />)}
          {['/quick-ad', '/quickads'].map(path => <Route key={path} path={path} element={
            <ProtectedRoute><QuickAdRedirect /></ProtectedRoute>
          } />)}
          <Route path="/quickads/credits" element={<ProtectedRoute><DashboardShell><QuickAdCredits /></DashboardShell></ProtectedRoute>} />
          
          <Route
            path="/promoter-dashboard"
            element={
              <ProtectedRoute>
                <DashboardShell><PromotionDashboard /></DashboardShell>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/available-campaigns"
            element={
              <ProtectedRoute>
                <DashboardShell><AvailableCampaigns /></DashboardShell>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/submit-proof"
            element={
              <ProtectedRoute>
                <DashboardShell><SubmitProof /></DashboardShell>
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
