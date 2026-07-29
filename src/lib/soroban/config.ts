/**
 * Soroban network + contract configuration for the write-path transaction
 * lifecycle (treasury propose/approve/execute, governance propose/vote/execute).
 *
 * Contract IDs are read from env vars rather than hardcoded so this module
 * works against whichever testnet (or later, mainnet) deployment the running
 * environment points at. Until `NEXT_PUBLIC_TREASURY_CONTRACT_ID` /
 * `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` are set, the corresponding
 * `isTreasuryConfigured()` / `isGovernanceConfigured()` guards return false so
 * calling code can show a "not configured" state instead of a confusing
 * runtime error. See `.env.example`.
 */

import { STELLAR_NETWORK_PASSPHRASES, type StellarNetwork } from "@/lib/domain";

export const SOROBAN_NETWORK: StellarNetwork =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

export const SOROBAN_NETWORK_PASSPHRASE = STELLAR_NETWORK_PASSPHRASES[SOROBAN_NETWORK];

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

export const TREASURY_CONTRACT_ID = process.env.NEXT_PUBLIC_TREASURY_CONTRACT_ID ?? "";
export const GOVERNANCE_CONTRACT_ID = process.env.NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID ?? "";

export function isTreasuryConfigured(): boolean {
  return TREASURY_CONTRACT_ID.length > 0;
}

export function isGovernanceConfigured(): boolean {
  return GOVERNANCE_CONTRACT_ID.length > 0;
}
