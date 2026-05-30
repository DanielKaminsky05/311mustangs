import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${robotoDisplay.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-ink">
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
        <main className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
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
