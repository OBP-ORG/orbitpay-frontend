/**
 * Vesting contract read wrappers, built on the shared tx lifecycle.
 *
 * Follows the same dynamic-client pattern as treasury.ts.
 */

import type { contract } from "@stellar/stellar-sdk";
import { getVestingClient, type WalletSigner } from "./client";
import { runInvocation, type LifecycleResult } from "./txLifecycle";
import { isVestingConfigured } from "./config";

export interface VestingScheduleView {
  id: number;
  grantor: string;
  beneficiary: string;
  token: string;
  total_amount: bigint;
  original_total_amount: bigint;
  claimed_amount: bigint;
  start_time: bigint;
  cliff_duration: bigint;
  cliff_amount: bigint;
  total_duration: bigint;
  label: string;
  status: string;
  revocable: boolean;
  revoked_at: bigint | null;
}

export interface VestingPage {
  items: VestingScheduleView[];
  next_cursor: string | null;
}

type DynamicClient = contract.Client & Record<string, (...args: unknown[]) => Promise<contract.AssembledTransaction<unknown>>>;

export { isVestingConfigured };

async function client(signer: WalletSigner | null): Promise<contract.Client> {
  return getVestingClient(signer);
}

export async function getSchedulesForAccount(
  account: string,
  cursor: string | null,
  limit: number,
): Promise<LifecycleResult<VestingPage>> {
  const c = (await client(null)) as DynamicClient;
  return runInvocation(
    () => c.get_schedules({ account, cursor, limit }) as Promise<contract.AssembledTransaction<VestingPage>>,
  );
}
