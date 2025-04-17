use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("The lobby is full.")]
    LobbyFull,
    #[msg("Lobby ID too long.")]
    LobbyIdTooLong,
}