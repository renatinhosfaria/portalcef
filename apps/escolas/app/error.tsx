"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-3xl bg-white p-10 text-center shadow-sm"
    >
      <h2 className="text-2xl font-bold text-slate-900">
        Não foi possível carregar esta página
      </h2>
      <p className="mt-2 text-slate-500">
        Tente novamente em alguns instantes.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
      >
        Tentar novamente
      </button>
    </div>
  );
}
