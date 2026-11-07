import React from 'react';
import { Navigate } from 'react-router-dom';
import { isSuperAdminAuthenticated } from '../services/superAdminApi';

export default function SuperAdminProtectedRoute({ children }) {
  if (!isSuperAdminAuthenticated()) {
    return <Navigate to="/super-admin/login" replace />;
  }

  return children;
}
