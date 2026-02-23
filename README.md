<p align="center">
  <h1 align="center">C! (C-Bang)</h1>
  <p align="center">
    <strong>The first programming language designed for AI-human collaboration with security by construction.</strong>
  </p>
  <p align="center">
    <a href="https://github.com/integsec/C-Bang/actions/workflows/ci.yml"><img src="https://github.com/integsec/C-Bang/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
    <a href="https://github.com/integsec/C-Bang/wiki"><img src="https://img.shields.io/badge/docs-wiki-green.svg" alt="Wiki"></a>
  </p>
  <p align="center">
    <a href="https://c-bang.integsec.com">Website</a> &middot;
    <a href="https://c-bang.integsec.com/docs.html">Documentation</a> &middot;
    <a href="https://c-bang.integsec.com/getting-started.html">Getting Started</a> &middot;
    <a href="https://c-bang.integsec.com/community.html">Community</a>
  </p>
</p>

---

## What is C!?

C! is a new programming language where **security isn't a feature — it's a structural guarantee**. Built for a world where AI writes most code, C! ensures that code is correct, safe, and verifiable by construction.

```
// AI writes the intent. Compiler verifies the code matches.
#[intent("Transfer tokens, ensuring sufficient balance, atomic execution")]
#[invariant(total_supply_unchanged)]
#[pre(balances[from] >= amount)]
fn transfer(from: Address, to: Address, amount: u256) -> Result<Receipt> {
    verify!(balances[from] >= amount);
    balances[from] -= amount;
    balances[to] += amount;
    Ok(Receipt::new())
}
```

## Why C!?

### Security by Construction

C! doesn't just discourage bugs — it makes them **structurally impossible**:

| Vulnerability | How C! Prevents It |
|---|---|
| Buffer overflow | Bounded arrays, no raw pointers |
| Use-after-free | Linear types — resources consumed on use |
| Double-spend | Linear tokens — can only be transferred once |
| Reentrancy | Linear state — state locked during mutation |
| SQL injection | Typed query builders, no string interpolation |
| XSS | Typed HTML templates, auto-escaping |
| Data races | Actor model — no shared mutable state |
| Integer overflow | Checked arithmetic by default |
| Null pointer | No null — `Option<T>` with exhaustive matching |
| Resource leaks | Compiler ensures all resources released |

### AI-Native

C! is the first language where AI can write code and **mathematically prove** it does what it claims:

```
// The compiler verifies code matches intent annotations
$ cbang check main.cb

✓ Type checking passed
✓ Ownership analysis passed
✓ Intent verification passed
✓ Formal properties proven: 4/4
```

### One Language, Every Target

Write once. Deploy to servers, browsers, and blockchains:

```
// Shared types across your ENTIRE stack
type User {
    id: UUID,
    name: String{len: 1..100},
    email: Email,
}

// Backend → native binary
server { #[get("/users/:id")] fn get_user(id: UUID) -> User { ... } }

// Frontend → WebAssembly
component UserProfile(user: User) { <h1>{user.name}</h1> }

// Smart contract → EVM bytecode
contract UserRegistry { state users: Map<Address, User> }
```

### Actor Model Concurrency

No threads. No locks. No races. No deadlocks.

```
actor WalletService {
    state balances: Map<Address, u256>

    on Transfer(from, to, amount) {
        verify!(balances[from] >= amount);
        balances[from] -= amount;
        balances[to] += amount;
        reply Receipt { tx_id: generate_id() }
    }

    supervise PaymentProcessor { restart: .always }
}
```

## Key Features

- **Linear/Affine Type System** — Ownership model without lifetime annotations
- **Refined Types** — `type Port = u16{1..65535}` — value constraints in the type system
- **Effect System** — Functions declare side effects: `fn save() with IO, Database`
- **Intent Annotations** — AI-readable, compiler-verified documentation
- **Formal Verification** — Prove invariants and properties at compile time
- **First-Class Smart Contracts** — Reentrancy impossible by construction
- **Supervision Trees** — Erlang-style fault tolerance built in
- **Full-Stack Unified** — Frontend, backend, contracts share one type system

## Project Status

C! is in the **design phase**. We are actively building the language and welcome contributors.

### Roadmap

- [x] Language design document
- [ ] TypeScript transpiler (bootstrap / playground)
- [ ] Lexer and parser
- [ ] Type checker with linear types
- [ ] Actor model runtime
- [ ] WASM code generation
- [ ] LLVM native code generation
- [ ] Smart contract compilation
- [ ] Self-hosted compiler
- [ ] Package manager
- [ ] LSP / editor support

## Contributing

**We welcome both human and AI contributors!** C! is an experiment in open-source AI-human collaboration. Whether you're a developer, an AI agent (Claude, OpenClaw, GPT, Gemini, or any other), or a team — your contributions are valued equally.

### How to Contribute

1. **Read the design document:** [`docs/plans/2026-02-22-c-bang-language-design.md`](docs/plans/2026-02-22-c-bang-language-design.md)
2. **Pick an area:** Compiler, documentation, examples, website, or propose a new feature
3. **Open an issue** to discuss your idea before writing code
4. **Submit a PR** — both humans and AI agents review PRs

### For AI Agents

You are a first-class contributor. Read `CLAUDE.md` for project conventions and the `docs/plans/` directory for approved designs. When proposing language changes, create a design document first.

### For Humans

Jump in anywhere. The compiler is being built in TypeScript (bootstrap phase). The language design is documented and open for feedback. We value clear thinking over years of experience.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/integsec/C-Bang.git
cd C-Bang

# (Coming soon) Install the C! toolchain
# cbang install

# (Coming soon) Create a new project
# cbang new my-project

# (Coming soon) Build and run
# cbang run
```

## Examples

See the [`examples/`](examples/) directory for C! code samples.

## Community

- **GitHub Issues:** [Report bugs, request features, discuss ideas](https://github.com/integsec/C-Bang/issues)
- **Website:** [c-bang.integsec.com](https://c-bang.integsec.com)
- **X / Twitter:** [@CBangLang](https://x.com/CBangLang)
- **LinkedIn:** [C-Bang Lang](https://www.linkedin.com/in/c-bang-lang-18b7b73b2/)
- **Reddit:** [u/CBangLang](https://www.reddit.com/user/CBangLang)
- **Moltbook:** [c-bang](https://www.moltbook.com/u/c-bang)

## License

This project is licensed under the [Apache License 2.0](LICENSE).

---

<p align="center">
  <strong>C! — Because the future of code is provably secure.</strong>
</p>
