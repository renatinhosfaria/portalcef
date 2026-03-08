"use client";

import { Button } from "@essencia/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TarefasPaginacaoProps {
  paginaAtual: number;
  totalPaginas: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

function gerarPaginas(atual: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas: (number | "...")[] = [1];

  if (atual > 3) paginas.push("...");

  const inicio = Math.max(2, atual - 1);
  const fim = Math.min(total - 1, atual + 1);

  for (let i = inicio; i <= fim; i++) paginas.push(i);

  if (atual < total - 2) paginas.push("...");
  paginas.push(total);

  return paginas;
}

export function TarefasPaginacao({
  paginaAtual,
  totalPaginas,
  total,
  limit,
  onPageChange,
}: TarefasPaginacaoProps) {
  if (totalPaginas <= 1) return null;

  const inicio = (paginaAtual - 1) * limit + 1;
  const fim = Math.min(paginaAtual * limit, total);
  const paginas = gerarPaginas(paginaAtual, totalPaginas);

  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(paginaAtual - 1)}
          disabled={paginaAtual === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>

        {paginas.map((p, idx) =>
          p === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === paginaAtual ? "default" : "outline"}
              size="sm"
              className="w-8 p-0"
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(paginaAtual + 1)}
          disabled={paginaAtual === totalPaginas}
        >
          Próximo
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Mostrando {inicio}–{fim} de {total} tarefas
      </p>
    </div>
  );
}
