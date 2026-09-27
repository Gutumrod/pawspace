import type { Metadata } from "next";
import { cookies } from "next/headers";
import { I18nProvider } from "@/app/i18n/locale-provider";
import { localeCookieName, resolveLocale } from "@/app/i18n/config";
import { getMessages } from "@/app/i18n/messages";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value);
  const messages = getMessages(locale);

  return {
    title: messages.meta.title,
    description: messages.meta.description,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value);

  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
