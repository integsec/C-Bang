/**
 * C! (C-Bang) Compiler
 *
 * The first programming language designed for AI-human collaboration
 * with security by construction.
 */

export { Lexer, TokenType } from './lexer/index.js';
export type { Token, Position, Span } from './lexer/index.js';
export { Parser } from './parser/index.js';
export type * from './ast/index.js';
export { formatDiagnostic, createError, createWarning } from './errors/index.js';

export { Checker } from './checker/index.js';
export type { Type } from './checker/types.js';

export { Resolver } from './semantic/index.js';
export { SymbolTable } from './semantic/index.js';
export type { SymbolInfo, SymbolKind } from './semantic/index.js';

export { JsGenerator } from './codegen/index.js';

export const VERSION = '0.1.0';
