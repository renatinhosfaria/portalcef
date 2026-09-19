"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";

import { Button } from "@essencia/ui/components/button";

interface MobileDrawerProps {
  children: ReactNode;
  title: string;
  className?: string;
}

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileDrawer({ children, title, className }: MobileDrawerProps) {
  const [aberto, setAberto] = useState(false);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const abrirRef = useRef<HTMLButtonElement>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) fecharRef.current?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fecharComEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setAberto(false);
        abrirRef.current?.focus();
      }
    };
    document.addEventListener("keydown", fecharComEscape);
    return () => document.removeEventListener("keydown", fecharComEscape);
  }, [aberto]);

  const controlarTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !dialogoRef.current) return;
    const focaveis = Array.from(
      dialogoRef.current.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL),
    );
    if (focaveis.length === 0) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault();
      ultimo?.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault();
      primeiro?.focus();
    }
  };

  return (
    <>
      <Button
        ref={abrirRef}
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Abrir menu"
        aria-expanded={aberto}
        aria-controls="menu-movel"
        onClick={() => setAberto(true)}
      >
        <Menu className="w-6 h-6 text-slate-600" />
      </Button>

      {aberto && (
        <div className="fixed inset-0 z-50 sm:hidden" aria-label="Navegação móvel">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Fechar menu móvel"
            onClick={() => {
              setAberto(false);
              abrirRef.current?.focus();
            }}
          />
          <div
            id="menu-movel"
            ref={dialogoRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onKeyDown={controlarTab}
            onClick={(event) => {
              const alvo = event.target as HTMLElement;
              if (alvo.closest("a, [data-drawer-close]")) {
                setAberto(false);
              }
            }}
            className={`relative flex h-full w-[min(20rem,85vw)] flex-col bg-white shadow-2xl ${className ?? ""}`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
              <Button ref={fecharRef} variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => { setAberto(false); abrirRef.current?.focus(); }}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
