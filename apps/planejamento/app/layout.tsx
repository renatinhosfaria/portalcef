import { Shell } from "@essencia/components/shell/shell";
import { TenantProvider } from "@essencia/shared/providers/tenant";
import "@essencia/ui/globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { MobileNav } from "../features/shell/components/mobile-nav";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Planejamento | Essência",
  description: "Módulo de Planejamento Pedagógico",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <TenantProvider>
          <Shell>
            {children}
            <MobileNav />
          </Shell>
        </TenantProvider>
      </body>
    </html>
  );
}
