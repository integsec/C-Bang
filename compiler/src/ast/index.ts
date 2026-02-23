/**
 * AST (Abstract Syntax Tree) node definitions for the C! language.
 *
 * Every node carries a `span` for error reporting. Nodes are designed
 * to represent the full C! grammar including actors, contracts,
 * components, servers, refined types, and intent annotations.
 */

import type { Span } from '../lexer/index.js';

// ─── Base ──────────────────────────────────────────────────────────

export interface BaseNode {
  span: Span;
}

// ─── Program ───────────────────────────────────────────────────────

export interface Program extends BaseNode {
  kind: 'Program';
  items: TopLevelItem[];
}

export type TopLevelItem =
  | FunctionDecl
  | TypeDecl
  | ActorDecl
  | ContractDecl
  | ServerDecl
  | ComponentDecl
  | UseDecl
  | ModDecl
  | StateDecl
  | EnumDecl;

// ─── Annotations ───────────────────────────────────────────────────

export interface Annotation extends BaseNode {
  kind: 'Annotation';
  name: string;
  args: string;
  raw: string;
}

// ─── Declarations ──────────────────────────────────────────────────

export interface FunctionDecl extends BaseNode {
  kind: 'FunctionDecl';
  name: string;
  annotations: Annotation[];
  visibility: Visibility;
  isPure: boolean;
  isAsync: boolean;
  params: Parameter[];
  returnType: TypeExpr | null;
  effects: string[];
  body: Block;
}

export interface Parameter extends BaseNode {
  kind: 'Parameter';
  name: string;
  ownership: Ownership;
  typeAnnotation: TypeExpr;
}

export type Visibility = 'private' | 'public' | 'package';

export type Ownership = 'owned' | 'borrowed' | 'borrowed_mut' | 'shared' | 'own';

export interface TypeDecl extends BaseNode {
  kind: 'TypeDecl';
  name: string;
  annotations: Annotation[];
  visibility: Visibility;
  typeParams: TypeParam[];
  body: TypeBody;
}

export type TypeBody =
  | { kind: 'Alias'; type: TypeExpr }
  | { kind: 'Struct'; fields: FieldDecl[] }
  | { kind: 'Enum'; variants: Variant[] };

export interface TypeParam extends BaseNode {
  kind: 'TypeParam';
  name: string;
}

export interface FieldDecl extends BaseNode {
  kind: 'FieldDecl';
  name: string;
  typeAnnotation: TypeExpr;
  defaultValue: Expr | null;
}

export interface Variant extends BaseNode {
  kind: 'Variant';
  name: string;
  fields: TypeExpr[] | null;
}

export interface ActorDecl extends BaseNode {
  kind: 'ActorDecl';
  name: string;
  annotations: Annotation[];
  visibility: Visibility;
  members: ActorMember[];
}

export type ActorMember =
  | StateDecl
  | OnHandler
  | FunctionDecl
  | SuperviseDecl
  | InitDecl;

export interface StateDecl extends BaseNode {
  kind: 'StateDecl';
  name: string;
  typeAnnotation: TypeExpr;
  initializer: Expr | null;
}

export interface OnHandler extends BaseNode {
  kind: 'OnHandler';
  messageName: string;
  params: Parameter[];
  returnType: TypeExpr | null;
  body: Block;
}

export interface SuperviseDecl extends BaseNode {
  kind: 'SuperviseDecl';
  childName: string;
  options: SuperviseOption[];
}

export interface SuperviseOption extends BaseNode {
  kind: 'SuperviseOption';
  key: string;
  value: Expr;
}

export interface InitDecl extends BaseNode {
  kind: 'InitDecl';
  params: Parameter[];
  body: Block;
}

export interface ContractDecl extends BaseNode {
  kind: 'ContractDecl';
  name: string;
  annotations: Annotation[];
  visibility: Visibility;
  interfaces: string[];
  members: ContractMember[];
}

export type ContractMember =
  | StateDecl
  | FunctionDecl
  | InitDecl;

export interface ServerDecl extends BaseNode {
  kind: 'ServerDecl';
  name: string;
  annotations: Annotation[];
  visibility: Visibility;
  members: ServerMember[];
}

export type ServerMember =
  | FunctionDecl
  | StateDecl
  | FieldAssignment;

export interface FieldAssignment extends BaseNode {
  kind: 'FieldAssignment';
  name: string;
  value: Expr;
}

export interface ComponentDecl extends BaseNode {
  kind: 'ComponentDecl';
  name: string;
  annotations: Annotation[];
  visibility: Visibility;
  params: Parameter[];
  body: Block;
}

export interface UseDecl extends BaseNode {
  kind: 'UseDecl';
  path: string[];
  items: UseItem[];
  isWildcard: boolean;
}

