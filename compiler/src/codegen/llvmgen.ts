/**
 * LLVM IR text code generator for the C! language.
 *
 * Walks the AST produced by the parser and emits LLVM IR (.ll) text.
 * The output can be executed with `lli` or compiled with `llc`.
 */

import type {
  Program,
  TopLevelItem,
  FunctionDecl,
  TypeDecl,
  EnumDecl,
  ActorDecl,
  Block,
  Stmt,
  Expr,
  Parameter,
  StateDecl,
} from '../ast/index.js';

export class LlvmGenerator {
  /** Accumulated IR output lines */
  private lines: string[] = [];
  /** SSA temporary counter */
  private tempCounter: number = 0;
  /** Label counter for basic blocks */
  private labelCounter: number = 0;
  /** Closure counter */
  private closureCounter: number = 0;
  /** String constants: map from content to global name */
  private stringConstants: Map<string, string> = new Map();
  /** String constant counter */
  private stringCounter: number = 0;
  /** Variable addresses: map from name to SSA alloca name */
  private varAddrs: Map<string, string> = new Map();
  /** Variable types: map from name to LLVM type string */
  private varTypes: Map<string, string> = new Map();
  /** Whether current function is main */
  private isMainFn: boolean = false;
  /** Whether current block has been terminated */
  private blockTerminated: boolean = false;
  /** Struct type definitions: name -> field types */
  private structTypes: Map<string, string[]> = new Map();
  /** Struct field names: name -> field names list */
  private structFieldNames: Map<string, string[]> = new Map();
  /** Enum variant tag values: variant name -> tag number */
  private enumTags: Map<string, number> = new Map();
  /** Deferred function bodies (closures, actor handlers) */
  private deferredFunctions: string[] = [];
  /** Actor state fields: actor name -> field info */
  private actorFields: Map<string, { names: string[]; types: string[] }> = new Map();
  /** Current actor name when inside actor handler */
  private currentActorName: string | null = null;
  /** Current actor self pointer */
  private currentActorSelf: string | null = null;
  /** Known function return types */
  private functionReturnTypes: Map<string, string> = new Map();
  /** Known function param types */
  private functionParamTypes: Map<string, string[]> = new Map();

  // ─── Main entry point ─────────────────────────────────────────────

  generate(program: Program): string {
    this.lines = [];
    this.tempCounter = 0;
    this.labelCounter = 0;
    this.closureCounter = 0;
    this.stringConstants = new Map();
    this.stringCounter = 0;
    this.varAddrs = new Map();
    this.varTypes = new Map();
    this.isMainFn = false;
    this.blockTerminated = false;
    this.structTypes = new Map();
    this.structFieldNames = new Map();
    this.enumTags = new Map();
    this.deferredFunctions = [];
    this.actorFields = new Map();
    this.currentActorName = null;
    this.currentActorSelf = null;
    this.functionReturnTypes = new Map();
    this.functionParamTypes = new Map();

    // Pre-pass: collect struct types, enum tags, function signatures, actor types
    for (const item of program.items) {
      this.collectTopLevel(item);
    }

    // Emit module header
    const header: string[] = [];
    header.push('; ModuleID = \'cbang_module\'');
    header.push('source_filename = "test.cb"');
    header.push('target triple = "x86_64-pc-linux-gnu"');
    header.push('');

    // Emit top-level items into body lines
    const bodyLines: string[] = [];
    for (const item of program.items) {
      this.lines = [];
      this.emitTopLevel(item);
      bodyLines.push(...this.lines);
    }

    // Gather all pieces: header, string constants, struct types, body, deferred, printf decl
    const result: string[] = [...header];

    // Struct type declarations
    for (const [name, fieldTypes] of this.structTypes) {
      result.push(`%${name} = type { ${fieldTypes.join(', ')} }`);
    }
    if (this.structTypes.size > 0) result.push('');

    // String constants
    for (const [content, name] of this.stringConstants) {
      const escaped = this.escapeStringForLlvm(content);
      const len = this.computeStringLength(content) + 1; // +1 for null terminator
      result.push(`${name} = private unnamed_addr constant [${len} x i8] c"${escaped}\\00"`);
    }
    if (this.stringConstants.size > 0) result.push('');

    // Body (functions)
    result.push(...bodyLines);

    // Deferred functions (closures, actor handlers)
    if (this.deferredFunctions.length > 0) {
      result.push(...this.deferredFunctions);
    }

    // Printf declaration if any string was used
    if (this.stringConstants.size > 0) {
      result.push('declare i32 @printf(i8*, ...)');
      result.push('');
    }

    return result.join('\n') + '\n';
  }

  // ─── Pre-pass collection ──────────────────────────────────────────

  private collectTopLevel(item: TopLevelItem): void {
    switch (item.kind) {
      case 'FunctionDecl':
        this.collectFunction(item);
        break;
      case 'TypeDecl':
        this.collectTypeDecl(item);
        break;
      case 'EnumDecl':
        this.collectEnumDecl(item);
        break;
      case 'ActorDecl':
        this.collectActorDecl(item);
        break;
    }
  }

  private collectFunction(decl: FunctionDecl): void {
    const retType = this.resolveReturnType(decl);
    this.functionReturnTypes.set(decl.name, retType);
    const paramTypes = decl.params.map(p => this.resolveParamType(p));
    this.functionParamTypes.set(decl.name, paramTypes);
  }

  private collectTypeDecl(decl: TypeDecl): void {
    if (decl.body.kind === 'Struct') {
      const fieldTypes = decl.body.fields.map(f => this.typeExprToLlvm(f.typeAnnotation));
      const fieldNames = decl.body.fields.map(f => f.name);
      this.structTypes.set(decl.name, fieldTypes);
      this.structFieldNames.set(decl.name, fieldNames);
    }
  }

  private collectEnumDecl(decl: EnumDecl): void {
    for (let i = 0; i < decl.variants.length; i++) {
      this.enumTags.set(decl.variants[i]!.name, i);
    }
  }

