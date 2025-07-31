// readAccount.ts
import { AnchorProvider, Program, setProvider, web3 } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import * as fs from "fs";

// RUN WITH:
// npx ts-node readStateFromProgram.ts

// CONFIGURATION – update these
const ACCOUNT_PUBLIC_KEY = new PublicKey("8Hc2dw4q1ALmT4hdypkrsmQCvjM1kqb2sk2ZRLcVjAd9");
const PROGRAM_ID = new PublicKey("CK7LHrJ39iHfnP8epZvqd48itMiz7oApMhmVkuDLRZ85");
const IDL_PATH = "./target/idl/battlebucks.json"; // Adjust to your local path
const ACCOUNT_TYPE = "lobby"; // e.g., "myAccount" (from IDL)

// MAIN FUNCTION
(async () => {
  // Create connection to Solana mainnet
  const connection = new Connection("https://api.mainnet-beta.solana.com");

  // Create a dummy wallet (readonly; no signing required)
  const dummyKeypair = web3.Keypair.generate();
  const provider = new AnchorProvider(connection, {
    publicKey: dummyKeypair.publicKey,
    signTransaction: async tx => tx,
    signAllTransactions: async txs => txs,
  }, {});
  setProvider(provider);

  // Load IDL
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));

  // Create Anchor program interface
  const program = new Program(idl, PROGRAM_ID, provider);

  // Fetch and log account data
  try {
    const account = await program.account[ACCOUNT_TYPE].fetch(ACCOUNT_PUBLIC_KEY);
    console.log("Decoded Account Data:", account);
  } catch (err) {
    console.error("Failed to fetch account:", err);
  }
})();
