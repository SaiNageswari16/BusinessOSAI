import { useI18n } from "@/contexts/i18n-context";
import { TrendingUp } from "lucide-react";
export function ReorderPlanning() {
  const { t } = useI18n(); return <div className="p-6"><h2 className="text-2xl font-bold tracking-tight text-foreground">{t("Reorder Planning", "Reorder Planning")}</h2><p className="mt-4 text-muted-foreground">{t("AI suggested purchase orders based on EOQ and Lead Times.", "AI suggested purchase orders based on EOQ and Lead Times.")}</p></div>; }
