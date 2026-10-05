"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function Sheet({ isOpen, onClose, children, title }: SheetProps) {
  const painelRef = useRef<HTMLDivElement>(null);
  const ultimoFoco = useRef<HTMLElement | null>(null);
  const idTitulo = useId();

  useEffect(() => {
    if (!isOpen) return;
    ultimoFoco.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const focoInicial = window.setTimeout(() => painelRef.current?.focus(), 0);
    const aoPressionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        onClose();
        return;
      }
      if (evento.key !== "Tab" || !painelRef.current) return;
      const focaveis = painelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focaveis.length) return;
      const primeiro = focaveis.item(0);
      const ultimo = focaveis.item(focaveis.length - 1);
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoPressionarTecla);
    return () => {
      window.clearTimeout(focoInicial);
      document.removeEventListener("keydown", aoPressionarTecla);
      document.body.style.overflow = "";
      ultimoFoco.current?.focus();
    };
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;
  const tituloId = title ? idTitulo : undefined;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Fechar painel"
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity cursor-default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={painelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ? undefined : "Painel lateral"}
            aria-labelledby={tituloId}
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-white shadow-2xl p-6 sm:p-10 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              {title && (
                <h2 id={tituloId} className="text-2xl font-bold text-slate-800">
                  {title}
                </h2>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label={title ? `Fechar ${title}` : "Fechar painel"}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X aria-hidden="true" className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
