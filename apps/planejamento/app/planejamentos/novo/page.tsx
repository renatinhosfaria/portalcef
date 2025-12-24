import type { Metadata } from "next";
import {
  WizardContainer,
  WizardErrorBoundary,
} from "../../../features/wizard/components";

export const metadata: Metadata = {
  title: "Novo Planejamento | Essência",
  description:
    "Crie um novo planejamento pedagógico passo a passo com nosso assistente guiado",
};

export default function NovoPage() {
  return (
    <WizardErrorBoundary>
      <WizardContainer />
    </WizardErrorBoundary>
  );
}
