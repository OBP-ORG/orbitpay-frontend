import { describe, expect, it } from "vitest";
import {
  checkWithdrawalPolicy,
  isAuthorizedSigner,
  isWithdrawalPolicyStale,
  type TreasuryConfigView,
  type WithdrawalView,
} from "./treasury";
import { POLICY_ERROR_MESSAGES } from "./errors";

const SIGNER_A = "GAAA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SIGNER_B = "GBBB1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const NON_SIGNER = "GCCC1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const RECIPIENT = "GDDD1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";

function makeConfig(overrides: Partial<TreasuryConfigView> = {}): TreasuryConfigView {
  return {
    admin: SIGNER_A,
    signers: [SIGNER_A, SIGNER_B],
    threshold: 2,
    balance: BigInt(1_000_000),
    paused: false,
    ...overrides,
  };
}

function makeWithdrawal(overrides: Partial<WithdrawalView> = {}): WithdrawalView {
  return {
    id: 1,
    proposer: SIGNER_A,
    recipient: RECIPIENT,
    amount: BigInt(100),
    memo: "payout",
    approvals: [],
    threshold: 2,
    executed: false,
    timelockExpiresAt: 0,
    ...overrides,
  };
}

describe("isAuthorizedSigner", () => {
  it("is true for an address in the treasury's signer list", () => {
    expect(isAuthorizedSigner(makeConfig(), SIGNER_A)).toBe(true);
  });

  it("is false for an address not in the signer list", () => {
    expect(isAuthorizedSigner(makeConfig(), NON_SIGNER)).toBe(false);
  });
});

describe("checkWithdrawalPolicy", () => {
  it("returns null (no violation) for an authorized signer within balance on an active treasury", () => {
    expect(checkWithdrawalPolicy(makeConfig(), SIGNER_A, BigInt(500))).toBeNull();
  });

  it("flags a paused treasury before any other check", () => {
    const config = makeConfig({ paused: true });
    expect(checkWithdrawalPolicy(config, NON_SIGNER, BigInt(9_999_999))).toBe(POLICY_ERROR_MESSAGES.paused);
  });

  it("flags an address that is not an authorized signer", () => {
    expect(checkWithdrawalPolicy(makeConfig(), NON_SIGNER, BigInt(500))).toBe(POLICY_ERROR_MESSAGES.unauthorized);
  });

  it("flags an amount that exceeds the treasury's balance", () => {
    expect(checkWithdrawalPolicy(makeConfig(), SIGNER_A, BigInt(2_000_000))).toBe(
      POLICY_ERROR_MESSAGES.insufficientBalance,
    );
  });
});

describe("isWithdrawalPolicyStale", () => {
  it("is false when the live config threshold matches the withdrawal's frozen threshold", () => {
    expect(isWithdrawalPolicyStale(makeConfig({ threshold: 2 }), makeWithdrawal({ threshold: 2 }))).toBe(false);
  });

  it("is true when the treasury's threshold has changed since the withdrawal was proposed", () => {
    expect(isWithdrawalPolicyStale(makeConfig({ threshold: 3 }), makeWithdrawal({ threshold: 2 }))).toBe(true);
  });
});
