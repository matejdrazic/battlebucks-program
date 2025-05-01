use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};


// Imports
mod constants;
mod errors;
use crate::constants::*;
use crate::errors::*;

pub const DEFAULT_MAX_PLAYERS: u8 = 128;
pub const LOBBY_ID_STRING_MAX_LENGTH: usize = 64;

declare_id!("86KjaJP57GJPzh9WBLkLvXtY7ah1DtpNbbEY5AjNhwVW");


#[program]
pub mod battlebucks {
    use super::*;

    // Function to init program and setup Auth config
    pub fn initialize(ctx: Context<Initialize>, admin: Pubkey, backend_auth_wallet: Pubkey, house_wallet: Pubkey, rake_percentage: u8) -> Result<()> {
        
        // Initialize the AuthConfig account by setting admin wallet and backend auth wallet
        let auth_config = &mut ctx.accounts.auth_config;
        auth_config.admin = admin;
        auth_config.backend_auth_wallet = backend_auth_wallet;
        auth_config.house_wallet = house_wallet; // Used for rake transfer

        // Set the rake percentage in the GlobalState account
        let global_state = &mut ctx.accounts.global_state;
        global_state.rake_percentage = rake_percentage;

        Ok(())
    }

    // Function to 'create' a new game lobby account
    pub fn create_lobby(ctx: Context<CreateLobby>, lobby_id: String, buy_in_amount: u64, max_players_in_lobby: Option<u8>) -> Result<()> {
        
        // Initialize the lobby account
        let lobby = &mut ctx.accounts.lobby; 

        // Require that the lobby ID is shorter than the max length
        require!(
            lobby_id.len() <= LOBBY_ID_STRING_MAX_LENGTH,
            CustomError::LobbyIdTooLong
        );

        lobby.lobby_id = lobby_id;
        lobby.buy_in_amount = buy_in_amount;
        lobby.max_players_in_lobby = max_players_in_lobby;
        lobby.current_players_in_lobby = 0;
        lobby.game_state = GameState::NotStarted; // Set initial game state
        lobby.player_pdas = Vec::new(); // Initialize empty vector for player PDAs
        
        // Fetch rake percentage from global state and save in lobby account
        let global_state = &ctx.accounts.global_state;
        lobby.rake_percentage = global_state.rake_percentage;
        
        Ok(())
    }

