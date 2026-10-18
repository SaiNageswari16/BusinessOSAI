import React from "react";
import { useStoreTheme } from "@/contexts/StoreThemeContext";

// Headers
import { NurseryHeader } from "./templates/nursery/NurseryHeader";
import { PharmaHeader } from "./templates/pharma/PharmaHeader";
import { FashionHeader } from "./templates/fashion/FashionHeader";
import { QuickMartHeader } from "./templates/speed_mart/QuickMartHeader";
import { MegaHeader } from "./templates/mega_market/MegaHeader";
import { OrganicHeader } from "./organic/OrganicHeader";

// Footers
import { NurseryFooter } from "./templates/nursery/NurseryFooter";
import { PharmaFooter } from "./templates/pharma/PharmaFooter";
import { FashionFooter } from "./templates/fashion/FashionFooter";
import { QuickMartFooter } from "./templates/speed_mart/QuickMartFooter";
import { MegaFooter } from "./templates/mega_market/MegaFooter";
import { OrganicFooter } from "./organic/OrganicFooter";

// Product Cards
import { NurseryProductCard } from "./templates/nursery/NurseryProductCard";
import { PharmaProductCard } from "./templates/pharma/PharmaProductCard";
import { FashionProductCard } from "./templates/fashion/FashionProductCard";
import { MegaProductCard } from "./templates/mega_market/MegaProductCard";
import { QuickMartProductCard } from "./templates/speed_mart/QuickMartProductCard";
import { OrganicProductCard } from "./organic/OrganicProductCard";

// Hero Sections
import { NurseryHero } from "./templates/nursery/NurseryHero";
import { PharmaHero } from "./templates/pharma/PharmaHero";
import { FashionHero } from "./templates/fashion/FashionHero";
import { MegaHero } from "./templates/mega_market/MegaHero";
import { QuickMartHero } from "./templates/speed_mart/QuickMartHero";

// ── 1. Dynamic Header ────────────────────────────────────────────────────────
interface DynamicStoreHeaderProps {
  onOpenCart: () => void;
  onOpenMenu: () => void;
}

export function DynamicStoreHeader({ onOpenCart, onOpenMenu }: DynamicStoreHeaderProps) {
  const { themeId } = useStoreTheme();

  switch (themeId) {
    case "speed_mart":
      return <QuickMartHeader onOpenCart={onOpenCart} onOpenMenu={onOpenMenu} />;
    case "mega_market":
      return <MegaHeader onOpenCart={onOpenCart} onOpenMenu={onOpenMenu} />;
    case "nursery_botanics":
      return <NurseryHeader onOpenCart={onOpenCart} onOpenMenu={onOpenMenu} />;
    case "pharma_medical":
      return <PharmaHeader onOpenCart={onOpenCart} onOpenMenu={onOpenMenu} />;
    case "fashion_boutique":
      return <FashionHeader onOpenCart={onOpenCart} onOpenMenu={onOpenMenu} />;
    default:
      return <OrganicHeader onOpenCart={onOpenCart} onOpenMenu={onOpenMenu} />;
  }
}

// ── 2. Dynamic Footer ────────────────────────────────────────────────────────
export function DynamicStoreFooter() {
  const { themeId } = useStoreTheme();

  switch (themeId) {
    case "speed_mart":
      return <QuickMartFooter />;
    case "mega_market":
      return <MegaFooter />;
    case "nursery_botanics":
      return <NurseryFooter />;
    case "pharma_medical":
      return <PharmaFooter />;
    case "fashion_boutique":
      return <FashionFooter />;
    default:
      return <OrganicFooter />;
  }
}

// ── 3. Dynamic Product Card ──────────────────────────────────────────────────
interface DynamicProductCardProps {
  product: any;
  className?: string;
}

export function DynamicProductCard({ product, className }: DynamicProductCardProps) {
  const { themeId } = useStoreTheme();

  switch (themeId) {
    case "speed_mart":
      return <QuickMartProductCard product={product} className={className} />;
    case "mega_market":
      return <MegaProductCard product={product} className={className} />;
    case "nursery_botanics":
      return <NurseryProductCard product={product} className={className} />;
    case "pharma_medical":
      return <PharmaProductCard product={product} className={className} />;
    case "fashion_boutique":
      return <FashionProductCard product={product} className={className} />;
    default:
      return <OrganicProductCard product={product} className={className} />;
  }
}

// ── 4. Dynamic Hero Section ──────────────────────────────────────────────────
interface DynamicStoreHeroProps {
  fallbackHero?: React.ReactNode;
}

export function DynamicStoreHero({ fallbackHero }: DynamicStoreHeroProps) {
  const { themeId } = useStoreTheme();

  switch (themeId) {
    case "speed_mart":
      return <QuickMartHero />;
    case "mega_market":
      return <MegaHero />;
    case "nursery_botanics":
      return <NurseryHero />;
    case "pharma_medical":
      return <PharmaHero />;
    case "fashion_boutique":
      return <FashionHero />;
    default:
      return <>{fallbackHero}</>;
  }
}
