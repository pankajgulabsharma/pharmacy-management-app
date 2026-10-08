import type { Sale } from "@medicare/domain/billing/types";

/** A small made-up bill for "Print a test bill" */
export function sampleSale(): Sale {
  return {
    id: "test",
    billNo: "TEST-0001",
    createdAt: new Date().toISOString(),
    customerName: "Test print",
    doctor: "",
    counter: "Counter 1",
    billedBy: "",
    status: "paid",
    returnedPaise: 0,
    lines: [
      {
        id: "t1",
        medicineId: "t",
        medicineName: "Paracetamol 650mg Tablet",
        brand: "Sample",
        hsn: "30049099",
        unit: "STP",
        unitsPerStrip: 10,
        gstPercent: 5,
        discountPercent: 0,
        qtyStrip: 2,
        qtyLoose: 0,
        grossPaise: 8400,
        discountPaise: 0,
        amountPaise: 8400,
        taxablePaise: 8000,
        gstPaise: 400,
        allocations: [
          {
            batchId: "t",
            batchNo: "TEST01",
            expiry: "12/27",
            qtyStrip: 2,
            qtyLoose: 0,
            breakStrips: 0,
            ratePaise: 4200,
            mrpPaise: 4800,
            costPaise: 0,
          },
        ],
      },
    ],
    totals: {
      itemCount: 1,
      grossPaise: 8400,
      discountPaise: 0,
      taxablePaise: 8000,
      cgstPaise: 200,
      sgstPaise: 200,
      gstPaise: 400,
      roundOffPaise: 0,
      netPaise: 8400,
    },
    payment: {
      method: "cash",
      receivedPaise: 10000,
      changePaise: 1600,
      split: null,
      reference: "",
    },
  } as Sale;
}
