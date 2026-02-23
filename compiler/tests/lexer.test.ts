import { describe, it, expect } from 'vitest';
import { Lexer, TokenType } from '../src/lexer/index.js';

function lex(source: string) {
  return new Lexer(source, 'test.cb').tokenize();
}

function tokenTypes(source: string): TokenType[] {
  return lex(source)
    .filter(t => t.type !== TokenType.Comment && t.type !== TokenType.EOF)
    .map(t => t.type);
}

function tokenValues(source: string): string[] {
  return lex(source)
    .filter(t => t.type !== TokenType.Comment && t.type !== TokenType.EOF)
    .map(t => t.value);
}

describe('Lexer', () => {
  describe('keywords', () => {
    it('recognizes all keywords', () => {
      const keywords = [
        'fn', 'let', 'type', 'actor', 'contract', 'server', 'component',
        'state', 'on', 'match', 'if', 'else', 'for', 'in', 'return',
        'reply', 'spawn', 'deploy', 'emit', 'pub', 'use', 'mod',
        'own', 'shared', 'scope', 'parallel', 'supervise', 'init',
        'with', 'pure', 'async', 'await', 'mut',
      ];

      for (const kw of keywords) {
        const tokens = lex(kw);
        expect(tokens[0]!.type).toBe(kw);
        expect(tokens[0]!.value).toBe(kw);
      }
    });

    it('recognizes true and false as bool literals', () => {
      expect(tokenTypes('true false')).toEqual([
        TokenType.BoolLiteral,
        TokenType.BoolLiteral,
      ]);
    });
  });

  describe('identifiers', () => {
    it('lexes regular identifiers', () => {
      const tokens = lex('foo bar_baz _private');
      expect(tokenTypes('foo bar_baz _private')).toEqual([
        TokenType.Identifier,
        TokenType.Identifier,
        TokenType.Identifier,
      ]);
    });

    it('lexes PascalCase as TypeIdentifier', () => {
      expect(tokenTypes('User HashMap MyActor')).toEqual([
        TokenType.TypeIdentifier,
        TokenType.TypeIdentifier,
        TokenType.TypeIdentifier,
      ]);
    });

    it('distinguishes identifiers from keywords', () => {
      expect(tokenTypes('fn foo')).toEqual([TokenType.Fn, TokenType.Identifier]);
    });
  });

  describe('integers', () => {
    it('lexes decimal integers', () => {
      expect(tokenTypes('42')).toEqual([TokenType.IntLiteral]);
      expect(tokenValues('42')[0]).toBe('42');
    });

    it('lexes integers with underscores', () => {
      expect(tokenValues('1_000_000')[0]).toBe('1_000_000');
    });

    it('lexes hex integers', () => {
      expect(tokenValues('0xff')[0]).toBe('0xff');
      expect(tokenTypes('0xFF')).toEqual([TokenType.IntLiteral]);
    });

    it('lexes binary integers', () => {
      expect(tokenValues('0b1010')[0]).toBe('0b1010');
      expect(tokenTypes('0b1010')).toEqual([TokenType.IntLiteral]);
    });
  });

  describe('floats', () => {
    it('lexes decimal floats', () => {
      expect(tokenTypes('3.14')).toEqual([TokenType.FloatLiteral]);
      expect(tokenValues('3.14')[0]).toBe('3.14');
    });

    it('lexes scientific notation', () => {
      expect(tokenTypes('1.0e10')).toEqual([TokenType.FloatLiteral]);
      expect(tokenValues('1.5e-3')[0]).toBe('1.5e-3');
    });
  });

  describe('strings', () => {
    it('lexes simple strings', () => {
      expect(tokenTypes('"hello"')).toEqual([TokenType.StringLiteral]);
      expect(tokenValues('"hello"')[0]).toBe('hello');
    });

    it('handles escape sequences', () => {
      expect(tokenValues('"hello\\nworld"')[0]).toBe('hello\nworld');
      expect(tokenValues('"tab\\there"')[0]).toBe('tab\there');
      expect(tokenValues('"quote\\"here"')[0]).toBe('quote"here');
    });

    it('reports unterminated strings as errors', () => {
      expect(tokenTypes('"unterminated')).toEqual([TokenType.Error]);
    });
  });

  describe('operators', () => {
    it('lexes single-char operators', () => {
      expect(tokenTypes('+ - * / %')).toEqual([
        TokenType.Plus, TokenType.Minus, TokenType.Star,
        TokenType.Slash, TokenType.Percent,
      ]);
    });

    it('lexes comparison operators', () => {
      expect(tokenTypes('== != < > <= >=')).toEqual([
        TokenType.Eq, TokenType.NotEq, TokenType.Lt,
        TokenType.Gt, TokenType.LtEq, TokenType.GtEq,
      ]);
    });

    it('lexes logical operators', () => {
      expect(tokenTypes('&& || !')).toEqual([
        TokenType.And, TokenType.Or, TokenType.Not,
      ]);
    });

    it('lexes assignment operators', () => {
      expect(tokenTypes('= += -=')).toEqual([
        TokenType.Assign, TokenType.PlusAssign, TokenType.MinusAssign,
      ]);
    });

    it('lexes arrow operators', () => {
      expect(tokenTypes('-> =>')).toEqual([TokenType.Arrow, TokenType.FatArrow]);
    });

    it('lexes range operators', () => {
      expect(tokenTypes('.. ..=')).toEqual([TokenType.DotDot, TokenType.DotDotEq]);
    });

    it('lexes double colon', () => {
      expect(tokenTypes('::')).toEqual([TokenType.ColonColon]);
    });
  });

  describe('delimiters', () => {
    it('lexes all delimiter types', () => {
      expect(tokenTypes('( ) { } [ ] , : ;')).toEqual([
        TokenType.LeftParen, TokenType.RightParen,
        TokenType.LeftBrace, TokenType.RightBrace,
        TokenType.LeftBracket, TokenType.RightBracket,
        TokenType.Comma, TokenType.Colon, TokenType.Semicolon,
      ]);
    });
  });

  describe('comments', () => {
    it('lexes line comments', () => {
      const tokens = lex('foo // this is a comment\nbar');
      const nonComment = tokens.filter(t =>
        t.type !== TokenType.Comment && t.type !== TokenType.EOF,
      );
      expect(nonComment.map(t => t.value)).toEqual(['foo', 'bar']);
    });

    it('lexes block comments', () => {
      const tokens = lex('foo /* block comment */ bar');
      const nonComment = tokens.filter(t =>
        t.type !== TokenType.Comment && t.type !== TokenType.EOF,
      );
      expect(nonComment.map(t => t.value)).toEqual(['foo', 'bar']);
    });

    it('handles nested block comments', () => {
      const tokens = lex('foo /* outer /* inner */ still comment */ bar');
      const nonComment = tokens.filter(t =>
        t.type !== TokenType.Comment && t.type !== TokenType.EOF,
      );
      expect(nonComment.map(t => t.value)).toEqual(['foo', 'bar']);
    });
  });

  describe('annotations', () => {
    it('lexes simple annotations', () => {
      const tokens = lex('#[pub]');
      expect(tokens[0]!.type).toBe(TokenType.Annotation);
      expect(tokens[0]!.value).toBe('#[pub]');
    });

    it('lexes annotations with arguments', () => {
      const tokens = lex('#[get("/users/:id")]');
      expect(tokens[0]!.type).toBe(TokenType.Annotation);
    });

    it('lexes intent annotations', () => {
      const tokens = lex('#[intent("Transfer tokens between accounts")]');
      expect(tokens[0]!.type).toBe(TokenType.Annotation);
      expect(tokens[0]!.value).toContain('intent');
    });
  });

  describe('position tracking', () => {
    it('tracks line and column', () => {
      const tokens = lex('foo\nbar');
      const foo = tokens[0]!;
      const bar = tokens[1]!;
      expect(foo.span.start.line).toBe(1);
      expect(foo.span.start.column).toBe(1);
      expect(bar.span.start.line).toBe(2);
      expect(bar.span.start.column).toBe(1);
    });
  });

  describe('additional operators and tokens', () => {
    it('lexes ampersand token', () => {
      expect(tokenTypes('&')).toEqual([TokenType.Ampersand]);
    });

    it('lexes pipe token', () => {
      expect(tokenTypes('|')).toEqual([TokenType.Pipe]);
    });

    it('lexes dot token', () => {
      expect(tokenTypes('.')).toEqual([TokenType.Dot]);
    });

    it('lexes exclamation as not operator', () => {
      expect(tokenTypes('!')).toEqual([TokenType.Not]);
    });
  });

  describe('additional string edge cases', () => {
    it('lexes empty string', () => {
      expect(tokenTypes('""')).toEqual([TokenType.StringLiteral]);
      expect(tokenValues('""')[0]).toBe('');
    });

    it('lexes string with backslash escape', () => {
      expect(tokenValues('"path\\\\to\\\\file"')[0]).toBe('path\\to\\file');
    });

    it('lexes string with null byte escape', () => {
      // \0 is a recognized escape representing a null byte (character code 0)
      expect(tokenValues('"null\\0byte"')[0]).toBe('null\0byte');
    });
  });

  describe('additional number edge cases', () => {
    it('lexes zero', () => {
      expect(tokenValues('0')[0]).toBe('0');
      expect(tokenTypes('0')).toEqual([TokenType.IntLiteral]);
    });

    it('lexes large integer', () => {
      expect(tokenValues('999999999999')[0]).toBe('999999999999');
    });

    it('lexes hex with underscores', () => {
      expect(tokenValues('0xFF_FF')[0]).toBe('0xFF_FF');
    });

    it('lexes float without integer part after dot', () => {
      // 0.0 should be a float
      expect(tokenTypes('0.0')).toEqual([TokenType.FloatLiteral]);
    });
  });

  describe('deploy keyword', () => {
    it('recognizes deploy as keyword', () => {
      const tokens = lex('deploy');
      expect(tokens[0]!.type).toBe('deploy');
    });
  });

  describe('position tracking extended', () => {
    it('tracks positions across multiple lines', () => {
      const tokens = lex('fn\n  main\n    ()');
      const fn_ = tokens[0]!;
      const main = tokens[1]!;
      const lparen = tokens[2]!;
      expect(fn_.span.start.line).toBe(1);
      expect(fn_.span.start.column).toBe(1);
      expect(main.span.start.line).toBe(2);
      expect(main.span.start.column).toBe(3);
      expect(lparen.span.start.line).toBe(3);
      expect(lparen.span.start.column).toBe(5);
    });

    it('tracks end positions', () => {
      const tokens = lex('hello');
      const tok = tokens[0]!;
      expect(tok.span.start.column).toBe(1);
      expect(tok.span.end.column).toBe(6);
    });
  });

  describe('error tokens', () => {
    it('produces error for unknown characters', () => {
      const tokens = lex('`');
      expect(tokens[0]!.type).toBe(TokenType.Error);
    });

    it('reports unterminated block comment as error token', () => {
      const tokens = lex('/* unterminated');
      const errors = tokens.filter(t => t.type === TokenType.Error);
      expect(errors.length).toBe(1);
      expect(errors[0]!.value).toBe('unterminated block comment');
    });
  });

  describe('whitespace and formatting', () => {
    it('handles tabs and spaces correctly', () => {
      const tokens = lex('\t\tfoo\t\tbar');
      const ids = tokens.filter(t => t.type === TokenType.Identifier);
      expect(ids.map(t => t.value)).toEqual(['foo', 'bar']);
    });

    it('handles carriage returns', () => {
      const tokens = lex('foo\r\nbar');
      const ids = tokens.filter(t =>
        t.type !== TokenType.Comment && t.type !== TokenType.EOF,
      );
      expect(ids.map(t => t.value)).toEqual(['foo', 'bar']);
    });
  });

  describe('operator disambiguation', () => {
    it('distinguishes -> from - >', () => {
      expect(tokenTypes('->')).toEqual([TokenType.Arrow]);
    });

    it('distinguishes => from = >', () => {
      expect(tokenTypes('=>')).toEqual([TokenType.FatArrow]);
    });

    it('distinguishes .. from . .', () => {
      expect(tokenTypes('..')).toEqual([TokenType.DotDot]);
    });

    it('distinguishes ..= from .. =', () => {
      expect(tokenTypes('..=')).toEqual([TokenType.DotDotEq]);
    });

    it('distinguishes :: from : :', () => {
      expect(tokenTypes('::')).toEqual([TokenType.ColonColon]);
    });
  });

  describe('real C! code', () => {
    it('lexes a simple function', () => {
      const source = `fn main() {
    print("Hello from C!");
}`;
      const tokens = lex(source);
      const types = tokens
        .filter(t => t.type !== TokenType.Comment && t.type !== TokenType.EOF)
        .map(t => t.type);

      expect(types).toEqual([
        TokenType.Fn,
        TokenType.Identifier, // main
        TokenType.LeftParen,
        TokenType.RightParen,
        TokenType.LeftBrace,
        TokenType.Identifier, // print
        TokenType.LeftParen,
        TokenType.StringLiteral,
        TokenType.RightParen,
        TokenType.Semicolon,
        TokenType.RightBrace,
      ]);
    });

    it('lexes a type declaration with refinement', () => {
      const source = 'type Port = u16{1..65535}';
      const types = tokenTypes(source);
      expect(types).toEqual([
        TokenType.Type,
        TokenType.TypeIdentifier, // Port
        TokenType.Assign,
        TokenType.Identifier, // u16
        TokenType.LeftBrace,
        TokenType.IntLiteral, // 1
        TokenType.DotDot,
        TokenType.IntLiteral, // 65535
        TokenType.RightBrace,
      ]);
    });

    it('lexes an actor declaration', () => {
      const source = `actor Counter {
    state count: i64 = 0

    on Increment(by: i64) {
        count += by;
    }
}`;
      const tokens = lex(source);
      const errors = tokens.filter(t => t.type === TokenType.Error);
      expect(errors).toHaveLength(0);
    });

    it('lexes annotations with pre/post conditions', () => {
      const source = `#[pre(balances[from] >= amount)]
#[post(balances[to] == old(balances[to]) + amount)]
fn transfer(from: Address, to: Address, amount: u256) -> Result<Receipt> {}`;
      const tokens = lex(source);
      const errors = tokens.filter(t => t.type === TokenType.Error);
      expect(errors).toHaveLength(0);
    });
  });

  describe('unterminated block comments (#33)', () => {
    it('produces error for unterminated block comment', () => {
      const tokens = lex('/* this comment never ends');
      const errors = tokens.filter(t => t.type === TokenType.Error);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.value).toBe('unterminated block comment');
    });

    it('produces error for nested block comment that is still open', () => {
      // The lexer supports nested block comments (depth tracking).
      // Here the inner comment is closed but the outer one is not.
      const tokens = lex('/* nested /* comment */ still open');
      const errors = tokens.filter(t => t.type === TokenType.Error);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.value).toBe('unterminated block comment');
    });

    it('still lexes valid block comments correctly', () => {
      const tokens = lex('foo /* valid comment */ bar');
      const nonComment = tokens.filter(t =>
        t.type !== TokenType.Comment && t.type !== TokenType.EOF,
      );
      expect(nonComment.map(t => t.value)).toEqual(['foo', 'bar']);
      const comments = tokens.filter(t => t.type === TokenType.Comment);
      expect(comments).toHaveLength(1);
      expect(comments[0]!.value).toBe('/* valid comment */');
    });

    it('still lexes valid nested block comments correctly', () => {
      const tokens = lex('a /* outer /* inner */ end */ b');
      const nonComment = tokens.filter(t =>
        t.type !== TokenType.Comment && t.type !== TokenType.EOF,
      );
      expect(nonComment.map(t => t.value)).toEqual(['a', 'b']);
      const errors = tokens.filter(t => t.type === TokenType.Error);
      expect(errors).toHaveLength(0);
    });

    it('produces error when code follows unterminated block comment', () => {
      // Everything after /* is consumed into the unterminated comment
      const tokens = lex('foo /* never closed\nbar baz');
      const errors = tokens.filter(t => t.type === TokenType.Error);
      expect(errors).toHaveLength(1);
      // foo should still be lexed before the comment starts
      const ids = tokens.filter(t => t.type === TokenType.Identifier);
      expect(ids.map(t => t.value)).toEqual(['foo']);
    });
  });

  describe('null byte escape in strings (#32)', () => {
    it('handles \\0 escape as null byte in strings', () => {
      const tokens = lex('"hello\\0world"');
      expect(tokens[0]!.type).toBe(TokenType.StringLiteral);
      expect(tokens[0]!.value).toBe('hello\0world');
      expect(tokens[0]!.value.charCodeAt(5)).toBe(0);
    });

    it('handles string containing only null byte', () => {
      const tokens = lex('"\\0"');
      expect(tokens[0]!.type).toBe(TokenType.StringLiteral);
      expect(tokens[0]!.value).toBe('\0');
      expect(tokens[0]!.value.length).toBe(1);
      expect(tokens[0]!.value.charCodeAt(0)).toBe(0);
    });

    it('handles null byte alongside other escapes', () => {
      const tokens = lex('"\\n\\0\\t"');
      expect(tokens[0]!.type).toBe(TokenType.StringLiteral);
      expect(tokens[0]!.value).toBe('\n\0\t');
    });

    it('still handles \\n escape correctly', () => {
      expect(tokenValues('"line\\nbreak"')[0]).toBe('line\nbreak');
    });

    it('still handles \\t escape correctly', () => {
      expect(tokenValues('"tab\\there"')[0]).toBe('tab\there');
    });

    it('still handles \\\\ escape correctly', () => {
      expect(tokenValues('"back\\\\slash"')[0]).toBe('back\\slash');
    });

    it('still handles \\" escape correctly', () => {
      expect(tokenValues('"say\\"hello\\""')[0]).toBe('say"hello"');
    });
  });

  describe('string interpolation', () => {
    it('lexes simple interpolation "hello {name}"', () => {
      const types = tokenTypes('"hello {name}"');
      expect(types).toEqual([
        TokenType.StringStart,
        TokenType.Identifier,
        TokenType.StringEnd,
      ]);
    });

    it('StringStart contains text before interpolation', () => {
      const tokens = lex('"hello {name}"');
      expect(tokens[0]!.type).toBe(TokenType.StringStart);
      expect(tokens[0]!.value).toBe('hello ');
    });

    it('StringEnd contains text after interpolation', () => {
      const tokens = lex('"hello {name}!"');
      const end = tokens.find(t => t.type === TokenType.StringEnd);
      expect(end).toBeDefined();
      expect(end!.value).toBe('!');
    });

    it('handles multiple interpolations', () => {
      const types = tokenTypes('"{a} and {b}"');
      expect(types).toEqual([
        TokenType.StringStart,    // "" (empty before first)
        TokenType.Identifier,     // a
        TokenType.StringMiddle,   // " and "
        TokenType.Identifier,     // b
        TokenType.StringEnd,      // "" (empty after last)
      ]);
    });

    it('StringMiddle contains text between interpolations', () => {
      const tokens = lex('"{a} plus {b}"');
      const mid = tokens.find(t => t.type === TokenType.StringMiddle);
      expect(mid).toBeDefined();
      expect(mid!.value).toBe(' plus ');
    });

    it('handles expression interpolation', () => {
      const types = tokenTypes('"{x + 1}"');
      expect(types).toEqual([
        TokenType.StringStart,
        TokenType.Identifier,
        TokenType.Plus,
        TokenType.IntLiteral,
        TokenType.StringEnd,
      ]);
    });

    it('handles nested braces in interpolation', () => {
      // Expression with struct literal inside interpolation
      const types = tokenTypes('"result: {foo()}"');
      expect(types).toEqual([
        TokenType.StringStart,    // "result: "
        TokenType.Identifier,     // foo
        TokenType.LeftParen,
        TokenType.RightParen,
        TokenType.StringEnd,      // ""
      ]);
    });

    it('escaped brace produces literal brace, not interpolation', () => {
      const types = tokenTypes('"\\{not interpolation\\}"');
      expect(types).toEqual([TokenType.StringLiteral]);
      expect(tokenValues('"\\{not interpolation\\}"')[0]).toBe('{not interpolation}');
    });

    it('handles empty interpolation expression', () => {
      // Edge case: "{}" — empty string start, then immediately StringEnd
      const types = tokenTypes('"{}"');
      expect(types[0]).toBe(TokenType.StringStart);
      // The RightBrace triggers continuation, producing StringEnd
    });

    it('plain string without interpolation stays as StringLiteral', () => {
      const types = tokenTypes('"just a string"');
      expect(types).toEqual([TokenType.StringLiteral]);
    });

    it('handles interpolation at start of string', () => {
      const tokens = lex('"{name} said hi"');
      expect(tokens[0]!.type).toBe(TokenType.StringStart);
      expect(tokens[0]!.value).toBe(''); // empty before interpolation
    });

    it('handles interpolation at end of string', () => {
      const tokens = lex('"value is {x}"');
      const end = tokens.find(t => t.type === TokenType.StringEnd);
      expect(end).toBeDefined();
      expect(end!.value).toBe(''); // empty after interpolation
    });
  });
});
