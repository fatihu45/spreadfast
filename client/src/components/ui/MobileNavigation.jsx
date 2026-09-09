import React from 'react';
import NavigationItems from './NavigationItems';
import { cx } from './utils';

export default function MobileNavigation({ items = [], actions, label = 'Mobile navigation', className }) {
  return (
    <nav className={cx('sf-mobile-navigation', className)} aria-label={label}>
      <NavigationItems items={items} />
      {actions && <div className="sf-mobile-navigation__actions">{actions}</div>}
    </nav>
  );
}
