import { TenantProvider } from "@essencia/shared/providers/tenant";
import { Toaster } from "@essencia/ui/components/toaster";
import "@essencia/ui/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AdminShell } from "@/components/AdminShell";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Portal CEF Store | Admin",
  description: "Painel Administrativo - Loja de Uniformes",
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
          <AdminShell>{children}</AdminShell>
          <Toaster position="bottom-right" />
        </TenantProvider>
      </body>
    </html>
  );
}
