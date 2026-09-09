import React from 'react';
import { Badge } from './primitives';
import UiIcon from './UiIcon';
import { cx } from './utils';

const labels = { tiktok: 'TikTok', instagram: 'Instagram', twitter: 'X (Twitter)',
  x: 'X (Twitter)', facebook: 'Facebook', youtube: 'YouTube', whatsapp: 'WhatsApp' };

export default function PlatformBadge({ platform, icon, className }) {
  const key = typeof platform === 'string' ? platform.trim().toLowerCase() : '';
  return (
    <Badge className={cx('sf-platform-badge', className)}>
      <span aria-hidden="true">{icon || <UiIcon name="globe" />}</span>
      {labels[key] || platform || 'Platform'}
    </Badge>
  );
}
