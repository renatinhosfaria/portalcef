import type { Metadata } from "next";

import { CiclosContent } from "./ciclos-content";

export const metadata: Metadata = {
  title: "Gestao de Provas",
};

export default function CiclosPage() {
  return <CiclosContent />;
}
