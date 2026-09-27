"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { StaffContext } from "@/lib/tenant-context";
import type { OperationsDTO, RoomType } from "@/lib/operations-service";
import type { PilotReadinessEvaluation } from "@/lib/pilot-readiness-service";
import type { ImportPreviewSummary, ImportExecutionResult } from "@/lib/csv-import-service";
import { LanguageToggle } from "@/app/components/language-toggle";
import {
  previewCsvImportAction,
  executeCsvImportAction,
  getPilotReadinessAction,
  updateShopProfileAction,
} from "@/app/actions/onboarding";
import { createRoomAction } from "@/app/actions/operations";
import { inviteStaffAction } from "@/app/actions/staff";

interface Props {
  initialStaff: StaffContext;
  initialOperations: OperationsDTO;
  initialReadiness: PilotReadinessEvaluation;
}

const SAMPLE_CSV = `first_name,last_name,phone,pet_name,species,breed,gender,birth_date,weight_kg,special_care_notes
Somchai,Jaidee,0812345678,Milo,dog,Golden Retriever,male,2022-05-15,25.5,Loves belly rubs
Somchai,Jaidee,0812345678,Luna,cat,Persian,female,2023-01-10,4.2,Feed renal food only
Wichai,Rattana,0898765432,Kuro,dog,Shiba Inu,neutered_male,2021-08-20,10.0,Allergic to chicken
Arisa,Sombat,0861112233,Mochi,cat,British Shorthair,spayed_female,2024-02-01,3.5,None`;

