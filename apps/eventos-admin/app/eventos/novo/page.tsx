import { EventoDraftForm } from "@/features/eventos/evento-draft-form";
export default function NovoEventoPage() { return <section className="space-y-6"><h1 className="text-2xl font-semibold">Novo evento</h1><p className="text-sm text-slate-600">Comece pelo título; o rascunho será criado uma única vez.</p><EventoDraftForm /></section>; }
