/**
 * Canonical Governance ABI & State Machine Specification
 *
 * Implements Issue #45: Establish canonical governance ABI and state machine before enabling writes.
 *
 * Provides:
 * 1. Canonical method signatures and argument types matching Soroban contracts
 * 2. Formal state machine rules (Pending -> Active -> Succeeded/Defeated -> Queued -> Executed/Expired)
 * 3. Quorum, majority, voting period, and timelock calculations
 * 4. Runtime ABI compatibility and drift detection
 * 5. Write gating to prevent blind contract executions until compatibility is verified
 */

export type CanonicalProposalStatus =
  | "Pending"
  | "Active"
  | "Defeated"
  | "Succeeded"
  | "Queued"
  | "Executed"
  | "Expired"
  | "Canceled";

export type GovernanceActionType =
  | "Funding"
  | "PolicyChange"
  | "AddMember"
  | "RemoveMember"
  | "UpgradeContract"
  | "General";

export interface CanonicalGovernanceConfig {
  /** Total voting power / weight in the DAO */
  totalWeight: number;
  /** Minimum participating votes required to make a proposal valid */
  quorum: number;
  /** Quorum threshold percentage (e.g. 20 for 20%) */
  quorumFraction: number;
  /** Required percentage of votesFor / (votesFor + votesAgainst) (e.g. 51 for simple majority) */
  majorityThreshold: number;
  /** Delay in seconds after proposal creation before voting begins */
  votingDelaySeconds: number;
  /** Duration in seconds that voting remains active */
  votingPeriodSeconds: number;
  /** Minimum timelock in seconds between successful vote and execution */
  executionDelaySeconds: number;
  /** Maximum timelock window in seconds before an unexecuted proposal expires */
  executionGracePeriodSeconds: number;
  /** Total number of proposals ever created */
  proposalCount: number;
}

export interface CanonicalProposal {
  id: number;
  proposer: string;
  title: string;
  description: string;
  action: GovernanceActionType;
  amount: bigint | null;
  recipient: string | null;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalWeightSnapshot: number;
  quorumSnapshot: number;
  startTime: number; // Unix timestamp
  endTime: number;   // Unix timestamp
  eta: number | null; // Execution ETA timestamp if queued
  executed: boolean;
  canceled: boolean;
}

export interface GovernanceStateEvaluation {
  status: CanonicalProposalStatus;
  isQuorumReached: boolean;
  isMajorityReached: boolean;
  participationPercentage: number;
  approvalPercentage: number;
  canVote: boolean;
  canQueue: boolean;
  canExecute: boolean;
  timeRemainingSeconds: number;
  reason?: string;
}

export const DEFAULT_GOVERNANCE_CONFIG: CanonicalGovernanceConfig = {
  totalWeight: 1000,
  quorum: 200, // 20%
  quorumFraction: 20,
  majorityThreshold: 50, // > 50%
  votingDelaySeconds: 0,
  votingPeriodSeconds: 604800, // 7 days
  executionDelaySeconds: 86400, // 24h timelock
  executionGracePeriodSeconds: 1209600, // 14 days grace
  proposalCount: 0,
};

/**
 * Evaluates the authoritative canonical state machine for a proposal
 * based on current block / wall-clock time and voting totals.
 */
