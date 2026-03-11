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
