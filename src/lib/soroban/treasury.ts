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

/**
 * `contract.Client.from()` loads the deployed spec and decodes each return
 * value. The SDK cannot infer those dynamically loaded methods, so this is
 * the typed boundary between the contract client and the application.
 */
type TreasuryClient = contract.Client & {
  get_config(): Promise<contract.AssembledTransaction<TreasuryConfigView>>;
  get_withdrawal(args: { id: number }): Promise<contract.AssembledTransaction<WithdrawalView>>;
  propose_withdrawal(args: { recipient: string; amount: bigint; memo: string }): Promise<contract.AssembledTransaction<number>>;
  approve_withdrawal(args: { id: number }): Promise<contract.AssembledTransaction<void>>;
  execute_withdrawal(args: { id: number }): Promise<contract.AssembledTransaction<void>>;
};

export { isTreasuryConfigured };

async function read<T>(build: () => Promise<contract.AssembledTransaction<T>>): Promise<T> {
  const result = await runInvocation(build);
  if (result.status === "error") throw new Error(result.message);
  return result.result;
}

export async function getTreasuryConfig(): Promise<TreasuryConfigView> {
  const c = (await client(null)) as TreasuryClient;
  return read(() => c.get_config());
}

export async function getWithdrawal(id: number): Promise<WithdrawalView> {
  const c = (await client(null)) as TreasuryClient;
  return read(() => c.get_withdrawal({ id }));
}

export async function proposeWithdrawal(
  signer: WalletSigner,
  args: { recipient: string; amount: bigint; memo: string },
  onStage?: Parameters<typeof runInvocation>[1],
): Promise<LifecycleResult<number>> {
  const c = (await client(signer)) as TreasuryClient;
  return runInvocation(
    () => c.propose_withdrawal(args),
    onStage,
  );
}

export async function approveWithdrawal(
  signer: WalletSigner,
  id: number,
  onStage?: Parameters<typeof runInvocation>[1],
): Promise<LifecycleResult<void>> {
  const c = (await client(signer)) as TreasuryClient;
  return runInvocation(
    () => c.approve_withdrawal({ id }),
    onStage,
  );
}

export async function executeWithdrawal(
  signer: WalletSigner,
  id: number,
  onStage?: Parameters<typeof runInvocation>[1],
): Promise<LifecycleResult<void>> {
  const c = (await client(signer)) as TreasuryClient;
  return runInvocation(
    () => c.execute_withdrawal({ id }),
    onStage,
  );
}
