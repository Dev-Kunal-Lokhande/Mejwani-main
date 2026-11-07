import React, { useState, useMemo } from 'react';
import {
  Store,
  Shield,
  CreditCard,
  UserCog,
  Save,
  Eye,
  EyeOff,
  Loader2,
  Printer,
  RefreshCw,
  Download,
  AlertTriangle,
  MessageSquare,
  Share2,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../../shared/layouts/AdminLayout';
import { API_BASE } from '../../../shared/services/apiBase';
import { cacheSystemSettings, normalizeSystemSettings } from '../../../shared/services/systemSettings';
import SupportModal from '../../../shared/components/SupportModal';
import { StaffManagementContent } from './Staff';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("SettingsPage Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AdminLayout>
          <div className="max-w-xl mx-auto my-12 p-8 bg-rose-500/10 border border-rose-500/25 rounded-[2.5rem] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-black text-rose-600 dark:text-rose-400">Settings Page Error</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              We encountered a runtime error loading this section: {this.state.error?.message || String(this.state.error)}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-xs"
            >
              Reload Page
            </button>
          </div>
        </AdminLayout>
      );
    }
    return this.props.children;
  }
}

function Loading() {
  return (
    <AdminLayout>
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Loading Settings...</p>
      </div>
    </AdminLayout>
  );
}

export default function SettingsPage() {
  return (
    <ErrorBoundary>
      <SettingsPageInner />
    </ErrorBoundary>
  );
}

