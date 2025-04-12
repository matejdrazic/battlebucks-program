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

    pub fn create_lobby(_ctx: Context<Lobby>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Lobby {}
