import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDashboardSummary } from '@/lib/dashboard-service';

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

    const { shop, staff, rooms, bookings, dailyReports, integrations, entitlement, commercialStatus } = summary;
    const formatDate = (value: string | null) => value
        ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value))
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
                        <p className="dashboard-copy">Tenant Dashboard · Signed in as <strong>{staff.name}</strong> ({staff.role.toUpperCase()})</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <Link href="/onboarding" className="secondary-button" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700 }}>
                            🚀 Onboarding Hub
                        </Link>
                        {entitlement.supportTier && <span className="dashboard-badge blue">Support: {entitlement.supportTier}</span>}
                    </div>
                </header>
                <section className="dashboard-grid">
                    <article className="dashboard-card"><h2>Room Status</h2><div className="dashboard-mini-grid"><div className="dashboard-stat mint"><span>Available</span><strong>{rooms.available}</strong></div><div className="dashboard-stat"><span>Occupied</span><strong>{rooms.occupied}</strong></div><div className="dashboard-stat peach"><span>Cleaning</span><strong>{rooms.cleaning}</strong></div><div className="dashboard-stat pink"><span>Maintenance</span><strong>{rooms.maintenance}</strong></div></div><p className="dashboard-copy">{rooms.total} rooms total</p></article>
                    <article className="dashboard-card"><h2>Bookings Today</h2><div className="dashboard-list"><div className="dashboard-row"><span>Active</span><strong>{bookings.active}</strong></div><div className="dashboard-row"><span>Today Check-ins</span><strong>{bookings.todayCheckIns}</strong></div><div className="dashboard-row"><span>Today Check-outs</span><strong>{bookings.todayCheckOuts}</strong></div></div></article>
                    <article className="dashboard-card"><h2>Daily Reports</h2><div className="dashboard-list"><div className="dashboard-row"><span>Total today</span><strong>{dailyReports.totalReportsToday}</strong></div><div className="dashboard-row"><span>Delivered (Sent)</span><strong>{dailyReports.deliveredCount}</strong></div><div className="dashboard-row"><span>Failed / Retry</span><strong>{dailyReports.failedCount}</strong></div></div></article>
                    <article className="dashboard-card"><h2>Plan & Entitlements</h2><div className="dashboard-list"><div className="dashboard-row"><span>Package</span><strong>{entitlement.packageName}</strong></div><div className="dashboard-row"><span>Offer</span><strong>{entitlement.commercialOffer === 'founding_member' ? 'Founding Member' : 'Standard'}</strong></div><div className="dashboard-row"><span>Lifecycle</span><strong>{commercialStatus.lifecycleStatus}</strong></div><div className="dashboard-row"><span>Rooms</span><strong>{commercialStatus.roomUsage} / {entitlement.roomLimit ?? 'Unlimited'}</strong></div><div className="dashboard-row"><span>Pet records</span><strong>{commercialStatus.petUsage} / {entitlement.petHistoryLimit ?? 'Unlimited'}</strong></div>{entitlement.supportTier && <div className="dashboard-row"><span>Support</span><strong>{entitlement.supportTier}</strong></div>}</div></article>
                </section>
                {!commercialStatus.commercialAccess && <section className="dashboard-card" role="alert" style={{ borderColor: '#ef4444' }}><h2>Commercial access blocked</h2><p className="dashboard-copy">ร้านอยู่ในสถานะ <strong>{commercialStatus.lifecycleStatus}</strong> จึงดูข้อมูลสถานะบัญชีได้ แต่การแก้ไขงานธุรกิจถูกระงับ{commercialStatus.blockedReason ? ` (${commercialStatus.blockedReason})` : ''}</p></section>}
                <section className="dashboard-card"><h2>Subscription lifecycle</h2><div className="dashboard-list"><div className="dashboard-row"><span>Trial ends</span><strong>{formatDate(commercialStatus.trialEndsAt)}</strong></div><div className="dashboard-row"><span>Current period ends</span><strong>{formatDate(commercialStatus.currentPeriodEnd)}</strong></div><div className="dashboard-row"><span>Grace period ends</span><strong>{formatDate(commercialStatus.gracePeriodEnd)}</strong></div><div className="dashboard-row"><span>Founding continuity</span><strong>{entitlement.commercialOffer === 'founding_member' && commercialStatus.foundingMemberContinuityValid ? 'Valid' : 'Not active'}</strong></div></div></section>
                <section className="dashboard-card"><h2>Active Integrations & Modules</h2><div className="dashboard-integrations"><div className={`integration-card ${integrations.lineLinked ? 'on' : ''}`}><span>LINE Official / LIFF</span><strong>{integrations.lineLinked ? 'Connected' : 'Not Linked'}</strong></div><div className={`integration-card ${integrations.googleSheetsEnabled ? 'on' : ''}`}><span>Google Sheets Sync</span><strong>{integrations.googleSheetsEnabled ? 'Active' : 'Disabled'}</strong></div><div className={`integration-card ${integrations.cameraEnabled ? 'on' : ''}`}><span>Public Visitor Camera</span><strong>{integrations.cameraEnabled ? 'Online' : 'Offline'}</strong></div></div></section>
            </div>
        </div>
    );
}
