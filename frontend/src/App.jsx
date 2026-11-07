import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './shared/context/ThemeContext';
import { NotificationProvider } from './shared/context/NotificationContext';
import axios from 'axios';
import { API_BASE, authorizedFetch } from './shared/services/apiBase';
import { cacheSystemSettings } from './shared/services/systemSettings';
import AdminOverview from './modules/admin/pages/Overview';
import OrdersPage from './modules/admin/pages/Orders';
import TablesPage from './modules/admin/pages/Tables';
import StaffPage from './modules/admin/pages/Staff';
import AdminKitchen from './modules/admin/pages/Kitchen';
import MessPage from './modules/admin/pages/Mess';
// import NotificationsPage from './modules/admin/pages/Notifications';
import SettingsPage from './modules/admin/pages/Settings';
import HotelMenu from './modules/admin/pages/HotelMenu';
import ManageCategories from './modules/admin/pages/ManageCategories';
import ParcelManagement from './modules/admin/pages/ParcelManagement';
import IssuedBillsPage from './modules/admin/pages/IssuedBills';
import KitchenDisplay from './modules/kitchen/pages/KitchenDisplay';
import CaptainPanel from './modules/captain/pages/CaptainPanel';
import CustomerMenu from './modules/customer/pages/CustomerMenu';
import RoleSelection from './shared/pages/RoleSelection';
import ProtectedRoute from './shared/components/ProtectedRoute';
import CaptainProtectedRoute from './shared/components/CaptainProtectedRoute';
import SuperAdminDashboard from './modules/super-admin/pages/SuperAdminDashboard';
import SuperAdminLogin from './modules/super-admin/pages/SuperAdminLogin';
import SuperAdminProtectedRoute from './modules/super-admin/components/SuperAdminProtectedRoute';

function RootRedirect() {
  return <Navigate to="/select-panel" replace />;
}

function App() {
  React.useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('mejwani_admin_jwt');
        if (!token) {
          // No admin session — skip system-settings fetch to avoid 401 console error
          return;
        }
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const resp = await authorizedFetch(`${API_BASE}/admin/system-settings`);
        const data = await resp.json();
        if (resp.ok && data.success) {
          cacheSystemSettings(data.data);
        }
      } catch (e) {
        // ignore — cached value may exist
      }
    })();
  }, []);

  return (
    <ThemeProvider>
      <NotificationProvider>
      <Router>
        <Routes>
          {/* Admin Routes */}
          <Route path="/admin" element={<Navigate to="/admin/orders" replace />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><AdminOverview /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="/admin/parcel" element={<ProtectedRoute><ParcelManagement /></ProtectedRoute>} />
          <Route path="/admin/tables" element={<ProtectedRoute><TablesPage /></ProtectedRoute>} />
          <Route path="/admin/staff" element={<Navigate to="/admin/settings?tab=staff" replace />} />
          <Route path="/admin/mess" element={<ProtectedRoute><MessPage /></ProtectedRoute>} />
          <Route path="/admin/kitchen" element={<ProtectedRoute><AdminKitchen /></ProtectedRoute>} />
          {/* <Route path="/admin/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} /> */}
          <Route path="/admin/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin/hotel-menu" element={<ProtectedRoute><HotelMenu /></ProtectedRoute>} />
          <Route path="/admin/categories" element={<ProtectedRoute><ManageCategories /></ProtectedRoute>} />
          <Route path="/admin/bills" element={<ProtectedRoute><IssuedBillsPage /></ProtectedRoute>} />

          {/* Kitchen Routes */}
          <Route path="/kitchen" element={<KitchenDisplay />} />

          {/* Captain Panel Route */}
          <Route path="/captain" element={<CaptainProtectedRoute><CaptainPanel /></CaptainProtectedRoute>} />
          <Route path="/menu" element={<CustomerMenu />} />

          {/* Landing / Selector Gate */}
          <Route path="/select-panel" element={<RoleSelection />} />
          <Route path="/:slug/select-panel" element={<RoleSelection />} />

          {/* Super Admin Routes */}
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />
          <Route path="/super-admin/*" element={<SuperAdminProtectedRoute><SuperAdminDashboard /></SuperAdminProtectedRoute>} />

          {/* Fallback */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Router>
      <Toaster position="top-center" />
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
// lkjhvgbnmdfghjkjhgjkl
