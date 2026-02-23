# Changelog

## 0.2.0 — 2026-02-23

### Added

- 30+ code snippets for common C! patterns (functions, actors, contracts, servers, components, control flow, annotations)
- Problem matcher for `cbang check` output — see errors inline in VS Code
- Task definition for `cbang` commands
- File icon for `.cb` files using the C! logo
- `security` keyword tag

### Changed

- Bumped version to 0.2.0
- Updated README with snippet table, problem matcher usage, and links

## 0.1.0 — 2026-02-22

### Added

- Syntax highlighting for `.cb` files
- Support for all C! language constructs:
  - Functions, types, structs, enums, actors, contracts, servers, and components
  - Linear/affine ownership keywords (owned, borrowed, shared, move)
  - Actor model keywords (spawn, send, receive, on, supervise, reply)
  - Smart contract features (deploy, emit, verify!, caller)
  - Intent annotations (#[intent(...)]) and other attributes
  - Pre/post conditions (#[pre(...)], #[post(...)])
  - Invariants (#[invariant(...)])
  - HTTP route attributes (#[get(...)], #[post(...)], etc.)
  - Refined types with constraints (u16{1..65535}, String{len: 1..50})
  - String interpolation ({expr} inside double-quoted strings)
  - All primitive types (i8-i64, u8-u256, f32, f64, bool, string, etc.)
  - Standard library types (Result, Option, Vec, Map, etc.)
  - Macro invocations (verify!, format!, etc.)
- Comment toggling (// and /* */)
- Bracket matching and auto-closing
- Code folding support
- Indentation rules
