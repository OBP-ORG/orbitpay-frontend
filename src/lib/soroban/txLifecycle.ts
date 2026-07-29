/**
 * Shared write-path transaction lifecycle: build → simulate → sign → submit
 * → poll → decode, for any Soroban contract invocation made through a
 * `contract.Client` method (see `treasury.ts` / `governance.ts`).
 *
 * `contract.Client`'s generated methods already return an
 * `AssembledTransaction`, which handles build + simulate internally and
 * exposes `signAndSend()`, which handles sign + submit + poll (via
 * `SentTransaction`, retrying `getTransaction` until the transaction reaches
 * a terminal status or times out). This module's job is to wrap that in a
 * stage-reporting, always-resolves (never-throws) result so callers — namely
 * the treasury/governance pages — get a single shape to render regardless of
 * which step failed, with a decoded, human message.
 */

import type { contract, rpc } from "@stellar/stellar-sdk";
import { describeInvocationError } from "./errors";

export type LifecycleStage =
  | "simulating"
  | "awaiting-signature"
  | "submitting"
  | "polling"
  | "success"
  | "error";

export type LifecycleResult<T> =
  | { status: "success"; hash: string; result: T }
  | { status: "error"; stage: LifecycleStage; message: string };

/**
 * Runs `assembledTx` through sign → submit → poll, reporting each stage via
 * `onStage`. `assembledTx` must already have been built (i.e. simulated) —
 * `contract.Client` methods do this synchronously as part of construction, so
 * by the time the promise passed to `runInvocation` resolves, simulation has
 * already happened; a simulation failure surfaces as this function's first
 * check below rather than as a stage transition.
 */
export async function runInvocation<T>(
  buildAssembledTx: () => Promise<contract.AssembledTransaction<T>>,
  onStage?: (stage: LifecycleStage) => void,
): Promise<LifecycleResult<T>> {
  onStage?.("simulating");

  let tx: contract.AssembledTransaction<T>;
  try {
    tx = await buildAssembledTx();
  } catch (err) {
    return { status: "error", stage: "simulating", message: describeInvocationError(err) };
  }

  const simulationError = readSimulationError(tx.simulation);
  if (simulationError) {
    return { status: "error", stage: "simulating", message: describeInvocationError(simulationError) };
  }

  if (tx.isReadCall) {
    return { status: "success", hash: "", result: tx.result };
  }

  onStage?.("awaiting-signature");
  try {
    onStage?.("submitting");
    const sent = await tx.signAndSend();
    onStage?.("polling");

    const finalStatus = sent.getTransactionResponse?.status;
    if (finalStatus !== "SUCCESS") {
      return {
        status: "error",
        stage: "polling",
        message:
          finalStatus === "FAILED"
            ? "The transaction was included in a ledger but failed on-chain."
            : "The transaction is still pending confirmation. Check back shortly — it may still succeed.",
      };
    }

    return {
      status: "success",
      hash: sent.sendTransactionResponse?.hash ?? "",
      result: sent.result,
    };
  } catch (err) {
    return { status: "error", stage: "submitting", message: describeInvocationError(err) };
  }
}

/**
 * Whether `simulation` is a `SimulateTransactionErrorResponse`, returning its
 * `error` string if so (for `describeInvocationError` to decode) or
 * `undefined` for a successful/restore simulation.
 */
function readSimulationError(
  simulation: rpc.Api.SimulateTransactionResponse | undefined,
): Error | undefined {
  if (!simulation) return undefined;
  if (!("error" in simulation)) return undefined;
  return new Error(simulation.error);
}
