# C! Module System Specification

## Overview

C!'s module system is designed to maximize reuse, minimize drift, and enable AI agents to navigate large codebases structurally.

## Modules

Every `.cb` file is a module. Directories with a `mod.cb` file are module groups.

```
my-project/
├── src/
│   ├── main.cb              # root module
│   ├── auth/
│   │   ├── mod.cb           # auth module group
│   │   ├── login.cb         # auth::login
│   │   ├── register.cb      # auth::register
│   │   └── types.cb         # auth::types
│   ├── models/
│   │   ├── mod.cb           # models module group
│   │   ├── user.cb          # models::user
│   │   └── post.cb          # models::post
│   └── shared/
│       ├── mod.cb           # shared module group
│       └── types.cb         # shared::types
```

## Imports

```
// Import a specific item
use auth::login::authenticate;

// Import multiple items
use models::user::{User, UserRole, CreateUser};

// Import entire module
use shared::types::*;

// Aliased import
use crypto::hash::sha256 as hash;
```

## Visibility

```
// Private (default) — only accessible within this module
fn helper() { ... }

// Public — accessible from other modules
pub fn authenticate(email: Email, password: String) -> Result<User> { ... }

// Package-public — accessible within this package but not external consumers
pub(pkg) fn internal_validate(input: String) -> bool { ... }
```

## Module Metadata

Every module can declare metadata that AI agents use for navigation:

```
module auth {
    @purpose("User authentication and authorization")
    @security_level(critical)
    @owner("auth-team")
    @dependencies(crypto, database, models::user)
    @version("1.2.0")

    // ... module contents
}
```

This enables queries like:
- "Show me all critical security modules"
- "What depends on the auth module?"
- "Who owns the payments code?"

## Shared Type Patterns

C! encourages defining shared types in dedicated modules:

```
// shared/types.cb — used by backend, frontend, AND contracts
pub type UserId = UUID
pub type Email = String{matches: r"^[^@]+@[^@]+\.[^@]+$"}

pub type User {
    id: UserId,
    name: String{len: 1..100},
    email: Email,
    role: Admin | Editor | Viewer,
}
```

The compiler enforces that shared types remain consistent:

```
// If you change User in shared/types.cb:
// - Backend route handlers: compile error if they don't handle new fields
// - Frontend components: compile error if they reference removed fields
// - Smart contracts: compile error if storage layout is incompatible
// ZERO DRIFT by construction
```

## Package System

A `cbang.toml` file defines a package:

```toml
[package]
name = "my-app"
version = "0.1.0"
edition = "2026"

[dependencies]
http = "1.0"
crypto = "2.3"
erc20 = "1.0"

[targets]
backend = { type = "native", entry = "src/server.cb" }
frontend = { type = "wasm", entry = "src/app.cb" }
contract = { type = "evm", entry = "src/contract.cb" }
```

## Anti-Drift Guarantees

The module system provides these guarantees against code drift:

1. **Type consistency** — shared types compile-checked across all targets
2. **Interface contracts** — public module interfaces are versioned
3. **Dependency tracking** — the compiler knows every inter-module dependency
4. **Breaking change detection** — changing a public API shows all affected callers
5. **Unused code detection** — unreachable modules flagged at compile time
