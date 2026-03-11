import { describe, it, expect } from 'vitest';
import { WasmGenerator } from '../src/codegen/wasmgen.js';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';

function generateWasm(source: string): Uint8Array {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const gen = new WasmGenerator();
  return gen.generate(program);
}

async function runWasm(wasm: Uint8Array): Promise<string> {
  let output = '';
  let mem: WebAssembly.Memory | null = null;

  const module = await WebAssembly.compile(wasm);

  // fd_write uses a lazy reference to the instance's memory
  const importObject = {
    wasi_snapshot_preview1: {
      fd_write: (fd: number, iovs: number, iovsLen: number, nwritten: number) => {
        if (!mem) return 1;
        const view = new DataView(mem.buffer);
        let totalWritten = 0;
        for (let i = 0; i < iovsLen; i++) {
          const ptr = view.getUint32(iovs + i * 8, true);
          const len = view.getUint32(iovs + i * 8 + 4, true);
          const bytes = new Uint8Array(mem.buffer, ptr, len);
          output += new TextDecoder().decode(bytes);
          totalWritten += len;
        }
        view.setUint32(nwritten, totalWritten, true);
        return 0;
      },
    },
  };

  const instance = await WebAssembly.instantiate(module, importObject);
  mem = instance.exports.memory as WebAssembly.Memory;
  const start = instance.exports._start as Function;
  if (start) start();
  return output;
}

async function compileAndRun(source: string): Promise<string> {
  const wasm = generateWasm(source);
  return runWasm(wasm);
}

