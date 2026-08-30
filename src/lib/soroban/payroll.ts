/**
 * Payroll-stream contract read wrappers, built on the shared tx lifecycle.
 *
 * The payroll contract exposes `get_streams_by_sender(addr) -> Vec<u32>` and
 * `get_streams_by_recipient(addr) -> Vec<u32>` for ID lists, plus
 * `get_stream(id) -> PayrollStream` for individual reads. Pagination is
 * composed client-side: fetch all IDs, slice by cursor, then batch-read
 * the page's individual records.
 */

import { contract } from "@stellar/stellar-sdk";
import { getPayrollClient, type WalletSigner } from "./client";
import { describeInvocationError } from "./errors";
import { type LifecycleResult } from "./txLifecycle";
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

async function getClient(signer: WalletSigner | null): Promise<DynamicClient> {
  return (await getPayrollClient(signer)) as DynamicClient;
}

async function fetchIds(c: DynamicClient, account: string): Promise<number[]> {
  const tx = await c.get_streams_by_sender(account);
  const ids = tx.result as unknown[];
  return ids.map((id) => Number(id));
}

async function fetchStream(c: DynamicClient, id: number): Promise<PayrollStreamView> {
  const tx = await c.get_stream(id);
  return tx.result as unknown as PayrollStreamView;
}

export async function getStreamsForAccount(
  account: string,
  cursor: string | null,
  limit: number,
): Promise<LifecycleResult<PayrollPage>> {
  try {
    const c = await getClient(null);

    const allIds = await fetchIds(c, account);

    const startIndex = cursor ? allIds.indexOf(Number(cursor)) + 1 : 0;
    const pageIds = allIds.slice(startIndex, startIndex + limit);

    const items: PayrollStreamView[] = [];
    for (const id of pageIds) {
      items.push(await fetchStream(c, id));
    }

    const nextCursor =
      startIndex + limit < allIds.length ? String(allIds[startIndex + limit - 1]) : null;

    return { status: "success", hash: "", result: { items, next_cursor: nextCursor } };
  } catch (err) {
    return { status: "error", stage: "simulating", message: describeInvocationError(err) };
  }
}
