"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@essencia/ui/components/command";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@essencia/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import { Textarea } from "@essencia/ui/components/textarea";
import { useTenant } from "@essencia/shared/providers/tenant";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useState } from "react";

import { useUsuariosBusca } from "../hooks/use-usuarios-busca";

interface TarefaFormFieldsProps {
  titulo: string;
  descricao: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  prazo: string;
  responsavel: string;
  bloqueadoProfessora?: boolean;
  nomeResponsavelBloqueado?: string;
  onChange: (field: string, value: string) => void;
}

export function TarefaFormFields({
  titulo,
  descricao,
  prioridade,
  prazo,
  responsavel,
  bloqueadoProfessora = false,
  nomeResponsavelBloqueado,
  onChange,
}: TarefaFormFieldsProps) {
  const { role } = useTenant();
  const { busca, setBusca, usuarios, isLoading } = useUsuariosBusca(role);
  const [popoverAberto, setPopoverAberto] = useState(false);

  const usuarioSelecionado = usuarios.find((u) => u.id === responsavel);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="titulo">Titulo *</Label>
        <Input
          id="titulo"
          value={titulo}
          onChange={(e) => onChange("titulo", e.target.value)}
          placeholder="Ex: Revisar plano da Turma Infantil II"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descricao</Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => onChange("descricao", e.target.value)}
          placeholder="Detalhes adicionais sobre a tarefa"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="prioridade">Prioridade *</Label>
        <Select
          value={prioridade}
          onValueChange={(value) => onChange("prioridade", value)}
        >
          <SelectTrigger id="prioridade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALTA">Alta</SelectItem>
            <SelectItem value="MEDIA">Media</SelectItem>
            <SelectItem value="BAIXA">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prazo">Prazo *</Label>
        <Input
          id="prazo"
          type="datetime-local"
          value={prazo}
          onChange={(e) => onChange("prazo", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="responsavel">Responsavel *</Label>
        {bloqueadoProfessora ? (
          <Input
            id="responsavel"
            value={nomeResponsavelBloqueado ?? ""}
            disabled
            className="bg-muted"
          />
        ) : (
          <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={popoverAberto}
                className="w-full justify-between font-normal"
              >
                {usuarioSelecionado
                  ? usuarioSelecionado.nome
                  : "Selecione um responsavel..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Buscar usuario..."
                  value={busca}
                  onValueChange={setBusca}
                />
                <CommandList>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Buscando...
                      </span>
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>Nenhum usuario encontrado.</CommandEmpty>
                      <CommandGroup>
                        {usuarios.map((usuario) => (
                          <CommandItem
                            key={usuario.id}
                            value={usuario.id}
                            onSelect={(valor) => {
                              onChange(
                                "responsavel",
                                valor === responsavel ? "" : valor,
                              );
                              setPopoverAberto(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                responsavel === usuario.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            <div className="flex flex-col">
                              <span>{usuario.nome}</span>
                              <span className="text-xs text-muted-foreground">
                                {usuario.role.replace(/_/g, " ")}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
