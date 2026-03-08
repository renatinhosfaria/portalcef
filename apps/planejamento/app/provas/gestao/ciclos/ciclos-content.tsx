"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@essencia/ui/components/tabs";
import { toast } from "@essencia/ui/toaster";
import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";

import { useCiclos } from "../../../../features/prova";
import type { ProvaCiclo } from "../../../../features/prova";
import { CicloModal } from "../../../../features/prova/components/ciclo-modal";
import { CiclosList } from "../../../../features/prova/components/ciclos-list";

const ETAPAS = [
  "BERCARIO",
  "INFANTIL",
  "FUNDAMENTAL_I",
  "FUNDAMENTAL_II",
  "MEDIO",
] as const;

type Etapa = (typeof ETAPAS)[number];

/**
 * Retorna as etapas que a role pode gerenciar
 * - coordenadora_geral: todas as etapas
 * - coordenadora_bercario: apenas BERCARIO
 * - coordenadora_infantil: apenas INFANTIL
 * - coordenadora_fundamental_i: apenas FUNDAMENTAL_I
 * - coordenadora_fundamental_ii: apenas FUNDAMENTAL_II
 * - coordenadora_medio: apenas MEDIO
 * - master, diretora_geral: todas as etapas
 */
function getEtapasPermitidas(role?: string): Etapa[] {
  if (!role) return [];

  // Roles com acesso a todas as etapas
  if (
    role === "master" ||
    role === "diretora_geral" ||
    role === "coordenadora_geral"
  ) {
    return [...ETAPAS];
  }

  // Coordenadoras especificas
  const roleEtapaMap: Record<string, Etapa> = {
    coordenadora_bercario: "BERCARIO",
    coordenadora_infantil: "INFANTIL",
    coordenadora_fundamental_i: "FUNDAMENTAL_I",
    coordenadora_fundamental_ii: "FUNDAMENTAL_II",
    coordenadora_medio: "MEDIO",
  };

  const etapa = roleEtapaMap[role];
  return etapa ? [etapa] : [];
}

export function CiclosContent() {
  const {
    ciclos,
    isLoading,
    error,
    criarCiclo,
    editarCiclo,
    excluirCiclo,
  } = useCiclos();

  const [selectedEtapa, setSelectedEtapa] = useState<Etapa>("BERCARIO");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCiclo, setEditingCiclo] = useState<ProvaCiclo | null>(null);

  // TODO: Pegar role do contexto de autenticacao
  // Por enquanto, assumindo coordenadora_geral para desenvolvimento
  const userRole = "coordenadora_geral";
  const etapasPermitidas = getEtapasPermitidas(userRole);

  const handleEdit = (ciclo: ProvaCiclo) => {
    setEditingCiclo(ciclo);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta prova?")) {
      return;
    }

    try {
      await excluirCiclo(id);
      toast.success("Sucesso", {
        description: "Prova excluida com sucesso",
      });
    } catch {
      toast.error("Erro", {
        description: "Nao foi possivel excluir a prova",
      });
    }
  };

  const handleSubmit = async (dto: {
    etapa: string;
    descricao?: string;
    dataInicio: string;
    dataFim: string;
    dataMaximaEntrega: string;
  }) => {
    try {
      if (editingCiclo) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { etapa, ...updateDto } = dto;
        await editarCiclo(editingCiclo.id, updateDto);
        toast.success("Sucesso", {
          description: "Prova atualizada com sucesso",
        });
      } else {
        await criarCiclo(dto);
        toast.success("Sucesso", {
          description: "Prova criada com sucesso",
        });
      }
      setModalOpen(false);
      setEditingCiclo(null);
    } catch {
      toast.error("Erro", {
        description: "Nao foi possivel salvar a prova",
      });
    }
  };

  if (etapasPermitidas.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Voce nao tem permissao para gerenciar provas
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Erro ao carregar provas</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gestao de Provas</h1>
          <p className="text-muted-foreground mt-2">
            Configure os ciclos de prova para cada etapa
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingCiclo(null);
            setModalOpen(true);
          }}
          disabled={isLoading}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Prova
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs
          defaultValue="BERCARIO"
          value={selectedEtapa}
          onValueChange={(value) => setSelectedEtapa(value as Etapa)}
        >
          <TabsList className="grid w-full grid-cols-5">
            {ETAPAS.map((etapa) => (
              <TabsTrigger
                key={etapa}
                value={etapa}
                disabled={!etapasPermitidas.includes(etapa)}
              >
                {etapa.replace("_", " ")}
              </TabsTrigger>
            ))}
          </TabsList>

          {ETAPAS.map((etapa) => (
            <TabsContent key={etapa} value={etapa} className="mt-6">
              <CiclosList
                ciclos={ciclos}
                etapa={etapa}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <CicloModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setEditingCiclo(null);
          }
        }}
        ciclo={editingCiclo}
        etapas={etapasPermitidas}
        defaultEtapa={selectedEtapa}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