function SettingsPageInner() {
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const queryTab = params.get('tab');
    if (queryTab) return queryTab;
    if (window.location.hash) return window.location.hash.replace('#', '');
    return 'profile';
  });

  React.useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get('tab');
      if (queryTab) {
        setActiveTab(queryTab);
      } else if (window.location.hash) {
        setActiveTab(window.location.hash.replace('#', ''));
      }
    };
    window.addEventListener('hashchange', handleLocationChange);
    // Also listen to popstate if react-router triggers popstate
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // System settings state
  const [branding, setBranding] = useState({
    name: '',
    address: '',
    phone: ''
  });
  const [billingSettings, setBillingSettings] = useState({
    gstNumber: '',
    cgst: 2.5,
    sgst: 2.5,
    serviceCharge: 0,
    currencySymbol: '₹'
  });
  const [captainSettings, setCaptainSettings] = useState({
    name: 'Captain'
  });
  const [socialMedia, setSocialMedia] = useState({
    instagramUrl: '',
    googleBusinessUrl: ''
  });
  const [printingSettings, setPrintingSettings] = useState({
    kotTitle: 'KITCHEN ORDER TICKET'
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [settingsMsgType, setSettingsMsgType] = useState('success');

  // Change password state variables
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState('error'); // 'success' | 'error'

  const [agentStatus, setAgentStatus] = useState(null);
  const [fetchingAgent, setFetchingAgent] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [clearingQueue, setClearingQueue] = useState(false);
  const [failedJobs, setFailedJobs] = useState([]);
  const [loadingFailed, setLoadingFailed] = useState(false);

  const [printers, setPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printersError, setPrintersError] = useState(null);
  const [selectedKot, setSelectedKot] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Manual configuration inputs for KOT & Bill printers (supports different printer IPs per hotel)
  const [kotMode, setKotMode] = useState('discovered'); // 'discovered' | 'custom'
  const [kotCustomIp, setKotCustomIp] = useState('');
  const [kotCustomPort, setKotCustomPort] = useState('9100');

  const [billMode, setBillMode] = useState('discovered'); // 'discovered' | 'custom'
  const [billCustomIp, setBillCustomIp] = useState('');
  const [billCustomPort, setBillCustomPort] = useState('9100');

  // Dynamic custom print agent download states
  const [agentDownloadPassword, setAgentDownloadPassword] = useState('');
  const [generatingAgent, setGeneratingAgent] = useState(false);

  const adminUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    } catch (e) {
      return {};
    }
  }, []);
  const adminUsername = adminUser.username || 'Admin';

  const fetchAgentStatus = async () => {
    setFetchingAgent(true);
    try {
      const token = localStorage.getItem('mejwani_admin_jwt');
      const resp = await fetch(`${API_BASE}/print-agent/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok && data && data.success) {
        setAgentStatus(data.agent);
        if (data.agent && data.agent.printer_config) {
          const config = typeof data.agent.printer_config === 'string'
            ? JSON.parse(data.agent.printer_config)
            : data.agent.printer_config;
          setSelectedKot(config?.kot || null);
          setSelectedBill(config?.bill || null);

          if (config?.kot) {
            if (config.kot.isCustom || config.kot.name === 'Custom Network Printer') {
              setKotMode('custom');
              setKotCustomIp(config.kot.ip || config.kot.target?.split(':')[0] || '');
              setKotCustomPort(String(config.kot.port || config.kot.target?.split(':')[1] || '9100'));
            } else {
              setKotMode('discovered');
            }
          } else {
            setKotMode('discovered');
            setKotCustomIp('');
            setKotCustomPort('9100');
          }

          if (config?.bill) {
            if (config.bill.isCustom || config.bill.name === 'Custom Network Printer') {
              setBillMode('custom');
              setBillCustomIp(config.bill.ip || config.bill.target?.split(':')[0] || '');
              setBillCustomPort(String(config.bill.port || config.bill.target?.split(':')[1] || '9100'));
            } else {
              setBillMode('discovered');
            }
          } else {
            setBillMode('discovered');
            setBillCustomIp('');
            setBillCustomPort('9100');
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch agent status', err);
    } finally {
      setFetchingAgent(false);
    }
  };

  const fetchLocalPrinters = async () => {
    setLoadingPrinters(true);
    setPrintersError(null);
    try {
      const resp = await fetch('http://127.0.0.1:9111/printers');
      const data = await resp.json();
      if (data && data.success && Array.isArray(data.printers)) {
        setPrinters(data.printers);
      } else {
        setPrintersError(data?.message || 'Failed to retrieve printer list from local agent.');
      }
    } catch (err) {
      console.error('Failed to discover local printers:', err);
      setPrintersError('Could not connect to local print agent. Please ensure the agent is running.');
    } finally {
      setLoadingPrinters(false);
    }
  };

  const savePrinterConfig = async (kot, bill) => {
    setSavingConfig(true);
    try {
      const token = localStorage.getItem('mejwani_admin_jwt');
      const resp = await fetch(`${API_BASE}/print-agent/config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          printerConfig: { kot, bill }
        })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        toast.success('✅ Printer configuration saved successfully.', { duration: 3000 });
        const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
        const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
        if (hotelId) {
          localStorage.setItem(`mejwani_printer_config_${hotelId}`, JSON.stringify({ kot, bill }));
        }
        fetchAgentStatus();
      } else {
        toast.error('❌ Failed to save printer configuration.');
      }
    } catch (err) {
      console.error('Failed to save printer config:', err);
      toast.error('❌ Failed to save printer configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveHardwareConfig = () => {
    let kotConfig = null;
    if (kotMode === 'custom') {
      if (kotCustomIp.trim()) {
        kotConfig = {
          name: 'Custom Network Printer',
          type: 'network',
          ip: kotCustomIp.trim(),
          port: parseInt(kotCustomPort.trim(), 10) || 9100,
          target: `${kotCustomIp.trim()}:${kotCustomPort.trim() || '9100'}`,
          isCustom: true
        };
      }
    } else {
      kotConfig = selectedKot;
    }

    let billConfig = null;
    if (billMode === 'custom') {
      if (billCustomIp.trim()) {
        billConfig = {
          name: 'Custom Network Printer',
          type: 'network',
          ip: billCustomIp.trim(),
          port: parseInt(billCustomPort.trim(), 10) || 9100,
          target: `${billCustomIp.trim()}:${billCustomPort.trim() || '9100'}`,
          isCustom: true
        };
      }
    } else {
      billConfig = selectedBill;
    }

    savePrinterConfig(kotConfig, billConfig);
  };

  const handleDownloadCustomAgent = async () => {
    if (!agentDownloadPassword) return;
    setGeneratingAgent(true);
    try {
      const token = localStorage.getItem('mejwani_admin_jwt');
      const response = await fetch(`${API_BASE}/print-agent/download-custom`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: agentDownloadPassword })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mejwani-print-agent-${adminUsername}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success('✅ Custom print agent package generated successfully.');
        setAgentDownloadPassword(''); // Clear password
      } else {
        const data = await response.json();
        toast.error(`❌ Failed: ${data.message || 'Invalid password.'}`);
      }
    } catch (err) {
      console.error('Failed to download custom agent:', err);
      toast.error('❌ Failed to download custom print agent.');
    } finally {
      setGeneratingAgent(false);
    }
  };

  const triggerTestPrint = async () => {
    setTestingPrint(true);
    try {
      const token = localStorage.getItem('mejwani_admin_jwt');
      const resp = await fetch(`${API_BASE}/print-agent/test-print`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        toast.success('Test print job queued successfully!', { duration: 3000 });
      } else {
        toast.error(data.message || 'Failed to trigger test print.');
      }
    } catch (err) {
      toast.error('Network error triggering test print.');
    } finally {
      setTestingPrint(false);
    }
  };

  const handleClearQueue = async () => {
    const confirmed = window.confirm('Are you sure you want to clear all pending and in-progress print jobs? This action cannot be undone.');
    if (!confirmed) return;

    setClearingQueue(true);
    try {
      const token = localStorage.getItem('mejwani_admin_jwt');
      const resp = await fetch(`${API_BASE}/print-agent/clear-pending`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        toast.success(data.message || 'Pending print queue cleared successfully!', { duration: 3000 });
        fetchFailedJobs();
      } else {
        toast.error(data.message || 'Failed to clear print queue.');
      }
    } catch (err) {
      console.error('Failed to clear print queue:', err);
      toast.error('Network error clearing print queue.');
    } finally {
      setClearingQueue(false);
    }
  };

  const fetchFailedJobs = async () => {
    setLoadingFailed(true);
    try {
      const token = localStorage.getItem('mejwani_admin_jwt');
      const resp = await fetch(`${API_BASE}/print-agent/failed-jobs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setFailedJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch failed print jobs:', err);
    } finally {
      setLoadingFailed(false);
    }
  };

  const handleRetryJob = async (jobId) => {
    try {
      const token = localStorage.getItem('mejwani_admin_jwt');
      const resp = await fetch(`${API_BASE}/print-agent/retry-job`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jobId })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        toast.success('Job queued for retry successfully!', { duration: 3000 });
        fetchFailedJobs();
        fetchAgentStatus();
      } else {
        toast.error(data.message || 'Failed to retry job.');
      }
    } catch (err) {
      console.error('Failed to retry job:', err);
      toast.error('Network error retrying job.');
    }
  };

  React.useEffect(() => {
    if (activeTab === 'printer') {
      fetchAgentStatus();
      fetchLocalPrinters();
      fetchFailedJobs();
    }
  }, [activeTab]);

  const isAgentOnline = agentStatus?.isAgentOnline || (agentStatus?.status === 'ONLINE' && agentStatus?.is_online);

  const getPrinterStatus = (selectedPrinter, type = null) => {
    if (!isAgentOnline || !selectedPrinter) return 'OFFLINE';
    if (type && agentStatus && agentStatus.printer_status) {
      try {
        const statusObj = typeof agentStatus.printer_status === 'string'
          ? JSON.parse(agentStatus.printer_status)
          : agentStatus.printer_status;
        if (statusObj && statusObj[type]) {
          return statusObj[type];
        }
      } catch (e) {}
    }
    const found = Array.isArray(printers) ? printers.find(p => p?.name === selectedPrinter?.name) : null;
    return (found && found.online) ? 'ONLINE' : 'OFFLINE';
  };

  const getDropdownOptions = (selectedPrinter) => {
    const options = Array.isArray(printers) ? [...printers] : [];
    if (selectedPrinter && !options.some(p => p?.name === selectedPrinter?.name)) {
      options.push({
        ...selectedPrinter,
        online: false
      });
    }
    return options;
  };

  const handleSelectKotChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setSelectedKot(null);
      return;
    }
    const found = printers.find(p => p.name === val) || (selectedKot && selectedKot.name === val ? selectedKot : null);
    if (found) {
      setSelectedKot({
        name: found.name,
        type: found.type,
        target: found.type === 'network' ? `${found.ip}:${found.port || 9100}` : found.name
      });
    }
  };

  const handleSelectBillChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setSelectedBill(null);
      return;
    }
    const found = printers.find(p => p.name === val) || (selectedBill && selectedBill.name === val ? selectedBill : null);
    if (found) {
      setSelectedBill({
        name: found.name,
        type: found.type,
        target: found.type === 'network' ? `${found.ip}:${found.port || 9100}` : found.name
      });
    }
  };

  const tabs = [
    { id: 'profile', label: 'Restaurant Profile', icon: Store },
    { id: 'billing', label: 'Taxes & Billing', icon: CreditCard },
    { id: 'captain', label: 'Captain Configuration', icon: UserCog },
    { id: 'printer', label: 'Printer Settings', icon: Printer },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'staff', label: 'Staff Management', icon: Users },
    { id: 'social', label: 'Social Media', icon: Share2 },
    { id: 'helpdesk', label: 'Help Desk', icon: MessageSquare },
  ];

  // Load current system settings on mount
  React.useEffect(() => {
    (async () => {
      setSettingsLoading(true);
      try {
        const token = localStorage.getItem('mejwani_admin_jwt');
        const resp = await fetch(`${API_BASE}/admin/system-settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (resp.ok && data.success && data.data) {
          const normalized = cacheSystemSettings(data.data);
          const b = normalized.branding || {};
          const bill = normalized.billing || {};
          const captain = normalized.captain || {};
          const social = normalized.socialMedia || {};
          const print = normalized.printing || {};
          setBranding((prev) => ({...prev, ...b}));
          setBillingSettings((prev) => ({...prev, ...bill}));
          setCaptainSettings((prev) => ({...prev, ...captain}));
          setSocialMedia((prev) => ({...prev, ...social}));
          setPrintingSettings((prev) => ({...prev, ...print}));
        } else {
          // try to read cache
          const cached = localStorage.getItem('mejwani_settings');
          if (cached) {
            const parsed = normalizeSystemSettings(JSON.parse(cached));
            setBranding((prev) => ({...prev, ...(parsed.branding||{})}));
            setBillingSettings((prev) => ({...prev, ...(parsed.billing||{})}));
            setCaptainSettings((prev) => ({...prev, ...(parsed.captain||{})}));
            setSocialMedia((prev) => ({...prev, ...(parsed.socialMedia||{})}));
            setPrintingSettings((prev) => ({...prev, ...(parsed.printing||{})}));
          }
        }
      } catch (e) {
        console.warn('Failed to load system settings', e);
        const cached = localStorage.getItem('mejwani_settings');
        if (cached) {
          const parsed = normalizeSystemSettings(JSON.parse(cached));
          setBranding((prev) => ({...prev, ...(parsed.branding||{})}));
          setBillingSettings((prev) => ({...prev, ...(parsed.billing||{})}));
          setCaptainSettings((prev) => ({...prev, ...(parsed.captain||{})}));
          setSocialMedia((prev) => ({...prev, ...(parsed.socialMedia||{})}));
          setPrintingSettings((prev) => ({...prev, ...(parsed.printing||{})}));
        }
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, []);

  const saveSystemSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      const token = localStorage.getItem('mejwani_admin_jwt');
      const payload = normalizeSystemSettings({ branding, billing: billingSettings, captain: captainSettings, socialMedia, printing: printingSettings });
      const resp = await fetch(`${API_BASE}/admin/system-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        const normalized = cacheSystemSettings(data.data);
        setBranding(normalized.branding);
        setBillingSettings(normalized.billing);
        setCaptainSettings(normalized.captain);
        setSocialMedia(normalized.socialMedia);
        setPrintingSettings(normalized.printing);
        setSettingsMsgType('success');
        setSettingsMsg('Settings saved. Future bills and receipts will use these values.');
      } else {
        setSettingsMsgType('error');
        setSettingsMsg(data.message || 'Failed to save settings.');
      }
    } catch (e) {
      console.error(e);
      setSettingsMsgType('error');
      setSettingsMsg('Unable to connect to settings server.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setAlertType('error');
      setAlertMsg('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setAlertType('error');
      setAlertMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setAlertType('error');
      setAlertMsg('New password and confirm password do not match.');
      return;
    }

    setLoading(true);
    setAlertMsg('');

    try {
      const token = localStorage.getItem('mejwani_admin_jwt');

      const response = await fetch(`${API_BASE}/admin/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setLoading(false);
        setAlertType('error');
        setAlertMsg(data.message || 'Failed to change password. Please verify current password.');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setLoading(false);
      setAlertType('success');
      setAlertMsg('Password updated successfully! Future logins require your new password.');

    } catch (error) {
      console.error('Error updating password:', error);
      setLoading(false);
      setAlertType('error');
      setAlertMsg('Unable to connect to authentication server. Please verify the backend is running.');
    }
  };

  const isLoading = settingsLoading;
  if (isLoading) return <Loading />;

  if (!branding || !billingSettings || !captainSettings) {
    return (
      <AdminLayout>
        <div className="max-w-xl mx-auto my-12 p-8 bg-rose-500/10 border border-rose-500/25 rounded-[2.5rem] text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-black text-rose-600 dark:text-rose-400">Settings Configuration Unavailable</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
            We encountered an error loading your restaurant configuration details. Please verify your connection to the server and retry.
          </p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:scale-105 active:scale-95 transition-all">
            Retry Loading Page
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">Settings</h3>
          <p className="text-slate-500 dark:text-white/40 text-sm font-bold">Manage your restaurant configuration and preferences</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Tabs Sidebar */}
          <div className="w-full lg:w-72 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-black text-sm
                  ${activeTab === tab.id 
                    ? 'bg-primary text-white shadow-xl shadow-primary/20' 
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}
                `}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Settings Content */}
          <div className="flex-1 bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-sm">
            {activeTab === 'profile' && (
              <div className="p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-5 pb-8 border-b border-slate-100 dark:border-white/5">
                  <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center ring-4 ring-primary/5">
                    <Store className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">Restaurant Profile</h4>
                    <p className="text-xs text-slate-500 dark:text-white/40 font-bold mt-1 uppercase tracking-widest">Used on printed receipts</p>
                  </div>
                </div>

                {settingsMsg && (
                  <div className={`p-5 rounded-2xl text-xs font-bold leading-relaxed border ${settingsMsgType === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-500'}`}>
                    {settingsMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">Restaurant Name</label>
                    <input disabled={settingsLoading} value={branding.name} onChange={(e) => setBranding({...branding, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">Address</label>
                    <textarea disabled={settingsLoading} rows="3" value={branding.address} onChange={(e) => setBranding({...branding, address: e.target.value})} className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">Phone Number</label>
                    <input disabled={settingsLoading} value={branding.phone} onChange={(e) => setBranding({...branding, phone: e.target.value})} className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">KOT Print Title</label>
                    <input disabled={settingsLoading} value={printingSettings.kotTitle} onChange={(e) => setPrintingSettings({...printingSettings, kotTitle: e.target.value})} placeholder="e.g. KITCHEN ORDER TICKET" className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <button disabled={savingSettings || settingsLoading} onClick={saveSystemSettings} className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:scale-100">
                    {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {savingSettings ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {settingsMsg && (
                  <div className={`p-5 rounded-2xl text-xs font-bold leading-relaxed border ${settingsMsgType === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-500'}`}>
                    {settingsMsg}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">GST Number</label>
                    <input disabled={settingsLoading} value={billingSettings.gstNumber} onChange={(e) => setBillingSettings({...billingSettings, gstNumber: e.target.value})} className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">CGST (%)</label>
                    <input disabled={settingsLoading} type="number" min="0" max="100" step="0.01" value={billingSettings.cgst} onChange={(e) => setBillingSettings({...billingSettings, cgst: e.target.value})} className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">SGST (%)</label>
                    <input disabled={settingsLoading} type="number" min="0" max="100" step="0.01" value={billingSettings.sgst} onChange={(e) => setBillingSettings({...billingSettings, sgst: e.target.value})} className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">Service Charge (%)</label>
                    <input disabled={settingsLoading} type="number" min="0" max="100" step="0.01" value={billingSettings.serviceCharge} onChange={(e) => setBillingSettings({...billingSettings, serviceCharge: e.target.value})} className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">Currency Symbol</label>
                    <input disabled={settingsLoading} value={billingSettings.currencySymbol} onChange={(e) => setBillingSettings({...billingSettings, currencySymbol: e.target.value})} maxLength={4} className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <button disabled={savingSettings || settingsLoading} onClick={saveSystemSettings} className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:scale-100">
                    {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {savingSettings ? 'Saving...' : 'Save Billing Info'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'captain' && (
              <div className="p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-5 pb-8 border-b border-slate-100 dark:border-white/5">
                  <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center ring-4 ring-primary/5">
                    <UserCog className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">Captain Configuration</h4>
                    <p className="text-xs text-slate-500 dark:text-white/40 font-bold mt-1 uppercase tracking-widest">Used across captain tickets and kitchen views</p>
                  </div>
                </div>

                {settingsMsg && (
                  <div className={`p-5 rounded-2xl text-xs font-bold leading-relaxed border ${settingsMsgType === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-500'}`}>
                    {settingsMsg}
                  </div>
                )}

                <div className="max-w-xl space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">Captain Name</label>
                  <input disabled={settingsLoading} value={captainSettings.name} onChange={(e) => setCaptainSettings({...captainSettings, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                </div>

                <div className="pt-6 flex justify-end">
                  <button disabled={savingSettings || settingsLoading} onClick={saveSystemSettings} className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:scale-100">
                    {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {savingSettings ? 'Saving...' : 'Save Captain Name'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-5 pb-8 border-b border-slate-100 dark:border-white/5">
                  <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center ring-4 ring-primary/5">
                    <Shield className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">Security Settings</h4>
                    <p className="text-xs text-slate-500 dark:text-white/40 font-bold mt-1 uppercase tracking-widest">Update your administrator password</p>
                  </div>
                </div>

                {alertMsg && (
                  <div className={`p-5 rounded-2xl text-xs font-bold leading-relaxed border transition-all duration-300 ${
                    alertType === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 shadow-md shadow-emerald-500/5'
                      : 'bg-red-500/10 border-red-500/25 text-red-500 shadow-md shadow-red-500/5'
                  }`}>
                    {alertMsg}
                  </div>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-6 max-w-xl">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={loading}
                        className="w-full px-5 py-4 pr-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/60 transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">
                      New Password (minimum 8 characters)
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={loading}
                        className="w-full px-5 py-4 pr-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/60 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={loading}
                        className="w-full px-5 py-4 pr-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/60 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                      className={`flex items-center gap-2.5 px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer ${
                        (loading || !currentPassword || !newPassword || !confirmPassword) && 'opacity-50 cursor-not-allowed hover:scale-100 active:scale-100 shadow-none'
                      }`}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          Update Password
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'printer' && (
              <div className="p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between pb-8 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center ring-4 ring-primary/5">
                      <Printer className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900 dark:text-white">Printer Configuration</h4>
                      <p className="text-xs text-slate-500 dark:text-white/40 font-bold mt-1 uppercase tracking-widest">Windows Print Agent & Hardware settings</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      fetchAgentStatus();
                      fetchLocalPrinters();
                    }} 
                    disabled={fetchingAgent || loadingPrinters}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                    title="Refresh status & scan printers"
                  >
                    <RefreshCw className={`w-4 h-4 ${(fetchingAgent || loadingPrinters) ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Status Card */}
                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
                    <h5 className="font-black text-slate-900 dark:text-white text-sm mb-4">Connection & Heartbeat</h5>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Agent Status</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] capitalize ${
                          agentStatus?.status === 'ONLINE' && agentStatus?.is_online
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                            : 'bg-slate-500/10 text-slate-500'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            agentStatus?.status === 'ONLINE' && agentStatus?.is_online
                              ? 'bg-emerald-500 animate-pulse'
                              : 'bg-slate-400'
                          }`}></span>
                          {agentStatus?.status === 'ONLINE' && agentStatus?.is_online
                            ? `ONLINE (v${agentStatus?.version || ''})`
                            : 'OFFLINE'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Last Seen</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {agentStatus?.last_seen_at ? new Date(agentStatus.last_seen_at).toLocaleString() : 'Never'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={triggerTestPrint}
                          disabled={testingPrint || !agentStatus || agentStatus?.status !== 'ONLINE' || !agentStatus?.is_online}
                          className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-xs shadow-lg shadow-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                        >
                          {testingPrint ? 'Printing...' : 'Trigger Test Print'}
                        </button>
                        <button
                          onClick={handleClearQueue}
                          disabled={clearingQueue || !agentStatus || agentStatus?.status !== 'ONLINE' || !agentStatus?.is_online}
                          className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-500/15 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                        >
                          {clearingQueue ? 'Clearing...' : 'Clear Pending Queue'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Configured Hardware / Dropdown Card */}
                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
                    <h5 className="font-black text-slate-900 dark:text-white text-sm mb-4">Hardware Mappings</h5>
                    
                    {loadingPrinters ? (
                      <div className="h-32 flex flex-col items-center justify-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        Scanning printers...
                      </div>
                    ) : printersError ? (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-500 text-xs font-bold space-y-2">
                        <p>{printersError}</p>
                        <button onClick={fetchLocalPrinters} className="text-[10px] underline uppercase tracking-wider block font-black">
                          Retry Scan
                        </button>
                      </div>
                                        ) : (
                      <div className="space-y-4">
                        {/* KOT PRINTER MAPPING */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">KOT Printer</label>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setKotMode('discovered')}
                                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition ${kotMode === 'discovered' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/60'}`}
                              >
                                Discovered
                              </button>
                              <button
                                type="button"
                                onClick={() => setKotMode('custom')}
                                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition ${kotMode === 'custom' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/60'}`}
                              >
                                Manual IP
                              </button>
                            </div>
                          </div>

                          {kotMode === 'custom' ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-xl">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest ml-1">IP Address</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. 192.168.1.100"
                                    value={kotCustomIp}
                                    onChange={(e) => setKotCustomIp(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-lg font-bold text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest ml-1">Port</label>
                                  <input
                                    type="text"
                                    placeholder="9100"
                                    value={kotCustomPort}
                                    onChange={(e) => setKotCustomPort(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-lg font-bold text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                              </div>
                              {selectedKot && selectedKot.isCustom && (
                                <div className="flex justify-between items-center px-1 text-[10px] font-bold text-slate-450 dark:text-slate-400">
                                  <span>Manual Target: {selectedKot.target}</span>
                                  <span className={getPrinterStatus(selectedKot, 'kot') === 'ONLINE' ? 'text-emerald-500' : 'text-rose-500'}>
                                    {getPrinterStatus(selectedKot, 'kot')}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <select
                                value={selectedKot?.name || ''}
                                onChange={handleSelectKotChange}
                                className="w-full px-4 py-3 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                              >
                                <option value="">Not Configured</option>
                                {getDropdownOptions(selectedKot).map(p => (
                                  <option key={p.name} value={p.name}>
                                    {p.name} ({p.type === 'network' ? `Network: ${p.ip}` : 'Local/USB'}) - {getPrinterStatus(p)}
                                  </option>
                                ))}
                              </select>
                              {selectedKot && (
                                <div className="flex justify-between items-center px-1 text-[10px] font-bold text-slate-450 dark:text-slate-400">
                                  <span>Type: {selectedKot.type} | Target: {selectedKot.target}</span>
                                  <span className={getPrinterStatus(selectedKot, 'kot') === 'ONLINE' ? 'text-emerald-500' : 'text-rose-500'}>
                                    {getPrinterStatus(selectedKot, 'kot')}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* BILL PRINTER MAPPING */}
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">Bill Printer</label>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setBillMode('discovered')}
                                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition ${billMode === 'discovered' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/60'}`}
                              >
                                Discovered
                              </button>
                              <button
                                type="button"
                                onClick={() => setBillMode('custom')}
                                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition ${billMode === 'custom' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/60'}`}
                              >
                                Manual IP
                              </button>
                            </div>
                          </div>

                          {billMode === 'custom' ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-xl">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest ml-1">IP Address</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. 192.168.1.100"
                                    value={billCustomIp}
                                    onChange={(e) => setBillCustomIp(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-lg font-bold text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest ml-1">Port</label>
                                  <input
                                    type="text"
                                    placeholder="9100"
                                    value={billCustomPort}
                                    onChange={(e) => setBillCustomPort(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-lg font-bold text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                              </div>
                              {selectedBill && selectedBill.isCustom && (
                                <div className="flex justify-between items-center px-1 text-[10px] font-bold text-slate-450 dark:text-slate-400">
                                  <span>Manual Target: {selectedBill.target}</span>
                                  <span className={getPrinterStatus(selectedBill, 'bill') === 'ONLINE' ? 'text-emerald-500' : 'text-rose-500'}>
                                    {getPrinterStatus(selectedBill, 'bill')}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <select
                                value={selectedBill?.name || ''}
                                onChange={handleSelectBillChange}
                                className="w-full px-4 py-3 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                              >
                                <option value="">Not Configured</option>
                                {getDropdownOptions(selectedBill).map(p => (
                                  <option key={p.name} value={p.name}>
                                    {p.name} ({p.type === 'network' ? `Network: ${p.ip}` : 'Local/USB'}) - {getPrinterStatus(p)}
                                  </option>
                                ))}
                              </select>
                              {selectedBill && (
                                <div className="flex justify-between items-center px-1 text-[10px] font-bold text-slate-450 dark:text-slate-400">
                                  <span>Type: {selectedBill.type} | Target: {selectedBill.target}</span>
                                  <span className={getPrinterStatus(selectedBill, 'bill') === 'ONLINE' ? 'text-emerald-500' : 'text-rose-500'}>
                                    {getPrinterStatus(selectedBill, 'bill')}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="pt-2">
                          <button
                            onClick={handleSaveHardwareConfig}
                            disabled={savingConfig}
                            className="w-full px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-xs shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                          >
                            {savingConfig ? 'Saving Configurations...' : 'Save Hardware Configurations'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Onboarding Guide Card */}
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] space-y-4">
                  <h5 className="font-black text-slate-900 dark:text-white text-sm">Mejwani Print Agent Installation</h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    To bypass browser manual dialog confirmations and enable automatic kitchen tickets, follow these simple setup instructions:
                  </p>
                  <div className="grid gap-4 md:grid-cols-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.01]">
                      <p className="font-black text-slate-900 dark:text-white mb-2">1. Download Custom Agent</p>
                      <div className="space-y-2 mt-1">
                        <p className="text-[10px] text-slate-400">
                          Username: <span className="font-mono font-bold text-slate-800 dark:text-white">{adminUsername}</span>. Enter your password to package the agent dynamically:
                        </p>
                        <input
                          type="password"
                          placeholder="Verify Password..."
                          value={agentDownloadPassword}
                          onChange={(e) => setAgentDownloadPassword(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={handleDownloadCustomAgent}
                          disabled={generatingAgent || !agentDownloadPassword}
                          className="w-full py-1.5 bg-[#ff6b00] hover:bg-[#e66000] text-white rounded-lg font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                        >
                          {generatingAgent ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Packaging...
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" /> Get Custom ZIP (.zip)
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.01]">
                      <p className="font-black text-slate-900 dark:text-white mb-1">2. Run Setup</p>
                      <p className="text-[11px] text-slate-400">
                        Launch the program on a local Windows PC. Enter your hotel ID and admin password to register the background service.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.01]">
                      <p className="font-black text-slate-900 dark:text-white mb-1">3. Configure Printers</p>
                      <p className="text-[11px] text-slate-400">
                        Map KOT to your local kitchen IP printer and Bill to your USB/Spooler printer name. The agent runs silently on startup!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Failed Print Queue Card */}
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-black text-slate-900 dark:text-white text-sm">Failed Print Queue</h5>
                    <button 
                      onClick={fetchFailedJobs} 
                      disabled={loadingFailed}
                      className="text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white text-xs font-bold flex items-center gap-1 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingFailed ? 'animate-spin' : ''}`} />
                      Refresh Log
                    </button>
                  </div>
                  
                  {loadingFailed ? (
                    <div className="py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      Loading failed queue...
                    </div>
                  ) : failedJobs.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-white/30 italic">No failed print jobs detected.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-white/5 text-slate-400 dark:text-white/40 uppercase text-[9px] tracking-wider font-black">
                            <th className="py-2.5">Job Type</th>
                            <th className="py-2.5">Error Detail</th>
                            <th className="py-2.5">Retries</th>
                            <th className="py-2.5">Time</th>
                            <th className="py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {failedJobs.map(job => (
                            <tr key={job.id} className="border-b border-slate-100 dark:border-white/[0.02] hover:bg-white/5 font-medium text-slate-700 dark:text-slate-350">
                              <td className="py-3 font-bold">{job.job_type}</td>
                              <td className="py-3 max-w-xs truncate text-slate-400 dark:text-white/45" title={job.error_message}>{job.error_message || 'Unknown error'}</td>
                              <td className="py-3 font-black text-rose-500">{job.retry_count}/3</td>
                              <td className="py-3 text-[11px] text-slate-400 dark:text-white/30">{new Date(job.created_at).toLocaleString()}</td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => handleRetryJob(job.id)}
                                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all"
                                >
                                  Retry Job
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'social' && (
              <div className="p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-5 pb-8 border-b border-slate-100 dark:border-white/5">
                  <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center ring-4 ring-primary/5">
                    <Share2 className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">Social Media Settings</h4>
                    <p className="text-xs text-slate-500 dark:text-white/40 font-bold mt-1 uppercase tracking-widest">Configure links for customer waiting screens</p>
                  </div>
                </div>

                {settingsMsg && (
                  <div className={`p-5 rounded-2xl text-xs font-bold leading-relaxed border ${settingsMsgType === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-500'}`}>
                    {settingsMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">Instagram URL</label>
                    <input disabled={settingsLoading} value={socialMedia.instagramUrl} onChange={(e) => setSocialMedia({...socialMedia, instagramUrl: e.target.value})} placeholder="https://instagram.com/your-hotel" className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-white/60 uppercase tracking-widest ml-1">Google Business URL (Reviews)</label>
                    <input disabled={settingsLoading} value={socialMedia.googleBusinessUrl} onChange={(e) => setSocialMedia({...socialMedia, googleBusinessUrl: e.target.value})} placeholder="https://g.page/r/your-hotel/review" className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-2xl font-bold text-slate-800 dark:text-white placeholder-slate-400/60 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all" />
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <button disabled={savingSettings || settingsLoading} onClick={saveSystemSettings} className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:scale-100">
                    {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {savingSettings ? 'Saving...' : 'Save Social Settings'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'helpdesk' && (
              <div className="p-4 sm:p-8 md:p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 flex justify-center">
                <SupportModal isOpen={true} onClose={() => setActiveTab('profile')} />
              </div>
            )}

            {activeTab === 'staff' && (
              <div className="p-4 sm:p-8 md:p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <StaffManagementContent />
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
