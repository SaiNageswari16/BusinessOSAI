import { TrendingUp, ShoppingCart, Boxes, Tags, Users, Activity, Building2, BrainCircuit, Wallet, Search, Map, Globe, Database, HardDrive, LineChart } from "lucide-react";
export const getKpiIcon = (iconName: string) => {
  switch (iconName) {
    case "trending-up": return TrendingUp;
    case "shopping-cart": return ShoppingCart;
    case "boxes": return Boxes;
    case "percent": return Tags;
    case "users": return Users;
    case "activity": return Activity;
    case "building": return Building2;
    case "brain": return BrainCircuit;
    case "wallet": return Wallet;
    case "search": return Search;
    case "map": return Map;
    case "globe": return Globe;
    case "database": return Database;
    case "drive": return HardDrive;
    case "line-chart": return LineChart;
    default: return Activity;
  }
};
