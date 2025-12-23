"use client";

import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans selection:bg-[#A3D154]/20">
      <AppSidebar />
      <div className="flex-1 sm:pl-20 lg:pl-72 flex flex-col min-h-screen relative overflow-hidden">
        {/* Abstract Background Elements (Shared with Home) */}
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-[#A3D154]/20 to-[#A3D154]/5 rounded-full blur-3xl pointer-events-none opacity-60"></div>
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-orange-400/5 rounded-full blur-3xl pointer-events-none"></div>

        <TopBar />

        <main className="flex-1 p-8 lg:p-12 space-y-12 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
