import React from 'react';
import BrandMark from './BrandMark';
import NavigationItems from './NavigationItems';
import { cx } from './utils';

export default function Sidebar({ items = [], brand = <BrandMark />, footer, label = 'Main navigation', className }) {
  return (
    <aside className={cx('sf-sidebar', className)}>
      <div className="sf-sidebar__brand">{brand}</div>
      <nav aria-label={label}><NavigationItems items={items} /></nav>
      {footer && <div className="sf-sidebar__footer">{footer}</div>}
    </aside>
  );
}
