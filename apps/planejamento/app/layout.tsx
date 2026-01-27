import { Shell } from "@essencia/components/shell/shell";
import { TarefaBadgeContainer } from "@essencia/components/tarefas";
import { TenantProvider } from "@essencia/shared/providers/tenant";
import { Toaster } from "@essencia/ui/components/toaster";
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
          <Shell
            sidebarProps={{
              tarefasBadge: <TarefaBadgeContainer />,
            }}
          >
            {children}
            <MobileNav />
          </Shell>
          <Toaster position="bottom-right" />
        </TenantProvider>
      </body>
    </html>
  );
}
