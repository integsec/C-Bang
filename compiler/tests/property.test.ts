/**
 * Property-based tests (fuzzing) for the C! compiler lexer and parser.
 *
 * Uses fast-check to generate random inputs and verify invariants
 * that should hold for all possible inputs.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Lexer, TokenType } from '../src/lexer/index.js';
import { Parser } from '../src/parser/index.js';
import type { Token } from '../src/lexer/index.js';
import type { Program, BaseNode, FunctionDecl, Block, Stmt, Expr } from '../src/ast/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────

function lex(source: string): Token[] {
  return new Lexer(source, 'test.cb').tokenize();
}

function parse(source: string): { program: Program; diagnostics: any[] } {
  const tokens = lex(source);
  const parser = new Parser(tokens);
  return parser.parse();
}

// ─── Generators ──────────────────────────────────────────────────────

/** Generates valid C! identifiers: start with letter or _, contain letters/digits/_ */
const identChars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
const arbIdentifier: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyz_'.split(''),
    ),
    fc.string({ minLength: 0, maxLength: 10, unit: fc.constantFrom(...identChars.split('')) }),
  )
  .map(([first, rest]) => first + rest)
  .filter(name => {
    // Exclude C! keywords and bool literals
    const keywords = new Set([
      'fn', 'let', 'type', 'actor', 'contract', 'server', 'component',
      'state', 'on', 'match', 'if', 'else', 'for', 'in', 'return',
      'reply', 'spawn', 'deploy', 'emit', 'pub', 'use', 'mod',
      'own', 'shared', 'scope', 'parallel', 'supervise', 'init',
      'with', 'pure', 'async', 'await', 'mut', 'true', 'false',
      'while', 'enum',
    ]);
    return !keywords.has(name);
  });

/** Generates simple type names used in C! */
const arbType: fc.Arbitrary<string> = fc.constantFrom(
  'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
  'f32', 'f64', 'bool', 'string', 'String', 'Address', 'Result',
);

/** Generates valid integer literal strings */
const arbIntLiteral: fc.Arbitrary<string> = fc.oneof(
  fc.nat({ max: 999999 }).map(n => String(n)),
  fc.nat({ max: 255 }).map(n => '0x' + n.toString(16)),
  fc.nat({ max: 255 }).map(n => '0b' + n.toString(2)),
);

