/**
 * WebAssembly code generator for the C! language.
 *
 * Generates WASM binary modules directly from the AST.
 * Uses WASI preview1 for I/O (fd_write to stdout).
 *
 * Currently supports:
 *   - Integer arithmetic (i32, i64) and floating-point (f64)
 *   - Function declarations and calls
 *   - Let bindings and assignments
 *   - If/else control flow
 *   - While and for loops
 *   - Return statements
 *   - println!/print! macros (via WASI fd_write)
 *   - String literals (stored in linear memory)
 *   - Boolean literals and comparisons
 */

import type {
  Program,
  TopLevelItem,
  FunctionDecl,
  Block,
  Stmt,
  Expr,
} from '../ast/index.js';

// ─── WASM binary encoding helpers ─────────────────────────────────

/** LEB128 encoding for unsigned integers. */
function encodeU32(value: number): number[] {
  const result: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    result.push(byte);
  } while (value !== 0);
  return result;
}

/** LEB128 encoding for signed integers. */
function encodeI32(value: number): number[] {
  const result: number[] = [];
  let more = true;
  while (more) {
    let byte = value & 0x7f;
    value >>= 7;
    if ((value === 0 && (byte & 0x40) === 0) || (value === -1 && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    result.push(byte);
  }
  return result;
}

/** LEB128 encoding for signed 64-bit integers (as two 32-bit parts). */
function encodeI64(value: number): number[] {
  // For values that fit in 32 bits, encode as sign-extended i32
  return encodeI32(value);
}

/** Encode an IEEE 754 double (f64) as 8 little-endian bytes. */
function encodeF64(value: number): number[] {
  const buf = new ArrayBuffer(8);
  new Float64Array(buf)[0] = value;
  return [...new Uint8Array(buf)];
}

/** Encode a UTF-8 string with length prefix. */
function encodeString(str: string): number[] {
  const bytes = new TextEncoder().encode(str);
  return [...encodeU32(bytes.length), ...bytes];
}

/** Encode a vector (length-prefixed array of items). */
function encodeVector(items: number[][]): number[] {
  return [...encodeU32(items.length), ...items.flat()];
}

/** Wrap bytes in a WASM section. */
function section(id: number, contents: number[]): number[] {
  return [id, ...encodeU32(contents.length), ...contents];
}

// ─── WASM type constants ──────────────────────────────────────────

const WASM_I32 = 0x7f;
const WASM_I64 = 0x7e;
const WASM_F64 = 0x7c;
const WASM_FUNCREF = 0x60;

// WASM opcodes
const OP = {
  unreachable: 0x00,
  nop: 0x01,
  block: 0x02,
  loop: 0x03,
  if: 0x04,
  else: 0x05,
  end: 0x0b,
  br: 0x0c,
  br_if: 0x0d,
  return: 0x0f,
  call: 0x10,
  drop: 0x1a,
  local_get: 0x20,
  local_set: 0x21,
  local_tee: 0x22,
  global_get: 0x23,
  global_set: 0x24,
  i32_load: 0x28,
  i64_load: 0x29,
  i32_store: 0x36,
  i64_store: 0x37,
  i32_const: 0x41,
  i64_const: 0x42,
  i32_eqz: 0x45,
  i32_eq: 0x46,
  i32_ne: 0x47,
  i32_lt_s: 0x48,
  i32_gt_s: 0x4a,
  i32_le_s: 0x4c,
  i32_ge_s: 0x4e,
  i64_eqz: 0x50,
  i64_eq: 0x51,
  i64_ne: 0x52,
  i64_lt_s: 0x53,
  i64_gt_s: 0x55,
  i64_le_s: 0x57,
  i64_ge_s: 0x59,
  i32_add: 0x6a,
  i32_sub: 0x6b,
  i32_mul: 0x6c,
  i32_div_s: 0x6d,
  i32_rem_s: 0x6f,
  i64_add: 0x7c,
  i64_sub: 0x7d,
  i64_mul: 0x7e,
  i64_div_s: 0x7f,
  i64_rem_s: 0x81,
  i32_and: 0x71,
  i32_or: 0x72,
  i32_xor: 0x73,
  i64_extend_i32_s: 0xac,
  i32_wrap_i64: 0xa7,
  // f64 opcodes
  f64_const: 0x44,
  f64_add: 0xa0,
  f64_sub: 0xa1,
  f64_mul: 0xa2,
  f64_div: 0xa3,
  f64_eq: 0x61,
  f64_ne: 0x62,
  f64_lt: 0x63,
  f64_gt: 0x64,
  f64_le: 0x65,
  f64_ge: 0x66,
  f64_neg: 0x9a,
  f64_sqrt: 0x9f,
  f64_floor: 0x8c,
  f64_ceil: 0x8d,
  f64_abs: 0x99,
  i64_trunc_f64_s: 0xb0,
  f64_convert_i64_s: 0xb9,
} as const;

// WASM section IDs
const SECTION = {
  type: 1,
  import: 2,
  function: 3,
  memory: 5,
  global: 6,
  export: 7,
  start: 8,
  data: 11,
} as const;

// ─── Generator ────────────────────────────────────────────────────

/** Resolve a C! type name to a WASM value type. */
function resolveWasmType(typeExpr: import('../ast/index.js').TypeExpr | null | undefined): number {
  if (typeExpr && typeExpr.kind === 'NamedType' && (typeExpr.name === 'f64' || typeExpr.name === 'float')) {
    return WASM_F64;
  }
  return WASM_I64;
}

interface WasmLocal {
  name: string;
  type: number; // WASM_I32, WASM_I64, or WASM_F64
  index: number;
}

interface WasmFunc {
  name: string;
  typeIndex: number;
  localTypes: number[];  // Additional locals (beyond params)
  body: number[];
  exported: boolean;
}

interface StringLiteral {
  offset: number;
  length: number;
  value: string;
}

export class WasmGenerator {
  // Function registry
  private functions: WasmFunc[] = [];
  private funcNames = new Map<string, number>(); // name → function index
  private importCount = 0;

  // Type registry (deduplicated function signatures)
  private types: number[][] = [];
  private typeMap = new Map<string, number>();

  // String data
  private strings: StringLiteral[] = [];
  private dataOffset = 1024; // Start string data at offset 1024

  // Current function state
  private locals: WasmLocal[] = [];
  private localMap = new Map<string, number>();
  private currentBody: number[] = [];
  private nextLocalIndex = 0;

  // ─── Main entry point ───────────────────────────────────────────

  generate(program: Program): Uint8Array {
    this.functions = [];
    this.funcNames.clear();
    this.types = [];
    this.typeMap.clear();
    this.strings = [];
    this.dataOffset = 1024;
    this.importCount = 0;

    // Register WASI fd_write import: (i32, i32, i32, i32) -> i32
    const fdWriteType = this.getOrCreateType([WASM_I32, WASM_I32, WASM_I32, WASM_I32], [WASM_I32]);
    this.importCount = 1;
    this.funcNames.set('__fd_write', 0);

    // Register user functions (first pass — signatures only)
    for (const item of program.items) {
      if (item.kind === 'FunctionDecl') {
        this.registerFunction(item);
      }
    }

    // Generate function bodies (second pass)
    for (const item of program.items) {
      if (item.kind === 'FunctionDecl') {
        this.generateFunction(item);
      }
    }

    return this.buildModule(fdWriteType);
  }

  // ─── Function registration ──────────────────────────────────────

  private registerFunction(decl: FunctionDecl): void {
    const paramTypes = decl.params.map(p => resolveWasmType(p.typeAnnotation));
    const hasReturn = decl.returnType !== null;
    const returnTypes = hasReturn ? [resolveWasmType(decl.returnType)] : [];
    const typeIndex = this.getOrCreateType(paramTypes, returnTypes);

    const funcIndex = this.importCount + this.functions.length;
    this.funcNames.set(decl.name, funcIndex);

    this.functions.push({
      name: decl.name,
      typeIndex,
      localTypes: [],
      body: [],
      exported: decl.name === 'main' || decl.public,
    });
  }

  private generateFunction(decl: FunctionDecl): void {
    const funcIndex = this.funcNames.get(decl.name)!;
    const func = this.functions[funcIndex - this.importCount]!;

    this.locals = [];
    this.localMap.clear();
    this.currentBody = [];
    this.nextLocalIndex = 0;

    // Register parameters as locals
    for (const param of decl.params) {
      this.addLocal(param.name, resolveWasmType(param.typeAnnotation));
    }

    this.emitBlock(decl.body);

    func.localTypes = this.locals.slice(decl.params.length).map(l => l.type);
    func.body = [...this.currentBody, OP.end];
  }

  // ─── Statement emission ─────────────────────────────────────────

  private emitBlock(block: Block): void {
    for (const stmt of block.statements) {
      this.emitStmt(stmt);
    }
  }

  private emitStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case 'LetStmt':
        this.emitLetStmt(stmt);
        break;
      case 'ReturnStmt':
        if (stmt.value) {
          this.emitExpr(stmt.value);
        }
        this.currentBody.push(OP.return);
        break;
      case 'ExprStmt':
        this.emitExpr(stmt.expr);
        // Drop the result if the expression leaves a value on the stack
        if (this.exprProducesValue(stmt.expr)) {
          this.currentBody.push(OP.drop);
        }
        break;
      case 'IfStmt':
        this.emitIfStmt(stmt);
        break;
      case 'WhileStmt':
        this.emitWhileStmt(stmt as any);
        break;
      case 'ForStmt':
        // For loops: simplified — emit iterable and body
        this.emitBlock(stmt.body);
        break;
      case 'AssignStmt':
        this.emitAssignStmt(stmt);
        break;
      default:
        break;
    }
  }

  private emitLetStmt(stmt: import('../ast/index.js').LetStmt): void {
    const wasmType = resolveWasmType(stmt.typeAnnotation);
    const localIdx = this.addLocal(stmt.name, wasmType);
    this.emitExpr(stmt.initializer);
    this.currentBody.push(OP.local_set, ...encodeU32(localIdx));
  }

  private emitIfStmt(stmt: import('../ast/index.js').IfStmt): void {
    this.emitExpr(stmt.condition);
    // f64 comparisons produce i32 directly (via extendBoolToI64 they become i64)
    // All conditions are i64 booleans — wrap to i32 for WASM if
    this.currentBody.push(OP.i32_wrap_i64);
    this.currentBody.push(OP.if, 0x40); // void block type
    this.emitBlock(stmt.then);
    if (stmt.else_) {
      this.currentBody.push(OP.else);
      if (stmt.else_.kind === 'IfStmt') {
        this.emitStmt(stmt.else_);
      } else {
        this.emitBlock(stmt.else_);
      }
    }
    this.currentBody.push(OP.end);
  }

  private emitWhileStmt(stmt: { condition: Expr; body: Block }): void {
    // block $break { loop $continue { br_if(!cond) $break; body; br $continue } }
    this.currentBody.push(OP.block, 0x40); // outer block
    this.currentBody.push(OP.loop, 0x40);  // inner loop
    // condition
    this.emitExpr(stmt.condition);
    this.currentBody.push(OP.i32_wrap_i64);
    this.currentBody.push(OP.i32_eqz);
    this.currentBody.push(OP.br_if, ...encodeU32(1)); // break out of block if false
    // body
    this.emitBlock(stmt.body);
    this.currentBody.push(OP.br, ...encodeU32(0)); // continue loop
    this.currentBody.push(OP.end); // end loop
    this.currentBody.push(OP.end); // end block
  }

  private emitAssignStmt(stmt: import('../ast/index.js').AssignStmt): void {
    if (stmt.target.kind === 'Ident') {
      const idx = this.localMap.get(stmt.target.name);
      if (idx === undefined) return;

      if (stmt.operator === '=' ) {
        this.emitExpr(stmt.value);
      } else {
        // Compound: x += y → x = x + y
        this.currentBody.push(OP.local_get, ...encodeU32(idx));
        this.emitExpr(stmt.value);
        switch (stmt.operator) {
          case '+=': this.currentBody.push(OP.i64_add); break;
          case '-=': this.currentBody.push(OP.i64_sub); break;
          case '*=': this.currentBody.push(OP.i64_mul); break;
          default: this.emitExpr(stmt.value); break;
        }
      }
      this.currentBody.push(OP.local_set, ...encodeU32(idx));
    }
  }

  // ─── Expression emission ────────────────────────────────────────

  private emitExpr(expr: Expr): void {
    switch (expr.kind) {
      case 'IntLiteral':
        this.currentBody.push(OP.i64_const, ...encodeI64(parseInt(expr.value, 10)));
        break;
      case 'FloatLiteral':
        this.currentBody.push(OP.f64_const, ...encodeF64(parseFloat(expr.value)));
        break;
      case 'BoolLiteral':
        this.currentBody.push(OP.i64_const, ...encodeI64(expr.value ? 1 : 0));
        break;
      case 'StringLiteral':
        this.emitStringLiteral(expr.value);
        break;
      case 'Ident':
        this.emitIdent(expr.name);
        break;
      case 'Binary':
        this.emitBinary(expr);
        break;
      case 'Unary':
        this.emitUnary(expr);
        break;
      case 'Call':
        this.emitCall(expr);
        break;
      case 'MacroCall':
        this.emitMacroCall(expr);
        break;
      default:
        // Unsupported expression — emit 0
        this.currentBody.push(OP.i64_const, ...encodeI64(0));
        break;
    }
  }

  private emitStringLiteral(value: string): void {
    const str = this.addString(value);
    // Push pointer (offset) as i64
    this.currentBody.push(OP.i64_const, ...encodeI64(str.offset));
  }

  private emitIdent(name: string): void {
    const idx = this.localMap.get(name);
    if (idx !== undefined) {
      this.currentBody.push(OP.local_get, ...encodeU32(idx));
    } else {
      // Unknown variable — push 0
      this.currentBody.push(OP.i64_const, ...encodeI64(0));
    }
  }

  private emitBinary(expr: import('../ast/index.js').BinaryExpr): void {
    const leftType = this.inferExprType(expr.left);
    const rightType = this.inferExprType(expr.right);
    const useF64 = leftType === WASM_F64 || rightType === WASM_F64;

    this.emitExpr(expr.left);
    // If mixed types, convert i64 operand to f64
    if (useF64 && leftType !== WASM_F64) {
      this.currentBody.push(OP.f64_convert_i64_s);
    }
    this.emitExpr(expr.right);
    if (useF64 && rightType !== WASM_F64) {
      this.currentBody.push(OP.f64_convert_i64_s);
    }

    if (useF64) {
      switch (expr.operator) {
        case '+':  this.currentBody.push(OP.f64_add); break;
        case '-':  this.currentBody.push(OP.f64_sub); break;
        case '*':  this.currentBody.push(OP.f64_mul); break;
        case '/':  this.currentBody.push(OP.f64_div); break;
        // f64 comparisons produce i32 — extend to i64 for our bool representation
        case '==': this.currentBody.push(OP.f64_eq); this.extendBoolToI64(); break;
        case '!=': this.currentBody.push(OP.f64_ne); this.extendBoolToI64(); break;
        case '<':  this.currentBody.push(OP.f64_lt); this.extendBoolToI64(); break;
        case '>':  this.currentBody.push(OP.f64_gt); this.extendBoolToI64(); break;
        case '<=': this.currentBody.push(OP.f64_le); this.extendBoolToI64(); break;
        case '>=': this.currentBody.push(OP.f64_ge); this.extendBoolToI64(); break;
        default: break;
      }
    } else {
      switch (expr.operator) {
        case '+':  this.currentBody.push(OP.i64_add); break;
        case '-':  this.currentBody.push(OP.i64_sub); break;
        case '*':  this.currentBody.push(OP.i64_mul); break;
        case '/':  this.currentBody.push(OP.i64_div_s); break;
        case '%':  this.currentBody.push(OP.i64_rem_s); break;
        case '==': this.currentBody.push(OP.i64_eq); this.extendBoolToI64(); break;
        case '!=': this.currentBody.push(OP.i64_ne); this.extendBoolToI64(); break;
        case '<':  this.currentBody.push(OP.i64_lt_s); this.extendBoolToI64(); break;
        case '>':  this.currentBody.push(OP.i64_gt_s); this.extendBoolToI64(); break;
        case '<=': this.currentBody.push(OP.i64_le_s); this.extendBoolToI64(); break;
        case '>=': this.currentBody.push(OP.i64_ge_s); this.extendBoolToI64(); break;
        case '&&':
          this.currentBody.push(OP.i32_wrap_i64);
          break;
        case '||':
          this.currentBody.push(OP.i64_add);
          break;
        default:
          break;
      }
    }
  }

  private emitUnary(expr: import('../ast/index.js').UnaryExpr): void {
    if (expr.operator === '-') {
      const operandType = this.inferExprType(expr.operand);
      if (operandType === WASM_F64) {
        this.emitExpr(expr.operand);
        this.currentBody.push(OP.f64_neg);
      } else {
        this.currentBody.push(OP.i64_const, ...encodeI64(0));
        this.emitExpr(expr.operand);
        this.currentBody.push(OP.i64_sub);
      }
    } else if (expr.operator === '!') {
      this.emitExpr(expr.operand);
      this.currentBody.push(OP.i64_eqz);
      this.extendBoolToI64();
    } else {
      this.emitExpr(expr.operand);
    }
  }

  private emitCall(expr: import('../ast/index.js').CallExpr): void {
    // Resolve callee name
    let calleeName: string | null = null;
    if (expr.callee.kind === 'Ident') {
      calleeName = expr.callee.name;
    } else if (expr.callee.kind === 'Path') {
      calleeName = expr.callee.segments.join('::');
    }

    // Handle built-in print/println as WASI fd_write
    if (calleeName === 'print' || calleeName === 'println') {
      const argExprs = expr.args.map(a => a.value);
      this.emitPrintln(argExprs, calleeName === 'println');
      return;
    }

    if (calleeName && this.funcNames.has(calleeName)) {
      // Emit arguments
      for (const arg of expr.args) {
        this.emitExpr(arg.value);
      }
      const funcIdx = this.funcNames.get(calleeName)!;
      this.currentBody.push(OP.call, ...encodeU32(funcIdx));
    } else {
      // Unknown function — push 0
      this.currentBody.push(OP.i64_const, ...encodeI64(0));
    }
  }

  private emitMacroCall(expr: import('../ast/index.js').MacroCallExpr): void {
    const name = expr.name;
    if (name === 'println' || name === 'print') {
      this.emitPrintln(expr.args, name === 'println');
    } else if (name === 'assert') {
      // assert! — trap if false
      if (expr.args.length > 0) {
        this.emitExpr(expr.args[0]!);
        this.currentBody.push(OP.i64_eqz);
        this.currentBody.push(OP.if, 0x40);
        this.currentBody.push(OP.unreachable);
        this.currentBody.push(OP.end);
      }
    } else {
      // Unknown macro — nop
    }
  }

  private emitPrintln(args: Expr[], newline: boolean): void {
    if (args.length === 0) {
      if (newline) {
        const str = this.addString('\n');
        this.emitFdWrite(str.offset, str.length);
      }
      return;
    }

    const arg = args[0]!;
    if (arg.kind === 'StringLiteral') {
      const value = newline ? arg.value + '\n' : arg.value;
      const str = this.addString(value);
      this.emitFdWrite(str.offset, str.length);
    } else {
      // Non-string argument — write a placeholder
      const str = this.addString(newline ? '<value>\n' : '<value>');
      this.emitFdWrite(str.offset, str.length);
    }
  }

  /** Emit WASI fd_write call to stdout. */
  private emitFdWrite(offset: number, length: number): void {
    // fd_write(fd, iovs, iovs_len, nwritten) -> errno
    // iov = { buf_ptr: i32, buf_len: i32 } at memory offset 0

    // Store iov at memory[0..8]: { ptr, len }
    this.currentBody.push(OP.i32_const, ...encodeI32(0));     // iov address
    this.currentBody.push(OP.i32_const, ...encodeI32(offset)); // buf pointer
    this.currentBody.push(OP.i32_store, 0x02, 0x00);          // align=4, offset=0

    this.currentBody.push(OP.i32_const, ...encodeI32(4));     // iov + 4
    this.currentBody.push(OP.i32_const, ...encodeI32(length)); // buf length
    this.currentBody.push(OP.i32_store, 0x02, 0x00);          // align=4, offset=0

    // Call fd_write(1, 0, 1, 8)
    this.currentBody.push(OP.i32_const, ...encodeI32(1));  // fd = stdout
    this.currentBody.push(OP.i32_const, ...encodeI32(0));  // iovs pointer
    this.currentBody.push(OP.i32_const, ...encodeI32(1));  // iovs_len = 1
    this.currentBody.push(OP.i32_const, ...encodeI32(8));  // nwritten pointer

    this.currentBody.push(OP.call, ...encodeU32(0));       // call fd_write (import #0)
    this.currentBody.push(OP.drop);                         // drop errno result
  }

  // ─── Helpers ────────────────────────────────────────────────────

  /** Extend i32 boolean (0/1) result to i64. */
  private extendBoolToI64(): void {
    this.currentBody.push(OP.i64_extend_i32_s);
  }

  /** Infer the WASM value type of an expression. */
  private inferExprType(expr: Expr): number {
    switch (expr.kind) {
      case 'FloatLiteral':
        return WASM_F64;
      case 'Ident': {
        const idx = this.localMap.get(expr.name);
        if (idx !== undefined) {
          const local = this.locals.find(l => l.index === idx);
          if (local) return local.type;
        }
        return WASM_I64;
      }
      case 'Binary': {
        const leftType = this.inferExprType(expr.left);
        const rightType = this.inferExprType(expr.right);
        // Comparisons always produce i64 (our bool representation) or i32 internally
        const op = expr.operator;
        if (op === '==' || op === '!=' || op === '<' || op === '>' || op === '<=' || op === '>=' || op === '&&' || op === '||') {
          return WASM_I64; // boolean result stored as i64
        }
        if (leftType === WASM_F64 || rightType === WASM_F64) return WASM_F64;
        return WASM_I64;
      }
      case 'Unary':
        return this.inferExprType(expr.operand);
      case 'Call': {
        if (expr.callee.kind === 'Ident') {
          const funcIdx = this.funcNames.get(expr.callee.name);
          if (funcIdx !== undefined && funcIdx >= this.importCount) {
            const func = this.functions[funcIdx - this.importCount];
            if (func) {
              const sig = this.types[func.typeIndex];
              if (sig) {
                // Decode return type from the type signature
                // Format: [WASM_FUNCREF, paramCount, ...params, resultCount, ...results]
                const paramCount = sig[1]!;
                const resultCount = sig[2 + paramCount]!;
                if (resultCount > 0) {
                  return sig[3 + paramCount]!;
                }
              }
            }
          }
        }
        return WASM_I64;
      }
      default:
        return WASM_I64;
    }
  }

  /** Check if an expression is in f64 context (for condition wrapping). */
  private isF64Condition(expr: Expr): boolean {
    if (expr.kind === 'Binary') {
      const op = expr.operator;
      if (op === '==' || op === '!=' || op === '<' || op === '>' || op === '<=' || op === '>=') {
        const leftType = this.inferExprType(expr.left);
        const rightType = this.inferExprType(expr.right);
        return leftType === WASM_F64 || rightType === WASM_F64;
      }
    }
    return false;
  }

  private exprProducesValue(expr: Expr): boolean {
    switch (expr.kind) {
      case 'Call': {
        if (expr.callee.kind === 'Ident') {
          const name = expr.callee.name;
          // Built-in print/println handled via fd_write — no value left on stack
          if (name === 'print' || name === 'println') return false;

          const idx = this.funcNames.get(name);
          if (idx !== undefined && idx >= this.importCount) {
            const func = this.functions[idx - this.importCount]!;
            const sig = this.types[func.typeIndex]!;
            // Check if function type has result types
            const paramCount = sig[1]!;
            const totalLen = sig.length;
            return totalLen > 2 + paramCount + 1;
          }
        }
        return false; // Unknown functions push i64(0), but safer to not drop
      }
      case 'MacroCall':
        return false;
      default:
        return true;
    }
  }

  private addLocal(name: string, type: number): number {
    const index = this.nextLocalIndex++;
    this.locals.push({ name, type, index });
    this.localMap.set(name, index);
    return index;
  }

  private addString(value: string): StringLiteral {
    // Check for duplicate
    const existing = this.strings.find(s => s.value === value);
    if (existing) return existing;

    const bytes = new TextEncoder().encode(value);
    const str: StringLiteral = {
      offset: this.dataOffset,
      length: bytes.length,
      value,
    };
    this.strings.push(str);
    this.dataOffset += bytes.length;
    // Align to 4 bytes
    this.dataOffset = (this.dataOffset + 3) & ~3;
    return str;
  }

  private getOrCreateType(params: number[], results: number[]): number {
    const key = `(${params.join(',')})=>(${results.join(',')})`;
    const existing = this.typeMap.get(key);
    if (existing !== undefined) return existing;

    const index = this.types.length;
    const encoded = [
      WASM_FUNCREF,
      ...encodeU32(params.length), ...params,
      ...encodeU32(results.length), ...results,
    ];
    this.types.push(encoded);
    this.typeMap.set(key, index);
    return index;
  }

  // ─── Module assembly ────────────────────────────────────────────

  private buildModule(fdWriteTypeIndex: number): Uint8Array {
    const sections: number[] = [];

    // Type section
    sections.push(...section(SECTION.type,
      encodeVector(this.types),
    ));

    // Import section: WASI fd_write
    const importEntries = [
      [
        ...encodeString('wasi_snapshot_preview1'),
        ...encodeString('fd_write'),
        0x00, // func import
        ...encodeU32(fdWriteTypeIndex),
      ],
    ];
    sections.push(...section(SECTION.import,
      encodeVector(importEntries),
    ));

    // Function section (type indices for each defined function)
    const funcTypeIndices = this.functions.map(f => encodeU32(f.typeIndex));
    sections.push(...section(SECTION.function,
      encodeVector(funcTypeIndices),
    ));

    // Memory section: 1 page minimum
    const pages = Math.max(1, Math.ceil(this.dataOffset / 65536));
    sections.push(...section(SECTION.memory, [
      ...encodeU32(1), // 1 memory
      0x00, // no max
      ...encodeU32(pages),
    ]));

    // Export section
    const exports: number[][] = [];
    // Export memory
    exports.push([
      ...encodeString('memory'),
      0x02, // memory export
      ...encodeU32(0),
    ]);
    // Export functions
    for (let i = 0; i < this.functions.length; i++) {
      const func = this.functions[i]!;
      if (func.exported) {
        exports.push([
          ...encodeString(func.name === 'main' ? '_start' : func.name),
          0x00, // func export
          ...encodeU32(this.importCount + i),
        ]);
      }
    }
    sections.push(...section(SECTION.export,
      encodeVector(exports),
    ));

    // Code section
    const codeBodies = this.functions.map(func => {
      // Encode locals
      const localDecls: number[][] = [];
      // Group consecutive locals of the same type
      let i = 0;
      while (i < func.localTypes.length) {
        const type = func.localTypes[i]!;
        let count = 1;
        while (i + count < func.localTypes.length && func.localTypes[i + count] === type) {
          count++;
        }
        localDecls.push([...encodeU32(count), type]);
        i += count;
      }

      const bodyBytes = [
        ...encodeVector(localDecls),
        ...func.body,
      ];
      return [...encodeU32(bodyBytes.length), ...bodyBytes];
    });
    sections.push(...section(10, // Code section id
      [...encodeU32(codeBodies.length), ...codeBodies.flat()],
    ));

    // Data section (string literals)
    if (this.strings.length > 0) {
      const dataSegments = this.strings.map(str => {
        const bytes = new TextEncoder().encode(str.value);
        return [
          0x00, // active, memory 0
          OP.i32_const, ...encodeI32(str.offset), OP.end, // offset expression
          ...encodeU32(bytes.length),
          ...bytes,
        ];
      });
      sections.push(...section(SECTION.data,
        encodeVector(dataSegments),
      ));
    }

    // Build final module
    const magic = [0x00, 0x61, 0x73, 0x6d]; // \0asm
    const version = [0x01, 0x00, 0x00, 0x00]; // version 1
    const module = [...magic, ...version, ...sections];

    return new Uint8Array(module);
  }
}
