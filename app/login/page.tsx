"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { loginAction } from "@/app/actions/auth";
import { LanguageToggle } from "@/app/components/language-toggle";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("login");
  const tCommon = useTranslations("common");
  const tBrand = useTranslations("brand");
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
        setError(res.error || t("errorNotAllowed"));
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError(tCommon("connectionError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-mark">
            P
          </div>
          <div>
            <h1 className="login-title">PawSpace</h1>
            <p className="login-caption">{tBrand("caption")}</p>
          </div>
          <div className="header-actions" style={{ marginLeft: "auto" }}>
            <LanguageToggle />
          </div>
        </div>

        <h2 className="login-title">{t("heading")}</h2>
        <p className="login-copy">{t("intro")}</p>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div>
            <label className="login-field" htmlFor="email">
              {t("emailLabel")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@pawspace.co"
              className="login-input"
            />
          </div>

          <div>
            <label className="login-field" htmlFor="password">
              {t("passwordLabel")}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="login-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="primary-button login-submit"
          >
            {loading ? t("submitting") : t("submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
