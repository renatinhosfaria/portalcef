"use client";

/**
 * Home Page - RBAC Router
 * Routes users to the appropriate dashboard based on their role
 */

import { useTenant } from "@essencia/shared/providers/tenant";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getDashboardForRole } from "../lib/role-groups";

export default function HomePage() {
  const { role, isLoaded } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const dashboardType = getDashboardForRole(role);

    // Professoras e auxiliares -> /planejamentos
    if (dashboardType === "professora") {
      window.location.href = "/planejamento/planejamentos";
      return;
    }

    // Analista -> /analise
    if (dashboardType === "analise") {
      router.replace("/analise");
      return;
    }

    // Gestao (diretora, master, gerentes, coordenadoras) -> /gestao
    if (dashboardType === "gestao") {
      router.replace("/gestao");
      return;
    }

    // Sem acesso -> portal principal
    if (dashboardType === "no-access") {
      const homeUrl =
        typeof window !== "undefined" &&
        window.location.hostname === "localhost"
          ? "https://www.portalcef.com.br/"
          : "/";
      window.location.href = homeUrl;
      return;
    }
  }, [role, isLoaded, router]);

  // Loading state
  if (!isLoaded) {
    return <LoadingSkeleton />;
  }

  const dashboardType = getDashboardForRole(role);

  // Show loading while redirecting
  if (
    dashboardType === "professora" ||
    dashboardType === "analise" ||
    dashboardType === "gestao" ||
    dashboardType === "no-access"
  ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  // Unknown role - Access denied
  return <AccessDenied role={role} />;
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
