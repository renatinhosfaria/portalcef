export default function Loading() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      aria-label="Carregando visão geral"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
    </div>
  );
}
