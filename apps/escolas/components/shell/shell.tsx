"use client";

import { useState } from "react";

import { MasterSidebar } from "./master-sidebar";
import { TopBar } from "./top-bar";

export function Shell({ children }: { children: React.ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);
  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans selection:bg-slate-900/20">
      <MasterSidebar
        abertoNoMobile={menuAberto}
        onFecharMobile={() => setMenuAberto(false)}
      />
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-slate-200/40 to-slate-100/10 rounded-full blur-3xl pointer-events-none opacity-60" />
        <TopBar onAbrirMenu={() => setMenuAberto(true)} />
        <main className="flex-1 p-8 lg:p-12 space-y-12 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
