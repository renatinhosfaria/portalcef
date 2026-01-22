import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Toaster } from "@essencia/ui/components/toaster";
import { TarefaNotificacaoProvider } from "@/features/notificacoes/tarefa-notificacao-provider";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tarefas - Portal CEF",
  description: "Gerenciamento de tarefas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <TarefaNotificacaoProvider>
          {children}
        </TarefaNotificacaoProvider>
        <Toaster />
      </body>
    </html>
  );
}
