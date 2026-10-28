import { Shell } from "@essencia/components/shell/shell";
import { serverApi } from "@essencia/shared/fetchers/server";
import { TenantProvider } from "@essencia/shared/providers/tenant";
import { Toaster } from "@essencia/ui/components/toaster";
import "@essencia/ui/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eventos Admin | Essência",
  description: "Painel administrativo de eventos",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

async function exigirSessao() {
  const cookieString = (await cookies()).toString();
  try {
    await serverApi.get("/api/auth/me", { cookies: cookieString });
  } catch {
    redirect("/login");
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await exigirSessao();
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <TenantProvider>
          <Shell>{children}</Shell>
          <Toaster position="bottom-right" />
        </TenantProvider>
      </body>
    </html>
  );
}
