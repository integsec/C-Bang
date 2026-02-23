/**
 * Token types for the C! language.
 */

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface Span {
  start: Position;
  end: Position;
  file: string;
}

export interface Token {
  type: TokenType;
  value: string;
  span: Span;
}

export enum TokenType {
  // Literals
  IntLiteral = 'IntLiteral',
  FloatLiteral = 'FloatLiteral',
  StringLiteral = 'StringLiteral',
  BoolLiteral = 'BoolLiteral',

  // Identifiers
  Identifier = 'Identifier',
  TypeIdentifier = 'TypeIdentifier', // PascalCase

  // Keywords
  Fn = 'fn',
  Let = 'let',
  Type = 'type',
  Actor = 'actor',
  Contract = 'contract',
  Server = 'server',
  Component = 'component',
  State = 'state',
  On = 'on',
  Match = 'match',
  If = 'if',
  Else = 'else',
  For = 'for',
  In = 'in',
  Return = 'return',
  Reply = 'reply',
  Spawn = 'spawn',
  Deploy = 'deploy',
  Emit = 'emit',
  Pub = 'pub',
  Use = 'use',
  Mod = 'mod',
  Own = 'own',
  Shared = 'shared',
  Scope = 'scope',
  Parallel = 'parallel',
  Supervise = 'supervise',
  Init = 'init',
  With = 'with',
  Pure = 'pure',
  Async = 'async',
  Await = 'await',
  True = 'true',
  False = 'false',
  Mut = 'mut',
  While = 'while',
  Enum = 'enum',

  // Operators
  Plus = '+',
  Minus = '-',
  Star = '*',
  Slash = '/',
  Percent = '%',
  Eq = '==',
  NotEq = '!=',
  Lt = '<',
  Gt = '>',
  LtEq = '<=',
  GtEq = '>=',
  And = '&&',
  Or = '||',
  Not = '!',
  Assign = '=',
  PlusAssign = '+=',
  MinusAssign = '-=',
  Arrow = '->',
  FatArrow = '=>',
  ColonColon = '::',
  Dot = '.',
  DotDot = '..',
  DotDotEq = '..=',
  Pipe = '|',
  Ampersand = '&',
  Hash = '#',

  // Delimiters
  LeftParen = '(',
  RightParen = ')',
  LeftBrace = '{',
  RightBrace = '}',
  LeftBracket = '[',
  RightBracket = ']',
  Comma = ',',
  Colon = ':',
  Semicolon = ';',

  // Special
  Annotation = 'Annotation', // #[...]

  // String interpolation
  StringStart = 'StringStart',     // "text{
  StringMiddle = 'StringMiddle',   // }text{
  StringEnd = 'StringEnd',         // }text"

  // Meta
  EOF = 'EOF',
  Error = 'Error',
  Newline = 'Newline',
  Comment = 'Comment',
}

const KEYWORDS: Record<string, TokenType> = {
  fn: TokenType.Fn,
  let: TokenType.Let,
  type: TokenType.Type,
  actor: TokenType.Actor,
  contract: TokenType.Contract,
  server: TokenType.Server,
  component: TokenType.Component,
  state: TokenType.State,
  on: TokenType.On,
  match: TokenType.Match,
  if: TokenType.If,
  else: TokenType.Else,
  for: TokenType.For,
  in: TokenType.In,
  return: TokenType.Return,
  reply: TokenType.Reply,
  spawn: TokenType.Spawn,
  deploy: TokenType.Deploy,
  emit: TokenType.Emit,
  pub: TokenType.Pub,
  use: TokenType.Use,
  mod: TokenType.Mod,
  own: TokenType.Own,
  shared: TokenType.Shared,
  scope: TokenType.Scope,
  parallel: TokenType.Parallel,
  supervise: TokenType.Supervise,
  init: TokenType.Init,
  with: TokenType.With,
  pure: TokenType.Pure,
  async: TokenType.Async,
  await: TokenType.Await,
  true: TokenType.True,
  false: TokenType.False,
  mut: TokenType.Mut,
  while: TokenType.While,
  enum: TokenType.Enum,
};

export function lookupKeyword(identifier: string): TokenType {
  return KEYWORDS[identifier] ?? TokenType.Identifier;
}
