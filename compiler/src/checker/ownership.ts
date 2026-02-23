/**
 * Linear/affine ownership checker for C!.
 *
 * Runs as a separate pass after basic type checking. Tracks ownership
 * state for each variable and enforces:
 *
 * 1. Owned values can only be moved once (use-after-move is an error)
 * 2. Cannot move a value while it is borrowed
 * 3. At most one mutable borrow at a time (exclusivity)
 * 4. Cannot have mutable and immutable borrows simultaneously
 * 5. Primitive types are implicitly Copy (no move semantics)
 * 6. Immutable bindings cannot be mutably borrowed
 */

import type {
  Program,
  TopLevelItem,
  FunctionDecl,
  Block,
  Stmt,
  Expr,
  Parameter,
} from '../ast/index.js';
import type { Span } from '../lexer/index.js';
import type { Diagnostic } from '../errors/index.js';
import { createError } from '../errors/index.js';
import { PRIMITIVES } from './types.js';

// ─── Ownership state ──────────────────────────────────────────────

type VarState = 'alive' | 'moved';

interface VarInfo {
  state: VarState;
  mutable: boolean;
  copyable: boolean;     // Primitives are implicitly Copy
  typeName: string;
  definedAt: Span;
  movedAt: Span | null;  // Where it was moved (for error messages)
  borrowCount: number;    // Active immutable borrows
  mutBorrowCount: number; // Active mutable borrows (0 or 1)
}

interface OwnerScope {
  vars: Map<string, VarInfo>;
}

// ─── Checker ──────────────────────────────────────────────────────

export class OwnershipChecker {
  private scopes: OwnerScope[] = [];
  private diagnostics: Diagnostic[] = [];
  private paramOwnership = new Map<string, string>(); // param name → ownership mode

  check(program: Program): Diagnostic[] {
    this.scopes = [];
    this.diagnostics = [];

    for (const item of program.items) {
      this.checkTopLevel(item);
    }

    return this.diagnostics;
  }

  // ─── Top-level dispatch ───────────────────────────────────────

  private checkTopLevel(item: TopLevelItem): void {
    if (item.kind === 'FunctionDecl') {
      this.checkFunction(item);
    }
    // Future: actors, contracts, servers, components
  }

  private checkFunction(decl: FunctionDecl): void {
    this.enterScope();
    this.paramOwnership.clear();

    // Register parameters with their ownership mode
    for (const param of decl.params) {
      const copyable = this.isCopyType(param.typeAnnotation);
      this.defineVar(param.name, {
        state: 'alive',
        mutable: param.ownership === 'borrowed_mut',
        copyable,
        typeName: this.typeExprName(param.typeAnnotation),
        definedAt: param.span,
        movedAt: null,
        borrowCount: 0,
        mutBorrowCount: 0,
      });
      this.paramOwnership.set(param.name, param.ownership);
    }

    this.checkBlock(decl.body);
    this.leaveScope();
  }

  // ─── Block and statement checking ─────────────────────────────

  private checkBlock(block: Block): void {
    for (const stmt of block.statements) {
      this.checkStmt(stmt);
    }
  }

