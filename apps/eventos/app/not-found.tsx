import React from "react";
import Link from "next/link";
import { classeBotaoAcao } from "../components/base/botao-acao";

export default function NotFound(): React.JSX.Element {
  return <section className="content-narrow flex min-h-[50vh] flex-col items-center justify-center py-16 text-center"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand-green-dark)]">Eventos</p><h1 className="mt-3 font-display text-4xl font-semibold">Não encontramos esta página</h1><p className="mt-4 max-w-md text-[var(--ink-muted)]">O endereço pode ter mudado ou o evento não está mais disponível.</p><Link href="/" className={`${classeBotaoAcao("primaria")} mt-8`}>Voltar à página inicial</Link></section>;
}
