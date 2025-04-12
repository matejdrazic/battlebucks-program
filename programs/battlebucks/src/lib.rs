use anchor_lang::prelude::*;

declare_id!("215rECMPco6vSdPqnw5yS6F4FPsqpc3vWkJRkesUTRoP");

#[program]
pub mod battlebucks {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
