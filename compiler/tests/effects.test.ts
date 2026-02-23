import { describe, it, expect } from 'vitest';
import { EffectChecker } from '../src/checker/effects.js';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';
import type { Diagnostic } from '../src/errors/index.js';

function checkEffects(source: string): Diagnostic[] {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const checker = new EffectChecker();
  return checker.check(program);
}

function errors(diags: Diagnostic[]) {
  return diags.filter(d => d.severity === 'error');
}

function warnings(diags: Diagnostic[]) {
  return diags.filter(d => d.severity === 'warning');
}

describe('EffectChecker', () => {
  // ─── Valid programs ────────────────────────────────────────

  describe('valid programs', () => {
    it('accepts pure function with no side effects', () => {
      const diags = checkEffects(`
        pure fn add(a: i64, b: i64) -> i64 {
          return a + b;
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });

    it('accepts function with declared IO effect using print', () => {
      const diags = checkEffects(`
        fn greet(name: String) with IO {
          println("hello");
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });

    it('accepts function with matching callee effects', () => {
      const diags = checkEffects(`
        fn read_data() with Database {
        }
        fn process() with Database {
          read_data();
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });

    it('accepts function with superset of callee effects', () => {
      const diags = checkEffects(`
        fn read_db() with Database {
        }
        fn handler() with IO, Database, Network {
          read_db();
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });

    it('accepts function with no effects calling pure function', () => {
      const diags = checkEffects(`
        pure fn add(a: i64, b: i64) -> i64 {
          return a + b;
        }
        fn main() {
          let x: i64 = add(1, 2);
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });

    it('accepts pure function calling another pure function', () => {
      const diags = checkEffects(`
        pure fn double(x: i64) -> i64 {
          return x + x;
        }
        pure fn quadruple(x: i64) -> i64 {
          return double(double(x));
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });

    it('accepts function with no effects and no calls', () => {
      const diags = checkEffects(`
        fn main() {
          let x: i64 = 42;
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });
  });

  // ─── Pure function violations ──────────────────────────────

  describe('pure function violations', () => {
    it('errors when pure function calls print', () => {
      const diags = checkEffects(`
        pure fn bad() {
          print("hello");
        }
      `);
      expect(errors(diags)).toHaveLength(1);
      expect(errors(diags)[0]!.message).toContain('Pure function');
      expect(errors(diags)[0]!.message).toContain('print');
    });

    it('errors when pure function calls println', () => {
      const diags = checkEffects(`
        pure fn bad() {
          println("hello");
        }
      `);
      expect(errors(diags)).toHaveLength(1);
      expect(errors(diags)[0]!.message).toContain('Pure function');
    });

    it('errors when pure function calls effectful function', () => {
      const diags = checkEffects(`
        fn save() with Database {
        }
        pure fn bad() {
          save();
        }
      `);
      expect(errors(diags)).toHaveLength(1);
      expect(errors(diags)[0]!.message).toContain('Pure function');
      expect(errors(diags)[0]!.message).toContain('save');
    });

    it('errors when pure function declares effects', () => {
      const diags = checkEffects(`
        pure fn bad() with IO {
        }
      `);
      expect(errors(diags)).toHaveLength(1);
      expect(errors(diags)[0]!.message).toContain('cannot declare effects');
    });
  });

  // ─── Missing effect declarations ───────────────────────────

  describe('missing effect declarations', () => {
    it('errors when function calls IO without declaring it', () => {
      const diags = checkEffects(`
        fn greet() {
          println("hi");
        }
      `);
      expect(errors(diags)).toHaveLength(1);
      expect(errors(diags)[0]!.message).toContain("does not declare 'with IO'");
    });

    it('errors when function calls effectful function without declaring effect', () => {
      const diags = checkEffects(`
        fn query() with Database {
        }
        fn handler() {
          query();
        }
      `);
      expect(errors(diags)).toHaveLength(1);
      expect(errors(diags)[0]!.message).toContain('Database');
    });

    it('errors for each missing effect separately', () => {
      const diags = checkEffects(`
        fn fetch_and_save() with Network, Database {
        }
        fn handler() {
          fetch_and_save();
        }
      `);
      expect(errors(diags)).toHaveLength(2);
    });

    it('errors when caller has partial effects', () => {
      const diags = checkEffects(`
        fn fetch_and_save() with Network, Database {
        }
        fn handler() with Network {
          fetch_and_save();
        }
      `);
      expect(errors(diags)).toHaveLength(1);
      expect(errors(diags)[0]!.message).toContain('Database');
    });
  });

  // ─── Control flow effect tracking ──────────────────────────

  describe('control flow', () => {
    it('checks effects inside if branches', () => {
      const diags = checkEffects(`
        pure fn bad(x: bool) {
          if x {
            print("yes");
          }
        }
      `);
      expect(errors(diags)).toHaveLength(1);
    });

    it('checks effects inside while loops', () => {
      const diags = checkEffects(`
        pure fn bad() {
          while true {
            println("loop");
          }
        }
      `);
      expect(errors(diags)).toHaveLength(1);
    });

    it('checks effects in let initializers', () => {
      const diags = checkEffects(`
        fn get_value() with Database {
        }
        fn handler() {
          let x: i64 = get_value();
        }
      `);
      expect(errors(diags)).toHaveLength(1);
    });
  });

  // ─── Unknown effects ──────────────────────────────────────

  describe('unknown effects', () => {
    it('warns on unknown effect name', () => {
      const diags = checkEffects(`
        fn foo() with Unicorn {
        }
      `);
      expect(warnings(diags)).toHaveLength(1);
      expect(warnings(diags)[0]!.message).toContain("Unknown effect 'Unicorn'");
    });

    it('suggests known effects', () => {
      const diags = checkEffects(`
        fn foo() with Magic {
        }
      `);
      expect(warnings(diags)[0]!.suggestion).toContain('IO');
    });

    it('accepts all known effects', () => {
      for (const eff of ['IO', 'Database', 'Network', 'FileSystem', 'Crypto', 'Random', 'Time', 'Console']) {
        const diags = checkEffects(`
          fn foo() with ${eff} {}
        `);
        expect(warnings(diags).filter(d => d.message.includes('Unknown'))).toHaveLength(0);
      }
    });
  });

  // ─── Async effects ────────────────────────────────────────

  describe('async effects', () => {
    it('async function implicitly has Async effect', () => {
      const diags = checkEffects(`
        async fn fetch() with Network {
        }
        fn handler() with Network {
          fetch();
        }
      `);
      // handler doesn't have Async, fetch is async
      expect(errors(diags)).toHaveLength(1);
      expect(errors(diags)[0]!.message).toContain('Async');
    });

    it('async function with Async declared is fine', () => {
      const diags = checkEffects(`
        async fn fetch() with Network {
        }
        fn handler() with Network, Async {
          fetch();
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });
  });

  // ─── Multiple function calls ──────────────────────────────

  describe('multiple calls', () => {
    it('tracks effects across multiple calls', () => {
      const diags = checkEffects(`
        fn read() with Database {
        }
        fn write() with IO {
        }
        fn handler() with Database, IO {
          read();
          write();
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });

    it('catches all missing effects from multiple calls', () => {
      const diags = checkEffects(`
        fn read() with Database {
        }
        fn fetch() with Network {
        }
        fn handler() {
          read();
          fetch();
        }
      `);
      expect(errors(diags)).toHaveLength(2);
    });
  });

  // ─── Nested calls ────────────────────────────────────────

  describe('nested calls', () => {
    it('checks effects in function call arguments', () => {
      const diags = checkEffects(`
        fn get_id() with Database {
        }
        pure fn process(x: i64) -> i64 {
          return x;
        }
        fn handler() with Database {
          let result: i64 = process(get_id());
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });
  });

  // ─── Error codes ──────────────────────────────────────────

  describe('error codes', () => {
    it('uses E_EFFECT for errors', () => {
      const diags = checkEffects(`
        pure fn bad() {
          print("x");
        }
      `);
      expect(errors(diags)[0]!.code).toBe('E_EFFECT');
    });

    it('uses W_EFFECT for warnings', () => {
      const diags = checkEffects(`
        fn foo() with Fantasy {}
      `);
      expect(warnings(diags)[0]!.code).toBe('W_EFFECT');
    });
  });

  // ─── Main function ────────────────────────────────────────

  describe('main function', () => {
    it('main with IO can use print', () => {
      const diags = checkEffects(`
        fn main() with IO {
          println("hello");
        }
      `);
      expect(errors(diags)).toHaveLength(0);
    });

    it('main without IO cannot use print', () => {
      const diags = checkEffects(`
        fn main() {
          println("hello");
        }
      `);
      expect(errors(diags)).toHaveLength(1);
    });
  });
});
