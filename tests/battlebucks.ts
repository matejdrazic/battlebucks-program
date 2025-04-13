import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Battlebucks } from "../target/types/battlebucks";
import { expect } from "chai";

describe("battlebucks", async () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Battlebucks as Program<Battlebucks>;
  const PublicKey = anchor.web3.PublicKey;

  const wallet = program.provider.publicKey;

  const backendAuthWallet = anchor.web3.Keypair.generate();
  const backendAuthWalletPubkey = backendAuthWallet.publicKey;
  // const backendAuthWalletSecret = backendAuthWallet.secretKey;

  let authConfigPDA, bump


  // Fund the backend auth wallet
  it("Fund wallets", async () => {
    await program.provider.connection.requestAirdrop(
      backendAuthWalletPubkey,
      1000000000 // 1 SOL
    );
  });


  it("Initialize program with auth config", async () => {

    // Verify the backend auth wallet is set in the program state
    [authConfigPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("auth"), wallet.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .initialize(backendAuthWalletPubkey)
      .accounts({
        authConfig: authConfigPDA,
        admin: wallet,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Your transaction signature", tx);

    // Fetch the auth config account data
    const authConfigAccount = await program.account.authConfig.fetch(
      authConfigPDA
    );

    // Assert correct auth wallet was saved in AuthConfig account
    expect(authConfigAccount.backendAuthWallet.toString()).to.equal(
      backendAuthWalletPubkey.toString()
    );
  });

  it("Create lobby", async () => {
    const lobbyId = new anchor.BN(1);
    const buyInAmount = new anchor.BN(1000000);
    const rakePercentage = 10; // 10% rake
    const maxPlayers = 20;

    // Verify the backend auth wallet is set in the program state
    const [lobbyPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lobby"), lobbyId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const tx = await program.methods
      .createLobby(lobbyId, buyInAmount, rakePercentage, maxPlayers)
      .accounts({
        lobby: lobbyPDA,
        backendAuthWallet: backendAuthWalletPubkey,
        authConfig: authConfigPDA,
        admin: wallet,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([backendAuthWallet])
      .rpc();
    console.log("Your transaction signature", tx);

    
    // Fetch the auth config account data
    const lobbyAccount = await program.account.lobby.fetch(
      lobbyPDA
    );

    // Assert correct auth wallet was saved in AuthConfig account
    expect(lobbyAccount.lobbyId.toString()).to.equal(
      lobbyId.toString()
    );
  });
});
