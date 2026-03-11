/**
 * Refined type checker for C!.
 *
 * Validates refined type constraints at compile time where possible.
 * Refined types look like:
 *   type Port = u16{1..65535}
 *   type Percentage = f64{0.0..=100.0}
 *   type Username = String{len: 1..50}
 *
 * This checker:
 * 1. Validates that base types of refined types are valid
 * 2. Validates that constraints are appropriate for the base type
 * 3. Checks literal assignments against range constraints at compile time
 * 4. Records refined type definitions for use in code generation (runtime checks)
 */

import type {
  Program,
  TypeDecl,
  FunctionDecl,
  Block,
  Stmt,
  Expr,
  TypeExpr,
  RefinedType,
  RefinementConstraint,
} from '../ast/index.js';
import type { Span } from '../lexer/index.js';
import type { Diagnostic } from '../errors/index.js';
import { createError, createWarning } from '../errors/index.js';
import { NUMERIC_TYPES } from './types.js';

// ─── Refined type info ────────────────────────────────────────────

export interface RangeConstraint {
  kind: 'range';
  min: number | null;
  max: number | null;
  inclusive: boolean; // Whether max is inclusive (..= vs ..)
}

export interface NamedConstraint {
  kind: 'named';
  name: string;
  range: RangeConstraint | null;
  pattern: string | null;
}

export type ResolvedConstraint = RangeConstraint | NamedConstraint;

export interface RefinedTypeInfo {
  baseName: string;
  constraints: ResolvedConstraint[];
}

// ─── Checker ──────────────────────────────────────────────────────

export class RefinementChecker {
  private diagnostics: Diagnostic[] = [];
  private refinedTypes = new Map<string, RefinedTypeInfo>();

  check(program: Program): Diagnostic[] {
    this.diagnostics = [];
    this.refinedTypes.clear();

    // Pass 1: Register refined type definitions
    for (const item of program.items) {
      if (item.kind === 'TypeDecl') {
        this.checkTypeDecl(item);
      }
    }

    // Pass 2: Check function bodies for literal violations
    for (const item of program.items) {
      if (item.kind === 'FunctionDecl') {
        this.checkFunction(item);
      }
    }

    return this.diagnostics;
  }

  /** Get registered refined types for codegen to emit runtime checks. */
  getRefinedTypes(): Map<string, RefinedTypeInfo> {
    return this.refinedTypes;
  }

  // ─── Type declaration checking ────────────────────────────────

  private checkTypeDecl(decl: TypeDecl): void {
    if (decl.body.kind !== 'Alias') return;

    const typeExpr = decl.body.type;
    if (typeExpr.kind !== 'RefinedType') return;

    const info = this.resolveRefinedType(typeExpr);
    if (info) {
      this.refinedTypes.set(decl.name, info);
    }
  }

  private resolveRefinedType(texpr: RefinedType): RefinedTypeInfo | null {
    const baseName = this.getBaseTypeName(texpr.baseType);
    if (!baseName) {
      this.error(
        `Refined type must have a named base type`,
        texpr.span,
      );
      return null;
    }

    const constraints: ResolvedConstraint[] = [];

    for (const c of texpr.constraints) {
      const resolved = this.resolveConstraint(c, baseName);
      if (resolved) {
        constraints.push(resolved);
      }
    }

    return { baseName, constraints };
  }

  private resolveConstraint(
    constraint: RefinementConstraint,
    baseName: string,
  ): ResolvedConstraint | null {
    if (constraint.name) {
      // Named constraint like `len: 1..50` or `matches: r"..."`
      return this.resolveNamedConstraint(constraint, baseName);
    }

    // Unnamed constraint — must be a range expression
    return this.resolveRangeExpr(constraint.value, baseName, constraint.span);
  }

  private resolveNamedConstraint(
    constraint: RefinementConstraint,
    baseName: string,
  ): NamedConstraint | null {
    const name = constraint.name!;

    // len constraint — valid for String, Vec, Array types
    if (name === 'len') {
      if (baseName !== 'String' && !baseName.startsWith('Vec') && !baseName.startsWith('[')) {
        this.error(
          `'len' constraint is only valid for String, Vec, or Array types, not '${baseName}'`,
          constraint.span,
        );
        return null;
      }

      const range = this.resolveRangeExpr(constraint.value, 'u64', constraint.span);
      return { kind: 'named', name: 'len', range, pattern: null };
    }

    // matches constraint — valid for String
    if (name === 'matches') {
      if (baseName !== 'String') {
        this.error(
          `'matches' constraint is only valid for String type, not '${baseName}'`,
          constraint.span,
        );
        return null;
      }

      // The value should be a string literal (regex pattern)
      if (constraint.value.kind === 'StringLiteral') {
        return { kind: 'named', name: 'matches', range: null, pattern: constraint.value.value };
      }

      this.warning(
        `'matches' constraint expects a string literal pattern`,
        constraint.span,
      );
      return { kind: 'named', name: 'matches', range: null, pattern: null };
    }

    // Unknown named constraint
    this.warning(
      `Unknown refinement constraint '${name}'`,
      constraint.span,
    );
    return null;
  }