  private collectActorDecl(decl: ActorDecl): void {
    const stateMembers = decl.members.filter(m => m.kind === 'StateDecl') as StateDecl[];
    const fieldNames = stateMembers.map(s => s.name);
    const fieldTypes = stateMembers.map(s => this.typeExprToLlvm(s.typeAnnotation));
    this.actorFields.set(decl.name, { names: fieldNames, types: fieldTypes });
    // Register as struct type
    this.structTypes.set(decl.name, fieldTypes.length > 0 ? fieldTypes : ['i64']);
  }

  // ─── Top-level emission ───────────────────────────────────────────

  private emitTopLevel(item: TopLevelItem): void {
    switch (item.kind) {
      case 'FunctionDecl':
        this.emitFunction(item);
        break;
      case 'TypeDecl':
        // Struct types are emitted in the header; nothing to do here
        break;
      case 'EnumDecl':
        // Enum tags are constants; nothing to emit
        break;
      case 'ActorDecl':
        this.emitActorDecl(item);
        break;
      default:
        // UseDecl, ModDecl, StateDecl, ContractDecl, ServerDecl, ComponentDecl
        // are not supported in LLVM IR codegen yet
        break;
    }
  }

  // ─── Function emission ────────────────────────────────────────────

  private emitFunction(decl: FunctionDecl): void {
    this.tempCounter = 0;
    this.labelCounter = 0;
    this.varAddrs = new Map();
    this.varTypes = new Map();
    this.isMainFn = decl.name === 'main';
    this.blockTerminated = false;

    const retType = this.isMainFn ? 'i32' : (this.functionReturnTypes.get(decl.name) || 'void');
    const params = decl.params.map(p => {
      const ty = this.resolveParamType(p);
      return `${ty} %${p.name}`;
    }).join(', ');

    this.emit(`define ${retType} @${decl.name}(${params}) {`);
    this.emit('entry:');

    // Alloca for parameters so they can be loaded by name
    for (const p of decl.params) {
      const ty = this.resolveParamType(p);
      const addr = `%${p.name}.addr`;
      this.emit(`  ${addr} = alloca ${ty}`);
      this.emit(`  store ${ty} %${p.name}, ${ty}* ${addr}`);
      this.varAddrs.set(p.name, addr);
      this.varTypes.set(p.name, ty);
    }

    this.emitBlock(decl.body);

    // Ensure terminator
    if (!this.blockTerminated) {
      if (this.isMainFn) {
        this.emit('  ret i32 0');
      } else if (retType === 'void') {
        this.emit('  ret void');
      } else {
        this.emit(`  ret ${retType} 0`);
      }
    }

    this.emit('}');
    this.emit('');
  }

  // ─── Block emission ───────────────────────────────────────────────

  private emitBlock(block: Block): void {
    for (const stmt of block.statements) {
      if (this.blockTerminated) break;
      this.emitStmt(stmt);
    }
  }

  // ─── Statement emission ───────────────────────────────────────────

  private emitStmt(stmt: Stmt): void {
    if (this.blockTerminated) return;
    switch (stmt.kind) {
      case 'LetStmt':
        this.emitLetStmt(stmt);
        break;
      case 'AssignStmt':
        this.emitAssignStmt(stmt);
        break;
      case 'ReturnStmt':
        this.emitReturnStmt(stmt);
        break;
      case 'ExprStmt':
        this.emitExpr(stmt.expr);
        break;
      case 'IfStmt':
        this.emitIfStmt(stmt);
        break;
      case 'WhileStmt':
        this.emitWhileStmt(stmt);
        break;
      case 'ForStmt':
        this.emitForStmt(stmt);
        break;
      case 'MatchStmt':
        this.emitMatchStmt(stmt);
        break;
      default:
        // ReplyStmt, EmitStmt, SpawnStmt, DeployStmt — not yet supported
        break;
    }
  }

  private emitLetStmt(stmt: import('../ast/index.js').LetStmt): void {
    const ty = this.inferType(stmt.initializer, stmt.typeAnnotation);
    const addr = `%${stmt.name}.addr`;
    this.emit(`  ${addr} = alloca ${ty}`);
    const val = this.emitExpr(stmt.initializer);
    this.emit(`  store ${ty} ${val}, ${ty}* ${addr}`);
    this.varAddrs.set(stmt.name, addr);
    this.varTypes.set(stmt.name, ty);
  }

  private emitAssignStmt(stmt: import('../ast/index.js').AssignStmt): void {
    if (stmt.target.kind === 'Ident') {
      const name = stmt.target.name;
      // Check if we're inside an actor and this is a state field
      if (this.currentActorName && this.currentActorSelf) {
        const fields = this.actorFields.get(this.currentActorName);
        if (fields) {
          const idx = fields.names.indexOf(name);
          if (idx >= 0) {
            const fieldType = fields.types[idx]!;
            let val: string;
            if (stmt.operator === '+=' || stmt.operator === '-=') {
              // Load current value first
              const gepPtr = this.nextTemp();
              this.emit(`  ${gepPtr} = getelementptr inbounds %${this.currentActorName}, %${this.currentActorName}* ${this.currentActorSelf}, i32 0, i32 ${idx}`);
              const curVal = this.nextTemp();
              this.emit(`  ${curVal} = load ${fieldType}, ${fieldType}* ${gepPtr}`);
              const rhsVal = this.emitExpr(stmt.value);
              const result = this.nextTemp();
              const op = stmt.operator === '+=' ? 'add' : 'sub';
              this.emit(`  ${result} = ${op} ${fieldType} ${curVal}, ${rhsVal}`);
              val = result;
            } else {
              val = this.emitExpr(stmt.value);
            }
            const gep = this.nextTemp();
            this.emit(`  ${gep} = getelementptr inbounds %${this.currentActorName}, %${this.currentActorName}* ${this.currentActorSelf}, i32 0, i32 ${idx}`);
            this.emit(`  store ${fieldType} ${val}, ${fieldType}* ${gep}`);
            return;
          }
        }
      }

      const addr = this.varAddrs.get(name);
      const ty = this.varTypes.get(name) || 'i64';
      if (addr) {
        if (stmt.operator === '+=' || stmt.operator === '-=') {
          const curVal = this.nextTemp();
          this.emit(`  ${curVal} = load ${ty}, ${ty}* ${addr}`);
          const rhsVal = this.emitExpr(stmt.value);
          const result = this.nextTemp();
          const op = stmt.operator === '+=' ? 'add' : 'sub';
          this.emit(`  ${result} = ${op} ${ty} ${curVal}, ${rhsVal}`);
          this.emit(`  store ${ty} ${result}, ${ty}* ${addr}`);
        } else {
          const val = this.emitExpr(stmt.value);
          this.emit(`  store ${ty} ${val}, ${ty}* ${addr}`);
        }
      }
    } else if (stmt.target.kind === 'FieldAccess') {
      this.emitFieldStore(stmt.target, this.emitExpr(stmt.value));
    }
  }

