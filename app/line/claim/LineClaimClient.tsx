"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  claimToken: string;
  expectedShopId: string;
  liffId: string;
};

type ClaimState = "idle" | "working" | "success" | "error";

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

export function LineClaimClient({ claimToken, expectedShopId, liffId }: Props) {
  const started = useRef(false);
  const t = useTranslations("lineClaim");
  const [state, setState] = useState<ClaimState>("idle");
  const [message, setMessage] = useState(t("preparing"));

  async function runClaim() {
    if (started.current) return;
    started.current = true;
    setState("working");

    if (!claimToken || !expectedShopId || !liffId || !window.liff) {
      setState("error");
      setMessage(t("errorIncompleteLink"));
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
        setMessage(t("errorNoIdToken"));
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
        setMessage(result.code === "CLAIM_REJECTED" ? t("errorRejected") : t("errorFailed"));
        return;
      }

      setState("success");
      setMessage(t("success"));
    } catch {
      setState("error");
      setMessage(t("errorUnexpected"));
    }
  }
  return (
    <div className="mt-6">
      <Script
        src="https://static.line-scdn.net/liff/edge/2/sdk.js"
        strategy="afterInteractive"
        onReady={() => void runClaim()}
        onError={() => {
          setState("error");
          setMessage(t("errorSdkLoad"));
        }}
      />
      <div
        className={`rounded-2xl px-4 py-4 text-sm ${
          state === "success"
            ? "bg-emerald-50 text-emerald-800"
            : state === "error"
              ? "bg-rose-50 text-rose-800"
              : "bg-slate-100 text-slate-700"
        }`}
      >
        {message}
      </div>
    </div>
  );
}
