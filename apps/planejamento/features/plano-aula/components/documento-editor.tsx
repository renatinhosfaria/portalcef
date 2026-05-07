"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@essencia/ui/components/dialog";
import { useEffect, useRef, useState } from "react";

interface DocumentoViewerProps {
  planoId: string;
  documentoId: string;
  modulo?: "plano-aula" | "prova";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function carregarViaSharePoint(
  modulo: string,
  planoId: string,
  documentoId: string,
): Promise<string | null> {
  const res = await fetch(
    `/api/${modulo}/${planoId}/documentos/${documentoId}/visualizar-sharepoint`,
    { credentials: "include" },
  );

  if (!res.ok) return null;

  const json = await res.json();
  if (!json?.data?.disponivel || !json?.data?.embedUrl) return null;

  return json.data.embedUrl as string;
}

async function renderizarViaDocxPreview(
  modulo: string,
  planoId: string,
  documentoId: string,
): Promise<string> {
  const res = await fetch(
    `/api/${modulo}/${planoId}/documentos/${documentoId}/download`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Falha ao baixar documento");

  const arrayBuffer = await res.arrayBuffer();
  const { renderAsync } = await import("docx-preview");

  const tempContainer = document.createElement("div");
  await renderAsync(arrayBuffer, tempContainer, undefined, {
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: true,
    ignoreFonts: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    experimental: false,
    trimXmlDeclaration: true,
    debug: false,
  });

  const styles = tempContainer.querySelectorAll("style");
  let cssText = "";
  styles.forEach((style) => {
    cssText += style.textContent || "";
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 16px;
      background: #f3f4f6;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    ${cssText}
  </style>
</head>
<body>${tempContainer.innerHTML}</body>
</html>`;
}

export function DocumentoEditorModal({
  planoId,
  documentoId,
  modulo = "plano-aula",
  open,
  onOpenChange,
}: DocumentoViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!open) {
      setError(null);
      setCarregando(false);
      if (iframeRef.current) {
        iframeRef.current.src = "about:blank";
        iframeRef.current.srcdoc = "";
      }
      return;
    }

    const renderizar = async () => {
      try {
        setCarregando(true);
        setError(null);

        // 1. Tentar Office para Web via SharePoint (fidelidade total)
        const embedUrl = await carregarViaSharePoint(
          modulo,
          planoId,
          documentoId,
        ).catch(() => null);

        if (embedUrl && iframeRef.current) {
          iframeRef.current.setAttribute(
            "sandbox",
            "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox",
          );
          iframeRef.current.src = embedUrl;
          return;
        }

        // 2. Fallback: docx-preview (SharePoint não configurado ou indisponível)
        const iframeHtml = await renderizarViaDocxPreview(
          modulo,
          planoId,
          documentoId,
        );
        if (iframeRef.current) {
          iframeRef.current.setAttribute("sandbox", "allow-same-origin");
          iframeRef.current.srcdoc = iframeHtml;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setCarregando(false);
      }
    };

    renderizar();
  }, [open, planoId, documentoId, modulo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[100vw] w-screen h-screen max-h-screen p-0 gap-0 flex flex-col"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Visualizar documento</DialogTitle>
        {error && (
          <div className="flex items-center justify-center h-full text-destructive">
            {error}
          </div>
        )}
        {carregando && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Carregando documento...
          </div>
        )}
        <iframe
          ref={iframeRef}
          className="flex-1 w-full border-0"
          title="Visualizador de documento"
          style={{ display: carregando || error ? "none" : "block" }}
        />
      </DialogContent>
    </Dialog>
  );
}
