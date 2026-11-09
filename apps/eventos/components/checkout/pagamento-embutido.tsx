"use client";

import React from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

const stripePorChave = new Map<string, Promise<Stripe | null>>();

export function obterStripe(publishableKey: string): Promise<Stripe | null> {
  const existente = stripePorChave.get(publishableKey);
  if (existente) return existente;

  const carregamento = loadStripe(publishableKey);
  stripePorChave.set(publishableKey, carregamento);
  return carregamento;
}

type Props = {
  publishableKey: string | null;
  clientSecret: string;
};

export function PagamentoEmbutido({ publishableKey, clientSecret }: Props): React.JSX.Element {
  const stripe = publishableKey ? obterStripe(publishableKey) : null;

  return (
    <section aria-label="Pagamento" className="space-y-4">
      <p className="text-sm text-slate-600">Pagamento processado pela Stripe. Os dados do seu cartão não passam pelo nosso servidor.</p>
      {publishableKey && stripe ? (
        <EmbeddedCheckoutProvider stripe={stripe} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      ) : (
        <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-900">Pagamento indisponível no momento. Tente novamente em instantes.</p>
      )}
    </section>
  );
}
