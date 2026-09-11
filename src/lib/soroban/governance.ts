/**
 * Governance contract write/read wrappers, built on the shared tx lifecycle.
 *
 * Same caveat as `treasury.ts`: method/argument names follow this repo's
 * naming conventions and the shape implied by the governance page's existing
 * mock data (weighted voting, quorum, per-proposal action + amount), but no
 * governance contract is deployed/checked into this repo yet — align these
 * in one place once a real spec is available.
 */

import type { contract } from "@stellar/stellar-sdk";
import { getGovernanceClient, type WalletSigner } from "./client";
import { runInvocation, type LifecycleResult } from "./txLifecycle";
import { isGovernanceConfigured } from "./config";
import {
  assertGovernanceCompatibility,
  isGovernanceAbiVerified,
  setGovernanceAbiVerified,
  evaluateProposalState,
  type CanonicalProposal,
  type CanonicalProposalStatus,
  type CanonicalGovernanceConfig,
} from "./governanceAbi";

export interface GovernanceConfigView {
  totalWeight: number;
  quorum: number;
  proposalCount: number;
}

export interface ProposalView {
  id: number;
  proposer: string;
  title: string;
  description: string;
  action: "Funding" | "PolicyChange" | "AddMember" | "RemoveMember" | "General";
  amount: bigint | null;
  recipient: string | null;
  votesFor: number;
  votesAgainst: number;
  totalWeight: number;
  quorum: number;
  endTime: number;
  executed: boolean;
}

async function client(signer: WalletSigner | null): Promise<contract.Client> {
  return getGovernanceClient(signer);
}

/** Dynamic per-contract methods aren't in `contract.Client`'s static type — see module doc. */
type DynamicClient = contract.Client & Record<string, (...args: unknown[]) => Promise<contract.AssembledTransaction<unknown>>>;

export {
  isGovernanceConfigured,
  isGovernanceAbiVerified,
  setGovernanceAbiVerified,
  evaluateProposalState,
};
export type { CanonicalProposal, CanonicalProposalStatus, CanonicalGovernanceConfig };

export function isGovernanceWritesEnabled(): boolean {
  return isGovernanceConfigured() && isGovernanceAbiVerified();
}

export async function getGovernanceConfig(): Promise<LifecycleResult<GovernanceConfigView>> {
  const c = (await client(null)) as DynamicClient;
  return runInvocation(() => c.get_config() as Promise<contract.AssembledTransaction<GovernanceConfigView>>);
}

export async function getProposal(id: number): Promise<LifecycleResult<ProposalView>> {
  const c = (await client(null)) as DynamicClient;
  return runInvocation(
    () => c.get_proposal({ id }) as Promise<contract.AssembledTransaction<ProposalView>>,
  );
}

export async function createProposal(
  signer: WalletSigner,
  args: {
    title: string;
    description: string;
    action: ProposalView["action"];
    amount: bigint | null;
    recipient: string | null;
  },
  onStage?: Parameters<typeof runInvocation>[1],
): Promise<LifecycleResult<number>> {
  try {
    assertGovernanceCompatibility();
  } catch (err) {
    return {
      status: "error",
      stage: "error",
      message: err instanceof Error ? err.message : "Governance writes are currently gated.",
    };
  }
  const c = (await client(signer)) as DynamicClient;
  return runInvocation(
    () => c.create_proposal(args) as Promise<contract.AssembledTransaction<number>>,
    onStage,
  );
}

export async function vote(
  signer: WalletSigner,
  id: number,
  support: boolean,
  onStage?: Parameters<typeof runInvocation>[1],
): Promise<LifecycleResult<void>> {
  try {
    assertGovernanceCompatibility();
  } catch (err) {
    return {
      status: "error",
      stage: "error",
      message: err instanceof Error ? err.message : "Governance writes are currently gated.",
    };
  }
  const c = (await client(signer)) as DynamicClient;
  return runInvocation(
    () => c.vote({ id, support }) as Promise<contract.AssembledTransaction<void>>,
    onStage,
  );
}

export async function executeProposal(
  signer: WalletSigner,
  id: number,
  onStage?: Parameters<typeof runInvocation>[1],
): Promise<LifecycleResult<void>> {
  try {
    assertGovernanceCompatibility();
  } catch (err) {
    return {
      status: "error",
      stage: "error",
      message: err instanceof Error ? err.message : "Governance writes are currently gated.",
    };
  }
  const c = (await client(signer)) as DynamicClient;
  return runInvocation(
    () => c.execute_proposal({ id }) as Promise<contract.AssembledTransaction<void>>,
    onStage,
  );
}
