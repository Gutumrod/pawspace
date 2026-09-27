"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type LinkState = "checking" | "ready" | "invalid";

export default function AcceptInvitePage() {
  const router = useRouter();
  const t = useTranslations("invite");
  const tCommon = useTranslations("common");
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let settled = false;

    const settle = (hasSession: boolean) => {
      if (settled) return;
      settled = true;
      setLinkState(hasSession ? "ready" : "invalid");
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) settle(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) settle(true);
    });

    const timeout = setTimeout(() => settle(false), 4000);

    return () => {
      clearTimeout(timeout);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("errorTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("errorMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || t("errorUpdateFailed"));
        return;
      }
      // This page only consumes the invite link; the app's real session is the
      // separate httpOnly-cookie one established by /login (see lib/auth.ts).
      await supabase.auth.signOut();
      router.push("/login?invited=1");
    } catch {
      setError(tCommon("connectionError"));
    } finally {
      setSubmitting(false);
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
            <p className="text-xs text-[var(--muted)]">{t("caption")}</p>
          </div>
        </div>

        {linkState === "checking" && (
          <p data-testid="accept-invite-checking" className="text-sm text-[var(--muted)]">
            {t("checking")}
          </p>
        )}

        {linkState === "invalid" && (
          <p data-testid="accept-invite-invalid" className="text-sm text-red-700">
            {t("invalidLink")}
          </p>
        )}

        {linkState === "ready" && (
          <form data-testid="accept-invite-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5" htmlFor="password">
                {t("passwordLabel")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--deep)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5" htmlFor="confirmPassword">
                {t("confirmPasswordLabel")}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--deep)]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 bg-[var(--deep)] hover:bg-[#236153] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition duration-150 disabled:opacity-50"
            >
              {submitting ? t("submitting") : t("submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
