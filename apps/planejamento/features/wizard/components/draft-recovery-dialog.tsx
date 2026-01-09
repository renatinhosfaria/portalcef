import { Button } from "@essencia/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@essencia/ui/components/dialog";

interface DraftRecoveryDialogProps {
  isOpen: boolean;
  savedAt: Date;
  onRecover: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryDialog({
  isOpen,
  savedAt,
  onRecover,
  onDiscard,
}: DraftRecoveryDialogProps) {
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(savedAt);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDiscard()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recuperar Rascunho?</DialogTitle>
          <DialogDescription>
            Encontramos um planejamento não salvo de {formattedDate}. Deseja
            recuperá-lo?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onDiscard}>
            Descartar
          </Button>
          <Button onClick={onRecover}>Recuperar Rascunho</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
