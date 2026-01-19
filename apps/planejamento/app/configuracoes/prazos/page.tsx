import type { Metadata } from "next";

import { PrazosContent } from "./prazos-content";

export const metadata: Metadata = {
  title: "Configuracao de Prazos | Essencia",
  description: "Defina os prazos de entrega para cada quinzena.",
};

export default function PrazosPage() {
  return <PrazosContent />;
}
