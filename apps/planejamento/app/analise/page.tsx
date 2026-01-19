/**
 * Pagina da Analista Pedagogica - Lista de Planos Pendentes
 * Task 4.2: Criar dashboard para a analista ver planos pendentes de analise
 */

import type { Metadata } from "next";

import { AnaliseContent } from "./analise-content";

export const metadata: Metadata = {
  title: "Analise de Planos de Aula | Essencia",
  description:
    "Dashboard da analista pedagogica para revisar planos de aula pendentes.",
};

export default function AnalisePage() {
  return <AnaliseContent />;
}
