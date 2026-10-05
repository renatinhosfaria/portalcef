"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";

export function SystemFeed() {
  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-slate-800 flex items-center justify-between">
          <span>Atividades Recentes</span>
          <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            Hoje
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          Nenhuma atividade recente.
        </div>
      </CardContent>
    </Card>
  );
}
