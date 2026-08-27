import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  MegaphoneIcon, ShareIcon, GrowthIcon,
  PeopleIcon, ShieldCheckIcon, GlobeIcon, BoltIcon,
  PoolIcon, ShareChartIcon, BankIcon,
  LockIcon, PinIcon, VerifiedIcon,
} from './Icons';

export default function LandingPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

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

  const faqs = [
    {
      q: 'How is engagement verified?',
      a: 'Every promoter submission is tracked and checked against the campaign requirements before it counts toward payout. No automated bots or fake engagement is counted — only real, verifiable interactions.',
    },
    {
      q: "What if a promoter doesn't deliver?",
      a: "Businesses only pay for verified results. If a promoter's submission doesn't meet the campaign requirements, it simply doesn't count toward their share of the payout — there's no upfront risk to the business.",
    },
    {
      q: 'How much does it cost to run a campaign?',
      a: 'Campaign slots are ₦10,000 per 2 promoter slots, plus a 5% platform fee on campaign creation. There are no hidden charges beyond that.',
    },
    {
      q: 'How do promoters get paid?',
      a: 'Promoters earn a share of the campaign pool based on their percentage of total group engagement. Withdrawals are processed through Paystack, with a minimum withdrawal of ₦1,000.',
    },
    {
      q: 'What platforms can I promote on?',
      a: 'Instagram, TikTok, X (Twitter), and WhatsApp are all supported for campaign promotion.',
    },
  ];

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
          <p className="text-xl mb-6 text-green-50">
            SpreadFast helps Nigerian businesses get viral promotion from real people, while promoters earn money by sharing campaigns with their followers. No bots, no automation - just real marketing that works.
          </p>
          <p className="text-base mb-10 text-green-100">
            Pay only for verified results. No upfront risk.
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

      {/* Trust / Guarantee Strip */}
      <section className="bg-green-800 text-white py-6">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center">
            <VerifiedIcon />
            <p className="font-bold text-lg mt-2">Pay for results only</p>
            <p className="text-green-100 text-sm">No payout until engagement is verified</p>
          </div>
          <div className="flex flex-col items-center">
            <LockIcon />
            <p className="font-bold text-lg mt-2">Secure payments</p>
            <p className="text-green-100 text-sm">Powered by Paystack, in Naira</p>
          </div>
          <div className="flex flex-col items-center">
            <PinIcon />
            <p className="font-bold text-lg mt-2">Built for Nigeria</p>
            <p className="text-green-100 text-sm">Local promoters, local businesses</p>
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
                <MegaphoneIcon size={30} color="#ffffff" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-center text-gray-800">Request Advert</h3>
              <p className="text-gray-600 text-center">Businesses create ad campaigns with their budget and requirements</p>
            </div>
            <div className="p-8 border border-gray-200 rounded-lg hover:shadow-lg transition">
              <div className="bg-green-700 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <ShareIcon size={30} color="#ffffff" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-center text-gray-800">People Post It</h3>
              <p className="text-gray-600 text-center">Promoters join campaigns and share ads on their social media platforms</p>
            </div>
            <div className="p-8 border border-gray-200 rounded-lg hover:shadow-lg transition">
              <div className="bg-green-700 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <GrowthIcon size={30} color="#ffffff" />
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
              <div className="flex-shrink-0"><PeopleIcon /></div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800">Real People, Real Reach</h3>
                <p className="text-gray-600">Authentic promoters with genuine followers on their platforms</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0"><ShieldCheckIcon /></div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800">Simple & Transparent</h3>
                <p className="text-gray-600">No hidden fees, no automation - just real marketing</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0"><GlobeIcon /></div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800">Multi-Platform Support</h3>
                <p className="text-gray-600">Campaign across Instagram, TikTok, X, and WhatsApp</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0"><BoltIcon /></div>
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
            <h2 className="text-4xl font-bold text-center mb-4 text-gray-800">How Promoters Earn</h2>
            <p className="text-center text-gray-600 mb-16">Your payout is a direct share of the campaign pool - the more you drive, the more you earn</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white border border-green-200 rounded-lg p-6 text-center shadow-sm">
                <div className="flex justify-center mb-2"><PoolIcon /></div>
                <h3 className="font-bold text-gray-800 mb-1">Campaign Pool</h3>
                <p className="text-sm text-gray-600">A brand funds a pool for each campaign</p>
              </div>
              <div className="bg-white border border-green-200 rounded-lg p-6 text-center shadow-sm">
                <div className="flex justify-center mb-2"><ShareChartIcon /></div>
                <h3 className="font-bold text-gray-800 mb-1">Your Share</h3>
                <p className="text-sm text-gray-600">Calculated from your % of total group engagement</p>
              </div>
              <div className="bg-white border border-green-200 rounded-lg p-6 text-center shadow-sm">
                <div className="flex justify-center mb-2"><BankIcon /></div>
                <h3 className="font-bold text-gray-800 mb-1">Get Paid</h3>
                <p className="text-sm text-gray-600">Withdraw via Paystack, min ₦1,000</p>
              </div>
            </div>

            <div className="bg-white border-2 border-green-700 rounded-lg p-8 shadow-md">
              <p className="text-gray-700 leading-relaxed">
                Every campaign has a pool of funds contributed by the brand. Your share of that pool is calculated based on how much of the total group engagement came from you - no flat fees, no guesswork. The more interactions you drive, the bigger your slice of the pool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 text-gray-800">Simple, Transparent Pricing</h2>
          <p className="text-center text-gray-600 mb-16">No hidden fees. You only pay for what you use.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="border-2 border-green-700 rounded-lg p-8">
              <h3 className="text-xl font-bold mb-4 text-gray-800">For Businesses</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex gap-2"><span className="text-green-700 font-bold">•</span> ₦10,000 per 2 promoter slots</li>
                <li className="flex gap-2"><span className="text-green-700 font-bold">•</span> 5% platform fee on campaign creation</li>
                <li className="flex gap-2"><span className="text-green-700 font-bold">•</span> Pay only for verified engagement</li>
              </ul>
              <button
                onClick={handleCreateCampaign}
                className="mt-6 w-full bg-green-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-800 transition"
              >
                Create a Campaign
              </button>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-8">
              <h3 className="text-xl font-bold mb-4 text-gray-800">For Promoters</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex gap-2"><span className="text-green-700 font-bold">•</span> Earn a share of every campaign pool</li>
                <li className="flex gap-2"><span className="text-green-700 font-bold">•</span> 5% fee on withdrawals</li>
                <li className="flex gap-2"><span className="text-green-700 font-bold">•</span> Minimum withdrawal ₦1,000</li>
              </ul>
              <button
                onClick={handleJoinAsPromoter}
                className="mt-6 w-full bg-gray-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-900 transition"
              >
                Join as Promoter
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-800">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((item, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left px-6 py-4 flex justify-between items-center font-semibold text-gray-800 hover:bg-gray-50 transition"
                >
                  {item.q}
                  <span className="text-green-700 text-xl flex-shrink-0 ml-4">
                    {openFaq === idx ? '−' : '+'}
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-4 text-gray-600 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
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
              href="https://chat.whatsapp.com/LQey4iZk9Hn2RSEg8DcLvr?mode=gi_t"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-white text-white px-6 py-3 rounded-lg font-bold hover:bg-green-800 transition"
            >
              Join our whatsapp creator community
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
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-4 uppercase">For Promoters</h4>
              <ul className="text-gray-400 space-y-2">
                <li><button onClick={handleJoinAsPromoter} className="hover:text-white transition">Find Campaigns</button></li>
                <li><a href="#" className="hover:text-white transition">How to Earn</a></li>
                <li><a href="#faq" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-4 uppercase">Connect</h4>
              <ul className="text-gray-400 space-y-2">
                <li><a href="https://chat.whatsapp.com/LQey4iZk9Hn2RSEg8DcLvr?mode=gi_t" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">whatsapp community</a></li>
                <li><a href="https://wa.me/+2349071023617" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">WhatsApp support</a></li>
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
