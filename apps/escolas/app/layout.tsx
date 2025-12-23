import "@essencia/ui/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { TenantProvider } from "../components/providers/tenant-provider";
import { Shell } from "../components/shell/shell";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Essência Portal - Gestão Escolar",
  description: "Módulo administrativo para gestão de escolas e unidades",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <TenantProvider>
          <Shell>{children}</Shell>
        </TenantProvider>
      </body>
    </html>
  );
}