describe('WasmGenerator', () => {
  // ─── Binary validation ──────────────────────────────────────────

  describe('binary format', () => {
    it('produces valid WASM magic number', () => {
      const wasm = generateWasm('fn main() {}');
      expect(wasm[0]).toBe(0x00); // \0
      expect(wasm[1]).toBe(0x61); // a
      expect(wasm[2]).toBe(0x73); // s
      expect(wasm[3]).toBe(0x6d); // m
    });

    it('produces WASM version 1', () => {
      const wasm = generateWasm('fn main() {}');
      expect(wasm[4]).toBe(0x01);
      expect(wasm[5]).toBe(0x00);
      expect(wasm[6]).toBe(0x00);
      expect(wasm[7]).toBe(0x00);
    });

    it('compiles to valid WebAssembly', async () => {
      const wasm = generateWasm('fn main() {}');
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });

    it('exports _start function', async () => {
      const wasm = generateWasm('fn main() {}');
      const module = await WebAssembly.compile(wasm);
      const exports = WebAssembly.Module.exports(module);
      expect(exports.some(e => e.name === '_start')).toBe(true);
    });

    it('exports memory', async () => {
      const wasm = generateWasm('fn main() {}');
      const module = await WebAssembly.compile(wasm);
      const exports = WebAssembly.Module.exports(module);
      expect(exports.some(e => e.name === 'memory')).toBe(true);
    });

    it('imports WASI fd_write', async () => {
      const wasm = generateWasm('fn main() {}');
      const module = await WebAssembly.compile(wasm);
      const imports = WebAssembly.Module.imports(module);
      expect(imports.some(i =>
        i.module === 'wasi_snapshot_preview1' && i.name === 'fd_write'
      )).toBe(true);
    });
  });

  // ─── Hello World ────────────────────────────────────────────────

  describe('hello world', () => {
    it('prints string via print()', async () => {
      const output = await compileAndRun(`
        fn main() {
          print("Hello from C!");
        }
      `);
      expect(output).toBe('Hello from C!');
    });

    it('prints string with newline via println()', async () => {
      const output = await compileAndRun(`
        fn main() {
          println("Hello, World!");
        }
      `);
      expect(output).toBe('Hello, World!\n');
    });

    it('prints multiple strings', async () => {
      const output = await compileAndRun(`
        fn main() {
          print("Hello");
          print(", ");
          println("World!");
        }
      `);
      expect(output).toBe('Hello, World!\n');
    });
  });

  // ─── Functions ──────────────────────────────────────────────────

  describe('functions', () => {
    it('compiles multiple functions', async () => {
      const wasm = generateWasm(`
        fn helper() {}
        fn main() {}
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });

    it('calls user-defined functions', async () => {
      const wasm = generateWasm(`
        fn greet() {
          println("hi");
        }
        fn main() {
          greet();
        }
      `);
      const output = await runWasm(wasm);
      expect(output).toBe('hi\n');
    });

    it('passes arguments to functions', async () => {
      const wasm = generateWasm(`
        fn add(a: i64, b: i64) -> i64 {
          return a + b;
        }
        fn main() {
          let x: i64 = add(10, 32);
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });
  });

  // ─── Let bindings ───────────────────────────────────────────────

  describe('let bindings', () => {
    it('compiles let with integer literal', async () => {
      const wasm = generateWasm(`
        fn main() {
          let x: i64 = 42;
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });

    it('compiles let with boolean literal', async () => {
      const wasm = generateWasm(`
        fn main() {
          let b: bool = true;
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });
  });

  // ─── Arithmetic ─────────────────────────────────────────────────

  describe('arithmetic', () => {
    it('compiles arithmetic expressions', async () => {
      const wasm = generateWasm(`
        fn main() {
          let a: i64 = 1 + 2;
          let b: i64 = 10 - 3;
          let c: i64 = 4 * 5;
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });
  });

  // ─── Control flow ───────────────────────────────────────────────

  describe('control flow', () => {
    it('compiles if statement', async () => {
      const wasm = generateWasm(`
        fn main() {
          if true {
            println("yes");
          }
        }
      `);
      const output = await runWasm(wasm);
      expect(output).toBe('yes\n');
    });

    it('compiles if/else', async () => {
      const wasm = generateWasm(`
        fn main() {
          if false {
            println("no");
          } else {
            println("yes");
          }
        }
      `);
      const output = await runWasm(wasm);
      expect(output).toBe('yes\n');
    });
  });

  // ─── Generator reuse ───────────────────────────────────────────

  describe('reuse', () => {
    it('can be reused for multiple programs', async () => {
      const gen = new WasmGenerator();

      const lexer1 = new Lexer('fn main() { print("one"); }', 'a.cb');
      const parser1 = new Parser(lexer1.tokenize());
      const wasm1 = gen.generate(parser1.parse().program);

      const lexer2 = new Lexer('fn main() { print("two"); }', 'b.cb');
      const parser2 = new Parser(lexer2.tokenize());
      const wasm2 = gen.generate(parser2.parse().program);

      const out1 = await runWasm(wasm1);
      const out2 = await runWasm(wasm2);
      expect(out1).toBe('one');
      expect(out2).toBe('two');
    });
  });

  // ─── Floating point ────────────────────────────────────────────

  describe('floating point', () => {
    it('compiles float literals to f64', async () => {
      const wasm = generateWasm(`
        fn main() {
          let x: f64 = 3.14;
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });

    it('performs f64 arithmetic', async () => {
      const wasm = generateWasm(`
        fn add_floats(a: f64, b: f64) -> f64 {
          return a + b;
        }
        fn main() {
          let result: f64 = add_floats(1.5, 2.5);
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });

    it('handles float comparisons', async () => {
      const wasm = generateWasm(`
        fn main() {
          let x: f64 = 3.14;
          if x > 3.0 {
            println("big");
          }
        }
      `);
      const output = await runWasm(wasm);
      expect(output).toBe('big\n');
    });

    it('compiles f64 subtraction and multiplication', async () => {
      const wasm = generateWasm(`
        fn main() {
          let a: f64 = 10.0;
          let b: f64 = a - 3.5;
          let c: f64 = a * 2.0;
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });

    it('compiles f64 division', async () => {
      const wasm = generateWasm(`
        fn main() {
          let a: f64 = 10.0;
          let b: f64 = a / 3.0;
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });
  });

  // ─── Match expressions ─────────────────────────────────────────

  describe('match expressions', () => {
    it('compiles match on integers', async () => {
      const wasm = generateWasm(`
        fn check(x: i64) {
          match x {
            1 => println("one"),
            2 => println("two"),
            _ => println("other"),
          }
        }
        fn main() {
          check(1);
          check(2);
          check(3);
        }
      `);
      const output = await runWasm(wasm);
      expect(output).toBe('one\ntwo\nother\n');
    });

    it('compiles match on booleans', async () => {
      const wasm = generateWasm(`
        fn describe(b: bool) {
          match b {
            true => println("yes"),
            false => println("no"),
          }
        }
        fn main() {
          describe(true);
          describe(false);
        }
      `);
      const output = await runWasm(wasm);
      expect(output).toBe('yes\nno\n');
    });

    it('compiles match with wildcard', async () => {
      const wasm = generateWasm(`
        fn check(x: i64) {
          match x {
            1 => println("one"),
            _ => println("default"),
          }
        }
        fn main() {
          check(1);
          check(99);
        }
      `);
      const output = await runWasm(wasm);
      expect(output).toBe('one\ndefault\n');
    });
  });

  // ─── String interpolation ───────────────────────────────────────

  describe('string interpolation', () => {
    it('compiles string interpolation (MVP)', async () => {
      const wasm = generateWasm(`
        fn main() {
          let name = "World";
          println("Hello, {name}!");
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });
  });

  // ─── Structs ───────────────────────────────────────────────────

  describe('structs', () => {
    it('compiles struct creation', async () => {
      const wasm = generateWasm(`
        type Point {
          x: i64,
          y: i64,
        }
        fn main() {
          let p = Point { x: 10, y: 20 };
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });

    it('compiles struct field access', async () => {
      const wasm = generateWasm(`
        type Point {
          x: i64,
          y: i64,
        }
        fn main() {
          let p = Point { x: 10, y: 20 };
          let sum: i64 = p.x + p.y;
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });
  });

  // ─── Enums ─────────────────────────────────────────────────────

  describe('enums', () => {
    it('compiles enum with unit variants', async () => {
      const wasm = generateWasm(`
        enum Color {
          Red,
          Green,
          Blue,
        }
        fn main() {
          let c = Red;
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });

    it('compiles match on unit enum variants', async () => {
      const wasm = generateWasm(`
        enum Color {
          Red,
          Green,
          Blue,
        }
        fn describe(c: i64) {
          match c {
            0 => println("red"),
            1 => println("green"),
            2 => println("blue"),
            _ => println("unknown"),
          }
        }
        fn main() {
          describe(0);
        }
      `);
      const output = await runWasm(wasm);
      expect(output).toBe('red\n');
    });
  });

  // ─── Arrays and for loops ───────────────────────────────────────

  describe('arrays and for loops', () => {
    it('compiles array literal', async () => {
      const wasm = generateWasm(`
        fn main() {
          let arr = [1, 2, 3];
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });

    it('compiles for loop with range', async () => {
      const wasm = generateWasm(`
        fn main() {
          let mut sum: i64 = 0;
          for i in range(1, 4) {
            sum = sum + i;
          }
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });
  });

  // ─── Closures ──────────────────────────────────────────────────

  describe('closures', () => {
    it('compiles simple closure', async () => {
      const wasm = generateWasm(`
        fn main() {
          let double = |x: i64| -> i64 { return x * 2; };
        }
      `);
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty main function', async () => {
      const wasm = generateWasm('fn main() {}');
      const module = await WebAssembly.compile(wasm);
      expect(module).toBeDefined();
    });

    it('deduplicates string literals', () => {
      const wasm1 = generateWasm(`
        fn main() {
          print("hello");
          print("hello");
        }
      `);
      const wasm2 = generateWasm(`
        fn main() {
          print("hello");
          print("world");
        }
      `);
      // With dedup, using same string twice should produce smaller output
      expect(wasm1.length).toBeLessThan(wasm2.length);
    });
  });
});
