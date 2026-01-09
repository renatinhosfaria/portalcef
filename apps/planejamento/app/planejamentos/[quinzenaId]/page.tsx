import { serverApi } from "@essencia/shared/fetchers/server";
import { Button } from "@essencia/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@essencia/ui/components/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Calendar, FileText, Plus } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import { generateMockQuinzenas } from "../../../features/planejamentos";

interface PageProps {
  params: Promise<{
    quinzenaId: string;
  }>;
}

interface LessonPlan {
  id: string;
  turma: string;
  quinzena: string;
  status: string;
  materia?: string | null;
  tema?: string | null;
  updatedAt: string;
}

interface ApiResponse {
  success: boolean;
  data?: LessonPlan[];
  error?: string;
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

interface UserResponse {
  success: boolean;
  data?: {
    user: UserData;
  };
  error?: string;
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
    const response = await serverApi.get<UserResponse>("/auth/me", {
      cookies: cookieHeader,
    });

    if (response.success && response.data?.user) {
      return response.data.user;
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return null;
  }
}

async function getUserTurmas(cookieHeader: string): Promise<Turma[]> {
  try {
    const response = await serverApi.get<Turma[]>("/plannings/turmas", {
      cookies: cookieHeader,
    });

    // A API retorna o array diretamente
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
    const response = await serverApi.get<Stage[]>("/stages", {
      cookies: cookieHeader,
    });

    // A API retorna o array diretamente
    if (Array.isArray(response)) {
      return response;
    }
    return [];
  } catch (error) {
    console.error("Erro ao buscar etapas:", error);
    return [];
  }
}

async function getLessonPlans(
  quinzenaId: string,
  cookieHeader: string,
): Promise<LessonPlan[]> {
  try {
    const response = await serverApi.get<ApiResponse>(
      `/plannings/me?quinzena=${encodeURIComponent(quinzenaId)}`,
      { cookies: cookieHeader },
    );

    if (response.success && response.data) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error("Erro ao buscar planos de aula:", error);
    return [];
  }
}

/**
 * Extrai o número da quinzena do ID no formato "2025-Q26" -> 26
 */
function parseQuinzenaNumber(quinzenaId: string): number {
  const match = quinzenaId.match(/Q(\d+)$/);
  if (!match || !match[1]) return 0;
  return parseInt(match[1], 10);
}

/**
 * Gera uma quinzena virtual baseada no ID se não existir na lista mock.
 * Isso permite navegar para quinzenas que existem no banco mas não no mock.
 */
function getOrCreateQuinzena(quinzenaId: string) {
  const quinzenas = generateMockQuinzenas();
  const existing = quinzenas.find((q) => q.id === quinzenaId);

  if (existing) {
    return existing;
  }

  // Se não encontrar, criar uma quinzena virtual
  const number = parseQuinzenaNumber(quinzenaId);

  // Calcular datas aproximadas
  const dayOfYear = (number - 1) * 14 + 1;
  const year = parseInt(quinzenaId.substring(0, 4), 10);
  const startDate = new Date(year, 0, dayOfYear);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 13);
  const deadline = new Date(endDate);

  return {
    id: quinzenaId,
    number,
    startDate,
    endDate,
    deadline,
    status: "unlocked" as const,
    deadlineStatus: "normal" as const,
  };
}

export default async function QuinzenaDetailsPage({ params }: PageProps) {
  const { quinzenaId } = await params;
  const quinzena = getOrCreateQuinzena(quinzenaId);

  // Buscar dados do usuário logado e suas turmas
  const cookieHeader = await getCookieHeader();
  const [currentUser, userTurmas, stages, lessonPlans] = await Promise.all([
    getCurrentUser(cookieHeader),
    getUserTurmas(cookieHeader),
    getStages(cookieHeader),
    getLessonPlans(quinzenaId, cookieHeader),
  ]);

  // Determinar turma e etapa do usuário
  const primaryTurma = userTurmas.length > 0 ? userTurmas[0] : null;
  const userStage =
    stages.find((s) => s.id === currentUser?.stageId) ||
    (primaryTurma ? stages.find((s) => s.id === primaryTurma.stageId) : null);

  // Formatar nome da turma para exibição
  const turmaDisplay = primaryTurma
    ? primaryTurma.name
    : "Nenhuma turma atribuída";
  const stageDisplay = userStage ? userStage.name : "Etapa não definida";

  // Formatar período da quinzena
  const periodoDisplay = `${format(quinzena.startDate, "dd/MM", { locale: ptBR })} a ${format(quinzena.endDate, "dd/MM", { locale: ptBR })}`;

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
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {quinzena.number}ª Quinzena
                </h1>
                <p className="text-sm text-muted-foreground">
                  {periodoDisplay}
                </p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground mt-3">
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

          <div className="flex flex-col gap-2 text-sm">
            <div className="rounded-md bg-muted px-4 py-2">
              <span className="text-muted-foreground block text-xs uppercase tracking-wider font-bold">
                Prazo de Entrega
              </span>
              <span className="font-medium text-foreground">
                {format(quinzena.deadline, "dd 'de' MMMM 'de' yyyy", {
                  locale: ptBR,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Lesson Plans Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">
            Planos de Aula
          </h2>
          <Button asChild>
            <Link href={`/planejamentos/${quinzena.id}/novo`}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Plano de Aula
            </Link>
          </Button>
        </div>

        {lessonPlans.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Nenhum plano criado</h3>
            <p className="mb-4 text-muted-foreground text-sm max-w-[400px]">
              Você ainda não criou nenhum plano de aula para esta quinzena.
              Clique no botão acima para começar.
            </p>
            <Button asChild variant="secondary">
              <Link href={`/planejamentos/${quinzena.id}/novo`}>
                Criar Primeiro Plano
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turma</TableHead>
                  <TableHead>Matéria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualizado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessonPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.turma}</TableCell>
                    <TableCell>{plan.materia || "-"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          plan.status === "APROVADO"
                            ? "bg-green-100 text-green-700"
                            : plan.status === "PENDENTE"
                              ? "bg-yellow-100 text-yellow-700"
                              : plan.status === "EM_AJUSTE"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {plan.status === "RASCUNHO"
                          ? "Rascunho"
                          : plan.status === "PENDENTE"
                            ? "Pendente"
                            : plan.status === "EM_AJUSTE"
                              ? "Em Ajuste"
                              : plan.status === "APROVADO"
                                ? "Aprovado"
                                : plan.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {format(new Date(plan.updatedAt), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/planejamentos/${quinzena.id}/editar/${plan.id}`}
                        >
                          Editar
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
