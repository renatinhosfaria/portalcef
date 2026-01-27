"use client";

import { isInVacationPeriod } from "@essencia/shared/config/quinzenas";
import { LayoutDashboard, Umbrella, Loader2 } from "lucide-react";
import { useState } from "react";

import {
  QuinzenasGrid,
  useQuinzenas,
  type Quinzena,
  type QuinzenaStatus,
  type DeadlineStatus,
} from "../../features/planejamentos";

/**
 * Tipo do dado retornado pela API /plannings/quinzenas
 */
interface ApiQuinzena {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  deadline: string;
  semester: 1 | 2;
  isCurrent?: boolean;
  schoolDaysCount?: number;
  hasSchoolDays?: boolean;
  unlockedTurmaIds?: string[];
}

/**
 * Converte dados da API para o formato esperado pelo QuinzenasGrid
 *
 * Regra de liberação por aprovação:
 * - Q01 (number === 1): sempre liberada
 * - Q02+ (number > 1): liberada se tem pelo menos uma turma em unlockedTurmaIds
 * - Quinzena passada (now > endDate): completed
 */
function mapApiQuinzenaToGridQuinzena(apiQuinzena: ApiQuinzena): Quinzena {
  const now = new Date();
  const startDate = new Date(apiQuinzena.startDate + "T12:00:00");
  const endDate = new Date(apiQuinzena.endDate + "T12:00:00");
  const deadline = new Date(apiQuinzena.deadline + "T12:00:00");

  // Extrair número da quinzena do ID (ex: "2026-Q01" -> 1)
  const match = apiQuinzena.id.match(/Q(\d+)/);
  const number = match?.[1] ? parseInt(match[1], 10) : 1;

  // Determinar status baseado na aprovação da quinzena anterior
  let status: QuinzenaStatus = "locked";
  if (now > endDate) {
    // Quinzena já passou
    status = "completed";
  } else if (number === 1) {
    // Q01 sempre liberada
    status = "unlocked";
  } else if (
    apiQuinzena.unlockedTurmaIds &&
    apiQuinzena.unlockedTurmaIds.length > 0
  ) {
    // Q02+: liberada se tem turmas com aprovação da quinzena anterior
    status = "unlocked";
  }

  // Calcular deadlineStatus
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let deadlineStatus: DeadlineStatus = "normal";
  if (diffDays < 0) deadlineStatus = "late";
  else if (diffDays <= 1) deadlineStatus = "urgent";
  else if (diffDays <= 3) deadlineStatus = "warning";

  return {
    id: apiQuinzena.id,
    number,
    startDate,
    endDate,
    deadline,
    semester: apiQuinzena.semester,
    status,
    deadlineStatus,
  };
}

export function PlanejamentosContent() {
  const { quinzenas: apiQuinzenas, isLoading, error } = useQuinzenas();
  const isVacation = isInVacationPeriod(new Date());

  // Determina semestre inicial baseado na data atual
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const defaultSemester = currentMonth >= 7 ? 2 : 1;
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(
    defaultSemester as 1 | 2,
  );

  // Mapear dados da API para formato do Grid
  const quinzenas: Quinzena[] = Array.isArray(apiQuinzenas)
    ? (apiQuinzenas as unknown as ApiQuinzena[]).map(
        mapApiQuinzenaToGridQuinzena,
      )
    : [];

  // Filtrar quinzenas por semestre selecionado
  const quinzenasFiltradas = quinzenas.filter(
    (q) => q.semester === selectedSemester,
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Painel de Planejamentos
          </h1>
        </div>
        <p className="text-muted-foreground">
          Acompanhe seus prazos e entregas de planejamentos quinzenais.
        </p>
      </div>

      {/* Banner de Férias */}
      {isVacation && (
        <div className="mb-8 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <Umbrella className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-blue-900">
                Período de Férias Escolares
              </h2>
              <p className="text-sm text-blue-700">
                Aproveite as férias de julho (01/07 - 31/07)! As quinzenas do 2º
                semestre começam em 03/08/2026.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs de Semestre */}
      <div className="mb-6">
        <div className="inline-flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setSelectedSemester(1)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              selectedSemester === 1
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            1º Semestre
          </button>
          <button
            onClick={() => setSelectedSemester(2)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              selectedSemester === 2
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            2º Semestre
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {selectedSemester === 1
            ? "Fevereiro a Junho • 11 quinzenas"
            : "Agosto a Dezembro • 10 quinzenas"}
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">
            Carregando quinzenas...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <p className="font-medium">Erro ao carregar quinzenas</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && quinzenasFiltradas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Nenhuma quinzena disponível para o {selectedSemester}º semestre.
          </p>
        </div>
      )}

      {/* Grid de Quinzenas */}
      {!isLoading && !error && quinzenasFiltradas.length > 0 && (
        <QuinzenasGrid quinzenas={quinzenasFiltradas} />
      )}
    </div>
  );
}
