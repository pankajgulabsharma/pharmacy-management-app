import { describe, expect, it } from "vitest";
import { cleanDoctorInfo, doctorDetails, doctorName } from "./doctor";

describe("doctor names", () => {
  it("always Dr. + name, degrees in capitals", () => {
    expect(doctorName("anita mehta")).toBe("Dr. Anita Mehta");
    expect(doctorName("  dr anita   mehta, mbbs ")).toBe(
      "Dr. Anita Mehta, MBBS",
    );
    expect(doctorName("Dr.Prakash Iyer, md (cardiologist)")).toBe(
      "Dr. Prakash Iyer, MD (cardiologist)",
    );
    expect(doctorName("DOCTOR suresh RAO")).toBe("Dr. Suresh RAO");
    expect(doctorName("Dr. Kavita Shah, MBBS")).toBe("Dr. Kavita Shah, MBBS");
    expect(doctorName("drishti verma")).toBe("Dr. Drishti Verma");
    expect(doctorName("rohan desai md")).toBe("Dr. Rohan Desai, MD");
    expect(doctorName("dr")).toBe("");
    expect(doctorName("   ")).toBe("");
  });
  it("details kept only for listed doctors", () => {
    const info = cleanDoctorInfo(
      {
        "Dr. A": {
          regNo: " MMC 1234 ",
          clinic: "City Clinic",
          phone: "98200 12345x",
        },
        "Dr. Gone": { regNo: "1" },
        "Dr. Empty": { regNo: "" },
      },
      ["Dr. A", "Dr. Empty"],
    );
    expect(info).toEqual({
      "Dr. A": {
        regNo: "MMC 1234",
        clinic: "City Clinic",
        phone: "98200 12345",
      },
    });
    expect(doctorDetails(info["Dr. A"])).toBe("Reg. MMC 1234 · City Clinic");
  });
});
