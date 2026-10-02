import type {
  StatCard,
  SaleItem,
  MedicineItem,
  QuickAction,
  LowStockItem,
} from "@/types/dashboard";

export const statsCardsData: StatCard[] = [
  {
    id: "1",
    titleKey: "stats.totalMedicines",
    value: "1,248",
    change: "+12% vs last month",
    changeType: "positive",
    icon: "Pill",
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  {
    id: "2",
    titleKey: "stats.currentStock",
    value: "8,420",
    change: "+6% vs last month",
    changeType: "positive",
    icon: "Package",
    iconBg:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  {
    id: "3",
    titleKey: "stats.lowStockItems",
    value: 18,
    change: "+3% vs last month",
    changeType: "negative",
    icon: "AlertTriangle",
    iconBg:
      "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  },
  {
    id: "4",
    titleKey: "stats.expiringSoon",
    value: 12,
    change: "+20% vs last month",
    changeType: "negative",
    icon: "Clock",
    iconBg: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
  },
  {
    id: "5",
    titleKey: "stats.todaysSales",
    value: "₹8,750",
    change: "+15% vs yesterday",
    changeType: "positive",
    icon: "IndianRupee",
    iconBg:
      "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
  },
];

export const recentSalesData: SaleItem[] = [
  {
    id: "1",
    invoiceNo: "#INV-0048",
    customer: "Pankaj Sharma",
    amount: 560,
    time: "16 Apr 10:24 AM",
    status: "Paid",
  },
  {
    id: "2",
    invoiceNo: "#INV-0047",
    customer: "Sneha Patel",
    amount: 845,
    time: "16 Apr 09:58 AM",
    status: "Paid",
  },
  {
    id: "3",
    invoiceNo: "#INV-0046",
    customer: "Amit Verma",
    amount: 320,
    time: "16 Apr 09:32 AM",
    status: "Paid",
  },
  {
    id: "4",
    invoiceNo: "#INV-0045",
    customer: "Neha Gupta",
    amount: 180,
    time: "16 Apr 09:15 AM",
    status: "Paid",
  },
  {
    id: "5",
    invoiceNo: "#INV-0044",
    customer: "Suresh Yadav",
    amount: 675,
    time: "16 Apr 08:50 AM",
    status: "Pending",
  },
];

export const topSellingData: MedicineItem[] = [
  {
    id: "1",
    name: "Dolo 650",
    generic: "Paracetamol 650mg",
    qtySold: 120,
    revenue: 3600,
  },
  {
    id: "2",
    name: "Crocin Advance",
    generic: "Paracetamol 500mg",
    qtySold: 85,
    revenue: 2550,
  },
  {
    id: "3",
    name: "Cetirizine 10",
    generic: "Antihistamine 10mg",
    qtySold: 60,
    revenue: 1800,
  },
  {
    id: "4",
    name: "Azithromycin 500",
    generic: "Antibiotic 500mg",
    qtySold: 45,
    revenue: 1350,
  },
  {
    id: "5",
    name: "Amoxicillin 500",
    generic: "Antibiotic 500mg",
    qtySold: 32,
    revenue: 1024,
  },
];

export const quickActionsData: QuickAction[] = [
  {
    id: "1",
    titleKey: "actions.newSale",
    icon: "ShoppingCart",
    color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  {
    id: "2",
    titleKey: "actions.addMedicine",
    icon: "Plus",
    color:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  {
    id: "3",
    titleKey: "actions.purchase",
    icon: "Truck",
    color:
      "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  },
  {
    id: "4",
    titleKey: "actions.newSupplier",
    icon: "UserPlus",
    color:
      "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
  },
  {
    id: "5",
    titleKey: "actions.viewReports",
    icon: "BarChart3",
    color: "bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400",
  },
  {
    id: "6",
    titleKey: "actions.inventory",
    icon: "Package",
    color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
  },
];

export const lowStockData: LowStockItem[] = [
  { id: "1", name: "Dolo 650", stock: 5, minStock: 20 },
  { id: "2", name: "Azithromycin 500", stock: 8, minStock: 15 },
  { id: "3", name: "Cetirizine 10", stock: 12, minStock: 25 },
  { id: "4", name: "Paracetamol 500", stock: 15, minStock: 30 },
  { id: "5", name: "Crocin Advance", stock: 18, minStock: 25 },
];
