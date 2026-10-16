import type { Metadata } from "next";
import { Noto_Sans_Bengali, Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-bengali",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ভূমিপ্রহরী (BhumiPrahari) - Digital Land Record & Deed Protection Platform",
  description:
    "Independent cryptographic verification for Bangladesh land deeds and records. Powered by Ed25519 digital signatures, SHA-256 hash chains, and explainable AI fraud detection.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="bn"
      className={`${notoSansBengali.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-emerald-500 selection:text-white">
        <LanguageProvider>
          <AuthProvider>
            <Header />
            <main className="flex-1 w-full">{children}</main>
            <Footer />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
