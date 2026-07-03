"use client";

/**
 * DocumentoUpload Component
 * Componente de upload múltiplo de arquivos e links do YouTube para planos de aula
 * Suporta fila de uploads com progresso individual e retentativas automáticas
 */

import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { cn } from "@essencia/ui/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Link,
  Loader2,
  RotateCcw,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { obterMensagemErro } from "../../../lib/mensagens-erro";
import {
  enviarEventosPendentes,
  registrarEventoObservabilidade,
} from "../../../lib/observabilidade";
import type { PlanoDocumento } from "../types";

type FileUploadStatus = "pendente" | "enviando" | "sucesso" | "erro";

interface FileUploadItem {
  id: string;
  file: File;
  status: FileUploadStatus;
  tentativas: number;
  erro?: string;
}

interface DocumentoUploadProps {
  onUpload: (file: File) => Promise<PlanoDocumento>;
  onAddLink: (url: string) => void | Promise<void>;
  onAllUploadsComplete?: () => void;
  disabled?: boolean;
}

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg";
const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_UPLOADS_SIMULTANEOS = 3;
const MAX_TENTATIVAS = 5;
const TEMPO_REMOVER_SUCESSO = 2000;

function gerarId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function validateFile(file: File): string | null {
  const acceptedTypes = Object.keys(ACCEPTED_FILE_TYPES);
  if (!acceptedTypes.includes(file.type)) {
    return "Esse arquivo não é aceito. Envie PDF, Word, Excel, PNG ou JPG.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return `O arquivo é muito grande. Envie um arquivo de até ${MAX_FILE_SIZE_MB} MB.`;
  }
  return null;
}

function criarMetadadosArquivo(file: File) {
  return {
    nome: file.name || null,
    tipo: file.type || null,
    tamanhoBytes: file.size || null,
  };
}

function criarMetadadosLinkYouTube() {
  return {
    nome: "link_youtube",
    tipo: "youtube",
    tamanhoBytes: null,
  };
}

function obterMensagemObservabilidade(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido";
}

function obterStatusErroUpload(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;

  const valor = error as { status?: unknown; statusCode?: unknown };
  const status = valor.status ?? valor.statusCode;

  if (typeof status === "number" && Number.isFinite(status)) return status;
  if (typeof status === "string" && status.trim()) {
    const numero = Number(status);
    return Number.isFinite(numero) ? numero : null;
  }

  return null;
}

function mensagemIndicaErroDefinitivo(mensagem: string): boolean {
  return /arquivo é muito grande|arquivo não é aceito|não é aceito|permissão|sessão expirou|revise as informações|não encontramos esse item|muitas tentativas/i.test(
    mensagem,
  );
}

function deveTentarUploadNovamente(error: unknown, mensagem: string): boolean {
  const status = obterStatusErroUpload(error);

  if (status !== null && status >= 400 && status < 500) {
    return false;
  }

  return !mensagemIndicaErroDefinitivo(mensagem);
}

function enviarObservabilidadeBestEffort() {
  void enviarEventosPendentes().catch(() => undefined);
}

/** Truncar nome do arquivo para exibição */
function truncarNome(nome: string, maxLength = 30): string {
  if (nome.length <= maxLength) return nome;
  const dotIndex = nome.lastIndexOf(".");
  const extensao = dotIndex !== -1 ? nome.slice(dotIndex) : "";
  const nomeBase = dotIndex !== -1 ? nome.slice(0, dotIndex) : nome;
  const maxBase = Math.max(1, maxLength - extensao.length - 3);
  return `${nomeBase.slice(0, maxBase)}...${extensao}`;
}

