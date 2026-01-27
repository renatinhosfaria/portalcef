'use client';

import { useEffect, useState } from 'react';
import { Button } from '@essencia/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@essencia/ui/components/dialog';
import { Input } from '@essencia/ui/components/input';
import { Label } from '@essencia/ui/components/label';
import { Textarea } from '@essencia/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@essencia/ui/components/select';
import type { EducationStageCode } from '@essencia/shared/types';
import { educationStageLabels } from '@essencia/shared/types';

interface Periodo {
  id: string;
  numero: number;
  etapa: string;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
}

interface PeriodoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodo?: Periodo | null;
  etapas: string[];
  onSubmit: (dto: {
    etapa: string;
    descricao?: string;
    dataInicio: string;
    dataFim: string;
    dataMaximaEntrega: string;
  }) => Promise<void>;
  loading?: boolean;
}

export function PeriodoModal({
  open,
  onOpenChange,
  periodo,
  etapas,
  onSubmit,
  loading = false,
}: PeriodoModalProps) {
  const [etapa, setEtapa] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dataMaximaEntrega, setDataMaximaEntrega] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (periodo) {
      setEtapa(periodo.etapa);
      setDescricao(periodo.descricao || '');
      setDataInicio(periodo.dataInicio.split('T')[0]);
      setDataFim(periodo.dataFim.split('T')[0]);
      setDataMaximaEntrega(periodo.dataMaximaEntrega.split('T')[0]);
    } else {
      setEtapa(etapas[0] || '');
      setDescricao('');
      setDataInicio('');
      setDataFim('');
      setDataMaximaEntrega('');
    }
  }, [periodo, etapas, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        etapa,
        descricao: descricao || undefined,
        dataInicio,
        dataFim,
        dataMaximaEntrega,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar período:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {periodo ? 'Editar Plano de Aula' : 'Novo Plano de Aula'}
          </DialogTitle>
          <DialogDescription>
            {periodo
              ? 'Atualize as informações do plano de aula'
              : 'Configure um novo plano de aula para a etapa'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="etapa">
                Etapa <span className="text-destructive">*</span>
              </Label>
              <Select
                value={etapa}
                onValueChange={setEtapa}
                disabled={!!periodo || loading}
              >
                <SelectTrigger id="etapa">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {etapas.map((e) => (
                    <SelectItem key={e} value={e}>
                      {educationStageLabels[e as EducationStageCode] || e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!!periodo && (
                <p className="text-xs text-muted-foreground">
                  A etapa não pode ser alterada após a criação.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea
                id="descricao"
                placeholder="Ex: Primeiro bimestre, período de adaptação..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={loading || isSubmitting}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dataInicio">
                  Data de Início <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  disabled={loading || isSubmitting}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dataFim">
                  Data de Fim <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  disabled={loading || isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dataMaximaEntrega">
                Prazo de Entrega <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dataMaximaEntrega"
                type="date"
                value={dataMaximaEntrega}
                onChange={(e) => setDataMaximaEntrega(e.target.value)}
                disabled={loading || isSubmitting}
                required
              />
              <p className="text-sm text-muted-foreground">
                Data limite para as professoras enviarem o planejamento
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading || isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || isSubmitting}>
              {isSubmitting ? 'Salvando...' : periodo ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
