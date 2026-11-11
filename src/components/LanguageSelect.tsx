import { useLanguage, type Language } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage();
  return <Select value={language} onValueChange={value => setLanguage(value as Language)}>
    <SelectTrigger aria-label={t("Language")} className="w-36"><SelectValue /></SelectTrigger>
    <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ml">മലയാളം</SelectItem></SelectContent>
  </Select>;
}