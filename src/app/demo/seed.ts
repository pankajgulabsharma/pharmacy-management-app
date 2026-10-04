/**
 * Demo data composition root.
 *
 * Builds one consistent starting state for all stores using the SAME pure
 * functions the app uses at runtime — so demo data always obeys the real
 * rules (stock received for posted invoices, returns reduce stock, etc.).
 *
 * TODO(api): delete this file when data comes from the backend.
 */
import { mockMedicines } from "@/features/medicines/data/mockMedicines";
import { mockStockBatches } from "@/features/inventory/data/mockStock";
import type { StockBatch, StockMovement } from "@/features/inventory/types";
import {
  applyIssue,
  applyReceipt,
  openingMovements,
} from "@/features/inventory/utils/ledger";
import { mockPurchases } from "@/features/purchases/data/mockPurchases";
import type {
  Purchase,
  PurchaseReturn,
  ReturnReason,
} from "@/features/purchases/types";
import { purchaseToStockReceipt } from "@/features/purchases/utils/receipt";
import {
  buildPurchaseReturn,
  getReturnableLines,
  nextReturnNo,
} from "@/features/purchases/utils/returns";
import { toISODate } from "@/lib/date";
import type { Medicine } from "@/features/medicines/types";
import { applyChange } from "@/features/inventory/utils/ledger";
import type {
  CartLine,
  HeldBill,
  PaymentDraft,
  Sale,
  SaleReturn,
} from "@/features/billing/types";
import {
  sellableBatches,
  sellsLoose,
  stockLimits,
} from "@/features/billing/utils/allocate";
import { buildSale, nextBillNo } from "@/features/billing/utils/sale";
import {
  buildSaleReturn,
  nextSaleReturnNo,
} from "@/features/billing/utils/saleReturn";
import { DEFAULT_SETTINGS } from "@/features/settings/utils/defaults";

const DOCTORS = DEFAULT_SETTINGS.doctors;
const COUNTERS = DEFAULT_SETTINGS.counters;

const CUSTOMERS = [
  "Ramesh Sharma",
  "Sneha Patel",
  "Amit Verma",
  "Neha Gupta",
  "Suresh Yadav",
  "Kavita Joshi",
  "Walk-in customer",
  "Walk-in customer",
  "Imran Shaikh",
  "Pooja Nair",
];

