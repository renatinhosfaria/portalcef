/**
 * Pagina da Analista Pedagogica - Lista de Provas Pendentes
 */

import type { Metadata } from "next";

import { AnaliseProvasContent } from "./analise-content";

export const metadata: Metadata = {
  title: "Analise de Provas | Essência",
  description:
    "Dashboard da analista pedagogica para revisar provas pendentes.",
};

export default function AnaliseProvasPage() {
  return <AnaliseProvasContent />;
}
