import type { Metadata } from "next";

import { PlanejamentosContent } from "./planejamentos-content";

export const metadata: Metadata = {
  title: "Meus Planejamentos | Essência",
  description: "Gerencie seus planejamentos quinzenais.",
};

export default function PlanejamentosPage() {
  return <PlanejamentosContent />;
}
