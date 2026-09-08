import { en, TranslationKey } from './en';
import { ru } from './ru';

export type Locale = 'en' | 'ru';
export type { TranslationKey };
export { en, ru };

const translations: Record<Locale, Record<TranslationKey, string>> = {
  en,
  ru,
};

export function getTranslation(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const dict = translations[locale] || translations.en;
  let text = dict[key] || translations.en[key] || (key as string);

  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(new RegExp(`\\{\\{?${paramKey}\\}?\\}`, 'g'), String(value));
    });
  }

  return text;
}

export function createTranslator(locale: Locale) {
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    return getTranslation(locale, key, params);
  };
}

export function applyLanguageToDOM(locale: Locale) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('data-lang', locale);
  }
}
