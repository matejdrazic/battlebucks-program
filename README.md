# BattleBucks: Solana Escrow Program

### Overview

BattleBucks is a Solana program built with Anchor that provides escrow functionality for gaming lobbies and escrow. Players can join lobbies by contributing SOL, and funds are securely held in escrow until the game concludes. At the end, a configurable rake is sent to a house wallet, and the remaining amount is distributed to a recipient wallet specified by the backend wallet.

## ⚙️ Local Development Configuration

Use the following versions for compatibility:

- `rustc 1.79.0 (129f3b996 2024-06-10)`
- `cargo 1.79.0 (ffa9cf99a 2024-06-03)`
- `solana-cli 1.18.10 (src:50b3f337; feat:3469865029, client:SolanaLabs)`
- `solana-cargo-build-sbf 1.18.10`
- `platform-tools v1.41`
- `anchor-cli 0.29.0`
- `node v20.10.0`
- `yarn 1.22.22`

---

## 🚀 Deployment Guide (Local Devnet)

### 1. Install Required Tools

- Rust: [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install)  
- Solana CLI: [https://docs.solana.com/cli/install-solana-cli-tools](https://docs.solana.com/cli/install-solana-cli-tools)  
- Anchor CLI: [https://www.anchor-lang.com/docs/installation](https://www.anchor-lang.com/docs/installation)  
- Node & Yarn: [https://nodejs.org/](https://nodejs.org/) and [https://classic.yarnpkg.com/en/docs/install](https://classic.yarnpkg.com/en/docs/install)

### 2. Start Local Validator

Run this in a dedicated terminal:  
`solana-test-validator`

### 3. Configure Solana CLI

Set the localnet endpoint and keypair:  
`solana config set --url http://127.0.0.1:8899`  
`solana config set --keypair ~/.config/solana/id.json`

### 4. Build the Program

Compile your Anchor program:  
`anchor build`

### 5. Deploy the Program

Deploy it to the local validator:  
`anchor deploy`

---

### Deployment Guide (Devnet)

Follow steps found here:  

https://www.anchor-lang.com/docs/quickstart/local


---

## 🧪 Running Anchor Tests

Tests are written in TypeScript and located in the `tests/` folder.

### 1. Install JavaScript Dependencies

Run from the root of the project:  
`yarn install`

### 2. Execute Tests

Run the full suite:  
`anchor test`

This automatically:

- Starts the local validator
- Deploys the program
- Executes test scripts in `tests/`
- Exists the local validator

---

## 🛠️ Functions

### `initialize(admin: Pubkey, backend_auth_wallet: Pubkey, house_wallet: Pubkey, rake_percentage: u8)`

Initializes global state and authorization config.

**Context:** `Initialize`

- `auth_config`: (init) Stores admin, backend, house wallet  
- `global_state`: (init) Stores rake percentage  
- `deployer`: Admin wallet (payer)  
- `system_program`: Required for account creation

---

### `create_lobby(lobby_id: String, buy_in_amount: u64, max_players_in_lobby: Option<u8>)`

Creates a new lobby. Only callable by the backend authorization wallet.

**Context:** `CreateLobby`

- `lobby`: (init) The new lobby PDA  
- `backend_auth_wallet`: Must match `auth_config.backend_auth_wallet`  
- `global_state`: For fetching default rake  
- `auth_config`: Contains backend auth pubkey  
- `system_program`: Required

---

### `join_lobby(lobby_id: String)`

Allows a player to join a lobby by paying the exact buy-in amount.

**Context:** `JoinLobby`

- `player`: (init) PDA tracking the player's participation  
- `escrow`: PDA holding lobby funds  
- `lobby`: Must be in `NotStarted` state  
- `player_wallet`: The joining player  
- `system_program`: Required

---

### `refund(lobby_id: String)`

Lets a player leave a lobby and get a full refund. Only works if the game hasn't started.

**Context:** `LeaveLobby`

- `player`: (mut, close) The player PDA to be closed  
- `lobby`: Must be in `NotStarted` state  
- `escrow`: PDA holding funds  
- `system_program`: Required  
- `player_wallet`: The player requesting a refund

---

### `start_game(lobby_id: String)`

Marks a lobby as "in progress". Prevents further joins or refunds.

**Context:** `StartGame`

- `lobby`: Must be in `NotStarted` state  
- `auth_config`: Verifies backend auth wallet  
- `backend_auth_wallet`: Must match `auth_config.backend_auth_wallet`  
- `system_program`: Required

---

### `end_game(lobby_id: String)`

Ends the game, calculates and transfers rake and remaining funds.

**Context:** `EndGame`

- `lobby`: Must be in `InProgress` state  
- `escrow`: Holds lobby funds  
- `auth_config`: Verifies backend and house wallet  
- `house_wallet`: Gets the rake  
- `recipient_wallet`: Gets remaining funds  
- `backend_auth_wallet`: Must match `auth_config.backend_auth_wallet`  
- `system_program`: Required

---

### `update_rake(lobby_id: String, new_rake_percentage: u8)`

Updates the rake percentage for a lobby before the game ends.

**Context:** `UpdateRake`

- `lobby`: Must not be in `Ended` state  
- `auth_config`: Verifies backend auth  
- `global_state`: Stores global rake  
- `backend_auth_wallet`: Must match `auth_config.backend_auth_wallet`  
- `system_program`: Required

---

### `update_auth_config(admin: Pubkey, backend_auth_wallet: Pubkey, house_wallet: Pubkey)`

Updates the backend and house wallet settings.

**Context:** `UpdateAuthConfig`

- `auth_config`: Must match `admin` for mutation  
- `admin`: Signer (must match `auth_config.admin`)  
- `system_program`: Required

---

## 🔄 Interactions

Interaction with program and functions can best be understood by checking out the tests file: `tests/battlebucks.ts`

---

## 🧩 Account Structure (PDAs) - i.e. Storage model

| Account           | Description                                          |
|------------------|------------------------------------------------------|
| `Lobby`          | Stores lobby ID, buy-in, rake %, game state, players |
| `PlayerInLobby`  | Tracks player’s lobby participation                  |
| `AuthConfig`     | Stores admin, backend, and house wallet pubkeys     |
| `GlobalState`    | Stores default rake percentage                       |
| `Escrow`         | Holds funds for each lobby                           |

---
