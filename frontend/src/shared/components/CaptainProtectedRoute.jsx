import React from 'react';
import { Navigate } from 'react-router-dom';

export default function CaptainProtectedRoute({ children }) {
  const isAuthenticated = !!localStorage.getItem('mejwani_captain_jwt');

  if (!isAuthenticated) {
    const hotelSlug = localStorage.getItem('mejwani_hotel_slug');
    if (hotelSlug) {
      return <Navigate to={`/${hotelSlug}/select-panel?showCaptainLogin=true`} replace />;
    }
    return <Navigate to="/select-panel?showCaptainLogin=true" replace />;
  }

  return children;
}