    // Function invoked by player to join a specific lobby
    pub fn join_lobby(ctx: Context<JoinLobby>, lobby_id: String) -> Result<()> {

        // Get player PDA and lobby PDA
        let player = &mut ctx.accounts.player;
        let lobby = &mut ctx.accounts.lobby;

        // Check restriction if set in max_players_in_lobby - is lobby full?
        if let Some(max) = lobby.max_players_in_lobby {
            require!(
                lobby.current_players_in_lobby < max,
                CustomError::LobbyFull
            )
        }


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
    pub fn refund(ctx: Context<LeaveLobby>, lobby_id: String) -> Result<()> {

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

        let seed = lobby_id.as_bytes();
        let bump_seed = ctx.bumps.escrow;
        let signer_seeds: &[&[&[u8]]] = &[&[ESCROW_SEED, seed, &[bump_seed]]];

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
    pub fn start_game(ctx: Context<StartGame>, _lobby_id: String) -> Result<()> {

        // Get the lobby PDA
        let lobby = &mut ctx.accounts.lobby;

        // Set the game state to InProgress
        lobby.game_state = GameState::InProgress;

        Ok(())
    }

    // Function to end the game
    pub fn end_game(ctx: Context<EndGame>, lobby_id: String) -> Result<()> {

        // Get the lobby PDA
        let lobby = &mut ctx.accounts.lobby;
        // Get the escrow account
        let escrow = &mut ctx.accounts.escrow;
        // Get house wallet account
        let house_wallet = &mut ctx.accounts.house_wallet;
        // Get the backend provided recipient wallet
        let recipient_wallet = &mut ctx.accounts.recipient_wallet;

        // Get the escrow account balance
        let escrow_balance = escrow.to_account_info().lamports();
        msg!("Escrow balance: {}", escrow_balance);

        // Calculate rake amount
        let rake_amount = (escrow_balance * lobby.rake_percentage as u64) / 100;
        msg!("Rake amount: {}", rake_amount);

        // Calculate remaining amount after rake
        let remaining_amount = escrow_balance - rake_amount;
        msg!("Remaining amount: {}", remaining_amount);

        // Transfer rake amount to house wallet
        let from_pubkey = escrow.to_account_info();
        let to_pubkey = house_wallet.to_account_info();
        let program_id = ctx.accounts.system_program.to_account_info();

        let seed = lobby_id.as_bytes();
        let bump_seed = ctx.bumps.escrow;
        let signer_seeds: &[&[&[u8]]] = &[&[ESCROW_SEED, seed, &[bump_seed]]];

        let cpi_context = CpiContext::new(
            program_id,
            Transfer {
                from: from_pubkey,
                to: to_pubkey,
            },
        ).with_signer(signer_seeds);

        transfer(cpi_context, rake_amount)?;


        // Transfer remaining amount to context provided recipient wallet
        let from_pubkey = escrow.to_account_info();
        let to_pubkey = recipient_wallet.to_account_info();
        let program_id = ctx.accounts.system_program.to_account_info();

        let cpi_context = CpiContext::new(
            program_id,
            Transfer {
                from: from_pubkey,
                to: to_pubkey,
            },
        ).with_signer(signer_seeds);
        transfer(cpi_context, remaining_amount)?;


        // Set the game state to Ended
        lobby.game_state = GameState::Ended;

        let escrow_balance = escrow.to_account_info().lamports();
        msg!("Escrow balance: {}", escrow_balance);

        Ok(())
    }

    // Function to update rake
    pub fn update_rake(ctx: Context<UpdateRake>, _lobby_id: String, new_rake_percentage: u8) -> Result<()> {

        // Get the lobby PDA
        let lobby = &mut ctx.accounts.lobby;
        // Get the global state account
        let global_state = &mut ctx.accounts.global_state;

        // Update the rake percentage in the global state account
        global_state.rake_percentage = new_rake_percentage;
        // Update the rake percentage in the lobby account
        lobby.rake_percentage = new_rake_percentage;

        Ok(())
    }

    // Function to update auth config
    pub fn update_auth_config(ctx: Context<UpdateAuthConfig>, admin: Pubkey, backend_auth_wallet: Pubkey, house_wallet: Pubkey) -> Result<()> {

        // Get the auth config account
        let auth_config = &mut ctx.accounts.auth_config;
        // Update the auth config account
        auth_config.admin = admin;
        auth_config.backend_auth_wallet = backend_auth_wallet;
        auth_config.house_wallet = house_wallet;

        Ok(())
    }
}

/// CONTEXTS
#[derive(Accounts)]
#[instruction(admin: Pubkey, backend_auth_wallet: Pubkey, house_wallet: Pubkey, rake_percentage: u8)]
pub struct Initialize<'info> {
    #[account(init, payer = deployer, space = 8 + 32 + 32 + 32, seeds = [AUTH_SEED], bump)]
    pub auth_config: Account<'info, AuthConfig>,
    // The global state account is initialized
    #[account(
        init, 
        payer = deployer, 
        space = 8 + 1, 
        seeds = [GLOBAL_STATE_SEED], 
        bump,
        constraint = rake_percentage <= 100,
    )]
    pub global_state: Account<'info, GlobalState>,
    /// The admin wallet that will be authorized to create lobbies
    #[account(mut)]
    pub deployer: Signer<'info>,
    /// The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(lobby_id: String, buy_in_amount: u64, max_players_in_lobby: Option<u8>)]
pub struct CreateLobby<'info> { // CHECK: Hardcoded 10 as max players (stress test later)
    #[account(init, payer = backend_auth_wallet, space = 8 + 4 + LOBBY_ID_STRING_MAX_LENGTH + 8 + 2 + 1 + 1 + 1 + 4 + 32 * max_players_in_lobby.unwrap_or(DEFAULT_MAX_PLAYERS) as usize, seeds = [LOBBY_SEED, lobby_id.as_bytes()], bump)]
    pub lobby: Account<'info, Lobby>,
    // The wallet who is responsible for creating the lobby
    #[account(mut)]
    pub backend_auth_wallet: Signer<'info>,
    // Global state account
    #[account(
        seeds = [GLOBAL_STATE_SEED],
        bump,
    )]
    pub global_state: Account<'info, GlobalState>,
    /// Auth config that stores the expected backend wallet pubkey
    #[account(
        seeds = [AUTH_SEED],
        bump,
        has_one = backend_auth_wallet,
    )]
    pub auth_config: Account<'info, AuthConfig>,
    /// The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(lobby_id: String)]
