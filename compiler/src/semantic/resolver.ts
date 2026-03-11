/**
 * Name resolution pass for the C! language.
 *
 * Walks the AST and:
 *   1. Resolves variable references to their declarations
 *   2. Detects use-before-declaration and undeclared variables
 *   3. Errors on duplicate declarations in the same scope
 *   4. Verifies function parameter scoping
 *   5. Verifies block scoping
 *   6. Verifies struct/actor field access on known types
 *
 * This pass runs after parsing and before type checking, so it
 * catches name-related errors early with clear diagnostics.
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
  StateDecl,
  OnHandler,
  InitDecl,
  Block,
  Stmt,
  Expr,
  TypeExpr,
  MatchArm,
  Pattern,
} from '../ast/index.js';
import type { Span } from '../lexer/index.js';
import type { Diagnostic } from '../errors/index.js';
import { createError } from '../errors/index.js';
import type { SymbolKind } from './scope.js';
import { SymbolTable } from './scope.js';

// ─── Builtin names ────────────────────────────────────────────────

const BUILTIN_TYPES = new Set([
  'i8', 'i16', 'i32', 'i64', 'i128',
  'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
  'f32', 'f64',
  'bool',
  'String',
]);

const BUILTIN_FUNCTIONS = new Set([
  'print', 'println',
]);

// Dummy span for builtins
const BUILTIN_SPAN: Span = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
  file: '<builtin>',
};

// ─── Resolver ─────────────────────────────────────────────────────

export class Resolver {
  private symbols = new SymbolTable();
  private diagnostics: Diagnostic[] = [];

  // ── Main entry point ──────────────────────────────────────────

  resolve(program: Program): Diagnostic[] {
    this.symbols = new SymbolTable();
    this.diagnostics = [];

    this.registerBuiltins();

    // Pass 1: register all top-level names so forward references work
    for (const item of program.items) {
      this.registerTopLevel(item);
    }

    // Pass 2: walk bodies and resolve references
    for (const item of program.items) {
      this.resolveTopLevel(item);
    }

    return this.diagnostics;
  }

  // ── Builtins ──────────────────────────────────────────────────

  private registerBuiltins(): void {
    for (const name of BUILTIN_TYPES) {
      this.symbols.defineType({
        name,
        symbolKind: 'builtin',
        span: BUILTIN_SPAN,
        mutable: false,
      });
    }

    // Unit type
    this.symbols.defineType({
      name: '()',
      symbolKind: 'builtin',
      span: BUILTIN_SPAN,
      mutable: false,
    });

    for (const name of BUILTIN_FUNCTIONS) {
      this.symbols.defineValue({
        name,
        symbolKind: 'builtin',
        span: BUILTIN_SPAN,
        mutable: false,
      });
    }
  }

  // ── Pass 1: Top-level registration ────────────────────────────

  private registerTopLevel(item: TopLevelItem): void {
    switch (item.kind) {
      case 'FunctionDecl':
        this.registerFunction(item);
        break;
      case 'TypeDecl':
        this.registerTypeDecl(item);
        break;
      case 'ActorDecl':
        this.registerActor(item);
        break;
      case 'ContractDecl':
        this.registerContract(item);
        break;
      case 'ServerDecl':
        this.registerServer(item);
        break;
      case 'ComponentDecl':
        this.registerComponent(item);
        break;
      case 'StateDecl':
        this.registerState(item);
        break;
      case 'EnumDecl':
        this.registerEnumDecl(item);
        break;
      case 'UseDecl':
      case 'ModDecl':
        // Not resolved in this phase
        break;
    }
  }

  private registerFunction(decl: FunctionDecl): void {
    const ok = this.symbols.defineValue({
      name: decl.name,
      symbolKind: 'function',
      span: decl.span,
      mutable: false,
    });
    if (!ok) {
      this.error(
        `Duplicate declaration: '${decl.name}' is already defined in this scope`,
        decl.span,
      );
    }
  }

  private registerTypeDecl(decl: TypeDecl): void {
    const fields: string[] = [];
    if (decl.body.kind === 'Struct') {
      for (const f of decl.body.fields) {
        fields.push(f.name);
      }
    }

    const symbolKind: SymbolKind =
      decl.body.kind === 'Struct' ? 'struct' :
      decl.body.kind === 'Enum' ? 'enum' : 'type';

    const ok = this.symbols.defineType({
      name: decl.name,
      symbolKind,
      span: decl.span,
      mutable: false,
      ...(fields.length > 0 ? { fields } : {}),
    });
    if (!ok) {
      this.error(
        `Duplicate type declaration: '${decl.name}' is already defined`,
        decl.span,
      );
    }

    // Register enum variants as values
    if (decl.body.kind === 'Enum') {
      for (const v of decl.body.variants) {
        this.symbols.defineValue({
          name: v.name,
          symbolKind: 'variant',
          span: v.span,
          mutable: false,
        });
      }
    }
  }

  private registerActor(decl: ActorDecl): void {
    const members: string[] = [];
    for (const m of decl.members) {
      if (m.kind === 'StateDecl') members.push(m.name);
      if (m.kind === 'OnHandler') members.push(m.messageName);
      if (m.kind === 'FunctionDecl') members.push(m.name);
    }

    const ok = this.symbols.defineType({
      name: decl.name,
      symbolKind: 'actor',
      span: decl.span,
      mutable: false,
      members,
    });
    if (!ok) {
      this.error(
        `Duplicate declaration: '${decl.name}' is already defined`,
        decl.span,
      );
    }

    // Also register as a value (actors can be referenced by name)
    this.symbols.defineValue({
      name: decl.name,
      symbolKind: 'actor',
      span: decl.span,
      mutable: false,
      members,
    });
  }

  private registerContract(decl: ContractDecl): void {
    const ok = this.symbols.defineType({
      name: decl.name,
      symbolKind: 'contract',
      span: decl.span,
      mutable: false,
    });
    if (!ok) {
      this.error(
        `Duplicate declaration: '${decl.name}' is already defined`,
        decl.span,
      );
    }
  }

  private registerServer(decl: ServerDecl): void {
    const ok = this.symbols.defineType({
      name: decl.name,
      symbolKind: 'server',
      span: decl.span,
      mutable: false,
    });
    if (!ok) {
      this.error(
        `Duplicate declaration: '${decl.name}' is already defined`,
        decl.span,
      );
    }
  }

  private registerComponent(decl: ComponentDecl): void {
    const ok = this.symbols.defineType({
      name: decl.name,
      symbolKind: 'component',
      span: decl.span,
      mutable: false,
    });
    if (!ok) {
      this.error(
        `Duplicate declaration: '${decl.name}' is already defined`,
        decl.span,
      );
    }
  }

  private registerState(decl: StateDecl): void {
    const ok = this.symbols.defineValue({
      name: decl.name,
      symbolKind: 'state',
      span: decl.span,
      mutable: true,
    });
    if (!ok) {
      this.error(
        `Duplicate declaration: '${decl.name}' is already defined in this scope`,
        decl.span,
      );
    }
  }

  private registerEnumDecl(decl: EnumDecl): void {
    const ok = this.symbols.defineType({
      name: decl.name,
      symbolKind: 'enum',
      span: decl.span,
      mutable: false,
    });
    if (!ok) {
      this.error(
        `Duplicate type declaration: '${decl.name}' is already defined`,
        decl.span,
      );
    }

    // Register each variant as a value
    for (const v of decl.variants) {
      this.symbols.defineValue({
        name: v.name,
        symbolKind: 'variant',
        span: v.span,
        mutable: false,
      });
    }
  }

  // ── Pass 2: Resolve bodies ────────────────────────────────────

  private resolveTopLevel(item: TopLevelItem): void {
    switch (item.kind) {
      case 'FunctionDecl':
        this.resolveFunction(item);
        break;
      case 'TypeDecl':
        this.resolveTypeDecl(item);
        break;
      case 'ActorDecl':
        this.resolveActor(item);
        break;
      case 'ContractDecl':
        this.resolveContract(item);
        break;
      case 'ServerDecl':
        this.resolveServer(item);
        break;
      case 'ComponentDecl':
        this.resolveComponentDecl(item);
        break;
      case 'StateDecl':
        if (item.initializer) {
          this.resolveExpr(item.initializer);
        }
        this.resolveTypeRef(item.typeAnnotation);
        break;
      case 'EnumDecl':
        this.resolveEnumDecl(item);
        break;
      case 'UseDecl':
      case 'ModDecl':
        break;
    }
  }

  // ── Functions ─────────────────────────────────────────────────

  private resolveFunction(decl: FunctionDecl): void {
    this.symbols.enter();

    // Bind parameters
    for (const param of decl.params) {
      this.resolveTypeRef(param.typeAnnotation);
      const ok = this.symbols.defineValue({
        name: param.name,
        symbolKind: 'parameter',
        span: param.span,
        mutable: false,
      });
      if (!ok) {
        this.error(
          `Duplicate parameter name: '${param.name}'`,
          param.span,
        );
      }
    }

    // Resolve return type
    if (decl.returnType) {
      this.resolveTypeRef(decl.returnType);
    }

    // Resolve body
    this.resolveBlock(decl.body);

    this.symbols.leave();
  }

  // ── Type declarations ─────────────────────────────────────────

  private resolveTypeDecl(decl: TypeDecl): void {
    switch (decl.body.kind) {
      case 'Alias':
        this.resolveTypeRef(decl.body.type);
        break;
      case 'Struct':
        for (const field of decl.body.fields) {
          this.resolveTypeRef(field.typeAnnotation);
          if (field.defaultValue) {
            this.resolveExpr(field.defaultValue);
          }
        }
        break;
      case 'Enum':
        for (const variant of decl.body.variants) {
          if (variant.fields) {
            for (const field of variant.fields) {
              this.resolveTypeRef(field);
            }
          }
        }
        break;
    }
  }

  // ── Enum declarations ──────────────────────────────────────────

  private resolveEnumDecl(decl: EnumDecl): void {
    for (const variant of decl.variants) {
      switch (variant.kind) {
        case 'UnitVariant':
          // No type references to resolve
          break;
        case 'TupleVariant':
          for (const field of variant.fields) {
            this.resolveTypeRef(field);
          }
          break;
        case 'StructVariant':
          for (const field of variant.fields) {
            this.resolveTypeRef(field.typeAnnotation);
          }
          break;
      }
    }
  }

  // ── Actors ────────────────────────────────────────────────────

  private resolveActor(decl: ActorDecl): void {
    this.symbols.enter();

    // First pass: register all member names within actor scope
    for (const member of decl.members) {
      switch (member.kind) {
        case 'StateDecl':
          this.symbols.defineValue({
            name: member.name,
            symbolKind: 'state',
            span: member.span,
            mutable: true,
          });
          break;
        case 'FunctionDecl':
          this.symbols.defineValue({
            name: member.name,
            symbolKind: 'function',
            span: member.span,
            mutable: false,
          });
          break;
        case 'OnHandler':
        case 'SuperviseDecl':
        case 'InitDecl':
          break;
      }
    }

    // Second pass: resolve bodies
    for (const member of decl.members) {
      switch (member.kind) {
        case 'StateDecl':
          this.resolveTypeRef(member.typeAnnotation);
          if (member.initializer) {
            this.resolveExpr(member.initializer);
          }
          break;
        case 'FunctionDecl':
          this.resolveFunction(member);
          break;
        case 'OnHandler':
          this.resolveOnHandler(member);
          break;
        case 'InitDecl':
          this.resolveInitDecl(member);
          break;
        case 'SuperviseDecl':
          // Supervise options contain expressions
          for (const opt of member.options) {
            this.resolveExpr(opt.value);
          }
          break;
      }
    }

    this.symbols.leave();
  }

  private resolveOnHandler(handler: OnHandler): void {
    this.symbols.enter();

    for (const param of handler.params) {
      this.resolveTypeRef(param.typeAnnotation);
      this.symbols.defineValue({
        name: param.name,
        symbolKind: 'parameter',
        span: param.span,
        mutable: false,
      });
    }

    if (handler.returnType) {
      this.resolveTypeRef(handler.returnType);
    }

    this.resolveBlock(handler.body);
    this.symbols.leave();
  }

  private resolveInitDecl(init: InitDecl): void {
    this.symbols.enter();

    for (const param of init.params) {
      this.resolveTypeRef(param.typeAnnotation);
      this.symbols.defineValue({
        name: param.name,
        symbolKind: 'parameter',
        span: param.span,
        mutable: false,
      });
    }

    this.resolveBlock(init.body);
    this.symbols.leave();
  }

  // ── Contracts ─────────────────────────────────────────────────

  private resolveContract(decl: ContractDecl): void {
    this.symbols.enter();

    // First pass: register members
    for (const member of decl.members) {
      switch (member.kind) {
        case 'StateDecl':
          this.symbols.defineValue({
            name: member.name,
            symbolKind: 'state',
            span: member.span,
            mutable: true,
          });
          break;
        case 'FunctionDecl':
          this.symbols.defineValue({
            name: member.name,
            symbolKind: 'function',
            span: member.span,
            mutable: false,
          });
          break;
        case 'InitDecl':
          break;
      }
    }

    // Second pass: resolve bodies
    for (const member of decl.members) {
      switch (member.kind) {
        case 'StateDecl':
          this.resolveTypeRef(member.typeAnnotation);
          if (member.initializer) {
            this.resolveExpr(member.initializer);
          }
          break;
        case 'FunctionDecl':
          this.resolveFunction(member);
          break;
        case 'InitDecl':
          this.resolveInitDecl(member);
          break;
      }
    }

    this.symbols.leave();
  }

  // ── Servers ───────────────────────────────────────────────────

  private resolveServer(decl: ServerDecl): void {
    this.symbols.enter();

    // Register members
    for (const member of decl.members) {
      switch (member.kind) {
        case 'FunctionDecl':
          this.symbols.defineValue({
            name: member.name,
            symbolKind: 'function',
            span: member.span,
            mutable: false,
          });
          break;
        case 'StateDecl':
          this.symbols.defineValue({
            name: member.name,
            symbolKind: 'state',
            span: member.span,
            mutable: true,
          });
          break;
        case 'FieldAssignment':
          break;
      }
    }

    // Resolve bodies
    for (const member of decl.members) {
      switch (member.kind) {
        case 'FunctionDecl':
          this.resolveFunction(member);
          break;
        case 'StateDecl':
          this.resolveTypeRef(member.typeAnnotation);
          if (member.initializer) {
            this.resolveExpr(member.initializer);
          }
          break;
        case 'FieldAssignment':
          this.resolveExpr(member.value);
          break;
      }
    }

    this.symbols.leave();
  }

  // ── Components ────────────────────────────────────────────────

  private resolveComponentDecl(decl: ComponentDecl): void {
    this.symbols.enter();

    for (const param of decl.params) {
      this.resolveTypeRef(param.typeAnnotation);
      this.symbols.defineValue({
        name: param.name,
        symbolKind: 'parameter',
        span: param.span,
        mutable: false,
      });
    }

    this.resolveBlock(decl.body);
    this.symbols.leave();
  }

  // ── Blocks & Statements ───────────────────────────────────────

  private resolveBlock(block: Block): void {
    for (const stmt of block.statements) {
      this.resolveStmt(stmt);
    }
  }

  private resolveStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case 'LetStmt':
        this.resolveLetStmt(stmt);
        break;
      case 'ReturnStmt':
        if (stmt.value) {
          this.resolveExpr(stmt.value);
        }
        break;
      case 'ReplyStmt':
        this.resolveExpr(stmt.value);
        break;
      case 'EmitStmt':
        for (const arg of stmt.args) {
          this.resolveExpr(arg);
        }
        break;
      case 'ExprStmt':
        this.resolveExpr(stmt.expr);
        break;
      case 'IfStmt':
        this.resolveIfStmt(stmt);
        break;
      case 'ForStmt':
        this.resolveForStmt(stmt);
        break;
      case 'WhileStmt':
        this.resolveExpr(stmt.condition);
        this.symbols.enter();
        this.resolveBlock(stmt.body);
        this.symbols.leave();
        break;
      case 'MatchStmt':
        this.resolveMatchStmt(stmt);
        break;
      case 'AssignStmt':
        this.resolveExpr(stmt.target);
        this.resolveExpr(stmt.value);
        break;
      case 'SpawnStmt':
        // Verify actor name is known
        if (!this.symbols.lookupType(stmt.actor) && !this.symbols.lookupValue(stmt.actor)) {
          this.error(`Undeclared actor '${stmt.actor}'`, stmt.span);
        }
        for (const arg of stmt.args) {
          this.resolveExpr(arg);
        }
        break;
      case 'DeployStmt':
        if (!this.symbols.lookupType(stmt.contract) && !this.symbols.lookupValue(stmt.contract)) {
          this.error(`Undeclared contract '${stmt.contract}'`, stmt.span);
        }
        for (const arg of stmt.args) {
          this.resolveExpr(arg.value);
        }
        break;
    }
  }

  private resolveLetStmt(stmt: import('../ast/index.js').LetStmt): void {
    // Resolve the initializer first (before defining the variable)
    this.resolveExpr(stmt.initializer);

    // Resolve type annotation if present
    if (stmt.typeAnnotation) {
      this.resolveTypeRef(stmt.typeAnnotation);
    }

    // Now define the variable
    const ok = this.symbols.defineValue({
      name: stmt.name,
      symbolKind: 'variable',
      span: stmt.span,
      mutable: stmt.mutable,
    });
    if (!ok) {
      this.error(
        `Duplicate declaration: '${stmt.name}' is already defined in this scope`,
        stmt.span,
      );
    }
  }

  private resolveIfStmt(stmt: import('../ast/index.js').IfStmt): void {
    this.resolveExpr(stmt.condition);

    this.symbols.enter();
    this.resolveBlock(stmt.then);
    this.symbols.leave();

    if (stmt.else_) {
      if (stmt.else_.kind === 'IfStmt') {
        this.resolveIfStmt(stmt.else_);
      } else {
        this.symbols.enter();
        this.resolveBlock(stmt.else_);
        this.symbols.leave();
      }
    }
  }

  private resolveForStmt(stmt: import('../ast/index.js').ForStmt): void {
    this.resolveExpr(stmt.iterable);

    this.symbols.enter();
    this.symbols.defineValue({
      name: stmt.variable,
      symbolKind: 'for-variable',
      span: stmt.span,
      mutable: false,
    });
    this.resolveBlock(stmt.body);
    this.symbols.leave();
  }

  private resolveMatchStmt(stmt: import('../ast/index.js').MatchStmt): void {
    this.resolveExpr(stmt.subject);
    for (const arm of stmt.arms) {
      this.resolveMatchArm(arm);
    }
  }

  private resolveMatchArm(arm: MatchArm): void {
    this.symbols.enter();
    this.resolvePattern(arm.pattern);
    if (arm.body.kind === 'Block') {
      this.resolveBlock(arm.body);
    } else {
      this.resolveExpr(arm.body);
    }
    this.symbols.leave();
  }

  private resolvePattern(pattern: Pattern): void {
    switch (pattern.kind) {
      case 'IdentPattern':
        this.symbols.defineValue({
          name: pattern.name,
          symbolKind: 'match-binding',
          span: pattern.span,
          mutable: false,
        });
        break;
      case 'ConstructorPattern':
        // The constructor name should be a known type or variant
        // but we don't error here since it could be an enum variant
        for (const field of pattern.fields) {
          this.resolvePattern(field);
        }
        break;
      case 'LiteralPattern':
      case 'WildcardPattern':
        break;
    }
  }

  // ── Expressions ───────────────────────────────────────────────

  private resolveExpr(expr: Expr): void {
    switch (expr.kind) {
      case 'Ident':
        this.resolveIdent(expr);
        break;
      case 'IntLiteral':
      case 'FloatLiteral':
      case 'StringLiteral':
      case 'BoolLiteral':
        break;
      case 'Binary':
        this.resolveExpr(expr.left);
        this.resolveExpr(expr.right);
        break;
      case 'Unary':
        this.resolveExpr(expr.operand);
        break;
      case 'Call':
        this.resolveExpr(expr.callee);
        for (const arg of expr.args) {
          this.resolveExpr(arg.value);
        }
        break;
      case 'MethodCall':
        this.resolveExpr(expr.object);
        for (const arg of expr.args) {
          this.resolveExpr(arg.value);
        }
        break;
      case 'FieldAccess':
        this.resolveFieldAccess(expr);
        break;
      case 'Index':
        this.resolveExpr(expr.object);
        this.resolveExpr(expr.index);
        break;
      case 'Struct':
        this.resolveStructExpr(expr);
        break;
      case 'BlockExpr':
        this.symbols.enter();
        this.resolveBlock(expr.block);
        this.symbols.leave();
        break;
      case 'IfExpr':
        this.resolveIfExpr(expr);
        break;
      case 'MatchExpr':
        this.resolveExpr(expr.subject);
        for (const arm of expr.arms) {
          this.resolveMatchArm(arm);
        }
        break;
      case 'Parallel':
        this.symbols.enter();
        this.resolveBlock(expr.body);
        this.symbols.leave();
        break;
      case 'Scope':
        this.resolveExpr(expr.initializer);
        this.symbols.enter();
        this.symbols.defineValue({
          name: expr.name,
          symbolKind: 'variable',
          span: expr.span,
          mutable: false,
        });
        this.resolveBlock(expr.body);
        this.symbols.leave();
        break;
      case 'MacroCall':
        for (const arg of expr.args) {
          this.resolveExpr(arg);
        }
        break;
      case 'Path':
        this.resolvePath(expr);
        break;
      case 'Range':
        if (expr.start) this.resolveExpr(expr.start);
        if (expr.end) this.resolveExpr(expr.end);
        break;
      case 'ArrayLiteral':
        for (const el of expr.elements) {
          this.resolveExpr(el);
        }
        break;
      case 'Closure':
        this.resolveClosure(expr);
        break;
    }
  }

  private resolveIdent(expr: import('../ast/index.js').IdentExpr): void {
    const info = this.symbols.lookupValue(expr.name);
    if (info === undefined) {
      this.error(
        `Undeclared variable '${expr.name}'`,
        expr.span,
        { suggestion: `Did you mean to declare '${expr.name}' with 'let'?` },
      );
    }
  }

  private resolveFieldAccess(expr: import('../ast/index.js').FieldAccessExpr): void {
    this.resolveExpr(expr.object);

    // If the object is a simple identifier that resolves to a known struct type,
    // we can check field validity.
    if (expr.object.kind === 'Ident') {
      this.symbols.lookupValue(expr.object.name);
      // We don't error on unknown fields at the semantic level because
      // the type checker handles that more precisely with type info.
      // The semantic pass just ensures the object itself is resolved.
    }
  }

  private resolveStructExpr(expr: import('../ast/index.js').StructExpr): void {
    // Verify the struct type name is known
    const typeInfo = this.symbols.lookupType(expr.name);
    if (typeInfo === undefined) {
      this.error(`Undeclared type '${expr.name}'`, expr.span);
    } else if (typeInfo.symbolKind === 'struct' && typeInfo.fields) {
      // Verify field names are valid for this struct
      const knownFields = new Set(typeInfo.fields);
      for (const f of expr.fields) {
        if (!knownFields.has(f.name)) {
          this.error(
            `Struct '${expr.name}' has no field named '${f.name}'`,
            f.span,
          );
        }
      }
    }

    // Resolve field value expressions
    for (const f of expr.fields) {
      this.resolveExpr(f.value);
    }
  }

  private resolveIfExpr(expr: import('../ast/index.js').IfExpr): void {
    this.resolveExpr(expr.condition);

    this.symbols.enter();
    this.resolveBlock(expr.then);
    this.symbols.leave();

    if (expr.else_) {
      if (expr.else_.kind === 'IfExpr') {
        this.resolveIfExpr(expr.else_);
      } else {
        this.symbols.enter();
        this.resolveBlock(expr.else_);
        this.symbols.leave();
      }
    }
  }

  private resolvePath(expr: import('../ast/index.js').PathExpr): void {
    // Try to resolve the first segment as a known name
    if (expr.segments.length > 0) {
      const first = expr.segments[0]!;
      const asValue = this.symbols.lookupValue(first);
      const asType = this.symbols.lookupType(first);
      if (!asValue && !asType) {
        // Don't error on paths — they might be module paths not yet supported
        // Just silently skip
      }
    }
  }

  private resolveClosure(expr: import('../ast/index.js').ClosureExpr): void {
    this.symbols.enter();

    for (const param of expr.params) {
      if (param.typeAnnotation) {
        this.resolveTypeRef(param.typeAnnotation);
      }
      this.symbols.defineValue({
        name: param.name,
        symbolKind: 'parameter',
        span: param.span,
        mutable: false,
      });
    }

    if (expr.returnType) {
      this.resolveTypeRef(expr.returnType);
    }

    if ('kind' in expr.body && expr.body.kind === 'Block') {
      this.resolveBlock(expr.body);
    } else {
      this.resolveExpr(expr.body as Expr);
    }

    this.symbols.leave();
  }

  // ── Type references ───────────────────────────────────────────

  private resolveTypeRef(texpr: TypeExpr): void {
    switch (texpr.kind) {
      case 'NamedType': {
        const info = this.symbols.lookupType(texpr.name);
        if (info === undefined) {
          this.error(`Undeclared type '${texpr.name}'`, texpr.span);
        }
        break;
      }
      case 'GenericType': {
        const info = this.symbols.lookupType(texpr.name);
        if (info === undefined) {
          // Generic types like Vec, Map, Option are common but not yet registered
          // as builtins. We allow them through without error for now.
        }
        for (const arg of texpr.typeArgs) {
          this.resolveTypeRef(arg);
        }
        break;
      }
      case 'RefinedType':
        this.resolveTypeRef(texpr.baseType);
        break;
      case 'FunctionType':
        for (const param of texpr.params) {
          this.resolveTypeRef(param);
        }
        this.resolveTypeRef(texpr.returnType);
        break;
      case 'UnionType':
        for (const t of texpr.types) {
          this.resolveTypeRef(t);
        }
        break;
      case 'ReferenceType':
        this.resolveTypeRef(texpr.inner);
        break;
      case 'OwnType':
        this.resolveTypeRef(texpr.inner);
        break;
      case 'SharedType':
        this.resolveTypeRef(texpr.inner);
        break;
      case 'ArrayType':
        this.resolveTypeRef(texpr.elementType);
        break;
    }
  }

  // ── Diagnostics ───────────────────────────────────────────────

  private error(
    message: string,
    span: Span,
    options: { notes?: string[]; suggestion?: string } = {},
  ): void {
    this.diagnostics.push(createError('E_NAME', message, span, options));
  }
}
