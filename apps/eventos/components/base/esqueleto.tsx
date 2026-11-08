import React from "react";

export function Esqueleto({ className = "" }: { className?: string }): React.JSX.Element {
  return <div aria-hidden="true" className={`animate-pulse motion-reduce:animate-none rounded-2xl bg-[var(--surface-muted)] ${className}`} />;
}
