import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCallAuth, apiCall } from '../utils/api';
import './Pages.css';

export default function PromotionDashboard() {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load campaigns and wallet
  useEffect(() => {
    if (user?.role !== 'promoter') {
      navigate('/');
      return;
    }
    fetchPromotionData();
  }, [user, navigate, token]);

  const fetchPromotionData = async () => {
    try {
      setLoading(true);
      
      // Fetch wallet balance
      const walletData = await apiCallAuth('/api/wallet', token);
      if (walletData.success) {
        setWallet(walletData.wallet);
      }

      // Fetch available campaigns
      const campaignsData = await apiCall('/api/campaigns');
      if (campaignsData.success) {
        // Filter campaigns that the promoter is subscribed to
        // In a real app, you'd get promoter subscriptions from backend
        setActiveCampaigns(campaignsData.campaigns);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) return <div className="dashboard">Loading...</div>;

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <span className="text-2xl font-bold text-green-700 cursor-default">
              SpreadFast
            </span>
            <div className="hidden md:flex gap-6">
              <Link to="/promoter-dashboard" className="text-green-700 hover:text-green-800 font-semibold">
                Dashboard
              </Link>
              <Link to="/available-campaigns" className="text-gray-700 hover:text-green-700 font-semibold">
                Find Campaigns
              </Link>
              <Link to="/wallet" className="text-gray-700 hover:text-green-700 font-semibold">
                Wallet
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700 font-medium">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome, {user?.name}!</h1>
          <p className="text-gray-600">Manage your campaigns and track your earnings</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Earnings Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-8 shadow-lg">
            <p className="text-green-100 font-semibold mb-2">Total Earnings</p>
            <h2 className="text-4xl font-bold">₦{wallet?.balance ? parseFloat(wallet.balance).toLocaleString() : '0'}</h2>
            <p className="text-green-100 text-sm mt-2">Available for withdrawal</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-8 shadow-lg">
            <p className="text-blue-100 font-semibold mb-2">Active Campaigns</p>
            <h2 className="text-4xl font-bold">{activeCampaigns.length}</h2>
            <p className="text-blue-100 text-sm mt-2">Campaigns you subscribed to</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-8 shadow-lg">
            <p className="text-purple-100 font-semibold mb-2">Submissions</p>
            <h2 className="text-4xl font-bold">
              {activeCampaigns.reduce((sum, c) => sum + (c.submissions?.length || 0), 0)}
            </h2>
            <p className="text-purple-100 text-sm mt-2">Proofs submitted</p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <Link
            to="/available-campaigns"
            className="bg-green-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-green-700 transition text-center"
          >
            Browse Available Campaigns
          </Link>
          <Link
            to="/wallet"
            className="bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-blue-700 transition text-center"
          >
            Manage Wallet & Withdrawals
          </Link>
        </div>

        {/* Active Campaigns Section */}
        {activeCampaigns.length > 0 ? (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-8">Your Active Campaigns</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCampaigns.map(campaign => (
                <div key={campaign.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 border-l-4 border-green-500">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{campaign.title || campaign.name}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {campaign.description || campaign.caption}
                  </p>
                  <div className="space-y-2 text-sm mb-4">
                    <p className="text-gray-700">
                      <strong>Budget:</strong> ₦{campaign.budget ? parseFloat(campaign.budget).toLocaleString() : 'N/A'}
                    </p>
                    <p className="text-gray-700">
                      <strong>Status:</strong> <span className="px-2 py-1 rounded text-white text-xs font-semibold bg-green-500">
                        {campaign.status || 'Active'}
                      </span>
                    </p>
                    <p className="text-gray-700">
                      <strong>Submissions:</strong> {campaign.submissions?.length || 0}
                    </p>
                  </div>
                  <button 
                    onClick={() => navigate(`/submit-proof?campaignId=${campaign.id}`)}
                          className="w-full py-2 rounded-lg font-semibold transition bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Submit Proof
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-50 rounded-lg">
            <p className="text-xl text-gray-600 mb-6">No active campaigns yet</p>
            <Link
              to="/available-campaigns"
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition inline-block"
            >
              Browse Campaigns
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
