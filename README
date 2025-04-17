# BattleBucks: Solana Escrow Program

## Overview

BattleBucks is a Solana program built with Anchor that provides escrow functionality for gaming lobbies and escrow. Players can join lobbies by contributing SOL, and funds are securely held in escrow until the game concludes. At the end, a configurable rake is sent to a house wallet, and the remaining amount is distributed to a recipient wallet specified by the backend wallet.

---

## Functions

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

## Account Structure

| Account            | Description |
|--------------------|-------------|
| `Lobby`            | Stores lobby ID, buy-in, rake %, game state, player list |
| `PlayerInLobby`    | Tracks player’s lobby participation |
| `AuthConfig`       | Stores admin, backend, and house wallet pubkeys |
| `GlobalState`      | Stores default rake percentage |
| `Escrow` (System)  | Holds funds for each lobby (PDA) |

---
