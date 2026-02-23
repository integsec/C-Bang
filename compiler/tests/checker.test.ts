import { describe, it, expect } from 'vitest';
import { Type, PRIMITIVES, typeEquals, typeToString } from '../src/checker/types.js';
import { Environment } from '../src/checker/environment.js';
import { registerBuiltins } from '../src/checker/builtins.js';

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
    expect(env.lookup('x')).toEqual(i32);
    expect(env.lookup('y')).toEqual(i32);
    env.leave();
    expect(env.lookup('y')).toBeUndefined();
    expect(env.lookup('x')).toEqual(i32);
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

// ─── Checker integration tests ────────────────────────────────────

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
      expect(check('type Age = i32')).toEqual([]);
    });

    it('detects duplicate type declarations', () => {
      const d = check('type Age = i32\ntype Age = i64');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('Age');
      expect(d[0]!.message).toContain('already defined');
    });

    it('registers function declarations', () => {
      expect(check('fn greet(name: String) -> String {}')).toEqual([]);
    });

    it('detects duplicate function declarations', () => {
      const d = check('fn foo() {}\nfn foo() {}');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('foo');
    });

    it('registers struct types', () => {
      expect(check('type User { name: String, age: i32 }')).toEqual([]);
    });

    it('registers union types', () => {
      expect(check('type Color = Red | Green | Blue')).toEqual([]);
    });
  });

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
      expect(d[0]!.message).toContain('Expected 1 argument');
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

  describe('assignment statements', () => {
    it('accepts compatible assignment', () => {
      expect(check('fn main() { let mut x: i64 = 0; x = 42; }')).toEqual([]);
    });
  });
});
