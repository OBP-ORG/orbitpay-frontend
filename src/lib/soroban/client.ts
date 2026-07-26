/**
 * Contract client factories for the treasury and governance contracts.
 *
 * `contract.Client.from` fetches the deployed contract's spec directly from
 * chain (by contract ID), so no generated bindings or ABI need to be checked
 * into this repo — the same client works against whichever build of the
 * contract is actually deployed at the configured address. Each generated
 * method returns an `AssembledTransaction`, which auto-populates its
 * `errorTypes` from that same on-chain spec (see `errors.ts`'s module doc).
 */

import { contract } from "@stellar/stellar-sdk";
import {
  GOVERNANCE_CONTRACT_ID,
  SOROBAN_NETWORK_PASSPHRASE,
  SOROBAN_RPC_URL,
  TREASURY_CONTRACT_ID,
} from "./config";
import type { SignTransaction } from "@/contexts/FreighterContext";

export interface WalletSigner {
  publicKey: string;
  signTransaction: SignTransaction;
}

function buildClientOptions(contractId: string, signer: WalletSigner | null): contract.ClientOptions {
  return {
    contractId,
    networkPassphrase: SOROBAN_NETWORK_PASSPHRASE,
    rpcUrl: SOROBAN_RPC_URL,
    allowHttp: false,
    publicKey: signer?.publicKey,
    signTransaction: signer?.signTransaction,
  };
}

export function getTreasuryClient(signer: WalletSigner | null): Promise<contract.Client> {
  return contract.Client.from(buildClientOptions(TREASURY_CONTRACT_ID, signer));
}

export function getGovernanceClient(signer: WalletSigner | null): Promise<contract.Client> {
  return contract.Client.from(buildClientOptions(GOVERNANCE_CONTRACT_ID, signer));
}
