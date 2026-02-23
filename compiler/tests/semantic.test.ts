import { describe, it, expect } from 'vitest';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';
import { Resolver } from '../src/semantic/index.js';
import { SymbolTable } from '../src/semantic/scope.js';
import type { SymbolInfo } from '../src/semantic/scope.js';
import type { Diagnostic } from '../src/errors/index.js';

// ─── Helper ───────────────────────────────────────────────────────

function resolve(source: string): Diagnostic[] {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const resolver = new Resolver();
  return resolver.resolve(program);
}

const BUILTIN_SPAN = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
  file: '<test>',
};

function sym(name: string, symbolKind: SymbolInfo['symbolKind'] = 'variable'): SymbolInfo {
  return { name, symbolKind, span: BUILTIN_SPAN, mutable: false };
}

// ─── SymbolTable unit tests ───────────────────────────────────────

describe('SymbolTable', () => {
  it('defines and looks up a value', () => {
    const st = new SymbolTable();
    expect(st.defineValue(sym('x'))).toBe(true);
    expect(st.lookupValue('x')).toBeDefined();
    expect(st.lookupValue('x')!.name).toBe('x');
  });

  it('returns undefined for missing values', () => {
    const st = new SymbolTable();
    expect(st.lookupValue('x')).toBeUndefined();
  });

  it('rejects duplicate value in same scope', () => {
    const st = new SymbolTable();
    expect(st.defineValue(sym('x'))).toBe(true);
    expect(st.defineValue(sym('x'))).toBe(false);
  });

  it('allows same name in nested scope (shadowing)', () => {
    const st = new SymbolTable();
    expect(st.defineValue(sym('x'))).toBe(true);
    st.enter();
    expect(st.defineValue(sym('x', 'parameter'))).toBe(true);
    expect(st.lookupValue('x')!.symbolKind).toBe('parameter');
    st.leave();
    expect(st.lookupValue('x')!.symbolKind).toBe('variable');
  });

  it('looks up values from outer scope', () => {
    const st = new SymbolTable();
    st.defineValue(sym('outer'));
    st.enter();
    expect(st.lookupValue('outer')).toBeDefined();
    st.leave();
  });

  it('inner scope values disappear after leave', () => {
    const st = new SymbolTable();
    st.enter();
    st.defineValue(sym('inner'));
    expect(st.lookupValue('inner')).toBeDefined();
    st.leave();
    expect(st.lookupValue('inner')).toBeUndefined();
  });

  it('defines and looks up types', () => {
    const st = new SymbolTable();
    expect(st.defineType(sym('Point', 'struct'))).toBe(true);
    expect(st.lookupType('Point')).toBeDefined();
  });

  it('tracks scope depth', () => {
    const st = new SymbolTable();
    expect(st.depth).toBe(1);
    st.enter();
    expect(st.depth).toBe(2);
    st.enter();
    expect(st.depth).toBe(3);
    st.leave();
    expect(st.depth).toBe(2);
    st.leave();
    expect(st.depth).toBe(1);
  });

  it('checks hasValueInCurrentScope', () => {
    const st = new SymbolTable();
    st.defineValue(sym('x'));
    expect(st.hasValueInCurrentScope('x')).toBe(true);
    st.enter();
    expect(st.hasValueInCurrentScope('x')).toBe(false);
    expect(st.lookupValue('x')).toBeDefined();
  });
});

// ─── Resolver integration tests ───────────────────────────────────

