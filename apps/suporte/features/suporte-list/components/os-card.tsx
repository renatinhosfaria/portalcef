"use client";

import { useRouter } from "next/navigation";
import { Button } from "@essencia/ui/components/button";
import type { KeyboardEvent } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@essencia/ui/components/card";
import type { OrdemServicoEnriquecida } from "@essencia/shared/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Trash2 } from "lucide-react";
import { OsStatusBadge } from "./os-status-badge";
import { OsCategoriaBadge } from "./os-status-badge";

interface OsCardProps {
  ordem: OrdemServicoEnriquecida;
  isAdmin?: boolean;
  podeExcluir?: boolean;
  excluindo?: boolean;
  onExcluir?: (ordem: OrdemServicoEnriquecida) => void;
}

export function OsCard({
  ordem,
  isAdmin,
  podeExcluir = false,
  excluindo = false,
  onExcluir,
}: OsCardProps) {
  const router = useRouter();
  const dataRelativa = formatDistanceToNow(new Date(ordem.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });

  const irParaDetalhe = () => {
    router.push(`/${ordem.id}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      irParaDetalhe();
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={irParaDetalhe}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-bold font-mono text-muted-foreground">
              OS-{ordem.numero}
            </span>
            <h3 className="text-lg font-semibold truncate">{ordem.titulo}</h3>
          </div>
          <div className="flex items-center gap-2">
            <OsStatusBadge status={ordem.status} />
            {podeExcluir && onExcluir && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={excluindo}
                title="Excluir OS"
                onClick={(event) => {
                  event.stopPropagation();
                  onExcluir(ordem);
                }}
              >
                {excluindo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <OsCategoriaBadge categoria={ordem.categoria} />

        <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
          {isAdmin && (
            <span>
              Por: <span className="font-medium">{ordem.criadoPorNome}</span>
            </span>
          )}
          <span className={isAdmin ? "" : "ml-auto"}>{dataRelativa}</span>
        </div>
      </CardContent>
    </Card>
  );
}
