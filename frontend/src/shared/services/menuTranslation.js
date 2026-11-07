import IndicTransliterate from 'indic-transliterate';
import { translationSource } from './translationSource.js';

export const getTranslationCacheKey = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const applyUniversalCorrections = (text) => {
  if (!text) return "";
  let res = text;

  // Avoid incorrect phonetic outputs
  res = res.replace(/मुटोन/g, "मटण");
  res = res.replace(/मटॉन/g, "मटण");
  res = res.replace(/मटोण/g, "मटण");
  res = res.replace(/प्रनव/g, "प्रणव");
  res = res.replace(/चिकेन/g, "चिकन");
  res = res.replace(/ड्रिन्क्स/g, "ड्रिंक्स");

  // Modern Nasal/Anusvara simplification: simplify half-nasals before consonants
  res = res.replace(/न्क/g, "ंक");
  res = res.replace(/न्च/g, "ंच");
  res = res.replace(/न्ज/g, "ंज");
  res = res.replace(/न्ड्स/g, "ंड्स");
  res = res.replace(/न्ड/g, "ंड");
  res = res.replace(/न्त/g, "ंत");
  res = res.replace(/न्द/g, "ंद");
  res = res.replace(/न्प/g, "ंप");
  res = res.replace(/न्स/g, "ंस");
  res = res.replace(/न्श/g, "ंश");
  res = res.replace(/न्ट/g, "ंट");
  res = res.replace(/न्थ/g, "ंथ");

  return res;
};

const applyMarathiCorrections = (text) => {
  if (!text) return "";
  let res = text;
  // Ensure Marathi retroflex spelling rules
  res = res.replace(/मटन/g, "मटण");
  res = res.replace(/बिरयानी/g, "बिर्याणी");
  res = res.replace(/व्हेज/g, "वेज");
  res = res.replace(/नॉन-व्हेज/g, "नॉन-वेज");
  return res;
};

const applyHindiCorrections = (text) => {
  if (!text) return "";
  let res = text;
  // Ensure Hindi standard spelling rules
  res = res.replace(/मटण/g, "मटन");
  res = res.replace(/बिर्याणी/g, "बिरयानी");
  res = res.replace(/ळ/g, "ल");
  res = res.replace(/व्हेज/g, "वेज");
  res = res.replace(/नॉन-व्हेज/g, "नॉन-वेज");
  return res;
};

/**
 * Enterprise-grade multilingual translation and transliteration engine
 * for Menu Categories, Menu Items, and User-entered text.
 */
export const translateText = (rawText) => {
  const input = rawText ? rawText.trim() : "";
  if (!input) return { marathi: "", hindi: "" };

  const normalized = input.toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();

  // 1. Exact Predefined Translation Source Check (Full Phrase)
  if (translationSource[normalized]) {
    return {
      marathi: translationSource[normalized].marathi,
      hindi: translationSource[normalized].hindi
    };
  }

  // 2. Word-by-Word Translation & Intelligent Transliteration Reassembly
  const tokens = normalized.split(/(\s+|[^A-Za-z0-9]+)/g).filter(Boolean);
  const marathiParts = [];
  const hindiParts = [];

  for (const token of tokens) {
    // Delimiters, spaces or non-word symbols are pushed as-is
    if (!/^[A-Za-z0-9]+$/.test(token)) {
      marathiParts.push(token);
      hindiParts.push(token);
      continue;
    }

    const key = token.toLowerCase();

    // Check if token exists in predefined Translation Source
    if (translationSource[key]) {
      marathiParts.push(translationSource[key].marathi);
      hindiParts.push(translationSource[key].hindi);
    } else if (/^\d+$/.test(token)) {
      // Numbers are pushed directly
      marathiParts.push(token);
      hindiParts.push(token);
    } else {
      // Intelligent Transliteration Fallback
      let candidate = token;
      try {
        candidate = IndicTransliterate.transliterate(token, 'devanagari') || token;
      } catch (err) {
        console.warn('Centralized Transliteration call failed, using raw token:', err);
      }

      // Apply universal spelling corrections
      const cleanCandidate = applyUniversalCorrections(candidate);

      // Apply language-specific post-processing
      const marathiTerm = applyMarathiCorrections(cleanCandidate);
      const hindiTerm = applyHindiCorrections(cleanCandidate);

      marathiParts.push(marathiTerm);
      hindiParts.push(hindiTerm);
    }
  }

  return {
    marathi: marathiParts.join("").trim(),
    hindi: hindiParts.join("").trim()
  };
};

/**
 * Transliterate Menu Name
 */
export const transliterateMenuName = (rawName) => {
  return translateText(rawName);
};

/**
 * Transliterate Category Name
 */
export const transliterateCategoryName = (rawName) => {
  const result = translateText(rawName);

  const formatCategory = (str) => {
    return str
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
  };

  return {
    marathi: formatCategory(result.marathi),
    hindi: formatCategory(result.hindi)
  };
};
