"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// Helper function to get login URL (memoized outside component)
const getLoginUrl = (): string => {
  if (typeof window === "undefined") return "/login";
  return window.location.hostname === "localhost"
    ? "http://localhost:3003"
    : "/login";
};

// Initialize tenant from localStorage synchronously (SSR-safe)
const initializeTenant = (): TenantContextType => {
  if (typeof window === "undefined") {
    return {
      userId: "",
      schoolId: "",
      unitId: "",
      stageId: "",
      role: "",
      name: "",
      email: "",
      isLoaded: false,
    };
  }

  // Check URL params first
  const params = new URLSearchParams(window.location.search);
  const dataParam = params.get("data");

  if (dataParam) {
    try {
      const decoded = JSON.parse(decodeURIComponent(dataParam));
      localStorage.setItem("tenant", JSON.stringify(decoded));

      // Clean URL without full redirect
      params.delete("data");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${
        nextQuery ? `?${nextQuery}` : ""
      }`;
      window.history.replaceState({}, "", nextUrl);

      return { ...decoded, isLoaded: true };
    } catch (error) {
      console.error("Failed to hydrate tenant data", error);
    }
  }

  // Try localStorage
  const stored = localStorage.getItem("tenant");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return { ...parsed, isLoaded: true };
    } catch {
      localStorage.removeItem("tenant");
    }
  }

  return {
    userId: "",
    schoolId: "",
    unitId: "",
    stageId: "",
    role: "",
    name: "",
    email: "",
    isLoaded: false,
  };
};

export function TenantProvider({ children }: { children: ReactNode }) {
  // Initialize with empty state to avoid hydration mismatch
  const [tenant, setTenant] = useState<TenantContextType>({
    userId: "",
    schoolId: "",
    unitId: "",
    stageId: "",
    role: "",
    name: "",
    email: "",
    isLoaded: false,
  });

  useEffect(() => {
    // Only run on client-side to avoid hydration mismatch
    const initialTenant = initializeTenant();
    setTenant(initialTenant);

    // If no tenant data, redirect to login
    if (!initialTenant.isLoaded) {
      window.location.href = getLoginUrl();
    }
  }, []);

  // Memoize context value to prevent re-renders when tenant doesn't change
  const contextValue = useMemo(
    () => tenant,
    [
      tenant.userId,
      tenant.schoolId,
      tenant.unitId,
      tenant.stageId,
      tenant.role,
      tenant.name,
      tenant.email,
      tenant.isLoaded,
    ],
  );

  // Prevent flash of unauthenticated content
  if (!tenant.isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A3D154]" />
      </div>
    );
  }

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
};
