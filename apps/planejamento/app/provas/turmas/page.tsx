import type { Metadata } from "next";

import { TurmasProvaContent } from "./turmas-content";

export const metadata: Metadata = {
  title: "Minhas Turmas - Provas | Essência",
  description: "Selecione uma turma para gerenciar suas provas.",
};

export default function TurmasProvaPage() {
  return <TurmasProvaContent />;
}
