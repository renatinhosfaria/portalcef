"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) throw new Error("Não foi possível validar a sessão");
      const body = (await response.json()) as {
        data?: { user?: TenantContextType };
      };
      const user = body.data?.user;
      if (!user || user.role?.toLowerCase() !== "master")
        throw new Error("Esta conta não tem acesso ao módulo");
      setTenant({ ...user, role: user.role.toLowerCase(), isLoaded: true });
    } catch (error) {
      setTenant((anterior) => ({ ...anterior, isLoaded: false }));
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar sua sessão",
      );
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (erro)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div
          role="alert"
          className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg"
        >
          <h1 className="text-xl font-bold text-slate-900">
            Não foi possível carregar sua sessão
          </h1>
          <p className="mt-2 text-slate-500">{erro}</p>
          <button
            type="button"
            onClick={() => void carregar()}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  if (!tenant.isLoaded)
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-50"
        aria-busy="true"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A3D154]" />
      </div>
    );
  return (
    <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
  );
}

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined)
    throw new Error("useTenant must be used within a TenantProvider");
  return context;
};
