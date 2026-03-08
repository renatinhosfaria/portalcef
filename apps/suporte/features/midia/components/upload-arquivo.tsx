"use client";

import { Button } from "@essencia/ui/components/button";
import { cn } from "@essencia/ui/lib/utils";
import {
  File as FileIcon,
  Image as ImageIcon,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface UploadArquivoProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  arquivos: File[];
  onRemove: (index: number) => void;
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImagem(file: File): boolean {
  return file.type.startsWith("image/");
}

export function UploadArquivo({
  onFilesSelected,
  maxFiles = 5,
  maxSizeMB = 100,
  accept = "image/*,video/*,audio/*",
  arquivos,
  onRemove,
}: UploadArquivoProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const gerarPreview = useCallback((file: File): string | null => {
    if (isImagem(file)) {
      return URL.createObjectURL(file);
    }
    return null;
  }, []);

  const validarArquivos = useCallback(
    (files: File[]): string | null => {
      const totalAtual = arquivos.length;
      if (totalAtual + files.length > maxFiles) {
        return `Limite de ${maxFiles} arquivos. Voce ja tem ${totalAtual} arquivo(s).`;
      }

      for (const file of files) {
        if (file.size > maxSizeBytes) {
          return `O arquivo "${file.name}" excede o limite de ${maxSizeMB}MB.`;
        }
      }

      return null;
    },
    [arquivos.length, maxFiles, maxSizeBytes, maxSizeMB],
  );

  const processarArquivos = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const erroValidacao = validarArquivos(files);
      if (erroValidacao) {
        setErro(erroValidacao);
        return;
      }

      setErro(null);

      const novosPreviews = new Map(previews);
      for (const file of files) {
        const preview = gerarPreview(file);
        if (preview) {
          novosPreviews.set(`${file.name}-${file.size}`, preview);
        }
      }
      setPreviews(novosPreviews);

      onFilesSelected(files);
    },
    [validarArquivos, previews, gerarPreview, onFilesSelected],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processarArquivos(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processarArquivos(e.target.files);
    }
    e.target.value = "";
  };

  const handleRemove = (index: number) => {
    const arquivo = arquivos[index];
    if (arquivo) {
      const chave = `${arquivo.name}-${arquivo.size}`;
      const previewUrl = previews.get(chave);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        const novosPreviews = new Map(previews);
        novosPreviews.delete(chave);
        setPreviews(novosPreviews);
      }
    }
    onRemove(index);
  };

  const getPreview = (file: File): string | undefined => {
    return previews.get(`${file.name}-${file.size}`);
  };

  const getIconeArquivo = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    }
    return <FileIcon className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-3">
      {/* Zona de Drag & Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept={accept}
        />

        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full mb-4 transition-colors",
            isDragging ? "bg-primary/10" : "bg-muted",
          )}
        >
          <UploadCloud
            className={cn(
              "h-6 w-6 transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground",
            )}
          />
        </div>

        <p className="text-sm font-medium text-center">
          {isDragging
            ? "Solte os arquivos aqui"
            : "Arraste arquivos ou clique para selecionar"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Maximo {maxFiles} arquivos, ate {maxSizeMB}MB cada
        </p>
      </div>

      {/* Botao de Upload */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        Selecionar Arquivos
      </Button>

      {/* Lista de Arquivos */}
      {arquivos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {arquivos.length} arquivo(s) selecionado(s)
          </p>
          <div className="grid gap-2">
            {arquivos.map((arquivo, index) => {
              const previewUrl = getPreview(arquivo);
              return (
                <div
                  key={`${arquivo.name}-${arquivo.size}-${index}`}
                  className="flex items-center gap-3 rounded-lg border bg-background p-3"
                >
                  {/* Preview ou Icone */}
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={arquivo.name}
                      className="h-10 w-10 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-muted flex-shrink-0">
                      {getIconeArquivo(arquivo)}
                    </div>
                  )}

                  {/* Info do Arquivo */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {arquivo.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatarTamanho(arquivo.size)}
                    </p>
                  </div>

                  {/* Botao Remover */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(index);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mensagem de Erro */}
      {erro && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{erro}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-destructive hover:text-destructive"
            onClick={() => setErro(null)}
          >
            Fechar
          </Button>
        </div>
      )}
    </div>
  );
}
