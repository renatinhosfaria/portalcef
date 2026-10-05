"use client";

import { cn } from "@essencia/ui/lib/utils";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
  onNavigate?: () => void;
}

export function SidebarItem({
  icon: Icon,
  label,
  href,
  active,
  onNavigate,
}: SidebarItemProps) {
  const pathname = usePathname();
  const isActive =
    active !== undefined
      ? active
      : href === "/"
        ? pathname === "/"
        : pathname.startsWith(href);
  const classes = cn(
    "flex items-center gap-4 px-4 py-4 rounded-2xl w-full transition-all duration-200 group relative overflow-hidden text-left",
    isActive
      ? "text-[#A3D154] font-bold bg-[#A3D154]/10"
      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
  );
  const conteudo = (
    <>
      <Icon aria-hidden="true" className="w-5 h-5 relative z-10" />
      <span className="relative z-10">{label}</span>
    </>
  );
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={classes}
      onClick={onNavigate}
    >
      {conteudo}
    </Link>
  );
}
