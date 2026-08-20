import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PawSpace · Pet Hotel Operations",
  description: "Pet Hotel OS ที่ทีมหน้าร้านใช้ได้จริง",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
