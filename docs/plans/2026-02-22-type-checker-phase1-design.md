# Type Checker Phase 1 (MVP) Design

**Date:** 2026-02-22
**Status:** Approved
**Scope:** Core type checking for basic C! programs

---

## Goal

Implement a minimal type checker that validates the core subset of C! — basic types, function signatures, let bindings, expressions, and type declarations. This provides the foundation for later phases (ownership, refined types, effects).

## Scope

### In Phase 1

- **Primitive types:** `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `u128`, `u256`, `f32`, `f64`, `bool`, `String`, `()`
- **Type declarations:** struct types, type aliases, union types (ADTs)
- **Function signatures:** parameter types, return types, type-checking call arguments
- **Let bindings:** infer type from initializer or check against annotation
- **Binary/unary expressions:** arithmetic, comparison, logical — with type compatibility
- **Generic types:** `Option<T>`, `Result<T, E>`, `Map<K, V>`, `Vec<T>` (structural, no inference)
- **Error reporting:** type mismatch, undefined variable, undefined type, duplicate definitions

### NOT in Phase 1

- Linear/affine ownership tracking (Phase 2)
- Refined type constraints (Phase 3)
- Effect system checking (Phase 3)
- Actor/contract/server/component-specific rules (Phase 2-3)
- Intent annotation verification (Phase 4+)
- Generic type inference / unification (Phase 2)
- Lifetime / scope analysis (Phase 2)

## Architecture

```
src/checker/
├── index.ts          # Re-exports
├── types.ts          # Internal type representations
├── environment.ts    # Scoped symbol table
├── checker.ts        # Main type-checking visitor
└── builtins.ts       # Built-in types and functions
```

### Type Representation

```typescript
type Type =
  | { kind: 'Primitive'; name: string }
  | { kind: 'Unit' }
  | { kind: 'Function'; params: Type[]; ret: Type }
  | { kind: 'Struct'; name: string; fields: Map<string, Type> }
  | { kind: 'Union'; name: string; variants: Map<string, Type | null> }
  | { kind: 'Generic'; name: string; args: Type[] }
  | { kind: 'TypeAlias'; name: string; target: Type }
  | { kind: 'Unknown' }
  | { kind: 'Never' }
```

### Environment

Lexically scoped symbol table:

```typescript
class Environment {
  define(name: string, type: Type): void
  lookup(name: string): Type | undefined
  defineType(name: string, type: Type): void
  lookupType(name: string): Type | undefined
  enter(): void   // push scope
  leave(): void   // pop scope
}
```

### Checker

Two-pass approach:

1. **Declaration pass:** Register all top-level types and function signatures (enables forward references)
2. **Body pass:** Check function bodies, statements, and expressions

Returns `Diagnostic[]` using existing diagnostic infrastructure.

## Testing Strategy

- Valid programs produce no diagnostics
- Type mismatches produce clear errors
- Undefined names detected
- Duplicate definitions detected
- Return type checking
- If/match arm type consistency
- Binary operator type rules

## Integration

`cbang check` runs lexer → parser → checker, reporting all diagnostics. Replaces the current "Type checker not yet implemented" message.
