import { LIMITE_TOTAL_ANEXOS_SUPORTE } from "@essencia/shared/types";

export function adicionarArquivosComLimite(
  arquivosAtuais: File[],
  novosArquivos: File[],
): { arquivos: File[]; quantidadeIgnorada: number } {
  const vagas = Math.max(
    LIMITE_TOTAL_ANEXOS_SUPORTE - arquivosAtuais.length,
    0,
  );

  return {
    arquivos: novosArquivos.slice(0, vagas),
    quantidadeIgnorada: Math.max(novosArquivos.length - vagas, 0),
  };
}
