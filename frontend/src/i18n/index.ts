import { fr } from './fr';
// Add a dictionary and locale here to introduce a new language; routes already carry the locale.
export const locales = ['fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';
export const dictionaries = { fr };
export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}
export const t = dictionaries.fr;
export const formatNumber = (value: number) => new Intl.NumberFormat(t.locale).format(value);
export const formatMoney = (value: number) =>
  new Intl.NumberFormat(t.locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
export const formatTime = (value: string) =>
  new Intl.DateTimeFormat(t.locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
