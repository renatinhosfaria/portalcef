import React from "react";
import { MeusIngressos } from "../../../components/ingressos/meus-ingressos";

type ParametrosConsulta = { pedido?: string | string[] };

export default async function Page({ searchParams }: { searchParams?: Promise<ParametrosConsulta> }): Promise<React.JSX.Element> {
  const query = searchParams ? await searchParams : {};
  const numeroInicial = Array.isArray(query.pedido) ? query.pedido[0] ?? "" : query.pedido ?? "";
  return (
    <section className="content-width py-12 md:py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-green-dark)]">Acesso seguro</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[var(--tinta)] md:text-5xl">Meus ingressos</h1>
      <p className="mt-4 mb-10 max-w-2xl text-lg text-[var(--tinta-2)]">Encontre seus pedidos para acessar os ingressos do evento.</p>
      <MeusIngressos numeroInicial={numeroInicial} />
    </section>
  );
}
