/**
 * EVM bytecode generator for the C! language.
 *
 * Generates Ethereum Virtual Machine bytecode from contract declarations.
 * Only works with `contract` blocks — non-contract code throws an error.
 *
 * Returns { bytecode: string; abi: any[] } where bytecode is a hex string
 * and abi is a JSON-compatible ABI array.
 */

import type {
  Program,
  ContractDecl,
  FunctionDecl,
  StateDecl,
  Block,
  Stmt,
  Expr,
  TypeExpr,
} from '../ast/index.js';

// ─── EVM Opcodes ────────────────────────────────────────────────────

const EVM = {
  STOP: '00', ADD: '01', MUL: '02', SUB: '03', DIV: '04', MOD: '06',
  LT: '10', GT: '11', EQ: '14', ISZERO: '15',
  POP: '50', MLOAD: '51', MSTORE: '52', SLOAD: '54', SSTORE: '55',
  JUMP: '56', JUMPI: '57', PC: '58', JUMPDEST: '5b',
  PUSH1: '60', PUSH2: '61', PUSH4: '63', PUSH32: '7f',
  DUP1: '80', SWAP1: '90',
  LOG0: 'a0', LOG1: 'a1',
  RETURN: 'f3', REVERT: 'fd',
  CALLDATALOAD: '35', CALLDATASIZE: '36',
  CODECOPY: '39', CALLER: '33',
} as const;

// ─── ABI Types ──────────────────────────────────────────────────────

interface AbiEntry {
  type: 'function' | 'event' | 'constructor';
  name: string;
  inputs: AbiParam[];
  outputs: AbiParam[];
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
}

interface AbiParam {
  name: string;
  type: string;
}

// ─── Generator ──────────────────────────────────────────────────────

export class EvmGenerator {
  private bytecode: string[] = [];
  private abi: AbiEntry[] = [];
  private storageSlots: Map<string, number> = new Map();
  private nextSlot = 0;
  private functionSelectors: Map<string, string> = new Map();
  private currentParams: Map<string, number> = new Map();

  generate(program: Program): { bytecode: string; abi: any[] } {
    // Find contract declarations
    const contracts = program.items.filter(
      (item): item is ContractDecl => item.kind === 'ContractDecl'
    );

    if (contracts.length === 0) {
      throw new Error('EVM codegen requires at least one contract declaration');
    }

    // Generate for the first contract
    const contract = contracts[0];
    this.generateContract(contract);

    return {
      bytecode: this.bytecode.join(''),
      abi: this.abi,
    };
  }

  private generateContract(contract: ContractDecl): void {
    // Phase 1: Register state variables as storage slots
    for (const member of contract.members) {
      if (member.kind === 'StateDecl') {
        this.registerStateVar(member);
      }
    }

    // Phase 2: Generate ABI entries and function selectors for public functions
    const publicFunctions: FunctionDecl[] = [];
    for (const member of contract.members) {
      if (member.kind === 'FunctionDecl' && member.visibility === 'public') {
        publicFunctions.push(member);
        this.generateAbiEntry(member);
      }
    }

    // Phase 3: Emit bytecode
    // Emit function dispatcher
    if (publicFunctions.length > 0) {
      this.emitDispatcher(publicFunctions);
    }

    // Emit function bodies
    for (const fn of publicFunctions) {
      this.emitFunctionBody(fn);
    }

    // End with STOP
    this.emit(EVM.STOP);
  }

  private registerStateVar(state: StateDecl): void {
    this.storageSlots.set(state.name, this.nextSlot++);
  }

  private generateAbiEntry(fn: FunctionDecl): void {
    const inputs: AbiParam[] = fn.params.map(p => ({
      name: p.name,
      type: this.typeToAbi(p.typeAnnotation),
    }));

    const outputs: AbiParam[] = [];
    if (fn.returnType) {
      outputs.push({
        name: '',
        type: this.typeToAbi(fn.returnType),
      });
    }

    // Determine mutability
    const hasStateWrite = this.functionWritesState(fn);
    const hasStateRead = this.functionReadsState(fn);
    let stateMutability: 'pure' | 'view' | 'nonpayable' = 'pure';
    if (hasStateWrite) {
      stateMutability = 'nonpayable';
    } else if (hasStateRead) {
      stateMutability = 'view';
    }

    const entry: AbiEntry = {
      type: 'function',
      name: fn.name,
      inputs,
      outputs,
      stateMutability,
    };
    this.abi.push(entry);

    // Generate a simple function selector (simplified — not real keccak256)
    const selector = this.simpleSelector(fn.name, inputs);
    this.functionSelectors.set(fn.name, selector);
  }

