/**
 * SegmentFilter Component
 * Filtro de etapa (Todos/Bercario/Infantil/Fundamental I/Fundamental II/Medio)
 * Epic 5 - Story 5.4
 */

"use client";

import { cn } from "@essencia/ui/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

interface SegmentFilterProps {
  className?: string;
}

const segments = [
  { value: "todos", label: "Todos" },
  { value: "bercario", label: "Bercario" },
  { value: "infantil", label: "Infantil" },
  { value: "fundamental_i", label: "Fundamental I" },
  { value: "fundamental_ii", label: "Fundamental II" },
  { value: "medio", label: "Medio" },
] as const;

export function SegmentFilter({ className }: SegmentFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSegment = searchParams.get("segment") || "todos";

  const handleChange = (segment: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (segment === "todos") {
      params.delete("segment");
    } else {
      params.set("segment", segment);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className={cn("flex gap-2 p-1 bg-muted rounded-lg", className)}>
      {segments.map((segment) => (
        <button
          key={segment.value}
          onClick={() => handleChange(segment.value)}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-colors",
            currentSegment === segment.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
