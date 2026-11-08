import React from "react";
import Link from "next/link";

import { INSTITUICAO } from "../../lib/instituicao";

export function RodapeConfianca(): React.JSX.Element {
  return (
    <footer className="border-t border-[var(--linha)] bg-[var(--cartao)]">
      <div className="content-width py-10">
        <div className="grid gap-8 text-sm text-[var(--tinta-2)] md:grid-cols-3">
          <section>
            <h2 className="font-display text-base font-semibold text-[var(--tinta)]">Formas de pagamento</h2>
            <p className="mt-2">Cartão de crédito e Pix</p>
            <div className="mt-3 flex gap-2 text-xs font-semibold uppercase tracking-wide" aria-label="Selos de pagamento">
              <span className="rounded border border-[var(--linha)] px-2 py-1">Cartão</span>
              <span className="rounded border border-[var(--linha)] px-2 py-1">Pix</span>
            </div>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-[var(--tinta)]">Compra segura</h2>
            <p className="mt-2">Pagamento processado pela Stripe. Os dados do seu cartão não passam pelo nosso servidor.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-[var(--tinta)]">Precisa de ajuda?</h2>
            <p className="mt-2">
              <Link href="/pedido/consulta" className="font-semibold text-[var(--acao)] underline-offset-2 hover:underline">Meus ingressos</Link>
            </p>
            <p className="mt-2">
              <a href={INSTITUICAO.telefoneHref} className="font-semibold text-[var(--acao)] underline-offset-2 hover:underline">Fale com o colégio</a>
              <span className="mt-1 block">Telefone {INSTITUICAO.telefone}</span>
            </p>
          </section>
        </div>
        <div className="mt-10 border-t border-[var(--linha)] pt-5 text-sm text-[var(--tinta-2)]">
          <p>{INSTITUICAO.nome} · {INSTITUICAO.cnpj} · {INSTITUICAO.endereco}</p>
        </div>
      </div>
    </footer>
  );
}