export type UseItem =
  | { kind: 'Named'; name: string; alias: string | null }
  | { kind: 'Wildcard' };

export interface ModDecl extends BaseNode {
  kind: 'ModDecl';
  name: string;
  body: TopLevelItem[] | null;
}

export interface EnumDecl extends BaseNode {
  kind: 'EnumDecl';
  name: string;
  annotations: Annotation[];
  visibility: Visibility;
  typeParams: TypeParam[];
  variants: EnumVariant[];
}

export type EnumVariant =
  | UnitVariant
  | TupleVariant
  | StructVariant;

export interface UnitVariant extends BaseNode {
  kind: 'UnitVariant';
  name: string;
}

export interface TupleVariant extends BaseNode {
  kind: 'TupleVariant';
  name: string;
  fields: TypeExpr[];
}

export interface StructVariant extends BaseNode {
  kind: 'StructVariant';
  name: string;
  fields: FieldDecl[];
}

// ─── Type Expressions ──────────────────────────────────────────────

export type TypeExpr =
  | NamedType
  | GenericType
  | RefinedType
  | FunctionType
  | UnionType
  | ReferenceType
  | OwnType
  | SharedType
  | ArrayType;

export interface NamedType extends BaseNode {
  kind: 'NamedType';
  name: string;
  path: string[];
}

export interface GenericType extends BaseNode {
  kind: 'GenericType';
  name: string;
  path: string[];
  typeArgs: TypeExpr[];
}

export interface RefinedType extends BaseNode {
  kind: 'RefinedType';
  baseType: TypeExpr;
  constraints: RefinementConstraint[];
}

export interface RefinementConstraint extends BaseNode {
  kind: 'RefinementConstraint';
  name: string | null;
  value: Expr;
}

export interface FunctionType extends BaseNode {
  kind: 'FunctionType';
  params: TypeExpr[];
  returnType: TypeExpr;
}

export interface UnionType extends BaseNode {
  kind: 'UnionType';
  types: TypeExpr[];
}

export interface ReferenceType extends BaseNode {
  kind: 'ReferenceType';
  mutable: boolean;
  inner: TypeExpr;
}

export interface OwnType extends BaseNode {
  kind: 'OwnType';
  inner: TypeExpr;
}

export interface SharedType extends BaseNode {
  kind: 'SharedType';
  inner: TypeExpr;
}

export interface ArrayType extends BaseNode {
  kind: 'ArrayType';
  elementType: TypeExpr;
}

// ─── Statements ────────────────────────────────────────────────────

export interface Block extends BaseNode {
  kind: 'Block';
  statements: Stmt[];
}

export type Stmt =
  | LetStmt
  | ExprStmt
  | ReturnStmt
  | ReplyStmt
  | EmitStmt
  | ForStmt
  | WhileStmt
  | IfStmt
  | MatchStmt
  | AssignStmt
  | SpawnStmt
  | DeployStmt;

export interface LetStmt extends BaseNode {
  kind: 'LetStmt';
  name: string;
  mutable: boolean;
  typeAnnotation: TypeExpr | null;
  initializer: Expr;
}

export interface ExprStmt extends BaseNode {
  kind: 'ExprStmt';
  expr: Expr;
}

export interface ReturnStmt extends BaseNode {
  kind: 'ReturnStmt';
  value: Expr | null;
}

export interface ReplyStmt extends BaseNode {
  kind: 'ReplyStmt';
  value: Expr;
}

export interface EmitStmt extends BaseNode {
  kind: 'EmitStmt';
  eventName: string;
  args: Expr[];
}

export interface ForStmt extends BaseNode {
  kind: 'ForStmt';
  variable: string;
  iterable: Expr;
  body: Block;
}

export interface WhileStmt extends BaseNode {
  kind: 'WhileStmt';
  condition: Expr;
  body: Block;
}

export interface IfStmt extends BaseNode {
  kind: 'IfStmt';
  condition: Expr;
  then: Block;
  else_: Block | IfStmt | null;
}

export interface MatchStmt extends BaseNode {
  kind: 'MatchStmt';
  subject: Expr;
  arms: MatchArm[];
}

export interface MatchArm extends BaseNode {
  kind: 'MatchArm';
  pattern: Pattern;
  body: Expr | Block;
}

export type Pattern =
  | IdentPattern
  | ConstructorPattern
  | LiteralPattern
  | WildcardPattern;

export interface IdentPattern extends BaseNode {
  kind: 'IdentPattern';
  name: string;
}

export interface ConstructorPattern extends BaseNode {
  kind: 'ConstructorPattern';
  name: string;
  fields: Pattern[];
}

