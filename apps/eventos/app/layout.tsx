import type { Metadata, Viewport } from "next";
import { DM_Sans, Outfit } from "next/font/google";

import "@essencia/ui/globals.css";
import "./globals.css";
import { Cabecalho } from "../components/base/cabecalho";
import { RodapeConfianca } from "../components/base/rodape-confianca";

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
          <Cabecalho />
          <main className="flex-1">{children}</main>
          <RodapeConfianca />
        </div>
      </body>
    </html>
  );
}
