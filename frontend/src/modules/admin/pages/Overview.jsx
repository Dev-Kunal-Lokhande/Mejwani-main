import React, { useState, useEffect, useRef } from 'react';
import socket from '../../../shared/services/socketClient';
import { formatDateDDMMYYYY } from '../../../utils/dateFormatter';
import { 
  DollarSign, 
  ShoppingBag, 
  Table, 
  Users, 
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Zap,
  Package,
  Utensils,
  Calendar,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  X,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import AdminLayout from '../../../shared/layouts/AdminLayout';
import { useTheme } from '../../../shared/context/ThemeContext';
import { API_BASE } from '../../../shared/services/apiBase';

// Auto-attach JWT token to every axios request from this page
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('mejwani_admin_jwt');
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export default function AdminOverview() {
  const { isDarkMode } = useTheme();
  const [timeframe, setTimeframe] = useState('today');
  const [loading, setLoading] = useState(true);
  
  // Active Captain Requests state removed (handled via standard notifications page)

  // fetchCaptainRequests and handleAcknowledge removed (using standard notifications page)

  // Socket listeners and speech synthesis for captain requests removed from component body (handled globally in realtimeAlerts.js)
  
  // Data states
  const [analytics, setAnalytics] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [kitchenQueue, setKitchenQueue] = useState([]);
  const [activeTables, setActiveTables] = useState({ occupied: 0, total: 20 });
  const [activeStaff, setActiveStaff] = useState(0);

  // Item Sales Report states
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});

  // Reports states
  const [activeReport, setActiveReport] = useState(null);
  const [activeReportTitle, setActiveReportTitle] = useState('');
  const [reportsFromDate, setReportsFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [reportsToDate, setReportsToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [reportsData, setReportsData] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleCategory = (catName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  const fetchItemSalesReport = async () => {
    try {
      setReportLoading(true);
      setReportError(null);
      const baseUrl = API_BASE;
      const response = await axios.get(`${baseUrl}/dashboard/item-sales-report?startDate=${reportStartDate}&endDate=${reportEndDate}`);
 if (response.data.success) {
  const data = response.data?.data;
  const categories = Array.isArray(data?.categories)
    ? data.categories
    : [];

  setReportData({ ...data, categories });

  const initialExpanded = {};

  categories.forEach((cat) => {
    initialExpanded[cat.categoryName] = true;
  });

  setExpandedCategories(initialExpanded);
} else {
  setReportError(
    response.data.message || "Failed to fetch report"
  );
}
    } catch (err) {
      console.error('Error fetching item sales report:', err);
      setReportError(err.response?.data?.message || 'Error fetching report');
    } finally {
      setReportLoading(false);
    }
  };

  const downloadCSVReport = () => {
    if (!reportData || !reportData.categories) return;
    
    // CSV headers
    const headers = ['Category', 'Item Name', 'Quantity Sold', 'Subtotal (₹)'];
    const rows = [];
    
    reportData.categories.forEach(cat => {
      cat.items.forEach(item => {
        rows.push([
          cat.categoryName,
          item.itemName,
          item.quantity,
          item.subtotal
        ]);
      });
      // Category total
      rows.push([
        `${cat.categoryName} Total`,
        '',
        '',
        cat.categorySubtotal
      ]);
    });
    
    // Grand total
    rows.push([]);
    rows.push(['Grand Total', '', '', reportData.grandTotal]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => {
        const strVal = String(val === null || val === undefined ? '' : val);
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `item_sales_report_${reportStartDate}_to_${reportEndDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchReport = async (reportType, fromDate, toDate) => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '1';
      
      let endpoint = '';
      if (reportType === 'item-wise') {
        endpoint = `${API_BASE}/dashboard/item-sales-report?startDate=${fromDate}&endDate=${toDate}&hotelId=${hotelId}`;
      } else {
        endpoint = `${API_BASE}/dashboard/reports/${reportType}?startDate=${fromDate}&endDate=${toDate}&hotelId=${hotelId}`;
      }
      
      const res = await axios.get(endpoint);
      if (res.data?.success) {
        setReportsData(res.data.data);
      } else {
        setReportsError(res.data?.message || 'Failed to fetch report');
      }
    } catch (err) {
      console.error(err);
      setReportsError(err.response?.data?.message || 'Error fetching report');
    } finally {
      setReportsLoading(false);
    }
  };

  const downloadReportCSV = (reportType, data, title) => {
    if (!data) return;

    let headers = [];
    let rows = [];

    if (reportType === 'daily-sales') {
      headers = ['Date', 'Total Orders', 'Subtotal (Rs.)', 'CGST (Rs.)', 'SGST (Rs.)', 'Grand Total (Rs.)'];
      rows = data.map(r => [
        formatDateDDMMYYYY(r.date),
        r.total_orders,
        r.subtotal,
        r.cgst,
        r.sgst,
        r.grand_total
      ]);
    } else if (reportType === 'day-end') {
      headers = ['Date', 'Completed Orders', 'Cancelled Orders', 'Subtotal (Rs.)', 'CGST (Rs.)', 'SGST (Rs.)', 'Grand Total (Rs.)', 'Dining Total (Rs.)', 'Parcel Total (Rs.)'];
      rows = data.map(r => [
        formatDateDDMMYYYY(r.date),
        r.completed_orders,
        r.cancelled_orders,
        r.subtotal,
        r.cgst,
        r.sgst,
        r.grand_total,
        r.dining_total,
        r.parcel_total
      ]);
    } else if (reportType === 'payment-summary') {
      headers = ['Payment Mode', 'Total Bills Settle', 'Grand Total (Rs.)'];
      rows = data.map(r => [
        r.payment_mode,
        r.total_orders,
        r.grand_total
      ]);
    } else if (reportType === 'category-wise') {
      headers = ['Category Name', 'Quantity Sold', 'Subtotal (Rs.)'];
      rows = data.map(r => [
        r.category_name,
        r.quantity_sold,
        r.subtotal
      ]);
    } else if (reportType === 'captain-performance') {
      headers = ['Captain Name', 'Total Tables Served', 'Completed Sales (Rs.)', 'Average Bill Value (Rs.)', 'Avg Settlement Time (Mins)'];
      rows = data.map(r => [
        r.captain_name,
        r.total_tables_served,
        r.completed_sales,
        parseFloat(r.average_bill_value).toFixed(2),
        parseFloat(r.avg_settlement_time_mins).toFixed(1)
      ]);
    } else if (reportType === 'customer-visits') {
      headers = ['Date', 'Total Visit Sessions', 'Avg Session Duration (Mins)'];
      rows = data.map(r => [
        formatDateDDMMYYYY(r.date),
        r.total_sessions,
        parseFloat(r.avg_session_duration_mins).toFixed(1)
      ]);
    } else if (reportType === 'item-wise') {
      headers = ['Category', 'Item Name', 'Quantity Sold', 'Subtotal (Rs.)'];
      data.categories?.forEach(cat => {
        cat.items.forEach(item => {
          rows.push([
            cat.categoryName,
            item.itemName,
            item.quantity,
            item.subtotal
          ]);
        });
      });
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => {
        const strVal = String(val === null || val === undefined ? '' : val);
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}_report_${reportsFromDate}_to_${reportsToDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartStroke = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const tickColor = isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.7)";
  
  // Theme colors
  const COLORS = {
    primary: '#ff6b00',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    hotel: '#10b981',
    parcel: '#3b82f6'
  };

  const { totalHotelRevenue, totalParcelRevenue } = React.useMemo(() => {
    let hotelSum = 0;
    let parcelSum = 0;
    revenueData.forEach(item => {
      hotelSum += item.hotelRevenue || 0;
      parcelSum += item.parcelRevenue || 0;
    });
    return { totalHotelRevenue: hotelSum, totalParcelRevenue: parcelSum };
  }, [revenueData]);

  useEffect(() => {
    fetchDashboardData();
    // Set up polling for live operations panel
    const interval = setInterval(() => {
      fetchLiveOperations();
    }, 10000);
    return () => clearInterval(interval);
  }, [timeframe]);

  useEffect(() => {
    fetchItemSalesReport();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const baseUrl = API_BASE;
      
      const [analyticsRes, revenueRes, topItemsRes, peakHoursRes] = await Promise.all([
        axios.get(`${baseUrl}/dashboard/analytics`),
        axios.get(`${baseUrl}/dashboard/revenue?timeframe=${timeframe}`),
        axios.get(`${baseUrl}/dashboard/top-items?timeframe=${timeframe}`),
        axios.get(`${baseUrl}/dashboard/peak-hours?timeframe=${timeframe}`)
      ]);

      // Handle both {success, data: [...]} and plain array responses
      const safeArray = (res) => {
        const d = res?.data;
        if (!d) return [];
        if (Array.isArray(d)) return d;
        if (d.data && Array.isArray(d.data)) return d.data;
        return [];
      };
      const safeObj = (res) => {
        const d = res?.data;
        if (!d) return null;
        if (d.data && typeof d.data === 'object') return d.data;
        if (typeof d === 'object') return d;
        return null;
      };

      setAnalytics(safeObj(analyticsRes));
      setRevenueData(safeArray(revenueRes));
      setTopItems(safeArray(topItemsRes));
      setPeakHours(safeArray(peakHoursRes));
      
      // Also fetch initial live operations
      fetchLiveOperations();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveOperations = async () => {
    try {
      const baseUrl = API_BASE;
      
      let queueData = [];
      let allTables = [];
      let allStaff = [];

      const promises = [
        axios.get(`${baseUrl}/tables`),
        axios.get(`${baseUrl}/staff`),
        axios.get(`${baseUrl}/orders/kitchen-queue`)
      ];

      const results = await Promise.all(promises);
      allTables = results[0]?.data?.data || [];
      allStaff = results[1]?.data?.data || [];
      queueData = results[2]?.data?.data || [];

      setKitchenQueue(queueData);
      
      const occupiedTables = allTables.filter(t => t.status !== 'available').length;
      setActiveTables({ occupied: occupiedTables, total: allTables.length || 20 });
      
      const onlineStaff = allStaff.filter(s => s.status === 'present').length;
      setActiveStaff(onlineStaff);
    } catch (error) {
      console.error('Error fetching live operations:', error);
    }
  };

  // Helper for formatting currency
  const formatCurrency = (val) => `₹${Number(val).toLocaleString()}`;
  
  // Custom Card Component
  const MetricCard = ({ title, value, icon: Icon, trend, color, delay }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card relative overflow-hidden group p-6 border border-white/10 dark:border-white/5 hover:border-primary/50 transition-colors"
    >
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-xl`} style={{ backgroundColor: color }} />
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
          <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center`} style={{ backgroundColor: `${color}15`, color: color }}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      
      {trend && (
        <div className="flex items-center gap-2 mt-4">
          <div className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full ${trend > 0 ? 'text-emerald-600 bg-emerald-500/10' : 'text-rose-600 bg-rose-500/10'}`}>
            {trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {Math.abs(trend)}%
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">vs last period</span>
        </div>
      )}
    </motion.div>
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto pb-12 space-y-8">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">AI Analytics Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Real-time performance and smart insights</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-sm text-sm"
              >
                <FileText className="w-4 h-4 text-orange-500" />
                Reports
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  {[
                    { id: 'daily-sales', title: 'Daily Sales Report' },
                    { id: 'day-end', title: 'Day-End Summary' },
                    { id: 'payment-summary', title: 'Payment Summary' },
                    { id: 'item-wise', title: 'Item-wise Sales' },
                    { id: 'category-wise', title: 'Category-wise Sales' },
                    { id: 'captain-performance', title: 'Captain Performance' },
                    { id: 'customer-visits', title: 'Customer Visit Report' }
                  ].map(rep => (
                    <button
                      key={rep.id}
                      onClick={() => {
                        setDropdownOpen(false);
                        setActiveReport(rep.id);
                        setActiveReportTitle(rep.title);
                        fetchReport(rep.id, reportsFromDate, reportsToDate);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-orange-500 transition-all block cursor-pointer"
                    >
                      {rep.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-700 w-fit">
              {['today', 'week', 'month', 'year'].map(t => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${timeframe === t ? 'bg-primary text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active captain calls section removed (using standard notifications page only) */}

        {/* Top Metric Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
              title="Today's Sales" 
              value={formatCurrency(analytics.todaySales)} 
              icon={DollarSign} 
              trend={analytics.todayGrowth}
              color={COLORS.primary}
              delay={0.1}
            />
            <MetricCard 
              title="Weekly Sales" 
              value={formatCurrency(analytics.weeklySales)} 
              icon={Activity} 
              trend={analytics.weeklyGrowth}
              color={COLORS.secondary}
              delay={0.2}
            />
            <MetricCard 
              title="Monthly Sales" 
              value={formatCurrency(analytics.monthlySales)} 
              icon={ShoppingBag} 
              color={COLORS.info}
              delay={0.3}
            />
            <MetricCard 
              title="Yearly Sales" 
              value={formatCurrency(analytics.yearlySales)} 
              icon={Zap} 
              trend={analytics.yearlyGrowth}
              color={COLORS.success}
              delay={0.4}
            />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Main Chart Section */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="xl:col-span-2 glass-card p-6"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Revenue Trend
                  {loading && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Hotel vs Parcel performance</p>
              </div>
            </div>
            
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHotel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.hotel} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.hotel} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorParcel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.parcel} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.parcel} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} vertical={false} />
                  <XAxis dataKey="name" stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} dx={-10} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
                      borderRadius: '12px',
                      border: '1px solid rgba(148,163,184,0.2)',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      color: isDarkMode ? '#fff' : '#0f172a'
                    }}
                  />
                  <Area type="monotone" name="Dine-in" dataKey="hotelRevenue" stroke={COLORS.hotel} strokeWidth={3} fill="url(#colorHotel)" />
                  <Area type="monotone" name="Parcel" dataKey="parcelRevenue" stroke={COLORS.parcel} strokeWidth={3} fill="url(#colorParcel)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Hotel vs Parcel Split & AI Insights */}
          <div className="flex flex-col gap-6">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Revenue Split</h3>
              {analytics && (
                <div className="space-y-6">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Dine-in', value: totalHotelRevenue },
                            { name: 'Parcel', value: totalParcelRevenue }
                          ]}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                        >
                          <Cell fill={COLORS.hotel} />
                          <Cell fill={COLORS.parcel} />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-sm font-medium">Dine-in</span>
                      </div>
                      <span className="font-bold">{formatCurrency(totalHotelRevenue)}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(totalHotelRevenue / (totalHotelRevenue + totalParcelRevenue || 1)) * 100}%` }} />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium">Parcel</span>
                      </div>
                      <span className="font-bold">{formatCurrency(totalParcelRevenue)}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(totalParcelRevenue / (totalHotelRevenue + totalParcelRevenue || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Smart AI Insights */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-1 glass-card p-6 border-t-4 border-t-secondary"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Smart Insights</h3>
            </div>
            
            <div className="space-y-4">
              <AnimatePresence>
               {(analytics?.insights ?? []).map((insight, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700"
                  >
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">"{insight}"</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Top Selling Items Table */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 glass-card p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Utensils className="w-5 h-5 text-primary" />
                Top Selling Items
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="pb-3 font-semibold text-sm">Item Name</th>
                    <th className="pb-3 font-semibold text-sm text-center">Orders</th>
                    <th className="pb-3 font-semibold text-sm text-right">Revenue</th>
                    <th className="pb-3 font-semibold text-sm text-center">Popularity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topItems.map((item, idx) => (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      key={idx}
                      className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-4 font-bold text-slate-900 dark:text-white">{item.name}</td>
                      <td className="py-4 text-center font-medium">{item.orders}</td>
                      <td className="py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.revenue)}</td>
                      <td className="py-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${item.popularity}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-500">{item.popularity}%</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {topItems.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-500">No data available for this timeframe</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Live Operations Panel & Peak Hours Graph */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 glass-card p-6"
          >
            <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Peak Hours Analysis</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} vertical={false} />
                  <XAxis dataKey="name" stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <Tooltip 
                    cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                      borderRadius: '8px',
                      border: 'none',
                      color: isDarkMode ? '#fff' : '#000'
                    }}
                  />
                  <Bar dataKey="orders" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold animate-pulse">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                LIVE
              </div>
            </div>
            
            <h3 className="text-xl font-bold mb-6">Operations Pulse</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Table className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">Active Tables</p>
                    <p className="text-xl font-bold">{activeTables.occupied} / {activeTables.total}</p>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                  <span className="font-bold text-sm">{Math.round((activeTables.occupied / activeTables.total) * 100)}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Utensils className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">Kitchen Queue</p>
                    <p className="text-xl font-bold">{kitchenQueue.length} <span className="text-sm font-normal text-white/60">pending</span></p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">Staff Online</p>
                    <p className="text-xl font-bold">{activeStaff}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>

        {/* Item Sales Report Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="glass-card p-6 border border-white/10 dark:border-white/5 shadow-xl space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Item Sales Report
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">View and download category-wise item sales reports within custom ranges</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <input 
                  type="date" 
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-0 cursor-pointer"
                />
                <span className="text-slate-400 font-medium">to</span>
                <input 
                  type="date" 
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-0 cursor-pointer"
                />
              </div>

              <button
                onClick={fetchItemSalesReport}
                disabled={reportLoading}
                className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-bold text-sm rounded-lg shadow transition-colors disabled:opacity-50"
              >
                {reportLoading ? 'Loading...' : 'Generate Report'}
              </button>

              {reportData && reportData.categories && reportData.categories.length > 0 && (
                <button
                  onClick={downloadCSVReport}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {reportError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-semibold">
              ⚠️ {reportError}
            </div>
          )}

          {reportLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-500">Aggregating database records...</p>
            </div>
          ) : reportData ? (
            <div className="space-y-4">
              {(reportData.categories || []).length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-medium">
                  No sales recorded between {reportStartDate} and {reportEndDate}.
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {(reportData.categories || []).map((cat, idx) => {
                      const isExpanded = !!expandedCategories[cat.categoryName];
                      return (
                        <div 
                          key={idx}
                          className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/20"
                        >
                          <div 
                            onClick={() => toggleCategory(cat.categoryName)}
                            className="flex items-center justify-between p-4 bg-slate-100/50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 tracking-wide text-sm md:text-base">
                                {cat.categoryName}
                              </span>
                              <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full font-bold text-slate-600 dark:text-slate-400">
                                {cat.items.length} items
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                Subtotal: {formatCurrency(cat.categorySubtotal)}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-4 overflow-x-auto divide-y divide-slate-100 dark:divide-slate-800">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <th className="pb-2">Dish Name</th>
                                    <th className="pb-2 text-center w-24">Quantity</th>
                                    <th className="pb-2 text-right w-36">Total Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(cat.items || []).map((item, itemIdx) => (
                                    <tr key={itemIdx} className="hover:bg-slate-100/10 dark:hover:bg-slate-800/10">
                                      <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-200 text-sm">{item.itemName}</td>
                                      <td className="py-2.5 text-center font-bold text-slate-700 dark:text-slate-300 text-sm">{item.quantity}</td>
                                      <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(item.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Grand Total Bar */}
                  <div className="flex items-center justify-between p-5 bg-gradient-to-r from-primary/10 to-orange-500/10 border border-primary/20 rounded-2xl">
                    <div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">Grand Total Revenue</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Aggregated across all food categories</p>
                    </div>
                    <span className="text-2xl font-black text-primary">
                      {formatCurrency(reportData.grandTotal)}
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : null}

        {/* Interactive Reports Modal */}
        {activeReport && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-250 flex flex-col max-h-[85vh]">
              
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
                    {activeReportTitle}
                  </h3>
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">
                    Filter and export operational metrics
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setActiveReport(null);
                    setReportsData([]);
                  }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Date Filters Row */}
              <div className="flex flex-col sm:flex-row items-end gap-4 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex-1 flex flex-col gap-1 w-full">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">From Date</label>
                  <input
                    type="date"
                    value={reportsFromDate}
                    onChange={e => setReportsFromDate(e.target.value)}
                    className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-sm text-slate-700 dark:text-slate-200 font-bold w-full"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1 w-full">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">To Date</label>
                  <input
                    type="date"
                    value={reportsToDate}
                    onChange={e => setReportsToDate(e.target.value)}
                    className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-sm text-slate-700 dark:text-slate-200 font-bold w-full"
                  />
                </div>
                <button
                  onClick={() => fetchReport(activeReport, reportsFromDate, reportsToDate)}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-orange-500/10 cursor-pointer w-full sm:w-auto"
                >
                  Run Report
                </button>
              </div>

              {/* Report Content Panel */}
              <div className="flex-1 overflow-y-auto py-4 min-h-[300px]">
                {reportsLoading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 py-16">
                    <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Generating report...</span>
                  </div>
                ) : reportsError ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-rose-500 py-16">
                    <AlertCircle className="w-8 h-8" />
                    <span className="text-xs font-bold uppercase tracking-wider">{reportsError}</span>
                  </div>
                ) : !reportsData || (Array.isArray(reportsData) && reportsData.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                    <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
                    <span className="text-xs font-bold uppercase tracking-wider">No records found for the selected range.</span>
                  </div>
                ) : (
                  <div>
                    {/* Render Tables dynamically based on activeReport */}
                    
                    {/* 1. Daily Sales Report Table */}
                    {activeReport === 'daily-sales' && (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Total Orders</th>
                            <th className="px-4 py-3">Subtotal</th>
                            <th className="px-4 py-3">CGST</th>
                            <th className="px-4 py-3">SGST</th>
                            <th className="px-4 py-3 text-right">Grand Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {reportsData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-3 font-bold">{formatDateDDMMYYYY(row.date)}</td>
                              <td className="px-4 py-3">{row.total_orders}</td>
                              <td className="px-4 py-3">₹{parseFloat(row.subtotal).toFixed(2)}</td>
                              <td className="px-4 py-3">₹{parseFloat(row.cgst).toFixed(2)}</td>
                              <td className="px-4 py-3">₹{parseFloat(row.sgst).toFixed(2)}</td>
                              <td className="px-4 py-3 text-right font-black text-orange-500">₹{parseFloat(row.grand_total).toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* 2. Day-End Summary Table */}
                    {activeReport === 'day-end' && (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Settled</th>
                            <th className="px-4 py-3">Cancelled</th>
                            <th className="px-4 py-3">Subtotal</th>
                            <th className="px-4 py-3">CGST+SGST</th>
                            <th className="px-4 py-3">Dining Total</th>
                            <th className="px-4 py-3">Parcel Total</th>
                            <th className="px-4 py-3 text-right">Day Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {reportsData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-3 font-bold">{formatDateDDMMYYYY(row.date)}</td>
                              <td className="px-4 py-3 text-emerald-600 font-bold">{row.completed_orders}</td>
                              <td className="px-4 py-3 text-rose-500 font-bold">{row.cancelled_orders}</td>
                              <td className="px-4 py-3">₹{parseFloat(row.subtotal).toFixed(2)}</td>
                              <td className="px-4 py-3">₹{(parseFloat(row.cgst) + parseFloat(row.sgst)).toFixed(2)}</td>
                              <td className="px-4 py-3">₹{parseFloat(row.dining_total).toFixed(2)}</td>
                              <td className="px-4 py-3">₹{parseFloat(row.parcel_total).toFixed(2)}</td>
                              <td className="px-4 py-3 text-right font-black text-orange-500">₹{parseFloat(row.grand_total).toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* 3. Payment Summary Table */}
                    {activeReport === 'payment-summary' && (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-3">Payment Mode</th>
                            <th className="px-4 py-3">Total Bills Settle</th>
                            <th className="px-4 py-3 text-right">Grand Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {reportsData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-3 font-bold text-slate-900 dark:text-white uppercase">{row.payment_mode}</td>
                              <td className="px-4 py-3">{row.total_orders} bills</td>
                              <td className="px-4 py-3 text-right font-black text-orange-500">₹{parseFloat(row.grand_total).toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* 4. Category-wise Sales Table */}
                    {activeReport === 'category-wise' && (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-3">Category Name</th>
                            <th className="px-4 py-3">Quantity Sold</th>
                            <th className="px-4 py-3 text-right">Subtotal Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {reportsData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-3 font-bold text-slate-900 dark:text-white uppercase">{row.category_name}</td>
                              <td className="px-4 py-3">{row.quantity_sold} qty</td>
                              <td className="px-4 py-3 text-right font-black text-orange-500">₹{parseFloat(row.subtotal).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* 5. Captain Performance Table */}
                    {activeReport === 'captain-performance' && (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-3">Captain Name</th>
                            <th className="px-4 py-3">Tables Served</th>
                            <th className="px-4 py-3">Completed Sales</th>
                            <th className="px-4 py-3">Average Bill Value</th>
                            <th className="px-4 py-3 text-right">Avg Settlement Turnaround</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {reportsData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.captain_name}</td>
                              <td className="px-4 py-3">{row.total_tables_served} sessions</td>
                              <td className="px-4 py-3 text-emerald-600 font-bold">₹{parseFloat(row.completed_sales).toFixed(2)}</td>
                              <td className="px-4 py-3">₹{parseFloat(row.average_bill_value).toFixed(2)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-500">{parseFloat(row.avg_settlement_time_mins).toFixed(1)} mins</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* 6. Customer Visit Report Table */}
                    {activeReport === 'customer-visits' && (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Total Visit Sessions</th>
                            <th className="px-4 py-3 text-right">Avg Session Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {reportsData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-3 font-bold">{formatDateDDMMYYYY(row.date)}</td>
                              <td className="px-4 py-3">{row.total_sessions} visits</td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-500">{parseFloat(row.avg_session_duration_mins).toFixed(1)} mins</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* 7. Item-wise Sales Table */}
                    {activeReport === 'item-wise' && reportsData.categories && (
                      <div className="space-y-4">
                        {reportsData.categories.map((cat, catIdx) => (
                          <div key={catIdx} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase mb-2">
                              {cat.categoryName} (Total: ₹{cat.categorySubtotal})
                            </h4>
                            <table className="w-full text-left border-collapse text-xs">
                              <tbody>
                                {(cat.items || []).map((item, itemIdx) => (
                                  <tr key={itemIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                    <td className="py-2 text-slate-700 dark:text-slate-300">{item.itemName}</td>
                                    <td className="py-2 text-center text-slate-400">{item.quantity} portions</td>
                                    <td className="py-2 text-right font-bold text-emerald-600">₹{item.subtotal}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button
                  disabled={reportsLoading || reportsError || !reportsData || (Array.isArray(reportsData) && reportsData.length === 0)}
                  onClick={() => downloadReportCSV(activeReport, reportsData, activeReportTitle)}
                  className="flex items-center justify-center gap-1.5 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-orange-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
                <button
                  onClick={() => {
                    setActiveReport(null);
                    setReportsData([]);
                  }}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

        </motion.div>
      </div>
    </AdminLayout>
  );
}
