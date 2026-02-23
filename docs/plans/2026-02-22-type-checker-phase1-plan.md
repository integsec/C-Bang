# Type Checker Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a type checker to the C! compiler that validates basic types, function signatures, let bindings, and expressions — replacing the "Type checker not yet implemented" message in `cbang check`.

**Architecture:** Two-pass checker (declaration pass → body pass) over the existing AST. Internal type representations in `types.ts`, scoped symbol table in `environment.ts`, built-in types/functions in `builtins.ts`, main visitor in `checker.ts`. All diagnostics use the existing `Diagnostic` type from `src/errors/index.ts`.

**Tech Stack:** TypeScript (strict mode, ES2022), vitest for tests, existing AST from `src/ast/index.ts`

---

### Task 1: Create type representations (`types.ts`)

**Files:**
- Create: `compiler/src/checker/types.ts`
- Test: `compiler/tests/checker.test.ts`

**Step 1: Write the failing test**

Create `compiler/tests/checker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Type, PRIMITIVES, typeEquals, typeToString } from '../src/checker/types.js';

describe('Type representations', () => {
  it('has all primitive types', () => {
    expect(PRIMITIVES.has('i32')).toBe(true);
    expect(PRIMITIVES.has('bool')).toBe(true);
    expect(PRIMITIVES.has('String')).toBe(true);
    expect(PRIMITIVES.has('u256')).toBe(true);
  });

  it('compares primitive types', () => {
    const i32: Type = { kind: 'Primitive', name: 'i32' };
    const i32b: Type = { kind: 'Primitive', name: 'i32' };
    const bool: Type = { kind: 'Primitive', name: 'bool' };
    expect(typeEquals(i32, i32b)).toBe(true);
    expect(typeEquals(i32, bool)).toBe(false);
  });

  it('compares unit types', () => {
    expect(typeEquals({ kind: 'Unit' }, { kind: 'Unit' })).toBe(true);
  });

  it('formats types as strings', () => {
    expect(typeToString({ kind: 'Primitive', name: 'i32' })).toBe('i32');
    expect(typeToString({ kind: 'Unit' })).toBe('()');
    expect(typeToString({ kind: 'Unknown' })).toBe('<unknown>');
    expect(typeToString({ kind: 'Never' })).toBe('never');
    expect(typeToString({
      kind: 'Function',
      params: [{ kind: 'Primitive', name: 'i32' }],
      ret: { kind: 'Primitive', name: 'bool' },
    })).toBe('fn(i32) -> bool');
  });

  it('compares struct types by name', () => {
    const a: Type = { kind: 'Struct', name: 'User', fields: new Map([['id', { kind: 'Primitive', name: 'i32' }]]) };
    const b: Type = { kind: 'Struct', name: 'User', fields: new Map([['id', { kind: 'Primitive', name: 'i32' }]]) };
    const c: Type = { kind: 'Struct', name: 'Post', fields: new Map() };
    expect(typeEquals(a, b)).toBe(true);
    expect(typeEquals(a, c)).toBe(false);
  });

  it('compares generic types', () => {
    const a: Type = { kind: 'Generic', name: 'Vec', args: [{ kind: 'Primitive', name: 'i32' }] };
    const b: Type = { kind: 'Generic', name: 'Vec', args: [{ kind: 'Primitive', name: 'i32' }] };
    const c: Type = { kind: 'Generic', name: 'Vec', args: [{ kind: 'Primitive', name: 'bool' }] };
    expect(typeEquals(a, b)).toBe(true);
    expect(typeEquals(a, c)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd compiler && npx vitest run tests/checker.test.ts`
Expected: FAIL — cannot resolve `../src/checker/types.js`

**Step 3: Write minimal implementation**

Create `compiler/src/checker/types.ts`:

```typescript
/**
 * Internal type representations for the C! type checker.
 */

export type Type =
  | { kind: 'Primitive'; name: string }
  | { kind: 'Unit' }
  | { kind: 'Function'; params: Type[]; ret: Type }
  | { kind: 'Struct'; name: string; fields: Map<string, Type> }
  | { kind: 'Union'; name: string; variants: Map<string, Type | null> }
  | { kind: 'Generic'; name: string; args: Type[] }
  | { kind: 'Unknown' }
  | { kind: 'Never' };

export const PRIMITIVES = new Set([
  'i8', 'i16', 'i32', 'i64', 'i128',
  'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
  'f32', 'f64',
  'bool',
  'String',
]);

/** Numeric types that support arithmetic operators. */
export const NUMERIC_TYPES = new Set([
  'i8', 'i16', 'i32', 'i64', 'i128',
  'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
  'f32', 'f64',
]);

/** Integer types (for bitwise, modulo). */
export const INTEGER_TYPES = new Set([
  'i8', 'i16', 'i32', 'i64', 'i128',
  'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
]);

export function typeEquals(a: Type, b: Type): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'Primitive': return a.name === (b as typeof a).name;
    case 'Unit': return true;
    case 'Never': return true;
    case 'Unknown': return true;
    case 'Struct': return a.name === (b as typeof a).name;
    case 'Union': return a.name === (b as typeof a).name;
    case 'Generic': {
      const bg = b as typeof a;
      return a.name === bg.name
        && a.args.length === bg.args.length
        && a.args.every((arg, i) => typeEquals(arg, bg.args[i]!));
    }
    case 'Function': {
      const bf = b as typeof a;
      return bf.params.length === a.params.length
        && a.params.every((p, i) => typeEquals(p, bf.params[i]!))
        && typeEquals(a.ret, bf.ret);
    }
  }
}

export function typeToString(t: Type): string {
  switch (t.kind) {
    case 'Primitive': return t.name;
    case 'Unit': return '()';
    case 'Unknown': return '<unknown>';
    case 'Never': return 'never';
    case 'Struct': return t.name;
    case 'Union': return t.name;
    case 'Generic': return `${t.name}<${t.args.map(typeToString).join(', ')}>`;
    case 'Function': return `fn(${t.params.map(typeToString).join(', ')}) -> ${typeToString(t.ret)}`;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd compiler && npx vitest run tests/checker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add compiler/src/checker/types.ts compiler/tests/checker.test.ts
git commit -m "feat(checker): add internal type representations"
```

