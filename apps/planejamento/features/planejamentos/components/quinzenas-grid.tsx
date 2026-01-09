import { Quinzena } from "../types";
import { QuinzenaCard } from "./quinzena-card";

interface QuinzenasGridProps {
  quinzenas: Quinzena[];
}

export function QuinzenasGrid({ quinzenas }: QuinzenasGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {quinzenas.map((quinzena) => (
        <QuinzenaCard key={quinzena.id} quinzena={quinzena} />
      ))}
    </div>
  );
}
