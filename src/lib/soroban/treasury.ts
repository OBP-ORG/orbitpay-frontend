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
import { POLICY_ERROR_MESSAGES } from "./errors";

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

/** Whether `address` is one of the treasury's configured multi-sig signers. */
export function isAuthorizedSigner(config: TreasuryConfigView, address: string): boolean {
  return config.signers.includes(address);
}

/**
 * Client-side policy preflight for proposing a withdrawal, run against the
 * live treasury config *before* a transaction is built/simulated — so an
 * unauthorized signer, a paused treasury, or an amount the treasury can't
 * cover is explained immediately rather than surfacing only after a wasted
 * simulation round-trip. Returns `null` when the proposal is policy-clean;
 * the contract's own checks (via `errors.ts`) remain the final authority.
 */
export function checkWithdrawalPolicy(
  config: TreasuryConfigView,
  signerAddress: string,
  amount: bigint,
): string | null {
  if (config.paused) return POLICY_ERROR_MESSAGES.paused;
  if (!isAuthorizedSigner(config, signerAddress)) return POLICY_ERROR_MESSAGES.unauthorized;
  if (amount > config.balance) return POLICY_ERROR_MESSAGES.insufficientBalance;
  return null;
}

/**
 * Whether the treasury's signer threshold has changed since `withdrawal` was
 * proposed. `withdrawal.threshold` is a chain-read snapshot of the threshold
 * that applied at proposal time; comparing it against the *live* config
 * (also a chain read) — rather than assuming either one alone still governs
 * — is what lets approve/execute be guarded by current contract state
 * instead of a stale local assumption.
 */
export function isWithdrawalPolicyStale(config: TreasuryConfigView, withdrawal: WithdrawalView): boolean {
  return config.threshold !== withdrawal.threshold;
}
