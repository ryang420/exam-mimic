import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';

const savedLang = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
const browserLang =
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')
    ? 'en'
    : 'zh';
const defaultLang = savedLang || browserLang || 'zh';

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en }
  },
  lng: defaultLang,
  fallbackLng: 'zh',
  interpolation: { escapeValue: false }
});

i18n.on('languageChanged', (lang) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
});

export default i18n;
