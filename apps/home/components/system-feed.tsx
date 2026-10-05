import {
  Card,
  CardContent,
  CardHeader,
} from "@essencia/ui/components/card";

interface SystemFeedProps {
  titleId?: string;
}

export function SystemFeed({ titleId = "atividades-titulo" }: SystemFeedProps) {
  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <h2
          id={titleId}
          className="text-lg font-bold text-slate-800 flex items-center justify-between"
        >
          <span>Atividades Recentes</span>
          <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            Hoje
          </span>
        </h2>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          Nenhuma atividade recente.
        </div>
      </CardContent>
    </Card>
  );
}
