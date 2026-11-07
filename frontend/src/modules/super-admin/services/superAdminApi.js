import { API_BASE } from '../../../shared/services/apiBase';

const tokenKey = 'mejwani_super_admin_jwt';

export const getSuperAdminToken = () => localStorage.getItem(tokenKey);

export const setSuperAdminSession = (token, user) => {
  localStorage.setItem('mejwani_super_admin_token', 'true');
  localStorage.setItem(tokenKey, token);
  localStorage.setItem('mejwani_super_admin_user', JSON.stringify(user));
};

export const clearSuperAdminSession = () => {
  localStorage.removeItem('mejwani_super_admin_token');
  localStorage.removeItem(tokenKey);
  localStorage.removeItem('mejwani_super_admin_user');
};

export const isSuperAdminAuthenticated = () =>
  localStorage.getItem('mejwani_super_admin_token') === 'true' && Boolean(getSuperAdminToken());

export const superAdminRequest = async (path, options = {}) => {
  const headers = {
    Authorization: `Bearer ${getSuperAdminToken()}`,
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}/super-admin${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSuperAdminSession();
    window.location.href = '/super-admin/login';
    throw new Error('Session expired or invalid. Please log in again.');
  }

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Super admin request failed');
  }

  return data.data ?? data;
};
