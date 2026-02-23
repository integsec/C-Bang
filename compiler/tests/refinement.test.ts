import { describe, it, expect } from 'vitest';
import { RefinementChecker } from '../src/checker/refinement.js';
import { Lexer } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';

function checkRefinements(source: string) {
  const lexer = new Lexer(source, 'test.cb');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program } = parser.parse();
  const checker = new RefinementChecker();
  return checker.check(program);
}

function errors(diags: ReturnType<typeof checkRefinements>) {
  return diags.filter(d => d.severity === 'error');
}

function warnings(diags: ReturnType<typeof checkRefinements>) {
  return diags.filter(d => d.severity === 'warning');
}

describe('RefinementChecker', () => {
  // ─── Valid refined type declarations ────────────────────────────

  describe('valid declarations', () => {
    it('accepts empty program', () => {
      expect(checkRefinements('')).toEqual([]);
    });

    it('accepts basic range-refined type', () => {
      const d = checkRefinements(`
        type Port = u16{1..65535}
      `);
      expect(errors(d)).toEqual([]);
    });

    it('accepts inclusive range', () => {
      const d = checkRefinements(`
        type Percentage = f64{0.0..=100.0}
      `);
      expect(errors(d)).toEqual([]);
    });

    it('accepts named len constraint on String', () => {
      const d = checkRefinements(`
        type Username = String{len: 1..50}
      `);
      expect(errors(d)).toEqual([]);
    });

    it('accepts named matches constraint on String', () => {
      const d = checkRefinements(`
        type Email = String{matches: "^[a-z]+@[a-z]+$"}
      `);
      expect(errors(d)).toEqual([]);
    });

    it('accepts multiple refined type definitions', () => {
      const d = checkRefinements(`
        type Port = u16{1..65535}
        type SmallInt = u8{0..=100}
        type Name = String{len: 1..50}
      `);
      expect(errors(d)).toEqual([]);
    });

    it('accepts i32 range', () => {
      const d = checkRefinements(`
        type Score = i32{0..=1000}
      `);
      expect(errors(d)).toEqual([]);
    });

    it('registers refined types for codegen', () => {
      const lexer = new Lexer('type Port = u16{1..65535}', 'test.cb');
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const { program } = parser.parse();
      const checker = new RefinementChecker();
      checker.check(program);
      const types = checker.getRefinedTypes();
      expect(types.has('Port')).toBe(true);
      const info = types.get('Port')!;
      expect(info.baseName).toBe('u16');
      expect(info.constraints).toHaveLength(1);
      expect(info.constraints[0]!.kind).toBe('range');
    });
  });

  // ─── Invalid range declarations ─────────────────────────────────

  describe('invalid declarations', () => {
    it('errors when lower bound exceeds upper bound', () => {
      const d = checkRefinements(`
        type Bad = u16{100..10}
      `);
      expect(errors(d)).toHaveLength(1);
      expect(errors(d)[0]!.message).toContain('lower bound');
      expect(errors(d)[0]!.message).toContain('greater than upper bound');
    });

    it('errors on len constraint for numeric type', () => {
      const d = checkRefinements(`
        type Bad = i32{len: 1..10}
      `);
      expect(errors(d)).toHaveLength(1);
      expect(errors(d)[0]!.message).toContain("'len' constraint");
      expect(errors(d)[0]!.message).toContain('i32');
    });

    it('errors on matches constraint for numeric type', () => {
      const d = checkRefinements(`
        type Bad = u16{matches: "^[0-9]+$"}
      `);
      expect(errors(d)).toHaveLength(1);
      expect(errors(d)[0]!.message).toContain("'matches' constraint");
      expect(errors(d)[0]!.message).toContain('u16');
    });
  });

  // ─── Warnings on declarations ───────────────────────────────────

  describe('declaration warnings', () => {
    it('warns when range exceeds type bounds for u8', () => {
      const d = checkRefinements(`
        type TooBig = u8{0..300}
      `);
      expect(warnings(d)).toHaveLength(1);
      expect(warnings(d)[0]!.message).toContain('upper bound');
      expect(warnings(d)[0]!.message).toContain('u8');
    });

    it('warns when range is below type minimum for unsigned', () => {
      const d = checkRefinements(`
        type Neg = u16{-10..100}
      `);
      // -10 is below u16 minimum of 0
      expect(warnings(d).some(w => w.message.includes('lower bound'))).toBe(true);
    });

    it('warns on unknown named constraint', () => {
      const d = checkRefinements(`
        type Weird = i32{size: 1..10}
      `);
      expect(warnings(d)).toHaveLength(1);
      expect(warnings(d)[0]!.message).toContain("Unknown refinement constraint 'size'");
    });
  });

  // ─── Literal checking in function bodies ────────────────────────

  describe('literal checking via named types', () => {
    it('detects value below minimum', () => {
      const d = checkRefinements(`
        type Port = u16{1..=65535}
        fn main() {
          let p: Port = 0;
        }
      `);
      expect(errors(d)).toHaveLength(1);
      expect(errors(d)[0]!.message).toContain('below minimum');
      expect(errors(d)[0]!.message).toContain('0');
    });

    it('detects value above inclusive maximum', () => {
      const d = checkRefinements(`
        type SmallInt = u8{0..=100}
        fn main() {
          let x: SmallInt = 200;
        }
      `);
      expect(errors(d)).toHaveLength(1);
      expect(errors(d)[0]!.message).toContain('exceeds maximum');
    });

    it('detects value at exclusive upper bound', () => {
      const d = checkRefinements(`
        type Below10 = i32{0..10}
        fn main() {
          let x: Below10 = 10;
        }
      `);
      // 10 is NOT less than 10, so this should error for exclusive range
      expect(errors(d)).toHaveLength(1);
      expect(errors(d)[0]!.message).toContain('not less than');
    });

    it('accepts value within range', () => {
      const d = checkRefinements(`
        type Port = u16{1..=65535}
        fn main() {
          let p: Port = 8080;
        }
      `);
      expect(errors(d)).toEqual([]);
    });

    it('accepts value at inclusive bounds', () => {
      const d = checkRefinements(`
        type Pct = i32{0..=100}
        fn main() {
          let low: Pct = 0;
          let high: Pct = 100;
        }
      `);
      expect(errors(d)).toEqual([]);
    });

    it('accepts value at exclusive lower bound', () => {
      const d = checkRefinements(`
        type Positive = i32{1..1000}
        fn main() {
          let x: Positive = 1;
        }
      `);
      expect(errors(d)).toEqual([]);
    });

    it('detects multiple violations in same function', () => {
      const d = checkRefinements(`
        type Score = i32{0..=100}
        fn main() {
          let a: Score = -5;
          let b: Score = 200;
        }
      `);
      expect(errors(d)).toHaveLength(2);
    });
  });

  // ─── Inline refined type annotations ────────────────────────────

  describe('inline refined type annotations', () => {
    it('checks literal against inline refined type', () => {
      const d = checkRefinements(`
        fn main() {
          let x: u8{1..=100} = 0;
        }
      `);
      expect(errors(d)).toHaveLength(1);
      expect(errors(d)[0]!.message).toContain('below minimum');
    });

    it('accepts valid literal for inline refined type', () => {
      const d = checkRefinements(`
        fn main() {
          let x: u8{1..=100} = 50;
        }
      `);
      expect(errors(d)).toEqual([]);
    });
  });

  // ─── Non-literal values ─────────────────────────────────────────

  describe('non-literal values', () => {
    it('does not error on variable assignment (cannot check at compile time)', () => {
      const d = checkRefinements(`
        type Port = u16{1..=65535}
        fn main() {
          let x: i32 = 42;
          let p: Port = x;
        }
      `);
      // x is not a literal — refinement checker skips it (runtime check needed)
      expect(errors(d)).toEqual([]);
    });

    it('does not error on function call result', () => {
      const d = checkRefinements(`
        type Score = i32{0..=100}
        fn get_score() -> i32 { return 50; }
        fn main() {
          let s: Score = get_score();
        }
      `);
      expect(errors(d)).toEqual([]);
    });
  });

  // ─── Control flow checking ──────────────────────────────────────

  describe('control flow', () => {
    it('checks inside if blocks', () => {
      const d = checkRefinements(`
        type Pct = i32{0..=100}
        fn main() {
          if true {
            let x: Pct = 200;
          }
        }
      `);
      expect(errors(d)).toHaveLength(1);
    });

    it('checks inside for loop bodies', () => {
      const d = checkRefinements(`
        type Small = i32{0..=10}
        fn main() {
          for i in [1, 2, 3] {
            let x: Small = 999;
          }
        }
      `);
      expect(errors(d)).toHaveLength(1);
    });

    it('checks inside match arms', () => {
      const d = checkRefinements(`
        type Byte = u8{0..=255}
        fn main() {
          let v: i32 = 1;
          match v {
            x => {
              let b: Byte = 300;
            }
          }
        }
      `);
      expect(errors(d)).toHaveLength(1);
    });
  });

  // ─── Type bounds validation ─────────────────────────────────────

  describe('type bounds', () => {
    it('warns for i8 range exceeding bounds', () => {
      const d = checkRefinements(`
        type TooWide = i8{-200..200}
      `);
      // Both bounds exceed i8 range (-128..127)
      expect(warnings(d).length).toBeGreaterThanOrEqual(2);
    });

    it('warns for u32 range with negative lower bound', () => {
      const d = checkRefinements(`
        type BadUnsigned = u32{-1..100}
      `);
      expect(warnings(d).some(w => w.message.includes('lower bound'))).toBe(true);
    });

    it('does not warn for valid i32 range', () => {
      const d = checkRefinements(`
        type ValidRange = i32{-1000..=1000}
      `);
      expect(warnings(d)).toEqual([]);
    });

    it('does not warn for valid u16 range', () => {
      const d = checkRefinements(`
        type ValidPort = u16{80..=443}
      `);
      expect(warnings(d)).toEqual([]);
    });
  });

  // ─── Named len constraint ──────────────────────────────────────

  describe('len constraint', () => {
    it('accepts len on String', () => {
      const d = checkRefinements(`
        type Name = String{len: 1..100}
      `);
      expect(errors(d)).toEqual([]);
    });

    it('rejects len on i32', () => {
      const d = checkRefinements(`
        type Bad = i32{len: 1..10}
      `);
      expect(errors(d)).toHaveLength(1);
      expect(errors(d)[0]!.message).toContain("'len'");
    });

    it('rejects len on bool', () => {
      const d = checkRefinements(`
        type Bad = bool{len: 1..10}
      `);
      expect(errors(d)).toHaveLength(1);
    });
  });

  // ─── Named matches constraint ──────────────────────────────────

  describe('matches constraint', () => {
    it('accepts matches on String with literal', () => {
      const d = checkRefinements(`
        type AlphaNum = String{matches: "^[a-zA-Z0-9]+$"}
      `);
      expect(errors(d)).toEqual([]);
    });

    it('rejects matches on numeric type', () => {
      const d = checkRefinements(`
        type Bad = i32{matches: "^[0-9]+$"}
      `);
      expect(errors(d)).toHaveLength(1);
      expect(errors(d)[0]!.message).toContain("'matches'");
    });
  });

  // ─── Negative values ───────────────────────────────────────────

  describe('negative values', () => {
    it('accepts negative literal within signed range', () => {
      const d = checkRefinements(`
        type Temp = i16{-40..=85}
        fn main() {
          let t: Temp = -20;
        }
      `);
      expect(errors(d)).toEqual([]);
    });

    it('rejects negative literal below minimum', () => {
      const d = checkRefinements(`
        type Temp = i16{-40..=85}
        fn main() {
          let t: Temp = -50;
        }
      `);
      expect(errors(d)).toHaveLength(1);
      expect(errors(d)[0]!.message).toContain('below minimum');
    });
  });

  // ─── Error codes ───────────────────────────────────────────────

  describe('error codes', () => {
    it('uses E_REFINE for errors', () => {
      const d = checkRefinements(`
        type Bad = u16{100..10}
      `);
      expect(errors(d)[0]!.code).toBe('E_REFINE');
    });

    it('uses W_REFINE for warnings', () => {
      const d = checkRefinements(`
        type Weird = i32{unknown: 1..10}
      `);
      expect(warnings(d)[0]!.code).toBe('W_REFINE');
    });
  });
});
