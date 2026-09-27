"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { LanguageToggle } from "@/app/components/language-toggle";

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
  const t = useTranslations("camera");
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
        ? t("errorRateLimited")
        : response.status === 503
          ? t("errorCameraUnavailable")
          : t("errorInvalidCode");
      setFeed({ status: "locked", message });
    } catch {
      setFeed({ status: "locked", message: t("errorConnection") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">{t("brandLabel")}</p>
              <h1 className="mt-1 text-2xl font-semibold">{t("heading")}</h1>
            </div>
            <LanguageToggle />
          </div>
        </header>

        {feed.status === "ready" ? (
          <div className="p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-500">
              <span>{feed.deviceName}</span>
              <span>{t("sessionScope")}</span>
            </div>
            <div className="aspect-video overflow-hidden rounded-2xl bg-black">
              <iframe
                src={feed.streamPath}
                title={t("streamTitle")}
                className="h-full w-full border-0"
                allow="autoplay; fullscreen"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        ) : feed.status === "loading" ? (
          <div className="p-10 text-center text-slate-500">{t("checkingAccess")}</div>
        ) : (
          <form onSubmit={submitCode} className="mx-auto max-w-md p-6 sm:p-10">
            <label htmlFor="camera-code" className="block text-sm font-medium text-slate-700">
              {t("visitorCodeLabel")}
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
              {submitting ? t("verifying") : t("submit")}
            </button>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              {t("codeNotice")}
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
