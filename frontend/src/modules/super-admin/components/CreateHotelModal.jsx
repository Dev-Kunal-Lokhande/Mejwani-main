import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Copy, Check, Mail, MailX } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSuperAdminToken } from '../services/superAdminApi';
import { API_BASE } from '../../../shared/services/apiBase';

export default function CreateHotelModal({ isOpen, onClose, onSuccess }) {
  const defaultFormState = {
    name: '',
    owner_name: '',
    email: '',
    phone: '',
    address: '',
    plan: 'Enterprise',
    status: 'active',
    cover_image: '',
    qr_pamphlet: '',
  };

  const [formData, setFormData] = useState(defaultFormState);
  const coverImageFileRef = useRef(null);
  const qrPamphletFileRef = useRef(null);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [qrPamphletFile, setQrPamphletFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [emailSent, setEmailSent] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setFormData(defaultFormState);
    coverImageFileRef.current = null;
    qrPamphletFileRef.current = null;
    setCoverImageFile(null);
    setQrPamphletFile(null);
    setCreatedCredentials(null);
    setEmailSent(null);
    setCopied(false);
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Convert File to Base64 String for preview and track the file object
  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    console.log(`[CreateHotelModal] File selected - Field: ${fieldName}, File name: ${file ? file.name : 'none'}, Size: ${file ? file.size : 0} bytes`);
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      console.warn(`[CreateHotelModal] File size exceeds 2MB limit for field ${fieldName}`);
      toast.error('File size should not exceed 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      console.log(`[CreateHotelModal] FileReader loaded data URL for field ${fieldName}. Data URL prefix:`, reader.result ? reader.result.slice(0, 50) : 'null');
      setFormData((prev) => ({ ...prev, [fieldName]: reader.result }));
    };
    reader.readAsDataURL(file);

    if (fieldName === 'cover_image') {
      console.log(`[CreateHotelModal] Setting coverImageFile ref+state:`, file.name);
      coverImageFileRef.current = file;
      setCoverImageFile(file);
    } else if (fieldName === 'qr_pamphlet') {
      console.log(`[CreateHotelModal] Setting qrPamphletFile ref+state:`, file.name);
      qrPamphletFileRef.current = file;
      setQrPamphletFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    console.log('[CreateHotelModal] Form submitted!');
    console.log('[CreateHotelModal] Text fields:', {
      name: formData.name,
      owner_name: formData.owner_name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      plan: formData.plan,
      status: formData.status,
    });
    console.log('[CreateHotelModal] Files in state:', {
      coverImageFile: coverImageFile ? coverImageFile.name : null,
      qrPamphletFile: qrPamphletFile ? qrPamphletFile.name : null,
    });

    const formDataPayload = new FormData();
    formDataPayload.append('name', formData.name);
    formDataPayload.append('owner_name', formData.owner_name);
    formDataPayload.append('email', formData.email);
    formDataPayload.append('phone', formData.phone);
    formDataPayload.append('address', formData.address);
    formDataPayload.append('plan', formData.plan);
    formDataPayload.append('status', formData.status);
    // Use refs (not state) to guarantee we see the latest file even if React
    // hasn't re-rendered since the file was picked (stale-closure guard).
    const coverFile = coverImageFileRef.current || coverImageFile;
    const qrFile    = qrPamphletFileRef.current || qrPamphletFile;
    console.log('[CreateHotelModal] coverFile from ref:', coverFile ? coverFile.name : 'null');
    console.log('[CreateHotelModal] qrFile from ref:   ', qrFile ? qrFile.name : 'null');
    if (coverFile) {
      formDataPayload.append('cover_image', coverFile);
    }
    if (qrFile) {
      formDataPayload.append('qr_pamphlet', qrFile);
    }

    // Inspect FormData contents
    console.log('[CreateHotelModal] Inspecting FormData keys/values:');
    for (let pair of formDataPayload.entries()) {
      if (pair[1] instanceof File) {
        console.log(`  ${pair[0]}: [File] ${pair[1].name} (${pair[1].size} bytes)`);
      } else {
        console.log(`  ${pair[0]}: ${pair[1]}`);
      }
    }

    try {
      // Use raw fetch so we can read top-level emailSent + message fields
      const response = await fetch(`${API_BASE}/super-admin/hotels`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getSuperAdminToken()}`,
        },
        body: formDataPayload,
      });

      // const json = await response.json();
      // console.log('[CreateHotelModal] Server response:', json);
      
const responseText = await response.text();

let json = {};

try {
  json = responseText ? JSON.parse(responseText) : {};
} catch {
  json = { message: responseText || 'Empty server response' };
}

console.log('[CreateHotelModal] Status:', response.status);
console.log('[CreateHotelModal] Server response:', json);

// if (!response.ok || json.success === false) {
//   throw new Error(
//     json.message || `Request failed with status ${response.status}`
//   );
// }


      if (!response.ok || json.success === false) {
        throw new Error(json.message || 'Failed to create hotel');
      }

      const delivered = json.emailSent === true;
      setEmailSent(delivered);

      if (delivered) {
        toast.success('Hotel created! Credentials emailed to owner.');
      } else {
        toast('Hotel created. Email delivery failed — share credentials manually.', {
          icon: '⚠️',
          style: { background: '#fefce8', color: '#92400e', fontWeight: 600 },
        });
      }

      if (json.data?.credentials) {
        setCreatedCredentials(json.data.credentials);
      } else {
        resetForm();
        await onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Create hotel failed', error);
      toast.error(error.message || 'Failed to create hotel');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!createdCredentials) return;
    const text = `Hotel: ${formData.name}\nUsername: ${createdCredentials.username}\nPassword: ${createdCredentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 overflow-y-auto max-h-[90vh]"
      >
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {createdCredentials ? 'Credentials Generated' : 'Create New Hotel'}
          </h2>
          <button
            onClick={() => {
              if (createdCredentials) {
                onSuccess();
              }
              resetForm();
              onClose();
            }}
            className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {createdCredentials ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 py-4"
            >
              <div className="rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-5 text-center">
                <Check className="mx-auto h-12 w-12 text-orange-500 mb-3" />
                <h3 className="text-lg font-black text-orange-900 dark:text-orange-200">Onboarding Setup Success!</h3>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  The hotel has been created and initialized.
                </p>
              </div>

              {/* Email delivery status badge */}
              {emailSent === true && (
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-3">
                  <Mail className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Credentials emailed</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Sent to <span className="font-mono font-semibold">{formData.email}</span></p>
                  </div>
                </div>
              )}
              {emailSent === false && (
                <div className="flex items-center gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3">
                  <MailX className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Email delivery failed</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">Please share the credentials below with the hotel owner manually.</p>
                  </div>
                </div>
              )}

              <div className="space-y-4 rounded-xl bg-slate-50 dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="text-xs font-black uppercase text-slate-400">Hotel Name</label>
                  <p className="text-base font-bold text-slate-950 dark:text-white">{formData.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black uppercase text-slate-400">Username</label>
                    <div className="mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold select-all text-slate-900 dark:text-white">
                      {createdCredentials.username}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-slate-400">Password</label>
                    <div className="mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold select-all text-slate-900 dark:text-white">
                      {createdCredentials.password}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Credentials'}
                </button>
                <button
                  onClick={() => {
                    onSuccess();
                    resetForm();
                    onClose();
                  }}
                  className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
                >
                  Done
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Hotel Name</label>
                  <input required name="name" value={formData.name} onChange={handleChange} className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white" placeholder="e.g. Hotel Heritage" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Owner Name</label>
                  <input required name="owner_name" value={formData.owner_name} onChange={handleChange} className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white" placeholder="e.g. John Doe" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Email</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white" placeholder="admin@hotel.com" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Mobile Number</label>
                  <input required name="phone" value={formData.phone} onChange={handleChange} className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white" placeholder="+91 9999999999" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Address</label>
                <input required name="address" value={formData.address} onChange={handleChange} className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white" placeholder="123 Street Name, City" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Hotel Cover Image</label>
                  <div className="relative flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-orange-500">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleFileChange(e, 'cover_image')}
                    />
                    {formData.cover_image ? (
                      <img src={formData.cover_image} alt="Cover Preview" className="h-28 w-full object-cover rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-slate-400 mb-1" />
                        <span className="text-xs text-slate-500 font-semibold">Upload Cover JPG/PNG</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Customer QR Pamphlet</label>
                  <div className="relative flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-orange-500">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleFileChange(e, 'qr_pamphlet')}
                    />
                    {formData.qr_pamphlet ? (
                      <img src={formData.qr_pamphlet} alt="QR Preview" className="h-28 w-full object-cover rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-slate-400 mb-1" />
                        <span className="text-xs text-slate-500 font-semibold">Upload QR Pamphlet</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    onClose();
                  }}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="rounded-xl bg-orange-500 px-6 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-70">
                  {loading ? 'Creating...' : 'Create Hotel'}
                </button>
              </div>
            </form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

