import { describe, expect, it } from "vitest";
import { libraryToForm, parsePack, suggestSchedule } from "./library";
import { emptyMedicineForm } from "./types";

describe("Medicine Library → medicine form", () => {
  it("reads the pack label", () => {
    expect(parsePack("strip of 15 tablets")).toEqual({
      unit: "STP",
      unitsPerStrip: 15,
      allowLoose: true,
      category: "tablet_capsule",
    });
    expect(parsePack("bottle of 100 ml Syrup")).toMatchObject({
      unit: "BTL",
      unitsPerStrip: 1,
      category: "syrup_suspension",
    });
    expect(parsePack("vial of 1 Powder for Injection").category).toBe(
      "injection",
    );
    expect(parsePack("bottle of 10 ml Eye Drop").category).toBe("drops");
    expect(parsePack("packet of 200 MDI Inhaler").category).toBe("inhaler");
    expect(parsePack("tube of 30 gm Cream").category).toBe("cream_ointment");
    expect(parsePack("sachet of 1 gm Granules").category).toBe("sachet_powder");
    expect(
      parsePack("bottle of 60 ml Powder for Oral Suspension").category,
    ).toBe("syrup_suspension");
    expect(parsePack("strip of 1 tablet").unit).toBe("BTL");
    expect(parsePack("1 kit")).toMatchObject({
      unit: "BTL",
      category: "other",
    });
  });

  it("suggests H1 from the salt", () => {
    expect(suggestSchedule("Cefixime (200mg) + Ofloxacin (200mg)")).toBe("H1");
    expect(suggestSchedule("Tramadol (37.5mg) + Paracetamol (325mg)")).toBe(
      "H1",
    );
    expect(suggestSchedule("Rifampin (450mg)")).toBe("H1");
    expect(suggestSchedule("Sodium Para Aminosalicylate (1gm)")).toBe("H1");
    expect(suggestSchedule("Paracetamol (650mg)")).toBe("");
    // a word inside another word is not a match
    expect(suggestSchedule("Xcodeine")).toBe("");
  });

  it("fills the form; the shop checks and saves", () => {
    const f = libraryToForm(
      {
        id: 1,
        name: "Taxim-O 200 Tablet",
        company: "Alkem Laboratories Ltd",
        mrpPaise: 10_950,
        pack: "strip of 10 tablets",
        salt: "Cefixime (200mg)",
      },
      { ...emptyMedicineForm(), rack: "A-3" },
    );
    expect(f).toMatchObject({
      name: "Taxim-O 200 Tablet",
      brand: "Alkem Laboratories Ltd",
      // the strength gets its own field
      salt: "Cefixime",
      strength: "200 mg",
      unit: "STP",
      unitsPerStrip: "10",
      hsn: "3004",
      mrp: "109.50",
      salePrice: "109.50",
      schedule: "H1",
      rack: "A-3",
    });
  });
});
