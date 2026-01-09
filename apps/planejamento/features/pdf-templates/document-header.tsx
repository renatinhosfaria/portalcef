/**
 * DocumentHeader Component
 * Cabeçalho do documento com logo da escola
 * Epic 3 - Story 3.1: Preview do Documento
 */

import Image from "next/image";

interface DocumentHeaderProps {
  professorName?: string;
  turma: string;
  quinzena: string;
}

export function DocumentHeader({
  professorName,
  turma,
  quinzena,
}: DocumentHeaderProps) {
  // Formata a quinzena para exibição (ex: "2025-Q01" -> "Quinzena 01/2025")
  const formatQuinzena = (q: string) => {
    const match = q.match(/(\d{4})-Q(\d{2})/);
    if (match) {
      return `Quinzena ${match[2]}/${match[1]}`;
    }
    return q;
  };

  return (
    <header className="mb-8 border-b-2 border-primary/20 pb-6">
      {/* Logo e Título */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-primary/10">
            <Image
              src="/logo.svg"
              alt="Logo Escola Essência"
              fill
              className="object-contain p-2"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">Escola Essência</h1>
            <p className="text-sm text-muted-foreground">
              Centro de Educação Fundamental
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold text-foreground">
            Planejamento Quinzenal
          </p>
          <p className="text-sm text-muted-foreground">
            {formatQuinzena(quinzena)}
          </p>
        </div>
      </div>

      {/* Dados do Planejamento */}
      <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
        {professorName && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Professora
            </span>
            <p className="text-sm font-medium text-foreground">
              {professorName}
            </p>
          </div>
        )}
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Turma
          </span>
          <p className="text-sm font-medium text-foreground">{turma}</p>
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Período
          </span>
          <p className="text-sm font-medium text-foreground">
            {formatQuinzena(quinzena)}
          </p>
        </div>
      </div>
    </header>
  );
}
