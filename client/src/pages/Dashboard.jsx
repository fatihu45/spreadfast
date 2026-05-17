import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';
import './Pages.css';

export default function Dashboard() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Guard: Redirect if not authenticated
  useEffect(() => {
  if (!authLoading && !user) {
    navigate('/login');
    return;
  }

  if (!authLoading && user) {
    // Admin redirect
    if (user.email === process.env.REACT_APP_ADMIN_EMAIL) {
      navigate('/admin');
      return;
    }
    // Company redirect
    if (user.role === 'company') {
      navigate('/company');
      return;
    }
    // Promoter redirect
    if (user.role === 'promoter') {
      navigate('/promoter-dashboard');
      return;
    }
  }
}, [authLoading, user, navigate]);

  // Loading state from AuthContext
  if (authLoading) {
    return (
      <div className="dashboard">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Guard: User not authenticated
  if (!user) {
    return (
      <div className="dashboard">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h1>Welcome to SpreadFast</h1>
      <p>User: {user?.name} ({user?.role})</p>

      {user?.role === 'company' && (
        <button 
          onClick={() => navigate('/company')}
          className="action-button"
        >
          Create Campaign
        </button>
      )}

      {user?.role === 'promoter' && (
        <button 
          onClick={() => navigate('/promoter-dashboard')}
          className="action-button"
        >
          My Promotions
        </button>
      )}

      <h2>Available Campaigns</h2>
      <div className="campaigns-grid">
        {loading ? (
          <p>Loading campaigns...</p>
        ) : !campaigns || campaigns.length === 0 ? (
          <p>No campaigns available yet.</p>
        ) : (
          (campaigns || []).map(campaign => (
            <div key={campaign?.id} className="campaign-card">
              <h3>{campaign?.title || campaign?.name}</h3>
              <p>{campaign?.description || campaign?.caption}</p>
              <p><strong>Budget:</strong> ₦{campaign?.budget || 0}</p>
              <p><strong>Status:</strong> {campaign?.status || 'Active'}</p>
              <p><strong>Promoters:</strong> {(campaign?.subscribedPromoters || []).length}</p>
              
              {user?.role === 'promoter' && (
                <button 
                  onClick={() => navigate(`/submit-proof?campaignId=${campaign?.id}`)}
                  className="submit-button"
                >
                  Submit Proof
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
