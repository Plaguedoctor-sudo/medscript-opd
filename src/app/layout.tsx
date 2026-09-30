import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { IdleAutoLock } from "@/components/IdleAutoLock";
import { PwaRegister } from "@/components/PwaRegister";
import { MobileNavigation } from "@/components/MobileNavigation";
import { getSecurityConfig, getCurrentUserRole, getCurrentUser } from "@/lib/auth";
import { db } from "@/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: "MedScript OPD",
  description: "Offline-First Outpatient Prescription & Electronic Medical Records (EMR) System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MedScript OPD",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [securityConfig, role, currentUser, clinicSettings] = await Promise.all([
    getSecurityConfig(),
    getCurrentUserRole(),
    getCurrentUser(),
    db.query.clinicSettings.findFirst(),
  ]);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-mobile-nav md:pb-0`}
      >
        <Toaster>
          {children}
        </Toaster>
        <MobileNavigation
          userRole={role}
          userName={currentUser?.name}
          clinicName={clinicSettings?.clinicName}
        />
        <PwaRegister />
        <IdleAutoLock
          autoLockMinutes={securityConfig.autoLockMinutes}
          enabled={securityConfig.securityEnabled}
        />
      </body>
    </html>
  );
}
