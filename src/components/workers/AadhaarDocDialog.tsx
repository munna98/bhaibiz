import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/workers";
import { useT } from "@/lib/i18n";

export interface AadhaarDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null | undefined;
  fileName?: string | null | undefined;
  uploadedAt?: string | null | undefined;
  workerName?: string | null | undefined;
  workerCode?: string | null | undefined;
}

export function AadhaarDocDialog({
  open,
  onOpenChange,
  url,
  fileName,
  uploadedAt,
  workerName,
  workerCode,
}: AadhaarDocDialogProps) {
  const t = useT();

  if (!url) return null;

  const title = fileName || t("Aadhaar copy");
  const isPdf = Boolean(
    fileName?.toLowerCase().endsWith(".pdf") ||
    url.toLowerCase().split("?")[0]?.endsWith(".pdf")
  );

  const subtitle = [
    workerCode,
    uploadedAt ? formatDate(uploadedAt) : null,
  ].filter(Boolean).join(" · ");

  async function handleDownload() {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;

      const baseName = fileName || "aadhaar-copy";
      const downloadName = workerCode
        ? `${workerCode}-${baseName}`
        : (workerName ? `${workerName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${baseName}` : baseName);
      a.download = downloadName;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col overflow-hidden p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader className="pr-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-lg font-semibold">
                {title}
              </DialogTitle>
              {subtitle ? (
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  {subtitle}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{title}</DialogDescription>
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
          {isPdf ? (
            <iframe
              src={url}
              className="h-[70vh] w-full rounded-md border-0 bg-white"
              title={title}
            />
          ) : (
            <img
              src={url}
              alt={title}
              className="max-h-[70vh] w-auto max-w-full rounded-md object-contain shadow-sm"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
