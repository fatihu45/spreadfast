import React from 'react';
import { cx } from './utils';

export default function PageHeader({ title, description, eyebrow, actions, children,
  as: Heading = 'h1', className }) {
  return (
    <div className={cx('sf-page-header', className)}>
      <div className="sf-page-header__copy">
        {eyebrow && <p className="sf-caption sf-muted">{eyebrow}</p>}
        <Heading className="sf-title">{title}</Heading>
        {description && <p className="sf-muted sf-page-header__description">{description}</p>}
        {children}
      </div>
      {actions && <div className="sf-page-header__actions">{actions}</div>}
    </div>
  );
}
