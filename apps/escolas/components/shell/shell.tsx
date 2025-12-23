"use client";

import { MasterSidebar } from "./master-sidebar";
import { TopBar } from "./top-bar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans selection:bg-slate-900/20">
      <MasterSidebar />
      <div className="flex-1 sm:pl-20 lg:pl-72 flex flex-col min-h-screen relative overflow-hidden">
        {/* Background Elements - Different color scheme for Master (Slate/Blueish) */}
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-slate-200/40 to-slate-100/10 rounded-full blur-3xl pointer-events-none opacity-60"></div>

        <TopBar />

        <main className="flex-1 p-8 lg:p-12 space-y-12 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
