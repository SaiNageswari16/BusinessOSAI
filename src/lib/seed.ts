// Seed data file with strict TypeScript checking restored.
import type {
  DiningTable,
  MenuItem,
  Order,
  Kot,
  Customer,
  Reservation,
  Ingredient,
  Supplier,
  PurchaseOrder,
  Staff,
  Settings,
  OrderLine,
  Station,
  Area,
  TableStatus,
  Notice,
  StockMove,
} from "./types";

export const CATEGORIES = [
  "Starters",
  "Tandoor",
  "Curries",
  "Biryani",
  "Breads",
  "Desserts",
  "Beverages",
] as const;
export const MODIFIERS = [
  "Medium Spicy",
  "No Onion",
  "Less spicy",
  "Extra spicy",
  "Jain",
  "Extra gravy",
];
export const ADDONS = [
  { name: "Extra cheese", price: 40 },
  { name: "Butter", price: 20 },
  { name: "Raita", price: 50 },
  { name: "Salan", price: 40 },
];

export const suppliers: Supplier[] = [
  { id: "S1", name: "Deccan Fresh Produce", phone: "+91 98480 11223", category: "Vegetables" },
  { id: "S2", name: "Golconda Meats", phone: "+91 98490 22334", category: "Meat & Poultry" },
  { id: "S3", name: "Amul Dairy Distributors", phone: "+91 98660 33445", category: "Dairy" },
  { id: "S4", name: "Charminar Spices & Grains", phone: "+91 99490 44556", category: "Dry goods" },
  { id: "S5", name: "Hyderabad Beverage Co.", phone: "+91 90000 55667", category: "Beverages" },
];

const ing: [string, string, number, number, number, string][] = [
  ["Basmati rice", "kg", 42, 20, 120, "S4"],
  ["Chicken (curry cut)", "kg", 18, 15, 260, "S2"],
  ["Mutton", "kg", 6, 8, 720, "S2"],
  ["Paneer", "kg", 9, 6, 380, "S3"],
  ["Fresh cream", "L", 7, 5, 220, "S3"],
  ["Butter", "kg", 4, 5, 520, "S3"],
  ["Curd", "kg", 14, 8, 70, "S3"],
  ["Milk", "L", 30, 20, 60, "S3"],
  ["Onion", "kg", 35, 25, 35, "S1"],
  ["Tomato", "kg", 22, 15, 40, "S1"],
  ["Ginger-garlic paste", "kg", 5, 3, 180, "S4"],
  ["Green chilli", "kg", 2, 2, 80, "S1"],
  ["Coriander", "bunch", 18, 20, 10, "S1"],
  ["Mint", "bunch", 12, 10, 12, "S1"],
  ["Capsicum", "kg", 6, 5, 70, "S1"],
  ["Potato", "kg", 25, 15, 30, "S1"],
  ["Maida", "kg", 30, 15, 45, "S4"],
  ["Atta", "kg", 28, 15, 42, "S4"],
  ["Garam masala", "kg", 1.5, 1, 900, "S4"],
  ["Saffron", "g", 18, 10, 300, "S4"],
  ["Cooking oil", "L", 40, 20, 140, "S4"],
  ["Ghee", "kg", 8, 5, 650, "S3"],
  ["Sugar", "kg", 20, 10, 45, "S4"],
  ["Khoya", "kg", 3, 3, 420, "S3"],
  ["Tea leaves", "kg", 3, 2, 480, "S5"],
  ["Coffee beans", "kg", 2, 2, 950, "S5"],
  ["Mango pulp", "L", 10, 6, 160, "S5"],
  ["Lemon", "kg", 4, 3, 90, "S1"],
  ["Soda", "bottle", 60, 48, 20, "S5"],
  ["Eggs", "tray", 6, 4, 180, "S2"],
  ["Prawns", "kg", 3, 4, 780, "S2"],
  ["Fish (Apollo)", "kg", 5, 4, 540, "S2"],
];
export const ingredients: Ingredient[] = ing.map(
  ([name, unit, stock, reorder, cost, supplierId], i) => ({
    id: `I${i + 1}`,
    name,
    unit,
    stock,
    reorder,
    cost,
    supplierId,
  }),
);
const I = (name: string) => ingredients.find((x) => x.name === name)!.id;

