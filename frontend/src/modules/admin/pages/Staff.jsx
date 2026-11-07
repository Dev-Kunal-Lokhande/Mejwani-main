import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../shared/services/apiBase';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  Plus, 
  Search, 
  Star, 
  Phone, 
  Mail, 
  Trash2, 
  Edit2,
  TrendingUp,
  UserCheck,
  UserX,
  AlertTriangle,
  UserMinus,
  Briefcase,
  DollarSign,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  CalendarDays,
  Download
} from 'lucide-react';
import AdminLayout from '../../../shared/layouts/AdminLayout';

export function StaffManagementContent() {
  const [staffList, setStaffList] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [salaryData, setSalaryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingStaff, setSavingStaff] = useState(false);
  const [processingAttendanceId, setProcessingAttendanceId] = useState(null);
  
  // Views
  const [viewMode, setViewMode] = useState('directory'); // 'directory' | 'payroll' | 'orders'

  // Captain Performance States
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [performanceData, setPerformanceData] = useState([]);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [selectedCaptain, setSelectedCaptain] = useState(null);

  // Modals & Forms
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    role: 'waiter',
    phone: '',
    email: '',
    salary: '',
    shift: 'morning',
    address: '',
    emergencyContact: '',
    joiningDate: new Date().toISOString().split('T')[0]
  });

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRole, setActiveRole] = useState('All');

  // Real-time Toast Notifications
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const fetchPerformanceData = useCallback(async () => {
    try {
      setLoadingPerformance(true);
      const res = await axios.get(`${API_BASE}/staff/performance?startDate=${startDate}&endDate=${endDate}`);
      if (res.data?.status === 'success') {
        setPerformanceData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch captain performance:', err);
      showToast('Failed to fetch captain performance report', 'error');
    } finally {
      setLoadingPerformance(false);
    }
  }, [startDate, endDate, showToast]);

  useEffect(() => {
    if (viewMode === 'orders') {
      fetchPerformanceData();
    }
  }, [viewMode, fetchPerformanceData]);

  const exportPerformancePDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [255, 107, 0];
    const darkColor = [30, 41, 59];
    const grayColor = [100, 116, 139];
    const lightGray = [241, 245, 249];

    // Header Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('MEJWANI POS', 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('Captain Sales Performance Report', 14, 28);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 34);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 39);

    const totalCaptainsCount = performanceData.length;
    const totalPeriodSales = performanceData.reduce((sum, item) => sum + item.totalSales, 0);
    const totalPeriodOrders = performanceData.reduce((sum, item) => sum + item.totalOrdersCount, 0);

    // Box 1: Total Sales
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(14, 45, 55, 20, 3, 3, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('TOTAL REVENUE', 18, 51);
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`INR ${totalPeriodSales.toLocaleString()}`, 18, 59);

    // Box 2: Total Orders
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(77, 45, 55, 20, 3, 3, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('TOTAL ORDERS', 81, 51);
    doc.setFontSize(12);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`${totalPeriodOrders.toLocaleString()}`, 81, 59);

    // Box 3: Total Captains
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(140, 45, 55, 20, 3, 3, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('STAFF INVOLVED', 144, 51);
    doc.setFontSize(12);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`${totalCaptainsCount}`, 144, 59);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('Sales Breakdown by Captain / Desk', 14, 75);

    const tableHeaders = [['Rank', 'Captain Name', 'Role/Type', 'Total Orders', 'Total Sales (INR)', 'Performance Rating']];
    const tableRows = performanceData.map((cap, index) => [
      index + 1,
      cap.fullName,
      cap.id === 0 ? 'Admin/Desk' : (cap.id === null ? 'Historical/Other' : 'Captain'),
      cap.totalOrdersCount,
      cap.totalSales.toLocaleString(),
      cap.id === 0 ? 'N/A' : `${cap.performance.toFixed(1)} / 5.0`
    ]);

    doc.autoTable({
      startY: 80,
      head: tableHeaders,
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: darkColor
      },
      columnStyles: {
        0: { width: 15, halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`mejwani-captain-performance-${startDate}-to-${endDate}.pdf`);
    showToast('Report downloaded successfully!');
  };

  const exportCaptainDetailPDF = (cap) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [255, 107, 0];
    const darkColor = [30, 41, 59];
    const grayColor = [100, 116, 139];

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('MEJWANI POS', 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`Order History - ${cap.fullName}`, 14, 28);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 34);
    doc.text(`Total Sales: INR ${cap.totalSales.toLocaleString()} | Total Orders: ${cap.totalOrdersCount}`, 14, 39);

    const tableHeaders = [['Sr. No.', 'Order ID / KOT', 'Table/Section', 'Date & Time', 'Status', 'Amount (INR)']];
    const tableRows = cap.orders.map((ord, idx) => [
      idx + 1,
      ord.kotNumber || `ORD-${ord.id}`,
      ord.tableName,
      new Date(ord.createdAt).toLocaleString(),
      ord.status,
      ord.grandTotal.toLocaleString()
    ]);

    doc.autoTable({
      startY: 45,
      head: tableHeaders,
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: darkColor,
        textColor: [255, 255, 255],
        fontSize: 9
      },
      columnStyles: {
        5: { halign: 'right' }
      }
    });

    doc.save(`mejwani-orders-${cap.fullName.replace(/\s+/g, '_')}-${startDate}-to-${endDate}.pdf`);
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12

      const [staffRes, reportRes, salaryRes] = await Promise.all([
        axios.get(`${API_BASE}/staff`),
        axios.get(`${API_BASE}/staff/monthly-report?year=${currentYear}&month=${currentMonth}`),
        axios.get(`${API_BASE}/staff/salary?year=${currentYear}&month=${currentMonth}`)
      ]);
      
      if (staffRes.data?.data) setStaffList(staffRes.data.data);
      if (reportRes.data?.data) setReportData(reportRes.data.data);
      if (salaryRes.data?.data) setSalaryData(salaryRes.data.data);
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Could not connect to the backend server. Please make sure the backend is running.');
      showToast('Error connecting to backend server', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchData]);

  // Roles available in Mejwani POS
  const roles = ['All', 'waiter', 'captain', 'chef', 'kitchen', 'manager', 'cashier'];

  // Handle Form Inputs
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Open Modal for adding
  const handleAddClick = () => {
    setEditingStaff(null);
    setFormData({
      fullName: '',
      role: 'waiter',
      phone: '',
      email: '',
      salary: '25000',
      shift: 'morning',
      address: '',
      emergencyContact: '',
      joiningDate: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  // Open Modal for editing
  const handleEditClick = (staff) => {
    setEditingStaff(staff);
    setFormData({
      fullName: staff.fullName,
      role: staff.role,
      phone: staff.phone,
      email: staff.email || '',
      salary: staff.salary.toString(),
      shift: staff.shift,
      address: staff.address || '',
      emergencyContact: staff.emergencyContact || '',
      joiningDate: staff.joiningDate ? new Date(staff.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  // Submit Modal Form (Add or Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone) {
      showToast('Please enter both name and phone number', 'error');
      return;
    }

    try {
      setSavingStaff(true);
      if (editingStaff) {
        const res = await axios.put(`${API_BASE}/staff/${editingStaff._id}`, formData);
        if (res.data?.status === 'success') {
          showToast(`Updated ${formData.fullName} successfully`);
          fetchData();
          setIsModalOpen(false);
        }
      } else {
        const res = await axios.post(`${API_BASE}/staff`, formData);
        if (res.data?.status === 'success') {
          showToast(`Registered new staff: ${formData.fullName}`);
          fetchData();
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      console.error('Failed to save staff:', err);
      showToast(err.response?.data?.message || 'Unable to save staff profile. Please check the details.', 'error');
    } finally {
      setSavingStaff(false);
    }
  };

  // Delete Staff
  const handleDeleteClick = async (staff) => {
    if (window.confirm(`Are you absolutely sure you want to remove ${staff.fullName} from Mejwani systems?`)) {
      try {
        const res = await axios.delete(`${API_BASE}/staff/${staff._id}`);
        if (res.data?.status === 'success') {
          showToast(`Removed staff: ${staff.fullName}`);
          fetchData();
        }
      } catch (err) {
        console.error('Failed to delete staff:', err);
        showToast('Failed to remove staff member', 'error');
      }
    }
  };

  // Mark Attendance
  const handleMarkAttendance = async (staffId, status, name) => {
    try {
      setProcessingAttendanceId(staffId);
      // Optimistic locally synced status update
      setStaffList(prev => prev.map(s => s._id === staffId ? { ...s, status } : s));
      
      const res = await axios.post(`${API_BASE}/attendance/mark`, {
        staffId,
        status,
        checkIn: status === 'present' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
        notes: `Marked ${status.toUpperCase()} via Cashier Console`
      });

      if (res.data?.status === 'success') {
        showToast(`Attendance marked: ${name} is ${status.toUpperCase()}`);
        fetchData(); // sync reports
      }
    } catch (err) {
      console.error('Failed to mark attendance:', err);
      showToast(err.response?.data?.message || 'Unable to mark attendance. Please try again.', 'error');
      fetchData(); // Rollback local state
    } finally {
      setProcessingAttendanceId(null);
    }
  };

  // Filtered List
  const filteredStaff = staffList.filter(s => {
    const matchesSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = activeRole === 'All' || s.role.toLowerCase() === activeRole.toLowerCase();
    return matchesSearch && matchesRole;
  });

  // Calculate live statistics
  const stats = {
    total: staffList.length,
    present: staffList.filter(s => s.status === 'present').length,
    absent: staffList.filter(s => s.status === 'absent').length,
    leave: staffList.filter(s => s.status === 'leave').length
  };

  const totalPayroll = salaryData.reduce((acc, s) => acc + Number(s.finalSalary), 0);
  const monthTotalDays = reportData[0]?.total_days || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const monthlyTotals = reportData.reduce((acc, r) => ({
    present: acc.present + Number(r.present_days || 0),
    absent: acc.absent + Number(r.absent_days || 0),
    leave: acc.leave + Number(r.leave_days || 0),
    effectivePresent: acc.effectivePresent + Number(r.effective_present || 0),
    totalDays: acc.totalDays + Number(r.total_days || monthTotalDays)
  }), { present: 0, absent: 0, leave: 0, effectivePresent: 0, totalDays: 0 });

  const getReportForStaff = (staffId) => reportData.find(r => Number(r._id) === Number(staffId)) || {};
  const formatRole = (role = '') => role.replace('-', ' ');
  const getAttendanceCalendar = (report) => {
    const history = report.attendance_history || [];
    const byDay = new Map(history.map(item => {
      const day = Number(String(item.date).slice(8, 10));
      return [day, item.status];
    }));

    return Array.from({ length: Number(report.total_days || monthTotalDays) }, (_, index) => {
      const day = index + 1;
      return {
        day,
        status: byDay.get(day) || 'unmarked'
      };
    });
  };

  const attendanceStyles = {
    present: 'bg-emerald-500 text-white border-emerald-500',
    absent: 'bg-rose-500 text-white border-rose-500',
    leave: 'bg-amber-400 text-slate-950 border-amber-400',
    unmarked: 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-white/5 dark:text-white/30 dark:border-white/10'
  };

  return (
    <div className="space-y-8 w-full max-w-full overflow-x-hidden">
        
        {/* Top Header / View Toggles */}
        <div className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-100 bg-white p-2 shadow-sm dark:border-white/5 dark:bg-[#0c0c0c] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full gap-2 overflow-x-auto sm:w-auto">
            <button
              onClick={() => setViewMode('directory')}
              className={`min-h-11 flex-none rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${viewMode === 'directory' ? 'bg-[#ff6b00] text-white shadow-lg shadow-orange-500/20' : 'bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
            >
              Staff Directory
            </button>
            <button
              onClick={() => setViewMode('payroll')}
              className={`min-h-11 flex-none rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${viewMode === 'payroll' ? 'bg-[#ff6b00] text-white shadow-lg shadow-orange-500/20' : 'bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
            >
              Payroll & Analytics
            </button>
            <button
              onClick={() => setViewMode('orders')}
              className={`min-h-11 flex-none rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${viewMode === 'orders' ? 'bg-[#ff6b00] text-white shadow-lg shadow-orange-500/20' : 'bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
            >
              Captain Performance
            </button>
          </div>
          
          {viewMode === 'directory' && (
            <button 
              onClick={handleAddClick}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b00] px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Add Staff
            </button>
          )}
        </div>

        {/* Dynamic Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
          <div className="bg-white dark:bg-[#0c0c0c] p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm transition-all hover:scale-[1.01]">
            <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Total Staff</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{loading ? '...' : stats.total}</p>
          </div>
          <div className="bg-white dark:bg-[#0c0c0c] p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm transition-all hover:scale-[1.01]">
            <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Present Today</p>
            <p className="text-3xl font-black text-emerald-500">{loading ? '...' : stats.present}</p>
          </div>
          <div className="bg-white dark:bg-[#0c0c0c] p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm transition-all hover:scale-[1.01]">
            <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><UserX className="w-3.5 h-3.5 text-rose-500" /> Absent Today</p>
            <p className="text-3xl font-black text-rose-500">{loading ? '...' : stats.absent}</p>
          </div>
          <div className="bg-white dark:bg-[#0c0c0c] p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm transition-all hover:scale-[1.01]">
            <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Avg Attendance</p>
            <p className="text-2xl font-black text-blue-500">{loading ? '...' : `P: ${monthlyTotals.present} | A: ${monthlyTotals.absent} | L: ${monthlyTotals.leave}`}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{loading ? '' : `${monthlyTotals.effectivePresent} / ${monthlyTotals.totalDays || monthTotalDays} Days Present`}</p>
          </div>
          <div className="bg-white dark:bg-[#0c0c0c] p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm transition-all hover:scale-[1.01]">
            <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-amber-500" /> Estimated Salary</p>
            <p className="mt-1 text-[10px] font-bold text-slate-400">Calculated based on current attendance</p>
            <p className="text-3xl font-black text-amber-500">INR {loading ? '...' : totalPayroll.toLocaleString()}</p>
          </div>
        </div>

        {/* Error Boundary Display */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl flex items-center gap-4 animate-in fade-in duration-300">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 animate-pulse" />
            <div className="text-xs font-bold leading-normal">{error}</div>
            <button onClick={fetchData} className="ml-auto px-4 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-600 transition-colors">Retry Connection</button>
          </div>
        )}

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 text-[#ff6b00] animate-spin mb-4" />
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Syncing System Records...</p>
          </div>
        ) : viewMode === 'directory' ? (
          /* ======================================================== */
          /* STAFF DIRECTORY VIEW                                     */
          /* ======================================================== */
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search staff by name, role, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-white/5 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#ff6b00] transition-all text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex bg-white dark:bg-[#0c0c0c] p-1 border border-slate-200 dark:border-white/5 rounded-2xl overflow-x-auto scrollbar-none">
                {roles.map(role => (
                  <button
                    key={role}
                    onClick={() => setActiveRole(role)}
                    className={`px-5 py-2.5 text-[10px] uppercase tracking-widest font-black rounded-xl transition-all whitespace-nowrap ${
                      activeRole === role 
                        ? 'bg-[#ff6b00] text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {filteredStaff.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center opacity-40">
                <Briefcase className="w-12 h-12 text-slate-400 mb-4" />
                <p className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-white">No staff members found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {filteredStaff.map((member) => {
                  const rData = getReportForStaff(member._id);
                  const calendarDays = getAttendanceCalendar(rData);
                  const isProcessing = processingAttendanceId === member._id;

                  return (
                    <div key={member._id} className="relative flex flex-col justify-between rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-[#ff6b00]/30 hover:shadow-lg dark:border-white/5 dark:bg-[#0d0d0d] sm:p-6">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                        
                        <div className="relative shrink-0 self-start">
                          <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#ff6b00]/10">
                            <span className="text-3xl font-black text-[#ff6b00]">{member.fullName.charAt(0)}</span>
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-xl border-4 border-white dark:border-[#0d0d0d] flex items-center justify-center
                            ${member.status === 'present' ? 'bg-emerald-500' : member.status === 'absent' ? 'bg-rose-500' : 'bg-amber-500'}
                          `}>
                            {member.status === 'present' ? (
                              <UserCheck className="w-3.5 h-3.5 text-white" />
                            ) : member.status === 'absent' ? (
                              <UserX className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <UserMinus className="w-3.5 h-3.5 text-white" />
                            )}
                          </div>
                        </div>

                        <div className="w-full min-w-0 flex-1">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="break-words text-xl font-black tracking-tight text-slate-900 dark:text-white">{member.fullName}</h4>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-[#ff6b00]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">{formatRole(member.role)}</span>
                                <span className="text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-widest">{member.shift} SHIFT</span>
                              </div>
                            </div>
                            
                            <div className="flex shrink-0 gap-1.5">
                              <button onClick={() => handleEditClick(member)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:text-blue-500 dark:bg-white/5">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteClick(member)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:text-rose-500 dark:bg-white/5">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="p-3 bg-slate-50 dark:bg-white/2 rounded-2xl border border-slate-100 dark:border-white/5">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Performance</p>
                              <div className="flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                <span className="text-sm font-black text-slate-900 dark:text-white">{parseFloat(member.performance || 0).toFixed(1)}</span>
                              </div>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-white/2 rounded-2xl border border-slate-100 dark:border-white/5">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Attendance</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-500">P: {rData.present_days || 0}</span>
                                <span className="rounded bg-rose-500/10 px-2 py-0.5 text-rose-500">A: {rData.absent_days || 0}</span>
                                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-500">L: {rData.leave_days || 0}</span>
                              </div>
                              <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">{rData.effective_present || 0} / {rData.total_days || monthTotalDays} Days Present</p>
                            </div>
                          </div>

                          <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/5 dark:bg-white/[0.03]">
                            <div className="mb-3 flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-[#ff6b00]" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/50">Monthly Attendance History</p>
                            </div>
                            <div className="grid grid-cols-7 gap-1.5">
                              {calendarDays.map(day => (
                                <div
                                  key={day.day}
                                  title={`${day.day}: ${day.status}`}
                                  className={`flex aspect-square min-h-8 items-center justify-center rounded-lg border text-[10px] font-black ${attendanceStyles[day.status] || attendanceStyles.unmarked}`}
                                >
                                  {day.day}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-bold text-slate-500 dark:text-white/40 mb-4">
                            <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400" /> {member.phone}</div>
                            {member.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-400" /> {member.email}</div>}
                          </div>
                        </div>
                      </div>

                      {/* Attendance Actions */}
                      <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 dark:border-white/5 sm:grid-cols-3">
                        <button disabled={isProcessing} onClick={() => handleMarkAttendance(member._id, 'present', member.fullName)} className={`min-h-11 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-60 ${member.status === 'present' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-white/50 hover:bg-emerald-500/10 hover:text-emerald-500'}`}>
                          PRESENT
                        </button>
                        <button disabled={isProcessing} onClick={() => handleMarkAttendance(member._id, 'absent', member.fullName)} className={`min-h-11 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-60 ${member.status === 'absent' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-white/50 hover:bg-rose-500/10 hover:text-rose-500'}`}>
                          ABSENT
                        </button>
                        <button disabled={isProcessing} onClick={() => handleMarkAttendance(member._id, 'leave', member.fullName)} className={`min-h-11 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-60 ${member.status === 'leave' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-white/50 hover:bg-amber-500/10 hover:text-amber-500'}`}>
                          LEAVE
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewMode === 'payroll' ? (
          /* ======================================================== */
          /* PAYROLL & REPORTS VIEW                                   */
          /* ======================================================== */
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-xl">
              <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 p-6 dark:border-white/5 dark:bg-white/2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Monthly Payroll & Attendance</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Calculated based on current attendance</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/10 rounded-xl text-xs font-bold text-slate-600 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-all uppercase tracking-wider">
                  <FileText className="w-4 h-4" /> Export CSV
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <th className="p-5 pl-8">Staff Member</th>
                      <th className="p-5">P / A / L</th>
                      <th className="p-5">Base Salary</th>
                      <th className="p-5">Estimated Salary</th>
                      <th className="p-5 pr-8">Attd. %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {salaryData.map(sal => {
                      const rep = getReportForStaff(sal.staffId);
                      const pct = Number(rep.attendance_percent || 0);
                      
                      return (
                        <tr key={sal.staffId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="p-5 pl-8">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#ff6b00]/10 flex items-center justify-center text-[#ff6b00] font-black text-sm">
                                {sal.fullName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-black text-sm text-slate-900 dark:text-white">{sal.fullName}</p>
                                <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-0.5">{sal.role}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex gap-2 text-xs font-black">
                              <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">P: {rep.present_days || 0}</span>
                              <span className="text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">A: {rep.absent_days || 0}</span>
                              <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">L: {rep.leave_days || 0}</span>
                            </div>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">{rep.effective_present || 0} / {rep.total_days || sal.totalDays || monthTotalDays} Days Present</p>
                          </td>
                          <td className="p-5 font-black text-slate-600 dark:text-white/70">INR {sal.baseSalary.toLocaleString()}</td>
                          <td className="p-5 font-black text-emerald-600 dark:text-emerald-400 text-base">
                            INR {sal.finalSalary.toLocaleString()}
                            <p className="mt-1 text-[10px] font-bold text-slate-400">Calculated based on current attendance</p>
                          </td>
                          <td className="p-5 pr-8">
                            <div className="flex items-center gap-3">
                              <span className="font-black text-sm w-12">{pct}%</span>
                              <div className="w-24 h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-[#ff6b00]' : 'bg-rose-500'}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {salaryData.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-10 text-center text-slate-500 text-sm font-bold uppercase tracking-wider">
                          No payroll data found for this month.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* CAPTAIN PERFORMANCE REPORT VIEW                          */
          /* ======================================================== */
          <div className="space-y-6">
            {/* Filter Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-white/5 rounded-[2rem] shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest ml-1">From Date</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest ml-1">To Date</label>
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]"
                  />
                </div>
                <button 
                  onClick={fetchPerformanceData}
                  className="mt-5 px-5 py-2.5 bg-[#ff6b00]/10 hover:bg-[#ff6b00]/20 text-[#ff6b00] rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
                >
                  Apply Filters
                </button>
              </div>

              <button 
                onClick={exportPerformancePDF}
                disabled={performanceData.length === 0}
                className="flex items-center justify-center gap-2 min-h-11 rounded-xl bg-[#ff6b00] px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none self-end md:self-auto"
              >
                <Download className="w-4 h-4" /> Export Report (PDF)
              </button>
            </div>

            {/* Performance Data Grid / Table */}
            {loadingPerformance ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-12 h-12 text-[#ff6b00] animate-spin mb-4" />
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Generating Performance Metrics...</p>
              </div>
            ) : performanceData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center opacity-40">
                <FileText className="w-12 h-12 text-slate-400 mb-4" />
                <p className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-white">No sales records found for this period</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {/* Summary Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white dark:bg-[#0c0c0c] p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5">Total Sales Revenue</p>
                    <p className="text-3xl font-black text-[#ff6b00]">INR {performanceData.reduce((sum, item) => sum + item.totalSales, 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-[#0c0c0c] p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5">Total Orders Handled</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white">{performanceData.reduce((sum, item) => sum + item.totalOrdersCount, 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-[#0c0c0c] p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5">Top Order Taker</p>
                    <p className="text-2xl font-black text-emerald-500 truncate">{performanceData[0]?.fullName || 'N/A'}</p>
                  </div>
                </div>

                {/* Table card */}
                <div className="bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          <th className="p-5 pl-8">Rank</th>
                          <th className="p-5">Name</th>
                          <th className="p-5">Role/Type</th>
                          <th className="p-5">Total Orders</th>
                          <th className="p-5">Performance</th>
                          <th className="p-5 pr-8 text-right">Total Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {performanceData.map((cap, index) => (
                          <tr 
                            key={cap.fullName} 
                            onClick={() => setSelectedCaptain(cap)}
                            className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                          >
                            <td className="p-5 pl-8 font-black text-slate-500">#{index + 1}</td>
                            <td className="p-5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#ff6b00]/10 flex items-center justify-center text-[#ff6b00] font-black text-sm">
                                  {cap.fullName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-black text-sm text-slate-900 dark:text-white">{cap.fullName}</p>
                                  <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-0.5">{cap.phone !== 'N/A' ? cap.phone : 'System Counter'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-5 text-xs font-black uppercase text-slate-500">
                              {cap.id === 0 ? (
                                <span className="bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-400">COUNTER</span>
                              ) : cap.id === null ? (
                                <span className="bg-amber-100 dark:bg-amber-500/10 px-2.5 py-1 rounded-md text-amber-600 dark:text-amber-400">HISTORICAL</span>
                              ) : (
                                <span className="bg-[#ff6b00]/10 px-2.5 py-1 rounded-md text-[#ff6b00]">CAPTAIN</span>
                              )}
                            </td>
                            <td className="p-5 font-black text-slate-800 dark:text-white">{cap.totalOrdersCount} Orders</td>
                            <td className="p-5">
                              {cap.id === 0 ? (
                                <span className="text-slate-400 text-xs font-bold">N/A</span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                  <span className="text-sm font-black text-slate-800 dark:text-white">{cap.performance.toFixed(1)}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-5 pr-8 text-right font-black text-[#ff6b00] text-base">
                              INR {cap.totalSales.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Drill-down Captain Orders Modal */}
        {selectedCaptain && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCaptain(null)} />
            <div className="relative w-full max-w-4xl bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-white/10 rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-[#0f0f0f]">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">{selectedCaptain.fullName}'s Order History</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    Period: {startDate} to {endDate} | Sales: INR {selectedCaptain.totalSales.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => exportCaptainDetailPDF(selectedCaptain)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#ff6b00]/10 hover:bg-[#ff6b00]/20 text-[#ff6b00] rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button onClick={() => setSelectedCaptain(null)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full hover:bg-slate-200 transition-all cursor-pointer">
                    <X className="w-4 h-4 text-slate-500 dark:text-white" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {selectedCaptain.orders.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center opacity-40">
                    <FileText className="w-12 h-12 text-slate-400 mb-4" />
                    <p className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-white">No individual orders found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          <th className="p-4 pl-6">Sr. No.</th>
                          <th className="p-4">Order ID / KOT</th>
                          <th className="p-4">Table / Area</th>
                          <th className="p-4">Date & Time</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 pr-6 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {selectedCaptain.orders.map((ord, idx) => (
                          <tr key={ord.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="p-4 pl-6 font-black text-slate-400">{idx + 1}</td>
                            <td className="p-4 font-black text-slate-800 dark:text-white">{ord.kotNumber || `ORD-${ord.id}`}</td>
                            <td className="p-4">{ord.tableName}</td>
                            <td className="p-4">{new Date(ord.createdAt).toLocaleString()}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider
                                ${ord.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}
                              `}>
                                {ord.status}
                              </span>
                            </td>
                            <td className="p-4 pr-6 text-right font-black text-slate-900 dark:text-white">
                              INR {ord.grandTotal.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !savingStaff && setIsModalOpen(false)} />
            <div className="relative w-full max-w-xl bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-white/10 rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-[#0f0f0f]">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">{editingStaff ? 'Edit Staff Profile' : 'New Staff Registration'}</h3>
                </div>
                <button disabled={savingStaff} onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full hover:bg-slate-200 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                  <X className="w-4 h-4 text-slate-500 dark:text-white" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input type="text" name="fullName" required value={formData.fullName} onChange={handleInputChange} placeholder="e.g. Amit Patil" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Role</label>
                    <select name="role" value={formData.role} onChange={handleInputChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]">
                      <option value="waiter">Waiter</option>
                      <option value="captain">Captain</option>
                      <option value="chef">Chef</option>
                      <option value="kitchen">Kitchen Staff</option>
                      <option value="manager">Manager</option>
                      <option value="cashier">Cashier</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input type="text" name="phone" required value={formData.phone} onChange={handleInputChange} placeholder="+91..." className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="@" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Salary (INR)</label>
                    <input type="number" name="salary" required value={formData.salary} onChange={handleInputChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Shift</label>
                    <select name="shift" value={formData.shift} onChange={handleInputChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]">
                      <option value="morning">Morning</option>
                      <option value="evening">Evening</option>
                      <option value="night">Night</option>
                      <option value="full-day">Full Day</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <button type="button" disabled={savingStaff} onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 rounded-2xl font-black text-xs hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase disabled:cursor-not-allowed disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingStaff} className="flex-1 px-6 py-4 bg-[#ff6b00] text-white rounded-2xl font-black text-xs shadow-xl shadow-orange-500/20 hover:scale-[1.02] transition-all uppercase disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100">
                    {savingStaff ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving
                      </span>
                    ) : editingStaff ? 'Save Changes' : 'Register'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Real-time Toast Notifications */}
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 max-w-sm pointer-events-none">
          {toasts.map(toast => (
            <div key={toast.id} className={`p-5 text-white rounded-[2rem] shadow-2xl flex items-center gap-3.5 border border-white/20 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto ${toast.type === 'error' ? 'bg-rose-500 shadow-rose-500/20' : 'bg-[#ff6b00] shadow-orange-500/20'}`}>
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-white" /> : <CheckCircle className="w-4 h-4 text-white" />}
              </div>
              <p className="text-xs font-black leading-snug">{toast.message}</p>
            </div>
          ))}
        </div>

      </div>
  );
}

export default function StaffManagement() {
  return (
    <AdminLayout>
      <StaffManagementContent />
    </AdminLayout>
  );
}
