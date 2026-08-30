/**
 * Treasury contract write/read wrappers, built on the shared tx lifecycle.
 *
 * Method and argument names below are the deployed treasury contract's real
 * interface, confirmed against maintainer review on issue #29's PR:
 *
 *   - `create_withdrawal(proposer, token, recipient, amount, memo) -> u32`
 *   - `approve_withdrawal(signer, proposal_id)`
 *   - `execute_withdrawal(executor, proposal_id)`
 *   - `get_config()` — does NOT include a balance field.
 *
 * `get_withdrawal(id)`'s shape wasn't disputed, so it's unchanged. Every
 * caller goes through these functions rather than naming a contract method
 * inline, so if the deployed spec shifts again this is the one place to
 * realign — and `treasury.integration.test.ts` builds each of these wrappers
 * against a hand-authored `contract.Spec` fixture matching this interface,
 * so an argument-shape drift like the one this module doc used to hide fails
 * a test instead of only failing silently against a live deployment.
 *
 * Since `get_config` carries no balance, "does this withdrawal fit the
 * treasury's funds" is answered by a *separate* live read of the withdrawal
 * asset's own SEP-41 `balance(id)` — see `getTokenBalance` — against the
 * treasury contract's own address, not a field on the config struct.
 */

import type { contract } from "@stellar/stellar-sdk";
import { getTokenClient, getTreasuryClient, type WalletSigner } from "./client";
import { runInvocation, type LifecycleResult } from "./txLifecycle";
import { isTreasuryConfigured, TREASURY_CONTRACT_ID } from "./config";
import { POLICY_ERROR_MESSAGES } from "./errors";

export interface TreasuryConfigView {
  admin: string;
  signers: string[];
  threshold: number;
  paused: boolean;
}

export interface WithdrawalView {
  id: number;
  proposer: string;
  recipient: string;
  /** SEP-41 token contract ID this withdrawal pays out in. */
  token: string;
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

/**
 * Live SEP-41 balance read: `balance(id) -> i128`, called against whichever
 * token contract the withdrawal is denominated in, for the address holding
 * the funds (the treasury contract itself). This is a plain read — no
 * signer needed — same as `getTreasuryConfig`/`getWithdrawal`.
 */
export async function getTokenBalance(
  tokenContractId: string,
  holder: string = TREASURY_CONTRACT_ID,
): Promise<LifecycleResult<bigint>> {
  const c = (await getTokenClient(tokenContractId, null)) as DynamicClient;
  return runInvocation(
    () => c.balance({ id: holder }) as Promise<contract.AssembledTransaction<bigint>>,
  );
}

export async function proposeWithdrawal(
  signer: WalletSigner,
  args: { token: string; recipient: string; amount: bigint; memo: string },
  onStage?: Parameters<typeof runInvocation>[1],
): Promise<LifecycleResult<number>> {
  const c = (await client(signer)) as TreasuryClient;
  return runInvocation(
    () =>
      c.create_withdrawal({
        proposer: signer.publicKey,
        token: args.token,
        recipient: args.recipient,
        amount: args.amount,
        memo: args.memo,
      }) as Promise<contract.AssembledTransaction<number>>,
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
    () =>
      c.approve_withdrawal({ signer: signer.publicKey, proposal_id: id }) as Promise<
        contract.AssembledTransaction<void>
      >,
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
    () =>
      c.execute_withdrawal({ executor: signer.publicKey, proposal_id: id }) as Promise<
        contract.AssembledTransaction<void>
      >,
    onStage,
  );
}

/** Whether `address` is one of the treasury's configured multi-sig signers. */
export function isAuthorizedSigner(config: TreasuryConfigView, address: string): boolean {
  return config.signers.includes(address);
}

/**
 * Client-side authorization preflight for proposing/approving/executing a
 * withdrawal, run against the live treasury config *before* a transaction is
 * built/simulated — so a paused treasury or an unauthorized signer is
 * explained immediately rather than surfacing only after a wasted simulation
 * round-trip. Returns `null` when clean; the contract's own checks (via
 * `errors.ts`) remain the final authority. Doesn't check balance — `get_config`
 * carries none — see `checkSufficientBalance` for that, backed by a live
 * per-token read via `getTokenBalance`.
 */
export function checkWithdrawalAuthorization(
  config: TreasuryConfigView,
  signerAddress: string,
): string | null {
  if (config.paused) return POLICY_ERROR_MESSAGES.paused;
  if (!isAuthorizedSigner(config, signerAddress)) return POLICY_ERROR_MESSAGES.unauthorized;
  return null;
}

/**
 * Pure comparison against a balance already read live (via
 * `getTokenBalance`) for the withdrawal's specific asset — kept separate from
 * the read itself so the read stays async/network-bound while this stays a
 * plain, synchronously-testable check.
 */
export function checkSufficientBalance(balance: bigint, amount: bigint): string | null {
  return amount > balance ? POLICY_ERROR_MESSAGES.insufficientBalance : null;
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