  private emitReturnStmt(stmt: import('../ast/index.js').ReturnStmt): void {
    if (this.isMainFn) {
      if (stmt.value) {
        const val = this.emitExpr(stmt.value);
        // Truncate i64 to i32 for main
        const trunc = this.nextTemp();
        this.emit(`  ${trunc} = trunc i64 ${val} to i32`);
        this.emit(`  ret i32 ${trunc}`);
      } else {
        this.emit('  ret i32 0');
      }
    } else {
      if (stmt.value) {
        const val = this.emitExpr(stmt.value);
        const ty = this.varTypes.get('__return') || 'i64';
        this.emit(`  ret ${ty} ${val}`);
      } else {
        this.emit('  ret void');
      }
    }
    this.blockTerminated = true;
  }

  private emitIfStmt(stmt: import('../ast/index.js').IfStmt): void {
    const n = this.labelCounter++;
    const thenLabel = `then${n}`;
    const elseLabel = `else${n}`;
    const endLabel = `endif${n}`;

    const condVal = this.emitExpr(stmt.condition);
    const condType = this.lastExprType(stmt.condition);
    let condBool: string;
    if (condType === 'i1') {
      condBool = condVal;
    } else if (condType === 'double') {
      condBool = this.nextTemp();
      this.emit(`  ${condBool} = fcmp one double ${condVal}, 0.0`);
    } else {
      condBool = this.nextTemp();
      this.emit(`  ${condBool} = icmp ne i64 ${condVal}, 0`);
    }

    if (stmt.else_) {
      this.emit(`  br i1 ${condBool}, label %${thenLabel}, label %${elseLabel}`);
    } else {
      this.emit(`  br i1 ${condBool}, label %${thenLabel}, label %${endLabel}`);
    }

    this.emit(`${thenLabel}:`);
    this.blockTerminated = false;
    this.emitBlock(stmt.then);
    if (!this.blockTerminated) {
      this.emit(`  br label %${endLabel}`);
    }

    if (stmt.else_) {
      this.emit(`${elseLabel}:`);
      this.blockTerminated = false;
      if (stmt.else_.kind === 'IfStmt') {
        this.emitIfStmt(stmt.else_);
        if (!this.blockTerminated) {
          this.emit(`  br label %${endLabel}`);
        }
      } else {
        this.emitBlock(stmt.else_);
        if (!this.blockTerminated) {
          this.emit(`  br label %${endLabel}`);
        }
      }
    }

    this.emit(`${endLabel}:`);
    this.blockTerminated = false;
  }

  private emitWhileStmt(stmt: import('../ast/index.js').WhileStmt): void {
    const n = this.labelCounter++;
    const loopLabel = `loop${n}`;
    const bodyLabel = `body${n}`;
    const endLabel = `endloop${n}`;

    this.emit(`  br label %${loopLabel}`);
    this.emit(`${loopLabel}:`);

    const condVal = this.emitExpr(stmt.condition);
    const condType = this.lastExprType(stmt.condition);
    let condBool: string;
    if (condType === 'i1') {
      condBool = condVal;
    } else if (condType === 'double') {
      condBool = this.nextTemp();
      this.emit(`  ${condBool} = fcmp one double ${condVal}, 0.0`);
    } else {
      condBool = this.nextTemp();
      this.emit(`  ${condBool} = icmp ne i64 ${condVal}, 0`);
    }

    this.emit(`  br i1 ${condBool}, label %${bodyLabel}, label %${endLabel}`);
    this.emit(`${bodyLabel}:`);
    this.blockTerminated = false;
    this.emitBlock(stmt.body);
    if (!this.blockTerminated) {
      this.emit(`  br label %${loopLabel}`);
    }
    this.emit(`${endLabel}:`);
    this.blockTerminated = false;
  }

  private emitForStmt(stmt: import('../ast/index.js').ForStmt): void {
    // Desugar for x in range(a, b) to a while loop
    if (stmt.iterable.kind === 'Call' && stmt.iterable.callee.kind === 'Ident' && stmt.iterable.callee.name === 'range') {
      const startExpr = stmt.iterable.args[0]?.value;
      const endExpr = stmt.iterable.args[1]?.value;
      if (startExpr && endExpr) {
        // Alloca for loop variable
        const addr = `%${stmt.variable}.addr`;
        this.emit(`  ${addr} = alloca i64`);
        const startVal = this.emitExpr(startExpr);
        this.emit(`  store i64 ${startVal}, i64* ${addr}`);
        this.varAddrs.set(stmt.variable, addr);
        this.varTypes.set(stmt.variable, 'i64');

        const endVal = this.emitExpr(endExpr);
        // Save end value
        const endAddr = `%__for_end${this.labelCounter}.addr`;
        this.emit(`  ${endAddr} = alloca i64`);
        this.emit(`  store i64 ${endVal}, i64* ${endAddr}`);

        const n = this.labelCounter++;
        const loopLabel = `loop${n}`;
        const bodyLabel = `body${n}`;
        const endLabel = `endloop${n}`;

        this.emit(`  br label %${loopLabel}`);
        this.emit(`${loopLabel}:`);

        const curVal = this.nextTemp();
        this.emit(`  ${curVal} = load i64, i64* ${addr}`);
        const endCur = this.nextTemp();
        this.emit(`  ${endCur} = load i64, i64* ${endAddr}`);
        const cmp = this.nextTemp();
        this.emit(`  ${cmp} = icmp slt i64 ${curVal}, ${endCur}`);
        this.emit(`  br i1 ${cmp}, label %${bodyLabel}, label %${endLabel}`);

        this.emit(`${bodyLabel}:`);
        this.blockTerminated = false;
        this.emitBlock(stmt.body);

        if (!this.blockTerminated) {
          // Increment loop variable
          const cur2 = this.nextTemp();
          this.emit(`  ${cur2} = load i64, i64* ${addr}`);
          const inc = this.nextTemp();
          this.emit(`  ${inc} = add i64 ${cur2}, 1`);
          this.emit(`  store i64 ${inc}, i64* ${addr}`);
          this.emit(`  br label %${loopLabel}`);
        }

        this.emit(`${endLabel}:`);
        this.blockTerminated = false;
        return;
      }
    }
    // Fallback: emit the body once (unsupported iterable)
    this.emitBlock(stmt.body);
  }

