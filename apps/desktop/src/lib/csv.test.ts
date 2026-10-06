import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("CSV export", () => {
  it("neutralises spreadsheet formulas (CSV injection)", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(
      `"'=HYPERLINK(""http://x"")"`,
    );
    expect(csvCell("+91 98200")).toBe("'+91 98200");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("keeps real negative numbers as numbers (also when given as text)", () => {
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell("-6312.55")).toBe("-6312.55");
    // …but "-1+2" is not a plain number, so it is still neutralised
    expect(csvCell("-1+2")).toBe("'-1+2");
  });

  it("quotes commas, quotes and new lines", () => {
    expect(csvCell('Shop 4, "A" wing')).toBe('"Shop 4, ""A"" wing"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("builds a UTF-8 CSV with a header row", () => {
    const csv = toCsv(
      [{ n: "Dolo", v: 2 }],
      [
        { header: "Name", value: (r) => r.n },
        { header: "Qty", value: (r) => r.v },
      ],
    );
    expect(csv).toBe("\uFEFFName,Qty\r\nDolo,2");
  });
});
