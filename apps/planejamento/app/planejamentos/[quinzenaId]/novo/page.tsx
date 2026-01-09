import {
  WizardContainer,
  WizardErrorBoundary,
} from "../../../../features/wizard/components";

interface PageProps {
  params: Promise<{
    quinzenaId: string;
  }>;
}

export default async function NovoPlanejamentoPage({ params }: PageProps) {
  const { quinzenaId } = await params;
  return (
    <WizardErrorBoundary>
      <WizardContainer quinzenaId={quinzenaId} />
    </WizardErrorBoundary>
  );
}