  private typeToAbi(type: TypeExpr): string {
    if (type.kind === 'NamedType') {
      switch (type.name) {
        case 'u256': return 'uint256';
        case 'u128': return 'uint128';
        case 'u64': return 'uint64';
        case 'u32': return 'uint32';
        case 'u8': return 'uint8';
        case 'i256': return 'int256';
        case 'i128': return 'int128';
        case 'i64': return 'int64';
        case 'i32': return 'int32';
        case 'bool': return 'bool';
        case 'string': case 'String': return 'string';
        case 'address': return 'address';
        default: return 'uint256';
      }
    }
    return 'uint256';
  }

  private functionWritesState(fn: FunctionDecl): boolean {
    return this.blockWritesState(fn.body);
  }

  private blockWritesState(block: Block): boolean {
    for (const stmt of block.statements) {
      if (stmt.kind === 'AssignStmt') {
        if (stmt.target.kind === 'Ident' && this.storageSlots.has(stmt.target.name)) {
          return true;
        }
      }
      if (stmt.kind === 'EmitStmt') return true;
      if (stmt.kind === 'IfStmt') {
        if (this.blockWritesState(stmt.then)) return true;
        if (stmt.else_ && 'kind' in stmt.else_ && stmt.else_.kind === 'Block') {
          if (this.blockWritesState(stmt.else_)) return true;
        }
      }
    }
    return false;
  }

  private functionReadsState(fn: FunctionDecl): boolean {
    return this.blockReadsState(fn.body);
  }

  private blockReadsState(block: Block): boolean {
    for (const stmt of block.statements) {
      if (this.stmtReadsState(stmt)) return true;
    }
    return false;
  }

