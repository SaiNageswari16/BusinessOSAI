import { useI18n } from "@/contexts/i18n-context";
import { PieChart } from "lucide-react";
export function AbcAnalysis() {
  const { t } = useI18n(); return <div className="p-6"><h2 className="text-2xl font-bold tracking-tight text-foreground">{t("ABC Analysis", "ABC Analysis")}</h2><p className="mt-4 text-muted-foreground">{t("Inventory classification based on consumption value.", "Inventory classification based on consumption value.")}</p></div>; }
