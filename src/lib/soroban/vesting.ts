/**
 * Vesting contract read wrappers, built on the shared tx lifecycle.
 *
 * The vesting contract exposes `get_schedules_by_beneficiary(addr) -> Vec<u32>`
 * and `get_schedules_by_grantor(addr) -> Vec<u32>` for ID lists, plus
 * `get_schedule(id) -> VestingSchedule` for individual reads. Pagination is
 * composed client-side: fetch all IDs, slice by cursor, then batch-read
 * the page's individual records.
 */

import { contract } from "@stellar/stellar-sdk";
import { getVestingClient, type WalletSigner } from "./client";
import { describeInvocationError } from "./errors";
import { type LifecycleResult } from "./txLifecycle";
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

async function getClient(signer: WalletSigner | null): Promise<DynamicClient> {
  return (await getVestingClient(signer)) as DynamicClient;
}

async function fetchIds(c: DynamicClient, account: string): Promise<number[]> {
  const tx = await c.get_schedules_by_beneficiary(account);
  const ids = tx.result as unknown[];
  return ids.map((id) => Number(id));
}

async function fetchSchedule(c: DynamicClient, id: number): Promise<VestingScheduleView> {
  const tx = await c.get_schedule(id);
  return tx.result as unknown as VestingScheduleView;
}

export async function getSchedulesForAccount(
  account: string,
  cursor: string | null,
  limit: number,
): Promise<LifecycleResult<VestingPage>> {
  try {
    const c = await getClient(null);

    const allIds = await fetchIds(c, account);

    const startIndex = cursor ? allIds.indexOf(Number(cursor)) + 1 : 0;
    const pageIds = allIds.slice(startIndex, startIndex + limit);

    const items: VestingScheduleView[] = [];
    for (const id of pageIds) {
      items.push(await fetchSchedule(c, id));
    }

    const nextCursor =
      startIndex + limit < allIds.length ? String(allIds[startIndex + limit - 1]) : null;

    return { status: "success", hash: "", result: { items, next_cursor: nextCursor } };
  } catch (err) {
    return { status: "error", stage: "simulating", message: describeInvocationError(err) };
  }
}
