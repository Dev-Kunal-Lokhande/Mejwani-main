import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  // Check if admin is authenticated and has a valid JWT token
  const isAuthenticated = localStorage.getItem('mejwani_admin_token') === 'true' && 
                          !!localStorage.getItem('mejwani_admin_jwt');

  if (!isAuthenticated) {
    const hotelSlug = localStorage.getItem('mejwani_hotel_slug');
    if (hotelSlug) {
      return <Navigate to={`/${hotelSlug}/select-panel?showLogin=true`} replace />;
    }
    return <Navigate to="/select-panel?showLogin=true" replace />;
  }

  return children;
}
