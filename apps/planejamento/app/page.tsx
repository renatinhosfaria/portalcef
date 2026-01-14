"use client";

/**
 * Home Page - RBAC Router
 * Routes users to the appropriate dashboard based on their role
 */

import { useTenant } from "@essencia/shared/providers/tenant";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { GestaoPanel } from "../features/dashboard";
import { getDashboardForRole } from "../lib/role-groups";

export default function HomePage() {
  const { role, isLoaded } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const dashboardType = getDashboardForRole(role);

    // Creators go to /planejamentos
    if (dashboardType === "professora") {
      // Force hard redirect to avoid routing issues
      window.location.href = "/planejamentos";
      return;
    }

    // Reviewers go to /regencia
    if (dashboardType === "regencia") {
      router.replace("/regencia");
      return;
    }

    // No access roles go to home
    if (dashboardType === "no-access") {
      // Redirect to the main portal
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

  // GRUPO 1: Creators - Redirect handled by useEffect
  if (dashboardType === "professora") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground">
          Redirecionando para o novo painel...
        </p>
      </div>
    );
  }

  // GRUPO 2: Reviewers - Redirect handled by useEffect
  if (dashboardType === "regencia") {
    return <LoadingSkeleton />;
  }

  // GRUPO 3: Managers - Management Dashboard
  if (dashboardType === "gestao") {
    return <GestaoPanel />;
  }

  // GRUPO 4: No access - Redirect handled by useEffect
  if (dashboardType === "no-access") {
    return <LoadingSkeleton />;
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
