"use client";

import { useCallback, useState } from "react";
import type { OrdemServicoCategoria } from "@essencia/shared/types";
import { CATEGORIA_LABELS } from "@essencia/shared/types";
import { Button } from "@essencia/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@essencia/ui/components/dialog";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@essencia/ui/components/tabs";
import { Textarea } from "@essencia/ui/components/textarea";
import { toast } from "@essencia/ui/toaster";
import { Loader2, Paperclip } from "lucide-react";
import { useCriarOs } from "@/hooks/use-criar-os";
import { UploadArquivo } from "@/features/midia/components/upload-arquivo";
import { GravadorTela } from "@/features/midia/components/gravador-tela";
import { GravadorAudio } from "@/features/midia/components/gravador-audio";

// ============================================
// Tipos
// ============================================

interface NovaOsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormErros {
  titulo?: string;
  descricao?: string;
  categoria?: string;
}

const CATEGORIAS = Object.entries(CATEGORIA_LABELS) as [
  OrdemServicoCategoria,
  string,
][];

// ============================================
// Componente
// ============================================

export function NovaOsDialog({
  open,
  onOpenChange,
  onSuccess,
}: NovaOsDialogProps) {
  // Estado do formulario
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<OrdemServicoCategoria | "">("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erros, setErros] = useState<FormErros>({});

  const { criar, isLoading } = useCriarOs();

  // ============================================
  // Reset do estado ao fechar
  // ============================================

  const resetarEstado = useCallback(() => {
    setTitulo("");
    setDescricao("");
    setCategoria("");
    setArquivos([]);
    setErros({});
  }, []);

  const handleOpenChange = useCallback(
    (novoEstado: boolean) => {
      if (!novoEstado) {
        resetarEstado();
      }
      onOpenChange(novoEstado);
    },
    [onOpenChange, resetarEstado],
  );

  // ============================================
  // Gerenciamento de arquivos
  // ============================================

  const adicionarArquivos = useCallback((novosArquivos: File[]) => {
    setArquivos((prev) => [...prev, ...novosArquivos]);
  }, []);

  const removerArquivo = useCallback((index: number) => {
    setArquivos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGravacaoCompleta = useCallback(
    (blob: Blob, filename: string) => {
      const file = new File([blob], filename, { type: blob.type });
      setArquivos((prev) => [...prev, file]);
      toast.success("Gravacao adicionada aos anexos.");
    },
    [],
  );

  // ============================================
  // Validacao
  // ============================================

  const validar = useCallback((): boolean => {
    const novosErros: FormErros = {};

    if (!titulo.trim() || titulo.trim().length < 3) {
      novosErros.titulo = "O titulo deve ter pelo menos 3 caracteres.";
    }
    if (titulo.length > 200) {
      novosErros.titulo = "O titulo deve ter no maximo 200 caracteres.";
    }

    if (!descricao.trim() || descricao.trim().length < 10) {
      novosErros.descricao =
        "A descricao deve ter pelo menos 10 caracteres.";
    }
    if (descricao.length > 5000) {
      novosErros.descricao =
        "A descricao deve ter no maximo 5000 caracteres.";
    }

    if (!categoria) {
      novosErros.categoria = "Selecione uma categoria.";
    }

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }, [titulo, descricao, categoria]);

  // ============================================
  // Submissao
  // ============================================

  const handleSubmit = useCallback(async () => {
    if (!validar()) return;
    if (!categoria) return;

    try {
      await criar({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        categoria,
        arquivos,
      });

      toast.success("Ordem de servico criada com sucesso!");
      onSuccess();
      handleOpenChange(false);
    } catch {
      toast.error(
        "Erro ao criar ordem de servico. Tente novamente.",
      );
    }
  }, [
    validar,
    categoria,
    criar,
    titulo,
    descricao,
    arquivos,
    onSuccess,
    handleOpenChange,
  ]);

  // ============================================
  // Contagem de arquivos por tipo (para exibir nas tabs)
  // ============================================

  const contagemImagens = arquivos.filter((f) =>
    f.type.startsWith("image/"),
  ).length;
  const contagemVideos = arquivos.filter((f) =>
    f.type.startsWith("video/"),
  ).length;
  const contagemAudios = arquivos.filter((f) =>
    f.type.startsWith("audio/"),
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Servico</DialogTitle>
          <DialogDescription>
            Descreva o problema ou solicitacao. Anexe imagens, videos ou audios
            para nos ajudar a entender melhor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Campo: Titulo */}
          <div className="space-y-2">
            <Label htmlFor="nova-os-titulo">
              Titulo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nova-os-titulo"
              placeholder="Resumo breve do problema ou solicitacao"
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (erros.titulo) {
                  setErros((prev) => ({ ...prev, titulo: undefined }));
                }
              }}
              maxLength={200}
              disabled={isLoading}
            />
            <div className="flex items-center justify-between">
              {erros.titulo ? (
                <p className="text-sm text-destructive">{erros.titulo}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-muted-foreground">
                {titulo.length}/200
              </p>
            </div>
          </div>

          {/* Campo: Categoria */}
          <div className="space-y-2">
            <Label htmlFor="nova-os-categoria">
              Categoria <span className="text-destructive">*</span>
            </Label>
            <Select
              value={categoria}
              onValueChange={(valor) => {
                setCategoria(valor as OrdemServicoCategoria);
                if (erros.categoria) {
                  setErros((prev) => ({ ...prev, categoria: undefined }));
                }
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="nova-os-categoria">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(([valor, label]) => (
                  <SelectItem key={valor} value={valor}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erros.categoria && (
              <p className="text-sm text-destructive">{erros.categoria}</p>
            )}
          </div>

          {/* Campo: Descricao */}
          <div className="space-y-2">
            <Label htmlFor="nova-os-descricao">
              Descricao <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="nova-os-descricao"
              placeholder="Descreva detalhadamente o que aconteceu, os passos para reproduzir o problema, ou a sua sugestao..."
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                if (erros.descricao) {
                  setErros((prev) => ({ ...prev, descricao: undefined }));
                }
              }}
              maxLength={5000}
              rows={5}
              disabled={isLoading}
            />
            <div className="flex items-center justify-between">
              {erros.descricao ? (
                <p className="text-sm text-destructive">{erros.descricao}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-muted-foreground">
                {descricao.length}/5000
              </p>
            </div>
          </div>

          {/* Secao: Anexos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <Label>Anexos</Label>
              {arquivos.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({arquivos.length} arquivo{arquivos.length !== 1 ? "s" : ""})
                </span>
              )}
            </div>

            <Tabs defaultValue="imagens">
              <TabsList className="w-full">
                <TabsTrigger value="imagens" className="flex-1">
                  Imagens
                  {contagemImagens > 0 && (
                    <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {contagemImagens}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="video" className="flex-1">
                  Video
                  {contagemVideos > 0 && (
                    <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {contagemVideos}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="audio" className="flex-1">
                  Audio
                  {contagemAudios > 0 && (
                    <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {contagemAudios}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Tab: Imagens */}
              <TabsContent value="imagens">
                <UploadArquivo
                  accept="image/*"
                  maxFiles={10}
                  maxSizeMB={10}
                  arquivos={arquivos.filter((f) =>
                    f.type.startsWith("image/"),
                  )}
                  onFilesSelected={adicionarArquivos}
                  onRemove={(index) => {
                    const imagensIndices = arquivos
                      .map((f, i) => ({ file: f, index: i }))
                      .filter(({ file }) => file.type.startsWith("image/"));
                    const realIndex = imagensIndices[index]?.index;
                    if (realIndex !== undefined) {
                      removerArquivo(realIndex);
                    }
                  }}
                />
              </TabsContent>

              {/* Tab: Video */}
              <TabsContent value="video" className="space-y-4">
                <GravadorTela onRecordingComplete={handleGravacaoCompleta} />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      ou envie um arquivo
                    </span>
                  </div>
                </div>
                <UploadArquivo
                  accept="video/*"
                  maxFiles={3}
                  maxSizeMB={100}
                  arquivos={arquivos.filter((f) =>
                    f.type.startsWith("video/"),
                  )}
                  onFilesSelected={adicionarArquivos}
                  onRemove={(index) => {
                    const videosIndices = arquivos
                      .map((f, i) => ({ file: f, index: i }))
                      .filter(({ file }) => file.type.startsWith("video/"));
                    const realIndex = videosIndices[index]?.index;
                    if (realIndex !== undefined) {
                      removerArquivo(realIndex);
                    }
                  }}
                />
              </TabsContent>

              {/* Tab: Audio */}
              <TabsContent value="audio" className="space-y-4">
                <GravadorAudio onRecordingComplete={handleGravacaoCompleta} />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      ou envie um arquivo
                    </span>
                  </div>
                </div>
                <UploadArquivo
                  accept="audio/*"
                  maxFiles={3}
                  maxSizeMB={50}
                  arquivos={arquivos.filter((f) =>
                    f.type.startsWith("audio/"),
                  )}
                  onFilesSelected={adicionarArquivos}
                  onRemove={(index) => {
                    const audiosIndices = arquivos
                      .map((f, i) => ({ file: f, index: i }))
                      .filter(({ file }) => file.type.startsWith("audio/"));
                    const realIndex = audiosIndices[index]?.index;
                    if (realIndex !== undefined) {
                      removerArquivo(realIndex);
                    }
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
