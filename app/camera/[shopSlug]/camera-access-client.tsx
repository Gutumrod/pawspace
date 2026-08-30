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

export default function CameraAccessClient({ shopSlug, initialFeed }: CameraAccessClientProps) {
  const [code, setCode] = useState("");
  const [feed, setFeed] = useState<FeedState>(initialFeed
    ? { status: "ready", streamPath: initialFeed.streamPath, deviceName: initialFeed.deviceName }
    : { status: "locked" });
  const [submitting, setSubmitting] = useState(false);

  async function loadFeed() {
    try {
      const response = await fetch(`/api/camera/feed/${encodeURIComponent(shopSlug)}`, {
        method: "GET", credentials: "same-origin", cache: "no-store",
      });
      const body = await response.json() as { success?: boolean; deviceName?: unknown; streamPath?: unknown };
      if (response.ok && body.success === true && typeof body.streamPath === "string" && body.deviceName === "Microsoft LifeCam") {
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
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
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
    <main className="pawstia-public-shell pawstia-camera-shell">
      <section className="pawstia-public-card pawstia-camera-card">
        <header className="pawstia-public-header">
          <div>
            <div className="pawstia-wordmark pawstia-wordmark-small">Pawstia</div>
            <p>Private pet stay camera</p>
          </div>
          <span className="pawstia-channel-label">PRIVATE VIEW</span>
        </header>

        {feed.status === "ready" ? (
          <div className="pawstia-camera-body">
            <div className="pawstia-camera-meta">
              <div><strong>Live room view</strong><span>{feed.deviceName}</span></div>
              <span>Session 30 นาที</span>
            </div>
            <div className="pawstia-camera-frame">
              <iframe src={feed.streamPath} title="Pawstia live camera feed" allow="autoplay; fullscreen" referrerPolicy="no-referrer" />
            </div>
          </div>
        ) : feed.status === "loading" ? (
          <div className="pawstia-camera-loading">กำลังตรวจสอบสิทธิ์เข้าดูกล้อง…</div>
        ) : (
          <div className="pawstia-camera-body pawstia-camera-locked">
            <p className="pawstia-kicker">VISITOR ACCESS</p>
            <h1>แวะมาดูน้อง<br />ระหว่างเข้าพัก</h1>
            <p className="pawstia-public-copy">กรอกรหัสสำหรับผู้เยี่ยมชมที่ได้รับจากร้าน ระบบจะเปิดเฉพาะสัญญาณภาพของห้องที่ได้รับอนุญาต</p>
            <form onSubmit={submitCode} className="pawstia-camera-form">
              <label htmlFor="camera-code">รหัสสำหรับเข้าชม
                <input id="camera-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())}
                  autoComplete="one-time-code" inputMode="text" maxLength={16} required placeholder="XXXXXXXX" />
              </label>
              {feed.message ? <p className="pawstia-camera-error" role="alert">{feed.message}</p> : null}
              <button type="submit" disabled={submitting} className="pawstia-primary-action">
                {submitting ? "กำลังตรวจสอบ…" : "เปิดกล้องของน้อง"}
              </button>
            </form>
            <p className="pawstia-camera-note">เพื่อความเป็นส่วนตัว รหัสถูกจำกัดจำนวนครั้งในการลองและ session มีอายุ 30 นาทีต่อครั้ง</p>
          </div>
        )}
      </section>
    </main>
  );
}