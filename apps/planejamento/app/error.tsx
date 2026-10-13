"use client";

import { TelaErro } from "../components/tela-erro";

export default function ErroPlanejamento({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TelaErro erro={error} reset={reset} origem="tela_erro" />;
}
