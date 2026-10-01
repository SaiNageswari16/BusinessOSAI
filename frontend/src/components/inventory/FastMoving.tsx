import { useI18n } from "@/contexts/i18n-context";
import { Rocket } from "lucide-react";
export function FastMoving() {
  const { t } = useI18n(); return <div className="p-6"><h2 className="text-2xl font-bold tracking-tight text-foreground">{t("Fast Moving Inventory", "Fast Moving Inventory")}</h2></div>; }
