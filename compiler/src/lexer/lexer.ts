/**
 * Lexer for the C! programming language.
 *
 * Converts raw source text into a stream of typed tokens
 * with position information for error reporting.
 */

import { type Token, TokenType, type Position, lookupKeyword } from './token.js';

export class Lexer {
  private source: string;
  private file: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(source: string, file: string = '<stdin>') {
    this.source = source;
    this.file = file;
  }

  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;
      this.scanToken();
    }

    this.tokens.push(this.makeToken(TokenType.EOF, '', this.currentPosition()));
    return this.tokens;
  }

  private scanToken(): void {
    const start = this.currentPosition();
    const ch = this.advance();

    switch (ch) {
      // Single-character tokens
      case '(': this.addToken(TokenType.LeftParen, ch, start); break;
      case ')': this.addToken(TokenType.RightParen, ch, start); break;
      case '{': this.addToken(TokenType.LeftBrace, ch, start); break;
      case '}': this.addToken(TokenType.RightBrace, ch, start); break;
      case '[': this.addToken(TokenType.LeftBracket, ch, start); break;
      case ']': this.addToken(TokenType.RightBracket, ch, start); break;
      case ',': this.addToken(TokenType.Comma, ch, start); break;
      case ';': this.addToken(TokenType.Semicolon, ch, start); break;
      case '%': this.addToken(TokenType.Percent, ch, start); break;

      // Potentially multi-character tokens
      case '+':
        if (this.match('=')) this.addToken(TokenType.PlusAssign, '+=', start);
        else this.addToken(TokenType.Plus, ch, start);
        break;

      case '-':
        if (this.match('>')) this.addToken(TokenType.Arrow, '->', start);
        else if (this.match('=')) this.addToken(TokenType.MinusAssign, '-=', start);
        else this.addToken(TokenType.Minus, ch, start);
        break;

      case '*':
        this.addToken(TokenType.Star, ch, start);
        break;

      case '/':
        if (this.match('/')) {
          this.lineComment(start);
        } else if (this.match('*')) {
          this.blockComment(start);
        } else {
          this.addToken(TokenType.Slash, ch, start);
        }
        break;

      case '=':
        if (this.match('=')) this.addToken(TokenType.Eq, '==', start);
        else if (this.match('>')) this.addToken(TokenType.FatArrow, '=>', start);
        else this.addToken(TokenType.Assign, ch, start);
        break;

      case '!':
        if (this.match('=')) this.addToken(TokenType.NotEq, '!=', start);
        else this.addToken(TokenType.Not, ch, start);
        break;

      case '<':
        if (this.match('=')) this.addToken(TokenType.LtEq, '<=', start);
        else this.addToken(TokenType.Lt, ch, start);
        break;

      case '>':
        if (this.match('=')) this.addToken(TokenType.GtEq, '>=', start);
        else this.addToken(TokenType.Gt, ch, start);
        break;

      case '&':
        if (this.match('&')) this.addToken(TokenType.And, '&&', start);
        else this.addToken(TokenType.Ampersand, '&', start);
        break;

      case '|':
        if (this.match('|')) this.addToken(TokenType.Or, '||', start);
        else this.addToken(TokenType.Pipe, '|', start);
        break;

      case ':':
        if (this.match(':')) this.addToken(TokenType.ColonColon, '::', start);
        else this.addToken(TokenType.Colon, ':', start);
        break;

      case '.':
        if (this.match('.')) {
          if (this.match('=')) this.addToken(TokenType.DotDotEq, '..=', start);
          else this.addToken(TokenType.DotDot, '..', start);
        } else {
          this.addToken(TokenType.Dot, '.', start);
        }
        break;

      case '#':
        if (this.match('[')) {
          this.annotation(start);
        } else {
          this.addToken(TokenType.Hash, ch, start);
        }
        break;

      case '"':
        this.string(start);
        break;

      default:
        if (isDigit(ch)) {
          this.number(ch, start);
        } else if (isIdentStart(ch)) {
          this.identifier(ch, start);
        } else {
          this.addToken(TokenType.Error, ch, start);
        }
    }
  }

  private lineComment(start: Position): void {
    let value = '//';
    while (!this.isAtEnd() && this.peek() !== '\n') {
      value += this.advance();
    }
    this.addToken(TokenType.Comment, value, start);
  }

  private blockComment(start: Position): void {
    let value = '/*';
    let depth = 1;
    while (!this.isAtEnd() && depth > 0) {
      if (this.peek() === '/' && this.peekNext() === '*') {
        value += this.advance();
        value += this.advance();
        depth++;
      } else if (this.peek() === '*' && this.peekNext() === '/') {
        value += this.advance();
        value += this.advance();
        depth--;
      } else {
        value += this.advance();
      }
    }
    this.addToken(TokenType.Comment, value, start);
  }

  private annotation(start: Position): void {
    let value = '#[';
    let depth = 1;
    while (!this.isAtEnd() && depth > 0) {
      const ch = this.advance();
      value += ch;
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
    }
    this.addToken(TokenType.Annotation, value, start);
  }

  private string(start: Position): void {
    let value = '';
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.advance(); // skip backslash
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case '{': value += '{'; break;
          default: value += '\\' + escaped;
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      this.addToken(TokenType.Error, value, start);
      return;
    }

    this.advance(); // closing quote
    this.addToken(TokenType.StringLiteral, value, start);
  }

  private number(first: string, start: Position): void {
    let value = first;
    let isFloat = false;

    // Check for hex (0x), binary (0b), octal (0o)
    if (first === '0' && !this.isAtEnd()) {
      const next = this.peek();
      if (next === 'x' || next === 'X') {
        value += this.advance();
        while (!this.isAtEnd() && (isHexDigit(this.peek()) || this.peek() === '_')) {
          value += this.advance();
        }
        this.addToken(TokenType.IntLiteral, value, start);
        return;
      }
      if (next === 'b' || next === 'B') {
        value += this.advance();
        while (!this.isAtEnd() && (this.peek() === '0' || this.peek() === '1' || this.peek() === '_')) {
          value += this.advance();
        }
        this.addToken(TokenType.IntLiteral, value, start);
        return;
      }
    }

    // Regular decimal number
    while (!this.isAtEnd() && (isDigit(this.peek()) || this.peek() === '_')) {
      value += this.advance();
    }

    // Decimal point
    if (!this.isAtEnd() && this.peek() === '.' && this.peekNext() !== '.') {
      isFloat = true;
      value += this.advance(); // the dot
      while (!this.isAtEnd() && (isDigit(this.peek()) || this.peek() === '_')) {
        value += this.advance();
      }
    }

    // Scientific notation
    if (!this.isAtEnd() && (this.peek() === 'e' || this.peek() === 'E')) {
      isFloat = true;
      value += this.advance();
      if (!this.isAtEnd() && (this.peek() === '+' || this.peek() === '-')) {
        value += this.advance();
      }
      while (!this.isAtEnd() && isDigit(this.peek())) {
        value += this.advance();
      }
    }

    this.addToken(isFloat ? TokenType.FloatLiteral : TokenType.IntLiteral, value, start);
  }

  private identifier(first: string, start: Position): void {
    let value = first;
    while (!this.isAtEnd() && isIdentPart(this.peek())) {
      value += this.advance();
    }

    // Check for keywords first
    const keywordType = lookupKeyword(value);
    if (keywordType === TokenType.True || keywordType === TokenType.False) {
      this.addToken(TokenType.BoolLiteral, value, start);
    } else if (keywordType !== TokenType.Identifier) {
      this.addToken(keywordType, value, start);
    } else {
      // Distinguish type identifiers (PascalCase) from regular identifiers
      // PascalCase starts with an uppercase letter (not underscore)
      const isPascalCase = value[0]! >= 'A' && value[0]! <= 'Z' && /[a-z]/.test(value);
      this.addToken(
        isPascalCase ? TokenType.TypeIdentifier : TokenType.Identifier,
        value,
        start,
      );
    }
  }

  // --- Helpers ---

  private advance(): string {
    const ch = this.source[this.pos]!;
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private peek(): string {
    return this.source[this.pos] ?? '\0';
  }

  private peekNext(): string {
    return this.source[this.pos + 1] ?? '\0';
  }

  private match(expected: string): boolean {
    if (this.isAtEnd() || this.source[this.pos] !== expected) return false;
    this.advance();
    return true;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private currentPosition(): Position {
    return { line: this.line, column: this.column, offset: this.pos };
  }

  private makeToken(type: TokenType, value: string, start: Position): Token {
    return {
      type,
      value,
      span: {
        start,
        end: this.currentPosition(),
        file: this.file,
      },
    };
  }

  private addToken(type: TokenType, value: string, start: Position): void {
    this.tokens.push(this.makeToken(type, value, start));
  }
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isHexDigit(ch: string): boolean {
  return isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}
