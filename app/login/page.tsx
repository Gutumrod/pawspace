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
      if (!res.success) {
        setError(res.error || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลหรือรหัสผ่าน");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--mint)] text-[var(--deep)] grid place-items-center font-black text-lg">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--ink)] tracking-tight">PawSpace</h1>
            <p className="text-xs text-[var(--muted)]">Pet Hotel Operations</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-[var(--ink)] mb-1">เข้าสู่ระบบสำหรับพนักงาน</h2>
        <p className="text-xs text-[var(--muted)] mb-6">กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งานระบบโรงแรมสัตว์เลี้ยง</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5" htmlFor="email">
              อีเมล (Email)
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@pawspace.co"
              className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--deep)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5" htmlFor="password">
              รหัสผ่าน (Password)
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--deep)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[var(--deep)] hover:bg-[#236153] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition duration-150 disabled:opacity-50"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
