import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDashboardSummary } from '@/lib/dashboard-service';
import { getServerTranslator } from '@/app/i18n/server-translator';
import { localeCookieName, resolveLocale } from '@/app/i18n/config';

export const metadata = {
    title: 'PawSpace — Owner & Manager Dashboard',
    robots: { index: false, follow: false },
};

export default async function DashboardPage() {
    let summary;
    try {
        summary = await getDashboardSummary();
    } catch {
        redirect('/login?error=UnauthorizedDashboardAccess');
    }

    const cookieStore = await cookies();
    const locale = resolveLocale(cookieStore.get(localeCookieName)?.value);
    const { t } = getServerTranslator(locale, 'dashboard');

    const { shop, staff, rooms, bookings, dailyReports, integrations, entitlement, commercialStatus } = summary;
    const formatDate = (value: string | null) => value
        ? new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value))
        : '—';

    return (
        <div className="dashboard-shell">
            <div className="dashboard-wrap">
                <header className="dashboard-hero">
                    <div>
                        <div className="dashboard-title-row">
                            <div className="login-mark">P</div>
                            <h1 className="dashboard-title">{shop.name}</h1>
                            <span className="dashboard-badge">{entitlement.packageName}</span>
                        </div>
                        <p className="dashboard-copy">Tenant Dashboard · {t('signedInAs')} <strong>{staff.name}</strong> ({staff.role.toUpperCase()})</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <Link href="/onboarding" className="secondary-button" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700 }}>
                            {t('onboardingLink')}
                        </Link>
                        {entitlement.supportTier && <span className="dashboard-badge blue">{t('supportBadge', { tier: entitlement.supportTier })}</span>}
                    </div>
                </header>
                <section className="dashboard-grid">
                    <article className="dashboard-card"><h2>{t('roomStatusHeading')}</h2><div className="dashboard-mini-grid"><div className="dashboard-stat mint"><span>{t('roomStatus.available')}</span><strong>{rooms.available}</strong></div><div className="dashboard-stat"><span>{t('roomStatus.occupied')}</span><strong>{rooms.occupied}</strong></div><div className="dashboard-stat peach"><span>{t('roomStatus.cleaning')}</span><strong>{rooms.cleaning}</strong></div><div className="dashboard-stat pink"><span>{t('roomStatus.maintenance')}</span><strong>{rooms.maintenance}</strong></div></div><p className="dashboard-copy">{t('roomsTotal', { total: rooms.total })}</p></article>
                    <article className="dashboard-card"><h2>{t('bookingsHeading')}</h2><div className="dashboard-list"><div className="dashboard-row"><span>{t('bookingsActive')}</span><strong>{bookings.active}</strong></div><div className="dashboard-row"><span>{t('bookingsTodayCheckIns')}</span><strong>{bookings.todayCheckIns}</strong></div><div className="dashboard-row"><span>{t('bookingsTodayCheckOuts')}</span><strong>{bookings.todayCheckOuts}</strong></div></div></article>
                    <article className="dashboard-card"><h2>{t('reportsHeading')}</h2><div className="dashboard-list"><div className="dashboard-row"><span>{t('reportsTotalToday')}</span><strong>{dailyReports.totalReportsToday}</strong></div><div className="dashboard-row"><span>{t('reportsDelivered')}</span><strong>{dailyReports.deliveredCount}</strong></div><div className="dashboard-row"><span>{t('reportsFailed')}</span><strong>{dailyReports.failedCount}</strong></div></div></article>
                    <article className="dashboard-card"><h2>{t('planHeading')}</h2><div className="dashboard-list"><div className="dashboard-row"><span>{t('planPackage')}</span><strong>{entitlement.packageName}</strong></div><div className="dashboard-row"><span>{t('planOffer')}</span><strong>{entitlement.commercialOffer === 'founding_member' ? t('offerFoundingMember') : t('offerStandard')}</strong></div><div className="dashboard-row"><span>{t('planLifecycle')}</span><strong>{commercialStatus.lifecycleStatus}</strong></div><div className="dashboard-row"><span>{t('planRooms')}</span><strong>{commercialStatus.roomUsage} / {entitlement.roomLimit ?? t('unlimited')}</strong></div><div className="dashboard-row"><span>{t('planPetRecords')}</span><strong>{commercialStatus.petUsage} / {entitlement.petHistoryLimit ?? t('unlimited')}</strong></div>{entitlement.supportTier && <div className="dashboard-row"><span>{t('planSupport')}</span><strong>{entitlement.supportTier}</strong></div>}</div></article>
                </section>
                {!commercialStatus.commercialAccess && <section className="dashboard-card" role="alert" style={{ borderColor: '#ef4444' }}><h2>{t('blockedHeading')}</h2><p className="dashboard-copy">{t.rich('blockedBody', { status: commercialStatus.lifecycleStatus, reason: commercialStatus.blockedReason ? ` (${commercialStatus.blockedReason})` : '', strong: (chunks) => <strong>{chunks}</strong> })}</p></section>}
                <section className="dashboard-card"><h2>{t('lifecycleHeading')}</h2><div className="dashboard-list"><div className="dashboard-row"><span>{t('lifecycleTrialEnds')}</span><strong>{formatDate(commercialStatus.trialEndsAt)}</strong></div><div className="dashboard-row"><span>{t('lifecyclePeriodEnds')}</span><strong>{formatDate(commercialStatus.currentPeriodEnd)}</strong></div><div className="dashboard-row"><span>{t('lifecycleGraceEnds')}</span><strong>{formatDate(commercialStatus.gracePeriodEnd)}</strong></div><div className="dashboard-row"><span>{t('lifecycleFoundingContinuity')}</span><strong>{entitlement.commercialOffer === 'founding_member' && commercialStatus.foundingMemberContinuityValid ? t('continuityValid') : t('continuityNotActive')}</strong></div></div></section>
                <section className="dashboard-card"><h2>{t('integrationsHeading')}</h2><div className="dashboard-integrations"><div className={`integration-card ${integrations.lineLinked ? 'on' : ''}`}><span>{t('integrationLine')}</span><strong>{integrations.lineLinked ? t('integrationLineOn') : t('integrationLineOff')}</strong></div><div className={`integration-card ${integrations.googleSheetsEnabled ? 'on' : ''}`}><span>{t('integrationSheets')}</span><strong>{integrations.googleSheetsEnabled ? t('integrationSheetsOn') : t('integrationSheetsOff')}</strong></div><div className={`integration-card ${integrations.cameraEnabled ? 'on' : ''}`}><span>{t('integrationCamera')}</span><strong>{integrations.cameraEnabled ? t('integrationCameraOn') : t('integrationCameraOff')}</strong></div></div></section>
            </div>
        </div>
    );
}
