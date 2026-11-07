import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../shared/services/apiBase';
import { formatDateDDMMYYYY } from '../../../utils/dateFormatter';
import { 
  Plus, 
  Search, 
  Phone, 
  Trash2, 
  Edit2, 
  CalendarDays, 
  Coins, 
  TrendingUp, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Check, 
  UserPlus
} from 'lucide-react';
import AdminLayout from '../../../shared/layouts/AdminLayout';

export default function MessPage() {
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({ daily: 0, weekly: 0, monthly: 0 });
  const [paymentsHistory, setPaymentsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Selected member for detail view modal
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberHistory, setMemberHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Add/Edit Member Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formFields, setFormFields] = useState({
    fullName: '',
    phone: '',
    messType: '1_time',
    amountReceived: '',
    pendingAmount: ''
  });

  // Backdated Attendance States (inside Edit modal)
  const [backdateFields, setBackdateFields] = useState({
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // default yesterday
    morning: false,
    night: false
  });
  const [submittingBackdate, setSubmittingBackdate] = useState(false);

  // Renewal Modal States
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewingMember, setRenewingMember] = useState(null);
  const [renewFields, setRenewFields] = useState({
    messType: '1_time',
    amountReceived: '',
    pendingAmount: ''
  });

  // Toast Alerts State
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Fetch all members
  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/mess`, {
        params: { search: searchQuery }
      });
      if (res.data?.success) {
        setMembers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch mess members:', err);
      setError('Failed to fetch mess members. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleApplyBackdate = async () => {
    if (!editingMember) return;
    try {
      setSubmittingBackdate(true);
      const res = await axios.post(`${API_BASE}/mess/backdate/${editingMember.id}`, {
        date: backdateFields.date,
        morning: backdateFields.morning,
        night: backdateFields.night
      });
      if (res.data?.success) {
        showToast('Backdated attendance updated successfully!');
        fetchMembers();
        fetchStats();
        // Update local editingMember available_days and total_days so it shows correct value
        setEditingMember(prev => ({
          ...prev,
          available_days: res.data.data.available_days,
          total_days: res.data.data.total_days
        }));
        // Reset checkboxes
        setBackdateFields(prev => ({ ...prev, morning: false, night: false }));
      }
    } catch (err) {
      console.error('Backdate submit error:', err);
      showToast(err.response?.data?.message || 'Failed to update backdated attendance.', 'error');
    } finally {
      setSubmittingBackdate(false);
    }
  };

  // Fetch stats (daily, weekly, monthly income)
  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/mess/stats`);
      if (res.data?.success) {
        setStats(res.data.stats);
        setPaymentsHistory(res.data.paymentsHistory);
      }
    } catch (err) {
      console.error('Failed to fetch income stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Handle Add/Edit Form submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMember) {
        // Edit Member
        const res = await axios.put(`${API_BASE}/mess/${editingMember.id}`, {
          fullName: formFields.fullName,
          phone: formFields.phone,
          messType: formFields.messType,
          amountReceived: Number(formFields.amountReceived),
          pendingAmount: Number(formFields.pendingAmount),
          availableDays: editingMember.available_days // keep current remaining meals
        });
        if (res.data?.success) {
          showToast('Member profile updated successfully!');
          setIsFormModalOpen(false);
          fetchMembers();
          fetchStats();
        }
      } else {
        // Create Member
        const res = await axios.post(`${API_BASE}/mess`, {
          fullName: formFields.fullName,
          phone: formFields.phone,
          messType: formFields.messType,
          amountReceived: Number(formFields.amountReceived || 0),
          pendingAmount: Number(formFields.pendingAmount || 0)
        });
        if (res.data?.success) {
          showToast('Member registered successfully!');
          setIsFormModalOpen(false);
          fetchMembers();
          fetchStats();
        }
      }
    } catch (err) {
      console.error('Form submit error:', err);
      showToast(err.response?.data?.message || 'Failed to save member details.', 'error');
    }
  };

  // Open Form Modal for Create
  const openCreateModal = () => {
    setEditingMember(null);
    setFormFields({
      fullName: '',
      phone: '',
      messType: '1_time',
      amountReceived: '',
      pendingAmount: ''
    });
    setIsFormModalOpen(true);
  };

  // Open Form Modal for Edit
  const openEditModal = (member) => {
    setEditingMember(member);
    setFormFields({
      fullName: member.full_name,
      phone: member.phone,
      messType: member.mess_type,
      amountReceived: member.amount_received,
      pendingAmount: member.pending_amount
    });
    setIsFormModalOpen(true);
  };

  // Handle Renewal Submission
  const handleRenewSubmit = async (e) => {
    e.preventDefault();
    if (!renewingMember) return;
    try {
      const res = await axios.post(`${API_BASE}/mess/renew/${renewingMember.id}`, {
        messType: renewFields.messType,
        amountReceived: Number(renewFields.amountReceived || 0),
        pendingAmount: Number(renewFields.pendingAmount || 0)
      });
      if (res.data?.success) {
        showToast(`Membership renewed successfully for ${renewingMember.full_name}!`);
        setIsRenewModalOpen(false);
        fetchMembers();
        fetchStats();
      }
    } catch (err) {
      console.error('Renewal error:', err);
      showToast(err.response?.data?.message || 'Failed to renew membership.', 'error');
    }
  };

  // Open Renewal Modal
  const openRenewModal = (member) => {
    setRenewingMember(member);
    setRenewFields({
      messType: member.mess_type,
      amountReceived: '',
      pendingAmount: ''
    });
    setIsRenewModalOpen(true);
  };

  // Delete Member
  const handleDeleteMember = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? Historical records will be retained.`)) {
      return;
    }
    try {
      const res = await axios.delete(`${API_BASE}/mess/${id}`);
      if (res.data?.success) {
        showToast('Member deleted successfully.');
        fetchMembers();
        fetchStats();
      }
    } catch (err) {
      console.error('Delete member error:', err);
      showToast('Failed to delete member.', 'error');
    }
  };

  // Mark Attendance (Morning/Night)
  const markAttendance = async (memberId, name, type) => {
    try {
      const res = await axios.post(`${API_BASE}/mess/mark/${memberId}`, { type });
      if (res.data?.success) {
        showToast(`Marked ${type === 'morning' ? 'Lunch' : 'Dinner'} done for ${name}!`);
        // Optimistic / Real-time updates for list and stats
        setMembers(prev => prev.map(m => {
          if (m.id === memberId) {
            return {
              ...m,
              available_days: m.available_days - 1,
              morning_marked_today: type === 'morning' ? true : m.morning_marked_today,
              night_marked_today: type === 'night' ? true : m.night_marked_today
            };
          }
          return m;
        }));
      }
    } catch (err) {
      console.error('Mark attendance error:', err);
      showToast(err.response?.data?.message || 'Failed to mark attendance.', 'error');
    }
  };

  // Open Full Detail Modal with Attendance Logs
  const openDetailModal = async (member) => {
    setSelectedMember(member);
    setMemberHistory([]);
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API_BASE}/mess/history/${member.id}`);
      if (res.data?.success) {
        setMemberHistory(res.data.history);
      }
    } catch (err) {
      console.error('Failed to load member history:', err);
      showToast('Failed to load member history log.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 w-full max-w-full overflow-x-hidden">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Mess Management</h2>
            <p className="text-slate-500 dark:text-white/40 text-sm font-bold mt-1">Track daily meals, renewals, active memberships, and payments</p>
          </div>
          <button 
            id="register-member-btn"
            onClick={openCreateModal}
            className="h-12 flex items-center justify-center gap-2 px-6 bg-[#ff6b00] hover:scale-[1.02] active:scale-[0.98] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-orange-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Register New Member
          </button>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 bg-white dark:bg-[#0c0c0c] flex items-center gap-5 shadow-sm relative overflow-hidden group">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-[1.25rem] flex items-center justify-center text-emerald-500 ring-4 ring-emerald-500/5 group-hover:scale-110 transition-all duration-300">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Today's Income</p>
              <h4 className="text-2xl font-black text-slate-800 dark:text-white mt-2 leading-none">INR {stats.daily.toLocaleString()}</h4>
            </div>
            <div className="absolute right-0 bottom-0 opacity-[0.03] text-emerald-500 pointer-events-none translate-x-6 translate-y-6">
              <TrendingUp className="w-32 h-32" />
            </div>
          </div>

          <div className="p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 bg-white dark:bg-[#0c0c0c] flex items-center gap-5 shadow-sm relative overflow-hidden group">
            <div className="w-14 h-14 bg-[#ff6b00]/10 rounded-[1.25rem] flex items-center justify-center text-[#ff6b00] ring-4 ring-orange-500/5 group-hover:scale-110 transition-all duration-300">
              <Coins className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Weekly Income</p>
              <h4 className="text-2xl font-black text-slate-800 dark:text-white mt-2 leading-none">INR {stats.weekly.toLocaleString()}</h4>
            </div>
            <div className="absolute right-0 bottom-0 opacity-[0.03] text-orange-500 pointer-events-none translate-x-6 translate-y-6">
              <Coins className="w-32 h-32" />
            </div>
          </div>

          <div className="p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 bg-white dark:bg-[#0c0c0c] flex items-center gap-5 shadow-sm relative overflow-hidden group">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-[1.25rem] flex items-center justify-center text-indigo-500 ring-4 ring-indigo-500/5 group-hover:scale-110 transition-all duration-300">
              <CalendarDays className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Monthly Income</p>
              <h4 className="text-2xl font-black text-slate-800 dark:text-white mt-2 leading-none">INR {stats.monthly.toLocaleString()}</h4>
            </div>
            <div className="absolute right-0 bottom-0 opacity-[0.03] text-indigo-500 pointer-events-none translate-x-6 translate-y-6">
              <CalendarDays className="w-32 h-32" />
            </div>
          </div>
        </div>

        {/* Search & Control Bar */}
        <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-[#0c0c0c] border border-slate-100 dark:border-white/5 p-4 rounded-[1.5rem] shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              id="mess-search-input"
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members by name or contact number..." 
              className="w-full pl-11 pr-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00] transition-colors"
            />
          </div>
          <button 
            id="refresh-mess-btn"
            onClick={() => { fetchMembers(); fetchStats(); showToast('Data reloaded!'); }}
            className="h-12 w-12 flex items-center justify-center bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white cursor-pointer transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Members Directory Table */}
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-100 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#ff6b00] animate-spin" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading members list...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center opacity-50">
              <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-400 mb-4">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-slate-700 dark:text-white">No Members Found</h4>
              <p className="text-xs text-slate-400 font-bold mt-1">Try modifying your search filter or add a new member registration</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/10 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="p-5 pl-8">Name</th>
                    <th className="p-5">Contact</th>
                    <th className="p-5">Available Meals / Plan Limit</th>
                    <th className="p-5 text-center">Morning (Lunch)</th>
                    <th className="p-5 text-center">Night (Dinner)</th>
                    <th className="p-5 pr-8 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {members.map(member => {
                    const percent = Math.max(0, Math.min(100, (member.available_days / member.total_days) * 100));
                    const isLimitDone = member.available_days <= 0;

                    return (
                      <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                        <td className="p-5 pl-8">
                          <button 
                            onClick={() => openDetailModal(member)}
                            className="font-black text-slate-900 dark:text-white hover:text-[#ff6b00] transition-colors text-left font-sans cursor-pointer focus:outline-none"
                          >
                            {member.full_name}
                          </button>
                          {member.payment_count > 1 && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-wider align-middle">
                              Repeating
                            </span>
                          )}
                          <span className={`block text-[9px] font-black uppercase tracking-wider mt-1 ${member.mess_type === '1_time' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {member.mess_type === '1_time' ? '1 Meal/Day' : '2 Meals/Day'}
                          </span>
                        </td>
                        <td className="p-5 font-mono text-slate-600 dark:text-slate-400">
                          {member.phone}
                        </td>
                        <td className="p-5">
                          <div className="flex items-center gap-3.5 max-w-xs">
                            <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap min-w-[45px]">
                              {member.available_days} / {member.total_days}
                            </span>
                            <div className="w-full bg-slate-100 dark:bg-white/5 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${isLimitDone ? 'bg-rose-500' : percent < 20 ? 'bg-amber-500' : 'bg-[#ff6b00]'}`} 
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-5 text-center">
                          <button
                            id={`morning-mark-btn-${member.id}`}
                            disabled={isLimitDone || member.morning_marked_today}
                            onClick={() => markAttendance(member.id, member.full_name, 'morning')}
                            className={`min-h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 mx-auto ${
                              member.morning_marked_today 
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-not-allowed' 
                                : isLimitDone
                                  ? 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'
                                  : 'bg-orange-50 hover:bg-[#ff6b00]/10 text-[#ff6b00] border border-orange-200/50 cursor-pointer dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10'
                            }`}
                          >
                            {member.morning_marked_today ? (
                              <>
                                <Check className="w-3 h-3" /> Marked
                              </>
                            ) : (
                              'Mark Morning'
                            )}
                          </button>
                        </td>
                        <td className="p-5 text-center">
                          <button
                            id={`night-mark-btn-${member.id}`}
                            disabled={isLimitDone || member.night_marked_today}
                            onClick={() => markAttendance(member.id, member.full_name, 'night')}
                            className={`min-h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 mx-auto ${
                              member.night_marked_today 
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-not-allowed' 
                                : isLimitDone
                                  ? 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'
                                  : 'bg-orange-50 hover:bg-[#ff6b00]/10 text-[#ff6b00] border border-orange-200/50 cursor-pointer dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10'
                            }`}
                          >
                            {member.night_marked_today ? (
                              <>
                                <Check className="w-3 h-3" /> Marked
                              </>
                            ) : (
                              'Mark Night'
                            )}
                          </button>
                        </td>
                        <td className="p-5 pr-8 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            {isLimitDone && (
                              <button 
                                id={`renew-btn-${member.id}`}
                                onClick={() => openRenewModal(member)}
                                className="px-3.5 py-1.5 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600 transition-colors cursor-pointer"
                              >
                                Renew
                              </button>
                            )}
                            {!isLimitDone && (
                              <button 
                                id={`renew-opt-btn-${member.id}`}
                                onClick={() => openRenewModal(member)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                Renew
                              </button>
                            )}
                            <button 
                              id={`edit-btn-${member.id}`}
                              onClick={() => openEditModal(member)}
                              className="p-2 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg cursor-pointer transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              id={`delete-btn-${member.id}`}
                              onClick={() => handleDeleteMember(member.id, member.full_name)}
                              className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Member Detailed History Modal */}
        {selectedMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" id="detail-modal">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMember(null)} />
            <div className="relative w-full max-w-3xl bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-white/10 rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-[#0f0f0f]">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">{selectedMember.full_name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    Contact: {selectedMember.phone} | Registered: {formatDateDDMMYYYY(selectedMember.created_at)}
                  </p>
                </div>
                <button onClick={() => setSelectedMember(null)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full hover:bg-slate-200 dark:hover:bg-white/15 transition-all cursor-pointer focus:outline-none">
                  <X className="w-4 h-4 text-slate-500 dark:text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                
                {/* Financial Summary & Balance Box */}
                <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-[#0f0f0f] p-6 rounded-[1.5rem] border border-slate-100 dark:border-white/5">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan Type</span>
                    <span className="block font-black text-slate-800 dark:text-white mt-1 uppercase text-xs">
                      {selectedMember.mess_type === '1_time' ? '1 Meal/Day' : '2 Meals/Day'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">Received Amount</span>
                    <span className="block font-black text-emerald-500 mt-1 text-xs">
                      INR {selectedMember.amount_received}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">Pending Balance</span>
                    <span className={`block font-black mt-1 text-xs ${selectedMember.pending_amount > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-white'}`}>
                      INR {selectedMember.pending_amount}
                    </span>
                  </div>
                </div>

                {/* History Table */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-white/60 mb-3.5">Recent Attendance Logs (Max 90 Days)</h4>
                  {loadingHistory ? (
                    <div className="h-48 flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 text-[#ff6b00] animate-spin" />
                      <span className="text-xs font-bold text-slate-400 uppercase">Loading logs...</span>
                    </div>
                  ) : memberHistory.length === 0 ? (
                    <div className="h-48 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center opacity-40">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">No attendance registered yet</span>
                    </div>
                  ) : (
                    <div className="border border-slate-100 dark:border-white/5 rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-black/10 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                            <th className="p-4 pl-6">Meal Date</th>
                            <th className="p-4 text-center">Morning (Lunch)</th>
                            <th className="p-4 text-center">Night (Dinner)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-semibold text-slate-700 dark:text-slate-300">
                          {memberHistory.map(row => (
                            <tr key={row.id} className="hover:bg-slate-50/20 dark:hover:bg-white/[0.01]">
                              <td className="p-4 pl-6 font-mono font-bold text-slate-600 dark:text-slate-400">{formatDateDDMMYYYY(row.attendance_date)}</td>
                              <td className="p-4 text-center">
                                {row.morning ? (
                                  <span className="w-5 h-5 inline-flex items-center justify-center bg-emerald-500/10 text-emerald-500 rounded-full font-bold">✓</span>
                                ) : (
                                  <span className="w-5 h-5 inline-flex items-center justify-center text-rose-500/30 rounded-full font-bold">✗</span>
                                )}
                              </td>
                              <td className="p-4 text-center">
                                {row.night ? (
                                  <span className="w-5 h-5 inline-flex items-center justify-center bg-emerald-500/10 text-emerald-500 rounded-full font-bold">✓</span>
                                ) : (
                                  <span className="w-5 h-5 inline-flex items-center justify-center text-rose-500/30 rounded-full font-bold">✗</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Final Calculation Summary */}
                <div className="p-5 border border-slate-100 dark:border-white/5 rounded-2xl flex justify-between items-center bg-slate-50/50 dark:bg-[#0d0d0d]">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meals Consumed</span>
                  <span className="font-black text-slate-800 dark:text-white text-sm">
                    {selectedMember.total_days - selectedMember.available_days} Meals out of {selectedMember.total_days} limit
                  </span>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {isFormModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" id="form-modal">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFormModalOpen(false)} />
            <div className="relative w-full max-w-lg bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-white/10 rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-[#0f0f0f]">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  {editingMember ? 'Edit Member Details' : 'New Member Registration'}
                </h3>
                <button onClick={() => setIsFormModalOpen(false)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full hover:bg-slate-200 dark:hover:bg-white/15 cursor-pointer">
                  <X className="w-4 h-4 text-slate-500 dark:text-white" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-8 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    id="fullName"
                    type="text" 
                    required 
                    value={formFields.fullName}
                    onChange={(e) => setFormFields({...formFields, fullName: e.target.value})}
                    placeholder="Enter full name..." 
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact No</label>
                  <input 
                    id="phone"
                    type="text" 
                    required 
                    value={formFields.phone}
                    onChange={(e) => setFormFields({...formFields, phone: e.target.value})}
                    placeholder="Enter contact number..." 
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mess Plan Type</label>
                  <select 
                    id="messType"
                    value={formFields.messType}
                    onChange={(e) => setFormFields({...formFields, messType: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]"
                  >
                    <option value="1_time">1-Time Mess per Day (30 Meals Limit)</option>
                    <option value="2_time">2-Time Mess per Day (60 Meals Limit)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount Received (INR)</label>
                    <input 
                      id="amountReceived"
                      type="number" 
                      value={formFields.amountReceived}
                      onChange={(e) => setFormFields({...formFields, amountReceived: e.target.value})}
                      placeholder="INR 0"
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pending Amount (INR)</label>
                    <input 
                      id="pendingAmount"
                      type="number" 
                      value={formFields.pendingAmount}
                      onChange={(e) => setFormFields({...formFields, pendingAmount: e.target.value})}
                      placeholder="INR 0"
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]" 
                    />
                  </div>
                </div>

                {editingMember && (
                  <div className="p-5 bg-slate-50 dark:bg-[#0f0f0f] rounded-2xl border border-slate-100 dark:border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#ff6b00]">Add Backdated Attendance</h4>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold leading-normal">Mark morning or night meals for previous dates if forgot. Leftover count will adjust automatically.</p>
                    
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Date</label>
                      <input 
                        type="date" 
                        value={backdateFields.date}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setBackdateFields({...backdateFields, date: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none" 
                      />
                    </div>

                    <div className="flex gap-6 items-center pt-1.5">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={backdateFields.morning}
                          onChange={(e) => setBackdateFields({...backdateFields, morning: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-200 dark:border-white/10 accent-[#ff6b00]"
                        />
                        Morning (Lunch)
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={backdateFields.night}
                          onChange={(e) => setBackdateFields({...backdateFields, night: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-200 dark:border-white/10 accent-[#ff6b00]"
                        />
                        Night (Dinner)
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={submittingBackdate}
                      onClick={handleApplyBackdate}
                      className="w-full min-h-9 flex items-center justify-center bg-[#ff6b00]/10 hover:bg-[#ff6b00]/20 text-[#ff6b00] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submittingBackdate ? 'Recording...' : 'Record Backdated Attendance'}
                    </button>
                  </div>
                )}

                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <button 
                    type="button" 
                    onClick={() => setIsFormModalOpen(false)} 
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 rounded-2xl font-black text-xs hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    id="save-member-submit"
                    type="submit" 
                    className="flex-1 px-6 py-4 bg-[#ff6b00] text-white rounded-2xl font-black text-xs shadow-xl shadow-orange-500/20 hover:scale-[1.02] transition-all uppercase cursor-pointer"
                  >
                    {editingMember ? 'Save Changes' : 'Register Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Renew Plan Modal */}
        {isRenewModalOpen && renewingMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" id="renew-modal">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsRenewModalOpen(false)} />
            <div className="relative w-full max-w-lg bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-white/10 rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-[#0f0f0f]">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">Renew Subscription</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">Adding meals and logging new payment logs for {renewingMember.full_name}</p>
                </div>
                <button onClick={() => setIsRenewModalOpen(false)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full hover:bg-slate-200 transition-all cursor-pointer">
                  <X className="w-4 h-4 text-slate-500 dark:text-white" />
                </button>
              </div>

              <form onSubmit={handleRenewSubmit} className="flex-1 overflow-y-auto p-8 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Renewal Plan Type</label>
                  <select 
                    id="renewMessType"
                    value={renewFields.messType}
                    onChange={(e) => setRenewFields({...renewFields, messType: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]"
                  >
                    <option value="1_time">1-Time Mess per Day (+30 Meals Limit)</option>
                    <option value="2_time">2-Time Mess per Day (+60 Meals Limit)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Amount Received (INR)</label>
                    <input 
                      id="renewAmountReceived"
                      type="number" 
                      required
                      value={renewFields.amountReceived}
                      onChange={(e) => setRenewFields({...renewFields, amountReceived: e.target.value})}
                      placeholder="INR 0"
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Pending Amount (INR)</label>
                    <input 
                      id="renewPendingAmount"
                      type="number" 
                      required
                      value={renewFields.pendingAmount}
                      onChange={(e) => setRenewFields({...renewFields, pendingAmount: e.target.value})}
                      placeholder="INR 0"
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#ff6b00]" 
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <button 
                    type="button" 
                    onClick={() => setIsRenewModalOpen(false)} 
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 rounded-2xl font-black text-xs hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    id="renew-submit"
                    type="submit" 
                    className="flex-1 px-6 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all uppercase cursor-pointer"
                  >
                    Confirm Renewal
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
    </AdminLayout>
  );
}
