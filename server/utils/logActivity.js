const ActivityLog = require('../models/ActivityLog');

const iconMap = {
  user_signup:         '👤',
  campaign_created:    '📢',
  submission_approved: '📋',
  submission_rejected: '❌',
  withdrawal_paid:     '💰',
  withdrawal_pending:  '⏳',
};

async function logActivity(type, description, metadata = {}) {
  try {
    await ActivityLog.create({
      type,
      description,
      icon: iconMap[type] || '🔔',
      metadata
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = logActivity;