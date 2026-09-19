"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface TenantContextType {
  userId: string;
  schoolId: string;
  unitId: string;
  stageId: string;
  role: string;
  name: string;
  email?: string;
  isLoaded: boolean;
}

interface UsuarioSessao {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  schoolId?: string;
  unitId?: string;
  stageId?: string;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);
const estadoInicial: TenantContextType = { userId: "", schoolId: "", unitId: "", stageId: "", role: "", name: "", email: "", isLoaded: false };

function getLoginUrl(): string {
  if (typeof window === "undefined") return "/login";
  return window.location.hostname === "localhost" ? "http://localhost:3003" : "/login";
}

function limparLegadoDeIdentidade() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("data")) {
    params.delete("data");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }
  localStorage.removeItem("tenant");
}

function normalizarUsuario(usuario: UsuarioSessao): TenantContextType {
  return { userId: usuario.id ?? "", schoolId: usuario.schoolId ?? "", unitId: usuario.unitId ?? "", stageId: usuario.stageId ?? "", role: usuario.role ?? "", name: usuario.name ?? "", email: usuario.email ?? "", isLoaded: true };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantContextType>(estadoInicial);

  useEffect(() => {
    let montado = true;
    limparLegadoDeIdentidade();
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error("Sessão não autenticada");
        const corpo = (await resposta.json()) as { data?: { user?: UsuarioSessao }; user?: UsuarioSessao };
        const usuario = corpo.data?.user ?? corpo.user;
        if (!usuario) throw new Error("Resposta de sessão inválida");
        if (montado) setTenant(normalizarUsuario(usuario));
      })
      .catch(() => {
        if (montado) window.location.href = getLoginUrl();
      });
    return () => { montado = false; };
  }, []);

  const contextValue = useMemo(() => tenant, [tenant]);
  if (!tenant.isLoaded) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A3D154]" /></div>;
  }
  return <TenantContext.Provider value={contextValue}>{children}</TenantContext.Provider>;
}

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) throw new Error("useTenant must be used within a TenantProvider");
  return context;
};
