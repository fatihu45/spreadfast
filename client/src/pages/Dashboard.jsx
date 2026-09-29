import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const adminEmail = process.env.REACT_APP_ADMIN_EMAIL || 'admin@spreadfast.com';
  const target = user?.email === adminEmail ? '/admin-portal'
    : user?.role === 'company' ? '/company' : '/promoter-dashboard';
  return <Navigate to={target} replace />;
}
