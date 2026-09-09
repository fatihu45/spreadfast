import React, { useState } from 'react';
import UiIcon from './UiIcon';
import { cx } from './utils';

export default function UserAvatar({ name = '', src, size = 'md', className }) {
  const [failedImage, setFailedImage] = useState(null);
  const displayName = typeof name === 'string' ? name.trim() : '';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
  return (
    <span className={cx('sf-user-avatar', `sf-user-avatar--${size}`, className)} role="img" aria-label={displayName || 'User'}>
      {src && failedImage !== src
        ? <img src={src} alt="" onError={() => setFailedImage(src)} />
        : <span aria-hidden="true">{initials || <UiIcon name="user" />}</span>}
    </span>
  );
}
