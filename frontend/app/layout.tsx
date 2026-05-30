import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { CivicHeader } from "./_components/CivicHeader";
import { NavRail, NavRailSkeleton } from "./_components/NavRail";
import { StatusStrip, StatusStripSkeleton } from "./_components/StatusStrip";

const inter = Inter({
  variable: "--font-text",
  subsets: ["latin"],
  display: "swap",
});

const interDisplay = Inter({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600"],
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
      className={`${inter.variable} ${interDisplay.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-civic-blue-soft/30">
        <CivicHeader />
        <Suspense fallback={<StatusStripSkeleton />}>
          <StatusStrip />
        </Suspense>
        <div className="flex flex-1 min-h-0">
          <Suspense fallback={<NavRailSkeleton />}>
            <NavRail />
          </Suspense>
          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
