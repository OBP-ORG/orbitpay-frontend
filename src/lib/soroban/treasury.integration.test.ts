/**
 * Builds each treasury/token wrapper against a hand-authored
 * `contract.Spec` fixture matching the deployed treasury contract's real
 * interface (per maintainer review on issue #29's PR — see `treasury.ts`'s
 * module doc), using the REAL `@stellar/stellar-sdk` `contract.Client` +
 * `contract.Spec` machinery rather than mocking our own code.
 *
 * `contract.Client`'s generated per-method functions synchronously call
 * `spec.funcArgsToScVals(method, args)` *before* touching the network (see
 * the SDK's `Client` constructor) — so a wrapper that passes the wrong
 * function name or argument shape fails immediately with a "Missing field"
 * error, distinguishable from a normal network failure. Only `./client`'s
 * network-fetching boundary (`contract.Client.from`, which would otherwise
 * fetch the spec from a live RPC) is swapped for this fixture spec;
 * everything downstream of that — argument validation, ScVal conversion,
 * transaction assembly — is the real SDK.
 *
 * The RPC URL below points at an address nothing listens on, so every call
 * fails fast (ECONNREFUSED) once past spec validation — deterministic, no
 * network access required, and cheap to assert "this failed for a network
 * reason, not a spec-shape reason" against.
 */

import { contract, Keypair, Networks, StrKey, xdr } from "@stellar/stellar-sdk";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { WalletSigner } from "./client";
import { getTreasuryClient, getTokenClient } from "./client";
import {
  approveWithdrawal,
  executeWithdrawal,
  getTokenBalance,
  getTreasuryConfig,
  getWithdrawal,
  proposeWithdrawal,
} from "./treasury";

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    ...actual,
    getTreasuryClient: vi.fn(),
    getTokenClient: vi.fn(),
  };
});

const mockGetTreasuryClient = vi.mocked(getTreasuryClient);
const mockGetTokenClient = vi.mocked(getTokenClient);

const UNREACHABLE_RPC_URL = "http://127.0.0.1:9";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const SIGNER = Keypair.random().publicKey();
const RECIPIENT = Keypair.random().publicKey();
const TOKEN_ID = StrKey.encodeContract(Buffer.alloc(32, 1));
const TREASURY_ID = StrKey.encodeContract(Buffer.alloc(32, 2));

function fixtureOptions(contractId: string, signer: WalletSigner | null): contract.ClientOptions {
  return {
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: UNREACHABLE_RPC_URL,
    allowHttp: true,
    publicKey: signer?.publicKey,
    signTransaction: signer?.signTransaction,
  };
}

function specFunction(name: string, inputs: Array<[string, xdr.ScSpecTypeDef]>): xdr.ScSpecEntry {
  return xdr.ScSpecEntry.scSpecEntryFunctionV0(
    new xdr.ScSpecFunctionV0({
      doc: "",
      name,
      inputs: inputs.map(
        ([inputName, type]) => new xdr.ScSpecFunctionInputV0({ doc: "", name: inputName, type }),
      ),
      outputs: [],
    }),
  );
}

const ADDRESS = xdr.ScSpecTypeDef.scSpecTypeAddress();
const I128 = xdr.ScSpecTypeDef.scSpecTypeI128();
const STRING = xdr.ScSpecTypeDef.scSpecTypeString();
const U32 = xdr.ScSpecTypeDef.scSpecTypeU32();

/** The deployed treasury contract's real interface (per maintainer review). */
const TREASURY_SPEC = new contract.Spec([
  specFunction("create_withdrawal", [
    ["proposer", ADDRESS],
    ["token", ADDRESS],
    ["recipient", ADDRESS],
    ["amount", I128],
    ["memo", STRING],
  ]),
  specFunction("approve_withdrawal", [
    ["signer", ADDRESS],
    ["proposal_id", U32],
  ]),
  specFunction("execute_withdrawal", [
    ["executor", ADDRESS],
    ["proposal_id", U32],
  ]),
  specFunction("get_config", []),
  specFunction("get_withdrawal", [["id", U32]]),
]);

/** Any SEP-41 token contract's standard `balance(id) -> i128`. */
const TOKEN_SPEC = new contract.Spec([specFunction("balance", [["id", ADDRESS]])]);

