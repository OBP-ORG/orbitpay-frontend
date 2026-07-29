import { describe, expect, it } from "vitest";

import {
  ValidationError,
  parseDecimalToBaseUnit,
  validateBaseUnitAmount,
  validatePositiveBaseUnitAmount,
  validateStellarAddress,
} from "../validation";

const VALID_ADDRESS = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";

describe("validateStellarAddress", () => {
  it("accepts a well-formed public key", () => {
    expect(validateStellarAddress(VALID_ADDRESS)).toBe(VALID_ADDRESS);
  });

  it("rejects a string that doesn't start with G", () => {
    expect(() => validateStellarAddress("C" + VALID_ADDRESS.slice(1))).toThrow(
      ValidationError,
    );
  });

  it("rejects a key of the wrong length", () => {
    expect(() => validateStellarAddress("GABC")).toThrow(ValidationError);
  });
});

describe("validateBaseUnitAmount", () => {
  it("accepts a non-negative integer string", () => {
    expect(validateBaseUnitAmount("0")).toBe("0");
  });

  it("rejects negative or non-numeric strings", () => {
    expect(() => validateBaseUnitAmount("-1")).toThrow(ValidationError);
    expect(() => validateBaseUnitAmount("1.5")).toThrow(ValidationError);
  });

  it("rejects amounts above the i128 maximum", () => {
    expect(() =>
      validateBaseUnitAmount("170141183460469231731687303715884105728"),
    ).toThrow(/i128 maximum/);
  });
});

describe("validatePositiveBaseUnitAmount", () => {
  it("rejects zero", () => {
    expect(() => validatePositiveBaseUnitAmount("0")).toThrow(
      /greater than zero/,
    );
  });
});

describe("parseDecimalToBaseUnit", () => {
  it("converts a decimal string to base units using integer arithmetic", () => {
    expect(parseDecimalToBaseUnit("1.25", 7)).toBe("12500000");
  });

  it("pads sub-minimal fractional precision", () => {
    expect(parseDecimalToBaseUnit("0.001", 7)).toBe("10000");
  });

  it("rejects empty input", () => {
    expect(() => parseDecimalToBaseUnit("", 7)).toThrow("Amount is required");
  });
});
