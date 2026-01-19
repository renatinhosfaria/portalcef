/**
 * Pagina da Coordenadora - Lista de Planos Pendentes de Aprovacao Final
 * Task 4.4: Criar dashboard para a coordenadora ver planos pendentes de aprovacao
 */

import type { Metadata } from "next";

import { CoordenacaoContent } from "./coordenacao-content";

export const metadata: Metadata = {
  title: "Aprovacao Final de Planos de Aula | Essencia",
  description:
    "Dashboard da coordenadora para aprovar planos de aula pendentes.",
};

export default function CoordenacaoPage() {
  return <CoordenacaoContent />;
}
