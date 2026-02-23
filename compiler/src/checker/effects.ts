/**
 * Effect system checker for C!.
 *
 * Validates that effect annotations on functions are consistent:
 * 1. Pure functions cannot call effectful functions
 * 2. Functions must declare all effects of functions they call
 * 3. Known effects are validated (IO, Database, Network, FileSystem, etc.)
 * 4. Async functions implicitly have the Async effect
 * 5. Pure functions cannot contain print/println (IO effect)
 *
 * Effects are declared with the `with` keyword:
 *   fn save(user: User) -> Result<()> with IO, Database { ... }
 *
 * Pure functions are declared with the `pure` keyword:
 *   pure fn add(a: i32, b: i32) -> i32 { a + b }
 */

import type {
  Program,
  FunctionDecl,
  ActorDecl,
  ContractDecl,
  ServerDecl,
  Block,
  Stmt,
  Expr,
} from '../ast/index.js';
import type { Span } from '../lexer/index.js';
import type { Diagnostic } from '../errors/index.js';
import { createError, createWarning } from '../errors/index.js';

// ─── Known effects ───────────────────────────────────────────────

const KNOWN_EFFECTS = new Set([
  'IO',
  'Database',
  'Network',
  'FileSystem',
  'Crypto',
  'Random',
  'Time',
  'Console',
  'RateLimit',
  'Async',
  'GPU',
  'FFI',
]);

/** Effects implicitly carried by built-in functions. */
const BUILTIN_EFFECTS: Record<string, string[]> = {
  'print': ['IO'],
  'println': ['IO'],
};

// ─── Checker ─────────────────────────────────────────────────────

export class EffectChecker {
  private diagnostics: Diagnostic[] = [];
  /** Maps function name → declared effects. */
  private functionEffects = new Map<string, FunctionEffectInfo>();

  check(program: Program): Diagnostic[] {
    this.diagnostics = [];
    this.functionEffects.clear();

    // Pass 1: Register all function signatures and their effects
    this.registerProgram(program);

    // Pass 2: Check function bodies for effect violations
    this.checkProgram(program);

    return this.diagnostics;
  }

  // ─── Pass 1: Registration ────────────────────────────────────

  private registerProgram(program: Program): void {
    for (const item of program.items) {
      switch (item.kind) {
        case 'FunctionDecl':
          this.registerFunction(item);
          break;
        case 'ActorDecl':
          this.registerActorMethods(item);
          break;
        case 'ContractDecl':
          this.registerContractMethods(item);
          break;
        case 'ServerDecl':
          this.registerServerMethods(item);
          break;
      }
    }
  }

  private registerFunction(decl: FunctionDecl): void {
    const effects = new Set(decl.effects);

    // Async functions implicitly carry the Async effect
    if (decl.isAsync && !effects.has('Async')) {
      effects.add('Async');
    }

    // Validate effect names
    for (const eff of decl.effects) {
      if (!KNOWN_EFFECTS.has(eff)) {
        this.warning(
          `Unknown effect '${eff}' on function '${decl.name}'`,
          decl.span,
          `Known effects: ${[...KNOWN_EFFECTS].join(', ')}`,
        );
      }
    }

    // Pure functions cannot declare effects
    if (decl.isPure && effects.size > 0) {
      const effList = [...effects].filter(e => e !== 'Async').join(', ');
      if (effList) {
        this.error(
          `Pure function '${decl.name}' cannot declare effects: ${effList}`,
          decl.span,
        );
      }
    }

    this.functionEffects.set(decl.name, {
      isPure: decl.isPure,
      effects,
      span: decl.span,
    });
  }

  private registerActorMethods(decl: ActorDecl): void {
    for (const member of decl.members) {
      if (member.kind === 'FunctionDecl') {
        this.registerFunction(member);
      }
    }
  }

  private registerContractMethods(decl: ContractDecl): void {
    for (const member of decl.members) {
      if (member.kind === 'FunctionDecl') {
        this.registerFunction(member);
      }
    }
  }

  private registerServerMethods(decl: ServerDecl): void {
    for (const member of decl.members) {
      if (member.kind === 'FunctionDecl') {
        this.registerFunction(member);
      }
    }
  }

  // ─── Pass 2: Body checking ──────────────────────────────────

  private checkProgram(program: Program): void {
    for (const item of program.items) {
      switch (item.kind) {
        case 'FunctionDecl':
          this.checkFunction(item);
          break;
        case 'ActorDecl':
          for (const member of item.members) {
            if (member.kind === 'FunctionDecl') {
              this.checkFunction(member);
            }
          }
          break;
        case 'ContractDecl':
          for (const member of item.members) {
            if (member.kind === 'FunctionDecl') {
              this.checkFunction(member);
            }
          }
          break;
        case 'ServerDecl':
          for (const member of item.members) {
            if (member.kind === 'FunctionDecl') {
              this.checkFunction(member);
            }
          }
          break;
      }
    }
  }

  private checkFunction(decl: FunctionDecl): void {
    const callerInfo = this.functionEffects.get(decl.name);
    if (!callerInfo) return;

    const ctx: CheckContext = {
      callerName: decl.name,
      callerEffects: callerInfo.effects,
      isPure: callerInfo.isPure,
    };

    this.checkBlock(decl.body, ctx);
  }

