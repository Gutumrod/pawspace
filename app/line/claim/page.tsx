import type { Metadata } from "next";
import { cookies } from "next/headers";
import { localeCookieName, resolveLocale } from "@/app/i18n/config";
import { getServerTranslator } from "@/app/i18n/server-translator";
import { LanguageToggle } from "@/app/components/language-toggle";
import { LineClaimClient } from "./LineClaimClient";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value);
  const { t } = getServerTranslator(locale, "line");

  return {
    title: t("claimMetaTitle"),
    referrer: "no-referrer",
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  searchParams: Promise<{ token?: string; shop?: string }>;
};

export default async function LineClaimPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";

  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value);
  const { t } = getServerTranslator(locale, "line");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{t("claimTitle")}</h1>
          <LanguageToggle />
        </div>
        <p className="mt-2 text-sm text-slate-600">{t("claimIntro")}</p>
        <LineClaimClient claimToken={params.token || ""} expectedShopId={params.shop || ""} liffId={liffId} />
      </div>
    </main>
  );
}