export interface LiteralPattern extends BaseNode {
  kind: 'LiteralPattern';
  value: string | number | boolean;
}

export interface WildcardPattern extends BaseNode {
  kind: 'WildcardPattern';
}

export interface AssignStmt extends BaseNode {
  kind: 'AssignStmt';
  target: Expr;
  operator: '=' | '+=' | '-=';
  value: Expr;
}

export interface SpawnStmt extends BaseNode {
  kind: 'SpawnStmt';
  actor: string;
  args: Expr[];
}

export interface DeployStmt extends BaseNode {
  kind: 'DeployStmt';
  contract: string;
  args: CallArg[];
}

// ─── Expressions ───────────────────────────────────────────────────

export type Expr =
  | IntLiteralExpr
  | FloatLiteralExpr
  | StringLiteralExpr
  | StringInterpolationExpr
  | BoolLiteralExpr
  | IdentExpr
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MethodCallExpr
  | FieldAccessExpr
  | IndexExpr
  | StructExpr
  | BlockExpr
  | IfExpr
  | MatchExpr
  | ParallelExpr
  | ScopeExpr
  | MacroCallExpr
  | PathExpr
  | RangeExpr
  | ArrayLiteralExpr
  | ClosureExpr;

export interface IntLiteralExpr extends BaseNode {
  kind: 'IntLiteral';
  value: string;
}

export interface FloatLiteralExpr extends BaseNode {
  kind: 'FloatLiteral';
  value: string;
}

export interface StringLiteralExpr extends BaseNode {
  kind: 'StringLiteral';
  value: string;
}

export type StringInterpolationPart =
  | { kind: 'Literal'; value: string }
  | { kind: 'Expr'; expr: Expr };

export interface StringInterpolationExpr extends BaseNode {
  kind: 'StringInterpolation';
  parts: StringInterpolationPart[];
}

export interface BoolLiteralExpr extends BaseNode {
  kind: 'BoolLiteral';
  value: boolean;
}

export interface IdentExpr extends BaseNode {
  kind: 'Ident';
  name: string;
}

export interface BinaryExpr extends BaseNode {
  kind: 'Binary';
  operator: string;
  left: Expr;
  right: Expr;
}

export interface UnaryExpr extends BaseNode {
  kind: 'Unary';
  operator: string;
  operand: Expr;
}

export interface CallExpr extends BaseNode {
  kind: 'Call';
  callee: Expr;
  args: CallArg[];
}

export interface CallArg extends BaseNode {
  kind: 'CallArg';
  name: string | null;
  value: Expr;
}

export interface MethodCallExpr extends BaseNode {
  kind: 'MethodCall';
  object: Expr;
  method: string;
  args: CallArg[];
}

export interface FieldAccessExpr extends BaseNode {
  kind: 'FieldAccess';
  object: Expr;
  field: string;
}

export interface IndexExpr extends BaseNode {
  kind: 'Index';
  object: Expr;
  index: Expr;
}

export interface StructExpr extends BaseNode {
  kind: 'Struct';
  name: string;
  fields: StructFieldExpr[];
}

export interface StructFieldExpr extends BaseNode {
  kind: 'StructField';
  name: string;
  value: Expr;
}

export interface BlockExpr extends BaseNode {
  kind: 'BlockExpr';
  block: Block;
}

export interface IfExpr extends BaseNode {
  kind: 'IfExpr';
  condition: Expr;
  then: Block;
  else_: Block | IfExpr | null;
}

export interface MatchExpr extends BaseNode {
  kind: 'MatchExpr';
  subject: Expr;
  arms: MatchArm[];
}

export interface ParallelExpr extends BaseNode {
  kind: 'Parallel';
  body: Block;
}

export interface ScopeExpr extends BaseNode {
  kind: 'Scope';
  name: string;
  initializer: Expr;
  body: Block;
}

export interface MacroCallExpr extends BaseNode {
  kind: 'MacroCall';
  name: string;
  args: Expr[];
}

export interface PathExpr extends BaseNode {
  kind: 'Path';
  segments: string[];
}

export interface RangeExpr extends BaseNode {
  kind: 'Range';
  start: Expr | null;
  end: Expr | null;
  inclusive: boolean;
}

export interface ArrayLiteralExpr extends BaseNode {
  kind: 'ArrayLiteral';
  elements: Expr[];
}

export interface ClosureExpr extends BaseNode {
  kind: 'Closure';
  params: ClosureParam[];
  returnType: TypeExpr | null;
  body: Expr | Block;
}

export interface ClosureParam extends BaseNode {
  kind: 'ClosureParam';
  name: string;
  typeAnnotation: TypeExpr | null;
}