---

### Task 2: Create scoped environment (`environment.ts`)

**Files:**
- Create: `compiler/src/checker/environment.ts`
- Test: `compiler/tests/checker.test.ts` (append)

**Step 1: Write the failing tests**

Append to `compiler/tests/checker.test.ts`:

```typescript
import { Environment } from '../src/checker/environment.js';

describe('Environment', () => {
  it('defines and looks up variables', () => {
    const env = new Environment();
    const i32: Type = { kind: 'Primitive', name: 'i32' };
    env.define('x', i32);
    expect(env.lookup('x')).toEqual(i32);
  });

  it('returns undefined for missing variables', () => {
    const env = new Environment();
    expect(env.lookup('x')).toBeUndefined();
  });

  it('scopes variables with enter/leave', () => {
    const env = new Environment();
    const i32: Type = { kind: 'Primitive', name: 'i32' };
    env.define('x', i32);
    env.enter();
    env.define('y', i32);
    expect(env.lookup('x')).toEqual(i32); // parent scope
    expect(env.lookup('y')).toEqual(i32); // current scope
    env.leave();
    expect(env.lookup('y')).toBeUndefined(); // gone
    expect(env.lookup('x')).toEqual(i32); // still here
  });

  it('shadows variables in inner scope', () => {
    const env = new Environment();
    env.define('x', { kind: 'Primitive', name: 'i32' });
    env.enter();
    env.define('x', { kind: 'Primitive', name: 'bool' });
    expect(env.lookup('x')).toEqual({ kind: 'Primitive', name: 'bool' });
    env.leave();
    expect(env.lookup('x')).toEqual({ kind: 'Primitive', name: 'i32' });
  });

  it('defines and looks up types', () => {
    const env = new Environment();
    const userType: Type = { kind: 'Struct', name: 'User', fields: new Map() };
    env.defineType('User', userType);
    expect(env.lookupType('User')).toEqual(userType);
  });

  it('scopes types with enter/leave', () => {
    const env = new Environment();
    env.defineType('Outer', { kind: 'Struct', name: 'Outer', fields: new Map() });
    env.enter();
    env.defineType('Inner', { kind: 'Struct', name: 'Inner', fields: new Map() });
    expect(env.lookupType('Outer')).toBeDefined();
    expect(env.lookupType('Inner')).toBeDefined();
    env.leave();
    expect(env.lookupType('Inner')).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd compiler && npx vitest run tests/checker.test.ts`
Expected: FAIL — cannot resolve `../src/checker/environment.js`

**Step 3: Write minimal implementation**

Create `compiler/src/checker/environment.ts`:

```typescript
/**
 * Scoped symbol table for the C! type checker.
 *
 * Supports nested lexical scopes via enter()/leave().
 * Separate namespaces for values and types.
 */

import type { Type } from './types.js';

interface Scope {
  values: Map<string, Type>;
  types: Map<string, Type>;
}

export class Environment {
  private scopes: Scope[] = [{ values: new Map(), types: new Map() }];

  define(name: string, type: Type): void {
    this.current().values.set(name, type);
  }

  lookup(name: string): Type | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const t = this.scopes[i]!.values.get(name);
      if (t !== undefined) return t;
    }
    return undefined;
  }

  defineType(name: string, type: Type): void {
    this.current().types.set(name, type);
  }

  lookupType(name: string): Type | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const t = this.scopes[i]!.types.get(name);
      if (t !== undefined) return t;
    }
    return undefined;
  }

  enter(): void {
    this.scopes.push({ values: new Map(), types: new Map() });
  }

  leave(): void {
    if (this.scopes.length > 1) {
      this.scopes.pop();
    }
  }

  private current(): Scope {
    return this.scopes[this.scopes.length - 1]!;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd compiler && npx vitest run tests/checker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add compiler/src/checker/environment.ts compiler/tests/checker.test.ts
git commit -m "feat(checker): add scoped symbol table"
```

---

### Task 3: Create built-in types and functions (`builtins.ts`)

**Files:**
- Create: `compiler/src/checker/builtins.ts`
- Test: `compiler/tests/checker.test.ts` (append)

**Step 1: Write the failing tests**

Append to `compiler/tests/checker.test.ts`:

