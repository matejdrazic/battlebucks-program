use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};


// Imports
mod constants;
use crate::constants::*;


declare_id!("215rECMPco6vSdPqnw5yS6F4FPsqpc3vWkJRkesUTRoP");


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
    //// Make sure rake_percentage <= 100 & max players is satisfied
    pub fn create_lobby(ctx: Context<CreateLobby>, lobby_id: u64, buy_in_amount: u64, rake_percentage: u8, max_players_in_lobby: Option<u8>) -> Result<()> {
        
        // Initialize the lobby account
        let lobby = &mut ctx.accounts.lobby; 
        lobby.lobby_id = lobby_id;
        lobby.buy_in_amount = buy_in_amount;
        lobby.rake_percentage = rake_percentage;
        lobby.max_players_in_lobby = max_players_in_lobby;        
        
        Ok(())
    }

    // Function invoked by player to join a specific lobby
    pub fn join_lobby(ctx: Context<JoinLobby>, lobby_id: u64) -> Result<()> {

        // Get player PDA and lobby PDA
        let player = &mut ctx.accounts.player;
        let lobby = &mut ctx.accounts.lobby;

        ////// PLAYER PDA LOGIC
        // Initialize the player account
        player.lobby_id = lobby_id;
        // Put lobby PDA in the player PDA
        player.lobby_pda = lobby.key();
        // Set the player public key to the player's wallet address
        player.player_pubkey = ctx.accounts.player_wallet.key();


        ///// LOBBY PDA LOGIC
        // Increment the current players in lobby
        lobby.current_players_in_lobby += 1;
        // Add the player PDA to the lobby's player PDAs
        lobby.player_pdas.push(player.key()); // CHECK: Maybe this vector is not necessary in storage


        //Transfer the buy-in amount from the player to the lobby escrow account (PDA)
        let from_pubkey = ctx.accounts.player_wallet.to_account_info();
        let to_pubkey = ctx.accounts.escrow.to_account_info();
        let program_id = ctx.accounts.system_program.to_account_info();

        let cpi_context = CpiContext::new(
            program_id,
            Transfer {
                from: from_pubkey,
                to: to_pubkey,
            },
        );

        transfer(cpi_context, lobby.buy_in_amount)?;


        Ok(())
    }

    // Function the player calls to leave lobby and get refund
    pub fn refund(ctx: Context<LeaveLobby>, lobby_id: u64) -> Result<()> {

        // Get the lobby PDA and player in lobby PDA
        let lobby = &mut ctx.accounts.lobby;
        let player = &mut ctx.accounts.player;

        // Decrement the current players in lobby
        lobby.current_players_in_lobby -= 1;
        // Remove the player PDA from the lobby's player PDAs
        lobby.player_pdas.retain(|&x| x != player.key()); // CHECK: Maybe this vector is not necessary in storage


        // Transfer funds from escrow to player wallet
        let from_pubkey = ctx.accounts.escrow.to_account_info();
        let to_pubkey = ctx.accounts.player_wallet.to_account_info();
        let program_id = ctx.accounts.system_program.to_account_info();

        let seed = lobby_id.to_le_bytes();
        let bump_seed = ctx.bumps.escrow;
        let signer_seeds: &[&[&[u8]]] = &[&[ESCROW_SEED, seed.as_ref(), &[bump_seed]]];

        let cpi_context = CpiContext::new(
            program_id,
            Transfer {
                from: from_pubkey,
                to: to_pubkey,
            },
        ).with_signer(signer_seeds);

        transfer(cpi_context, lobby.buy_in_amount)?;

        Ok(())
    }


    // Function to start the game
    pub fn start_game(ctx: Context<StartGame>, _lobby_id: u64) -> Result<()> {

        // Get the lobby PDA
        let lobby = &mut ctx.accounts.lobby;

        // Set the game state to InProgress
        lobby.game_state = GameState::InProgress;

        Ok(())
    }

    // Function to end the game
    pub fn end_game(ctx: Context<EndGame>, _lobby_id: u64, _recipient: Pubkey) -> Result<()> {

        // Close the lobby (?) and escrow PDA accounts
        // Pay out 2 provided wallets

        // Get the lobby PDA
        let lobby = &mut ctx.accounts.lobby;

        // Set the game state to Ended
        lobby.game_state = GameState::Ended;

        Ok(())
    }

    /*
    // Function to update rake
    pub fn update_rake(ctx: Context<UpdateRake>, lobby_id: u64, rake_percentage: u8) -> Result<()> {

        Ok(())
    }

    // Function to update auth config
    pub fn update_auth_config(ctx: Context<UpdateAuthConfig>, admin: Pubkey, backend_auth_wallet: Pubkey) -> Result<()> {

        Ok(())
    }
    */
}

