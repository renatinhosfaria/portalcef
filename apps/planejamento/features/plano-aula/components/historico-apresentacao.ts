import type { HistoricoEntry } from "@essencia/shared/types";

export type HistoricoModulo = "plano-aula" | "prova" | "relatorio";

export function obterLabelDocumentoExcluido(modulo: HistoricoModulo): string {
  if (modulo === "relatorio") return "Documento do relatório excluído";
  if (modulo === "prova") return "Documento da prova excluído";
  return "Documento do plano excluído";
}

export function obterDetalhesDocumentoExcluido(
  entry: HistoricoEntry,
): string | null {
  if (
    entry.acao !== "DOCUMENTO_EXCLUIDO" ||
    !entry.detalhes ||
    typeof entry.detalhes !== "object"
  ) {
    return null;
  }

  const detalhes = entry.detalhes;
  const documentoNome =
    typeof detalhes.documentoNome === "string" && detalhes.documentoNome.trim()
      ? detalhes.documentoNome.trim()
      : null;
  const motivo =
    typeof detalhes.motivo === "string" && detalhes.motivo.trim()
      ? detalhes.motivo.trim()
      : null;

  const informacoes = [
    documentoNome ? `Arquivo: ${documentoNome}` : null,
    motivo ? `Motivo: ${motivo}` : null,
  ].filter((informacao): informacao is string => Boolean(informacao));

  return informacoes.length > 0 ? informacoes.join(" • ") : null;
}
