/**
 * Two-pass type checker for the C! language.
 *
 * Pass 1 (declaration): registers top-level types and function signatures
 * so forward references work regardless of declaration order.
 *
 * Pass 2 (body): walks function bodies checking statements and expressions
 * against their expected types.
 */

import type {
  Program,
  TopLevelItem,
  FunctionDecl,
  TypeDecl,
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
import type { Type } from './types.js';
import { NUMERIC_TYPES, INTEGER_TYPES, FLOAT_TYPES, typeEquals, typeToString } from './types.js';
import { Environment } from './environment.js';
import { registerBuiltins } from './builtins.js';

const COMPARISON_OPS = new Set(['==', '!=', '<', '>', '<=', '>=']);
const LOGICAL_OPS = new Set(['&&', '||']);
const ARITHMETIC_OPS = new Set(['+', '-', '*', '/', '%']);

export class Checker {
  private env = new Environment();
  private diagnostics: Diagnostic[] = [];
  private currentReturnType: Type = { kind: 'Unit' };

  // ─── Main entry point ─────────────────────────────────────────────

  check(program: Program): Diagnostic[] {
    this.env = new Environment();
    this.diagnostics = [];
    registerBuiltins(this.env);

    // Pass 1: declarations
    for (const item of program.items) {
      this.registerTopLevel(item);
    }

    // Pass 2: bodies
    for (const item of program.items) {
      if (item.kind === 'FunctionDecl') {
        this.checkFunction(item);
      }
    }

    return this.diagnostics;
  }

  // ─── Pass 1: Declaration registration ─────────────────────────────

  private registerTopLevel(item: TopLevelItem): void {
    switch (item.kind) {
      case 'TypeDecl':
        this.registerType(item);
        break;
      case 'FunctionDecl':
        this.registerFunction(item);
        break;
      // Phase 1 skips: actors, contracts, servers, components, use, mod
      case 'ActorDecl':
      case 'ContractDecl':
      case 'ServerDecl':
      case 'ComponentDecl':
      case 'UseDecl':
      case 'ModDecl':
      case 'StateDecl':
        break;
    }
  }

  private registerType(decl: TypeDecl): void {
    if (this.env.lookupType(decl.name) !== undefined) {
      this.error(`Type '${decl.name}' is already defined`, decl.span);
      return;
    }

    switch (decl.body.kind) {
      case 'Alias': {
        const resolved = this.resolveTypeExpr(decl.body.type);
        this.env.defineType(decl.name, resolved);
        break;
      }
      case 'Struct': {
        const fields = new Map<string, Type>();
        for (const f of decl.body.fields) {
          fields.set(f.name, this.resolveTypeExpr(f.typeAnnotation));
        }
        const structType: Type = { kind: 'Struct', name: decl.name, fields };
        this.env.defineType(decl.name, structType);
        // Also register the struct constructor as a value (for `Point { ... }` lookup)
        break;
      }
      case 'Enum': {
        const variants = new Map<string, Type | null>();
        for (const v of decl.body.variants) {
          variants.set(v.name, v.fields && v.fields.length > 0
            ? this.resolveTypeExpr(v.fields[0]!)
            : null);
        }
        const unionType: Type = { kind: 'Union', name: decl.name, variants };
        this.env.defineType(decl.name, unionType);
        // Register each variant as a value
        for (const v of decl.body.variants) {
          this.env.define(v.name, unionType);
        }
        break;
      }
    }
  }

  private registerFunction(decl: FunctionDecl): void {
    if (this.env.lookup(decl.name) !== undefined) {
      this.error(`Function '${decl.name}' is already defined`, decl.span);
      return;
    }

    const params: Type[] = decl.params.map(p => this.resolveTypeExpr(p.typeAnnotation));
    const ret: Type = decl.returnType
      ? this.resolveTypeExpr(decl.returnType)
      : { kind: 'Unit' };

    this.env.define(decl.name, { kind: 'Function', params, ret });
  }

  // ─── Pass 2: Body checking ────────────────────────────────────────

  private checkFunction(decl: FunctionDecl): void {
    const fnType = this.env.lookup(decl.name);
    if (!fnType || fnType.kind !== 'Function') return;

    this.currentReturnType = fnType.ret;
    this.env.enter();

    // Bind parameters
    for (let i = 0; i < decl.params.length; i++) {
      this.env.define(decl.params[i]!.name, fnType.params[i]!);
    }

    this.checkBlock(decl.body);
    this.env.leave();
  }

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
        this.checkReturnStmt(stmt);
        break;
      case 'IfStmt':
        this.checkIfStmt(stmt);
        break;
      case 'ForStmt':
        this.checkForStmt(stmt);
        break;
      case 'AssignStmt':
        this.checkAssignStmt(stmt);
        break;
      case 'MatchStmt':
        this.checkMatchStmt(stmt);
        break;
      case 'ExprStmt':
        this.inferExpr(stmt.expr);
        break;
      // Phase 1 skips: reply, emit, spawn, deploy
      case 'ReplyStmt':
      case 'EmitStmt':
      case 'SpawnStmt':
      case 'DeployStmt':
        break;
    }
  }

  // ─── Statement checkers ───────────────────────────────────────────

  private checkLetStmt(stmt: import('../ast/index.js').LetStmt): void {
    if (stmt.typeAnnotation) {
      const annotType = this.resolveTypeExpr(stmt.typeAnnotation);
      // Pass annotation type as context so literals can narrow
      const initType = this.inferExpr(stmt.initializer, annotType);
      if (annotType.kind !== 'Unknown' && initType.kind !== 'Unknown'
        && !typeEquals(annotType, initType)) {
        this.error(
          `Type mismatch: expected ${typeToString(annotType)}, got ${typeToString(initType)}`,
          stmt.span,
        );
      }
      this.env.define(stmt.name, annotType);
    } else {
      const initType = this.inferExpr(stmt.initializer);
      this.env.define(stmt.name, initType);
    }
  }

  private checkReturnStmt(stmt: import('../ast/index.js').ReturnStmt): void {
    const valType = stmt.value
      ? this.inferExpr(stmt.value, this.currentReturnType)
      : { kind: 'Unit' } as Type;

    if (this.currentReturnType.kind !== 'Unknown' && valType.kind !== 'Unknown'
      && !typeEquals(this.currentReturnType, valType)) {
      this.error(
        `Return type mismatch: expected ${typeToString(this.currentReturnType)}, got ${typeToString(valType)}`,
        stmt.span,
      );
    }
  }

  private checkIfStmt(stmt: import('../ast/index.js').IfStmt): void {
    const condType = this.inferExpr(stmt.condition);
    if (condType.kind !== 'Unknown'
      && !(condType.kind === 'Primitive' && condType.name === 'bool')) {
      this.error(
        `If condition must be bool, got ${typeToString(condType)}`,
        stmt.condition.span,
      );
    }

    this.env.enter();
    this.checkBlock(stmt.then);
    this.env.leave();

    if (stmt.else_) {
      if (stmt.else_.kind === 'IfStmt') {
        this.checkIfStmt(stmt.else_);
      } else {
        this.env.enter();
        this.checkBlock(stmt.else_);
        this.env.leave();
      }
    }
  }

  private checkForStmt(stmt: import('../ast/index.js').ForStmt): void {
    this.inferExpr(stmt.iterable);
    this.env.enter();
    // Phase 1: bind loop variable as Unknown
    this.env.define(stmt.variable, { kind: 'Unknown' });
    this.checkBlock(stmt.body);
    this.env.leave();
  }

  private checkAssignStmt(stmt: import('../ast/index.js').AssignStmt): void {
    const targetType = this.inferExpr(stmt.target);
    const valueType = this.inferExpr(stmt.value, targetType);

    if (stmt.operator === '+=' || stmt.operator === '-=') {
      if (targetType.kind === 'Primitive' && !NUMERIC_TYPES.has(targetType.name)) {
        this.error(
          `Compound assignment requires numeric type, got ${typeToString(targetType)}`,
          stmt.span,
        );
      }
    }

    if (targetType.kind !== 'Unknown' && valueType.kind !== 'Unknown'
      && !typeEquals(targetType, valueType)) {
      this.error(
        `Assignment type mismatch: expected ${typeToString(targetType)}, got ${typeToString(valueType)}`,
        stmt.span,
      );
    }
  }

  private checkMatchStmt(stmt: import('../ast/index.js').MatchStmt): void {
    this.inferExpr(stmt.subject);
    for (const arm of stmt.arms) {
      this.checkMatchArm(arm);
    }
  }

  private checkMatchArm(arm: MatchArm): void {
    this.env.enter();
    this.bindPattern(arm.pattern);
    if (arm.body.kind === 'Block') {
      this.checkBlock(arm.body);
    } else {
      this.inferExpr(arm.body);
    }
    this.env.leave();
  }

  private bindPattern(pattern: Pattern): void {
    switch (pattern.kind) {
      case 'IdentPattern':
        this.env.define(pattern.name, { kind: 'Unknown' });
        break;
      case 'ConstructorPattern':
        for (const field of pattern.fields) {
          this.bindPattern(field);
        }
        break;
      case 'LiteralPattern':
      case 'WildcardPattern':
        break;
    }
  }

  // ─── Expression inference ─────────────────────────────────────────

  private inferExpr(expr: Expr, expectedType?: Type): Type {
    switch (expr.kind) {
      case 'IntLiteral':
        // Contextual narrowing: integer literals adopt the expected integer type
        if (expectedType?.kind === 'Primitive' && INTEGER_TYPES.has(expectedType.name)) {
          return expectedType;
        }
        return { kind: 'Primitive', name: 'i64' };
      case 'FloatLiteral':
        // Contextual narrowing: float literals adopt the expected float type
        if (expectedType?.kind === 'Primitive' && FLOAT_TYPES.has(expectedType.name)) {
          return expectedType;
        }
        return { kind: 'Primitive', name: 'f64' };
      case 'StringLiteral':
        return { kind: 'Primitive', name: 'String' };
      case 'BoolLiteral':
        return { kind: 'Primitive', name: 'bool' };
      case 'Ident':
        return this.inferIdent(expr);
      case 'Binary':
        return this.inferBinary(expr, expectedType);
      case 'Unary':
        return this.inferUnary(expr, expectedType);
      case 'Call':
        return this.inferCall(expr);
      case 'FieldAccess':
        return this.inferFieldAccess(expr);
      case 'Index':
        return this.inferIndex(expr);
      case 'Struct':
        return this.inferStruct(expr);
      case 'IfExpr':
        return this.inferIfExpr(expr);
      case 'MacroCall':
        return this.inferMacroCall(expr);
      case 'BlockExpr':
        return this.inferBlockExpr(expr);
      case 'MatchExpr':
        return this.inferMatchExpr(expr);
      case 'Path':
        return this.inferPath(expr);
      // Phase 1 fallbacks
      case 'MethodCall':
      case 'Parallel':
      case 'Scope':
      case 'Range':
      case 'ArrayLiteral':
      case 'Closure':
      case 'StringInterpolation':
        return { kind: 'Unknown' };
    }
  }

  private inferIdent(expr: import('../ast/index.js').IdentExpr): Type {
    const t = this.env.lookup(expr.name);
    if (t === undefined) {
      this.error(`Undefined variable '${expr.name}'`, expr.span);
      return { kind: 'Unknown' };
    }
    return t;
  }

  private inferBinary(expr: import('../ast/index.js').BinaryExpr, expectedType?: Type): Type {
    // For arithmetic, thread expected type so literals narrow (e.g., 1 + 2 as u16)
    const numericCtx = ARITHMETIC_OPS.has(expr.operator) ? expectedType : undefined;
    const left = this.inferExpr(expr.left, numericCtx);
    const right = this.inferExpr(expr.right, numericCtx);

    if (COMPARISON_OPS.has(expr.operator)) {
      return { kind: 'Primitive', name: 'bool' };
    }

    if (LOGICAL_OPS.has(expr.operator)) {
      const boolType: Type = { kind: 'Primitive', name: 'bool' };
      if (left.kind !== 'Unknown' && !typeEquals(left, boolType)) {
        this.error(
          `Logical operator '${expr.operator}' requires bool operands, got ${typeToString(left)}`,
          expr.left.span,
        );
      }
      if (right.kind !== 'Unknown' && !typeEquals(right, boolType)) {
        this.error(
          `Logical operator '${expr.operator}' requires bool operands, got ${typeToString(right)}`,
          expr.right.span,
        );
      }
      return boolType;
    }

    if (ARITHMETIC_OPS.has(expr.operator)) {
      if (left.kind !== 'Unknown' && right.kind !== 'Unknown'
        && !typeEquals(left, right)) {
        this.error(
          `Arithmetic operands must have same type: ${typeToString(left)} vs ${typeToString(right)}`,
          expr.span,
        );
      }
      if (left.kind === 'Primitive' && NUMERIC_TYPES.has(left.name)) return left;
      if (right.kind === 'Primitive' && NUMERIC_TYPES.has(right.name)) return right;
      // String concatenation with +
      if (expr.operator === '+' && left.kind === 'Primitive' && left.name === 'String') return left;
      return left.kind !== 'Unknown' ? left : right;
    }

    // Fallback
    return left.kind !== 'Unknown' ? left : right;
  }

  private inferUnary(expr: import('../ast/index.js').UnaryExpr, expectedType?: Type): Type {
    // For negation, thread expected type so -20 narrows to i16 if context demands
    const operandType = this.inferExpr(expr.operand, expr.operator === '-' ? expectedType : undefined);

    if (expr.operator === '!') {
      const boolType: Type = { kind: 'Primitive', name: 'bool' };
      if (operandType.kind !== 'Unknown' && !typeEquals(operandType, boolType)) {
        this.error(
          `Unary '!' requires bool, got ${typeToString(operandType)}`,
          expr.operand.span,
        );
      }
      return boolType;
    }

    if (expr.operator === '-') {
      return operandType;
    }

    return operandType;
  }

  private inferCall(expr: import('../ast/index.js').CallExpr): Type {
    const calleeType = this.inferExpr(expr.callee);

    if (calleeType.kind === 'Unknown') {
      // Still infer args for error checking
      for (const arg of expr.args) {
        this.inferExpr(arg.value);
      }
      return { kind: 'Unknown' };
    }

    if (calleeType.kind !== 'Function') {
      this.error(
        `Cannot call non-function type ${typeToString(calleeType)}`,
        expr.callee.span,
      );
      for (const arg of expr.args) {
        this.inferExpr(arg.value);
      }
      return { kind: 'Unknown' };
    }

    if (expr.args.length !== calleeType.params.length) {
      this.error(
        `Expected ${calleeType.params.length} argument(s), got ${expr.args.length}`,
        expr.span,
      );
    }

    for (let i = 0; i < expr.args.length; i++) {
      const paramType = i < calleeType.params.length ? calleeType.params[i]! : undefined;
      const argType = this.inferExpr(expr.args[i]!.value, paramType);
      if (paramType && paramType.kind !== 'Unknown' && argType.kind !== 'Unknown'
        && !typeEquals(paramType, argType)) {
        this.error(
          `Argument type mismatch: expected ${typeToString(paramType)}, got ${typeToString(argType)}`,
          expr.args[i]!.span,
        );
      }
    }

    return calleeType.ret;
  }

  private inferFieldAccess(expr: import('../ast/index.js').FieldAccessExpr): Type {
    const objType = this.inferExpr(expr.object);

    if (objType.kind === 'Unknown') return { kind: 'Unknown' };

    if (objType.kind === 'Struct') {
      const fieldType = objType.fields.get(expr.field);
      if (fieldType === undefined) {
        this.error(
          `Type '${objType.name}' has no field '${expr.field}'`,
          expr.span,
        );
        return { kind: 'Unknown' };
      }
      return fieldType;
    }

    // Phase 1: no method resolution on non-struct types
    return { kind: 'Unknown' };
  }

  private inferIndex(expr: import('../ast/index.js').IndexExpr): Type {
    this.inferExpr(expr.object);
    this.inferExpr(expr.index);
    // Phase 1: return Unknown
    return { kind: 'Unknown' };
  }

  private inferStruct(expr: import('../ast/index.js').StructExpr): Type {
    const t = this.env.lookupType(expr.name);
    if (t === undefined) {
      this.error(`Undefined type '${expr.name}'`, expr.span);
      for (const f of expr.fields) {
        this.inferExpr(f.value);
      }
      return { kind: 'Unknown' };
    }

    if (t.kind !== 'Struct') {
      this.error(`'${expr.name}' is not a struct type`, expr.span);
      for (const f of expr.fields) {
        this.inferExpr(f.value);
      }
      return { kind: 'Unknown' };
    }

    for (const f of expr.fields) {
      const fieldType = t.fields.get(f.name);
      if (fieldType === undefined) {
        this.error(
          `Type '${expr.name}' has no field '${f.name}'`,
          f.span,
        );
        this.inferExpr(f.value);
        continue;
      }
      const valType = this.inferExpr(f.value, fieldType);
      if (fieldType.kind !== 'Unknown' && valType.kind !== 'Unknown'
        && !typeEquals(fieldType, valType)) {
        this.error(
          `Field '${f.name}' expects ${typeToString(fieldType)}, got ${typeToString(valType)}`,
          f.span,
        );
      }
    }

    return t;
  }

  private inferIfExpr(expr: import('../ast/index.js').IfExpr): Type {
    const condType = this.inferExpr(expr.condition);
    if (condType.kind !== 'Unknown'
      && !(condType.kind === 'Primitive' && condType.name === 'bool')) {
      this.error(
        `If condition must be bool, got ${typeToString(condType)}`,
        expr.condition.span,
      );
    }

    this.env.enter();
    this.checkBlock(expr.then);
    this.env.leave();

    if (expr.else_) {
      if (expr.else_.kind === 'IfExpr') {
        this.inferIfExpr(expr.else_);
      } else {
        this.env.enter();
        this.checkBlock(expr.else_);
        this.env.leave();
      }
    }

    // Phase 1: no block-value inference
    return { kind: 'Unknown' };
  }

  private inferMacroCall(expr: import('../ast/index.js').MacroCallExpr): Type {
    for (const arg of expr.args) {
      this.inferExpr(arg);
    }

    // Math macros return f64
    const mathMacros = [
      'math_sin', 'math_cos', 'math_tan', 'math_sqrt',
      'math_floor', 'math_abs', 'math_atan2', 'math_min',
      'math_max', 'math_round', 'math_random',
    ];
    if (mathMacros.includes(expr.name)) {
      return { kind: 'Primitive', name: 'f64' };
    }

    return { kind: 'Unit' };
  }

  private inferBlockExpr(expr: import('../ast/index.js').BlockExpr): Type {
    this.env.enter();
    this.checkBlock(expr.block);
    this.env.leave();
    return { kind: 'Unknown' };
  }

  private inferMatchExpr(expr: import('../ast/index.js').MatchExpr): Type {
    this.inferExpr(expr.subject);
    for (const arm of expr.arms) {
      this.checkMatchArm(arm);
    }
    return { kind: 'Unknown' };
  }

  private inferPath(expr: import('../ast/index.js').PathExpr): Type {
    // Try to resolve as a value (e.g., enum variant)
    const fullName = expr.segments.join('::');
    const last = expr.segments[expr.segments.length - 1]!;
    const t = this.env.lookup(last) ?? this.env.lookup(fullName);
    if (t !== undefined) return t;
    return { kind: 'Unknown' };
  }

  // ─── Type resolution ──────────────────────────────────────────────

  private resolveTypeExpr(texpr: TypeExpr): Type {
    switch (texpr.kind) {
      case 'NamedType': {
        const t = this.env.lookupType(texpr.name);
        if (t === undefined) {
          this.error(`Undefined type '${texpr.name}'`, texpr.span);
          return { kind: 'Unknown' };
        }
        return t;
      }
      case 'GenericType': {
        const args = texpr.typeArgs.map(a => this.resolveTypeExpr(a));
        return { kind: 'Generic', name: texpr.name, args };
      }
      case 'RefinedType':
        // Strip refinement, use base type
        return this.resolveTypeExpr(texpr.baseType);
      case 'FunctionType': {
        const params = texpr.params.map(p => this.resolveTypeExpr(p));
        const ret = this.resolveTypeExpr(texpr.returnType);
        return { kind: 'Function', params, ret };
      }
      case 'UnionType':
        // Inline union type: return Unknown for Phase 1
        return { kind: 'Unknown' };
      case 'ReferenceType':
        // Strip reference wrapper
        return this.resolveTypeExpr(texpr.inner);
      case 'OwnType':
        // Strip own wrapper
        return this.resolveTypeExpr(texpr.inner);
      case 'SharedType':
        // Strip shared wrapper
        return this.resolveTypeExpr(texpr.inner);
      default:
        return { kind: 'Unknown' };
    }
  }

  // ─── Error helper ─────────────────────────────────────────────────

  private error(message: string, span: Span): void {
    this.diagnostics.push(createError('E_TYPE', message, span));
  }
}
