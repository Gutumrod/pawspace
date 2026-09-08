"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCustomerBookingContextAction,
  quoteCustomerBookingAction,
  submitBookingRequestAction,
} from "@/app/actions/line-booking";
import type { BookingV2Quote, CustomerBookingV2Context } from "@/lib/line-booking-core";
import { bangkokLocalInputToIso, defaultBangkokLocalInput, formatBangkokDateTime } from "@/lib/booking-v2-time";

type Props = { shopId: string; liffId: string };
type ViewState = "init" | "loading" | "ready" | "submitting" | "success" | "error";
type LiffApi = {
  init(input: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(input?: { redirectUri?: string }): void;
  getIDToken(): string | null;
};

declare global {
  interface Window { liff?: LiffApi }
}

const unitLabel = { HOUR: "ชั่วโมง", DAY: "วัน", MONTH: "เดือน" } as const;

export function LineBookingClient({ shopId, liffId }: Props) {
  const started = useRef(false);
  const [state, setState] = useState<ViewState>("init");
  const [errorMessage, setErrorMessage] = useState("");
  const [context, setContext] = useState<CustomerBookingV2Context | null>(null);
  const [idToken, setIdToken] = useState("");
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedRatePlanId, setSelectedRatePlanId] = useState("");
  const [startLocal, setStartLocal] = useState(() => defaultBangkokLocalInput(1));
  const [specialRequests, setSpecialRequests] = useState("");
  const [quoteState, setQuoteState] = useState<{
    key: string;
    quote: BookingV2Quote | null;
    error: string;
    loading: boolean;
  }>({ key: "", quote: null, error: "", loading: false });
  const [submittedRequestId, setSubmittedRequestId] = useState("");
  const [submitError, setSubmitError] = useState("");

  async function initializeLiff() {
    if (started.current) return;
    started.current = true;
    setState("loading");
    if (!shopId || !liffId || !window.liff) {
      setState("error");
      setErrorMessage("ลิงก์จองหรือ LINE LIFF ยังตั้งค่าไม่ครบ กรุณาติดต่อทางร้าน");
      return;
    }

    try {
      await window.liff.init({ liffId });
      if (!window.liff.isLoggedIn()) {
        window.liff.login({ redirectUri: window.location.href });
        return;
      }
      const token = window.liff.getIDToken();
      if (!token) throw new Error("LINE_ID_TOKEN_MISSING");
      setIdToken(token);

      const result = await getCustomerBookingContextAction(shopId, token);
      if (!result.success) {
        setState("error");
        setErrorMessage(result.code === "NOT_LINKED"
          ? "ยังไม่ได้เชื่อมบัญชี LINE กับร้านนี้ กรุณาใช้ลิงก์เชื่อมต่อจากร้านก่อน"
          : result.error || "โหลดข้อมูลการจองไม่สำเร็จ");
        return;
      }
      setContext(result.data);
      if (result.data.pets[0]) setSelectedPetIds([result.data.pets[0].id]);
      if (result.data.rooms[0]) {
        const firstRoomId = result.data.rooms[0].id;
        setSelectedRoomId(firstRoomId);
        const firstPlan = result.data.ratePlans.find((plan) => plan.roomId === firstRoomId && plan.isActive);
        setSelectedRatePlanId(firstPlan?.id ?? "");
      }
      setState("ready");
    } catch {
      setState("error");
      setErrorMessage("ไม่สามารถเชื่อมต่อ LINE LIFF ได้ กรุณาลองเปิดลิงก์ใหม่");
    }
  }

  const roomRatePlans = useMemo(
    () => context?.ratePlans.filter((plan) => plan.roomId === selectedRoomId && plan.isActive) ?? [],
    [context, selectedRoomId],
  );

  const startAt = bangkokLocalInputToIso(startLocal);
  const quoteKey = context && idToken && selectedRoomId && selectedRatePlanId && selectedPetIds.length > 0 && startAt
    ? JSON.stringify([context.shop.id, selectedRoomId, selectedRatePlanId, [...selectedPetIds].sort(), startAt])
    : "";
  const quote = quoteState.key === quoteKey ? quoteState.quote : null;
  const quoteLoading = Boolean(quoteKey) && (quoteState.key !== quoteKey || quoteState.loading);
  const quoteError = !startAt
    ? "วันและเวลาเริ่มต้นไม่ถูกต้อง"
    : quoteState.key === quoteKey ? quoteState.error : "";

  useEffect(() => {
    if (!quoteKey || !context || !idToken || !startAt) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setQuoteState({ key: quoteKey, quote: null, error: "", loading: true });
      try {
        const result = await quoteCustomerBookingAction({
          shopId: context.shop.id,
          roomId: selectedRoomId,
          ratePlanId: selectedRatePlanId,
          petIds: selectedPetIds,
          startAt,
          idToken,
        });
        if (cancelled) return;
        setQuoteState(result.success
          ? { key: quoteKey, quote: result.data, error: "", loading: false }
          : { key: quoteKey, quote: null, error: result.error, loading: false });
      } catch {
        if (!cancelled) {
          setQuoteState({ key: quoteKey, quote: null, error: "ตรวจราคา/คิวไม่สำเร็จ", loading: false });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [quoteKey, context, idToken, startAt, selectedRoomId, selectedRatePlanId, selectedPetIds]);

  function togglePet(petId: string) {
    setSelectedPetIds((current) => current.includes(petId)
      ? (current.length > 1 ? current.filter((id) => id !== petId) : current)
      : [...current, petId]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const startAt = bangkokLocalInputToIso(startLocal);
    if (!context || !idToken || !startAt || !selectedRoomId || !selectedRatePlanId || !quote) return;
    setSubmitError("");
    setState("submitting");
    try {
      const result = await submitBookingRequestAction({
        shopId: context.shop.id,
        roomId: selectedRoomId,
        ratePlanId: selectedRatePlanId,
        petIds: selectedPetIds,
        startAt,
        specialRequests: specialRequests.trim() || null,
        idToken,
      });
      if (!result.success) {
        setState("ready");
        setSubmitError(result.error);
        return;
      }
      setSubmittedRequestId(result.requestId);
      setState("success");
    } catch {
      setState("ready");
      setSubmitError("ส่งคำขอไม่สำเร็จจากการเชื่อมต่อ");
    }
  }

  return (
    <div className="w-full">
      <Script
        src="https://static.line-scdn.net/liff/edge/2/sdk.js"
        strategy="afterInteractive"
        onReady={() => void initializeLiff()}
        onError={() => { setState("error"); setErrorMessage("โหลด LINE LIFF SDK ไม่สำเร็จ"); }}
      />

      {state === "loading" && <div className="card" style={{ padding: 28, textAlign: "center" }}>กำลังโหลดข้อมูลการจอง…</div>}
      {state === "error" && (
        <div className="pilot-notice error" style={{ padding: 20, textAlign: "center" }}>
          <strong>ไม่สามารถเปิดหน้าจองได้</strong><p>{errorMessage}</p>
        </div>
      )}

      {state === "success" && context && quote && (
        <div className="liff-success-card">
          <div className="liff-success-icon" aria-hidden="true">✓</div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>ส่งคำขอจองสำเร็จ</h2>
          <p className="panel-subtitle">ร้าน {context.shop.name} จะตรวจสอบและยืนยันคำขออีกครั้ง</p>
          <div className="liff-success-detail">
            <div className="liff-success-row"><span>รหัสคำขอ</span><strong>{submittedRequestId.slice(0, 8)}</strong></div>
            <div className="liff-success-row"><span>เริ่ม</span><strong>{formatBangkokDateTime(quote.startAt)}</strong></div>
            <div className="liff-success-row"><span>สิ้นสุด</span><strong>{formatBangkokDateTime(quote.endAt)}</strong></div>
            <div className="liff-success-row"><span>ราคาที่ขอจอง</span><strong>฿{quote.price.toLocaleString()}</strong></div>
          </div>
        </div>
      )}

      {(state === "ready" || state === "submitting") && context && (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
          <div className="liff-banner">
            <div className="liff-banner-eyebrow">จองห้องพักกับ</div>
            <div className="liff-banner-title">{context.shop.name}</div>
            <div className="liff-banner-user">ผู้จอง: <strong>{context.owner.firstName}</strong> ({context.owner.phone})</div>
          </div>

          <section>
            <label className="liff-section-title">1. เลือกสัตว์เลี้ยง *</label>
            <div className="liff-pet-grid">
              {context.pets.map((pet) => {
                const selected = selectedPetIds.includes(pet.id);
                return <button type="button" key={pet.id} aria-pressed={selected}
                  className={`liff-pet-card ${selected ? "selected" : ""}`}
                  onClick={() => togglePet(pet.id)}>
                  <span className="liff-pet-icon">{pet.species === "cat" ? "🐱" : "🐶"}</span>
                  <div><div className="liff-pet-name">{pet.name}</div><div className="liff-pet-breed">{pet.breed || pet.species}</div></div>
                  {selected && <strong>✓</strong>}
                </button>;
              })}
            </div>
          </section>

          <section>
            <label className="liff-section-title">2. เลือกห้อง *</label>
            <div className="liff-room-list">

              {context.rooms.map((room) => {
                const selected = room.id === selectedRoomId;
                const fitsPets = room.capacityPets >= selectedPetIds.length;
                const hasPlan = context.ratePlans.some((plan) => plan.roomId === room.id && plan.isActive);
                return <button type="button" key={room.id} disabled={!fitsPets || !hasPlan}
                  className={`liff-room-card ${selected ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    const firstPlan = context.ratePlans.find((plan) => plan.roomId === room.id && plan.isActive);
                    setSelectedRatePlanId(firstPlan?.id ?? "");
                  }}>
                  <div><strong>{room.roomNumber}</strong><div className="panel-subtitle">{room.roomType} · สูงสุด {room.capacityPets} ตัว</div></div>
                  <span>{!fitsPets ? "ความจุไม่พอ" : !hasPlan ? "ยังไม่มีแพ็กเกจ" : selected ? "✓" : "เลือก"}</span>
                </button>;
              })}
            </div>
          </section>

          <section>
            <label className="liff-section-title">3. เลือกแพ็กเกจ *</label>
            <div className="liff-room-list">
              {roomRatePlans.map((plan) => (
                <button type="button" key={plan.id}
                  className={`liff-room-card ${selectedRatePlanId === plan.id ? "selected" : ""}`}
                  onClick={() => setSelectedRatePlanId(plan.id)}>
                  <strong>{plan.quantity} {unitLabel[plan.unit]}</strong>
                  <span style={{ fontWeight: 800 }}>฿{plan.price.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="liff-section-title">4. วันและเวลาเริ่มเข้าพัก *</label>
            <input className="liff-input" type="datetime-local" required value={startLocal}
              onChange={(event) => setStartLocal(event.target.value)} />
            <div className="panel-subtitle" style={{ marginTop: 6 }}>เวลาร้าน: Asia/Bangkok</div>
          </section>

          <section>
            <label className="liff-section-title">5. คำขอพิเศษ (ถ้ามี)</label>
            <textarea className="liff-input" rows={3} value={specialRequests}
              onChange={(event) => setSpecialRequests(event.target.value)} />
          </section>

          {quoteLoading && <div className="pilot-notice">กำลังตรวจราคาและคิวจากระบบ…</div>}
          {quoteError && <div className="pilot-notice error">{quoteError}</div>}
          {quote && (
            <div className="liff-summary-card">
              <div>
                <div className="panel-subtitle">{quote.quantity} {unitLabel[quote.unit]}</div>
                <strong>{formatBangkokDateTime(quote.startAt)} → {formatBangkokDateTime(quote.endAt)}</strong>
              </div>
              <div style={{ textAlign: "right" }}><div className="panel-subtitle">ราคายืนยันจากระบบ</div><strong style={{ fontSize: 20 }}>฿{quote.price.toLocaleString()}</strong></div>
            </div>
          )}

          {submitError && <div className="pilot-notice error">{submitError}</div>}
          <button type="submit" className="primary-button liff-submit-btn"
            disabled={state === "submitting" || quoteLoading || !quote}>
            {state === "submitting" ? "กำลังส่งคำขอ…" : "ส่งคำขอจอง"}
          </button>
        </form>
      )}
    </div>
  );
}
