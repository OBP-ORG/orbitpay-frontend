/**
 * Treasury contract write/read wrappers, built on the shared tx lifecycle.
 *
 * Method and argument names below (`propose_withdrawal`, `recipient`, …)
 * follow this repo's STYLE.md Rust naming conventions (`snake_case` public
 * functions) and the shape described in issue #8 / the treasury page's
 * existing mock data (multi-sig withdrawal proposals with a signer
 * threshold, pause switch, and per-withdrawal timelock). No treasury
 * contract is deployed/checked into this repo yet to confirm these against a
 * live spec — once one is, this is the single place to align method/arg
 * names if they differ; every caller goes through these functions rather
 * than naming the contract method inline.
 */

import type { contract } from "@stellar/stellar-sdk";
import { getTreasuryClient, type WalletSigner } from "./client";
import { runInvocation, type LifecycleResult } from "./txLifecycle";
import { isTreasuryConfigured } from "./config";

export interface TreasuryConfigView {
  admin: string;
  signers: string[];
  threshold: number;
  balance: bigint;
  paused: boolean;
}

export interface WithdrawalView {
  id: number;
  proposer: string;
  recipient: string;
  amount: bigint;
  memo: string;
  approvals: string[];
  threshold: number;
  executed: boolean;
  /** Unix seconds; withdrawal cannot execute before this even once threshold is met. */
  timelockExpiresAt: number;
}

async function client(signer: WalletSigner | null): Promise<contract.Client> {
  return getTreasuryClient(signer);
}

/** Dynamic per-contract methods aren't in `contract.Client`'s static type — see module doc. */
type DynamicClient = contract.Client & Record<string, (...args: unknown[]) => Promise<contract.AssembledTransaction<unknown>>>;

export { isTreasuryConfigured };

export async function getTreasuryConfig(): Promise<LifecycleResult<TreasuryConfigView>> {
  const c = (await client(null)) as DynamicClient;
  return runInvocation(() => c.get_config() as Promise<contract.AssembledTransaction<TreasuryConfigView>>);
}

export async function getWithdrawal(id: number): Promise<LifecycleResult<WithdrawalView>> {
  const c = (await client(null)) as DynamicClient;
  return runInvocation(
    () => c.get_withdrawal({ id }) as Promise<contract.AssembledTransaction<WithdrawalView>>,
  );
}

export async function proposeWithdrawal(
  signer: WalletSigner,
  args: { recipient: string; amount: bigint; memo: string },
  onStage?: Parameters<typeof runInvocation>[1],
): Promise<LifecycleResult<number>> {
  const c = (await client(signer)) as DynamicClient;
  return runInvocation(
    () => c.propose_withdrawal(args) as Promise<contract.AssembledTransaction<number>>,
    onStage,
  );
}

export async function approveWithdrawal(
  signer: WalletSigner,
  id: number,
  onStage?: Parameters<typeof runInvocation>[1],
): Promise<LifecycleResult<void>> {
  const c = (await client(signer)) as DynamicClient;
  return runInvocation(
    () => c.approve_withdrawal({ id }) as Promise<contract.AssembledTransaction<void>>,
    onStage,
  );
}

export async function executeWithdrawal(
  signer: WalletSigner,
  id: number,
  onStage?: Parameters<typeof runInvocation>[1],
): Promise<LifecycleResult<void>> {
  const c = (await client(signer)) as DynamicClient;
  return runInvocation(
    () => c.execute_withdrawal({ id }) as Promise<contract.AssembledTransaction<void>>,
    onStage,
  );
}
