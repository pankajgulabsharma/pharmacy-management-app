export interface StatCard {
  id: string;
  titleKey: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: "Pill" | "Package" | "AlertTriangle" | "Clock" | "IndianRupee";
  iconBg: string;
}

export interface SaleItem {
  id: string;
  invoiceNo: string;
  customer: string;
  amount: number;
  time: string;
  status: "Paid" | "Pending";
}

export interface MedicineItem {
  id: string;
  name: string;
  generic: string;
  qtySold: number;
  revenue: number;
}

export interface QuickAction {
  id: string;
  titleKey: string;
  icon:
    | "ShoppingCart"
    | "Plus"
    | "Truck"
    | "UserPlus"
    | "BarChart3"
    | "Package";
  color: string;
}

export interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  minStock: number;
}
