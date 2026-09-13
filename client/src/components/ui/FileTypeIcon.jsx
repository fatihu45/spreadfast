import React from 'react';
import UiIcon from './UiIcon';
export default function FileTypeIcon({ type = '', ...props }) {
  const kind = type.includes('/') ? type.split('/')[0] : type;
  return <UiIcon name={kind === 'image' ? 'image' : kind === 'video' ? 'video' : kind === 'audio' ? 'music' : type === 'pdf' || type === 'application/pdf' ? 'file' : 'attachment'} {...props} />;
}
