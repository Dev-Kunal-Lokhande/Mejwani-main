import { API_URL, SOCKET_URL } from './env';

export { API_URL, SOCKET_URL };

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@mejwani_captain_auth_token',
  USER_INFO: '@mejwani_captain_user_info',
  SELECTED_TABLE: '@mejwani_captain_selected_table',
};

export const ORDER_STATUS = {
  PENDING: 'pending',
  COOKING: 'cooking',
  SERVED: 'served',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const TABLE_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  BILLING: 'billing',
} as const;
