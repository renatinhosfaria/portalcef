"use client";

import type {
  OrdemServicoStatus,
  OrdemServicoCategoria,
} from "@essencia/shared/types";
import {
  STATUS_LABELS,
  CATEGORIA_LABELS,
} from "@essencia/shared/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";

interface OsFiltrosProps {
  status: OrdemServicoStatus | undefined;
  categoria: OrdemServicoCategoria | undefined;
  onStatusChange: (status: OrdemServicoStatus | undefined) => void;
  onCategoriaChange: (categoria: OrdemServicoCategoria | undefined) => void;
}

const TODOS_STATUS = "TODOS";
const TODAS_CATEGORIAS = "TODAS";

const statusOptions = Object.entries(STATUS_LABELS) as [
  OrdemServicoStatus,
  string,
][];

const categoriaOptions = Object.entries(CATEGORIA_LABELS) as [
  OrdemServicoCategoria,
  string,
][];

export function OsFiltros({
  status,
  categoria,
  onStatusChange,
  onCategoriaChange,
}: OsFiltrosProps) {
  const handleStatusChange = (valor: string) => {
    onStatusChange(
      valor === TODOS_STATUS ? undefined : (valor as OrdemServicoStatus),
    );
  };

  const handleCategoriaChange = (valor: string) => {
    onCategoriaChange(
      valor === TODAS_CATEGORIAS
        ? undefined
        : (valor as OrdemServicoCategoria),
    );
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Select
        value={status ?? TODOS_STATUS}
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Todos os status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS_STATUS}>Todos os status</SelectItem>
          {statusOptions.map(([valor, label]) => (
            <SelectItem key={valor} value={valor}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={categoria ?? TODAS_CATEGORIAS}
        onValueChange={handleCategoriaChange}
      >
        <SelectTrigger className="w-full sm:w-[220px]">
          <SelectValue placeholder="Todas as categorias" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS_CATEGORIAS}>
            Todas as categorias
          </SelectItem>
          {categoriaOptions.map(([valor, label]) => (
            <SelectItem key={valor} value={valor}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
