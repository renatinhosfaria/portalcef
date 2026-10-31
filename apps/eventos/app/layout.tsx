import Image from "next/image";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Outfit } from "next/font/google";

import "@essencia/ui/globals.css";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Eventos | Colégio Essência Feliz",
  description: "Encontre eventos e reserve seus ingressos no Colégio Essência Feliz.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#A3D154",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${outfit.variable} ${dmSans.variable} font-body`}>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[var(--line)] bg-white/95">
            <div className="content-width flex min-h-20 items-center justify-between gap-4 py-4">
              <Link href="/" aria-label="Ir para eventos" className="flex items-center gap-3">
                <Image src="/logo.png" alt="Essência Feliz" width={160} height={40} className="h-10 w-auto" priority />
                <span className="font-display text-lg font-semibold text-[var(--ink)]">Eventos</span>
              </Link>
              <Link href="/pedido/consulta" className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--brand-green-dark)] transition hover:bg-[var(--surface-muted)]">
                Consultar pedido
              </Link>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--line)] bg-white">
            <div className="content-width py-8 text-sm text-[var(--ink-muted)]">Colégio Essência Feliz · Eventos</div>
          </footer>
        </div>
      </body>
    </html>
  );
}
