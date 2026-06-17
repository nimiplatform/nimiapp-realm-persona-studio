import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  studioChineseCopy,
  studioEnglishCopy,
  type StudioCopyKey,
} from './studio-copy.js';

export const STUDIO_LOCALES = ['en', 'zh'] as const;
export type StudioLocale = typeof STUDIO_LOCALES[number];

export const STUDIO_LOCALE_STORAGE_KEY = 'nimi.realm-persona-studio.locale';

export const studioI18nResources = {
  en: { translation: studioEnglishCopy },
  zh: { translation: studioChineseCopy },
} as const;

export type StudioTranslateOptions = Readonly<Record<string, string | number | boolean | null | undefined>>;

export function isStudioCopyKey(key: string): key is StudioCopyKey {
  return Object.prototype.hasOwnProperty.call(studioEnglishCopy, key);
}

export function normalizeStudioLocale(value: string | null | undefined): StudioLocale | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace('_', '-');
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return null;
}

function readStoredLocale(): StudioLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeStudioLocale(window.localStorage.getItem(STUDIO_LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function resolveNavigatorLocale(): StudioLocale | null {
  if (typeof navigator === 'undefined') return null;
  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ];
  for (const candidate of candidates) {
    const locale = normalizeStudioLocale(candidate);
    if (locale) return locale;
  }
  return null;
}

export function resolveInitialStudioLocale(): StudioLocale {
  return readStoredLocale() ?? resolveNavigatorLocale() ?? 'en';
}

export function currentStudioLocale(): StudioLocale {
  return normalizeStudioLocale(i18n.language) ?? resolveInitialStudioLocale();
}

function persistStudioLocale(locale: string): void {
  const normalized = normalizeStudioLocale(locale);
  if (!normalized || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STUDIO_LOCALE_STORAGE_KEY, normalized);
  } catch {
    // Language persistence is best-effort; the active in-memory language still applies.
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized === 'zh' ? 'zh-CN' : 'en';
  }
}

export function ensureStudioI18nInitialized() {
  if (!i18n.isInitialized) {
    void i18n
      .use(initReactI18next)
      .init({
        resources: studioI18nResources,
        lng: resolveInitialStudioLocale(),
        fallbackLng: 'en',
        supportedLngs: [...STUDIO_LOCALES],
        interpolation: {
          escapeValue: false,
        },
        returnEmptyString: false,
      });
  }
  persistStudioLocale(currentStudioLocale());
  i18n.off('languageChanged', persistStudioLocale);
  i18n.on('languageChanged', persistStudioLocale);
  return i18n;
}

export function translateStudioCopy(key: StudioCopyKey, options?: StudioTranslateOptions): string {
  ensureStudioI18nInitialized();
  return String(i18n.t(key as string, {
    defaultValue: studioEnglishCopy[key],
    ...options,
  }));
}

export function translateStudioExternalCopy(
  key: string,
  options?: StudioTranslateOptions & { defaultValue?: string },
): string {
  ensureStudioI18nInitialized();
  if (isStudioCopyKey(key)) {
    return translateStudioCopy(key, options);
  }
  return String(i18n.t(key, {
    defaultValue: options?.defaultValue ?? key,
    ...options,
  }));
}

export { i18n as studioI18n };
