import { createTranslator } from 'next-intl';
import { defaultLocale, isLocale } from './config';
import { getMessages } from './messages';

/**
 * The catalogue's top-level namespaces. Listed explicitly so `createTranslator` can be
 * given a concrete namespace and therefore typecheck the key names it is called with.
 */
export type Namespace =
  | 'meta'
  | 'common'
  | 'brand'
  | 'roles'
  | 'roomTypes'
  | 'roomStatus'
  | 'species'
  | 'dailyReport'
  | 'login'
  | 'invite'
  | 'dashboard'
  | 'onboarding'
  | 'operations'
  | 'line'
  | 'lineBooking'
  | 'lineClaim'
  | 'lineReport';

/**
 * Server-side translator for Server Components that render owner/staff text but do not
 * render `<html lang>` (the root layout owns that). Uses the same catalogue as the client
 * provider so both sides always read identical strings.
 */
export function getServerTranslator(locale: unknown, namespace: Namespace) {
  const resolved = isLocale(locale) ? locale : defaultLocale;
  return {
    locale: resolved,
    t: createTranslator({ locale: resolved, messages: getMessages(resolved), namespace }),
  };
}
