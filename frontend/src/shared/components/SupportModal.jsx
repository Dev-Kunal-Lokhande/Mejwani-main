import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE, authorizedFetch } from '../services/apiBase';

export default function SupportModal({ isOpen, onClose }) {
  const [hotelInfo, setHotelInfo] = useState({
    name: '',
    owner_name: '',
    email: '',
    phone: ''
  });
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Technical Issue');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [fetchingInfo, setFetchingInfo] = useState(false);

  const categories = [
    'Login Issue',
    'Billing',
    'Printer',
    'KOT',
    'QR Menu',
    'Staff',
    'Subscription',
    'Feature Request',
    'Technical Issue',
    'Other'
  ];

  // Fetch hotel info when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchHotelInfo();
    }
  }, [isOpen]);

  const fetchHotelInfo = async () => {
    setFetchingInfo(true);
    try {
      const resp = await authorizedFetch(`${API_BASE}/support/hotel-info`);
      const data = await resp.json();
      if (resp.ok && data.success) {
        setHotelInfo(data.data);
      } else {
        // Fallback from localStorage
        const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
        setHotelInfo({
          name: adminUser.hotel_name || '',
          owner_name: adminUser.username || '',
          email: '',
          phone: ''
        });
      }
    } catch (err) {
      console.error('Failed to load hotel info:', err);
    } finally {
      setFetchingInfo(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Only image attachments (screenshots) are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit.');
      return;
    }

    setScreenshot(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!subject.trim()) {
      toast.error('Please enter a subject.');
      return;
    }
    if (!message.trim()) {
      toast.error('Please describe your issue in the message.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('subject', subject.trim());
    formData.append('category', category);
    formData.append('message', message.trim());
    if (screenshot) {
      formData.append('screenshot', screenshot);
    }

    try {
      const token = localStorage.getItem('mejwani_admin_jwt');
      const response = await fetch(`${API_BASE}/support/tickets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(`Support Ticket Submitted: ${data.data.ticket_number}`);
        // Reset fields
        setSubject('');
        setCategory('Technical Issue');
        setMessage('');
        setScreenshot(null);
        setScreenshotPreview('');
        onClose();
      } else {
        toast.error(data.message || 'Failed to submit ticket. Please try again.');
      }
    } catch (err) {
      console.error('Submit ticket error:', err);
      toast.error('Network error. Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full flex items-center justify-center p-1 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff6b00] animate-pulse" />
            <h2 className="text-xl font-bold tracking-tight text-white">Contact Mejwani Support Center</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Autoprepended fields (ReadOnly style but visual) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-400">
            <div>
              <span className="block font-bold text-slate-500 uppercase tracking-wider mb-0.5">Hotel Name</span>
              <span className="font-bold text-slate-200">{fetchingInfo ? 'Loading...' : hotelInfo.name}</span>
            </div>
            <div>
              <span className="block font-bold text-slate-500 uppercase tracking-wider mb-0.5">Admin Contact</span>
              <span className="font-bold text-slate-200">{fetchingInfo ? 'Loading...' : hotelInfo.owner_name}</span>
            </div>
            <div>
              <span className="block font-bold text-slate-500 uppercase tracking-wider mb-0.5">Sender Email</span>
              <span className="font-bold text-slate-200">{fetchingInfo ? 'Loading...' : (hotelInfo.email || 'N/A')}</span>
            </div>
            <div>
              <span className="block font-bold text-slate-500 uppercase tracking-wider mb-0.5">Phone Number</span>
              <span className="font-bold text-slate-200">{fetchingInfo ? 'Loading...' : (hotelInfo.phone || 'N/A')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Category selection */}
            <div className="md:col-span-1 space-y-2">
              <label className="block text-sm font-bold text-slate-300">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 font-bold text-sm text-slate-200 focus:outline-none focus:border-[#ff6b00] cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-bold text-slate-300">Subject</label>
              <input
                type="text"
                placeholder="What issue are you experiencing?"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
                required
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 font-bold text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#ff6b00]"
              />
            </div>
          </div>

          {/* Message Textarea */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-bold text-slate-300">Describe the Issue</label>
              <span className={`text-xs font-semibold ${message.length > 900 ? 'text-amber-500' : 'text-slate-500'}`}>
                {message.length} / 1000 characters
              </span>
            </div>
            <textarea
              placeholder="Please provide details about the issue you are facing so our technical team can assist you."
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              rows={5}
              required
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 font-medium text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#ff6b00] resize-none"
            />
          </div>

          {/* Screenshot Upload / Attachment */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-300">Attach Screenshot (Optional)</label>
            
            {!screenshotPreview ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-[#ff6b00]/50 rounded-xl p-6 bg-slate-950/40 hover:bg-slate-950 transition-colors duration-150 cursor-pointer">
                <Upload className="w-8 h-8 text-slate-500 mb-2 group-hover:text-slate-300" />
                <span className="text-sm font-bold text-slate-300">Click to upload screenshot</span>
                <span className="text-xs text-slate-500 mt-1">PNG, JPG, JPEG up to 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="flex items-center gap-4 p-4 bg-slate-950/60 rounded-xl border border-white/10">
                <img
                  src={screenshotPreview}
                  alt="Attachment Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-white/10 bg-slate-900"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-200 truncate">{screenshot?.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{(screenshot?.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveScreenshot}
                  className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer Actions */}
        <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-3 border border-white/10 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || fetchingInfo}
            className="px-6 py-3 bg-[#ff6b00] hover:bg-[#ff6b00]/90 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Submitting...
              </>
            ) : 'Submit Ticket'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
