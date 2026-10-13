"use client";

import "@essencia/ui/globals.css";

import { TelaErro } from "../components/tela-erro";

import "./globals.css";

/**
 * Substitui o layout raiz quando ele próprio quebra (Shell, providers);
 * por isso precisa declarar html e body.
 */
export default function ErroGlobalPlanejamento({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <TelaErro erro={error} reset={reset} origem="tela_erro_global" />
      </body>
    </html>
  );
}
