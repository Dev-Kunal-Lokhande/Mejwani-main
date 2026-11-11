import React from 'react';
import { Navigate } from 'react-router-dom';

export default function CaptainProtectedRoute({ children }) {
  // Accept both captain JWT and admin JWT (HOTEL_ADMIN can also use captain panel)
  const isAuthenticated = !!(
    localStorage.getItem('mejwani_captain_jwt') ||
    localStorage.getItem('mejwani_admin_jwt')
  );

  if (!isAuthenticated) {
    const hotelSlug = localStorage.getItem('mejwani_hotel_slug');
    if (hotelSlug) {
      return <Navigate to={`/${hotelSlug}/select-panel?showCaptainLogin=true`} replace />;
    }
    return <Navigate to="/select-panel?showCaptainLogin=true" replace />;
  }

  return children;
}
