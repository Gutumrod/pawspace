import { getDashboardSummary } from '@/lib/dashboard-service';
import { redirect } from 'next/navigation';

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

    const { shop, staff, rooms, bookings, dailyReports, integrations, entitlement } = summary;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{shop.name}</h1>
                            <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
                                {entitlement.packageName}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            Tenant Dashboard — Signed in as <strong className="text-slate-700">{staff.name}</strong> ({staff.role.toUpperCase()})
                        </p>
                    </div>
                    {entitlement.supportTier && (
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">
                            Support: <span className="capitalize font-semibold">{entitlement.supportTier}</span>
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Room Status</h2>
                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{rooms.total} Total</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                <p className="text-xs text-emerald-600 font-medium">Available</p>
                                <p className="text-2xl font-bold text-emerald-700 mt-1">{rooms.available}</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                                <p className="text-xs text-blue-600 font-medium">Occupied</p>
                                <p className="text-2xl font-bold text-blue-700 mt-1">{rooms.occupied}</p>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                <p className="text-xs text-amber-600 font-medium">Cleaning</p>
                                <p className="text-2xl font-bold text-amber-700 mt-1">{rooms.cleaning}</p>
                            </div>
                            <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                                <p className="text-xs text-rose-600 font-medium">Maintenance</p>
                                <p className="text-2xl font-bold text-rose-700 mt-1">{rooms.maintenance}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Bookings Today</h2>
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{bookings.active} Active</span>
                        </div>
                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                <span className="text-sm text-slate-600">Today Check-ins</span>
                                <span className="text-lg font-bold text-slate-900">{bookings.todayCheckIns}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                <span className="text-sm text-slate-600">Today Check-outs</span>
                                <span className="text-lg font-bold text-slate-900">{bookings.todayCheckOuts}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Daily Reports</h2>
                            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{dailyReports.totalReportsToday} Total</span>
                        </div>
                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                <span className="text-sm text-emerald-700 font-medium">Delivered (Sent)</span>
                                <span className="text-lg font-bold text-emerald-800">{dailyReports.deliveredCount}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100">
                                <span className="text-sm text-rose-700 font-medium">Failed / Retry</span>
                                <span className="text-lg font-bold text-rose-800">{dailyReports.failedCount}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Plan & Entitlements</h2>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase">{entitlement.commercialOffer}</span>
                        </div>
                        <div className="space-y-2 pt-1 text-sm">
                            <div className="flex justify-between py-1 border-b border-slate-100">
                                <span className="text-slate-500">Room Limit</span>
                                <span className="font-semibold text-slate-900">{entitlement.roomLimit ?? 'Unlimited'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                                <span className="text-slate-500">Pet History Limit</span>
                                <span className="font-semibold text-slate-900">{entitlement.petHistoryLimit ?? 'Unlimited'}</span>
                            </div>
                            {entitlement.supportTier && (
                                <div className="flex justify-between py-1">
                                    <span className="text-slate-500">Support</span>
                                    <span className="font-semibold text-slate-900 capitalize">{entitlement.supportTier}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Active Integrations & Modules</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className={`p-4 rounded-xl border flex items-center justify-between ${integrations.lineLinked ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                            <span className="font-medium text-sm">LINE Official / LIFF</span>
                            <span className="text-xs font-bold px-2 py-1 rounded bg-white shadow-sm">{integrations.lineLinked ? 'Connected' : 'Not Linked'}</span>
                        </div>
                        <div className={`p-4 rounded-xl border flex items-center justify-between ${integrations.googleSheetsEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                            <span className="font-medium text-sm">Google Sheets Sync</span>
                            <span className="text-xs font-bold px-2 py-1 rounded bg-white shadow-sm">{integrations.googleSheetsEnabled ? 'Active' : 'Disabled'}</span>
                        </div>
                        <div className={`p-4 rounded-xl border flex items-center justify-between ${integrations.cameraEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                            <span className="font-medium text-sm">Public Visitor Camera</span>
                            <span className="text-xs font-bold px-2 py-1 rounded bg-white shadow-sm">{integrations.cameraEnabled ? 'Online' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
