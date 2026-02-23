/**
 * Scoped symbol table for C! name resolution.
 *
 * Each scope tracks:
 *   - values: variables, function names, parameters
 *   - types:  struct, enum, alias type names
 *
 * Scopes are pushed/popped as the resolver enters/exits blocks,
 * function bodies, actor members, etc.
 */

import type { Span } from '../lexer/index.js';

// ─── Symbol info ──────────────────────────────────────────────────

export type SymbolKind =
  | 'variable'
  | 'parameter'
  | 'function'
  | 'type'
  | 'struct'
  | 'enum'
  | 'variant'
  | 'actor'
  | 'contract'
  | 'server'
  | 'component'
  | 'state'
  | 'for-variable'
  | 'match-binding'
  | 'builtin';

export interface SymbolInfo {
  name: string;
  symbolKind: SymbolKind;
  span: Span;
  mutable: boolean;
  /** For struct types, the field names declared on the type. */
  fields?: string[];
  /** For actor types, the state and handler names. */
  members?: string[];
}

// ─── Scope ────────────────────────────────────────────────────────

interface Scope {
  values: Map<string, SymbolInfo>;
  types: Map<string, SymbolInfo>;
}

// ─── Symbol Table ─────────────────────────────────────────────────

export class SymbolTable {
  private scopes: Scope[] = [{ values: new Map(), types: new Map() }];

  // ── Values (variables, functions, parameters) ─────────────────

  /**
   * Define a value symbol in the current scope.
   * Returns false if a symbol with the same name already exists
   * in the *current* (innermost) scope.
   */
  defineValue(info: SymbolInfo): boolean {
    const current = this.currentScope();
    if (current.values.has(info.name)) {
      return false; // duplicate
    }
    current.values.set(info.name, info);
    return true;
  }

  /**
   * Look up a value by name, searching from innermost to outermost scope.
   */
  lookupValue(name: string): SymbolInfo | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const info = this.scopes[i]!.values.get(name);
      if (info !== undefined) return info;
    }
    return undefined;
  }

  /**
   * Check whether a value exists in the *current* (innermost) scope only.
   */
  hasValueInCurrentScope(name: string): boolean {
    return this.currentScope().values.has(name);
  }

  // ── Types (struct, enum, alias, actor, contract) ──────────────

  /**
   * Define a type symbol in the current scope.
   * Returns false if already defined in the current scope.
   */
  defineType(info: SymbolInfo): boolean {
    const current = this.currentScope();
    if (current.types.has(info.name)) {
      return false; // duplicate
    }
    current.types.set(info.name, info);
    return true;
  }

  /**
   * Look up a type by name, searching from innermost to outermost scope.
   */
  lookupType(name: string): SymbolInfo | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const info = this.scopes[i]!.types.get(name);
      if (info !== undefined) return info;
    }
    return undefined;
  }

  // ── Scope management ──────────────────────────────────────────

  enter(): void {
    this.scopes.push({ values: new Map(), types: new Map() });
  }

  leave(): void {
    if (this.scopes.length > 1) {
      this.scopes.pop();
    }
  }

  get depth(): number {
    return this.scopes.length;
  }

  private currentScope(): Scope {
    return this.scopes[this.scopes.length - 1]!;
  }
}
