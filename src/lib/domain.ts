/**
 * OrbitPay shared financial domain models.
 *
 * These types define the canonical shapes for Stellar primitives, token
 * amounts, contract identifiers, and protocol-level statuses used across
 * the frontend and SDK layers.
 *
 * All financial values are stored in their Stellar-native representations
 * (base units / stroops) and converted to/from display strings at the
 * UI boundary only.
 */

// ── Stellar Primitives ──────────────────────────────────────────────────────

/**
 * A validated Stellar public key (G…).
 * The tag prevents accidental use of raw strings in financial contexts.
 */
declare const StellarAddressBrand: unique symbol;
export type StellarAddress = string & { [StellarAddressBrand]: true };

/**
 * A validated Stellar contract ID (C…).
 */
declare const ContractIdBrand: unique symbol;
export type ContractId = string & { [ContractIdBrand]: true };

/**
 * A Soroban token identifier (contract address of a SEP-41 token).
 */
declare const TokenIdentifierBrand: unique symbol;
export type TokenIdentifier = string & { [TokenIdentifierBrand]: true };

// ── Amount Types ────────────────────────────────────────────────────────────

/**
 * A token amount in its base unit (stroops for XLM, smallest unit for other
 * tokens). Always an integer string to preserve precision.
 */
declare const BaseUnitAmountBrand: unique symbol;
export type BaseUnitAmount = string & { [BaseUnitAmountBrand]: true };

/**
 * A decimal-formatted amount string suitable for display (e.g. "450,000.00").
 * Never used for accounting calculations.
 */
declare const DecimalAmountBrand: unique symbol;
export type DecimalAmount = string & { [DecimalAmountBrand]: true };

// ── Network ─────────────────────────────────────────────────────────────────

export type StellarNetwork = "testnet" | "mainnet";

export const STELLAR_NETWORK_PASSPHRASES = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
} as const;

// ── Protocol Statuses ───────────────────────────────────────────────────────

export type StreamStatus = "Active" | "Paused" | "Cancelled" | "Completed";

export type VestingScheduleStatus = "Active" | "Revoked" | "FullyClaimed";

export type ProposalStatus =
  | "Active"
  | "Approved"
  | "Rejected"
  | "Executed"
  | "Cancelled"
  | "Expired";

export type TransactionStatus = "Pending" | "Ready" | "Executed" | "Cancelled" | "Expired";

// ── Domain Entities ─────────────────────────────────────────────────────────

export interface TreasuryConfig {
  admin: StellarAddress;
  signers: StellarAddress[];
  threshold: number;
  balance: BaseUnitAmount;
  txCount: number;
}

export interface WithdrawalProposal {
  id: string;
  proposer: StellarAddress;
  recipient: StellarAddress;
  token: TokenIdentifier;
  amount: BaseUnitAmount;
  memo: string;
  approvals: StellarAddress[];
  status: TransactionStatus;
  threshold: number;
  createdAt: string;
}

export interface PayrollStream {
  id: string;
  sender: StellarAddress;
  recipient: StellarAddress;
  token: TokenIdentifier;
  totalAmount: BaseUnitAmount;
  claimedAmount: BaseUnitAmount;
  startTime: string;
  endTime: string;
  status: StreamStatus;
  ratePerSecond: BaseUnitAmount;
}

export interface VestingSchedule {
  id: string;
  grantor: StellarAddress;
  beneficiary: StellarAddress;
  token: TokenIdentifier;
  totalAmount: BaseUnitAmount;
  claimedAmount: BaseUnitAmount;
  label: string;
  cliffDuration: number;
  totalDuration: number;
  status: VestingScheduleStatus;
  revocable: boolean;
}

export interface GovernanceProposal {
  id: string;
  proposer: StellarAddress;
  title: string;
  description: string;
  action: "Funding" | "PolicyChange" | "AddMember" | "RemoveMember" | "General";
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  totalWeight: number;
  quorum: number;
  amount: BaseUnitAmount | null;
  recipient: StellarAddress | null;
  endTime: string;
}
