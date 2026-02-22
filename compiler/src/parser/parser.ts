/**
 * Parser for the C! programming language.
 *
 * Converts a token stream from the Lexer into an AST.
 * Uses recursive descent with Pratt parsing for expressions.
 */

import { Token, TokenType, Span } from '../lexer/index.js';
import type {
  Program, TopLevelItem, Annotation, FunctionDecl, TypeDecl,
  ActorDecl, ContractDecl, ServerDecl, ComponentDecl, UseDecl, ModDecl,
  Parameter, Visibility, Ownership, TypeExpr, Block, Stmt, Expr,
  FieldDecl, StateDecl, OnHandler, SuperviseDecl, InitDecl,
  MatchArm, Pattern, CallArg, TypeParam, ActorMember,
  ContractMember, ServerMember,
  LetStmt, ReturnStmt, ReplyStmt, EmitStmt, ForStmt, IfStmt,
  MatchStmt, SpawnStmt,
} from '../ast/index.js';
import { Diagnostic, createError } from '../errors/index.js';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private diagnostics: Diagnostic[] = [];
  private allowRefinement: boolean = true;

  constructor(tokens: Token[]) {
    // Filter out comments and newlines
    this.tokens = tokens.filter(
      t => t.type !== TokenType.Comment && t.type !== TokenType.Newline,
    );
  }

  parse(): { program: Program; diagnostics: Diagnostic[] } {
    const items: TopLevelItem[] = [];
    const start = this.current().span;

    while (!this.isAtEnd()) {
      try {
        const item = this.parseTopLevelItem();
        if (item) items.push(item);
      } catch (e) {
        // Recover: skip to next likely top-level token
        this.synchronize();
      }
    }

    const program: Program = {
      kind: 'Program',
      items,
      span: this.spanFrom(start),
    };

    return { program, diagnostics: this.diagnostics };
  }

  getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  // ─── Top-Level ─────────────────────────────────────────────────

  private parseTopLevelItem(): TopLevelItem | null {
    const annotations = this.parseAnnotations();
    const visibility = this.parseVisibility();

    const token = this.current();
    switch (token.type) {
      case TokenType.Fn:
      case TokenType.Pure:
      case TokenType.Async:
        return this.parseFunctionDecl(annotations, visibility);
      case TokenType.Type:
        return this.parseTypeDecl(annotations, visibility);
      case TokenType.Actor:
        return this.parseActorDecl(annotations, visibility);
      case TokenType.Contract:
        return this.parseContractDecl(annotations, visibility);
      case TokenType.Server:
        return this.parseServerDecl(annotations, visibility);
      case TokenType.Component:
        return this.parseComponentDecl(annotations, visibility);
      case TokenType.Use:
        return this.parseUseDecl();
      case TokenType.Mod:
        return this.parseModDecl();
      case TokenType.State:
        return this.parseStateDecl();
      case TokenType.EOF:
        return null;
      default:
        this.error(`Unexpected token '${token.value}' at top level`);
        this.advance();
        return null;
    }
  }

  // ─── Annotations ───────────────────────────────────────────────

  private parseAnnotations(): Annotation[] {
    const annotations: Annotation[] = [];
    while (this.check(TokenType.Annotation)) {
      const token = this.advance();
      const raw = token.value;
      // Parse #[name(args)] or #[name]
      const inner = raw.slice(2, -1); // strip #[ and ]
      const parenIdx = inner.indexOf('(');
      let name: string;
      let args: string;
      if (parenIdx === -1) {
        name = inner.trim();
        args = '';
      } else {
        name = inner.slice(0, parenIdx).trim();
        args = inner.slice(parenIdx + 1, -1).trim(); // strip parens
      }
      annotations.push({
        kind: 'Annotation',
        name,
        args,
        raw,
        span: token.span,
      });
    }
    return annotations;
  }

  // ─── Visibility ────────────────────────────────────────────────

  private parseVisibility(): Visibility {
    if (this.check(TokenType.Pub)) {
      this.advance();
      // Check for pub(pkg)
      if (this.check(TokenType.LeftParen)) {
        this.advance();
        if (this.checkIdent('pkg')) {
          this.advance();
          this.expect(TokenType.RightParen, "Expected ')' after 'pkg'");
          return 'package';
        }
        this.expect(TokenType.RightParen, "Expected ')' after visibility modifier");
        return 'public';
      }
      return 'public';
    }
    return 'private';
  }

  // ─── Function Declaration ──────────────────────────────────────

  private parseFunctionDecl(annotations: Annotation[], visibility: Visibility): FunctionDecl {
    const start = this.current().span;
    let isPure = false;
    let isAsync = false;

    if (this.check(TokenType.Pure)) {
      isPure = true;
      this.advance();
    }
    if (this.check(TokenType.Async)) {
      isAsync = true;
      this.advance();
    }

    this.expect(TokenType.Fn, "Expected 'fn'");
    const name = this.expectIdent("Expected function name");
    this.expect(TokenType.LeftParen, "Expected '(' after function name");
    const params = this.parseParams();
    this.expect(TokenType.RightParen, "Expected ')'");

    let returnType: TypeExpr | null = null;
    if (this.check(TokenType.Arrow)) {
      this.advance();
      // Disable refinement parsing for return types to avoid
      // ambiguity with the function body block: fn f() -> Type { body }
      this.allowRefinement = false;
      returnType = this.parseTypeExpr();
      this.allowRefinement = true;
    }

    let effects: string[] = [];
    if (this.check(TokenType.With)) {
      this.advance();
      effects = this.parseEffectList();
    }

    const body = this.parseBlock();

    return {
      kind: 'FunctionDecl',
      name,
      annotations,
      visibility,
      isPure,
      isAsync,
      params,
      returnType,
      effects,
      body,
      span: this.spanFrom(start),
    };
  }

  private parseParams(): Parameter[] {
    const params: Parameter[] = [];
    if (this.check(TokenType.RightParen)) return params;

    params.push(this.parseParam());
    while (this.check(TokenType.Comma)) {
      this.advance();
      if (this.check(TokenType.RightParen)) break;
      params.push(this.parseParam());
    }
    return params;
  }

  private parseParam(): Parameter {
    const start = this.current().span;
    const name = this.expectIdent("Expected parameter name");
    this.expect(TokenType.Colon, "Expected ':' after parameter name");

    // Ownership modifiers appear before the type: `x: own Token`, `x: &mut T`
    const ownership = this.parseOwnership();
    const typeAnnotation = this.parseTypeExpr();

    return {
      kind: 'Parameter',
      name,
      ownership,
      typeAnnotation,
      span: this.spanFrom(start),
    };
  }

  private parseOwnership(): Ownership {
    if (this.check(TokenType.Own)) {
      this.advance();
      return 'own';
    }
    if (this.check(TokenType.Shared)) {
      this.advance();
      return 'shared';
    }
    if (this.check(TokenType.Ampersand)) {
      this.advance();
      if (this.check(TokenType.Mut)) {
        this.advance();
        return 'borrowed_mut';
      }
      return 'borrowed';
    }
    return 'owned';
  }

  private parseEffectList(): string[] {
    const effects: string[] = [];
    effects.push(this.expectIdentOrType("Expected effect name"));
    while (this.check(TokenType.Comma)) {
      this.advance();
      effects.push(this.expectIdentOrType("Expected effect name"));
    }
    return effects;
  }

  // ─── Type Declaration ──────────────────────────────────────────

  private parseTypeDecl(annotations: Annotation[], visibility: Visibility): TypeDecl {
    const start = this.current().span;
    this.expect(TokenType.Type, "Expected 'type'");
    const name = this.expectIdentOrType("Expected type name");

    const typeParams = this.parseTypeParams();

    // type Name = ... (alias or enum)
    // type Name { ... } (struct)
    if (this.check(TokenType.Assign)) {
      this.advance();
      const type = this.parseTypeExpr();
      return {
        kind: 'TypeDecl',
        name,
        annotations,
        visibility,
        typeParams,
        body: { kind: 'Alias', type },
        span: this.spanFrom(start),
      };
    }

    if (this.check(TokenType.LeftBrace)) {
      this.advance();
      const fields: FieldDecl[] = [];
      while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
        fields.push(this.parseFieldDecl());
        // optional comma or newline separator
        this.match(TokenType.Comma);
      }
      this.expect(TokenType.RightBrace, "Expected '}'");
      return {
        kind: 'TypeDecl',
        name,
        annotations,
        visibility,
        typeParams,
        body: { kind: 'Struct', fields },
        span: this.spanFrom(start),
      };
    }

    // Bare union: type Foo = A | B | C
    this.error("Expected '=', or '{' after type name");
    return {
      kind: 'TypeDecl',
      name,
      annotations,
      visibility,
      typeParams,
      body: { kind: 'Alias', type: { kind: 'NamedType', name: 'Unknown', path: [], span: this.current().span } },
      span: this.spanFrom(start),
    };
  }

  private parseTypeParams(): TypeParam[] {
    if (!this.check(TokenType.Lt)) return [];
    this.advance();
    const params: TypeParam[] = [];
    params.push(this.parseTypeParam());
    while (this.check(TokenType.Comma)) {
      this.advance();
      params.push(this.parseTypeParam());
    }
    this.expect(TokenType.Gt, "Expected '>'");
    return params;
  }

  private parseTypeParam(): TypeParam {
    const start = this.current().span;
    const name = this.expectIdentOrType("Expected type parameter name");
    return { kind: 'TypeParam', name, span: this.spanFrom(start) };
  }

  private parseFieldDecl(): FieldDecl {
    const start = this.current().span;
    const name = this.expectIdent("Expected field name");
    this.expect(TokenType.Colon, "Expected ':'");
    const typeAnnotation = this.parseTypeExpr();

    let defaultValue: Expr | null = null;
    if (this.check(TokenType.Assign)) {
      this.advance();
      defaultValue = this.parseExpr();
    }

    return {
      kind: 'FieldDecl',
      name,
      typeAnnotation,
      defaultValue,
      span: this.spanFrom(start),
    };
  }

  // ─── Actor Declaration ─────────────────────────────────────────

  private parseActorDecl(annotations: Annotation[], visibility: Visibility): ActorDecl {
    const start = this.current().span;
    this.expect(TokenType.Actor, "Expected 'actor'");
    const name = this.expectIdentOrType("Expected actor name");
    this.expect(TokenType.LeftBrace, "Expected '{'");

    const members: ActorMember[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const member = this.parseActorMember();
      if (member) members.push(member);
    }

    this.expect(TokenType.RightBrace, "Expected '}'");

    return {
      kind: 'ActorDecl',
      name,
      annotations,
      visibility,
      members,
      span: this.spanFrom(start),
    };
  }

  private parseActorMember(): ActorMember | null {
    const annotations = this.parseAnnotations();
    const visibility = this.parseVisibility();

    if (this.check(TokenType.State)) {
      return this.parseStateDecl();
    }
    if (this.check(TokenType.On)) {
      return this.parseOnHandler();
    }
    if (this.check(TokenType.Fn) || this.check(TokenType.Pure) || this.check(TokenType.Async)) {
      return this.parseFunctionDecl(annotations, visibility);
    }
    if (this.check(TokenType.Supervise)) {
      return this.parseSuperviseDecl();
    }
    if (this.check(TokenType.Init)) {
      return this.parseInitDecl();
    }

    this.error(`Unexpected token '${this.current().value}' in actor body`);
    this.advance();
    return null;
  }

  private parseStateDecl(): StateDecl {
    const start = this.current().span;
    this.expect(TokenType.State, "Expected 'state'");
    const name = this.expectIdent("Expected state variable name");
    this.expect(TokenType.Colon, "Expected ':'");
    const typeAnnotation = this.parseTypeExpr();

    let initializer: Expr | null = null;
    if (this.check(TokenType.Assign)) {
      this.advance();
      initializer = this.parseExpr();
    }

    return {
      kind: 'StateDecl',
      name,
      typeAnnotation,
      initializer,
      span: this.spanFrom(start),
    };
  }

  private parseOnHandler(): OnHandler {
    const start = this.current().span;
    this.expect(TokenType.On, "Expected 'on'");
    const messageName = this.expectIdentOrType("Expected message name");

    this.expect(TokenType.LeftParen, "Expected '('");
    const params = this.parseParams();
    this.expect(TokenType.RightParen, "Expected ')'");

    let returnType: TypeExpr | null = null;
    if (this.check(TokenType.Arrow)) {
      this.advance();
      this.allowRefinement = false;
      returnType = this.parseTypeExpr();
      this.allowRefinement = true;
    }

    const body = this.parseBlock();

    return {
      kind: 'OnHandler',
      messageName,
      params,
      returnType,
      body,
      span: this.spanFrom(start),
    };
  }

  private parseSuperviseDecl(): SuperviseDecl {
    const start = this.current().span;
    this.expect(TokenType.Supervise, "Expected 'supervise'");
    const childName = this.expectIdentOrType("Expected supervised actor name");

    this.expect(TokenType.LeftBrace, "Expected '{'");
    const options: SuperviseDecl['options'] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const optStart = this.current().span;
      const key = this.expectIdent("Expected option name");
      this.expect(TokenType.Colon, "Expected ':'");
      const value = this.parseExpr();
      options.push({
        kind: 'SuperviseOption',
        key,
        value,
        span: this.spanFrom(optStart),
      });
      this.match(TokenType.Comma);
    }
    this.expect(TokenType.RightBrace, "Expected '}'");

    return {
      kind: 'SuperviseDecl',
      childName,
      options,
      span: this.spanFrom(start),
    };
  }

  private parseInitDecl(): InitDecl {
    const start = this.current().span;
    this.expect(TokenType.Init, "Expected 'init'");
    this.expect(TokenType.LeftParen, "Expected '('");
    const params = this.parseParams();
    this.expect(TokenType.RightParen, "Expected ')'");
    const body = this.parseBlock();

    return {
      kind: 'InitDecl',
      params,
      body,
      span: this.spanFrom(start),
    };
  }

  // ─── Contract Declaration ──────────────────────────────────────

  private parseContractDecl(annotations: Annotation[], visibility: Visibility): ContractDecl {
    const start = this.current().span;
    this.expect(TokenType.Contract, "Expected 'contract'");
    const name = this.expectIdentOrType("Expected contract name");

    const interfaces: string[] = [];
    if (this.check(TokenType.Colon)) {
      this.advance();
      interfaces.push(this.expectIdentOrType("Expected interface name"));
      while (this.check(TokenType.Comma)) {
        this.advance();
        interfaces.push(this.expectIdentOrType("Expected interface name"));
      }
    }

    this.expect(TokenType.LeftBrace, "Expected '{'");

    const members: ContractMember[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const member = this.parseContractMember();
      if (member) members.push(member);
    }

    this.expect(TokenType.RightBrace, "Expected '}'");

    return {
      kind: 'ContractDecl',
      name,
      annotations,
      visibility,
      interfaces,
      members,
      span: this.spanFrom(start),
    };
  }

  private parseContractMember(): ContractMember | null {
    const annotations = this.parseAnnotations();
    const visibility = this.parseVisibility();

    if (this.check(TokenType.State)) {
      return this.parseStateDecl();
    }
    if (this.check(TokenType.Fn) || this.check(TokenType.Pure) || this.check(TokenType.Async)) {
      return this.parseFunctionDecl(annotations, visibility);
    }
    if (this.check(TokenType.Init)) {
      return this.parseInitDecl();
    }

    this.error(`Unexpected token '${this.current().value}' in contract body`);
    this.advance();
    return null;
  }

  // ─── Server Declaration ────────────────────────────────────────

  private parseServerDecl(annotations: Annotation[], visibility: Visibility): ServerDecl {
    const start = this.current().span;
    this.expect(TokenType.Server, "Expected 'server'");
    const name = this.expectIdentOrType("Expected server name");
    this.expect(TokenType.LeftBrace, "Expected '{'");

    const members: ServerMember[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const member = this.parseServerMember();
      if (member) members.push(member);
    }

    this.expect(TokenType.RightBrace, "Expected '}'");

    return {
      kind: 'ServerDecl',
      name,
      annotations,
      visibility,
      members,
      span: this.spanFrom(start),
    };
  }

  private parseServerMember(): ServerMember | null {
    const annotations = this.parseAnnotations();
    const visibility = this.parseVisibility();

    if (this.check(TokenType.Fn) || this.check(TokenType.Pure) || this.check(TokenType.Async)) {
      return this.parseFunctionDecl(annotations, visibility);
    }
    if (this.check(TokenType.State)) {
      return this.parseStateDecl();
    }

    // Field assignment: bind: "0.0.0.0:8080"
    if (this.check(TokenType.Identifier)) {
      const start = this.current().span;
      const name = this.advance().value;
      if (this.check(TokenType.Colon)) {
        this.advance();
        const value = this.parseExpr();
        return {
          kind: 'FieldAssignment',
          name,
          value,
          span: this.spanFrom(start),
        };
      }
    }

    this.error(`Unexpected token '${this.current().value}' in server body`);
    this.advance();
    return null;
  }

  // ─── Component Declaration ─────────────────────────────────────

  private parseComponentDecl(annotations: Annotation[], visibility: Visibility): ComponentDecl {
    const start = this.current().span;
    this.expect(TokenType.Component, "Expected 'component'");
    const name = this.expectIdentOrType("Expected component name");

    this.expect(TokenType.LeftParen, "Expected '('");
    const params = this.parseParams();
    this.expect(TokenType.RightParen, "Expected ')'");

    const body = this.parseBlock();

    return {
      kind: 'ComponentDecl',
      name,
      annotations,
      visibility,
      params,
      body,
      span: this.spanFrom(start),
    };
  }

  // ─── Use Declaration ───────────────────────────────────────────

  private parseUseDecl(): UseDecl {
    const start = this.current().span;
    this.expect(TokenType.Use, "Expected 'use'");

    const path: string[] = [];
    path.push(this.expectPathSegment("Expected module path"));

    while (this.check(TokenType.ColonColon)) {
      this.advance();

      // use foo::*
      if (this.check(TokenType.Star)) {
        this.advance();
        this.match(TokenType.Semicolon);
        return {
          kind: 'UseDecl',
          path,
          items: [{ kind: 'Wildcard' }],
          isWildcard: true,
          span: this.spanFrom(start),
        };
      }

      // use foo::{A, B, C}
      if (this.check(TokenType.LeftBrace)) {
        this.advance();
        const items: UseDecl['items'] = [];
        while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
          const itemName = this.expectPathSegment("Expected import name");
          let alias: string | null = null;
          if (this.checkIdent('as')) {
            this.advance();
            alias = this.expectPathSegment("Expected alias name");
          }
          items.push({ kind: 'Named', name: itemName, alias });
          if (!this.match(TokenType.Comma)) break;
        }
        this.expect(TokenType.RightBrace, "Expected '}'");
        this.match(TokenType.Semicolon);
        return {
          kind: 'UseDecl',
          path,
          items,
          isWildcard: false,
          span: this.spanFrom(start),
        };
      }

      path.push(this.expectPathSegment("Expected module path segment"));
    }

    // use foo::bar::Baz (single import)
    this.match(TokenType.Semicolon);
    const lastName = path[path.length - 1]!;
    const modulePath = path.slice(0, -1);
    return {
      kind: 'UseDecl',
      path: modulePath,
      items: [{ kind: 'Named', name: lastName, alias: null }],
      isWildcard: false,
      span: this.spanFrom(start),
    };
  }

  // ─── Mod Declaration ───────────────────────────────────────────

  private parseModDecl(): ModDecl {
    const start = this.current().span;
    this.expect(TokenType.Mod, "Expected 'mod'");
    const name = this.expectIdent("Expected module name");

    if (this.check(TokenType.LeftBrace)) {
      this.advance();
      const body: TopLevelItem[] = [];
      while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
        const item = this.parseTopLevelItem();
        if (item) body.push(item);
      }
      this.expect(TokenType.RightBrace, "Expected '}'");
      return { kind: 'ModDecl', name, body, span: this.spanFrom(start) };
    }

    this.match(TokenType.Semicolon);
    return { kind: 'ModDecl', name, body: null, span: this.spanFrom(start) };
  }

  // ─── Type Expressions ──────────────────────────────────────────

  parseTypeExpr(): TypeExpr {
    let left = this.parsePrimaryType();

    // Union type: A | B | C
    if (this.check(TokenType.Pipe)) {
      const types: TypeExpr[] = [left];
      while (this.check(TokenType.Pipe)) {
        this.advance();
        types.push(this.parsePrimaryType());
      }
      return {
        kind: 'UnionType',
        types,
        span: this.spanFrom(left.span),
      };
    }

    return left;
  }

  private parsePrimaryType(): TypeExpr {
    const start = this.current().span;

    // &T or &mut T
    if (this.check(TokenType.Ampersand)) {
      this.advance();
      const mutable = this.check(TokenType.Mut);
      if (mutable) this.advance();
      const inner = this.parsePrimaryType();
      return { kind: 'ReferenceType', mutable, inner, span: this.spanFrom(start) };
    }

    // own T
    if (this.check(TokenType.Own)) {
      this.advance();
      const inner = this.parsePrimaryType();
      return { kind: 'OwnType', inner, span: this.spanFrom(start) };
    }

    // shared T
    if (this.check(TokenType.Shared)) {
      this.advance();
      const inner = this.parsePrimaryType();
      return { kind: 'SharedType', inner, span: this.spanFrom(start) };
    }

    // Named or generic type
    if (this.check(TokenType.TypeIdentifier) || this.check(TokenType.Identifier)) {
      const name = this.advance().value;

      // Check for generic: Name<T, U>
      if (this.check(TokenType.Lt)) {
        this.advance();
        const typeArgs: TypeExpr[] = [];
        typeArgs.push(this.parseTypeExpr());
        while (this.check(TokenType.Comma)) {
          this.advance();
          typeArgs.push(this.parseTypeExpr());
        }
        this.expect(TokenType.Gt, "Expected '>'");

        const result: TypeExpr = {
          kind: 'GenericType',
          name,
          path: [],
          typeArgs,
          span: this.spanFrom(start),
        };

        // Check for refinement: Type{...}
        if (this.allowRefinement && this.check(TokenType.LeftBrace)) {
          return this.parseRefinement(result);
        }

        return result;
      }

      const result: TypeExpr = {
        kind: 'NamedType',
        name,
        path: [],
        span: this.spanFrom(start),
      };

      // Check for refinement: Type{...}
      if (this.allowRefinement && this.check(TokenType.LeftBrace)) {
        return this.parseRefinement(result);
      }

      return result;
    }

    // Parenthesized type
    if (this.check(TokenType.LeftParen)) {
      this.advance();
      if (this.check(TokenType.RightParen)) {
        this.advance();
        return { kind: 'NamedType', name: '()', path: [], span: this.spanFrom(start) };
      }
      const inner = this.parseTypeExpr();
      this.expect(TokenType.RightParen, "Expected ')'");
      return inner;
    }

    this.error(`Expected type expression, got '${this.current().value}'`);
    this.advance();
    return { kind: 'NamedType', name: 'Error', path: [], span: this.spanFrom(start) };
  }

  private parseRefinement(baseType: TypeExpr): TypeExpr {
    const start = baseType.span;
    this.expect(TokenType.LeftBrace, "Expected '{'");

    const constraints: { kind: 'RefinementConstraint'; name: string | null; value: Expr; span: Span }[] = [];

    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const cStart = this.current().span;

      // Check for named constraint: name: value
      // or plain range expression: 1..100
      if (this.check(TokenType.Identifier) && this.peekType(1) === TokenType.Colon) {
        const name = this.advance().value;
        this.advance(); // colon
        const value = this.parseExpr();
        constraints.push({
          kind: 'RefinementConstraint',
          name,
          value,
          span: this.spanFrom(cStart),
        });
      } else {
        const value = this.parseExpr();
        constraints.push({
          kind: 'RefinementConstraint',
          name: null,
          value,
          span: this.spanFrom(cStart),
        });
      }

      if (!this.match(TokenType.Comma)) break;
    }

    this.expect(TokenType.RightBrace, "Expected '}'");

    return {
      kind: 'RefinedType',
      baseType,
      constraints,
      span: this.spanFrom(start),
    };
  }

  // ─── Blocks & Statements ───────────────────────────────────────

  parseBlock(): Block {
    const start = this.current().span;
    this.expect(TokenType.LeftBrace, "Expected '{'");

    const statements: Stmt[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    this.expect(TokenType.RightBrace, "Expected '}'");

    return { kind: 'Block', statements, span: this.spanFrom(start) };
  }

  private parseStatement(): Stmt | null {
    const token = this.current();

    switch (token.type) {
      case TokenType.Let:
        return this.parseLetStmt();
      case TokenType.Return:
        return this.parseReturnStmt();
      case TokenType.Reply:
        return this.parseReplyStmt();
      case TokenType.Emit:
        return this.parseEmitStmt();
      case TokenType.For:
        return this.parseForStmt();
      case TokenType.If:
        return this.parseIfStmt();
      case TokenType.Match:
        return this.parseMatchStmt();
      case TokenType.Spawn:
        return this.parseSpawnStmt();
      default: {
        // Expression statement (may become an assignment)
        const start = this.current().span;
        const expr = this.parseExpr();

        // Check for assignment
        if (this.check(TokenType.Assign) || this.check(TokenType.PlusAssign) || this.check(TokenType.MinusAssign)) {
          const op = this.advance().value as '=' | '+=' | '-=';
          const value = this.parseExpr();
          this.match(TokenType.Semicolon);
          return {
            kind: 'AssignStmt',
            target: expr,
            operator: op,
            value,
            span: this.spanFrom(start),
          };
        }

        this.match(TokenType.Semicolon);
        return {
          kind: 'ExprStmt',
          expr,
          span: this.spanFrom(start),
        };
      }
    }
  }

  private parseLetStmt(): LetStmt {
    const start = this.current().span;
    this.expect(TokenType.Let, "Expected 'let'");

    let mutable = false;
    if (this.check(TokenType.Mut)) {
      mutable = true;
      this.advance();
    }

    const name = this.expectIdent("Expected variable name");

    let typeAnnotation: TypeExpr | null = null;
    if (this.check(TokenType.Colon)) {
      this.advance();
      typeAnnotation = this.parseTypeExpr();
    }

    this.expect(TokenType.Assign, "Expected '=' in let binding");
    const initializer = this.parseExpr();
    this.match(TokenType.Semicolon);

    return {
      kind: 'LetStmt',
      name,
      mutable,
      typeAnnotation,
      initializer,
      span: this.spanFrom(start),
    };
  }

  private parseReturnStmt(): ReturnStmt {
    const start = this.current().span;
    this.expect(TokenType.Return, "Expected 'return'");

    let value: Expr | null = null;
    if (!this.check(TokenType.Semicolon) && !this.check(TokenType.RightBrace)) {
      value = this.parseExpr();
    }
    this.match(TokenType.Semicolon);

    return { kind: 'ReturnStmt', value, span: this.spanFrom(start) };
  }

  private parseReplyStmt(): ReplyStmt {
    const start = this.current().span;
    this.expect(TokenType.Reply, "Expected 'reply'");
    const value = this.parseExpr();
    this.match(TokenType.Semicolon);
    return { kind: 'ReplyStmt', value, span: this.spanFrom(start) };
  }

  private parseEmitStmt(): EmitStmt {
    const start = this.current().span;
    this.expect(TokenType.Emit, "Expected 'emit'");
    const eventName = this.expectIdentOrType("Expected event name");
    this.expect(TokenType.LeftParen, "Expected '('");
    const args: Expr[] = [];
    if (!this.check(TokenType.RightParen)) {
      args.push(this.parseExpr());
      while (this.check(TokenType.Comma)) {
        this.advance();
        args.push(this.parseExpr());
      }
    }
    this.expect(TokenType.RightParen, "Expected ')'");
    this.match(TokenType.Semicolon);
    return { kind: 'EmitStmt', eventName, args, span: this.spanFrom(start) };
  }

  private parseForStmt(): ForStmt {
    const start = this.current().span;
    this.expect(TokenType.For, "Expected 'for'");
    const variable = this.expectIdent("Expected variable name");
    this.expect(TokenType.In, "Expected 'in'");
    const iterable = this.parseExpr();
    const body = this.parseBlock();
    return { kind: 'ForStmt', variable, iterable, body, span: this.spanFrom(start) };
  }

  private parseIfStmt(): IfStmt {
    const start = this.current().span;
    this.expect(TokenType.If, "Expected 'if'");
    const condition = this.parseExpr();
    const then = this.parseBlock();

    let else_: Block | IfStmt | null = null;
    if (this.check(TokenType.Else)) {
      this.advance();
      if (this.check(TokenType.If)) {
        else_ = this.parseIfStmt();
      } else {
        else_ = this.parseBlock();
      }
    }

    return { kind: 'IfStmt', condition, then, else_, span: this.spanFrom(start) };
  }

  private parseMatchStmt(): MatchStmt {
    const start = this.current().span;
    this.expect(TokenType.Match, "Expected 'match'");
    const subject = this.parseExpr();
    this.expect(TokenType.LeftBrace, "Expected '{'");

    const arms: MatchArm[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      arms.push(this.parseMatchArm());
      this.match(TokenType.Comma);
    }
    this.expect(TokenType.RightBrace, "Expected '}'");

    return { kind: 'MatchStmt', subject, arms, span: this.spanFrom(start) };
  }

  private parseMatchArm(): MatchArm {
    const start = this.current().span;
    const pattern = this.parsePattern();
    this.expect(TokenType.FatArrow, "Expected '=>'");

    let body: Expr | Block;
    if (this.check(TokenType.LeftBrace)) {
      body = this.parseBlock();
    } else {
      body = this.parseExpr();
    }

    return { kind: 'MatchArm', pattern, body, span: this.spanFrom(start) };
  }

  private parsePattern(): Pattern {
    const start = this.current().span;

    // Wildcard: _
    if (this.check(TokenType.Identifier) && this.current().value === '_') {
      this.advance();
      return { kind: 'WildcardPattern', span: this.spanFrom(start) };
    }

    // Literal patterns
    if (this.check(TokenType.IntLiteral)) {
      const value = this.advance().value;
      return { kind: 'LiteralPattern', value: Number(value), span: this.spanFrom(start) };
    }
    if (this.check(TokenType.StringLiteral)) {
      const value = this.advance().value;
      return { kind: 'LiteralPattern', value, span: this.spanFrom(start) };
    }
    if (this.check(TokenType.BoolLiteral)) {
      const value = this.advance().value === 'true';
      return { kind: 'LiteralPattern', value, span: this.spanFrom(start) };
    }

    // Constructor or ident pattern
    if (this.check(TokenType.TypeIdentifier) || this.check(TokenType.Identifier)) {
      const name = this.advance().value;
      if (this.check(TokenType.LeftParen)) {
        this.advance();
        const fields: Pattern[] = [];
        if (!this.check(TokenType.RightParen)) {
          fields.push(this.parsePattern());
          while (this.check(TokenType.Comma)) {
            this.advance();
            fields.push(this.parsePattern());
          }
        }
        this.expect(TokenType.RightParen, "Expected ')'");
        return { kind: 'ConstructorPattern', name, fields, span: this.spanFrom(start) };
      }
      // Capitalized name without parens = constructor with no args (like None)
      if (name[0]! >= 'A' && name[0]! <= 'Z') {
        return { kind: 'ConstructorPattern', name, fields: [], span: this.spanFrom(start) };
      }
      return { kind: 'IdentPattern', name, span: this.spanFrom(start) };
    }

    this.error(`Expected pattern, got '${this.current().value}'`);
    this.advance();
    return { kind: 'WildcardPattern', span: this.spanFrom(start) };
  }

  private parseSpawnStmt(): SpawnStmt {
    const start = this.current().span;
    this.expect(TokenType.Spawn, "Expected 'spawn'");
    const actor = this.expectIdentOrType("Expected actor name");
    const args: Expr[] = [];
    if (this.check(TokenType.LeftParen)) {
      this.advance();
      if (!this.check(TokenType.RightParen)) {
        args.push(this.parseExpr());
        while (this.check(TokenType.Comma)) {
          this.advance();
          args.push(this.parseExpr());
        }
      }
      this.expect(TokenType.RightParen, "Expected ')'");
    }
    this.match(TokenType.Semicolon);
    return { kind: 'SpawnStmt', actor, args, span: this.spanFrom(start) };
  }

  // ─── Expressions (Pratt Parsing) ──────────────────────────────

  parseExpr(): Expr {
    return this.parseBinaryExpr(0);
  }

  private parseBinaryExpr(minPrec: number): Expr {
    let left = this.parseUnaryExpr();

    while (true) {
      const prec = this.getInfixPrecedence();
      if (prec < minPrec) break;

      // Range operators
      if (this.check(TokenType.DotDot) || this.check(TokenType.DotDotEq)) {
        const inclusive = this.current().type === TokenType.DotDotEq;
        this.advance();
        let end: Expr | null = null;
        if (!this.check(TokenType.RightBrace) && !this.check(TokenType.RightParen) &&
            !this.check(TokenType.Comma) && !this.check(TokenType.Semicolon)) {
          end = this.parseBinaryExpr(prec + 1);
        }
        left = {
          kind: 'Range',
          start: left,
          end,
          inclusive,
          span: this.spanFrom(left.span),
        };
        continue;
      }

      const op = this.advance().value;
      const right = this.parseBinaryExpr(prec + 1);
      left = {
        kind: 'Binary',
        operator: op,
        left,
        right,
        span: this.spanFrom(left.span),
      };
    }

    return left;
  }

  private parseUnaryExpr(): Expr {
    if (this.check(TokenType.Not) || this.check(TokenType.Minus)) {
      const start = this.current().span;
      const op = this.advance().value;
      const operand = this.parseUnaryExpr();
      return { kind: 'Unary', operator: op, operand, span: this.spanFrom(start) };
    }
    return this.parsePostfixExpr();
  }

  private parsePostfixExpr(): Expr {
    let expr = this.parsePrimaryExpr();

    while (true) {
      if (this.check(TokenType.Dot)) {
        this.advance();
        const field = this.expectIdentOrType("Expected field name");

        // Method call: expr.method(args)
        if (this.check(TokenType.LeftParen)) {
          this.advance();
          const args = this.parseCallArgs();
          this.expect(TokenType.RightParen, "Expected ')'");
          expr = {
            kind: 'MethodCall',
            object: expr,
            method: field,
            args,
            span: this.spanFrom(expr.span),
          };
        } else {
          expr = {
            kind: 'FieldAccess',
            object: expr,
            field,
            span: this.spanFrom(expr.span),
          };
        }
      } else if (this.check(TokenType.LeftBracket)) {
        this.advance();
        const index = this.parseExpr();
        this.expect(TokenType.RightBracket, "Expected ']'");
        expr = {
          kind: 'Index',
          object: expr,
          index,
          span: this.spanFrom(expr.span),
        };
      } else if (this.check(TokenType.LeftParen) && expr.kind === 'Ident') {
        // Function call
        this.advance();
        const args = this.parseCallArgs();
        this.expect(TokenType.RightParen, "Expected ')'");
        expr = {
          kind: 'Call',
          callee: expr,
          args,
          span: this.spanFrom(expr.span),
        };
      } else if (this.check(TokenType.LeftParen) && expr.kind === 'Path') {
        this.advance();
        const args = this.parseCallArgs();
        this.expect(TokenType.RightParen, "Expected ')'");
        expr = {
          kind: 'Call',
          callee: expr,
          args,
          span: this.spanFrom(expr.span),
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimaryExpr(): Expr {
    const start = this.current().span;

    // Integer literal
    if (this.check(TokenType.IntLiteral)) {
      return { kind: 'IntLiteral', value: this.advance().value, span: this.spanFrom(start) };
    }

    // Float literal
    if (this.check(TokenType.FloatLiteral)) {
      return { kind: 'FloatLiteral', value: this.advance().value, span: this.spanFrom(start) };
    }

    // String literal
    if (this.check(TokenType.StringLiteral)) {
      return { kind: 'StringLiteral', value: this.advance().value, span: this.spanFrom(start) };
    }

    // Bool literal
    if (this.check(TokenType.BoolLiteral)) {
      return { kind: 'BoolLiteral', value: this.advance().value === 'true', span: this.spanFrom(start) };
    }

    // Deploy expression
    if (this.check(TokenType.Deploy)) {
      this.advance();
      const contract = this.expectIdentOrType("Expected contract name");
      this.expect(TokenType.LeftParen, "Expected '('");
      const args = this.parseCallArgs();
      this.expect(TokenType.RightParen, "Expected ')'");
      return {
        kind: 'Call',
        callee: { kind: 'Ident', name: `deploy ${contract}`, span: this.spanFrom(start) },
        args,
        span: this.spanFrom(start),
      };
    }

    // Macro call: name!(...) (e.g., verify!, format!)
    if (this.check(TokenType.Identifier) && this.peekType(1) === TokenType.Not) {
      const name = this.advance().value;
      this.advance(); // !
      this.expect(TokenType.LeftParen, "Expected '(' after macro name");
      const args: Expr[] = [];
      if (!this.check(TokenType.RightParen)) {
        args.push(this.parseExpr());
        while (this.check(TokenType.Comma)) {
          this.advance();
          args.push(this.parseExpr());
        }
      }
      this.expect(TokenType.RightParen, "Expected ')'");
      return { kind: 'MacroCall', name, args, span: this.spanFrom(start) };
    }

    // TypeIdentifier — could be constructor: Ok(42) or struct: Receipt { ... }
    if (this.check(TokenType.TypeIdentifier)) {
      const name = this.advance().value;

      // Path: Foo::bar
      if (this.check(TokenType.ColonColon)) {
        const segments = [name];
        while (this.check(TokenType.ColonColon)) {
          this.advance();
          segments.push(this.expectIdentOrType("Expected path segment"));
        }

        // Path call: Foo::bar()
        if (this.check(TokenType.LeftParen)) {
          this.advance();
          const args = this.parseCallArgs();
          this.expect(TokenType.RightParen, "Expected ')'");
          return {
            kind: 'Call',
            callee: { kind: 'Path', segments, span: this.spanFrom(start) },
            args,
            span: this.spanFrom(start),
          };
        }

        return { kind: 'Path', segments, span: this.spanFrom(start) };
      }

      // Constructor call: Ok(value) or Some(x)
      if (this.check(TokenType.LeftParen)) {
        this.advance();
        const args = this.parseCallArgs();
        this.expect(TokenType.RightParen, "Expected ')'");
        return {
          kind: 'Call',
          callee: { kind: 'Ident', name, span: this.spanFrom(start) },
          args,
          span: this.spanFrom(start),
        };
      }

      // Struct literal: Name { field: value }
      if (this.check(TokenType.LeftBrace)) {
        this.advance();
        const fields: { kind: 'StructField'; name: string; value: Expr; span: Span }[] = [];
        while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
          const fStart = this.current().span;
          const fieldName = this.expectIdent("Expected field name");
          this.expect(TokenType.Colon, "Expected ':'");
          const value = this.parseExpr();
          fields.push({ kind: 'StructField', name: fieldName, value, span: this.spanFrom(fStart) });
          if (!this.match(TokenType.Comma)) break;
        }
        this.expect(TokenType.RightBrace, "Expected '}'");
        return { kind: 'Struct', name, fields, span: this.spanFrom(start) };
      }

      return { kind: 'Ident', name, span: this.spanFrom(start) };
    }

    // Identifier
    if (this.check(TokenType.Identifier)) {
      const name = this.advance().value;

      // Path: foo::bar
      if (this.check(TokenType.ColonColon)) {
        const segments = [name];
        while (this.check(TokenType.ColonColon)) {
          this.advance();
          segments.push(this.expectIdentOrType("Expected path segment"));
        }
        if (this.check(TokenType.LeftParen)) {
          this.advance();
          const args = this.parseCallArgs();
          this.expect(TokenType.RightParen, "Expected ')'");
          return {
            kind: 'Call',
            callee: { kind: 'Path', segments, span: this.spanFrom(start) },
            args,
            span: this.spanFrom(start),
          };
        }
        return { kind: 'Path', segments, span: this.spanFrom(start) };
      }

      return { kind: 'Ident', name, span: this.spanFrom(start) };
    }

    // Parenthesized expression
    if (this.check(TokenType.LeftParen)) {
      this.advance();
      if (this.check(TokenType.RightParen)) {
        this.advance();
        return { kind: 'Ident', name: '()', span: this.spanFrom(start) };
      }
      const expr = this.parseExpr();
      this.expect(TokenType.RightParen, "Expected ')'");
      return expr;
    }

    // Block expression
    if (this.check(TokenType.LeftBrace)) {
      const block = this.parseBlock();
      return { kind: 'BlockExpr', block, span: this.spanFrom(start) };
    }

    // Parallel expression
    if (this.check(TokenType.Parallel)) {
      this.advance();
      const body = this.parseBlock();
      return { kind: 'Parallel', body, span: this.spanFrom(start) };
    }

    // Scope expression
    if (this.check(TokenType.Scope)) {
      this.advance();
      const name = this.expectIdent("Expected scope variable name");
      this.expect(TokenType.Assign, "Expected '='");
      const initializer = this.parseExpr();
      const body = this.parseBlock();
      return { kind: 'Scope', name, initializer, body, span: this.spanFrom(start) };
    }

    this.error(`Unexpected token '${this.current().value}'`);
    this.advance();
    return { kind: 'Ident', name: '<error>', span: this.spanFrom(start) };
  }

  private parseCallArgs(): CallArg[] {
    const args: CallArg[] = [];
    if (this.check(TokenType.RightParen)) return args;

    args.push(this.parseCallArg());
    while (this.check(TokenType.Comma)) {
      this.advance();
      if (this.check(TokenType.RightParen)) break;
      args.push(this.parseCallArg());
    }
    return args;
  }

  private parseCallArg(): CallArg {
    const start = this.current().span;

    // Named argument: name: value
    if (this.check(TokenType.Identifier) && this.peekType(1) === TokenType.Colon) {
      const name = this.advance().value;
      this.advance(); // colon
      const value = this.parseExpr();
      return { kind: 'CallArg', name, value, span: this.spanFrom(start) };
    }

    const value = this.parseExpr();
    return { kind: 'CallArg', name: null, value, span: this.spanFrom(start) };
  }

  // ─── Operator Precedence ───────────────────────────────────────

  private getInfixPrecedence(): number {
    const t = this.current().type;
    switch (t) {
      case TokenType.Or: return 1;
      case TokenType.And: return 2;
      case TokenType.Eq:
      case TokenType.NotEq: return 3;
      case TokenType.Lt:
      case TokenType.Gt:
      case TokenType.LtEq:
      case TokenType.GtEq: return 4;
      case TokenType.DotDot:
      case TokenType.DotDotEq: return 5;
      case TokenType.Plus:
      case TokenType.Minus: return 6;
      case TokenType.Star:
      case TokenType.Slash:
      case TokenType.Percent: return 7;
      default: return -1;
    }
  }

  // ─── Token Helpers ─────────────────────────────────────────────

  private current(): Token {
    return this.tokens[this.pos] ?? {
      type: TokenType.EOF,
      value: '',
      span: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 }, file: '' },
    };
  }

  private advance(): Token {
    const token = this.current();
    if (!this.isAtEnd()) this.pos++;
    return token;
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private checkIdent(name: string): boolean {
    return this.current().type === TokenType.Identifier && this.current().value === name;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    this.error(message);
    return this.current();
  }

  private expectIdent(message: string): string {
    if (this.check(TokenType.Identifier)) {
      return this.advance().value;
    }
    this.error(message);
    return '<error>';
  }

  private expectIdentOrType(message: string): string {
    if (this.check(TokenType.Identifier) || this.check(TokenType.TypeIdentifier)) {
      return this.advance().value;
    }
    this.error(message);
    return '<error>';
  }

  /** Accept identifiers, type identifiers, and keywords usable as path segments */
  private expectPathSegment(message: string): string {
    if (this.check(TokenType.Identifier) || this.check(TokenType.TypeIdentifier)) {
      return this.advance().value;
    }
    // Keywords that can appear as module path segments
    const keywordTokens = [
      TokenType.Shared, TokenType.State, TokenType.Type, TokenType.Mod,
      TokenType.Server, TokenType.Actor, TokenType.Contract,
    ];
    for (const kw of keywordTokens) {
      if (this.check(kw)) return this.advance().value;
    }
    this.error(message);
    return '<error>';
  }

  private peekType(offset: number): TokenType {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) return TokenType.EOF;
    return this.tokens[idx]!.type;
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private spanFrom(start: Span): Span {
    const end = this.pos > 0 ? this.tokens[this.pos - 1]!.span.end : start.end;
    return { start: start.start, end, file: start.file };
  }

  private error(message: string): void {
    const token = this.current();
    this.diagnostics.push(createError(
      'P001',
      message,
      token.span,
    ));
  }

  private synchronize(): void {
    this.advance();
    while (!this.isAtEnd()) {
      const t = this.current().type;
      if (
        t === TokenType.Fn || t === TokenType.Type || t === TokenType.Actor ||
        t === TokenType.Contract || t === TokenType.Server || t === TokenType.Component ||
        t === TokenType.Use || t === TokenType.Mod || t === TokenType.Pub
      ) {
        return;
      }
      // Also sync on annotations since they precede declarations
      if (t === TokenType.Annotation) return;
      this.advance();
    }
  }
}
