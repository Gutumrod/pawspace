"use client";

import Script from "next/script";
import { useMemo, useRef, useState } from "react";
import {
  calculateEstimatedTotal,
  isRoomAvailable,
  validateDateRange,
  type CustomerBookingContext,
  type CustomerBookingPet,
  type CustomerBookingRoom,
} from "@/lib/line-booking-core";
import { getCustomerBookingContextAction, submitBookingRequestAction } from "@/app/actions/line-booking";

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

  async function initializeLiff() {
    if (started.current) return;
    started.current = true;
    setState("loading");

    if (!shopId) {
      setState("error");
      setErrorMessage("ไม่พบรหัสร้านค้า กรุณาเปิดลิงก์จาก LINE Official Account ของร้าน");
      return;
    }

    if (!liffId || !window.liff) {
      setState("error");
      setErrorMessage("ระบบ LINE LIFF ยังไม่ได้ตั้งค่า กรุณาติดต่อทางร้าน");
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
        setErrorMessage("ไม่สามารถอ่าน LINE ID token ได้ กรุณาเปิดลิงก์ใหม่จากแอป LINE");
        return;
      }
      setIdToken(token);

      const result = await getCustomerBookingContextAction(shopId, token);
      if (!result.success) {
        setState("error");
        if (result.code === "NOT_LINKED") {
          setErrorMessage("ยังไม่ได้เชื่อมต่อบัญชี LINE กับร้านนี้ กรุณากดลิงก์เชื่อมต่อ LINE ที่ร้านส่งให้ก่อนครับ");
        } else {
          setErrorMessage(result.error || "เกิดข้อผิดพลาดในการโหลดข้อมูลร้านค้า");
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
      setErrorMessage("เกิดข้อผิดพลาดในการเชื่อมต่อ LINE LIFF กรุณาลองใหม่อีกครั้ง");
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
        setSubmitError(response.error || "ไม่สามารถส่งคำขอจองได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      setSubmittedRequestId(response.requestId || "");
      setState("success");
    } catch {
      setState("ready");
      setSubmitError("เกิดข้อผิดพลาดในการส่งคำขอ กรุณาลองใหม่อีกครั้ง");
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
          setErrorMessage("โหลด LINE LIFF SDK ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
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
            aria-label="กำลังโหลด"
          />
          <p style={{ fontWeight: 700, color: "var(--ink)", margin: 0, fontSize: "14px" }}>
            กำลังเตรียมข้อมูลการจองผ่าน LINE…
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="pilot-notice error" style={{ padding: "20px", textAlign: "center" }}>
          <div style={{ fontSize: "26px", marginBottom: "8px" }} aria-hidden="true">
            ⚠️
          </div>
          <h2 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 6px" }}>ไม่สามารถเปิดหน้าจองได้</h2>
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
            ส่งคำขอจองสำเร็จแล้ว!
          </h2>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
            คำขอจองห้องพักสำหรับร้าน <strong style={{ color: "var(--ink)" }}>{context.shop.name}</strong>{" "}
            ถูกส่งเข้าระบบเรียบร้อยแล้ว
          </p>

          <div className="liff-success-detail">
            <div className="liff-success-row">
              <span style={{ color: "var(--muted)" }}>รหัสคำขอ:</span>
              <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--ink)", fontWeight: 700 }}>
                {submittedRequestId.slice(0, 8)}
              </span>
            </div>
            <div className="liff-success-row">
              <span style={{ color: "var(--muted)" }}>ห้องพัก:</span>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {selectedRoom?.roomNumber} ({selectedRoom?.roomType})
              </span>
            </div>
            <div className="liff-success-row">
              <span style={{ color: "var(--muted)" }}>วันที่เข้าพัก:</span>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {checkInDate} ถึง {checkOutDate} ({dateValidation.nights} คืน)
              </span>
            </div>
            <div className="liff-success-row">
              <span style={{ color: "var(--muted)" }}>สัตว์เลี้ยง:</span>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {context.pets.filter((p) => selectedPetIds.includes(p.id)).map((p) => p.name).join(", ")}
              </span>
            </div>
            <div className="liff-success-row" style={{ paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>ยอดประเมิน:</span>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--deep)" }}>
                ฿{totalEstimatedPrice.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="pilot-notice ok" style={{ textAlign: "left", margin: 0 }}>
            ℹ️ เจ้าหน้าที่ของร้านจะตรวจสอบคิวห้องพักและติดต่อยืนยันรายละเอียดผ่านทาง LINE อีกครั้งครับ
          </div>
        </div>
      )}

      {(state === "ready" || state === "submitting") && context && (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
          {/* Shop & Customer Banner */}
          <div className="liff-banner">
            <div className="liff-banner-eyebrow">จองห้องพักกับ</div>
            <div className="liff-banner-title">{context.shop.name}</div>
            <div className="liff-banner-user">
              ผู้จอง: <strong style={{ color: "var(--ink)" }}>{context.owner.firstName}</strong> ({context.owner.phone})
            </div>
          </div>

          {/* Step 1: Select Pets */}
          <div>
            <label className="liff-section-title">
              1. เลือกสัตว์เลี้ยงที่เข้าพัก <span className="liff-section-required">*</span>
            </label>
            {context.pets.length === 0 ? (
              <div
                className="pilot-notice error"
                style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}
              >
                <span aria-hidden="true">⚠️</span>
                <span>ยังไม่มีข้อมูลสัตว์เลี้ยงในระบบ กรุณาติดต่อทางร้านเพื่อเพิ่มข้อมูล</span>
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
                          {pet.breed || (pet.species === "cat" ? "แมว" : "สุนัข")}
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
              2. เลือกประเภทห้องพัก <span className="liff-section-required">*</span>
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
                        รองรับสูงสุด {room.capacityPets} ตัว{" "}
                        {!fitsPets && (
                          <span style={{ color: "var(--coral)", fontWeight: 600 }}>
                            (ความจุไม่พอสำหรับ {selectedPetIds.length} ตัว)
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
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>/ คืน</div>
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
              3. วันที่เข้าพัก <span className="liff-section-required">*</span>
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
                  วันเช็คอิน
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
                  วันเช็คเอาท์
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
                <span>{dateValidation.error}</span>
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
                <span>ห้องพักนี้มีผู้จองแล้วในช่วงเวลาดังกล่าว กรุณาเลือกห้องอื่นหรือเปลี่ยนวัน</span>
              </div>
            )}
          </div>

          {/* Step 4: Special Requests */}
          <div>
            <label className="liff-section-title">4. ข้อความหรือคำขอพิเศษเพิ่มเติม (ถ้ามี)</label>
            <textarea
              rows={2}
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="เช่น อาหารเฉพาะทาง, เวลาที่จะเข้ามาส่งน้อง..."
              className="liff-input"
              style={{ minHeight: "80px", resize: "vertical" }}
            />
          </div>

          {/* Pricing & Summary Card */}
          {dateValidation.valid && selectedRoom && (
            <div className="liff-summary-card">
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 500 }}>
                  จำนวน {dateValidation.nights} คืน ({selectedPetIds.length} ตัว)
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginTop: "2px" }}>
                  ยอดประเมินรวม
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--deep)" }}>
                  ฿{totalEstimatedPrice.toLocaleString()}
                </div>
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>ยังไม่รวมค่าบริการพิเศษ</div>
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
            {state === "submitting" ? "กำลังส่งคำขอจอง…" : "ส่งคำขอจองห้องพัก"}
          </button>
        </form>
      )}
    </div>
  );
}
