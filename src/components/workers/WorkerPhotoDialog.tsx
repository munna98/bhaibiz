import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";

export interface WorkerPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string | null | undefined;
  workerName: string;
  workerCode?: string | null | undefined;
}

export function WorkerPhotoDialog({
  open,
  onOpenChange,
  photoUrl,
  workerName,
  workerCode,
}: WorkerPhotoDialogProps) {
  const t = useT();

  if (!photoUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col overflow-hidden p-4 sm:max-w-lg sm:p-6">
        <DialogHeader className="pr-6">
          <DialogTitle className="truncate text-lg font-semibold capitalize">
            {workerName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {workerCode ? `${workerCode} · ${t("Worker photo")}` : t("Worker photo")}
          </DialogDescription>
        </DialogHeader>
        <div className="relative mt-2 flex max-h-[75vh] flex-1 items-center justify-center overflow-auto rounded-lg bg-muted/30 p-2">
          <img
            src={photoUrl}
            alt={workerName}
            className="max-h-[70vh] w-auto max-w-full rounded-md object-contain shadow-sm"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
