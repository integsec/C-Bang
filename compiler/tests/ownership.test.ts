import { describe, it, expect } from 'vitest';
import { OwnershipChecker } from '../src/checker/ownership.js';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';

function checkOwnership(source: string) {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const checker = new OwnershipChecker();
  return checker.check(program);
}

describe('OwnershipChecker', () => {
  // ─── Basic ownership (no errors) ────────────────────────────────

  describe('valid programs', () => {
    it('accepts empty program', () => {
      expect(checkOwnership('')).toEqual([]);
    });

    it('accepts function with primitive variables', () => {
      const d = checkOwnership(`
        fn main() {
          let x: i32 = 42;
          let y: i32 = x;
          let z: i32 = x;
        }
      `);
      expect(d).toEqual([]);
    });

    it('accepts multiple reads of a primitive value', () => {
      const d = checkOwnership(`
        fn add(a: i32, b: i32) -> i32 {
          return a + b;
        }
      `);
      expect(d).toEqual([]);
    });

    it('accepts single move of a struct value', () => {
      const d = checkOwnership(`
        type User { name: String, age: i32 }
        fn consume(u: User) {}
        fn main() {
          let u = User { name: "Alice", age: 30 };
          consume(u);
        }
      `);
      expect(d).toEqual([]);
    });

    it('accepts bool and string as copyable', () => {
      const d = checkOwnership(`
        fn main() {
          let x: bool = true;
          let a: bool = x;
          let b: bool = x;
          let s: String = "hello";
          let s2: String = s;
          let s3: String = s;
        }
      `);
      expect(d).toEqual([]);
    });

    it('accepts reassignment to moved variable', () => {
      // After a variable is moved, you can rebind it
      // (new let binding shadows the old one)
      const d = checkOwnership(`
        type Token { value: i32 }
        fn consume(t: Token) {}
        fn main() {
          let t = Token { value: 100 };
          consume(t);
          let t = Token { value: 200 };
          consume(t);
        }
      `);
      expect(d).toEqual([]);
    });
  });

  // ─── Use after move ─────────────────────────────────────────────

  describe('use after move', () => {
    it('detects use after move of struct value', () => {
      const d = checkOwnership(`
        type Token { value: i32 }
        fn consume(t: Token) {}
        fn main() {
          let t = Token { value: 100 };
          consume(t);
          consume(t);
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
      expect(d[0]!.message).toContain("Use of moved value 't'");
    });

    it('detects read after move', () => {
      const d = checkOwnership(`
        type Data { x: i32 }
        fn take(d: Data) {}
        fn read(d: Data) -> i32 { return d.x; }
        fn main() {
          let d = Data { x: 1 };
          take(d);
          read(d);
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
    });

    it('detects use after move in let binding', () => {
      const d = checkOwnership(`
        type Resource { id: i32 }
        fn main() {
          let r = Resource { id: 1 };
          let r2 = r;
          let r3 = r;
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
      expect(d[0]!.message).toContain("'r'");
    });

    it('does NOT detect use-after-move for primitives (Copy)', () => {
      const d = checkOwnership(`
        fn add(a: i32, b: i32) -> i32 { return a + b; }
        fn main() {
          let x: i32 = 42;
          add(x, x);
          let y: i32 = x;
        }
      `);
      expect(d).toEqual([]);
    });

    it('includes helpful error notes', () => {
      const d = checkOwnership(`
        type Handle { fd: i32 }
        fn close(h: Handle) {}
        fn main() {
          let h = Handle { fd: 3 };
          close(h);
          close(h);
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.notes.length).toBeGreaterThan(0);
      expect(d[0]!.notes.some(n => n.includes('moved'))).toBe(true);
      expect(d[0]!.suggestion).toBeDefined();
    });
  });

  // ─── Scoping ────────────────────────────────────────────────────

  describe('scoping', () => {
    it('allows move in different if branches', () => {
      const d = checkOwnership(`
        type Token { value: i32 }
        fn consume(t: Token) {}
        fn main() {
          let t = Token { value: 100 };
          if true {
            consume(t);
          }
        }
      `);
      expect(d).toEqual([]);
    });

    it('tracks moves inside nested scopes', () => {
      const d = checkOwnership(`
        type Token { value: i32 }
        fn consume(t: Token) {}
        fn main() {
          let t = Token { value: 100 };
          if true {
            consume(t);
          }
          consume(t);
        }
      `);
      // t is moved inside the if branch, then used again outside
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
    });

    it('allows independent variables in different scopes', () => {
      const d = checkOwnership(`
        type Token { value: i32 }
        fn consume(t: Token) {}
        fn main() {
          if true {
            let t = Token { value: 1 };
            consume(t);
          }
          if true {
            let t = Token { value: 2 };
            consume(t);
          }
        }
      `);
      expect(d).toEqual([]);
    });
  });

  // ─── Struct expressions ─────────────────────────────────────────

  describe('struct expressions', () => {
    it('moves values into struct fields', () => {
      const d = checkOwnership(`
        type Inner { x: i32 }
        type Outer { inner: Inner }
        fn main() {
          let i = Inner { x: 1 };
          let o = Outer { inner: i };
          let o2 = Outer { inner: i };
        }
      `);
      // i is non-copyable (struct), moved into first Outer, then used again
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
    });
  });

  // ─── Return statements ──────────────────────────────────────────

  describe('return statements', () => {
    it('allows moving value on return', () => {
      const d = checkOwnership(`
        type Token { value: i32 }
        fn create() -> Token {
          let t = Token { value: 42 };
          return t;
        }
      `);
      expect(d).toEqual([]);
    });

    it('detects use after return-move', () => {
      // Note: in practice the code after return is dead, but the
      // ownership checker still catches the use-after-move
      const d = checkOwnership(`
        type Token { value: i32 }
        fn consume(t: Token) {}
        fn bad() -> Token {
          let t = Token { value: 42 };
          return t;
          consume(t);
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
    });
  });

  // ─── For loops ──────────────────────────────────────────────────

  describe('loops', () => {
    it('allows reading primitives in loops', () => {
      const d = checkOwnership(`
        fn main() {
          let x: i32 = 42;
          for i in [1, 2, 3] {
            let y: i32 = x;
          }
        }
      `);
      expect(d).toEqual([]);
    });
  });

  // ─── Match expressions ──────────────────────────────────────────

  describe('match expressions', () => {
    it('moves subject into match', () => {
      const d = checkOwnership(`
        type Token { value: i32 }
        fn consume(t: Token) {}
        fn main() {
          let t = Token { value: 42 };
          match t {
            x => {}
          }
          consume(t);
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
    });
  });

  // ─── Assignment ─────────────────────────────────────────────────

  describe('assignment', () => {
    it('moves value in assignment', () => {
      const d = checkOwnership(`
        type Token { value: i32 }
        fn consume(t: Token) {}
        fn main() {
          let mut x = Token { value: 1 };
          let y = Token { value: 2 };
          x = y;
          consume(y);
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
    });
  });

  // ─── Expressions ────────────────────────────────────────────────

  describe('expressions', () => {
    it('does not move in binary expressions (reads)', () => {
      const d = checkOwnership(`
        fn main() {
          let x: i32 = 1;
          let y: i32 = x + x + x;
        }
      `);
      expect(d).toEqual([]);
    });

    it('does not move in field access (reads)', () => {
      const d = checkOwnership(`
        type Point { x: i32, y: i32 }
        fn main() {
          let p = Point { x: 1, y: 2 };
          let a: i32 = p.x;
          let b: i32 = p.y;
        }
      `);
      expect(d).toEqual([]);
    });

    it('moves values into array literals', () => {
      const d = checkOwnership(`
        type Item { id: i32 }
        fn main() {
          let a = Item { id: 1 };
          let arr = [a];
          let arr2 = [a];
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
    });
  });

  // ─── Complex programs ───────────────────────────────────────────

  describe('complex programs', () => {
    it('accepts real-world token transfer pattern', () => {
      const d = checkOwnership(`
        type Token { amount: i32 }
        fn transfer(t: Token, to: String) {}
        fn main() {
          let t = Token { amount: 100 };
          transfer(t, "alice");
        }
      `);
      expect(d).toEqual([]);
    });

    it('rejects double-spend pattern', () => {
      const d = checkOwnership(`
        type Token { amount: i32 }
        fn transfer(t: Token, to: String) {}
        fn main() {
          let t = Token { amount: 100 };
          transfer(t, "alice");
          transfer(t, "bob");
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
      expect(d[0]!.message).toContain("'t'");
    });

    it('rejects use-after-free pattern', () => {
      const d = checkOwnership(`
        type Handle { fd: i32 }
        fn close(h: Handle) {}
        fn read(h: Handle) -> i32 { return 0; }
        fn main() {
          let h = Handle { fd: 42 };
          close(h);
          read(h);
        }
      `);
      expect(d).toHaveLength(1);
      expect(d[0]!.code).toBe('E_USE_AFTER_MOVE');
    });

    it('accepts primitive-heavy computation', () => {
      const d = checkOwnership(`
        fn fib(n: i32) -> i32 {
          if n <= 1 {
            return n;
          }
          let a: i32 = n - 1;
          let b: i32 = n - 2;
          return a + b;
        }
      `);
      expect(d).toEqual([]);
    });

    it('accepts multiple functions', () => {
      const d = checkOwnership(`
        type Widget { id: i32 }
        fn create() -> Widget {
          return Widget { id: 1 };
        }
        fn destroy(w: Widget) {}
        fn main() {
          let w = create();
          destroy(w);
        }
      `);
      expect(d).toEqual([]);
    });
  });
});