type M = [string, string, number, boolean, boolean, Station, string, [string, number][]];
const m: M[] = [
  [
    "Paneer Tikka",
    "Starters",
    280,
    true,
    true,
    "Tandoor",
    "Char-grilled cottage cheese, mint chutney",
    [
      ["Paneer", 0.2],
      ["Capsicum", 0.05],
    ],
  ],
  [
    "Chilli Chicken",
    "Starters",
    280,
    false,
    false,
    "Curry",
    "Wok-tossed spicy chilli chicken with peppers",
    [["Chicken (curry cut)", 0.25]],
  ],
  [
    "Fish Fry",
    "Starters",
    320,
    false,
    false,
    "Curry",
    "Crispy masala tawa fish fillets, curry leaves",
    [["Fish (Apollo)", 0.25]],
  ],
  [
    "Veg Manchurian",
    "Starters",
    220,
    true,
    false,
    "Curry",
    "Indo-Chinese vegetable dumplings",
    [["Capsicum", 0.05]],
  ],
  [
    "Paneer 65",
    "Starters",
    260,
    true,
    false,
    "Curry",
    "Hyderabad's crispy spiced cottage cheese bites",
    [
      ["Paneer", 0.18],
      ["Maida", 0.05],
    ],
  ],
  [
    "Prawns Koliwada",
    "Starters",
    480,
    false,
    false,
    "Curry",
    "Spiced batter-fried prawns",
    [["Prawns", 0.2]],
  ],
  [
    "Hara Bhara Kebab",
    "Starters",
    240,
    true,
    false,
    "Tandoor",
    "Spinach and pea patties",
    [["Potato", 0.1]],
  ],
  [
    "Chicken Tikka",
    "Tandoor",
    300,
    false,
    true,
    "Tandoor",
    "Yoghurt-marinated chicken",
    [
      ["Chicken (curry cut)", 0.25],
      ["Curd", 0.05],
    ],
  ],
  [
    "Tandoori Chicken (Half)",
    "Tandoor",
    420,
    false,
    true,
    "Tandoor",
    "Classic clay-oven chicken",
    [["Chicken (curry cut)", 0.4]],
  ],
  [
    "Malai Kebab",
    "Tandoor",
    400,
    false,
    false,
    "Tandoor",
    "Cream & cheese chicken kebab",
    [
      ["Chicken (curry cut)", 0.25],
      ["Fresh cream", 0.05],
    ],
  ],
  [
    "Seekh Kebab",
    "Tandoor",
    440,
    false,
    false,
    "Tandoor",
    "Minced mutton skewers",
    [["Mutton", 0.2]],
  ],
  [
    "Tandoori Aloo",
    "Tandoor",
    240,
    true,
    false,
    "Tandoor",
    "Stuffed baby potatoes",
    [["Potato", 0.25]],
  ],
  [
    "Achari Paneer Tikka",
    "Tandoor",
    340,
    true,
    false,
    "Tandoor",
    "Pickle-spiced paneer",
    [["Paneer", 0.2]],
  ],
  [
    "Butter Chicken",
    "Curries",
    340,
    false,
    true,
    "Curry",
    "Tomato-butter gravy, smoked chicken",
    [
      ["Chicken (curry cut)", 0.25],
      ["Butter", 0.03],
      ["Fresh cream", 0.05],
    ],
  ],
  [
    "Paneer Butter Masala",
    "Curries",
    300,
    true,
    true,
    "Curry",
    "Rich tomato gravy, cottage cheese",
    [
      ["Paneer", 0.2],
      ["Butter", 0.03],
    ],
  ],
  [
    "Dal Makhani",
    "Curries",
    220,
    true,
    true,
    "Curry",
    "Slow-cooked black lentils",
    [
      ["Butter", 0.02],
      ["Fresh cream", 0.03],
    ],
  ],
  [
    "Mutton Rogan Josh",
    "Curries",
    380,
    false,
    false,
    "Curry",
    "Kashmiri-style mutton curry",
    [["Mutton", 0.25]],
  ],
  [
    "Kadai Paneer",
    "Curries",
    280,
    true,
    false,
    "Curry",
    "Paneer with peppers and kadai masala",
    [
      ["Paneer", 0.2],
      ["Capsicum", 0.05],
    ],
  ],
  [
    "Chicken Curry",
    "Curries",
    300,
    false,
    false,
    "Curry",
    "Homestyle spiced chicken curry",
    [["Chicken (curry cut)", 0.25]],
  ],
  [
    "Dal Tadka",
    "Curries",
    200,
    true,
    false,
    "Curry",
    "Yellow lentils tempered with cumin and garlic",
    [["Ghee", 0.02]],
  ],
  [
    "Mixed Veg Curry",
    "Curries",
    240,
    true,
    false,
    "Curry",
    "Garden vegetables in spiced onion-tomato gravy",
    [["Capsicum", 0.1]],
  ],
  [
    "Hyderabadi Chicken Biryani",
    "Biryani",
    320,
    false,
    true,
    "Biryani",
    "Authentic dum biryani with rich flavours",
    [
      ["Basmati rice", 0.2],
      ["Chicken (curry cut)", 0.25],
      ["Saffron", 0.2],
    ],
  ],
  [
    "Mutton Dum Biryani",
    "Biryani",
    480,
    false,
    true,
    "Biryani",
    "Kacchi-style mutton biryani",
    [
      ["Basmati rice", 0.2],
      ["Mutton", 0.25],
    ],
  ],
  [
    "Veg Dum Biryani",
    "Biryani",
    300,
    true,
    false,
    "Biryani",
    "Seasonal vegetables, saffron rice",
    [["Basmati rice", 0.2]],
  ],
  [
    "Paneer Biryani",
    "Biryani",
    340,
    true,
    false,
    "Biryani",
    "Paneer tikka dum biryani",
    [
      ["Basmati rice", 0.2],
      ["Paneer", 0.15],
    ],
  ],
  [
    "Egg Biryani",
    "Biryani",
    300,
    false,
    false,
    "Biryani",
    "Boiled eggs in masala rice",
    [
      ["Basmati rice", 0.2],
      ["Eggs", 0.07],
    ],
  ],
  [
    "Prawn Biryani",
    "Biryani",
    520,
    false,
    false,
    "Biryani",
    "Coastal prawn biryani",
    [
      ["Basmati rice", 0.2],
      ["Prawns", 0.2],
    ],
  ],
  [
    "Butter Naan",
    "Breads",
    70,
    true,
    true,
    "Tandoor",
    "Leavened bread, butter",
    [
      ["Maida", 0.1],
      ["Butter", 0.01],
    ],
  ],
  [
    "Garlic Naan",
    "Breads",
    60,
    true,
    true,
    "Tandoor",
    "Naan with garlic and coriander",
    [["Maida", 0.1]],
  ],
  [
    "Tandoori Roti",
    "Breads",
    40,
    true,
    false,
    "Tandoor",
    "Whole-wheat clay-oven bread",
    [["Atta", 0.08]],
  ],
  [
    "Lachha Paratha",
    "Breads",
    80,
    true,
    false,
    "Tandoor",
    "Layered flaky paratha",
    [
      ["Atta", 0.1],
      ["Ghee", 0.01],
    ],
  ],
  [
    "Masala Dosa",
    "Breads",
    180,
    true,
    true,
    "Tandoor",
    "Crispy golden South Indian rice crepe with spiced potato",
    [["Potato", 0.15]],
  ],
  [
    "Gulab Jamun",
    "Desserts",
    120,
    true,
    true,
    "Desserts",
    "Warm khoya dumplings in syrup",
    [
      ["Khoya", 0.06],
      ["Sugar", 0.05],
    ],
  ],
  [
    "Double ka Meetha",
    "Desserts",
    180,
    true,
    true,
    "Desserts",
    "Hyderabadi bread pudding",
    [
      ["Milk", 0.15],
      ["Sugar", 0.05],
    ],
  ],
  [
    "Qubani ka Meetha",
    "Desserts",
    220,
    true,
    false,
    "Desserts",
    "Apricot dessert, cream",
    [["Fresh cream", 0.05]],
  ],
  ["Rasmalai", "Desserts", 180, true, false, "Desserts", "Saffron milk dumplings", [["Milk", 0.2]]],
  [
    "Kulfi Falooda",
    "Desserts",
    200,
    true,
    false,
    "Desserts",
    "Kulfi, vermicelli, rose",
    [["Milk", 0.2]],
  ],
  [
    "Masala Chai",
    "Beverages",
    60,
    true,
    true,
    "Beverages",
    "Irani-style spiced tea",
    [
      ["Tea leaves", 0.01],
      ["Milk", 0.1],
    ],
  ],
  [
    "Mango Lassi",
    "Beverages",
    140,
    true,
    true,
    "Beverages",
    "Alphonso mango yoghurt",
    [
      ["Mango pulp", 0.1],
      ["Curd", 0.15],
    ],
  ],
  [
    "Fresh Lime Soda",
    "Beverages",
    90,
    true,
    false,
    "Beverages",
    "Sweet or salted",
    [
      ["Lemon", 0.05],
      ["Soda", 1],
    ],
  ],
  [
    "Filter Coffee",
    "Beverages",
    80,
    true,
    false,
    "Beverages",
    "South Indian decoction",
    [
      ["Coffee beans", 0.015],
      ["Milk", 0.1],
    ],
  ],
  [
    "Sweet Lassi",
    "Beverages",
    110,
    true,
    false,
    "Beverages",
    "Chilled churned yoghurt",
    [["Curd", 0.2]],
  ],
  [
    "Mint Mojito (Virgin)",
    "Beverages",
    160,
    true,
    false,
    "Beverages",
    "Mint, lime, soda",
    [
      ["Mint", 0.2],
      ["Soda", 1],
    ],
  ],
];
export const menu: MenuItem[] = m.map(
  ([name, category, price, veg, bestseller, station, description, r], i) => {
    const isBreadWithMaidaOrAtta = category === "Breads" && !name.toLowerCase().includes("dosa");
    return {
      id: `M${i + 1}`,
      name,
      category,
      price,
      veg,
      bestseller,
      available: i !== 26,
      station,
      description,
      recipe: r.map(([n, q]) => ({ ingredientId: I(n), qty: q })),
      jain:
        veg &&
        !name.toLowerCase().includes("garlic") &&
        !name.toLowerCase().includes("aloo") &&
        !name.toLowerCase().includes("dosa"),
      glutenFree: !isBreadWithMaidaOrAtta && !name.toLowerCase().includes("manchurian"),
    };
  },
);

