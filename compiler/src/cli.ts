#!/usr/bin/env node

/**
 * cbang CLI — The C! compiler command-line interface.
 *
 * Usage:
 *   cbang check <file.cb>    Type-check a file
 *   cbang lex <file.cb>      Show tokens (debug)
 *   cbang parse <file.cb>    Show AST (debug)
 *   cbang run <file.cb>      Build and run
 *   cbang build <file.cb>    Compile to target
 *   cbang verify <file.cb>   Run formal verification
 *   cbang --version           Show version
 *   cbang --help              Show help
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Lexer, TokenType, Parser, formatDiagnostic, VERSION } from './index.js';

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`cbang ${VERSION}`);
    return;
  }

  const command = args[0];
  const file = args[1];

  switch (command) {
    case 'lex':
      if (!file) {
        console.error('Error: missing file argument');
        console.error('Usage: cbang lex <file.cb>');
        process.exit(1);
      }
      lexCommand(file);
      break;

    case 'check':
      if (!file) {
        console.error('Error: missing file argument');
        process.exit(1);
      }
      checkCommand(file);
      break;

    case 'parse':
      if (!file) {
        console.error('Error: missing file argument');
        process.exit(1);
      }
      parseCommand(file);
      break;

    case 'run':
    case 'build':
    case 'verify':
    case 'audit':
      console.log(`'cbang ${command}' is not yet implemented.`);
      console.log('C! is in early development. See: https://github.com/integsec/C-Bang');
      process.exit(0);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function lexCommand(filePath: string): void {
  const source = readSource(filePath);
  const lexer = new Lexer(source, filePath);
  const tokens = lexer.tokenize();

  for (const token of tokens) {
    if (token.type === TokenType.Comment || token.type === TokenType.Newline) continue;
    const loc = `${token.span.start.line}:${token.span.start.column}`;
    const value = token.value.length > 40 ? token.value.slice(0, 40) + '...' : token.value;
    console.log(`${loc.padEnd(8)} ${token.type.padEnd(20)} ${value}`);
  }

  const errorCount = tokens.filter(t => t.type === TokenType.Error).length;
  const tokenCount = tokens.filter(t => t.type !== TokenType.Comment && t.type !== TokenType.EOF).length;
  console.log(`\n${tokenCount} tokens, ${errorCount} errors`);
}

function parseCommand(filePath: string): void {
  const source = readSource(filePath);
  const lexer = new Lexer(source, filePath);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { program, diagnostics } = parser.parse();

  if (diagnostics.length > 0) {
    for (const d of diagnostics) {
      console.error(formatDiagnostic(d, source));
    }
  }

  console.log(JSON.stringify(program, null, 2));
  console.log(`\n${program.items.length} top-level items, ${diagnostics.length} errors`);
}

function checkCommand(filePath: string): void {
  const source = readSource(filePath);
  const lexer = new Lexer(source, filePath);
  const tokens = lexer.tokenize();

  const lexErrors = tokens.filter(t => t.type === TokenType.Error);
  if (lexErrors.length > 0) {
    for (const err of lexErrors) {
      console.error(`Error at ${err.span.start.line}:${err.span.start.column}: unexpected character '${err.value}'`);
    }
    process.exit(1);
  }

  console.log(`✓ Lexing passed (${tokens.length} tokens)`);

  const parser = new Parser(tokens);
  const { program, diagnostics } = parser.parse();

  if (diagnostics.length > 0) {
    for (const d of diagnostics) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  console.log(`✓ Parsing passed (${program.items.length} top-level items)`);
  console.log('⚠ Type checker not yet implemented');
}

function readSource(filePath: string): string {
  const resolved = resolve(filePath);
  try {
    return readFileSync(resolved, 'utf-8');
  } catch {
    console.error(`Error: could not read file '${resolved}'`);
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
cbang ${VERSION} — The C! (C-Bang) compiler

USAGE:
  cbang <command> [options] [file]

COMMANDS:
  check <file.cb>     Type-check a file
  lex <file.cb>       Show tokens (debug)
  parse <file.cb>     Show AST (debug)
  run <file.cb>       Build and run      [not yet implemented]
  build <file.cb>     Compile to target  [not yet implemented]
  verify <file.cb>    Formal verification [not yet implemented]
  audit <file.cb>     Security audit     [not yet implemented]

OPTIONS:
  --version, -v       Show version
  --help, -h          Show this help

LEARN MORE:
  Website:  https://c-bang.integsec.com
  GitHub:   https://github.com/integsec/C-Bang
  Wiki:     https://github.com/integsec/C-Bang/wiki
`.trim());
}

main();
