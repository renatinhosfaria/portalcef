"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import { ClipboardList, Home, List, PlusCircle } from "lucide-react";
import Link from "next/link";

import {
  getDashboardForRole,
  isCreatorRole,
  isManagerRole,
  isReviewerRole,
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

      {/* New Planning - Only for creators (professora, auxiliar_sala) */}
      {isCreatorRole(role) && (
        <Link
          href="/planejamentos/novo"
          className="flex flex-col items-center justify-center gap-1 text-primary hover:text-primary/80 transition-colors"
        >
          <PlusCircle className="h-8 w-8" />
          <span className="text-xs font-medium">Novo</span>
        </Link>
      )}

      {/* Regencia - Only for reviewers (coordenadoras, analista) */}
      {isReviewerRole(role) && (
        <Link
          href="/regencia"
          className="flex flex-col items-center justify-center gap-1 text-primary hover:text-primary/80 transition-colors"
        >
          <ClipboardList className="h-8 w-8" />
          <span className="text-xs font-medium">Regencia</span>
        </Link>
      )}

      {/* List/History - For creators and managers */}
      {(isCreatorRole(role) || isManagerRole(role)) && (
        <Link
          href="/planejamentos"
          className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <List className="h-6 w-6" />
          <span className="text-xs font-medium">Lista</span>
        </Link>
      )}
    </nav>
  );
}