```typescript
import { registerBuiltins } from '../src/checker/builtins.js';

describe('Builtins', () => {
  it('registers primitive types', () => {
    const env = new Environment();
    registerBuiltins(env);
    expect(env.lookupType('i32')).toEqual({ kind: 'Primitive', name: 'i32' });
    expect(env.lookupType('bool')).toEqual({ kind: 'Primitive', name: 'bool' });
    expect(env.lookupType('String')).toEqual({ kind: 'Primitive', name: 'String' });
  });

  it('registers print function', () => {
    const env = new Environment();
    registerBuiltins(env);
    const print = env.lookup('print');
    expect(print).toBeDefined();
    expect(print!.kind).toBe('Function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd compiler && npx vitest run tests/checker.test.ts`
Expected: FAIL — cannot resolve `../src/checker/builtins.js`

**Step 3: Write minimal implementation**

Create `compiler/src/checker/builtins.ts`:

```typescript
/**
 * Built-in types and functions for the C! type checker.
 */

import type { Environment } from './environment.js';
import { PRIMITIVES } from './types.js';
import type { Type } from './types.js';

export function registerBuiltins(env: Environment): void {
  // Register all primitive types
  for (const name of PRIMITIVES) {
    env.defineType(name, { kind: 'Primitive', name });
  }

  // Unit type (void equivalent)
  env.defineType('()', { kind: 'Unit' });

  // print(value: String) -> ()
  env.define('print', {
    kind: 'Function',
    params: [{ kind: 'Primitive', name: 'String' }],
    ret: { kind: 'Unit' },
  });

  // println(value: String) -> ()
  env.define('println', {
    kind: 'Function',
    params: [{ kind: 'Primitive', name: 'String' }],
    ret: { kind: 'Unit' },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd compiler && npx vitest run tests/checker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add compiler/src/checker/builtins.ts compiler/tests/checker.test.ts
git commit -m "feat(checker): add built-in types and functions"
```

---

### Task 4: Create checker — declaration pass and basic structure

**Files:**
- Create: `compiler/src/checker/checker.ts`
- Create: `compiler/src/checker/index.ts`
- Test: `compiler/tests/checker.test.ts` (append)

**Step 1: Write the failing tests**

Append to `compiler/tests/checker.test.ts`:

```typescript
import { Checker } from '../src/checker/index.js';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';

function check(source: string) {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const checker = new Checker();
  return checker.check(program);
}

describe('Checker', () => {
  describe('declaration pass', () => {
    it('accepts empty program', () => {
      expect(check('')).toEqual([]);
    });

    it('registers type declarations', () => {
      const diagnostics = check('type Age = i32');
      expect(diagnostics).toEqual([]);
    });

    it('detects duplicate type declarations', () => {
      const diagnostics = check('type Age = i32\ntype Age = i64');
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.message).toContain('Age');
      expect(diagnostics[0]!.message).toContain('already defined');
    });

    it('registers function declarations', () => {
      const diagnostics = check('fn greet(name: String) -> String {}');
      expect(diagnostics).toEqual([]);
    });

    it('detects duplicate function declarations', () => {
      const diagnostics = check('fn foo() {}\nfn foo() {}');
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.message).toContain('foo');
    });

    it('registers struct types', () => {
      const diagnostics = check(`
        type User {
          name: String,
          age: i32,
        }
      `);
      expect(diagnostics).toEqual([]);
    });

    it('registers union types', () => {
      const diagnostics = check('type Color = Red | Green | Blue');
      expect(diagnostics).toEqual([]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd compiler && npx vitest run tests/checker.test.ts`
Expected: FAIL — cannot resolve `../src/checker/index.js`

**Step 3: Write implementation**

Create `compiler/src/checker/checker.ts`:

