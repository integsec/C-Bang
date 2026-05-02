# Changelog

All notable changes to the C! project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-05-02

### Compiler

- Recursive descent parser with full C! grammar (75 tests passing)
- Lexer with complete token set (33 tests passing)
- Type checker with declaration and body passes
- Linear/affine ownership checker — use-after-free and double-spend impossible by construction
- Effect system checker with CLI integration
- Intent annotation verifier — compiler validates code matches declared intent
- Contextual type inference for numeric literals
- JavaScript code generation for actors, contracts, servers, and components
- Actor model runtime for the JS target
- WASM binary code generation with WASI support
- LLVM IR generator (variables, arithmetic, structs, enums, closures, f64, arrays, actors, for loops)
- EVM bytecode generator (function dispatch, storage, control flow, events, arithmetic)
- NEAR WASM generator (storage, events, cross-contract calls)
- Multi-target CLI: `cbang build --target llvm|evm|near|wasm|js`
- Multi-file `use`/import support with bundler
- Game engine macro system (input, audio, sprites, scenes, networking) via registry pattern
- Standard library foundation: `io`, `math`, `collections`, `string` modules
- Improved error messages with source context and caret indicators
- `cbang run` end-to-end execution for demo programs
- `cbang audit` — pattern-based security vulnerability scanner with SARIF and JSON output

### Tooling

- VS Code extension with syntax highlighting, 30+ snippets, problem matcher, file icon, and task definitions
- Browser-based C! playground with live compilation and canvas graphics API
- Interactive examples: chat app, token contract, 3D cube, Mandelbrot fractal, spirograph, wave visualiser, mini-game
- `cbang repl` interactive session

### Project

- Complete language design document (`docs/plans/2026-02-22-c-bang-language-design.md`)
- Project website at [c-bang.integsec.com](https://c-bang.integsec.com) with SEO, sitemap, and structured data
- GitHub Wiki with 13 documentation pages
- 5 demo applications: hello-world, todo-app, token-contract, chat-actors, fullstack-app
- `llms.txt` and `llms-full.txt` for AI discovery
- CLAUDE.md for AI contributor guidelines
- Contributing guide welcoming both human and AI contributors
- GitHub issue and PR templates
- 15 seed issues for contributors to pick up

### Design Decisions

- Linear/affine type system — no lifetime annotations required
- Actor model concurrency with supervision trees
- Multi-target compilation: native (LLVM) + WebAssembly + EVM + NEAR
- Intent annotations verified at compile time
- Full-stack unified: backend, frontend WASM, smart contracts in one language
- TypeScript bootstrap compiler, self-hosting roadmap in place
- Apache 2.0 license
