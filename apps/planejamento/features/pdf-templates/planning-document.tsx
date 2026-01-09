/**
 * PlanningDocument Component
 * Template visual do documento de planejamento
 * Epic 3 - Story 3.1: Preview do Documento
 */

import { BookOpen, Lightbulb, Package, Target } from "lucide-react";

import { DocumentHeader } from "./document-header";
import { DocumentSection } from "./document-section";

export interface PlanningDocumentData {
  turma: string;
  quinzena: string;
  objetivos?: string;
  metodologia?: string;
  recursos?: string[];
  professorName?: string;
}

interface PlanningDocumentProps {
  data: PlanningDocumentData;
}

export function PlanningDocument({ data }: PlanningDocumentProps) {
  const { turma, quinzena, objetivos, metodologia, recursos, professorName } =
    data;

  return (
    <div className="min-h-[297mm] w-full bg-white font-sans">
      <DocumentHeader
        professorName={professorName}
        turma={turma}
        quinzena={quinzena}
      />

      {/* Seção: Objetivos de Aprendizagem */}
      <DocumentSection
        title="Objetivos de Aprendizagem"
        icon={<Target className="h-4 w-4" />}
      >
        {objetivos ? (
          <div className="whitespace-pre-wrap">{objetivos}</div>
        ) : (
          <p className="italic text-muted-foreground">
            Nenhum objetivo definido.
          </p>
        )}
      </DocumentSection>

      {/* Seção: Metodologia */}
      <DocumentSection
        title="Metodologia"
        icon={<Lightbulb className="h-4 w-4" />}
      >
        {metodologia ? (
          <div className="whitespace-pre-wrap">{metodologia}</div>
        ) : (
          <p className="italic text-muted-foreground">
            Nenhuma metodologia definida.
          </p>
        )}
      </DocumentSection>

      {/* Seção: Recursos e Atividades */}
      <DocumentSection
        title="Recursos e Atividades"
        icon={<Package className="h-4 w-4" />}
      >
        {recursos && recursos.length > 0 ? (
          <ul className="list-inside list-disc space-y-1">
            {recursos.map((recurso, index) => (
              <li key={index} className="text-foreground/90">
                {recurso}
              </li>
            ))}
          </ul>
        ) : (
          <p className="italic text-muted-foreground">
            Nenhum recurso adicionado.
          </p>
        )}
      </DocumentSection>

      {/* Rodapé com data de geração */}
      <footer className="mt-8 border-t border-border/30 pt-4 text-center text-xs text-muted-foreground">
        <p>Documento gerado pelo Portal CEF - Escola Essência</p>
        <p className="mt-1">
          <BookOpen className="mr-1 inline-block h-3 w-3" />
          Planejamento Pedagógico - {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
