/**
 * Decodes Soroban contract / transaction failures into human-readable
 * messages for the treasury and governance write-path.
 *
 * `contract.Client` (from `@stellar/stellar-sdk`) already decodes
 * `#[contracterror]` failures automatically: it fetches the deployed
 * contract's own spec (including each error variant's doc comment) and, for
 * methods that return `Result<T, Error>`, surfaces a `rust_result.Err` whose
 * `.message` IS that doc comment — so once a real contract is deployed with
 * doc comments on its error enum (this repo's STYLE.md requires exactly
 * that), most errors are already readable with zero mapping here.
 *
 * This module exists for the cases that mechanism doesn't cover:
 *   - Contract methods that panic instead of returning `Result` (the SDK
 *     re-throws the raw `Error(Contract, #N)` string with no lookup).
 *   - Well-known error *names* the issue calls out by name (paused,
 *     timelock-not-expired, threshold-not-met, insufficient-funds,
 *     not-approved, unauthorized) get a friendlier label even when the raw
 *     contract doc is terse or missing.
 *   - Failures from the surrounding lifecycle (signing rejected, transaction
 *     never confirmed, needs more multi-sig signatures, footprint expired)
 *     that never reach the contract at all.
 */

/** Raw `Error(Contract, #N)` pattern, matching `@stellar/stellar-sdk`'s own. */
const CONTRACT_ERROR_PATTERN = /Error\(Contract, #(\d+)\)/;

/**
 * Canonical wording for the policy failures the issue calls out by name.
 * Exported so client-side preflight checks (`treasury.ts`'s
 * `checkWithdrawalPolicy` / `isWithdrawalPolicyStale`) can show the exact
 * same copy *before* simulation as this module decodes *after* a contract
 * rejects a call — one source of truth for what each policy failure says.
 */
export const POLICY_ERROR_MESSAGES = {
  paused: "The treasury is currently paused. Withdrawals are disabled until an admin resumes it.",
  timelock: "This withdrawal's timelock has not expired yet. Try again once it elapses.",
  threshold: "This withdrawal has not reached the required number of signer approvals yet.",
  insufficientBalance: "The treasury does not hold enough balance to cover this withdrawal.",
  notApproved: "This proposal has not been approved yet.",
  unauthorized: "Your connected wallet is not authorized to perform this action.",
  stalePolicy:
    "The treasury's signer policy has changed since this withdrawal was proposed. Refresh to confirm the current requirements before approving or executing.",
} as const;

/**
 * Friendly overrides keyed by the *name* the contract's own error message
 * contains (case-insensitive substring match), for the specific cases the
 * issue names. These only kick in as a nicer rewording of a message we
 * already extracted — never invented from a bare numeric code, since without
 * a live contract deployed we cannot know that mapping ourselves (the SDK's
 * automatic decode, described above, owns that).
 */
const FRIENDLY_NAME_OVERRIDES: Array<{ match: RegExp; message: string }> = [
  { match: /paused/i, message: POLICY_ERROR_MESSAGES.paused },
  { match: /timelock/i, message: POLICY_ERROR_MESSAGES.timelock },
  { match: /threshold/i, message: POLICY_ERROR_MESSAGES.threshold },
  { match: /insufficient.?funds|insufficient.?balance/i, message: POLICY_ERROR_MESSAGES.insufficientBalance },
  { match: /not.?approved/i, message: POLICY_ERROR_MESSAGES.notApproved },
  { match: /unauthorized/i, message: POLICY_ERROR_MESSAGES.unauthorized },
  { match: /stale.?policy|policy.?(changed|outdated|stale)|config.?(changed|mismatch)/i, message: POLICY_ERROR_MESSAGES.stalePolicy },
];

/** Named errors thrown by `AssembledTransaction`/`SentTransaction` themselves (not the contract). */
const LIFECYCLE_ERROR_MESSAGES: Record<string, string> = {
  ExpiredState:
    "The simulated transaction's ledger state expired before it could be sent. Please try again.",
  RestorationFailure:
    "Some ledger entries this transaction needs have archived and could not be restored automatically.",
  NeedsMoreSignatures:
    "This transaction still needs additional signers to approve before it can be submitted.",
  NoSignatureNeeded: "This call is read-only and does not need a wallet signature.",
  NoUnsignedNonInvokerAuthEntries: "There are no outstanding signatures needed from other accounts.",
  NoSigner: "No wallet is connected to sign this transaction.",
  NotYetSimulated: "This transaction has not been simulated yet.",
  FakeAccount: "Could not resolve a real account to simulate this call against.",
  SendFailed: "The transaction was rejected when submitted to the network.",
  SendResultOnly: "The transaction was submitted, but its final status could not be confirmed.",
  TransactionStillPending:
    "The transaction is still pending confirmation. Check back shortly — it may still succeed.",
};

function applyFriendlyOverride(message: string): string {
  const hit = FRIENDLY_NAME_OVERRIDES.find(({ match }) => match.test(message));
  return hit ? hit.message : message;
}

function hasUnwrapErr(value: unknown): value is { unwrapErr: () => { message: string } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "isErr" in value &&
    typeof (value as { isErr?: unknown }).isErr === "function" &&
    (value as { isErr: () => boolean }).isErr() &&
    "unwrapErr" in value &&
    typeof (value as { unwrapErr?: unknown }).unwrapErr === "function"
  );
}

/**
 * Turns whatever a failed simulate/sign/submit/poll step threw (or returned,
 * for `Result`-shaped contract calls) into one human-readable sentence.
 */
export function describeInvocationError(err: unknown): string {
  if (hasUnwrapErr(err)) {
    return applyFriendlyOverride(err.unwrapErr().message);
  }

  if (err instanceof Error) {
    const lifecycleMessage = LIFECYCLE_ERROR_MESSAGES[err.name];
    if (lifecycleMessage) return lifecycleMessage;

    const contractMatch = err.message.match(CONTRACT_ERROR_PATTERN);
    if (contractMatch) {
      return applyFriendlyOverride(`Contract rejected the call (error code ${contractMatch[1]}).`);
    }

    return applyFriendlyOverride(err.message);
  }

  return applyFriendlyOverride(String(err));
}