export const tables: DiningTable[] = [
  // Main Hall (T1–T12 matching reference floor plan)
  {
    id: "T1",
    name: "T1",
    area: "Main Hall",
    capacity: 2,
    status: "available",
    guests: 0,
    x: 0.19,
    y: 0.27,
    shape: "round",
  },
  {
    id: "T2",
    name: "T2",
    area: "Main Hall",
    capacity: 4,
    status: "occupied",
    guests: 4,
    x: 0.39,
    y: 0.27,
    shape: "rect",
  },
  {
    id: "T3",
    name: "T3",
    area: "Main Hall",
    capacity: 4,
    status: "reserved",
    guests: 4,
    x: 0.57,
    y: 0.27,
    shape: "round",
  },
  {
    id: "T4",
    name: "T4",
    area: "Main Hall",
    capacity: 6,
    status: "occupied",
    guests: 5,
    x: 0.74,
    y: 0.27,
    shape: "rect",
  },
  {
    id: "T5",
    name: "T5",
    area: "Main Hall",
    capacity: 2,
    status: "cleaning",
    guests: 0,
    x: 0.19,
    y: 0.52,
    shape: "rect",
  },
  {
    id: "T6",
    name: "T6",
    area: "Main Hall",
    capacity: 4,
    status: "billing",
    guests: 4,
    x: 0.39,
    y: 0.52,
    shape: "rect",
  },
  {
    id: "T7",
    name: "T7",
    area: "Main Hall",
    capacity: 4,
    status: "available",
    guests: 0,
    x: 0.57,
    y: 0.52,
    shape: "round",
  },
  {
    id: "T8",
    name: "T8",
    area: "Main Hall",
    capacity: 6,
    status: "occupied",
    guests: 6,
    x: 0.74,
    y: 0.52,
    shape: "rect",
  },
  {
    id: "T9",
    name: "T9",
    area: "Main Hall",
    capacity: 2,
    status: "available",
    guests: 0,
    x: 0.19,
    y: 0.76,
    shape: "round",
  },
  {
    id: "T10",
    name: "T10",
    area: "Main Hall",
    capacity: 2,
    status: "occupied",
    guests: 2,
    x: 0.39,
    y: 0.76,
    shape: "rect",
  },
  {
    id: "T11",
    name: "T11",
    area: "Main Hall",
    capacity: 4,
    status: "reserved",
    guests: 4,
    x: 0.57,
    y: 0.76,
    shape: "round",
  },
  {
    id: "T12",
    name: "T12",
    area: "Main Hall",
    capacity: 6,
    status: "occupied",
    guests: 4,
    x: 0.74,
    y: 0.76,
    shape: "rect",
  },
  // Terrace (R1–R2)
  {
    id: "R1",
    name: "R1",
    area: "Terrace",
    capacity: 4,
    status: "available",
    guests: 0,
    x: 0.34,
    y: 0.48,
    shape: "round",
  },
  {
    id: "R2",
    name: "R2",
    area: "Terrace",
    capacity: 4,
    status: "reserved",
    guests: 4,
    x: 0.66,
    y: 0.48,
    shape: "rect",
  },
  // Private Room (P1–P2)
  {
    id: "P1",
    name: "P1",
    area: "Private Room",
    capacity: 8,
    status: "available",
    guests: 0,
    x: 0.34,
    y: 0.5,
    shape: "rect",
  },
  {
    id: "P2",
    name: "P2",
    area: "Private Room",
    capacity: 8,
    status: "cleaning",
    guests: 0,
    x: 0.66,
    y: 0.5,
    shape: "rect",
  },
];

