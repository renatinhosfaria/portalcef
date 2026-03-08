/**
 * Pagina de Gestao - Dashboard de Provas
 * Para Coordenadora Geral, Gerente e Diretora
 */

import type { Metadata } from "next";

import { DashboardProvasContent } from "./dashboard-content";

export const metadata: Metadata = {
  title: "Dashboard de Provas | Essência",
  description:
    "Dashboard de gestao para acompanhar o status das provas.",
};

export default function GestaoProvasPage() {
  return <DashboardProvasContent />;
}
