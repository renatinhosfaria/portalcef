/**
 * PlanoAulaGrid Component
 * Grid de Planos de Aula separados por semestre
 * Com bloqueio progressivo: 1º plano sempre desbloqueado,
 * demais dependem da aprovação do anterior
 */

"use client";

import { PlanoAulaCard } from "./plano-aula-card";

interface Periodo {
  id: string;
  numero: number;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
}

interface PlanoExistente {
  id: string;
  planoAulaPeriodoId?: string;
  quinzenaId?: string;
  status: string;
}

interface PlanoAulaGridProps {
  periodos: Periodo[];
  planosExistentes?: PlanoExistente[];
  /** Data de início das férias de julho (formato YYYY-MM-DD). Usado para dividir semestres. */
  dataInicioFeriasJulho?: string;
}

/**
 * Determina o semestre baseado na data de início do período
 * A classificação usa a data de início das férias de julho como divisor:
 * - Planos com data de início ANTES das férias de julho = 1º Semestre
 * - Planos com data de início APÓS as férias de julho = 2º Semestre
 *
 * @param dataInicio - Data de início do período
 * @param dataInicioFeriasJulho - Data de início das férias de julho (opcional)
 */
function getSemestre(
  dataInicio: string,
  dataInicioFeriasJulho?: string,
): 1 | 2 {
  const data = new Date(dataInicio);
  const ano = data.getFullYear();

  // Usar data de férias passada ou fallback para 13 de julho
  const inicioFerias = dataInicioFeriasJulho
    ? new Date(dataInicioFeriasJulho)
    : new Date(ano, 6, 13); // 13 de julho como fallback

  return data < inicioFerias ? 1 : 2;
}

/**
 * Verifica se um período está bloqueado baseado na regra:
 * - 1º período de cada semestre: sempre desbloqueado
 * - Demais: bloqueado até que o anterior tenha status APROVADO
 */
function isPeriodoLocked(
  periodo: Periodo,
  periodosOrdenados: Periodo[],
  planosExistentes: PlanoExistente[],
): boolean {
  // Primeiro período do semestre está sempre desbloqueado
  const indexNoSemestre = periodosOrdenados.findIndex(
    (p) => p.id === periodo.id,
  );
  if (indexNoSemestre === 0) {
    return false;
  }

  // Verificar se o período anterior está aprovado
  const periodoAnterior = periodosOrdenados[indexNoSemestre - 1];
  if (!periodoAnterior) {
    return true; // Segurança: se não encontrou anterior, bloqueia
  }

  const planoAnterior = planosExistentes.find(
    (p) =>
      p.planoAulaPeriodoId === periodoAnterior.id ||
      p.quinzenaId === periodoAnterior.id,
  );

  // Se não existe plano anterior ou não está aprovado, bloqueia
  if (!planoAnterior || planoAnterior.status !== "APROVADO") {
    return true;
  }

  return false;
}

export function PlanoAulaGrid({
  periodos,
  planosExistentes = [],
  dataInicioFeriasJulho,
}: PlanoAulaGridProps) {
  // Separar períodos por semestre e ordenar por número
  const primeiroSemestre = periodos
    .filter((p) => getSemestre(p.dataInicio, dataInicioFeriasJulho) === 1)
    .sort((a, b) => a.numero - b.numero);

  const segundoSemestre = periodos
    .filter((p) => getSemestre(p.dataInicio, dataInicioFeriasJulho) === 2)
    .sort((a, b) => a.numero - b.numero);

  // Função para encontrar plano existente de um período
  const getPlanoExistente = (periodoId: string) => {
    return planosExistentes.find(
      (p) => p.planoAulaPeriodoId === periodoId || p.quinzenaId === periodoId,
    );
  };

  return (
    <div className="space-y-8">
      {/* Primeiro Semestre */}
      {primeiroSemestre.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-700 border-b pb-2">
            1º Semestre
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {primeiroSemestre.map((periodo) => (
              <PlanoAulaCard
                key={periodo.id}
                periodo={periodo}
                planoExistente={getPlanoExistente(periodo.id)}
                isLocked={isPeriodoLocked(
                  periodo,
                  primeiroSemestre,
                  planosExistentes,
                )}
              />
            ))}
          </div>
        </section>
      )}

      {/* Segundo Semestre */}
      {segundoSemestre.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-700 border-b pb-2">
            2º Semestre
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {segundoSemestre.map((periodo) => (
              <PlanoAulaCard
                key={periodo.id}
                periodo={periodo}
                planoExistente={getPlanoExistente(periodo.id)}
                isLocked={isPeriodoLocked(
                  periodo,
                  segundoSemestre,
                  planosExistentes,
                )}
              />
            ))}
          </div>
        </section>
      )}

      {/* Mensagem quando não há planos em nenhum semestre */}
      {primeiroSemestre.length === 0 && segundoSemestre.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum Plano de Aula disponível.
        </div>
      )}
    </div>
  );
}