```typescript
/**
 * Type checker for the C! programming language (Phase 1 MVP).
 *
 * Two-pass approach:
 *   1. Declaration pass — register all top-level types and function signatures
 *   2. Body pass — check function bodies, statements, and expressions
 */

import type {
  Program, TopLevelItem, FunctionDecl, TypeDecl,
  TypeExpr, Block, Stmt, Expr, Parameter,
} from '../ast/index.js';
import type { Diagnostic } from '../errors/index.js';
import { createError } from '../errors/index.js';
import type { Span } from '../lexer/index.js';
import { Environment } from './environment.js';
import { registerBuiltins } from './builtins.js';
import type { Type } from './types.js';
import { PRIMITIVES, NUMERIC_TYPES, typeEquals, typeToString } from './types.js';

export class Checker {
  private env = new Environment();
  private diagnostics: Diagnostic[] = [];
  private currentReturnType: Type | null = null;

  check(program: Program): Diagnostic[] {
    this.diagnostics = [];
    registerBuiltins(this.env);
    this.declarationPass(program);
    this.bodyPass(program);
    return this.diagnostics;
  }

  // ─── Declaration Pass ──────────────────────────────────────────

  private declarationPass(program: Program): void {
    for (const item of program.items) {
      this.registerTopLevel(item);
    }
  }

  private registerTopLevel(item: TopLevelItem): void {
    switch (item.kind) {
      case 'TypeDecl':
        this.registerType(item);
        break;
      case 'FunctionDecl':
        this.registerFunction(item);
        break;
      // Phase 1: skip actors, contracts, servers, components, use, mod
      default:
        break;
    }
  }

  private registerType(decl: TypeDecl): void {
    if (this.env.lookupType(decl.name) !== undefined) {
      this.error(`Type '${decl.name}' is already defined`, decl.span);
      return;
    }

    let type: Type;
    switch (decl.body.kind) {
      case 'Alias':
        type = this.resolveTypeExpr(decl.body.type);
        break;
      case 'Struct': {
        const fields = new Map<string, Type>();
        for (const field of decl.body.fields) {
          fields.set(field.name, this.resolveTypeExpr(field.typeAnnotation));
        }
        type = { kind: 'Struct', name: decl.name, fields };
        break;
      }
      case 'Enum': {
        const variants = new Map<string, Type | null>();
        for (const variant of decl.body.variants) {
          if (variant.fields !== null && variant.fields.length > 0) {
            // For single-field variants, use the field type directly
            // For multi-field variants, wrap in a generic Tuple (future)
            variants.set(variant.name, this.resolveTypeExpr(variant.fields[0]!));
          } else {
            variants.set(variant.name, null);
          }
        }
        type = { kind: 'Union', name: decl.name, variants };
        break;
      }
    }
    this.env.defineType(decl.name, type);
  }

  private registerFunction(decl: FunctionDecl): void {
    if (this.env.lookup(decl.name) !== undefined) {
      this.error(`Function '${decl.name}' is already defined`, decl.span);
      return;
    }

    const params = decl.params.map(p => this.resolveTypeExpr(p.typeAnnotation));
    const ret = decl.returnType ? this.resolveTypeExpr(decl.returnType) : { kind: 'Unit' as const };
    const fnType: Type = { kind: 'Function', params, ret };
    this.env.define(decl.name, fnType);
  }

  // ─── Body Pass ─────────────────────────────────────────────────

  private bodyPass(program: Program): void {
    for (const item of program.items) {
      if (item.kind === 'FunctionDecl') {
        this.checkFunction(item);
      }
    }
  }

  private checkFunction(decl: FunctionDecl): void {
    this.env.enter();
    // Bind parameters
    for (const param of decl.params) {
      this.env.define(param.name, this.resolveTypeExpr(param.typeAnnotation));
    }
    this.currentReturnType = decl.returnType
      ? this.resolveTypeExpr(decl.returnType)
      : { kind: 'Unit' };
    this.checkBlock(decl.body);
    this.currentReturnType = null;
    this.env.leave();
  }

  // ─── Statements ────────────────────────────────────────────────

  private checkBlock(block: Block): void {
    for (const stmt of block.statements) {
      this.checkStmt(stmt);
    }
  }

  private checkStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case 'LetStmt':
        this.checkLetStmt(stmt);
        break;
      case 'ReturnStmt':
        this.checkReturnStmt(stmt);
        break;
      case 'ExprStmt':
        this.inferExpr(stmt.expr);
        break;
      case 'IfStmt':
        this.checkIfStmt(stmt);
        break;
      case 'ForStmt':
        this.checkForStmt(stmt);
        break;
      case 'AssignStmt':
        this.checkAssignStmt(stmt);
        break;
      case 'MatchStmt':
        this.checkMatchStmt(stmt);
        break;
      // Phase 1: skip ReplyStmt, EmitStmt, SpawnStmt, DeployStmt
      default:
        break;
    }
  }

  private checkLetStmt(stmt: import('../ast/index.js').LetStmt): void {
    const initType = this.inferExpr(stmt.initializer);
    if (stmt.typeAnnotation) {
      const annotated = this.resolveTypeExpr(stmt.typeAnnotation);
      if (!typeEquals(initType, annotated) && initType.kind !== 'Unknown') {
        this.error(
          `Type mismatch: expected '${typeToString(annotated)}', found '${typeToString(initType)}'`,
          stmt.span,
        );
      }
      this.env.define(stmt.name, annotated);
    } else {
      this.env.define(stmt.name, initType);
    }
  }

  private checkReturnStmt(stmt: import('../ast/index.js').ReturnStmt): void {
    if (!this.currentReturnType) return;
    if (stmt.value) {
      const valType = this.inferExpr(stmt.value);
      if (!typeEquals(valType, this.currentReturnType) && valType.kind !== 'Unknown') {
        this.error(
          `Return type mismatch: expected '${typeToString(this.currentReturnType)}', found '${typeToString(valType)}'`,
          stmt.span,
        );
      }
    } else if (!typeEquals(this.currentReturnType, { kind: 'Unit' })) {
      this.error(
        `Return type mismatch: expected '${typeToString(this.currentReturnType)}', found '()'`,
        stmt.span,
      );
    }
  }

  private checkIfStmt(stmt: import('../ast/index.js').IfStmt): void {
    const condType = this.inferExpr(stmt.condition);
    if (condType.kind !== 'Unknown' && !typeEquals(condType, { kind: 'Primitive', name: 'bool' })) {
      this.error(
        `Condition must be 'bool', found '${typeToString(condType)}'`,
        stmt.condition.span,
      );
    }
    this.env.enter();
    this.checkBlock(stmt.then);
    this.env.leave();
    if (stmt.else_) {
      if (stmt.else_.kind === 'Block') {
        this.env.enter();
        this.checkBlock(stmt.else_);
        this.env.leave();
      } else {
        this.checkIfStmt(stmt.else_);
      }
    }
  }

  private checkForStmt(stmt: import('../ast/index.js').ForStmt): void {
    this.inferExpr(stmt.iterable);
    this.env.enter();
    // Phase 1: bind loop variable as Unknown (need iterable type inference for better)
    this.env.define(stmt.variable, { kind: 'Unknown' });
    this.checkBlock(stmt.body);
    this.env.leave();
  }

  private checkAssignStmt(stmt: import('../ast/index.js').AssignStmt): void {
    const targetType = this.inferExpr(stmt.target);
    const valueType = this.inferExpr(stmt.value);
    if (targetType.kind !== 'Unknown' && valueType.kind !== 'Unknown') {
      if (stmt.operator === '+=' || stmt.operator === '-=') {
        if (targetType.kind !== 'Primitive' || !NUMERIC_TYPES.has(targetType.name)) {
          this.error(
            `Operator '${stmt.operator}' requires numeric type, found '${typeToString(targetType)}'`,
            stmt.span,
          );
        }
      }
      if (!typeEquals(targetType, valueType)) {
        this.error(
          `Cannot assign '${typeToString(valueType)}' to '${typeToString(targetType)}'`,
          stmt.span,
        );
      }
    }
  }

  private checkMatchStmt(stmt: import('../ast/index.js').MatchStmt): void {
    this.inferExpr(stmt.subject);
    for (const arm of stmt.arms) {
      this.env.enter();
      // Phase 1: bind pattern names as Unknown
      this.bindPattern(arm.pattern);
      if (arm.body.kind === 'Block') {
        this.checkBlock(arm.body);
      } else {
        this.inferExpr(arm.body);
      }
      this.env.leave();
    }
  }

  private bindPattern(pattern: import('../ast/index.js').Pattern): void {
    switch (pattern.kind) {
      case 'IdentPattern':
        this.env.define(pattern.name, { kind: 'Unknown' });
        break;
      case 'ConstructorPattern':
        for (const field of pattern.fields) {
          this.bindPattern(field);
        }
        break;
      // LiteralPattern and WildcardPattern bind nothing
    }
  }

  // ─── Expressions ───────────────────────────────────────────────

  private inferExpr(expr: Expr): Type {
    switch (expr.kind) {
      case 'IntLiteral': return { kind: 'Primitive', name: 'i64' };
      case 'FloatLiteral': return { kind: 'Primitive', name: 'f64' };
      case 'StringLiteral': return { kind: 'Primitive', name: 'String' };
      case 'BoolLiteral': return { kind: 'Primitive', name: 'bool' };

      case 'Ident':
        return this.inferIdent(expr);

      case 'Binary':
        return this.inferBinary(expr);

      case 'Unary':
        return this.inferUnary(expr);

      case 'Call':
        return this.inferCall(expr);

      case 'FieldAccess':
        return this.inferFieldAccess(expr);

      case 'Index':
        return this.inferIndex(expr);

      case 'Struct':
        return this.inferStruct(expr);

      case 'IfExpr':
        return this.inferIfExpr(expr);

      case 'BlockExpr': {
        this.env.enter();
        this.checkBlock(expr.block);
        this.env.leave();
        return { kind: 'Unit' };
      }

      case 'MacroCall':
        // verify!(), assert!(), etc. — return Unit for now
        for (const arg of expr.args) {
          this.inferExpr(arg);
        }
        return { kind: 'Unit' };

      case 'Path': {
        // Path like Foo::Bar — try to look up the first segment
        const first = expr.segments[0]!;
        return this.env.lookup(first) ?? this.env.lookupType(first) ?? { kind: 'Unknown' };
      }

      case 'MethodCall': {
        this.inferExpr(expr.object);
        for (const arg of expr.args) {
          this.inferExpr(arg.value);
        }
        return { kind: 'Unknown' };
      }

      case 'Range':
        if (expr.start) this.inferExpr(expr.start);
        if (expr.end) this.inferExpr(expr.end);
        return { kind: 'Unknown' };

      default:
        return { kind: 'Unknown' };
    }
  }

  private inferIdent(expr: import('../ast/index.js').IdentExpr): Type {
    const t = this.env.lookup(expr.name);
    if (t !== undefined) return t;
    // Also check if it's a type name (for constructor-like usage)
    const typeT = this.env.lookupType(expr.name);
    if (typeT !== undefined) return typeT;
    this.error(`Undefined variable '${expr.name}'`, expr.span);
    return { kind: 'Unknown' };
  }

  private inferBinary(expr: import('../ast/index.js').BinaryExpr): Type {
    const left = this.inferExpr(expr.left);
    const right = this.inferExpr(expr.right);

    // Comparison and logical operators return bool
    if (['==', '!=', '<', '>', '<=', '>='].includes(expr.operator)) {
      return { kind: 'Primitive', name: 'bool' };
    }
    if (['&&', '||'].includes(expr.operator)) {
      if (left.kind !== 'Unknown' && !typeEquals(left, { kind: 'Primitive', name: 'bool' })) {
        this.error(`Operator '${expr.operator}' requires 'bool', found '${typeToString(left)}'`, expr.left.span);
      }
      if (right.kind !== 'Unknown' && !typeEquals(right, { kind: 'Primitive', name: 'bool' })) {
        this.error(`Operator '${expr.operator}' requires 'bool', found '${typeToString(right)}'`, expr.right.span);
      }
      return { kind: 'Primitive', name: 'bool' };
    }

    // Arithmetic operators: +, -, *, /, %
    if (['+', '-', '*', '/', '%'].includes(expr.operator)) {
      if (left.kind === 'Unknown' || right.kind === 'Unknown') return left.kind !== 'Unknown' ? left : right;
      if (left.kind === 'Primitive' && NUMERIC_TYPES.has(left.name)) {
        if (!typeEquals(left, right)) {
          this.error(
            `Type mismatch in '${expr.operator}': '${typeToString(left)}' and '${typeToString(right)}'`,
            expr.span,
          );
        }
        return left;
      }
      this.error(`Operator '${expr.operator}' requires numeric types, found '${typeToString(left)}'`, expr.span);
      return { kind: 'Unknown' };
    }

    return { kind: 'Unknown' };
  }

  private inferUnary(expr: import('../ast/index.js').UnaryExpr): Type {
    const operand = this.inferExpr(expr.operand);
    if (expr.operator === '!') {
      if (operand.kind !== 'Unknown' && !typeEquals(operand, { kind: 'Primitive', name: 'bool' })) {
        this.error(`Operator '!' requires 'bool', found '${typeToString(operand)}'`, expr.operand.span);
      }
      return { kind: 'Primitive', name: 'bool' };
    }
    if (expr.operator === '-') {
      return operand;
    }
    return operand;
  }

  private inferCall(expr: import('../ast/index.js').CallExpr): Type {
    const calleeType = this.inferExpr(expr.callee);

    // Check arguments regardless
    for (const arg of expr.args) {
      this.inferExpr(arg.value);
    }

    if (calleeType.kind === 'Function') {
      if (expr.args.length !== calleeType.params.length) {
        this.error(
          `Expected ${calleeType.params.length} arguments, found ${expr.args.length}`,
          expr.span,
        );
      } else {
        for (let i = 0; i < expr.args.length; i++) {
          const argType = this.inferExpr(expr.args[i]!.value);
          const paramType = calleeType.params[i]!;
          if (argType.kind !== 'Unknown' && !typeEquals(argType, paramType)) {
            this.error(
              `Argument ${i + 1}: expected '${typeToString(paramType)}', found '${typeToString(argType)}'`,
              expr.args[i]!.span,
            );
          }
        }
      }
      return calleeType.ret;
    }

    // Unknown callee — can't check
    if (calleeType.kind !== 'Unknown') {
      this.error(`'${typeToString(calleeType)}' is not callable`, expr.span);
    }
    return { kind: 'Unknown' };
  }

  private inferFieldAccess(expr: import('../ast/index.js').FieldAccessExpr): Type {
    const objType = this.inferExpr(expr.object);
    if (objType.kind === 'Struct') {
      const fieldType = objType.fields.get(expr.field);
      if (fieldType) return fieldType;
      this.error(`Type '${objType.name}' has no field '${expr.field}'`, expr.span);
      return { kind: 'Unknown' };
    }
    // For non-struct or unknown, return Unknown
    return { kind: 'Unknown' };
  }

  private inferIndex(expr: import('../ast/index.js').IndexExpr): Type {
    this.inferExpr(expr.object);
    this.inferExpr(expr.index);
    // Phase 1: can't resolve index types without generics
    return { kind: 'Unknown' };
  }

  private inferStruct(expr: import('../ast/index.js').StructExpr): Type {
    const structType = this.env.lookupType(expr.name);
    if (!structType) {
      this.error(`Undefined type '${expr.name}'`, expr.span);
      return { kind: 'Unknown' };
    }
    if (structType.kind === 'Struct') {
      for (const field of expr.fields) {
        const expectedType = structType.fields.get(field.name);
        if (!expectedType) {
          this.error(`Type '${expr.name}' has no field '${field.name}'`, field.span);
          continue;
        }
        const valueType = this.inferExpr(field.value);
        if (valueType.kind !== 'Unknown' && !typeEquals(valueType, expectedType)) {
          this.error(
            `Field '${field.name}': expected '${typeToString(expectedType)}', found '${typeToString(valueType)}'`,
            field.span,
          );
        }
      }
    }
    return structType;
  }

  private inferIfExpr(expr: import('../ast/index.js').IfExpr): Type {
    const condType = this.inferExpr(expr.condition);
    if (condType.kind !== 'Unknown' && !typeEquals(condType, { kind: 'Primitive', name: 'bool' })) {
      this.error(`Condition must be 'bool', found '${typeToString(condType)}'`, expr.condition.span);
    }
    this.env.enter();
    this.checkBlock(expr.then);
    this.env.leave();
    if (expr.else_) {
      if (expr.else_.kind === 'Block') {
        this.env.enter();
        this.checkBlock(expr.else_);
        this.env.leave();
      }
    }
    return { kind: 'Unit' };
  }

  // ─── Type Resolution ───────────────────────────────────────────

  resolveTypeExpr(typeExpr: TypeExpr): Type {
    switch (typeExpr.kind) {
      case 'NamedType': {
        const t = this.env.lookupType(typeExpr.name);
        if (t) return t;
        if (PRIMITIVES.has(typeExpr.name)) {
          return { kind: 'Primitive', name: typeExpr.name };
        }
        this.error(`Undefined type '${typeExpr.name}'`, typeExpr.span);
        return { kind: 'Unknown' };
      }

      case 'GenericType':
        return {
          kind: 'Generic',
          name: typeExpr.name,
          args: typeExpr.typeArgs.map(a => this.resolveTypeExpr(a)),
        };

      case 'RefinedType':
        // Phase 1: ignore constraints, just resolve base type
        return this.resolveTypeExpr(typeExpr.baseType);

      case 'FunctionType':
        return {
          kind: 'Function',
          params: typeExpr.params.map(p => this.resolveTypeExpr(p)),
          ret: this.resolveTypeExpr(typeExpr.returnType),
        };

      case 'UnionType':
        // Phase 1: return Unknown for inline union types
        return { kind: 'Unknown' };

      case 'ReferenceType':
        // Phase 1: ignore reference wrapper, return inner type
        return this.resolveTypeExpr(typeExpr.inner);

      case 'OwnType':
        return this.resolveTypeExpr(typeExpr.inner);

      case 'SharedType':
        return this.resolveTypeExpr(typeExpr.inner);
    }
  }

  // ─── Diagnostics ───────────────────────────────────────────────

  private error(message: string, span: Span): void {
    this.diagnostics.push(createError('E_TYPE', message, span));
  }
}
```

