/**
 * Pagina de Gestao - Dashboard para Coordenadora Geral, Gerente e Diretora
 * Task 4.6: Dashboard de Planos de Aula para roles de gestao
 */

import type { Metadata } from "next";

import { DashboardContent } from "./dashboard-content";

export const metadata: Metadata = {
  title: "Dashboard de Planos de Aula | Essencia",
  description:
    "Dashboard de gestao para acompanhar o status dos planos de aula.",
};

export default function GestaoPage() {
  return <DashboardContent />;
}
