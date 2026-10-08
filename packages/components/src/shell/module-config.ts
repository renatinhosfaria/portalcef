import {
  BookOpen,
  Calendar,
  CheckSquare,
  ClipboardList,
  GraduationCap,
  Headset,
  HeartHandshake,
  LayoutDashboard,
  School,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";

export const MODULE_ACCESS_RULES = {
  home: "ALL",
  usuarios: ["master", "diretora_geral", "gerente_unidade", "gerente_financeiro"],
  escolas: ["master"],
  turmas: ["master", "diretora_geral", "gerente_unidade", "gerente_financeiro"],
  planejamento: "ALL",
  calendario: "ALL",
  eventos: [
    "master",
    "diretora_geral",
    "gerente_unidade",
    "auxiliar_administrativo",
  ],
  tarefas: [
    "master",
    "diretora_geral",
    "gerente_unidade",
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "analista_pedagogico",
    "professora",
    "auxiliar_sala",
  ],
  workflows: "ALL",
  suporte: "ALL",
  lojaAdmin: [
    "master",
    "diretora_geral",
    "gerente_unidade",
    "gerente_financeiro",
    "auxiliar_administrativo",
  ],
} as const;

export type ModuleKey = keyof typeof MODULE_ACCESS_RULES;

export interface PortalModule {
  key: ModuleKey;
  icon: LucideIcon;
  label: string;
  href: string;
  activePage: string;
}

export const PORTAL_MODULES: readonly PortalModule[] = [
  {
    key: "home",
    icon: LayoutDashboard,
    label: "Visão Geral",
    href: "/",
    activePage: "home",
  },
  {
    key: "usuarios",
    icon: Users,
    label: "Usuários",
    href: "/usuarios",
    activePage: "usuarios",
  },
  {
    key: "escolas",
    icon: School,
    label: "Gestão Escolar",
    href: "/escolas",
    activePage: "escolas",
  },
  {
    key: "turmas",
    icon: GraduationCap,
    label: "Turmas",
    href: "/turmas",
    activePage: "turmas",
  },
  {
    key: "planejamento",
    icon: BookOpen,
    label: "Planejamento",
    href: "/planejamento",
    activePage: "planejamento",
  },
  {
    key: "calendario",
    icon: Calendar,
    label: "Calendário",
    href: "/calendario",
    activePage: "calendario",
  },
  {
    key: "eventos",
    icon: HeartHandshake,
    label: "Eventos",
    href: "/eventos/inscricoes-evento",
    activePage: "eventos",
  },
  {
    key: "tarefas",
    icon: CheckSquare,
    label: "Tarefas",
    href: "/tarefas",
    activePage: "tarefas",
  },
  {
    key: "workflows",
    icon: ClipboardList,
    label: "Workflows",
    href: "/workflows",
    activePage: "workflows",
  },
  {
    key: "suporte",
    icon: Headset,
    label: "Suporte",
    href: "/suporte",
    activePage: "suporte",
  },
  {
    key: "lojaAdmin",
    icon: ShoppingBag,
    label: "Loja",
    href: "/loja-admin",
    activePage: "loja-admin",
  },
];

export function hasModuleAccess(userRole: string, moduleKey: ModuleKey): boolean {
  const allowedRoles = MODULE_ACCESS_RULES[moduleKey];
  return (
    allowedRoles === "ALL" ||
    (allowedRoles as readonly string[]).includes(userRole)
  );
}
