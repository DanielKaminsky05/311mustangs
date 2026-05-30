import type { Metadata, Viewport } from "next";
import { Roboto, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { CivicHeader } from "./_components/CivicHeader";
import { SubNav, SubNavSkeleton } from "./_components/SubNav";
import { SystemStatus, SystemStatusSkeleton } from "./_components/SystemStatus";

const roboto = Roboto({
  variable: "--font-text",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const robotoDisplay = Roboto({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "311 Mustangs · Operator Console",
  description:
    "Toronto 311 resolution engine — operator dashboard for the DGX Spark triage pipeline.",
};

export const viewport: Viewport = {
  themeColor: "#002347",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${robotoDisplay.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-civic-blue focus:text-white focus:rounded-[3px] focus:underline"
        >
          Skip to main content
        </a>
        <CivicHeader
          rightSlot={
            <Suspense fallback={<SystemStatusSkeleton />}>
              <SystemStatus />
            </Suspense>
          }
        />
        <Suspense fallback={<SubNavSkeleton />}>
          <SubNav />
        </Suspense>
        <main id="main" className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
            {children}
          </div>
        </main>
        <footer className="bg-civic-blue-dark text-white text-xs">
          <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
            <span>© City of Toronto · 311 Operator Console</span>
            <span className="opacity-80">
              You are always the one who decides what gets sent.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
