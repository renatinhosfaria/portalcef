/**
 * DocumentSection Component
 * Seção reutilizável do documento
 * Epic 3 - Story 3.1: Preview do Documento
 */

import type { ReactNode } from "react";

interface DocumentSectionProps {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}

export function DocumentSection({
  title,
  children,
  icon,
}: DocumentSectionProps) {
  return (
    <section className="mb-6 rounded-lg border border-border/50 bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
        )}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}
