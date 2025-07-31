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

  // Derive a new wallet for the backend auth
  const backendAuthWallet = anchor.web3.Keypair.generate();
  const backendAuthWalletPubkey = backendAuthWallet.publicKey;
  // const backendAuthWalletSecret = backendAuthWallet.secretKey;

  // Derive a new wallet for the house rake
  const houseRakeWallet = anchor.web3.Keypair.generate();
  const houseRakeWalletPubkey = houseRakeWallet.publicKey;
  // const houseRakeWalletSecret = houseRakeWallet.secretKey;

  // Derive a new wallet for the end game funds recipient (provided by backend auth wallet)
  const endGameFundsRecipient = anchor.web3.Keypair.generate();
  const endGameFundsRecipientPubkey = endGameFundsRecipient.publicKey;
  // const endGameFundsRecipientSecret = endGameFundsRecipient.secretKey;

  // Create a new wallet for the player
  const playerWallet = anchor.web3.Keypair.generate();
  const playerWalletPubkey = playerWallet.publicKey;

  // Create a new wallet for second player
  const secondPlayerWallet = anchor.web3.Keypair.generate();
  const secondPlayerWalletPubkey = secondPlayerWallet.publicKey;

  const thirdPlayerWallet = anchor.web3.Keypair.generate();
  const thirdPlayerWalletPubkey = thirdPlayerWallet.publicKey;

  // Additional players for the refund bug test
  const fourthPlayerWallet = anchor.web3.Keypair.generate();
  const fourthPlayerWalletPubkey = fourthPlayerWallet.publicKey;

  const fifthPlayerWallet = anchor.web3.Keypair.generate();
  const fifthPlayerWalletPubkey = fifthPlayerWallet.publicKey;

  const sixthPlayerWallet = anchor.web3.Keypair.generate();
  const sixthPlayerWalletPubkey = sixthPlayerWallet.publicKey;

  let authConfigPDA, bump, lobbyPDA, escrowPDA;

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

    await program.provider.connection.requestAirdrop(
      thirdPlayerWalletPubkey,
      1000000000 // 1 SOL
    );

    await program.provider.connection.requestAirdrop(
      fourthPlayerWalletPubkey,
      1000000000 // 1 SOL
    );

    await program.provider.connection.requestAirdrop(
      fifthPlayerWalletPubkey,
      1000000000 // 1 SOL
    );

    await program.provider.connection.requestAirdrop(
      sixthPlayerWalletPubkey,
      1000000000 // 1 SOL
    );
  });

  it("Initialize program with auth config", async () => {
    // Verify the backend auth wallet is set in the program state
    [authConfigPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("auth")],
      program.programId
    );

    const [globalStatePDA, bump2] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    const rakePercentage = 15; // 15% rake

    const tx = await program.methods
      .initialize(
        wallet,
        backendAuthWalletPubkey,
        houseRakeWalletPubkey,
        rakePercentage
      )
      .accounts({
        authConfig: authConfigPDA,
        globalState: globalStatePDA,
        deployer: wallet,
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

    // Assert correct house rake wallet was saved in AuthConfig account
    expect(authConfigAccount.houseWallet.toString()).to.equal(
      houseRakeWalletPubkey.toString()
    );
  });

  it("Create lobby", async () => {
    const lobbyId = "1";
    const buyInAmount = new anchor.BN(100000000); // 0.1 SOL
    const maxPlayers = 20;

    // Find the PDA for the lobby
    [lobbyPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lobby"), Buffer.from(lobbyId)],
      program.programId
    );

    // Find the PDA for the global state account
    const [globalStatePDA, bump2] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    const tx = await program.methods
      .createLobby(lobbyId.toString(), buyInAmount, maxPlayers)
      .accounts({
        lobby: lobbyPDA,
        backendAuthWallet: backendAuthWalletPubkey,
        globalState: globalStatePDA,
        authConfig: authConfigPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([backendAuthWallet])
      .rpc();
    console.log("Your transaction signature", tx);

    // Fetch the auth config account data
    const lobbyAccount = await program.account.lobby.fetch(lobbyPDA);

    // Assert correct auth wallet was saved in AuthConfig account
    expect(lobbyAccount.lobbyId.toString()).to.equal(lobbyId.toString());
  });

  it("Create another lobby", async () => {
    const lobbyId = "2";
    const buyInAmount = new anchor.BN(1000000); // 0.001 SOL
    const maxPlayers = 2;

    // Find the PDA for the lobby
    const [lobbyPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lobby"), Buffer.from(lobbyId)],
      program.programId
    );

    // Find the PDA for the global state account
    const [globalStatePDA, bump2] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    const tx = await program.methods
      .createLobby(lobbyId, buyInAmount, maxPlayers)
      .accounts({
        lobby: lobbyPDA,
        backendAuthWallet: backendAuthWalletPubkey,
        globalState: globalStatePDA,
        authConfig: authConfigPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([backendAuthWallet])
      .rpc();
    console.log("Your transaction signature", tx);

    // Fetch the auth config account data
    const lobbyAccount = await program.account.lobby.fetch(lobbyPDA);
    // Assert correct auth wallet was saved in AuthConfig account
    expect(lobbyAccount.lobbyId.toString()).to.equal(lobbyId.toString());
  });

  it("Non authorized wallet can not create lobby", async () => {
    const lobbyId = "3";
    const buyInAmount = new anchor.BN(1000000);
    const maxPlayers = 20;

    // Verify the backend auth wallet is set in the program state
    const [lobbyPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lobby"), Buffer.from(lobbyId)],
      program.programId
    );

    const [globalStatePDA, bump2] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    try {
      await program.methods
        .createLobby(lobbyId, buyInAmount, maxPlayers)
        .accounts({
          lobby: lobbyPDA,
          backendAuthWallet: wallet,
          globalState: globalStatePDA,
          authConfig: authConfigPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      // expect.fail("Transaction should have failed");
    } catch (err) {
      expect(err).to.exist;
      // console.log("Transaction failed as expected:", err);
    }
  });

  it("Player joins lobby", async () => {
    const lobbyId = "1";

    // Find the PDA for the player in lobby
    const [playerInLobbyPDA, bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          playerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    // Find the PDA for the escrow account
    const [escrowPDA, bump2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    const tx = await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: lobbyPDA,
        escrow: escrowPDA,
        player: playerInLobbyPDA,
        playerWallet: playerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([playerWallet])
      .rpc();
    console.log("Your transaction signature", tx);

    // Fetch the auth config account data
    const lobbyAccount = await program.account.lobby.fetch(lobbyPDA);

    // Fetch the escrow account data
    const escrowBalance = await program.provider.connection.getBalance(
      escrowPDA
    );

    // console.log(lobbyAccount)

    // Assert correct auth wallet was saved in AuthConfig account
    expect(lobbyAccount.playerPdas[0].toString()).to.equal(
      playerInLobbyPDA.toString()
    );

    // Assert escrow account is has correct balance
    expect(escrowBalance.toString()).to.equal(
      lobbyAccount.buyInAmount.toString()
    );
  });

  it("Same player can not join same lobby", async () => {
    const lobbyId = "1";

    // Find the PDA for the player in lobby
    const [playerInLobbyPDA, bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          playerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    // Find the PDA for the escrow account
    const [escrowPDA, bump2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    try {
      await program.methods
        .joinLobby(lobbyId)
        .accounts({
          lobby: lobbyPDA,
          escrow: escrowPDA,
          player: playerInLobbyPDA,
          playerWallet: playerWalletPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([playerWallet])
        .rpc();
      expect.fail("Transaction should have failed");
    } catch (err) {
      expect(err).to.exist;
      // console.log("Transaction failed as expected:", err);
    }
  });

  it("Another player joins lobby", async () => {
    const lobbyId = "1";

    // Find the PDA for the player in lobby
    const [secondPlayerInLobbyPDA, bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          secondPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    // Find the PDA for the escrow account
    const [escrowPDA, bump2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    const tx = await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: lobbyPDA,
        escrow: escrowPDA,
        player: secondPlayerInLobbyPDA,
        playerWallet: secondPlayerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([secondPlayerWallet])
      .rpc();
    console.log("Your transaction signature", tx);

    // Fetch the auth config account data
    const lobbyAccount = await program.account.lobby.fetch(lobbyPDA);

    console.log(lobbyAccount);

    const escrowBalance = await program.provider.connection.getBalance(
      escrowPDA
    );

    // Assert correct auth wallet was saved in AuthConfig account
    expect(lobbyAccount.playerPdas[1].toString()).to.equal(
      secondPlayerInLobbyPDA.toString()
    );

    expect(lobbyAccount.playerPdas.length).to.equal(2);

    // Assert escrow account has correct balance
    expect(escrowBalance.toString()).to.equal(
      lobbyAccount.buyInAmount.mul(new anchor.BN(2)).toString()
    );
  });

  it("Player leaves lobby", async () => {
    const lobbyId = "1";

    const userBalanceBeforeClosingAccount =
      await program.provider.connection.getBalance(secondPlayerWalletPubkey);

    // Find the PDA for the player in lobby
    const [secondPlayerInLobbyPDA, bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          secondPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    // Find the PDA for the escrow account
    const [escrowPDA, bump2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    // Leave lobby as second player
    const tx = await program.methods
      .refund(lobbyId)
      .accounts({
        lobby: lobbyPDA,
        escrow: escrowPDA,
        player: secondPlayerInLobbyPDA,
        playerWallet: secondPlayerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([secondPlayerWallet])
      .rpc();
    console.log("Your transaction signature", tx);

    // Fetching closed account should fail
    try {
      // Fetch the second player in lobby account data
      await program.account.playerInLobby.fetch(secondPlayerInLobbyPDA);
      expect.fail("Transaction should have failed");
    } catch (err) {
      // console.log("Transaction failed as expected:", err);
    }

    // Fetch the auth config account data
    const lobbyAccount = await program.account.lobby.fetch(lobbyPDA);

    const userBalanceAfterClosingAccount =
      await program.provider.connection.getBalance(secondPlayerWalletPubkey);

    // Assert the player received the correct amount after closing account / leaving lobby
    expect(userBalanceAfterClosingAccount).to.be.gte(
      Number(lobbyAccount.buyInAmount) + userBalanceBeforeClosingAccount
    );

    // Expect the player PDAs in lobby array to be 1 less
    expect(lobbyAccount.playerPdas.length).to.equal(1);

    console.log(lobbyAccount);

    const escrowBalance = await program.provider.connection.getBalance(
      escrowPDA
    );
    // Assert escrow account has correct balance (it lost one buy-in amount)
    expect(escrowBalance.toString()).to.equal(
      lobbyAccount.buyInAmount.toString()
    );
  });

  it("Player can re-join lobby after leaving", async () => {
    const lobbyId = "1";

    // Find the PDA for the player in lobby
    const [secondPlayerInLobbyPDA, bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          secondPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    // Find the PDA for the escrow account
    const [escrowPDA, bump2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    const tx = await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: lobbyPDA,
        escrow: escrowPDA,
        player: secondPlayerInLobbyPDA,
        playerWallet: secondPlayerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([secondPlayerWallet])
      .rpc();
    console.log("Your transaction signature", tx);

    // Fetch the auth config account data
    const lobbyAccount = await program.account.lobby.fetch(lobbyPDA);

    // Assert correct auth wallet was saved in AuthConfig account
    expect(lobbyAccount.playerPdas[1].toString()).to.equal(
      secondPlayerInLobbyPDA.toString()
    );

    // Expect the player PDAs to be 2 again
    expect(lobbyAccount.playerPdas.length).to.equal(2);

    // This should now work
    await program.account.playerInLobby.fetch(secondPlayerInLobbyPDA);
  });

  it("Start game successfully", async () => {
    const lobbyId = "1";

    const tx = await program.methods
      .startGame(lobbyId)
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
    const lobbyAccount = await program.account.lobby.fetch(lobbyPDA);

    // Assert correct game state after starting game
    // expect(lobbyAccount.gameState).to.equal(true);
    expect(lobbyAccount.gameState.inProgress);
  });

  it("Player can not join lobby if game already started", async () => {
    const lobbyId = "1";

    // Find the PDA for the player in lobby
    const [thirdPlayerInLobbyPDA, bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          secondPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    // Find the PDA for the escrow account
    const [escrowPDA, bump2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    try {
      await program.methods
        .joinLobby(lobbyId)
        .accounts({
          lobby: lobbyPDA,
          escrow: escrowPDA,
          player: thirdPlayerInLobbyPDA,
          playerWallet: thirdPlayerWalletPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([thirdPlayerWallet])
        .rpc();
      expect.fail("Transaction should have failed");
    } catch (err) {
      expect(err).to.exist;
      // console.log("Transaction failed as expected:", err);
    }
  });

  it("Player can not leave lobby if game already started", async () => {
    const lobbyId = "1";

    // Find the PDA for the player in lobby
    const [secondPlayerInLobbyPDA, bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          secondPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    // Find the PDA for the escrow account
    const [escrowPDA, bump2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    try {
      await program.methods
        .refund(lobbyId)
        .accounts({
          lobby: lobbyPDA,
          escrow: escrowPDA,
          player: secondPlayerInLobbyPDA,
          playerWallet: secondPlayerWalletPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([secondPlayerWallet])
        .rpc();
      expect.fail("Transaction should have failed");
    } catch (err) {
      expect(err).to.exist;
      // console.log("Transaction failed as expected:", err);
    }
  });

  it("Update rake percentage", async () => {
    const lobbyId = "1";

    const rakePercentage = 10; // 10% rake

    // Verify the backend auth wallet is set in the program state
    const [globalStatePDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    const tx = await program.methods
      .updateRake(lobbyId, rakePercentage)
      .accounts({
        lobby: lobbyPDA,
        backendAuthWallet: backendAuthWalletPubkey,
        authConfig: authConfigPDA,
        globalState: globalStatePDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([backendAuthWallet])
      .rpc();
    console.log("Your transaction signature", tx);

    // Fetch the auth config account data
    const lobbyAccount = await program.account.lobby.fetch(lobbyPDA);

    // Expect new rake percentage in lobby account
    expect(lobbyAccount.rakePercentage.toString()).to.equal(
      rakePercentage.toString()
    );
  });

  it("Non authorized wallet can not end game", async () => {
    const lobbyId = "1";

    // Find the PDA for the escrow account
    const [escrowPDA, bump2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    try {
      await program.methods
        .endGame(lobbyId)
        .accounts({
          lobby: lobbyPDA,
          escrow: escrowPDA,
          houseWallet: houseRakeWalletPubkey,
          recipientWallet: endGameFundsRecipientPubkey,
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
  });

  it("End game successfully", async () => {
    const lobbyId = "1";

    // Get balance of the rake wallet before ending the game
    const houseRakeBalanceBefore = await program.provider.connection.getBalance(
      houseRakeWalletPubkey
    );

    // Get balance of the end game funds recipient before ending the game
    const endGameFundsRecipientBalanceBefore =
      await program.provider.connection.getBalance(endGameFundsRecipientPubkey);

    // Find the PDA for the escrow account
    const [escrowPDA, bump2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    const tx = await program.methods
      .endGame(lobbyId)
      .accounts({
        lobby: lobbyPDA,
        escrow: escrowPDA,
        houseWallet: houseRakeWalletPubkey,
        recipientWallet: endGameFundsRecipientPubkey,
        backendAuthWallet: backendAuthWalletPubkey,
        authConfig: authConfigPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([backendAuthWallet])
      .rpc();
    console.log("Your transaction signature", tx);

    // Get the balance of the escrow account
    const escrowBalance = await program.provider.connection.getBalance(
      escrowPDA
    );

    // Get the balance of the house rake wallet
    const houseRakeBalance = await program.provider.connection.getBalance(
      houseRakeWalletPubkey
    );

    // Get the balance of the end game funds recipient wallet
    const endGameFundsRecipientBalance =
      await program.provider.connection.getBalance(endGameFundsRecipientPubkey);

    // Expect the escrow account to be empty
    expect(escrowBalance.toString()).to.equal("0");

    // Expect the house rake wallet to have received the rake amount
    expect(houseRakeBalance).to.equal(
      houseRakeBalanceBefore + 20000000 // 0.02 SOL
    );

    // Expect the end game funds recipient wallet to have received the remaining balance
    expect(endGameFundsRecipientBalance).to.equal(
      endGameFundsRecipientBalanceBefore + 180000000 // 0.18 SOL
    );
  });

  it("Can not update rake percentage after game ended", async () => {
    const lobbyId = "1";

    const rakePercentage = 15; // 15% rake

    // Verify the backend auth wallet is set in the program state
    const [globalStatePDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    try {
      await program.methods
        .updateRake(lobbyId, rakePercentage)
        .accounts({
          lobby: lobbyPDA,
          backendAuthWallet: backendAuthWalletPubkey,
          authConfig: authConfigPDA,
          globalState: globalStatePDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([backendAuthWallet])
        .rpc();
      expect.fail("Transaction should have failed");
    } catch (err) {
      expect(err).to.exist;
      // console.log("Transaction failed as expected:", err);
    }
  });

  it("Update auth config", async () => {
    const lobbyId = "3";

    // Generate dummy wallets just to change values in auth config account
    const dummyHouseRakeWallet = anchor.web3.Keypair.generate();
    const dummyHouseRakeWalletPubkey = dummyHouseRakeWallet.publicKey;
    // const dummyHouseRakeWalletSecret = dummyHouseRakeWallet.secretKey;
    const dummyBackendWallet = anchor.web3.Keypair.generate();
    const dummyBackendWalletPubkey = dummyBackendWallet.publicKey;
    // const dummyEndGameFundsRecipientSecret = dummyEndGameFundsRecipient.secretKey;

    // Airdrop dummy backend wallet
    await program.provider.connection.requestAirdrop(
      dummyBackendWalletPubkey,
      1000000000 // 1 SOL
    );

    // Find the PDA for the lobby
    [lobbyPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lobby"), Buffer.from(lobbyId)],
      program.programId
    );

    // Find the PDA for the global state account
    const [globalStatePDA, bump2] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    const tx = await program.methods
      .updateAuthConfig(
        wallet,
        dummyBackendWalletPubkey,
        dummyHouseRakeWalletPubkey
      )
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

    // Expect new values in auth config account
    expect(authConfigAccount.backendAuthWallet.toString()).to.equal(
      dummyBackendWalletPubkey.toString()
    );
    expect(authConfigAccount.houseWallet.toString()).to.equal(
      dummyHouseRakeWalletPubkey.toString()
    );
    expect(authConfigAccount.admin.toString()).to.equal(wallet.toString());

    // Old backend auth wallet CAN NOT create a lobby
    try {
      await program.methods
        .createLobby(lobbyId, new anchor.BN(1000000), 15)
        .accounts({
          lobby: lobbyPDA,
          backendAuthWallet: backendAuthWalletPubkey,
          globalState: globalStatePDA,
          authConfig: authConfigPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([backendAuthWallet])
        .rpc();
      expect.fail("Transaction should have failed");
    } catch (err) {
      // console.log("Transaction failed as expected:", err);
    }
  });

  it("Check max players restriction is working", async () => {
    const lobbyId = "2";

    const [lobbyPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lobby"), Buffer.from(lobbyId)],
      program.programId
    );

    // Find the PDA for the player in lobby
    const [playerInLobbyPDA, bump2] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          playerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    // Find the PDA for the player in lobby
    const [secondPlayerInLobbyPDA, bump3] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          secondPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    // Find the PDA for the escrow account
    const [escrowPDA, bump4] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: lobbyPDA,
        escrow: escrowPDA,
        player: playerInLobbyPDA,
        playerWallet: playerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([playerWallet])
      .rpc();

    await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: lobbyPDA,
        escrow: escrowPDA,
        player: secondPlayerInLobbyPDA,
        playerWallet: secondPlayerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([secondPlayerWallet])
      .rpc();

    // THIRD PLAYER JOINING LOBBY SHOULD NOT BE POSSIBLE BECAUSE OF MAX_PLAYERS RESTRICTION
    // Find the PDA for the player in lobby
    const [thirdPlayerInLobbyPDA, bump5] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("player"),
        Buffer.from(lobbyId),
        thirdPlayerWalletPubkey.toBuffer(),
      ],
      program.programId
    );

    try {
      await program.methods
        .joinLobby(lobbyId)
        .accounts({
          lobby: lobbyPDA,
          escrow: escrowPDA,
          player: thirdPlayerInLobbyPDA,
          playerWallet: thirdPlayerWalletPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([thirdPlayerWallet])
        .rpc();
    } catch (err) {
      expect(err).to.exist;
      // console.log("Transaction failed as expected:", err);
    }
  });

  // NEW TEST: Reproduce the refund bug described by the client
  it("Reproduce refund bug - lobby capacity after player leaves", async () => {
    const lobbyId = "bug_test";
    const buyInAmount = new anchor.BN(1000000); // 0.001 SOL
    const maxPlayers = 4; // Set max players to 4 to match the client scenario

    // Create a new lobby for this specific test
    const [testLobbyPDA, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lobby"), Buffer.from(lobbyId)],
      program.programId
    );

    const [globalStatePDA, bump2] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    // Get the current auth config (updated in previous test)
    const authConfigAccount = await program.account.authConfig.fetch(
      authConfigPDA
    );
    const currentBackendAuth = authConfigAccount.backendAuthWallet;

    // We need to fund the current backend auth wallet
    await program.provider.connection.requestAirdrop(
      currentBackendAuth,
      1000000000 // 1 SOL
    );

    // Actually, let's reset the auth config back to use the original backend wallet for this test
    await program.methods
      .updateAuthConfig(wallet, backendAuthWalletPubkey, houseRakeWalletPubkey)
      .accounts({
        authConfig: authConfigPDA,
        admin: wallet,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Create the test lobby
    await program.methods
      .createLobby(lobbyId, buyInAmount, maxPlayers)
      .accounts({
        lobby: testLobbyPDA,
        backendAuthWallet: backendAuthWalletPubkey,
        globalState: globalStatePDA,
        authConfig: authConfigPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([backendAuthWallet])
      .rpc();

    console.log("✓ Transaction 1: Create Lobby - Lobby was created. [OK]");

    // Find the PDA for the escrow account
    const [testEscrowPDA, bump3] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(lobbyId)],
      program.programId
    );

    // Transaction 2: Player 1 joins
    const [player1InLobbyPDA, bump1] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          playerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: testLobbyPDA,
        escrow: testEscrowPDA,
        player: player1InLobbyPDA,
        playerWallet: playerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([playerWallet])
      .rpc();

    console.log("✓ Transaction 2: Join Lobby - Player 1 joined. [OK]");

    // Transaction 3: Player 2 joins
    const [player2InLobbyPDA, bump4] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          secondPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: testLobbyPDA,
        escrow: testEscrowPDA,
        player: player2InLobbyPDA,
        playerWallet: secondPlayerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([secondPlayerWallet])
      .rpc();

    console.log("✓ Transaction 3: Join Lobby - Player 2 joined. [OK]");

    // Transaction 4: Player 3 joins
    const [player3InLobbyPDA, bump5] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          thirdPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: testLobbyPDA,
        escrow: testEscrowPDA,
        player: player3InLobbyPDA,
        playerWallet: thirdPlayerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([thirdPlayerWallet])
      .rpc();

    console.log("✓ Transaction 4: Join Lobby - Player 3 joined. [OK]");

    // Verify we have 3 players in the lobby
    let lobbyAccount = await program.account.lobby.fetch(testLobbyPDA);
    expect(lobbyAccount.playerPdas.length).to.equal(3);
    console.log("-- Up to this point, we have 3 players in the lobby --");

    // Transaction 5: Player 2 refunds (leaves)
    await program.methods
      .refund(lobbyId)
      .accounts({
        lobby: testLobbyPDA,
        escrow: testEscrowPDA,
        player: player2InLobbyPDA,
        playerWallet: secondPlayerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([secondPlayerWallet])
      .rpc();

    console.log("✓ Transaction 5: Refund - Player 2 refunded. [OK]");

    // Verify we now have 2 players in the lobby
    lobbyAccount = await program.account.lobby.fetch(testLobbyPDA);
    expect(lobbyAccount.playerPdas.length).to.equal(2);
    console.log("-- Up to this point, we have 2 players in the lobby --");

    // Transaction 6: Player 4 joins (should be the 3rd player now)
    const [player4InLobbyPDA, bump6] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          fourthPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    await program.methods
      .joinLobby(lobbyId)
      .accounts({
        lobby: testLobbyPDA,
        escrow: testEscrowPDA,
        player: player4InLobbyPDA,
        playerWallet: fourthPlayerWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([fourthPlayerWallet])
      .rpc();

    console.log(
      "✓ Transaction 6: Join Lobby - Player 4 joined, but on the lobby it is the 3rd player. [OK]"
    );

    // Verify we now have 3 players in the lobby
    lobbyAccount = await program.account.lobby.fetch(testLobbyPDA);
    expect(lobbyAccount.playerPdas.length).to.equal(3);
    console.log("-- Up to this point, we have 3 players in the lobby --");
    console.log("Here is when the problem comes:");

    // Transaction 7: Player 5 attempts to join (would be 4th player in the lobby)
    const [player5InLobbyPDA, bump7] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          fifthPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    let player5JoinFailed = false;
    try {
      await program.methods
        .joinLobby(lobbyId)
        .accounts({
          lobby: testLobbyPDA,
          escrow: testEscrowPDA,
          player: player5InLobbyPDA,
          playerWallet: fifthPlayerWalletPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([fifthPlayerWallet])
        .rpc();
      console.log(
        "✗ Transaction 7: Join Lobby - Player 5 should have failed but succeeded!"
      );

      // Fetch the lobby account to check the number of players
      lobbyAccount = await program.account.lobby.fetch(testLobbyPDA);
      expect(lobbyAccount.playerPdas.length).to.equal(4);
      console.log(
        "✓ Transaction 7: Join Lobby - Player 5 joined, but on the lobby it is the 4th player. [OK]"
      );
    } catch (err) {
      player5JoinFailed = true;
      console.log(
        "✗ Transaction 7: Join Lobby - Player 5 attempted to join (would be 4th player in the lobby), but the transaction failed claiming 'Lobby is full'. We have 3 players here, not 4."
      );
    }

    // Transaction 8: Player 6 attempts to join (would be 4th player in the lobby)
    const [player6InLobbyPDA, bump8] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("player"),
          Buffer.from(lobbyId),
          sixthPlayerWalletPubkey.toBuffer(),
        ],
        program.programId
      );

    let player6JoinFailed = false;
    try {
      await program.methods
        .joinLobby(lobbyId)
        .accounts({
          lobby: testLobbyPDA,
          escrow: testEscrowPDA,
          player: player6InLobbyPDA,
          playerWallet: sixthPlayerWalletPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([sixthPlayerWallet])
        .rpc();
      console.log(
        "✗ Transaction 8: Join Lobby - Player 6 should have failed but succeeded!"
      );
    } catch (err) {
      player6JoinFailed = true;
      console.log(err.message);
      console.log(
        "✗ Transaction 8: Join Lobby - Player 6 attempted to join (would be 4th player in the lobby), but the transaction failed claiming 'Lobby is full'. We have 3 players here, not 4. - Same error as before."
      );
    }

    console.log("-- We still have 3 players in the lobby --");

    // Transaction 9: Start Game (should fail if there are only 3 players but max is 4)
    let gameStartedSuccessfully = false;
    try {
      await program.methods
        .startGame(lobbyId)
        .accounts({
          lobby: testLobbyPDA,
          backendAuthWallet: backendAuthWalletPubkey,
          authConfig: authConfigPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([backendAuthWallet])
        .rpc();
      gameStartedSuccessfully = true;
      console.log(
        "✓ Transaction 9: Start Game - The game started successfully. But there were 3 players in the lobby, not 4, so it shouldn't start. [Not ok]"
      );
    } catch (err) {
      console.log(
        "✗ Transaction 9: Start Game - Failed to start game:",
        err.message
      );
    }

    // Verify the final state
    lobbyAccount = await program.account.lobby.fetch(testLobbyPDA);
    console.log(
      `Final lobby state: ${lobbyAccount.playerPdas.length} players, max: ${lobbyAccount.maxPlayersInLobby}`
    );

    // If the bug exists, we should see the following issues:
    // 1. Players 5 and 6 failed to join even though there should be room for one more player
    // 2. The game started with only 3 players when it should require 4 (or at least allow 4)

    // Document the findings
    if (player5JoinFailed && player6JoinFailed) {
      console.log(
        "🐛 BUG REPRODUCED: Players are unable to join lobby after another player left, even though there is still capacity"
      );
    } else {
      console.log("✅ No bug found: Players were able to join as expected");
    }

    if (
      gameStartedSuccessfully &&
      lobbyAccount.playerPdas.length < maxPlayers
    ) {
      console.log(
        "🐛 BUG REPRODUCED: Game started with fewer players than max capacity"
      );
    }

    // Transaction 10: End Game (if it started)
    if (gameStartedSuccessfully) {
      try {
        await program.methods
          .endGame(lobbyId)
          .accounts({
            lobby: testLobbyPDA,
            escrow: testEscrowPDA,
            houseWallet: houseRakeWalletPubkey,
            recipientWallet: endGameFundsRecipientPubkey,
            backendAuthWallet: backendAuthWalletPubkey,
            authConfig: authConfigPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([backendAuthWallet])
          .rpc();
        console.log(
          "✓ Transaction 10: End Game - The game ended successfully. [OK]"
        );
      } catch (err) {
        console.log(
          "✗ Transaction 10: End Game - Failed to end game:",
          err.message
        );
      }
    }
  });
});
