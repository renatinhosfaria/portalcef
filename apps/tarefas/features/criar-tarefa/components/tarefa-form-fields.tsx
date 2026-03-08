"use client";

import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import { Textarea } from "@essencia/ui/components/textarea";
import { Button } from "@essencia/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@essencia/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@essencia/ui/components/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@essencia/ui/lib/utils";
import { useState } from "react";
import { useUsuariosBusca } from "../hooks/use-usuarios-busca";

const ROLE_LABELS: Record<string, string> = {
  professora: "Professora",
  auxiliar_sala: "Auxiliar de Sala",
  analista_pedagogico: "Analista Pedagógica",
  coordenadora_bercario: "Coord. Berçário",
  coordenadora_infantil: "Coord. Infantil",
  coordenadora_fundamental_i: "Coord. Fund. I",
  coordenadora_fundamental_ii: "Coord. Fund. II",
  coordenadora_medio: "Coord. Médio",
  coordenadora_geral: "Coord. Geral",
  gerente_unidade: "Gerente de Unidade",
  diretora_geral: "Diretora Geral",
};

export interface TarefaFormData {
  titulo: string;
  descricao: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  prazo: string;
  responsavel: string;
  responsavelNome?: string;
  quinzenaId: string;
}

interface TarefaFormFieldsProps {
  data: TarefaFormData;
  onChange: (field: keyof TarefaFormData, value: string) => void;
  roleAtual: string;
  bloqueadoProfessora?: boolean;
}

export function TarefaFormFields({
  data,
  onChange,
  roleAtual,
  bloqueadoProfessora = false,
}: TarefaFormFieldsProps) {
  const [open, setOpen] = useState(false);
  const { busca, setBusca, usuarios, isLoading } =
    useUsuariosBusca(roleAtual);

  const responsavelSelecionado = usuarios.find(
    (u) => u.id === data.responsavel,
  );

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="titulo">Título *</Label>
        <Input
          id="titulo"
          value={data.titulo}
          onChange={(e) => onChange("titulo", e.target.value)}
          placeholder="Ex: Revisar plano da Turma Infantil II"
          required
        />
      </div>

      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          value={data.descricao}
          onChange={(e) => onChange("descricao", e.target.value)}
          placeholder="Detalhes adicionais sobre a tarefa"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="prioridade">Prioridade *</Label>
        <Select
          value={data.prioridade}
          onValueChange={(v) => onChange("prioridade", v)}
        >
          <SelectTrigger id="prioridade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALTA">Alta</SelectItem>
            <SelectItem value="MEDIA">Média</SelectItem>
            <SelectItem value="BAIXA">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="prazo">Prazo *</Label>
        <Input
          id="prazo"
          type="datetime-local"
          value={data.prazo}
          onChange={(e) => onChange("prazo", e.target.value)}
          required
        />
      </div>

      <div>
        <Label>Responsável *</Label>
        {bloqueadoProfessora ? (
          <Input value={data.responsavelNome ?? "Você"} disabled />
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                {responsavelSelecionado
                  ? `${responsavelSelecionado.nome} — ${ROLE_LABELS[responsavelSelecionado.role] ?? responsavelSelecionado.role}`
                  : data.responsavelNome
                    ? data.responsavelNome
                    : "Buscar responsável..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Digite o nome..."
                  value={busca}
                  onValueChange={setBusca}
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoading ? "Buscando..." : "Nenhum usuário encontrado"}
                  </CommandEmpty>
                  <CommandGroup>
                    {usuarios.map((usuario) => (
                      <CommandItem
                        key={usuario.id}
                        value={usuario.id}
                        onSelect={() => {
                          onChange("responsavel", usuario.id);
                          onChange("responsavelNome", usuario.nome);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            data.responsavel === usuario.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <div>
                          <span className="font-medium">{usuario.nome}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {ROLE_LABELS[usuario.role] ?? usuario.role}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div>
        <Label htmlFor="quinzenaId">ID da Quinzena</Label>
        <Input
          id="quinzenaId"
          value={data.quinzenaId}
          onChange={(e) => onChange("quinzenaId", e.target.value)}
          placeholder="Quinzena (opcional)"
        />
      </div>
    </div>
  );
}
