import { useI18n } from "@/contexts/i18n-context";
import { Skull } from "lucide-react";
export function DeadStock() {
  const { t } = useI18n(); return <div className="p-6"><h2 className="text-2xl font-bold tracking-tight text-foreground">{t("Dead Stock", "Dead Stock")}</h2></div>; }
