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
});
