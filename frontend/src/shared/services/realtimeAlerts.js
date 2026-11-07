import toast from 'react-hot-toast';
import { getAudioContext } from './audioHelper';
import { translateText } from './menuTranslation';
import { playNotificationVoice } from '../../utils/playNotificationVoice';

const recentEvents = new Map();
const RECENT_EVENT_TTL_MS = 3500;
const recentServiceRequests = new Map();

const getEventKey = (eventName, payload = {}) => {
  const table = payload.table || payload.tableCode || payload.tableName || 'unknown';
  const request = payload.requestType || payload.type || payload.orderId || 'activity';
  const createdAt = payload.createdAt || payload.timestamp || '';
  return `${eventName}:${table}:${request}:${createdAt}`;
};

const shouldNotify = (eventName, payload) => {
  const now = Date.now();
  const eventKey = getEventKey(eventName, payload);

  recentEvents.forEach((expiresAt, key) => {
    if (expiresAt <= now) recentEvents.delete(key);
  });

  if (recentEvents.has(eventKey)) return false;

  recentEvents.set(eventKey, now + RECENT_EVENT_TTL_MS);
  return true;
};

const speechQueue = [];
let isSpeaking = false;

const queueSpeech = (utterances, isCaptainAlert = false) => {
  speechQueue.push({ utterances, isCaptainAlert });
  processSpeechQueue();
};

const processSpeechQueue = () => {
  if (isSpeaking || speechQueue.length === 0) return;

  const current = speechQueue[0];

  // If it's a Captain Alert, we check if voice announcements are enabled
  if (current.isCaptainAlert) {
    const voiceAnnEnabled = localStorage.getItem('mejwani_voice_announcement_enabled') !== 'false';
    if (!voiceAnnEnabled) {
      // Discard this item and process next
      speechQueue.shift();
      processSpeechQueue();
      return;
    }
  }

  isSpeaking = true;
  const { utterances } = speechQueue.shift();

  // Find natural speech synthesis voices if available
  const voices = window.speechSynthesis.getVoices();
  const getBestVoice = (lang) => {
    return voices.find(v => v.lang === lang) || 
           voices.find(v => v.lang.startsWith(lang.split('-')[0])) ||
           null;
  };

  utterances.forEach(u => {
    const voice = getBestVoice(u.lang);
    if (voice) u.voice = voice;
    u.volume = 1.0;
    // Slower rates sound much more natural and Google Assistant-like for local languages
    u.rate = u.lang === 'en-US' ? 0.95 : 0.85; 
    u.pitch = 1.0;
  });

  let currentIndex = 0;

  const playNext = () => {
    if (currentIndex >= utterances.length) {
      isSpeaking = false;
      // Small gap between separate table calls
      setTimeout(processSpeechQueue, 1500);
      return;
    }

    const currentUt = utterances[currentIndex];
    currentUt.onend = () => {
      currentIndex++;
      playNext();
    };
    currentUt.onerror = () => {
      currentIndex++;
      playNext();
    };

    window.speechSynthesis.speak(currentUt);
  };

  playNext();
};

