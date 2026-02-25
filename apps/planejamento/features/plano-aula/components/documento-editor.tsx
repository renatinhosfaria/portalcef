"use client";

import { DocumentEditor } from "@onlyoffice/document-editor-react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@essencia/ui/components/dialog";

interface DocumentoEditorProps {
  planoId: string;
  documentoId: string;
  mode: "edit" | "view";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditorConfigResponse {
  documentServerUrl: string;
  config: Record<string, unknown>;
}

export function DocumentoEditorModal({
  planoId,
  documentoId,
  mode,
  open,
  onOpenChange,
}: DocumentoEditorProps) {
  const [editorConfig, setEditorConfig] =
    useState<EditorConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditorConfig(null);
      setError(null);
      return;
    }

    const fetchConfig = async () => {
      try {
        const res = await fetch(
          `/api/plano-aula/${planoId}/documentos/${documentoId}/editor-config?mode=${mode}`,
          { credentials: "include" },
        );
        if (!res.ok) throw new Error("Falha ao carregar configuração do editor");
        const json = await res.json();
        setEditorConfig(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      }
    };

    fetchConfig();
  }, [open, planoId, documentoId, mode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[100vw] w-screen h-screen max-h-screen p-0 gap-0"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {mode === "edit" ? "Editar" : "Visualizar"} documento
        </DialogTitle>
        {error && (
          <div className="flex items-center justify-center h-full text-destructive">
            {error}
          </div>
        )}
        {!editorConfig && !error && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Carregando editor...
          </div>
        )}
        {editorConfig && (
          <div className="w-full h-full">
            <DocumentEditor
              id={`editor-${documentoId}`}
              documentServerUrl={editorConfig.documentServerUrl}
              config={editorConfig.config}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
