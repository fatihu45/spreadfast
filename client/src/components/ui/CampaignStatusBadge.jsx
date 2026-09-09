import React from 'react';
import { Badge } from './primitives';

const tones = { active: 'success', paused: 'warning', pending: 'warning', approved: 'success',
  rejected: 'danger', closed: 'neutral', completed: 'neutral', draft: 'neutral' };

export default function CampaignStatusBadge({ status, label, ...props }) {
  const key = typeof status === 'string' ? status.trim().toLowerCase() : '';
  const text = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unknown';
  return <Badge {...props} tone={tones[key] || 'neutral'}>{label ?? text}</Badge>;
}
