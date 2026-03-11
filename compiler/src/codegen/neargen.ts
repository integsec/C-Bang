/**
 * NEAR WASM code generator for the C! language.
 *
 * Generates WebAssembly binaries targeting the NEAR blockchain runtime.
 * Unlike the general WASM generator, this:
 *   - Imports from `env` namespace (not `wasi_snapshot_preview1`)
 *   - Exports contract methods directly (not as `_start`)
 *   - Uses NEAR host functions: input, storage_read, storage_write,
 *     value_return, log_utf8, register_len, read_register, promise_create
 *   - Works primarily with `contract` blocks
 */

import type {
  Program,
  ContractDecl,
  FunctionDecl,
  StateDecl,
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

/** LEB128 encoding for signed 64-bit integers. */
function encodeI64(value: number): number[] {
  return encodeI32(value);
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

// ─── WASM constants ───────────────────────────────────────────────

const WASM_I64 = 0x7e;
const WASM_FUNCREF = 0x60;

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
  i64_add: 0x7c,
  i64_sub: 0x7d,
  i64_mul: 0x7e,
  i64_div_s: 0x7f,
  i64_rem_s: 0x81,
  i32_add: 0x6a,
  i32_sub: 0x6b,
  i32_mul: 0x6c,
  i32_div_s: 0x6d,
  i32_rem_s: 0x6f,
  i64_extend_i32_s: 0xac,
  i32_wrap_i64: 0xa7,
} as const;

const SECTION = {
  type: 1,
  import: 2,
  function: 3,
  memory: 5,
  global: 6,
  export: 7,
  start: 8,
  code: 10,
  data: 11,
} as const;

// ─── NEAR Host Function Signatures ─────────────────────────────────

/** NEAR host functions imported from the `env` namespace. */
interface NearImport {
  name: string;
  params: number[];    // WASM types
  results: number[];   // WASM types
}

const NEAR_IMPORTS: NearImport[] = [
  // input() — reads input (calldata)
  { name: 'input', params: [WASM_I64], results: [] },
  // storage_read(key_len: u64, key_ptr: u64, register_id: u64) -> u64
  { name: 'storage_read', params: [WASM_I64, WASM_I64, WASM_I64], results: [WASM_I64] },
  // storage_write(key_len: u64, key_ptr: u64, value_len: u64, value_ptr: u64, register_id: u64) -> u64
  { name: 'storage_write', params: [WASM_I64, WASM_I64, WASM_I64, WASM_I64, WASM_I64], results: [WASM_I64] },
  // value_return(value_len: u64, value_ptr: u64)
  { name: 'value_return', params: [WASM_I64, WASM_I64], results: [] },
  // log_utf8(len: u64, ptr: u64)
  { name: 'log_utf8', params: [WASM_I64, WASM_I64], results: [] },
  // register_len(register_id: u64) -> u64
  { name: 'register_len', params: [WASM_I64], results: [WASM_I64] },
  // read_register(register_id: u64, ptr: u64)
  { name: 'read_register', params: [WASM_I64, WASM_I64], results: [] },
  // promise_create(account_id_len: u64, account_id_ptr: u64, method_name_len: u64, method_name_ptr: u64, arguments_len: u64, arguments_ptr: u64, amount_ptr: u64, gas: u64) -> u64
  { name: 'promise_create', params: [WASM_I64, WASM_I64, WASM_I64, WASM_I64, WASM_I64, WASM_I64, WASM_I64, WASM_I64], results: [WASM_I64] },
];

// ─── Generator ──────────────────────────────────────────────────────

export class NearGenerator {
  private storageSlots: Map<string, number> = new Map();
  private nextSlot = 0;
  private dataSegments: { offset: number; data: number[] }[] = [];
  private dataOffset = 1024; // Start data after 1KB for stack
  private strings: Map<string, { offset: number; length: number }> = new Map();

  // Track which NEAR imports are actually needed
  private neededImports: Set<string> = new Set();

  generate(program: Program): Uint8Array {
    // Find contract declarations
    const contracts = program.items.filter(
      (item): item is ContractDecl => item.kind === 'ContractDecl'
    );

    if (contracts.length === 0) {
      throw new Error('NEAR codegen requires at least one contract declaration');
    }

    const contract = contracts[0];

    // Collect state variables
    const stateVars: StateDecl[] = [];
    const publicFns: FunctionDecl[] = [];

    for (const member of contract.members) {
      if (member.kind === 'StateDecl') {
        this.storageSlots.set(member.name, this.nextSlot++);
        stateVars.push(member);
      }
      if (member.kind === 'FunctionDecl' && member.visibility === 'public') {
        publicFns.push(member);
      }
    }

    // Pre-scan functions to determine needed imports
    this.scanNeededImports(publicFns);

    // Always need these for any contract
    this.neededImports.add('input');
    this.neededImports.add('value_return');

    // Pre-allocate storage key strings
    for (const [name] of this.storageSlots) {
      this.allocateString(name);
    }

    // Build NEAR imports list (only include needed ones)
    const activeImports = NEAR_IMPORTS.filter(imp => this.neededImports.has(imp.name));
    const numImports = activeImports.length;

    // Build import index map
    const importIndex: Map<string, number> = new Map();
    activeImports.forEach((imp, idx) => importIndex.set(imp.name, idx));

    // ─── Type section ───────────────────────────────────────────
    // Define function types for imports + exported functions
    const types: number[][] = [];

    // Import function types
    for (const imp of activeImports) {
      types.push([
        WASM_FUNCREF,
        ...encodeU32(imp.params.length), ...imp.params,
        ...encodeU32(imp.results.length), ...imp.results,
      ]);
    }

    // Exported function types: all contract methods are () -> ()
    // (they read input via host function, not params)
    const exportFnTypeIdx = types.length;
    types.push([
      WASM_FUNCREF,
      ...encodeU32(0), // no params
      ...encodeU32(0), // no results
    ]);

    const typeSection = section(SECTION.type, encodeVector(types));

    // ─── Import section ─────────────────────────────────────────
    const imports: number[][] = [];
    for (let i = 0; i < activeImports.length; i++) {
      imports.push([
        ...encodeString('env'),
        ...encodeString(activeImports[i].name),
        0x00, // function import
        ...encodeU32(i), // type index
      ]);
    }
    const importSection = section(SECTION.import, encodeVector(imports));

    // ─── Function section ───────────────────────────────────────
    // Declare function type indices for exported functions
    const funcTypes: number[][] = [];
    for (const _fn of publicFns) {
      funcTypes.push(encodeU32(exportFnTypeIdx));
    }
    const functionSection = section(SECTION.function, encodeVector(funcTypes));

    // ─── Memory section ─────────────────────────────────────────
    const memorySection = section(SECTION.memory, [
      ...encodeU32(1), // 1 memory
      0x00, // no maximum
      ...encodeU32(1), // initial 1 page (64KB)
    ]);

    // ─── Export section ─────────────────────────────────────────
    const exports: number[][] = [];
    // Export memory
    exports.push([
      ...encodeString('memory'),
      0x02, // memory export
      ...encodeU32(0), // memory index 0
    ]);
    // Export contract functions
    for (let i = 0; i < publicFns.length; i++) {
      exports.push([
        ...encodeString(publicFns[i].name),
        0x00, // function export
        ...encodeU32(numImports + i), // function index (after imports)
      ]);
    }
    const exportSection = section(SECTION.export, encodeVector(exports));

    // ─── Code section ───────────────────────────────────────────
    const codeBodies: number[][] = [];
    for (const fn of publicFns) {
      const body = this.generateFunctionBody(fn, importIndex);
      codeBodies.push(body);
    }
    const codeSection = section(SECTION.code, encodeVector(codeBodies));

    // ─── Data section ───────────────────────────────────────────
    let dataSection: number[] = [];
    if (this.dataSegments.length > 0) {
      const segments: number[][] = [];
      for (const seg of this.dataSegments) {
        segments.push([
          0x00, // active, memory 0
          OP.i32_const, ...encodeI32(seg.offset), OP.end,
          ...encodeU32(seg.data.length), ...seg.data,
        ]);
      }
      dataSection = section(SECTION.data, encodeVector(segments));
    }

    // ─── Assemble module ────────────────────────────────────────
    const module = [
      // Magic number + version
      0x00, 0x61, 0x73, 0x6d, // \0asm
      0x01, 0x00, 0x00, 0x00, // version 1
      ...typeSection,
      ...importSection,
      ...functionSection,
      ...memorySection,
      ...exportSection,
      ...codeSection,
      ...dataSection,
    ];

    return new Uint8Array(module);
  }

  private scanNeededImports(functions: FunctionDecl[]): void {
    for (const fn of functions) {
      this.scanBlockForImports(fn.body);

      // If function reads state, need storage_read + register functions
      if (this.functionReadsState(fn)) {
        this.neededImports.add('storage_read');
        this.neededImports.add('register_len');
        this.neededImports.add('read_register');
      }

      // If function writes state, need storage_write
      if (this.functionWritesState(fn)) {
        this.neededImports.add('storage_write');
      }
    }
  }

  private scanBlockForImports(block: Block): void {
    for (const stmt of block.statements) {
      if (stmt.kind === 'EmitStmt') {
        this.neededImports.add('log_utf8');
      }
      if (stmt.kind === 'DeployStmt') {
        this.neededImports.add('promise_create');
      }
      if (stmt.kind === 'IfStmt') {
        this.scanBlockForImports(stmt.then);
        if (stmt.else_ && 'kind' in stmt.else_ && stmt.else_.kind === 'Block') {
          this.scanBlockForImports(stmt.else_);
        }
      }
      if (stmt.kind === 'WhileStmt') {
        this.scanBlockForImports(stmt.body);
      }
    }
  }

  private functionReadsState(fn: FunctionDecl): boolean {
    return this.blockReadsState(fn.body);
  }

  private blockReadsState(block: Block): boolean {
    for (const stmt of block.statements) {
      if (stmt.kind === 'ReturnStmt' && stmt.value && this.exprReadsState(stmt.value)) return true;
      if (stmt.kind === 'ExprStmt' && this.exprReadsState(stmt.expr)) return true;
      if (stmt.kind === 'LetStmt' && this.exprReadsState(stmt.initializer)) return true;
      if (stmt.kind === 'AssignStmt' && this.exprReadsState(stmt.value)) return true;
      if (stmt.kind === 'IfStmt') {
        if (this.exprReadsState(stmt.condition)) return true;
        if (this.blockReadsState(stmt.then)) return true;
      }
    }
    return false;
  }

  private exprReadsState(expr: Expr): boolean {
    if (expr.kind === 'Ident' && this.storageSlots.has(expr.name)) return true;
    if (expr.kind === 'Binary') {
      return this.exprReadsState(expr.left) || this.exprReadsState(expr.right);
    }
    return false;
  }

  private functionWritesState(fn: FunctionDecl): boolean {
    return this.blockWritesState(fn.body);
  }

  private blockWritesState(block: Block): boolean {
    for (const stmt of block.statements) {
      if (stmt.kind === 'AssignStmt' && stmt.target.kind === 'Ident' && this.storageSlots.has(stmt.target.name)) {
        return true;
      }
      if (stmt.kind === 'IfStmt') {
        if (this.blockWritesState(stmt.then)) return true;
      }
    }
    return false;
  }

  private allocateString(str: string): { offset: number; length: number } {
    const existing = this.strings.get(str);
    if (existing) return existing;

    const bytes = new TextEncoder().encode(str);
    const offset = this.dataOffset;
    this.dataSegments.push({ offset, data: [...bytes] });
    this.dataOffset += bytes.length;

    const entry = { offset, length: bytes.length };
    this.strings.set(str, entry);
    return entry;
  }

  private generateFunctionBody(fn: FunctionDecl, importIndex: Map<string, number>): number[] {
    const body: number[] = [];

    // Declare locals: one i64 for each parameter + temp variables
    const localDecls: number[][] = [];
    const localMap: Map<string, number> = new Map();
    let localIdx = 0;

    // Parameters (loaded from input in body)
    for (const param of fn.params) {
      localMap.set(param.name, localIdx++);
    }

    // Temp locals for storage operations
    localMap.set('__temp', localIdx++);
    localMap.set('__temp2', localIdx++);

    if (localIdx > 0) {
      localDecls.push([...encodeU32(localIdx), WASM_I64]);
    }

    // Emit function body
    this.emitBlock(fn.body, body, importIndex, localMap);

    // End
    body.push(OP.end);

    // Encode function body
    const localSection = encodeVector(localDecls);
    const fullBody = [...localSection, ...body];
    return [...encodeU32(fullBody.length), ...fullBody];
  }

  private emitBlock(block: Block, out: number[], importIndex: Map<string, number>, locals: Map<string, number>): void {
    for (const stmt of block.statements) {
      this.emitStmt(stmt, out, importIndex, locals);
    }
  }

  private emitStmt(stmt: Stmt, out: number[], importIndex: Map<string, number>, locals: Map<string, number>): void {
    switch (stmt.kind) {
      case 'ReturnStmt':
        if (stmt.value) {
          // Store value in memory and call value_return
          this.emitExpr(stmt.value, out, importIndex, locals);
          // Store i64 at memory offset 0
          out.push(OP.local_set, ...encodeU32(locals.get('__temp')!));
          out.push(OP.i32_const, ...encodeI32(0)); // memory offset
          out.push(OP.local_get, ...encodeU32(locals.get('__temp')!));
          out.push(OP.i64_store, 0x03, 0x00); // align=8, offset=0

          // Call value_return(8, 0) — 8 bytes at offset 0
          const vrIdx = importIndex.get('value_return');
          if (vrIdx !== undefined) {
            out.push(OP.i64_const, ...encodeI64(8)); // length
            out.push(OP.i64_const, ...encodeI64(0)); // ptr
            out.push(OP.call, ...encodeU32(vrIdx));
          }
        }
        out.push(OP.return);
        break;

      case 'AssignStmt':
        if (stmt.target.kind === 'Ident') {
          const slot = this.storageSlots.get(stmt.target.name);
          if (slot !== undefined) {
            // Storage write: store value at memory temp location, then call storage_write
            const keyStr = this.strings.get(stmt.target.name)!;
            this.emitExpr(stmt.value, out, importIndex, locals);
            out.push(OP.local_set, ...encodeU32(locals.get('__temp')!));

            // Store value in memory at a temp offset
            const valueOffset = 256;
            out.push(OP.i32_const, ...encodeI32(valueOffset));
            out.push(OP.local_get, ...encodeU32(locals.get('__temp')!));
            out.push(OP.i64_store, 0x03, 0x00);

            // Call storage_write(key_len, key_ptr, value_len, value_ptr, register_id)
            const swIdx = importIndex.get('storage_write');
            if (swIdx !== undefined) {
              out.push(OP.i64_const, ...encodeI64(keyStr.length)); // key_len
              out.push(OP.i64_const, ...encodeI64(keyStr.offset)); // key_ptr
              out.push(OP.i64_const, ...encodeI64(8)); // value_len (8 bytes for i64)
              out.push(OP.i64_const, ...encodeI64(valueOffset)); // value_ptr
              out.push(OP.i64_const, ...encodeI64(0)); // register_id
              out.push(OP.call, ...encodeU32(swIdx));
              out.push(OP.drop); // drop return value
            }
          } else {
            // Local variable
            const localIdx = locals.get(stmt.target.name);
            if (localIdx !== undefined) {
              this.emitExpr(stmt.value, out, importIndex, locals);
              out.push(OP.local_set, ...encodeU32(localIdx));
            }
          }
        }
        break;

      case 'LetStmt': {
        // Allocate a new local (reuse __temp2 for MVP)
        this.emitExpr(stmt.initializer, out, importIndex, locals);
        const idx = locals.get(stmt.name);
        if (idx !== undefined) {
          out.push(OP.local_set, ...encodeU32(idx));
        } else {
          out.push(OP.drop);
        }
        break;
      }

      case 'ExprStmt':
        this.emitExpr(stmt.expr, out, importIndex, locals);
        out.push(OP.drop);
        break;

      case 'IfStmt':
        this.emitExpr(stmt.condition, out, importIndex, locals);
        // Wrap i64 condition to i32
        out.push(OP.i64_eqz);
        out.push(OP.i32_eqz); // double negate: nonzero i64 -> true
        out.push(OP.if, 0x40); // void block
        this.emitBlock(stmt.then, out, importIndex, locals);
        if (stmt.else_ && 'kind' in stmt.else_ && stmt.else_.kind === 'Block') {
          out.push(OP.else);
          this.emitBlock(stmt.else_, out, importIndex, locals);
        }
        out.push(OP.end);
        break;

      case 'WhileStmt':
        out.push(OP.block, 0x40); // outer block for break
        out.push(OP.loop, 0x40); // loop
        // Condition
        this.emitExpr(stmt.condition, out, importIndex, locals);
        out.push(OP.i64_eqz);
        out.push(OP.br_if, ...encodeU32(1)); // break out of block if zero
        // Body
        this.emitBlock(stmt.body, out, importIndex, locals);
        out.push(OP.br, ...encodeU32(0)); // continue loop
        out.push(OP.end); // end loop
        out.push(OP.end); // end block
        break;

      case 'EmitStmt': {
        // Serialize event as "EventName(args...)" and call log_utf8
        const eventStr = stmt.eventName;
        const strInfo = this.allocateString(eventStr);
        const logIdx = importIndex.get('log_utf8');
        if (logIdx !== undefined) {
          out.push(OP.i64_const, ...encodeI64(strInfo.length));
          out.push(OP.i64_const, ...encodeI64(strInfo.offset));
          out.push(OP.call, ...encodeU32(logIdx));
        }
        break;
      }

      case 'DeployStmt': {
        // Cross-contract call via promise_create
        const pcIdx = importIndex.get('promise_create');
        if (pcIdx !== undefined) {
          // For MVP, emit a placeholder promise_create call
          // account_id_len, account_id_ptr, method_name_len, method_name_ptr,
          // arguments_len, arguments_ptr, amount_ptr, gas
          for (let i = 0; i < 8; i++) {
            out.push(OP.i64_const, ...encodeI64(0));
          }
          out.push(OP.call, ...encodeU32(pcIdx));
          out.push(OP.drop);
        }
        break;
      }

      default:
        break;
    }
  }

  private emitExpr(expr: Expr, out: number[], importIndex: Map<string, number>, locals: Map<string, number>): void {
    switch (expr.kind) {
      case 'IntLiteral':
        out.push(OP.i64_const, ...encodeI64(parseInt(expr.value, 10)));
        break;

      case 'BoolLiteral':
        out.push(OP.i64_const, ...encodeI64(expr.value ? 1 : 0));
        break;

      case 'Ident': {
        const slot = this.storageSlots.get(expr.name);
        if (slot !== undefined) {
          // Read from NEAR storage
          const keyStr = this.strings.get(expr.name)!;
          const srIdx = importIndex.get('storage_read');
          const rrIdx = importIndex.get('read_register');
          if (srIdx !== undefined && rrIdx !== undefined) {
            // storage_read(key_len, key_ptr, register_id)
            out.push(OP.i64_const, ...encodeI64(keyStr.length));
            out.push(OP.i64_const, ...encodeI64(keyStr.offset));
            out.push(OP.i64_const, ...encodeI64(0)); // register 0
            out.push(OP.call, ...encodeU32(srIdx));
            out.push(OP.drop); // drop return value (1 if found, 0 if not)

            // read_register(register_id, ptr) — read into memory
            const readOffset = 512;
            out.push(OP.i64_const, ...encodeI64(0)); // register 0
            out.push(OP.i64_const, ...encodeI64(readOffset)); // destination ptr
            out.push(OP.call, ...encodeU32(rrIdx));

            // Load the value from memory
            out.push(OP.i32_const, ...encodeI32(readOffset));
            out.push(OP.i64_load, 0x03, 0x00);
          } else {
            // Fallback: push 0
            out.push(OP.i64_const, ...encodeI64(0));
          }
        } else {
          // Local variable
          const localIdx = locals.get(expr.name);
          if (localIdx !== undefined) {
            out.push(OP.local_get, ...encodeU32(localIdx));
          } else {
            out.push(OP.i64_const, ...encodeI64(0));
          }
        }
        break;
      }

      case 'Binary':
        this.emitExpr(expr.left, out, importIndex, locals);
        this.emitExpr(expr.right, out, importIndex, locals);
        switch (expr.operator) {
          case '+': out.push(OP.i64_add); break;
          case '-': out.push(OP.i64_sub); break;
          case '*': out.push(OP.i64_mul); break;
          case '/': out.push(OP.i64_div_s); break;
          case '%': out.push(OP.i64_rem_s); break;
          case '==':
            out.push(OP.i64_eq);
            out.push(OP.i64_extend_i32_s);
            break;
          case '!=':
            out.push(OP.i64_ne ? OP.i64_ne : OP.i64_eq);
            out.push(OP.i64_extend_i32_s);
            break;
          case '<':
            out.push(0x53); // i64_lt_s
            out.push(OP.i64_extend_i32_s);
            break;
          case '>':
            out.push(0x55); // i64_gt_s
            out.push(OP.i64_extend_i32_s);
            break;
          default:
            out.push(OP.i64_add);
            break;
        }
        break;

      case 'Call':
        // Emit arguments, then push 0 as result for MVP
        for (const arg of expr.args) {
          this.emitExpr(arg.value, out, importIndex, locals);
          out.push(OP.drop);
        }
        out.push(OP.i64_const, ...encodeI64(0));
        break;

      default:
        out.push(OP.i64_const, ...encodeI64(0));
        break;
    }
  }
}