Create `compiler/src/checker/index.ts`:

```typescript
export { Checker } from './checker.js';
export { Environment } from './environment.js';
export type { Type } from './types.js';
export { typeEquals, typeToString, PRIMITIVES, NUMERIC_TYPES } from './types.js';
export { registerBuiltins } from './builtins.js';
```

**Step 4: Run test to verify it passes**

Run: `cd compiler && npx vitest run tests/checker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add compiler/src/checker/
git commit -m "feat(checker): add type checker with declaration and body passes"
```

---

### Task 5: Add expression and statement type-checking tests

**Files:**
- Test: `compiler/tests/checker.test.ts` (append)

**Step 1: Write tests for expression type checking**

Append to `compiler/tests/checker.test.ts`:

```typescript
  describe('let statements', () => {
    it('accepts matching type annotation', () => {
      expect(check('fn main() { let x: i64 = 42; }')).toEqual([]);
    });

    it('detects type annotation mismatch', () => {
      const d = check('fn main() { let x: bool = 42; }');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('bool');
      expect(d[0]!.message).toContain('i64');
    });

    it('infers type from initializer', () => {
      // No annotation — should infer and allow use
      expect(check('fn main() { let x = 42; }')).toEqual([]);
    });
  });

  describe('undefined variables', () => {
    it('detects use of undefined variable', () => {
      const d = check('fn main() { let x = y; }');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undefined variable 'y'");
    });

    it('allows use of previously defined variable', () => {
      expect(check('fn main() { let x = 42; let y = x; }')).toEqual([]);
    });
  });

  describe('return type checking', () => {
    it('accepts correct return type', () => {
      expect(check('fn foo() -> i64 { return 42; }')).toEqual([]);
    });

    it('detects wrong return type', () => {
      const d = check('fn foo() -> bool { return 42; }');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('Return type mismatch');
    });
  });

  describe('binary expressions', () => {
    it('infers arithmetic type', () => {
      expect(check('fn main() { let x: i64 = 1 + 2; }')).toEqual([]);
    });

    it('detects mismatched arithmetic operands', () => {
      const d = check('fn main() { let x = true + 1; }');
      expect(d.length).toBeGreaterThan(0);
    });

    it('comparison returns bool', () => {
      expect(check('fn main() { let x: bool = 1 < 2; }')).toEqual([]);
    });

    it('logical operators require bool', () => {
      expect(check('fn main() { let x = true && false; }')).toEqual([]);
    });
  });

  describe('if statements', () => {
    it('requires bool condition', () => {
      const d = check('fn main() { if 42 {} }');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('bool');
    });

    it('accepts bool condition', () => {
      expect(check('fn main() { if true {} }')).toEqual([]);
    });
  });

  describe('function calls', () => {
    it('checks argument count', () => {
      const d = check('fn foo(x: i64) {} fn main() { foo(); }');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('Expected 1 arguments');
    });

    it('checks argument types', () => {
      const d = check('fn foo(x: bool) {} fn main() { foo(42); }');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('bool');
    });

    it('accepts correct arguments', () => {
      expect(check('fn foo(x: i64) {} fn main() { foo(42); }')).toEqual([]);
    });

    it('uses return type', () => {
      expect(check('fn bar() -> i64 { return 42; } fn main() { let x: i64 = bar(); }')).toEqual([]);
    });
  });

  describe('struct types', () => {
    it('checks struct field access', () => {
      const d = check(`
        type Point { x: i64, y: i64 }
        fn main() {
          let p = Point { x: 1, y: 2 };
          let val: i64 = p.x;
        }
      `);
      expect(d).toEqual([]);
    });

    it('detects unknown struct field in constructor', () => {
      const d = check(`
        type Point { x: i64, y: i64 }
        fn main() { let p = Point { x: 1, z: 2 }; }
      `);
      expect(d.length).toBeGreaterThan(0);
      expect(d.some(e => e.message.includes("no field 'z'"))).toBe(true);
    });

    it('detects unknown field in access', () => {
      const d = check(`
        type Point { x: i64, y: i64 }
        fn main() {
          let p = Point { x: 1, y: 2 };
          let z = p.z;
        }
      `);
      expect(d.length).toBeGreaterThan(0);
      expect(d.some(e => e.message.includes("no field 'z'"))).toBe(true);
    });
  });

  describe('undefined types', () => {
    it('detects use of undefined type in function param', () => {
      const d = check('fn foo(x: Blah) {}');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undefined type 'Blah'");
    });
  });

  describe('unary operators', () => {
    it('negation preserves numeric type', () => {
      expect(check('fn main() { let x: i64 = -42; }')).toEqual([]);
    });

    it('not operator requires bool', () => {
      const d = check('fn main() { let x = !42; }');
      expect(d.length).toBeGreaterThan(0);
    });
  });

  describe('assignment statements', () => {
    it('checks assignment type compatibility', () => {
      const d = check('fn main() { let mut x: i64 = 0; x = true; }');
      expect(d.length).toBeGreaterThan(0);
    });

    it('accepts compatible assignment', () => {
      expect(check('fn main() { let mut x: i64 = 0; x = 42; }')).toEqual([]);
    });

    it('checks compound assignment requires numeric', () => {
      const d = check('fn main() { let mut x: bool = true; x += true; }');
      expect(d.length).toBeGreaterThan(0);
    });
  });
```

