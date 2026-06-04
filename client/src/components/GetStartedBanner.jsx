import React from 'react';
import { Link } from 'react-router-dom';

export default function GetStartedBanner() {
  const steps = [
    {
      number: 1,
      icon: '🔍',
      title: 'Browse Campaigns',
      description: 'Find a campaign that matches your social media platforms'
    },
    {
      number: 2,
      icon: '📲',
      title: 'Subscribe & Post',
      description: 'Join the campaign, create your content using the brand brief and assets provided'
    },
    {
      number: 3,
      icon: '💰',
      title: 'Submit Proof & Get Paid',
      description: 'Submit a screenshot or link of your post. Get paid once the business approves it'
    }
  ];

  return (
    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-8 mb-12 shadow-sm">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-green-800 mb-2">
          Welcome! Here's how to earn with SpreadFast 🚀
        </h2>
        <p className="text-gray-600">
          Get started in 3 simple steps and start earning money today
        </p>
      </div>

      {/* Steps Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col items-center text-center">
            {/* Step Number Circle */}
            <div className="relative mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center border-2 border-green-300 mb-3">
                <span className="text-3xl">{step.icon}</span>
              </div>
              <div className="absolute -top-2 -right-2 bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                {step.number}
              </div>
            </div>

            {/* Step Content */}
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Step {step.number} — {step.title}
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              {step.description}
            </p>

            {/* Connector Line (hidden on last step) */}
            {step.number < 3 && (
              <div className="hidden md:flex absolute left-1/2 transform translate-x-1/2 w-0.5 h-12 bg-green-300 mt-4" />
            )}
          </div>
        ))}
      </div>

      {/* Mobile Step Connector */}
      <div className="md:hidden flex justify-center mb-8">
        <div className="flex flex-col items-center">
          {[1, 2].map((i) => (
            <div key={i} className="h-8 w-0.5 bg-green-300" />
          ))}
        </div>
      </div>

      {/* CTA Button */}
      <div className="flex justify-center">
        <Link
          to="/available-campaigns"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition duration-200 transform hover:scale-105 inline-flex items-center gap-2 shadow-md"
        >
          Browse Available Campaigns →
        </Link>
      </div>
    </div>
  );
}
