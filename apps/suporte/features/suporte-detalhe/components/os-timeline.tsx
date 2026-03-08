"use client";

import type { MensagemEnriquecida } from "@essencia/shared/types";
import { cn } from "@essencia/ui/lib/utils";
import { Badge } from "@essencia/ui/components/badge";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Image as ImageIcon, Video, Mic, FileText } from "lucide-react";

// ============================================
// Roles administrativas
// ============================================
const ADMIN_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
];

// ============================================
// Props
// ============================================
interface OsTimelineProps {
  mensagens: MensagemEnriquecida[];
  currentUserId?: string;
}

// ============================================
// Helpers
// ============================================
function isAdmin(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

function getIconePorTipo(tipo: string) {
  switch (tipo) {
    case "IMAGEM":
      return <ImageIcon className="h-4 w-4" />;
    case "VIDEO":
      return <Video className="h-4 w-4" />;
    case "AUDIO":
      return <Mic className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function formatarData(dateStr: string): string {
  const date = new Date(dateStr);
  const agora = new Date();
  const diffMs = agora.getTime() - date.getTime();
  const diffDias = diffMs / (1000 * 60 * 60 * 24);

  if (diffDias < 7) {
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: ptBR,
    });
  }

  return format(date, "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });
}

// ============================================
// Componente de Mensagem Individual
// ============================================
function MensagemItem({
  mensagem,
  isFromAdmin,
}: {
  mensagem: MensagemEnriquecida;
  isFromAdmin: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full",
        isFromAdmin ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 space-y-2",
          isFromAdmin
            ? "bg-blue-50 border border-blue-100"
            : "bg-gray-50 border border-gray-100",
        )}
      >
        {/* Cabecalho: nome + role badge + data */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {mensagem.criadoPorNome}
          </span>
          {isFromAdmin && (
            <Badge
              variant="outline"
              className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-1.5 py-0 gap-1"
            >
              <Shield className="h-3 w-3" />
              Equipe
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatarData(mensagem.createdAt)}
          </span>
        </div>

        {/* Conteudo baseado no tipo */}
        {mensagem.tipo === "TEXTO" && mensagem.conteudo && (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {mensagem.conteudo}
          </p>
        )}

        {mensagem.tipo === "IMAGEM" && mensagem.arquivoUrl && (
          <div className="space-y-1">
            {mensagem.conteudo && (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {mensagem.conteudo}
              </p>
            )}
            <a
              href={mensagem.arquivoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={mensagem.arquivoUrl}
                alt={mensagem.arquivoNome || "Imagem anexada"}
                className="max-w-full max-h-64 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
        )}

        {mensagem.tipo === "VIDEO" && mensagem.arquivoUrl && (
          <div className="space-y-1">
            {mensagem.conteudo && (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {mensagem.conteudo}
              </p>
            )}
            <video
              src={mensagem.arquivoUrl}
              controls
              className="max-w-full max-h-64 rounded-lg border"
            >
              Seu navegador nao suporta reproducao de video.
            </video>
          </div>
        )}

        {mensagem.tipo === "AUDIO" && mensagem.arquivoUrl && (
          <div className="space-y-1">
            {mensagem.conteudo && (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {mensagem.conteudo}
              </p>
            )}
            <audio src={mensagem.arquivoUrl} controls className="w-full">
              Seu navegador nao suporta reproducao de audio.
            </audio>
          </div>
        )}

        {/* Indicador de tipo para midias */}
        {mensagem.tipo !== "TEXTO" && mensagem.arquivoNome && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            {getIconePorTipo(mensagem.tipo)}
            <span className="truncate">{mensagem.arquivoNome}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Componente Principal - Timeline
// ============================================
export function OsTimeline({ mensagens, currentUserId }: OsTimelineProps) {
  if (mensagens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhuma mensagem ainda. Envie a primeira resposta!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {mensagens.map((mensagem) => {
        const mensagemIsAdmin = isAdmin(mensagem.criadoPorRole);
        return (
          <MensagemItem
            key={mensagem.id}
            mensagem={mensagem}
            isFromAdmin={mensagemIsAdmin}
          />
        );
      })}
    </div>
  );
}
