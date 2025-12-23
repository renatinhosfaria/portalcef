"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { cn } from "@essencia/ui/lib/utils";
import { motion, type Variants } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Clock,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function Home() {
  const [isMaster, setIsMaster] = useState(false);
  const [tenantPayload, setTenantPayload] = useState<string | null>(null);
  const [userName, setUserName] = useState("Usuário");
  const [userRole, setUserRole] = useState("Cargo");

  useEffect(() => {
    // 1. Try to hydrate from URL (Cross-Port Handoff)
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get("data");

    if (dataParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(dataParam));
        localStorage.setItem("tenant", JSON.stringify(decoded));
        setTenantPayload(dataParam);

        // Clean URL
        window.history.replaceState({}, document.title, "/");

        // Update local state immediately
        const role = decoded.role?.toLowerCase();
        setUserName(decoded.name || "Usuário");
        setUserRole(decoded.role || "Cargo");
        if (role === "master" || role === "admin" || role === "administrador") {
          setIsMaster(true);
        }
      } catch (e) {
        console.error("Failed to hydrate tenant data", e);
      }
    } else {
      // 2. Fallback to existing localStorage
      const stored = localStorage.getItem("tenant");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setTenantPayload(encodeURIComponent(JSON.stringify(parsed)));
          const role = parsed.role?.toLowerCase();
          setUserName(parsed.name || "Usuário");
          setUserRole(parsed.role || "Cargo");
          if (
            role === "master" ||
            role === "admin" ||
            role === "administrador"
          ) {
            setIsMaster(true);
          }
        } catch (e) {
          console.error("Error parsing tenant info", e);
        }
      }
    }
  }, []);

  const usuariosHref = tenantPayload
    ? `http://localhost:3004?data=${tenantPayload}`
    : "http://localhost:3004";
  const escolasHref = tenantPayload
    ? `http://localhost:3005?data=${tenantPayload}`
    : "http://localhost:3005";

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans selection:bg-primary/20">
      {/* Premium Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-20 flex-col items-center py-8 border-r border-slate-200/60 bg-white/80 backdrop-blur-xl sm:flex lg:w-72 transition-all duration-500 ease-in-out">
        <div className="flex items-center gap-3 px-6 mb-12 w-full">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#A3D154] shadow-lg shadow-[#A3D154]/20">
            <span className="text-white font-bold text-xl">E</span>
            <div className="absolute inset-0 bg-white/20 rounded-xl animate-pulse"></div>
          </div>
          <span className="hidden lg:block text-2xl font-bold tracking-tight text-slate-800">
            Essência
          </span>
        </div>

        <nav className="flex flex-col gap-2 w-full px-4">
          <SidebarItem icon={LayoutDashboard} label="Visão Geral" active />
          <SidebarItem icon={Users} label="Usuários" href={usuariosHref} />
          {isMaster && (
            <SidebarItem
              icon={School}
              label="Gestão Escolar"
              href={escolasHref}
            />
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-4 w-full px-6">
          <div className="flex items-center gap-3 px-2 mb-2">
            <div className="hidden lg:block overflow-hidden">
              <p className="text-base font-bold text-slate-800 truncate">
                {userName}
              </p>
              <p className="text-sm text-slate-500 font-medium truncate">
                {userRole}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl py-6"
            onClick={() => {
              localStorage.removeItem("tenant");
              window.location.href = "http://localhost:3003";
            }}
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden lg:block font-medium">Sair</span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 sm:pl-20 lg:pl-72 flex flex-col min-h-screen relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-[#A3D154]/20 to-[#A3D154]/5 rounded-full blur-3xl pointer-events-none opacity-60"></div>
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-orange-400/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between px-8 bg-white/50 backdrop-blur-md border-b border-white/20">
          <div className="flex items-center gap-4 lg:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6 text-slate-600" />
            </Button>
          </div>

          <div className="flex-1 max-w-xl hidden md:block">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Buscar em tudo..."
                className="w-full h-11 pl-12 pr-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-sm text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors">
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-8 lg:p-12 space-y-12">
          {/* Hero Section */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div>
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                Olá, Renato 👋
              </h1>
              <p className="text-lg text-slate-500 max-w-2xl text-balance">
                Bem-vindo ao seu painel de controle. Aqui está o que está
                acontecendo na sua instituição hoje.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button className="bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:shadow-md h-11 rounded-xl px-6 font-medium">
                Exportar Relatório
              </Button>
              <Button className="bg-[#1e293b] text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-[1.02] transition-all h-11 rounded-xl px-6 font-medium">
                <Sparkles className="w-4 h-4 mr-2" />
                Nova Ação
              </Button>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <StatsCard
              title="Receita Total"
              value="R$ 128.4k"
              trend="+12.5%"
              trendUp={true}
              icon={Zap}
              color="text-amber-500"
              bg="bg-amber-500/10"
            />
            <StatsCard
              title="Alunos Ativos"
              value="1,245"
              trend="+4.2%"
              trendUp={true}
              icon={User}
              color="text-[#A3D154]"
              bg="bg-[#A3D154]/10"
            />
            <StatsCard
              title="Pendências"
              value="23"
              trend="-2.1%"
              trendUp={false}
              icon={Activity}
              color="text-rose-500"
              bg="bg-rose-500/10"
            />
            <StatsCard
              title="Engajamento"
              value="94.2%"
              trend="+1.2%"
              trendUp={true}
              icon={TrendingUp}
              color="text-orange-500"
              bg="bg-orange-500/10"
            />
          </motion.div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Action Area */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="lg:col-span-2 space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <BigActionCard
                  title="Cadastro Rápido"
                  desc="Adicionar novo aluno ou funcionário"
                  color="from-[#785c18] to-[#A3D154]"
                />
                <BigActionCard
                  title="Lançamento Financeiro"
                  desc="Registrar entrada ou saída"
                  color="from-orange-500 to-amber-500"
                />
              </div>

              <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100/60 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-800">
                      Desempenho Semestral
                    </CardTitle>
                    <select className="bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg px-3 py-1 cursor-pointer focus:ring-0">
                      <option>Últimos 6 meses</option>
                      <option>Este Ano</option>
                    </select>
                  </div>
                </CardHeader>
                <CardContent className="h-[300px] flex items-end justify-between gap-4 p-8 pt-12 relative">
                  {/* Decorative Background for Chart */}
                  <div className="absolute inset-x-0 bottom-0 top-12 bg-gradient-to-t from-slate-50/50 to-transparent pointer-events-none"></div>

                  {[35, 55, 45, 70, 60, 85, 95].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{
                        duration: 1,
                        delay: 0.5 + i * 0.1,
                        ease: "backOut",
                      }}
                      className="w-full bg-gradient-to-t from-slate-900 to-[#785c18] rounded-t-2xl relative group cursor-pointer hover:from-[#A3D154] hover:to-lime-500 transition-all duration-300 shadow-lg shadow-slate-900/10 hover:shadow-[#A3D154]/20"
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold py-1 px-3 rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                        {h}%
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Side Feed */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/40 p-6 shadow-xl shadow-orange-100/20"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-lg text-slate-800">
                  Linha do Tempo
                </h3>
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors">
                  <Clock className="w-4 h-4 text-slate-500" />
                </div>
              </div>

              <div className="space-y-8 relative before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-slate-200">
                <TimelineItem
                  time="10:30"
                  title="Novo Login Detectado"
                  desc="Acesso via IP desconhecido bloqueado."
                  type="alert"
                />
                <TimelineItem
                  time="09:15"
                  title="Pagamento Recebido"
                  desc="Mensalidade de Março confirmada."
                  type="success"
                />
                <TimelineItem
                  time="08:00"
                  title="Backup Realizado"
                  desc="Cópia de segurança do banco de dados."
                  type="neutral"
                />
                <TimelineItem
                  time="Ontem"
                  title="Atualização de Sistema"
                  desc="Versão 2.4.0 instalada com sucesso."
                  type="neutral"
                />
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Sub Components
type SidebarItemProps = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  href?: string;
};

