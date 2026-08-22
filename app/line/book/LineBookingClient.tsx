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
        alert(response.error || "ไม่สามารถส่งคำขอจองได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      setSubmittedRequestId(response.requestId || "");
      setState("success");
    } catch {
      setState("ready");
      alert("เกิดข้อผิดพลาดในการส่งคำขอ กรุณาลองใหม่อีกครั้ง");
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
        <div className="rounded-2xl bg-amber-50/70 p-6 text-center text-amber-800 border border-amber-200">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent mb-2" />
          <p className="font-medium">กำลังเตรียมข้อมูลการจองผ่าน LINE…</p>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-2xl bg-rose-50 p-6 text-center text-rose-800 border border-rose-200">
          <div className="text-2xl mb-2">⚠️</div>
          <h2 className="font-semibold text-rose-900 mb-1">ไม่สามารถเปิดหน้าจองได้</h2>
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      {state === "success" && context && (
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-emerald-100 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            ✨
          </div>
          <h2 className="text-xl font-bold text-slate-900">ส่งคำขอจองสำเร็จแล้ว!</h2>
          <p className="text-sm text-slate-600">
            คำขอจองห้องพักสำหรับร้าน <strong className="text-slate-800">{context.shop.name}</strong> ถูกส่งเข้าระบบเรียบร้อยแล้ว
          </p>

          <div className="rounded-2xl bg-slate-50 p-4 text-left text-sm space-y-2 border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">รหัสคำขอ:</span>
              <span className="font-mono text-xs text-slate-700">{submittedRequestId.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ห้องพัก:</span>
              <span className="font-medium text-slate-800">
                {selectedRoom?.roomNumber} ({selectedRoom?.roomType})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">วันที่เข้าพัก:</span>
              <span className="font-medium text-slate-800">{checkInDate} ถึง {checkOutDate} ({dateValidation.nights} คืน)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">สัตว์เลี้ยง:</span>
              <span className="font-medium text-slate-800">
                {context.pets.filter((p) => selectedPetIds.includes(p.id)).map((p) => p.name).join(", ")}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="font-medium text-slate-700">ยอดประเมิน:</span>
              <span className="font-bold text-amber-600">฿{totalEstimatedPrice.toLocaleString()}</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 text-left">
            ℹ️ เจ้าหน้าที่ของร้านจะตรวจสอบคิวห้องพักและติดต่อยืนยันรายละเอียดผ่านทาง LINE อีกครั้งครับ
          </div>
        </div>
      )}

      {(state === "ready" || state === "submitting") && context && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Shop & Customer Banner */}
          <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-100">
            <div className="text-xs font-medium text-amber-700 uppercase tracking-wider">จองห้องพักกับ</div>
            <div className="text-lg font-bold text-slate-900">{context.shop.name}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              ผู้จอง: {context.owner.firstName} ({context.owner.phone})
            </div>
          </div>

          {/* Step 1: Select Pets */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-800">
              1. เลือกสัตว์เลี้ยงที่เข้าพัก <span className="text-rose-500">*</span>
            </label>
            {context.pets.length === 0 ? (
              <p className="text-xs text-rose-600">ยังไม่มีข้อมูลสัตว์เลี้ยงในระบบ กรุณาติดต่อทางร้านเพื่อเพิ่มข้อมูล</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {context.pets.map((pet: CustomerBookingPet) => {
                  const selected = selectedPetIds.includes(pet.id);
                  return (
                    <button
                      type="button"
                      key={pet.id}
                      onClick={() => togglePet(pet.id)}
                      className={`flex items-center gap-2.5 rounded-2xl p-3 text-left transition-all border ${
                        selected
                          ? "border-amber-500 bg-amber-50/80 ring-2 ring-amber-400"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="text-xl">{pet.species === "cat" ? "🐱" : "🐶"}</span>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{pet.name}</div>
                        <div className="text-xs text-slate-500">{pet.breed || pet.species}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Select Room */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-800">
              2. เลือกประเภทห้องพัก <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2">
              {context.rooms.map((room: CustomerBookingRoom) => {
                const selected = selectedRoomId === room.id;
                const fitsPets = room.capacityPets >= selectedPetIds.length;
                return (
                  <button
                    type="button"
                    key={room.id}
                    disabled={!fitsPets}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`w-full flex items-center justify-between rounded-2xl p-3.5 text-left transition-all border ${
                      !fitsPets
                        ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200"
                        : selected
                          ? "border-amber-500 bg-amber-50/80 ring-2 ring-amber-400"
                          : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{room.roomNumber}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {room.roomType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        รองรับสูงสุด {room.capacityPets} ตัว {!fitsPets && "(ขนาดห้องไม่พอกับจำนวนสัตว์ที่เลือก)"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-700">฿{room.basePricePerNight.toLocaleString()}</div>
                      <div className="text-xs text-slate-400">/คืน</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Dates */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-800">
              3. วันที่เข้าพัก <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-slate-500 mb-1 block">วันเช็คอิน</span>
                <input
                  type="date"
                  required
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 mb-1 block">วันเช็คเอาท์</span>
                <input
                  type="date"
                  required
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {!dateValidation.valid && checkInDate && checkOutDate && (
              <p className="text-xs text-rose-600">{dateValidation.error}</p>
            )}

            {!isRoomCurrentlyAvailable && dateValidation.valid && (
              <p className="text-xs text-rose-600 font-medium">
                ⚠️ ห้องพักนี้มีผู้จองแล้วในช่วงเวลาดังกล่าว กรุณาเลือกห้องอื่นหรือเปลี่ยนวัน
              </p>
            )}
          </div>

          {/* Step 4: Special Requests */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-800">4. ข้อความหรือคำขอพิเศษเพิ่มเติม (ถ้ามี)</label>
            <textarea
              rows={2}
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="เช่น อาหารเฉพาะทาง, เวลาที่จะเข้ามาส่งน้อง..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Pricing & Summary Card */}
          {dateValidation.valid && selectedRoom && (
            <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-200/80 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">จำนวน {dateValidation.nights} คืน ({selectedPetIds.length} ตัว)</div>
                <div className="text-sm font-semibold text-slate-800">ยอดประเมินรวม</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-amber-700">฿{totalEstimatedPrice.toLocaleString()}</div>
                <div className="text-xs text-slate-400">ยังไม่รวมค่าบริการพิเศษ</div>
              </div>
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
            className="w-full rounded-2xl bg-amber-500 py-3.5 px-4 text-center font-bold text-white shadow-md transition-all hover:bg-amber-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {state === "submitting" ? "กำลังส่งคำขอจอง…" : "ส่งคำขอจองห้องพัก"}
          </button>
        </form>
      )}
    </div>
  );
}
