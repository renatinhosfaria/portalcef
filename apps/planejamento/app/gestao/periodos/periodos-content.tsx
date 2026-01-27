'use client';

import { useState } from 'react';
import { Button } from '@essencia/ui/components/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@essencia/ui/components/tabs';
import { Plus, Loader2 } from 'lucide-react';
import { usePeriodos } from '../../../features/periodos/hooks/use-periodos';
import { PeriodosList } from '../../../features/periodos/components/periodos-list';
import { PeriodoModal } from '../../../features/periodos/components/periodo-modal';
import { useToast } from '@essencia/ui/hooks/use-toast';
import type { Periodo } from '../../../features/periodos/hooks/use-periodos';

const ETAPAS = ['BERCARIO', 'INFANTIL', 'FUNDAMENTAL_I', 'FUNDAMENTAL_II', 'MEDIO'] as const;

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
    role === 'master' ||
    role === 'diretora_geral' ||
    role === 'coordenadora_geral'
  ) {
    return [...ETAPAS];
  }

  // Coordenadoras específicas
  const roleEtapaMap: Record<string, Etapa> = {
    coordenadora_bercario: 'BERCARIO',
    coordenadora_infantil: 'INFANTIL',
    coordenadora_fundamental_i: 'FUNDAMENTAL_I',
    coordenadora_fundamental_ii: 'FUNDAMENTAL_II',
    coordenadora_medio: 'MEDIO',
  };

  const etapa = roleEtapaMap[role];
  return etapa ? [etapa] : [];
}

export function PeriodosContent() {
  const { toast } = useToast();
  const { periodos, isLoading, error, criarPeriodo, editarPeriodo, excluirPeriodo } =
    usePeriodos();

  const [selectedEtapa, setSelectedEtapa] = useState<Etapa>('BERCARIO');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPeriodo, setEditingPeriodo] = useState<Periodo | null>(null);

  // TODO: Pegar role do contexto de autenticação
  // Por enquanto, assumindo coordenadora_geral para desenvolvimento
  const userRole = 'coordenadora_geral';
  const etapasPermitidas = getEtapasPermitidas(userRole);

  const handleEdit = (periodo: Periodo) => {
    setEditingPeriodo(periodo);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano de aula?')) {
      return;
    }

    try {
      await excluirPeriodo(id);
      toast({
        title: 'Sucesso',
        description: 'Plano de aula excluído com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o plano de aula',
        variant: 'destructive',
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
      if (editingPeriodo) {
        await editarPeriodo(editingPeriodo.id, dto);
        toast({
          title: 'Sucesso',
          description: 'Plano de aula atualizado com sucesso',
        });
      } else {
        await criarPeriodo(dto);
        toast({
          title: 'Sucesso',
          description: 'Plano de aula criado com sucesso',
        });
      }
      setModalOpen(false);
      setEditingPeriodo(null);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o plano de aula',
        variant: 'destructive',
      });
      throw error;
    }
  };

  if (etapasPermitidas.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Você não tem permissão para gerenciar planos de aula
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Erro ao carregar planos de aula</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Planos de Aula</h1>
          <p className="text-muted-foreground mt-2">
            Configure os períodos de planejamento para cada etapa
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingPeriodo(null);
            setSelectedEtapa(etapasPermitidas[0]);
            setModalOpen(true);
          }}
          disabled={isLoading}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Plano de Aula
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs
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
                {etapa.replace('_', ' ')}
              </TabsTrigger>
            ))}
          </TabsList>

          {ETAPAS.map((etapa) => (
            <TabsContent key={etapa} value={etapa} className="mt-6">
              <PeriodosList
                periodos={periodos}
                etapa={etapa}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <PeriodoModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setEditingPeriodo(null);
          }
        }}
        periodo={editingPeriodo}
        etapas={etapasPermitidas}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