beforeAll(() => {
  mockGetTreasuryClient.mockImplementation((signer) =>
    Promise.resolve(new contract.Client(TREASURY_SPEC, fixtureOptions(TREASURY_ID, signer))),
  );
  mockGetTokenClient.mockImplementation((tokenId, signer) =>
    Promise.resolve(new contract.Client(TOKEN_SPEC, fixtureOptions(tokenId, signer))),
  );
});

/** True only for the synchronous spec-validation failure this suite guards against. */
function isSpecShapeError(message: string): boolean {
  return /missing field|unexpected argument|no such function/i.test(message);
}

const SOME_SIGNER: WalletSigner = { publicKey: SIGNER, signTransaction: vi.fn() };

describe("treasury wrappers build against the deployed contract spec", () => {
  it("proposeWithdrawal calls create_withdrawal(proposer, token, recipient, amount, memo)", async () => {
    const result = await proposeWithdrawal(SOME_SIGNER, {
      token: TOKEN_ID,
      recipient: RECIPIENT,
      amount: BigInt(100),
      memo: "payout",
    });

    expect(result.status).toBe("error"); // fails at the network stage, not the spec stage
    if (result.status === "error") expect(isSpecShapeError(result.message)).toBe(false);
  });

  it("approveWithdrawal calls approve_withdrawal(signer, proposal_id)", async () => {
    const result = await approveWithdrawal(SOME_SIGNER, 7);

    expect(result.status).toBe("error");
    if (result.status === "error") expect(isSpecShapeError(result.message)).toBe(false);
  });

  it("executeWithdrawal calls execute_withdrawal(executor, proposal_id)", async () => {
    const result = await executeWithdrawal(SOME_SIGNER, 7);

    expect(result.status).toBe("error");
    if (result.status === "error") expect(isSpecShapeError(result.message)).toBe(false);
  });

  it("getTreasuryConfig calls the zero-argument get_config", async () => {
    const result = await getTreasuryConfig();

    expect(result.status).toBe("error");
    if (result.status === "error") expect(isSpecShapeError(result.message)).toBe(false);
  });

  it("getWithdrawal calls get_withdrawal(id)", async () => {
    const result = await getWithdrawal(7);

    expect(result.status).toBe("error");
    if (result.status === "error") expect(isSpecShapeError(result.message)).toBe(false);
  });

  it("getTokenBalance calls the token contract's SEP-41 balance(id)", async () => {
    const result = await getTokenBalance(TOKEN_ID, TREASURY_ID);

    expect(result.status).toBe("error");
    if (result.status === "error") expect(isSpecShapeError(result.message)).toBe(false);
  });

  it("read calls (getTreasuryConfig/getWithdrawal) build fine with no wallet connected", async () => {
    const configResult = await getTreasuryConfig();
    const withdrawalResult = await getWithdrawal(1);

    expect(configResult.status).toBe("error");
    expect(withdrawalResult.status).toBe("error");
    if (configResult.status === "error") expect(isSpecShapeError(configResult.message)).toBe(false);
    if (withdrawalResult.status === "error") expect(isSpecShapeError(withdrawalResult.message)).toBe(false);
  });
});

describe("regression guard: the previous (wrong) argument shapes are rejected by this spec", () => {
  function client(): Record<string, (args: unknown) => unknown> {
    return new contract.Client(
      TREASURY_SPEC,
      fixtureOptions(TREASURY_ID, SOME_SIGNER),
    ) as unknown as Record<string, (args: unknown) => unknown>;
  }

  it("rejects propose_withdrawal's old {recipient, amount, memo} shape (missing proposer/token)", () => {
    expect(() =>
      client().create_withdrawal({ recipient: RECIPIENT, amount: BigInt(100), memo: "payout" }),
    ).toThrow(/missing field/i);
  });

  it("rejects approve_withdrawal's old {id} shape (missing signer, wrong field name)", () => {
    expect(() => client().approve_withdrawal({ id: 7 })).toThrow(/missing field/i);
  });

  it("rejects execute_withdrawal's old {id} shape (missing executor, wrong field name)", () => {
    expect(() => client().execute_withdrawal({ id: 7 })).toThrow(/missing field/i);
  });
});
