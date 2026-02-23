#!/usr/bin/env node

/**
 * cbang CLI — The C! compiler command-line interface.
 *
 * Usage:
 *   cbang check <file.cb>    Type-check a file
 *   cbang lex <file.cb>      Show tokens (debug)
 *   cbang parse <file.cb>    Show AST (debug)
 *   cbang run <file.cb>      Build and run
 *   cbang build <file.cb>    Compile to JS (default)
 *   cbang build --target wasm <file.cb>  Compile to WASM
 *   cbang verify <file.cb>   Run formal verification
 *   cbang --version           Show version
 *   cbang --help              Show help
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Lexer, TokenType, Parser, formatDiagnostic, createError, VERSION } from './index.js';
import { Resolver } from './semantic/index.js';
import { Checker, OwnershipChecker, RefinementChecker, IntentChecker, EffectChecker } from './checker/index.js';

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
      if (!file) {
        console.error('Error: missing file argument');
        console.error('Usage: cbang run <file.cb>');
        process.exit(1);
      }
      runCommand(file).catch(handleError);
      break;

    case 'build': {
      if (!file) {
        console.error('Error: missing file argument');
        console.error('Usage: cbang build [--target js|wasm] <file.cb>');
        process.exit(1);
      }
      const target = args.includes('--target')
        ? args[args.indexOf('--target') + 1] ?? 'js'
        : 'js';
      const buildFile = target !== 'js' && args.includes('--target')
        ? args.filter(a => a !== '--target' && a !== target).slice(1)[0] ?? file
        : file;
      buildCommand(buildFile, target).catch(handleError);
      break;
    }

    case 'repl':
      replCommand();
      break;

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
      const diag = createError('L001', `Unexpected character '${err.value}'`, err.span);
      console.error(formatDiagnostic(diag, source));
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

  const resolver = new Resolver();
  const nameDiags = resolver.resolve(program);

  if (nameDiags.length > 0) {
    for (const d of nameDiags) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  console.log(`✓ Name resolution passed`);

  const checker = new Checker();
  const typeDiags = checker.check(program);

  if (typeDiags.length > 0) {
    for (const d of typeDiags) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  console.log(`✓ Type checking passed`);

  const ownershipChecker = new OwnershipChecker();
  const ownerDiags = ownershipChecker.check(program);

  if (ownerDiags.length > 0) {
    for (const d of ownerDiags) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  console.log(`✓ Ownership analysis passed`);

  const refinementChecker = new RefinementChecker();
  const refineDiags = refinementChecker.check(program);

  const refineErrors = refineDiags.filter(d => d.severity === 'error');
  if (refineErrors.length > 0) {
    for (const d of refineErrors) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  // Show warnings but don't fail
  for (const d of refineDiags.filter(d => d.severity === 'warning')) {
    console.error(formatDiagnostic(d, source));
  }

  console.log(`✓ Refinement checking passed`);

  const intentChecker = new IntentChecker();
  const intentDiags = intentChecker.check(program);

  const intentErrors = intentDiags.filter(d => d.severity === 'error');
  if (intentErrors.length > 0) {
    for (const d of intentErrors) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  // Show warnings but don't fail
  for (const d of intentDiags.filter(d => d.severity === 'warning')) {
    console.error(formatDiagnostic(d, source));
  }

  console.log(`✓ Intent verification passed`);

  const effectChecker = new EffectChecker();
  const effectDiags = effectChecker.check(program);

  const effectErrors = effectDiags.filter(d => d.severity === 'error');
  if (effectErrors.length > 0) {
    for (const d of effectErrors) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  // Show warnings but don't fail
  for (const d of effectDiags.filter(d => d.severity === 'warning')) {
    console.error(formatDiagnostic(d, source));
  }

  console.log(`✓ Effect checking passed`);
}

async function compile(filePath: string): Promise<string> {
  const source = readSource(filePath);
  const lexer = new Lexer(source, filePath);
  const tokens = lexer.tokenize();

  const lexErrors = tokens.filter(t => t.type === TokenType.Error);
  if (lexErrors.length > 0) {
    for (const err of lexErrors) {
      const diag = createError('L001', `Unexpected character '${err.value}'`, err.span);
      console.error(formatDiagnostic(diag, source));
    }
    process.exit(1);
  }

  const parser = new Parser(tokens);
  const { program, diagnostics } = parser.parse();

  if (diagnostics.length > 0) {
    for (const d of diagnostics) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  const resolver = new Resolver();
  const nameDiags = resolver.resolve(program);

  if (nameDiags.length > 0) {
    for (const d of nameDiags) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  const checker = new Checker();
  const typeDiags = checker.check(program);

  if (typeDiags.length > 0) {
    for (const d of typeDiags) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  const ownershipChecker = new OwnershipChecker();
  const ownerDiags = ownershipChecker.check(program);

  if (ownerDiags.length > 0) {
    for (const d of ownerDiags) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  const refinementChecker = new RefinementChecker();
  const refineDiags = refinementChecker.check(program);

  const refineErrors = refineDiags.filter(d => d.severity === 'error');
  if (refineErrors.length > 0) {
    for (const d of refineErrors) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  const intentChecker = new IntentChecker();
  const intentDiags = intentChecker.check(program);

  const intentErrors = intentDiags.filter(d => d.severity === 'error');
  if (intentErrors.length > 0) {
    for (const d of intentErrors) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  const effectChecker = new EffectChecker();
  const effectDiags = effectChecker.check(program);

  const effectErrors = effectDiags.filter(d => d.severity === 'error');
  if (effectErrors.length > 0) {
    for (const d of effectErrors) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  // Code generation
  let genModule: any;
  try {
    genModule = await import('./codegen/index.js');
  } catch {
    console.error('Error: code generation is not yet available.');
    console.error('The JavaScript code generator has not been built yet.');
    process.exit(1);
  }

  const generator = new genModule.JsGenerator();
  return generator.generate(program);
}

async function compileWasm(filePath: string): Promise<Uint8Array> {
  const source = readSource(filePath);
  const lexer = new Lexer(source, filePath);
  const tokens = lexer.tokenize();

  const lexErrors = tokens.filter(t => t.type === TokenType.Error);
  if (lexErrors.length > 0) {
    for (const err of lexErrors) {
      const diag = createError('L001', `Unexpected character '${err.value}'`, err.span);
      console.error(formatDiagnostic(diag, source));
    }
    process.exit(1);
  }

  const parser = new Parser(tokens);
  const { program, diagnostics } = parser.parse();

  if (diagnostics.length > 0) {
    for (const d of diagnostics) {
      console.error(formatDiagnostic(d, source));
    }
    process.exit(1);
  }

  let genModule: any;
  try {
    genModule = await import('./codegen/index.js');
  } catch {
    console.error('Error: WASM code generation is not yet available.');
    process.exit(1);
  }

  const generator = new genModule.WasmGenerator();
  return generator.generate(program);
}

async function runCommand(filePath: string): Promise<void> {
  const jsCode = await compile(filePath);
  // Execute the generated JavaScript using Node.js
  try {
    execSync(`node -e ${JSON.stringify(jsCode)}`, {
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch (e: any) {
    if (e.status) process.exit(e.status);
    process.exit(1);
  }
}

async function buildCommand(filePath: string, target: string = 'js'): Promise<void> {
  if (target === 'wasm') {
    const wasmBytes = await compileWasm(filePath);
    const outFile = basename(filePath, '.cb') + '.wasm';
    writeFileSync(outFile, wasmBytes);
    console.log(`✓ Compiled to ${outFile} (${wasmBytes.length} bytes)`);
  } else {
    const jsCode = await compile(filePath);
    const outFile = basename(filePath, '.cb') + '.js';
    writeFileSync(outFile, jsCode, 'utf-8');
    console.log(`✓ Compiled to ${outFile}`);
  }
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
  run <file.cb>       Compile and execute
  build <file.cb>     Compile to target (default: JavaScript)
  build --target wasm <file.cb>  Compile to WebAssembly
  repl                Interactive REPL
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

function replCommand(): void {
  console.log(`cbang ${VERSION} — C! REPL`);
  console.log('Type C! expressions or statements. Use :quit to exit.\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'cbang> ',
  });

  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();
    if (input === ':quit' || input === ':q' || input === ':exit') {
      rl.close();
      return;
    }

    if (input === '') {
      rl.prompt();
      return;
    }

    if (input === ':help' || input === ':h') {
      console.log('Commands:');
      console.log('  :quit, :q     Exit the REPL');
      console.log('  :lex <expr>   Show tokens for input');
      console.log('  :ast <expr>   Show AST for input');
      console.log('  :help, :h     Show this help');
      console.log('');
      rl.prompt();
      return;
    }

    // :lex command — show tokens
    if (input.startsWith(':lex ')) {
      const src = input.slice(5);
      const lexer = new Lexer(src, '<repl>');
      const tokens = lexer.tokenize();
      for (const t of tokens) {
        if (t.type === TokenType.EOF) continue;
        console.log(`  ${t.type.padEnd(20)} ${t.value}`);
      }
      rl.prompt();
      return;
    }

    // :ast command — show AST
    if (input.startsWith(':ast ')) {
      const src = input.slice(5);
      const lexer = new Lexer(src, '<repl>');
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const { program, diagnostics } = parser.parse();
      if (diagnostics.length > 0) {
        for (const d of diagnostics) {
          console.error(formatDiagnostic(d, src));
        }
      } else {
        console.log(JSON.stringify(program, null, 2));
      }
      rl.prompt();
      return;
    }

    // Wrap input to make it parseable
    // Try as expression first, then as top-level item
    let src = input;
    let wrappedAsExpr = false;

    // If it doesn't look like a declaration, wrap in a function
    if (!input.startsWith('fn ') && !input.startsWith('type ') &&
        !input.startsWith('actor ') && !input.startsWith('enum ') &&
        !input.startsWith('pub ') && !input.startsWith('use ') &&
        !input.startsWith('contract ') && !input.startsWith('server ') &&
        !input.startsWith('component ')) {
      src = `fn __repl__() { ${input} }`;
      wrappedAsExpr = true;
    }

    const lexer = new Lexer(src, '<repl>');
    const tokens = lexer.tokenize();

    const lexErrors = tokens.filter(t => t.type === TokenType.Error);
    if (lexErrors.length > 0) {
      for (const err of lexErrors) {
        console.error(`  Error: unexpected '${err.value}'`);
      }
      rl.prompt();
      return;
    }

    const parser = new Parser(tokens);
    const { program, diagnostics } = parser.parse();

    if (diagnostics.length > 0) {
      for (const d of diagnostics) {
        console.error(formatDiagnostic(d, src));
      }
    } else {
      if (wrappedAsExpr) {
        const fn = program.items[0] as any;
        if (fn?.body?.statements) {
          for (const stmt of fn.body.statements) {
            console.log(`  ${stmt.kind}: ${JSON.stringify(stmt, null, 2).split('\n').slice(0, 5).join(' ')}`);
          }
        }
      } else {
        for (const item of program.items) {
          console.log(`  ${item.kind}: ${item.kind === 'FunctionDecl' || item.kind === 'TypeDecl' || item.kind === 'ActorDecl' || item.kind === 'EnumDecl' ? (item as any).name : '...'}`);
        }
      }
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nBye!');
    process.exit(0);
  });
}

function handleError(e: unknown): void {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

main();
