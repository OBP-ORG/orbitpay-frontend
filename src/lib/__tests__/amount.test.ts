import { describe, expect, it } from "vitest";

import {
  formatBaseUnit,
  parseDisplayAmountToBaseUnit,
  stroopsToXLM,
  xlmToStroops,
} from "../amount";

describe("formatBaseUnit", () => {
  it("formats large whole units with thousands separators", () => {
    expect(formatBaseUnit("1000000012500000", 7, "USDC")).toBe(
      "100,000,001.25 USDC",
    );
  });

  it("trims trailing fractional zeros, including down to a bare whole number", () => {
    expect(formatBaseUnit("12500000", 7)).toBe("1.25");
    expect(formatBaseUnit("1000000000", 7, "USDC")).toBe("100 USDC");
  });

  it("formats zero as a bare zero", () => {
    expect(formatBaseUnit("0", 7)).toBe("0");
  });

  it("preserves precision for large amounts without floating-point drift", () => {
    // 123456789.1234567, well past Number's safe-integer precision.
    expect(formatBaseUnit("1234567891234567", 7)).toBe("123,456,789.1234567");
  });
});

describe("parseDisplayAmountToBaseUnit / formatBaseUnit round-trip", () => {
  it("round-trips a comma-formatted amount through base units", () => {
    const baseUnit = parseDisplayAmountToBaseUnit("1,250.5", 7);
    expect(baseUnit).toBe("12505000000");
    expect(formatBaseUnit(baseUnit, 7)).toBe("1,250.5");
  });

  it("rejects more fractional digits than the token supports", () => {
    expect(() => parseDisplayAmountToBaseUnit("1.12345678", 7)).toThrow(
      /more than 7 decimal places/,
    );
  });
});

describe("XLM convenience helpers", () => {
  it("converts stroops to a display string with the XLM suffix", () => {
    expect(stroopsToXLM("12500000")).toBe("1.25 XLM");
  });

  it("converts a display string back to stroops", () => {
    expect(xlmToStroops("1.25 XLM")).toBe("12500000");
  });
});
