import { describe, it, expect } from 'vitest';
import { EvmGenerator } from '../src/codegen/evmgen.js';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';

function generateEvm(source: string): { bytecode: string; abi: any[] } {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const gen = new EvmGenerator();
  return gen.generate(program);
}

describe('EvmGenerator', () => {
  it('generates bytecode for contract', () => {
    const result = generateEvm(`
      contract Token {
        state supply: u256 = 0;
      }
    `);
    expect(result.bytecode).toBeTruthy();
    expect(typeof result.bytecode).toBe('string');
  });

  it('generates ABI for public functions', () => {
    const result = generateEvm(`
      contract Token {
        state supply: u256 = 0;
        pub fn totalSupply() -> u256 {
          return supply;
        }
      }
    `);
    expect(result.abi).toBeInstanceOf(Array);
    expect(result.abi.some((e: any) => e.name === 'totalSupply')).toBe(true);
  });

  it('errors on non-contract code', () => {
    expect(() => generateEvm(`fn main() { println("hello"); }`)).toThrow();
  });
});
