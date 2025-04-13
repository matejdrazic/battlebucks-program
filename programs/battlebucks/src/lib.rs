use anchor_lang::prelude::*;

// Imports
mod constants;
use crate::constants::*;


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

    // Function to init program and setup Auth config
    pub fn initialize(ctx: Context<Initialize>, backend_auth_wallet: Pubkey) -> Result<()> {
        // Initialize the AuthConfig account
        ctx.accounts.auth_config.backend_auth_wallet = backend_auth_wallet;

        Ok(())
    }

    // Function to 'create' a new game lobby account
    //// Restrict function to only be callable by the backend auth wallet
    pub fn create_lobby(ctx: Context<CreateLobby>, lobby_id: u64, _buy_in_amount: u64, _rake_percentage: u8, _max_players_in_lobby: Option<u8>) -> Result<()> {
        // Initialize the lobby account
        let lobby = &mut ctx.accounts.lobby; 
        lobby.lobby_id = lobby_id;
        
        Ok(())
    }

    // Function invoked by player to join a specific lobby
    pub fn join_lobby(_ctx: Context<JoinLobby>) -> Result<()> {
        Ok(())
    }
}

/// CONTEXTS
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 32, seeds = [AUTH_SEED, admin.key().as_ref()], bump)]
    pub auth_config: Account<'info, AuthConfig>,
    /// The admin wallet that will be authorized to create lobbies
    #[account(mut)]
    pub admin: Signer<'info>,
    /// The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(lobby_id: u64)]
pub struct CreateLobby<'info> {
    #[account(init, payer = backend_auth_wallet, space = 8 + 8 + 8 + 1 + 1 + 1 + 1 + 32, seeds = [LOBBY_SEED, lobby_id.to_le_bytes().as_ref()], bump)]
    pub lobby: Account<'info, Lobby>,
    /// The wallet who is responsible for creating the lobby
    #[account(mut)]
    pub backend_auth_wallet: Signer<'info>,
    /// Auth config that stores the expected backend wallet pubkey
    #[account(
        seeds = [AUTH_SEED, admin.key().as_ref()],
        bump,
        constraint = auth_config.backend_auth_wallet == backend_auth_wallet.key()
    )]
    pub auth_config: Account<'info, AuthConfig>,
    /// CHECK: Admin wallet
    pub admin: AccountInfo<'info>,
    /// The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct JoinLobby {}


/// PDAs
#[account]
pub struct Lobby {
    pub lobby_id: u64,
    pub buy_in_amount: u64,
    pub rake_percentage: u8,
    pub max_players_in_lobby: Option<u8>, // optional constraint
    pub current_players_in_lobby: u8,
    pub game_state: GameState,
    pub player_pdas: Vec<Pubkey>, // PDAs of players in the lobby
}

#[account]
pub struct PlayerInLobby {}

#[account]
pub struct AuthConfig {
    pub backend_auth_wallet: Pubkey, // Backend wallet authorized for lobby creation
}


// Maybe add 'NOT_INITIALIZED' to detect game accounts still not created
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameState {
    NotInitialized, // Still not sure if this is default GameState
    Initialized,
    InProgress,
    Ended,
}