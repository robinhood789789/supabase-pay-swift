import React, { createContext, useContext, useState, useEffect } from 'react';
import { enTranslations } from '@/locales/en';
import { thTranslations } from '@/locales/th';

type Locale = 'en' | 'th';

type Translations = typeof enTranslations;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatNumber: (value: number) => string;
  formatCurrency: (value: number, currency?: string) => string;
  formatDate: (date: Date | string, format?: 'short' | 'long' | 'datetime') => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const translations: Record<Locale, Translations> = {
  en: enTranslations,
  th: thTranslations,
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem('locale');
    return (stored === 'en' || stored === 'th') ? stored : 'th';
  });

  useEffect(() => {
    localStorage.setItem('locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[locale];
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }

    if (typeof value !== 'string') {
      console.warn(`Translation missing for key: ${key} in locale: ${locale}`);
      return key;
    }

    if (params) {
      return Object.entries(params).reduce(
        (str, [param, val]) => str.replace(`{${param}}`, String(val)),
        value
      );
    }

    return value;
  };

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US').format(value);
  };

  const formatCurrency = (value: number, currency = 'THB'): string => {
    return new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US', {
      style: 'currency',
      currency,
    }).format(value / 100);
  };

  const formatDate = (date: Date | string, format: 'short' | 'long' | 'datetime' = 'short'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const localeCode = locale === 'th' ? 'th-TH' : 'en-US';

    if (format === 'datetime') {
      return new Intl.DateTimeFormat(localeCode, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(dateObj);
    }

    if (format === 'long') {
      return new Intl.DateTimeFormat(localeCode, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(dateObj);
    }

    return new Intl.DateTimeFormat(localeCode, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(dateObj);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, formatNumber, formatCurrency, formatDate }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
