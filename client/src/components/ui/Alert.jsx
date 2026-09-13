import React from 'react';
import UiIcon from './UiIcon';
import { cx } from './utils';
export default function Alert({ tone = 'info', children, className, ...props }) {
  return <div className={cx('sf-alert', 'sf-alert--' + tone, className)} role={tone === 'error' ? 'alert' : 'status'} {...props}>
    <UiIcon name={{ error: 'alert', warning: 'alert', success: 'check', info: 'info' }[tone] || 'info'} />
    <div className="sf-alert__content">{children}</div>
  </div>;
}