  private stmtReadsState(stmt: Stmt): boolean {
    if (stmt.kind === 'ReturnStmt' && stmt.value) {
      return this.exprReadsState(stmt.value);
    }
    if (stmt.kind === 'ExprStmt') {
      return this.exprReadsState(stmt.expr);
    }
    if (stmt.kind === 'LetStmt') {
      return this.exprReadsState(stmt.initializer);
    }
    if (stmt.kind === 'AssignStmt') {
      return this.exprReadsState(stmt.value);
    }
    if (stmt.kind === 'IfStmt') {
      if (this.exprReadsState(stmt.condition)) return true;
      if (this.blockReadsState(stmt.then)) return true;
      if (stmt.else_ && 'kind' in stmt.else_ && stmt.else_.kind === 'Block') {
        if (this.blockReadsState(stmt.else_)) return true;
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

  /** Simple selector: first 4 bytes of a simplified hash. Not real keccak256. */
  private simpleSelector(name: string, inputs: AbiParam[]): string {
    const sig = name + '(' + inputs.map(i => i.type).join(',') + ')';
    // Simple hash for MVP (not keccak256)
    let hash = 0;
    for (let i = 0; i < sig.length; i++) {
      hash = ((hash << 5) - hash + sig.charCodeAt(i)) | 0;
    }
    const hex = (hash >>> 0).toString(16).padStart(8, '0');
    return hex;
  }

  private emitDispatcher(functions: FunctionDecl[]): void {
    // Load function selector from calldata (first 4 bytes)
    // PUSH1 0x00 CALLDATALOAD — loads 32 bytes from offset 0
    this.emit(EVM.PUSH1);
    this.emit('00');
    this.emit(EVM.CALLDATALOAD);

    // Shift right by 224 bits to get first 4 bytes
    // PUSH1 0xe0 (224) — we use PUSH1 with SHR equivalent
    // For MVP, we use a simpler approach: just compare against selectors
    // The calldataload gives us 32 bytes, but we'll compare against full 32-byte padded selectors

    for (const fn of functions) {
      const selector = this.functionSelectors.get(fn.name)!;

      // DUP1 — duplicate the selector on stack
      this.emit(EVM.DUP1);

      // PUSH4 <selector>
      this.emit(EVM.PUSH4);
      this.emit(selector);

      // EQ
      this.emit(EVM.EQ);

      // PUSH2 <offset> — placeholder, we'll resolve later
      this.emit(EVM.PUSH2);
      // Placeholder jump target (bytecode.length used for patching later)
      this.emit('00');
      this.emit('00');

      // JUMPI
      this.emit(EVM.JUMPI);

      // Store jump target for later resolution
      // For MVP, we just proceed sequentially
    }

    // If no match, revert
    this.emit(EVM.REVERT);
  }

  private emitFunctionBody(fn: FunctionDecl): void {
    // JUMPDEST marks the start of a function
    this.emit(EVM.JUMPDEST);

    // Register function parameters for CALLDATALOAD
    this.currentParams.clear();
    for (let i = 0; i < fn.params.length; i++) {
      // Each param is 32 bytes in calldata, starting at offset 4 (after selector)
      this.currentParams.set(fn.params[i].name, 4 + i * 32);
    }

    // Emit function body statements
    for (const stmt of fn.body.statements) {
      this.emitStmt(stmt);
    }

    // End function with STOP
    this.emit(EVM.STOP);
  }

  private emitStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case 'ReturnStmt':
        if (stmt.value) {
          this.emitExpr(stmt.value);
          // Store return value in memory and return
          this.emit(EVM.PUSH1);
          this.emit('00'); // memory offset
          this.emit(EVM.MSTORE);
          this.emit(EVM.PUSH1);
          this.emit('20'); // 32 bytes
          this.emit(EVM.PUSH1);
          this.emit('00'); // memory offset
          this.emit(EVM.RETURN);
        } else {
          this.emit(EVM.STOP);
        }
        break;

      case 'AssignStmt':
        if (stmt.target.kind === 'Ident') {
          const slot = this.storageSlots.get(stmt.target.name);
          if (slot !== undefined) {
            // State variable write: value PUSH slot SSTORE
            this.emitExpr(stmt.value);
            this.emit(EVM.PUSH1);
            this.emit(slot.toString(16).padStart(2, '0'));
            this.emit(EVM.SSTORE);
          }
        }
        break;

      case 'LetStmt':
        // For MVP, just emit the initializer expression
        this.emitExpr(stmt.initializer);
        break;

      case 'ExprStmt':
        this.emitExpr(stmt.expr);
        this.emit(EVM.POP);
        break;

      case 'IfStmt':
        this.emitIfStmt(stmt);
        break;

      case 'WhileStmt':
        this.emitWhileStmt(stmt);
        break;

      case 'EmitStmt':
        this.emitEmitStmt(stmt);
        break;

      default:
        // Unsupported statement types are silently skipped for MVP
        break;
    }
  }

  private emitIfStmt(stmt: Stmt & { kind: 'IfStmt' }): void {
    // Emit condition
    this.emitExpr(stmt.condition);

    // ISZERO — negate (jump if false)
    this.emit(EVM.ISZERO);

    // PUSH2 <else-offset>
    this.emit(EVM.PUSH2);
    this.emit('00');
    this.emit('00');

    // JUMPI
    this.emit(EVM.JUMPI);

    // Then branch
    for (const s of stmt.then.statements) {
      this.emitStmt(s);
    }

    // JUMPDEST for else/end
    this.emit(EVM.JUMPDEST);

    // Emit else branch if present
    if (stmt.else_ && 'kind' in stmt.else_ && stmt.else_.kind === 'Block') {
      for (const s of stmt.else_.statements) {
        this.emitStmt(s);
      }
    }
  }

  private emitWhileStmt(stmt: Stmt & { kind: 'WhileStmt' }): void {
    // JUMPDEST — loop top
    this.emit(EVM.JUMPDEST);

    // Emit condition
    this.emitExpr(stmt.condition);

    // ISZERO — jump to end if false
    this.emit(EVM.ISZERO);

    // PUSH2 <end-offset>
    this.emit(EVM.PUSH2);
    this.emit('00');
    this.emit('00');

    // JUMPI
    this.emit(EVM.JUMPI);

    // Body
    for (const s of stmt.body.statements) {
      this.emitStmt(s);
    }

    // JUMP back to loop top
    this.emit(EVM.PUSH2);
    this.emit('00');
    this.emit('00');
    this.emit(EVM.JUMP);

    // JUMPDEST — loop end
    this.emit(EVM.JUMPDEST);
  }

  private emitEmitStmt(stmt: Stmt & { kind: 'EmitStmt' }): void {
    // Generate topic from event name (simplified hash)
    const topicHash = this.simpleSelector(stmt.eventName, []);

    // Push arguments to memory
    for (const arg of stmt.args) {
      this.emitExpr(arg);
    }

    // Store data in memory for LOG
    this.emit(EVM.PUSH1);
    this.emit('00'); // memory offset
    this.emit(EVM.MSTORE);

    // PUSH32 topic
    this.emit(EVM.PUSH32);
    this.emit(topicHash.padStart(64, '0'));

    // data length
    this.emit(EVM.PUSH1);
    this.emit('20'); // 32 bytes

    // data offset
    this.emit(EVM.PUSH1);
    this.emit('00');

    // LOG1
    this.emit(EVM.LOG1);
  }

  private emitExpr(expr: Expr): void {
    switch (expr.kind) {
      case 'IntLiteral': {
        const val = parseInt(expr.value, 10);
        if (val <= 0xff) {
          this.emit(EVM.PUSH1);
          this.emit(val.toString(16).padStart(2, '0'));
        } else if (val <= 0xffff) {
          this.emit(EVM.PUSH2);
          this.emit(val.toString(16).padStart(4, '0'));
        } else {
          this.emit(EVM.PUSH4);
          this.emit(val.toString(16).padStart(8, '0'));
        }
        break;
      }

      case 'BoolLiteral':
        this.emit(EVM.PUSH1);
        this.emit(expr.value ? '01' : '00');
        break;

      case 'Ident': {
        const slot = this.storageSlots.get(expr.name);
        if (slot !== undefined) {
          // State variable read: PUSH slot SLOAD
          this.emit(EVM.PUSH1);
          this.emit(slot.toString(16).padStart(2, '0'));
          this.emit(EVM.SLOAD);
        } else {
          // Function parameter — load from calldata
          const paramOffset = this.currentParams.get(expr.name);
          if (paramOffset !== undefined) {
            this.emit(EVM.PUSH1);
            this.emit(paramOffset.toString(16).padStart(2, '0'));
            this.emit(EVM.CALLDATALOAD);
          } else {
            // Unknown local — push 0 as placeholder for MVP
            this.emit(EVM.PUSH1);
            this.emit('00');
          }
        }
        break;
      }

      case 'Binary':
        // Push left, push right, then operator
        this.emitExpr(expr.left);
        this.emitExpr(expr.right);
        switch (expr.operator) {
          case '+': this.emit(EVM.ADD); break;
          case '-': this.emit(EVM.SUB); break;
          case '*': this.emit(EVM.MUL); break;
          case '/': this.emit(EVM.DIV); break;
          case '%': this.emit(EVM.MOD); break;
          case '<': this.emit(EVM.LT); break;
          case '>': this.emit(EVM.GT); break;
          case '==': this.emit(EVM.EQ); break;
          default:
            // Unsupported operator — emit ADD as fallback
            this.emit(EVM.ADD);
            break;
        }
        break;

      case 'Call':
        // Emit arguments
        for (const arg of expr.args) {
          this.emitExpr(arg.value);
        }
        break;

      default:
        // Unsupported expression — push 0
        this.emit(EVM.PUSH1);
        this.emit('00');
        break;
    }
  }

  private emit(opcode: string): void {
    this.bytecode.push(opcode);
  }
}
