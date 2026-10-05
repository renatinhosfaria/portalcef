"use client";

import { useTenant } from "@essencia/shared/providers/tenant";

function obterSaudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );

  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeGreeting() {
  const { name } = useTenant();
  const primeiroNome = name?.trim().split(/\s+/)[0] || "Visitante";

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
        {obterSaudacao()}, {primeiroNome} 👋
      </h1>
      <p className="font-medium text-slate-500">
        Aqui está o resumo das atividades da sua instituição hoje.
      </p>
    </>
  );
}