  private emitMatchStmt(stmt: import('../ast/index.js').MatchStmt): void {
    const subjectVal = this.emitExpr(stmt.subject);
    const n = this.labelCounter++;
    const endLabel = `endmatch${n}`;

    // Collect cases: literal patterns for switch, wildcard for default
    const cases: { value: string; label: string }[] = [];
    let defaultLabel = endLabel;
    const armLabels: string[] = [];

    for (let i = 0; i < stmt.arms.length; i++) {
      const arm = stmt.arms[i]!;
      const label = `case${n}_${i}`;
      armLabels.push(label);

      if (arm.pattern.kind === 'WildcardPattern' || arm.pattern.kind === 'IdentPattern') {
        defaultLabel = label;
      } else if (arm.pattern.kind === 'LiteralPattern') {
        const val = typeof arm.pattern.value === 'boolean'
          ? (arm.pattern.value ? '1' : '0')
          : String(arm.pattern.value);
        cases.push({ value: val, label });
      } else if (arm.pattern.kind === 'ConstructorPattern') {
        // Check if it's an enum variant
        const tag = this.enumTags.get(arm.pattern.name);
        if (tag !== undefined) {
          cases.push({ value: String(tag), label });
        }
      }
    }

    // Emit switch
    let switchBody = cases.map(c => `    i64 ${c.value}, label %${c.label}`).join('\n');
    if (switchBody) switchBody = '\n' + switchBody + '\n  ';
    this.emit(`  switch i64 ${subjectVal}, label %${defaultLabel} [${switchBody}]`);

    // Emit arm bodies
    for (let i = 0; i < stmt.arms.length; i++) {
      const arm = stmt.arms[i]!;
      const label = armLabels[i]!;
      this.emit(`${label}:`);
      this.blockTerminated = false;

      // Bind identifier pattern
      if (arm.pattern.kind === 'IdentPattern') {
        const addr = `%${arm.pattern.name}.addr`;
        this.emit(`  ${addr} = alloca i64`);
        this.emit(`  store i64 ${subjectVal}, i64* ${addr}`);
        this.varAddrs.set(arm.pattern.name, addr);
        this.varTypes.set(arm.pattern.name, 'i64');
      }

      if (arm.body.kind === 'Block') {
        this.emitBlock(arm.body);
      } else {
        // Expression body
        this.emitExpr(arm.body);
      }
      if (!this.blockTerminated) {
        this.emit(`  br label %${endLabel}`);
      }
    }

    this.emit(`${endLabel}:`);
    this.blockTerminated = false;
  }

  // ─── Expression emission ──────────────────────────────────────────

  /** Emit an expression and return the SSA name or literal representing its value */
  private emitExpr(expr: Expr): string {
    switch (expr.kind) {
      case 'IntLiteral':
        return expr.value;
      case 'FloatLiteral':
        return this.formatFloat(expr.value);
      case 'BoolLiteral':
        return expr.value ? '1' : '0';
      case 'StringLiteral':
        return this.emitStringLiteral(expr.value);
      case 'StringInterpolation':
        return this.emitStringInterpolation(expr);
      case 'Ident':
        return this.emitIdent(expr.name);
      case 'Binary':
        return this.emitBinary(expr);
      case 'Unary':
        return this.emitUnary(expr);
      case 'Call':
        return this.emitCall(expr);
      case 'MacroCall':
        return this.emitMacroCall(expr);
      case 'Struct':
        return this.emitStructExpr(expr);
      case 'FieldAccess':
        return this.emitFieldAccess(expr);
      case 'Closure':
        return this.emitClosure(expr);
      case 'ArrayLiteral':
        return this.emitArrayLiteral(expr);
      case 'Index':
        return this.emitIndex(expr);
      case 'Path':
        // Check if it's an enum variant
        if (expr.segments.length === 1) {
          const tag = this.enumTags.get(expr.segments[0]!);
          if (tag !== undefined) return String(tag);
        }
        return '0';
      default:
        return '0';
    }
  }

  private emitIdent(name: string): string {
    // Check if inside actor and this is a state field
    if (this.currentActorName && this.currentActorSelf) {
      const fields = this.actorFields.get(this.currentActorName);
      if (fields) {
        const idx = fields.names.indexOf(name);
        if (idx >= 0) {
          const fieldType = fields.types[idx]!;
          const gep = this.nextTemp();
          this.emit(`  ${gep} = getelementptr inbounds %${this.currentActorName}, %${this.currentActorName}* ${this.currentActorSelf}, i32 0, i32 ${idx}`);
          const val = this.nextTemp();
          this.emit(`  ${val} = load ${fieldType}, ${fieldType}* ${gep}`);
          return val;
        }
      }
    }

    const addr = this.varAddrs.get(name);
    const ty = this.varTypes.get(name) || 'i64';
    if (addr) {
      const tmp = this.nextTemp();
      this.emit(`  ${tmp} = load ${ty}, ${ty}* ${addr}`);
      return tmp;
    }
    // Check if it's an enum variant
    const tag = this.enumTags.get(name);
    if (tag !== undefined) return String(tag);
    return `%${name}`;
  }

