import type { Metadata } from "next";
import { EB_Garamond, Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import Footer from "@/components/site/Footer";
import Header from "@/components/site/Header";
import { I18nProvider } from "@/i18n/client";
import { getDictionary, getLocale } from "@/i18n/server";
import { SITE } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const serifLatin = EB_Garamond({
  variable: "--font-serif-latin",
  subsets: ["latin"],
});

const serifSC = Noto_Serif_SC({
  variable: "--font-serif-sc",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return {
    title: {
      default: `${SITE.name} — ${t.common.tagline}`,
      template: `%s · ${SITE.name}`,
    },
    description: t.home.heroSubtitle,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <html
      lang={locale === "zh" ? "zh-CN" : "en"}
      className={`${geistSans.variable} ${geistMono.variable} ${serifLatin.variable} ${serifSC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} dictionary={dictionary}>
          <Header />
          <div className="flex flex-1 flex-col">{children}</div>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