  private checkBlock(block: Block, ctx: CheckContext): void {
    for (const stmt of block.statements) {
      this.checkStmt(stmt, ctx);
    }
  }

  private checkStmt(stmt: Stmt, ctx: CheckContext): void {
    switch (stmt.kind) {
      case 'ExprStmt':
        this.checkExpr(stmt.expr, ctx);
        break;
      case 'LetStmt':
        this.checkExpr(stmt.initializer, ctx);
        break;
      case 'ReturnStmt':
        if (stmt.value) this.checkExpr(stmt.value, ctx);
        break;
      case 'AssignStmt':
        this.checkExpr(stmt.value, ctx);
        break;
      case 'IfStmt':
        this.checkExpr(stmt.condition, ctx);
        this.checkBlock(stmt.then, ctx);
        if (stmt.else_) {
          if (stmt.else_.kind === 'IfStmt') {
            this.checkStmt(stmt.else_, ctx);
          } else {
            this.checkBlock(stmt.else_, ctx);
          }
        }
        break;
      case 'WhileStmt':
        this.checkExpr(stmt.condition, ctx);
        this.checkBlock(stmt.body, ctx);
        break;
      case 'ForStmt':
        this.checkExpr(stmt.iterable, ctx);
        this.checkBlock(stmt.body, ctx);
        break;
      case 'MatchStmt':
        this.checkExpr(stmt.subject, ctx);
        for (const arm of stmt.arms) {
          if (arm.body.kind === 'Block') {
            this.checkBlock(arm.body, ctx);
          }
        }
        break;
      default:
        break;
    }
  }

  private checkExpr(expr: Expr, ctx: CheckContext): void {
    switch (expr.kind) {
      case 'Call':
        this.checkCall(expr, ctx);
        break;
      case 'MacroCall':
        this.checkMacroCall(expr, ctx);
        break;
      case 'Binary':
        this.checkExpr(expr.left, ctx);
        this.checkExpr(expr.right, ctx);
        break;
      case 'Unary':
        this.checkExpr(expr.operand, ctx);
        break;
      case 'FieldAccess':
        this.checkExpr(expr.object, ctx);
        break;
      case 'Index':
        this.checkExpr(expr.object, ctx);
        this.checkExpr(expr.index, ctx);
        break;
      case 'Closure':
        // Closures inherit the effect context — check the body
        this.checkBlock(expr.body, ctx);
        break;
      default:
        break;
    }
  }

  private checkCall(expr: Expr & { kind: 'Call' }, ctx: CheckContext): void {
    // Check arguments first
    for (const arg of expr.args) {
      this.checkExpr(arg.value, ctx);
    }

    // Get the callee name
    const calleeName = this.getCalleeName(expr.callee);
    if (!calleeName) return;

    // Check built-in effects
    const builtinEffects = BUILTIN_EFFECTS[calleeName];
    if (builtinEffects) {
      for (const eff of builtinEffects) {
        this.checkEffectAllowed(eff, calleeName, ctx, expr.callee.span);
      }
      return;
    }

    // Check against registered functions
    const calleeInfo = this.functionEffects.get(calleeName);
    if (!calleeInfo) return; // Unknown function — can't check

    // Every effect the callee has must be allowed by the caller
    for (const eff of calleeInfo.effects) {
      this.checkEffectAllowed(eff, calleeName, ctx, expr.callee.span);
    }
  }

  private checkMacroCall(
    expr: Expr & { kind: 'MacroCall' },
    ctx: CheckContext,
  ): void {
    // Check arguments
    for (const arg of expr.args) {
      this.checkExpr(arg, ctx);
    }

    // print!/println! macros have IO effect
    if (expr.name === 'print' || expr.name === 'println') {
      this.checkEffectAllowed('IO', expr.name, ctx, expr.span);
    }
  }

  private checkEffectAllowed(
    effect: string,
    calleeName: string,
    ctx: CheckContext,
    span: Span,
  ): void {
    if (ctx.isPure) {
      this.error(
        `Pure function '${ctx.callerName}' cannot call effectful '${calleeName}' (requires ${effect})`,
        span,
      );
      return;
    }

    if (!ctx.callerEffects.has(effect)) {
      this.error(
        `Function '${ctx.callerName}' calls '${calleeName}' which requires effect '${effect}', but '${ctx.callerName}' does not declare 'with ${effect}'`,
        span,
      );
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private getCalleeName(expr: Expr): string | null {
    if (expr.kind === 'Ident') return expr.name;
    if (expr.kind === 'Path') return expr.segments[expr.segments.length - 1] ?? null;
    return null;
  }

  private error(message: string, span: Span): void {
    this.diagnostics.push(createError('E_EFFECT', message, span));
  }

  private warning(message: string, span: Span, suggestion?: string): void {
    this.diagnostics.push(createWarning('W_EFFECT', message, span, { suggestion }));
  }
}

// ─── Types ───────────────────────────────────────────────────────

interface FunctionEffectInfo {
  isPure: boolean;
  effects: Set<string>;
  span: Span;
}

interface CheckContext {
  callerName: string;
  callerEffects: Set<string>;
  isPure: boolean;
}
