"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
} from "@essencia/ui/components/card";
import type { OrdemServicoEnriquecida } from "@essencia/shared/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OsStatusBadge } from "./os-status-badge";
import { OsCategoriaBadge } from "./os-status-badge";

interface OsCardProps {
  ordem: OrdemServicoEnriquecida;
  isAdmin?: boolean;
}

export function OsCard({ ordem, isAdmin }: OsCardProps) {
  const dataRelativa = formatDistanceToNow(new Date(ordem.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Link href={`/${ordem.id}`} className="block">
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold font-mono text-muted-foreground">
              OS-{ordem.numero}
            </span>
            <OsStatusBadge status={ordem.status} />
          </div>
          <h3 className="text-lg font-semibold truncate">{ordem.titulo}</h3>
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
    </Link>
  );
}