/** Tiny deterministic PRNG so demo sales are the same on every reload */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDemo() {
  const known = new Set(mockMedicines.map((m) => m.id));
  let batches: StockBatch[] = [...mockStockBatches];
  const movements: StockMovement[] = openingMovements(mockStockBatches);
  const receivedRefs: Record<string, true> = {};

  // 1) Receive stock for invoices entered in the app (oldest first)
  const posted = mockPurchases.filter((p) => p.stockPosted).reverse();
  for (const p of posted) {
    const r = applyReceipt(batches, purchaseToStockReceipt(p), known);
    batches = r.batches;
    movements.push(...r.movements);
    receivedRefs[p.id] = true;
  }

  // 2) Two sample debit notes so the Returns tab isn't empty
  const purchases: Purchase[] = mockPurchases.map((p) => ({ ...p }));
  const returns: PurchaseReturn[] = [];
  const samples: { index: number; reason: ReturnReason; notes: string }[] = [
    { index: 2, reason: "damaged", notes: "Strips crushed in transit" },
    {
      index: 5,
      reason: "near_expiry",
      notes: "Short expiry — supplier agreed to take back",
    },
  ];

  for (const sample of samples) {
    const purchase = purchases.filter((p) => p.stockPosted)[sample.index];
    if (!purchase) continue;
    const returnable = getReturnableLines(purchase, returns, batches);
    const first = returnable.find((r) => r.max > 0);
    if (!first) continue;

    const at = new Date(purchase.createdAt);
    const { ret, issue } = buildPurchaseReturn(
      purchase,
      {
        purchaseId: purchase.id,
        date: toISODate(at),
        reason: sample.reason,
        notes: sample.notes,
        lines: [{ purchaseLineId: first.line.id, qty: Math.min(2, first.max) }],
      },
      returnable,
      nextReturnNo(returns),
      at,
    );
    const r = applyIssue(batches, {
      refId: ret.id,
      type: "purchase_return",
      note: `Return ${ret.returnNo} · ${ret.supplierName}`,
      at,
      lines: issue,
    });
    batches = r.batches;
    movements.push(...r.movements);
    returns.unshift(ret);
    purchase.returnedPaise += ret.totalPaise;
  }

  // 3) Sales history over the last 3 days (oldest first), same rules as the till
  const rand = prng(20261003);
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(rand() * list.length)];
  const medicinesById = new Map<string, Medicine>(
    mockMedicines.map((m) => [m.id, m]),
  );
  const active = mockMedicines.filter((m) => m.status === "active");
  const sales: Sale[] = [];
  const nowMs = Date.now();
  const SALE_COUNT = 18;

  /*
   * 3a) ~3 months of IMPORTED sales history, older than the live demo days.
   * Built with the real buildSale() (same prices, GST, FEFO) but against
   * unlimited copies of the batches, so it never drains today's stock.
   * Patterns are deliberate, so the Reports chart is explainable:
   *   • weekday:  Sunday quiet, Monday busiest
   *   • salary:   1st–5th of the month busier
   *   • season:   slow rise toward today (fever / cold season)
   *   • noise:    ±20% day-to-day, like real life
   */
  {
    const hr = prng(20260701);
    const hpick = <T>(list: readonly T[]) =>
      list[Math.floor(hr() * list.length)];
    const unlimited = batches.map((b) => ({
      ...b,
      qtyStrip: 100_000,
      qtyLoose: 100_000,
    }));
    const WEEKDAY = [0.55, 1.3, 1.05, 1.0, 0.95, 1.1, 1.2]; // Sun … Sat
    const FIRST_DAY = 92;
    const LAST_DAY = 4; // newer days come from the live demo sales below
    const today0 = new Date(nowMs);
    today0.setHours(0, 0, 0, 0);

    for (let ago = FIRST_DAY; ago >= LAST_DAY; ago--) {
      const day = new Date(today0);
      day.setDate(day.getDate() - ago);
      const season = 0.85 + 0.35 * ((FIRST_DAY - ago) / (FIRST_DAY - LAST_DAY));
      const salary = day.getDate() <= 5 ? 1.3 : 1;
      const noise = 0.8 + hr() * 0.4;
      const bills = Math.max(
        1,
        Math.round(8 * WEEKDAY[day.getDay()] * season * salary * noise),
      );

      // Shop hours 9 am – 9 pm, in time order
      const minutes = Array.from(
        { length: bills },
        () => 9 * 60 + Math.floor(hr() * 12 * 60),
      ).sort((x, y) => x - y);

      for (const [i, min] of minutes.entries()) {
        const at = new Date(day.getTime() + min * 60_000);
        const cart: CartLine[] = [];
        const lineCount = 1 + Math.floor(hr() * 3);
        for (let n = 0; n < lineCount * 3 && cart.length < lineCount; n++) {
          const m = hpick(active);
          if (cart.some((c) => c.medicineId === m.id)) continue;
          if (sellableBatches(unlimited, m.id, at).length === 0) continue;
          const loose = m.unit === "LSE" || (sellsLoose(m) && hr() < 0.35);
          cart.push({
            lineId: `hist_${ago}_${i}_${n}`,
            medicineId: m.id,
            qtyStrip: loose ? 0 : 1 + Math.floor(hr() * 2),
            qtyLoose: loose ? 2 + Math.floor(hr() * 9) : 0,
            discountPercent: hr() < 0.15 ? 5 : 0,
          });
        }
        if (cart.length === 0) continue;

        const r = hr();
        const named = hpick(CUSTOMERS.filter((c) => !c.startsWith("Walk-in")));
        const method: PaymentDraft["method"] =
          r < 0.55 ? "cash" : r < 0.83 ? "upi" : r < 0.93 ? "card" : "udhaar";
        const built = buildSale(
          {
            cart,
            customerName: method === "udhaar" ? named : hpick(CUSTOMERS),
            doctor: hpick(DOCTORS),
            counter: hpick(COUNTERS),
            payment: {
              method,
              received: "100000",
              reference: "",
              split: { cash: "", upi: "", card: "" },
            },
          },
          medicinesById,
          unlimited,
          nextBillNo(sales),
          at,
        );
        if (built.sale.payment.method === "cash") {
          const received = Math.ceil(built.sale.totals.netPaise / 5000) * 5000;
          built.sale.payment = {
            ...built.sale.payment,
            receivedPaise: received,
            changePaise: received - built.sale.totals.netPaise,
          };
        }
        built.sale.imported = true;
        sales.push(built.sale);
      }
    }
  }

  for (let i = 0; i < SALE_COUNT; i++) {
    // Oldest ~3 days ago, newest ~20 minutes ago
    const at = new Date(
      nowMs - (SALE_COUNT - i) * 3.7 * 3_600_000 - 20 * 60_000,
    );
    const cart: CartLine[] = [];
    const lineCount = 1 + Math.floor(rand() * 3);
    for (let n = 0; n < lineCount * 3 && cart.length < lineCount; n++) {
      const m = pick(active);
      if (cart.some((c) => c.medicineId === m.id)) continue;
      const sellable = sellableBatches(batches, m.id, at);
      const lim = stockLimits(sellable, m, 0);
      if (lim.maxStrip === 0 && lim.maxLoose === 0) continue;
      const loose =
        (m.unit === "LSE" || (sellsLoose(m) && rand() < 0.35)) &&
        lim.maxLoose > 0;
      cart.push({
        lineId: `seed_${i}_${n}`,
        medicineId: m.id,
        qtyStrip: loose
          ? 0
          : Math.min(lim.maxStrip, 1 + Math.floor(rand() * 2)),
        qtyLoose: loose
          ? Math.min(lim.maxLoose, 2 + Math.floor(rand() * 8))
          : 0,
        discountPercent: rand() < 0.2 ? 5 : 0,
      });
    }
    if (cart.length === 0 || cart.some((c) => c.qtyStrip + c.qtyLoose === 0))
      continue;

    const r = rand();
    const customerName = pick(CUSTOMERS);
    const method: PaymentDraft["method"] =
      r < 0.55 ? "cash" : r < 0.8 ? "upi" : r < 0.9 ? "card" : "udhaar";
    const payment: PaymentDraft = {
      method:
        method === "udhaar" && customerName.startsWith("Walk-in")
          ? "cash"
          : method,
      received: "100000", // cash comfortably above any demo bill
      reference: "",
      split: { cash: "", upi: "", card: "" },
    };
    const built = buildSale(
      {
        cart,
        customerName,
        doctor: pick(DOCTORS),
        counter: pick(COUNTERS),
        payment,
      },
      medicinesById,
      batches,
      nextBillNo(sales),
      at,
    );
    // Realistic cash: received = bill rounded up to the next ₹50
    if (built.sale.payment.method === "cash") {
      const received = Math.ceil(built.sale.totals.netPaise / 5000) * 5000;
      built.sale.payment = {
        ...built.sale.payment,
        receivedPaise: received,
        changePaise: received - built.sale.totals.netPaise,
      };
    }
    const r2 = applyChange(batches, {
      refId: built.sale.id,
      type: "sale",
      note: `Sale ${built.sale.billNo} · ${built.sale.customerName}`,
      at,
      lines: built.change,
    });
    batches = r2.batches;
    movements.push(...r2.movements);
    sales.push(built.sale);
  }

  // 3b) Showcase bill: every medicine type and every quantity combination,
  //     so Sales Return can be tried on all of them
  {
    const at = new Date(nowMs - 10 * 60_000);
    const cart: CartLine[] = [];
    const used = new Set<string>();
    const add = (
      medicineId: string,
      qtyStrip: number,
      qtyLoose: number,
      discountPercent = 0,
    ) => {
      const m = medicinesById.get(medicineId);
      if (!m || m.status !== "active" || used.has(m.id)) return;
      const lim = stockLimits(sellableBatches(batches, m.id, at), m, qtyStrip);
      const strip = Math.min(qtyStrip, lim.maxStrip);
      const loose = Math.min(
        qtyLoose,
        stockLimits(sellableBatches(batches, m.id, at), m, strip).maxLoose,
      );
      if (strip + loose === 0) return;
      used.add(m.id);
      cart.push({
        lineId: `show_${m.id}`,
        medicineId: m.id,
        qtyStrip: strip,
        qtyLoose: loose,
        discountPercent,
      });
    };

    // A line that must come from two batches (FEFO split): smallest first batch
    const splitCandidate = active
      .filter((m) => m.unit === "STP" || m.unit === "BTL")
      .map((m) => ({ m, sellable: sellableBatches(batches, m.id, at) }))
      .filter(
        (x) =>
          x.sellable.length >= 2 &&
          x.sellable[0].qtyStrip > 0 &&
          x.sellable[0].qtyStrip <= 8,
      )
      .sort((x, y) => x.sellable[0].qtyStrip - y.sellable[0].qtyStrip)[0];
    if (splitCandidate)
      add(splitCandidate.m.id, splitCandidate.sellable[0].qtyStrip + 1, 0);

    add("m2", 2, 5); // tablet · strip + loose
    add("m3", 0, 2); // tablet · loose only (a strip is opened)
    add("m4", 1, 0, 10); // tablet · strip only, 10% discount
    add("m30", 0, 10); // loose-only medicine (LSE)
    add("m20", 1, 0); // box
    add("m5", 1, 0); // syrup · bottle
    add("m7", 1, 0); // cream · bottle
    if (!used.has("m7")) add("m8", 1, 0); // another cream if Betadine sold out
    add("m9", 1, 0); // injection · bottle
    add("m14", 1, 0); // eye drops · bottle
    add("m16", 1, 0); // inhaler · bottle
    add("m18", 0, 3); // sachet · loose only
    add("m99", 1, 0); // other · 18% GST

    if (cart.length > 0) {
      const built = buildSale(
        {
          cart,
          customerName: "Sunita Kulkarni (sample: all types)",
          doctor: DOCTORS[0],
          counter: COUNTERS[0],
          payment: {
            method: "upi",
            received: "",
            reference: "UPI-SAMPLE-001",
            split: { cash: "", upi: "", card: "" },
          },
        },
        medicinesById,
        batches,
        nextBillNo(sales),
        at,
      );
      const r = applyChange(batches, {
        refId: built.sale.id,
        type: "sale",
        note: `Sale ${built.sale.billNo} · ${built.sale.customerName}`,
        at,
        lines: built.change,
      });
      batches = r.batches;
      movements.push(...r.movements);
      sales.push(built.sale);
    }
  }

  // 4) One sales return on an older bill
  const saleReturns: SaleReturn[] = [];
  // Never on imported history — it never moved stock
  const returnable = sales.find(
    (s) => !s.imported && s.lines.some((l) => l.qtyStrip > 0),
  );
  if (returnable) {
    const line = returnable.lines.find((l) => l.qtyStrip > 0)!;
    const at = new Date(
      new Date(returnable.createdAt).getTime() + 2 * 3_600_000,
    );
    const { ret, change } = buildSaleReturn(
      returnable,
      {
        saleId: returnable.id,
        reason: "Doctor changed prescription",
        refundMode: "cash",
        notes: "",
        lines: [{ saleLineId: line.id, qtyStrip: 1, qtyLoose: 0 }],
      },
      saleReturns,
      nextSaleReturnNo(saleReturns),
      at,
    );
    const r3 = applyChange(batches, {
      refId: ret.id,
      type: "sale_return",
      note: `Sales return ${ret.returnNo} · ${returnable.billNo}`,
      at,
      lines: change,
    });
    batches = r3.batches;
    movements.push(...r3.movements);
    saleReturns.push(ret);
    returnable.returnedPaise += ret.refundPaise;
  }

  // 5) One parked bill
  const heldMeds = active.filter((m) => m.unit === "STP").slice(0, 2);
  const held: HeldBill[] = [
    {
      id: "held_demo_1",
      heldAt: new Date(nowMs - 25 * 60_000).toISOString(),
      customerName: "Rahul Joshi",
      doctor: DOCTORS[1],
      counter: COUNTERS[0],
      lines: heldMeds.map((m, i) => ({
        lineId: `held_${i}`,
        medicineId: m.id,
        qtyStrip: 1,
        qtyLoose: 0,
        discountPercent: 0,
      })),
    },
  ];

  // Movement log is stored newest first
  movements.sort((a, b) => b.at.localeCompare(a.at));

  return {
    inventory: { batches, movements, receivedRefs },
    purchases,
    returns,
    sales: sales.reverse(),
    saleReturns,
    held,
  };
}

const demo = buildDemo();

export const demoInventory = demo.inventory;
export const demoPurchases = demo.purchases;
export const demoReturns = demo.returns;
export const demoSales = demo.sales;
export const demoSaleReturns = demo.saleReturns;
export const demoHeldBills = demo.held;
