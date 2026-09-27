'use client';

import { useLocale } from 'next-intl';
import { useLocaleSwitcher } from '@/app/i18n/locale-provider';
import type { Locale } from '@/app/i18n/config';

const localeNames: Record<Locale, { short: string; native: string }> = {
  th: { short: 'TH', native: 'ไทย' },
  en: { short: 'EN', native: 'English' },
};

const className =
  'secondary-button language-toggle';

export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const { toggleLocale } = useLocaleSwitcher();
  const nextLocale: Locale = locale === 'th' ? 'en' : 'th';
  const next = localeNames[nextLocale];
  const label = `สลับภาษาเป็น ${next.native} / Switch language to ${next.native}`;

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className={className}
      data-testid="language-toggle"
      lang={nextLocale}
      aria-label={label}
      title={label}
    >
      🌐 {next.short}
    </button>
  );
}
