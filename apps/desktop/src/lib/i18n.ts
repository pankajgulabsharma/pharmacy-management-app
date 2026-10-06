import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { HI_UI } from "./i18n/hi-ui";

const resources = {
  en: {
    translation: {
      "login.title": "MediCare",
      "login.subtitle": "Pharmacy Management System",
      "login.email": "Email or Username",
      "login.password": "Password",
      "login.emailPlaceholder": "Enter your email or username",
      "login.passwordPlaceholder": "Enter your password",
      "login.remember": "Remember me",
      "login.forgot": "Forgot password?",
      "login.button": "Sign In",
      "login.loading": "Please wait...",
      "login.errorEmpty": "Please fill all fields",
      "login.errorInvalid": "Invalid email or password",
      "login.success": "Login successful",
      "login.successDesc": "Welcome back to MediCare",

      "greeting.morning": "Good Morning",
      "greeting.afternoon": "Good Afternoon",
      "greeting.evening": "Good Evening",
      "greeting.night": "Good Night",
      "shop.open": "Shop Open",

      "stats.totalMedicines": "Total Medicines",
      "stats.currentStock": "Current Stock",
      "stats.lowStockItems": "Low Stock Items",
      "stats.expiringSoon": "Expiring Soon",
      "stats.todaysSales": "Today's Sales",

      "sales.title": "Sales Overview",
      "sales.amount": "Sales Amount",
      "sales.bills": "Bills Count",
      "sales.last7": "Last 7 days",
      "sales.last30": "Last 30 days",
      "sales.sales": "Sales",
      "sales.billsShort": "Bills",

      "quickStats.title": "Quick Stats",
      "quickStats.health": "Health",
      "quickStats.inStock": "In Stock",
      "quickStats.lowStock": "Low Stock",
      "quickStats.outOfStock": "Out of Stock",

      "recentSales.title": "Recent Sales",
      "recentSales.invoice": "Invoice",
      "recentSales.customer": "Customer",
      "recentSales.amount": "Amount",
      "recentSales.status": "Status",
      "recentSales.paid": "Paid",
      "recentSales.pending": "Pending",
      "common.viewAll": "View All",

      "topSelling.title": "Top Selling Medicines",
      "topSelling.pcs": "pcs",

      "lowStock.title": "Low Stock Alerts",
      "lowStock.stock": "Stock",

      "alerts.actionRequired": "Action Required",
      "alerts.actionRequiredDesc": "18 medicines are running low in stock.",
      "alerts.expiringSoon": "Expiring Soon",
      "alerts.expiringSoonDesc":
        "12 medicines will expire in the next 30 days.",
      "alerts.purchaseReminder": "Purchase Reminder",
      "alerts.purchaseReminderDesc":
        "5 purchase orders are pending confirmation.",

      "actions.title": "Quick Actions",
      "actions.newSale": "New Sale",
      "actions.addMedicine": "Add Medicine",
      "actions.purchase": "Purchase",
      "actions.newSupplier": "New Supplier",
      "actions.viewReports": "View Reports",
      "actions.inventory": "Inventory",

      "nav.dashboard": "Dashboard",
      "nav.salesBilling": "Sales & Billing",
      "nav.purchase": "Purchase",
      "nav.inventory": "Inventory",
      "nav.medicines": "Medicines",
      "nav.suppliers": "Suppliers",
      "nav.customers": "Customers",
      "nav.reports": "Reports",
      "nav.expiry": "Expiry Tracker",
      "nav.settings": "Settings",
      "nav.admin": "Admin",

      "billing.customerName": "Customer Name",
      "billing.customerPlaceholder": "Walk-in / search customer",
      "billing.prescribedBy": "Prescribed By",
      "billing.selectDoctor": "Select doctor",
      "billing.counter": "Counter",
      "billing.searchPlaceholder": "Search medicine, salt or scan barcode...",
      "billing.medicineName": "Medicine Name",
      "billing.hsn": "HSN Code",
      "billing.rack": "Rack",
      "billing.batchExpiry": "Batch (Expiry)",
      "billing.brand": "Brand",
      "billing.stock": "Stock",
      "billing.mrp": "MRP (₹)",
      "billing.salePrice": "Sale Price (₹)",
      "billing.showingResults": "Showing {{count}} results for",
      "billing.keyboardHint": "↑↓ Pick  ·  Enter Select  ·  Esc Clear",
      "billing.typeToSearch":
        "Type medicine name, salt or scan barcode to search",
      "billing.noResults": "No medicines found for",
      "billing.billSummary": "Bill Summary",
      "billing.draft": "Draft",
      "billing.noItems": "No items added yet",
      "billing.noItemsHint": "Search and add medicines to start billing",
      "billing.paymentMethod": "Payment Method",
      "billing.cash": "Cash",
      "billing.upi": "UPI",
      "billing.card": "Card",
      "billing.wallet": "Wallet",
      "billing.receivedAmount": "Received Amount (₹)",
      "billing.changeDue": "Change Due (₹)",
      "billing.savePrint": "Save and Print",
      "billing.holdBill": "Hold Bill",
      "billing.saveNoPrint": "Save without Print",
      "billing.totalSales": "Total Sales (Today)",
      "billing.totalBills": "Total Bills (Today)",
      "billing.todayPurchase": "Today's Purchase",
      "billing.recentSales": "Recent Sales",
      "billing.billNo": "Bill No.",
      "billing.customer": "Customer",
      "billing.dateTime": "Date & Time",
      "billing.amount": "Amount",
      "billing.status": "Status",
      "billing.paid": "Paid",
      "billing.pending": "Pending",
    },
  },
  hi: {
    translation: {
      "greeting.morning": "सुप्रभात",
      "greeting.afternoon": "नमस्कार",
      "greeting.evening": "शुभ संध्या",
      "greeting.night": "शुभ रात्रि",
      "shop.open": "दुकान खुली",

      "stats.totalMedicines": "कुल दवाइयाँ",
      "stats.currentStock": "वर्तमान स्टॉक",
      "stats.lowStockItems": "कम स्टॉक",
      "stats.expiringSoon": "जल्दी एक्सपायर",
      "stats.todaysSales": "आज की बिक्री",

      "sales.title": "बिक्री अवलोकन",
      "sales.amount": "बिक्री राशि",
      "sales.bills": "बिल संख्या",
      "sales.last7": "पिछले 7 दिन",
      "sales.last30": "पिछले 30 दिन",
      "sales.sales": "बिक्री",
      "sales.billsShort": "बिल",

      "quickStats.title": "त्वरित आँकड़े",
      "quickStats.health": "स्वास्थ्य",
      "quickStats.inStock": "स्टॉक में",
      "quickStats.lowStock": "कम स्टॉक",
      "quickStats.outOfStock": "स्टॉक खत्म",

      "recentSales.title": "हाल की बिक्री",
      "recentSales.invoice": "इनवॉइस",
      "recentSales.customer": "ग्राहक",
      "recentSales.amount": "राशि",
      "recentSales.status": "स्थिति",
      "recentSales.paid": "भुगतान",
      "recentSales.pending": "लंबित",
      "common.viewAll": "सभी देखें",

      "topSelling.title": "टॉप सेलिंग दवाइयाँ",
      "topSelling.pcs": "पीस",

      "lowStock.title": "कम स्टॉक अलर्ट",
      "lowStock.stock": "स्टॉक",

      "alerts.actionRequired": "कार्रवाई आवश्यक",
      "alerts.actionRequiredDesc": "18 दवाइयों का स्टॉक कम है।",
      "alerts.expiringSoon": "जल्दी एक्सपायर",
      "alerts.expiringSoonDesc": "12 दवाइयाँ 30 दिनों में एक्सपायर होंगी।",
      "alerts.purchaseReminder": "खरीद रिमाइंडर",
      "alerts.purchaseReminderDesc": "5 खरीद ऑर्डर पुष्टि के लिए लंबित हैं।",

      "actions.title": "त्वरित क्रियाएँ",
      "actions.newSale": "नई बिक्री",
      "actions.addMedicine": "दवा जोड़ें",
      "actions.purchase": "खरीद",
      "actions.newSupplier": "नया सप्लायर",
      "actions.viewReports": "रिपोर्ट देखें",
      "actions.inventory": "इन्वेंटरी",

      "nav.dashboard": "डैशबोर्ड",
      "nav.salesBilling": "बिक्री और बिलिंग",
      "nav.purchase": "खरीद",
      "nav.inventory": "इन्वेंटरी",
      "nav.medicines": "दवाइयाँ",
      "nav.suppliers": "सप्लायर",
      "nav.customers": "ग्राहक",
      "nav.reports": "रिपोर्ट",
      "nav.expiry": "एक्सपायरी ट्रैकर",
      "nav.settings": "सेटिंग्स",
      "nav.admin": "एडमिन",

      "login.title": "मेडीकेयर",
      "login.subtitle": "फार्मेसी प्रबंधन प्रणाली",
      "login.email": "ईमेल या यूज़रनेम",
      "login.password": "पासवर्ड",
      "login.emailPlaceholder": "अपना ईमेल या यूज़रनेम दर्ज करें",
      "login.passwordPlaceholder": "अपना पासवर्ड दर्ज करें",
      "login.remember": "मुझे याद रखें",
      "login.forgot": "पासवर्ड भूल गए?",
      "login.button": "साइन इन करें",
      "login.loading": "कृपया प्रतीक्षा करें...",
      "login.errorEmpty": "कृपया सभी फ़ील्ड भरें",
      "login.errorInvalid": "गलत ईमेल या पासवर्ड",
      "login.success": "लॉगिन सफल",
      "login.successDesc": "मेडीकेयर में वापस स्वागत है",

      "billing.customerName": "ग्राहक का नाम",
      "billing.customerPlaceholder": "वॉक-इन / ग्राहक खोजें",
      "billing.prescribedBy": "डॉक्टर",
      "billing.selectDoctor": "डॉक्टर चुनें",
      "billing.counter": "काउंटर",
      "billing.searchPlaceholder": "दवा, साल्ट या बारकोड खोजें...",
      "billing.medicineName": "दवा का नाम",
      "billing.hsn": "HSN कोड",
      "billing.rack": "रैक",
      "billing.batchExpiry": "बैच (एक्सपायरी)",
      "billing.brand": "ब्रांड",
      "billing.stock": "स्टॉक",
      "billing.mrp": "MRP (₹)",
      "billing.salePrice": "बिक्री मूल्य (₹)",
      "billing.showingResults": "{{count}} परिणाम",
      "billing.keyboardHint": "↑↓ चुनें  ·  Enter सेलेक्ट  ·  Esc साफ़",
      "billing.typeToSearch": "दवा, साल्ट या बारकोड टाइप करें",
      "billing.noResults": "कोई दवा नहीं मिली",
      "billing.billSummary": "बिल सारांश",
      "billing.draft": "ड्राफ्ट",
      "billing.noItems": "अभी कोई आइटम नहीं",
      "billing.noItemsHint": "बिलिंग शुरू करने के लिए दवा खोजें",
      "billing.paymentMethod": "भुगतान तरीका",
      "billing.cash": "नकद",
      "billing.upi": "UPI",
      "billing.card": "कार्ड",
      "billing.wallet": "वॉलेट",
      "billing.receivedAmount": "प्राप्त राशि (₹)",
      "billing.changeDue": "वापसी (₹)",
      "billing.savePrint": "सेव और प्रिंट",
      "billing.holdBill": "बिल होल्ड",
      "billing.saveNoPrint": "बिना प्रिंट सेव",
      "billing.totalSales": "कुल बिक्री",
      "billing.totalBills": "कुल बिल (आज)",
      "billing.todayPurchase": "आज की खरीद",
      "billing.recentSales": "हाल की बिक्री",
      "billing.billNo": "बिल नं.",
      "billing.customer": "ग्राहक",
      "billing.dateTime": "दिनांक व समय",
      "billing.amount": "राशि",
      "billing.status": "स्थिति",
      "billing.paid": "भुगतान",
      "billing.pending": "लंबित",
    },
  },
};

