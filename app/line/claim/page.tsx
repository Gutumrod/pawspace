import type { Metadata } from "next";
import { LineClaimClient } from "./LineClaimClient";

export const metadata: Metadata = {
  title: "เชื่อม LINE | PawSpace",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ token?: string; shop?: string }>;
};

export default async function LineClaimPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">เชื่อม LINE กับ PawSpace</h1>
        <p className="mt-2 text-sm text-slate-600">ยืนยันบัญชี LINE เพื่อรับ Daily Care Report จากร้าน</p>
        <LineClaimClient claimToken={params.token || ""} expectedShopId={params.shop || ""} liffId={liffId} />
      </div>
    </main>
  );
}
