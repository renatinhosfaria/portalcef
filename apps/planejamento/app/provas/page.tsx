import type { Metadata } from "next";

import { ProvasContent } from "./provas-content";

export const metadata: Metadata = {
  title: "Minhas Provas | Essência",
  description: "Gerencie suas provas por ciclo avaliativo.",
};

export default function ProvasPage() {
  return <ProvasContent />;
}
