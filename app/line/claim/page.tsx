import type { Metadata } from "next";
import { LineClaimClient } from "./LineClaimClient";

export const metadata: Metadata = {
  title: "เชื่อม LINE | Pawstia",
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
    <main className="pawstia-public-shell">
      <section className="pawstia-public-card pawstia-line-card">
        <header className="pawstia-public-header">
          <div>
            <div className="pawstia-wordmark pawstia-wordmark-small">Pawstia</div>
            <p>Daily Care & Booking</p>
          </div>
          <span className="pawstia-channel-label">LINE</span>
        </header>
        <div className="pawstia-public-body">
          <p className="pawstia-kicker">CONNECT YOUR LINE</p>
          <h1>รับข่าวการดูแลของน้อง<br />จากร้านได้ตรงถึงคุณ</h1>
          <p className="pawstia-public-copy">ยืนยันบัญชี LINE เพื่อรับ Daily Care Report และข้อความอัปเดตที่เกี่ยวข้องกับการเข้าพักจากร้าน</p>
          <LineClaimClient claimToken={params.token || ""} expectedShopId={params.shop || ""} liffId={liffId} />
        </div>
      </section>
    </main>
  );
}
