"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string; // Added className prop for flexibility
}

export function Sheet({ isOpen, onClose, children, title, className }: SheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-white shadow-2xl p-6 sm:p-10 overflow-y-auto ${className}`}
          >
            <div className="flex items-center justify-between mb-8">
              {title && (
                <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-6 h-6 text-slate-500" />
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
