import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function LandingPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleCreateCampaign = () => {
    if (user?.role === 'company') {
      navigate('/company');
    } else if (user) {
      // User is logged in but not a company
      alert('Only companies can create campaigns. Please login as a company.');
    } else {
      // Not logged in, redirect to register as company
      navigate('/register?role=company');
    }
  };

  const handleJoinAsPromoter = () => {
    if (user?.role === 'promoter') {
      navigate('/dashboard');
    } else if (user) {
      // User is logged in but not a promoter
      alert('Please login as a promoter to join campaigns.');
    } else {
      // Not logged in, redirect to register as promoter
      navigate('/register?role=promoter');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-700">SpreadFast</h1>
          <div className="flex gap-4">
            {user ? (
              <>
                <span className="text-gray-700 font-medium">Welcome, {user.name}</span>
                <Link to="/dashboard" className="text-green-700 hover:text-green-800 font-semibold">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="text-green-700 hover:text-green-800 font-semibold">
                  Login
                </Link>
                <Link to="/register" className="bg-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-800">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-green-700 to-green-900 text-white py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">Get Real Customers Through Real People</h1>
          <p className="text-xl mb-10 text-green-50">
            SpreadFast connects businesses with promoters to amplify their reach through authentic social media marketing
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={handleCreateCampaign}
              className="bg-white text-green-700 px-8 py-3 rounded-lg font-bold hover:bg-green-50 transition"
            >
              Create Campaign
            </button>
            <button
              onClick={handleJoinAsPromoter}
              className="bg-green-800 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-900 transition border border-green-600"
            >
              Join as Promoter
            </button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-800">Our Process</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 border border-gray-200 rounded-lg hover:shadow-lg transition">
              <div className="bg-green-700 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-center text-gray-800">Request Advert</h3>
              <p className="text-gray-600 text-center">Businesses create ad campaigns with their budget and requirements</p>
            </div>
            <div className="p-8 border border-gray-200 rounded-lg hover:shadow-lg transition">
              <div className="bg-green-700 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-center text-gray-800">People Post It</h3>
              <p className="text-gray-600 text-center">Promoters join campaigns and share ads on their social media platforms</p>
            </div>
            <div className="p-8 border border-gray-200 rounded-lg hover:shadow-lg transition">
              <div className="bg-green-700 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-center text-gray-800">Get Customers</h3>
              <p className="text-gray-600 text-center">Businesses reach real audiences and grow their customer base</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-800">Why Choose SpreadFast?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="flex gap-4">
              <div className="text-green-700 text-3xl flex-shrink-0">✓</div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800">Real People, Real Reach</h3>
                <p className="text-gray-600">Authentic promoters with genuine followers on their platforms</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-green-700 text-3xl flex-shrink-0">✓</div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800">Simple & Transparent</h3>
                <p className="text-gray-600">No hidden fees, no automation - just real marketing</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-green-700 text-3xl flex-shrink-0">✓</div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800">Multi-Platform Support</h3>
                <p className="text-gray-600">Campaign across Instagram, TikTok, X, and WhatsApp</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-green-700 text-3xl flex-shrink-0">✓</div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800">Quick & Easy Setup</h3>
                <p className="text-gray-600">Create campaigns or join in minutes, not hours</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How Promoters Earn Section */}
      <section className="bg-green-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-16 text-gray-800">How Promoters Earn</h2>
            <div className="bg-white border-2 border-green-700 rounded-lg p-8 shadow-md">
              <p className="text-gray-700 leading-relaxed mb-4">
                As a promoter on SpreadFast, your earnings are based entirely on your performance. The more your audience engages with a campaign, the more you earn — with no flat fees and no guesswork.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Every campaign has a pool of funds contributed by the brand. Your share of that pool is calculated based on how much of the total group engagement came from you.
              </p>
              <p className="text-gray-700 leading-relaxed">
                The more you drive interactions, the bigger your slice of the campaign pool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-green-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-8">Contact Us</h2>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="https://wa.me/+2349071023617"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-green-700 px-6 py-3 rounded-lg font-bold hover:bg-green-50 transition"
            >
              Contact on WhatsApp
            </a>
            <a
              href="https://t.me/spreadfast"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-white text-white px-6 py-3 rounded-lg font-bold hover:bg-green-800 transition"
            >
              Join Telegram
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-bold mb-4">SpreadFast</h3>
              <p className="text-gray-400">Get real customers through real people</p>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-4 uppercase">For Companies</h4>
              <ul className="text-gray-400 space-y-2">
                <li><button onClick={handleCreateCampaign} className="hover:text-white transition">Create Campaign</button></li>
                <li><a href="#" className="hover:text-white transition">View Promoters</a></li>
                <li><a href="#" className="hover:text-white transition">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-4 uppercase">For Promoters</h4>
              <ul className="text-gray-400 space-y-2">
                <li><button onClick={handleJoinAsPromoter} className="hover:text-white transition">Find Campaigns</button></li>
                <li><a href="#" className="hover:text-white transition">How to Earn</a></li>
                <li><a href="#" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-4 uppercase">Connect</h4>
              <ul className="text-gray-400 space-y-2">
                <li><a href="https://t.me/spreadfast" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Telegram</a></li>
                <li><a href="https://wa.me/+2349071023617" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">WhatsApp</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-8 text-center text-gray-400">
            <p>&copy; 2024 SpreadFast. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
