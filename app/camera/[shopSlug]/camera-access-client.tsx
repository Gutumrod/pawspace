"use client";

import { FormEvent, useState } from "react";

type FeedState =
  | { status: "locked"; message?: string }
  | { status: "loading" }
  | { status: "ready"; streamPath: string; deviceName: string };

type CameraAccessClientProps = {
  shopSlug: string;
  initialFeed: { streamPath: string; deviceName: "Microsoft LifeCam" } | null;
};

export default function CameraAccessClient({
  shopSlug,
  initialFeed,
}: CameraAccessClientProps) {
  const [code, setCode] = useState("");
  const [feed, setFeed] = useState<FeedState>(
    initialFeed
      ? { status: "ready", streamPath: initialFeed.streamPath, deviceName: initialFeed.deviceName }
      : { status: "locked" },
  );
  const [submitting, setSubmitting] = useState(false);

  async function loadFeed() {
    try {
      const response = await fetch(`/api/camera/feed/${encodeURIComponent(shopSlug)}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await response.json() as {
        success?: boolean;
        deviceName?: unknown;
        streamPath?: unknown;
      };
      if (
        response.ok &&
        body.success === true &&
        typeof body.streamPath === "string" &&
        body.deviceName === "Microsoft LifeCam"
      ) {
        setFeed({ status: "ready", streamPath: body.streamPath, deviceName: body.deviceName });
        return;
      }
    } catch {
      // Deliberately surface only a generic locked state.
    }
    setFeed({ status: "locked" });
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(`/api/camera/access/${encodeURIComponent(shopSlug)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json() as { success?: boolean; code?: string };
      if (response.ok && body.success === true) {
        setCode("");
        setFeed({ status: "loading" });
        await loadFeed();
        return;
      }

      const message = response.status === 429
        ? "ลองรหัสเกินจำนวนที่กำหนด กรุณารอแล้วลองใหม่"
        : response.status === 503
          ? "กล้องยังไม่พร้อมใช้งาน"
          : "รหัสเข้าดูกล้องไม่ถูกต้อง";
      setFeed({ status: "locked", message });
    } catch {
      setFeed({ status: "locked", message: "ไม่สามารถเชื่อมต่อ Live Camera ได้" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-6 py-5">
          <p className="text-sm font-medium text-slate-500">PawSpace Live Camera</p>
          <h1 className="mt-1 text-2xl font-semibold">Live Feed</h1>
        </header>

        {feed.status === "ready" ? (
          <div className="p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-500">
              <span>{feed.deviceName}</span>
              <span>Session จำกัดสิทธิ์เฉพาะ camera:view</span>
            </div>
            <div className="aspect-video overflow-hidden rounded-2xl bg-black">
              <iframe
                src={feed.streamPath}
                title="PawSpace live camera feed"
                className="h-full w-full border-0"
                allow="autoplay; fullscreen"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        ) : feed.status === "loading" ? (
          <div className="p-10 text-center text-slate-500">กำลังตรวจสอบสิทธิ์เข้าดูกล้อง…</div>
        ) : (
          <form onSubmit={submitCode} className="mx-auto max-w-md p-6 sm:p-10">
            <label htmlFor="camera-code" className="block text-sm font-medium text-slate-700">
              Visitor code
            </label>
            <input
              id="camera-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoComplete="one-time-code"
              inputMode="text"
              maxLength={16}
              required
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono text-lg tracking-[0.2em] outline-none focus:border-slate-500"
              placeholder="XXXXXXXX"
            />
            {feed.message ? <p className="mt-3 text-sm text-red-600">{feed.message}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
            >
              {submitting ? "กำลังตรวจสอบ…" : "เข้าดู Live Camera"}
            </button>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              รหัสจะถูกตรวจผ่านระบบที่จำกัดจำนวนครั้ง และ session สำหรับดูกล้องมีอายุ 30 นาที
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