**Step 2: Run tests to verify they pass**

Run: `cd compiler && npx vitest run tests/checker.test.ts`
Expected: ALL PASS (implementation from Task 4 already handles all these cases)

**Step 3: Commit**

```bash
git add compiler/tests/checker.test.ts
git commit -m "test(checker): add comprehensive type checking tests"
```

---

### Task 6: Integrate checker into CLI and re-exports

**Files:**
- Modify: `compiler/src/cli.ts:113-139` (update `checkCommand`)
- Modify: `compiler/src/index.ts` (add checker export)

**Step 1: Write a test for CLI integration**

Append to `compiler/tests/checker.test.ts`:

```typescript
  describe('integration', () => {
    it('full pipeline: lex → parse → check valid program', () => {
      const source = `
        type User {
          name: String,
          age: i64,
        }

        fn greet(user: User) -> String {
          return user.name;
        }

        fn main() {
          let u = User { name: "Alice", age: 30 };
          let name = greet(u);
        }
      `;
      const diagnostics = check(source);
      expect(diagnostics).toEqual([]);
    });

    it('full pipeline: detects multiple errors', () => {
      const source = `
        fn foo(x: i64) -> bool {
          let y = undefined_var;
          return 42;
        }
      `;
      const diagnostics = check(source);
      expect(diagnostics.length).toBeGreaterThanOrEqual(2);
    });
  });
```

