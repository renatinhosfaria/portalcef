"use client";

/**
 * Home Page - Hub de Navegacao
 * Exibe dois cards: Planos de Aula e Provas
 * Cada card direciona para a area correta conforme o role do usuario
 */

import { useTenant } from "@essencia/shared/providers/tenant";
import {
  Card,
  CardContent,
} from "@essencia/ui/components/card";
import { ClipboardCheck, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

import { getDashboardForRole } from "../lib/role-groups";

/**
 * Retorna a URL de destino para Planos de Aula conforme o tipo de dashboard
 */
function getPlanoUrl(dashboardType: string): string {
  switch (dashboardType) {
    case "professora":
      return "/planejamentos/turmas";
    case "analise":
      return "/analise";
    case "gestao":
      return "/gestao";
    default:
      return "/planejamentos/turmas";
  }
}

/**
 * Retorna a URL de destino para Provas conforme o tipo de dashboard
 */
function getProvaUrl(dashboardType: string): string {
  switch (dashboardType) {
    case "professora":
      return "/provas/turmas";
    case "analise":
      return "/provas/analise";
    case "gestao":
      return "/provas/gestao";
    default:
      return "/provas/turmas";
  }
}

export default function HomePage() {
  const { role, isLoaded } = useTenant();
  const router = useRouter();

  // Loading state
  if (!isLoaded) {
    return <LoadingSkeleton />;
  }

  const dashboardType = getDashboardForRole(role);

  // Sem acesso -> portal principal
  if (dashboardType === "no-access" || dashboardType === "unknown") {
    return <AccessDenied role={role} />;
  }

  const planoUrl = getPlanoUrl(dashboardType);
  const provaUrl = getProvaUrl(dashboardType);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Planejamento Pedagógico
        </h1>
        <p className="mt-2 text-muted-foreground">
          Selecione o módulo que deseja acessar
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Card Planos de Aula */}
        <Card
          className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:scale-[1.02]"
          onClick={() => {
            if (dashboardType === "professora") {
              window.location.href = `/planejamento${planoUrl}`;
            } else {
              router.push(planoUrl);
            }
          }}
        >
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <div className="rounded-xl bg-primary/10 p-4">
              <FileText className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold">Planos de Aula</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gerencie os planos de aula quinzenais
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card Provas */}
        <Card
          className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:scale-[1.02]"
          onClick={() => {
            if (dashboardType === "professora") {
              window.location.href = `/planejamento${provaUrl}`;
            } else {
              router.push(provaUrl);
            }
          }}
        >
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <div className="rounded-xl bg-primary/10 p-4">
              <ClipboardCheck className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold">Provas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gerencie as provas por ciclo avaliativo
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function AccessDenied({ role }: { role: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
      <h1 className="text-2xl font-bold">Acesso Nao Autorizado</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Seu perfil ({role || "desconhecido"}) nao tem permissao para acessar o
        modulo de Planejamento.
      </p>
      <p className="text-sm text-muted-foreground">
        Entre em contato com a administracao se acredita que isso e um erro.
      </p>
    </div>
  );
}
