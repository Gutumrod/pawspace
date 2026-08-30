"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginAction({ email, password });
      if (!res.success) setError(res.error || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลหรือรหัสผ่าน");
      else { router.push("/"); router.refresh(); }
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pawstia-login">
      <section className="pawstia-login-story" aria-label="เกี่ยวกับ Pawstia">
        <div className="pawstia-wordmark">Pawstia</div>
        <div className="pawstia-story-pet-detail" aria-hidden="true">
          <svg viewBox="0 0 220 140" focusable="false">
            <g className="pawstia-paw-stamps">
              <circle cx="166" cy="22" r="6" />
              <circle cx="181" cy="19" r="4" />
              <circle cx="154" cy="15" r="4" />
              <ellipse cx="168" cy="34" rx="9" ry="7" />
              <circle cx="197" cy="45" r="5" />
              <circle cx="209" cy="43" r="3.5" />
              <circle cx="188" cy="38" r="3.5" />
              <ellipse cx="198" cy="55" rx="8" ry="6" />
            </g>
            <g className="pawstia-pet-lineart">
              <path d="M25 103c3-25 18-40 39-40 18 0 32 11 38 29" />
              <path d="M39 70c-10-10-19-10-27-5 2 16 10 26 23 29M88 69c10-9 20-10 29-5-3 16-12 26-25 29" />
              <path d="M46 94c3 3 7 3 10 0M65 94c3 3 7 3 10 0M58 101c2 3 5 4 8 4 3 0 6-1 8-4" />
              <path d="M116 102c2-21 15-35 34-35 19 0 31 14 34 35" />
              <path d="m123 76 7-23 17 15M174 75l-6-22-17 15" />
              <path d="M139 91h1M160 91h1M148 99c3 3 6 3 9 0" />
              <path d="M15 113c25 7 53 9 83 5 30-4 59-3 90 4" />
            </g>
          </svg>
        </div>
        <div className="pawstia-story-copy">
          <p className="pawstia-kicker">PET HOTEL & DAYCARE OPERATING SYSTEM</p>
          <h1>ดูแลทุกการเข้าพัก<br />ให้เป็นเรื่องที่มั่นใจได้</h1>
          <p className="pawstia-story-lead">
            ระบบปฏิบัติการสำหรับโรงแรมสัตว์เลี้ยง ตั้งแต่ห้องพัก การจอง การดูแลประจำวัน ไปจนถึงการสื่อสารกับเจ้าของ
          </p>
        </div>
        <div className="pawstia-story-footer">
          <div><strong>Room Matrix</strong><span>เห็นสถานะห้องและแขกแต่ละตัวในภาพเดียว</span></div>
          <div><strong>Daily Care</strong><span>บันทึกอาหาร อารมณ์ การขับถ่าย และรูปประจำวัน</span></div>
          <div><strong>Guest Profile</strong><span>ประวัติการดูแลของสัตว์แต่ละตัวอยู่ในที่เดียว</span></div>
        </div>
      </section>

      <section className="pawstia-login-panel">
        <div className="pawstia-login-form-wrap">
          <div className="pawstia-login-mobile-brand">
            <span>Pawstia</span>
            <svg className="pawstia-mobile-paw" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
              <circle cx="8" cy="8" r="3" />
              <circle cx="14" cy="5" r="3" />
              <circle cx="20" cy="8" r="3" />
              <circle cx="23" cy="14" r="2.5" />
              <path d="M8 18c0-5 3-8 7-8s7 3 7 8c0 4-3 6-7 6s-7-2-7-6Z" />
            </svg>
          </div>
          <p className="pawstia-form-kicker">STAFF ACCESS</p>
          <h2>ยินดีต้อนรับกลับ</h2>
          <p className="pawstia-form-copy">เข้าสู่พื้นที่ทำงานของร้าน เพื่อจัดการห้องพัก การจอง การดูแลประจำวัน และข้อมูลเจ้าของสัตว์ในที่เดียว</p>

          {error && <div className="pawstia-form-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="pawstia-form">
            <label htmlFor="email">อีเมล
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@yourhotel.com" autoComplete="email" />
            </label>
            <label htmlFor="password">รหัสผ่าน
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </label>
            <button type="submit" disabled={loading} className="pawstia-primary-action">
              {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
          <p className="pawstia-form-footnote">สำหรับ Owner, Manager และทีมดูแลของร้าน</p>
        </div>
        <div className="pawstia-wstera">Pet Management System by WSTERA</div>
      </section>
    </main>
  );
}
