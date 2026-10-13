"use client";

import { Button } from "@essencia/ui/components/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { registrarErroGlobal } from "../lib/observabilidade";

export interface TelaErroProps {
  erro: Error & { digest?: string };
  reset: () => void;
  origem: "tela_erro" | "tela_erro_global";
}

/**
 * Tela exibida quando uma página do planejamento quebra no navegador.
 * Registra a falha na telemetria; o digest liga o evento ao log do servidor.
 */
export function TelaErro({ erro, reset, origem }: TelaErroProps) {
  const pathname = usePathname();

  useEffect(() => {
    registrarErroGlobal(origem, erro, {
      correlationId: erro.digest ?? null,
      pagina: {
        url: pathname ?? window.location.pathname,
        titulo: document.title,
      },
    });
  }, [erro, origem, pathname]);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center px-4 py-16 text-center"
    >
      <AlertCircle className="mb-4 h-16 w-16 text-muted-foreground/40" />
      <h1 className="mb-2 text-2xl font-bold">Algo deu errado nesta tela</h1>
      <p className="max-w-md text-muted-foreground">
        O problema já foi registrado. Tente novamente; se continuar, avise a
        coordenação.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          Tentar novamente
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
