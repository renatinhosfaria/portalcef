"use client";

import { useEffect } from "react";

import { irParaLogin } from "../lib/url-login";

/**
 * Exibido pelas páginas do servidor quando a API responde 401: leva ao login
 * e, depois dele, de volta à mesma página. O redirect() do Next não serve aqui
 * porque prefixaria o basePath (/planejamento/login).
 */
export function RedirecionarParaLogin() {
  useEffect(() => {
    irParaLogin(`${window.location.pathname}${window.location.search}`);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-muted-foreground">
        Sua sessão expirou. Redirecionando para o login…
      </p>
    </div>
  );
}
