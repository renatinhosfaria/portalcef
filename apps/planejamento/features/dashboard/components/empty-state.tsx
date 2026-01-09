/**
 * EmptyState Component
 * Empty state comemorativo quando não há pendências
 * Epic 5 - Story 5.5
 */

"use client";

import { Button } from "@essencia/ui/components/button";
import { CheckCircle2, PartyPopper, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  showRefresh?: boolean;
  onRefresh?: () => void;
}

export function EmptyState({
  title = "Tudo limpo por aqui! 🎉",
  description = "Parabéns! Você zerou as pendências. Todos os planejamentos foram analisados.",
  showRefresh = true,
  onRefresh,
}: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Ícone comemorativo */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <PartyPopper className="absolute -top-2 -right-2 h-8 w-8 text-yellow-500 animate-bounce" />
      </div>

      {/* Mensagem */}
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>

      {/* Ação opcional de refresh */}
      {showRefresh && (
        <Button
          variant="outline"
          onClick={onRefresh ?? (() => window.location.reload())}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      )}
    </section>
  );
}
