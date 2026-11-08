import React from "react";
import Image from "next/image";
import Link from "next/link";

import { classeBotaoAcao } from "./botao-acao";

export function Cabecalho(): React.JSX.Element {
  return (
    <header className="border-b border-[var(--linha)] bg-[var(--cartao)]">
      <div className="content-width flex min-h-20 items-center justify-between gap-4 py-4">
        <Link href="/" aria-label="Ir para eventos" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Essência Feliz" width={192} height={48} className="h-10 w-auto md:h-12" priority />
          <span className="font-display text-lg font-semibold text-[var(--tinta)]">Eventos</span>
        </Link>
        <Link href="/pedido/consulta" className={classeBotaoAcao("fantasma")}>
          Meus ingressos
        </Link>
      </div>
    </header>
  );
}
