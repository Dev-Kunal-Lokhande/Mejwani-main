import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import socket from '../../../shared/services/socketClient';
import { API_BASE } from '../../../shared/services/apiBase';
import {
    CheckCircle2,
    AlertTriangle,
    Droplet,
    User,
    Sparkles,
    FileText,
    Search,
    Plus,
    Minus,
    ChefHat,
    Bell,
    Sun,
    Moon,
    CircleDot,
    Star
} from 'lucide-react';
import { translateText } from '../../../shared/services/menuTranslation';

const InstagramIcon = (props) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
);

const CustomerMenu = () => {
    const params = new URLSearchParams(window.location.search);
    const areaParam = params.get('area') || '';
    const area = areaParam.replace(/-/g, ' ').trim();
    const tableCode = params.get('table') || '';
    // Hotel context from QR URL
    const urlHotelId = params.get('hotelId') || localStorage.getItem('mejwani_hotel_id') || '0';
    const urlHotelSlug = params.get('hotelSlug') || localStorage.getItem('mejwani_hotel_slug') || '';

    // Generate/retrieve unique sessionId per QR scan session
    const getOrInitializeSessionId = (currentArea, currentTable) => {
        if (typeof window === 'undefined') return '';
        const storedSessionId = sessionStorage.getItem('mejwani_session_id');
        const storedArea = sessionStorage.getItem('mejwani_session_area');
        const storedTable = sessionStorage.getItem('mejwani_session_table');

        if (!storedSessionId || storedArea !== currentArea || storedTable !== currentTable) {
            const newSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
            sessionStorage.setItem('mejwani_session_id', newSessionId);
            sessionStorage.setItem('mejwani_session_area', currentArea || '');
            sessionStorage.setItem('mejwani_session_table', currentTable || '');
            return newSessionId;
        }
        return storedSessionId;
    };

    const sessionId = getOrInitializeSessionId(area, tableCode);

    // Visit session states
    const [visitId, setVisitId] = useState(params.get('visit') || '');
    const [initializingSession, setInitializingSession] = useState(true);

    // Dynamic hotel branding state
    const [hotelBranding, setHotelBranding] = useState(null);
    const [systemSettings, setSystemSettings] = useState(null);

    const [serviceStatus, setServiceStatus] = useState(null);
    const [pendingService, setPendingService] = useState(false);
    
    // Core cart and persistence states
    const [selectedItems, setSelectedItems] = useState({});
    const [isSentState, setIsSentState] = useState(false);

    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [stage, setStage] = useState('WELCOME');
    const [language, setLanguage] = useState('English');
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [showLangModal, setShowLangModal] = useState(false);

    // Phase 1 Redesign table status and welcome screens states
    const [tableStatus, setTableStatus] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [welcomeDone, setWelcomeDone] = useState(false);
    const [languageSelected, setLanguageSelected] = useState(false);
    
    // THEME STATE
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const [showCooldownOverlay, setShowCooldownOverlay] = useState(false);
    
    // SERVICE COOLDOWN (Lock ALL buttons for 60 seconds)
    const getStoredCooldown = () => {
        if (!sessionId) return 0;
        const expiresAt = localStorage.getItem(`cooldown:${sessionId}`);
        if (!expiresAt) return 0;
        const diff = Math.ceil((Number(expiresAt) - Date.now()) / 1000);
        return diff > 0 ? diff : 0;
    };

    const getStoredCaptainCooldown = () => {
        if (!sessionId) return 0;
        const expiresAt = localStorage.getItem(`cooldown:captain:${sessionId}`);
        if (!expiresAt) return 0;
        const diff = Math.ceil((Number(expiresAt) - Date.now()) / 1000);
        return diff > 0 ? diff : 0;
    };

    const [globalCooldown, setGlobalCooldown] = useState(getStoredCooldown());
    const [captainCooldown, setCaptainCooldown] = useState(getStoredCaptainCooldown());

    useEffect(() => {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('cooldown:') && !key.includes(sessionId)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {
            console.warn('Error clearing legacy cooldown keys:', e);
        }
    }, [sessionId]);

    useEffect(() => {
        if (Math.max(captainCooldown, globalCooldown) === 0) {
            setShowCooldownOverlay(false);
        }
    }, [captainCooldown, globalCooldown]);

    useEffect(() => {
        const timer = setInterval(() => {
            setGlobalCooldown((prev) => (prev > 0 ? prev - 1 : 0));
            setCaptainCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatCooldown = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    useEffect(() => {
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        if (categories.length > 0 && !selectedCategory) {
            setSelectedCategory(categories[0].name);
        } else if (categories.length === 0 && menuItems.length > 0 && !selectedCategory) {
            const uniqueCats = [...new Set(menuItems.map((item) => item.category))];
            if (uniqueCats.length > 0) setSelectedCategory(uniqueCats[0]);
        }
    }, [categories, menuItems, selectedCategory]);

    const languageKeyMap = {
        English: 'en',
        'मराठी': 'mr',
        'हिन्दी': 'hi'
    };

    const transliterateLabel = (value, language) => {
        if (!value) return '';
        const langCode = languageKeyMap[language] || 'en';
        if (langCode === 'en') return value;

        try {
            const result = translateText(value);
            if (langCode === 'mr') return result.marathi;
            if (langCode === 'hi') return result.hindi;
            return value;
        } catch (err) {
            console.warn('Transliteration fallback failed:', err);
            return value;
        }
    };

    const getLocalizedText = (entry, language, keyMap = { en: 'name', hi: 'hindiName', mr: 'marathiName' }) => {
        if (!entry) return '';

        const langCode = languageKeyMap[language] || 'en';
        const fieldKey = keyMap[langCode] || keyMap.en;

        if (entry[fieldKey]) return entry[fieldKey];

        const fallback = entry[keyMap.en] || entry[keyMap.hi] || entry[keyMap.mr] || '';
        return langCode === 'en' ? fallback : transliterateLabel(fallback, language);
    };

    // Derive dynamic hotel display name (UPPERCASE for header)
    const dynamicHotelName = hotelBranding?.name
        ? hotelBranding.name.toUpperCase()
        : 'MEJWANI';

    const hasSocialLinks = !!(systemSettings?.socialMedia?.instagramUrl || systemSettings?.socialMedia?.googleBusinessUrl);

    const localizedStrings = {
        sendBtn: { en: 'Send Menu To Captain', mr: 'कॅप्टनला पाठवा', hi: 'कैप्टन को भेजिए' },
        search: { en: 'Search Menu...', mr: 'मेनू शोधा...', hi: 'मेनू खोजें...' },
        water: { en: 'Water', mr: 'पाणी', hi: 'पानी' },
        tissue: { en: 'Tissue', mr: 'टिशू', hi: 'टिश्यू' },
        waiter: { en: 'Waiter Call', mr: 'वेटरला बोलवा', hi: 'वेटर को बुलाएं' },
        cleaning: { en: 'Cleaning Request', mr: 'स्वच्छता विनंती', hi: 'सफाई का अनुरोध' },
        noItems: { en: 'No items found.', mr: 'कोणतेही आयटम आढळले नाहीत.', hi: 'कोई आइटम नहीं मिला.' },
        section: { en: 'Section', mr: 'विभाग', hi: 'अनुभाग' },
        table: { en: 'Table', mr: 'टेबल', hi: 'टेबल' },
        langLabel: { en: '🌐 Language', mr: '🌐 भाषा', hi: '🌐 भाषा' },
        langBack: { en: '← Change Language', mr: '← भाषा बदला', hi: '← भाषा बदलें' },
        tagline: { en: 'Luxury QR Menu', mr: 'लक्झरी क्यूआर मेनू', hi: 'लक्ज़री क्यूआर मेन्यू' },
        selectLanguage: { en: 'Select Language', mr: 'भाषा निवडा', hi: 'भाषा चुनें' },
        cancel: { en: 'Cancel', mr: 'रद्द करा', hi: 'रद्द करें' },
        requestSent: { en: 'Request Sent', mr: 'विनंती पाठवली', hi: 'अनुरोध भेजा गया' }
    };

    const t = (key) => getLocalizedText(localizedStrings[key], language, { en: 'en', hi: 'hi', mr: 'mr' });

    const serviceButtons = [
        { type: 'WATER', label: t('water'), icon: Droplet },
        { type: 'TISSUE', label: t('tissue'), icon: FileText },
        { type: 'CALL_CAPTAIN', label: t('waiter'), icon: User },
        { type: 'CLEAN_TABLE', label: t('cleaning'), icon: Sparkles },
    ];

    const getDisplayName = (item) => {
        const text = getLocalizedText(item, language, { en: 'name', hi: 'hindiName', mr: 'marathiName' }) || item.name;
        return text;
    };

    const getCategoryName = (catName) => {
        const cat = categories.find(c => c.name === catName);
        if (!cat) return catName;

        if (language === 'English') return cat.name || catName;
        if (language === 'हिन्दी') return cat.hindi_name || cat.name || catName;
        if (language === 'मराठी') return cat.marathi_name || cat.name || catName;
        return cat.name || catName;
    };

    useEffect(() => {
        // Clear any legacy table-bound or token-bound expired flags to clean up browser state
        try {
            for (const key of Object.keys(sessionStorage)) {
                if (key.startsWith('mejwani_expired_')) {
                    sessionStorage.removeItem(key);
                }
            }
            for (const key of Object.keys(localStorage)) {
                if (key.startsWith('mejwani_expired_')) {
                    localStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.warn('Error clearing legacy storage keys:', e);
        }
    }, []);

    useEffect(() => {
        const handleSessionInit = async () => {
            if (!area || !tableCode) {
                setInitializingSession(false);
                return;
            }

            const urlVisitId = params.get('visit');

            if (!urlVisitId) {
                try {
                    const res = await fetch(`${API_BASE}/customer/initiate-visit`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            hotelId: urlHotelId,
                            area,
                            table: tableCode,
                        }),
                    });
                    const data = await res.json();
                    if (data.success && data.visitId) {
                        setVisitId(data.visitId);
                        const newParams = new URLSearchParams(window.location.search);
                        newParams.set('visit', data.visitId);
                        window.history.replaceState(null, '', `${window.location.pathname}?${newParams.toString()}`);
                        
                        await fetchMenu();
                        await fetchHotelBranding();
                        setInitializingSession(false);
                    } else {
                        toast.error(data.message || 'Failed to initiate dining session.');
                        setStage('EXPIRED');
                        setInitializingSession(false);
                    }
                } catch (err) {
                    console.error('Error initiating visit session:', err);
                    toast.error('Network error. Failed to initiate dining session.');
                    setStage('EXPIRED');
                    setInitializingSession(false);
                }
            } else {
                try {
                    const res = await fetch(
                        `${API_BASE}/customer/validate-visit?visitId=${encodeURIComponent(urlVisitId)}&hotelId=${urlHotelId}&area=${encodeURIComponent(area)}&table=${encodeURIComponent(tableCode)}`
                    );
                    const data = await res.json();
                    if (data.success) {
                        setVisitId(urlVisitId);
                        await fetchMenu();
                        await fetchHotelBranding();
                        setInitializingSession(false);
                    } else {
                        console.warn('Visit validation failed:', data.message);
                        setStage('EXPIRED');
                        setInitializingSession(false);
                    }
                } catch (err) {
                    console.error('Error validating visit session:', err);
                    setStage('EXPIRED');
                    setInitializingSession(false);
                }
            }
        };

        handleSessionInit();
    }, [area, tableCode, urlHotelId]);

    const fetchSystemSettings = async (hotelId) => {
        if (!hotelId || hotelId === '0') return;
        try {
            const res = await fetch(`${API_BASE}/admin/system-settings/public?hotelId=${hotelId}`);
            const data = await res.json();
            if (data.success && data.data) {
                setSystemSettings(data.data);
            }
        } catch (err) {
            console.warn('System settings fetch failed:', err);
        }
    };

    // Fetch dynamic hotel branding (name, cover_image) from slug or id
    const fetchHotelBranding = async () => {
        try {
            if (urlHotelSlug) {
                // Prefer slug-based lookup (most accurate)
                const res = await fetch(`${API_BASE}/hotels/by-slug/${encodeURIComponent(urlHotelSlug)}`);
                const data = await res.json();
                if (data.success && data.data) {
                    setHotelBranding(data.data);
                    fetchSystemSettings(data.data.id);
                    return;
                }
            }
            // Fallback: try fetching by id if slug not present
            if (urlHotelId && urlHotelId !== '0') {
                const res = await fetch(`${API_BASE}/hotels/by-id/${encodeURIComponent(urlHotelId)}`);
                const data = await res.json();
                if (data.success && data.data) {
                    setHotelBranding(data.data);
                    fetchSystemSettings(data.data.id);
                }
            }
        } catch (err) {
            console.warn('Hotel branding fetch failed, using defaults:', err);
        }
    };

    const fetchMenu = async () => {
        try {
            const [res, catRes] = await Promise.all([
                fetch(`${API_BASE}/menu?hotelId=${urlHotelId}`),
                fetch(`${API_BASE}/menu-categories?hotelId=${urlHotelId}`)
            ]);
            const data = await res.json();
            const catData = await catRes.json();
            
            if (data.success) {
                setMenuItems(data.data);
            }
            if (catData.success) {
                setCategories(catData.data.filter(c => c.is_active));
            }
        } catch (err) {
            console.error('Menu fetch failed', err);
        }
    };
    
    useEffect(() => {
        const timer = setTimeout(() => {
            setWelcomeDone(true);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    // 1. Polling table status & transition detection
    useEffect(() => {
        if (!area || !tableCode || !visitId) return;

        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_BASE}/customer/table-status?area=${encodeURIComponent(area)}&table=${encodeURIComponent(tableCode)}&hotelId=${urlHotelId}&visit=${encodeURIComponent(visitId)}`);
                const data = await res.json();
                
                if (data.expired) {
                    console.log('[Expiry] Polling detected expired visit session. Expiring...');
                    setStage('EXPIRED');
                    return;
                }

                if (data.success) {
                    const newStatus = data.status;

                    setTableStatus((prevStatus) => {
                        // Detect transition from active (occupied / bill_pending) to vacant (available / cleaning)
                        if (
                            (prevStatus === 'occupied' || prevStatus === 'bill_pending') &&
                            (newStatus === 'available' || newStatus === 'cleaning')
                        ) {
                            console.log('[Expiry] Polling detected table release. Expiring session...');
                            setStage('EXPIRED');
                        }
                        return newStatus;
                    });
                }
            } catch (err) {
                console.error('Error fetching table status:', err);
            } finally {
                setLoadingStatus(false);
            }
        };

        checkStatus();

        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    }, [area, tableCode, urlHotelId, visitId]);

    useEffect(() => {
        const joinRoom = () => {
            if (urlHotelId && urlHotelId !== '0') {
                console.log(`[SOCKET] CustomerMenu emitting join-hotel-room: ${urlHotelId}`);
                socket.emit('join-hotel-room', urlHotelId);
            }
        };

        socket.on('connect', joinRoom);

        if (socket.connected) {
            joinRoom();
        }

        return () => {
            socket.off('connect', joinRoom);
        };
    }, [urlHotelId]);

    // 2. Real-time WebSocket event listener for table release and visit expiration
    useEffect(() => {
        if (!area || !tableCode || !visitId) return;

        const handleTableReleased = (payload) => {
            if (
                payload &&
                String(payload.hotelId) === String(urlHotelId) &&
                String(payload.tableNumber).trim().toUpperCase() === String(tableCode).trim().toUpperCase()
            ) {
                console.log('[Expiry] Socket detected table release. Expiring session...');
                setTableStatus('available');
                setStage('EXPIRED');
            }
        };

        const handleVisitExpired = (payload) => {
            if (payload && payload.visitId === visitId) {
                console.log('[Expiry] Socket detected visit expiration. Expiring session...');
                setStage('EXPIRED');
            }
        };

        const handleSessionInvalid = (payload) => {
            if (payload && payload.visitId === visitId) {
                console.warn('[Expiry] Socket reported session invalid. Expiring...');
                setStage('EXPIRED');
            }
        };

        socket.on('table-released', handleTableReleased);
        socket.on('visit-expired', handleVisitExpired);
        socket.on('session-invalid', handleSessionInvalid);
        return () => {
            socket.off('table-released', handleTableReleased);
            socket.off('visit-expired', handleVisitExpired);
            socket.off('session-invalid', handleSessionInvalid);
        };
    }, [urlHotelId, tableCode, area, visitId]);

    // 3. Reactive stage controller
    useEffect(() => {
        if (!welcomeDone || loadingStatus || !tableStatus) return;

        // Force 'EXPIRED' if state stage is already expired (Backend single source of truth)
        if (stage === 'EXPIRED') return;

        if (tableStatus === 'available' || tableStatus === 'cleaning' || tableStatus === 'customer_present') {
            setStage('CALL_CAPTAIN');
        } else if (tableStatus === 'occupied' || tableStatus === 'bill_pending') {
            if (languageSelected) {
                setStage('MENU');
            } else {
                setStage('LANGUAGE');
            }
        }
    }, [tableStatus, welcomeDone, loadingStatus, languageSelected, area, tableCode, stage, visitId]);

    const handleCallCaptain = async () => {
        if (captainCooldown > 0) {
            toast.error(`Please wait ${captainCooldown} seconds before sending another request.`);
            return;
        }

        if (!area || !tableCode) {
            toast.error('Unable to request captain: missing table/area details.');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/customer/call-captain`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hotelId: urlHotelId,
                    area,
                    table: tableCode,
                    visit: visitId,
                }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success('Captain has been notified.');
                setTableStatus('customer_present');
                
                // Set 60-second cooldown (using 59 to immediately align with next tick)
                const duration = 60;
                localStorage.setItem(`cooldown:captain:${sessionId}`, String(Date.now() + duration * 1000));
                setCaptainCooldown(duration);
            } else {
                toast.error(data.message || 'Failed to call captain.');
            }
        } catch (err) {
            console.error('Error calling captain:', err);
            toast.error('Connection error. Failed to call captain.');
        }
    };

    const handleServiceRequest = (requestType) => {
        const activeCooldown = Math.max(captainCooldown, globalCooldown);
        if (activeCooldown > 0) return;
        if (!area || !tableCode) {
            toast.error('Unable to send request.', {
                id: 'cooldown-toast',
            });
            return;
        }
        setPendingService(true);
        const payload = {
            hotelId: urlHotelId,
            visitId,
            area,
            table: tableCode,
            requestType,
            type: 'service-request',
            category: 'service-request',
            createdAt: new Date().toISOString(),
        };
        try {
            socket.emit('service-request', payload);
            toast.success('Request sent successfully!', {
                id: 'cooldown-toast',
            });
            
            // Start 59-second cooldown to show 00:59 immediately
            const duration = 59;
            const expiresAt = Date.now() + duration * 1000;
            localStorage.setItem(`cooldown:${sessionId}`, String(expiresAt));
            setGlobalCooldown(duration);
        } catch (err) {
            toast.error('Failed to send request.', {
                id: 'cooldown-toast',
            });
        } finally {
            setPendingService(false);
        }
    };

    const addItem = (item, portion = null) => {
        const activeCooldown = Math.max(captainCooldown, globalCooldown);
        if (activeCooldown > 0) return;
        let idKey = item.id;
        if (item.pricing_type === 'HALF_FULL') {
            idKey = portion === 'HALF' ? `${item.id}_HALF` : `${item.id}_FULL`;
        }
        setSelectedItems((prev) => ({ ...prev, [idKey]: (prev[idKey] || 0) + 1 }));
    };

    const removeItem = (item, portion = null) => {
        const activeCooldown = Math.max(captainCooldown, globalCooldown);
        if (activeCooldown > 0) return;
        let idKey = item.id;
        if (item.pricing_type === 'HALF_FULL') {
            idKey = portion === 'HALF' ? `${item.id}_HALF` : `${item.id}_FULL`;
        }
        setSelectedItems((prev) => {
            const updated = { ...prev };
            if (updated[idKey] > 1) {
                updated[idKey] -= 1;
            } else {
                delete updated[idKey];
            }
            return updated;
        });
    };

    const sendMenuToCaptain = () => {
        const activeCooldown = Math.max(captainCooldown, globalCooldown);
        if (activeCooldown > 0) return;
        if (Object.keys(selectedItems).length === 0) return;

        const selectedMenu = [];
        Object.keys(selectedItems).forEach((idKey) => {
            let itemId = idKey;
            let portionSuffix = '';
            if (idKey.endsWith('_HALF')) {
                itemId = idKey.replace('_HALF', '');
                portionSuffix = ' (Half)';
            } else if (idKey.endsWith('_FULL')) {
                itemId = idKey.replace('_FULL', '');
                portionSuffix = ' (Full)';
            }

            const foundItem = menuItems.find((item) => item.id === Number(itemId));
            if (foundItem) {
                selectedMenu.push({ 
                    name: foundItem.name + portionSuffix, 
                    voice_name_hi: foundItem.voice_name_hi ? foundItem.voice_name_hi + portionSuffix : null, 
                    qty: selectedItems[idKey] 
                });
            }
        });

        const itemCount = selectedMenu.reduce((sum, item) => sum + item.qty, 0);
        const itemNames = selectedMenu.map(item => item.name);
        const itemVoices = selectedMenu.map(item => item.voice_name_hi || item.name);

        const payload = {
            hotelId: urlHotelId,
            visitId,
            area,
            table: tableCode,
            tableName: tableCode,
            requestType: "MENU_REQUEST",
            itemCount,
            itemNames,
            itemVoices,
            items: selectedMenu,
            type: 'menu-selection',
            category: 'menu-selection',
            createdAt: new Date().toISOString(),
        };

        try {
            socket.emit('service-request', payload);
            
            // Show success state
            setIsSentState(true);
            
            // Clear cart to reset all cards immediately on success
            setSelectedItems({});
            
            // Start 59-second cooldown to show 00:59 immediately
            const duration = 59;
            const expiresAt = Date.now() + duration * 1000;
            localStorage.setItem(`cooldown:${sessionId}`, String(expiresAt));
            setGlobalCooldown(duration);
            
            // Hide success state after a few seconds
            setTimeout(() => {
                setIsSentState(false);
            }, 3000);
        } catch (err) {
            toast.error('Failed to send menu.', {
                id: 'cooldown-toast',
            });
        }
    };

    const isDark = theme === 'dark';

    if (initializingSession) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center text-center p-6 ${isDark ? 'bg-[#0c0c0c] text-white' : 'bg-[#f8f6f2] text-slate-900'}`}>
                <div className="w-20 h-20 border-2 border-orange-500/30 rounded-[2rem] flex items-center justify-center animate-spin mx-auto">
                    <ChefHat size={36} className="text-orange-500" />
                </div>
            </div>
        );
    }

    const activeCooldown = Math.max(captainCooldown, globalCooldown);
    const customerCooldownActive = activeCooldown > 0;

    if (customerCooldownActive && stage !== 'EXPIRED') {
        const hotelDisplayName = hotelBranding?.name || 'Our Hotel';
        const hasSocialLinks = !!(systemSettings?.socialMedia?.instagramUrl || systemSettings?.socialMedia?.googleBusinessUrl);
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden ${isDark ? 'bg-[#0c0c0c] text-white' : 'bg-[#f8f6f2] text-slate-900'}`}>
                {/* Dynamic cover image as full-screen background */}
                {hotelBranding?.cover_image && (
                    <div className="absolute inset-0 z-0">
                        <img src={hotelBranding.cover_image} alt={hotelDisplayName} className="w-full h-full object-cover opacity-15" />
                        <div className={`absolute inset-0 ${isDark ? 'bg-[#0c0c0c]/90' : 'bg-[#f8f6f2]/90'}`} />
                    </div>
                )}

                <motion.div 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className={`relative z-10 w-full max-w-md p-8 rounded-[2.5rem] border backdrop-blur-md text-center space-y-6 ${
                        isDark ? 'bg-white/5 border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]' : 'bg-white/80 border-slate-200/80 shadow-[0_8px_32px_0_rgba(15,23,42,0.08)]'
                    }`}
                >
                    {/* 1. Chef icon at the top */}
                    <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-[2rem] flex items-center justify-center mx-auto border border-orange-500/20">
                        <ChefHat size={36} className="text-orange-500 animate-pulse" />
                    </div>

                    {/* 2. Hotel name */}
                    <h1 className="text-2xl font-black uppercase tracking-tight pt-2">
                        {hotelDisplayName}
                    </h1>

                    {/* 3. Table badge */}
                    <div className="space-y-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full border ${
                            isDark ? 'bg-white/5 border-white/5 text-orange-500' : 'bg-orange-500/5 border-orange-500/10 text-orange-600'
                        }`}>
                            Table {tableCode} • {area}
                        </span>
                    </div>

                    {/* 4. Waiting message */}
                    <div className="space-y-1 text-center">
                        <span className="block text-sm font-semibold text-orange-500 dark:text-orange-400">
                            Please wait for one minute
                        </span>
                        <span className="block text-xs font-bold text-orange-500/80 dark:text-orange-400/80 font-serif italic">
                            १ मिनिट प्रतीक्षा करा
                        </span>
                    </div>

                    {/* 5. Large circular countdown timer during cooldown */}
                    <div className="relative flex items-center justify-center w-28 h-28 mx-auto">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="56"
                                cy="56"
                                r="46"
                                className="stroke-slate-200 dark:stroke-white/10"
                                strokeWidth="6"
                                fill="transparent"
                            />
                            <circle
                                cx="56"
                                cy="56"
                                r="46"
                                className="stroke-orange-500"
                                strokeWidth="6"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 46}
                                strokeDashoffset={2 * Math.PI * 46 * (1 - activeCooldown / 60)}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 1s linear' }}
                            />
                        </svg>
                        <div className="absolute text-2xl font-black tracking-tight text-white">
                            {activeCooldown}s
                        </div>
                    </div>

                    {/* 6. Instagram & Google icons side by side */}
                    {hasSocialLinks && (
                        <div className="space-y-3 pt-2">
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">
                                Follow or review us while you wait
                            </div>
                            <div 
                                className="grid gap-3"
                                style={{ 
                                    gridTemplateColumns: (systemSettings?.socialMedia?.instagramUrl && systemSettings?.socialMedia?.googleBusinessUrl) ? '1fr 1fr' : '1fr' 
                                }}
                            >
                                {systemSettings?.socialMedia?.instagramUrl && (
                                    <a
                                        href={systemSettings.socialMedia.instagramUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-[14px] bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white text-sm font-semibold tracking-wide transition-all shadow-md shadow-pink-500/10 active:scale-[0.98]"
                                    >
                                        <InstagramIcon className="w-[18px] h-[18px]" />
                                        Instagram
                                    </a>
                                )}
                                {systemSettings?.socialMedia?.googleBusinessUrl && (
                                    <a
                                        href={systemSettings.socialMedia.googleBusinessUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-[14px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-sm font-semibold tracking-wide transition-all hover:bg-slate-50 dark:hover:bg-white/10 active:scale-[0.98]"
                                    >
                                        <Star className="w-[18px] h-[18px] text-yellow-500 fill-yellow-500" />
                                        Google Reviews
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        );
    }
    
    if (stage === 'WELCOME') {
        const hotelDisplayName = hotelBranding?.name || 'Our Hotel';
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center text-center p-6 ${isDark ? 'bg-[#0c0c0c] text-white' : 'bg-[#f8f6f2] text-slate-900'}`}>
                {/* Dynamic cover image as full-screen background */}
                {hotelBranding?.cover_image && (
                    <div className="absolute inset-0 z-0">
                        <img src={hotelBranding.cover_image} alt={hotelDisplayName} className="w-full h-full object-cover opacity-20" />
                        <div className={`absolute inset-0 ${isDark ? 'bg-[#0c0c0c]/85' : 'bg-[#f8f6f2]/85'}`} />
                    </div>
                )}
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 relative z-10">
                    <div className="w-24 h-24 border-2 border-orange-500/30 rounded-[2rem] flex items-center justify-center animate-spin mx-auto">
                        <ChefHat size={40} className="text-orange-500" />
                    </div>
                    <motion.h1 className={`text-2xl font-serif italic ${isDark ? 'text-orange-500' : 'text-orange-600'}`}>
                        <span className="block">{hotelDisplayName} मध्ये आपले स्वागत आहे</span>
                        <span className={`block font-sans not-italic text-lg my-2 font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Welcome to {hotelDisplayName}
                        </span>
                        <span className="block">{hotelDisplayName} में आपका स्वागत है</span>
                    </motion.h1>
                </motion.div>
            </div>
        );
    }

    if (stage === 'CALL_CAPTAIN') {
        const hotelDisplayName = hotelBranding?.name || 'Our Hotel';
        const isNotified = tableStatus === 'customer_present';
        const hasSocialLinks = !!(systemSettings?.socialMedia?.instagramUrl || systemSettings?.socialMedia?.googleBusinessUrl);
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden ${isDark ? 'bg-[#0c0c0c] text-white' : 'bg-[#f8f6f2] text-slate-900'}`}>
                {/* Dynamic cover image as full-screen background */}
                {hotelBranding?.cover_image && (
                    <div className="absolute inset-0 z-0">
                        <img src={hotelBranding.cover_image} alt={hotelDisplayName} className="w-full h-full object-cover opacity-15" />
                        <div className={`absolute inset-0 ${isDark ? 'bg-[#0c0c0c]/90' : 'bg-[#f8f6f2]/90'}`} />
                    </div>
                )}

                <motion.div 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className={`relative z-10 w-full max-w-md p-8 rounded-[2.5rem] border backdrop-blur-md text-center space-y-6 ${
                        isDark ? 'bg-white/5 border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]' : 'bg-white/80 border-slate-200/80 shadow-[0_8px_32px_0_rgba(15,23,42,0.08)]'
                    }`}
                >
                    {/* 1. Chef icon at the top */}
                    <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-[2rem] flex items-center justify-center mx-auto border border-orange-500/20">
                        <ChefHat size={36} className="text-orange-500 animate-pulse" />
                    </div>

                    {/* 2. Hotel name */}
                    <h1 className="text-2xl font-black uppercase tracking-tight pt-2">
                        {hotelDisplayName}
                    </h1>

                    {/* 3. Table badge */}
                    <div className="space-y-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full border ${
                            isDark ? 'bg-white/5 border-white/5 text-orange-500' : 'bg-orange-500/5 border-orange-500/10 text-orange-600'
                        }`}>
                            Table {tableCode} • {area}
                        </span>
                    </div>

                    {captainCooldown > 0 ? (
                        <>
                            {/* 4. Waiting message */}
                            <div className="space-y-1 text-center">
                                <span className="block text-sm font-semibold text-orange-500 dark:text-orange-400">
                                    Please wait for one minute
                                </span>
                                <span className="block text-xs font-bold text-orange-500/80 dark:text-orange-400/80 font-serif italic">
                                    १ मिनिट प्रतीक्षा करा
                                </span>
                            </div>
                            {/* 5. Large circular countdown timer during cooldown */}
                            <div className="relative flex items-center justify-center w-28 h-28 mx-auto">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="56"
                                        cy="56"
                                        r="46"
                                        className="stroke-slate-200 dark:stroke-white/10"
                                        strokeWidth="6"
                                        fill="transparent"
                                    />
                                    <circle
                                        cx="56"
                                        cy="56"
                                        r="46"
                                        className="stroke-orange-500"
                                        strokeWidth="6"
                                        fill="transparent"
                                        strokeDasharray={2 * Math.PI * 46}
                                        strokeDashoffset={2 * Math.PI * 46 * (1 - captainCooldown / 60)}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                                    />
                                </svg>
                                <div className="absolute text-2xl font-black tracking-tight text-white">
                                    {captainCooldown}s
                                </div>
                            </div>

                            {/* 6. Instagram & Google icons side by side */}
                            {hasSocialLinks && (
                                <div className="space-y-3 pt-2">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">
                                        Follow or review us while you wait
                                    </div>
                                    <div 
                                        className="grid gap-3"
                                        style={{ 
                                            gridTemplateColumns: (systemSettings?.socialMedia?.instagramUrl && systemSettings?.socialMedia?.googleBusinessUrl) ? '1fr 1fr' : '1fr' 
                                        }}
                                    >
                                        {systemSettings?.socialMedia?.instagramUrl && (
                                            <a
                                                href={systemSettings.socialMedia.instagramUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-[14px] bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white text-sm font-semibold tracking-wide transition-all shadow-md shadow-pink-500/10 active:scale-[0.98]"
                                            >
                                                <InstagramIcon className="w-[18px] h-[18px]" />
                                                Instagram
                                            </a>
                                        )}
                                        {systemSettings?.socialMedia?.googleBusinessUrl && (
                                            <a
                                                href={systemSettings.socialMedia.googleBusinessUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-[14px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-sm font-semibold tracking-wide transition-all hover:bg-slate-50 dark:hover:bg-white/10 active:scale-[0.98]"
                                            >
                                                <Star className="w-[18px] h-[18px] text-yellow-500 fill-yellow-500" />
                                                Google Reviews
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* 7. "Call Captain Again" button after cooldown completes */
                        <button
                            onClick={handleCallCaptain}
                            className="w-full py-4 md:py-5 rounded-[2rem] font-black text-xs md:text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer bg-orange-500 text-white shadow-lg shadow-orange-500/20 active:scale-[0.98] active:bg-orange-600 active:shadow-orange-500/40"
                        >
                            <Bell className="w-5 h-5 animate-bounce" />
                            <span className="flex flex-col items-start leading-tight">
                                <span className="text-xs font-black">{isNotified ? 'Call Captain Again' : 'Call Captain'}</span>
                                <span className="text-[9px] font-bold opacity-80">कॅप्टनला बोलवा</span>
                            </span>
                        </button>
                    )}
                </motion.div>
            </div>
        );
    }

    if (stage === 'WAITING_FOR_CAPTAIN') {
        const hotelDisplayName = hotelBranding?.name || 'Our Hotel';
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden ${isDark ? 'bg-[#0c0c0c] text-white' : 'bg-[#f8f6f2] text-slate-900'}`}>
                {/* Dynamic cover image as full-screen background */}
                {hotelBranding?.cover_image && (
                    <div className="absolute inset-0 z-0">
                        <img src={hotelBranding.cover_image} alt={hotelDisplayName} className="w-full h-full object-cover opacity-15" />
                        <div className={`absolute inset-0 ${isDark ? 'bg-[#0c0c0c]/90' : 'bg-[#f8f6f2]/90'}`} />
                    </div>
                )}

                <motion.div 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className={`relative z-10 w-full max-w-md p-8 rounded-[2.5rem] border backdrop-blur-md text-center space-y-6 ${
                        isDark ? 'bg-white/5 border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]' : 'bg-white/80 border-slate-200/80 shadow-[0_8px_32px_0_rgba(15,23,42,0.08)]'
                    }`}
                >
                    {/* Pulsing glow animation */}
                    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                        <div className="absolute inset-0 rounded-[2.5rem] bg-orange-500/10 animate-ping" />
                        <div className="relative w-20 h-20 bg-orange-500/10 text-orange-500 rounded-[2rem] flex items-center justify-center border border-orange-500/20">
                            <Bell size={36} className="text-orange-500 animate-pulse" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full border ${
                            isDark ? 'bg-white/5 border-white/5 text-orange-500' : 'bg-orange-500/5 border-orange-500/10 text-orange-600'
                        }`}>
                            Table {tableCode} • {area}
                        </span>
                        <h1 className="text-2xl font-black uppercase tracking-tight pt-2">
                            {hotelDisplayName}
                        </h1>
                        <p className={`text-xs md:text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Captain Notified
                        </p>
                    </div>

                    <div className="space-y-4 py-6 border-y border-dashed border-slate-200 dark:border-white/10 text-center">
                        <div className="text-sm font-medium leading-relaxed space-y-3">
                            <div>
                                <span className="block font-serif italic text-orange-500 text-lg">कृपया प्रतीक्षा करा...</span>
                                <span className="block text-xs text-slate-400 mt-0.5">कॅप्टनला सूचित केले आहे आणि ते लवकरच मदत करतील.</span>
                            </div>
                            <div className="h-px bg-slate-100 dark:bg-white/5 my-2" />
                            <div>
                                <span className="block text-base font-black uppercase tracking-tight">Please wait...</span>
                                <span className="block text-xs text-slate-400 mt-0.5">Captain has been notified and will assist you shortly.</span>
                            </div>
                            <div className="h-px bg-slate-100 dark:bg-white/5 my-2" />
                            <div>
                                <span className="block text-sm font-bold text-slate-300">कृपया प्रतीक्षा करें...</span>
                                <span className="block text-xs text-slate-400 mt-0.5">कैप्टन को सूचित कर दिया गया है और वे जल्द ही आपकी सहायता करेंगे।</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-[10px] font-black uppercase tracking-wider text-orange-500/80 animate-pulse flex items-center justify-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                        <span>Awaiting Captain's initialization</span>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (stage === 'EXPIRED') {
        const hotelDisplayName = hotelBranding?.name || 'Our Hotel';
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden ${isDark ? 'bg-[#0c0c0c] text-white' : 'bg-[#f8f6f2] text-slate-900'}`}>
                {/* Dynamic cover image as full-screen background */}
                {hotelBranding?.cover_image && (
                    <div className="absolute inset-0 z-0">
                        <img src={hotelBranding.cover_image} alt={hotelDisplayName} className="w-full h-full object-cover opacity-15" />
                        <div className={`absolute inset-0 ${isDark ? 'bg-[#0c0c0c]/90' : 'bg-[#f8f6f2]/90'}`} />
                    </div>
                )}

                <motion.div 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className={`relative z-10 w-full max-w-md p-8 rounded-[2.5rem] border backdrop-blur-md text-center space-y-6 ${
                        isDark ? 'bg-white/5 border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]' : 'bg-white/80 border-slate-200/80 shadow-[0_8px_32px_0_rgba(15,23,42,0.08)]'
                    }`}
                >
                    <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto border border-red-500/20">
                        <AlertTriangle size={36} className="text-red-500 animate-pulse" />
                    </div>

                    <div className="space-y-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full border ${
                            isDark ? 'bg-white/5 border-white/5 text-red-500' : 'bg-red-500/5 border-red-500/10 text-red-600'
                        }`}>
                            Session Expired
                        </span>
                        <h1 className="text-2xl font-black uppercase tracking-tight pt-2">
                            Your Link Has Expired
                        </h1>
                        <p className={`text-xs md:text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Your dining session has ended.
                        </p>
                    </div>

                    <div className="space-y-4 py-4 border-y border-dashed border-slate-200 dark:border-white/10 text-center">
                        <p className="text-sm font-bold leading-relaxed text-slate-400">
                            Please scan the QR code again.
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (stage === 'LANGUAGE') {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${isDark ? 'bg-[#0c0c0c] text-white' : 'bg-[#f8f6f2] text-slate-900'}`}>
                <h2 className={`mb-10 text-xl tracking-[0.2em] uppercase font-black ${isDark ? 'text-orange-500' : 'text-orange-600'}`}>
                    {t('selectLanguage')}
                </h2>
                <div className="grid gap-4 w-full max-w-sm">
                    {['English', 'मराठी', 'हिन्दी'].map((lang) => (
                        <button
                            key={lang}
                            onClick={() => {
                                setLanguage(lang);
                                setLanguageSelected(true);
                                setStage('MENU');
                            }}
                            className={`p-5 rounded-[2rem] transition-all font-serif text-lg font-bold border active:scale-95 active:shadow-[0_0_20px_rgba(245,158,11,0.2)] ${isDark ? 'bg-white/2 border-white/5 hover:border-orange-500 hover:bg-orange-500/5' : 'bg-white border-slate-200 hover:border-orange-500 shadow-sm'}`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen font-sans selection:bg-orange-500/30 overflow-x-hidden transition-colors duration-500 ${isDark ? 'bg-[#0c0c0c] text-slate-100' : 'bg-[#f8f6f2] text-slate-900'}`}>
            
            <div className="relative z-10 flex flex-col min-h-screen pb-32">
                {/* HEADER */}
                <header className={`sticky top-0 z-50 transition-colors duration-300 ${isDark ? 'bg-[#0c0c0c]/80 backdrop-blur-xl border-b border-white/5' : 'bg-[#fffaf3]/90 backdrop-blur-xl border-b border-slate-200/60 shadow-sm'}`}>
                    <div className="max-w-6xl mx-auto flex justify-between items-center px-4 py-4 md:py-5">
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex-1">
                            <h1 className={`text-lg md:text-2xl font-black uppercase tracking-tight leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {dynamicHotelName}
                            </h1>
                            {globalCooldown > 0 ? (
                                <p className="text-xs md:text-sm font-bold text-orange-500 mt-1">
                                    Please wait {formatCooldown(globalCooldown)}
                                </p>
                            ) : (
                                <p className={`text-[9px] md:text-xs uppercase tracking-widest mt-1 font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {t('tagline')}
                                </p>
                            )}
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-end gap-2 md:gap-3 flex-shrink-0">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 border active:scale-95 active:shadow-[0_0_15px_rgba(245,158,11,0.2)] ${isDark ? 'bg-white/2 border-white/5 text-slate-400 hover:text-white hover:bg-white/5' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
                                >
                                    {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    onClick={() => setShowLangModal(true)}
                                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 border active:scale-95 active:shadow-[0_0_15px_rgba(245,158,11,0.2)] ${isDark ? 'bg-white/2 border-white/5 text-slate-400 hover:text-white hover:bg-white/5' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
                                >
                                    {t('langLabel')}
                                </button>
                            </div>
                            <div className={`px-4 py-2 md:px-5 md:py-3 rounded-[2rem] border flex items-center gap-4 ${isDark ? 'bg-white/2 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                                <div className="text-right">
                                    <p className={`text-[8px] md:text-[9px] uppercase tracking-widest font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {t('section')}
                                    </p>
                                    <p className={`text-xs md:text-sm font-black truncate max-w-[80px] md:max-w-[120px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        {area || 'N/A'}
                                    </p>
                                </div>
                                <div className={`w-px h-6 ${isDark ? 'bg-white/5' : 'bg-slate-200'}`} />
                                <div className="text-right">
                                    <p className={`text-[8px] md:text-[9px] uppercase tracking-widest font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {t('table')}
                                    </p>
                                    <p className={`text-sm md:text-lg font-black ${isDark ? 'text-orange-500' : 'text-orange-600'}`}>
                                        {tableCode || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </header>

                {/* CINEMATIC HERO SECTION — dynamic cover image */}
                <div className="relative w-full h-[220px] md:h-[350px] z-0 overflow-hidden pointer-events-none">
                    <img
                        src={hotelBranding?.cover_image || '/hotel1.png'}
                        alt={hotelBranding?.name || 'Hotel Ambient'}
                        className="w-full h-full object-cover scale-105"
                    />
                    <div className="absolute inset-0 bg-black/30 z-10" />
                    <div className={`absolute inset-0 z-20 bg-gradient-to-t ${isDark ? 'from-[#0c0c0c] via-[#0c0c0c]/80' : 'from-[#f8f6f2] via-[#f8f6f2]/60'} to-transparent`} />
                </div>

                <div className="max-w-6xl mx-auto w-full px-4 -mt-20 md:-mt-32 relative z-30">
                    
                    {/* STATUS NOTIFICATION */}
                    <AnimatePresence>
                        {serviceStatus && (
                            <motion.div 
                                initial={{ opacity: 0, y: -20 }} 
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className={`mb-6 p-4 rounded-[2rem] font-black uppercase tracking-wider text-xs md:text-sm flex items-center justify-center gap-3 border backdrop-blur-xl ${
                                    serviceStatus.type === 'success'
                                        ? `bg-emerald-500/10 border-emerald-500/20 text-emerald-600 ${isDark ? 'dark:text-emerald-400' : ''}` 
                                        : `bg-red-500/10 border-red-500/20 text-red-600 ${isDark ? 'dark:text-red-400' : ''}`
                                }`}
                            >
                                {serviceStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                {serviceStatus.message}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-col gap-6 md:gap-8">
                        {/* QUICK ACTIONS - With Mobile Active Touch Physics */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-3 md:gap-5">
                            {serviceButtons.map((button) => {
                                const Icon = button.icon;
                                const hasCooldown = globalCooldown > 0;
                                return (
                                    <button
                                        key={button.type}
                                        onClick={() => handleServiceRequest(button.type)}
                                        className={`flex flex-col items-center justify-center gap-2.5 p-4 md:p-6 rounded-[2rem] border transition-all duration-200 cursor-pointer group active:scale-90 active:border-orange-500 active:shadow-[0_0_20px_rgba(245,158,11,0.2)] md:hover:shadow-xl md:hover:scale-[1.02] ${
                                            hasCooldown 
                                                ? 'opacity-55 cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5' 
                                                : isDark 
                                                    ? 'bg-white/2 border-white/5 md:hover:border-orange-500/30' 
                                                    : 'bg-white border-slate-200 md:hover:border-orange-200 shadow-sm'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-colors group-active:bg-orange-500/10 ${isDark ? 'bg-white/5 md:group-hover:bg-orange-500/10' : 'bg-slate-50 md:group-hover:bg-orange-50'}`}>
                                            <Icon className={`w-5 h-5 md:w-6 md:h-6 transition-colors group-active:text-orange-500 ${isDark ? 'text-slate-400 md:group-hover:text-orange-500' : 'text-slate-500 md:group-hover:text-orange-500'}`} />
                                        </div>
                                        <p className={`font-black uppercase tracking-wider text-[9px] md:text-[10px] text-center leading-tight transition-colors group-active:text-orange-500 ${isDark ? 'text-slate-400 md:group-hover:text-white' : 'text-slate-600 md:group-hover:text-slate-900'}`}>
                                            {button.label}
                                        </p>
                                    </button>
                                );
                            })}
                        </motion.div>

                        {/* SEARCH BAR */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                            <div 
                                className={`relative flex items-center border rounded-[2rem] transition-all shadow-sm ${isDark ? 'bg-white/2 border-white/5 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/10' : 'bg-white border-slate-200 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/10'}`}
                            >
                                <Search className={`absolute left-5 w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                                <input
                                    type="text"
                                    placeholder={t('search')}
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                    }}
                                    className={`w-full pl-12 pr-5 py-4 md:py-5 bg-transparent outline-none font-bold text-xs md:text-sm ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                                />
                            </div>
                        </motion.div>

                        {/* CATEGORY TABS */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                            <div className="flex overflow-x-auto gap-3 pb-2 hide-scrollbar snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
                                {categories.length > 0 
                                    ? categories.map(cat => {
                                        const isActive = selectedCategory === cat.name;
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    setSelectedCategory(cat.name);
                                                }}
                                                className={`snap-center whitespace-nowrap px-6 py-3.5 rounded-[2rem] font-black text-[10px] md:text-xs tracking-widest uppercase transition-all duration-200 border cursor-pointer active:scale-95 ${
                                                    isActive 
                                                        ? 'bg-orange-500 text-white border-transparent shadow-lg shadow-orange-500/20' 
                                                        : isDark 
                                                            ? 'bg-white/2 border-white/5 text-slate-400 md:hover:text-white'
                                                            : 'bg-white border-slate-200 text-slate-500 md:hover:text-slate-900 shadow-sm'
                                                }`}
                                            >
                                                {getCategoryName(cat.name)}
                                            </button>
                                        );
                                    })
                                    : [...new Set(menuItems.map(item => item.category))].map(category => {
                                        const isActive = selectedCategory === category;
                                        return (
                                            <button
                                                key={category}
                                                onClick={() => {
                                                    setSelectedCategory(category);
                                                }}
                                                className={`snap-center whitespace-nowrap px-6 py-3.5 rounded-[2rem] font-black text-[10px] md:text-xs tracking-widest uppercase transition-all duration-200 border cursor-pointer active:scale-95 ${
                                                    isActive 
                                                        ? 'bg-orange-500 text-white border-transparent shadow-lg shadow-orange-500/20' 
                                                        : isDark 
                                                            ? 'bg-white/2 border-white/5 text-slate-400 md:hover:text-white'
                                                            : 'bg-white border-slate-200 text-slate-500 md:hover:text-slate-900 shadow-sm'
                                                }`}
                                            >
                                                {getCategoryName(category)}
                                            </button>
                                        );
                                    })
                                }
                            </div>
                        </motion.div>

                        {/* MENU CARDS GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {menuItems
                                .filter(item => {
                                    const matchesCategory = item.category === selectedCategory;
                                    const displayName = getDisplayName(item) || '';
                                    const matchesSearch = displayName.toLowerCase().includes(search.toLowerCase()) ||
                                                          (item.code && item.code.toLowerCase().includes(search.toLowerCase()));
                                    return matchesCategory && matchesSearch;
                                })
                                .map((item, index) => {
                                    const qty = selectedItems[item.id] || 0;
                                    const isVeg = item.type === 'veg' || item.type === 'VEG';
                                    
                                    return (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`relative border rounded-[2.5rem] p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm md:hover:shadow-xl md:hover:scale-[1.02] ${
                                                isDark 
                                                    ? 'bg-[#0c0c0c] border-white/5'
                                                    : 'bg-white border-slate-200'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-4 mt-1">
                                                    <CircleDot className={`w-3.5 h-3.5 ${isVeg ? 'text-emerald-500' : 'text-red-500'}`} />
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${isVeg ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {isVeg ? 'VEG' : 'NON-VEG'}
                                                    </span>
                                                </div>
                                                
                                                <h3 className={`text-base font-black uppercase tracking-tight leading-tight transition-colors flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                    <span>{getDisplayName(item)}</span>
                                                    {item.code && (
                                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                                            {item.code}
                                                        </span>
                                                    )}
                                                </h3>
                                            </div>

                                            {item.pricing_type === 'HALF_FULL' ? (
                                                <div className={`mt-6 pt-5 border-t flex flex-col gap-3.5 transition-colors w-full ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                                    {/* Half Portion Row */}
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex flex-col">
                                                            <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Half Portion</span>
                                                            <div className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                                <span className="text-[10px] mr-0.5 text-slate-400">₹</span>
                                                                {parseFloat(item.half_price || 0).toFixed(0)}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {(selectedItems[`${item.id}_HALF`] || 0) > 0 ? (
                                                                <div className={`flex items-center border rounded-xl p-0.5 shadow-sm transition-colors ${
                                                                    globalCooldown > 0 ? 'opacity-55 cursor-not-allowed' : ''
                                                                } ${isDark ? 'bg-white/2 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                                                    <button 
                                                                        onClick={() => removeItem(item, 'HALF')} 
                                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                                                            globalCooldown > 0 ? 'cursor-not-allowed' : 'active:scale-90'
                                                                        } ${isDark ? 'text-slate-400 active:bg-white/10' : 'text-slate-600 active:bg-slate-200'}`}
                                                                    >
                                                                        <Minus className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <span className={`font-black text-xs w-6 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                                        {selectedItems[`${item.id}_HALF`]}
                                                                    </span>
                                                                    <button 
                                                                        onClick={() => addItem(item, 'HALF')} 
                                                                        className={`w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center transition-all duration-200 ${
                                                                            globalCooldown > 0 ? 'cursor-not-allowed opacity-75' : 'active:scale-90'
                                                                        }`}
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => addItem(item, 'HALF')}
                                                                    className={`px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all duration-200 border flex items-center gap-1 cursor-pointer active:scale-95 ${
                                                                        isDark ? 'bg-white/2 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500 shadow-sm'
                                                                    }`}
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" /> Add
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Full Portion Row */}
                                                    <div className="flex items-center justify-between w-full border-t pt-2.5 border-dashed border-slate-200 dark:border-white/5">
                                                        <div className="flex flex-col">
                                                            <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Full Portion</span>
                                                            <div className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                                <span className="text-[10px] mr-0.5 text-slate-400">₹</span>
                                                                {parseFloat(item.full_price || 0).toFixed(0)}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {(selectedItems[`${item.id}_FULL`] || 0) > 0 ? (
                                                                <div className={`flex items-center border rounded-xl p-0.5 shadow-sm transition-colors ${
                                                                    globalCooldown > 0 ? 'opacity-55 cursor-not-allowed' : ''
                                                                } ${isDark ? 'bg-white/2 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                                                    <button 
                                                                        onClick={() => removeItem(item, 'FULL')} 
                                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                                                            globalCooldown > 0 ? 'cursor-not-allowed' : 'active:scale-90'
                                                                        } ${isDark ? 'text-slate-400 active:bg-white/10' : 'text-slate-600 active:bg-slate-200'}`}
                                                                    >
                                                                        <Minus className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <span className={`font-black text-xs w-6 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                                        {selectedItems[`${item.id}_FULL`]}
                                                                    </span>
                                                                    <button 
                                                                        onClick={() => addItem(item, 'FULL')} 
                                                                        className={`w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center transition-all duration-200 ${
                                                                            globalCooldown > 0 ? 'cursor-not-allowed opacity-75' : 'active:scale-90'
                                                                        }`}
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => addItem(item, 'FULL')}
                                                                    className={`px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all duration-200 border flex items-center gap-1 cursor-pointer active:scale-95 ${
                                                                        isDark ? 'bg-white/2 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500 shadow-sm'
                                                                    }`}
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" /> Add
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={`mt-6 pt-5 border-t flex items-center justify-between transition-colors w-full ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                                    <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                        <span className={`text-sm mr-1 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>₹</span>
                                                        {parseFloat(item.price || 0).toFixed(0)}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {qty > 0 ? (
                                                            <div className={`flex items-center border rounded-2xl p-1 shadow-sm transition-colors ${
                                                                globalCooldown > 0 ? 'opacity-55 cursor-not-allowed' : ''
                                                            } ${isDark ? 'bg-white/2 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                                                <button 
                                                                    onClick={() => removeItem(item)} 
                                                                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
                                                                        globalCooldown > 0 ? 'cursor-not-allowed' : 'active:scale-90'
                                                                    } ${isDark ? 'text-slate-400 active:bg-white/10' : 'text-slate-600 active:bg-slate-200'}`}
                                                                >
                                                                    <Minus className="w-4 h-4" />
                                                                </button>
                                                                <span className={`font-black text-sm w-8 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                                    {qty}
                                                                </span>
                                                                <button 
                                                                    onClick={() => addItem(item)} 
                                                                    className={`w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 transition-all duration-200 ${
                                                                        globalCooldown > 0 ? 'cursor-not-allowed opacity-75' : 'active:scale-90 active:bg-orange-600'
                                                                    }`}
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={() => addItem(item)}
                                                                className={`px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all duration-200 border flex items-center gap-2 cursor-pointer active:scale-95 ${
                                                                    globalCooldown > 0
                                                                        ? 'opacity-55 cursor-not-allowed border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 text-slate-400'
                                                                        : 'active:border-orange-500 active:text-orange-500 ' + (isDark ? 'bg-white/2 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500 shadow-sm')
                                                                }`}
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                                Add
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                        </div>
                        
                        {menuItems.filter(item => {
                            const matchesCategory = item.category === selectedCategory;
                            const displayName = getDisplayName(item) || '';
                            const matchesSearch = displayName.toLowerCase().includes(search.toLowerCase()) ||
                                                  (item.code && item.code.toLowerCase().includes(search.toLowerCase()));
                            return matchesCategory && matchesSearch;
                        }).length === 0 && menuItems.length > 0 && (
                            <div className={`text-center py-20 font-black uppercase tracking-widest text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                {t('noItems')}
                            </div>
                        )}
                    </div>
                </div>
                
                {/* BOTTOM ORDER DOCK */}
                <AnimatePresence>
                    {(Object.keys(selectedItems).length > 0 || isSentState) && (
                        <motion.div 
                            initial={{ y: 100 }} 
                            animate={{ y: 0 }} 
                            exit={{ y: 100 }}
                            className={`fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pb-6 md:pb-8 pointer-events-none bg-gradient-to-t ${isDark ? 'from-[#0c0c0c] via-[#0c0c0c]/90 to-transparent' : 'from-[#f8f6f2] via-[#f8f6f2]/90 to-transparent'}`}
                        >
                            <div className="max-w-xl mx-auto pointer-events-auto">
                                <button
                                    disabled={isSentState}
                                    onClick={sendMenuToCaptain}
                                    className={`w-full py-4 md:py-5 rounded-[2rem] font-black text-xs md:text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 transition-all duration-300 cursor-pointer ${
                                        isSentState 
                                            ? 'bg-emerald-500 text-white shadow-emerald-500/20 scale-100 border-transparent pointer-events-none' 
                                            : globalCooldown > 0
                                                ? 'bg-orange-500/50 opacity-55 cursor-not-allowed text-white shadow-none'
                                                : 'bg-orange-500 text-white shadow-orange-500/20 active:scale-[0.98] active:bg-orange-600 active:shadow-orange-500/40'
                                    }`}
                                >
                                    {isSentState ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                                            {t('requestSent')}
                                        </>
                                    ) : (
                                        <>
                                            <Bell className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
                                            {t('sendBtn')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* FOOTER */}
                <footer className={`mt-20 py-8 text-center text-[9px] uppercase tracking-widest font-bold border-t relative z-0 ${isDark ? 'text-slate-600 border-white/5' : 'text-slate-400 border-slate-200'}`}>
                    © {new Date().getFullYear()} {hotelBranding?.name || 'Mejwani'}
                </footer>
            </div>

            {/* LANGUAGE MODAL OVERLAY */}
            <AnimatePresence>
                {showLangModal && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className={`fixed inset-0 z-[100] backdrop-blur-xl flex flex-col items-center justify-center p-6 ${isDark ? 'bg-black/80' : 'bg-white/90'}`}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className={`relative border rounded-[3rem] w-full max-w-sm shadow-2xl p-8 ${isDark ? 'bg-[#0c0c0c] border-white/10' : 'bg-white border-slate-200'}`}
                        >
                            <h2 className={`mb-8 text-center text-lg font-black tracking-tight uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {t('selectLanguage')}
                            </h2>
                            <div className="grid gap-3 w-full">
                                {['English', 'मराठी', 'हिन्दी'].map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => {
                                            setLanguage(lang);
                                            setShowLangModal(false);
                                        }}
                                        className={`px-6 py-4 rounded-[2rem] font-black text-sm uppercase tracking-wider transition-all duration-200 border active:scale-95 ${
                                            language === lang 
                                            ? 'bg-orange-500 text-white border-transparent shadow-lg shadow-orange-500/20' 
                                            : isDark 
                                                ? 'bg-white/2 border-white/5 text-slate-300 active:bg-white/10'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 active:bg-slate-200'
                                        }`}
                                    >
                                        {lang}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowLangModal(false)}
                                className={`w-full mt-4 py-4 font-black text-[10px] uppercase tracking-widest rounded-[2rem] transition-colors active:scale-95 duration-200 ${isDark ? 'text-slate-500 active:bg-white/10' : 'text-slate-500 active:bg-slate-100'}`}
                            >
                                {t('cancel')}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomerMenu;