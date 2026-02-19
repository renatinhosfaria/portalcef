"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import { FileSearch, Home, LayoutDashboard, List } from "lucide-react";
import Link from "next/link";

import {
  getDashboardForRole,
  isAnalystRole,
  isCreatorRole,
  isManagerRole,
} from "../../../lib/role-groups";

export function MobileNav() {
  const { role, isLoaded } = useTenant();

  // Don't render anything while loading or for roles without access
  if (!isLoaded) {
    return null;
  }

  const dashboardType = getDashboardForRole(role);

  // No mobile nav for roles without access
  if (dashboardType === "no-access" || dashboardType === "unknown") {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t bg-background/80 backdrop-blur-lg md:hidden">
      {/* Home - Shows for everyone with access */}
      <Link
        href="/"
        className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
      >
        <Home className="h-6 w-6" />
        <span className="text-xs font-medium">Inicio</span>
      </Link>

      {/* Planejamentos - For creators (professora, auxiliar_sala) */}
      {isCreatorRole(role) && (
        <Link
          href="/planejamentos"
          className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <List className="h-6 w-6" />
          <span className="text-xs font-medium">Quinzenas</span>
        </Link>
      )}

      {/* Analise - For analysts */}
      {isAnalystRole(role) && (
        <Link
          href="/analise"
          className="flex flex-col items-center justify-center gap-1 text-primary hover:text-primary/80 transition-colors"
        >
          <FileSearch className="h-8 w-8" />
          <span className="text-xs font-medium">Analise</span>
        </Link>
      )}

      {/* Gestao - For managers (includes coordenadoras) */}
      {isManagerRole(role) && (
        <Link
          href="/gestao"
          className="flex flex-col items-center justify-center gap-1 text-primary hover:text-primary/80 transition-colors"
        >
          <LayoutDashboard className="h-8 w-8" />
          <span className="text-xs font-medium">Gestao</span>
        </Link>
      )}
    </nav>
  );
}