const first = [
  "Aarav",
  "Priya",
  "Rohan",
  "Ananya",
  "Vikram",
  "Sneha",
  "Arjun",
  "Kavya",
  "Rahul",
  "Meera",
  "Siddharth",
  "Lakshmi",
  "Karthik",
  "Divya",
  "Imran",
  "Fatima",
  "Nikhil",
  "Pooja",
  "Aditya",
  "Shreya",
  "Varun",
  "Harini",
  "Sameer",
  "Nandini",
  "Rajesh",
  "Swathi",
  "Manoj",
  "Ayesha",
];
const last = [
  "Reddy",
  "Sharma",
  "Rao",
  "Iyer",
  "Naidu",
  "Khan",
  "Gupta",
  "Varma",
  "Patel",
  "Menon",
];
export const customers: Customer[] = first.map((f, i) => {
  const surname = last[i % last.length] ?? "Reddy";
  if (i === 0) {
    return {
      id: "C1",
      name: "Ravi Kumar",
      phone: "+91 98765 43210",
      email: "ravi.kumar@mail.in",
      points: 420,
      tier: "Gold",
      notes: "Prefers center table",
    };
  }
  return {
    id: `C${i + 1}`,
    name: `${f} ${surname}`,
    phone: `+91 9${(840000000 + i * 1373911).toString().slice(0, 9)}`,
    email: `${f.toLowerCase()}.${surname.toLowerCase()}@mail.in`,
    points: ((i * 137) % 900) + 40,
    tier: i % 5 === 0 ? "Gold" : i % 3 === 0 ? "Silver" : "Bronze",
    notes: i % 4 === 0 ? "Prefers window seating" : "",
  };
});

