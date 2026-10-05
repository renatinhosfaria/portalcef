"use client";

import { Button } from "@essencia/ui/components/button";
import { cn } from "@essencia/ui/lib/utils";
import {
  Headset,
  Lock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { useTenant } from "@essencia/shared/providers/tenant";
import { SIDEBAR_KEY } from "./shell";
import {
  PORTAL_MODULES,
  hasModuleAccess,
} from "./module-config";

type ActivePage =
  | "home"
  | "usuarios"
  | "escolas"
  | "turmas"
  | "planejamento"
  | "calendario"
  | "eventos"
  | "tarefas"
  | "workflows"
  | "suporte"
  | "loja-admin";

function getActivePageFromPath(pathname: string): ActivePage | null {
  const normalizedPath = pathname.replace(/\/+$/, "");

  if (normalizedPath === "" || normalizedPath === "/") return "home";
  if (normalizedPath.startsWith("/usuarios")) return "usuarios";
  if (normalizedPath.startsWith("/escolas")) return "escolas";
  if (normalizedPath.startsWith("/turmas")) return "turmas";
  if (normalizedPath.startsWith("/planejamento")) return "planejamento";
  if (normalizedPath.startsWith("/calendario")) return "calendario";
  if (normalizedPath.startsWith("/eventos")) return "eventos";
  if (normalizedPath.startsWith("/tarefas")) return "tarefas";
  if (normalizedPath.startsWith("/workflows")) return "workflows";
  if (normalizedPath.startsWith("/suporte")) return "suporte";
  if (normalizedPath.startsWith("/loja-admin")) return "loja-admin";

  return null;
}

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  mobile?: boolean;
}

function SidebarItem({ icon: Icon, label, href, active, collapsed, onNavigate, mobile }: SidebarItemProps) {
  return (
    <a
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-4 px-4 py-4 rounded-2xl w-full transition-all duration-200 group relative overflow-hidden text-left",
        active
          ? "text-[#A3D154] font-bold bg-[#A3D154]/10"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
      )}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#A3D154] rounded-r-full" />
      )}
      <Icon className="w-5 h-5 relative z-10 flex-shrink-0" />
      <span className={cn("relative z-10 whitespace-nowrap transition-opacity duration-200", collapsed ? "hidden" : mobile ? "block" : "hidden lg:block")}>{label}</span>
    </a>
  );
}

export interface AppSidebarProps {
  /** Widget de tarefas (opcional) para exibir ao lado do item Tarefas */
  tarefasBadge?: React.ReactNode;
  /** Widget de suporte (opcional) para exibir ao lado do item Suporte */
  suporteBadge?: React.ReactNode;
  /** Se o sidebar está colapsado (apenas ícones) */
  collapsed?: boolean;
  /** Callback para alternar collapsed */
  onToggle?: () => void;
  /** Callback para colapsar o sidebar */
  onCollapse?: () => void;
  /** Renderiza a versão embutida no drawer móvel. */
  mobile?: boolean;
  /** Fecha o drawer após navegar. */
  onNavigate?: () => void;
}