describe('Resolver', () => {

  // ── Basic programs ────────────────────────────────────────────

  describe('basic programs', () => {
    it('accepts empty program', () => {
      expect(resolve('')).toEqual([]);
    });

    it('accepts function with no body references', () => {
      expect(resolve('fn main() {}')).toEqual([]);
    });

    it('accepts function with return statement', () => {
      expect(resolve('fn foo() -> i64 { return 42; }')).toEqual([]);
    });
  });

  // ── Variable declared then used: OK ───────────────────────────

  describe('variable declared then used', () => {
    it('allows use of a let-bound variable', () => {
      const d = resolve('fn main() { let x = 1; let y = x; }');
      expect(d).toEqual([]);
    });

    it('allows use of variable in expression', () => {
      const d = resolve('fn main() { let a = 10; let b = a + 1; }');
      expect(d).toEqual([]);
    });

    it('allows use of variable in return', () => {
      const d = resolve('fn foo() -> i64 { let x = 42; return x; }');
      expect(d).toEqual([]);
    });
  });

  // ── Undeclared variable: error ────────────────────────────────

  describe('undeclared variable', () => {
    it('detects use of undeclared variable', () => {
      const d = resolve('fn main() { let x = y; }');
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_NAME');
      expect(d[0]!.message).toContain("Undeclared variable 'y'");
    });

    it('detects undeclared variable in expression', () => {
      const d = resolve('fn main() { let x = unknown_var + 1; }');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('unknown_var');
    });

    it('detects undeclared variable in return', () => {
      const d = resolve('fn main() { return missing; }');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('missing');
    });

    it('provides suggestion for undeclared variable', () => {
      const d = resolve('fn main() { let x = oops; }');
      expect(d[0]!.suggestion).toContain('let');
    });
  });

  // ── Use before declaration: error ─────────────────────────────

  describe('use before declaration', () => {
    it('detects use of variable before its let binding', () => {
      // In the same block, using x before it's declared
      const d = resolve(`
        fn main() {
          let a = b;
          let b = 10;
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undeclared variable 'b'");
    });
  });

  // ── Duplicate declaration in same scope: error ────────────────

  describe('duplicate declarations', () => {
    it('detects duplicate let in same scope', () => {
      const d = resolve(`
        fn main() {
          let x = 1;
          let x = 2;
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Duplicate declaration");
      expect(d[0]!.message).toContain("'x'");
    });

    it('detects duplicate function declarations', () => {
      const d = resolve('fn foo() {} fn foo() {}');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Duplicate declaration");
      expect(d[0]!.message).toContain("'foo'");
    });

    it('detects duplicate type declarations', () => {
      const d = resolve('type Age = i32\ntype Age = i64');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Duplicate type declaration");
      expect(d[0]!.message).toContain("'Age'");
    });

    it('detects duplicate parameter names', () => {
      const d = resolve('fn foo(a: i32, a: i32) {}');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Duplicate parameter name");
    });
  });

  // ── Inner scope shadows outer: OK ─────────────────────────────

  describe('scope shadowing', () => {
    it('allows variable shadowing in nested block', () => {
      const d = resolve(`
        fn main() {
          let x = 1;
          if true {
            let x = 2;
          }
        }
      `);
      expect(d).toEqual([]);
    });

    it('allows shadowing across function boundaries', () => {
      const d = resolve(`
        fn foo() { let x = 1; }
        fn bar() { let x = 2; }
      `);
      expect(d).toEqual([]);
    });
  });

  // ── Function parameters accessible in body: OK ────────────────

  describe('function parameter scope', () => {
    it('parameters are accessible in function body', () => {
      const d = resolve(`
        fn add(a: i64, b: i64) -> i64 {
          return a + b;
        }
      `);
      expect(d).toEqual([]);
    });

    it('parameters are not accessible outside function', () => {
      const d = resolve(`
        fn foo(x: i64) {}
        fn bar() { let y = x; }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undeclared variable 'x'");
    });
  });

  // ── Struct fields accessible via dot notation: OK ─────────────

  describe('struct field access', () => {
    it('accepts valid struct construction', () => {
      const d = resolve(`
        type Point { x: i64, y: i64 }
        fn main() {
          let p = Point { x: 1, y: 2 };
        }
      `);
      expect(d).toEqual([]);
    });

    it('detects unknown field in struct construction', () => {
      const d = resolve(`
        type Point { x: i64, y: i64 }
        fn main() {
          let p = Point { x: 1, z: 2 };
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("no field named 'z'");
    });

    it('detects undeclared struct type in construction', () => {
      const d = resolve(`
        fn main() {
          let p = UnknownType { x: 1 };
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undeclared type 'UnknownType'");
    });

    it('allows field access on variables', () => {
      const d = resolve(`
        type Point { x: i64, y: i64 }
        fn main() {
          let p = Point { x: 1, y: 2 };
          let val = p.x;
        }
      `);
      expect(d).toEqual([]);
    });
  });

  // ── Actor message handler scope: OK ───────────────────────────

  describe('actor scope', () => {
    it('resolves actor state and handler bodies', () => {
      const d = resolve(`
        actor Counter {
          state count: i64 = 0

          on increment() {
            count += 1;
          }
        }
      `);
      expect(d).toEqual([]);
    });

    it('handler parameters are accessible in handler body', () => {
      const d = resolve(`
        actor Greeter {
          state name: String = "world"

          on greet(who: String) {
            name = who;
          }
        }
      `);
      expect(d).toEqual([]);
    });

    it('actor functions can access state', () => {
      const d = resolve(`
        actor Counter {
          state count: i64 = 0

          fn get_count() -> i64 {
            return count;
          }
        }
      `);
      expect(d).toEqual([]);
    });
  });

  // ── If/else branches create scopes: OK ────────────────────────

  describe('if/else scoping', () => {
    it('variables declared in if block are not visible outside', () => {
      const d = resolve(`
        fn main() {
          if true {
            let inner = 1;
          }
          let x = inner;
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undeclared variable 'inner'");
    });

    it('variables declared in else block are not visible outside', () => {
      const d = resolve(`
        fn main() {
          if true {
          } else {
            let inner = 1;
          }
          let x = inner;
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undeclared variable 'inner'");
    });

    it('if condition can reference outer variables', () => {
      const d = resolve(`
        fn main() {
          let flag = true;
          if flag {
            let x = 1;
          }
        }
      `);
      expect(d).toEqual([]);
    });
  });

  // ── For loop scoping ──────────────────────────────────────────

  describe('for loop scoping', () => {
    it('loop variable is accessible in body', () => {
      const d = resolve(`
        fn main() {
          let items = 10;
          for item in items {
            let x = item;
          }
        }
      `);
      expect(d).toEqual([]);
    });

    it('loop variable is not accessible outside', () => {
      const d = resolve(`
        fn main() {
          let items = 10;
          for item in items {
          }
          let x = item;
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undeclared variable 'item'");
    });
  });

  // ── Match statement scoping ───────────────────────────────────

  describe('match scoping', () => {
    it('match bindings are accessible in arm body', () => {
      const d = resolve(`
        enum Color { Red, Green, Blue }
        fn main() {
          let c = Red;
          match c {
            x => { let y = x; }
          }
        }
      `);
      expect(d).toEqual([]);
    });

    it('match bindings are not accessible outside', () => {
      const d = resolve(`
        enum Color { Red, Green, Blue }
        fn main() {
          let c = Red;
          match c {
            x => {}
          }
          let y = x;
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undeclared variable 'x'");
    });
  });

  // ── Forward references ────────────────────────────────────────

  describe('forward references', () => {
    it('allows calling a function declared later', () => {
      const d = resolve(`
        fn main() { foo(); }
        fn foo() {}
      `);
      expect(d).toEqual([]);
    });

    it('allows using a type declared later', () => {
      const d = resolve(`
        fn make() -> Point { return Point { x: 1, y: 2 }; }
        type Point { x: i64, y: i64 }
      `);
      expect(d).toEqual([]);
    });
  });

  // ── Type references ───────────────────────────────────────────

  describe('type references', () => {
    it('detects undeclared type in function parameter', () => {
      const d = resolve('fn foo(x: Nonexistent) {}');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undeclared type 'Nonexistent'");
    });

    it('detects undeclared type in return type', () => {
      const d = resolve('fn foo() -> Nonexistent {}');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undeclared type 'Nonexistent'");
    });

    it('accepts builtin types', () => {
      const d = resolve(`
        fn foo(a: i32, b: bool, c: String) -> f64 {
          return 1.0;
        }
      `);
      expect(d).toEqual([]);
    });

    it('detects undeclared type in let annotation', () => {
      const d = resolve('fn main() { let x: FooBar = 42; }');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("Undeclared type 'FooBar'");
    });
  });

  // ── Enum variants ─────────────────────────────────────────────

  describe('enum variants', () => {
    it('enum variants are accessible as values', () => {
      const d = resolve(`
        enum Color { Red, Green, Blue }
        fn main() {
          let c = Red;
        }
      `);
      expect(d).toEqual([]);
    });
  });

  // ── Complex / integration tests ───────────────────────────────

  describe('integration', () => {
    it('full program with structs, functions, and variables', () => {
      const d = resolve(`
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
      `);
      expect(d).toEqual([]);
    });

    it('detects multiple errors in one program', () => {
      const d = resolve(`
        fn foo() {
          let x = undefined_a;
          let y = undefined_b;
        }
      `);
      expect(d).toHaveLength(2);
      expect(d[0]!.message).toContain('undefined_a');
      expect(d[1]!.message).toContain('undefined_b');
    });

    it('block expression creates its own scope', () => {
      const d = resolve(`
        fn main() {
          let x = 1;
          let y = {
            let z = x;
          };
        }
      `);
      expect(d).toEqual([]);
    });

    it('nested function calls resolve correctly', () => {
      const d = resolve(`
        fn add(a: i64, b: i64) -> i64 { return a + b; }
        fn double(x: i64) -> i64 { return add(x, x); }
        fn main() {
          let result = double(21);
        }
      `);
      expect(d).toEqual([]);
    });

    it('all diagnostics have E_NAME error code', () => {
      const d = resolve(`
        fn main() {
          let x = a;
          let y = b;
          let z = c;
        }
      `);
      expect(d).toHaveLength(3);
      for (const diag of d) {
        expect(diag.code).toBe('E_NAME');
      }
    });

    it('contract members resolve correctly', () => {
      const d = resolve(`
        contract Token {
          state balance: i64 = 0

          fn get_balance() -> i64 {
            return balance;
          }
        }
      `);
      expect(d).toEqual([]);
    });

    it('assignment to known variable resolves', () => {
      const d = resolve(`
        fn main() {
          let mut x = 0;
          x = 42;
        }
      `);
      expect(d).toEqual([]);
    });

    it('assignment to unknown variable is caught', () => {
      const d = resolve(`
        fn main() {
          unknown = 42;
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('unknown');
    });
  });
});