export function evaluateProposalState(
  proposal: CanonicalProposal,
  currentTimeSeconds: number = Math.floor(Date.now() / 1000),
  config: CanonicalGovernanceConfig = DEFAULT_GOVERNANCE_CONFIG,
): GovernanceStateEvaluation {
  const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
  const quorumTarget = proposal.quorumSnapshot > 0 ? proposal.quorumSnapshot : config.quorum;
  const isQuorumReached = totalVotes >= quorumTarget;
  const nonAbstainVotes = proposal.votesFor + proposal.votesAgainst;
  const isMajorityReached =
    nonAbstainVotes > 0 &&
    (proposal.votesFor * 100) / nonAbstainVotes > config.majorityThreshold;

  const totalWeight = proposal.totalWeightSnapshot > 0 ? proposal.totalWeightSnapshot : config.totalWeight;
  const participationPercentage = totalWeight > 0 ? (totalVotes / totalWeight) * 100 : 0;
  const approvalPercentage = nonAbstainVotes > 0 ? (proposal.votesFor / nonAbstainVotes) * 100 : 0;

  if (proposal.canceled) {
    return {
      status: "Canceled",
      isQuorumReached,
      isMajorityReached,
      participationPercentage,
      approvalPercentage,
      canVote: false,
      canQueue: false,
      canExecute: false,
      timeRemainingSeconds: 0,
      reason: "Proposal was canceled by proposer or governance policy",
    };
  }

  if (proposal.executed) {
    return {
      status: "Executed",
      isQuorumReached,
      isMajorityReached,
      participationPercentage,
      approvalPercentage,
      canVote: false,
      canQueue: false,
      canExecute: false,
      timeRemainingSeconds: 0,
      reason: "Proposal transaction has been dispatched and executed on-chain",
    };
  }

  // Pending: before startTime
  if (currentTimeSeconds < proposal.startTime) {
    return {
      status: "Pending",
      isQuorumReached: false,
      isMajorityReached: false,
      participationPercentage: 0,
      approvalPercentage: 0,
      canVote: false,
      canQueue: false,
      canExecute: false,
      timeRemainingSeconds: proposal.startTime - currentTimeSeconds,
      reason: "Voting delay active; proposal voting will open soon",
    };
  }

  // Active: between startTime and endTime
  if (currentTimeSeconds <= proposal.endTime) {
    return {
      status: "Active",
      isQuorumReached,
      isMajorityReached,
      participationPercentage,
      approvalPercentage,
      canVote: true,
      canQueue: false,
      canExecute: false,
      timeRemainingSeconds: proposal.endTime - currentTimeSeconds,
      reason: "Voting is currently open",
    };
  }

  // Voting period ended. Did it reach quorum and majority?
  if (!isQuorumReached) {
    return {
      status: "Defeated",
      isQuorumReached: false,
      isMajorityReached,
      participationPercentage,
      approvalPercentage,
      canVote: false,
      canQueue: false,
      canExecute: false,
      timeRemainingSeconds: 0,
      reason: `Proposal failed to reach required quorum (${totalVotes}/${quorumTarget})`,
    };
  }

  if (!isMajorityReached) {
    return {
      status: "Defeated",
      isQuorumReached: true,
      isMajorityReached: false,
      participationPercentage,
      approvalPercentage,
      canVote: false,
      canQueue: false,
      canExecute: false,
      timeRemainingSeconds: 0,
      reason: `Proposal failed to secure majority support (${approvalPercentage.toFixed(1)}% <= ${config.majorityThreshold}%)`,
    };
  }

  // Succeeded: check timelock / queueing
  if (config.executionDelaySeconds > 0) {
    const queueEta = proposal.eta ?? proposal.endTime + config.executionDelaySeconds;
    const expirationTime = queueEta + config.executionGracePeriodSeconds;

    if (currentTimeSeconds < queueEta) {
      return {
        status: "Queued",
        isQuorumReached: true,
        isMajorityReached: true,
        participationPercentage,
        approvalPercentage,
        canVote: false,
        canQueue: false,
        canExecute: false,
        timeRemainingSeconds: queueEta - currentTimeSeconds,
        reason: `Proposal queued; timelock delay expires in ${queueEta - currentTimeSeconds}s`,
      };
    }

    if (currentTimeSeconds > expirationTime) {
      return {
        status: "Expired",
        isQuorumReached: true,
        isMajorityReached: true,
        participationPercentage,
        approvalPercentage,
        canVote: false,
        canQueue: false,
        canExecute: false,
        timeRemainingSeconds: 0,
        reason: "Proposal succeeded but expired without being executed within grace period",
      };
    }

    // Ready to execute
    return {
      status: "Succeeded",
      isQuorumReached: true,
      isMajorityReached: true,
      participationPercentage,
      approvalPercentage,
      canVote: false,
      canQueue: false,
      canExecute: true,
      timeRemainingSeconds: expirationTime - currentTimeSeconds,
      reason: "Proposal succeeded and timelock satisfied. Ready for execution.",
    };
  }

  // No execution delay: immediately executable
  return {
    status: "Succeeded",
    isQuorumReached: true,
    isMajorityReached: true,
    participationPercentage,
    approvalPercentage,
    canVote: false,
    canQueue: false,
    canExecute: true,
    timeRemainingSeconds: 0,
    reason: "Proposal succeeded and is ready for on-chain execution",
  };
}

/**
 * Expected Soroban canonical method identifiers and parameter specifications.
 */
export const CANONICAL_GOVERNANCE_METHODS = {
  GET_CONFIG: "get_config",
  GET_PROPOSAL: "get_proposal",
  GET_PROPOSAL_STATE: "get_state",
  PROPOSE: "propose",
  VOTE: "vote",
  QUEUE: "queue",
  EXECUTE: "execute",
  CANCEL: "cancel",
} as const;

/**
 * ABI Drift & Compatibility Guard
 *
 * By default, governance contract writes remain locked until an authoritative
 * contract hash or checked ABI fixture is explicitly validated.
 */
let isAbiCompatibilityVerified = false;

export function isGovernanceAbiVerified(): boolean {
  return isAbiCompatibilityVerified;
}

export function setGovernanceAbiVerified(verified: boolean): void {
  isAbiCompatibilityVerified = verified;
}

export class GovernanceAbiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GovernanceAbiError";
  }
}

/**
 * Asserts that the governance contract ABI has been verified before allowing
 * state-mutating transactions.
 */
export function assertGovernanceCompatibility(): void {
  if (!isAbiCompatibilityVerified) {
    throw new GovernanceAbiError(
      "Governance contract write capability is gated: Contract ABI compatibility has not been verified against an authoritative deployed spec. Write operations are disabled to prevent state-mutating failures.",
    );
  }
}
