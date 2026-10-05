"use client";

import { Button } from "@essencia/ui/components/button";
import { LayoutDashboard, LayoutGrid, LogOut, School, X } from "lucide-react";
import { useState } from "react";

import { SidebarItem } from "./sidebar-item";

interface MasterSidebarProps {
  abertoNoMobile?: boolean;
  onFecharMobile?: () => void;
}

export function MasterSidebar({
  abertoNoMobile = false,
  onFecharMobile,
}: MasterSidebarProps) {
  const [saindo, setSaindo] = useState(false);
  const sair = async () => {
    if (saindo) return;
    setSaindo(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Mesmo com falha de rede, remove o estado local e deixa a sessão ser revalidada.
    } finally {
      localStorage.removeItem("tenant");
      window.location.assign("/login");
    }
  };

  const itemProps = { onNavigate: onFecharMobile };
  return (
    <>
      {abertoNoMobile && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={onFecharMobile}
        />
      )}
      <aside
        data-mobile-open={abertoNoMobile ? "true" : undefined}
        aria-label="Navegação principal"
        className={`fixed inset-y-0 left-0 z-40 w-72 flex-col items-center py-8 border-r border-slate-200/60 bg-white/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 lg:flex ${abertoNoMobile ? "flex translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-6 mb-12 w-full">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 shadow-lg shadow-slate-900/20">
              <span className="text-[#A3D154] font-bold text-xl">M</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Portal CEF
            </span>
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            className="p-2 rounded-lg hover:bg-slate-100 lg:hidden"
            onClick={onFecharMobile}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-2 w-full px-4">
          <SidebarItem
            {...itemProps}
            icon={LayoutGrid}
            label="Voltar aos Apps"
            href="/"
            active={false}
          />
          <div className="my-2 border-t border-slate-100" />
          <SidebarItem
            {...itemProps}
            icon={LayoutDashboard}
            label="Visão Geral"
            href="/"
          />
          <SidebarItem
            {...itemProps}
            icon={School}
            label="Escolas & Unidades"
            href="/schools"
          />
        </nav>
        <div className="mt-auto flex flex-col gap-4 w-full px-6">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl py-6"
            onClick={() => void sair()}
            disabled={saindo}
            aria-busy={saindo}
            aria-label="Sair do Master"
          >
            <LogOut aria-hidden="true" className="w-5 h-5" />
            <span className="font-medium">Sair do Master</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
