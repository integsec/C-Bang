/**
 * JavaScript code generator for the C! language.
 *
 * Walks the AST produced by the parser and emits equivalent JavaScript
 * source code as a string.  Ownership modifiers and effect annotations
 * are silently dropped because they have no JavaScript counterpart.
 * Actor, contract, and server declarations emit placeholder comments.
 */

import type {
  Program,
  TopLevelItem,
  FunctionDecl,
  TypeDecl,
  EnumDecl,
  ActorDecl,
  ContractDecl,
  ServerDecl,
  ComponentDecl,
  UseDecl,
  ModDecl,
  StateDecl,
  Block,
  Stmt,
  Expr,
  MatchArm,
  Pattern,
  Annotation,
  EnumVariant,
} from '../ast/index.js';

export class JsGenerator {
  private output: string = '';
  private indent: number = 0;

  // ─── Main entry point ─────────────────────────────────────────────

  generate(program: Program): string {
    this.output = '';
    this.indent = 0;

    for (let i = 0; i < program.items.length; i++) {
      this.emitTopLevel(program.items[i]!);
      if (i < program.items.length - 1) {
        this.writeLine('');
      }
    }

    return this.output;
  }

  // ─── Top-level items ─────────────────────────────────────────────

  private emitTopLevel(item: TopLevelItem): void {
    switch (item.kind) {
      case 'FunctionDecl':
        this.emitFunction(item);
        break;
      case 'TypeDecl':
        this.emitTypeDecl(item);
        break;
      case 'EnumDecl':
        this.emitEnumDecl(item);
        break;
      case 'ActorDecl':
        this.emitActorDecl(item);
        break;
      case 'ContractDecl':
        this.emitContractDecl(item);
        break;
      case 'ServerDecl':
        this.emitServerDecl(item);
        break;
      case 'ComponentDecl':
        this.emitComponentDecl(item);
        break;
      case 'UseDecl':
        this.emitUseDecl(item);
        break;
      case 'ModDecl':
        this.emitModDecl(item);
        break;
      case 'StateDecl':
        this.emitStateDecl(item);
        break;
    }
  }

  // ─── Declarations ─────────────────────────────────────────────────

  private emitFunction(decl: FunctionDecl): void {
    this.emitAnnotationsAsComments(decl.annotations);
    const asyncPrefix = decl.isAsync ? 'async ' : '';
    const exportPrefix = decl.visibility === 'public' ? 'export ' : '';
    const params = decl.params.map(p => p.name).join(', ');
    this.writeLine(`${exportPrefix}${asyncPrefix}function ${decl.name}(${params}) {`);
    this.emitBlockBody(decl.body);
    this.writeLine('}');
  }

