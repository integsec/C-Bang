# Complete All Compiler Backends — Design Document

**Date:** 2026-03-10
**Status:** Approved

## Goal

Complete all four codegen backends (WASM, LLVM IR, EVM, NEAR WASM) with full C! feature support, bringing the compiler from a JS-only output to true multi-target compilation.

## Architecture

Four codegen backends, each a single TypeScript file in `compiler/src/codegen/` that walks the AST and emits target-specific output:

```
compiler/src/codegen/
├── jsgen.ts          # ✅ Complete (926 lines, 74+ tests)
├── wasmgen.ts        # 🔧 Exists, needs completion (755 lines, 30 tests)
├── llvmgen.ts        # 🆕 New — emits LLVM IR text (.ll)
├── evmgen.ts         # 🆕 New — emits EVM bytecode (hex)
└── neargen.ts        # 🆕 New — extends WASM output with NEAR SDK bindings
```

No shared codegen base class — each target is different enough that abstraction would hurt more than help. They all implement the same contract: take a `Program` AST node, return a string of generated code.

**CLI integration:** `cbang build --target <js|wasm|llvm|evm|near>` dispatches to the right codegen. Existing `cbang run` continues to use JS.

**Implementation order:** WASM → LLVM IR → EVM → NEAR WASM (sequential deepening — each completed backend informs the next).

## Backend 1: WASM Codegen Completion

**Current state:** 755 lines, handles basic arithmetic, control flow, functions, i32 operations.

**Additions:**

- **Match expressions** — `br_table` for integer cases, chained `if/else` for enum variant destructuring
- **Closures** — Capture variables into linear memory struct, pass function index + environment pointer pair
- **String support** — Linear memory with length prefix. String operations become memory manipulation + imported JS/WASI functions for I/O
- **Floating-point** — `f64` operations plumbed through type info. WASM has native f64 support
- **Structs/Enums** — Sequential field layout in linear memory. Enums get tag byte + variant payload
- **Actors** — Separate WASM modules. `spawn` instantiates a module, `emit` posts to message queue via host imports
- **String interpolation** — Desugar to string concatenation (memory alloc + copy sequences)
- **For loops / Range** — Desugar `for x in range(a, b)` to while loop with counter local
- **Arrays** — Linear memory allocation with length prefix, bounds checking via `if` guards
- **Print** — Import `fd_write` from WASI for stdout output

## Backend 2: LLVM IR Codegen

**New file:** `compiler/src/codegen/llvmgen.ts`

**Output:** Text-based LLVM IR (`.ll` files). Users run `lli` to interpret or `llc` + `clang` to compile to native binary.

**Key mappings:**

| C! Feature | LLVM IR |
|---|---|
| Functions | `define` blocks with typed params, `ret` |
| Variables (immutable) | SSA registers |
| Variables (mutable) | `alloca` + `store`/`load` |
| Int / Float / Bool | `i64` / `double` / `i1` |
| String | `i8*` pointer |
| If/else | Labeled basic blocks with `br` |
| While/for | Loop blocks with `br` back-edges |
| Match | `switch` instruction / chained `icmp`+`br` |
| Structs | LLVM struct types |
| Enums | Tagged unions (i32 tag + payload) |
| Closures | Function pointer + environment struct |
| Strings | Global constants for literals, `malloc` for dynamic |
| Actors | pthreads, mutex-protected mailbox |
| Print | `@printf` extern |

**Runtime:** A small `runtime.ll` or `runtime.c` providing GC stubs, actor mailbox, and string helpers. Linked at compile time.

## Backend 3: EVM Codegen

**New file:** `compiler/src/codegen/evmgen.ts`

**Output:** EVM bytecode as hex string + ABI JSON. Only compiles `contract` blocks — non-contract code errors with "use a different target."

**Key mappings:**

| C! Feature | EVM |
|---|---|
| Contract blocks | Constructor + runtime bytecode |
| Functions | Function selector (keccak256 hash), ABI dispatch via `CALLDATALOAD` |
| State variables | Storage slots (`SSTORE`/`SLOAD`), sequential assignment |
| Basic types | 256-bit stack words |
| If/else | `JUMPI` + `JUMPDEST` |
| While loops | `JUMPDEST` top, `JUMPI` condition, `JUMP` back |
| Match | Chained `DUP`+`EQ`+`JUMPI` |
| Internal calls | `JUMP`/`JUMPDEST` |
| External calls | `CALL` opcode |
| Events (emit) | `LOG0`-`LOG4` with topic hashing |
| Deploy | Constructor copies runtime bytecode to chain |

**Not applicable:** Closures, actors — compiler errors if used in contract context.

**ABI generation:** JSON ABI file alongside bytecode describing public functions, inputs, outputs, events.

## Backend 4: NEAR WASM Codegen

**New file:** `compiler/src/codegen/neargen.ts`

**Approach:** Extends WASM codegen. Imports core generation logic from `wasmgen.ts` and wraps with NEAR-specific bindings.

**Differences from plain WASM:**

| Feature | NEAR Behavior |
|---|---|
| Contract blocks | Exported functions with NEAR naming |
| State variables | `storage_write`/`storage_read` host imports |
| Deploy | `promise_batch_create` + deploy action |
| Emit | `log_utf8` host import (JSON events) |
| Cross-contract calls | `promise_create` + `promise_then` |
| Serialization | JSON for args/returns |
| Actors | Not applicable — maps to cross-contract calls |

**Host imports:** NEAR `env` namespace: `input`, `storage_write`, `storage_read`, `value_return`, `log_utf8`, `promise_create`, etc.

## Testing Strategy

**Per-backend test files** following existing `jsgen.test.ts` pattern:

- `compiler/tests/wasmgen.test.ts` — extend existing (30 → ~80+ tests)
- `compiler/tests/llvmgen.test.ts` — new (~80+ tests)
- `compiler/tests/evmgen.test.ts` — new (~40+ tests)
- `compiler/tests/neargen.test.ts` — new (~40+ tests)

**Test pattern:** Compile C! snippet through full pipeline (lex → parse → check → codegen), assert output contains expected target-specific code. No execution — string matching on generated output.

**Feature coverage per backend:**
- Functions, variables, basic types, control flow, structs/enums, print, string interpolation
- Closures (except EVM)
- Actors (LLVM only — EVM/NEAR use contract patterns)
- Contract blocks (EVM and NEAR only)

**Estimated new tests:** ~200+, project total from 588 to ~800+.

## Deliverables

- 3 new files: `llvmgen.ts`, `evmgen.ts`, `neargen.ts`
- 1 extended file: `wasmgen.ts`
- 4 test files (1 extended, 3 new)
- CLI `cbang build --target` command update