**Step 2: Run test to verify it passes**

Run: `cd compiler && npx vitest run tests/checker.test.ts`
Expected: PASS

**Step 3: Update CLI to use checker**

Modify `compiler/src/cli.ts` — replace lines 113-139 (`checkCommand` function):

```typescript
function checkCommand(filePath: string): void {
  const source = readSource(filePath);
  const lexer = new Lexer(source, filePath);
  const tokens = lexer.tokenize();

  const lexErrors = tokens.filter(t => t.type === TokenType.Error);
  if (lexErrors.length > 0) {
    for (const err of lexErrors) {
      console.error(`Error at ${err.span.start.line}:${err.span.start.column}: unexpected character '${err.value}'`);
    }
    process.exit(1);
  }

  console.log(`✓ Lexing passed (${tokens.length} tokens)`);

  const parser = new Parser(tokens);
  const { program, diagnostics: parseDiags } = parser.parse();

  if (parseDiags.length > 0) {
    for (const d of parseDiags) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  console.log(`✓ Parsing passed (${program.items.length} top-level items)`);

  const checker = new Checker();
  const typeDiags = checker.check(program);

  if (typeDiags.length > 0) {
    for (const d of typeDiags) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  console.log(`✓ Type checking passed`);
}
```

Add import at top of `compiler/src/cli.ts`:

