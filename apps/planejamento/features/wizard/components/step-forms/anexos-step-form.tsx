"use client";

import { api } from "@essencia/shared/fetchers/client";
import { Button } from "@essencia/ui/components/button";
import { File, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

interface FileAttachment {
  url: string;
  key: string;
  name: string;
}

export function AnexosStepForm({ defaultValues, onSubmit }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>(
    defaultValues?.anexos || [],
  );

  const form = useForm({
    defaultValues: {
      anexos: attachments,
      ...defaultValues,
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const file = files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await api.post<FileAttachment>(
        "/storage/upload",
        formData,
      );

      const newAttachments = [...attachments, result];
      setAttachments(newAttachments);
      form.setValue("anexos", newAttachments, { shouldDirty: true });
    } catch (error) {
      console.error("Upload failed", error);
      // Verificar se é erro 404 (endpoint não existe = MinIO não configurado)
      const errorMessage =
        error instanceof Error && error.message.includes("404")
          ? "Upload de arquivos não está disponível. O administrador precisa configurar o serviço de armazenamento (MinIO)."
          : "Erro ao enviar arquivo. Verifique se o backend está rodando.";
      alert(errorMessage);
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
    form.setValue("anexos", newAttachments, { shouldDirty: true });
  };

  const handleSubmit = (data: any) => {
    onSubmit({ ...data, anexos: attachments });
  };

  return (
    <form
      id="wizard-step-form"
      onSubmit={form.handleSubmit(handleSubmit)}
      className="space-y-6"
    >
      <div className="relative flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center transition-colors hover:bg-muted/50">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <h3 className="mb-2 text-lg font-semibold">Anexar Arquivos</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Clique para selecionar um arquivo
        </p>
        <input
          type="file"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Arquivos Anexados</h4>
          <div className="space-y-2">
            {attachments.map((file, index) => (
              <div
                key={file.key || index}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <File className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{file.name}</span>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Visualizar
                    </a>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
