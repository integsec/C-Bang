# C! (C-Bang) for Visual Studio Code

Syntax highlighting and language support for [C! (C-Bang)](https://c-bang.integsec.com), the programming language designed for AI-human collaboration with security by construction.

## Features

- Full syntax highlighting for `.cb` files
- Support for all C! language constructs including actors, contracts, components, servers, and more
- Intent annotation highlighting (`#[intent(...)]`, `#[verify(...)]`, `#[pre(...)]`, `#[post(...)]`)
- String interpolation support
- Comment toggling, bracket matching, and code folding
- Refined type constraint highlighting

## What is C!?

C! is the first programming language designed from the ground up for AI-human collaboration, where security is a structural guarantee. It features:

- **Linear/affine types** for ownership without lifetime annotations
- **Actor model** concurrency with supervision trees
- **Multi-target compilation** to native binaries, WebAssembly, and blockchain bytecode
- **Intent annotations** verified by the compiler
- **Full-stack unified** development (backend, frontend WASM, smart contracts)

## Example

```cbang
#[intent("Transfer tokens from caller to recipient")]
#[pre(balances[caller] >= amount)]
pub fn transfer(to: Address, amount: u256) -> Result<bool> {
    verify!(to != Address::zero(), "Cannot transfer to zero address");

    balances[caller] -= amount;
    balances[to] += amount;

    emit Transfer(caller, to, amount);
    Ok(true)
}
```

## File Extension

C! source files use the `.cb` extension.

## Links

- [C! Website](https://c-bang.integsec.com)
- [GitHub Repository](https://github.com/integsec/C-Bang)
- [Language Design Document](https://github.com/integsec/C-Bang/blob/main/docs/plans/2026-02-22-c-bang-language-design.md)

## License

Apache 2.0
