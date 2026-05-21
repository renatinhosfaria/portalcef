import type { Metadata } from "next";

import { PeriodosContent } from "./periodos-content";

export const metadata: Metadata = {
  title: "Gestão de Planos de Aula",
};

export default function PeriodosPage() {
  return <PeriodosContent />;
}
