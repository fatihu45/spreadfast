import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-green-700 text-white py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">Get Real Customers Through Real People</h1>
          <p className="text-xl mb-10 text-green-50">
            SpreadFast connects businesses with promoters to amplify their reach through authentic social media marketing
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/company" className="bg-white text-primary px-8 py-3 rounded-lg font-bold hover:bg-green-50 transition">
              Create Campaign
            </Link>
            <Link to="/signup" className="bg-green-800 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-900 transition">
              Join as Promoter
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="bg-primary text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">Request Advert</h3>
              <p className="text-gray-600">Businesses create ad campaigns with their budget and requirements</p>
            </div>
            <div className="card text-center">
              <div className="bg-primary text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">People Post It</h3>
              <p className="text-gray-600">Promoters join campaigns and share ads on their social media platforms</p>
            </div>
            <div className="card text-center">
              <div className="bg-primary text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">Get Customers</h3>
              <p className="text-gray-600">Businesses reach real audiences and grow their customer base</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">Why Choose SpreadFast?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="flex gap-4">
              <div className="text-primary text-3xl">✓</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Real People, Real Reach</h3>
                <p className="text-gray-600">Authentic promoters with genuine followers on their platforms</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-primary text-3xl">✓</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Simple & Transparent</h3>
                <p className="text-gray-600">No hidden fees, no automation - just real marketing</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-primary text-3xl">✓</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Multi-Platform Support</h3>
                <p className="text-gray-600">Campaign across Instagram, TikTok, X, and WhatsApp</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-primary text-3xl">✓</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Quick & Easy Setup</h3>
                <p className="text-gray-600">Create campaigns or join in minutes, not hours</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-8">Ready to Get Started?</h2>
          <div className="flex gap-4 justify-center flex-wrap">
            <a href="https://wa.me/+2349071023617" className="bg-white text-primary px-6 py-3 rounded-lg font-bold hover:bg-green-50 transition">
              Contact on WhatsApp
            </a>
            <a href="https://t.me/spreadfast" className="border-2 border-white text-white px-6 py-3 rounded-lg font-bold hover:bg-green-900 transition">
              Join Telegram
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
