import React, { useId } from 'react';
import Sidebar from './Sidebar';
import MobileNavigation from './MobileNavigation';
import BrandMark from './BrandMark';
import { cx } from './utils';

export default function AppShell({ navigation = [], brand = <BrandMark />, sidebarFooter,
  mobileActions, header, mainId, children, className }) {
  const generatedId = useId();
  const contentId = mainId || `sf-main-${generatedId}`;
  return (
    <div className={cx('sf-page sf-app-shell', className)}>
      <a className="sf-skip-link" href={`#${contentId}`}>Skip to content</a>
      <Sidebar items={navigation} brand={brand} footer={sidebarFooter} />
      <div className="sf-app-shell__body">
        <header className="sf-app-shell__header">
          <div className="sf-app-shell__mobile-brand">{brand}</div>
          <div className="sf-app-shell__header-content">{header}</div>
        </header>
        <main id={contentId} tabIndex={-1} className="sf-app-shell__main">{children}</main>
      </div>
      <MobileNavigation items={navigation} actions={mobileActions} />
    </div>
  );
}
