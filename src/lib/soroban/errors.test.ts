import { describe, expect, it } from "vitest";
import { describeInvocationError } from "./errors";

describe("describeInvocationError", () => {
  it("uses a Result Err's message, applying a friendly override when recognized", () => {
    const err = { isErr: () => true, unwrapErr: () => ({ message: "Paused" }) };
    expect(describeInvocationError(err)).toMatch(/paused/i);
  });

  it("decodes raw contract error patterns as a fallback", () => {
    const err = new Error("HostError: Error(Contract, #3)");
    expect(describeInvocationError(err)).toMatch(/error code 3/i);
  });

  it("maps known AssembledTransaction/SentTransaction error names to friendly copy", () => {
    const err = new Error("boom");
    err.name = "NeedsMoreSignatures";
    expect(describeInvocationError(err)).toMatch(/additional signers/i);
  });

  it("falls back to the raw message for unrecognized errors", () => {
    expect(describeInvocationError(new Error("network unreachable"))).toBe("network unreachable");
  });

  it("handles non-Error throw values", () => {
    expect(describeInvocationError("weird failure")).toBe("weird failure");
  });
});