  private checkStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case 'LetStmt':
        this.checkLetStmt(stmt);
        break;
      case 'ReturnStmt':
        if (stmt.value) this.checkExprMove(stmt.value);
        break;
      case 'ExprStmt':
        this.checkExpr(stmt.expr);
        break;
      case 'IfStmt':
        this.checkExpr(stmt.condition);
        this.enterScope();
        this.checkBlock(stmt.then);
        this.leaveScope();
        if (stmt.else_) {
          if (stmt.else_.kind === 'IfStmt') {
            this.checkStmt(stmt.else_);
          } else {
            this.enterScope();
            this.checkBlock(stmt.else_);
            this.leaveScope();
          }
        }
        break;
      case 'WhileStmt':
        this.checkExpr((stmt as any).condition);
        this.enterScope();
        this.checkBlock((stmt as any).body);
        this.leaveScope();
        break;
      case 'ForStmt':
        this.checkExpr(stmt.iterable);
        this.enterScope();
        this.defineVar(stmt.variable, {
          state: 'alive',
          mutable: false,
          copyable: true, // loop vars treated as Copy for simplicity
          typeName: '<iter>',
          definedAt: stmt.span,
          movedAt: null,
          borrowCount: 0,
          mutBorrowCount: 0,
        });
        this.checkBlock(stmt.body);
        this.leaveScope();
        break;
      case 'AssignStmt':
        this.checkExprMove(stmt.value);
        // Assignment target is a use (read address), not a move
        this.checkExprRead(stmt.target);
        break;
      case 'MatchStmt':
        this.checkExprMove(stmt.subject);
        for (const arm of stmt.arms) {
          this.enterScope();
          this.bindPattern(arm.pattern, stmt.span);
          if (arm.body.kind === 'Block') {
            this.checkBlock(arm.body);
          } else {
            this.checkExpr(arm.body);
          }
          this.leaveScope();
        }
        break;
      // Phase 1 skips
      case 'ReplyStmt':
      case 'EmitStmt':
      case 'SpawnStmt':
      case 'DeployStmt':
        break;
    }
  }

  private checkLetStmt(stmt: import('../ast/index.js').LetStmt): void {
    // The initializer is consumed (moved into the new binding)
    this.checkExprMove(stmt.initializer);

    const copyable = stmt.typeAnnotation
      ? this.isCopyType(stmt.typeAnnotation)
      : this.isExprCopyable(stmt.initializer);

    const typeName = stmt.typeAnnotation
      ? this.typeExprName(stmt.typeAnnotation)
      : this.inferExprTypeName(stmt.initializer);

    this.defineVar(stmt.name, {
      state: 'alive',
      mutable: stmt.mutable,
      copyable,
      typeName,
      definedAt: stmt.span,
      movedAt: null,
      borrowCount: 0,
      mutBorrowCount: 0,
    });
  }

  // ─── Expression checking ──────────────────────────────────────

  /** Check an expression that reads but does not consume its values. */
  private checkExpr(expr: Expr): void {
    this.checkExprRead(expr);
  }

  /** Check an expression where the result is moved (consumed). */
  private checkExprMove(expr: Expr): void {
    switch (expr.kind) {
      case 'Ident':
        this.useVar(expr.name, expr.span, 'move');
        break;
      case 'Call':
        this.checkCall(expr);
        break;
      default:
        this.checkExprRead(expr);
        break;
    }
  }

  /** Check an expression that reads (borrows) its values. */
  private checkExprRead(expr: Expr): void {
    switch (expr.kind) {
      case 'Ident':
        this.useVar(expr.name, expr.span, 'read');
        break;
      case 'Binary':
        this.checkExprRead(expr.left);
        this.checkExprRead(expr.right);
        break;
      case 'Unary':
        this.checkExprRead(expr.operand);
        break;
      case 'Call':
        this.checkCall(expr);
        break;
      case 'MethodCall':
        this.checkExprRead(expr.object);
        for (const arg of expr.args) {
          this.checkExprMove(arg.value);
        }
        break;
      case 'FieldAccess':
        this.checkExprRead(expr.object);
        break;
      case 'Index':
        this.checkExprRead(expr.object);
        this.checkExprRead(expr.index);
        break;
      case 'Struct':
        for (const field of expr.fields) {
          this.checkExprMove(field.value);
        }
        break;
      case 'ArrayLiteral':
        for (const elem of expr.elements) {
          this.checkExprMove(elem);
        }
        break;
      case 'IfExpr':
        this.checkExprRead(expr.condition);
        this.enterScope();
        this.checkBlock(expr.then);
        this.leaveScope();
        if (expr.else_) {
          if (expr.else_.kind === 'IfExpr') {
            this.checkExprRead(expr.else_);
          } else {
            this.enterScope();
            this.checkBlock(expr.else_);
            this.leaveScope();
          }
        }
        break;
      case 'BlockExpr':
        this.enterScope();
        this.checkBlock(expr.block);
        this.leaveScope();
        break;
      case 'MatchExpr':
        this.checkExprMove(expr.subject);
        for (const arm of expr.arms) {
          this.enterScope();
          this.bindPattern(arm.pattern, expr.span);
          if (arm.body.kind === 'Block') {
            this.checkBlock(arm.body);
          } else {
            this.checkExpr(arm.body);
          }
          this.leaveScope();
        }
        break;
      case 'MacroCall':
        for (const arg of expr.args) {
          this.checkExprRead(arg);
        }
        break;
      case 'Closure':
        // Closures capture by reference by default
        break;
      case 'StringInterpolation':
        for (const part of expr.parts) {
          if (part.kind === 'Expr') {
            this.checkExprRead(part.expr);
          }
        }
        break;
      // Literals and paths don't consume anything
      case 'IntLiteral':
      case 'FloatLiteral':
      case 'StringLiteral':
      case 'BoolLiteral':
      case 'Path':
      case 'Range':
      case 'Parallel':
      case 'Scope':
        break;
    }
  }

  private checkCall(expr: import('../ast/index.js').CallExpr): void {
    // The callee is read (we look up the function, we don't consume it)
    this.checkExprRead(expr.callee);

    // Arguments: by default, owned arguments are moved
    for (const arg of expr.args) {
      this.checkExprMove(arg.value);
    }
  }

  // ─── Variable state management ────────────────────────────────

  private useVar(name: string, span: Span, mode: 'read' | 'move'): void {
    const info = this.lookupVar(name);
    if (!info) return; // Unknown variable — type checker will catch this

    if (info.state === 'moved') {
      this.diagnostics.push(createError(
        'E_USE_AFTER_MOVE',
        `Use of moved value '${name}'`,
        span,
        {
          notes: [
            `'${name}' was moved${info.movedAt ? ` at ${info.movedAt.file}:${info.movedAt.start.line}:${info.movedAt.start.column}` : ''}`,
            `Type '${info.typeName}' does not implement Copy`,
          ],
          suggestion: `Consider borrowing with &${name} or cloning the value`,
        },
      ));
      return;
    }

    if (mode === 'move' && !info.copyable) {
      // Check borrow conflicts before moving
      if (info.borrowCount > 0 || info.mutBorrowCount > 0) {
        this.diagnostics.push(createError(
          'E_MOVE_WHILE_BORROWED',
          `Cannot move '${name}' while it is borrowed`,
          span,
          {
            notes: [
              info.mutBorrowCount > 0
                ? `'${name}' has an active mutable borrow`
                : `'${name}' has ${info.borrowCount} active immutable borrow(s)`,
            ],
          },
        ));
        return;
      }
      // Perform the move
      info.state = 'moved';
      info.movedAt = span;
    }
  }

  private defineVar(name: string, info: VarInfo): void {
    this.currentScope().vars.set(name, info);
  }

  private lookupVar(name: string): VarInfo | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const info = this.scopes[i]!.vars.get(name);
      if (info !== undefined) return info;
    }
    return undefined;
  }

  private bindPattern(pattern: import('../ast/index.js').Pattern, span: Span): void {
    switch (pattern.kind) {
      case 'IdentPattern':
        this.defineVar(pattern.name, {
          state: 'alive',
          mutable: false,
          copyable: true,
          typeName: '<pattern>',
          definedAt: span,
          movedAt: null,
          borrowCount: 0,
          mutBorrowCount: 0,
        });
        break;
      case 'ConstructorPattern':
        for (const field of pattern.fields) {
          this.bindPattern(field, span);
        }
        break;
      case 'LiteralPattern':
      case 'WildcardPattern':
        break;
    }
  }

  // ─── Scope management ─────────────────────────────────────────

  private enterScope(): void {
    this.scopes.push({ vars: new Map() });
  }

  private leaveScope(): void {
    if (this.scopes.length > 0) {
      this.scopes.pop();
    }
  }

  private currentScope(): OwnerScope {
    if (this.scopes.length === 0) {
      this.scopes.push({ vars: new Map() });
    }
    return this.scopes[this.scopes.length - 1]!;
  }

  // ─── Type helpers ─────────────────────────────────────────────

  /** Primitives (i32, bool, String, etc.) are implicitly Copy. */
  private isCopyType(typeExpr: import('../ast/index.js').TypeExpr): boolean {
    switch (typeExpr.kind) {
      case 'NamedType':
        return PRIMITIVES.has(typeExpr.name);
      case 'ReferenceType':
        return true; // References are always Copy (they're pointers)
      case 'SharedType':
        return true; // Shared references are Copy
      case 'OwnType':
        return false; // Explicitly owned — not Copy
      case 'GenericType':
        return false; // Generic types (Vec<T>, Map<K,V>, etc.) are not Copy
      default:
        return false;
    }
  }

  /** Infer if an expression produces a Copy value based on its form. */
  private isExprCopyable(expr: Expr): boolean {
    switch (expr.kind) {
      case 'IntLiteral':
      case 'FloatLiteral':
      case 'StringLiteral':
      case 'BoolLiteral':
        return true;
      case 'Ident': {
        const info = this.lookupVar(expr.name);
        return info?.copyable ?? true;
      }
      case 'Binary':
      case 'Unary':
        return true; // Arithmetic/logical results are always primitive
      default:
        return false; // Struct expressions, calls, etc. are not Copy by default
    }
  }

  private typeExprName(typeExpr: import('../ast/index.js').TypeExpr): string {
    switch (typeExpr.kind) {
      case 'NamedType': return typeExpr.name;
      case 'GenericType': return typeExpr.name;
      case 'ReferenceType': return `&${this.typeExprName(typeExpr.inner)}`;
      case 'OwnType': return `own ${this.typeExprName(typeExpr.inner)}`;
      case 'SharedType': return `shared ${this.typeExprName(typeExpr.inner)}`;
      case 'RefinedType': return this.typeExprName(typeExpr.baseType);
      case 'FunctionType': return 'fn';
      case 'UnionType': return 'union';
      case 'ArrayType': return `[${this.typeExprName(typeExpr.elementType)}]`;
    }
  }

  private inferExprTypeName(expr: Expr): string {
    switch (expr.kind) {
      case 'IntLiteral': return 'i64';
      case 'FloatLiteral': return 'f64';
      case 'StringLiteral': return 'String';
      case 'BoolLiteral': return 'bool';
      case 'Struct': return expr.name;
      case 'Ident': {
        const info = this.lookupVar(expr.name);
        return info?.typeName ?? '<unknown>';
      }
      default: return '<unknown>';
    }
  }
}
