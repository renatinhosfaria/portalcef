/**
 * Pagina da Coordenadora - Revisao de Plano de Aula
 * Task 4.5: Criar pagina onde a coordenadora faz a revisao final
 */

import {
  formatQuinzenaDateRange,
  getQuinzenaById,
} from "@essencia/shared/config/quinzenas-2026";
import { serverApi } from "@essencia/shared/fetchers/server";
import { ArrowLeft, Calendar, CheckCircle2, FileText, User } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import type { PlanoAula } from "../../../features/plano-aula";

import { RevisaoContent } from "./revisao-content";

interface PageProps {
  params: Promise<{
    planoId: string;
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

interface UserResponse {
  success: boolean;
  data?: {
    user: UserData;
  };
  error?: string;
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
    const response = await serverApi.get<UserResponse>("/api/auth/me", {
      cookies: cookieHeader,
    });

    if (response.success && response.data?.user) {
      return response.data.user;
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar usuario:", error);
    return null;
  }
}

async function getPlanoDetalhe(
  planoId: string,
  cookieHeader: string,
): Promise<PlanoAula | null> {
  try {
    const response = await serverApi.get<PlanoAula>(
      `/api/plano-aula/${planoId}`,
      {
        cookies: cookieHeader,
      },
    );
    return response;
  } catch (error) {
    console.error("Erro ao buscar plano:", error);
    return null;
  }
}

export default async function CoordenacaoRevisaoPage({ params }: PageProps) {
  const { planoId } = await params;

  const cookieHeader = await getCookieHeader();
  const [currentUser, plano] = await Promise.all([
    getCurrentUser(cookieHeader),
    getPlanoDetalhe(planoId, cookieHeader),
  ]);

  // Verificar se o plano existe
  if (!plano) {
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
          <FileText className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Plano nao encontrado</h1>
          <p className="text-muted-foreground">
            O plano de aula solicitado nao foi encontrado ou voce nao tem
            permissao para visualiza-lo.
          </p>
        </div>
      </div>
    );
  }

  // Verificar se o plano esta aguardando coordenadora
  const isAguardandoAprovacao = plano.status === "AGUARDANDO_COORDENADORA";

  // Buscar configuracao da quinzena
  const quinzenaConfig = getQuinzenaById(plano.quinzenaId);

  // Formatar periodo da quinzena
  const periodoDisplay = quinzenaConfig
    ? formatQuinzenaDateRange(quinzenaConfig)
    : "Periodo nao encontrado";

  // Formatar data de submissao
  const submissaoDisplay = plano.submittedAt
    ? new Date(plano.submittedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Contar comentarios existentes
  const totalComentarios = plano.documentos.reduce(
    (total, doc) => total + doc.comentarios.length,
    0,
  );

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
              <div className="rounded-lg bg-purple-100 p-2">
                <CheckCircle2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Revisao de Plano de Aula
                </h1>
                <p className="text-sm text-muted-foreground">
                  Aprovacao Final - Coordenadora
                </p>
              </div>
            </div>

            {/* Informacoes do Plano */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* Professora */}
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Professora
                  </span>
                </div>
                <p className="font-medium">{plano.professorName}</p>
              </div>

              {/* Turma */}
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Turma
                  </span>
                </div>
                <p className="font-medium">
                  {plano.turmaName} ({plano.turmaCode})
                </p>
              </div>

              {/* Quinzena */}
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Quinzena
                  </span>
                </div>
                <p className="font-medium">
                  {quinzenaConfig?.label || plano.quinzenaId}
                </p>
                <p className="text-sm text-muted-foreground">{periodoDisplay}</p>
              </div>

              {/* Data de Submissao */}
              {submissaoDisplay && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Enviado em
                  </span>
                  <p className="font-medium">{submissaoDisplay}</p>
                </div>
              )}
            </div>

            {/* Info sobre comentarios da analista */}
            {totalComentarios > 0 && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">{totalComentarios}</span>{" "}
                  comentario{totalComentarios !== 1 && "s"} da Analista
                  Pedagogica nos documentos.
                </p>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="flex flex-col items-end gap-2">
            <div
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                isAguardandoAprovacao
                  ? "bg-purple-100 text-purple-700"
                  : plano.status === "APROVADO"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {isAguardandoAprovacao
                ? "Aguardando Aprovacao"
                : plano.status === "APROVADO"
                  ? "Aprovado"
                  : plano.status}
            </div>
          </div>
        </div>
      </div>

      {/* Revisao Content - Client Component */}
      <RevisaoContent
        planoId={planoId}
        planoInicial={plano}
        currentUserName={currentUser?.name || "Coordenadora"}
        canApprove={isAguardandoAprovacao}
      />
    </div>
  );
}
