import React, { useState } from 'react';

export default function HowYouEarnCard() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-12">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-blue-50 border-2 border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition text-left"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-blue-800">
            💡 How You Earn
          </h3>
          <span className={`text-2xl text-blue-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
        {!isExpanded && (
          <p className="text-sm text-blue-600 mt-2">Tap to learn more</p>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="bg-white border-2 border-blue-200 border-t-0 rounded-b-lg p-8 space-y-8">
          {/* Overview Section */}
          <div>
            <h4 className="text-lg font-bold text-gray-800 mb-4">How It Works</h4>
            <div className="space-y-3 text-gray-700">
              <p className="flex gap-3">
                <span className="text-xl">📊</span>
                <span>Every campaign has a slot (fixed amount of promoters that can join)</span>
              </p>
              <p className="flex gap-3">
                <span className="text-xl">🎬</span>
                <span>You earn when you join a campaign, make a video and post on your social media, and then submit for approval</span>
              </p>
              <p className="flex gap-3">
                <span className="text-xl">💳</span>
                <span>You receive your earnings in your wallet once your submission is approved</span>
              </p>
            </div>
          </div>

          {/* Performance Section */}
          <div>
            <h4 className="text-lg font-bold text-gray-800 mb-4">Performance</h4>
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-400 p-4 rounded space-y-3">
              <p className="flex gap-3">
                <span className="text-xl">🔥</span>
                <span>
                  <strong>High engagement</strong> (likes, shares, comments) = High pay
                </span>
              </p>
              <p className="flex gap-3">
                <span className="text-xl">📈</span>
                <span>
                  <strong>The more your post spreads</strong>, the more you earn
                </span>
              </p>
              <p className="flex gap-3">
                <span className="text-xl">⭐</span>
                <span>
                  <strong>Top promoters</strong> get priority access to high-paying campaigns
                </span>
              </p>
            </div>
          </div>

          {/* Approval Process Section */}
          <div>
            <h4 className="text-lg font-bold text-gray-800 mb-4">Approval Process</h4>
            <div className="space-y-3 bg-purple-50 border-l-4 border-purple-400 p-4 rounded">
              <p className="flex gap-3">
                <span className="text-xl">⏳</span>
                <span>
                  <strong>Pending</strong> — Business is reviewing
                </span>
              </p>
              <p className="flex gap-3">
                <span className="text-xl">✅</span>
                <span>
                  <strong>Approved</strong> — Earnings added to your wallet
                </span>
              </p>
              <p className="flex gap-3">
                <span className="text-xl">❌</span>
                <span>
                  <strong>Rejected</strong> — See reason and resubmit
                </span>
              </p>
            </div>
          </div>

          {/* Withdrawal Section */}
          <div>
            <h4 className="text-lg font-bold text-gray-800 mb-4">Withdrawal</h4>
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
              <p className="flex gap-3">
                <span className="text-xl">🏦</span>
                <span>
                  Once approved, earnings are available in your wallet. <strong>Withdraw anytime</strong> to your bank account.
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
