import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateProposalState,
  DEFAULT_GOVERNANCE_CONFIG,
  CANONICAL_GOVERNANCE_METHODS,
  assertGovernanceCompatibility,
  isGovernanceAbiVerified,
  setGovernanceAbiVerified,
  GovernanceAbiError,
  type CanonicalProposal,
} from "../governanceAbi";
import {
  createProposal,
  vote,
  executeProposal,
} from "../governance";

function mockProposal(overrides: Partial<CanonicalProposal> = {}): CanonicalProposal {
  return {
    id: 1,
    proposer: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
    title: "Community Treasury Grant",
    description: "Allocate 5,000 XLM for community infrastructure",
    action: "Funding",
    amount: 50000000000n,
    recipient: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    totalWeightSnapshot: 1000,
    quorumSnapshot: 200,
    startTime: 1000,
    endTime: 2000,
    eta: null,
    executed: false,
    canceled: false,
    ...overrides,
  };
}

describe("Governance Canonical ABI & State Machine (Issue #45)", () => {
  beforeEach(() => {
    setGovernanceAbiVerified(false);
  });

  describe("State Machine Transitions", () => {
    it("reports Pending before voting delay expires", () => {
      const proposal = mockProposal({ startTime: 1500, endTime: 2500 });
      const state = evaluateProposalState(proposal, 1000);
      expect(state.status).toBe("Pending");
      expect(state.canVote).toBe(false);
      expect(state.canExecute).toBe(false);
      expect(state.timeRemainingSeconds).toBe(500);
    });

    it("reports Active during the voting window", () => {
      const proposal = mockProposal({ startTime: 1000, endTime: 2000 });
      const state = evaluateProposalState(proposal, 1500);
      expect(state.status).toBe("Active");
      expect(state.canVote).toBe(true);
      expect(state.canExecute).toBe(false);
      expect(state.timeRemainingSeconds).toBe(500);
    });

    it("reports Defeated when quorum is not met after voting period", () => {
      const proposal = mockProposal({
        startTime: 1000,
        endTime: 2000,
        votesFor: 150,
        votesAgainst: 10,
        quorumSnapshot: 200, // 160 < 200 quorum
      });
      const state = evaluateProposalState(proposal, 2500);
      expect(state.status).toBe("Defeated");
      expect(state.isQuorumReached).toBe(false);
      expect(state.canVote).toBe(false);
      expect(state.canExecute).toBe(false);
      expect(state.reason).toContain("quorum");
    });

    it("reports Defeated when quorum is met but majority is not achieved", () => {
      const proposal = mockProposal({
        startTime: 1000,
        endTime: 2000,
        votesFor: 100,
        votesAgainst: 150, // 100 / 250 = 40% < 50% majority
        quorumSnapshot: 200, // 250 >= 200 quorum
      });
      const state = evaluateProposalState(proposal, 2500);
      expect(state.status).toBe("Defeated");
      expect(state.isQuorumReached).toBe(true);
      expect(state.isMajorityReached).toBe(false);
      expect(state.canExecute).toBe(false);
      expect(state.reason).toContain("majority");
    });

    it("reports Queued when proposal succeeds with timelock delay active", () => {
      const proposal = mockProposal({
        startTime: 1000,
        endTime: 2000,
        votesFor: 250,
        votesAgainst: 50,
        quorumSnapshot: 200,
        eta: 2500, // Timelock until 2500
      });
      const state = evaluateProposalState(proposal, 2200, {
        ...DEFAULT_GOVERNANCE_CONFIG,
        executionDelaySeconds: 500,
      });
      expect(state.status).toBe("Queued");
      expect(state.isQuorumReached).toBe(true);
      expect(state.isMajorityReached).toBe(true);
      expect(state.canExecute).toBe(false);
      expect(state.timeRemainingSeconds).toBe(300);
    });

    it("reports Succeeded and ready to execute once timelock delay has elapsed", () => {
      const proposal = mockProposal({
        startTime: 1000,
        endTime: 2000,
        votesFor: 300,
        votesAgainst: 50,
        quorumSnapshot: 200,
        eta: 2500,
      });
      const state = evaluateProposalState(proposal, 2600, {
        ...DEFAULT_GOVERNANCE_CONFIG,
        executionDelaySeconds: 500,
      });
      expect(state.status).toBe("Succeeded");
      expect(state.canExecute).toBe(true);
      expect(state.isQuorumReached).toBe(true);
      expect(state.isMajorityReached).toBe(true);
    });

    it("reports Expired when grace period elapses without execution", () => {
      const proposal = mockProposal({
        startTime: 1000,
        endTime: 2000,
        votesFor: 300,
        votesAgainst: 50,
        quorumSnapshot: 200,
        eta: 2500,
      });
      const state = evaluateProposalState(proposal, 2500 + 1209601, {
        ...DEFAULT_GOVERNANCE_CONFIG,
        executionDelaySeconds: 500,
        executionGracePeriodSeconds: 1209600,
      });
      expect(state.status).toBe("Expired");
      expect(state.canExecute).toBe(false);
      expect(state.reason).toContain("expired");
    });

    it("reports Executed when proposal is marked executed on chain", () => {
      const proposal = mockProposal({ executed: true });
      const state = evaluateProposalState(proposal, 3000);
      expect(state.status).toBe("Executed");
      expect(state.canExecute).toBe(false);
      expect(state.canVote).toBe(false);
    });

    it("reports Canceled when proposal is canceled", () => {
      const proposal = mockProposal({ canceled: true });
      const state = evaluateProposalState(proposal, 1500);
      expect(state.status).toBe("Canceled");
      expect(state.canVote).toBe(false);
      expect(state.canExecute).toBe(false);
    });
  });

  describe("Canonical Method Identifiers", () => {
    it("exposes canonical method names", () => {
      expect(CANONICAL_GOVERNANCE_METHODS.PROPOSE).toBe("propose");
      expect(CANONICAL_GOVERNANCE_METHODS.VOTE).toBe("vote");
      expect(CANONICAL_GOVERNANCE_METHODS.EXECUTE).toBe("execute");
      expect(CANONICAL_GOVERNANCE_METHODS.GET_PROPOSAL).toBe("get_proposal");
      expect(CANONICAL_GOVERNANCE_METHODS.GET_CONFIG).toBe("get_config");
      expect(CANONICAL_GOVERNANCE_METHODS.GET_PROPOSAL_STATE).toBe("get_state");
    });
  });

  describe("Write Gating & ABI Drift Defense", () => {
    it("isGovernanceAbiVerified defaults to false", () => {
      expect(isGovernanceAbiVerified()).toBe(false);
    });

    it("assertGovernanceCompatibility throws GovernanceAbiError when unverified", () => {
      expect(() => assertGovernanceCompatibility()).toThrow(GovernanceAbiError);
    });

    it("assertGovernanceCompatibility succeeds when verified", () => {
      setGovernanceAbiVerified(true);
      expect(isGovernanceAbiVerified()).toBe(true);
      expect(() => assertGovernanceCompatibility()).not.toThrow();
    });

    it("createProposal safely rejects when writes are gated", async () => {
      const dummySigner = {
        signTransaction: async (xdr: string) => xdr,
        signAuthEntry: async (entry: string) => entry,
      };
      const res = await createProposal(dummySigner, {
        title: "Test",
        description: "Test",
        action: "General",
        amount: null,
        recipient: null,
      });
      expect(res.status).toBe("error");
      expect(res.message).toContain("Contract ABI compatibility has not been verified");
    });

    it("vote safely rejects when writes are gated", async () => {
      const dummySigner = {
        signTransaction: async (xdr: string) => xdr,
        signAuthEntry: async (entry: string) => entry,
      };
      const res = await vote(dummySigner, 1, true);
      expect(res.status).toBe("error");
      expect(res.message).toContain("Contract ABI compatibility has not been verified");
    });

    it("executeProposal safely rejects when writes are gated", async () => {
      const dummySigner = {
        signTransaction: async (xdr: string) => xdr,
        signAuthEntry: async (entry: string) => entry,
      };
      const res = await executeProposal(dummySigner, 1);
      expect(res.status).toBe("error");
      expect(res.message).toContain("Contract ABI compatibility has not been verified");
    });
  });
});