export function DocumentoUpload({
  onUpload,
  onAddLink,
  onAllUploadsComplete,
  disabled = false,
}: DocumentoUploadProps) {
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Ref para rastrear itens que já estão sendo processados (evita re-processamento)
  const processandoRef = useRef<Set<string>>(new Set());

  const isUploading = uploadQueue.some(
    (i) => i.status === "enviando" || i.status === "pendente",
  );

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex =
      /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]+/;
    return youtubeRegex.test(url);
  };

  const adicionarArquivosNaFila = useCallback((files: File[]) => {
    setError(null);
    const novosItens: FileUploadItem[] = [];
    const errosValidacao: string[] = [];

    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        errosValidacao.push(`${file.name}: ${validationError}`);
        registrarEventoObservabilidade({
          evento: "upload_resultado",
          nivel: "warn",
          arquivo: criarMetadadosArquivo(file),
          erro: {
            mensagem: validationError,
          },
          detalhes: {
            status: "erro_validacao",
            tipo: "arquivo",
          },
        });
        enviarObservabilidadeBestEffort();
      } else {
        novosItens.push({
          id: gerarId(),
          file,
          status: "pendente",
          tentativas: 0,
        });
      }
    }

    if (errosValidacao.length > 0) {
      setError(errosValidacao.join("\n"));
    }

    if (novosItens.length > 0) {
      setUploadQueue((prev) => [...prev, ...novosItens]);
    }
  }, []);

  const processarUpload = useCallback(
    async (item: FileUploadItem) => {
      const inicio = typeof performance !== "undefined" ? performance.now() : 0;
      const tentativaAtual = item.tentativas + 1;

      // Marcar como enviando
      setUploadQueue((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "enviando" as const } : i,
        ),
      );

      try {
        await onUpload(item.file);
        registrarEventoObservabilidade({
          evento: "upload_resultado",
          nivel: "info",
          arquivo: criarMetadadosArquivo(item.file),
          detalhes: {
            duracaoMs:
              typeof performance !== "undefined"
                ? Math.round(performance.now() - inicio)
                : undefined,
            status: "sucesso",
            tentativa: tentativaAtual,
            tipo: "arquivo",
          },
        });
        enviarObservabilidadeBestEffort();

        // Marcar como sucesso
        setUploadQueue((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "sucesso" as const } : i,
          ),
        );

        // Remover item de sucesso após delay
        setTimeout(() => {
          setUploadQueue((prev) => prev.filter((i) => i.id !== item.id));
        }, TEMPO_REMOVER_SUCESSO);
      } catch (err) {
        const novaTentativa = tentativaAtual;
        const mensagemErro = obterMensagemErro(
          err,
          "Não foi possível enviar o arquivo. Verifique sua conexão e tente novamente.",
        );

        if (
          novaTentativa < MAX_TENTATIVAS &&
          deveTentarUploadNovamente(err, mensagemErro)
        ) {
          // Recolocar como pendente para nova tentativa
          setUploadQueue((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: "pendente" as const,
                    tentativas: novaTentativa,
                  }
                : i,
            ),
          );
        } else {
          registrarEventoObservabilidade({
            evento: "upload_resultado",
            nivel: "error",
            arquivo: criarMetadadosArquivo(item.file),
            erro: {
              mensagem: obterMensagemObservabilidade(err),
            },
            detalhes: {
              duracaoMs:
                typeof performance !== "undefined"
                  ? Math.round(performance.now() - inicio)
                  : undefined,
              status: "erro",
              tentativa: novaTentativa,
              tipo: "arquivo",
            },
          });
          enviarObservabilidadeBestEffort();
          // Marcar como erro definitivo
          setUploadQueue((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: "erro" as const,
                    tentativas: novaTentativa,
                    erro: mensagemErro,
                  }
                : i,
            ),
          );
        }
      } finally {
        processandoRef.current.delete(item.id);
      }
    },
    [onUpload],
  );

  // Processar fila de uploads
  useEffect(() => {
    const enviando = uploadQueue.filter((i) => i.status === "enviando").length;
    const pendentes = uploadQueue.filter((i) => i.status === "pendente");

    const vagasDisponiveis = MAX_UPLOADS_SIMULTANEOS - enviando;

    const proximosParaProcessar = pendentes.slice(0, vagasDisponiveis);
    for (const item of proximosParaProcessar) {
      // Evitar processar o mesmo item duas vezes
      if (!processandoRef.current.has(item.id)) {
        processandoRef.current.add(item.id);
        processarUpload(item);
      }
    }
  }, [uploadQueue, processarUpload]);

  // Chamar onAllUploadsComplete quando todos finalizarem e pelo menos um teve sucesso
  useEffect(() => {
    if (uploadQueue.length === 0) return;

    const todosFinalizados = uploadQueue.every(
      (i) => i.status === "sucesso" || i.status === "erro",
    );
    const algumSucesso = uploadQueue.some((i) => i.status === "sucesso");

    if (todosFinalizados && algumSucesso && onAllUploadsComplete) {
      onAllUploadsComplete();
    }
  }, [uploadQueue, onAllUploadsComplete]);

  const handleRetry = useCallback((itemId: string) => {
    processandoRef.current.delete(itemId);
    setUploadQueue((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, status: "pendente" as const, tentativas: 0, erro: undefined }
          : i,
      ),
    );
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      adicionarArquivosNaFila(Array.from(files));
    }
    // Reset input para permitir selecionar o mesmo arquivo novamente
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      adicionarArquivosNaFila(Array.from(files));
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) {
      setError("Insira uma URL do YouTube.");
      registrarEventoObservabilidade({
        evento: "upload_resultado",
        nivel: "warn",
        arquivo: criarMetadadosLinkYouTube(),
        erro: {
          mensagem: "Insira uma URL do YouTube.",
        },
        detalhes: {
          status: "erro_validacao",
          tipo: "link_youtube",
        },
      });
      enviarObservabilidadeBestEffort();
      return;
    }

    if (!validateYouTubeUrl(linkUrl)) {
      setError("Cole um link válido do YouTube.");
      registrarEventoObservabilidade({
        evento: "upload_resultado",
        nivel: "warn",
        arquivo: criarMetadadosLinkYouTube(),
        erro: {
          mensagem: "Cole um link válido do YouTube.",
        },
        detalhes: {
          status: "erro_validacao",
          tipo: "link_youtube",
        },
      });
      enviarObservabilidadeBestEffort();
      return;
    }

    setIsAddingLink(true);
    setError(null);

    try {
      await onAddLink(linkUrl.trim());
      registrarEventoObservabilidade({
        evento: "upload_resultado",
        nivel: "info",
        arquivo: criarMetadadosLinkYouTube(),
        detalhes: {
          status: "sucesso",
          tipo: "link_youtube",
        },
      });
      enviarObservabilidadeBestEffort();
      setLinkUrl("");
      setShowLinkInput(false);
    } catch (err) {
      console.error("Erro ao adicionar link:", err);
      registrarEventoObservabilidade({
        evento: "upload_resultado",
        nivel: "error",
        arquivo: criarMetadadosLinkYouTube(),
        erro: {
          mensagem: "Nao foi possivel adicionar link do YouTube",
        },
        detalhes: {
          status: "erro",
          tipo: "link_youtube",
        },
      });
      enviarObservabilidadeBestEffort();
      setError(
        obterMensagemErro(
          err,
          "Não foi possível adicionar o link. Verifique o endereço e tente novamente.",
        ),
      );
    } finally {
      setIsAddingLink(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          disabled && "pointer-events-none opacity-60",
          !disabled && "cursor-pointer",
        )}
      >
        <input
          type="file"
          multiple
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={handleFileChange}
          disabled={disabled}
          accept={ACCEPTED_EXTENSIONS}
        />

        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full mb-4 transition-colors",
            isDragging ? "bg-primary/10" : "bg-muted",
          )}
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <UploadCloud
              className={cn(
                "h-6 w-6 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground",
              )}
            />
          )}
        </div>

        <p className="text-sm font-medium text-center">
          {isDragging
            ? "Solte os arquivos aqui"
            : isUploading
              ? "Enviando..."
              : "Arraste arquivos ou clique para selecionar"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (max. 500MB)
        </p>
      </div>

      {/* Lista de progresso dos uploads */}
      {uploadQueue.length > 0 && (
        <div className="space-y-2">
          {uploadQueue.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                item.status === "enviando" && "bg-blue-50 text-blue-700",
                item.status === "sucesso" && "bg-green-50 text-green-700",
                item.status === "pendente" && "bg-muted",
                item.status === "erro" && "bg-destructive/10 text-destructive",
              )}
            >
              {/* Ícone de status */}
              {item.status === "enviando" && (
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
              )}
              {item.status === "sucesso" && (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              )}
              {item.status === "pendente" && (
                <Upload className="h-4 w-4 flex-shrink-0" />
              )}
              {item.status === "erro" && (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              )}

              {/* Nome do arquivo */}
              <span className="flex-1 truncate" title={item.file.name}>
                {truncarNome(item.file.name)}
              </span>

              {/* Texto de status */}
              <span className="text-xs flex-shrink-0">
                {item.status === "enviando" && "Enviando..."}
                {item.status === "sucesso" && "Enviado"}
                {item.status === "pendente" && "Aguardando"}
                {item.status === "erro" && (item.erro || "Erro")}
              </span>

              {/* Botão de retentativa para itens com erro de upload (não validação) */}
              {item.status === "erro" && item.tentativas > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-destructive hover:text-destructive"
                  onClick={() => handleRetry(item.id)}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.accept = ACCEPTED_EXTENSIONS;
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files && files.length > 0) {
                adicionarArquivosNaFila(Array.from(files));
              }
            };
            input.click();
          }}
        >
          <Upload className="mr-2 h-4 w-4" />
          Enviar Arquivo
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setShowLinkInput(!showLinkInput)}
        >
          <Link className="mr-2 h-4 w-4" />
          Link do YouTube
        </Button>
      </div>

      {/* YouTube Link Input */}
      {showLinkInput && (
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            disabled={isAddingLink || disabled}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddLink();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddLink}
            disabled={isAddingLink || disabled || !linkUrl.trim()}
          >
            {isAddingLink ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Adicionar"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl("");
              setError(null);
            }}
            disabled={isAddingLink}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-destructive hover:text-destructive"
            onClick={() => setError(null)}
          >
            Fechar
          </Button>
        </div>
      )}
    </div>
  );
}
