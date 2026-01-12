'use client';

import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
}

export function useToast() {
  const [toast, setToast] = useState<ToastProps | null>(null);

  const showToast = (props: ToastProps) => {
    setToast(props);
  };

  const hideToast = () => {
    setToast(null);
  };

  return { toast, showToast, hideToast };
}

export function Toast({ message, type = 'info', duration = 3500, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, 150);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const styles = {
    success: {
      bg: 'bg-[#A3D154]',
      icon: CheckCircle2,
    },
    error: {
      bg: 'bg-red-500',
      icon: XCircle,
    },
    info: {
      bg: 'bg-slate-700',
      icon: Info,
    },
  };

  const { bg, icon: Icon } = styles[type];

  return (
    <div
      className={`fixed bottom-4 right-4 ${bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 transition-all duration-150 ${
        isLeaving ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={() => {
          setIsLeaving(true);
          setTimeout(() => {
            setIsVisible(false);
            onClose?.();
          }, 150);
        }}
        className="p-1 hover:bg-white/20 rounded transition-colors duration-150"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
