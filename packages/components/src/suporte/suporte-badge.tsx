"use client";

import { Button } from "@essencia/ui/components/button";
import { Badge } from "@essencia/ui/components/badge";
import { Headset } from "lucide-react";

export interface SuporteBadgeProps {
  /** Numero de OS abertas */
  abertas: number;
  /** Numero de OS em andamento */
  emAndamento: number;
  /** Callback ao clicar no badge */
  onClick?: () => void;
}

/**
 * Widget de badge para notificacao de OS pendentes no suporte
 *
 * Exibe um botao com icone de headset e badge indicando:
 * - Total de OS ativas (abertas + em andamento)
 * - Badge vermelho para OS abertas (nao atendidas)
 * - Badge cinza quando todas estao em andamento
 * - Esconde o widget quando nao ha OS ativas
 */
export function SuporteBadge({ abertas, emAndamento, onClick }: SuporteBadgeProps) {
  const total = abertas + emAndamento;

  // Nao exibe o widget se nao ha OS ativas
  if (total === 0) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative"
      onClick={onClick}
      title={
        abertas > 0
          ? `${abertas} OS aberta${abertas > 1 ? "s" : ""} aguardando atendimento`
          : `${emAndamento} OS em andamento`
      }
    >
      <Headset className="h-5 w-5" />
      <Badge
        variant={abertas > 0 ? "destructive" : "secondary"}
        className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
      >
        {total}
      </Badge>
    </Button>
  );
}