/// CONTEXTS
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = deployer, space = 8 + 32 + 32, seeds = [AUTH_SEED], bump)]
    pub auth_config: Account<'info, AuthConfig>,
    /// The admin wallet that will be authorized to create lobbies
    #[account(mut)]
    pub deployer: Signer<'info>,
    /// The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(lobby_id: u64, buy_in_amount: u64, rake_percentage: u8, max_players_in_lobby: Option<u8>)]
pub struct CreateLobby<'info> { // CHECK: Hardcoded 10 as max players (stress test later)
    #[account(init, payer = backend_auth_wallet, space = 8 + 8 + 8 + 1 + 1 + 1 + 1 + 32 + 4 + 32 * 20, seeds = [LOBBY_SEED, lobby_id.to_le_bytes().as_ref()], bump)]
    pub lobby: Account<'info, Lobby>,
    // The wallet who is responsible for creating the lobby
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
    // Initializes the player in lobby PDA
    #[account(init, payer = player_wallet, space = 8 + 8 + 32 + 32 + 32, seeds = [PLAYER_SEED, lobby_id.to_le_bytes().as_ref(), player_wallet.key().as_ref()], bump)]
    pub player: Account<'info, PlayerInLobby>,
    // The escrow account that will hold the buy-in amount
    #[account(mut, seeds = [ESCROW_SEED, lobby_id.to_le_bytes().as_ref()], bump)]
    pub escrow: SystemAccount<'info>,
    // Player wallet who is joining the lobby
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.to_le_bytes().as_ref()],
        bump,
        // constraint = lobby.current_players_in_lobby < lobby.max_players_in_lobby.unwrap_or(0)
        constraint = lobby.game_state == GameState::NotStarted,
    )]
    pub lobby: Account<'info, Lobby>,
    #[account(mut)]
    pub player_wallet: Signer<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(lobby_id: u64)]
pub struct LeaveLobby <'info> {
    // The player PDA that will be closed
    #[account(
        mut, 
        close = player_wallet, 
        seeds = [PLAYER_SEED, lobby_id.to_le_bytes().as_ref(), player_wallet.key().as_ref()], 
        bump,
        constraint = player.player_pubkey == player_wallet.key(),
    )]
    pub player: Account<'info, PlayerInLobby>,
    // The lobby PDA
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.to_le_bytes().as_ref()],
        bump,
        constraint = lobby.game_state == GameState::NotStarted,
    )]
    pub lobby: Account<'info, Lobby>,
    // The escrow account that will be closed
    #[account(mut, seeds = [ESCROW_SEED, lobby_id.to_le_bytes().as_ref()], bump)]
    pub escrow: SystemAccount<'info>, /// CHECK: This is the correct escrow account for lobby
    // The system program
    pub system_program: Program<'info, System>,
    // Player wallet who is leaving the lobby
    #[account(mut)]
    pub player_wallet: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(lobby_id: u64)]
pub struct StartGame<'info> {
    // The lobby PDA
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.to_le_bytes().as_ref()],
        bump,
        constraint = lobby.game_state == GameState::NotStarted,
    )]
    pub lobby: Account<'info, Lobby>,
    // Auth config account
    #[account(
        seeds = [AUTH_SEED],
        bump,
        constraint = auth_config.backend_auth_wallet == backend_auth_wallet.key()
    )]
    pub auth_config: Account<'info, AuthConfig>,
    // The start game user, must be backend auth wallet
    pub backend_auth_wallet: Signer<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(lobby_id: u64)]
pub struct EndGame<'info> {
    // The lobby PDA
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.to_le_bytes().as_ref()],
        bump,
        constraint = lobby.game_state == GameState::InProgress,
    )]
    pub lobby: Account<'info, Lobby>,
    // Escrow account that will be closed
    #[account(
        mut, 
        seeds = [ESCROW_SEED, lobby_id.to_le_bytes().as_ref()], 
        bump,
    )]
    pub escrow: SystemAccount<'info>, /// CHECK: This is the correct escrow account for lobby
    // Auth config account
    #[account(
        seeds = [AUTH_SEED],
        bump,
        constraint = auth_config.backend_auth_wallet == backend_auth_wallet.key()
    )]
    pub auth_config: Account<'info, AuthConfig>,
    // The end game user, must be backend auth wallet
    #[account(mut)]
    pub backend_auth_wallet: Signer<'info>,
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