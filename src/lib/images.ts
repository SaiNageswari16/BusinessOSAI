import catBeverages from "@/assets/cat-beverages.jpg";
import catDesserts from "@/assets/cat-desserts.jpg";
import catMains from "@/assets/cat-mains.jpg";
import catStarters from "@/assets/cat-starters.jpg";
import dishBiryani from "@/assets/dish-biryani.jpg";
import dishButterChicken from "@/assets/dish-butter-chicken.jpg";
import dishChickenTikka from "@/assets/dish-chicken-tikka.jpg";
import dishChilliChicken from "@/assets/dish-chilli-chicken.jpg";
import dishDalMakhani from "@/assets/dish-dal-makhani.jpg";
import dishDalTadka from "@/assets/dish-dal-tadka.jpg";
import dishFishFry from "@/assets/dish-fish-fry.jpg";
import dishGarlicNaan from "@/assets/dish-garlic-naan.jpg";
import dishHaraBhara from "@/assets/dish-hara-bhara.jpg";
import dishKadaiPaneer from "@/assets/dish-kadai-paneer.jpg";
import dishMasalaDosa from "@/assets/dish-masala-dosa.jpg";
import dishMixedVeg from "@/assets/dish-mixed-veg.jpg";
import dishMuttonRogan from "@/assets/dish-mutton-rogan.jpg";
import dishPaneer65 from "@/assets/dish-paneer-65.jpg";
import dishPaneerTikka from "@/assets/dish-paneer-tikka.jpg";
import dishVegManchurian from "@/assets/dish-veg-manchurian.jpg";
import posHeroBiryani from "@/assets/pos-hero-biryani.jpg";

export { posHeroBiryani };

export const CATEGORY_IMAGES: Record<string, string> = {
  Bestsellers: dishBiryani,
  Starters: dishPaneerTikka,
  Soups: dishDalTadka,
  "Main Course": dishButterChicken,
  Curries: dishButterChicken,
  "Biryani & Rice": dishBiryani,
  Biryani: dishBiryani,
  "Indian Breads": dishGarlicNaan,
  Breads: dishGarlicNaan,
  Chinese: dishVegManchurian,
  Continental: dishMasalaDosa,
  Tandoor: dishChickenTikka,
  Desserts: catDesserts,
  Beverages: catBeverages,
  Combos: catMains,
};

export const DISH_IMAGES_BY_NAME: Record<string, string> = {
  "Hyderabadi Chicken Biryani": dishBiryani,
  "Hyderabadi Chicken Dum Biryani": dishBiryani,
  "Chicken Biryani": dishButterChicken,
  "Mutton Dum Biryani": dishBiryani,
  "Veg Dum Biryani": dishBiryani,
  "Paneer Biryani": dishBiryani,
  "Egg Biryani": dishBiryani,
  "Prawn Biryani": dishBiryani,
  "Paneer Tikka": dishPaneerTikka,
  "Achari Paneer Tikka": dishPaneerTikka,
  "Butter Chicken": dishButterChicken,
  "Chicken Curry": dishButterChicken,
  "Chicken Chettinad": dishButterChicken,
  "Paneer Butter Masala": dishButterChicken,
  "Dal Makhani": dishDalMakhani,
  "Dal Tadka": dishDalTadka,
  "Mirchi ka Salan": dishDalTadka,
  "Garlic Naan": dishGarlicNaan,
  "Butter Naan": dishGarlicNaan,
  "Tandoori Roti": dishGarlicNaan,
  "Lachha Paratha": dishGarlicNaan,
  "Cheese Naan": dishGarlicNaan,
  "Masala Dosa": dishMasalaDosa,
  "Chicken Tikka": dishChickenTikka,
  "Tandoori Chicken (Half)": dishChickenTikka,
  "Malai Kebab": dishHaraBhara,
  "Seekh Kebab": dishMuttonRogan,
  "Tandoori Aloo": dishPaneerTikka,
  "Paneer 65": dishPaneer65,
  "Chicken 65": dishPaneer65,
  "Gobi 65": dishPaneer65,
  "Hara Bhara Kebab": dishHaraBhara,
  "Fish Fry": dishFishFry,
  "Apollo Fish": dishFishFry,
  "Prawns Koliwada": dishFishFry,
  "Veg Manchurian": dishVegManchurian,
  "Chilli Chicken": dishChilliChicken,
  "Kadai Paneer": dishKadaiPaneer,
  "Palak Paneer": dishHaraBhara,
  "Mutton Rogan Josh": dishMuttonRogan,
  "Mixed Veg Curry": dishMixedVeg,
};

export function getCategoryImage(category: string): string {
  return CATEGORY_IMAGES[category] ?? catMains;
}

export function getDishImage(name: string, category?: string): string {
  const direct = DISH_IMAGES_BY_NAME[name];
  if (direct) return direct;
  const lower = name.toLowerCase();
  if (lower.includes("biryani")) return dishBiryani;
  if (lower.includes("naan") || lower.includes("roti") || lower.includes("paratha"))
    return dishGarlicNaan;
  if (lower.includes("dal") || lower.includes("soup")) return dishDalMakhani;
  if (lower.includes("dosa")) return dishMasalaDosa;
  if (lower.includes("fish") || lower.includes("prawn")) return dishFishFry;
  if (lower.includes("manchurian") || lower.includes("noodle")) return dishVegManchurian;
  if (lower.includes("chilli")) return dishChilliChicken;
  if (lower.includes("mutton") || lower.includes("rogan") || lower.includes("seekh"))
    return dishMuttonRogan;
  if (lower.includes("kadai")) return dishKadaiPaneer;
  if (lower.includes("tikka") || lower.includes("65")) return dishPaneerTikka;
  if (lower.includes("kebab") || lower.includes("palak")) return dishHaraBhara;
  if (lower.includes("curry") || lower.includes("masala") || lower.includes("butter"))
    return dishButterChicken;
  if (category === "Desserts") return catDesserts;
  if (category === "Beverages") return catBeverages;
  if (category === "Starters") return catStarters;
  return getCategoryImage(category ?? "Main Course");
}
