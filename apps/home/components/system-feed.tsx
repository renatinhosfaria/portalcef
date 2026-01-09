"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { cn } from "@essencia/ui/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  type LucideIcon,
  UserPlus,
} from "lucide-react";

interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  icon: LucideIcon;
  color: string;
}

const activities: Activity[] = [
  {
    id: "1",
    user: "Prof. Ana Silva",
    action: "lançou notas",
    target: "Matemática - 8º Ano B",
    time: "2h atrás",
    icon: FileText,
    color: "bg-blue-500",
  },
  {
    id: "2",
    user: "Secretaria",
    action: "matriculou",
    target: "Novo aluno: Lucas Mendes",
    time: "4h atrás",
    icon: UserPlus,
    color: "bg-emerald-500",
  },
  {
    id: "3",
    user: "Coord. Roberto",
    action: "aprovou",
    target: "Planejamento Semanal (História)",
    time: "5h atrás",
    icon: CheckCircle2,
    color: "bg-violet-500",
  },
  {
    id: "4",
    user: "Sistema",
    action: "publicou",
    target: "Boletins do 1º Bimestre",
    time: "Ontem",
    icon: BookOpen,
    color: "bg-orange-500",
  },
];

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
        <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-slate-100 before:top-2 before:bottom-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="relative pl-10 flex flex-col gap-0.5 group"
            >
              <div
                className={cn(
                  "absolute left-0 top-0 w-10 h-10 rounded-full border-4 border-white flex items-center justify-center z-10 transition-transform group-hover:scale-110",
                  activity.color,
                  "bg-opacity-10",
                )}
              >
                <activity.icon
                  className={cn(
                    "w-4 h-4",
                    activity.color.replace("bg-", "text-"),
                  )}
                />
              </div>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">
                  {activity.user}
                </span>{" "}
                {activity.action}{" "}
                <span className="font-medium text-slate-700">
                  {activity.target}
                </span>
              </p>
              <span className="text-xs text-slate-400 font-medium">
                {activity.time}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
