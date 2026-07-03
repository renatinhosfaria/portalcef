import type { PlanoDocumento } from "../plano-aula";

import type { ProvaDocumento } from "./types";

function isDocumentoWord(documento: ProvaDocumento): boolean {
  return (
    documento.mimeType?.includes("word") === true ||
    documento.mimeType?.includes("msword") === true
  );
}

export function adaptarDocumentoProvaParaDocumentoList(
  documento: ProvaDocumento,
): PlanoDocumento {
  const pdfStatus = documento.pdfUrl
    ? "PRONTO"
    : documento.approvedBy && isDocumentoWord(documento)
      ? "ERRO"
      : undefined;

  return {
    ...documento,
    planoId: documento.provaId,
    pdfStatus,
  } as PlanoDocumento;
}
