export const DEFAULT_SYSTEM_SETTINGS = {
  branding: {
    name: 'Mejwani Restaurant',
    address: '',
    phone: ''
  },
  captain: {
    name: 'Captain'
  },
  billing: {
    gstNumber: '',
    cgst: 2.5,
    sgst: 2.5,
    serviceCharge: 0,
    currencySymbol: '₹'
  },
  socialMedia: {
    instagramUrl: '',
    googleBusinessUrl: ''
  },
  printing: {
    kotTitle: 'KITCHEN ORDER TICKET'
  }
};

const asString = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
};

const asPercent = (value, fallback = 0) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, number));
};

export const normalizeSystemSettings = (settings = {}) => {
  const branding = settings.branding || {};
  const billing = settings.billing || {};
  const captain = settings.captain || {};
  const socialMedia = settings.socialMedia || {};
  const printing = settings.printing || {};

  return {
    branding: {
      name: asString(branding.name, DEFAULT_SYSTEM_SETTINGS.branding.name),
      address: asString(branding.address, DEFAULT_SYSTEM_SETTINGS.branding.address),
      phone: asString(branding.phone, DEFAULT_SYSTEM_SETTINGS.branding.phone)
    },
    captain: {
      name: asString(captain.name ?? settings.captainName, DEFAULT_SYSTEM_SETTINGS.captain.name) || DEFAULT_SYSTEM_SETTINGS.captain.name
    },
    billing: {
      gstNumber: asString(billing.gstNumber ?? branding.gstNumber, DEFAULT_SYSTEM_SETTINGS.billing.gstNumber),
      cgst: asPercent(billing.cgst, DEFAULT_SYSTEM_SETTINGS.billing.cgst),
      sgst: asPercent(billing.sgst, DEFAULT_SYSTEM_SETTINGS.billing.sgst),
      serviceCharge: asPercent(
        billing.serviceChargeEnabled === false ? 0 : billing.serviceCharge,
        DEFAULT_SYSTEM_SETTINGS.billing.serviceCharge
      ),
      currencySymbol: asString(billing.currencySymbol, DEFAULT_SYSTEM_SETTINGS.billing.currencySymbol) || DEFAULT_SYSTEM_SETTINGS.billing.currencySymbol
    },
    socialMedia: {
      instagramUrl: asString(socialMedia.instagramUrl, ''),
      googleBusinessUrl: asString(socialMedia.googleBusinessUrl, '')
    },
    printing: {
      kotTitle: asString(printing.kotTitle, DEFAULT_SYSTEM_SETTINGS.printing.kotTitle) || DEFAULT_SYSTEM_SETTINGS.printing.kotTitle
    }
  };
};

export const formatCaptainDisplayName = (name = DEFAULT_SYSTEM_SETTINGS.captain.name) => {
  const normalizedName = asString(name, DEFAULT_SYSTEM_SETTINGS.captain.name);
  if (!normalizedName) return DEFAULT_SYSTEM_SETTINGS.captain.name;
  if (normalizedName.toLowerCase() === 'captain' || normalizedName.toLowerCase().startsWith('captain ')) {
    return normalizedName;
  }
  return `Captain ${normalizedName}`;
};

export const getCachedSystemSettings = () => {
  if (typeof window === 'undefined') return DEFAULT_SYSTEM_SETTINGS;

  try {
    return normalizeSystemSettings(JSON.parse(localStorage.getItem('mejwani_settings') || '{}'));
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
};

export const cacheSystemSettings = (settings) => {
  const normalized = normalizeSystemSettings(settings);
  localStorage.setItem('mejwani_settings', JSON.stringify(normalized));
  window.dispatchEvent(new Event('mejwani-settings-updated'));
  return normalized;
};

export const formatCurrencyWithSettings = (value = 0, settings = getCachedSystemSettings(), decimals = 2) => {
  const numberValue = Number(value) || 0;
  return `${settings.billing.currencySymbol}${numberValue.toFixed(decimals)}`;
};
