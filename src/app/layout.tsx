import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { IdleAutoLock } from "@/components/IdleAutoLock";
import { getSecurityConfig } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MedScript OPD",
  description: "Prescription Management System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const securityConfig = await getSecurityConfig();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Toaster>
          {children}
        </Toaster>
        <IdleAutoLock
          autoLockMinutes={securityConfig.autoLockMinutes}
          enabled={securityConfig.securityEnabled}
        />
      </body>
    </html>
  );
}
