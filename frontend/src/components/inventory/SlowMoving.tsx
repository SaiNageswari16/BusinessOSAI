import { useI18n } from "@/contexts/i18n-context";
import { Snail } from "lucide-react";
export function SlowMoving() {
  const { t } = useI18n(); return <div className="p-6"><h2 className="text-2xl font-bold tracking-tight text-foreground">{t("Slow Moving Inventory", "Slow Moving Inventory")}</h2></div>; }
