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
 * Friendly overrides keyed by the *name* the contract's own error message
 * contains (case-insensitive substring match), for the specific cases the
 * issue names. These only kick in as a nicer rewording of a message we
 * already extracted — never invented from a bare numeric code, since without
 * a live contract deployed we cannot know that mapping ourselves (the SDK's
 * automatic decode, described above, owns that).
 */
const FRIENDLY_NAME_OVERRIDES: Array<{ match: RegExp; message: string }> = [
  { match: /paused/i, message: "The treasury is currently paused. Withdrawals are disabled until an admin resumes it." },
  { match: /timelock/i, message: "This withdrawal's timelock has not expired yet. Try again once it elapses." },
  { match: /threshold/i, message: "This withdrawal has not reached the required number of signer approvals yet." },
  { match: /insufficient.?funds|insufficient.?balance/i, message: "The treasury does not hold enough balance to cover this withdrawal." },
  { match: /not.?approved/i, message: "This proposal has not been approved yet." },
  { match: /unauthorized/i, message: "Your connected wallet is not authorized to perform this action." },
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
