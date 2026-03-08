import type { Metadata } from "next";

import { TurmasContent } from "./turmas-content";

export const metadata: Metadata = {
  title: "Minhas Turmas | Essência",
  description: "Selecione uma turma para gerenciar seus planos de aula.",
};

export default function TurmasPage() {
  return <TurmasContent />;
}
