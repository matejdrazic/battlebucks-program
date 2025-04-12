import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Battlebucks } from "../target/types/battlebucks";

describe("battlebucks", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Battlebucks as Program<Battlebucks>;

  it("Create lobby", async () => {

    const lobbyId = new anchor.BN(1);

    const tx = await program.methods.createLobby(lobbyId).rpc();
    console.log("Your transaction signature", tx);
  });
});
