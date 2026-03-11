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
  TypeDecl,
  Block,
  Stmt,
  Expr,
  ClosureExpr,
  ActorDecl,
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

interface StructLayout {
  fields: { name: string; offset: number; type: number }[];
  size: number;
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

  // Struct layouts
  private structLayouts = new Map<string, StructLayout>();

  // Heap pointer — bump allocator starts after string data
  private heapBase = 0; // Set after all strings are allocated

  // Enum variant registry: variant name → { tag, enumName, fieldCount }
  private enumVariants = new Map<string, { tag: number; enumName: string; fieldCount: number }>();

  // Closure counter for generating unique names
  private closureCounter = 0;
  // Deferred closures to compile after current function
  private deferredClosures: { name: string; expr: ClosureExpr }[] = [];

  // Current function state
  private locals: WasmLocal[] = [];
  private localMap = new Map<string, number>();
  private currentBody: number[] = [];
  private nextLocalIndex = 0;

  // Track which locals hold struct pointers (variable name → struct type name)
  private localStructTypes = new Map<string, string>();

  // ─── Main entry point ───────────────────────────────────────────

  generate(program: Program): Uint8Array {
    this.functions = [];
    this.funcNames.clear();
    this.types = [];
    this.typeMap.clear();
    this.strings = [];
    this.dataOffset = 1024;
    this.importCount = 0;
    this.structLayouts.clear();
    this.enumVariants.clear();
    this.closureCounter = 0;
    this.deferredClosures = [];
    this.usesArrays = false;
    this.heapBase = 0;

    // Register WASI fd_write import: (i32, i32, i32, i32) -> i32
    const fdWriteType = this.getOrCreateType([WASM_I32, WASM_I32, WASM_I32, WASM_I32], [WASM_I32]);
    this.importCount = 1;
    this.funcNames.set('__fd_write', 0);

    // First pass — register type declarations (structs, enums, actors)
    for (const item of program.items) {
      if (item.kind === 'TypeDecl') {
        this.registerTypeDecl(item);
      } else if (item.kind === 'EnumDecl') {
        this.registerEnumDecl(item);
      } else if (item.kind === 'ActorDecl') {
        this.registerActorDecl(item);
      }
    }

    // Register user functions (first pass — signatures only)
    for (const item of program.items) {
      if (item.kind === 'FunctionDecl') {
        this.registerFunction(item);
      } else if (item.kind === 'ActorDecl') {
        this.registerActorFunctions(item);
      }
    }

    // Generate function bodies (second pass)
    for (const item of program.items) {
      if (item.kind === 'FunctionDecl') {
        this.generateFunction(item);
      } else if (item.kind === 'ActorDecl') {
        this.generateActorFunctions(item);
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

  private registerTypeDecl(decl: TypeDecl): void {
    if (decl.body.kind === 'Struct') {
      const fields: { name: string; offset: number; type: number }[] = [];
      let offset = 0;
      for (const field of decl.body.fields) {
        fields.push({
          name: field.name,
          offset,
          type: resolveWasmType(field.typeAnnotation),
        });
        offset += 8; // Each field is 8 bytes (i64-sized)
      }
      this.structLayouts.set(decl.name, { fields, size: offset });
    }
  }

  private registerEnumDecl(decl: import('../ast/index.js').EnumDecl): void {
    let tag = 0;
    for (const variant of decl.variants) {
      let fieldCount = 0;
      if (variant.kind === 'TupleVariant') {
        fieldCount = variant.fields.length;
      } else if (variant.kind === 'StructVariant') {
        fieldCount = variant.fields.length;
      }
      this.enumVariants.set(variant.name, {
        tag,
        enumName: decl.name,
        fieldCount,
      });
      tag++;
    }
  }

  private registerActorDecl(decl: ActorDecl): void {
    // Register actor state as a struct layout
    const fields: { name: string; offset: number; type: number }[] = [];
    let offset = 0;
    for (const member of decl.members) {
      if (member.kind === 'StateDecl') {
        fields.push({
          name: member.name,
          offset,
          type: resolveWasmType(member.typeAnnotation),
        });
        offset += 8; // Each field is 8 bytes (i64-sized)
      }
    }
    this.structLayouts.set(decl.name, { fields, size: offset || 8 }); // min 8 bytes
  }

  private registerActorFunctions(decl: ActorDecl): void {
    // Register each on handler and method as a function
    // Each takes an implicit first parameter: the actor struct pointer (i64)
    for (const member of decl.members) {
      if (member.kind === 'OnHandler') {
        const funcName = `${decl.name}__on_${member.messageName}`;
        const paramTypes = [WASM_I64, ...member.params.map(p => resolveWasmType(p.typeAnnotation))];
        const returnTypes = member.returnType ? [resolveWasmType(member.returnType)] : [];
        const typeIndex = this.getOrCreateType(paramTypes, returnTypes);

        const funcIndex = this.importCount + this.functions.length;
        this.funcNames.set(funcName, funcIndex);

        this.functions.push({
          name: funcName,
          typeIndex,
          localTypes: [],
          body: [],
          exported: false,
        });
      } else if (member.kind === 'FunctionDecl') {
        const funcName = `${decl.name}__${member.name}`;
        const paramTypes = [WASM_I64, ...member.params.map(p => resolveWasmType(p.typeAnnotation))];
        const hasReturn = member.returnType !== null;
        const returnTypes = hasReturn ? [resolveWasmType(member.returnType)] : [];
        const typeIndex = this.getOrCreateType(paramTypes, returnTypes);

        const funcIndex = this.importCount + this.functions.length;
        this.funcNames.set(funcName, funcIndex);

        this.functions.push({
          name: funcName,
          typeIndex,
          localTypes: [],
          body: [],
          exported: false,
        });
      }
    }
  }

  private generateActorFunctions(decl: ActorDecl): void {
    for (const member of decl.members) {
      if (member.kind === 'OnHandler') {
        const funcName = `${decl.name}__on_${member.messageName}`;
        const funcIndex = this.funcNames.get(funcName)!;
        const func = this.functions[funcIndex - this.importCount]!;

        this.locals = [];
        this.localMap.clear();
        this.localStructTypes.clear();
        this.currentBody = [];
        this.nextLocalIndex = 0;

        // Implicit self parameter (actor struct pointer)
        const selfIdx = this.addLocal('__self', WASM_I64);
        this.localStructTypes.set('__self', decl.name);

        // Register handler parameters
        for (const param of member.params) {
          this.addLocal(param.name, resolveWasmType(param.typeAnnotation));
        }

        // Register state field names as locals that load from the struct
        // For simplicity in MVP, bind state fields as locals initialized from struct
        for (const stateM of decl.members) {
          if (stateM.kind === 'StateDecl') {
            const layout = this.structLayouts.get(decl.name)!;
            const fieldLayout = layout.fields.find(f => f.name === stateM.name);
            if (fieldLayout) {
              const stateLocalIdx = this.addLocal(stateM.name, WASM_I64);
              // Load field value from self pointer
              this.currentBody.push(OP.local_get, ...encodeU32(selfIdx));
              this.currentBody.push(OP.i32_wrap_i64);
              this.currentBody.push(OP.i64_load, 0x03, ...encodeU32(fieldLayout.offset));
              this.currentBody.push(OP.local_set, ...encodeU32(stateLocalIdx));
            }
          }
        }

        this.emitBlock(member.body);

        // Write back state fields to struct
        for (const stateM of decl.members) {
          if (stateM.kind === 'StateDecl') {
            const layout = this.structLayouts.get(decl.name)!;
            const fieldLayout = layout.fields.find(f => f.name === stateM.name);
            const stateLocalIdx = this.localMap.get(stateM.name);
            if (fieldLayout && stateLocalIdx !== undefined) {
              this.currentBody.push(OP.local_get, ...encodeU32(selfIdx));
              this.currentBody.push(OP.i32_wrap_i64);
              this.currentBody.push(OP.local_get, ...encodeU32(stateLocalIdx));
              this.currentBody.push(OP.i64_store, 0x03, ...encodeU32(fieldLayout.offset));
            }
          }
        }

        func.localTypes = this.locals.slice(1 + member.params.length).map(l => l.type);
        func.body = [...this.currentBody, OP.end];

        this.compileDeferredClosures();
      } else if (member.kind === 'FunctionDecl') {
        const funcName = `${decl.name}__${member.name}`;
        const funcIndex = this.funcNames.get(funcName)!;
        const func = this.functions[funcIndex - this.importCount]!;

        this.locals = [];
        this.localMap.clear();
        this.localStructTypes.clear();
        this.currentBody = [];
        this.nextLocalIndex = 0;

        // Implicit self parameter
        const selfIdx = this.addLocal('__self', WASM_I64);
        this.localStructTypes.set('__self', decl.name);

        // Register method parameters
        for (const param of member.params) {
          this.addLocal(param.name, resolveWasmType(param.typeAnnotation));
        }

        this.emitBlock(member.body);

        func.localTypes = this.locals.slice(1 + member.params.length).map(l => l.type);
        func.body = [...this.currentBody, OP.end];

        this.compileDeferredClosures();
      }
    }
  }

  private generateFunction(decl: FunctionDecl): void {
    const funcIndex = this.funcNames.get(decl.name)!;
    const func = this.functions[funcIndex - this.importCount]!;

    this.locals = [];
    this.localMap.clear();
    this.localStructTypes.clear();
    this.currentBody = [];
    this.nextLocalIndex = 0;

    // Register parameters as locals
    for (const param of decl.params) {
      this.addLocal(param.name, resolveWasmType(param.typeAnnotation));
    }

    this.emitBlock(decl.body);

    func.localTypes = this.locals.slice(decl.params.length).map(l => l.type);
    func.body = [...this.currentBody, OP.end];

    // Compile any closures that were deferred during this function
    this.compileDeferredClosures();
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
        this.emitForStmt(stmt);
        break;
      case 'AssignStmt':
        this.emitAssignStmt(stmt);
        break;
      case 'MatchStmt':
        this.emitMatchStmt(stmt);
        break;
      default:
        break;
    }
  }

  private emitLetStmt(stmt: import('../ast/index.js').LetStmt): void {
    const wasmType = resolveWasmType(stmt.typeAnnotation);
    const localIdx = this.addLocal(stmt.name, wasmType);

    // Track struct type for field access resolution
    if (stmt.initializer.kind === 'Struct') {
      this.localStructTypes.set(stmt.name, stmt.initializer.name);
    }

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

  private emitForStmt(stmt: import('../ast/index.js').ForStmt): void {
    // Check if iterable is a range() call
    const iterable = stmt.iterable;
    if (iterable.kind === 'Call' && iterable.callee.kind === 'Ident' && iterable.callee.name === 'range') {
      // range(start, end) — emit as: let i = start; while (i < end) { body; i = i + 1; }
      const startExpr = iterable.args[0]?.value;
      const endExpr = iterable.args[1]?.value;

      if (!startExpr || !endExpr) {
        // Malformed range — just emit body
        this.emitBlock(stmt.body);
        return;
      }

      // Create loop variable
      const loopVarIdx = this.addLocal(stmt.variable, WASM_I64);

      // Initialize: i = start
      this.emitExpr(startExpr);
      this.currentBody.push(OP.local_set, ...encodeU32(loopVarIdx));

      // Store end value in a temp
      const endIdx = this.addLocal('__for_end', WASM_I64);
      this.emitExpr(endExpr);
      this.currentBody.push(OP.local_set, ...encodeU32(endIdx));

      // while (i < end)
      this.currentBody.push(OP.block, 0x40); // outer block
      this.currentBody.push(OP.loop, 0x40);  // inner loop

      // condition: i < end
      this.currentBody.push(OP.local_get, ...encodeU32(loopVarIdx));
      this.currentBody.push(OP.local_get, ...encodeU32(endIdx));
      this.currentBody.push(OP.i64_lt_s);
      this.currentBody.push(OP.i32_eqz);
      this.currentBody.push(OP.br_if, ...encodeU32(1)); // break if false

      // body
      this.emitBlock(stmt.body);

      // increment: i = i + 1
      this.currentBody.push(OP.local_get, ...encodeU32(loopVarIdx));
      this.currentBody.push(OP.i64_const, ...encodeI64(1));
      this.currentBody.push(OP.i64_add);
      this.currentBody.push(OP.local_set, ...encodeU32(loopVarIdx));

      this.currentBody.push(OP.br, ...encodeU32(0)); // continue loop
      this.currentBody.push(OP.end); // end loop
      this.currentBody.push(OP.end); // end block
    } else {
      // Non-range for loops — just emit body as fallback
      this.emitBlock(stmt.body);
    }
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

  private emitMatchStmt(stmt: import('../ast/index.js').MatchStmt): void {
    // Evaluate subject into a temporary local
    const subjectType = this.inferExprType(stmt.subject);
    const tmpIdx = this.addLocal('__match_subject', subjectType);
    this.emitExpr(stmt.subject);
    this.currentBody.push(OP.local_set, ...encodeU32(tmpIdx));

    this.emitMatchArms(stmt.arms, 0, tmpIdx, subjectType);
  }

  private emitMatchArms(
    arms: import('../ast/index.js').MatchArm[],
    index: number,
    subjectIdx: number,
    subjectType: number,
  ): void {
    if (index >= arms.length) return;

    const arm = arms[index]!;
    const pattern = arm.pattern;

    if (pattern.kind === 'WildcardPattern') {
      // Catch-all — just emit the body
      this.emitMatchArmBody(arm.body);
    } else if (pattern.kind === 'LiteralPattern') {
      // Compare subject to literal
      this.currentBody.push(OP.local_get, ...encodeU32(subjectIdx));

      if (typeof pattern.value === 'boolean') {
        this.currentBody.push(OP.i64_const, ...encodeI64(pattern.value ? 1 : 0));
      } else if (typeof pattern.value === 'number') {
        if (subjectType === WASM_F64) {
          // Remove the i64 local_get we just pushed — need f64 compare
          // Actually we need to re-think: subject is stored as subjectType
          this.currentBody.push(OP.f64_const, ...encodeF64(pattern.value));
          // f64_eq produces i32 directly
        } else {
          this.currentBody.push(OP.i64_const, ...encodeI64(pattern.value));
        }
      } else {
        // String pattern — not yet supported, push 0
        this.currentBody.push(OP.i64_const, ...encodeI64(0));
      }

      // Compare: i64_eq or f64_eq produces i32
      if (subjectType === WASM_F64) {
        this.currentBody.push(OP.f64_eq);
      } else {
        this.currentBody.push(OP.i64_eq);
      }
      // Result is i32, use directly with OP.if
      this.currentBody.push(OP.if, 0x40); // void block type
      this.emitMatchArmBody(arm.body);

      if (index + 1 < arms.length) {
        this.currentBody.push(OP.else);
        this.emitMatchArms(arms, index + 1, subjectIdx, subjectType);
      }
      this.currentBody.push(OP.end);
    } else if (pattern.kind === 'IdentPattern') {
      // Bind subject value to a new local
      const bindIdx = this.addLocal(pattern.name, subjectType);
      this.currentBody.push(OP.local_get, ...encodeU32(subjectIdx));
      this.currentBody.push(OP.local_set, ...encodeU32(bindIdx));
      this.emitMatchArmBody(arm.body);
    } else if (pattern.kind === 'ConstructorPattern') {
      const variant = this.enumVariants.get(pattern.name);
      if (variant) {
        if (variant.fieldCount === 0) {
          // Unit variant: subject is the tag value directly (i64)
          this.currentBody.push(OP.local_get, ...encodeU32(subjectIdx));
          this.currentBody.push(OP.i64_const, ...encodeI64(variant.tag));
          this.currentBody.push(OP.i64_eq);
          this.currentBody.push(OP.if, 0x40);
          this.emitMatchArmBody(arm.body);
          if (index + 1 < arms.length) {
            this.currentBody.push(OP.else);
            this.emitMatchArms(arms, index + 1, subjectIdx, subjectType);
          }
          this.currentBody.push(OP.end);
        } else {
          // Tuple variant: subject is a pointer, load tag from memory
          this.currentBody.push(OP.local_get, ...encodeU32(subjectIdx));
          this.currentBody.push(OP.i32_wrap_i64); // pointer as i32
          this.currentBody.push(OP.i64_load, 0x03, ...encodeU32(0)); // load tag
          this.currentBody.push(OP.i64_const, ...encodeI64(variant.tag));
          this.currentBody.push(OP.i64_eq);
          this.currentBody.push(OP.if, 0x40);

          // Bind payload fields from pattern
          for (let i = 0; i < pattern.fields.length; i++) {
            const fieldPat = pattern.fields[i]!;
            if (fieldPat.kind === 'IdentPattern') {
              const bindIdx = this.addLocal(fieldPat.name, WASM_I64);
              this.currentBody.push(OP.local_get, ...encodeU32(subjectIdx));
              this.currentBody.push(OP.i32_wrap_i64);
              this.currentBody.push(OP.i64_load, 0x03, ...encodeU32(8 + i * 8));
              this.currentBody.push(OP.local_set, ...encodeU32(bindIdx));
            }
          }

          this.emitMatchArmBody(arm.body);
          if (index + 1 < arms.length) {
            this.currentBody.push(OP.else);
            this.emitMatchArms(arms, index + 1, subjectIdx, subjectType);
          }
          this.currentBody.push(OP.end);
        }
      } else {
        // Unknown constructor — just emit the body as fallthrough
        this.emitMatchArmBody(arm.body);
      }
    }
  }

  private emitMatchArmBody(body: import('../ast/index.js').Expr | import('../ast/index.js').Block): void {
    if ('statements' in body && Array.isArray((body as any).statements)) {
      this.emitBlock(body as Block);
    } else {
      // Expression body — emit as an ExprStmt
      this.emitExpr(body as Expr);
      if (this.exprProducesValue(body as Expr)) {
        this.currentBody.push(OP.drop);
      }
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
      case 'StringInterpolation': {
        let combined = '';
        for (const part of expr.parts) {
          if (part.kind === 'Literal') {
            combined += part.value;
          } else {
            combined += '<expr>';
          }
        }
        this.emitStringLiteral(combined);
        break;
      }
      case 'Struct':
        this.emitStructExpr(expr);
        break;
      case 'FieldAccess':
        this.emitFieldAccess(expr);
        break;
      case 'Closure':
        this.emitClosure(expr as ClosureExpr);
        break;
      case 'ArrayLiteral':
        this.emitArrayLiteral(expr);
        break;
      case 'Index':
        this.emitIndex(expr);
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
      // Check if this is a unit enum variant
      const variant = this.enumVariants.get(name);
      if (variant && variant.fieldCount === 0) {
        this.currentBody.push(OP.i64_const, ...encodeI64(variant.tag));
      } else {
        // Unknown variable — push 0
        this.currentBody.push(OP.i64_const, ...encodeI64(0));
      }
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

    // Check if this is an enum variant constructor (tuple variant)
    if (calleeName && this.enumVariants.has(calleeName)) {
      const variant = this.enumVariants.get(calleeName)!;
      if (variant.fieldCount === 0) {
        // Unit variant called as function — just push the tag
        this.currentBody.push(OP.i64_const, ...encodeI64(variant.tag));
      } else {
        // Tuple variant: allocate memory — tag (8 bytes) + fields (8 bytes each)
        const totalSize = 8 + variant.fieldCount * 8;

        // Bump allocate
        this.currentBody.push(OP.global_get, ...encodeU32(0)); // heap pointer
        const tmpIdx = this.addLocal('__variant_ptr', WASM_I32);
        this.currentBody.push(OP.local_tee, ...encodeU32(tmpIdx));
        this.currentBody.push(OP.i32_const, ...encodeI32(totalSize));
        this.currentBody.push(OP.i32_add);
        this.currentBody.push(OP.global_set, ...encodeU32(0)); // update heap pointer

        // Store tag at offset 0
        this.currentBody.push(OP.local_get, ...encodeU32(tmpIdx));
        this.currentBody.push(OP.i64_const, ...encodeI64(variant.tag));
        this.currentBody.push(OP.i64_store, 0x03, ...encodeU32(0));

        // Store each field
        for (let i = 0; i < expr.args.length && i < variant.fieldCount; i++) {
          this.currentBody.push(OP.local_get, ...encodeU32(tmpIdx));
          this.emitExpr(expr.args[i]!.value);
          this.currentBody.push(OP.i64_store, 0x03, ...encodeU32(8 + i * 8));
        }

        // Return pointer as i64
        this.currentBody.push(OP.local_get, ...encodeU32(tmpIdx));
        this.currentBody.push(OP.i64_extend_i32_s);
      }
    } else if (calleeName && this.funcNames.has(calleeName)) {
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

  private emitStructExpr(expr: import('../ast/index.js').StructExpr): void {
    const layout = this.structLayouts.get(expr.name);
    if (!layout) {
      // Unknown struct — push 0
      this.currentBody.push(OP.i64_const, ...encodeI64(0));
      return;
    }

    // Bump-allocate: read heap pointer from global 0, advance by struct size
    // heap pointer = global 0
    this.currentBody.push(OP.global_get, ...encodeU32(0)); // get heap pointer (i32)

    // Save the pointer into a temp local for storing fields
    const tmpIdx = this.addLocal('__struct_ptr', WASM_I32);
    this.currentBody.push(OP.local_tee, ...encodeU32(tmpIdx));

    // Advance heap pointer
    this.currentBody.push(OP.i32_const, ...encodeI32(layout.size));
    this.currentBody.push(OP.i32_add);
    this.currentBody.push(OP.global_set, ...encodeU32(0)); // store new heap pointer

    // Store each field
    for (const fieldExpr of expr.fields) {
      const fieldLayout = layout.fields.find(f => f.name === fieldExpr.name);
      if (!fieldLayout) continue;

      // Address = ptr + field offset
      this.currentBody.push(OP.local_get, ...encodeU32(tmpIdx));
      // Emit field value
      this.emitExpr(fieldExpr.value);
      // Store as i64
      this.currentBody.push(OP.i64_store, 0x03, ...encodeU32(fieldLayout.offset)); // align=8
    }

    // Return pointer as i64
    this.currentBody.push(OP.local_get, ...encodeU32(tmpIdx));
    this.currentBody.push(OP.i64_extend_i32_s);
  }

  private emitFieldAccess(expr: import('../ast/index.js').FieldAccessExpr): void {
    // Emit the object expression (should be a struct pointer as i64)
    this.emitExpr(expr.object);
    // Wrap to i32 for memory access
    this.currentBody.push(OP.i32_wrap_i64);

    // Look up the struct layout from the object type
    const structName = this.inferStructName(expr.object);
    const layout = structName ? this.structLayouts.get(structName) : null;
    const fieldLayout = layout?.fields.find(f => f.name === expr.field);
    const offset = fieldLayout?.offset ?? 0;

    // Load field value as i64
    this.currentBody.push(OP.i64_load, 0x03, ...encodeU32(offset)); // align=8
  }

  /** Try to infer the struct type name from an expression. */
  private inferStructName(expr: Expr): string | null {
    if (expr.kind === 'Struct') {
      return expr.name;
    }
    if (expr.kind === 'Ident') {
      // Look up in local variable types — we track struct types by name
      const structType = this.localStructTypes.get(expr.name);
      if (structType) return structType;
    }
    return null;
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

  // ─── Array emission ────────────────────────────────────────────

  private emitArrayLiteral(expr: import('../ast/index.js').ArrayLiteralExpr): void {
    this.usesArrays = true;
    const elemCount = expr.elements.length;
    const totalSize = 8 + elemCount * 8; // 8 bytes for length + 8 bytes per element

    // Bump allocate
    this.currentBody.push(OP.global_get, ...encodeU32(0)); // heap pointer
    const tmpIdx = this.addLocal('__arr_ptr', WASM_I32);
    this.currentBody.push(OP.local_tee, ...encodeU32(tmpIdx));
    this.currentBody.push(OP.i32_const, ...encodeI32(totalSize));
    this.currentBody.push(OP.i32_add);
    this.currentBody.push(OP.global_set, ...encodeU32(0)); // update heap pointer

    // Store length at offset 0
    this.currentBody.push(OP.local_get, ...encodeU32(tmpIdx));
    this.currentBody.push(OP.i64_const, ...encodeI64(elemCount));
    this.currentBody.push(OP.i64_store, 0x03, ...encodeU32(0));

    // Store each element at offset 8 + i * 8
    for (let i = 0; i < elemCount; i++) {
      this.currentBody.push(OP.local_get, ...encodeU32(tmpIdx));
      this.emitExpr(expr.elements[i]!);
      this.currentBody.push(OP.i64_store, 0x03, ...encodeU32(8 + i * 8));
    }

    // Return pointer as i64
    this.currentBody.push(OP.local_get, ...encodeU32(tmpIdx));
    this.currentBody.push(OP.i64_extend_i32_s);
  }

  private emitIndex(expr: import('../ast/index.js').IndexExpr): void {
    // Load from base + 8 + index * 8 (skip the length prefix)
    this.emitExpr(expr.object);
    this.currentBody.push(OP.i32_wrap_i64); // pointer as i32

    // Calculate byte offset: 8 + index * 8
    this.emitExpr(expr.index);
    this.currentBody.push(OP.i32_wrap_i64);
    this.currentBody.push(OP.i32_const, ...encodeI32(8));
    this.currentBody.push(OP.i32_mul);
    this.currentBody.push(OP.i32_const, ...encodeI32(8));
    this.currentBody.push(OP.i32_add);

    // Add base pointer + offset
    this.currentBody.push(OP.i32_add);

    // Load i64 value
    this.currentBody.push(OP.i64_load, 0x03, ...encodeU32(0));
  }

  // ─── Closure emission ──────────────────────────────────────────

  private emitClosure(expr: ClosureExpr): void {
    // Generate a unique name for this closure
    const closureName = `__closure_${this.closureCounter++}`;

    // Determine param types and return type
    const paramTypes = expr.params.map(p => resolveWasmType(p.typeAnnotation));
    const returnTypes = expr.returnType ? [resolveWasmType(expr.returnType)] : [];
    const typeIndex = this.getOrCreateType(paramTypes, returnTypes);

    // Register the closure as a function
    const funcIndex = this.importCount + this.functions.length;
    this.funcNames.set(closureName, funcIndex);

    this.functions.push({
      name: closureName,
      typeIndex,
      localTypes: [],
      body: [],
      exported: false,
    });

    // Defer compilation of the closure body (we'll compile it after the current function)
    this.deferredClosures.push({ name: closureName, expr });

    // The closure value is the function index stored as i64
    this.currentBody.push(OP.i64_const, ...encodeI64(funcIndex));
  }

  private compileDeferredClosures(): void {
    while (this.deferredClosures.length > 0) {
      const deferred = this.deferredClosures.shift()!;
      const closureExpr = deferred.expr;
      const funcIndex = this.funcNames.get(deferred.name)!;
      const func = this.functions[funcIndex - this.importCount]!;

      // Save current function state
      const savedLocals = this.locals;
      const savedLocalMap = this.localMap;
      const savedBody = this.currentBody;
      const savedNextLocal = this.nextLocalIndex;
      const savedStructTypes = this.localStructTypes;

      // Set up fresh state for the closure function
      this.locals = [];
      this.localMap = new Map();
      this.localStructTypes = new Map();
      this.currentBody = [];
      this.nextLocalIndex = 0;

      // Register parameters as locals
      for (const param of closureExpr.params) {
        this.addLocal(param.name, resolveWasmType(param.typeAnnotation));
      }

      // Emit body
      if ('statements' in closureExpr.body && Array.isArray((closureExpr.body as any).statements)) {
        this.emitBlock(closureExpr.body as Block);
      } else {
        // Expression body — emit as a return value
        this.emitExpr(closureExpr.body as Expr);
        if (closureExpr.returnType) {
          this.currentBody.push(OP.return);
        } else {
          this.currentBody.push(OP.drop);
        }
      }

      func.localTypes = this.locals.slice(closureExpr.params.length).map(l => l.type);
      func.body = [...this.currentBody, OP.end];

      // Restore parent function state
      this.locals = savedLocals;
      this.localMap = savedLocalMap;
      this.currentBody = savedBody;
      this.nextLocalIndex = savedNextLocal;
      this.localStructTypes = savedStructTypes;
    }
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

  /** Check if any enum variant requires heap allocation (tuple/struct variants). */
  private hasHeapEnumVariants(): boolean {
    for (const v of this.enumVariants.values()) {
      if (v.fieldCount > 0) return true;
    }
    return false;
  }

  // Track whether arrays are used (for heap allocation)
  private usesArrays = false;

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
    // Align heap base to 8 bytes after string data
    this.heapBase = (this.dataOffset + 7) & ~7;
    const pages = Math.max(1, Math.ceil((this.heapBase + 65536) / 65536));
    sections.push(...section(SECTION.memory, [
      ...encodeU32(1), // 1 memory
      0x00, // no max
      ...encodeU32(pages),
    ]));

    // Global section: heap pointer (mutable i32) — needed for structs, tuple enum variants, and arrays
    const needsHeap = this.structLayouts.size > 0 || this.hasHeapEnumVariants() || this.usesArrays;
    if (needsHeap) {
      const globals = [
        [
          WASM_I32,       // type: i32
          0x01,           // mutable
          OP.i32_const, ...encodeI32(this.heapBase), OP.end,  // init expr
        ],
      ];
      sections.push(...section(SECTION.global,
        encodeVector(globals),
      ));
    }

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
