import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthContext } from './index';
import { API_URL, SOCKET_URL } from '../constants';
import { io } from 'socket.io-client';
import { Vibration, NativeModules } from 'react-native';

export interface Section {
  id: number;
  section_name: string;
}

export interface Table {
  id: number;
  table_number: string;
  table_name: string;
  seating_capacity: number;
  section_name: string;
  status: string;
  occupied_at: string | null;
}

export interface Order {
  id: number;
  table_id: number;
  kot_number: string;
  status: string;
  grand_total: string;
  items: any[];
  created_at: string;
  captain_name?: string;
  table_name?: string;
  table_number?: string;
  section_name?: string;
  subtotal?: string | number;
  cgst?: string | number;
  sgst?: string | number;
}

export interface CaptainRequest {
  table_id: number;
  status: string;
  request_type: string;
}

export interface MenuItem {
  id: number;
  name: string;
  marathiName: string | null;
  price: string;
  pricing_type: 'SINGLE' | 'HALF_FULL';
  half_price: string | null;
  full_price: string | null;
  category: string;
  type: 'VEG' | 'NON_VEG';
  isAvailable: boolean;
  code: string;
}

export interface Category {
  id: number;
  name: string;
}

interface DataContextType {
  sections: Section[];
  tables: Table[];
  orders: Order[];
  captainRequests: CaptainRequest[];
  menuItems: MenuItem[];
  categories: Category[];
  isDashboardLoading: boolean;
  isMenuLoading: boolean;
  errorMessage: string | null;
  fetchDashboardData: (showIndicator?: boolean) => Promise<void>;
  fetchDashboardDataFast: () => Promise<void>;
  fetchMenuData: () => Promise<void>;
  clearCache: () => Promise<void>;
  isMuted: boolean;
  toggleMute: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, captain } = useAuthContext();
  const hotelId = captain?.hotel_id || 0;

  const [sections, setSections] = useState<Section[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [captainRequests, setCaptainRequests] = useState<CaptainRequest[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const loadMuteState = async () => {
      try {
        const val = await AsyncStorage.getItem('mejwani_captain_muted');
        if (val !== null) {
          setIsMuted(val === 'true');
        }
      } catch (e) {
        console.warn('Failed to load mute state:', e);
      }
    };
    loadMuteState();
  }, []);

  const toggleMute = async () => {
    try {
      const nextMute = !isMuted;
      setIsMuted(nextMute);
      await AsyncStorage.setItem('mejwani_captain_muted', String(nextMute));
    } catch (e) {
      console.warn('Failed to save mute state:', e);
    }
  };

  // Clear cache helper
  const clearCache = useCallback(async () => {
    setSections([]);
    setTables([]);
    setOrders([]);
    setCaptainRequests([]);
    setMenuItems([]);
    setCategories([]);
    setIsDashboardLoading(true);
    setIsMenuLoading(true);
    setErrorMessage(null);
    try {
      await Promise.all([
        AsyncStorage.removeItem('mejwani_sections'),
        AsyncStorage.removeItem('mejwani_tables'),
        AsyncStorage.removeItem('mejwani_orders'),
        AsyncStorage.removeItem('mejwani_requests'),
        AsyncStorage.removeItem('mejwani_categories'),
        AsyncStorage.removeItem('mejwani_menu'),
      ]);
    } catch (err) {
      console.error('Failed to clear AsyncStorage cache:', err);
    }
  }, []);

  // Dashboard fetcher (silently unless no cached data exists)
  const fetchDashboardData = useCallback(async (showIndicator = false) => {
    if (!token || !hotelId) return;
    if (showIndicator) setIsDashboardLoading(true);
    setErrorMessage(null);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const [sectionsRes, tablesRes, ordersRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/sections?hotelId=${hotelId}`, { headers }),
        fetch(`${API_URL}/tables?hotelId=${hotelId}`, { headers }),
        fetch(`${API_URL}/orders?hotelId=${hotelId}`, { headers }),
        fetch(`${API_URL}/customer/active-captain-requests?hotelId=${hotelId}`, { headers }),
      ]);

      const sectionsJson = await sectionsRes.json();
      const tablesJson = await tablesRes.json();
      const ordersJson = await ordersRes.json();
      const requestsJson = await requestsRes.json();

      if (sectionsJson.success && tablesJson.success) {
        const secData = sectionsJson.data || [];
        const tabData = tablesJson.data || [];
        const ordData = ordersJson.data || [];
        const reqData = requestsJson.data || [];

        setSections(secData);
        setTables(tabData);
        setOrders(ordData);
        setCaptainRequests(reqData);

        await AsyncStorage.setItem('mejwani_sections', JSON.stringify(secData));
        await AsyncStorage.setItem('mejwani_tables', JSON.stringify(tabData));
        await AsyncStorage.setItem('mejwani_orders', JSON.stringify(ordData));
        await AsyncStorage.setItem('mejwani_requests', JSON.stringify(reqData));
      } else {
        setErrorMessage('Failed to load layout from server.');
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setErrorMessage('Server connection offline. Retrying...');
    } finally {
      setIsDashboardLoading(false);
    }
  }, [token, hotelId]);

  const fetchDashboardDataFast = useCallback(async () => {
    if (!token || !hotelId) return;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const [tablesRes, ordersRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/tables?hotelId=${hotelId}`, { headers }),
        fetch(`${API_URL}/orders?hotelId=${hotelId}`, { headers }),
        fetch(`${API_URL}/customer/active-captain-requests?hotelId=${hotelId}`, { headers }),
      ]);

      const tablesJson = await tablesRes.json();
      const ordersJson = await ordersRes.json();
      const requestsJson = await requestsRes.json();

      if (tablesJson.success) {
        const tabData = tablesJson.data || [];
        const ordData = ordersJson.data || [];
        const reqData = requestsJson.data || [];

        setTables(tabData);
        setOrders(ordData);
        setCaptainRequests(reqData);

        await AsyncStorage.setItem('mejwani_tables', JSON.stringify(tabData));
        await AsyncStorage.setItem('mejwani_orders', JSON.stringify(ordData));
        await AsyncStorage.setItem('mejwani_requests', JSON.stringify(reqData));
      }
    } catch (err) {
      console.error('Error fetching fast dashboard data:', err);
    }
  }, [token, hotelId]);

  // Menu fetcher (silently if already cached)
  const fetchMenuData = useCallback(async () => {
    if (!token || !hotelId) return;
    setErrorMessage(null);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const [categoriesRes, menuRes] = await Promise.all([
        fetch(`${API_URL}/menu-categories?hotelId=${hotelId}`, { headers }),
        fetch(`${API_URL}/menu?hotelId=${hotelId}`, { headers }),
      ]);

      const categoriesJson = await categoriesRes.json();
      const menuJson = await menuRes.json();

      if (categoriesJson.success && menuJson.success) {
        const catData = categoriesJson.data || [];
        const availableItems = (menuJson.data || []).filter((item: MenuItem) => item.isAvailable !== false);

        setCategories(catData);
        setMenuItems(availableItems);

        await AsyncStorage.setItem('mejwani_categories', JSON.stringify(catData));
        await AsyncStorage.setItem('mejwani_menu', JSON.stringify(availableItems));
      } else {
        setErrorMessage('Failed to load menu from server.');
      }
    } catch (err) {
      console.error('Error fetching menu details:', err);
      setErrorMessage('Offline mode. Please check connection.');
    } finally {
      setIsMenuLoading(false);
    }
  }, [token, hotelId]);

  // Load from AsyncStorage on mount
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cachedSections = await AsyncStorage.getItem('mejwani_sections');
        const cachedTables = await AsyncStorage.getItem('mejwani_tables');
        const cachedOrders = await AsyncStorage.getItem('mejwani_orders');
        const cachedRequests = await AsyncStorage.getItem('mejwani_requests');
        const cachedMenuItems = await AsyncStorage.getItem('mejwani_menu');
        const cachedCategories = await AsyncStorage.getItem('mejwani_categories');

        if (cachedSections) setSections(JSON.parse(cachedSections));
        if (cachedTables) setTables(JSON.parse(cachedTables));
        if (cachedOrders) setOrders(JSON.parse(cachedOrders));
        if (cachedRequests) setCaptainRequests(JSON.parse(cachedRequests));
        if (cachedMenuItems) setMenuItems(JSON.parse(cachedMenuItems));
        if (cachedCategories) setCategories(JSON.parse(cachedCategories));

        if (cachedSections && cachedTables) {
          setIsDashboardLoading(false);
        }
        if (cachedMenuItems && cachedCategories) {
          setIsMenuLoading(false);
        }
      } catch (err) {
        console.error('Failed to load data cache:', err);
      }
    };
    loadCache();
  }, []);

  // Fetch initial/silent updates when token changes
  useEffect(() => {
    if (!token) {
      clearCache();
    } else {
      fetchDashboardData(sections.length === 0);
      fetchMenuData();
    }
  }, [token, fetchDashboardData, fetchMenuData, clearCache]);

  const getNotifee = () => {
    try {
      const hasNative = !!(
        NativeModules.NotifeeApiModule ||
        NativeModules.Notifee ||
        NativeModules.NotifeeNativeModule
      );
      if (!hasNative) {
        console.log('[DataContext] Notifee native module is not registered in NativeModules');
        return null;
      }
      return require('@notifee/react-native');
    } catch (e) {
      console.warn('[DataContext] Notifee native module is not available in this build:', e);
      return null;
    }
  };

  const displayLocalNotification = async (title: string, body: string) => {
    if (isMutedRef.current) return;
    try {
      const notifeeLib = getNotifee();
      if (!notifeeLib) {
        console.log('[DataContext] Notifee not available, skipping local notification:', title, body);
        return;
      }

      const notifeeInstance = notifeeLib.default;
      const AndroidImportance = notifeeLib.AndroidImportance;

      await notifeeInstance.requestPermission();
      const channelId = await notifeeInstance.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      });

      await notifeeInstance.displayNotification({
        title,
        body,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
        },
      });
    } catch (err) {
      console.error('[DataContext] Local notification error:', err);
    }
  };

  // Socket listener for real-time updates
  useEffect(() => {
    let socket: any = null;
    if (token && hotelId) {
      socket = io(SOCKET_URL, {
        transports: ['polling', 'websocket'],
      });

      socket.on('connect', () => {
        console.log('[SOCKET] Connected to server in DataContext');
        socket.emit('join-hotel-room', `${hotelId}:captain`);
      });

      const handleUpdate = () => {
        console.log('[SOCKET] Update received in DataContext, refreshing data');
        fetchDashboardDataFast();
      };

      const handleCustomerRequest = (payload: any) => {
        console.log('[SOCKET] Customer request received:', payload);
        fetchDashboardDataFast();

        if (payload) {
          const tableLabel = payload.tableName || String(payload.tableId || 'N/A');
          const requestLabel = payload.requestType || 'Service';

          let title = `Table ${tableLabel} Request`;
          let body = `Needs assistance: ${requestLabel}`;

          if (requestLabel === 'CALL_CAPTAIN' || requestLabel === 'Call Captain' || requestLabel === 'Captain Requested') {
            title = `Captain Called 🔔`;
            body = `Table ${tableLabel} is calling a captain.`;
          } else if (requestLabel === 'BILL') {
            title = `Bill Requested 💵`;
            body = `Table ${tableLabel} needs their bill.`;
          } else if (requestLabel === 'WATER') {
            title = `Water Requested 💧`;
            body = `Table ${tableLabel} needs water.`;
          } else if (requestLabel === 'TISSUE') {
            title = `Tissue Requested 🧻`;
            body = `Table ${tableLabel} needs tissues.`;
          } else if (requestLabel === 'CLEAN_TABLE') {
            title = `Clean Table 🧹`;
            body = `Table ${tableLabel} needs cleaning.`;
          }

          displayLocalNotification(title, body);
          if (!isMutedRef.current) {
            Vibration.vibrate([0, 500, 200, 500]);
          }
        }
      };

      const handleNewOrder = (payload: any) => {
        console.log('[SOCKET] New order received:', payload);
        fetchDashboardDataFast();

        if (payload) {
          const tableLabel = payload.tableCode || payload.tableName || 'N/A';
          const itemsText = payload.items?.map((item: any) => `${item.qty} ${item.name}`).join(', ') || '';

          displayLocalNotification(
            `New QR Order Received 🛒`,
            `Table ${tableLabel} ordered: ${itemsText}`
          );
          if (!isMutedRef.current) {
            Vibration.vibrate([0, 500, 200, 500]);
          }
        }
      };

      socket.on('table-updated', handleUpdate);
      socket.on('order-updated', handleUpdate);
      socket.on('customer_request', handleCustomerRequest);
      socket.on('captain_only_request', handleCustomerRequest);
      socket.on('new-order', handleNewOrder);
      socket.on('table-released', handleUpdate);
      socket.on('order-cancelled', handleUpdate);

      socket.on('disconnect', () => {
        console.log('[SOCKET] Disconnected in DataContext');
      });
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [token, hotelId, fetchDashboardDataFast]);

  return (
    <DataContext.Provider
      value={{
        sections,
        tables,
        orders,
        captainRequests,
        menuItems,
        categories,
        isDashboardLoading,
        isMenuLoading,
        errorMessage,
        fetchDashboardData,
        fetchDashboardDataFast,
        fetchMenuData,
        clearCache,
        isMuted,
        toggleMute,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
