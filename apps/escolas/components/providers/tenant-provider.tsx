"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface TenantContextType {
  schoolId: string | null;
  unitId: string | null;
  role: string;
  name?: string | null;
  email?: string | null;
  isLoaded: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantContextType>({
    schoolId: null,
    unitId: null,
    role: "",
    name: null,
    email: null,
    isLoaded: false,
  });

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sessão inválida");
        const body = (await response.json()) as { data?: { user?: TenantContextType } };
        const user = body.data?.user;
        if (!user || user.role?.toLowerCase() !== "master") throw new Error("Acesso negado");
        setTenant({ ...user, role: user.role.toLowerCase(), isLoaded: true });
      })
      .catch(() => {
        window.location.href = "https://www.portalcef.com.br/login";
      });
  }, []);

  if (!tenant.isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A3D154]" />
      </div>
    );
  }

  return (
    <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
  );
}

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
};
