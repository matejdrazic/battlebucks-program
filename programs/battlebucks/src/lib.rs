use anchor_lang::prelude::*;

declare_id!("215rECMPco6vSdPqnw5yS6F4FPsqpc3vWkJRkesUTRoP");

/**
 * Functions expected in the battlebucks program
 * create_lobby()
 * join_lobby()
 * start_game()
 * end_game()
 * refund()
 * update_rake()
 * optional: update wallet, etc.
 */


#[program]
pub mod battlebucks {
    use super::*;

    // Function to 'create' a new game lobby account
    pub fn create_lobby(_ctx: Context<CreateLobby>, _lobby_id: u64) -> Result<()> {
        Ok(())
    }

    // Function invoked by player to join a specific lobby
    pub fn join_lobby(_ctx: Context<JoinLobby>) -> Result<()> {
        Ok(())
    }
}

/// CONTEXTS
#[derive(Accounts)]
pub struct CreateLobby {}

#[derive(Accounts)]
#[instruction(lobby_id: u64)]
pub struct JoinLobby {}


/// PDAs
#[account]
pub struct Lobby {}

#[account]
pub struct PlayerInLobby {}


// Maybe add 'NOT_INITIALIZED' to detect game accounts still not created
pub enum GameState {
    NotInitialized, // Still not sure if this is default GameState
    Initialized,
    InProgress,
    Ended,
}