export default function OnboardingClient({
  initialStaff,
  initialOperations,
  initialReadiness,
}: Props) {
  const t = useTranslations("onboarding");
  const [activeTab, setActiveTab] = useState<"readiness" | "import" | "rooms" | "staff" | "profile">("readiness");
  const [isPending, startTransition] = useTransition();

  const [readiness, setReadiness] = useState<PilotReadinessEvaluation>(initialReadiness);
  const [operations] = useState<OperationsDTO>(initialOperations);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; message: string } | null>(null);

  // CSV Import State
  const [csvInput, setCsvInput] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreviewSummary | null>(null);
  const [importResult, setImportResult] = useState<ImportExecutionResult | null>(null);

  // New Room State
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState<RoomType>("standard");
  const [capacityPets, setCapacityPets] = useState(1);
  const [basePrice, setBasePrice] = useState(500);

  // Invite Staff State
  const [staffEmail, setStaffEmail] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<"manager" | "staff">("staff");
  const [staffPassword, setStaffPassword] = useState("");

  // Profile State
  const [shopName, setShopName] = useState(operations.shop.name);
  const [shopPhone, setShopPhone] = useState(operations.shop.phone || "");
  const [lineOaId, setLineOaId] = useState(operations.shop.lineOaId || "");

  const refreshReadiness = async () => {
    const res = await getPilotReadinessAction();
    if (res.success && res.evaluation) {
      setReadiness(res.evaluation);
    }
  };

  const handlePreviewCsv = () => {
    if (!csvInput.trim()) {
      setNotice({ type: "error", message: t("noticePleaseEnterCsv") });
      return;
    }
    setNotice(null);
    setImportResult(null);

    startTransition(async () => {
      const res = await previewCsvImportAction(csvInput);
      if (res.success && res.preview) {
        setPreview(res.preview);
        setNotice({
          type: "ok",
          message: t("noticePreviewGenerated", { validRows: res.preview.validRows, newCustomers: res.preview.newCustomers, newPets: res.preview.newPets }),
        });
      } else {
        setNotice({ type: "error", message: res.error || t("noticePreviewFailed") });
      }
    });
  };

  const handleExecuteImport = () => {
    if (!preview || preview.validRows === 0) {
      setNotice({ type: "error", message: t("noticeNoValidRows") });
      return;
    }
    setNotice(null);

    startTransition(async () => {
      const res = await executeCsvImportAction(csvInput);
      if (res.success && res.result) {
        setImportResult(res.result);
        setNotice({
          type: "ok",
          message: t("noticeImportComplete", { customers: res.result.createdCustomers, pets: res.result.createdPets, duplicates: res.result.skippedDuplicates }),
        });
        await refreshReadiness();
      } else {
        setNotice({ type: "error", message: res.error || t("noticeImportFailed") });
      }
    });
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim()) {
      setNotice({ type: "error", message: t("noticeRoomNumberRequired") });
      return;
    }
    setNotice(null);

    startTransition(async () => {
      const res = await createRoomAction({
        roomNumber: roomNumber.trim(),
        roomType,
        capacityPets: Number(capacityPets),
        basePricePerNight: Number(basePrice),
      });

      if (res.success) {
        setNotice({ type: "ok", message: t("noticeRoomCreated", { roomNumber }) });
        setRoomNumber("");
        await refreshReadiness();
      } else {
        setNotice({ type: "error", message: res.error || t("noticeRoomCreateFailed") });
      }
    });
  };

  const handleInviteStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail.trim() || !staffName.trim()) {
      setNotice({ type: "error", message: t("noticeStaffRequired") });
      return;
    }
    setNotice(null);

    startTransition(async () => {
      const res = await inviteStaffAction({
        email: staffEmail.trim(),
        name: staffName.trim(),
        role: staffRole,
        password: staffPassword.trim() || undefined,
      });

      if (res.success) {
        setNotice({ type: "ok", message: t("noticeStaffInvited", { name: staffName }) });
        setStaffEmail("");
        setStaffName("");
        setStaffPassword("");
        await refreshReadiness();
      } else {
        setNotice({ type: "error", message: res.error || t("noticeStaffInviteFailed") });
      }
    });
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setNotice({ type: "error", message: t("noticeShopNameRequired") });
      return;
    }
    setNotice(null);

    startTransition(async () => {
      const res = await updateShopProfileAction({
        name: shopName.trim(),
        phone: shopPhone.trim() || undefined,
        lineOaId: lineOaId.trim() || undefined,
      });

      if (res.success) {
        setNotice({ type: "ok", message: t("noticeProfileUpdated") });
        await refreshReadiness();
      } else {
        setNotice({ type: "error", message: res.error || t("noticeProfileFailed") });
      }
    });
  };

  return (
    <div className="dashboard-shell">
      <div className="dashboard-wrap">
        {/* Header Banner */}
        <header className="dashboard-hero">
          <div>
            <div className="dashboard-title-row">
              <div className="login-mark">P</div>
              <h1 className="dashboard-title">{readiness.shopName || t("defaultHeading")}</h1>
              <span className={`dashboard-badge ${readiness.isPilotReady ? "mint" : "peach"}`}>
                {readiness.isPilotReady ? t("badgeReady") : t("badgeInProgress")}
              </span>
            </div>
            <p className="dashboard-copy">
              Closed Beta Readiness Hub · {t("signedInAs")} <strong>{initialStaff.name}</strong> ({initialStaff.role.toUpperCase()})
            </p>
          </div>
          <div className="header-actions">
            <LanguageToggle />
            <Link href="/dashboard" className="secondary-button" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              {t("backToDashboard")}
            </Link>
          </div>
        </header>

        {/* Global Alert Notice */}
        {notice && (
          <div className={`pilot-notice ${notice.type}`}>
            {notice.type === "ok" ? "✓ " : "⚠ "} {notice.message}
          </div>
        )}

        {/* Navigation Tabs */}
        <nav style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`secondary-button ${activeTab === "readiness" ? "primary-button" : ""}`}
            onClick={() => { setActiveTab("readiness"); setNotice(null); }}
          >
            {t("tabReadiness", { percent: readiness.readinessPercentage })}
          </button>
          <button
            type="button"
            className={`secondary-button ${activeTab === "import" ? "primary-button" : ""}`}
            onClick={() => { setActiveTab("import"); setNotice(null); }}
          >
            {t("tabImport")}
          </button>
          <button
            type="button"
            className={`secondary-button ${activeTab === "rooms" ? "primary-button" : ""}`}
            onClick={() => { setActiveTab("rooms"); setNotice(null); }}
          >
            {t("tabRooms")}
          </button>
          {initialStaff.role === "owner" && (
            <button
              type="button"
              className={`secondary-button ${activeTab === "staff" ? "primary-button" : ""}`}
              onClick={() => { setActiveTab("staff"); setNotice(null); }}
            >
              {t("tabStaff")}
            </button>
          )}
          <button
            type="button"
            className={`secondary-button ${activeTab === "profile" ? "primary-button" : ""}`}
            onClick={() => { setActiveTab("profile"); setNotice(null); }}
          >
            {t("tabProfile")}
          </button>
        </nav>

        {/* TAB 1: PILOT READINESS CHECKLIST */}
        {activeTab === "readiness" && (
          <section className="pilot-stack">
            <article className="dashboard-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h2 style={{ fontSize: "16px", color: "var(--ink)", textTransform: "none", fontWeight: 800 }}>
                    {t("readinessHeading")}
                  </h2>
                  <p className="dashboard-copy">
                    {t("readinessIntro")}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 900, color: readiness.isPilotReady ? "#246846" : "#996217" }}>
                    {readiness.readinessPercentage}%
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => startTransition(refreshReadiness)}
                    disabled={isPending}
                  >
                    {t("reEvaluate")}
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ width: "100%", height: "10px", background: "var(--line)", borderRadius: "999px", overflow: "hidden", margin: "16px 0 24px" }}>
                <div
                  style={{
                    width: `${readiness.readinessPercentage}%`,
                    height: "100%",
                    background: readiness.isPilotReady ? "linear-gradient(90deg, #68d5bb, #2f73e8)" : "linear-gradient(90deg, #ffb76a, #ff7f9e)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>

              {/* Blocking issues banner if not ready */}
              {!readiness.isPilotReady && readiness.blockingIssues.length > 0 && (
                <div className="pilot-notice error" style={{ marginBottom: "20px" }}>
                  <strong>{t("blockingIssuesHeading")}</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
                    {readiness.blockingIssues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Checklist Grid */}
              <div className="pilot-list">
                {readiness.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px",
                      padding: "14px 16px",
                      borderRadius: "16px",
                      border: "1px solid var(--line)",
                      background: item.isReady ? "var(--pet-mint-soft)" : "var(--surface)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "16px" }}>{item.isReady ? "✅" : "⚠️"}</span>
                        <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{item.title}</strong>
                        {item.isCritical && (
                          <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "6px", background: "#ffd1dc", color: "#9b3f59", fontWeight: 700 }}>
                            {t("required")}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                        {item.description}
                      </p>
                      {!item.isReady && item.remediation && (
                        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#956020" }}>
                          👉 {t("fixPrefix")} {item.remediation}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: "right", minWidth: "120px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: item.isReady ? "#246846" : "var(--muted)" }}>
                        {item.currentValue || (item.isReady ? t("ready") : t("pending"))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {/* TAB 2: CSV DATA IMPORT */}
        {activeTab === "import" && (
          <section className="pilot-stack">
            <article className="dashboard-card">
              <h2 style={{ fontSize: "16px", color: "var(--ink)", textTransform: "none", fontWeight: 800 }}>
                {t("importHeading")}
              </h2>
              <p className="dashboard-copy">
                {t("importIntro")}
              </p>

              <div style={{ marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>
                    {t("importDataLabel")}
                  </label>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }}
                    onClick={() => setCsvInput(SAMPLE_CSV)}
                  >
                    {t("loadSample")}
                  </button>
                </div>
                <textarea
                  className="note-input"
                  style={{ minHeight: "150px", fontFamily: "monospace", fontSize: "11px" }}
                  placeholder="first_name,last_name,phone,pet_name,species,breed,gender,birth_date,weight_kg,special_care_notes..."
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handlePreviewCsv}
                  disabled={isPending || !csvInput.trim()}
                >
                  {isPending ? t("validating") : t("validatePreview")}
                </button>
                {preview && preview.validRows > 0 && (
                  <button
                    type="button"
                    className="primary-button"
                    style={{ background: preview.identityConflicts > 0 ? "#996217" : "#246846" }}
                    onClick={handleExecuteImport}
                    disabled={isPending || preview.identityConflicts > 0}
                  >
                    {isPending
                      ? t("importing")
                      : preview.identityConflicts > 0
                      ? t("blockedConflicts", { count: preview.identityConflicts })
                      : t("confirmImport", { rows: preview.validRows })}
                  </button>
                )}
              </div>
            </article>

            {/* PREVIEW SUMMARY CARD */}
            {preview && (
              <article className="dashboard-card">
                <h2 style={{ fontSize: "16px", color: "var(--ink)", textTransform: "none", fontWeight: 800 }}>
                  {t("previewHeading")}
                </h2>
                <div className="dashboard-grid" style={{ marginTop: "14px" }}>
                  <div className="dashboard-stat">
                    <span>{t("statTotalRows")}</span>
                    <strong>{preview.totalRows}</strong>
                  </div>
                  <div className="dashboard-stat mint">
                    <span>{t("statValidRows")}</span>
                    <strong>{preview.validRows}</strong>
                  </div>
                  <div className="dashboard-stat pink">
                    <span>{t("statInvalidRows")}</span>
                    <strong>{preview.invalidRows}</strong>
                  </div>
                  <div className={`dashboard-stat ${preview.identityConflicts > 0 ? "pink" : "peach"}`}>
                    <span>{t("statIdentityConflicts")}</span>
                    <strong>{preview.identityConflicts}</strong>
                  </div>
                </div>

                {preview.identityConflicts > 0 && (
                  <div className="pilot-notice error" style={{ marginTop: "14px" }}>
                    ⛔ <strong>{t("conflictNoticeHeading", { rows: preview.identityConflicts })}</strong> {t("conflictNoticeBody")}
                  </div>
                )}

                {preview.unsupportedColumns.length > 0 && (
                  <div className="pilot-notice" style={{ background: "#fff9f1", borderColor: "#ffe2c7", color: "#956020", marginTop: "14px" }}>
                    ℹ️ <strong>{t("unsupportedColumnsHeading")}</strong> {preview.unsupportedColumns.join(", ")}
                  </div>
                )}

                {/* Preview Rows Table */}
                <div style={{ marginTop: "16px", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--line)", color: "var(--muted)" }}>
                        <th style={{ padding: "8px" }}>{t("thRow")}</th>
                        <th style={{ padding: "8px" }}>{t("thCustomerName")}</th>
                        <th style={{ padding: "8px" }}>{t("thPhone")}</th>
                        <th style={{ padding: "8px" }}>{t("thPetName")}</th>
                        <th style={{ padding: "8px" }}>{t("thSpeciesBreed")}</th>
                        <th style={{ padding: "8px" }}>{t("thStatus")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rowDetails.slice(0, 50).map((row) => (
                        <tr key={row.rowNumber} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "8px", fontWeight: 700 }}>#{row.rowNumber}</td>
                          <td style={{ padding: "8px" }}>{row.customer?.firstName || "-"}</td>
                          <td style={{ padding: "8px" }}>{row.customer?.phone || "-"}</td>
                          <td style={{ padding: "8px" }}>{row.pet?.name || "-"}</td>
                          <td style={{ padding: "8px" }}>
                            {row.pet ? `${row.pet.species} ${row.pet.breed ? `(${row.pet.breed})` : ""}` : "-"}
                          </td>
                          <td style={{ padding: "8px" }}>
                            {row.isIdentityConflict ? (
                              <span className="status-chip chip-maintenance" style={{ color: "#9b3f59", background: "#fff0f4", fontWeight: 700 }}>
                                {t("chipConflict", { errors: row.errors.join(", ") })}
                              </span>
                            ) : row.isValid ? (
                              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                <span className="status-chip chip-available">{t("chipValid")}</span>
                                {row.isCustomerNew ? (
                                  <span className="status-chip chip-occupied">{t("chipNewCustomer")}</span>
                                ) : (
                                  <span className="status-chip chip-maintenance">{t("chipMatchedCustomer")}</span>
                                )}
                                {row.isPetNew && <span className="status-chip chip-occupied">{t("chipNewPet")}</span>}
                                {row.isDuplicatePet && <span className="status-chip chip-cleaning">{t("chipSkipDuplicatePet")}</span>}
                              </div>
                            ) : (
                              <span className="status-chip chip-maintenance" style={{ color: "#9b3f59", background: "#fff0f4" }}>
                                {t("chipInvalid", { errors: row.errors.join(", ") })}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.rowDetails.length > 50 && (
                    <p className="dashboard-copy" style={{ marginTop: "8px" }}>
                      {t("showingFirstRows", { shown: 50, total: preview.rowDetails.length })}
                    </p>
                  )}
                </div>
              </article>
            )}

            {/* IMPORT RESULT RECEIPT */}
            {importResult && (
              <article className="dashboard-card" style={{ border: "2px solid #68d5bb" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "24px" }}>🎉</span>
                  <h2 style={{ fontSize: "16px", color: "#246846", textTransform: "none", fontWeight: 800 }}>
                    {t("importResultHeading")}
                  </h2>
                </div>
                <div className="dashboard-grid" style={{ marginTop: "14px" }}>
                  <div className="dashboard-stat mint">
                    <span>{t("statCreatedCustomers")}</span>
                    <strong>{importResult.createdCustomers}</strong>
                  </div>
                  <div className="dashboard-stat mint">
                    <span>{t("statCreatedPets")}</span>
                    <strong>{importResult.createdPets}</strong>
                  </div>
                  <div className="dashboard-stat peach">
                    <span>{t("statSkippedDuplicates")}</span>
                    <strong>{importResult.skippedDuplicates}</strong>
                  </div>
                  <div className="dashboard-stat">
                    <span>{t("statTotalProcessed")}</span>
                    <strong>{importResult.totalProcessed}</strong>
                  </div>
                </div>
              </article>
            )}
          </section>
        )}

        {/* TAB 3: ROOM MATRIX SETUP */}
        {activeTab === "rooms" && (
          <section className="pilot-stack">
            <article className="dashboard-card">
              <h2 style={{ fontSize: "16px", color: "var(--ink)", textTransform: "none", fontWeight: 800 }}>
                {t("addRoomHeading")}
              </h2>
              <form onSubmit={handleCreateRoom} className="pilot-form" style={{ marginTop: "16px" }}>
                <div className="pilot-grid-4">
                  <label>
                    {t("roomNumberLabel")}
                    <input
                      type="text"
                      placeholder={t("roomNumberPlaceholder")}
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {t("roomTypeLabel")}
                    <select value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType)}>
                      <option value="standard">Standard</option>
                      <option value="deluxe">Deluxe</option>
                      <option value="vip">VIP</option>
                      <option value="cat_condo">Cat Condo</option>
                    </select>
                  </label>
                  <label>
                    {t("capacityLabel")}
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={capacityPets}
                      onChange={(e) => setCapacityPets(Number(e.target.value))}
                      required
                    />
                  </label>
                  <label>
                    {t("basePriceLabel")}
                    <input
                      type="number"
                      min={0}
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value))}
                      required
                    />
                  </label>
                </div>
                <button type="submit" className="primary-button" disabled={isPending || !roomNumber.trim()}>
                  {isPending ? t("creating") : t("addRoomButton")}
                </button>
              </form>
            </article>

            {/* Room Matrix List */}
            <article className="dashboard-card">
              <h2 style={{ fontSize: "16px", color: "var(--ink)", textTransform: "none", fontWeight: 800 }}>
                {t("roomInventoryHeading")} ({t("roomInventorySummary", { count: operations.rooms.length })})
              </h2>
              <div className="room-grid" style={{ marginTop: "14px" }}>
                {operations.rooms.map((room) => (
                  <div key={room.id} className="room-card">
                    <div className="room-top">
                      <div>
                        <span className="room-number">{room.number}</span>
                        <div className="room-type">{t("roomTypeCapacity", { type: room.type.toUpperCase(), capacity: room.capacity })}</div>
                      </div>
                      <span className={`status-chip chip-${room.status}`}>{room.status.toUpperCase()}</span>
                    </div>
                    <div style={{ marginTop: "12px", fontSize: "13px", fontWeight: 700, color: "var(--deep)" }}>
                      {t("pricePerNight", { price: room.price.toLocaleString() })}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {/* TAB 4: STAFF TEAM SETUP */}
        {activeTab === "staff" && initialStaff.role === "owner" && (
          <section className="pilot-stack">
            <article className="dashboard-card">
              <h2 style={{ fontSize: "16px", color: "var(--ink)", textTransform: "none", fontWeight: 800 }}>
                {t("inviteStaffHeading")}
              </h2>
              <form onSubmit={handleInviteStaff} className="pilot-form" style={{ marginTop: "16px" }}>
                <div className="pilot-grid-4">
                  <label>
                    {t("staffEmailLabel")}
                    <input
                      type="email"
                      placeholder={t("staffEmailPlaceholder")}
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {t("staffNameLabel")}
                    <input
                      type="text"
                      placeholder={t("staffNamePlaceholder")}
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {t("staffRoleLabel")}
                    <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as "manager" | "staff")}>
                      <option value="staff">{t("staffRoleStaff")}</option>
                      <option value="manager">{t("staffRoleManager")}</option>
                    </select>
                  </label>
                  <label>
                    {t("staffPasswordLabel")}
                    <input
                      type="password"
                      placeholder={t("staffPasswordPlaceholder")}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                    />
                  </label>
                </div>
                <button type="submit" className="primary-button" disabled={isPending || !staffEmail.trim() || !staffName.trim()}>
                  {isPending ? t("inviting") : t("inviteStaffButton")}
                </button>
              </form>
            </article>

            {/* Active Staff List */}
            <article className="dashboard-card">
              <h2 style={{ fontSize: "16px", color: "var(--ink)", textTransform: "none", fontWeight: 800 }}>
                {t("activeTeamHeading")} ({t("activeTeamSummary", { count: operations.staffMembers.length })})
              </h2>
              <div className="pilot-list compact">
                {operations.staffMembers.map((member) => (
                  <div key={member.id} className="pilot-staff-row">
                    <div>
                      <strong>{member.name}</strong> ({member.email})
                      <div className="dashboard-copy">{t("rolePrefix")} {member.role.toUpperCase()}</div>
                    </div>
                    <span className="status-chip chip-available">
                      {member.isActive ? t("statusActive") : t("statusDisabled")}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {/* TAB 5: SHOP PROFILE */}
        {activeTab === "profile" && (
          <section className="pilot-stack">
            <article className="dashboard-card">
              <h2 style={{ fontSize: "16px", color: "var(--ink)", textTransform: "none", fontWeight: 800 }}>
                {t("profileHeading")}
              </h2>
              <form onSubmit={handleUpdateProfile} className="pilot-form" style={{ marginTop: "16px" }}>
                <div className="pilot-grid-2">
                  <label>
                    {t("shopNameLabel")}
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {t("shopSlugLabel")}
                    <input type="text" value={operations.shop.slug} disabled style={{ opacity: 0.6 }} />
                  </label>
                  <label>
                    {t("shopPhoneLabel")}
                    <input
                      type="text"
                      placeholder="02-123-4567"
                      value={shopPhone}
                      onChange={(e) => setShopPhone(e.target.value)}
                    />
                  </label>
                  <label>
                    {t("lineOaLabel")}
                    <input
                      type="text"
                      placeholder="@yourhotel"
                      value={lineOaId}
                      onChange={(e) => setLineOaId(e.target.value)}
                    />
                  </label>
                </div>
                <button type="submit" className="primary-button" disabled={isPending || !shopName.trim()}>
                  {isPending ? t("saving") : t("saveProfileButton")}
                </button>
              </form>
            </article>
          </section>
        )}
      </div>
    </div>
  );
}
