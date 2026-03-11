import { describe, it, expect } from 'vitest';
import { NearGenerator } from '../src/codegen/neargen.js';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';

function generateNear(source: string): Uint8Array {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const gen = new NearGenerator();
  return gen.generate(program);
}

describe('NearGenerator', () => {
  it('produces valid WASM magic number', () => {
    const wasm = generateNear(`
      contract Token {
        state supply: u128 = 0;
        pub fn get_supply() -> u128 {
          return supply;
        }
      }
    `);
    expect(wasm[0]).toBe(0x00);
    expect(wasm[1]).toBe(0x61);
    expect(wasm[2]).toBe(0x73);
    expect(wasm[3]).toBe(0x6d);
  });

  it('imports NEAR env functions', async () => {
    const wasm = generateNear(`
      contract Token {
        state supply: u128 = 0;
        pub fn get_supply() -> u128 {
          return supply;
        }
      }
    `);
    const module = await WebAssembly.compile(wasm);
    const imports = WebAssembly.Module.imports(module);
    expect(imports.some((i: any) => i.module === 'env')).toBe(true);
  });

  it('exports contract methods', async () => {
    const wasm = generateNear(`
      contract Token {
        state supply: u128 = 0;
        pub fn get_supply() -> u128 {
          return supply;
        }
      }
    `);
    const module = await WebAssembly.compile(wasm);
    const exports = WebAssembly.Module.exports(module);
    expect(exports.some((e: any) => e.name === 'get_supply')).toBe(true);
  });
});