const staffSeed: [string, string][] = [
  ["Ravi Kumar", "Restaurant Manager"],
  ["Sunita Devi", "Head Chef"],
  ["Mohammed Azhar", "Sous Chef"],
  ["Ramesh Babu", "Tandoor Chef"],
  ["Lakshman Rao", "Biryani Chef"],
  ["Geeta Kumari", "Pastry Chef"],
  ["Anil Yadav", "Captain"],
  ["Suresh Naik", "Server"],
  ["Pradeep Singh", "Server"],
  ["Kiran Kumar", "Server"],
  ["Deepa Nair", "Host"],
  ["Vijay Goud", "Cashier"],
  ["Srinivas Reddy", "Bartender"],
  ["Raju Mudiraj", "Delivery Rider"],
  ["Salim Shaikh", "Delivery Rider"],
  ["Padma Latha", "Housekeeping"],
  ["Venkatesh P", "Store Keeper"],
];
const shiftCycle = ["Morning", "Evening", "Night"] as const;
const areaCycle = ["Main Hall", "Terrace", "Private Room"] as const;
export const staff: Staff[] = staffSeed.map(([name, role], i) => ({
  id: `E${i + 1}`,
  name,
  role,
  shift: shiftCycle[i % 3] ?? "Morning",
  present: i % 6 !== 5,
  phone: `+91 9${(700000000 + i * 4112311).toString().slice(0, 9)}`,
  rating: Math.round((3.8 + ((i * 7) % 12) / 10) * 10) / 10,
  assignment:
    role.includes("Server") || role === "Captain"
      ? (areaCycle[i % 3] ?? "Main Hall")
      : role.includes("Chef")
        ? "Kitchen"
        : "—",
}));