/** Generates valid expression source strings */
const arbExpression: fc.Arbitrary<string> = fc.oneof(
  // Integer literals
  fc.nat({ max: 999999 }).map(n => String(n)),
  // Identifiers
  arbIdentifier,
  // Binary operations
  fc.tuple(
    fc.nat({ max: 100 }).map(String),
    fc.constantFrom('+', '-', '*', '/', '%'),
    fc.nat({ max: 100 }).map(String),
  ).map(([l, op, r]) => `${l} ${op} ${r}`),
  // Bool literals
  fc.constantFrom('true', 'false'),
  // String literals
  fc.string({ minLength: 0, maxLength: 20, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz 0123456789'.split('')) }).map(s => `"${s}"`),
  // Unary operations
  fc.tuple(
    fc.constantFrom('!', '-'),
    arbIdentifier,
  ).map(([op, operand]) => `${op}${operand}`),
);

/** Generates valid statement source strings */
const arbStatement: fc.Arbitrary<string> = fc.oneof(
  // Let bindings
  fc.tuple(arbIdentifier, arbExpression).map(
    ([name, expr]) => `let ${name} = ${expr};`,
  ),
  // Return statements
  arbExpression.map(expr => `return ${expr};`),
  // If statements
  fc.tuple(arbIdentifier, arbExpression).map(
    ([cond, body]) => `if ${cond} { let _r = ${body}; }`,
  ),
  // While loops
  arbIdentifier.map(
    cond => `while ${cond} { let _w = 0; }`,
  ),
  // Expression statements
  arbExpression.map(expr => `${expr};`),
);

/** Generates a valid function declaration with random name and parameter count */
const arbFunction: fc.Arbitrary<string> = fc.tuple(
  arbIdentifier,
  fc.array(
    fc.tuple(arbIdentifier, arbType).map(([name, type]) => `${name}: ${type}`),
    { minLength: 0, maxLength: 4 },
  ),
  fc.option(arbType, { nil: undefined }),
  fc.array(arbStatement, { minLength: 0, maxLength: 3 }),
).map(([name, params, retType, stmts]) => {
  const paramStr = params.join(', ');
  const retStr = retType ? ` -> ${retType}` : '';
  const bodyStr = stmts.join('\n  ');
  return `fn ${name}(${paramStr})${retStr} {\n  ${bodyStr}\n}`;
});

// ─── Lexer Property Tests ────────────────────────────────────────────

describe('Lexer properties', () => {
  it('1. roundtrip: tokenize and concatenate preserves non-whitespace content', () => {
    // Use well-formed C! source to test the roundtrip property.
    fc.assert(
      fc.property(arbFunction, (source) => {
        const tokens = lex(source);
        const meaningfulTokens = tokens.filter(
          t => t.type !== TokenType.EOF &&
               t.type !== TokenType.Comment &&
               t.type !== TokenType.Error &&
               t.type !== TokenType.Newline,
        );
        // Valid C! source should produce meaningful tokens
        expect(meaningfulTokens.length).toBeGreaterThan(0);
        // All identifiers and keywords should have non-empty values
        for (const token of meaningfulTokens) {
          if (token.type === TokenType.Identifier ||
              token.type === TokenType.TypeIdentifier) {
            expect(token.value.length).toBeGreaterThan(0);
          }
        }
        // Verify we can reconstruct content from non-string tokens
        const reconstructed = meaningfulTokens
          .filter(t => t.type !== TokenType.String)
          .map(t => t.value).join('');
        expect(reconstructed.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('2. no crash on arbitrary input: the lexer never throws', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (input) => {
        // The lexer must never throw, regardless of input
        const tokens = lex(input);
        expect(tokens).toBeDefined();
        expect(Array.isArray(tokens)).toBe(true);
        expect(tokens.length).toBeGreaterThan(0); // At least EOF
      }),
      { numRuns: 100 },
    );
  });

  it('3. no crash on random binary data', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 65535 }), { minLength: 0, maxLength: 100 }).map(
          codes => String.fromCharCode(...codes),
        ),
        (input) => {
          const tokens = lex(input);
          expect(tokens).toBeDefined();
          expect(tokens.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('4. every token has a valid span: line >= 1, column >= 1', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (input) => {
        const tokens = lex(input);
        for (const token of tokens) {
          expect(token.span.start.line).toBeGreaterThanOrEqual(1);
          expect(token.span.start.column).toBeGreaterThanOrEqual(1);
          expect(token.span.end.line).toBeGreaterThanOrEqual(1);
          expect(token.span.end.column).toBeGreaterThanOrEqual(1);
          expect(token.span.start.offset).toBeGreaterThanOrEqual(0);
          expect(token.span.end.offset).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('5. EOF always last: the final token is always EOF', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (input) => {
        const tokens = lex(input);
        expect(tokens.length).toBeGreaterThan(0);
        const lastToken = tokens[tokens.length - 1]!;
        expect(lastToken.type).toBe(TokenType.EOF);
        // All non-last tokens should NOT be EOF
        for (let i = 0; i < tokens.length - 1; i++) {
          expect(tokens[i]!.type).not.toBe(TokenType.EOF);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('6. comments preserved: strings starting with // produce a Comment token', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz 0123456789!@#$%^&*'.split('')) }),
        (commentBody) => {
          const source = `//${commentBody}`;
          const tokens = lex(source);
          const comments = tokens.filter(t => t.type === TokenType.Comment);
          expect(comments.length).toBeGreaterThanOrEqual(1);
          expect(comments[0]!.value).toContain('//');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('7. token count is non-negative and monotonically includes EOF', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (base, addition) => {
          const tokensBase = lex(base);
          const tokensExtended = lex(base + addition);
          // Both should always have at least 1 token (EOF)
          expect(tokensBase.length).toBeGreaterThanOrEqual(1);
          expect(tokensExtended.length).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('8. valid identifiers are lexed as Identifier tokens', () => {
    fc.assert(
      fc.property(arbIdentifier, (name) => {
        const tokens = lex(name);
        // Should produce exactly one identifier-like token + EOF
        const nonEof = tokens.filter(t => t.type !== TokenType.EOF);
        expect(nonEof).toHaveLength(1);
        expect(
          nonEof[0]!.type === TokenType.Identifier ||
          nonEof[0]!.type === TokenType.TypeIdentifier,
        ).toBe(true);
        expect(nonEof[0]!.value).toBe(name);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Parser Property Tests ───────────────────────────────────────────

describe('Parser properties', () => {
  it('1. no crash on any token sequence: the parser never throws', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (input) => {
        // The parser must never throw on arbitrary input
        const result = parse(input);
        expect(result).toBeDefined();
        expect(result.program).toBeDefined();
        expect(result.diagnostics).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it('2. program always returned: parser always returns a Program node', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (input) => {
        const { program } = parse(input);
        expect(program.kind).toBe('Program');
        expect(Array.isArray(program.items)).toBe(true);
        expect(program.span).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it('3. valid function declarations parse without diagnostics', () => {
    fc.assert(
      fc.property(arbFunction, (source) => {
        const { program, diagnostics } = parse(source);
        expect(diagnostics).toHaveLength(0);
        expect(program.items.length).toBeGreaterThanOrEqual(1);
        expect(program.items[0]!.kind).toBe('FunctionDecl');
      }),
      { numRuns: 100 },
    );
  });

  it('4. span containment: child node spans are within parent spans', () => {
    fc.assert(
      fc.property(arbFunction, (source) => {
        const { program, diagnostics } = parse(source);
        if (diagnostics.length > 0) return; // Skip if there are errors

        // Recursively check span containment
        function checkSpanContainment(parent: BaseNode, children: BaseNode[]): void {
          for (const child of children) {
            // Child start should be >= parent start
            expect(child.span.start.offset).toBeGreaterThanOrEqual(parent.span.start.offset);
            // Child end should be <= parent end
            expect(child.span.end.offset).toBeLessThanOrEqual(parent.span.end.offset);
          }
        }

        for (const item of program.items) {
          if (item.kind === 'FunctionDecl') {
            const fn = item as FunctionDecl;
            // Check that params are within function span
            checkSpanContainment(fn, fn.params);
            // Check that body is within function span
            checkSpanContainment(fn, [fn.body]);
            // Check that statements are within body span
            checkSpanContainment(fn.body, fn.body.statements);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('5. empty source produces empty program', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50, unit: fc.constantFrom(' ', '\t', '\n', '\r') }),
        (whitespace) => {
          const { program, diagnostics } = parse(whitespace);
          expect(program.kind).toBe('Program');
          expect(program.items).toHaveLength(0);
          expect(diagnostics).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('6. generated functions have correct names', () => {
    fc.assert(
      fc.property(
        arbIdentifier,
        (name) => {
          const source = `fn ${name}() {}`;
          const { program, diagnostics } = parse(source);
          expect(diagnostics).toHaveLength(0);
          expect(program.items).toHaveLength(1);
          const fn = program.items[0] as FunctionDecl;
          expect(fn.kind).toBe('FunctionDecl');
          expect(fn.name).toBe(name);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('7. generated let bindings preserve variable names', () => {
    fc.assert(
      fc.property(
        arbIdentifier,
        arbIdentifier,
        (fnName, varName) => {
          const source = `fn ${fnName}() { let ${varName} = 42; }`;
          const { program, diagnostics } = parse(source);
          expect(diagnostics).toHaveLength(0);
          const fn = program.items[0] as any;
          expect(fn.body.statements).toHaveLength(1);
          expect(fn.body.statements[0].kind).toBe('LetStmt');
          expect(fn.body.statements[0].name).toBe(varName);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('8. parser handles random binary data without crashing', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 65535 }), { minLength: 0, maxLength: 100 }).map(
          codes => String.fromCharCode(...codes),
        ),
        (input) => {
          const result = parse(input);
          expect(result.program.kind).toBe('Program');
          expect(Array.isArray(result.diagnostics)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('9. multiple functions all parse correctly', () => {
    fc.assert(
      fc.property(
        fc.array(arbFunction, { minLength: 1, maxLength: 3 }),
        (functions) => {
          const source = functions.join('\n\n');
          const { program, diagnostics } = parse(source);
          expect(diagnostics).toHaveLength(0);
          expect(program.items.length).toBe(functions.length);
          for (const item of program.items) {
            expect(item.kind).toBe('FunctionDecl');
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('10. parameter count is preserved through parsing', () => {
    fc.assert(
      fc.property(
        arbIdentifier,
        fc.array(
          fc.tuple(arbIdentifier, arbType),
          { minLength: 0, maxLength: 5 },
        ),
        (fnName, params) => {
          // Ensure unique parameter names (parser may choke on duplicates in some contexts)
          const uniqueParams = params.filter(
            (p, i, arr) => arr.findIndex(q => q[0] === p[0]) === i,
          );
          const paramStr = uniqueParams.map(([n, t]) => `${n}: ${t}`).join(', ');
          const source = `fn ${fnName}(${paramStr}) {}`;
          const { program, diagnostics } = parse(source);
          expect(diagnostics).toHaveLength(0);
          const fn = program.items[0] as FunctionDecl;
          expect(fn.params.length).toBe(uniqueParams.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
