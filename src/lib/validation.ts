/**
 * OrbitPay runtime validation for Stellar financial primitives.
 *
 * Every function validates its input and returns either the branded type
 * or a descriptive error string. Financial forms must call these BEFORE
 * simulation or signing — never pass unchecked strings to contracts.
 *
 * None of these functions use `parseInt`, `parseFloat`, or display strings
 * for accounting values.
 */

import type {
  StellarAddress,
  ContractId,
  TokenIdentifier,
  BaseUnitAmount,
  StellarNetwork,
  StreamStatus,
  VestingScheduleStatus,
  ProposalStatus,
} from "./domain";

// ── Stellar Address (G…) ────────────────────────────────────────────────────

const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;

export function validateStellarAddress(input: string): StellarAddress {
  if (STELLAR_PUBLIC_KEY_RE.test(input)) {
    return input as StellarAddress;
  }
  throw new ValidationError(`Invalid Stellar address: must start with "G" and be 56 alphanumeric characters`);
}

export function isStellarAddress(input: string): input is StellarAddress {
  return STELLAR_PUBLIC_KEY_RE.test(input);
}

// ── Contract ID (C…) ────────────────────────────────────────────────────────

const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

export function validateContractId(input: string): ContractId {
  if (CONTRACT_ID_RE.test(input)) {
    return input as ContractId;
  }
  throw new ValidationError(`Invalid contract ID: must start with "C" and be 56 alphanumeric characters`);
}

export function isContractId(input: string): input is ContractId {
  return CONTRACT_ID_RE.test(input);
}

// ── Token Identifier (contract address) ──────────────────────────────────────

export function validateTokenIdentifier(input: string): TokenIdentifier {
  try {
    validateContractId(input);
    return input as TokenIdentifier;
  } catch {
    // Not a contract ID; try as Stellar address (native XLM)
    if (STELLAR_PUBLIC_KEY_RE.test(input)) {
      return input as TokenIdentifier;
    }
    throw new ValidationError(`Invalid token identifier: must be a valid contract ID or Stellar address`);
  }
}

// ── Amounts ─────────────────────────────────────────────────────────────────

const BASE_UNIT_RE = /^[0-9]+$/;

export function validateBaseUnitAmount(input: string): BaseUnitAmount {
  if (!BASE_UNIT_RE.test(input)) {
    throw new ValidationError(`Invalid base-unit amount: must be a non-negative integer string`);
  }
  // Prevent unreasonably large amounts (> i128 max)
  if (BigInt(input) > BigInt("170141183460469231731687303715884105727")) {
    throw new ValidationError(`Amount exceeds i128 maximum`);
  }
  return input as BaseUnitAmount;
}

export function validatePositiveBaseUnitAmount(input: string): BaseUnitAmount {
  const amount = validateBaseUnitAmount(input);
  if (BigInt(amount) === BigInt(0)) {
    throw new ValidationError(`Amount must be greater than zero`);
  }
  return amount;
}

/**
 * Parse a decimal string (e.g. "1.25") to base units (stroops) for a given
 * number of decimals. Uses integer arithmetic — never floats.
 *
 * @example
 * parseDecimalToBaseUnit("1.25", 7) → "12500000"
 * parseDecimalToBaseUnit("0.001", 7) → "10000"
 */
export function parseDecimalToBaseUnit(decimal: string, decimals: number): BaseUnitAmount {
  const trimmed = decimal.trim();
  if (!trimmed) throw new ValidationError("Amount is required");

  // Split into whole and fractional parts
  const parts = trimmed.split(".");
  if (parts.length > 2) throw new ValidationError("Invalid decimal format: multiple decimal points");

  const whole = parts[0].replace(/^0+/, "") || "0";
  let fractional = parts.length === 2 ? parts[1] : "";

  if (fractional.length > decimals) {
    throw new ValidationError(`Amount cannot have more than ${decimals} decimal places`);
  }

  fractional = fractional.padEnd(decimals, "0");

  const wholePart = BigInt(whole) * BigInt(10) ** BigInt(decimals);
  const fracPart = fractional ? BigInt(fractional) : BigInt(0);
  const result = wholePart + fracPart;

  return String(result) as BaseUnitAmount;
}

// ── Network ─────────────────────────────────────────────────────────────────

export function validateNetwork(input: string): StellarNetwork {
  if (input === "testnet" || input === "mainnet") {
    return input;
  }
  throw new ValidationError(`Invalid network: must be "testnet" or "mainnet"`);
}

// ── Statuses ────────────────────────────────────────────────────────────────

const STREAM_STATUSES: readonly StreamStatus[] = ["Active", "Paused", "Cancelled", "Completed"];
const VESTING_STATUSES: readonly VestingScheduleStatus[] = ["Active", "Revoked", "FullyClaimed"];
const PROPOSAL_STATUSES: readonly ProposalStatus[] = ["Active", "Approved", "Rejected", "Executed", "Cancelled", "Expired"];

export function validateStreamStatus(input: string): StreamStatus {
  if ((STREAM_STATUSES as readonly string[]).includes(input)) {
    return input as StreamStatus;
  }
  throw new ValidationError(`Invalid stream status: ${input}`);
}

export function validateVestingStatus(input: string): VestingScheduleStatus {
  if ((VESTING_STATUSES as readonly string[]).includes(input)) {
    return input as VestingScheduleStatus;
  }
  throw new ValidationError(`Invalid vesting status: ${input}`);
}

export function validateProposalStatus(input: string): ProposalStatus {
  if ((PROPOSAL_STATUSES as readonly string[]).includes(input)) {
    return input as ProposalStatus;
  }
  throw new ValidationError(`Invalid proposal status: ${input}`);
}

// ── Dates ───────────────────────────────────────────────────────────────────

export function validateFutureDate(input: string | number): void {
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    throw new ValidationError("Invalid date");
  }
  if (date.getTime() <= Date.now()) {
    throw new ValidationError("Date must be in the future");
  }
}

export function validateDateRange(start: string, end: string): void {
  validateFutureDate(start);
  validateFutureDate(end);
  if (new Date(end) <= new Date(start)) {
    throw new ValidationError("End date must be after start date");
  }
}

// ── Error type ──────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }

  /** Format error for screen reader announcement. */
  toLiveRegion(): string {
    return `Validation error: ${this.message}`;
  }
}