  private resolveRangeExpr(
    expr: Expr,
    baseName: string,
    span: Span,
  ): RangeConstraint | null {
    // Range expression: 1..100 or 0.0..=100.0
    if (expr.kind === 'Range') {
      const min = expr.start ? this.evalNumericLiteral(expr.start) : null;
      const max = expr.end ? this.evalNumericLiteral(expr.end) : null;

      if (expr.start && min === null) {
        this.warning(`Range bound must be a numeric literal`, expr.start.span);
      }
      if (expr.end && max === null) {
        this.warning(`Range bound must be a numeric literal`, expr.end.span);
      }

      // Validate range for numeric base types
      if (NUMERIC_TYPES.has(baseName) || baseName === 'u64') {
        if (min !== null && max !== null && min > max) {
          this.error(
            `Invalid range: lower bound ${min} is greater than upper bound ${max}`,
            span,
          );
        }

        // Check that range fits within the base type
        this.validateRangeFitsType(min, max, baseName, span);
      }

      return { kind: 'range', min, max, inclusive: expr.inclusive };
    }

    // Single value — treated as a range with min == max
    const val = this.evalNumericLiteral(expr);
    if (val !== null) {
      return { kind: 'range', min: val, max: val, inclusive: true };
    }

    this.warning(
      `Refinement constraint must be a range expression (e.g., 1..100)`,
      span,
    );
    return null;
  }

  // ─── Function body checking ───────────────────────────────────

  private checkFunction(decl: FunctionDecl): void {
    this.checkBlock(decl.body);
  }

  private checkBlock(block: Block): void {
    for (const stmt of block.statements) {
      this.checkStmt(stmt);
    }
  }

  private checkStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case 'LetStmt':
        if (stmt.typeAnnotation && stmt.typeAnnotation.kind === 'RefinedType') {
          this.checkAssignmentToRefined(stmt.typeAnnotation, stmt.initializer);
        } else if (stmt.typeAnnotation?.kind === 'NamedType') {
          const info = this.refinedTypes.get(stmt.typeAnnotation.name);
          if (info) {
            this.checkLiteralAgainstConstraints(stmt.initializer, info, stmt.span);
          }
        }
        break;
      case 'IfStmt':
        this.checkBlock(stmt.then);
        if (stmt.else_) {
          if (stmt.else_.kind === 'IfStmt') {
            this.checkStmt(stmt.else_);
          } else {
            this.checkBlock(stmt.else_);
          }
        }
        break;
      case 'ForStmt':
        this.checkBlock(stmt.body);
        break;
      case 'MatchStmt':
        for (const arm of stmt.arms) {
          if (arm.body.kind === 'Block') {
            this.checkBlock(arm.body);
          }
        }
        break;
      default:
        break;
    }
  }

  private checkAssignmentToRefined(refinedType: RefinedType, value: Expr): void {
    const info = this.resolveRefinedType(refinedType);
    if (!info) return;
    this.checkLiteralAgainstConstraints(value, info, value.span);
  }

  private checkLiteralAgainstConstraints(
    expr: Expr,
    info: RefinedTypeInfo,
    span: Span,
  ): void {
    const val = this.evalNumericLiteral(expr);
    if (val === null) return; // Can't check non-literal at compile time

    for (const constraint of info.constraints) {
      if (constraint.kind === 'range') {
        this.checkValueInRange(val, constraint, info.baseName, span);
      } else if (constraint.kind === 'named' && constraint.name === 'len' && constraint.range) {
        // For string literals, check length
        if (expr.kind === 'StringLiteral') {
          this.checkValueInRange(expr.value.length, constraint.range, 'String.len', span);
        }
      }
    }
  }

  private checkValueInRange(
    value: number,
    range: RangeConstraint,
    typeName: string,
    span: Span,
  ): void {
    if (range.min !== null && value < range.min) {
      this.error(
        `Value ${value} is below minimum ${range.min} for refined type '${typeName}'`,
        span,
      );
    }

    if (range.max !== null) {
      if (range.inclusive && value > range.max) {
        this.error(
          `Value ${value} exceeds maximum ${range.max} for refined type '${typeName}'`,
          span,
        );
      } else if (!range.inclusive && value >= range.max) {
        this.error(
          `Value ${value} is not less than ${range.max} for refined type '${typeName}'`,
          span,
        );
      }
    }
  }

  // ─── Type range validation ────────────────────────────────────

  private validateRangeFitsType(
    min: number | null,
    max: number | null,
    baseName: string,
    span: Span,
  ): void {
    const bounds = TYPE_BOUNDS.get(baseName);
    if (!bounds) return;

    if (min !== null && min < bounds.min) {
      this.warning(
        `Range lower bound ${min} is below the minimum for type '${baseName}' (${bounds.min})`,
        span,
      );
    }

    if (max !== null && max > bounds.max) {
      this.warning(
        `Range upper bound ${max} exceeds the maximum for type '${baseName}' (${bounds.max})`,
        span,
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private getBaseTypeName(typeExpr: TypeExpr): string | null {
    if (typeExpr.kind === 'NamedType') return typeExpr.name;
    if (typeExpr.kind === 'GenericType') return typeExpr.name;
    return null;
  }

  private evalNumericLiteral(expr: Expr): number | null {
    switch (expr.kind) {
      case 'IntLiteral':
        return parseInt(expr.value, 10);
      case 'FloatLiteral':
        return parseFloat(expr.value);
      case 'Unary':
        if (expr.operator === '-') {
          const inner = this.evalNumericLiteral(expr.operand);
          return inner !== null ? -inner : null;
        }
        return null;
      default:
        return null;
    }
  }

  private error(message: string, span: Span): void {
    this.diagnostics.push(createError('E_REFINE', message, span));
  }

  private warning(message: string, span: Span): void {
    this.diagnostics.push(createWarning('W_REFINE', message, span));
  }
}

// ─── Type bounds ──────────────────────────────────────────────────

const TYPE_BOUNDS = new Map<string, { min: number; max: number }>([
  ['i8', { min: -128, max: 127 }],
  ['i16', { min: -32768, max: 32767 }],
  ['i32', { min: -2147483648, max: 2147483647 }],
  ['u8', { min: 0, max: 255 }],
  ['u16', { min: 0, max: 65535 }],
  ['u32', { min: 0, max: 4294967295 }],
]);
