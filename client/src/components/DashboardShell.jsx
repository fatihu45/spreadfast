import React, { useContext, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { AppShell, UserAvatar, Button } from './ui';
import NavigationItems from './ui/NavigationItems';
import UiIcon from './ui/UiIcon';
import './DashboardShell.css';

export default function DashboardShell({ children }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useRef(null);
  const isBusiness = user?.role === 'company';
  const openProfile = () => profile.current?.showModal();
  const handleLogout = () => { logout(); navigate('/'); };
  const item = (id, label, to, icon, active) => ({ id, label, to, icon: <UiIcon name={icon} />, active });
  const navigation = isBusiness ? [
    item('overview', 'Overview', '/company', 'home', location.pathname === '/company' && !location.hash),
    item('campaigns', 'Campaigns', '/company#company-campaigns', 'campaign', location.pathname === '/company' && location.hash === '#company-campaigns'),
    item('create', 'Create Campaign', '/company#create-campaign', 'plus', location.pathname === '/company' && location.hash === '#create-campaign'),
  ] : [
    item('dashboard', 'Dashboard', '/promoter-dashboard', 'home', ['/dashboard', '/promoter-dashboard'].includes(location.pathname)),
    item('campaigns', 'Campaigns', '/available-campaigns', 'campaign', ['/available-campaigns', '/submit-proof'].includes(location.pathname)),
  ];
  if (!isBusiness) navigation.push(item('wallet', 'Wallet', '/wallet', 'wallet'));
  navigation.unshift(item('quick-ads', 'Quick Ads', isBusiness ? '/company/quick-ads' : '/promoter/quick-ads', 'video',
    ['/company/quick-ads', '/promoter/quick-ads', '/quick-ad', '/quickads', '/quickads/credits'].includes(location.pathname.replace(/\/+$/, ''))));
  navigation.push({ id: 'profile', label: 'Profile', onClick: openProfile, icon: <UiIcon name="user" /> });
  const footerItems = [
    { id: 'settings', label: 'Settings', disabled: true, title: 'Settings are not available yet', icon: <UiIcon name="settings" /> },
    { id: 'logout', label: 'Log out', onClick: handleLogout, icon: <UiIcon name="logout" /> },
  ];

  useEffect(() => {
    // Section links stay within the existing company route.
    const target = ['#company-campaigns', '#create-campaign'].includes(location.hash)
      ? document.getElementById(location.hash.slice(1)) : null;
    if (target) { target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); }
    else if (location.pathname === '/company' && !location.hash) window.scrollTo({ top: 0 });
  }, [location.pathname, location.hash, location.key]);

  const brand = <Link to="/" aria-label="SpreadFast home" className="sf-dashboard-logo">
    <img src="/spreadfast-logo.png" alt="SpreadFast" width="2172" height="724" />
  </Link>;

  return <AppShell className="sf-dashboard-shell" brand={brand} navigation={navigation}
    sidebarFooter={<NavigationItems items={footerItems} />}
    header={<>
      <button type="button" className="sf-dashboard-account" onClick={openProfile} aria-label="View your profile">
        <span className="sf-dashboard-account__copy"><strong>{user?.name || 'Your account'}</strong><span>{isBusiness ? 'Business' : 'Creator'}</span></span>
        <UserAvatar name={user?.name} />
      </button>
      <details className="sf-dashboard-more">
        <summary aria-label="Account actions"><UiIcon name="more" /></summary>
        <div className="sf-dashboard-more__menu"><NavigationItems items={footerItems} /></div>
      </details>
    </>}>
    <div className="sf-dashboard-content">{children}</div>
    <dialog ref={profile} className="sf-dashboard-profile" aria-labelledby="sf-profile-title">
      <div className="sf-dashboard-profile__heading"><h2 id="sf-profile-title">Your profile</h2>
        <Button variant="ghost" onClick={() => profile.current.close()} aria-label="Close profile"><UiIcon name="close" /></Button>
      </div>
      <UserAvatar name={user?.name} size="lg" />
      <dl><dt>Name</dt><dd>{user?.name || 'Not provided'}</dd><dt>Email</dt><dd>{user?.email || 'Not provided'}</dd><dt>Account type</dt><dd>{isBusiness ? 'Business' : 'Creator'}</dd></dl>
    </dialog>
  </AppShell>;
}
