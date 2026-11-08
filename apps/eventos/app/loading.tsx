import React from "react";
import { Esqueleto } from "../components/base/esqueleto";

export default function Loading(): React.JSX.Element {
  return <section className="content-width py-12 md:py-16" aria-label="Carregando eventos"><Esqueleto className="h-4 w-28" /><Esqueleto className="mt-4 h-12 w-3/4 max-w-xl" /><div className="mt-10 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface-card)] md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]"><Esqueleto className="min-h-[18rem] rounded-none md:min-h-[30rem]" /><div className="p-6 md:p-10"><Esqueleto className="h-4 w-24" /><Esqueleto className="mt-4 h-10 w-4/5" /><Esqueleto className="mt-4 h-16 w-full" /><Esqueleto className="mt-8 h-12 w-40" /></div></div></section>;
}