/* ------------------------------------------------------------------ */
/* Language: remembered on this computer, validated when read back      */
/* ------------------------------------------------------------------ */

export const LANGUAGES = ["en", "hi"] as const;
export type Language = (typeof LANGUAGES)[number];
const LANG_KEY = "medicare-lang";

function storedLanguage(): Language {
  try {
    const v =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LANG_KEY)
        : null;
    return v === "hi" ? "hi" : "en"; // anything else → English
  } catch {
    return "en";
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: resources.en.translation, ui: {} },
    hi: { translation: resources.hi.translation, ui: HI_UI },
  },
  lng: storedLanguage(),
  fallbackLng: "en",
  // Keys are flat ("billing.title") or plain English ("Low stock")
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
});

function applyLanguage(lng: string) {
  if (typeof document !== "undefined")
    document.documentElement.lang = lng === "hi" ? "hi" : "en";
  try {
    window.localStorage.setItem(LANG_KEY, lng === "hi" ? "hi" : "en");
  } catch {
    /* storage unavailable — language just isn't remembered */
  }
}
applyLanguage(i18n.language);
i18n.on("languageChanged", applyLanguage);

/**
 * Translate a plain-English UI text (falls back to the English itself).
 * Values fill {{placeholders}}: tr("Within {{days}} days", { days: 90 })
 */
export function tr(
  text: string,
  vars?: Record<string, string | number>,
): string {
  return i18n.t(text, { ns: "ui", defaultValue: text, ...vars });
}

export default i18n;
