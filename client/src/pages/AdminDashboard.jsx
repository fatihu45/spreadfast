import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AdminQuickAdsAnalytics from '../components/AdminQuickAdsAnalytics';
import { AppShell, PageHeader, UserAvatar } from '../components/ui';
import NavigationItems from '../components/ui/NavigationItems';
import UiIcon from '../components/ui/UiIcon';
import '../components/DashboardShell.css';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const handleExitAdmin = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    ['overview', 'Overview', 'home'],
    ['quick-ads', 'Payments & Usage', 'video'],
  ].map(([id, label, icon]) => ({ id, label, icon: <UiIcon name={icon} />, active: activeTab === id, onClick: () => setActiveTab(id) }));
  const footerItems = [
    { id: 'exit', label: 'Exit Admin', onClick: handleExitAdmin, icon: <UiIcon name="logout" /> },
  ];
  const titles = {
    overview: ["Business overview", "Customers, credit sales and AI generation health."],
    'quick-ads': ['Payments & Usage', 'Shared credits across Quick Ad, Fashion Studio and AI Commercial.'],
  };
  return <AppShell className="sf-dashboard-shell sf-admin" navigation={navigation}
    brand={<Link to="/" className="sf-dashboard-logo" aria-label="SpreadFast home"><img src="/spreadfast-logo.png" width="2172" height="724" alt="SpreadFast" /></Link>}
    sidebarFooter={<NavigationItems items={footerItems} />}
    header={<>
      <div className="sf-dashboard-account"><span className="sf-dashboard-account__copy"><strong>{user?.name || 'Admin'}</strong><span>Administrator</span></span><UserAvatar name={user?.name || 'Admin'} /></div>
      <details className="sf-dashboard-more"><summary aria-label="Admin actions"><UiIcon name="more" /></summary><div className="sf-dashboard-more__menu"><NavigationItems items={footerItems} /></div></details>
    </>}>
    <PageHeader title={<>{titles[activeTab][0]}{activeTab === 'overview' && <UiIcon name="sun" />}</>} description={titles[activeTab][1]} />
    <AdminQuickAdsAnalytics details={activeTab === 'quick-ads'} />
  </AppShell>;
}
