export type SupplierStatus = "active" | "inactive";

export type Supplier = {
  id: string;
  name: string;
  /** 15-char GSTIN, checksum-validated */
  gstin: string;
  /** Wholesale drug licence no. (Form 20B/21B), e.g. "MH-MZ1-20B-123456" */
  drugLicenseNo: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  /** Payment terms in days from invoice date */
  creditDays: number;
  status: SupplierStatus;
  /** ISO timestamp */
  createdAt: string;
};

/** What a user can create/edit (everything except id and createdAt) */
export type SupplierInput = Omit<Supplier, "id" | "createdAt">;

/** Raw form strings */
export type SupplierFormValues = {
  name: string;
  gstin: string;
  drugLicenseNo: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  creditDays: string;
  status: SupplierStatus;
};

/** Money position with one supplier (derived from purchases + returns) */
export type SupplierSummary = {
  invoiceCount: number;
  /** Net of active invoices */
  purchasedPaise: number;
  /** What we still owe (never negative) */
  outstandingPaise: number;
  /** Part of outstanding whose due date has passed */
  overduePaise: number;
  overdueCount: number;
  /** Paid/returned more than invoiced — supplier owes us */
  creditPaise: number;
  returnCount: number;
  /** "YYYY-MM-DD" of the latest active invoice */
  lastPurchaseDate: string | null;
};

export type SupplierWithSummary = Supplier & SupplierSummary;

export const SUPPLIER_LIMITS = {
  nameMax: 100,
  contactMax: 60,
  emailMax: 80,
  addressMax: 200,
  cityMax: 40,
  drugLicenseMax: 40,
  maxCreditDays: 180,
} as const;

export const EMPTY_SUPPLIER_FORM: SupplierFormValues = {
  name: "",
  gstin: "",
  drugLicenseNo: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  creditDays: "30",
  status: "active",
};

export function supplierToForm(s: Supplier): SupplierFormValues {
  return {
    name: s.name,
    gstin: s.gstin,
    drugLicenseNo: s.drugLicenseNo,
    contactPerson: s.contactPerson,
    phone: s.phone,
    email: s.email,
    address: s.address,
    city: s.city,
    creditDays: String(s.creditDays),
    status: s.status,
  };
}
