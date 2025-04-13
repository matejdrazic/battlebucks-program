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


  // Create a new wallet for the player
  const playerWallet = anchor.web3.Keypair.generate();
  const playerWalletPubkey = playerWallet.publicKey;

  // Create a new wallet for second player
  const secondPlayerWallet = anchor.web3.Keypair.generate();
  const secondPlayerWalletPubkey = secondPlayerWallet.publicKey;


  let authConfigPDA, bump, lobbyPDA


  // Fund the backend auth wallet
  it("Fund wallets", async () => {
    await program.provider.connection.requestAirdrop(
      backendAuthWalletPubkey,
      1000000000 // 1 SOL
    );

    await program.provider.connection.requestAirdrop(
      playerWalletPubkey,
      1000000000 // 1 SOL
    );

    await program.provider.connection.requestAirdrop(
      secondPlayerWalletPubkey,
      1000000000 // 1 SOL
    );
  });


  it("Initialize program with auth config", async () => {

    // Verify the backend auth wallet is set in the program state
    [authConfigPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("auth")],
      program.programId
    );

    const tx = await program.methods
      .initialize(wallet, backendAuthWalletPubkey)
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
    [lobbyPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lobby"), lobbyId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const tx = await program.methods
      .createLobby(lobbyId, buyInAmount, rakePercentage, maxPlayers)
      .accounts({
        lobby: lobbyPDA,
        backendAuthWallet: backendAuthWalletPubkey,
        authConfig: authConfigPDA,
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


  it("Create another lobby", async () => {
    const lobbyId = new anchor.BN(2);
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
  })


  it("Non authorized wallet can not create lobby", async () => {
    const lobbyId = new anchor.BN(2);
    const buyInAmount = new anchor.BN(1000000);
    const rakePercentage = 10; // 10% rake
    const maxPlayers = 20;

    // Verify the backend auth wallet is set in the program state
    const [lobbyPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lobby"), lobbyId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      await program.methods
        .createLobby(lobbyId, buyInAmount, rakePercentage, maxPlayers)
        .accounts({
          lobby: lobbyPDA,
          backendAuthWallet: wallet,
          authConfig: authConfigPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      expect.fail("Transaction should have failed");
    } catch (err) {
      expect(err).to.exist;
      // console.log("Transaction failed as expected:", err);
    }
  })


  it("Player joins lobby", async() => {
    const lobbyId = new anchor.BN(1);

    const [playerInLobbyPDA, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("player"), lobbyId.toArrayLike(Buffer, "le", 8), playerWalletPubkey.toBuffer()],
      program.programId
    );


    const tx = await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: lobbyPDA,
        player: playerInLobbyPDA,
        playerWallet: playerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([playerWallet])
      .rpc();
    console.log("Your transaction signature", tx);

    // Fetch the auth config account data
    const lobbyAccount = await program.account.lobby.fetch(
      lobbyPDA
    );

    // console.log(lobbyAccount)

    // Assert correct auth wallet was saved in AuthConfig account
    expect(lobbyAccount.playerPdas[0].toString()).to.equal(
      playerInLobbyPDA.toString()
    );
  })

  
  it("Same player can not join same lobby", async() => {
    const lobbyId = new anchor.BN(1);

    const [playerInLobbyPDA, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("player"), lobbyId.toArrayLike(Buffer, "le", 8), playerWalletPubkey.toBuffer()],
      program.programId
    );
    try {
      await program.methods
        .joinLobby(lobbyId)
        .accounts({
          lobby: lobbyPDA,
          player: playerInLobbyPDA,
          playerWallet: playerWalletPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([playerWallet])
        .rpc();
      expect.fail("Transaction should have failed");
    }
    catch (err) {
      expect(err).to.exist;
      // console.log("Transaction failed as expected:", err);
    }
  })

  it("Another player joins lobby", async() => {
    const lobbyId = new anchor.BN(1);

    const [secondPlayerInLobbyPDA, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("player"), lobbyId.toArrayLike(Buffer, "le", 8), secondPlayerWalletPubkey.toBuffer()],
      program.programId
    );
    const tx = await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: lobbyPDA,
        player: secondPlayerInLobbyPDA,
        playerWallet: secondPlayerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([secondPlayerWallet])
      .rpc();
    console.log("Your transaction signature", tx);
    // Fetch the auth config account data
    const lobbyAccount = await program.account.lobby.fetch(
      lobbyPDA
    );
    // console.log(lobbyAccount)
    // Assert correct auth wallet was saved in AuthConfig account
    expect(lobbyAccount.playerPdas[1].toString()).to.equal(
      secondPlayerInLobbyPDA.toString()
    );
    expect(lobbyAccount.playerPdas.length).to.equal(2);

  })
});
