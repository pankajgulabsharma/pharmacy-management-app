import { describe, expect, it } from "vitest";
import {
  cleanStrength,
  compositionKey,
  guessStrength,
  medicineComposition,
  splitSalt,
  strengthKey,
  substituteQuery,
} from "./strength";

describe("strength", () => {
  it("is written one way", () => {
    expect(cleanStrength("650MG")).toBe("650 mg");
    expect(cleanStrength("250mg/5ml")).toBe("250 mg/5 ml");
    expect(cleanStrength("0.1 % w/w")).toBe("0.1% w/w");
    expect(cleanStrength("500mg+125mg")).toBe("500 mg + 125 mg");
    expect(cleanStrength("60000 IU")).toBe("60000 iu");
    expect(cleanStrength("2 gm")).toBe("2 g");
  });

  it("compares 1 g with 1000 mg, ignoring spaces and case", () => {
    expect(strengthKey("1 g")).toBe(strengthKey("1000mg"));
    expect(strengthKey("650 MG")).toBe(strengthKey("650mg"));
    expect(strengthKey("500 mg")).not.toBe(strengthKey("650 mg"));
  });

  it("splits a library salt into ingredients + strength", () => {
    expect(splitSalt("Amoxycillin (500mg) + Clavulanic Acid (125mg)")).toEqual({
      salt: "Amoxycillin + Clavulanic Acid",
      strength: "500 mg + 125 mg",
    });
    expect(splitSalt("Paracetamol")).toEqual({
      salt: "Paracetamol",
      strength: "",
    });
    // one ingredient without a strength → strength unknown
    expect(splitSalt("Zinc (20mg) + Vitamins").strength).toBe("");
  });

  it("guesses from the name for medicines saved before", () => {
    const tab = (name: string, salt = "Paracetamol") =>
      guessStrength({ name, salt, category: "tablet_capsule" });
    expect(tab("Dolo 650 Tablet")).toBe("650 mg");
    expect(tab("Pan 40mg Tablet", "Pantoprazole")).toBe("40 mg");
    expect(tab("Crocin Advance Tablet")).toBe("");
    expect(tab("X", "Cefixime (200mg)")).toBe("200 mg");
    // a lone number on a syrup is NOT a strength (could be the ml)
    expect(
      guessStrength({
        name: "Ascoril 100 Syrup",
        salt: "Ambroxol",
        category: "syrup_suspension",
      }),
    ).toBe("");
  });
});

describe("substitutes: same salt + same strength + same form", () => {
  const key = (salt: string, strength: string, category = "tablet_capsule") =>
    compositionKey({
      salt,
      strength,
      category: category as "tablet_capsule",
    });

  it("Dolo 650 = Calpol 650, but not Calpol 500 or paracetamol syrup", () => {
    const dolo = key("Paracetamol", "650 mg");
    expect(key("Paracetamol", "650mg")).toBe(dolo);
    expect(key("Paracetamol", "500 mg")).not.toBe(dolo);
    expect(key("Paracetamol", "650 mg", "syrup_suspension")).not.toBe(dolo);
  });

  it("a combination needs every ingredient (any order, spelling variants)", () => {
    const augmentin = key("Amoxycillin + Clavulanic Acid", "500 mg + 125 mg");
    expect(key("Clavulanic Acid + Amoxicillin", "125 mg + 500 mg")).toBe(
      augmentin,
    );
    expect(key("Amoxicillin", "500 mg")).not.toBe(augmentin);
  });

  it("unknown strength or salt is never a substitute", () => {
    expect(key("Paracetamol", "")).toBeNull();
    expect(key("", "650 mg")).toBeNull();
  });

  it("a library item matches a shop medicine saved the old way", () => {
    const lib = splitSalt("Paracetamol (650mg)");
    const fromLibrary = key(lib.salt, lib.strength);
    const oldShopMedicine = medicineComposition({
      name: "Dolo 650 Tablet",
      salt: "Paracetamol",
      category: "tablet_capsule",
    });
    expect(oldShopMedicine).toBe(fromLibrary);
  });
});

describe("substituteQuery", () => {
  it("salt words + strength numbers", () => {
    expect(
      substituteQuery("Amoxycillin (500mg) + Clavulanic Acid (125mg)"),
    ).toBe("Amoxycillin Clavulanic Acid 500 125");
    expect(substituteQuery("Paracetamol", "650 mg")).toBe("Paracetamol 650");
  });
});
