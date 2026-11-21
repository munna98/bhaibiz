import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

  async function handleDownload() {
    if (!photoUrl) return;
    try {
      const res = await fetch(photoUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const safeName = (workerCode ? `${workerCode}-${workerName}` : workerName)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      a.download = `${safeName || "worker"}-photo.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(photoUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col overflow-hidden p-4 sm:max-w-lg sm:p-6">
        <DialogHeader className="pr-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-lg font-semibold capitalize">
                {workerName}
              </DialogTitle>
              {workerCode ? (
                <DialogDescription className="text-xs font-mono text-muted-foreground">
                  {workerCode}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{workerName}</DialogDescription>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={handleDownload}
              title={t("Download photo")}
              aria-label={t("Download photo")}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
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

