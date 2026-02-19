"use client";

/**
 * DocumentoUpload Component
 * Componente de upload de arquivos e links do YouTube para planos de aula
 * Task 3.2: Criar componentes de upload e lista de documentos
 */

import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { cn } from "@essencia/ui/lib/utils";
import {
  AlertCircle,
  Link,
  Loader2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";

interface DocumentoUploadProps {
  onUpload: (file: File) => void | Promise<void>;
  onAddLink: (url: string) => void | Promise<void>;
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
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentoUpload({
  onUpload,
  onAddLink,
  disabled = false,
}: DocumentoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [isAddingLink, setIsAddingLink] = useState(false);

  const validateFile = (file: File): string | null => {
    // Validar tipo
    const acceptedTypes = Object.keys(ACCEPTED_FILE_TYPES);
    if (!acceptedTypes.includes(file.type)) {
      return "Tipo de arquivo nao permitido. Use PDF, DOC, DOCX, XLS, XLSX, PNG ou JPG.";
    }

    // Validar tamanho
    if (file.size > MAX_FILE_SIZE) {
      return "Arquivo muito grande. Tamanho maximo: 10MB.";
    }

    return null;
  };

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex =
      /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]+/;
    return youtubeRegex.test(url);
  };

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        await onUpload(file);
      } catch (err) {
        console.error("Upload failed:", err);
        setError("Erro ao enviar arquivo. Tente novamente.");
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
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

    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) {
      setError("Insira uma URL do YouTube.");
      return;
    }

    if (!validateYouTubeUrl(linkUrl)) {
      setError("URL invalida. Insira uma URL valida do YouTube.");
      return;
    }

    setIsAddingLink(true);
    setError(null);

    try {
      await onAddLink(linkUrl.trim());
      setLinkUrl("");
      setShowLinkInput(false);
    } catch (err) {
      console.error("Erro ao adicionar link:", err);
      setError("Erro ao adicionar link. Tente novamente.");
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
          (isUploading || disabled) && "pointer-events-none opacity-60",
          !disabled && "cursor-pointer",
        )}
      >
        <input
          type="file"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={handleFileChange}
          disabled={isUploading || disabled}
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
            ? "Solte o arquivo aqui"
            : isUploading
              ? "Enviando..."
              : "Arraste um arquivo ou clique para selecionar"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (max. 10MB)
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isUploading}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ACCEPTED_EXTENSIONS;
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) uploadFile(file);
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
