"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { OperationsDTO, RoomType } from "@/lib/operations-service";
import { logoutAction } from "@/app/actions/auth";
import { LanguageToggle } from "@/app/components/language-toggle";
import {
  createBookingAction,
  addPetToBookingAction,
  removePetFromBookingAction,
  updateBookingScheduleAction,
  updateBookingStatusAction,
  setRoomMaintenanceAction,
  markRoomCleanAction,
  confirmBookingRequestAction,
  declineBookingRequestAction,
} from "@/app/actions/booking";
import { createRoomAction, updateRoomAction, createOwnerAction, updateOwnerAction, createPetAction, updatePetAction } from "@/app/actions/operations";
import { inviteStaffAction, disableStaffAction, enableStaffAction, changeStaffRoleAction, removeStaffAction } from "@/app/actions/staff";
import { generateLineClaimTokenAction, resetLineLinkAction } from "@/app/actions/line-claim";
import { generateGoogleSheetClaimAction, bindGoogleSheetAction, disconnectGoogleSheetAction } from "@/app/actions/google-sheet";
import { retryDailyReportDeliveryAction } from "@/app/actions/daily-report";

type Tab = "overview" | "bookings" | "customers" | "reports" | "setup";
type ActionLike = { success: boolean; error?: string; data?: unknown };

const roomTypeLabel: Record<RoomType, string> = { standard: "Standard", deluxe: "Deluxe", vip: "VIP", cat_condo: "Cat Condo" };

