use anchor_lang::prelude::*;

// Imports
mod constants;
use crate::constants::*;


declare_id!("215rECMPco6vSdPqnw5yS6F4FPsqpc3vWkJRkesUTRoP");

/**
 * Functions expected in the battlebucks program
 * create_lobby()
 * join_lobby()
 * refund()
 * start_game()
 * end_game()
 * update_rake()
 * optional: update wallet, etc.
 */


#[program]
pub mod battlebucks {
    use super::*;

    // Function to init program and setup Auth config
    pub fn initialize(ctx: Context<Initialize>, admin: Pubkey, backend_auth_wallet: Pubkey) -> Result<()> {
        
        // Initialize the AuthConfig account by setting admin wallet and backend auth wallet
        let auth_config = &mut ctx.accounts.auth_config;
        auth_config.admin = admin;
        auth_config.backend_auth_wallet = backend_auth_wallet;

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
    pub fn join_lobby(ctx: Context<JoinLobby>, lobby_id: u64) -> Result<()> {

        ////// PLAYER PDA LOGIC
        // Initialize the player account
        let player = &mut ctx.accounts.player;
        player.lobby_id = lobby_id;
        player.player_pubkey = ctx.accounts.player_wallet.key();


        ///// LOBBY PDA LOGIC
        // Increment the current players in lobby
        let lobby = &mut ctx.accounts.lobby;
        lobby.current_players_in_lobby += 1;
        // Put lobby PDA in the player PDA
        player.lobby_pda = lobby.key();

        // Add the player PDA to the lobby's player PDAs
        lobby.player_pdas.push(ctx.accounts.player.key()); // CHECK: Maybe this vector is not necessary in storage

        Ok(())
    }
}

/// CONTEXTS
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 32 + 32, seeds = [AUTH_SEED], bump)]
    pub auth_config: Account<'info, AuthConfig>,
    /// The admin wallet that will be authorized to create lobbies
    #[account(mut)]
    pub admin: Signer<'info>,
    /// The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(lobby_id: u64, buy_in_amount: u64, rake_percentage: u8, max_players_in_lobby: Option<u8>)]
pub struct CreateLobby<'info> { // CHECK: Hardcoded 10 as max players (stress test later)
    #[account(init, payer = backend_auth_wallet, space = 8 + 8 + 8 + 1 + 1 + 1 + 1 + 32 + 4 + 32 * 20, seeds = [LOBBY_SEED, lobby_id.to_le_bytes().as_ref()], bump)]
    pub lobby: Account<'info, Lobby>,
    /// The wallet who is responsible for creating the lobby
    #[account(mut)]
    pub backend_auth_wallet: Signer<'info>,
    /// Auth config that stores the expected backend wallet pubkey
    #[account(
        seeds = [AUTH_SEED],
        bump,
        constraint = auth_config.backend_auth_wallet == backend_auth_wallet.key()
    )]
    pub auth_config: Account<'info, AuthConfig>,
    /// The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(lobby_id: u64)]
pub struct JoinLobby<'info> {
    #[account(init, payer = player_wallet, space = 8 + 8 + 32 + 32, seeds = [PLAYER_SEED, lobby_id.to_le_bytes().as_ref(), player_wallet.key().as_ref()], bump)]
    pub player: Account<'info, PlayerInLobby>,
    // Player wallet who is joining the lobby
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.to_le_bytes().as_ref()],
        bump,
        // constraint = lobby.current_players_in_lobby < lobby.max_players_in_lobby.unwrap_or(0)
    )]
    pub lobby: Account<'info, Lobby>,
    #[account(mut)]
    pub player_wallet: Signer<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}


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
pub struct PlayerInLobby {
    pub lobby_id: u64,
    pub lobby_pda: Pubkey, // PDA of the lobby the player is in
    pub player_pubkey: Pubkey
}

#[account]
pub struct AuthConfig {
    pub admin: Pubkey, // Admin wallet
    pub backend_auth_wallet: Pubkey, // Backend wallet authorized for lobby creation
}


// Maybe add 'NOT_INITIALIZED' to detect game accounts still not created
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameState {
    NotStarted, // Still not sure if this is default GameState
    InProgress,
    Ended,
}