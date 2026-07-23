## Bounty Solution: Extract Inline Mock Page Data into a Fixture Module

This refactor isolates all hardcoded mock data into a single, centralized fixtures module (`src/lib/fixtures.ts`). This makes the placeholder nature of the data obvious and prepares the codebase for integrating real-time hook dependencies without altering component logic structure.

### 📂 `src/lib/fixtures.ts` (New File)

Create this file to hold all extracted mock constants, adhering strictly to the required naming convention and commenting standards.

```typescript
/**
 * @fileoverview Mock data fixtures for pages like Treasury, Payroll, Vesting, and Governance.
 * 
 * WARNING: These are placeholder datasets only. They should be replaced with live hook calls (e.g., useTreasuryData(), etc.)
 * when the full data layer migration is complete. Do NOT commit these to production without verification.
 */

// =====================================
// TREASURY PAGE FIXTURES
// =====================================

/** Mock configuration data displayed on the Treasury page summary card. */
export const MOCK_TREASURY_CONFIG = { 
  balance: "450,000 XLM", 
  threshold: 3, 
  signerCount: 5, 
  txCount: 8 
};

/** Mock list of signers for transaction authorization. */
export const MOCK_TREASURY_SIGNERS = [
    "GA...ABC", 
    "GB...DEF", 
    "GA...XYZ", 
    // ... other mock addresses
];

/** Mock array representing pending transactions awaiting approval. */
export const MOCK_PENDING_TRANSACTIONS = [
    { id: "TX-001", to: "GA...XYZ", amount: "25,000 XLM", status: "Pending" },
    { id: "TX-002", to: "GB...DEF", amount: "1,000 XLM", status: "Pending" },
];


// =====================================
// VESTING PAGE FIXTURES
// =====================================

/** Mock vesting schedule data for a representative user. */
export const MOCK_VESTING_SCHEDULES = [
    { id: 1, userId: "user-a", totalVested: "50,000 XLM", remaining: "150,000 XLM", startDate: "2023-01-01" },
    { id: 2, userId: "user-b", totalVested: "10,000 XLM", remaining: "90,000 XLM", startDate: "2023-06-01" }
];

// =====================================
// PAYROLL PAGE FIXTURES
// =====================================

/** Mock list of paychecks/transactions for the current cycle. */
export const MOCK_PAYCHECK_HISTORY = [
    { id: "PCK-101", employeeId: 3, date: "2024-07-01", amount: "5,000 XLM", status: "Completed" },
    { id: "PCK-102", employeeId: 4, date: "2024-07-01", amount: "3,500 XLM", status: "Completed" }
];

// =====================================
// GOVERNANCE PAGE FIXTURES
// =====================================

/** Mock proposals list for the Governance page. */
export const MOCK_PROPOSALS = [
    { id: 1, title: "Upgrade Protocol V2", votesFor: 50, votesAgainst: 20, status: "Active" },
    { id: 2, title: "Treasury Allocation Review", votesFor: 10, votesAgainst: 5, status: "Completed" }
];

/** Mock list of users participating in governance. */
export const MOCK_GOV_PARTICIPANTS = [
    { address: "GA...ABC", stakedAmount: 1000, lastActivity: "2024-06-25" },
    { address: "GB...DEF", stakedAmount: 500, lastActivity: "2024-07-01" }
];

```

### ⚙️ Code Changes (Refactoring)

Below shows the required modifications for each page component.

#### 1. `src/app/treasury/page.tsx`

**Before:** Uses inline constants.
**After:** Imports mock data from `../lib/fixtures`.

```tsx
// src/app/treasury/page.tsx

import { MOCK_TREASURY_CONFIG, MOCK_TREASURY_SIGNERS, MOCK_PENDING_TRANSACTIONS } from '@/lib/fixtures'; 
// ^^^ ADD THIS IMPORT

export default function TreasuryPage() {
    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-6">Treasury Dashboard</h1>
            
            {/* Using imported mock data instead of inline literals */}
            <section className="grid grid-cols-4 gap-4 mb-8">
                <div className="p-4 bg-gray-100 rounded shadow">Balance: <span className="font-bold">{MOCK_TREASURY_CONFIG.balance}</span></div>
                <div className="p-4 bg-gray-100 rounded shadow">Threshold: {MOCK_TREASURY_CONFIG.threshold}</div>
                <div className="p-4 bg-gray-100 rounded shadow">Signers: {MOCK_TREASURY_CONFIG.signerCount}</div>
                <div className="p-4 bg-gray-100 rounded shadow">Tx Count: {MOCK_TREASURY_CONFIG.txCount}</div>
            </section>

            {/* Pending Transactions using imported mock data */}
            <h2 className="text-2xl font-semibold mb-4">Pending Approvals</h2>
            <ul className="space-y-3">
                {MOCK_PENDING_TRANSACTIONS.map((tx) => (
                    <li key={tx.id} className="flex justify-between p-3 border rounded bg-yellow-50">
                        <span>Transaction {tx.id} to {tx.to}</span>
                        <span className="font-mono text-red-600">{tx.amount}</span>
                    </li>
                ))}
            </ul>

             {/* Signer List using imported mock data */}
            <h2 className="text-2xl font-semibold mt-8 mb-4">Current Signers</h2>
            <div className="flex flex-wrap gap-2">
                 {MOCK_TREASURY_SIGNERS.map((signer) => (
                     <span key={signer} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">{signer}</span>
                ))}
            </div>
        </div>
    );
}
```