```typescript
import { Checker } from './checker/index.js';
```

Update `compiler/src/index.ts` to add:

```typescript
export { Checker } from './checker/index.js';
export type { Type } from './checker/types.js';
```

**Step 4: Verify all tests pass**

Run: `cd compiler && npx vitest run`
Expected: ALL 151 existing tests + new checker tests PASS

**Step 5: Manually test with fixture**

Run: `cd compiler && npx tsx src/cli.ts check tests/fixtures/hello.cb`
Expected output:
```
✓ Lexing passed (N tokens)
✓ Parsing passed (1 top-level items)
✓ Type checking passed
```

**Step 6: Commit**

```bash
git add compiler/src/cli.ts compiler/src/index.ts compiler/src/checker/ compiler/tests/checker.test.ts
git commit -m "feat(checker): integrate type checker into cbang check command"
```

---

### Task 7: Verify everything and update test fixture

**Files:**
- Create: `compiler/tests/fixtures/types.cb` (richer test fixture)

**Step 1: Create a richer test fixture**

Create `compiler/tests/fixtures/types.cb`:

```
#[intent("Demonstrate C! type checking")]
type Point {
    x: i64,
    y: i64,
}

fn distance_squared(a: Point, b: Point) -> i64 {
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    return dx * dx + dy * dy;
}

fn main() {
    let origin = Point { x: 0, y: 0 };
    let target = Point { x: 3, y: 4 };
    let dist = distance_squared(origin, target);
}
```

**Step 2: Run the full check pipeline**

Run: `cd compiler && npx tsx src/cli.ts check tests/fixtures/types.cb`
Expected:
```
✓ Lexing passed
✓ Parsing passed
✓ Type checking passed
```

**Step 3: Run all tests one final time**

Run: `cd compiler && npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add compiler/tests/fixtures/types.cb
git commit -m "test: add types.cb fixture for type checker verification"
```
