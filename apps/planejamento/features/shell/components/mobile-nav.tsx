import { Home, List, PlusCircle } from "lucide-react";
import Link from "next/link";

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t bg-background/80 backdrop-blur-lg md:hidden">
      <Link
        href="/"
        className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
      >
        <Home className="h-6 w-6" />
        <span className="text-xs font-medium">Início</span>
      </Link>

      <Link
        href="/planejamentos/novo"
        className="flex flex-col items-center justify-center gap-1 text-primary hover:text-primary/80 transition-colors"
      >
        <PlusCircle className="h-8 w-8" />
        <span className="text-xs font-medium">Novo</span>
      </Link>

      <Link
        href="/planejamentos"
        className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
      >
        <List className="h-6 w-6" />
        <span className="text-xs font-medium">Lista</span>
      </Link>
    </nav>
  );
}