export const playServiceRequestSound = (table, requestType, extra = {}) => {
  const isDashboard = window.location.pathname.startsWith('/admin') || window.location.pathname === '/captain';
  if (!isDashboard) return Promise.resolve();

  const voiceAnnEnabled = localStorage.getItem('mejwani_voice_announcement_enabled') !== 'false';
  if (!voiceAnnEnabled) return Promise.resolve();

  try {
    const tableName = table
      .toUpperCase()
      .replace(/GAC/g, 'जी एसी ')
      .replace(/GNAC/g, 'जी एन एसी ')
      .replace(/AC/g, 'एसी ')
      .replace(/T/g, 'टी ')
      .replace(/F/g, 'एफ ')
      .replace(/G/g, 'जी ');

    const resolvedRequestType = (() => {
      const upperType = String(requestType || '').toUpperCase();
      if (upperType.includes('WATER')) return 'WATER';
      if (upperType.includes('BILL')) return 'BILL';
      if (upperType.includes('CLEAN')) return 'CLEAN_TABLE';
      if (upperType.includes('TISSUE')) return 'TISSUE';
      if (upperType.includes('MENU_REQUEST')) return 'MENU_REQUEST';
      return 'CALL_CAPTAIN';
    })();

    const requestMessages = {
      CALL_CAPTAIN: "वेटर पाहिजे",
      WATER: "पाणी पाहिजे",
      BILL: "बिल चाहिए",
      CLEAN_TABLE: "साफसफाई पाहिजे",
      TISSUE: "टिश्यू पाहिजे"
    };

    let speechText = '';

    if (resolvedRequestType === 'MENU_REQUEST') {
      const count = extra?.itemCount || 0;
      const names = extra?.itemNames || [];
      if (count === 1) {
        const rawItemName = names[0] || 'एक आइटम';
        const translated = translateText(rawItemName);
        const itemName = translated.marathi || rawItemName;
        speechText = `टेबल ${tableName} ${itemName} चाहिए`;
      } else {
        speechText = `टेबल ${tableName} ${count} आइटम चाहिए`;
      }
    } else {
      speechText = `टेबल ${tableName} ${requestMessages[resolvedRequestType]}`;
    }

    console.log('[Speech System] Play announcement (once):', speechText);
    return playNotificationVoice(speechText);
  } catch (e) {
    console.log('Voice announcement error:', e);
    return Promise.resolve();
  }
};

const showRealtimeToast = (message) => {
  toast(
    message,
    {
      icon: '📢',
      position: 'top-right',
      duration: 6000,

      style: {
        borderRadius: '18px',
        background: '#0f172a',
        color: '#ffffff',
        boxShadow:
          '0 20px 45px rgba(15,23,42,0.18)',
      },
    }
  );
};

export const notifyServiceRequest = (payload) => {
  if (!payload || !shouldNotify('service-request', payload)) return;

  const tableLabel = payload.table || 'Unknown';
  const requestLabel = payload.requestType || 'Service';

  // Cooldown check: ignore if same table sends ANY request within 1 minute (60000ms)
  const eventKey = tableLabel;
  const now = Date.now();
  if (recentServiceRequests.has(eventKey)) {
    const lastTime = recentServiceRequests.get(eventKey);
    if (now - lastTime < 60000) {
      console.log(`Ignoring duplicate service request toast from ${tableLabel} within cooldown`);
      return;
    }
  }
  recentServiceRequests.set(eventKey, now);

  playServiceRequestSound(
    tableLabel,
    requestLabel
  );

  const toastMsg = requestLabel === 'Captain Requested'
    ? `🔔 Table ${tableLabel} requesting captain`
    : `🔔 Table ${tableLabel} needs ${requestLabel}`;

  showRealtimeToast(toastMsg);
};

export const notifyTableActivity = (payload) => {
  if (!payload || !shouldNotify('new-order', payload)) return;

  const tableLabel =
    payload.tableCode || payload.tableName || 'Unknown';

  showRealtimeToast(
    `🔔 New table activity at Table ${tableLabel}`
  );
};

export const subscribeRealtimeAlerts = (socket, options = {}) => {
  const {
    includeTableActivity = false,
    onTableActivity
  } = options;

  // Register the new-order listener if either toast or callback is requested.
  // includeTableActivity=true  → show toast + run callback
  // includeTableActivity=false → skip toast, but still run callback (silent floorplan refresh)
  const needsListener = includeTableActivity || !!onTableActivity;

  const handleTableActivity = (payload) => {
    if (includeTableActivity) {
      notifyTableActivity(payload);  // shows toast
    }
    onTableActivity?.(payload);      // always fires when provided
  };

  if (needsListener) {
    socket.on('new-order', handleTableActivity);
  }

  return () => {
    if (needsListener) {
      socket.off('new-order', handleTableActivity);
    }
  };
};
