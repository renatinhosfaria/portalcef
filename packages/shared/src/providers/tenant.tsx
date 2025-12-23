"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

interface TenantContextType {
  schoolId: string;
  unitId: string;
  role: string;
  isLoaded: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantContextType>({
    schoolId: "",
    unitId: "",
    role: "",
    isLoaded: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

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
      // Redirect to login if no tenant context found
      window.location.href = (() => {
          if (window.location.hostname === "localhost") return "http://localhost:3003";
          return "/login";
      })();
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setTenant({ ...parsed, isLoaded: true });
    } catch {
      // Invalid JSON, clear and redirect
      localStorage.removeItem("tenant");
       window.location.href = (() => {
          if (window.location.hostname === "localhost") return "http://localhost:3003";
          return "/login";
      })();
    }
  }, [router]);

  // Prevent flash of unauthenticated content
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
