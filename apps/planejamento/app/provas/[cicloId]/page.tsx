/**
 * Pagina da Professora - Detalhe do Ciclo de Prova
 * Server component que busca dados iniciais e renderiza o ProvaContent
 */

import { serverApi } from "@essencia/shared/fetchers/server";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import { ProvaDetailContent } from "./prova-content";

interface PageProps {
  params: Promise<{
    cicloId: string;
  }>;
  searchParams: Promise<{
    turmaId?: string;
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

interface ProvaCiclo {
  id: string;
  numero: number;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
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

async function getCiclo(
  cicloId: string,
  cookieHeader: string,
): Promise<ProvaCiclo | null> {
  try {
    const response = await serverApi.get<ProvaCiclo>(
      `/api/prova-ciclo/${cicloId}`,
      {
        cookies: cookieHeader,
      },
    );

    return response;
  } catch (error) {
    console.error("Erro ao buscar ciclo:", error);
    return null;
  }
}

export default async function ProvaDetalheServerPage({ params, searchParams }: PageProps) {
  const { cicloId } = await params;
  const { turmaId: turmaIdParam } = await searchParams;

  const cookieHeader = await getCookieHeader();
  const [currentUser, userTurmas, stages, cicloData] = await Promise.all([
    getCurrentUser(cookieHeader),
    getUserTurmas(cookieHeader),
    getStages(cookieHeader),
    getCiclo(cicloId, cookieHeader),
  ]);

  const primaryTurma = turmaIdParam
    ? userTurmas.find((t) => t.id === turmaIdParam) || userTurmas[0] || null
    : userTurmas[0] || null;
  const userStage =
    stages.find((s) => s.id === currentUser?.stageId) ||
    (primaryTurma ? stages.find((s) => s.id === primaryTurma.stageId) : null);

  // URL de volta
  const voltarUrl = userTurmas.length > 1 && primaryTurma
    ? `/provas?turmaId=${primaryTurma.id}`
    : "/provas";

  const turmaDisplay = primaryTurma
    ? primaryTurma.name
    : "Nenhuma turma atribuida";
  const stageDisplay = userStage ? userStage.name : "Etapa nao definida";

  const cicloDisplay = cicloData
    ? `${new Date(cicloData.dataInicio).toLocaleDateString("pt-BR")} - ${new Date(cicloData.dataFim).toLocaleDateString("pt-BR")}`
    : "Ciclo nao encontrado";

  const deadlineDisplay = cicloData
    ? new Date(cicloData.dataMaximaEntrega).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  if (!cicloData) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <Link
            href={voltarUrl}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Painel
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Ciclo nao encontrado</h1>
          <p className="text-muted-foreground">
            O ciclo de prova solicitado nao foi encontrado no sistema.
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
          href={voltarUrl}
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
                  {cicloData.descricao || `${cicloData.numero}a Prova`}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {cicloDisplay}
                </p>
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

      {/* Prova Content - Client Component */}
      <ProvaDetailContent
        cicloId={cicloId}
        turmaId={primaryTurma?.id ?? null}
        userId={currentUser?.id ?? null}
      />
    </div>
  );
}