  private emitBinary(expr: import('../ast/index.js').BinaryExpr): string {
    const left = this.emitExpr(expr.left);
    const leftType = this.lastExprType(expr.left);
    const right = this.emitExpr(expr.right);
    const tmp = this.nextTemp();

    const isFloat = leftType === 'double' || this.lastExprType(expr.right) === 'double';

    if (isFloat) {
      switch (expr.operator) {
        case '+': this.emit(`  ${tmp} = fadd double ${left}, ${right}`); return tmp;
        case '-': this.emit(`  ${tmp} = fsub double ${left}, ${right}`); return tmp;
        case '*': this.emit(`  ${tmp} = fmul double ${left}, ${right}`); return tmp;
        case '/': this.emit(`  ${tmp} = fdiv double ${left}, ${right}`); return tmp;
        case '<': this.emit(`  ${tmp} = fcmp olt double ${left}, ${right}`); return tmp;
        case '>': this.emit(`  ${tmp} = fcmp ogt double ${left}, ${right}`); return tmp;
        case '<=': this.emit(`  ${tmp} = fcmp ole double ${left}, ${right}`); return tmp;
        case '>=': this.emit(`  ${tmp} = fcmp oge double ${left}, ${right}`); return tmp;
        case '==': this.emit(`  ${tmp} = fcmp oeq double ${left}, ${right}`); return tmp;
        case '!=': this.emit(`  ${tmp} = fcmp one double ${left}, ${right}`); return tmp;
      }
    }

    switch (expr.operator) {
      case '+': this.emit(`  ${tmp} = add i64 ${left}, ${right}`); break;
      case '-': this.emit(`  ${tmp} = sub i64 ${left}, ${right}`); break;
      case '*': this.emit(`  ${tmp} = mul i64 ${left}, ${right}`); break;
      case '/': this.emit(`  ${tmp} = sdiv i64 ${left}, ${right}`); break;
      case '%': this.emit(`  ${tmp} = srem i64 ${left}, ${right}`); break;
      case '<': this.emit(`  ${tmp} = icmp slt i64 ${left}, ${right}`); break;
      case '>': this.emit(`  ${tmp} = icmp sgt i64 ${left}, ${right}`); break;
      case '<=': this.emit(`  ${tmp} = icmp sle i64 ${left}, ${right}`); break;
      case '>=': this.emit(`  ${tmp} = icmp sge i64 ${left}, ${right}`); break;
      case '==': this.emit(`  ${tmp} = icmp eq i64 ${left}, ${right}`); break;
      case '!=': this.emit(`  ${tmp} = icmp ne i64 ${left}, ${right}`); break;
      case '&&': {
        // Both as i64: result = left & right (simplified)
        this.emit(`  ${tmp} = and i64 ${left}, ${right}`);
        break;
      }
      case '||': {
        this.emit(`  ${tmp} = or i64 ${left}, ${right}`);
        break;
      }
      default:
        this.emit(`  ${tmp} = add i64 ${left}, ${right}`);
    }
    return tmp;
  }

  private emitUnary(expr: import('../ast/index.js').UnaryExpr): string {
    const operand = this.emitExpr(expr.operand);
    const tmp = this.nextTemp();
    switch (expr.operator) {
      case '-':
        this.emit(`  ${tmp} = sub i64 0, ${operand}`);
        break;
      case '!':
        this.emit(`  ${tmp} = icmp eq i64 ${operand}, 0`);
        break;
      default:
        return operand;
    }
    return tmp;
  }

  private emitCall(expr: import('../ast/index.js').CallExpr): string {
    if (expr.callee.kind === 'Ident') {
      const name = expr.callee.name;
      const args = expr.args.map(a => {
        const val = this.emitExpr(a.value);
        const ty = this.lastExprType(a.value);
        return `${ty} ${val}`;
      });

      const retType = this.functionReturnTypes.get(name) || 'i64';
      const tmp = this.nextTemp();
      if (retType === 'void') {
        this.emit(`  call void @${name}(${args.join(', ')})`);
        return '0';
      } else {
        this.emit(`  ${tmp} = call ${retType} @${name}(${args.join(', ')})`);
        return tmp;
      }
    }
    return '0';
  }

  private emitMacroCall(expr: import('../ast/index.js').MacroCallExpr): string {
    if (expr.name === 'println' || expr.name === 'print') {
      if (expr.args.length === 0) {
        // Just print newline
        const strPtr = this.getStringConstant('\n');
        const gep = this.nextTemp();
        const strLen = this.computeStringLength('\n') + 1;
        this.emit(`  ${gep} = getelementptr inbounds [${strLen} x i8], [${strLen} x i8]* ${strPtr}, i32 0, i32 0`);
        this.emit(`  call i32 (i8*, ...) @printf(i8* ${gep})`);
        return '0';
      }

      const arg = expr.args[0]!;
      if (arg.kind === 'StringLiteral') {
        const content = expr.name === 'println' ? arg.value + '\n' : arg.value;
        const strPtr = this.getStringConstant(content);
        const gep = this.nextTemp();
        const strLen = this.computeStringLength(content) + 1;
        this.emit(`  ${gep} = getelementptr inbounds [${strLen} x i8], [${strLen} x i8]* ${strPtr}, i32 0, i32 0`);
        this.emit(`  call i32 (i8*, ...) @printf(i8* ${gep})`);
      } else if (arg.kind === 'StringInterpolation') {
        // Build format string and args from interpolation parts
        this.emitStringInterpolationPrint(arg, expr.name === 'println');
      } else {
        // Print an integer or other expression with %ld format
        const val = this.emitExpr(arg);
        const ty = this.lastExprType(arg);
        const format = expr.name === 'println' ? '%ld\n' : '%ld';
        const strPtr = this.getStringConstant(format);
        const gep = this.nextTemp();
        const strLen = this.computeStringLength(format) + 1;
        this.emit(`  ${gep} = getelementptr inbounds [${strLen} x i8], [${strLen} x i8]* ${strPtr}, i32 0, i32 0`);
        if (ty === 'double') {
          this.emit(`  call i32 (i8*, ...) @printf(i8* ${gep}, double ${val})`);
        } else {
          this.emit(`  call i32 (i8*, ...) @printf(i8* ${gep}, i64 ${val})`);
        }
      }
      return '0';
    }
    return '0';
  }

  private emitStringLiteral(value: string): string {
    const strPtr = this.getStringConstant(value);
    const gep = this.nextTemp();
    const strLen = this.computeStringLength(value) + 1;
    this.emit(`  ${gep} = getelementptr inbounds [${strLen} x i8], [${strLen} x i8]* ${strPtr}, i32 0, i32 0`);
    return gep;
  }

