# C! (C-Bang) Language Design Document

**Date:** 2026-02-22
**Status:** Approved
**Authors:** Human-AI Collaborative Design

---

## Executive Summary

C! (pronounced "C-Bang") is the first programming language designed from the ground up for AI-human collaboration, where security is a structural guarantee — not a feature. It targets native binaries, WebAssembly, and blockchain bytecode from a single codebase, using a linear type system to eliminate entire vulnerability classes by construction.

---

## Core Philosophy

### Three Pillars

1. **Security by construction** — Entire categories of vulnerabilities are impossible, not just discouraged. The compiler proves your code is safe.
2. **AI-native semantics** — Code carries structured intent annotations that AI writes and reads natively. The compiler verifies implementation matches intent.
3. **Universal deployment** — One codebase compiles to native binaries, WebAssembly, and blockchain bytecode.

### What C! Eliminates (by design, not discipline)

| Vulnerability | How C! Prevents It |
|--------------|-------------------|
| Buffer overflow | Bounded arrays, no raw pointers |
| Use-after-free | Linear types — resources consumed on use |
| Double-spend | Linear tokens — can only be transferred once |
| Reentrancy attacks | Linear state in contracts — state locked during mutation |
| SQL injection | Typed query builders, no string interpolation in queries |
| XSS | Typed HTML templates, auto-escaping by construction |
| Data races | Actor model — no shared mutable state |
| Integer overflow | Checked arithmetic by default, bounded types |
| Null pointer | No null — `Option<T>` with exhaustive matching |
| Resource leaks | Linear types — compiler ensures all resources released |

---

## Execution Model

**Multi-target compilation:**
- Native binaries via LLVM
- WebAssembly for browsers and portable runtimes
- WASI for server-side portable execution
- EVM/blockchain bytecode for smart contracts

---

## Type System & Ownership

### Ownership Model (Linear/Affine Types)

```
// OWNED values — default
let token = Token::mint(100);
transfer(token, alice);           // ownership moves
// token is GONE — compile error to use it

// BORROWED references — temporary read access
fn display(user: &User) {
    print(user.name);
}

// SHARED immutable — multiple readers, no writers
let config = shared Config::load();

// UNIQUE mutable — exactly one writer
fn update(db: &mut Database) {
    db.insert(record);
}
```

### No Lifetime Annotations

Unlike Rust, C! infers lifetimes automatically. Where inference fails, explicit scoping is used:

```
fn complex() {
    scope data = load_data() {
        process(&data);
    }  // data released here
}
```

### Refined Types

```
type Port = u16{1..65535}
type Percentage = f64{0.0..=100.0}
type Username = String{len: 1..50, matches: r"^[a-zA-Z0-9_]+$"}
type NonEmpty<T> = Vec<T>{len: 1..}
```

### Algebraic Data Types

```
type Result<T, E> = Ok(T) | Err(E)
type Option<T> = Some(T) | None

type User {
    id: UUID,
    name: Username,
    email: Email,
    role: Admin | Editor | Viewer,
}
```

### Effect System

```
pure fn add(a: i32, b: i32) -> i32 { a + b }

fn save_user(user: User) -> Result<()> with IO, Database {
    db.insert(user)
}
```

---

## Concurrency: Actor Model

### First-Class Actors

```
actor Counter {
    state count: i64 = 0

    on Increment(by: i64) { count += by; }
    on GetCount() -> i64 { reply count; }
}
```

### Supervision Trees

```
actor Application {
    supervise WebServer { restart: .always, max_restarts: 5 per .minute }
    supervise DatabasePool { restart: .always, on_failure: .restart_all }
    supervise MetricsCollector { restart: .never }
}
```

### Structured Concurrency Within Actors

```
actor OrderProcessor {
    on ProcessOrder(order: own Order) -> Result<Receipt> {
        let (stock, payment) = parallel {
            inventory.ask(CheckStock(order.items)),
            payments.ask(Authorize(order.total))
        };
        // both complete or both cancel
    }
}
```

---

## Web Applications: Full-Stack Unified

### Shared Types

```
type User {
    id: UUID,
    name: String{len: 1..100},
    email: Email,
    role: Role,
}
```

### Backend (Native Server)

```
server App {
    bind: "0.0.0.0:8080"

    #[get("/users/:id")]
    #[auth(Role::Viewer)]
    fn get_user(id: UserId) -> Result<User, ApiError> with Database {
        db.find::<User>(id).ok_or(NotFound("User not found"))
    }
}
```

### Frontend (WASM Components)

```
component UserProfile(user: User) {
    style { .profile { padding: 2rem; } }

    <div class="profile">
        <h1>{user.name}</h1>
        <p>{user.email}</p>
    </div>
}
```

### Smart Contracts

```
contract CToken : ERC20 {
    state total_supply: u256
    state balances: Map<Address, u256>

    #[invariant(sum(balances.values()) == total_supply)]

    pub fn transfer(to: Address, amount: u256) -> Result<bool> {
        verify!(balances[caller] >= amount);
        balances[caller] -= amount;
        balances[to] += amount;
        emit Transfer(caller, to, amount);
        Ok(true)
    }
}
```

---

## AI-First Features

### Intent Annotations

```
#[intent("Authenticate user, returning JWT valid for 24h.
         Rate-limit 5 attempts/min/IP. Hash comparison only.")]
#[pre(googlesql_safe(email))]
#[post(result.is_ok() implies valid_jwt(result.unwrap()))]
fn login(email: Email, password: String) -> Result<JwtToken, AuthError> { ... }
```

### Compiler-Assisted AI Workflow

```
$ cbang check main.cb

✓ Type checking passed
✓ Ownership analysis passed
⚠ Intent mismatch on line 42:
  Intent says: "never store plaintext passwords"
  Code does:   password stored in user.log_entry
```

### Formal Verification

```
#[verify]
contract Vault {
    #[invariant(total_locked == sum(deposits.values()))]
    #[property(forall a: Address => withdraw(a, amt).is_ok() implies amt <= deposits[a])]
    ...
}
```

---

## Bootstrap Strategy: AI-Accelerated

1. **Phase 1:** TypeScript transpiler for rapid prototyping and playground
2. **Phase 2:** Self-hosted C! compiler targeting LLVM/WASM, written in C!
3. **Phase 3:** TS transpiler becomes the REPL/playground tool, real compiler takes over

---

## File Extension

`.cb` (C-Bang)

## CLI Tool

`cbang` — build, run, check, verify, audit

---

## Design Philosophy: Structure Over Compactness

AI agents write large applications — that's a reality we embrace. C! does not optimize for compact code. Instead, it uses the space to:

1. **Maximize structure** — intent annotations, effect declarations, and type constraints add lines but eliminate ambiguity
2. **Maximize reuse** — strong module system, shared types across the full stack, standard patterns
3. **Minimize drift** — shared types between frontend, backend, and contracts mean a change in one place propagates everywhere at compile time
4. **Enable AI collaboration** — structured metadata lets multiple AI agents understand and work on the same codebase without stepping on each other

The right measure of code quality is not "how short" but "how clearly structured, how reusable, and how resistant to drift."

---

## Open Source

- **Repository:** github.com/integsec/C-Bang
- **License:** Apache 2.0
- **Contributors:** Humans and AI agents equally welcome
