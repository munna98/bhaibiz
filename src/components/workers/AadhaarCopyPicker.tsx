import { useState, useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  FileUp,
  FileImage,
  Trash2,
  ZoomIn,
} from "lucide-react";

export interface AadhaarCopyPickerProps {
  file: File | null;
  onChange: (file: File | null) => void;
  className?: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AadhaarCopyPicker({ file, onChange, className }: AadhaarCopyPickerProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [enlargeOpen, setEnlargeOpen] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function handleFile(f: File | null | undefined) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error(t("File is larger than 5 MB"));
      return;
    }
    const isImage = f.type.startsWith("image/");
    if (!isImage) {
      toast.error(t("Upload a photo of the Aadhaar card."));
      return;
    }
    onChange(f);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    handleFile(f);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        data-testid="aadhaar-copy-input"
        onChange={onInputChange}
      />

      {!file || !previewUrl ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          data-testid="aadhaar-copy-dropzone"
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-all",
            isDragging
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-muted hover:border-primary/50 hover:bg-muted/40",
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <FileUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{t("Upload Aadhaar copy")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("Photo, up to 5 MB")}</p>
          </div>
        </div>
      ) : (
        <div
          data-testid="aadhaar-copy-preview-card"
          className="overflow-hidden rounded-xl border bg-card shadow-xs"
        >
          {/* Visual Image Preview Area */}
          <div className="group relative flex max-h-72 min-h-48 w-full items-center justify-center bg-muted/20 p-2">
            <img
              src={previewUrl}
              alt={t("Aadhaar copy preview")}
              className="max-h-64 max-w-full rounded-md object-contain cursor-pointer transition-opacity group-hover:opacity-95"
              onClick={() => setEnlargeOpen(true)}
            />
            <button
              type="button"
              onClick={() => setEnlargeOpen(true)}
              className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-background/85 px-2 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-xs transition hover:bg-background"
              title={t("View full preview")}
            >
              <ZoomIn className="h-3.5 w-3.5" />
              <span>{t("Enlarge preview")}</span>
            </button>
          </div>

          {/* Action & Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 p-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileImage className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{file.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-2.5 text-xs"
                onClick={() => inputRef.current?.click()}
              >
                {t("Change")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onChange(null)}
                title={t("Remove")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">{t("Remove")}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Dialog for Image Inspection */}
      {previewUrl && (
        <Dialog open={enlargeOpen} onOpenChange={setEnlargeOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="truncate text-base font-medium">
                {file?.name ?? t("Aadhaar copy preview")}
              </DialogTitle>
            </DialogHeader>
            <div className="relative flex-1 overflow-auto rounded-lg bg-muted/30 p-2 flex items-center justify-center">
              <img
                src={previewUrl}
                alt={t("Aadhaar copy preview")}
                className="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