  private emitStringInterpolation(expr: import('../ast/index.js').StringInterpolationExpr): string {
    // Build a format string and collect args
    let format = '';
    const argVals: { val: string; ty: string }[] = [];

    for (const part of expr.parts) {
      if (part.kind === 'Literal') {
        format += part.value;
      } else {
        const val = this.emitExpr(part.expr);
        const ty = this.lastExprType(part.expr);
        if (ty === 'double') {
          format += '%f';
        } else {
          format += '%ld';
        }
        argVals.push({ val, ty });
      }
    }

    const strPtr = this.getStringConstant(format);
    const gep = this.nextTemp();
    const strLen = this.computeStringLength(format) + 1;
    this.emit(`  ${gep} = getelementptr inbounds [${strLen} x i8], [${strLen} x i8]* ${strPtr}, i32 0, i32 0`);

    // Call sprintf into a buffer? For simplicity, just return the format string pointer
    // A proper implementation would need sprintf, but for now return the GEP
    return gep;
  }

  private emitStringInterpolationPrint(expr: import('../ast/index.js').StringInterpolationExpr, addNewline: boolean): void {
    let format = '';
    const argVals: { val: string; ty: string }[] = [];

    for (const part of expr.parts) {
      if (part.kind === 'Literal') {
        format += part.value;
      } else {
        const val = this.emitExpr(part.expr);
        const ty = this.lastExprType(part.expr);
        if (ty === 'double') {
          format += '%f';
        } else {
          format += '%ld';
        }
        argVals.push({ val, ty });
      }
    }

    if (addNewline) format += '\n';

    const strPtr = this.getStringConstant(format);
    const gep = this.nextTemp();
    const strLen = this.computeStringLength(format) + 1;
    this.emit(`  ${gep} = getelementptr inbounds [${strLen} x i8], [${strLen} x i8]* ${strPtr}, i32 0, i32 0`);

    const printfArgs = argVals.map(a => `${a.ty === 'double' ? 'double' : 'i64'} ${a.val}`).join(', ');
    const extraArgs = printfArgs ? `, ${printfArgs}` : '';
    this.emit(`  call i32 (i8*, ...) @printf(i8* ${gep}${extraArgs})`);
  }

  private emitStructExpr(expr: import('../ast/index.js').StructExpr): string {
    const fieldNames = this.structFieldNames.get(expr.name);
    const fieldTypes = this.structTypes.get(expr.name);
    if (!fieldNames || !fieldTypes) return '0';

    const ptr = this.nextTemp();
    this.emit(`  ${ptr} = alloca %${expr.name}`);

    for (const field of expr.fields) {
      const idx = fieldNames.indexOf(field.name);
      if (idx >= 0) {
        const val = this.emitExpr(field.value);
        const fieldType = fieldTypes[idx]!;
        const gep = this.nextTemp();
        this.emit(`  ${gep} = getelementptr inbounds %${expr.name}, %${expr.name}* ${ptr}, i32 0, i32 ${idx}`);
        this.emit(`  store ${fieldType} ${val}, ${fieldType}* ${gep}`);
      }
    }

    return ptr;
  }

  private emitFieldAccess(expr: import('../ast/index.js').FieldAccessExpr): string {
    // Determine the struct type from the object expression
    const objPtr = this.emitExpr(expr.object);
    const structName = this.inferStructName(expr.object);
    if (structName) {
      const fieldNames = this.structFieldNames.get(structName);
      const fieldTypes = this.structTypes.get(structName);
      if (fieldNames && fieldTypes) {
        const idx = fieldNames.indexOf(expr.field);
        if (idx >= 0) {
          const fieldType = fieldTypes[idx]!;
          const gep = this.nextTemp();
          this.emit(`  ${gep} = getelementptr inbounds %${structName}, %${structName}* ${objPtr}, i32 0, i32 ${idx}`);
          const val = this.nextTemp();
          this.emit(`  ${val} = load ${fieldType}, ${fieldType}* ${gep}`);
          return val;
        }
      }
    }
    return '0';
  }

  private emitFieldStore(target: import('../ast/index.js').FieldAccessExpr, value: string): void {
    const objPtr = this.emitExpr(target.object);
    const structName = this.inferStructName(target.object);
    if (structName) {
      const fieldNames = this.structFieldNames.get(structName);
      const fieldTypes = this.structTypes.get(structName);
      if (fieldNames && fieldTypes) {
        const idx = fieldNames.indexOf(target.field);
        if (idx >= 0) {
          const fieldType = fieldTypes[idx]!;
          const gep = this.nextTemp();
          this.emit(`  ${gep} = getelementptr inbounds %${structName}, %${structName}* ${objPtr}, i32 0, i32 ${idx}`);
          this.emit(`  store ${fieldType} ${value}, ${fieldType}* ${gep}`);
        }
      }
    }
  }

  private emitClosure(expr: import('../ast/index.js').ClosureExpr): string {
    const closureName = `__closure${this.closureCounter++}`;
    const retType = expr.returnType ? this.typeExprToLlvm(expr.returnType) : 'i64';
    const params = expr.params.map(p => {
      const ty = p.typeAnnotation ? this.typeExprToLlvm(p.typeAnnotation) : 'i64';
      return `${ty} %${p.name}`;
    }).join(', ');

    const savedLines = this.lines;
    const savedTemp = this.tempCounter;
    const savedLabel = this.labelCounter;
    const savedVars = new Map(this.varAddrs);
    const savedTypes = new Map(this.varTypes);
    const savedMain = this.isMainFn;
    const savedTerm = this.blockTerminated;

    this.lines = [];
    this.tempCounter = 0;
    this.labelCounter = 0;
    this.varAddrs = new Map();
    this.varTypes = new Map();
    this.isMainFn = false;
    this.blockTerminated = false;

    this.emit(`define ${retType} @${closureName}(${params}) {`);
    this.emit('entry:');

    // Alloca for parameters
    for (const p of expr.params) {
      const ty = p.typeAnnotation ? this.typeExprToLlvm(p.typeAnnotation) : 'i64';
      const addr = `%${p.name}.addr`;
      this.emit(`  ${addr} = alloca ${ty}`);
      this.emit(`  store ${ty} %${p.name}, ${ty}* ${addr}`);
      this.varAddrs.set(p.name, addr);
      this.varTypes.set(p.name, ty);
    }

    if (expr.body.kind === 'Block') {
      this.emitBlock(expr.body);
    } else {
      const val = this.emitExpr(expr.body);
      this.emit(`  ret ${retType} ${val}`);
      this.blockTerminated = true;
    }

    if (!this.blockTerminated) {
      this.emit(`  ret ${retType} 0`);
    }

    this.emit('}');
    this.emit('');

    this.deferredFunctions.push(...this.lines);

    this.lines = savedLines;
    this.tempCounter = savedTemp;
    this.labelCounter = savedLabel;
    this.varAddrs = savedVars;
    this.varTypes = savedTypes;
    this.isMainFn = savedMain;
    this.blockTerminated = savedTerm;

    // Register closure function signature
    this.functionReturnTypes.set(closureName, retType);

    return `0`; // Return 0 as the function pointer placeholder
  }

