import React from "react";

export default function LoadingEvento(): React.JSX.Element {
  return <div className="content-width animate-pulse py-6 md:py-10"><div className="overflow-hidden rounded-3xl bg-[var(--tinta)] p-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] md:gap-8 md:p-10"><div className="space-y-4"><div className="h-3 w-24 rounded bg-white/20" /><div className="h-12 max-w-md rounded bg-white/20" /><div className="h-5 max-w-sm rounded bg-white/20" /><div className="h-5 max-w-lg rounded bg-white/20" /></div><div className="mt-6 aspect-[16/9] rounded-2xl bg-white/10 md:mt-0" /></div><div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]"><div className="h-96 rounded-2xl bg-[var(--surface-muted)]" /><div className="h-80 rounded-2xl bg-[var(--surface-muted)]" /></div></div>;
}
