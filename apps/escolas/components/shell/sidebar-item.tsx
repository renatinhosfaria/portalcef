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
}

export function SidebarItem({
  icon: Icon,
  label,
  href,
  active,
}: SidebarItemProps) {
  const pathname = usePathname();
  // Simple active check: exact match or starts with href (if not root)
  const isActive =
    active !== undefined
      ? active
      : href === "/"
        ? pathname === "/"
        : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-4 px-4 py-4 rounded-2xl w-full transition-all duration-200 group relative overflow-hidden text-left",
        isActive
          ? "text-[#A3D154] font-bold bg-[#A3D154]/10"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#A3D154] rounded-r-full" />
      )}
      <Icon className="w-5 h-5 relative z-10" />
      <span className="hidden lg:block relative z-10">{label}</span>
    </Link>
  );
}
