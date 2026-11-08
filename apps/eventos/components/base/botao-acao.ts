type VarianteBotaoAcao = "primaria" | "secundaria" | "fantasma";

const BASE = "inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acao)] disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTES: Record<VarianteBotaoAcao, string> = {
  primaria: "bg-[var(--acao)] text-white hover:bg-[var(--acao-hover)]",
  secundaria: "border border-[var(--acao)] bg-[var(--cartao)] text-[var(--acao)] hover:bg-[var(--verde-colegio)]",
  fantasma: "text-[var(--acao)] hover:bg-[var(--verde-colegio)]",
};

export function classeBotaoAcao(variante: VarianteBotaoAcao = "primaria"): string {
  return `${BASE} ${VARIANTES[variante]}`;
}