export function AppSidebar({ tarefasBadge, suporteBadge, collapsed = false, onToggle, onCollapse, mobile = false, onNavigate }: AppSidebarProps = {}) {
  const { role, name } = useTenant();
  const pathname = usePathname();
  const [activePage, setActivePage] = useState<ActivePage | null>(null);

  // Filtrar itens do menu baseado nas permissões do usuário
  const visibleMenuItems = useMemo(() => {
    if (!role) return [];

    return PORTAL_MODULES.filter((item) => hasModuleAccess(role, item.key));
  }, [role]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentPath = window.location.pathname || pathname || "";
    const activeFromPath = getActivePageFromPath(currentPath);
    if (activeFromPath) {
      setActivePage(activeFromPath);
      return;
    }

    const port = window.location.port;
    if (port === "3000") return setActivePage("home");
    if (port === "3004") return setActivePage("usuarios");
    if (port === "3005") return setActivePage("escolas");
    if (port === "3006") return setActivePage("turmas");
    if (port === "3007") return setActivePage("planejamento");
    if (port === "3008") return setActivePage("calendario");
    if (port === "3014") return setActivePage("eventos");
    if (port === "3012") return setActivePage("tarefas");
    if (port === "3015") return setActivePage("workflows");
    if (port === "3013") return setActivePage("suporte");
    if (port === "3011") return setActivePage("loja-admin");

    setActivePage(null);
  }, [pathname]);

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const handleGoToSupport = () => {
    window.location.href = "/suporte";
  };

  const handleLogout = async () => {
    try {
      // Tenta invalidar sessão no backend via proxy do app atual
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      console.warn("Logout API call failed, continuing with local cleanup");
    } finally {
      localStorage.removeItem("tenant");
      localStorage.removeItem(SIDEBAR_KEY);
      window.location.href = "/login";
    }
  };

  return (
    <aside className={cn(
      mobile
        ? "flex h-full w-full flex-col items-center py-8"
        : "fixed inset-y-0 left-0 z-20 hidden w-20 flex-col items-center py-8 border-r border-slate-200/60 bg-white/80 backdrop-blur-xl sm:flex transition-all duration-300 ease-in-out",
      !mobile && !collapsed ? "lg:w-72" : "",
    )}>
      <div className="flex items-center gap-3 px-6 mb-12 w-full">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#A3D154] shadow-lg shadow-[#A3D154]/20 flex-shrink-0">
          <span className="text-white font-bold text-xl">E</span>
          <div className="absolute inset-0 bg-white/20 rounded-xl animate-pulse" />
        </div>
        <span className={cn("text-2xl font-bold tracking-tight text-slate-800 whitespace-nowrap transition-opacity duration-200", collapsed ? "hidden" : mobile ? "block" : "hidden lg:block")}>
          Portal CEF
        </span>
        <Button
          variant="ghost"
          size="icon"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className={cn("text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl h-8 w-8 flex-shrink-0 transition-opacity duration-200", collapsed ? "hidden" : "hidden lg:flex ml-auto")}
          onClick={onToggle}
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      {collapsed && (
        <div className="hidden lg:flex w-full px-4 mb-4 justify-center">
          <Button
            variant="ghost"
            size="icon"
            title="Expandir menu"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl h-8 w-8"
            onClick={onToggle}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </Button>
        </div>
      )}

      <nav className="flex flex-col gap-2 w-full px-4 flex-1 overflow-y-auto py-4">
        {visibleMenuItems.map((item) => (
          <div key={item.key} className="relative">
            <SidebarItem
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={activePage === (item.activePage as ActivePage)}
              collapsed={collapsed}
              onNavigate={onNavigate ?? onCollapse}
              mobile={mobile}
            />
            {item.key === "tarefas" && tarefasBadge && !collapsed && !mobile && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:block">
                {tarefasBadge}
              </div>
            )}
            {item.key === "suporte" && suporteBadge && !collapsed && !mobile && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:block">
                {suporteBadge}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4 w-full px-6 py-6 border-t border-slate-100/50">
        <div className={cn("flex-col gap-1", collapsed ? "hidden" : mobile ? "flex" : "hidden lg:flex")}>
          <p className="text-sm font-bold text-slate-800">
            {name || "Usuário"}
          </p>
          <p className="text-xs text-slate-500 font-medium capitalize">
            {role.replace("_", " ")}
          </p>
        </div>

        <ChangePasswordDialog
          open={isPasswordDialogOpen}
          onOpenChange={setIsPasswordDialogOpen}
        />

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            title="Acessar Suporte"
            className="flex-1 justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl h-10 px-0"
            onClick={handleGoToSupport}
          >
            <Headset className="w-5 h-5 flex-shrink-0" />
          </Button>

          <Button
            variant="ghost"
            title="Alterar Senha"
            className="flex-1 justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl h-10 px-0"
            onClick={() => setIsPasswordDialogOpen(true)}
          >
            <Lock className="w-5 h-5 flex-shrink-0" />
          </Button>

          <Button
            variant="ghost"
            title="Sair da Conta"
            className="flex-1 justify-center text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl h-10 px-0"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@essencia/ui/components/dialog";
import { Input } from "@essencia/ui/components/input";
import { Lock } from "lucide-react";
import { toast } from "@essencia/ui/components/toaster";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@essencia/ui/components/form";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual obrigatória"),
  newPassword: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof passwordSchema>) => {
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Erro ao alterar senha");
      }

      toast.success("Sucesso", {
        description: "Senha alterada com sucesso!",
      });

      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error("Erro", {
        description: error instanceof Error ? error.message : "Erro ao alterar senha",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Alterar Senha</DialogTitle>
          <DialogDescription>
            Crie uma nova senha para acessar sua conta.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha Atual</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova Senha</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Nova Senha</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
