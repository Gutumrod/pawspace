import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { localeCookieName, resolveLocale } from "@/app/i18n/config";
import { getServerTranslator } from "@/app/i18n/server-translator";
import { LanguageToggle } from "@/app/components/language-toggle";
import { LineBookingClient } from "./LineBookingClient";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value);
  const { t } = getServerTranslator(locale, "line");

  return {
    title: t("bookingMetaTitle"),
    referrer: "no-referrer",
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  searchParams: Promise<{ shop?: string; shop_id?: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveShopId(paramShop: string | undefined): Promise<string> {
  const shop = paramShop?.trim();
  if (!shop) return "";
  if (UUID_RE.test(shop)) return shop;

  // Otherwise, treat as shop slug
  try {
    const admin = getSupabaseAdminClient();
    const { data } = await admin.from("shops").select("id").eq("slug", shop).maybeSingle();
    return data?.id ? String(data.id) : "";
  } catch {
    return "";
  }
}

export default async function LineBookingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const shopParam = params.shop || params.shop_id || "";
  const shopId = await resolveShopId(shopParam);
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";

  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value);
  const { t } = getServerTranslator(locale, "line");

  return (
    <main className="liff-shell">
      <div className="liff-container">
        <div className="liff-card">
          <header className="liff-header">
            <div className="liff-brand">
              <div className="brand-mark" aria-hidden="true">
                🐾
              </div>
              <div>
                <h1 className="liff-brand-title">PawSpace</h1>
                <p className="liff-brand-subtitle">{t("brandSubtitle")}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <LanguageToggle />
              <span className="liff-badge">
                <span>✦</span> {t("bookingBadge")}
              </span>
            </div>
          </header>

          <LineBookingClient shopId={shopId} liffId={liffId} />
        </div>
      </div>
    </main>
  );
}
