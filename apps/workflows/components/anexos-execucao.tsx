"use client";

import type { WorkflowAnexo } from "@essencia/shared/types/workflows";
import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useRef, useState } from "react";

interface AnexosExecucaoProps {
  anexos: WorkflowAnexo[];
  carregando?: boolean;
  onEnviar: (formData: FormData) => void | Promise<void>;
  onRemover: (anexoId: string) => void | Promise<void>;
}

function formatarTamanho(tamanhoBytes: number) {
  if (tamanhoBytes < 1024) return `${tamanhoBytes} B`;
  if (tamanhoBytes < 1024 * 1024) {
    return `${(tamanhoBytes / 1024).toFixed(1)} KB`;
  }

  return `${(tamanhoBytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

export function AnexosExecucao({
  anexos,
  carregando = false,
  onEnviar,
  onRemover,
}: AnexosExecucaoProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function handleArquivoChange(event: ChangeEvent<HTMLInputElement>) {
    setArquivo(event.target.files?.[0] ?? null);
    setErro(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!arquivo) {
      setErro("Escolha um arquivo para anexar.");
      return;
    }

    const formData = new FormData();
    formData.append("file", arquivo);
    await onEnviar(formData);
    setArquivo(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
        onSubmit={handleSubmit}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <label
            htmlFor="anexo-execucao"
            className="text-sm font-medium text-slate-700"
          >
            Novo anexo
          </label>
          <Input
            ref={inputRef}
            id="anexo-execucao"
            type="file"
            onChange={handleArquivoChange}
            disabled={carregando}
          />
          {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
        </div>
        <Button type="submit" disabled={carregando} className="gap-2">
          <Upload className="h-4 w-4" />
          Enviar anexo
        </Button>
      </form>

      {anexos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          Nenhum anexo enviado.
        </div>
      ) : (
        <div className="grid gap-3">
          {anexos.map((anexo) => (
            <div
              key={anexo.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-slate-500" />
                  <a
                    href={anexo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-medium text-slate-900 hover:underline"
                  >
                    {anexo.nomeOriginal}
                  </a>
                </div>
                <p className="text-xs text-slate-500">
                  {formatarTamanho(anexo.tamanhoBytes)} · Enviado por{" "}
                  {anexo.enviadoPorNome ?? "usuário não identificado"} ·{" "}
                  {formatarData(anexo.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={anexo.url} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" />
                    Abrir
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={carregando}
                  onClick={() => void onRemover(anexo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
