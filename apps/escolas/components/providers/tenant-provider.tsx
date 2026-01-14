"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantContextType>({
    schoolId: null,
    unitId: null,
    role: "",
    name: null,
    email: null,
    isLoaded: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get("data");

    if (dataParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(dataParam));
        localStorage.setItem("tenant", JSON.stringify(decoded));

        params.delete("data");
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${
          nextQuery ? `?${nextQuery}` : ""
        }`;
        window.history.replaceState({}, document.title, nextUrl);
      } catch (error) {
        console.error("Failed to hydrate tenant data", error);
      }
    }

    const stored = localStorage.getItem("tenant");
    if (!stored) {
      window.location.href = "https://www.portalcef.com.br/login"; // Login
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      const role =
        typeof parsed.role === "string" ? parsed.role.toLowerCase() : "";

      // STRICT CHECK: ONLY MASTER ALLOWED
      if (role !== "master") {
        console.warn(
          "Acesso negado: Apenas usuários Master podem acessar este módulo.",
        );
        localStorage.removeItem("tenant"); // Force verify or send back
        window.location.href = "https://www.portalcef.com.br/login"; // Redirect to Login
        return;
      }

      setTenant({ ...parsed, role, isLoaded: true });
    } catch {
      localStorage.removeItem("tenant");
      window.location.href = "https://www.portalcef.com.br/login";
    }
  }, [router]);

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
