/**
 * Página da Professora - Detalhe da Quinzena para Plano de Aula
 * Task 4.1: Criar página onde a professora gerencia seu plano de aula
 */

import {
  formatQuinzenaDateRange,
  getQuinzenaById,
} from "@essencia/shared/config/quinzenas";
import { serverApi } from "@essencia/shared/fetchers/server";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import { PlanoContent } from "./plano-content";

interface PageProps {
  params: Promise<{
    quinzenaId: string;
  }>;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
}

// serverFetch já desempacota o ApiResponse, então recebemos o data diretamente
interface UserApiData {
  user: UserData;
}

interface Turma {
  id: string;
  name: string;
  code: string;
  stageId: string;
}

interface Stage {
  id: string;
  name: string;
  code: string;
}

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  const storedCookies = cookieStore.getAll();
  return storedCookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function getCurrentUser(cookieHeader: string): Promise<UserData | null> {
  try {
    // serverFetch já desempacota o ApiResponse, então response é { user: UserData }
    const response = await serverApi.get<UserApiData>("/api/auth/me", {
      cookies: cookieHeader,
    });

    if (response?.user) {
      return response.user;
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar usuario:", error);
    return null;
  }
}

async function getUserTurmas(cookieHeader: string): Promise<Turma[]> {
  try {
    const response = await serverApi.get<Turma[]>("/api/plannings/turmas", {
      cookies: cookieHeader,
    });

    if (Array.isArray(response)) {
      return response;
    }
    return [];
  } catch (error) {
    console.error("Erro ao buscar turmas:", error);
    return [];
  }
}

async function getStages(cookieHeader: string): Promise<Stage[]> {
  try {
    const response = await serverApi.get<Stage[]>("/api/stages", {
      cookies: cookieHeader,
    });

    if (Array.isArray(response)) {
      return response;
    }
    return [];
  } catch (error) {
    console.error("Erro ao buscar etapas:", error);
    return [];
  }
}

export default async function PlanoAulaPage({ params }: PageProps) {
  const { quinzenaId } = await params;

  // Buscar configuracao da quinzena
  const quinzenaConfig = getQuinzenaById(quinzenaId);

  // Buscar dados do usuario logado e suas turmas
  const cookieHeader = await getCookieHeader();
  const [currentUser, userTurmas, stages] = await Promise.all([
    getCurrentUser(cookieHeader),
    getUserTurmas(cookieHeader),
    getStages(cookieHeader),
  ]);

  // Determinar turma e etapa do usuario
  const primaryTurma = userTurmas.length > 0 ? userTurmas[0] : null;
  const userStage =
    stages.find((s) => s.id === currentUser?.stageId) ||
    (primaryTurma ? stages.find((s) => s.id === primaryTurma.stageId) : null);

  // Formatar nome da turma para exibicao
  const turmaDisplay = primaryTurma
    ? primaryTurma.name
    : "Nenhuma turma atribuida";
  const stageDisplay = userStage ? userStage.name : "Etapa nao definida";

  // Formatar periodo da quinzena
  const periodoDisplay = quinzenaConfig
    ? formatQuinzenaDateRange(quinzenaConfig)
    : "Periodo nao encontrado";

  // Formatar deadline
  const deadlineDisplay = quinzenaConfig
    ? new Date(quinzenaConfig.deadline + "T12:00:00").toLocaleDateString(
        "pt-BR",
        {
          day: "2-digit",
          month: "long",
          year: "numeric",
        },
      )
    : null;

  // Validar se quinzena existe
  if (!quinzenaConfig) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/planejamentos"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Painel
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Quinzena nao encontrada</h1>
          <p className="text-muted-foreground">
            A quinzena solicitada ({quinzenaId}) nao foi encontrada no
            calendario escolar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/planejamentos"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Painel
        </Link>
      </div>

      {/* Header Info */}
      <div className="mb-8 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {quinzenaConfig.label}
                </h1>
                <p className="text-sm text-muted-foreground">{periodoDisplay}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              {currentUser?.name && (
                <p>
                  Professora:{" "}
                  <span className="font-medium text-foreground">
                    {currentUser.name}
                  </span>
                </p>
              )}
              <p>
                Turma:{" "}
                <span className="font-medium text-foreground">
                  {turmaDisplay}
                </span>
              </p>
              <p>
                Etapa:{" "}
                <span className="font-medium text-foreground">
                  {stageDisplay}
                </span>
              </p>
            </div>
          </div>

          {/* Deadline Badge */}
          {deadlineDisplay && (
            <div className="flex flex-col gap-2 text-sm">
              <div className="rounded-md bg-muted px-4 py-2">
                <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Clock className="mr-1 inline h-3 w-3" />
                  Prazo de Entrega
                </span>
                <span className="font-medium text-foreground">
                  {deadlineDisplay}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Plano Content - Client Component */}
      <PlanoContent
        quinzenaId={quinzenaId}
        turmaId={primaryTurma?.id ?? null}
        userId={currentUser?.id ?? null}
      />
    </div>
  );
}