export function buildSeed(now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  const day = (d: number) => new Date(now + d * 86400000).toISOString().slice(0, 10);
  const mk = (itemIdx: number, qty: number, n: number): OrderLine => {
    const it = menu[itemIdx % menu.length] ?? menu[0]!;
    return {
      lineId: `L${n}-${itemIdx}`,
      itemId: it.id,
      name: it.name,
      price: it.price,
      qty,
      modifiers: n % 3 === 0 ? ["Less spicy"] : [],
      addons: [],
      note: "",
      station: it.station,
    };
  };
  const tbls = tables.map((t) => ({ ...t }));
  const orders: Order[] = [];
  const kots: Kot[] = [];
  let n = 1001;
  const orderTypeCycle = ["dine-in", "takeaway", "delivery"] as const;
  const paymentMethodCycle = ["UPI", "Card", "Cash"] as const;
  const providerCycle = ["Swiggy (demo)", "Zomato (demo)", "Own fleet"] as const;
  const kotStatusCycle = ["new", "accepted", "preparing", "ready"] as const;
  const requestCycle = [
    "Anniversary — cake at 9pm",
    "High chair needed",
    "",
    "Window table",
    "Vegetarian only",
    "",
  ] as const;
  // 20 Completed orders + 2 Cancelled orders + 6 Live Ongoing/Pending table orders = 28 Total Orders
  // Channel breakdown across all 28 orders: 18 Dine-In (64%), 5 Takeaway (18%), 5 Delivery (18%)
  const historicalSpecs: {
    id: string;
    type: "dine-in" | "takeaway" | "delivery";
    status: "completed" | "cancelled";
    payment: "paid" | "refunded";
    minsAgo: number;
    tableId?: string;
    custIdx: number;
    discountPct: number;
  }[] = [
    {
      id: "ORD-1040",
      type: "takeaway",
      status: "completed",
      payment: "paid",
      minsAgo: 30,
      custIdx: 4,
      discountPct: 0,
    },
    {
      id: "ORD-1039",
      type: "delivery",
      status: "completed",
      payment: "paid",
      minsAgo: 33,
      custIdx: 6,
      discountPct: 0,
    },
    {
      id: "ORD-1037",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 47,
      tableId: "T7",
      custIdx: 8,
      discountPct: 0,
    },
    {
      id: "ORD-1036",
      type: "takeaway",
      status: "completed",
      payment: "paid",
      minsAgo: 60,
      custIdx: 2,
      discountPct: 0,
    },
    {
      id: "ORD-1035",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 95,
      tableId: "T1",
      custIdx: 1,
      discountPct: 5,
    },
    {
      id: "ORD-1034",
      type: "delivery",
      status: "completed",
      payment: "paid",
      minsAgo: 110,
      custIdx: 9,
      discountPct: 0,
    },
    {
      id: "ORD-1033",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 135,
      tableId: "T3",
      custIdx: 10,
      discountPct: 0,
    },
    {
      id: "ORD-1032",
      type: "takeaway",
      status: "completed",
      payment: "paid",
      minsAgo: 160,
      custIdx: 11,
      discountPct: 0,
    },
    {
      id: "ORD-1031",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 190,
      tableId: "T5",
      custIdx: 12,
      discountPct: 10,
    },
    {
      id: "ORD-1030",
      type: "delivery",
      status: "completed",
      payment: "paid",
      minsAgo: 220,
      custIdx: 13,
      discountPct: 0,
    },
    {
      id: "ORD-1029",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 260,
      tableId: "T9",
      custIdx: 14,
      discountPct: 0,
    },
    {
      id: "ORD-1028",
      type: "takeaway",
      status: "completed",
      payment: "paid",
      minsAgo: 310,
      custIdx: 15,
      discountPct: 0,
    },
    {
      id: "ORD-1027",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 360,
      tableId: "T11",
      custIdx: 16,
      discountPct: 0,
    },
    {
      id: "ORD-1026",
      type: "delivery",
      status: "completed",
      payment: "paid",
      minsAgo: 420,
      custIdx: 17,
      discountPct: 0,
    },
    {
      id: "ORD-1025",
      type: "dine-in",
      status: "cancelled",
      payment: "refunded",
      minsAgo: 480,
      tableId: "T7",
      custIdx: 18,
      discountPct: 0,
    },
    {
      id: "ORD-1024",
      type: "takeaway",
      status: "cancelled",
      payment: "refunded",
      minsAgo: 540,
      custIdx: 19,
      discountPct: 0,
    },
    {
      id: "ORD-1023",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 1500,
      tableId: "T1",
      custIdx: 20,
      discountPct: 0,
    },
    {
      id: "ORD-1022",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 1620,
      tableId: "T3",
      custIdx: 21,
      discountPct: 10,
    },
    {
      id: "ORD-1021",
      type: "delivery",
      status: "completed",
      payment: "paid",
      minsAgo: 2880,
      custIdx: 22,
      discountPct: 0,
    },
    {
      id: "ORD-1020",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 3000,
      tableId: "T5",
      custIdx: 23,
      discountPct: 0,
    },
    {
      id: "ORD-1019",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 4320,
      tableId: "T9",
      custIdx: 24,
      discountPct: 0,
    },
    {
      id: "ORD-1018",
      type: "dine-in",
      status: "completed",
      payment: "paid",
      minsAgo: 5760,
      tableId: "T11",
      custIdx: 25,
      discountPct: 0,
    },
  ];

  historicalSpecs.forEach((spec, i) => {
    const created = now - spec.minsAgo * 60000;
    const cust = customers[spec.custIdx % customers.length];
    orders.push({
      id: spec.id,
      type: spec.type,
      guests: spec.type === "dine-in" ? 2 + (i % 3) : 1,
      customerId: cust?.id,
      tableId: spec.tableId,
      lines: [
        mk((i * 3) % menu.length, 1 + (i % 2), i),
        mk((i * 7 + 2) % menu.length, 1, i + 50),
        mk(28, 2, i + 90),
      ],
      discountPct: spec.discountPct,
      status: spec.status,
      payment: spec.payment,
      paymentMethod: paymentMethodCycle[i % 3] ?? "UPI",
      createdAt: created,
      paidAt: spec.payment === "paid" ? created + 1800000 : undefined,
      stockDeducted: spec.status === "completed",
      provider: spec.type === "delivery" ? (providerCycle[i % 3] ?? "Swiggy (demo)") : undefined,
      deliveryStage: spec.type === "delivery" ? "delivered" : undefined,
      note: i % 4 === 0 ? "Serve hot with mint chutney" : "",
    });
  });

  // 6 Live Ongoing/Pending orders on occupied/billing tables matching reference elapsed times & IDs
  const elapsedMinutesByTable: Record<string, number> = {
    T2: 42,
    T4: 28,
    T6: 71,
    T8: 15,
    T10: 36,
    T12: 12,
  };
  const orderIdByTable: Record<string, string> = {
    T2: "ORD-1045",
    T4: "ORD-1044",
    T8: "ORD-1043",
    T6: "ORD-1042",
    T10: "ORD-1041",
    T12: "ORD-1038",
  };
  const orderCreatedMinsAgoByTable: Record<string, number> = {
    T2: 4,
    T4: 7,
    T8: 13,
    T6: 17,
    T10: 25,
    T12: 40,
  };
  let li = 0;
  tbls.forEach((t) => {
    if (t.status !== "occupied" && t.status !== "billing") return;
    const isT6 = t.id === "T6";
    const isT2 = t.id === "T2";
    const id = orderIdByTable[t.id] ?? `ORD-${n++}`;
    const mins = elapsedMinutesByTable[t.id] ?? 12 + li * 9;
    const since = now - mins * 60000;
    const createdAt = now - (orderCreatedMinsAgoByTable[t.id] ?? mins) * 60000;
    const lines: OrderLine[] = isT2
      ? [
          {
            lineId: "L-T2-1",
            itemId: "M22",
            name: "Chicken Biryani",
            price: 320,
            qty: 2,
            modifiers: ["Medium Spicy"],
            addons: [],
            note: "",
            station: "Biryani",
          },
          {
            lineId: "L-T2-2",
            itemId: "M29",
            name: "Garlic Naan",
            price: 60,
            qty: 1,
            modifiers: [],
            addons: [],
            note: "",
            station: "Tandoor",
          },
          {
            lineId: "L-T2-3",
            itemId: "M16",
            name: "Dal Makhani",
            price: 220,
            qty: 1,
            modifiers: [],
            addons: [],
            note: "",
            station: "Curry",
          },
          {
            lineId: "L-T2-4",
            itemId: "M1",
            name: "Paneer Tikka",
            price: 280,
            qty: 1,
            modifiers: ["No Onion"],
            addons: [],
            note: "",
            station: "Tandoor",
          },
        ]
      : isT6
        ? [
            {
              lineId: "L-1042-1",
              itemId: "M22",
              name: "Chicken Biryani",
              price: 320,
              qty: 2,
              modifiers: [],
              addons: [],
              note: "",
              station: "Biryani",
            },
            {
              lineId: "L-1042-2",
              itemId: "M29",
              name: "Garlic Naan",
              price: 60,
              qty: 1,
              modifiers: [],
              addons: [],
              note: "",
              station: "Tandoor",
            },
            {
              lineId: "L-1042-3",
              itemId: "M16",
              name: "Dal Makhani",
              price: 220,
              qty: 1,
              modifiers: [],
              addons: [],
              note: "",
              station: "Curry",
            },
            {
              lineId: "L-1042-4",
              itemId: "M1",
              name: "Paneer Tikka",
              price: 280,
              qty: 1,
              modifiers: [],
              addons: [],
              note: "",
              station: "Tandoor",
            },
          ]
        : [
            mk((li * 5 + 1) % 40, 1, li + 200),
            mk((li * 3 + 13) % 40, 1, li + 300),
            mk(28, 2, li + 400),
          ];
    const status =
      t.status === "billing" ? "served" : isT2 ? "in-kitchen" : li % 2 ? "in-kitchen" : "served";
    const cust = isT6 || isT2 ? customers[0] : customers[(li + 3) % customers.length];
    const guestCount = isT2 ? 3 : isT6 ? 4 : Math.min(t.capacity, 2 + (li % 3));
    orders.push({
      id,
      type: "dine-in",
      tableId: t.id,
      guests: guestCount,
      lines,
      discountPct: isT2 ? 10 : 0,
      status,
      payment: "unpaid",
      createdAt,
      stockDeducted: false,
      customerId: cust?.id,
      note: isT2 ? "Less spicy, extra raita" : "Serve starters first",
    });
    t.orderId = id;
    t.since = since;
    t.guests = guestCount;
    const byStation = new Map<Station, OrderLine[]>();
    lines.forEach((l) => byStation.set(l.station, [...(byStation.get(l.station) ?? []), l]));
    let s = 0;
    byStation.forEach((ls, station) => {
      const st = isT2 ? "new" : isT6 ? "ready" : (kotStatusCycle[(li + s++) % 4] ?? "preparing");
      kots.push({
        id: `KOT-${500 + kots.length}`,
        orderId: id,
        station,
        status: st,
        lines: ls,
        createdAt,
        startedAt: st === "preparing" || st === "ready" ? createdAt + 120000 : undefined,
      });
    });
    li++;
  });
  n = 1046;
  const resNames = customers.slice(4, 22);
  const reservations: Reservation[] = resNames.map((c, i) => {
    const reservedTable = tbls.filter((t) => t.status === "reserved")[i];
    return {
      id: `RES-${301 + i}`,
      name: c.name,
      phone: c.phone,
      date: i < 8 ? today : day(1 + (i % 4)),
      time: `${String(12 + (i % 10)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
      party: 2 + (i % 6),
      tableId: reservedTable?.id,
      status: i === 15 || i === 16 ? "waitlist" : i % 4 === 1 ? "confirmed" : "booked",
      request: requestCycle[i % 6] ?? "",
    };
  });
  const purchaseOrders: PurchaseOrder[] = [
    {
      id: "PO-2101",
      supplierId: "S2",
      lines: [
        { ingredientId: I("Mutton"), qty: 10 },
        { ingredientId: I("Prawns"), qty: 5 },
      ],
      status: "pending",
      createdAt: now - 86400000,
    },
    {
      id: "PO-2102",
      supplierId: "S3",
      lines: [
        { ingredientId: I("Butter"), qty: 6 },
        { ingredientId: I("Khoya"), qty: 4 },
      ],
      status: "pending",
      createdAt: now - 3600000 * 5,
    },
    {
      id: "PO-2100",
      supplierId: "S1",
      lines: [{ ingredientId: I("Onion"), qty: 30 }],
      status: "received",
      createdAt: now - 86400000 * 3,
      receivedAt: now - 86400000 * 2,
    },
  ];
  const settings: Settings = {
    restaurant: "Sunrise Restaurant",
    branch: "Hyderabad Central",
    gstPct: 5,
    serviceChargePct: 0,
    profile: "casual",
    dark: false,
    printKot: true,
    notifyLowStock: true,
    maxDiscountPct: 30,
  };
  const notices: Notice[] = [
    {
      id: "N1",
      text: "Mutton is below reorder level (6 kg left)",
      at: now - 600000,
      read: false,
      tone: "warning",
    },
    {
      id: "N2",
      text: "Reservation RES-301 arriving in 30 minutes",
      at: now - 1200000,
      read: false,
      tone: "info",
    },
    {
      id: "N3",
      text: "PO-2100 received from Deccan Fresh Produce",
      at: now - 86400000,
      read: true,
      tone: "success",
    },
  ];
  const stockMoves: StockMove[] = [];
  const held: HeldCart[] = [
    {
      id: "HOLD-101",
      label: "Table T4 (Additional Round)",
      tableId: "T4",
      lines: [
        {
          lineId: "L-H101-1",
          itemId: "M14",
          name: "Butter Chicken",
          price: 340,
          qty: 1,
          modifiers: ["Less spicy"],
          addons: [],
          note: "",
          station: "Curry",
        },
        {
          lineId: "L-H101-2",
          itemId: "M28",
          name: "Butter Naan",
          price: 70,
          qty: 2,
          modifiers: [],
          addons: [],
          note: "",
          station: "Tandoor",
        },
      ],
      at: now - 14 * 60000,
    },
    {
      id: "HOLD-102",
      label: "Takeaway #TK-18",
      tableId: undefined,
      lines: [
        {
          lineId: "L-H102-1",
          itemId: "M22",
          name: "Hyderabadi Chicken Biryani",
          price: 320,
          qty: 2,
          modifiers: [],
          addons: [{ name: "Raita", price: 50 }],
          note: "Pack spoons separately",
          station: "Biryani",
        },
      ],
      at: now - 6 * 60000,
    },
  ];
  return {
    tables: tbls,
    menu: menu.map((x) => ({ ...x })),
    orders,
    kots,
    customers: customers.map((c) => ({ ...c })),
    reservations,
    ingredients: ingredients.map((x) => ({ ...x })),
    suppliers,
    purchaseOrders,
    stockMoves,
    staff: staff.map((s) => ({ ...s })),
    settings,
    notices,
    seq: { order: n, kot: 500 + kots.length, po: 2103, res: 400 },
    held,
  };
}

export interface HeldCart {
  id: string;
  label: string;
  tableId?: string | undefined;
  lines: OrderLine[];
  at: number;
}
