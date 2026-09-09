import React from 'react';
import UiIcon from './UiIcon';
import { cx } from './utils';

export default function EmptyState({ title, description, icon = <UiIcon name="campaign" />,
  action, as: Heading = 'h2', className }) {
  return (
    <div className={cx('sf-empty-state', className)}>
      {icon && <div className="sf-empty-state__icon" aria-hidden="true">{icon}</div>}
      <Heading className="sf-heading">{title}</Heading>
      {description && <p className="sf-muted">{description}</p>}
      {action && <div className="sf-card-actions">{action}</div>}
    </div>
  );
}
