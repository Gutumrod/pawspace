"use client";

import Script from "next/script";
import { useRef, useState } from "react";

type Props = { claimToken: string; expectedShopId: string; liffId: string };
type ClaimState = "idle" | "working" | "success" | "error";
type LiffApi = {
  init(input: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(input?: { redirectUri?: string }): void;
  getIDToken(): string | null;
};

declare global { interface Window { liff?: LiffApi } }

export function LineClaimClient({ claimToken, expectedShopId, liffId }: Props) {
  const started = useRef(false);
  const [state, setState] = useState<ClaimState>("idle");
  const [message, setMessage] = useState("กำลังเตรียมการยืนยัน LINE…");

  async function runClaim() {
    if (started.current) return;
    started.current = true;
    setState("working");

    if (!claimToken || !expectedShopId || !liffId || !window.liff) {
      setState("error");
      setMessage("ลิงก์เชื่อม LINE ไม่สมบูรณ์หรือระบบ LIFF ยังไม่ได้ตั้งค่า");
      return;
    }

    try {
      await window.liff.init({ liffId });
      if (!window.liff.isLoggedIn()) {
        window.liff.login({ redirectUri: window.location.href });
        return;
      }
      const idToken = window.liff.getIDToken();
      if (!idToken) {
        setState("error");
        setMessage("ไม่สามารถอ่าน LINE ID token ได้ กรุณาเปิดลิงก์ใหม่จาก LINE");
        return;
      }
      const response = await fetch("/api/line/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ claimToken, expectedShopId, idToken }),
      });
      const result = (await response.json()) as { success?: boolean; code?: string };
      if (!response.ok || result.success !== true) {
        setState("error");
        setMessage(result.code === "CLAIM_REJECTED"
          ? "ลิงก์นี้หมดอายุ ถูกใช้แล้ว หรือไม่ตรงกับร้าน กรุณาขอลิงก์ใหม่"
          : "ยืนยัน LINE ไม่สำเร็จ กรุณาลองเปิดลิงก์ใหม่");
        return;
      }
      setState("success");
      setMessage("เชื่อม LINE สำเร็จแล้ว สามารถปิดหน้านี้ได้");
    } catch {
      setState("error");
      setMessage("เกิดข้อผิดพลาดระหว่างยืนยัน LINE กรุณาลองใหม่");
    }
  }

  return (
    <div className="pawstia-claim-status-wrap">
      <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="afterInteractive"
        onReady={() => void runClaim()}
        onError={() => { setState("error"); setMessage("โหลด LINE LIFF SDK ไม่สำเร็จ กรุณาลองใหม่"); }} />
      <div className={`pawstia-claim-status state-${state}`} role="status">
        <span className="pawstia-status-line" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}
