import { useRouter } from "@tanstack/react-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
export function PageError() {
  const router = useRouter(); const { reset } = useQueryErrorResetBoundary(); const t = useT();
  return <div role="alert" className="space-y-4 py-8"><p>{t("Unable to load this page.")}</p><Button onClick={() => { reset(); void router.invalidate(); }}>{t("Retry")}</Button></div>;
}
export function PageMissing() { const t = useT(); return <p className="py-8 text-muted-foreground">{t("No records found.")}</p>; }