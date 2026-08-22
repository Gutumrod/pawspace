import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { LineBookingClient } from "./LineBookingClient";

export const metadata: Metadata = {
  title: "จองห้องพัก | PawSpace",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:py-12">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">PawSpace</h1>
              <p className="text-xs text-slate-500">ระบบจองห้องพักสัตว์เลี้ยง</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            LINE Booking
          </span>
        </div>

        <LineBookingClient shopId={shopId} liffId={liffId} />
      </div>
    </main>
  );
}
