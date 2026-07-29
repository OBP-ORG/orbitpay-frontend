/**
 * OrbitPay amount conversion utilities.
 *
 * All financial arithmetic uses BigInt integer operations. Display-formatted
 * strings are never parsed for accounting — only format() converts base units
 * to display strings.
 */

import type { BaseUnitAmount, DecimalAmount } from "./domain";

import { validateBaseUnitAmount } from "./validation";

/**
 * Format a base-unit amount to a display string with thousands separators
 * and the given number of decimal places.
 *
 * @example
 * formatBaseUnit("12500000", 7) → "1.25"
 * formatBaseUnit("12500000", 7, "XLM") → "1.25 XLM"
 * formatBaseUnit("1000000000", 7, "USDC") → "100 USDC"
 *
 * Uses integer arithmetic — never floating-point.
 */
export function formatBaseUnit(
  baseUnit: BaseUnitAmount | string,
  decimals: number,
  tokenSymbol?: string,
): DecimalAmount {
  const value = typeof baseUnit === "string" ? validateBaseUnitAmount(baseUnit) : baseUnit;

  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = BigInt(value) / divisor;
  const fractional = BigInt(value) % divisor;

  const fracStr = String(fractional).padStart(decimals, "0");

  // Trim trailing zeros from fractional part
  let trimmed = "";
  for (let i = fracStr.length - 1; i >= 0; i--) {
    if (fracStr[i] !== "0" || trimmed.length > 0) {
      trimmed = fracStr[i] + trimmed;
    }
  }

  const wholeWithCommas = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const result = trimmed ? `${wholeWithCommas}.${trimmed}` : wholeWithCommas;

  return (tokenSymbol ? `${result} ${tokenSymbol}` : result) as DecimalAmount;
}

/**
 * Parse a display-formatted amount string to base units.
 * Handles commas and trailing token symbols.
 *
 * @example
 * parseDisplayAmount("1,250.5", 7) → "12505000000"
 * parseDisplayAmount("100", 7) → "1000000000"
 */
export function parseDisplayAmountToBaseUnit(
  display: string,
  decimals: number,
): BaseUnitAmount {
  // Strip token symbols and whitespace
  const cleaned = display
    .replace(/[A-Za-z]+/g, "")
    .replace(/,/g, "")
    .trim();

  if (!cleaned) {
    throw new Error("Invalid amount: empty after cleaning");
  }

  const parts = cleaned.split(".");

  if (parts.length > 2) {
    throw new Error("Invalid amount: multiple decimal points");
  }

  const whole = parts[0] || "0";
  let fractional = parts.length === 2 ? parts[1] : "";

  if (fractional.length > decimals) {
    throw new Error(`Amount cannot have more than ${decimals} decimal places`);
  }

  fractional = fractional.padEnd(decimals, "0");

  const wholePart = BigInt(whole) * BigInt(10) ** BigInt(decimals);
  const fracPart = fractional ? BigInt(fractional) : BigInt(0);

  const result = wholePart + fracPart;

  return String(result) as BaseUnitAmount;
}

/**
 * XLM uses 7 decimal places.
 */
export const XLM_DECIMALS = 7;

/**
 * Convenience: format stroops to XLM display string.
 */
export function stroopsToXLM(stroops: BaseUnitAmount | string): DecimalAmount {
  return formatBaseUnit(stroops, XLM_DECIMALS, "XLM");
}

/**
 * Convenience: parse XLM display string to stroops.
 */
export function xlmToStroops(display: string): BaseUnitAmount {
  return parseDisplayAmountToBaseUnit(display, XLM_DECIMALS);
}
