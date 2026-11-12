import { useLanguage, type Language } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function LanguageSelect({ className }: { className?: string } = {}) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <Select value={language} onValueChange={value => setLanguage(value as Language)}>
      <SelectTrigger aria-label={t("Language")} className={cn("w-32 sm:w-36", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="ml">മലയാളം</SelectItem>
      </SelectContent>
    </Select>
  );
}
