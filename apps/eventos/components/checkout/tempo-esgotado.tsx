import React from "react";

export function TempoEsgotado({ href }: { href: string }): React.JSX.Element {
  return <section role="alert" className="rounded-2xl border border-[#f3d28b] bg-[#fff8e8] p-6 text-center"><h1 className="font-display text-2xl font-semibold text-[#7a5200]">O tempo acabou e os lugares foram liberados</h1><a href={href} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#3f6f12] px-4 py-2 font-semibold text-white">Escolher lugares de novo</a></section>;
}