#### 2. `src/app/vesting/page.tsx` (Example of replacement)

```tsx
// src/app/vesting/page.tsx

import { MOCK_VESTING_SCHEDULES } from '@/lib/fixtures'; 
// ^^^ ADD THIS IMPORT

export default function VestingPage() {
    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-6">Vesting Dashboard</h1>
            
            {/* Using imported mock data */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Vesting Schedules</h2>
                <div className="space-y-4">
                    {MOCK_VESTING_SCHEDULES.map((schedule) => (
                        <div key={schedule.id} className="p-4 border rounded flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold">{`User ${schedule.userId}`}</h3>
                                <p className="text-sm text-gray-500">Start Date: {schedule.startDate}</p>
                            </div>
                            <div className="flex space-x-6 text-right">
                                <div>Vested: <span className="font-bold">{schedule.totalVested}</span></div>
                                <div>Remaining: <span className="font-bold">{schedule.remaining}</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
```

#### 3. `src/app/payroll/page.tsx` (Example of replacement)

```tsx
// src/app/payroll/page.tsx

import { MOCK_PAYCHECK_HISTORY } from '@/lib/fixtures'; 
// ^^^ ADD THIS IMPORT

export default function PayrollPage() {
    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-6">Payroll Dashboard</h1>
            
             {/* Using imported mock data */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Recent Paychecks</h2>
                <table className="min-w-full bg-white border border-gray-200 shadow-md rounded">
                    <thead>
                        <tr>
                            <th className="py-3 px-6 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="py-3 px-6 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                            <th className="py-3 px-6 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="py-3 px-6 text-right text-sm font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {MOCK_PAYCHECK_HISTORY.map((check) => (
                            <tr key={check.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-6 whitespace-nowrap text-sm font-medium">{check.id}</td>
                                <td className="py-3 px-6 whitespace-nowrap text-sm">{check.employeeId}</td>
                                <td className="py-3 px-6 whitespace-nowrap text-sm">{check.date}</td>
                                <td className="py-3 px-6 whitespace-nowrap text-right font-semibold">{check.amount} XLM</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
```

#### 4. `src/app/governance/page.tsx` (Example of replacement)

```tsx
// src/app/governance/page.tsx

import { MOCK_PROPOSALS, MOCK_GOV_PARTICIPANTS } from '@/lib/fixtures'; 
// ^^^ ADD THIS IMPORT

export default function GovernancePage() {
    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-6">Governance Dashboard</h1>

             {/* Proposals List using imported mock data */}
            <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Active Proposals</h2>
                 <div className="space-y-3 border p-4 rounded bg-gray-50">
                    {MOCK_PROPOSALS.map((proposal) => (
                        <div key={proposal.id} className="flex justify-between items-center py-2 border-b last:border-none text-sm">
                            <div>
                                <h3 className="font-semibold">{proposal.title}</h3>
                                <p className="text-gray-500">Status: {proposal.status}</p>
                            </div>
                            <div className="flex gap-4 font-bold text-right">
                                <span>Votes For: {proposal.votesFor}</span>
                                <span>Votes Against: {proposal.votesAgainst}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

             {/* Participants List using imported mock data */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Participants</h2>
                 <ul className="space-y-3">
                     {MOCK_GOV_PARTICIPANTS.map((participant) => (
                        <li key={participant.address} className="flex justify-between items-center p-3 border rounded bg-blue-50 text-sm">
                            <span>Address: {participant.address}</span>
                            <div className="text-right">
                                <p className="font-bold">{participant.stakedAmount}</p>
                                <p className="text-gray-600">Last Activity: {participant.lastActivity}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

        </div>
    );
}
```

### Verification and Testing Snippet

To ensure no behavioral change, the test should verify that accessing a key data point (e.g., the balance) still returns the expected mocked value after refactoring.

**Test File:** `src/lib/__tests__/fixtures.test.ts`

```typescript
import { MOCK_TREASURY_CONFIG, MOCK_TREASURY_SIGNERS } from '@/lib/fixtures';

describe('Fixtures Module Integrity Check', () => {
    // Test 1: Verify mock data type and structure consistency
    it('should export correctly typed constants for the treasury page', () => {
        expect(typeof MOCK_TREASURY_CONFIG).toBe('object');
        expect(MOCK_TREASURY_SIGNERS).toBeInstanceOf(Array);
        expect(MOCK_TREASURY_CONFIG.balance).toEqual("450,000 XLM");
    });

    // Test 2: Verify the mocked business data value
    it('should retain the correct placeholder balance amount', () => {
        const expectedBalance = "450,000 XLM";
        expect(MOCK_TREASURY_CONFIG.balance).toBe