pub struct JoinLobby<'info> {
    // Initializes the player in lobby PDA
    #[account(init, payer = player_wallet, space = 8 + 4 + LOBBY_ID_STRING_MAX_LENGTH + 32 + 32, seeds = [PLAYER_SEED, lobby_id.as_bytes(), player_wallet.key().as_ref()], bump)]
    pub player: Account<'info, PlayerInLobby>,
    // The escrow account that will hold the buy-in amount
    #[account(mut, seeds = [ESCROW_SEED, lobby_id.as_bytes()], bump)]
    pub escrow: SystemAccount<'info>,
    // Player wallet who is joining the lobby
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.as_bytes()],
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
#[instruction(lobby_id: String)]
pub struct LeaveLobby <'info> {
    // The player PDA that will be closed
    #[account(
        mut, 
        close = player_wallet, 
        seeds = [PLAYER_SEED, lobby_id.as_bytes(), player_wallet.key().as_ref()], 
        bump,
    )]
    pub player: Account<'info, PlayerInLobby>,
    // The lobby PDA
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.as_bytes()],
        bump,
        constraint = lobby.game_state == GameState::NotStarted,
    )]
    pub lobby: Account<'info, Lobby>,
    // The escrow account that will be closed
    #[account(mut, seeds = [ESCROW_SEED, lobby_id.as_bytes()], bump)]
    pub escrow: SystemAccount<'info>, /// CHECK: This is the correct escrow account for lobby
    // The system program
    pub system_program: Program<'info, System>,
    // Player wallet who is leaving the lobby
    #[account(mut)]
    pub player_wallet: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(lobby_id: String)]
pub struct StartGame<'info> {
    // The lobby PDA
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.as_bytes()],
        bump,
        constraint = lobby.game_state == GameState::NotStarted,
    )]
    pub lobby: Account<'info, Lobby>,
    // Auth config account
    #[account(
        seeds = [AUTH_SEED],
        bump,
        has_one = backend_auth_wallet,
    )]
    pub auth_config: Account<'info, AuthConfig>,
    // The start game user, must be backend auth wallet
    pub backend_auth_wallet: Signer<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(lobby_id: String)]
pub struct EndGame<'info> {
    // The lobby PDA
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.as_bytes()],
        bump,
        constraint = lobby.game_state == GameState::InProgress,
    )]
    pub lobby: Account<'info, Lobby>,
    // Escrow account that will be closed
    #[account(
        mut, 
        seeds = [ESCROW_SEED, lobby_id.as_bytes()], 
        bump,
    )]
    pub escrow: SystemAccount<'info>, /// CHECK: This is the correct escrow account for lobby
    // Auth config account
    #[account(
        seeds = [AUTH_SEED],
        bump,
        has_one = backend_auth_wallet,
        has_one = house_wallet,
    )]
    pub auth_config: Account<'info, AuthConfig>,
    // House wallet account for rake receiving
    #[account(mut)]
    pub house_wallet: SystemAccount<'info>,
    // Recipient wallet of the remainder funds after rake transfer
    #[account(mut)]
    pub recipient_wallet: SystemAccount<'info>,
    // The end game user, must be backend auth wallet
    #[account(mut)]
    pub backend_auth_wallet: Signer<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(lobby_id: String, new_rake_percentage: u8)]
pub struct UpdateRake <'info> {
    // The lobby PDA
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.as_bytes()],
        bump,
        constraint = lobby.game_state != GameState::Ended,
    )]
    pub lobby: Account<'info, Lobby>,
    // The auth config acccount
    #[account(
        seeds = [AUTH_SEED],
        bump,
        has_one = backend_auth_wallet,
    )]
    pub auth_config: Account<'info, AuthConfig>,
    // The global state account
    #[account(
        mut,
        seeds = [GLOBAL_STATE_SEED],
        bump,
        constraint = new_rake_percentage <= 100,
    )]
    pub global_state: Account<'info, GlobalState>,
    // The update rake user, must be backend auth wallet
    pub backend_auth_wallet: Signer<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(admin: Pubkey)]
pub struct UpdateAuthConfig <'info> {
    // The auth config account
    #[account(
        mut,
        seeds = [AUTH_SEED],
        bump,
        has_one = admin,
    )]
    pub auth_config: Account<'info, AuthConfig>,
    // The update auth config user, must be admin wallet
    pub admin: Signer<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}


/// PDAs
#[account]
pub struct Lobby {
    pub lobby_id: String,
    pub buy_in_amount: u64,
    pub rake_percentage: u8,
    pub max_players_in_lobby: Option<u8>, // optional constraint
    pub current_players_in_lobby: u8,
    pub game_state: GameState,
    pub player_pdas: Vec<Pubkey>, // PDAs of players in the lobby
}

#[account]
pub struct PlayerInLobby {
    pub lobby_id: String,
    pub lobby_pda: Pubkey, // PDA of the lobby the player is in
    pub player_pubkey: Pubkey
}

#[account]
pub struct AuthConfig {
    pub admin: Pubkey, // Admin wallet
    pub backend_auth_wallet: Pubkey, // Backend wallet authorized for lobby creation
    pub house_wallet: Pubkey, // House wallet for rake
}

#[account]
pub struct GlobalState {
    pub rake_percentage: u8, // 0 <= rake_percentage <= 100
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameState {
    NotStarted,
    InProgress,
    Ended,
}