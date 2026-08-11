import { useState } from 'react';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { Languages } from 'lucide-react';
import { activateLocale, SUPPORTED_LOCALES, type SupportedLocale } from '../i18n';

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  nl: 'NL',
  en: 'EN',
};

/** Small NL/EN toggle — reactivates the compiled catalog and persists the choice. */
export function LanguageSwitcher() {
  const { i18n } = useLingui();
  const [pending, setPending] = useState(false);

  async function handleChange(locale: SupportedLocale) {
    if (locale === i18n.locale || pending) return;
    setPending(true);
    try {
      await activateLocale(locale);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="language-switcher" role="group" aria-label={t`Taal`}>
      <Languages size={14} aria-hidden />
      {SUPPORTED_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          className={`language-switcher-option${i18n.locale === locale ? ' active' : ''}`}
          disabled={pending}
          onClick={() => void handleChange(locale)}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
