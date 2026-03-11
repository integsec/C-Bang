import { describe, it, expect } from 'vitest';
import { LlvmGenerator } from '../src/codegen/llvmgen.js';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';

function generateLlvm(source: string): string {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const gen = new LlvmGenerator();
  return gen.generate(program);
}

describe('LlvmGenerator', () => {
  describe('module structure', () => {
    it('generates LLVM IR with define for main', () => {
      const ir = generateLlvm('fn main() {}');
      expect(ir).toContain('define');
      expect(ir).toContain('@main');
    });

    it('declares printf extern', () => {
      const ir = generateLlvm(`
        fn main() {
          println("hello");
        }
      `);
      expect(ir).toContain('declare');
      expect(ir).toContain('@printf');
    });
  });
});
