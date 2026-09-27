"use client";

import Script from "next/script";
import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  calculateEstimatedTotal,
  isRoomAvailable,
  validateDateRange,
  type CustomerBookingContext,
  type CustomerBookingPet,
  type CustomerBookingRoom,
} from "@/lib/line-booking-core";
import { getCustomerBookingContextAction, submitBookingRequestAction } from "@/app/actions/line-booking";
import { getMessages } from "@/app/i18n/messages";
import type { Locale } from "@/app/i18n/config";

type Props = {
  shopId: string;
  liffId: string;
};

type ViewState = "init" | "loading" | "ready" | "submitting" | "success" | "error";

type LiffApi = {
  init(input: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(input?: { redirectUri?: string }): void;
  getIDToken(): string | null;
};

declare global {
  interface Window {
    liff?: LiffApi;
  }
}

export function LineBookingClient({ shopId, liffId }: Props) {
  const started = useRef(false);
  const [state, setState] = useState<ViewState>("init");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [context, setContext] = useState<CustomerBookingContext | null>(null);
  const [idToken, setIdToken] = useState<string>("");

  const t = useTranslations("lineBooking");
  const locale = useLocale() as Locale;

  // Catalogue values read outside the hook API: the pet-species fallback labels and the
  // server-error code constant. Both stay locale-driven off the same catalogue as `t`.
  const speciesLabels = getMessages(locale).species;
  const serverUnavailableText = getMessages(locale).lineBooking.serverUnavailable;

  // Form State
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [checkInDate, setCheckInDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [checkOutDate, setCheckOutDate] = useState<string>(() => {
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter.toISOString().slice(0, 10);
  });
  const [specialRequests, setSpecialRequests] = useState<string>("");
  const [submittedRequestId, setSubmittedRequestId] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");

  /** Maps the booking-core date validation error (a fixed English code) to its translated
   * phrasing. The core module is locale-free by design, so the mapping lives here. */
  function dateErrorText(error: string | undefined): string {
    if (!error) return "";
    if (error === "Check-out date must be strictly after check-in date.") return t("dateErrorOrder");
    if (error === "Dates must be valid calendar dates.") return t("dateErrorInvalid");
    return t("dateErrorFormat");
  }

  async function initializeLiff() {
    if (started.current) return;
    started.current = true;
    setState("loading");

    if (!shopId) {
      setState("error");
      setErrorMessage(t("errorMissingShop"));
      return;
    }

    if (!liffId || !window.liff) {
      setState("error");
      setErrorMessage(t("errorLiffNotConfigured"));
      return;
    }

    try {
      await window.liff.init({ liffId });
      if (!window.liff.isLoggedIn()) {
        window.liff.login({ redirectUri: window.location.href });
        return;
      }

      const token = window.liff.getIDToken();
      if (!token) {
        setState("error");
        setErrorMessage(t("errorNoIdToken"));
        return;
      }
      setIdToken(token);

      const result = await getCustomerBookingContextAction(shopId, token);
      if (!result.success) {
        setState("error");
        if (result.code === "NOT_LINKED") {
          setErrorMessage(t("errorNotLinked"));
        } else {
          setErrorMessage(result.error || t("errorLoadContext"));
        }
        return;
      }

      setContext(result.data);
      if (result.data.pets.length > 0) {
        setSelectedPetIds([result.data.pets[0].id]);
      }
      if (result.data.rooms.length > 0) {
        setSelectedRoomId(result.data.rooms[0].id);
      }
      setState("ready");
    } catch {
      setState("error");
      setErrorMessage(t("errorLiffConnect"));
    }
  }

  // Date validation & summary calculation
  const dateValidation = useMemo(() => {
    if (!checkInDate || !checkOutDate) return { valid: false, nights: 0 };
    return validateDateRange(checkInDate, checkOutDate);
  }, [checkInDate, checkOutDate]);

  const selectedRoom = useMemo(() => {
    return context?.rooms.find((r) => r.id === selectedRoomId);
  }, [context, selectedRoomId]);

  const totalEstimatedPrice = useMemo(() => {
    if (!selectedRoom || !dateValidation.valid) return 0;
    return calculateEstimatedTotal(selectedRoom.basePricePerNight, dateValidation.nights);
  }, [selectedRoom, dateValidation]);

  const isRoomCurrentlyAvailable = useMemo(() => {
    if (!selectedRoomId || !context || !dateValidation.valid) return true;
    const room = context.rooms.find((r) => r.id === selectedRoomId);
    return isRoomAvailable(
      selectedRoomId,
      checkInDate,
      checkOutDate,
      context.occupiedRanges,
      room?.maintenanceFrom,
      room?.maintenanceUntil,
    );
  }, [selectedRoomId, context, dateValidation, checkInDate, checkOutDate]);

  function togglePet(petId: string) {
    setSelectedPetIds((prev) =>
      prev.includes(petId) ? (prev.length > 1 ? prev.filter((id) => id !== petId) : prev) : [...prev, petId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken || !context || !selectedRoomId || selectedPetIds.length === 0 || !dateValidation.valid) {
      return;
    }

    setSubmitError("");
    setState("submitting");
    try {
      const response = await submitBookingRequestAction({
        shopId: context.shop.id,
        roomId: selectedRoomId,
        petIds: selectedPetIds,
        checkInDate,
        checkOutDate,
        specialRequests: specialRequests.trim() || null,
        idToken,
      });

      if (!response.success) {
        setState("ready");
        const failureText =
          response.error === "Server unavailable. Please try again."
            ? serverUnavailableText
            : response.error || t("submitError");
        setSubmitError(failureText);
        return;
      }

      setSubmittedRequestId(response.requestId || "");
      setState("success");
    } catch {
      setState("ready");
      setSubmitError(t("submitConnectionError"));
    }
  }

  return (
    <div className="w-full">
      <Script
        src="https://static.line-scdn.net/liff/edge/2/sdk.js"
        strategy="afterInteractive"
        onReady={() => void initializeLiff()}
        onError={() => {
          setState("error");
          setErrorMessage(t("errorSdkLoad"));
        }}
      />

      {state === "loading" && (
        <div
          className="card"
          style={{
            padding: "36px 20px",
            textAlign: "center",
            background: "linear-gradient(135deg, #ffffff 0%, var(--primary-blue-soft) 100%)",
          }}
        >
          <div
            className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[var(--deep)] border-t-transparent mb-3"
            role="status"
            aria-label={t("loadingAria")}
          />
          <p style={{ fontWeight: 700, color: "var(--ink)", margin: 0, fontSize: "14px" }}>
            {t("loading")}
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="pilot-notice error" style={{ padding: "20px", textAlign: "center" }}>
          <div style={{ fontSize: "26px", marginBottom: "8px" }} aria-hidden="true">
            ⚠️
          </div>
          <h2 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 6px" }}>{t("errorHeading")}</h2>
          <p style={{ fontSize: "13px", margin: 0, opacity: 0.9 }}>{errorMessage}</p>
        </div>
      )}

      {state === "success" && context && (
        <div className="liff-success-card">
          <div className="liff-success-icon" aria-hidden="true">
            ✨
          </div>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "var(--ink)",
              margin: "0 0 6px",
              letterSpacing: "-0.03em",
            }}
          >
            {t("successHeading")}
          </h2>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
            {t("successBodyPrefix")} <strong style={{ color: "var(--ink)" }}>{context.shop.name}</strong>{" "}
            {t("successBodySuffix")}
          </p>

          <div className="liff-success-detail">
            <div className="liff-success-row">
              <span style={{ color: "var(--muted)" }}>{t("requestIdLabel")}</span>
              <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--ink)", fontWeight: 700 }}>
                {submittedRequestId.slice(0, 8)}
              </span>
            </div>
            <div className="liff-success-row">
              <span style={{ color: "var(--muted)" }}>{t("roomLabel")}</span>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {selectedRoom?.roomNumber} ({selectedRoom?.roomType})
              </span>
            </div>
            <div className="liff-success-row">
              <span style={{ color: "var(--muted)" }}>{t("datesLabel")}</span>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {t("datesValue", {
                  checkIn: checkInDate,
                  checkOut: checkOutDate,
                  nights: dateValidation.nights,
                })}
              </span>
            </div>
            <div className="liff-success-row">
              <span style={{ color: "var(--muted)" }}>{t("petLabel")}</span>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {context.pets.filter((p) => selectedPetIds.includes(p.id)).map((p) => p.name).join(", ")}
              </span>
            </div>
            <div className="liff-success-row" style={{ paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>{t("estimatedTotalLabel")}</span>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--deep)" }}>
                ฿{totalEstimatedPrice.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="pilot-notice ok" style={{ textAlign: "left", margin: 0 }}>
            {t("successNotice")}
          </div>
        </div>
      )}

      {(state === "ready" || state === "submitting") && context && (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
          {/* Shop & Customer Banner */}
          <div className="liff-banner">
            <div className="liff-banner-eyebrow">{t("bannerEyebrow")}</div>
            <div className="liff-banner-title">{context.shop.name}</div>
            <div className="liff-banner-user">
              {t("bannerBooker")} <strong style={{ color: "var(--ink)" }}>{context.owner.firstName}</strong> ({context.owner.phone})
            </div>
          </div>

          {/* Step 1: Select Pets */}
          <div>
            <label className="liff-section-title">
              {t("stepPets")} <span className="liff-section-required">{t("requiredMark")}</span>
            </label>
            {context.pets.length === 0 ? (
              <div
                className="pilot-notice error"
                style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}
              >
                <span aria-hidden="true">⚠️</span>
                <span>{t("noPets")}</span>
              </div>
            ) : (
              <div className="liff-pet-grid">
                {context.pets.map((pet: CustomerBookingPet) => {
                  const selected = selectedPetIds.includes(pet.id);
                  return (
                    <button
                      type="button"
                      key={pet.id}
                      onClick={() => togglePet(pet.id)}
                      className={`liff-pet-card ${selected ? "selected" : ""}`}
                      aria-pressed={selected}
                    >
                      <span className="liff-pet-icon">{pet.species === "cat" ? "🐱" : "🐶"}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="liff-pet-name"
                          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {pet.name}
                        </div>
                        <div
                          className="liff-pet-breed"
                          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {pet.breed || speciesLabels[pet.species]}
                        </div>
                      </div>
                      {selected && (
                        <span style={{ color: "var(--deep)", fontSize: "14px", fontWeight: 800 }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Select Room */}
          <div>
            <label className="liff-section-title">
              {t("stepRooms")} <span className="liff-section-required">{t("requiredMark")}</span>
            </label>
            <div className="liff-room-list">
              {context.rooms.map((room: CustomerBookingRoom) => {
                const selected = selectedRoomId === room.id;
                const fitsPets = room.capacityPets >= selectedPetIds.length;
                return (
                  <button
                    type="button"
                    key={room.id}
                    disabled={!fitsPets}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`liff-room-card ${selected ? "selected" : ""}`}
                    aria-pressed={selected}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--ink)" }}>
                          {room.roomNumber}
                        </span>
                        <span className="status-chip chip-available">{room.roomType}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                        {t("roomCapacity", { capacity: room.capacityPets })}{" "}
                        {!fitsPets && (
                          <span style={{ color: "var(--coral)", fontWeight: 600 }}>
                            {t("roomCapacityShort", { count: selectedPetIds.length })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--deep)" }}>
                          ฿{room.basePricePerNight.toLocaleString()}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>{t("pricePerNight")}</div>
                      </div>
                      {selected && (
                        <span
                          style={{ color: "var(--deep)", fontSize: "16px", fontWeight: 800 }}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Dates */}
          <div>
            <label className="liff-section-title">
              {t("stepDates")} <span className="liff-section-required">{t("requiredMark")}</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--muted)",
                    marginBottom: "4px",
                    fontWeight: 500,
                  }}
                >
                  {t("checkInLabel")}
                </span>
                <input
                  type="date"
                  required
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="liff-input"
                />
              </div>
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--muted)",
                    marginBottom: "4px",
                    fontWeight: 500,
                  }}
                >
                  {t("checkOutLabel")}
                </span>
                <input
                  type="date"
                  required
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="liff-input"
                />
              </div>
            </div>

            {!dateValidation.valid && checkInDate && checkOutDate && (
              <div
                className="pilot-notice error"
                style={{
                  marginTop: "8px",
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span aria-hidden="true">⚠️</span>
                <span>{dateErrorText(dateValidation.error)}</span>
              </div>
            )}

            {!isRoomCurrentlyAvailable && dateValidation.valid && (
              <div
                className="pilot-notice error"
                style={{
                  marginTop: "8px",
                  padding: "8px 12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span aria-hidden="true">⚠️</span>
                <span>{t("roomUnavailable")}</span>
              </div>
            )}
          </div>

          {/* Step 4: Special Requests */}
          <div>
            <label className="liff-section-title">{t("stepRequests")}</label>
            <textarea
              rows={2}
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder={t("requestsPlaceholder")}
              className="liff-input"
              style={{ minHeight: "80px", resize: "vertical" }}
            />
          </div>

          {/* Pricing & Summary Card */}
          {dateValidation.valid && selectedRoom && (
            <div className="liff-summary-card">
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 500 }}>
                  {t("summaryTitle", { nights: dateValidation.nights, pets: selectedPetIds.length })}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginTop: "2px" }}>
                  {t("summaryTotal")}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--deep)" }}>
                  ฿{totalEstimatedPrice.toLocaleString()}
                </div>
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>{t("summaryNote")}</div>
              </div>
            </div>
          )}

          {/* Submit Error Notice */}
          {submitError && (
            <div
              className="pilot-notice error"
              style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <span aria-hidden="true">⚠️</span>
              <span>{submitError}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              state === "submitting" ||
              !dateValidation.valid ||
              !isRoomCurrentlyAvailable ||
              selectedPetIds.length === 0 ||
              !selectedRoomId
            }
            className="primary-button liff-submit-btn"
          >
            {state === "submitting" ? t("submitting") : t("submit")}
          </button>
        </form>
      )}
    </div>
  );
}