  private emitArrayLiteral(expr: import('../ast/index.js').ArrayLiteralExpr): string {
    const n = expr.elements.length;
    if (n === 0) return '0';

    const ptr = this.nextTemp();
    this.emit(`  ${ptr} = alloca [${n} x i64]`);

    for (let i = 0; i < n; i++) {
      const val = this.emitExpr(expr.elements[i]!);
      const gep = this.nextTemp();
      this.emit(`  ${gep} = getelementptr inbounds [${n} x i64], [${n} x i64]* ${ptr}, i32 0, i32 ${i}`);
      this.emit(`  store i64 ${val}, i64* ${gep}`);
    }

    return ptr;
  }

  private emitIndex(expr: import('../ast/index.js').IndexExpr): string {
    const arrPtr = this.emitExpr(expr.object);
    const idx = this.emitExpr(expr.index);
    // We don't know the array size statically here, use i64*
    const gep = this.nextTemp();
    this.emit(`  ${gep} = getelementptr inbounds i64, i64* ${arrPtr}, i64 ${idx}`);
    const val = this.nextTemp();
    this.emit(`  ${val} = load i64, i64* ${gep}`);
    return val;
  }

  // ─── Actor emission ───────────────────────────────────────────────

  private emitActorDecl(decl: ActorDecl): void {
    // Struct type already registered in pre-pass
    const onHandlers = decl.members.filter(m => m.kind === 'OnHandler') as import('../ast/index.js').OnHandler[];
    const functions = decl.members.filter(m => m.kind === 'FunctionDecl') as FunctionDecl[];

    // Emit handler functions
    for (const handler of onHandlers) {
      this.emitActorHandler(decl.name, handler);
    }

    // Emit regular functions as methods
    for (const fn of functions) {
      this.emitActorMethod(decl.name, fn);
    }
  }

  private emitActorHandler(actorName: string, handler: import('../ast/index.js').OnHandler): void {
    const savedLines = this.lines;
    const savedTemp = this.tempCounter;
    const savedLabel = this.labelCounter;
    const savedVars = new Map(this.varAddrs);
    const savedTypes = new Map(this.varTypes);
    const savedMain = this.isMainFn;
    const savedTerm = this.blockTerminated;
    const savedActor = this.currentActorName;
    const savedSelf = this.currentActorSelf;

    this.lines = [];
    this.tempCounter = 0;
    this.labelCounter = 0;
    this.varAddrs = new Map();
    this.varTypes = new Map();
    this.isMainFn = false;
    this.blockTerminated = false;
    this.currentActorName = actorName;
    this.currentActorSelf = `%self`;

    const params = [`%${actorName}* %self`];
    for (const p of handler.params) {
      const ty = this.resolveParamType(p);
      params.push(`${ty} %${p.name}`);
    }

    const fnName = `${actorName}_on${handler.messageName}`;
    this.emit(`define void @${fnName}(${params.join(', ')}) {`);
    this.emit('entry:');

    // Alloca for params
    for (const p of handler.params) {
      const ty = this.resolveParamType(p);
      const addr = `%${p.name}.addr`;
      this.emit(`  ${addr} = alloca ${ty}`);
      this.emit(`  store ${ty} %${p.name}, ${ty}* ${addr}`);
      this.varAddrs.set(p.name, addr);
      this.varTypes.set(p.name, ty);
    }

    this.emitBlock(handler.body);

    if (!this.blockTerminated) {
      this.emit('  ret void');
    }

    this.emit('}');
    this.emit('');

    this.deferredFunctions.push(...this.lines);

    this.lines = savedLines;
    this.tempCounter = savedTemp;
    this.labelCounter = savedLabel;
    this.varAddrs = savedVars;
    this.varTypes = savedTypes;
    this.isMainFn = savedMain;
    this.blockTerminated = savedTerm;
    this.currentActorName = savedActor;
    this.currentActorSelf = savedSelf;
  }

  private emitActorMethod(actorName: string, fn: FunctionDecl): void {
    const savedLines = this.lines;
    const savedTemp = this.tempCounter;
    const savedLabel = this.labelCounter;
    const savedVars = new Map(this.varAddrs);
    const savedTypes = new Map(this.varTypes);
    const savedMain = this.isMainFn;
    const savedTerm = this.blockTerminated;
    const savedActor = this.currentActorName;
    const savedSelf = this.currentActorSelf;

    this.lines = [];
    this.tempCounter = 0;
    this.labelCounter = 0;
    this.varAddrs = new Map();
    this.varTypes = new Map();
    this.isMainFn = false;
    this.blockTerminated = false;
    this.currentActorName = actorName;
    this.currentActorSelf = `%self`;

    const retType = this.resolveReturnType(fn);
    const params = [`%${actorName}* %self`];
    for (const p of fn.params) {
      const ty = this.resolveParamType(p);
      params.push(`${ty} %${p.name}`);
    }

    const fnName = `${actorName}_${fn.name}`;
    this.emit(`define ${retType} @${fnName}(${params.join(', ')}) {`);
    this.emit('entry:');

    for (const p of fn.params) {
      const ty = this.resolveParamType(p);
      const addr = `%${p.name}.addr`;
      this.emit(`  ${addr} = alloca ${ty}`);
      this.emit(`  store ${ty} %${p.name}, ${ty}* ${addr}`);
      this.varAddrs.set(p.name, addr);
      this.varTypes.set(p.name, ty);
    }

    this.emitBlock(fn.body);

    if (!this.blockTerminated) {
      if (retType === 'void') {
        this.emit('  ret void');
      } else {
        this.emit(`  ret ${retType} 0`);
      }
    }

    this.emit('}');
    this.emit('');

    this.deferredFunctions.push(...this.lines);

    this.lines = savedLines;
    this.tempCounter = savedTemp;
    this.labelCounter = savedLabel;
    this.varAddrs = savedVars;
    this.varTypes = savedTypes;
    this.isMainFn = savedMain;
    this.blockTerminated = savedTerm;
    this.currentActorName = savedActor;
    this.currentActorSelf = savedSelf;
  }

