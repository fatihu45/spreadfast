import React, { useEffect, useState } from 'react';
import { getCampaigns } from '../utils/api';
import { Link } from 'react-router-dom';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const data = await getCampaigns();
        setCampaigns(data);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading campaigns...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-12">Available Campaigns</h1>

        {campaigns.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-600 mb-6">No campaigns available yet</p>
            <Link to="/company" className="btn-primary inline-block">
              Create First Campaign
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="card">
                <img
                  src={campaign.image}
                  alt={campaign.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <h3 className="text-xl font-bold mb-2">{campaign.name}</h3>
                <p className="text-gray-600 mb-3 line-clamp-2">{campaign.description}</p>
                
                <div className="bg-gray-100 p-3 rounded mb-4 text-sm">
                  <p className="font-semibold text-primary mb-2">{campaign.caption}</p>
                  <div className="space-y-1 text-gray-700">
                    <p><strong>Platform:</strong> {campaign.platform}</p>
                    <p><strong>Budget:</strong> ₦{campaign.budget}</p>
                    <p><strong>Duration:</strong> {campaign.duration}</p>
                  </div>
                </div>

                <Link
                  to={`/submit?campaignId=${campaign.id}`}
                  className="btn-primary block text-center"
                >
                  Participate
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
