import { i18n } from '@lingui/core';

export const SUPPORTED_LOCALES = ['nl', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_STORAGE_KEY = 'sprintlog-locale';

export function getStoredLocale(): SupportedLocale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
    return stored as SupportedLocale;
  }
  return 'nl';
}

/** Imports the compiled catalog (lingui compile → messages.mjs), not the source .po —
 * this project doesn't run @lingui/vite-plugin, so .po files aren't Vite-importable.
 * Explicit per-locale imports (rather than a template-literal dynamic import) so Vite can
 * statically analyze and bundle each catalog. */
const catalogLoaders: Record<SupportedLocale, () => Promise<{ messages: Record<string, string> }>> = {
  nl: () => import('./locales/nl/messages.mjs'),
  en: () => import('./locales/en/messages.mjs'),
};

export async function activateLocale(locale: SupportedLocale) {
  const { messages } = await catalogLoaders[locale]();
  i18n.load(locale, messages);
  i18n.activate(locale);
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export { i18n };
