"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@essencia/ui/components/collapsible";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

export interface FiltrosAtivos {
  status?: "PENDENTE" | "CONCLUIDA" | "CANCELADA";
  prioridade?: "ALTA" | "MEDIA" | "BAIXA";
  modulo?: "PLANEJAMENTO" | "CALENDARIO" | "USUARIOS" | "TURMAS" | "LOJA";
}

interface TarefasFiltrosProps {
  filtros: FiltrosAtivos;
  onChange: (filtros: FiltrosAtivos) => void;
}

export function TarefasFiltros({ filtros, onChange }: TarefasFiltrosProps) {
  const [aberto, setAberto] = useState(false);

  const quantidadeAtiva = Object.values(filtros).filter(Boolean).length;

  const handleChange = (
    campo: keyof FiltrosAtivos,
    valor: string | undefined,
  ) => {
    onChange({ ...filtros, [campo]: valor || undefined });
  };

  const limpar = () => onChange({});

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filtros{quantidadeAtiva > 0 ? ` (${quantidadeAtiva})` : ""}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-wrap gap-4 pt-4 pb-2 border-t mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">
              Status
            </span>
            <Select
              value={filtros.status ?? ""}
              onValueChange={(v) => handleChange("status", v)}
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">
              Prioridade
            </span>
            <Select
              value={filtros.prioridade ?? ""}
              onValueChange={(v) => handleChange("prioridade", v)}
            >
              <SelectTrigger className="w-36 h-8">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALTA">Alta</SelectItem>
                <SelectItem value="MEDIA">Média</SelectItem>
                <SelectItem value="BAIXA">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">
              Módulo
            </span>
            <Select
              value={filtros.modulo ?? ""}
              onValueChange={(v) => handleChange("modulo", v)}
            >
              <SelectTrigger className="w-44 h-8">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLANEJAMENTO">Planejamento</SelectItem>
                <SelectItem value="CALENDARIO">Calendário</SelectItem>
                <SelectItem value="USUARIOS">Usuários</SelectItem>
                <SelectItem value="TURMAS">Turmas</SelectItem>
                <SelectItem value="LOJA">Loja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {quantidadeAtiva > 0 && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={limpar}>
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
