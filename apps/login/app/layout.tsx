import "@essencia/ui/globals.css"; // Shared design system styles
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Main font
import "./globals.css"; // Local styles

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Essência Portal - Login",
  description: "Acesso ao portal digital do Colégio Essência Feliz",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
