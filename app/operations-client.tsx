"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OperationsDTO, RoomType } from "@/lib/operations-service";
import { logoutAction } from "@/app/actions/auth";
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
const roomStatusLabel = { available: "ว่าง", occupied: "มีสัตว์พัก", cleaning: "รอทำความสะอาด", maintenance: "ปิดปรับปรุง" } as const;

export default function OperationsClient({ initial }: { initial: OperationsDTO }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [sheetToken, setSheetToken] = useState<string | null>(null);
  const canManage = initial.staff.role === "owner" || initial.staff.role === "manager";
  const isOwner = initial.staff.role === "owner";

  const ownersById = useMemo(() => new Map(initial.owners.map((o) => [o.id, o])), [initial.owners]);
  const petsById = useMemo(() => new Map(initial.pets.map((p) => [p.id, p])), [initial.pets]);
  const roomsById = useMemo(() => new Map(initial.rooms.map((r) => [r.id, r])), [initial.rooms]);
  const activeBookings = initial.bookings.filter((b) => b.status === "confirmed" || b.status === "checked_in");

  function run(label: string, task: () => Promise<ActionLike>) {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await task();
        if (!result.success) setNotice({ kind: "error", text: result.error || `${label} ไม่สำเร็จ` });
        else {
          setNotice({ kind: "ok", text: `${label} สำเร็จ` });
          router.refresh();
        }
      } catch {
        setNotice({ kind: "error", text: `${label} ล้มเหลวจากการเชื่อมต่อ` });
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
          setNotice({ kind: "error", text: body.error || body.code || "ส่ง Daily Report ไม่สำเร็จ" });
          return;
        }
        form.reset();
        setNotice({ kind: "ok", text: "สร้าง Daily Report แล้ว" });
        router.refresh();
      } catch {
        setNotice({ kind: "error", text: "ส่ง Daily Report ไม่สำเร็จจากการเชื่อมต่อ" });
      }
    });
  }

  const tabs: Array<[Tab, string]> = [
    ["overview", "ภาพรวม"], ["bookings", "การจอง"], ["customers", "ลูกค้า & สัตว์"], ["reports", "Daily Report"], ["setup", "ตั้งค่าร้าน"],
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">P</div><div className="brand-copy"><div className="brand-name">PawSpace</div><div className="brand-caption">PILOT OPERATIONS</div></div></div>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list" aria-label="เมนูหลัก">
          {tabs.map(([id, label]) => <button key={id} data-testid={`tab-${id}`} className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="shop-card"><div className="shop-name">{initial.shop.name}</div><div className="shop-detail">{initial.staff.name} · {initial.staff.role}</div><div className="shop-detail">Business date {initial.businessDate}</div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><div className="eyebrow">{initial.businessDate} · Asia/Bangkok</div><h1 className="page-title">{initial.shop.name}</h1><div className="page-subtitle">ระบบปฏิบัติการหน้าร้าน · ข้อมูลจริงจาก tenant ปัจจุบัน</div></div>
          <div className="header-actions"><button className="secondary-button" disabled={pending} onClick={() => run("ออกจากระบบ", async () => { const r = await logoutAction(); if (r.success) { router.push("/login"); router.refresh(); } return r; })}>ออกจากระบบ</button></div>
        </header>
        {notice && <div className={`pilot-notice ${notice.kind}`} role="status">{notice.text}</div>}
        {pending && <div className="pilot-loading" role="status">กำลังประมวลผล…</div>}
        {tab === "overview" && <>
          <section className="kpi-grid">
            <div className="card kpi-card"><div className="kpi-label">ห้องทั้งหมด</div><strong className="kpi-value">{initial.rooms.length}</strong><div className="kpi-meta">ว่าง {initial.rooms.filter((r) => r.status === "available").length}</div></div>
            <div className="card kpi-card"><div className="kpi-label">กำลังเข้าพัก</div><strong className="kpi-value">{initial.bookings.filter((b) => b.status === "checked_in").length}</strong><div className="kpi-meta">Confirmed {initial.bookings.filter((b) => b.status === "confirmed").length}</div></div>
            <div className="card kpi-card"><div className="kpi-label">Daily Report วันนี้</div><strong className="kpi-value">{initial.reports.filter((r) => r.reportDate === initial.businessDate).length}</strong><div className="kpi-meta">Sent {initial.reports.filter((r) => r.reportDate === initial.businessDate && r.deliveryStatus === "sent").length}</div></div>
            <div className="card kpi-card"><div className="kpi-label">Google Sheets</div><strong className="kpi-value pilot-kpi-text">{initial.shop.googleSheetsConnected ? "เชื่อมแล้ว" : "ยังไม่เชื่อม"}</strong><div className="kpi-meta">LINE {initial.shop.lineConfigured ? "configured" : "not configured"}</div></div>
          </section>
          <section className="card panel pilot-section">
            <div className="panel-header"><div><h2 className="panel-title">Room Matrix</h2><div className="panel-subtitle">สถานะจริงจากฐานข้อมูล</div></div></div>
            {initial.rooms.length === 0 ? <div className="pilot-empty">ยังไม่มีห้อง · Owner/Manager เพิ่มห้องได้ที่ตั้งค่าร้าน</div> : <div className="room-grid">
              {initial.rooms.map((room) => {
                const booking = activeBookings.find((b) => b.roomId === room.id);
                const petNames = booking?.petIds.map((id) => petsById.get(id)?.name).filter(Boolean).join(", ");
                return <article className="room-card" key={room.id}><div className="room-top"><div><div className="room-number">{room.number}</div><div className="room-type">{roomTypeLabel[room.type]}</div></div><span className={`status-chip chip-${room.status}`}>{roomStatusLabel[room.status]}</span></div><div className={`room-pet ${petNames ? "" : "empty"}`}>{petNames || "ไม่มีสัตว์พัก"}</div>{booking && <div className="room-note">{booking.checkInDate} → {booking.checkOutDate}</div>}{room.status === "cleaning" && <button className="secondary-button pilot-small" disabled={pending} onClick={() => run("ทำเครื่องหมายห้องสะอาด", () => markRoomCleanAction(room.id))}>Mark clean</button>}</article>;
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
                    คำขอจองจากลูกค้าทาง LINE ({initial.bookingRequests.filter((r) => r.status === "requested").length})
                  </h2>
                  <div className="panel-subtitle">รอการยืนยันหรือปฏิเสธเพื่อจัดสรรห้องพัก</div>
                </div>
                <span className="status-chip chip-occupied">
                  {initial.bookingRequests.filter((r) => r.status === "requested").length} คำขอรอยืนยัน
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
                              {owner?.firstName || "ลูกค้า"} ({owner?.phone || "-"}) · ขอจองห้อง {room?.number || "-"}
                            </h3>
                            <div className="panel-subtitle">
                              {req.checkInDate} → {req.checkOutDate} · สัตว์: {reqPets || "ไม่มีระบุ"} · ยอดประเมิน ฿{req.totalAmount.toLocaleString()}
                            </div>
                            {req.specialRequests && (
                              <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.25rem" }}>
                                คำขอพิเศษ: {req.specialRequests}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="pilot-action-row" style={{ marginTop: "0.75rem" }}>
                          <button
                            className="primary-button"
                            disabled={pending}
                            onClick={() => run("อนุมัติการจอง", () => confirmBookingRequestAction(req.id))}
                          >
                            ✓ ยืนยันการจอง (Confirm)
                          </button>
                          <button
                            className="secondary-button danger"
                            disabled={pending}
                            onClick={() => {
                              const reason = window.prompt("เหตุผลในการปฏิเสธ (optional):");
                              if (reason !== null) {
                                run("ปฏิเสธคำขอจอง", () => declineBookingRequestAction(req.id, reason));
                              }
                            }}
                          >
                            ✕ ปฏิเสธ (Decline)
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </div>
          )}

          <form data-testid="booking-create-form" className="card panel pilot-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("สร้างการจอง", () => createBookingAction({ ownerId: String(f.get("ownerId")), roomId: String(f.get("roomId")), checkInDate: String(f.get("checkInDate")), checkOutDate: String(f.get("checkOutDate")), totalAmount: Number(f.get("totalAmount") || 0), specialRequests: String(f.get("specialRequests") || "") })); }}>
            <h2 className="panel-title">สร้างการจอง</h2><div className="pilot-grid-4">
              <label>ลูกค้า<select name="ownerId" required>{initial.owners.map((o) => <option key={o.id} value={o.id}>{o.firstName} {o.lastName || ""}</option>)}</select></label>
              <label>ห้อง<select name="roomId" required>{initial.rooms.map((r) => <option key={r.id} value={r.id}>{r.number} · {roomTypeLabel[r.type]}</option>)}</select></label>
              <label>Check-in<input name="checkInDate" type="date" defaultValue={initial.businessDate} required /></label>
              <label>Check-out<input name="checkOutDate" type="date" required /></label>
              <label>ยอดรวม<input name="totalAmount" type="number" min="0" step="0.01" defaultValue="0" /></label>
              <label className="pilot-span-3">คำขอพิเศษ<input name="specialRequests" /></label>
            </div><button className="primary-button" disabled={pending || initial.owners.length === 0 || initial.rooms.length === 0}>สร้าง Booking</button>
          </form>
          <div className="pilot-list">
            {initial.bookings.length === 0 && <div className="card panel pilot-empty">ยังไม่มีการจอง</div>}
            {initial.bookings.map((booking) => { const owner = ownersById.get(booking.ownerId); const room = roomsById.get(booking.roomId); const ownerPets = initial.pets.filter((p) => p.ownerId === booking.ownerId); return <article className="card panel" key={booking.id}>
              <div className="panel-header"><div><h3 className="panel-title">{owner?.firstName || "ลูกค้า"} · ห้อง {room?.number || "-"}</h3><div className="panel-subtitle">{booking.checkInDate} → {booking.checkOutDate} · {booking.status}</div></div><span className={`status-chip chip-${booking.status === "checked_in" ? "occupied" : booking.status === "confirmed" ? "available" : "maintenance"}`}>{booking.status}</span></div>
              <div className="pilot-pets">สัตว์: {booking.petIds.length ? booking.petIds.map((id) => petsById.get(id)?.name || id).join(", ") : "ยังไม่ได้เพิ่ม"}</div>
              {booking.status === "confirmed" && <div className="pilot-action-row"><select id={`pet-${booking.id}`} defaultValue=""> <option value="">เลือกสัตว์</option>{ownerPets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="secondary-button" disabled={pending} onClick={() => { const el = document.getElementById(`pet-${booking.id}`) as HTMLSelectElement | null; if (el?.value) run("เพิ่มสัตว์ใน booking", () => addPetToBookingAction(booking.id, el.value)); }}>เพิ่มสัตว์</button>{booking.petIds.map((petId) => <button key={petId} className="secondary-button" disabled={pending} onClick={() => run("ถอดสัตว์จาก booking", () => removePetFromBookingAction(booking.id, petId))}>ถอด {petsById.get(petId)?.name || "สัตว์"}</button>)}</div>}
              {booking.status === "confirmed" && <form className="pilot-grid-4 pilot-inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("เลื่อนการจอง", () => updateBookingScheduleAction({ bookingId: booking.id, roomId: String(f.get("roomId")), checkInDate: String(f.get("checkInDate")), checkOutDate: String(f.get("checkOutDate")), totalAmount: Number(f.get("totalAmount") || booking.totalAmount), specialRequests: booking.specialRequests })); }}>
                <label>ห้อง<select name="roomId" defaultValue={booking.roomId}>{initial.rooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}</select></label>
                <label>Check-in<input name="checkInDate" type="date" defaultValue={booking.checkInDate} required /></label>
                <label>Check-out<input name="checkOutDate" type="date" defaultValue={booking.checkOutDate} required /></label>
                <label>ยอดรวม<input name="totalAmount" type="number" min="0" step="0.01" defaultValue={booking.totalAmount} /></label>
                <button className="secondary-button" disabled={pending}>บันทึกกำหนดการ</button>
              </form>}
              <div className="pilot-action-row">
                {booking.status === "confirmed" && <button className="primary-button" disabled={pending || booking.petIds.length === 0} onClick={() => run("เช็คอิน", () => updateBookingStatusAction(booking.id, "checked_in"))}>Check-in</button>}
                {booking.status === "confirmed" && <button className="secondary-button danger" disabled={pending} onClick={() => { if (window.confirm("ยืนยันยกเลิก booking นี้?")) run("ยกเลิก booking", () => updateBookingStatusAction(booking.id, "cancelled")); }}>Cancel</button>}
                {booking.status === "checked_in" && <button className="primary-button" disabled={pending} onClick={() => run("เช็คเอาท์", () => updateBookingStatusAction(booking.id, "checked_out"))}>Check-out</button>}
              </div>
            </article>; })}
          </div>
        </section>}
        {tab === "customers" && <section className="pilot-stack">
          <form data-testid="owner-create-form" className="card panel pilot-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("เพิ่มลูกค้า", () => createOwnerAction({ firstName: String(f.get("firstName")), lastName: String(f.get("lastName") || ""), phone: String(f.get("phone")), emergencyPhone: String(f.get("emergencyPhone") || ""), address: String(f.get("address") || "") })); }}>
            <h2 className="panel-title">เพิ่มลูกค้า</h2><div className="pilot-grid-4"><label>ชื่อ<input name="firstName" required /></label><label>นามสกุล<input name="lastName" /></label><label>โทรศัพท์<input name="phone" required /></label><label>เบอร์ฉุกเฉิน<input name="emergencyPhone" /></label><label className="pilot-span-4">ที่อยู่<input name="address" /></label></div><button className="primary-button" disabled={pending}>บันทึกลูกค้า</button>
          </form>
          {initial.owners.map((owner) => <article className="card panel" key={owner.id}>
            <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("แก้ไขลูกค้า", () => updateOwnerAction({ ownerId: owner.id, firstName: String(f.get("firstName")), lastName: String(f.get("lastName") || ""), phone: String(f.get("phone")), emergencyPhone: String(f.get("emergencyPhone") || ""), address: String(f.get("address") || "") })); }}>
              <div className="panel-header"><div><h3 className="panel-title">{owner.firstName} {owner.lastName || ""}</h3><div className="panel-subtitle">LINE {owner.lineLinked ? "linked" : "not linked"}</div></div><button className="secondary-button" disabled={pending}>บันทึกข้อมูล</button></div>
              <div className="pilot-grid-4"><label>ชื่อ<input name="firstName" defaultValue={owner.firstName} required /></label><label>นามสกุล<input name="lastName" defaultValue={owner.lastName || ""} /></label><label>โทรศัพท์<input name="phone" defaultValue={owner.phone} required /></label><label>เบอร์ฉุกเฉิน<input name="emergencyPhone" defaultValue={owner.emergencyPhone || ""} /></label><label className="pilot-span-4">ที่อยู่<input name="address" defaultValue={owner.address || ""} /></label></div>
            </form>
            <div className="pilot-action-row"><button className="secondary-button" disabled={pending || owner.lineLinked} onClick={() => startTransition(async () => { const r = await generateLineClaimTokenAction(owner.id); if (r.success && r.data) { setClaimToken(r.data.claimToken); setNotice({ kind: "ok", text: "สร้าง LINE claim token แล้ว · อายุ 48 ชั่วโมง" }); } else setNotice({ kind: "error", text: r.error || "สร้าง token ไม่สำเร็จ" }); })}>สร้าง LINE claim</button>{canManage && owner.lineLinked && <button className="secondary-button danger" disabled={pending} onClick={() => { if (window.confirm("ยืนยัน reset LINE link?")) run("Reset LINE link", () => resetLineLinkAction(owner.id)); }}>Reset LINE</button>}</div>
            <div className="pilot-pet-grid">{initial.pets.filter((pet) => pet.ownerId === owner.id).map((pet) => <form className="pilot-pet-card" key={pet.id} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("แก้ไขสัตว์", () => updatePetAction(pet.id, { ownerId: owner.id, name: String(f.get("name")), species: String(f.get("species")) as "dog" | "cat", breed: String(f.get("breed") || ""), gender: String(f.get("gender") || "") || null, birthDate: String(f.get("birthDate") || "") || null, weightKg: f.get("weightKg") ? Number(f.get("weightKg")) : null, specialCareNotes: String(f.get("specialCareNotes") || ""), allergies: String(f.get("allergies") || "") })); }}>
              <strong>{pet.name}</strong><div className="pilot-grid-2"><label>ชื่อ<input name="name" defaultValue={pet.name} required /></label><label>ชนิด<select name="species" defaultValue={pet.species}><option value="dog">สุนัข</option><option value="cat">แมว</option></select></label><label>สายพันธุ์<input name="breed" defaultValue={pet.breed || ""} /></label><label>เพศ<input name="gender" defaultValue={pet.gender || ""} /></label><label>วันเกิด<input name="birthDate" type="date" defaultValue={pet.birthDate || ""} /></label><label>น้ำหนัก<input name="weightKg" type="number" min="0" step="0.01" defaultValue={pet.weightKg ?? ""} /></label><label>การดูแลพิเศษ<input name="specialCareNotes" defaultValue={pet.specialCareNotes || ""} /></label><label>แพ้<input name="allergies" defaultValue={pet.allergies || ""} /></label></div><button className="secondary-button" disabled={pending}>บันทึกสัตว์</button>
            </form>)}</div>
            <form className="pilot-inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("เพิ่มสัตว์", () => createPetAction({ ownerId: owner.id, name: String(f.get("name")), species: String(f.get("species")) as "dog" | "cat", breed: String(f.get("breed") || ""), specialCareNotes: String(f.get("specialCareNotes") || ""), allergies: String(f.get("allergies") || "") })); }}><div className="pilot-action-row"><input name="name" placeholder="ชื่อสัตว์" required /><select name="species"><option value="dog">สุนัข</option><option value="cat">แมว</option></select><input name="breed" placeholder="สายพันธุ์" /><input name="specialCareNotes" placeholder="การดูแลพิเศษ" /><input name="allergies" placeholder="แพ้" /><button className="primary-button" disabled={pending}>+ เพิ่มสัตว์</button></div></form>
          </article>)}
          {claimToken && <div className="card panel"><h3 className="panel-title">LINE claim token</h3><p className="panel-subtitle">แสดงเฉพาะครั้งนี้เพื่อส่งเข้า claim flow ห้ามบันทึกลง log</p><code className="pilot-token">{claimToken}</code><button className="secondary-button" onClick={() => setClaimToken(null)}>ซ่อน token</button></div>}
        </section>}
        {tab === "reports" && <section className="pilot-stack">
          <form data-testid="report-create-form" className="card panel pilot-form" onSubmit={(e) => { e.preventDefault(); void submitDailyReport(e.currentTarget); }}>
            <h2 className="panel-title">สร้าง Daily Report</h2><div className="pilot-grid-4">
              <label>Booking<select name="bookingId" required>{initial.bookings.filter((b) => b.status === "checked_in").map((b) => <option key={b.id} value={b.id}>{ownersById.get(b.ownerId)?.firstName || "ลูกค้า"} · {roomsById.get(b.roomId)?.number || "-"}</option>)}</select></label>
              <label>สัตว์<select name="petId" required>{initial.pets.filter((p) => initial.bookings.some((b) => b.status === "checked_in" && b.petIds.includes(p.id))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label>อาหาร<select name="foodStatus"><option value="finished">กินหมด</option><option value="half">ครึ่งหนึ่ง</option><option value="little">กินน้อย</option><option value="refused">ไม่กิน</option></select></label>
              <label>ขับถ่าย<select name="excretionStatus"><option value="normal">ปกติ</option><option value="diarrhea">ถ่ายเหลว</option><option value="none">ยังไม่ถ่าย</option></select></label>
              <label>อารมณ์<select name="moodStatus"><option value="happy">ร่าเริง</option><option value="calm">สงบ</option><option value="stressed">เครียด</option></select></label>
              <label className="pilot-span-3">Note<input name="staffNotes" maxLength={4000} /></label>
              <label className="pilot-span-4">รูป 1–4 รูป<input name="photos" type="file" accept="image/*" multiple required /></label>
            </div><button className="primary-button" disabled={pending || !initial.bookings.some((b) => b.status === "checked_in")}>สร้างและเข้าคิวส่ง LINE</button>
          </form>
          <div className="pilot-list">{initial.reports.map((report) => <article className="card panel" key={report.id}><div className="panel-header"><div><h3 className="panel-title">{petsById.get(report.petId)?.name || "Pet"} · {report.reportDate}</h3><div className="panel-subtitle">อาหาร {report.foodStatus} · ขับถ่าย {report.excretionStatus} · อารมณ์ {report.moodStatus}</div></div><span className={`status-chip chip-${report.deliveryStatus === "sent" ? "available" : report.deliveryStatus === "failed" ? "maintenance" : "cleaning"}`}>{report.deliveryStatus}</span></div>{report.staffNotes && <p className="pilot-copy">{report.staffNotes}</p>}<div className="pilot-action-row"><span className="panel-subtitle">Retry count {report.retryCount}</span>{report.deliveryStatus === "failed" && <button className="secondary-button" disabled={pending} onClick={() => run("Retry Daily Report", () => retryDailyReportDeliveryAction(report.id))}>Retry delivery</button>}</div></article>)}</div>
        </section>}
        {tab === "setup" && <section className="pilot-stack">
          {!canManage && <div className="card panel pilot-empty">สิทธิ์ Staff ใช้งาน core operations ได้ แต่ไม่มีสิทธิ์ตั้งค่าห้องหรือ integration</div>}
          {canManage && <form data-testid="room-create-form" className="card panel pilot-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("เพิ่มห้อง", () => createRoomAction({ roomNumber: String(f.get("roomNumber")), roomType: String(f.get("roomType")) as RoomType, capacityPets: Number(f.get("capacityPets")), basePricePerNight: Number(f.get("basePricePerNight")) })); }}><h2 className="panel-title">Room setup</h2><div className="pilot-grid-4"><label>เลขห้อง<input name="roomNumber" required /></label><label>ประเภท<select name="roomType"><option value="standard">Standard</option><option value="deluxe">Deluxe</option><option value="vip">VIP</option><option value="cat_condo">Cat Condo</option></select></label><label>ความจุ<input name="capacityPets" type="number" min="1" defaultValue="1" required /></label><label>ราคาต่อคืน<input name="basePricePerNight" type="number" min="0" step="0.01" defaultValue="0" required /></label></div><button className="primary-button" disabled={pending}>เพิ่มห้อง</button></form>}
          {canManage && initial.rooms.map((room) => <article className="card panel" key={room.id}><form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("แก้ไขห้อง", () => updateRoomAction({ roomId: room.id, roomNumber: String(f.get("roomNumber")), roomType: String(f.get("roomType")) as RoomType, capacityPets: Number(f.get("capacityPets")), basePricePerNight: Number(f.get("basePricePerNight")) })); }}><div className="pilot-grid-4"><label>เลขห้อง<input name="roomNumber" defaultValue={room.number} required /></label><label>ประเภท<select name="roomType" defaultValue={room.type}>{Object.entries(roomTypeLabel).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>ความจุ<input name="capacityPets" type="number" min="1" defaultValue={room.capacity} required /></label><label>ราคา<input name="basePricePerNight" type="number" min="0" step="0.01" defaultValue={room.price} required /></label></div><div className="pilot-action-row"><button className="secondary-button" disabled={pending}>บันทึก config</button></div></form><form className="pilot-inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("ตั้ง maintenance", () => setRoomMaintenanceAction({ roomId: room.id, from: String(f.get("from")) || null, until: String(f.get("until")) || null })); }}><div className="pilot-action-row"><input name="from" type="date" defaultValue={room.maintenanceFrom || ""} /><input name="until" type="date" defaultValue={room.maintenanceUntil || ""} /><button className="secondary-button" disabled={pending}>บันทึก maintenance</button><button type="button" className="secondary-button" disabled={pending} onClick={() => run("ล้าง maintenance", () => setRoomMaintenanceAction({ roomId: room.id, from: null, until: null }))}>Clear</button></div></form></article>)}
          {isOwner && <div className="card panel"><h2 className="panel-title">Staff management</h2><form data-testid="staff-invite-form" className="pilot-inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("เชิญ staff", () => inviteStaffAction({ email: String(f.get("email")), name: String(f.get("name")), role: String(f.get("role")) as "owner" | "manager" | "staff", password: String(f.get("password") || "") || undefined })); }}><div className="pilot-action-row"><input name="email" type="email" placeholder="email" required /><input name="name" placeholder="ชื่อ" required /><input name="password" type="password" placeholder="รหัสผ่านชั่วคราว (optional)" /><select name="role"><option value="staff">Staff</option><option value="manager">Manager</option><option value="owner">Owner</option></select><button className="primary-button" disabled={pending}>Invite</button></div></form><div className="pilot-list compact">{initial.staffMembers.map((member) => <div className="pilot-staff-row" key={member.id}><div><strong>{member.name}</strong><div className="panel-subtitle">{member.email} · {member.role} · {member.isActive ? "active" : "disabled"}</div></div><div className="pilot-action-row"><select defaultValue={member.role} onChange={(e) => run("เปลี่ยน role", () => changeStaffRoleAction(member.id, e.target.value as "owner" | "manager" | "staff"))}><option value="owner">Owner</option><option value="manager">Manager</option><option value="staff">Staff</option></select>{member.isActive ? <button className="secondary-button" disabled={pending} onClick={() => run("Disable staff", () => disableStaffAction(member.id))}>Disable</button> : <button className="secondary-button" disabled={pending} onClick={() => run("Enable staff", () => enableStaffAction(member.id))}>Enable</button>}<button className="secondary-button danger" disabled={pending} onClick={() => { if (window.confirm(`ยืนยันลบ ${member.name} ออกจากร้าน?`)) run("Remove staff", () => removeStaffAction(member.id)); }}>Remove</button></div></div>)}</div></div>}
          {canManage && <div className="card panel"><h2 className="panel-title">Google Sheets</h2><p className="panel-subtitle">Verified proof-of-control เท่านั้น · PawSpace_Config!B1</p><div className="pilot-action-row"><button className="secondary-button" disabled={pending} onClick={() => startTransition(async () => { const r = await generateGoogleSheetClaimAction(); if (r.success) { setSheetToken(r.token); setNotice({ kind: "ok", text: "สร้าง Google Sheet verification token แล้ว" }); } else setNotice({ kind: "error", text: r.error }); })}>สร้าง verification token</button>{initial.shop.googleSheetsConnected && <button className="secondary-button danger" disabled={pending} onClick={() => { if (window.confirm("ยืนยัน disconnect Google Sheet?")) run("Disconnect Google Sheet", disconnectGoogleSheetAction); }}>Disconnect</button>}</div>{sheetToken && <><code className="pilot-token">{sheetToken}</code><form className="pilot-inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("Bind Google Sheet", () => bindGoogleSheetAction(String(f.get("sheetId")))); }}><div className="pilot-action-row"><input name="sheetId" placeholder="Google Sheet ID หลังวาง token ที่ B1" required /><button className="primary-button" disabled={pending}>Verify & bind</button></div></form></>}</div>}
        </section>}
      </main>
    </div>
  );
}



