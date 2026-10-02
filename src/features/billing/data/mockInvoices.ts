export type InvoiceLine = {
  lineId: string;
  medicineId: string;
  name: string;
  batch: string;
  expiry: string;
  qtyStrip: number;
  qtyLoose: number;
  unitsPerStrip: number;
  salePrice: number;
  discountPercent: number;
  lineTotal: number;
};

export type SavedInvoice = {
  billNo: string;
  customerName: string;
  date: string;
  paymentMethod: string;
  total: number;
  lines: InvoiceLine[];
};

export const savedInvoicesMock: SavedInvoice[] = [
  {
    billNo: "#INV-0048",
    customerName: "Ramesh Sharma",
    date: "16 Apr 10:24 AM",
    paymentMethod: "Cash",
    total: 309,
    lines: [
      {
        lineId: "l1",
        medicineId: "1",
        name: "Paracetamol 650mg Tablet",
        batch: "DL24118",
        expiry: "02/11",
        qtyStrip: 1,
        qtyLoose: 10,
        unitsPerStrip: 10,
        salePrice: 42,
        discountPercent: 5,
        lineTotal: 79.8,
      },
      {
        lineId: "l2",
        medicineId: "2",
        name: "Paracetamol 500mg Tablet",
        batch: "AZ2402",
        expiry: "05/12",
        qtyStrip: 1,
        qtyLoose: 0,
        unitsPerStrip: 10,
        salePrice: 55,
        discountPercent: 0,
        lineTotal: 55,
      },
      {
        lineId: "l3",
        medicineId: "4",
        name: "Azithromycin 500mg Tablet",
        batch: "AZ2402",
        expiry: "11/26",
        qtyStrip: 1,
        qtyLoose: 0,
        unitsPerStrip: 3,
        salePrice: 105,
        discountPercent: 0,
        lineTotal: 105,
      },
      {
        lineId: "l4",
        medicineId: "5",
        name: "Cetirizine 10mg Tablet",
        batch: "CZ7788",
        expiry: "05/28",
        qtyStrip: 2,
        qtyLoose: 0,
        unitsPerStrip: 10,
        salePrice: 18,
        discountPercent: 0,
        lineTotal: 36,
      },
    ],
  },
  {
    billNo: "#INV-0047",
    customerName: "Sneha Patel",
    date: "16 Apr 09:58 AM",
    paymentMethod: "UPI",
    total: 845,
    lines: [
      {
        lineId: "l5",
        medicineId: "3",
        name: "Dolo 650 Tablet",
        batch: "DL65001",
        expiry: "08/26",
        qtyStrip: 2,
        qtyLoose: 0,
        unitsPerStrip: 15,
        salePrice: 27,
        discountPercent: 0,
        lineTotal: 54,
      },
    ],
  },
];