type StatsCardProps = {
  title: string;
  value: string;
  trend?: string;
  trendUp: boolean;
  icon: LucideIcon;
  color: string;
  bg: string;
};

type BigActionCardProps = {
  title: string;
  desc: string;
  color: string;
};

type TimelineItemType = "alert" | "success" | "neutral";

type TimelineItemProps = {
  time: string;
  title: string;
  desc: string;
  type: TimelineItemType;
};

function SidebarItem({
  icon: Icon,
  label,
  active = false,
  href,
}: SidebarItemProps) {
  const content = (
    <>
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#A3D154] rounded-r-full"></div>
      )}
      <Icon className="w-5 h-5 relative z-10" />
      <span className="hidden lg:block relative z-10">{label}</span>
    </>
  );

  const className = cn(
    "flex items-center gap-4 px-4 py-4 rounded-2xl w-full transition-all duration-200 group relative overflow-hidden text-left",
    active
      ? "text-[#A3D154] font-semibold bg-[#A3D154]/10"
      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <button className={className}>{content}</button>;
}

function StatsCard({
  title,
  value,
  trend,
  trendUp,
  icon: Icon,
  color,
  bg,
}: StatsCardProps) {
  return (
    <motion.div
      variants={fadeIn}
      className="bg-white/80 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-lg shadow-slate-200/40 hover:scale-[1.02] transition-transform duration-300 cursor-default group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-2xl transition-colors", bg)}>
          <Icon className={cn("w-6 h-6", color)} />
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
              trendUp
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700",
            )}
          >
            {trendUp ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowUpRight className="w-3 h-3 rotate-90" />
            )}
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight group-hover:text-primary transition-colors">
          {value}
        </h3>
      </div>
    </motion.div>
  );
}

function BigActionCard({ title, desc, color }: BigActionCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 text-white cursor-pointer shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] bg-gradient-to-br",
        color,
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-4 backdrop-blur-sm">
          <Sparkles className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm text-white/80">{desc}</p>
      </div>
    </div>
  );
}

function TimelineItem({ time, title, desc, type }: TimelineItemProps) {
  const colors = {
    alert: "bg-rose-500 shadow-rose-200",
    success: "bg-emerald-500 shadow-emerald-200",
    neutral: "bg-slate-400 shadow-slate-200",
  };

  return (
    <div className="relative pl-8 group">
      <div
        className={cn(
          "absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white shadow-lg z-10",
          colors[type as keyof typeof colors],
        )}
      ></div>
      <span className="text-xs font-semibold text-slate-400 mb-1 block">
        {time}
      </span>
      <h4 className="font-bold text-slate-800 text-sm group-hover:text-[#A3D154] transition-colors">
        {title}
      </h4>
      <p className="text-sm text-slate-500 leading-snug">{desc}</p>
    </div>
  );
}