  private emitTypeDecl(decl: TypeDecl): void {
    this.emitAnnotationsAsComments(decl.annotations);
    const exportPrefix = decl.visibility === 'public' ? 'export ' : '';

    switch (decl.body.kind) {
      case 'Alias':
        // Type aliases have no direct JS equivalent; emit a comment
        this.writeLine(`/* type ${decl.name} = ... (alias) */`);
        break;
      case 'Struct': {
        const fields = decl.body.fields;
        const fieldNames = fields.map(f => f.name);
        this.writeLine(`${exportPrefix}class ${decl.name} {`);
        this.indentInc();
        this.writeLine(`constructor(${fieldNames.join(', ')}) {`);
        this.indentInc();
        for (const f of fieldNames) {
          this.writeLine(`this.${f} = ${f};`);
        }
        this.indentDec();
        this.writeLine('}');
        this.indentDec();
        this.writeLine('}');
        break;
      }
      case 'Enum': {
        // Old-style TypeDecl enum (union): type Color = Red | Green | Blue
        const variants = decl.body.variants;
        this.writeLine(`${exportPrefix}const ${decl.name} = Object.freeze({`);
        this.indentInc();
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i]!;
          const comma = i < variants.length - 1 ? ',' : '';
          this.writeLine(`${v.name}: "${v.name}"${comma}`);
        }
        this.indentDec();
        this.writeLine('});');
        break;
      }
    }
  }

  private emitEnumDecl(decl: EnumDecl): void {
    this.emitAnnotationsAsComments(decl.annotations);
    const exportPrefix = decl.visibility === 'public' ? 'export ' : '';

    this.writeLine(`${exportPrefix}const ${decl.name} = Object.freeze({`);
    this.indentInc();
    for (let i = 0; i < decl.variants.length; i++) {
      const v = decl.variants[i]!;
      const comma = i < decl.variants.length - 1 ? ',' : '';
      this.emitEnumVariant(v, comma);
    }
    this.indentDec();
    this.writeLine('});');
  }

  private emitEnumVariant(variant: EnumVariant, comma: string): void {
    switch (variant.kind) {
      case 'UnitVariant':
        this.writeLine(`${variant.name}: "${variant.name}"${comma}`);
        break;
      case 'TupleVariant':
        // Emit a factory function
        this.writeLine(`${variant.name}: (...args) => ({ tag: "${variant.name}", values: args })${comma}`);
        break;
      case 'StructVariant':
        // Emit a factory function taking an object
        this.writeLine(`${variant.name}: (fields) => ({ tag: "${variant.name}", ...fields })${comma}`);
        break;
    }
  }

  private emitActorDecl(decl: ActorDecl): void {
    this.emitAnnotationsAsComments(decl.annotations);
    const exportPrefix = decl.visibility === 'public' ? 'export ' : '';

    // Separate member types
    const stateMembers = decl.members.filter(m => m.kind === 'StateDecl') as StateDecl[];
    const onHandlers = decl.members.filter(m => m.kind === 'OnHandler') as import('../ast/index.js').OnHandler[];
    const functions = decl.members.filter(m => m.kind === 'FunctionDecl') as FunctionDecl[];
    const initDecl = decl.members.find(m => m.kind === 'InitDecl') as import('../ast/index.js').InitDecl | undefined;
    const superviseDecls = decl.members.filter(m => m.kind === 'SuperviseDecl') as import('../ast/index.js').SuperviseDecl[];

    this.writeLine(`${exportPrefix}class ${decl.name} {`);
    this.indentInc();

    // Constructor — initialize state fields
    if (stateMembers.length > 0 || initDecl) {
      const initParams = initDecl ? initDecl.params.map(p => p.name).join(', ') : '';
      this.writeLine(`constructor(${initParams}) {`);
      this.indentInc();
      for (const s of stateMembers) {
        if (s.initializer) {
          this.writeLine(`this.${s.name} = ${this.exprToString(s.initializer)};`);
        } else {
          this.writeLine(`this.${s.name} = undefined;`);
        }
      }
      if (initDecl) {
        for (const stmt of initDecl.body.statements) {
          this.emitStmt(stmt);
        }
      }
      this.indentDec();
      this.writeLine('}');
    }

    // On handlers → methods
    for (const handler of onHandlers) {
      this.writeLine('');
      const params = handler.params.map(p => p.name).join(', ');
      this.writeLine(`on${handler.messageName}(${params}) {`);
      this.emitBlockBody(handler.body);
      this.writeLine('}');
    }

    // Regular functions → methods
    for (const fn of functions) {
      this.writeLine('');
      this.emitAnnotationsAsComments(fn.annotations);
      const asyncPrefix = fn.isAsync ? 'async ' : '';
      const params = fn.params.map(p => p.name).join(', ');
      this.writeLine(`${asyncPrefix}${fn.name}(${params}) {`);
      this.emitBlockBody(fn.body);
      this.writeLine('}');
    }

    // Supervise declarations → comments
    for (const sup of superviseDecls) {
      this.writeLine('');
      this.writeLine(`/* supervise ${sup.childName} */`);
    }

    this.indentDec();
    this.writeLine('}');
  }

  private emitContractDecl(decl: ContractDecl): void {
    this.emitAnnotationsAsComments(decl.annotations);
    const exportPrefix = decl.visibility === 'public' ? 'export ' : '';

    const stateMembers = decl.members.filter(m => m.kind === 'StateDecl') as StateDecl[];
    const functions = decl.members.filter(m => m.kind === 'FunctionDecl') as FunctionDecl[];
    const initDecl = decl.members.find(m => m.kind === 'InitDecl') as import('../ast/index.js').InitDecl | undefined;

    this.writeLine(`${exportPrefix}class ${decl.name} {`);
    this.indentInc();

    // Interfaces metadata
    if (decl.interfaces.length > 0) {
      this.writeLine(`static __interfaces = [${decl.interfaces.map(i => `"${i}"`).join(', ')}];`);
      this.writeLine('');
    }

    // Constructor — initialize state and run init block
    const initParams = initDecl ? initDecl.params.map(p => p.name).join(', ') : '';
    this.writeLine(`constructor(${initParams}) {`);
    this.indentInc();
    for (const s of stateMembers) {
      if (s.initializer) {
        this.writeLine(`this.${s.name} = ${this.exprToString(s.initializer)};`);
      } else {
        this.writeLine(`this.${s.name} = undefined;`);
      }
    }
    if (initDecl) {
      for (const stmt of initDecl.body.statements) {
        this.emitStmt(stmt);
      }
    }
    this.indentDec();
    this.writeLine('}');

    // Functions → methods
    for (const fn of functions) {
      this.writeLine('');
      this.emitAnnotationsAsComments(fn.annotations);
      const asyncPrefix = fn.isAsync ? 'async ' : '';
      const params = fn.params.map(p => p.name).join(', ');
      this.writeLine(`${asyncPrefix}${fn.name}(${params}) {`);
      this.emitBlockBody(fn.body);
      this.writeLine('}');
    }

    this.indentDec();
    this.writeLine('}');
  }

  private emitServerDecl(decl: ServerDecl): void {
    this.emitAnnotationsAsComments(decl.annotations);
    const exportPrefix = decl.visibility === 'public' ? 'export ' : '';

    const stateMembers = decl.members.filter(m => m.kind === 'StateDecl') as StateDecl[];
    const functions = decl.members.filter(m => m.kind === 'FunctionDecl') as FunctionDecl[];
    const fieldAssignments = decl.members.filter(m => m.kind === 'FieldAssignment') as import('../ast/index.js').FieldAssignment[];

    this.writeLine(`${exportPrefix}class ${decl.name} {`);
    this.indentInc();

    // Constructor — initialize config fields and state
    this.writeLine(`constructor() {`);
    this.indentInc();
    for (const f of fieldAssignments) {
      this.writeLine(`this.${f.name} = ${this.exprToString(f.value)};`);
    }
    for (const s of stateMembers) {
      if (s.initializer) {
        this.writeLine(`this.${s.name} = ${this.exprToString(s.initializer)};`);
      } else {
        this.writeLine(`this.${s.name} = undefined;`);
      }
    }
    this.indentDec();
    this.writeLine('}');

    // Route handlers → methods
    for (const fn of functions) {
      this.writeLine('');
      this.emitAnnotationsAsComments(fn.annotations);
      const asyncPrefix = fn.isAsync ? 'async ' : '';
      const params = fn.params.map(p => p.name).join(', ');
      this.writeLine(`${asyncPrefix}${fn.name}(${params}) {`);
      this.emitBlockBody(fn.body);
      this.writeLine('}');
    }

    this.indentDec();
    this.writeLine('}');
  }

  private emitComponentDecl(decl: ComponentDecl): void {
    this.emitAnnotationsAsComments(decl.annotations);
    const exportPrefix = decl.visibility === 'public' ? 'export ' : '';
    const params = decl.params.map(p => p.name).join(', ');

    // Components compile to render functions
    this.writeLine(`${exportPrefix}function ${decl.name}(${params}) {`);
    this.emitBlockBody(decl.body);
    this.writeLine('}');
  }

  private emitUseDecl(decl: UseDecl): void {
    const modulePath = `./${decl.path.join('/')}.js`;
    if (decl.isWildcard) {
      this.writeLine(`import * from "${modulePath}";`);
      return;
    }
    const namedItems = decl.items
      .filter((item): item is Extract<typeof item, { kind: 'Named' }> => item.kind === 'Named');
    if (namedItems.length === 0) return;
    const specifiers = namedItems
      .map(item => item.alias ? `${item.name} as ${item.alias}` : item.name)
      .join(', ');
    this.writeLine(`import { ${specifiers} } from "${modulePath}";`);
  }

  private emitModDecl(decl: ModDecl): void {
    if (decl.body && decl.body.length > 0) {
      this.writeLine(`const ${decl.name} = (() => {`);
      this.indentInc();
      for (const item of decl.body) {
        this.emitTopLevel(item);
      }
      this.indentDec();
      this.writeLine('})();');
    } else {
      // External module reference — will be loaded at runtime
      this.writeLine(`/* mod ${decl.name} (external) */`);
    }
  }

  private emitStateDecl(decl: StateDecl): void {
    if (decl.initializer) {
      this.writeLine(`let ${decl.name} = ${this.exprToString(decl.initializer)};`);
    } else {
      this.writeLine(`let ${decl.name};`);
    }
  }

  // ─── Statements ───────────────────────────────────────────────────

  private emitStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case 'LetStmt':
        this.emitLetStmt(stmt);
        break;
      case 'ReturnStmt':
        this.emitReturnStmt(stmt);
        break;
      case 'ExprStmt':
        this.writeLine(`${this.exprToString(stmt.expr)};`);
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
      case 'AssignStmt':
        this.writeLine(`${this.exprToString(stmt.target)} ${stmt.operator} ${this.exprToString(stmt.value)};`);
        break;
      case 'ReplyStmt':
        this.writeLine(`return ${this.exprToString(stmt.value)};`);
        break;
      case 'EmitStmt': {
        const args = stmt.args.map(a => this.exprToString(a)).join(', ');
        this.writeLine(`this.emit("${stmt.eventName}", ${args});`);
        break;
      }
      case 'SpawnStmt': {
        const args = stmt.args.map(a => this.exprToString(a)).join(', ');
        this.writeLine(`const __actor = new ${stmt.actor}(${args});`);
        break;
      }
      case 'DeployStmt': {
        const args = stmt.args.map(a => this.exprToString(a.value)).join(', ');
        this.writeLine(`const __contract = new ${stmt.contract}(${args});`);
        break;
      }
    }
  }

  private emitLetStmt(stmt: import('../ast/index.js').LetStmt): void {
    const keyword = stmt.mutable ? 'let' : 'const';
    this.writeLine(`${keyword} ${stmt.name} = ${this.exprToString(stmt.initializer)};`);
  }

  private emitReturnStmt(stmt: import('../ast/index.js').ReturnStmt): void {
    if (stmt.value) {
      this.writeLine(`return ${this.exprToString(stmt.value)};`);
    } else {
      this.writeLine('return;');
    }
  }

  private emitIfStmt(stmt: import('../ast/index.js').IfStmt): void {
    this.writeLine(`if (${this.exprToString(stmt.condition)}) {`);
    this.emitBlockBody(stmt.then);
    if (stmt.else_) {
      if (stmt.else_.kind === 'IfStmt') {
        this.writeRaw(`${this.indentStr()}} else `);
        // Emit the chained else-if inline (without the indent prefix)
        this.emitIfStmtInline(stmt.else_);
      } else {
        this.writeLine('} else {');
        this.emitBlockBody(stmt.else_);
        this.writeLine('}');
      }
    } else {
      this.writeLine('}');
    }
  }

  /** Emit an if statement that appears after `else ` on the same line */
  private emitIfStmtInline(stmt: import('../ast/index.js').IfStmt): void {
    this.output += `if (${this.exprToString(stmt.condition)}) {\n`;
    this.emitBlockBody(stmt.then);
    if (stmt.else_) {
      if (stmt.else_.kind === 'IfStmt') {
        this.writeRaw(`${this.indentStr()}} else `);
        this.emitIfStmtInline(stmt.else_);
      } else {
        this.writeLine('} else {');
        this.emitBlockBody(stmt.else_);
        this.writeLine('}');
      }
    } else {
      this.writeLine('}');
    }
  }

  private emitWhileStmt(stmt: import('../ast/index.js').WhileStmt): void {
    this.writeLine(`while (${this.exprToString(stmt.condition)}) {`);
    this.emitBlockBody(stmt.body);
    this.writeLine('}');
  }

  private emitForStmt(stmt: import('../ast/index.js').ForStmt): void {
    this.writeLine(`for (const ${stmt.variable} of ${this.exprToString(stmt.iterable)}) {`);
    this.emitBlockBody(stmt.body);
    this.writeLine('}');
  }

  private emitMatchStmt(stmt: import('../ast/index.js').MatchStmt): void {
    const subject = this.exprToString(stmt.subject);
    for (let i = 0; i < stmt.arms.length; i++) {
      const arm = stmt.arms[i]!;
      const condition = this.patternToCondition(subject, arm.pattern);
      const bindings = this.patternBindings(subject, arm.pattern);

      if (i === 0) {
        this.writeLine(`if (${condition}) {`);
      } else if (arm.pattern.kind === 'WildcardPattern') {
        this.writeLine('} else {');
      } else {
        this.writeLine(`} else if (${condition}) {`);
      }

      this.indentInc();
      for (const b of bindings) {
        this.writeLine(b);
      }
      this.emitMatchArmBody(arm);
      this.indentDec();
    }
    this.writeLine('}');
  }

  private emitMatchArmBody(arm: MatchArm): void {
    if (arm.body.kind === 'Block') {
      for (const s of arm.body.statements) {
        this.emitStmt(s);
      }
    } else {
      // Expression body — treat as an expression statement
      this.writeLine(`${this.exprToString(arm.body)};`);
    }
  }

  // ─── Expressions ──────────────────────────────────────────────────

  private exprToString(expr: Expr): string {
    switch (expr.kind) {
      case 'IntLiteral':
        return expr.value;
      case 'FloatLiteral':
        return expr.value;
      case 'StringLiteral':
        return `"${expr.value}"`;
      case 'StringInterpolation': {
        let result = '`';
        for (const part of expr.parts) {
          if (part.kind === 'Literal') {
            result += part.value;
          } else {
            result += `\${${this.exprToString(part.expr)}}`;
          }
        }
        result += '`';
        return result;
      }
      case 'BoolLiteral':
        return expr.value ? 'true' : 'false';
      case 'Ident':
        return expr.name;
      case 'Binary':
        return this.binaryToString(expr);
      case 'Unary':
        return `${expr.operator}${this.exprToString(expr.operand)}`;
      case 'Call':
        return this.callToString(expr);
      case 'MethodCall': {
        const obj = this.exprToString(expr.object);
        const args = expr.args.map(a => this.exprToString(a.value)).join(', ');
        return `${obj}.${expr.method}(${args})`;
      }
      case 'FieldAccess':
        return `${this.exprToString(expr.object)}.${expr.field}`;
      case 'Index':
        return `${this.exprToString(expr.object)}[${this.exprToString(expr.index)}]`;
      case 'Struct':
        return this.structExprToString(expr);
      case 'ArrayLiteral': {
        const elems = expr.elements.map(e => this.exprToString(e)).join(', ');
        return `[${elems}]`;
      }
      case 'Closure':
        return this.closureToString(expr);
      case 'BlockExpr':
        return this.blockExprToString(expr);
      case 'IfExpr':
        return this.ifExprToString(expr);
      case 'MatchExpr':
        return this.matchExprToString(expr);
      case 'Path':
        return expr.segments.join('.');
      case 'Range': {
        const start = expr.start ? this.exprToString(expr.start) : '';
        const end = expr.end ? this.exprToString(expr.end) : '';
        const op = expr.inclusive ? '..=' : '..';
        return `/* ${start}${op}${end} */`;
      }
      case 'Parallel':
        return '/* parallel { ... } */';
      case 'Scope':
        return `/* scope ${expr.name} = ... { ... } */`;
      case 'MacroCall': {
        const args = expr.args.map(a => this.exprToString(a)).join(', ');
        // Map common macros
        if (expr.name === 'print' || expr.name === 'println') {
          return `console.log(${args})`;
        }
        if (expr.name === 'verify') {
          return `/* verify!(${args}) */`;
        }
        return `${expr.name}(${args})`;
      }
    }
  }

  private binaryToString(expr: import('../ast/index.js').BinaryExpr): string {
    const left = this.exprToString(expr.left);
    const right = this.exprToString(expr.right);
    // Wrap sub-expressions in parens when the inner operator has lower precedence
    const leftStr = this.needsParens(expr.left, expr, 'left') ? `(${left})` : left;
    const rightStr = this.needsParens(expr.right, expr, 'right') ? `(${right})` : right;
    return `${leftStr} ${expr.operator} ${rightStr}`;
  }

  private needsParens(
    child: Expr,
    parent: import('../ast/index.js').BinaryExpr,
    _side: 'left' | 'right',
  ): boolean {
    if (child.kind !== 'Binary') return false;
    const childPrec = this.opPrecedence(child.operator);
    const parentPrec = this.opPrecedence(parent.operator);
    if (childPrec < parentPrec) return true;
    // For right-associativity (same precedence on the right) — not common, but safe
    if (childPrec === parentPrec && _side === 'right') return true;
    return false;
  }

  private opPrecedence(op: string): number {
    switch (op) {
      case '||': return 1;
      case '&&': return 2;
      case '==': case '!=': return 3;
      case '<': case '>': case '<=': case '>=': return 4;
      case '+': case '-': return 6;
      case '*': case '/': case '%': return 7;
      default: return 0;
    }
  }

  private callToString(expr: import('../ast/index.js').CallExpr): string {
    const callee = this.exprToString(expr.callee);
    const args = expr.args.map(a => this.exprToString(a.value)).join(', ');
    return `${callee}(${args})`;
  }

  private structExprToString(expr: import('../ast/index.js').StructExpr): string {
    if (expr.fields.length === 0) {
      return '{}';
    }
    const fields = expr.fields.map(f => `${f.name}: ${this.exprToString(f.value)}`).join(', ');
    return `{ ${fields} }`;
  }

  private closureToString(expr: import('../ast/index.js').ClosureExpr): string {
    const params = expr.params.map(p => p.name).join(', ');
    if (expr.body.kind === 'Block') {
      const body = this.blockToInlineString(expr.body);
      return `(${params}) => ${body}`;
    }
    return `(${params}) => ${this.exprToString(expr.body)}`;
  }

  private blockToInlineString(block: Block): string {
    // For simple single-expression blocks in closures, inline them
    if (block.statements.length === 1) {
      const stmt = block.statements[0]!;
      if (stmt.kind === 'ReturnStmt' && stmt.value) {
        return this.exprToString(stmt.value);
      }
      if (stmt.kind === 'ExprStmt') {
        return this.exprToString(stmt.expr);
      }
    }
    // Multi-statement block: render with braces
    const saved = this.output;
    const savedIndent = this.indent;
    this.output = '';
    this.output += '{\n';
    this.indentInc();
    for (const s of block.statements) {
      this.emitStmt(s);
    }
    this.indentDec();
    this.output += `${this.indentStr()}}`;
    const result = this.output;
    this.output = saved;
    this.indent = savedIndent;
    return result;
  }

  private blockExprToString(expr: import('../ast/index.js').BlockExpr): string {
    // Emit as an IIFE
    const saved = this.output;
    const savedIndent = this.indent;
    this.output = '';
    this.output += '(() => {\n';
    this.indentInc();
    for (const s of expr.block.statements) {
      this.emitStmt(s);
    }
    this.indentDec();
    this.output += `${this.indentStr()}})()`;
    const result = this.output;
    this.output = saved;
    this.indent = savedIndent;
    return result;
  }

  private ifExprToString(expr: import('../ast/index.js').IfExpr): string {
    // Emit as ternary for simple cases, IIFE for complex
    const cond = this.exprToString(expr.condition);
    const thenVal = this.blockAsValue(expr.then);
    if (expr.else_) {
      if (expr.else_.kind === 'IfExpr') {
        const elseVal = this.ifExprToString(expr.else_);
        return `${cond} ? ${thenVal} : ${elseVal}`;
      }
      const elseVal = this.blockAsValue(expr.else_);
      return `${cond} ? ${thenVal} : ${elseVal}`;
    }
    return `${cond} ? ${thenVal} : undefined`;
  }

  private blockAsValue(block: Block): string {
    if (block.statements.length === 1) {
      const stmt = block.statements[0]!;
      if (stmt.kind === 'ExprStmt') return this.exprToString(stmt.expr);
      if (stmt.kind === 'ReturnStmt' && stmt.value) return this.exprToString(stmt.value);
    }
    return this.blockExprToStringHelper(block);
  }

  private blockExprToStringHelper(block: Block): string {
    const saved = this.output;
    const savedIndent = this.indent;
    this.output = '';
    this.output += '(() => {\n';
    this.indentInc();
    for (const s of block.statements) {
      this.emitStmt(s);
    }
    this.indentDec();
    this.output += `${this.indentStr()}})()`;
    const result = this.output;
    this.output = saved;
    this.indent = savedIndent;
    return result;
  }

  private matchExprToString(expr: import('../ast/index.js').MatchExpr): string {
    // Emit match expression as IIFE with if/else chain
    const subject = this.exprToString(expr.subject);
    const saved = this.output;
    const savedIndent = this.indent;
    this.output = '';
    this.output += `(() => {\n`;
    this.indentInc();
    this.writeLine(`const __match = ${subject};`);
    for (let i = 0; i < expr.arms.length; i++) {
      const arm = expr.arms[i]!;
      const condition = this.patternToCondition('__match', arm.pattern);
      const bindings = this.patternBindings('__match', arm.pattern);

      if (i === 0) {
        this.writeLine(`if (${condition}) {`);
      } else if (arm.pattern.kind === 'WildcardPattern') {
        this.writeLine('} else {');
      } else {
        this.writeLine(`} else if (${condition}) {`);
      }

      this.indentInc();
      for (const b of bindings) {
        this.writeLine(b);
      }
      if (arm.body.kind === 'Block') {
        for (const s of arm.body.statements) {
          this.emitStmt(s);
        }
      } else {
        this.writeLine(`return ${this.exprToString(arm.body)};`);
      }
      this.indentDec();
    }
    this.writeLine('}');
    this.indentDec();
    this.output += `${this.indentStr()}})()`;
    const result = this.output;
    this.output = saved;
    this.indent = savedIndent;
    return result;
  }

  // ─── Pattern helpers ──────────────────────────────────────────────

  private patternToCondition(subject: string, pattern: Pattern): string {
    switch (pattern.kind) {
      case 'LiteralPattern':
        if (typeof pattern.value === 'string') {
          return `${subject} === "${pattern.value}"`;
        }
        return `${subject} === ${pattern.value}`;
      case 'IdentPattern':
        return 'true';
      case 'ConstructorPattern':
        if (pattern.fields.length === 0) {
          return `${subject} === "${pattern.name}"`;
        }
        return `${subject}.tag === "${pattern.name}"`;
      case 'WildcardPattern':
        return 'true';
    }
  }

  private patternBindings(subject: string, pattern: Pattern): string[] {
    switch (pattern.kind) {
      case 'IdentPattern':
        return [`const ${pattern.name} = ${subject};`];
      case 'ConstructorPattern':
        return pattern.fields.flatMap((f, i) => {
          if (f.kind === 'IdentPattern') {
            return [`const ${f.name} = ${subject}.values[${i}];`];
          }
          return [];
        });
      default:
        return [];
    }
  }

  // ─── Annotation helpers ───────────────────────────────────────────

  private emitAnnotationsAsComments(annotations: Annotation[]): void {
    for (const a of annotations) {
      if (a.name === 'intent') {
        this.writeLine(`/* @intent(${a.args}) */`);
      } else {
        this.writeLine(`/* ${a.raw} */`);
      }
    }
  }

  // ─── Block body helper ────────────────────────────────────────────

  private emitBlockBody(block: Block): void {
    this.indentInc();
    for (const stmt of block.statements) {
      this.emitStmt(stmt);
    }
    this.indentDec();
  }

  // ─── Output helpers ───────────────────────────────────────────────

  private writeLine(text: string): void {
    this.output += `${this.indentStr()}${text}\n`;
  }

  private writeRaw(text: string): void {
    this.output += text;
  }

  private indentStr(): string {
    return '  '.repeat(this.indent);
  }

  private indentInc(): void {
    this.indent++;
  }

  private indentDec(): void {
    this.indent--;
  }
}
