/**
 * Payroll-stream contract read wrappers, built on the shared tx lifecycle.
 *
 * Follows the same dynamic-client pattern as treasury.ts: contract method
 * names come from the deployed spec (fetched by `contract.Client.from`),
 * so this module works against any build of the payroll contract without
 * checked-in bindings.
 */

import type { contract } from "@stellar/stellar-sdk";
import { getPayrollClient, type WalletSigner } from "./client";
import { runInvocation, type LifecycleResult } from "./txLifecycle";
import { isPayrollConfigured } from "./config";

export interface PayrollStreamView {
  id: number;
  sender: string;
  recipient: string;
  token: string;
  total_amount: bigint;
  rate_per_second: bigint;
  start_time: bigint;
  end_time: bigint;
  balance: bigint;
  status: string;
}

export interface PayrollPage {
  items: PayrollStreamView[];
  next_cursor: string | null;
}

type DynamicClient = contract.Client & Record<string, (...args: unknown[]) => Promise<contract.AssembledTransaction<unknown>>>;

export { isPayrollConfigured };

async function client(signer: WalletSigner | null): Promise<contract.Client> {
  return getPayrollClient(signer);
}

export async function getStreamsForAccount(
  account: string,
  cursor: string | null,
  limit: number,
): Promise<LifecycleResult<PayrollPage>> {
  const c = (await client(null)) as DynamicClient;
  return runInvocation(
    () => c.get_streams({ account, cursor, limit }) as Promise<contract.AssembledTransaction<PayrollPage>>,
  );
}
