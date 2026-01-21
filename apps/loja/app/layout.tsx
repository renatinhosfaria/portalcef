import { Toaster } from "@essencia/ui/components/toaster";
import "@essencia/ui/globals.css";
import type { Metadata, Viewport } from "next";
import { Outfit, DM_Sans } from "next/font/google";

import "./globals.css";

// Fonte display para títulos e destaques - moderna e distintiva
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Fonte body para texto corrido - clean e legível
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portal CEF Store",
  description: "Compre uniformes escolares do Portal CEF de forma rápida e segura",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#A3D154",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${outfit.variable} ${dmSans.variable} font-body antialiased`}>
        <main className="min-h-screen bg-stone-50">{children}</main>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
