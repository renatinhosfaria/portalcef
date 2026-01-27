import { Button } from '@essencia/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@essencia/ui/components/card';
import { Badge } from '@essencia/ui/components/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Periodo {
  id: string;
  numero: number;
  etapa: string;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
  planosVinculados?: number;
}

interface PeriodosListProps {
  periodos: Periodo[];
  etapa: string;
  onEdit: (periodo: Periodo) => void;
  onDelete: (id: string) => void;
}

export function PeriodosList({ periodos, etapa, onEdit, onDelete }: PeriodosListProps) {
  const periodosDaEtapa = periodos.filter((p) => p.etapa === etapa);

  if (periodosDaEtapa.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum Plano de Aula configurado para {etapa}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {periodosDaEtapa.map((periodo) => (
        <Card key={periodo.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {periodo.numero}º Plano de Aula
              {periodo.planosVinculados && periodo.planosVinculados > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {periodo.planosVinculados} professoras
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onEdit(periodo)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(periodo.id)}
                disabled={periodo.planosVinculados && periodo.planosVinculados > 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {periodo.descricao && (
              <p className="text-sm text-muted-foreground mb-4">{periodo.descricao}</p>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Período:</span>
                <br />
                {format(new Date(periodo.dataInicio), 'dd/MM/yyyy', { locale: ptBR })} até{' '}
                {format(new Date(periodo.dataFim), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
              <div>
                <span className="font-medium">Prazo de Entrega:</span>
                <br />
                {format(new Date(periodo.dataMaximaEntrega), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