  // ─── Type helpers ─────────────────────────────────────────────────

  private typeExprToLlvm(typeExpr: import('../ast/index.js').TypeExpr): string {
    switch (typeExpr.kind) {
      case 'NamedType':
        return this.namedTypeToLlvm(typeExpr.name);
      case 'ArrayType':
        return 'i64*'; // Pointer to element array
      case 'ReferenceType':
        return this.typeExprToLlvm(typeExpr.inner) + '*';
      case 'FunctionType':
        return 'i64'; // Function pointer as i64
      default:
        return 'i64';
    }
  }

  private namedTypeToLlvm(name: string): string {
    switch (name) {
      case 'i64': case 'i32': case 'i16': case 'i8': return 'i64';
      case 'f64': case 'f32': case 'double': return 'double';
      case 'bool': return 'i64';
      case 'string': case 'String': return 'i8*';
      case 'void': case '()': return 'void';
      default:
        // Check if it's a struct type
        if (this.structTypes.has(name)) return `%${name}*`;
        return 'i64';
    }
  }

  private resolveReturnType(decl: FunctionDecl): string {
    if (decl.name === 'main') return 'i32';
    if (!decl.returnType) return 'void';
    return this.typeExprToLlvm(decl.returnType);
  }

  private resolveParamType(param: Parameter): string {
    return this.typeExprToLlvm(param.typeAnnotation);
  }

  private inferType(expr: Expr, typeAnnotation: import('../ast/index.js').TypeExpr | null): string {
    if (typeAnnotation) {
      return this.typeExprToLlvm(typeAnnotation);
    }
    return this.lastExprType(expr);
  }

  /** Determine the LLVM type that an expression produces */
  private lastExprType(expr: Expr): string {
    switch (expr.kind) {
      case 'IntLiteral': return 'i64';
      case 'FloatLiteral': return 'double';
      case 'BoolLiteral': return 'i64';
      case 'StringLiteral': return 'i8*';
      case 'StringInterpolation': return 'i8*';
      case 'Ident': {
        const ty = this.varTypes.get(expr.name);
        if (ty) return ty;
        // Check actor state fields
        if (this.currentActorName) {
          const fields = this.actorFields.get(this.currentActorName);
          if (fields) {
            const idx = fields.names.indexOf(expr.name);
            if (idx >= 0) return fields.types[idx]!;
          }
        }
        return 'i64';
      }
      case 'Binary': {
        const op = expr.operator;
        if (['<', '>', '<=', '>=', '==', '!='].includes(op)) {
          // Comparisons produce i1 but we might zext to i64
          return 'i1';
        }
        const leftType = this.lastExprType(expr.left);
        if (leftType === 'double') return 'double';
        return 'i64';
      }
      case 'Unary':
        if (expr.operator === '!') return 'i1';
        return this.lastExprType(expr.operand);
      case 'Call': {
        if (expr.callee.kind === 'Ident') {
          const retType = this.functionReturnTypes.get(expr.callee.name);
          if (retType) return retType;
        }
        return 'i64';
      }
      case 'Struct': return `%${expr.name}*`;
      case 'FieldAccess': {
        const structName = this.inferStructName(expr.object);
        if (structName) {
          const fieldNames = this.structFieldNames.get(structName);
          const fieldTypes = this.structTypes.get(structName);
          if (fieldNames && fieldTypes) {
            const idx = fieldNames.indexOf(expr.field);
            if (idx >= 0) return fieldTypes[idx]!;
          }
        }
        return 'i64';
      }
      case 'ArrayLiteral': return 'i64*';
      case 'Closure': return 'i64';
      case 'MacroCall': return 'i64';
      default: return 'i64';
    }
  }

  private inferStructName(expr: Expr): string | null {
    if (expr.kind === 'Struct') return expr.name;
    if (expr.kind === 'Ident') {
      const ty = this.varTypes.get(expr.name);
      if (ty && ty.startsWith('%') && ty.endsWith('*')) {
        return ty.slice(1, -1);
      }
    }
    return null;
  }

  // ─── String helpers ───────────────────────────────────────────────

  private getStringConstant(content: string): string {
    if (this.stringConstants.has(content)) {
      return this.stringConstants.get(content)!;
    }
    const name = `@.str.${this.stringCounter++}`;
    this.stringConstants.set(content, name);
    return name;
  }

  private escapeStringForLlvm(content: string): string {
    let result = '';
    for (let i = 0; i < content.length; i++) {
      const ch = content[i]!;
      if (ch === '\n') {
        result += '\\0A';
      } else if (ch === '\r') {
        result += '\\0D';
      } else if (ch === '\t') {
        result += '\\09';
      } else if (ch === '\\') {
        result += '\\5C';
      } else if (ch === '"') {
        result += '\\22';
      } else {
        result += ch;
      }
    }
    return result;
  }

  private computeStringLength(content: string): number {
    let len = 0;
    for (let i = 0; i < content.length; i++) {
      len++; // Each character (including \n, \t etc.) is one byte
    }
    return len;
  }

  private formatFloat(value: string): string {
    const num = parseFloat(value);
    // LLVM uses hexadecimal float representation or decimal scientific notation
    return num.toExponential(6).replace('e+', 'e+0').replace('e-', 'e-0')
      .replace(/e\+0(\d{2})/, 'e+$1').replace(/e-0(\d{2})/, 'e-$1');
  }

  // ─── Utility helpers ──────────────────────────────────────────────

  private nextTemp(): string {
    return `%t${this.tempCounter++}`;
  }

  private emit(line: string): void {
    this.lines.push(line);
  }
}
