import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const horizonUrl = process.env.STELLAR_TESTNET_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const horizon = new Horizon.Server(horizonUrl);

if (!/testnet/i.test(horizonUrl)) {
  throw new Error("Refusing to run: STELLAR_TESTNET_HORIZON_URL must target testnet.");
}

const keypair = Keypair.random();
const accountId = keypair.publicKey();

async function fundAccount() {
  const response = await fetch(
    `https://friendbot.stellar.org/?addr=${encodeURIComponent(accountId)}`,
  );
  if (!response.ok) {
    throw new Error(`Friendbot funding failed (${response.status}).`);
  }
}

async function main() {
  try {
    await fundAccount();
  } catch (error) {
    throw new Error(`Funding phase failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  let account;
  try {
    account = await horizon.loadAccount(accountId);
  } catch (error) {
    throw new Error(`Account loading phase failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.payment({ destination: accountId, asset: Asset.native(), amount: "0.0000001" }))
    .setTimeout(30)
    .build();

  transaction.sign(keypair);

  let submission;
  try {
    submission = await horizon.submitTransaction(transaction);
  } catch (error) {
    throw new Error(`Submission phase failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log(`Testnet wallet proof succeeded: ${submission.hash}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
