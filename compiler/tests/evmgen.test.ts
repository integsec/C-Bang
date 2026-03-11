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

  it('generates SLOAD for state reads', () => {
    const result = generateEvm(`
      contract Token {
        state supply: u256 = 0;
        pub fn getSupply() -> u256 {
          return supply;
        }
      }
    `);
    expect(result.bytecode).toContain('54'); // SLOAD opcode
  });

  it('generates SSTORE for state writes', () => {
    const result = generateEvm(`
      contract Token {
        state supply: u256 = 0;
        pub fn setSupply(val: u256) {
          supply = val;
        }
      }
    `);
    expect(result.bytecode).toContain('55'); // SSTORE opcode
  });

  it('generates function dispatcher with CALLDATALOAD', () => {
    const result = generateEvm(`
      contract Token {
        state supply: u256 = 0;
        pub fn getSupply() -> u256 {
          return supply;
        }
        pub fn setSupply(val: u256) {
          supply = val;
        }
      }
    `);
    expect(result.bytecode).toContain('35'); // CALLDATALOAD
    expect(result.bytecode).toContain('14'); // EQ for selector comparison
    expect(result.bytecode).toContain('57'); // JUMPI
  });

  it('generates ABI with correct mutability', () => {
    const result = generateEvm(`
      contract Token {
        state supply: u256 = 0;
        pub fn getSupply() -> u256 {
          return supply;
        }
        pub fn setSupply(val: u256) {
          supply = val;
        }
      }
    `);
    const getter = result.abi.find((e: any) => e.name === 'getSupply');
    const setter = result.abi.find((e: any) => e.name === 'setSupply');
    expect(getter.stateMutability).toBe('view');
    expect(setter.stateMutability).toBe('nonpayable');
  });

  it('generates arithmetic opcodes', () => {
    const result = generateEvm(`
      contract Math {
        state value: u256 = 0;
        pub fn add(a: u256, b: u256) -> u256 {
          return a + b;
        }
      }
    `);
    expect(result.bytecode).toContain('01'); // ADD
  });

  it('generates JUMPI for conditionals', () => {
    const result = generateEvm(`
      contract Guard {
        state locked: bool = false;
        pub fn check() -> u256 {
          if locked {
            return 0;
          }
          return 1;
        }
      }
    `);
    expect(result.bytecode).toContain('57'); // JUMPI
    expect(result.bytecode).toContain('5b'); // JUMPDEST
  });

  it('generates LOG for events', () => {
    const result = generateEvm(`
      contract Token {
        state supply: u256 = 0;
        pub fn mint(amount: u256) {
          supply = supply + amount;
          emit Transfer(amount);
        }
      }
    `);
    // Should have LOG opcode
    expect(result.bytecode).toContain('a1'); // LOG1
  });

  it('generates while loop opcodes', () => {
    const result = generateEvm(`
      contract Counter {
        state count: u256 = 0;
        pub fn loop_test() {
          while count > 0 {
            count = count - 1;
          }
        }
      }
    `);
    expect(result.bytecode).toContain('5b'); // JUMPDEST (loop top)
    expect(result.bytecode).toContain('56'); // JUMP (back to top)
    expect(result.bytecode).toContain('57'); // JUMPI (exit condition)
  });

  it('generates subtraction and multiplication', () => {
    const result = generateEvm(`
      contract Math {
        state value: u256 = 0;
        pub fn compute(a: u256, b: u256) -> u256 {
          return a * b - a;
        }
      }
    `);
    expect(result.bytecode).toContain('02'); // MUL
    expect(result.bytecode).toContain('03'); // SUB
  });
});