export default function OperationsClient({ initial }: { initial: OperationsDTO }) {
  const router = useRouter();
  const t = useTranslations("operations");
  const tRoomStatus = useTranslations("roomStatus");
  const tSpecies = useTranslations("species");
  const tDailyReport = useTranslations("dailyReport");
  const tRoles = useTranslations("roles");
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [sheetToken, setSheetToken] = useState<string | null>(null);
  const canManage = initial.staff.role === "owner" || initial.staff.role === "manager";
  const isOwner = initial.staff.role === "owner";

  const roomStatusLabel = { available: tRoomStatus("available"), occupied: tRoomStatus("occupied"), cleaning: tRoomStatus("cleaning"), maintenance: tRoomStatus("maintenance") } as const;

  const ownersById = useMemo(() => new Map(initial.owners.map((o) => [o.id, o])), [initial.owners]);
  const petsById = useMemo(() => new Map(initial.pets.map((p) => [p.id, p])), [initial.pets]);
  const roomsById = useMemo(() => new Map(initial.rooms.map((r) => [r.id, r])), [initial.rooms]);
  const activeBookings = initial.bookings.filter((b) => b.status === "confirmed" || b.status === "checked_in");

  function run(label: string, task: () => Promise<ActionLike>) {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await task();
        if (!result.success) setNotice({ kind: "error", text: result.error || t("noticeActionFailed", { label }) });
        else {
          setNotice({ kind: "ok", text: t("noticeActionSucceeded", { label }) });
          router.refresh();
        }
      } catch {
        setNotice({ kind: "error", text: t("noticeActionConnectionFailed", { label }) });
      }
    });
  }
  async function submitDailyReport(form: HTMLFormElement) {
    setNotice(null);
    const data = new FormData(form);
    data.set("idempotencyKey", crypto.randomUUID());
    startTransition(async () => {
      try {
        const response = await fetch("/api/daily-reports", { method: "POST", body: data });
        const body = await response.json() as { success?: boolean; code?: string; error?: string };
        if (!response.ok || !body.success) {
          setNotice({ kind: "error", text: body.error || body.code || t("noticeReportFailed") });
          return;
        }
        form.reset();
        setNotice({ kind: "ok", text: t("noticeReportCreated") });
        router.refresh();
      } catch {
        setNotice({ kind: "error", text: t("noticeReportConnectionFailed") });
      }
    });
  }

  const tabs: Array<[Tab, string]> = [
    ["overview", t("tabOverview")], ["bookings", t("tabBookings")], ["customers", t("tabCustomers")], ["reports", t("tabReports")], ["setup", t("tabSetup")],
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">P</div><div className="brand-copy"><div className="brand-name">PawSpace</div><div className="brand-caption">{t("brandCaption")}</div></div></div>
        <div className="nav-label">{t("workspaceLabel")}</div>
        <nav className="nav-list" aria-label={t("navAriaLabel")}>
          {tabs.map(([id, label]) => <button key={id} data-testid={`tab-${id}`} className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="shop-card"><div className="shop-name">{initial.shop.name}</div><div className="shop-detail">{initial.staff.name} · {initial.staff.role}</div><div className="shop-detail">{t("sidebarBusinessDate", { date: initial.businessDate })}</div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><div className="eyebrow">{initial.businessDate} · Asia/Bangkok</div><h1 className="page-title">{initial.shop.name}</h1><div className="page-subtitle">{t("pageSubtitle")}</div></div>
          <div className="header-actions"><LanguageToggle /><button className="secondary-button" disabled={pending} onClick={() => run(t("signOut"), async () => { const r = await logoutAction(); if (r.success) { router.push("/login"); router.refresh(); } return r; })}>{t("signOut")}</button></div>
        </header>
        {notice && <div className={`pilot-notice ${notice.kind}`} role="status">{notice.text}</div>}
        {pending && <div className="pilot-loading" role="status">{t("processing")}</div>}
        {tab === "overview" && <>
          <section className="kpi-grid">
            <div className="card kpi-card"><div className="kpi-label">{t("kpiRoomsTotal")}</div><strong className="kpi-value">{initial.rooms.length}</strong><div className="kpi-meta">{t("kpiRoomsAvailable", { count: initial.rooms.filter((r) => r.status === "available").length })}</div></div>
            <div className="card kpi-card"><div className="kpi-label">{t("kpiStaying")}</div><strong className="kpi-value">{initial.bookings.filter((b) => b.status === "checked_in").length}</strong><div className="kpi-meta">{t("kpiConfirmed", { count: initial.bookings.filter((b) => b.status === "confirmed").length })}</div></div>
            <div className="card kpi-card"><div className="kpi-label">{t("kpiReportsToday")}</div><strong className="kpi-value">{initial.reports.filter((r) => r.reportDate === initial.businessDate).length}</strong><div className="kpi-meta">{t("kpiReportsSent", { count: initial.reports.filter((r) => r.reportDate === initial.businessDate && r.deliveryStatus === "sent").length })}</div></div>
            <div className="card kpi-card"><div className="kpi-label">Google Sheets</div><strong className="kpi-value pilot-kpi-text">{initial.shop.googleSheetsConnected ? t("kpiSheetsConnected") : t("kpiSheetsNotConnected")}</strong><div className="kpi-meta">{t("kpiLineStatus", { status: initial.shop.lineConfigured ? t("lineConfigured") : t("lineNotConfigured") })}</div></div>
          </section>
          <section className="card panel pilot-section">
            <div className="panel-header"><div><h2 className="panel-title">Room Matrix</h2><div className="panel-subtitle">{t("roomMatrixSubtitle")}</div></div></div>
            {initial.rooms.length === 0 ? <div className="pilot-empty">{t("noRooms")}</div> : <div className="room-grid">
              {initial.rooms.map((room) => {
                const booking = activeBookings.find((b) => b.roomId === room.id);
                const petNames = booking?.petIds.map((id) => petsById.get(id)?.name).filter(Boolean).join(", ");
                return <article className="room-card" key={room.id}><div className="room-top"><div><div className="room-number">{room.number}</div><div className="room-type">{roomTypeLabel[room.type]}</div></div><span className={`status-chip chip-${room.status}`}>{roomStatusLabel[room.status]}</span></div><div className={`room-pet ${petNames ? "" : "empty"}`}>{petNames || t("roomNoPet")}</div>{booking && <div className="room-note">{booking.checkInDate} → {booking.checkOutDate}</div>}{room.status === "cleaning" && <button className="secondary-button pilot-small" disabled={pending} onClick={() => run(t("actionMarkRoomClean"), () => markRoomCleanAction(room.id))}>{t("markRoomClean")}</button>}</article>;
              })}
            </div>}
          </section>
        </>}
        {tab === "bookings" && <section className="pilot-stack">
          {initial.bookingRequests.filter((r) => r.status === "requested").length > 0 && (
            <div className="card panel" style={{ borderLeft: "4px solid #f59e0b" }}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title" style={{ color: "#b45309" }}>
                    {t("requestsHeading", { count: initial.bookingRequests.filter((r) => r.status === "requested").length })}
                  </h2>
                  <div className="panel-subtitle">{t("requestsSubtitle")}</div>
                </div>
                <span className="status-chip chip-occupied">
                  {t("requestsPendingChip", { count: initial.bookingRequests.filter((r) => r.status === "requested").length })}
                </span>
              </div>
              <div className="pilot-list" style={{ marginTop: "1rem" }}>
                {initial.bookingRequests
                  .filter((r) => r.status === "requested")
                  .map((req) => {
                    const owner = ownersById.get(req.ownerId);
                    const room = roomsById.get(req.roomId);
                    const reqPets = req.petIds.map((id) => petsById.get(id)?.name || id).join(", ");
                    return (
                      <article
                        className="card panel"
                        key={req.id}
                        style={{ background: "#fffbeb", border: "1px solid #fef3c7" }}
                      >
                        <div className="panel-header">
                          <div>
                            <h3 className="panel-title">
                              {t("requestRoomLine", { name: owner?.firstName || t("customerFallback"), phone: owner?.phone || "-", room: room?.number || "-" })}
                            </h3>
                            <div className="panel-subtitle">
                              {t("requestDatesLine", { checkIn: req.checkInDate, checkOut: req.checkOutDate, pets: reqPets || t("requestNoPets"), amount: req.totalAmount.toLocaleString() })}
                            </div>
                            {req.specialRequests && (
                              <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.25rem" }}>
                                {t("specialRequestsLabel")} {req.specialRequests}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="pilot-action-row" style={{ marginTop: "0.75rem" }}>
                          <button
                            className="primary-button"
                            disabled={pending}
                            onClick={() => run(t("actionApproveBooking"), () => confirmBookingRequestAction(req.id))}
                          >
                            {t("confirmBooking")}
                          </button>
                          <button
                            className="secondary-button danger"
                            disabled={pending}
                            onClick={() => {
                              const reason = window.prompt(t("declineReasonPrompt"));
                              if (reason !== null) {
                                run(t("actionDeclineBookingRequest"), () => declineBookingRequestAction(req.id, reason));
                              }
                            }}
                          >
                            {t("declineBooking")}
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </div>
          )}

          <form data-testid="booking-create-form" className="card panel pilot-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("actionCreateBooking"), () => createBookingAction({ ownerId: String(f.get("ownerId")), roomId: String(f.get("roomId")), checkInDate: String(f.get("checkInDate")), checkOutDate: String(f.get("checkOutDate")), totalAmount: Number(f.get("totalAmount") || 0), specialRequests: String(f.get("specialRequests") || "") })); }}>
            <h2 className="panel-title">{t("createBookingHeading")}</h2><div className="pilot-grid-4">
              <label>{t("fieldCustomer")}<select name="ownerId" required>{initial.owners.map((o) => <option key={o.id} value={o.id}>{o.firstName} {o.lastName || ""}</option>)}</select></label>
              <label>{t("fieldRoom")}<select name="roomId" required>{initial.rooms.map((r) => <option key={r.id} value={r.id}>{r.number} · {roomTypeLabel[r.type]}</option>)}</select></label>
              <label>Check-in<input name="checkInDate" type="date" defaultValue={initial.businessDate} required /></label>
              <label>Check-out<input name="checkOutDate" type="date" required /></label>
              <label>{t("fieldTotalAmount")}<input name="totalAmount" type="number" min="0" step="0.01" defaultValue="0" /></label>
              <label className="pilot-span-3">{t("fieldSpecialRequests")}<input name="specialRequests" /></label>
            </div><button className="primary-button" disabled={pending || initial.owners.length === 0 || initial.rooms.length === 0}>{t("createBookingButton")}</button>
          </form>
          <div className="pilot-list">
            {initial.bookings.length === 0 && <div className="card panel pilot-empty">{t("noBookings")}</div>}
            {initial.bookings.map((booking) => { const owner = ownersById.get(booking.ownerId); const room = roomsById.get(booking.roomId); const ownerPets = initial.pets.filter((p) => p.ownerId === booking.ownerId); return <article className="card panel" key={booking.id}>
              <div className="panel-header"><div><h3 className="panel-title">{t("bookingRoomTitle", { name: owner?.firstName || t("customerFallback"), room: room?.number || "-" })}</h3><div className="panel-subtitle">{booking.checkInDate} → {booking.checkOutDate} · {booking.status}</div></div><span className={`status-chip chip-${booking.status === "checked_in" ? "occupied" : booking.status === "confirmed" ? "available" : "maintenance"}`}>{booking.status}</span></div>
              <div className="pilot-pets">{t("petsLabel")} {booking.petIds.length ? booking.petIds.map((id) => petsById.get(id)?.name || id).join(", ") : t("petsNotAdded")}</div>
              {booking.status === "confirmed" && <div className="pilot-action-row"><select id={`pet-${booking.id}`} defaultValue=""> <option value="">{t("selectPet")}</option>{ownerPets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="secondary-button" disabled={pending} onClick={() => { const el = document.getElementById(`pet-${booking.id}`) as HTMLSelectElement | null; if (el?.value) run(t("actionAddPetToBooking"), () => addPetToBookingAction(booking.id, el.value)); }}>{t("addPetToBooking")}</button>{booking.petIds.map((petId) => <button key={petId} className="secondary-button" disabled={pending} onClick={() => run(t("actionRemovePetFromBooking"), () => removePetFromBookingAction(booking.id, petId))}>{t("removePetFromBooking", { name: petsById.get(petId)?.name || t("petFallback") })}</button>)}</div>}
              {booking.status === "confirmed" && <form className="pilot-grid-4 pilot-inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("actionRescheduleBooking"), () => updateBookingScheduleAction({ bookingId: booking.id, roomId: String(f.get("roomId")), checkInDate: String(f.get("checkInDate")), checkOutDate: String(f.get("checkOutDate")), totalAmount: Number(f.get("totalAmount") || booking.totalAmount), specialRequests: booking.specialRequests })); }}>
                <label>{t("fieldRoom")}<select name="roomId" defaultValue={booking.roomId}>{initial.rooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}</select></label>
                <label>Check-in<input name="checkInDate" type="date" defaultValue={booking.checkInDate} required /></label>
                <label>Check-out<input name="checkOutDate" type="date" defaultValue={booking.checkOutDate} required /></label>
                <label>{t("fieldTotalAmount")}<input name="totalAmount" type="number" min="0" step="0.01" defaultValue={booking.totalAmount} /></label>
                <button className="secondary-button" disabled={pending}>{t("saveSchedule")}</button>
              </form>}
              <div className="pilot-action-row">
                {booking.status === "confirmed" && <button className="primary-button" disabled={pending || booking.petIds.length === 0} onClick={() => run(t("actionCheckIn"), () => updateBookingStatusAction(booking.id, "checked_in"))}>Check-in</button>}
                {booking.status === "confirmed" && <button className="secondary-button danger" disabled={pending} onClick={() => { if (window.confirm(t("noticeCancelBookingConfirm"))) run(t("actionCancelBooking"), () => updateBookingStatusAction(booking.id, "cancelled")); }}>Cancel</button>}
                {booking.status === "checked_in" && <button className="primary-button" disabled={pending} onClick={() => run(t("actionCheckOut"), () => updateBookingStatusAction(booking.id, "checked_out"))}>Check-out</button>}
              </div>
            </article>; })}
          </div>
        </section>}
        {tab === "customers" && <section className="pilot-stack">
          <form data-testid="owner-create-form" className="card panel pilot-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("actionAddCustomer"), () => createOwnerAction({ firstName: String(f.get("firstName")), lastName: String(f.get("lastName") || ""), phone: String(f.get("phone")), emergencyPhone: String(f.get("emergencyPhone") || ""), address: String(f.get("address") || "") })); }}>
            <h2 className="panel-title">{t("createOwnerHeading")}</h2><div className="pilot-grid-4"><label>{t("fieldFirstName")}<input name="firstName" required /></label><label>{t("fieldLastName")}<input name="lastName" /></label><label>{t("fieldPhone")}<input name="phone" required /></label><label>{t("fieldEmergencyPhone")}<input name="emergencyPhone" /></label><label className="pilot-span-4">{t("fieldAddress")}<input name="address" /></label></div><button className="primary-button" disabled={pending}>{t("saveOwner")}</button>
          </form>
          {initial.owners.map((owner) => <article className="card panel" key={owner.id}>
            <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("actionUpdateCustomer"), () => updateOwnerAction({ ownerId: owner.id, firstName: String(f.get("firstName")), lastName: String(f.get("lastName") || ""), phone: String(f.get("phone")), emergencyPhone: String(f.get("emergencyPhone") || ""), address: String(f.get("address") || "") })); }}>
              <div className="panel-header"><div><h3 className="panel-title">{owner.firstName} {owner.lastName || ""}</h3><div className="panel-subtitle">LINE {owner.lineLinked ? t("lineLinked") : t("lineNotLinked")}</div></div><button className="secondary-button" disabled={pending}>{t("saveOwnerData")}</button></div>
              <div className="pilot-grid-4"><label>{t("fieldFirstName")}<input name="firstName" defaultValue={owner.firstName} required /></label><label>{t("fieldLastName")}<input name="lastName" defaultValue={owner.lastName || ""} /></label><label>{t("fieldPhone")}<input name="phone" defaultValue={owner.phone} required /></label><label>{t("fieldEmergencyPhone")}<input name="emergencyPhone" defaultValue={owner.emergencyPhone || ""} /></label><label className="pilot-span-4">{t("fieldAddress")}<input name="address" defaultValue={owner.address || ""} /></label></div>
            </form>
            <div className="pilot-action-row"><button className="secondary-button" disabled={pending || owner.lineLinked} onClick={() => startTransition(async () => { const r = await generateLineClaimTokenAction(owner.id); if (r.success && r.data) { setClaimToken(r.data.claimToken); setNotice({ kind: "ok", text: t("noticeClaimTokenCreated") }); } else setNotice({ kind: "error", text: r.error || t("noticeClaimTokenFailed") }); })}>{t("createLineClaim")}</button>{canManage && owner.lineLinked && <button className="secondary-button danger" disabled={pending} onClick={() => { if (window.confirm(t("noticeResetLineConfirm"))) run(t("actionResetLineLink"), () => resetLineLinkAction(owner.id)); }}>Reset LINE</button>}</div>
            <div className="pilot-pet-grid">{initial.pets.filter((pet) => pet.ownerId === owner.id).map((pet) => <form className="pilot-pet-card" key={pet.id} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("editPet"), () => updatePetAction(pet.id, { ownerId: owner.id, name: String(f.get("name")), species: String(f.get("species")) as "dog" | "cat", breed: String(f.get("breed") || ""), gender: String(f.get("gender") || "") || null, birthDate: String(f.get("birthDate") || "") || null, weightKg: f.get("weightKg") ? Number(f.get("weightKg")) : null, specialCareNotes: String(f.get("specialCareNotes") || ""), allergies: String(f.get("allergies") || "") })); }}>
              <strong>{pet.name}</strong><div className="pilot-grid-2"><label>{t("speciesNameLabel")}<input name="name" defaultValue={pet.name} required /></label><label>{tSpecies("label")}<select name="species" defaultValue={pet.species}><option value="dog">{tSpecies("dog")}</option><option value="cat">{tSpecies("cat")}</option></select></label><label>{tSpecies("breed")}<input name="breed" defaultValue={pet.breed || ""} /></label><label>{tSpecies("gender")}<input name="gender" defaultValue={pet.gender || ""} /></label><label>{tSpecies("birthDate")}<input name="birthDate" type="date" defaultValue={pet.birthDate || ""} /></label><label>{tSpecies("weight")}<input name="weightKg" type="number" min="0" step="0.01" defaultValue={pet.weightKg ?? ""} /></label><label>{tSpecies("specialCare")}<input name="specialCareNotes" defaultValue={pet.specialCareNotes || ""} /></label><label>{tSpecies("allergies")}<input name="allergies" defaultValue={pet.allergies || ""} /></label></div><button className="secondary-button" disabled={pending}>{t("savePet")}</button>
            </form>)}</div>
            <form className="pilot-inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("actionAddPet"), () => createPetAction({ ownerId: owner.id, name: String(f.get("name")), species: String(f.get("species")) as "dog" | "cat", breed: String(f.get("breed") || ""), specialCareNotes: String(f.get("specialCareNotes") || ""), allergies: String(f.get("allergies") || "") })); }}><div className="pilot-action-row"><input name="name" placeholder={tSpecies("namePlaceholder")} required /><select name="species"><option value="dog">{tSpecies("dog")}</option><option value="cat">{tSpecies("cat")}</option></select><input name="breed" placeholder={tSpecies("breedPlaceholder")} /><input name="specialCareNotes" placeholder={tSpecies("specialCare")} /><input name="allergies" placeholder={tSpecies("allergies")} /><button className="primary-button" disabled={pending}>{t("addPetButton")}</button></div></form>
          </article>)}
          {claimToken && <div className="card panel"><h3 className="panel-title">{t("claimTokenHeading")}</h3><p className="panel-subtitle">{t("claimTokenHint")}</p><code className="pilot-token">{claimToken}</code><button className="secondary-button" onClick={() => setClaimToken(null)}>{t("hideToken")}</button></div>}
        </section>}
        {tab === "reports" && <section className="pilot-stack">
          <form data-testid="report-create-form" className="card panel pilot-form" onSubmit={(e) => { e.preventDefault(); void submitDailyReport(e.currentTarget); }}>
            <h2 className="panel-title">{t("createReportHeading")}</h2><div className="pilot-grid-4">
              <label>Booking<select name="bookingId" required>{initial.bookings.filter((b) => b.status === "checked_in").map((b) => <option key={b.id} value={b.id}>{ownersById.get(b.ownerId)?.firstName || t("customerFallback")} · {roomsById.get(b.roomId)?.number || "-"}</option>)}</select></label>
              <label>{t("fieldPet")}<select name="petId" required>{initial.pets.filter((p) => initial.bookings.some((b) => b.status === "checked_in" && b.petIds.includes(p.id))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label>{t("fieldFood")}<select name="foodStatus"><option value="finished">{tDailyReport("foodStatus.finished")}</option><option value="half">{tDailyReport("foodStatus.half")}</option><option value="little">{tDailyReport("foodStatus.little")}</option><option value="refused">{tDailyReport("foodStatus.refused")}</option></select></label>
              <label>{t("fieldExcretion")}<select name="excretionStatus"><option value="normal">{tDailyReport("excretionStatus.normal")}</option><option value="diarrhea">{tDailyReport("excretionStatus.diarrhea")}</option><option value="none">{tDailyReport("excretionStatus.none")}</option></select></label>
              <label>{t("fieldMood")}<select name="moodStatus"><option value="happy">{tDailyReport("moodStatus.happy")}</option><option value="calm">{tDailyReport("moodStatus.calm")}</option><option value="stressed">{tDailyReport("moodStatus.stressed")}</option></select></label>
              <label className="pilot-span-3">Note<input name="staffNotes" maxLength={4000} /></label>
              <label className="pilot-span-4">{t("fieldPhotos")}<input name="photos" type="file" accept="image/*" multiple required /></label>
            </div><button className="primary-button" disabled={pending || !initial.bookings.some((b) => b.status === "checked_in")}>{t("createReportButton")}</button>
          </form>
          <div className="pilot-list">{initial.reports.map((report) => <article className="card panel" key={report.id}><div className="panel-header"><div><h3 className="panel-title">{petsById.get(report.petId)?.name || t("petFallbackSingle")} · {report.reportDate}</h3><div className="panel-subtitle">{t("reportSummaryLine", { food: report.foodStatus, excretion: report.excretionStatus, mood: report.moodStatus })}</div></div><span className={`status-chip chip-${report.deliveryStatus === "sent" ? "available" : report.deliveryStatus === "failed" ? "maintenance" : "cleaning"}`}>{report.deliveryStatus}</span></div>{report.staffNotes && <p className="pilot-copy">{report.staffNotes}</p>}<div className="pilot-action-row"><span className="panel-subtitle">{t("retryCount", { count: report.retryCount })}</span>{report.deliveryStatus === "failed" && <button className="secondary-button" disabled={pending} onClick={() => run(t("actionRetryDailyReport"), () => retryDailyReportDeliveryAction(report.id))}>{t("retryDelivery")}</button>}</div></article>)}</div>
        </section>}
        {tab === "setup" && <section className="pilot-stack">
          {!canManage && <div className="card panel pilot-empty">{t("staffNoPermission")}</div>}
          {canManage && <form data-testid="room-create-form" className="card panel pilot-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("actionCreateRoom"), () => createRoomAction({ roomNumber: String(f.get("roomNumber")), roomType: String(f.get("roomType")) as RoomType, capacityPets: Number(f.get("capacityPets")), basePricePerNight: Number(f.get("basePricePerNight")) })); }}><h2 className="panel-title">{t("roomSetupHeading")}</h2><div className="pilot-grid-4"><label>{t("roomNumberLabel")}<input name="roomNumber" required /></label><label>{t("roomTypeLabel")}<select name="roomType"><option value="standard">Standard</option><option value="deluxe">Deluxe</option><option value="vip">VIP</option><option value="cat_condo">Cat Condo</option></select></label><label>{t("capacityLabel")}<input name="capacityPets" type="number" min="1" defaultValue="1" required /></label><label>{t("pricePerNightLabel")}<input name="basePricePerNight" type="number" min="0" step="0.01" defaultValue="0" required /></label></div><button className="primary-button" disabled={pending}>{t("addRoomButton")}</button></form>}
          {canManage && initial.rooms.map((room) => <article className="card panel" key={room.id}><form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("actionUpdateRoom"), () => updateRoomAction({ roomId: room.id, roomNumber: String(f.get("roomNumber")), roomType: String(f.get("roomType")) as RoomType, capacityPets: Number(f.get("capacityPets")), basePricePerNight: Number(f.get("basePricePerNight")) })); }}><div className="pilot-grid-4"><label>{t("roomNumberLabel")}<input name="roomNumber" defaultValue={room.number} required /></label><label>{t("roomTypeLabel")}<select name="roomType" defaultValue={room.type}>{Object.entries(roomTypeLabel).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>{t("capacityLabel")}<input name="capacityPets" type="number" min="1" defaultValue={room.capacity} required /></label><label>{t("priceLabel")}<input name="basePricePerNight" type="number" min="0" step="0.01" defaultValue={room.price} required /></label></div><div className="pilot-action-row"><button className="secondary-button" disabled={pending}>{t("saveConfig")}</button></div></form><form className="pilot-inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("actionSetMaintenance"), () => setRoomMaintenanceAction({ roomId: room.id, from: String(f.get("from")) || null, until: String(f.get("until")) || null })); }}><div className="pilot-action-row"><input name="from" type="date" defaultValue={room.maintenanceFrom || ""} /><input name="until" type="date" defaultValue={room.maintenanceUntil || ""} /><button className="secondary-button" disabled={pending}>{t("saveMaintenance")}</button><button type="button" className="secondary-button" disabled={pending} onClick={() => run(t("actionClearMaintenance"), () => setRoomMaintenanceAction({ roomId: room.id, from: null, until: null }))}>{t("clear")}</button></div></form></article>)}
          {isOwner && <div className="card panel"><h2 className="panel-title">{t("staffManagementHeading")}</h2><form data-testid="staff-invite-form" className="pilot-inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("actionInviteStaff"), () => inviteStaffAction({ email: String(f.get("email")), name: String(f.get("name")), role: String(f.get("role")) as "owner" | "manager" | "staff", password: String(f.get("password") || "") || undefined })); }}><div className="pilot-action-row"><input name="email" type="email" placeholder="email" required /><input name="name" placeholder={t("staffNamePlaceholder")} required /><input name="password" type="password" placeholder={t("staffPasswordPlaceholder")} /><select name="role"><option value="staff">Staff</option><option value="manager">Manager</option><option value="owner">Owner</option></select><button className="primary-button" disabled={pending}>{t("invite")}</button></div></form><div className="pilot-list compact">{initial.staffMembers.map((member) => <div className="pilot-staff-row" key={member.id}><div><strong>{member.name}</strong><div className="panel-subtitle">{member.email} · {member.role} · {member.isActive ? tRoles("active") : tRoles("disabled")}</div></div><div className="pilot-action-row"><select defaultValue={member.role} onChange={(e) => run(t("actionChangeRole"), () => changeStaffRoleAction(member.id, e.target.value as "owner" | "manager" | "staff"))}><option value="owner">Owner</option><option value="manager">Manager</option><option value="staff">Staff</option></select>{member.isActive ? <button className="secondary-button" disabled={pending} onClick={() => run(t("actionDisableStaff"), () => disableStaffAction(member.id))}>Disable</button> : <button className="secondary-button" disabled={pending} onClick={() => run(t("actionEnableStaff"), () => enableStaffAction(member.id))}>Enable</button>}<button className="secondary-button danger" disabled={pending} onClick={() => { if (window.confirm(t("confirmRemoveStaff", { name: member.name }))) run(t("actionRemoveStaff"), () => removeStaffAction(member.id)); }}>Remove</button></div></div>)}</div></div>}
          {canManage && <div className="card panel"><h2 className="panel-title">Google Sheets</h2><p className="panel-subtitle">{t("sheetsSubtitle")}</p><div className="pilot-action-row"><button className="secondary-button" disabled={pending} onClick={() => startTransition(async () => { const r = await generateGoogleSheetClaimAction(); if (r.success) { setSheetToken(r.token); setNotice({ kind: "ok", text: t("noticeSheetTokenCreated") }); } else setNotice({ kind: "error", text: r.error }); })}>{t("createVerificationToken")}</button>{initial.shop.googleSheetsConnected && <button className="secondary-button danger" disabled={pending} onClick={() => { if (window.confirm(t("noticeDisconnectSheetConfirm"))) run(t("actionDisconnectSheet"), disconnectGoogleSheetAction); }}>Disconnect</button>}</div>{sheetToken && <><code className="pilot-token">{sheetToken}</code><form className="pilot-inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(t("actionBindSheet"), () => bindGoogleSheetAction(String(f.get("sheetId")))); }}><div className="pilot-action-row"><input name="sheetId" placeholder={t("sheetIdPlaceholder")} required /><button className="primary-button" disabled={pending}>{t("verifyAndBind")}</button></div></form></>}</div>}
        </section>}
      </main>
    </div>
  );
}
